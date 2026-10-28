import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  getDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { useAuth } from '../components/AuthProvider';
import { UserProfile, SafetyScoreLog, Department } from '../types';
import { format } from 'date-fns';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Plus, 
  Minus, 
  Edit3, 
  Trash2, 
  Download, 
  FileText, 
  Camera, 
  X, 
  AlertTriangle, 
  Trophy, 
  CheckCircle, 
  User, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Maximize2,
  RefreshCw,
  Award
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel, exportPhotoCardPDF, ReportCardItem } from '../lib/exportUtils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

export const PCAdminSafety: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<SafetyScoreLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab: 'EMPLOYEES' | 'LOGS'
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'LOGS'>('EMPLOYEES');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  // Filters for Employees tab
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [scoreGradeFilter, setScoreGradeFilter] = useState<'all' | 'high' | 'normal' | 'low' | 'danger'>('all');

  // Filters for Logs tab
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'REWARD' | 'PENALTY'>('all');
  const [filterUserUid, setFilterUserUid] = useState<string | null>(null);

  // Modals state
  const [isNewAdjustmentOpen, setIsNewAdjustmentOpen] = useState(false);
  const [isDirectEditOpen, setIsDirectEditOpen] = useState(false);
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);
  const [isDeleteLogOpen, setIsDeleteLogOpen] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<{ url: string; title: string } | null>(null);

  // Target employee for new adjustment or direct edit
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);

  // Form states for New Adjustment (+/-)
  const [adjustmentType, setAdjustmentType] = useState<'REWARD' | 'PENALTY'>('REWARD');
  const [scoreDelta, setScoreDelta] = useState<string>('5');
  const [reason, setReason] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Direct Score Edit
  const [directNewScore, setDirectNewScore] = useState<string>('');
  const [directEditReason, setDirectEditReason] = useState('');

  // Target log for Edit or Delete
  const [targetLog, setTargetLog] = useState<SafetyScoreLog | null>(null);
  const [editLogDelta, setEditLogDelta] = useState<string>('');
  const [editLogReason, setEditLogReason] = useState('');
  const [editLogPhotoUrl, setEditLogPhotoUrl] = useState('');
  const [rollbackScoreOnDelete, setRollbackScoreOnDelete] = useState(true);

  // Real-time Firestore subscriptions
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    }, (err) => {
      console.error('Failed to load users:', err);
      toast.error('사용자 목록을 불러오지 못했습니다.');
    });

    const unsubLogs = onSnapshot(query(collection(db, 'safetyScoreLogs'), orderBy('createdAt', 'desc')), (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SafetyScoreLog)));
    }, (err) => {
      console.error('Failed to load safetyScoreLogs:', err);
    });

    const unsubDepts = onSnapshot(query(collection(db, 'departments'), orderBy('name')), (snap) => {
      setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
    });

    return () => {
      unsubUsers();
      unsubLogs();
      unsubDepts();
    };
  }, []);

  // Compute monthly stats per user for selectedMonth
  const monthlyStatsByUser = useMemo(() => {
    const stats: Record<string, { delta: number; rewardCount: number; penaltyCount: number; latestPhoto?: string }> = {};
    logs.forEach(log => {
      if (log.createdAt.startsWith(selectedMonth)) {
        if (!stats[log.targetUid]) {
          stats[log.targetUid] = { delta: 0, rewardCount: 0, penaltyCount: 0 };
        }
        stats[log.targetUid].delta += log.scoreDelta;
        if (log.scoreDelta > 0) stats[log.targetUid].rewardCount += 1;
        if (log.scoreDelta < 0) stats[log.targetUid].penaltyCount += 1;
        if (!stats[log.targetUid].latestPhoto && log.photoUrl) {
          stats[log.targetUid].latestPhoto = log.photoUrl;
        }
      }
    });
    return stats;
  }, [logs, selectedMonth]);

  // Overall analytics stats
  const analytics = useMemo(() => {
    const totalUsers = users.length;
    const scores = users.map(u => u.safetyScore ?? 100);
    const avgScore = totalUsers > 0 ? (scores.reduce((a, b) => a + b, 0) / totalUsers).toFixed(1) : '100.0';

    const monthLogs = logs.filter(l => l.createdAt.startsWith(selectedMonth));
    const rewardLogs = monthLogs.filter(l => l.scoreDelta > 0);
    const penaltyLogs = monthLogs.filter(l => l.scoreDelta < 0);
    const totalRewardDelta = rewardLogs.reduce((acc, cur) => acc + cur.scoreDelta, 0);
    const totalPenaltyDelta = penaltyLogs.reduce((acc, cur) => acc + Math.abs(cur.scoreDelta), 0);

    const exemplaryCount = users.filter(u => (u.safetyScore ?? 100) >= 100).length;
    const exemplaryRate = totalUsers > 0 ? Math.round((exemplaryCount / totalUsers) * 100) : 100;

    return {
      totalUsers,
      avgScore,
      monthLogsCount: monthLogs.length,
      rewardLogsCount: rewardLogs.length,
      penaltyLogsCount: penaltyLogs.length,
      totalRewardDelta,
      totalPenaltyDelta,
      exemplaryCount,
      exemplaryRate
    };
  }, [users, logs, selectedMonth]);

  // Filtered employees list
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const nameMatch = (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (user.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
        const deptMatch = selectedDeptId === 'all' || user.departmentId === selectedDeptId;
        
        const score = user.safetyScore ?? 100;
        let gradeMatch = true;
        if (scoreGradeFilter === 'high') gradeMatch = score >= 120;
        else if (scoreGradeFilter === 'normal') gradeMatch = score >= 100 && score < 120;
        else if (scoreGradeFilter === 'low') gradeMatch = score >= 80 && score < 100;
        else if (scoreGradeFilter === 'danger') gradeMatch = score < 80;

        return nameMatch && deptMatch && gradeMatch;
      })
      .sort((a, b) => (b.safetyScore ?? 100) - (a.safetyScore ?? 100));
  }, [users, searchTerm, selectedDeptId, scoreGradeFilter]);

  // Filtered logs list
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const monthMatch = log.createdAt.startsWith(selectedMonth);
      const userMatch = !filterUserUid || log.targetUid === filterUserUid;
      const typeMatch = logTypeFilter === 'all' || 
                        (logTypeFilter === 'REWARD' && log.scoreDelta > 0) || 
                        (logTypeFilter === 'PENALTY' && log.scoreDelta < 0);
      const textMatch = !logSearchTerm || 
                        (log.targetName || '').toLowerCase().includes(logSearchTerm.toLowerCase()) ||
                        (log.reason || '').toLowerCase().includes(logSearchTerm.toLowerCase()) ||
                        (log.adminName || '').toLowerCase().includes(logSearchTerm.toLowerCase());
      return monthMatch && userMatch && typeMatch && textMatch;
    });
  }, [logs, selectedMonth, filterUserUid, logTypeFilter, logSearchTerm]);

  // Handle photo upload compression
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, setTargetPhoto: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('파일 크기는 15MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 700;
        const MAX_HEIGHT = 700;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setTargetPhoto(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 1. Submit New Score Adjustment (+ or -)
  const handleCreateAdjustment = async () => {
    if (!targetUser || !scoreDelta || !reason) {
      toast.error('대상자와 변동 점수, 사유를 모두 입력해주세요.');
      return;
    }
    const deltaNum = parseInt(scoreDelta);
    if (isNaN(deltaNum) || deltaNum <= 0) {
      toast.error('올바른 양수 점수를 입력해주세요.');
      return;
    }

    const actualDelta = adjustmentType === 'REWARD' ? deltaNum : -deltaNum;
    setIsSubmitting(true);

    try {
      const currentScore = targetUser.safetyScore ?? 100;
      const newScore = Math.max(0, currentScore + actualDelta);

      // 1. Update user safetyScore
      await updateDoc(doc(db, 'users', targetUser.uid), { safetyScore: newScore });

      // 2. Add log entry
      await addDoc(collection(db, 'safetyScoreLogs'), {
        targetUid: targetUser.uid,
        targetName: targetUser.displayName || '이름 없음',
        adminUid: profile?.uid || 'admin',
        adminName: profile?.displayName || '관리자',
        adminRole: profile?.role || 'CEO',
        scoreDelta: actualDelta,
        previousScore: currentScore,
        newScore: newScore,
        reason,
        type: adjustmentType,
        photoUrl: photoUrl || undefined,
        createdAt: new Date().toISOString()
      });

      toast.success(`${targetUser.displayName} 님의 안전지수가 ${actualDelta > 0 ? `+${actualDelta}` : actualDelta}점 반영되었습니다.`);
      setIsNewAdjustmentOpen(false);
      setTargetUser(null);
      setScoreDelta('5');
      setReason('');
      setPhotoUrl('');
    } catch (err) {
      console.error('Error creating safety adjustment:', err);
      toast.error('점수 반영 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Direct Overwrite Score
  const handleDirectScoreEdit = async () => {
    if (!targetUser || !directNewScore) {
      toast.error('새로운 점수를 입력해주세요.');
      return;
    }
    const newScoreNum = parseInt(directNewScore);
    if (isNaN(newScoreNum) || newScoreNum < 0) {
      toast.error('올바른 점수(0점 이상)를 입력해주세요.');
      return;
    }

    const currentScore = targetUser.safetyScore ?? 100;
    const delta = newScoreNum - currentScore;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { safetyScore: newScoreNum });

      await addDoc(collection(db, 'safetyScoreLogs'), {
        targetUid: targetUser.uid,
        targetName: targetUser.displayName || '이름 없음',
        adminUid: profile?.uid || 'admin',
        adminName: profile?.displayName || '관리자',
        adminRole: profile?.role || 'CEO',
        scoreDelta: delta,
        previousScore: currentScore,
        newScore: newScoreNum,
        reason: directEditReason ? `[관리자 직접 점수 조정] ${directEditReason}` : `[관리자 직접 점수 조정] 기존 ${currentScore}점에서 ${newScoreNum}점으로 수정`,
        type: delta >= 0 ? 'REWARD' : 'PENALTY',
        createdAt: new Date().toISOString()
      });

      toast.success(`${targetUser.displayName} 님의 안전지수가 ${newScoreNum}점으로 직접 수정되었습니다.`);
      setIsDirectEditOpen(false);
      setTargetUser(null);
      setDirectNewScore('');
      setDirectEditReason('');
    } catch (err) {
      console.error('Direct score edit error:', err);
      toast.error('점수 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Edit Log Details
  const handleOpenEditLog = (log: SafetyScoreLog) => {
    setTargetLog(log);
    setEditLogDelta(String(log.scoreDelta));
    setEditLogReason(log.reason);
    setEditLogPhotoUrl(log.photoUrl || '');
    setIsEditLogOpen(true);
  };

  const handleSaveEditLog = async () => {
    if (!targetLog) return;
    const newDeltaNum = parseInt(editLogDelta);
    if (isNaN(newDeltaNum)) {
      toast.error('올바른 변동 점수를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const oldDelta = targetLog.scoreDelta;
      const deltaDiff = newDeltaNum - oldDelta;

      // Update target user's score if delta was altered
      if (deltaDiff !== 0) {
        const userRef = doc(db, 'users', targetLog.targetUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentScore = userSnap.data().safetyScore ?? 100;
          const adjustedScore = Math.max(0, currentScore + deltaDiff);
          await updateDoc(userRef, { safetyScore: adjustedScore });
        }
      }

      // Update log doc
      const logRef = doc(db, 'safetyScoreLogs', targetLog.id);
      await updateDoc(logRef, {
        scoreDelta: newDeltaNum,
        newScore: targetLog.previousScore + newDeltaNum,
        reason: editLogReason,
        type: newDeltaNum >= 0 ? 'REWARD' : 'PENALTY',
        photoUrl: editLogPhotoUrl || null,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.displayName || '관리자'
      });

      toast.success('안전지수 기록 및 대상자 점수가 성공적으로 수정되었습니다.');
      setIsEditLogOpen(false);
      setTargetLog(null);
    } catch (err) {
      console.error('Save edited log error:', err);
      toast.error('기록 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Delete Log
  const handleOpenDeleteLog = (log: SafetyScoreLog) => {
    setTargetLog(log);
    setRollbackScoreOnDelete(true);
    setIsDeleteLogOpen(true);
  };

  const handleConfirmDeleteLog = async () => {
    if (!targetLog) return;
    setIsSubmitting(true);

    try {
      // Revert user score if rollback option is checked
      if (rollbackScoreOnDelete) {
        const userRef = doc(db, 'users', targetLog.targetUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentScore = userSnap.data().safetyScore ?? 100;
          const revertedScore = Math.max(0, currentScore - targetLog.scoreDelta);
          await updateDoc(userRef, { safetyScore: revertedScore });
        }
      }

      // Delete log
      await deleteDoc(doc(db, 'safetyScoreLogs', targetLog.id));

      toast.success(rollbackScoreOnDelete 
        ? '기록이 삭제되고 대상자 점수가 정상 원복되었습니다.' 
        : '해당 안전지수 기록이 삭제되었습니다.');
      setIsDeleteLogOpen(false);
      setTargetLog(null);
    } catch (err) {
      console.error('Delete log error:', err);
      toast.error('기록 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      if (activeTab === 'EMPLOYEES') {
        const data = filteredUsers.map((u, idx) => {
          const stats = monthlyStatsByUser[u.uid];
          const delta = stats?.delta ?? 0;
          return {
            '순위': idx + 1,
            '성명': u.displayName,
            '사번': u.employeeId || '-',
            '부서': u.departmentName || '-',
            '직급': u.position || '사원',
            '현재 안전지수': u.safetyScore ?? 100,
            [`${selectedMonth} 변동점수`]: delta > 0 ? `+${delta}` : delta,
            [`${selectedMonth} 포상건수`]: stats?.rewardCount || 0,
            [`${selectedMonth} 위반건수`]: stats?.penaltyCount || 0
          };
        });
        exportToExcel(data, `임직원_안전지수_현황_${selectedMonth}`, '안전지수현황');
      } else {
        const data = filteredLogs.map((l, idx) => {
          const user = users.find(u => u.uid === l.targetUid);
          return {
            'No': idx + 1,
            '일시': format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm'),
            '대상자': l.targetName,
            '사번': user?.employeeId || '-',
            '소속부서': user?.departmentName || '-',
            '변동점수': l.scoreDelta > 0 ? `+${l.scoreDelta}` : l.scoreDelta,
            '변동전 점수': l.previousScore,
            '변동후 점수': l.newScore,
            '사유': l.reason,
            '현장사진 첨부': l.photoUrl ? '유 (첨부됨)' : '무',
            '점검/관리자': l.adminName
          };
        });
        exportToExcel(data, `안전지수_점검이력_${selectedMonth}`, '점검이력');
      }
      toast.success('엑셀 파일이 성공적으로 다운로드되었습니다.');
    } catch (err) {
      console.error('Excel export failed:', err);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  // Export 4-items-per-page PDF Report
  const handleExportPhotoCardPDF = async () => {
    try {
      if (filteredLogs.length === 0) {
        toast.info(`${selectedMonth}에 등록된 안전점검 및 사진 내역이 없습니다.`);
        return;
      }
      toast.loading(`${selectedMonth} 안전점검 사진대지 PDF(1페이지 4건)를 생성 중입니다...`, { id: 'safety-pdf' });
      
      const items: ReportCardItem[] = filteredLogs.map((l, idx) => {
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

      await exportPhotoCardPDF({
        title: `안전 지수 변동 및 현장점검 리포트 (${selectedMonth})`,
        subtitle: `총 ${items.length}건 등록 (1페이지 4건 표준 사진대지 양식, 총 ${Math.ceil(items.length / 4) || 1}페이지)`,
        monthStr: selectedMonth,
        items,
        fileName: `안전점검사진보고서_${selectedMonth}`,
        onProgress: (cur, tot) => {
          toast.loading(`${selectedMonth} 사진대지 생성 중... (${cur}/${tot} 쪽)`, { id: 'safety-pdf' });
        }
      });

      toast.success(`${selectedMonth} 안전점검 사진 PDF(1페이지 4건) 다운로드 완료`, { id: 'safety-pdf' });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.dismiss('safety-pdf');
      toast.error('PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <PCAdminLayout title="안전지수 종합 관리 (PC Admin)">
      <div className="max-w-7xl mx-auto space-y-8 pb-20 text-foreground">
        
        {/* Top Header Card */}
        <div className="bg-card rounded-[2.5rem] p-8 border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-foreground">안전지수 점수 및 이력 관리</h2>
                <Badge className="bg-blue-500 text-white font-black text-xs px-2.5 py-0.5">PC ADMIN</Badge>
              </div>
              <p className="text-sm font-bold text-muted-foreground mt-1">
                전사 임직원의 안전지수를 모니터링하고, 가점/감점 부여, 직접 점수 수정, 잘못된 기록 삭제를 통합 관리합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => {
                setTargetUser(null);
                setAdjustmentType('REWARD');
                setScoreDelta('5');
                setReason('');
                setPhotoUrl('');
                setIsNewAdjustmentOpen(true);
              }}
              className="h-11 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> 신규 안전점수/점검 등록
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPhotoCardPDF}
              className="h-11 px-4 rounded-2xl border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-black text-xs gap-2"
            >
              <FileText className="w-4 h-4" /> 월별 사진리포트 PDF (4건/장)
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="h-11 px-4 rounded-2xl border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-black text-xs gap-2"
            >
              <Download className="w-4 h-4" /> 엑셀 다운로드
            </Button>
          </div>
        </div>

        {/* Analytics 4-Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">전사 평균 안전지수</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {analytics.avgScore} <span className="text-sm font-bold text-muted-foreground">pts</span>
              </h3>
              <p className="text-[11px] font-bold text-muted-foreground mt-1">총 {analytics.totalUsers}명 임직원</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">{selectedMonth.slice(5)}월 포상 가점</p>
              <h3 className="text-2xl font-black text-emerald-500 mt-1">
                +{analytics.totalRewardDelta} <span className="text-sm font-bold text-muted-foreground">pts</span>
              </h3>
              <p className="text-[11px] font-bold text-emerald-600 mt-1">총 {analytics.rewardLogsCount}건 우수 활동</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">{selectedMonth.slice(5)}월 수칙위반 감점</p>
              <h3 className="text-2xl font-black text-rose-500 mt-1">
                -{analytics.totalPenaltyDelta} <span className="text-sm font-bold text-muted-foreground">pts</span>
              </h3>
              <p className="text-[11px] font-bold text-rose-600 mt-1">총 {analytics.penaltyLogsCount}건 지적 사항</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">안전 모범 비율 (100점+)</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {analytics.exemplaryRate}%
              </h3>
              <p className="text-[11px] font-bold text-blue-600 mt-1">{analytics.exemplaryCount}명 모범 등급</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Main Tab Controller & Month Filter */}
        <div className="bg-card rounded-[2rem] p-6 border border-border shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-border pb-6">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-2 bg-muted p-1.5 rounded-2xl max-w-md">
              <button
                onClick={() => {
                  setActiveTab('EMPLOYEES');
                  setFilterUserUid(null);
                }}
                className={cn(
                  "flex-1 py-2.5 px-5 rounded-xl text-xs font-black transition-all",
                  activeTab === 'EMPLOYEES'
                    ? "bg-card text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                임직원별 안전지수 관리 ({filteredUsers.length}명)
              </button>
              <button
                onClick={() => setActiveTab('LOGS')}
                className={cn(
                  "flex-1 py-2.5 px-5 rounded-xl text-xs font-black transition-all",
                  activeTab === 'LOGS'
                    ? "bg-card text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                점검 및 점수 변동 이력 ({filteredLogs.length}건)
              </button>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" /> 기준 월 선택:
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-muted px-4 py-2.5 rounded-xl text-xs font-black border border-border text-foreground cursor-pointer focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* TAB 1: EMPLOYEES VIEW */}
          {activeTab === 'EMPLOYEES' && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="임직원 성명 또는 사번 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-12 pl-11 bg-muted border-border rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="h-12 bg-muted px-4 rounded-xl text-xs font-bold border border-border text-foreground cursor-pointer"
                  >
                    <option value="all">전체 부서</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <select
                    value={scoreGradeFilter}
                    onChange={(e) => setScoreGradeFilter(e.target.value as any)}
                    className="h-12 bg-muted px-4 rounded-xl text-xs font-bold border border-border text-foreground cursor-pointer"
                  >
                    <option value="all">전체 등급</option>
                    <option value="high">최우수 (120점 이상)</option>
                    <option value="normal">우수 (100 ~ 119점)</option>
                    <option value="low">주의 (80 ~ 99점)</option>
                    <option value="danger">경고 (80점 미만)</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      <th className="py-4 px-6 text-center w-16">순위</th>
                      <th className="py-4 px-6">임직원 정보</th>
                      <th className="py-4 px-6">소속 부서 / 직급</th>
                      <th className="py-4 px-6 text-center">현재 안전지수</th>
                      <th className="py-4 px-6 text-center">{selectedMonth.slice(5)}월 변동점수</th>
                      <th className="py-4 px-6 text-center">최근 점검사진</th>
                      <th className="py-4 px-6 text-center w-60">관리 작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-muted-foreground font-bold">
                          검색 조건에 해당하는 임직원이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, idx) => {
                        const score = user.safetyScore ?? 100;
                        const stats = monthlyStatsByUser[user.uid];
                        const delta = stats?.delta ?? 0;
                        const photo = stats?.latestPhoto;

                        return (
                          <tr key={user.uid} className="hover:bg-muted/30 transition-colors">
                            <td className="py-4 px-6 text-center font-black">
                              <span className={cn(
                                "inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs",
                                idx === 0 ? "bg-amber-500/20 text-amber-600 font-black" :
                                idx === 1 ? "bg-slate-300/40 text-slate-700 font-black" :
                                idx === 2 ? "bg-amber-700/20 text-amber-800 font-black" : "text-muted-foreground"
                              )}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-black overflow-hidden shrink-0">
                                  {(user as any).profileImage ? (
                                    <img src={(user as any).profileImage} alt={user.displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 opacity-60" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-black text-sm text-foreground">{user.displayName}</div>
                                  <div className="text-[11px] font-bold text-muted-foreground">사번: {user.employeeId || '-'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 font-bold text-muted-foreground">
                              <div>{user.departmentName || '부서미지정'}</div>
                              <div className="text-[11px] opacity-70">{user.position || '사원'}</div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className={cn(
                                  "text-base font-black px-3 py-1 rounded-xl",
                                  score >= 120 ? "bg-emerald-500/15 text-emerald-600" :
                                  score >= 100 ? "bg-blue-500/15 text-blue-600" :
                                  score >= 80 ? "bg-amber-500/15 text-amber-600" :
                                  "bg-rose-500/15 text-rose-600"
                                )}>
                                  {score} pts
                                </span>
                                <span className="text-[10px] font-black text-muted-foreground mt-0.5">
                                  {score >= 120 ? '최우수 모범' : score >= 100 ? '안전 우수' : score >= 80 ? '주의 관찰' : '경고 대상'}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center font-black">
                              {delta !== 0 ? (
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black",
                                  delta > 0 ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10"
                                )}>
                                  {delta > 0 ? `+${delta}` : delta}점
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {photo ? (
                                <button
                                  onClick={() => setViewingPhotoUrl({ url: photo, title: `${user.displayName} 현장 사진` })}
                                  className="group relative w-12 h-12 rounded-xl overflow-hidden border border-border inline-block hover:ring-2 hover:ring-primary transition-all"
                                >
                                  <img src={photo} alt="Thumbnail" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                  </div>
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/50 font-bold">미첨부</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setTargetUser(user);
                                    setDirectNewScore(String(score));
                                    setDirectEditReason('');
                                    setIsDirectEditOpen(true);
                                  }}
                                  className="h-8 px-2.5 rounded-xl text-xs font-black border-border hover:bg-muted"
                                >
                                  <Edit3 className="w-3.5 h-3.5 mr-1" /> 점수 직접수정
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    setTargetUser(user);
                                    setAdjustmentType('REWARD');
                                    setScoreDelta('5');
                                    setReason('');
                                    setPhotoUrl('');
                                    setIsNewAdjustmentOpen(true);
                                  }}
                                  className="h-8 px-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-0.5" /> 가/감점
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setFilterUserUid(user.uid);
                                    setActiveTab('LOGS');
                                  }}
                                  className="h-8 px-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
                                >
                                  이력
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LOGS VIEW */}
          {activeTab === 'LOGS' && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="대상자, 사유, 점검/관리자 성명 검색..."
                    value={logSearchTerm}
                    onChange={(e) => setLogSearchTerm(e.target.value)}
                    className="h-12 pl-11 bg-muted border-border rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <select
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value as any)}
                    className="h-12 bg-muted px-4 rounded-xl text-xs font-bold border border-border text-foreground cursor-pointer"
                  >
                    <option value="all">전체 구분 (가점/감점)</option>
                    <option value="REWARD">포상 가점만 (+)</option>
                    <option value="PENALTY">수칙위반 감점만 (-)</option>
                  </select>

                  {filterUserUid && (
                    <Button
                      variant="outline"
                      onClick={() => setFilterUserUid(null)}
                      className="h-12 px-4 rounded-xl text-xs font-black text-rose-500 border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 gap-1.5"
                    >
                      <X className="w-4 h-4" /> 전체 사원 보기
                    </Button>
                  )}
                </div>
              </div>

              {/* Logs Table */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      <th className="py-4 px-6 text-center w-14">No</th>
                      <th className="py-4 px-6">점검 일시</th>
                      <th className="py-4 px-6">대상 임직원</th>
                      <th className="py-4 px-6 text-center">변동 점수</th>
                      <th className="py-4 px-6 text-center">점수 변화</th>
                      <th className="py-4 px-6">점검 사유 및 조치사항</th>
                      <th className="py-4 px-6 text-center">현장 사진</th>
                      <th className="py-4 px-6">점검/관리자</th>
                      <th className="py-4 px-6 text-center w-36">관리 작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-medium">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-16 text-muted-foreground font-bold">
                          해당 조건에 일치하는 점검 및 점수 변동 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log, idx) => {
                        const isReward = log.scoreDelta > 0;
                        const user = users.find(u => u.uid === log.targetUid);

                        return (
                          <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-4 px-6 text-center font-bold text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="py-4 px-6 font-bold text-foreground whitespace-nowrap">
                              {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-black text-sm text-foreground">{log.targetName}</div>
                              <div className="text-[11px] text-muted-foreground font-bold">
                                {user?.departmentName || '현장'} / {user?.employeeId || '-'}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <Badge className={cn(
                                "font-black text-xs px-2.5 py-0.5",
                                isReward ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20" : "bg-rose-500/15 text-rose-600 border border-rose-500/20"
                              )}>
                                {isReward ? `+${log.scoreDelta}점` : `${log.scoreDelta}점`}
                              </Badge>
                            </td>
                            <td className="py-4 px-6 text-center font-black text-muted-foreground whitespace-nowrap">
                              <span>{log.previousScore}점</span>
                              <span className="mx-1 text-primary">→</span>
                              <span className={cn(isReward ? "text-emerald-600" : "text-rose-600")}>{log.newScore}점</span>
                            </td>
                            <td className="py-4 px-6 font-bold text-foreground max-w-xs">
                              <p className="line-clamp-2 leading-relaxed">{log.reason}</p>
                            </td>
                            <td className="py-4 px-6 text-center">
                              {log.photoUrl ? (
                                <button
                                  onClick={() => setViewingPhotoUrl({ url: log.photoUrl!, title: `${log.targetName} 현장점검 사진` })}
                                  className="group relative w-12 h-12 rounded-xl overflow-hidden border border-border inline-block hover:ring-2 hover:ring-primary transition-all"
                                >
                                  <img src={log.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                  </div>
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/50 font-bold">미첨부</span>
                              )}
                            </td>
                            <td className="py-4 px-6 font-bold text-muted-foreground whitespace-nowrap">
                              <div>{log.adminName}</div>
                              <div className="text-[10px] opacity-70">({log.adminRole})</div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenEditLog(log)}
                                  className="h-8 px-2.5 rounded-xl text-xs font-black border-border hover:bg-muted"
                                >
                                  <Edit3 className="w-3.5 h-3.5 mr-1 text-blue-500" /> 수정
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenDeleteLog(log)}
                                  className="h-8 px-2.5 rounded-xl text-xs font-black border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* DIALOG 1: NEW SCORE ADJUSTMENT MODAL */}
        <Dialog open={isNewAdjustmentOpen} onOpenChange={setIsNewAdjustmentOpen}>
          <DialogContent className="bg-card border border-border rounded-3xl max-w-lg text-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-500" /> 신규 안전점검 및 점수 등록
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-muted-foreground">
                현장 모범 활동에 가점을 부여하거나 안전수칙 위반에 감점을 적용합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-3">
              {/* Target User Selector */}
              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">대상 임직원 선택</label>
                <select
                  value={targetUser?.uid || ''}
                  onChange={(e) => {
                    const found = users.find(u => u.uid === e.target.value);
                    setTargetUser(found || null);
                  }}
                  className="w-full h-12 bg-muted px-4 rounded-xl text-xs font-black border border-border text-foreground"
                >
                  <option value="">-- 임직원을 선택하세요 --</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.departmentName || '부서미지정'} / 사번: {u.employeeId || '-'}) - 현재: {u.safetyScore ?? 100}점
                    </option>
                  ))}
                </select>
              </div>

              {/* Adjustment Type & Delta */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-muted-foreground block mb-1.5">구분</label>
                  <div className="flex bg-muted p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('REWARD')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                        adjustmentType === 'REWARD' ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      포상 가점 (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('PENALTY')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                        adjustmentType === 'PENALTY' ? "bg-rose-500 text-white shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      수칙위반 감점 (-)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-muted-foreground block mb-1.5">변동 점수 (양수 입력)</label>
                  <Input
                    type="number"
                    min="1"
                    value={scoreDelta}
                    onChange={(e) => setScoreDelta(e.target.value)}
                    placeholder="예: 5"
                    className="h-10 bg-muted border-border font-black text-sm"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">점검 및 조치 사유</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 현장 안전모 및 각반 착용 모범, 위험 요소 선제적 보고 및 조치 완료"
                  rows={3}
                  className="w-full bg-muted border border-border rounded-xl p-3 text-xs font-bold text-foreground placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">현장 사진 첨부 (선택)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, setPhotoUrl)}
                  className="w-full text-xs font-bold text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white cursor-pointer bg-muted p-2 rounded-xl border border-border"
                />
                {photoUrl && (
                  <div className="mt-3 relative w-24 h-24 rounded-2xl overflow-hidden border border-border shadow-md">
                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsNewAdjustmentOpen(false)}
                className="h-11 rounded-xl font-bold"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateAdjustment}
                disabled={isSubmitting || !targetUser}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl"
              >
                {isSubmitting ? '저장 중...' : '점수 반영하기'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 2: DIRECT SCORE OVERWRITE MODAL */}
        <Dialog open={isDirectEditOpen} onOpenChange={setIsDirectEditOpen}>
          <DialogContent className="bg-card border border-border rounded-3xl max-w-md text-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-500" /> 임직원 안전지수 직접 수정
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-muted-foreground">
                관리자 권한으로 해당 임직원의 현재 안전지수를 원하는 점수로 직접 변경합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-3">
              <div className="bg-muted p-4 rounded-2xl flex items-center justify-between border border-border">
                <div>
                  <h4 className="font-black text-sm text-foreground">{targetUser?.displayName}</h4>
                  <p className="text-xs font-bold text-muted-foreground">{targetUser?.departmentName} / 사번: {targetUser?.employeeId || '-'}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-muted-foreground">현재 점수</div>
                  <div className="text-lg font-black text-blue-600">{targetUser?.safetyScore ?? 100} pts</div>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">새로운 안전지수 (pts)</label>
                <Input
                  type="number"
                  min="0"
                  value={directNewScore}
                  onChange={(e) => setDirectNewScore(e.target.value)}
                  placeholder="예: 105"
                  className="h-12 bg-muted border-border font-black text-base"
                />
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">직접 수정 사유</label>
                <Input
                  value={directEditReason}
                  onChange={(e) => setDirectEditReason(e.target.value)}
                  placeholder="예: 안전교육 소급 적용 또는 전산 오입력 수정"
                  className="h-11 bg-muted border-border font-bold text-xs"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDirectEditOpen(false)}
                className="h-11 rounded-xl font-bold"
              >
                취소
              </Button>
              <Button
                onClick={handleDirectScoreEdit}
                disabled={isSubmitting}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl"
              >
                {isSubmitting ? '수정 중...' : '점수 변경 적용'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 3: EDIT LOG MODAL */}
        <Dialog open={isEditLogOpen} onOpenChange={setIsEditLogOpen}>
          <DialogContent className="bg-card border border-border rounded-3xl max-w-lg text-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-500" /> 점검 및 변동 이력 수정
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-muted-foreground">
                변동 점수를 변경하면 대상 임직원의 현재 안전지수도 차액만큼 자동 동기화됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-3">
              <div className="bg-muted p-4 rounded-2xl border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-muted-foreground">대상 임직원</div>
                  <div className="text-sm font-black text-foreground">{targetLog?.targetName}</div>
                </div>
                <div>
                  <div className="text-xs font-black text-muted-foreground">등록 일시</div>
                  <div className="text-xs font-bold text-foreground">
                    {targetLog && format(new Date(targetLog.createdAt), 'yyyy-MM-dd HH:mm')}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">변동 점수 (가점은 +, 감점은 -)</label>
                <Input
                  type="number"
                  value={editLogDelta}
                  onChange={(e) => setEditLogDelta(e.target.value)}
                  placeholder="예: 5 또는 -10"
                  className="h-11 bg-muted border-border font-black text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">점검 및 조치 사유</label>
                <textarea
                  value={editLogReason}
                  onChange={(e) => setEditLogReason(e.target.value)}
                  rows={3}
                  className="w-full bg-muted border border-border rounded-xl p-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground block mb-1.5">현장 사진 변경</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, setEditLogPhotoUrl)}
                  className="w-full text-xs font-bold text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white cursor-pointer bg-muted p-2 rounded-xl border border-border"
                />
                {editLogPhotoUrl && (
                  <div className="mt-3 relative w-24 h-24 rounded-2xl overflow-hidden border border-border shadow-md">
                    <img src={editLogPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditLogPhotoUrl('')}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditLogOpen(false)}
                className="h-11 rounded-xl font-bold"
              >
                취소
              </Button>
              <Button
                onClick={handleSaveEditLog}
                disabled={isSubmitting}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl"
              >
                {isSubmitting ? '수정 저장 중...' : '기록 수정 완료'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 4: DELETE LOG CONFIRMATION MODAL */}
        <Dialog open={isDeleteLogOpen} onOpenChange={setIsDeleteLogOpen}>
          <DialogContent className="bg-card border border-border rounded-3xl max-w-md text-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2 text-rose-500">
                <AlertTriangle className="w-6 h-6" /> 점검 및 변동 기록 삭제
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-muted-foreground">
                이 기록을 삭제하면 복구할 수 없습니다. 계속하시겠습니까?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-3">
              <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 space-y-2">
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-rose-600">대상 임직원:</span>
                  <span className="text-foreground">{targetLog?.targetName}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-rose-600">등록된 변동 점수:</span>
                  <span className="text-foreground font-black">
                    {targetLog && (targetLog.scoreDelta > 0 ? `+${targetLog.scoreDelta}점` : `${targetLog.scoreDelta}점`)}
                  </span>
                </div>
                <div className="text-xs font-bold text-muted-foreground pt-1 border-t border-rose-500/20">
                  사유: {targetLog?.reason}
                </div>
              </div>

              {/* Rollback Checkbox */}
              <label className="flex items-start gap-3 p-3 bg-muted rounded-xl cursor-pointer border border-border">
                <input
                  type="checkbox"
                  checked={rollbackScoreOnDelete}
                  onChange={(e) => setRollbackScoreOnDelete(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-black text-foreground">대상자의 안전지수도 원복(롤백)합니다</div>
                  <div className="font-medium text-muted-foreground text-[11px] mt-0.5">
                    체크 시 대상자의 현재 점수에서 변동된 {targetLog?.scoreDelta}점이 자동으로 취소 계산됩니다.
                  </div>
                </div>
              </label>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteLogOpen(false)}
                className="h-11 rounded-xl font-bold"
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteLog}
                disabled={isSubmitting}
                className="h-11 px-6 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl"
              >
                {isSubmitting ? '삭제 중...' : '기록 영구 삭제'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 5: FULL-SIZE PHOTO VIEWER */}
        <Dialog open={!!viewingPhotoUrl} onOpenChange={() => setViewingPhotoUrl(null)}>
          <DialogContent className="bg-card border border-border rounded-3xl max-w-3xl text-foreground p-6">
            <DialogHeader className="mb-3">
              <DialogTitle className="text-base font-black flex items-center justify-between">
                <span>{viewingPhotoUrl?.title || '현장 점검 사진'}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[75vh] overflow-hidden rounded-2xl border border-border bg-black flex items-center justify-center">
              {viewingPhotoUrl && (
                <img
                  src={viewingPhotoUrl.url}
                  alt="Enlarged"
                  className="max-h-[75vh] w-auto object-contain mx-auto"
                />
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setViewingPhotoUrl(null)}
                className="w-full h-11 rounded-xl font-black"
              >
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </PCAdminLayout>
  );
};

export default PCAdminSafety;
