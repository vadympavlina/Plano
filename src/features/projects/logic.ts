import type { DateKey, Project, ProjectStatus, Task } from '@/types';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
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
