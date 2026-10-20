import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {/* The Plano duck, with the section's icon as a small badge. */}
      <div className={cn('relative', compact ? 'mb-3' : 'mb-4')}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" aria-hidden className={cn('rounded-[22%] shadow-soft', compact ? 'h-12 w-12' : 'h-16 w-16')} />
        {icon && (
          <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-muted [&_svg]:h-3.5 [&_svg]:w-3.5">
            {icon}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Завантаження…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-16 text-sm text-muted', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = 'Щось пішло не так',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-md text-[13px] text-muted">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Спробувати ще раз
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-line/60', className)} />;
}

/** Grey silhouettes of a page (title + cards) while data or code is loading. */
export function PageSkeleton({ label = 'Завантаження…' }: { label?: string }) {
  const bar = 'rounded-lg bg-line/60 dark:bg-line/40';
  return (
    <div role="status" aria-label={label} className="w-full animate-pulse px-4 pb-8 pt-2 sm:px-6 lg:pt-0">
      <div className={`h-3.5 w-36 ${bar}`} />
      <div className={`mt-2.5 h-8 w-64 max-w-full ${bar}`} />
      <div className={`mt-5 h-14 rounded-[20px] ${bar}`} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr]">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-40 rounded-[20px] ${bar}`} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className={`h-64 rounded-[20px] ${bar}`} />
        <div className={`h-64 rounded-[20px] ${bar}`} />
      </div>
    </div>
  );
}
