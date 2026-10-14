import { AlertCircle, CloudOff, Loader2, Check, HardDrive } from 'lucide-react';
import { useSyncState } from '@/services/sync';
import { useData } from '@/app/providers/DataProvider';
import { cn } from '@/lib/utils/cn';

export function useSyncSummary() {
  const sync = useSyncState();
  const { backendKind, error } = useData();
  if (backendKind === 'local')
    return { tone: 'muted', icon: HardDrive, label: 'Saved in this browser', detail: 'Preview mode — not synced' } as const;
  if (error) return { tone: 'danger', icon: AlertCircle, label: 'Sync error', detail: error } as const;
  if (!sync.connected)
    return {
      tone: 'warning',
      icon: CloudOff,
      label: sync.pending ? `Offline · ${sync.pending} pending` : 'Offline',
      detail: sync.pending
        ? 'Changes are kept in memory and will be sent when the connection returns. Keep the app open.'
        : 'Reconnecting… Data shown may be out of date.',
    } as const;
  if (sync.pending) return { tone: 'muted', icon: Loader2, label: 'Saving…', detail: `${sync.pending} change(s) in progress` } as const;
  if (sync.lastError) return { tone: 'danger', icon: AlertCircle, label: 'Last save failed', detail: sync.lastError } as const;
  return { tone: 'success', icon: Check, label: 'All changes synced', detail: 'Connected to Firebase' } as const;
}

export function SyncIndicator({ variant = 'sidebar', collapsed }: { variant?: 'sidebar' | 'header'; collapsed?: boolean }) {
  const s = useSyncSummary();
  const Icon = s.icon;
  const color =
    s.tone === 'success' ? 'text-success' : s.tone === 'warning' ? 'text-warning' : s.tone === 'danger' ? 'text-danger' : '';
  return (
    <div
      role="status"
      title={`${s.label} — ${s.detail}`}
      className={cn(
        'flex items-center gap-2 text-xs',
        variant === 'sidebar' ? 'text-sidebar-muted' : 'text-muted',
        collapsed && 'justify-center',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', color, s.icon === Loader2 && 'animate-spin')} aria-hidden />
      <span className={cn('truncate', collapsed && 'sr-only')}>{s.label}</span>
    </div>
  );
}
