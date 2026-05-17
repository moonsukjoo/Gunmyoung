import React, { useEffect, useState } from 'react';
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
  User as UserIcon,
  FileBox,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  MapPin,
  RefreshCw,
  FileBarChart,
  Utensils,
  Lock
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, limit, orderBy, getDocs, Timestamp } from 'firebase/firestore';
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

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
  const [recentAccidents, setRecentAccidents] = useState<AccidentCase[]>([]);
  const [selectedAccident, setSelectedAccident] = useState<AccidentCase | null>(null);
  const [healthStatus, setHealthStatus] = useState<'GOOD' | 'NORMAL' | 'BAD'>('GOOD');
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [newNotice, setNewNotice] = useState({ title: '', content: '', isImportant: false, shouldNotify: true });
  const [userTrend, setUserTrend] = useState<number>(0);
  const [isClockInHealthDialogOpen, setIsClockInHealthDialogOpen] = useState(false);
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

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    openAccidents: 0
  });
  const [pendingTrainings, setPendingTrainings] = useState(0);

  // Specific restrictions as requested: Hide for 조장, 반장, 사원
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

  const canReportAccident = profile && (
    ['CEO', 'SAFETY_MANAGER'].includes(profile.role) || 
    (profile.permissions?.includes('accident_mgmt') && !isExcludedRole)
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
    const q = query(
      collection(db, 'attendance'), 
      where('uid', '==', profile.uid),
      where('date', '==', today),
      limit(1)
    );

    const unsubscribeAttendance = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        setTodayAttendance({ id: docData.id, ...docData.data() } as Attendance);
      } else {
        setTodayAttendance(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    });

    // Notices for everyone
    const noticeQ = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribeNotices = onSnapshot(noticeQ, (snapshot) => {
      setRecentNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notices');
    });

    // Accidents for everyone
    const accidentQ = query(
      collection(db, 'accidentCases'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubscribeAccidents = onSnapshot(accidentQ, (snapshot) => {
      setRecentAccidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccidentCase)));
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
      unsubscribeAttendance();
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

      await Promise.all(notificationPromises);
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
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const status = now.getHours() >= 9 && now.getMinutes() > 0 ? 'LATE' : 'PRESENT';

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

      await addDoc(collection(db, 'attendance'), {
        uid: profile.uid,
        date: today,
        clockIn: now.toISOString(),
        status: leave?.type === 'ANNUAL' ? 'LEAVE' : status,
        healthStatus: selectedHealth,
        displayName: profile?.displayName || '이름없음',
        departmentId: profile.departmentId || '',
        departmentName: profile.departmentName || '미지정',
        leaveType: leave?.type || null
      });

      setHealthStatus(selectedHealth);
      await sendHealthNotification(selectedHealth);
      setIsClockInHealthDialogOpen(false);
      toast.success('출근 처리 완료', {
        description: `${format(now, 'HH:mm')}에 정상적으로 출근 처리되었습니다.`
      });
    } catch (error) {
      console.error("Clock-in error:", error);
      toast.error('출근 처리 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance || !profile) return;
    try {
      const now = new Date();
      const { workHours, overtimeHours } = calculateAttendanceHours(todayAttendance.clockIn, now);
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        clockOut: now.toISOString(),
        workHours,
        overtimeHours
      });
      toast.success('퇴근 처리 완료', {
        description: `${format(now, 'HH:mm')}에 안전하게 퇴근 처리되었습니다.`
      });
    } catch (error) {
      console.error("Clock-out error:", error);
      toast.error('퇴근 처리 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.WRITE, `attendance/${todayAttendance.id}`);
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

  return (
    <div className="w-full space-y-7 pb-32 px-4 overflow-x-hidden bg-background">
      {/* 1. Header & Banner */}
      <header className="pt-8 space-y-3">
        {bannerText && (
          <div className="bg-primary/5 border-y border-primary/10 py-2.5 -mx-4 overflow-hidden">
            <div className="flex whitespace-nowrap animate-marquee">
              <p className="inline-block text-[11px] font-black text-primary px-4">
                {bannerText} • Safety First • ALWAYS BE CAREFUL • {profile?.displayName}님 환영합니다 • {bannerText}
              </p>
              <p className="inline-block text-[11px] font-black text-primary px-4">
                {bannerText} • Safety First • ALWAYS BE CAREFUL • {profile?.displayName}님 환영합니다 • {bannerText}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">
            Safety First Dashboard
          </p>
          <div className="h-px flex-1 bg-border/30" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-black text-foreground tracking-tighter leading-tight flex-1">
            {profile?.displayName}님, <br/>
            오늘도 <span className="text-primary">안전하게</span> 작업하세요!
          </h1>
          {workingDays && (
             <div className="shrink-0 flex flex-col items-end">
               <Badge variant="secondary" className="rounded-xl font-black text-[11px] py-1 bg-primary/10 text-primary border-none">
                 D+{workingDays}
               </Badge>
             </div>
          )}
        </div>
      </header>

      {/* 2. Core Operational Actions */}
      <section className="grid grid-cols-2 gap-3">
        {/* Attendance */}
        {!todayAttendance ? (
          <Card 
            className="bg-blue-600 border-none rounded-[2rem] p-4 cursor-pointer active:scale-95 transition-all shadow-lg shadow-blue-500/20 h-32 flex flex-col justify-between relative overflow-hidden"
            onClick={handleClockIn}
          >
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Check-In</p>
              <h3 className="text-lg font-black text-white">출근하기</h3>
            </div>
          </Card>
        ) : !todayAttendance.clockOut ? (
          <Card 
            className="bg-rose-600 border-none rounded-[2rem] p-4 cursor-pointer active:scale-95 transition-all shadow-lg shadow-rose-500/20 h-32 flex flex-col justify-between relative overflow-hidden"
            onClick={handleClockOut}
          >
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Check-Out</p>
              <h3 className="text-lg font-black text-white">퇴근하기</h3>
            </div>
          </Card>
        ) : (
          <Card className="bg-muted/40 border border-border/50 rounded-[2rem] p-4 h-32 flex flex-col justify-between">
             <div className="w-10 h-10 bg-background/50 rounded-2xl flex items-center justify-center text-muted-foreground/30">
               <CheckCircle className="w-5 h-5" />
             </div>
             <h3 className="text-xs font-black text-muted-foreground/40 leading-tight">오늘의 근무가<br/>종료되었습니다</h3>
          </Card>
        )}

        {/* Safety Check */}
        <Card 
          className="bg-[#2a261a] border-none rounded-[2rem] p-4 cursor-pointer hover:bg-[#342f20] transition-all group shadow-lg h-32 flex flex-col justify-between relative overflow-hidden"
          onClick={() => navigate('/work-instruction')}
        >
          <div className="w-10 h-10 bg-amber-500/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-amber-500">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[8px] font-black text-amber-500/30 uppercase tracking-widest leading-none mb-1">Compliance</p>
            <h3 className="text-lg font-black text-white">작업지시·점검</h3>
          </div>
        </Card>
      </section>

      {/* 3. Services Layout (Compact Grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-primary" /> 업무 및 편의 서비스
          </h4>
        </div>
        
        <div className="grid grid-cols-4 gap-y-6 gap-x-2">
          {[
            { label: '작업일지', icon: ClipboardList, to: '/personal-work-log', color: 'bg-emerald-500/10 text-emerald-600' },
            { label: '식사신청', icon: Utensils, to: '/meal-request', color: 'bg-orange-500/10 text-orange-600' },
            { label: '보건보고', icon: Activity, to: '/health-mgmt', color: 'bg-rose-500/10 text-rose-600' },
            { label: '교육센터', icon: BookOpen, to: '/training', color: 'bg-purple-500/10 text-purple-600' },
            { label: '칭찬하기', icon: Heart, to: '/praise-feed', color: 'bg-pink-500/10 text-pink-600' },
            { label: '선박게임', icon: Ship, to: '/ship-assembly', color: 'bg-blue-500/10 text-blue-600' },
            { label: '안전랭킹', icon: Trophy, to: '/safety-leaderboard', color: 'bg-amber-500/10 text-amber-600' },
            { label: '연차신청', icon: CalendarDays, to: '/leave', color: 'bg-indigo-500/10 text-indigo-600' },
          ].map((item, idx) => (
            <button 
              key={idx}
              onClick={() => navigate(item.to)}
              className="flex flex-col items-center gap-2 group active:scale-90 transition-all text-center"
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all", item.color)}>
                <item.icon className={cn("w-6 h-6", item.label === '칭찬하기' && "fill-current")} />
              </div>
              <span className="text-[10px] font-bold text-foreground/70 tracking-tighter leading-tight break-keep px-1">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Notice Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] flex items-center gap-2">
            <Megaphone className="w-3 h-3" /> 최근 공지사항
          </h4>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[10px] font-black text-primary hover:bg-primary/5 rounded-full"
            onClick={() => navigate('/notices')}
          >
            더보기 <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <Card className="bg-card border border-border/50 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="divide-y divide-border/30">
            {recentNotices.length > 0 ? (
              recentNotices.map((notice) => (
                <div 
                  key={notice.id} 
                  className="p-4 hover:bg-muted/40 active:bg-muted transition-colors cursor-pointer group"
                  onClick={() => setSelectedNotice(notice)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {notice.isImportant && (
                          <Badge className="bg-rose-500 hover:bg-rose-600 text-[8px] font-black h-4 px-1.5 rounded-sm shrink-0">URGENT</Badge>
                        )}
                        <h3 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {notice.title}
                        </h3>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 line-clamp-1">
                        {notice.content}
                      </p>
                    </div>
                    <span className="text-[9px] font-medium text-muted-foreground/30 whitespace-nowrap mt-1">
                      {format(new Date(notice.createdAt), 'MM/dd')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-muted-foreground/30 font-bold text-xs uppercase tracking-widest">
                No recent notices
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 5. Special Admin Features (Manager/Supervisor only) */}
      {(isSupervisor || isManager || canManageMeal) && (
        <section className="space-y-4 pt-4 border-t border-border/30">
          <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <Lock className="w-3 h-3" /> 관리 지원 모듈
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {isSupervisor && (
              <button 
                onClick={() => navigate('/work-instruction-mgmt')} 
                className="flex items-center gap-3 p-4 bg-rose-500/[0.03] border border-rose-500/10 rounded-2xl text-left hover:bg-rose-500/[0.06] transition-all"
              >
                <div className="w-9 h-9 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-black text-foreground/80 leading-tight">작업지시<br/>관리</span>
              </button>
            )}
            {isManager && (
              <button 
                onClick={fetchTeamAttendance} 
                className="flex items-center gap-3 p-4 bg-blue-500/[0.03] border border-blue-500/10 rounded-2xl text-left hover:bg-blue-500/[0.06] transition-all"
              >
                <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-black text-foreground/80 leading-tight">팀 출근<br/>현황</span>
              </button>
            )}
            {isManager && (
              <button 
                onClick={() => setIsNoticeDialogOpen(true)} 
                className="flex items-center gap-3 p-4 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-2xl text-left hover:bg-emerald-500/[0.06] transition-all"
              >
                <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-black text-foreground/80 leading-tight">공지사항<br/>등록</span>
              </button>
            )}
            {canReportAccident && (
              <button 
                onClick={() => navigate('/accidents')} 
                className="flex items-center gap-3 p-4 bg-rose-500/[0.03] border border-rose-500/10 rounded-2xl text-left hover:bg-rose-500/[0.06] transition-all"
              >
                <div className="w-9 h-9 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-black text-foreground/80 leading-tight">사고사례<br/>등록</span>
              </button>
            )}
            {canManageMeal && (
              <button 
                onClick={() => navigate('/meal-mgmt')} 
                className="col-span-2 flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:bg-muted transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-black text-foreground/80">식사·간식 신청 내역 관리</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* Fixed Bottom Quick Navigator */}
      <div className="fixed bottom-6 left-4 right-4 z-40">
        <nav className="bg-background/80 backdrop-blur-xl border border-border/50 p-2 rounded-[2.5rem] flex justify-between gap-1 shadow-2xl ring-1 ring-black/5">
          <Button 
            variant="ghost" 
            className="flex-1 rounded-full h-11 text-[10px] font-black text-muted-foreground/60 hover:text-foreground active:bg-muted transition-all" 
            onClick={() => navigate('/notices')}
          >
            📢 공지사항
          </Button>
          <div className="w-px h-4 bg-border/50 self-center" />
          <Button 
            variant="ghost" 
            className="flex-1 rounded-full h-11 text-[10px] font-black text-muted-foreground/60 hover:text-foreground active:bg-muted transition-all" 
            onClick={() => navigate('/accidents')}
          >
            ⚠️ 사고사례
          </Button>
          <div className="w-px h-4 bg-border/50 self-center" />
          <Button 
            variant="ghost" 
            className="flex-1 rounded-full h-11 text-[10px] font-black text-muted-foreground/60 hover:text-foreground active:bg-muted transition-all" 
            onClick={() => navigate('/leave')}
          >
            📅 연차신청
          </Button>
        </nav>
      </div>

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
          <DialogFooter className="p-8 pt-4 bg-muted/50 border-t border-border">
            <Button className="w-full h-12 rounded-xl font-black bg-foreground text-background hover:bg-foreground/90" onClick={() => setSelectedNotice(null)}>확인</Button>
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
