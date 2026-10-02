import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  limit 
} from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { AttendanceLocationSettings, Attendance, EmployeeWorkScheduleSettings } from '@/types';
import { calculateDistanceInMeters } from '@/lib/geoUtils';
import { 
  getAttendanceLocationSettings, 
  saveAttendanceLocationSettings, 
  executeAutoClockIn, 
  executeAutoClockOut,
  updatePendingExitInDb,
  restoreActiveAttendance,
  DEFAULT_ATTENDANCE_LOCATION_SETTINGS 
} from '@/services/autoAttendanceService';
import { 
  getEmployeeSchedule, 
  saveEmployeeSchedule, 
  getTodayScheduledHours, 
  isWithinAutoCheckInWindow, 
  DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS 
} from '@/services/employeeScheduleService';
import { sendPushNotification, requestNotificationPermission } from '@/services/notificationService';
import { 
  syncAttendanceNotificationSchedules, 
  checkAndTriggerScheduledAttendanceAlerts 
} from '@/services/attendanceNotificationScheduler';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface PendingExitState {
  exitSince: string;
  remainingSeconds: number;
  progressPercent: number;
}

interface AutoAttendanceContextType {
  locationSettings: AttendanceLocationSettings | null;
  employeeSchedule: EmployeeWorkScheduleSettings | null;
  todayScheduledHours: {
    isWorkDay: boolean;
    workStartTime: string;
    workEndTime: string;
    lunchStartTime: string;
    lunchEndTime: string;
    dayLabel: string;
  };
  isAutoCheckInEligibleNow: boolean;
  autoCheckInStatusMessage: string;
  currentLocation: CurrentLocation | null;
  distanceToCenter: number | null;
  isInsideCheckInZone: boolean;
  isOutsideCheckOutZone: boolean;
  isLocationRetentionActive: boolean;
  retentionRemainingMinutes: number;
  lastVerifiedInsideTime: number | null;
  geofenceBufferMeters: number;
  locationRetentionMinutes: number;
  pendingExitState: PendingExitState | null;
  todayAttendance: Attendance | null;
  isTracking: boolean;
  gpsError: string | null;
  isForeground: boolean;
  batterySavingActive: boolean;
  lastSyncTime: number;
  saveCurrentLocationAsBasePoint: () => Promise<boolean>;
  refreshLocation: (options?: { forceHighAccuracy?: boolean; maximumAge?: number }) => Promise<void>;
  updateCustomLocationSettings: (settings: Partial<AttendanceLocationSettings>) => Promise<boolean>;
  updateEmployeeSchedule: (settings: Partial<EmployeeWorkScheduleSettings>) => Promise<boolean>;
  restoreTodayAttendance: () => Promise<boolean>;
}

const AutoAttendanceContext = createContext<AutoAttendanceContextType | undefined>(undefined);

export const AutoAttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [locationSettings, setLocationSettings] = useState<AttendanceLocationSettings | null>(null);
  const [employeeSchedule, setEmployeeSchedule] = useState<EmployeeWorkScheduleSettings | null>(() => profile?.workScheduleSettings || null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [distanceToCenter, setDistanceToCenter] = useState<number | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [specialDates, setSpecialDates] = useState<Record<string, any>>({});
  const [pendingExitState, setPendingExitState] = useState<PendingExitState | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isForeground, setIsForeground] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  // Load employee's personalized schedule settings
  useEffect(() => {
    if (profile?.uid) {
      if (profile.workScheduleSettings) {
        setEmployeeSchedule(profile.workScheduleSettings);
      } else {
        getEmployeeSchedule(profile.uid).then((sched) => {
          setEmployeeSchedule(sched);
        });
      }
    } else {
      setEmployeeSchedule(DEFAULT_EMPLOYEE_SCHEDULE_SETTINGS);
    }
  }, [profile?.uid, profile?.workScheduleSettings]);

  // Today's scheduled hours and auto check-in eligibility
  const todayScheduledHours = getTodayScheduledHours(employeeSchedule);
  const autoCheckInEligibility = isWithinAutoCheckInWindow(employeeSchedule);
  const isAutoCheckInEligibleNow = autoCheckInEligibility.inWindow;
  const autoCheckInStatusMessage = autoCheckInEligibility.reason;

  // Geofencing Buffer & Location Retention Mode State
  const [lastVerifiedInsideTime, setLastVerifiedInsideTime] = useState<number | null>(() => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const stored = localStorage.getItem(`attendance_last_inside_${todayStr}`);
      if (stored) return new Date(stored).getTime();
    } catch (e) {}
    return null;
  });
  const [isLocationRetentionActive, setIsLocationRetentionActive] = useState<boolean>(false);
  const [retentionRemainingMinutes, setRetentionRemainingMinutes] = useState<number>(15);

  const isForegroundRef = useRef<boolean>(typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);
  const lastProcessedLocRef = useRef<CurrentLocation | null>(null);
  const lastVerifiedInsideTimeRef = useRef<number | null>(lastVerifiedInsideTime);
  const watchIdRef = useRef<number | null>(null);
  const isAutoClockingInRef = useRef<boolean>(false);
  const isAutoClockingOutRef = useRef<boolean>(false);
  const lastExitAlertTimeRef = useRef<number>(0);
  const lastEntryPushTimeRef = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request push notification permission on initial mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // 1. Listen to global location settings in Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'attendance_location'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AttendanceLocationSettings;
          setLocationSettings({ ...DEFAULT_ATTENDANCE_LOCATION_SETTINGS, ...data });
        } else {
          // If not configured yet, use default
          setLocationSettings(DEFAULT_ATTENDANCE_LOCATION_SETTINGS);
        }
      },
      (err) => {
        console.warn('Error listening to attendance_location settings', err);
      }
    );
    return () => unsub();
  }, []);

  // 2. Listen to special dates (holidays / multipliers)
  useEffect(() => {
    const q = query(collection(db, 'specialDates'));
    const unsub = onSnapshot(q, (snapshot) => {
      const dates: Record<string, any> = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.date) dates[data.date] = data;
      });
      setSpecialDates(dates);
    });
    return () => unsub();
  }, []);

  // 3. Listen to today's attendance record for current user
  useEffect(() => {
    if (!profile?.uid) {
      setTodayAttendance(null);
      return;
    }
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const attendanceDocRef = doc(db, 'attendance', `${profile.uid}_${todayStr}`);

    const unsub = onSnapshot(attendanceDocRef, (snap) => {
      if (snap.exists()) {
        const att = { id: snap.id, ...snap.data() } as Attendance;
        setTodayAttendance(att);
        // Sync push notification schedules whenever today's attendance changes
        syncAttendanceNotificationSchedules(att, employeeSchedule).catch(() => {});
      } else {
        setTodayAttendance(null);
        syncAttendanceNotificationSchedules(null, employeeSchedule).catch(() => {});
      }
    }, (err) => {
      console.warn('Error listening to today attendance', err);
    });

    return () => unsub();
  }, [profile?.uid, employeeSchedule]);

  // 4. Update distance whenever currentLocation or locationSettings change
  useEffect(() => {
    if (!currentLocation || !locationSettings || locationSettings.centerLat === undefined || locationSettings.centerLng === undefined) {
      setDistanceToCenter(null);
      return;
    }

    const dist = calculateDistanceInMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      locationSettings.centerLat,
      locationSettings.centerLng
    );
    setDistanceToCenter(dist);
  }, [currentLocation, locationSettings]);

  // 5. GPS Location Handler with Battery-Saving Movement/Jitter Filter
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const newLat = position.coords.latitude;
    const newLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const now = position.timestamp || Date.now();

    // Battery & CPU optimization: filter stationary jitter (movement < 5m within 10s without major accuracy change)
    if (lastProcessedLocRef.current) {
      const movedMeters = calculateDistanceInMeters(
        lastProcessedLocRef.current.latitude,
        lastProcessedLocRef.current.longitude,
        newLat,
        newLng
      );
      const timeDeltaMs = now - lastProcessedLocRef.current.timestamp;
      
      if (movedMeters < 5 && timeDeltaMs < 10000 && Math.abs(accuracy - lastProcessedLocRef.current.accuracy) < 10) {
        return; // Skip duplicate processing for stationary device
      }
    }

    const loc: CurrentLocation = {
      latitude: newLat,
      longitude: newLng,
      accuracy,
      timestamp: now
    };
    lastProcessedLocRef.current = loc;
    setCurrentLocation(loc);
    setGpsError(null);
    setIsTracking(true);
    setLastSyncTime(Date.now());
  }, []);

  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    console.warn('Geolocation watch error:', err.message);
    setGpsError(err.message || 'GPS 위치 정보를 가져올 수 없습니다.');
    setIsTracking(false);
  }, []);

  const refreshLocation = useCallback(async (options?: { forceHighAccuracy?: boolean; maximumAge?: number }): Promise<void> => {
    if (!navigator.geolocation) {
      setGpsError('현재 브라우저/기기가 GPS 위치 정보를 지원하지 않습니다.');
      return;
    }

    const highAcc = options?.forceHighAccuracy ?? isForegroundRef.current;
    const maxAge = options?.maximumAge ?? (isForegroundRef.current ? 5000 : 30000);
    const timeout = highAcc ? 15000 : 25000;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePositionUpdate(pos);
          resolve();
        },
        (err) => {
          handlePositionError(err);
          resolve();
        },
        { enableHighAccuracy: highAcc, timeout, maximumAge: maxAge }
      );
    });
  }, [handlePositionUpdate, handlePositionError]);

  // Dynamic Watcher: Switches between High-Accuracy (Foreground) and Low-Power Battery Saver (Background)
  const startWatcher = useCallback((isFg: boolean) => {
    if (!navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (e) {}
      watchIdRef.current = null;
    }

    try {
      // Foreground: High Accuracy (10s max age to avoid continuous hardware GNSS lock)
      // Background: Low Power mode (disables high accuracy chip, uses 60s cache, saves ~80% GPS battery)
      const watchOptions: PositionOptions = isFg
        ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        : { enableHighAccuracy: false, timeout: 35000, maximumAge: 60000 };

      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        watchOptions
      );
    } catch (e) {
      console.warn('Failed to start watchPosition', e);
    }
  }, [handlePositionUpdate, handlePositionError]);

  /**
   * Helper to accurately determine the first workplace exit timestamp.
   * Only returns an exit timestamp if explicitly saved in Firestore or localStorage.
   */
  const determineFirstExitSince = useCallback((
    attendance: Attendance | null,
    settings: AttendanceLocationSettings | null
  ): string | null => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 1. If already saved in Firestore doc
    if (attendance?.pendingExitSince) {
      return attendance.pendingExitSince;
    }

    // 2. If saved in localStorage from earlier today
    try {
      const localPending = localStorage.getItem(`attendance_pending_exit_${todayStr}`);
      if (localPending) return localPending;
    } catch (e) {}

    return null;
  }, []);

  // Immediate State Resynchronization when returning to Foreground
  const syncOnForeground = useCallback(async () => {
    isForegroundRef.current = true;
    setIsForeground(true);

    // 1. Immediately switch watcher to responsive high-accuracy mode
    startWatcher(true);

    // 2. Force fresh instant GPS fix (bypass cache)
    refreshLocation({ forceHighAccuracy: true, maximumAge: 0 }).catch(() => {});

    // 3. Instant Pending Exit Expiration & Retention Mode Check
    if (todayAttendance?.clockIn && !todayAttendance?.clockOut) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const checkOutRadius = locationSettings?.checkOutRadius || 2000;
      const geofenceBuffer = locationSettings?.geofenceBufferMeters ?? 500;
      const effectiveCheckOut = checkOutRadius + geofenceBuffer;
      const retentionMinutes = locationSettings?.locationRetentionMinutes ?? 15;
      const retentionGracePeriodMs = retentionMinutes * 60 * 1000;

      const lastInsideMs = (function() {
        try {
          const stored = localStorage.getItem(`attendance_last_inside_${todayStr}`);
          return stored ? new Date(stored).getTime() : null;
        } catch (e) { return null; }
      })();

      const nowMs = Date.now();
      const isCurrentlyNear = distanceToCenter !== null && distanceToCenter < effectiveCheckOut;
      const isWithinRetentionWindow = lastInsideMs !== null && (nowMs - lastInsideMs < retentionGracePeriodMs);

      // If user is currently near the workplace or was verified inside within the 15-minute grace window:
      if (isCurrentlyNear || isWithinRetentionWindow) {
        if (isCurrentlyNear) {
          lastVerifiedInsideTimeRef.current = nowMs;
          setLastVerifiedInsideTime(nowMs);
          setIsLocationRetentionActive(false);
          setRetentionRemainingMinutes(retentionMinutes);
          try {
            localStorage.setItem(`attendance_last_inside_${todayStr}`, new Date(nowMs).toISOString());
          } catch (e) {}
        } else if (isWithinRetentionWindow && lastInsideMs) {
          setIsLocationRetentionActive(true);
          const remMins = Math.max(1, Math.ceil((retentionGracePeriodMs - (nowMs - lastInsideMs)) / 60000));
          setRetentionRemainingMinutes(remMins);
        }

        // Cancel any spurious departure state
        if (todayAttendance.pendingExitSince || pendingExitState) {
          updatePendingExitInDb(todayAttendance.id, null);
          setPendingExitState(null);
          try {
            localStorage.removeItem(`attendance_pending_exit_${todayStr}`);
          } catch (e) {}
        }
      } else {
        // User has been genuinely outside for longer than the retention grace window
        const firstExitSince = determineFirstExitSince(todayAttendance, locationSettings);
        if (firstExitSince && distanceToCenter !== null && distanceToCenter >= effectiveCheckOut) {
          const pendingTimeoutMinutes = locationSettings?.pendingExitTimeoutMinutes || 120;
          const pendingTimeoutMs = pendingTimeoutMinutes * 60 * 1000;
          const exitTimeMs = new Date(firstExitSince).getTime();
          const elapsedMs = Date.now() - exitTimeMs;

          if (locationSettings?.autoClockOutEnabled !== false && elapsedMs >= pendingTimeoutMs && !isAutoClockingOutRef.current) {
            isAutoClockingOutRef.current = true;
            executeAutoClockOut(
              profile?.uid || '',
              todayAttendance,
              specialDates,
              firstExitSince,
              currentLocation?.latitude,
              currentLocation?.longitude
            )
              .then((res) => {
                if (res.success) {
                  const exitFormatted = format(new Date(firstExitSince), 'HH:mm');
                  toast.success('🏁 자동 퇴근 확정 완료 (포그라운드 복귀 동기화)', {
                    description: `사업장 ${checkOutRadius}m(+버퍼 ${geofenceBuffer}m) 이탈 2시간 경과로 최초 이탈 시각(${exitFormatted}) 기준 퇴근 처리되었습니다.`,
                    duration: 10000
                  });
                  sendPushNotification('오늘의 근태가 성공적으로 확정되었습니다', {
                    body: `사업장 이탈 후 2시간이 경과하여 최초 이탈 시각(${exitFormatted}) 기준 오늘의 출퇴근 기록이 최종 확정되었습니다.`,
                    tag: 'attendance-confirmed-clockout',
                    requireInteraction: true,
                    data: { url: '/attendance' }
                  }).catch(() => {});
                  if (navigator.vibrate) navigator.vibrate([500, 300, 500, 300, 500]);
                }
              })
              .finally(() => {
                isAutoClockingOutRef.current = false;
                setPendingExitState(null);
                try {
                  localStorage.removeItem(`attendance_pending_exit_${todayStr}`);
                } catch (e) {}
              });
          }
        }
      }
    }

    // 4. Trigger scheduled attendance push alerts check (07:30 check-in, 17:00 / 18:00 / 19:00 check-out)
    checkAndTriggerScheduledAttendanceAlerts(todayAttendance, employeeSchedule).catch(() => {});

    setLastSyncTime(Date.now());
  }, [startWatcher, refreshLocation, todayAttendance, locationSettings, specialDates, profile?.uid, currentLocation, distanceToCenter, determineFirstExitSince, pendingExitState, employeeSchedule]);

  const handleAppBackgrounded = useCallback(() => {
    isForegroundRef.current = false;
    setIsForeground(false);
    // Switch to battery-optimized background watcher
    startWatcher(false);
  }, [startWatcher]);

  // Lifecycle listeners for Foreground/Background transitions (Web + Capacitor)
  useEffect(() => {
    // Initial start
    startWatcher(isForegroundRef.current);
    refreshLocation({ forceHighAccuracy: true });

    // 1. Web visibilitychange (Tab switch, browser minimization, screen on/off)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncOnForeground();
      } else {
        handleAppBackgrounded();
      }
    };

    // 2. Window focus & pageshow
    const handleFocus = () => {
      syncOnForeground();
    };

    const handlePageShow = () => {
      syncOnForeground();
    };

    // 3. Network online reconnection
    const handleOnline = () => {
      syncOnForeground();
    };

    // 4. Mobile / Cordova resume
    const handleResume = () => {
      syncOnForeground();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', handleOnline);
    document.addEventListener('resume', handleResume);

    // 5. Capacitor Native App State listener
    let capListenerHandle: any = null;
    try {
      if (Capacitor.isNativePlatform?.() || typeof CapApp !== 'undefined') {
        CapApp.addListener('appStateChange', (state) => {
          if (state.isActive) {
            syncOnForeground();
          } else {
            handleAppBackgrounded();
          }
        }).then((h) => {
          capListenerHandle = h;
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore if not in Capacitor native context
    }

    return () => {
      if (watchIdRef.current !== null) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (e) {}
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('resume', handleResume);
      if (capListenerHandle && typeof capListenerHandle.remove === 'function') {
        capListenerHandle.remove();
      }
    };
  }, [syncOnForeground, handleAppBackgrounded, startWatcher, refreshLocation]);

  // 6. Automated Attendance State Machine (Check-in, Departure Pending, and Confirmed Check-out with Buffer & Retention)
  const geofenceBufferMeters = locationSettings?.geofenceBufferMeters ?? 500;
  const locationRetentionMinutes = locationSettings?.locationRetentionMinutes ?? 15;
  const effectiveCheckInRadius = (locationSettings?.checkInRadius || 1000) + geofenceBufferMeters;
  const effectiveCheckOutRadius = (locationSettings?.checkOutRadius || 2000) + geofenceBufferMeters;

  const isInsideCheckInZone = distanceToCenter !== null && locationSettings !== null && distanceToCenter <= effectiveCheckInRadius;
  const isOutsideCheckOutZone = distanceToCenter !== null && locationSettings !== null && distanceToCenter >= effectiveCheckOutRadius;

  useEffect(() => {
    if (!profile?.uid || !locationSettings || distanceToCenter === null) return;

    const checkInRadius = locationSettings.checkInRadius || 1000;
    const checkOutRadius = locationSettings.checkOutRadius || 2000;
    const pendingTimeoutMinutes = locationSettings.pendingExitTimeoutMinutes || 120;
    const pendingTimeoutMs = pendingTimeoutMinutes * 60 * 1000;
    const retentionGracePeriodMs = locationRetentionMinutes * 60 * 1000;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowMs = Date.now();

    // --- CASE A: Within Workplace Area (출근 구역 또는 허용 오차 버퍼 500m 이내) ---
    if (distanceToCenter <= effectiveCheckInRadius || distanceToCenter < effectiveCheckOutRadius) {
      // Update location retention verified timestamp
      lastVerifiedInsideTimeRef.current = nowMs;
      setLastVerifiedInsideTime(nowMs);
      setIsLocationRetentionActive(false);
      setRetentionRemainingMinutes(locationRetentionMinutes);
      try {
        localStorage.setItem(`attendance_last_inside_${todayStr}`, new Date(nowMs).toISOString());
      } catch (e) {}

      // If user is not clocked in yet and inside check-in boundary
      if (!todayAttendance?.clockIn && distanceToCenter <= effectiveCheckInRadius) {
        if (nowMs - lastEntryPushTimeRef.current > 10 * 60 * 1000) {
          lastEntryPushTimeRef.current = nowMs;
          sendPushNotification('📍 사업장 진입 확인', {
            body: `사업장 반경 ${Math.round(distanceToCenter)}m 지점에 도착했습니다. 출근을 확인해 주세요.`,
            tag: 'zone-entry-checkin',
            requireInteraction: true,
            data: { url: '/' }
          }).catch(() => {});
        }

        const isEmpAutoCheckIn = employeeSchedule?.autoCheckInEnabled !== false;
        const isGlobalAutoCheckIn = locationSettings.autoClockInEnabled !== false;
        const checkInWindowCheck = isWithinAutoCheckInWindow(employeeSchedule);

        if (isGlobalAutoCheckIn && isEmpAutoCheckIn && checkInWindowCheck.inWindow && !isAutoClockingInRef.current) {
          isAutoClockingInRef.current = true;
          executeAutoClockIn(profile.uid, currentLocation?.latitude, currentLocation?.longitude)
            .then((res) => {
              if (res.success) {
                const scheduledStart = todayScheduledHours.workStartTime || '08:00';
                toast.success('🛰️ 맞춤 근무시간 자동 출근 완료', {
                  description: `사업장 허용 범위(현재 ${Math.round(distanceToCenter)}m) 진입 확인 - ${scheduledStart} 기준 시작 등록되었습니다.`,
                  duration: 8000
                });
                sendPushNotification('✅ 출근 등록 완료', {
                  body: `사업장 도착이 확인되어 오늘 출근(${scheduledStart} 기준)이 정상 등록되었습니다.`,
                  tag: 'checkin-completed',
                  data: { url: '/' }
                }).catch(() => {});
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
              }
            })
            .finally(() => {
              setTimeout(() => {
                isAutoClockingInRef.current = false;
              }, 10000);
            });
        }
      }

      // If user was in pending departure state and moved back within safe zone, cancel pending exit
      if (todayAttendance?.clockIn && !todayAttendance?.clockOut) {
        if (todayAttendance.pendingExitSince || pendingExitState) {
          updatePendingExitInDb(todayAttendance.id, null);
          setPendingExitState(null);
          try {
            localStorage.removeItem(`attendance_pending_exit_${todayStr}`);
          } catch (e) {}
          toast.info('🏢 사업장 인근 복귀 확인', {
            description: '정상 근무구역으로 복귀하여 퇴근 대기 상태가 해제되었습니다.',
            duration: 5000
          });
          sendPushNotification('🏢 사업장 복귀 확인', {
            body: '정상 근무구역으로 복귀하여 퇴근 대기 상태가 해제되었습니다.',
            tag: 'zone-return',
            data: { url: '/' }
          }).catch(() => {});
        }
      }
    }

    // --- CASE B: Departure Detected (반경 2km + 버퍼 500m 이상 이탈 & 근무 중) ---
    if (todayAttendance?.clockIn && !todayAttendance?.clockOut) {
      if (distanceToCenter >= effectiveCheckOutRadius) {
        // Ignore poor GPS readings (> 350m accuracy) to prevent indoor false-positives
        if (currentLocation?.accuracy && currentLocation.accuracy > 350) {
          return;
        }

        const lastInsideMs = lastVerifiedInsideTimeRef.current || (function() {
          try {
            const stored = localStorage.getItem(`attendance_last_inside_${todayStr}`);
            return stored ? new Date(stored).getTime() : nowMs;
          } catch (e) { return nowMs; }
        })();

        const elapsedSinceInside = nowMs - lastInsideMs;

        // 🛡️ LOCATION RETENTION MODE (위치 유지 모드: 15분간 유효성 유지)
        // If user was inside the 500m buffer within the last 15 minutes, keep them safe and do NOT trigger departure
        if (elapsedSinceInside < retentionGracePeriodMs) {
          setIsLocationRetentionActive(true);
          const remMins = Math.max(1, Math.ceil((retentionGracePeriodMs - elapsedSinceInside) / 60000));
          setRetentionRemainingMinutes(remMins);
          return;
        }

        // 15-minute retention window has expired without any inside GPS ping:
        setIsLocationRetentionActive(false);

        const existingExitSince = todayAttendance.pendingExitSince || (function() {
          try {
            return localStorage.getItem(`attendance_pending_exit_${todayStr}`);
          } catch (e) { return null; }
        })();

        // Departure time starts when the 15-minute retention window ended
        const calculatedExitSince = new Date(lastInsideMs + retentionGracePeriodMs).toISOString();
        const firstExitSince = existingExitSince || calculatedExitSince;
        
        try {
          localStorage.setItem(`attendance_pending_exit_${todayStr}`, firstExitSince);
        } catch (e) {}

        if (!todayAttendance.pendingExitSince) {
          updatePendingExitInDb(todayAttendance.id, firstExitSince);
        }

        const exitTimeMs = new Date(firstExitSince).getTime();
        const elapsedMs = Date.now() - exitTimeMs;

        // If auto-clockout is enabled and 2 hours have already elapsed since departure, execute clockout!
        if (locationSettings.autoClockOutEnabled !== false && elapsedMs >= pendingTimeoutMs) {
          if (!isAutoClockingOutRef.current) {
            isAutoClockingOutRef.current = true;
            executeAutoClockOut(
              profile.uid,
              todayAttendance,
              specialDates,
              firstExitSince,
              currentLocation?.latitude,
              currentLocation?.longitude
            )
              .then((res) => {
                if (res.success) {
                  const exitFormatted = format(new Date(firstExitSince), 'HH:mm');
                  toast.success('🏁 자동 퇴근 확정 완료', {
                    description: `사업장 이탈 2시간 경과로 최초 이탈 시각(${exitFormatted}) 기준 퇴근 처리되었습니다.`,
                    duration: 10000
                  });
                  sendPushNotification('오늘의 근태가 성공적으로 확정되었습니다', {
                    body: `사업장 이탈 후 2시간이 경과하여 최초 이탈 시각(${exitFormatted}) 기준 오늘의 출퇴근 기록이 최종 확정되었습니다.`,
                    tag: 'attendance-confirmed-clockout',
                    requireInteraction: true,
                    data: { url: '/attendance' }
                  }).catch(() => {});
                  if (navigator.vibrate) navigator.vibrate([500, 300, 500, 300, 500]);
                }
              })
              .finally(() => {
                isAutoClockingOutRef.current = false;
                setPendingExitState(null);
                try {
                  localStorage.removeItem(`attendance_pending_exit_${todayStr}`);
                } catch (e) {}
              });
          }
        } else {
          // Still in waiting countdown
          const remainingMs = Math.max(0, pendingTimeoutMs - elapsedMs);
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          const progressPercent = Math.min(100, (elapsedMs / pendingTimeoutMs) * 100);

          setPendingExitState({
            exitSince: firstExitSince,
            remainingSeconds,
            progressPercent
          });

          const nowAlertMs = Date.now();
          if (nowAlertMs - lastExitAlertTimeRef.current > 60000) {
            lastExitAlertTimeRef.current = nowAlertMs;
            const exitFormatted = format(new Date(firstExitSince), 'HH:mm');
            toast.warning('⚠️ 사업장 이탈 감지 (퇴근 대기)', {
              description: `기준점에서 ${Math.round(distanceToCenter)}m 벗어났습니다. 최초 이탈(${exitFormatted}) 기준 2시간 후 자동 퇴근 확정됩니다.`,
              duration: 8000
            });
            if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
          }
        }
      } else if (distanceToCenter < effectiveCheckOutRadius && (todayAttendance.pendingExitSince || pendingExitState)) {
        // Returned within safe boundary before 2 hours expire!
        updatePendingExitInDb(todayAttendance.id, null);
        setPendingExitState(null);
        setIsLocationRetentionActive(false);
        try {
          localStorage.removeItem(`attendance_pending_exit_${todayStr}`);
          localStorage.setItem(`attendance_last_inside_${todayStr}`, new Date().toISOString());
        } catch (e) {}
        toast.info('🏢 사업장 인근 복귀 확인', {
          description: '정상 근무구역으로 복귀하여 퇴근 대기 상태가 해제되고 출근이 유지됩니다.',
          duration: 5000
        });
      }
    }
  }, [profile?.uid, distanceToCenter, locationSettings, todayAttendance, currentLocation, pendingExitState, locationRetentionMinutes, effectiveCheckInRadius, effectiveCheckOutRadius]);

  // 7. Interval Timer for Pending Exit Countdown & 2-Hour Auto Clock-out Execution
  useEffect(() => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);

    checkIntervalRef.current = setInterval(() => {
      if (!profile?.uid || !todayAttendance?.clockIn || todayAttendance?.clockOut) {
        setPendingExitState(null);
        return;
      }

      const activeExitSince = todayAttendance.pendingExitSince || determineFirstExitSince(todayAttendance, locationSettings);
      if (!activeExitSince) {
        setPendingExitState(null);
        return;
      }

      // Check if currently outside (must have valid distance)
      const effectiveCheckOut = (locationSettings?.checkOutRadius || 2000) + (locationSettings?.geofenceBufferMeters ?? 500);
      const isOutside = distanceToCenter !== null && distanceToCenter >= effectiveCheckOut;
      if (!isOutside) {
        setPendingExitState(null);
        return;
      }

      const pendingTimeoutMinutes = locationSettings?.pendingExitTimeoutMinutes || 120;
      const pendingTimeoutMs = pendingTimeoutMinutes * 60 * 1000;
      const exitTimeMs = new Date(activeExitSince).getTime();
      const elapsedMs = Date.now() - exitTimeMs;
      const remainingMs = Math.max(0, pendingTimeoutMs - elapsedMs);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const progressPercent = Math.min(100, (elapsedMs / pendingTimeoutMs) * 100);

      setPendingExitState({
        exitSince: activeExitSince,
        remainingSeconds,
        progressPercent
      });

      // If 2 hours (120 minutes) have elapsed while remaining outside and auto-clockout is enabled, trigger Confirmed Clock-Out!
      if (locationSettings?.autoClockOutEnabled !== false && elapsedMs >= pendingTimeoutMs && !isAutoClockingOutRef.current) {
        isAutoClockingOutRef.current = true;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        executeAutoClockOut(
          profile.uid,
          todayAttendance,
          specialDates,
          activeExitSince,
          currentLocation?.latitude,
          currentLocation?.longitude
        )
          .then((res) => {
            if (res.success) {
              const exitFormatted = format(new Date(activeExitSince), 'HH:mm');
              toast.success('🏁 자동 퇴근 확정 완료', {
                description: `사업장 이탈 2시간 경과로 최초 이탈 시각(${exitFormatted}) 기준 퇴근 처리되었습니다.`,
                duration: 10000
              });
              sendPushNotification('오늘의 근태가 성공적으로 확정되었습니다', {
                body: `사업장 이탈 후 2시간이 경과하여 최초 이탈 시각(${exitFormatted}) 기준 오늘의 출퇴근 기록이 최종 확정되었습니다.`,
                tag: 'attendance-confirmed-clockout',
                requireInteraction: true,
                data: { url: '/attendance' }
              }).catch(() => {});
              if (navigator.vibrate) navigator.vibrate([500, 300, 500, 300, 500]);
            }
          })
          .finally(() => {
            isAutoClockingOutRef.current = false;
            setPendingExitState(null);
            try {
              localStorage.removeItem(`attendance_pending_exit_${todayStr}`);
            } catch (e) {}
          });
      }
    }, 1000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [profile?.uid, todayAttendance, locationSettings, specialDates, currentLocation, distanceToCenter, determineFirstExitSince]);

  // Periodic Attendance Push Alert Checker (runs every 30 seconds to catch 07:30, 17:00, 18:00, 19:00 exact minute triggers)
  useEffect(() => {
    checkAndTriggerScheduledAttendanceAlerts(todayAttendance).catch(() => {});
    const alertInterval = setInterval(() => {
      checkAndTriggerScheduledAttendanceAlerts(todayAttendance).catch(() => {});
    }, 30000);

    return () => clearInterval(alertInterval);
  }, [todayAttendance]);

  // 8. 1-Click Save Current GPS as Base Point (기준점 등록)
  const saveCurrentLocationAsBasePoint = async (): Promise<boolean> => {
    try {
      await refreshLocation({ forceHighAccuracy: true });
      let lat = currentLocation?.latitude;
      let lng = currentLocation?.longitude;

      if (!lat || !lng) {
        // Attempt immediate one-time high-accuracy pull
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      if (!lat || !lng) {
        toast.error('현재 GPS 위치를 확인할 수 없습니다. 위치 권한을 확인해주세요.');
        return false;
      }

      const updatedBy = profile?.displayName || profile?.email || '관리자';
      await saveAttendanceLocationSettings(
        {
          centerLat: lat,
          centerLng: lng,
          locationName: '건명기업 본사/사업장',
          checkInRadius: 1000, // 1km
          checkOutRadius: 2000, // 2km
          pendingExitTimeoutMinutes: 120 // 2시간
        },
        updatedBy
      );

      toast.success('📍 출퇴근 기준점 등록 완료', {
        description: `현재 위치(위도: ${lat.toFixed(6)}, 경도: ${lng.toFixed(6)})가 전사 출퇴근 기준점으로 성공적으로 설정되었습니다.`,
        duration: 7000
      });
      return true;
    } catch (e: any) {
      console.error('Failed to set base point', e);
      toast.error('기준점 등록 중 오류가 발생했습니다: ' + (e?.message || ''));
      return false;
    }
  };

  const updateCustomLocationSettings = async (
    settings: Partial<AttendanceLocationSettings>
  ): Promise<boolean> => {
    try {
      const updatedBy = profile?.displayName || profile?.email || '관리자';
      await saveAttendanceLocationSettings(settings, updatedBy);
      toast.success('위치 기반 출퇴근 설정이 저장되었습니다.');
      return true;
    } catch (e: any) {
      console.error('Failed to update location settings', e);
      toast.error('설정 저장 실패: ' + (e?.message || ''));
      return false;
    }
  };

  const updateEmployeeSchedule = async (
    settings: Partial<EmployeeWorkScheduleSettings>
  ): Promise<boolean> => {
    if (!profile?.uid) {
      toast.error('로그인이 필요한 기능입니다.');
      return false;
    }
    try {
      const updated = await saveEmployeeSchedule(profile.uid, settings);
      setEmployeeSchedule(updated);
      toast.success('나의 근무시간 및 자동출퇴근 설정이 저장되었습니다.', {
        description: `표준 근무: ${updated.workStartTime} ~ ${updated.workEndTime}`
      });
      // Synchronize push alerts immediately
      syncAttendanceNotificationSchedules(todayAttendance, updated).catch(() => {});
      return true;
    } catch (e: any) {
      console.error('Failed to update employee schedule', e);
      toast.error('근무시간 설정 저장 실패: ' + (e?.message || ''));
      return false;
    }
  };

  const restoreTodayAttendance = async (): Promise<boolean> => {
    if (!todayAttendance || !profile?.uid) {
      toast.error('복구할 오늘의 출근 기록이 없습니다.');
      return false;
    }
    const res = await restoreActiveAttendance(todayAttendance.id, profile.uid);
    if (res.success) {
      toast.success(res.message);
      setPendingExitState(null);
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      try {
        localStorage.removeItem(`attendance_pending_exit_${todayStr}`);
        localStorage.setItem(`attendance_last_inside_${todayStr}`, new Date().toISOString());
      } catch (e) {}
      return true;
    } else {
      toast.error(res.message);
      return false;
    }
  };

  return (
    <AutoAttendanceContext.Provider
      value={{
        locationSettings,
        employeeSchedule,
        todayScheduledHours,
        isAutoCheckInEligibleNow,
        autoCheckInStatusMessage,
        currentLocation,
        distanceToCenter,
        isInsideCheckInZone,
        isOutsideCheckOutZone,
        isLocationRetentionActive,
        retentionRemainingMinutes,
        lastVerifiedInsideTime,
        geofenceBufferMeters,
        locationRetentionMinutes,
        pendingExitState,
        todayAttendance,
        isTracking,
        gpsError,
        isForeground,
        batterySavingActive: !isForeground,
        lastSyncTime,
        saveCurrentLocationAsBasePoint,
        refreshLocation,
        updateCustomLocationSettings,
        updateEmployeeSchedule,
        restoreTodayAttendance
      }}
    >
      {children}
    </AutoAttendanceContext.Provider>
  );
};

export const useAutoAttendance = () => {
  const context = useContext(AutoAttendanceContext);
  if (!context) {
    throw new Error('useAutoAttendance must be used within an AutoAttendanceProvider');
  }
  return context;
};
