import { describe, expect, it } from 'vitest';
import type { Task } from '@/types';
import {
  dayProgress,
  filterTasks,
  groupTasks,
  nextRecurringInstance,
  recurringInstanceId,
  sortTasks,
  weekProgress,
} from './logic';

const T0 = '2025-04-01T10:00:00.000Z';
function task(p: Partial<Task> & { id: string }): Task {
  return {
    title: p.id,
    status: 'todo',
    priority: 'medium',
    subtasks: [],
    tags: [],
    createdAt: T0,
    updatedAt: T0,
    ...p,
  };
}

const today = '2025-04-24';
const tasks = [
  task({ id: 'a', dueDate: '2025-04-24' }),
  task({ id: 'b', dueDate: '2025-04-24', status: 'completed', completedAt: T0 }),
  task({ id: 'c', dueDate: '2025-04-20' }),
  task({ id: 'd', dueDate: '2025-04-30', priority: 'urgent' }),
  task({ id: 'e' }),
  task({ id: 'f', dueDate: '2025-04-24', status: 'cancelled' }),
  task({ id: 'g', startDate: '2025-04-24', status: 'in_progress' }),
];
const ids = (list: Task[]) => list.map((t) => t.id).sort();

describe('task filters', () => {
  it('all = open tasks', () => expect(ids(filterTasks(tasks, 'all', today))).toEqual(['a', 'c', 'd', 'e', 'g']));
  it('today', () => expect(ids(filterTasks(tasks, 'today', today))).toEqual(['a', 'g']));
  it('upcoming', () => expect(ids(filterTasks(tasks, 'upcoming', today))).toEqual(['d']));
  it('overdue', () => expect(ids(filterTasks(tasks, 'overdue', today))).toEqual(['c']));
  it('completed includes cancelled', () => expect(ids(filterTasks(tasks, 'completed', today))).toEqual(['b', 'f']));
  it('search', () => {
    const list = [task({ id: 'x', title: 'Buy milk', tags: ['shop'] }), task({ id: 'y', title: 'Gym' })];
    expect(ids(filterTasks(list, 'all', today, 'SHOP'))).toEqual(['x']);
  });
});

describe('sorting and grouping', () => {
  it('sorts by due date with undated last', () => {
    expect(sortTasks(filterTasks(tasks, 'all', today), 'due').map((t) => t.id)).toEqual(['c', 'a', 'g', 'd', 'e']);
  });
  it('sorts by priority', () => {
    expect(sortTasks(filterTasks(tasks, 'all', today), 'priority')[0].id).toBe('d');
  });
  it('groups by category with uncategorised last', () => {
    const groups = groupTasks(
      [task({ id: '1' }), task({ id: '2', categoryId: 'work' }), task({ id: '3', categoryId: 'work' })],
      'category',
    );
    expect(groups.map((g) => [g.key, g.tasks.length])).toEqual([
      ['work', 2],
      ['none', 1],
    ]);
  });
});

describe('progress', () => {
  it('day progress ignores cancelled', () => expect(dayProgress(tasks, today)).toEqual({ total: 3, done: 1 }));
  it('week progress', () => expect(weekProgress(tasks, today, 1)).toEqual({ total: 3, done: 1 }));
});

describe('recurring tasks', () => {
  const base = task({
    id: 'r1',
    dueDate: '2025-01-31',
    recurrence: { freq: 'monthly', interval: 1 },
    subtasks: [{ id: 's', title: 'step', done: true, order: 0 }],
    status: 'completed',
  });

  it('creates the next instance with a deterministic id', () => {
    const next = nextRecurringInstance(base, new Set(), T0)!;
    expect(next.id).toBe(recurringInstanceId('r1', '2025-02-28'));
    expect(next.dueDate).toBe('2025-02-28');
    expect(next.status).toBe('todo');
    expect(next.seriesId).toBe('r1');
    expect(next.seriesStart).toBe('2025-01-31');
    expect(next.subtasks[0].done).toBe(false);
  });

  it('does not drift after a short month', () => {
    const feb = nextRecurringInstance(base, new Set(), T0)!;
    const mar = nextRecurringInstance(feb, new Set(), T0)!;
    expect(mar.dueDate).toBe('2025-03-31');
    expect(mar.id).toBe('r1_20250331');
  });

  it('is idempotent: no duplicate when the instance already exists', () => {
    const first = nextRecurringInstance(base, new Set(), T0)!;
    expect(nextRecurringInstance(base, new Set([first.id]), T0)).toBeNull();
  });

  it('returns null for non-recurring or ended series', () => {
    expect(nextRecurringInstance(task({ id: 'n', dueDate: today }), new Set(), T0)).toBeNull();
    const ended = task({ id: 'e', dueDate: '2025-04-24', recurrence: { freq: 'daily', interval: 1, until: '2025-04-24' } });
    expect(nextRecurringInstance(ended, new Set(), T0)).toBeNull();
  });

  it('keeps the start/due offset', () => {
    const t = task({ id: 'w', startDate: '2025-04-22', dueDate: '2025-04-24', recurrence: { freq: 'weekly', interval: 1 } });
    const next = nextRecurringInstance(t, new Set(), T0)!;
    expect(next.dueDate).toBe('2025-05-01');
    expect(next.startDate).toBe('2025-04-29');
  });
});
