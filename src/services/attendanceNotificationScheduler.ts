import { format } from 'date-fns';
import { Attendance, EmployeeWorkScheduleSettings } from '@/types';
import { sendPushNotification } from './notificationService';
import { getTodayScheduledHours } from './employeeScheduleService';

export interface AttendanceAlertScheduleItem {
  id: string;
  nativeId: number;
  type: 'morning' | 'evening_17' | 'evening_18' | 'evening_19';
  label: string;
  timeStr: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

export const ATTENDANCE_SCHEDULES: AttendanceAlertScheduleItem[] = [
  {
    id: 'morning_0730',
    nativeId: 730,
    type: 'morning',
    label: '오전 출근 확인 알림',
    timeStr: '07:30',
    hour: 7,
    minute: 30,
    title: '⏰ [건명기업] 출근 체크 알림',
    body: '출근 시간이 다가왔습니다. 오늘 안전한 작업 시작 전 출근 체크를 완료해 주세요.'
  },
  {
    id: 'evening_1700',
    nativeId: 1700,
    type: 'evening_17',
    label: '오후 1차 퇴근 확인 알림',
    timeStr: '17:00',
    hour: 17,
    minute: 0,
    title: '🏁 [건명기업] 정규 일과 퇴근 확인',
    body: '정규 일과 종료 시간입니다. 오늘 업무를 마치셨다면 퇴근 체크를 진행해 주세요.'
  },
  {
    id: 'evening_1800',
    nativeId: 1800,
    type: 'evening_18',
    label: '오후 2차 잔업 퇴근 알림',
    timeStr: '18:00',
    hour: 18,
    minute: 0,
    title: '🏁 [건명기업] 18:00 잔업 퇴근 확인',
    body: '오후 6시입니다. 근무를 종료하셨다면 잊지 말고 퇴근 체크를 완료해 주세요.'
  },
  {
    id: 'evening_1900',
    nativeId: 1900,
    type: 'evening_19',
    label: '오후 3차 최종 퇴근 알림',
    timeStr: '19:00',
    hour: 19,
    minute: 0,
    title: '🚨 [건명기업] 19:00 최종 퇴근 확인',
    body: '오후 7시입니다. 오늘 작업을 마쳤다면 정확한 근태 정산을 위해 퇴근 체크를 완료해 주세요.'
  }
];

/**
 * Get notification suppression / delivery status for today
 */
export const getTodayAttendanceAlertStatus = (
  attendance: Attendance | null,
  customSchedule?: EmployeeWorkScheduleSettings | null
) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isClockedIn = Boolean(attendance?.clockIn);
  const isClockedOut = Boolean(attendance?.clockOut);

  return ATTENDANCE_SCHEDULES.map((sched) => {
    const isSentKey = `attendance_alert_sent_${todayStr}_${sched.id}`;
    let isSent = false;
    try {
      isSent = localStorage.getItem(isSentKey) === 'true';
    } catch (e) {}

    let isSuppressed = false;
    let suppressReason = '';

    if (sched.type === 'morning') {
      if (isClockedIn) {
        isSuppressed = true;
        suppressReason = '출근 완료로 알림 자동 해제';
      }
    } else {
      // Evening slots
      if (isClockedOut) {
        isSuppressed = true;
        suppressReason = '퇴근 완료로 알림 자동 해제';
      } else if (!isClockedIn) {
        isSuppressed = true;
        suppressReason = '미출근 상태';
      }
    }

    return {
      ...sched,
      isSent,
      isSuppressed,
      suppressReason
    };
  });
};

/**
 * Cancel native notifications on Capacitor
 */
const cancelNativeNotification = async (nativeId: number) => {
  try {
    const capacitor = (window as any).Capacitor;
    if (capacitor && capacitor.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: nativeId }] });
    }
  } catch (e) {
    // ignore
  }
};

/**
 * Schedule native notification on Capacitor
 */
const scheduleNativeNotification = async (
  item: AttendanceAlertScheduleItem,
  targetDate: Date
) => {
  try {
    const capacitor = (window as any).Capacitor;
    if (capacitor && capacitor.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [
          {
            id: item.nativeId,
            title: item.title,
            body: item.body,
            schedule: { at: targetDate },
            sound: 'beep.wav',
            extra: { type: item.type, url: '/attendance' }
          }
        ]
      });
    }
  } catch (e) {
    // ignore
  }
};

/**
 * Synchronize native and web push schedules based on real-time attendance state
 */
export const syncAttendanceNotificationSchedules = async (
  attendance: Attendance | null,
  customSchedule?: EmployeeWorkScheduleSettings | null
) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isClockedIn = Boolean(attendance?.clockIn);
  const isClockedOut = Boolean(attendance?.clockOut);

  // 1. Morning check (Calculated from custom workStartTime - reminderMinutes)
  if (isClockedIn) {
    // User already clocked in -> cancel and suppress morning alarm for today
    await cancelNativeNotification(730);
    try {
      localStorage.setItem(`attendance_alert_sent_${todayStr}_morning_0730`, 'true');
    } catch (e) {}
  } else {
    const now = new Date();
    const todayHours = getTodayScheduledHours(customSchedule || null, now);
    
    if (todayHours.isWorkDay && customSchedule?.preShiftReminderEnabled !== false) {
      const [startH, startM] = todayHours.workStartTime.split(':').map(Number);
      const reminderMins = customSchedule?.preShiftReminderMinutes ?? 15;
      
      const morningTarget = new Date(now);
      morningTarget.setHours(startH, startM - reminderMins, 0, 0);

      if (morningTarget > now) {
        const morningItem = ATTENDANCE_SCHEDULES.find((s) => s.id === 'morning_0730');
        if (morningItem) {
          const customItem: AttendanceAlertScheduleItem = {
            ...morningItem,
            title: `⏰ [건명기업] ${todayHours.workStartTime} 출근 체크 알림`,
            body: `출근 예정 시각(${todayHours.workStartTime}) ${reminderMins}분 전입니다. 사업장 진입 시 자동 출근이 처리됩니다.`
          };
          await scheduleNativeNotification(customItem, morningTarget);
        }
      }
    }
  }

  // 2. Evening checks (17:00, 18:00, 19:00)
  if (isClockedOut) {
    // User already clocked out -> cancel and suppress ALL evening alarms for today!
    await cancelNativeNotification(1700);
    await cancelNativeNotification(1800);
    await cancelNativeNotification(1900);
    try {
      localStorage.setItem(`attendance_alert_sent_${todayStr}_evening_1700`, 'true');
      localStorage.setItem(`attendance_alert_sent_${todayStr}_evening_1800`, 'true');
      localStorage.setItem(`attendance_alert_sent_${todayStr}_evening_1900`, 'true');
    } catch (e) {}
  } else if (isClockedIn) {
    // User is clocked in and still working -> schedule pending evening notifications
    const now = new Date();
    const eveningItems = ATTENDANCE_SCHEDULES.filter((s) => s.type.startsWith('evening_'));

    for (const item of eveningItems) {
      const target = new Date(now);
      target.setHours(item.hour, item.minute, 0, 0);
      if (target > now) {
        await scheduleNativeNotification(item, target);
      }
    }
  }
};

/**
 * Periodic Web & Foreground Check (runs every minute and on visibility change)
 */
export const checkAndTriggerScheduledAttendanceAlerts = async (
  attendance: Attendance | null,
  customSchedule?: EmployeeWorkScheduleSettings | null
): Promise<void> => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const todayStr = format(now, 'yyyy-MM-dd');

  const isClockedIn = Boolean(attendance?.clockIn);
  const isClockedOut = Boolean(attendance?.clockOut);

  // 1. Check Morning Alert dynamically based on configured start time
  const todayHours = getTodayScheduledHours(customSchedule || null, now);
  if (todayHours.isWorkDay && customSchedule?.preShiftReminderEnabled !== false) {
    const [startH, startM] = todayHours.workStartTime.split(':').map(Number);
    const reminderMins = customSchedule?.preShiftReminderMinutes ?? 15;
    
    // Check if current time is within reminder window (e.g. 15m before up to 15m after start)
    const targetMinutes = startH * 60 + startM - reminderMins;
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const isMorningWindow = currentTotalMinutes >= targetMinutes && currentTotalMinutes <= targetMinutes + 45;

    if (isMorningWindow && !isClockedIn) {
      const sentKey = `attendance_alert_sent_${todayStr}_morning_0730`;
      let alreadySent = false;
      try {
        alreadySent = localStorage.getItem(sentKey) === 'true';
      } catch (e) {}

      if (!alreadySent) {
        try {
          localStorage.setItem(sentKey, 'true');
        } catch (e) {}

        await sendPushNotification(`⏰ [건명기업] ${todayHours.workStartTime} 출근 체크 알림`, {
          body: `오늘 예정 출근시각은 ${todayHours.workStartTime}입니다. 사업장 진입 시 자동 출근이 등록됩니다.`,
          tag: 'attendance-morning-checkin-reminder',
          requireInteraction: true,
          data: { url: '/attendance' }
        });
        if (navigator.vibrate) {
          navigator.vibrate([300, 100, 300, 100, 500]);
        }
      }
    }
  }

  // If already clocked out, suppress all evening alerts
  if (isClockedOut) {
    try {
      localStorage.setItem(`attendance_alert_sent_${todayStr}_evening_1700`, 'true');
      localStorage.setItem(`attendance_alert_sent_${todayStr}_evening_1800`, 'true');
      localStorage.setItem(`attendance_alert_sent_${todayStr}_evening_1900`, 'true');
    } catch (e) {}
    return;
  }

  // 2. Check Evening Alerts (17:00, 18:00, 19:00)
  if (isClockedIn && !isClockedOut) {
    if (currentHour === 17 && currentMinute >= 0 && currentMinute <= 55) {
      await triggerEveningAlertIfPending('evening_1700', todayStr);
    } else if (currentHour === 18 && currentMinute >= 0 && currentMinute <= 55) {
      await triggerEveningAlertIfPending('evening_1800', todayStr);
    } else if (currentHour === 19 && currentMinute >= 0 && currentMinute <= 55) {
      await triggerEveningAlertIfPending('evening_1900', todayStr);
    }
  }
};

/**
 * Helper to trigger single evening alert if not already sent today
 */
const triggerEveningAlertIfPending = async (
  scheduleId: 'evening_1700' | 'evening_1800' | 'evening_1900',
  todayStr: string
) => {
  const sentKey = `attendance_alert_sent_${todayStr}_${scheduleId}`;
  let alreadySent = false;
  try {
    alreadySent = localStorage.getItem(sentKey) === 'true';
  } catch (e) {}

  if (!alreadySent) {
    try {
      localStorage.setItem(sentKey, 'true');
    } catch (e) {}

    const item = ATTENDANCE_SCHEDULES.find((s) => s.id === scheduleId);
    if (item) {
      await sendPushNotification(item.title, {
        body: item.body,
        tag: `attendance-${scheduleId}-reminder`,
        requireInteraction: true,
        data: { url: '/attendance' }
      });
      if (navigator.vibrate) {
        navigator.vibrate([400, 150, 400, 150, 600]);
      }
    }
  }
};

/**
 * Test Trigger Function for UI testing
 */
export const testTriggerAttendanceAlert = async (
  type: 'morning' | 'evening_17' | 'evening_18' | 'evening_19'
) => {
  const item = ATTENDANCE_SCHEDULES.find((s) => s.type === type);
  if (!item) return;

  await sendPushNotification(`[테스트] ${item.title}`, {
    body: `${item.body} (알림 정상 수신 테스트)`,
    tag: `test-${item.id}`,
    requireInteraction: true,
    data: { url: '/attendance' }
  });

  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
};
