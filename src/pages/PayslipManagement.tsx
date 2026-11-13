import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, setDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Payslip, PayslipExtraItem, UserProfile } from '../types';
import { read, utils, write } from 'xlsx';
import { 
  Upload, 
  Download, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Loader2, 
  ClipboardPaste, 
  Users, 
  FileText, 
  HelpCircle, 
  Sparkles, 
  Check, 
  Search, 
  Eye, 
  Trash2,
  Building,
  ShieldCheck,
  UserCheck,
  Monitor,
  User,
  Plus,
  X,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import PayslipDocument from '../components/PayslipDocument';
import { Button } from '@/components/ui/button';
import {
  ParsedPayslipItem,
  parsePayslipMatrix,
  splitPastedSpreadsheetText,
} from '../lib/payslipParser';

const PayslipManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'PASTE' | 'FILE' | 'REGISTERED'>('PASTE');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedPayslipItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');
  const [previewItem, setPreviewItem] = useState<ParsedPayslipItem | null>(null);

  // Registered payslips for the selected month in Firestore
  const [existingPayslips, setExistingPayslips] = useState<Payslip[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [selectedExistingPayslip, setSelectedExistingPayslip] = useState<Payslip | null>(null);
  const [payslipToDelete, setPayslipToDelete] = useState<{ id: string; userName: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [partialSaveConfirmOpen, setPartialSaveConfirmOpen] = useState(false);

  // Global custom extra item quick-apply inputs (for parsedData)
  const [bulkExtraType, setBulkExtraType] = useState<'EARNING' | 'DEDUCTION'>('EARNING');
  const [bulkExtraLabel, setBulkExtraLabel] = useState('');
  const [bulkExtraAmount, setBulkExtraAmount] = useState('');

  // Per-person extra item modal (for either a parsed preview row or a registered Firestore payslip)
  const [editingExtraTarget, setEditingExtraTarget] = useState<
    | { mode: 'PARSED'; index: number; name: string; baseEarnings: number; baseDeductions: number }
    | { mode: 'EXISTING'; payslip: Payslip; name: string; baseEarnings: number; baseDeductions: number }
    | null
  >(null);
  const [modalCustomEarnings, setModalCustomEarnings] = useState<PayslipExtraItem[]>([]);
  const [modalCustomDeductions, setModalCustomDeductions] = useState<PayslipExtraItem[]>([]);
  const [modalEarnLabel, setModalEarnLabel] = useState('');
  const [modalEarnAmount, setModalEarnAmount] = useState('');
  const [modalDedLabel, setModalDedLabel] = useState('');
  const [modalDedAmount, setModalDedAmount] = useState('');
  const [savingExtraModal, setSavingExtraModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchExistingPayslips();
  }, [month]);

  const fetchExistingPayslips = async () => {
    setLoadingExisting(true);
    try {
      const q = query(
        collection(db, 'payslips'),
        where('month', '==', month)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Payslip));
      setExistingPayslips(data.sort((a, b) => (a.userName || '').localeCompare(b.userName || '')));
    } catch (e) {
      console.error('Error fetching existing payslips:', e);
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleDeleteExistingPayslip = (id: string, userName: string) => {
    if (!id) {
      toast.error('명세서 문서 ID를 찾을 수 없습니다.');
      return;
    }
    setPayslipToDelete({ id, userName });
  };

  const confirmDeleteExistingPayslip = async () => {
    if (!payslipToDelete) return;
    const { id, userName } = payslipToDelete;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'payslips', id));
      setExistingPayslips(prev => prev.filter(item => item.id !== id));
      if (selectedExistingPayslip?.id === id) {
        setSelectedExistingPayslip(null);
      }
      setPayslipToDelete(null);
      toast.success(`${userName}님의 ${month} 급여명세서가 삭제되었습니다.`);
      fetchExistingPayslips();
    } catch (e: any) {
      console.error('Error deleting payslip:', e);
      toast.error(`삭제 처리에 실패했습니다.${e?.code ? ` (${e.code})` : ''}`);
    } finally {
      setDeletingId(null);
    }
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const list: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        list.push({ ...data, uid: docSnap.id });
      });
      setAllUsers(list);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('사용자 목록을 불러오는데 실패했습니다.');
    }
  };

  // Handle Text Paste Parsing
  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      toast.warning('붙여넣을 엑셀 내용을 입력란에 넣어주세요.');
      return;
    }

    try {
      const matrix = splitPastedSpreadsheetText(pastedText);
      const processed = parsePayslipMatrix(matrix, month, allUsers);

      if (processed.length === 0) {
        toast.error('유효한 급여 데이터를 인식하지 못했습니다. 성명(또는 사번)과 급여 항목 열이 포함되어 있는지 확인해주세요.');
        return;
      }

      setParsedData(processed);
      const empIdMatched = processed.filter(p => p.uid && p.matchStatus === 'MATCHED_EMP_ID').length;
      const nameMatched = processed.filter(p => p.uid && p.matchStatus === 'MATCHED_NAME').length;
      const matchedCount = empIdMatched + nameMatched;
      toast.success(
        nameMatched > 0
          ? `총 ${processed.length}명 중 ${matchedCount}명 매칭 완료 (사번 ${empIdMatched}명 · 이름 자동매칭 ${nameMatched}명)`
          : `총 ${processed.length}명의 데이터 중 ${matchedCount}명이 일치하여 매칭되었습니다!`
      );
    } catch (err: any) {
      console.error('Error parsing pasted text:', err);
      toast.error('붙여넣은 텍스트 분석 중 오류가 발생했습니다.');
    }
  };

  // Handle Excel File Upload (alternative when file upload is permitted)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData = utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        const stringMatrix = rawData.map(row => row.map(cell => String(cell || '').trim()));
        
        const processed = parsePayslipMatrix(stringMatrix, month, allUsers);
        if (processed.length === 0) {
          toast.error('엑셀 파일에서 유효한 급여 데이터를 찾을 수 없습니다.');
          return;
        }

        setParsedData(processed);
        const matchedCount = processed.filter(p => p.uid).length;
        toast.success(`엑셀 파일에서 ${processed.length}명의 데이터를 불러왔습니다. (자동 매칭: ${matchedCount}명)`);
      } catch (error) {
        console.error('Error parsing excel:', error);
        toast.error('엑셀 파일 분석에 실패했습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Manual matching correction: user selects a registered user for an unmatched row
  const handleAssignUser = (index: number, selectedUid: string) => {
    const found = allUsers.find(u => u.uid === selectedUid);
    if (!found) return;

    setParsedData(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        uid: found.uid,
        employeeId: found.employeeId || copy[index].rawEmpId,
        userName: found.displayName || copy[index].rawName,
        matchedUser: found,
        matchStatus: 'MATCHED_EMP_ID'
      };
      return copy;
    });
    toast.success(`${found.displayName}(사번: ${found.employeeId}) 님으로 수동 매칭되었습니다.`);
  };

  // Apply a global custom extra item across all parsed rows
  const handleApplyBulkExtra = () => {
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
    setParsedData(prev =>
      prev.map(item => {
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
    toast.success(`"${label}" (${amount.toLocaleString()}원) 항목이 분석된 ${parsedData.length}명 전체에 적용되었습니다.`);
    setBulkExtraLabel('');
    setBulkExtraAmount('');
  };

  const openExtraEditorForParsed = (index: number, item: ParsedPayslipItem) => {
    const currentCustomEarnSum = (item.customEarnings || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const currentCustomDedSum = (item.customDeductions || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    setModalCustomEarnings((item.customEarnings || []).map(x => ({ ...x })));
    setModalCustomDeductions((item.customDeductions || []).map(x => ({ ...x })));
    setModalEarnLabel('');
    setModalEarnAmount('');
    setModalDedLabel('');
    setModalDedAmount('');
    setEditingExtraTarget({
      mode: 'PARSED',
      index,
      name: item.userName || item.rawName,
      baseEarnings: (item.totalEarnings || 0) - currentCustomEarnSum,
      baseDeductions: (item.totalDeductions || 0) - currentCustomDedSum,
    });
  };

  const openExtraEditorForExisting = (payslip: Payslip) => {
    const currentCustomEarnSum = (payslip.customEarnings || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const currentCustomDedSum = (payslip.customDeductions || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    setModalCustomEarnings((payslip.customEarnings || []).map(x => ({ ...x })));
    setModalCustomDeductions((payslip.customDeductions || []).map(x => ({ ...x })));
    setModalEarnLabel('');
    setModalEarnAmount('');
    setModalDedLabel('');
    setModalDedAmount('');
    setEditingExtraTarget({
      mode: 'EXISTING',
      payslip,
      name: payslip.userName,
      baseEarnings: (payslip.totalEarnings || 0) - currentCustomEarnSum,
      baseDeductions: (payslip.totalDeductions || 0) - currentCustomDedSum,
    });
  };

  const handleSaveExtraModal = async () => {
    if (!editingExtraTarget) return;
    // Flush any pending typed row so clicking Save directly works seamlessly
    const finalEarnings = [...modalCustomEarnings];
    const pEarnLabel = modalEarnLabel.trim();
    const pEarnAmt = Number(String(modalEarnAmount).replace(/,/g, '')) || 0;
    if (pEarnLabel && pEarnAmt) finalEarnings.push({ label: pEarnLabel, amount: pEarnAmt });

    const finalDeductions = [...modalCustomDeductions];
    const pDedLabel = modalDedLabel.trim();
    const pDedAmt = Number(String(modalDedAmount).replace(/,/g, '')) || 0;
    if (pDedLabel && pDedAmt) finalDeductions.push({ label: pDedLabel, amount: pDedAmt });

    const extraEarnSum = finalEarnings.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const extraDedSum = finalDeductions.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const nextTotalEarnings = editingExtraTarget.baseEarnings + extraEarnSum;
    const nextTotalDeductions = editingExtraTarget.baseDeductions + extraDedSum;
    const nextNetPay = nextTotalEarnings - nextTotalDeductions;

    if (editingExtraTarget.mode === 'PARSED') {
      const targetIdx = editingExtraTarget.index;
      setParsedData(prev => {
        const copy = [...prev];
        if (!copy[targetIdx]) return prev;
        copy[targetIdx] = {
          ...copy[targetIdx],
          customEarnings: finalEarnings,
          customDeductions: finalDeductions,
          totalEarnings: nextTotalEarnings,
          totalDeductions: nextTotalDeductions,
          netPay: nextNetPay,
        };
        return copy;
      });
      toast.success(`${editingExtraTarget.name}님의 추가 항목이 반영되었습니다.`);
      setEditingExtraTarget(null);
      return;
    }

    const docId = editingExtraTarget.payslip.id;
    if (!docId) {
      toast.error('명세서 문서 ID를 찾을 수 없습니다.');
      return;
    }

    setSavingExtraModal(true);
    try {
      await setDoc(
        doc(db, 'payslips', docId),
        {
          customEarnings: finalEarnings,
          customDeductions: finalDeductions,
          totalEarnings: nextTotalEarnings,
          totalDeductions: nextTotalDeductions,
          netPay: nextNetPay,
        },
        { merge: true }
      );
      setExistingPayslips(prev =>
        prev.map(p =>
          p.id === docId
            ? {
                ...p,
                customEarnings: finalEarnings,
                customDeductions: finalDeductions,
                totalEarnings: nextTotalEarnings,
                totalDeductions: nextTotalDeductions,
                netPay: nextNetPay,
              }
            : p
        )
      );
      toast.success(`${editingExtraTarget.name}님의 급여명세서 추가 항목이 저장되었습니다.`);
      setEditingExtraTarget(null);
    } catch (e) {
      console.error('Failed to save custom payslip items:', e);
      toast.error('추가 항목 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingExtraModal(false);
    }
  };

  // Save all matched payslips into Firestore
  const executeSaveAll = async (readyItems: ParsedPayslipItem[]) => {
    setPartialSaveConfirmOpen(false);
    setLoading(true);
    try {
      let savedCount = 0;
      for (const item of readyItems) {
        const docId = `${item.uid}_${month}`;
        
        const payload: Payslip = {
          id: docId,
          uid: item.uid!,
          employeeId: item.employeeId || '',
          userName: item.userName || '',
          month: month,
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
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'payslips', docId), payload, { merge: true });
        savedCount++;
      }

      toast.success(`🎉 ${savedCount}명의 급여명세서가 해당 임직원 계정으로 정확히 등록되었습니다!`);
      setParsedData([]);
      setPastedText('');
      fetchExistingPayslips();
      setActiveTab('REGISTERED');
    } catch (error) {
      console.error('Error saving payslips:', error);
      toast.error('급여명세서 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = () => {
    if (parsedData.length === 0) return;

    const readyItems = parsedData.filter(d => Boolean(d.uid));
    const unmatchedItems = parsedData.filter(d => !d.uid);

    if (readyItems.length === 0) {
      toast.error('매칭된 사용자가 없습니다. 사번/성명을 확인하거나 수동으로 사원을 선택해주세요.');
      return;
    }

    if (unmatchedItems.length > 0) {
      setPartialSaveConfirmOpen(true);
      return;
    }

    executeSaveAll(readyItems);
  };

  // Provide realistic multi-row ERP payroll ledger sample for quick paste testing
  const insertSampleData = () => {
    const emp1Name = allUsers[0]?.displayName || '문석주';
    const sample = [
      'NO\t성  명\t총\t과       세       급       여       액\t\t\t\t\t\t\t\t수       당\t\t\t기   타   급   여   액\t\t\t\t\t\t공              제              내              역\t\t\t\t\t\t\t\t지 급 액',
      '\t\t작\t정\t주\t유\t교\t기\t시\t시\t시간급여\t수\t기\t\t\t휴  일\t연  장\t중\t기타\t(다)\t갑\t주\t건  강\t국  민\t고  용\t식\t세\t공제액계\t',
      '\t\t업\t\t\t\t\t\t간\t\t액    계\t\t\t합    계\t년  휴\t\t가  급\t식\t급여액\t\t근\t민\t\t\t\t권\t탁\t\t(다 - 라)',
      '\t\t일\t취\t차\t휴\t육\t타\t계\t급\t(가)\t당\t타\t(나)\t\t근  로\t야  간\t대\t(다)\t(나 + 다)\t세\t세\t보  험\t연  금\t보  험\t대\t비\t(라)\t',
      `24\t${emp1Name}\t\t205\t32\t16\t8\t\t261\t\t3,500,000\t\t\t3,500,000\t4\t0\t55\t\t0\t3,500,000\t127,220\t12,720\t142,350\t160,880\t31,500\t7,700\t\t482,370\t3,017,630`,
      '\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\t0\t\t\t\t\t\t\t\t\t\t\t'
    ].join('\n');

    setPastedText(sample);
    toast.info('사내 급여대장(다단 병합 헤더 포함) 샘플이 입력되었습니다. [데이터 분석 및 사번·이름 자동 매칭] 버튼을 눌러보세요.');
  };

  // Filtered parsed data for the preview table
  const filteredData = useMemo(() => {
    return parsedData.filter(item => {
      const matchQuery = 
        !searchFilter.trim() || 
        item.rawEmpId.toLowerCase().includes(searchFilter.toLowerCase()) || 
        item.rawName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.matchedUser?.displayName.toLowerCase().includes(searchFilter.toLowerCase());

      const matchState = 
        statusFilter === 'ALL' ||
        (statusFilter === 'MATCHED' && Boolean(item.uid)) ||
        (statusFilter === 'UNMATCHED' && !item.uid);

      return matchQuery && matchState;
    });
  }, [parsedData, searchFilter, statusFilter]);

  // Aggregate stats of parsed items
  const stats = useMemo(() => {
    const total = parsedData.length;
    const matched = parsedData.filter(d => Boolean(d.uid)).length;
    const unmatched = total - matched;
    const sumEarnings = parsedData.reduce((acc, cur) => acc + (cur.totalEarnings || 0), 0);
    const sumTaxes = parsedData.reduce((acc, cur) => acc + (cur.incomeTax || 0) + (cur.localIncomeTax || 0), 0);
    const sumNetPay = parsedData.reduce((acc, cur) => acc + (cur.netPay || 0), 0);
    return { total, matched, unmatched, sumEarnings, sumTaxes, sumNetPay };
  }, [parsedData]);

  // Download template excel file
  const downloadTemplate = () => {
    const data = [
      ['사번', '성명', '기본급', '경력수당', '식대', '연장근로', '총급여액', '갑근세', '주민세', '건강보험', '국민연금', '고용보험', '공제액계', '지급액', '연차기준일'],
      ['x66626', '문서주', 3500000, 0, 100000, 0, 3600000, 127220, 12720, 146420, 171000, 31500, 488860, 3111140, '2026.01.01'],
      ['X201802', '성재윤', 3200000, 50000, 100000, 0, 3350000, 110000, 11000, 135000, 150000, 28000, 434000, 2916000, '2026.01.01']
    ];

    const ws = utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '급여명세서양식');
    
    const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `건명기업_급여명세서_표준양식_${month}.xlsx`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    toast.success('표준 엑셀 양식이 다운로드되었습니다.');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-foreground pb-28">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              보안 정책 대응 지원
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              총 {allUsers.length}명 사원 계정 연동
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            급여명세서 일괄 등록 (사번 · 이름 자동 매칭)
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 font-medium">
            보안 정책으로 엑셀 파일 업로드가 차단된 경우, 엑셀 내용을 복사하여 <strong>붙여넣기</strong>하면 <strong>사번</strong> 또는 <strong>성명(이름)</strong> 기준으로 오류 없이 자동 매칭되어 등록됩니다.
          </p>
        </div>

        {/* Global Month & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-card p-1.5 px-3 rounded-xl border border-border">
            <span className="text-xs font-bold text-muted-foreground">지급월</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm font-black text-foreground outline-none cursor-pointer"
            />
          </div>

          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="h-10 text-xs font-bold gap-1.5 rounded-xl border-border"
          >
            <Download className="w-3.5 h-3.5" />
            서식 다운
          </Button>

          {/* PC Admin Switcher Button */}
          <Button
            variant="outline"
            onClick={() => navigate('/admin/pc/payslip')}
            className="h-10 text-xs font-bold gap-1.5 rounded-xl border-border hover:bg-muted"
          >
            <Monitor className="w-3.5 h-3.5 text-blue-500" />
            🖥️ PC 관리자 대시보드
          </Button>

          {/* My Payslip Link */}
          <Button
            variant="ghost"
            onClick={() => navigate('/mypage/payslip')}
            className="h-10 text-xs font-bold gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <User className="w-3.5 h-3.5" />
            내 명세서
          </Button>
        </div>
      </div>

      {/* Tabs: Paste vs File Upload vs Registered List */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-1.5 rounded-2xl border border-border w-fit">
        <button
          onClick={() => setActiveTab('PASTE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'PASTE'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          📋 엑셀 내용 붙여넣기 등록 (권장 • 보안정책 대응)
        </button>

        <button
          onClick={() => setActiveTab('FILE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'FILE'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Upload className="w-4 h-4" />
          📁 엑셀 파일 직접 업로드
        </button>

        <button
          onClick={() => setActiveTab('REGISTERED')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'REGISTERED'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <FileText className="w-4 h-4" />
          📑 등록된 명세서 현황 ({existingPayslips.length}건)
        </button>
      </div>

      {/* TAB 1: Paste Input Section */}
      {activeTab === 'PASTE' && (
        <div className="bg-card rounded-3xl border border-border p-5 sm:p-7 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                엑셀 데이터 붙여넣기 입력창
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                사내 엑셀 파일에서 표 전체를 드래그하여 복사(Ctrl+C)한 후 아래 상자에 붙여넣기(Ctrl+V) 하세요.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={insertSampleData}
                className="text-xs font-bold gap-1 rounded-xl border-border bg-background/50 hover:bg-muted"
              >
                예시 데이터 넣기
              </Button>
              {pastedText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPastedText('')}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  지우기
                </Button>
              )}
            </div>
          </div>

          {/* Paste Textarea */}
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`[사용 방법 - 사내 급여대장 다단 병합 표 그대로 지원]\n1. 엑셀 급여대장 전체(상단 'NO  성 명  총  과세급여액 ...' 다단 제목 포함)를 드래그 복사(Ctrl+C)합니다.\n2. 아래 상자에 그대로 붙여넣기(Ctrl+V) 하세요.\n3. 세로로 쪼개진 병합 헤더(정취·주차·갑근세·건강보험·국민연금 등)와 직원별 2줄 병합 행(0 0 0 0), 사번 없는 '성명' 매칭까지 모두 자동 처리됩니다.`}
            rows={8}
            className="w-full bg-background border border-border rounded-2xl p-4 text-xs font-mono text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/40 leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>다단 병합 헤더 · 2줄 합쳐진 셀 · 사번 누락(이름 자동매칭)을 모두 지원하며 파일 반출 없이 안전하게 등록됩니다.</span>
            </div>

            <Button
              onClick={handleParsePastedText}
              disabled={!pastedText.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl px-6 h-11 gap-2 cursor-pointer shadow-md"
            >
              <UserCheck className="w-4 h-4" />
              데이터 분석 및 사번·이름 자동 매칭
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: File Upload Section */}
      {activeTab === 'FILE' && (
        <div className="bg-card rounded-3xl border border-dashed border-border p-8 sm:p-12 text-center shadow-xl space-y-4">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground">엑셀 파일 직접 업로드</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              PC 또는 브라우저에서 파일 업로드가 허용된 환경이라면 .xlsx 또는 .xls 파일을 직접 선택해주세요.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" />
            엑셀 파일 선택 (.xlsx / .xls)
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {/* SECTION: Parsed Results & Matching Dashboard */}
      {parsedData.length > 0 && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-card p-3.5 rounded-2xl border border-border">
              <span className="text-[10px] font-bold text-muted-foreground block mb-0.5">분석된 총 사원수</span>
              <span className="text-xl font-black text-foreground font-mono">{stats.total}명</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">✅ 매칭 성공 (사번/이름)</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{stats.matched}명</span>
            </div>
            <div className={`p-3.5 rounded-2xl border ${stats.unmatched > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-card border-border'}`}>
              <span className={`text-[10px] font-bold block mb-0.5 ${stats.unmatched > 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>
                {stats.unmatched > 0 ? '⚠️ 미매칭 인원' : '미매칭 없음'}
              </span>
              <span className={`text-xl font-black font-mono ${stats.unmatched > 0 ? 'text-rose-400' : 'text-foreground'}`}>
                {stats.unmatched}명
              </span>
            </div>
            <div className="bg-card p-3.5 rounded-2xl border border-border">
              <span className="text-[10px] font-bold text-muted-foreground block mb-0.5">총 지급액 합계</span>
              <span className="text-sm font-black text-foreground font-mono truncate block">{stats.sumEarnings.toLocaleString()}원</span>
            </div>
            <div className="bg-card p-3.5 rounded-2xl border border-border">
              <span className="text-[10px] font-bold text-muted-foreground block mb-0.5">총 세금 합계</span>
              <span className="text-sm font-black text-rose-400 font-mono truncate block">{stats.sumTaxes.toLocaleString()}원</span>
            </div>
            <div className="bg-card p-3.5 rounded-2xl border border-border">
              <span className="text-[10px] font-bold text-muted-foreground block mb-0.5">총 실수령액 합계</span>
              <span className="text-sm font-black text-emerald-400 font-mono truncate block">{stats.sumNetPay.toLocaleString()}원</span>
            </div>
          </div>

          {/* Table Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="사번 또는 이름 검색..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-10 pl-9 pr-3 rounded-xl bg-background border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-primary w-48 sm:w-60"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border text-xs">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${statusFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  전체 ({stats.total})
                </button>
                <button
                  onClick={() => setStatusFilter('MATCHED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${statusFilter === 'MATCHED' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}
                >
                  매칭 ({stats.matched})
                </button>
                {stats.unmatched > 0 && (
                  <button
                    onClick={() => setStatusFilter('UNMATCHED')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${statusFilter === 'UNMATCHED' ? 'bg-rose-600 text-white' : 'text-muted-foreground'}`}
                  >
                    미매칭 ({stats.unmatched})
                  </button>
                )}
              </div>
            </div>

            {/* Save All Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setParsedData([])}
                className="rounded-xl border-border text-xs"
              >
                전체 초기화
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={loading || stats.matched === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl px-5 h-10 gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                매칭된 {stats.matched}명 급여명세서 최종 일괄 저장
              </Button>
            </div>
          </div>

          {/* Custom Extra Item Quick-Apply Bar */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" />
                추가 지급·공제 항목 입력칸 (신규 항목 반영)
              </span>
              <span className="text-[11px] text-muted-foreground">
                엑셀 새 열은 자동 인식되며, 누락된 추가 항목은 전체 적용 또는 행별 <strong>[항목 추가]</strong>로 반영할 수 있습니다.
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                placeholder="항목명 (예: 상여금, 직무수당, 가불금, 조합비)"
                value={bulkExtraLabel}
                onChange={(e) => setBulkExtraLabel(e.target.value)}
                className="flex-1 h-9 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground outline-none"
              />
              <input
                type="number"
                placeholder="금액 (원)"
                value={bulkExtraAmount}
                onChange={(e) => setBulkExtraAmount(e.target.value)}
                className="w-full sm:w-36 h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono text-foreground outline-none"
              />
              <Button
                type="button"
                onClick={handleApplyBulkExtra}
                className="h-9 px-4 rounded-xl text-xs font-black gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> 전체 인원에 적용
              </Button>
            </div>
          </div>

          {/* Matching Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black border-b border-border text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">No</th>
                    <th className="py-3 px-3">엑셀 사번</th>
                    <th className="py-3 px-3">엑셀 성명</th>
                    <th className="py-3 px-4">매칭 상태</th>
                    <th className="py-3 px-4">매칭된 시스템 사원</th>
                    <th className="py-3 px-3 text-right">기본급</th>
                    <th className="py-3 px-3 text-right">총지급액</th>
                    <th className="py-3 px-3 text-right">총세금</th>
                    <th className="py-3 px-3 text-right">총공제액</th>
                    <th className="py-3 px-3 text-right">실수령액</th>
                    <th className="py-3 px-3 text-center">추가항목 / 미리보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredData.map((item, idx) => {
                    const isMatched = Boolean(item.uid);
                    const originalIndex = parsedData.indexOf(item);
                    const customCount = (item.customEarnings?.length || 0) + (item.customDeductions?.length || 0);
                    return (
                      <tr 
                        key={idx}
                        className={`hover:bg-muted/30 transition-colors ${!isMatched ? 'bg-rose-500/5' : ''}`}
                      >
                        <td className="py-3 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-foreground">
                          {item.rawEmpId || <span className="text-muted-foreground/60 text-[10px]">미기재</span>}
                        </td>
                        <td className="py-3 px-3 font-bold text-foreground">
                          {item.rawName || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {isMatched ? (
                            item.matchStatus === 'MATCHED_NAME' ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/15 text-blue-400 border border-blue-500/30 w-fit">
                                  <Check className="w-3 h-3" />
                                  이름 매칭 완료 (사번 미기재)
                                </span>
                                {item.isDuplicateName && (
                                  <span className="text-[10px] font-bold text-amber-400">
                                    ⚠️ 동명이인 존재 — 계정 확인 권장
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Check className="w-3 h-3" />
                                사번 일치 (매칭 완료)
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <AlertCircle className="w-3 h-3" />
                              미매칭 (수동 선택)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isMatched ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                                {item.matchedUser?.displayName?.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-foreground block leading-tight">
                                  {item.matchedUser?.displayName}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  사번: {item.matchedUser?.employeeId} ({item.matchedUser?.departmentName || '현장'})
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                onChange={(e) => handleAssignUser(parsedData.indexOf(item), e.target.value)}
                                defaultValue=""
                                className="h-8 px-2 rounded-lg bg-background border border-rose-500/40 text-[11px] font-bold text-foreground outline-none"
                              >
                                <option value="" disabled>사원 직접 선택 (수동 매칭)...</option>
                                {allUsers.map(u => (
                                  <option key={u.uid} value={u.uid}>
                                    {u.displayName} ({u.employeeId || '사번미등록'}) - {u.departmentName || '부서미지정'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">{item.baseSalary?.toLocaleString()}원</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-400">{item.totalEarnings?.toLocaleString()}원</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">
                          {((item.incomeTax || 0) + (item.localIncomeTax || 0)).toLocaleString()}원
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">{item.totalDeductions?.toLocaleString()}원</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                          {item.netPay?.toLocaleString()}원
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openExtraEditorForParsed(originalIndex, item)}
                              className="h-8 px-2 text-[11px] font-bold gap-1 rounded-lg border-border hover:bg-muted"
                            >
                              <Plus className="w-3 h-3 text-primary" />
                              항목{customCount > 0 ? `(${customCount})` : ''}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewItem(item)}
                              className="h-8 px-2 text-xs font-bold gap-1 hover:bg-muted"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              보기
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Registered Payslips Management for Mobile Admin */}
      {activeTab === 'REGISTERED' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-5 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-muted-foreground">발행 등록 인원</span>
              <p className="text-2xl font-black text-foreground mt-1">{existingPayslips.length}명</p>
            </div>
            <div className="bg-card border border-border p-5 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-muted-foreground">총 지급액 합계</span>
              <p className="text-xl font-black text-blue-400 mt-1">
                {existingPayslips.reduce((acc, c) => acc + (c.totalEarnings || 0), 0).toLocaleString()}원
              </p>
            </div>
            <div className="bg-card border border-border p-5 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-muted-foreground">총 세금(소득+주민) 합계</span>
              <p className="text-xl font-black text-rose-400 mt-1">
                {existingPayslips.reduce((acc, c) => acc + (c.incomeTax || 0) + (c.localIncomeTax || 0), 0).toLocaleString()}원
              </p>
            </div>
            <div className="bg-card border border-border p-5 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-muted-foreground">총 실수령액 합계</span>
              <p className="text-xl font-black text-emerald-400 mt-1">
                {existingPayslips.reduce((acc, c) => acc + (c.netPay || 0), 0).toLocaleString()}원
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-foreground">{month}월 급여 등록 명세표 목록</span>
              <span className="text-xs text-muted-foreground font-mono">({existingPayslips.length}명)</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="사원명 / 사번 검색..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 pr-4 py-2 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none w-64"
              />
            </div>
          </div>

          {/* Registered Payslips Card / Table List */}
          <div className="space-y-3">
            {loadingExisting ? (
              <div className="p-12 text-center text-muted-foreground font-bold bg-card border border-border rounded-2xl">
                급여명세서 목록을 불러오는 중입니다...
              </div>
            ) : existingPayslips.length === 0 ? (
              <div className="p-12 text-center bg-card border border-border rounded-3xl space-y-3">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
                <h4 className="text-base font-black text-foreground">{month}월에 등록된 급여명세서가 없습니다</h4>
                <p className="text-xs text-muted-foreground">
                  상단의 [📋 엑셀 내용 붙여넣기 등록] 탭에서 엑셀 표를 복사해 붙여넣으면 즉시 전산에 등록됩니다.
                </p>
                <Button onClick={() => setActiveTab('PASTE')} className="rounded-xl font-bold text-xs mt-2">
                  엑셀 내용 붙여넣기 등록하러 가기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {existingPayslips
                  .filter(p => !searchFilter.trim() || p.userName?.toLowerCase().includes(searchFilter.toLowerCase()) || p.employeeId?.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map(p => (
                    <div key={p.id} className="bg-card border border-border p-5 rounded-2xl space-y-3 hover:bg-muted/30 transition-all">
                      <div className="flex items-center justify-between border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black">
                            {p.userName?.slice(0, 1)}
                          </div>
                          <div>
                            <h4 className="font-black text-foreground text-sm">{p.userName}</h4>
                            <span className="text-[10px] text-muted-foreground font-mono">사번: {p.employeeId || p.uid}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          발행 완료
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-muted/40 p-2 rounded-xl">
                          <span className="text-[10px] text-muted-foreground block">총지급액</span>
                          <strong className="text-blue-400 font-mono text-[11px]">{p.totalEarnings?.toLocaleString()}원</strong>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-xl">
                          <span className="text-[10px] text-muted-foreground block">공제액계</span>
                          <strong className="text-rose-400 font-mono text-[11px]">{p.totalDeductions?.toLocaleString()}원</strong>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-xl">
                          <span className="text-[10px] text-muted-foreground block">실수령액</span>
                          <strong className="text-emerald-400 font-mono text-[11px] font-black">{p.netPay?.toLocaleString()}원</strong>
                        </div>
                      </div>

                      {(p.customEarnings?.length || p.customDeductions?.length) ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {p.customEarnings?.map((ce, i) => (
                            <span key={`ce-${i}`} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                              +{ce.label} {ce.amount.toLocaleString()}
                            </span>
                          ))}
                          {p.customDeductions?.map((cd, i) => (
                            <span key={`cd-${i}`} className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20">
                              -{cd.label} {cd.amount.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openExtraEditorForExisting(p)}
                          className="text-xs font-bold gap-1 rounded-xl h-8 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          항목 추가
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedExistingPayslip(p)}
                          className="text-xs font-bold gap-1 rounded-xl h-8"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          명세서 보기
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteExistingPayslip(p.id!, p.userName)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl h-8"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Payslip Document Preview Modal */}
      {selectedExistingPayslip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedExistingPayslip(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl sm:rounded-3xl p-3 sm:p-6 w-full max-w-4xl shadow-2xl space-y-3 sm:space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <h3 className="text-sm sm:text-lg font-black text-foreground truncate">
                  [{selectedExistingPayslip.userName}] {month} 급여명세서
                </h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const p = selectedExistingPayslip;
                    setSelectedExistingPayslip(null);
                    openExtraEditorForExisting(p);
                  }}
                  className="rounded-xl border-indigo-500/30 text-indigo-400 text-xs font-bold gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 항목 추가
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="rounded-xl border-border text-xs font-bold hidden sm:inline-flex"
                >
                  인쇄
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedExistingPayslip(null)}
                  className="rounded-xl border-border text-xs font-bold"
                >
                  닫기
                </Button>
              </div>
            </div>

            <div className="bg-zinc-200 dark:bg-zinc-800 p-2 sm:p-4 rounded-xl sm:rounded-2xl">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-[850px] mx-auto overflow-hidden">
                <PayslipDocument payslip={selectedExistingPayslip} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Document Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl sm:rounded-3xl p-3 sm:p-6 w-full max-w-4xl shadow-2xl space-y-3 sm:space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <h3 className="text-sm sm:text-lg font-black text-foreground truncate">
                  [{previewItem.userName}] {month} 미리보기
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewItem(null)}
                className="rounded-xl border-border shrink-0"
              >
                닫기
              </Button>
            </div>

            <div className="bg-zinc-200 dark:bg-zinc-800 p-2 sm:p-4 rounded-xl sm:rounded-2xl">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-[850px] mx-auto overflow-hidden">
                <PayslipDocument payslip={previewItem as Payslip} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-Person Custom Extra Items Editor Modal */}
      {editingExtraTarget && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => !savingExtraModal && setEditingExtraTarget(null)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  [{editingExtraTarget.name}] 추가 지급·공제 항목 입력
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  기존 표에 없는 추가 수당이나 공제 항목을 자유롭게 넣고 바로 금액에 반영합니다.
                </p>
              </div>
              <button
                onClick={() => !savingExtraModal && setEditingExtraTarget(null)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center border border-border cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Extra Earnings */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-400">➕ 추가 지급 항목</span>
                <span className="text-[11px] text-muted-foreground">{modalCustomEarnings.length}건</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="지급 항목명 (예: 상여금, 직무수당)"
                  value={modalEarnLabel}
                  onChange={(e) => setModalEarnLabel(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground outline-none"
                />
                <input
                  type="number"
                  placeholder="금액 (원)"
                  value={modalEarnAmount}
                  onChange={(e) => setModalEarnAmount(e.target.value)}
                  className="w-full sm:w-32 h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono text-foreground outline-none"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const label = modalEarnLabel.trim();
                    const amount = Number(String(modalEarnAmount).replace(/,/g, '')) || 0;
                    if (!label || !amount) {
                      toast.warning('지급 항목명과 금액을 모두 입력해 주세요.');
                      return;
                    }
                    setModalCustomEarnings(prev => [...prev, { label, amount }]);
                    setModalEarnLabel('');
                    setModalEarnAmount('');
                  }}
                  className="h-9 px-3 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> 추가
                </Button>
              </div>
              {modalCustomEarnings.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {modalCustomEarnings.map((ce, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold"
                    >
                      <span>{ce.label}</span>
                      <span className="font-mono">+{ce.amount.toLocaleString()}원</span>
                      <button
                        type="button"
                        onClick={() => setModalCustomEarnings(prev => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Extra Deductions */}
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-400">➖ 추가 공제 항목</span>
                <span className="text-[11px] text-muted-foreground">{modalCustomDeductions.length}건</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="공제 항목명 (예: 가불금, 조합비)"
                  value={modalDedLabel}
                  onChange={(e) => setModalDedLabel(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground outline-none"
                />
                <input
                  type="number"
                  placeholder="금액 (원)"
                  value={modalDedAmount}
                  onChange={(e) => setModalDedAmount(e.target.value)}
                  className="w-full sm:w-32 h-9 px-3 rounded-xl bg-background border border-border text-xs font-mono text-foreground outline-none"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const label = modalDedLabel.trim();
                    const amount = Number(String(modalDedAmount).replace(/,/g, '')) || 0;
                    if (!label || !amount) {
                      toast.warning('공제 항목명과 금액을 모두 입력해 주세요.');
                      return;
                    }
                    setModalCustomDeductions(prev => [...prev, { label, amount }]);
                    setModalDedLabel('');
                    setModalDedAmount('');
                  }}
                  className="h-9 px-3 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> 추가
                </Button>
              </div>
              {modalCustomDeductions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {modalCustomDeductions.map((cd, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold"
                    >
                      <span>{cd.label}</span>
                      <span className="font-mono">-{cd.amount.toLocaleString()}원</span>
                      <button
                        type="button"
                        onClick={() => setModalCustomDeductions(prev => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Live Net Pay Recalculation Summary */}
            {(() => {
              const pEarn = modalEarnLabel.trim() ? Number(String(modalEarnAmount).replace(/,/g, '')) || 0 : 0;
              const pDed = modalDedLabel.trim() ? Number(String(modalDedAmount).replace(/,/g, '')) || 0 : 0;
              const earnTotal =
                editingExtraTarget.baseEarnings +
                modalCustomEarnings.reduce((s, x) => s + (Number(x.amount) || 0), 0) +
                pEarn;
              const dedTotal =
                editingExtraTarget.baseDeductions +
                modalCustomDeductions.reduce((s, x) => s + (Number(x.amount) || 0), 0) +
                pDed;
              const netTotal = earnTotal - dedTotal;
              return (
                <div className="grid grid-cols-3 gap-2 bg-muted/40 border border-border rounded-2xl p-3 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block">총지급액</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-blue-400">{earnTotal.toLocaleString()}원</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block">공제액계</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-rose-400">{dedTotal.toLocaleString()}원</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block">실수령액</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-emerald-400">{netTotal.toLocaleString()}원</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                disabled={savingExtraModal}
                onClick={() => setEditingExtraTarget(null)}
                className="flex-1 h-11 rounded-xl font-black text-xs border-border"
              >
                취소
              </Button>
              <Button
                disabled={savingExtraModal}
                onClick={handleSaveExtraModal}
                className="flex-1 h-11 rounded-xl font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {savingExtraModal ? <Loader2 className="w-4 h-4 animate-spin" /> : '추가 항목 적용 저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {payslipToDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !deletingId && setPayslipToDelete(null)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-5 text-center text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-foreground">급여명세서 삭제 확인</h3>
              <p className="text-xs text-muted-foreground leading-relaxed break-keep">
                <strong>[{payslipToDelete.userName}]</strong> 님의 <strong>{month}</strong> 급여명세서를 영구적으로 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <Button
                variant="outline"
                disabled={Boolean(deletingId)}
                onClick={() => setPayslipToDelete(null)}
                className="flex-1 h-11 rounded-xl font-black text-xs border-border"
              >
                취소
              </Button>
              <Button
                disabled={Boolean(deletingId)}
                onClick={confirmDeleteExistingPayslip}
                className="flex-1 h-11 rounded-xl font-black text-xs bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : '영구 삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Save Confirmation Modal (when unmatched rows exist) */}
      {partialSaveConfirmOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPartialSaveConfirmOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-5 text-center text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-foreground">미매칭 인원 제외 저장</h3>
              <p className="text-xs text-muted-foreground leading-relaxed break-keep">
                매칭되지 않은 <strong>{parsedData.filter(d => !d.uid).length}명</strong>은 제외하고, 정상 매칭된{' '}
                <strong>{parsedData.filter(d => Boolean(d.uid)).length}명</strong>의 급여명세서만 저장하시겠습니까?
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <Button
                variant="outline"
                onClick={() => setPartialSaveConfirmOpen(false)}
                className="flex-1 h-11 rounded-xl font-black text-xs border-border"
              >
                취소
              </Button>
              <Button
                onClick={() => executeSaveAll(parsedData.filter(d => Boolean(d.uid)))}
                className="flex-1 h-11 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                매칭 인원만 저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayslipManagement;
