import { describe, expect, it } from 'vitest';
import { Reminders } from './reminders';
import { checkSnoozeToken, snoozeToken } from './crypto';
import type { Env } from './index';

function store() {
  const m = new Map<string, unknown>();
  return {
    m,
    get: async <T,>(k: string) => m.get(k) as T | undefined,
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
