import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Payslip, UserProfile } from '../types';
import { read, utils, writeFile } from 'xlsx';
import { Upload, Download, Save, Trash2, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import PayslipDocument from '../components/PayslipDocument';

const PayslipManagement: React.FC = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<Partial<Payslip>[]>([]);
  const [users, setUsers] = useState<Record<string, UserProfile>>({}); // Map employeeId to user
  const [userNameToId, setUserNameToId] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const userMap: Record<string, UserProfile> = {};
      const nameMap: Record<string, string> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data() as UserProfile;
        if (data.employeeId) userMap[data.employeeId] = { ...data, uid: doc.id };
        if (data.displayName) nameMap[data.displayName] = doc.id;
      });
      
      setUsers(userMap);
      setUserNameToId(nameMap);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('사용자 정보를 불러오는데 실패했습니다.');
    }
  };

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
        
        // Get raw data as array of arrays to handle orientation
        const rawData = utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        if (rawData.length === 0) return;

        // Clean raw data: remove empty trailing rows/cols
        const cleanedData = rawData.filter(row => row.some(cell => cell !== ""));
        if (cleanedData.length === 0) return;

        let processedData: any[] = [];
        
        // Detection logic: Determine if layout is Vertical (Labels in Column A) or Horizontal (Labels in Row 1)
        const labelsToFind = ['사번', '성명', '정취', '지급액', '항목', '성 명', '사 번'];
        
        // Sample first row and first column
        const firstRow = (cleanedData[0] || []).map(cell => String(cell || '').trim());
        const firstCol = cleanedData.map(row => String(row[0] || '').trim());
        
        const rowMatchCount = firstRow.filter(h => labelsToFind.includes(h)).length;
        const colMatchCount = firstCol.filter(h => labelsToFind.includes(h)).length;
        
        // If more labels found in first column, treat as Vertical Transposed layout
        const isVertical = colMatchCount > rowMatchCount;

        if (isVertical) {
          // Vertical layout detected
          const headers = firstCol;
          const maxCols = Math.max(...cleanedData.map(row => row.length));
          
          for (let c = 1; c < maxCols; c++) {
            const rowObj: any = {};
            let hasIdentifyingData = false;
            let isEmptyCol = true;

            for (let r = 0; r < cleanedData.length; r++) {
              const header = headers[r];
              if (header) {
                const val = cleanedData[r][c];
                rowObj[header] = val;
                
                if (val !== undefined && val !== null && String(val).trim() !== "") {
                  isEmptyCol = false;
                  if (header === '사번' || header === '성명' || header === '사 번' || header === '성 명' || header === '이름') {
                    hasIdentifyingData = true;
                  }
                }
              }
            }
            
            // Skip "Example Data", "예시", or empty columns
            const nameStr = String(rowObj['성명'] || rowObj['성 명'] || rowObj['이름'] || '');
            const empIdStr = String(rowObj['사번'] || rowObj['사 번'] || rowObj['사원번호'] || '');
            
            if (hasIdentifyingData && !isEmptyCol && 
                !nameStr.includes('예시') && !nameStr.includes('사용자') && 
                !empIdStr.includes('예시')) {
              processedData.push(rowObj);
            }
          }
        } else {
          // Horizontal layout (Standard) - use sheet_to_json directly
          // We can't use cleanedData here because it might have lost some column metadata
          processedData = utils.sheet_to_json(ws);
        }

        const processed: Partial<Payslip>[] = processedData.map((row: any) => {
          // Flexible mapping based on common Korean headers
          const name = String(row['성명'] || row['성 명'] || row['이름'] || '').trim();
          const empId = String(row['사번'] || row['사 번'] || row['사원번호'] || '').trim();
          
          let userId = '';
          // Case-insensitive matching for Employee ID
          const matchedUserIdByEmpId = Object.keys(users).find(
            id => id.toLowerCase() === empId.toLowerCase()
          );
          
          if (empId && matchedUserIdByEmpId) {
            userId = users[matchedUserIdByEmpId].uid;
          } else if (name) {
            // Case-insensitive/trimmed matching for Name
            const matchedUserIdByName = Object.keys(userNameToId).find(
              n => n.trim().replace(/\s/g, '') === name.replace(/\s/g, '')
            );
            if (matchedUserIdByName) {
              userId = userNameToId[matchedUserIdByName];
            }
          }

          const baseSalary = Number(row['시간급여액(가)'] || row['기본급'] || row['시간급여액'] || 0);
          const totalEarnings = Number(row['총급여액'] || row['지급합계'] || 0);
          const totalDeductions = Number(row['공제액계'] || row['공제합계'] || 0);
          const netPay = Number(row['지급액'] || row['실수령액'] || (totalEarnings - totalDeductions) || 0);

          return {
            uid: userId,
            employeeId: empId,
            userName: name,
            month: month,
            baseHours: Number(row['정취'] || row['기본시간'] || 0),
            weeklyHolidayHours: Number(row['주차'] || 0),
            paidLeaveHours: Number(row['유휴'] || 0),
            trainingHours: Number(row['훈련'] || 0),
            otherHours: Number(row['기타시간'] || 0),
            monthlyLeaveHours: Number(row['월휴'] || 0),
            holidayWorkHours: Number(row['휴일근로'] || 0),
            overtimeHours: Number(row['연장근로'] || 0),
            totalHours: Number(row['시간계'] || row['총시간'] || 0),
            hourlyRate: Number(row['시급'] || 0),
            baseSalary,
            experienceAllowance: Number(row['경력'] || row['경력수당'] || 0),
            otherAllowance: Number(row['기타수당'] || 0),
            annualLeaveAllowance: Number(row['년차'] || 0),
            mealAllowance: Number(row['중식'] || row['식대'] || 0),
            extraAllowance: Number(row['기타'] || 0),
            totalEarnings,
            incomeTax: Number(row['갑근세'] || row['소득세'] || 0),
            localIncomeTax: Number(row['주민세'] || row['지방소득세'] || 0),
            healthInsurance: Number(row['건강보험'] || 0),
            nationalPension: Number(row['국민연금'] || 0),
            employmentInsurance: Number(row['고용보험'] || 0),
            mealDeduction: Number(row['식권대'] || 0),
            laundryDeduction: Number(row['세탁비'] || 0),
            totalDeductions,
            netPay,
            annualLeaveBaseDate: String(row['연차기준일'] || ''),
          };
        });

        setParsedData(processed);
        toast.success(`${processed.length}건의 데이터를 불러왔습니다.`);
      } catch (error) {
        console.error('Error parsing excel:', error);
        toast.error('엑셀 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveAll = async () => {
    if (parsedData.length === 0) return;
    
    const invalidEntries = parsedData.filter(d => !d.uid);
    if (invalidEntries.length > 0) {
      toast.error(`${invalidEntries.length}명의 사용자를 찾을 수 없습니다. 이름을 확인해주세요.`);
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      for (const item of parsedData) {
        const payslipData = {
          ...item,
          createdAt: new Date().toISOString(),
        } as Payslip;

        // Use doc ID like "userId_month" to prevent duplicates or allow updates
        const docId = `${item.uid}_${item.month}`;
        await setDoc(doc(db, 'payslips', docId), payslipData);
        successCount++;
      }
      toast.success(`${successCount}건의 급여명세서가 저장되었습니다.`);
      setParsedData([]);
    } catch (error) {
      console.error('Error saving payslips:', error);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Vertical format as requested by user (transposed)
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

    const ws = utils.aoa_to_sheet(data);
    
    // Set column widths for better visibility
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }];

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '급여명세서_양식');
    writeFile(wb, `급여명세서_양식_${month}.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">급여명세서 관리</h1>
          <p className="text-gray-500 text-sm">엑셀 파일을 업로드하여 급여 정보를 일괄 등록합니다.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            양식 다운로드
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            엑셀 업로드
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {parsedData.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              업로드 대기 중 ({parsedData.length}건)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setParsedData([])}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveAll}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? '저장 중...' : '전체 저장하기'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {parsedData.map((payslip, index) => (
              <div key={index} className="relative group">
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                   {!payslip.uid && (
                     <span className="flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full border border-red-200">
                       <AlertCircle className="w-3 h-3" />
                       사용자 미매칭
                     </span>
                   )}
                   <span className="text-xs font-bold text-gray-400">Preview {index + 1}</span>
                </div>
                <div className={`${!payslip.uid ? 'opacity-60 grayscale' : ''}`}>
                  <PayslipDocument payslip={payslip as Payslip} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <FileSpreadsheet className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">데이터가 없습니다</h3>
          <p className="text-gray-500 mb-6">위 버튼을 눌러 급여 엑셀 파일을 업로드해 주세요.</p>
          <div className="p-4 bg-blue-50 text-blue-800 rounded-lg max-w-md text-sm leading-relaxed">
            <p className="font-bold mb-1">💡 팁:</p>
            <p>1. 사번 또는 성명을 기준으로 사용자를 자동으로 찾습니다.</p>
            <p>2. 사번이 일치하지 않을 경우 '사용자 미매칭'으로 표시됩니다.</p>
            <p>3. 다운로드한 양식을 참고하여 엑셀을 작성하면 가장 정확합니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayslipManagement;
