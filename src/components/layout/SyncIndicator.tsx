import { AlertCircle, CloudOff, Loader2, Check, HardDrive } from 'lucide-react';
import { useSyncState } from '@/services/sync';
import { useData } from '@/app/providers/DataProvider';
import { cn } from '@/lib/utils/cn';

export function useSyncSummary() {
  const sync = useSyncState();
  const { backendKind, error } = useData();
  if (backendKind === 'local')
    return { tone: 'muted', icon: HardDrive, label: 'Збережено локально', detail: 'Режим перегляду — дані лише в цьому браузері, без синхронізації' } as const;
  if (error) return { tone: 'danger', icon: AlertCircle, label: 'Помилка синхронізації', detail: error } as const;
  if (!sync.connected)
    return {
      tone: 'warning',
      icon: CloudOff,
      label: sync.pending ? `Офлайн · ${sync.pending} в черзі` : 'Офлайн',
      detail: sync.pending
        ? 'Зміни збережено в пам’яті й буде надіслано, коли з’явиться мережа. Не закривайте застосунок.'
        : 'Перепідключення… Дані можуть бути неактуальні.',
    } as const;
  if (sync.pending) return { tone: 'muted', icon: Loader2, label: 'Збереження…', detail: `Змін у процесі: ${sync.pending}` } as const;
  if (sync.lastError) return { tone: 'danger', icon: AlertCircle, label: 'Останнє збереження не вдалося', detail: sync.lastError } as const;
  return { tone: 'success', icon: Check, label: 'Усе синхронізовано', detail: 'Підключено до Firebase' } as const;
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
