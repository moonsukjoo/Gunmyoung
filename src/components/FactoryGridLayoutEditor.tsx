import React, { useState } from 'react';
import { FactoryJig } from '../types';
import {
  Grid,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowUpDown,
  Building,
  CheckCircle2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FactoryGridLayoutEditorProps {
  jigs: FactoryJig[];
  onJigsUpdated: (updatedJigs: FactoryJig[]) => Promise<void>;
  onClose?: () => void;
  isLight?: boolean;
}

export const FactoryGridLayoutEditor: React.FC<FactoryGridLayoutEditorProps> = ({
  jigs,
  onJigsUpdated,
  onClose,
  isLight = false
}) => {
  const [editableJigs, setEditableJigs] = useState<FactoryJig[]>(() => JSON.parse(JSON.stringify(jigs)));
  const [isSaving, setIsSaving] = useState(false);

  // Group by rows (e.g. Bay South vs Bay North or custom rows)
  const handleUpdateField = (id: string, field: keyof FactoryJig, value: any) => {
    setEditableJigs(prev =>
      prev.map(j => (j.id === id ? { ...j, [field]: value } : j))
    );
  };

  const handleAddJig = () => {
    const nextNum = editableJigs.length + 1;
    const newJig: FactoryJig = {
      id: `jig-${String(nextNum).padStart(2, '0')}`,
      jigNumber: nextNum,
      jigName: `JIG-${String(nextNum).padStart(2, '0')}`,
      blockName: `신규 블럭`,
      blockType: '선체 조립 블럭',
      assignedTeam: '현장취부반',
      currentProgress: 10,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      targetDays: 10,
      x: 180 + ((nextNum - 1) % 4) * 280,
      y: nextNum > 4 ? 610 : 160,
      width: 250,
      height: 220,
      bay: nextNum > 4 ? 'BAY_NORTH' : 'BAY_SOUTH',
      status: 'ACTIVE'
    };
    setEditableJigs(prev => [...prev, newJig]);
    toast.success(`새 정반/블럭(JIG-${String(nextNum).padStart(2, '0')})이 추가되었습니다.`);
  };

  const handleDeleteJig = (id: string) => {
    if (editableJigs.length <= 1) {
      toast.error('최소 1개 이상의 지그/블럭이 유지되어야 합니다.');
      return;
    }
    setEditableJigs(prev => prev.filter(j => j.id !== id));
    toast.info('지그가 목록에서 제거되었습니다. [저장하기]를 누르면 반영됩니다.');
  };

  // Re-layout grid automatically into columns (e.g. 4x2 or 3x3)
  const handleAutoLayoutGrid = (colsPerRow: number = 4) => {
    const startX = 80;
    const startY = 140;
    const cellW = 280;
    const cellH = 360;
    const rowGap = 120;

    const updated = editableJigs.map((j, idx) => {
      const col = idx % colsPerRow;
      const row = Math.floor(idx / colsPerRow);
      const x = startX + col * cellW;
      const y = startY + row * (cellH + rowGap);
      const bay = row === 0 ? 'BAY_SOUTH' : 'BAY_NORTH';
      return {
        ...j,
        jigNumber: idx + 1,
        jigName: `JIG-${String(idx + 1).padStart(2, '0')}`,
        x: Math.round(x),
        y: Math.round(y),
        width: 250,
        height: 240,
        bay: bay as any
      };
    });

    setEditableJigs(updated);
    toast.success(`${colsPerRow}열 그리드 구조로 도면 좌표가 자동 배치되었습니다.`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onJigsUpdated(editableJigs);
      toast.success('7공장 블럭 배치 및 레이아웃 구조가 성공적으로 저장되었습니다.');
      if (onClose) onClose();
    } catch {
      toast.error('블럭 레이아웃 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Grid className="w-4 h-4 text-amber-500" />
            <span>공장 도면 블럭 레이아웃 커스텀 편집</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-foreground font-black">총 {editableJigs.length}개 블럭</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-foreground mt-0.5">
            동서남북 블럭 배치 및 행·열 구조 자유 편집기
          </h3>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            현장 도면(사진)처럼 3열, 4열 또는 남북 행 단위로 블럭 개수와 명칭, 좌표를 자유롭게 늘리고 줄일 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleAutoLayoutGrid(4)}
            className="h-10 px-3.5 rounded-xl text-xs font-bold gap-1.5 border-border cursor-pointer whitespace-nowrap"
          >
            <Grid className="w-3.5 h-3.5 text-blue-400" />
            <span>4열 정렬 자동배치</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleAutoLayoutGrid(3)}
            className="h-10 px-3.5 rounded-xl text-xs font-bold gap-1.5 border-border cursor-pointer whitespace-nowrap"
          >
            <Grid className="w-3.5 h-3.5 text-amber-400" />
            <span>3열 정렬 자동배치</span>
          </Button>

          <Button
            type="button"
            onClick={handleAddJig}
            className="h-10 px-4 rounded-xl text-xs font-black gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>+ 블럭/지그 추가</span>
          </Button>

          {onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 px-3 rounded-xl text-xs font-bold border-border cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Editable Table of Jigs / Blocks */}
      <div className="border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-[11px] font-black text-muted-foreground uppercase tracking-wider">
              <th className="py-3 px-3">정반 번호</th>
              <th className="py-3 px-4">블럭 코드 (예: [4307 E11'C'])</th>
              <th className="py-3 px-4">블럭 상세 명칭 / 공정</th>
              <th className="py-3 px-4">담당 물량팀</th>
              <th className="py-3 px-3">배치 라인 (Bay)</th>
              <th className="py-3 px-3 text-right">도면 X 좌표</th>
              <th className="py-3 px-3 text-right">도면 Y 좌표</th>
              <th className="py-3 px-3 text-center">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {editableJigs.map((jig, idx) => (
              <tr key={jig.id} className="hover:bg-muted/20">
                <td className="py-3 px-3 font-mono font-black text-foreground whitespace-nowrap">
                  <input
                    type="text"
                    value={jig.jigName}
                    onChange={e => handleUpdateField(jig.id, 'jigName', e.target.value)}
                    className="w-20 px-2 py-1.5 rounded-lg bg-muted border border-border text-xs font-black text-foreground outline-none text-center"
                  />
                </td>

                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={jig.blockName}
                    onChange={e => handleUpdateField(jig.id, 'blockName', e.target.value)}
                    placeholder="예: 4307 E11'C'"
                    className="w-full min-w-[160px] px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-black text-cyan-400 outline-none"
                  />
                </td>

                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={jig.blockType}
                    onChange={e => handleUpdateField(jig.id, 'blockType', e.target.value)}
                    placeholder="예: 모니터링 / 검사 대기"
                    className="w-full min-w-[180px] px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-bold text-foreground outline-none"
                  />
                </td>

                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={jig.assignedTeam}
                    onChange={e => handleUpdateField(jig.id, 'assignedTeam', e.target.value)}
                    className="w-full min-w-[140px] px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-bold text-foreground outline-none"
                  />
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <select
                    value={jig.bay}
                    onChange={e => handleUpdateField(jig.id, 'bay', e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs font-bold text-foreground outline-none cursor-pointer"
                  >
                    <option value="BAY_SOUTH">BAY A (상단/남측)</option>
                    <option value="BAY_NORTH">BAY B (하단/북측)</option>
                  </select>
                </td>

                <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                  <input
                    type="number"
                    value={jig.x}
                    onChange={e => handleUpdateField(jig.id, 'x', Number(e.target.value))}
                    className="w-20 px-2 py-1.5 rounded-lg bg-muted border border-border text-xs font-mono font-bold text-foreground outline-none text-right"
                  />
                </td>

                <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                  <input
                    type="number"
                    value={jig.y}
                    onChange={e => handleUpdateField(jig.id, 'y', Number(e.target.value))}
                    className="w-20 px-2 py-1.5 rounded-lg bg-muted border border-border text-xs font-mono font-bold text-foreground outline-none text-right"
                  />
                </td>

                <td className="py-3 px-3 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleDeleteJig(jig.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                    title="이 블럭 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3">
        {onClose && (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="px-6 h-11 rounded-xl text-xs font-bold cursor-pointer"
          >
            취소
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? '저장 중...' : '블럭 레이아웃 변경사항 저장'}</span>
        </Button>
      </div>
    </div>
  );
};

export default FactoryGridLayoutEditor;
