import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Layout } from '../components/Layout';
import { 
  FileBox, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  FileText, 
  Table as TableIcon,
  Users,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  History,
  Building2,
  FileSpreadsheet,
  Clock,
  File as FileIcon,
  HeartPulse
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';
import { motion } from 'motion/react';

type ReportType = 'EMPLOYEES' | 'ATTENDANCE' | 'TRAINING' | 'LEAVE' | 'ACCIDENTS' | 'HEALTH' | 'EVACUATION' | 'REDEMPTION';

const UnifiedReportCenter: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('ATTENDANCE');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [targetName, setTargetName] = useState('');
  const [targetDept, setTargetDept] = useState('ALL');
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepts = async () => {
      const snap = await getDocs(collection(db, 'departments'));
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchDepts();
  }, []);

  const handleExport = async (formatType: 'EXCEL' | 'PDF') => {
    setLoading(true);
    try {
      let data: any[] = [];
      let collectionName = '';
      let title = '';
      
      switch (reportType) {
        case 'ATTENDANCE':
          collectionName = 'attendance';
          title = '근태 관리 보고서';
          break;
        case 'EMPLOYEES':
          collectionName = 'users';
          title = '임직원 명부';
          break;
        case 'TRAINING':
          collectionName = 'trainingResults';
          title = '교육 이수 현황';
          break;
        case 'LEAVE':
          collectionName = 'leaveRequests';
          title = '연차/휴가 사용 내역';
          break;
        case 'ACCIDENTS':
          collectionName = 'accidentCases';
          title = '사고/아차사고 사례 보고';
          break;
        case 'HEALTH':
          collectionName = 'healthReports';
          title = '보건 이상무 보고 내역';
          break;
        case 'EVACUATION':
          collectionName = 'evacuations';
          title = '비상 대피 이력';
          break;
        case 'REDEMPTION':
          collectionName = 'redemptionRequests';
          title = '포인트 환전/지급 내역';
          break;
      }

      const q = query(collection(db, collectionName), limit(500));
      const snap = await getDocs(q);
      data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Apply Filters
      if (reportType !== 'EMPLOYEES') {
        data = data.filter(item => {
          const date = item.date || item.createdAt || item.activatedAt || item.startDate;
          if (!date) return true;
          const itemDate = date.includes('T') ? date.split('T')[0] : date;
          return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
      }

      if (targetName) {
        data = data.filter(item => {
          const name = item.userName || item.displayName || item.authorName || item.activatedByName || item.reportedBy;
          return name?.toLowerCase().includes(targetName.toLowerCase());
        });
      }

      if (targetDept !== 'ALL') {
        data = data.filter(item => {
          const deptId = item.departmentId || item.teamId;
          const deptName = item.departmentName || item.teamName;
          return deptId === targetDept || deptName === targetDept;
        });
      }

      if (data.length === 0) {
        toast.error('선택한 조건에 맞는 데이터가 없습니다.');
        return;
      }

      // Format Data for export
      const formattedData = formatDataForExport(reportType, data);

      if (formatType === 'EXCEL') {
        exportToExcel(formattedData, `${title}_${format(new Date(), 'yyyyMMdd')}`, 'Sheet1');
        toast.success('엑셀 다운로드가 시작되었습니다.');
      } else {
        const headers = Object.keys(formattedData[0]);
        const rows = formattedData.map(obj => Object.values(obj));
        await exportToPDF(title, headers, rows, `${title}_${format(new Date(), 'yyyyMMdd')}`);
        toast.success('PDF 리포트가 생성되었습니다.');
      }

    } catch (error) {
      console.error(error);
      toast.error('보고서 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDataForExport = (type: ReportType, rawData: any[]) => {
    switch (type) {
      case 'ATTENDANCE':
        return rawData.map(d => ({
          '날짜': d.date,
          '성명': d.userName || d.uid,
          '출근시간': d.clockIn || '-',
          '퇴근시간': d.clockOut || '-',
          '상태': d.status,
          '메모': d.memo || ''
        }));
      case 'EMPLOYEES':
        return rawData.map(d => ({
          '사번': d.employeeId,
          '성명': d.displayName,
          '부서': d.departmentName || '-',
          '직급': d.position || '-',
          '직종': d.jobRole || '-',
          '연락처': d.phoneNumber || '-',
          '입사일': d.joinedAt || (d.createdAt ? format(new Date(d.createdAt), 'yyyy-MM-dd') : '-')
        }));
      case 'HEALTH':
        return rawData.map(d => ({
          '날짜': d.date,
          '부서': d.teamName,
          '보고자': d.authorName,
          '상태': d.status,
          '내용': d.content
        }));
      case 'ACCIDENTS':
        return rawData.map(d => ({
          '날짜': d.date,
          '제목': d.title,
          '장소': d.location,
          '위험도': d.severity,
          '유형': d.type,
          '보고자': d.reportedBy
        }));
      case 'TRAINING':
        return rawData.map(d => ({
          '교육명': d.trainingTitle,
          '성명': d.userName,
          '점수': d.score,
          '합격여부': d.isPassed ? '합격' : '불합격',
          '완료일': d.completedAt ? format(new Date(d.completedAt), 'yyyy-MM-dd HH:mm') : '-'
        }));
      case 'LEAVE':
        return rawData.map(d => ({
          '성명': d.displayName,
          '유형': d.type,
          '시작일': d.startDate,
          '종료일': d.endDate,
          '사유': d.reason,
          '상태': d.status
        }));
      default:
        return rawData;
    }
  };

  const menuItems = [
    { id: 'ATTENDANCE', label: '근태 보고서', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'EMPLOYEES', label: '임직원 명부', icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'HEALTH', label: '보건 이상무 보고', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'ACCIDENTS', label: '사고/안전 사례', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'TRAINING', label: '교육 이수 현황', icon: ClipboardList, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'LEAVE', label: '연차/휴가 내역', icon: Calendar, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { id: 'EVACUATION', label: '비상 대피 이력', icon: History, color: 'text-slate-500', bg: 'bg-slate-500/10' },
    { id: 'REDEMPTION', label: '포인트 환전', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ];

  return (
    <Layout>
      <div className="p-4 space-y-6 pb-24">
        {/* Header */}
        <header className="flex flex-col gap-1 px-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <FileBox className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-black text-white">통합 보고서 관리</h2>
          </div>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1 ml-9">Unified Reporting & Export Center</p>
        </header>

        {/* Report Type Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setReportType(item.id as ReportType)}
              className={`p-4 rounded-[1.5rem] border transition-all flex flex-col items-center gap-2 ${
                reportType === item.id 
                  ? 'bg-white/10 border-primary/50 shadow-lg' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}
            >
              <div className={`p-2 ${item.bg} rounded-xl`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <span className={`text-[11px] font-black ${reportType === item.id ? 'text-white' : 'text-white/40'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Filters Card */}
        <Card className="bg-white/5 border-white/5 rounded-[2rem] overflow-hidden">
          <CardHeader className="p-6 border-b border-white/5 bg-white/5">
            <CardTitle className="text-sm font-black text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              보고서 상세 조건 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Date Filters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">조회 기간 (시작)</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input 
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="bg-black/20 border-white/5 h-12 pl-12 rounded-xl text-white font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">조회 기간 (종료)</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input 
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="bg-black/20 border-white/5 h-12 pl-12 rounded-xl text-white font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Name & Dept Filters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">대상 성명 (검색어)</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input 
                      placeholder="성명 검색..."
                      value={targetName}
                      onChange={(e) => setTargetName(e.target.value)}
                      className="bg-black/20 border-white/5 h-12 pl-12 rounded-xl text-white font-bold placeholder:text-white/10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">대상 부서/팀</label>
                  <Select value={targetDept} onValueChange={setTargetDept}>
                    <SelectTrigger className="bg-black/20 border-white/5 h-12 rounded-xl text-white font-bold text-xs ring-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-white/30" />
                        <SelectValue placeholder="전체 부서" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="ALL">전체 부서</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => handleExport('EXCEL')}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-14 gap-2 text-base transition-all active:scale-95"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileSpreadsheet className="w-6 h-6" />}
                Excel 추출하기
              </Button>
              <Button 
                onClick={() => handleExport('PDF')}
                disabled={loading}
                variant="outline"
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl h-14 gap-2 text-base transition-all active:scale-95"
              >
                {loading ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <FileText className="w-6 h-6 text-rose-500" />}
                PDF 리포트 생성
              </Button>
            </div>
            
            <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3">
              <FileIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-black text-white/80 tracking-tight">보고서 생성 안내</p>
                <p className="text-[10px] font-bold text-white/40 leading-relaxed">
                  필터링 조건에 따라 최대 500건의 데이터를 추출합니다. 데이터가 많은 경우 기간을 좁게 설정하여 추출해 주세요.
                  성명 및 부서 필터는 선택 사항이며, 입력 시 해당 조건에 맞는 데이터만 포함됩니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default UnifiedReportCenter;
