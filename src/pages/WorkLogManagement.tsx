import React, { useState, useEffect } from 'react';
import { db } from '@/src/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, Timestamp } from 'firebase/firestore';
import { WorkLog, UserProfile, Department } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { 
  ClipboardList, 
  Search, 
  Download, 
  User as UserIcon, 
  Users, 
  Calendar,
  Clock,
  Filter,
  ArrowRight,
  ChevronLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

export const WorkLogManagement: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: format(new Date(), 'yyyy-MM-01'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    uid: 'ALL',
    departmentId: 'ALL'
  });

  useEffect(() => {
    // Load Users and Departments for filters
    const loadMetadata = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
        
        const deptsSnap = await getDocs(collection(db, 'departments'));
        setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
      } catch (error) {
        console.error('Metadata load error:', error);
      }
    };
    loadMetadata();

    const q = query(
      collection(db, 'workLogs'),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkLog));
      setLogs(allLogs);
      setLoading(false);
    }, (error) => {
      console.error('Work logs fetch error:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => {
    const dateMatch = log.date >= filters.startDate && log.date <= filters.endDate;
    const userMatch = filters.uid === 'ALL' || log.uid === filters.uid;
    const deptMatch = filters.departmentId === 'ALL' || log.departmentId === filters.departmentId;
    return dateMatch && userMatch && deptMatch;
  });

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    const exportData = filteredLogs.map(log => ({
      '일자': log.date,
      '성명': log.userName,
      '부서/팀': log.departmentName,
      '시작시간': log.startTime,
      '종료시간': log.endTime,
      '작업내용': log.content,
      '작성일시': format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '작업일지');
    XLSX.writeFile(wb, `작업일지_${filters.startDate}_to_${filters.endDate}.xlsx`);
    toast.success('엑셀 파일이 생성되었습니다.');
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
          <h1 className="text-xl font-black text-white">작업일지 관리</h1>
        </div>
        <Button 
          onClick={handleExportExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl gap-2 shadow-lg shadow-emerald-900/20"
        >
          <Download className="w-4 h-4" />
          Excel
        </Button>
      </div>

      {/* Filter Section */}
      <Card className="bg-card border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">데이터 필터링</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase">조회 기간</label>
              <div className="flex items-center gap-2">
                <Input 
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-xs font-bold"
                />
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input 
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase">부서/팀</label>
                <Select 
                  value={filters.departmentId} 
                  onValueChange={(val) => setFilters({...filters, departmentId: val})}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-xs font-bold">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                    <SelectItem value="ALL">전체</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id!}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase">대상자</label>
                <Select 
                  value={filters.uid} 
                  onValueChange={(val) => setFilters({...filters, uid: val})}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-xs font-bold">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                    <SelectItem value="ALL">전체</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.uid} value={user.uid}>{user.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <Card key={log.id} className="bg-card border-white/5 rounded-2xl overflow-hidden group hover:border-primary/20 transition-all">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{log.userName}</h4>
                      <p className="text-[10px] text-muted-foreground font-bold">{log.departmentName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1">
                      <Calendar className="w-3 h-3" />
                      {log.date}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {log.startTime} - {log.endTime}
                    </div>
                  </div>
                </div>

                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                  <p className="text-xs font-medium text-white leading-relaxed whitespace-pre-wrap">{log.content}</p>
                </div>

                <div className="flex justify-end pt-1">
                  <span className="text-[8px] font-bold text-muted-foreground opacity-30">
                    작성: {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 flex flex-col items-center gap-3">
            <ClipboardList className="w-12 h-12 text-muted-foreground opacity-20" />
            <div>
              <p className="text-sm font-black text-white opacity-40">내역이 없습니다</p>
              <p className="text-[10px] text-muted-foreground font-bold">필터를 조정하여 다른 날짜를 조회해보세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
