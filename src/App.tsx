import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { PraiseFeed } from './pages/PraiseFeed';
import { HighWorkMonitoring } from './pages/HighWorkMonitoring';
import { Admin } from './pages/Admin';
import { Toaster } from '@/components/ui/sonner';
import { CompanyLogo } from './components/CompanyLogo';
import { EmergencyOverlay } from './components/EmergencyOverlay';
import { AltitudeTracker } from './components/AltitudeTracker';
import { GhostGuardTracker } from './components/GhostGuardTracker';

import { motion, AnimatePresence } from 'motion/react';

import { GlowLoading } from './components/GlowLoading';

const ProtectedRoute = ({ children, roles, permission }: { children: React.ReactNode, roles?: string[], permission?: string }) => {
  const { user, profile, loading } = useAuth();
  const location = window.location;

  if (loading) return <GlowLoading />;
  if (!user) return <Navigate to="/login" />;
  
  const hasAccess = (() => {
    if (!roles && !permission) return true;
    if (!profile) return false;
    if (profile.email === 'tjrwnfjqm1@gmail.com') return true;
    if (roles && roles.includes(profile.role)) return true;
    if (permission && profile.permissions?.includes(permission)) return true;
    if (location.pathname === '/admin' && ['CEO', 'SAFETY_MANAGER'].includes(profile.role)) return true;
    return false;
  })();

  if (!hasAccess && (roles || permission)) return <Navigate to="/" />;

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <AuthProvider>
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
          <Route path="/personnel" element={<ProtectedRoute><EmployeeManagement /></ProtectedRoute>} />
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
          <Route path="/high-work-monitor" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']}><HighWorkMonitoring /></ProtectedRoute>} />
          <Route path="/ship-assembly" element={<ProtectedRoute><ShipAssembly /></ProtectedRoute>} />
          <Route path="/praise-feed" element={<ProtectedRoute><PraiseFeed /></ProtectedRoute>} />
          <Route path="/work-log" element={<ProtectedRoute><WorkLog /></ProtectedRoute>} />
          <Route path="/work-log-mgmt" element={<ProtectedRoute roles={['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER']}><WorkLogManagement /></ProtectedRoute>} />
          <Route path="/qualification" element={<ProtectedRoute><Qualification /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute><TrainingList /></ProtectedRoute>} />
          <Route path="/training-mgmt" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']} permission="training_mgmt"><TrainingManagement /></ProtectedRoute>} />
          <Route path="/safety-score" element={<ProtectedRoute roles={['CEO', 'SAFETY_MANAGER']}><SafetyRanking /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
