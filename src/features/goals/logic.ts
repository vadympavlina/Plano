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

/** Where the goal should be today on a straight line from start to deadline; undefined without a deadline. */
export function expectedValue(goal: Goal, today: DateKey): number | undefined {
  if (!goal.targetDate) return undefined;
  const start = goal.startDate ?? goal.createdAt.slice(0, 10);
  const total = diffDaysKey(goal.targetDate, start);
  if (total <= 0) return goal.targetValue;
  const elapsed = Math.min(total, Math.max(0, diffDaysKey(today, start)));
  return (elapsed / total) * goal.targetValue;
}

const roundNice = (n: number) => (Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const num = (n: number) => roundNice(n).toLocaleString('uk-UA');

/** Human pace line: "Випереджаєте на 2 книжки", "Відстаєте на 46 км", "Потрібно ~3 км на день"… */
export function paceText(goal: Goal, today: DateKey): string {
  const pace = goalPace(goal, today);
  const unit = goal.unit ? ` ${goal.unit}` : '';
  if (pace === 'done') return 'Ціль досягнуто 🎉';
  if (pace === 'no_deadline') return 'Без дедлайну';
  if (pace === 'overdue') return 'Термін минув';
  const expected = expectedValue(goal, today) ?? 0;
  const delta = goal.currentValue - expected;
  const left = diffDaysKey(goal.targetDate!, today);
  if (pace === 'behind' && left > 0 && left <= 30) return `Потрібно ~${num((goal.targetValue - goal.currentValue) / left)}${unit} на день`;
  if (pace === 'on_track' || roundNice(Math.abs(delta)) === 0) return 'За планом';
  return delta > 0 ? `Випереджаєте на ${num(delta)}${unit}` : `Відстаєте на ${num(-delta)}${unit}`;
}
