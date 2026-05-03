import React from 'react';
import { Payslip } from '../types';

interface PayslipDocumentProps {
  payslip: Payslip;
}

const PayslipDocument: React.FC<PayslipDocumentProps> = ({ payslip }) => {
  const formatNumber = (num: number) => (num || 0).toLocaleString();

  // Define a consistent row height for all rows to ensure left and right alignment
  const rowHeightClass = "h-[32px]";
  const cellBorderClass = "border border-black";
  const labelCellClass = `bg-gray-100 text-center text-xs font-bold ${cellBorderClass} ${rowHeightClass}`;
  const dataCellClass = `px-3 text-right font-mono text-sm ${cellBorderClass} ${rowHeightClass}`;

  return (
    <div className="w-[850px] bg-white text-black p-10 font-sans shadow-lg mx-auto overflow-hidden border-4 border-double border-gray-300">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black underline underline-offset-8 tracking-[0.5em] mb-2">
          {payslip.month.split('-')[0]}년 {parseInt(payslip.month.split('-')[1])}월분 급여 명세서
        </h1>
      </div>

      {/* Corporate Info Section */}
      <table className="w-full border-collapse mb-0">
        <tbody>
          <tr className="h-12">
            <td className={`${cellBorderClass} bg-gray-50 w-2/5 text-center font-bold text-xl tracking-widest`}>
              (주) 건 명 기 업
            </td>
            <td className={`${cellBorderClass} bg-gray-100 w-1/5 text-center font-bold`}>성 명</td>
            <td className={`${cellBorderClass} w-2/5 text-center font-bold text-xl`}>{payslip.userName}</td>
          </tr>
        </tbody>
      </table>

      {/* Main Table Structure */}
      <div className="flex w-full">
        {/* Left: Earnings */}
        <div className="w-1/2">
          <table className="w-full border-collapse border-t-0">
            <tbody>
              {/* Category Container */}
              <tr className="h-8">
                <td className={`${cellBorderClass} bg-gray-200 text-center font-bold text-sm`} colSpan={3}>지 급 내 역</td>
              </tr>
              {/* Attendance Breakdown */}
              <tr>
                <td rowSpan={12} className={`${cellBorderClass} w-10 text-center font-bold bg-gray-50 text-xs py-2 leading-relaxed`}>
                  과<br/>세<br/>급<br/>여<br/>액
                </td>
                <td className={labelCellClass}>출근일수</td>
                <td className={dataCellClass}>- 일</td>
              </tr>
              <tr>
                <td className={labelCellClass}>정 취</td>
                <td className={dataCellClass}>{payslip.baseHours} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>주 차</td>
                <td className={dataCellClass}>{payslip.weeklyHolidayHours} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>유 휴</td>
                <td className={dataCellClass}>{payslip.paidLeaveHours} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>훈 련</td>
                <td className={dataCellClass}>{payslip.trainingHours || 0} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>기 타</td>
                <td className={dataCellClass}>{payslip.otherHours || 0} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>월 휴</td>
                <td className={dataCellClass}>{payslip.monthlyLeaveHours || 0} 시간</td>
              </tr>
              <tr>
                <td className={`${labelCellClass} text-red-600`}>휴일근로</td>
                <td className={`${dataCellClass} text-red-600 font-bold`}>{payslip.holidayWorkHours || 0} 시간</td>
              </tr>
              <tr>
                <td className={`${labelCellClass} text-red-600`}>연장근로</td>
                <td className={`${dataCellClass} text-red-600 font-bold`}>{payslip.overtimeHours || 0} 시간</td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td className={labelCellClass}>시 간 계</td>
                <td className={dataCellClass}>{payslip.totalHours} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>시 급</td>
                <td className={dataCellClass}>{formatNumber(payslip.hourlyRate)} 원</td>
              </tr>
              <tr className="bg-blue-50/30">
                <td className={`${labelCellClass} !bg-blue-50/50`}>시간급여액(가)</td>
                <td className={`${dataCellClass} font-bold`}>{formatNumber(payslip.baseSalary)} 원</td>
              </tr>

              {/* Allowance Breakdown */}
              <tr>
                <td rowSpan={7} className={`${cellBorderClass} w-10 text-center font-bold bg-gray-50 text-xs py-2 leading-relaxed`}>
                  수<br/>당
                </td>
                <td className={labelCellClass}>경 력</td>
                <td className={dataCellClass}>{formatNumber(payslip.experienceAllowance)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>기타수당</td>
                <td className={dataCellClass}>{formatNumber(payslip.otherAllowance)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>년 차</td>
                <td className={dataCellClass}>{payslip.annualLeaveAllowance || 0.0} 일</td>
              </tr>
              <tr>
                <td className={labelCellClass}>중 식</td>
                <td className={dataCellClass}>{formatNumber(payslip.mealAllowance)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>기 타</td>
                <td className={dataCellClass}>{formatNumber(payslip.extraAllowance)} 원</td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td className={labelCellClass}>수당급여액(나)</td>
                <td className={dataCellClass}>{formatNumber(payslip.totalEarnings - payslip.baseSalary)} 원</td>
              </tr>
              <tr className="bg-gray-200 font-bold h-[40px]">
                <td className={`${cellBorderClass} text-center text-sm`} colSpan={1}>총급여액 (가+나)</td>
                <td className={`${dataCellClass} text-lg !h-[40px]`}>{formatNumber(payslip.totalEarnings)} 원</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right: Deductions */}
        <div className="w-1/2">
          <table className="w-full border-collapse border-t-0 border-l-0">
            <tbody>
              <tr className="h-8">
                <td className={`${cellBorderClass} bg-gray-200 text-center font-bold text-sm`} colSpan={2}>공 제 내 역</td>
              </tr>
              <tr>
                <td className={labelCellClass}>갑근세</td>
                <td className={dataCellClass}>{formatNumber(payslip.incomeTax)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>주민세</td>
                <td className={dataCellClass}>{formatNumber(payslip.localIncomeTax)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>건강보험</td>
                <td className={dataCellClass}>{formatNumber(payslip.healthInsurance)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>국민연금</td>
                <td className={dataCellClass}>{formatNumber(payslip.nationalPension)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>고용보험</td>
                <td className={dataCellClass}>{formatNumber(payslip.employmentInsurance)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>식권대</td>
                <td className={dataCellClass}>{formatNumber(payslip.mealDeduction)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>세탁비</td>
                <td className={dataCellClass}>{formatNumber(payslip.laundryDeduction)} 원</td>
              </tr>
              {/* Fill remaining space to match height */}
              {[...Array(10)].map((_, i) => (
                <tr key={i}>
                  <td className={`${labelCellClass} opacity-0`}>-</td>
                  <td className={`${dataCellClass} opacity-0`}>-</td>
                </tr>
              ))}
              <tr>
                <td className={`${labelCellClass} bg-gray-50`}>연차기준일</td>
                <td className={`${dataCellClass} text-center font-sans font-bold`}>{payslip.annualLeaveBaseDate || '-'}</td>
              </tr>
              <tr className="bg-gray-200 font-bold h-[40px]">
                <td className={`${cellBorderClass} text-center text-sm`}>공제액계 (라)</td>
                <td className={`${dataCellClass} text-lg !h-[40px]`}>{formatNumber(payslip.totalDeductions)} 원</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Pay (The Big One) */}
      <div className="w-full border-2 border-black border-t-0 bg-blue-50 flex items-center justify-between px-10 py-6 h-[80px]">
        <div className="text-xl font-black tracking-widest text-blue-900">실 수 령 액 (다-라)</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black font-mono text-blue-900">{formatNumber(payslip.netPay)}</span>
          <span className="text-xl font-bold text-blue-900">원</span>
        </div>
      </div>

      {/* Message */}
      <div className="mt-10 text-center">
        <p className="text-xl font-bold tracking-widest flex items-center justify-center gap-4">
          <span className="text-2xl">♣</span>
          귀하의 노고에 진심으로 감사드립니다.
          <span className="text-2xl">♣</span>
        </p>
      </div>
    </div>
  );
};

export default PayslipDocument;
