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
  Navigation
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { updatePassword, signOut } from 'firebase/auth';
import { auth, db } from '@/src/firebase';
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
          });
          return () => unsubscribeCheckin();
        }
      } else {
        setEvacuationStatus(null);
      }
    });
    return () => unsubStatus();
  }, [profile]);

  const checkPermission = async () => {
    const isCapacitor = (window as any).Capacitor !== undefined;
    if (isCapacitor) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const status = await LocalNotifications.checkPermissions();
        setNotificationPermission(status.display);
      } catch (e) {
        console.error('Check native permission failed:', e);
      }
    } else {
      setNotificationPermission('Notification' in window ? Notification.permission : 'denied');
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
      // 안드로이드 앱 또는 Capacitor 환경 감지
      const isCapacitor = (window as any).Capacitor !== undefined;
      const isAdminApp = isCapacitor || window.location.protocol === 'capacitor:' || /Android/i.test(navigator.userAgent);
      
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
    }, (error) => console.error("Exam history listener error:", error));
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
    }, (error) => console.error("All results search listener error:", error));
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
      // We need to get the CURRENT pressure from sensor. However, since this component 
      // is not tracking sensors directly, we'll suggest clicking when they are on ground.
      // In a real device, the AltitudeTracker would handle updates. 
      // Here we just mark as needing a baseline reset.
      await updateDoc(doc(db, 'users', profile.uid), {
        basePressure: null, // This will trigger AltitudeTracker to re-initialize from next reading
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

  const menuItems = [
    { label: '연차 내역', icon: CalendarDays, to: '/leave', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: '현물 신청', icon: Wallet, to: '/redemption', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
    { label: '엔터놀이터', icon: Trophy, to: '/entertainment', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: '로또 번호 생성기', icon: Ticket, to: '/lotto', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { label: '교육 이수증', icon: BookOpen, onClick: () => setIsExamHistoryOpen(true), color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: '간편 비밀번호', icon: Lock, onClick: () => setIsPinModalOpen(true), color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex items-end justify-between">
        <div>
           <h2 className="text-3xl font-black tracking-tight text-white leading-tight">마이 페이지</h2>
           <p className="text-muted-foreground font-bold">나의 정보를 관리하세요</p>
        </div>
        <Button variant="ghost" className="text-muted-foreground hover:text-red-500" onClick={handleLogout}>
          <LogOut className="w-5 h-5 mr-2" /> 로그아웃
        </Button>
      </header>

      {/* Emergency Status Alert Card */}
      {evacuationStatus?.isActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "p-6 rounded-[32px] border-2 flex flex-col gap-4 shadow-xl transition-all",
            hasConfirmed 
              ? "bg-green-600/10 border-green-600/20 text-green-500" 
              : "bg-red-600/10 border-red-600/20 text-red-600"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              hasConfirmed ? "bg-green-600/20" : "bg-red-600/20 animate-pulse"
            )}>
              {hasConfirmed ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-lg font-black leading-tight">
                {hasConfirmed ? '안전이 확인되었습니다' : '대피 확인이 필요합니다!'}
              </p>
              <p className="text-[10px] font-bold opacity-70">
                {evacuationStatus.reason || '비상 소집령 발동 중'}
              </p>
            </div>
          </div>
          {!hasConfirmed && (
             <Button 
               className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl"
               onClick={() => {
                 // The overlay already handles confirmed status via global state
                 // This is just a visual link or direct button if needed
                 toast.info('화면 중앙의 버튼을 눌러주세요.');
               }}
             >
               지금 안전 확인하기
             </Button>
          )}
        </motion.div>
      )}

      {/* Profile Card */}
      <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
        <CardContent className="p-8 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-3xl font-black text-white border border-white/10">
              {profile?.displayName?.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full border-4 border-[#121212] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-black text-white tracking-tight">{profile?.displayName}</h3>
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-primary/20 text-primary border-none rounded-lg px-2 h-6 font-black text-[10px]">
                {profile?.position || '사원'}
              </Badge>
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <Building2 className="w-3 h-3" />
                {profile?.departmentName || '부서미지정'}
              </div>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">나의 포인트</p>
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center gap-1 text-primary">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xl font-black">{(profile?.points || 0).toLocaleString()}</span>
                 </div>
               </div>
            </div>
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">잔여 연차</p>
               <p className="text-xl font-black text-white">{profile?.annualLeaveBalance || 0}일</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu List */}
      <div className="space-y-2">
        {menuItems.map((item, idx) => (
          <div 
            key={idx} 
            className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
            onClick={() => item.onClick ? item.onClick() : navigate(item.to!)}
          >
            <div className="flex items-center gap-4">
               <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bgColor)}>
                 <item.icon className={cn("w-5 h-5", item.color)} />
               </div>
               <span className="text-base font-black text-white">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/10" />
          </div>
        ))}
      </div>

      {/* Settings section */}
      <div className="pt-4 space-y-3">
        <div 
          className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer"
          onClick={handleRequestPermission}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              notificationPermission === 'granted' ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
            )}>
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">기기 알림 설정</p>
              <p className="text-[10px] text-muted-foreground font-bold">
                {notificationPermission === 'granted' ? '알림이 활성화되었습니다' : '상태바 알림을 허용하세요'}
              </p>
            </div>
          </div>
          <div className={cn("px-3 py-1 rounded-lg text-[10px] font-black", 
            notificationPermission === 'granted' ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"
          )}>
            {notificationPermission === 'granted' ? '활성' : '비활성'}
          </div>
        </div>

        <div 
          className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer"
          onClick={toggleElderlyMode}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-muted-foreground">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">어르신 모드</p>
              <p className="text-[10px] text-muted-foreground font-bold">글씨를 크게 봅니다</p>
            </div>
          </div>
          <div className={cn("w-10 h-5 rounded-full transition-colors p-1", profile?.elderlyMode ? "bg-primary" : "bg-white/10")}>
            <div className={cn("w-3 h-3 bg-white rounded-full transition-transform", profile?.elderlyMode ? "translate-x-5" : "translate-x-0")} />
          </div>
        </div>

        {/* Altitude Calibration */}
        <div 
          className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer"
          onClick={handleCalibrateAltitude}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-muted-foreground">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">고도 영점 조정</p>
              <p className="text-[10px] text-muted-foreground font-bold">
                지상에서 클릭 (현재: {(profile?.currentAltitude || 0).toFixed(1)}m)
              </p>
            </div>
          </div>
          <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isUpdating && "animate-spin")} />
        </div>
      </div>

      {/* PIN Dialog */}
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

      {/* Education Histroy Dialog */}
      <Dialog open={isExamHistoryOpen} onOpenChange={setIsExamHistoryOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white p-0 overflow-hidden max-w-lg">
           <DialogHeader className="p-8 pb-4">
              <DialogTitle className="text-xl font-black">교육 이수 내역</DialogTitle>
           </DialogHeader>
           <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
              {examHistory.map((res) => (
                <div key={res.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                   <div>
                      <h4 className="text-sm font-black text-white">{res.trainingTitle}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(res.completedAt), 'yyyy.MM.dd')}</p>
                        <span className="text-[10px] text-primary font-black">{res.score}점</span>
                        <span className="text-[10px] text-white/40 font-bold">{getRanking(res.id, res.trainingId)}</span>
                      </div>
                   </div>
                   <Badge className={cn("rounded-lg font-black text-[10px]", res.isPassed ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
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
