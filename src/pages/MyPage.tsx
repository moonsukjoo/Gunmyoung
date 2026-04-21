import React, { useState } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  CalendarDays, 
  Trophy, 
  Ticket, 
  User, 
  ChevronRight,
  Settings,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock,
  UserCircle,
  FileText,
  Sparkles,
  Award,
  HardHat,
  Lock,
  Smartphone,
  RefreshCw,
  Eye,
  Check,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '@/src/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { TrainingResult } from '@/src/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { PinKeypad } from '@/src/components/PinKeypad';

export const MyPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState(1); // 1: input, 2: confirm
  const [isUpdating, setIsUpdating] = useState(false);
  const [reAuthPin, setReAuthPin] = useState('');
  const [isReAuthPending, setIsReAuthPending] = useState(false);
  const [examHistory, setExamHistory] = useState<TrainingResult[]>([]);
  const [isExamHistoryOpen, setIsExamHistoryOpen] = useState(false);

  React.useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'trainingResults'), 
      where('uid', '==', profile.uid),
      orderBy('completedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setExamHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    });
    return () => unsubscribe();
  }, [profile]);

  const handleUpdatePin = async (finalPin: string) => {
    if (!auth.currentUser || !profile) return;
    
    if (finalPin.length < 4) {
      toast.error('비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }
    
    setIsUpdating(true);
    try {
      // 1. Update Firebase Auth password
      await updatePassword(auth.currentUser, finalPin);
      
      // 2. Update Firestore profile to mark that PIN is set
      await updateDoc(doc(db, 'users', profile.uid), {
        hasCustomPin: true,
        lastPinChange: new Date().toISOString()
      });

      // 3. Store employeeId for remembered login mode
      localStorage.setItem('remembered_employeeId', profile.employeeId.trim());
      localStorage.setItem('remembered_displayName', profile.displayName);

      toast.success('비밀번호 등록 완료', {
        description: '이제 설정하신 사번과 비밀번호로 간편하게 로그인할 수 있습니다.'
      });
      setIsPinModalOpen(false);
      setNewPin('');
      setConfirmPin('');
      setIsReAuthPending(false);
      setReAuthPin('');
    } catch (error: any) {
      console.error("PIN update error:", error);
      if (error.code === 'auth/requires-recent-login') {
        setIsReAuthPending(true);
        setPinStep(1); // Reset step but keep modal open for re-auth
        setNewPin('');
        setConfirmPin('');
        toast.info('보안을 위해 현재 비밀번호를 한 번 더 입력해주세요.');
      } else {
        toast.error('비밀번호 변경 중 오류가 발생했습니다.');
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
      toast.success('본인 확인 완료. 새로운 비밀번호를 설정해주세요.');
    } catch (error: any) {
      console.error("Re-auth error:", error);
      toast.error('비밀번호가 일치하지 않습니다.');
      setReAuthPin('');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (isReAuthPending) {
      if (reAuthPin.length < 6) {
        const val = reAuthPin + digit;
        setReAuthPin(val);
        if (val.length === 6) {
          handleReAuth(val);
        }
      }
      return;
    }

    if (pinStep === 1) {
      if (newPin.length < 6) {
        const val = newPin + digit;
        setNewPin(val);
        if (val.length === 6) {
          // Auto transition to confirm step
          setTimeout(() => {
            setPinStep(2);
            toast.info('비밀번호 확인을 위해 한 번 더 입력해주세요.');
          }, 300);
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const val = confirmPin + digit;
        setConfirmPin(val);
        if (val.length === 6) {
          if (val === newPin) {
            handleUpdatePin(val);
          } else {
            toast.error('비밀번호가 일치하지 않습니다. 처음부터 다시 입력해주세요.');
            setTimeout(() => {
              setPinStep(1);
              setNewPin('');
              setConfirmPin('');
            }, 500);
          }
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (isReAuthPending) setReAuthPin(p => p.slice(0, -1));
    else if (pinStep === 1) setNewPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
  };

  const handlePinClear = () => {
    if (isReAuthPending) setReAuthPin('');
    else if (pinStep === 1) setNewPin('');
    else setConfirmPin('');
  };

  const toggleElderlyMode = async () => {
    if (!profile) return;
    try {
      const newValue = !profile.elderlyMode;
      await updateDoc(doc(db, 'users', profile.uid), {
        elderlyMode: newValue
      });
      toast.success(newValue ? '어르신 모드가 켜졌습니다' : '어르신 모드가 꺼졌습니다', {
        description: newValue ? '글자 크기가 150% 확대되었습니다.' : '글자 크기가 기본으로 설정되었습니다.'
      });
    } catch (error) {
      toast.error('설정 변경 중 오류가 발생했습니다.');
    }
  };

  const isHRAdmin = profile && ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role);
  const isManager = profile && profile.role !== 'EMPLOYEE';

  const menuItems = [
    // Employees access their info through Personnel page but it's filtered to just them
    ...(profile?.role === 'EMPLOYEE' ? [{ 
      label: '나의 인사정보', 
      icon: UserCircle, 
      to: '/personnel', 
      color: 'text-indigo-500', 
      bgColor: 'bg-indigo-50',
      description: '사번, 직위, 부서 등 나의 정보 확인 및 수정'
    }] : []),
    { 
      label: '월급명세서', 
      icon: FileText, 
      to: '#', 
      color: 'text-emerald-500', 
      bgColor: 'bg-emerald-50',
      description: '이달의 급여 및 명세서 확인 (준비중)'
    },
    { 
      label: '엔터놀이 (Entertainment)', 
      icon: Sparkles, 
      to: '/entertainment', 
      color: 'text-pink-500', 
      bgColor: 'bg-pink-50',
      description: '보물상자, 스크래치, 룰렛 등 포인트 엔터테인먼트'
    },
    { 
      label: '연차 관리', 
      icon: CalendarDays, 
      to: '/leave', 
      color: 'text-blue-500', 
      bgColor: 'bg-blue-50',
      description: '나의 연차 현황 및 신청'
    },
    { 
      label: '자격 및 안전 장비', 
      icon: Award, 
      to: '/qualification', 
      color: 'text-amber-500', 
      bgColor: 'bg-amber-50',
      description: '보유 자격증 및 안전 PPE 점검 현황'
    },
    { 
      label: '교육/평가 이수 내역', 
      icon: BookOpen, 
      onClick: () => setIsExamHistoryOpen(true),
      color: 'text-violet-500', 
      bgColor: 'bg-violet-50',
      description: '직무 교육 수강 및 평가 결과 확인'
    },
    // Only show admin link to admins in my page as well if needed, 
    // but usually it's better kept in the Admin page.
  ];

  const tenure = (() => {
    if (!profile?.joinedAt) return null;
    const start = new Date(profile.joinedAt);
    const now = new Date();
    
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();
    
    if (days < 0) {
      months -= 1;
      const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += lastMonth.getDate();
    }
    
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    
    return { years, months, days };
  })();

  return (
    <div className="w-full max-w-lg mx-auto space-y-8 pb-32 px-4 flex flex-col items-center overflow-x-hidden">
      <header className="flex flex-col gap-1 items-center text-center w-full">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-slate-900 italic">마이 페이지</h2>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.5em] leading-none">건명 시스템 MY PAGE</p>
      </header>

      {/* User Profile Card */}
      <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden relative group w-full ring-4 ring-primary/5">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
        <CardContent className="p-10 space-y-8 flex flex-col items-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-400 font-black text-4xl border-4 border-white shadow-2xl relative">
              {profile?.displayName?.charAt(0)}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <div className="flex flex-col items-center">
                <h3 className="text-3xl font-black tracking-tighter text-slate-900 leading-none mb-2">{profile?.displayName}</h3>
                <Badge variant="outline" className="bg-primary text-white border-none px-4 py-1 font-black text-[10px] uppercase tracking-widest rounded-full">
                  {profile?.position || '사원'}
                </Badge>
              </div>
              <div className="flex flex-col items-center gap-1 text-slate-400 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                    {profile?.role === 'CEO' ? '대표' : 
                     profile?.role === 'DIRECTOR' ? '이사' : 
                     profile?.role === 'GENERAL_AFFAIRS' ? '총무' : 
                     profile?.role === 'GENERAL_MANAGER' ? '부장' : 
                     profile?.role === 'CLERK' ? '주임' : '사원'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{profile?.departmentName || '부서 미지정'}</span>
                </div>
                {tenure && (
                  <div className="mt-3 bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10">
                    <p className="text-[10px] font-black text-primary leading-tight">
                       <span className="opacity-70">건명기업 입사 후</span><br/>
                       {tenure.years > 0 && <span>{tenure.years}년 </span>}
                       {tenure.months > 0 && <span>{tenure.months}개월 </span>}
                       <span>{tenure.days}일째</span> 근무 중
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 w-full pt-8 border-t border-slate-50">
            <div className="space-y-1 text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">나의 포인트</span>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-2xl font-black text-primary tracking-tighter">{(profile?.points || 0).toLocaleString()}P</span>
                <span className="text-[9px] font-bold text-slate-400 italic">{(profile?.points || 0) * 5000}원</span>
              </div>
            </div>
            <div className="space-y-1 text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">남은 연차 일수</span>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-2xl font-black text-slate-900 tracking-tighter">{profile?.annualLeaveBalance || 0}일</span>
                <span className="text-[9px] font-bold text-slate-400 italic">남은 연차 일수</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Section */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">나의 서비스</h3>
        <div className="grid gap-3">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => item.onClick ? item.onClick() : navigate(item.to!)}
              className="w-full flex items-center justify-between p-5 bg-white rounded-[2rem] shadow-sm hover:shadow-md transition-all active:scale-[0.98] group border border-transparent hover:border-slate-100"
            >
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", item.bgColor)}>
                  <item.icon className={cn("w-6 h-6", item.color)} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-slate-900 tracking-tight">{item.label}</div>
                  <div className="text-[10px] font-bold text-slate-400">{item.description}</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* App Settings Section */}
      <div className="space-y-3 w-full">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">앱 설정</h3>
        <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
          <CardContent className="p-2 space-y-1">
            <button 
              onClick={toggleElderlyMode}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-2xl group"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  profile?.elderlyMode ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110" : "bg-slate-100 text-slate-400"
                )}>
                  <Eye className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-slate-900 leading-none mb-1 flex items-center gap-2">
                    어르신 모드
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">글자 크기를 150% 이상 크게 보기</div>
                </div>
              </div>
              <div className={cn(
                "w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center",
                profile?.elderlyMode ? "bg-primary" : "bg-slate-200"
              )}>
                <div className={cn(
                  "w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 flex items-center justify-center",
                  profile?.elderlyMode ? "translate-x-6" : "translate-x-0"
                )}>
                  {profile?.elderlyMode && <Check className="w-2.5 h-2.5 text-primary stroke-[4]" />}
                </div>
              </div>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Settings Button */}
      <Dialog open={isPinModalOpen} onOpenChange={(open) => {
        setIsPinModalOpen(open);
        if (!open) {
          setPinStep(1);
          setNewPin('');
          setConfirmPin('');
        }
      }}>
        <DialogTrigger render={
          <Button variant="ghost" className="w-full h-14 rounded-[2rem] text-slate-400 hover:text-primary hover:bg-white font-black text-xs gap-2 uppercase tracking-widest outline-none">
            <Lock className="w-4 h-4" /> 간편 비밀번호 등록/변경
          </Button>
        } />
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-white px-8 pt-10 pb-6 flex flex-col items-center gap-6">
            <div className="w-12 h-12 bg-[#0066CC]/10 rounded-2xl flex items-center justify-center text-[#0066CC]">
              {isReAuthPending ? <Lock className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>
            
            <div className="text-center space-y-1">
              <DialogTitle className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                {isReAuthPending ? '본인 확인' : (pinStep === 1 ? '새 비밀번호 설정' : '비밀번호 확인')}
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-slate-400">
                {isReAuthPending 
                  ? '현재 사용 중인 비밀번호 6자리를 입력해주세요.'
                  : (pinStep === 1 
                      ? '로그인 시 사용할 6자리 숫자를 입력해주세요.' 
                      : '정확한 등록을 위해 한 번 더 입력해주세요.')}
              </DialogDescription>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-4 h-5 items-center">
                {[...Array(6)].map((_, i) => {
                  const currentLength = isReAuthPending ? reAuthPin.length : (pinStep === 1 ? newPin.length : confirmPin.length);
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "w-3.5 h-3.5 rounded-full transition-all duration-300 border-2",
                        currentLength > i 
                          ? "bg-[#0066CC] border-[#0066CC] scale-110 shadow-[0_0_10px_rgba(0,102,204,0.3)]" 
                          : "bg-slate-50 border-slate-100"
                      )} 
                    />
                  );
                })}
              </div>

              <div className="h-4 flex items-center justify-center">
                {isUpdating && (
                  <div className="flex items-center gap-2 text-[#0066CC] font-black text-[10px] animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    {isReAuthPending ? '인증 확인 중...' : '정보 저장 중...'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <PinKeypad 
            onInput={handlePinInput}
            onDelete={handlePinDelete}
            onClear={handlePinClear}
            className="rounded-t-[2.5rem]"
          />
        </DialogContent>
      </Dialog>
      {/* Exam History Dialog */}
      <Dialog open={isExamHistoryOpen} onOpenChange={setIsExamHistoryOpen}>
        <DialogContent className="bg-white border-none rounded-[3rem] shadow-2xl max-w-2xl w-[95%] p-0 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="p-8 pb-4 bg-violet-50/50 border-b border-violet-100 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-violet-500 text-white border-none text-[10px] px-3 font-black tracking-widest uppercase">My Education</Badge>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter text-slate-900 leading-tight">교육/평가 이수 현황</DialogTitle>
            <DialogDescription className="text-slate-500 font-bold">지금까지 완료한 직무 교육 및 평가 결과입니다.</DialogDescription>
          </DialogHeader>

          <div className="p-4 overflow-y-auto no-scrollbar flex-grow bg-slate-50/50">
            <div className="grid gap-3">
              {examHistory.map((res) => (
                <Card key={res.id} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "font-black text-[9px] px-2 py-0.5 rounded-full border-none",
                          res.isPassed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                        )}>
                          {res.isPassed ? '합격' : '불합격'}
                        </Badge>
                        <h4 className="text-sm font-black text-slate-900">{res.trainingTitle}</h4>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                        <span>날짜: {format(new Date(res.completedAt), 'yyyy.MM.dd HH:mm')}</span>
                        <span>점수: <span className={cn(res.isPassed ? "text-emerald-600" : "text-red-500")}>{res.score}/{res.totalQuestions}</span></span>
                      </div>
                    </div>
                    {res.isPassed ? (
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                        <Trophy className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-500">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {examHistory.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center gap-3 opacity-20 capitalize">
                  <BookOpen className="w-12 h-12 text-slate-300" />
                  <p className="text-xs font-black tracking-widest">이수 내역이 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-8 pt-4 bg-white border-t border-slate-100 shrink-0">
             <Button className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black" onClick={() => setIsExamHistoryOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
