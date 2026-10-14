import { useEffect, useState } from 'react';
import { todayKey } from '@/lib/date';

/** Current time, refreshed every `intervalMs` and when the app returns from the background. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}

/** Today's date key; changes at midnight. */
export function useToday(): string {
  return todayKey(useNow(60_000));
}
