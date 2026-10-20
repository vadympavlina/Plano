import { useEffect } from 'react';
import { useData } from '@/app/providers/DataProvider';
import { pushEnabledHere, syncReminders } from '@/services/push';
import { buildReminders } from './schedule';

/** Keeps the server's reminder list in step with the data (only on devices with push turned on). */
export function ReminderSync() {
  const { data, ready, backendKind } = useData();
  useEffect(() => {
    if (!ready || backendKind !== 'firebase' || !pushEnabledHere()) return;
    const run = () => void syncReminders(buildReminders(data, new Date())).catch(() => undefined);
    const t = setTimeout(run, 3000);
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data, ready, backendKind]);
  return null;
}
