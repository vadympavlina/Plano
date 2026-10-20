import type { DateKey, Project, ProjectStatus, Task } from '@/types';
import { diffDaysKey, plural } from '@/lib/date';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Активний',
  on_hold: 'На паузі',
  completed: 'Завершений',
  archived: 'В архіві',
};

export interface ProjectProgress {
  total: number;
  done: number;
  percent: number;
  overdue: number;
  nextDeadline?: DateKey;
}

/** Progress is derived from the project's tasks; cancelled tasks are ignored. */
export function projectProgress(project: Project, tasks: Task[], today: DateKey): ProjectProgress {
  const list = tasks.filter((t) => t.projectId === project.id && t.status !== 'cancelled');
  const done = list.filter((t) => t.status === 'completed').length;
  const open = list.filter((t) => t.status !== 'completed');
  const deadlines = open.map((t) => t.dueDate).filter((d): d is DateKey => !!d).sort();
  return {
    total: list.length,
    done,
    percent: list.length ? Math.round((done / list.length) * 100) : 0,
    overdue: deadlines.filter((d) => d < today).length,
    nextDeadline: deadlines.find((d) => d >= today),
  };
}

/** "через 5 днів", "сьогодні", "прострочено на 3 дні". */
export function deadlineHint(target: DateKey, today: DateKey): { text: string; tone: 'danger' | 'warning' | 'muted' } {
  const d = diffDaysKey(target, today);
  if (d < 0) return { text: `прострочено на ${-d} ${plural(-d, ['день', 'дні', 'днів'])}`, tone: 'danger' };
  if (d === 0) return { text: 'сьогодні', tone: 'warning' };
  if (d <= 7) return { text: `через ${d} ${plural(d, ['день', 'дні', 'днів'])}`, tone: 'warning' };
  if (d < 60) return { text: `через ${d} ${plural(d, ['день', 'дні', 'днів'])}`, tone: 'muted' };
  const m = Math.round(d / 30);
  return { text: `через ${m} ${plural(m, ['місяць', 'місяці', 'місяців'])}`, tone: 'muted' };
}
