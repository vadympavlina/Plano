import { describe, expect, it } from 'vitest';
import { buildExport, validateImport } from './dataTransfer';
import type { UserData } from '@/types';

const T0 = '2025-04-01T10:00:00.000Z';
const data: UserData = {
  profile: { displayName: 'Vadym' },
  settings: {
    theme: 'light',
    weekStartsOn: 1,
    timeFormat: '24h',
    dateFormat: 'd MMM yyyy',
    defaultCalendarView: 'week',
    showHabitStreakOnDashboard: true,
    remindEventsMin: 15,
    remindTasks: true,
    habitsReminderAt: '21:00',
    digestAt: '08:00',
    eveningAt: '21:00',
    accent: 'blue',
  },
  categories: { work: { id: 'work', name: 'Work', color: 'blue', order: 0, createdAt: T0, updatedAt: T0 } },
  tasks: {
    t1: {
      id: 't1',
      title: 'Task',
      status: 'todo',
      priority: 'high',
      subtasks: [],
      tags: [],
      dueDate: '2025-04-24',
      createdAt: T0,
      updatedAt: T0,
    },
  },
  events: {},
  projects: {},
  habits: {},
  habitLogs: {},
  goals: {},
  notes: {},
  integrations: {},
};

describe('import / export', () => {
  it('round-trips an export', () => {
    const text = JSON.stringify(buildExport(data));
    const result = validateImport(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.tasks).toBe(1);
      expect(result.file.data.tasks.t1.title).toBe('Task');
    }
  });

  it('rejects invalid JSON', () => {
    expect(validateImport('{nope').ok).toBe(false);
  });

  it('rejects arbitrary JSON', () => {
    expect(validateImport(JSON.stringify({ hello: 'world' })).ok).toBe(false);
  });

  it('rejects wrong types and unknown sections', () => {
    const bad = buildExport(data) as unknown as { data: Record<string, unknown> };
    (bad.data.tasks as Record<string, unknown>).t1 = { ...data.tasks.t1, priority: 'whenever' };
    expect(validateImport(JSON.stringify(bad)).ok).toBe(false);

    const extra = buildExport(data) as unknown as { data: Record<string, unknown> };
    extra.data.secrets = {};
    expect(validateImport(JSON.stringify(extra)).ok).toBe(false);
  });

  it('rejects records whose key differs from the id', () => {
    const bad = buildExport(data) as unknown as { data: { tasks: Record<string, unknown> } };
    bad.data.tasks = { other: data.tasks.t1 };
    expect(validateImport(JSON.stringify(bad)).ok).toBe(false);
  });
});
