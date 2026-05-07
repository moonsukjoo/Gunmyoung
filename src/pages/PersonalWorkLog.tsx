import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit, serverTimestamp } from 'firebase/firestore';
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
  Plus, 
  Trash2, 
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { IndividualWorkLog } from '@/src/types';

import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';

export const PersonalWorkLog: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tasks, setTasks] = useState<{ content: string; hours: string }[]>([{ content: '', hours: '' }]);
  const [clockOutTime, setClockOutTime] = useState('18:00');
  const [recentLogs, setRecentLogs] = useState<IndividualWorkLog[]>([]);

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
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const updateTask = (idx: number, field: 'content' | 'hours', value: string) => {
    const newTasks = [...tasks];
    newTasks[idx][field] = value;
    setTasks(newTasks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const validTasks = tasks.filter(t => t.content && t.hours);
    if (validTasks.length === 0) {
      toast.error('최소 하나 이상의 작업 내용을 입력해주세요.');
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
    <div className="space-y-6 pb-24 px-1 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-white">나의 작업일지 작성</h1>
          <p className="text-sm text-white/40 font-bold">오늘의 업무 내역을 기록해 주세요.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-white/5 border-white/10 rounded-3xl overflow-hidden shadow-xl">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">작업 일자</label>
                <div className="relative">
                  <Input 
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="bg-white/5 border-white/10 rounded-xl h-12 font-black"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">퇴근 시간</label>
                <div className="relative">
                  <Input 
                    type="time"
                    value={clockOutTime}
                    onChange={(e) => setClockOutTime(e.target.value)}
                    className="bg-white/5 border-white/10 rounded-xl h-12 font-black"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">상세 작업 내용</label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleAddTask}
                  className="text-primary font-bold text-xs gap-1"
                >
                  <Plus className="w-3 h-3" /> 항목 추가
                </Button>
              </div>

              <div className="space-y-3">
                {tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2 group">
                    <div className="flex-1 space-y-2">
                       <Input 
                        placeholder="작업 내용을 입력하세요"
                        value={task.content}
                        onChange={(e) => updateTask(idx, 'content', e.target.value)}
                        className="bg-white/5 border-white/10 rounded-xl text-sm font-semibold"
                      />
                    </div>
                    <div className="w-20 relative">
                      <Input 
                        placeholder="시간"
                        value={task.hours}
                        onChange={(e) => updateTask(idx, 'hours', e.target.value)}
                        className="bg-white/5 border-white/10 rounded-xl text-center font-black pr-6"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20">H</span>
                    </div>
                    {tasks.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveTask(idx)}
                        className="text-white/10 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 flex gap-3">
              <AlertCircle className="w-5 h-5 text-white/20 shrink-0 mt-0.5" />
              <p className="text-[11px] text-white/40 font-medium leading-relaxed">
                입력하신 내용은 소속 팀장/직장님께 전달되어 확인 후 최종 승인됩니다. <br/>
                정확한 시간을 입력해 주세요.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-16 bg-primary text-white font-black text-lg rounded-3xl shadow-xl shadow-primary/20 active:scale-95 transition-all gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          작업일지 제출하기
        </Button>
      </form>

      {/* Recent History */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-4 h-4" />
          최근 제출 내역
        </h3>
        <div className="space-y-3">
          {recentLogs.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-white/5 rounded-3xl">
              <p className="text-white/20 text-xs font-bold">최근 제출 기록이 없습니다.</p>
            </div>
          ) : (
            recentLogs.map(log => (
              <div key={log.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-white">{log.date}</span>
                    <span className="text-[10px] font-bold text-white/20">{log.clockOutTime} 퇴근</span>
                  </div>
                  <div className="flex gap-2">
                    {log.tasks.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-md truncate max-w-[100px]">
                        {t.content}
                      </span>
                    ))}
                    {log.tasks.length > 2 && <span className="text-[10px] text-white/20">...</span>}
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
    </div>
  );
};
