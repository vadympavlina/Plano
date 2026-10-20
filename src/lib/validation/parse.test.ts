import { describe, expect, it } from 'vitest';
import { parseCollectionShared, stripUndefined } from './parse';
import { taskSchema } from './schemas';

describe('parseCollectionShared', () => {
  it('normalises Firebase arrays and skips invalid records', () => {
    const raw = {
      a: {
        title: 'A',
        status: 'todo',
        priority: 'low',
        subtasks: { 0: { id: 's1', title: 'x', done: false, order: 0 } },
        createdAt: 't',
        updatedAt: 't',
      },
      b: { title: '', status: 'todo' },
    };
    const invalid: string[] = [];
    const { result } = parseCollectionShared(raw, taskSchema, undefined, (id) => invalid.push(id));
    expect(Object.keys(result)).toEqual(['a']);
    expect(result.a.id).toBe('a');
    expect(result.a.tags).toEqual([]);
    expect(result.a.subtasks).toHaveLength(1);
    expect(invalid).toEqual(['b']);
  });

  it('keeps unchanged records (and the whole map) from the previous parse', () => {
    const t = (title: string) => ({ title, status: 'todo', priority: 'low', createdAt: 't', updatedAt: 't' });
    const first = parseCollectionShared({ a: t('A'), b: t('B') }, taskSchema, undefined);
    expect(parseCollectionShared({ a: t('A'), b: t('B') }, taskSchema, first)).toBe(first);
    const second = parseCollectionShared({ a: t('A'), b: t('B2') }, taskSchema, first);
    expect(second.result.a).toBe(first.result.a);
    expect(second.result.b.title).toBe('B2');
    expect(Object.keys(parseCollectionShared({ a: t('A') }, taskSchema, second).result)).toEqual(['a']);
  });

  it('strips undefined values deeply', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: [1, undefined] } })).toEqual({
      a: 1,
      c: { e: [1] },
    });
  });
});
