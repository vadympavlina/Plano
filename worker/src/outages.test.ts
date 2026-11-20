import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describeDay, kyivEpoch, kyivParts, loadOutages, outagesOf, parseOutages, powerReminders, toMinutes } from './outages';

const html = readFileSync(new URL('./fixtures/roe-disconnections.html', import.meta.url), 'utf8');

describe('reading the company page', () => {
  const o = parseOutages(html, 1);

  it('finds the queues, the days and when the page was updated', () => {
    expect(o.queues).toEqual(['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2']);
    expect(o.days.map((d) => [d.date, d.state])).toEqual([
      ['2026-11-20', 'schedule'],
      ['2026-11-21', 'pending'],
    ]);
    expect(o.updatedAt).toBe('2026-11-20T10:00');
  });

  it('reads one or several intervals of every queue', () => {
    const d = o.days[0];
    expect(d.slots['1.1']).toEqual([
      ['09:00', '13:00'],
      ['21:00', '23:59'],
    ]);
    expect(d.slots['2.1']).toEqual([['10:00', '14:00']]);
    expect(d.slots['3.2']).toEqual([['13:00', '17:00']]);
    expect(d.slots['5.1']).toEqual([['17:00', '21:00']]);
    expect(d.slots['6.2']).toHaveLength(2);
  });

  it('keeps «Очікується» as not published yet', () => {
    expect(o.days[1].slots['4.1']).toBeNull();
  });

  it('finds where a household looks up its queue', () => {
    expect(o.lookup.city).toMatch(/GPV_cherga_misto_Rivne.*\.pdf$/);
    expect(o.lookup.region).toMatch(/Rivnenska_oblast.*\.pdf$/);
  });

  it('refuses a page that is not the schedule', () => {
    expect(() => parseOutages('<html><body>Технічні роботи</body></html>')).toThrow();
    expect(() => parseOutages('<table><tr><td>x</td></tr></table>')).toThrow();
  });

  it('reads a day with no outages and a cell that spans columns', () => {
    const page = `<div id="fetched-data-container"><table>
      <tr><td>Підчерга</td><td>1.1</td><td>1.2</td></tr>
      <tr><td>22.11.2026</td><td colspan="2">Відключень не передбачено</td></tr>
      <tr><td>23.11.2026</td><td>8:00 - 10:30</td><td>Очікується</td></tr></table></div> Оновлено: 22.11.2026 9:05`;
    const p = parseOutages(page);
    expect(p.days[0]).toMatchObject({ state: 'none', slots: { '1.1': [], '1.2': [] } });
    expect(p.days[1].slots).toEqual({ '1.1': [['08:00', '10:30']], '1.2': null });
    expect(p.days[1].state).toBe('schedule');
    expect(p.updatedAt).toBe('2026-11-22T09:05');
  });
});

describe('Kyiv time', () => {
  it('knows the offset in winter and summer', () => {
    expect(kyivEpoch('2026-11-20', 9 * 60)).toBe(Date.UTC(2026, 10, 20, 7, 0));
    expect(kyivEpoch('2026-07-01', 9 * 60)).toBe(Date.UTC(2026, 6, 1, 6, 0));
    expect(kyivParts(Date.UTC(2026, 10, 20, 22, 30))).toEqual({ date: '2026-11-21', minutes: 30 });
  });
  it('treats 23:59 as the end of the day', () => {
    expect(toMinutes('23:59', true)).toBe(1440);
    expect(toMinutes('23:59')).toBe(23 * 60 + 59);
  });
});

describe('outages of a queue', () => {
  const o = parseOutages(html, 1);

  it('lists them as instants and joins one that runs over midnight', () => {
    const list = outagesOf(o, '1.1');
    expect(list).toHaveLength(2);
    expect(list[0].start).toBe(kyivEpoch('2026-11-20', 540));
    expect(list[1].end).toBe(kyivEpoch('2026-11-21', 0));
    const joined = outagesOf(
      {
        ...o,
        days: [
          { date: '2026-11-20', state: 'schedule', slots: { '1.1': [['21:00', '23:59']] } },
          { date: '2026-11-21', state: 'schedule', slots: { '1.1': [['00:00', '03:00']] } },
        ],
      },
      '1.1',
    );
    expect(joined).toEqual([{ start: kyivEpoch('2026-11-20', 21 * 60), end: kyivEpoch('2026-11-21', 180) }]);
  });

  it('says what a day looks like in words', () => {
    expect(describeDay(o, '1.1', '2026-11-20')).toBe('09:00–13:00, 21:00–24:00');
    expect(describeDay(o, '1.1', '2026-11-21')).toBeNull();
  });
});

describe('pushes before an outage', () => {
  const o = parseOutages(html, 1);
  const morning = kyivEpoch('2026-11-20', 8 * 60);

  it('comes `lead` minutes ahead with the hours and the length', () => {
    const [first] = powerReminders(o, '1.1', 30, morning);
    expect(first.at).toBe(kyivEpoch('2026-11-20', 8 * 60 + 30));
    expect(first.title).toBe('⚡ Світло вимкнуть о 09:00');
    expect(first.body).toBe('Черга 1.1 · до 13:00 (4 год)');
  });

  it('is due now when the moment has passed but the outage has not begun', () => {
    const now = kyivEpoch('2026-11-20', 8 * 60 + 50);
    expect(powerReminders(o, '1.1', 30, now)[0].at).toBe(now);
  });

  it('skips outages that began, and those already sent', () => {
    const during = kyivEpoch('2026-11-20', 10 * 60);
    const list = powerReminders(o, '1.1', 30, during);
    expect(list).toHaveLength(1);
    expect(list[0].title).toContain('21:00');
    expect(powerReminders(o, '1.1', 30, during, [list[0].tag])).toEqual([]);
  });

  it('says nothing for a queue that is not in the table', () => {
    expect(powerReminders(o, '9.9', 30, morning)).toEqual([]);
  });
});

describe('loading with a copy', () => {
  const store = () => {
    const m = new Map<string, Response>();
    return {
      m,
      match: async (r: Request) => m.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void m.set(r.url, res),
    };
  };
  const ok = () => Promise.resolve(new Response(html, { status: 200 }));

  it('asks the site once and answers from the copy after that', async () => {
    const cache = store();
    let calls = 0;
    const fetcher = (() => (calls++, ok())) as unknown as typeof fetch;
    const a = await loadOutages(fetcher, cache, 10);
    const b = await loadOutages(fetcher, cache, 20);
    expect(calls).toBe(1);
    expect(b.days).toEqual(a.days);
  });

  it('answers with the old copy, marked, when the site is down', async () => {
    const cache = store();
    await loadOutages((() => ok()) as unknown as typeof fetch, cache, 10);
    cache.m.delete('https://plano.internal/outages?fresh');
    const down = (() => Promise.resolve(new Response('', { status: 503 }))) as unknown as typeof fetch;
    expect((await loadOutages(down, cache, 20)).stale).toBe(true);
  });

  it('fails when the site is down and there is no copy', async () => {
    const down = (() => Promise.resolve(new Response('', { status: 503 }))) as unknown as typeof fetch;
    await expect(loadOutages(down, store(), 1)).rejects.toThrow();
  });
});
