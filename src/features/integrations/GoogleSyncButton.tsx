import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toast';
import { GoogleAuthError } from '@/services/integrations/google/auth';
import { useGoogleSync } from './GoogleSyncProvider';

/** Compact Google Calendar status/sync control for the calendar toolbar. */
export function GoogleSyncButton() {
  const g = useGoogleSync();
  const [authBusy, setAuthBusy] = useState(false);
  if (g.phase === 'off' || g.phase === 'unavailable') return null;

  if (g.phase === 'needs_auth') {
    return (
      <button
        type="button"
        disabled={authBusy}
        onClick={async () => {
          setAuthBusy(true);
          try {
            await g.reauthorize();
          } catch (e) {
            if (!(e instanceof GoogleAuthError && e.code === 'popup_closed')) toast.error((e as Error).message);
          } finally {
            setAuthBusy(false);
          }
        }}
        aria-label="Увійти в Google, щоб продовжити синхронізацію"
        className="relative inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-lg bg-warning/15 text-[12.5px] font-medium text-ink hover:bg-warning/25 sm:w-auto sm:px-2.5"
        title="Доступ до Google Calendar закінчився"
      >
        <span className="hidden h-1.5 w-1.5 rounded-full bg-warning sm:block" />
        <span className="hidden sm:inline">Увійти в Google</span>
        <RefreshCw className="h-4 w-4 text-muted sm:hidden" />
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning sm:hidden" />
      </button>
    );
  }

  const syncing = g.phase === 'syncing';
  return (
    <button
      type="button"
      onClick={() => void g.syncNow()}
      disabled={syncing}
      aria-label="Синхронізувати з Google Calendar"
      title={g.error ?? 'Синхронізувати з Google Calendar'}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink',
        g.phase === 'error' && 'text-danger',
      )}
    >
      <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
    </button>
  );
}
