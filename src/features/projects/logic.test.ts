import { describe, expect, it } from 'vitest';
import type { Goal, Project, Task } from '@/types';
import { projectProgress } from './logic';
import { goalPace, goalPercent } from '../goals/logic';

const T0 = '2025-04-01T10:00:00.000Z';
const project: Project = { id: 'p', name: 'EdFlow', color: 'blue', status: 'active', createdAt: T0, updatedAt: T0 };
const t = (id: string, p: Partial<Task>): Task => ({
  id,
  title: id,
  status: 'todo',
  priority: 'medium',
  subtasks: [],
  tags: [],
  projectId: 'p',
  createdAt: T0,
  updatedAt: T0,
  ...p,
});

describe('project progress', () => {
  it('derives progress from linked tasks', () => {
    const tasks = [
      t('1', { status: 'completed' }),
      t('2', { dueDate: '2025-04-20' }),
      t('3', { dueDate: '2025-04-30' }),
      t('4', { status: 'cancelled' }),
      t('5', { projectId: 'other', status: 'completed' }),
    ];
    expect(projectProgress(project, tasks, '2025-04-24')).toEqual({
      total: 3,
      done: 1,
      percent: 33,
      overdue: 1,
      nextDeadline: '2025-04-30',
    });
  });

  it('is zero without tasks', () => {
    expect(projectProgress(project, [], '2025-04-24').percent).toBe(0);
  });
});

describe('goal progress', () => {
  const goal: Goal = {
    id: 'g',
    title: 'Read 12 books',
    targetValue: 12,
    currentValue: 3,
    startDate: '2025-01-01',
    targetDate: '2025-12-31',
    status: 'active',
    projectIds: [],
    history: [],
    createdAt: T0,
    updatedAt: T0,
  };
  it('percent is clamped', () => {
    expect(goalPercent(goal)).toBe(25);
    expect(goalPercent({ ...goal, currentValue: 20 })).toBe(100);
  });
  it('pace compares with linear expectation', () => {
    expect(goalPace(goal, '2025-04-01')).toBe('on_track');
    expect(goalPace(goal, '2025-09-01')).toBe('behind');
    expect(goalPace({ ...goal, currentValue: 12 }, '2025-09-01')).toBe('done');
    expect(goalPace(goal, '2026-01-02')).toBe('overdue');
  });
});
