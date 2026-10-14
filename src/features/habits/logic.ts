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
  if (s.length === 7) return 'Every day';
  if (s.length === 5 && [1, 2, 3, 4, 5].every((d) => s.includes(d))) return 'Weekdays';
  if (s.length === 2 && s.includes(0) && s.includes(6)) return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...s].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d]).join(', ');
}
