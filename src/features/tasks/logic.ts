import { nextOccurrence } from '@/lib/date/recurrence';
import { addDaysKey, weekRange } from '@/lib/date';
import type { DateKey, Priority, Task, TaskStatus } from '@/types';

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';
export type TaskSort = 'due' | 'priority' | 'created' | 'title';
export type TaskGrouping = 'category' | 'project' | 'none';

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function isOpen(task: Task): boolean {
  return task.status === 'todo' || task.status === 'in_progress';
}

export function isOverdue(task: Task, today: DateKey): boolean {
  return isOpen(task) && !!task.dueDate && task.dueDate < today;
}

/** The date a task is planned for: its due date, or its start date. */
export function taskDate(task: Task): DateKey | undefined {
  return task.dueDate ?? task.startDate;
}

export function matchesFilter(task: Task, filter: TaskFilter, today: DateKey): boolean {
  switch (filter) {
    case 'all':
      return isOpen(task);
    case 'today':
      return isOpen(task) && taskDate(task) === today;
    case 'upcoming': {
      const d = taskDate(task);
      return isOpen(task) && !!d && d > today;
    }
    case 'overdue':
      return isOverdue(task, today);
    case 'completed':
      return task.status === 'completed' || task.status === 'cancelled';
  }
}

export function matchesSearch(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    task.title.toLowerCase().includes(q) ||
    (task.description ?? '').toLowerCase().includes(q) ||
    (task.notes ?? '').toLowerCase().includes(q) ||
    task.tags.some((t) => t.toLowerCase().includes(q)) ||
    task.subtasks.some((s) => s.title.toLowerCase().includes(q))
  );
}

export function filterTasks(tasks: Task[], filter: TaskFilter, today: DateKey, query = ''): Task[] {
  return tasks.filter((t) => matchesFilter(t, filter, today) && matchesSearch(t, query));
}

export function compareTasks(sort: TaskSort) {
  return (a: Task, b: Task): number => {
    switch (sort) {
      case 'due': {
        const da = taskDate(a) ?? '9999-12-31';
        const db = taskDate(b) ?? '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        const ta = a.startTime ?? '99:99';
        const tb = b.startTime ?? '99:99';
        if (ta !== tb) return ta < tb ? -1 : 1;
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      }
      case 'priority': {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (p !== 0) return p;
        return (taskDate(a) ?? '9999') < (taskDate(b) ?? '9999') ? -1 : 1;
      }
      case 'created':
        return a.createdAt < b.createdAt ? 1 : -1;
      case 'title':
        return a.title.localeCompare(b.title);
    }
  };
}

export function sortTasks(tasks: Task[], sort: TaskSort, filter?: TaskFilter): Task[] {
  if (filter === 'completed') {
    return [...tasks].sort((a, b) => ((a.completedAt ?? a.updatedAt) < (b.completedAt ?? b.updatedAt) ? 1 : -1));
  }
  return [...tasks].sort(compareTasks(sort));
}

export interface TaskGroup {
  key: string;
  tasks: Task[];
}

export function groupTasks(tasks: Task[], grouping: TaskGrouping): TaskGroup[] {
  if (grouping === 'none') return [{ key: 'all', tasks }];
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = (grouping === 'category' ? t.categoryId : t.projectId) ?? 'none';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const groups = [...map.entries()].map(([key, list]) => ({ key, tasks: list }));
  // "none" goes last.
  return groups.sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : 0));
}

export interface TaskCounts {
  total: number;
  done: number;
}

/** Tasks planned for a day (excluding cancelled). */
export function dayProgress(tasks: Task[], day: DateKey): TaskCounts {
  const list = tasks.filter((t) => taskDate(t) === day && t.status !== 'cancelled');
  return { total: list.length, done: list.filter((t) => t.status === 'completed').length };
}

export function weekProgress(tasks: Task[], today: DateKey, weekStartsOn: 0 | 1): TaskCounts {
  const { start, end } = weekRange(today, weekStartsOn);
  const list = tasks.filter((t) => {
    const d = taskDate(t);
    return !!d && d >= start && d <= end && t.status !== 'cancelled';
  });
  return { total: list.length, done: list.filter((t) => t.status === 'completed').length };
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

/** Deterministic id of the instance of a recurring task on a given date. */
export function recurringInstanceId(seriesId: string, date: DateKey): string {
  return `${seriesId}_${date.replace(/-/g, '')}`;
}

/**
 * When a recurring task is completed, returns the next instance to create.
 * The id is derived from the series and the date, so calling this twice for
 * the same task yields the same record — creating it is idempotent.
 */
export function nextRecurringInstance(task: Task, existingIds: Set<string>, now: string): Task | null {
  if (!task.recurrence) return null;
  const anchor = taskDate(task);
  if (!anchor) return null;
  const seriesId = task.seriesId ?? task.id;
  // Occurrences are always computed from the first date of the series, so
  // monthly rules on the 31st do not drift after a short month.
  const seriesStart = task.seriesStart ?? anchor;
  const next = nextOccurrence(task.recurrence, seriesStart, anchor);
  if (!next) return null;
  const id = recurringInstanceId(seriesId, next);
  if (existingIds.has(id)) return null;
  const offset = (d?: DateKey) => (d ? addDaysKey(next, diff(d, anchor)) : undefined);
  return {
    ...task,
    id,
    seriesId,
    seriesStart,
    status: 'todo',
    dueDate: task.dueDate ? offset(task.dueDate) : undefined,
    startDate: task.startDate ? offset(task.startDate) : undefined,
    subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
    completedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function diff(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** Patch to apply when toggling a task's completion. */
export function completionPatch(task: Task, done: boolean, now: string): Partial<Task> {
  return done ? { status: 'completed', completedAt: now } : { status: 'todo', completedAt: undefined };
}
