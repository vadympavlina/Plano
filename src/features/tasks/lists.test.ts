import { describe, expect, it } from 'vitest';
import type { Task } from '@/types';
import { boardColumns, listContent, listCounts, listFromParam } from './lists';

const today = '2026-10-15';
const task = (id: string, extra: Partial<Task> = {}): Task =>
  ({ id, title: id, status: 'todo', priority: 'medium', subtasks: [], tags: [], createdAt: '', updatedAt: '', ...extra }) as Task;

const tasks = [
  task('inbox'),
  task('today', { dueDate: today, startTime: '12:00' }),
  task('late', { dueDate: '2026-10-13' }),
  task('soon', { dueDate: '2026-10-20' }),
  task('doing', { dueDate: today, status: 'in_progress' }),
  task('doneToday', { dueDate: today, status: 'completed', completedAt: '2026-10-15T08:00:00Z' }),
  task('doneOld', { dueDate: '2026-09-01', status: 'completed', completedAt: '2026-09-01T08:00:00Z' }),
  task('cancelled', { status: 'cancelled' }),
  task('proj', { dueDate: today, projectId: 'p1', categoryId: 'c1' }),
];

describe('task lists', () => {
  it('maps old filter params', () => {
    expect(listFromParam('overdue')).toBe('today');
    expect(listFromParam('upcoming')).toBe('scheduled');
    expect(listFromParam('completed')).toBe('done');
    expect(listFromParam(null)).toBe('today');
  });

  it('puts overdue and today in Сьогодні, with today’s completed tasks as done', () => {
    const c = listContent(tasks, { list: 'today' }, today);
    expect(c.open.map((t) => t.id)).toEqual(['late', 'today', 'doing', 'proj']);
    expect(c.done.map((t) => t.id)).toEqual(['doneToday']);
  });

  it('inbox holds open tasks without a date', () => {
    expect(listContent(tasks, { list: 'inbox' }, today).open.map((t) => t.id)).toEqual(['inbox']);
  });

  it('filters by project, category and search', () => {
    expect(listContent(tasks, { list: 'all', projectId: 'p1' }, today).open.map((t) => t.id)).toEqual(['proj']);
    expect(listContent(tasks, { list: 'all', categoryId: 'c1' }, today).open.map((t) => t.id)).toEqual(['proj']);
    expect(listContent(tasks, { list: 'all' }, today, 'soo').open.map((t) => t.id)).toEqual(['soon']);
  });

  it('counts open tasks and splits the board by status', () => {
    expect(listCounts(tasks, today)).toEqual({ inbox: 1, today: 4, scheduled: 5, all: 6, done: 0 });
    const b = boardColumns(listContent(tasks, { list: 'today' }, today));
    expect(b.in_progress.map((t) => t.id)).toEqual(['doing']);
    expect(b.completed.map((t) => t.id)).toEqual(['doneToday']);
  });
});
