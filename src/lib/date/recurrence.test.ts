import { describe, expect, it } from 'vitest';
import { describeRecurrence, nextOccurrence, occurrencesInRange, occursOn } from './recurrence';

describe('recurrence', () => {
  it('daily with interval', () => {
    const rule = { freq: 'daily' as const, interval: 2 };
    expect(occursOn(rule, '2025-04-01', '2025-04-03')).toBe(true);
    expect(occursOn(rule, '2025-04-01', '2025-04-04')).toBe(false);
    expect(occursOn(rule, '2025-04-01', '2025-03-30')).toBe(false);
  });

  it('weekly on selected weekdays', () => {
    const rule = { freq: 'weekly' as const, interval: 1, byWeekday: [1, 3, 5] }; // Mon Wed Fri
    expect(occurrencesInRange(rule, '2025-04-21', '2025-04-21', '2025-04-27')).toEqual([
      '2025-04-21',
      '2025-04-23',
      '2025-04-25',
    ]);
  });

  it('weekly defaults to the start weekday and respects interval', () => {
    const rule = { freq: 'weekly' as const, interval: 2 };
    // 2025-04-24 is a Thursday
    expect(occurrencesInRange(rule, '2025-04-24', '2025-04-20', '2025-05-31')).toEqual([
      '2025-04-24',
      '2025-05-08',
      '2025-05-22',
    ]);
  });

  it('bi-weekly with several weekdays counts weeks from the start week', () => {
    const rule = { freq: 'weekly' as const, interval: 2, byWeekday: [1, 3] };
    expect(nextOccurrence(rule, '2025-04-21', '2025-04-21')).toBe('2025-04-23');
    expect(nextOccurrence(rule, '2025-04-21', '2025-04-23')).toBe('2025-05-05');
  });

  it('monthly clamps to short months without drifting', () => {
    const rule = { freq: 'monthly' as const, interval: 1 };
    expect(nextOccurrence(rule, '2025-01-31', '2025-01-31')).toBe('2025-02-28');
    expect(nextOccurrence(rule, '2025-01-31', '2025-02-28')).toBe('2025-03-31');
  });

  it('yearly handles leap days', () => {
    const rule = { freq: 'yearly' as const, interval: 1 };
    expect(nextOccurrence(rule, '2024-02-29', '2024-02-29')).toBe('2025-02-28');
  });

  it('stops at until', () => {
    const rule = { freq: 'daily' as const, interval: 1, until: '2025-04-03' };
    expect(nextOccurrence(rule, '2025-04-01', '2025-04-03')).toBeNull();
    expect(occurrencesInRange(rule, '2025-04-01', '2025-04-01', '2025-04-10')).toHaveLength(3);
  });

  it('skips excluded dates', () => {
    const rule = { freq: 'daily' as const, interval: 1 };
    expect(occurrencesInRange(rule, '2025-04-01', '2025-04-01', '2025-04-03', ['2025-04-02'])).toEqual([
      '2025-04-01',
      '2025-04-03',
    ]);
  });

  it('describes rules', () => {
    expect(describeRecurrence(undefined)).toBe('Does not repeat');
    expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] })).toBe('Every weekday');
    expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [0, 1] })).toBe('Weekly on Mon, Sun');
    expect(describeRecurrence({ freq: 'daily', interval: 3 })).toBe('Every 3 days');
  });
});
