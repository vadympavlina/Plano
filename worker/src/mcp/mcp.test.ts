import { describe, expect, it } from 'vitest';
import { handleMcp } from './index';
import { sign, verify, pkceOk, b64url } from './tokens';
import { pushId, type Db } from './rtdb';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Rec = Record<string, Any>;
const SECRET = 'correct horse battery staple 42';
const NOW = new Date('2026-11-24T10:00:00+02:00'); // a Tuesday
const env = { MCP_OWNER_SECRET: SECRET, MCP_OWNER_UID: 'u1', FIREBASE_DATABASE_URL: 'https://example.firebaseio.com', FIREBASE_SERVICE_ACCOUNT: '{}' };

/** An in-memory stand-in for the owner's part of the database (like the real one, it does not keep empty arrays). */
function fakeDb(seed: Record<string, unknown> = {}): Db & { tree: Record<string, unknown> } {
  const tree: Record<string, unknown> = JSON.parse(JSON.stringify(seed));
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.length ? v.map(strip) : undefined;
    if (v && typeof v === 'object') {
      const o = Object.fromEntries(Object.entries(v).flatMap(([k, x]) => (strip(x) === undefined ? [] : [[k, strip(x)]])));
      return Object.keys(o).length ? o : undefined;
    }
    return v;
  };
  const walk = (path: string, create: boolean) => {
    const parts = path.split('/').filter(Boolean);
    const last = parts.pop();
    let node: Record<string, unknown> | undefined = tree;
    for (const p of parts) {
      if (!node![p] || typeof node![p] !== 'object') {
        if (!create) return { node: undefined, last };
        node![p] = {};
      }
      node = node![p] as Record<string, unknown>;
    }
    return { node, last };
  };
  let n = 0;
  return {
    tree,
    newId: () => `id${++n}`,
    async get<T>(path: string) {
      if (!path) return tree as T;
      const { node, last } = walk(path, false);
      const v = last ? node?.[last] : tree;
      return (v === undefined ? null : JSON.parse(JSON.stringify(v))) as T | null;
    },
    async update(values) {
      for (const [path, value] of Object.entries(values)) {
        const v = strip(JSON.parse(JSON.stringify(value ?? null)));
        const { node, last } = walk(path, v !== undefined && v !== null);
        if (!node || !last) continue;
        if (v === undefined || v === null) delete node[last];
        else node[last] = v;
      }
      // The real database does not keep an empty node either.
      const pruned = (strip(tree) as Record<string, unknown> | undefined) ?? {};
      for (const k of Object.keys(tree)) delete tree[k];
      Object.assign(tree, pruned);
    },
  };
}

const rpc = (db: Db, token: string, method: string, params?: unknown, id: number | undefined = 1) =>
  handleMcp(
    new Request('https://plano.test/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }),
    env,
    { db, now: () => NOW },
  );

async function signedIn(): Promise<string> {
  return sign({ k: 'access', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET, 'access');
}
async function call(db: Db, name: string, args: Record<string, unknown> = {}) {
  const res = (await rpc(db, await signedIn(), 'tools/call', { name, arguments: args }))!;
  const body = (await res.json()) as { result: { isError?: boolean; structuredContent?: Rec; content: { text: string }[] } };
  return body.result;
}

describe('signed tokens', () => {
  it('are accepted only with the right secret, purpose and time', async () => {
    const now = Math.floor(Date.now() / 1000);
    const t = await sign({ a: 1, exp: now + 60 }, SECRET, 'access');
    expect((await verify(t, SECRET, 'access'))?.a).toBe(1);
    expect(await verify(t, 'another secret entirely', 'access')).toBeNull();
    expect(await verify(t, SECRET, 'refresh')).toBeNull();
    expect(await verify(t, SECRET, 'access', now + 120)).toBeNull();
    expect(await verify(`${t}x`, SECRET, 'access')).toBeNull();
    expect(await verify('nonsense', SECRET)).toBeNull();
  });

  it('checks PKCE', async () => {
    const verifier = 'a'.repeat(50);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    expect(await pkceOk(verifier, challenge)).toBe(true);
    expect(await pkceOk('b'.repeat(50), challenge)).toBe(false);
    expect(await pkceOk('short', challenge)).toBe(false);
  });

  it('makes ids that sort by time', () => {
    const a = pushId(1_000_000_000_000);
    const b = pushId(1_000_000_000_500);
    expect(a).toHaveLength(20);
    expect(a.slice(0, 8) < b.slice(0, 8)).toBe(true);
  });
});

describe('the sign-in', () => {
  it('stays off without its secrets, and ignores other paths', async () => {
    expect(await handleMcp(new Request('https://plano.test/mcp', { method: 'POST' }), {})).toBeNull();
    expect(await handleMcp(new Request('https://plano.test/mcp', { method: 'POST' }), { ...env, MCP_OWNER_SECRET: 'short' })).toBeNull();
    expect(await handleMcp(new Request('https://plano.test/push/key'), env)).toBeNull();
  });

  it('refuses /mcp without a token and says where to sign in', async () => {
    const res = (await handleMcp(new Request('https://plano.test/mcp', { method: 'POST', body: '{}' }), env))!;
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('https://plano.test/.well-known/oauth-protected-resource');
    const meta = (await (await handleMcp(new Request('https://plano.test/.well-known/oauth-authorization-server'), env))!.json()) as Record<string, unknown>;
    expect(meta).toMatchObject({
      issuer: 'https://plano.test',
      authorization_endpoint: 'https://plano.test/authorize',
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('goes the whole way: register, ask for the passphrase, exchange the code, call the server, refresh', async () => {
    const redirect = 'https://chatgpt.example/callback';
    const reg = (await (await handleMcp(
      new Request('https://plano.test/register', { method: 'POST', body: JSON.stringify({ redirect_uris: [redirect], client_name: 'ChatGPT' }) }),
      env,
    ))!.json()) as { client_id: string };
    const verifier = 'v'.repeat(64);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: reg.client_id,
      redirect_uri: redirect,
      state: 'xyz',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const form = (passphrase: string) =>
      new Request('https://plano.test/authorize', { method: 'POST', body: new URLSearchParams({ ...Object.fromEntries(q), passphrase }) });
    const consent = await handleMcp(new Request(`https://plano.test/authorize?${q}`), env);
    expect(consent!.status).toBe(200);
    expect(await consent!.text()).toContain('ChatGPT');

    // Another address than the registered one: no code is ever sent there.
    const evil = await handleMcp(
      new Request(`https://plano.test/authorize?${new URLSearchParams({ ...Object.fromEntries(q), redirect_uri: 'https://evil.example/cb' })}`),
      env,
    );
    expect(evil!.status).toBe(400);

    const ok = (await handleMcp(form(SECRET), env))!;
    expect(ok.status).toBe(302);
    const to = new URL(ok.headers.get('Location')!);
    expect(to.origin + to.pathname).toBe(redirect);
    expect(to.searchParams.get('state')).toBe('xyz');

    const exchange = (extra: Record<string, string>) =>
      handleMcp(
        new Request('https://plano.test/token', { method: 'POST', body: new URLSearchParams({ client_id: reg.client_id, redirect_uri: redirect, ...extra }) }),
        env,
      );
    expect((await exchange({ grant_type: 'authorization_code', code: to.searchParams.get('code')!, code_verifier: 'w'.repeat(64) }))!.status).toBe(400);
    const tokens = (await (await exchange({ grant_type: 'authorization_code', code: to.searchParams.get('code')!, code_verifier: verifier }))!.json()) as {
      access_token: string;
      refresh_token: string;
    };
    expect(tokens.access_token).toBeTruthy();

    const res = await rpc(fakeDb(), tokens.access_token, 'initialize', { protocolVersion: '2025-06-18' });
    expect(((await res!.json()) as { result: { serverInfo: { name: string } } }).result.serverInfo.name).toBe('plano');

    const again = (await (await exchange({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }))!.json()) as { access_token: string };
    expect(again.access_token).toBeTruthy();
    // A refresh token is not an access token.
    expect((await rpc(fakeDb(), tokens.refresh_token, 'ping'))!.status).toBe(401);
  }, 10_000);
});

describe('the protocol', () => {
  it('lists the tools with what they change', async () => {
    const res = (await rpc(fakeDb(), await signedIn(), 'tools/list'))!;
    const { tools } = ((await res.json()) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean; destructiveHint?: boolean } }[] } })
      .result;
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['add', 'today', 'complete_task', 'add_note', 'log_habit']));
    expect(tools.find((t) => t.name === 'today')!.annotations.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === 'delete_task')!.annotations.destructiveHint).toBe(true);
  });

  it('answers a notification with nothing, and an unknown method with an error', async () => {
    const token = await signedIn();
    const note = await handleMcp(
      new Request('https://plano.test/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      }),
      env,
      { db: fakeDb() },
    );
    expect(note!.status).toBe(202);
    const bad = (await (await rpc(fakeDb(), token, 'resources/list'))!.json()) as { error: { code: number } };
    expect(bad.error.code).toBe(-32601);
  });
});

describe('the tools', () => {
  const seed = () => ({
    categories: { c1: { id: 'c1', name: 'Робота', color: 'blue', order: 0, createdAt: 'x', updatedAt: 'x' } },
    projects: { p1: { id: 'p1', name: 'EdFlow', color: 'purple', status: 'active', createdAt: 'x', updatedAt: 'x' } },
    tasks: {
      t1: { id: 't1', title: 'Підготувати звіт', status: 'todo', priority: 'medium', dueDate: '2026-11-23', createdAt: 'x', updatedAt: 'x' },
      t2: { id: 't2', title: 'Купити ліки', status: 'todo', priority: 'medium', dueDate: '2026-11-24', createdAt: 'x', updatedAt: 'x' },
      t3: {
        id: 't3',
        title: 'Зарядка',
        status: 'todo',
        priority: 'low',
        dueDate: '2026-11-24',
        recurrence: { freq: 'daily', interval: 1 },
        createdAt: 'x',
        updatedAt: 'x',
      },
    },
    events: {
      e1: {
        id: 'e1',
        title: 'Нарада',
        date: '2026-11-24',
        allDay: false,
        startTime: '09:00',
        endTime: '10:00',
        source: 'plano',
        createdAt: 'x',
        updatedAt: 'x',
      },
    },
    habits: {
      h1: {
        id: 'h1',
        name: 'Вода',
        icon: '💧',
        color: 'blue',
        schedule: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        goalType: 'count',
        target: 8,
        archived: false,
        createdAt: 'x',
        updatedAt: 'x',
      },
    },
  });

  it("add: reads a line like the app does, with the owner's categories and projects", async () => {
    const db = fakeDb(seed());
    const r = await call(db, 'add', { text: 'Зустріч з Олею завтра о 15 на годину #робота' });
    const item = r.structuredContent!.added[0];
    expect(item).toMatchObject({ kind: 'event', title: 'Зустріч з Олею', date: '2026-11-25', time: '15:00', endTime: '16:00' });
    expect((db.tree.events as Rec)[item.id]).toMatchObject({ categoryId: 'c1', source: 'plano', allDay: false });
    const t = (await call(db, 'add', { text: 'Купити молоко завтра !!' })).structuredContent!.added[0];
    expect(t).toMatchObject({ kind: 'task', title: 'Купити молоко', date: '2026-11-25', priority: 'high' });
  });

  it('add: several lines, a note, and an empty line is refused', async () => {
    const db = fakeDb(seed());
    const r = await call(db, 'add', { text: "Задача один\nЗадача два у п'ятницю\nнотатка: ідея для застосунку" });
    expect(r.structuredContent!.added.map((x: { kind: string }) => x.kind)).toEqual(['task', 'task', 'note']);
    expect((await call(db, 'add', { text: '  ' })).isError).toBe(true);
  });

  it('add: an event goes to Google Calendar too when it is connected', async () => {
    const db = fakeDb({ ...seed(), integrations: { google_calendar: { status: 'connected', targetCalendarId: 'cal' } } });
    const e = (await call(db, 'add', { text: 'Лікар завтра о 11', kind: 'event' })).structuredContent!.added[0];
    expect((db.tree.events as Rec)[e.id].syncPending).toBe(true);
  });

  it('today: overdue, today, events and habits', async () => {
    const r = (await call(fakeDb(seed()), 'today')).structuredContent!;
    expect(r.date).toBe('2026-11-24');
    expect(r.weekday).toBe('вівторок');
    expect(r.overdue.map((t: { id: string }) => t.id)).toEqual(['t1']);
    expect(r.tasksToday.map((t: { id: string }) => t.id).sort()).toEqual(['t2', 't3']);
    expect(r.events[0]).toMatchObject({ title: 'Нарада', time: '09:00' });
    expect(r.habits[0]).toMatchObject({ name: 'Вода', done: 0, target: 8 });
  });

  it('list_tasks filters, and complains about an unknown project', async () => {
    const db = fakeDb(seed());
    expect((await call(db, 'list_tasks', { to: '2026-11-23' })).structuredContent!.tasks.map((t: { id: string }) => t.id)).toEqual(['t1']);
    expect((await call(db, 'list_tasks', { query: 'ліки' })).structuredContent!.total).toBe(1);
    expect((await call(db, 'list_tasks', { project: 'Немає' })).isError).toBe(true);
  });

  it('complete_task: by title, and a repeating task gets its next copy', async () => {
    const db = fakeDb(seed());
    const r = (await call(db, 'complete_task', { title: 'Купити' })).structuredContent!;
    expect(r.completed).toMatchObject({ id: 't2' });
    expect((db.tree.tasks as Rec).t2.status).toBe('completed');
    const rep = (await call(db, 'complete_task', { id: 't3' })).structuredContent!;
    expect(rep.nextRepeat.date).toBe('2026-11-25');
    expect(Object.keys(db.tree.tasks as object)).toHaveLength(4);
    // Done twice by mistake: not a second copy, and it says so.
    expect((await call(db, 'complete_task', { id: 't3' })).isError).toBe(true);
  });

  it('complete_task: an ambiguous title asks for an id', async () => {
    const db = fakeDb(seed());
    const r = await call(db, 'complete_task', { title: 'у' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('t1');
  });

  it('update_task: moves, renames, clears', async () => {
    const db = fakeDb(seed());
    const r = (await call(db, 'update_task', { id: 't2', date: '2026-12-01', time: '09:30', new_title: 'Купити ліки в аптеці', priority: 'high' }))
      .structuredContent!;
    expect(r.updated).toMatchObject({ date: '2026-12-01', time: '09:30', title: 'Купити ліки в аптеці', priority: 'high' });
    const cleared = (await call(db, 'update_task', { id: 't2', date: null, time: null })).structuredContent!;
    expect(cleared.updated).toMatchObject({ date: null, time: null });
    expect((await call(db, 'update_task', { id: 't2', date: 'завтра' })).isError).toBe(true);
    expect((await call(db, 'update_task', { id: 't2' })).isError).toBe(true);
  });

  it('delete_task and delete_event need exact ids', async () => {
    const db = fakeDb(seed());
    expect((await call(db, 'delete_task', { id: 'nope' })).isError).toBe(true);
    await call(db, 'delete_task', { id: 't1' });
    await call(db, 'delete_event', { id: 'e1' });
    expect((db.tree.tasks as object) && 't1' in (db.tree.tasks as object)).toBe(false);
    expect(db.tree.events).toBeUndefined();
  });

  it('list_events expands a repeating event', async () => {
    const db = fakeDb({
      events: {
        e9: {
          id: 'e9',
          title: 'Планерка',
          date: '2026-11-17',
          allDay: false,
          startTime: '10:00',
          endTime: '10:30',
          recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] },
          source: 'plano',
          createdAt: 'x',
          updatedAt: 'x',
        },
      },
    });
    const r = (await call(db, 'list_events', { from: '2026-11-23', to: '2026-12-08' })).structuredContent!;
    expect(r.events.map((e: { date: string }) => e.date)).toEqual(['2026-11-24', '2026-12-01', '2026-12-08']);
  });

  it('notes: create, find, read, append; the trash is not shown', async () => {
    const db = fakeDb({ notes: { n9: { id: 'n9', title: 'Старе', content: 'x', tags: [], isPinned: false, deletedAt: 'y', createdAt: 'x', updatedAt: 'x' } } });
    const created = (await call(db, 'add_note', { title: 'Ідеї', content: '- [ ] перша\n- [ ] друга', tags: ['plano'] })).structuredContent!.created;
    expect((await call(db, 'search_notes', { query: 'друга' })).structuredContent!.notes[0]).toMatchObject({ id: created.id, title: 'Ідеї' });
    expect((await call(db, 'search_notes', {})).structuredContent!.total).toBe(1);
    await call(db, 'append_to_note', { title: 'Ідеї', text: '- [ ] третя' });
    expect((await call(db, 'get_note', { id: created.id })).structuredContent!.content).toBe('- [ ] перша\n- [ ] друга\n\n- [ ] третя');
    expect((await call(db, 'get_note', { title: 'Старе' })).isError).toBe(true);
  });

  it('habits: a counting habit goes up, can be set and cleared', async () => {
    const db = fakeDb(seed());
    expect((await call(db, 'log_habit', { name: 'Вода' })).structuredContent).toMatchObject({ value: 1, target: 8, date: '2026-11-24' });
    expect((await call(db, 'log_habit', { name: 'Вода' })).structuredContent).toMatchObject({ value: 2 });
    expect((await call(db, 'log_habit', { id: 'h1', value: 6 })).structuredContent).toMatchObject({ value: 6 });
    expect((db.tree.habitLogs as Record<string, Record<string, number>>).h1['2026-11-24']).toBe(6);
    await call(db, 'log_habit', { id: 'h1', value: 0 });
    expect(db.tree.habitLogs).toBeUndefined();
    expect((await call(db, 'list_habits')).structuredContent!.habits[0]).toMatchObject({ today: 0, scheduledToday: true });
  });

  it('does not leak what went wrong inside', async () => {
    const broken: Db = {
      newId: () => 'x',
      get: async () => {
        throw new Error('secret database detail');
      },
      update: async () => undefined,
    };
    const r = await call(broken, 'today');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).not.toContain('secret');
  });
});
