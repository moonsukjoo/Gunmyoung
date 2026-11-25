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
  ChevronRight,
  X,
  Sun,
  Moon,
  Smartphone,
  ShieldAlert,
  CheckSquare,
  UserCheck,
  FileSpreadsheet,
  Award,
  DownloadCloud
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { CompanyLogo } from './CompanyLogo';
import { CriticalIncidentAlertCenter } from './CriticalIncidentAlertCenter';

interface PCAdminLayoutProps {
  children: React.ReactNode;
  title: string;
  heroSection?: React.ReactNode;
}

export interface NavLinkItem {
  id: string;
  label: string;
  desc?: string;
  icon: React.ElementType;
  to?: string;
  requiresCEO?: boolean;
  onClick?: () => void | any;
}

export interface NavSubGroup {
  id: string;
  label: string;
  items: NavLinkItem[];
}

export interface NavCategory {
  id: string;
  label: string;
  description: string;
  subGroups: NavSubGroup[];
}

export const PC_ADMIN_NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'dashboard',
    label: '종합관제',
    description: '건명기업 중형선조립 야드의 전체 출근·운영 현황과 통합 보고서를 확인합니다.',
    subGroups: [
      {
        id: 'dash_overview',
        label: '통합 관제 홈',
        items: [
          { id: 'dashboard_home', label: '통합 관제 대시보드', desc: '전체 인력 · 안전 · 환경 통합 뷰', icon: LayoutDashboard, to: '/admin/pc-dashboard' },
          { id: 'attendance_status', label: '실시간 출근 통합현황', desc: '부서별 출근자 및 미출근자 모니터링', icon: Clock, to: '/admin/pc/attendance-status' },
        ]
      },
      {
        id: 'dash_reports',
        label: '보고서 · 시스템 설정',
        items: [
          { id: 'unified_reports', label: '통합 보고서 센터', desc: '월간 근태·안전·작업일지 일괄 PDF/엑셀', icon: FileBarChart, to: '/admin/pc/reports' },
          { id: 'app_update', label: '앱 자동 업데이트 · 포인트 설정', desc: 'APK 자동 배포 및 출근 칭찬포인트 금액 관리', icon: DownloadCloud, to: '/admin/pc/app-update' },
        ]
      }
    ]
  },
  {
    id: 'field_gps',
    label: '실시간 현장·GPS',
    description: '야드 내 구역별 인력 체류, 밀폐·고소작업, 보건 및 비상 대피 현황을 실시간으로 관제합니다.',
    subGroups: [
      {
        id: 'field_dwell_ops',
        label: '7공장 블럭체류 · 인원관제',
        items: [
          { id: 'factory_dwell_blueprint', label: '블럭체류현황 · A3 도면', desc: '중형선 7공장 블럭별 체류 및 마우스 도면 배치', icon: Layers, to: '/admin/pc/factory-dwell', requiresCEO: true },
          { id: 'factory_dwell_checklist', label: '블럭별 투입 인원 체크리스트', desc: '매일 블럭별 투입 인원 넣기 / 빼기 체크', icon: CheckSquare, to: '/admin/pc/factory-dwell?tab=CHECKLIST', requiresCEO: true },
          { id: 'factory_dwell_log', label: '체류시간 감리 집계표', desc: '누가 어디 블록에 몇 시간 몇 분 체류했는가', icon: FileSpreadsheet, to: '/admin/pc/factory-dwell?tab=DWELL_LOG', requiresCEO: true },
          { id: 'factory_dwell_individual', label: '작업자 개인별 상세 기록', desc: '개인별 타임슬롯 이동 경로 및 일별 이력', icon: UserCheck, to: '/admin/pc/factory-dwell?tab=INDIVIDUAL', requiresCEO: true },
        ]
      },
      {
        id: 'field_dwell_plan_gps',
        label: '7공장 공정 · 지연 · GPS 설정',
        items: [
          { id: 'factory_dwell_schedule', label: '블럭별 계획기간 · 공수 통계', desc: '시작~마감일 일정 및 투입 인원·공수 집계', icon: CalendarDays, to: '/admin/pc/factory-dwell?tab=SCHEDULE', requiresCEO: true },
          { id: 'factory_dwell_delay', label: '공정 지연 크리티컬 기록지', desc: '공정 지연 핵심 사유 및 만회 대책 누적 기록', icon: ShieldAlert, to: '/admin/pc/factory-dwell?tab=DELAY', requiresCEO: true },
          { id: 'factory_dwell_gps_setup', label: '동서남북 GPS 기준 · 좌표 산출', desc: '7공장 4방위 기준점 등록 및 정반 블럭 좌표 산출', icon: Compass, to: '/admin/pc/factory-dwell?tab=GPS_SETUP', requiresCEO: true },
          {
            id: 'gps_debug',
            label: '실시간 GPS 좌표 점검',
            desc: '현장 GPS 수신 상태 및 경계 디버깅',
            icon: Activity,
            onClick: () => window.dispatchEvent(new CustomEvent('secret-gps-debug-control', { detail: { mode: 'EXPANDED' } })),
            requiresCEO: true
          },
        ]
      },
      {
        id: 'field_highrisk',
        label: '고소 · 밀폐공간 관제',
        items: [
          { id: 'highwork', label: '고소작업 실시간 관제', desc: '고소작업 승인 및 현장 센서 상태', icon: BarChart3, to: '/admin/pc/highwork' },
          { id: 'beacons', label: '밀폐공간 비콘 위치관제', desc: '밀폐구역 진입 인원 및 비콘 상태', icon: Radio, to: '/admin/pc/beacons' },
        ]
      },
      {
        id: 'field_health',
        label: '보건 · 체감온도 · 대피',
        items: [
          { id: 'perceived_temp_mgmt', label: '실시간 체감온도 관제', desc: '폭염·한파 작업환경 온열지수 관리', icon: Thermometer, to: '/admin/pc/perceived-temp' },
          { id: 'health_reports_status', label: '실시간 보건현황', desc: '근로자 일일 건강체크 이상무 현황', icon: Activity, to: '/admin/pc/health-mgmt' },
          { id: 'evacuation_history', label: '비상 대피 · 롤콜 이력', desc: '화재·비상 대피 인원 점검 이력', icon: History, to: '/admin/pc/evacuation-history' },
        ]
      }
    ]
  },
  {
    id: 'hr_attendance',
    label: '근태·인사',
    description: '임직원 인사정보, 월간 근태, 연차 결재 및 현장 작업일지를 체계적으로 관리합니다.',
    subGroups: [
      {
        id: 'hr_att_leave',
        label: '근태 · 연차 결재',
        items: [
          { id: 'attendance', label: '월간 근태 현황 총괄', desc: '일별·월별 출퇴근 및 연장근무 집계', icon: Clock, to: '/admin/pc/attendance' },
          { id: 'leave', label: '연차 · 휴가 결재', desc: '휴가 신청 승인 및 잔여 연차 관리', icon: CalendarDays, to: '/admin/pc/leave' },
          { id: 'worklog', label: '작업일지 총괄 관리', desc: '현장 조업 일지 검수 및 승인', icon: ClipboardList, to: '/admin/pc/worklog' },
        ]
      },
      {
        id: 'hr_people',
        label: '임직원 · 권한 설정',
        items: [
          { id: 'personnel', label: '임직원 정보 관리', desc: '사원 등록, 부서/직급 및 상태 관리', icon: Users, to: '/admin/pc/personnel' },
          { id: 'permissions', label: '사용자 권한 설정', desc: '관리자 메뉴 접근 및 결재 권한 부여', icon: Lock, to: '/admin/pc/personnel?tab=permissions' },
        ]
      }
    ]
  },
  {
    id: 'welfare_salary',
    label: '급여·복지',
    description: '급여명세서 일괄 발행 및 임직원 안전 포상·칭찬쿠폰·현물 보상을 운영합니다.',
    subGroups: [
      {
        id: 'welfare_pay',
        label: '급여 · 정산 관리',
        items: [
          { id: 'payslip', label: '급여명세서 중앙 발행', desc: '급여 내역 업로드 및 개별 발송', icon: CircleDollarSign, to: '/admin/pc/payslip' },
        ]
      },
      {
        id: 'welfare_reward',
        label: '안전 포상 · 쿠폰 · 현물',
        items: [
          { id: 'coupons', label: '안전 포상 · 칭찬쿠폰', desc: '칭찬포인트 지급 및 룰렛 관리', icon: Trophy, to: '/admin/pc/coupons' },
          { id: 'coupons_by_employee', label: '사원별 칭찬쿠폰 관리', desc: '사원별 상세 칭찬쿠폰 내역 및 포인트 직접 수정', icon: Award, to: '/admin/pc/coupons-by-employee' },
          { id: 'redemption', label: '포상 현물 신청 관리', desc: '복지 포인트 현물 교환 승인', icon: Settings, to: '/admin/pc/redemption' },
        ]
      }
    ]
  },
  {
    id: 'safety_notice',
    label: '안전·교육·공지',
    description: '전사 안전지수 평가, 법정 의무교육 이수 현황 및 긴급 공지·푸시 알림을 전파합니다.',
    subGroups: [
      {
        id: 'safety_edu',
        label: '안전지수 · 법정교육',
        items: [
          { id: 'safety', label: '안전지수 종합 관리', desc: '부서/개인별 안전 가점·감점 관리', icon: ShieldCheck, to: '/admin/pc/safety' },
          { id: 'training', label: '법정 안전교육 제어실', desc: '교육 자료 배포 및 이수 서명 관리', icon: HardHat, to: '/admin/pc/training' },
        ]
      },
      {
        id: 'safety_comm',
        label: '전사 공지 · 푸시 알림',
        items: [
          { id: 'notice', label: '전사 공지사항 관리', desc: '공지 등록 및 중요 알림 게시', icon: Bell, to: '/admin/pc/notices' },
          { id: 'notifications', label: '푸시 알림 일괄 발송', desc: '전 직원 및 특정 부서 즉시 알림', icon: Zap, to: '/admin/pc/notifications' },
        ]
      }
    ]
  }
];

const PCAdminLayout: React.FC<PCAdminLayoutProps> = ({ children, title, heroSection }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeSubGroupId, setActiveSubGroupId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLight = profile?.lightTheme !== false && !profile?.highContrast;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  useEffect(() => {
    setActiveDropdown(null);
  }, [location.pathname, location.search]);

  const handleToggleTheme = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        lightTheme: !isLight
      });
    } catch (err) {
      console.error('Theme toggle failed:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const safeTrim = (v: unknown) => (v == null ? '' : String(v)).trim();
  const safeLower = (v: unknown) => safeTrim(v).toLowerCase();

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'TEAM_LEADER', 'WORKER'].includes(safeTrim(profile.role).toUpperCase()) ||
    ['조장', '반장', '사원'].includes(safeTrim(profile.position)) ||
    safeLower(profile.employeeId).includes('x66626') ||
    safeLower(profile.displayName).includes('x66626') ||
    safeLower(profile.email).includes('x66626') ||
    safeLower(user?.email).includes('x66626') ||
    safeLower(user?.email).split('@')[0] === 'x66626' ||
    safeLower(user?.email).startsWith('x66626@') ||
    safeLower(user?.displayName).includes('x66626')
  );

  if (isExcludedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-10">
        <div className="max-w-md w-full bg-card p-10 rounded-3xl shadow-xl text-center border border-border">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-foreground mb-4">접근 권한이 없습니다</h1>
          <p className="text-muted-foreground font-medium mb-8">
            관리자 전용 페이지입니다. 일반 사원 계정인 {profile?.displayName}님은 이 페이지에 접근할 수 없습니다.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm hover:opacity-90 transition-all cursor-pointer"
          >
            메인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const isCEO = profile?.role === 'CEO' || profile?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';

  const handleOpenCategory = (cat: NavCategory) => {
    if (activeDropdown === cat.id) {
      setActiveDropdown(null);
      return;
    }
    setActiveDropdown(cat.id);
    // Select subgroup matching current route if possible, otherwise first subgroup
    const matchedGroup = cat.subGroups.find(sg =>
      sg.items.some(it => it.to && location.pathname === it.to.split('?')[0])
    );
    setActiveSubGroupId(matchedGroup?.id || cat.subGroups[0]?.id || null);
  };

  const currentCategoryObj = PC_ADMIN_NAV_CATEGORIES.find(cat => cat.id === activeDropdown);
  const currentSubGroupObj =
    currentCategoryObj?.subGroups.find(sg => sg.id === activeSubGroupId) ||
    currentCategoryObj?.subGroups[0];

  const activeCategoryForBreadcrumb = PC_ADMIN_NAV_CATEGORIES.find(cat =>
    cat.subGroups.some(sg => sg.items.some(it => it.to && location.pathname === it.to.split('?')[0]))
  );

  const isOverlayHeader = Boolean(heroSection) && !activeDropdown;

  const roleLabel =
    profile?.role === 'CEO'
      ? '대표이사'
      : profile?.role === 'DIRECTOR'
      ? '이사/직장'
      : profile?.role === 'GENERAL_MANAGER'
      ? '부장'
      : profile?.role === 'SAFETY_MANAGER'
      ? '안전관리자'
      : '운영관리자';

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground select-text overflow-x-hidden relative" ref={dropdownRef}>
      {/* Enterprise Top Navigation Header */}
      <header
        className={`z-50 transition-all duration-200 no-print ${
          isOverlayHeader
            ? 'absolute top-0 inset-x-0 bg-gradient-to-b from-[#07142b]/80 via-[#07142b]/40 to-transparent text-white'
            : 'sticky top-0 bg-card/95 backdrop-blur-md text-foreground border-b border-border shadow-xs'
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Logo */}
          <button
            type="button"
            onClick={() => navigate('/admin/pc-dashboard')}
            className="flex items-center gap-3 shrink-0 cursor-pointer group text-left"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center p-1.5 transition-transform group-hover:scale-105 ${
                isOverlayHeader
                  ? 'bg-white/15 border border-white/25 backdrop-blur-sm'
                  : 'bg-primary/10 border border-primary/20'
              }`}
            >
              <CompanyLogo className="w-full h-full" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className={`font-black text-base tracking-tight leading-none ${isOverlayHeader ? 'text-white' : 'text-foreground'}`}>
                건명기업
              </span>
              <span className={`text-[10px] font-bold mt-1 tracking-wider ${isOverlayHeader ? 'text-sky-200' : 'text-muted-foreground'}`}>
                중형선조립 통합 포털
              </span>
            </div>
          </button>

          {/* Center: Clean Horizontal Menu Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar h-full">
            {PC_ADMIN_NAV_CATEGORIES.map((cat) => {
              const isRouteInCategory = cat.subGroups.some(sg =>
                sg.items.some(it => Boolean(it.to) && location.pathname === it.to!.split('?')[0])
              );
              const isOpen = activeDropdown === cat.id;
              const isHighlighted = isOpen || (!activeDropdown && isRouteInCategory);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleOpenCategory(cat)}
                  className={`relative h-full px-3 sm:px-4 flex items-center text-xs sm:text-[13px] font-black whitespace-nowrap transition-colors cursor-pointer ${
                    isOverlayHeader
                      ? isHighlighted
                        ? 'text-white'
                        : 'text-white/80 hover:text-white'
                      : isHighlighted
                      ? 'text-primary'
                      : 'text-foreground/75 hover:text-foreground'
                  }`}
                >
                  <span>{cat.label}</span>
                  {isHighlighted && (
                    <span
                      className={`absolute bottom-0 inset-x-2 h-[3px] rounded-t-full ${
                        isOverlayHeader ? 'bg-white' : 'bg-primary'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Utilities, Theme Toggle, Mobile View, Profile, Close/Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleTheme}
              title={isLight ? '야간(다크) 모드로 전환' : '주간(라이트) 모드로 전환'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                isOverlayHeader
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                  : 'bg-muted/70 hover:bg-muted text-foreground border border-border'
              }`}
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              title="모바일 홈으로 이동"
              className={`hidden md:flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                isOverlayHeader
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                  : 'bg-muted/70 hover:bg-muted text-foreground border border-border'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>모바일</span>
            </button>

            <div
              className={`hidden lg:flex items-center gap-2.5 pl-2.5 pr-3 py-1 rounded-full border ${
                isOverlayHeader
                  ? 'bg-white/15 border-white/20 text-white backdrop-blur-sm'
                  : 'bg-muted/50 border-border text-foreground'
              }`}
            >
              <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 shrink-0">
                <img
                  src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
                  alt="profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs font-black">
                {profile?.displayName || '관리자'} · {roleLabel}
              </span>
            </div>

            {activeDropdown ? (
              <button
                type="button"
                onClick={() => setActiveDropdown(null)}
                aria-label="메뉴 닫기"
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                title="로그아웃"
                className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  isOverlayHeader
                    ? 'bg-white/10 hover:bg-rose-500/80 text-white border border-white/15'
                    : 'bg-muted/70 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground border border-border'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Column Hierarchical Enterprise Mega-Menu Panel (Reference Photo #1) */}
        {activeDropdown && currentCategoryObj && (
          <div className="bg-card text-foreground border-t border-b border-border shadow-2xl animate-in slide-in-from-top-1 duration-150">
            <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Column 1: Category Title & Subtitle */}
              <div className="md:col-span-3 space-y-2 md:pr-6">
                <span className="inline-block text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  SMART MARINE MENU
                </span>
                <h3 className="text-2xl font-black text-foreground tracking-tight">
                  {currentCategoryObj.label}
                </h3>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  {currentCategoryObj.description}
                </p>
              </div>

              {/* Column 2: Sub-groups with chevron arrow */}
              <div className="md:col-span-4 border-y md:border-y-0 md:border-x border-border py-3 md:py-0 md:px-6 space-y-1">
                {currentCategoryObj.subGroups.map((sg) => {
                  const visibleItems = sg.items.filter(it => !it.requiresCEO || isCEO);
                  if (visibleItems.length === 0) return null;
                  const isGroupSelected = currentSubGroupObj?.id === sg.id;

                  return (
                    <button
                      key={sg.id}
                      type="button"
                      onMouseEnter={() => setActiveSubGroupId(sg.id)}
                      onClick={() => setActiveSubGroupId(sg.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                        isGroupSelected
                          ? 'bg-primary/10 text-primary font-black'
                          : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      <span>{sg.label}</span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isGroupSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground'}`} />
                    </button>
                  );
                })}
              </div>

              {/* Column 3: Direct Screen Links for Selected Sub-group */}
              <div className="md:col-span-5 space-y-1.5">
                {currentSubGroupObj?.items
                  .filter(it => !it.requiresCEO || isCEO)
                  .map((item) => {
                    const itemPath = (item.to || '').split('?')[0];
                    const itemQuery = (item.to || '').split('?')[1] || '';
                    const searchParams = new URLSearchParams(location.search);
                    const hasTabParam = itemQuery.includes('tab=');
                    const currentTab = searchParams.get('tab');
                    const isTabActive = hasTabParam
                      ? currentTab === new URLSearchParams(itemQuery).get('tab')
                      : !currentTab || currentTab === 'BLUEPRINT';
                    const isItemActive = Boolean(item.to) && location.pathname === itemPath && isTabActive;

                    if (item.onClick) {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            item.onClick?.();
                            setActiveDropdown(null);
                          }}
                          className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl hover:bg-muted/80 transition-all text-left group cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <item.icon className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                              {item.label}
                            </p>
                            {item.desc && (
                              <p className="text-[11px] font-medium text-muted-foreground truncate">
                                {item.desc}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        to={item.to || '/admin/pc-dashboard'}
                        onClick={() => setActiveDropdown(null)}
                        className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all group ${
                          isItemActive
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/80 text-foreground'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isItemActive
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                          }`}
                        >
                          <item.icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-black transition-colors ${
                              isItemActive ? 'text-primary' : 'text-foreground group-hover:text-primary'
                            }`}
                          >
                            {item.label}
                          </p>
                          {item.desc && (
                            <p className="text-[11px] font-medium text-muted-foreground truncate">
                              {item.desc}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Dimmed Backdrop when Mega-Menu is Open */}
      {activeDropdown && (
        <div
          className="fixed inset-0 top-16 bg-slate-950/35 backdrop-blur-[2px] z-40 transition-opacity no-print"
          onClick={() => setActiveDropdown(null)}
        />
      )}

      {/* Optional Hero Banner Slot (Used on PCAdminDashboard) */}
      {heroSection && <div className="w-full relative">{heroSection}</div>}

      {/* Clean Sub-Page Header Bar (Shown on sub-pages without Hero) */}
      {!heroSection && (
        <div className="bg-card/80 backdrop-blur-sm border-b border-border px-4 sm:px-8 py-5 no-print">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                <Link to="/admin/pc-dashboard" className="hover:text-primary transition-colors">
                  건명기업 통합 포털
                </Link>
                {activeCategoryForBreadcrumb && (
                  <>
                    <span>/</span>
                    <span>{activeCategoryForBreadcrumb.label}</span>
                  </>
                )}
                <span>/</span>
                <span className="text-primary font-black">{title}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">{title}</h1>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/60 px-3.5 py-1.5 rounded-full border border-border">
              <span>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-7 sm:py-9">
        {children}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.12); border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.22); }

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
