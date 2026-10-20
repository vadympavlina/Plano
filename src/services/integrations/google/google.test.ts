import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/types';
import { fromGoogle, googleIdForLocal, localIdForGoogle, toGoogle, toRecurrence, type GEvent } from './mapping';
import { planPull } from './reconcile';

const T0 = '2026-10-01T10:00:00.000Z';
const ev = (p: Partial<CalendarEvent> & { id: string }): CalendarEvent => ({
  title: p.id,
  date: '2026-10-20',
  allDay: false,
  startTime: '10:00',
  endTime: '11:00',
  exdates: [],
  source: 'plano',
  createdAt: T0,
  updatedAt: T0,
  ...p,
});
const W = { start: '2026-08-01', end: '2027-12-31' };

describe('ids', () => {
  it('local ids for Google events are deterministic and RTDB-safe', () => {
    const a = localIdForGoogle('primary', 'abc123');
    expect(a).toBe(localIdForGoogle('primary', 'abc123'));
    expect(a).not.toBe(localIdForGoogle('primary', 'abc124'));
    expect(a).toMatch(/^g_[0-9a-z]+$/);
  });
  it('Google ids for Plano events use base32hex', () => {
    const id = googleIdForLocal('-0mv8mnoyh03888twy');
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(id).toBe(googleIdForLocal('-0mv8mnoyh03888twy'));
  });
});

describe('Google → Plano', () => {
  it('maps all-day events with exclusive end dates', () => {
    const f = fromGoogle({ id: 'x', start: { date: '2026-10-20' }, end: { date: '2026-10-23' } }, 'primary')!;
    expect(f).toMatchObject({ allDay: true, date: '2026-10-20', endDate: '2026-10-22' });
    const one = fromGoogle({ id: 'y', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } }, 'primary')!;
    expect(one.endDate).toBeUndefined();
  });
  it('maps timed events to local wall-clock time', () => {
    const start = new Date(2026, 9, 20, 14, 30).toISOString();
    const end = new Date(2026, 9, 20, 15, 45).toISOString();
    const f = fromGoogle({ id: 'z', summary: 'Зустріч', start: { dateTime: start }, end: { dateTime: end } }, 'work', '#f00')!;
    expect(f).toMatchObject({ date: '2026-10-20', startTime: '14:30', endTime: '15:45', title: 'Зустріч', source: 'google' });
    expect(f.external).toMatchObject({ calendarId: 'work', eventId: 'z', color: '#f00' });
  });
  it('clamps events that run past midnight to the first day', () => {
    const f = fromGoogle(
      { id: 'n', start: { dateTime: new Date(2026, 9, 20, 22, 0).toISOString() }, end: { dateTime: new Date(2026, 9, 21, 2, 0).toISOString() } },
      'primary',
    )!;
    expect(f).toMatchObject({ date: '2026-10-20', startTime: '22:00', endTime: '23:59' });
  });
  it('ignores cancelled events and gives untitled events a name', () => {
    expect(fromGoogle({ id: 'c', status: 'cancelled', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } }, 'p')).toBeNull();
    expect(fromGoogle({ id: 'u', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } }, 'p')!.title).toBe('Без назви');
  });
});

describe('Plano → Google', () => {
  it('builds timed and all-day resources', () => {
    expect(toGoogle(ev({ id: 'a' }), 'Europe/Kyiv')).toMatchObject({
      summary: 'a',
      start: { dateTime: '2026-10-20T10:00:00', timeZone: 'Europe/Kyiv' },
      end: { dateTime: '2026-10-20T11:00:00', timeZone: 'Europe/Kyiv' },
      recurrence: [],
    });
    expect(toGoogle(ev({ id: 'b', allDay: true, endDate: '2026-10-22' }), 'Europe/Kyiv')).toMatchObject({
      start: { date: '2026-10-20' },
      end: { date: '2026-10-23' },
    });
  });
  it('converts recurrence rules and excluded dates', () => {
    expect(
      toRecurrence({ freq: 'weekly', interval: 2, byWeekday: [1, 3], until: '2026-12-31' }, { allDay: false, startTime: '09:30', exdates: ['2026-10-26'] }, 'Europe/Kyiv'),
    ).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T235959Z', 'EXDATE;TZID=Europe/Kyiv:20261026T093000']);
    expect(toRecurrence({ freq: 'daily', interval: 1 }, { allDay: true, exdates: ['2026-10-21'] }, 'UTC')).toEqual([
      'RRULE:FREQ=DAILY',
      'EXDATE;VALUE=DATE:20261021',
    ]);
  });
});

describe('planPull', () => {
  const g = (id: string, extra: Partial<GEvent> = {}): GEvent => ({
    id,
    etag: `"${id}-1"`,
    summary: id,
    start: { date: '2026-10-20' },
    end: { date: '2026-10-21' },
    ...extra,
  });
  const base = { selected: ['primary'], window: W, pendingDeleteKeys: new Set<string>(), now: T0 };

  it('incremental fetch: only listed changes apply, cancelled ones are deleted', () => {
    const local = planPull({ ...base, local: [], remote: [{ calendarId: 'primary', events: [g('e1'), g('e2')] }] }).upserts;
    const inc = { ...base, incremental: new Set(['primary']) };
    expect(planPull({ ...inc, local, remote: [{ calendarId: 'primary', events: [] }] }).deletes).toEqual([]);
    const plan = planPull({ ...inc, local, remote: [{ calendarId: 'primary', events: [g('e1', { status: 'cancelled' })] }] });
    expect(plan.deletes).toEqual([local[0].id]);
    expect(plan.upserts).toEqual([]);
  });

  it('imports new events once (idempotent)', () => {
    const first = planPull({ ...base, local: [], remote: [{ calendarId: 'primary', events: [g('e1')] }] });
    expect(first.upserts).toHaveLength(1);
    const again = planPull({ ...base, local: first.upserts, remote: [{ calendarId: 'primary', events: [g('e1')] }] });
    expect(again).toEqual({ upserts: [], deletes: [] });
  });

  it('updates changed events but keeps local unsent edits', () => {
    const [imported] = planPull({ ...base, local: [], remote: [{ calendarId: 'primary', events: [g('e1')] }] }).upserts;
    const changed = g('e1', { etag: '"e1-2"', summary: 'Нова назва' });
    expect(planPull({ ...base, local: [imported], remote: [{ calendarId: 'primary', events: [changed] }] }).upserts[0].title).toBe('Нова назва');
    const pending = { ...imported, title: 'Моя правка', syncPending: true };
    expect(planPull({ ...base, local: [pending], remote: [{ calendarId: 'primary', events: [changed] }] }).upserts).toHaveLength(0);
  });

  it('deletes events removed in Google, but only inside the fetched window', () => {
    const [imported] = planPull({ ...base, local: [], remote: [{ calendarId: 'primary', events: [g('e1')] }] }).upserts;
    expect(planPull({ ...base, local: [imported], remote: [{ calendarId: 'primary', events: [] }] }).deletes).toEqual([imported.id]);
    const old = { ...imported, date: '2020-01-01' };
    expect(planPull({ ...base, local: [old], remote: [{ calendarId: 'primary', events: [] }] }).deletes).toEqual([]);
  });

  it('does not re-import instances of series created in Plano', () => {
    const series = ev({ id: 's', recurrence: { freq: 'daily', interval: 1 }, external: { provider: 'google', calendarId: 'primary', eventId: 'gs' } });
    const plan = planPull({
      ...base,
      local: [series],
      remote: [{ calendarId: 'primary', events: [g('gs_20261020', { recurringEventId: 'gs' }), g('gs_20261021', { recurringEventId: 'gs' })] }],
    });
    expect(plan).toEqual({ upserts: [], deletes: [] });
  });

  it('skips events waiting to be deleted and drops calendars that were deselected', () => {
    const pendingKey = 'primary\u0000e1';
    expect(planPull({ ...base, pendingDeleteKeys: new Set([pendingKey]), local: [], remote: [{ calendarId: 'primary', events: [g('e1')] }] }).upserts).toEqual([]);
    const [imported] = planPull({ ...base, local: [], remote: [{ calendarId: 'primary', events: [g('e1')] }] }).upserts;
    expect(planPull({ ...base, selected: [], local: [imported], remote: [] }).deletes).toEqual([imported.id]);
  });
});
