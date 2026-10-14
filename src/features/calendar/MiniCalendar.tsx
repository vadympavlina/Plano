import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths } from 'date-fns';
import { formatDateKey, fromDateKey, monthGrid, toDateKey, weekdayLabels } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { DateKey } from '@/types';

export function MiniCalendar({
  selected,
  today,
  weekStartsOn,
  onSelect,
  markedDates,
  highlightRange,
}: {
  selected: DateKey;
  today: DateKey;
  weekStartsOn: 0 | 1;
  onSelect: (d: DateKey) => void;
  markedDates?: Set<DateKey>;
  highlightRange?: { start: DateKey; end: DateKey };
}) {
  const [cursor, setCursor] = useState(selected.slice(0, 7));
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    setCursor(selected.slice(0, 7));
  }
  const month = `${cursor}-01`;
  const days = useMemo(() => monthGrid(month, weekStartsOn), [month, weekStartsOn]);
  const labels = weekdayLabels(weekStartsOn, 'narrow');
  const shift = (n: number) => setCursor(toDateKey(addMonths(fromDateKey(month), n)).slice(0, 7));

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{formatDateKey(month, 'MMMM yyyy')}</p>
        <div className="flex">
          <button type="button" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-subtle">
        {labels.map((l, i) => (
          <span key={i} className="py-1">
            {l}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center" role="grid" aria-label={formatDateKey(month, 'MMMM yyyy')}>
        {days.map((d) => {
          const inMonth = d.startsWith(cursor);
          const isSel = d === selected;
          const isToday = d === today;
          const inRange = highlightRange && d >= highlightRange.start && d <= highlightRange.end;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={formatDateKey(d, 'EEEE, MMMM d')}
              onClick={() => onSelect(d)}
              className={cn(
                'relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs tabular-nums transition-colors',
                inMonth ? 'text-ink' : 'text-subtle/70',
                inRange && !isSel && 'bg-surface-2',
                isSel ? 'bg-accent font-semibold text-surface' : 'hover:bg-surface-2',
                isToday && !isSel && 'font-semibold text-primary',
              )}
            >
              {Number(d.slice(8))}
              {markedDates?.has(d) && !isSel && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary/70" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
