import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, deleteDoc, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Payslip } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  FileText, 
  Upload, 
  Download, 
  Search, 
  Trash2, 
  Eye, 
  Printer, 
  FileSpreadsheet,
  CheckCircle2,
  Calendar as CalendarIcon,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const PCAdminPayslip: React.FC = () => {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchPayslips();
  }, [selectedMonth]);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'payslips'),
        where('month', '==', selectedMonth),
        orderBy('userName', 'asc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payslip));
      setPayslips(data);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      // fallback if composite index is not ready
      const qBasic = query(collection(db, 'payslips'), where('month', '==', selectedMonth));
      const snapBasic = await getDocs(qBasic);
      const dataBasic = snapBasic.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payslip));
      setPayslips(dataBasic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PCAdminLayout title="급여명세서 중앙 관리">
      <div className="max-w-[1600px] mx-auto space-y-10">
        {/* Management Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-8">
              <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 shadow-inner">
                <FileSpreadsheet className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">금월 발행 결과</h3>
                <div className="flex items-baseline gap-2">
                   <span className="text-4xl font-black text-slate-900">{payslips.length}</span>
                   <span className="text-slate-400 font-bold text-sm">건 완료</span>
                </div>
              </div>
           </div>

           <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Batch Processing</h3>
                <p className="text-2xl font-black mb-6 tracking-tight leading-none">급여 데이터 대량 업로드</p>
                <div className="flex gap-4">
                   <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-500 transition-all flex items-center gap-2">
                     <Upload className="w-4 h-4" /> 엑셀 파일 선택
                   </button>
                   <button className="px-6 py-2.5 bg-white/10 text-white rounded-xl font-black text-xs hover:bg-white/20 transition-all border border-white/10">
                     템플릿 서식 다운
                   </button>
                </div>
              </div>
              <FileSpreadsheet className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 rotate-12 transition-transform group-hover:scale-110" />
           </div>

           <div className="bg-emerald-600 p-10 rounded-[3rem] text-white shadow-2xl shadow-emerald-600/20 flex flex-col justify-between">
              <div>
                <CheckCircle2 className="w-10 h-10 mb-4 opacity-50" />
                <p className="text-sm font-bold text-emerald-100 opacity-80">이번 달에도 모든 임직원의 급여 발행이<br/>정상적으로 완료되었습니다.</p>
              </div>
              <button className="w-fit text-xs font-black bg-white/20 px-4 py-2 rounded-xl text-white hover:bg-white/30 transition-all">실적 리포트 확인</button>
           </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-4 flex-1">
              <div className="relative">
                 <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                   type="month" 
                   value={selectedMonth}
                   onChange={(e) => setSelectedMonth(e.target.value)}
                   className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                 />
              </div>
              <div className="relative flex-1 max-w-sm group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                 <input 
                   type="text" 
                   placeholder="임직원 이름 검색..."
                   className="w-full pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-blue-500/10 transition-all border border-transparent focus:border-blue-100"
                 />
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all" title="인쇄"><Printer className="w-5 h-5" /></button>
              <button className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2">
                 <Plus className="w-5 h-5" />
                 수기 명세서 추가
              </button>
           </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                       <th className="px-10 py-6 text-center w-20">순번</th>
                       <th className="px-6 py-6">임직원 이름</th>
                       <th className="px-6 py-6 text-center">지급월</th>
                       <th className="px-6 py-6 text-right">총 지급액</th>
                       <th className="px-6 py-6 text-right">실 수령액</th>
                       <th className="px-6 py-6 text-center">발행 유무</th>
                       <th className="px-10 py-6 text-right">액션</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {loading ? (
                       [...Array(6)].map((_, i) => (
                        <tr key={i} className="animate-pulse"><td colSpan={7} className="h-20" /></tr>
                       ))
                    ) : payslips.length === 0 ? (
                       <tr><td colSpan={7} className="py-32 text-center text-slate-400 font-bold">발행된 명세서 내역이 없습니다.</td></tr>
                    ) : (
                       payslips.map((payslip, idx) => (
                        <tr key={payslip.id} className="hover:bg-blue-50/20 transition-all group">
                           <td className="px-10 py-6 text-center text-xs font-black text-slate-400 leading-none">{idx + 1}</td>
                           <td className="px-6 py-6 font-black text-slate-900 font-sans tracking-tight">{payslip.userName}</td>
                           <td className="px-6 py-6 text-center font-bold text-slate-500 font-mono text-xs">{payslip.month}</td>
                           <td className="px-6 py-6 text-right font-black text-slate-700 font-mono italic">{payslip.totalEarnings.toLocaleString()}원</td>
                           <td className="px-6 py-6 text-right font-black text-blue-600 font-mono italic">{payslip.netPay.toLocaleString()}원</td>
                           <td className="px-6 py-6 text-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">
                                 <CheckCircle2 className="w-3 h-3" /> 발행완료
                              </span>
                           </td>
                           <td className="px-10 py-6 text-right">
                              <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                 <button className="p-2.5 bg-white shadow-sm border border-slate-100 rounded-xl hover:shadow-md transition-all text-slate-600" title="미리보기"><Eye className="w-4 h-4" /></button>
                                 <button className="p-2.5 bg-white shadow-sm border border-slate-100 rounded-xl hover:shadow-md transition-all text-rose-500" title="삭제"><Trash2 className="w-4 h-4" /></button>
                              </div>
                           </td>
                        </tr>
                       ))
                    )}
                 </tbody>
              </table>
           </div>
           <div className="p-8 bg-slate-50/30 flex justify-center border-t border-slate-100">
              <div className="flex gap-2">
                 <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm font-black text-sm">1</button>
                 <button className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-white border border-transparent hover:border-slate-200 transition-all font-black text-sm text-slate-400">2</button>
              </div>
           </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminPayslip;
