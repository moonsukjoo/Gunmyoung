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
  FileText,
  LogIn,
  LogOut
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    <div className="min-h-screen bg-background pb-24 selection:bg-blue-500/30">
      <header className="p-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 space-y-4 border-b border-white/5 relative overflow-hidden">
        {/* Colorful Glow Accent */}
        <div className="absolute -top-24 -left-20 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]" />
        
        <div className="flex items-center gap-4 relative">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin')}
            className="text-white h-10 w-10 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-0.5">Core Administration</p>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">근태 통합 관리</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2 relative">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <Input 
                  placeholder="대상자 성명을 검색하세요" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 bg-white/[0.03] border-none text-sm font-bold rounded-2xl placeholder:text-white/10"
                />
                
                <AnimatePresence>
                  {search.length > 0 && filteredUsers.length > 0 && !selectedUser && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-[#1c1c1e] border border-white/10 rounded-3xl shadow-2xl z-20 overflow-hidden max-h-60 overflow-y-auto"
                    >
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
                            <p className="text-[10px] font-bold text-white/30 uppercase">{user.position} | {user.departmentName}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/10" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
             
             {selectedUser && (
               <button 
                onClick={() => setSelectedUser(null)}
                className="shrink-0 h-11 px-4 bg-blue-600 text-white rounded-2xl flex items-center gap-2 animate-in fade-in slide-in-from-right-2 shadow-lg shadow-blue-500/20"
               >
                 <span className="text-xs font-black">{selectedUser.displayName} </span>
                 <X className="w-4 h-4" />
               </button>
             )}

             <Input 
               type="month" 
               value={month}
               onChange={(e) => setMonth(e.target.value)}
               className="w-32 h-11 bg-white/[0.03] border-none text-[10px] font-black text-white rounded-2xl text-center px-0 appearance-none shrink-0"
               style={{ colorScheme: 'dark' }}
             />
          </div>

          {selectedUser && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportExcel}
                className="flex-1 h-10 rounded-2xl bg-white/[0.03] border-white/5 text-white/60 font-black text-[10px] gap-2 hover:bg-white/[0.06] hover:text-white"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500/60" />
                EXCEL 보고서
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportPDF}
                className="flex-1 h-10 rounded-2xl bg-white/[0.03] border-white/5 text-white/60 font-black text-[10px] gap-2 hover:bg-white/[0.06] hover:text-white"
              >
                <FileText className="w-3.5 h-3.5 text-rose-500/60" />
                PDF 리포트
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="px-6 space-y-4">
        {selectedUser ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
               <Card className="bg-white/[0.03] border-white/5 rounded-3xl p-5 overflow-hidden relative border-none shadow-none group hover:bg-white/[0.05] transition-all">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                    <Clock className="w-12 h-12 text-blue-500" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-blue-400 mb-1 uppercase tracking-widest">이달의 기본 근무</p>
                    <p className="text-3xl font-black text-white leading-none tracking-tighter">
                      {stats.total.toFixed(0)} 
                      <span className="text-sm font-bold text-white/20 ml-1 uppercase">hrs</span>
                    </p>
                  </div>
               </Card>
               <Card className="bg-white/[0.03] border-white/5 rounded-3xl p-5 overflow-hidden relative border-none shadow-none group hover:bg-white/[0.05] transition-all">
                  <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-12 h-12 text-blue-500" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-emerald-400 mb-1 uppercase tracking-widest">이달의 연장 근무</p>
                    <p className="text-3xl font-black text-blue-500 leading-none tracking-tighter">
                      {stats.ot.toFixed(0)} 
                      <span className="text-sm font-bold text-blue-500/20 ml-1 uppercase">hrs</span>
                    </p>
                  </div>
               </Card>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-widest leading-none">
                   출퇴근 기록 목록
                </h3>
                <Badge className="bg-white/5 text-white/30 border-none font-black text-[9px] h-5 px-2">
                  {attendanceData.length} 건
                </Badge>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">기록 로딩 중...</p>
                </div>
              ) : attendanceData.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {attendanceData.map((att) => (
                    <Card key={att.id} className="bg-white/[0.03] border-white/5 rounded-2xl overflow-hidden border-none shadow-none transition-all hover:bg-white/[0.05]">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm font-black text-white leading-tight">{format(parseISO(att.date), 'MM.dd (EEEE)', { locale: ko })}</p>
                            <div className="flex gap-3 mt-1.5">
                              <span className="text-[10px] font-bold text-white/30 flex items-center gap-1"><LogIn className="w-3 h-3" /> {att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '-'}</span>
                              <span className="text-[10px] font-bold text-white/30 flex items-center gap-1"><LogOut className="w-3 h-3" /> {att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '-'}</span>
                            </div>
                          </div>
                          {editingId === att.id ? (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(att.id)} className="text-emerald-500 bg-emerald-500/10 w-8 h-8 rounded-xl hovr:bg-emerald-500/20">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="text-rose-500 bg-rose-500/10 w-8 h-8 rounded-xl hover:bg-rose-500/20">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => startEditing(att)} className="text-white/20 bg-white/5 w-8 h-8 rounded-xl hover:text-white hover:bg-white/10 transition-all">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>

                        {editingId === att.id ? (
                          <div className="space-y-3 pt-3 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-tighter ml-1">출근 시간</label>
                                <Input 
                                  type="datetime-local" 
                                  value={editForm.clockIn}
                                  onChange={(e) => setEditForm({...editForm, clockIn: e.target.value})}
                                  className="h-9 bg-white/5 border-none text-[10px] font-black rounded-xl"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-tighter ml-1">퇴근 시간</label>
                                <Input 
                                  type="datetime-local" 
                                  value={editForm.clockOut}
                                  onChange={(e) => setEditForm({...editForm, clockOut: e.target.value})}
                                  className="h-9 bg-white/5 border-none text-[10px] font-black rounded-xl"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-tighter ml-1">기본 근무 (h)</label>
                                <Input 
                                  type="number" 
                                  step="0.1"
                                  value={editForm.workHours}
                                  onChange={(e) => setEditForm({...editForm, workHours: e.target.value})}
                                  className="h-9 bg-white/5 border-none text-[10px] font-black rounded-xl"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-tighter ml-1">연장 근무 (h)</label>
                                <Input 
                                  type="number" 
                                  step="0.1"
                                  value={editForm.overtimeHours}
                                  onChange={(e) => setEditForm({...editForm, overtimeHours: e.target.value})}
                                  className="h-9 bg-white/5 border-none text-[10px] font-black rounded-xl"
                                />
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              className="w-full h-9 bg-blue-600/10 border-blue-500/20 text-blue-500 text-[10px] font-black gap-1 rounded-xl"
                              onClick={handleRecalculate}
                            >
                              <Calculator className="w-3.5 h-3.5" /> 시간 자동 계산
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <div className="flex-1 bg-white/5 rounded-xl p-2.5 text-center">
                              <p className="text-[8px] font-black text-white/20 uppercase mb-0.5 tracking-widest leading-none">기본 근무</p>
                              <p className="text-sm font-black text-white leading-none">{att.workHours?.toFixed(1) || '0.0'}h</p>
                            </div>
                            <div className="flex-1 bg-white/5 rounded-xl p-2.5 text-center border-l border-blue-500/20">
                              <p className="text-[8px] font-black text-blue-500/40 uppercase mb-0.5 tracking-widest leading-none">연장 근무</p>
                              <p className="text-sm font-black text-blue-500 leading-none">{att.overtimeHours?.toFixed(1) || '0.0'}h</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white/[0.03] rounded-3xl border border-dashed border-white/10">
                  <AlertCircle className="w-8 h-8 text-white/10" />
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">기록이 없습니다</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center gap-4 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/5">
            <div className="w-16 h-16 bg-white/5 rounded-[2rem] flex items-center justify-center text-white/10">
              <Users className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-white mb-2 leading-none">사용자를 선택해주세요</p>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">관리할 직원을 목록에서 선택하세요</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
