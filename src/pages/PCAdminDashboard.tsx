import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  CalendarDays, 
  ShieldCheck, 
  TrendingUp, 
  LayoutDashboard,
  History,
  AlertTriangle,
  Timer,
  Bell,
  Settings,
  Trophy,
  ClipboardList,
  HardHat,
  CircleDollarSign
} from 'lucide-react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { useNavigate } from 'react-router-dom';

const PCAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingLeaves: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const leavesSnap = await getDocs(query(collection(db, 'leaveRequests'), limit(100)));
      
      setStats({
        totalEmployees: usersSnap.size,
        pendingLeaves: leavesSnap.docs.filter(d => d.data().status === 'pending').length,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const quickActions = [
    { id: 'personnel', label: '임직원 정보 관리', icon: Users, to: '/admin/pc/personnel' },
    { id: 'attendance', label: '근태 현황 총괄', icon: Clock, to: '/admin/pc/attendance' },
    { id: 'leave', label: '연차/휴가 결재', icon: CalendarDays, to: '/admin/pc/leave' },
    { id: 'payslip', label: '급여명세서 발행', icon: CircleDollarSign, to: '/admin/pc/payslip' },
    { id: 'safety', label: '안전지수 설정', icon: ShieldCheck, to: '/admin/pc/safety' },
    { id: 'worklog', label: '작업일지 총괄', icon: ClipboardList, to: '/admin/pc/worklog' },
    { id: 'training', label: '교육/평가 현황', icon: HardHat, to: '/admin/pc/training' },
    { id: 'notice', label: '공지사항 관리', icon: Bell, to: '/admin/pc/notices' },
  ];

  return (
    <PCAdminLayout title="통합 관제 센터">
      <div className="max-w-[1600px] mx-auto space-y-10">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">건명기업 Enterprise Overview</h1>
            <p className="text-slate-500 text-lg font-medium">관리자님, 건명기업의 실시간 운영 현황입니다.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all">전체 리포트 생성</button>
            <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-lg shadow-slate-900/10 hover:bg-slate-800 hover:translate-y-[-2px] transition-all flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              긴급 제어 모드
            </button>
          </div>
        </header>

        {/* KPI Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: '활성 임직원', value: stats.totalEmployees, unit: '명', sub: '전체 인적 자원 내역', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100/50' },
            { label: '금일 가동률', value: '98.4', unit: '%', sub: '출근 인원 및 장비 가동 수치', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-100/50' },
            { label: '미결재 서류', value: stats.pendingLeaves, unit: '건', sub: '연차/휴가 결재 대기 중', icon: CalendarDays, color: 'text-amber-600', bg: 'bg-amber-100/50' },
            { label: '종합 안전 지수', value: '96.8', unit: '점', sub: '무재해 365일 달성 중', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-100/50' },
          ].map((card, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden relative">
              <div className={`w-16 h-16 rounded-[1.5rem] ${card.bg} flex items-center justify-center mb-6 ${card.color} group-hover:scale-110 transition-transform`}>
                <card.icon className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">{card.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-slate-900 tracking-tighter">{card.value}</span>
                <span className="text-slate-400 font-black text-xl uppercase">{card.unit}</span>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-black text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl w-fit">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                {card.sub}
              </div>
              <div className={`absolute top-0 right-0 w-24 h-24 ${card.bg} opacity-[0.03] rounded-bl-full`} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 flex flex-col gap-10">
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">서비스 통합 제어관</h3>
                </div>
                <span className="text-xs font-black text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-100">QUICK ACCESS PANEL</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 p-10">
                {quickActions.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => navigate(item.to)}
                    className="flex flex-col items-center justify-center p-8 rounded-[2rem] border border-slate-100 hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg hover:shadow-blue-500/5 transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <item.icon className="w-8 h-8 text-slate-600 group-hover:text-blue-600" />
                    </div>
                    <span className="text-sm font-black text-slate-800 group-hover:text-blue-700 transition-colors">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20 ring-1 ring-white/10">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-blue-500/30">
                   AI Intelligence Active
                </div>
                <h2 className="text-4xl font-black mb-6 leading-tight tracking-tight">모든 관리 도구가<br/>하나의 공간에 집약되었습니다.</h2>
                <p className="text-slate-400 text-lg font-medium mb-10 leading-relaxed">
                  모바일 전용으로 구성된 모든 기능을 이제 대화면 PC에서도 자유롭게 통제하십시오. 
                  실시간 동기화를 통해 현장의 모든 상황을 한눈에 파악할 수 있으며, 
                  고효율 업무 처리를 위한 전용 단축 메뉴가 제공됩니다.
                </p>
                <div className="flex items-center gap-4">
                  <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-500 hover:scale-105 transition-all shadow-xl shadow-blue-600/20">
                    데이터 센터 상세 분석
                  </button>
                  <button className="px-8 py-4 bg-white/5 text-white rounded-2xl font-black text-sm hover:bg-white/10 transition-all border border-white/10">
                    사용자 가이드 확인
                  </button>
                </div>
              </div>
              <ShieldCheck className="absolute -right-20 -bottom-20 w-96 h-96 text-white/[0.03] rotate-12" />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-10">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm flex flex-col h-fit">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-3">
                   <History className="w-6 h-6 text-blue-600" />
                   운영 체제 실시간 로그
                </h3>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                   <span className="text-[10px] font-black text-slate-400 uppercase">Live</span>
                </div>
              </div>
              <div className="divide-y divide-slate-50 overflow-y-auto max-h-[500px] custom-scrollbar">
                {[
                  { msg: '관리자님께서 급여명세서를 일괄 발행했습니다.', time: '2분 전', type: 'payslip', user: 'System' },
                  { msg: '안전 관리자(이성민)님이 작업 현황을 업데이트했습니다.', time: '15분 전', type: 'safety', user: 'Manager' },
                  { msg: '시스템에 새로운 공지사항이 등록되었습니다.', time: '1시간 전', type: 'notice', user: 'Admin' },
                  { msg: '장동건 사원이 연차 신청서를 제출했습니다.', time: '3시간 전', type: 'leave', user: 'Employee' },
                  { msg: '현물 신청(커피쿠폰) 12건이 승인 대기 중입니다.', time: '5시간 전', type: 'redemption', user: 'System' },
                  { msg: '서해 6공구 고소작업 모니터링이 시작되었습니다.', time: '8시간 전', type: 'highwork', user: 'Safety' },
                ].map((log, i) => (
                  <div key={i} className="px-8 py-6 flex gap-5 items-start hover:bg-blue-50/30 transition-all group">
                    <div className="w-1.5 h-12 rounded-full bg-slate-100 group-hover:bg-blue-500 transition-colors shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{log.user}</span>
                        <span className="text-[10px] text-slate-400 font-bold tracking-tight">{log.time}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 leading-relaxed font-sans">{log.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-5 bg-slate-50 text-slate-500 font-black text-xs hover:bg-slate-100 transition-colors uppercase tracking-widest border-t border-slate-100">
                 전체 시스템 로그 아카이브 조회
              </button>
            </div>

            <div className="bg-rose-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-rose-600/20 ring-1 ring-white/20 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-xl">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-black text-xl tracking-tight">고위험 현장 실시간 알람</span>
                </div>
                <div className="space-y-4">
                  <div className="p-5 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div className="flex justify-between items-start mb-2">
                       <p className="text-xs font-black text-white/60">오후 2시 예정</p>
                       <span className="bg-white text-rose-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">Action Needed</span>
                    </div>
                    <p className="text-sm font-black leading-snug">
                      H-3 구역 대형 크레인 인근 고소 작업이 예정되어 있습니다. 현장 안전 수칙 준수 여부를 최종 확인 바랍니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminDashboard;
