import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as PP from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Colour swatch shown before the label. */
  color?: string;
  hint?: string;
}

export type ControlVariant = 'field' | 'chip' | 'ghost';

/** Shared trigger styles for custom controls (select, date, time). */
export function triggerClass(variant: ControlVariant, opts: { invalid?: boolean; empty?: boolean } = {}) {
  return cn(
    'group inline-flex min-w-0 items-center gap-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
    variant === 'field' &&
      'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm hover:border-subtle/60 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/15',
    variant === 'chip' &&
      'h-8 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium hover:bg-surface-2 data-[state=open]:bg-surface-2',
    variant === 'ghost' && 'h-8 rounded-lg px-2 text-[13px] font-medium hover:bg-surface-2 data-[state=open]:bg-surface-2',
    opts.empty ? 'text-subtle' : 'text-ink',
    opts.invalid && 'border-danger ring-2 ring-danger/15',
  );
}

export const popoverPanel =
  'z-50 rounded-2xl border border-line bg-surface p-1.5 text-sm text-ink shadow-pop outline-none data-[state=open]:animate-scale-in';

interface SelectProps<T extends string> {
  value: T | undefined;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  variant?: ControlVariant;
  className?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  id?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  /** Icon shown in the trigger when nothing is selected (chip variant). */
  icon?: ReactNode;
  disabled?: boolean;
}

/** Accessible custom select: a popover listbox with keyboard and type-ahead navigation. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Обрати',
  variant = 'field',
  className,
  contentClassName,
  align = 'start',
  icon,
  disabled,
  ...aria
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const selected = options.find((o) => o.value === value);

  const items = () => Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
  const focusAt = (i: number) => {
    const list = items();
    if (!list.length) return;
    list[(i + list.length) % list.length].focus();
  };

  const onListKey = (e: KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusAt(i + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(list.length - 1);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (match >= 0) focusAt(match);
    }
  };

  return (
    <PP.Root open={open} onOpenChange={setOpen}>
      <PP.Trigger
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(triggerClass(variant, { invalid: aria['aria-invalid'], empty: !selected }), className)}
        {...aria}
      >
        {selected?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
        {(selected?.icon ?? (!selected ? icon : null)) && (
          <span className="flex shrink-0 text-muted [&_svg]:h-4 [&_svg]:w-4">{selected?.icon ?? icon}</span>
        )}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
        {variant === 'field' && (
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        )}
      </PP.Trigger>
      <PP.Portal>
        <PP.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const idx = Math.max(0, options.findIndex((o) => o.value === value));
            requestAnimationFrame(() => focusAt(idx));
          }}
          className={cn(popoverPanel, 'min-w-[var(--radix-popover-trigger-width)] max-w-[min(340px,calc(100vw-24px))]', contentClassName)}
        >
          <div
            ref={listRef}
            role="listbox"
            aria-label={aria['aria-label']}
            onKeyDown={onListKey}
            className="scrollbar-thin max-h-[min(320px,50dvh)] overflow-y-auto"
          >
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2',
                    isSel && 'font-semibold',
                  )}
                >
                  {o.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />}
                  {o.icon && <span className="flex shrink-0 text-muted [&_svg]:h-4 [&_svg]:w-4">{o.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs font-normal text-muted">{o.hint}</span>}
                  </span>
                  <Check className={cn('h-4 w-4 shrink-0 text-primary', !isSel && 'invisible')} aria-hidden />
                </button>
              );
            })}
          </div>
        </PP.Content>
      </PP.Portal>
    </PP.Root>
  );
}
