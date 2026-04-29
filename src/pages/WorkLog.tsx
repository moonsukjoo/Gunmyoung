import React, { useState } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ClipboardList, Clock, Save, ChevronLeft } from 'lucide-react';

export const WorkLog: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '17:00',
    content: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!formData.content.trim()) {
      toast.error('작업 내용을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'workLogs'), {
        uid: profile.uid,
        userName: profile.displayName,
        departmentId: profile.departmentId || '',
        departmentName: profile.departmentName || '미지정',
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        content: formData.content,
        createdAt: new Date().toISOString()
      });
      
      toast.success('작업일지가 저장되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('Work log save error:', error);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1">
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
          <h1 className="text-xl font-black text-white">작업일지 작성</h1>
        </div>
      </div>

      <Card className="bg-card border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">작업 시간 설정</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase">작업 일자</label>
                  <Input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="bg-white/5 border-white/10 text-white rounded-2xl h-14 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase">시작 시간</label>
                    <Input 
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                      className="bg-white/5 border-white/10 text-white rounded-2xl h-14 font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase">종료 시간</label>
                    <Input 
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                      className="bg-white/5 border-white/10 text-white rounded-2xl h-14 font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-primary">
                <ClipboardList className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">일지 내용</span>
              </div>
              <div className="space-y-1.5">
                <Textarea 
                  placeholder="오늘 어떤 작업을 수행하셨나요? 핵심 내용을 간단하게 적어주세요."
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="bg-white/5 border-white/10 text-white rounded-2xl min-h-[200px] p-5 font-medium leading-relaxed resize-none focus:ring-primary/20"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all gap-2"
            >
              <Save className="w-5 h-5" />
              {loading ? '저장 중...' : '작업일지 제출하기'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
        <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">
          • 작업일지는 관리자 및 팀장이 실시간으로 확인할 수 있습니다.<br />
          • 허위 작성 시 안전 점수 및 근태에 영향을 줄 수 있으니 정확하게 기입해주세요.<br />
          • 퇴근 전 작성을 권장합니다.
        </p>
      </div>
    </div>
  );
};
