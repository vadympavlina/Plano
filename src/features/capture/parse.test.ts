import { describe, expect, it } from 'vitest';
import { parseQuick, removeSpans, sameName } from './parse';

// Tuesday 20 Oct 2026, 10:00.
const T = '2026-10-20';
const NOW = new Date(2026, 9, 20, 10, 0);
const p = (s: string) => parseQuick(s, T, NOW);
const pick = (s: string) => {
  const { spans: _s, ...rest } = p(s);
  return rest;
};

describe('basics', () => {
  it('the classic', () => {
    expect(pick('Зустріч завтра о 15 на годину #робота')).toEqual({ title: 'Зустріч', date: '2026-10-21', time: '15:00', duration: 60, tags: ['робота'], kind: 'event' });
  });
  it('capitalises and keeps plain text intact', () => {
    expect(pick('купити хліб')).toEqual({ title: 'Купити хліб', tags: [] });
    expect(pick('Прочитати 15 сторінок').title).toBe('Прочитати 15 сторінок');
    expect(pick('Купити 2 червоних яблука')).toEqual({ title: 'Купити 2 червоних яблука', tags: [] });
    expect(pick('Здати у 2 етапи')).toEqual({ title: 'Здати у 2 етапи', tags: [] });
  });
});

describe('dates', () => {
  it.each([
    ['Звіт сьогодні', '2026-10-20'],
    ['Звіт завтра', '2026-10-21'],
    ['Звіт післязавтра', '2026-10-22'],
    ['Звіт у пʼятницю', '2026-10-23'],
    ["Звіт у п'ятницю", '2026-10-23'],
    ['Звіт до пʼятниці', '2026-10-23'],
    ['Звіт у вівторок', '2026-10-20'],
    ['Звіт наступного понеділка', '2026-10-26'],
    ['Звіт наступної середи', '2026-10-28'],
    ['Звіт цього четверга', '2026-10-22'],
    ['Звіт в пт', '2026-10-23'],
    ['Звіт через 3 дні', '2026-10-23'],
    ['Звіт через тиждень', '2026-10-27'],
    ['Звіт через два тижні', '2026-11-03'],
    ['Звіт через місяць', '2026-11-20'],
    ['Звіт за 5 днів', '2026-10-25'],
    ['Звіт на вихідних', '2026-10-24'],
    ['Звіт наступного тижня', '2026-10-26'],
    ['Звіт наступного місяця', '2026-11-01'],
    ['Звіт в кінці місяця', '2026-10-31'],
    ['Звіт 5 листопада', '2026-11-05'],
    ['Звіт 1-го листопада', '2026-11-01'],
    ['Звіт 15 жовт.', '2027-10-15'],
    ['Звіт 2 січня 2027', '2027-01-02'],
    ['Звіт 15.03', '2027-03-15'],
    ['Звіт 25/10', '2026-10-25'],
    ['Звіт 25.10.26', '2026-10-25'],
    ['Звіт 2026-12-01', '2026-12-01'],
    ['Звіт 25 числа', '2026-10-25'],
    ['Оплатити 5-го', '2026-11-05'],
  ])('%s', (text, date) => {
    expect(p(text)).toMatchObject({ title: text.split(' ')[0], date });
  });
  it('invalid dates stay text', () => {
    expect(pick('Щось 31.02')).toEqual({ title: 'Щось 31.02', tags: [] });
  });
});

describe('times', () => {
  it.each([
    ['Дзвінок о 15', '15:00'],
    ['Дзвінок о 9:30', '09:30'],
    ['Дзвінок о 9.30', '09:30'],
    ['Дзвінок о 10.30', '10:30'],
    ['Дзвінок 14:45', '14:45'],
    ['Дзвінок о 7 вечора', '19:00'],
    ['Дзвінок о 9 ранку', '09:00'],
    ['Дзвінок о 3 дня', '15:00'],
    ['Дзвінок о третій дня', '15:00'],
    ['Дзвінок о девʼятій', '09:00'],
    ['Дзвінок о пів на восьму вечора', '19:30'],
    ['Дзвінок о пів на 8', '07:30'],
    ['Дзвінок опівдні', '12:00'],
    ['Дзвінок в 15:00', '15:00'],
    ['Дзвінок у 18 год', '18:00'],
    ['Дзвінок 8 вечора', '20:00'],
    ['Дзвінок ввечері', '19:00'],
    ['Дзвінок вранці', '09:00'],
    ['Дзвінок в обід', '13:00'],
    ['Дзвінок ввечері о 8', '20:00'],
  ])('%s', (text, time) => {
    expect(p(text)).toMatchObject({ title: 'Дзвінок', time, kind: 'event' });
  });
  it('from now', () => {
    expect(p('Перевірити духовку через 30 хв')).toMatchObject({ title: 'Перевірити духовку', date: T, time: '10:30' });
    expect(p('Подзвонити через 2 години')).toMatchObject({ title: 'Подзвонити', time: '12:00' });
    expect(p('Подзвонити через годину')).toMatchObject({ time: '11:00' });
  });
  it('ranges and lengths', () => {
    expect(p('Нарада з 10 до 12')).toMatchObject({ title: 'Нарада', time: '10:00', endTime: '12:00', kind: 'event' });
    expect(p('Нарада з 9:30 до 11')).toMatchObject({ time: '09:30', endTime: '11:00' });
    expect(p('Вечірка з 7 до 11 вечора')).toMatchObject({ time: '19:00', endTime: '23:00' });
    expect(p('Сесія 10:00-11:30')).toMatchObject({ title: 'Сесія', time: '10:00', endTime: '11:30' });
    expect(p('Кіно о 7 вечора на 2 години')).toMatchObject({ title: 'Кіно', time: '19:00', duration: 120 });
    expect(p('Стендап 9:30 на 15 хв')).toMatchObject({ title: 'Стендап', time: '09:30', duration: 15 });
    expect(p('Йога на півтори години')).toMatchObject({ duration: 90 });
    expect(p('Йога на пів години')).toMatchObject({ duration: 30 });
    expect(p('Йога на 1 год 30 хв')).toMatchObject({ duration: 90 });
    expect(p('Йога на 1.5 год')).toMatchObject({ duration: 90 });
  });
});

describe('repeats', () => {
  it.each([
    ['Вода щодня', { freq: 'daily', interval: 1 }, T],
    ['Звіт щопонеділка', { freq: 'weekly', interval: 1, byWeekday: [1] }, '2026-10-26'],
    ['Звіт кожного вівторка', { freq: 'weekly', interval: 1, byWeekday: [2] }, T],
    ['Спорт по понеділках і четвергах', { freq: 'weekly', interval: 1, byWeekday: [1, 4] }, '2026-10-22'],
    ['Спорт щопонеділка та пʼятниці', { freq: 'weekly', interval: 1, byWeekday: [1, 5] }, '2026-10-23'],
    ['Стендап по буднях', { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }, T],
    ['Прибирання щотижня', { freq: 'weekly', interval: 1 }, T],
    ['Полив кожні 3 дні', { freq: 'daily', interval: 3 }, T],
    ['Оренда кожного 5 числа', { freq: 'monthly', interval: 1 }, '2026-11-05'],
    ['Страховка щороку', { freq: 'yearly', interval: 1 }, T],
  ])('%s', (text, recurrence, date) => {
    expect(p(text)).toMatchObject({ title: text.split(' ')[0], recurrence, date });
  });
  it('with a time', () => {
    expect(p('Стендап по буднях о 9:30 на 15 хв #робота')).toMatchObject({ title: 'Стендап', time: '09:30', duration: 15, tags: ['робота'], kind: 'event' });
  });
});

describe('tags, priority, reminders, notes', () => {
  it('priority', () => {
    expect(p('Виправити баг !!! #робота #plano')).toMatchObject({ title: 'Виправити баг', priority: 'urgent', tags: ['робота', 'plano'] });
    expect(p('Подзвонити мамі !!').priority).toBe('high');
    expect(p('Терміново відправити договір')).toMatchObject({ title: 'Відправити договір', priority: 'urgent' });
  });
  it('project and dictated tags', () => {
    expect(p('Макет головної @Plano')).toMatchObject({ title: 'Макет головної', project: 'Plano' });
    expect(p('Зустріч завтра о третій дня на годину хештег робота')).toMatchObject({ title: 'Зустріч', time: '15:00', tags: ['робота'] });
  });
  it('reminder', () => {
    expect(p('Лікар завтра о 10 нагадай за 30 хв')).toMatchObject({ title: 'Лікар', time: '10:00', remindMin: 30, kind: 'event' });
    expect(p('Подарунок 5 листопада нагадай за 2 дні').remindMin).toBe(2880);
  });
  it('note prefix', () => {
    expect(p('нотатка: ідеї для відпустки')).toMatchObject({ title: 'Ідеї для відпустки', kind: 'note' });
  });
  it('tasks with a time stay tasks unless they name a meeting', () => {
    expect(p('Купити ліки о 18').kind).toBeUndefined();
    expect(p('Зустріч з Олею о 18').kind).toBe('event');
    expect(p('Купити ліки завтра ввечері').kind).toBeUndefined();
    expect(p('Вечеря з батьками ввечері').kind).toBe('event');
    expect(p('Прибрати кухню по обіді').kind).toBeUndefined();
  });
});

describe('spans', () => {
  it('point at the recognised words and can be removed', () => {
    const text = 'Зустріч завтра о 15 #робота';
    const r = p(text);
    expect(r.spans.map((s) => [text.slice(s.start, s.end), s.type])).toEqual([
      ['завтра', 'date'],
      ['о 15', 'time'],
      ['#робота', 'tag'],
    ]);
    expect(removeSpans(text, r.spans, ['date'])).toBe('Зустріч о 15 #робота');
  });
  it('names match without spaces, case or apostrophes', () => {
    expect(sameName('мій_проєкт', 'Мій проєкт')).toBe(true);
    expect(sameName('здоровя', 'Здоров’я')).toBe(true);
  });
});
