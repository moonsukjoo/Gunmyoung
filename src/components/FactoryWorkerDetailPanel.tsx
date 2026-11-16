import React, { useEffect, useMemo, useState } from 'react';
import {
  BlockAssignedWorker,
  FactoryGpsRecord,
  FactoryJig,
  TRACKING_TIME_SLOTS,
  WorkerDwellSummary
} from '../types';
import {
  fetchWorkerHistoryBundle,
  formatMinutesToKorean,
  SLOT_MINUTES_MAP
} from '../services/factoryTrackingService';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Search,
  User,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  X,
  UserMinus
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface InspectableWorkerRow {
  uid: string;
  workerName: string;
  employeeId: string;
  teamName: string;
  jobRole: string;
  assignedJigId?: string;
  assignedBlockName?: string;
  summary?: WorkerDwellSummary;
  hasGpsRecords: boolean;
}

interface FactoryWorkerDetailPanelProps {
  selectedDate: string;
  onChangeDate: (dateStr: string) => void;
  selectedWorkerUid: string | null;
  onSelectWorker: (uid: string | null) => void;
  workers: InspectableWorkerRow[];
  jigs: FactoryJig[];
  records: FactoryGpsRecord[];
  onAssignWorkerToJig: (jig: FactoryJig, worker: BlockAssignedWorker) => Promise<void>;
  onRemoveWorkerFromAssignment: (workerUid: string) => Promise<void>;
  onClose?: () => void;
  isLight?: boolean;
}

export const FactoryWorkerDetailPanel: React.FC<FactoryWorkerDetailPanelProps> = ({
  selectedDate,
  onChangeDate,
  selectedWorkerUid,
  onSelectWorker,
  workers,
  jigs,
  records,
  onAssignWorkerToJig,
  onRemoveWorkerFromAssignment,
  onClose,
  isLight = false
}) => {
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'RECORDED' | 'ALERT' | 'ASSIGNED'>('ALL');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySummaries, setHistorySummaries] = useState<WorkerDwellSummary[]>([]);
  const [historyRecords, setHistoryRecords] = useState<FactoryGpsRecord[]>([]);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);

  const filteredWorkers = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return workers.filter(w => {
      if (rosterFilter === 'RECORDED' && !w.hasGpsRecords) return false;
      if (rosterFilter === 'ASSIGNED' && !w.assignedJigId) return false;
      if (
        rosterFilter === 'ALERT' &&
        w.summary?.verdict !== 'WARNING' &&
        w.summary?.verdict !== 'CRITICAL_AWAY'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        w.workerName.toLowerCase().includes(q) ||
        w.employeeId.toLowerCase().includes(q) ||
        w.teamName.toLowerCase().includes(q) ||
        (w.assignedBlockName || '').toLowerCase().includes(q)
      );
    });
  }, [workers, rosterSearch, rosterFilter]);

  // Effective active worker (auto-select first if none selected)
  const activeWorker = useMemo(() => {
    if (selectedWorkerUid) {
      const exact = workers.find(w => w.uid === selectedWorkerUid);
      if (exact) return exact;
    }
    return filteredWorkers[0] || workers[0] || null;
  }, [selectedWorkerUid, workers, filteredWorkers]);

  const activeIndex = useMemo(() => {
    if (!activeWorker) return -1;
    return filteredWorkers.findIndex(w => w.uid === activeWorker.uid);
  }, [activeWorker, filteredWorkers]);

  const activeRecords = useMemo(() => {
    if (!activeWorker) return [];
    return records
      .filter(r => r.workerUid === activeWorker.uid)
      .sort((a, b) => a.slotIndex - b.slotIndex);
  }, [records, activeWorker]);

  // Fetch recent 7-day individual history when activeWorker or selectedDate changes
  useEffect(() => {
    let cancelled = false;
    if (!activeWorker) {
      setHistorySummaries([]);
      setHistoryRecords([]);
      return;
    }

    setHistoryLoading(true);
    fetchWorkerHistoryBundle(activeWorker.uid, selectedDate, 7)
      .then(bundle => {
        if (cancelled) return;
        setHistorySummaries(bundle.summaries);
        setHistoryRecords(bundle.records);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorker?.uid, selectedDate]);

  const handleStepWorker = (delta: -1 | 1) => {
    if (filteredWorkers.length === 0) return;
    const baseIdx = activeIndex >= 0 ? activeIndex : 0;
    const nextIdx = (baseIdx + delta + filteredWorkers.length) % filteredWorkers.length;
    onSelectWorker(filteredWorkers[nextIdx].uid);
  };

  const handleChangeAssignedJig = async (nextJigId: string) => {
    if (!activeWorker) return;
    setIsUpdatingBlock(true);
    try {
      if (!nextJigId) {
        await onRemoveWorkerFromAssignment(activeWorker.uid);
      } else {
        const targetJig = jigs.find(j => j.id === nextJigId);
        if (targetJig) {
          await onAssignWorkerToJig(targetJig, {
            uid: activeWorker.uid,
            displayName: activeWorker.workerName,
            employeeId: activeWorker.employeeId,
            teamName: activeWorker.teamName,
            jobRole: activeWorker.jobRole
          });
        }
      }
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  // Multi-day summary rows merged from workerDwellSummaries + raw records fallback
  const recentDailyRows = useMemo(() => {
    if (!activeWorker) return [];
    const byDate = new Map<
      string,
      {
        date: string;
        blockName: string;
        workMinutes: number;
        restMinutes: number;
        awayMinutes: number;
        complianceRate: number;
        recordCount: number;
      }
    >();

    historyRecords.forEach(r => {
      if (!byDate.has(r.date)) {
        byDate.set(r.date, {
          date: r.date,
          blockName: r.blockName || r.locationLabel,
          workMinutes: 0,
          restMinutes: 0,
          awayMinutes: 0,
          complianceRate: 0,
          recordCount: 0
        });
      }
      const row = byDate.get(r.date)!;
      const mins = r.stayMinutesInSlot || SLOT_MINUTES_MAP[r.slot] || 60;
      row.recordCount += 1;
      if (r.isAtAssignedJig) row.workMinutes += mins;
      else if (r.locationType === 'REST_AREA' || r.locationType === 'RESTROOM') row.restMinutes += mins;
      else row.awayMinutes += mins;
    });

    historySummaries.forEach(s => {
      byDate.set(s.date, {
        date: s.date,
        blockName: s.assignedBlockName,
        workMinutes: s.workBlockDwellMinutes,
        restMinutes: s.restAreaMinutes,
        awayMinutes: s.awayMinutes,
        complianceRate: s.complianceRate,
        recordCount: s.slotRecords?.length || 8
      });
    });

    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [activeWorker, historyRecords, historySummaries]);

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      {/* Top Bar */}
      <div className="p-5 sm:p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span>작업자 개인별 상세 체류 기록</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-foreground font-black">{selectedDate}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">총 {workers.length}명</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2 mt-0.5">
            <User className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
            한 사람씩 개인별 동선 · 체류시간 · 최근 이력 보기
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleStepWorker(-1)}
            disabled={filteredWorkers.length <= 1}
            className="h-9 px-3 rounded-xl text-xs font-bold gap-1 border-border cursor-pointer whitespace-nowrap shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>이전 작업자</span>
          </Button>
          <span className="text-xs font-mono tabular-nums font-bold text-muted-foreground px-1">
            {filteredWorkers.length > 0 && activeIndex >= 0
              ? `${activeIndex + 1} / ${filteredWorkers.length}`
              : `0 / ${filteredWorkers.length}`}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleStepWorker(1)}
            disabled={filteredWorkers.length <= 1}
            className="h-9 px-3 rounded-xl text-xs font-bold gap-1 border-border cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>다음 작업자</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-3 rounded-xl text-xs font-bold gap-1 border-border cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>닫기</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Layout: Left Worker Picker + Right 1-Person Detailed Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Roster Rail */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border p-4 space-y-3 bg-muted/20">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rosterSearch}
              onChange={e => setRosterSearch(e.target.value)}
              placeholder="이름, 사번, 블럭 검색..."
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-card border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-card border border-border text-[11px] font-bold">
            {(
              [
                { id: 'ALL', label: '전체' },
                { id: 'RECORDED', label: '감지됨' },
                { id: 'ASSIGNED', label: '배정됨' },
                { id: 'ALERT', label: '주의' }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRosterFilter(tab.id)}
                className={`py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                  rosterFilter === tab.id
                    ? isLight
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-slate-950'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 max-h-[680px] overflow-y-auto pr-1">
            {filteredWorkers.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground font-bold">
                해당 조건의 작업자가 없습니다.
              </div>
            ) : (
              filteredWorkers.map(w => {
                const isSelected = activeWorker?.uid === w.uid;
                const rate = w.summary?.complianceRate;
                const verdict = w.summary?.verdict;
                return (
                  <button
                    key={w.uid}
                    type="button"
                    onClick={() => onSelectWorker(w.uid)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 min-h-[54px] ${
                      isSelected
                        ? isLight
                          ? 'bg-blue-50 border-blue-500 text-slate-900'
                          : 'bg-blue-500/15 border-blue-400 text-white'
                        : 'bg-card border-border hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span className="truncate">{w.workerName}</span>
                        <span className="font-mono tabular-nums text-[11px] font-medium text-muted-foreground">
                          {w.employeeId}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {w.assignedBlockName || '미배정'} · {w.teamName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {w.hasGpsRecords && rate !== undefined ? (
                        <>
                          <span
                            className={`text-xs font-mono tabular-nums font-black block ${
                              verdict === 'CRITICAL_AWAY' || verdict === 'WARNING'
                                ? isLight
                                  ? 'text-rose-600'
                                  : 'text-rose-400'
                                : isLight
                                ? 'text-emerald-600'
                                : 'text-emerald-400'
                            }`}
                          >
                            {rate}%
                          </span>
                          <span className="text-[10px] text-muted-foreground font-bold">
                            {verdict === 'EXCELLENT'
                              ? '우수'
                              : verdict === 'NORMAL'
                              ? '정상'
                              : verdict === 'WARNING'
                              ? '주의'
                              : '이탈'}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-muted-foreground">신호 대기</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Single Worker Dossier */}
        <div className="lg:col-span-8 p-5 sm:p-6 space-y-6">
          {!activeWorker ? (
            <div className="py-20 text-center text-sm text-muted-foreground font-bold">
              좌측에서 작업자를 선택하면 해당 작업자의 개인별 상세 체류 기록이 표시됩니다.
            </div>
          ) : (
            <>
              {/* Worker Identity & Quick Block Switcher */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                      isLight ? 'bg-blue-600 text-white' : 'bg-blue-500 text-slate-950'
                    }`}
                  >
                    {activeWorker.workerName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xl font-black text-foreground">{activeWorker.workerName}</h4>
                      <span className="font-mono tabular-nums text-xs font-bold text-muted-foreground">
                        {activeWorker.employeeId}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5 font-medium">
                      <span>{activeWorker.teamName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeWorker.jobRole}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        기준일 <strong className="font-mono tabular-nums text-foreground">{selectedDate}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Block Re-assignment Controls for This Date */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={activeWorker.assignedJigId || ''}
                    disabled={isUpdatingBlock}
                    onChange={e => handleChangeAssignedJig(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-muted/50 border border-border text-xs font-black text-foreground outline-none cursor-pointer"
                  >
                    <option value="">미배정 (투입 블럭 없음)</option>
                    {jigs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.jigName} · {j.blockName} 배정
                      </option>
                    ))}
                  </select>
                  {activeWorker.assignedJigId && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUpdatingBlock}
                      onClick={() => handleChangeAssignedJig('')}
                      className={`h-10 px-3 rounded-xl text-xs font-bold gap-1 border-border cursor-pointer whitespace-nowrap shrink-0 ${
                        isLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-400 hover:bg-rose-500/10'
                      }`}
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>블럭 빼기</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Single-Worker Metric Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground block">총 관제 시간</span>
                  <strong className="text-lg font-black font-mono tabular-nums text-foreground mt-1 block">
                    {activeWorker.summary
                      ? formatMinutesToKorean(activeWorker.summary.totalShiftMinutes)
                      : '0분'}
                  </strong>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground block">배정 블럭 실체류</span>
                  <strong className={`text-lg font-black font-mono tabular-nums mt-1 block ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                    {activeWorker.summary
                      ? formatMinutesToKorean(activeWorker.summary.workBlockDwellMinutes)
                      : '0분'}
                  </strong>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground block">휴게 · 화장실</span>
                  <strong className={`text-lg font-black font-mono tabular-nums mt-1 block ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
                    {activeWorker.summary
                      ? formatMinutesToKorean(activeWorker.summary.restAreaMinutes)
                      : '0분'}
                  </strong>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground block">타구역 · 이탈</span>
                  <strong
                    className={`text-lg font-black font-mono tabular-nums mt-1 block ${
                      (activeWorker.summary?.awayMinutes || 0) > 0
                        ? isLight
                          ? 'text-rose-600'
                          : 'text-rose-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {activeWorker.summary
                      ? formatMinutesToKorean(activeWorker.summary.awayMinutes)
                      : '0분'}
                  </strong>
                </div>
              </div>

              {/* Zone-by-Zone Dwell Distribution Bars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-black text-foreground flex items-center gap-2">
                    <MapPin className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                    어느 블럭/구역에 얼마동안 머물렀는가 ({selectedDate})
                  </h5>
                  {activeWorker.summary && (
                    <span className="text-xs font-mono tabular-nums font-black text-foreground">
                      준수율 {activeWorker.summary.complianceRate}%
                    </span>
                  )}
                </div>

                {!activeWorker.summary || activeWorker.summary.dwellDetails.length === 0 ? (
                  <div className="p-5 rounded-2xl border border-dashed border-border text-xs text-muted-foreground text-center font-medium">
                    {selectedDate} 기준 이 작업자의 GPS 체류 기록이 아직 수집되지 않았습니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeWorker.summary.dwellDetails.map(d => {
                      const isAssignedMatch =
                        activeWorker.assignedBlockName &&
                        d.blockOrArea === activeWorker.assignedBlockName;
                      return (
                        <div key={d.blockOrArea} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-foreground">
                              {d.blockOrArea}
                              {isAssignedMatch && (
                                <span className={`ml-2 text-[11px] font-black ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                  · 배정 블럭
                                </span>
                              )}
                            </span>
                            <span className="font-mono tabular-nums font-black text-foreground">
                              {formatMinutesToKorean(d.minutes)} ({d.percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isAssignedMatch
                                  ? 'bg-emerald-500'
                                  : d.isWorkBlock
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.max(4, d.percentage)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 8-Slot Chronological Log Table */}
              <div className="space-y-3">
                <h5 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                  시간대별(08:20 ~ 17:45) 상세 동선 기록표
                </h5>

                <div className="border border-border rounded-2xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-[11px] font-black text-muted-foreground">
                        <th className="py-3 px-4 whitespace-nowrap">회차 · 시각</th>
                        <th className="py-3 px-4 whitespace-nowrap">감지 구역 / 블럭명</th>
                        <th className="py-3 px-4 whitespace-nowrap">상태 판정</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">인정 체류</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">도면 좌표 / 정밀도</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {TRACKING_TIME_SLOTS.map((slot, idx) => {
                        const rec = activeRecords.find(r => r.slot === slot);
                        const isNormal = rec?.status === 'NORMAL';
                        const isResting = rec?.status === 'RESTING';

                        return (
                          <tr key={slot} className="hover:bg-muted/20">
                            <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                              {idx + 1}차 · {slot}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-foreground">
                              {rec ? rec.locationLabel : <span className="text-muted-foreground">신호 미수신</span>}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {!rec ? (
                                <span className="text-muted-foreground font-medium">미기록</span>
                              ) : isNormal ? (
                                <span className={`inline-flex items-center gap-1 font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  배정 일치
                                </span>
                              ) : isResting ? (
                                <span className={`inline-flex items-center gap-1 font-bold ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
                                  <Coffee className="w-3.5 h-3.5" />
                                  휴게
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 font-bold ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {rec.blockName ? '타블럭 위치' : '구역 이탈'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                              {rec ? `${rec.stayMinutesInSlot}분` : '-'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[11px] text-muted-foreground whitespace-nowrap">
                              {rec ? `(${rec.mapX}, ${rec.mapY}) · ±${rec.accuracy || 4}m` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent 7-Day Individual History */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-black text-foreground flex items-center gap-2">
                    <CalendarDays className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                    {activeWorker.workerName}님의 최근 7일 누적 출역·체류 기록
                  </h5>
                  {historyLoading && (
                    <span className="text-xs text-muted-foreground font-bold">불러오는 중...</span>
                  )}
                </div>

                {recentDailyRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-medium py-3">
                    최근 7일 내 저장된 다른 일자의 체류 기록이 없습니다.
                  </p>
                ) : (
                  <div className="border border-border rounded-2xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-[11px] font-black text-muted-foreground">
                          <th className="py-2.5 px-4">일자</th>
                          <th className="py-2.5 px-4">배정/주 체류 블럭</th>
                          <th className="py-2.5 px-4 text-right">블럭 실체류</th>
                          <th className="py-2.5 px-4 text-right">휴게</th>
                          <th className="py-2.5 px-4 text-right">타구역/이탈</th>
                          <th className="py-2.5 px-4 text-right">조회</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {recentDailyRows.map(row => {
                          const isCurrent = row.date === selectedDate;
                          return (
                            <tr
                              key={row.date}
                              className={isCurrent ? (isLight ? 'bg-blue-50/70' : 'bg-blue-500/10') : 'hover:bg-muted/20'}
                            >
                              <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-foreground">
                                {row.date}
                                {isCurrent && <span className="ml-1.5 text-[10px] text-muted-foreground">(선택중)</span>}
                              </td>
                              <td className="py-2.5 px-4 font-bold text-foreground">{row.blockName}</td>
                              <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                {formatMinutesToKorean(row.workMinutes)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">
                                {formatMinutesToKorean(row.restMinutes)}
                              </td>
                              <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold ${row.awayMinutes > 0 ? (isLight ? 'text-rose-600' : 'text-rose-400') : 'text-muted-foreground'}`}>
                                {formatMinutesToKorean(row.awayMinutes)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => onChangeDate(row.date)}
                                  disabled={isCurrent}
                                  className={`text-[11px] font-bold cursor-pointer ${
                                    isCurrent
                                      ? 'text-muted-foreground cursor-default'
                                      : isLight
                                      ? 'text-blue-600 hover:underline'
                                      : 'text-blue-400 hover:underline'
                                  }`}
                                >
                                  {isCurrent ? '현재 날짜' : '이 날짜 보기'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FactoryWorkerDetailPanel;
