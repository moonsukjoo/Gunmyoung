import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { 
  FactoryJig, 
  FactoryGpsRecord, 
  WorkerDwellSummary, 
  TRACKING_TIME_SLOTS, 
  TrackingSlotTime,
  BlockDelayLog,
  DelayReasonCategory,
  DELAY_REASON_CATEGORIES,
  FactoryBoundaryCalibration
} from '../types';
import { 
  fetchFactoryJigs, 
  updateFactoryJig,
  fetchGpsRecordsByDate, 
  fetchDwellSummariesByDate, 
  seedRealisticTrackingData, 
  formatMinutesToKorean,
  DEFAULT_FACTORY_JIGS,
  identifyLocationFromCoords,
  computeAllBlockStats,
  fetchDelayLogs,
  addDelayLog,
  resolveDelayLog,
  computeZoneDwellHeatmap,
  TWO_HOUR_WINDOWS,
  getWindowForSlot,
  fetchFactoryCalibration,
  computeCalibrationBasis,
  gpsToBlueprint
} from '../services/factoryTrackingService';
import { FactoryBlueprintMap } from '../components/FactoryBlueprintMap';
import { FactoryGpsCalibrationPanel } from '../components/FactoryGpsCalibrationPanel';
import { 
  Layers, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Search, 
  MapPin, 
  Compass, 
  RefreshCw,
  HardHat,
  ChevronLeft,
  ArrowRight,
  Send,
  Monitor,
  Edit3,
  X,
  CalendarDays,
  BarChart3,
  Lock,
  Plus,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const FactoryDwellMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isCEO = profile?.role === 'CEO' || profile?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState<TrackingSlotTime>('08:20');
  const [jigs, setJigs] = useState<FactoryJig[]>(DEFAULT_FACTORY_JIGS);
  const [records, setRecords] = useState<FactoryGpsRecord[]>([]);
  const [dwellSummaries, setDwellSummaries] = useState<WorkerDwellSummary[]>([]);
  const [delayLogs, setDelayLogs] = useState<BlockDelayLog[]>([]);
  const [calibration, setCalibration] = useState<FactoryBoundaryCalibration | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [selectedWorkerUid, setSelectedWorkerUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'MAP' | 'LIST' | 'DELAYS' | 'JIGS' | 'GPS'>('MAP');

  // Edit JIG block state
  const [editingJig, setEditingJig] = useState<FactoryJig | null>(null);
  const [editBlockName, setEditBlockName] = useState('');
  const [editAssignedTeam, setEditAssignedTeam] = useState('');
  const [editStartDate, setEditStartDate] = useState('2026-11-03');
  const [editEndDate, setEditEndDate] = useState('2026-11-12');
  const [editProgress, setEditProgress] = useState(65);

  // Critical Delay Reason logging state
  const [delayTargetJigId, setDelayTargetJigId] = useState<string>('jig-01');
  const [delayCategory, setDelayCategory] = useState<DelayReasonCategory>('SUBCONTRACTOR_DELAY');
  const [delaySeverity, setDelaySeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO'>('CRITICAL');
  const [delayReasonInput, setDelayReasonInput] = useState('');
  const [delayActionInput, setDelayActionInput] = useState('');
  const [isSavingDelay, setIsSavingDelay] = useState(false);

  const calculatedTargetDays = useMemo(() => {
    if (!editStartDate || !editEndDate) return 10;
    const start = new Date(editStartDate);
    const end = new Date(editEndDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  }, [editStartDate, editEndDate]);

  const blockStats = useMemo(() => {
    return computeAllBlockStats(jigs, records);
  }, [jigs, records]);

  const activeTwoHourWindow = useMemo(() => getWindowForSlot(selectedSlot), [selectedSlot]);
  const twoHourHeatmap = useMemo(
    () => computeZoneDwellHeatmap(jigs, records, '2H_WINDOW', selectedSlot, activeTwoHourWindow.id),
    [jigs, records, selectedSlot, activeTwoHourWindow.id]
  );

  useEffect(() => {
    if (isCEO) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [selectedDate, isCEO]);

  const loadData = async () => {
    if (!isCEO) return;
    setLoading(true);
    try {
      const [fetchedJigs, fetchedRecords, fetchedSummaries, fetchedDelayLogs, fetchedCalibration] = await Promise.all([
        fetchFactoryJigs(),
        fetchGpsRecordsByDate(selectedDate),
        fetchDwellSummariesByDate(selectedDate),
        fetchDelayLogs(),
        fetchFactoryCalibration()
      ]);

      setJigs(fetchedJigs.length > 0 ? fetchedJigs : DEFAULT_FACTORY_JIGS);
      setRecords(fetchedRecords);
      setDwellSummaries(fetchedSummaries);
      setDelayLogs(fetchedDelayLogs);
      setCalibration(fetchedCalibration);
    } catch (err) {
      console.error(err);
      toast.error('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Instant mobile seeding
  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      toast.loading('물량팀 12명에 대한 8개 타임슬롯 GPS 체류 기록을 생성 중...', { id: 'seed-task' });
      const res = await seedRealisticTrackingData(selectedDate);
      toast.dismiss('seed-task');
      toast.success(`총 ${res.workersCount}명의 작업자, ${res.recordsCount}건의 시간대별 위치 및 블럭 체류 기록이 생성되었습니다!`);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.dismiss('seed-task');
      toast.error('데이터 생성에 실패했습니다.');
    } finally {
      setIsSeeding(false);
    }
  };

  // Check-in current user GPS
  const handleCheckInNow = async () => {
    if (!profile) return;
    toast.loading('현재 GPS 위치를 측정 중입니다...', { id: 'gps-check' });

    if (!navigator.geolocation) {
      toast.dismiss('gps-check');
      toast.error('단말기가 위치 정보를 지원하지 않습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const assignedJig = jigs[0];
          const basis = calibration ? computeCalibrationBasis(calibration) : null;
          const projected = basis
            ? gpsToBlueprint(pos.coords.latitude, pos.coords.longitude, basis)
            : null;

          const mapX = projected ? projected.mapX : assignedJig.x + 30 + Math.random() * 80;
          const mapY = projected ? projected.mapY : assignedJig.y + 30 + Math.random() * 80;
          const locInfo = identifyLocationFromCoords(mapX, mapY, assignedJig.id, jigs);

          const slotIndex = TRACKING_TIME_SLOTS.indexOf(selectedSlot);
          const recordId = `${profile.uid}_${selectedDate}_${slotIndex >= 0 ? slotIndex : 0}`;

          const record: FactoryGpsRecord = {
            id: recordId,
            date: selectedDate,
            slot: selectedSlot,
            slotIndex: slotIndex >= 0 ? slotIndex : 0,
            workerUid: profile.uid,
            workerName: profile.displayName || '현장작업자',
            employeeId: profile.employeeId || 'EMP',
            teamName: profile.departmentName || '외주물량1팀',
            jobRole: profile.jobRole || '취부사',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            mapX: Math.round(mapX),
            mapY: Math.round(mapY),
            locationType: locInfo.locationType,
            jigId: locInfo.jigId,
            jigName: locInfo.jigName,
            blockName: locInfo.blockName,
            locationLabel: locInfo.locationLabel,
            isAtAssignedJig: locInfo.isAtAssignedJig,
            status: locInfo.status,
            stayMinutesInSlot: 60,
            recordedAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'factoryGpsRecords', record.id), record, { merge: true });
          toast.dismiss('gps-check');
          toast.success(`[${selectedSlot}] ${locInfo.locationLabel} 위치 체크인이 기록되었습니다!`);
          await loadData();
        } catch (e) {
          toast.dismiss('gps-check');
          toast.error('위치 저장에 실패했습니다.');
        }
      },
      (err) => {
        toast.dismiss('gps-check');
        toast.error(`GPS 수신 오류: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openJigEditModal = (jig: FactoryJig) => {
    setEditingJig(jig);
    setEditBlockName(jig.blockName);
    setEditAssignedTeam(jig.assignedTeam);
    setEditStartDate(jig.startDate || '2026-11-03');
    setEditEndDate(jig.endDate || '2026-11-12');
    setEditProgress(jig.currentProgress ?? jig.progressPercent ?? 65);
    setDelayTargetJigId(jig.id);
    setDelayReasonInput('');
    setDelayActionInput('');
  };

  const handleSaveJig = async () => {
    if (!editingJig) return;
    try {
      await updateFactoryJig(editingJig.id, {
        blockName: editBlockName.trim(),
        assignedTeam: editAssignedTeam.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        targetDays: calculatedTargetDays,
        currentProgress: editProgress,
        progressPercent: editProgress
      });
      toast.success(`${editingJig.jigName}의 블럭 정보 및 공정 일정이 수정되었습니다.`);
      setEditingJig(null);
      await loadData();
    } catch (err) {
      toast.error('블럭 정보 수정 실패');
    }
  };

  const handleAppendDelayLog = async (targetJig?: FactoryJig) => {
    if (!profile) return;
    const jig = targetJig || jigs.find(j => j.id === delayTargetJigId) || jigs[0];
    if (!jig) return;
    if (!delayReasonInput.trim()) {
      toast.error('공정 지연의 크리티컬 사유를 입력해주세요.');
      return;
    }

    const stat = blockStats.find(s => s.jigId === jig.id);
    const delayDays = stat && stat.remainingDays < 0 ? Math.abs(stat.remainingDays) : 0;
    const existingCount = delayLogs.filter(l => l.jigId === jig.id).length;

    setIsSavingDelay(true);
    try {
      await addDelayLog(
        {
          jigId: jig.id,
          jigName: jig.jigName,
          blockName: jig.blockName,
          category: delayCategory,
          severity: delaySeverity,
          reason: delayReasonInput.trim(),
          actionPlan: delayActionInput.trim() || undefined,
          delayDays,
          progressAtTime: jig.currentProgress ?? jig.progressPercent ?? 0,
          recordedByUid: profile.uid,
          recordedByName: profile.displayName || '대표이사'
        },
        existingCount
      );
      toast.success(`[${jig.blockName}] 크리티컬 지연 사유가 누적 이력에 기록되었습니다.`);
      setDelayReasonInput('');
      setDelayActionInput('');
      await loadData();
    } catch (err) {
      toast.error('지연 사유 기록 저장 실패');
    } finally {
      setIsSavingDelay(false);
    }
  };

  const handleResolveDelay = async (logId: string) => {
    try {
      await resolveDelayLog(logId, `${profile?.displayName || '대표'} 조치 완료 확인`);
      toast.success('해결 완료로 표시되었습니다. (이력은 계속 보존됩니다)');
      await loadData();
    } catch (err) {
      toast.error('상태 변경 실패');
    }
  };

  const filteredSummaries = useMemo(() => {
    return dwellSummaries.filter(s => 
      !searchQuery.trim() ||
      s.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.assignedBlockName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dwellSummaries, searchQuery]);

  if (!isCEO) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">대표 전용 비공개 관제</h2>
          <p className="text-xs text-muted-foreground font-bold leading-relaxed">
            중형선 7공장 블럭 체류 관제 및 공정 지연 사유 기록은 대표이사 전용 관리 메뉴입니다.
          </p>
          <Button onClick={() => navigate('/')} className="w-full rounded-xl font-black">
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 p-3 sm:p-6 space-y-4 sm:space-y-5">
      {/* Top Bar with PC Sync Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                모바일 현장 관제
              </span>
              <span className="text-xs text-muted-foreground font-mono font-bold">{selectedDate}</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-foreground">
              중형선 7공장 블럭 체류 관제
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* PC Admin Switcher Button */}
          <button
            onClick={() => navigate('/admin/pc/factory-dwell')}
            className="px-3 py-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm whitespace-nowrap shrink-0"
          >
            <Monitor className="w-3.5 h-3.5 text-blue-500" />
            PC 전용 관제 열기
          </button>

          {/* Seed Simulation Button */}
          <Button
            onClick={handleSeedData}
            disabled={isSeeding}
            size="sm"
            variant="outline"
            className="text-xs font-bold gap-1 rounded-xl border-border whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            모의 데이터 생성
          </Button>

          {/* GPS Checkin */}
          <Button
            onClick={handleCheckInNow}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl gap-1 shadow-sm whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            현 위치 체크인
          </Button>
        </div>
      </div>

      {/* Date & Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-card p-1.5 px-3 rounded-2xl border border-border w-fit">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-xs font-black text-foreground outline-none cursor-pointer"
          />
        </div>

        {/* View Tabs (5-tab mobile responsive bar) */}
        <div className="grid grid-cols-5 gap-1 bg-muted/40 p-1 rounded-2xl border border-border">
          <button
            onClick={() => setActiveTab('MAP')}
            className={`px-1.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate ${
              activeTab === 'MAP' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            내부도
          </button>
          <button
            onClick={() => setActiveTab('LIST')}
            className={`px-1.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate font-mono tabular-nums ${
              activeTab === 'LIST' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            체류({dwellSummaries.length})
          </button>
          <button
            onClick={() => setActiveTab('DELAYS')}
            className={`px-1.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate font-mono tabular-nums ${
              activeTab === 'DELAYS' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            지연({delayLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('JIGS')}
            className={`px-1.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate font-mono tabular-nums ${
              activeTab === 'JIGS' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            지그({jigs.length})
          </button>
          <button
            onClick={() => setActiveTab('GPS')}
            className={`px-1.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate ${
              activeTab === 'GPS' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-cyan-400 hover:text-cyan-300'
            }`}
          >
            GPS기준
          </button>
        </div>
      </div>

      {/* 2-Hour Window Quick Summary & 8-Slot Navigator */}
      <div className="space-y-2">
        <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-black text-orange-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {activeTwoHourWindow.label} 집중 현황
            </span>
            <span className="font-mono tabular-nums text-[11px] font-bold text-muted-foreground">
              {twoHourHeatmap.totalUniqueWorkers}명 · {formatMinutesToKorean(twoHourHeatmap.totalDwellMinutes)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {TWO_HOUR_WINDOWS.map(w => {
              const isAct = w.id === activeTwoHourWindow.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedSlot(w.slots[0])}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-mono tabular-nums font-black border transition-colors cursor-pointer whitespace-nowrap ${
                    isAct
                      ? 'bg-orange-500 text-slate-950 border-orange-400'
                      : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {w.shortLabel}
                </button>
              );
            })}
          </div>
          {twoHourHeatmap.topZone && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] pt-1 border-t border-border/60">
              <span className="text-muted-foreground font-bold">
                최다 집중: <strong className="text-foreground">{twoHourHeatmap.topZone.zoneName} ({twoHourHeatmap.topZone.subLabel})</strong>
              </span>
              <span className="font-mono tabular-nums font-black text-rose-400">
                {formatMinutesToKorean(twoHourHeatmap.topZone.totalMinutes)} ({twoHourHeatmap.topZone.workerCount}명 · {twoHourHeatmap.topZone.sharePercent}%)
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-500" /> 세부 8회 체크포인트 선택
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {TRACKING_TIME_SLOTS.map(slot => {
            const count = records.filter(r => r.slot === slot).length;
            const away = records.filter(r => r.slot === slot && r.status === 'AWAY').length;

            return (
              <button
                key={slot}
                onClick={() => setSelectedSlot(slot)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black font-mono tabular-nums shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedSlot === slot
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                <span>{slot}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${selectedSlot === slot ? 'bg-white/20' : 'bg-muted text-muted-foreground'}`}>
                  {count}명
                </span>
                {away > 0 && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500 text-white font-extrabold">
                    {away}탈
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Map View (Responsive mobile card grid + toggleable A3 CAD blueprint) */}
      {activeTab === 'MAP' && (
        <div className="space-y-3">
          <FactoryBlueprintMap
            jigs={jigs}
            records={records}
            delayLogs={delayLogs}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            selectedWorkerUid={selectedWorkerUid}
            onSelectWorker={setSelectedWorkerUid}
            onSelectJig={(jig) => openJigEditModal(jig)}
            selectedJigId={editingJig?.id}
          />
          <p className="text-[11px] text-muted-foreground text-center font-bold px-2">
            블럭 카드를 누르면 캘린더 일정 수정 및 크리티컬 지연 사유를 연속 기록할 수 있습니다. (대표이사 전용 비공개)
          </p>
        </div>
      )}

      {/* TAB 2: Worker Stay Duration List ("누가 어디블록에 몇시간 몇분 체류") */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="작업자명 / 사번 / 블럭명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground outline-none"
            />
          </div>

          <div className="space-y-3">
            {filteredSummaries.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground font-bold bg-card rounded-2xl border border-border">
                {loading ? '체류 기록을 불러오는 중...' : '기록이 없습니다. 상단 [모의 데이터 생성]을 눌러보세요.'}
              </div>
            ) : (
              filteredSummaries.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedWorkerUid(selectedWorkerUid === s.workerUid ? null : s.workerUid)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    selectedWorkerUid === s.workerUid
                      ? 'bg-blue-500/10 border-blue-500'
                      : 'bg-card border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-foreground text-sm">{s.workerName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">({s.employeeId})</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.teamName} • {s.jobRole}</p>
                    </div>

                    <span className={`text-xs px-2.5 py-1 rounded-full font-black font-mono tabular-nums ${
                      s.complianceRate >= 80 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {s.complianceRate}% 준수
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="bg-muted/40 p-2 rounded-xl">
                      <span className="text-muted-foreground block text-[10px]">배정 블럭</span>
                      <strong className="text-blue-400">{s.assignedBlockName}</strong>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-xl">
                      <span className="text-muted-foreground block text-[10px]">블럭 체류 시간</span>
                      <strong className="text-emerald-400 font-mono tabular-nums">{formatMinutesToKorean(s.workBlockDwellMinutes)}</strong>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-xl">
                      <span className="text-muted-foreground block text-[10px]">자리비움</span>
                      <strong className={`font-mono tabular-nums ${s.awayMinutes > 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>
                        {formatMinutesToKorean(s.awayMinutes)}
                      </strong>
                    </div>
                  </div>

                  {/* 8 Checkpoints mini ribbon */}
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground font-bold">8개 슬롯 위치:</span>
                    <div className="flex gap-1">
                      {s.slotRecords.map((r, i) => (
                        <span
                          key={r.slot}
                          title={`${r.slot}: ${r.locationLabel}`}
                          className={`w-5 h-5 rounded flex items-center justify-center font-black font-mono tabular-nums text-[9px] ${
                            r.status === 'NORMAL'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : r.status === 'RESTING'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {i + 1}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Cumulative Critical Delay Reason Logbook (CEO-only) */}
      {activeTab === 'DELAYS' && (
        <div className="space-y-4">
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs">
            <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-rose-400 font-black block">대표이사 전용 공정 지연 크리티컬 사유 누적 기록지</strong>
              <span className="text-muted-foreground font-bold text-[11px]">
                작업자에게는 절대 노출되지 않으며, 블럭별 지연 원인이 지워지지 않고 시간순으로 계속 누적 관리됩니다.
              </span>
            </div>
          </div>

          {/* New Delay Log Form */}
          <div className="bg-card border border-border rounded-3xl p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-rose-500" />
              새 지연 크리티컬 사유 추가 기록
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={delayTargetJigId}
                onChange={(e) => setDelayTargetJigId(e.target.value)}
                className="px-3 py-2 bg-muted border border-border rounded-xl font-black text-foreground outline-none"
              >
                {jigs.map(j => (
                  <option key={j.id} value={j.id}>{j.jigName} · {j.blockName}</option>
                ))}
              </select>

              <select
                value={delayCategory}
                onChange={(e) => setDelayCategory(e.target.value as DelayReasonCategory)}
                className="px-3 py-2 bg-muted border border-border rounded-xl font-bold text-foreground outline-none"
              >
                {(Object.entries(DELAY_REASON_CATEGORIES) as [DelayReasonCategory, string][]).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-1.5 text-[11px]">
              {(['CRITICAL', 'WARNING', 'INFO'] as const).map(sev => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setDelaySeverity(sev)}
                  className={`flex-1 py-1.5 rounded-xl font-black border transition-all cursor-pointer ${
                    delaySeverity === sev
                      ? sev === 'CRITICAL'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : sev === 'WARNING'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-blue-600 text-white border-blue-500'
                      : 'bg-muted/40 text-muted-foreground border-border'
                  }`}
                >
                  {sev === 'CRITICAL' ? '🚨 크리티컬 지연' : sev === 'WARNING' ? '⚠️ 공정 주의' : '📝 특이 메모'}
                </button>
              ))}
            </div>

            <textarea
              value={delayReasonInput}
              onChange={(e) => setDelayReasonInput(e.target.value)}
              rows={2}
              placeholder="예: 물량1팀 핵심 취부사 2명 오전 무단 이탈 및 용접 자재 수급 지연으로 공정 1.5일 지연..."
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 resize-none"
            />

            <input
              type="text"
              value={delayActionInput}
              onChange={(e) => setDelayActionInput(e.target.value)}
              placeholder="후속 조치/만회 대책 (예: 직영 인원 2명 긴급 재배치 및 야간 잔업 투입)"
              className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-blue-500"
            />

            <Button
              onClick={() => handleAppendDelayLog()}
              disabled={isSavingDelay || !delayReasonInput.trim()}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl h-10"
            >
              {isSavingDelay ? '기록 저장 중...' : '🚨 크리티컬 지연 사유 누적 저장'}
            </Button>
          </div>

          {/* Continuous Cumulative Timeline */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-muted-foreground flex items-center gap-1.5 px-1">
              <History className="w-3.5 h-3.5 text-rose-400" />
              누적 기록 히스토리 ({delayLogs.length}건 · 최신순 계속 이어짐)
            </h4>

            {delayLogs.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold text-muted-foreground bg-card border border-border rounded-2xl">
                아직 기록된 공정 지연 사유가 없습니다.
              </div>
            ) : (
              delayLogs.map(log => (
                <div
                  key={log.id}
                  className={`p-4 rounded-2xl border space-y-2 ${
                    log.resolved
                      ? 'bg-card/60 border-border/70 opacity-80'
                      : log.severity === 'CRITICAL'
                      ? 'bg-rose-500/10 border-rose-500/40'
                      : log.severity === 'WARNING'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-700">
                        {log.jigName} · {log.blockName}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        log.severity === 'CRITICAL' ? 'bg-rose-500 text-white' : log.severity === 'WARNING' ? 'bg-amber-500 text-slate-950' : 'bg-blue-500 text-white'
                      }`}>
                        {DELAY_REASON_CATEGORIES[log.category] || log.category}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {log.recordedAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>

                  <p className="text-xs font-black text-foreground leading-relaxed">{log.reason}</p>
                  {log.actionPlan && (
                    <p className="text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1.5 rounded-xl border border-cyan-500/20">
                      📌 만회 대책: {log.actionPlan}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span>진척 {log.progressAtTime}% {log.delayDays > 0 ? `• +${log.delayDays}일 지연` : ''} • {log.recordedByName}</span>
                    {log.resolved ? (
                      <span className="text-emerald-400 font-black">✅ {log.resolvedNote || '조치 완료'}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResolveDelay(log.id)}
                        className="text-emerald-400 hover:underline font-black cursor-pointer"
                      >
                        조치 완료 처리 →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: JIG & Block Editor with Deployment Stats */}
      {activeTab === 'JIGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                지그 블럭별 소요기간(캘린더) 및 누적 투입 인원/공수 통계
              </h3>
              <p className="text-xs text-muted-foreground">지그 카드를 클릭하면 공정 시작일, 종료일, 블럭명, 크리티컬 지연 사유를 관리할 수 있습니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {jigs.map(jig => {
              const stat = blockStats.find(s => s.jigId === jig.id);
              const jigDelays = delayLogs.filter(l => l.jigId === jig.id);

              return (
                <div
                  key={jig.id}
                  onClick={() => openJigEditModal(jig)}
                  className="bg-card border border-border p-4 rounded-2xl hover:border-blue-500/50 transition-all cursor-pointer space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {jig.jigName}
                      </span>
                      <strong className="text-base font-black text-foreground">{jig.blockName}</strong>
                      <span className="text-xs text-muted-foreground">({jig.blockType})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        stat?.statusVerdict === 'BEHIND_SCHEDULE'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : stat?.statusVerdict === 'CRITICAL_DELAY'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {stat?.statusVerdict === 'BEHIND_SCHEDULE' ? '⚠️ 공정 지연' : stat?.statusVerdict === 'CRITICAL_DELAY' ? '🚨 심각한 지연' : '✅ 정상 진행'}
                      </span>
                      <Edit3 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Latest Critical Delay Banner if present */}
                  {(jigDelays.length > 0 || jig.latestDelayReason) && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-xs flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-rose-400 block">
                          🚨 누적 크리티컬 지연 사유 ({jigDelays.length || jig.delayLogCount || 1}건)
                        </span>
                        <p className="text-xs font-bold text-foreground truncate">
                          {jigDelays[0]?.reason || jig.latestDelayReason}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Calendar Dates & Target Days */}
                  <div className="flex flex-wrap items-center justify-between text-xs bg-muted/30 p-2.5 rounded-xl border border-border/50 gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                      <span>{jig.startDate || '2026-11-03'} ~ {jig.endDate || '2026-11-12'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-blue-400">계획: {jig.targetDays || 10}일 소요</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400">
                        {stat?.remainingDays !== undefined && stat.remainingDays < 0
                          ? `D+${Math.abs(stat.remainingDays)}일 초과`
                          : `D-${stat?.remainingDays ?? 0}일 잔여`}
                      </span>
                    </div>
                  </div>

                  {/* Deployed Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-blue-500/5 border border-blue-500/10 p-2 rounded-xl">
                      <span className="text-[10px] text-muted-foreground block font-bold">누적 투입 인원</span>
                      <strong className="text-blue-400 font-black text-sm">{stat?.totalWorkersDeployed ?? 0}명</strong>
                    </div>
                    <div className="bg-purple-500/5 border border-purple-500/10 p-2 rounded-xl">
                      <span className="text-[10px] text-muted-foreground block font-bold">일평균 투입</span>
                      <strong className="text-purple-400 font-black text-sm">{stat?.avgDailyWorkers ?? 0}명/일</strong>
                    </div>
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-xl">
                      <span className="text-[10px] text-muted-foreground block font-bold">총 체류 공수</span>
                      <strong className="text-emerald-400 font-black text-sm">{stat?.totalManHours ?? 0}시간</strong>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-muted-foreground">담당 물량팀: {jig.assignedTeam}</span>
                      <span className="text-cyan-400">진척률 {jig.currentProgress ?? jig.progressPercent ?? 65}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${jig.currentProgress ?? jig.progressPercent ?? 65}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: Cardinal (E/W/S/N) Field GPS Calibration & Auto Block GPS */}
      {activeTab === 'GPS' && (
        <FactoryGpsCalibrationPanel
          jigs={jigs}
          calibration={calibration}
          userUid={profile?.uid}
          userName={profile?.displayName}
          onCalibrationSaved={(savedCal, updatedJigs) => {
            setCalibration(savedCal);
            setJigs(updatedJigs);
          }}
          onSelectJig={(jig) => openJigEditModal(jig)}
        />
      )}

      {/* JIG Edit Modal with Calendar Date Picker & Cumulative Critical Delay Log */}
      {editingJig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase">{editingJig.jigName}</span>
                <h3 className="font-black text-foreground text-sm">블럭 설정 · 캘린더 · 지연 사유 기록</h3>
              </div>
              <button onClick={() => setEditingJig(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">블럭 코드 (도면 표기)</label>
                <input
                  type="text"
                  value={editBlockName}
                  onChange={(e) => setEditBlockName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm font-black text-foreground mt-1 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">담당 물량팀</label>
                <input
                  type="text"
                  value={editAssignedTeam}
                  onChange={(e) => setEditAssignedTeam(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground mt-1 outline-none focus:border-blue-500"
                />
              </div>

              {/* Calendar Start and End Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                    <CalendarDays className="w-3 h-3 text-blue-400" /> 공정 시작일
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-muted border border-border rounded-xl text-xs font-black text-foreground mt-1 outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                    <CalendarDays className="w-3 h-3 text-purple-400" /> 공정 종료일
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-muted border border-border rounded-xl text-xs font-black text-foreground mt-1 outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded-xl text-center text-xs">
                <span className="text-muted-foreground font-bold">계획 소요 기간: </span>
                <strong className="text-blue-400 font-black">{calculatedTargetDays}일 소요 공정</strong>
              </div>

              <div>
                <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground uppercase">
                  <span>공정 진척률 (%)</span>
                  <span className="text-cyan-400 text-xs">{editProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editProgress}
                  onChange={(e) => setEditProgress(Number(e.target.value))}
                  className="w-full mt-1.5 accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingJig(null)} className="flex-1 rounded-xl text-xs">
                  닫기
                </Button>
                <Button onClick={handleSaveJig} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black">
                  블럭 일정 저장
                </Button>
              </div>
            </div>

            {/* Inline Cumulative Critical Delay Logger inside JIG modal */}
            <div className="pt-3 border-t border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-rose-400 flex items-center gap-1">
                  🚨 크리티컬 공정 지연 사유 추가 (연속 누적)
                </span>
                <span className="text-[10px] font-bold text-muted-foreground">대표 전용</span>
              </div>

              <select
                value={delayCategory}
                onChange={(e) => setDelayCategory(e.target.value as DelayReasonCategory)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none"
              >
                {(Object.entries(DELAY_REASON_CATEGORIES) as [DelayReasonCategory, string][]).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>

              <textarea
                value={delayReasonInput}
                onChange={(e) => setDelayReasonInput(e.target.value)}
                rows={2}
                placeholder="지연 사유 입력 (예: 용접 인원 이탈, 도면 수정 대기 등)"
                className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 resize-none"
              />

              <input
                type="text"
                value={delayActionInput}
                onChange={(e) => setDelayActionInput(e.target.value)}
                placeholder="후속 만회 조치사항 (선택)"
                className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none"
              />

              <Button
                onClick={() => handleAppendDelayLog(editingJig)}
                disabled={isSavingDelay || !delayReasonInput.trim()}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black h-9"
              >
                {isSavingDelay ? '기록 중...' : '+ 이 블럭에 지연 사유 연속 추가'}
              </Button>

              {/* Chronological Delay History for this JIG */}
              {delayLogs.filter(l => l.jigId === editingJig.id).length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                  <p className="text-[10px] font-black text-muted-foreground">이 블럭의 이전 누적 사유:</p>
                  {delayLogs.filter(l => l.jigId === editingJig.id).map(log => (
                    <div key={log.id} className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-[9.5px] text-rose-300 font-bold">
                        <span>{DELAY_REASON_CATEGORIES[log.category]}</span>
                        <span className="font-mono">{log.recordedAt.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="font-bold text-foreground">{log.reason}</p>
                      {log.actionPlan && <p className="text-[10px] text-cyan-400">대책: {log.actionPlan}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryDwellMonitoring;
