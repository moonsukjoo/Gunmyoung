import React, { useState } from 'react';
import { 
  Users, 
  Clock, 
  CalendarDays, 
  ShieldCheck, 
  CircleDollarSign, 
  ClipboardList, 
  Lock,
  HardHat, 
  BarChart3, 
  Bell, 
  Settings,
  Search,
  LogOut,
  Menu,
  X,
  Trophy,
  History,
  FileText,
  LayoutDashboard,
  Zap,
  Radio,
  FileBarChart,
  Activity
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { auth } from '../firebase';

interface PCAdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const PCAdminLayout: React.FC<PCAdminLayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'TEAM_LEADER', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    ['조장', '반장', '사원'].includes(profile.position?.trim() || '') ||
    profile.employeeId?.trim().toLowerCase().includes('x66626') ||
    profile.displayName?.toLowerCase().includes('x66626') ||
    profile.email?.toLowerCase().includes('x66626') ||
    user?.email?.toLowerCase().includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626' ||
    (user?.email && user.email.toLowerCase().startsWith('x66626@')) ||
    (user?.displayName && user.displayName.toLowerCase().includes('x66626'))
  );

  if (isExcludedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-10">
        <div className="max-w-md w-full bg-white p-10 rounded-[2rem] shadow-xl text-center border border-slate-200">
          <ShieldCheck className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-slate-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-slate-500 font-medium mb-8">관리자 전용 페이지입니다. 일반 사원 계정인 {profile?.displayName}님은 이 페이지에 접근할 수 없습니다.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all"
          >
            메인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      group: '대시보드',
      items: [
        { id: 'dashboard', label: '엔터프라이즈 개요', icon: LayoutDashboard, to: '/admin/pc-dashboard' },
      ]
    },
    {
      group: '인사 및 근태',
      items: [
        { id: 'personnel', label: '임직원 정보 관리', icon: Users, to: '/admin/pc/personnel' },
        { id: 'permissions', label: '사용자 권한 관리', icon: Lock, to: '/pc-admin/personnel' },
        { id: 'attendance', label: '근태 현황 총괄', icon: Clock, to: '/admin/pc/attendance' },
        { id: 'leave', label: '연차/휴가 결재', icon: CalendarDays, to: '/admin/pc/leave' },
        { id: 'payslip', label: '급여명세서 발행', icon: CircleDollarSign, to: '/admin/pc/payslip' },
      ]
    },
    {
      group: '안전 및 관리',
      items: [
        { id: 'safety', label: '안전지수 설정', icon: ShieldCheck, to: '/admin/pc/safety' },
        { id: 'worklog', label: '작업일지 총괄', icon: ClipboardList, to: '/admin/pc/worklog' },
        { id: 'training', label: '교육/평가 현황', icon: HardHat, to: '/admin/pc/training' },
        { id: 'highwork', label: '고소작업 모니터링', icon: BarChart3, to: '/admin/pc/highwork' },
        { id: 'beacons', label: '밀폐공간 관제', icon: Radio, to: '/admin/pc/beacons' },
      ]
    },
    {
      group: '분석 및 리포트',
      items: [
        { id: 'unified_reports', label: '통합 보고서 센터', icon: FileBarChart, to: '/admin/reports' },
        { id: 'health_reports_status', label: '보건관리(이상무) 현황', icon: Activity, to: '/health-mgmt' },
        { id: 'evacuation_history', label: '비상 대피 이력', icon: History, to: '/admin/evacuation-history' },
      ]
    },
    {
      group: '시스템 및 기타',
      items: [
        { id: 'notice', label: '공지사항 관리', icon: Bell, to: '/admin/pc/notices' },
        { id: 'notifications', label: '푸시 알림 관리', icon: Zap, to: '/admin/pc/notifications' },
        { id: 'redemption', label: '현물 신청 관리', icon: Settings, to: '/admin/pc/redemption' },
        { id: 'coupons', label: '포상/쿠폰 관리', icon: Trophy, to: '/admin/pc/coupons' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex font-sans text-slate-900 select-text overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-72' : 'w-20'} bg-[#1E293B] transition-all duration-300 flex flex-col z-50 text-slate-300 shadow-2xl shrink-0`}
      >
        <div className="p-8 flex items-center justify-between border-b border-slate-700/50">
          <div className={`flex items-center gap-3 ${!isSidebarOpen && 'hidden'}`}>
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tighter text-white block leading-none">건명 관리자</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group relative ${
                      isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? '' : 'group-hover:scale-110'}`} />
                    {isSidebarOpen && <span className="text-sm font-bold">{item.label}</span>}
                    {!isSidebarOpen && (
                      <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] border border-slate-700">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-700/50 text-center">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all w-full group"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              {isSidebarOpen && <span className="text-sm font-bold">로그아웃</span>}
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-10 flex items-center justify-between shrink-0 shadow-sm z-40">
          <div className="flex items-center gap-4">
             <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden xl:flex flex-col items-end border-r border-slate-100 pr-8">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
              <span className="text-lg font-black text-slate-800 tracking-tight">{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            </div>

              <div className="flex flex-col items-end">
                <p className="text-sm font-black text-slate-900 leading-none">{profile?.displayName || '관리자'}</p>
                <p className="text-[10px] font-black text-blue-600 mt-1.5 px-2 py-0.5 bg-blue-50 rounded-full uppercase tracking-tight">
                  {profile?.role === 'CEO' ? '대표이사' : 
                   profile?.role === 'DIRECTOR' ? '이사/직장' :
                   profile?.role === 'GENERAL_MANAGER' ? '부장' :
                   profile?.role === 'SAFETY_MANAGER' ? '안전관리자' :
                   profile?.role === 'TEAM_LEADER' ? '팀장' :
                   profile?.role === 'GROUP_LEADER' ? '조장' :
                   profile?.role === 'EMPLOYEE' ? '사원' : profile?.role || '관리자'}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-2xl overflow-hidden ring-4 ring-slate-50 shadow-sm border border-slate-200">
                 <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} alt="profile" className="w-full h-full object-cover" />
              </div>
            </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#F0F2F5]/50 no-scrollbar">
          {children}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }
        aside .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
        aside:hover .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};

export default PCAdminLayout;
