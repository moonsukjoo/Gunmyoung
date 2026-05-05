import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  HardHat,
  MapPin,
  Clock
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';

interface DailyLog {
  id: string;
  date: string;
  section: string;
  subSection: string;
  workType: string;
  workersCount: number;
  leaderName: string;
  status: 'completed' | 'in-progress' | 'pending';
  mainAchievement: string;
  safetyIssue: string;
  createdAt: any;
}

const PCAdminWorkLog: React.FC = () => {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSection, setSelectedSection] = useState('전체');

  useEffect(() => {
    fetchLogs();
  }, [selectedDate, selectedSection]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'workLogs'), 
        where('date', '==', selectedDate),
        orderBy('createdAt', 'desc')
      );
      
      if (selectedSection !== '전체') {
        q = query(q, where('section', '==', selectedSection));
      }

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DailyLog[];
      setLogs(data);
    } catch (e) {
      console.warn("Index not ready for workLogs, falling back", e);
      // Fallback if index not ready
      try {
         const qFallback = query(collection(db, 'workLogs'), where('date', '==', selectedDate));
         const snap = await getDocs(qFallback);
         setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DailyLog[]);
      } catch (e2) {
         toast.error('작업일지를 불러오는 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase">완료</span>;
      case 'in-progress':
        return <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase">진행 중</span>;
      default:
        return <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black uppercase">대기</span>;
    }
  };

  const handleExportExcel = () => {
    if (logs.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const exportData = logs.map(log => ({
      '상태': log.status === 'completed' ? '완료' : log.status === 'in-progress' ? '진행 중' : '대기',
      '날짜': log.date,
      '공구': log.section,
      '세부공구': log.subSection,
      '공정명': log.workType,
      '인원수': log.workersCount,
      '팀장': log.leaderName,
      '주요성과': log.mainAchievement,
      '특이사항': log.safetyIssue || '없음'
    }));

    import('../lib/exportUtils').then(m => {
      m.exportToExcel(exportData, `일일작업현황_${selectedDate}_${selectedSection}`, '작업일지');
      toast.success('엑셀 파일이 다운로드되었습니다.');
    });
  };

  return (
    <PCAdminLayout title="작업일지 총괄 관리">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Daily Operation Logs</h2>
            <p className="text-slate-500 font-medium">건명기업 각 현장의 일일 작업 기록 및 자원 투입 현황을 확인합니다.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleExportExcel}
              className="px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download className="w-5 h-5" />
              일일 통합 리포트 출력
            </button>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
               <Users className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">총 투입 인원</p>
               <p className="text-3xl font-black text-slate-900">{logs.reduce((acc, log) => acc + (log.workersCount || 0), 0)}명</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
               <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">완료된 공정</p>
               <p className="text-3xl font-black text-slate-900">{logs.filter(l => l.status === 'completed').length}건</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
               <AlertCircle className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">보고된 특이사항</p>
               <p className="text-3xl font-black text-slate-900">{logs.filter(l => l.safetyIssue).length}건</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {['전체', 'A공구', 'B공구', 'C공구', '기타'].map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-6 py-3 rounded-xl text-sm font-black transition-all ${
                  selectedSection === sec 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' 
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
          <div className="ml-auto relative flex-1 max-w-sm group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input 
              type="text" 
              placeholder="검색어 입력 (팀장명, 공정명...)"
              className="w-full pl-12 pr-6 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
            />
          </div>
        </div>

        {/* WorkLog Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">상태</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">일시 / 현장</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">대표 공정</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">주요 성과</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">투입 인원</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">특이사항</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">조회</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-8 py-8 bg-slate-50/20" />
                    </tr>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="group hover:bg-blue-50/30 transition-all cursor-default">
                      <td className="px-8 py-6 uppercase tracking-widest">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-slate-900">{log.section} {log.subSection}</span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                             <Clock className="w-3 h-3" />
                             {log.date}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-700">{log.workType}</span>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600">
                             <MapPin className="w-3 h-3" />
                             {log.leaderName} 팀장
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-medium text-slate-500 max-w-[200px] truncate">{log.mainAchievement}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-black text-slate-900">{log.workersCount}</span>
                           <span className="text-[10px] font-bold text-slate-400">MEMBERS</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {log.safetyIssue ? (
                          <div className="flex items-center gap-2 text-rose-500">
                             <AlertCircle className="w-4 h-4" />
                             <span className="text-xs font-black truncate max-w-[150px]">{log.safetyIssue}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 font-medium">특이사항 없음</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          <button className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <ClipboardList className="w-16 h-16 text-slate-100" />
                        <p className="text-slate-400 font-bold text-lg">해당 날짜의 작업일지가 존재하지 않습니다.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminWorkLog;
