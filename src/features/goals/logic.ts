import { diffDaysKey } from '@/lib/date';
import type { DateKey, Goal, GoalStatus } from '@/types';

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Активна',
  completed: 'Досягнута',
  paused: 'На паузі',
  abandoned: 'Відкладена',
};

export function goalPercent(goal: Goal): number {
  if (goal.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)));
}

export type Pace = 'done' | 'ahead' | 'on_track' | 'behind' | 'overdue' | 'no_deadline';

/** Compares actual progress with linear expected progress between start and target date. */
export function goalPace(goal: Goal, today: DateKey): Pace {
  if (goal.currentValue >= goal.targetValue) return 'done';
  if (!goal.targetDate) return 'no_deadline';
  if (today > goal.targetDate) return 'overdue';
  const start = goal.startDate ?? goal.createdAt.slice(0, 10);
  const total = diffDaysKey(goal.targetDate, start);
  if (total <= 0) return 'on_track';
  const elapsed = Math.max(0, diffDaysKey(today, start));
  const expected = (elapsed / total) * goal.targetValue;
  if (goal.currentValue >= expected * 1.1) return 'ahead';
  if (goal.currentValue >= expected * 0.9) return 'on_track';
  return 'behind';
}

export const PACE_LABEL: Record<Pace, string> = {
  done: 'Досягнуто',
  ahead: 'Випереджаєте',
  on_track: 'За планом',
  behind: 'Відстаєте',
  overdue: 'Термін минув',
  no_deadline: 'Без дедлайну',
};
