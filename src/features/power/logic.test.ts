import { describe, expect, it } from 'vitest';
import { kyivEpoch, type Outages } from '@/lib/power/shared';
import { clock, compactSpan, dayBands, lengthLabel, spanLabel, spansOf, statusAt, totalMinutes, untilLabel } from './logic';

const data: Outages = {
  source: 'x',
  fetchedAt: 0,
  queues: ['1.1', '4.1'],
  lookup: {},
  days: [
    {
      date: '2026-11-20',
      state: 'schedule',
      slots: {
        '1.1': [
          ['09:00', '13:00'],
          ['21:00', '23:59'],
        ],
        '4.1': [['17:00', '21:00']],
      },
    },
    { date: '2026-11-21', state: 'schedule', slots: { '1.1': [['00:00', '02:00']], '4.1': null } },
  ],
};
const at = (date: string, h: number, m = 0) => kyivEpoch(date, h * 60 + m);

describe('what a queue has on a day', () => {
  it('reads the published hours, and null for a day or queue not published', () => {
    expect(spansOf(data, '1.1', '2026-11-20')).toEqual([
      { start: 540, end: 780 },
      { start: 1260, end: 1440 },
    ]);
    expect(spansOf(data, '4.1', '2026-11-21')).toBeNull();
    expect(spansOf(data, '1.1', '2026-11-25')).toBeNull();
  });

  it('cuts an outage that runs over midnight to each day it touches', () => {
    expect(dayBands(data, '1.1', '2026-11-20')).toEqual([
      { start: 540, end: 780 },
      { start: 1260, end: 1440 },
    ]);
    expect(dayBands(data, '1.1', '2026-11-21')).toEqual([{ start: 0, end: 120 }]);
  });

  it('counts the minutes without power', () => {
    expect(totalMinutes(spansOf(data, '1.1', '2026-11-20')!)).toBe(4 * 60 + 3 * 60);
  });
});

describe('the status right now', () => {
  it('is «off» during an outage, with when it ends and what comes after', () => {
    const s = statusAt(data, '1.1', at('2026-11-20', 10));
    expect(s).toMatchObject({ kind: 'off', until: at('2026-11-20', 13) });
    expect(s.kind === 'off' && s.then?.start).toBe(at('2026-11-20', 21));
  });

  it('runs an outage across midnight into the next day', () => {
    const s = statusAt(data, '1.1', at('2026-11-20', 23, 30));
    expect(s).toMatchObject({ kind: 'off', until: at('2026-11-21', 2) });
  });

  it('is «on» with the next outage between outages', () => {
    const s = statusAt(data, '1.1', at('2026-11-20', 14));
    expect(s).toMatchObject({ kind: 'on', next: { start: at('2026-11-20', 21) } });
  });

  it('is «on» without a next outage once everything published is behind', () => {
    expect(statusAt(data, '4.1', at('2026-11-20', 22))).toEqual({ kind: 'on', next: undefined });
  });

  it('is «unknown» when today has no hours for the queue', () => {
    expect(statusAt(data, '4.1', at('2026-11-21', 9)).kind).toBe('unknown');
    expect(statusAt(data, '9.9', at('2026-11-20', 9)).kind).toBe('unknown');
  });
});

describe('words', () => {
  it('writes hours as short as possible for a narrow header', () => {
    expect(compactSpan({ start: 540, end: 780 })).toBe('9–13');
    expect(compactSpan({ start: 1260, end: 1440 })).toBe('21–24');
    expect(compactSpan({ start: 570, end: 660 })).toBe('9:30–11');
  });
  it('writes clocks, lengths and ends', () => {
    expect(clock(at('2026-11-20', 9, 5))).toBe('09:05');
    expect(clock(at('2026-11-21', 0), true)).toBe('24:00');
    expect(lengthLabel(4 * 3_600_000)).toBe('4 год');
    expect(lengthLabel(80 * 60_000)).toBe('1 год 20 хв');
    expect(lengthLabel(45 * 60_000)).toBe('45 хв');
    expect(spanLabel({ start: 1260, end: 1440 })).toBe('21:00–24:00');
  });
  it('says «до» with the day when it is not today', () => {
    expect(untilLabel(at('2026-11-20', 13), at('2026-11-20', 10))).toBe('13:00');
    expect(untilLabel(at('2026-11-21', 2), at('2026-11-20', 23))).toBe('завтра 02:00');
    expect(untilLabel(at('2026-11-21', 0), at('2026-11-20', 23))).toBe('24:00');
  });
});
