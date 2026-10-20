import { describe, expect, it } from 'vitest';
import { parseQuick } from './parse';

// 2026-10-20 is a Tuesday.
const T = '2026-10-20';

describe('parseQuick', () => {
  it('reads the example from the placeholder', () => {
    expect(parseQuick('Зустріч завтра о 15 на годину #робота', T)).toEqual({ title: 'Зустріч', date: '2026-10-21', time: '15:00', duration: 60, tags: ['робота'] });
  });
  it('weekdays, next week and day counts', () => {
    expect(parseQuick('Звіт у пʼятницю', T).date).toBe('2026-10-23');
    expect(parseQuick('Звіт у вівторок', T).date).toBe(T);
    expect(parseQuick('Звіт наступного понеділка', T).date).toBe('2026-11-02');
    expect(parseQuick('Подзвонити через 3 дні', T)).toMatchObject({ title: 'Подзвонити', date: '2026-10-23' });
    expect(parseQuick('Оплатити через тиждень', T).date).toBe('2026-10-27');
  });
  it('explicit dates roll into next year when past', () => {
    expect(parseQuick('ДН Олі 5 листопада', T)).toMatchObject({ title: 'ДН Олі', date: '2026-11-05' });
    expect(parseQuick('Податки 15.03', T).date).toBe('2027-03-15');
    expect(parseQuick('Щось 31.02', T)).toEqual({ title: 'Щось 31.02', tags: [] });
  });
  it('times, parts of day and durations', () => {
    expect(parseQuick('Кіно о 7 вечора на 2 години', T)).toMatchObject({ title: 'Кіно', time: '19:00', duration: 120 });
    expect(parseQuick('Стендап 9:30 на 15 хв', T)).toMatchObject({ title: 'Стендап', time: '09:30', duration: 15 });
    expect(parseQuick('Здати у 2 етапи', T)).toEqual({ title: 'Здати у 2 етапи', tags: [] });
    expect(parseQuick('Дзвінок на півгодини', T).duration).toBe(30);
  });
  it('priority and several tags', () => {
    expect(parseQuick('Виправити баг !!! #робота #plano', T)).toMatchObject({ title: 'Виправити баг', priority: 'urgent', tags: ['робота', 'plano'] });
  });
});
