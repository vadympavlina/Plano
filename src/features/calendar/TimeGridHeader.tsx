import type { CSSProperties } from 'react';
import { formatDateKey } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { DateKey } from '@/types';
import { DayRing } from './TimeGridParts';

/**
 * The top of the time grid: in the day view a week strip, otherwise one header per visible day
 * with a small ring of that day's finished tasks.
 */
export function GridHeader({
  strip,
  days,
  today,
  dayProgress,
  gridCols,
  onSelectDay,
}: {
  strip: { d: DateKey; marked: boolean }[] | null;
  days: DateKey[];
  today: DateKey;
  dayProgress: Map<DateKey, { done: number; total: number }>;
  gridCols: CSSProperties;
  onSelectDay: (d: DateKey) => void;
}) {
  return strip ? (
    <div className="grid grid-cols-7 gap-0.5 border-b border-line/70 px-1 pb-1 sm:px-3 sm:py-1.5">
      {strip.map(({ d, marked }) => {
        const on = d === days[0];
        const isToday = d === today;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelectDay(d)}
            aria-pressed={on}
            aria-label={formatDateKey(d, 'EEEE, d MMMM')}
            className={cn('flex flex-col items-center gap-0 rounded-xl py-0.5 transition-colors sm:gap-0.5 sm:py-1', !on && 'hover:bg-surface-2')}
          >
            <span className={cn('text-[12px] font-medium', isToday ? 'text-primary' : 'text-subtle')}>{formatDateKey(d, 'EEEEEE')}</span>
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums transition-colors max-sm:h-7 max-sm:w-7',
                on ? (isToday ? 'bg-primary text-primary-fg' : 'bg-accent text-surface') : isToday ? 'text-primary' : 'text-ink',
              )}
            >
              {Number(d.slice(8))}
            </span>
            <span className={cn('h-1 w-1 rounded-full', marked && !on ? 'bg-subtle' : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  ) : (
    <div className="flex">
      <div className="w-12 shrink-0 sm:w-14" />
      <div className="grid flex-1" style={gridCols}>
        {days.map((d) => {
          const isToday = d === today;
          const p = dayProgress.get(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDay(d)}
              className={cn(
                'flex items-center justify-between gap-1.5 px-2.5 py-3 text-left transition-colors hover:bg-surface-2/60 lg:px-3',
                days.length > 3 && 'justify-center px-1 py-2.5',
              )}
              aria-label={`Відкрити ${formatDateKey(d, 'EEEE, d MMMM')}`}
            >
              <span
                className={cn(
                  'min-w-0 truncate text-[13.5px] font-bold',
                  days.length > 3 && 'flex w-full flex-col items-center gap-0.5 text-[12px] leading-none',
                )}
              >
                <span className={cn('capitalize', isToday && 'text-primary')}>{isToday && days.length <= 3 ? 'Сьогодні' : formatDateKey(d, 'EEEEEE')}</span>
                <span
                  className={cn(
                    'font-medium',
                    days.length <= 3 && 'ml-1.5',
                    isToday ? 'text-primary' : 'text-muted',
                    days.length > 3 && 'text-[15px] font-bold',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
              </span>
              {days.length <= 3 && (
                <span className="hidden sm:block">
                  <DayRing done={p?.done ?? 0} total={p?.total ?? 0} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
