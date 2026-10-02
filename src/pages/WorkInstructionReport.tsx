import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, query, where, getDocs, addDoc, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { UserProfile, WorkInstructionReport, Role } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  User, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Plus, 
  Trash2, 
  CheckCircle2, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Signature as SignatureIcon, 
  Save, 
  Send,
  Sparkles,
  Users,
  CheckCheck,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import SignatureCanvas from 'react-signature-canvas';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";

const REPORT_STEPS = [
  { id: 1, title: '기본 & TBM', desc: '결재선 및 전파사항', icon: ClipboardList },
  { id: 2, title: '지시 & 서명', desc: '작업자별 전/후 서명', icon: User },
  { id: 3, title: '안전점검', desc: '일일 안전 체크리스트', icon: ShieldCheck },
  { id: 4, title: '위험평가 & 제출', desc: '위험요인 대책 및 제출', icon: Send }
];

const SAFETY_CHECK_ITEMS = [
  {
    category: '기초질서',
    items: [
      { no: 1, text: '기초질서 준수 (착수,휴식,중식,종료시간 등)' },
      { no: 2, text: '개인 안전 보호구착용 철저' },
      { no: 3, text: '담당구역 정리정돈 철저' }
    ]
  },
  {
    category: '안전작업',
    items: [
      { no: 1, text: '고소작업시 안전벨트 착용후 작업할 것' },
      { no: 2, text: '고소작업에 대한 추락 및 낙하물 방지 설비확인' },
      { no: 3, text: '케이블 및 전선 나선 상태확인' },
      { no: 4, text: '환기장치 가동 상태확인' },
      { no: 5, text: '양중공구 점검 및 유지관리 상태확인' },
      { no: 6, text: '소화기 점검 및 안전통로 확보확인' }
    ]
  },
  {
    category: '안전 선행지수',
    items: [
      { no: 1, text: '중량물 이동시 무게중심 확인' },
      { no: 2, text: '고소작업시 족장결착 상태확인' },
      { no: 3, text: '사다리 통행시 3타점 준수할 것' }
    ]
  }
];

const PREFILLED_HAZARDS = [
  { factor: 'BLOCK충돌', method: '보조로우프 사용, 단줄잡이 예비 비치' },
  { factor: '탑재공간 미확보', method: '공간 사전 확보 및 확인, 선후공정 협의 조율' },
  { factor: 'LUG확인', method: '용접부 확인 및 이면확인, 이면 보강재 확인' },
  { factor: '부재탑재', method: '배판 돌출부 확인, 작업공간 확인' },
  { factor: '신호방법', method: '복명복창, 상호확인 철저' },
  { factor: '장비충돌', method: '인접장비 주행 확인, 사전 연락체계 확립' }
];

export const WorkInstructionReportPage: React.FC = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  
  // Signature Dialog State
  const [isSignOpen, setIsSignOpen] = useState(false);
  const [activeSignIdx, setActiveSignIdx] = useState<{ idx: number, type: 'before' | 'after' } | null>(null);
  const sigPad = useRef<SignatureCanvas>(null);
  const [justSigned, setJustSigned] = useState<{ idx: number, type: 'before' | 'after' } | null>(null);

  // Scroll to top on page load and step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [currentStep]);

  // Safely patch SignaturePad prototype through the active SignatureCanvas instance when dialog is opened
  useEffect(() => {
    if (isSignOpen) {
      const timer = setTimeout(() => {
        try {
          const sigCanvasInstance = sigPad.current;
          if (sigCanvasInstance) {
            const pad = (sigCanvasInstance as any).getSignaturePad?.() || (sigCanvasInstance as any)._sigPad;
            if (pad) {
              const padProto = Object.getPrototypeOf(pad);
              if (padProto) {
                if (padProto._strokeEnd && !padProto._strokeEnd.__isPatched) {
                  const originalStrokeEnd = padProto._strokeEnd;
                  padProto._strokeEnd = function(event: any) {
                    if (!this._activeStroke) {
                      console.warn("SignaturePad: touch end occurred but no active stroke found. Crash prevented.");
                      return;
                    }
                    originalStrokeEnd.call(this, event);
                  };
                  padProto._strokeEnd.__isPatched = true;
                }

                if (padProto._strokeUpdate && !padProto._strokeUpdate.__isPatched) {
                  const originalStrokeUpdate = padProto._strokeUpdate;
                  padProto._strokeUpdate = function(event: any) {
                    if (!this._activeStroke) {
                      console.warn("SignaturePad: touch move occurred but no active stroke found. Crash prevented.");
                      return;
                    }
                    originalStrokeUpdate.call(this, event);
                  };
                  padProto._strokeUpdate.__isPatched = true;
                }
              }
            }
          }
        } catch (err) {
          console.warn("Error patching signature pad prototype dynamically:", err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSignOpen]);

  // Form State
  const [formData, setFormData] = useState<Partial<WorkInstructionReport>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    dayOfWeek: format(new Date(), 'EEEE', { locale: ko }),
    supervisorName: '',
    safetyManagerName: '',
    tbmContent: '개인 안전 보호구 착용 실태 점검 및 작업 전 TBM 실시',
    workerInstructions: [],
    safetyChecks: SAFETY_CHECK_ITEMS.map(cat => ({
      category: cat.category,
      items: cat.items.map(item => ({ ...item, result: 'O' }))
    })),
    hazardAssessments: PREFILLED_HAZARDS.map((ph, idx) => ({
      no: idx + 1,
      hazardFactor: ph.factor,
      safetyMethod: ph.method,
      actionContent: '',
      remarks: ''
    })),
    status: 'PENDING'
  });

  const [defaultSafetyManager, setDefaultSafetyManager] = useState<string>('김주영');

  // Listen to company settings for default safety manager name
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'company'), (snap) => {
      if (snap.exists() && snap.data().safetyManagerName) {
        setDefaultSafetyManager(snap.data().safetyManagerName);
      }
    }, (err) => {
      console.warn("Company settings fetch warning:", err);
    });
    return () => unsub();
  }, []);

  const isSupervisor = profile?.role === 'TEAM_LEADER' || ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER'].includes(profile?.role || '');
  const canEditSafetyManager = ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'TEAM_LEADER'].includes(profile?.role || '') || isSupervisor;

  useEffect(() => {
    if (authLoading) return;
    
    if (!profile?.departmentId) {
      setLoading(false);
      return;
    }
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'workInstructionReports'), 
      where('teamId', '==', profile.departmentId),
      where('date', '==', today)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkInstructionReport));
      
      const pendingReport = reports.find(r => r.status === 'PENDING');
      
      if (pendingReport) {
        setReportId(pendingReport.id);
        setFormData(pendingReport);
      } else if (reports.length > 0) {
        const latest = reports[0];
        setReportId(latest.id);
        setFormData(latest);
      } else {
        setReportId(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
    });

    return () => unsubscribe();
  }, [profile, authLoading]);

  const handleCreateReport = async () => {
    if (!profile?.departmentId) return;
    setSubmitting(true);
    try {
      const workersQuery = query(
        collection(db, 'users'),
        where('departmentId', '==', profile.departmentId),
        where('status', '==', 'ACTIVE')
      );
      const workersSnap = await getDocs(workersQuery);
      const workers = workersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

      const newReport: Partial<WorkInstructionReport> = {
        teamId: profile.departmentId,
        teamName: profile.departmentName || '',
        date: format(new Date(), 'yyyy-MM-dd'),
        dayOfWeek: format(new Date(), 'EEEE', { locale: ko }),
        supervisorName: profile.displayName || '',
        safetyManagerName: defaultSafetyManager || '김주영',
        tbmContent: '개인 안전 보호구 착용 실태 점검 및 작업 전 TBM 실시',
        workerInstructions: workers.map((w, idx) => ({
          no: idx + 1,
          workerUid: w.uid,
          workerName: w.displayName,
          instruction: '',
          startTime: '08:00',
          endTime: '',
          hazardSubmitted: false,
          healthStatus: 'GOOD'
        })),
        safetyChecks: SAFETY_CHECK_ITEMS.map(cat => ({
          category: cat.category,
          items: cat.items.map(item => ({ ...item, result: 'O' }))
        })),
        hazardAssessments: PREFILLED_HAZARDS.map((ph, idx) => ({
          no: idx + 1,
          hazardFactor: ph.factor,
          safetyMethod: ph.method,
          actionContent: '',
          remarks: ''
        })),
        createdAt: new Date().toISOString(),
        createdByUid: profile.uid,
        createdByName: profile.displayName || '',
        status: 'PENDING'
      };

      await addDoc(collection(db, 'workInstructionReports'), newReport);
      toast.success('오늘의 일지가 생성되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workInstructionReports');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (updatedData: Partial<WorkInstructionReport>) => {
    if (!reportId) return;
    try {
      await updateDoc(doc(db, 'workInstructionReports', reportId), updatedData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'workInstructionReports');
    }
  };

  const updateWorkerItem = (idx: number, field: string, value: any) => {
    const newInstructions = [...(formData.workerInstructions || [])];
    newInstructions[idx] = { ...newInstructions[idx], [field]: value };
    handleUpdate({ workerInstructions: newInstructions });
  };

  const updateSafetyCheck = (catIdx: number, itemIdx: number, result: 'O' | 'X' | 'N/A') => {
    if (!isSupervisor) return;
    const newChecks = [...(formData.safetyChecks || [])];
    const newItems = [...newChecks[catIdx].items];
    newItems[itemIdx] = { ...newItems[itemIdx], result };
    newChecks[catIdx] = { ...newChecks[catIdx], items: newItems };
    handleUpdate({ safetyChecks: newChecks });
  };

  const handleCheckAllSafety = (result: 'O' | 'X' | 'N/A') => {
    if (!isSupervisor) return;
    const newChecks = (formData.safetyChecks || []).map(cat => ({
      ...cat,
      items: cat.items.map(item => ({ ...item, result }))
    }));
    handleUpdate({ safetyChecks: newChecks });
    toast.success(`안전점검 전체 항목이 '${result}'로 설정되었습니다.`);
  };

  const handleSignSave = () => {
    if (sigPad.current && activeSignIdx) {
      if (sigPad.current.isEmpty()) {
        toast.error('서명을 작성해주세요.');
        return;
      }
      const dataUrl = sigPad.current.toDataURL();
      const currentIdx = activeSignIdx.idx;
      const currentType = activeSignIdx.type;

      if (currentIdx === -1) {
        if (!isSupervisor) {
          toast.error('관리감독자 권한이 없습니다.');
          return;
        }
        handleUpdate({ supervisorSignUrl: dataUrl });
      } else if (currentIdx === -2) {
        const canSignSafety = profile?.role === 'SAFETY_MANAGER' || ['CEO', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile?.role || '');
        if (!canSignSafety) {
          toast.error('안전관리자 혹은 소장님만 서명할 수 있습니다.');
          return;
        }
        handleUpdate({ safetyManagerSignUrl: dataUrl });
      } else {
        const newInstructions = [...(formData.workerInstructions || [])];
        const targetWorker = newInstructions[currentIdx];
        if (!isSupervisor && targetWorker.workerUid !== profile?.uid) {
          toast.error('본인의 서명만 가능합니다.');
          return;
        }

        if (currentType === 'before') {
          newInstructions[currentIdx].signBeforeUrl = dataUrl;
        } else {
          newInstructions[currentIdx].signAfterUrl = dataUrl;
        }
        handleUpdate({ workerInstructions: newInstructions });
      }

      setJustSigned({ idx: currentIdx, type: currentType });
      setTimeout(() => {
        setJustSigned(null);
      }, 3000);

      setIsSignOpen(false);
      setActiveSignIdx(null);
      toast.success('서명이 완료되었습니다!');
    }
  };

  const handleFinalSubmit = async () => {
    if (!reportId || !profile) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'workInstructionReports', reportId), {
        status: 'APPROVED'
      });

      const targetRoles: Role[] = ['GENERAL_AFFAIRS', 'CLERK', 'DIRECTOR', 'GENERAL_MANAGER'];
      const managersQuery = query(
        collection(db, 'users'), 
        where('departmentId', '==', profile.departmentId || ''),
        where('role', 'in', targetRoles)
      );
      
      const managersSnap = await getDocs(managersQuery);
      const notificationPromises = managersSnap.docs.map(doc => 
        addDoc(collection(db, 'notifications'), {
          uid: doc.id,
          title: '📋 작업지시 및 일일점검지 작성 완료',
          message: `${profile.departmentName}팀의 ${formData.date} 작업지시서가 최종 제출되었습니다.`,
          type: 'SYSTEM',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        })
      );
      
      await Promise.all(notificationPromises);
      toast.success('보고서가 최종 제출되었습니다.');
      navigate(-1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workInstructionReports');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Badge variant="outline" className="animate-pulse font-black text-sm p-3">데이터 동기화 중...</Badge>
      </div>
    );
  }

  if (!reportId) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center p-6 space-y-6 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-muted/60 rounded-3xl flex items-center justify-center text-muted-foreground/30 shadow-inner">
          <ClipboardList className="w-10 h-10 text-primary/40" />
        </div>
        {!profile?.departmentId ? (
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-rose-500">소속 팀 정보 없음</h2>
            <p className="text-muted-foreground font-bold text-sm">현재 소속된 팀이 지정되지 않았습니다.<br/>관리자에게 팀 배정을 요청해 주세요.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">오늘의 일지가 없습니다</h2>
              <p className="text-muted-foreground font-medium text-sm">팀장님께서 아직 오늘의 작업지시서를<br/>생성하지 않았습니다.</p>
            </div>
            {isSupervisor && (
              <Button 
                onClick={handleCreateReport} 
                disabled={submitting}
                className="h-14 px-8 rounded-2xl font-black text-base gap-2 bg-primary text-white shadow-xl shadow-primary/20 hover:bg-primary/95"
              >
                {submitting ? '생성 중...' : '오늘의 일지 생성하기'}
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" onClick={() => navigate(-1)} className="font-black rounded-xl">뒤로 가기</Button>
      </div>
    );
  }

  const workers = formData.workerInstructions || [];
  const signedBeforeCount = workers.filter(w => w.signBeforeUrl).length;
  const signedAfterCount = workers.filter(w => w.signAfterUrl).length;

  return (
    <div className="space-y-6 pb-28 px-2 sm:px-4 max-w-4xl mx-auto">
      {/* Header */}
      <header className="py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-2xl h-11 w-11 bg-muted/40 hover:bg-muted">
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground leading-tight">작업지시 및 일일안전 점검일지</h1>
            <p className="text-muted-foreground font-bold text-xs">{formData.date} ({formData.dayOfWeek}) · {formData.teamName}</p>
          </div>
        </div>
        {formData.status === 'APPROVED' ? (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-black px-3.5 py-1.5 rounded-xl text-xs">
            제출 완료
          </Badge>
        ) : (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-black px-3 py-1.5 rounded-xl text-xs">
            작성 진행 중
          </Badge>
        )}
      </header>

      {/* 4-Step Wizard Stepper Navigation */}
      <div className="bg-card border border-border/80 rounded-3xl p-3 sm:p-4 shadow-md">
        <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-3">
          {REPORT_STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isPast = currentStep > step.id;
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  "flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2.5 p-2 sm:p-3 rounded-2xl text-left transition-all relative overflow-hidden",
                  isActive 
                    ? "bg-primary/10 border border-primary/30 shadow-sm" 
                    : isPast 
                    ? "bg-muted/40 hover:bg-muted/70 text-foreground" 
                    : "text-muted-foreground/60 hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black transition-all",
                  isActive 
                    ? "bg-primary text-white shadow-md shadow-primary/30 scale-105" 
                    : isPast 
                    ? "bg-emerald-500 text-white" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : step.id}
                </div>
                <div className="text-center sm:text-left min-w-0">
                  <p className={cn(
                    "text-[11px] sm:text-xs font-black truncate",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {step.title}
                  </p>
                  <p className="hidden sm:block text-[10px] text-muted-foreground font-medium truncate">
                    {step.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Linear step progress bar */}
        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${((currentStep - 1) / (REPORT_STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Step Contents */}
      <AnimatePresence mode="wait">
        {/* Step 1: 기본 정보 & TBM */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
              <CardHeader className="bg-muted/40 border-b border-border p-5">
                <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                  <ClipboardList className="w-4 h-4 text-primary" /> 1단계: 기본 정보 & 결재선 서명
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Supervisor Signature Box */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-xs font-black text-foreground">관리감독자 (팀장 서명)</label>
                      <span className="text-[10px] font-bold text-muted-foreground">직접 터치하여 서명</span>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        value={formData.supervisorName}
                        onChange={e => {
                          setFormData(prev => ({ ...prev, supervisorName: e.target.value }));
                          handleUpdate({ supervisorName: e.target.value });
                        }}
                        readOnly={!isSupervisor || formData.status === 'APPROVED'}
                        placeholder="팀장 성함"
                        className="h-14 bg-muted/30 border-border/70 rounded-2xl font-black text-foreground focus:bg-card transition-all flex-[2] text-sm"
                      />
                      <div 
                        id="supervisor-signature-box"
                        className={cn(
                          "relative h-14 bg-muted/20 border-2 border-dashed border-border rounded-2xl flex items-center justify-center cursor-pointer hover:bg-muted/40 transition-all flex-1 min-w-[110px] overflow-hidden",
                          formData.supervisorSignUrl && "border-emerald-500/50 bg-emerald-500/5",
                          (!isSupervisor || formData.status === 'APPROVED') && "opacity-60 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (!isSupervisor || formData.status === 'APPROVED') return;
                          setActiveSignIdx({ idx: -1, type: 'before' });
                          setIsSignOpen(true);
                        }}
                      >
                        {formData.supervisorSignUrl ? (
                           <div className="relative w-full h-full flex items-center justify-center p-1">
                             <img src={formData.supervisorSignUrl} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="supervisor-sign" />
                             <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                               <Check className="w-2.5 h-2.5" strokeWidth={4} />
                             </div>

                             <AnimatePresence>
                               {justSigned?.idx === -1 && (
                                 <motion.div 
                                   initial={{ opacity: 0, scale: 0.6 }}
                                   animate={{ opacity: 1, scale: 1 }}
                                   exit={{ opacity: 0, scale: 0.8 }}
                                   className="absolute inset-0 bg-emerald-500/95 flex flex-col items-center justify-center rounded-xl z-10 pointer-events-none text-white text-[10px]"
                                   transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                 >
                                   <Check className="w-5 h-5 text-white" strokeWidth={4} />
                                   <span className="font-black mt-0.5">서명 완료</span>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                           </div>
                        ) : (
                           <div className="flex flex-col items-center justify-center gap-0.5 select-none">
                             <SignatureIcon className="w-4 h-4 text-muted-foreground/40 animate-pulse" />
                             <span className="text-[10px] font-black text-primary">팀장 서명</span>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Safety Manager / Director Signature Box */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-xs font-black text-foreground">안전보건관리책임자 (소장 서명)</label>
                      <span className="text-[10px] font-bold text-muted-foreground">소장/안전관리자</span>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        value={formData.safetyManagerName !== undefined ? formData.safetyManagerName : defaultSafetyManager}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, safetyManagerName: val }));
                          handleUpdate({ safetyManagerName: val });
                        }}
                        readOnly={!canEditSafetyManager || formData.status === 'APPROVED'}
                        placeholder="소장 성함"
                        className="h-14 bg-muted/30 border-border/70 rounded-2xl font-black text-primary focus:bg-card transition-all flex-[2] text-sm"
                      />
                      <div 
                        id="safety-manager-signature-box"
                        className={cn(
                          "relative h-14 bg-muted/20 border-2 border-dashed border-border rounded-2xl flex items-center justify-center cursor-pointer hover:bg-muted/40 transition-all flex-1 min-w-[110px] overflow-hidden",
                          formData.safetyManagerSignUrl && "border-emerald-500/50 bg-emerald-500/5",
                          (formData.status === 'APPROVED') && "opacity-60 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (formData.status === 'APPROVED') return;
                          const canSignSafety = profile?.role === 'SAFETY_MANAGER' || ['CEO', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile?.role || '');
                          if (!canSignSafety) {
                            toast.error('안전관리자 혹은 소장님만 서명할 수 있습니다.');
                            return;
                          }
                          setActiveSignIdx({ idx: -2, type: 'before' });
                          setIsSignOpen(true);
                        }}
                      >
                        {formData.safetyManagerSignUrl ? (
                           <div className="relative w-full h-full flex items-center justify-center p-1">
                             <img src={formData.safetyManagerSignUrl} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="safety-manager-sign" />
                             <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                               <Check className="w-2.5 h-2.5" strokeWidth={4} />
                             </div>

                             <AnimatePresence>
                               {justSigned?.idx === -2 && (
                                 <motion.div 
                                   initial={{ opacity: 0, scale: 0.6 }}
                                   animate={{ opacity: 1, scale: 1 }}
                                   exit={{ opacity: 0, scale: 0.8 }}
                                   className="absolute inset-0 bg-emerald-500/95 flex flex-col items-center justify-center rounded-xl z-10 pointer-events-none text-white text-[10px]"
                                   transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                 >
                                   <Check className="w-5 h-5 text-white" strokeWidth={4} />
                                   <span className="font-black mt-0.5">승인 완료</span>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                           </div>
                        ) : (
                           <div className="flex flex-col items-center justify-center gap-0.5 select-none">
                             <SignatureIcon className="w-4 h-4 text-primary/40" />
                             <span className="text-[10px] font-black text-primary">소장 서명</span>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* TBM Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-black text-foreground">TBM 및 주요 안전 전파사항</label>
                    <span className="text-[10px] font-bold text-muted-foreground">작업 전 전달할 안전 공지</span>
                  </div>
                  <Textarea 
                    value={formData.tbmContent}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, tbmContent: e.target.value }));
                      handleUpdate({ tbmContent: e.target.value });
                    }}
                    readOnly={!isSupervisor || formData.status === 'APPROVED'}
                    placeholder="오늘의 주요 작업 지시 및 안전 전파사항을 입력하세요."
                    className="min-h-[110px] bg-muted/30 border-border/70 rounded-2xl font-bold focus:bg-card transition-all resize-none p-4 leading-relaxed text-sm text-foreground"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="w-full h-14 bg-primary text-white font-black text-base rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary/95 flex items-center justify-center gap-2"
            >
              다음: 작업 지시 및 작업자 서명 <ChevronRight className="w-5 h-5" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: 작업 지시 및 작업자 서명 */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
              <CardHeader className="bg-muted/40 border-b border-border p-4 sm:p-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                    <User className="w-4 h-4 text-primary" /> 2단계: 인원별 작업 지시 및 전자 서명
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] font-black">
                      총원 {workers.length}명
                    </Badge>
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px] font-black">
                      작업전 서명 {signedBeforeCount}/{workers.length}
                    </Badge>
                    <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-none text-[10px] font-black">
                      작업후 서명 {signedAfterCount}/{workers.length}
                    </Badge>
                  </div>
                </div>

                {isSupervisor && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const newInstructions = [...(formData.workerInstructions || [])];
                      newInstructions.push({
                        no: newInstructions.length + 1,
                        workerUid: '',
                        workerName: '새 인원',
                        instruction: '',
                        startTime: '08:00',
                        endTime: '',
                        hazardSubmitted: false,
                        healthStatus: 'GOOD'
                      });
                      handleUpdate({ workerInstructions: newInstructions });
                    }} 
                    className="rounded-xl font-black h-9 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Plus className="w-4 h-4" /> 인원 추가
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile touch-friendly card list */}
                <div className="md:hidden divide-y divide-border/50 p-3 sm:p-4 space-y-4">
                  {workers.map((worker, idx) => {
                    const canEditThisRow = isSupervisor || worker.workerUid === profile?.uid;
                    return (
                      <div key={idx} className={cn(
                        "p-4 rounded-3xl border border-border bg-muted/20 space-y-3 relative overflow-hidden",
                        worker.workerUid === profile?.uid && "bg-primary/5 border-primary/30"
                      )}>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">NO. {worker.no}</span>
                          <Badge variant={worker.healthStatus === 'GOOD' ? 'default' : worker.healthStatus === 'BAD' ? 'destructive' : 'outline'} className="text-[9px] font-black rounded-lg">
                            건강: {worker.healthStatus === 'GOOD' ? '좋음' : worker.healthStatus === 'BAD' ? '나쁨' : '보통'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">성명</label>
                            <Input 
                              value={worker.workerName}
                              onChange={e => updateWorkerItem(idx, 'workerName', e.target.value)}
                              readOnly={!isSupervisor}
                              className="h-10 bg-card border-border rounded-xl font-black text-xs text-center text-foreground"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">건강상태</label>
                            <select
                              value={worker.healthStatus || 'GOOD'}
                              onChange={e => updateWorkerItem(idx, 'healthStatus', e.target.value)}
                              disabled={!canEditThisRow}
                              className="w-full h-10 bg-card border border-border rounded-xl text-xs font-black px-2 text-foreground focus:ring-0 outline-none"
                            >
                              <option value="GOOD">좋음</option>
                              <option value="NORMAL">보통</option>
                              <option value="BAD">나쁨</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">작업 지시 사항</label>
                          <Input 
                            value={worker.instruction}
                            onChange={e => updateWorkerItem(idx, 'instruction', e.target.value)}
                            readOnly={!isSupervisor}
                            className="h-10 bg-card border-border rounded-xl font-bold text-xs text-foreground"
                            placeholder="작업 위치 및 내용"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">시작 시간</label>
                            <Input 
                              type="time"
                              value={worker.startTime}
                              onChange={e => updateWorkerItem(idx, 'startTime', e.target.value)}
                              readOnly={!canEditThisRow}
                              className="h-10 bg-card border-border rounded-xl font-bold text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">종료 시간</label>
                            <Input 
                              type="time"
                              value={worker.endTime}
                              onChange={e => updateWorkerItem(idx, 'endTime', e.target.value)}
                              readOnly={!canEditThisRow}
                              className="h-10 bg-card border-border rounded-xl font-bold text-xs text-primary"
                            />
                          </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted-foreground uppercase">작업 전 서명</label>
                            <div 
                              className={cn(
                                "relative h-14 bg-card border border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:bg-muted/40 transition-all overflow-hidden",
                                !canEditThisRow && "opacity-60 cursor-not-allowed"
                              )}
                              onClick={() => {
                                if (!canEditThisRow) return;
                                setActiveSignIdx({ idx, type: 'before' });
                                setIsSignOpen(true);
                              }}
                            >
                              {worker.signBeforeUrl ? (
                                 <div className="relative w-full h-full flex items-center justify-center p-1">
                                   <img src={worker.signBeforeUrl} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="sign" />
                                   <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                     <Check className="w-2 h-2" strokeWidth={4} />
                                   </div>
                                 </div>
                              ) : (
                                 <div className="flex flex-col items-center gap-0.5">
                                   <SignatureIcon className="w-3.5 h-3.5 text-muted-foreground/40" />
                                   <span className="text-[10px] font-black text-muted-foreground/60">서명하기</span>
                                 </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-primary uppercase">작업 후 서명</label>
                            <div 
                              className={cn(
                                "relative h-14 bg-card border border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:bg-muted/40 transition-all overflow-hidden",
                                !canEditThisRow && "opacity-60 cursor-not-allowed"
                              )}
                              onClick={() => {
                                if (!canEditThisRow) return;
                                setActiveSignIdx({ idx, type: 'after' });
                                setIsSignOpen(true);
                              }}
                            >
                              {worker.signAfterUrl ? (
                                 <div className="relative w-full h-full flex items-center justify-center p-1">
                                   <img src={worker.signAfterUrl} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="sign" />
                                   <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                     <Check className="w-2 h-2" strokeWidth={4} />
                                   </div>
                                 </div>
                              ) : (
                                 <div className="flex flex-col items-center gap-0.5">
                                   <SignatureIcon className="w-3.5 h-3.5 text-primary/40" />
                                   <span className="text-[10px] font-black text-primary/70">서명하기</span>
                                 </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-4 py-3 text-[11px] font-black text-muted-foreground uppercase text-center w-12">NO</th>
                        <th className="px-4 py-3 text-[11px] font-black text-muted-foreground uppercase text-center w-28">성명</th>
                        <th className="px-4 py-3 text-[11px] font-black text-muted-foreground uppercase">작업지시</th>
                        <th className="px-4 py-3 text-[11px] font-black text-muted-foreground uppercase text-center w-24">건강</th>
                        <th className="px-4 py-3 text-[11px] font-black text-muted-foreground uppercase text-center w-36">시간</th>
                        <th className="px-4 py-3 text-[11px] font-black text-muted-foreground uppercase text-center w-20">작업전</th>
                        <th className="px-4 py-3 text-[11px] font-black text-muted-foreground uppercase text-center w-20">작업후</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {workers.map((worker, idx) => {
                        const canEditThisRow = isSupervisor || worker.workerUid === profile?.uid;
                        return (
                          <tr key={idx} className={cn(
                            "hover:bg-muted/10 transition-colors",
                            worker.workerUid === profile?.uid && "bg-primary/5"
                          )}>
                            <td className="px-4 py-3 text-xs font-black text-center text-muted-foreground/50">{worker.no}</td>
                            <td className="px-4 py-3">
                              <Input 
                                value={worker.workerName}
                                onChange={e => updateWorkerItem(idx, 'workerName', e.target.value)}
                                readOnly={!isSupervisor}
                                className="h-9 bg-muted/20 border-border/50 rounded-lg font-black text-xs text-center"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                value={worker.instruction}
                                onChange={e => updateWorkerItem(idx, 'instruction', e.target.value)}
                                readOnly={!isSupervisor}
                                className="h-9 bg-muted/20 border-border/50 rounded-lg font-bold text-xs"
                                placeholder="작업 위치 및 내용"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={worker.healthStatus}
                                onChange={e => updateWorkerItem(idx, 'healthStatus', e.target.value)}
                                disabled={!canEditThisRow}
                                className="w-full h-9 bg-muted/20 border border-border/50 rounded-lg text-xs font-black px-1 focus:ring-0 outline-none"
                              >
                                <option value="GOOD">좋음</option>
                                <option value="NORMAL">보통</option>
                                <option value="BAD">나쁨</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Input 
                                  type="time"
                                  value={worker.startTime}
                                  onChange={e => updateWorkerItem(idx, 'startTime', e.target.value)}
                                  readOnly={!canEditThisRow}
                                  className="h-9 bg-muted/20 border-border/50 rounded-lg font-bold text-xs p-1"
                                />
                                <span className="text-muted-foreground/30">~</span>
                                <Input 
                                  type="time"
                                  value={worker.endTime}
                                  onChange={e => updateWorkerItem(idx, 'endTime', e.target.value)}
                                  readOnly={!canEditThisRow}
                                  className="h-9 bg-muted/20 border-border/50 rounded-lg font-bold text-xs p-1 text-primary"
                                />
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <div 
                                className={cn(
                                  "w-12 h-10 bg-muted/20 rounded-xl flex items-center justify-center cursor-pointer border border-dashed border-border/60 overflow-hidden hover:bg-muted/40 transition-all relative mx-auto",
                                  !canEditThisRow && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => {
                                  if (!canEditThisRow) return;
                                  setActiveSignIdx({ idx, type: 'before' });
                                  setIsSignOpen(true);
                                }}
                              >
                                {worker.signBeforeUrl ? (
                                  <div className="relative w-full h-full flex items-center justify-center">
                                    <img src={worker.signBeforeUrl} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="sign" />
                                    <div className="absolute bottom-0.5 right-0.5 bg-emerald-500 text-white rounded-full p-0.5">
                                      <Check className="w-1.5 h-1.5" strokeWidth={4} />
                                    </div>
                                  </div>
                                ) : (
                                  <SignatureIcon className="w-3.5 h-3.5 text-muted-foreground/30" />
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <div 
                                className={cn(
                                  "w-12 h-10 bg-muted/20 rounded-xl flex items-center justify-center cursor-pointer border border-dashed border-border/60 overflow-hidden hover:bg-muted/40 transition-all relative mx-auto",
                                  !canEditThisRow && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => {
                                  if (!canEditThisRow) return;
                                  setActiveSignIdx({ idx, type: 'after' });
                                  setIsSignOpen(true);
                                }}
                              >
                                {worker.signAfterUrl ? (
                                  <div className="relative w-full h-full flex items-center justify-center">
                                    <img src={worker.signAfterUrl} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="sign" />
                                    <div className="absolute bottom-0.5 right-0.5 bg-emerald-500 text-white rounded-full p-0.5">
                                      <Check className="w-1.5 h-1.5" strokeWidth={4} />
                                    </div>
                                  </div>
                                ) : (
                                  <SignatureIcon className="w-3.5 h-3.5 text-primary/30" />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1 h-14 rounded-2xl font-black text-sm border-border"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> 이전: 기본 정보
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex-[2] h-14 bg-primary text-white font-black text-base rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary/95 flex items-center justify-center gap-2"
              >
                다음: 일일 안전 점검 <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: 일일 안전 점검 */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
              <CardHeader className="bg-muted/40 border-b border-border p-4 sm:p-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                    <ShieldCheck className="w-4 h-4 text-primary" /> 3단계: 일일 안전 점검 (체크리스트)
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground font-bold mt-0.5">
                    각 항목별 점검 결과(O: 양호 / X: 불량 / N/A: 비해당)를 선택해 주세요.
                  </p>
                </div>
                {isSupervisor && formData.status !== 'APPROVED' && (
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCheckAllSafety('O')}
                    className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 font-black rounded-xl text-xs h-9 px-3 gap-1.5"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> 전체 'O(양호)'
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {formData.safetyChecks?.map((cat, catIdx) => (
                  <div key={catIdx} className="border-b border-border last:border-0">
                    <div className="bg-muted/30 px-5 py-2.5 flex items-center justify-between">
                      <h4 className="text-xs font-black text-primary tracking-wide">{cat.category}</h4>
                      <span className="text-[10px] font-bold text-muted-foreground">{cat.items.length}개 항목</span>
                    </div>
                    <div className="divide-y divide-border">
                      {cat.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-2.5 pr-2">
                            <span className="text-xs font-black text-muted-foreground/40 shrink-0 w-5">{itemIdx + 1}</span>
                            <p className="text-xs sm:text-sm font-bold text-foreground leading-snug">{item.text}</p>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            {['O', 'X', 'N/A'].map(res => (
                              <button
                                key={res}
                                type="button"
                                disabled={(!isSupervisor && formData.status !== 'APPROVED') || formData.status === 'APPROVED'}
                                onClick={() => updateSafetyCheck(catIdx, itemIdx, res as any)}
                                className={cn(
                                  "w-10 sm:w-12 h-10 rounded-xl text-xs font-black transition-all border",
                                  item.result === res 
                                    ? res === 'O' 
                                      ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/25 scale-105"
                                      : res === 'X'
                                      ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/25 scale-105"
                                      : "bg-slate-500 border-slate-500 text-white shadow-md shadow-slate-500/25 scale-105"
                                    : "bg-muted/40 border-border text-muted-foreground/50 hover:bg-muted",
                                  (!isSupervisor || formData.status === 'APPROVED') && "cursor-not-allowed opacity-80"
                                )}
                              >
                                {res}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="flex-1 h-14 rounded-2xl font-black text-sm border-border"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> 이전: 작업 지시
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="flex-[2] h-14 bg-primary text-white font-black text-base rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary/95 flex items-center justify-center gap-2"
              >
                다음: 위험요인 대책 및 제출 <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 4: 위험성 평가 & 최종 제출 */}
        {currentStep === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Hazards Table */}
            <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
              <CardHeader className="bg-muted/40 border-b border-border p-4 sm:p-5">
                <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                  <AlertCircle className="w-4 h-4 text-primary" /> 4단계: 위험요소 및 안전작업방법
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[550px]">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-border border-b w-10">NO</th>
                      <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase border-border border-b w-1/3">위험요인</th>
                      <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase border-border border-b">안전작업방법</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {formData.hazardAssessments?.map((hazard, idx) => (
                      <tr key={idx} className="hover:bg-muted/5">
                        <td className="px-4 py-3 text-xs font-bold text-center text-muted-foreground">{hazard.no}</td>
                        <td className="px-4 py-3 text-xs font-black text-foreground">{hazard.hazardFactor}</td>
                        <td className="px-4 py-3">
                          <Input 
                            value={hazard.safetyMethod}
                            onChange={e => {
                              const newHazards = [...(formData.hazardAssessments || [])];
                              newHazards[idx].safetyMethod = e.target.value;
                              handleUpdate({ hazardAssessments: newHazards });
                            }}
                            readOnly={!isSupervisor || formData.status === 'APPROVED'}
                            placeholder="안전작업방법 입력"
                            className="h-10 bg-muted/20 border border-border/40 rounded-xl font-bold text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Submission Checklist Summary */}
            <Card className="bg-muted/20 border-border rounded-3xl p-5 shadow-md">
              <h3 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 최종 제출 전 현황 점검
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-card border border-border rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">팀장 서명</span>
                  <p className={cn("text-xs font-black", formData.supervisorSignUrl ? "text-emerald-500" : "text-amber-500")}>
                    {formData.supervisorSignUrl ? '서명 완료' : '미서명'}
                  </p>
                </div>
                <div className="p-3 bg-card border border-border rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">소장 서명</span>
                  <p className={cn("text-xs font-black", formData.safetyManagerSignUrl ? "text-emerald-500" : "text-muted-foreground")}>
                    {formData.safetyManagerSignUrl ? '서명 완료' : '대기중'}
                  </p>
                </div>
                <div className="p-3 bg-card border border-border rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">작업전 서명</span>
                  <p className="text-xs font-black text-primary">
                    {signedBeforeCount} / {workers.length}명
                  </p>
                </div>
                <div className="p-3 bg-card border border-border rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">작업후 서명</span>
                  <p className="text-xs font-black text-primary">
                    {signedAfterCount} / {workers.length}명
                  </p>
                </div>
              </div>
            </Card>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1 h-16 rounded-2xl font-black text-base border-border"
                onClick={() => setCurrentStep(3)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> 이전: 안전 점검
              </Button>
              {isSupervisor && formData.status === 'PENDING' ? (
                <Button 
                  className="flex-[2] h-16 rounded-2xl font-black text-base bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/25"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                >
                  {submitting ? '제출 중...' : (
                    <span className="flex items-center gap-2">
                      <Send className="w-5 h-5" /> 보고서 최종 제출
                    </span>
                  )}
                </Button>
              ) : (
                <Button 
                  className="flex-[2] h-16 rounded-2xl font-black text-base bg-muted text-foreground border border-border hover:bg-muted/80"
                  onClick={() => navigate(-1)}
                >
                  목록으로 돌아가기
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Signature Dialog */}
      <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-[2.5rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center pt-2">서명해 주세요</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center gap-4">
            <div className="w-64 h-48 bg-white rounded-2xl border-2 border-border overflow-hidden touch-none shadow-inner">
               <SignatureCanvas 
                  ref={sigPad}
                  canvasProps={{
                    className: 'w-full h-full cursor-crosshair'
                  }}
                  backgroundColor="white"
                  penColor="black"
               />
            </div>
            <div className="flex gap-2 w-full">
               <Button 
                 variant="outline" 
                 className="flex-1 rounded-xl font-bold h-11"
                 onClick={() => sigPad.current?.clear()}
               >
                 초기화
               </Button>
               <Button 
                 className="flex-1 rounded-xl font-black h-11 bg-primary text-white"
                 onClick={handleSignSave}
               >
                 서명 저장
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

