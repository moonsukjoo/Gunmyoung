import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { TeamWorkLog, UserProfile, Department, IndividualWorkLog, Notification } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ClipboardList, 
  Download, 
  Users, 
  Calendar,
  Filter,
  ArrowRight,
  ChevronLeft,
  FileText,
  User as UserIcon,
  Search,
  FileBarChart,
  CheckCircle2,
  XCircle,
  Clock,
  Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportToExcel, exportToPDF } from '@/src/lib/exportUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/src/components/AuthProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export const WorkLogManagement: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'TEAM'>('PERSONAL');
  const [personalLogs, setPersonalLogs] = useState<IndividualWorkLog[]>([]);
  const [teamLogs, setTeamLogs] = useState<TeamWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [editingLog, setEditingLog] = useState<IndividualWorkLog | null>(null);
  const [editTasks, setEditTasks] = useState<{ content: string; hours: string }[]>([]);

  // Filters
  const [filters, setFilters] = useState({
    startDate: format(new Date(), 'yyyy-MM-01'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    departmentId: 'ALL',
    status: 'ALL'
  });

  const isLeaderOrHigher = profile && (
    ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'CEO', 'CLERK', 'GENERAL_AFFAIRS'].includes(profile.role) ||
    (profile.position && ['팀장', '직장', '소장', '서무', '총무', '실장'].some(p => profile.position?.includes(p)))
  );

  const canApproveAsLeader = profile && (
    ['TEAM_LEADER', 'DIRECTOR', 'CEO', 'GENERAL_MANAGER'].includes(profile.role) ||
    (profile.position && ['팀장', '직장', '소장', '실장'].some(p => profile.position?.includes(p)))
  );

  const canFinalApprove = profile && (
    ['CLERK', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CEO'].includes(profile.role) ||
    (profile.position && ['서무', '총무', '실장'].some(p => profile.position?.includes(p)))
  );

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const deptsSnap = await getDocs(collection(db, 'departments'));
        setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
      } catch (error) {
        console.error('Metadata load error:', error);
      }
    };
    loadMetadata();

    // Individual Logs
    const personalQ = query(collection(db, 'personalWorkLogs'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    const unsubPersonal = onSnapshot(personalQ, (snapshot) => {
      setPersonalLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndividualWorkLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personalWorkLogs'));

    // Team Logs (Legacy Support)
    const teamQ = query(collection(db, 'teamWorkLogs'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    const unsubTeam = onSnapshot(teamQ, (snapshot) => {
      setTeamLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamWorkLog)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teamWorkLogs');
      setLoading(false);
    });

    return () => {
      unsubPersonal();
      unsubTeam();
    };
  }, []);

  const filteredPersonal = personalLogs.filter(log => {
    const dateMatch = log.date >= filters.startDate && log.date <= filters.endDate;
    const deptFilterMatch = filters.departmentId === 'ALL' || log.departmentId === filters.departmentId;
    const statusMatch = filters.status === 'ALL' || log.status === filters.status;
    
    // Security filtering: Leaders only see their own department's logs
    // Clerks, GMs, Directors, CEO see overall
    const isGlobalAdmin = profile && ['CEO', 'GENERAL_MANAGER', 'CLERK', 'GENERAL_AFFAIRS', 'DIRECTOR'].includes(profile.role);
    const departmentMatch = isGlobalAdmin || log.departmentId === profile?.departmentId;

    return dateMatch && deptFilterMatch && statusMatch && departmentMatch;
  });

  const handleLeaderApprove = async (logId: string, log: IndividualWorkLog) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'personalWorkLogs', logId), {
        status: 'LEADER_APPROVED',
        approvedByLeaderUid: profile.uid,
        approvedByLeaderName: profile.displayName,
        approvedByLeaderAt: new Date().toISOString()
      });

      // Notify Clerks/General Affairs
      const clerksQ = query(collection(db, 'users'), where('role', 'in', ['CLERK', 'GENERAL_AFFAIRS']));
      const clerksSnap = await getDocs(clerksQ);
      
      const notifications = clerksSnap.docs.map(clerk => ({
        uid: clerk.id,
        title: '신규 작업일지 결재 알림',
        message: `${log.userName}님의 작업일지를 팀장(${profile.displayName})이 결재하였습니다. 최종 확인 바랍니다.`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString(),
        fromUid: profile.uid,
        fromName: profile.displayName
      }));

      for (const n of notifications) {
        await addDoc(collection(db, 'notifications'), n);
      }

      toast.success('팀장 결재가 완료되었습니다. 전사 관리자에게 알림이 전송되었습니다.');
    } catch (error) {
      toast.error('결재 진행 중 오류가 발생했습니다.');
    }
  };

  const handleFinalApprove = async (logId: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'personalWorkLogs', logId), {
        status: 'FINAL_APPROVED',
        approvedByClerkUid: profile.uid,
        approvedByClerkName: profile.displayName,
        approvedByClerkAt: new Date().toISOString()
      });
      toast.success('최종 승인이 완료되었습니다.');
    } catch (error) {
      toast.error('승인 진행 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateLog = async () => {
    if (!editingLog || !profile) return;
    try {
      await updateDoc(doc(db, 'personalWorkLogs', editingLog.id), {
        tasks: editTasks,
        updatedByUid: profile.uid,
        updatedByName: profile.displayName,
        updatedAt: new Date().toISOString()
      });
      toast.success('작업 내용이 수정되었습니다.');
      setEditingLog(null);
    } catch (error) {
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleExportExcel = () => {
    const logsToExport = activeTab === 'PERSONAL' ? filteredPersonal : teamLogs;
    if (logsToExport.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];
    if (activeTab === 'PERSONAL') {
      filteredPersonal.forEach(log => {
        exportData.push({
          '일자': log.date,
          '부서/팀': log.departmentName,
          '성명': log.userName,
          '작업내용': log.tasks.map(t => `${t.content}(${t.hours}H)`).join(' | '),
          '퇴근시간': log.clockOutTime,
          '상태': log.status === 'FINAL_APPROVED' ? '최종승인' : log.status === 'LEADER_APPROVED' ? '팀장확인' : '대기',
          '팀장결재': log.approvedByLeaderName || '-',
          '최종승인': log.approvedByClerkName || '-'
        });
      });
    }

    exportToExcel(exportData, `작업일지통합보고서_${filters.startDate}_to_${filters.endDate}`, '작업일지');
  };

  return (
    <div className="space-y-6 pb-24 px-1 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white/5 shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white whitespace-nowrap">작업일지 관리</h1>
            <p className="text-[10px] sm:text-xs font-bold text-white/40 uppercase tracking-wider">Work Log Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl gap-2 h-12 shadow-lg shadow-emerald-900/20 text-[10px] sm:text-sm px-4"
          >
            <Download className="w-4 h-4" />
            통합 보고서 (EXCEL)
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.print()}
            className="bg-white/5 border-white/10 text-white font-black rounded-2xl gap-2 h-12 px-4"
          >
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-white/5 p-1 rounded-2xl flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab('PERSONAL')}
          className={`flex-1 px-6 py-3 rounded-xl transition-all font-black text-xs flex items-center justify-center gap-2 ${
            activeTab === 'PERSONAL' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:bg-white/5'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          개별 작업일지 (결재)
        </button>
        <button
          onClick={() => setActiveTab('TEAM')}
          className={`flex-1 px-6 py-3 rounded-xl transition-all font-black text-xs flex items-center justify-center gap-2 ${
            activeTab === 'TEAM' ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          팀 일괄작업일지
        </button>
      </div>

      {/* Filter Section */}
      <Card className="bg-white/5 border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <CardContent className="p-8 space-y-8">
          <div className="flex items-center gap-3 text-primary">
            <Filter className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Data Filter Console</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/30 ml-1 uppercase">조회 기간</label>
              <div className="flex items-center gap-2">
                <Input 
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-12 text-sm font-bold"
                />
                <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                <Input 
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-12 text-sm font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/30 ml-1 uppercase">부서 / 팀</label>
              <Select 
                value={filters.departmentId} 
                onValueChange={(val) => setFilters({...filters, departmentId: val})}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-12 text-sm font-bold">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                  <SelectItem value="ALL">전체 부서</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id!}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/30 ml-1 uppercase">승인 상태</label>
              <Select 
                value={filters.status} 
                onValueChange={(val) => setFilters({...filters, status: val})}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-12 text-sm font-bold">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                  <SelectItem value="ALL">전체 상태</SelectItem>
                  <SelectItem value="PENDING">대기중</SelectItem>
                  <SelectItem value="LEADER_APPROVED">팀장확인</SelectItem>
                  <SelectItem value="FINAL_APPROVED">최종승인</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-black text-white flex items-center gap-3">
             <ClipboardList className="w-6 h-6 text-primary" />
             일지 결재 내역
             <Badge className="bg-primary/20 text-primary border-none font-black ml-2">{filteredPersonal.length}</Badge>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeTab === 'PERSONAL' ? (
            filteredPersonal.map((log) => (
              <Card key={log.id} className="bg-white/5 border-white/10 rounded-3xl overflow-hidden hover:bg-white/[0.08] transition-all group">
                <div className="p-6 space-y-6">
                  {/* ... same log content ... */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                        <UserIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white">{log.userName}</h4>
                        <p className="text-xs font-bold text-white/40">{log.departmentName} | {log.date}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest ${
                      log.status === 'FINAL_APPROVED' ? 'bg-emerald-500/20 text-emerald-500' :
                      log.status === 'LEADER_APPROVED' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-amber-500/20 text-amber-500'
                    }`}>
                      {log.status === 'FINAL_APPROVED' ? '최종완료' : log.status === 'LEADER_APPROVED' ? '팀장결재' : '대기중'}
                    </div>
                  </div>

                  <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                    {log.tasks.map((task, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-white/60 font-medium">• {task.content}</span>
                        <span className="text-primary font-black ml-4">{task.hours}H</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/10 flex justify-between items-center mt-2">
                      <span className="text-[10px] font-black text-white/30 uppercase">Today Store Out</span>
                      <span className="text-sm font-black text-white flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-white/40" />
                        {log.clockOutTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 bg-white/5 rounded-xl text-[10px] font-bold text-white/20">
                    <div className="flex-1">
                      <p className="uppercase mb-1">팀장 결재</p>
                      <p className="text-white/60">{log.approvedByLeaderName || '미결재'}</p>
                    </div>
                    <div className="flex-1">
                      <p className="uppercase mb-1">최종 승인</p>
                      <p className="text-white/60">{log.approvedByClerkName || '미승인'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {log.status === 'PENDING' && canApproveAsLeader && (
                      <Button 
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl h-12 gap-2"
                        onClick={() => handleLeaderApprove(log.id, log)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        팀장 결재
                      </Button>
                    )}
                    {log.status === 'LEADER_APPROVED' && canFinalApprove && (
                      <Button 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-12 gap-2"
                        onClick={() => handleFinalApprove(log.id)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        최종 승인 (서무)
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setEditingLog(log);
                        setEditTasks([...log.tasks]);
                      }}
                      className="flex-1 text-white/20 hover:text-white hover:bg-white/10 font-bold rounded-2xl h-12"
                    >
                      내용 수정
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            teamLogs.map((log) => (
              <Card key={log.id} className="bg-white/5 border-white/10 rounded-2xl overflow-hidden p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="text-sm font-black text-white">{log.teamName}</h4>
                      <p className="text-[10px] text-white/40">{log.date} 일지</p>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-white/60">
                   {log.entries.length}명의 대원 작업 내용이 기록됨
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      {/* Edit Dialog */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{editingLog?.userName} 작업일지 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editTasks.map((task, idx) => (
              <div key={idx} className="flex gap-2">
                <Input 
                  value={task.content}
                  onChange={(e) => {
                    const newTasks = [...editTasks];
                    newTasks[idx].content = e.target.value;
                    setEditTasks(newTasks);
                  }}
                  className="bg-white/5 border-white/10 rounded-xl"
                  placeholder="작업 내용"
                />
                <div className="w-20 relative">
                  <Input 
                    value={task.hours}
                    onChange={(e) => {
                      const newTasks = [...editTasks];
                      newTasks[idx].hours = e.target.value;
                      setEditTasks(newTasks);
                    }}
                    className="bg-white/5 border-white/10 text-center rounded-xl pr-6 font-bold"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-black">H</span>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingLog(null)} className="rounded-xl font-bold">취소</Button>
            <Button onClick={handleUpdateLog} className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl px-8">수정 완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
