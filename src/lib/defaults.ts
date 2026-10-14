import type { Category, ColorKey, Settings } from '@/types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  weekStartsOn: 1,
  timeFormat: '24h',
  dateFormat: 'MMM d, yyyy',
  defaultCalendarView: 'week',
  showHabitStreakOnDashboard: true,
};

const STARTER: [string, string, ColorKey][] = [
  ['cat_work', 'Work', 'blue'],
  ['cat_personal', 'Personal', 'purple'],
  ['cat_health', 'Health', 'green'],
  ['cat_study', 'Study', 'orange'],
];

/** Starter categories, written once on first sign-in. Fixed ids keep it idempotent. */
export function starterCategories(now: string): Record<string, Category> {
  return Object.fromEntries(
    STARTER.map(([id, name, color], order) => [id, { id, name, color, order, createdAt: now, updatedAt: now }]),
  );
}
