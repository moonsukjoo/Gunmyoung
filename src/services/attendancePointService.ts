import { db, auth } from '@/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { OperationType } from '@/lib/errorHandlers';

export const DAILY_ATTENDANCE_REWARD_KRW = 30;
export const KRW_PER_POINT = 5000;
export const DAILY_ATTENDANCE_REWARD_POINTS = DAILY_ATTENDANCE_REWARD_KRW / KRW_PER_POINT;

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
  return Math.round(num * 1000) / 1000;
}

export function pointsToKrw(points?: number | null): number {
  return Math.round(normalizePoints(points) * KRW_PER_POINT);
}

export function formatPointsDisplay(points?: number | null): string {
  return normalizePoints(points).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/**
 * 출근 등록 시 1일 1회 칭찬포인트 10원(0.002P)을 원자적으로 적립합니다.
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

  try {
    return await runTransaction(db, async (tx) => {
      const [attSnap, userSnap] = await Promise.all([
        tx.get(attendanceRef),
        tx.get(userRef),
      ]);

      const currentPoints = userSnap.exists()
        ? normalizePoints(userSnap.data()?.points)
        : 0;

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

      if (!userSnap.exists()) {
        return {
          awarded: false,
          alreadyAwarded: false,
          rewardKrw: 0,
          rewardPoints: 0,
          totalPoints: 0,
          totalKrw: 0,
        };
      }

      const nextPoints = normalizePoints(currentPoints + DAILY_ATTENDANCE_REWARD_POINTS);
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
          attendancePointAmountKrw: DAILY_ATTENDANCE_REWARD_KRW,
          attendancePointsDelta: DAILY_ATTENDANCE_REWARD_POINTS,
          attendancePointAwardedAt: awardedAt,
        },
        { merge: true }
      );

      return {
        awarded: true,
        alreadyAwarded: false,
        rewardKrw: DAILY_ATTENDANCE_REWARD_KRW,
        rewardPoints: DAILY_ATTENDANCE_REWARD_POINTS,
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
