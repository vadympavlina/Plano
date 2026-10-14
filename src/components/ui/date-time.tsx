import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as PP from '@radix-ui/react-popover';
import { CalendarDays, Clock, X } from 'lucide-react';
import { nextMonday } from 'date-fns';
import { cn } from '@/lib/utils/cn';
import {
  addDaysKey,
  formatDateKey,
  formatDuration,
  formatTime,
  fromDateKey,
  minutesToTime,
  parseTimeInput,
  relativeDayLabel,
  timeToMinutes,
  toDateKey,
  todayKey,
} from '@/lib/date';
import type { DateKey, TimeString } from '@/types';
import { MiniCalendar } from './calendar';
import { popoverPanel, triggerClass, type ControlVariant } from './select';

interface CommonProps {
  variant?: ControlVariant;
  className?: string;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  disabled?: boolean;
}

/** Friendly label: Сьогодні / Завтра / Пт, 17 жовт. (+ year when not the current one). */
export function friendlyDate(value: DateKey, today: DateKey = todayKey()): string {
  const sameYear = value.slice(0, 4) === today.slice(0, 4);
  return relativeDayLabel(value, today, sameYear ? 'EEEEEE, d MMM' : 'd MMM yyyy');
}

function ClearButton({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClear}
      className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle hover:bg-line hover:text-ink"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function DatePicker({
  value,
  onChange,
  clearable = true,
  min,
  weekStartsOn = 1,
  variant = 'field',
  className,
  placeholder = 'Без дати',
  icon = <CalendarDays />,
  disabled,
  ...aria
}: CommonProps & {
  value: DateKey | undefined;
  onChange: (value: DateKey | undefined) => void;
  clearable?: boolean;
  min?: DateKey;
  weekStartsOn?: 0 | 1;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const pick = (d: DateKey | undefined) => {
    onChange(d);
    setOpen(false);
  };
  const quick: [string, DateKey][] = [
    ['Сьогодні', today],
    ['Завтра', addDaysKey(today, 1)],
    ['Наступного понеділка', toDateKey(nextMonday(fromDateKey(today)))],
  ];

  return (
    <PP.Root open={open} onOpenChange={setOpen}>
      <span className={cn('relative', variant === 'field' ? 'flex w-full' : 'inline-flex')}>
      <PP.Trigger
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        className={cn(triggerClass(variant, { invalid: aria['aria-invalid'], empty: !value }), value && clearable && 'pr-8', className)}
        {...aria}
      >
        <span className="flex shrink-0 text-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{value ? friendlyDate(value, today) : placeholder}</span>
      </PP.Trigger>
      {value && clearable && <ClearButton onClear={() => onChange(undefined)} label="Прибрати дату" />}
      </span>
      <PP.Portal>
        <PP.Content align="start" sideOffset={6} collisionPadding={12} className={cn(popoverPanel, 'w-[296px] p-3')}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {quick
              .filter(([, d]) => !min || d >= min)
              .map(([label, d]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                    value === d ? 'bg-accent text-surface' : 'bg-surface-2 text-ink hover:bg-line/70',
                  )}
                >
                  {label}
                </button>
              ))}
            {clearable && value && (
              <button type="button" onClick={() => pick(undefined)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted hover:bg-surface-2">
                Без дати
              </button>
            )}
          </div>
          <MiniCalendar selected={value ?? today} today={today} weekStartsOn={weekStartsOn} onSelect={pick} min={min} />
          {value && <p className="mt-2 border-t border-line pt-2 text-center text-xs text-muted">{formatDateKey(value, 'EEEE, d MMMM yyyy')}</p>}
        </PP.Content>
      </PP.Portal>
    </PP.Root>
  );
}

const SLOTS = Array.from({ length: 96 }, (_, i) => minutesToTime(i * 15));

export function TimePicker({
  value,
  onChange,
  clearable = false,
  after,
  timeFormat = '24h',
  variant = 'field',
  className,
  placeholder = 'Час',
  disabled,
  ...aria
}: CommonProps & {
  value: TimeString | undefined;
  onChange: (value: TimeString | undefined) => void;
  clearable?: boolean;
  /** When set (an end-time picker), only later times are offered, with durations. */
  after?: TimeString;
  timeFormat?: '12h' | '24h';
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const afterMin = after ? timeToMinutes(after) : null;
  const slots = afterMin != null ? SLOTS.filter((s) => timeToMinutes(s) > afterMin) : SLOTS;
  const parsed = parseTimeInput(text);
  const typedInvalid = text.trim() !== '' && (!parsed || (afterMin != null && timeToMinutes(parsed) <= afterMin));

  useEffect(() => {
    if (!open) return;
    setText('');
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      const target = value ?? (afterMin == null ? minutesToTime(Math.max(0, new Date().getHours() * 60 - 60)) : undefined);
      const el =
        (target && list.querySelector<HTMLElement>(`[data-time="${target}"]`)) ||
        (target && slots.find((s) => s >= target) && list.querySelector<HTMLElement>(`[data-time="${slots.find((s) => s >= target)}"]`)) ||
        null;
      if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (t: TimeString) => {
    onChange(t);
    setOpen(false);
  };

  return (
    <PP.Root open={open} onOpenChange={setOpen}>
      <span className={cn('relative', variant === 'field' ? 'flex w-full' : 'inline-flex')}>
      <PP.Trigger
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        className={cn(triggerClass(variant, { invalid: aria['aria-invalid'], empty: !value }), 'tabular-nums', value && clearable && 'pr-8', className)}
        {...aria}
      >
        <Clock className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate">{value ? formatTime(value, timeFormat) : placeholder}</span>
      </PP.Trigger>
      {value && clearable && <ClearButton onClear={() => onChange(undefined)} label="Прибрати час" />}
      </span>
      <PP.Portal>
        <PP.Content align="start" sideOffset={6} collisionPadding={12} className={cn(popoverPanel, 'w-[200px] p-2')}>
          <form
            onSubmit={(e) => {
              // The popover is portalled, but React still bubbles submit to an
              // enclosing form (e.g. the task form) — stop it here.
              e.preventDefault();
              e.stopPropagation();
              if (parsed && !typedInvalid) pick(parsed);
            }}
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="numeric"
              placeholder="Введіть, напр. 930"
              aria-label="Ввести час"
              aria-invalid={typedInvalid || undefined}
              className="mb-1.5 h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm tabular-nums outline-none placeholder:text-subtle focus:border-primary focus:bg-surface aria-[invalid=true]:border-danger"
            />
          </form>
          {parsed && !typedInvalid && (
            <button type="button" onClick={() => pick(parsed)} className="mb-1 w-full rounded-lg bg-primary/10 px-2.5 py-2 text-left text-sm font-semibold text-primary">
              {formatTime(parsed, timeFormat)}
            </button>
          )}
          <div ref={listRef} role="listbox" aria-label="Час" className="scrollbar-thin relative max-h-[240px] overflow-y-auto">
            {slots.map((s) => {
              const sel = s === value;
              return (
                <button
                  key={s}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  data-time={s}
                  onClick={() => pick(s)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm tabular-nums outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2',
                    sel && 'bg-accent text-surface hover:bg-accent focus-visible:bg-accent',
                  )}
                >
                  <span>{formatTime(s, timeFormat)}</span>
                  {afterMin != null && (
                    <span className={cn('text-xs', sel ? 'text-surface/70' : 'text-subtle')}>{formatDuration(timeToMinutes(s) - afterMin)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </PP.Content>
      </PP.Portal>
    </PP.Root>
  );
}
