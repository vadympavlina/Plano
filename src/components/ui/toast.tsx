import { useEffect, useSyncExternalStore } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: ToastKind, message: string, opts: Partial<Omit<ToastItem, 'id' | 'kind' | 'message'>> = {}) {
  const id = ++seq;
  const duration = opts.duration ?? (kind === 'error' ? 8000 : 3500);
  items = [...items.slice(-3), { id, kind, message, duration, ...opts }];
  emit();
  return id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (m: string, o?: Partial<ToastItem>) => push('success', m, o),
  error: (m: string, o?: Partial<ToastItem>) => push('error', m, o),
  info: (m: string, o?: Partial<ToastItem>) => push('info', m, o),
};

function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
  );
}

function ToastView({ t }: { t: ToastItem }) {
  useEffect(() => {
    if (t.duration <= 0) return;
    const timer = setTimeout(() => dismissToast(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);
  const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
  return (
    <div
      role={t.kind === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 pr-2.5 text-sm shadow-pop animate-slide-up sm:w-[360px]"
    >
      <Icon
        className={cn(
          'mt-0.5 h-[18px] w-[18px] shrink-0',
          t.kind === 'success' && 'text-success',
          t.kind === 'error' && 'text-danger',
          t.kind === 'info' && 'text-primary',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{t.message}</p>
        {t.description && <p className="mt-0.5 text-[13px] text-muted">{t.description}</p>}
      </div>
      {t.action && (
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-primary hover:bg-primary/10"
          onClick={() => {
            t.action!.onClick();
            dismissToast(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-ink" onClick={() => dismissToast(t.id)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const list = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:right-6 lg:left-auto lg:items-end"
    >
      {list.map((t) => (
        <ToastView key={t.id} t={t} />
      ))}
    </div>
  );
}
