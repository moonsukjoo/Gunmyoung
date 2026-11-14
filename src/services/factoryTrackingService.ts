import { collection, doc, getDocs, setDoc, addDoc, updateDoc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  FactoryJig, 
  FactoryGpsRecord, 
  WorkerDwellSummary, 
  TRACKING_TIME_SLOTS, 
  TrackingSlotTime,
  BlockDeploymentStats,
  BlockDelayLog,
  CardinalGpsPoint,
  FactoryBoundaryCalibration
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
  const [fetchedJigs, fetchedCalibration] = await Promise.all([
    fetchFactoryJigs(),
    fetchFactoryCalibration()
  ]);
  const jigs = reconcileJigsWithCalibration(
    fetchedJigs.length > 0 ? fetchedJigs : DEFAULT_FACTORY_JIGS,
    fetchedCalibration
  );
  const basis = fetchedCalibration ? computeCalibrationBasis(fetchedCalibration) : null;
  
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
      const gpsCoord = basis
        ? blueprintToGps(mapX, mapY, basis)
        : {
            lat: Number((FACTORY_BOUNDS.centerLat + ((mapY - 500) / 1000) * FACTORY_BOUNDS.latSpan).toFixed(7)),
            lng: Number((FACTORY_BOUNDS.centerLng - ((mapX - 707) / 1414) * FACTORY_BOUNDS.lngSpan).toFixed(7))
          };

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
        latitude: gpsCoord.lat,
        longitude: gpsCoord.lng,
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

// ========================================================
// 2시간 단위 작업 구역별 체류 시간 히트맵 집계 유틸리티
// ========================================================

export type HeatmapAggregationMode = '2H_WINDOW' | 'SINGLE_SLOT' | 'FULL_DAY';

export interface TwoHourWindowDef {
  id: string;
  label: string;
  shortLabel: string;
  slots: TrackingSlotTime[];
}

export const TWO_HOUR_WINDOWS: TwoHourWindowDef[] = [
  { id: 'W1', label: '오전 1부 (08:00~10:00)', shortLabel: '08~10시', slots: ['08:20', '09:45'] },
  { id: 'W2', label: '오전 2부 (10:00~12:00)', shortLabel: '10~12시', slots: ['10:15', '11:45'] },
  { id: 'W3', label: '오후 1부 (13:00~15:00)', shortLabel: '13~15시', slots: ['13:10', '14:45'] },
  { id: 'W4', label: '오후 2부 (15:00~18:00)', shortLabel: '15~18시', slots: ['15:15', '17:45'] }
];

export const getWindowForSlot = (slot: TrackingSlotTime): TwoHourWindowDef => {
  return TWO_HOUR_WINDOWS.find(w => w.slots.includes(slot)) || TWO_HOUR_WINDOWS[0];
};

export type HeatmapLevel = 'IDLE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PEAK';

export interface ZoneDwellMetric {
  zoneId: string;
  zoneName: string;
  subLabel: string;
  zoneType: 'JIG' | 'REST_AREA' | 'FACILITY' | 'AISLE';
  x: number;
  y: number;
  width: number;
  height: number;
  totalMinutes: number;
  normalMinutes: number;
  awayOrRestMinutes: number;
  workerCount: number;
  workerNames: string[];
  intensity: number; // 0.0 ~ 1.0 relative to highest zone
  sharePercent: number; // % of total dwell across all zones in this window
  level: HeatmapLevel;
  levelLabel: string;
}

export interface HeatmapComputationResult {
  windowLabel: string;
  filteredRecords: FactoryGpsRecord[];
  zones: ZoneDwellMetric[];
  zoneMap: Record<string, ZoneDwellMetric>;
  totalDwellMinutes: number;
  totalUniqueWorkers: number;
  nonWorkDwellMinutes: number;
  topZone: ZoneDwellMetric | null;
}

export const getHeatmapColors = (level: HeatmapLevel): {
  hex: string;
  glowRgba: string;
  tintBg: string;
  border: string;
  textClass: string;
  barClass: string;
} => {
  switch (level) {
    case 'PEAK':
      return {
        hex: '#ef4444',
        glowRgba: 'rgba(239, 68, 68, 0.55)',
        tintBg: 'rgba(239, 68, 68, 0.24)',
        border: '#f87171',
        textClass: 'text-rose-400',
        barClass: 'bg-rose-500'
      };
    case 'HIGH':
      return {
        hex: '#f97316',
        glowRgba: 'rgba(249, 115, 22, 0.48)',
        tintBg: 'rgba(249, 115, 22, 0.20)',
        border: '#fb923c',
        textClass: 'text-orange-400',
        barClass: 'bg-orange-500'
      };
    case 'MEDIUM':
      return {
        hex: '#f59e0b',
        glowRgba: 'rgba(245, 158, 11, 0.40)',
        tintBg: 'rgba(245, 158, 11, 0.16)',
        border: '#fbbf24',
        textClass: 'text-amber-400',
        barClass: 'bg-amber-500'
      };
    case 'LOW':
      return {
        hex: '#06b6d4',
        glowRgba: 'rgba(6, 182, 212, 0.34)',
        tintBg: 'rgba(6, 182, 212, 0.12)',
        border: '#22d3ee',
        textClass: 'text-cyan-400',
        barClass: 'bg-cyan-500'
      };
    default:
      return {
        hex: '#334155',
        glowRgba: 'rgba(51, 65, 85, 0.0)',
        tintBg: 'rgba(15, 23, 42, 0.0)',
        border: '#334155',
        textClass: 'text-slate-500',
        barClass: 'bg-slate-600'
      };
  }
};

export const computeZoneDwellHeatmap = (
  jigs: FactoryJig[],
  records: FactoryGpsRecord[],
  mode: HeatmapAggregationMode,
  selectedSlot: TrackingSlotTime,
  activeWindowId?: string
): HeatmapComputationResult => {
  const activeWindow =
    (activeWindowId ? TWO_HOUR_WINDOWS.find(w => w.id === activeWindowId) : undefined) ||
    getWindowForSlot(selectedSlot);

  let filteredRecords: FactoryGpsRecord[] = [];
  let windowLabel = '';

  if (mode === 'SINGLE_SLOT') {
    filteredRecords = records.filter(r => r.slot === selectedSlot);
    windowLabel = `선택 시점 (${selectedSlot})`;
  } else if (mode === '2H_WINDOW') {
    filteredRecords = records.filter(r => activeWindow.slots.includes(r.slot));
    windowLabel = activeWindow.label;
  } else {
    filteredRecords = records;
    windowLabel = '당일 전체 누적 (08:20~17:45)';
  }

  // Build base zone buckets for all JIGs + non-work facilities + central crane aisle
  interface ZoneAccumulator {
    zoneId: string;
    zoneName: string;
    subLabel: string;
    zoneType: ZoneDwellMetric['zoneType'];
    x: number;
    y: number;
    width: number;
    height: number;
    totalMinutes: number;
    normalMinutes: number;
    awayOrRestMinutes: number;
    workerUids: Set<string>;
    workerNames: Set<string>;
  }

  const buckets: Record<string, ZoneAccumulator> = {};

  jigs.forEach(j => {
    buckets[j.id] = {
      zoneId: j.id,
      zoneName: j.jigName,
      subLabel: j.blockName,
      zoneType: 'JIG',
      x: j.x,
      y: j.y,
      width: j.width,
      height: j.height,
      totalMinutes: 0,
      normalMinutes: 0,
      awayOrRestMinutes: 0,
      workerUids: new Set(),
      workerNames: new Set()
    };
  });

  FACTORY_FACILITIES.forEach(fac => {
    buckets[fac.id] = {
      zoneId: fac.id,
      zoneName: fac.name.split(' ')[0],
      subLabel: fac.name,
      zoneType: fac.type === 'REST_AREA' ? 'REST_AREA' : 'FACILITY',
      x: fac.x,
      y: fac.y,
      width: fac.width,
      height: fac.height,
      totalMinutes: 0,
      normalMinutes: 0,
      awayOrRestMinutes: 0,
      workerUids: new Set(),
      workerNames: new Set()
    };
  });

  buckets['central_aisle'] = {
    zoneId: 'central_aisle',
    zoneName: '중앙 크레인 통로',
    subLabel: '통로 배회/이탈 구역',
    zoneType: 'AISLE',
    x: 50,
    y: 430,
    width: 1314,
    height: 140,
    totalMinutes: 0,
    normalMinutes: 0,
    awayOrRestMinutes: 0,
    workerUids: new Set(),
    workerNames: new Set()
  };

  let totalDwellMinutes = 0;
  let nonWorkDwellMinutes = 0;
  const globalWorkerSet = new Set<string>();

  filteredRecords.forEach(r => {
    const mins = r.stayMinutesInSlot || SLOT_MINUTES_MAP[r.slot] || 60;
    totalDwellMinutes += mins;
    if (r.workerUid) globalWorkerSet.add(r.workerUid);

    let targetKey: string | null = null;
    if (r.jigId && buckets[r.jigId]) {
      targetKey = r.jigId;
    } else {
      const matchedFac = getFacilityAtCoordinate(r.mapX, r.mapY);
      if (matchedFac && buckets[matchedFac.id]) {
        targetKey = matchedFac.id;
      } else if (r.locationType === 'REST_AREA') {
        targetKey = 'rest_area';
      } else if (r.locationType === 'RESTROOM') {
        targetKey = 'safety_office';
      } else {
        targetKey = 'central_aisle';
      }
    }

    const bucket = targetKey ? buckets[targetKey] : null;
    if (bucket) {
      bucket.totalMinutes += mins;
      if (r.status === 'NORMAL' && bucket.zoneType === 'JIG') {
        bucket.normalMinutes += mins;
      } else {
        bucket.awayOrRestMinutes += mins;
        nonWorkDwellMinutes += mins;
      }
      if (r.workerUid) bucket.workerUids.add(r.workerUid);
      if (r.workerName) bucket.workerNames.add(r.workerName);
    }
  });

  const maxMinutes = Math.max(
    60,
    ...Object.values(buckets).map(b => b.totalMinutes)
  );

  const zones: ZoneDwellMetric[] = Object.values(buckets)
    .map(b => {
      const intensity = b.totalMinutes > 0 ? Math.min(1, b.totalMinutes / maxMinutes) : 0;
      const sharePercent = totalDwellMinutes > 0 ? Math.round((b.totalMinutes / totalDwellMinutes) * 100) : 0;

      let level: HeatmapLevel = 'IDLE';
      let levelLabel = '미투입';
      if (b.totalMinutes > 0) {
        if (intensity >= 0.8) {
          level = 'PEAK';
          levelLabel = '최고 집중';
        } else if (intensity >= 0.55) {
          level = 'HIGH';
          levelLabel = '고밀도 집중';
        } else if (intensity >= 0.3) {
          level = 'MEDIUM';
          levelLabel = '보통 체류';
        } else {
          level = 'LOW';
          levelLabel = '저밀도';
        }
      }

      return {
        zoneId: b.zoneId,
        zoneName: b.zoneName,
        subLabel: b.subLabel,
        zoneType: b.zoneType,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        totalMinutes: b.totalMinutes,
        normalMinutes: b.normalMinutes,
        awayOrRestMinutes: b.awayOrRestMinutes,
        workerCount: b.workerUids.size,
        workerNames: Array.from(b.workerNames),
        intensity,
        sharePercent,
        level,
        levelLabel
      };
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const zoneMap: Record<string, ZoneDwellMetric> = {};
  zones.forEach(z => {
    zoneMap[z.zoneId] = z;
  });

  const activeZones = zones.filter(z => z.totalMinutes > 0);
  const topZone = activeZones.length > 0 ? activeZones[0] : null;

  return {
    windowLabel,
    filteredRecords,
    zones,
    zoneMap,
    totalDwellMinutes,
    totalUniqueWorkers: globalWorkerSet.size,
    nonWorkDwellMinutes,
    topZone
  };
};

// ========================================================
// 7공장 동·서·남·북 실측 길이 및 GPS 기준점 캘리브레이션 엔진
// A3 도면 좌표계 (1414 x 1000):
//   ← 동쪽(EAST): x = 20, y = 500  (u = -1, v = 0)
//   → 서쪽(WEST): x = 1394, y = 500 (u = +1, v = 0)
//   ↑ 남쪽(SOUTH): x = 707, y = 20  (u = 0, v = -1)
//   ↓ 북쪽(NORTH): x = 707, y = 980 (u = 0, v = +1)
// ========================================================

export const FACTORY_CALIBRATION_DOC_ID = 'factory-07';

export const DEFAULT_FACTORY_CALIBRATION: FactoryBoundaryCalibration = {
  id: FACTORY_CALIBRATION_DOC_ID,
  eastWestLengthMeters: 230,
  northSouthLengthMeters: 180,
  east: null,
  west: null,
  south: null,
  north: null,
  updatedAt: ''
};

const BP_X_MIN = 20;
const BP_X_MAX = 1394;
const BP_Y_MIN = 20;
const BP_Y_MAX = 980;
const BP_CENTER_X = (BP_X_MIN + BP_X_MAX) / 2; // 707
const BP_CENTER_Y = (BP_Y_MIN + BP_Y_MAX) / 2; // 500
const BP_HALF_W = (BP_X_MAX - BP_X_MIN) / 2;   // 687
const BP_HALF_H = (BP_Y_MAX - BP_Y_MIN) / 2;   // 480

const METERS_PER_DEG_LAT = 110946.0;

export interface CalibrationBasis {
  refLat: number;
  refLng: number;
  metersPerDegLat: number;
  metersPerDegLng: number;
  centerX: number;
  centerY: number;
  centerLat: number;
  centerLng: number;
  hu: { x: number; y: number }; // East->West half-axis vector in local meters
  hv: { x: number; y: number }; // South->North half-axis vector in local meters
  eastWestLengthMeters: number;
  northSouthLengthMeters: number;
  rotationDeg: number;
  gpsMeasuredEW?: number;
  gpsMeasuredNS?: number;
  capturedCount: number;
}

const isValidGpsPoint = (pt?: CardinalGpsPoint | null): pt is CardinalGpsPoint => {
  return Boolean(
    pt &&
    typeof pt.lat === 'number' &&
    typeof pt.lng === 'number' &&
    Number.isFinite(pt.lat) &&
    Number.isFinite(pt.lng) &&
    Math.abs(pt.lat) > 1 &&
    Math.abs(pt.lng) > 1
  );
};

export const computeHaversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

export const computeCalibrationBasis = (cal: FactoryBoundaryCalibration): CalibrationBasis | null => {
  const anchors: Array<{
    key: 'east' | 'west' | 'south' | 'north';
    pt: CardinalGpsPoint;
    u: number;
    v: number;
  }> = [];

  if (isValidGpsPoint(cal.east)) anchors.push({ key: 'east', pt: cal.east, u: -1, v: 0 });
  if (isValidGpsPoint(cal.west)) anchors.push({ key: 'west', pt: cal.west, u: 1, v: 0 });
  if (isValidGpsPoint(cal.south)) anchors.push({ key: 'south', pt: cal.south, u: 0, v: -1 });
  if (isValidGpsPoint(cal.north)) anchors.push({ key: 'north', pt: cal.north, u: 0, v: 1 });

  if (anchors.length === 0) return null;

  const refLat = anchors.reduce((acc, a) => acc + a.pt.lat, 0) / anchors.length;
  const refLng = anchors.reduce((acc, a) => acc + a.pt.lng, 0) / anchors.length;
  const metersPerDegLng = 111320.0 * Math.cos((refLat * Math.PI) / 180);

  const toMeters = (pt: CardinalGpsPoint) => ({
    x: (pt.lng - refLng) * metersPerDegLng,
    y: (pt.lat - refLat) * METERS_PER_DEG_LAT
  });

  const eastWestLengthMeters = Math.max(10, Number(cal.eastWestLengthMeters) || 230);
  const northSouthLengthMeters = Math.max(10, Number(cal.northSouthLengthMeters) || 180);
  const halfEW = eastWestLengthMeters / 2;
  const halfNS = northSouthLengthMeters / 2;

  const normalizeVec = (vx: number, vy: number): { x: number; y: number } | null => {
    const len = Math.hypot(vx, vy);
    if (len < 1.0) return null;
    return { x: vx / len, y: vy / len };
  };

  let eu: { x: number; y: number } | null = null;
  let ev: { x: number; y: number } | null = null;
  let gpsMeasuredEW: number | undefined;
  let gpsMeasuredNS: number | undefined;

  if (isValidGpsPoint(cal.east) && isValidGpsPoint(cal.west)) {
    const em = toMeters(cal.east);
    const wm = toMeters(cal.west);
    const dx = wm.x - em.x;
    const dy = wm.y - em.y;
    gpsMeasuredEW = Math.round(Math.hypot(dx, dy) * 10) / 10;
    eu = normalizeVec(dx, dy);
  }

  if (isValidGpsPoint(cal.south) && isValidGpsPoint(cal.north)) {
    const sm = toMeters(cal.south);
    const nm = toMeters(cal.north);
    const dx = nm.x - sm.x;
    const dy = nm.y - sm.y;
    gpsMeasuredNS = Math.round(Math.hypot(dx, dy) * 10) / 10;
    ev = normalizeVec(dx, dy);
  }

  // Fill missing orthogonal axis by 90-degree rotation consistent with South-up layout:
  // Unrotated South-up blueprint has eu = (-1, 0) [West], ev = (0, +1) [North] -> clockwise rotation: ev = (eu.y, -eu.x)
  if (eu && !ev) {
    ev = { x: eu.y, y: -eu.x };
  } else if (ev && !eu) {
    eu = { x: -ev.y, y: ev.x };
  } else if (!eu && !ev) {
    if (anchors.length >= 2) {
      // Two adjacent walls (e.g. East + South): estimate building rotation from their vector
      const a0 = anchors[0];
      const a1 = anchors[1];
      const p0 = toMeters(a0.pt);
      const p1 = toMeters(a1.pt);
      const measDx = p1.x - p0.x;
      const measDy = p1.y - p0.y;
      const unrotDx = (a1.u - a0.u) * halfEW * -1; // unrotated eu.x = -1
      const unrotDy = (a1.v - a0.v) * halfNS * 1;  // unrotated ev.y = +1
      if (Math.hypot(measDx, measDy) >= 1 && Math.hypot(unrotDx, unrotDy) >= 1) {
        const theta = Math.atan2(measDy, measDx) - Math.atan2(unrotDy, unrotDx);
        eu = { x: -Math.cos(theta), y: -Math.sin(theta) };
        ev = { x: -Math.sin(theta), y: Math.cos(theta) };
      }
    }
    if (!eu || !ev) {
      eu = { x: -1, y: 0 };
      ev = { x: 0, y: 1 };
    }
  }

  const hu = { x: eu.x * halfEW, y: eu.y * halfEW };
  const hv = { x: ev.x * halfNS, y: ev.y * halfNS };

  // Compute implied center across all captured cardinal points
  let sumCx = 0;
  let sumCy = 0;
  anchors.forEach(a => {
    const pm = toMeters(a.pt);
    sumCx += pm.x - a.u * hu.x - a.v * hv.x;
    sumCy += pm.y - a.u * hu.y - a.v * hv.y;
  });
  const centerX = sumCx / anchors.length;
  const centerY = sumCy / anchors.length;

  const centerLat = Number((refLat + centerY / METERS_PER_DEG_LAT).toFixed(7));
  const centerLng = Number((refLng + centerX / metersPerDegLng).toFixed(7));
  const rotationDeg = Math.round(((Math.atan2(-eu.y, -eu.x) * 180) / Math.PI) * 10) / 10;

  return {
    refLat,
    refLng,
    metersPerDegLat: METERS_PER_DEG_LAT,
    metersPerDegLng,
    centerX,
    centerY,
    centerLat,
    centerLng,
    hu,
    hv,
    eastWestLengthMeters,
    northSouthLengthMeters,
    rotationDeg,
    gpsMeasuredEW,
    gpsMeasuredNS,
    capturedCount: anchors.length
  };
};

export const blueprintToGps = (
  mapX: number,
  mapY: number,
  basis: CalibrationBasis
): { lat: number; lng: number } => {
  const u = (mapX - BP_CENTER_X) / BP_HALF_W;
  const v = (mapY - BP_CENTER_Y) / BP_HALF_H;
  const mx = basis.centerX + u * basis.hu.x + v * basis.hv.x;
  const my = basis.centerY + u * basis.hu.y + v * basis.hv.y;
  return {
    lat: Number((basis.refLat + my / basis.metersPerDegLat).toFixed(7)),
    lng: Number((basis.refLng + mx / basis.metersPerDegLng).toFixed(7))
  };
};

export const gpsToBlueprint = (
  lat: number,
  lng: number,
  basis: CalibrationBasis
): {
  mapX: number;
  mapY: number;
  rawMapX: number;
  rawMapY: number;
  isInsideFactory: boolean;
  boundaryDistanceMeters: number;
  u: number;
  v: number;
} => {
  const px = (lng - basis.refLng) * basis.metersPerDegLng - basis.centerX;
  const py = (lat - basis.refLat) * basis.metersPerDegLat - basis.centerY;
  const det = basis.hu.x * basis.hv.y - basis.hu.y * basis.hv.x;

  if (Math.abs(det) < 1e-6) {
    return {
      mapX: BP_CENTER_X,
      mapY: BP_CENTER_Y,
      rawMapX: BP_CENTER_X,
      rawMapY: BP_CENTER_Y,
      isInsideFactory: false,
      boundaryDistanceMeters: 9999,
      u: 0,
      v: 0
    };
  }

  const u = (px * basis.hv.y - py * basis.hv.x) / det;
  const v = (basis.hu.x * py - basis.hu.y * px) / det;

  // Compute physical meters outside factory wall box ([-halfEW, halfEW] x [-halfNS, halfNS])
  const halfEW = basis.eastWestLengthMeters / 2;
  const halfNS = basis.northSouthLengthMeters / 2;
  const overEW = Math.max(0, (Math.abs(u) - 1) * halfEW);
  const overNS = Math.max(0, (Math.abs(v) - 1) * halfNS);
  const boundaryDistanceMeters = Math.round(Math.hypot(overEW, overNS) * 10) / 10;

  // Allow up to 18m indoor GPS drift beyond exact exterior walls to still count inside perimeter
  const isInsideFactory = boundaryDistanceMeters <= 18;

  const rawMapX = Math.round(BP_CENTER_X + u * BP_HALF_W);
  const rawMapY = Math.round(BP_CENTER_Y + v * BP_HALF_H);
  const mapX = Math.max(BP_X_MIN, Math.min(BP_X_MAX, rawMapX));
  const mapY = Math.max(BP_Y_MIN, Math.min(BP_Y_MAX, rawMapY));

  return { mapX, mapY, rawMapX, rawMapY, isInsideFactory, boundaryDistanceMeters, u, v };
};

export const generateCalibratedJigGps = (
  jigs: FactoryJig[],
  cal: FactoryBoundaryCalibration
): { basis: CalibrationBasis | null; calibratedJigs: FactoryJig[] } => {
  const basis = computeCalibrationBasis(cal);
  if (!basis) {
    return { basis: null, calibratedJigs: jigs };
  }

  const nowIso = cal.updatedAt || new Date().toISOString();
  const calibratedJigs = jigs.map(jig => {
    const cx = jig.x + jig.width / 2;
    const cy = jig.y + jig.height / 2;
    const center = blueprintToGps(cx, cy, basis);

    const widthMeters = Math.round(((jig.width / (BP_X_MAX - BP_X_MIN)) * basis.eastWestLengthMeters) * 10) / 10;
    const heightMeters = Math.round(((jig.height / (BP_Y_MAX - BP_Y_MIN)) * basis.northSouthLengthMeters) * 10) / 10;
    const gpsRadiusMeters = Math.max(5, Math.round(Math.max(widthMeters, heightMeters) / 2));

    return {
      ...jig,
      centerLat: center.lat,
      centerLng: center.lng,
      gpsWidthMeters: widthMeters,
      gpsHeightMeters: heightMeters,
      gpsRadiusMeters,
      gpsCalibratedAt: nowIso
    };
  });

  return { basis, calibratedJigs };
};

/**
 * Reconciles fetched JIGs against the saved FactoryBoundaryCalibration so every JIG
 * immediately reflects the latest calibrated coordinates and radius.
 */
export const reconcileJigsWithCalibration = (
  jigs: FactoryJig[],
  cal: FactoryBoundaryCalibration | null
): FactoryJig[] => {
  if (!cal) return jigs;
  const { basis, calibratedJigs } = generateCalibratedJigGps(jigs, cal);
  if (!basis) return jigs;

  return calibratedJigs.map((cj, idx) => {
    const orig = jigs[idx];
    const hasRecentPersisted =
      orig.centerLat !== undefined &&
      orig.centerLng !== undefined &&
      orig.gpsCalibratedAt &&
      cal.updatedAt &&
      orig.gpsCalibratedAt >= cal.updatedAt;
    return hasRecentPersisted ? orig : cj;
  });
};

/**
 * High-precision GPS-to-JIG identification combining affine projection with
 * nearest-JIG Haversine radius matching to handle indoor steel roof GPS drift.
 */
export const identifyLocationFromGps = (
  lat: number,
  lng: number,
  assignedJigId: string,
  jigs: FactoryJig[],
  cal: FactoryBoundaryCalibration | null
): {
  mapX: number;
  mapY: number;
  isInsideFactory: boolean;
  boundaryDistanceMeters: number;
  nearestJigId?: string;
  nearestJigDistanceMeters?: number;
  locationType: FactoryGpsRecord['locationType'];
  locationLabel: string;
  jigId?: string;
  jigName?: string;
  blockName?: string;
  isAtAssignedJig: boolean;
  status: FactoryGpsRecord['status'];
} => {
  const basis = cal ? computeCalibrationBasis(cal) : null;
  if (!basis) {
    const fallbackJig = jigs.find(j => j.id === assignedJigId) || jigs[0];
    const mapX = fallbackJig ? Math.round(fallbackJig.x + fallbackJig.width / 2) : BP_CENTER_X;
    const mapY = fallbackJig ? Math.round(fallbackJig.y + fallbackJig.height / 2) : BP_CENTER_Y;
    const loc = identifyLocationFromCoords(mapX, mapY, assignedJigId, jigs);
    return {
      ...loc,
      mapX,
      mapY,
      isInsideFactory: false,
      boundaryDistanceMeters: 0
    };
  }

  const effectiveJigs = reconcileJigsWithCalibration(jigs, cal);
  const mapped = gpsToBlueprint(lat, lng, basis);

  // Find closest JIG center in real meters
  let nearestJig: FactoryJig | undefined;
  let nearestDist = Infinity;
  effectiveJigs.forEach(j => {
    if (j.centerLat !== undefined && j.centerLng !== undefined) {
      const d = computeHaversineMeters(lat, lng, j.centerLat, j.centerLng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestJig = j;
      }
    }
  });
  const roundedNearestDist = Number.isFinite(nearestDist) ? Math.round(nearestDist * 10) / 10 : undefined;

  if (!mapped.isInsideFactory) {
    return {
      mapX: mapped.mapX,
      mapY: mapped.mapY,
      isInsideFactory: false,
      boundaryDistanceMeters: mapped.boundaryDistanceMeters,
      nearestJigId: nearestJig?.id,
      nearestJigDistanceMeters: roundedNearestDist,
      locationType: 'OUT_OF_BOUNDS',
      locationLabel: `7공장 외곽 이탈 (경계 밖 약 ${Math.round(mapped.boundaryDistanceMeters)}m)`,
      isAtAssignedJig: false,
      status: 'AWAY'
    };
  }

  const coordLoc = identifyLocationFromCoords(mapped.mapX, mapped.mapY, assignedJigId, effectiveJigs);
  if (coordLoc.locationType === 'JIG' || coordLoc.locationType === 'REST_AREA' || coordLoc.locationType === 'RESTROOM') {
    return {
      ...coordLoc,
      mapX: mapped.mapX,
      mapY: mapped.mapY,
      isInsideFactory: true,
      boundaryDistanceMeters: mapped.boundaryDistanceMeters,
      nearestJigId: nearestJig?.id,
      nearestJigDistanceMeters: roundedNearestDist
    };
  }

  // If on corridor gap between JIGs, snap to nearest JIG if within geofence radius + 8m indoor drift buffer
  if (nearestJig && roundedNearestDist !== undefined) {
    const captureRadius = (nearestJig.gpsRadiusMeters || 12) + 8;
    if (roundedNearestDist <= captureRadius) {
      const isAssigned = nearestJig.id === assignedJigId;
      return {
        mapX: mapped.mapX,
        mapY: mapped.mapY,
        isInsideFactory: true,
        boundaryDistanceMeters: mapped.boundaryDistanceMeters,
        nearestJigId: nearestJig.id,
        nearestJigDistanceMeters: roundedNearestDist,
        locationType: 'JIG',
        locationLabel: `${nearestJig.jigName} (${nearestJig.blockName})`,
        jigId: nearestJig.id,
        jigName: nearestJig.jigName,
        blockName: nearestJig.blockName,
        isAtAssignedJig: isAssigned,
        status: isAssigned ? 'NORMAL' : 'AWAY'
      };
    }
  }

  return {
    ...coordLoc,
    mapX: mapped.mapX,
    mapY: mapped.mapY,
    isInsideFactory: true,
    boundaryDistanceMeters: mapped.boundaryDistanceMeters,
    nearestJigId: nearestJig?.id,
    nearestJigDistanceMeters: roundedNearestDist
  };
};

export const fetchFactoryCalibration = async (): Promise<FactoryBoundaryCalibration | null> => {
  try {
    const snap = await getDoc(doc(db, 'factoryCalibration', FACTORY_CALIBRATION_DOC_ID));
    if (!snap.exists()) return null;
    return { ...DEFAULT_FACTORY_CALIBRATION, ...snap.data() } as FactoryBoundaryCalibration;
  } catch (err) {
    console.error('Error fetching factory calibration:', err);
    return null;
  }
};

export const saveFactoryCalibration = async (calibration: FactoryBoundaryCalibration): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'factoryCalibration', FACTORY_CALIBRATION_DOC_ID),
      calibration,
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving factory calibration:', err);
    handleFirestoreError(err, OperationType.WRITE, `factoryCalibration/${FACTORY_CALIBRATION_DOC_ID}`);
    throw err;
  }
};

export const applyCalibrationToAllJigs = async (
  jigs: FactoryJig[],
  cal: FactoryBoundaryCalibration
): Promise<{ basis: CalibrationBasis; calibratedJigs: FactoryJig[] }> => {
  const { basis, calibratedJigs } = generateCalibratedJigGps(jigs, cal);
  if (!basis) {
    throw new Error('동·서·남·북 중 최소 1개 이상의 GPS 기준점이 등록되어야 블럭 좌표를 산출할 수 있습니다.');
  }

  const enrichedCal: FactoryBoundaryCalibration = {
    ...cal,
    id: FACTORY_CALIBRATION_DOC_ID,
    centerLat: basis.centerLat,
    centerLng: basis.centerLng,
    rotationDeg: basis.rotationDeg,
    ...(basis.gpsMeasuredEW !== undefined ? { gpsMeasuredEW: basis.gpsMeasuredEW } : {}),
    ...(basis.gpsMeasuredNS !== undefined ? { gpsMeasuredNS: basis.gpsMeasuredNS } : {}),
    updatedAt: new Date().toISOString()
  };

  await saveFactoryCalibration(enrichedCal);

  for (const jig of calibratedJigs) {
    await setDoc(
      doc(db, 'factoryJigs', jig.id),
      {
        centerLat: jig.centerLat,
        centerLng: jig.centerLng,
        gpsWidthMeters: jig.gpsWidthMeters,
        gpsHeightMeters: jig.gpsHeightMeters,
        gpsRadiusMeters: jig.gpsRadiusMeters,
        gpsCalibratedAt: jig.gpsCalibratedAt
      },
      { merge: true }
    );
  }

  return { basis, calibratedJigs };
};

export interface CardinalBoundaryComparison {
  hasCalibration: boolean;
  basis: CalibrationBasis | null;
  u: number;
  v: number;
  mapX: number;
  mapY: number;
  rawMapX: number;
  rawMapY: number;
  eastWestLengthMeters: number;
  northSouthLengthMeters: number;
  isInsideStrictWalls: boolean;
  isInsideFactory: boolean;
  boundaryDistanceMeters: number;
  /** Signed meters inside each boundary wall (positive = inside wall, negative = outside beyond wall) */
  wallClearances: {
    east: number | null;
    west: number | null;
    south: number | null;
    north: number | null;
  };
  /** Direct Haversine distances in meters to registered E/W/S/N anchors and factory center */
  anchorDistances: {
    east: number | null;
    west: number | null;
    south: number | null;
    north: number | null;
    center: number | null;
  };
  nearestJigs: Array<{
    id: string;
    jigName: string;
    blockName: string;
    distanceMeters: number;
    radiusMeters: number;
    withinRadius: boolean;
  }>;
  location: ReturnType<typeof identifyLocationFromGps>;
}

/**
 * Evaluates live device GPS coordinates against calibrated East/West/South/North walls,
 * direct cardinal anchor points, and all 10 factory JIG centers for real-time debugging.
 */
export const evaluateDeviceVsBoundaries = (
  lat: number,
  lng: number,
  jigs: FactoryJig[],
  cal: FactoryBoundaryCalibration | null
): CardinalBoundaryComparison => {
  const effectiveJigs = reconcileJigsWithCalibration(
    jigs.length > 0 ? jigs : DEFAULT_FACTORY_JIGS,
    cal
  );
  const basis = cal ? computeCalibrationBasis(cal) : null;
  const location = identifyLocationFromGps(
    lat,
    lng,
    effectiveJigs[0]?.id || 'jig-01',
    effectiveJigs,
    cal
  );

  if (!basis || !cal) {
    return {
      hasCalibration: false,
      basis: null,
      u: 0,
      v: 0,
      mapX: BP_CENTER_X,
      mapY: BP_CENTER_Y,
      rawMapX: BP_CENTER_X,
      rawMapY: BP_CENTER_Y,
      eastWestLengthMeters: cal?.eastWestLengthMeters || DEFAULT_FACTORY_CALIBRATION.eastWestLengthMeters,
      northSouthLengthMeters: cal?.northSouthLengthMeters || DEFAULT_FACTORY_CALIBRATION.northSouthLengthMeters,
      isInsideStrictWalls: false,
      isInsideFactory: false,
      boundaryDistanceMeters: 0,
      wallClearances: { east: null, west: null, south: null, north: null },
      anchorDistances: { east: null, west: null, south: null, north: null, center: null },
      nearestJigs: [],
      location
    };
  }

  const mapped = gpsToBlueprint(lat, lng, basis);
  const halfEW = basis.eastWestLengthMeters / 2;
  const halfNS = basis.northSouthLengthMeters / 2;

  const round1 = (n: number) => Math.round(n * 10) / 10;

  const wallClearances = {
    east: round1((mapped.u + 1) * halfEW),
    west: round1((1 - mapped.u) * halfEW),
    south: round1((mapped.v + 1) * halfNS),
    north: round1((1 - mapped.v) * halfNS)
  };

  const anchorDistances = {
    east: isValidGpsPoint(cal.east) ? computeHaversineMeters(lat, lng, cal.east.lat, cal.east.lng) : null,
    west: isValidGpsPoint(cal.west) ? computeHaversineMeters(lat, lng, cal.west.lat, cal.west.lng) : null,
    south: isValidGpsPoint(cal.south) ? computeHaversineMeters(lat, lng, cal.south.lat, cal.south.lng) : null,
    north: isValidGpsPoint(cal.north) ? computeHaversineMeters(lat, lng, cal.north.lat, cal.north.lng) : null,
    center: computeHaversineMeters(lat, lng, basis.centerLat, basis.centerLng)
  };

  const nearestJigs = effectiveJigs
    .filter(j => j.centerLat !== undefined && j.centerLng !== undefined)
    .map(j => {
      const distanceMeters = computeHaversineMeters(lat, lng, j.centerLat!, j.centerLng!);
      const radiusMeters = j.gpsRadiusMeters || 12;
      return {
        id: j.id,
        jigName: j.jigName,
        blockName: j.blockName,
        distanceMeters,
        radiusMeters,
        withinRadius: distanceMeters <= radiusMeters + 8
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 3);

  return {
    hasCalibration: true,
    basis,
    u: round1(mapped.u * 100) / 100,
    v: round1(mapped.v * 100) / 100,
    mapX: mapped.mapX,
    mapY: mapped.mapY,
    rawMapX: mapped.rawMapX,
    rawMapY: mapped.rawMapY,
    eastWestLengthMeters: basis.eastWestLengthMeters,
    northSouthLengthMeters: basis.northSouthLengthMeters,
    isInsideStrictWalls: Math.abs(mapped.u) <= 1 && Math.abs(mapped.v) <= 1,
    isInsideFactory: mapped.isInsideFactory,
    boundaryDistanceMeters: mapped.boundaryDistanceMeters,
    wallClearances,
    anchorDistances,
    nearestJigs,
    location
  };
};

// ========================================================
// 일반 작업자 정시 무음 다중평균 GPS 자동 기록 엔진
// ========================================================

export const getLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseSlotMinutes = (slot: TrackingSlotTime): number => {
  const [hh, mm] = slot.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
};

/**
 * Matches current local time to an exact scheduled measurement slot within [slotTime, slotTime + toleranceMinutes].
 * E.g. 08:20 matches from 08:20:00 up to 08:24:59 so exact schedule ticks fire cleanly even if app wakes slightly late.
 */
export const findMatchingTrackingSlot = (
  date: Date = new Date(),
  toleranceMinutes = 4
): { slot: TrackingSlotTime; slotIndex: number; slotMinutes: number } | null => {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  for (let i = 0; i < TRACKING_TIME_SLOTS.length; i++) {
    const slot = TRACKING_TIME_SLOTS[i];
    const slotMins = parseSlotMinutes(slot);
    if (currentMinutes >= slotMins && currentMinutes <= slotMins + toleranceMinutes) {
      return { slot, slotIndex: i, slotMinutes: slotMins };
    }
  }
  return null;
};

/**
 * Computes milliseconds remaining until the next scheduled measurement slot's exact :00 second.
 */
export const getMsUntilNextTrackingSlot = (
  date: Date = new Date()
): { nextSlot: TrackingSlotTime; msUntil: number } | null => {
  const nowSecOfDay = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const nowMsRemainder = date.getMilliseconds();

  for (let i = 0; i < TRACKING_TIME_SLOTS.length; i++) {
    const slot = TRACKING_TIME_SLOTS[i];
    const slotSec = parseSlotMinutes(slot) * 60;
    if (slotSec > nowSecOfDay) {
      const msUntil = (slotSec - nowSecOfDay) * 1000 - nowMsRemainder;
      return { nextSlot: slot, msUntil: Math.max(500, msUntil) };
    }
  }
  return null;
};

export const resolveWorkerAssignedJigId = (
  worker: { assignedJigId?: string; departmentName?: string } | null | undefined,
  jigs: FactoryJig[] = DEFAULT_FACTORY_JIGS
): string => {
  if (worker?.assignedJigId && jigs.some(j => j.id === worker.assignedJigId)) {
    return worker.assignedJigId;
  }
  const dept = (worker?.departmentName || '').replace(/\s+/g, '').toLowerCase();
  if (dept) {
    const matched = jigs.find(j => {
      const assigned = (j.assignedTeam || '').replace(/\s+/g, '').toLowerCase();
      return assigned && (assigned.includes(dept) || dept.includes(assigned.split('(')[0]));
    });
    if (matched) return matched.id;
  }
  return jigs[0]?.id || 'jig-01';
};

export const buildScheduledWorkerGpsRecord = (params: {
  workerUid: string;
  workerName: string;
  employeeId: string;
  teamName: string;
  jobRole: string;
  assignedJigId: string;
  dateStr: string;
  slot: TrackingSlotTime;
  slotIndex: number;
  lat: number;
  lng: number;
  accuracy: number;
  sampleCount: number;
  spreadMeters: number;
  jigs: FactoryJig[];
  calibration: FactoryBoundaryCalibration | null;
}): FactoryGpsRecord => {
  const reconciledJigs = reconcileJigsWithCalibration(
    params.jigs.length > 0 ? params.jigs : DEFAULT_FACTORY_JIGS,
    params.calibration
  );
  const locInfo = identifyLocationFromGps(
    params.lat,
    params.lng,
    params.assignedJigId,
    reconciledJigs,
    params.calibration
  );

  return {
    id: `${params.workerUid}_${params.dateStr}_${params.slotIndex}`,
    date: params.dateStr,
    slot: params.slot,
    slotIndex: params.slotIndex,
    workerUid: params.workerUid,
    workerName: params.workerName,
    employeeId: params.employeeId,
    teamName: params.teamName,
    jobRole: params.jobRole,
    latitude: params.lat,
    longitude: params.lng,
    accuracy: params.accuracy,
    mapX: locInfo.mapX,
    mapY: locInfo.mapY,
    locationType: locInfo.locationType,
    jigId: locInfo.jigId,
    jigName: locInfo.jigName,
    blockName: locInfo.blockName,
    locationLabel: locInfo.locationLabel,
    isAtAssignedJig: locInfo.isAtAssignedJig,
    status: locInfo.status,
    stayMinutesInSlot: SLOT_MINUTES_MAP[params.slot] || 60,
    recordedAt: new Date().toISOString(),
    sampleCount: params.sampleCount,
    spreadMeters: params.spreadMeters,
    measurementMode: 'AUTO_SCHEDULED_AVG'
  };
};

export const recordWorkerScheduledSlotGps = async (params: {
  workerUid: string;
  workerName: string;
  employeeId: string;
  teamName: string;
  jobRole: string;
  assignedJigId?: string;
  dateStr: string;
  slot: TrackingSlotTime;
  slotIndex: number;
  lat: number;
  lng: number;
  accuracy: number;
  sampleCount: number;
  spreadMeters: number;
}): Promise<FactoryGpsRecord> => {
  const [fetchedJigs, fetchedCalibration] = await Promise.all([
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'factoryJigs'));
        if (snap.empty) return DEFAULT_FACTORY_JIGS;
        return snap.docs.map(d => ({ ...d.data() } as FactoryJig)).sort((a, b) => a.jigNumber - b.jigNumber);
      } catch {
        return DEFAULT_FACTORY_JIGS;
      }
    })(),
    fetchFactoryCalibration()
  ]);

  const effectiveJigs = reconcileJigsWithCalibration(
    fetchedJigs.length > 0 ? fetchedJigs : DEFAULT_FACTORY_JIGS,
    fetchedCalibration
  );
  const resolvedAssignedJigId = resolveWorkerAssignedJigId(
    { assignedJigId: params.assignedJigId, departmentName: params.teamName },
    effectiveJigs
  );

  const record = buildScheduledWorkerGpsRecord({
    ...params,
    assignedJigId: resolvedAssignedJigId,
    jigs: effectiveJigs,
    calibration: fetchedCalibration
  });

  try {
    await setDoc(doc(db, 'factoryGpsRecords', record.id), record, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `factoryGpsRecords/${record.id}`);
    throw err;
  }

  // Keep daily dwell summary synchronized for CEO dashboard & 2-hour heatmap
  try {
    const workerDaySnap = await getDocs(
      query(
        collection(db, 'factoryGpsRecords'),
        where('date', '==', params.dateStr),
        where('workerUid', '==', params.workerUid)
      )
    );
    const workerDayRecords = workerDaySnap.docs.map(d => ({ id: d.id, ...d.data() } as FactoryGpsRecord));
    const summary = computeWorkerDwellSummary(
      params.workerUid,
      params.workerName,
      params.employeeId,
      params.teamName,
      params.jobRole,
      resolvedAssignedJigId,
      params.dateStr,
      workerDayRecords,
      effectiveJigs
    );
    await setDoc(doc(db, 'workerDwellSummaries', summary.id), summary, { merge: true });
  } catch (err) {
    console.warn('[FactoryGpsTracker] workerDwellSummary sync deferred:', err);
  }

  return record;
};


