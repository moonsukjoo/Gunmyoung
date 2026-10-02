import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle,
  CalendarDays,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileBarChart
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Attendance } from '@/types';

interface AttendanceHubCardProps {
  todayAttendance: Attendance | null;
  weeklyAttendanceMap: Record<string, Attendance>;
  currentTimeStr: string;
  isClockingIn: boolean;
  isClockingOut: boolean;
  handleClockIn: () => void;
  handleClockOut: () => void;
  pendingExitState: {
    exitSince: string;
    remainingSeconds: number;
    progressPercent: number;
  } | null;
}

export const AttendanceHubCard: React.FC<AttendanceHubCardProps> = ({
  todayAttendance,
  weeklyAttendanceMap,
  currentTimeStr,
  isClockingIn,
  isClockingOut,
  handleClockIn,
  handleClockOut,
  pendingExitState
}) => {
  const navigate = useNavigate();
  const [showWeekly, setShowWeekly] = useState(false);

  const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Compute Monday to Sunday dates
  const current = new Date();
  const dayIdx = current.getDay();
  const distanceToMonday = dayIdx === 0 ? -6 : 1 - dayIdx;
  const monday = new Date(current);
  monday.setDate(current.getDate() + distanceToMonday);

  const weekDays = Array.from({ length: 7 }).map((_, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const isToday = dateStr === todayStr;
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    const att = weeklyAttendanceMap[dateStr];
    return {
      dateStr,
      isToday,
      isWeekend,
      dayLabel: daysKo[dayDate.getDay()],
      dateNum: format(dayDate, 'd'),
      att
    };
  });

  return (
    <section className="bg-gradient-to-br from-card via-card/95 to-primary/[0.03] border border-border/70 rounded-3xl p-4 sm:p-5 shadow-[0_6px_24px_rgba(0,0,0,0.03)] space-y-3.5 relative overflow-hidden group">
      {/* Top Header with live clock */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-black text-foreground tracking-tight whitespace-nowrap">
                오늘의 근태 관리
              </h2>
              <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded-md shrink-0">
                {currentTimeStr}
              </span>
            </div>
            <p className="text-[11px] font-bold text-muted-foreground truncate">
              {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/attendance/settings')}
            className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg flex items-center gap-1"
            title="근무시간 및 자동출퇴근 설정"
          >
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">설정</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/attendance')}
            className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg flex items-center gap-1"
          >
            <FileBarChart className="w-3.5 h-3.5 text-blue-500" />
            <span>기록</span>
          </Button>
        </div>
      </div>

      {/* Pending Departure Warning */}
      {pendingExitState && todayAttendance?.clockIn && !todayAttendance?.clockOut && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-2.5 flex items-start gap-2 animate-pulse text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-black text-amber-700 dark:text-amber-300 block">
              사업장 이탈 감지 (자동 퇴근 대기 중)
            </span>
            <span className="text-[11px] text-amber-600/90 dark:text-amber-400/90 font-bold block">
              이탈({format(new Date(pendingExitState.exitSince), 'HH:mm')}) 기준 {Math.max(1, Math.ceil(pendingExitState.remainingSeconds / 60))}분 후 자동 퇴근 확정됩니다.
            </span>
          </div>
        </div>
      )}

      {/* Main Punch Action */}
      {(() => {
        if (!todayAttendance || !todayAttendance.clockIn) {
          return (
            <div className="space-y-2">
              <div className="p-3 bg-muted/40 rounded-2xl border border-border/50 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-foreground">상태: 미출근</span>
                    <p className="text-[11px] font-medium text-muted-foreground leading-none mt-0.5">
                      버튼 터치 시 컨디션 체크 후 즉시 등록됩니다.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-black text-muted-foreground shrink-0">
                  출근 대기
                </Badge>
              </div>

              <Button
                onClick={handleClockIn}
                disabled={isClockingIn}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary via-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-sm shadow-[0_6px_20px_rgba(37,99,235,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-85" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                {isClockingIn ? '출근 처리 중...' : '🕒 지금 바로 출근 등록하기'}
              </Button>
            </div>
          );
        } else if (!todayAttendance.clockOut) {
          const inTimeStr = format(new Date(todayAttendance.clockIn), 'HH:mm');
          return (
            <div className="space-y-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                      정상 근무 중 ({inTimeStr} 출근)
                    </span>
                    <p className="text-[11px] font-medium text-muted-foreground leading-none mt-0.5">
                      정규 08:00~17:00 (18:00부터 1시간 단위 잔업 산정)
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500 text-white border-none text-[10px] font-bold py-0.5 px-2 shrink-0">
                  근무 중
                </Badge>
              </div>

              <Button
                onClick={handleClockOut}
                disabled={isClockingOut}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-red-700 hover:opacity-95 text-white font-black text-sm shadow-[0_6px_20px_rgba(225,29,72,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-85" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                {isClockingOut ? '퇴근 처리 중...' : '🏁 오늘 퇴근 등록하기'}
              </Button>
            </div>
          );
        } else {
          const inTimeStr = format(new Date(todayAttendance.clockIn), 'HH:mm');
          const outTimeStr = format(new Date(todayAttendance.clockOut), 'HH:mm');
          return (
            <div className="p-3 bg-muted/40 border border-border/60 rounded-2xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-black text-foreground truncate">
                    오늘 근무 완료 ({inTimeStr} ~ {outTimeStr})
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/20 shrink-0">
                  정산 완료
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-0.5">
                <div className="p-2 bg-card rounded-xl border border-border/40">
                  <span className="text-[10px] font-bold text-muted-foreground block">정규 근무</span>
                  <span className="text-sm font-black text-primary font-mono">
                    {todayAttendance.workHours ?? 8}시간
                  </span>
                </div>
                <div className="p-2 bg-card rounded-xl border border-border/40">
                  <span className="text-[10px] font-bold text-muted-foreground block">인정 잔업</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                    {todayAttendance.overtimeHours ?? 0}시간
                  </span>
                </div>
              </div>
            </div>
          );
        }
      })()}

      {/* Sub-bar: Quick Navigation & Weekly Timecard Accordion Toggle */}
      <div className="pt-1 border-t border-border/40 flex items-center justify-between gap-1 text-xs">
        <button
          type="button"
          onClick={() => setShowWeekly(!showWeekly)}
          className="flex items-center gap-1 text-[11px] font-black text-muted-foreground/80 hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
        >
          <CalendarDays className="w-3.5 h-3.5 text-primary" />
          <span>이번 주 근무표 {showWeekly ? '접기' : '펼치기'}</span>
          {showWeekly ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate('/leave')}
            className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 rounded cursor-pointer"
          >
            연차신청 →
          </button>
        </div>
      </div>

      {/* Collapsible 7-day Weekly Grid */}
      {showWeekly && (
        <div className="grid grid-cols-7 gap-1 pt-2 animate-fade-in">
          {weekDays.map((d, idx) => {
            const inTime = d.att?.clockIn ? format(new Date(d.att.clockIn), 'HH:mm') : '--:--';
            const outTime = d.att?.clockOut ? format(new Date(d.att.clockOut), 'HH:mm') : '--:--';

            return (
              <div
                key={idx}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-xl text-center border transition-all text-xs",
                  d.isToday
                    ? "bg-primary/[0.08] border-primary/50 shadow-xs"
                    : "bg-card/70 border-border/30"
                )}
              >
                <span className={cn(
                  "text-[9.5px] font-black px-1 rounded-full",
                  d.isToday ? "bg-primary text-primary-foreground" : d.isWeekend ? "text-muted-foreground/50" : "text-muted-foreground/75"
                )}>
                  {d.isToday ? '오늘' : d.dayLabel}
                </span>
                <span className={cn("text-xs font-black", d.isToday ? "text-primary" : "text-foreground")}>
                  {d.dateNum}
                </span>
                <div className="text-[9px] font-bold leading-tight">
                  {d.att ? (
                    <div className="text-primary">{inTime}</div>
                  ) : d.isWeekend ? (
                    <span className="text-muted-foreground/40">휴일</span>
                  ) : d.isToday ? (
                    <span className="text-primary">대기</span>
                  ) : (
                    <span className="text-muted-foreground/30">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
