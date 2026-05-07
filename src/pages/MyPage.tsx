import React, { useState } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
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
  ShieldCheck,
  Building2,
  Lock,
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
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { updatePassword, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '@/src/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { TrainingResult } from '@/src/types';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { PinKeypad } from '@/src/components/PinKeypad';
import { requestNotificationPermission } from '@/src/services/notificationService';

export const MyPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [reAuthPin, setReAuthPin] = useState('');
  const [isReAuthPending, setIsReAuthPending] = useState(false);
  const [examHistory, setExamHistory] = useState<TrainingResult[]>([]);
  const [allResults, setAllResults] = useState<TrainingResult[]>([]);
  const [isExamHistoryOpen, setIsExamHistoryOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [evacuationStatus, setEvacuationStatus] = useState<any>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);

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
    setIsUpdating(true);
    try {
      await updatePassword(auth.currentUser, finalPin);
      await updateDoc(doc(db, 'users', profile.uid), {
        hasCustomPin: true,
        lastPinChange: new Date().toISOString()
      });
      toast.success('비밀번호 등록 완료');
      setIsPinModalOpen(false);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setIsReAuthPending(true);
        setPinStep(1);
        toast.info('보안을 위해 한 번 더 입력해주세요.');
      } else {
        toast.error('오류가 발생했습니다.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReAuth = async (currentPin: string) => {
    if (!auth.currentUser || !profile) return;
    setIsUpdating(true);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, auth.currentUser.email!, currentPin);
      setIsReAuthPending(false);
      setReAuthPin('');
      toast.success('본인 확인 완료');
    } catch (error: any) {
      toast.error('일치하지 않습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (isReAuthPending) {
      const val = reAuthPin + digit;
      setReAuthPin(val);
      if (val.length === 6) handleReAuth(val);
      return;
    }
    if (pinStep === 1) {
      const val = newPin + digit;
      setNewPin(val);
      if (val.length === 6) setTimeout(() => setPinStep(2), 300);
    } else {
      const val = confirmPin + digit;
      setConfirmPin(val);
      if (val.length === 6) {
        if (val === newPin) handleUpdatePin(val);
        else {
          toast.error('일치하지 않습니다.');
          setPinStep(1); setNewPin(''); setConfirmPin('');
        }
      }
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

  const menuItems = [
    { label: '연차 내역', icon: CalendarDays, to: '/leave', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: '현물 신청', icon: Wallet, to: '/redemption', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
    { label: '월급 명세서', icon: FileText, to: '/mypage/payslip', color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
    { label: '엔터놀이터', icon: Trophy, to: '/entertainment', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: '로또 번호 생성기', icon: Ticket, to: '/lotto', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { label: '교육 이수증', icon: BookOpen, onClick: () => setIsExamHistoryOpen(true), color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: '간편 비밀번호', icon: Lock, onClick: () => setIsPinModalOpen(true), color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-4 pb-24 px-2">
      <header className="py-4 flex items-center justify-between">
        <div>
           <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">계정 및 프로필</p>
           <h2 className="text-2xl font-black tracking-tight text-white leading-tight">마이 페이지</h2>
        </div>
        <button 
          onClick={handleLogout}
          className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Emergency Status Alert Card */}
      {evacuationStatus?.isActive && (
        <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
           className={cn(
             "p-4 rounded-3xl border flex items-center gap-4 shadow-xl mb-2",
             hasConfirmed 
               ? "bg-emerald-600/10 border-emerald-600/20 text-emerald-500" 
               : "bg-rose-600/10 border-rose-600/20 text-rose-500"
           )}
        >
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
            hasConfirmed ? "bg-emerald-600/20" : "bg-rose-600/20 animate-pulse"
          )}>
            {hasConfirmed ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black truncate">{hasConfirmed ? '대피 완료 (안전)' : '즉시 대피 요망!'}</p>
            <p className="text-[10px] font-bold opacity-60 truncate">{evacuationStatus.reason || '비상 상황 소집령'}</p>
          </div>
          {!hasConfirmed && (
            <Button size="sm" className="bg-rose-600 text-white rounded-xl h-8 px-4 text-[10px] font-black shrink-0" onClick={() => toast.info('서명해주세요!')}>
              확인
            </Button>
          )}
        </motion.div>
      )}

      {/* Compact Profile Section */}
      <div className="flex gap-3">
        <Card className="flex-[1.5] border-none bg-gradient-to-br from-blue-600/10 to-blue-900/10 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-colors" />
          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-xl rotate-3 group-hover:rotate-0 transition-transform">
                {profile?.displayName?.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#121212] flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="min-w-0 w-full px-2">
              <h3 className="text-lg font-black text-white truncate">{profile?.displayName}</h3>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black px-1.5 py-0 h-5 rounded-md">
                  {profile?.position || '사원'}
                </Badge>
              </div>
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1 truncate">
                {profile?.departmentName || '부서 관리자'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 flex flex-col gap-2">
          <Card className="flex-1 border-none bg-white/[0.03] rounded-3xl border border-white/5 p-3 flex flex-col justify-center items-center gap-1 group">
             <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-1 group-hover:scale-110 transition-transform">
               <Wallet className="w-4 h-4" />
             </div>
             <p className="text-sm font-black text-white">{(profile?.points || 0).toLocaleString()}</p>
             <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">포인트</p>
          </Card>
          <Card className="flex-1 border-none bg-white/[0.03] rounded-3xl border border-white/5 p-3 flex flex-col justify-center items-center gap-1 group">
             <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-1 group-hover:scale-110 transition-transform">
               <CalendarDays className="w-4 h-4" />
             </div>
             <p className="text-sm font-black text-white">{profile?.annualLeaveBalance || 0}일</p>
             <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">연차</p>
          </Card>
        </div>
      </div>

      {/* Compact Quick Menu Grid */}
      <div className="grid grid-cols-2 gap-2">
        {menuItems.map((item, idx) => (
          <button 
            key={idx} 
            onClick={() => item.onClick ? item.onClick() : navigate(item.to!)}
            className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-left hover:bg-white/[0.05] transition-all group active:scale-95 shadow-sm"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform shrink-0", item.bgColor)}>
              <item.icon className={cn("w-5 h-5", item.color)} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black text-white truncate">{item.label}</span>
              <span className="text-[8px] font-bold text-white/20 uppercase">이동하기</span>
            </div>
          </button>
        ))}
      </div>

      {/* System Settings - 2x2 Grid Layout */}
      <div className="pt-2 space-y-2">
        <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-1">기기 및 시스템 설정</h4>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={toggleElderlyMode}
            className={cn(
              "p-4 rounded-3xl border transition-all flex flex-col gap-3",
              profile?.elderlyMode ? "bg-blue-600/20 border-blue-500/30" : "bg-white/[0.02] border-white/5"
            )}
          >
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", profile?.elderlyMode ? "bg-blue-500 text-white" : "bg-white/5 text-white/40")}>
              <Eye className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-white">어르신 모드</p>
              <p className="text-[8px] font-bold text-white/40">{profile?.elderlyMode ? '켜짐' : '꺼짐'}</p>
            </div>
          </button>

          <button 
            onClick={handleRequestPermission}
            className={cn(
              "p-4 rounded-3xl border transition-all flex flex-col gap-3",
              notificationPermission === 'granted' ? "bg-emerald-600/20 border-emerald-500/30" : "bg-white/[0.02] border-white/5"
            )}
          >
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", notificationPermission === 'granted' ? "bg-emerald-500 text-white" : "bg-white/5 text-white/40")}>
              <Bell className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-white">기기 알림</p>
              <p className="text-[8px] font-bold text-white/40 truncate">{notificationPermission === 'granted' ? '허용됨' : '차단됨'}</p>
            </div>
          </button>

          <button 
            onClick={handleToggleGhostGuard}
            className={cn(
              "p-4 rounded-3xl border transition-all flex flex-col gap-3",
              profile?.ghostGuardEnabled ? "bg-rose-600/20 border-rose-500/30" : "bg-white/[0.02] border-white/5"
            )}
          >
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", profile?.ghostGuardEnabled ? "bg-rose-500 text-white" : "bg-white/5 text-white/40")}>
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-white">유령 가드</p>
              <p className="text-[8px] font-bold text-white/40">{profile?.ghostGuardEnabled ? '작동 중' : '중지됨'}</p>
            </div>
          </button>

          <button 
            onClick={handleCalibrateAltitude}
            className="p-4 rounded-3xl border bg-white/[0.02] border-white/5 transition-all flex flex-col gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-white">고도 영점</p>
              <p className="text-[8px] font-bold text-white/40">{(profile?.currentAltitude || 0).toFixed(1)}m</p>
            </div>
          </button>
        </div>
      </div>

      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white p-0 overflow-hidden max-w-sm">
           <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-primary">
                 <Smartphone className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                 <DialogTitle className="text-xl font-black">
                   {isReAuthPending ? '본인 확인' : (pinStep === 1 ? '비밀번호 설정' : '비밀번호 확인')}
                 </DialogTitle>
                 <DialogDescription className="text-muted-foreground text-xs font-bold">
                    6자리 숫자를 입력해주세요
                 </DialogDescription>
              </div>
              <div className="flex gap-3">
                 {[...Array(6)].map((_, i) => {
                   const len = isReAuthPending ? reAuthPin.length : (pinStep === 1 ? newPin.length : confirmPin.length);
                   return <div key={i} className={cn("w-3 h-3 rounded-full border-2", len > i ? "bg-primary border-primary shadow-[0_0_10px_rgba(0,122,255,0.5)]" : "bg-white/5 border-white/10")} />;
                 })}
              </div>
           </div>
           <PinKeypad 
             onInput={handlePinInput} 
             onDelete={() => {
                if (isReAuthPending) setReAuthPin(p => p.slice(0, -1));
                else if (pinStep === 1) setNewPin(p => p.slice(0, -1));
                else setConfirmPin(p => p.slice(0, -1));
             }} 
             onClear={() => {
                if (isReAuthPending) setReAuthPin("");
                else if (pinStep === 1) setNewPin("");
                else setConfirmPin("");
             }}
             passwordLength={isReAuthPending ? reAuthPin.length : (pinStep === 1 ? newPin.length : confirmPin.length)}
             onBack={() => setIsPinModalOpen(false)}
             onOtherMethod={() => setIsPinModalOpen(false)}
             className={cn(!isPinModalOpen && "hidden")}
           />
        </DialogContent>
      </Dialog>

      <Dialog open={isExamHistoryOpen} onOpenChange={setIsExamHistoryOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white p-0 overflow-hidden max-w-lg">
           <DialogHeader className="p-8 pb-4">
              <DialogTitle className="text-xl font-black">교육 이수 내역</DialogTitle>
           </DialogHeader>
           <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
              {examHistory.map((res) => (
                <div key={res.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                   <div className="min-w-0">
                      <h4 className="text-sm font-black text-white truncate">{res.trainingTitle}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(res.completedAt), 'yyyy.MM.dd')}</p>
                        <span className="text-[10px] text-primary font-black">{res.score}점</span>
                        <span className="text-[10px] text-white/40 font-bold">{getRanking(res.id, res.trainingId)}</span>
                      </div>
                   </div>
                   <Badge className={cn("rounded-lg font-black text-[10px] shrink-0", res.isPassed ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
                      {res.isPassed ? '합격' : '과락'}
                   </Badge>
                </div>
              ))}
              {examHistory.length === 0 && (
                <div className="py-20 text-center opacity-20">
                  <p className="text-xs font-black">이력 없습니다</p>
                </div>
              )}
           </div>
           <div className="p-6">
              <Button className="w-full h-14 bg-white/5 text-white font-black rounded-2xl" onClick={() => setIsExamHistoryOpen(false)}>닫기</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
