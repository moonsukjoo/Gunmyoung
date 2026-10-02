import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { Attendance as AttendanceType } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { useAutoAttendance } from '@/components/AutoAttendanceProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { grantRandomShipPart } from '@/services/shipService';
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
  ChevronRight,
  MapPin,
  Navigation,
  Radio,
  Sliders,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Calculator,
  TrendingUp,
  Sparkles,
  Zap,
  ArrowRight,
  Bell,
  BellRing,
  BellOff,
  Sun,
  Sunset,
  Moon
} from 'lucide-react';
import { 
  getTodayAttendanceAlertStatus, 
  testTriggerAttendanceAlert, 
  syncAttendanceNotificationSchedules 
} from '@/services/attendanceNotificationScheduler';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { formatDistance } from '@/lib/geoUtils';
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
import { calculateAttendanceHours } from '@/lib/attendance';
import { checkIsSpecialDay } from '@/lib/holidays';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const Attendance: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    locationSettings,
    currentLocation,
    distanceToCenter,
    isInsideCheckInZone,
    isOutsideCheckOutZone,
    isLocationRetentionActive,
    retentionRemainingMinutes,
    geofenceBufferMeters,
    locationRetentionMinutes,
    pendingExitState,
    todayAttendance: providerTodayAttendance,
    isTracking,
    gpsError,
    batterySavingActive,
    lastSyncTime,
    saveCurrentLocationAsBasePoint,
    refreshLocation,
    updateCustomLocationSettings,
    restoreTodayAttendance
  } = useAutoAttendance();

  const [month, setMonth] = useState<Date>(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceType[]>([]);
  const [specialDates, setSpecialDates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [now, setNow] = useState(new Date());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyMonth, setHistoryMonth] = useState<Date>(new Date());
  const [historyData, setHistoryData] = useState<AttendanceType[]>([]);
  const [isLocationSettingOpen, setIsLocationSettingOpen] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHECK_IN' | 'HISTORY' | 'OVERTIME_ALERT'>('CHECK_IN');

  // Overtime Predictor State (Selected date from calendar or today)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [simulatedExitTime, setSimulatedExitTime] = useState<string>('19:00');

  const isAdminUser = profile && [
    'CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'GENERAL_AFFAIRS', 'SAFETY_MANAGER', 'ADMIN'
  ].includes(profile.role?.toUpperCase() || '');

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
    const q = query(collection(db, 'specialDates'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dates: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.date) {
          dates[data.date] = data;
        }
      });
      setSpecialDates(dates);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'specialDates');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const todayAttendance = useMemo(() => 
    providerTodayAttendance || attendanceData.find(a => a.date === todayStr) || null
  , [providerTodayAttendance, attendanceData, todayStr]);

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
          
          const isSpecialVal = checkIsSpecialDay(clockInDate, specialDates).isSpecial;
          const { workHours, overtimeHours } = calculateAttendanceHours(att.clockIn, autoOut, isSpecialVal);
          
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
      syncAttendanceNotificationSchedules({ uid: profile.uid, date: ds, clockIn: dt.toISOString() } as any).catch(() => {});
      if (profile?.uid) grantRandomShipPart(profile.uid, '출근');
    } catch (error) { toast.error('실패'); }
  };

  const handleClockOut = async () => {
    if (!profile || !todayAttendance) return;
    try {
      const dt = new Date();
      const isSpecialVal = checkIsSpecialDay(new Date(todayAttendance.clockIn), specialDates).isSpecial;
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, dt, isSpecialVal);
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
      syncAttendanceNotificationSchedules({ ...todayAttendance, clockOut: dt.toISOString() }).catch(() => {});
    } catch (error) { toast.error('실패'); }
  };

  const stats = useMemo(() => {
    let hrs = 0; let ot = 0;
    attendanceData.forEach(a => {
      if (a.clockIn && a.clockOut) {
        const isSpecialVal = checkIsSpecialDay(new Date(a.clockIn), specialDates).isSpecial;
        const { workHours, overtimeHours } = calculateAttendanceHours(a.clockIn, new Date(a.clockOut), isSpecialVal);
        hrs += workHours; ot += overtimeHours;
      }
    });
    return { total: hrs, ot };
  }, [attendanceData, specialDates]);

  const chartData = useMemo(() => {
    return [...attendanceData]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map(a => {
        const isSpecialVal = a.clockIn ? checkIsSpecialDay(new Date(a.clockIn), specialDates).isSpecial : false;
        const { workHours } = a.clockIn && (a.clockOut || a.date === todayStr) 
          ? calculateAttendanceHours(a.clockIn, a.clockOut ? new Date(a.clockOut) : now, isSpecialVal)
          : { workHours: 0 };
        return { day: format(parseISO(a.date), 'd일'), hours: workHours };
      });
  }, [attendanceData, todayStr, now, specialDates]);

  // Selected date data for Overtime Predictor
  const selectedDateStr = useMemo(() => format(selectedCalendarDate, 'yyyy-MM-dd'), [selectedCalendarDate]);
  const selectedDateAttendance = useMemo(() => {
    return attendanceData.find(a => a.date === selectedDateStr) || null;
  }, [attendanceData, selectedDateStr]);
  const isSelectedDateToday = isSameDay(selectedCalendarDate, now);

  // Realtime Overtime Prediction Calculation
  const predictedOvertimeResult = useMemo(() => {
    const isSpecialVal = checkIsSpecialDay(selectedCalendarDate, specialDates).isSpecial;
    const isSaturday = selectedCalendarDate.getDay() === 6;
    const isSunday = selectedCalendarDate.getDay() === 0;

    // Determine baseline clockIn
    let effectiveClockIn = selectedDateAttendance?.clockIn;
    if (!effectiveClockIn) {
      // Default standard clock-in 08:00
      const defaultIn = new Date(selectedCalendarDate);
      defaultIn.setHours(8, 0, 0, 0);
      effectiveClockIn = defaultIn.toISOString();
    }

    // Determine target simulated clockOut
    const [simHour, simMinute] = simulatedExitTime.split(':').map(Number);
    const targetOut = new Date(selectedCalendarDate);
    targetOut.setHours(simHour || 18, simMinute || 0, 0, 0);

    const calc = calculateAttendanceHours(effectiveClockIn, targetOut, isSpecialVal);

    // Calculate overtime rule explanation
    let otStatusText = '';
    const minutesAfter1700 = Math.max(0, (simHour * 60 + simMinute) - (17 * 60));
    if (simHour < 18) {
      otStatusText = '08:00~17:40(0h 인정), 18:00 이전 퇴근은 잔업이 0시간입니다.';
    } else {
      const fullHours = Math.floor(minutesAfter1700 / 60);
      otStatusText = `18:00 이후 1시간 단위 산정: ${fullHours}시간 인정됨`;
    }

    return {
      effectiveClockIn,
      targetOut,
      workHours: calc.workHours,
      overtimeHours: calc.overtimeHours,
      isSpecial: isSpecialVal,
      isSaturday,
      isSunday,
      otStatusText
    };
  }, [selectedCalendarDate, selectedDateAttendance, simulatedExitTime, specialDates]);

  const CustomDay = (props: DayProps) => {
    const { day, modifiers, className, style, ...rest } = props;
    const date = day.date;
    const dateStr = format(date, 'yyyy-MM-dd');
    const att = attendanceData.find(a => a.date === dateStr);
    const isToday = isSameDay(date, now);
    const isSelected = isSameDay(date, selectedCalendarDate);
    const specialInfo = checkIsSpecialDay(date, specialDates);
    const isSpecial = specialInfo.isSpecial;

    return (
      <td {...rest} className={cn("p-0.5 relative align-top", className)}>
        <button
          type="button"
          onClick={() => setSelectedCalendarDate(date)}
          className={cn(
            "w-full flex flex-col items-center justify-center min-h-[50px] rounded-xl transition-all p-0.5 relative cursor-pointer active:scale-95 text-left",
            isSelected && !isToday && "ring-2 ring-primary ring-offset-1 bg-primary/5",
            isToday ? "bg-primary shadow-lg shadow-primary/20 text-primary-foreground" : "bg-card border border-border hover:border-primary/50"
          )}
        >
          <span className={cn(
            "text-[10px] font-black", 
            isToday 
              ? "text-primary-foreground" 
              : isSelected
                ? "text-primary font-black"
                : (date.getDay() === 6 ? "text-blue-500" : isSpecial ? "text-red-500" : "text-muted-foreground")
          )}>
            {format(date, 'd')}
          </span>
          {isSpecial && !isToday && (
            <span className={cn(
              "text-[7px] font-bold p-0.5 rounded px-1 scale-90 truncate max-w-full text-center block leading-none select-none",
              date.getDay() === 6
                ? "text-blue-500 bg-blue-500/10"
                : "text-red-500 bg-red-500/10"
            )}>
              {specialInfo.label}
            </span>
          )}
          {att && att.clockIn ? (
            <div className="mt-0.5 flex flex-col items-center gap-0.5">
              <span className={cn("text-[9px] font-black", isToday ? "text-primary-foreground" : "text-emerald-500")}>
                {att.workHours ? `${att.workHours.toFixed(1)}h` : att.clockOut ? '0.0h' : '근무중'}
              </span>
              {att.overtimeHours ? (
                <span className={cn("text-[8px] font-black", isToday ? "text-primary-foreground/80" : "text-amber-500 dark:text-amber-400")}>
                  +{att.overtimeHours.toFixed(1)}h
                </span>
              ) : (
                <div className={cn("w-1 h-1 rounded-full", isToday ? "bg-primary-foreground" : "bg-emerald-500")} />
              )}
            </div>
          ) : (
              <div className="h-2" />
          )}
        </button>
      </td>
    );
  };

  return (
    <div className="space-y-3 pb-20 px-2">
      <header className="py-3 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[9px] font-black text-muted-foreground/80 uppercase tracking-[0.2em]">근태 모니터링</p>
          <h2 className="text-lg font-black tracking-tight text-foreground leading-tight">근태 관리</h2>
          <p className="text-xs font-bold text-muted-foreground">{format(now, 'yyyy.MM.dd EEEE', { locale: ko })}</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/attendance/settings')}
          className="rounded-2xl border-border bg-card/80 text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-muted"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-500" />
          <span>근무시간 설정</span>
        </Button>
        <style>{`
          .rdp { --rdp-cell-size: 100%; margin: 0; width: 100%; }
          .rdp-table { width: 100%; border-collapse: separate; border-spacing: 4px; }
          .rdp-caption_label { color: var(--foreground); font-weight: 900; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 4px; }
          .rdp-head_cell { color: var(--muted-foreground); opacity: 0.8; font-weight: 900; font-size: 0.7rem; text-align: center; padding-bottom: 8px; }
        `}</style>
      </header>

      {/* 🗂️ Attendance Sub-Menu Navigation Tabs */}
      <div className="bg-card border border-border/60 p-1 rounded-2xl flex items-center gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('CHECK_IN')}
          className={cn(
            "flex-1 py-2 px-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap",
            activeTab === 'CHECK_IN'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>출퇴근 체크</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={cn(
            "flex-1 py-2 px-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap",
            activeTab === 'HISTORY'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
          <span>근무기록·달력</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('OVERTIME_ALERT')}
          className={cn(
            "flex-1 py-2 px-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap",
            activeTab === 'OVERTIME_ALERT'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calculator className="w-3.5 h-3.5 shrink-0" />
          <span>잔업·알림</span>
        </button>
      </div>

      {/* ================= TAB 1: 📌 출퇴근 체크 (Check-in & Location Live) ================= */}
      {activeTab === 'CHECK_IN' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* 🛡️ Location Retention Mode Active Banner (위치 유지 모드 가동 중) */}
          {isLocationRetentionActive && providerTodayAttendance?.clockIn && !providerTodayAttendance?.clockOut && !pendingExitState && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-3xl p-4.5 space-y-2 text-foreground shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        🛡️ 위치 유지 모드(Location Retention) 가동 중
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-none font-black text-[10px] py-0.5 px-2">
                        최소 {locationRetentionMinutes || 15}분 유효성 보존
                      </Badge>
                    </div>
                    <p className="text-xs font-bold text-foreground mt-0.5">
                      사업장 반경 500m 허용 오차 버퍼 내에 확인되었으므로, 건물/선체 진입 또는 일시적인 GPS 수신 불가 시에도 오퇴근 처리되지 않고 정상 출근이 안전하게 유지됩니다.
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-muted-foreground">
                      <span>⏱️ 위치 유효성 보존 잔여 시간: 약 <strong className="text-emerald-600 dark:text-emerald-400">{retentionRemainingMinutes}분</strong></span>
                      <span>•</span>
                      <span>500m 지오펜싱 허용 오차 버퍼 적용 중</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Departure Pending Alert Banner */}
          {pendingExitState && (
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-4.5 space-y-3 relative overflow-hidden shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        사업장 2km(+500m 버퍼) 이탈 감지 (퇴근 대기 상태)
                      </span>
                    </div>
                    <p className="text-sm font-black text-foreground mt-0.5">
                      자동 퇴근 확정까지 남은 시간:{' '}
                      <span className="text-amber-600 dark:text-amber-400 font-mono text-base">
                        {Math.floor(pendingExitState.remainingSeconds / 60)}분 {pendingExitState.remainingSeconds % 60}초
                      </span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-amber-700/90 dark:text-amber-300/90">
                      <span>📍 최초 이탈 시각:</span>
                      <span className="font-mono bg-amber-500/20 px-1.5 py-0.5 rounded text-foreground font-black">
                        {format(new Date(pendingExitState.exitSince), 'HH:mm')}
                      </span>
                      <span>(퇴근 확정 시 이 시각으로 등록됨)</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 shrink-0 font-black">
                  대기 중
                </Badge>
              </div>
              
              <div className="w-full bg-amber-500/20 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${pendingExitState.progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-bold pt-0.5">
                <span>💡 2시간 이내에 사업장 인근으로 복귀 시 출근 상태가 정상 유지됩니다.</span>
              </div>
            </div>
          )}

          {/* Clocking Unit */}
          <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[50px] -mr-12 -mt-12" />
            <CardContent className="p-5 space-y-5 relative z-10">
               <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full border border-border/45">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">실시간 근무 모니터링</span>
                  </div>
                  <span className="text-4xl font-black text-foreground tabular-nums tracking-tighter drop-shadow-sm font-mono">{format(now, 'HH:mm:ss')}</span>
               </div>
               
               <div className="grid grid-cols-2 gap-3.5">
                  <button 
                    disabled={!!todayAttendance?.clockIn}
                    onClick={handleClockIn}
                    className={cn(
                      "h-18 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md border-b-[4px] cursor-pointer",
                      todayAttendance?.clockIn 
                        ? "bg-muted text-muted-foreground/30 border-border"
                        : "bg-blue-600 text-white border-blue-700 hover:bg-blue-500 hover:border-blue-600 shadow-blue-500/10"
                    )}
                  >
                    <LogIn className="w-5 h-5" />
                    <span className="font-black text-xs">출근 완료</span>
                  </button>

                  <button 
                    disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                    onClick={handleClockOut}
                    className={cn(
                      "h-18 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md border-b-[4px] cursor-pointer",
                      (!todayAttendance?.clockIn || !!todayAttendance?.clockOut)
                        ? "bg-muted text-muted-foreground/30 border-border"
                        : "bg-rose-600 text-white border-rose-700 hover:bg-rose-500 hover:border-rose-600 shadow-rose-500/10"
                    )}
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-black text-xs">퇴근 완료</span>
                  </button>
               </div>

               {todayAttendance?.clockIn && (
                 <div className="space-y-2.5">
                   <div className="bg-muted/60 backdrop-blur-sm rounded-2xl p-3.5 flex justify-between items-center border border-border/50">
                      <div className="flex gap-6">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-muted-foreground/50 uppercase">출근 시각</span>
                            <span className="text-xs font-black text-blue-500">{format(parseISO(todayAttendance.clockIn), 'HH:mm')}</span>
                         </div>
                         {todayAttendance.clockOut && (
                            <div className="flex flex-col">
                               <span className="text-[9px] font-black text-muted-foreground/50 uppercase">퇴근 시각</span>
                               <span className="text-xs font-black text-rose-500">{format(parseISO(todayAttendance.clockOut), 'HH:mm')}</span>
                            </div>
                         )}
                      </div>
                      {todayAttendance.clockIn && !todayAttendance.clockOut && (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-none px-3 py-1 font-black animate-pulse rounded-xl">
                          현재 근무 중
                        </Badge>
                      )}
                      {todayAttendance.clockIn && todayAttendance.clockOut && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 font-black rounded-xl flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          퇴근 확정됨
                        </Badge>
                      )}
                   </div>

                   {/* Accidental Clock-out Recovery Banner & 1-Click Restore Button */}
                   {todayAttendance.clockIn && todayAttendance.clockOut && todayAttendance.date === todayStr && (
                     <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                       <div className="flex items-center gap-2 text-xs">
                         <span className="text-amber-500 font-bold">⚠️ 아직 근무 중이거나 오작동으로 퇴근되었나요?</span>
                       </div>
                       <Button
                         type="button"
                         size="sm"
                         variant="outline"
                         onClick={async () => {
                           await restoreTodayAttendance();
                         }}
                         className="h-8 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-black text-xs border-amber-500/40 w-full sm:w-auto"
                       >
                         🔄 계속 근무 중으로 복원
                       </Button>
                     </div>
                   )}
                 </div>
               )}
            </CardContent>
          </Card>

          {/* GPS Geofence & Auto Attendance Live Status */}
          <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <CardContent className="p-4.5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex items-center justify-center">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping absolute" />
                  </div>
                  <span className="text-xs font-black text-foreground">GPS 위치 기반 자동 출퇴근</span>
                  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none text-[9px] font-black py-0 px-2">
                    포그라운드 즉시 동기화
                  </Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none text-[9px] font-black py-0 px-2">
                    500m 버퍼 · 15분 유지모드
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refreshLocation()}
                    className="w-7 h-7 text-muted-foreground hover:text-foreground rounded-lg"
                    title="GPS 위치 새로고침"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  {isAdminUser && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsLocationSettingOpen(true)}
                      className="w-7 h-7 text-muted-foreground hover:text-foreground rounded-lg"
                      title="출퇴근 위치 기준점 설정"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-muted/40 rounded-2xl p-3 border border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">사업장 기준점 거리</p>
                      <p className="text-sm font-black text-foreground truncate">
                        {distanceToCenter !== null ? formatDistance(distanceToCenter) : '측정 중...'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {distanceToCenter !== null ? (
                      isInsideCheckInZone ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-black text-[10px]">
                          🟢 반경 1km+500m 버퍼 (출근 구역)
                        </Badge>
                      ) : distanceToCenter < ((locationSettings?.checkOutRadius || 2000) + (geofenceBufferMeters || 500)) ? (
                        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-none font-black text-[10px]">
                          🔵 1.5~2.5km (근무 인정)
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-none font-black text-[10px]">
                          🟠 2.5km 초과 (이탈 대기)
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-bold">
                        GPS 수신 중
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="bg-muted/40 rounded-2xl p-3 border border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">근무 시간 기본 규칙</p>
                      <p className="text-xs font-black text-foreground truncate">
                        08:00 ~ 17:00 (점심 12-13시 제외)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action: Register Current Location as Reference Point */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-border/40">
                <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>기준점: {locationSettings?.centerLat ? `${locationSettings.centerLat.toFixed(5)}, ${locationSettings.centerLng.toFixed(5)}` : '미설정'}</span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setIsSavingLocation(true);
                    await saveCurrentLocationAsBasePoint();
                    setIsSavingLocation(false);
                  }}
                  disabled={isSavingLocation}
                  className="h-8 text-xs font-black bg-primary/5 hover:bg-primary/10 text-primary border-primary/20 rounded-xl flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {isSavingLocation ? '기준점 저장 중...' : '📍 현재 위치를 기준점으로 등록'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= TAB 2: 📅 근무 기록 & 캘린더 (History & Calendar) ================= */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 gap-3.5">
             <div className="bg-card border border-border/50 p-4 rounded-3xl flex flex-col gap-1 items-start shadow-[0_2px_12px_rgba(0,0,0,0.01)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors" />
                <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-1 border border-blue-500/10">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-[8px] font-black text-blue-500/80 uppercase tracking-widest leading-none">이달의 누적 근무</span>
                <span className="text-xl font-black text-foreground">{stats.total.toFixed(0)}<span className="text-[10px] font-bold text-muted-foreground/40 ml-0.5 font-sans">H</span></span>
             </div>
             <div className="bg-card border border-border/50 p-4 rounded-3xl flex flex-col gap-1 items-start shadow-[0_2px_12px_rgba(0,0,0,0.01)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors" />
                <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 mb-1 border border-amber-500/10">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[8px] font-black text-amber-600/80 uppercase tracking-widest leading-none">초과 근무 시간</span>
                <span className="text-xl font-black text-amber-600">{stats.ot.toFixed(0)}<span className="text-[10px] font-bold text-amber-600/40 ml-0.5 font-sans">H</span></span>
             </div>
          </div>

          <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
             <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                   <Activity className="w-3.5 h-3.5 text-primary" />
                   <span className="text-xs font-black text-foreground">최근 근무 트렌드</span>
                </div>
                <div className="h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', opacity: 0.5, fontSize: 10}} />
                      <Tooltip cursor={{fill: 'var(--muted)', opacity: 0.2}} contentStyle={{backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '10px'}} />
                      <Bar dataKey="hours" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </CardContent>
          </Card>

          {/* Calendar Card with integrated date selection indicator */}
          <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-border">
            <CardContent className="p-3 pt-5">
               <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-border/40">
                 <div className="flex items-center gap-2">
                   <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                   <span className="text-xs font-black text-foreground">출퇴근 캘린더 (날짜 선택 가능)</span>
                 </div>
                 <div className="text-[10px] font-bold text-muted-foreground">
                   선택일: <span className="text-primary font-black">{format(selectedCalendarDate, 'yyyy.MM.dd')}</span>
                 </div>
               </div>
               <style>{`
                 .rdp { --rdp-cell-size: 34px; margin: 0 auto; width: 100%; }
                 .rdp-caption_label { color: var(--foreground); font-weight: 900; }
                 .rdp-nav_button { color: var(--muted-foreground); opacity: 0.8; }
                 .rdp-head_cell { color: var(--muted-foreground); opacity: 0.6; font-size: 10px; font-weight: 900; }
               `}</style>
               <DayPicker 
                  mode="single" 
                  selected={selectedCalendarDate}
                  onSelect={(date) => {
                    if (date) setSelectedCalendarDate(date);
                  }}
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
                   <Clock className="w-3.5 h-3.5 text-primary" />
                   <span className="text-xs font-black text-foreground">상세 내역 (최근 5건)</span>
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
                   <div key={att.id} className="bg-card p-3 rounded-xl border border-border flex items-center justify-between">
                      <div className="flex flex-col">
                         <span className="text-[11px] font-black text-foreground">{format(parseISO(att.date), 'MM월 dd일 (EEEE)', { locale: ko })}</span>
                         <div className="flex gap-2 text-[9px] font-bold text-muted-foreground mt-0.5">
                            <span>{att.clockIn ? format(parseISO(att.clockIn), 'HH:mm') : '--:--'}</span>
                            <span>-</span>
                            <span>{att.clockOut ? format(parseISO(att.clockOut), 'HH:mm') : (att.date === todayStr ? '근무중' : '--:--')}</span>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-foreground">
                               기본 {att.workHours ? `${att.workHours.toFixed(1)}시간` : (att.clockIn && !att.clockOut && att.date === todayStr ? '계산중' : '0시간')}
                            </span>
                            {att.overtimeHours > 0 && (
                               <span className="text-[9px] font-black text-primary">잔업 {att.overtimeHours.toFixed(1)}시간</span>
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
        </div>
      )}

      {/* ================= TAB 3: ⚡ 잔업 예측 & 스마트 알림 (Overtime & Alerts) ================= */}
      {activeTab === 'OVERTIME_ALERT' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Overtime Rules & Realtime Overtime Predictor Widget */}
          <Card className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <CardContent className="p-4.5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-foreground">실시간 잔업 예측기</h3>
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-none text-[9px] font-black py-0 px-2">
                        1시간 단위 인정
                      </Badge>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground">
                      캘린더 날짜를 클릭하여 해당 일자의 예상 잔업 및 인정 시간을 시뮬레이션하세요.
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="text-[10px] font-mono font-black border-border">
                  {format(selectedCalendarDate, 'MM.dd(EEE)', { locale: ko })}
                </Badge>
              </div>

              {/* Quick Info Bar for Overtime Policy */}
              <div className="bg-muted/40 rounded-2xl p-3 border border-border/40 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-bold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    잔업 산정 공식 (강화 기준)
                  </span>
                  <span className="font-mono font-bold text-[10px] text-foreground">
                    08:00~17:40(0h) / 18:00 이후 1시간당 1h
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-bold text-[10px]">
                  <div className="bg-background/80 rounded-xl p-1.5 border border-border/50">
                    <p className="text-muted-foreground/80">~17:40 퇴근</p>
                    <p className="text-foreground font-black">잔업 0시간</p>
                  </div>
                  <div className="bg-background/80 rounded-xl p-1.5 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <p className="opacity-80">18:00 퇴근</p>
                    <p className="font-black">잔업 1.0시간</p>
                  </div>
                  <div className="bg-background/80 rounded-xl p-1.5 border border-primary/30 text-primary">
                    <p className="opacity-80">19:00 퇴근</p>
                    <p className="font-black">잔업 2.0시간</p>
                  </div>
                </div>
              </div>

              {/* Predictor Controls */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black text-foreground">
                  <span>퇴근 예정 시각 선택</span>
                  <span className="font-mono text-primary text-sm font-black">{simulatedExitTime}</span>
                </div>

                {/* Quick Preset Buttons */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: '17:00 (정시)', time: '17:00' },
                    { label: '17:40 (0h)', time: '17:40' },
                    { label: '18:00 (1h)', time: '18:00' },
                    { label: '19:00 (2h)', time: '19:00' },
                    { label: '20:00 (3h)', time: '20:00' },
                  ].map((item) => (
                    <button
                      key={item.time}
                      type="button"
                      onClick={() => setSimulatedExitTime(item.time)}
                      className={cn(
                        "h-8 rounded-xl text-[10px] font-black transition-all border cursor-pointer",
                        simulatedExitTime === item.time
                          ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                          : "bg-background text-foreground/80 border-border hover:bg-muted/70"
                      )}
                    >
                      {item.time}
                    </button>
                  ))}
                </div>

                {/* Direct Slider & Time Input */}
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="time"
                    value={simulatedExitTime}
                    onChange={(e) => setSimulatedExitTime(e.target.value)}
                    className="h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
                  />
                  <div className="flex-1 bg-muted/60 rounded-xl px-3 py-2 border border-border/40 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {isSelectedDateToday ? '오늘 출근 기준' : `${format(selectedCalendarDate, 'MM/dd')} 일자 시뮬레이션`}
                    </span>
                    <span className="text-[11px] font-black text-foreground">
                      출근: {selectedDateAttendance?.clockIn ? format(parseISO(selectedDateAttendance.clockIn), 'HH:mm') : '08:00 (기본)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Simulation Output Card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-primary/5 to-transparent p-3.5 rounded-2xl border border-amber-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black text-foreground">예상 근무 및 잔업 결과</span>
                  </div>
                  {predictedOvertimeResult.isSpecial && (
                    <Badge className="bg-red-500/15 text-red-500 border-none text-[9px] font-black">
                      휴일/특근 1.5배 가산 적용
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-background/90 rounded-xl p-2.5 border border-border/60">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">예상 기본 근무</p>
                    <p className="text-lg font-black text-foreground mt-0.5">
                      {predictedOvertimeResult.workHours.toFixed(1)}
                      <span className="text-xs font-bold text-muted-foreground ml-1">시간</span>
                    </p>
                  </div>
                  <div className="bg-background/90 rounded-xl p-2.5 border border-amber-500/40">
                    <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">예상 잔업 시간</p>
                    <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      {predictedOvertimeResult.overtimeHours.toFixed(1)}
                      <span className="text-xs font-bold text-amber-600/70 ml-1">시간</span>
                    </p>
                  </div>
                </div>

                <p className="text-[10px] font-bold text-muted-foreground leading-tight pt-1">
                  💡 {predictedOvertimeResult.otStatusText}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Smart Timed Push Notification Card (07:30 / 17:00 / 18:00 / 19:00) */}
          <Card className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <CardContent className="p-4.5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-foreground">스마트 출퇴근 알림 (배터리 0% 절약형)</h3>
                    <p className="text-[10px] font-bold text-muted-foreground">정해진 시간에만 푸시 발송 / 출퇴근 완료 시 당일 알림 자동 해제</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-black border-primary/20 bg-primary/5 text-primary">
                  자동 스케줄
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {getTodayAttendanceAlertStatus(todayAttendance).map((item) => {
                  const isMorning = item.type === 'morning';
                  const IconComp = isMorning ? Sun : item.type === 'evening_17' ? Sunset : Moon;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5",
                        item.isSuppressed
                          ? "bg-muted/30 border-border/40 opacity-75"
                          : "bg-background border-border/80 shadow-xs"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            isMorning ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                          )}>
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-black text-foreground">{item.timeStr}</span>
                              <span className="text-[11px] font-bold text-foreground truncate">{item.label}</span>
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground truncate">
                              {item.isSuppressed ? item.suppressReason : item.body}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/30">
                        <span className="text-[9px] font-bold">
                          {item.isSuppressed ? (
                            <span className="text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {item.suppressReason}
                            </span>
                          ) : (
                            <span className="text-primary flex items-center gap-1">
                              <Bell className="w-3 h-3" />
                              시간 도래 시 알림 발송
                            </span>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            testTriggerAttendanceAlert(item.type);
                            toast.info(`[${item.timeStr}] 푸시 알림을 테스트 발송했습니다.`);
                          }}
                          className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted hover:bg-muted/80"
                        >
                          테스트
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-muted/40 rounded-2xl p-2.5 text-[11px] font-medium text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>
                  💡 <strong>출근 체크 완료 시</strong> 07:30 알림이 자동 해제되며, <strong>퇴근 체크 완료 시</strong> 17:00·18:00·19:00 알림이 당일 모두 자동 차단됩니다.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
         <DialogContent className="bg-background border border-border rounded-t-[32px] sm:rounded-3xl p-0 h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden bottom-0 sm:bottom-auto translate-y-0 sm:-translate-y-1/2 max-w-2xl w-full">
            <DialogHeader className="p-8 pb-4 flex-shrink-0">
               <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <DialogTitle className="text-2xl font-black text-foreground whitespace-nowrap">근태 상세 내역</DialogTitle>
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-2 w-full sm:w-auto justify-between sm:justify-start">
                     <Button 
                        variant="ghost" size="icon" 
                        className="w-8 h-8 text-muted-foreground/40 hover:text-foreground"
                        onClick={() => setHistoryMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                     >
                        <ChevronLeft className="w-4 h-4" />
                     </Button>
                     <span className="text-sm font-black text-foreground px-2 whitespace-nowrap">
                        {format(historyMonth, 'yyyy년 MM월')}
                     </span>
                     <Button 
                        variant="ghost" size="icon" 
                        className="w-8 h-8 text-muted-foreground/40 hover:text-foreground"
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
                  <div key={att.id} className="bg-card p-5 rounded-2xl border border-border flex items-center justify-between gap-4">
                     <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-foreground whitespace-nowrap">{format(parseISO(att.date), 'MM월 dd일 (EEEE)', { locale: ko })}</span>
                        <div className="flex gap-2 text-xs font-bold text-muted-foreground mt-1 whitespace-nowrap">
                           <span>{att.clockIn ? format(parseISO(att.clockIn), 'HH:mm') : '--:--'}</span>
                           <span>-</span>
                           <span>{att.clockOut ? format(parseISO(att.clockOut), 'HH:mm') : (att.date === todayStr ? '근무중' : '--:--')}</span>
                        </div>
                     </div>
                     <div className="text-right shrink-0">
                        <div className="flex flex-col items-end">
                           <span className="text-base font-black text-foreground whitespace-nowrap">
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
            <div className="p-6 pt-2 bg-gradient-to-t from-background flex-shrink-0">
               <Button 
                  className="w-full h-14 bg-card border border-border hover:bg-muted text-foreground font-black rounded-2xl" 
                  onClick={() => setIsHistoryOpen(false)}
               >
                  닫기
               </Button>
            </div>
         </DialogContent>
      </Dialog>
      {/* Location Geofence Settings Dialog */}
      <Dialog open={isLocationSettingOpen} onOpenChange={setIsLocationSettingOpen}>
        <DialogContent className="bg-background border border-border rounded-3xl max-w-md w-full p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              출퇴근 GPS 기준점 & 반경 설정
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground">
              사업장 위치 기준점과 자동 출퇴근 인정 반경을 설정합니다. (모든 직원에게 실시간 적용)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Capture GPS Button */}
            <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-foreground">내 현재 GPS 좌표</span>
                <Badge variant="outline" className="text-[10px]">
                  {currentLocation ? '수신 성공' : '수신 대기'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                위도: {currentLocation?.latitude?.toFixed(6) || '--'} / 경도: {currentLocation?.longitude?.toFixed(6) || '--'}
              </p>
              <Button
                type="button"
                onClick={async () => {
                  setIsSavingLocation(true);
                  const ok = await saveCurrentLocationAsBasePoint();
                  setIsSavingLocation(false);
                  if (ok) setIsLocationSettingOpen(false);
                }}
                disabled={isSavingLocation}
                className="w-full h-10 rounded-xl bg-primary font-black text-xs gap-1.5"
              >
                <MapPin className="w-4 h-4" />
                {isSavingLocation ? '저장 중...' : '현재 위치를 사업장 기준점으로 즉시 등록'}
              </Button>
            </div>

            {/* Current Configured Settings */}
            <div className="space-y-2.5">
              <div className="p-3 bg-card border border-border/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-foreground block">GPS 2km 이탈 시 자동 퇴근 처리</span>
                    <span className="text-[10px] text-muted-foreground">이탈 후 2시간 경과 시 퇴근 자동 확정</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={locationSettings?.autoClockOutEnabled !== false ? "default" : "secondary"}
                    className={cn(
                      "h-8 px-3 rounded-lg font-black text-xs",
                      locationSettings?.autoClockOutEnabled !== false 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                        : "bg-muted text-muted-foreground"
                    )}
                    onClick={() => {
                      updateCustomLocationSettings({
                        autoClockOutEnabled: locationSettings?.autoClockOutEnabled === false ? true : false
                      });
                    }}
                  >
                    {locationSettings?.autoClockOutEnabled !== false ? "사용 중 (ON)" : "해제됨 (OFF)"}
                  </Button>
                </div>
                {locationSettings?.autoClockOutEnabled === false && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg">
                    💡 자동 퇴근이 꺼져 있습니다. 직원이 직접 퇴근 버튼을 누르거나 정해진 푸시 알림(17/18/19시)을 통해 퇴근 처리할 수 있습니다.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-card border border-border/50 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground block">기본 출근 인정 반경</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {locationSettings?.checkInRadius || 1000}m (1km)
                  </span>
                </div>
                <div className="p-3 bg-card border border-border/50 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground block">기본 퇴근 이탈 반경</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {locationSettings?.checkOutRadius || 2000}m (2km)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-card border border-border/50 rounded-xl">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground block">허용 오차 범위 (Buffer)</span>
                  </div>
                  <span className="text-sm font-black text-primary">
                    +{locationSettings?.geofenceBufferMeters || 500}m (500m 버퍼)
                  </span>
                  <p className="text-[9px] text-muted-foreground font-medium mt-0.5">단순 거리비교 대신 반경 오차 완화</p>
                </div>
                <div className="p-3 bg-card border border-border/50 rounded-xl">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground block">위치 유지 모드</span>
                  </div>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {locationSettings?.locationRetentionMinutes || 15}분간 유효 보존
                  </span>
                  <p className="text-[9px] text-muted-foreground font-medium mt-0.5">GPS 일시 소실 시 오퇴근 완벽 차단</p>
                </div>
              </div>

              <div className="p-3 bg-card border border-border/50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground block">이탈 후 퇴근 확정 대기시간</span>
                  <span className="text-sm font-black text-foreground">
                    {locationSettings?.pendingExitTimeoutMinutes || 120}분 (2시간)
                  </span>
                </div>
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none text-[10px] font-bold">
                  2시간 후 자동 확정
                </Badge>
              </div>

              <div className="p-3 bg-muted/30 border border-border/40 rounded-xl space-y-1">
                <span className="text-[10px] font-black text-foreground block">근무 및 잔업 시간 계산 기준</span>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4 font-bold">
                  <li>정규 근무: 08:00 ~ 17:00 (기본 8시간 인정)</li>
                  <li>점심시간: 12:00 ~ 13:00 (1시간 공제)</li>
                  <li>석식/휴게시간: 17:00 ~ 17:30 (30분 공제 후 잔업 시작)</li>
                  <li>잔업 정산: 17:30 이후 30분 단위 (예: 17:40 퇴근 ➔ 0시간 / 18:30 퇴근 ➔ 1시간)</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="w-full rounded-xl font-black h-11"
              onClick={() => setIsLocationSettingOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
