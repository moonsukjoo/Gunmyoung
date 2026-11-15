import React, { useState, useEffect } from 'react';
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
  Activity,
  Thermometer,
  Layers,
  Compass
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { auth } from '../firebase';
import { CompanyLogo } from './CompanyLogo';
import { CriticalIncidentAlertCenter } from './CriticalIncidentAlertCenter';

interface PCAdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const PCAdminLayout: React.FC<PCAdminLayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1280);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

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

  const isCEO = profile?.role === 'CEO' || profile?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';

  const navGroups = [
    {
      group: '종합 관제',
      items: [
        { id: 'dashboard', label: '통합 관제 홈', icon: LayoutDashboard, to: '/admin/pc-dashboard' },
        { id: 'unified_reports', label: '통합 보고서 센터', icon: FileBarChart, to: '/admin/pc/reports' },
      ]
    },
    {
      group: '실시간 현장 · GPS',
      items: [
        { id: 'factory_dwell', label: '7공장 체류시간 관제 (A3)', icon: Layers, to: '/admin/pc/factory-dwell', requiresCEO: true },
        {
          id: 'gps_debug',
          label: '실시간 GPS 좌표 디버깅',
          icon: Compass,
          onClick: () => window.dispatchEvent(new CustomEvent('secret-gps-debug-control', { detail: { mode: 'EXPANDED' } })),
          requiresCEO: true
        },
        { id: 'highwork', label: '고소작업 실시간 관제', icon: BarChart3, to: '/admin/pc/highwork' },
        { id: 'beacons', label: '밀폐공간 위치 관제', icon: Radio, to: '/admin/pc/beacons' },
        { id: 'perceived_temp_mgmt', label: '실시간 체감온도 관제', icon: Thermometer, to: '/admin/pc/perceived-temp' },
        { id: 'health_reports_status', label: '실시간 보건현황', icon: Activity, to: '/admin/pc/health-mgmt' },
        { id: 'evacuation_history', label: '비상 대피 · 롤콜 이력', icon: History, to: '/admin/pc/evacuation-history' },
      ]
    },
    {
      group: '근태 · 인사 · 급여',
      items: [
        { id: 'attendance_status', label: '실시간 출근현황', icon: Clock, to: '/admin/pc/attendance-status' },
        { id: 'attendance', label: '월간 근태 현황', icon: Clock, to: '/admin/pc/attendance' },
        { id: 'leave', label: '연차 · 휴가 결재', icon: CalendarDays, to: '/admin/pc/leave' },
        { id: 'worklog', label: '작업일지 관리', icon: ClipboardList, to: '/admin/pc/worklog' },
        { id: 'personnel', label: '임직원 정보 관리', icon: Users, to: '/admin/pc/personnel' },
        { id: 'permissions', label: '사용자 권한 설정', icon: Lock, to: '/admin/pc/personnel?tab=permissions' },
        { id: 'payslip', label: '급여명세서 발행', icon: CircleDollarSign, to: '/admin/pc/payslip' },
      ]
    },
    {
      group: '안전 · 포상 · 공지',
      items: [
        { id: 'safety', label: '안전지수 관리', icon: ShieldCheck, to: '/admin/pc/safety' },
        { id: 'training', label: '법정 안전교육', icon: HardHat, to: '/admin/pc/training' },
        { id: 'redemption', label: '포상 현물 신청 관리', icon: Settings, to: '/admin/pc/redemption' },
        { id: 'coupons', label: '안전 포상 · 쿠폰', icon: Trophy, to: '/admin/pc/coupons' },
        { id: 'notice', label: '전사 공지사항', icon: Bell, to: '/admin/pc/notices' },
        { id: 'notifications', label: '푸시 알림 발송', icon: Zap, to: '/admin/pc/notifications' },
      ]
    }
  ];

  const sidebarContent = (isOpen: boolean, isMobileDrawer = false) => (
    <>
      <div className="p-6 flex items-center justify-between border-b border-white/10 gap-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center p-1.5 active:scale-95 transition-all shrink-0">
            <CompanyLogo className="w-full h-full" />
          </div>
          {(isOpen || isMobileDrawer) && (
            <div className="flex flex-col min-w-0">
              <span className="font-black text-base tracking-tight text-white block leading-none truncate">건명기업</span>
              <span className="text-[10px] font-bold text-cyan-400 mt-1 block tracking-wider whitespace-nowrap">스마트 마린 관제</span>
            </div>
          )}
        </div>
        <button 
          onClick={() => {
            if (isMobileDrawer) {
              setIsMobileOpen(false);
            } else {
              setIsSidebarOpen(!isSidebarOpen);
            }
          }} 
          className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0 cursor-pointer"
        >
          {isOpen || isMobileDrawer ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-5 px-3.5 space-y-6 custom-scrollbar">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1.5">
            {(isOpen || isMobileDrawer) && (
              <div className="px-3.5 text-[11px] font-black text-slate-500 tracking-wide mb-1 select-none">
                {group.group}
              </div>
            )}
            <div className="space-y-1">
              {group.items
                .filter((item: any) => !item.requiresCEO || isCEO)
                .map((item: any) => {
                if (item.onClick) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.onClick();
                        if (isMobileDrawer) setIsMobileOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all group relative text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 cursor-pointer text-left"
                    >
                      <item.icon className="w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110" />
                      {(isOpen || isMobileDrawer) && <span className="text-xs font-bold">{item.label}</span>}
                      {(!isOpen && !isMobileDrawer) && (
                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] border border-slate-700">
                          {item.label}
                        </div>
                      )}
                    </button>
                  );
                }
                const itemPath = item.to.split('?')[0];
                const itemQuery = item.to.split('?')[1] || '';
                const pathnameMatch = location.pathname === itemPath;
                const searchParams = new URLSearchParams(location.search);
                const hasTabParam = itemQuery.includes('tab=');
                const isTabActive = hasTabParam 
                  ? searchParams.get('tab') === new URLSearchParams(itemQuery).get('tab')
                  : !searchParams.get('tab');
                const isActive = pathnameMatch && isTabActive;
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={() => {
                      if (isMobileDrawer) setIsMobileOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all group relative ${
                      isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-300/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className={`w-4.5 h-4.5 shrink-0 transition-transform ${isActive ? '' : 'group-hover:scale-110'}`} />
                    {(isOpen || isMobileDrawer) && <span className="text-xs font-bold">{item.label}</span>}
                    {(!isOpen && !isMobileDrawer) && (
                      <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] border border-slate-700">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 text-center">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all w-full group cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5 transition-transform group-hover:-translate-x-1" />
            {(isOpen || isMobileDrawer) && <span className="text-xs font-bold">로그아웃</span>}
          </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground select-text overflow-hidden relative">
      {/* Desktop Marine Deep Navy Sidebar */}
      <aside 
        className={`hidden xl:flex ${isSidebarOpen ? 'w-72' : 'w-20'} bg-[#091326] border-r border-white/10 transition-all duration-300 flex-col z-50 text-slate-300 shadow-2xl shrink-0 no-print`}
      >
        {sidebarContent(isSidebarOpen, false)}
      </aside>

      {/* Mobile / Tablet Slide-over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileOpen(false)}
          />
          <aside className="relative w-72 bg-[#091326] border-r border-white/10 flex flex-col z-10 text-slate-300 shadow-2xl shrink-0 no-print h-full animate-in slide-in-from-left duration-300">
            {sidebarContent(true, true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background">
        {/* Header */}
        <header className="h-18 bg-card/90 backdrop-blur-md border-b border-border px-4 sm:px-8 flex items-center justify-between shrink-0 shadow-xs z-40 no-print">
          <div className="flex items-center gap-4">
             <button
               onClick={() => setIsMobileOpen(true)}
               className="xl:hidden p-2.5 rounded-xl bg-muted text-foreground hover:bg-accent transition-all cursor-pointer"
               aria-label="메뉴 열기"
             >
               <Menu className="w-5 h-5" />
             </button>
             <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">{title}</h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            <div className="hidden xl:flex flex-col items-end border-r border-border pr-8">
              <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
              <span className="text-lg font-black text-foreground tracking-tight">{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            </div>

              <div className="flex flex-col items-end">
                <p className="text-sm font-black text-foreground leading-none">{profile?.displayName || '관리자'}</p>
                <p className="text-[10px] font-black text-blue-500 mt-1.5 px-2 py-0.5 bg-blue-500/10 rounded-full uppercase tracking-tight">
                  {profile?.role === 'CEO' ? '대표이사' : 
                   profile?.role === 'DIRECTOR' ? '이사/직장' :
                   profile?.role === 'GENERAL_MANAGER' ? '부장' :
                   profile?.role === 'SAFETY_MANAGER' ? '안전관리자' :
                   profile?.role === 'TEAM_LEADER' ? '팀장' :
                   profile?.role === 'GROUP_LEADER' ? '조장' :
                   profile?.role === 'EMPLOYEE' ? '사원' : profile?.role || '관리자'}
                </p>
              </div>
              <div className="w-10 sm:w-12 h-10 sm:h-12 bg-muted rounded-2xl overflow-hidden ring-4 ring-muted shadow-sm border border-border shrink-0">
                 <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} alt="profile" className="w-full h-full object-cover" />
              </div>
            </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar bg-background/50 no-scrollbar">
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

        @media print {
          aside, header, nav, .no-print, button, .no-print-col, [class*="no-print"] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
      <CriticalIncidentAlertCenter />
    </div>
  );
};

export default PCAdminLayout;
