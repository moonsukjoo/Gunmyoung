import React, { useState, useEffect } from 'react';
import { 
  HardHat, 
  Search, 
  Filter, 
  Download, 
  Award, 
  Calendar, 
  FileCheck,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';

interface TrainingRecord {
  id: string;
  userName: string;
  userRole: string;
  courseName: string;
  completionDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
  score: number;
  instructor: string;
}

const PCAdminTraining: React.FC = () => {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTrainingRecords();
  }, []);

  const fetchTrainingRecords = async () => {
    setLoading(true);
    try {
      // In a real app, this would be a complex join or a specific collection
      const querySnapshot = await getDocs(collection(db, 'trainingRecords'));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrainingRecord[];
      setRecords(data);
    } catch (e) {
      console.error(e);
      // Dummy data for visual representation if collection empty
      if (records.length === 0) {
        setRecords([
          { id: '1', userName: '장동건', userRole: 'A공구 팀장', courseName: '2024년 상반기 고소작업 안전교육', completionDate: '2024-03-15', expiryDate: '2025-03-15', status: 'valid', score: 95, instructor: '이건명' },
          { id: '2', userName: '이순신', userRole: 'B공구 조장', courseName: '신규 입사자 기초 안전 보건 교육', completionDate: '2024-04-10', expiryDate: '2025-04-10', status: 'valid', score: 100, instructor: '김관리' },
          { id: '3', userName: '강감찬', userRole: 'C공구 기공', courseName: '밀폐 공간 작업 특별 안전 교육', completionDate: '2023-05-20', expiryDate: '2024-05-20', status: 'expiring', score: 88, instructor: '최안전' },
          { id: '4', userName: '을지문덕', userRole: '현장 지원', courseName: '응급처치 및 심폐소생술 교육', completionDate: '2023-01-10', expiryDate: '2024-01-10', status: 'expired', score: 92, instructor: '정의료' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase">이수 완료</span>;
      case 'expiring':
        return <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black uppercase">만료 예정</span>;
      case 'expired':
        return <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase">만료됨</span>;
      default:
        return null;
    }
  };

  return (
    <PCAdminLayout title="교육 및 평가 관리">
      <div className="max-w-[1600px] mx-auto space-y-10">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Training & Certification</h2>
            <p className="text-slate-500 font-medium">건명기업 임직원들의 안전 교육 이수 현황과 직무 자격을 체계적으로 관리합니다.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
              <BookOpen className="w-5 h-5" />
              신규 교육 커리큘럼 등록
            </button>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { label: '전체 교육 이수율', value: '94.2', unit: '%', sub: '필수 교육 대상자 대비', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '평균 평가 점수', value: '88.5', unit: '점', sub: '최근 6개월 상시 평가', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '만료 예정 자격', value: '12', unit: '건', sub: '30일 이내 갱신 필요', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '미이수 인원', value: '5', unit: '명', sub: '긴급 교육 대상자', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
          ].map((card, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className={`w-14 h-14 rounded-2xl ${card.bg} flex items-center justify-center ${card.color} mb-6 group-hover:scale-110 transition-transform`}>
                <card.icon className="w-7 h-7" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900">{card.value}</span>
                <span className="text-slate-400 font-black text-lg uppercase">{card.unit}</span>
              </div>
              <p className="mt-4 text-[11px] font-bold text-slate-500">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input 
              type="text" 
              placeholder="이름, 교육명, 부서로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
            />
          </div>
          <select className="px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-600">
            <option>교육 상태: 전체</option>
            <option>이수 완료</option>
            <option>만료 예정</option>
            <option>만료됨</option>
          </select>
          <button className="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-black flex items-center gap-2 hover:bg-slate-50 transition-all">
             <Download className="w-5 h-5" />
             명단 다운로드 (EXCEL)
          </button>
        </div>

        {/* Training Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">상태</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">이수 대상자</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">교육 과정명</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">이수 / 만료</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">평가 점수</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">자격증</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.filter(r => r.userName.includes(searchTerm) || r.courseName.includes(searchTerm)).map((record) => (
                <tr key={record.id} className="group hover:bg-blue-50/30 transition-all">
                  <td className="px-8 py-6">
                    {getStatusBadge(record.status)}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-sm font-black text-slate-500">
                        {record.userName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{record.userName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{record.userRole}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-bold text-slate-700">{record.courseName}</p>
                      <p className="text-[10px] font-black text-blue-600">강사: {record.instructor}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {record.completionDate}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-rose-400">
                        <Clock className="w-3 h-3" />
                        만료: {record.expiryDate}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-[100px] h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${record.score >= 90 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                          style={{ width: `${record.score}%` }} 
                        />
                      </div>
                      <span className="text-sm font-black text-slate-900">{record.score}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center">
                      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm">
                        <Award className="w-4 h-4" />
                        수료증 확인
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminTraining;
