import { describe, expect, it } from 'vitest';
import { applyOps } from './outbox';

describe('applyOps', () => {
  it('replays set / update / remove on a cached tree', () => {
    const root = { users: { u: { tasks: { a: { title: 'A' }, b: { title: 'B' } } } } };
    applyOps(root, [
      { id: '1', kind: 'update', path: 'users/u', value: { 'tasks/c': { title: 'C' }, 'tasks/a/title': 'A2', 'tasks/b': null } },
      { id: '2', kind: 'set', path: 'users/u/settings/theme', value: 'dark' },
      { id: '3', kind: 'remove', path: 'users/u/tasks/c' },
    ]);
    expect(root).toEqual({ users: { u: { tasks: { a: { title: 'A2' } }, settings: { theme: 'dark' } } } });
  });
});
