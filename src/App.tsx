import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { NotificationHandler } from './components/NotificationHandler';
import { FontSizeManager } from './components/FontSizeManager';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { Attendance } from './pages/Attendance';
import { AccidentReport } from './pages/AccidentReport';
import { Notifications } from './pages/Notifications';
import { Notices } from './pages/Notices';
import { Leave } from './pages/Leave';
import { LeaveManagement } from './pages/LeaveManagement';
import { Coupons } from './pages/Coupons';
import { Entertainment } from './pages/Entertainment';
import { Lotto } from './pages/Lotto';
import { MyPage } from './pages/MyPage';
import { Qualification } from './pages/Qualification';
import { ShipAssembly } from './pages/ShipAssembly';
import { TrainingManagement } from './pages/TrainingManagement';
import { TrainingList } from './pages/TrainingList';
import { SafetyRanking } from './pages/SafetyRanking';
import { Redemption } from './pages/Redemption';
import { RedemptionManagement } from './pages/RedemptionManagement';
import { AttendanceManagement } from './pages/AttendanceManagement';
import { WorkLog } from './pages/WorkLog';
import { WorkLogManagement } from './pages/WorkLogManagement';
import { PersonalWorkLog } from './pages/PersonalWorkLog';
import { PraiseFeed } from './pages/PraiseFeed';
import { MealRequest } from './pages/MealRequest';
import { MealManagement } from './pages/MealManagement';
import { HighWorkMonitoring } from './pages/HighWorkMonitoring';
import { Admin } from './pages/Admin';
import MyPayslip from './pages/MyPayslip';
import PayslipManagement from './pages/PayslipManagement';
import PCAdminDashboard from './pages/PCAdminDashboard';
import PCAdminPersonnel from './pages/PCAdminPersonnel';
import PCAdminAttendance from './pages/PCAdminAttendance';
import PCAdminLeave from './pages/PCAdminLeave';
import PCAdminPayslip from './pages/PCAdminPayslip';
import PCAdminSafety from './pages/PCAdminSafety';
import PCAdminNotices from './pages/PCAdminNotices';
import PCAdminWorkLog from './pages/PCAdminWorkLog';
import PCAdminTraining from './pages/PCAdminTraining';
import PCAdminRedemption from './pages/PCAdminRedemption';
import PCAdminCoupons from './pages/PCAdminCoupons';
import PCAdminHighWork from './pages/PCAdminHighWork';
import PCAdminNotifications from './pages/PCAdminNotifications';
import PCAdminBeacons from './pages/PCAdminBeacons';
import PCAdminEvacuationHistory from './pages/PCAdminEvacuationHistory';
import EvacuationHistory from './pages/EvacuationHistory';
import HealthManagement from './pages/HealthManagement';
import UnifiedReportCenter from './pages/UnifiedReportCenter';
import EnclosedSpaceMonitoring from './pages/EnclosedSpaceMonitoring';
import { Toaster } from '@/components/ui/sonner';
import { CompanyLogo } from './components/CompanyLogo';
import { EmergencyOverlay } from './components/EmergencyOverlay';
import { AltitudeTracker } from './components/AltitudeTracker';
import { GhostGuardTracker } from './components/GhostGuardTracker';
import { SafetySensorProvider } from './components/SafetySensorProvider';

import { motion, AnimatePresence } from 'framer-motion';

import { GlowLoading } from './components/GlowLoading';
import { doc, onSnapshot, setDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/src/firebase';

const ProtectedRoute = ({ children, roles, permission }: { children: React.ReactNode, roles?: string[], permission?: string }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <GlowLoading />;
  if (!user) return <Navigate to="/login" />;
  
  const isExcludedRole = profile && (
    ['EMPLOYEE', 'TEAM_LEADER', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    ['조장', '반장', '사원'].includes(profile.position?.trim() || '') ||
    profile.employeeId?.trim().toLowerCase() === 'x66626' ||
    profile.employeeId?.trim().toUpperCase() === 'X66626' ||
    profile.displayName?.toLowerCase().includes('x66626') ||
    profile.email?.toLowerCase().includes('x66626') ||
    user?.email?.toLowerCase().includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626'
  );

  const hasAccess = (() => {
    if (!profile) return false;
    
    // Explicit blacklist for x66626 or anyone identified as excluded role
    // They should NOT have access to any restricted route regardless of other permissions
    if (isExcludedRole) {
      const restrictedPaths = ['/admin', '/personnel', '/work-log-mgmt', '/leave-mgmt', '/attendance-mgmt', '/training-mgmt', '/redemption-mgmt', '/payslip-mgmt'];
      if (roles || permission || restrictedPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'))) {
        return false;
      }
    }

    if (!roles && !permission) return true;
    
    // CEO Email override - ONLY for the real CEO email
    if (profile.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com') return true;
    
    if (roles && roles.includes(profile.role)) return true;
    if (permission && profile.permissions?.includes(permission)) return true;
    if (location.pathname === '/admin' && ['CEO', 'SAFETY_MANAGER', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile.role)) return true;
    return false;
  })();

  if (!hasAccess && (roles || permission)) return <Navigate to="/" />;

  // PC Dashboard and its subpages handle their own layout (Full-width, desktop-optimized)
  if (location.pathname.startsWith('/admin/pc')) {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
};

const ErrorLogger = () => {
  const { user } = useAuth();
  
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global Error Captured:", event.message);
      if (db) {
        addDoc(collection(db, 'client_errors'), {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          uid: user?.uid,
          email: user?.email,
          url: window.location.href,
          timestamp: new Date().toISOString()
        }).catch(err => console.error("Could not log error to Firestore:", err));
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [user]);

  return null;
};

export default function App() {
  return (
    <AuthProvider>
      <ErrorLogger />
      <SafetySensorProvider>
        <NotificationHandler />
        <FontSizeManager />
        <EmergencyOverlay />
        <AltitudeTracker />
        <GhostGuardTracker />
        <Router>
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
            <Route path="/personal-work-log" element={<ProtectedRoute><PersonalWorkLog /></ProtectedRoute>} />
            <Route path="/meal-request" element={<ProtectedRoute><MealRequest /></ProtectedRoute>} />
            <Route path="/meal-mgmt" element={<ProtectedRoute roles={['GENERAL_MANAGER', 'CLERK']}><MealManagement /></ProtectedRoute>} />
            <Route path="/work-log-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'CLERK', 'GENERAL_AFFAIRS']} permission="work_log_mgmt"><WorkLogManagement /></ProtectedRoute>} />
            <Route path="/qualification" element={<ProtectedRoute permission="qualification_mgmt"><Qualification /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><TrainingList /></ProtectedRoute>} />
            <Route path="/training-mgmt" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="training_mgmt"><TrainingManagement /></ProtectedRoute>} />
            <Route path="/safety-score" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="safety_ranking"><SafetyRanking /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
        <Toaster position="top-center" richColors />
      </SafetySensorProvider>
    </AuthProvider>
  );
}
