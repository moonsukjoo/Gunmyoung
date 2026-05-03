import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Send, 
  Users, 
  MessageSquare, 
  History, 
  Filter, 
  AlertCircle,
  CheckCircle2,
  Trash2,
  Mail,
  Zap,
  Plus,
  MoreVertical,
  Layers,
  HardHat
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface NotificationLog {
  id: string;
  title: string;
  content: string;
  target: 'all' | 'specific' | 'team';
  targetGroup?: string;
  author: string;
  sentAt: any;
  status: 'delivered' | 'failed';
}

const PCAdminNotifications: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific' | 'team'>('all');
  const [targetGroup, setTargetGroup] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'adminNotifications'), orderBy('sentAt', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationLog[];
      setLogs(data);
    } catch (e) {
      console.error(e);
      // Dummy data
      if (logs.length === 0) {
        setLogs([
          { id: '1', title: '설비 점검 안내', content: '금일 오후 3시 A공구 대형 크레인 점검이 예정되어 있습니다.', target: 'team', targetGroup: 'A공구', author: '이건명', sentAt: { toDate: () => new Date() }, status: 'delivered' },
          { id: '2', title: '긴급 기상 악화', content: '강풍 주의보가 발령되었습니다. 모든 야외 고소작업을 중단해주시기 바랍니다.', target: 'all', author: '관리자', sentAt: { toDate: () => new Date() }, status: 'delivered' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'adminNotifications'), {
        title,
        content,
        target: targetType,
        targetGroup: targetType === 'all' ? '전 임직원' : targetGroup,
        author: '시스템 관리자',
        sentAt: serverTimestamp(),
        status: 'delivered'
      });
      toast.success('알림이 발송되었습니다.');
      setIsModalOpen(false);
      resetForm();
      fetchLogs();
    } catch (e) {
      console.error(e);
      toast.error('발송 중 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTargetType('all');
    setTargetGroup('');
  };

  return (
    <PCAdminLayout title="푸시 알림 관리">
      <div className="max-w-[1500px] mx-auto space-y-10">
        <header className="flex justify-between items-end">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Notification Command Center</h2>
            <p className="text-slate-500 font-medium">임직원들에게 개별 또는 그룹별 푸시 알림을 즉시 발송하고 관리합니다.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-sm flex items-center gap-3 hover:bg-blue-500 hover:scale-105 transition-all shadow-xl shadow-blue-600/20"
          >
            <Zap className="w-5 h-5 fill-white" />
            새 알림 즉시 발송
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           {/* Left: Quick Stats */}
           <div className="lg:col-span-4 space-y-8">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
                 <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-2">
                    <Layers className="w-6 h-6 text-blue-600" />
                    채널별 발송 현황
                 </h3>
                 <div className="space-y-4">
                    {[
                      { label: '전체 푸시', value: 1240, color: 'bg-blue-500' },
                      { label: '팀별 알림', value: 450, color: 'bg-emerald-500' },
                      { label: '긴급 공지', value: 85, color: 'bg-rose-500' },
                    ].map((stat, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs font-black mb-2 uppercase tracking-widest">
                           <span className="text-slate-400">{stat.label}</span>
                           <span className="text-slate-900">{stat.value} 건</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full ${stat.color}`} style={{ width: `${(stat.value / 1500) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                 <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
                       <MessageSquare className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="text-xl font-black mb-4 tracking-tight leading-tight">스마트 그룹 필터링</h4>
                    <p className="text-slate-400 text-sm font-medium mb-8">
                       특정 작업 공구나 직함별로 필터링하여<br/>관련된 인원에게만 정밀하게<br/>정보를 전달할 수 있습니다.
                    </p>
                    <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all">
                       대상자 필터링 도구 열기
                    </button>
                 </div>
                 <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500/20 rounded-full blur-[80px]" />
              </div>
           </div>

           {/* Right: History List */}
           <div className="lg:col-span-8 bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                 <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <History className="w-6 h-6 text-slate-400" />
                    최근 발송 이력
                 </h3>
                 <div className="flex gap-4">
                    <div className="relative group">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                       <input 
                         type="text" 
                         placeholder="알림 제목 검색..."
                         className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                       />
                    </div>
                 </div>
              </div>
              <div className="divide-y divide-slate-50 overflow-y-auto max-h-[700px] custom-scrollbar">
                 {logs.map((log) => (
                   <div key={log.id} className="p-8 hover:bg-blue-50/20 transition-all group flex gap-8 items-start">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-white group-hover:shadow-md transition-all">
                         {log.target === 'all' ? <Users className="w-7 h-7" /> : <Mail className="w-7 h-7" />}
                      </div>
                      <div className="flex-1 space-y-2">
                         <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                               <h4 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">{log.title}</h4>
                               <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-black text-slate-500 rounded uppercase tracking-widest border border-slate-200">
                                  {log.targetGroup || log.target}
                               </span>
                            </div>
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-tighter italic">
                               {log.sentAt?.toDate().toLocaleString('ko-KR', { hour12: false })}
                            </span>
                         </div>
                         <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">{log.content}</p>
                         <div className="pt-4 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                               <span className="text-[10px] font-black text-slate-400 uppercase">Delivered Successfully</span>
                            </div>
                            <div className="flex items-center gap-2 pl-4 border-l border-slate-100 font-black text-slate-300 text-[10px] uppercase">
                               Author: {log.author}
                            </div>
                         </div>
                      </div>
                      <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all self-center border border-transparent hover:border-rose-100">
                         <Trash2 className="w-5 h-5" />
                      </button>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Send Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-12 py-10 bg-blue-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-5">
                   <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                      <Bell className="w-8 h-8 text-white fill-white" />
                   </div>
                   <div>
                      <h3 className="text-3xl font-black tracking-tight leading-none mb-1">New Broadcast</h3>
                      <p className="text-blue-100/70 text-xs font-bold uppercase tracking-widest">Push Notification Service</p>
                   </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <Plus className="w-8 h-8 rotate-45 text-white" />
                </button>
              </div>
              
              <form onSubmit={handleSend} className="p-12 space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">발송 대상 설정</label>
                  <div className="flex gap-4">
                    {(['all', 'team', 'specific'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTargetType(type)}
                        className={`flex-1 py-4 px-4 rounded-2xl text-[11px] font-black uppercase transition-all shadow-sm ${
                          targetType === type ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {type === 'all' ? '전체 임직원' : type === 'team' ? '특정 공구/팀' : '개별 사용자'}
                      </button>
                    ))}
                  </div>
                </div>

                {targetType === 'team' && (
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">대상 그룹 선택</label>
                    <select 
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-800"
                    >
                      <option value="">그룹 선택...</option>
                      <option value="A공구">A공구</option>
                      <option value="B공구">B공구</option>
                      <option value="C공구">C공구</option>
                      <option value="관리팀">관리팀</option>
                      <option value="안전팀">안전팀</option>
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">알림 제목</label>
                  <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text" 
                    placeholder="임팩트 있는 제목을 입력하세요"
                    className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl text-base font-black focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-800"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">알림 세부 내용</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    placeholder="전달할 메시지를 입력하세요..."
                    className="w-full px-8 py-8 bg-slate-50 border-none rounded-[2.5rem] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-800 resize-none leading-relaxed"
                  />
                </div>

                <div className="pt-6 flex gap-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-3xl font-black text-sm hover:bg-slate-200 transition-all"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-6 bg-blue-600 text-white rounded-3xl font-black text-sm hover:bg-blue-500 transition-all shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-4 group"
                  >
                    <Send className="w-6 h-6 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform" />
                    SEND NOTIFICATION NOW
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminNotifications;
