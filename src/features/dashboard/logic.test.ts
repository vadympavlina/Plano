import { describe, expect, it } from 'vitest';
import type { CalendarEvent, Task } from '@/types';
import type { EventOccurrence } from '@/features/calendar/logic';
import { buildSchedule, busiestDay, freeTime, nextUpLabel, nowLineIndex } from './logic';

const ev = (id: string, startTime?: string, endTime?: string, allDay = false): CalendarEvent =>
  ({ id, title: id, date: '2026-10-15', allDay, startTime, endTime, exdates: [], source: 'plano', createdAt: '', updatedAt: '' }) as CalendarEvent;
const occ = (e: CalendarEvent): EventOccurrence => ({ key: `${e.id}@${e.date}`, event: e, date: e.date, endDate: e.date }) as EventOccurrence;
const task = (id: string, startTime?: string, status: Task['status'] = 'todo'): Task =>
  ({ id, title: id, status, priority: 'medium', subtasks: [], tags: [], dueDate: '2026-10-15', startTime, createdAt: '', updatedAt: '' }) as Task;

describe('buildSchedule', () => {
  it('merges timed events and tasks by start, skipping all-day, untimed and cancelled', () => {
    const items = buildSchedule(
      [occ(ev('meet', '14:00', '15:00')), occ(ev('holiday', undefined, undefined, true)), occ(ev('standup', '10:00', '10:15'))],
      [task('gym', '08:00'), task('buy'), task('call', '14:00'), task('old', '09:00', 'cancelled')],
    );
    expect(items.map((i) => i.key)).toEqual(['task:gym', 'standup@2026-10-15', 'meet@2026-10-15', 'task:call']);
  });
});

describe('nowLineIndex', () => {
  const items = buildSchedule([occ(ev('a', '10:00')), occ(ev('b', '14:00'))], []);
  it('places the line before the first item that has not started', () => {
    expect(nowLineIndex(items, 9 * 60)).toBe(0);
    expect(nowLineIndex(items, 12 * 60)).toBe(1);
    expect(nowLineIndex(items, 20 * 60)).toBe(2);
  });
});

describe('nextUpLabel', () => {
  const dayLabel = () => 'Завтра';
  const time = (t: string) => t;
  it('describes ongoing, soon and later events', () => {
    const e = ev('x', '14:00', '15:00');
    expect(nextUpLabel(e, '2026-10-15', new Date(2026, 9, 15, 14, 30), '2026-10-15', dayLabel, time)).toBe('Зараз');
    expect(nextUpLabel(e, '2026-10-15', new Date(2026, 9, 15, 13, 20), '2026-10-15', dayLabel, time)).toBe('Через 40 хв');
    expect(nextUpLabel(e, '2026-10-16', new Date(2026, 9, 15, 20, 0), '2026-10-15', dayLabel, time)).toBe('Завтра о 14:00');
    expect(nextUpLabel(ev('h', undefined, undefined, true), '2026-10-15', new Date(), '2026-10-15', dayLabel, time)).toBe('Сьогодні · весь день');
  });
});

describe('freeTime', () => {
  const items = buildSchedule([occ(ev('vfx', '16:30', '18:00'))], []);
  it('reports the gap until the next item and the free evening', () => {
    expect(freeTime(items, 15 * 60 + 10)).toEqual({ untilNext: 80, freeAfter: 18 * 60 });
  });
  it('skips short gaps and gaps while something is running', () => {
    expect(freeTime(items, 16 * 60 + 10).untilNext).toBeUndefined();
    expect(freeTime(items, 17 * 60).untilNext).toBeUndefined();
    expect(freeTime(items, 17 * 60).freeAfter).toBe(18 * 60);
  });
  it('says nothing once the day is over or busy late', () => {
    expect(freeTime(items, 19 * 60)).toEqual({});
    expect(freeTime(buildSchedule([occ(ev('late', '20:00', '21:30'))], []), 12 * 60).freeAfter).toBeUndefined();
    expect(freeTime([], 12 * 60)).toEqual({});
  });
});

describe('busiestDay', () => {
  it('picks the day with most items, earliest on ties', () => {
    expect(busiestDay([1, 3, 0, 3])).toBe(1);
    expect(busiestDay([0, 0])).toBe(-1);
  });
});
