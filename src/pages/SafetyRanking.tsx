import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { UserProfile, SafetyScoreLog, Department } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { startOfMonth, subMonths } from 'date-fns';
import { 
  Trophy, 
  Search, 
  History, 
  Star, 
  ShieldAlert, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  HardHat,
  Filter,
  Circle,
  Plus,
  Minus,
  LayoutDashboard,
  Save
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const SafetyRanking: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [logs, setLogs] = useState<SafetyScoreLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [activeView, setActiveView] = useState<'INDIVIDUAL' | 'TEAM' | 'LOGS'>('INDIVIDUAL');
  const [loading, setLoading] = useState(true);

  // Admin Modal State
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [scoreDelta, setScoreDelta] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'REWARD' | 'PENALTY'>('REWARD');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role));

  useEffect(() => {
    // Sync Users
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(userData);
      setLoading(false);
    });

    // Sync Departments
    const unsubscribeDepts = onSnapshot(query(collection(db, 'departments'), orderBy('name')), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    });

    // Sync Logs
    const unsubscribeLogs = onSnapshot(query(collection(db, 'safetyScoreLogs'), orderBy('createdAt', 'desc')), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyScoreLog)));
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
        const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDeptId === 'all' || user.departmentId === selectedDeptId;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => (b.safetyScore || 0) - (a.safetyScore || 0));
  }, [users, searchTerm, selectedDeptId]);

  const userMonthlyStats = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    
    const stats: Record<string, { currentMonthDelta: number, prevMonthDelta: number }> = {};

    logs.forEach(log => {
      const logDate = new Date(log.createdAt);
      const isCurrentMonth = logDate >= currentMonthStart;
      const isPrevMonth = logDate >= prevMonthStart && logDate < currentMonthStart;

      if (!stats[log.targetUid]) {
        stats[log.targetUid] = { currentMonthDelta: 0, prevMonthDelta: 0 };
      }

      if (isCurrentMonth) {
        stats[log.targetUid].currentMonthDelta += log.scoreDelta;
      } else if (isPrevMonth) {
        stats[log.targetUid].prevMonthDelta += log.scoreDelta;
      }
    });

    return stats;
  }, [logs]);

  const teamRankings = useMemo(() => {
    const deptMap: Record<string, { id: string; name: string; totalScore: number; count: number; average: number, currentMonthDelta: number, prevMonthDelta: number }> = {};
    
    users.forEach(user => {
      if (!user.departmentId) return;
      const deptName = user.departmentName || 'Unknown';
      if (!deptMap[user.departmentId]) {
        deptMap[user.departmentId] = { id: user.departmentId, name: deptName, totalScore: 0, count: 0, average: 0, currentMonthDelta: 0, prevMonthDelta: 0 };
      }
      deptMap[user.departmentId].totalScore += (user.safetyScore ?? 100);
      deptMap[user.departmentId].count += 1;

      const userStat = userMonthlyStats[user.uid] || { currentMonthDelta: 0, prevMonthDelta: 0 };
      deptMap[user.departmentId].currentMonthDelta += userStat.currentMonthDelta;
      deptMap[user.departmentId].prevMonthDelta += userStat.prevMonthDelta;
    });

    return Object.values(deptMap)
      .map(d => ({ ...d, average: d.count > 0 ? d.totalScore / d.count : 0 }))
      .sort((a, b) => b.average - a.average);
  }, [users, userMonthlyStats]);

  const handleAdjustScore = async () => {
    if (!targetUser || !scoreDelta || !reason || !profile) return;
    const rawDelta = parseInt(scoreDelta);
    if (isNaN(rawDelta)) {
      toast.error('올바른 숫자를 입력해주세요.');
      return;
    }

    const delta = adjustmentType === 'REWARD' ? Math.abs(rawDelta) : -Math.abs(rawDelta);

    setIsSaving(true);
    const prevScore = targetUser.safetyScore ?? 100;
    const newScore = prevScore + delta;

    try {
      // 1. Update User
      await updateDoc(doc(db, 'users', targetUser.uid), {
        safetyScore: newScore,
        safetyScoreLastUpdate: new Date().toISOString()
      });

      // 2. Add Log
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
        createdAt: new Date().toISOString()
      });

      toast.success(`${targetUser.displayName}님의 안전지수 점수가 업데이트되었습니다.`);
      setIsAdjustmentOpen(false);
      setScoreDelta('');
      setAdjustmentType('REWARD');
      setReason('');
      setTargetUser(null);
    } catch (error) {
      toast.error('점수 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-4 bg-white p-5 rounded-[2rem] shadow-xl border border-slate-100 ring-2 ring-primary/5">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tighter text-slate-900 leading-none">안전지수 랭킹</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 flex items-center gap-1.5">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" /> Safety Performance Index
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-200/50 p-1.5 rounded-[2rem] flex gap-1.5 shadow-inner">
          <button
            onClick={() => setActiveView('INDIVIDUAL')}
            className={cn(
              "flex-1 h-14 rounded-[1.7rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeView === 'INDIVIDUAL' 
                ? "bg-white text-slate-900 shadow-lg shadow-slate-200/50 scale-100" 
                : "text-slate-500 hover:text-slate-700 scale-95 opacity-70"
            )}
          >
            <UserIcon className="w-4 h-4" /> 개인별
          </button>
          <button
            onClick={() => setActiveView('TEAM')}
            className={cn(
              "flex-1 h-14 rounded-[1.7rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeView === 'TEAM' 
                ? "bg-white text-slate-900 shadow-lg shadow-slate-200/50 scale-100" 
                : "text-slate-500 hover:text-slate-700 scale-95 opacity-70"
            )}
          >
            <TrendingUp className="w-4 h-4" /> 팀별
          </button>
          <button
            onClick={() => setActiveView('LOGS')}
            className={cn(
              "flex-1 h-14 rounded-[1.7rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeView === 'LOGS' 
                ? "bg-white text-slate-900 shadow-lg shadow-slate-200/50 scale-100" 
                : "text-slate-500 hover:text-slate-700 scale-95 opacity-70"
            )}
          >
            <History className="w-4 h-4" /> 히스토리
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="space-y-6">
        {activeView === 'INDIVIDUAL' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Search and Filter */}
            <div className="flex flex-col gap-3">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="이름 또는 사번 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-14 pl-14 bg-white border-none rounded-2xl font-bold shadow-sm placeholder:text-slate-300 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setSelectedDeptId('all')}
                  className={cn(
                    "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                    selectedDeptId === 'all' ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-400 border border-slate-100"
                  )}
                >
                  전체
                </button>
                {departments.map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                      selectedDeptId === dept.id ? "bg-primary text-white shadow-md" : "bg-white text-slate-400 border border-slate-100"
                    )}
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
            </div>

            {/* User List */}
            <div className="space-y-3">
              {filteredUsers.map((user, idx) => (
                <motion.div
                  key={user.uid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all">
                    <CardContent className="p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner",
                          idx === 0 ? "bg-yellow-100 text-yellow-600" : 
                          idx === 1 ? "bg-slate-100 text-slate-400" :
                          idx === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-300"
                        )}>
                          {idx < 3 ? <Trophy className="w-6 h-6" /> : (idx + 1)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-900 tracking-tight leading-none">{user.displayName}</h4>
                            <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[8px] uppercase px-1.5 py-0.5 rounded-lg tracking-tighter">
                              {user.departmentName || '부서미지정'}
                            </Badge>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">{user.employeeId}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={cn(
                            "text-2xl font-black tracking-tighter leading-none",
                            (user.safetyScore ?? 100) >= 100 ? "text-emerald-500" : 
                            (user.safetyScore ?? 100) >= 80 ? "text-orange-500" : "text-red-500"
                          )}>
                            {user.safetyScore ?? 100}
                          </div>
                          <div className="flex flex-col items-end mt-1">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Score</p>
                            {userMonthlyStats[user.uid] && (
                              <div className={cn(
                                "flex items-center gap-0.5 text-[8px] font-black tracking-tighter mt-1",
                                (userMonthlyStats[user.uid].currentMonthDelta - userMonthlyStats[user.uid].prevMonthDelta) >= 0 ? "text-emerald-500" : "text-red-500"
                              )}>
                                {(userMonthlyStats[user.uid].currentMonthDelta - userMonthlyStats[user.uid].prevMonthDelta) >= 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                                {Math.abs(userMonthlyStats[user.uid].currentMonthDelta - userMonthlyStats[user.uid].prevMonthDelta)}
                                <span className="text-slate-300 ml-0.5 font-bold uppercase tracking-widest scale-75">Prev</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setTargetUser(user);
                              setAdjustmentType('REWARD');
                              setIsAdjustmentOpen(true);
                            }}
                            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                          >
                            <Plus className="w-5 h-5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'TEAM' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {teamRankings.map((team, idx) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="text-lg font-black tracking-tight text-slate-900">{team.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{team.count} Employees</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-primary tracking-tighter leading-none">
                          {team.average.toFixed(1)}
                        </div>
                        <div className="flex flex-col items-end mt-1.5">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none">Avg Score</p>
                          {(team.currentMonthDelta !== 0 || team.prevMonthDelta !== 0) && (
                            <div className={cn(
                              "flex items-center gap-0.5 text-[9px] font-black tracking-tighter mt-1.5",
                              (team.currentMonthDelta - team.prevMonthDelta) >= 0 ? "text-emerald-500" : "text-red-500"
                            )}>
                              {(team.currentMonthDelta - team.prevMonthDelta) >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                              {Math.abs(team.currentMonthDelta - team.prevMonthDelta).toFixed(1)}
                              <span className="text-slate-300 ml-0.5 font-bold uppercase tracking-widest scale-75">Prev</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(team.average, 100)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={cn(
                          "h-full rounded-full shadow-[0_0_10px_rgba(37,99,235,0.3)]",
                          team.average >= 95 ? "bg-emerald-500" :
                          team.average >= 85 ? "bg-primary" :
                          team.average >= 70 ? "bg-orange-500" : "bg-red-500"
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {activeView === 'LOGS' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {logs.map((log, idx) => (
              <Card key={log.id} className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                    log.type === 'REWARD' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {log.type === 'REWARD' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-slate-900 tracking-tight leading-none truncate max-w-[150px]">
                        {log.targetName}
                      </h4>
                      <Badge className={cn(
                        "border-none font-black text-[10px] px-2 py-0.5 rounded-lg",
                        log.type === 'REWARD' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                      )}>
                        {log.scoreDelta > 0 ? `+${log.scoreDelta}` : log.scoreDelta}
                      </Badge>
                    </div>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 shadow-inner">
                      {log.reason}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-black text-slate-400 capitalize">{log.adminName} ({log.adminRole})</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-300">{new Date(log.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {logs.length === 0 && (
              <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                <History className="w-12 h-12 text-slate-200" />
                <p className="font-black text-sm uppercase tracking-widest text-slate-300">히스토리가 없습니다</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adjustment Dialog */}
      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent className="bg-white border-none rounded-[3rem] shadow-2xl max-w-sm w-[95%] p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-slate-900 text-white text-left shrink-0">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400">
                <Star className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tighter">안전지수 점수 변동</DialogTitle>
                <DialogDescription className="text-slate-400 font-bold italic text-xs uppercase tracking-widest">Adjust Individual Score</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-slate-400 shadow-sm border border-slate-100">
                {targetUser?.displayName.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-slate-900 leading-none mb-1.5">{targetUser?.displayName}</h4>
                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase leading-none">{targetUser?.employeeId}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[9px] font-black text-slate-300 uppercase mb-1 leading-none">Current</p>
                <p className="text-xl font-black text-primary leading-none tracking-tighter">{targetUser?.safetyScore ?? 100}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">상벌 구분</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    onClick={() => setAdjustmentType('REWARD')}
                    className={cn(
                      "h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all gap-2 flex items-center justify-center",
                      adjustmentType === 'REWARD' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Plus className="w-4 h-4" /> 상점 (+)
                  </button>
                  <button
                    onClick={() => setAdjustmentType('PENALTY')}
                    className={cn(
                      "h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all gap-2 flex items-center justify-center",
                      adjustmentType === 'PENALTY' ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Minus className="w-4 h-4" /> 벌점 (-)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">상벌 점수 (숫자만 입력)</label>
                <div className="flex items-center gap-2">
                   <div className="flex-1 relative">
                     {adjustmentType === 'REWARD' ? (
                       <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500 pointer-events-none" />
                     ) : (
                       <Minus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500 pointer-events-none" />
                     )}
                     <Input 
                      type="number"
                      inputMode="numeric"
                      placeholder="숫자 입력 (예: 10)" 
                      value={scoreDelta}
                      onChange={(e) => setScoreDelta(e.target.value)}
                      className={cn(
                        "h-14 pl-12 bg-slate-50 border-slate-200 rounded-2xl font-black text-lg focus:ring-2",
                        adjustmentType === 'REWARD' ? "focus:ring-emerald-500/20" : "focus:ring-red-500/20"
                      )}
                    />
                   </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">사유 입력</label>
                <Input 
                  placeholder="점수 변동 사유를 입력해주세요" 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 pb-10 flex flex-col gap-2">
            <Button 
              className="h-16 w-full rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg gap-2 shadow-xl active:scale-[0.98] transition-all"
              onClick={handleAdjustScore}
              disabled={isSaving || !scoreDelta || !reason}
            >
              {isSaving ? "처리 중..." : <><Save className="w-5 h-5" /> 변동사항 적용하기</>}
            </Button>
            <Button variant="ghost" onClick={() => setIsAdjustmentOpen(false)} className="h-12 w-full text-slate-400 font-bold uppercase tracking-widest">
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
