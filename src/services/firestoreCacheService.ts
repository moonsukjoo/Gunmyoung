import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import {
  AccidentCase,
  Attendance,
  Department,
  FactoryBoundaryCalibration,
  FactoryJig,
  JobRole,
  Notice,
  StatutorySession,
  Task,
  Training,
  TrainingResult,
  UserProfile,
} from '@/types';
import { startOfMonth, subMonths } from 'date-fns';

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inflightRequests = new Map<string, Promise<any>>();

const STORAGE_PREFIX = 'fs_ttl_cache_v1_';

function readPersistentEntry<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null;
    if (Date.now() - parsed.fetchedAt > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writePersistentEntry<T>(key: string, data: T): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${key}`,
      JSON.stringify({ data, fetchedAt: Date.now() })
    );
  } catch {
    // Ignore quota or storage restriction errors
  }
}

function removePersistentEntry(key: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // ignore
  }
}

async function cachedFetch<T>(
  key: string,
  maxAgeMs: number,
  fetcher: () => Promise<T>,
  options?: { forceRefresh?: boolean; persistLocal?: boolean }
): Promise<T> {
  const forceRefresh = !!options?.forceRefresh;
  const persistLocal = !!options?.persistLocal;

  if (!forceRefresh) {
    const mem = memoryCache.get(key);
    if (mem && Date.now() - mem.fetchedAt <= maxAgeMs) {
      return mem.data as T;
    }

    if (persistLocal) {
      const persisted = readPersistentEntry<T>(key, maxAgeMs);
      if (persisted !== null) {
        memoryCache.set(key, { data: persisted, fetchedAt: Date.now() });
        return persisted;
      }
    }
  }

  const existingInflight = inflightRequests.get(key);
  if (existingInflight && !forceRefresh) {
    return existingInflight as Promise<T>;
  }

  const req = fetcher()
    .then((data) => {
      memoryCache.set(key, { data, fetchedAt: Date.now() });
      if (persistLocal) {
        writePersistentEntry(key, data);
      }
      return data;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, req);
  return req;
}

export function invalidateCacheKey(prefix: string): void {
  for (const key of Array.from(memoryCache.keys())) {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      memoryCache.delete(key);
      removePersistentEntry(key);
    }
  }
}

export function invalidateAllFirestoreCaches(): void {
  memoryCache.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

// ============================================================
// Users & Praise Rankings
// ============================================================

export function invalidateUsersCache(): void {
  invalidateCacheKey('users');
  invalidateCacheKey('praise_kings');
  invalidateCacheKey('dashboard_admin_stats');
}

export async function getCachedUsers(
  forceRefresh = false,
  maxAgeMs = 10 * 60 * 1000
): Promise<UserProfile[]> {
  return cachedFetch(
    'users:all',
    maxAgeMs,
    async () => {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserProfile));
    },
    { forceRefresh }
  );
}

export async function getCachedActiveUsers(
  forceRefresh = false,
  maxAgeMs = 10 * 60 * 1000
): Promise<UserProfile[]> {
  const all = await getCachedUsers(forceRefresh, maxAgeMs);
  return all.filter((u) => u.isActive !== false && u.status !== 'RETIRED');
}

export async function getCachedMonthlyPraiseKings(
  currentMonth: string,
  topN = 5,
  forceRefresh = false,
  maxAgeMs = 5 * 60 * 1000
): Promise<UserProfile[]> {
  return cachedFetch(
    `praise_kings:${currentMonth}:${topN}`,
    maxAgeMs,
    async () => {
      // Single-field equality filter (no composite index needed) — reads ONLY users praised this month
      const q = query(collection(db, 'users'), where('kudosMonth', '==', currentMonth));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter((u) => u.isActive !== false && u.status !== 'RETIRED' && (u.monthlyKudosCount || 0) > 0)
        .sort((a, b) => {
          const bCount = b.monthlyKudosCount || 0;
          const aCount = a.monthlyKudosCount || 0;
          if (bCount !== aCount) return bCount - aCount;
          return (b.points || 0) - (a.points || 0);
        });
      return list.slice(0, topN);
    },
    { forceRefresh }
  );
}

// ============================================================
// Reference Collections (Departments, JobRoles, SpecialDates)
// ============================================================

export function invalidateDepartmentsCache(): void {
  invalidateCacheKey('departments');
}

export async function getCachedDepartments(
  forceRefresh = false,
  maxAgeMs = 15 * 60 * 1000
): Promise<Department[]> {
  return cachedFetch(
    'departments:all',
    maxAgeMs,
    async () => {
      const snap = await getDocs(query(collection(db, 'departments'), orderBy('name')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
    },
    { forceRefresh, persistLocal: true }
  );
}

export function invalidateJobRolesCache(): void {
  invalidateCacheKey('jobRoles');
}

export async function getCachedJobRoles(
  forceRefresh = false,
  maxAgeMs = 15 * 60 * 1000
): Promise<JobRole[]> {
  return cachedFetch(
    'jobRoles:all',
    maxAgeMs,
    async () => {
      const snap = await getDocs(query(collection(db, 'jobRoles'), orderBy('name')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobRole));
    },
    { forceRefresh, persistLocal: true }
  );
}

export function invalidateSpecialDatesCache(): void {
  invalidateCacheKey('specialDates');
}

export async function getCachedSpecialDates(
  forceRefresh = false,
  maxAgeMs = 30 * 60 * 1000
): Promise<Record<string, any>> {
  return cachedFetch(
    'specialDates:map',
    maxAgeMs,
    async () => {
      const snap = await getDocs(collection(db, 'specialDates'));
      const dates: Record<string, any> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.date) dates[data.date] = data;
      });
      return dates;
    },
    { forceRefresh, persistLocal: true }
  );
}

// ============================================================
// Factory 7 Calibration & JIGs (used by SilentFactoryGpsTracker)
// ============================================================

export function invalidateFactoryTrackingCache(): void {
  invalidateCacheKey('factory_tracking_config');
}

export async function getCachedFactoryJigsAndCalibration(
  calibrationDocId: string,
  defaultJigs: FactoryJig[],
  forceRefresh = false,
  maxAgeMs = 30 * 60 * 1000
): Promise<{ calibration: FactoryBoundaryCalibration | null; jigs: FactoryJig[] }> {
  return cachedFetch(
    `factory_tracking_config:${calibrationDocId}`,
    maxAgeMs,
    async () => {
      const [calSnap, jigsSnap] = await Promise.all([
        getDoc(doc(db, 'factoryCalibration', calibrationDocId)).catch(() => null),
        getDocs(collection(db, 'factoryJigs')).catch(() => null),
      ]);

      const calibration =
        calSnap && calSnap.exists()
          ? (calSnap.data() as FactoryBoundaryCalibration)
          : null;

      const jigs: FactoryJig[] =
        jigsSnap && !jigsSnap.empty
          ? jigsSnap.docs
              .map((d) => ({ ...d.data() } as FactoryJig))
              .sort((a, b) => a.jigNumber - b.jigNumber)
          : defaultJigs;

      return { calibration, jigs };
    },
    { forceRefresh, persistLocal: true }
  );
}

// ============================================================
// Dashboard & Content Previews (Notices, Accidents, Banner)
// ============================================================

export function invalidateNoticesCache(): void {
  invalidateCacheKey('notices');
}

export async function getCachedNoticesPreview(
  limitCount = 10,
  forceRefresh = false,
  maxAgeMs = 3 * 60 * 1000
): Promise<Notice[]> {
  return cachedFetch(
    `notices:latest:${limitCount}`,
    maxAgeMs,
    async () => {
      const q = query(
        collection(db, 'notices'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice));
    },
    { forceRefresh }
  );
}

export function invalidateAccidentsCache(): void {
  invalidateCacheKey('accidents');
}

export async function getCachedAccidentsPreview(
  limitCount = 5,
  forceRefresh = false,
  maxAgeMs = 5 * 60 * 1000
): Promise<AccidentCase[]> {
  return cachedFetch(
    `accidents:latest:${limitCount}`,
    maxAgeMs,
    async () => {
      const q = query(
        collection(db, 'accidentCases'),
        orderBy('date', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccidentCase));
    },
    { forceRefresh }
  );
}

export function invalidateBannerCache(): void {
  invalidateCacheKey('settings:banner');
}

export async function getCachedBanner(
  forceRefresh = false,
  maxAgeMs = 10 * 60 * 1000
): Promise<string> {
  return cachedFetch(
    'settings:banner',
    maxAgeMs,
    async () => {
      const snap = await getDoc(doc(db, 'settings', 'banner'));
      if (snap.exists()) {
        return snap.data()?.text || '안전한 하루가 되세요';
      }
      return '안전한 하루가 되세요';
    },
    { forceRefresh, persistLocal: true }
  );
}

// ============================================================
// Trainings & User-Specific Cached Reads
// ============================================================

export function invalidateTrainingsCache(): void {
  invalidateCacheKey('trainings');
  invalidateCacheKey('statutorySessions');
  invalidateCacheKey('trainingResults');
}

export async function getCachedPublishedTrainings(
  forceRefresh = false,
  maxAgeMs = 15 * 60 * 1000
): Promise<Training[]> {
  return cachedFetch(
    'trainings:published',
    maxAgeMs,
    async () => {
      const snap = await getDocs(
        query(collection(db, 'trainings'), where('status', '==', 'PUBLISHED'))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Training));
    },
    { forceRefresh }
  );
}

export async function getCachedAllTrainings(
  forceRefresh = false,
  maxAgeMs = 10 * 60 * 1000
): Promise<Training[]> {
  return cachedFetch(
    'trainings:all',
    maxAgeMs,
    async () => {
      const snap = await getDocs(collection(db, 'trainings'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Training));
    },
    { forceRefresh }
  );
}

export async function getCachedStatutorySessions(
  forceRefresh = false,
  maxAgeMs = 10 * 60 * 1000
): Promise<StatutorySession[]> {
  return cachedFetch(
    'statutorySessions:all',
    maxAgeMs,
    async () => {
      const snap = await getDocs(collection(db, 'statutorySessions'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StatutorySession));
    },
    { forceRefresh }
  );
}

export async function getCachedUserTrainingResults(
  uid: string,
  forceRefresh = false,
  maxAgeMs = 5 * 60 * 1000
): Promise<TrainingResult[]> {
  return cachedFetch(
    `trainingResults:user:${uid}`,
    maxAgeMs,
    async () => {
      const snap = await getDocs(
        query(collection(db, 'trainingResults'), where('uid', '==', uid))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingResult));
    },
    { forceRefresh }
  );
}

export function invalidateUserAttendanceCache(uid?: string): void {
  if (uid) {
    invalidateCacheKey(`attendance:user:${uid}`);
  } else {
    invalidateCacheKey('attendance');
  }
}

export async function getCachedUserAttendanceHistory(
  uid: string,
  limitCount = 45,
  forceRefresh = false,
  maxAgeMs = 3 * 60 * 1000
): Promise<Record<string, Attendance>> {
  return cachedFetch(
    `attendance:user:${uid}:${limitCount}`,
    maxAgeMs,
    async () => {
      const q = query(
        collection(db, 'attendance'),
        where('uid', '==', uid),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const map: Record<string, Attendance> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as Attendance;
        map[data.date] = { id: d.id, ...data };
      });
      return map;
    },
    { forceRefresh }
  );
}

const parseSafeDateForTrend = (raw: any): Date | null => {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw?.toDate === 'function') {
    const d = raw.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    const d = new Date(raw.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

export async function getCachedUserSafetyTrend(
  uid: string,
  forceRefresh = false,
  maxAgeMs = 10 * 60 * 1000
): Promise<number> {
  return cachedFetch(
    `safetyTrend:user:${uid}`,
    maxAgeMs,
    async () => {
      const q = query(
        collection(db, 'safetyScoreLogs'),
        where('targetUid', '==', uid),
        limit(100)
      );
      const snap = await getDocs(q);
      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const prevMonthStart = startOfMonth(subMonths(now, 1));

      let currentMonthDelta = 0;
      let prevMonthDelta = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        const logDate = parseSafeDateForTrend(data.createdAt);
        if (!logDate) return;
        if (logDate >= currentMonthStart) {
          currentMonthDelta += data.scoreDelta || 0;
        } else if (logDate >= prevMonthStart && logDate < currentMonthStart) {
          prevMonthDelta += data.scoreDelta || 0;
        }
      });

      return currentMonthDelta - prevMonthDelta;
    },
    { forceRefresh }
  );
}

export function invalidateUserTasksCache(uid?: string): void {
  if (uid) {
    invalidateCacheKey(`tasks:user:${uid}`);
  } else {
    invalidateCacheKey('tasks');
  }
}

export async function getCachedUserTasks(
  uid: string,
  limitCount = 5,
  forceRefresh = false,
  maxAgeMs = 2 * 60 * 1000
): Promise<Task[]> {
  return cachedFetch(
    `tasks:user:${uid}:${limitCount}`,
    maxAgeMs,
    async () => {
      const q = query(
        collection(db, 'tasks'),
        where('assignedToUid', '==', uid),
        where('status', 'in', ['TODO', 'IN_PROGRESS']),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
    },
    { forceRefresh }
  );
}

export async function getCachedDashboardAdminStats(
  today: string,
  forceRefresh = false,
  maxAgeMs = 2 * 60 * 1000
): Promise<{
  totalEmployees: number;
  presentToday: number;
  pendingLeaves: number;
  openAccidents: number;
}> {
  return cachedFetch(
    `dashboard_admin_stats:${today}`,
    maxAgeMs,
    async () => {
      const [usersCount, presentCount, pendingLeaveCount, accidents] = await Promise.all([
        getCountFromServer(collection(db, 'users'))
          .then((s) => s.data().count)
          .catch(() => getCachedUsers().then((list) => list.length)),
        getCountFromServer(
          query(collection(db, 'attendance'), where('date', '==', today))
        )
          .then((s) => s.data().count)
          .catch(async () => {
            const snap = await getDocs(
              query(collection(db, 'attendance'), where('date', '==', today))
            );
            return snap.size;
          }),
        getCountFromServer(
          query(collection(db, 'leaveRequests'), where('status', '==', 'PENDING'))
        )
          .then((s) => s.data().count)
          .catch(async () => {
            const snap = await getDocs(
              query(collection(db, 'leaveRequests'), where('status', '==', 'PENDING'))
            );
            return snap.size;
          }),
        getCachedAccidentsPreview(10, forceRefresh, 5 * 60 * 1000).then((a) => a.length),
      ]);

      return {
        totalEmployees: usersCount,
        presentToday: presentCount,
        pendingLeaves: pendingLeaveCount,
        openAccidents: accidents,
      };
    },
    { forceRefresh }
  );
}
