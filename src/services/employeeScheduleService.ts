import { db } from '@/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { EmployeeWorkScheduleSettings, SchedulePresetType, DaySpecificSchedule } from '@/types';
import { format } from 'date-fns';

export const DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS: EmployeeWorkScheduleSettings = {
  scheduleType: 'REGULAR',
  workStartTime: '08:00',
  workEndTime: '17:00',
  workDays: [1, 2, 3, 4, 5], // Monday ~ Friday
  autoCheckInEnabled: true,
  autoCheckOutEnabled: true,
  preShiftArrivalWindowMinutes: 60, // 60 minutes before scheduled start time
  autoTriggerAnytimeOnWorkDays: false,
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  preShiftReminderEnabled: true,
  preShiftReminderMinutes: 15,
  postShiftReminderEnabled: true,
  overtimeBaselineMode: 'STANDARD_HOURS',
  daySpecificSchedules: {}
};

export interface SchedulePresetItem {
  id: SchedulePresetType;
  title: string;
  subtitle: string;
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  workDays: number[];
  badge: string;
  description: string;
}

export const SCHEDULE_PRESETS: SchedulePresetItem[] = [
  {
    id: 'REGULAR',
    title: '조선소 표준 주간조',
    subtitle: '08:00 ~ 17:00 (월~금)',
    workStartTime: '08:00',
    workEndTime: '17:00',
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    workDays: [1, 2, 3, 4, 5],
    badge: '가장 많이 사용',
    description: '조선소 현장 및 공정 표준 일과 (8시간 정규근무 + 1시간 점심)'
  },
  {
    id: 'EARLY',
    title: '조기 출근조 (하절기/현장조)',
    subtitle: '07:00 ~ 16:00 (월~금)',
    workStartTime: '07:00',
    workEndTime: '16:00',
    lunchStartTime: '11:30',
    lunchEndTime: '12:30',
    workDays: [1, 2, 3, 4, 5],
    badge: '폭염/하절기 특화',
    description: '하절기 및 조기 작업반을 위한 1시간 이른 스케줄'
  },
  {
    id: 'OFFICE',
    title: '일반 사무 / 본관 지원조',
    subtitle: '09:00 ~ 18:00 (월~금)',
    workStartTime: '09:00',
    workEndTime: '18:00',
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    workDays: [1, 2, 3, 4, 5],
    badge: '사무직/총무',
    description: '본사 및 사무동 정규 시차 출퇴근 표준'
  },
  {
    id: 'NIGHT',
    title: '야간 교대조 (철야/특수공정)',
    subtitle: '20:00 ~ 05:00 (익일)',
    workStartTime: '20:00',
    workEndTime: '05:00',
    lunchStartTime: '00:00',
    lunchEndTime: '01:00',
    workDays: [1, 2, 3, 4, 5],
    badge: '야간 교대',
    description: '도장/블록 탑재 등 야간 특수작업반 전용 스케줄'
  },
  {
    id: 'CUSTOM',
    title: '사용자 직접 지정',
    subtitle: '요일별/시간별 자유 맞춤형',
    workStartTime: '08:00',
    workEndTime: '17:00',
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    workDays: [1, 2, 3, 4, 5],
    badge: '맞춤 설정',
    description: '요일별 다른 출근시간 및 특수 근무시간을 직접 정의'
  }
];

export const DAY_LABELS = [
  { day: 1, label: '월', full: '월요일' },
  { day: 2, label: '화', full: '화요일' },
  { day: 3, label: '수', full: '수요일' },
  { day: 4, label: '목', full: '목요일' },
  { day: 5, label: '금', full: '금요일' },
  { day: 6, label: '토', full: '토요일' },
  { day: 0, label: '일', full: '일요일' }
];

/**
 * Get the local cache key for offline-first zero latency
 */
const getCacheKey = (uid: string) => `employee_work_schedule_settings_${uid}`;

/**
 * Load employee schedule from Firestore or local cache
 */
export async function getEmployeeSchedule(uid: string): Promise<EmployeeWorkScheduleSettings> {
  if (!uid) return DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS;

  // 1. Try local cache first for instant UI response
  let cached: EmployeeWorkScheduleSettings | null = null;
  try {
    const raw = localStorage.getItem(getCacheKey(uid));
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {}

  // 2. Fetch from Firestore users collection
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.workScheduleSettings) {
        const merged = { ...DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS, ...data.workScheduleSettings };
        try {
          localStorage.setItem(getCacheKey(uid), JSON.stringify(merged));
        } catch (e) {}
        return merged;
      }
    }
  } catch (e) {
    console.warn('Failed to load employee schedule from Firestore, using cache/default:', e);
  }

  return cached || DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS;
}

/**
 * Save employee work schedule settings
 */
export async function saveEmployeeSchedule(
  uid: string,
  settings: Partial<EmployeeWorkScheduleSettings>
): Promise<EmployeeWorkScheduleSettings> {
  if (!uid) throw new Error('User UID is required to save schedule settings');

  const current = await getEmployeeSchedule(uid);
  const updated: EmployeeWorkScheduleSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString()
  };

  // 1. Save to local cache immediately
  try {
    localStorage.setItem(getCacheKey(uid), JSON.stringify(updated));
  } catch (e) {}

  // 2. Persist to Firestore
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      workScheduleSettings: updated
    });
  } catch (err: any) {
    // If updateDoc fails (e.g. document doesn't exist yet), use setDoc with merge
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      workScheduleSettings: updated
    }, { merge: true });
  }

  return updated;
}

/**
 * Get scheduled hours for a specific date (considers day-of-week custom schedules)
 */
export function getTodayScheduledHours(
  settings: EmployeeWorkScheduleSettings | null,
  date: Date = new Date()
): {
  isWorkDay: boolean;
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  dayLabel: string;
} {
  const currentConfig = settings || DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS;
  const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const dayObj = DAY_LABELS.find(d => d.day === dayOfWeek) || DAY_LABELS[0];

  const isConfiguredDay = currentConfig.workDays?.includes(dayOfWeek);
  const daySpecific = currentConfig.daySpecificSchedules?.[dayOfWeek];

  if (daySpecific && daySpecific.enabled) {
    return {
      isWorkDay: true,
      workStartTime: daySpecific.workStartTime || currentConfig.workStartTime,
      workEndTime: daySpecific.workEndTime || currentConfig.workEndTime,
      lunchStartTime: daySpecific.lunchStartTime || currentConfig.lunchStartTime,
      lunchEndTime: daySpecific.lunchEndTime || currentConfig.lunchEndTime,
      dayLabel: dayObj.full
    };
  }

  return {
    isWorkDay: Boolean(isConfiguredDay),
    workStartTime: currentConfig.workStartTime || '08:00',
    workEndTime: currentConfig.workEndTime || '17:00',
    lunchStartTime: currentConfig.lunchStartTime || '12:00',
    lunchEndTime: currentConfig.lunchEndTime || '13:00',
    dayLabel: dayObj.full
  };
}

/**
 * Checks if current time is within employee's auto check-in trigger window
 */
export function isWithinAutoCheckInWindow(
  settings: EmployeeWorkScheduleSettings | null,
  date: Date = new Date()
): {
  inWindow: boolean;
  windowStartTimeStr: string;
  windowEndTimeStr: string;
  reason: string;
  minutesUntilStart: number;
} {
  const config = settings || DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS;
  if (!config.autoCheckInEnabled) {
    return {
      inWindow: false,
      windowStartTimeStr: '',
      windowEndTimeStr: '',
      reason: '자동 출근(Auto Check-In) 기능이 비활성화되어 있습니다.',
      minutesUntilStart: 0
    };
  }

  const todayHours = getTodayScheduledHours(config, date);
  if (!todayHours.isWorkDay && !config.autoTriggerAnytimeOnWorkDays) {
    return {
      inWindow: false,
      windowStartTimeStr: '',
      windowEndTimeStr: '',
      reason: `오늘은 설정된 근무일(${dayLabelsToString(config.workDays)})이 아닙니다.`,
      minutesUntilStart: 0
    };
  }

  // If autoTriggerAnytimeOnWorkDays is active, any time on a work day is eligible
  if (config.autoTriggerAnytimeOnWorkDays) {
    return {
      inWindow: true,
      windowStartTimeStr: '00:00',
      windowEndTimeStr: '23:59',
      reason: '근무일 상시 자동 감지 모드 가동 중',
      minutesUntilStart: 0
    };
  }

  const [startH, startM] = todayHours.workStartTime.split(':').map(Number);
  const [endH, endM] = todayHours.workEndTime.split(':').map(Number);

  const startTarget = new Date(date);
  startTarget.setHours(startH, startM, 0, 0);

  const preWindowMins = config.preShiftArrivalWindowMinutes ?? 60;
  const windowStart = new Date(startTarget.getTime() - preWindowMins * 60 * 1000);

  const endTarget = new Date(date);
  endTarget.setHours(endH, endM, 0, 0);

  // If night shift crosses midnight
  if (endTarget < startTarget) {
    endTarget.setDate(endTarget.getDate() + 1);
  }

  // Extended window allows check-in up to 3 hours past scheduled start or until scheduled end
  const currentMs = date.getTime();
  const windowStartMs = windowStart.getTime();
  const windowEndMs = Math.max(endTarget.getTime(), startTarget.getTime() + 4 * 60 * 60 * 1000);

  const windowStartTimeStr = format(windowStart, 'HH:mm');
  const windowEndTimeStr = format(new Date(windowEndMs), 'HH:mm');
  const minutesUntilStart = Math.round((startTarget.getTime() - currentMs) / (60 * 1000));

  if (currentMs < windowStartMs) {
    return {
      inWindow: false,
      windowStartTimeStr,
      windowEndTimeStr,
      reason: `출근 감지 개시 시각(${windowStartTimeStr}) 이전입니다. (출근 ${preWindowMins}분 전부터 활성화)`,
      minutesUntilStart
    };
  }

  if (currentMs > windowEndMs) {
    return {
      inWindow: false,
      windowStartTimeStr,
      windowEndTimeStr,
      reason: `오늘의 근무 예정 시간(${todayHours.workStartTime}~${todayHours.workEndTime})을 초과했습니다.`,
      minutesUntilStart
    };
  }

  return {
    inWindow: true,
    windowStartTimeStr,
    windowEndTimeStr,
    reason: `출근 유효 감지 시간(${windowStartTimeStr} ~ ${windowEndTimeStr}) 내에 있습니다.`,
    minutesUntilStart
  };
}

/**
 * Format work days numbers into friendly string
 */
export function dayLabelsToString(workDays: number[]): string {
  if (!workDays || workDays.length === 0) return '없음';
  if (workDays.length === 5 && [1, 2, 3, 4, 5].every(d => workDays.includes(d))) return '평일 (월~금)';
  if (workDays.length === 6 && [1, 2, 3, 4, 5, 6].every(d => workDays.includes(d))) return '월~토 (주 6일)';
  if (workDays.length === 7) return '매일 (월~일)';

  const dayMap: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 0: '일' };
  return workDays.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(d => dayMap[d]).join(', ');
}

/**
 * Calculate total working hours and break hours from time strings
 */
export function calculateScheduleHoursDifference(
  startTimeStr: string,
  endTimeStr: string,
  lunchStartStr?: string,
  lunchEndStr?: string
): { totalWorkHours: number; breakHours: number } {
  try {
    const [sH, sM] = startTimeStr.split(':').map(Number);
    const [eH, eM] = endTimeStr.split(':').map(Number);

    let startTotalMins = sH * 60 + sM;
    let endTotalMins = eH * 60 + eM;

    // Overnight shift
    if (endTotalMins < startTotalMins) {
      endTotalMins += 24 * 60;
    }

    let breakMins = 0;
    if (lunchStartStr && lunchEndStr) {
      const [lsh, lsm] = lunchStartStr.split(':').map(Number);
      const [leh, lem] = lunchEndStr.split(':').map(Number);
      let lStart = lsh * 60 + lsm;
      let lEnd = leh * 60 + lem;
      if (lEnd < lStart) lEnd += 24 * 60;
      breakMins = Math.max(0, lEnd - lStart);
    } else {
      breakMins = 60; // 1 hour default lunch
    }

    const elapsedMins = Math.max(0, endTotalMins - startTotalMins);
    const netWorkMins = Math.max(0, elapsedMins - breakMins);

    return {
      totalWorkHours: Number((netWorkMins / 60).toFixed(1)),
      breakHours: Number((breakMins / 60).toFixed(1))
    };
  } catch (e) {
    return { totalWorkHours: 8.0, breakHours: 1.0 };
  }
}
