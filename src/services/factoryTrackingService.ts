import { collection, doc, getDocs, setDoc, addDoc, updateDoc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  FactoryJig, 
  FactoryGpsRecord, 
  WorkerDwellSummary, 
  TRACKING_TIME_SLOTS, 
  TrackingSlotTime,
  BlockDeploymentStats,
  BlockDelayLog
} from '../types';

// ========================================================
// 중형선 7공장 표준 좌표계 및 지그/블럭 기본 데이터
// A3 기준 가로 설계 (Aspect Ratio: 1414 x 1000)
// 방향: Left(←) = 동쪽, Right(→) = 서쪽, Top(↑) = 남쪽, Bottom(↓) = 북쪽
// ========================================================

export const FACTORY_BOUNDS = {
  width: 1414,
  height: 1000,
  name: '건명기업(주) 중형선 7공장',
  location: '울산조선소 중형선사업부 제7조립공장',
  // Reference GPS coordinates of Factory 7 (Shipyard area)
  centerLat: 35.5028,
  centerLng: 129.4185,
  latSpan: 0.0016, // Approx 180 meters
  lngSpan: 0.0025, // Approx 230 meters
};

export const DEFAULT_FACTORY_JIGS: FactoryJig[] = [
  // 남측 라인 (Bay A - South, 상단)
  {
    id: 'jig-01',
    jigNumber: 1,
    jigName: 'JIG-01',
    blockName: '2111 블럭',
    blockType: '선체 저판 이중저 대조립 블럭',
    assignedTeam: '외주물량1팀 (선체취부)',
    currentProgress: 68,
    startDate: '2026-11-03',
    endDate: '2026-11-12',
    targetDays: 10,
    x: 180,
    y: 160,
    width: 190,
    height: 220,
    bay: 'BAY_SOUTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-02',
    jigNumber: 2,
    jigName: 'JIG-02',
    blockName: '2112 블럭',
    blockType: '선체 중앙 수밀격벽 조립 블럭',
    assignedTeam: '외주물량1팀 (선체취부)',
    currentProgress: 82,
    startDate: '2026-11-01',
    endDate: '2026-11-10',
    targetDays: 10,
    x: 410,
    y: 160,
    width: 190,
    height: 220,
    bay: 'BAY_SOUTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-03',
    jigNumber: 3,
    jigName: 'JIG-03',
    blockName: '2121 블럭',
    blockType: '선체 우현 외판 및 곡가공 블럭',
    assignedTeam: '외주물량2팀 (외판특수)',
    currentProgress: 45,
    startDate: '2026-11-05',
    endDate: '2026-11-14',
    targetDays: 10,
    x: 640,
    y: 160,
    width: 190,
    height: 220,
    bay: 'BAY_SOUTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-04',
    jigNumber: 4,
    jigName: 'JIG-04',
    blockName: '2122 블럭',
    blockType: '선체 좌현 외판 및 프레임 조립',
    assignedTeam: '외주물량2팀 (외판특수)',
    currentProgress: 53,
    startDate: '2026-11-06',
    endDate: '2026-11-15',
    targetDays: 10,
    x: 870,
    y: 160,
    width: 190,
    height: 220,
    bay: 'BAY_SOUTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-05',
    jigNumber: 5,
    jigName: 'JIG-05',
    blockName: '2211 블럭',
    blockType: '기관실 엔진베드 하부 블럭',
    assignedTeam: '건명 직영취부팀',
    currentProgress: 91,
    startDate: '2026-10-28',
    endDate: '2026-11-08',
    targetDays: 12,
    x: 1100,
    y: 160,
    width: 190,
    height: 220,
    bay: 'BAY_SOUTH',
    status: 'ACTIVE'
  },

  // 북측 라인 (Bay B - North, 하단)
  {
    id: 'jig-06',
    jigNumber: 6,
    jigName: 'JIG-06',
    blockName: '2212 블럭',
    blockType: '연료유/평형수 탱크 격실 블럭',
    assignedTeam: '외주물량1팀 (용접반)',
    currentProgress: 60,
    startDate: '2026-11-04',
    endDate: '2026-11-13',
    targetDays: 10,
    x: 180,
    y: 610,
    width: 190,
    height: 220,
    bay: 'BAY_NORTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-07',
    jigNumber: 7,
    jigName: 'JIG-07',
    blockName: '2311 블럭',
    blockType: '선수 구상선수(Bulbous Bow) 블럭',
    assignedTeam: '외주물량3팀 (선수조립)',
    currentProgress: 38,
    startDate: '2026-11-08',
    endDate: '2026-11-17',
    targetDays: 10,
    x: 410,
    y: 610,
    width: 190,
    height: 220,
    bay: 'BAY_NORTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-08',
    jigNumber: 8,
    jigName: 'JIG-08',
    blockName: '2312 블럭',
    blockType: '선미 러더혼 & 프로펠러 보스 블럭',
    assignedTeam: '외주물량3팀 (선미조립)',
    currentProgress: 74,
    startDate: '2026-11-02',
    endDate: '2026-11-11',
    targetDays: 10,
    x: 640,
    y: 610,
    width: 190,
    height: 220,
    bay: 'BAY_NORTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-09',
    jigNumber: 9,
    jigName: 'JIG-09',
    blockName: '2411 블럭',
    blockType: '상부 카링 및 선행의장 복합 블럭',
    assignedTeam: '건명 직영의장팀',
    currentProgress: 88,
    startDate: '2026-11-01',
    endDate: '2026-11-10',
    targetDays: 10,
    x: 870,
    y: 610,
    width: 190,
    height: 220,
    bay: 'BAY_NORTH',
    status: 'ACTIVE'
  },
  {
    id: 'jig-10',
    jigNumber: 10,
    jigName: 'JIG-10',
    blockName: '2412 블럭',
    blockType: '선행도장 완료 및 탑재 대기 블럭',
    assignedTeam: '품질검사 및 출하반',
    currentProgress: 97,
    startDate: '2026-10-30',
    endDate: '2026-11-08',
    targetDays: 10,
    x: 1100,
    y: 610,
    width: 190,
    height: 220,
    bay: 'BAY_NORTH',
    status: 'ACTIVE'
  }
];

// Workshop Facilities zones on the A3 map
export const FACTORY_FACILITIES = [
  {
    id: 'rest_area',
    name: '물량팀 현장 휴게실 & 식수대',
    type: 'REST_AREA',
    x: 30,
    y: 40,
    width: 110,
    height: 100,
    color: '#0284c7'
  },
  {
    id: 'tool_room',
    name: '공구 및 용접기 자재실',
    type: 'MATERIAL_YARD',
    x: 30,
    y: 860,
    width: 110,
    height: 100,
    color: '#d97706'
  },
  {
    id: 'safety_office',
    name: '안전관리실 & 현장 화장실',
    type: 'RESTROOM',
    x: 1270,
    y: 40,
    width: 110,
    height: 100,
    color: '#059669'
  },
  {
    id: 'out_inspection',
    name: '완성 블럭 검사 및 반출 대기장',
    type: 'MATERIAL_YARD',
    x: 1270,
    y: 860,
    width: 110,
    height: 100,
    color: '#7c3aed'
  }
];

// Time slot interval weights in minutes
export const SLOT_MINUTES_MAP: Record<TrackingSlotTime, number> = {
  '08:20': 70, // 08:00 ~ 09:10 (작업 개시 및 조례)
  '09:45': 50, // 09:10 ~ 10:00 (오전 휴게 전 작업)
  '10:15': 60, // 10:15 ~ 11:15 (오전 휴게 직후 작업)
  '11:45': 45, // 11:15 ~ 12:00 (점심시간 직전)
  '13:10': 60, // 13:00 ~ 14:00 (오후 조업 재개)
  '14:45': 45, // 14:00 ~ 14:45 (오후 휴게 전)
  '15:15': 75, // 15:15 ~ 16:30 (오후 휴게 직후)
  '17:45': 75  // 16:30 ~ 17:45 (정규 마감 및 정리)
};

// Check if a point (mapX, mapY) falls inside a specific JIG
export const getJigAtCoordinate = (mapX: number, mapY: number, jigs: FactoryJig[] = DEFAULT_FACTORY_JIGS): FactoryJig | null => {
  return jigs.find(j => 
    mapX >= j.x - 15 && 
    mapX <= j.x + j.width + 15 && 
    mapY >= j.y - 15 && 
    mapY <= j.y + j.height + 15
  ) || null;
};

// Check if a point falls inside another facility
export const getFacilityAtCoordinate = (mapX: number, mapY: number) => {
  return FACTORY_FACILITIES.find(f => 
    mapX >= f.x && 
    mapX <= f.x + f.width && 
    mapY >= f.y && 
    mapY <= f.y + f.height
  ) || null;
};

// Identify location label and status from map coordinates
export const identifyLocationFromCoords = (
  mapX: number, 
  mapY: number, 
  assignedJigId: string, 
  jigs: FactoryJig[] = DEFAULT_FACTORY_JIGS
): {
  locationType: FactoryGpsRecord['locationType'];
  locationLabel: string;
  jigId?: string;
  jigName?: string;
  blockName?: string;
  isAtAssignedJig: boolean;
  status: FactoryGpsRecord['status'];
} => {
  // Check Jigs
  const jig = getJigAtCoordinate(mapX, mapY, jigs);
  if (jig) {
    const isAssigned = jig.id === assignedJigId;
    return {
      locationType: 'JIG',
      locationLabel: `${jig.jigName} (${jig.blockName})`,
      jigId: jig.id,
      jigName: jig.jigName,
      blockName: jig.blockName,
      isAtAssignedJig: isAssigned,
      status: isAssigned ? 'NORMAL' : 'AWAY'
    };
  }

  // Check Facilities
  const facility = getFacilityAtCoordinate(mapX, mapY);
  if (facility) {
    return {
      locationType: facility.type as any,
      locationLabel: facility.name,
      isAtAssignedJig: false,
      status: facility.type === 'REST_AREA' ? 'RESTING' : 'AWAY'
    };
  }

  // Central highway or walkways
  if (mapY >= 440 && mapY <= 560) {
    return {
      locationType: 'OUT_OF_BOUNDS',
      locationLabel: '중앙 크레인 주통로 (이동 중)',
      isAtAssignedJig: false,
      status: 'AWAY'
    };
  }

  // Out of bounds
  return {
    locationType: 'OUT_OF_BOUNDS',
    locationLabel: '공장 구역 이탈 (자리비움)',
    isAtAssignedJig: false,
    status: 'AWAY'
  };
};

// Convert minutes to human readable Korean string (e.g. 5시간 30분)
export const formatMinutesToKorean = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
};

// Compute total dwell and compliance summary for a worker across the 8 slots
export const computeWorkerDwellSummary = (
  workerUid: string,
  workerName: string,
  employeeId: string,
  teamName: string,
  jobRole: string,
  assignedJigId: string,
  date: string,
  records: FactoryGpsRecord[],
  jigs: FactoryJig[] = DEFAULT_FACTORY_JIGS
): WorkerDwellSummary => {
  const assignedJig = jigs.find(j => j.id === assignedJigId) || jigs[0];
  const assignedBlockName = assignedJig ? assignedJig.blockName : '2111 블럭';

  const dwellMap: Record<string, { minutes: number; isWork: boolean }> = {};
  let totalShiftMinutes = 0;
  let workBlockDwellMinutes = 0;
  let restAreaMinutes = 0;
  let awayMinutes = 0;

  // Sort records by slot order
  const sorted = [...records].sort((a, b) => a.slotIndex - b.slotIndex);

  sorted.forEach(r => {
    const slotMin = SLOT_MINUTES_MAP[r.slot] || 60;
    totalShiftMinutes += slotMin;

    const key = r.blockName || r.locationLabel;
    const isWork = Boolean(r.blockName && r.isAtAssignedJig);

    if (!dwellMap[key]) {
      dwellMap[key] = { minutes: 0, isWork: Boolean(r.blockName) };
    }
    dwellMap[key].minutes += slotMin;

    if (r.isAtAssignedJig) {
      workBlockDwellMinutes += slotMin;
    } else if (r.locationType === 'REST_AREA' || r.locationType === 'RESTROOM') {
      restAreaMinutes += slotMin;
    } else {
      awayMinutes += slotMin;
    }
  });

  const expectedWorkMinutes = 420; // 7 hours standard target
  const complianceRate = totalShiftMinutes > 0 
    ? Math.min(100, Math.round((workBlockDwellMinutes / expectedWorkMinutes) * 100))
    : 0;

  let verdict: WorkerDwellSummary['verdict'] = 'NORMAL';
  if (complianceRate >= 85) verdict = 'EXCELLENT';
  else if (complianceRate >= 65) verdict = 'NORMAL';
  else if (complianceRate >= 45) verdict = 'WARNING';
  else verdict = 'CRITICAL_AWAY';

  const dwellDetails = Object.entries(dwellMap).map(([blockOrArea, val]) => ({
    blockOrArea,
    minutes: val.minutes,
    percentage: totalShiftMinutes > 0 ? Math.round((val.minutes / totalShiftMinutes) * 100) : 0,
    isWorkBlock: val.isWork
  })).sort((a, b) => b.minutes - a.minutes);

  const slotRecords = sorted.map(r => ({
    slot: r.slot,
    timeLabel: r.slot,
    locationLabel: r.locationLabel,
    blockName: r.blockName,
    status: r.status as 'NORMAL' | 'AWAY' | 'RESTING',
    mapX: r.mapX,
    mapY: r.mapY
  }));

  return {
    id: `${workerUid}_${date}`,
    date,
    workerUid,
    workerName,
    employeeId,
    teamName,
    jobRole,
    assignedJigId,
    assignedBlockName,
    totalShiftMinutes,
    workBlockDwellMinutes,
    restAreaMinutes,
    awayMinutes,
    complianceRate,
    dwellDetails,
    slotRecords,
    verdict,
    updatedAt: new Date().toISOString()
  };
};

// ========================================================
// Firestore Operations
// ========================================================

// Fetch current active JIG configuration
export const fetchFactoryJigs = async (): Promise<FactoryJig[]> => {
  try {
    const snap = await getDocs(collection(db, 'factoryJigs'));
    if (snap.empty) {
      // Initialize with default 10 JIGs
      for (const jig of DEFAULT_FACTORY_JIGS) {
        await setDoc(doc(db, 'factoryJigs', jig.id), jig);
      }
      return DEFAULT_FACTORY_JIGS;
    }
    const data = snap.docs.map(d => ({ ...d.data() } as FactoryJig));
    return data.sort((a, b) => a.jigNumber - b.jigNumber);
  } catch (err) {
    console.error('Error fetching factory jigs:', err);
    return DEFAULT_FACTORY_JIGS;
  }
};

// Update a JIG block name or assignment
export const updateFactoryJig = async (jigId: string, updates: Partial<FactoryJig>): Promise<void> => {
  try {
    await setDoc(doc(db, 'factoryJigs', jigId), updates, { merge: true });
  } catch (err) {
    console.error('Error updating jig:', err);
    handleFirestoreError(err, OperationType.UPDATE, `factoryJigs/${jigId}`);
    throw err;
  }
};

// Fetch GPS logs for a specific date and optional slot
export const fetchGpsRecordsByDate = async (
  date: string, 
  slot?: TrackingSlotTime
): Promise<FactoryGpsRecord[]> => {
  try {
    let q = query(
      collection(db, 'factoryGpsRecords'),
      where('date', '==', date)
    );
    if (slot) {
      q = query(
        collection(db, 'factoryGpsRecords'),
        where('date', '==', date),
        where('slot', '==', slot)
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FactoryGpsRecord));
  } catch (err) {
    console.error('Error fetching GPS records:', err);
    return [];
  }
};

// Fetch dwell summaries for a specific date
export const fetchDwellSummariesByDate = async (date: string): Promise<WorkerDwellSummary[]> => {
  try {
    const q = query(
      collection(db, 'workerDwellSummaries'),
      where('date', '==', date)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkerDwellSummary));
  } catch (err) {
    console.error('Error fetching dwell summaries:', err);
    return [];
  }
};

// Seed realistic simulation data for demonstration & testing
export const seedRealisticTrackingData = async (targetDate: string): Promise<{ recordsCount: number; workersCount: number }> => {
  const jigs = DEFAULT_FACTORY_JIGS;
  
  // Sample piecework (물량팀) and regular workers
  const sampleWorkers = [
    { uid: 'worker_01', name: '성재윤', empId: 'X201802', team: '외주물량1팀 (선체취부)', role: '취부사', assignedJig: 'jig-01', compliance: 0.95 },
    { uid: 'worker_02', name: '김덕수', empId: 'X270710', team: '외주물량1팀 (선체취부)', role: '취부사', assignedJig: 'jig-01', compliance: 0.90 },
    { uid: 'worker_03', name: '김명종', empId: 'X224154', team: '외주물량1팀 (용접반)', role: '용접사', assignedJig: 'jig-02', compliance: 0.85 },
    { uid: 'worker_04', name: '박태준', empId: 'X240911', team: '외주물량1팀 (용접반)', role: '용접사', assignedJig: 'jig-02', compliance: 0.40 }, // 슬래커 (일을 안하고 자리 비움)
    { uid: 'worker_05', name: '최현수', empId: 'X210433', team: '외주물량2팀 (외판특수)', role: '취부사', assignedJig: 'jig-03', compliance: 0.88 },
    { uid: 'worker_06', name: '정기선', empId: 'X230899', team: '외주물량2팀 (외판특수)', role: '취부보조', assignedJig: 'jig-03', compliance: 0.50 }, // 잦은 자리이탈
    { uid: 'worker_07', name: '고영태', empId: 'X220114', team: '외주물량2팀 (외판특수)', role: '용접사', assignedJig: 'jig-04', compliance: 0.92 },
    { uid: 'worker_08', name: '안미정', empId: 'X250622', team: '건명 직영취부팀', role: '취부반장', assignedJig: 'jig-05', compliance: 0.98 },
    { uid: 'worker_09', name: '황선우', empId: 'X240188', team: '외주물량3팀 (선수조립)', role: '용접사', assignedJig: 'jig-07', compliance: 0.35 }, // 심각한 미체류
    { uid: 'worker_10', name: '도강석', empId: 'X210955', team: '외주물량3팀 (선미조립)', role: '취부사', assignedJig: 'jig-08', compliance: 0.90 },
    { uid: 'worker_11', name: '조수명', empId: 'X230412', team: '건명 직영의장팀', role: '의장사', assignedJig: 'jig-09', compliance: 0.94 },
    { uid: 'worker_12', name: '문서주', empId: 'x66626', team: '외주물량1팀 (선체취부)', role: '취부기장', assignedJig: 'jig-01', compliance: 0.96 }
  ];

  let totalRecordsCreated = 0;

  for (const worker of sampleWorkers) {
    const assignedJig = jigs.find(j => j.id === worker.assignedJig) || jigs[0];
    const workerRecords: FactoryGpsRecord[] = [];

    TRACKING_TIME_SLOTS.forEach((slot, sIdx) => {
      // Determine if worker is present at their assigned JIG for this slot
      // based on compliance profile and shift breaks
      let mapX: number;
      let mapY: number;

      const isBreakSlot = slot === '09:45' || slot === '14:45';
      const isRandomAway = Math.random() > worker.compliance;

      if (isRandomAway) {
        // Roaming away or at rest area
        if (Math.random() > 0.4) {
          // At rest area or restroom
          const fac = FACTORY_FACILITIES[0]; // Rest area
          mapX = fac.x + 20 + Math.random() * 60;
          mapY = fac.y + 20 + Math.random() * 60;
        } else {
          // Wandering in central aisle or out of bounds
          mapX = 500 + Math.random() * 400;
          mapY = 480 + Math.random() * 60; // Central crane aisle
        }
      } else {
        // Reliably working on their designated JIG!
        // Random jitter inside the JIG box
        mapX = assignedJig.x + 20 + Math.random() * (assignedJig.width - 40);
        mapY = assignedJig.y + 20 + Math.random() * (assignedJig.height - 40);
      }

      const locInfo = identifyLocationFromCoords(mapX, mapY, worker.assignedJig, jigs);
      const recordId = `${worker.uid}_${targetDate}_${sIdx}`;

      const record: FactoryGpsRecord = {
        id: recordId,
        date: targetDate,
        slot,
        slotIndex: sIdx,
        workerUid: worker.uid,
        workerName: worker.name,
        employeeId: worker.empId,
        teamName: worker.team,
        jobRole: worker.role,
        latitude: FACTORY_BOUNDS.centerLat + (Math.random() - 0.5) * 0.0005,
        longitude: FACTORY_BOUNDS.centerLng + (Math.random() - 0.5) * 0.0005,
        accuracy: 3.5,
        mapX: Math.round(mapX),
        mapY: Math.round(mapY),
        locationType: locInfo.locationType,
        jigId: locInfo.jigId,
        jigName: locInfo.jigName,
        blockName: locInfo.blockName,
        locationLabel: locInfo.locationLabel,
        isAtAssignedJig: locInfo.isAtAssignedJig,
        status: locInfo.status,
        stayMinutesInSlot: SLOT_MINUTES_MAP[slot],
        recordedAt: `${targetDate}T${slot}:00.000Z`
      };

      workerRecords.push(record);
    });

    // Save individual GPS records to Firestore
    for (const r of workerRecords) {
      await setDoc(doc(db, 'factoryGpsRecords', r.id), r, { merge: true });
      totalRecordsCreated++;
    }

    // Compute and save daily dwell summary
    const summary = computeWorkerDwellSummary(
      worker.uid,
      worker.name,
      worker.empId,
      worker.team,
      worker.role,
      worker.assignedJig,
      targetDate,
      workerRecords,
      jigs
    );

    await setDoc(doc(db, 'workerDwellSummaries', summary.id), summary, { merge: true });
  }

  return { recordsCount: totalRecordsCreated, workersCount: sampleWorkers.length };
};

// ========================================================
// Compute Block Deployment Statistics for N-Day Construction Blocks
// ========================================================

export const computeSingleBlockStats = (jig: FactoryJig, allRecords: FactoryGpsRecord[]): BlockDeploymentStats => {
  const startDateStr = jig.startDate || '2026-11-03';
  const endDateStr = jig.endDate || '2026-11-12';

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.max(1, Math.abs(end.getTime() - start.getTime()));
  const targetDays = jig.targetDays || Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  // Elapsed days from start
  let elapsedDays = 1;
  if (todayStr >= startDateStr) {
    const elapsedDiff = Math.abs(new Date(todayStr).getTime() - start.getTime());
    elapsedDays = Math.min(targetDays, Math.ceil(elapsedDiff / (1000 * 60 * 60 * 24)) + 1);
  }

  // Remaining days (D-Day)
  const remainingDiff = new Date(endDateStr).getTime() - new Date(todayStr).getTime();
  const remainingDays = Math.ceil(remainingDiff / (1000 * 60 * 60 * 24));

  // Filter records belonging to this jig
  const jigRecords = allRecords.filter(r => r.jigId === jig.id || (r.blockName && r.blockName.includes(jig.blockName)));

  // Unique workers count deployed to this block
  const uniqueWorkerSet = new Set<string>();
  let totalMinutes = 0;

  jigRecords.forEach(r => {
    if (r.workerUid) uniqueWorkerSet.add(r.workerUid);
    totalMinutes += (r.stayMinutesInSlot || 60);
  });

  const totalWorkersDeployed = uniqueWorkerSet.size;
  const totalManHours = Math.round((totalMinutes / 60) * 10) / 10;
  const avgDailyWorkers = Math.round((totalWorkersDeployed / Math.max(1, elapsedDays)) * 10) / 10;

  const currentProgress = jig.currentProgress || 0;
  const expectedProgress = Math.min(100, Math.round((elapsedDays / targetDays) * 100));

  let statusVerdict: BlockDeploymentStats['statusVerdict'] = 'ON_SCHEDULE';
  if (currentProgress >= 100 || jig.status === 'COMPLETED') {
    statusVerdict = 'COMPLETED';
  } else if (expectedProgress - currentProgress > 25 || remainingDays < -1) {
    statusVerdict = 'CRITICAL_DELAY';
  } else if (expectedProgress - currentProgress > 10 || remainingDays <= 0) {
    statusVerdict = 'BEHIND_SCHEDULE';
  } else {
    statusVerdict = 'ON_SCHEDULE';
  }

  return {
    jigId: jig.id,
    jigName: jig.jigName,
    blockName: jig.blockName,
    blockType: jig.blockType,
    assignedTeam: jig.assignedTeam,
    startDate: startDateStr,
    endDate: endDateStr,
    targetDays,
    elapsedDays,
    remainingDays,
    totalWorkersDeployed,
    totalManHours,
    avgDailyWorkers,
    currentProgress,
    statusVerdict
  };
};

export const computeAllBlockStats = (jigs: FactoryJig[], records: FactoryGpsRecord[]): BlockDeploymentStats[] => {
  return jigs.map(j => computeSingleBlockStats(j, records));
};

// ========================================================
// Critical Delay Reasons Cumulative Logging (CEO Exclusive)
// ========================================================

export const fetchDelayLogs = async (jigId?: string): Promise<BlockDelayLog[]> => {
  try {
    const q = jigId
      ? query(collection(db, 'factoryDelayLogs'), where('jigId', '==', jigId))
      : query(collection(db, 'factoryDelayLogs'));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlockDelayLog));
    // Sort newest first so chronological history continues seamlessly
    return list.sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''));
  } catch (err) {
    console.error('Error fetching factory delay logs:', err);
    return [];
  }
};

export const addDelayLog = async (
  input: Omit<BlockDelayLog, 'id' | 'recordedAt'>,
  currentLogCount = 0
): Promise<BlockDelayLog> => {
  const recordedAt = new Date().toISOString();
  try {
    const payload = {
      ...input,
      recordedAt,
      resolved: false
    };
    const docRef = await addDoc(collection(db, 'factoryDelayLogs'), payload);
    const created: BlockDelayLog = {
      id: docRef.id,
      ...payload
    };

    // Keep latest delay reason synced on the JIG document for instant visibility on blueprint & cards
    await setDoc(
      doc(db, 'factoryJigs', input.jigId),
      {
        latestDelayReason: input.reason,
        latestDelayAt: recordedAt,
        latestDelaySeverity: input.severity,
        delayLogCount: currentLogCount + 1
      },
      { merge: true }
    );

    return created;
  } catch (err) {
    console.error('Error adding factory delay log:', err);
    handleFirestoreError(err, OperationType.WRITE, 'factoryDelayLogs');
    throw err;
  }
};

export const resolveDelayLog = async (logId: string, resolvedNote: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'factoryDelayLogs', logId), {
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedNote: resolvedNote.trim()
    });
  } catch (err) {
    console.error('Error resolving delay log:', err);
    handleFirestoreError(err, OperationType.UPDATE, `factoryDelayLogs/${logId}`);
    throw err;
  }
};
