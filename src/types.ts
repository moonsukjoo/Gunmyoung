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
  lastMovementAt?: string;
  isImmobile?: boolean;
  isFalling?: boolean;
  fallDetectedAt?: string;
  hasImpacted?: boolean;
  impactDetectedAt?: string;
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
  type: 'ANNUAL' | 'SICK' | 'SPECIAL' | 'AM_HALF' | 'PM_HALF' | 'OTHER';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdAt: string;
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

export interface Payslip {
  id: string;
  uid: string;
  employeeId: string;
  userName: string;
  month: string; // YYYY-MM
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
  totalEarnings: number;
  incomeTax: number;
  localIncomeTax: number;
  healthInsurance: number;
  nationalPension: number;
  employmentInsurance: number;
  mealDeduction: number;
  laundryDeduction: number;
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
