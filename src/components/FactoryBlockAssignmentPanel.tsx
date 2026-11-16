import React, { useMemo, useState } from 'react';
import {
  BlockAssignedWorker,
  FactoryBlockAssignment,
  FactoryGpsRecord,
  FactoryJig
} from '../types';
import {
  CheckSquare,
  Square,
  Search,
  Users,
  Copy,
  Trash2,
  UserMinus,
  Eye,
  Layers,
  CheckCircle2,
  ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FactoryBlockAssignmentPanelProps {
  selectedDate: string;
  jigs: FactoryJig[];
  assignments: FactoryBlockAssignment[];
  rosterWorkers: BlockAssignedWorker[];
  records: FactoryGpsRecord[];
  selectedJigId: string;
  onSelectJigId: (jigId: string) => void;
  onToggleWorker: (jig: FactoryJig, worker: BlockAssignedWorker, assign: boolean) => Promise<void>;
  onClearBlock: (jig: FactoryJig) => Promise<void>;
  onCopyPreviousDay: () => Promise<void>;
  onInspectWorker: (workerUid: string) => void;
  isSaving?: boolean;
  isCopying?: boolean;
  isLight?: boolean;
}

export const FactoryBlockAssignmentPanel: React.FC<FactoryBlockAssignmentPanelProps> = ({
  selectedDate,
  jigs,
  assignments,
  rosterWorkers,
  records,
  selectedJigId,
  onSelectJigId,
  onToggleWorker,
  onClearBlock,
  onCopyPreviousDay,
  onInspectWorker,
  isSaving = false,
  isCopying = false,
  isLight = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNASSIGNED' | 'CHECKED'>('ALL');

  const activeJig = useMemo(
    () => jigs.find(j => j.id === selectedJigId) || jigs[0],
    [jigs, selectedJigId]
  );

  // Map jigId -> assignment doc
  const assignmentByJig = useMemo(() => {
    const map = new Map<string, FactoryBlockAssignment>();
    assignments.forEach(a => map.set(a.jigId, a));
    return map;
  }, [assignments]);

  // Map workerUid -> assigned { jigId, jigName, blockName }
  const assignedJigByWorker = useMemo(() => {
    const map = new Map<string, { jigId: string; jigName: string; blockName: string }>();
    assignments.forEach(a => {
      (a.workers || []).forEach(w => {
        map.set(w.uid, { jigId: a.jigId, jigName: a.jigName, blockName: a.blockName });
      });
    });
    return map;
  }, [assignments]);

  // Map GPS presence per worker & per JIG on selectedDate
  const { gpsByWorker, detectedCountByJig } = useMemo(() => {
    const workerMap = new Map<string, { count: number; blocks: Set<string> }>();
    const jigWorkerSet = new Map<string, Set<string>>();

    records.forEach(r => {
      if (!workerMap.has(r.workerUid)) {
        workerMap.set(r.workerUid, { count: 0, blocks: new Set() });
      }
      const wm = workerMap.get(r.workerUid)!;
      wm.count += 1;
      if (r.blockName) wm.blocks.add(r.blockName);

      if (r.jigId) {
        if (!jigWorkerSet.has(r.jigId)) jigWorkerSet.set(r.jigId, new Set());
        jigWorkerSet.get(r.jigId)!.add(r.workerUid);
      }
    });

    const countMap = new Map<string, number>();
    jigWorkerSet.forEach((set, jId) => countMap.set(jId, set.size));
    return { gpsByWorker: workerMap, detectedCountByJig: countMap };
  }, [records]);

  const activeAssignment = activeJig ? assignmentByJig.get(activeJig.id) : undefined;
  const checkedWorkers: BlockAssignedWorker[] = activeAssignment?.workers || [];
  const checkedUidSet = useMemo(
    () => new Set(checkedWorkers.map(w => w.uid)),
    [checkedWorkers]
  );

  // Unique teams for quick filtering
  const uniqueTeams = useMemo(() => {
    const set = new Set<string>();
    rosterWorkers.forEach(w => {
      if (w.teamName) set.add(w.teamName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [rosterWorkers]);

  const totalAssignedAcrossFactory = useMemo(() => {
    return assignedJigByWorker.size;
  }, [assignedJigByWorker]);

  // Filtered checklist rows
  const filteredRoster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rosterWorkers.filter(w => {
      if (teamFilter !== 'ALL' && w.teamName !== teamFilter) return false;

      const assignedHere = checkedUidSet.has(w.uid);
      const assignedAny = assignedJigByWorker.has(w.uid);
      if (statusFilter === 'CHECKED' && !assignedHere) return false;
      if (statusFilter === 'UNASSIGNED' && assignedAny) return false;

      if (!q) return true;
      return (
        w.displayName.toLowerCase().includes(q) ||
        w.employeeId.toLowerCase().includes(q) ||
        w.teamName.toLowerCase().includes(q) ||
        w.jobRole.toLowerCase().includes(q)
      );
    });
  }, [rosterWorkers, teamFilter, statusFilter, searchQuery, checkedUidSet, assignedJigByWorker]);

  if (!activeJig) return null;

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      {/* Header Bar */}
      <div className="p-5 sm:p-6 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span>일일 블럭별 투입 명단 체크리스트</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-foreground font-black">{selectedDate}</span>
            <span aria-hidden="true">·</span>
            <span className={`font-mono tabular-nums font-bold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
              전체 배정 {totalAssignedAcrossFactory}명 / 가용 {rosterWorkers.length}명
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
            <Layers className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
            블럭별 투입 인원 넣기 / 빼기 체크리스트
          </h3>
          <p className="text-xs text-muted-foreground font-medium">
            좌측에서 블럭을 고르고 우측 명단에서 작업자를 체크하면 즉시 투입 명단에 추가되거나 제외됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onCopyPreviousDay}
            disabled={isCopying || isSaving}
            className="h-10 px-4 rounded-xl text-xs font-bold gap-2 border-border cursor-pointer whitespace-nowrap shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{isCopying ? '불러오는 중...' : '전일 배정 불러오기'}</span>
          </Button>
          {checkedWorkers.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onClearBlock(activeJig)}
              disabled={isSaving}
              className={`h-10 px-4 rounded-xl text-xs font-bold gap-2 border-border cursor-pointer whitespace-nowrap shrink-0 ${
                isLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{activeJig.blockName} 명단 비우기</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: 10 JIG / Block Selector List */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-border p-4 sm:p-5 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
            <span>7공장 지그 / 블럭 선택 ({jigs.length}개)</span>
            <span className="font-mono tabular-nums">배정 / 현장감지</span>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {jigs.map(jig => {
              const isSelected = jig.id === activeJig.id;
              const assign = assignmentByJig.get(jig.id);
              const assignedWorkers = assign?.workers || [];
              const detectedCount = detectedCountByJig.get(jig.id) || 0;

              return (
                <button
                  key={jig.id}
                  type="button"
                  onClick={() => onSelectJigId(jig.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? isLight
                        ? 'bg-blue-50 border-blue-500 text-slate-900'
                        : 'bg-blue-500/15 border-blue-400 text-white'
                      : 'bg-card border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                          isSelected
                            ? isLight
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-blue-500 text-slate-950 border-blue-400'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {jig.jigName}
                      </span>
                      <span className="text-sm font-black truncate">{jig.blockName}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums shrink-0">
                      <span className={`font-black ${assignedWorkers.length > 0 ? (isLight ? 'text-blue-600' : 'text-blue-400') : 'text-muted-foreground'}`}>
                        배정 {assignedWorkers.length}명
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className={`font-bold ${detectedCount > 0 ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : 'text-muted-foreground'}`}>
                        감지 {detectedCount}명
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{jig.assignedTeam}</span>
                    <span className="font-mono tabular-nums shrink-0">{jig.bay === 'BAY_SOUTH' ? '남측 A라인' : '북측 B라인'}</span>
                  </div>

                  {assignedWorkers.length > 0 ? (
                    <div className="pt-1.5 border-t border-border/60 text-xs text-foreground font-semibold flex flex-wrap gap-x-2 gap-y-1">
                      {assignedWorkers.slice(0, 6).map((w, idx) => (
                        <span key={w.uid} className="inline-flex items-center gap-1">
                          {idx > 0 && <span className="text-muted-foreground">·</span>}
                          <span>{w.displayName}</span>
                        </span>
                      ))}
                      {assignedWorkers.length > 6 && (
                        <span className="text-muted-foreground font-mono tabular-nums">
                          외 {assignedWorkers.length - 6}명
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="pt-1.5 border-t border-border/60 text-[11px] text-muted-foreground">
                      아직 투입 체크된 작업자가 없습니다.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Block Checklist Editor */}
        <div className="lg:col-span-7 p-4 sm:p-6 space-y-5">
          {/* Active Block Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                <span>{activeJig.jigName}</span>
                <span aria-hidden="true">·</span>
                <span>{activeJig.assignedTeam}</span>
              </div>
              <h4 className="text-lg font-black text-foreground mt-0.5">
                {activeJig.blockName} 투입 명단 ({checkedWorkers.length}명 배정됨)
              </h4>
            </div>
            <div className="text-xs font-mono tabular-nums text-muted-foreground">
              현장 GPS 감지: <strong className="text-foreground">{detectedCountByJig.get(activeJig.id) || 0}명</strong>
            </div>
          </div>

          {/* Checked-in Workers Strip for Quick Removal & Individual Inspection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>현재 [{activeJig.blockName}] 투입 확정 인원 (이름 클릭 시 개인별 기록 보기)</span>
              <span className="font-mono tabular-nums">{checkedWorkers.length}명</span>
            </div>

            {checkedWorkers.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border text-xs text-muted-foreground text-center font-medium">
                아래 체크리스트에서 작업자를 클릭하여 [{activeJig.blockName}]에 투입 인원을 추가하세요.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checkedWorkers.map(w => {
                  const gps = gpsByWorker.get(w.uid);
                  const detectedAtHere = gps?.blocks.has(activeJig.blockName);
                  return (
                    <div
                      key={w.uid}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-muted/30"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectWorker(w.uid)}
                        className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:underline"
                        title="이 작업자의 개인 상세 기록 보기"
                      >
                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${detectedAtHere ? 'text-emerald-500' : isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-black text-foreground">
                            <span className="truncate">{w.displayName}</span>
                            <span className="font-mono tabular-nums text-[11px] font-medium text-muted-foreground">
                              ({w.employeeId})
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {w.teamName} · {gps ? `GPS ${gps.count}회` : '미감지'}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onInspectWorker(w.uid)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                            isLight ? 'text-blue-600 hover:bg-blue-50' : 'text-blue-400 hover:bg-blue-500/15'
                          }`}
                          title="개인별 상세 체류 기록 보기"
                        >
                          기록
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => onToggleWorker(activeJig, w, false)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            isLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-400 hover:bg-rose-500/15'
                          }`}
                          title="이 블럭 명단에서 제외"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>빼기</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search & Filters for Full Checklist */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="작업자 이름, 사번, 직종, 소속팀 검색..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted/40 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <select
                value={teamFilter}
                onChange={e => setTeamFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-muted/40 border border-border text-xs font-bold text-foreground outline-none cursor-pointer"
              >
                <option value="ALL">전체 소속팀 ({rosterWorkers.length}명)</option>
                {uniqueTeams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Segmented Filter Control */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-flex items-center p-1 rounded-lg bg-muted/50 border border-border">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === 'ALL' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  전체 인원 ({rosterWorkers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNASSIGNED')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === 'UNASSIGNED' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  미배정 인원 ({Math.max(0, rosterWorkers.length - totalAssignedAcrossFactory)})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('CHECKED')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === 'CHECKED' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  이 블럭 투입자 ({checkedWorkers.length})
                </button>
              </div>

              <span className="text-[11px] font-bold text-muted-foreground">
                체크박스를 누르면 즉시 반영됩니다
              </span>
            </div>

            {/* Dense Interactive Checklist Rows */}
            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
                {filteredRoster.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground font-bold">
                    조건에 해당하는 작업자가 없습니다.
                  </div>
                ) : (
                  filteredRoster.map(w => {
                    const isCheckedHere = checkedUidSet.has(w.uid);
                    const otherAssign = assignedJigByWorker.get(w.uid);
                    const isAssignedElsewhere = Boolean(otherAssign && otherAssign.jigId !== activeJig.id);
                    const gps = gpsByWorker.get(w.uid);

                    return (
                      <div
                        key={w.uid}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 min-h-[48px] transition-colors ${
                          isCheckedHere
                            ? isLight
                              ? 'bg-blue-50/70'
                              : 'bg-blue-500/10'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => onToggleWorker(activeJig, w, !isCheckedHere)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer py-1"
                        >
                          {isCheckedHere ? (
                            <CheckSquare className={`w-5 h-5 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                          ) : (
                            <Square className="w-5 h-5 shrink-0 text-muted-foreground" />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs font-black text-foreground">
                              <span>{w.displayName}</span>
                              <span className="font-mono tabular-nums text-[11px] font-medium text-muted-foreground">
                                {w.employeeId}
                              </span>
                              <span className="text-[11px] font-bold text-muted-foreground truncate">
                                · {w.teamName} ({w.jobRole})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] mt-0.5">
                              {isCheckedHere ? (
                                <span className={`font-bold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                  {activeJig.blockName} 투입 중 (클릭 시 해제)
                                </span>
                              ) : isAssignedElsewhere && otherAssign ? (
                                <span className={`font-bold inline-flex items-center gap-1 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
                                  <ArrowRightLeft className="w-3 h-3" />
                                  현재 {otherAssign.blockName}({otherAssign.jigName}) 배정됨 · 클릭 시 {activeJig.blockName}으로 이동
                                </span>
                              ) : (
                                <span className="text-muted-foreground">미배정 (클릭하여 투입)</span>
                              )}

                              {gps && (
                                <>
                                  <span aria-hidden="true" className="text-muted-foreground">·</span>
                                  <span className={`font-mono tabular-nums font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                    금일 감지 {gps.count}회
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onInspectWorker(w.uid)}
                          className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-bold text-foreground inline-flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>개인 기록</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FactoryBlockAssignmentPanel;
