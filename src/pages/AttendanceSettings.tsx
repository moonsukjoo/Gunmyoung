import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { useAutoAttendance } from '@/components/AutoAttendanceProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Bell, 
  Sparkles, 
  ArrowLeft, 
  Save, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Sun,
  Moon,
  Briefcase,
  Zap,
  Info,
  ChevronRight,
  Sliders,
  Timer,
  Coffee,
  Check
} from 'lucide-react';
import { 
  SCHEDULE_PRESETS, 
  DAY_LABELS, 
  DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS,
  calculateScheduleHoursDifference,
  dayLabelsToString,
  getTodayScheduledHours,
  isWithinAutoCheckInWindow,
  SchedulePresetItem
} from '@/services/employeeScheduleService';
import { EmployeeWorkScheduleSettings, SchedulePresetType } from '@/types';
import { testTriggerAttendanceAlert } from '@/services/attendanceNotificationScheduler';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export const AttendanceSettings: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { 
    employeeSchedule, 
    updateEmployeeSchedule, 
    locationSettings, 
    distanceToCenter, 
    isInsideCheckInZone, 
    todayAttendance,
    isForeground,
    refreshLocation
  } = useAutoAttendance();

  // Local form state
  const [formState, setFormState] = useState<EmployeeWorkScheduleSettings>(() => {
    return employeeSchedule || profile?.workScheduleSettings || DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showAdvancedDaySettings, setShowAdvancedDaySettings] = useState(false);

  // Synchronize when employeeSchedule loads
  useEffect(() => {
    if (employeeSchedule) {
      setFormState(employeeSchedule);
    }
  }, [employeeSchedule]);

  // Handle Preset selection
  const handleSelectPreset = (preset: SchedulePresetItem) => {
    setFormState(prev => ({
      ...prev,
      scheduleType: preset.id,
      workStartTime: preset.workStartTime,
      workEndTime: preset.workEndTime,
      lunchStartTime: preset.lunchStartTime,
      lunchEndTime: preset.lunchEndTime,
      workDays: [...preset.workDays]
    }));
    toast.info(`'${preset.title}' 템플릿이 적용되었습니다.`);
  };

  // Toggle Day of Week
  const handleToggleDay = (dayNum: number) => {
    setFormState(prev => {
      const currentDays = prev.workDays || [];
      const exists = currentDays.includes(dayNum);
      let newDays: number[];
      if (exists) {
        if (currentDays.length <= 1) {
          toast.error('최소 1개 이상의 근무 요일을 선택해야 합니다.');
          return prev;
        }
        newDays = currentDays.filter(d => d !== dayNum);
      } else {
        newDays = [...currentDays, dayNum].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
      }
      return {
        ...prev,
        scheduleType: 'CUSTOM',
        workDays: newDays
      };
    });
  };

  // Quick Day Presets
  const handleSetWorkDaysPreset = (presetType: 'WEEKDAYS' | 'SIX_DAYS' | 'EVERYDAY') => {
    let days: number[] = [];
    if (presetType === 'WEEKDAYS') days = [1, 2, 3, 4, 5];
    else if (presetType === 'SIX_DAYS') days = [1, 2, 3, 4, 5, 6];
    else if (presetType === 'EVERYDAY') days = [0, 1, 2, 3, 4, 5, 6];

    setFormState(prev => ({
      ...prev,
      workDays: days
    }));
  };

  // Calculate work & break duration
  const { totalWorkHours, breakHours } = calculateScheduleHoursDifference(
    formState.workStartTime,
    formState.workEndTime,
    formState.lunchStartTime,
    formState.lunchEndTime
  );

  // Live simulation on today
  const simulatedToday = getTodayScheduledHours(formState);
  const simulatedWindow = isWithinAutoCheckInWindow(formState);

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateEmployeeSchedule(formState);
      if (success) {
        toast.success('🎉 출퇴근 설정이 성공적으로 저장되었습니다!', {
          description: `표준 근무시간: ${formState.workStartTime} ~ ${formState.workEndTime} (${dayLabelsToString(formState.workDays)})`
        });
      }
    } catch (e: any) {
      toast.error('설정 저장 중 오류가 발생했습니다: ' + (e?.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    setFormState(DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS);
    toast.info('표준 기본 설정값으로 복원되었습니다. 저장을 누르면 적용됩니다.');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/attendance')}
              className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  나의 근무시간 및 자동출퇴근 설정
                </h1>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 text-xs py-0">
                  <Zap className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                  Auto-Attendance
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                개인별 표준 근무시간을 정의하여 자동 출퇴근 트리거 및 알림을 최적화합니다.
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '저장 중...' : '설정 저장'}</span>
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Live Auto-Attendance Status Card */}
        <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/70 via-white to-slate-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white">
                    오늘의 실시간 자동 출근 감지 상태
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })} 기준 시뮬레이션
                  </CardDescription>
                </div>
              </div>

              <Badge 
                className={
                  todayAttendance?.clockIn 
                    ? "bg-emerald-500 text-white" 
                    : simulatedWindow.inWindow 
                      ? "bg-blue-600 text-white animate-pulse" 
                      : "bg-slate-500 text-white"
                }
              >
                {todayAttendance?.clockIn 
                  ? "✅ 오늘 출근 완료" 
                  : simulatedWindow.inWindow 
                    ? "🟢 자동 출근 감지 가동 중" 
                    : "⚪ 대기 상태"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">오늘 예정 근무</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {simulatedToday.isWorkDay ? `${simulatedToday.workStartTime} ~ ${simulatedToday.workEndTime}` : '휴무 (미지정)'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">출근 감지 개시 시각</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {simulatedWindow.windowStartTimeStr || `${formState.workStartTime} (${formState.preShiftArrivalWindowMinutes}분 전)`}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">사업장 중심점 거리</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  {distanceToCenter !== null ? `${Math.round(distanceToCenter)}m` : '위치 측정 중...'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">위치 유효 영역</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {isInsideCheckInZone ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 허용구역 내
                    </span>
                  ) : (
                    <span className="text-slate-500">사업장 외곽</span>
                  )}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-lg flex items-start gap-2 border border-blue-100 dark:border-blue-900/30">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p>
                <strong>트리거 원리:</strong> 근무일에 설정된 출근 감지 시각({simulatedWindow.windowStartTimeStr || formState.workStartTime}) 이후 사업장 반경(1,000m + 500m 허용 오차 버퍼) 내에 진입하면 별도 버튼 클릭 없이 자동으로 출근 체크가 처리됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 1. Preset Templates */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 rounded-lg">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white">
                    표준 근무시간 템플릿 선택
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    원클릭으로 조선소 현장 및 부서별 표준 일과표를 적용할 수 있습니다.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SCHEDULE_PRESETS.map((preset) => {
              const isSelected = formState.scheduleType === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`relative p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {preset.title}
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                    {preset.subtitle}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>{preset.badge}</span>
                    <span>점심: {preset.lunchStartTime}~{preset.lunchEndTime}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 2. Work Hours & Lunch Customizer */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white">
                    근무 시간 상세 지정
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    출근 및 퇴근 시각과 점심 휴게시간을 설정합니다.
                  </CardDescription>
                </div>
              </div>

              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                실근무 {totalWorkHours}시간 (휴게 {breakHours}시간)
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Start Time */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    표준 출근 시작 시간 (Work Start)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={formState.workStartTime}
                    onChange={(e) => {
                      setFormState(prev => ({ ...prev, workStartTime: e.target.value, scheduleType: 'CUSTOM' }));
                    }}
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Quick preset buttons for Start Time */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['07:00', '07:30', '08:00', '08:30', '09:00', '20:00'].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, workStartTime: time, scheduleType: 'CUSTOM' }))}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                        formState.workStartTime === time
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              {/* End Time */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Moon className="w-4 h-4 text-indigo-500" />
                    정규 퇴근 종료 시간 (Work End)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={formState.workEndTime}
                    onChange={(e) => {
                      setFormState(prev => ({ ...prev, workEndTime: e.target.value, scheduleType: 'CUSTOM' }));
                    }}
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Quick preset buttons for End Time */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['16:00', '17:00', '17:30', '18:00', '19:00', '05:00'].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, workEndTime: time, scheduleType: 'CUSTOM' }))}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                        formState.workEndTime === time
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lunch / Break Time */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-emerald-600" />
                  점심 및 휴게 시간 (Lunch & Rest Break)
                </label>
                <span className="text-xs text-slate-500">근무 시간 계산 시 자동 공제됩니다</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">휴게 시작</span>
                  <input
                    type="time"
                    value={formState.lunchStartTime}
                    onChange={(e) => setFormState(prev => ({ ...prev, lunchStartTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <span className="text-xs text-slate-500 block mb-1">휴게 종료</span>
                  <input
                    type="time"
                    value={formState.lunchEndTime}
                    onChange={(e) => setFormState(prev => ({ ...prev, lunchEndTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Work Days Selection */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white">
                    정규 근무 요일 설정
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    선택한 요일에만 자동 출퇴근 감지 및 알림이 가동됩니다.
                  </CardDescription>
                </div>
              </div>

              {/* Quick Selectors */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetWorkDaysPreset('WEEKDAYS')}
                  className="text-xs h-7 px-2"
                >
                  평일 (월~금)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetWorkDaysPreset('SIX_DAYS')}
                  className="text-xs h-7 px-2"
                >
                  월~토 (주6일)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetWorkDaysPreset('EVERYDAY')}
                  className="text-xs h-7 px-2"
                >
                  매일
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2">
              {DAY_LABELS.map(({ day, label, full }) => {
                const isSelected = formState.workDays.includes(day);
                const isWeekend = day === 0 || day === 6;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleDay(day)}
                    className={`py-3 px-2 rounded-xl text-center border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm font-bold ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-sm font-bold">{label}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-blue-100' : isWeekend ? 'text-rose-500' : 'text-slate-400'}`}>
                      {isSelected ? '근무' : '휴무'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
              <span>현재 선택: <strong>{dayLabelsToString(formState.workDays)}</strong></span>
              <span className="text-slate-400">주 {formState.workDays.length}일 근무</span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Auto Attendance Trigger Engine Options */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 rounded-lg">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white">
                  자동 출퇴근 엔진 트리거 규칙 (Auto-Attendance Rules)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  사업장 반경 진입 시 언제 어떤 조건으로 자동 출근 처리할지 제어합니다.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
            
            {/* Toggle 1: Auto Check-In */}
            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5 max-w-md">
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  GPS 위치 기반 자동 출근 (Auto Check-In)
                </span>
                <p className="text-xs text-slate-500">
                  사업장 진입 시 별도 수동 버튼을 누르지 않아도 GPS 감지로 출근을 자동 등록합니다.
                </p>
              </div>
              <Switch
                checked={formState.autoCheckInEnabled}
                onCheckedChange={(checked) => setFormState(prev => ({ ...prev, autoCheckInEnabled: checked }))}
              />
            </div>

            {/* Arrival Trigger Window Selection */}
            {formState.autoCheckInEnabled && (
              <div className="pt-4 space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  출근 몇 분 전부터 사업장 진입 감지를 시작할까요? (Arrival Window)
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { minutes: 15, label: '15분 전부터' },
                    { minutes: 30, label: '30분 전부터' },
                    { minutes: 60, label: '60분 전부터 (권장)' },
                    { minutes: 120, label: '2시간 전부터' },
                  ].map(({ minutes, label }) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, preShiftArrivalWindowMinutes: minutes, autoTriggerAnytimeOnWorkDays: false }))}
                      className={`p-2.5 rounded-lg text-xs font-semibold border transition-all ${
                        formState.preShiftArrivalWindowMinutes === minutes && !formState.autoTriggerAnytimeOnWorkDays
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 mt-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      근무일 상시 감지 모드
                    </span>
                    <p className="text-[11px] text-slate-500">
                      출근 시간과 관계없이 근무일에 사업장에 도착하면 언제든 즉시 자동 출근 처리
                    </p>
                  </div>
                  <Switch
                    checked={formState.autoTriggerAnytimeOnWorkDays}
                    onCheckedChange={(checked) => setFormState(prev => ({ ...prev, autoTriggerAnytimeOnWorkDays: checked }))}
                  />
                </div>
              </div>
            )}

            {/* Toggle 2: Auto Check-Out on 2hr Departure */}
            <div className="flex items-center justify-between pt-4">
              <div className="space-y-0.5 max-w-md">
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  사업장 이탈 2시간 경과 시 자동 퇴근 (Auto Check-Out)
                </span>
                <p className="text-xs text-slate-500">
                  사업장 2km(+500m 버퍼)를 벗어나 15분 위치 유지 모드 후 2시간 지속 이탈 시 퇴근 확정
                </p>
              </div>
              <Switch
                checked={formState.autoCheckOutEnabled}
                onCheckedChange={(checked) => setFormState(prev => ({ ...prev, autoCheckOutEnabled: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. Smart Push Alerts & Notifications */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 rounded-lg">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white">
                    맞춤형 출퇴근 푸시 알림
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    설정한 표준 근무시간에 맞추어 사전 출근 체크 및 퇴근 확인 알림을 전송합니다.
                  </CardDescription>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  testTriggerAttendanceAlert('morning');
                  toast.success('알림 테스트가 발송되었습니다.');
                }}
                className="text-xs h-7 px-2"
              >
                알림 테스트
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  출근 준비 사전 알림 (Pre-shift Reminder)
                </span>
                <p className="text-xs text-slate-500">
                  출근 시작 {formState.preShiftReminderMinutes}분 전에 오늘 출근 알림 발송 (출근 완료 시 자동 해제)
                </p>
              </div>
              <Switch
                checked={formState.preShiftReminderEnabled}
                onCheckedChange={(checked) => setFormState(prev => ({ ...prev, preShiftReminderEnabled: checked }))}
              />
            </div>

            {formState.preShiftReminderEnabled && (
              <div className="flex items-center gap-2 pt-1 pl-1">
                <span className="text-xs text-slate-500">알림 발송 시점:</span>
                {[10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, preShiftReminderMinutes: mins }))}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                      formState.preShiftReminderMinutes === mins
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {mins}분 전
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  정규 퇴근 / 잔업 확인 알림
                </span>
                <p className="text-xs text-slate-500">
                  정규 퇴근 시각({formState.workEndTime}) 및 잔업 시간(18:00, 19:00)에 퇴근 확인 알림 전송
                </p>
              </div>
              <Switch
                checked={formState.postShiftReminderEnabled}
                onCheckedChange={(checked) => setFormState(prev => ({ ...prev, postShiftReminderEnabled: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Global Workplace Reference Card */}
        <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <CardContent className="p-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>
                사업장 기준 위치: <strong>{locationSettings?.locationName || '건명기업 본사/조선소'}</strong> (반경 {locationSettings?.checkInRadius || 1000}m + 허용오차 {locationSettings?.geofenceBufferMeters ?? 500}m)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs text-slate-500 hover:text-slate-900 h-7"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> 기본값 복원
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* Floating Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            💾 변경사항 저장 시 <span className="font-semibold text-blue-600 dark:text-blue-400">AutoAttendanceProvider</span>에 즉시 실시간 반영됩니다.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={() => navigate('/attendance')}
              className="w-1/3 sm:w-auto"
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1 sm:w-48 shadow-md flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? '저장 중...' : '근무시간 설정 저장'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSettings;
