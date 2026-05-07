import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, addDoc, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
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
  Users, 
  Plus, 
  Trash2, 
  FileText,
  Loader2,
  Table as TableIcon
} from 'lucide-react';
import { TeamWorkLog, WorkLogEntry, UserProfile } from '@/src/types';

export const WorkLog: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    if (profile) {
      setTeamName(profile.departmentName || '');
      loadTeamMembers(profile.departmentName || '');
    }
  }, [profile]);

  const loadTeamMembers = async (deptName: string) => {
    if (!deptName) return;
    try {
      const q = query(
        collection(db, 'users'), 
        where('departmentName', '==', deptName),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      const members = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setTeamMembers(members);
      
      // Initialize entries with members
      setEntries(members.map(m => ({
        userName: m.displayName,
        tasks: [{ content: '', hours: '' }],
        clockOutTime: '18:00'
      })));
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleAddEntry = () => {
    setEntries([...entries, {
      userName: '',
      tasks: [{ content: '', hours: '' }],
      clockOutTime: '18:00'
    }]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleUpdateEntry = (index: number, updates: Partial<WorkLogEntry>) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };
    setEntries(newEntries);
  };

  const handleAddTask = (entryIndex: number) => {
    const newEntries = [...entries];
    if (newEntries[entryIndex].tasks.length < 3) {
      newEntries[entryIndex].tasks.push({ content: '', hours: '' });
      setEntries(newEntries);
    } else {
      toast.error('최대 3개까지만 가능합니다.');
    }
  };

  const handleUpdateTask = (entryIndex: number, taskIndex: number, field: 'content' | 'hours', value: string) => {
    const newEntries = [...entries];
    newEntries[entryIndex].tasks[taskIndex][field] = value;
    setEntries(newEntries);
  };
  const handleApplyFirstToAll = () => {
    if (entries.length < 2) return;
    const firstTasks = entries[0].tasks;
    const firstClockOut = entries[0].clockOutTime;
    
    setEntries(entries.map((entry, idx) => {
      if (idx === 0) return entry;
      return {
        ...entry,
        tasks: firstTasks.map(t => ({ ...t })),
        clockOutTime: firstClockOut
      };
    }));
    toast.success('첫 번째 인원의 작업 내용이 모두에게 적용되었습니다.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const validEntries = entries.filter(e => e.userName && e.tasks.some(t => t.content));
    if (validEntries.length === 0) {
      toast.error('최소 한 명 이상의 작업 내용을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'teamWorkLogs'), {
        teamId: profile.departmentId || '',
        teamName: teamName || profile.departmentName || '미지정',
        date: logDate,
        entries: validEntries,
        createdAt: new Date().toISOString(),
        createdByUid: profile.uid,
        createdByUserName: profile.displayName
      });
      
      toast.success('팀 작업일지가 저장되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('Team work log save error:', error);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1 max-w-5xl mx-auto">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white/5 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-black text-white">팀 일일작업일지</h1>
            <p className="text-[10px] font-bold text-white/40">{teamName} | {logDate}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/5">
          <label className="text-[10px] font-black text-white/40 uppercase ml-1">작업 일자</label>
          <Input 
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="bg-transparent border-none text-white font-black p-0 h-auto focus-visible:ring-0 text-lg"
          />
        </div>
        <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/5">
          <label className="text-[10px] font-black text-white/40 uppercase ml-1">팀 이름</label>
          <Input 
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="팀 이름을 입력하세요"
            className="bg-transparent border-none text-white font-black p-0 h-auto focus-visible:ring-0 text-lg"
          />
        </div>
        <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-primary uppercase">총원</p>
            <p className="text-xl font-black text-white">{entries.length}명</p>
          </div>
        </div>
      </div>

      <Card className="bg-card border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
        <CardHeader className="bg-white/5 p-6 border-b border-white/5 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black text-white flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-primary" />
            작업 내역 입력
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleApplyFirstToAll}
              disabled={entries.length < 2}
              className="text-white/40 border-white/10 hover:bg-white/5 font-bold gap-1 rounded-xl text-[10px]"
            >
              <Save className="w-3 h-3" />
              첫 인원 내용 일괄복사
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleAddEntry}
              className="text-primary hover:bg-primary/10 font-bold gap-1 rounded-xl text-[10px]"
            >
              <Plus className="w-4 h-4" />
              인원 추가
            </Button>
          </div>
        </CardHeader>
          <div className="space-y-4">
            {entries.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.02]">
                <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 font-bold">인원을 추가하거나 멤버를 불러와주세요.</p>
              </div>
            ) : (
              entries.map((entry, idx) => (
                <Card key={idx} className="bg-white/[0.03] border-white/5 rounded-3xl overflow-hidden shadow-sm transition-all hover:bg-white/[0.05] hover:border-primary/20 relative group">
                  {/* Floating ID badge */}
                  <div className="absolute top-0 left-0 bg-primary/20 text-primary px-3 py-1 rounded-br-2xl text-[10px] font-black uppercase tracking-widest z-10">
                    NO. {idx + 1}
                  </div>
                  
                  <div className="p-5 pt-10 space-y-6">
                    {/* Compact Top Section: Name & Time */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div className="flex-1 w-full space-y-2">
                        <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">작업자 성명</label>
                        <Input 
                          value={entry.userName}
                          onChange={(e) => handleUpdateEntry(idx, { userName: e.target.value })}
                          placeholder="성명 입력"
                          className="bg-white/5 border-white/10 text-lg font-black text-white px-4 h-12 rounded-2xl focus:ring-primary/20 placeholder:text-white/10"
                        />
                      </div>
                      
                      <div className="w-full sm:w-40 space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest">퇴근 시간</label>
                        </div>
                        <div className="flex items-center gap-3 px-4 h-12 bg-white/5 rounded-2xl border border-white/10">
                          <Clock className="w-4 h-4 text-white/20" />
                          <Input 
                            type="time"
                            value={entry.clockOutTime}
                            onChange={(e) => handleUpdateEntry(idx, { clockOutTime: e.target.value })}
                            className="bg-transparent border-none text-sm font-bold text-white p-0 w-full focus-visible:ring-0"
                          />
                        </div>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveEntry(idx)}
                        className="absolute top-2 right-2 w-10 h-10 text-white/5 hover:text-red-500 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Task Grid with improved layout */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">세부 업무 기록</span>
                        <span className="text-[9px] font-bold text-white/20 italic">최대 3개 항목</span>
                      </div>
                      
                      <div className="space-y-3">
                        {entry.tasks.map((task, tIdx) => (
                          <div key={tIdx} className="flex gap-3">
                            <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 focus-within:border-primary/40 transition-all p-1">
                              <Input 
                                value={task.content}
                                onChange={(e) => handleUpdateTask(idx, tIdx, 'content', e.target.value)}
                                placeholder={`업무 상세 내용 ${tIdx + 1}`}
                                className="bg-transparent border-none text-sm font-semibold text-white px-4 py-2.5 h-auto focus-visible:ring-0 placeholder:text-white/5"
                              />
                            </div>
                            <div className="relative w-20 shrink-0 bg-white/5 rounded-2xl border border-white/10 focus-within:border-primary/40 transition-all p-1">
                              <div className="flex items-center justify-center h-full px-2">
                                <Input 
                                  value={task.hours}
                                  onChange={(e) => handleUpdateTask(idx, tIdx, 'hours', e.target.value)}
                                  placeholder="0"
                                  className="bg-transparent border-none text-base font-black text-primary p-0 w-8 h-auto text-right focus-visible:ring-0"
                                />
                                <span className="text-[10px] font-black text-white/20 ml-1">H</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {entry.tasks.length < 3 && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAddTask(idx)}
                            className="w-full h-10 border border-dashed border-white/5 bg-white/[0.01] text-white/20 hover:text-primary hover:border-primary/20 rounded-2xl font-bold text-[11px] gap-2 transition-all mt-2"
                          >
                            <Plus className="w-4 h-4" />
                            신규 업무 항목 추가
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
      </Card>

      <div className="flex gap-4">
        <Button 
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {loading ? '저장 중...' : '팀 작업일지 제출하기'}
        </Button>
      </div>

      <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-3">
        <div className="flex items-center gap-2 text-white/40">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">작업일지 작성 안내</span>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">팀원별 직접 입력</h4>
              <p className="text-white/40 text-xs mt-1 leading-relaxed">
                팀원들의 성명을 확인하고 작업 내용과 시간(H)을 각각 입력해 주세요.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Save className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">일괄 복사 기능</h4>
              <p className="text-white/40 text-xs mt-1 leading-relaxed">
                첫 번째 인원의 내용을 모두에게 동일하게 적용하려면 '일괄복사' 버튼을 사용하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
