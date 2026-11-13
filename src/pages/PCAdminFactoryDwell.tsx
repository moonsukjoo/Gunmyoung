import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
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
  getHeatmapColors,
  fetchFactoryCalibration,
  reconcileJigsWithCalibration
} from '../services/factoryTrackingService';
import PCAdminLayout from '../components/PCAdminLayout';
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
  Printer, 
  Sparkles,
  Smartphone, 
  Search, 
  Filter, 
  Settings, 
  Edit3, 
  X, 
  Download, 
  MapPin, 
  Compass, 
  RefreshCw,
  HardHat,
  ArrowRight,
  TrendingDown,
  Building,
  CalendarDays,
  BarChart3,
  Lock,
  Plus,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { downloadFile } from '@/lib/downloadHelper';

export const PCAdminFactoryDwell: React.FC = () => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [delayFilterJigId, setDelayFilterJigId] = useState<string>('ALL');
  
  // Selection states
  const [selectedWorkerUid, setSelectedWorkerUid] = useState<string | null>(null);
  const [selectedJig, setSelectedJig] = useState<FactoryJig | null>(null);
  
  // Edit Jig modal
  const [editingJig, setEditingJig] = useState<FactoryJig | null>(null);
  const [editBlockName, setEditBlockName] = useState('');
  const [editBlockType, setEditBlockType] = useState('');
  const [editAssignedTeam, setEditAssignedTeam] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editProgress, setEditProgress] = useState(0);

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
    const diff = Math.max(0, Math.abs(end.getTime() - start.getTime()));
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [editStartDate, editEndDate]);

  const blockStatsList = useMemo(() => {
    return computeAllBlockStats(jigs, records);
  }, [jigs, records]);

  // 2-hour interval concentration summaries across all 4 windows
  const activeTwoHourWindow = useMemo(() => getWindowForSlot(selectedSlot), [selectedSlot]);

  const twoHourWindowMetrics = useMemo(() => {
    return TWO_HOUR_WINDOWS.map(w => ({
      window: w,
      heatmap: computeZoneDwellHeatmap(jigs, records, '2H_WINDOW', w.slots[0], w.id)
    }));
  }, [jigs, records]);

  const activeWindowHeatmap = useMemo(() => {
    return computeZoneDwellHeatmap(jigs, records, '2H_WINDOW', selectedSlot, activeTwoHourWindow.id);
  }, [jigs, records, selectedSlot, activeTwoHourWindow.id]);

  const printRef = useRef<HTMLDivElement>(null);

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

      const baseJigs = fetchedJigs.length > 0 ? fetchedJigs : DEFAULT_FACTORY_JIGS;
      setJigs(reconcileJigsWithCalibration(baseJigs, fetchedCalibration));
      setRecords(fetchedRecords);
      setDwellSummaries(fetchedSummaries);
      setDelayLogs(fetchedDelayLogs);
      setCalibration(fetchedCalibration);

      // If no records for selected date, suggest auto-seeding
      if (fetchedRecords.length === 0) {
        toast.info(`${selectedDate} 일자의 기록이 없습니다. 상단의 [모의 데이터 생성]을 누르면 현장 기록을 즉시 생성하여 확인할 수 있습니다.`);
      }
    } catch (error) {
      console.error('Error loading factory tracking data:', error);
      toast.error('공장 관제 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Seed sample data for testing
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

  // Open edit modal for a JIG
  const handleOpenEditJig = (jig: FactoryJig) => {
    setEditingJig(jig);
    setEditBlockName(jig.blockName || '');
    setEditBlockType(jig.blockType || '');
    setEditAssignedTeam(jig.assignedTeam || '');
    setEditStartDate(jig.startDate || '2026-11-03');
    setEditEndDate(jig.endDate || '2026-11-12');
    setEditProgress(jig.currentProgress ?? jig.progressPercent ?? 0);
    setDelayTargetJigId(jig.id);
    setDelayReasonInput('');
    setDelayActionInput('');
  };

  const handleSaveJig = async () => {
    if (!editingJig) return;
    try {
      await updateFactoryJig(editingJig.id, {
        blockName: editBlockName.trim(),
        blockType: editBlockType.trim(),
        assignedTeam: editAssignedTeam.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        targetDays: calculatedTargetDays,
        currentProgress: Number(editProgress) || 0,
        progressPercent: Number(editProgress) || 0
      });
      toast.success(`${editingJig.jigName}의 블럭 정보 및 시작~완료 캘린더 일정이 갱신되었습니다.`);
      setEditingJig(null);
      await loadData();
    } catch (err) {
      toast.error('지그 정보 수정 중 오류가 발생했습니다.');
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

    const stat = blockStatsList.find(s => s.jigId === jig.id);
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
      toast.success(`[${jig.blockName}] 크리티컬 지연 사유가 누적 이력에 추가 기록되었습니다.`);
      setDelayReasonInput('');
      setDelayActionInput('');
      await loadData();
    } catch (err) {
      toast.error('지연 사유 기록 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingDelay(false);
    }
  };

  const handleResolveDelay = async (logId: string) => {
    try {
      await resolveDelayLog(logId, `${profile?.displayName || '대표이사'} 조치 확인`);
      toast.success('조치 완료로 표시되었습니다. (누적 이력은 계속 보존됩니다)');
      await loadData();
    } catch (err) {
      toast.error('상태 업데이트 실패');
    }
  };

  // PDF Export for A3 Landscape Report
  const handleExportA3PDF = async () => {
    const el = printRef.current;
    if (!el) return;

    try {
      toast.loading('A3 가로 규격 공장 체류 감리 보고서 PDF를 생성 중입니다...', { id: 'export-a3' });
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0a0f1d'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      // A3 dimensions: 420mm x 297mm (Landscape)
      const pdf = new jsPDF('l', 'mm', 'a3');
      const pdfWidth = 420;
      const pdfHeight = 297;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output('blob');
      const fileName = `중형선7공장_블럭체류감리보고서_${selectedDate}.pdf`;

      toast.dismiss('export-a3');
      await downloadFile(pdfBlob, fileName, [imgData]);
      toast.success('A3 보고서가 다운로드되었습니다.');
    } catch (err) {
      console.error(err);
      toast.dismiss('export-a3');
      toast.error('PDF 내보내기 중 오류가 발생했습니다.');
    }
  };

  // Filtered workers list
  const filteredSummaries = useMemo(() => {
    return dwellSummaries.filter(s => {
      const matchSearch = 
        !searchQuery.trim() ||
        s.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.assignedBlockName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchTeam = 
        selectedTeamFilter === 'ALL' || 
        s.teamName.includes(selectedTeamFilter);

      return matchSearch && matchTeam;
    });
  }, [dwellSummaries, searchQuery, selectedTeamFilter]);

  // Overall KPI statistics
  const kpis = useMemo(() => {
    const totalWorkers = dwellSummaries.length;
    if (totalWorkers === 0) {
      return { totalWorkers: 0, avgCompliance: 0, awayCount: 0, activeBlocks: 0 };
    }

    const avgCompliance = Math.round(
      dwellSummaries.reduce((acc, cur) => acc + cur.complianceRate, 0) / totalWorkers
    );
    const awayCount = dwellSummaries.filter(s => s.verdict === 'WARNING' || s.verdict === 'CRITICAL_AWAY').length;
    const activeBlocks = new Set(dwellSummaries.map(s => s.assignedBlockName)).size;

    return { totalWorkers, avgCompliance, awayCount, activeBlocks };
  }, [dwellSummaries]);

  // Unique teams list
  const uniqueTeams = useMemo(() => {
    const set = new Set<string>();
    dwellSummaries.forEach(s => {
      if (s.teamName) set.add(s.teamName);
    });
    return Array.from(set);
  }, [dwellSummaries]);

  const filteredDelayLogs = useMemo(() => {
    return delayLogs.filter(l => delayFilterJigId === 'ALL' || l.jigId === delayFilterJigId);
  }, [delayLogs, delayFilterJigId]);

  if (!isCEO) {
    return (
      <PCAdminLayout title="접근 권한 제한">
        <div className="max-w-md mx-auto mt-20 bg-card border border-border rounded-[2rem] p-10 text-center space-y-4 shadow-xl">
          <Lock className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-black">대표이사 전용 비공개 관제</h2>
          <p className="text-xs text-muted-foreground font-bold leading-relaxed">
            중형선 7공장 공장내부도 체류 관제 및 공정 지연 크리티컬 사유 기록은 대표이사만 열람·관리할 수 있습니다.
          </p>
          <Button onClick={() => navigate('/admin/pc-dashboard')} className="w-full rounded-xl font-black">
            대시보드로 돌아가기
          </Button>
        </div>
      </PCAdminLayout>
    );
  }

  return (
    <PCAdminLayout title="중형선 7공장 블럭 체류 관제 (A3)">
      <div className="max-w-[1700px] mx-auto space-y-8 text-foreground pb-20">
        
        {/* Top Header Banner */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                A3 가로 규격 관제망
              </span>
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                2시간 주기 정밀 체크포인트 기록
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              중형선 7공장 블럭별 작업자 체류 및 공정 감리
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              물량팀 인력의 <strong>지그 및 블럭 체류 시간</strong>을 8개 주요 슬롯(08:20, 09:45, 10:15, 11:45, 13:10, 14:45, 15:15, 17:45)별로 감지하여 <strong>누가 어디블록에 몇 시간 몇 분 동안 체류했는지</strong> 정밀 기록합니다.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Date Selector */}
            <div className="flex items-center gap-2 bg-muted/60 p-2 px-3 rounded-2xl border border-border">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-black text-foreground outline-none cursor-pointer"
              />
            </div>

            {/* Mobile View Switcher */}
            <Button
              variant="outline"
              onClick={() => navigate('/factory-dwell')}
              className="font-black text-xs h-11 px-4 rounded-2xl gap-2 border-border hover:bg-muted cursor-pointer whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              모바일 현장 관제
            </Button>

            {/* Test Simulation Seed Button */}
            <Button
              onClick={handleSeedData}
              disabled={isSeeding}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-11 px-4 rounded-2xl gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              모의 데이터 생성 (12명 8회)
            </Button>

            {/* A3 Landscape PDF Export */}
            <Button
              variant="outline"
              onClick={handleExportA3PDF}
              className="font-black text-xs h-11 px-4 rounded-2xl gap-2 border-border hover:bg-muted cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              A3 가로 보고서 PDF
            </Button>

            {/* Print Directly */}
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="font-black text-xs h-11 px-4 rounded-2xl gap-2 border-border hover:bg-muted cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              인쇄
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">모니터링 총원</p>
              <p className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-foreground mt-0.5">{kpis.totalWorkers}<span className="text-sm font-bold text-muted-foreground ml-1">명</span></p>
            </div>
          </div>

          <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">블럭 체류 준수율</p>
              <p className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-emerald-400 mt-0.5">{kpis.avgCompliance}%</p>
            </div>
          </div>

          <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">자리비움 / 주의자</p>
              <p className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-rose-500 mt-0.5">{kpis.awayCount}<span className="text-sm font-bold text-muted-foreground ml-1">명</span></p>
            </div>
          </div>

          <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                {activeTwoHourWindow.shortLabel} 최다 집중 구역
              </p>
              {activeWindowHeatmap.topZone ? (
                <p className="text-base sm:text-lg font-black text-foreground mt-0.5 truncate">
                  {activeWindowHeatmap.topZone.zoneName} · {activeWindowHeatmap.topZone.subLabel}
                  <span className="block text-xs font-mono tabular-nums text-orange-400">
                    {formatMinutesToKorean(activeWindowHeatmap.topZone.totalMinutes)} ({activeWindowHeatmap.topZone.workerCount}명)
                  </span>
                </p>
              ) : (
                <p className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-foreground mt-0.5">
                  {kpis.activeBlocks}<span className="text-sm font-bold text-muted-foreground ml-1">개 가동</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2-Hour Interval Workforce Concentration Matrix */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-black tracking-wider text-foreground">
                2시간 단위 시간대별 인력 집중도 &amp; 히트맵 연동
              </span>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">
              시간대 블록 또는 세부 체크포인트를 선택하면 하단 A3 공장도면 히트맵이 즉시 전환됩니다.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {twoHourWindowMetrics.map(({ window: w, heatmap: wh }) => {
              const isWindowActive = activeTwoHourWindow.id === w.id;
              const topColors = wh.topZone ? getHeatmapColors(wh.topZone.level) : null;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedSlot(w.slots[0])}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isWindowActive
                      ? 'bg-orange-500/10 border-orange-500/60 ring-1 ring-orange-500/30'
                      : 'bg-muted/30 border-border hover:bg-muted/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-black font-mono tabular-nums ${isWindowActive ? 'text-orange-400' : 'text-foreground'}`}>
                      {w.label}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums font-bold text-muted-foreground">
                      {wh.totalUniqueWorkers}명 · {formatMinutesToKorean(wh.totalDwellMinutes)}
                    </span>
                  </div>
                  {wh.topZone ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-muted-foreground truncate">
                        최다: <strong className="text-foreground">{wh.topZone.zoneName} ({wh.topZone.subLabel})</strong>
                      </span>
                      <span className={`font-mono tabular-nums font-black shrink-0 ${topColors?.textClass || 'text-orange-400'}`}>
                        {wh.topZone.sharePercent}%
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">기록 대기 중</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-muted-foreground pt-1 border-t border-border/50">
                    <span>체크포인트: {w.slots.join(' / ')}</span>
                    {wh.nonWorkDwellMinutes > 0 && (
                      <span className="text-amber-400 font-bold">비작업 {formatMinutesToKorean(wh.nonWorkDwellMinutes)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Hour Time Slot Navigation Pills */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-[2rem] shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">
                2시간 주기 타임슬롯 선택 (현장 작업 및 휴게 체크포인트)
              </span>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">
              선택한 시간대의 공장 내 작업자 위치가 A3 도면상에 즉시 표시됩니다.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {TRACKING_TIME_SLOTS.map((slot, idx) => {
              const isSelected = selectedSlot === slot;
              const slotWorkers = records.filter(r => r.slot === slot);
              const awayCount = slotWorkers.filter(r => r.status === 'AWAY').length;

              const slotDescriptions: Record<string, string> = {
                '08:20': '1차: 작업 개시 안착',
                '09:45': '2차: 오전 휴게 직전',
                '10:15': '3차: 오전 휴게 후 재착수',
                '11:45': '4차: 점심시간 직전',
                '13:10': '5차: 오후 조업 안착',
                '14:45': '6차: 오후 휴게 직전',
                '15:15': '7차: 오후 휴게 후 재착수',
                '17:45': '8차: 정규 종료 및 잔업'
              };

              return (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/30'
                      : 'bg-muted/40 hover:bg-muted text-foreground border-border hover:border-border/80'
                  }`}
                >
                  <span className="text-base font-black font-mono tracking-tight">{slot}</span>
                  <span className={`text-[10px] font-extrabold mt-0.5 ${isSelected ? 'text-blue-100' : 'text-muted-foreground'}`}>
                    {slotDescriptions[slot].split(':')[1]}
                  </span>
                  <div className="mt-1 flex items-center gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-card text-muted-foreground'}`}>
                      {slotWorkers.length}명 감지
                    </span>
                      {awayCount > 0 && (
                        <span className="text-[9px] font-black px-1 py-0.2 rounded bg-rose-500 text-white">
                          {awayCount}탈
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Printable / Viewable A3 Factory Blueprint Map Area */}
          <div ref={printRef} className="space-y-4">
            <FactoryBlueprintMap
              jigs={jigs}
              records={records}
              delayLogs={delayLogs}
              calibration={calibration}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              selectedWorkerUid={selectedWorkerUid}
              onSelectWorker={setSelectedWorkerUid}
              onSelectJig={(jig) => {
                setSelectedJig(jig);
                handleOpenEditJig(jig);
              }}
              selectedJigId={selectedJig?.id}
            />
          </div>

        {/* Selected Worker History Ribbon (if worker is clicked) */}
        {selectedWorkerUid && (
          <div className="bg-card border border-blue-500/40 p-6 rounded-[2rem] shadow-lg space-y-4 animate-in fade-in duration-200">
            {(() => {
              const summary = dwellSummaries.find(s => s.workerUid === selectedWorkerUid);
              const workerRecords = records.filter(r => r.workerUid === selectedWorkerUid).sort((a,b) => a.slotIndex - b.slotIndex);
              if (!summary) return null;

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl">
                        {summary.workerName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black text-foreground">{summary.workerName} ({summary.employeeId})</h3>
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-muted text-muted-foreground">
                            {summary.teamName} • {summary.jobRole}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          배정 블럭: <strong className="text-blue-500">{summary.assignedBlockName}</strong> | 공정 체류 준수율: <strong className={summary.complianceRate >= 80 ? 'text-emerald-400' : 'text-rose-400'}>{summary.complianceRate}%</strong>
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setSelectedWorkerUid(null)}
                      className="rounded-xl text-xs font-bold self-start sm:self-center"
                    >
                      전체 작업자 보기로 복귀
                    </Button>
                  </div>

                  {/* 8-Slot Timeline History */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {TRACKING_TIME_SLOTS.map((slot, idx) => {
                      const rec = workerRecords.find(r => r.slot === slot);
                      const isNormal = rec?.status === 'NORMAL';
                      const isResting = rec?.status === 'RESTING';

                      return (
                        <div
                          key={slot}
                          className={`p-3 rounded-2xl border flex flex-col justify-between ${
                            !rec 
                              ? 'bg-muted/20 border-border opacity-50' 
                              : isNormal
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : isResting
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-rose-500/10 border-rose-500/30'
                          }`}
                        >
                          <div>
                            <span className="text-[10px] font-black text-muted-foreground block font-mono">{idx + 1}차 • {slot}</span>
                            <p className="text-xs font-black text-foreground mt-1 break-keep">
                              {rec ? rec.locationLabel : '신호 미수신'}
                            </p>
                          </div>
                          <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-bold">
                            <span className={isNormal ? 'text-emerald-400' : isResting ? 'text-amber-400' : 'text-rose-400'}>
                              {isNormal ? '정상 체류' : isResting ? '휴게' : '자리비움'}
                            </span>
                            <span className="text-muted-foreground font-mono">
                              {rec ? `${rec.stayMinutesInSlot}분` : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 📦 블럭별 소요 기간(캘린더 계획) 및 투입 인원/공수 종합 통계 */}
        <div className="bg-card border border-border rounded-[2.5rem] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  공정 일정 캘린더 & 투입 인원 집계
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  총 10개 지그/블럭 공정 현황
                </span>
              </div>
              <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-500" />
                블럭별 계획기간(시작~마감일) 및 투입 인원·공수 통계
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                블럭 설정에서 캘린더 시작일과 종료일을 지정하면 <strong>소요 기간(예: 10일)</strong> 동안 <strong>총 몇 명이 투입되었는지, 일평균 인원과 총 공수</strong>가 자동 산출됩니다.
              </p>
            </div>
          </div>

          {/* Block Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {blockStatsList.map(stat => {
              const jigDelays = delayLogs.filter(l => l.jigId === stat.jigId);
              const latestReason = jigDelays[0]?.reason || jigs.find(j => j.id === stat.jigId)?.latestDelayReason;

              return (
              <div
                key={stat.jigId}
                onClick={() => {
                  const jig = jigs.find(j => j.id === stat.jigId);
                  if (jig) handleOpenEditJig(jig);
                }}
                className="bg-muted/30 border border-border p-5 rounded-3xl space-y-3 hover:border-amber-500/50 hover:bg-card transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div>
                    <span className="text-[10px] font-black text-amber-500 block uppercase">{stat.jigName}</span>
                    <h4 className="text-base font-black text-foreground group-hover:text-amber-500 transition-colors">{stat.blockName}</h4>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    stat.statusVerdict === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : stat.statusVerdict === 'CRITICAL_DELAY'
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                      : stat.statusVerdict === 'BEHIND_SCHEDULE'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {stat.statusVerdict === 'COMPLETED' ? '완료' : stat.statusVerdict === 'CRITICAL_DELAY' ? '지연 경고' : stat.statusVerdict === 'BEHIND_SCHEDULE' ? '주의' : '정상 진행'}
                  </span>
                </div>

                {/* Latest Critical Delay Badge */}
                {(jigDelays.length > 0 || latestReason) && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-2.5 py-1.5 text-[11px] flex items-center gap-1.5 text-rose-400 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{latestReason || `지연 기록 ${jigDelays.length}건`}</span>
                  </div>
                )}

                {/* Schedule & Duration */}
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>공정 시작~마감:</span>
                    <strong className="text-foreground font-mono">{stat.startDate.slice(5)} ~ {stat.endDate.slice(5)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">목표 소요일수:</span>
                    <span className="font-black text-amber-400 font-mono">{stat.targetDays}일 소요 공정</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">D-Day 잔여:</span>
                    <span className={`font-mono font-bold ${stat.remainingDays < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                      {stat.remainingDays < 0 ? `${Math.abs(stat.remainingDays)}일 지연` : stat.remainingDays === 0 ? 'D-Day 오늘마감' : `D-${stat.remainingDays}일 남음`}
                    </span>
                  </div>
                </div>

                {/* Deployed Workers Statistics */}
                <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-card p-2 rounded-xl border border-border">
                    <span className="text-[10px] text-muted-foreground block font-bold">누적 투입 인원</span>
                    <strong className="text-blue-400 text-sm font-black">{stat.totalWorkersDeployed}명</strong>
                  </div>
                  <div className="bg-card p-2 rounded-xl border border-border">
                    <span className="text-[10px] text-muted-foreground block font-bold">일평균 투입</span>
                    <strong className="text-emerald-400 text-sm font-black">{stat.avgDailyWorkers}명/일</strong>
                  </div>
                </div>

                {/* Total Man Hours */}
                <div className="flex items-center justify-between text-[11px] bg-card/60 px-3 py-2 rounded-xl border border-border">
                  <span className="text-muted-foreground font-bold">누적 체류/투입 공수:</span>
                  <span className="font-mono font-black text-foreground">{stat.totalManHours} 시간</span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>공정 진행률</span>
                    <span>{stat.currentProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stat.currentProgress >= 100 ? 'bg-emerald-500' : stat.remainingDays < 0 ? 'bg-rose-500' : 'bg-amber-500'}`}
                      style={{ width: `${stat.currentProgress}%` }}
                    />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* 🧭 7공장 동·서·남·북 GPS 기준점 등록 및 정반 블럭 좌표 자동 산출 */}
        <FactoryGpsCalibrationPanel
          jigs={jigs}
          calibration={calibration}
          userUid={profile?.uid}
          userName={profile?.displayName}
          onCalibrationSaved={(savedCal, updatedJigs) => {
            setCalibration(savedCal);
            setJigs(updatedJigs);
          }}
          onSelectJig={(jig) => handleOpenEditJig(jig)}
        />

        {/* 🚨 공정 지연 크리티컬 사유 연속 누적 기록지 (대표이사 전용 비공개) */}
        <div className="bg-card border border-rose-500/30 rounded-[2.5rem] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> 대표이사 전용 비공개 (작업자 열람 차단)
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  누적 {delayLogs.length}건 기록됨
                </span>
              </div>
              <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-rose-500" />
                공정 지연 크리티컬 사유 연속 누적 기록지
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                공정이 지연될 때마다 크리티컬 원인과 만회 대책을 추가하면 기존 기록 위에 계속 이어져 누적 보존됩니다.
              </p>
            </div>

            <select
              value={delayFilterJigId}
              onChange={(e) => setDelayFilterJigId(e.target.value)}
              className="px-3.5 py-2 bg-muted border border-border rounded-xl text-xs font-black text-foreground outline-none cursor-pointer"
            >
              <option value="ALL">전체 지그/블럭 ({delayLogs.length}건)</option>
              {jigs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.jigName} · {j.blockName} ({delayLogs.filter(l => l.jigId === j.id).length}건)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Append Form */}
            <div className="lg:col-span-5 bg-muted/30 border border-border rounded-3xl p-5 space-y-3.5">
              <h4 className="text-sm font-black text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-rose-500" />
                새 크리티컬 지연 사유 추가 기록
              </h4>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <select
                  value={delayTargetJigId}
                  onChange={(e) => setDelayTargetJigId(e.target.value)}
                  className="px-3 py-2.5 bg-card border border-border rounded-xl font-black text-foreground outline-none"
                >
                  {jigs.map(j => (
                    <option key={j.id} value={j.id}>{j.jigName} · {j.blockName}</option>
                  ))}
                </select>

                <select
                  value={delayCategory}
                  onChange={(e) => setDelayCategory(e.target.value as DelayReasonCategory)}
                  className="px-3 py-2.5 bg-card border border-border rounded-xl font-bold text-foreground outline-none"
                >
                  {(Object.entries(DELAY_REASON_CATEGORIES) as [DelayReasonCategory, string][]).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 text-xs">
                {(['CRITICAL', 'WARNING', 'INFO'] as const).map(sev => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setDelaySeverity(sev)}
                    className={`flex-1 py-2 rounded-xl font-black border transition-all cursor-pointer ${
                      delaySeverity === sev
                        ? sev === 'CRITICAL'
                          ? 'bg-rose-600 text-white border-rose-500'
                          : sev === 'WARNING'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-blue-600 text-white border-blue-500'
                        : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    {sev === 'CRITICAL' ? '🚨 크리티컬 지연' : sev === 'WARNING' ? '⚠️ 공정 주의' : '📝 특이 메모'}
                  </button>
                ))}
              </div>

              <textarea
                value={delayReasonInput}
                onChange={(e) => setDelayReasonInput(e.target.value)}
                rows={3}
                placeholder="왜 공정이 늦어지고 있는지 핵심 크리티컬 사유를 상세히 기록하세요..."
                className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 resize-none"
              />

              <input
                type="text"
                value={delayActionInput}
                onChange={(e) => setDelayActionInput(e.target.value)}
                placeholder="만회 대책 / 후속 지시사항 (선택 입력)"
                className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-blue-500"
              />

              <Button
                onClick={() => handleAppendDelayLog()}
                disabled={isSavingDelay || !delayReasonInput.trim()}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl h-11 shadow-lg shadow-rose-600/20"
              >
                {isSavingDelay ? '누적 저장 중...' : '🚨 크리티컬 지연 사유 누적 저장'}
              </Button>
            </div>

            {/* Right: Cumulative Timeline */}
            <div className="lg:col-span-7 space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredDelayLogs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-bold bg-muted/20 border border-dashed border-border rounded-3xl text-xs">
                  기록된 공정 지연 크리티컬 사유가 아직 없습니다. 좌측 입력란에서 새 사유를 추가해보세요.
                </div>
              ) : (
                filteredDelayLogs.map(log => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-2xl border space-y-2 transition-all ${
                      log.resolved
                        ? 'bg-muted/20 border-border opacity-75'
                        : log.severity === 'CRITICAL'
                        ? 'bg-rose-500/10 border-rose-500/40'
                        : log.severity === 'WARNING'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-muted/30 border-border'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-cyan-300 border border-slate-700">
                          {log.jigName} · {log.blockName}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          log.severity === 'CRITICAL' ? 'bg-rose-500 text-white' : log.severity === 'WARNING' ? 'bg-amber-500 text-slate-950' : 'bg-blue-500 text-white'
                        }`}>
                          {DELAY_REASON_CATEGORIES[log.category] || log.category}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-muted-foreground">
                        {log.recordedAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>

                    <p className="text-sm font-black text-foreground leading-relaxed">{log.reason}</p>
                    {log.actionPlan && (
                      <p className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20">
                        📌 만회 대책: {log.actionPlan}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground">
                      <span>당시 진척률 {log.progressAtTime}% {log.delayDays > 0 ? `• +${log.delayDays}일 지연` : ''} • 기록자: {log.recordedByName}</span>
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
        </div>

        {/* Detailed Dwell Analysis Table ("누가 어디블록에 몇시 몇분동안 체류 했다") */}
        <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  작업자별 체류 시간 상세 분석
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  총 {filteredSummaries.length}명 정산
                </span>
              </div>
              <h3 className="text-xl font-black text-foreground">
                누가 어디 블록에 몇 시간 몇 분 동안 체류했는가 (공정 감리 집계)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                작업자 행을 클릭하면 상단 A3 공장도면에서 8회 체크포인트 <strong>이동 경로(1~8번)</strong>가 실시간 하이라이트됩니다.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Team Selector */}
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none cursor-pointer"
              >
                <option value="ALL">전체 소속팀</option>
                {uniqueTeams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="작업자명 / 사번 / 블럭 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none w-52 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                  <th className="py-4 px-6">작업자 (사번)</th>
                  <th className="py-4 px-4">소속팀 / 직종</th>
                  <th className="py-4 px-4">배정 블럭명</th>
                  <th className="py-4 px-5 text-emerald-400 font-extrabold">배정 블럭 체류 시간</th>
                  <th className="py-4 px-4 text-amber-400 font-extrabold">휴게실 체류</th>
                  <th className="py-4 px-4 text-rose-400 font-extrabold">자리비움 / 이탈</th>
                  <th className="py-4 px-4">체류 준수율</th>
                  <th className="py-4 px-6 text-center">8개 슬롯 위치 전개</th>
                  <th className="py-4 px-4 text-center">성실도 판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground font-bold">
                      {loading ? '체류 기록을 불러오는 중입니다...' : '해당 일자의 체류 기록이 없습니다. 상단 [모의 데이터 생성]을 눌러보세요.'}
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map(s => {
                    const isSelected = selectedWorkerUid === s.workerUid;

                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedWorkerUid(isSelected ? null : s.workerUid)}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        {/* Worker Name & ID */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black">
                              {s.workerName.slice(0, 1)}
                            </div>
                            <div>
                              <p className="font-black text-foreground">{s.workerName}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{s.employeeId}</p>
                            </div>
                          </div>
                        </td>

                        {/* Team & Role */}
                        <td className="py-4 px-4">
                          <p className="font-bold text-foreground">{s.teamName}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">{s.jobRole}</p>
                        </td>

                        {/* Assigned Block */}
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {s.assignedBlockName}
                          </span>
                        </td>

                        {/* Assigned Block Dwell (사용자 핵심 요구: "몇시 몇분동안 체류 했다") */}
                        <td className="py-4 px-5">
                          <div className="font-black text-emerald-400 text-sm font-mono">
                            {formatMinutesToKorean(s.workBlockDwellMinutes)} 체류
                          </div>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            공정 실작업 투입 인정
                          </span>
                        </td>

                        {/* Rest Area Dwell */}
                        <td className="py-4 px-4 font-mono font-bold text-amber-400">
                          {formatMinutesToKorean(s.restAreaMinutes)}
                        </td>

                        {/* Away Dwell */}
                        <td className="py-4 px-4 font-mono font-black text-rose-400">
                          {s.awayMinutes > 0 ? (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                              {formatMinutesToKorean(s.awayMinutes)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">0분 (없음)</span>
                          )}
                        </td>

                        {/* Compliance Rate */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${
                                  s.complianceRate >= 80 ? 'bg-emerald-500' : s.complianceRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${s.complianceRate}%` }}
                              />
                            </div>
                            <span className="font-mono font-black text-xs">{s.complianceRate}%</span>
                          </div>
                        </td>

                        {/* 8-Slot Timeline Pills */}
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {s.slotRecords.map((r, i) => (
                              <span
                                key={r.slot}
                                title={`${r.slot}: ${r.locationLabel}`}
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black ${
                                  r.status === 'NORMAL'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : r.status === 'RESTING'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {i + 1}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Verdict */}
                      <td className="py-4 px-4 text-center">
                        {s.verdict === 'EXCELLENT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            최우수
                          </span>
                        ) : s.verdict === 'NORMAL' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            양호
                          </span>
                        ) : s.verdict === 'WARNING' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            주의 요망
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-500 border border-rose-500/30 font-extrabold">
                            공정 이탈
                          </span>
                        )}
                      </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Jig Modal with Calendar Pickers & Cumulative Critical Delay Log */}
        {editingJig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">{editingJig.jigName} 블럭 정보 · 캘린더 · 지연 사유</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">시작/종료일 및 공정 지연 크리티컬 사유를 관리합니다.</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingJig(null)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">블럭 코드 (도면에 크게 표시)</label>
                  <input
                    type="text"
                    value={editBlockName}
                    onChange={(e) => setEditBlockName(e.target.value)}
                    placeholder="예: 2111 블럭"
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-black text-foreground outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">블럭 명칭 및 공정 유형</label>
                  <input
                    type="text"
                    value={editBlockType}
                    onChange={(e) => setEditBlockType(e.target.value)}
                    placeholder="예: 선체 저판 이중저 대조립 블럭"
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">담당 물량팀 / 배정팀</label>
                  <input
                    type="text"
                    value={editAssignedTeam}
                    onChange={(e) => setEditAssignedTeam(e.target.value)}
                    placeholder="예: 외주물량1팀 (선체취부)"
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Calendar Start Date & End Date Pickers */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" /> 캘린더 공정 시작일
                    </label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-black text-foreground outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" /> 캘린더 공정 마감일
                    </label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-black text-foreground outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Duration & Progress Display */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-center justify-between">
                  <span className="text-amber-400 font-extrabold text-xs">
                    📅 계산된 총 공정 소요일수:
                  </span>
                  <strong className="text-amber-400 font-mono font-black text-sm">
                    {calculatedTargetDays}일 소요
                  </strong>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground">
                    <span>현재 공정 진행률 (%)</span>
                    <span className="text-blue-400 font-mono font-bold text-xs">{editProgress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editProgress}
                    onChange={(e) => setEditProgress(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setEditingJig(null)}
                  className="flex-1 rounded-xl font-black text-xs"
                >
                  닫기
                </Button>
                <Button
                  onClick={handleSaveJig}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20"
                >
                  캘린더 일정 및 블럭 저장
                </Button>
              </div>

              {/* Inline Critical Delay Logger inside JIG modal */}
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-400">
                    🚨 크리티컬 공정 지연 사유 추가 (연속 누적)
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">대표이사 전용</span>
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
                  {isSavingDelay ? '기록 저장 중...' : '+ 이 블럭에 크리티컬 지연 사유 추가'}
                </Button>

                {delayLogs.filter(l => l.jigId === editingJig.id).length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                    <p className="text-[10px] font-black text-muted-foreground">이 블럭의 이전 누적 사유:</p>
                    {delayLogs.filter(l => l.jigId === editingJig.id).map(log => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] space-y-0.5">
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
    </PCAdminLayout>
  );
};

export default PCAdminFactoryDwell;
