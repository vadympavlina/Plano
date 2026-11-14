import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { tint } from '@/lib/utils/colors';

/** A rounded block of form lines (a phone form): lines are separated by thin dividers. */
export function FormGroup({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={cn('overflow-hidden rounded-[20px] bg-surface-2/70 [&>*+*]:border-t [&>*+*]:border-line/60', className)}>
      {children}
    </section>
  );
}

/** A line that holds something other than a picker: an icon, a label, and what is on the right (a switch, a field). */
export function FormLine({ icon, label, children, className }: { icon?: ReactNode; label?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[52px] items-center gap-3 px-4 py-2 text-[15px]', className)}>
      {icon && <span className="flex shrink-0 text-muted [&_svg]:h-[19px] [&_svg]:w-[19px]">{icon}</span>}
      {label && <span className="shrink-0 text-ink">{label}</span>}
      <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
    </div>
  );
}

/** A small heading above a group on a phone form. */
export function FormLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-5 px-1 text-[13px] font-semibold text-muted">{children}</h3>;
}

/** One line of choices that scrolls sideways (categories, quick dates) instead of wrapping into several rows. */
export function ChipStrip({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {children}
    </div>
  );
}

export const stripChip = 'inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[15px] font-medium transition-colors';

/** Equal-width choices in one row (a priority): the chosen one is filled. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; color?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface-2 p-1">
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
              'flex h-10 min-w-0 items-center justify-center rounded-full px-1 text-[13px] font-medium transition-colors',
              on ? 'text-ink shadow-soft' : 'text-muted hover:text-ink',
            )}
            style={on ? { backgroundColor: o.color ? tint(o.color, 0.2) : 'rgb(var(--surface))' } : undefined}
          >
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
