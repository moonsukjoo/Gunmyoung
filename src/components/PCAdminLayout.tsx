import React, { useState, useEffect, useRef } from 'react';
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
  LogOut,
  Trophy,
  History,
  FileBarChart,
  Activity,
  Thermometer,
  Layers,
  Compass,
  Radio,
  Zap,
  LayoutDashboard,
  ChevronDown
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

interface NavCategory {
  id: string;
  label: string;
  items: {
    id: string;
    label: string;
    icon: React.ElementType;
    to?: string;
    requiresCEO?: boolean;
    onClick?: () => void | any;
  }[];
}

const PCAdminLayout: React.FC<PCAdminLayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setActiveDropdown(null);
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
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all cursor-pointer"
          >
            메인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const isCEO = profile?.role === 'CEO' || profile?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';

  const navCategories: NavCategory[] = [
    {
      id: 'dashboard',
      label: '종합 관제',
      items: [
        { id: 'dashboard_home', label: '통합 관제 홈', icon: LayoutDashboard, to: '/admin/pc-dashboard' },
        { id: 'unified_reports', label: '통합 보고서 센터', icon: FileBarChart, to: '/admin/pc/reports' },
        { id: 'attendance_status', label: '실시간 출근현황', icon: Clock, to: '/admin/pc/attendance-status' },
      ]
    },
    {
      id: 'field_gps',
      label: '실시간 현장 · GPS',
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
      id: 'hr_attendance',
      label: '근태 · 인사',
      items: [
        { id: 'attendance', label: '월간 근태 현황', icon: Clock, to: '/admin/pc/attendance' },
        { id: 'leave', label: '연차 · 휴가 결재', icon: CalendarDays, to: '/admin/pc/leave' },
        { id: 'worklog', label: '작업일지 관리', icon: ClipboardList, to: '/admin/pc/worklog' },
        { id: 'personnel', label: '임직원 정보 관리', icon: Users, to: '/admin/pc/personnel' },
        { id: 'permissions', label: '사용자 권한 설정', icon: Lock, to: '/admin/pc/personnel?tab=permissions' },
      ]
    },
    {
      id: 'welfare_salary',
      label: '급여 · 복지',
      items: [
        { id: 'payslip', label: '급여명세서 발행', icon: CircleDollarSign, to: '/admin/pc/payslip' },
        { id: 'redemption', label: '포상 현물 신청 관리', icon: Settings, to: '/admin/pc/redemption' },
        { id: 'coupons', label: '안전 포상 · 쿠폰', icon: Trophy, to: '/admin/pc/coupons' },
      ]
    },
    {
      id: 'safety_notice',
      label: '안전 · 교육 · 공지',
      items: [
        { id: 'safety', label: '안전지수 관리', icon: ShieldCheck, to: '/admin/pc/safety' },
        { id: 'training', label: '법정 안전교육', icon: HardHat, to: '/admin/pc/training' },
        { id: 'notice', label: '전사 공지사항', icon: Bell, to: '/admin/pc/notices' },
        { id: 'notifications', label: '푸시 알림 발송', icon: Zap, to: '/admin/pc/notifications' },
      ]
    }
  ];

  const currentCategoryObj = navCategories.find(cat => cat.id === activeDropdown);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground select-text overflow-x-hidden relative" ref={dropdownRef}>
      {/* Enterprise Portal Top Header */}
      <header className="bg-[#091326] text-white shadow-xl z-50 shrink-0 border-b border-white/10 no-print">
        {/* Top Brand & User Bar */}
        <div className="max-w-[1700px] mx-auto px-6 h-16 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-4">
            <div 
              onClick={() => navigate('/admin/pc-dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center p-2 group-hover:scale-105 transition-all">
                <CompanyLogo className="w-full h-full" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-base tracking-tight text-white leading-none">건명기업 (중형선조립)</span>
                <span className="text-[10px] font-bold text-cyan-400 mt-1 tracking-widest uppercase">SMART MARINE PORTAL</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-black text-slate-400">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
              <span className="text-sm font-black text-white">{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="w-10 h-10 bg-slate-800 rounded-xl overflow-hidden ring-2 ring-white/20">
                <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} alt="profile" className="w-full h-full object-cover" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-black text-white leading-tight">{profile?.displayName || '관리자'}</span>
                <span className="text-[10px] font-bold text-blue-400">
                  {profile?.role === 'CEO' ? '대표이사' : profile?.role === 'SAFETY_MANAGER' ? '안전관리자' : '운영관리자'}
                </span>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-xl transition-all text-xs font-bold cursor-pointer border border-white/10"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>

        {/* Horizontal Category Navigation Bar */}
        <div className="max-w-[1700px] mx-auto px-6 flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
          {navCategories.map((cat) => {
            const isCategoryActive = activeDropdown === cat.id || cat.items.some(it => Boolean(it.to) && location.pathname === it.to!.split('?')[0]);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveDropdown(activeDropdown === cat.id ? null : cat.id)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isCategoryActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{cat.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === cat.id ? 'rotate-180' : ''}`} />
              </button>
            );
          })}
        </div>
      </header>

      {/* Dropdown Sub-menu Panel (Matching Reference Enterprise Design) */}
      {activeDropdown && currentCategoryObj && (
        <div className="bg-card border-b border-border shadow-2xl z-40 no-print animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-[1700px] mx-auto px-8 py-6 flex flex-col md:flex-row gap-8 items-start">
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-6 shrink-0">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-2.5 py-1 rounded-full mb-2 inline-block">
                NAVIGATION FOLDER
              </span>
              <h3 className="text-xl font-black text-foreground tracking-tight">{currentCategoryObj.label}</h3>
              <p className="text-xs font-bold text-muted-foreground mt-1">하위 관제 및 관리 메뉴를 선택하세요.</p>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full">
              {currentCategoryObj.items
                .filter(item => !item.requiresCEO || isCEO)
                .map(item => {
                  if (item.onClick) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          item.onClick?.();
                          setActiveDropdown(null);
                        }}
                        className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/50 hover:bg-muted border border-border/60 hover:border-primary/50 transition-all text-left group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <item.icon className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                      </button>
                    );
                  }
                  const itemPath = (item.to || '').split('?')[0];
                  const itemQuery = (item.to || '').split('?')[1] || '';
                  const searchParams = new URLSearchParams(location.search);
                  const hasTabParam = itemQuery.includes('tab=');
                  const isTabActive = hasTabParam
                    ? searchParams.get('tab') === new URLSearchParams(itemQuery).get('tab')
                    : !searchParams.get('tab');
                  const isItemActive = Boolean(item.to) && location.pathname === itemPath && isTabActive;
                  return (
                    <Link
                      key={item.id}
                      to={item.to || '/admin/pc-dashboard'}
                      onClick={() => setActiveDropdown(null)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group ${
                        isItemActive
                          ? 'bg-primary/10 border-primary/50 text-primary shadow-sm'
                          : 'bg-muted/50 hover:bg-muted border-border/60 hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                        isItemActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                      }`}>
                        <item.icon className="w-4.5 h-4.5" />
                      </div>
                      <span className={`text-xs font-black transition-colors ${
                        isItemActive ? 'text-primary' : 'text-foreground group-hover:text-primary'
                      }`}>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
        {/* Page Title Bar */}
        <div className="bg-card/60 backdrop-blur-md border-b border-border px-8 py-5 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-foreground tracking-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span>건명기업 관리자 포털</span>
            <span>/</span>
            <span className="text-foreground font-black">{title}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-10 custom-scrollbar flex-1 bg-background/50">
          {children}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); }

        @media print {
          header, nav, .no-print, button, [class*="no-print"] {
            display: none !important;
          }
        }
      `}</style>
      <CriticalIncidentAlertCenter />
    </div>
  );
};

export default PCAdminLayout;
