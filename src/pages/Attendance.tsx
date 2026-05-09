import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/src/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { Attendance as AttendanceType } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { grantRandomShipPart } from '@/src/services/shipService';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isSameDay, 
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Clock, 
  LogIn,
  LogOut,
  Calendar as CalendarIcon,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DayPicker, DayProps } from 'react-day-picker';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { calculateAttendanceHours } from '@/src/lib/attendance';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const Attendance: React.FC = () => {
  const { profile } = useAuth();
  const [month, setMonth] = useState<Date>(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [now, setNow] = useState(new Date());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyMonth, setHistoryMonth] = useState<Date>(new Date());
  const [historyData, setHistoryData] = useState<AttendanceType[]>([]);

  useEffect(() => {
    if (!profile || !isHistoryOpen) return;
    const start = startOfMonth(historyMonth);
    const end = endOfMonth(historyMonth);
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', profile.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistoryData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceType)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'attendance_history'));
    return () => unsubscribe();
  }, [profile, historyMonth, isHistoryOpen]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const todayAttendance = useMemo(() => 
    attendanceData.find(a => a.date === todayStr) || null
  , [attendanceData, todayStr]);

  useEffect(() => {
    if (!profile) return;
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', profile.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceType));
      setAttendanceData(docs);
      setLoading(false);

      // Auto clock-out for previous days
      docs.forEach(async (att) => {
        if (att.clockIn && !att.clockOut && att.date < todayStr) {
          const clockInDate = new Date(att.clockIn);
          const autoOut = new Date(clockInDate);
          autoOut.setHours(17, 0, 0, 0);
          
          const { workHours, overtimeHours } = calculateAttendanceHours(att.clockIn, autoOut);
          
          try {
            await updateDoc(doc(db, 'attendance', att.id), {
              clockOut: autoOut.toISOString(),
              workHours,
              overtimeHours
            });
          } catch (e) {
            console.error("Auto clock-out failed", e);
          }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance_monthly'));
    return () => unsubscribe();
  }, [profile, month, todayStr]);

  const handleClockIn = async () => {
    if (!profile) return;
    const dt = new Date();
    const ds = format(dt, 'yyyy-MM-dd');
    const id = `${profile.uid}_${ds}`;
    try {
      await setDoc(doc(db, 'attendance', id), {
        uid: profile.uid,
        date: ds,
        clockIn: dt.toISOString(),
        status: 'PRESENT',
        workHours: 0,
        overtimeHours: 0,
        createdAt: dt.toISOString()
      });
      // 출근 시 유령 가드 자동 활성화
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: true,
        lastMovementAt: dt.toISOString(),
        isImmobile: false
      });
      toast.success('출근 완료 (유령 가드 활성화)');
      if (profile?.uid) grantRandomShipPart(profile.uid, '출근');
    } catch (error) { toast.error('실패'); }
  };

  const handleClockOut = async () => {
    if (!profile || !todayAttendance) return;
    try {
      const dt = new Date();
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, dt);
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOut: dt.toISOString(),
        workHours,
        overtimeHours
      });
      // 퇴근 시 유령 가드 자동 비활성화
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: false,
        isImmobile: false
      });
      toast.success('퇴근 완료 (유령 가드 종료)');
    } catch (error) { toast.error('실패'); }
  };

  const stats = useMemo(() => {
    let hrs = 0; let ot = 0;
    attendanceData.forEach(a => {
      if (a.clockIn && a.clockOut) {
        const { workHours, overtimeHours } = calculateAttendanceHours(a.clockIn, new Date(a.clockOut));
        hrs += workHours; ot += overtimeHours;
      }
    });
    return { total: hrs, ot };
  }, [attendanceData]);

  const chartData = useMemo(() => {
    return [...attendanceData]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map(a => {
        const { workHours } = a.clockIn && (a.clockOut || a.date === todayStr) 
          ? calculateAttendanceHours(a.clockIn, a.clockOut ? new Date(a.clockOut) : now)
          : { workHours: 0 };
        return { day: format(parseISO(a.date), 'd일'), hours: workHours };
      });
  }, [attendanceData, todayStr, now]);

  const CustomDay = (props: DayProps) => {
    const { day, modifiers, className, style, ...rest } = props;
    const date = day.date;
    const dateStr = format(date, 'yyyy-MM-dd');
    const att = attendanceData.find(a => a.date === dateStr);
    const isToday = isSameDay(date, now);
    const isSun = date.getDay() === 0;

    return (
      <td {...rest} className={cn("p-1 relative align-top", className)}>
        <div className={cn(
          "flex flex-col items-center justify-center min-h-[60px] rounded-xl transition-all p-1",
          isToday ? "bg-primary shadow-lg shadow-primary/20" : "bg-card border border-white/5"
        )}>
          <span className={cn("text-[9px] font-black", isSun && !isToday ? "text-red-500" : isToday ? "text-white" : "text-muted-foreground")}>
            {format(date, 'd')}
          </span>
          {att && att.clockIn ? (
            <div className="mt-1 flex flex-col items-center gap-0.5">
              <span className={cn("text-[9px] font-black", isToday ? "text-white" : "text-emerald-500")}>
                {att.workHours ? `${att.workHours.toFixed(1)}h` : att.clockOut ? '0.0h' : '근무중'}
              </span>
              {att.overtimeHours ? (
                <span className={cn("text-[8px] font-black", isToday ? "text-white/80" : "text-primary")}>
                  +{att.overtimeHours.toFixed(1)}h
                </span>
              ) : (
                <div className={cn("w-1 h-1 rounded-full", isToday ? "bg-white" : "bg-emerald-500")} />
              )}
            </div>
          ) : (
             <div className="h-4" />
          )}
        </div>
      </td>
    );
  };

  return (
    <div className="space-y-4 pb-24 px-2">
      <header className="py-6 space-y-1">
          <p className="text-[10px] sm:text-xs font-black text-white/30 uppercase tracking-[0.2em]">근태 모니터링</p>
          <h2 className="text-3xl font-black tracking-tight text-white leading-tight">근태 관리</h2>
          <p className="text-sm font-bold text-muted-foreground">{format(now, 'yyyy.MM.dd EEEE', { locale: ko })}</p>
          <style>{`
            .rdp { --rdp-cell-size: 100%; margin: 0; width: 100%; }
            .rdp-table { width: 100%; border-collapse: separate; border-spacing: 4px; }
            .rdp-caption_label { color: #fff; font-weight: 900; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 4px; }
            .rdp-head_cell { color: #ffffff40; font-weight: 900; font-size: 0.7rem; text-align: center; padding-bottom: 8px; }
          `}</style>
        </header>

      {/* Clocking Unit */}
      <Card className="border-none shadow-2xl bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] rounded-[3rem] overflow-hidden border border-white/5 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[60px] -mr-16 -mt-16" />
        <CardContent className="p-8 space-y-8 relative z-10">
           <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">실시간 근무 모니터링</span>
              </div>
              <span className="text-6xl font-black text-white tabular-nums tracking-tighter drop-shadow-2xl">{format(now, 'HH:mm:ss')}</span>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <button 
                disabled={!!todayAttendance?.clockIn}
                onClick={handleClockIn}
                className={cn(
                  "h-24 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xl border-b-[6px]",
                  todayAttendance?.clockIn 
                    ? "bg-white/5 text-white/20 border-white/5" 
                    : "bg-gradient-to-b from-blue-500 to-blue-700 text-white border-blue-900 shadow-blue-500/20"
                )}
              >
                <LogIn className="w-6 h-6" />
                <span className="font-black text-base">출근 완료</span>
              </button>

              <button 
                disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                onClick={handleClockOut}
                className={cn(
                  "h-24 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xl border-b-[6px]",
                  (!todayAttendance?.clockIn || !!todayAttendance?.clockOut)
                    ? "bg-white/5 text-white/20 border-white/5"
                    : "bg-gradient-to-b from-rose-500 to-rose-700 text-white border-rose-900 shadow-rose-500/20"
                )}
              >
                <LogOut className="w-6 h-6" />
                <span className="font-black text-base">퇴근 완료</span>
              </button>
           </div>

           {todayAttendance?.clockIn && (
             <div className="bg-white/5 rounded-3xl p-4 flex justify-between items-center border border-white/5">
                <div className="flex gap-6">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-white/30 uppercase">출근 시각</span>
                      <span className="text-xs font-black text-blue-400">{format(parseISO(todayAttendance.clockIn), 'HH:mm')}</span>
                   </div>
                   {todayAttendance.clockOut && (
                     <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white/30 uppercase">퇴근 시각</span>
                        <span className="text-xs font-black text-rose-400">{format(parseISO(todayAttendance.clockOut), 'HH:mm')}</span>
                     </div>
                   )}
                </div>
                {todayAttendance.clockIn && !todayAttendance.clockOut && (
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/20 px-3 py-1 font-black animate-pulse rounded-xl">
                    현재 근무 중
                  </Badge>
                )}
             </div>
           )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
         <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-6 rounded-[2rem] border border-blue-500/10 flex flex-col gap-1 items-start shadow-xl">
            <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-2">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.1em]">이달의 누적 근무</span>
            <span className="text-3xl font-black text-white">{stats.total.toFixed(0)}<span className="text-sm font-bold text-white/20 ml-1">H</span></span>
         </div>
         <div className="bg-gradient-to-br from-amber-600/20 to-transparent p-6 rounded-[2rem] border border-amber-500/10 flex flex-col gap-1 items-start shadow-xl">
            <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 mb-2">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-amber-400/60 uppercase tracking-[0.1em]">초과 근무 시간</span>
            <span className="text-3xl font-black text-amber-500">{stats.ot.toFixed(0)}<span className="text-sm font-bold text-amber-500/20 ml-1">H</span></span>
         </div>
      </div>

      <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
         <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
               <Activity className="w-4 h-4 text-primary" />
               <span className="text-sm font-black text-white">최근 근무 트렌드</span>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#ffffff30', fontSize: 10}} />
                  <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#1c1c1e', border: 'none', borderRadius: '12px', fontSize: '10px'}} />
                  <Bar dataKey="hours" fill="#2dd4bf" radius={[6, 6, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </CardContent>
      </Card>

      <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
        <CardContent className="p-4 pt-8">
           <style>{`
             .rdp { --rdp-cell-size: 44px; margin: 0 auto; width: 100%; }
             .rdp-caption_label { color: #fff; font-weight: 900; }
             .rdp-nav_button { color: #ffffff40; }
             .rdp-head_cell { color: #ffffff20; font-size: 10px; font-weight: 900; }
           `}</style>
           <DayPicker 
              mode="single" 
              month={month} 
              onMonthChange={setMonth} 
              locale={ko} 
              components={{ Day: CustomDay }}
           />
        </CardContent>
      </Card>

      {/* Daily History List */}
      <div className="space-y-3">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
               <Clock className="w-4 h-4 text-primary" />
               <span className="text-sm font-black text-white">상세 내역 (최근 5건)</span>
            </div>
            <Button 
               variant="ghost" 
               size="sm" 
               className="text-[10px] font-black text-primary hover:text-primary/80 h-auto p-0"
               onClick={() => {
                  setHistoryMonth(month);
                  setIsHistoryOpen(true);
               }}
            >
               더보기
            </Button>
         </div>
         <div className="space-y-2">
            {[...attendanceData]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((att) => (
               <div key={att.id} className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                     <span className="text-xs font-black text-white">{format(parseISO(att.date), 'MM월 dd일 (EEEE)', { locale: ko })}</span>
                     <div className="flex gap-2 text-[10px] font-bold text-muted-foreground mt-1">
                        <span>{att.clockIn ? format(parseISO(att.clockIn), 'HH:mm') : '--:--'}</span>
                        <span>-</span>
                        <span>{att.clockOut ? format(parseISO(att.clockOut), 'HH:mm') : (att.date === todayStr ? '근무중' : '--:--')}</span>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-white">
                           기본 {att.workHours ? `${att.workHours.toFixed(1)}시간` : (att.clockIn && !att.clockOut && att.date === todayStr ? '계산중' : '0시간')}
                        </span>
                        {att.overtimeHours > 0 && (
                           <span className="text-[10px] font-black text-primary">잔업 {att.overtimeHours.toFixed(1)}시간</span>
                        )}
                     </div>
                  </div>
               </div>
            ))}
            {attendanceData.length === 0 && (
               <div className="py-10 text-center opacity-20">
                  <p className="text-xs font-black">내역이 없습니다</p>
               </div>
            )}
         </div>
      </div>

      {/* Full History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
         <DialogContent className="bg-[#121212] border-none rounded-t-[32px] sm:rounded-3xl p-0 h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden bottom-0 sm:bottom-auto translate-y-0 sm:-translate-y-1/2 max-w-2xl w-full">
            <DialogHeader className="p-8 pb-4 flex-shrink-0">
               <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <DialogTitle className="text-2xl font-black text-white whitespace-nowrap">근태 상세 내역</DialogTitle>
                  <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 w-full sm:w-auto justify-between sm:justify-start">
                     <Button 
                        variant="ghost" size="icon" 
                        className="w-8 h-8 text-white/40"
                        onClick={() => setHistoryMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                     >
                        <ChevronLeft className="w-4 h-4" />
                     </Button>
                     <span className="text-sm font-black text-white px-2 whitespace-nowrap">
                        {format(historyMonth, 'yyyy년 MM월')}
                     </span>
                     <Button 
                        variant="ghost" size="icon" 
                        className="w-8 h-8 text-white/40"
                        onClick={() => setHistoryMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                     >
                        <ChevronRight className="w-4 h-4" />
                     </Button>
                  </div>
               </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-3">
               {[...historyData]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((att) => (
                  <div key={att.id} className="bg-white/[0.03] p-5 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                     <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-white whitespace-nowrap">{format(parseISO(att.date), 'MM월 dd일 (EEEE)', { locale: ko })}</span>
                        <div className="flex gap-2 text-xs font-bold text-muted-foreground mt-1 whitespace-nowrap">
                           <span>{att.clockIn ? format(parseISO(att.clockIn), 'HH:mm') : '--:--'}</span>
                           <span>-</span>
                           <span>{att.clockOut ? format(parseISO(att.clockOut), 'HH:mm') : (att.date === todayStr ? '근무중' : '--:--')}</span>
                        </div>
                     </div>
                     <div className="text-right shrink-0">
                        <div className="flex flex-col items-end">
                           <span className="text-base font-black text-white whitespace-nowrap">
                              기본 {att.workHours ? `${att.workHours.toFixed(1)}시간` : (att.clockIn && !att.clockOut && att.date === todayStr ? '계산중' : '0시간')}
                           </span>
                           {att.overtimeHours > 0 && (
                              <p className="text-xs font-black text-primary whitespace-nowrap">잔업 {att.overtimeHours.toFixed(1)}시간</p>
                           )}
                        </div>
                     </div>
                  </div>
               ))}
               {historyData.length === 0 && (
                  <div className="py-40 text-center opacity-20">
                     <p className="text-sm font-black">내역이 없습니다</p>
                  </div>
               )}
            </div>
            <div className="p-6 pt-2 bg-gradient-to-t from-[#121212] flex-shrink-0">
               <Button 
                  className="w-full h-14 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl" 
                  onClick={() => setIsHistoryOpen(false)}
               >
                  닫기
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
};
