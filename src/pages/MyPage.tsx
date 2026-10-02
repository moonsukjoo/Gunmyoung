import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  CalendarDays, 
  Trophy, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2,
  Lock,
  ClipboardList,
  Smartphone,
  RefreshCw,
  Eye,
  Check,
  BookOpen,
  AlertCircle,
  LogOut,
  Wallet,
  Ticket,
  Bell,
  Navigation,
  Activity,
  FileText,
  Sun,
  Moon,
  Info,
  Users,
  Utensils,
  Sparkles,
  Contrast,
  Type,
  Sliders,
  Palette,
  KeyRound,
  Ship,
  Sparkle,
  Briefcase,
  HeartHandshake,
  Settings2,
  FolderKanban,
  Delete,
  Keyboard
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { updatePassword, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { TrainingResult } from '@/types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { PinKeypad } from '@/components/PinKeypad';
import { requestNotificationPermission } from '@/services/notificationService';
import SignatureCanvas from 'react-signature-canvas';

type MyPageTab = 'WORK_HR' | 'WELFARE' | 'SETTINGS' | 'ADMIN';

export const MyPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<MyPageTab>('WORK_HR');
  const [showMoreWork, setShowMoreWork] = useState(false);
  const [showMoreWelfare, setShowMoreWelfare] = useState(false);
  const [showMoreAdmin, setShowMoreAdmin] = useState(false);

  // Security PIN Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pendingNewPin, setPendingNewPin] = useState('');
  const [pinStep, setPinStep] = useState<1 | 2>(1);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [reAuthPin, setReAuthPin] = useState('');
  const [isReAuthPending, setIsReAuthPending] = useState(false);
  const [useNativeKeyboard, setUseNativeKeyboard] = useState(false);

  // Training & Exam History State
  const [examHistory, setExamHistory] = useState<TrainingResult[]>([]);
  const [allResults, setAllResults] = useState<TrainingResult[]>([]);
  const [isExamHistoryOpen, setIsExamHistoryOpen] = useState(false);

  // Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  // Emergency Evacuation State
  const [evacuationStatus, setEvacuationStatus] = useState<any>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isEvacSignOpen, setIsEvacSignOpen] = useState(false);
  const evacSigPad = React.useRef<SignatureCanvas>(null);
  const [isSubmittingEvac, setIsSubmittingEvac] = useState(false);

  // Emergency Evacuation Handler
  const handleEvacConfirmSafety = async () => {
    if (!profile || !evacuationStatus?.isActive || hasConfirmed) return;
    
    let signatureUrl = '';
    if (evacSigPad.current) {
      if (evacSigPad.current.isEmpty()) {
        toast.error('서명을 그려주세요.');
        return;
      }
      signatureUrl = evacSigPad.current.getTrimmedCanvas().toDataURL('image/png');
    }

    setIsSubmittingEvac(true);
    try {
      const { setDoc, increment } = await import('firebase/firestore');
      const checkinRef = doc(db, 'evacuations', evacuationStatus.id, 'checkins', profile.uid);
      await setDoc(checkinRef, {
        uid: profile.uid,
        displayName: profile.displayName,
        departmentName: profile.departmentName || '소속 없음',
        confirmedAt: new Date().toISOString(),
        signatureUrl: signatureUrl
      });

      await updateDoc(doc(db, 'evacuation', 'status'), {
        confirmedCount: increment(1)
      });

      toast.success('안전 대피 보고가 완료되었습니다.');
      setIsEvacSignOpen(false);
    } catch (err) {
      console.error("Safety confirmation error:", err);
      toast.error('확인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingEvac(false);
    }
  };

  React.useEffect(() => {
    if (!profile) return;
    const unsubStatus = onSnapshot(doc(db, 'evacuation', 'status'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEvacuationStatus(data);
        if (data.isActive) {
          const checkinRef = doc(db, 'evacuations', data.id, 'checkins', profile.uid);
          const unsubscribeCheckin = onSnapshot(checkinRef, (checkSnap) => {
            setHasConfirmed(checkSnap.exists());
          }, (error) => handleFirestoreError(error, OperationType.GET, `evacuations/${data.id}/checkins/${profile.uid}`));
          return () => unsubscribeCheckin();
        }
      } else {
        setEvacuationStatus(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'evacuation/status'));
    return () => unsubStatus();
  }, [profile]);

  const checkPermission = async () => {
    const capacitor = (window as any).Capacitor;
    const isNative = !!(capacitor && capacitor.isNativePlatform && capacitor.isNativePlatform());
    
    if (isNative) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const status = await LocalNotifications.checkPermissions();
        setNotificationPermission(status.display);
      } catch (e: any) {
        if (e?.message !== 'Notifications not supported in this browser.') {
          console.warn('Native permission check failed:', e);
        }
        setNotificationPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
      }
    } else {
      setNotificationPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
    }
  };

  React.useEffect(() => {
    checkPermission();
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    await checkPermission();
    
    if (granted) {
      toast.success('알림이 허용되었습니다.');
    } else {
      const capacitor = (window as any).Capacitor;
      const isNative = capacitor !== undefined && capacitor.isNativePlatform?.();
      const isAdminApp = isNative || window.location.protocol === 'capacitor:' || /Android/i.test(navigator.userAgent);
      
      if (isAdminApp) {
        toast.error('기기 알람 권한이 필요합니다.', {
          description: '핸드폰의 [설정 > 애플리케이션 > 건명 > 알림]에서 "알림 허용"을 활성화해 주세요.',
          duration: 6000
        });
      } else {
        toast.error('알림 권한이 거부되었습니다.', {
          description: '브라우저 주소창 옆의 자물쇠 아이콘을 눌러 알림 권한을 허용해 주세요.',
        });
      }
    }
  };

  React.useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'trainingResults'), 
      where('uid', '==', profile.uid),
      orderBy('completedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setExamHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'trainingResults_history'));
    return () => unsubscribe();
  }, [profile]);

  React.useEffect(() => {
    const q = query(
      collection(db, 'trainingResults'), 
      orderBy('score', 'desc'),
      orderBy('completedAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setAllResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'trainingResults_all'));
    return () => unsubscribe();
  }, []);

  const getRanking = (resId: string, trainingId: string) => {
    const trainingResults = allResults.filter(r => r.trainingId === trainingId);
    const total = trainingResults.length;
    if (total === 0) return '- / -등';
    const rank = trainingResults.findIndex(r => r.id === resId) + 1;
    return `${rank} / ${total}등`;
  };

  const handleUpdatePin = async (finalPin: string) => {
    if (!auth.currentUser || !profile) return;
    setIsUpdatingPin(true);
    try {
      // 1. Update Firebase Authentication Password for active user
      await updatePassword(auth.currentUser, finalPin);

      // 2. Update Firestore user record to track custom PIN status
      await updateDoc(doc(db, 'users', profile.uid), {
        hasCustomPin: true,
        lastPinChange: new Date().toISOString()
      });

      toast.success('PIN 비밀번호가 성공적으로 변경되었습니다.', {
        description: '다음 로그인 시 새 6자리 비밀번호를 사용해 주세요.'
      });
      setIsPinModalOpen(false);
      setNewPin('');
      setConfirmPin('');
      setPendingNewPin('');
      setPinStep(1);
      setIsReAuthPending(false);
    } catch (error: any) {
      console.error("PIN Update error:", error);
      if (error.code === 'auth/requires-recent-login') {
        // Store target PIN and ask user for current password once
        setPendingNewPin(finalPin);
        setIsReAuthPending(true);
        toast.info('보안 인증이 필요합니다. 현재 비밀번호(또는 초기 사번)를 입력해 주세요.');
      } else {
        toast.error('비밀번호 변경 실패: ' + (error.message || '다시 시도해 주세요.'));
      }
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleReAuth = async (enteredPassword: string) => {
    if (!auth.currentUser || !profile || !auth.currentUser.email) return;
    const cleanPass = enteredPassword.trim();
    if (!cleanPass) {
      toast.error('현재 비밀번호를 입력해 주세요.');
      return;
    }

    setIsUpdatingPin(true);
    try {
      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      const email = auth.currentUser.email;

      // Try candidate passwords (exact, lowercase, uppercase, or employeeId)
      const candidates = Array.from(new Set([
        cleanPass,
        cleanPass.toLowerCase(),
        cleanPass.toUpperCase(),
        profile.employeeId || '',
        (profile.employeeId || '').toLowerCase(),
        (profile.employeeId || '').toUpperCase()
      ].filter(Boolean)));

      let reauthed = false;
      let lastErr: any = null;

      for (const pass of candidates) {
        try {
          const cred = EmailAuthProvider.credential(email, pass);
          await reauthenticateWithCredential(auth.currentUser, cred);
          reauthed = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!reauthed) {
        throw lastErr || new Error('현재 비밀번호가 일치하지 않습니다.');
      }

      setIsReAuthPending(false);
      setReAuthPin('');

      // If we already had a confirmed new PIN pending, immediately apply it!
      if (pendingNewPin && pendingNewPin.length === 6) {
        await handleUpdatePin(pendingNewPin);
      } else {
        toast.success('본인 확인 완료! 이제 새 6자리 PIN을 설정해 주세요.');
        setPinStep(1);
      }
    } catch (error: any) {
      console.error("Reauth error:", error);
      toast.error('현재 비밀번호(또는 초기 사번)가 일치하지 않습니다.');
      setReAuthPin('');
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handlePinInputDigit = (digit: string) => {
    if (isReAuthPending) {
      const val = (reAuthPin + digit).slice(0, 6);
      setReAuthPin(val);
      if (val.length === 6) {
        setTimeout(() => handleReAuth(val), 150);
      }
      return;
    }

    if (pinStep === 1) {
      const val = (newPin + digit).slice(0, 6);
      setNewPin(val);
      if (val.length === 6) {
        setTimeout(() => setPinStep(2), 250);
      }
    } else {
      const val = (confirmPin + digit).slice(0, 6);
      setConfirmPin(val);
      if (val.length === 6) {
        if (val === newPin) {
          setTimeout(() => handleUpdatePin(val), 150);
        } else {
          toast.error('비밀번호가 일치하지 않습니다. 처음부터 다시 입력해 주세요.');
          setTimeout(() => {
            setPinStep(1);
            setNewPin('');
            setConfirmPin('');
          }, 300);
        }
      }
    }
  };

  const handlePinBackspace = () => {
    if (isReAuthPending) {
      setReAuthPin(prev => prev.slice(0, -1));
    } else if (pinStep === 1) {
      setNewPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const handlePinClear = () => {
    if (isReAuthPending) {
      setReAuthPin('');
    } else if (pinStep === 1) {
      setNewPin('');
    } else {
      setConfirmPin('');
    }
  };

  const toggleElderlyMode = async () => {
    if (!profile) return;
    try {
      const newValue = !profile.elderlyMode;
      await updateDoc(doc(db, 'users', profile.uid), { elderlyMode: newValue });
      toast.success(newValue ? '어르신 모드 ON' : '어르신 모드 OFF');
    } catch (error) {
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const handleCalibrateAltitude = async () => {
    if (!profile) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        basePressure: null,
        currentAltitude: 0
      });
      toast.success('고도가 초기화되었습니다.', {
        description: '현재 위치가 지면(0m)으로 설정됩니다.'
      });
    } catch (e) {
      toast.error('초기화 실패');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetFontSizeScale = async (scale: 'normal' | 'large' | 'xlarge') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), { fontSizeScale: scale });
      const labels = { normal: '기본 크기', large: '크게 (112%)', xlarge: '매우 크게 (125%)' };
      toast.success(`글자 크기: ${labels[scale]}`);
    } catch (error) {
      toast.error('글자 크기 변경 실패');
    }
  };

  const handleToggleGhostGuard = async () => {
    if (!profile) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: !profile.ghostGuardEnabled
      });
      toast.success(profile.ghostGuardEnabled ? '유령 가드가 비활성화되었습니다.' : '유령 가드가 활성화되었습니다.');
    } catch (e) {
      toast.error('변경 실패');
    } finally {
      setIsUpdating(false);
    }
  };

  const isAdminRole = profile && ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'TEAM_LEADER', 'GENERAL_AFFAIRS'].includes(profile.role);

  // Grouped Menu Datasets
  const workHrItems = [
    { label: '근태 현황 & 체크', desc: '출퇴근 및 근태 기록', icon: Navigation, to: '/attendance', color: 'text-blue-500', bgColor: 'bg-blue-500/10', isPrimary: true },
    { label: '연차 신청 & 내역', desc: '잔여 연차 확인 및 결재', icon: CalendarDays, to: '/leave', color: 'text-purple-500', bgColor: 'bg-purple-500/10', isPrimary: true },
    { label: '급여 명세서', desc: '월별 명세서 열람', icon: FileText, to: '/mypage/payslip', color: 'text-teal-500', bgColor: 'bg-teal-500/10', isPrimary: true },
    { label: '안전 보건 교육', desc: '필수 교육 수강 및 퀴즈', icon: BookOpen, to: '/training', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', isPrimary: true },
    { label: '근무시간 / 자동출퇴근 설정', desc: '개인 근무스케줄 변경', icon: Sliders, to: '/attendance/settings', color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { label: '교육 이수증 보관함', desc: '취득한 이수증 조회', icon: Trophy, onClick: () => setIsExamHistoryOpen(true), color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: '작업지시서 작성', desc: '현장 지시서 등록', icon: ClipboardList, to: '/work-instruction', color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', roles: ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'CEO'] },
  ].filter(item => !item.roles || item.roles.includes(profile?.role));

  const welfareItems = [
    { label: '식수 신청', desc: '중식·석식·간식 신청', icon: Utensils, to: '/meal-request', color: 'text-orange-500', bgColor: 'bg-orange-500/10', isPrimary: true },
    { label: '동료 칭찬 피드', desc: '칭찬왕 투표 및 감사 전달', icon: ShieldCheck, to: '/praise', color: 'text-pink-500', bgColor: 'bg-pink-500/10', isPrimary: true },
    { label: '복지 쿠폰함', desc: '발급받은 모바일 쿠폰', icon: Ticket, to: '/coupons', color: 'text-purple-500', bgColor: 'bg-purple-500/10', isPrimary: true },
    { label: '현물 보상 신청', desc: '포인트 교환 상품 신청', icon: Wallet, to: '/redemption', color: 'text-amber-500', bgColor: 'bg-amber-500/10', isPrimary: true },
    { label: '사내 공지사항', desc: '회사 소식 및 알림', icon: Bell, to: '/notices', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: '행운 로또 번호', desc: '주간 번호 추첨 생성기', icon: Sparkle, to: '/lotto', color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
    { label: '선박 조립 게임', desc: '출근 보상 퍼즐 놀이', icon: Ship, to: '/ship-assembly', color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
    { label: '미니게임 엔터놀이', desc: '휴게 시간 캐주얼 게임', icon: Sparkles, to: '/entertainment', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  ];

  const adminItems = [
    { label: '임직원 정보 관리', desc: '사원 명부 및 직책 수정', icon: Users, to: '/personnel', color: 'text-blue-500', bgColor: 'bg-blue-500/10', isPrimary: true },
    { label: '임직원 근태 현황', desc: '실시간 팀 출근 모니터링', icon: Navigation, to: '/attendance-mgmt', color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', isPrimary: true },
    { label: '연차 신청 승인/조회', desc: '휴가 결재 및 승인 관리', icon: CalendarDays, to: '/leave-mgmt', color: 'text-purple-500', bgColor: 'bg-purple-500/10', isPrimary: true },
    { label: '식사·간식 신청 관리', desc: '식수인원 집계 및 발주', icon: Utensils, to: '/meal-mgmt', color: 'text-orange-500', bgColor: 'bg-orange-500/10', isPrimary: true },
    { label: '포상 및 쿠폰 지급', desc: '포인트/쿠폰 수동 지급', icon: Wallet, to: '/redemption-mgmt', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: '고소작업 통합 모니터링', desc: '기압계 고도 위험 감시', icon: Activity, to: '/high-work-monitor', color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
    { label: '안전 보건 교육 관리', desc: '교육과정 개설 및 평가', icon: BookOpen, to: '/training-mgmt', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: '작업지시 관리', desc: '현장 지시 현황 총괄', icon: ClipboardList, to: '/work-instruction-mgmt', color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { label: '고급 관리자 설정', desc: '시스템 및 권한 마스터', icon: Lock, to: '/admin', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  ];

  return (
    <div className="w-full space-y-4 pb-28 px-3.5 sm:px-4 overflow-x-hidden bg-background">
      {/* 1. Header with Compact Fast Actions */}
      <header className="pt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-black text-foreground tracking-tight leading-none">
              마이페이지
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
              건명기업 개인 설정 & 스마트 허브
            </p>
          </div>
        </div>

        {/* Theme Mode Cycle & Logout Fast Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!profile) return;
              try {
                if (profile.highContrast) {
                  await updateDoc(doc(db, 'users', profile.uid), { lightTheme: false, highContrast: false });
                  toast.success('다크 모드가 적용되었습니다.');
                } else if (profile.lightTheme) {
                  await updateDoc(doc(db, 'users', profile.uid), { highContrast: true });
                  toast.success('고대비 모드가 적용되었습니다.');
                } else {
                  await updateDoc(doc(db, 'users', profile.uid), { lightTheme: true, highContrast: false });
                  toast.success('라이트 모드가 적용되었습니다.');
                }
              } catch {
                toast.error('테마 전환 실패');
              }
            }}
            className="h-8 w-8 rounded-xl bg-card border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            title="테마 전환 (다크/라이트/고대비)"
          >
            {profile?.highContrast ? (
              <Contrast className="w-4 h-4 text-amber-500" />
            ) : profile?.lightTheme ? (
              <Moon className="w-4 h-4 text-blue-500" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 rounded-xl bg-card border border-border/60 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 cursor-pointer"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Emergency Status Alert Banner (if active) */}
      {evacuationStatus?.isActive && (
        <motion.div
           initial={{ opacity: 0, y: -8 }}
           animate={{ opacity: 1, y: 0 }}
           className={cn(
             "p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm",
             hasConfirmed 
               ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
               : "bg-rose-500/10 border-rose-500/30 text-rose-500"
           )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
              hasConfirmed ? "bg-emerald-500/20" : "bg-rose-500/20 animate-pulse"
            )}>
              {hasConfirmed ? <ShieldCheck className="w-4.5 h-4.5" /> : <AlertCircle className="w-4.5 h-4.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black truncate">{hasConfirmed ? '비상 대피 완료 (확인됨)' : '🚨 비상 대피 확인 요망'}</p>
              <p className="text-[10px] font-bold opacity-75 truncate">{evacuationStatus.reason || '비상 소집'}</p>
            </div>
          </div>
          {!hasConfirmed && (
            <Button size="sm" className="bg-rose-600 text-white rounded-xl h-7 px-3 text-[11px] font-black shrink-0 cursor-pointer" onClick={() => setIsEvacSignOpen(true)}>
              서명 확인
            </Button>
          )}
        </motion.div>
      )}

      {/* 2. Sleek Profile & Balance Hero Card */}
      <section className="bg-card/75 backdrop-blur-md border border-border/70 rounded-3xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-black text-primary shadow-inner">
                {profile?.displayName?.charAt(0) || '사'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-emerald-500 rounded-full border-2 border-card flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm font-black text-foreground truncate">{profile?.displayName}</h2>
                <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0 h-4 rounded-md border-primary/30 text-primary bg-primary/5 shrink-0">
                  {profile?.role === 'CEO' ? '대표' : 
                   profile?.role === 'DIRECTOR' ? '직장' :
                   profile?.role === 'GENERAL_MANAGER' ? '부장' :
                   profile?.role === 'SAFETY_MANAGER' ? '안전관리자' :
                   profile?.role === 'TEAM_LEADER' ? '팀장' :
                   profile?.role === 'GROUP_LEADER' ? '조장' :
                   profile?.role === 'EMPLOYEE' ? '사원' : profile?.role || '사원'}
                </Badge>
              </div>
              <p className="text-[11px] font-bold text-muted-foreground truncate mt-0.5">
                {profile?.departmentName || profile?.workplace || '건명기업 현장'} {profile?.employeeId ? `(${profile.employeeId})` : ''}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPinStep(1);
              setNewPin('');
              setConfirmPin('');
              setIsPinModalOpen(true);
            }}
            className="h-7 px-2 rounded-xl text-[10.5px] font-bold border-border/70 hover:bg-muted shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <KeyRound className="w-3 h-3 text-primary" />
            <span>PIN 변경</span>
          </Button>
        </div>

        {/* 2-Pill Balance Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
          <button
            type="button"
            onClick={() => navigate('/redemption')}
            className="flex items-center justify-between p-2 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-border/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground truncate">보유 포인트</p>
                <p className="text-xs font-black text-foreground truncate">{(profile?.points || 0).toLocaleString()}P</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/leave')}
            className="flex items-center justify-between p-2 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-border/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground truncate">잔여 연차</p>
                <p className="text-xs font-black text-foreground truncate">{profile?.annualLeaveBalance || 0}일</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
          </button>
        </div>
      </section>

      {/* 3. Folder Segment Navigation Tabs */}
      <nav className="flex items-center bg-muted/60 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('WORK_HR')}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap break-keep cursor-pointer",
            activeTab === 'WORK_HR'
              ? "bg-card text-foreground shadow-xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Briefcase className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>업무·인사</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('WELFARE')}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap break-keep cursor-pointer",
            activeTab === 'WELFARE'
              ? "bg-card text-foreground shadow-xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <HeartHandshake className="w-3.5 h-3.5 text-pink-500 shrink-0" />
          <span>복지·편의</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SETTINGS')}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap break-keep cursor-pointer",
            activeTab === 'SETTINGS'
              ? "bg-card text-foreground shadow-xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Palette className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>설정·기기</span>
        </button>

        {isAdminRole && (
          <button
            type="button"
            onClick={() => setActiveTab('ADMIN')}
            className={cn(
              "py-1.5 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap break-keep cursor-pointer",
              activeTab === 'ADMIN'
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-xs border border-rose-500/30"
                : "text-rose-500/70 hover:text-rose-500"
            )}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>관리자</span>
          </button>
        )}
      </nav>

      {/* 4. Tab Content Sections */}
      <main className="space-y-3">
        {/* ================= TAB 1: 💼 업무 및 인사 (Work & HR) ================= */}
        {activeTab === 'WORK_HR' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              {(showMoreWork ? workHrItems : workHrItems.filter(i => i.isPrimary)).map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => item.onClick ? item.onClick() : navigate(item.to!)}
                    className="flex flex-col justify-between p-3 rounded-2xl bg-card/80 border border-border/60 hover:border-primary/40 hover:bg-muted/40 active:scale-98 transition-all text-left shadow-2xs group cursor-pointer h-24"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={cn("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform", item.bgColor)}>
                        <Icon className={cn("w-4 h-4", item.color)} />
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                        {item.label}
                      </p>
                      <p className="text-[9.5px] font-bold text-muted-foreground truncate mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Toggle More / Less */}
            {workHrItems.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreWork(!showMoreWork)}
                className="w-full h-8 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 flex items-center justify-center gap-1 cursor-pointer"
              >
                {showMoreWork ? (
                  <>간단히 보기 <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>기능 {workHrItems.length - 4}개 더보기 <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </Button>
            )}
          </div>
        )}

        {/* ================= TAB 2: 🎁 복지 및 편의 (Welfare & Perks) ================= */}
        {activeTab === 'WELFARE' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              {(showMoreWelfare ? welfareItems : welfareItems.filter(i => i.isPrimary)).map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="flex flex-col justify-between p-3 rounded-2xl bg-card/80 border border-border/60 hover:border-primary/40 hover:bg-muted/40 active:scale-98 transition-all text-left shadow-2xs group cursor-pointer h-24"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={cn("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform", item.bgColor)}>
                        <Icon className={cn("w-4 h-4", item.color)} />
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                        {item.label}
                      </p>
                      <p className="text-[9.5px] font-bold text-muted-foreground truncate mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Toggle More / Less */}
            {welfareItems.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreWelfare(!showMoreWelfare)}
                className="w-full h-8 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 flex items-center justify-center gap-1 cursor-pointer"
              >
                {showMoreWelfare ? (
                  <>간단히 보기 <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>기능 {welfareItems.length - 4}개 더보기 <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </Button>
            )}
          </div>
        )}

        {/* ================= TAB 3: ⚙️ 화면·기기·접근성 설정 (Settings) ================= */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-3">
            {/* Display Theme Card */}
            <Card className="bg-card/80 backdrop-blur-md border border-border/70 rounded-3xl p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-xs font-black text-foreground">화면 테마</h3>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {profile?.highContrast ? '고대비' : profile?.lightTheme ? '라이트' : '다크'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!profile) return;
                    try {
                      await updateDoc(doc(db, 'users', profile.uid), { lightTheme: false, highContrast: false });
                      toast.success('다크 모드가 적용되었습니다.');
                    } catch { toast.error('변경 실패'); }
                  }}
                  className={cn(
                    "p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1",
                    !profile?.lightTheme && !profile?.highContrast
                      ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/30"
                      : "bg-card/60 border-border/40 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Moon className="w-4 h-4" />
                  <span className="text-[11px] font-black">다크 모드</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!profile) return;
                    try {
                      await updateDoc(doc(db, 'users', profile.uid), { lightTheme: true, highContrast: false });
                      toast.success('라이트 모드가 적용되었습니다.');
                    } catch { toast.error('변경 실패'); }
                  }}
                  className={cn(
                    "p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1",
                    profile?.lightTheme && !profile?.highContrast
                      ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/30"
                      : "bg-card/60 border-border/40 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="text-[11px] font-black">라이트 모드</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!profile) return;
                    try {
                      await updateDoc(doc(db, 'users', profile.uid), { highContrast: true });
                      toast.success('고대비 모드가 적용되었습니다.');
                    } catch { toast.error('변경 실패'); }
                  }}
                  className={cn(
                    "p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1",
                    profile?.highContrast
                      ? "bg-amber-500/15 border-amber-500 text-amber-500 ring-1 ring-amber-500/30"
                      : "bg-card/60 border-border/40 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Contrast className="w-4 h-4 text-amber-500" />
                  <span className="text-[11px] font-black">고대비 모드</span>
                </button>
              </div>

              {/* Font Scale Buttons */}
              <div className="pt-2 border-t border-border/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Type className="w-3 h-3 text-primary" />
                    <span className="text-[11px] font-bold text-foreground">글자 크기</span>
                  </div>
                  <span className="text-[9.5px] font-bold text-muted-foreground">
                    {profile?.fontSizeScale === 'large' ? '112% 크게' : profile?.fontSizeScale === 'xlarge' ? '125% 최대' : '100% 표준'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['normal', 'large', 'xlarge'] as const).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleSetFontSizeScale(scale)}
                      className={cn(
                        "py-1.5 rounded-xl border text-center text-xs transition-all cursor-pointer",
                        (profile?.fontSizeScale || 'normal') === scale
                          ? "bg-primary text-primary-foreground font-black border-primary shadow-2xs"
                          : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted font-bold"
                      )}
                    >
                      {scale === 'normal' ? '기본 100%' : scale === 'large' ? '크게 112%' : '최대 125%'}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* System Control 4-Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Elderly Mode */}
              <button
                type="button"
                onClick={toggleElderlyMode}
                className={cn(
                  "p-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-2 shadow-2xs cursor-pointer",
                  profile?.elderlyMode ? "bg-blue-500/10 border-blue-500/30" : "bg-card/80 border-border/60 hover:bg-muted/50"
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground truncate">어르신 모드</p>
                  <p className={cn("text-[9.5px] font-bold truncate mt-0.5", profile?.elderlyMode ? "text-blue-500" : "text-muted-foreground")}>
                    {profile?.elderlyMode ? '운영 중 (ON)' : '일반 모드'}
                  </p>
                </div>
                <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", profile?.elderlyMode ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground")}>
                  <Eye className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Push Permission */}
              <button
                type="button"
                onClick={handleRequestPermission}
                className={cn(
                  "p-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-2 shadow-2xs cursor-pointer",
                  notificationPermission === 'granted' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card/80 border-border/60 hover:bg-muted/50"
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground truncate">기기 알림</p>
                  <p className={cn("text-[9.5px] font-bold truncate mt-0.5", notificationPermission === 'granted' ? "text-emerald-500" : "text-muted-foreground")}>
                    {notificationPermission === 'granted' ? '알림 허용됨' : '차단됨 (터치)'}
                  </p>
                </div>
                <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", notificationPermission === 'granted' ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                  <Bell className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Ghost Guard */}
              <button
                type="button"
                onClick={handleToggleGhostGuard}
                className={cn(
                  "p-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-2 shadow-2xs cursor-pointer",
                  profile?.ghostGuardEnabled ? "bg-rose-500/10 border-rose-500/30" : "bg-card/80 border-border/60 hover:bg-muted/50"
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground truncate">유령 가드</p>
                  <p className={cn("text-[9.5px] font-bold truncate mt-0.5", profile?.ghostGuardEnabled ? "text-rose-500" : "text-muted-foreground")}>
                    {profile?.ghostGuardEnabled ? '보호 작동중' : '비활성'}
                  </p>
                </div>
                <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", profile?.ghostGuardEnabled ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground")}>
                  <Activity className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Altitude Reset */}
              <button
                type="button"
                onClick={handleCalibrateAltitude}
                className="p-3 rounded-2xl border bg-card/80 border-border/60 hover:bg-muted/50 transition-all text-left flex items-center justify-between gap-2 shadow-2xs cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground truncate">고도 영점화</p>
                  <p className="text-[9.5px] font-bold text-primary truncate mt-0.5">
                    {(profile?.currentAltitude || 0).toFixed(1)}m 기준 초기화
                  </p>
                </div>
                <div className="w-7 h-7 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Navigation className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>

            {/* Sensor Info */}
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 flex items-start gap-2 text-[10px] text-muted-foreground">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                고소작업 안전 모니터링은 기압계 센서를 사용합니다. iOS 사파리는 '동작 및 방향 접근' 허용이 필요합니다.
              </p>
            </div>
          </div>
        )}

        {/* ================= TAB 4: 👑 관리자 전용 센터 (Admin) ================= */}
        {activeTab === 'ADMIN' && isAdminRole && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-black text-rose-600 dark:text-rose-400">현장 관리자 권한 승인됨</p>
                <p className="text-[10px] text-muted-foreground truncate">총괄 업무 관리 및 인력 승인 데스크</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(showMoreAdmin ? adminItems : adminItems.filter(i => i.isPrimary)).map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="flex flex-col justify-between p-3 rounded-2xl bg-card/80 border border-border/60 hover:border-primary/40 hover:bg-muted/40 active:scale-98 transition-all text-left shadow-2xs group cursor-pointer h-24"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={cn("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform", item.bgColor)}>
                        <Icon className={cn("w-4 h-4", item.color)} />
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                        {item.label}
                      </p>
                      <p className="text-[9.5px] font-bold text-muted-foreground truncate mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Toggle More / Less */}
            {adminItems.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreAdmin(!showMoreAdmin)}
                className="w-full h-8 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 flex items-center justify-center gap-1 cursor-pointer"
              >
                {showMoreAdmin ? (
                  <>간단히 보기 <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>관리 기능 {adminItems.length - 4}개 더보기 <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </Button>
            )}
          </div>
        )}
      </main>

      {/* 5. Modals & Dialogs */}
      {/* PIN Registration / Change Modal */}
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground p-5 max-w-sm w-[92vw] shadow-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <DialogTitle className="text-base font-black text-foreground">
                {isReAuthPending ? '🔐 보안 재인증' : (pinStep === 1 ? '새 6자리 PIN 설정' : '새 PIN 번호 재확인')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-bold">
                {isReAuthPending 
                  ? '보안을 위해 현재 비밀번호(초기 사번)를 입력해 주세요.' 
                  : (pinStep === 1 
                      ? '로그인 시 사용할 6자리 숫자를 입력하세요.' 
                      : '동일한 6자리 번호를 한 번 더 입력해 주세요.')}
              </DialogDescription>
            </div>

            {/* Special Mode: Re-Authentication Prompt Screen */}
            {isReAuthPending ? (
              <div className="w-full space-y-3 py-2">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-bold leading-relaxed">
                  💡 초기 비밀번호를 변경하지 않으셨다면 본인의 <strong>사번 ({profile?.employeeId || '사번'})</strong>을 입력하시면 됩니다.
                </div>
                <div className="space-y-1.5">
                  <Input
                    type="password"
                    placeholder="현재 비밀번호 또는 사번"
                    value={reAuthPin}
                    onChange={(e) => setReAuthPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleReAuth(reAuthPin);
                    }}
                    className="h-11 text-center text-base font-bold bg-muted/50 rounded-xl"
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  disabled={isUpdatingPin || !reAuthPin.trim()}
                  onClick={() => handleReAuth(reAuthPin)}
                  className="w-full h-11 rounded-xl font-black bg-primary text-primary-foreground shadow-sm cursor-pointer"
                >
                  {isUpdatingPin ? '인증 및 PIN 변경 중...' : '인증하고 PIN 변경 완료'}
                </Button>
              </div>
            ) : (
              <>
                {/* 6-Dot PIN Indicator or Native Input Field */}
                {!useNativeKeyboard ? (
                  <div className="flex gap-3 py-2 my-1">
                    {[...Array(6)].map((_, i) => {
                      const len = pinStep === 1 ? newPin.length : confirmPin.length;
                      const isFilled = len > i;
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "w-4 h-4 rounded-full border-2 transition-all duration-200", 
                            isFilled 
                              ? "bg-primary border-primary scale-110 shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                              : "bg-muted border-border/70"
                          )} 
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="w-full py-1">
                    <Input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="6자리 숫자 입력"
                      value={pinStep === 1 ? newPin : confirmPin}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                        if (pinStep === 1) {
                          setNewPin(cleaned);
                          if (cleaned.length === 6) setTimeout(() => setPinStep(2), 250);
                        } else {
                          setConfirmPin(cleaned);
                          if (cleaned.length === 6) {
                            if (cleaned === newPin) {
                              setTimeout(() => handleUpdatePin(cleaned), 150);
                            } else {
                              toast.error('비밀번호가 일치하지 않습니다.');
                              setPinStep(1);
                              setNewPin('');
                              setConfirmPin('');
                            }
                          }
                        }
                      }}
                      className="h-11 text-center tracking-[0.5em] text-lg font-black bg-muted/50 rounded-xl"
                      autoFocus
                    />
                  </div>
                )}

                {/* Visual Touch Keypad (0-9, C, Backspace) */}
                {!useNativeKeyboard && (
                  <div className="grid grid-cols-3 gap-1.5 w-full pt-1">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        disabled={isUpdatingPin}
                        onClick={() => handlePinInputDigit(digit)}
                        className="h-12 rounded-xl bg-muted/50 hover:bg-muted text-lg font-black text-foreground border border-border/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs select-none disabled:opacity-50"
                      >
                        {digit}
                      </button>
                    ))}
                    
                    <button
                      type="button"
                      disabled={isUpdatingPin}
                      onClick={handlePinClear}
                      className="h-12 rounded-xl bg-muted/30 hover:bg-muted/60 text-[11px] font-black text-muted-foreground hover:text-foreground border border-border/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      전체삭제
                    </button>

                    <button
                      type="button"
                      disabled={isUpdatingPin}
                      onClick={() => handlePinInputDigit('0')}
                      className="h-12 rounded-xl bg-muted/50 hover:bg-muted text-lg font-black text-foreground border border-border/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs select-none disabled:opacity-50"
                    >
                      0
                    </button>

                    <button
                      type="button"
                      disabled={isUpdatingPin}
                      onClick={handlePinBackspace}
                      className="h-12 rounded-xl bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 active:scale-95 transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Toggle Input Mode & Cancel Buttons */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-border/40">
              {!isReAuthPending ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseNativeKeyboard(!useNativeKeyboard)}
                  className="h-7 px-2 text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  {useNativeKeyboard ? (
                    <><Smartphone className="w-3 h-3" /> 터치 키패드로 입력</>
                  ) : (
                    <><Keyboard className="w-3 h-3" /> 스마트폰 키보드로 입력</>
                  )}
                </Button>
              ) : <div />}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsPinModalOpen(false);
                  setNewPin('');
                  setConfirmPin('');
                  setPendingNewPin('');
                  setReAuthPin('');
                  setPinStep(1);
                  setIsReAuthPending(false);
                }}
                className="h-7 px-2.5 text-[11px] font-bold text-muted-foreground hover:text-rose-500 cursor-pointer"
              >
                닫기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exam Certificate History Modal */}
      <Dialog open={isExamHistoryOpen} onOpenChange={setIsExamHistoryOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground p-0 overflow-hidden max-w-lg">
           <DialogHeader className="p-6 pb-3 border-b border-border">
              <DialogTitle className="text-lg font-black">안전 교육 이수 내역</DialogTitle>
           </DialogHeader>
           <div className="p-4 max-h-[55vh] overflow-y-auto space-y-2">
              {examHistory.map((res) => (
                <div key={res.id} className="bg-muted/50 p-3 rounded-2xl flex items-center justify-between border border-border">
                   <div className="min-w-0">
                      <h4 className="text-xs font-black text-foreground truncate">{res.trainingTitle}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(res.completedAt), 'yyyy.MM.dd')}</p>
                        <span className="text-[10px] text-primary font-black">{res.score}점</span>
                        <span className="text-[10px] text-muted-foreground/50 font-bold">{getRanking(res.id, res.trainingId)}</span>
                      </div>
                   </div>
                   <Badge className={cn("rounded-lg font-black text-[10px] shrink-0", res.isPassed ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
                      {res.isPassed ? '합격' : '과락'}
                   </Badge>
                </div>
              ))}
              {examHistory.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                   <p className="text-xs font-black">이수 내역이 없습니다.</p>
                </div>
              )}
           </div>
           <div className="p-4 border-t border-border">
              <Button className="w-full h-10 bg-muted text-foreground font-black rounded-xl hover:bg-muted/80" onClick={() => setIsExamHistoryOpen(false)}>닫기</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Emergency Evac Safety Signature Dialog */}
      <Dialog open={isEvacSignOpen} onOpenChange={setIsEvacSignOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 text-rose-500 animate-pulse" /> 비상 대피 안전 서명
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground">
              안전 대피를 완료했음을 확인하고 서명해 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <div className="border border-border/80 rounded-2xl overflow-hidden bg-white">
              <SignatureCanvas
                ref={evacSigPad}
                penColor="black"
                canvasProps={{
                  className: "w-full h-36 cursor-crosshair bg-white"
                }}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 p-0">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                if (evacSigPad.current) {
                  evacSigPad.current.clear();
                }
              }} 
              className="rounded-xl font-bold bg-muted h-9 text-xs"
            >
              초기화
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsEvacSignOpen(false)} 
              className="rounded-xl font-bold h-9 text-xs"
            >
              취소
            </Button>
            <Button 
              type="button" 
              onClick={handleEvacConfirmSafety} 
              disabled={isSubmittingEvac}
              className="rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 h-9 text-xs"
            >
              {isSubmittingEvac ? '제출 중...' : '확인 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
