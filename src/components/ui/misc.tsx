import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { tint } from '@/lib/utils/colors';
import { haptic } from '@/lib/utils/haptic';

export function Badge({
  color,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  const style: CSSProperties | undefined = color ? { backgroundColor: tint(color, 0.13), color } : undefined;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-medium',
        !color && 'bg-surface-2 text-muted',
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />;
}

export function Progress({
  value,
  color,
  className,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line/80', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', !color && 'bg-accent')}
        style={{ width: `${v}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function CheckCircle({
  checked,
  onChange,
  label,
  color,
  size = 'md',
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  color?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const dim = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        haptic();
        onChange(!checked);
      }}
      className={cn(
        'group relative flex shrink-0 items-center justify-center rounded-md border-[1.5px] transition-all duration-150 before:absolute before:-inset-2.5 before:content-[""]',
        dim,
        checked ? 'border-transparent bg-accent text-surface' : 'border-subtle/70 bg-surface hover:border-ink',
      )}
      style={checked && color ? { backgroundColor: color } : undefined}
    >
      <Check className={cn('h-3 w-3 stroke-[3] transition-transform', checked ? 'scale-100' : 'scale-0')} />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  ariaLabel,
  stretch,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  /** Buttons share the full width. */
  stretch?: boolean;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('inline-flex items-center gap-0.5 rounded-xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all',
            stretch && 'flex-1',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count != null && (
            <span className={cn('rounded px-1 text-[11px] tabular-nums', value === o.value ? 'bg-surface-2 text-muted' : 'text-subtle')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-muted">
      {children}
    </kbd>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...props} />;
}

