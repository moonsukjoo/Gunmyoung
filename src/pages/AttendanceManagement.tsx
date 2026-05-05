import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  where, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { UserProfile, Attendance } from '@/src/types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Users, 
  Search, 
  Calendar, 
  Clock, 
  Edit2, 
  Save, 
  X, 
  ChevronRight,
  TrendingUp,
  AlertCircle,
  ArrowLeft,
  Calculator,
  Download,
  FileText
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { calculateAttendanceHours } from '@/src/lib/attendance';
import { exportToExcel, exportToPDF } from '@/src/lib/exportUtils';

import { GlowLoading } from '@/src/components/GlowLoading';

export const AttendanceManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    clockIn: string;
    clockOut: string;
    workHours: string;
    overtimeHours: string;
  }>({
    clockIn: '',
    clockOut: '',
    workHours: '',
    overtimeHours: ''
  });

  // Fetch all users
  useEffect(() => {
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      await minLoadTime;
      setInitialLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setInitialLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch attendance for selected user and month
  useEffect(() => {
    if (!selectedUser) {
      setAttendanceData([]);
      return;
    }

    setLoading(true);
    const start = startOfMonth(parseISO(month + '-01'));
    const end = endOfMonth(start);

    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', selectedUser.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd')),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAttendanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedUser, month]);

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.departmentName?.toLowerCase().includes(search.toLowerCase())
  );

  const startEditing = (att: Attendance) => {
    setEditingId(att.id);
    setEditForm({
      clockIn: att.clockIn ? format(new Date(att.clockIn), "yyyy-MM-dd'T'HH:mm") : '',
      clockOut: att.clockOut ? format(new Date(att.clockOut), "yyyy-MM-dd'T'HH:mm") : '',
      workHours: att.workHours?.toString() || '0',
      overtimeHours: att.overtimeHours?.toString() || '0'
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const updates: any = {
        workHours: parseFloat(editForm.workHours),
        overtimeHours: parseFloat(editForm.overtimeHours)
      };

      if (editForm.clockIn) {
        updates.clockIn = new Date(editForm.clockIn).toISOString();
      }
      if (editForm.clockOut) {
        updates.clockOut = new Date(editForm.clockOut).toISOString();
      } else {
        updates.clockOut = null;
      }

      await updateDoc(doc(db, 'attendance', id), updates);
      setEditingId(null);
      toast.success('근태 기록이 수정되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleRecalculate = () => {
    if (!editForm.clockIn || !editForm.clockOut) {
      toast.error('출근 시간과 퇴근 시간이 모두 필요합니다.');
      return;
    }

    const { workHours, overtimeHours } = calculateAttendanceHours(
      new Date(editForm.clockIn),
      new Date(editForm.clockOut)
    );

    setEditForm({
      ...editForm,
      workHours: workHours.toString(),
      overtimeHours: overtimeHours.toString()
    });
    toast.success('근무 시간이 재계산되었습니다.');
  };

  const stats = useMemo(() => {
    const total = attendanceData.reduce((acc, curr) => acc + (curr.workHours || 0), 0);
    const ot = attendanceData.reduce((acc, curr) => acc + (curr.overtimeHours || 0), 0);
    return { total, ot };
  }, [attendanceData]);

  const handleExportExcel = () => {
    if (!selectedUser || attendanceData.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const data = attendanceData.map(att => ({
      '날짜': att.date,
      '출근시간': att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '-',
      '퇴근시간': att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '-',
      '기본시간': att.workHours || 0,
      '잔업시간': att.overtimeHours || 0,
      '총시간': (att.workHours || 0) + (att.overtimeHours || 0)
    }));
    exportToExcel(data, `${selectedUser.displayName}_근태보고서_${month}`, '근태기록');
  };

  const handleExportPDF = async () => {
    if (!selectedUser || attendanceData.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const headers = ['날짜', '출근', '퇴근', '기본(h)', '잔업(h)'];
    const data = attendanceData.map(att => [
      att.date,
      att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '-',
      att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '-',
      att.workHours?.toFixed(1) || '0.0',
      att.overtimeHours?.toFixed(1) || '0.0'
    ]);
    await exportToPDF(`${selectedUser.displayName} 근태 보고서 (${month})`, headers, data, `${selectedUser.displayName}_근태_${month}`);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="p-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">근태 관리</h1>
            <p className="text-xs font-bold text-muted-foreground">사용자별 근태 기록 확인 및 조정</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2 relative">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="성명 검색으로 대상자 선택" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12 bg-card border-none text-sm font-bold rounded-xl"
                />
                
                <AnimatePresence>
                  {search.length > 0 && filteredUsers.length > 0 && !selectedUser && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-card border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden max-h-60 overflow-y-auto search-results-dropdown"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      <style>{`.search-results-dropdown::-webkit-scrollbar { display: none; }`}</style>
                      {filteredUsers.map(user => (
                        <button
                          key={user.uid}
                          onClick={() => {
                            setSelectedUser(user);
                            setSearch('');
                          }}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 last:border-none"
                        >
                          <div className="text-left">
                            <p className="text-sm font-black text-white">{user.displayName}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">{user.position} | {user.departmentName}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
             
             {selectedUser && (
               <button 
                onClick={() => setSelectedUser(null)}
                className="shrink-0 h-12 px-4 bg-primary text-white rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-right-2"
               >
                 <span className="text-xs font-black">{selectedUser.displayName} </span>
                 <X className="w-4 h-4" />
               </button>
             )}

             <Input 
               type="month" 
               value={month}
               onChange={(e) => setMonth(e.target.value)}
               className="w-32 h-12 bg-card border-none text-xs font-black text-white rounded-xl text-center px-0 appearance-none shrink-0"
               style={{ colorScheme: 'dark' }}
             />
          </div>

          {selectedUser && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportExcel}
                className="flex-1 h-10 rounded-xl bg-white/5 border-white/10 text-white font-black text-[10px] gap-2"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                EXCEL 보고서
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportPDF}
                className="flex-1 h-10 rounded-xl bg-white/5 border-white/10 text-white font-black text-[10px] gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                PDF 리포트
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="px-6 space-y-6">
        {selectedUser ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
               <Card className="bg-card border-white/5 rounded-2xl p-4 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Clock className="w-12 h-12 text-blue-500" />
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">이달의 기본 시간</p>
                  <p className="text-2xl font-black text-white">{stats.total.toFixed(1)} <span className="text-xs font-bold text-muted-foreground">h</span></p>
               </Card>
               <Card className="bg-card border-white/5 rounded-2xl p-4 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <TrendingUp className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">이달의 잔업 시간</p>
                  <p className="text-2xl font-black text-primary">{stats.ot.toFixed(1)} <span className="text-xs font-bold text-muted-foreground">h</span></p>
               </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {selectedUser.displayName}님의 기록
              </h3>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-muted-foreground">기록을 불러오는 중...</p>
                </div>
              ) : attendanceData.length > 0 ? (
                <div className="space-y-3">
                  {attendanceData.map((att) => (
                    <Card key={att.id} className="bg-card border-white/5 rounded-2xl overflow-hidden">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm font-black text-white">{format(parseISO(att.date), 'MM.dd EEEE', { locale: ko })}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-bold text-muted-foreground">출근: {att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '-'}</span>
                              <span className="text-[10px] font-bold text-muted-foreground">퇴근: {att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '-'}</span>
                            </div>
                          </div>
                          {editingId === att.id ? (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(att.id)} className="text-emerald-500">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="text-rose-500">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => startEditing(att)} className="text-muted-foreground">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {editingId === att.id ? (
                          <div className="space-y-3 pt-2 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">출근 시간</label>
                                <Input 
                                  type="datetime-local" 
                                  value={editForm.clockIn}
                                  onChange={(e) => setEditForm({...editForm, clockIn: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">퇴근 시간</label>
                                <Input 
                                  type="datetime-local" 
                                  value={editForm.clockOut}
                                  onChange={(e) => setEditForm({...editForm, clockOut: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">기본 시간 (h)</label>
                                <Input 
                                  type="number" 
                                  step="0.1"
                                  value={editForm.workHours}
                                  onChange={(e) => setEditForm({...editForm, workHours: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">잔업 시간 (h)</label>
                                <Input 
                                  type="number" 
                                  step="0.1"
                                  value={editForm.overtimeHours}
                                  onChange={(e) => setEditForm({...editForm, overtimeHours: e.target.value})}
                                  className="h-9 bg-black/20 border-none text-[10px] font-bold"
                                />
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              className="w-full h-8 bg-primary/5 border-primary/20 text-primary text-[10px] font-black gap-1"
                              onClick={handleRecalculate}
                            >
                              <Calculator className="w-3 h-3" /> 시간 자동 계산
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-4">
                            <div className="flex-1 bg-black/20 rounded-xl p-2 text-center">
                              <p className="text-[9px] font-black text-muted-foreground uppercase mb-0.5 tracking-tighter">기본</p>
                              <p className="text-sm font-black text-white">{att.workHours?.toFixed(1) || '0.0'}h</p>
                            </div>
                            <div className="flex-1 bg-black/20 rounded-xl p-2 text-center">
                              <p className="text-[9px] font-black text-muted-foreground uppercase mb-0.5 tracking-tighter">잔업</p>
                              <p className="text-sm font-black text-primary">{att.overtimeHours?.toFixed(1) || '0.0'}h</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-card rounded-3xl border border-dashed border-white/10">
                  <AlertCircle className="w-8 h-8 text-muted-foreground opacity-20" />
                  <p className="text-xs font-bold text-muted-foreground">이달의 근태 기록이 없습니다.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center gap-4 bg-card/30 rounded-3xl border border-dashed border-white/5">
            <Users className="w-10 h-10 text-muted-foreground opacity-20" />
            <div className="text-center">
              <p className="text-sm font-black text-white mb-1">사용자를 선택해주세요</p>
              <p className="text-xs font-bold text-muted-foreground">기록을 확인하고 조정할 사용자를 목록에서 선택하세요.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
