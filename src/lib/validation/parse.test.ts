import { describe, expect, it } from 'vitest';
import { parseCollection, stripUndefined } from './parse';
import { taskSchema } from './schemas';

describe('parseCollection', () => {
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
    const result = parseCollection(raw, taskSchema, (id) => invalid.push(id));
    expect(Object.keys(result)).toEqual(['a']);
    expect(result.a.id).toBe('a');
    expect(result.a.tags).toEqual([]);
    expect(result.a.subtasks).toHaveLength(1);
    expect(invalid).toEqual(['b']);
  });

  it('strips undefined values deeply', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: [1, undefined] } })).toEqual({
      a: 1,
      c: { e: [1] },
    });
  });
});
