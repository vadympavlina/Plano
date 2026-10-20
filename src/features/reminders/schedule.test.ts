import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { CalendarEvent, Habit, Task, UserData } from '@/types';
import { buildReminders } from './schedule';

const T0 = '2025-04-01T00:00:00.000Z';
const ev = { id: 'e', title: 'Зустріч', date: '2025-04-07', allDay: false, startTime: '10:00', endTime: '11:00', exdates: [], source: 'plano', createdAt: T0, updatedAt: T0 } as CalendarEvent;
const task = { id: 't', title: 'Звіт', status: 'todo', priority: 'medium', subtasks: [], tags: [], dueDate: '2025-04-07', startTime: '15:00', createdAt: T0, updatedAt: T0 } as Task;
const habit = { id: 'h', name: 'Вода', icon: '💧', color: 'teal', schedule: [0, 1, 2, 3, 4, 5, 6], startDate: '2025-04-01', goalType: 'check', target: 1, archived: false, createdAt: T0, updatedAt: T0 } as Habit;
const data = (settings = {}, logs = {}) =>
  ({ settings: { ...DEFAULT_SETTINGS, ...settings }, events: { e: ev }, tasks: { t: task }, habits: { h: habit }, habitLogs: logs }) as unknown as UserData;
const now = new Date(2025, 3, 7, 7, 0); // 7 Apr, 07:00 local

describe('buildReminders', () => {
  it('schedules event, task, morning summary and habits for today', () => {
    const today = buildReminders(data(), now).filter((r) => new Date(r.at).getDate() === 7);
    expect(today.map((r) => [new Date(r.at).getHours() * 60 + new Date(r.at).getMinutes(), r.tag])).toEqual([
      [8 * 60, 'digest:2025-04-07'],
      [9 * 60 + 45, 'ev:e@2025-04-07'],
      [15 * 60, 'task:t'],
      [21 * 60, 'habits:2025-04-07'],
    ]);
    expect(today[0].body).toBe('1 задача · 1 подія, перша о 10:00');
  });
  it('respects switches and done habits, and never schedules the past', () => {
    const r = buildReminders(data({ remindEventsMin: 0, remindTasks: false, digestAt: '' }, { h: { '2025-04-07': 1 } }), new Date(2025, 3, 7, 22, 0));
    expect(r.every((x) => x.tag?.startsWith('habits:') && x.at > new Date(2025, 3, 7, 22, 0).getTime())).toBe(true);
    expect(r.some((x) => x.tag === 'habits:2025-04-07')).toBe(false);
  });
});

describe('per-item reminders', () => {
  it('uses the item reminder, turns it off with 0, and reminds all-day events only when asked', () => {
    const allDay = { ...ev, id: 'b', title: 'ДН', allDay: true, startTime: undefined, endTime: undefined, date: '2025-04-08', remindMin: 1440 } as CalendarEvent;
    const d = { ...data(), events: { e: { ...ev, remindMin: 60 }, b: allDay }, tasks: { t: { ...task, remindMin: 0 } } } as unknown as UserData;
    const r = buildReminders(d, now);
    const at = (tag: string) => r.find((x) => x.tag === tag)?.at;
    expect(at('ev:e@2025-04-07')).toBe(new Date(2025, 3, 7, 9, 0).getTime());
    expect(at('ev:b@2025-04-08')).toBe(new Date(2025, 3, 7, 9, 0).getTime());
    expect(at('task:t')).toBeUndefined();
  });
});
