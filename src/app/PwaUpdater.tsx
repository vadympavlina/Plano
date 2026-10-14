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
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const update = registerSW({
        onNeedRefresh() {
          toast.info('A new version of Plano is available', {
            duration: 0,
            action: { label: 'Update', onClick: () => void update(true) },
          });
        },
        onOfflineReady() {
          toast.success('Plano is ready to open offline');
        },
        onRegisteredSW(_url, registration) {
          // Check for updates when the app returns to the foreground (e.g. iOS standalone).
          if (!registration) return;
          const check = () => document.visibilityState === 'visible' && void registration.update().catch(() => undefined);
          document.addEventListener('visibilitychange', check);
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
