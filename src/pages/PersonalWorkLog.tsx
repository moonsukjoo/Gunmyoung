import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ClipboardList, 
  Clock, 
  Save, 
  ChevronLeft, 
  ChevronRight,
  Plus, 
  Trash2, 
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Signature as SignatureIcon,
  Check,
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { IndividualWorkLog } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/errorHandlers';
import SignatureCanvas from 'react-signature-canvas';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const STEPS = [
  { id: 1, title: '근무 시간', desc: '일자 및 퇴근시간' },
  { id: 2, title: '작업 내용', desc: '수행 업무 및 시간' },
  { id: 3, title: '서명 및 제출', desc: '검토 후 본인 서명' }
];

const TIME_PRESETS = ['17:00', '18:00', '19:00', '20:00', '21:00'];

export const PersonalWorkLog: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tasks, setTasks] = useState<{ content: string; hours: string }[]>([{ content: '', hours: '' }]);
  const [clockOutTime, setClockOutTime] = useState('18:00');
  const [recentLogs, setRecentLogs] = useState<IndividualWorkLog[]>([]);
  
  const [workerSignUrl, setWorkerSignUrl] = useState('');
  const [isSignOpen, setIsSignOpen] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);
  const [justSigned, setJustSigned] = useState(false);

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

  const handleCopyPreviousLog = () => {
    if (recentLogs.length > 0) {
      const lastLog = recentLogs[0];
      setTasks(lastLog.tasks.map(t => ({ ...t })));
      setClockOutTime(lastLog.clockOutTime);
      toast.success('전일 작업 내용을 불러왔습니다.');
    } else {
      toast.error('이전 기록이 없습니다.');
    }
  };

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'personalWorkLogs'),
      where('uid', '==', profile.uid),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as IndividualWorkLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personalWorkLogs'));

    return () => unsubscribe();
  }, [profile]);

  const handleAddTask = () => {
    if (tasks.length < 5) {
      setTasks([...tasks, { content: '', hours: '' }]);
    } else {
      toast.error('작업 항목은 최대 5개까지 가능합니다.');
    }
  };

  const handleRemoveTask = (idx: number) => {
    if (tasks.length === 1) {
      setTasks([{ content: '', hours: '' }]);
      return;
    }
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const updateTask = (idx: number, field: 'content' | 'hours', value: string) => {
    const newTasks = [...tasks];
    newTasks[idx][field] = value;
    setTasks(newTasks);
  };

  const handleSignSave = () => {
    if (sigPad.current) {
      if (sigPad.current.isEmpty()) {
        toast.error('서명을 작성해주세요.');
        return;
      }
      const dataUrl = sigPad.current.toDataURL();
      setWorkerSignUrl(dataUrl);

      setJustSigned(true);
      setTimeout(() => {
        setJustSigned(false);
      }, 3000);

      setIsSignOpen(false);
      toast.success('서명이 등록되었습니다!');
    }
  };

  const totalCalculatedHours = tasks.reduce((sum, t) => {
    const num = parseFloat(t.hours);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const validateAndNext = () => {
    if (currentStep === 1) {
      if (!logDate) {
        toast.error('작업 일자를 선택해주세요.');
        return;
      }
      if (!clockOutTime) {
        toast.error('퇴근 시간을 입력해주세요.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const validTasks = tasks.filter(t => t.content.trim() && t.hours.trim());
      if (validTasks.length === 0) {
        toast.error('최소 1개 이상의 작업 내용과 시간을 입력해주세요.');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) return;

    const validTasks = tasks.filter(t => t.content.trim() && t.hours.trim());
    if (validTasks.length === 0) {
      toast.error('최소 하나 이상의 작업 내용을 입력해주세요.');
      setCurrentStep(2);
      return;
    }

    if (!workerSignUrl) {
      toast.error('본인 확인 서명을 완료해주세요.');
      setIsSignOpen(true);
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'personalWorkLogs'), {
        uid: profile.uid,
        userName: profile.displayName,
        departmentId: profile.departmentId || '',
        departmentName: profile.departmentName || '',
        date: logDate,
        clockOutTime,
        tasks: validTasks,
        workerSignUrl,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });
      
      toast.success('작업일지가 제출되었습니다. 팀장님 결재 대기 중입니다.');
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error('제출 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-2 sm:px-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-2xl h-11 w-11 bg-muted/40 hover:bg-muted">
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">나의 작업일지 작성</h1>
            <p className="text-xs text-muted-foreground font-bold">{profile?.departmentName || '소속'} · {profile?.displayName}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCopyPreviousLog}
          className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 font-black gap-1.5 rounded-2xl text-xs h-10 px-3.5 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          전일 복사
        </Button>
      </div>

      {/* Step Indicator Bar */}
      <div className="bg-card border border-border/70 rounded-3xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-3 px-1">
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id);
                  else if (step.id === 2 && logDate && clockOutTime) setCurrentStep(2);
                }}
                className={cn(
                  "flex items-center gap-2 group text-left transition-all",
                  isActive ? "opacity-100" : isCompleted ? "opacity-90" : "opacity-40"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-all shadow-sm",
                  isActive 
                    ? "bg-primary text-white scale-110 shadow-primary/30" 
                    : isCompleted 
                    ? "bg-emerald-500 text-white" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : step.id}
                </div>
                <div className="hidden sm:block">
                  <p className={cn("text-xs font-black", isActive ? "text-primary" : "text-foreground")}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">{step.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress bar line */}
        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Step Contents */}
      <AnimatePresence mode="wait">
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
                  <Calendar className="w-4 h-4 text-primary" /> 1단계: 근무 일자 및 퇴근 시간
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Date Input */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> 작업 일자
                  </label>
                  <Input 
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="bg-muted/50 border-border rounded-2xl h-14 font-black text-base text-foreground px-4 focus:bg-card transition-all"
                  />
                </div>

                {/* Time Input & Presets */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" /> 퇴근 시간
                    </label>
                    <span className="text-[11px] text-muted-foreground font-bold">빠른 선택 가능</span>
                  </div>
                  <Input 
                    type="time"
                    value={clockOutTime}
                    onChange={(e) => setClockOutTime(e.target.value)}
                    className="bg-muted/50 border-border rounded-2xl h-14 font-black text-lg text-primary px-4 focus:bg-card transition-all"
                  />
                  
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {TIME_PRESETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setClockOutTime(t)}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-black transition-all border",
                          clockOutTime === t 
                            ? "bg-primary text-white border-primary shadow-sm shadow-primary/20" 
                            : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 font-medium leading-relaxed">
                    근무 일자와 퇴근 시간을 선택한 후 <strong>'다음 단계'</strong>를 눌러 오늘 진행한 세부 작업을 입력해 주세요.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              type="button"
              onClick={validateAndNext}
              className="w-full h-14 bg-primary text-white font-black text-base rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary/95 flex items-center justify-center gap-2"
            >
              다음: 작업 내용 입력 <ChevronRight className="w-5 h-5" />
            </Button>
          </motion.div>
        )}

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
              <CardHeader className="bg-muted/40 border-b border-border p-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                    <ClipboardList className="w-4 h-4 text-primary" /> 2단계: 오늘 수행한 작업 내용
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground font-bold mt-0.5">
                    작업 항목별 내용과 소요 시간을 입력해주세요.
                  </p>
                </div>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-xs font-black">
                  총 {totalCalculatedHours}시간
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="space-y-3">
                  {tasks.map((task, idx) => (
                    <div key={idx} className="p-3.5 bg-muted/40 border border-border/80 rounded-2xl space-y-2 transition-all focus-within:border-primary/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-primary uppercase tracking-wider">
                          항목 {idx + 1}
                        </span>
                        {tasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTask(idx)}
                            className="text-muted-foreground/50 hover:text-rose-500 p-1 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input 
                            placeholder="예: 102블록 하부 용접 및 그라인딩 작업"
                            value={task.content}
                            onChange={(e) => updateTask(idx, 'content', e.target.value)}
                            className="bg-card border-border rounded-xl text-sm font-bold text-foreground h-12"
                          />
                        </div>
                        <div className="w-24 relative">
                          <Input 
                            placeholder="시간"
                            type="number"
                            step="0.5"
                            value={task.hours}
                            onChange={(e) => updateTask(idx, 'hours', e.target.value)}
                            className="bg-card border-border rounded-xl text-center font-black pr-6 text-foreground h-12"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">시간</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddTask}
                  disabled={tasks.length >= 5}
                  className="w-full h-12 border-dashed border-primary/30 text-primary hover:bg-primary/5 rounded-2xl font-black text-xs gap-1.5"
                >
                  <Plus className="w-4 h-4" /> 추가 항목 입력 ({tasks.length}/5)
                </Button>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1 h-14 rounded-2xl font-black text-sm border-border"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> 이전
              </Button>
              <Button
                type="button"
                onClick={validateAndNext}
                className="flex-[2] h-14 bg-primary text-white font-black text-base rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary/95 flex items-center justify-center gap-2"
              >
                다음: 서명 및 최종 확인 <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Summary Review Card */}
            <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
              <CardHeader className="bg-muted/40 border-b border-border p-5">
                <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 3단계: 작성 내용 검토 & 본인 서명
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Summary Box */}
                <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-xs text-muted-foreground font-bold">작업 일자 및 퇴근</span>
                    <span className="text-sm font-black text-foreground">{logDate} ({clockOutTime} 퇴근)</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground font-bold">수행 작업 목록</span>
                      <span className="text-xs font-black text-primary">총 {totalCalculatedHours}시간</span>
                    </div>
                    {tasks.filter(t => t.content).map((t, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-card/60 p-2.5 rounded-xl border border-border/50">
                        <span className="font-bold text-foreground truncate max-w-[240px]">
                          {idx + 1}. {t.content}
                        </span>
                        <span className="font-black text-primary shrink-0 ml-2">{t.hours}시간</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Digital Signature section */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <SignatureIcon className="w-4 h-4 text-primary" /> 본인 자필 서명
                  </label>
                  <div 
                    id="worker-signature-trigger-box"
                    className={cn(
                      "relative h-28 bg-muted/20 border-2 border-dashed border-border rounded-2xl flex items-center justify-center cursor-pointer hover:bg-muted/40 transition-all overflow-hidden",
                      workerSignUrl && "border-emerald-500/50 bg-emerald-500/5"
                    )}
                    onClick={() => setIsSignOpen(true)}
                  >
                    {workerSignUrl ? (
                       <div className="relative w-full h-full flex items-center justify-center">
                         <img src={workerSignUrl} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="worker-signature" />
                         <div className="absolute bottom-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md shadow-emerald-500/30">
                           <Check className="w-3.5 h-3.5" strokeWidth={4} />
                         </div>

                         <AnimatePresence>
                           {justSigned && (
                             <motion.div 
                               initial={{ opacity: 0, scale: 0.6 }}
                               animate={{ opacity: 1, scale: 1 }}
                               exit={{ opacity: 0, scale: 0.8 }}
                               className="absolute inset-0 bg-emerald-500/95 flex flex-col items-center justify-center rounded-2xl z-10 pointer-events-none text-white"
                               transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                             >
                               <Check className="w-8 h-8 text-white" strokeWidth={4} />
                               <span className="font-black tracking-widest text-white/95 uppercase mt-1 text-sm">서명 등록 완료</span>
                             </motion.div>
                           )}
                         </AnimatePresence>
                       </div>
                    ) : (
                       <div className="flex flex-col items-center justify-center gap-1.5 select-none">
                         <SignatureIcon className="w-7 h-7 text-primary/40 animate-bounce" />
                         <span className="text-xs font-black text-primary">여기를 터치하여 본인 서명을 등록하세요</span>
                       </div>
                    )}
                  </div>
                </div>

                <div className="bg-muted rounded-2xl p-4 border border-border flex gap-3">
                  <AlertCircle className="w-5 h-5 text-primary/60 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                    제출된 작업일지는 소속 직장 및 팀장님께 전자 결재 요청되며 승인 후 최종 확정됩니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="flex-1 h-14 rounded-2xl font-black text-sm border-border"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> 이전
              </Button>
              <Button 
                type="button" 
                onClick={() => handleSubmit()}
                disabled={loading}
                className="flex-[2] h-14 bg-primary text-white font-black text-base rounded-2xl shadow-xl shadow-primary/25 active:scale-95 transition-all gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                작업일지 최종 제출
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent History */}
      <div className="space-y-4 pt-6 border-t border-border">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-4 h-4" />
          최근 제출 내역 (최근 5건)
        </h3>
        <div className="space-y-3">
          {recentLogs.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border rounded-3xl">
              <p className="text-muted-foreground/40 text-xs font-bold">최근 제출 기록이 없습니다.</p>
            </div>
          ) : (
            recentLogs.map(log => (
              <div key={log.id} className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-foreground">{log.date}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/60">{log.clockOutTime} 퇴근</span>
                  </div>
                  <div className="flex gap-2">
                    {log.tasks.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md truncate max-w-[120px]">
                        {t.content}
                      </span>
                    ))}
                    {log.tasks.length > 2 && <span className="text-[10px] text-muted-foreground/30">...</span>}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black border ${
                  log.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/10' :
                  log.status === 'LEADER_APPROVED' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                  log.status === 'FINAL_APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  {log.status === 'PENDING' ? '대기중' : 
                   log.status === 'LEADER_APPROVED' ? '팀장확인' : 
                   log.status === 'FINAL_APPROVED' ? '최종승인' : '반려'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Signature Dialog */}
      <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
        <DialogContent className="bg-card border border-border text-foreground max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <SignatureIcon className="w-5 h-5 text-primary" /> 업무 본인 서명
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-xs text-muted-foreground font-bold leading-normal">
              아래 서명 영역에 손가락 또는 마우스로 자필 서명을 작성해 주세요.
            </p>
            <div className="border border-border/80 rounded-2xl overflow-hidden bg-white">
              <SignatureCanvas
                ref={sigPad}
                penColor="black"
                canvasProps={{
                  className: "w-full h-44 cursor-crosshair bg-white"
                }}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 p-0">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                if (sigPad.current) {
                  sigPad.current.clear();
                }
              }} 
              className="rounded-xl font-bold bg-muted"
            >
              초기화
            </Button>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsSignOpen(false)} 
                className="rounded-xl font-bold"
              >
                취소
              </Button>
              <Button 
                type="button" 
                onClick={handleSignSave} 
                className="bg-primary hover:bg-primary/95 text-white font-black rounded-xl px-4"
              >
                서명 완료
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

