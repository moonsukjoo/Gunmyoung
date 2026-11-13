import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Payslip } from '../types';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Printer, 
  FileText, 
  Calendar, 
  Wallet, 
  Receipt, 
  ShieldCheck, 
  TrendingUp,
  CreditCard,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PayslipDocument from '../components/PayslipDocument';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { downloadFile } from '@/lib/downloadHelper';
import { toast } from 'sonner';

const formatWon = (num?: number) => (num || 0).toLocaleString() + '원';
const formatNumber = (num?: number) => (num || 0).toLocaleString();

const MyPayslip: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    if (profile) {
      fetchPayslips();
    }
  }, [profile]);

  const fetchPayslips = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'payslips'),
        where('uid', '==', profile.uid)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Payslip))
        .sort((a, b) => b.month.localeCompare(a.month)); // Sort descending by month
      
      setPayslips(data);

      if (data.length > 0) {
        const latestMonth = data[0].month;
        const latestYear = latestMonth.split('-')[0];
        setSelectedYear(latestYear);
        setSelectedMonth(latestMonth);
      }
    } catch (error) {
      console.error('Error fetching payslips:', error);
      handleFirestoreError(error, OperationType.LIST, 'payslips');
    } finally {
      setLoading(false);
    }
  };

  // Available unique years from payslip history
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    payslips.forEach(p => {
      const y = p.month.split('-')[0];
      if (y) yearsSet.add(y);
    });
    // Ensure current year is always an option even if no payslips yet
    yearsSet.add(new Date().getFullYear().toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [payslips]);

  // Payslips filtered by the selected year
  const yearPayslips = useMemo(() => {
    return payslips
      .filter(p => p.month.startsWith(`${selectedYear}-`))
      .sort((a, b) => a.month.localeCompare(b.month)); // Ascending (Jan to Dec) for summary
  }, [payslips, selectedYear]);

  // Yearly cumulative calculations (이번년도 총 수령액, 세금, 공제액)
  const yearTotals = useMemo(() => {
    let totalEarnings = 0;
    let baseSalary = 0;
    let totalAllowances = 0;
    let incomeTax = 0;
    let localIncomeTax = 0;
    let nationalPension = 0;
    let healthInsurance = 0;
    let employmentInsurance = 0;
    let mealDeduction = 0;
    let laundryDeduction = 0;
    let totalDeductions = 0;
    let netPay = 0;

    yearPayslips.forEach(p => {
      totalEarnings += p.totalEarnings || 0;
      baseSalary += p.baseSalary || 0;
      totalAllowances += (p.totalEarnings || 0) - (p.baseSalary || 0);
      incomeTax += p.incomeTax || 0;
      localIncomeTax += p.localIncomeTax || 0;
      nationalPension += p.nationalPension || 0;
      healthInsurance += p.healthInsurance || 0;
      employmentInsurance += p.employmentInsurance || 0;
      const customDedSum = (p.customDeductions || []).reduce((acc, c) => acc + (c.amount || 0), 0);
      mealDeduction += p.mealDeduction || 0;
      laundryDeduction += (p.laundryDeduction || 0) + customDedSum;
      totalDeductions += p.totalDeductions || 0;
      netPay += p.netPay || 0;
    });

    const totalTaxes = incomeTax + localIncomeTax;
    const socialInsurances = nationalPension + healthInsurance + employmentInsurance;
    const otherDeductions = mealDeduction + laundryDeduction;

    return {
      count: yearPayslips.length,
      totalEarnings,
      baseSalary,
      totalAllowances,
      incomeTax,
      localIncomeTax,
      totalTaxes,
      nationalPension,
      healthInsurance,
      employmentInsurance,
      socialInsurances,
      otherDeductions,
      totalDeductions,
      netPay,
      avgNetPay: yearPayslips.length > 0 ? Math.round(netPay / yearPayslips.length) : 0,
    };
  }, [yearPayslips]);

  // Current active payslip for the selected month
  const currentPayslip = useMemo(() => {
    if (!selectedMonth) {
      return yearPayslips[yearPayslips.length - 1] || payslips[0] || null;
    }
    return payslips.find(p => p.month === selectedMonth) || yearPayslips[yearPayslips.length - 1] || null;
  }, [payslips, yearPayslips, selectedMonth]);

  // Handle year change: switch selected month to the latest available month of that year
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const matching = payslips.filter(p => p.month.startsWith(`${year}-`));
    if (matching.length > 0) {
      setSelectedMonth(matching[0].month);
    } else {
      setSelectedMonth('');
    }
  };

  // Month navigation handlers
  const currentMonthIndex = yearPayslips.findIndex(p => p.month === currentPayslip?.month);
  const handlePrevMonth = () => {
    if (currentMonthIndex > 0) {
      setSelectedMonth(yearPayslips[currentMonthIndex - 1].month);
    }
  };
  const handleNextMonth = () => {
    if (currentMonthIndex < yearPayslips.length - 1) {
      setSelectedMonth(yearPayslips[currentMonthIndex + 1].month);
    }
  };

  const handleDownloadPDF = async () => {
    if (!currentPayslip) return;
    const element = document.getElementById('payslip-to-print');
    if (!element) return;

    try {
      toast.dismiss();
      toast.loading('고화질 급여명세서 PDF를 생성 중입니다...', { id: 'payslip-pdf' });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 10, imgWidth, Math.min(pageHeight - 20, imgHeight));
      
      const pdfBlob = pdf.output('blob');
      const fileName = `급여명세서_${currentPayslip.month}_${profile?.displayName || '건명기업'}.pdf`;

      toast.dismiss('payslip-pdf');
      await downloadFile(pdfBlob, fileName, [imgData]);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.dismiss('payslip-pdf');
      toast.error('PDF 생성 중 오류가 발생했습니다.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-bold">급여 명세서 및 연간 정산 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (payslips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-6 shadow-inner border border-border">
          <FileText className="w-10 h-10 text-muted-foreground opacity-30" />
        </div>
        <h3 className="text-xl font-black text-foreground mb-2">등록된 급여 명세서가 없습니다</h3>
        <p className="text-muted-foreground text-sm font-bold">아직 발행된 급여 명세서가 없습니다.<br />관리자(인사팀)에서 급여를 발행하면 이곳에 자동으로 표시됩니다.</p>
        <Button className="mt-8 bg-card hover:bg-muted text-foreground font-black rounded-2xl px-8 border border-border" onClick={() => window.history.back()}>
          돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Manager Fast Nav (Only shown for managers & administrators) */}
      {profile && (['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'CLERK', 'GENERAL_AFFAIRS'].includes(profile.role) || profile.permissions?.includes('payslip_mgmt') || profile.permissions?.includes('admin')) && (
        <div className="bg-muted/40 border border-border p-3.5 px-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-foreground font-bold">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span>관리자 권한 감지: 전사 급여명세서 등록 및 관제 허브</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/payslip-mgmt')}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs transition-all shadow-sm cursor-pointer"
            >
              📋 전사 급여명세서 등록/관리 (모바일)
            </button>
            <button
              onClick={() => navigate('/admin/pc/payslip')}
              className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground font-bold text-xs transition-all cursor-pointer"
            >
              🖥️ PC 관리자 대시보드
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <header className="py-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
              급여 & 세금 통합 대시보드
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {profile?.displayName} ({profile?.employeeId || '사원'})
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">
            월급 명세표 & 연간 수령 정산
          </h2>
          <p className="text-muted-foreground font-bold text-xs sm:text-sm mt-1">
            해당 월의 상세 명세서와 {selectedYear}년 연간 총 수령액 및 세금/공제 총액을 한눈에 확인하세요.
          </p>
        </div>

        {/* Year Switcher */}
        <div className="flex items-center gap-1.5 bg-card p-1.5 rounded-2xl border border-border shadow-sm shrink-0">
          <Calendar className="w-4 h-4 text-muted-foreground ml-2 mr-1" />
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => handleYearChange(year)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedYear === year
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {year}년
            </button>
          ))}
        </div>
      </header>

      {/* SECTION 1: 이번년도 총 얼마 받는지 & 세금 얼마인지 (Annual YTD Cumulative Summary) */}
      <div className="bg-gradient-to-br from-card via-card to-muted/40 p-5 sm:p-7 rounded-3xl border border-border shadow-xl space-y-6 relative overflow-hidden">
        {/* Top Accent Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-foreground">
                  {selectedYear}년 연간 급여 및 납부 세금 종합 집계
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                  총 {yearTotals.count}개월 정산 완료
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-bold">
                {selectedYear}년도에 입금된 총 실수령액과 납부된 세금(소득세·지방소득세) 및 4대보험 합계입니다.
              </p>
            </div>
          </div>

          {yearTotals.count > 0 && (
            <div className="text-left sm:text-right bg-background/60 px-3.5 py-1.5 rounded-xl border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground block">월평균 실수령액</span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {formatWon(yearTotals.avgNetPay)}
              </span>
            </div>
          )}
        </div>

        {/* 4 Core YTD Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. 이번년도 총 실수령액 */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 p-4 sm:p-5 rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4" />
                이번년도 총 실수령액
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                실제 통장 입금액
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight text-emerald-400">
              {formatWon(yearTotals.netPay)}
            </p>
            <p className="text-[11px] text-muted-foreground font-bold mt-2 pt-2 border-t border-emerald-500/20">
              세금 및 4대보험 공제 후 순수령 합계
            </p>
          </div>

          {/* 2. 이번년도 세전 총지급액 */}
          <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/30 p-4 sm:p-5 rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                이번년도 세전 총지급액
              </span>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">
                과세 총액
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight text-blue-400">
              {formatWon(yearTotals.totalEarnings)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-bold mt-2 pt-2 border-t border-blue-500/20">
              <span>기본급: {formatNumber(yearTotals.baseSalary)}</span>
              <span>수당합계: {formatNumber(yearTotals.totalAllowances)}</span>
            </div>
          </div>

          {/* 3. 이번년도 납부 총 세금 */}
          <div className="bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/30 p-4 sm:p-5 rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4" />
                이번년도 총 세금
              </span>
              <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
                소득세 + 지방세
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight text-rose-400">
              {formatWon(yearTotals.totalTaxes)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-bold mt-2 pt-2 border-t border-rose-500/20">
              <span>소득세: {formatNumber(yearTotals.incomeTax)}원</span>
              <span>지방세: {formatNumber(yearTotals.localIncomeTax)}원</span>
            </div>
          </div>

          {/* 4. 이번년도 4대보험 및 기타공제 총액 */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-4 sm:p-5 rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                4대보험 및 공제총액
              </span>
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                총 공제 합계
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight text-amber-400">
              {formatWon(yearTotals.totalDeductions)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-bold mt-2 pt-2 border-t border-amber-500/20 truncate">
              <span>4대보험: {formatNumber(yearTotals.socialInsurances)}원</span>
              <span>식대등: {formatNumber(yearTotals.otherDeductions)}원</span>
            </div>
          </div>
        </div>

        {/* Detailed Taxes & Insurance Sub-Breakdown Strip */}
        <div className="bg-background/80 rounded-2xl p-4 border border-border/80">
          <div className="flex items-center justify-between mb-3 text-xs font-black text-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              {selectedYear}년 공제·세금 항목별 세부 누적 내역
            </span>
            <span className="text-muted-foreground text-[11px]">
              공제 총계: {formatWon(yearTotals.totalDeductions)}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-card border border-border/60">
              <span className="text-[10px] font-bold text-rose-400 block mb-0.5">국세(소득세)</span>
              <span className="font-mono font-bold text-foreground">{formatNumber(yearTotals.incomeTax)}원</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/60">
              <span className="text-[10px] font-bold text-rose-400 block mb-0.5">지방세(주민세)</span>
              <span className="font-mono font-bold text-foreground">{formatNumber(yearTotals.localIncomeTax)}원</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/60">
              <span className="text-[10px] font-bold text-amber-400 block mb-0.5">국민연금</span>
              <span className="font-mono font-bold text-foreground">{formatNumber(yearTotals.nationalPension)}원</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/60">
              <span className="text-[10px] font-bold text-amber-400 block mb-0.5">건강보험</span>
              <span className="font-mono font-bold text-foreground">{formatNumber(yearTotals.healthInsurance)}원</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/60">
              <span className="text-[10px] font-bold text-amber-400 block mb-0.5">고용보험</span>
              <span className="font-mono font-bold text-foreground">{formatNumber(yearTotals.employmentInsurance)}원</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/60">
              <span className="text-[10px] font-bold text-muted-foreground block mb-0.5">기타(식대/세탁)</span>
              <span className="font-mono font-bold text-foreground">{formatNumber(yearTotals.otherDeductions)}원</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Month Selector (해당 월껏만 보기 필터) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
            <h3 className="text-base sm:text-lg font-black text-foreground">
              {selectedYear}년 월별 명세서 선택 (해당 월 조회)
            </h3>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            클릭하여 해당 월 명세표 열람
          </span>
        </div>

        {/* Scrollable Month Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {yearPayslips.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border w-full">
              {selectedYear}년도에 발행된 급여 명세서가 없습니다.
            </div>
          ) : (
            yearPayslips.map((p) => {
              const monthNum = parseInt(p.month.split('-')[1], 10);
              const isSelected = p.month === currentPayslip?.month;
              return (
                <button
                  key={p.id || p.month}
                  onClick={() => setSelectedMonth(p.month)}
                  className={`flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px] px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer text-left shrink-0 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                      : 'bg-card hover:bg-muted/60 text-foreground border-border'
                  }`}
                >
                  <div className="flex items-center gap-1 w-full justify-between">
                    <span className="font-black text-sm">{monthNum}월분</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                  </div>
                  <span className={`text-[11px] font-mono font-bold mt-1 ${isSelected ? 'text-primary-foreground/90' : 'text-emerald-500'}`}>
                    {formatNumber(p.netPay)}원
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 3: 해당 월 급여명세서 상세 (Selected Month Payslip View) */}
      {currentPayslip ? (
        <div className="space-y-4">
          {/* Active Month Control & Summary Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 sm:p-5 rounded-3xl border border-border shadow-lg">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                className="w-10 h-10 rounded-xl shrink-0"
                disabled={currentMonthIndex <= 0}
                onClick={handlePrevMonth}
                title="이전 달 명세표"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <span className="text-[10px] font-black text-primary uppercase tracking-wider block">
                  현재 열람 중인 명세서
                </span>
                <h4 className="text-xl font-black text-foreground">
                  {currentPayslip.month.replace('-', '년 ')}월분 급여 명세서
                </h4>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="w-10 h-10 rounded-xl shrink-0"
                disabled={currentMonthIndex >= yearPayslips.length - 1}
                onClick={handleNextMonth}
                title="다음 달 명세표"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            {/* Quick Summary Badges & Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
              <div className="hidden xl:flex items-center gap-3 bg-background/60 px-4 py-2 rounded-2xl border border-border text-xs mr-2">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-bold">해당월 실수령액</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">{formatWon(currentPayslip.netPay)}</span>
                </div>
                <div className="h-6 w-px bg-border"></div>
                <div>
                  <span className="text-[10px] text-muted-foreground block font-bold">납부 세금(소득+지방)</span>
                  <span className="font-mono font-bold text-rose-400">{formatWon(currentPayslip.incomeTax + currentPayslip.localIncomeTax)}</span>
                </div>
              </div>

              <Button 
                className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl px-4 gap-2 cursor-pointer shadow-md"
                onClick={handleDownloadPDF}
              >
                <Download className="w-4 h-4" />
                <span className="text-xs">PDF 다운로드/저장</span>
              </Button>

              <Button 
                variant="outline"
                className="h-11 rounded-xl border-border font-bold text-xs gap-1.5 cursor-pointer px-3 hidden sm:flex"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4 text-muted-foreground" />
                인쇄
              </Button>
            </div>
          </div>

          {/* Official Mobile-Responsive Payslip Document Container */}
          <div className="bg-zinc-200/50 dark:bg-zinc-900/50 rounded-2xl sm:rounded-3xl p-2 sm:p-6 md:p-8 shadow-2xl border border-border">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-[850px] mx-auto overflow-hidden">
              <PayslipDocument payslip={currentPayslip} />
            </div>
          </div>

          {/* Dedicated off-screen 850px A4 canvas target for crisp PDF generation */}
          <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
            <div id="payslip-to-print" className="bg-white w-[850px]">
              <PayslipDocument payslip={currentPayslip} forceDesktopLayout />
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground font-bold opacity-75 px-4 pt-1">
            모바일 화면 크기에 맞춰 자동으로 표시되며, 상단의 [PDF 다운로드/저장] 버튼을 누르면 공식 양식으로 보관하실 수 있습니다.
          </div>
        </div>
      ) : (
        <div className="py-16 text-center text-muted-foreground font-bold bg-card rounded-3xl border border-border p-6">
          선택된 월의 급여 명세서가 없습니다.
        </div>
      )}
    </div>
  );
};

export default MyPayslip;
