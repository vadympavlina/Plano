import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Shown when the browser reports no network at all. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-medium text-surface shadow-pop">
      <WifiOff className="h-3.5 w-3.5" />
      You’re offline — showing the cached app. Changes sync when you reconnect.
    </div>
  );
}
