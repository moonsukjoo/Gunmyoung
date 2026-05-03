import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Search, 
  Plus, 
  Gift, 
  Ticket, 
  Calendar, 
  User, 
  ChevronRight,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  Send,
  Users
} from 'lucide-react';
import { collection, query, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface RewardHistory {
  id: string;
  userName: string;
  userId: string;
  rewardType: string;
  amount: number;
  reason: string;
  date: any;
  status: 'sent' | 'used' | 'expired';
}

const PCAdminCoupons: React.FC = () => {
  const [history, setHistory] = useState<RewardHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [targetUser, setTargetUser] = useState('');
  const [rewardType, setRewardType] = useState('Safety Bonus');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'rewardHistory'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RewardHistory[];
      setHistory(data);
    } catch (e) {
      console.error(e);
      // Dummy data for visualization
      if (history.length === 0) {
        setHistory([
          { id: '1', userName: '장동건', userId: 'u1', rewardType: '안전 우수자 쿠폰', amount: 5000, reason: '3월 무재해 달성 포상', date: { toDate: () => new Date() }, status: 'sent' },
          { id: '2', userName: '이순신', userId: 'u2', rewardType: '로또 당첨금', amount: 100000, reason: '제 12회 사내 로또 2등 당첨', date: { toDate: () => new Date() }, status: 'used' },
          { id: '3', userName: '강감찬', userId: 'u3', rewardType: '현장 정리왕', amount: 10000, reason: '보급 창고 정리 정돈 우수', date: { toDate: () => new Date() }, status: 'expired' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !amount || !reason) {
      toast.error('모든 정보를 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'rewardHistory'), {
        userName: targetUser,
        rewardType,
        amount: parseInt(amount),
        reason,
        date: serverTimestamp(),
        status: 'sent'
      });
      toast.success(`${targetUser}님에게 포상이 전송되었습니다.`);
      setIsModalOpen(false);
      fetchHistory();
    } catch (e) {
      console.error(e);
      toast.error('포상 전송 중 오류가 발생했습니다.');
    }
  };

  return (
    <PCAdminLayout title="포상 및 쿠폰 관리">
      <div className="max-w-[1500px] mx-auto space-y-10">
        <header className="flex justify-between items-end">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Rewards & Coupons</h2>
            <p className="text-slate-500 font-medium">임직원들의 사기 진작을 위한 포상 및 사내 쿠폰 시스템을 관리합니다.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
          >
            <Send className="w-5 h-5" />
            새 포상 발행하기
          </button>
        </header>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-8 relative overflow-hidden group">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
               <Ticket className="w-8 h-8" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">이번 달 총 발행 건수</p>
               <p className="text-3xl font-black text-slate-900">128건</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-8 relative overflow-hidden group">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
               <Trophy className="w-8 h-8" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">총 포상 금액 규모</p>
               <p className="text-3xl font-black text-slate-900">4,250,000원</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-8 relative overflow-hidden group">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
               <Users className="w-8 h-8" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">포상 수혜 직원</p>
               <p className="text-3xl font-black text-slate-900">42명</p>
            </div>
          </div>
        </div>

        {/* List View */}
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-800">최근 포상 및 쿠폰 발행 내역</h3>
            <div className="flex gap-4">
               <div className="relative group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                 <input 
                    type="text" 
                    placeholder="직원 이름 검색..."
                    className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
                 />
               </div>
               <button className="px-5 py-3 bg-slate-50 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 transition-all flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  정렬 기준
               </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">수혜 대상</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">포상 유형</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">포상 사유 / 세부 내용</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">발행 금액</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">발행 일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-10 py-8 bg-slate-50/20" />
                    </tr>
                  ))
                ) : history.map((log) => (
                  <tr key={log.id} className="group hover:bg-blue-50/20 transition-all">
                    <td className="px-10 py-6">
                      <div className="flex justify-center">
                        {log.status === 'sent' && <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-tighter">발송됨</span>}
                        {log.status === 'used' && <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter">사용 완료</span>}
                        {log.status === 'expired' && <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-tighter">기간 만료</span>}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-sm font-black text-slate-500 border border-slate-200">
                           {log.userName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{log.userName}</p>
                          <p className="text-[10px] font-bold text-slate-400 tracking-tight italic">ID: {log.userId || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="text-sm font-bold text-slate-700">{log.rewardType}</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <p className="text-xs font-medium text-slate-500 max-w-[250px] leading-relaxed italic">"{log.reason}"</p>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-2 text-blue-600">
                        <Gift className="w-4 h-4" />
                        <span className="text-sm font-black tracking-tighter">{log.amount.toLocaleString()}원</span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-[10px] font-black text-slate-400">
                      {log.date?.toDate().toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Send Reward Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Trophy className="w-8 h-8 text-amber-400" />
                  <h3 className="text-2xl font-black tracking-tight">Reward Issuance</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <form onSubmit={handleSendReward} className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">대상 직원 성함</label>
                  <input 
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    type="text" 
                    placeholder="성함을 정확히 입력하세요"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">포상 종류 선택</label>
                  <select 
                    value={rewardType}
                    onChange={(e) => setRewardType(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
                  >
                    <option>안전 우수자 쿠폰</option>
                    <option>로또 이벤트 당첨</option>
                    <option>현장 정리왕 포상</option>
                    <option>생일 축하 포인트</option>
                    <option>기타 격려금</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">발행 금액 (원)</label>
                  <input 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number" 
                    placeholder="숫자만 입력 (예: 5000)"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">포상 사유</label>
                  <textarea 
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    placeholder="포상 사유를 입력하세요 (이 내용은 직원에게 노출됩니다)"
                    className="w-full px-6 py-6 bg-slate-50 border-none rounded-3xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800 resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3"
                  >
                    <Send className="w-5 h-5" />
                    포상 전송 완료
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

export default PCAdminCoupons;
