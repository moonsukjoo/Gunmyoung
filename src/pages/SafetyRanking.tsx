import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/firebase';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, orderBy } from 'firebase/firestore';
import { UserProfile, SafetyScoreLog, Department } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { startOfMonth, subMonths, format } from 'date-fns';
import { 
  Trophy, 
  Search, 
  History, 
  Star, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  Plus,
  Minus,
  Save,
  Download,
  FileText,
  Camera,
  XCircle,
  Calendar
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { exportToExcel, exportToPDF, exportPhotoCardPDF, ReportCardItem } from '@/lib/exportUtils';
import { handleFirestoreError, OperationType } from '@/firebase';

export const SafetyRanking: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [logs, setLogs] = useState<SafetyScoreLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [activeView, setActiveView] = useState<'INDIVIDUAL' | 'TEAM' | 'LOGS'>('INDIVIDUAL');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [scoreDelta, setScoreDelta] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'REWARD' | 'PENALTY'>('REWARD');
  const [reason, setReason] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = profile && (profile.role === 'CEO');

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeDepts = onSnapshot(query(collection(db, 'departments'), orderBy('name')), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'departments');
    });

    const unsubscribeLogs = onSnapshot(query(collection(db, 'safetyScoreLogs'), orderBy('createdAt', 'desc')), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyScoreLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'safetyScoreLogs');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDepts();
      unsubscribeLogs();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesSearch = (user.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                             user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDeptId === 'all' || user.departmentId === selectedDeptId;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => (b.safetyScore ?? 100) - (a.safetyScore ?? 100));
  }, [users, searchTerm, selectedDeptId]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => l.createdAt.startsWith(selectedMonth));
  }, [logs, selectedMonth]);

  // Calculate monthly stats per target user for the selectedMonth
  const monthlyStatsByTarget = useMemo(() => {
    const stats: Record<string, { delta: number; latestPhoto?: string }> = {};
    logs.forEach(log => {
      if (log.createdAt.startsWith(selectedMonth)) {
        if (!stats[log.targetUid]) {
          stats[log.targetUid] = { delta: 0, latestPhoto: undefined };
        }
        stats[log.targetUid].delta += log.scoreDelta;
        if (!stats[log.targetUid].latestPhoto && log.photoUrl) {
          stats[log.targetUid].latestPhoto = log.photoUrl;
        }
      }
    });
    return stats;
  }, [logs, selectedMonth]);

  // Calculate monthly score delta by department
  const monthlyDeptDelta = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(log => {
      if (log.createdAt.startsWith(selectedMonth)) {
        const user = users.find(u => u.uid === log.targetUid);
        if (user?.departmentId) {
          map[user.departmentId] = (map[user.departmentId] || 0) + log.scoreDelta;
        }
      }
    });
    return map;
  }, [logs, users, selectedMonth]);

  const teamRankings = useMemo(() => {
    const deptMap: Record<string, { id: string; name: string; totalScore: number; count: number; average: number }> = {};
    users.forEach(user => {
      if (!user.departmentId) return;
      if (!deptMap[user.departmentId]) deptMap[user.departmentId] = { id: user.departmentId, name: user.departmentName || 'Unknown', totalScore: 0, count: 0, average: 0 };
      deptMap[user.departmentId].totalScore += (user.safetyScore ?? 100);
      deptMap[user.departmentId].count += 1;
    });
    return Object.values(deptMap)
      .map(d => ({ ...d, average: d.count > 0 ? d.totalScore / d.count : 0 }))
      .sort((a, b) => b.average - a.average);
  }, [users]);

  const handleAdjustScore = async () => {
    if (!targetUser || !scoreDelta || !reason || !profile) {
      toast.error('점수와 사유를 모두 입력해주세요.');
      return;
    }
    const delta = adjustmentType === 'REWARD' ? parseInt(scoreDelta) : -parseInt(scoreDelta);
    if (isNaN(delta)) {
      toast.error('올바른 숫자를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    const prevScore = targetUser.safetyScore ?? 100;
    const newScore = prevScore + delta;

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { safetyScore: newScore });
      await addDoc(collection(db, 'safetyScoreLogs'), {
        targetUid: targetUser.uid,
        targetName: targetUser.displayName,
        adminUid: profile.uid,
        adminName: profile.displayName,
        adminRole: profile.role,
        scoreDelta: delta,
        previousScore: prevScore,
        newScore: newScore,
        reason,
        type: delta > 0 ? 'REWARD' : 'PENALTY',
        photoUrl: photoUrl || undefined,
        createdAt: new Date().toISOString()
      });

      toast.success('점수 및 현장 첨부사진이 등록되었습니다.');
      setIsAdjustmentOpen(false);
      setScoreDelta('');
      setReason('');
      setPhotoUrl('');
    } catch (error) {
      console.error("Safety score adjustment error:", error);
      toast.error('오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    try {
      if (activeView === 'INDIVIDUAL') {
        const data = filteredUsers.map((u, idx) => {
          const stats = monthlyStatsByTarget[u.uid];
          const delta = stats?.delta ?? 0;
          return {
            '순위': idx + 1,
            '성명': u.displayName,
            '사번': u.employeeId,
            '부서': u.departmentName || '-',
            '현재 안전지수': u.safetyScore || 100,
            [`${selectedMonth} 변동점수`]: delta > 0 ? `+${delta}` : delta
          };
        });
        exportToExcel(data, `개인별_안전지수_${selectedMonth}`, '랭킹');
      } else if (activeView === 'TEAM') {
        const data = teamRankings.map((t, idx) => {
          const delta = monthlyDeptDelta[t.id] ?? 0;
          return {
            '순위': idx + 1,
            '팀명': t.name,
            '팀원수': t.count,
            '평균지수': t.average.toFixed(1),
            [`${selectedMonth} 변동합계`]: delta > 0 ? `+${delta}` : delta
          };
        });
        exportToExcel(data, `팀별_안전지수_${selectedMonth}`, '팀랭킹');
      } else {
        const data = filteredLogs.map(l => ({
          '일시': format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm'),
          '대상자': l.targetName,
          '점수변동': l.scoreDelta,
          '변동후': l.newScore,
          '사유': l.reason,
          '현장사진 첨부': l.photoUrl ? '유 (첨부됨)' : '무',
          '관리자': l.adminName
        }));
        exportToExcel(data, `안전지수_히스토리_${selectedMonth}`, '히스토리');
      }
      toast.success('엑셀 다운로드 완료');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  // Direct monthly safety inspection photo report PDF download (4 items per page)
  const handleExportMonthlyPhotoPDF = async () => {
    try {
      if (filteredLogs.length === 0) {
        toast.info(`${selectedMonth}에 등록된 안전점검 및 사진 내역이 없습니다.`);
        return;
      }
      toast.loading(`${selectedMonth} 안전점검 사진 리포트(1페이지 4건)를 준비 중입니다...`, { id: 'safety-pdf' });
      const exportLogs = filteredLogs.length > 40 ? filteredLogs.slice(0, 40) : filteredLogs;
      if (filteredLogs.length > 40) {
        toast.info(`안전한 모바일 처리를 위해 최신 40건(총 10페이지)을 1페이지 4건 양식으로 생성합니다.`);
      }

      const items: ReportCardItem[] = exportLogs.map((l, idx) => {
        const user = users.find(u => u.uid === l.targetUid);
        const isReward = l.scoreDelta > 0;
        return {
          id: l.id,
          itemNumber: idx + 1,
          date: format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm'),
          targetName: l.targetName,
          targetSub: `${user?.departmentName || '현장팀'} / ${user?.employeeId || '사원'}`,
          categoryBadge: isReward ? '안전 모범 포상' : '안전수칙 위반',
          categoryType: isReward ? 'reward' : 'penalty',
          scoreBadge: isReward ? `+${l.scoreDelta}점` : `${l.scoreDelta}점`,
          scoreBadgeType: isReward ? 'positive' : 'negative',
          authorName: `점검/관리자: ${l.adminName}`,
          reason: l.reason,
          photoUrl: l.photoUrl || undefined
        };
      });

      toast.dismiss('safety-pdf');

      await exportPhotoCardPDF({
        title: `안전 지수 변동 및 현장점검 리포트 (${selectedMonth})`,
        subtitle: `총 ${items.length}건 등록 (1페이지 4건 표준 양식, 총 ${Math.ceil(items.length / 4) || 1}페이지)`,
        monthStr: selectedMonth,
        items,
        fileName: `안전점검사진보고서_${selectedMonth}`
      });
    } catch (error) {
      console.error('Safety photo PDF export failed:', error);
      toast.dismiss('safety-pdf');
      toast.error('PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleExportPDF = async () => {
    try {
      if (activeView === 'INDIVIDUAL') {
        if (filteredUsers.length === 0) {
          toast.info('조회된 임직원 데이터가 없습니다.');
          return;
        }
        toast.loading('개인별 안전 지수 PDF 리포트를 준비 중입니다...', { id: 'safety-pdf' });
        const exportUsers = filteredUsers.length > 40 ? filteredUsers.slice(0, 40) : filteredUsers;
        if (filteredUsers.length > 40) {
          toast.info(`안전한 모바일 처리를 위해 상위 40명(총 10페이지)을 1페이지 4건 양식으로 생성합니다.`);
        }

        const items: ReportCardItem[] = exportUsers.map((u, idx) => {
          const stats = monthlyStatsByTarget[u.uid];
          const delta = stats?.delta ?? 0;
          const photo = stats?.latestPhoto;
          return {
            id: u.uid,
            itemNumber: idx + 1,
            date: `${selectedMonth} 랭킹`,
            targetName: u.displayName,
            targetSub: `${u.departmentName || '현장'} / ${u.employeeId || '사원'}`,
            categoryBadge: idx < 3 ? `TOP ${idx + 1}` : '안전관리 대상',
            categoryType: idx < 3 ? 'reward' : 'info',
            scoreBadge: `${u.safetyScore ?? 100}점`,
            scoreBadgeType: (u.safetyScore ?? 100) >= 100 ? 'positive' : 'negative',
            authorName: `월간 변동: ${delta > 0 ? `+${delta}` : delta}점`,
            reason: `${u.displayName} 사원의 현재 안전 지수는 ${u.safetyScore ?? 100}점이며, ${selectedMonth} 누적 변동 점수는 ${delta > 0 ? `+${delta}` : delta}점입니다.`,
            photoUrl: photo || undefined
          };
        });

        toast.dismiss('safety-pdf');

        await exportPhotoCardPDF({
          title: `개인별 안전 지수 현황 리포트 (${selectedMonth})`,
          subtitle: `총 ${items.length}명 등록 (1페이지 4건 표준 양식, 총 ${Math.ceil(items.length / 4) || 1}페이지)`,
          monthStr: selectedMonth,
          items,
          fileName: `개인별_안전지수_${selectedMonth}`
        });
      } else if (activeView === 'TEAM') {
        if (teamRankings.length === 0) {
          toast.info('조회된 팀별 데이터가 없습니다.');
          return;
        }
        toast.dismiss('safety-pdf');
        const items: ReportCardItem[] = teamRankings.map((t, idx) => {
          const delta = monthlyDeptDelta[t.id] ?? 0;
          return {
            id: t.id,
            itemNumber: idx + 1,
            date: `${selectedMonth} 팀 랭킹`,
            targetName: t.name,
            targetSub: `소속 인원: ${t.count}명`,
            categoryBadge: `팀 순위 ${idx + 1}위`,
            categoryType: idx === 0 ? 'reward' : 'info',
            scoreBadge: `평균 ${t.average.toFixed(1)}점`,
            scoreBadgeType: t.average >= 100 ? 'positive' : 'neutral',
            authorName: `팀 변동합계: ${delta > 0 ? `+${delta}` : delta}점`,
            reason: `${t.name} 소속 인원 ${t.count}명의 평균 안전 지수는 ${t.average.toFixed(1)}점이며, ${selectedMonth} 동안 팀 내 총 점수 변동 합계는 ${delta > 0 ? `+${delta}` : delta}점입니다.`
          };
        });

        await exportPhotoCardPDF({
          title: `팀별 안전 지수 현황 리포트 (${selectedMonth})`,
          subtitle: `총 ${items.length}개 팀 등록 (1페이지 4건 표준 양식, 총 ${Math.ceil(items.length / 4) || 1}페이지)`,
          monthStr: selectedMonth,
          items,
          fileName: `팀별_안전지수_${selectedMonth}`
        });
      } else {
        // LOGS
        await handleExportMonthlyPhotoPDF();
        return;
      }
    } catch (error) {
      console.error('Safety PDF export failed:', error);
      toast.dismiss('safety-pdf');
      toast.error('PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">안전 지수</h2>
          <p className="text-muted-foreground font-bold">우리 회사의 안전 랭킹을 확인하세요</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-10 rounded-xl bg-muted/50 border-border text-foreground font-black text-[10px] gap-2"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> EXCEL
          </Button>
          <Button 
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="h-10 rounded-xl bg-muted/50 border-border text-foreground font-black text-[10px] gap-2"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF
          </Button>
        </div>
      </header>

      {/* Persistent Month Selector Bar for All Views */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-muted-foreground">보고서 조회 및 다운로드 기준 월</div>
            <div className="text-sm font-black text-foreground">{selectedMonth.replace('-', '년 ')}월 현황</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 sm:flex-none bg-muted px-4 py-2.5 rounded-xl text-xs font-black border border-border text-foreground cursor-pointer"
          />
          <Button 
            variant="default"
            size="sm"
            onClick={handleExportMonthlyPhotoPDF}
            className="h-10 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs gap-1.5 shadow-sm shrink-0"
          >
            <FileText className="w-4 h-4" /> 월별 사진리포트 PDF
          </Button>
        </div>
      </div>

      <div className="bg-muted/50 p-1 rounded-2xl flex gap-1">
        {(['INDIVIDUAL', 'TEAM', 'LOGS'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              "flex-1 h-12 rounded-xl text-xs font-black transition-all",
              activeView === view ? "bg-card text-foreground shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground/90"
            )}
          >
            {view === 'INDIVIDUAL' ? '개인별' : view === 'TEAM' ? '팀별' : '히스토리'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeView === 'INDIVIDUAL' && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input 
                placeholder="이름 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-14 pl-11 bg-card border-border rounded-2xl text-foreground font-bold placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="space-y-2">
              {filteredUsers.map((user, idx) => (
                <div key={user.uid} className="bg-card p-5 rounded-2xl border border-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                      idx === 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-500 shadow-amber-500/10 shadow-lg" : "bg-muted text-muted-foreground"
                    )}>
                      {idx < 3 ? <Trophy className="w-5 h-5" /> : (idx + 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-foreground">{user.displayName}</span>
                        <Badge variant="outline" className="text-[9px] font-black bg-muted border-none opacity-80">
                           {user.departmentName}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-bold">{user.employeeId}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={cn("text-xl font-black", (user.safetyScore ?? 100) >= 100 ? "text-emerald-500" : "text-amber-700 dark:text-amber-500")}>
                        {user.safetyScore ?? 100}
                        <span className="text-[10px] ml-1 opacity-60">pts</span>
                      </div>
                      {monthlyStatsByTarget[user.uid]?.delta !== undefined && monthlyStatsByTarget[user.uid].delta !== 0 && (
                        <div className={cn("text-[10px] font-black", monthlyStatsByTarget[user.uid].delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                          {selectedMonth.slice(5)}월: {monthlyStatsByTarget[user.uid].delta > 0 ? `+${monthlyStatsByTarget[user.uid].delta}` : monthlyStatsByTarget[user.uid].delta}pts
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => { setTargetUser(user); setIsAdjustmentOpen(true); }}
                        className="w-10 h-10 rounded-xl bg-muted text-muted-foreground"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'TEAM' && (
          <div className="space-y-4">
            {teamRankings.map((team, idx) => (
              <div key={team.id} className="bg-card p-6 rounded-2xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl font-black">
                      {idx + 1}
                    </div>
                    <div>
                      <span className="text-lg font-black text-foreground">{team.name}</span>
                      {monthlyDeptDelta[team.id] !== undefined && monthlyDeptDelta[team.id] !== 0 && (
                        <span className={cn("ml-2 text-xs font-black", monthlyDeptDelta[team.id] > 0 ? "text-emerald-500" : "text-red-500")}>
                          ({selectedMonth.slice(5)}월 {monthlyDeptDelta[team.id] > 0 ? `+${monthlyDeptDelta[team.id]}` : monthlyDeptDelta[team.id]}pts)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                     <span className="text-2xl font-black text-primary">{team.average.toFixed(1)}</span>
                     <span className="text-xs text-muted-foreground ml-1">AVG</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                   <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(team.average, 100)}%` }} className="h-full bg-primary rounded-full shadow-lg shadow-primary/20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'LOGS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-black text-muted-foreground">{selectedMonth.replace('-', '년 ')}월 현장점검 및 점수변동 기록</span>
              <span className="text-xs font-bold text-muted-foreground">총 {filteredLogs.length}건</span>
            </div>
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground font-bold text-xs bg-card rounded-2xl border border-border">해당 월의 히스토리가 없습니다.</div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="bg-card p-5 rounded-2xl border border-border flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      log.type === 'REWARD' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                    )}>
                      {log.type === 'REWARD' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-black text-foreground">{log.targetName}</span>
                        <span className={cn("text-xs font-black", log.scoreDelta > 0 ? "text-emerald-500" : "text-red-500")}>
                          {log.scoreDelta > 0 ? `+${log.scoreDelta}` : log.scoreDelta}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-bold">{log.reason}</p>
                      {log.photoUrl && (
                        <div className="mt-3">
                          <img src={log.photoUrl} alt="Log Photo" className="w-20 h-20 rounded-xl object-cover border border-border shadow-sm" />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground/40 mt-2 font-bold">{format(new Date(log.createdAt), 'yyyy.MM.dd')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" /> 점수 조정 및 사진 첨부
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
             <div className="bg-muted p-4 rounded-2xl flex items-center justify-between">
                <div>
                   <h4 className="text-sm font-black text-foreground">{targetUser?.displayName}</h4>
                   <span className="text-[10px] text-muted-foreground">{targetUser?.employeeId}</span>
                </div>
                <span className="text-xl font-black text-primary">{targetUser?.safetyScore ?? 100}</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setAdjustmentType('REWARD')}
                  className={cn("h-12 rounded-xl font-black text-xs border", adjustmentType === 'REWARD' ? "bg-emerald-500 border-emerald-500 text-white" : "bg-muted border-border text-muted-foreground")}
                >상점 (+)</button>
                <button 
                  onClick={() => setAdjustmentType('PENALTY')}
                  className={cn("h-12 rounded-xl font-black text-xs border", adjustmentType === 'PENALTY' ? "bg-red-500 border-red-500 text-white" : "bg-muted border-border text-muted-foreground")}
                >벌점 (-)</button>
             </div>
             <Input 
                type="number" 
                placeholder="점수" 
                value={scoreDelta} 
                onChange={e => setScoreDelta(e.target.value)} 
                className="bg-muted border-border h-14 rounded-2xl text-lg font-black text-center"
             />
             <Input 
                placeholder="사유" 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                className="bg-muted border-border h-14 rounded-2xl font-bold"
             />

             <div className="space-y-2">
               <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
                 <Camera className="w-3.5 h-3.5 text-primary" /> 현장 사진 첨부 (선택)
               </label>
               <input 
                 type="file" 
                 accept="image/*"
                 onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) {
                     const reader = new FileReader();
                     reader.onload = (event) => {
                       const img = new Image();
                       img.onload = () => {
                         const canvas = document.createElement('canvas');
                         let width = img.width;
                         let height = img.height;
                         const MAX_WIDTH = 600;
                         const MAX_HEIGHT = 600;
                         if (width > height) {
                           if (width > MAX_WIDTH) {
                             height *= MAX_WIDTH / width;
                             width = MAX_WIDTH;
                           }
                         } else {
                           if (height > MAX_HEIGHT) {
                             width *= MAX_HEIGHT / height;
                             height = MAX_HEIGHT;
                           }
                         }
                         canvas.width = width;
                         canvas.height = height;
                         const ctx = canvas.getContext('2d');
                         ctx?.drawImage(img, 0, 0, width, height);
                         const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                         setPhotoUrl(dataUrl);
                       };
                       img.src = event.target?.result as string;
                     };
                     reader.readAsDataURL(file);
                   }
                 }}
                 className="h-14 bg-muted border-2 border-border rounded-2xl text-xs font-bold text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white cursor-pointer w-full pt-2"
               />
               {photoUrl && (
                 <div className="mt-2 relative w-20 h-20 rounded-2xl overflow-hidden border border-border shadow-md">
                   <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                   <button 
                     type="button"
                     onClick={() => setPhotoUrl('')}
                     className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs"
                   >
                     <XCircle className="w-3 h-3" />
                   </button>
                 </div>
               )}
             </div>
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={handleAdjustScore} disabled={isSaving} className="w-full h-14 bg-primary text-white font-black rounded-2xl">
              {isSaving ? '저장 중' : '변경사항 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SafetyRanking;
