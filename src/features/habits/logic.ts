import { addDaysKey, eachDateKey, fromDateKey } from '@/lib/date';
import type { DateKey, Habit, HabitLogs } from '@/types';

export function isScheduled(habit: Habit, date: DateKey): boolean {
  if (date < habit.startDate) return false;
  return habit.schedule.includes(fromDateKey(date).getDay());
}

export function habitValue(logs: HabitLogs, habitId: string, date: DateKey): number {
  return logs[habitId]?.[date] ?? 0;
}

export function isDone(habit: Habit, logs: HabitLogs, date: DateKey): boolean {
  const target = habit.goalType === 'check' ? 1 : Math.max(1, habit.target);
  return habitValue(logs, habit.id, date) >= target;
}

/**
 * Current streak: consecutive scheduled days completed, counting back from
 * today. Unscheduled days are skipped (they never break a streak) and today
 * does not break the streak while it is still open.
 */
export function currentStreak(habit: Habit, logs: HabitLogs, today: DateKey): number {
  let streak = 0;
  let cur = today;
  for (let i = 0; i < 3660; i++) {
    if (cur < habit.startDate) break;
    if (isScheduled(habit, cur)) {
      if (isDone(habit, logs, cur)) streak++;
      else if (cur !== today) break;
    }
    cur = addDaysKey(cur, -1);
  }
  return streak;
}

export function longestStreak(habit: Habit, logs: HabitLogs, today: DateKey): number {
  if (habit.startDate > today) return 0;
  let best = 0;
  let run = 0;
  for (const date of eachDateKey(habit.startDate, today)) {
    if (!isScheduled(habit, date)) continue;
    if (isDone(habit, logs, date)) {
      run++;
      best = Math.max(best, run);
    } else if (date !== today) run = 0;
  }
  return best;
}

export interface CompletionStats {
  scheduled: number;
  done: number;
  rate: number;
}

/** Completion over [start, end], counting only scheduled days up to today. */
export function completionStats(habit: Habit, logs: HabitLogs, start: DateKey, end: DateKey, today: DateKey): CompletionStats {
  const last = end > today ? today : end;
  if (last < start) return { scheduled: 0, done: 0, rate: 0 };
  let scheduled = 0;
  let done = 0;
  for (const date of eachDateKey(start, last)) {
    if (!isScheduled(habit, date)) continue;
    const completed = isDone(habit, logs, date);
    // Today counts only once it is done — it is not "missed" yet.
    if (date === today && !completed) continue;
    scheduled++;
    if (completed) done++;
  }
  return { scheduled, done, rate: scheduled ? Math.round((done / scheduled) * 100) : 0 };
}

export function totalCompletions(habit: Habit, logs: HabitLogs): number {
  const target = habit.goalType === 'check' ? 1 : Math.max(1, habit.target);
  return Object.values(logs[habit.id] ?? {}).filter((v) => v >= target).length;
}

export function describeSchedule(schedule: number[]): string {
  const s = [...schedule].sort();
  if (s.length === 7) return 'Щодня';
  if (s.length === 5 && [1, 2, 3, 4, 5].every((d) => s.includes(d))) return 'Будні';
  if (s.length === 2 && s.includes(0) && s.includes(6)) return 'Вихідні';
  const names = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return [...s].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d]).join(', ');
}

/** Completion rate per week for the last `weeks` weeks (oldest first); the current week is included. */
export function weeklyRates(habit: Habit, logs: HabitLogs, today: DateKey, weekStartsOn: 0 | 1, weeks = 8): { start: DateKey; rate: number; scheduled: number }[] {
  const out: { start: DateKey; rate: number; scheduled: number }[] = [];
  const dow = fromDateKey(today).getDay();
  const thisWeekStart = addDaysKey(today, -((dow - weekStartsOn + 7) % 7));
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDaysKey(thisWeekStart, -7 * w);
    const s = completionStats(habit, logs, start, addDaysKey(start, 6), today);
    out.push({ start, rate: s.rate, scheduled: s.scheduled });
  }
  return out;
}

/** Best and most-missed weekdays (0 = Sunday) over the last `days` days; undefined without enough data. */
export function weekdayInsight(habit: Habit, logs: HabitLogs, today: DateKey, days = 90): { best: number[]; worst: number[] } | undefined {
  const start = addDaysKey(today, -(days - 1));
  const from = start < habit.startDate ? habit.startDate : start;
  if (from > today) return undefined;
  const sched = new Array(7).fill(0);
  const done = new Array(7).fill(0);
  for (const date of eachDateKey(from, addDaysKey(today, -1))) {
    if (!isScheduled(habit, date)) continue;
    const d = fromDateKey(date).getDay();
    sched[d]++;
    if (isDone(habit, logs, date)) done[d]++;
  }
  const rates = sched.map((s, d) => (s >= 2 ? { d, r: done[d] / s } : null)).filter((x): x is { d: number; r: number } => !!x);
  if (rates.length < 2) return undefined;
  const max = Math.max(...rates.map((x) => x.r));
  const min = Math.min(...rates.map((x) => x.r));
  if (max - min < 0.15) return undefined;
  return { best: rates.filter((x) => x.r === max).map((x) => x.d), worst: rates.filter((x) => x.r === min).map((x) => x.d) };
}
