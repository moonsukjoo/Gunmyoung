import React from 'react';
import { Payslip } from '../types';

interface PayslipDocumentProps {
  payslip: Payslip;
  forceDesktopLayout?: boolean;
}

const PayslipDocument: React.FC<PayslipDocumentProps> = ({ payslip, forceDesktopLayout = false }) => {
  const formatNumber = (num: number) => (num || 0).toLocaleString();

  const customEarnings = (payslip.customEarnings || []).filter(item => item.label?.trim());
  const customDeductions = (payslip.customDeductions || []).filter(item => item.label?.trim());

  const desktopSpacerCount = Math.max(2, 10 + customEarnings.length - customDeductions.length);

  const rowHeightClass = forceDesktopLayout ? 'h-[32px]' : 'h-7 sm:h-[32px]';
  const cellBorderClass = 'border border-black';
  const labelCellClass = forceDesktopLayout
    ? `bg-gray-100 text-center text-xs font-bold ${cellBorderClass} ${rowHeightClass}`
    : `bg-gray-100 text-center text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 ${cellBorderClass} ${rowHeightClass}`;
  const dataCellClass = forceDesktopLayout
    ? `px-3 text-right font-mono text-sm ${cellBorderClass} ${rowHeightClass}`
    : `px-2 sm:px-3 text-right font-mono text-xs sm:text-sm ${cellBorderClass} ${rowHeightClass}`;

  const [yearStr, monthStr] = (payslip.month || '').split('-');
  const monthNum = parseInt(monthStr || '0', 10) || '';
  const netAllowanceSubtotal = (payslip.totalEarnings || 0) - (payslip.baseSalary || 0);

  return (
    <div
      className={
        forceDesktopLayout
          ? 'w-[850px] bg-white text-black p-10 font-sans shadow-lg mx-auto overflow-hidden border-4 border-double border-gray-300'
          : 'w-full max-w-[850px] bg-white text-black p-3 sm:p-7 md:p-10 font-sans shadow-lg mx-auto overflow-hidden border-2 sm:border-4 border-double border-gray-300'
      }
    >
      {/* Title */}
      <div className={forceDesktopLayout ? 'text-center mb-10' : 'text-center mb-4 sm:mb-8 md:mb-10'}>
        <h1
          className={
            forceDesktopLayout
              ? 'text-4xl font-black underline underline-offset-8 tracking-[0.5em] mb-2'
              : 'text-lg sm:text-3xl md:text-4xl font-black underline underline-offset-4 sm:underline-offset-8 tracking-[0.12em] sm:tracking-[0.35em] md:tracking-[0.5em] mb-1 sm:mb-2'
          }
        >
          {yearStr}년 {monthNum}월분 급여 명세서
        </h1>
      </div>

      {/* Corporate Info Section */}
      <table className="w-full border-collapse mb-0">
        <tbody>
          <tr className={forceDesktopLayout ? 'h-12' : 'h-9 sm:h-12'}>
            <td
              className={`${cellBorderClass} bg-gray-50 w-2/5 text-center font-bold ${
                forceDesktopLayout ? 'text-xl tracking-widest' : 'text-xs sm:text-lg md:text-xl tracking-wider sm:tracking-widest'
              }`}
            >
              (주) 건 명 기 업
            </td>
            <td
              className={`${cellBorderClass} bg-gray-100 w-1/5 text-center font-bold ${
                forceDesktopLayout ? 'text-sm' : 'text-xs sm:text-sm'
              }`}
            >
              성 명
            </td>
            <td
              className={`${cellBorderClass} w-2/5 text-center font-bold ${
                forceDesktopLayout ? 'text-xl' : 'text-sm sm:text-lg md:text-xl'
              }`}
            >
              {payslip.userName}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Main Table Structure: Stacks vertically on mobile (< md), 2-column on desktop/PDF */}
      <div className={forceDesktopLayout ? 'flex flex-row w-full' : 'flex flex-col md:flex-row w-full'}>
        {/* Left / Top: Earnings */}
        <div className={forceDesktopLayout ? 'w-1/2' : 'w-full md:w-1/2'}>
          <table className="w-full border-collapse border-t-0">
            <tbody>
              <tr className={forceDesktopLayout ? 'h-8' : 'h-7 sm:h-8'}>
                <td
                  className={`${cellBorderClass} bg-gray-200 text-center font-bold ${
                    forceDesktopLayout ? 'text-sm' : 'text-xs sm:text-sm'
                  }`}
                  colSpan={3}
                >
                  지 급 내 역
                </td>
              </tr>

              {/* Attendance & Base Salary Breakdown */}
              <tr>
                <td
                  rowSpan={12}
                  className={`${cellBorderClass} ${
                    forceDesktopLayout ? 'w-10 text-xs' : 'w-7 sm:w-10 text-[10px] sm:text-xs'
                  } text-center font-bold bg-gray-50 py-2 leading-relaxed`}
                >
                  과<br />세<br />급<br />여<br />액
                </td>
                <td className={labelCellClass}>출근일수</td>
                <td className={dataCellClass}>
                  {payslip.workDays && payslip.workDays > 0 ? `${payslip.workDays} 일` : '- 일'}
                </td>
              </tr>
              <tr>
                <td className={labelCellClass}>정 취</td>
                <td className={dataCellClass}>{payslip.baseHours || 0} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>주 차</td>
                <td className={dataCellClass}>{payslip.weeklyHolidayHours || 0} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>유 휴</td>
                <td className={dataCellClass}>{payslip.paidLeaveHours || 0} 시간</td>
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
                <td className={dataCellClass}>{payslip.totalHours || 0} 시간</td>
              </tr>
              <tr>
                <td className={labelCellClass}>시 급</td>
                <td className={dataCellClass}>{formatNumber(payslip.hourlyRate)} 원</td>
              </tr>
              <tr className="bg-blue-50/30">
                <td className={`${labelCellClass} !bg-blue-50/50`}>시간급여액(가)</td>
                <td className={`${dataCellClass} font-bold`}>{formatNumber(payslip.baseSalary)} 원</td>
              </tr>

              {/* Allowance + Custom Earnings Breakdown */}
              <tr>
                <td
                  rowSpan={7 + customEarnings.length}
                  className={`${cellBorderClass} ${
                    forceDesktopLayout ? 'w-10 text-xs' : 'w-7 sm:w-10 text-[10px] sm:text-xs'
                  } text-center font-bold bg-gray-50 py-2 leading-relaxed`}
                >
                  수<br />당
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
                <td className={dataCellClass}>{payslip.annualLeaveAllowance || 0} 일</td>
              </tr>
              <tr>
                <td className={labelCellClass}>중 식</td>
                <td className={dataCellClass}>{formatNumber(payslip.mealAllowance)} 원</td>
              </tr>
              <tr>
                <td className={labelCellClass}>기 타</td>
                <td className={dataCellClass}>{formatNumber(payslip.extraAllowance)} 원</td>
              </tr>

              {customEarnings.map((extra, idx) => (
                <tr key={`custom-earn-${idx}`} className="bg-emerald-50/40">
                  <td className={`${labelCellClass} !bg-emerald-50/60 text-emerald-900`}>{extra.label}</td>
                  <td className={`${dataCellClass} font-bold text-emerald-900`}>{formatNumber(extra.amount)} 원</td>
                </tr>
              ))}

              <tr className="bg-gray-100 font-bold">
                <td className={labelCellClass}>수당급여액(나)</td>
                <td className={dataCellClass}>{formatNumber(netAllowanceSubtotal)} 원</td>
              </tr>
              <tr className={`bg-gray-200 font-bold ${forceDesktopLayout ? 'h-[40px]' : 'h-9 sm:h-[40px]'}`}>
                <td
                  className={`${cellBorderClass} text-center ${
                    forceDesktopLayout ? 'text-sm' : 'text-xs sm:text-sm'
                  }`}
                  colSpan={1}
                >
                  총급여액 (가+나)
                </td>
                <td
                  className={`${dataCellClass} ${
                    forceDesktopLayout ? 'text-lg !h-[40px]' : 'text-sm sm:text-lg !h-9 sm:!h-[40px] font-black'
                  }`}
                >
                  {formatNumber(payslip.totalEarnings)} 원
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right / Bottom: Deductions */}
        <div className={forceDesktopLayout ? 'w-1/2' : 'w-full md:w-1/2 mt-2 md:mt-0'}>
          <table
            className={
              forceDesktopLayout
                ? 'w-full border-collapse border-t-0 border-l-0'
                : 'w-full border-collapse md:border-t-0 md:border-l-0'
            }
          >
            <tbody>
              <tr className={forceDesktopLayout ? 'h-8' : 'h-7 sm:h-8'}>
                <td
                  className={`${cellBorderClass} bg-gray-200 text-center font-bold ${
                    forceDesktopLayout ? 'text-sm' : 'text-xs sm:text-sm'
                  }`}
                  colSpan={2}
                >
                  공 제 내 역
                </td>
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

              {customDeductions.map((extra, idx) => (
                <tr key={`custom-ded-${idx}`} className="bg-rose-50/40">
                  <td className={`${labelCellClass} !bg-rose-50/60 text-rose-900`}>{extra.label}</td>
                  <td className={`${dataCellClass} font-bold text-rose-900`}>{formatNumber(extra.amount)} 원</td>
                </tr>
              ))}

              {/* Desktop / Print Spacer Rows to match left Earnings column height */}
              {[...Array(desktopSpacerCount)].map((_, i) => (
                <tr key={i} className={forceDesktopLayout ? '' : 'hidden md:table-row'}>
                  <td className={`${labelCellClass} opacity-0`}>-</td>
                  <td className={`${dataCellClass} opacity-0`}>-</td>
                </tr>
              ))}

              <tr>
                <td className={`${labelCellClass} bg-gray-50`}>연차기준일</td>
                <td className={`${dataCellClass} text-center font-sans font-bold`}>
                  {payslip.annualLeaveBaseDate || '-'}
                </td>
              </tr>
              <tr className={`bg-gray-200 font-bold ${forceDesktopLayout ? 'h-[40px]' : 'h-9 sm:h-[40px]'}`}>
                <td
                  className={`${cellBorderClass} text-center ${
                    forceDesktopLayout ? 'text-sm' : 'text-xs sm:text-sm'
                  }`}
                >
                  공제액계 (라)
                </td>
                <td
                  className={`${dataCellClass} ${
                    forceDesktopLayout ? 'text-lg !h-[40px]' : 'text-sm sm:text-lg !h-9 sm:!h-[40px] font-black'
                  }`}
                >
                  {formatNumber(payslip.totalDeductions)} 원
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Pay (The Big One) */}
      <div
        className={
          forceDesktopLayout
            ? 'w-full border-2 border-black border-t-0 bg-blue-50 flex items-center justify-between px-10 py-6 h-[80px]'
            : 'w-full border-2 border-black border-t-0 bg-blue-50 flex items-center justify-between px-4 py-3.5 sm:px-8 sm:py-5 md:px-10 md:py-6 mt-2 md:mt-0'
        }
      >
        <div
          className={
            forceDesktopLayout
              ? 'text-xl font-black tracking-widest text-blue-900'
              : 'text-xs sm:text-lg md:text-xl font-black tracking-wider sm:tracking-widest text-blue-900'
          }
        >
          실 수 령 액 (다-라)
        </div>
        <div className="flex items-baseline gap-1 sm:gap-2">
          <span
            className={
              forceDesktopLayout
                ? 'text-4xl font-black font-mono text-blue-900'
                : 'text-xl sm:text-3xl md:text-4xl font-black font-mono text-blue-900'
            }
          >
            {formatNumber(payslip.netPay)}
          </span>
          <span className={forceDesktopLayout ? 'text-xl font-bold text-blue-900' : 'text-sm sm:text-xl font-bold text-blue-900'}>
            원
          </span>
        </div>
      </div>

      {/* Message */}
      <div className={forceDesktopLayout ? 'mt-10 text-center' : 'mt-5 sm:mt-8 md:mt-10 text-center'}>
        <p
          className={
            forceDesktopLayout
              ? 'text-xl font-bold tracking-widest flex items-center justify-center gap-4'
              : 'text-xs sm:text-lg md:text-xl font-bold tracking-wide sm:tracking-widest flex items-center justify-center gap-2 sm:gap-4'
          }
        >
          <span className={forceDesktopLayout ? 'text-2xl' : 'text-base sm:text-2xl'}>♣</span>
          귀하의 노고에 진심으로 감사드립니다.
          <span className={forceDesktopLayout ? 'text-2xl' : 'text-base sm:text-2xl'}>♣</span>
        </p>
      </div>
    </div>
  );
};

export default PayslipDocument;
