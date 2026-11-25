import { useEffect, useState } from 'react';
import { db, auth } from '@/firebase';
import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/lib/errorHandlers';

export const DEFAULT_DAILY_ATTENDANCE_REWARD_KRW = 30;
export const DAILY_ATTENDANCE_REWARD_KRW = DEFAULT_DAILY_ATTENDANCE_REWARD_KRW;
export const KRW_PER_POINT = 5000;
export const DAILY_ATTENDANCE_REWARD_POINTS = DEFAULT_DAILY_ATTENDANCE_REWARD_KRW / KRW_PER_POINT;

export interface AttendanceRewardSettings {
  dailyAttendanceRewardKrw: number;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface DailyAttendanceRewardResult {
  awarded: boolean;
  alreadyAwarded: boolean;
  rewardKrw: number;
  rewardPoints: number;
  totalPoints: number;
  totalKrw: number;
}

export function normalizePoints(points?: number | null): number {
  const num = Number(points ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 10000) / 10000;
}

export function pointsToKrw(points?: number | null): number {
  return Math.round(normalizePoints(points) * KRW_PER_POINT);
}

export function formatPointsDisplay(points?: number | null): string {
  return normalizePoints(points).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function sanitizeRewardKrw(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return DEFAULT_DAILY_ATTENDANCE_REWARD_KRW;
  return Math.min(100000, Math.round(num));
}

// Live Firestore listener for settings/attendance_rewards
let cachedRewardKrw = DEFAULT_DAILY_ATTENDANCE_REWARD_KRW;
let cachedSettingsMeta: AttendanceRewardSettings = {
  dailyAttendanceRewardKrw: DEFAULT_DAILY_ATTENDANCE_REWARD_KRW,
};
const rewardListeners = new Set<(krw: number, meta: AttendanceRewardSettings) => void>();
let unsubFirestore: (() => void) | null = null;
let unsubAuth: (() => void) | null = null;

function notifyRewardListeners() {
  rewardListeners.forEach((cb) => {
    try {
      cb(cachedRewardKrw, cachedSettingsMeta);
    } catch (e) {
      console.warn('Reward listener error:', e);
    }
  });
}

function attachRewardSnapshot() {
  if (unsubFirestore || !auth.currentUser) return;
  unsubFirestore = onSnapshot(
    doc(db, 'settings', 'attendance_rewards'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<AttendanceRewardSettings>;
        const krw = sanitizeRewardKrw(data.dailyAttendanceRewardKrw);
        cachedRewardKrw = krw;
        cachedSettingsMeta = {
          dailyAttendanceRewardKrw: krw,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
          updatedByName: data.updatedByName,
        };
      } else {
        cachedRewardKrw = DEFAULT_DAILY_ATTENDANCE_REWARD_KRW;
        cachedSettingsMeta = { dailyAttendanceRewardKrw: DEFAULT_DAILY_ATTENDANCE_REWARD_KRW };
      }
      notifyRewardListeners();
    },
    (error) => {
      console.warn('Attendance reward settings listener warning:', error);
    }
  );
}

function ensureRewardSyncInitialized() {
  if (unsubAuth) return;
  unsubAuth = onAuthStateChanged(auth, (user) => {
    if (user) {
      attachRewardSnapshot();
    } else if (unsubFirestore) {
      unsubFirestore();
      unsubFirestore = null;
    }
  });
  if (auth.currentUser) {
    attachRewardSnapshot();
  }
}

export function getCachedDailyAttendanceRewardKrw(): number {
  return cachedRewardKrw;
}

export function subscribeDailyAttendanceReward(
  listener: (krw: number, meta: AttendanceRewardSettings) => void
): () => void {
  ensureRewardSyncInitialized();
  rewardListeners.add(listener);
  listener(cachedRewardKrw, cachedSettingsMeta);
  return () => {
    rewardListeners.delete(listener);
  };
}

export function useDailyAttendanceRewardKrw(): number {
  const [rewardKrw, setRewardKrw] = useState<number>(cachedRewardKrw);

  useEffect(() => {
    return subscribeDailyAttendanceReward((krw) => {
      setRewardKrw(krw);
    });
  }, []);

  return rewardKrw;
}

export function useAttendanceRewardSettings(): AttendanceRewardSettings {
  const [meta, setMeta] = useState<AttendanceRewardSettings>(cachedSettingsMeta);

  useEffect(() => {
    return subscribeDailyAttendanceReward((_, nextMeta) => {
      setMeta(nextMeta);
    });
  }, []);

  return meta;
}

export async function saveDailyAttendanceRewardKrw(
  rewardKrw: number,
  adminUid?: string,
  adminName?: string
): Promise<number> {
  const sanitized = sanitizeRewardKrw(rewardKrw);
  const payload: AttendanceRewardSettings = {
    dailyAttendanceRewardKrw: sanitized,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid || auth.currentUser?.uid || 'admin',
    updatedByName: adminName || '관리자',
  };
  try {
    await setDoc(doc(db, 'settings', 'attendance_rewards'), payload, { merge: true });
    cachedRewardKrw = sanitized;
    cachedSettingsMeta = payload;
    notifyRewardListeners();
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/attendance_rewards');
    throw error;
  }
}

/**
 * 출근 등록 시 1일 1회 Firestore(settings/attendance_rewards)에 설정된 칭찬포인트를 원자적으로 적립합니다.
 * 같은 날짜(dateStr)에 이미 적립된 경우 중복 적립하지 않습니다.
 */
export async function awardDailyAttendancePoints(
  uid: string,
  dateStr: string
): Promise<DailyAttendanceRewardResult> {
  if (!uid || !dateStr) {
    return {
      awarded: false,
      alreadyAwarded: false,
      rewardKrw: 0,
      rewardPoints: 0,
      totalPoints: 0,
      totalKrw: 0,
    };
  }

  const attendanceRef = doc(db, 'attendance', `${uid}_${dateStr}`);
  const userRef = doc(db, 'users', uid);
  const settingsRef = doc(db, 'settings', 'attendance_rewards');

  try {
    return await runTransaction(db, async (tx) => {
      const [attSnap, userSnap, settingsSnap] = await Promise.all([
        tx.get(attendanceRef),
        tx.get(userRef),
        tx.get(settingsRef),
      ]);

      const currentPoints = userSnap.exists()
        ? normalizePoints(userSnap.data()?.points)
        : 0;

      const rewardKrw = settingsSnap.exists()
        ? sanitizeRewardKrw(settingsSnap.data()?.dailyAttendanceRewardKrw)
        : DEFAULT_DAILY_ATTENDANCE_REWARD_KRW;
      const rewardPoints = normalizePoints(rewardKrw / KRW_PER_POINT);

      if (attSnap.exists() && attSnap.data()?.attendancePointAwarded === true) {
        return {
          awarded: false,
          alreadyAwarded: true,
          rewardKrw: 0,
          rewardPoints: 0,
          totalPoints: currentPoints,
          totalKrw: pointsToKrw(currentPoints),
        };
      }

      if (!userSnap.exists() || rewardKrw <= 0 || rewardPoints <= 0) {
        return {
          awarded: false,
          alreadyAwarded: false,
          rewardKrw: 0,
          rewardPoints: 0,
          totalPoints: currentPoints,
          totalKrw: pointsToKrw(currentPoints),
        };
      }

      const nextPoints = normalizePoints(currentPoints + rewardPoints);
      const awardedAt = new Date().toISOString();

      tx.update(userRef, {
        points: nextPoints,
      });

      tx.set(
        attendanceRef,
        {
          uid,
          date: dateStr,
          attendancePointAwarded: true,
          attendancePointAmountKrw: rewardKrw,
          attendancePointsDelta: rewardPoints,
          attendancePointAwardedAt: awardedAt,
        },
        { merge: true }
      );

      return {
        awarded: true,
        alreadyAwarded: false,
        rewardKrw,
        rewardPoints,
        totalPoints: nextPoints,
        totalKrw: pointsToKrw(nextPoints),
      };
    });
  } catch (error) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: OperationType.WRITE,
      path: `users/${uid} & attendance/${uid}_${dateStr}`,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
    };
    console.error('Daily attendance reward Firestore error:', JSON.stringify(errInfo));
    return {
      awarded: false,
      alreadyAwarded: false,
      rewardKrw: 0,
      rewardPoints: 0,
      totalPoints: 0,
      totalKrw: 0,
    };
  }
}
