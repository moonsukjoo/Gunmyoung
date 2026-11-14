import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  Compass,
  Crosshair,
  EyeOff,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import {
  CardinalBoundaryComparison,
  DEFAULT_FACTORY_CALIBRATION,
  DEFAULT_FACTORY_JIGS,
  FACTORY_CALIBRATION_DOC_ID,
  computeHaversineMeters,
  evaluateDeviceVsBoundaries,
  reconcileJigsWithCalibration
} from '../services/factoryTrackingService';
import {
  AveragedGpsResult,
  GpsCoordinateResult,
  GpsPermissionState,
  GpsWatchSubscription,
  checkGpsPermissionState,
  getAveragedGpsPosition,
  getCurrentGpsPosition,
  getGpsDiagnosticInfo,
  subscribeGpsPosition
} from '../lib/geolocationHelper';
import { FactoryBoundaryCalibration, FactoryJig } from '../types';

type DebugLayerMode = 'CLOSED' | 'EXPANDED';

interface GpsDebugTraceSample {
  id: string;
  ts: number;
  lat: number;
  lng: number;
  accuracy: number;
  source: GpsCoordinateResult['source'];
  sampleCount?: number;
  spreadMeters?: number;
  u: number;
  v: number;
  mapX: number;
  mapY: number;
  isInsideStrictWalls: boolean;
  isInsideFactory: boolean;
  boundaryDistanceMeters: number;
  matchedLabel: string;
  nearestJigName?: string;
  nearestDistMeters?: number;
}

const LEGACY_MODE_STORAGE_KEY = 'ceo_gps_debug_layer_mode';
const TRACKING_STORAGE_KEY = 'ceo_gps_debug_tracking_enabled';
const HISTORY_STORAGE_KEY = 'ceo_secret_gps_debug_history';
const MAX_HISTORY_SAMPLES = 40;

const readStoredTrackingEnabled = (): boolean => {
  try {
    const val = localStorage.getItem(TRACKING_STORAGE_KEY);
    if (val === 'false') return false;
  } catch {
    // ignore
  }
  return true;
};

const readStoredHistory = (): GpsDebugTraceSample[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_SAMPLES) : [];
  } catch {
    return [];
  }
};

const formatWallOffset = (meters: number | null): { text: string; tone: string } => {
  if (meters === null) {
    return { text: '미등록', tone: 'text-slate-400' };
  }
  if (meters >= 0) {
    return { text: `+${meters.toFixed(1)}m 내부`, tone: 'text-emerald-400' };
  }
  return { text: `${meters.toFixed(1)}m 이탈`, tone: 'text-rose-400' };
};

export const SecretGpsDebugLayer: React.FC = () => {
  const { user, profile } = useAuth();
  const isCEO = Boolean(
    user &&
      profile &&
      (profile.role === 'CEO' || profile.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com')
  );

  // Never auto-open on login or reload: opens strictly when CEO clicks the debug menu
  const [mode, setMode] = useState<DebugLayerMode>('CLOSED');
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(readStoredTrackingEnabled);
  const [permissionState, setPermissionState] = useState<GpsPermissionState>('prompt');
  const [jigs, setJigs] = useState<FactoryJig[]>(DEFAULT_FACTORY_JIGS);
  const [calibration, setCalibration] = useState<FactoryBoundaryCalibration | null>(null);
  const [latestPos, setLatestPos] = useState<(GpsCoordinateResult & { sampleCount?: number; spreadMeters?: number }) | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isRefreshingManual, setIsRefreshingManual] = useState(false);
  const [isAveragingTest, setIsAveragingTest] = useState(false);
  const [history, setHistory] = useState<GpsDebugTraceSample[]>(readStoredHistory);
  const [activeSubTab, setActiveSubTab] = useState<'BOUNDARY' | 'LOGS'>('BOUNDARY');

  const gpsDiag = useMemo(() => getGpsDiagnosticInfo(), []);
  const lastRecordedRef = useRef<{ ts: number; lat: number; lng: number } | null>(null);

  const jigsRef = useRef<FactoryJig[]>(jigs);
  const calibrationRef = useRef<FactoryBoundaryCalibration | null>(calibration);
  jigsRef.current = jigs;
  calibrationRef.current = calibration;

  const persistMode = useCallback((nextMode: DebugLayerMode) => {
    setMode(nextMode);
  }, []);

  // Clean up any legacy auto-open storage state from prior versions
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_MODE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const persistTrackingEnabled = useCallback((next: boolean) => {
    setTrackingEnabled(next);
    try {
      localStorage.setItem(TRACKING_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  // Subscribe to Firestore factory calibration & JIGs only when explicitly opened by CEO
  useEffect(() => {
    if (!isCEO || mode !== 'EXPANDED') return;

    const unsubCal = onSnapshot(
      doc(db, 'factoryCalibration', FACTORY_CALIBRATION_DOC_ID),
      (snap) => {
        if (snap.exists()) {
          setCalibration({ ...DEFAULT_FACTORY_CALIBRATION, ...snap.data() } as FactoryBoundaryCalibration);
        } else {
          setCalibration(null);
        }
      },
      (err) => {
        console.warn('[SecretGpsDebugLayer] calibration snapshot warning:', err?.message || err);
      }
    );

    const unsubJigs = onSnapshot(
      collection(db, 'factoryJigs'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs
            .map(d => ({ ...d.data() } as FactoryJig))
            .sort((a, b) => a.jigNumber - b.jigNumber);
          setJigs(list);
        }
      },
      (err) => {
        console.warn('[SecretGpsDebugLayer] jigs snapshot warning:', err?.message || err);
      }
    );

    return () => {
      unsubCal();
      unsubJigs();
    };
  }, [isCEO, mode]);

  // Process incoming GPS fix cleanly and store rolling trace in background
  const handlePositionFix = useCallback(
    (
      pos: GpsCoordinateResult & { sampleCount?: number; spreadMeters?: number },
      forceLog = false
    ) => {
      setLatestPos(pos);
      setLastError(null);
      setPermissionState('granted');

      const comp = evaluateDeviceVsBoundaries(pos.lat, pos.lng, jigsRef.current, calibrationRef.current);
      const prev = lastRecordedRef.current;
      const elapsedMs = prev ? pos.timestamp - prev.ts : Infinity;
      const movedMeters = prev ? computeHaversineMeters(prev.lat, prev.lng, pos.lat, pos.lng) : Infinity;

      if (forceLog || elapsedMs >= 2500 || movedMeters >= 1.5) {
        lastRecordedRef.current = { ts: pos.timestamp, lat: pos.lat, lng: pos.lng };
        const sample: GpsDebugTraceSample = {
          id: `${pos.timestamp}_${Math.random().toString(36).slice(2, 6)}`,
          ts: pos.timestamp,
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          source: pos.source,
          sampleCount: pos.sampleCount,
          spreadMeters: pos.spreadMeters,
          u: comp.u,
          v: comp.v,
          mapX: comp.mapX,
          mapY: comp.mapY,
          isInsideStrictWalls: comp.isInsideStrictWalls,
          isInsideFactory: comp.isInsideFactory,
          boundaryDistanceMeters: comp.boundaryDistanceMeters,
          matchedLabel: comp.location.locationLabel,
          nearestJigName: comp.nearestJigs[0]?.jigName,
          nearestDistMeters: comp.nearestJigs[0]?.distanceMeters
        };

        setHistory(prevList => {
          const next = [sample, ...prevList].slice(0, MAX_HISTORY_SAMPLES);
          try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore quota error
          }
          return next;
        });
      }
    },
    []
  );

  // Listen for CEO menu click events to open/close on demand
  useEffect(() => {
    if (!isCEO) return;

    const handleCustomControl = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: DebugLayerMode | 'MINI'; toggle?: boolean }>).detail;
      if (detail?.mode === 'CLOSED') {
        setMode('CLOSED');
      } else if (detail?.mode === 'EXPANDED' || detail?.mode === 'MINI') {
        setMode('EXPANDED');
      } else if (detail?.toggle) {
        setMode(prev => (prev === 'CLOSED' ? 'EXPANDED' : 'CLOSED'));
      }
    };

    window.addEventListener('secret-gps-debug-control', handleCustomControl as EventListener);
    return () => {
      window.removeEventListener('secret-gps-debug-control', handleCustomControl as EventListener);
    };
  }, [isCEO]);

  // Run GPS watcher ONLY while CEO has explicitly opened the debugger from the menu
  useEffect(() => {
    if (!isCEO || !trackingEnabled || mode !== 'EXPANDED') return;

    let mounted = true;
    let watchSub: GpsWatchSubscription | null = null;
    let periodicTimer: number | null = null;
    let capAppListener: any = null;

    const initWatcher = async () => {
      const perm = await checkGpsPermissionState();
      if (!mounted) return;
      setPermissionState(perm);

      if (perm !== 'granted') return;

      watchSub = await subscribeGpsPosition(
        (pos) => {
          if (mounted) handlePositionFix(pos);
        },
        (err) => {
          if (mounted) setLastError(err.message);
        },
        {
          enableHighAccuracy: true,
          timeoutMs: 12000,
          maximumAgeMs: 2000,
          requestPermissionIfNeeded: false
        }
      );

      periodicTimer = window.setInterval(() => {
        if (!mounted || document.hidden) return;
        getCurrentGpsPosition({ timeoutMs: 8000, maximumAgeMs: 5000 })
          .then((pos) => {
            if (mounted) handlePositionFix(pos);
          })
          .catch(() => {});
      }, 15000);
    };

    initWatcher();

    const handleVisibilityChange = () => {
      if (!document.hidden && permissionState === 'granted') {
        getCurrentGpsPosition({ timeoutMs: 10000, maximumAgeMs: 2000 })
          .then((pos) => {
            if (mounted) handlePositionFix(pos);
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!mounted || !isActive) return;
        checkGpsPermissionState().then((perm) => {
          if (!mounted) return;
          setPermissionState(perm);
          if (perm === 'granted') {
            getCurrentGpsPosition({ timeoutMs: 10000, maximumAgeMs: 1000 })
              .then((pos) => {
                if (mounted) handlePositionFix(pos);
              })
              .catch(() => {});
          }
        });
      })
        .then((l) => {
          if (mounted) capAppListener = l;
          else l.remove();
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
      if (watchSub) watchSub.unsubscribe();
      if (periodicTimer !== null) window.clearInterval(periodicTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (capAppListener && typeof capAppListener.remove === 'function') {
        capAppListener.remove();
      }
    };
  }, [isCEO, trackingEnabled, mode, permissionState, handlePositionFix]);

  const handleManualRefreshAndRequest = async () => {
    setIsRefreshingManual(true);
    setLastError(null);
    try {
      const pos = await getCurrentGpsPosition({ timeoutMs: 12000, maximumAgeMs: 0 });
      handlePositionFix(pos, true);
      if (!trackingEnabled) {
        persistTrackingEnabled(true);
      }
    } catch (err: any) {
      setLastError(err?.message || 'GPS 수신에 실패했습니다.');
      const nextPerm = await checkGpsPermissionState();
      setPermissionState(nextPerm);
    } finally {
      setIsRefreshingManual(false);
    }
  };

  const handleAveragedMeasurementTest = async () => {
    setIsAveragingTest(true);
    setLastError(null);
    try {
      const avgPos: AveragedGpsResult = await getAveragedGpsPosition({
        attempts: 5,
        minSamples: 2,
        intervalMs: 1000,
        timeoutPerAttemptMs: 8000,
        silent: false
      });
      handlePositionFix(
        {
          ...avgPos,
          sampleCount: avgPos.sampleCount,
          spreadMeters: avgPos.spreadMeters
        },
        true
      );
      if (!trackingEnabled) {
        persistTrackingEnabled(true);
      }
    } catch (err: any) {
      setLastError(err?.message || '다중 평균 GPS 측정에 실패했습니다.');
      const nextPerm = await checkGpsPermissionState();
      setPermissionState(nextPerm);
    } finally {
      setIsAveragingTest(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    lastRecordedRef.current = null;
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const reconciledJigs = useMemo(
    () => reconcileJigsWithCalibration(jigs, calibration),
    [jigs, calibration]
  );

  const comparison: CardinalBoundaryComparison | null = useMemo(() => {
    if (!latestPos) return null;
    return evaluateDeviceVsBoundaries(latestPos.lat, latestPos.lng, reconciledJigs, calibration);
  }, [latestPos, reconciledJigs, calibration]);

  // Never render for workers, and never auto-render as a popup when CLOSED
  if (!isCEO || mode !== 'EXPANDED') {
    return null;
  }

  const eastWall = formatWallOffset(comparison?.wallClearances.east ?? null);
  const westWall = formatWallOffset(comparison?.wallClearances.west ?? null);
  const southWall = formatWallOffset(comparison?.wallClearances.south ?? null);
  const northWall = formatWallOffset(comparison?.wallClearances.north ?? null);

  const statusTone = !comparison?.hasCalibration
    ? { label: '기준점 미설정', text: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' }
    : comparison.isInsideStrictWalls
    ? { label: '동서남북 범위 내부', text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' }
    : comparison.isInsideFactory
    ? { label: '경계 인접 (보정 허용)', text: 'text-cyan-400', border: 'border-cyan-500/40', bg: 'bg-cyan-500/10' }
    : { label: `범위 이탈 (${comparison.boundaryDistanceMeters}m)`, text: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/10' };

  const radarDotX = comparison ? Math.max(8, Math.min(272, (comparison.rawMapX / 1414) * 280)) : 140;
  const radarDotY = comparison ? Math.max(8, Math.min(172, (comparison.rawMapY / 1000) * 180)) : 90;

  return (
    <div className="fixed bottom-16 inset-x-2.5 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[420px] max-h-[82vh] flex flex-col z-[90] bg-slate-950/95 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-md text-slate-100 overflow-hidden">
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white truncate">7공장 동서남북 GPS 좌표 디버그</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 whitespace-nowrap">
                수동 점검
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              작업자 체류시간은 자동 기록 · 메뉴 열기 시에만 범위 비교 테스트
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => persistMode('CLOSED')}
            title="닫기 (위치 수신 즉시 종료)"
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <EyeOff className="w-3 h-3 text-amber-400 shrink-0" />
            <span>닫기</span>
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="p-3.5 space-y-3 overflow-y-auto">
        {/* Live Device Status & Action Row */}
        <div className={`p-2.5 rounded-xl border ${statusTone.border} ${statusTone.bg} space-y-2`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  trackingEnabled && latestPos ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className={`text-xs font-black truncate ${statusTone.text}`}>{statusTone.label}</span>
            </div>
            <span className="text-[10px] font-mono tabular-nums text-slate-300 shrink-0">
              {latestPos
                ? `${latestPos.sampleCount ? `${latestPos.sampleCount}회 평균 · ` : ''}${
                    latestPos.source === 'CAPACITOR_NATIVE' ? 'APK' : '웹'
                  } ±${latestPos.accuracy}m`
                : gpsDiag.isNative
                ? 'APK 대기'
                : '웹 대기'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
            <div className="bg-slate-900/70 rounded-lg px-2 py-1.5 border border-slate-800/80">
              <div className="text-[10px] text-slate-400 font-sans">현재 위도 (Lat)</div>
              <div className="font-bold text-slate-100">{latestPos ? latestPos.lat.toFixed(6) : '수신 대기'}</div>
            </div>
            <div className="bg-slate-900/70 rounded-lg px-2 py-1.5 border border-slate-800/80">
              <div className="text-[10px] text-slate-400 font-sans">현재 경도 (Lng)</div>
              <div className="font-bold text-slate-100">{latestPos ? latestPos.lng.toFixed(6) : '수신 대기'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleManualRefreshAndRequest}
              disabled={isRefreshingManual || isAveragingTest}
              className="h-8 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Crosshair className={`w-3.5 h-3.5 shrink-0 ${isRefreshingManual ? 'animate-spin' : ''}`} />
              <span>{permissionState !== 'granted' ? '권한 · 1회 측정' : isRefreshingManual ? '수신 중...' : '즉시 1회 측정'}</span>
            </button>

            <button
              type="button"
              onClick={handleAveragedMeasurementTest}
              disabled={isAveragingTest || isRefreshingManual}
              className="h-8 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isAveragingTest ? 'animate-spin' : ''}`} />
              <span>{isAveragingTest ? '5회 평균 측정중...' : '5회 재시도 평균'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-slate-300">
            <span>
              {latestPos?.spreadMeters !== undefined
                ? `다중 샘플 산포 오차: ${latestPos.spreadMeters}m`
                : '작업자 단말기는 정시(08:20~17:45)마다 5회 평균 무음 기록'}
            </span>
            <button
              type="button"
              onClick={() => persistTrackingEnabled(!trackingEnabled)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              {trackingEnabled ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
              <span>{trackingEnabled ? '추적 일시정지' : '추적 재개'}</span>
            </button>
          </div>

          {lastError && (
            <div className="flex items-start gap-1.5 text-[10px] text-rose-300 bg-rose-950/50 border border-rose-500/30 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{lastError}</span>
            </div>
          )}
        </div>

        {/* Sub-tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('BOUNDARY')}
            className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'BOUNDARY'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            동서남북 경계 비교
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('LOGS')}
            className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'LOGS'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            백그라운드 추적 기록 ({history.length})
          </button>
        </div>

        {activeSubTab === 'BOUNDARY' ? (
          <>
            {/* E/W/S/N Cross Comparison Grid */}
            <div className="space-y-1.5">
              {/* Top: SOUTH */}
              <div className="mx-auto w-2/3 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[10px] font-bold text-cyan-400">↑ 남쪽 경계 (SOUTH)</div>
                <div className={`text-xs font-mono tabular-nums font-black ${southWall.tone}`}>{southWall.text}</div>
                <div className="text-[10px] font-mono tabular-nums text-slate-400">
                  {comparison?.anchorDistances.south !== null && comparison?.anchorDistances.south !== undefined
                    ? `기준점 직선 ${comparison.anchorDistances.south}m`
                    : '남쪽 기준점 미등록'}
                </div>
              </div>

              {/* Middle: EAST | CENTER | WEST */}
              <div className="grid grid-cols-3 gap-1.5 items-stretch">
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-2 flex flex-col justify-center">
                  <div className="text-[10px] font-bold text-amber-400">← 동 (EAST)</div>
                  <div className={`text-[11px] font-mono tabular-nums font-black ${eastWall.tone}`}>{eastWall.text}</div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-400">
                    {comparison?.anchorDistances.east !== null && comparison?.anchorDistances.east !== undefined
                      ? `점 ${comparison.anchorDistances.east}m`
                      : '미등록'}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 flex flex-col justify-center text-center">
                  <div className="text-[10px] font-bold text-slate-400">정규화 (u, v)</div>
                  <div className="text-xs font-mono tabular-nums font-black text-white">
                    {comparison ? `${comparison.u.toFixed(2)}, ${comparison.v.toFixed(2)}` : '-'}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-400">
                    {comparison?.anchorDistances.center !== null && comparison?.anchorDistances.center !== undefined
                      ? `중심 ${comparison.anchorDistances.center}m`
                      : `${calibration?.eastWestLengthMeters || 230}×${calibration?.northSouthLengthMeters || 180}m`}
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-2 flex flex-col justify-center text-right">
                  <div className="text-[10px] font-bold text-amber-400">서 (WEST) →</div>
                  <div className={`text-[11px] font-mono tabular-nums font-black ${westWall.tone}`}>{westWall.text}</div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-400">
                    {comparison?.anchorDistances.west !== null && comparison?.anchorDistances.west !== undefined
                      ? `점 ${comparison.anchorDistances.west}m`
                      : '미등록'}
                  </div>
                </div>
              </div>

              {/* Bottom: NORTH */}
              <div className="mx-auto w-2/3 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[10px] font-bold text-slate-300">↓ 북쪽 경계 (NORTH)</div>
                <div className={`text-xs font-mono tabular-nums font-black ${northWall.tone}`}>{northWall.text}</div>
                <div className="text-[10px] font-mono tabular-nums text-slate-400">
                  {comparison?.anchorDistances.north !== null && comparison?.anchorDistances.north !== undefined
                    ? `기준점 직선 ${comparison.anchorDistances.north}m`
                    : '북쪽 기준점 미등록'}
                </div>
              </div>
            </div>

            {/* Compact Live Tactical E/W/S/N Perimeter Radar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>실시간 도면 투영 레이더 ({comparison ? comparison.location.locationLabel : '위치 대기'})</span>
                <span className="font-mono tabular-nums">
                  {comparison ? `(${comparison.rawMapX}, ${comparison.rawMapY})` : '-'}
                </span>
              </div>

              <svg viewBox="0 0 280 180" className="w-full h-36 bg-slate-950 rounded-lg border border-slate-800/80">
                <rect
                  x="4"
                  y="4"
                  width="272"
                  height="172"
                  fill="none"
                  stroke={comparison?.isInsideStrictWalls ? '#10b981' : '#f59e0b'}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <line x1="6" y1="90" x2="274" y2="90" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

                <text x="140" y="13" textAnchor="middle" fill="#22d3ee" fontSize="8" fontWeight="bold">
                  남 (SOUTH)
                </text>
                <text x="140" y="174" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold">
                  북 (NORTH)
                </text>
                <text x="8" y="93" textAnchor="start" fill="#fbbf24" fontSize="8" fontWeight="bold">
                  동
                </text>
                <text x="272" y="93" textAnchor="end" fill="#fbbf24" fontSize="8" fontWeight="bold">
                  서
                </text>

                {reconciledJigs.map(j => {
                  const rx = (j.x / 1414) * 280;
                  const ry = (j.y / 1000) * 180;
                  const rw = (j.width / 1414) * 280;
                  const rh = (j.height / 1000) * 180;
                  const isMatched = comparison?.location.jigId === j.id;
                  return (
                    <g key={j.id}>
                      <rect
                        x={rx}
                        y={ry}
                        width={rw}
                        height={rh}
                        rx="2"
                        fill={isMatched ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.65)'}
                        stroke={isMatched ? '#34d399' : '#475569'}
                        strokeWidth={isMatched ? '1.5' : '0.8'}
                      />
                      <text
                        x={rx + rw / 2}
                        y={ry + rh / 2 + 2}
                        textAnchor="middle"
                        fill={isMatched ? '#6ee7b7' : '#94a3b8'}
                        fontSize="6.5"
                        fontWeight="bold"
                      >
                        {j.jigName.replace('JIG-', 'J')}
                      </text>
                    </g>
                  );
                })}

                {history.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="rgba(34, 211, 238, 0.45)"
                    strokeWidth="1.5"
                    points={history
                      .slice(0, 15)
                      .map(h => `${Math.max(4, Math.min(276, (h.mapX / 1414) * 280))},${Math.max(4, Math.min(176, (h.mapY / 1000) * 180))}`)
                      .join(' ')}
                  />
                )}

                {comparison && (
                  <g>
                    <circle
                      cx={radarDotX}
                      cy={radarDotY}
                      r="9"
                      fill={comparison.isInsideFactory ? 'rgba(34, 211, 238, 0.22)' : 'rgba(244, 63, 94, 0.25)'}
                      stroke={comparison.isInsideFactory ? '#22d3ee' : '#f43f5e'}
                      strokeWidth="1"
                    />
                    <circle
                      cx={radarDotX}
                      cy={radarDotY}
                      r="3.5"
                      fill={comparison.isInsideFactory ? '#22d3ee' : '#f43f5e'}
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  </g>
                )}
              </svg>
            </div>

            {comparison && comparison.nearestJigs.length > 0 && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400">최근접 정반 블럭 거리 비교 (Top 3)</div>
                <div className="space-y-1">
                  {comparison.nearestJigs.map((nj, idx) => (
                    <div
                      key={nj.id}
                      className="flex items-center justify-between text-[11px] font-mono tabular-nums py-1 border-b last:border-b-0 border-slate-800/70"
                    >
                      <div className="flex items-center gap-1.5 font-sans">
                        <span className="text-slate-500 font-mono">{idx + 1}.</span>
                        <span className="font-bold text-slate-200">{nj.jigName}</span>
                        <span className="text-cyan-400 text-[10px]">{nj.blockName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400 text-[10px]">반경 ±{nj.radiusMeters}m</span>
                        <span className={`font-bold ${nj.withinRadius ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {nj.distanceMeters}m
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-bold">
                누적 비교 좌표 샘플 (최대 {MAX_HISTORY_SAMPLES}건)
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>기록 지우기</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                수신된 GPS 로그가 아직 없습니다.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] font-mono tabular-nums space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300 font-bold">
                        {new Date(item.ts).toLocaleTimeString('ko-KR', { hour12: false })} · ±{item.accuracy}m
                        {item.sampleCount ? ` (${item.sampleCount}회 평균)` : ''}
                      </span>
                      <span className={item.isInsideStrictWalls ? 'text-emerald-400 font-bold font-sans' : item.isInsideFactory ? 'text-cyan-400 font-bold font-sans' : 'text-rose-400 font-bold font-sans'}>
                        {item.isInsideStrictWalls ? '범위 내' : item.isInsideFactory ? '경계 보정' : `이탈 ${item.boundaryDistanceMeters}m`}
                      </span>
                    </div>
                    <div className="text-slate-400 truncate">
                      {item.lat.toFixed(6)}, {item.lng.toFixed(6)} · (u:{item.u.toFixed(2)}, v:{item.v.toFixed(2)})
                    </div>
                    <div className="font-sans text-cyan-300 truncate">
                      {item.matchedLabel}
                      {item.nearestJigName && item.nearestDistMeters !== undefined
                        ? ` (${item.nearestJigName} ${item.nearestDistMeters}m)`
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecretGpsDebugLayer;
