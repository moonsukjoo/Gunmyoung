import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, orderBy, doc, deleteDoc, setDoc, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Payslip, PayslipExtraItem, UserProfile } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  FileText, 
  Upload, 
  Search, 
  Trash2, 
  Eye, 
  Printer, 
  FileSpreadsheet,
  CheckCircle2,
  Calendar as CalendarIcon,
  Plus,
  X,
  PlusCircle,
  Edit2,
  Smartphone,
  User,
  ClipboardPaste,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Sparkles,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  ParsedPayslipItem,
  parsePayslipMatrix,
  splitPastedSpreadsheetText,
} from '../lib/payslipParser';

const PCAdminPayslip: React.FC = () => {
  const navigate = useNavigate();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPayslipId, setEditingPayslipId] = useState<string | null>(null);
  const [payslipToDelete, setPayslipToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedPayslipItem[]>([]);
  const [savingBulk, setSavingBulk] = useState(false);
  const [deletingPayslip, setDeletingPayslip] = useState(false);
  const [confirmPartialBulk, setConfirmPartialBulk] = useState(false);
  
  const [editingSourcePayslip, setEditingSourcePayslip] = useState<Payslip | null>(null);
  const [customEarnings, setCustomEarnings] = useState<PayslipExtraItem[]>([]);
  const [customDeductions, setCustomDeductions] = useState<PayslipExtraItem[]>([]);
  const [extraEarnLabel, setExtraEarnLabel] = useState('');
  const [extraEarnAmount, setExtraEarnAmount] = useState('');
  const [extraDedLabel, setExtraDedLabel] = useState('');
  const [extraDedAmount, setExtraDedAmount] = useState('');

  // Bulk custom item quick-apply inputs
  const [bulkExtraType, setBulkExtraType] = useState<'EARNING' | 'DEDUCTION'>('EARNING');
  const [bulkExtraLabel, setBulkExtraLabel] = useState('');
  const [bulkExtraAmount, setBulkExtraAmount] = useState('');

  // New payslip form state
  const [newPayslip, setNewPayslip] = useState({
    userName: '',
    employeeId: '',
    month: selectedMonth,
    baseSalary: '3000000',
    experienceAllowance: '0',
    otherAllowance: '0',
    annualLeaveAllowance: '0',
    mealAllowance: '100000',
    extraAllowance: '0',
    incomeTax: '100000',
    localIncomeTax: '10000',
    healthInsurance: '120000',
    nationalPension: '135000',
    employmentInsurance: '27000',
    mealDeduction: '0',
    laundryDeduction: '0',
  });

  useEffect(() => {
    fetchPayslips();
  }, [selectedMonth]);

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) => {
        setAllUsers(snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id })));
      })
      .catch((err) => console.warn('Failed to preload users for name matching:', err));
  }, []);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'payslips'),
        where('month', '==', selectedMonth),
        orderBy('userName', 'asc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payslip));
      setPayslips(data);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      // fallback if composite index is not ready
      const qBasic = query(collection(db, 'payslips'), where('month', '==', selectedMonth));
      try {
        const snapBasic = await getDocs(qBasic);
        const dataBasic = snapBasic.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payslip));
        setPayslips(dataBasic);
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        toast.error('급여명세서 목록을 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayslip = (id: string, name: string) => {
    if (!id) {
      toast.error('삭제할 명세서의 문서 ID가 없습니다.');
      return;
    }
    setPayslipToDelete({ id, name });
  };

  const confirmDeletePayslip = async () => {
    if (!payslipToDelete) return;
    const { id, name } = payslipToDelete;
    setDeletingPayslip(true);
    try {
      await deleteDoc(doc(db, 'payslips', id));
      setPayslips(prev => prev.filter(p => p.id !== id));
      if (selectedPayslip?.id === id) {
        setSelectedPayslip(null);
      }
      toast.success(`${name}님의 급여명세서가 안전하게 삭제되었습니다.`);
      setPayslipToDelete(null);
      fetchPayslips();
    } catch (e: any) {
      console.error('Delete payslip error:', e);
      toast.error(`삭제 처리에 실패했습니다.${e?.code ? ` (${e.code})` : ''}`);
    } finally {
      setDeletingPayslip(false);
    }
  };

  const resetAddModalForm = () => {
    setEditingPayslipId(null);
    setEditingSourcePayslip(null);
    setCustomEarnings([]);
    setCustomDeductions([]);
    setExtraEarnLabel('');
    setExtraEarnAmount('');
    setExtraDedLabel('');
    setExtraDedAmount('');
    setNewPayslip({
      userName: '',
      employeeId: '',
      month: selectedMonth,
      baseSalary: '3000000',
      experienceAllowance: '0',
      otherAllowance: '0',
      annualLeaveAllowance: '0',
      mealAllowance: '100000',
      extraAllowance: '0',
      incomeTax: '100000',
      localIncomeTax: '10000',
      healthInsurance: '120000',
      nationalPension: '135000',
      employmentInsurance: '27000',
      mealDeduction: '0',
      laundryDeduction: '0',
    });
  };

  const handleOpenNewModal = () => {
    resetAddModalForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (payslip: Payslip) => {
    setEditingPayslipId(payslip.id || null);
    setEditingSourcePayslip(payslip);
    setCustomEarnings(
      payslip.customEarnings ? payslip.customEarnings.map((x) => ({ label: x.label, amount: Number(x.amount) || 0 })) : []
    );
    setCustomDeductions(
      payslip.customDeductions ? payslip.customDeductions.map((x) => ({ label: x.label, amount: Number(x.amount) || 0 })) : []
    );
    setExtraEarnLabel('');
    setExtraEarnAmount('');
    setExtraDedLabel('');
    setExtraDedAmount('');
    setNewPayslip({
      userName: payslip.userName || '',
      employeeId: payslip.employeeId || payslip.uid || '',
      month: payslip.month || selectedMonth,
      baseSalary: String(payslip.baseSalary ?? 0),
      experienceAllowance: String(payslip.experienceAllowance ?? 0),
      otherAllowance: String(payslip.otherAllowance ?? 0),
      annualLeaveAllowance: String(payslip.annualLeaveAllowance ?? 0),
      mealAllowance: String(payslip.mealAllowance ?? 0),
      extraAllowance: String(payslip.extraAllowance ?? 0),
      incomeTax: String(payslip.incomeTax ?? 0),
      localIncomeTax: String(payslip.localIncomeTax ?? 0),
      healthInsurance: String(payslip.healthInsurance ?? 0),
      nationalPension: String(payslip.nationalPension ?? 0),
      employmentInsurance: String(payslip.employmentInsurance ?? 0),
      mealDeduction: String(payslip.mealDeduction ?? 0),
      laundryDeduction: String(payslip.laundryDeduction ?? 0),
    });
    setIsAddModalOpen(true);
  };

  const handleAddCustomEarningItem = () => {
    const label = extraEarnLabel.trim();
    const amount = Number(String(extraEarnAmount).replace(/,/g, '')) || 0;
    if (!label) {
      toast.warning('추가 지급 항목명을 입력해주세요.');
      return;
    }
    if (!amount) {
      toast.warning('추가 지급 금액을 입력해주세요.');
      return;
    }
    setCustomEarnings((prev) => [...prev, { label, amount }]);
    setExtraEarnLabel('');
    setExtraEarnAmount('');
  };

  const handleAddCustomDeductionItem = () => {
    const label = extraDedLabel.trim();
    const amount = Number(String(extraDedAmount).replace(/,/g, '')) || 0;
    if (!label) {
      toast.warning('추가 공제 항목명을 입력해주세요.');
      return;
    }
    if (!amount) {
      toast.warning('추가 공제 금액을 입력해주세요.');
      return;
    }
    setCustomDeductions((prev) => [...prev, { label, amount }]);
    setExtraDedLabel('');
    setExtraDedAmount('');
  };

  const handleAddPayslip = async () => {
    const cleanName = newPayslip.userName.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!cleanName) {
      toast.error('성명을 입력해주십시오.');
      return;
    }

    const rawEmpId = newPayslip.employeeId.trim();
    const matchedUser =
      (rawEmpId
        ? allUsers.find(
            (u) => (u.employeeId || '').replace(/\s+/g, '').toLowerCase() === rawEmpId.replace(/\s+/g, '').toLowerCase()
          )
        : undefined) ||
      allUsers.find((u) => (u.displayName || '').replace(/\s+/g, '') === cleanName.replace(/\s+/g, ''));

    const resolvedEmpId = rawEmpId || matchedUser?.employeeId || '';
    const resolvedUid = editingSourcePayslip?.uid || matchedUser?.uid || resolvedEmpId || `name_${cleanName.replace(/\s+/g, '_')}`;

    try {
      // Automatically flush pending typed extra item if user forgot to click "+ 추가"
      const finalCustomEarnings = [...customEarnings];
      const pendingEarnLabel = extraEarnLabel.trim();
      const pendingEarnAmt = Number(String(extraEarnAmount).replace(/,/g, '')) || 0;
      if (pendingEarnLabel && pendingEarnAmt) {
        finalCustomEarnings.push({ label: pendingEarnLabel, amount: pendingEarnAmt });
      }

      const finalCustomDeductions = [...customDeductions];
      const pendingDedLabel = extraDedLabel.trim();
      const pendingDedAmt = Number(String(extraDedAmount).replace(/,/g, '')) || 0;
      if (pendingDedLabel && pendingDedAmt) {
        finalCustomDeductions.push({ label: pendingDedLabel, amount: pendingDedAmt });
      }

      const baseSalary = Number(newPayslip.baseSalary) || 0;
      const experienceAllowance = Number(newPayslip.experienceAllowance) || 0;
      const otherAllowance = Number(newPayslip.otherAllowance) || 0;
      const annualLeaveAllowance = Number(newPayslip.annualLeaveAllowance) || 0;
      const mealAllowance = Number(newPayslip.mealAllowance) || 0;
      const extraAllowance = Number(newPayslip.extraAllowance) || 0;
      const customEarningsSum = finalCustomEarnings.reduce((s, item) => s + (Number(item.amount) || 0), 0);

      const incomeTax = Number(newPayslip.incomeTax) || 0;
      const localIncomeTax = Number(newPayslip.localIncomeTax) || 0;
      const healthInsurance = Number(newPayslip.healthInsurance) || 0;
      const nationalPension = Number(newPayslip.nationalPension) || 0;
      const employmentInsurance = Number(newPayslip.employmentInsurance) || 0;
      const mealDeduction = Number(newPayslip.mealDeduction) || 0;
      const laundryDeduction = Number(newPayslip.laundryDeduction) || 0;
      const customDeductionsSum = finalCustomDeductions.reduce((s, item) => s + (Number(item.amount) || 0), 0);

      const totalEarnings =
        baseSalary +
        experienceAllowance +
        otherAllowance +
        annualLeaveAllowance +
        mealAllowance +
        extraAllowance +
        customEarningsSum;
      const totalDeductions =
        incomeTax +
        localIncomeTax +
        healthInsurance +
        nationalPension +
        employmentInsurance +
        mealDeduction +
        laundryDeduction +
        customDeductionsSum;
      const netPay = totalEarnings - totalDeductions;

      const docId = editingPayslipId || `${resolvedUid}_${newPayslip.month}`;
      await setDoc(doc(db, 'payslips', docId), {
        uid: resolvedUid,
        employeeId: resolvedEmpId,
        userName: cleanName,
        month: newPayslip.month,
        workDays: editingSourcePayslip?.workDays ?? 0,
        baseHours: editingSourcePayslip?.baseHours ?? 160,
        weeklyHolidayHours: editingSourcePayslip?.weeklyHolidayHours ?? 32,
        paidLeaveHours: editingSourcePayslip?.paidLeaveHours ?? 8,
        trainingHours: editingSourcePayslip?.trainingHours ?? 0,
        otherHours: editingSourcePayslip?.otherHours ?? 0,
        monthlyLeaveHours: editingSourcePayslip?.monthlyLeaveHours ?? 24,
        holidayWorkHours: editingSourcePayslip?.holidayWorkHours ?? 0,
        overtimeHours: editingSourcePayslip?.overtimeHours ?? 0,
        totalHours: editingSourcePayslip?.totalHours ?? 224,
        hourlyRate: editingSourcePayslip?.hourlyRate ?? 0,
        baseSalary,
        experienceAllowance,
        otherAllowance,
        annualLeaveAllowance,
        mealAllowance,
        extraAllowance,
        customEarnings: finalCustomEarnings,
        totalEarnings,
        incomeTax,
        localIncomeTax,
        healthInsurance,
        nationalPension,
        employmentInsurance,
        mealDeduction,
        laundryDeduction,
        customDeductions: finalCustomDeductions,
        totalDeductions,
        netPay,
        annualLeaveBaseDate: editingSourcePayslip?.annualLeaveBaseDate || '',
        createdAt: editingSourcePayslip?.createdAt || new Date().toISOString()
      }, { merge: true });

      toast.success(editingPayslipId ? `${cleanName}님의 급여명세서가 수정 완료되었습니다.` : `${cleanName}님의 수기 급여명세서가 등록되었습니다.`);
      setIsAddModalOpen(false);
      resetAddModalForm();
      fetchPayslips();
    } catch (e) {
      console.error(e);
      toast.error(editingPayslipId ? '수정 중 오류가 발생했습니다.' : '수기 등록 중 오류가 발생했습니다.');
    }
  };

  const downloadTemplate = async () => {
    try {
      const data = [
        ['항목', '예시 데이터 (이 열을 복사해서 여러 명을 추가하세요)'],
        ['사번', 'x66626'],
        ['성명', '문서주'],
        ['정취', 160],
        ['주차', 32],
        ['유휴', 8],
        ['훈련', 0],
        ['기타시간', 0],
        ['월휴', 24],
        ['휴일근로', 0],
        ['연장근로', 11],
        ['시간계', 235],
        ['시급', 0],
        ['시간급여액(가)', 3500000],
        ['경력', 0],
        ['기타수당', 0],
        ['년차', 0.0],
        ['중식', 0],
        ['기타', 0],
        ['총급여액', 3500000],
        ['갑근세', 127220],
        ['주민세', 12720],
        ['건강보험', 146420],
        ['국민연금', 171000],
        ['고용보험', 31500],
        ['식권대', 0],
        ['세탁비', 0],
        ['공제액계', 488860],
        ['지급액', 3011140],
        ['연차기준일', '2025.12.01']
      ];

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 20 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '급여명세서_양식');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `급여명세서_양식_${selectedMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('템플릿 서식이 다운로드되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('템플릿 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleExportReport = async () => {
    if (payslips.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    try {
      const headers = ['이름', '지급월', '총 지급액', '총 공제액', '실 수령액'];
      const data = payslips.map(p => [
        p.userName,
        p.month,
        p.totalEarnings.toLocaleString() + '원',
        p.totalDeductions.toLocaleString() + '원',
        p.netPay.toLocaleString() + '원'
      ]);

      const { exportToPDF } = await import('../lib/exportUtils');
      await exportToPDF(`${selectedMonth} 급여 발행 실적 리포트`, headers, data, `Salary_Report_${selectedMonth}`);
      toast.success('실적 리포트가 생성되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('리포트 생성 중 오류가 발생했습니다.');
    }
  };

  const handleParseBulkText = () => {
    if (!pasteText.trim()) {
      toast.warning('붙여넣을 엑셀 급여대장 내용을 입력해 주세요.');
      return;
    }
    try {
      const matrix = splitPastedSpreadsheetText(pasteText);
      const parsed = parsePayslipMatrix(matrix, selectedMonth, allUsers);
      if (parsed.length === 0) {
        toast.error('인식된 급여 데이터가 없습니다. 상단 헤더(성명 포함)와 데이터 행을 함께 복사해 주세요.');
        return;
      }
      setParsedItems(parsed);
      const empIdCnt = parsed.filter((p) => p.uid && p.matchStatus === 'MATCHED_EMP_ID').length;
      const nameCnt = parsed.filter((p) => p.uid && p.matchStatus === 'MATCHED_NAME').length;
      toast.success(
        `총 ${parsed.length}명 분석 완료 (매칭 ${empIdCnt + nameCnt}명 · 사번 ${empIdCnt} / 이름 ${nameCnt})`
      );
    } catch (e) {
      console.error('Bulk paste parse error:', e);
      toast.error('붙여넣기 데이터 분석 중 오류가 발생했습니다.');
    }
  };

  const handleAssignBulkUser = (index: number, uid: string) => {
    const found = allUsers.find((u) => u.uid === uid);
    if (!found) return;
    setParsedItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        uid: found.uid,
        employeeId: found.employeeId || next[index].rawEmpId,
        userName: found.displayName || next[index].rawName,
        matchedUser: found,
        matchStatus: 'MATCHED_EMP_ID',
        isDuplicateName: false,
      };
      return next;
    });
  };

  const handleInsertSampleBulk = () => {
    const emp1Name = allUsers[0]?.displayName || '문석주';
    const sample = [
      'NO\t성  명\t총\t과       세       급       여       액\t\t\t\t\t\t\t\t수       당\t\t\t기   타   급   여   액\t\t\t\t\t\t공              제              내              역\t\t\t\t\t\t\t\t지 급 액',
      '\t\t작\t정\t주\t유\t교\t기\t시\t시\t시간급여\t수\t기\t\t\t휴  일\t연  장\t중\t기타\t(다)\t갑\t주\t건  강\t국  민\t고  용\t식\t세\t공제액계\t',
      '\t\t업\t\t\t\t\t\t간\t\t액    계\t\t\t합    계\t년  휴\t\t가  급\t식\t급여액\t\t근\t민\t\t\t\t권\t탁\t\t(다 - 라)',
      '\t\t일\t취\t차\t휴\t육\t타\t계\t급\t(가)\t당\t타\t(나)\t\t근  로\t야  간\t대\t(다)\t(나 + 다)\t세\t세\t보  험\t연  금\t보  험\t대\t비\t(라)\t',
      `24\t${emp1Name}\t\t205\t32\t16\t8\t\t261\t\t3,500,000\t\t\t3,500,000\t4\t0\t55\t\t0\t3,500,000\t127,220\t12,720\t142,350\t160,880\t31,500\t7,700\t\t482,370\t3,017,630`,
      '\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\t0\t\t\t\t\t\t\t\t\t\t\t'
    ].join('\n');
    setPasteText(sample);
  };

  const handleApplyBulkExtraToAll = () => {
    const label = bulkExtraLabel.trim();
    const amount = Number(String(bulkExtraAmount).replace(/,/g, '')) || 0;
    if (!label) {
      toast.warning('추가할 항목명을 입력해 주세요.');
      return;
    }
    if (!amount) {
      toast.warning('추가 금액(원)을 입력해 주세요.');
      return;
    }
    setParsedItems((prev) =>
      prev.map((item) => {
        if (bulkExtraType === 'EARNING') {
          const nextCustom = [...(item.customEarnings || []), { label, amount }];
          const nextEarnings = (item.totalEarnings || 0) + amount;
          const nextNet = nextEarnings - (item.totalDeductions || 0);
          return { ...item, customEarnings: nextCustom, totalEarnings: nextEarnings, netPay: nextNet };
        }
        const nextCustom = [...(item.customDeductions || []), { label, amount }];
        const nextDeductions = (item.totalDeductions || 0) + amount;
        const nextNet = (item.totalEarnings || 0) - nextDeductions;
        return { ...item, customDeductions: nextCustom, totalDeductions: nextDeductions, netPay: nextNet };
      })
    );
    toast.success(`"${label}" (${amount.toLocaleString()}원) 항목이 전체 ${parsedItems.length}명에 적용되었습니다.`);
    setBulkExtraLabel('');
    setBulkExtraAmount('');
  };

  const handleSaveBulkParsed = async (forceSkipUnmatched = false) => {
    const readyItems = parsedItems.filter((item) => Boolean(item.uid));
    const unmatchedCount = parsedItems.length - readyItems.length;
    if (readyItems.length === 0) {
      toast.error('매칭된 사원이 없습니다. 이름/사번을 확인하거나 수동으로 매칭해 주세요.');
      return;
    }
    if (unmatchedCount > 0 && !forceSkipUnmatched) {
      setConfirmPartialBulk(true);
      return;
    }
    setConfirmPartialBulk(false);

    setSavingBulk(true);
    try {
      let savedCount = 0;
      for (const item of readyItems) {
        const docId = `${item.uid}_${selectedMonth}`;
        const payload: Payslip = {
          id: docId,
          uid: item.uid!,
          employeeId: item.employeeId || '',
          userName: item.userName || '',
          month: selectedMonth,
          workDays: item.workDays ?? 0,
          baseHours: item.baseHours ?? 0,
          weeklyHolidayHours: item.weeklyHolidayHours ?? 0,
          paidLeaveHours: item.paidLeaveHours ?? 0,
          trainingHours: item.trainingHours ?? 0,
          otherHours: item.otherHours ?? 0,
          monthlyLeaveHours: item.monthlyLeaveHours ?? 0,
          holidayWorkHours: item.holidayWorkHours ?? 0,
          overtimeHours: item.overtimeHours ?? 0,
          totalHours: item.totalHours ?? 0,
          hourlyRate: item.hourlyRate ?? 0,
          baseSalary: item.baseSalary ?? 0,
          experienceAllowance: item.experienceAllowance ?? 0,
          otherAllowance: item.otherAllowance ?? 0,
          annualLeaveAllowance: item.annualLeaveAllowance ?? 0,
          mealAllowance: item.mealAllowance ?? 0,
          extraAllowance: item.extraAllowance ?? 0,
          customEarnings: item.customEarnings || [],
          totalEarnings: item.totalEarnings ?? 0,
          incomeTax: item.incomeTax ?? 0,
          localIncomeTax: item.localIncomeTax ?? 0,
          healthInsurance: item.healthInsurance ?? 0,
          nationalPension: item.nationalPension ?? 0,
          employmentInsurance: item.employmentInsurance ?? 0,
          mealDeduction: item.mealDeduction ?? 0,
          laundryDeduction: item.laundryDeduction ?? 0,
          customDeductions: item.customDeductions || [],
          totalDeductions: item.totalDeductions ?? 0,
          netPay: item.netPay ?? 0,
          annualLeaveBaseDate: item.annualLeaveBaseDate || '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'payslips', docId), payload, { merge: true });
        savedCount++;
      }
      toast.success(`${savedCount}명의 ${selectedMonth} 급여명세서가 정상 등록되었습니다.`);
      setIsPasteModalOpen(false);
      setPasteText('');
      setParsedItems([]);
      fetchPayslips();
    } catch (e) {
      console.error('Bulk save error:', e);
      toast.error('일괄 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBulk(false);
    }
  };

  // Filter list of payslips by search query
  const filteredPayslips = payslips.filter(p => 
    p.userName && p.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PCAdminLayout title="급여명세서 중앙 관리">
      <div className="max-w-[1600px] mx-auto space-y-10 text-foreground">
        {/* Management Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="bg-card p-8 rounded-3xl border border-border shadow-xs flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                 <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">금월 발행 결과</h3>
                <div className="flex items-baseline gap-2">
                   <span className="text-3xl font-black text-foreground">{payslips.length}</span>
                   <span className="text-muted-foreground font-bold text-sm">건 완료</span>
                </div>
              </div>
           </div>

           <div className="bg-card border border-primary/25 p-8 rounded-3xl text-foreground shadow-xs relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-3">보안 대응 엑셀 자동 연동</h3>
                <p className="text-xl font-black mb-5 tracking-tight leading-none text-foreground">급여 데이터 대량 등록</p>
                <div className="flex flex-wrap gap-2.5">
                   <button 
                     onClick={() => setIsPasteModalOpen(true)}
                     className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-black text-xs hover:opacity-90 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                   >
                     <ClipboardPaste className="w-4 h-4" /> 엑셀 내용 붙여넣기 / 등록
                   </button>
                   <button 
                     onClick={downloadTemplate}
                     className="px-4 py-2.5 bg-muted text-foreground rounded-xl font-black text-xs hover:bg-muted/80 transition-all border border-border cursor-pointer"
                   >
                     서식 다운
                   </button>
                </div>
              </div>
              <FileSpreadsheet className="absolute -right-6 -bottom-6 w-36 h-36 text-primary/5 rotate-12 transition-transform group-hover:scale-110" />
           </div>

           <div className="bg-emerald-600/25 border border-emerald-500/30 p-10 rounded-[3rem] text-foreground shadow-2xl flex flex-col justify-between">
              <div>
                <CheckCircle2 className="w-10 h-10 mb-4 text-emerald-500 opacity-80" />
                <p className="text-sm font-bold text-foreground/90 leading-relaxed">이번 달에도 모든 임직원의 급여 발행이<br/>정상적으로 연동/완료되었습니다.</p>
              </div>
              <button 
                onClick={handleExportReport}
                className="w-fit text-xs font-black bg-emerald-500/20 px-4 py-2 rounded-xl text-emerald-400 hover:bg-emerald-500/30 transition-all border border-emerald-500/20 mt-4 cursor-pointer"
              >
                실적 리포트 확인
              </button>
           </div>
        </div>

        {/* Toolbar */}
        <div className="bg-card p-6 rounded-[2.5rem] border border-border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-4 flex-1 w-full">
              <div className="relative shrink-0">
                 <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <input 
                   type="month" 
                   value={selectedMonth}
                   onChange={(e) => setSelectedMonth(e.target.value)}
                   className="pl-12 pr-6 py-3 bg-muted border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-blue-500/10 cursor-pointer text-foreground"
                 />
              </div>
              <div className="relative flex-1 max-w-sm group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                 <input 
                   type="text" 
                   placeholder="임직원 이름 검색..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-12 pr-6 py-3 bg-muted border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-blue-500/10 transition-all border border-transparent focus:border-border text-foreground"
                 />
              </div>
           </div>
           
           <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button 
                onClick={() => navigate('/payslip-mgmt')}
                className="px-4 py-3 bg-muted text-foreground hover:bg-muted/80 rounded-2xl font-bold text-xs transition-all cursor-pointer border border-border flex items-center gap-1.5"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                📱 모바일 관리 화면
              </button>
              <button 
                onClick={() => navigate('/mypage/payslip')}
                className="px-4 py-3 bg-muted text-muted-foreground hover:text-foreground rounded-2xl font-bold text-xs transition-all cursor-pointer border border-border flex items-center gap-1.5"
              >
                <User className="w-4 h-4" />
                내 명세서
              </button>
              <button 
                onClick={() => window.print()}
                className="p-3 bg-muted text-muted-foreground hover:text-foreground rounded-2xl hover:bg-muted/80 transition-all cursor-pointer border border-border" 
                title="인쇄"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button 
                onClick={handleOpenNewModal}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/15 flex items-center gap-2 cursor-pointer"
              >
                 <Plus className="w-5 h-5" />
                 수기 명세서 추가
              </button>
           </div>
        </div>

        {/* Data Table */}
        <div className="bg-card rounded-[3rem] border border-border shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-muted text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] border-b border-border">
                       <th className="px-10 py-6 text-center w-20">순번</th>
                       <th className="px-6 py-6">임직원 이름</th>
                       <th className="px-6 py-6 text-center">지급월</th>
                       <th className="px-6 py-6 text-right">총 지급액</th>
                       <th className="px-6 py-6 text-right">실 수령액</th>
                       <th className="px-6 py-6 text-center">발행 유무</th>
                       <th className="px-10 py-6 text-right">액션</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border/60">
                    {loading ? (
                       [...Array(6)].map((_, i) => (
                        <tr key={i} className="animate-pulse"><td colSpan={7} className="h-20" /></tr>
                       ))
                    ) : filteredPayslips.length === 0 ? (
                       <tr><td colSpan={7} className="py-32 text-center text-muted-foreground font-bold">발행된 명세서 내역이 없습니다.</td></tr>
                    ) : (
                       filteredPayslips.map((payslip, idx) => (
                        <tr key={payslip.id} className="hover:bg-muted/30 transition-all group">
                           <td className="px-10 py-6 text-center text-xs font-black text-muted-foreground leading-none">{idx + 1}</td>
                           <td className="px-6 py-6 font-black text-foreground font-sans tracking-tight">{payslip.userName}</td>
                           <td className="px-6 py-6 text-center font-bold text-muted-foreground font-mono text-xs">{payslip.month}</td>
                           <td className="px-6 py-6 text-right font-black text-foreground/80 font-mono italic">{payslip.totalEarnings?.toLocaleString() || 0}원</td>
                           <td className="px-6 py-6 text-right font-black text-blue-400 font-mono italic">{payslip.netPay?.toLocaleString() || 0}원</td>
                           <td className="px-6 py-6 text-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black border border-emerald-500/20">
                                 <CheckCircle2 className="w-3 h-3" /> 발행완료
                              </span>
                           </td>
                           <td className="px-10 py-6 text-right">
                              <div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-all">
                                 <button 
                                   onClick={() => setSelectedPayslip(payslip)}
                                   className="p-2.5 bg-muted border border-border rounded-xl hover:bg-card transition-all text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center" 
                                   title="상세보기"
                                 >
                                   <Eye className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleOpenEditModal(payslip)}
                                   className="p-2.5 bg-muted border border-border rounded-xl hover:bg-card transition-all text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center justify-center" 
                                   title="수정"
                                 >
                                   <Edit2 className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleDeletePayslip(payslip.id!, payslip.userName)}
                                   className="p-2.5 bg-muted border border-border rounded-xl hover:bg-rose-500/10 transition-all text-rose-500 hover:text-rose-400 cursor-pointer flex items-center justify-center" 
                                   title="삭제"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                       ))
                    )}
                 </tbody>
              </table>
           </div>
           <div className="p-8 bg-muted/40 flex justify-center border-t border-border">
              <div className="flex gap-2">
                 <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-card border border-border shadow-sm font-black text-sm">1</button>
              </div>
           </div>
        </div>
      </div>

      {/* Manual Insertion Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl text-foreground flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-border bg-muted/20 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <PlusCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black leading-none">{editingPayslipId ? "기존 명세서 데이터 수정" : "수기 명세서 수동 발행"}</h3>
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    {editingPayslipId ? "선택한 임직원의 기존 급여 명세 정산 데이터를 수정 및 갱신합니다." : "개별 임직원의 급여 데이터를 수동으로 입력하여 명세서를 즉시 생성합니다."}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setIsAddModalOpen(false); resetAddModalForm(); }}
                className="w-10 h-10 hover:bg-muted border border-border hover:border-transparent rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">임직원 이름</label>
                  <input 
                    type="text" 
                    placeholder="예: 문서주"
                    value={newPayslip.userName}
                    onChange={(e) => setNewPayslip(prev => ({ ...prev, userName: e.target.value }))}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">사번 (선택 · 미입력 시 이름 매칭)</label>
                  <input 
                    type="text" 
                    placeholder="미입력 시 이름으로 자동 매칭"
                    value={newPayslip.employeeId}
                    onChange={(e) => setNewPayslip(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold text-foreground"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-extrabold text-blue-500 mb-4 flex items-center gap-2">지급 항목 (Earnings)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">기본급 / 시간급여 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.baseSalary}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, baseSalary: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">경력 / 고정수당 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.experienceAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, experienceAllowance: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">중식대 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.mealAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, mealAllowance: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">휴일·연장 등 수당 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.annualLeaveAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, annualLeaveAllowance: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">기타 수당 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.otherAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, otherAllowance: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">기타 급여액 (원)</label>
                    <input 
                      type="number" 
                      value={newPayslip.extraAllowance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, extraAllowance: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                </div>

                {/* Custom Additional Earnings Input */}
                <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-blue-400">➕ 추가 지급 항목 직접 입력 (상여·직무수당·격려금 등)</span>
                    {customEarnings.length > 0 && (
                      <span className="text-[10px] font-bold text-blue-400">{customEarnings.length}개 적용됨</span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="추가 항목명 (예: 성과상여금)"
                      value={extraEarnLabel}
                      onChange={(e) => setExtraEarnLabel(e.target.value)}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground outline-none"
                    />
                    <input
                      type="number"
                      placeholder="금액 (원)"
                      value={extraEarnAmount}
                      onChange={(e) => setExtraEarnAmount(e.target.value)}
                      className="w-full sm:w-36 px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono text-foreground outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomEarningItem}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 항목 추가
                    </button>
                  </div>
                  {customEarnings.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customEarnings.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold"
                        >
                          <span>{item.label}</span>
                          <span className="font-mono">+{item.amount.toLocaleString()}원</span>
                          <button
                            type="button"
                            onClick={() => setCustomEarnings((prev) => prev.filter((_, i) => i !== idx))}
                            className="hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-extrabold text-red-400 mb-4 flex items-center gap-2">공제 항목 (Deductions)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">소득세 (갑근세)</label>
                    <input 
                      type="number" 
                      value={newPayslip.incomeTax}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, incomeTax: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">지방소득세 (주민세)</label>
                    <input 
                      type="number" 
                      value={newPayslip.localIncomeTax}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, localIncomeTax: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">건강보험료</label>
                    <input 
                      type="number" 
                      value={newPayslip.healthInsurance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, healthInsurance: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">국민연금</label>
                    <input 
                      type="number" 
                      value={newPayslip.nationalPension}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, nationalPension: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">고용보험</label>
                    <input 
                      type="number" 
                      value={newPayslip.employmentInsurance}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, employmentInsurance: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">식권대 / 세탁비 (식권대)</label>
                    <input 
                      type="number" 
                      value={newPayslip.mealDeduction}
                      onChange={(e) => setNewPayslip(prev => ({ ...prev, mealDeduction: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono text-foreground"
                    />
                  </div>
                </div>

                {/* Custom Additional Deductions Input */}
                <div className="mt-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-rose-400">➖ 추가 공제 항목 직접 입력 (가불금·조합비·정산차감 등)</span>
                    {customDeductions.length > 0 && (
                      <span className="text-[10px] font-bold text-rose-400">{customDeductions.length}개 적용됨</span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="추가 공제 항목명 (예: 조합비 / 가불금)"
                      value={extraDedLabel}
                      onChange={(e) => setExtraDedLabel(e.target.value)}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground outline-none"
                    />
                    <input
                      type="number"
                      placeholder="금액 (원)"
                      value={extraDedAmount}
                      onChange={(e) => setExtraDedAmount(e.target.value)}
                      className="w-full sm:w-36 px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono text-foreground outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomDeductionItem}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 항목 추가
                    </button>
                  </div>
                  {customDeductions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customDeductions.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold"
                        >
                          <span>{item.label}</span>
                          <span className="font-mono">-{item.amount.toLocaleString()}원</span>
                          <button
                            type="button"
                            onClick={() => setCustomDeductions((prev) => prev.filter((_, i) => i !== idx))}
                            className="hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Live Totals Preview */}
              {(() => {
                const pendingE = extraEarnLabel.trim() ? Number(String(extraEarnAmount).replace(/,/g, '')) || 0 : 0;
                const pendingD = extraDedLabel.trim() ? Number(String(extraDedAmount).replace(/,/g, '')) || 0 : 0;
                const liveEarn =
                  (Number(newPayslip.baseSalary) || 0) +
                  (Number(newPayslip.experienceAllowance) || 0) +
                  (Number(newPayslip.otherAllowance) || 0) +
                  (Number(newPayslip.annualLeaveAllowance) || 0) +
                  (Number(newPayslip.mealAllowance) || 0) +
                  (Number(newPayslip.extraAllowance) || 0) +
                  customEarnings.reduce((s, x) => s + (Number(x.amount) || 0), 0) +
                  pendingE;
                const liveDed =
                  (Number(newPayslip.incomeTax) || 0) +
                  (Number(newPayslip.localIncomeTax) || 0) +
                  (Number(newPayslip.healthInsurance) || 0) +
                  (Number(newPayslip.nationalPension) || 0) +
                  (Number(newPayslip.employmentInsurance) || 0) +
                  (Number(newPayslip.mealDeduction) || 0) +
                  (Number(newPayslip.laundryDeduction) || 0) +
                  customDeductions.reduce((s, x) => s + (Number(x.amount) || 0), 0) +
                  pendingD;
                const liveNet = liveEarn - liveDed;
                return (
                  <div className="grid grid-cols-3 gap-3 bg-muted/40 border border-border rounded-2xl p-4">
                    <div>
                      <span className="text-[10px] font-black text-muted-foreground block">적용 후 총지급액</span>
                      <span className="text-sm font-black font-mono text-blue-400">{liveEarn.toLocaleString()}원</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-muted-foreground block">적용 후 공제액계</span>
                      <span className="text-sm font-black font-mono text-rose-400">{liveDed.toLocaleString()}원</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-muted-foreground block">예상 실수령액</span>
                      <span className="text-sm font-black font-mono text-emerald-400">{liveNet.toLocaleString()}원</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-8 border-t border-border bg-muted/20 flex gap-4 shrink-0">
              <button 
                onClick={() => { setIsAddModalOpen(false); resetAddModalForm(); }}
                className="flex-1 py-4 bg-muted border border-border text-foreground hover:bg-muted/80 rounded-2xl font-black text-xs transition-all cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={handleAddPayslip}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs transition-all cursor-pointer"
              >
                {editingPayslipId ? '수정 내용 저장 반영' : '명세서 확정 발행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PaySlip Detailed Preview Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedPayslip(null)}>
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl text-foreground flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground">급여명세서 상세 보기</h3>
                <p className="text-xs font-bold text-muted-foreground mt-1">{selectedPayslip.userName}님 / {selectedPayslip.month} 귀속일자</p>
              </div>
              <button 
                onClick={() => setSelectedPayslip(null)}
                className="w-10 h-10 hover:bg-muted border border-border hover:border-transparent rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Employee Header Panel */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">성명 / 사원번호</p>
                  <p className="text-sm font-black text-foreground mt-1">{selectedPayslip.userName} ({selectedPayslip.employeeId || '미기재'})</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">정산기준 근로시간</p>
                  <p className="text-sm font-black text-foreground mt-1">
                    {selectedPayslip.totalHours ?? 0} 시간
                    {selectedPayslip.overtimeHours ? ` (연장 ${selectedPayslip.overtimeHours}h)` : ''}
                  </p>
                </div>
              </div>

              {/* Earnings Details */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest pl-1">지급액 세부 내역 (Earnings)</h4>
                <div className="bg-muted/10 border border-border/80 rounded-2xl p-4 divide-y divide-border/40">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">기본급 (시간급여액)</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.baseSalary?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">경력 및 직책수당</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.experienceAllowance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">식비 (중식대)</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.mealAllowance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">기타 수당 / 급여액</span>
                    <span className="font-mono font-bold text-foreground">{((selectedPayslip.otherAllowance || 0) + (selectedPayslip.extraAllowance || 0)).toLocaleString()} 원</span>
                  </div>
                  {selectedPayslip.customEarnings?.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 bg-blue-500/5 px-2 rounded-lg">
                      <span className="text-blue-400 font-bold">+ {item.label}</span>
                      <span className="font-mono font-bold text-blue-300">{item.amount.toLocaleString()} 원</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-black border-t border-border pt-2">
                    <span className="text-foreground">지급 합계액 (Ea)</span>
                    <span className="font-mono text-blue-400">{selectedPayslip.totalEarnings?.toLocaleString() || 0} 원</span>
                  </div>
                </div>
              </div>

              {/* Deductions Details */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black text-red-500 uppercase tracking-widest pl-1">세금 및 공제 내역 (Deductions)</h4>
                <div className="bg-muted/10 border border-border/80 rounded-2xl p-4 divide-y divide-border/40">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">갑근세 (소득세)</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.incomeTax?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">주민세 (지방소득세)</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.localIncomeTax?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">건강보험료</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.healthInsurance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">국민연금</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.nationalPension?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">고용보험료</span>
                    <span className="font-mono font-bold text-foreground">{selectedPayslip.employmentInsurance?.toLocaleString() || 0} 원</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground font-semibold">식권대 / 세탁비</span>
                    <span className="font-mono font-bold text-foreground">{((selectedPayslip.mealDeduction || 0) + (selectedPayslip.laundryDeduction || 0)).toLocaleString()} 원</span>
                  </div>
                  {selectedPayslip.customDeductions?.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 bg-rose-500/5 px-2 rounded-lg">
                      <span className="text-rose-400 font-bold">- {item.label}</span>
                      <span className="font-mono font-bold text-rose-300">{item.amount.toLocaleString()} 원</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-black border-t border-border pt-2">
                    <span className="text-foreground">공제 합계액 (De)</span>
                    <span className="font-mono text-red-400">{selectedPayslip.totalDeductions?.toLocaleString() || 0} 원</span>
                  </div>
                </div>
              </div>

              {/* Total Summary Frame */}
              <div className="bg-blue-600/15 border border-blue-500/20 p-5 rounded-3xl flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-blue-500 font-extrabold tracking-widest uppercase">실수령액 (Net Pay)</p>
                  <p className="text-xs text-muted-foreground font-bold mt-1">지급액계 - 공제액계</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-400 font-mono tracking-tight">{selectedPayslip.netPay?.toLocaleString() || 0} 원</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-border flex justify-between items-center bg-muted/25 gap-2">
              <button
                onClick={() => {
                  const target = selectedPayslip;
                  setSelectedPayslip(null);
                  handleOpenEditModal(target);
                }}
                className="h-12 px-5 rounded-2xl font-black bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/30 text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" /> 항목 추가/수정
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    window.print();
                  }} 
                  className="h-12 px-6 rounded-2xl font-black bg-muted hover:bg-muted/80 text-foreground border border-border text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                >
                  <Printer className="w-4 h-4" /> 명세서 인쇄
                </button>
                <button 
                  onClick={() => setSelectedPayslip(null)} 
                  className="h-12 px-8 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {payslipToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 relative space-y-6 text-foreground text-center animate-in zoom-in-95 duration-250">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-foreground">급여명세서 영구 삭제</h3>
              <p className="text-sm text-muted-foreground break-keep">
                <strong>[{payslipToDelete.name}]</strong>님의 {selectedMonth} 급여 데이터를 안전 보관소 및 전산 시스템에서 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                disabled={deletingPayslip}
                onClick={() => setPayslipToDelete(null)}
                className="flex-1 py-3.5 bg-muted rounded-xl font-black text-xs border border-border hover:bg-muted/80 transition-all text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                취소
              </button>
              <button 
                disabled={deletingPayslip}
                onClick={confirmDeletePayslip}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-lg shadow-rose-600/15 transition-all text-center disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {deletingPayslip ? <Loader2 className="w-4 h-4 animate-spin" /> : '명세서 삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Excel Paste Modal for PC Admin */}
      {isPasteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsPasteModalOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-[2.5rem] w-full max-w-6xl overflow-hidden shadow-2xl text-foreground flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-6 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground">
                    급여대장 엑셀 붙여넣기 일괄 등록 ({selectedMonth})
                  </h3>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    4줄 병합 헤더 · 세로 split 열 · 2줄 병합 행(0 0 0 0) · 사번 누락 시 이름 자동매칭까지 그대로 지원됩니다.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-muted border border-border rounded-xl text-xs font-black text-foreground outline-none"
                />
                <button
                  onClick={() => setIsPasteModalOpen(false)}
                  className="w-10 h-10 hover:bg-muted border border-border rounded-full flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    엑셀 급여대장 표 전체를 드래그 복사(Ctrl+C) 후 아래에 붙여넣기(Ctrl+V) 하세요.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleInsertSampleBulk}
                      className="px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-xl text-xs font-bold text-foreground cursor-pointer"
                    >
                      사내 급여대장 예시 넣기
                    </button>
                    {pasteText && (
                      <button
                        onClick={() => {
                          setPasteText('');
                          setParsedItems([]);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        지우기
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={7}
                  placeholder={`NO\t성  명\t총\t과세급여액...\n상단 다단 제목 행부터 직원 행까지 통째로 복사해서 붙여넣어 주세요.`}
                  className="w-full bg-background border border-border rounded-2xl p-4 text-xs font-mono text-foreground focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleParseBulkText}
                    disabled={!pasteText.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    데이터 분석 및 사번·이름 자동 매칭
                  </button>
                </div>
              </div>

              {parsedItems.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/40 p-3.5 rounded-2xl border border-border">
                      <span className="text-[10px] font-bold text-muted-foreground block">인식 인원</span>
                      <span className="text-lg font-black text-foreground">{parsedItems.length}명</span>
                    </div>
                    <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/30">
                      <span className="text-[10px] font-bold text-emerald-400 block">자동 매칭 완료</span>
                      <span className="text-lg font-black text-emerald-400">
                        {parsedItems.filter((p) => Boolean(p.uid)).length}명
                      </span>
                    </div>
                    <div className="bg-muted/40 p-3.5 rounded-2xl border border-border">
                      <span className="text-[10px] font-bold text-muted-foreground block">총 지급액</span>
                      <span className="text-sm font-black text-blue-400 font-mono">
                        {parsedItems.reduce((acc, c) => acc + (c.totalEarnings || 0), 0).toLocaleString()}원
                      </span>
                    </div>
                    <div className="bg-muted/40 p-3.5 rounded-2xl border border-border">
                      <span className="text-[10px] font-bold text-muted-foreground block">실 수령액 합계</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        {parsedItems.reduce((acc, c) => acc + (c.netPay || 0), 0).toLocaleString()}원
                      </span>
                    </div>
                  </div>

                  {/* Bulk Custom Item Quick-Apply Bar */}
                  <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-foreground">
                        ➕ 추가 항목 입력칸 (붙여넣기 데이터 전체 일괄 적용)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        엑셀에 새로 추가된 열은 자동 반영되며, 여기서 추가 수당·공제를 직접 입력해 넣을 수도 있습니다.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={bulkExtraType}
                        onChange={(e) => setBulkExtraType(e.target.value as 'EARNING' | 'DEDUCTION')}
                        className="h-9 px-3 rounded-xl bg-background border border-border text-xs font-black text-foreground outline-none"
                      >
                        <option value="EARNING">➕ 지급 항목 추가</option>
                        <option value="DEDUCTION">➖ 공제 항목 추가</option>
                      </select>
                      <input
                        type="text"
                        placeholder="항목명 (예: 상여금, 직무수당, 조합비)"
                        value={bulkExtraLabel}
                        onChange={(e) => setBulkExtraLabel(e.target.value)}
                        className="flex-1 min-w-[180px] h-9 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground outline-none"
                      />
                      <input
                        type="number"
                        placeholder="금액 (원)"
                        value={bulkExtraAmount}
                        onChange={(e) => setBulkExtraAmount(e.target.value)}
                        className="w-36 h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono text-foreground outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBulkExtraToAll}
                        className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> 전체 인원에 적용
                      </button>
                    </div>
                  </div>

                  <div className="border border-border rounded-2xl overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground font-black border-b border-border text-[11px]">
                        <tr>
                          <th className="py-3 px-4">엑셀 성명</th>
                          <th className="py-3 px-4">매칭 상태 / 시스템 계정</th>
                          <th className="py-3 px-4 text-right">총근로</th>
                          <th className="py-3 px-4 text-right">연장</th>
                          <th className="py-3 px-4 text-right">추가 항목</th>
                          <th className="py-3 px-4 text-right">총지급액(다)</th>
                          <th className="py-3 px-4 text-right">공제액계(라)</th>
                          <th className="py-3 px-4 text-right">실수령액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedItems.map((item, idx) => (
                          <tr key={idx} className={!item.uid ? 'bg-rose-500/5' : 'hover:bg-muted/20'}>
                            <td className="py-3 px-4 font-bold text-foreground">
                              {item.rawName}
                              {item.rawEmpId && (
                                <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                                  ({item.rawEmpId})
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {item.uid ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <Check className="w-3 h-3" />
                                    {item.matchStatus === 'MATCHED_NAME' ? '이름 매칭' : '사번 매칭'}
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {item.matchedUser?.displayName} ({item.matchedUser?.employeeId || '사번미등록'})
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <select
                                    defaultValue=""
                                    onChange={(e) => handleAssignBulkUser(idx, e.target.value)}
                                    className="h-8 px-2 rounded-lg bg-background border border-rose-500/40 text-[11px] font-bold text-foreground outline-none"
                                  >
                                    <option value="" disabled>
                                      사원 수동 선택...
                                    </option>
                                    {allUsers.map((u) => (
                                      <option key={u.uid} value={u.uid}>
                                        {u.displayName} ({u.employeeId || '사번미등록'})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">{item.totalHours ?? 0}h</td>
                            <td className="py-3 px-4 text-right font-mono">{item.overtimeHours ?? 0}h</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                {item.customEarnings?.map((ce, i) => (
                                  <span key={`e-${i}`} className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] font-bold">
                                    +{ce.label} {ce.amount.toLocaleString()}
                                  </span>
                                ))}
                                {item.customDeductions?.map((cd, i) => (
                                  <span key={`d-${i}`} className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[10px] font-bold">
                                    -{cd.label} {cd.amount.toLocaleString()}
                                  </span>
                                ))}
                                {!item.customEarnings?.length && !item.customDeductions?.length && (
                                  <span className="text-[10px] text-muted-foreground">-</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-blue-400 font-bold">
                              {(item.totalEarnings || 0).toLocaleString()}원
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-rose-400 font-bold">
                              {(item.totalDeductions || 0).toLocaleString()}원
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-400 font-black">
                              {(item.netPay || 0).toLocaleString()}원
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-5 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => navigate('/payslip-mgmt')}
                className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                상세 명세서 미리보기 / 파일 업로드 화면으로 이동
              </button>
              {confirmPartialBulk ? (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-2xl">
                  <span className="text-xs font-bold text-amber-400">
                    미매칭 {parsedItems.filter((p) => !p.uid).length}명 제외 후 저장할까요?
                  </span>
                  <button
                    onClick={() => setConfirmPartialBulk(false)}
                    className="px-3 py-1.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handleSaveBulkParsed(true)}
                    disabled={savingBulk}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer"
                  >
                    {savingBulk ? '저장 중...' : '매칭 인원만 저장'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPasteModalOpen(false)}
                    className="px-5 py-3 bg-muted border border-border rounded-2xl text-xs font-black text-foreground cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => handleSaveBulkParsed(false)}
                    disabled={savingBulk || parsedItems.filter((p) => Boolean(p.uid)).length === 0}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    {savingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    매칭된 {parsedItems.filter((p) => Boolean(p.uid)).length}명 일괄 저장
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PCAdminLayout>
  );
};

export default PCAdminPayslip;
