import type { ReactNode } from 'react';
import { Ban, CheckCircle2, Circle, CircleDot } from 'lucide-react';
import type { SelectOption } from '@/components/ui/select';
import { colorOf } from '@/lib/utils/colors';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/features/tasks/logic';
import { PRIORITIES, TASK_STATUSES, type Category, type Priority, type Project, type ProjectStatus, type TaskStatus } from '@/types';
import { PROJECT_STATUS_LABEL } from '@/features/projects/logic';

export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: '#E5484D',
  high: '#E8628F',
  medium: '#F0A54A',
  low: '#35B98A',
};

export const priorityOptions: SelectOption<Priority>[] = [...PRIORITIES]
  .reverse()
  .map((p) => ({ value: p, label: PRIORITY_LABEL[p], color: PRIORITY_COLOR[p] }));

const STATUS_ICON: Record<TaskStatus, ReactNode> = {
  todo: <Circle />,
  in_progress: <CircleDot />,
  completed: <CheckCircle2 />,
  cancelled: <Ban />,
};

export const statusOptions: SelectOption<TaskStatus>[] = TASK_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
  icon: STATUS_ICON[s],
}));

/** "" means none. */
export function categoryOptions(categories: Category[], noneLabel = 'Без категорії'): SelectOption<string>[] {
  return [{ value: '', label: noneLabel, color: '#C3C8D3' }, ...categories.map((c) => ({ value: c.id, label: c.icon ? `${c.icon} ${c.name}` : c.name, color: colorOf(c.color) }))];
}

export function projectOptions(projects: Project[], current?: string, noneLabel = 'Без проєкту'): SelectOption<string>[] {
  return [
    { value: '', label: noneLabel, color: '#C3C8D3' },
    ...projects
      .filter((p) => p.status !== 'archived' || p.id === current)
      .map((p) => ({ value: p.id, label: p.name, color: colorOf(p.color) })),
  ];
}

export const projectStatusOptions: SelectOption<ProjectStatus>[] = [
  { value: 'active', label: PROJECT_STATUS_LABEL.active, color: '#35B98A' },
  { value: 'on_hold', label: PROJECT_STATUS_LABEL.on_hold, color: '#F0A54A' },
  { value: 'completed', label: PROJECT_STATUS_LABEL.completed, color: '#4778F5' },
  { value: 'archived', label: PROJECT_STATUS_LABEL.archived, color: '#9AA2B2' },
];
