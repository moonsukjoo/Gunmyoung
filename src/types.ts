export type Role = 'CEO' | 'DIRECTOR' | 'GENERAL_AFFAIRS' | 'GENERAL_MANAGER' | 'CLERK' | 'SAFETY_MANAGER' | 'TEAM_LEADER' | 'GROUP_LEADER' | 'EMPLOYEE' | 'WORKER';

export type UserStatus = 'ACTIVE' | 'ON_LEAVE' | 'RETIRED';

export interface UserProfile {
  uid: string;
  employeeId: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  departmentId?: string; // Changed from department string to ID
  departmentName?: string;
  position?: string;
  jobRole?: string; // e.g., 취부, 용접 등
  workplace?: string; // e.g., 울산조선소, 부산공장 등
  phoneNumber?: string;
  annualLeaveBalance?: number;
  points?: number;
  birthDate?: string;
  joinedAt?: string;
  resignedAt?: string;
  isActive: boolean;
  failedLoginAttempts?: number;
  isLocked?: boolean;
  permissions?: string[]; // permissions for specific features
  hasCustomPin?: boolean;
  lastPinChange?: string;
  elderlyMode?: boolean;
  shipParts?: string[];
  completedShips?: number;
  lastShipPartGrantAt?: string;
  safetyScore?: number;
  safetyScoreLastUpdate?: string;
  kudosCount?: number;
  monthlyKudosCount?: number;
  kudosMonth?: string;
  currentAltitude?: number;
  altitudeUpdatedAt?: string;
  basePressure?: number;
  ghostGuardEnabled?: boolean;
  lightTheme?: boolean;
  highContrast?: boolean;
  fontSizeScale?: 'normal' | 'large' | 'xlarge';
  pinnedShortcuts?: string[];
  lastMovementAt?: string;
  isImmobile?: boolean;
  isFalling?: boolean;
  fallDetectedAt?: string;
  hasImpacted?: boolean;
  impactDetectedAt?: string;
  workScheduleSettings?: EmployeeWorkScheduleSettings;
}

export type SchedulePresetType = 'REGULAR' | 'EARLY' | 'OFFICE' | 'NIGHT' | 'CUSTOM';

export interface DaySpecificSchedule {
  enabled: boolean;
  workStartTime: string; // "HH:mm"
  workEndTime: string;   // "HH:mm"
  lunchStartTime?: string;
  lunchEndTime?: string;
}

export interface EmployeeWorkScheduleSettings {
  scheduleType: SchedulePresetType;
  workStartTime: string; // "HH:mm", default: "08:00"
  workEndTime: string;   // "HH:mm", default: "17:00"
  workDays: number[];    // [0, 1, 2, 3, 4, 5, 6] (0 = Sun, 1 = Mon, ... 6 = Sat), default: [1, 2, 3, 4, 5]
  autoCheckInEnabled: boolean; // default: true
  autoCheckOutEnabled: boolean; // default: true
  preShiftArrivalWindowMinutes: number; // in minutes, e.g. 60 (arrival 60m before workStartTime triggers check-in)
  autoTriggerAnytimeOnWorkDays: boolean; // default: false (if true, triggers whenever arriving inside geofence on work day)
  lunchStartTime: string; // default: "12:00"
  lunchEndTime: string;   // default: "13:00"
  preShiftReminderEnabled: boolean; // default: true
  preShiftReminderMinutes: number; // default: 15 (minutes before workStartTime)
  postShiftReminderEnabled: boolean; // default: true
  overtimeBaselineMode?: 'STANDARD_HOURS' | 'EXACT_CLOCKOUT';
  daySpecificSchedules?: Record<number, DaySpecificSchedule>;
  updatedAt?: string;
}

export interface SafetyScoreLog {
  id: string;
  targetUid: string;
  targetName: string;
  adminUid: string;
  adminName: string;
  adminRole: Role;
  scoreDelta: number;
  previousScore: number;
  newScore: number;
  reason: string;
  type: 'PENALTY' | 'REWARD';
  photoUrl?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  createdAt: string;
}

export interface JobRole {
  id: string;
  name: string;
  createdAt: string;
}

export interface Training {
  id: string;
  title: string;
  description: string;
  content: string; // Markdown or simple text
  fileUrl?: string; // URL to PDF/Excel material
  fileName?: string; // Name of the uploaded file
  videoUrl?: string;
  targetJobRole?: string; // If empty, for everyone
  questions: QuizQuestion[];
  questionsPerExam?: number; // Number of random questions to show in exam
  timeLimit?: number; // Time limit in minutes
  passingScore?: number; // Minimum score to pass
  pointsPerQuestion?: number; // Points for each correct answer
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of options
}

export interface TrainingResult {
  id: string;
  trainingId: string;
  trainingTitle: string;
  uid: string;
  userName: string;
  score: number;
  totalQuestions: number;
  isPassed: boolean;
  completedAt: string;
}

export interface StatutorySession {
  id: string; // e.g. "2025_05_1_onsite"
  title: string;
  year: number;
  month: number;
  round: number; // 1 or 2
  category: '현장안전 교육' | '영상안전보건 교육' | '월간 위험성평가 교육' | '특별안전 교육' | '신규입사자 교육' | string;
  content: string; // Course details or summary
  targetDepartment: string; // e.g. "용접팀", "취부팀", "전체"
  instructor: string;
  location: string;
  videoUrl?: string; // Optional training material link
  durationMinutes?: number; // e.g. 60 or 120 minutes
  trainingMethod?: 'ONSITE' | 'ONLINE' | string; // e.g. "현장직접" vs "온라인(영상)"
  trainingDate?: string; // Specific training date e.g. "2026-05-27"
  createdAt: string;
  imageUrl?: string;
  isReeducation?: boolean;
  parentSessionId?: string;
  allowedUids?: string[];
}

export interface StatutoryCompletion {
  id: string; // e.g. "session_id + _ + uid"
  sessionId: string;
  uid: string;
  userName: string;
  userRole: string; // e.g. WORKER, TEAM_LEADER
  departmentName: string; // e.g. "용접팀", "취부팀"
  position: string; // e.g. "기공", "조장", "반장"
  category: string;
  year: number;
  month: number;
  round: number;
  completedAt: string;
  signatureUrl: string; // Canvas drawn signature base64 url
  evalSignatureUrl?: string; // Signature drawn for training evaluation
  evaluationGrade?: string; // Evaluation grade, e.g. 'A', 'B', 'C'
  status: 'COMPLETED';
}

export interface AttendanceLocationSettings {
  centerLat: number;
  centerLng: number;
  locationName?: string;
  checkInRadius: number; // in meters (default 1000m = 1km)
  checkOutRadius: number; // in meters (default 2000m = 2km)
  geofenceBufferMeters?: number; // in meters (default 500m geofencing buffer / tolerance)
  locationRetentionMinutes?: number; // in minutes (default 15 minutes minimum validity retention)
  pendingExitTimeoutMinutes: number; // in minutes (default 120min = 2 hours)
  gpsAttendanceEnabled?: boolean; // Master GPS Attendance feature toggle (default false)
  autoClockInEnabled?: boolean; // default false
  autoClockOutEnabled?: boolean; // default false
  coreStartHour: number; // default 8
  coreStartMin: number; // default 0
  coreEndHour: number; // default 17
  coreEndMin: number; // default 0
  lunchStartHour: number; // default 12
  lunchEndHour: number; // default 13
  updatedAt?: string;
  updatedBy?: string;
}

export interface AttendanceLog {
  id: string;
  uid: string;
  userName?: string;
  date: string;
  time: string;
  type: 'check-in' | 'check-out';
  latitude?: number;
  longitude?: number;
  timestamp: any;
}

export interface Attendance {
  id: string;
  uid: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';
  healthStatus?: 'GOOD' | 'NORMAL' | 'BAD';
  workHours?: number; // Total hours including overtime
  overtimeHours?: number; // Overtime hours
  memo?: string;
  leaveType?: 'ANNUAL' | 'AM_HALF' | 'PM_HALF';
  autoClockIn?: boolean;
  autoClockOut?: boolean;
  autoClockOutReason?: string;
  clockInLat?: number;
  clockInLng?: number;
  clockOutLat?: number;
  clockOutLng?: number;
  pendingExitSince?: string | null;
  lastVerifiedInsideAt?: string | null;
}

export interface AccidentCase {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'SAFE' | 'INCIDENT' | 'ACCIDENT' | 'OTHER';
  measures?: string;
  reportedByUid: string;
  reportedBy: string;
  imageUrl?: string;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  uid: string;
  displayName?: string;
  employeeId?: string;
  type: 'ANNUAL' | 'SICK' | 'SPECIAL' | 'AM_HALF' | 'PM_HALF' | 'OTHER' | 'OUTING' | 'OUTING_1H' | 'OUTING_2H';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdAt: string;
}

export interface WorkInstructionReport {
  id?: string;
  teamId: string;
  teamName: string;
  date: string; // yyyy-MM-dd
  dayOfWeek: string;
  supervisorName: string; // 관리감독자
  supervisorSignUrl?: string;
  safetyManagerName: string; // 안전보건관리책임자
  safetyManagerSignUrl?: string;
  tbmContent: string;
  
  workerInstructions: {
    no: number;
    workerUid: string;
    workerName: string;
    instruction: string;
    changedInstruction?: string;
    startTime: string;
    endTime: string;
    memo?: string;
    hazardSubmitted: boolean;
    healthStatus: 'NORMAL' | 'GOOD' | 'BAD';
    signBeforeUrl?: string; // Digital signature URL or base64
    signAfterUrl?: string; // Digital signature URL or base64
  }[];

  safetyChecks: {
    category: string;
    items: {
      no: number;
      text: string;
      result: 'O' | 'X' | 'N/A';
    }[];
  }[];

  hazardAssessments: {
    no: number;
    hazardFactor: string;
    safetyMethod: string;
    actionContent: string;
    remarks: string;
  }[];

  createdAt: string;
  createdByUid: string;
  createdByName: string;
  status: 'PENDING' | 'APPROVED';
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  targetDept: string;
  createdAt: string;
  isImportant: boolean;
}

export interface Notification {
  id: string;
  uid: string; // Target user
  title: string;
  message: string;
  type: 'HEALTH_CHECK' | 'NOTICE' | 'SYSTEM' | 'LEAVE_REMINDER' | 'COUPON' | 'EMERGENCY' | 'URGENT_NOTICE' | 'LEAVE_RESPONSE';
  isRead: boolean;
  createdAt: string;
  fromUid?: string;
  fromName?: string;
}

export interface LottoHistory {
  id: string;
  uid: string;
  lines: string[]; // Store as ["1,2,3,4,5,6,7", ...] to avoid Firestore nested array error
  createdAt: string;
}

export interface Praise {
  id: string;
  senderUid: string;
  senderName: string;
  receiverUid: string;
  receiverName: string;
  message: string;
  createdAt: string;
}

export interface PraiseComment {
  id: string;
  praiseId: string;
  uid: string;
  userName: string;
  message: string;
  createdAt: string;
}

export interface PraiseCoupon {
  id: string;
  senderUid: string;
  senderName: string;
  senderRole: Role;
  receiverUid: string;
  receiverName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  reason: string;
  points: number;
  createdAt: string;
  status?: 'PENDING' | 'COMPLETED';
  photoUrl?: string;
}

export interface RedemptionRequest {
  id: string;
  uid: string;
  userName: string;
  pointsRequested: number;
  amount: number; // Won (points * 5000)
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  processedByName?: string;
}

export interface WorkLog {
  id?: string;
  uid: string;
  userName: string;
  departmentId?: string;
  departmentName?: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  content: string;
  createdAt: string;
}

export interface WorkLogEntry {
  userName: string;
  tasks: { content: string; hours: string }[];
  clockOutTime: string;
}

export interface TeamWorkLog {
  id?: string;
  teamId: string;
  teamName: string;
  date: string; // yyyy-MM-dd
  entries: WorkLogEntry[];
  supervisorSignUrl?: string;
  createdAt: string;
  createdByUid: string;
  createdByUserName: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assignedToUid: string;
  assignedToName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  createdAt: string;
}

export interface EvacuationStatus {
  id: string;
  isActive: boolean;
  activatedAt: string;
  activatedByUid: string;
  activatedByName: string;
  reason: string;
  totalWorkers?: number;
  totalClockedIn?: number;
  confirmedCount?: number;
}

export interface EvacuationCheckin {
  uid: string;
  displayName: string;
  departmentName: string;
  confirmedAt: string;
}

export interface HealthReport {
  id: string;
  authorUid: string;
  authorName: string;
  authorRole: Role;
  teamId?: string;
  teamName?: string;
  status: string; // e.g., "이상무"
  content: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface PayslipExtraItem {
  label: string;
  amount: number;
}

export interface Payslip {
  id: string;
  uid: string;
  employeeId: string;
  userName: string;
  month: string; // YYYY-MM
  workDays?: number;
  baseHours: number;
  weeklyHolidayHours: number;
  paidLeaveHours: number;
  trainingHours: number;
  otherHours: number;
  monthlyLeaveHours: number;
  holidayWorkHours: number;
  overtimeHours: number;
  totalHours: number;
  hourlyRate: number;
  baseSalary: number;
  experienceAllowance: number;
  otherAllowance: number;
  annualLeaveAllowance: number;
  mealAllowance: number;
  extraAllowance: number;
  customEarnings?: PayslipExtraItem[];
  totalEarnings: number;
  incomeTax: number;
  localIncomeTax: number;
  healthInsurance: number;
  nationalPension: number;
  employmentInsurance: number;
  mealDeduction: number;
  laundryDeduction: number;
  customDeductions?: PayslipExtraItem[];
  totalDeductions: number;
  netPay: number;
  annualLeaveBaseDate?: string;
  createdAt: string;
}

export interface IndividualWorkLog {
  id: string;
  uid: string;
  userName: string;
  departmentId?: string;
  departmentName?: string;
  date: string; // yyyy-MM-dd
  clockOutTime: string; // HH:mm
  tasks: { content: string; hours: string }[];
  workerSignUrl?: string;
  status: 'PENDING' | 'LEADER_APPROVED' | 'FINAL_APPROVED' | 'REJECTED';
  approvedByLeaderUid?: string;
  approvedByLeaderName?: string;
  approvedByLeaderAt?: string;
  approvedByClerkUid?: string;
  approvedByClerkName?: string;
  approvedByClerkAt?: string;
  createdAt: string;
}

export interface LunchRequest {
  id: string;
  uid: string;
  userName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
}

export interface SnackRequest {
  id: string;
  uid: string;
  userName: string;
  departmentName: string;
  quantity: number;
  deliveryDate: string; // YYYY-MM-DD
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
}

export interface WorkRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderPosition?: string;
  receiverUid: string;
  receiverName: string;
  receiverNameAndPosition?: string;
  content: string;
  isUrgent: boolean; // 긴급 vs 일반
  category: 'SAFETY' | 'WORK'; // 안전 vs 업무
  status: 'PENDING' | 'RESOLVED' | 'REJECTED'; // PENDING: 대기중, RESOLVED: 완료, REJECTED: 거절
  createdAt: string;
  resolvedAt?: string;
  remarks?: string;
}

// ==========================================
// 중형선 7공장 A3 공장내부도 및 지그/블럭 GPS 체류 관제
// ==========================================

export const TRACKING_TIME_SLOTS = [
  '08:20', // 1차 기록 (작업 개시 직후 현장 안착)
  '09:45', // 2차 기록 (오전 휴게 10:00 직전)
  '10:15', // 3차 기록 (오전 휴게 종료 후 작업 재개)
  '11:45', // 4차 기록 (점심시간 12:00 직전)
  '13:10', // 5차 기록 (오후 조업 시작 직후 안착)
  '14:45', // 6차 기록 (오후 휴게 15:00 직전)
  '15:15', // 7차 기록 (오후 휴게 종료 후 작업 재개)
  '17:45', // 8차 기록 (정규 종료 및 잔업 확인)
] as const;

export type TrackingSlotTime = typeof TRACKING_TIME_SLOTS[number];

export type DelayReasonCategory =
  | 'MANPOWER_SHORTAGE'
  | 'MATERIAL_DELAY'
  | 'EQUIPMENT_CRANE'
  | 'DESIGN_CHANGE'
  | 'QUALITY_REWORK'
  | 'WEATHER_SAFETY'
  | 'SUBCONTRACTOR_DELAY'
  | 'OTHER';

export const DELAY_REASON_CATEGORIES: Record<DelayReasonCategory, string> = {
  MANPOWER_SHORTAGE: '인원 부족 / 무단 이탈',
  MATERIAL_DELAY: '자재 / 철판 반입 지연',
  EQUIPMENT_CRANE: '크레인 / 장비 간섭',
  DESIGN_CHANGE: '도면 / 설계 변경 대기',
  QUALITY_REWORK: '품질 검사 / 수정 재작업',
  WEATHER_SAFETY: '안전 조치 / 작업 중지',
  SUBCONTRACTOR_DELAY: '외주 물량팀 공정 지연',
  OTHER: '기타 크리티컬 사유',
};

export interface BlockDelayLog {
  id: string;
  jigId: string;
  jigName: string;
  blockName: string;
  category: DelayReasonCategory;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  reason: string;
  actionPlan?: string;
  delayDays: number;
  progressAtTime: number;
  recordedByUid: string;
  recordedByName: string;
  recordedAt: string;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedNote?: string;
}

export interface FactoryJig {
  id: string; // e.g. 'jig-01'
  jigNumber: number; // 1 ~ 10
  jigName: string; // 'JIG-01'
  blockName: string; // '2111 블럭'
  blockType: string; // '선체 중앙 저판 블럭'
  assignedTeam: string; // '물량1팀 (선체취부)'
  currentProgress: number; // 0 ~ 100%
  progressPercent?: number; // alias for progressPercent
  startDate?: string; // 공정 시작일 (YYYY-MM-DD)
  endDate?: string;   // 공정 완료/종료 예정일 (YYYY-MM-DD)
  targetDays?: number; // 공정 계획 소요일수 (e.g. 10일)
  // Critical delay summary metadata
  latestDelayReason?: string;
  latestDelayAt?: string;
  latestDelaySeverity?: 'CRITICAL' | 'WARNING' | 'INFO';
  delayLogCount?: number;
  // Auto-calibrated GPS center & physical dimensions from East/West/South/North boundary setup
  centerLat?: number;
  centerLng?: number;
  gpsRadiusMeters?: number;
  gpsWidthMeters?: number;
  gpsHeightMeters?: number;
  gpsCalibratedAt?: string;
  // Coordinates on the A3 landscape blueprint (0 ~ 1000 coordinate system)
  x: number;
  y: number;
  width: number;
  height: number;
  bay: 'BAY_SOUTH' | 'BAY_NORTH'; // 위쪽(남쪽) Bay A, 아래쪽(북쪽) Bay B
  status: 'ACTIVE' | 'HOLD' | 'COMPLETED';
}

export interface CardinalGpsPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt?: string;
  label?: string;
}

export interface FactoryBoundaryCalibration {
  id: string; // 'factory-07'
  eastWestLengthMeters: number; // 동 ↔ 서 실측 길이 (m)
  northSouthLengthMeters: number; // 남 ↔ 북 실측 폭 (m)
  east?: CardinalGpsPoint | null;  // 동쪽 (도면 좌측 / 제6공장 반입문)
  west?: CardinalGpsPoint | null;  // 서쪽 (도면 우측 / 반출문)
  south?: CardinalGpsPoint | null; // 남쪽 (도면 상단 / BAY A 외벽)
  north?: CardinalGpsPoint | null; // 북쪽 (도면 하단 / BAY B 외벽)
  centerLat?: number;
  centerLng?: number;
  rotationDeg?: number;
  gpsMeasuredEW?: number;
  gpsMeasuredNS?: number;
  updatedAt: string;
  updatedByUid?: string;
  updatedByName?: string;
}

export interface BlockDeploymentStats {
  jigId: string;
  jigName: string;
  blockName: string;
  blockType: string;
  assignedTeam: string;
  startDate: string;
  endDate: string;
  targetDays: number; // e.g. 10일
  elapsedDays: number; // 현재 경과 일수
  remainingDays: number; // D-Day (음수면 지연)
  totalWorkersDeployed: number; // 누적 총 투입 유일 인원
  totalManHours: number; // 누적 총 투입 공수 (시간)
  avgDailyWorkers: number; // 일평균 투입 인원 (명/일)
  currentProgress: number; // 0 ~ 100%
  statusVerdict: 'ON_SCHEDULE' | 'BEHIND_SCHEDULE' | 'CRITICAL_DELAY' | 'COMPLETED';
}

export interface FactoryGpsRecord {
  id: string;
  date: string; // YYYY-MM-DD
  slot: TrackingSlotTime;
  slotIndex: number; // 0 ~ 7
  workerUid: string;
  workerName: string;
  employeeId: string;
  teamName: string;
  jobRole: string; // 취부, 용접, 사상, 취부보조
  latitude: number;
  longitude: number;
  accuracy: number;
  // Mapped coordinate on the A3 factory blueprint (0 ~ 1000 coordinate system)
  mapX: number;
  mapY: number;
  locationType: 'JIG' | 'REST_AREA' | 'RESTROOM' | 'MATERIAL_YARD' | 'OFFICE' | 'OUT_OF_BOUNDS';
  jigId?: string;
  jigName?: string;
  blockName?: string;
  locationLabel: string; // 'JIG-01 (2111 블럭)' or '물량팀 휴게실' or '현장 무단이탈'
  isAtAssignedJig: boolean;
  status: 'NORMAL' | 'AWAY' | 'RESTING' | 'UNKNOWN';
  stayMinutesInSlot: number; // 체류 인정 분수 (슬롯 가중치: e.g. 85분, 30분, 90분 등)
  recordedAt: string;
}

export interface WorkerBlockDwellDetail {
  blockOrArea: string;
  minutes: number;
  percentage: number;
  isWorkBlock: boolean;
}

export interface WorkerDwellSummary {
  id: string; // `${workerUid}_${date}`
  date: string; // YYYY-MM-DD
  workerUid: string;
  workerName: string;
  employeeId: string;
  teamName: string;
  jobRole: string;
  assignedJigId: string;
  assignedBlockName: string;
  totalShiftMinutes: number; // e.g. 420 mins (7 hours)
  workBlockDwellMinutes: number; // assigned block total stay minutes
  restAreaMinutes: number; // rest room & break minutes
  awayMinutes: number; // unapproved away / unauthorized area minutes
  complianceRate: number; // % (workBlockDwellMinutes / expectedWorkMinutes)
  dwellDetails: WorkerBlockDwellDetail[];
  slotRecords: {
    slot: TrackingSlotTime;
    timeLabel: string;
    locationLabel: string;
    blockName?: string;
    status: 'NORMAL' | 'AWAY' | 'RESTING';
    mapX: number;
    mapY: number;
  }[];
  verdict: 'EXCELLENT' | 'NORMAL' | 'WARNING' | 'CRITICAL_AWAY'; // 공정 체류 성실도 판정
  updatedAt: string;
}


