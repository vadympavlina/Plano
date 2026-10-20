import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '@/app/providers/DataProvider';
import { useActions } from '@/hooks/useActions';
import { toast } from '@/components/ui/toast';
import { todayKey } from '@/lib/date';
import { habitValue } from '@/features/habits/logic';

/** «Виконано» from a notification: sent by the service worker, or as ?done= when it had to open the app. */
export function NotificationActions() {
  const { data, ready } = useData();
  const actions = useActions();
  const [params, setParams] = useSearchParams();
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    const tag = params.get('done');
    if (!tag) return;
    setPending((p) => [...p, tag]);
    params.delete('done');
    setParams(params, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => e.data?.type === 'plano:done' && setPending((p) => [...p, String(e.data.tag)]);
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!ready || !pending.length) return;
    setPending([]);
    for (const tag of pending) {
      const [kind, id, day = todayKey()] = tag.split(':');
      const task = kind === 'task' ? data.tasks[id] : undefined;
      const habit = kind === 'habit' ? data.habits[id] : undefined;
      if (task && task.status !== 'completed') {
        void actions.tasks.setDone(task, true).then(() => toast.success(`«${task.title}» виконано`), () => undefined);
      } else if (habit) {
        const v = habitValue(data.habitLogs, habit.id, day);
        const next = habit.goalType === 'check' ? 1 : v + 1;
        void actions.habits.setValue(habit.id, day, next).then(
          () => toast.success(habit.goalType === 'check' ? `${habit.icon} ${habit.name} — відмічено` : `${habit.icon} ${habit.name}: ${next} з ${habit.target}`),
          () => undefined,
        );
      }
    }
  }, [ready, pending, data, actions]);
  return null;
}
