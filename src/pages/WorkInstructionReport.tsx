import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
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
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Signature as SignatureIcon,
  Save,
  Send
} from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  
  // Signature Dialog State
  const [isSignOpen, setIsSignOpen] = useState(false);
  const [activeSignIdx, setActiveSignIdx] = useState<{ idx: number, type: 'before' | 'after' } | null>(null);
  const sigPad = useRef<SignatureCanvas>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<WorkInstructionReport>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    dayOfWeek: format(new Date(), 'EEEE', { locale: ko }),
    supervisorName: '',
    safetyManagerName: '김주영',
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

  const isSupervisor = profile?.role === 'TEAM_LEADER' || ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER'].includes(profile?.role || '');

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
      
      // Find a pending one first
      const pendingReport = reports.find(r => r.status === 'PENDING');
      
      if (pendingReport) {
        setReportId(pendingReport.id);
        setFormData(pendingReport);
      } else if (reports.length > 0) {
        // If all are APPROVED, we show the latest one but will provide a button to start new
        const latest = reports[0]; // ordered by date/time ideally
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
      // Find all workers in the department to initialize the list
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
        safetyManagerName: '김주영',
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

  const handleSignSave = () => {
    if (sigPad.current && activeSignIdx) {
      if (sigPad.current.isEmpty()) {
        toast.error('서명을 작성해주세요.');
        return;
      }
      const dataUrl = sigPad.current.toDataURL();
      const newInstructions = [...(formData.workerInstructions || [])];
      
      // Authorization check: Only self can sign if not supervisor
      const targetWorker = newInstructions[activeSignIdx.idx];
      if (!isSupervisor && targetWorker.workerUid !== profile?.uid) {
        toast.error('본인의 서명만 가능합니다.');
        return;
      }

      if (activeSignIdx.type === 'before') {
        newInstructions[activeSignIdx.idx].signBeforeUrl = dataUrl;
      } else {
        newInstructions[activeSignIdx.idx].signAfterUrl = dataUrl;
      }
      handleUpdate({ workerInstructions: newInstructions });
      setIsSignOpen(false);
      setActiveSignIdx(null);
    }
  };

  const handleFinalSubmit = async () => {
    if (!reportId || !profile) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'workInstructionReports', reportId), {
        status: 'APPROVED' // Or 'SUBMITTED'
      });

      // Notify Administrative Assistants (서무) and Heads (실장) in the department
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
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workInstructionReports');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Badge variant="outline" className="animate-pulse">데이터 동기화 중...</Badge>
      </div>
    );
  }

  if (!reportId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 space-y-6 text-center">
        <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center text-muted-foreground/30">
          <ClipboardList className="w-10 h-10" />
        </div>
        {!profile?.departmentId ? (
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-rose-500">소속 팀 정보 없음</h2>
            <p className="text-muted-foreground font-bold italic">현재 소속된 팀이 지정되지 않았습니다.<br/>관리자에게 팀 배정을 요청해 주세요.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-black">오늘의 일지가 없습니다</h2>
              <p className="text-muted-foreground font-bold italic">팀장님께서 아직 오늘의 작업지시서를<br/>생성하지 않았습니다.</p>
            </div>
            {isSupervisor && (
              <Button 
                onClick={handleCreateReport} 
                disabled={submitting}
                className="h-16 px-8 rounded-2xl font-black text-lg gap-2"
              >
                {submitting ? '생성 중...' : '오늘의 일지 생성하기'}
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" onClick={() => navigate(-1)} className="font-bold">뒤로 가기</Button>
      </div>
    );
  }

  const myWorkerIdx = formData.workerInstructions?.findIndex(w => w.workerUid === profile?.uid);

  return (
    <div className="space-y-6 pb-24 px-1 max-w-4xl mx-auto">
      <header className="py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight">작업지시 및 일일안전 점검일지</h2>
            <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest">{formData.date} ({formData.dayOfWeek}) - {formData.teamName}</p>
          </div>
        </div>
        {formData.status === 'APPROVED' && (
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-500 border-none font-black px-3 h-8 rounded-lg">제출 완료</Badge>
            {isSupervisor && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCreateReport}
                className="h-8 rounded-lg font-black text-[10px] gap-1 border-primary/20 text-primary"
              >
                <Plus className="w-3 h-3" /> 새 일지 작성
              </Button>
            )}
          </div>
        )}
      </header>

      {/* 1. Basic Info */}
      <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
        <CardHeader className="bg-muted/50 border-b border-border p-4 md:p-6">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> 기본 정보 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">관리감독자 (팀장)</label>
                <div className="w-1 h-1 bg-primary rounded-full" />
              </div>
              <Input 
                value={formData.supervisorName}
                onChange={e => handleUpdate({ supervisorName: e.target.value })}
                readOnly={!isSupervisor || formData.status === 'APPROVED'}
                placeholder="팀장 성함"
                className="h-12 bg-muted/30 border-border/50 rounded-xl font-bold focus:bg-card transition-all"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest">안전보건관리책임자 (소장)</label>
                <div className="w-1 h-1 bg-primary rounded-full shadow-[0_0_5px_rgba(49,130,246,0.5)]" />
              </div>
              <Input 
                value={formData.safetyManagerName || '김주영'}
                onChange={e => handleUpdate({ safetyManagerName: e.target.value })}
                readOnly={!isSupervisor || formData.status === 'APPROVED'}
                placeholder="소장 성함"
                className="h-12 bg-muted/30 border-border/50 rounded-xl font-black text-primary focus:bg-card transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">TBM 및 주요 전파사항</label>
              <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            <Textarea 
              value={formData.tbmContent}
              onChange={e => handleUpdate({ tbmContent: e.target.value })}
              readOnly={!isSupervisor || formData.status === 'APPROVED'}
              placeholder="오늘의 주요 작업 지시 및 안전 전파사항을 입력하세요."
              className="min-h-[100px] bg-muted/30 border-border/50 rounded-2xl font-bold focus:bg-card transition-all resize-none p-4 leading-relaxed"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Worker Instructions Table */}
      <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
        <CardHeader className="bg-muted/50 border-b border-border p-5 md:p-6 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> 지시사항 및 서명
          </CardTitle>
          {isSupervisor && (
            <Button variant="outline" size="sm" onClick={() => {
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
            }} className="rounded-xl font-black h-8 gap-1 border-primary/20 text-primary hover:bg-primary/5">
              <Plus className="w-4 h-4" /> 추가
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
             <thead>
                <tr className="bg-muted/30">
                  <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-b border-border w-10">NO</th>
                  <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-b border-border w-24">성명</th>
                  <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase border-b border-border">작업지시</th>
                  <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-b border-border w-24">건강</th>
                  <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-b border-border w-28">시간</th>
                  <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-b border-border w-20">작업전</th>
                  <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-b border-border w-20">작업후</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-border">
                {formData.workerInstructions?.map((worker, idx) => {
                  const canEditThisRow = isSupervisor || worker.workerUid === profile?.uid;
                  return (
                    <tr key={idx} className={cn(
                      "hover:bg-muted/10 transition-colors border-b border-border last:border-0",
                      worker.workerUid === profile?.uid && "bg-primary/5"
                    )}>
                      <td className="px-4 py-4 text-[10px] font-black text-center text-muted-foreground/50">{worker.no}</td>
                      <td className="px-4 py-4">
                        <Input 
                          value={worker.workerName}
                          onChange={e => updateWorkerItem(idx, 'workerName', e.target.value)}
                          readOnly={!isSupervisor}
                          className="h-9 bg-muted/20 border-border/50 rounded-lg font-black text-xs text-center"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <Input 
                          value={worker.instruction}
                          onChange={e => updateWorkerItem(idx, 'instruction', e.target.value)}
                          readOnly={!isSupervisor}
                          className="h-9 bg-muted/20 border-border/50 rounded-lg font-bold text-xs"
                          placeholder="작업 위치 및 내용"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={worker.healthStatus}
                          onChange={e => updateWorkerItem(idx, 'healthStatus', e.target.value)}
                          disabled={!canEditThisRow}
                          className="w-full h-9 bg-muted/20 border-border/50 rounded-lg text-[10px] font-black px-1.5 focus:ring-0 focus:border-primary transition-all outline-none"
                        >
                          <option value="GOOD">좋음</option>
                          <option value="NORMAL">보통</option>
                          <option value="BAD">나쁨</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <Input 
                            type="time"
                            value={worker.startTime}
                            onChange={e => updateWorkerItem(idx, 'startTime', e.target.value)}
                            readOnly={!canEditThisRow}
                            className="h-9 bg-muted/20 border-border/50 rounded-lg font-bold text-[10px] p-1"
                          />
                          <span className="text-muted-foreground/30">~</span>
                          <Input 
                            type="time"
                            value={worker.endTime}
                            onChange={e => updateWorkerItem(idx, 'endTime', e.target.value)}
                            readOnly={!canEditThisRow}
                            className="h-9 bg-muted/20 border-border/50 rounded-lg font-bold text-[10px] p-1 text-primary"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <div 
                          className={cn(
                            "w-12 h-12 bg-muted/20 rounded-xl flex items-center justify-center cursor-pointer border border-dashed border-border/50 overflow-hidden hover:bg-muted/40 transition-all",
                            !canEditThisRow && "opacity-50 cursor-not-allowed"
                          )}
                          onClick={() => {
                            if (!canEditThisRow) return;
                            setActiveSignIdx({ idx, type: 'before' });
                            setIsSignOpen(true);
                          }}
                        >
                          {worker.signBeforeUrl ? (
                             <img src={worker.signBeforeUrl} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="sign" />
                          ) : (
                             <SignatureIcon className="w-3 h-3 text-muted-foreground/30" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <div 
                          className={cn(
                            "w-12 h-12 bg-muted/20 rounded-xl flex items-center justify-center cursor-pointer border border-dashed border-border/50 overflow-hidden hover:bg-muted/40 transition-all",
                            !canEditThisRow && "opacity-50 cursor-not-allowed"
                          )}
                          onClick={() => {
                            if (!canEditThisRow) return;
                            setActiveSignIdx({ idx, type: 'after' });
                            setIsSignOpen(true);
                          }}
                        >
                          {worker.signAfterUrl ? (
                             <img src={worker.signAfterUrl} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal text-primary" alt="sign" />
                          ) : (
                             <SignatureIcon className="w-3 h-3 text-primary/30" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
             </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 3. Safety Inspection */}
      <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
        <CardHeader className="bg-muted/50 border-b border-border p-6">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> 일일안전점검
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {formData.safetyChecks?.map((cat, catIdx) => (
            <div key={catIdx} className="border-b border-border last:border-0">
              <div className="bg-muted/10 px-6 py-2">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{cat.category}</h4>
              </div>
              <div className="divide-y divide-border">
                {cat.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/5">
                    <div className="flex items-center gap-3">
                       <span className="text-xs font-bold text-muted-foreground/40">{itemIdx + 1}</span>
                       <p className="text-sm font-bold text-foreground">{item.text}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-4">
                        {['O', 'X', 'N/A'].map(res => (
                          <button
                            key={res}
                            disabled={(!isSupervisor && formData.status !== 'APPROVED') || formData.status === 'APPROVED'}
                            onClick={() => updateSafetyCheck(catIdx, itemIdx, res as any)}
                            className={cn(
                              "w-12 h-10 rounded-xl text-[11px] font-black transition-all border transition-all active:scale-95",
                              item.result === res 
                                ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                                : "bg-muted/50 border-border text-muted-foreground/40 hover:bg-muted",
                              (!isSupervisor || formData.status === 'APPROVED') && "cursor-not-allowed opacity-80 active:scale-100"
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

      {/* 4. Hazard Assessment */}
      <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-lg">
        <CardHeader className="bg-muted/50 border-b border-border p-6">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" /> 위험요소 및 안전작업방법 (사전 입력됨)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
             <thead className="bg-muted/30">
                <tr>
                   <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase text-center border-border border-b w-10">NO</th>
                   <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase border-border border-b w-1/4">위험요인</th>
                   <th className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase border-border border-b">안전작업방법</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-border">
                {formData.hazardAssessments?.map((hazard, idx) => (
                  <tr key={idx} className="hover:bg-muted/5">
                    <td className="px-4 py-3 text-xs font-bold text-center text-muted-foreground">{hazard.no}</td>
                    <td className="px-4 py-3 text-sm font-black text-foreground">{hazard.hazardFactor}</td>
                    <td className="px-4 py-3">
                      <Input 
                        value={hazard.safetyMethod}
                        onChange={e => {
                          const newHazards = [...(formData.hazardAssessments || [])];
                          newHazards[idx].safetyMethod = e.target.value;
                          handleUpdate({ hazardAssessments: newHazards });
                        }}
                        readOnly={!isSupervisor}
                        placeholder="안전작업방법 입력"
                        className="h-10 bg-muted/20 border-none rounded-lg font-bold text-sm"
                      />
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex gap-4 pt-4">
        <Button 
          variant="outline" 
          className="flex-1 h-16 rounded-[2rem] font-black text-lg border-border"
          onClick={() => navigate(-1)}
        >
          목록으로
        </Button>
        {isSupervisor && formData.status === 'PENDING' && (
          <Button 
            className="flex-[2] h-16 rounded-[2rem] font-black text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20"
            onClick={handleFinalSubmit}
            disabled={submitting}
          >
            {submitting ? '제출 중...' : (
              <span className="flex items-center gap-2">
                <Send className="w-5 h-5" /> 보고서 최종 제출
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Signature Dialog */}
      <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center pt-4">서명해 주세요</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center gap-4">
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
                 className="flex-1 rounded-xl font-bold h-10"
                 onClick={() => sigPad.current?.clear()}
               >
                 초기화
               </Button>
               <Button 
                 className="flex-1 rounded-xl font-black h-10"
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

