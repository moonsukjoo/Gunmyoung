import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaveRequest } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  FileText,
  User,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const PCAdminLeave: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'all'>('PENDING');

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let q;
      if (filter === 'all') {
        q = query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'));
      } else {
        q = query(
          collection(db, 'leaveRequests'), 
          where('status', '==', filter),
          orderBy('createdAt', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as LeaveRequest));
      setRequests(data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('결재 대기 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    try {
      await updateDoc(doc(db, 'leaveRequests', requestId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success(newStatus === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.');
      fetchRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <PCAdminLayout title="연차/휴가 결재 관리">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Status Filter Tabs */}
        <div className="flex bg-white p-1.5 rounded-[4rem] border border-slate-200 shadow-sm w-fit">
          {[
            { id: 'PENDING', label: '승인 대기', count: requests.length, color: 'text-orange-600', bg: 'bg-orange-50' },
            { id: 'APPROVED', label: '최종 승인', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { id: 'REJECTED', label: '반려 내역', color: 'text-rose-600', bg: 'bg-rose-50' },
            { id: 'all', label: '전체 목록', color: 'text-slate-600', bg: 'bg-slate-50' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-8 py-3 rounded-[4rem] text-sm font-black transition-all flex items-center gap-2 ${
                filter === tab.id 
                ? `${tab.bg} ${tab.color} shadow-sm border border-black/5` 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {tab.id === 'PENDING' && <span className="w-5 h-5 bg-orange-600 text-white rounded-full text-[10px] flex items-center justify-center">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-64 bg-white rounded-[2.5rem] animate-pulse border border-slate-200" />
              ))
            ) : requests.length === 0 ? (
              <div className="col-span-full py-32 bg-white rounded-[3rem] border border-slate-200 text-center flex flex-col items-center justify-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-10 h-10 text-slate-200" />
                 </div>
                 <p className="text-xl font-bold text-slate-400">조회된 결재 신청 건이 없습니다.</p>
              </div>
            ) : (
              requests.map((req) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={req.id} 
                  className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col"
                >
                  <div className="p-8 flex justify-between items-start">
                    <div className="flex gap-5">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.uid}`} alt="profile" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                           {req.displayName || '사용자'} 
                           <span className="text-xs font-bold text-slate-400 px-2 py-0.5 bg-slate-50 rounded-lg">{(req.type === 'ANNUAL' || req.type === 'AM_HALF' || req.type === 'PM_HALF') ? '연차' : '병가/휴가'}</span>
                        </h4>
                        <div className="mt-2 space-y-1">
                           <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-500" />
                              {req.startDate} ~ {req.endDate}
                           </p>
                           <p className="text-xs font-bold text-slate-400">신청일: {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      req.status === 'PENDING' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                      req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {req.status === 'PENDING' ? 'Decision Pending' : req.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </div>
                  </div>

                  <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex-1">
                    <p className="text-sm font-bold text-slate-600 leading-relaxed italic border-l-4 border-blue-200 pl-4">
                      "{req.reason}"
                    </p>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="p-8 flex gap-4 bg-white border-t border-slate-100">
                      <button 
                        onClick={() => handleStatusChange(req.id!, 'REJECTED')}
                        className="flex-1 py-4 bg-white border border-rose-200 text-rose-600 rounded-2xl font-black text-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                      >
                         <XCircle className="w-5 h-5" />
                         반려 처리
                      </button>
                      <button 
                        onClick={() => handleStatusChange(req.id!, 'APPROVED')}
                        className="flex-3 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                         <CheckCircle className="w-5 h-5" />
                         최종 승인하기
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminLeave;
