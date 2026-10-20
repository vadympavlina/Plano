import type { Category, ColorKey, Settings } from '@/types';

export const DEFAULT_SETTINGS: Settings = {
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
};

const STARTER: [string, string, ColorKey, string][] = [
  ['cat_work', 'Робота', 'blue', 'briefcase'],
  ['cat_personal', 'Особисте', 'purple', 'house'],
  ['cat_health', 'Здоров’я', 'green', 'heart-pulse'],
  ['cat_study', 'Навчання', 'orange', 'book-open'],
];

/** Starter categories, written once on first sign-in. Fixed ids keep it idempotent. */
export function starterCategories(now: string): Record<string, Category> {
  return Object.fromEntries(
    STARTER.map(([id, name, color, icon], order) => [id, { id, name, color, icon, order, createdAt: now, updatedAt: now }]),
  );
}
