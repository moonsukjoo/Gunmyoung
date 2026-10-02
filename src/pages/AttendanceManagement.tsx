import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  where, 
  orderBy,
  deleteDoc,
  setDoc,
  addDoc
} from 'firebase/firestore';
import { UserProfile, Attendance } from '@/types';
import { format, startOfMonth, endOfMonth, parseISO, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Users, 
  Search, 
  Calendar, 
  Clock, 
  Edit2, 
  Save, 
  X, 
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  AlertCircle,
  ArrowLeft,
  Calculator,
  Download,
  FileText,
  LogIn,
  LogOut,
  BarChart3,
  PieChart as PieIcon,
  Copy,
  Check,
  Send,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Filter,
  UserCheck,
  UserX,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { calculateAttendanceHours } from '@/lib/attendance';
import { checkIsSpecialDay } from '@/lib/holidays';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { sendPushNotification } from '@/services/notificationService';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid
} from 'recharts';

import { GlowLoading } from '@/components/GlowLoading';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

export const AttendanceManagement: React.FC = () => {
  const navigate = useNavigate();
  
  // Tab control: 'daily' (일별 출퇴근 집계) | 'monthly' (사원별 월간 조회/수정) | 'special' (특별 1.5배 근무일)
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'special'>('daily');

  // Core Data State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [specialDates, setSpecialDates] = useState<Record<string, any>>({});
  
  // Daily Roster Tab State
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [dailyAttendanceList, setDailyAttendanceList] = useState<Attendance[]>([]);
  const [dailySearch, setDailySearch] = useState('');
  const [dailyDeptFilter, setDailyDeptFilter] = useState<string>('ALL');
  const [dailyStatusFilter, setDailyStatusFilter] = useState<'ALL' | 'SIGNED_IN' | 'UNSIGNED_IN' | 'SIGNED_OUT' | 'WORKING'>('ALL');
  const [isCopied, setIsCopied] = useState(false);

  // Category Detail Modal State (출근 서명 / 퇴근 서명 / 미출근 서명 / 근무중 / 전체)
  const [categoryModalType, setCategoryModalType] = useState<'ALL' | 'SIGNED_IN' | 'UNSIGNED_IN' | 'SIGNED_OUT' | 'WORKING' | null>(null);
  const [categoryModalSearch, setCategoryModalSearch] = useState('');
  const [categoryModalDept, setCategoryModalDept] = useState('ALL');
  const [isCategoryCopied, setIsCategoryCopied] = useState(false);

  // Manual Attendance Modal State (Quick Sign / Edit)
  const [manualModalUser, setManualModalUser] = useState<UserProfile | null>(null);
  const [manualModalAtt, setManualModalAtt] = useState<Attendance | null>(null);
  const [manualForm, setManualForm] = useState({
    clockIn: '08:00',
    clockOut: '17:00',
    status: 'PRESENT' as 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE',
    memo: ''
  });
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Monthly Detail Tab State
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chartTab, setChartTab] = useState<'ratio' | 'trend'>('ratio');
  const [editForm, setEditForm] = useState<{
    clockIn: string;
    clockOut: string;
    workHours: string;
    overtimeHours: string;
  }>({
    clockIn: '',
    clockOut: '',
    workHours: '',
    overtimeHours: ''
  });

  // Special Date Management State
  const [newSpecialDate, setNewSpecialDate] = useState('');
  const [newSpecialLabel, setNewSpecialLabel] = useState('');

  // 1. Fetch Special Dates
  useEffect(() => {
    const q = query(collection(db, 'specialDates'), orderBy('date', 'asc'));
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
      handleFirestoreError(error, OperationType.LIST, 'specialDates');
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch All Active Users
  useEffect(() => {
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 600));
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      await minLoadTime;
      setInitialLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setInitialLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Fetch Daily Attendance Records for Selected Date
  useEffect(() => {
    const q = query(
      collection(db, 'attendance'),
      where('date', '==', selectedDailyDate)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dayAtts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
      setDailyAttendanceList(dayAtts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance_daily');
    });
    return () => unsubscribe();
  }, [selectedDailyDate]);

  // 4. Fetch Monthly Attendance for Selected User
  useEffect(() => {
    if (!selectedUser) {
      setAttendanceData([]);
      return;
    }

    setLoadingMonthly(true);
    const start = startOfMonth(parseISO(month + '-01'));
    const end = endOfMonth(start);

    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', selectedUser.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd')),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAttendanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
      setLoadingMonthly(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance_user_month');
      setLoadingMonthly(false);
    });

    return () => unsubscribe();
  }, [selectedUser, month]);

  // Extract unique active departments
  const departmentList = useMemo(() => {
    const activeUsers = users.filter(u => u.status === 'ACTIVE' || !u.status);
    const set = new Set<string>();
    activeUsers.forEach(u => {
      if (u.departmentName) set.add(u.departmentName);
    });
    return ['ALL', ...Array.from(set)];
  }, [users]);

  // Active Users List (excluding resigned/inactive)
  const activeUsers = useMemo(() => {
    return users.filter(u => u.status === 'ACTIVE' || !u.status);
  }, [users]);

  // Calculate Daily Summary Metrics
  const dailySummary = useMemo(() => {
    const totalCount = activeUsers.length;
    let clockInSignedCount = 0;
    let clockOutSignedCount = 0;
    let workingCount = 0;

    activeUsers.forEach(u => {
      const att = dailyAttendanceList.find(a => a.uid === u.uid);
      if (att && att.clockIn) {
        clockInSignedCount++;
        if (att.clockOut) {
          clockOutSignedCount++;
        } else {
          workingCount++;
        }
      }
    });

    const notClockedInCount = Math.max(0, totalCount - clockInSignedCount);
    const attendanceRate = totalCount > 0 ? Math.round((clockInSignedCount / totalCount) * 100) : 0;

    return {
      totalCount,
      clockInSignedCount,
      notClockedInCount,
      clockOutSignedCount,
      workingCount,
      attendanceRate
    };
  }, [activeUsers, dailyAttendanceList]);

  // Group Active Users by Department for Daily Roster Display
  const groupedDepartmentRoster = useMemo(() => {
    const map: Record<string, Array<{ user: UserProfile; att: Attendance | null }>> = {};

    activeUsers.forEach(user => {
      const dept = user.departmentName || '기타/미지정';
      if (!map[dept]) map[dept] = [];
      const att = dailyAttendanceList.find(a => a.uid === user.uid) || null;
      map[dept].push({ user, att });
    });

    // Apply Filter & Search
    const result: Array<{
      deptName: string;
      total: number;
      signedIn: number;
      unsignedIn: number;
      signedOut: number;
      rate: number;
      members: Array<{ user: UserProfile; att: Attendance | null }>;
    }> = [];

    Object.keys(map).forEach(deptName => {
      if (dailyDeptFilter !== 'ALL' && deptName !== dailyDeptFilter) return;

      const allDeptMembers = map[deptName];
      const deptTotal = allDeptMembers.length;
      const signedIn = allDeptMembers.filter(m => m.att?.clockIn).length;
      const unsignedIn = deptTotal - signedIn;
      const signedOut = allDeptMembers.filter(m => m.att?.clockOut).length;
      const rate = deptTotal > 0 ? Math.round((signedIn / deptTotal) * 100) : 0;

      // Filter members based on search and status filter
      const filteredMembers = allDeptMembers.filter(({ user, att }) => {
        const matchesSearch = 
          (user.displayName?.toLowerCase() || '').includes(dailySearch.toLowerCase()) ||
          (user.employeeId?.toLowerCase() || '').includes(dailySearch.toLowerCase()) ||
          (user.position?.toLowerCase() || '').includes(dailySearch.toLowerCase());

        let matchesStatus = true;
        if (dailyStatusFilter === 'SIGNED_IN') matchesStatus = !!att?.clockIn;
        else if (dailyStatusFilter === 'UNSIGNED_IN') matchesStatus = !att?.clockIn;
        else if (dailyStatusFilter === 'SIGNED_OUT') matchesStatus = !!att?.clockOut;
        else if (dailyStatusFilter === 'WORKING') matchesStatus = !!att?.clockIn && !att?.clockOut;

        return matchesSearch && matchesStatus;
      });

      if (filteredMembers.length > 0 || (dailySearch === '' && dailyStatusFilter === 'ALL')) {
        result.push({
          deptName,
          total: deptTotal,
          signedIn,
          unsignedIn,
          signedOut,
          rate,
          members: filteredMembers
        });
      }
    });

    return result;
  }, [activeUsers, dailyAttendanceList, dailyDeptFilter, dailySearch, dailyStatusFilter]);

  // 1-Click Copy Attendance Roster to Clipboard for Messenger/Reporting
  const handleCopyRosterText = () => {
    try {
      const dateText = format(parseISO(selectedDailyDate), 'yyyy년 MM월 dd일 (EEEE)', { locale: ko });
      let text = `[건명기업] ${dateText} 일별 출퇴근 서명 집계 현황\n`;
      text += `총원 ${dailySummary.totalCount}명 | 출근서명 O: ${dailySummary.clockInSignedCount}명 (${dailySummary.attendanceRate}%) | 미출근 서명 X: ${dailySummary.notClockedInCount}명\n`;
      text += `퇴근서명 O: ${dailySummary.clockOutSignedCount}명 | 근무중: ${dailySummary.workingCount}명\n\n`;

      groupedDepartmentRoster.forEach(group => {
        text += `■ ${group.deptName} (총 ${group.total}명 / 출근 ${group.signedIn}명 / 미출근 ${group.unsignedIn}명)\n`;
        group.members.forEach(({ user, att }) => {
          const inSign = att?.clockIn 
            ? `출근서명 O (${format(new Date(att.clockIn), 'HH:mm')})` 
            : `출근서명 X (미출근)`;
          const outSign = att?.clockOut 
            ? `퇴근서명 O (${format(new Date(att.clockOut), 'HH:mm')})` 
            : att?.clockIn 
              ? `퇴근서명 X (근무중)` 
              : `퇴근서명 X`;
          
          text += ` - ${user.displayName || '이름없음'} ${user.position || '사원'}: ${inSign} | ${outSign}\n`;
        });
        text += `\n`;
      });

      text += `* 건명기업 스마트 안전/근태 관리 시스템 자동 집계`;

      navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('카카오톡/사내 보고용 출퇴근 집계 명단이 복사되었습니다!');
      setTimeout(() => setIsCopied(false), 3000);
    } catch (e) {
      toast.error('복사 중 오류가 발생했습니다.');
    }
  };

  // 1-Click Export Daily Roster to Excel
  const handleExportDailyExcel = () => {
    if (activeUsers.length === 0) {
      toast.error('출력할 인원이 없습니다.');
      return;
    }

    const rows: any[] = [];
    groupedDepartmentRoster.forEach(group => {
      group.members.forEach(({ user, att }) => {
        rows.push({
          '날짜': selectedDailyDate,
          '부서/팀': user.departmentName || '기타',
          '사번': user.employeeId || '-',
          '성명': user.displayName,
          '직급': user.position || '사원',
          '출근서명여부': att?.clockIn ? 'O' : 'X',
          '출근시각': att?.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '미출근',
          '퇴근서명여부': att?.clockOut ? 'O' : 'X',
          '퇴근시각': att?.clockOut ? format(new Date(att.clockOut), 'HH:mm') : (att?.clockIn ? '근무중' : '-'),
          '기본근무(h)': att?.workHours || 0,
          '연장근무(h)': att?.overtimeHours || 0,
          '상태': att?.status || (att?.clockIn ? 'PRESENT' : 'ABSENT')
        });
      });
    });

    exportToExcel(rows, `건명기업_출퇴근집계_${selectedDailyDate}`, '일별근태명단');
  };

  // 1-Click Export Daily Roster to PDF
  const handleExportDailyPDF = async () => {
    if (activeUsers.length === 0) {
      toast.error('출력할 인원이 없습니다.');
      return;
    }

    const headers = ['부서/팀', '성명', '직급', '출근서명', '출근시각', '퇴근서명', '퇴근시각', '기본/연장'];
    const rows: any[] = [];

    groupedDepartmentRoster.forEach(group => {
      group.members.forEach(({ user, att }) => {
        rows.push([
          user.departmentName || '기타',
          user.displayName || '-',
          user.position || '사원',
          att?.clockIn ? 'O' : 'X',
          att?.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '미출근',
          att?.clockOut ? 'O' : 'X',
          att?.clockOut ? format(new Date(att.clockOut), 'HH:mm') : (att?.clockIn ? '근무중' : '-'),
          `${att?.workHours?.toFixed(1) || '0.0'}h / +${att?.overtimeHours?.toFixed(1) || '0.0'}h`
        ]);
      });
    });

    await exportToPDF(
      `건명기업 일별 출퇴근 서명 집계 현황 (${selectedDailyDate})`,
      headers,
      rows,
      `건명기업_출퇴근집계_${selectedDailyDate}`
    );
  };

  // Open Quick Manual Sign Dialog
  const openManualSignDialog = (user: UserProfile, att: Attendance | null) => {
    setManualModalUser(user);
    setManualModalAtt(att);
    setManualForm({
      clockIn: att?.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '08:00',
      clockOut: att?.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '',
      status: (att?.status as any) || 'PRESENT',
      memo: att?.memo || ''
    });
  };

  // Save Quick Manual Attendance Record
  const handleSaveManualAttendance = async () => {
    if (!manualModalUser) return;
    setIsSavingManual(true);
    try {
      const attId = `${manualModalUser.uid}_${selectedDailyDate}`;
      const [inH, inM] = manualForm.clockIn.split(':').map(Number);
      
      const inDate = new Date(`${selectedDailyDate}T00:00:00`);
      inDate.setHours(inH || 8, inM || 0, 0, 0);

      let outDate: Date | null = null;
      if (manualForm.clockOut) {
        const [outH, outM] = manualForm.clockOut.split(':').map(Number);
        outDate = new Date(`${selectedDailyDate}T00:00:00`);
        outDate.setHours(outH || 17, outM || 0, 0, 0);
      }

      const isSpecialVal = checkIsSpecialDay(inDate, specialDates).isSpecial;
      const { workHours, overtimeHours } = outDate 
        ? calculateAttendanceHours(inDate.toISOString(), outDate, isSpecialVal)
        : { workHours: 0, overtimeHours: 0 };

      const docData: any = {
        uid: manualModalUser.uid,
        date: selectedDailyDate,
        clockIn: inDate.toISOString(),
        clockOut: outDate ? outDate.toISOString() : null,
        workHours,
        overtimeHours,
        status: manualForm.status,
        memo: manualForm.memo || '관리자 수동 서명 등록',
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'attendance', attId), docData, { merge: true });
      toast.success(`${manualModalUser.displayName} 님의 ${selectedDailyDate} 근태 서명이 등록/수정되었습니다.`);
      setManualModalUser(null);
    } catch (e) {
      console.error(e);
      toast.error('근태 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingManual(false);
    }
  };

  // Broadcast push nudge to all unsigned workers
  const handleNudgeUnsignedWorkers = async () => {
    const unsigned = activeUsers.filter(u => !dailyAttendanceList.some(a => a.uid === u.uid && a.clockIn));
    if (unsigned.length === 0) {
      toast.info('오늘 미출근자가 없습니다. 전원 출근 완료되었습니다!');
      return;
    }

    try {
      // Create in-app system notifications
      const batchPromises = unsigned.map(u => 
        addDoc(collection(db, 'notifications'), {
          userId: u.uid,
          title: '⏰ [건명기업] 출근 서명 확인 요청',
          message: `${u.displayName} 님, 금일 출근 서명이 아직 등록되지 않았습니다. 앱에서 출근 체크를 완료해 주세요.`,
          type: 'ATTENDANCE_NUDGE',
          createdAt: new Date().toISOString(),
          read: false
        })
      );
      await Promise.all(batchPromises);

      // Local push toast
      sendPushNotification('출근 서명 안내', {
        body: `미출근 사원 ${unsigned.length}명에게 출근 확인 알림을 전송했습니다.`,
        tag: 'attendance-nudge'
      }).catch(() => {});

      toast.success(`미출근 사원 ${unsigned.length}명에게 출근 확인 알림을 성공적으로 발송했습니다.`);
    } catch (e) {
      toast.error('알림 발송 중 오류가 발생했습니다.');
    }
  };

  // Individual push nudge
  const handleIndividualNudge = async (targetUser: UserProfile) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: targetUser.uid,
        title: '⏰ [건명기업] 출근 서명 확인 요청',
        message: `${targetUser.displayName} 님, 금일(${selectedDailyDate}) 출근 서명이 아직 등록되지 않았습니다. 앱에서 출근 체크를 완료해 주세요.`,
        type: 'ATTENDANCE_NUDGE',
        createdAt: new Date().toISOString(),
        read: false
      });
      toast.success(`${targetUser.displayName} 님에게 출근 확인 알림을 발송했습니다.`);
    } catch (e) {
      toast.error('알림 발송 중 오류가 발생했습니다.');
    }
  };

  // Filtered workers list for Category Detail Modal
  const categoryModalWorkers = useMemo(() => {
    if (!categoryModalType) return [];

    return activeUsers
      .map(user => {
        const att = dailyAttendanceList.find(a => a.uid === user.uid) || null;
        return { user, att };
      })
      .filter(({ user, att }) => {
        // 1. Filter by status category
        if (categoryModalType === 'SIGNED_IN' && !att?.clockIn) return false;
        if (categoryModalType === 'UNSIGNED_IN' && !!att?.clockIn) return false;
        if (categoryModalType === 'SIGNED_OUT' && !att?.clockOut) return false;
        if (categoryModalType === 'WORKING' && (!att?.clockIn || !!att?.clockOut)) return false;

        // 2. Filter by department
        if (categoryModalDept !== 'ALL' && (user.departmentName || '기타/미지정') !== categoryModalDept) {
          return false;
        }

        // 3. Filter by search query
        if (categoryModalSearch) {
          const q = categoryModalSearch.toLowerCase();
          const matchName = (user.displayName || '').toLowerCase().includes(q);
          const matchDept = (user.departmentName || '').toLowerCase().includes(q);
          const matchPos = (user.position || '').toLowerCase().includes(q);
          const matchEmpId = (user.employeeId || '').toLowerCase().includes(q);
          if (!matchName && !matchDept && !matchPos && !matchEmpId) return false;
        }

        return true;
      });
  }, [activeUsers, dailyAttendanceList, categoryModalType, categoryModalDept, categoryModalSearch]);

  // Copy Category Modal worker list to clipboard
  const handleCopyCategoryModalText = () => {
    try {
      const configMap: Record<string, string> = {
        ALL: '전체 재적 인원 명단',
        SIGNED_IN: '출근 서명 (O) 완료자 명단',
        UNSIGNED_IN: '미출근 서명 (X) 대상자 명단',
        SIGNED_OUT: '퇴근 서명 (O) 완료자 명단',
        WORKING: '현재 근무 중 인원 명단'
      };
      const title = configMap[categoryModalType || 'ALL'] || '근태 명단';
      let text = `[건명기업] ${selectedDailyDate} ${title} (총 ${categoryModalWorkers.length}명)\n\n`;
      categoryModalWorkers.forEach(({ user, att }, index) => {
        const inStr = att?.clockIn ? `출근: O (${format(new Date(att.clockIn), 'HH:mm')})` : `출근: X (미출근)`;
        const outStr = att?.clockOut ? `퇴근: O (${format(new Date(att.clockOut), 'HH:mm')})` : (att?.clockIn ? `퇴근: X (근무중)` : `퇴근: -`);
        text += `${index + 1}. [${user.departmentName || '기타'}] ${user.displayName} ${user.position || '사원'} | ${inStr} | ${outStr}\n`;
      });
      navigator.clipboard.writeText(text);
      setIsCategoryCopied(true);
      toast.success('해당 명단이 클립보드에 복사되었습니다!');
      setTimeout(() => setIsCategoryCopied(false), 2500);
    } catch (e) {
      toast.error('복사 중 오류가 발생했습니다.');
    }
  };

  // Filtered users for monthly tab
  const filteredUsers = users.filter(u => 
    (u.displayName?.toLowerCase() || '').includes(userSearch.toLowerCase()) || 
    (u.departmentName?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
    (u.employeeId?.toLowerCase() || '').includes(userSearch.toLowerCase())
  );

  const startEditing = (att: Attendance) => {
    setEditingId(att.id);
    setEditForm({
      clockIn: att.clockIn ? format(new Date(att.clockIn), "yyyy-MM-dd'T'HH:mm") : '',
      clockOut: att.clockOut ? format(new Date(att.clockOut), "yyyy-MM-dd'T'HH:mm") : '',
      workHours: att.workHours?.toString() || '0',
      overtimeHours: att.overtimeHours?.toString() || '0'
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const updates: any = {
        workHours: parseFloat(editForm.workHours),
        overtimeHours: parseFloat(editForm.overtimeHours)
      };

      if (editForm.clockIn) {
        updates.clockIn = new Date(editForm.clockIn).toISOString();
      }
      if (editForm.clockOut) {
        updates.clockOut = new Date(editForm.clockOut).toISOString();
      } else {
        updates.clockOut = null;
      }

      await updateDoc(doc(db, 'attendance', id), updates);
      setEditingId(null);
      toast.success('근태 기록이 수정되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleRecalculate = () => {
    if (!editForm.clockIn || !editForm.clockOut) {
      toast.error('출근 시간과 퇴근 시간이 모두 필요합니다.');
      return;
    }

    const isSpecialVal = checkIsSpecialDay(new Date(editForm.clockIn), specialDates).isSpecial;

    const { workHours, overtimeHours } = calculateAttendanceHours(
      new Date(editForm.clockIn),
      new Date(editForm.clockOut),
      isSpecialVal
    );

    setEditForm({
      ...editForm,
      workHours: workHours.toString(),
      overtimeHours: overtimeHours.toString()
    });
    toast.success('근무 시간이 재계산되었습니다.');
  };

  const handleAddSpecialDate = async () => {
    if (!newSpecialDate) {
      toast.error('날짜를 입력해주세요.');
      return;
    }
    try {
      await setDoc(doc(db, 'specialDates', newSpecialDate), {
        date: newSpecialDate,
        label: newSpecialLabel || '특별 1.5배 근무일',
        createdAt: new Date().toISOString()
      });
      toast.success('특별 1.5배 근무일이 성공적으로 설정되었습니다!');
      setNewSpecialDate('');
      setNewSpecialLabel('');
    } catch (err) {
      console.error(err);
      toast.error('설정 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveSpecialDate = async (dateStr: string) => {
    try {
      await deleteDoc(doc(db, 'specialDates', dateStr));
      toast.success('특별 근무일이 제거되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const monthlyStats = useMemo(() => {
    const total = attendanceData.reduce((acc, curr) => acc + (curr.workHours || 0), 0);
    const ot = attendanceData.reduce((acc, curr) => acc + (curr.overtimeHours || 0), 0);
    return { total, ot };
  }, [attendanceData]);

  const monthlyChartData = useMemo(() => {
    if (attendanceData.length === 0) return [];
    const sortedData = [...attendanceData].sort((a, b) => a.date.localeCompare(b.date));
    return sortedData.map(att => {
      const dateObj = parseISO(att.date);
      const isSpecial = checkIsSpecialDay(dateObj, specialDates).isSpecial;
      const normalWork = isSpecial ? 0 : (att.workHours || 0);
      const normalOvertime = isSpecial ? 0 : (att.overtimeHours || 0);
      const specialWork = isSpecial ? (att.workHours || 0) : 0;
      const specialOvertime = isSpecial ? (att.overtimeHours || 0) : 0;
      return {
        date: format(dateObj, 'M/d'),
        fullDate: att.date,
        '일반 시간': normalWork + normalOvertime,
        '1.5배 가산 시간': specialWork + specialOvertime,
      };
    });
  }, [attendanceData, specialDates]);

  const summaryStats = useMemo(() => {
    let regularTotal = 0;
    let specialTotal = 0;
    attendanceData.forEach(att => {
      const dateObj = parseISO(att.date);
      const isSpecial = checkIsSpecialDay(dateObj, specialDates).isSpecial;
      const hours = (att.workHours || 0) + (att.overtimeHours || 0);
      if (isSpecial) {
        specialTotal += hours;
      } else {
        regularTotal += hours;
      }
    });
    const grandTotal = regularTotal + specialTotal;
    return {
      regularTotal,
      specialTotal,
      grandTotal,
      regularRatio: grandTotal > 0 ? Math.round((regularTotal / grandTotal) * 100) : 0,
      specialRatio: grandTotal > 0 ? Math.round((specialTotal / grandTotal) * 100) : 0,
    };
  }, [attendanceData, specialDates]);

  if (initialLoading) {
    return <GlowLoading />;
  }

  return (
    <div className="min-h-screen bg-background pb-24 selection:bg-blue-500/30 text-foreground">
      {/* Top Header */}
      <header className="p-4 sm:p-6 sticky top-0 bg-background/90 backdrop-blur-md z-[50] space-y-3.5 border-b border-border relative">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/admin')}
              className="text-foreground h-10 w-10 rounded-2xl bg-muted border border-border hover:bg-muted/80 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">건명기업 근태 지휘본부</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-none mt-0.5">
                출퇴근 명단 집계 & 근태 관리
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/pc/attendance-status')}
              className="hidden sm:flex text-xs font-black rounded-xl bg-muted/60 hover:bg-muted border-border gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5 text-teal-500" />
              PC 관제 대시보드
            </Button>
          </div>
        </div>

        {/* 3 Major Tab Navigation Buttons */}
        <div className="grid grid-cols-3 bg-muted/70 p-1 rounded-2xl border border-border/60 gap-1">
          <button
            onClick={() => setActiveTab('daily')}
            className={cn(
              "py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center",
              activeTab === 'daily'
                ? "bg-card text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">일별 집계표</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={cn(
              "py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center",
              activeTab === 'monthly'
                ? "bg-card text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">월간 상세/수정</span>
          </button>

          <button
            onClick={() => setActiveTab('special')}
            className={cn(
              "py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center",
              activeTab === 'special'
                ? "bg-card text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
            <span className="truncate">특별 1.5배일</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-3 sm:p-6 max-w-7xl mx-auto space-y-5">
        {/* ========================================================================= */}
        {/* TAB 1: DAILY ATTENDANCE ROSTER (일별 출퇴근 명단 집계 & O/X 서명 현황) */}
        {/* ========================================================================= */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            {/* 1. Date Navigation & Quick Actions Bar */}
            <Card className="bg-card border-border rounded-3xl p-3.5 sm:p-4 shadow-sm">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Date Navigator */}
                <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const prev = subDays(parseISO(selectedDailyDate), 1);
                      setSelectedDailyDate(format(prev, 'yyyy-MM-dd'));
                    }}
                    className="h-10 w-10 rounded-xl bg-muted border-border shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-muted/60 px-3 py-1.5 rounded-2xl border border-border h-10">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <Input
                      type="date"
                      value={selectedDailyDate}
                      onChange={(e) => e.target.value && setSelectedDailyDate(e.target.value)}
                      className="h-8 bg-transparent border-none text-xs font-black p-0 w-28 sm:w-32 text-center focus-visible:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-black text-muted-foreground hidden sm:inline">
                      ({format(parseISO(selectedDailyDate), 'EEEE', { locale: ko })})
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const next = addDays(parseISO(selectedDailyDate), 1);
                      setSelectedDailyDate(format(next, 'yyyy-MM-dd'));
                    }}
                    className="h-10 w-10 rounded-xl bg-muted border-border shrink-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDailyDate(format(new Date(), 'yyyy-MM-dd'))}
                    className="h-10 px-3 rounded-xl text-xs font-black bg-primary/10 text-primary hover:bg-primary/20 shrink-0"
                  >
                    오늘
                  </Button>
                </div>

                {/* Export & Copy Toolbar - Perfect 2-tier Grid on Mobile, Clean Row on Desktop */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Primary Action: Copy Roster */}
                  <Button
                    onClick={handleCopyRosterText}
                    className="h-10 w-full sm:w-auto px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? '명단 복사 완료!' : '📋 카톡/보고용 명단 복사'}
                  </Button>

                  {/* Secondary Actions: 3-column symmetric grid on mobile */}
                  <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2">
                    <Button
                      variant="outline"
                      onClick={handleExportDailyExcel}
                      className="h-10 px-2 sm:px-3 rounded-xl bg-muted text-foreground border-border text-xs font-black flex items-center justify-center gap-1 hover:bg-muted/80"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>엑셀</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleExportDailyPDF}
                      className="h-10 px-2 sm:px-3 rounded-xl bg-muted text-foreground border-border text-xs font-black flex items-center justify-center gap-1 hover:bg-muted/80"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>PDF</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleNudgeUnsignedWorkers}
                      className="h-10 px-2 sm:px-3 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30 text-xs font-black flex items-center justify-center gap-1 truncate"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">미출근 독려</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* 2. Key Metrics Summary Grid (Clickable to open detailed category popup) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <Card 
                onClick={() => {
                  setCategoryModalType('ALL');
                  setCategoryModalSearch('');
                  setCategoryModalDept('ALL');
                }}
                className="bg-card border-border hover:border-foreground/30 rounded-2xl p-3.5 relative overflow-hidden shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                    총 재적 인원
                  </span>
                  <Users className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                </div>
                <div className="text-2xl font-black text-foreground mt-1 flex items-baseline justify-between">
                  <div>
                    {dailySummary.totalCount}<span className="text-xs font-normal text-muted-foreground ml-0.5">명</span>
                  </div>
                  <span className="text-[9px] font-bold text-muted-foreground/70 group-hover:text-foreground flex items-center">
                    명단 보기 &rarr;
                  </span>
                </div>
              </Card>

              <Card 
                onClick={() => {
                  setCategoryModalType('SIGNED_IN');
                  setCategoryModalSearch('');
                  setCategoryModalDept('ALL');
                }}
                className="bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500 rounded-2xl p-3.5 relative overflow-hidden shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> 출근 서명 (O)
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-none text-[9px] font-black h-4 px-1.5">
                    {dailySummary.attendanceRate}%
                  </Badge>
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-baseline justify-between">
                  <div>
                    {dailySummary.clockInSignedCount}<span className="text-xs font-normal text-muted-foreground ml-0.5">명</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-400/70 group-hover:underline flex items-center">
                    확인 &rarr;
                  </span>
                </div>
              </Card>

              <Card 
                onClick={() => {
                  setCategoryModalType('UNSIGNED_IN');
                  setCategoryModalSearch('');
                  setCategoryModalDept('ALL');
                }}
                className="bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30 hover:border-rose-500 rounded-2xl p-3.5 relative overflow-hidden shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5" /> 미출근 서명 (X)
                  </span>
                  {dailySummary.notClockedInCount > 0 && (
                    <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-400 border-none text-[9px] font-black h-4 px-1.5 animate-pulse">
                      독려필요
                    </Badge>
                  )}
                </div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 flex items-baseline justify-between">
                  <div>
                    {dailySummary.notClockedInCount}<span className="text-xs font-normal text-muted-foreground ml-0.5">명</span>
                  </div>
                  <span className="text-[9px] font-bold text-rose-600/70 dark:text-rose-400/70 group-hover:underline flex items-center">
                    확인 &rarr;
                  </span>
                </div>
              </Card>

              <Card 
                onClick={() => {
                  setCategoryModalType('SIGNED_OUT');
                  setCategoryModalSearch('');
                  setCategoryModalDept('ALL');
                }}
                className="bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/30 hover:border-blue-500 rounded-2xl p-3.5 relative overflow-hidden shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
                    <LogOut className="w-3.5 h-3.5" /> 퇴근 서명 (O)
                  </span>
                </div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 flex items-baseline justify-between">
                  <div>
                    {dailySummary.clockOutSignedCount}<span className="text-xs font-normal text-muted-foreground ml-0.5">명</span>
                  </div>
                  <span className="text-[9px] font-bold text-blue-600/70 dark:text-blue-400/70 group-hover:underline flex items-center">
                    확인 &rarr;
                  </span>
                </div>
              </Card>

              <Card 
                onClick={() => {
                  setCategoryModalType('WORKING');
                  setCategoryModalSearch('');
                  setCategoryModalDept('ALL');
                }}
                className="bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30 hover:border-amber-500 rounded-2xl p-3.5 relative overflow-hidden shadow-xs col-span-2 sm:col-span-1 cursor-pointer transition-all hover:scale-[1.02] active:scale-98 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> 현재 근무 중
                  </span>
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 flex items-baseline justify-between">
                  <div>
                    {dailySummary.workingCount}<span className="text-xs font-normal text-muted-foreground ml-0.5">명</span>
                  </div>
                  <span className="text-[9px] font-bold text-amber-600/70 dark:text-amber-400/70 group-hover:underline flex items-center">
                    확인 &rarr;
                  </span>
                </div>
              </Card>
            </div>

            {/* 3. Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <Input
                  placeholder="성명, 직급, 사번 검색..."
                  value={dailySearch}
                  onChange={(e) => setDailySearch(e.target.value)}
                  className="pl-9.5 h-11 bg-card border-border rounded-2xl text-xs font-bold"
                />
              </div>

              {/* Department Filter */}
              <div className="flex items-center bg-card rounded-2xl px-3 border border-border h-11">
                <Building2 className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                <select
                  value={dailyDeptFilter}
                  onChange={(e) => setDailyDeptFilter(e.target.value)}
                  className="bg-transparent border-none text-xs font-black text-foreground focus:outline-none cursor-pointer pr-2"
                >
                  {departmentList.map(dept => (
                    <option key={dept} value={dept} className="bg-card text-foreground">
                      {dept === 'ALL' ? '전체 부서/팀' : dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-card rounded-2xl px-3 border border-border h-11">
                <Filter className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                <select
                  value={dailyStatusFilter}
                  onChange={(e) => setDailyStatusFilter(e.target.value as any)}
                  className="bg-transparent border-none text-xs font-black text-foreground focus:outline-none cursor-pointer pr-2"
                >
                  <option value="ALL" className="bg-card text-foreground">전체 상태</option>
                  <option value="SIGNED_IN" className="bg-card text-foreground">출근 서명 (O)</option>
                  <option value="UNSIGNED_IN" className="bg-card text-foreground">미출근 서명 (X)</option>
                  <option value="SIGNED_OUT" className="bg-card text-foreground">퇴근 서명 (O)</option>
                  <option value="WORKING" className="bg-card text-foreground">근무 중</option>
                </select>
              </div>
            </div>

            {/* 4. Team / Department-Grouped Daily Roster Display */}
            {groupedDepartmentRoster.length === 0 ? (
              <Card className="bg-card border-border rounded-3xl p-12 text-center border-dashed">
                <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-black text-foreground">해당 조건에 일치하는 사원이 없습니다.</p>
                <p className="text-xs text-muted-foreground mt-1">검색어나 부서 필터를 변경해 보세요.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {groupedDepartmentRoster.map((group) => (
                  <Card key={group.deptName} className="bg-card border-border rounded-3xl overflow-hidden shadow-sm">
                    {/* Department Group Header */}
                    <div className="p-4 bg-muted/40 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-foreground">{group.deptName}</h3>
                            <Badge variant="outline" className="text-[10px] font-black border-border">
                              총 {group.total}명
                            </Badge>
                          </div>
                          <p className="text-[11px] font-bold text-muted-foreground">
                            출근 서명 <span className="text-emerald-500 font-black">{group.signedIn}명</span> / 미출근 <span className="text-rose-500 font-black">{group.unsignedIn}명</span> (출근율 {group.rate}%)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="w-24 sm:w-32 bg-muted h-2 rounded-full overflow-hidden border border-border/50">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              group.rate >= 80 ? "bg-emerald-500" : group.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${group.rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-black text-foreground">{group.rate}%</span>
                      </div>
                    </div>

                    {/* Department Members Roster List */}
                    <div className="divide-y divide-border">
                      {group.members.map(({ user, att }) => {
                        const isClockedIn = !!att?.clockIn;
                        const isClockedOut = !!att?.clockOut;
                        const inTimeFormatted = att?.clockIn ? format(new Date(att.clockIn), 'HH:mm') : null;
                        const outTimeFormatted = att?.clockOut ? format(new Date(att.clockOut), 'HH:mm') : null;

                        return (
                          <div
                            key={user.uid}
                            className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                          >
                            {/* Member Info */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0",
                                isClockedIn 
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" 
                                  : "bg-muted text-muted-foreground border border-border"
                              )}>
                                {user.displayName?.slice(0, 2) || '??'}
                              </div>

                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-foreground truncate">{user.displayName}</span>
                                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                    {user.position || '사원'}
                                  </span>
                                  {user.employeeId && (
                                    <span className="text-[10px] font-mono text-muted-foreground/60 hidden md:inline">
                                      {user.employeeId}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground/70 truncate mt-0.5">
                                  {user.departmentName || '부서미지정'}
                                </p>
                              </div>
                            </div>

                            {/* Signatures & Time Badges */}
                            <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap self-stretch sm:self-center justify-between sm:justify-end">
                              {/* 1. 출근 서명 Badge */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground">출근:</span>
                                {isClockedIn ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black text-xs px-2 py-0.5 flex items-center gap-1 rounded-xl">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>O</span>
                                    <span className="font-mono text-[11px] ml-0.5 font-bold">({inTimeFormatted})</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-black text-xs px-2 py-0.5 flex items-center gap-1 rounded-xl">
                                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                    <span>X (미출근)</span>
                                  </Badge>
                                )}
                              </div>

                              {/* 2. 퇴근 서명 Badge */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground">퇴근:</span>
                                {isClockedOut ? (
                                  <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-black text-xs px-2 py-0.5 flex items-center gap-1 rounded-xl">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                                    <span>O</span>
                                    <span className="font-mono text-[11px] ml-0.5 font-bold">({outTimeFormatted})</span>
                                  </Badge>
                                ) : isClockedIn ? (
                                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-black text-xs px-2 py-0.5 flex items-center gap-1 rounded-xl animate-pulse">
                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                    <span>X (근무중)</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-muted text-muted-foreground/60 border-border text-xs px-2 py-0.5 rounded-xl font-bold">
                                    <span>-</span>
                                  </Badge>
                                )}
                              </div>

                              {/* 3. Work Hours Info */}
                              {isClockedIn && (
                                <div className="text-right hidden sm:block">
                                  <span className="text-xs font-black text-foreground font-mono">
                                    {att?.workHours?.toFixed(1) || '0.0'}h
                                  </span>
                                  {att?.overtimeHours ? (
                                    <span className="text-[10px] font-black text-amber-600 ml-1">
                                      (+{att.overtimeHours.toFixed(1)}h)
                                    </span>
                                  ) : null}
                                </div>
                              )}

                              {/* 4. Manual Edit / Sign Action Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openManualSignDialog(user, att)}
                                className="h-8 px-2.5 text-[11px] font-black rounded-xl bg-muted/60 hover:bg-muted border-border flex items-center gap-1 shrink-0"
                              >
                                <Edit2 className="w-3 h-3" />
                                {isClockedIn ? '수정' : '수동 서명'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MONTHLY USER DETAIL / EDIT (사원별 월간 상세 조회/수정) */}
        {/* ========================================================================= */}
        {activeTab === 'monthly' && (
          <div className="space-y-4">
            {/* Search and User Selection Header */}
            <Card className="bg-card border-border rounded-3xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                  <Input 
                    placeholder="조회할 사원 성명/사번을 검색하여 선택하세요" 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10 h-11 bg-muted border-none text-xs font-bold rounded-2xl"
                  />
                  
                  {/* Search dropdown results */}
                  <AnimatePresence>
                    {userSearch.length > 0 && filteredUsers.length > 0 && !selectedUser && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-card border-2 border-primary/30 rounded-3xl shadow-2xl z-[999] overflow-hidden max-h-80 overflow-y-auto backdrop-blur-xl"
                      >
                        <div className="p-3 border-b border-border bg-muted/40 flex items-center justify-between">
                          <p className="text-[10px] font-black text-primary uppercase tracking-wider pl-2">검색 결과 ({filteredUsers.length}명)</p>
                          <Button variant="ghost" size="sm" onClick={() => setUserSearch('')} className="h-6 w-6 p-0 rounded-full">
                            <X className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                        <div className="divide-y divide-border">
                          {filteredUsers.map(user => (
                            <button
                              key={user.uid}
                              onClick={() => {
                                setSelectedUser(user);
                                setUserSearch('');
                              }}
                              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-primary/10 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                                  {user.displayName?.[0] || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-foreground leading-none">{user.displayName}</p>
                                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{user.position} | {user.departmentName}</p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {selectedUser && (
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="shrink-0 h-11 px-4 bg-primary text-primary-foreground rounded-2xl flex items-center gap-2 shadow-sm"
                  >
                    <span className="text-xs font-black">{selectedUser.displayName} ({selectedUser.departmentName})</span>
                    <X className="w-4 h-4" />
                  </button>
                )}

                <Input 
                  type="month" 
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-36 h-11 bg-muted border-none text-xs font-black text-foreground rounded-2xl text-center px-2 shrink-0"
                />
              </div>
            </Card>

            {selectedUser ? (
              <div className="space-y-4">
                {/* Monthly Total KPI Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-card border-border rounded-3xl p-4 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">이달의 기본 근무</p>
                    <p className="text-2xl font-black text-foreground font-mono">
                      {monthlyStats.total.toFixed(1)} <span className="text-xs text-muted-foreground">hrs</span>
                    </p>
                  </Card>
                  <Card className="bg-card border-border rounded-3xl p-4 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">이달의 초과/연장 근무</p>
                    <p className="text-2xl font-black text-amber-600 font-mono">
                      {monthlyStats.ot.toFixed(1)} <span className="text-xs text-amber-600/70">hrs</span>
                    </p>
                  </Card>
                </div>

                {/* Monthly Chart Card */}
                <Card className="bg-card border-border rounded-3xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <h4 className="text-xs font-black text-foreground">{selectedUser.displayName} 님의 근무 시간 분석</h4>
                    </div>
                    <div className="flex bg-muted p-1 rounded-xl">
                      <button
                        onClick={() => setChartTab('ratio')}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-black rounded-lg transition-all",
                          chartTab === 'ratio' ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                        )}
                      >
                        비율
                      </button>
                      <button
                        onClick={() => setChartTab('trend')}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-black rounded-lg transition-all",
                          chartTab === 'trend' ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                        )}
                      >
                        추이
                      </button>
                    </div>
                  </div>

                  {chartTab === 'ratio' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="h-40 flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: '일반 근무', value: summaryStats.regularTotal },
                                { name: '1.5배 가산', value: summaryStats.specialTotal }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              <Cell fill="var(--primary)" />
                              <Cell fill="#ef4444" />
                            </Pie>
                            <ChartTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute text-center">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">총 시간</span>
                          <p className="text-sm font-black text-foreground">{summaryStats.grandTotal.toFixed(1)}h</p>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs font-bold">
                        <div className="flex justify-between p-2.5 bg-muted/40 rounded-xl">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> 일반 근무 (1.0배)</span>
                          <span className="font-mono font-black">{summaryStats.regularTotal.toFixed(1)}h ({summaryStats.regularRatio}%)</span>
                        </div>
                        <div className="flex justify-between p-2.5 bg-muted/40 rounded-xl">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> 1.5배 가산 근무</span>
                          <span className="font-mono font-black text-red-500">{summaryStats.specialTotal.toFixed(1)}h ({summaryStats.specialRatio}%)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                          <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 9 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                          <ChartTooltip />
                          <Bar dataKey="일반 시간" stackId="a" fill="var(--primary)" barSize={12} />
                          <Bar dataKey="1.5배 가산 시간" stackId="a" fill="#ef4444" barSize={12} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                {/* Monthly Logs List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider px-1">
                    {month} 출퇴근 기록 ({attendanceData.length}건)
                  </h3>

                  {loadingMonthly ? (
                    <div className="py-12 text-center text-xs font-bold text-muted-foreground">로딩 중...</div>
                  ) : attendanceData.length === 0 ? (
                    <Card className="p-8 text-center border-dashed rounded-2xl">
                      <p className="text-xs font-bold text-muted-foreground">해당 월의 출퇴근 기록이 없습니다.</p>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {attendanceData.map((att) => (
                        <Card key={att.id} className="p-3.5 bg-card border-border rounded-2xl shadow-xs">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-foreground">{format(parseISO(att.date), 'yyyy.MM.dd (EEEE)', { locale: ko })}</p>
                              <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground mt-1">
                                <span>출근: <strong className="text-foreground">{att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '-'}</strong></span>
                                <span>퇴근: <strong className="text-foreground">{att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : '-'}</strong></span>
                                <span>인정: <strong className="text-primary">{att.workHours?.toFixed(1) || '0.0'}h</strong></span>
                                {att.overtimeHours ? <span>잔업: <strong className="text-amber-600">+{att.overtimeHours.toFixed(1)}h</strong></span> : null}
                              </div>
                            </div>

                            {editingId === att.id ? (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(att.id)} className="h-8 w-8 text-emerald-500 bg-emerald-500/10 rounded-xl">
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 text-rose-500 bg-rose-500/10 rounded-xl">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => startEditing(att)} className="h-8 w-8 text-muted-foreground bg-muted rounded-xl">
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>

                          {editingId === att.id && (
                            <div className="space-y-2 pt-3 mt-3 border-t border-border">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] font-black text-muted-foreground">출근 일시</label>
                                  <Input
                                    type="datetime-local"
                                    value={editForm.clockIn}
                                    onChange={(e) => setEditForm({ ...editForm, clockIn: e.target.value })}
                                    className="h-8 text-xs font-bold bg-muted"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-muted-foreground">퇴근 일시</label>
                                  <Input
                                    type="datetime-local"
                                    value={editForm.clockOut}
                                    onChange={(e) => setEditForm({ ...editForm, clockOut: e.target.value })}
                                    className="h-8 text-xs font-bold bg-muted"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] font-black text-muted-foreground">기본 시간 (h)</label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={editForm.workHours}
                                    onChange={(e) => setEditForm({ ...editForm, workHours: e.target.value })}
                                    className="h-8 text-xs font-bold bg-muted"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-muted-foreground">초과 시간 (h)</label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={editForm.overtimeHours}
                                    onChange={(e) => setEditForm({ ...editForm, overtimeHours: e.target.value })}
                                    className="h-8 text-xs font-bold bg-muted"
                                  />
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRecalculate}
                                className="w-full h-8 text-[10px] font-black bg-primary/10 text-primary border-primary/20 rounded-xl"
                              >
                                <Calculator className="w-3 h-3 mr-1" /> 규정에 따른 자동 재계산
                              </Button>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Card className="p-12 text-center border-dashed rounded-3xl bg-muted/20">
                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-black text-foreground">사원을 검색하여 선택해 주세요</p>
                <p className="text-xs text-muted-foreground mt-1">상단 검색창에서 성명을 입력하여 월별 상세 근태를 확인하고 수정할 수 있습니다.</p>
              </Card>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SPECIAL 1.5X WORK DAYS CONFIGURATION (특별 1.5배 근무일 설정) */}
        {/* ========================================================================= */}
        {activeTab === 'special' && (
          <div className="space-y-4">
            <Card className="bg-card border-border rounded-3xl p-6 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center font-black">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground leading-none">특별 1.5배 근무일 / 특정 공휴일 지정</h3>
                  <p className="text-xs font-bold text-muted-foreground mt-1">
                    지정한 날짜에 출근하는 모든 근로자의 근무시간(기본+연장)에 1.5배 가중치가 자동 계산됩니다.
                  </p>
                </div>
              </div>

              {/* Add form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground">날짜 선택</label>
                  <Input
                    type="date"
                    value={newSpecialDate}
                    onChange={(e) => setNewSpecialDate(e.target.value)}
                    className="h-10 bg-muted border-none rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground">라벨 명칭 (예: 창립기념일, 특별철야)</label>
                  <Input
                    placeholder="사유 또는 명칭 입력"
                    value={newSpecialLabel}
                    onChange={(e) => setNewSpecialLabel(e.target.value)}
                    className="h-10 bg-muted border-none rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddSpecialDate}
                    className="w-full h-10 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    1.5배 적용일 등록
                  </Button>
                </div>
              </div>

              {/* Existing List */}
              <div className="space-y-2 mt-6">
                <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider px-1">
                  현재 등록된 커스텀 1.5배 일자 ({Object.keys(specialDates).length}개)
                </h4>
                {Object.keys(specialDates).length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 py-4 text-center">등록된 수동 지정일이 없습니다. (토/일요일 및 법정공휴일은 자동 1.5배가 적용됩니다)</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.values(specialDates)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((val) => (
                        <div key={val.date} className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[10px] font-mono font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">1.5배</span>
                            <div>
                              <p className="text-xs font-black text-foreground">{val.date}</p>
                              <p className="text-[10px] font-bold text-muted-foreground">{val.label}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSpecialDate(val.date)}
                            className="h-7 w-7 p-0 rounded-lg text-rose-500 hover:bg-rose-500/10"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* CATEGORY WORKER DETAIL POPUP MODAL (출근 / 미출근 / 퇴근 / 근무중 / 전체) */}
      {/* ========================================================================= */}
      <Dialog open={!!categoryModalType} onOpenChange={(open) => !open && setCategoryModalType(null)}>
        <DialogContent className="max-w-2xl bg-card border-border rounded-3xl p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
          <DialogHeader className="pb-2 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-xs shrink-0",
                  categoryModalType === 'SIGNED_IN' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30",
                  categoryModalType === 'UNSIGNED_IN' && "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30",
                  categoryModalType === 'SIGNED_OUT' && "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30",
                  categoryModalType === 'WORKING' && "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30",
                  categoryModalType === 'ALL' && "bg-slate-500/10 text-foreground ring-1 ring-border",
                )}>
                  {categoryModalType === 'SIGNED_IN' && <UserCheck className="w-5 h-5" />}
                  {categoryModalType === 'UNSIGNED_IN' && <UserX className="w-5 h-5" />}
                  {categoryModalType === 'SIGNED_OUT' && <LogOut className="w-5 h-5" />}
                  {categoryModalType === 'WORKING' && <Clock className="w-5 h-5" />}
                  {categoryModalType === 'ALL' && <Users className="w-5 h-5" />}
                </div>

                <div>
                  <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                    {categoryModalType === 'SIGNED_IN' && '출근 서명 완료자 명단 (O)'}
                    {categoryModalType === 'UNSIGNED_IN' && '미출근 서명 대상자 명단 (X)'}
                    {categoryModalType === 'SIGNED_OUT' && '퇴근 서명 완료자 명단 (O)'}
                    {categoryModalType === 'WORKING' && '현재 현장 근무 중 명단'}
                    {categoryModalType === 'ALL' && '전체 재적 인원 명단'}
                    <Badge variant="outline" className="text-xs font-black px-2 py-0.5 rounded-lg border-border">
                      {categoryModalWorkers.length}명
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-bold">
                    {selectedDailyDate} ({format(parseISO(selectedDailyDate), 'EEEE', { locale: ko })}) 기준 실시간 근태 현황
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* In-Modal Category Quick Switcher Tabs */}
            <div className="grid grid-cols-5 gap-1 bg-muted/70 p-1 rounded-2xl border border-border/60">
              <button
                type="button"
                onClick={() => setCategoryModalType('ALL')}
                className={cn(
                  "py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all text-center truncate cursor-pointer",
                  categoryModalType === 'ALL' ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                전체 ({dailySummary.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setCategoryModalType('SIGNED_IN')}
                className={cn(
                  "py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all text-center truncate cursor-pointer",
                  categoryModalType === 'SIGNED_IN' ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/40" : "text-muted-foreground hover:text-foreground"
                )}
              >
                출근O ({dailySummary.clockInSignedCount})
              </button>
              <button
                type="button"
                onClick={() => setCategoryModalType('UNSIGNED_IN')}
                className={cn(
                  "py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all text-center truncate cursor-pointer",
                  categoryModalType === 'UNSIGNED_IN' ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 shadow-xs ring-1 ring-rose-500/40" : "text-muted-foreground hover:text-foreground"
                )}
              >
                미출근X ({dailySummary.notClockedInCount})
              </button>
              <button
                type="button"
                onClick={() => setCategoryModalType('SIGNED_OUT')}
                className={cn(
                  "py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all text-center truncate cursor-pointer",
                  categoryModalType === 'SIGNED_OUT' ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-blue-500/40" : "text-muted-foreground hover:text-foreground"
                )}
              >
                퇴근O ({dailySummary.clockOutSignedCount})
              </button>
              <button
                type="button"
                onClick={() => setCategoryModalType('WORKING')}
                className={cn(
                  "py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all text-center truncate cursor-pointer",
                  categoryModalType === 'WORKING' ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-amber-500/40" : "text-muted-foreground hover:text-foreground"
                )}
              >
                근무중 ({dailySummary.workingCount})
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
              <div className="relative sm:col-span-8">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="명단 내 성명, 직급, 사번 검색..."
                  value={categoryModalSearch}
                  onChange={(e) => setCategoryModalSearch(e.target.value)}
                  className="pl-8.5 h-9 bg-muted/60 border-border rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-4 flex items-center bg-muted/60 rounded-xl px-2.5 border border-border h-9">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground mr-1.5 shrink-0" />
                <select
                  value={categoryModalDept}
                  onChange={(e) => setCategoryModalDept(e.target.value)}
                  className="w-full bg-transparent border-none text-xs font-black text-foreground focus:outline-none cursor-pointer truncate"
                >
                  {departmentList.map(d => (
                    <option key={d} value={d} className="bg-card text-foreground">
                      {d === 'ALL' ? '전체 부서' : d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Workers Card List */}
          <div className="flex-1 overflow-y-auto py-2.5 space-y-2 pr-1 min-h-[260px] max-h-[55vh]">
            {categoryModalWorkers.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded-2xl bg-muted/20 my-4">
                <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs font-black text-foreground">해당 조건에 일치하는 사원이 없습니다.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">상단 검색어 또는 부서 필터를 확인해 주세요.</p>
              </div>
            ) : (
              categoryModalWorkers.map(({ user, att }) => {
                const isClockedIn = !!att?.clockIn;
                const isClockedOut = !!att?.clockOut;
                const inTimeStr = isClockedIn ? format(new Date(att.clockIn), 'HH:mm') : null;
                const outTimeStr = isClockedOut ? format(new Date(att.clockOut), 'HH:mm') : null;

                return (
                  <div
                    key={user.uid}
                    className="p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border/80 transition-colors flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5"
                  >
                    {/* Worker Info */}
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border",
                        isClockedIn ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      )}>
                        {user.displayName?.slice(0, 1) || '사'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-foreground">{user.displayName}</span>
                          <Badge variant="outline" className="text-[10px] font-bold h-4 px-1.5 rounded-md border-border bg-card">
                            {user.position || '사원'}
                          </Badge>
                          <Badge className="text-[10px] font-bold h-4 px-1.5 rounded-md bg-muted text-muted-foreground border-none">
                            {user.departmentName || '부서미지정'}
                          </Badge>
                          {user.employeeId && (
                            <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline">
                              #{user.employeeId}
                            </span>
                          )}
                        </div>

                        {/* Attendance Time Details */}
                        <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                          {isClockedIn ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> 출근: {inTimeStr}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                              <XCircle className="w-3 h-3" /> 출근: 미서명 (X)
                            </span>
                          )}

                          {isClockedOut ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded-md">
                              <LogOut className="w-3 h-3" /> 퇴근: {outTimeStr}
                            </span>
                          ) : isClockedIn ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                              <Clock className="w-3 h-3" /> 퇴근: 근무중 (미퇴근)
                            </span>
                          ) : null}

                          {att && (att.workHours > 0 || att.overtimeHours > 0) && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              (기본 {att.workHours || 0}h {att.overtimeHours > 0 && `+ 연장 ${att.overtimeHours}h`})
                            </span>
                          )}
                        </div>

                        {att?.memo && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-xs">
                            메모: {att.memo}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons for this Worker */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {!isClockedIn ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleIndividualNudge(user)}
                            className="h-7 px-2 text-[10px] font-bold rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30"
                          >
                            <Send className="w-3 h-3 mr-1" /> 독려
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openManualSignDialog(user, att)}
                            className="h-7 px-2.5 text-[10px] font-black rounded-lg bg-primary text-primary-foreground shadow-xs"
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" /> 수동 출근
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManualSignDialog(user, att)}
                          className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-border bg-card hover:bg-muted"
                        >
                          <Edit2 className="w-3 h-3 mr-1" /> 서명 보정
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCopyCategoryModalText}
                className="h-9 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 border-border bg-card hover:bg-muted active:scale-95"
              >
                {isCategoryCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {isCategoryCopied ? '명단 복사 완료!' : '📋 이 명단 복사'}
              </Button>

              {categoryModalType === 'UNSIGNED_IN' && categoryModalWorkers.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleNudgeUnsignedWorkers}
                  className="h-9 px-3 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30 text-xs font-black flex items-center gap-1.5 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  전원 독려
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setCategoryModalType(null)}
              className="h-9 px-4 rounded-xl text-xs font-black"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Attendance Sign/Edit Dialog for Managers */}
      <Dialog open={!!manualModalUser} onOpenChange={(open) => !open && setManualModalUser(null)}>
        <DialogContent className="max-w-md bg-card border-border rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              출퇴근 서명 수동 등록 / 수정
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-bold">
              {manualModalUser?.displayName} ({manualModalUser?.departmentName || '부서미지정'}) 사원의 {selectedDailyDate} 근태를 수동 처리합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">출근 시각</label>
                <Input
                  type="time"
                  value={manualForm.clockIn}
                  onChange={(e) => setManualForm({ ...manualForm, clockIn: e.target.value })}
                  className="h-10 text-xs font-black bg-muted mt-1 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">퇴근 시각 (선택)</label>
                <Input
                  type="time"
                  value={manualForm.clockOut}
                  onChange={(e) => setManualForm({ ...manualForm, clockOut: e.target.value })}
                  placeholder="미퇴근 시 비워둠"
                  className="h-10 text-xs font-black bg-muted mt-1 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase">근태 상태</label>
              <select
                value={manualForm.status}
                onChange={(e) => setManualForm({ ...manualForm, status: e.target.value as any })}
                className="w-full h-10 bg-muted border-none text-xs font-black text-foreground rounded-xl px-3 mt-1 cursor-pointer"
              >
                <option value="PRESENT">정상 출근</option>
                <option value="LATE">지각</option>
                <option value="ABSENT">결근</option>
                <option value="LEAVE">휴가 / 연차</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase">관리자 메모</label>
              <Input
                placeholder="사유 입력 (예: 휴대폰 방전으로 현장 대리 확인)"
                value={manualForm.memo}
                onChange={(e) => setManualForm({ ...manualForm, memo: e.target.value })}
                className="h-10 text-xs font-bold bg-muted mt-1 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setManualModalUser(null)}
              className="rounded-xl h-10 text-xs font-bold"
            >
              취소
            </Button>
            <Button
              onClick={handleSaveManualAttendance}
              disabled={isSavingManual}
              className="rounded-xl h-10 text-xs font-black bg-primary text-primary-foreground"
            >
              {isSavingManual ? '저장 중...' : '서명 등록 및 확정'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
