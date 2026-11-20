import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reminders } from './reminders';
import { checkSnoozeToken, snoozeToken } from './crypto';
import type { Env } from './index';
import { kyivEpoch } from './outages';
import * as push from './push';

vi.mock('./push', async (orig) => ({ ...(await orig<typeof import('./push')>()), sendPush: vi.fn(async () => true) }));

function store() {
  const m = new Map<string, unknown>();
  return {
    m,
    get: async <T>(k: string) => m.get(k) as T | undefined,
    put: async (k: string, v: unknown) => void m.set(k, structuredClone(v)),
    delete: async (ks: string[]) => ks.filter((k) => m.delete(k)).length,
    setAlarm: async () => undefined,
    deleteAlarm: async () => undefined,
  };
}

const make = () => {
  const s = store();
  const r = new Reminders({ storage: s } as never, {} as never) as Reminders & { ctx: unknown; env: unknown };
  r.ctx = { storage: s };
  r.env = { GOOGLE_CLIENT_SECRET: 'secret' } as Env;
  return { r, s };
};
const req = (path: string, body: unknown, uid = 'u1') =>
  new Request(`https://do${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'x-uid': uid } });

describe('user Durable Object', () => {
  it('stores big backups encrypted in chunks, keeps the last 8 and restores them', async () => {
    const { r, s } = make();
    const data = JSON.stringify({ notes: 'п'.repeat(300_000) });
    const { at } = (await (await r.fetch(req('/backup/put', { data }))).json()) as { at: string };
    expect([...s.m.keys()].filter((k) => k.startsWith('b:')).length).toBeGreaterThan(1);
    expect(String(s.m.get(`b:${at}:0`))).not.toContain('пппп');
    const back = (await (await r.fetch(req('/backup/get', { at }))).json()) as { data: string };
    expect(back.data).toBe(data);
    expect((await r.fetch(req('/backup/get', { at }, 'u2'))).status).toBe(403);
    for (let i = 0; i < 9; i++) await r.fetch(req('/backup/put', { data: `{"i":${i}}` }));
    const { backups } = (await (await r.fetch(req('/backup/list', {}))).json()) as { backups: unknown[] };
    expect(backups).toHaveLength(8);
    expect(s.m.has(`b:${at}:0`)).toBe(false);
  });

  it('keeps recent error reports', async () => {
    const { r } = make();
    await r.fetch(req('/errors/add', { errors: [{ at: 'now', message: 'boom' }] }));
    expect(await (await r.fetch(req('/errors/list', {}))).json()).toEqual({ errors: [{ at: 'now', message: 'boom' }] });
  });

  it('snoozed reminders survive a new schedule from the app', async () => {
    const { r, s } = make();
    await r.fetch(req('/push/schedule', { items: [{ at: Date.now() + 3_600_000, title: 'Подія' }] }));
    await r.fetch(req('/push/snooze', { item: { title: 'Задача', tag: 'task:1' } }));
    await r.fetch(req('/push/schedule', { items: [] }));
    expect(s.m.get('snoozed')).toMatchObject([{ title: 'Задача', tag: 'task:1' }]);
    expect(s.m.get('uid')).toBe('u1');
  });
});

describe('snooze token', () => {
  it('works only for its own uid and secret', async () => {
    const t = await snoozeToken('u1', 'secret');
    expect(await checkSnoozeToken('u1', t, 'secret')).toBe(true);
    expect(await checkSnoozeToken('u2', t, 'secret')).toBe(false);
    expect(await checkSnoozeToken('u1', t, 'other')).toBe(false);
    expect(await checkSnoozeToken('u1', 'junk!', 'secret')).toBe(false);
  });
});

describe('power outage warnings', () => {
  const page = readFileSync(new URL('./fixtures/roe-disconnections.html', import.meta.url), 'utf8');
  const at = (hh: number, mm = 0) => vi.setSystemTime(kyivEpoch('2026-11-20', hh * 60 + mm));
  const sent = () => vi.mocked(push.sendPush).mock.calls.map((c) => (c[1] as { title: string }).title);
  const withPage = (html: string) => vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(html));
  const setup = () => {
    const { r, s } = make();
    (r as unknown as { env: Env }).env = { GOOGLE_CLIENT_SECRET: 'secret', VAPID_JWK: '{}' } as Env;
    s.m.set('subs', [{ endpoint: 'e1', keys: { p256dh: 'p', auth: 'a' } }]);
    return { r, s };
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.mocked(push.sendPush).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('plans a warning before each outage of the queue and arms for the first', async () => {
    at(8);
    withPage(page);
    const { r, s } = setup();
    await r.fetch(req('/push/power', { queue: '1.1', leadMin: 30 }));
    expect(s.m.get('power')).toEqual({ queue: '1.1', leadMin: 30 });
    const items = s.m.get('powerItems') as { at: number; title: string; tag: string }[];
    expect(items.map((i) => i.title)).toEqual(['⚡ Світло вимкнуть о 09:00', '⚡ Світло вимкнуть о 21:00']);
    expect(items[0].at).toBe(kyivEpoch('2026-11-20', 8 * 60 + 30));
    // The first look only learns the schedule: nothing is announced.
    expect(sent()).toEqual([]);
  });

  it('delivers a warning when its time comes and does not repeat it', async () => {
    at(8);
    withPage(page);
    const { r, s } = setup();
    await r.fetch(req('/push/power', { queue: '1.1', leadMin: 30 }));
    at(8, 31);
    await r.alarm();
    expect(sent()).toEqual(['⚡ Світло вимкнуть о 09:00']);
    expect(s.m.get('powerSent')).toEqual([expect.stringMatching(/^pw:/)]);
    // Twenty minutes later the schedule is read again: the sent warning is not planned a second time.
    at(8, 55);
    await r.alarm();
    expect(sent()).toHaveLength(1);
    expect((s.m.get('powerItems') as { title: string }[]).map((i) => i.title)).toEqual(['⚡ Світло вимкнуть о 21:00']);
  });

  it('tells when a new day is published or a day changes', async () => {
    at(8);
    withPage(page);
    const { r } = setup();
    await r.fetch(req('/push/power', { queue: '4.1', leadMin: 30 }));
    // Tomorrow's hours appear, and today's change.
    const published = page
      .replace(/(<td[^>]*>\s*<p[^>]*>)Очікується(<\/p>)/g, '$117:00 - 21:00$2')
      .replace('<p style="white-space:nowrap">17:00 - 21:00</p>', '<p style="white-space:nowrap">18:00 - 22:00</p>');
    withPage(published);
    at(8, 30);
    await r.alarm();
    const titles = sent();
    expect(titles).toContain('⚡ Графік на 21 листопада');
    expect(titles).toContain('⚡ Графік на 20 листопада змінено');
  });

  it('stops watching when the app turns it off, and forgets the old queue when it changes', async () => {
    at(8);
    withPage(page);
    const { r, s } = setup();
    await r.fetch(req('/push/power', { queue: '1.1', leadMin: 30 }));
    await r.fetch(req('/push/power', { queue: '2.1', leadMin: 15 }));
    expect((s.m.get('powerItems') as { body: string }[])[0].body).toContain('Черга 2.1');
    await r.fetch(req('/push/power', { queue: null }));
    for (const k of ['power', 'powerItems', 'powerKnown', 'powerSent', 'powerNext']) expect(s.m.has(k)).toBe(false);
  });

  it('keeps the old plan and tries again soon when the site is down', async () => {
    at(8);
    withPage(page);
    const { r, s } = setup();
    await r.fetch(req('/push/power', { queue: '1.1', leadMin: 30 }));
    const planned = s.m.get('powerItems');
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    at(8, 25);
    await r.alarm();
    expect(s.m.get('powerItems')).toEqual(planned);
    expect(s.m.get('powerNext')).toBe(kyivEpoch('2026-11-20', 8 * 60 + 25) + 10 * 60_000);
  });
});
