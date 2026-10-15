import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/types';
import { expandEvents, findConflicts, layoutDay, occurrencesOnDay, upcomingOccurrences } from './logic';

const T0 = '2025-04-01T10:00:00.000Z';
function ev(p: Partial<CalendarEvent> & { id: string; date: string }): CalendarEvent {
  return { title: p.id, allDay: false, exdates: [], source: 'plano', createdAt: T0, updatedAt: T0, ...p };
}

describe('expandEvents', () => {
  it('includes single events in range only', () => {
    const list = [ev({ id: 'a', date: '2025-04-24' }), ev({ id: 'b', date: '2025-05-24' })];
    expect(expandEvents(list, '2025-04-21', '2025-04-27').map((o) => o.event.id)).toEqual(['a']);
  });

  it('expands recurring events and respects exdates', () => {
    const gym = ev({
      id: 'gym',
      date: '2025-04-21',
      startTime: '10:00',
      endTime: '11:30',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 4] },
      exdates: ['2025-04-28'],
    });
    const dates = expandEvents([gym], '2025-04-21', '2025-05-04').map((o) => o.date);
    expect(dates).toEqual(['2025-04-21', '2025-04-24', '2025-05-01']);
  });

  it('shows multi-day all-day events on every day they span', () => {
    const trip = ev({ id: 'trip', date: '2025-04-20', endDate: '2025-04-23', allDay: true });
    const occ = expandEvents([trip], '2025-04-21', '2025-04-27');
    expect(occ).toHaveLength(1);
    expect(occurrencesOnDay(occ, '2025-04-22')).toHaveLength(1);
    expect(occurrencesOnDay(occ, '2025-04-24')).toHaveLength(0);
  });

  it('sorts all-day first then by time', () => {
    const list = [
      ev({ id: 'late', date: '2025-04-24', startTime: '18:00' }),
      ev({ id: 'early', date: '2025-04-24', startTime: '08:00' }),
      ev({ id: 'allday', date: '2025-04-24', allDay: true }),
    ];
    expect(expandEvents(list, '2025-04-24', '2025-04-24').map((o) => o.event.id)).toEqual(['allday', 'early', 'late']);
  });
});

describe('layoutDay', () => {
  it('places non-overlapping items in a single column', () => {
    const r = layoutDay([
      { key: 'a', start: 600, end: 660 },
      { key: 'b', start: 660, end: 720 },
    ]);
    expect(r.every((p) => p.columns === 1 && p.column === 0)).toBe(true);
  });

  it('splits overlapping items into columns', () => {
    const r = layoutDay([
      { key: 'a', start: 600, end: 720 },
      { key: 'b', start: 630, end: 690 },
      { key: 'c', start: 700, end: 760 },
      { key: 'd', start: 800, end: 860 },
    ]);
    const byKey = Object.fromEntries(r.map((p) => [p.item.key, p]));
    expect(byKey.a.columns).toBe(2);
    expect(byKey.b.column).toBe(1);
    expect(byKey.c.column).toBe(1); // reuses the column freed by b
    expect(byKey.d.columns).toBe(1);
  });
});

describe('conflicts and upcoming', () => {
  const list = [
    ev({ id: 'meet', date: '2025-04-24', startTime: '14:00', endTime: '15:00' }),
    ev({ id: 'dinner', date: '2025-04-24', startTime: '19:00', endTime: '21:00' }),
  ];

  it('finds overlapping events', () => {
    expect(findConflicts(list, '2025-04-24', '14:30', '16:00').map((e) => e.id)).toEqual(['meet']);
    expect(findConflicts(list, '2025-04-24', '15:00', '16:00')).toHaveLength(0);
    expect(findConflicts(list, '2025-04-24', '14:30', '16:00', 'meet')).toHaveLength(0);
  });

  it('upcoming skips events that already ended today', () => {
    const now = new Date(2025, 3, 24, 16, 0);
    expect(upcomingOccurrences(list, now, '2025-04-24').map((o) => o.event.id)).toEqual(['dinner']);
  });
});

import { selectionRange } from './logic';

describe('selectionRange', () => {
  it('drags downwards from the anchor slot', () => {
    expect(selectionRange(600, 690)).toEqual({ start: 600, end: 690 });
    expect(selectionRange(607, 700)).toEqual({ start: 600, end: 705 });
  });
  it('drags upwards and still includes the anchor slot', () => {
    expect(selectionRange(600, 540)).toEqual({ start: 540, end: 615 });
  });
  it('a click without movement covers one slot', () => {
    expect(selectionRange(600, 602)).toEqual({ start: 600, end: 615 });
  });
  it('is clamped to the day', () => {
    expect(selectionRange(1430, 1500)).toEqual({ start: 1425, end: 1440 });
    expect(selectionRange(10, -50)).toEqual({ start: 0, end: 15 });
  });
});
