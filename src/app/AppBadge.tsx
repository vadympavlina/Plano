import { useEffect } from 'react';
import { useCollections } from '@/hooks/useCollections';
import { todayKey } from '@/lib/date';
import { taskDate } from '@/features/tasks/logic';

/** The number on the app icon: open tasks that are due today or already late. */
export function AppBadge() {
  const { tasks } = useCollections();
  const today = todayKey();
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    let n = 0;
    for (const t of tasks) {
      if (t.status === 'completed' || t.status === 'cancelled') continue;
      const d = taskDate(t);
      if (d && d <= today) n++;
    }
    void (n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge?.())?.catch?.(() => undefined);
  }, [tasks, today]);
  return null;
}
