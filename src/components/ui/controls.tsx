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
        'flex h-10 items-center rounded-xl border border-line bg-surface focus-within:border-ink/25 focus-within:ring-2 focus-within:ring-ink/10',
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
      <input autoComplete="off"
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


/** On/off switch (settings, "all day"). */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[""] disabled:opacity-50',
        checked ? 'bg-success' : 'bg-line',
        className,
      )}
    >
      <span className={cn('absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200', checked && 'translate-x-[18px]')} />
    </button>
  );
}
