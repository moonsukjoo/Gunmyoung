import { Payslip, PayslipExtraItem, UserProfile } from '../types';

export interface ParsedPayslipItem extends Partial<Payslip> {
  matchedUser?: UserProfile | null;
  matchStatus: 'MATCHED_EMP_ID' | 'MATCHED_NAME' | 'UNMATCHED';
  isDuplicateName?: boolean;
  rawEmpId: string;
  rawName: string;
  rowNo?: string;
}

export const cleanPayslipNumber = (val: unknown): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').replace(/₩/g, '').replace(/원/g, '').trim();
  if (!str || str === '-' || str === '--') return 0;
  const num = parseFloat(str);
  return Number.isNaN(num) ? 0 : num;
};

export const cleanPayslipText = (val: unknown): string => {
  return String(val || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim();
};

export const normalizeHeaderKey = (key: unknown): string => {
  return cleanPayslipText(key)
    .replace(/[\(\)\[\]\{\}\<\>]/g, '')
    .toLowerCase();
};

const isPureNumericToken = (val: unknown): boolean => {
  const s = String(val || '')
    .replace(/,/g, '')
    .replace(/₩/g, '')
    .replace(/원/g, '')
    .trim();
  return s !== '' && /^-?\d+(\.\d+)?$/.test(s);
};

export const PAYSLIP_FIELD_MAP: Record<string, keyof Payslip | 'rowNo' | 'workDays' | 'subtotalNa'> = {
  // Row number (ignored for ID matching)
  'no': 'rowNo',
  '순번': 'rowNo',
  '번호': 'rowNo',

  // Work days (optional metadata)
  '총작업일': 'workDays',
  '작업일': 'workDays',
  '출근일수': 'workDays',
  '근무일수': 'workDays',

  // Employee ID
  '사번': 'employeeId',
  '사원번호': 'employeeId',
  '사원id': 'employeeId',
  '사원코드': 'employeeId',
  'employeeid': 'employeeId',
  'empid': 'employeeId',

  // Name
  '성명': 'userName',
  '이름': 'userName',
  '사원명': 'userName',
  '근로자명': 'userName',
  '직원명': 'userName',
  'name': 'userName',
  'username': 'userName',

  // Hours
  '정취': 'baseHours',
  '기본시간': 'baseHours',
  '소정근로시간': 'baseHours',
  '주차': 'weeklyHolidayHours',
  '주휴': 'weeklyHolidayHours',
  '유휴': 'paidLeaveHours',
  '유급휴일': 'paidLeaveHours',
  '훈련': 'trainingHours',
  '교육': 'trainingHours',
  '기타시간': 'otherHours',
  '월휴': 'monthlyLeaveHours',
  '월차': 'monthlyLeaveHours',
  '휴일근로': 'holidayWorkHours',
  '휴일시간': 'holidayWorkHours',
  '연장근로': 'overtimeHours',
  '연장시간': 'overtimeHours',
  '연장가급야간': 'overtimeHours',
  '연장야간': 'overtimeHours',
  '시간계': 'totalHours',
  '총시간': 'totalHours',
  '시급': 'hourlyRate',

  // Allowances & Base
  '시간급여액가': 'baseSalary',
  '시간급여액계가': 'baseSalary',
  '시간급여액': 'baseSalary',
  '기본급': 'baseSalary',
  '기본급여': 'baseSalary',
  '기본월급': 'baseSalary',
  '경력': 'experienceAllowance',
  '경력수당': 'experienceAllowance',
  '근속수당': 'experienceAllowance',
  '수당': 'experienceAllowance',
  '기타수당': 'otherAllowance',
  '합계나': 'subtotalNa',
  '수당급여액나': 'subtotalNa',
  '년차': 'annualLeaveAllowance',
  '연차': 'annualLeaveAllowance',
  '년휴': 'annualLeaveAllowance',
  '연차수당': 'annualLeaveAllowance',
  '중식': 'mealAllowance',
  '중식대': 'mealAllowance',
  '식대': 'mealAllowance',
  '식대보조비': 'mealAllowance',
  '기타급여액': 'extraAllowance',
  '기타급여액다': 'extraAllowance',
  '다': 'extraAllowance',
  '기타수당2': 'extraAllowance',
  '추가수당': 'extraAllowance',
  '총급여액': 'totalEarnings',
  '총급여액가나': 'totalEarnings',
  '총급여액나다': 'totalEarnings',
  '다나+다': 'totalEarnings',
  '다나다': 'totalEarnings',
  '나+다': 'totalEarnings',
  '나다': 'totalEarnings',
  '지급합계': 'totalEarnings',
  '지급총액': 'totalEarnings',
  '총지급액': 'totalEarnings',
  '과세총액': 'totalEarnings',

  // Deductions & Taxes
  '갑근세': 'incomeTax',
  '소득세': 'incomeTax',
  '근로소득세': 'incomeTax',
  '주민세': 'localIncomeTax',
  '지방소득세': 'localIncomeTax',
  '지방세': 'localIncomeTax',
  '건강보험': 'healthInsurance',
  '국민건강보험': 'healthInsurance',
  '국민연금': 'nationalPension',
  '고용보험': 'employmentInsurance',
  '식권대': 'mealDeduction',
  '식대공제': 'mealDeduction',
  '세탁비': 'laundryDeduction',
  '세탁공제': 'laundryDeduction',
  '공제액계': 'totalDeductions',
  '공제액계라': 'totalDeductions',
  '공제합계': 'totalDeductions',
  '총공제액': 'totalDeductions',
  '지급액': 'netPay',
  '지급액다라': 'netPay',
  '지급액다-라': 'netPay',
  '실수령액': 'netPay',
  '실수령액다-라': 'netPay',
  '차인지급액': 'netPay',
  '통장입금액': 'netPay',
  '연차기준일': 'annualLeaveBaseDate',
};

type ColumnTarget = keyof Payslip | 'rowNo' | 'workDays' | 'subtotalNa' | null;

const HEADER_MARKER_TOKENS = [
  '성명', '사번', '사원번호', '과세급여액', '기타급여액', '공제내역',
  '공제액계', '시간급여', '갑근세', '건강보험', '국민연금', '고용보험',
  '총급여액', '지급액', '실수령액', '식권대', '세탁비', '기본급',
  '(가)', '(나)', '(다)', '(라)', '(나+다)', '(다-라)', '나+다', '다-라'
];

const isHeaderMarkerRow = (row: string[]): boolean => {
  const joinedCells = row.map(c => cleanPayslipText(c).toLowerCase()).filter(Boolean);
  if (joinedCells.length === 0) return false;
  let markerHits = 0;
  for (const cell of joinedCells) {
    if (
      HEADER_MARKER_TOKENS.some(t => cell === t.replace(/\s+/g, '').toLowerCase() || cell.includes(t.replace(/\s+/g, '').toLowerCase())) ||
      cell === '갑' ||
      cell === '근' ||
      cell === '세' ||
      cell === '주' ||
      cell === '민' ||
      cell === '정' ||
      cell === '취' ||
      cell === '작' ||
      cell === '업' ||
      cell === '일'
    ) {
      markerHits++;
    }
  }
  const pureNums = row.filter(isPureNumericToken).length;
  return markerHits >= 2 && pureNums === 0;
};

interface CustomColumnMeta {
  label: string;
  kind: 'EARNING' | 'DEDUCTION';
}

const isDeductionHeaderHint = (label: string, banner: string, seenTotalEarnings: boolean): boolean => {
  const b = banner.toLowerCase();
  if (b.includes('공제')) return true;
  if (seenTotalEarnings) return true;
  const k = label.toLowerCase();
  return ['공제', '세금', '보험', '연금', '식권', '세탁', '가불', '조합', '정산', '상조', '차감'].some(t => k.includes(t));
};

const formatCustomHeaderLabel = (parts: string[]): string => {
  const raw = parts.join('').replace(/[\(\)\[\]]/g, '').trim();
  return raw;
};

const resolveMultiRowHorizontalColumns = (
  headerRows: string[][]
): { fields: ColumnTarget[]; customColumns: (CustomColumnMeta | null)[]; matchedCount: number } => {
  const maxCols = Math.max(...headerRows.map(r => r.length), 1);
  const fields: ColumnTarget[] = new Array(maxCols).fill(null);
  const customColumns: (CustomColumnMeta | null)[] = new Array(maxCols).fill(null);
  let matchedCount = 0;

  const hasBannerRow = headerRows.length >= 2;
  let currentBanner = '';
  let seenHoursTotal = false;
  let seenTotalEarnings = false;

  for (let c = 0; c < maxCols; c++) {
    if (hasBannerRow) {
      const topCell = cleanPayslipText(headerRows[0][c] || '').toLowerCase();
      if (topCell) {
        currentBanner = topCell;
      }
    }

    const allParts = headerRows.map(r => cleanPayslipText(r[c] || '')).filter(Boolean);
    const subParts = (hasBannerRow ? headerRows.slice(1) : headerRows)
      .map(r => cleanPayslipText(r[c] || ''))
      .filter(Boolean);

    const fullNorm = normalizeHeaderKey(allParts.join(''));
    const subNorm = normalizeHeaderKey(subParts.join(''));
    const subRawLower = subParts.join('').toLowerCase();
    const fullRawLower = allParts.join('').toLowerCase();

    let resolved: ColumnTarget = null;

    // 1. Sub-header empty at multi-row table (e.g. NO, 성명 in row 0)
    if (hasBannerRow && subParts.length === 0) {
      resolved = PAYSLIP_FIELD_MAP[fullNorm] || null;
      if (resolved) {
        fields[c] = resolved;
        matchedCount++;
        continue;
      }
    }

    // 2. Disambiguate repeated "기타" column across 과세급여액 / 수당 / 기타급여액
    if (subNorm === '기타') {
      if (currentBanner.includes('수당')) {
        resolved = 'otherAllowance';
      } else if (currentBanner.includes('기타급여')) {
        resolved = 'extraAllowance';
      } else if (seenHoursTotal) {
        resolved = 'otherAllowance';
      } else {
        resolved = 'otherHours';
      }
    } else if (subRawLower.includes('나+다') || fullRawLower.includes('나+다') || subRawLower.includes('나다')) {
      resolved = 'totalEarnings';
    } else if (subRawLower.includes('다-라') || fullRawLower.includes('다-라') || fullNorm.startsWith('지급액')) {
      resolved = 'netPay';
    } else if (fullNorm.includes('공제액계') || subNorm.includes('공제액계')) {
      resolved = 'totalDeductions';
    } else if (subNorm.includes('시간급여')) {
      resolved = 'baseSalary';
    } else if (subNorm.includes('식권')) {
      resolved = 'mealDeduction';
    } else if (subNorm.includes('세탁')) {
      resolved = 'laundryDeduction';
    } else if (subNorm.includes('갑근세') || subNorm.includes('소득세')) {
      resolved = 'incomeTax';
    } else if (subNorm.includes('주민세') || subNorm.includes('지방소득세')) {
      resolved = 'localIncomeTax';
    } else if (subNorm.includes('건강보험')) {
      resolved = 'healthInsurance';
    } else if (subNorm.includes('국민연금')) {
      resolved = 'nationalPension';
    } else if (subNorm.includes('고용보험')) {
      resolved = 'employmentInsurance';
    } else if (subNorm.includes('연장')) {
      resolved = 'overtimeHours';
    } else if (subNorm.includes('휴일')) {
      resolved = 'holidayWorkHours';
    } else if (subNorm === '중식대' || subNorm === '중식' || subNorm === '식대') {
      resolved = 'mealAllowance';
    } else if (subNorm === '년휴' || subNorm === '년차' || subNorm === '연차') {
      resolved = 'annualLeaveAllowance';
    } else if (PAYSLIP_FIELD_MAP[subNorm]) {
      resolved = PAYSLIP_FIELD_MAP[subNorm];
    } else if (PAYSLIP_FIELD_MAP[fullNorm]) {
      resolved = PAYSLIP_FIELD_MAP[fullNorm];
    }

    if (resolved === 'totalHours' || resolved === 'baseSalary') {
      seenHoursTotal = true;
    }
    if (resolved === 'totalEarnings') {
      seenTotalEarnings = true;
    }

    if (resolved) {
      fields[c] = resolved;
      matchedCount++;
    } else {
      // Capture any unknown custom column label added to Excel (e.g. 상여금, 직무수당, 가불금, 조합비)
      const label = formatCustomHeaderLabel(subParts.length > 0 ? subParts : allParts);
      const ignoreLabels = new Set(['', '가', '나', '다', '라', '과세급여액', '수당', '기타급여액', '공제내역']);
      if (label && !ignoreLabels.has(label) && !isPureNumericToken(label)) {
        customColumns[c] = {
          label,
          kind: isDeductionHeaderHint(label, currentBanner, seenTotalEarnings) ? 'DEDUCTION' : 'EARNING',
        };
      }
    }
  }

  return { fields, customColumns, matchedCount };
};

export const matchPayslipUser = (
  allUsers: UserProfile[],
  empId: string,
  name: string
): { user: UserProfile | null; status: 'MATCHED_EMP_ID' | 'MATCHED_NAME' | 'UNMATCHED'; isDuplicateName?: boolean } => {
  let cleanId = cleanPayslipText(empId).toLowerCase();
  let rawNameInput = String(name || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  // Handle inline "이름(사번)" or "이름 (사번)" format
  const parenMatch = rawNameInput.match(/^([^\(\)]+?)\s*\(([^\(\)]+)\)$/);
  if (parenMatch) {
    rawNameInput = parenMatch[1].trim();
    if (!cleanId) {
      cleanId = cleanPayslipText(parenMatch[2]).toLowerCase();
    }
  }

  const cleanName = cleanPayslipText(rawNameInput);

  // 1. Primary: Match by Employee ID (사번) when provided
  if (cleanId) {
    const matchedByEmp = allUsers.find(u => {
      const uId = cleanPayslipText(u.employeeId || '').toLowerCase();
      return uId !== '' && uId === cleanId;
    });
    if (matchedByEmp) {
      return { user: matchedByEmp, status: 'MATCHED_EMP_ID' };
    }
  }

  // 2. Fallback: Match seamlessly by Name (성명) when 사번 is missing or not found
  if (cleanName) {
    const nameMatches = allUsers.filter(u => {
      const uName = cleanPayslipText(u.displayName || '');
      return uName !== '' && uName === cleanName;
    });
    if (nameMatches.length === 1) {
      return { user: nameMatches[0], status: 'MATCHED_NAME' };
    }
    if (nameMatches.length > 1) {
      return { user: nameMatches[0], status: 'MATCHED_NAME', isDuplicateName: true };
    }
  }

  return { user: null, status: 'UNMATCHED' };
};

export const parsePayslipMatrix = (
  matrix: string[][],
  month: string,
  allUsers: UserProfile[]
): ParsedPayslipItem[] => {
  if (matrix.length === 0) return [];

  const cleanedRows = matrix.filter(r => r.some(c => String(c || '').trim() !== ''));
  if (cleanedRows.length === 0) return [];

  const verticalLabelKeywords = [
    '사번', '사원번호', '성명', '이름', '직원명', '사원명',
    '기본급', '정취', '지급액', '실수령액', '총급여액', '지급합계',
    '공제액계', '공제합계', '갑근세', '소득세'
  ];

  // 1. Check if Vertical format (Col 0..2 contains labels vertically)
  let bestHeaderColIdx = 0;
  let maxColScore = 0;
  const maxScanCols = Math.min(3, Math.max(...cleanedRows.map(r => r.length), 1));
  for (let c = 0; c < maxScanCols; c++) {
    const colLabels = cleanedRows.map(r => normalizeHeaderKey(r[c] || ''));
    const score = colLabels.filter(h => verticalLabelKeywords.some(k => h === k || h.includes(k))).length;
    if (score > maxColScore) {
      maxColScore = score;
      bestHeaderColIdx = c;
    }
  }

  // 2. Determine Horizontal header boundary (supports 1-row AND multi-row headers!)
  // Find first row that looks like an actual employee data row
  let firstDataRowIdx = -1;
  const maxHeaderScan = Math.min(10, cleanedRows.length - 1);
  for (let r = 1; r <= maxHeaderScan; r++) {
    const row = cleanedRows[r];
    if (isHeaderMarkerRow(row)) {
      continue;
    }
    const pureNums = row.filter(isPureNumericToken).length;
    // A data row either has >= 2 numeric cells OR has at least 1 numeric cell after a non-numeric name/id cell
    if (pureNums >= 2) {
      firstDataRowIdx = r;
      break;
    }
  }

  if (firstDataRowIdx === -1) {
    firstDataRowIdx = 1;
  }

  // Skip leading document title row above headers if present (e.g., "2026년 10월 급여대장" with only 1 filled cell)
  let headerStartIdx = 0;
  while (
    headerStartIdx < firstDataRowIdx - 1 &&
    cleanedRows[headerStartIdx].filter(c => cleanPayslipText(c) !== '').length <= 1 &&
    !isHeaderMarkerRow(cleanedRows[headerStartIdx])
  ) {
    headerStartIdx++;
  }

  const headerSlice = cleanedRows.slice(headerStartIdx, firstDataRowIdx);
  const horizontalPlan = resolveMultiRowHorizontalColumns(headerSlice);

  const isVertical = maxColScore > horizontalPlan.matchedCount && maxColScore >= 4;

  interface ExtractedRecord {
    mapped: Partial<Record<keyof Payslip | 'rowNo' | 'workDays' | 'subtotalNa', any>>;
    customEarnings: PayslipExtraItem[];
    customDeductions: PayslipExtraItem[];
    rawEmpId: string;
    rawName: string;
    rowNo: string;
  }

  const rawRecords: ExtractedRecord[] = [];

  if (isVertical) {
    const headers = cleanedRows.map(r => normalizeHeaderKey(r[bestHeaderColIdx] || ''));
    const rawHeaderLabels = cleanedRows.map(r => String(r[bestHeaderColIdx] || '').trim());
    const maxCols = Math.max(...cleanedRows.map(r => r.length));

    for (let c = bestHeaderColIdx + 1; c < maxCols; c++) {
      const mapped: ExtractedRecord['mapped'] = {};
      const customEarnings: PayslipExtraItem[] = [];
      const customDeductions: PayslipExtraItem[] = [];
      let rawEmpId = '';
      let rawName = '';
      let hasAnyData = false;
      let seenTotalEarnings = false;

      for (let r = 0; r < cleanedRows.length; r++) {
        const h = headers[r];
        const field = PAYSLIP_FIELD_MAP[h];
        const val = cleanedRows[r][c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          hasAnyData = true;
        }
        if (field === 'totalEarnings') seenTotalEarnings = true;

        if (!field) {
          const label = rawHeaderLabels[r];
          const numVal = cleanPayslipNumber(val);
          if (label && numVal !== 0 && !['항목', '구분', '합계'].includes(label)) {
            if (isDeductionHeaderHint(label, '', seenTotalEarnings)) {
              customDeductions.push({ label, amount: numVal });
            } else {
              customEarnings.push({ label, amount: numVal });
            }
          }
          continue;
        }

        if (field === 'employeeId') {
          rawEmpId = String(val || '').trim();
        } else if (field === 'userName') {
          rawName = String(val || '').trim();
        } else if (field === 'annualLeaveBaseDate') {
          mapped.annualLeaveBaseDate = String(val || '').trim();
        } else if (field !== 'rowNo') {
          mapped[field] = cleanPayslipNumber(val);
        }
      }

      if (hasAnyData && (rawEmpId || rawName) && !rawName.includes('예시') && !rawEmpId.includes('예시')) {
        rawRecords.push({ mapped, customEarnings, customDeductions, rawEmpId, rawName, rowNo: '' });
      }
    }
  } else {
    // Horizontal format (single-row OR multi-row header + optional continuation sub-rows)
    const { fields, customColumns } = horizontalPlan;

    for (let r = firstDataRowIdx; r < cleanedRows.length; r++) {
      const row = cleanedRows[r];
      if (isHeaderMarkerRow(row)) continue;

      const mapped: ExtractedRecord['mapped'] = {};
      const customEarnings: PayslipExtraItem[] = [];
      const customDeductions: PayslipExtraItem[] = [];
      let rawEmpId = '';
      let rawName = '';
      let rowNo = '';
      let hasAnyData = false;

      fields.forEach((field, cIdx) => {
        const rawVal = row[cIdx];
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') return;

        if (!field) {
          const customMeta = customColumns[cIdx];
          const numVal = cleanPayslipNumber(rawVal);
          if (customMeta && numVal !== 0) {
            hasAnyData = true;
            if (customMeta.kind === 'DEDUCTION') {
              customDeductions.push({ label: customMeta.label, amount: numVal });
            } else {
              customEarnings.push({ label: customMeta.label, amount: numVal });
            }
          }
          return;
        }

        hasAnyData = true;
        if (field === 'rowNo') {
          rowNo = String(rawVal).trim();
        } else if (field === 'employeeId') {
          rawEmpId = String(rawVal).trim();
        } else if (field === 'userName') {
          rawName = String(rawVal).trim();
        } else if (field === 'annualLeaveBaseDate') {
          mapped.annualLeaveBaseDate = String(rawVal).trim();
        } else {
          mapped[field] = cleanPayslipNumber(rawVal);
        }
      });

      if (!hasAnyData) continue;

      // Skip summary / example footer rows (whether label is in NO col or 성명 col)
      const compactName = cleanPayslipText(rawName);
      const compactRowNo = cleanPayslipText(rowNo);
      const leadingText = row.slice(0, 3).map(c => cleanPayslipText(c)).join('');
      const summaryTokens = ['합계', '총계', '소계', '누계', '전체합계', '평균'];
      if (
        compactName.includes('예시') ||
        cleanPayslipText(rawEmpId).includes('예시') ||
        compactName === '계' ||
        compactRowNo === '계' ||
        summaryTokens.some(t => compactName.includes(t) || compactRowNo.includes(t) || leadingText.includes(t))
      ) {
        continue;
      }

      // Continuation sub-row (e.g., 2nd row of a 2-row merged employee block containing only sub-values in middle cols)
      if (!rawName && !rawEmpId) {
        const isMergedSubRow =
          !compactRowNo &&
          (mapped.totalEarnings ?? 0) === 0 &&
          (mapped.netPay ?? 0) === 0 &&
          (mapped.baseSalary ?? 0) === 0;
        if (isMergedSubRow) {
          const prev = rawRecords[rawRecords.length - 1];
          if (prev) {
            if ((mapped.mealAllowance || 0) >= 1000 && !(prev.mapped.mealAllowance || 0)) {
              prev.mapped.mealAllowance = mapped.mealAllowance;
            }
            if ((mapped.extraAllowance || 0) >= 1000 && !(prev.mapped.extraAllowance || 0)) {
              prev.mapped.extraAllowance = mapped.extraAllowance;
            }
          }
        }
        continue;
      }

      rawRecords.push({ mapped, customEarnings, customDeductions, rawEmpId, rawName, rowNo });
    }
  }

  return rawRecords.map(({ mapped, customEarnings, customDeductions, rawEmpId, rawName, rowNo }) => {
    const baseSalary = mapped.baseSalary ?? 0;
    const experienceAllowance = mapped.experienceAllowance ?? 0;
    const otherAllowance = mapped.otherAllowance ?? 0;
    const annualLeaveAllowance = mapped.annualLeaveAllowance ?? 0;
    const mealAllowance = mapped.mealAllowance ?? 0;
    const extraAllowance = mapped.extraAllowance ?? 0;
    const customEarningsSum = customEarnings.reduce((acc, c) => acc + (c.amount || 0), 0);

    const totalEarnings =
      mapped.totalEarnings ??
      mapped.subtotalNa ??
      baseSalary + experienceAllowance + otherAllowance + mealAllowance + extraAllowance + customEarningsSum;

    const incomeTax = mapped.incomeTax ?? 0;
    const localIncomeTax = mapped.localIncomeTax ?? 0;
    const healthInsurance = mapped.healthInsurance ?? 0;
    const nationalPension = mapped.nationalPension ?? 0;
    const employmentInsurance = mapped.employmentInsurance ?? 0;
    const mealDeduction = mapped.mealDeduction ?? 0;
    const laundryDeduction = mapped.laundryDeduction ?? 0;
    const customDeductionsSum = customDeductions.reduce((acc, c) => acc + (c.amount || 0), 0);

    const totalDeductions =
      mapped.totalDeductions ??
      incomeTax +
        localIncomeTax +
        healthInsurance +
        nationalPension +
        employmentInsurance +
        mealDeduction +
        laundryDeduction +
        customDeductionsSum;

    const netPay = mapped.netPay ?? totalEarnings - totalDeductions;

    const baseHours = mapped.baseHours ?? 0;
    const weeklyHolidayHours = mapped.weeklyHolidayHours ?? 0;
    const paidLeaveHours = mapped.paidLeaveHours ?? 0;
    const trainingHours = mapped.trainingHours ?? 0;
    const otherHours = mapped.otherHours ?? 0;
    const monthlyLeaveHours = mapped.monthlyLeaveHours ?? 0;
    const holidayWorkHours = mapped.holidayWorkHours ?? 0;
    const overtimeHours = mapped.overtimeHours ?? 0;
    const totalHours =
      mapped.totalHours ??
      baseHours + weeklyHolidayHours + paidLeaveHours + trainingHours + otherHours;

    const { user: matchedUser, status: matchStatus, isDuplicateName } = matchPayslipUser(
      allUsers,
      rawEmpId,
      rawName
    );

    return {
      uid: matchedUser?.uid || '',
      employeeId: matchedUser?.employeeId || rawEmpId,
      userName: matchedUser?.displayName || rawName,
      month,
      workDays: mapped.workDays ?? 0,
      baseHours,
      weeklyHolidayHours,
      paidLeaveHours,
      trainingHours,
      otherHours,
      monthlyLeaveHours,
      holidayWorkHours,
      overtimeHours,
      totalHours,
      hourlyRate: mapped.hourlyRate ?? 0,
      baseSalary,
      experienceAllowance,
      otherAllowance,
      annualLeaveAllowance,
      mealAllowance,
      extraAllowance,
      customEarnings,
      totalEarnings,
      incomeTax,
      localIncomeTax,
      healthInsurance,
      nationalPension,
      employmentInsurance,
      mealDeduction,
      laundryDeduction,
      customDeductions,
      totalDeductions,
      netPay,
      annualLeaveBaseDate: mapped.annualLeaveBaseDate || '',
      matchedUser,
      matchStatus,
      isDuplicateName,
      rawEmpId,
      rawName,
      rowNo
    };
  });
};

export const splitPastedSpreadsheetText = (text: string): string[][] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    if (line.includes('\t')) {
      return line.split('\t').map(c => c.trim());
    }
    // Quote-aware CSV split so numbers like "3,500,000" inside CSV don't break
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
};
