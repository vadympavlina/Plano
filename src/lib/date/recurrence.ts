import { addMonths, addYears, differenceInCalendarDays, startOfWeek } from 'date-fns';
import type { DateKey, RecurrenceRule } from '@/types';
import { addDaysKey, fromDateKey, toDateKey } from './index';

const MAX_LOOKAHEAD_DAYS = 366 * 5;

function weekdaysOf(rule: RecurrenceRule, start: Date): number[] {
  return rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [start.getDay()];
}

/**
 * Whether a recurring series that starts on `startKey` has an occurrence on `dateKey`.
 * Pure and deterministic: the same inputs always give the same result.
 */
export function occursOn(rule: RecurrenceRule, startKey: DateKey, dateKey: DateKey): boolean {
  if (dateKey < startKey) return false;
  if (rule.until && dateKey > rule.until) return false;
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const start = fromDateKey(startKey);
  const date = fromDateKey(dateKey);

  switch (rule.freq) {
    case 'daily':
      return differenceInCalendarDays(date, start) % interval === 0;
    case 'weekly': {
      if (!weekdaysOf(rule, start).includes(date.getDay())) return false;
      // Weeks are counted from the (Monday-based) week that contains the start.
      const weeks = Math.round(
        differenceInCalendarDays(startOfWeek(date, { weekStartsOn: 1 }), startOfWeek(start, { weekStartsOn: 1 })) / 7,
      );
      return weeks % interval === 0;
    }
    case 'monthly': {
      const months = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
      if (months % interval !== 0) return false;
      // addMonths clamps to the last day of shorter months (31st → 30th/28th).
      return toDateKey(addMonths(start, months)) === dateKey;
    }
    case 'yearly': {
      const years = date.getFullYear() - start.getFullYear();
      if (years % interval !== 0) return false;
      return toDateKey(addYears(start, years)) === dateKey;
    }
    default:
      return false;
  }
}

/** All occurrence dates of a series within [rangeStart, rangeEnd] (inclusive). */
export function occurrencesInRange(
  rule: RecurrenceRule,
  startKey: DateKey,
  rangeStart: DateKey,
  rangeEnd: DateKey,
  exdates: DateKey[] = [],
): DateKey[] {
  const out: DateKey[] = [];
  let cur = rangeStart < startKey ? startKey : rangeStart;
  const last = rule.until && rule.until < rangeEnd ? rule.until : rangeEnd;
  const excluded = new Set(exdates);
  while (cur <= last) {
    if (!excluded.has(cur) && occursOn(rule, startKey, cur)) out.push(cur);
    cur = addDaysKey(cur, 1);
  }
  return out;
}

/** First occurrence strictly after `afterKey`, or null if the series has ended. */
export function nextOccurrence(rule: RecurrenceRule, startKey: DateKey, afterKey: DateKey): DateKey | null {
  let cur = addDaysKey(afterKey < startKey ? addDaysKey(startKey, -1) : afterKey, 1);
  for (let i = 0; i < MAX_LOOKAHEAD_DAYS; i++) {
    if (rule.until && cur > rule.until) return null;
    if (occursOn(rule, startKey, cur)) return cur;
    cur = addDaysKey(cur, 1);
  }
  return null;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describeRecurrence(rule: RecurrenceRule | undefined): string {
  if (!rule) return 'Does not repeat';
  const n = Math.max(1, rule.interval);
  let text: string;
  switch (rule.freq) {
    case 'daily':
      text = n === 1 ? 'Every day' : `Every ${n} days`;
      break;
    case 'weekly': {
      const days = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : null;
      const base = n === 1 ? 'Weekly' : `Every ${n} weeks`;
      if (days && days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) {
        text = n === 1 ? 'Every weekday' : `${base} on weekdays`;
      } else if (days) {
        text = `${base} on ${[...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_NAMES[d]).join(', ')}`;
      } else text = base;
      break;
    }
    case 'monthly':
      text = n === 1 ? 'Monthly' : `Every ${n} months`;
      break;
    case 'yearly':
      text = n === 1 ? 'Yearly' : `Every ${n} years`;
      break;
  }
  return rule.until ? `${text} until ${rule.until}` : text;
}
