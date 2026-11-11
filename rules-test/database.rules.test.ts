import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { get, ref, set, update } from 'firebase/database';

// Security-rules tests against the Firebase Realtime Database emulator: npm run test:rules
// (it starts the emulator itself; needs Java). They read the same database.rules.json that is deployed.

const OWNER = 'owner-uid';
const STRANGER = 'stranger-uid';
const NOT_ALLOWED = 'not-allowed-uid';
const now = '2026-11-10T10:00:00.000Z';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-plano',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), `allowlist/${OWNER}`), true);
    await set(ref(ctx.database(), `allowlist/${STRANGER}`), true);
  });
});

const db = (uid: string) => env.authenticatedContext(uid).database();
const task = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  createdAt: now,
  updatedAt: now,
  title: 'Купити молоко',
  status: 'todo',
  priority: 'medium',
  ...over,
});
const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  createdAt: now,
  updatedAt: now,
  title: 'Нарада',
  date: '2026-11-10',
  allDay: false,
  source: 'plano',
  ...over,
});
const category = (over: Record<string, unknown> = {}) => ({ id: 'c1', createdAt: now, updatedAt: now, name: 'Робота', color: 'blue', ...over });

describe('who may touch the data', () => {
  it('turns away anyone who is not signed in', async () => {
    const anon = env.unauthenticatedContext().database();
    await assertFails(get(ref(anon, `users/${OWNER}`)));
    await assertFails(set(ref(anon, `users/${OWNER}/tasks/t1`), task()));
  });

  it('turns away a signed-in user who is not on the allowlist', async () => {
    await assertFails(get(ref(db(NOT_ALLOWED), `users/${NOT_ALLOWED}`)));
    await assertFails(set(ref(db(NOT_ALLOWED), `users/${NOT_ALLOWED}/tasks/t1`), task()));
  });

  it('lets an allowed user read and write their own data', async () => {
    await assertSucceeds(set(ref(db(OWNER), `users/${OWNER}/tasks/t1`), task()));
    await assertSucceeds(get(ref(db(OWNER), `users/${OWNER}/tasks/t1`)));
  });

  it("keeps one allowed user out of another user's data", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(ctx.database(), `users/${OWNER}/tasks/t1`), task());
    });
    await assertFails(get(ref(db(STRANGER), `users/${OWNER}/tasks/t1`)));
    await assertFails(set(ref(db(STRANGER), `users/${OWNER}/tasks/t2`), task({ id: 't2' })));
  });

  it('does not let anyone edit the allowlist, but lets a user read their own entry', async () => {
    await assertFails(set(ref(db(OWNER), `allowlist/${OWNER}`), true));
    await assertFails(set(ref(db(NOT_ALLOWED), `allowlist/${NOT_ALLOWED}`), true));
    await assertSucceeds(get(ref(db(OWNER), `allowlist/${OWNER}`)));
    await assertFails(get(ref(db(OWNER), `allowlist/${STRANGER}`)));
  });

  it('has no rule for the root or for unknown top-level nodes', async () => {
    await assertFails(get(ref(db(OWNER), '/')));
    await assertFails(set(ref(db(OWNER), 'public/x'), 1));
  });
});

describe('what a task may look like', () => {
  const path = `users/${OWNER}/tasks/t1`;
  it('accepts a complete task, with optional fields', async () => {
    await assertSucceeds(set(ref(db(OWNER), path), task({ dueDate: '2026-11-12', startTime: '09:30', endTime: '10:15', description: 'x' })));
  });
  it('rejects a task without a required field', async () => {
    const noTitle: Record<string, unknown> = task();
    delete noTitle.title;
    await assertFails(set(ref(db(OWNER), path), noTitle));
  });
  it('rejects an empty or very long title', async () => {
    await assertFails(set(ref(db(OWNER), path), task({ title: '' })));
    await assertFails(set(ref(db(OWNER), path), task({ title: 'я'.repeat(301) })));
  });
  it('rejects an unknown status or priority', async () => {
    await assertFails(set(ref(db(OWNER), path), task({ status: 'done' })));
    await assertFails(set(ref(db(OWNER), path), task({ priority: 'critical' })));
  });
  it('rejects malformed dates and times', async () => {
    await assertFails(set(ref(db(OWNER), path), task({ dueDate: '10.11.2026' })));
    await assertFails(set(ref(db(OWNER), path), task({ startTime: '25:00' })));
    await assertFails(set(ref(db(OWNER), path), task({ endTime: '9:5' })));
  });
  it('rejects an id that does not match its key', async () => {
    await assertFails(set(ref(db(OWNER), path), task({ id: 'other' })));
  });
  it('rejects a partial update that breaks a field', async () => {
    await assertSucceeds(set(ref(db(OWNER), path), task()));
    await assertFails(update(ref(db(OWNER), path), { status: 'nope' }));
    await assertSucceeds(update(ref(db(OWNER), path), { status: 'completed' }));
  });
});

describe('events, categories, profile and settings', () => {
  it('accepts a valid event and rejects a bad source or time', async () => {
    const p = `users/${OWNER}/events/e1`;
    await assertSucceeds(set(ref(db(OWNER), p), event({ startTime: '13:00', endTime: '14:00' })));
    await assertFails(set(ref(db(OWNER), p), event({ source: 'outlook' })));
    await assertFails(set(ref(db(OWNER), p), event({ startTime: '24:00' })));
    await assertFails(set(ref(db(OWNER), p), event({ allDay: 'yes' })));
  });

  it('accepts only the known category colours', async () => {
    const p = `users/${OWNER}/categories/c1`;
    await assertSucceeds(set(ref(db(OWNER), p), category()));
    await assertFails(set(ref(db(OWNER), p), category({ color: '#ff0000' })));
    await assertFails(set(ref(db(OWNER), p), category({ name: '' })));
  });

  it('accepts an https avatar and refuses other schemes or unknown profile fields', async () => {
    const p = `users/${OWNER}/profile`;
    await assertSucceeds(set(ref(db(OWNER), p), { displayName: 'Вадим', avatarUrl: 'https://example.com/a.png', updatedAt: now }));
    await assertFails(set(ref(db(OWNER), p), { displayName: 'Вадим', avatarUrl: 'http://example.com/a.png', updatedAt: now }));
    await assertFails(set(ref(db(OWNER), p), { displayName: 'Вадим', role: 'admin', updatedAt: now }));
    await assertFails(set(ref(db(OWNER), p), { displayName: 'я'.repeat(81), updatedAt: now }));
  });

  it('accepts scalar settings only', async () => {
    const p = `users/${OWNER}/settings`;
    await assertSucceeds(set(ref(db(OWNER), p), { theme: 'dark', weekStartsOn: 1, enabled: true }));
    await assertFails(set(ref(db(OWNER), `${p}/nested`), { a: 1 }));
  });
});
