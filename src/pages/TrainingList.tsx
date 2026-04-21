import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { Training, TrainingResult, QuizQuestion } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  BookOpen, 
  CheckCircle2, 
  PlayCircle, 
  HelpCircle,
  Trophy,
  AlertCircle,
  Clock,
  FileText,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export const TrainingList: React.FC = () => {
  const { profile } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [isExamMode, setIsExamMode] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, number>>({});
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [lastResult, setLastResult] = useState<TrainingResult | null>(null);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!profile) return;

    const unsubscribeT = onSnapshot(collection(db, 'trainings'), (snap) => {
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Training));
      const filtered = all.filter(t => 
        (t.status === 'PUBLISHED' || !t.status) && 
        (!t.targetJobRole || t.targetJobRole === profile.jobRole || t.targetJobRole === 'ALL')
      );
      setTrainings(filtered);
    });

    const qResults = query(collection(db, 'trainingResults'), where('uid', '==', profile.uid));
    const unsubscribeR = onSnapshot(qResults, (snap) => {
      setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    });

    return () => {
      unsubscribeT();
      unsubscribeR();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [profile]);

  useEffect(() => {
    if (isExamMode && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleSubmitExam(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamMode, timeLeft]);

  const handleStartExam = (trainingOverride?: Training) => {
    const target = trainingOverride || selectedTraining;
    if (!target || !target.questions || target.questions.length === 0) {
      toast.error('등록된 시험 문제가 없습니다. 관리자에게 문의하세요.');
      return;
    }
    
    let pool = [...target.questions];
    const subsetCount = target.questionsPerExam || pool.length;
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, subsetCount);
    
    setActiveQuestions(selected);
    setCurrentAnswers({});
    setTimeLeft((target.timeLimit || 15) * 60);
    setIsExamMode(true);
  };

  const handleSubmitExam = async (isAuto = false) => {
    if (!selectedTraining || !profile || activeQuestions.length === 0) return;
    
    if (!isAuto && Object.keys(currentAnswers).length < activeQuestions.length) {
      toast.error('모든 문항을 제출해주세요.');
      return;
    }

    if (isAuto) {
      toast.warning('제한 시간이 종료되어 시험이 자동 제출되었습니다.');
    }

    let score = 0;
    activeQuestions.forEach((q) => {
      if (currentAnswers[q.id] === q.correctAnswer) {
        score++;
      }
    });

    const isPassed = score / activeQuestions.length >= 0.7;

    const resultData: Omit<TrainingResult, 'id'> = {
      trainingId: selectedTraining.id,
      trainingTitle: selectedTraining.title,
      uid: profile.uid,
      userName: profile.displayName,
      score,
      totalQuestions: activeQuestions.length,
      isPassed,
      completedAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'trainingResults'), resultData);
      setLastResult({ id: docRef.id, ...resultData });
      setIsExamMode(false);
      setSelectedTraining(null);
      setIsResultOpen(true);
      toast.success(isPassed ? '시험 합격!' : '시험 불합격. 재응시가 필요합니다.');
    } catch (error) {
      toast.error('결과 저장 중 오류가 발생했습니다.');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getResultForTraining = (trainingId: string) => {
    return results.find(r => r.trainingId === trainingId);
  };

  return (
    <div className="space-y-6 pb-24 px-1 sm:px-0">
      <header className="flex flex-col gap-1 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-emerald-500 rounded-full shrink-0" />
          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 leading-none">직무 교육 서비스</h2>
        </div>
        <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          {profile?.displayName}님을 위한 <span className="text-emerald-600">{profile?.jobRole || '공통'}</span> 안전 교육
        </p>
      </header>

      <div className="grid gap-4 sm:gap-6 px-4 sm:px-6">
        {trainings.map(t => {
          const result = getResultForTraining(t.id);
          return (
            <Card key={t.id} className={cn(
              "border-none shadow-md bg-white rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden transition-all border border-slate-100/50",
              result?.isPassed && "bg-emerald-50/20 border-emerald-100/50"
            )}>
              <CardContent className="p-0">
                <div className="p-5 sm:p-6 flex items-start justify-between gap-4">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "font-black text-[8px] sm:text-[9px] px-2 py-0.5 rounded uppercase tracking-wider border-none",
                        result?.isPassed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                      )}>
                        {result ? (result.isPassed ? '이수 완료' : '재시험 대상') : '미이수'}
                      </Badge>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none shrink-0">Knowledge Base</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black tracking-tighter text-slate-900 leading-tight truncate">{t.title}</h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-bold line-clamp-2 leading-relaxed">{t.description}</p>
                  </div>
                  <div className={cn(
                    "w-10 h-10 sm:w-12 h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                    result?.isPassed ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-slate-400"
                  )}>
                    {result?.isPassed ? <Trophy className="w-5 h-5 sm:w-6 h-6" /> : <BookOpen className="w-5 h-5 sm:w-6 h-6" />}
                  </div>
                </div>
                
                <div className="px-5 sm:px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[10px] font-black text-slate-500">{t.questionsPerExam || t.questions?.length || 0}문항</span>
                    </div>
                    <div className="w-px h-3 bg-slate-200" />
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[10px] font-black text-slate-500">{t.timeLimit || 15}분</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => { setSelectedTraining(t); handleStartExam(t); }}
                      className="flex-1 sm:flex-none h-10 px-3 rounded-lg font-black text-[10px] border-slate-200 text-slate-500 hover:text-emerald-600 transition-all active:scale-95"
                    >
                      평가 응시
                    </Button>
                    <Button 
                      onClick={() => setSelectedTraining(t)}
                      className={cn(
                        "flex-1 sm:flex-none h-10 px-6 rounded-lg font-black text-[10px] transition-all active:scale-95 shadow-sm",
                        result?.isPassed ? "bg-slate-100 text-slate-400 border-none" : "bg-slate-900 text-white"
                      )}
                    >
                      {result?.isPassed ? '학습 복습' : '교육 시작'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {trainings.length === 0 && (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
            <Star className="w-12 h-12 text-slate-300" />
            <p className="font-black text-sm text-slate-400">현재 이용 가능한 교육이 없습니다.</p>
          </div>
        )}
      </div>

      {/* Training Content View */}
      <Dialog open={!!selectedTraining && !isExamMode} onOpenChange={(open) => !open && setSelectedTraining(null)}>
        <DialogContent className="bg-white border-none rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl max-w-2xl w-[95%] p-0 overflow-hidden flex flex-col max-h-[90vh]">
          {selectedTraining && (
            <>
              <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-6 bg-slate-50 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500 text-white border-none text-[9px] px-2 font-black tracking-widest">CONTENT</Badge>
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900 leading-tight">
                  {selectedTraining.title}
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs text-slate-500 font-bold mt-1">
                  충분히 학습한 후 시험에 응시해 주세요. (합격: 70% 이상)
                </DialogDescription>
              </DialogHeader>
              <div className="p-6 sm:p-8 overflow-y-auto no-scrollbar flex-1 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-5 sm:p-6 border border-slate-100">
                  <div className="markdown-body font-bold text-slate-700 leading-relaxed text-xs sm:text-sm">
                    <ReactMarkdown>{selectedTraining.content}</ReactMarkdown>
                  </div>
                </div>
                {selectedTraining.videoUrl && (
                  <div className="p-5 bg-slate-900 rounded-2xl flex items-center justify-between group cursor-pointer overflow-hidden relative" onClick={() => window.open(selectedTraining.videoUrl, '_blank')}>
                    <div className="relative z-10">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">Video Resource</p>
                      <h4 className="text-white font-black text-sm">시청각 자료 열기</h4>
                    </div>
                    <PlayCircle className="w-8 h-8 text-white relative z-10" />
                  </div>
                )}
                {selectedTraining.fileUrl && (
                  <div className="p-5 bg-slate-900 rounded-2xl flex items-center justify-between group cursor-pointer overflow-hidden relative border border-white/5" onClick={() => window.open(selectedTraining.fileUrl, '_blank')}>
                    <div className="relative z-10">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-0.5">Document Resource</p>
                      <h4 className="text-white font-black text-sm">교육 자료 다운로드</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate max-w-[200px]">{selectedTraining.fileName || '교안 자료'}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 relative z-10">
                      <FileText className="w-6 h-6" />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="p-6 sm:p-8 pt-4 sm:pt-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
                <Button variant="ghost" className="h-12 sm:h-14 rounded-xl font-black text-slate-400 text-xs" onClick={() => setSelectedTraining(null)}>나중에</Button>
                <Button className="h-12 sm:h-14 rounded-xl bg-slate-900 text-white font-black text-sm flex-1 active:scale-95 shadow-md" onClick={() => handleStartExam()}>
                  시험 응시하기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Exam Mode View */}
      <Dialog open={isExamMode} onOpenChange={(open) => !open && setIsExamMode(false)}>
        <DialogContent className="bg-white border-none rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl max-w-2xl w-[95%] p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="outline" className="border-white/30 text-white font-black text-[9px] px-2 tracking-widest bg-white/10 uppercase mb-2">Exam Session</Badge>
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tighter leading-tight">실습 역량 평가</DialogTitle>
                <p className="text-white/40 font-bold text-[10px] uppercase tracking-widest mt-0.5">Total {activeQuestions.length} Questions</p>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/20 shrink-0">
                <Clock className={cn("w-4 h-4", timeLeft < 60 ? "text-red-400 animate-pulse" : "text-emerald-400")} />
                <span className={cn("text-xl font-black tabular-nums", timeLeft < 60 ? "text-red-400" : "text-white")}>{formatTime(timeLeft)}</span>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 sm:p-8 space-y-8 overflow-y-auto no-scrollbar bg-slate-50/30 flex-1">
            {activeQuestions.map((q, idx) => (
              <div key={q.id} className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                    <span className="font-black text-white text-sm">{idx + 1}</span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black tracking-tight text-slate-800 leading-snug pt-0.5">{q.question}</h4>
                </div>
                <div className="grid gap-2 ml-11">
                  {q.options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      className={cn(
                        "group flex items-center justify-between p-4 rounded-xl border transition-all font-bold text-xs text-left",
                        currentAnswers[q.id] === oIdx 
                          ? "bg-white border-emerald-500 text-emerald-600 shadow-md ring-2 ring-emerald-50" 
                          : "bg-white border-slate-100 hover:border-slate-200 text-slate-500"
                      )}
                      onClick={() => setCurrentAnswers({...currentAnswers, [q.id]: oIdx})}
                    >
                      <span className="flex-1 pr-3">{opt}</span>
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                        currentAnswers[q.id] === oIdx ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 text-transparent"
                      )}>
                         <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="p-6 sm:p-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
            <Button variant="ghost" className="h-12 rounded-xl font-black text-slate-400 text-xs" onClick={() => setIsExamMode(false)}>학습으로</Button>
            <Button className="h-12 rounded-xl bg-slate-900 text-white font-black flex-1 active:scale-95 shadow-md" onClick={() => handleSubmitExam()}>제출 완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Report Dialog */}
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="bg-white border-none rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl max-w-sm w-[95%] p-0 overflow-hidden text-center">
          {lastResult && (
            <div className="p-8 sm:p-10 space-y-6">
              <div className={cn(
                "w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg",
                lastResult.isPassed ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
              )}>
                {lastResult.isPassed ? <Trophy className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
              </div>
              <div className="space-y-1">
                <Badge variant="outline" className={cn(
                   "font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-lg border-2",
                   lastResult.isPassed ? "border-emerald-100 text-emerald-600 bg-emerald-50" : "border-red-100 text-red-600 bg-red-50"
                )}>
                  {lastResult.isPassed ? 'Exam Passed' : 'Exam Failed'}
                </Badge>
                <h3 className="text-2xl font-black tracking-tighter text-slate-900">평가 결과 리포트</h3>
                <p className="text-slate-400 font-bold text-[10px] truncate">{lastResult.trainingTitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Score</p>
                  <p className="text-lg font-black text-slate-900">{lastResult.score} / {lastResult.totalQuestions}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Rate</p>
                  <p className={cn("text-lg font-black", lastResult.isPassed ? "text-emerald-600" : "text-red-500")}>
                    {Math.round((lastResult.score / lastResult.totalQuestions) * 100)}%
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsResultOpen(false)} className={cn("w-full h-14 rounded-xl font-black shadow-lg", lastResult.isPassed ? "bg-slate-900 text-white" : "bg-red-500 text-white")}>
                {lastResult.isPassed ? '메뉴로 돌아가기' : '다시 학습하기'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
