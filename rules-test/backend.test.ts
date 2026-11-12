import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, set } from 'firebase/database';

// The app's own Firebase backend (src/lib/backend/firebaseBackend.ts) against the Realtime Database
// emulator, with the deployed rules and the same firebase SDK the app ships: npm run test:rules.

const OWNER = 'owner-uid';
const now = '2026-11-10T10:00:00.000Z';
let env: RulesTestEnvironment;
let database: ReturnType<RulesTestEnvironment['authenticatedContext']>['database'] extends () => infer D ? D : never;

vi.mock('@/lib/firebase/config', () => ({ getFirebaseDb: () => database }));

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
  });
  database = env.authenticatedContext(OWNER).database();
});

const task = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  createdAt: now,
  updatedAt: now,
  title: 'Купити молоко',
  status: 'todo',
  priority: 'medium',
  ...over,
});

async function backend() {
  const { createFirebaseBackend } = await import('@/lib/backend/firebaseBackend');
  return createFirebaseBackend();
}

describe('createFirebaseBackend on the emulator', () => {
  it('writes, reads, updates several places at once and removes', async () => {
    const b = await backend();
    const base = `users/${OWNER}`;
    await b.set(`${base}/tasks/t1`, task('t1'));
    expect(await b.get(`${base}/tasks/t1`)).toMatchObject({ title: 'Купити молоко' });

    await b.update(base, { 'tasks/t1/status': 'completed', 'tasks/t2': task('t2', { title: 'Друга' }) });
    expect(await b.get(`${base}/tasks/t1/status`)).toBe('completed');
    expect(await b.get(`${base}/tasks/t2/title`)).toBe('Друга');

    await b.remove(`${base}/tasks/t2`);
    expect(await b.get(`${base}/tasks/t2`)).toBeNull();
  });

  it('pushes live changes to a subscriber, and stops after unsubscribing', async () => {
    const b = await backend();
    const path = `users/${OWNER}/tasks/t1`;
    const seen: unknown[] = [];
    const off = b.subscribe(
      path,
      (v) => seen.push(v),
      (e) => {
        throw e;
      },
    );
    await vi.waitFor(() => expect(seen).toEqual([null]));
    await b.set(path, task('t1'));
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    off();
    await b.update(path, { title: 'Нова назва' });
    await new Promise((r) => setTimeout(r, 150));
    expect(seen).toHaveLength(2);
  });

  it('reports a rejected write (the rules say no) instead of swallowing it', async () => {
    const b = await backend();
    await expect(b.set(`users/${OWNER}/tasks/t1`, task('t1', { status: 'not-a-status' }))).rejects.toThrow(/PERMISSION_DENIED/);
  });

  it('hands out distinct ids and reports the connection', async () => {
    const b = await backend();
    const ids = new Set([b.newId(), b.newId(), b.newId()]);
    expect(ids.size).toBe(3);
    const states: boolean[] = [];
    const off = b.onConnectionChange((c) => states.push(c));
    await vi.waitFor(() => expect(states).toContain(true));
    off();
  });
});
