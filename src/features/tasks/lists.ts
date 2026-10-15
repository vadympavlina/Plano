import { addDaysKey } from '@/lib/date';
import type { DateKey, Task, TaskStatus } from '@/types';
import { compareTasks, isOpen, matchesSearch, taskDate } from './logic';

export type TaskListId = 'inbox' | 'today' | 'scheduled' | 'all' | 'done';

export interface TaskScope {
  list: TaskListId;
  projectId?: string;
  categoryId?: string;
}

export type BoardColumn = Extract<TaskStatus, 'todo' | 'in_progress' | 'completed'>;
export const BOARD_COLUMNS: BoardColumn[] = ['todo', 'in_progress', 'completed'];

/** Old `?filter=` links (dashboard, bookmarks) mapped onto the new lists. */
export function listFromParam(value: string | null): TaskListId {
  switch (value) {
    case 'inbox':
    case 'today':
    case 'scheduled':
    case 'all':
    case 'done':
      return value;
    case 'overdue':
      return 'today';
    case 'upcoming':
      return 'scheduled';
    case 'completed':
      return 'done';
    default:
      return 'today';
  }
}

const completedOn = (t: Task): DateKey | undefined => t.completedAt?.slice(0, 10);

/** Open tasks that belong to a list. */
export function openInList(t: Task, list: TaskListId, today: DateKey): boolean {
  if (!isOpen(t)) return false;
  const d = taskDate(t);
  switch (list) {
    case 'inbox':
      return !d;
    case 'today':
      return !!d && d <= today;
    case 'scheduled':
      return !!d;
    case 'all':
      return true;
    case 'done':
      return false;
  }
}

/** Finished tasks shown alongside a list: today's for "Сьогодні", the last week's for the others. */
export function doneInList(t: Task, list: TaskListId, today: DateKey): boolean {
  if (t.status !== 'completed') return false;
  const c = completedOn(t) ?? taskDate(t);
  if (list === 'done') return true;
  if (list === 'today') return c === today || taskDate(t) === today;
  return !!c && c >= addDaysKey(today, -7);
}

function inScope(t: Task, scope: TaskScope): boolean {
  if (scope.projectId && t.projectId !== scope.projectId) return false;
  if (scope.categoryId && (scope.categoryId === 'none' ? !!t.categoryId : t.categoryId !== scope.categoryId)) return false;
  return true;
}

export interface ListContent {
  open: Task[];
  done: Task[];
}

export function listContent(tasks: Task[], scope: TaskScope, today: DateKey, query = ''): ListContent {
  const open: Task[] = [];
  const done: Task[] = [];
  for (const t of tasks) {
    if (!inScope(t, scope) || !matchesSearch(t, query)) continue;
    if (openInList(t, scope.list, today)) open.push(t);
    else if (doneInList(t, scope.list, today)) done.push(t);
  }
  open.sort(compareTasks('due'));
  done.sort((a, b) => ((a.completedAt ?? a.updatedAt) < (b.completedAt ?? b.updatedAt) ? 1 : -1));
  return { open, done };
}

/** Number of open tasks per list, for the sidebar. */
export function listCounts(tasks: Task[], today: DateKey): Record<TaskListId, number> {
  const out: Record<TaskListId, number> = { inbox: 0, today: 0, scheduled: 0, all: 0, done: 0 };
  for (const t of tasks) {
    for (const l of ['inbox', 'today', 'scheduled', 'all'] as const) if (openInList(t, l, today)) out[l]++;
  }
  return out;
}

export function boardColumns(content: ListContent): Record<BoardColumn, Task[]> {
  return {
    todo: content.open.filter((t) => t.status === 'todo'),
    in_progress: content.open.filter((t) => t.status === 'in_progress'),
    completed: content.done,
  };
}
