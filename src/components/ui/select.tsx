import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Picker, PickerContent, PickerTrigger, useIsPhone } from './picker';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Colour swatch shown before the label. */
  color?: string;
  hint?: string;
}

/** `row`: a full-width line of a phone form: icon and label on the left, the value and a chevron on the right. */
export type ControlVariant = 'field' | 'chip' | 'ghost' | 'row';

/** Shared trigger styles for custom controls (select, date, time). */
export function triggerClass(variant: ControlVariant, opts: { invalid?: boolean; empty?: boolean } = {}) {
  return cn(
    'group inline-flex min-w-0 items-center gap-2 text-left outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ink/30 disabled:pointer-events-none disabled:opacity-50',
    variant === 'field' &&
      'h-10 w-full rounded-[14px] bg-surface-2 px-3.5 text-sm hover:bg-line/50 data-[state=open]:bg-surface data-[state=open]:ring-2 data-[state=open]:ring-ink/15',
    variant === 'chip' && 'h-8 rounded-full bg-surface-2 px-3 text-[13px] font-medium hover:bg-line/70 data-[state=open]:bg-line/70',
    variant === 'ghost' && 'h-8 rounded-full px-2.5 text-[13px] font-medium hover:bg-surface-2 data-[state=open]:bg-surface-2',
    variant === 'row' && 'min-h-[52px] w-full gap-3 px-4 py-2 text-[15px] hover:bg-line/30 data-[state=open]:bg-line/30 focus-visible:ring-inset',
    opts.empty ? 'text-subtle' : 'text-ink',
    opts.invalid && 'ring-2 ring-danger/40',
  );
}

/** What a `row` trigger shows: icon, label, the value (grey), a chevron. */
export function RowFace({
  icon,
  label,
  value,
  empty,
  chevron = true,
}: {
  icon?: ReactNode;
  label: string;
  value?: ReactNode;
  empty?: boolean;
  chevron?: boolean;
}) {
  return (
    <>
      {icon && <span className="flex shrink-0 text-muted [&_svg]:h-[19px] [&_svg]:w-[19px]">{icon}</span>}
      <span className="min-w-0 shrink-0 text-ink">{label}</span>
      <span className={cn('min-w-0 flex-1 truncate text-right', empty ? 'text-subtle' : 'text-muted')}>{value}</span>
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />}
    </>
  );
}

export const popoverPanel =
  'z-50 rounded-[20px] border border-line bg-surface p-1.5 text-sm text-ink shadow-pop outline-hidden origin-(--radix-select-content-transform-origin) data-[state=open]:animate-scale-in data-[state=closed]:animate-pop-out';

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
  /** Row variant: the line's title («Категорія»); the chosen option is its value. */
  label?: string;
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
  label,
  disabled,
  ...aria
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const phone = useIsPhone();
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
    <Picker open={open} onOpenChange={setOpen}>
      <PickerTrigger
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(triggerClass(variant, { invalid: aria['aria-invalid'], empty: !selected }), className)}
        {...aria}
      >
        {variant === 'row' ? (
          <RowFace
            icon={icon}
            label={label ?? placeholder}
            empty={!selected}
            value={
              <span className="inline-flex max-w-full items-center justify-end gap-2">
                {selected?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
                <span className="truncate">{selected?.label ?? 'Не вибрано'}</span>
              </span>
            }
          />
        ) : (
          <>
            {selected?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
            {(selected?.icon ?? (!selected ? icon : null)) && (
              <span className="flex shrink-0 text-muted [&_svg]:h-4 [&_svg]:w-4">{selected?.icon ?? icon}</span>
            )}
            <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
            {variant !== 'ghost' && (
              <ChevronDown
                className={cn('shrink-0 text-subtle transition-transform group-data-[state=open]:rotate-180', variant === 'chip' ? 'h-3.5 w-3.5' : 'h-4 w-4')}
                aria-hidden
              />
            )}
          </>
        )}
      </PickerTrigger>
      <PickerContent
        title={label ?? aria['aria-label'] ?? placeholder}
        align={align}
        className={cn(popoverPanel, 'min-w-(--radix-popover-trigger-width) max-w-[min(340px,calc(100vw-24px))]', contentClassName)}
        onPopoverOpenAutoFocus={(e) => {
          e.preventDefault();
          const idx = Math.max(
            0,
            options.findIndex((o) => o.value === value),
          );
          requestAnimationFrame(() => focusAt(idx));
        }}
      >
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={aria['aria-label'] ?? label}
          onKeyDown={onListKey}
          className={cn('scrollbar-thin overflow-y-auto', phone ? 'max-h-[60dvh]' : 'max-h-[min(320px,50dvh)]')}
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
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-hidden transition-colors hover:bg-surface-2 focus-visible:bg-surface-2',
                  phone && 'min-h-[52px] gap-3 rounded-2xl px-3 text-[16px]',
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
      </PickerContent>
    </Picker>
  );
}
