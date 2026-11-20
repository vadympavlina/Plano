import { useEffect } from 'react';
import { useData } from '@/app/providers/DataProvider';
import { syncPower, syncReminders } from '@/services/push';
import { backupIfDue } from '@/services/backup';
import { usesTokenServer } from '@/services/integrations/google/server';
import { buildReminders } from './schedule';

/** Keeps the server's reminder list in step with the data — from any device, so an event added on the PC reaches the phone. */
export function ReminderSync() {
  const { data, ready, backendKind } = useData();
  useEffect(() => {
    if (!ready || backendKind !== 'firebase' || !usesTokenServer) return;
    const run = () => {
      void syncReminders(buildReminders(data, new Date())).catch(() => undefined);
      const st = data.settings;
      void syncPower(st.powerOn && st.powerQueue && st.powerLeadMin > 0 ? { queue: st.powerQueue, leadMin: st.powerLeadMin } : null).catch(() => undefined);
      backupIfDue(data);
    };
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
