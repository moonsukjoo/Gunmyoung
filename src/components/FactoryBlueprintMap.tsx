import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  FactoryJig, 
  FactoryGpsRecord, 
  TrackingSlotTime, 
  TRACKING_TIME_SLOTS,
  BlockDelayLog,
  FactoryBoundaryCalibration
} from '../types';
import { 
  FACTORY_BOUNDS, 
  FACTORY_FACILITIES, 
  formatMinutesToKorean,
  HeatmapAggregationMode,
  TWO_HOUR_WINDOWS,
  getWindowForSlot,
  computeZoneDwellHeatmap,
  getHeatmapColors,
  ZoneDwellMetric,
  computeCalibrationBasis
} from '../services/factoryTrackingService';
import { 
  Compass, 
  Layers, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Coffee, 
  HardHat, 
  Maximize2, 
  Minimize2, 
  Info,
  Clock,
  ArrowRight,
  Smartphone,
  Map as MapIcon,
  ShieldAlert,
  Flame,
  Eye,
  EyeOff,
  Move,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Grid,
  Copy,
  GripVertical,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const BLOCK_SIZE_PRESETS = [
  { id: 'SM', label: '소형', w: 150, h: 170 },
  { id: 'MD', label: '표준', w: 190, h: 220 },
  { id: 'WIDE', label: '가로형', w: 260, h: 190 },
  { id: 'LG', label: '대형', w: 250, h: 250 }
] as const;

interface FactoryBlueprintMapProps {
  jigs: FactoryJig[];
  records: FactoryGpsRecord[];
  delayLogs?: BlockDelayLog[];
  calibration?: FactoryBoundaryCalibration | null;
  selectedSlot: TrackingSlotTime;
  onSelectSlot?: (slot: TrackingSlotTime) => void;
  selectedWorkerUid?: string | null;
  onSelectWorker?: (workerUid: string | null) => void;
  onSelectJig?: (jig: FactoryJig) => void;
  selectedJigId?: string | null;
  isPrintMode?: boolean;
  allowLayoutEdit?: boolean;
  isLayoutEditMode?: boolean;
  onToggleLayoutEditMode?: (editing: boolean) => void;
  onSaveLayout?: (updatedJigs: FactoryJig[], deletedIds: string[]) => Promise<void>;
}

export const FactoryBlueprintMap: React.FC<FactoryBlueprintMapProps> = ({
  jigs,
  records,
  delayLogs = [],
  calibration = null,
  selectedSlot,
  onSelectSlot,
  selectedWorkerUid,
  onSelectWorker,
  onSelectJig,
  selectedJigId,
  isPrintMode = false,
  allowLayoutEdit = false,
  isLayoutEditMode,
  onToggleLayoutEditMode,
  onSaveLayout
}) => {
  const calibratedBasis = useMemo(
    () => (calibration ? computeCalibrationBasis(calibration) : null),
    [calibration]
  );
  const [hoveredWorker, setHoveredWorker] = useState<FactoryGpsRecord | null>(null);
  const [hoveredJig, setHoveredJig] = useState<FactoryJig | null>(null);
  const [showPath, setShowPath] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapAggregationMode>('2H_WINDOW');
  const [activeWindowId, setActiveWindowId] = useState<string>(() => getWindowForSlot(selectedSlot).id);
  const [viewMode, setViewMode] = useState<'MOBILE_GRID' | 'BLUEPRINT_A3'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && !isPrintMode) {
      return 'MOBILE_GRID';
    }
    return 'BLUEPRINT_A3';
  });

  // Interactive Drag-and-Drop Blueprint Layout Studio state
  const [internalEditMode, setInternalEditMode] = useState(false);
  const editingLayout = isLayoutEditMode !== undefined ? isLayoutEditMode : internalEditMode;
  const setEditingLayout = (next: boolean) => {
    if (onToggleLayoutEditMode) onToggleLayoutEditMode(next);
    else setInternalEditMode(next);
  };

  const [draftJigs, setDraftJigs] = useState<FactoryJig[]>(jigs);
  const [deletedJigIds, setDeletedJigIds] = useState<string[]>([]);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockType, setNewBlockType] = useState('선체 조립 블럭');
  const [newBlockTeam, setNewBlockTeam] = useState('현장취부반');
  const [newBlockPresetId, setNewBlockPresetId] = useState<'SM' | 'MD' | 'WIDE' | 'LG'>('MD');
  const [isDragHoveringCanvas, setIsDragHoveringCanvas] = useState(false);
  const [alignGuides, setAlignGuides] = useState<{ x?: number; y?: number }>({});
  const [activeDragJigId, setActiveDragJigId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragSessionRef = useRef<{
    mode: 'MOVE' | 'RESIZE';
    jigId: string;
    startSvgX: number;
    startSvgY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Sync draft copy whenever entering edit mode or underlying jigs reload while not editing
  useEffect(() => {
    if (!editingLayout) {
      setDraftJigs(jigs);
      setDeletedJigIds([]);
      setEditingBlockId(null);
      setActiveDragJigId(null);
      setAlignGuides({});
    } else {
      setViewMode('BLUEPRINT_A3');
      setDraftJigs(prev => (prev.length > 0 ? prev : jigs));
      setEditingBlockId(prev => prev || jigs[0]?.id || null);
    }
  }, [editingLayout, jigs]);

  const activeJigs = editingLayout ? draftJigs : jigs;
  const selectedDraftJig = useMemo(
    () => (editingLayout ? draftJigs.find(j => j.id === editingBlockId) || null : null),
    [editingLayout, draftJigs, editingBlockId]
  );

  const hasUnsavedLayoutChanges = useMemo(() => {
    if (!editingLayout) return false;
    if (deletedJigIds.length > 0 || draftJigs.length !== jigs.length) return true;
    return JSON.stringify(draftJigs) !== JSON.stringify(jigs);
  }, [editingLayout, draftJigs, jigs, deletedJigIds]);

  const clientToSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 707, y: 500 };
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 707, y: 500 };
    return {
      x: ((clientX - rect.left) / rect.width) * 1414,
      y: ((clientY - rect.top) / rect.height) * 1000
    };
  };

  const snapValue = (v: number, enabled: boolean, step = 20) =>
    enabled ? Math.round(v / step) * step : Math.round(v);

  const findOpenBlueprintSlot = (w: number, h: number, existing: FactoryJig[]): { x: number; y: number } => {
    const candidateYs = [160, 610, 380, 120, 680];
    const candidateXs = [170, 400, 630, 860, 1090, 280, 520, 760, 990];
    for (const cy of candidateYs) {
      for (const cx of candidateXs) {
        const clampedX = Math.min(1360 - w, Math.max(50, cx));
        const clampedY = Math.min(940 - h, Math.max(60, cy));
        const overlaps = existing.some(
          j =>
            clampedX < j.x + j.width - 15 &&
            clampedX + w > j.x + 15 &&
            clampedY < j.y + j.height - 15 &&
            clampedY + h > j.y + 15
        );
        if (!overlaps) return { x: clampedX, y: clampedY };
      }
    }
    const offset = (existing.length % 5) * 35;
    return { x: Math.min(1360 - w, 200 + offset), y: Math.min(940 - h, 180 + offset) };
  };

  const createAndPlaceBlock = (dropPos?: { x: number; y: number }) => {
    const cleanName = newBlockName.trim() || `신규 블럭 ${draftJigs.length + 1}`;
    const preset = BLOCK_SIZE_PRESETS.find(p => p.id === newBlockPresetId) || BLOCK_SIZE_PRESETS[1];
    const maxNum = draftJigs.reduce((m, j) => Math.max(m, j.jigNumber || 0), 0);
    const nextNum = maxNum + 1;
    const uniqueId = `jig-${Date.now().toString(36).slice(-4)}-${nextNum}`;

    let targetX: number;
    let targetY: number;
    if (dropPos) {
      targetX = snapValue(Math.max(50, Math.min(1360 - preset.w, dropPos.x - preset.w / 2)), snapToGrid);
      targetY = snapValue(Math.max(60, Math.min(940 - preset.h, dropPos.y - preset.h / 2)), snapToGrid);
    } else {
      const slot = findOpenBlueprintSlot(preset.w, preset.h, draftJigs);
      targetX = slot.x;
      targetY = slot.y;
    }

    const newJig: FactoryJig = {
      id: uniqueId,
      jigNumber: nextNum,
      jigName: `JIG-${String(nextNum).padStart(2, '0')}`,
      blockName: cleanName,
      blockType: newBlockType.trim() || '선체 조립 블럭',
      assignedTeam: newBlockTeam.trim() || '현장취부반',
      currentProgress: 0,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      targetDays: 10,
      x: targetX,
      y: targetY,
      width: preset.w,
      height: preset.h,
      bay: targetY + preset.h / 2 < 500 ? 'BAY_SOUTH' : 'BAY_NORTH',
      status: 'ACTIVE'
    };

    setDraftJigs(prev => [...prev, newJig]);
    setEditingBlockId(newJig.id);
    setNewBlockName('');
    toast.success(`[${cleanName}] 블럭이 도면에 배치되었습니다. 마우스로 끌어 위치를 조정하세요!`);
  };

  const handleDuplicateDraftJig = (source: FactoryJig) => {
    const maxNum = draftJigs.reduce((m, j) => Math.max(m, j.jigNumber || 0), 0);
    const nextNum = maxNum + 1;
    const targetX = Math.min(1360 - source.width, source.x + 30);
    const targetY = Math.min(940 - source.height, source.y + 30);
    const copyJig: FactoryJig = {
      ...source,
      id: `jig-${Date.now().toString(36).slice(-4)}-${nextNum}`,
      jigNumber: nextNum,
      jigName: `JIG-${String(nextNum).padStart(2, '0')}`,
      blockName: `${source.blockName} (복제)`,
      x: targetX,
      y: targetY,
      bay: targetY + source.height / 2 < 500 ? 'BAY_SOUTH' : 'BAY_NORTH'
    };
    setDraftJigs(prev => [...prev, copyJig]);
    setEditingBlockId(copyJig.id);
    toast.success(`[${copyJig.blockName}] 복제 완료 — 도면에서 끌어 위치를 잡아주세요.`);
  };

  const handleDeleteDraftJig = (id: string) => {
    if (draftJigs.length <= 1) {
      toast.error('최소 1개 이상의 블럭은 도면에 남아있어야 합니다.');
      return;
    }
    const target = draftJigs.find(j => j.id === id);
    setDraftJigs(prev => prev.filter(j => j.id !== id));
    if (jigs.some(orig => orig.id === id)) {
      setDeletedJigIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    }
    setEditingBlockId(prev => {
      if (prev !== id) return prev;
      const remaining = draftJigs.filter(j => j.id !== id);
      return remaining[0]?.id || null;
    });
    if (target) {
      toast.info(`[${target.blockName}] 도면에서 제거됨 ([저장] 시 최종 반영)`);
    }
  };

  const handleUpdateDraftField = (id: string, patch: Partial<FactoryJig>) => {
    setDraftJigs(prev =>
      prev.map(j => {
        if (j.id !== id) return j;
        const merged = { ...j, ...patch };
        return {
          ...merged,
          bay: merged.y + merged.height / 2 < 500 ? 'BAY_SOUTH' : 'BAY_NORTH'
        };
      })
    );
  };

  const handleAutoArrangeCols = (cols: 3 | 4) => {
    const startX = 160;
    const totalAvailW = 1090;
    const gapX = 24;
    const cellW = Math.floor((totalAvailW - gapX * (cols - 1)) / cols);
    const cellH = 215;

    setDraftJigs(prev =>
      prev.map((j, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = startX + col * (cellW + gapX);
        const y = row === 0 ? 160 : row === 1 ? 610 : Math.min(720, 160 + row * 235);
        return {
          ...j,
          x: Math.round(x),
          y: Math.round(y),
          width: cellW,
          height: cellH,
          bay: y + cellH / 2 < 500 ? 'BAY_SOUTH' : 'BAY_NORTH'
        };
      })
    );
    toast.success(`${cols}열 그리드로 깔끔하게 자동 정렬되었습니다.`);
  };

  const handleDiscardLayout = () => {
    setDraftJigs(jigs);
    setDeletedJigIds([]);
    setEditingBlockId(jigs[0]?.id || null);
    toast.info('변경사항을 되돌렸습니다.');
  };

  const handleCommitLayout = async () => {
    if (!onSaveLayout) {
      setEditingLayout(false);
      return;
    }
    setIsSavingLayout(true);
    try {
      await onSaveLayout(draftJigs, deletedJigIds);
      setDeletedJigIds([]);
      setEditingLayout(false);
      toast.success('7공장 블럭 명칭 및 마우스 배치가 저장되었습니다!');
    } catch {
      toast.error('블럭 배치 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleJigPointerDown = (e: React.PointerEvent, jig: FactoryJig, mode: 'MOVE' | 'RESIZE') => {
    if (!editingLayout) return;
    e.stopPropagation();
    const pt = clientToSvgPoint(e.clientX, e.clientY);
    dragSessionRef.current = {
      mode,
      jigId: jig.id,
      startSvgX: pt.x,
      startSvgY: pt.y,
      origX: jig.x,
      origY: jig.y,
      origW: jig.width,
      origH: jig.height
    };
    setEditingBlockId(jig.id);
    setActiveDragJigId(jig.id);
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // ignore on virtual pointer events
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const session = dragSessionRef.current;
    if (!session || !editingLayout) return;
    const pt = clientToSvgPoint(e.clientX, e.clientY);
    const dx = pt.x - session.startSvgX;
    const dy = pt.y - session.startSvgY;
    const useSnap = snapToGrid && !e.altKey;

    if (session.mode === 'MOVE') {
      let nextX = Math.max(45, Math.min(1369 - session.origW, session.origX + dx));
      let nextY = Math.max(55, Math.min(945 - session.origH, session.origY + dy));

      if (useSnap) {
        nextX = snapValue(nextX, true, 10);
        nextY = snapValue(nextY, true, 10);
      }

      // Smart magnetic edge alignment with other blocks
      let guideX: number | undefined;
      let guideY: number | undefined;
      const SNAP_TOL = 10;
      for (const other of draftJigs) {
        if (other.id === session.jigId) continue;
        if (Math.abs(nextX - other.x) <= SNAP_TOL) {
          nextX = other.x;
          guideX = other.x;
        } else if (Math.abs(nextX + session.origW - (other.x + other.width)) <= SNAP_TOL) {
          nextX = other.x + other.width - session.origW;
          guideX = other.x + other.width;
        }
        if (Math.abs(nextY - other.y) <= SNAP_TOL) {
          nextY = other.y;
          guideY = other.y;
        } else if (Math.abs(nextY + session.origH - (other.y + other.height)) <= SNAP_TOL) {
          nextY = other.y + other.height - session.origH;
          guideY = other.y + other.height;
        }
      }

      nextX = Math.max(45, Math.min(1369 - session.origW, Math.round(nextX)));
      nextY = Math.max(55, Math.min(945 - session.origH, Math.round(nextY)));
      setAlignGuides({ x: guideX, y: guideY });

      setDraftJigs(prev =>
        prev.map(j =>
          j.id === session.jigId
            ? {
                ...j,
                x: nextX,
                y: nextY,
                bay: nextY + j.height / 2 < 500 ? 'BAY_SOUTH' : 'BAY_NORTH'
              }
            : j
        )
      );
    } else {
      let nextW = Math.max(120, Math.min(460, session.origW + dx));
      let nextH = Math.max(120, Math.min(360, session.origH + dy));
      if (useSnap) {
        nextW = snapValue(nextW, true, 10);
        nextH = snapValue(nextH, true, 10);
      }
      nextW = Math.min(1369 - session.origX, Math.round(nextW));
      nextH = Math.min(945 - session.origY, Math.round(nextH));

      setDraftJigs(prev =>
        prev.map(j =>
          j.id === session.jigId
            ? {
                ...j,
                width: nextW,
                height: nextH,
                bay: j.y + nextH / 2 < 500 ? 'BAY_SOUTH' : 'BAY_NORTH'
              }
            : j
        )
      );
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragSessionRef.current) return;
    dragSessionRef.current = null;
    setActiveDragJigId(null);
    setAlignGuides({});
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Sync active 2-hour window when selectedSlot changes from parent slot bar
  useEffect(() => {
    setActiveWindowId(getWindowForSlot(selectedSlot).id);
  }, [selectedSlot]);

  // Compute heatmap concentration metrics
  const heatmap = useMemo(
    () => computeZoneDwellHeatmap(activeJigs, records, heatmapMode, selectedSlot, activeWindowId),
    [activeJigs, records, heatmapMode, selectedSlot, activeWindowId]
  );

  // Filter records for the currently active slot
  const currentSlotRecords = records.filter(r => r.slot === selectedSlot);

  // Worker records across all 8 slots for the selected worker (for path display)
  const selectedWorkerHistory = selectedWorkerUid 
    ? records.filter(r => r.workerUid === selectedWorkerUid).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];

  // Group current slot records by JIG
  const workerCountByJig: Record<string, number> = {};
  const workersByJig: Record<string, FactoryGpsRecord[]> = {};
  const awayOrFacilityWorkers: FactoryGpsRecord[] = [];
  currentSlotRecords.forEach(r => {
    if (r.jigId) {
      workerCountByJig[r.jigId] = (workerCountByJig[r.jigId] || 0) + 1;
      if (!workersByJig[r.jigId]) workersByJig[r.jigId] = [];
      workersByJig[r.jigId].push(r);
    } else {
      awayOrFacilityWorkers.push(r);
    }
  });

  // Group unresolved/total delay logs per JIG
  const delayLogsByJig: Record<string, BlockDelayLog[]> = {};
  delayLogs.forEach(l => {
    if (!delayLogsByJig[l.jigId]) delayLogsByJig[l.jigId] = [];
    delayLogsByJig[l.jigId].push(l);
  });

  const southJigs = activeJigs
    .filter(j => j.bay === 'BAY_SOUTH')
    .sort((a, b) => (Math.round(a.y / 120) - Math.round(b.y / 120)) || (a.x - b.x) || a.jigNumber - b.jigNumber);
  const northJigs = activeJigs
    .filter(j => j.bay === 'BAY_NORTH')
    .sort((a, b) => (Math.round(a.y / 120) - Math.round(b.y / 120)) || (a.x - b.x) || a.jigNumber - b.jigNumber);

  const effectiveViewMode = isPrintMode || editingLayout ? 'BLUEPRINT_A3' : viewMode;

  return (
    <div className={`relative w-full overflow-hidden bg-slate-950 text-slate-100 rounded-[2rem] border border-slate-800 shadow-2xl select-none ${isPrintMode ? 'rounded-none border-0 shadow-none' : ''}`}>
      {/* Blueprint Header & Orientation Ribbon */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-blue-400">7공장 내부도</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  2시간 GPS 관제
                </span>
                {calibratedBasis && (
                  <span className="text-[10px] font-mono tabular-nums font-bold text-cyan-300">
                    실측 {calibratedBasis.eastWestLengthMeters}m × {calibratedBasis.northSouthLengthMeters}m · 방위 {calibratedBasis.rotationDeg}°
                  </span>
                )}
              </div>
              <h3 className="text-xs sm:text-base font-black text-white truncate">중형선 7공장 지그 및 블럭 체류 현황</h3>
            </div>
          </div>

          {/* Mobile/CAD Layout Mode Switcher + Drag Layout Studio Toggle */}
          {!isPrintMode && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {allowLayoutEdit && (
                <button
                  type="button"
                  onClick={() => setEditingLayout(!editingLayout)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap ${
                    editingLayout
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/20'
                      : 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>{editingLayout ? '드래그 배치 편집 중' : '블럭 생성·마우스 배치'}</span>
                </button>
              )}

              {!editingLayout && (
                <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('MOBILE_GRID')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                      effectiveViewMode === 'MOBILE_GRID'
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>모바일뷰</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('BLUEPRINT_A3')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                      effectiveViewMode === 'BLUEPRINT_A3'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <MapIcon className="w-3 h-3" />
                    <span>A3 도면</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compass & Directional Indicator Bar */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 bg-slate-950/90 px-4 sm:px-5 py-2 rounded-xl border border-slate-700 overflow-x-auto no-scrollbar shrink-0">
          <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-black whitespace-nowrap tracking-wide">
            <span className="text-amber-300">◀ 동 (E)</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span className="text-amber-300">서 (W) ▶</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span className="text-cyan-300">▲ 남 (S)</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span className="text-blue-300">▼ 북 (N)</span>
          </div>
        </div>
      </div>

      {/* Visual Drag-and-Drop Block Creation & Placement Toolbar (Active when editingLayout === true) */}
      {!isPrintMode && editingLayout && (
        <div className="bg-slate-900/95 border-b border-amber-500/40 px-4 sm:px-6 py-4 space-y-3.5">
          {/* Top Row: Quick Block Creation + Drag-onto-Map Chip */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-black shrink-0">
                <Plus className="w-4 h-4" />
                <span>새 블럭 만들기</span>
              </div>

              <input
                type="text"
                value={newBlockName}
                onChange={e => setNewBlockName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createAndPlaceBlock();
                  }
                }}
                placeholder="블럭명 입력 (예: 4307 E11'C' 또는 2111 블럭)"
                className="w-60 sm:w-72 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-xs font-black text-white placeholder:text-slate-500 outline-none"
              />

              <input
                type="text"
                value={newBlockTeam}
                onChange={e => setNewBlockTeam(e.target.value)}
                placeholder="담당 물량팀"
                className="w-36 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-xs font-bold text-slate-200 placeholder:text-slate-500 outline-none"
              />

              {/* Block Size Presets */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                {BLOCK_SIZE_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setNewBlockPresetId(preset.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      newBlockPresetId === preset.id
                        ? 'bg-cyan-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Draggable Creation Chip */}
              <div
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-new-factory-block', '1');
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                title="이 블럭 칩을 마우스로 끌어 아래 7공장 도면 원하는 위치에 놓으세요"
                className="px-3 py-2 rounded-xl bg-amber-500/15 border border-dashed border-amber-400 text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-amber-500/25 transition-colors whitespace-nowrap"
              >
                <GripVertical className="w-3.5 h-3.5" />
                <span>[{newBlockName.trim() || '새 블럭'}] 도면으로 끌어서 놓기</span>
              </div>

              <button
                type="button"
                onClick={() => createAndPlaceBlock()}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>도면에 추가</span>
              </button>
            </div>

            {/* Save / Revert Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSnapToGrid(s => !s)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  snapToGrid
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>격자 스냅 {snapToGrid ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleAutoArrangeCols(3)}
                className="px-2.5 py-2 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer whitespace-nowrap"
              >
                3열 자동정렬
              </button>

              <button
                type="button"
                onClick={() => handleAutoArrangeCols(4)}
                className="px-2.5 py-2 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer whitespace-nowrap"
              >
                4열 자동정렬
              </button>

              <button
                type="button"
                onClick={handleDiscardLayout}
                disabled={!hasUnsavedLayoutChanges || isSavingLayout}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>되돌리기</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingLayout(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>

              <button
                type="button"
                onClick={handleCommitLayout}
                disabled={isSavingLayout}
                className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-lg shadow-emerald-500/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingLayout ? '저장 중...' : hasUnsavedLayoutChanges ? '배치 저장하기 *' : '배치 저장'}</span>
              </button>
            </div>
          </div>

          {/* Second Row: Selected Block Quick Rename & Delete Bar */}
          {selectedDraftJig ? (
            <div className="pt-3 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <span className="text-[11px] font-black text-cyan-400 whitespace-nowrap">
                  선택 블럭 편집:
                </span>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <span>정반</span>
                  <input
                    type="text"
                    value={selectedDraftJig.jigName}
                    onChange={e => handleUpdateDraftField(selectedDraftJig.id, { jigName: e.target.value })}
                    className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-black text-white outline-none focus:border-cyan-400"
                  />
                </label>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <span>블럭명</span>
                  <input
                    type="text"
                    value={selectedDraftJig.blockName}
                    onChange={e => handleUpdateDraftField(selectedDraftJig.id, { blockName: e.target.value })}
                    className="w-40 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-black text-cyan-300 outline-none focus:border-cyan-400"
                  />
                </label>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <span>공정</span>
                  <input
                    type="text"
                    value={selectedDraftJig.blockType}
                    onChange={e => handleUpdateDraftField(selectedDraftJig.id, { blockType: e.target.value })}
                    className="w-44 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 outline-none focus:border-cyan-400"
                  />
                </label>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <span>담당팀</span>
                  <input
                    type="text"
                    value={selectedDraftJig.assignedTeam}
                    onChange={e => handleUpdateDraftField(selectedDraftJig.id, { assignedTeam: e.target.value })}
                    className="w-36 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 outline-none focus:border-cyan-400"
                  />
                </label>

                <span className="text-[11px] font-bold text-amber-300 font-mono tabular-nums">
                  {selectedDraftJig.bay === 'BAY_SOUTH' ? '남측 (BAY A)' : '북측 (BAY B)'}
                  {' · '}
                  {selectedDraftJig.x < 450 ? '동측' : selectedDraftJig.x > 880 ? '서측' : '중앙'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDuplicateDraftJig(selectedDraftJig)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>복제</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDraftJig(selectedDraftJig.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-bold text-rose-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-medium">
              도면 위 블럭을 마우스로 클릭하고 끌어 이동하거나, 우측 하단 모서리(↘)를 끌어 크기를 조절하세요.
            </p>
          )}
        </div>
      )}

      {/* Heatmap Overlay Control Bar & Top Concentrated Zones Strip (hidden during layout drag edit mode) */}
      {!isPrintMode && !editingLayout && (
        <div className="bg-slate-900/75 border-b border-slate-800 px-4 sm:px-6 py-3 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Left controls: Heatmap toggle + 2H Window aggregation */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHeatmap(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  showHeatmap
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>체류 히트맵 {showHeatmap ? 'ON' : 'OFF'}</span>
              </button>

              {showHeatmap && (
                <>
                  {/* Aggregation Mode Switcher */}
                  <div className="flex items-center bg-slate-950/90 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setHeatmapMode('2H_WINDOW')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        heatmapMode === '2H_WINDOW' ? 'bg-orange-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      2시간 구간
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeatmapMode('SINGLE_SLOT')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        heatmapMode === 'SINGLE_SLOT' ? 'bg-orange-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      선택 시점 ({selectedSlot})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeatmapMode('FULL_DAY')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        heatmapMode === 'FULL_DAY' ? 'bg-orange-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      당일 전체 누적
                    </button>
                  </div>

                  {/* 2-Hour Block Selector */}
                  {heatmapMode === '2H_WINDOW' && (
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {TWO_HOUR_WINDOWS.map(w => {
                        const active = activeWindowId === w.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              setActiveWindowId(w.id);
                              if (onSelectSlot && !w.slots.includes(selectedSlot)) {
                                onSelectSlot(w.slots[0]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono tabular-nums font-bold border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                              active
                                ? 'bg-amber-400 text-slate-950 border-amber-300'
                                : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                            }`}
                          >
                            {w.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setShowPins(prev => !prev)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                {showPins ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                <span>작업자 핀 {showPins ? '표시' : '숨김'}</span>
              </button>
            </div>

            {/* Right: Color Density Legend (Color + Text Label, Zero-Pill) */}
            {showHeatmap && (
              <div className="flex items-center gap-3 text-[11px] text-slate-300 overflow-x-auto no-scrollbar">
                <span className="text-slate-400 font-bold shrink-0">밀집도 기준:</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 border border-slate-600 inline-block" />
                  미투입
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
                  저밀도
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  보통 체류
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" />
                  고밀도 집중
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  최고 집중
                </span>
              </div>
            )}
          </div>

          {/* Concentrated Zones Summary Strip */}
          {showHeatmap && (
            <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="font-bold text-orange-400">{heatmap.windowLabel}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>
                    감지 <strong className="font-mono tabular-nums text-white">{heatmap.totalUniqueWorkers}명</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>
                    총 체류 <strong className="font-mono tabular-nums text-white">{formatMinutesToKorean(heatmap.totalDwellMinutes)}</strong>
                  </span>
                  {heatmap.topZone && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>
                        최다 집중: <strong className="text-rose-400">{heatmap.topZone.zoneName} ({heatmap.topZone.subLabel})</strong>{' '}
                        <span className="font-mono tabular-nums text-slate-200">
                          {formatMinutesToKorean(heatmap.topZone.totalMinutes)} / {heatmap.topZone.workerCount}명
                        </span>
                      </span>
                    </>
                  )}
                </div>
                {heatmap.nonWorkDwellMinutes > 0 && (
                  <span className="text-[11px] font-bold text-amber-300 font-mono tabular-nums">
                    비작업(휴게·통로·타구역) 체류: {formatMinutesToKorean(heatmap.nonWorkDwellMinutes)}
                  </span>
                )}
              </div>

              {/* Ranked Zone Concentration Bars */}
              {heatmap.zones.some(z => z.totalMinutes > 0) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {heatmap.zones
                    .filter(z => z.totalMinutes > 0)
                    .slice(0, 5)
                    .map((zone: ZoneDwellMetric, idx: number) => {
                      const colors = getHeatmapColors(zone.level);
                      const matchingJig = jigs.find(j => j.id === zone.zoneId);
                      return (
                        <button
                          key={zone.zoneId}
                          type="button"
                          onClick={() => matchingJig && onSelectJig && onSelectJig(matchingJig)}
                          className="text-left bg-slate-950/75 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-black text-white truncate">
                              {idx + 1}. {zone.zoneName} · {zone.zoneType === 'JIG' ? zone.subLabel : zone.levelLabel}
                            </span>
                            <span className={`font-mono tabular-nums font-black shrink-0 ${colors.textClass}`}>
                              {zone.sharePercent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${colors.barClass}`}
                              style={{ width: `${Math.max(8, Math.round(zone.intensity * 100))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                            <span>{zone.workerCount}명 체류</span>
                            <span className="text-slate-200 font-bold">{formatMinutesToKorean(zone.totalMinutes)}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 font-medium">
                  선택한 시간 구간에 기록된 위치 데이터가 없습니다. 상단에서 다른 시간대를 선택하거나 모의 데이터를 생성하세요.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= MODE 1: MOBILE-FIRST VERTICAL CARD INTERIOR LAYOUT ================= */}
      {effectiveViewMode === 'MOBILE_GRID' ? (
        <div className="p-3 sm:p-5 bg-[#080d1a] space-y-3.5">
          {/* South Perimeter & Top Facilities */}
          <div className="flex flex-col gap-2">
            <div className="text-center py-2 px-4 rounded-xl bg-slate-900 border border-cyan-500/50 text-sm sm:text-base font-black text-cyan-300 tracking-wide">
              ▲ 남 (SOUTH) · BAY A / 안벽 방면 ▲
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-2 flex items-center justify-between">
                <span className="font-black text-sky-400">물량팀 휴게실</span>
                <span className="text-slate-300 font-mono tabular-nums font-bold">
                  {awayOrFacilityWorkers.filter(w => w.locationType === 'REST_AREA').length}명
                  {showHeatmap && heatmap.zoneMap['rest_area']?.totalMinutes
                    ? ` · ${formatMinutesToKorean(heatmap.zoneMap['rest_area'].totalMinutes)}`
                    : ''}
                </span>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 flex items-center justify-between">
                <span className="font-black text-emerald-400">안전실/화장실</span>
                <span className="text-slate-300 font-mono tabular-nums font-bold">
                  {awayOrFacilityWorkers.filter(w => w.locationType === 'RESTROOM').length}명
                  {showHeatmap && heatmap.zoneMap['safety_office']?.totalMinutes
                    ? ` · ${formatMinutesToKorean(heatmap.zoneMap['safety_office'].totalMinutes)}`
                    : ''}
                </span>
              </div>
            </div>
          </div>

          {/* BAY A (남측 라인) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-cyan-400 tracking-tight">
                [ BAY A - 남측 대조립 지그 ]
              </span>
              <span className="text-xs sm:text-sm text-amber-300 font-black">◀ 동(E) · 서(W) ▶</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {southJigs.map(jig => {
                const isSelected = selectedJigId === jig.id;
                const jigWorkers = workersByJig[jig.id] || [];
                const jigDelays = delayLogsByJig[jig.id] || [];
                const unresolvedDelays = jigDelays.filter(d => !d.resolved);
                const delayCount = unresolvedDelays.length || jig.delayLogCount || 0;
                const progress = jig.currentProgress ?? jig.progressPercent ?? 0;
                const heatMetric = heatmap.zoneMap[jig.id];
                const heatColors = heatMetric ? getHeatmapColors(heatMetric.level) : null;
                const hasHeat = showHeatmap && heatMetric && heatMetric.totalMinutes > 0;

                return (
                  <div
                    key={jig.id}
                    onClick={() => onSelectJig && onSelectJig(jig)}
                    style={
                      hasHeat && heatColors && !isSelected
                        ? {
                            backgroundColor: heatColors.tintBg,
                            borderColor: heatColors.border
                          }
                        : undefined
                    }
                    className={`rounded-2xl border p-2.5 space-y-2 transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-400 ring-2 ring-cyan-400/30'
                        : hasHeat
                        ? 'hover:brightness-110'
                        : delayCount > 0 || jig.latestDelayReason
                        ? 'bg-[#170f18] border-rose-500/40 hover:border-rose-400'
                        : 'bg-[#0e1729] border-slate-800 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                        {jig.jigName}
                      </span>
                      <span className={`text-[10px] font-black font-mono tabular-nums ${jigWorkers.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {jigWorkers.length > 0 ? `● ${jigWorkers.length}명` : '○ 대기'}
                      </span>
                    </div>

                    <div className="bg-slate-950/90 border border-cyan-500/40 rounded-xl py-1.5 px-2 text-center">
                      <p className="text-sm font-black text-cyan-300 tracking-tight truncate">{jig.blockName}</p>
                      <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{jig.assignedTeam}</p>
                    </div>

                    {showHeatmap && heatMetric && (
                      <div className="flex items-center justify-between text-[10px] px-1 pt-0.5">
                        <span className={`font-black ${heatColors?.textClass || 'text-slate-400'}`}>
                          {heatMetric.levelLabel}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-slate-200">
                          {heatMetric.totalMinutes > 0
                            ? `${formatMinutesToKorean(heatMetric.totalMinutes)} (${heatMetric.workerCount}명)`
                            : '0분'}
                        </span>
                      </div>
                    )}

                    {/* Critical Delay Alert Pill */}
                    {(delayCount > 0 || jig.latestDelayReason) && (
                      <div className="bg-rose-500/15 border border-rose-500/30 rounded-lg px-2 py-1 text-[9.5px] text-rose-300 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">
                          {jig.latestDelayReason || `${delayCount}건 지연사유`}
                        </span>
                      </div>
                    )}

                    {/* Progress & Dates */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-amber-400 font-mono">
                          {jig.startDate ? jig.startDate.slice(5) : '11-03'}~{jig.endDate ? jig.endDate.slice(5) : '11-12'}
                        </span>
                        <span className="text-cyan-400 font-black font-mono tabular-nums">{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${delayCount > 0 ? 'bg-rose-500' : 'bg-cyan-400'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {jig.centerLat && jig.centerLng && (
                        <div className="flex items-center justify-between text-[9px] font-mono tabular-nums text-slate-400 pt-0.5">
                          <span className="truncate">{jig.centerLat.toFixed(5)}, {jig.centerLng.toFixed(5)}</span>
                          <span className="text-emerald-400 font-bold shrink-0">±{jig.gpsRadiusMeters || 12}m</span>
                        </div>
                      )}
                    </div>

                    {/* Live Workers Inside This Block */}
                    {showPins && jigWorkers.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80 flex flex-wrap gap-1">
                        {jigWorkers.map(w => {
                          const isWSelected = selectedWorkerUid === w.workerUid;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectWorker && onSelectWorker(isWSelected ? null : w.workerUid);
                              }}
                              className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black flex items-center gap-1 border transition-all cursor-pointer ${
                                isWSelected
                                  ? 'bg-cyan-500 text-slate-950 border-white'
                                  : w.status === 'NORMAL'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${w.status === 'NORMAL' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              {w.workerName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Non-block / Away Workers Strip (Only shown if workers exist outside blocks) */}
          {awayOrFacilityWorkers.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-300">
                <span>◀ 동측 반입문</span>
                <span>블럭 외 체류 · 이동 인원 ({selectedSlot})</span>
                <span>서측 반출문 ▶</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {awayOrFacilityWorkers.map(w => {
                  const isWSelected = selectedWorkerUid === w.workerUid;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onSelectWorker && onSelectWorker(isWSelected ? null : w.workerUid)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 cursor-pointer ${
                        isWSelected
                          ? 'bg-cyan-500 text-slate-950 border-white'
                          : w.status === 'RESTING'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      <span>{w.workerName}</span>
                      <span className="text-[8.5px] opacity-80">({w.status === 'RESTING' ? '휴게' : '이탈'})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* BAY B (북측 라인) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-blue-400 tracking-tight">
                [ BAY B - 북측 특수/의장 지그 ]
              </span>
              <span className="text-xs sm:text-sm text-amber-300 font-black">◀ 동(E) · 서(W) ▶</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {northJigs.map(jig => {
                const isSelected = selectedJigId === jig.id;
                const jigWorkers = workersByJig[jig.id] || [];
                const jigDelays = delayLogsByJig[jig.id] || [];
                const unresolvedDelays = jigDelays.filter(d => !d.resolved);
                const delayCount = unresolvedDelays.length || jig.delayLogCount || 0;
                const progress = jig.currentProgress ?? jig.progressPercent ?? 0;
                const heatMetric = heatmap.zoneMap[jig.id];
                const heatColors = heatMetric ? getHeatmapColors(heatMetric.level) : null;
                const hasHeat = showHeatmap && heatMetric && heatMetric.totalMinutes > 0;

                return (
                  <div
                    key={jig.id}
                    onClick={() => onSelectJig && onSelectJig(jig)}
                    style={
                      hasHeat && heatColors && !isSelected
                        ? {
                            backgroundColor: heatColors.tintBg,
                            borderColor: heatColors.border
                          }
                        : undefined
                    }
                    className={`rounded-2xl border p-2.5 space-y-2 transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-400 ring-2 ring-cyan-400/30'
                        : hasHeat
                        ? 'hover:brightness-110'
                        : delayCount > 0 || jig.latestDelayReason
                        ? 'bg-[#170f18] border-rose-500/40 hover:border-rose-400'
                        : 'bg-[#0e1729] border-slate-800 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                        {jig.jigName}
                      </span>
                      <span className={`text-[10px] font-black font-mono tabular-nums ${jigWorkers.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {jigWorkers.length > 0 ? `● ${jigWorkers.length}명` : '○ 대기'}
                      </span>
                    </div>

                    <div className="bg-slate-950/90 border border-blue-500/40 rounded-xl py-1.5 px-2 text-center">
                      <p className="text-sm font-black text-blue-300 tracking-tight truncate">{jig.blockName}</p>
                      <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{jig.assignedTeam}</p>
                    </div>

                    {showHeatmap && heatMetric && (
                      <div className="flex items-center justify-between text-[10px] px-1 pt-0.5">
                        <span className={`font-black ${heatColors?.textClass || 'text-slate-400'}`}>
                          {heatMetric.levelLabel}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-slate-200">
                          {heatMetric.totalMinutes > 0
                            ? `${formatMinutesToKorean(heatMetric.totalMinutes)} (${heatMetric.workerCount}명)`
                            : '0분'}
                        </span>
                      </div>
                    )}

                    {(delayCount > 0 || jig.latestDelayReason) && (
                      <div className="bg-rose-500/15 border border-rose-500/30 rounded-lg px-2 py-1 text-[9.5px] text-rose-300 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">
                          {jig.latestDelayReason || `${delayCount}건 지연사유`}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-amber-400 font-mono">
                          {jig.startDate ? jig.startDate.slice(5) : '11-03'}~{jig.endDate ? jig.endDate.slice(5) : '11-12'}
                        </span>
                        <span className="text-blue-400 font-black font-mono tabular-nums">{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${delayCount > 0 ? 'bg-rose-500' : 'bg-blue-400'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {jig.centerLat && jig.centerLng && (
                        <div className="flex items-center justify-between text-[9px] font-mono tabular-nums text-slate-400 pt-0.5">
                          <span className="truncate">{jig.centerLat.toFixed(5)}, {jig.centerLng.toFixed(5)}</span>
                          <span className="text-emerald-400 font-bold shrink-0">±{jig.gpsRadiusMeters || 12}m</span>
                        </div>
                      )}
                    </div>

                    {showPins && jigWorkers.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80 flex flex-wrap gap-1">
                        {jigWorkers.map(w => {
                          const isWSelected = selectedWorkerUid === w.workerUid;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectWorker && onSelectWorker(isWSelected ? null : w.workerUid);
                              }}
                              className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black flex items-center gap-1 border transition-all cursor-pointer ${
                                isWSelected
                                  ? 'bg-cyan-500 text-slate-950 border-white'
                                  : w.status === 'NORMAL'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${w.status === 'NORMAL' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              {w.workerName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Facilities & North Perimeter */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2 font-black text-amber-400 truncate">
                📦 공구 및 용접기자재실
              </div>
              <div className="bg-violet-950/40 border border-violet-500/30 rounded-xl p-2 font-black text-violet-400 truncate text-right">
                📦 완성 블럭 검사대기장
              </div>
            </div>
            <div className="text-center py-2 px-4 rounded-xl bg-slate-900 border border-blue-500/50 text-sm sm:text-base font-black text-blue-300 tracking-wide">
              ▼ 북 (NORTH) · BAY B / 원자재 반입 방면 ▼
            </div>
          </div>
        </div>
      ) : (
        /* ================= MODE 2: A3 LANDSCAPE CAD BLUEPRINT SVG ================= */
        <div
          className={`overflow-x-auto bg-[#0a0f1d] ${
            editingLayout && isDragHoveringCanvas ? 'ring-2 ring-inset ring-amber-400 bg-slate-900/60' : ''
          }`}
          onDragOver={e => {
            if (!editingLayout) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDragHoveringCanvas(true);
          }}
          onDragLeave={() => setIsDragHoveringCanvas(false)}
          onDrop={e => {
            if (!editingLayout) return;
            e.preventDefault();
            setIsDragHoveringCanvas(false);
            const pt = clientToSvgPoint(e.clientX, e.clientY);
            createAndPlaceBlock(pt);
          }}
        >
          <div className="relative min-w-[760px] w-full aspect-[1414/1000] p-4 sm:p-6 bg-[#0a0f1d] overflow-hidden">
            {editingLayout && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1 rounded-full bg-amber-400/95 text-slate-950 text-[11px] font-black shadow-lg">
                마우스로 블럭을 끌어 이동 · 우측하단 모서리(↘) 드래그로 크기 조절 · 상단 [배치 저장하기] 필수
              </div>
            )}
            <svg
              ref={svgRef}
              viewBox="0 0 1414 1000"
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerCancel={handleSvgPointerUp}
              className={`w-full h-full drop-shadow-2xl ${editingLayout ? 'touch-none' : ''}`}
              style={{ shapeRendering: 'geometricPrecision' }}
            >
          <defs>
            {/* Grid pattern */}
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
            </pattern>
            {/* Edit mode snap grid */}
            <pattern id="editSnapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.14)" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="0" cy="0" r="1.5" fill="rgba(56, 189, 248, 0.35)" />
            </pattern>
            {/* Steel Jig Grid */}
            <pattern id="jigGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" />
            </pattern>
            {/* Glow filters */}
            <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Thermal Heatmap Radial Gradients */}
            <radialGradient id="heatPeak" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.82" />
              <stop offset="45%" stopColor="#f97316" stopOpacity="0.45" />
              <stop offset="80%" stopColor="#f59e0b" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatHigh" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.72" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatMedium" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatLow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.52" />
              <stop offset="65%" stopColor="#0ea5e9" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </radialGradient>
            <filter id="heatBlur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>

          {/* Background Grid */}
          <rect width="1414" height="1000" fill="#060913" />
          <rect width="1414" height="1000" fill={editingLayout ? 'url(#editSnapGrid)' : 'url(#gridPattern)'} />

          {/* Outer Workshop Perimeter Walls */}
          <rect
            x="20"
            y="20"
            width="1374"
            height="960"
            fill="none"
            stroke="#1e293b"
            strokeWidth="4"
            rx="16"
          />

          {/* Factory Cardinal Direction Signboards (High-Contrast Upright Plates) */}
          {/* Top: South (남) */}
          <g transform="translate(707, 36)" pointerEvents="none">
            <rect
              x="-270"
              y="-22"
              width="540"
              height="44"
              fill="#0b182e"
              fillOpacity="0.96"
              rx="10"
              stroke="#38bdf8"
              strokeWidth="2.2"
            />
            <text x="0" y="7" textAnchor="middle" fontWeight="900">
              <tspan fill="#38bdf8" fontSize="22">▲ 남 (SOUTH)</tspan>
              <tspan fill="#475569" fontSize="16">  ·  </tspan>
              <tspan fill="#e0f2fe" fontSize="14" fontWeight="700">
                {calibration?.south?.lat
                  ? `${calibration.south.lat.toFixed(5)}, ${calibration.south.lng.toFixed(5)}`
                  : 'BAY A · 안벽 방면'}
              </tspan>
            </text>
          </g>

          {/* Bottom: North (북) */}
          <g transform="translate(707, 964)" pointerEvents="none">
            <rect
              x="-270"
              y="-22"
              width="540"
              height="44"
              fill="#0f172a"
              fillOpacity="0.96"
              rx="10"
              stroke="#60a5fa"
              strokeWidth="2.2"
            />
            <text x="0" y="7" textAnchor="middle" fontWeight="900">
              <tspan fill="#93c5fd" fontSize="22">▼ 북 (NORTH)</tspan>
              <tspan fill="#475569" fontSize="16">  ·  </tspan>
              <tspan fill="#e2e8f0" fontSize="14" fontWeight="700">
                {calibration?.north?.lat
                  ? `${calibration.north.lat.toFixed(5)}, ${calibration.north.lng.toFixed(5)}`
                  : 'BAY B · 원자재 반입 방면'}
              </tspan>
            </text>
          </g>

          {/* Left: East (동) - Upright Architectural Plaque */}
          <g transform="translate(18, 442)" pointerEvents="none">
            <rect
              x="0"
              y="0"
              width="108"
              height="116"
              fill="#0f172a"
              fillOpacity="0.96"
              rx="12"
              stroke="#f59e0b"
              strokeWidth="2.5"
            />
            <rect x="0" y="18" width="6" height="80" fill="#f59e0b" rx="3" />
            <text x="56" y="44" textAnchor="middle" fill="#fbbf24" fontSize="28" fontWeight="900">
              ◀ 동
            </text>
            <text x="56" y="68" textAnchor="middle" fill="#fde68a" fontSize="13.5" fontWeight="900" letterSpacing="2">
              EAST
            </text>
            <line x1="18" y1="80" x2="90" y2="80" stroke="#334155" strokeWidth="1" />
            <text x="56" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="800">
              {calibration?.east?.lat ? calibration.east.lat.toFixed(4) : '반입문 (E)'}
            </text>
          </g>

          {/* Right: West (서) - Upright Architectural Plaque */}
          <g transform="translate(1288, 442)" pointerEvents="none">
            <rect
              x="0"
              y="0"
              width="108"
              height="116"
              fill="#0f172a"
              fillOpacity="0.96"
              rx="12"
              stroke="#f59e0b"
              strokeWidth="2.5"
            />
            <rect x="102" y="18" width="6" height="80" fill="#10b981" rx="3" />
            <text x="52" y="44" textAnchor="middle" fill="#fbbf24" fontSize="28" fontWeight="900">
              서 ▶
            </text>
            <text x="52" y="68" textAnchor="middle" fill="#fde68a" fontSize="13.5" fontWeight="900" letterSpacing="2">
              WEST
            </text>
            <line x1="18" y1="80" x2="90" y2="80" stroke="#334155" strokeWidth="1" />
            <text x="52" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="800">
              {calibration?.west?.lat ? calibration.west.lat.toFixed(4) : '반출문 (W)'}
            </text>
          </g>

          {/* Facilities (휴게실, 공구실, 안전관리실, 검사장) */}
          {FACTORY_FACILITIES.map(fac => {
            const facHeat = heatmap.zoneMap[fac.id];
            const facColors = facHeat ? getHeatmapColors(facHeat.level) : null;
            const hasFacHeat = showHeatmap && facHeat && facHeat.totalMinutes > 0;

            return (
              <g key={fac.id} transform={`translate(${fac.x}, ${fac.y})`}>
                <rect
                  width={fac.width}
                  height={fac.height}
                  fill={hasFacHeat && facColors ? facColors.tintBg : '#0f172a'}
                  stroke={hasFacHeat && facColors ? facColors.border : fac.color}
                  strokeWidth={hasFacHeat ? '2.5' : '2'}
                  strokeDasharray="4 2"
                  rx="12"
                />
                <rect
                  x="4"
                  y="4"
                  width={fac.width - 8}
                  height="22"
                  fill={`${fac.color}25`}
                  rx="8"
                />
                <text
                  x={fac.width / 2}
                  y="18"
                  textAnchor="middle"
                  fill={fac.color}
                  fontSize="9"
                  fontWeight="900"
                >
                  {fac.type === 'REST_AREA' ? '휴게구역' : fac.type === 'RESTROOM' ? '관리/화장실' : '자재/검사'}
                </text>
                <text
                  x={fac.width / 2}
                  y={fac.height / 2 + 4}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="10"
                  fontWeight="800"
                >
                  {fac.name.split(' ')[0]}
                </text>
                <text
                  x={fac.width / 2}
                  y={fac.height / 2 + 18}
                  textAnchor="middle"
                  fill={hasFacHeat && facColors ? facColors.hex : '#94a3b8'}
                  fontSize="8.5"
                  fontWeight="800"
                >
                  {hasFacHeat
                    ? `${formatMinutesToKorean(facHeat.totalMinutes)} (${facHeat.workerCount}명)`
                    : fac.name.split(' ').slice(1).join(' ')}
                </text>
              </g>
            );
          })}

          {/* Bay Headers */}
          <g transform="translate(180, 140)">
            <text x="0" y="0" fill="#38bdf8" fontSize="12" fontWeight="900" letterSpacing="1">
              [ BAY A - 남측 라인 : 선체 저판 및 외판 대조립 지그 구역 ]
            </text>
          </g>
          <g transform="translate(180, 595)">
            <text x="0" y="0" fill="#38bdf8" fontSize="12" fontWeight="900" letterSpacing="1">
              [ BAY B - 북측 라인 : 탱크, 선수/선미 특수 조립 및 선행의장 지그 구역 ]
            </text>
          </g>

          {/* Smart Magnetic Alignment Guides (Visible while dragging) */}
          {editingLayout && alignGuides.x !== undefined && (
            <line
              x1={alignGuides.x}
              y1="40"
              x2={alignGuides.x}
              y2="960"
              stroke="#22d3ee"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}
          {editingLayout && alignGuides.y !== undefined && (
            <line
              x1="40"
              y1={alignGuides.y}
              x2="1374"
              y2={alignGuides.y}
              stroke="#22d3ee"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}

          {/* JIGS (지그 및 블럭 + 히트맵 존 틴트 + 드래그 배치 편집) */}
          {activeJigs.map(jig => {
            const isSelected = editingLayout ? editingBlockId === jig.id : selectedJigId === jig.id;
            const isDraggingThis = editingLayout && activeDragJigId === jig.id;
            const isHovered = hoveredJig?.id === jig.id;
            const workerCount = workerCountByJig[jig.id] || 0;
            const jigDelayCount = (delayLogsByJig[jig.id] || []).length || jig.delayLogCount || 0;
            const heatMetric = heatmap.zoneMap[jig.id];
            const heatColors = heatMetric ? getHeatmapColors(heatMetric.level) : null;
            const hasHeat = !editingLayout && showHeatmap && heatMetric && heatMetric.totalMinutes > 0;
            const isTopHotspot = heatmap.topZone?.zoneId === jig.id && hasHeat;
            const pillW = Math.min(140, Math.max(84, jig.width - 24));
            const compactHeight = jig.height < 165;

            return (
              <g
                key={jig.id}
                transform={`translate(${jig.x}, ${jig.y})`}
                className={
                  editingLayout
                    ? isDraggingThis
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                    : 'cursor-pointer transition-all duration-200'
                }
                onPointerDown={e => editingLayout && handleJigPointerDown(e, jig, 'MOVE')}
                onClick={() => {
                  if (editingLayout) {
                    setEditingBlockId(jig.id);
                  } else if (onSelectJig) {
                    onSelectJig(jig);
                  }
                }}
                onMouseEnter={() => !editingLayout && setHoveredJig(jig)}
                onMouseLeave={() => !editingLayout && setHoveredJig(null)}
              >
                {/* JIG Base Plate */}
                <rect
                  width={jig.width}
                  height={jig.height}
                  fill={isSelected ? '#1e293b' : hasHeat && heatColors ? heatColors.tintBg : jigDelayCount > 0 ? '#180d16' : '#0c1322'}
                  stroke={
                    isDraggingThis
                      ? '#fbbf24'
                      : isSelected
                      ? '#38bdf8'
                      : editingLayout
                      ? '#3b82f6'
                      : hasHeat && heatColors
                      ? heatColors.border
                      : jigDelayCount > 0
                      ? '#f43f5e'
                      : isHovered
                      ? '#60a5fa'
                      : '#1e3a5f'
                  }
                  strokeWidth={isSelected ? '3.5' : isTopHotspot ? '3' : isHovered || editingLayout ? '2.5' : '1.5'}
                  strokeDasharray={editingLayout && isSelected ? '6 3' : undefined}
                  rx="12"
                />

                {/* Steel Jig Internal Grid */}
                <rect
                  x="8"
                  y="8"
                  width={Math.max(20, jig.width - 16)}
                  height={Math.max(20, jig.height - 16)}
                  fill="url(#jigGrid)"
                  rx="8"
                />

                {/* Ship Block Silhouette Representation */}
                <rect
                  x="16"
                  y="42"
                  width={Math.max(20, jig.width - 32)}
                  height={Math.max(30, jig.height - 76)}
                  fill={hasHeat && heatColors ? heatColors.tintBg : '#172554'}
                  stroke={hasHeat && heatColors ? heatColors.border : '#2563eb'}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  rx="6"
                  opacity="0.82"
                />

                {/* JIG Header Badge */}
                <rect
                  x="10"
                  y="10"
                  width={Math.max(20, jig.width - 20)}
                  height="26"
                  fill={isSelected ? '#0284c7' : jigDelayCount > 0 ? '#881337' : '#1e293b'}
                  rx="6"
                />
                <text
                  x="18"
                  y="27"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="900"
                  letterSpacing="0.5"
                >
                  {jig.jigName}{!editingLayout && jigDelayCount > 0 ? ` · 지연${jigDelayCount}` : ''}
                </text>
                <text
                  x={jig.width - 18}
                  y="27"
                  textAnchor="end"
                  fill={
                    editingLayout
                      ? '#fbbf24'
                      : hasHeat && heatColors
                      ? '#ffffff'
                      : workerCount > 0
                      ? '#4ade80'
                      : '#94a3b8'
                  }
                  fontSize="10"
                  fontWeight="900"
                >
                  {editingLayout
                    ? '⠿ 이동'
                    : hasHeat
                    ? `${formatMinutesToKorean(heatMetric.totalMinutes)} (${heatMetric.workerCount}명)`
                    : workerCount > 0
                    ? `● ${workerCount}명 작업 중`
                    : '○ 미작업'}
                </text>

                {/* PROMINENT SHIP BLOCK CODE */}
                <g transform={`translate(${jig.width / 2}, ${jig.height / 2 - (compactHeight ? 0 : 6)})`}>
                  <rect
                    x={-pillW / 2}
                    y="-19"
                    width={pillW}
                    height="38"
                    fill="#0f172a"
                    stroke={isDraggingThis ? '#fbbf24' : hasHeat && heatColors ? heatColors.border : '#38bdf8'}
                    strokeWidth="2"
                    rx="8"
                  />
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize={jig.blockName.length > 9 ? '12.5' : '15'}
                    fontWeight="900"
                    letterSpacing="0.5"
                  >
                    {jig.blockName}
                  </text>
                </g>

                {/* Block Type / Heatmap Dwell Status Subtitle */}
                {!compactHeight && (
                  <text
                    x={jig.width / 2}
                    y={jig.height / 2 + 26}
                    textAnchor="middle"
                    fill={hasHeat && heatColors ? heatColors.border : '#cbd5e1'}
                    fontSize="9.5"
                    fontWeight="800"
                  >
                    {hasHeat
                      ? `${heatMetric.levelLabel} · 점유 ${heatMetric.sharePercent}%`
                      : jig.blockType}
                  </text>
                )}

                {/* Schedule Dates & Target Days */}
                {!compactHeight && (
                  <text
                    x={jig.width / 2}
                    y={jig.height / 2 + 40}
                    textAnchor="middle"
                    fill="#f59e0b"
                    fontSize="8.5"
                    fontWeight="900"
                  >
                    {jig.startDate ? jig.startDate.slice(5) : '11.03'}~{jig.endDate ? jig.endDate.slice(5) : '11.12'} ({jig.targetDays || 10}일 공정)
                  </text>
                )}

                {/* Auto-Calibrated GPS Center Coordinates (when registered & not editing) */}
                {!editingLayout && !compactHeight && jig.centerLat && jig.centerLng && (
                  <text
                    x={jig.width / 2}
                    y={jig.height / 2 + 53}
                    textAnchor="middle"
                    fill="#34d399"
                    fontSize="8"
                    fontWeight="800"
                  >
                    {jig.centerLat.toFixed(5)}, {jig.centerLng.toFixed(5)} (±{jig.gpsRadiusMeters || 12}m)
                  </text>
                )}

                {/* Assigned Team & Progress Bar */}
                <text
                  x="16"
                  y={jig.height - 23}
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="700"
                >
                  {jig.assignedTeam}
                </text>
                
                {/* Mini Progress track */}
                <rect
                  x="16"
                  y={jig.height - 16}
                  width={Math.max(20, jig.width - 32)}
                  height="6"
                  fill="#1e293b"
                  rx="3"
                />
                <rect
                  x="16"
                  y={jig.height - 16}
                  width={(Math.max(20, jig.width - 32) * (jig.currentProgress ?? jig.progressPercent ?? 0)) / 100}
                  height="6"
                  fill={jigDelayCount > 0 ? '#f43f5e' : '#38bdf8'}
                  rx="3"
                />

                {/* Interactive Corner Resize Handle & Delete Button in Edit Mode */}
                {editingLayout && isSelected && (
                  <>
                    {/* Bottom-Right Resize Grip */}
                    <g
                      transform={`translate(${jig.width - 20}, ${jig.height - 20})`}
                      className="cursor-nwse-resize"
                      onPointerDown={e => handleJigPointerDown(e, jig, 'RESIZE')}
                    >
                      <rect x="0" y="0" width="20" height="20" fill="#fbbf24" rx="5" />
                      <path d="M 6 14 L 14 14 L 14 6 M 10 14 L 14 10" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
                    </g>

                    {/* Top-Right Quick Delete Handle */}
                    <g
                      transform={`translate(${jig.width - 6}, -6)`}
                      className="cursor-pointer"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteDraftJig(jig.id);
                      }}
                    >
                      <circle r="11" fill="#e11d48" stroke="#ffffff" strokeWidth="1.5" />
                      <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                    </g>
                  </>
                )}
              </g>
            );
          })}

          {/* Spatial Thermal Gaussian Heatmap Overlay Layer */}
          {!editingLayout && showHeatmap && heatmap.filteredRecords.length > 0 && (
            <g pointerEvents="none">
              {/* Zone cluster glow cores */}
              {heatmap.zones
                .filter(z => z.totalMinutes > 0 && z.zoneType !== 'AISLE')
                .map(zone => {
                  const gradId =
                    zone.level === 'PEAK'
                      ? 'url(#heatPeak)'
                      : zone.level === 'HIGH'
                      ? 'url(#heatHigh)'
                      : zone.level === 'MEDIUM'
                      ? 'url(#heatMedium)'
                      : 'url(#heatLow)';
                  const cx = zone.x + zone.width / 2;
                  const cy = zone.y + zone.height / 2;
                  const radius = Math.max(zone.width, zone.height) * (0.48 + zone.intensity * 0.28);
                  return (
                    <circle
                      key={`zone-heat-${zone.zoneId}`}
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={gradId}
                      filter="url(#heatBlur)"
                      opacity={0.45 + zone.intensity * 0.35}
                    />
                  );
                })}

              {/* Individual worker GPS coordinate thermal blobs */}
              {heatmap.filteredRecords.map((rec, i) => {
                const zoneMetric = rec.jigId ? heatmap.zoneMap[rec.jigId] : undefined;
                const blobGrad =
                  zoneMetric?.level === 'PEAK'
                    ? 'url(#heatPeak)'
                    : zoneMetric?.level === 'HIGH' || rec.status === 'AWAY'
                    ? 'url(#heatHigh)'
                    : zoneMetric?.level === 'MEDIUM'
                    ? 'url(#heatMedium)'
                    : 'url(#heatLow)';
                const mins = rec.stayMinutesInSlot || 60;
                const radius = 42 + Math.min(36, (mins / 75) * 30);
                return (
                  <circle
                    key={`pt-heat-${rec.id}-${i}`}
                    cx={rec.mapX}
                    cy={rec.mapY}
                    r={radius}
                    fill={blobGrad}
                    opacity={0.62}
                  />
                );
              })}
            </g>
          )}

          {/* Historical Path Trail for Selected Worker */}
          {!editingLayout && showPath && selectedWorkerHistory.length > 1 && (
            <g>
              {/* Path line */}
              <polyline
                points={selectedWorkerHistory.map(h => `${h.mapX},${h.mapY}`).join(' ')}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3.5"
                strokeDasharray="6 4"
                opacity="0.8"
              />
              {/* Step numbers on the path */}
              {selectedWorkerHistory.map((h, i) => (
                <g key={`history_point_${h.id}_${i}`} transform={`translate(${h.mapX}, ${h.mapY})`}>
                  <circle r="12" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
                  <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">
                    {i + 1}
                  </text>
                  <text x="0" y="-16" textAnchor="middle" fill="#fecdd3" fontSize="8" fontWeight="800">
                    {h.slot}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Worker Location Pins for the Active Slot (08:20, 09:45, ...) */}
          {!editingLayout && showPins && currentSlotRecords.map(worker => {
            const isSelected = selectedWorkerUid === worker.workerUid;
            const isHovered = hoveredWorker?.id === worker.id;
            const isNormal = worker.status === 'NORMAL';
            const isResting = worker.status === 'RESTING';
            const pinColor = isNormal ? '#22c55e' : isResting ? '#eab308' : '#ef4444';

            return (
              <g
                key={worker.id}
                transform={`translate(${worker.mapX}, ${worker.mapY})`}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => onSelectWorker && onSelectWorker(isSelected ? null : worker.workerUid)}
                onMouseEnter={() => setHoveredWorker(worker)}
                onMouseLeave={() => setHoveredWorker(null)}
              >
                {/* Glow ring if selected or slacker */}
                {(!isNormal || isSelected) && (
                  <circle
                    r={isSelected ? 26 : 20}
                    fill={pinColor}
                    opacity="0.25"
                    className="animate-ping"
                  />
                )}

                {/* Pin Shadow */}
                <circle r="15" fill="#020617" opacity="0.6" cy="2" />

                {/* Worker Pin Head */}
                <circle
                  r={isSelected ? 16 : 13}
                  fill={pinColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? '3' : '2'}
                  filter={!isNormal ? 'url(#glowRed)' : 'url(#glowGreen)'}
                />

                {/* Worker Icon */}
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={isSelected ? '10' : '8.5'}
                  fontWeight="900"
                >
                  {worker.workerName.slice(0, 1)}
                </text>

                {/* Worker Name Label Tag */}
                <g transform={`translate(0, ${isSelected ? -22 : -18})`}>
                  <rect
                    x="-32"
                    y="-11"
                    width="64"
                    height="16"
                    fill={isSelected ? '#0284c7' : '#0f172a'}
                    stroke={pinColor}
                    strokeWidth="1.5"
                    rx="5"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontWeight="800"
                  >
                    {worker.workerName}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Hover / Detail Popover for Worker */}
        {hoveredWorker && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900/95 border border-slate-700 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 w-64 animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: `${Math.min(75, Math.max(10, (hoveredWorker.mapX / 1414) * 100))}%`,
              top: `${Math.min(75, Math.max(10, (hoveredWorker.mapY / 1000) * 100))}%`
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${hoveredWorker.status === 'NORMAL' ? 'bg-emerald-500' : hoveredWorker.status === 'RESTING' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                <span className="font-black text-white text-sm">{hoveredWorker.workerName}</span>
                <span className="text-[10px] text-slate-400 font-mono">({hoveredWorker.employeeId})</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {hoveredWorker.slot}
              </span>
            </div>
            <div className="text-[11px] space-y-1 text-slate-300">
              <p><strong className="text-slate-400">소속팀:</strong> {hoveredWorker.teamName}</p>
              <p><strong className="text-slate-400">현재 위치:</strong> <span className={hoveredWorker.status === 'NORMAL' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{hoveredWorker.locationLabel}</span></p>
              <p><strong className="text-slate-400">체류 상태:</strong> {hoveredWorker.status === 'NORMAL' ? '정상 조업 체류' : hoveredWorker.status === 'RESTING' ? '휴게시간 체류' : '⚠️ 지정 블럭 이탈'}</p>
            </div>
          </div>
        )}
          </div>
        </div>
      )}

      {/* Blueprint Legend & Quick Summary Footer */}
      <div className="bg-slate-900/95 border-t border-slate-800 p-4 px-6 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
        <div className="flex flex-wrap items-center gap-5">
          <span className="text-slate-400 font-bold flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
            정상 블럭 체류 ({currentSlotRecords.filter(r => r.status === 'NORMAL').length}명)
          </span>
          <span className="text-slate-400 font-bold flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-sm shadow-amber-500/50" />
            휴게실/화장실 ({currentSlotRecords.filter(r => r.status === 'RESTING').length}명)
          </span>
          <span className="text-slate-400 font-bold flex items-center gap-1.5 font-mono tabular-nums">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500/50" />
            지정 블럭 이탈/미체류 ({currentSlotRecords.filter(r => r.status === 'AWAY').length}명)
          </span>
        </div>

        <div className="flex items-center gap-4">
          {selectedWorkerUid && (
            <button
              onClick={() => onSelectWorker && onSelectWorker(null)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700 cursor-pointer"
            >
              선택 해제 (전체 보기)
            </button>
          )}
          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            총 정반/블럭 {activeJigs.length}기 (남측 {southJigs.length} · 북측 {northJigs.length}) · 현재 슬롯 검출 {currentSlotRecords.length}명
          </span>
        </div>
      </div>
    </div>
  );
};
