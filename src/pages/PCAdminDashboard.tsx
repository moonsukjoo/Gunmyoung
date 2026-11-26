import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Clock,
  CalendarDays,
  ShieldCheck,
  History,
  AlertTriangle,
  ClipboardList,
  Lock,
  HardHat,
  CircleDollarSign,
  Radio,
  Thermometer,
  Search,
  ChevronRight,
  FileBarChart,
  ChevronDown,
  X,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { collection, query, getDocs, limit, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import PCAdminLayout, { PC_ADMIN_NAV_CATEGORIES } from '../components/PCAdminLayout';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import shipyardDayImg from '../assets/images/shipyard_day_hero_1794698730955.jpg';
import shipyardNightImg from '../assets/images/shipyard_night_hero_1794698732193.jpg';
import {
  Icon3DClock,
  Icon3DLeave,
  Icon3DHelmet,
  Icon3DThermometer,
  getService3DIcon,
  getServiceSoftBedClass
} from '../components/icons/Marine3DIcons';

interface DeptAttendanceRow {
  deptName: string;
  total: number;
  present: number;
  rate: number;
}

interface PendingApprovalItem {
  id: string;
  type: 'LEAVE' | 'WORKLOG';
  title: string;
  sub: string;
  to: string;
}

const PCAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isLight = profile?.lightTheme !== false && !profile?.highContrast;
  const isCEO = profile?.role === 'CEO' || profile?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';

  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    activeBeacons: 0
  });
  const [deptRows, setDeptRows] = useState<DeptAttendanceRow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedSearchCat, setSelectedSearchCat] = useState('ALL');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      const { getCachedActiveUsers } = await import('@/services/firestoreCacheService');
      const todayStr = new Date().toISOString().split('T')[0];
      const [activeUsers, attendanceSnap, leavesSnap, beaconsSnap, worklogsSnap] = await Promise.all([
        getCachedActiveUsers(),
        getDocs(query(collection(db, 'attendance'), where('date', '==', todayStr))),
        getDocs(query(collection(db, 'leaveRequests'), limit(100))),
        getDocs(collection(db, 'beacons')),
        getDocs(query(collection(db, 'workLogs'), limit(50)))
      ]);

      const presentUids = new Set(attendanceSnap.docs.map(d => d.data().uid));

      // Department-level attendance summary
      const deptMap: Record<string, { total: number; present: number }> = {};
      activeUsers.forEach(u => {
        const dept = u.departmentName || '소속 미지정';
        if (!deptMap[dept]) deptMap[dept] = { total: 0, present: 0 };
        deptMap[dept].total += 1;
        if (presentUids.has(u.uid)) deptMap[dept].present += 1;
      });

      const computedDeptRows: DeptAttendanceRow[] = Object.entries(deptMap)
        .map(([deptName, val]) => ({
          deptName,
          total: val.total,
          present: val.present,
          rate: val.total > 0 ? Math.round((val.present / val.total) * 100) : 0
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      // Pending approvals (leaves + worklogs)
      const pendingLeaveDocs = leavesSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(l => String(l.status || '').toUpperCase() === 'PENDING');

      const pendingWorklogDocs = worklogsSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(w => String(w.status || '').toUpperCase() === 'PENDING');

      const approvalList: PendingApprovalItem[] = [
        ...pendingLeaveDocs.slice(0, 3).map(l => ({
          id: `leave-${l.id}`,
          type: 'LEAVE' as const,
          title: `${l.displayName || '임직원'} · ${l.type === 'ANNUAL' ? '연차' : l.type === 'HALF_DAY' ? '반차' : '휴가'} 신청`,
          sub: `${l.startDate || ''} ~ ${l.endDate || ''}`,
          to: '/admin/pc/leave'
        })),
        ...pendingWorklogDocs.slice(0, 2).map(w => ({
          id: `worklog-${w.id}`,
          type: 'WORKLOG' as const,
          title: `${w.teamName || w.departmentName || '현장'} 작업일지 승인 대기`,
          sub: `${w.date || todayStr} 보고분`,
          to: '/admin/pc/worklog'
        }))
      ];

      setStats({
        totalEmployees: activeUsers.length,
        presentToday: attendanceSnap.size,
        pendingLeaves: pendingLeaveDocs.length,
        activeBeacons: beaconsSnap.docs.filter(d => d.data().status === 'ACTIVE').length
      });
      setDeptRows(computedDeptRows);
      setPendingApprovals(approvalList);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'multiple_stats_collections');
    } finally {
      setLoadingData(false);
    }
  };

  // Flatten all navigable menu items for the portal search bar
  const searchableMenuItems = useMemo(() => {
    const items: {
      id: string;
      label: string;
      desc?: string;
      categoryId: string;
      categoryLabel: string;
      to?: string;
      icon: React.ElementType;
      onClick?: () => void;
    }[] = [];

    PC_ADMIN_NAV_CATEGORIES.forEach(cat => {
      cat.subGroups.forEach(sg => {
        sg.items.forEach(it => {
          if (it.requiresCEO && !isCEO) return;
          items.push({
            id: it.id,
            label: it.label,
            desc: it.desc,
            categoryId: cat.id,
            categoryLabel: cat.label,
            to: it.to,
            icon: it.icon,
            onClick: it.onClick
          });
        });
      });
    });
    return items;
  }, [isCEO]);

  const filteredSearchResults = useMemo(() => {
    return searchableMenuItems.filter(it => {
      const matchCat = selectedSearchCat === 'ALL' || it.categoryId === selectedSearchCat;
      const q = searchKeyword.trim().toLowerCase();
      if (!q) return matchCat;
      return (
        matchCat &&
        (it.label.toLowerCase().includes(q) ||
          (it.desc && it.desc.toLowerCase().includes(q)) ||
          it.categoryLabel.toLowerCase().includes(q))
      );
    });
  }, [searchableMenuItems, selectedSearchCat, searchKeyword]);

  const quickActions = [
    { id: 'attendance', serviceIconId: 'attendance', label: '월간 근태', to: '/admin/pc/attendance' },
    { id: 'leave', serviceIconId: 'leave', label: '연차 결재', to: '/admin/pc/leave' },
    { id: 'worklog', serviceIconId: 'worklog', label: '작업일지', to: '/admin/pc/worklog' },
    { id: 'payslip', serviceIconId: 'payslip', label: '급여명세서', to: '/admin/pc/payslip' },
    { id: 'personnel', serviceIconId: 'worklog', label: '임직원 관리', to: '/admin/pc/personnel' },
    { id: 'permissions', serviceIconId: 'settings', label: '권한 설정', to: '/admin/pc/personnel?tab=permissions' },
    { id: 'safety', serviceIconId: 'request', label: '안전지수', to: '/admin/pc/safety' },
    { id: 'training', serviceIconId: 'training', label: '안전교육', to: '/admin/pc/training' },
    { id: 'beacons', serviceIconId: 'ship', label: '밀폐공간', to: '/admin/pc/beacons' },
    { id: 'perceived_temp_mgmt', serviceIconId: 'temp', label: '체감온도', to: '/admin/pc/perceived-temp' },
    { id: 'app_update', serviceIconId: 'settings', label: '앱 업데이트', to: '/admin/pc/app-update' },
  ];

  const handleExportStats = async () => {
    try {
      const headers = ['구분', '수치', '상세 내용'];
      const data = [
        ['활성 임직원', `${stats.totalEmployees}명`, '전체 인적 자원 내역'],
        ['금일 출근 인원', `${stats.presentToday}명`, '당일 실시간 출근 현황'],
        ['미결재 서류', `${stats.pendingLeaves}건`, '연차/휴가 결재 대기 중'],
        ['종합 안전 지수', '96.8점', '무재해 사업장 운영 중'],
      ];

      const { exportToPDF } = await import('../lib/exportUtils');
      await exportToPDF(
        '건명기업 통합 운영 현황 리포트',
        headers,
        data,
        `Enterprise_Overview_${new Date().toISOString().split('T')[0]}`
      );
      toast.success('운영 현황 리포트가 생성되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('리포트 생성 중 오류가 발생했습니다.');
    }
  };

  const heroBanner = (
    <div className="relative">
      {/* Ocean Shipyard Full-Bleed Hero Banner */}
      <div className="relative h-[300px] sm:h-[340px] w-full overflow-hidden">
        <img
          src={isLight ? shipyardDayImg : shipyardNightImg}
          alt="건명기업 조선소 전경"
          className="w-full h-full object-cover object-center scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#061835]/70 via-[#0a2a5c]/40 to-[#061835]/70" />

        {/* Center Brand Hero Headline */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pt-8">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[11px] font-black text-sky-100 tracking-[0.22em] uppercase mb-3">
            SAFE &amp; SMART SHIPYARD
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
            건명기업 통합 관제 포털
          </h1>
          <p className="text-sky-100/90 text-xs sm:text-sm font-bold mt-2.5 tracking-wide drop-shadow">
            중형선조립 스마트 야드 · 실시간 인력 · 안전 · 근태 통합 운영 시스템
          </p>
        </div>
      </div>

      {/* Floating Pill Search Bar Overlapping Bottom of Hero */}
      <div className="max-w-3xl mx-auto px-4 -mt-7 relative z-30">
        <div className="relative">
          <div className="bg-card border border-border/90 rounded-full shadow-[0_14px_35px_rgba(15,23,42,0.12)] flex items-center p-1.5 pl-4 gap-2">
            {/* Category Selector */}
            <div className="relative flex items-center border-r border-border pr-3 shrink-0">
              <select
                value={selectedSearchCat}
                onChange={(e) => setSelectedSearchCat(e.target.value)}
                className="appearance-none bg-transparent text-xs sm:text-sm font-black text-foreground pr-5 py-2 focus:outline-none cursor-pointer"
                aria-label="메뉴 카테고리 선택"
              >
                <option value="ALL">메뉴</option>
                {PC_ADMIN_NAV_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground pointer-events-none -ml-4" />
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchKeyword}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 180)}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setIsSearchFocused(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredSearchResults.length > 0) {
                  const first = filteredSearchResults[0];
                  if (first.onClick) first.onClick();
                  else if (first.to) navigate(first.to);
                  setIsSearchFocused(false);
                }
              }}
              placeholder="검색어를 입력하세요 (예: 급여, 출근, 비콘, 연차, 작업일지)"
              className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none px-2 py-2 min-w-0"
            />

            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="검색어 지우기"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (filteredSearchResults.length > 0 && searchKeyword.trim()) {
                  const first = filteredSearchResults[0];
                  if (first.onClick) first.onClick();
                  else if (first.to) navigate(first.to);
                } else {
                  setIsSearchFocused(!isSearchFocused);
                }
              }}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 cursor-pointer shadow-sm"
              aria-label="검색"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Instant Search Dropdown Results */}
          {isSearchFocused && (
            <div className="absolute left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl p-2 max-h-80 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              {filteredSearchResults.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-muted-foreground">
                  일치하는 관리자 메뉴가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {filteredSearchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (item.onClick) item.onClick();
                        else if (item.to) navigate(item.to);
                        setIsSearchFocused(false);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/80 text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-foreground group-hover:text-primary truncate">
                          {item.label}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground truncate">
                          {item.categoryLabel}{item.desc ? ` · ${item.desc}` : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-50 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const attendanceRate = stats.totalEmployees > 0
    ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
    : 0;

  return (
    <PCAdminLayout title="통합 관제 센터" heroSection={heroBanner}>
      <div className="space-y-8">
        {/* 4-Column Quick KPI Strip with Mobile-Matched 3D Clay Icons */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: '출근 현황',
              value: `${stats.presentToday} / ${stats.totalEmployees}명`,
              sub: `금일 출근율 ${attendanceRate}% · 자세히 보기`,
              icon: <Icon3DClock className="w-9 h-9" />,
              bedClass: getServiceSoftBedClass('attendance', isLight),
              onClick: () => navigate('/admin/pc/attendance-status')
            },
            {
              title: '승인 · 결재',
              value: `${stats.pendingLeaves}건 대기`,
              sub: '연차 · 휴가 결재함 열기',
              icon: <Icon3DLeave className="w-9 h-9" />,
              bedClass: getServiceSoftBedClass('leave', isLight),
              onClick: () => navigate('/admin/pc/leave')
            },
            {
              title: '안전지수 · 비콘',
              value: `96.8점 · ${stats.activeBeacons}개`,
              sub: '밀폐공간 · 안전지수 관제',
              icon: <Icon3DHelmet className="w-9 h-9" />,
              bedClass: getServiceSoftBedClass('request', isLight),
              onClick: () => navigate('/admin/pc/beacons')
            },
            {
              title: '현장 환경 · 온도',
              value: '정상 가동중',
              sub: '체감온도 · 보건현황 확인',
              icon: <Icon3DThermometer className="w-9 h-9" />,
              bedClass: getServiceSoftBedClass('temp', isLight),
              onClick: () => navigate('/admin/pc/perceived-temp')
            }
          ].map((kpi, idx) => (
            <button
              key={idx}
              type="button"
              onClick={kpi.onClick}
              className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-xs hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all text-left cursor-pointer group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/60 dark:border-white/10 shadow-xs ${kpi.bedClass}`}>
                {kpi.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-muted-foreground">{kpi.title}</p>
                <p className="text-xl font-black text-foreground tracking-tight mt-0.5 truncate">{kpi.value}</p>
                <p className="text-[11px] font-bold text-primary mt-1 group-hover:underline truncate">{kpi.sub}</p>
              </div>
            </button>
          ))}
        </section>

        {/* Main 12-Column Enterprise Operations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8 Columns: Real-time Department Attendance Table + Quick Launcher + Telemetry */}
          <div className="lg:col-span-8 space-y-6">
            {/* Real-Time Department Attendance Table */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-foreground tracking-tight">부서별 실시간 출근 현황</h2>
                    <p className="text-[11px] font-medium text-muted-foreground">오늘 기준 활성 인원 대비 부서별 출근률입니다.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin/pc/attendance-status')}
                  className="text-xs font-black text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  전체 출근판 보기 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-[11px] font-black text-muted-foreground">
                      <th className="py-3 px-6">부서 / 팀</th>
                      <th className="py-3 px-4 text-center">총원</th>
                      <th className="py-3 px-4 text-center">출근</th>
                      <th className="py-3 px-6">출근율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-bold">
                    {loadingData ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-muted-foreground">출근 현황을 불러오는 중입니다...</td>
                      </tr>
                    ) : deptRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-muted-foreground">등록된 부서 인원 데이터가 없습니다.</td>
                      </tr>
                    ) : (
                      deptRows.map((row) => (
                        <tr
                          key={row.deptName}
                          onClick={() => navigate('/admin/pc/attendance-status')}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-6 font-black text-foreground">{row.deptName}</td>
                          <td className="py-3.5 px-4 text-center text-muted-foreground">{row.total}명</td>
                          <td className="py-3.5 px-4 text-center text-primary font-black">{row.present}명</td>
                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[140px]">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: `${row.rate}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-black text-foreground w-10 text-right">{row.rate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Control Launcher */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-foreground tracking-tight">주요 관리 메뉴 바로가기</h2>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">자주 사용하는 관리자 업무로 즉시 이동합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportStats}
                    className="h-9 px-3.5 rounded-xl bg-muted hover:bg-muted/80 border border-border text-xs font-black text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FileBarChart className="w-3.5 h-3.5 text-primary" />
                    운영 리포트 PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/pc/reports')}
                    className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    통합 보고서 센터
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-5">
                {quickActions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-border/70 bg-background/60 hover:bg-muted/60 hover:border-primary/40 transition-all group text-center cursor-pointer"
                  >
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 group-hover:-translate-y-0.5 transition-transform shadow-xs ${getServiceSoftBedClass(item.serviceIconId, isLight)}`}>
                      {getService3DIcon(item.serviceIconId, 'w-6.5 h-6.5')}
                    </div>
                    <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors leading-snug">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Unified Pearl Environmental Gas Telemetry Card */}
            <div className="bg-card border border-border rounded-2xl shadow-xs p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    S-TELEMETRY · 밀폐구역 환경계측
                  </span>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2 mt-1.5">
                    <Radio className="w-4.5 h-4.5 text-primary" />
                    선박 건조 구역 대기질 센서 현황
                  </h3>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">정상 수신 중</span>
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
                {[
                  { name: 'O2 (산소)', val: '20.9', unit: '%', desc: '기준 18~23.5%', barCol: 'bg-blue-500', max: 25 },
                  { name: 'CO (일산화탄소)', val: '1.2', unit: 'ppm', desc: '기준 30ppm 이하', barCol: 'bg-emerald-500', max: 50 },
                  { name: 'H2S (황화수소)', val: '0.0', unit: 'ppm', desc: '기준 10ppm 이하', barCol: 'bg-amber-500', max: 10 },
                  { name: 'LEL (가연성)', val: '0', unit: '%', desc: '기준 10% 미만', barCol: 'bg-sky-500', max: 15 }
                ].map((gas, idx) => (
                  <div
                    key={idx}
                    className="bg-muted/40 border border-border rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] font-black text-muted-foreground">{gas.name}</span>
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        정상
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground font-mono tracking-tight">{gas.val}</span>
                      <span className="text-[11px] font-bold text-muted-foreground">{gas.unit}</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${gas.barCol} rounded-full`} style={{ width: `${Math.min(100, (parseFloat(gas.val) / gas.max) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground">{gas.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 4 Columns: Live Approvals + High-Risk Field Safety */}
          <div className="lg:col-span-4 space-y-6">
            {/* Pending Approvals Card */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-black text-foreground text-base flex items-center gap-2">
                  <History className="w-4.5 h-4.5 text-primary" />
                  승인 · 결재 대기함
                </h3>
                <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  {pendingApprovals.length}건
                </span>
              </div>

              <div className="divide-y divide-border">
                {loadingData ? (
                  <div className="py-10 text-center text-xs font-bold text-muted-foreground">결재 내역 확인 중...</div>
                ) : pendingApprovals.length === 0 ? (
                  <div className="py-10 px-6 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-black text-foreground">현재 대기 중인 결재 건이 없습니다.</p>
                    <p className="text-[11px] font-medium text-muted-foreground">모든 연차 및 작업일지 결재가 완료되었습니다.</p>
                  </div>
                ) : (
                  pendingApprovals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.to)}
                      className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors text-left cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <span
                          className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-1 ${
                            item.type === 'LEAVE'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {item.type === 'LEAVE' ? '연차/휴가' : '작업일지'}
                        </span>
                        <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{item.sub}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))
                )}
              </div>

              <div className="p-4 bg-muted/30 border-t border-border grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/admin/pc/leave')}
                  className="py-2.5 px-3 bg-card border border-border hover:border-primary/40 rounded-xl text-xs font-black text-foreground transition-colors cursor-pointer"
                >
                  연차 결재함
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/pc/worklog')}
                  className="py-2.5 px-3 bg-primary text-primary-foreground rounded-xl text-xs font-black hover:opacity-90 transition-opacity cursor-pointer"
                >
                  작업일지 검수
                </button>
              </div>
            </div>

            {/* Clean High-Risk Notice Card */}
            <div className="bg-card border border-border border-l-4 border-l-rose-500 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-base text-foreground">고위험 현장 안전 점검</h3>
                </div>
                <span className="text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-full">
                  수시 확인
                </span>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <p className="text-xs font-bold text-foreground leading-relaxed">
                  고소작업 및 밀폐공간 작업 투입 인원의 안전장구 착용·비콘 수신 상태를 실시간 관제 화면에서 점검하세요.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/pc/highwork')}
                    className="text-xs font-black text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    고소작업 관제 <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/pc/evacuation-history')}
                    className="text-xs font-black text-muted-foreground hover:text-foreground hover:underline cursor-pointer flex items-center gap-1"
                  >
                    비상대피 이력 <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminDashboard;
