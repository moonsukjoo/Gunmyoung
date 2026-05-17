import React, { useLayoutEffect, Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { Toaster } from 'sonner';
import { GlowLoading } from './components/GlowLoading';
import { AlertCircle } from 'lucide-react';

// Lazy load components to reduce initial bundle size
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const EmployeeManagement = lazy(() => import('./pages/EmployeeManagement').then(m => ({ default: m.EmployeeManagement })));
const Attendance = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const AccidentReport = lazy(() => import('./pages/AccidentReport').then(m => ({ default: m.AccidentReport })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const Notices = lazy(() => import('./pages/Notices').then(m => ({ default: m.Notices })));
const Leave = lazy(() => import('./pages/Leave').then(m => ({ default: m.Leave })));
const LeaveManagement = lazy(() => import('./pages/LeaveManagement').then(m => ({ default: m.LeaveManagement })));
const Coupons = lazy(() => import('./pages/Coupons').then(m => ({ default: m.Coupons })));
const Entertainment = lazy(() => import('./pages/Entertainment').then(m => ({ default: m.Entertainment })));
const Lotto = lazy(() => import('./pages/Lotto').then(m => ({ default: m.Lotto })));
const MyPage = lazy(() => import('./pages/MyPage').then(m => ({ default: m.MyPage })));
const ShipAssembly = lazy(() => import('./pages/ShipAssembly').then(m => ({ default: m.ShipAssembly })));
const SafetyRanking = lazy(() => import('./pages/SafetyRanking').then(m => ({ default: m.SafetyRanking })));
const SafetyLeaderboard = lazy(() => import('./pages/SafetyLeaderboard').then(m => ({ default: m.SafetyLeaderboard })));
const Redemption = lazy(() => import('./pages/Redemption').then(m => ({ default: m.Redemption })));
const RedemptionManagement = lazy(() => import('./pages/RedemptionManagement').then(m => ({ default: m.RedemptionManagement })));
const AttendanceManagement = lazy(() => import('./pages/AttendanceManagement').then(m => ({ default: m.AttendanceManagement })));
const WorkLog = lazy(() => import('./pages/WorkLog').then(m => ({ default: m.WorkLog })));
const WorkLogManagement = lazy(() => import('./pages/WorkLogManagement').then(m => ({ default: m.WorkLogManagement })));
const PersonalWorkLog = lazy(() => import('./pages/PersonalWorkLog').then(m => ({ default: m.PersonalWorkLog })));
const PraiseFeed = lazy(() => import('./pages/PraiseFeed').then(m => ({ default: m.PraiseFeed })));
const MealRequest = lazy(() => import('./pages/MealRequest').then(m => ({ default: m.MealRequest })));
const MealManagement = lazy(() => import('./pages/MealManagement').then(m => ({ default: m.MealManagement })));
const HighWorkMonitoring = lazy(() => import('./pages/HighWorkMonitoring').then(m => ({ default: m.HighWorkMonitoring })));
const Qualification = lazy(() => import('./pages/Qualification').then(m => ({ default: m.Qualification })));
const TrainingManagement = lazy(() => import('./pages/TrainingManagement').then(m => ({ default: m.TrainingManagement })));
const TrainingList = lazy(() => import('./pages/TrainingList').then(m => ({ default: m.TrainingList })));
const MyPayslip = lazy(() => import('./pages/MyPayslip'));
const PayslipManagement = lazy(() => import('./pages/PayslipManagement'));
const PCAdminDashboard = lazy(() => import('./pages/PCAdminDashboard'));
const PCAdminPersonnel = lazy(() => import('./pages/PCAdminPersonnel'));
const PCAdminAttendance = lazy(() => import('./pages/PCAdminAttendance'));
const PCAdminLeave = lazy(() => import('./pages/PCAdminLeave'));
const PCAdminPayslip = lazy(() => import('./pages/PCAdminPayslip'));
const PCAdminSafety = lazy(() => import('./pages/PCAdminSafety'));
const PCAdminNotices = lazy(() => import('./pages/PCAdminNotices'));
const PCAdminWorkLog = lazy(() => import('./pages/PCAdminWorkLog'));
const PCAdminTraining = lazy(() => import('./pages/PCAdminTraining'));
const PCAdminRedemption = lazy(() => import('./pages/PCAdminRedemption'));
const PCAdminCoupons = lazy(() => import('./pages/PCAdminCoupons'));
const PCAdminHighWork = lazy(() => import('./pages/PCAdminHighWork'));
const PCAdminNotifications = lazy(() => import('./pages/PCAdminNotifications'));
const PCAdminBeacons = lazy(() => import('./pages/PCAdminBeacons'));
const PCAdminEvacuationHistory = lazy(() => import('./pages/PCAdminEvacuationHistory'));
const EvacuationHistory = lazy(() => import('./pages/EvacuationHistory'));
const HealthManagement = lazy(() => import('./pages/HealthManagement'));
const UnifiedReportCenter = lazy(() => import('./pages/UnifiedReportCenter'));
const EnclosedSpaceMonitoring = lazy(() => import('./pages/EnclosedSpaceMonitoring'));
const WorkInstructionReport = lazy(() => import('./pages/WorkInstructionReport').then(m => ({ default: m.WorkInstructionReportPage })));
const WorkInstructionManagement = lazy(() => import('./pages/WorkInstructionManagement').then(m => ({ default: m.WorkInstructionManagement })));

const ProtectedRoute = ({ children, roles, permission }: { children: React.ReactNode, roles?: string[], permission?: string }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <GlowLoading />;
  if (!user) return <Navigate to="/login" />;
  
  const isExcludedRole = profile && (
    ['EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    (['조장', '반장', '사원'].includes(profile.position?.trim() || '') && profile.role !== 'TEAM_LEADER') ||
    profile.employeeId?.trim()?.includes('x66626')
  );

  const hasAccess = (() => {
    if (!profile) return false;
    
    if (profile.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com') return true;

    if (isExcludedRole) {
      const restrictedPaths = ['/admin', '/personnel', '/work-log-mgmt', '/leave-mgmt', '/attendance-mgmt', '/training-mgmt', '/redemption-mgmt', '/payslip-mgmt'];
      if (permission && profile.permissions?.includes(permission)) return true;
      if (roles || restrictedPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'))) {
        return false;
      }
    }

    if (!roles && !permission) return true;
    if (roles && roles.includes(profile.role)) return true;
    if (permission && profile.permissions?.includes(permission)) return true;
    if (location.pathname === '/admin' && ['CEO', 'SAFETY_MANAGER', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile.role)) return true;
    return false;
  })();

  if (!hasAccess && (roles || permission)) return <Navigate to="/" />;

  if (location.pathname.startsWith('/admin/pc')) {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
};

function AppContent() {
  const { profile } = useAuth();
  
  useLayoutEffect(() => {
    if (profile?.lightTheme) {
      document.documentElement.classList.add('light-theme');
      document.documentElement.style.setProperty('color-scheme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.style.setProperty('color-scheme', 'dark');
    }

    if (profile?.elderlyMode) {
      document.documentElement.classList.add('elderly-mode');
    } else {
      document.documentElement.classList.remove('elderly-mode');
    }
  }, [profile?.lightTheme, profile?.elderlyMode]);

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <Suspense fallback={<GlowLoading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute permission="admin"><Admin /></ProtectedRoute>} />
            <Route path="/admin/evacuation-history" element={<ProtectedRoute permission="admin"><EvacuationHistory /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute permission="admin"><UnifiedReportCenter /></ProtectedRoute>} />
            <Route path="/health-mgmt" element={<ProtectedRoute><HealthManagement /></ProtectedRoute>} />
            <Route path="/pc-admin/evacuation-history" element={<ProtectedRoute permission="admin"><PCAdminEvacuationHistory /></ProtectedRoute>} />
            <Route path="/personnel" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="employee_mgmt"><EmployeeManagement /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/accidents" element={<ProtectedRoute><AccidentReport /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/notices" element={<ProtectedRoute><Notices /></ProtectedRoute>} />
            <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
            <Route path="/leave-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="leave_mgmt"><LeaveManagement /></ProtectedRoute>} />
            <Route path="/coupons" element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
            <Route path="/lotto" element={<ProtectedRoute><Lotto /></ProtectedRoute>} />
            <Route path="/entertainment" element={<ProtectedRoute><Entertainment /></ProtectedRoute>} />
            <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
            <Route path="/redemption" element={<ProtectedRoute><Redemption /></ProtectedRoute>} />
            <Route path="/redemption-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="redemption_mgmt"><RedemptionManagement /></ProtectedRoute>} />
            <Route path="/attendance-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="attendance_mgmt"><AttendanceManagement /></ProtectedRoute>} />
            <Route path="/high-work-monitor" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="high_work_monitor"><HighWorkMonitoring /></ProtectedRoute>} />
            <Route path="/ship-assembly" element={<ProtectedRoute><ShipAssembly /></ProtectedRoute>} />
            <Route path="/mypage/payslip" element={<ProtectedRoute><MyPayslip /></ProtectedRoute>} />
            <Route path="/admin/pc-dashboard" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/pc/personnel" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminPersonnel /></ProtectedRoute>} />
            <Route path="/admin/pc/attendance" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminAttendance /></ProtectedRoute>} />
            <Route path="/admin/pc/leave" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminLeave /></ProtectedRoute>} />
            <Route path="/admin/pc/payslip" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminPayslip /></ProtectedRoute>} />
            <Route path="/admin/pc/safety" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="admin"><PCAdminSafety /></ProtectedRoute>} />
            <Route path="/admin/pc/notices" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminNotices /></ProtectedRoute>} />
            <Route path="/admin/pc/worklog" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminWorkLog /></ProtectedRoute>} />
            <Route path="/admin/pc/training" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminTraining /></ProtectedRoute>} />
            <Route path="/admin/pc/redemption" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminRedemption /></ProtectedRoute>} />
            <Route path="/admin/pc/coupons" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminCoupons /></ProtectedRoute>} />
            <Route path="/admin/pc/highwork" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminHighWork /></ProtectedRoute>} />
            <Route path="/admin/pc/beacons" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']} permission="admin"><PCAdminBeacons /></ProtectedRoute>} />
            <Route path="/enclosed-monitoring" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']}><EnclosedSpaceMonitoring /></ProtectedRoute>} />
            <Route path="/admin/pc/notifications" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="admin"><PCAdminNotifications /></ProtectedRoute>} />
            <Route path="/payslip-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER']} permission="payslip_mgmt"><PayslipManagement /></ProtectedRoute>} />
             <Route path="/praise-feed" element={<ProtectedRoute><PraiseFeed /></ProtectedRoute>} />
            <Route path="/work-log" element={<ProtectedRoute><WorkLog /></ProtectedRoute>} />
            <Route path="/work-instruction" element={<ProtectedRoute><WorkInstructionReport /></ProtectedRoute>} />
            <Route path="/work-instruction-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'CLERK', 'GENERAL_AFFAIRS', 'TEAM_LEADER']}><WorkInstructionManagement /></ProtectedRoute>} />
            <Route path="/personal-work-log" element={<ProtectedRoute><PersonalWorkLog /></ProtectedRoute>} />
            <Route path="/meal-request" element={<ProtectedRoute><MealRequest /></ProtectedRoute>} />
            <Route path="/meal-mgmt" element={<ProtectedRoute roles={['GENERAL_MANAGER', 'CLERK']}><MealManagement /></ProtectedRoute>} />
            <Route path="/work-log-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'CLERK', 'GENERAL_AFFAIRS', 'TEAM_LEADER']} permission="team_work_log_approve"><WorkLogManagement /></ProtectedRoute>} />
            <Route path="/qualification" element={<ProtectedRoute permission="qualification_mgmt"><Qualification /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><TrainingList /></ProtectedRoute>} />
            <Route path="/training-mgmt" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="training_mgmt"><TrainingManagement /></ProtectedRoute>} />
            <Route path="/safety-score" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="safety_ranking"><SafetyRanking /></ProtectedRoute>} />
            <Route path="/safety-leaderboard" element={<ProtectedRoute><SafetyLeaderboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
        <Toaster position="top-center" richColors />
      </div>
    </Router>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Error caught by Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-10 text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center text-destructive mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black mb-4">문제가 발생했습니다</h1>
          <p className="text-muted-foreground mb-6 font-bold text-sm max-w-md mx-auto">{this.state.error?.message}</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="h-14 bg-primary text-primary-foreground rounded-2xl font-black shadow-lg shadow-primary/20"
            >
              새로고침
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="h-14 bg-muted text-foreground rounded-2xl font-black border border-border"
            >
              처음으로 돌아가기
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
