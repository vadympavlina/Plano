import { describe, expect, it } from 'vitest';
import {
  addDaysKey,
  diffDaysKey,
  formatTime,
  fromDateKey,
  greetingFor,
  isDateKey,
  monthGrid,
  relativeDayLabel,
  roundUpTime,
  timeToMinutes,
  minutesToTime,
  toDateKey,
  weekRange,
} from './index';

describe('date keys', () => {
  it('round-trips local dates', () => {
    expect(toDateKey(fromDateKey('2025-04-24'))).toBe('2025-04-24');
    expect(fromDateKey('2025-04-24').getHours()).toBe(0);
  });

  it('validates keys', () => {
    expect(isDateKey('2025-02-29')).toBe(false);
    expect(isDateKey('2024-02-29')).toBe(true);
    expect(isDateKey('2024-2-9')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysKey('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDaysKey('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDaysKey('2025-03-01', -1)).toBe('2025-02-28');
    expect(diffDaysKey('2025-03-31', '2025-03-01')).toBe(30);
  });

  it('is not affected by DST transitions', () => {
    // Europe DST starts on the last Sunday of March.
    expect(addDaysKey('2025-03-29', 2)).toBe('2025-03-31');
    expect(diffDaysKey('2025-10-27', '2025-10-25')).toBe(2);
  });
});

describe('weeks and months', () => {
  it('computes Monday- and Sunday-based weeks', () => {
    expect(weekRange('2025-04-24', 1)).toEqual({ start: '2025-04-21', end: '2025-04-27' });
    expect(weekRange('2025-04-24', 0)).toEqual({ start: '2025-04-20', end: '2025-04-26' });
  });

  it('builds a full month grid', () => {
    const grid = monthGrid('2025-04-10', 1);
    expect(grid[0]).toBe('2025-03-31');
    expect(grid.length % 7).toBe(0);
    expect(grid).toContain('2025-04-30');
  });
});

describe('times', () => {
  it('converts minutes', () => {
    expect(timeToMinutes('10:30')).toBe(630);
    expect(minutesToTime(630)).toBe('10:30');
    expect(minutesToTime(-5)).toBe('00:00');
    expect(minutesToTime(24 * 60 + 10)).toBe('23:59');
  });

  it('formats 12h and 24h', () => {
    expect(formatTime('14:05', '24h')).toBe('14:05');
    expect(formatTime('14:05', '12h')).toBe('2:05 PM');
    expect(formatTime('00:15', '12h')).toBe('12:15 AM');
  });

  it('rounds up to the next slot', () => {
    expect(roundUpTime(new Date(2025, 0, 1, 10, 7))).toBe('10:30');
    expect(roundUpTime(new Date(2025, 0, 1, 10, 0))).toBe('10:00');
  });
});

describe('labels', () => {
  it('relative day labels', () => {
    expect(relativeDayLabel('2025-04-24', '2025-04-24')).toBe('Today');
    expect(relativeDayLabel('2025-04-25', '2025-04-24')).toBe('Tomorrow');
    expect(relativeDayLabel('2025-04-23', '2025-04-24')).toBe('Yesterday');
    expect(relativeDayLabel('2025-04-27', '2025-04-24')).toBe('Sunday');
    expect(relativeDayLabel('2025-05-10', '2025-04-24')).toBe('May 10');
  });

  it('greets by local time of day', () => {
    expect(greetingFor(new Date(2025, 0, 1, 8))).toBe('Good morning');
    expect(greetingFor(new Date(2025, 0, 1, 14))).toBe('Good afternoon');
    expect(greetingFor(new Date(2025, 0, 1, 20))).toBe('Good evening');
    expect(greetingFor(new Date(2025, 0, 1, 2))).toBe('Good night');
  });
});
