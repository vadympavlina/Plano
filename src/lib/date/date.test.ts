import { describe, expect, it } from 'vitest';
import {
  addDaysKey,
  diffDaysKey,
  formatDateKey,
  formatTime,
  plural,
  weekdayLabels,
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
    expect(relativeDayLabel('2025-04-24', '2025-04-24')).toBe('Сьогодні');
    expect(relativeDayLabel('2025-04-25', '2025-04-24')).toBe('Завтра');
    expect(relativeDayLabel('2025-04-23', '2025-04-24')).toBe('Вчора');
    expect(relativeDayLabel('2025-04-27', '2025-04-24')).toBe('Неділя');
    expect(relativeDayLabel('2025-05-10', '2025-04-24')).toBe('10 трав.');
  });

  it('greets by local time of day', () => {
    expect(greetingFor(new Date(2025, 0, 1, 8))).toBe('Доброго ранку');
    expect(greetingFor(new Date(2025, 0, 1, 14))).toBe('Доброго дня');
    expect(greetingFor(new Date(2025, 0, 1, 20))).toBe('Доброго вечора');
    expect(greetingFor(new Date(2025, 0, 1, 2))).toBe('Доброї ночі');
  });

  it('formats Ukrainian dates and plurals', () => {
    expect(formatDateKey('2026-10-14', 'EEEE, d MMMM yyyy')).toBe('Середа, 14 жовтня 2026');
    expect(formatDateKey('2026-10-14', 'LLLL yyyy')).toBe('Жовтень 2026');
    expect(weekdayLabels(1)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']);
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, ['день', 'дні', 'днів']))).toEqual([
      'день', 'дні', 'днів', 'днів', 'день', 'дні', 'днів',
    ]);
  });
});
