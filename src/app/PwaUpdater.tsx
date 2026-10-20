import { useEffect } from 'react';
import { toast } from '@/components/ui/toast';

/**
 * Registers the service worker (production only) and asks before activating a
 * new version, so an update never interrupts unsaved work.
 */
export function PwaUpdater() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    let stop = () => {};
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const update = registerSW({
        onNeedRefresh() {
          toast.info('Доступна нова версія Plano', {
            duration: 0,
            action: { label: 'Оновити', onClick: () => void update(true) },
          });
        },
        onRegisteredSW(_url, registration) {
          // Check for updates when the app returns to the foreground (e.g. iOS standalone).
          if (!registration || cancelled) return;
          // …and hourly while it stays open.
          const check = () => document.visibilityState === 'visible' && void registration.update().catch(() => undefined);
          const timer = setInterval(check, 60 * 60_000);
          document.addEventListener('visibilitychange', check);
          stop = () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', check);
          };
        },
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
  return null;
}
