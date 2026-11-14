/** Date arithmetic the quick-capture parser relies on («наступна середа», «15 числа»). */
import { addDaysKey, fromDateKey, toDateKey } from '@/lib/date';
import type { DateKey } from '@/types';

export const dow = (key: DateKey) => fromDateKey(key).getDay();
/** Next date (today included) that falls on weekday `d`. */
export const nextDow = (today: DateKey, d: number) => addDaysKey(today, (d - dow(today) + 7) % 7);
/** Weekday `d` of next week (weeks start on Monday). */
export const nextWeekDow = (today: DateKey, d: number) => addDaysKey(today, 7 - ((dow(today) + 6) % 7) + ((d + 6) % 7));
export const thisWeekDow = (today: DateKey, d: number) => addDaysKey(today, ((d + 6) % 7) - ((dow(today) + 6) % 7));
export const addMonths = (key: DateKey, n: number) => {
  const d = fromDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toDateKey(d);
};
export const monthStart = (key: DateKey) => key.slice(0, 8) + '01';
/** Day and month (and maybe year) → a date; without a year the next such date from today. */
export function dayMonth(today: DateKey, day: number, month: number, year?: number): DateKey | undefined {
  const y0 = year ?? Number(today.slice(0, 4));
  const make = (y: number) => {
    const d = new Date(y, month - 1, day);
    return d.getMonth() === month - 1 && d.getDate() === day ? toDateKey(d) : undefined;
  };
  const k = make(y0);
  if (!k) return undefined;
  return !year && k < today ? make(y0 + 1) : k;
}
/** Next date (today included) with this day of the month. */
export function nextMonthDay(today: DateKey, day: number): DateKey | undefined {
  if (day < 1 || day > 31) return undefined;
  for (let i = 0; i < 13; i++) {
    const base = addMonths(monthStart(today), i);
    const k = dayMonth(base, day, Number(base.slice(5, 7)), Number(base.slice(0, 4)));
    if (k && k >= today) return k;
  }
  return undefined;
}

/** «На вихідних»: today when it is already the weekend, else the coming Saturday. */
export const weekendKey = (today: DateKey) => ([6, 0].includes(dow(today)) ? today : nextDow(today, 6));
