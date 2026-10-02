
import { differenceInMinutes, parseISO, isSameDay } from 'date-fns';

export interface AttendanceStats {
  workHours: number;
  overtimeHours: number;
}

/**
 * Calculates work hours and overtime based on:
 * - Regular work: 08:00 - 17:00 (Max 8h)
 * - Lunch: 12:00 - 13:00 (1 hour excluded)
 * - Break/Dinner: 17:00 - 18:00 (Excluded from regular & overtime)
 * - Overtime rule:
 *   - 08:00 ~ 17:40 -> 0시간 잔업
 *   - 17:40 ~ 17:59 -> 0시간 잔업
 *   - 18:00 이후부터 1시간 단위(60분)로 잔업 인정:
 *     - 18:00 -> 1.0h OT (60m)
 *     - 18:59 -> 1.0h OT (1시간 단위 절삭)
 *     - 19:00 -> 2.0h OT (120m)
 *     - 20:00 -> 3.0h OT (180m)
 *     - 21:00 -> 4.0h OT (240m)
 * - Holiday & Weekend Multiplier: 1.5x multiplier on workHours and overtimeHours for Sat, Sun, public holidays, or custom 1.5x dates
 */
export function calculateAttendanceHours(
  clockIn: string | Date, 
  clockOut: string | Date,
  isSpecialMultiplierDay: boolean = false
): AttendanceStats {
  const inDate = typeof clockIn === 'string' ? parseISO(clockIn) : clockIn;
  const outDate = typeof clockOut === 'string' ? parseISO(clockOut) : clockOut;

  // Ensure dates are valid and in order
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate < inDate) {
    return { workHours: 0, overtimeHours: 0 };
  }

  // Saturday is 6, Sunday is 0
  const day = inDate.getDay();
  const isWeekend = day === 0 || day === 6;

  const multiplier = (isWeekend || isSpecialMultiplierDay) ? 1.5 : 1.0;

  // Helper to create a date on the same day as clock-in with specific time
  const getDayTime = (date: Date, hours: number, minutes: number = 0) => {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const coreStart = getDayTime(inDate, 8, 0);
  const coreEnd = getDayTime(inDate, 17, 0);
  const lunchStart = getDayTime(inDate, 12, 0);
  const lunchEnd = getDayTime(inDate, 13, 0);
  const overtimeStart1800 = getDayTime(inDate, 18, 0);

  // 1. Regular Hours Calculation (08:00 ~ 17:00, minus 12:00~13:00 lunch)
  const regOverlapStart = new Date(Math.max(inDate.getTime(), coreStart.getTime()));
  const regOverlapEnd = new Date(Math.min(outDate.getTime(), coreEnd.getTime()));
  
  let regularMinutes = 0;
  if (regOverlapStart < regOverlapEnd) {
    const totalRegMinutes = differenceInMinutes(regOverlapEnd, regOverlapStart);
    
    // Lunch overlap within the regular period (12:00-13:00)
    const lunchOverlapStart = new Date(Math.max(regOverlapStart.getTime(), lunchStart.getTime()));
    const lunchOverlapEnd = new Date(Math.min(regOverlapEnd.getTime(), lunchEnd.getTime()));
    
    let lunchMinutes = 0;
    if (lunchOverlapStart < lunchOverlapEnd) {
      lunchMinutes = differenceInMinutes(lunchOverlapEnd, lunchOverlapStart);
    }
    
    regularMinutes = totalRegMinutes - lunchMinutes;
  }
  
  const rawWorkHours = Math.max(0, regularMinutes / 60);

  // 2. Overtime Hours Calculation (08:00~17:40은 0시간, 18:00 이후부터 1시간 단위 인정)
  let rawOvertimeHours = 0;
  if (outDate >= overtimeStart1800) {
    // Overtime calculated from 17:00 baseline in 60-minute blocks starting at 18:00 (18:00 = 1h, 19:00 = 2h, etc.)
    const minutesAfter1700 = differenceInMinutes(outDate, coreEnd);
    // e.g. 18:00 is 60m -> 1 hour; 18:40 is 100m -> 1 hour; 19:00 is 120m -> 2 hours
    const fullHours = Math.floor(minutesAfter1700 / 60);
    rawOvertimeHours = Math.max(0, fullHours);
  }
  
  // Return hours and apply multiplier (round to 1 decimal place)
  const workHours = Math.floor((rawWorkHours * multiplier) * 10) / 10;
  const overtimeHours = Math.floor((rawOvertimeHours * multiplier) * 10) / 10;

  return {
    workHours,
    overtimeHours
  };
}
