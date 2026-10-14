import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { DateKey, Settings, TimeString } from '@/types';

export const DATE_KEY_FORMAT = 'yyyy-MM-dd';

/** Local calendar date → "yyyy-MM-dd". */
export function toDateKey(date: Date): DateKey {
  return format(date, DATE_KEY_FORMAT);
}

/** "yyyy-MM-dd" → local Date at midnight. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = fromDateKey(value);
  return isValid(d) && toDateKey(d) === value;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

export function diffDaysKey(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(fromDateKey(a), fromDateKey(b));
}

/** Inclusive list of date keys from start to end. */
export function eachDateKey(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  let cur = fromDateKey(start);
  const last = fromDateKey(end);
  while (cur <= last) {
    out.push(toDateKey(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export function timeToMinutes(time: TimeString): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): TimeString {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function combineDateTime(date: DateKey, time: TimeString): Date {
  const d = fromDateKey(date);
  const mins = timeToMinutes(time);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

export function formatTime(time: TimeString | undefined, fmt: Settings['timeFormat'] = '24h'): string {
  if (!time) return '';
  if (fmt === '24h') return time;
  const d = parse(time, 'HH:mm', new Date());
  return format(d, 'h:mm a');
}

export function formatTimeRange(
  start: TimeString | undefined,
  end: TimeString | undefined,
  fmt: Settings['timeFormat'] = '24h',
): string {
  if (!start) return '';
  return end ? `${formatTime(start, fmt)} – ${formatTime(end, fmt)}` : formatTime(start, fmt);
}

export function formatDateKey(key: DateKey, pattern: string): string {
  return format(fromDateKey(key), pattern);
}

/** Human friendly relative date label: Today / Tomorrow / Yesterday / weekday / date. */
export function relativeDayLabel(key: DateKey, today: DateKey, pattern = 'MMM d'): string {
  const diff = diffDaysKey(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return format(fromDateKey(key), 'EEEE');
  return format(fromDateKey(key), pattern);
}

export function weekRange(key: DateKey, weekStartsOn: 0 | 1): { start: DateKey; end: DateKey } {
  const d = fromDateKey(key);
  return {
    start: toDateKey(startOfWeek(d, { weekStartsOn })),
    end: toDateKey(endOfWeek(d, { weekStartsOn })),
  };
}

/** The 6-week (or 5-week) grid shown in a month view. */
export function monthGrid(key: DateKey, weekStartsOn: 0 | 1): DateKey[] {
  const d = fromDateKey(key);
  const start = startOfWeek(startOfMonth(d), { weekStartsOn });
  const end = endOfWeek(endOfMonth(d), { weekStartsOn });
  return eachDateKey(toDateKey(start), toDateKey(end));
}

export function weekdayLabels(weekStartsOn: 0 | 1, style: 'short' | 'narrow' = 'short'): string[] {
  const base = startOfWeek(new Date(2024, 0, 10), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), style === 'short' ? 'EEE' : 'EEEEE'));
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function nowTime(date: Date = new Date()): TimeString {
  return format(date, 'HH:mm');
}

/** Rounds a time up to the next N-minute slot, e.g. 10:07 → 10:15. */
export function roundUpTime(date: Date, step = 30): TimeString {
  const mins = date.getHours() * 60 + date.getMinutes();
  return minutesToTime(Math.min(Math.ceil(mins / step) * step, 23 * 60 + 30));
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}
