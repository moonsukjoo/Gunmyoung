import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CalendarDays,
  ShieldCheck,
  Activity,
  Bell,
  Plus,
  Megaphone,
  ShieldAlert,
  Info,
  Ship,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
  Building2,
  ListTodo,
  CheckCircle,
  Users,
  AlertTriangle,
  ClipboardList,
  Heart,
  Sparkles,
  Trophy,
  Crown,
  Medal,
  User as UserIcon,
  FileBox,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  MapPin,
  RefreshCw,
  FileBarChart,
  Utensils,
  Lock,
  Thermometer,
  Ticket,
  Wallet,
  Volume2,
  MessageSquare,
  Settings2,
  Pin,
  PinOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  Receipt,
  Flame,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Radio
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, limit, orderBy, getDocs, Timestamp, setDoc } from 'firebase/firestore';
import { Attendance, Notice, Role, AccidentCase, LeaveRequest, Task, UserProfile } from '@/types';
import { format, startOfMonth, subMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { grantRandomShipPart } from '@/services/shipService';
import { sendPushNotification, requestNotificationPermission } from '@/services/notificationService';
import { calculateAttendanceHours } from '@/lib/attendance';
import { checkIsSpecialDay } from '@/lib/holidays';
import { useSafetySensor } from '@/components/SafetySensorProvider';
import { useAutoAttendance } from '@/components/AutoAttendanceProvider';
import { DashboardStatusBar } from '@/components/dashboard/DashboardStatusBar';
import { AttendanceHubCard } from '@/components/dashboard/AttendanceHubCard';
import { ServicesHub } from '@/components/dashboard/ServicesHub';
import { DailyBriefingCard } from '@/components/dashboard/DailyBriefingCard';

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { AlertSoundPlayer } from '../lib/sound';

export interface ShortcutOption {
  id: string;
  label: string;
  sublabel: string;
  path: string;
  icon: React.ElementType;
  colorName: string;
  gradientBg: string;
  borderColor: string;
  hoverBorderColor: string;
  hoverBg: string;
  iconBg: string;
  shadowColor: string;
  iconColor: string;
  category: string;
}

export const ALL_SHORTCUT_OPTIONS: ShortcutOption[] = [
  {
    id: 'attendance',
    label: '출퇴근',
    sublabel: '근태 관리',
    path: '/attendance',
    icon: Clock,
    colorName: 'blue',
    gradientBg: 'from-blue-500/10 via-blue-500/5 to-card',
    borderColor: 'border-blue-500/20',
    hoverBorderColor: 'hover:border-blue-500/40',
    hoverBg: 'hover:bg-blue-500/15',
    iconBg: 'bg-blue-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(59,130,246,0.15)]',
    iconColor: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    category: '근태/인사'
  },
  {
    id: 'leave',
    label: '연차신청',
    sublabel: '휴가 결재',
    path: '/leave',
    icon: CalendarDays,
    colorName: 'indigo',
    gradientBg: 'from-indigo-500/10 via-indigo-500/5 to-card',
    borderColor: 'border-indigo-500/20',
    hoverBorderColor: 'hover:border-indigo-500/40',
    hoverBg: 'hover:bg-indigo-500/15',
    iconBg: 'bg-indigo-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(99,102,241,0.15)]',
    iconColor: 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
    category: '근태/인사'
  },
  {
    id: 'health',
    label: '건강체크',
    sublabel: '상태 진단',
    path: '/health-mgmt',
    icon: Activity,
    colorName: 'rose',
    gradientBg: 'from-rose-500/10 via-rose-500/5 to-card',
    borderColor: 'border-rose-500/20',
    hoverBorderColor: 'hover:border-rose-500/40',
    hoverBg: 'hover:bg-rose-500/15',
    iconBg: 'bg-rose-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(244,63,94,0.15)]',
    iconColor: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
    category: '안전/보건'
  },
  {
    id: 'worklog',
    label: '작업일지',
    sublabel: '일일 기록',
    path: '/work-log',
    icon: ClipboardList,
    colorName: 'amber',
    gradientBg: 'from-amber-500/10 via-amber-500/5 to-card',
    borderColor: 'border-amber-500/20',
    hoverBorderColor: 'hover:border-amber-500/40',
    hoverBg: 'hover:bg-amber-500/15',
    iconBg: 'bg-amber-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(245,158,11,0.15)]',
    iconColor: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
    category: '업무/작업'
  },
  {
    id: 'notices',
    label: '전사공지',
    sublabel: '중요 알림',
    path: '/notices',
    icon: Megaphone,
    colorName: 'sky',
    gradientBg: 'from-sky-500/10 via-sky-500/5 to-card',
    borderColor: 'border-sky-500/20',
    hoverBorderColor: 'hover:border-sky-500/40',
    hoverBg: 'hover:bg-sky-500/15',
    iconBg: 'bg-sky-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(14,165,233,0.15)]',
    iconColor: 'group-hover:text-sky-600 dark:group-hover:text-sky-400',
    category: '소통/정보'
  },
  {
    id: 'meal',
    label: '식수신청',
    sublabel: '식수/식권',
    path: '/meal-request',
    icon: Utensils,
    colorName: 'orange',
    gradientBg: 'from-orange-500/10 via-orange-500/5 to-card',
    borderColor: 'border-orange-500/20',
    hoverBorderColor: 'hover:border-orange-500/40',
    hoverBg: 'hover:bg-orange-500/15',
    iconBg: 'bg-orange-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(249,115,22,0.15)]',
    iconColor: 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
    category: '복지/생활'
  },
  {
    id: 'praise',
    label: '칭찬피드',
    sublabel: '동료 격려',
    path: '/praise-feed',
    icon: Heart,
    colorName: 'pink',
    gradientBg: 'from-pink-500/10 via-pink-500/5 to-card',
    borderColor: 'border-pink-500/20',
    hoverBorderColor: 'hover:border-pink-500/40',
    hoverBg: 'hover:bg-pink-500/15',
    iconBg: 'bg-pink-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(236,72,153,0.15)]',
    iconColor: 'group-hover:text-pink-600 dark:group-hover:text-pink-400',
    category: '소통/정보'
  },
  {
    id: 'training',
    label: '법정교육',
    sublabel: '의무 교육',
    path: '/training-list',
    icon: BookOpen,
    colorName: 'emerald',
    gradientBg: 'from-emerald-500/10 via-emerald-500/5 to-card',
    borderColor: 'border-emerald-500/20',
    hoverBorderColor: 'hover:border-emerald-500/40',
    hoverBg: 'hover:bg-emerald-500/15',
    iconBg: 'bg-emerald-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(16,185,129,0.15)]',
    iconColor: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    category: '안전/보건'
  },
  {
    id: 'payslip',
    label: '급여명세',
    sublabel: '명세서 조회',
    path: '/my-payslip',
    icon: Receipt,
    colorName: 'teal',
    gradientBg: 'from-teal-500/10 via-teal-500/5 to-card',
    borderColor: 'border-teal-500/20',
    hoverBorderColor: 'hover:border-teal-500/40',
    hoverBg: 'hover:bg-teal-500/15',
    iconBg: 'bg-teal-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(20,184,166,0.15)]',
    iconColor: 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
    category: '근태/인사'
  },
  {
    id: 'coupons',
    label: '복지쿠폰',
    sublabel: '쿠폰함',
    path: '/coupons',
    icon: Ticket,
    colorName: 'purple',
    gradientBg: 'from-purple-500/10 via-purple-500/5 to-card',
    borderColor: 'border-purple-500/20',
    hoverBorderColor: 'hover:border-purple-500/40',
    hoverBg: 'hover:bg-purple-500/15',
    iconBg: 'bg-purple-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(168,85,247,0.15)]',
    iconColor: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
    category: '복지/생활'
  },
  {
    id: 'temp',
    label: '체감온도',
    sublabel: '온열질환 예방',
    path: '/perceived-temp',
    icon: Thermometer,
    colorName: 'yellow',
    gradientBg: 'from-yellow-500/10 via-yellow-500/5 to-card',
    borderColor: 'border-yellow-500/20',
    hoverBorderColor: 'hover:border-yellow-500/40',
    hoverBg: 'hover:bg-yellow-500/15',
    iconBg: 'bg-amber-500 text-slate-950',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(234,179,8,0.15)]',
    iconColor: 'group-hover:text-amber-500 dark:group-hover:text-yellow-400',
    category: '안전/보건'
  },
  {
    id: 'ranking',
    label: '안전랭킹',
    sublabel: '포인트 순위',
    path: '/safety-ranking',
    icon: Trophy,
    colorName: 'lime',
    gradientBg: 'from-lime-500/10 via-lime-500/5 to-card',
    borderColor: 'border-lime-500/20',
    hoverBorderColor: 'hover:border-lime-500/40',
    hoverBg: 'hover:bg-lime-500/15',
    iconBg: 'bg-lime-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(132,204,22,0.15)]',
    iconColor: 'group-hover:text-lime-600 dark:group-hover:text-lime-400',
    category: '안전/보건'
  },
  {
    id: 'settings',
    label: '근무설정',
    sublabel: '자동출퇴근',
    path: '/attendance/settings',
    icon: Settings2,
    colorName: 'cyan',
    gradientBg: 'from-cyan-500/10 via-cyan-500/5 to-card',
    borderColor: 'border-cyan-500/20',
    hoverBorderColor: 'hover:border-cyan-500/40',
    hoverBg: 'hover:bg-cyan-500/15',
    iconBg: 'bg-cyan-600 text-white',
    shadowColor: 'hover:shadow-[0_8px_20px_rgba(6,182,212,0.15)]',
    iconColor: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
    category: '근태/인사'
  }
];

export const DEFAULT_PINNED_SHORTCUTS = ['attendance', 'leave', 'health'];

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { 
    locationSettings, 
    currentLocation, 
    distanceToCenter, 
    isInsideCheckInZone, 
    isLocationRetentionActive,
    retentionRemainingMinutes,
    lastVerifiedInsideTime,
    geofenceBufferMeters,
    pendingExitState,
    todayAttendance,
    refreshLocation 
  } = useAutoAttendance();
  const [weeklyAttendanceMap, setWeeklyAttendanceMap] = useState<Record<string, Attendance>>({});
  const [specialDates, setSpecialDates] = useState<Record<string, any>>({});
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
  const [recentAccidents, setRecentAccidents] = useState<AccidentCase[]>([]);
  const [selectedAccident, setSelectedAccident] = useState<AccidentCase | null>(null);
  const [selectedDashboardAccident, setSelectedDashboardAccident] = useState<AccidentCase | null>(null);
  const [healthStatus, setHealthStatus] = useState<'GOOD' | 'NORMAL' | 'BAD'>('GOOD');
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [newNotice, setNewNotice] = useState({ title: '', content: '', isImportant: false, shouldNotify: true });
  const [userTrend, setUserTrend] = useState<number>(0);
  const [isClockInHealthDialogOpen, setIsClockInHealthDialogOpen] = useState(false);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState(format(new Date(), 'HH:mm:ss'));
  const [isSOSLoading, setIsSOSLoading] = useState(false);
  const [isPresenceDialogOpen, setIsPresenceDialogOpen] = useState(false);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [teamAttendance, setTeamAttendance] = useState<{
    teamName: string;
    total: number;
    present: number;
    presentList: { name: string; position: string; clockIn: string }[];
    absentList: { name: string; position: string }[];
  }[]>([]);
  const [bannerText, setBannerText] = useState('안전한 하루가 되세요');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SAFETY_WORK' | 'HR' | 'WELFARE'>('ALL');
  const [briefingTab, setBriefingTab] = useState<'NOTICES' | 'ACCIDENTS' | 'PRAISE'>('NOTICES');
  const [showWeeklyTimecard, setShowWeeklyTimecard] = useState(false);
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);

  const isInitialNotices = useRef(true);
  const isInitialAccidents = useRef(true);

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    openAccidents: 0
  });
  const [pendingTrainings, setPendingTrainings] = useState(0);
  const [isAppExited, setIsAppExited] = useState(false);
  const [praiseKings, setPraiseKings] = useState<UserProfile[]>([]);

  // 🚀 Pinned Quick Action Shortcuts State & Handlers
  const [isShortcutConfigOpen, setIsShortcutConfigOpen] = useState(false);
  const [editShortcuts, setEditShortcuts] = useState<string[]>(DEFAULT_PINNED_SHORTCUTS);
  const [isSavingShortcuts, setIsSavingShortcuts] = useState(false);

  const openShortcutConfig = () => {
    const current = (profile?.pinnedShortcuts && profile.pinnedShortcuts.length > 0)
      ? profile.pinnedShortcuts
      : DEFAULT_PINNED_SHORTCUTS;
    setEditShortcuts([...current]);
    setIsShortcutConfigOpen(true);
  };

  const handleMoveShortcutUp = (index: number) => {
    if (index === 0) return;
    const next = [...editShortcuts];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    setEditShortcuts(next);
  };

  const handleMoveShortcutDown = (index: number) => {
    if (index === editShortcuts.length - 1) return;
    const next = [...editShortcuts];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    setEditShortcuts(next);
  };

  const handleToggleShortcut = (id: string) => {
    if (editShortcuts.includes(id)) {
      if (editShortcuts.length <= 1) {
        toast.warning('최소 1개 이상의 빠른 실행 메뉴가 필요합니다.');
        return;
      }
      setEditShortcuts(editShortcuts.filter(x => x !== id));
    } else {
      if (editShortcuts.length >= 6) {
        toast.warning('빠른 실행 메뉴는 최대 6개까지 고정할 수 있습니다.');
        return;
      }
      setEditShortcuts([...editShortcuts, id]);
    }
  };

  const handleResetShortcuts = () => {
    setEditShortcuts([...DEFAULT_PINNED_SHORTCUTS]);
    toast.info('기본 메뉴(출퇴근, 연차, 건강)로 초기화되었습니다.');
  };

  const handleSaveShortcuts = async () => {
    if (!profile) return;
    setIsSavingShortcuts(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        pinnedShortcuts: editShortcuts
      });
      toast.success('빠른 실행 메뉴 설정이 저장되었습니다.');
      setIsShortcutConfigOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('빠른 실행 메뉴 저장 실패');
    } finally {
      setIsSavingShortcuts(false);
    }
  };

  const activePinnedShortcutIds = (profile?.pinnedShortcuts && profile.pinnedShortcuts.length > 0)
    ? profile.pinnedShortcuts
    : DEFAULT_PINNED_SHORTCUTS;

  const activePinnedShortcuts = activePinnedShortcutIds
    .map(id => ALL_SHORTCUT_OPTIONS.find(opt => opt.id === id))
    .filter(Boolean) as ShortcutOption[];

  useEffect(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const q = query(
      collection(db, 'users'),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const sorted = userList
        .sort((a, b) => {
          const aMonthKudos = a.kudosMonth === currentMonth ? (a.monthlyKudosCount || 0) : 0;
          const bMonthKudos = b.kudosMonth === currentMonth ? (b.monthlyKudosCount || 0) : 0;
          if (bMonthKudos !== aMonthKudos) {
            return bMonthKudos - aMonthKudos;
          }
          return (b.points || 0) - (a.points || 0);
        })
        .slice(0, 5);

      setPraiseKings(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'specialDates'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dates: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.date) {
          dates[data.date] = data;
        }
      });
      setSpecialDates(dates);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'specialDates');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Only intercept if we are on the primary home dashboard view to prevent random navigation capture
    // Check if back interceptor state has already been pushed to prevent duplicating junk history entries
    const currentState = window.history.state;
    const hasInterceptor = currentState && currentState.isBackInterceptor;

    if (!hasInterceptor) {
      window.history.pushState(
        { 
          ...(currentState || {}), 
          isBackInterceptor: true 
        }, 
        '', 
        window.location.href
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      // Re-push immediately to keep the back interceptor active and preserve internal routing states
      const stateToRestore = window.history.state || {};
      window.history.pushState(
        { 
          ...stateToRestore, 
          isBackInterceptor: true 
        }, 
        '', 
        window.location.href
      );

      const now = Date.now();
      const lastBack = sessionStorage.getItem('last_back_clicked_time');
      const lastTime = lastBack ? parseInt(lastBack, 10) : 0;

      if (now - lastTime < 2000) {
        toast.error('애플리케이션을 종료합니다...', { duration: 1500 });
        sessionStorage.removeItem('last_back_clicked_time');
        setIsAppExited(true);
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            // Safe fallback
          }
        }, 1000);
      } else {
        sessionStorage.setItem('last_back_clicked_time', now.toString());
        toast.warning('한 번 더 누르면 앱이 종료됩니다.', { duration: 1500 });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Specific restrictions as requested: Hide for 조장, 반장, 사원
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    (['조장', '반장', '사원'].includes(profile.position?.trim() || '') && profile.role !== 'TEAM_LEADER') ||
    profile.employeeId?.trim()?.toLowerCase()?.includes('x66626') ||
    profile.displayName?.toLowerCase()?.includes('x66626') ||
    profile.email?.toLowerCase().includes('x66626') ||
    user?.email?.toLowerCase().includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626' ||
    (user?.email && user.email.toLowerCase().startsWith('x66626@')) ||
    (user?.displayName && user.displayName?.toLowerCase().includes('x66626'))
  );

  useEffect(() => {
    if (profile && profile.employeeId?.trim()?.toLowerCase() === 'x66626') {
      console.log("Excluded role detected in Dashboard:", profile.uid, profile.role, profile.employeeId);
    }
  }, [profile]);

  const isManager = profile && !profile.employeeId?.trim()?.toLowerCase()?.includes('x66626') && (
    ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'GENERAL_AFFAIRS', 'TEAM_LEADER'].includes(profile.role) || 
    profile.permissions?.some(p => ['notice_mgmt', 'employee_mgmt', 'accident_mgmt', 'work_log_mgmt', 'attendance_mgmt', 'training_mgmt', 'admin'].includes(p)) ||
    (profile.position && ['팀장', '소장', '총무', '직장', '실장', '안전관리자', '대표'].some(p => profile.position?.includes(p)))
  );

  const isSupervisor = profile && (
    ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'CEO'].includes(profile.role) ||
    (profile.position && ['팀장', '직장', '소장', '실장'].some(p => profile.position?.includes(p))) ||
    profile.permissions?.includes('team_work_log_approve')
  );

  const isExcludedFromAccidentReport = profile && (
    ['GROUP_LEADER', 'EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') ||
    (profile.position && ['조장', '사원'].some(p => profile.position?.trim().includes(p)))
  );

  const canReportAccident = profile && !isExcludedFromAccidentReport && (
    ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'].includes(profile.role) || 
    profile.permissions?.includes('accident_mgmt') ||
    profile.permissions?.includes('admin') ||
    (profile.position && ['팀장', '직장', '소장', '서무', '총무', '실장', '안전관리자', '대표', '사장'].some(p => profile.position?.trim().includes(p)))
  );

  const canWriteHealth = profile && (
    ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'].includes(profile.role) ||
    profile.permissions?.includes('health_mgmt') ||
    (profile.position && ['반장', '조장', '팀장'].some(p => profile.position?.includes(p)))
  );

  const canRequestSnack = profile && (
    ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'CEO'].includes(profile.role) ||
    (profile.position && ['팀장', '직장', '소장', '총무'].some(p => profile.position?.includes(p)))
  );

  const canManageMeal = profile && (
    ['GENERAL_MANAGER', 'CLERK'].includes(profile.role) ||
    (profile.position && ['실장', '서무'].some(p => profile.position?.includes(p)))
  );

  useEffect(() => {
    requestNotificationPermission();
    if (!profile) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch last 15 attendance entries to build a week view (No orderBy to avoid composite index requirement)
    const weeklyQ = query(
      collection(db, 'attendance'),
      where('uid', '==', profile.uid),
      limit(15)
    );
    const unsubscribeWeekly = onSnapshot(weeklyQ, (snapshot) => {
      const map: Record<string, Attendance> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Attendance;
        map[data.date] = { id: doc.id, ...data };
      });
      setWeeklyAttendanceMap(map);
    }, (error) => {
      console.error("Error fetching weekly attendance map:", error);
    });

    // Notices for everyone
    const noticeQ = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribeNotices = onSnapshot(noticeQ, (snapshot) => {
      setRecentNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
      if (!isInitialNotices.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as Notice;
            AlertSoundPlayer.trigger('notice', data.title);
          }
        });
      } else {
        isInitialNotices.current = false;
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notices');
    });

    // Accidents for everyone
    const accidentQ = query(
      collection(db, 'accidentCases'),
      orderBy('date', 'desc'),
      limit(3)
    );
    const unsubscribeAccidents = onSnapshot(accidentQ, (snapshot) => {
      setRecentAccidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccidentCase)));
      if (!isInitialAccidents.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as AccidentCase;
            AlertSoundPlayer.trigger('accident', data.title);
          }
        });
      } else {
        isInitialAccidents.current = false;
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accidentCases');
    });

    let unsubscribeTrend = () => {};
    if (!isExcludedRole) {
      const trendQ = query(
        collection(db, 'safetyScoreLogs'),
        where('targetUid', '==', profile.uid)
      );
      unsubscribeTrend = onSnapshot(trendQ, (snapshot) => {
        const now = new Date();
        const currentMonthStart = startOfMonth(now);
        const prevMonthStart = startOfMonth(subMonths(now, 1));
        
        let currentMonthDelta = 0;
        let prevMonthDelta = 0;
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const logDate = new Date(data.createdAt);
          if (logDate >= currentMonthStart) {
            currentMonthDelta += data.scoreDelta;
          } else if (logDate >= prevMonthStart && logDate < currentMonthStart) {
            prevMonthDelta += data.scoreDelta;
          }
        });
        setUserTrend(currentMonthDelta - prevMonthDelta);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'safetyScoreLogs');
      });
    }

    // Fetch My Tasks for employees
    const tasksQ = query(
      collection(db, 'tasks'),
      where('assignedToUid', '==', profile.uid),
      where('status', 'in', ['TODO', 'IN_PROGRESS']),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribeTasks = onSnapshot(tasksQ, (snapshot) => {
      setMyTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    // Fetch training status for employees
    const trainingQ = query(collection(db, 'trainings'), where('status', '==', 'PUBLISHED'));
    const resultQ = query(collection(db, 'trainingResults'), where('uid', '==', profile.uid));
    
    getDocs(trainingQ).then(tSnap => {
      getDocs(resultQ).then(rSnap => {
        const completedIds = new Set(rSnap.docs.map(doc => doc.data().trainingId));
        const pending = tSnap.docs.filter(doc => !completedIds.has(doc.id)).length;
        setPendingTrainings(pending);
      }).catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'trainingResults');
      });
    }).catch(err => {
      handleFirestoreError(err, OperationType.LIST, 'trainings');
    });

    // Fetch Admin Stats if manager
    let unsubscribeAdminStats = () => {};
    // Ensure we only run these if profile is loaded and role is identified
    if (isManager && profile?.role && profile.role !== 'EMPLOYEE') {
      // 1. Total Employees
      getDocs(collection(db, 'users')).then(snap => {
        setAdminStats(prev => ({ ...prev, totalEmployees: snap.size }));
      }).catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      });

      // 2. Present Today
      const todayInQ = query(collection(db, 'attendance'), where('date', '==', today));
      const unsubAttendance = onSnapshot(todayInQ, (snap) => {
        setAdminStats(prev => ({ ...prev, presentToday: snap.size }));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'attendance_stats');
      });

      // 3. Pending Leaves
      const leaveQ = query(collection(db, 'leaveRequests'), where('status', '==', 'PENDING'));
      const unsubLeaves = onSnapshot(leaveQ, (snap) => {
        setAdminStats(prev => ({ ...prev, pendingLeaves: snap.size }));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'leave_stats');
      });

      // 4. Open Accident Reports
      const accidentCheckQ = query(collection(db, 'accidentCases'), orderBy('createdAt', 'desc'), limit(10));
      const unsubAccidents = onSnapshot(accidentCheckQ, (snap) => {
        setAdminStats(prev => ({ ...prev, openAccidents: snap.size }));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'accident_stats');
      });

      unsubscribeAdminStats = () => {
        unsubAttendance();
        unsubLeaves();
        unsubAccidents();
      };
    }

    const unsubscribeBanner = onSnapshot(doc(db, 'settings', 'banner'), (snapshot) => {
      if (snapshot.exists()) {
        setBannerText(snapshot.data().text || '안전한 하루가 되세요');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/banner');
    });

    return () => {
      unsubscribeWeekly();
      unsubscribeNotices();
      unsubscribeAccidents();
      unsubscribeTrend();
      unsubscribeTasks();
      unsubscribeAdminStats();
      unsubscribeBanner();
    };
  }, [profile, isManager]);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
      toast.success('작업 상태가 업데이트되었습니다.');
    } catch (error) {
      toast.error('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  const sendHealthNotification = async (status: 'GOOD' | 'NORMAL' | 'BAD') => {
    if (!profile) return;
    
    if (status === 'BAD') {
      sendPushNotification('⚠️ 건강상태 나쁨 알림', {
        body: `${profile?.displayName || '사용자'}님의 건강상태가 나쁨으로 보고되었습니다. 즉시 확인이 필요할 수 있습니다.`,
      });
    }

    if (status !== 'BAD') return; // Only notify managers if status is BAD

    try {
      const globalTargetRoles: Role[] = ['GENERAL_AFFAIRS', 'SAFETY_MANAGER', 'DIRECTOR', 'CLERK', 'GENERAL_MANAGER'];
      const managersQuery = query(collection(db, 'users'), where('role', 'in', globalTargetRoles));
      const teamLeaderQuery = query(
        collection(db, 'users'),
        where('role', '==', 'TEAM_LEADER'),
        where('jobRole', '==', profile.jobRole || '') // Match by jobRole (team)
      );

      const [managersSnap, teamLeaderSnap] = await Promise.all([
        getDocs(managersQuery),
        getDocs(teamLeaderQuery)
      ]).catch(err => {
        console.error("SOS management lookup error:", err);
        return [ { docs: [] }, { docs: [] } ] as any[];
      });

      const targetUids = new Set<string>();
      managersSnap.docs.forEach(doc => targetUids.add(doc.id));
      teamLeaderSnap.docs.forEach(doc => targetUids.add(doc.id));
      targetUids.delete(profile.uid);

      if (targetUids.size === 0) return;

      const healthLabels = { GOOD: '좋음', NORMAL: '보통', BAD: '나쁨' };
      const notificationPromises = Array.from(targetUids).map(uid => 
        addDoc(collection(db, 'notifications'), {
          uid,
          title: `[건강상태 알림] ${profile?.displayName || '사용자'}님`,
          message: `${profile?.displayName || '사용자'}님이 오늘 건강상태를 '${healthLabels[status]}'으로 보고했습니다.`,
          type: 'HEALTH_CHECK',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile?.displayName || '사용자'
        })
      );

      // Add HEALTH_BAD report in criticalIncidents
      const criticalIncidentPromise = addDoc(collection(db, 'criticalIncidents'), {
        type: 'HEALTH_BAD',
        typeName: '컨디션 나쁨',
        uid: profile.uid,
        displayName: profile.displayName || '이름없음',
        employeeId: profile.employeeId || '',
        departmentName: profile.departmentName || '미지정',
        jobRole: profile.jobRole || '',
        workplace: profile.workplace || '현장',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      await Promise.all([...notificationPromises, criticalIncidentPromise]);
    } catch (error) {
      console.error("Health notification error:", error);
    }
  };

  const handleUpdateHealth = async (status: 'GOOD' | 'NORMAL' | 'BAD') => {
    if (!profile) return;
    setHealthStatus(status);

    if (todayAttendance) {
      try {
        await updateDoc(doc(db, 'attendance', todayAttendance.id), { healthStatus: status });
        await sendHealthNotification(status);
        toast.success('건강상태 보고 완료', {
          description: `오늘의 건강상태를 '${status === 'GOOD' ? '좋음' : status === 'NORMAL' ? '보통' : '나쁨'}'으로 보고했습니다.`
        });
      } catch (error) {
        toast.error('건강상태 업데이트 중 오류가 발생했습니다.');
      }
    }
  };

  const handleClockIn = async () => {
    if (!profile) return;
    setIsClockInHealthDialogOpen(true);
  };

  const confirmClockIn = async (selectedHealth: 'GOOD' | 'NORMAL' | 'BAD') => {
    if (!profile) return;
    setIsClockingIn(true);
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const status = now.getHours() >= 9 && now.getMinutes() > 0 ? 'LATE' : 'PRESENT';
    const attendanceDocId = `${profile.uid}_${today}`;

    try {
      const leaveQuery = query(
        collection(db, 'leaveRequests'),
        where('uid', '==', profile.uid),
        where('status', '==', 'APPROVED'),
        where('startDate', '<=', today),
        where('endDate', '>=', today)
      );
      const leaveSnapshot = await getDocs(leaveQuery);
      const leave = leaveSnapshot.empty ? null : leaveSnapshot.docs[0].data() as LeaveRequest;

      await setDoc(doc(db, 'attendance', attendanceDocId), {
        uid: profile.uid,
        date: today,
        clockIn: now.toISOString(),
        status: leave?.type === 'ANNUAL' ? 'LEAVE' : status,
        healthStatus: selectedHealth,
        displayName: profile?.displayName || '이름없음',
        departmentId: profile.departmentId || '',
        departmentName: profile.departmentName || '미지정',
        leaveType: leave?.type || null,
        clockInLat: currentLocation?.latitude || null,
        clockInLng: currentLocation?.longitude || null,
        workHours: 0,
        overtimeHours: 0,
        pendingExitSince: null,
        createdAt: now.toISOString()
      }, { merge: true });

      // Enable ghost guard
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: true,
        lastMovementAt: now.toISOString(),
        isImmobile: false
      }).catch(err => console.warn('User ghost guard activate warning', err));

      // Grant random ship part
      grantRandomShipPart(profile.uid, '출근');

      setHealthStatus(selectedHealth);
      await sendHealthNotification(selectedHealth);
      setIsClockInHealthDialogOpen(false);
      toast.success('🎉 출근 등록 완료!', {
        description: `${format(now, 'HH:mm')}에 정상적으로 출근 등록되었습니다. (유령 가드 활성화 & 파츠 지급)`
      });
    } catch (error) {
      console.error("Clock-in error:", error);
      toast.error('출근 처리 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance || !profile) return;
    setIsClockingOut(true);
    try {
      const now = new Date();
      const isSpecial = checkIsSpecialDay(new Date(todayAttendance.clockIn), specialDates).isSpecial;
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, now, isSpecial);
      
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOut: now.toISOString(),
        workHours,
        overtimeHours,
        clockOutLat: currentLocation?.latitude || null,
        clockOutLng: currentLocation?.longitude || null,
        pendingExitSince: null
      });

      // Disable ghost guard
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: false,
        isImmobile: false
      }).catch(err => console.warn('User ghost guard deactivate warning', err));

      toast.success('🏁 퇴근 등록 완료!', {
        description: `${format(now, 'HH:mm')} 퇴근 (정규 ${workHours}h / 잔업 ${overtimeHours}h 정산)`
      });
    } catch (error) {
      console.error("Clock-out error:", error);
      toast.error('퇴근 처리 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.WRITE, `attendance/${todayAttendance.id}`);
    } finally {
      setIsClockingOut(false);
    }
  };

  const fetchTeamAttendance = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const usersSnap = await getDocs(collection(db, 'users'));
      const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', today)));
      
      const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const todayAttendance = attendanceSnap.docs.map(doc => doc.data() as Attendance);
      
      // Filter out users who are NOT active
      const activeUsers = allUsers.filter(u => u.status === 'ACTIVE' || (u.status === undefined && u.isActive !== false));

      const teams: Record<string, typeof teamAttendance[0]> = {};
      
      activeUsers.forEach(u => {
        const teamName = u.departmentName || '기타';
        if (!teams[teamName]) {
          teams[teamName] = {
            teamName,
            total: 0,
            present: 0,
            presentList: [],
            absentList: []
          };
        }
        
        teams[teamName].total++;
        const att = todayAttendance.find(a => a.uid === u.uid);
        if (att) {
          teams[teamName].present++;
          teams[teamName].presentList.push({
            name: u.displayName,
            position: u.position || '사원',
            clockIn: att.clockIn
          });
        } else {
          teams[teamName].absentList.push({
            name: u.displayName,
            position: u.position || '사원'
          });
        }
      });
      
      setTeamAttendance(Object.values(teams).sort((a, b) => a.teamName.localeCompare(b.teamName)));
      setSelectedTeamIndex(null);
      setIsPresenceDialogOpen(true);
    } catch (error) {
      toast.error('출근 현황을 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleSOS = async () => {
    if (!profile || isSOSLoading) return;
    setIsSOSLoading(true);
    
    try {
      const globalTargetRoles: Role[] = ['CEO', 'SAFETY_MANAGER', 'GENERAL_AFFAIRS'];
      const managersQuery = query(collection(db, 'users'), where('role', 'in', globalTargetRoles));
      const managersSnap = await getDocs(managersQuery);

      const notificationPromises = managersSnap.docs.map(doc => 
        addDoc(collection(db, 'notifications'), {
          uid: doc.id,
          title: `🚨 [긴급 SOS] ${profile?.displayName || '사용자'}님`,
          message: `${profile?.displayName || '사용자'}님이 현재 위치에서 긴급 상황을 보고했습니다! 즉시 대응이 필요합니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile?.displayName || '사용자',
          priority: 'high'
        })
      );

      await Promise.all(notificationPromises);
      sendPushNotification('긴급 SOS 요청 완료', { body: '관리자에게 알림이 전송되었습니다.' });
      toast.error('긴급 SOS 요청이 발송되었습니다!', {
        description: '관리자들이 즉시 확인 중입니다.',
        duration: 5000
      });
    } catch (error) {
      toast.error('SOS 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSOSLoading(false);
    }
  };

  const handleAddNotice = async () => {
    if (!profile || !newNotice.title || !newNotice.content) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'notices'), {
        title: newNotice.title,
        content: newNotice.content,
        isImportant: newNotice.isImportant,
        authorUid: profile.uid,
        authorName: profile?.displayName || '사용자',
        createdAt: new Date().toISOString(),
        targetDept: 'ALL'
      });

      if (newNotice.shouldNotify) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const notificationPromises = usersSnap.docs.map(uDoc => 
          addDoc(collection(db, 'notifications'), {
            uid: uDoc.id,
            title: newNotice.isImportant ? `🚨 [중요공지] ${newNotice.title}` : `📢 새 공지: ${newNotice.title}`,
            message: newNotice.content.substring(0, 80),
            type: newNotice.isImportant ? 'URGENT_NOTICE' : 'NOTICE',
            isRead: false,
            createdAt: new Date().toISOString(),
            fromUid: profile.uid,
            fromName: profile?.displayName || '사용자',
            priority: newNotice.isImportant ? 'high' : 'normal'
          })
        );
        await Promise.all(notificationPromises);
      }

      setIsNoticeDialogOpen(false);
      setNewNotice({ title: '', content: '', isImportant: false, shouldNotify: true });
      toast.success('공지사항이 등록되었습니다.');
    } catch (error) {
      toast.error('공지사항 등록 중 오류가 발생했습니다.');
    }
  };

  const workingDays = profile?.joinedAt ? differenceInDays(new Date(), new Date(profile.joinedAt)) + 1 : null;
  const { isMonitoring, startMonitoring } = useSafetySensor();

  if (isAppExited) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center text-white p-6">
        <div className="w-20 h-20 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center mb-6 animate-pulse">
          <span className="text-red-500 font-black text-xl">OFF</span>
        </div>
        <h2 className="text-2xl font-black mb-2">애플리케이션 종료됨</h2>
        <p className="text-sm text-zinc-500 font-bold max-w-xs text-center leading-relaxed mb-6">
          뒤로가기가 연속으로 감지되어 안전하게 전원이 꺼졌습니다. 브라우저 탭을 닫아주세요.
        </p>
        <Button 
          variant="outline"
          onClick={() => {
            sessionStorage.removeItem('last_back_clicked_time');
            setIsAppExited(false);
            window.location.reload();
          }} 
          className="bg-zinc-900 border-zinc-800 text-zinc-300 font-black px-6 h-12 rounded-2xl hover:bg-zinc-800 active:scale-95 transition-all text-xs cursor-pointer shadow-lg mt-2"
        >
          재접속 / 시스템 시작
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 pb-20 px-4 overflow-x-hidden bg-background">
      {/* 1. Welcoming Corporate User Banner (NAHAGO Style) */}
      <header className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3 bg-card/45 backdrop-blur-md border border-border/40 p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div 
            onClick={() => navigate('/mypage')}
            className="flex items-center gap-3 cursor-pointer group flex-1"
          >
            <div className="w-13 h-13 rounded-full bg-muted border border-border/80 flex items-center justify-center text-muted-foreground shadow-inner shrink-0 relative group-hover:border-primary/40 transition-all duration-300">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={profile?.displayName} 
                  className="w-full h-full rounded-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="w-6 h-6 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
              )}
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-card rounded-full" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h1 className="text-lg font-black text-foreground tracking-tight group-hover:text-primary transition-colors flex items-center gap-1 truncate">
                  {profile?.displayName || '사용자'}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
                </h1>
              </div>
              <p className="text-xs font-bold text-muted-foreground/70 truncate tracking-tight">
                주식회사 건명기업 ({profile?.departmentName || '경영혁신부'})
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15 shadow-sm">
              {profile?.position || '사원'} 🏢
            </span>
            {workingDays && (
              <span className="text-[11px] font-black text-muted-foreground/60 tracking-wider">
                D+{workingDays}
              </span>
            )}
          </div>
        </div>

        {/* Elegant Notice / Banner Ticker */}
        {bannerText && (
          <div className="bg-primary/[0.03] border border-primary/10 py-2.5 px-3.5 rounded-2xl flex items-center gap-2 overflow-hidden shadow-inner">
            <Megaphone className="w-4 h-4 text-primary shrink-0 animate-bounce" />
            <div className="flex-1 overflow-hidden relative h-4">
              <div className="flex whitespace-nowrap animate-marquee">
                <p className="inline-block text-xs font-bold text-foreground/80 px-2">
                  {bannerText} • Safety First • ALWAYS BE CAREFUL • {profile?.displayName}님 오늘도 안전한 하루 보내세요
                </p>
                <p className="inline-block text-xs font-bold text-foreground/80 px-2">
                  {bannerText} • Safety First • ALWAYS BE CAREFUL • {profile?.displayName}님 오늘도 안전한 하루 보내세요
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 📍 Real-time Geofence Retention & Sensor Status Bar */}
      <DashboardStatusBar
        isLocationRetentionActive={isLocationRetentionActive}
        retentionRemainingMinutes={retentionRemainingMinutes}
        isInsideCheckInZone={isInsideCheckInZone}
        distanceToCenter={distanceToCenter}
        refreshLocation={refreshLocation}
        isMonitoring={isMonitoring}
        startMonitoring={startMonitoring}
        geofenceBufferMeters={geofenceBufferMeters}
      />

      {/* 🚀 CUSTOMIZABLE QUICK ACTION SHORTCUTS (사용자 맞춤 빠른 실행 메뉴) */}
      <section className="bg-card/70 backdrop-blur-md border border-border/70 rounded-3xl p-3.5 shadow-[0_6px_24px_rgba(0,0,0,0.03)] space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-black text-foreground tracking-tight">자주 쓰는 빠른 실행</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold border-primary/30 text-primary bg-primary/5">
              {activePinnedShortcuts.length}개 고정됨
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={openShortcutConfig}
            className="h-6 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Settings2 className="w-3 h-3 text-primary" />
            메뉴 설정
          </Button>
        </div>

        <div className={cn(
          "grid gap-2.5 sm:gap-3",
          activePinnedShortcuts.length <= 3 ? "grid-cols-3" :
          activePinnedShortcuts.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
          activePinnedShortcuts.length === 5 ? "grid-cols-3 sm:grid-cols-5" :
          "grid-cols-3 sm:grid-cols-6"
        )}>
          {activePinnedShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "group relative flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl bg-gradient-to-b border active:scale-95 transition-all duration-300 shadow-sm hover:-translate-y-0.5 cursor-pointer overflow-hidden",
                  item.gradientBg,
                  item.borderColor,
                  item.hoverBorderColor,
                  item.hoverBg,
                  item.shadowColor
                )}
              >
                <div className="absolute -top-6 -right-6 w-14 h-14 bg-white/10 rounded-full blur-lg group-hover:scale-150 transition-all duration-500 pointer-events-none" />
                <div className={cn(
                  "w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-all duration-300 shrink-0 mb-1.5",
                  item.iconBg
                )}>
                  <Icon className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                </div>
                <span className={cn(
                  "text-xs sm:text-sm font-black text-foreground transition-colors",
                  item.iconColor
                )}>
                  {item.label}
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-bold text-muted-foreground/75 mt-0.5 whitespace-nowrap">
                  {item.sublabel}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 🛠️ QUICK ACTION SHORTCUTS CONFIGURATION MODAL (빠른 실행 커스텀 모달) */}
      <Dialog open={isShortcutConfigOpen} onOpenChange={setIsShortcutConfigOpen}>
        <DialogContent className="max-w-md w-[94vw] p-5 rounded-3xl bg-card border-border/80 shadow-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Pin className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  빠른 실행 메뉴 설정
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  원하는 기능을 상단에 핀 고정하고 순서를 변경하세요 (최대 6개)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 1. 현재 고정된 메뉴 (순서 변경) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5 text-primary" />
                  현재 고정된 메뉴 ({editShortcuts.length}/6)
                </span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  위/아래 버튼으로 순서 조정
                </span>
              </div>

              <div className="space-y-1.5 bg-muted/30 border border-border/50 rounded-2xl p-2">
                {editShortcuts.map((id, index) => {
                  const opt = ALL_SHORTCUT_OPTIONS.find(o => o.id === id);
                  if (!opt) return null;
                  const Icon = opt.icon;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-lg bg-muted text-muted-foreground font-black text-[10px] flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0", opt.iconBg)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-foreground truncate">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{opt.sublabel}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => handleMoveShortcutUp(index)}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30"
                          title="위로 이동"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === editShortcuts.length - 1}
                          onClick={() => handleMoveShortcutDown(index)}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30"
                          title="아래로 이동"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={editShortcuts.length <= 1}
                          onClick={() => handleToggleShortcut(id)}
                          className="h-7 w-7 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                          title="고정 해제"
                        >
                          <PinOff className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. 전체 기능 라이브러리 (클릭하여 추가/제거) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground">
                  전체 기능 목록 (선택하여 추가/해제)
                </span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  클릭 시 핀 고정 토글
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {ALL_SHORTCUT_OPTIONS.map((opt) => {
                  const isPinned = editShortcuts.includes(opt.id);
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleShortcut(opt.id)}
                      className={cn(
                        "p-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer",
                        isPinned
                          ? "bg-primary/10 border-primary/50 text-foreground ring-1 ring-primary/30"
                          : "bg-card/60 border-border/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white", opt.iconBg)}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-[11px] font-black truncate", isPinned ? "text-primary" : "text-foreground")}>
                            {opt.label}
                          </p>
                          <p className="text-[9px] text-muted-foreground truncate">{opt.sublabel}</p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isPinned ? (
                          <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 h-4 font-black rounded-md">
                            고정됨
                          </Badge>
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetShortcuts}
              className="text-xs font-bold text-muted-foreground hover:text-foreground h-9 rounded-xl flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              기본값 복원
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsShortcutConfigOpen(false)}
                className="text-xs font-bold h-9 rounded-xl"
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSavingShortcuts}
                onClick={handleSaveShortcuts}
                className="text-xs font-black h-9 rounded-xl bg-primary text-primary-foreground px-4 shadow-sm"
              >
                {isSavingShortcuts ? '저장 중...' : '설정 저장'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🌟 2. PROMINENT ATTENDANCE & TIMECARD HUB */}
      <AttendanceHubCard
        todayAttendance={todayAttendance}
        weeklyAttendanceMap={weeklyAttendanceMap}
        currentTimeStr={currentTimeStr}
        isClockingIn={isClockingIn}
        isClockingOut={isClockingOut}
        handleClockIn={handleClockIn}
        handleClockOut={handleClockOut}
        pendingExitState={pendingExitState}
      />

      {/* 🛠️ 3. STREAMLINED ALL-SERVICES HUB (모든 서비스 4열 아이콘 런처) */}
      <ServicesHub
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      {/* 👑 4. SPECIAL ADMIN FEATURES (Manager/Supervisor only) */}
      {(isSupervisor || isManager || canManageMeal) && (
        <section className="p-3.5 bg-card/70 backdrop-blur-md border border-border/70 rounded-3xl space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-1.5 px-0.5">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-xs font-black text-foreground tracking-tight">
              현장 관리 지원 데스크
            </h4>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold border-primary/30 text-primary bg-primary/5 ml-auto">
              관리 권한 활성
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {isSupervisor && (
              <button 
                type="button"
                onClick={() => navigate('/work-instruction-mgmt')} 
                className="flex items-center gap-2 p-2.5 bg-card border border-border/60 rounded-xl text-left hover:bg-muted/80 hover:border-primary/40 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <div className="w-7 h-7 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-500 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-foreground truncate">작업지시 관리</span>
              </button>
            )}
            {isManager && (
              <button 
                type="button"
                onClick={fetchTeamAttendance} 
                className="flex items-center gap-2 p-2.5 bg-card border border-border/60 rounded-xl text-left hover:bg-muted/80 hover:border-primary/40 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-foreground truncate">팀 출근 현황</span>
              </button>
            )}
            {isManager && (
              <button 
                type="button"
                onClick={() => setIsNoticeDialogOpen(true)} 
                className="flex items-center gap-2 p-2.5 bg-card border border-border/60 rounded-xl text-left hover:bg-muted/80 hover:border-primary/40 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-foreground truncate">공지사항 등록</span>
              </button>
            )}
            {canReportAccident && (
              <button 
                type="button"
                onClick={() => navigate('/accidents')} 
                className="flex items-center gap-2 p-2.5 bg-card border border-border/60 rounded-xl text-left hover:bg-muted/80 hover:border-primary/40 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <div className="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-foreground truncate">사고사례 등록</span>
              </button>
            )}
            {canManageMeal && (
              <button 
                type="button"
                onClick={() => navigate('/meal-mgmt')} 
                className="col-span-2 flex items-center justify-between p-2.5 bg-card border border-border/60 rounded-xl hover:bg-muted/80 hover:border-primary/40 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-500 shrink-0">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-foreground">식사·간식 신청 내역 관리</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* 📢 5. DAILY BRIEFING HUB (공지사항 / 사고사례 / 이달의 칭찬왕 통합 탭) */}
      <DailyBriefingCard
        briefingTab={briefingTab}
        setBriefingTab={setBriefingTab}
        recentNotices={recentNotices}
        recentAccidents={recentAccidents}
        praiseKings={praiseKings}
        onSelectNotice={(notice) => setSelectedNotice(notice)}
        onSelectAccident={(accident) => setSelectedDashboardAccident(accident)}
      />

      {/* Dialogs */}
      <Dialog open={!!selectedNotice} onOpenChange={() => setSelectedNotice(null)}>
        <DialogContent className="bg-card border-border rounded-[2.5rem] max-w-lg w-[95%] p-0 overflow-hidden text-foreground">
          <DialogHeader className="p-8 pb-6 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">{selectedNotice?.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground/60 font-bold text-xs uppercase tracking-widest mt-1">
                  작성일: {selectedNotice && format(new Date(selectedNotice.createdAt), 'yyyy.MM.dd HH:mm')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 max-h-[60dvh] overflow-y-auto no-scrollbar">
            <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap font-medium">
              {selectedNotice?.content}
            </div>
          </div>
          <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline"
              className="flex-1 h-12 rounded-xl font-black border-primary/20 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 cursor-pointer"
              onClick={() => {
                if (selectedNotice) {
                  AlertSoundPlayer.trigger('notice', `${selectedNotice.title}. ${selectedNotice.content}`);
                }
              }}
            >
              <Volume2 className="w-4 h-4 animate-pulse" />
              음성 방송 듣기
            </Button>
            <Button className="flex-1 h-12 rounded-xl font-black bg-foreground text-background hover:bg-foreground/90 cursor-pointer" onClick={() => setSelectedNotice(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDashboardAccident} onOpenChange={() => setSelectedDashboardAccident(null)}>
        <DialogContent className="bg-card border-border rounded-[2.5rem] max-w-lg w-[95%] p-0 overflow-hidden text-foreground">
          <DialogHeader className="p-8 pb-6 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {selectedDashboardAccident && (
                    <Badge className={cn(
                      "text-[9px] font-black h-5 px-2 rounded border-none text-white",
                      selectedDashboardAccident.severity === 'HIGH' ? "bg-red-500" : selectedDashboardAccident.severity === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500"
                    )}>
                      {selectedDashboardAccident.severity === 'HIGH' ? '중대사고' : selectedDashboardAccident.severity === 'MEDIUM' ? '경미사고' : '아차사고'}
                    </Badge>
                  )}
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted-foreground/5 px-2 py-0.5 rounded">
                    {selectedDashboardAccident?.type === 'SAFE' ? '안전수칙' : selectedDashboardAccident?.type === 'INCIDENT' ? '잠재재해' : '사고사례'}
                  </span>
                </div>
                <DialogTitle className="text-xl font-black tracking-tight mt-1">{selectedDashboardAccident?.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground/60 font-bold text-xs tracking-widest mt-1">
                  발생장소: {selectedDashboardAccident?.location} • 발생일: {selectedDashboardAccident?.date}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 max-h-[60dvh] overflow-y-auto no-scrollbar space-y-4">
            <div>
              <p className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest pl-1 mb-1">상세 내용</p>
              <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap font-medium bg-muted/20 p-4 rounded-2xl">
                {selectedDashboardAccident?.description}
              </div>
            </div>
            {selectedDashboardAccident?.measures && (
              <div>
                <p className="text-xs font-black text-primary uppercase tracking-widest pl-1 mb-1">조치 결과</p>
                <div className="text-sm leading-relaxed text-primary/85 bg-primary/5 p-4 rounded-2xl border border-primary/10 font-bold font-sans">
                  {selectedDashboardAccident?.measures}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border">
            <Button className="w-full h-12 rounded-xl font-black bg-foreground text-background hover:bg-foreground/90" onClick={() => setSelectedDashboardAccident(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPresenceDialogOpen} onOpenChange={setIsPresenceDialogOpen}>
        <DialogContent className="bg-card border border-border rounded-[2.5rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh] text-foreground">
          <DialogHeader className="p-8 pb-6 bg-muted/50 border-b border-border shrink-0">
            <div className="flex items-center gap-4">
              {selectedTeamIndex !== null && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-10 h-10 rounded-xl bg-muted text-muted-foreground/60 hover:text-foreground"
                  onClick={() => setSelectedTeamIndex(null)}
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </Button>
              )}
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tighter text-foreground">
                  {selectedTeamIndex !== null ? teamAttendance[selectedTeamIndex].teamName : '실시간 출근 현황'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground/60 font-bold">
                  {selectedTeamIndex !== null ? '상세 인원 및 현황을 확인합니다.' : '팀별 현황을 선택하여 상세 내용을 확인합니다.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-4 overflow-y-auto flex-grow no-scrollbar">
            {selectedTeamIndex === null ? (
              <div className="grid gap-3">
                {teamAttendance.map((team, idx) => (
                  <button 
                    key={idx} 
                    className="flex items-center justify-between p-5 bg-card rounded-2xl border border-border hover:bg-muted transition-all active:scale-[0.98] text-left"
                    onClick={() => setSelectedTeamIndex(idx)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">{team.teamName}</h3>
                        <p className="text-xs font-bold text-muted-foreground/40">총 {team.total}명</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-primary">{team.present} / {team.total}</span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest pl-1">출근 완료 ({teamAttendance[selectedTeamIndex].present}명)</h4>
                  <div className="grid gap-2">
                    {teamAttendance[selectedTeamIndex].presentList.map((person, pIdx) => (
                      <div key={`p-${pIdx}`} className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <div>
                            <span className="text-sm font-black text-foreground">{person.name}</span>
                            <span className="ml-2 text-[10px] font-bold text-muted-foreground/40">{person.position}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {format(new Date(person.clockIn), 'HH:mm')} 출근
                        </span>
                      </div>
                    ))}
                    {teamAttendance[selectedTeamIndex].presentList.length === 0 && (
                      <p className="py-4 text-center text-muted-foreground/30 font-bold text-xs">출근 인원이 없습니다.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-red-500 uppercase tracking-widest pl-1">미출근 ({teamAttendance[selectedTeamIndex].absentList.length}명)</h4>
                  <div className="grid gap-2">
                    {teamAttendance[selectedTeamIndex].absentList.map((person, aIdx) => (
                      <div key={`a-${aIdx}`} className="flex items-center justify-between p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                        <div className="flex items-center gap-3 opacity-50">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <div>
                            <span className="text-sm font-black text-foreground">{person.name}</span>
                            <span className="ml-2 text-[10px] font-bold text-muted-foreground/40">{person.position}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                          미출근
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {teamAttendance.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <Users className="w-16 h-16 mx-auto text-muted-foreground/10" />
                <p className="text-muted-foreground/30 font-black">데이터를 불러오는 중이거나 인원이 없습니다.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border shrink-0">
            <Button 
              className="w-full h-14 bg-card border border-border rounded-2xl font-black text-foreground hover:bg-muted"
              onClick={() => setIsPresenceDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoticeDialogOpen} onOpenChange={setIsNoticeDialogOpen}>
        <DialogContent className="bg-card border-border rounded-3xl text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> 새 공지사항 등록
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold">전체 사원에게 공지합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              value={newNotice.title} 
              onChange={e => setNewNotice({...newNotice, title: e.target.value})}
              placeholder="제목" className="bg-muted border-border text-foreground rounded-xl h-12" 
            />
            <Textarea 
              value={newNotice.content}
              onChange={e => setNewNotice({...newNotice, content: e.target.value})}
              placeholder="내용" className="bg-muted border-border text-foreground rounded-xl min-h-[150px]" 
            />
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newNotice.isImportant} onChange={e => setNewNotice({...newNotice, isImportant: e.target.checked})} className="rounded bg-muted border-border" />
                  <span className="text-xs font-bold">중요 공지</span>
               </div>
               <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newNotice.shouldNotify} onChange={e => setNewNotice({...newNotice, shouldNotify: e.target.checked})} className="rounded bg-muted border-border" />
                  <span className="text-xs font-bold">푸시 알림</span>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddNotice} className="w-full bg-primary text-primary-foreground font-black h-12 rounded-xl">등록하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Clock-In Health Dialog */}
      <Dialog open={isClockInHealthDialogOpen} onOpenChange={setIsClockInHealthDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-center pt-4">오늘의 몸 상태는 어떠신가요?</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground/40 font-bold">
              안전한 업무를 위해 현재 컨디션을 체크해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-6">
            <button
               onClick={() => confirmClockIn('GOOD')}
               className="flex flex-col items-center gap-3 p-4 bg-muted hover:bg-emerald-500/20 rounded-3xl border border-border transition-all group"
            >
               <span className="text-3xl">😊</span>
               <span className="text-xs font-black text-muted-foreground/60 group-hover:text-emerald-500">좋음</span>
            </button>
            <button
               onClick={() => confirmClockIn('NORMAL')}
               className="flex flex-col items-center gap-3 p-4 bg-muted hover:bg-amber-500/20 rounded-3xl border border-border transition-all group"
            >
               <span className="text-3xl">😐</span>
               <span className="text-xs font-black text-muted-foreground/60 group-hover:text-amber-500">보통</span>
            </button>
            <button
               onClick={() => confirmClockIn('BAD')}
               className="flex flex-col items-center gap-3 p-4 bg-muted hover:bg-rose-500/20 rounded-3xl border border-border transition-all group"
            >
               <span className="text-3xl">☹️</span>
               <span className="text-xs font-black text-muted-foreground/60 group-hover:text-rose-500">나쁨</span>
            </button>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" className="text-muted-foreground/20 hover:text-foreground" onClick={() => setIsClockInHealthDialogOpen(false)}>
              나중에 하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
