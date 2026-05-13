import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AttendanceLog } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  Search, 
  MapPin, 
  Clock, 
  Calendar as CalendarIcon,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  History,
  Timer
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const PCAdminAttendance: React.FC = () => {
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'attendance'),
        where('date', '==', dateFilter),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog));
      setRecords(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'pc_attendance_fetch');
      toast.error('근태 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PCAdminLayout title="근태 현황 총괄">
      <div className="max-w-[1600px] mx-auto space-y-8 text-foreground">
        {/* Statistics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: '금일 정상 출근', value: records.filter(r => r.type === 'check-in').length, unit: '건', color: 'text-emerald-500', icon: CheckCircle2 },
            { label: '지각 의심', value: '3', unit: '건', color: 'text-rose-500', icon: AlertCircle },
            { label: '연장 근무 발생', value: '12', unit: '건', color: 'text-blue-500', icon: Timer },
            { label: '총 활동 로그', value: records.length, unit: '건', color: 'text-muted-foreground', icon: History },
          ].map((stat, i) => (
            <div key={i} className="bg-card p-8 rounded-[2rem] border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${stat.color}`}>{stat.value}</span>
                <span className="text-muted-foreground font-bold text-sm uppercase">{stat.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-card p-6 rounded-[2rem] shadow-sm border border-border gap-4 text-foreground">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative">
                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="date" 
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-12 pr-4 py-3 bg-muted border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/10 cursor-pointer text-foreground"
                />
             </div>
             <div className="relative flex-1 max-w-sm group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="직원 이름으로 검색..."
                  className="w-full pl-12 pr-4 py-3 bg-muted border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all border border-transparent focus:border-primary/20 text-foreground"
                />
             </div>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-sm shadow-xl shadow-primary/10 hover:bg-primary/90 transition-all">
            <Download className="w-4 h-4" />
            전체 근태 리포트 출력
          </button>
        </div>

        {/* Attendance Table */}
        <div className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden text-foreground">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border uppercase tracking-widest text-[11px] font-black text-muted-foreground">
                <th className="px-10 py-6 text-center w-24">시간</th>
                <th className="px-6 py-6">임직원</th>
                <th className="px-6 py-6 font-center">구분</th>
                <th className="px-6 py-6">위치 / GPS</th>
                <th className="px-6 py-6">비고</th>
                <th className="px-10 py-6 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={6} className="h-20" /></tr>
                ))
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-muted-foreground font-bold">선택하신 날짜에 기록된 근태 정보가 없습니다.</td></tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-10 py-6 text-center">
                      <span className="text-sm font-black text-foreground">{record.time}</span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-xl overflow-hidden border border-border">
                           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${record.uid}`} alt="profile" />
                        </div>
                        <span className="text-sm font-black text-foreground">{record.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                       <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black border tracking-widest ${
                         record.type === 'check-in' 
                         ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                         : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                       }`}>
                         {record.type === 'check-in' ? '출근 등록' : '퇴근 기록'}
                       </span>
                    </td>
                    <td className="px-6 py-6">
                       <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                         <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                         {record.latitude ? `${record.latitude.toFixed(4)}, ${record.longitude?.toFixed(4)}` : '위치 정보 없음'}
                       </div>
                    </td>
                    <td className="px-6 py-6">
                       <span className="text-xs font-bold text-muted-foreground">-</span>
                    </td>
                    <td className="px-10 py-6 text-right">
                       <button className="p-2 hover:bg-card hover:shadow-md rounded-xl transition-all text-muted-foreground opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-5 h-5" />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminAttendance;
