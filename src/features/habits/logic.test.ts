import { describe, expect, it } from 'vitest';
import type { Habit, HabitLogs } from '@/types';
import { eachDateKey, fromDateKey } from '@/lib/date';
import { completionStats, currentStreak, isDone, isScheduled, longestStreak, nextHabitValue, weekdayInsight, weeklyRates } from './logic';

const T0 = '2025-04-01T10:00:00.000Z';
const gym: Habit = {
  id: 'gym',
  name: 'Gym',
  icon: '🏋️',
  color: 'green',
  schedule: [1, 3, 5], // Mon, Wed, Fri
  startDate: '2025-04-01',
  goalType: 'check',
  target: 1,
  archived: false,
  createdAt: T0,
  updatedAt: T0,
};

describe('habits', () => {
  it('only scheduled weekdays count', () => {
    expect(isScheduled(gym, '2025-04-21')).toBe(true); // Monday
    expect(isScheduled(gym, '2025-04-22')).toBe(false);
    expect(isScheduled(gym, '2025-03-31')).toBe(false); // before start
  });

  it('streak skips unscheduled days and does not break on an open today', () => {
    const logs: HabitLogs = { gym: { '2025-04-14': 1, '2025-04-16': 1, '2025-04-18': 1, '2025-04-21': 1 } };
    // Wed 2025-04-23 is today and not done yet
    expect(currentStreak(gym, logs, '2025-04-23')).toBe(4);
    // Fri 2025-04-25: Wed was missed → streak broken
    expect(currentStreak(gym, logs, '2025-04-25')).toBe(0);
  });

  it('count habits require reaching the target', () => {
    const water: Habit = { ...gym, id: 'water', schedule: [0, 1, 2, 3, 4, 5, 6], goalType: 'count', target: 8 };
    const logs: HabitLogs = { water: { '2025-04-22': 8, '2025-04-23': 5 } };
    expect(currentStreak(water, logs, '2025-04-23')).toBe(1);
    expect(longestStreak(water, logs, '2025-04-23')).toBe(1);
  });

  it('completion stats ignore unscheduled days and the open day', () => {
    const logs: HabitLogs = { gym: { '2025-04-21': 1 } };
    // Mon done, Wed missed, Fri (today) open
    expect(completionStats(gym, logs, '2025-04-21', '2025-04-27', '2025-04-25')).toEqual({
      scheduled: 2,
      done: 1,
      rate: 50,
    });
  });
});

describe('weekly rates and weekday insight', () => {
  const habit = { id: 'h', name: 'h', icon: '•', color: 'blue', schedule: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-09-01', goalType: 'check', target: 1, archived: false, createdAt: '', updatedAt: '' } as Habit;
  // Done every day except Saturdays.
  const logs: HabitLogs = { h: {} };
  for (const d of eachDateKey('2026-09-01', '2026-10-14')) if (fromDateKey(d).getDay() !== 6) logs.h[d] = 1;

  it('computes per-week completion', () => {
    const w = weeklyRates(habit, logs, '2026-10-15', 1, 3);
    expect(w.map((x) => x.start)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(w[0].rate).toBe(86);
  });

  it('finds the most missed weekday', () => {
    expect(weekdayInsight(habit, logs, '2026-10-15')?.worst).toEqual([6]);
  });
});

describe('bad habits', () => {
  const smoke: Habit = { ...gym, id: 'smoke', schedule: [0, 1, 2, 3, 4, 5, 6], kind: 'bad' };
  const coffee: Habit = { ...smoke, id: 'coffee', goalType: 'count', target: 2 };
  it('counts a day as clean until the limit is passed', () => {
    const logs: HabitLogs = { smoke: { '2025-04-03': 1 }, coffee: { '2025-04-02': 2, '2025-04-03': 3 } };
    expect(isDone(smoke, logs, '2025-04-02')).toBe(true);
    expect(isDone(smoke, logs, '2025-04-03')).toBe(false);
    expect(isDone(coffee, logs, '2025-04-02')).toBe(true);
    expect(isDone(coffee, logs, '2025-04-03')).toBe(false);
  });
  it('streak is the run of clean days since the last slip', () => {
    const logs: HabitLogs = { smoke: { '2025-04-03': 1 } };
    expect(currentStreak(smoke, logs, '2025-04-08')).toBe(5);
    expect(currentStreak(smoke, {}, '2025-04-08')).toBe(8);
    expect(longestStreak(smoke, logs, '2025-04-08')).toBe(5);
  });
  it('a tap logs a slip; toggle flips the day', () => {
    expect(nextHabitValue(smoke, 0)).toBe(1);
    expect(nextHabitValue(smoke, 1)).toBe(0);
    expect(nextHabitValue(coffee, 2)).toBe(3);
    expect(nextHabitValue(coffee, 0, 'toggle')).toBe(3);
    expect(nextHabitValue(coffee, 3, 'toggle')).toBe(0);
    expect(nextHabitValue(gym, 0)).toBe(1);
  });
});

describe('bad habit tracking window', () => {
  const sweets: Habit = { ...gym, id: 'sweets', schedule: [0, 1, 2, 3, 4, 5, 6], kind: 'bad', startDate: '2025-03-01', trackFrom: '2025-04-05' };
  it('days before tracking started are not clean days', () => {
    expect(isScheduled(sweets, '2025-04-04')).toBe(false);
    expect(isScheduled(sweets, '2025-04-05')).toBe(true);
    expect(currentStreak(sweets, {}, '2025-04-08')).toBe(4);
  });
  it('falls back to the creation day', () => {
    expect(isScheduled({ ...sweets, trackFrom: undefined }, '2025-03-31')).toBe(false);
  });
});
