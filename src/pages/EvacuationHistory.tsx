import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  History, 
  ChevronRight, 
  ChevronLeft,
  Users, 
  Calendar, 
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { exportToExcel } from '../lib/exportUtils';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const EvacuationHistory: React.FC = () => {
  const navigate = useNavigate();
  const [evacuations, setEvacuations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEv, setSelectedEv] = useState<any | null>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'evacuations'), orderBy('activatedAt', 'desc'), limit(30));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEvacuations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('이력을 불러오지 못했습니다.');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedEv) {
      setCheckinsLoading(true);
      const q = query(collection(db, 'evacuations', selectedEv.id, 'checkins'), orderBy('confirmedAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setCheckins(snap.docs.map(doc => doc.data()));
        setCheckinsLoading(false);
      });
      return () => unsubscribe();
    }
  }, [selectedEv]);

  const handleExport = () => {
    if (!selectedEv || checkins.length === 0) return;
    const data = checkins.map(c => ({
      '성명': c.displayName,
      '소속': c.departmentName,
      '확인시간': format(new Date(c.confirmedAt), 'yyyy-MM-dd HH:mm:ss')
    }));
    exportToExcel(data, `비상대피_${selectedEv.id}`, '확인자명단');
    toast.success('엑셀 파일이 다운로드 되었습니다.');
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin')}
            className="text-white/50"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h2 className="text-lg font-black text-white leading-none">대피 이력 관리</h2>
            <p className="text-[10px] font-bold text-white/40 mt-1 uppercase tracking-widest">History Management</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">비상 대피 이력</h2>
            <p className="text-[10px] font-bold text-white/40">최근 30건의 이력을 보여줍니다.</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          </div>
        ) : evacuations.length > 0 ? (
          <div className="space-y-3">
            {evacuations.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedEv(ev)}
                className="bg-card/50 border border-white/5 rounded-[2rem] p-5 active:scale-[0.98] transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <Badge className={`${ev.status === 'ACTIVE' ? 'bg-red-500' : 'bg-white/10'} font-black px-3`}>
                    {ev.status === 'ACTIVE' ? '진행중' : '종료'}
                  </Badge>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{ev.id}</p>
                </div>
                
                <h3 className="text-base font-black text-white mb-2 leading-tight">{ev.reason}</h3>
                
                <div className="flex items-center gap-4 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-xs font-bold text-white/50">
                      {format(new Date(ev.activatedAt), 'MM/dd HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Users className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-xs font-black text-primary">{ev.confirmedCount || 0}명 확인</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
            <AlertTriangle className="w-10 h-10 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 font-bold">이력이 없습니다.</p>
          </div>
        )}

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedEv && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col pt-safe"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedEv(null)}>
                  <X className="w-6 h-6 text-white" />
                </Button>
                <div>
                  <h3 className="font-black text-white">이력 상세</h3>
                  <p className="text-[10px] font-bold text-white/40">{selectedEv.id}</p>
                </div>
              </div>
              <Button 
                onClick={handleExport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-10 px-4 flex items-center gap-2 text-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                엑셀
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black text-white/50 tracking-widest uppercase">발동 정보</span>
                </div>
                <h2 className="text-xl font-black text-white mb-4">{selectedEv.reason}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white/30 tracking-widest uppercase">발동 일시</p>
                    <p className="text-sm font-black text-white">{format(new Date(selectedEv.activatedAt), 'yy/MM/dd HH:mm:ss')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white/30 tracking-widest uppercase">발동자</p>
                    <p className="text-sm font-black text-white">{selectedEv.activatedByName}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    확인 인원 ({checkins.length}명)
                  </h4>
                </div>

                {checkinsLoading ? (
                  <div className="py-10 text-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : checkins.length > 0 ? (
                  <div className="space-y-2 pb-10">
                    {checkins.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black text-white/40">
                            {c.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-white text-sm">{c.displayName}</p>
                            <p className="text-[10px] font-bold text-white/30">{c.departmentName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-white">{format(new Date(c.confirmedAt), 'HH:mm:ss')}</p>
                          <p className="text-[10px] font-bold text-emerald-500 tracking-tighter">SAFE</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                    <p className="text-white/20 font-bold">확인된 리스트가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EvacuationHistory;
