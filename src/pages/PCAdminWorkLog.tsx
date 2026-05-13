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
  Clock,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { TeamWorkLog } from '../types';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';

const PCAdminWorkLog: React.FC = () => {
  const [logs, setLogs] = useState<TeamWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTeam, setSelectedTeam] = useState('전체');
  const [selectedLog, setSelectedLog] = useState<TeamWorkLog | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'teamWorkLogs'), 
      where('date', '==', selectedDate),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamWorkLog[];
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const filteredLogs = logs.filter(log => selectedTeam === '전체' || log.teamName.includes(selectedTeam));

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const exportData: any[] = [];
    filteredLogs.forEach(log => {
      log.entries.forEach(entry => {
        exportData.push({
          '날짜': log.date,
          '팀이름': log.teamName,
          '성명': entry.userName,
          '작업1': entry.tasks[0]?.content || '',
          '시간1': entry.tasks[0]?.hours || '',
          '작업2': entry.tasks[1]?.content || '',
          '시간2': entry.tasks[1]?.hours || '',
          '작업3': entry.tasks[2]?.content || '',
          '시간3': entry.tasks[2]?.hours || '',
          '퇴근시간': entry.clockOutTime,
          '작성자': log.createdByUserName
        });
      });
    });

    import('../lib/exportUtils').then(m => {
      m.exportToExcel(exportData, `팀별작업현황_${selectedDate}`, '작업일지');
      toast.success('엑셀 파일이 다운로드되었습니다.');
    });
  };

  return (
    <PCAdminLayout title="작업일지 총괄 관리">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-600 font-black text-xs uppercase tracking-widest">
               <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
               Daily Reporting System
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">팀별 일일 작업일지</h2>
            <p className="text-slate-500 font-medium">실시간으로 보고되는 각 팀의 작업 내역과 인원 투입 현황을 통합 관리합니다.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleExportExcel}
              className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              <Download className="w-5 h-5" />
              엑셀 리포트 출력
            </button>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white p-8 rounded-[2rem] border-slate-200 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
               <Users className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">보고된 총 인원</p>
               <p className="text-4xl font-black text-slate-900">
                 {filteredLogs.reduce((acc, log) => acc + log.entries.length, 0)}<span className="text-lg font-bold text-slate-400 ml-1">명</span>
               </p>
            </div>
          </Card>
          <Card className="bg-white p-8 rounded-[2rem] border-slate-200 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
               <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">보고 완료 팀</p>
               <p className="text-4xl font-black text-slate-900">{filteredLogs.length}<span className="text-lg font-bold text-slate-400 ml-1">팀</span></p>
            </div>
          </Card>
          <Card className="bg-white p-8 rounded-[2rem] border-slate-200 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
               <Clock className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">평균 퇴근 보고</p>
               <p className="text-4xl font-black text-slate-900">18:00</p>
            </div>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">조회 일자</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">팀 필터</label>
            <div className="flex gap-2">
              {['전체', '대조', '곡직', '크레인'].map(sec => (
                <button
                  key={sec}
                  onClick={() => setSelectedTeam(sec)}
                  className={`px-6 py-3 rounded-xl text-sm font-black transition-all ${
                    selectedTeam === sec 
                    ? 'bg-slate-900 text-white shadow-lg' 
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 ml-auto flex-1 max-w-sm">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">직원 검색</label>
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                <input 
                  type="text" 
                  placeholder="직원명으로 필터링..."
                  className="w-full pl-12 pr-6 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
                />
             </div>
          </div>
        </div>

        {/* WorkLog Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-[400px] bg-slate-100 animate-pulse rounded-[2.5rem]" />
            ))
          ) : filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <Card key={log.id} className="bg-white rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-900 shadow-sm border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Users className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{log.teamName}</h3>
                      <p className="text-xs font-bold text-slate-400">작성자: {log.createdByUserName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-100 text-[10px] font-black text-blue-600 mb-2">
                       <Calendar className="w-3 h-3" />
                       {log.date}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SUBMITTED AT {format(new Date(log.createdAt), 'HH:mm')}</p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase w-[100px]">성명</TableHead>
                        <TableHead className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">상세 작업 내역</TableHead>
                        <TableHead className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase w-[80px] text-center">퇴근</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {log.entries.map((entry, idx) => (
                        <TableRow key={idx} className="border-slate-50 hover:bg-slate-50/30 transition-colors">
                          <TableCell className="px-8 py-4">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                  {entry.userName.charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-slate-800">{entry.userName}</span>
                             </div>
                          </TableCell>
                          <TableCell className="px-8 py-4 italic">
                             <div className="space-y-1.5">
                               {entry.tasks.map((t, tIdx) => (
                                 <div key={tIdx} className="flex items-center justify-between group/task">
                                   <span className="text-xs text-slate-600 font-medium line-clamp-1 flex-1">• {t.content}</span>
                                   <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded ml-2 shrink-0">{t.hours}H</span>
                                 </div>
                               ))}
                             </div>
                          </TableCell>
                          <TableCell className="px-8 py-4 text-center">
                            <span className="text-[10px] font-black text-slate-400">{entry.clockOutTime}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="p-6 bg-slate-50/20 border-t border-slate-50 flex justify-between items-center">
                  <div className="flex -space-x-2">
                    {log.entries.slice(0, 5).map((e, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {e.userName.charAt(0)}
                      </div>
                    ))}
                    {log.entries.length > 5 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-800 flex items-center justify-center text-[10px] font-black text-white">
                        +{log.entries.length - 5}
                      </div>
                    )}
                  </div>
                  <Dialog>
                    <DialogTrigger render={
                      <button className="text-blue-600 font-black text-xs flex items-center gap-1 hover:underline">
                        전체 보기 <ChevronRight className="w-4 h-4" />
                      </button>
                    } />
                    <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none">
                      <DialogHeader className="p-8 bg-slate-900 text-white">
                        <DialogTitle className="text-2xl font-black">{log.teamName} 상세 작업일지</DialogTitle>
                        <p className="text-slate-400 font-medium">{log.date} 일자 보고서</p>
                      </DialogHeader>
                      <div className="p-8 max-h-[70vh] overflow-y-auto">
                        <Table>
                           <TableHeader>
                             <TableRow className="border-slate-100">
                               <TableHead className="font-black text-xs">NO</TableHead>
                               <TableHead className="font-black text-xs">성명</TableHead>
                               <TableHead className="font-black text-xs">작업 내역 1</TableHead>
                               <TableHead className="font-black text-xs">작업 내역 2</TableHead>
                               <TableHead className="font-black text-xs">작업 내역 3</TableHead>
                               <TableHead className="font-black text-xs text-center">퇴근</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {log.entries.map((entry, idx) => (
                               <TableRow key={idx} className="border-slate-50">
                                 <TableCell className="text-xs font-bold text-slate-400">{idx + 1}</TableCell>
                                 <TableCell className="text-sm font-black text-slate-900">{entry.userName}</TableCell>
                                 <TableCell className="text-xs text-slate-600">{entry.tasks[0]?.content || '-'} ({entry.tasks[0]?.hours || '0'}H)</TableCell>
                                 <TableCell className="text-xs text-slate-600">{entry.tasks[1]?.content || '-'} ({entry.tasks[1]?.hours || '0'}H)</TableCell>
                                 <TableCell className="text-xs text-slate-600">{entry.tasks[2]?.content || '-'} ({entry.tasks[2]?.hours || '0'}H)</TableCell>
                                 <TableCell className="text-sm font-black text-slate-900 text-center">{entry.clockOutTime}</TableCell>
                               </TableRow>
                             ))}
                           </TableBody>
                        </Table>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-32 flex flex-col items-center gap-6 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
               <ClipboardList className="w-20 h-20 text-slate-200" />
               <div className="text-center">
                 <p className="text-xl font-black text-slate-400">등록된 작업일지가 없습니다.</p>
                 <p className="text-sm text-slate-300 font-bold">다른 날짜를 선택하거나 팀 필터를 변경해보세요.</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminWorkLog;
