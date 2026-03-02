import { addDays, isWeekend, format } from 'date-fns'

// Chilean holidays for 2025-2026
const CHILEAN_HOLIDAYS: string[] = [
  // 2025
  '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21',
  '2025-06-20', '2025-06-29', '2025-07-16', '2025-08-15', '2025-09-18',
  '2025-09-19', '2025-10-12', '2025-10-31', '2025-11-01', '2025-12-08', '2025-12-25',
  // 2026
  '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21',
  '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19',
  '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25',
]

function isHoliday(date: Date, holidays: string[] = CHILEAN_HOLIDAYS): boolean {
  return holidays.includes(format(date, 'yyyy-MM-dd'))
}

export function getNextBusinessDay(from: Date, holidays: string[] = CHILEAN_HOLIDAYS): Date {
  let candidate = addDays(from, 1)
  while (isWeekend(candidate) || isHoliday(candidate, holidays)) {
    candidate = addDays(candidate, 1)
  }
  return candidate
}

export function isBusinessDay(date: Date, holidays: string[] = CHILEAN_HOLIDAYS): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays)
}
