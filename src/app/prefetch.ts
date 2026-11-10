/**
 * Once the first screen is up and the browser is idle, fetch the chunks of every other page and
 * of the dialogs, so the next tap opens instantly instead of waiting for the network. (The service
 * worker has them precached already; this also warms the module graph.) Skipped on data saver
 * and very slow connections.
 */
export function prefetchChunks() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return;
  const run = () => {
    const loaders = [
      () => import('@/features/dashboard/DashboardPage'),
      () => import('@/features/tasks/TasksPage'),
      () => import('@/features/calendar/CalendarPage'),
      () => import('@/features/notes/NotesPage'),
      () => import('@/features/habits/HabitsPage'),
      () => import('@/features/dashboard/UpcomingPage'),
      () => import('@/features/capture/QuickAddSheet'),
      () => import('@/features/tasks/TaskForm'),
      () => import('@/features/tasks/TaskDetail'),
      () => import('@/features/calendar/EventForm'),
      () => import('@/features/calendar/EventDetail'),
      () => import('@/features/search/SearchCommand'),
      () => import('@/features/projects/ProjectsPage'),
      () => import('@/features/goals/GoalsPage'),
      () => import('@/features/habits/HabitPage'),
      () => import('@/features/projects/ProjectPage'),
      () => import('@/features/settings/SettingsPage'),
    ];
    // One at a time, each in its own idle slot: never competes with what the person is doing.
    const next = () => {
      const load = loaders.shift();
      if (!load) return;
      void load().catch(() => undefined);
      idle(next);
    };
    next();
  };
  idle(run, 1500);
}

function idle(fn: () => void, timeout = 800) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 300);
}
