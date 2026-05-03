import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Payslip } from '../types';
import { Loader2, ChevronLeft, ChevronRight, Download, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PayslipDocument from '../components/PayslipDocument';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const MyPayslip: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (profile) {
      fetchPayslips();
    }
  }, [profile]);

  const fetchPayslips = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Fetch without orderBy to avoid composite index requirement
      const q = query(
        collection(db, 'payslips'),
        where('uid', '==', profile.uid)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Payslip))
        .sort((a, b) => b.month.localeCompare(a.month)) // Sort in memory (descending)
        .slice(0, 12); // Limit to 12 in memory
      
      setPayslips(data);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      toast.error('급여 명세서를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('payslip-to-print');
    if (!element) return;

    try {
      toast.loading('PDF를 생성 중입니다...');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 10, imgWidth, imgHeight);
      pdf.save(`급여명세서_${payslips[currentIndex].month}_${profile?.displayName}.pdf`);
      toast.dismiss();
      toast.success('PDF 다운로드가 완료되었습니다.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.dismiss();
      toast.error('PDF 생성 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-bold">급여 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (payslips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-muted-foreground opacity-20" />
        </div>
        <h3 className="text-xl font-black text-white mb-2">등록된 급여 명세서가 없습니다</h3>
        <p className="text-muted-foreground text-sm font-bold">아직 이번 달 급여 명세서가 등록되지 않았거나,<br />이력이 없습니다. 관리자에게 문의해 주세요.</p>
        <Button className="mt-8 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl px-8" onClick={() => window.history.back()}>
          돌아가기
        </Button>
      </div>
    );
  }

  const currentPayslip = payslips[currentIndex];

  return (
    <div className="space-y-6 pb-24">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">월급 명세표</h2>
        <p className="text-muted-foreground font-bold">월별 급여 내역을 확인하세요</p>
      </header>

      <div className="flex items-center justify-between bg-card p-4 rounded-3xl border border-white/5 shadow-xl">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-xl"
            disabled={currentIndex === payslips.length - 1}
            onClick={() => setCurrentIndex(prev => prev + 1)}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="text-center">
            <p className="text-xs font-black text-primary uppercase tracking-widest leading-none mb-1">SELECTED MONTH</p>
            <h3 className="text-xl font-black text-white">{currentPayslip.month.replace('-', '년 ')}월분</h3>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-xl"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => prev - 1)}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button 
            className="h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl px-6 gap-2 hidden md:flex"
            onClick={handleDownloadPDF}
          >
            <Download className="w-5 h-5" />
            PDF 다운로드
          </Button>
          <Button 
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-2xl border-white/10 text-white md:hidden"
            onClick={handleDownloadPDF}
          >
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-3xl p-4 md:p-8 flex justify-center shadow-2xl">
        <div id="payslip-to-print">
          <PayslipDocument payslip={currentPayslip} />
        </div>
      </div>

      <div className="md:hidden text-center text-xs text-muted-foreground font-bold opacity-50 px-8">
        정보가 화면보다 클 경우 좌우로 밀어서 확인하세요.<br />
        PDF 다운로드를 통해 더 선명하게 보실 수 있습니다.
      </div>
    </div>
  );
};

export default MyPayslip;
