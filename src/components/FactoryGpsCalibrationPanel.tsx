import React, { useEffect, useMemo, useState } from 'react';
import {
  CardinalGpsPoint,
  FactoryBoundaryCalibration,
  FactoryJig
} from '../types';
import {
  DEFAULT_FACTORY_CALIBRATION,
  applyCalibrationToAllJigs,
  computeHaversineMeters,
  generateCalibratedJigGps,
  gpsToBlueprint,
  identifyLocationFromCoords
} from '../services/factoryTrackingService';
import {
  Compass,
  Crosshair,
  MapPin,
  Ruler,
  CheckCircle2,
  RotateCcw,
  Navigation,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type CardinalDirection = 'south' | 'east' | 'west' | 'north';

interface FactoryGpsCalibrationPanelProps {
  jigs: FactoryJig[];
  calibration: FactoryBoundaryCalibration | null;
  userUid?: string;
  userName?: string;
  onCalibrationSaved: (savedCal: FactoryBoundaryCalibration, updatedJigs: FactoryJig[]) => void;
  onSelectJig?: (jig: FactoryJig) => void;
}

const DIRECTION_META: Record<
  CardinalDirection,
  {
    title: string;
    subtitle: string;
    arrowLabel: string;
    accentText: string;
    accentBorder: string;
  }
> = {
  south: {
    title: '남쪽 기준점 (SOUTH)',
    subtitle: '도면 위쪽 · BAY A 외벽 / 안벽 방면',
    arrowLabel: '위쪽 (↑)',
    accentText: 'text-cyan-400',
    accentBorder: 'border-cyan-500/40'
  },
  east: {
    title: '동쪽 기준점 (EAST)',
    subtitle: '도면 왼쪽 · 제6공장 연결 반입문',
    arrowLabel: '왼쪽 (←)',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/40'
  },
  west: {
    title: '서쪽 기준점 (WEST)',
    subtitle: '도면 오른쪽 · 완성 블럭 반출문',
    arrowLabel: '오른쪽 (→)',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/40'
  },
  north: {
    title: '북쪽 기준점 (NORTH)',
    subtitle: '도면 아래쪽 · BAY B 외벽 / 자재 반입 방면',
    arrowLabel: '아래쪽 (↓)',
    accentText: 'text-slate-300',
    accentBorder: 'border-slate-500/40'
  }
};

export const FactoryGpsCalibrationPanel: React.FC<FactoryGpsCalibrationPanelProps> = ({
  jigs,
  calibration,
  userUid,
  userName,
  onCalibrationSaved,
  onSelectJig
}) => {
  const [draft, setDraft] = useState<FactoryBoundaryCalibration>(() => ({
    ...DEFAULT_FACTORY_CALIBRATION,
    ...(calibration || {})
  }));
  const [capturingDir, setCapturingDir] = useState<CardinalDirection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingMatch, setIsTestingMatch] = useState(false);
  const [testMatchResult, setTestMatchResult] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    matchedLabel: string;
    isInsideFactory: boolean;
    nearestDistanceMeters?: number;
  } | null>(null);

  useEffect(() => {
    if (calibration) {
      setDraft({
        ...DEFAULT_FACTORY_CALIBRATION,
        ...calibration
      });
    }
  }, [calibration]);

  const preview = useMemo(
    () => generateCalibratedJigGps(jigs, draft),
    [jigs, draft]
  );

  const capturedDirectionsCount = useMemo(() => {
    return (['east', 'west', 'south', 'north'] as CardinalDirection[]).filter(dir => {
      const pt = draft[dir];
      return pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng) && Math.abs(pt.lat) > 1;
    }).length;
  }, [draft]);

  const handleCaptureDirectionGps = (dir: CardinalDirection) => {
    if (!navigator.geolocation) {
      toast.error('이 기기/브라우저에서는 GPS 위치 측정을 지원하지 않습니다.');
      return;
    }

    setCapturingDir(dir);
    toast.loading(`${DIRECTION_META[dir].title} GPS 좌표를 정밀 수신 중...`, { id: `gps-cap-${dir}` });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        const accuracy = Math.round(pos.coords.accuracy * 10) / 10;

        setDraft(prev => ({
          ...prev,
          [dir]: {
            lat,
            lng,
            accuracy,
            capturedAt: new Date().toISOString(),
            label: DIRECTION_META[dir].title
          }
        }));

        toast.dismiss(`gps-cap-${dir}`);
        toast.success(`${DIRECTION_META[dir].title} GPS 등록 완료 (오차 ±${accuracy}m)`);
        setCapturingDir(null);
      },
      (err) => {
        toast.dismiss(`gps-cap-${dir}`);
        toast.error(`GPS 수신 실패: ${err.message}`);
        setCapturingDir(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleManualCoordChange = (dir: CardinalDirection, field: 'lat' | 'lng', rawVal: string) => {
    const parsed = parseFloat(rawVal);
    setDraft(prev => {
      const current = prev[dir] || { lat: 0, lng: 0 };
      const updated: CardinalGpsPoint = {
        ...current,
        [field]: Number.isFinite(parsed) ? parsed : 0,
        capturedAt: new Date().toISOString()
      };
      return {
        ...prev,
        [dir]: updated
      };
    });
  };

  const handleClearDirection = (dir: CardinalDirection) => {
    setDraft(prev => ({
      ...prev,
      [dir]: null
    }));
  };

  const handleApplyAndSave = async () => {
    if (!preview.basis) {
      toast.error('동·서·남·북 칸 중 최소 1곳 이상 GPS 좌표를 등록해 주세요.');
      return;
    }
    if (!draft.eastWestLengthMeters || draft.eastWestLengthMeters < 10 || !draft.northSouthLengthMeters || draft.northSouthLengthMeters < 10) {
      toast.error('동서 길이와 남북 길이를 10m 이상으로 정확히 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: FactoryBoundaryCalibration = {
        ...draft,
        updatedAt: new Date().toISOString(),
        updatedByUid: userUid,
        updatedByName: userName || '대표이사'
      };
      const result = await applyCalibrationToAllJigs(jigs, payload);
      const savedCal: FactoryBoundaryCalibration = {
        ...payload,
        centerLat: result.basis.centerLat,
        centerLng: result.basis.centerLng,
        rotationDeg: result.basis.rotationDeg,
        gpsMeasuredEW: result.basis.gpsMeasuredEW,
        gpsMeasuredNS: result.basis.gpsMeasuredNS
      };
      onCalibrationSaved(savedCal, result.calibratedJigs);
      toast.success(`7공장 10개 정반/블럭의 중심 GPS 좌표가 자동 산출 및 저장되었습니다.`);
    } catch (err) {
      console.error(err);
      toast.error('기준점 및 블럭 GPS 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestCurrentPositionMatch = () => {
    if (!preview.basis) {
      toast.error('먼저 동·서·남·북 기준점 GPS를 1개 이상 등록해 주세요.');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('위치 정보를 지원하지 않는 기기입니다.');
      return;
    }

    setIsTestingMatch(true);
    toast.loading('현재 서 계신 위치로 가장 가까운 정반 블럭을 판정 중...', { id: 'test-match' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy * 10) / 10;
        const mapped = gpsToBlueprint(lat, lng, preview.basis!);
        const loc = identifyLocationFromCoords(mapped.mapX, mapped.mapY, preview.calibratedJigs[0]?.id || 'jig-01', preview.calibratedJigs);

        let nearestDist: number | undefined;
        if (loc.jigId) {
          const matchedJig = preview.calibratedJigs.find(j => j.id === loc.jigId);
          if (matchedJig?.centerLat && matchedJig?.centerLng) {
            nearestDist = computeHaversineMeters(lat, lng, matchedJig.centerLat, matchedJig.centerLng);
          }
        }

        setTestMatchResult({
          lat: Number(lat.toFixed(7)),
          lng: Number(lng.toFixed(7)),
          accuracy,
          matchedLabel: loc.locationLabel,
          isInsideFactory: mapped.isInsideFactory,
          nearestDistanceMeters: nearestDist
        });

        toast.dismiss('test-match');
        toast.success(`현재 위치 판정: ${loc.locationLabel}`);
        setIsTestingMatch(false);
      },
      (err) => {
        toast.dismiss('test-match');
        toast.error(`위치 판정 실패: ${err.message}`);
        setIsTestingMatch(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const renderCardinalBox = (dir: CardinalDirection) => {
    const meta = DIRECTION_META[dir];
    const point = draft[dir];
    const hasPoint = Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) > 1);
    const isCapturing = capturingDir === dir;

    return (
      <div className={`bg-card border ${hasPoint ? meta.accentBorder : 'border-border'} rounded-2xl p-4 space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <span>{meta.arrowLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{hasPoint ? '등록됨' : '미등록'}</span>
            </div>
            <h4 className={`text-sm font-black ${meta.accentText}`}>{meta.title}</h4>
            <p className="text-[11px] text-muted-foreground truncate">{meta.subtitle}</p>
          </div>
          {hasPoint && (
            <button
              type="button"
              onClick={() => handleClearDirection(dir)}
              title="이 방향 좌표 초기화"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button
          type="button"
          onClick={() => handleCaptureDirectionGps(dir)}
          disabled={isCapturing}
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs gap-2 cursor-pointer whitespace-nowrap"
        >
          <Crosshair className="w-4 h-4 shrink-0" />
          <span>{isCapturing ? 'GPS 수신 중...' : '현 위치 GPS 등록'}</span>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground mb-1">위도 (Lat)</label>
            <input
              type="number"
              step="0.000001"
              value={point?.lat || ''}
              placeholder="35.502800"
              onChange={(e) => handleManualCoordChange(dir, 'lat', e.target.value)}
              className="w-full px-2.5 py-2 bg-muted/60 border border-border rounded-lg text-xs font-mono tabular-nums font-bold text-foreground outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground mb-1">경도 (Lng)</label>
            <input
              type="number"
              step="0.000001"
              value={point?.lng || ''}
              placeholder="129.418500"
              onChange={(e) => handleManualCoordChange(dir, 'lng', e.target.value)}
              className="w-full px-2.5 py-2 bg-muted/60 border border-border rounded-lg text-xs font-mono tabular-nums font-bold text-foreground outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {hasPoint && point && (
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-muted-foreground pt-1 border-t border-border/60">
            <span>{point.accuracy ? `정확도 ±${point.accuracy}m` : '직접 입력 좌표'}</span>
            <span>{point.capturedAt ? point.capturedAt.slice(11, 19) : ''}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>동·서·남·북 현장 실측 캘리브레이션</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-foreground">등록 {capturedDirectionsCount}/4 방향</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-foreground">
            7공장 동서남북 GPS 기준점 등록 및 정반 블럭 좌표 자동 산출
          </h3>
          <p className="text-xs text-muted-foreground font-medium">
            현장에서 동·서·남·북 끝 지점 GPS를 찍고 실제 공장 길이(m)를 입력하면, 도면 위 10개 정반(JIG-01~10)과 블럭의 중심 GPS 좌표가 비례·회전 보정되어 자동 계산됩니다.
          </p>
        </div>

        {preview.basis && (
          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-emerald-400 font-bold shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              중심 {preview.basis.centerLat.toFixed(5)}, {preview.basis.centerLng.toFixed(5)} · 방위각 {preview.basis.rotationDeg}°
            </span>
          </div>
        )}
      </div>

      {/* Cardinal Cross Layout (South Top, East Left, Dimensions Center, West Right, North Bottom) */}
      <div className="space-y-3">
        {/* Top Row: SOUTH */}
        <div className="max-w-md mx-auto w-full">
          {renderCardinalBox('south')}
        </div>

        {/* Middle Row: EAST | Center Dimensions & Auto-Calc | WEST */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          {renderCardinalBox('east')}

          {/* Center Control Box: Measured Lengths (m) & Actions */}
          <div className="bg-muted/30 border border-border rounded-2xl p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-sm font-black text-foreground">공장 실측 길이 입력 (m)</h4>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    동 ↔ 서 길이 (m)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    step="0.5"
                    value={draft.eastWestLengthMeters || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, eastWestLengthMeters: Number(e.target.value) }))}
                    placeholder="예: 230"
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm font-mono tabular-nums font-black text-foreground outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    남 ↔ 북 폭 (m)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    step="0.5"
                    value={draft.northSouthLengthMeters || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, northSouthLengthMeters: Number(e.target.value) }))}
                    placeholder="예: 180"
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm font-mono tabular-nums font-black text-foreground outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {preview.basis && (preview.basis.gpsMeasuredEW !== undefined || preview.basis.gpsMeasuredNS !== undefined) && (
                <div className="text-[11px] font-mono tabular-nums text-muted-foreground space-y-1 pt-2 border-t border-border/60">
                  {preview.basis.gpsMeasuredEW !== undefined && (
                    <div className="flex justify-between">
                      <span>GPS 환산 동↔서 거리</span>
                      <strong className="text-foreground">{preview.basis.gpsMeasuredEW}m</strong>
                    </div>
                  )}
                  {preview.basis.gpsMeasuredNS !== undefined && (
                    <div className="flex justify-between">
                      <span>GPS 환산 남↔북 거리</span>
                      <strong className="text-foreground">{preview.basis.gpsMeasuredNS}m</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                onClick={handleApplyAndSave}
                disabled={isSaving || !preview.basis}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 cursor-pointer whitespace-nowrap"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>{isSaving ? '산출 및 저장 중...' : '정반 블럭 10개 GPS 자동 산출 · 저장'}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleTestCurrentPositionMatch}
                disabled={isTestingMatch || !preview.basis}
                className="w-full h-10 rounded-xl border-border text-xs font-bold gap-2 cursor-pointer whitespace-nowrap"
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{isTestingMatch ? '위치 확인 중...' : '현 위치로 정반 매칭 테스트'}</span>
              </Button>

              {testMatchResult && (
                <div className="p-2.5 rounded-xl bg-card border border-cyan-500/40 text-[11px] space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-cyan-400">{testMatchResult.matchedLabel}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">±{testMatchResult.accuracy}m</span>
                  </div>
                  <div className="font-mono tabular-nums text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>{testMatchResult.lat}, {testMatchResult.lng}</span>
                    <span>
                      {testMatchResult.nearestDistanceMeters !== undefined
                        ? `중심거리 ${testMatchResult.nearestDistanceMeters}m`
                        : testMatchResult.isInsideFactory ? '공장 내부' : '공장 외곽'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {renderCardinalBox('west')}
        </div>

        {/* Bottom Row: NORTH */}
        <div className="max-w-md mx-auto w-full">
          {renderCardinalBox('north')}
        </div>
      </div>

      {/* Auto-Computed Block / JIG GPS Coordinate Table */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              정반 위 10개 블럭 자동 산출 GPS 기준 좌표
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {preview.basis
                ? `입력한 실측 크기(${draft.eastWestLengthMeters}m × ${draft.northSouthLengthMeters}m)와 기준점 좌표를 바탕으로 자동 계산됩니다.`
                : '상단 동·서·남·북 중 최소 1곳 이상 GPS를 등록하면 10개 블럭 중심 좌표가 즉시 계산됩니다.'}
            </p>
          </div>
          {calibration?.updatedAt && (
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
              마지막 저장: {calibration.updatedAt.slice(0, 16).replace('T', ' ')}
            </span>
          )}
        </div>

        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground">
                <th className="py-2.5 px-3">지그</th>
                <th className="py-2.5 px-3">블럭명</th>
                <th className="py-2.5 px-3">라인</th>
                <th className="py-2.5 px-3 text-right">실측 환산 크기</th>
                <th className="py-2.5 px-3 text-right">중심 위도 (Lat)</th>
                <th className="py-2.5 px-3 text-right">중심 경도 (Lng)</th>
                <th className="py-2.5 px-3 text-right">인식 반경</th>
                <th className="py-2.5 px-3 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.calibratedJigs.map(cj => {
                const origJig = jigs.find(j => j.id === cj.id);
                const isPersistedMatch =
                  origJig?.centerLat !== undefined &&
                  cj.centerLat !== undefined &&
                  Math.abs(origJig.centerLat - cj.centerLat) < 1e-6 &&
                  origJig.centerLng !== undefined &&
                  cj.centerLng !== undefined &&
                  Math.abs(origJig.centerLng - cj.centerLng) < 1e-6;

                return (
                  <tr
                    key={cj.id}
                    onClick={() => onSelectJig && origJig && onSelectJig(origJig)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-black text-foreground whitespace-nowrap">{cj.jigName}</td>
                    <td className="py-2.5 px-3 font-black text-cyan-400 whitespace-nowrap">{cj.blockName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {cj.bay === 'BAY_SOUTH' ? 'BAY A (남측)' : 'BAY B (북측)'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                      {cj.gpsWidthMeters && cj.gpsHeightMeters ? `${cj.gpsWidthMeters}m × ${cj.gpsHeightMeters}m` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                      {cj.centerLat ? cj.centerLat.toFixed(6) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                      {cj.centerLng ? cj.centerLng.toFixed(6) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-400 font-bold whitespace-nowrap">
                      {cj.gpsRadiusMeters ? `±${cj.gpsRadiusMeters}m` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {!cj.centerLat ? (
                        <span className="text-[11px] text-muted-foreground font-semibold">미설정</span>
                      ) : isPersistedMatch ? (
                        <span className="text-[11px] text-emerald-400 font-bold">저장됨</span>
                      ) : (
                        <span className="text-[11px] text-amber-400 font-bold">산출 대기</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FactoryGpsCalibrationPanel;
