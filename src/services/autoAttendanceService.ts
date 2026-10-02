import { db } from '@/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  limit,
  addDoc
} from 'firebase/firestore';
import { AttendanceLocationSettings, Attendance } from '@/types';
import { format } from 'date-fns';
import { calculateAttendanceHours } from '@/lib/attendance';
import { checkIsSpecialDay } from '@/lib/holidays';
import { grantRandomShipPart } from './shipService';

export const DEFAULT_ATTENDANCE_LOCATION_SETTINGS: AttendanceLocationSettings = {
  centerLat: 35.5020, // Default baseline placeholder if not set
  centerLng: 129.3780,
  locationName: '건명기업 본사/사업장',
  checkInRadius: 1000, // 1km 이내 출근
  checkOutRadius: 2000, // 2km 이상 이탈 시 퇴근 대기
  geofenceBufferMeters: 500, // 500m 허용 오차 범위 (Geofencing Buffer)
  locationRetentionMinutes: 15, // 15분 위치 유지 모드 (GPS 일시 소실/지터 방지)
  pendingExitTimeoutMinutes: 120, // 2시간(120분) 경과 시 확정
  autoClockInEnabled: true,
  autoClockOutEnabled: true,
  coreStartHour: 8,
  coreStartMin: 0,
  coreEndHour: 17,
  coreEndMin: 0,
  lunchStartHour: 12,
  lunchEndHour: 13
};

/**
 * Loads current location settings from Firestore
 */
export async function getAttendanceLocationSettings(): Promise<AttendanceLocationSettings | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'attendance_location'));
    if (snap.exists()) {
      return { ...DEFAULT_ATTENDANCE_LOCATION_SETTINGS, ...snap.data() } as AttendanceLocationSettings;
    }
    return null;
  } catch (error) {
    console.error('Failed to get attendance location settings', error);
    return null;
  }
}

/**
 * Saves or updates location settings in Firestore
 */
export async function saveAttendanceLocationSettings(
  settings: Partial<AttendanceLocationSettings>,
  updatedBy: string
): Promise<void> {
  const payload = {
    ...DEFAULT_ATTENDANCE_LOCATION_SETTINGS,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy
  };
  await setDoc(doc(db, 'settings', 'attendance_location'), payload, { merge: true });
}

/**
 * Auto Clock-In Execution
 */
export async function executeAutoClockIn(
  uid: string,
  lat?: number,
  lng?: number
): Promise<{ success: boolean; message: string }> {
  const dt = new Date();
  const todayStr = format(dt, 'yyyy-MM-dd');
  const attendanceId = `${uid}_${todayStr}`;
  const attendanceRef = doc(db, 'attendance', attendanceId);

  // Check if attendance doc already exists
  const existingSnap = await getDoc(attendanceRef);
  if (existingSnap.exists()) {
    const data = existingSnap.data() as Attendance;
    if (data.clockIn) {
      return { success: false, message: '이미 오늘의 출근 기록이 존재합니다.' };
    }
  }

  try {
    await setDoc(attendanceRef, {
      uid,
      date: todayStr,
      clockIn: dt.toISOString(),
      status: 'PRESENT',
      workHours: 0,
      overtimeHours: 0,
      autoClockIn: true,
      clockInLat: lat || null,
      clockInLng: lng || null,
      createdAt: dt.toISOString(),
      pendingExitSince: null
    }, { merge: true });

    // Enable ghost guard & update user movement
    await updateDoc(doc(db, 'users', uid), {
      ghostGuardEnabled: true,
      lastMovementAt: dt.toISOString(),
      isImmobile: false
    }).catch(err => console.warn('User ghost guard update warning', err));

    // Grant ship part
    grantRandomShipPart(uid, '출근');

    return { 
      success: true, 
      message: `[자동 출근 완료] 사업장 반경 1km 이내 진입 (${format(dt, 'HH:mm')})` 
    };
  } catch (error: any) {
    console.error('Auto clock-in failed', error);
    return { success: false, message: error?.message || '자동 출근 처리 중 오류 발생' };
  }
}

/**
 * Auto Clock-Out Execution (after 2-hour departure confirmation)
 */
export async function executeAutoClockOut(
  uid: string,
  todayAttendance: Attendance,
  specialDates: Record<string, any> = {},
  exitRecordedTime?: string,
  lat?: number,
  lng?: number
): Promise<{ success: boolean; message: string }> {
  if (!todayAttendance || !todayAttendance.clockIn || todayAttendance.clockOut) {
    return { success: false, message: '퇴근 대상이 아니거나 이미 퇴근 처리되었습니다.' };
  }

  const dt = new Date();
  // If exit recorded time exists, we can use it or the current time
  const clockOutTime = exitRecordedTime ? new Date(exitRecordedTime) : dt;
  
  // Calculate attendance hours
  const isSpecialVal = checkIsSpecialDay(new Date(todayAttendance.clockIn), specialDates).isSpecial;
  const { workHours, overtimeHours } = calculateAttendanceHours(
    todayAttendance.clockIn, 
    clockOutTime, 
    isSpecialVal
  );

  const attendanceRef = doc(db, 'attendance', todayAttendance.id);

  try {
    await updateDoc(attendanceRef, {
      clockOut: clockOutTime.toISOString(),
      workHours,
      overtimeHours,
      autoClockOut: true,
      autoClockOutReason: 'GEOFENCE_2KM_2HOURS_CONFIRMED',
      clockOutLat: lat || null,
      clockOutLng: lng || null,
      pendingExitSince: null
    });

    // Disable ghost guard
    await updateDoc(doc(db, 'users', uid), {
      ghostGuardEnabled: false,
      isImmobile: false
    }).catch(err => console.warn('User ghost guard disable warning', err));

    // Save notification to Firestore notifications collection
    await addDoc(collection(db, 'notifications'), {
      uid,
      title: '오늘의 근태가 성공적으로 확정되었습니다',
      message: `사업장 2km 이탈 후 2시간 경과로 ${format(clockOutTime, 'HH:mm')} 기준 퇴근(${workHours.toFixed(1)}시간 인정)이 최종 확정되었습니다.`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: new Date().toISOString()
    }).catch(err => console.warn('Attendance notification error:', err));

    return { 
      success: true, 
      message: `[자동 퇴근 확정] 사업장 2km 이탈 2시간 경과로 퇴근 처리 완료 (${workHours.toFixed(1)}시간 인정)` 
    };
  } catch (error: any) {
    console.error('Auto clock-out confirmation failed', error);
    return { success: false, message: error?.message || '자동 퇴근 처리 중 오류 발생' };
  }
}

/**
 * Update Pending Exit state in Firestore
 */
export async function updatePendingExitInDb(
  attendanceId: string, 
  pendingExitSince: string | null
): Promise<void> {
  try {
    const ref = doc(db, 'attendance', attendanceId);
    await updateDoc(ref, { pendingExitSince });
  } catch (e) {
    console.warn('Failed to update pendingExitSince in DB', e);
  }
}

/**
 * Restore/Resume attendance when accidentally clocked out (근무중 복구)
 */
export async function restoreActiveAttendance(
  attendanceId: string,
  uid: string
): Promise<{ success: boolean; message: string }> {
  try {
    const attendanceRef = doc(db, 'attendance', attendanceId);
    const snap = await getDoc(attendanceRef);
    if (!snap.exists()) {
      return { success: false, message: '출근 기록을 찾을 수 없습니다.' };
    }

    await updateDoc(attendanceRef, {
      clockOut: null,
      workHours: 0,
      overtimeHours: 0,
      autoClockOut: false,
      autoClockOutReason: null,
      pendingExitSince: null
    });

    // Re-enable ghost guard & update user state
    await updateDoc(doc(db, 'users', uid), {
      ghostGuardEnabled: true,
      lastMovementAt: new Date().toISOString(),
      isImmobile: false
    }).catch(err => console.warn('User ghost guard update warning', err));

    return { success: true, message: '오늘의 출근 상태가 정상 복구되었습니다! (현재 근무 중)' };
  } catch (error: any) {
    console.error('Failed to restore attendance', error);
    return { success: false, message: error?.message || '근태 복구 중 오류 발생' };
  }
}

