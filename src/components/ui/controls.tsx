import type { ReactNode } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Square checkbox for lists and forms (round CheckCircle is reserved for tasks). */
export function Checkbox({
  checked,
  onChange,
  label,
  children,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2.5 text-sm', disabled && 'pointer-events-none opacity-50', className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={children ? undefined : label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors',
          checked ? 'border-accent bg-accent text-surface' : 'border-subtle/70 bg-surface hover:border-ink',
        )}
      >
        <Check className={cn('h-3 w-3 stroke-[3] transition-transform', checked ? 'scale-100' : 'scale-0')} />
      </button>
      {children}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center justify-between gap-4', className)}>
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

/** Numeric field with − / + buttons. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 1_000_000,
  step = 1,
  id,
  className,
  'aria-label': ariaLabel,
  'aria-invalid': invalid,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div
      className={cn(
        'flex h-10 items-center rounded-xl border border-line bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15',
        invalid && 'border-danger',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Зменшити"
        onClick={() => onChange(clamp(Number((value - step).toFixed(4))))}
        disabled={value <= min}
        className="flex h-full w-9 shrink-0 items-center justify-center rounded-l-xl text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        id={id}
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.');
          if (raw === '') return onChange(min);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        className="h-full w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
      />
      {suffix && <span className="shrink-0 pr-1 text-xs text-muted">{suffix}</span>}
      <button
        type="button"
        aria-label="Збільшити"
        onClick={() => onChange(clamp(Number((value + step).toFixed(4))))}
        disabled={value >= max}
        className="flex h-full w-9 shrink-0 items-center justify-center rounded-r-xl text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Single-choice row of chips (priority, status, type…). */
export function ChipGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; color?: string; icon?: ReactNode }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5',
              on ? 'border-accent bg-accent text-surface' : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {o.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
