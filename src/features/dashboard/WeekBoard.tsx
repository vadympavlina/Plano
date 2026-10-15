import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { addDaysKey, eachDateKey, formatDateKey, weekRange } from '@/lib/date';
import { tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { DateKey } from '@/types';
import { expandEvents, occurrencesOnDay } from '@/features/calendar/logic';
import { eventColor } from '@/features/calendar/items';
import { taskDate } from '@/features/tasks/logic';

const MAX_ITEMS = 3;

type BoardItem = { key: string; kind: 'event' | 'task'; title: string; color?: string; done?: boolean };

/** Seven day columns with the events and tasks of each day; a day opens it in the calendar. */
export function WeekBoard({ today }: { today: DateKey }) {
  const { events, tasks, categoryById } = useCollections();
  const settings = useSettings();
  const [offset, setOffset] = useState(0);
  const range = weekRange(addDaysKey(today, offset * 7), settings.weekStartsOn);
  const days = useMemo(() => eachDateKey(range.start, range.end), [range.start, range.end]);
  const stripRef = useRef<HTMLDivElement>(null);

  const byDay = useMemo(() => {
    const occ = expandEvents(events, range.start, range.end);
    return days.map((d) => {
      const items: BoardItem[] = occurrencesOnDay(occ, d).map((o) => ({
        key: o.key,
        kind: 'event',
        title: o.event.title,
        color: eventColor(o.event, categoryById),
      }));
      for (const t of tasks) {
        if (taskDate(t) !== d || t.status === 'cancelled') continue;
        items.push({ key: `task:${t.id}`, kind: 'task', title: t.title, done: t.status === 'completed' });
      }
      return { day: d, items };
    });
  }, [events, tasks, categoryById, days, range.start, range.end]);

  // Phones: start the strip at today (or the first day of another week).
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>('[data-today="true"]');
    if (!strip) return;
    // Leave a peek of the previous day so it's clear the strip scrolls.
    strip.scrollLeft = el ? Math.max(0, strip.scrollLeft + el.getBoundingClientRect().left - strip.getBoundingClientRect().left - 56) : 0;
  }, [offset]);

  const sameMonth = range.start.slice(0, 7) === range.end.slice(0, 7);
  const label = sameMonth
    ? `${formatDateKey(range.start, 'd')}–${formatDateKey(range.end, 'd MMMM')}`
    : `${formatDateKey(range.start, 'd MMM')} – ${formatDateKey(range.end, 'd MMM')}`;

  return (
    <section aria-label="Тиждень">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight">
          Тиждень <span className="ml-1 text-[13px] font-normal text-muted">{label}</span>
        </h2>
        <div className="flex items-center gap-1">
          {offset !== 0 && (
            <button type="button" onClick={() => setOffset(0)} className="mr-1 h-7 rounded-lg px-2 text-[12.5px] font-medium text-muted hover:bg-surface hover:text-ink">
              Цей тиждень
            </button>
          )}
          <button type="button" aria-label="Попередній тиждень" onClick={() => setOffset((o) => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted shadow-soft hover:text-ink">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Наступний тиждень" onClick={() => setOffset((o) => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted shadow-soft hover:text-ink">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={stripRef}
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-4 pt-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {byDay.map(({ day, items }) => {
          const isToday = day === today;
          const past = day < today;
          const shown = items.slice(0, MAX_ITEMS);
          const more = items.length - shown.length;
          return (
            <Link
              key={day}
              to={`/calendar?date=${day}&view=day`}
              data-today={isToday}
              aria-label={`${formatDateKey(day, 'EEEE, d MMMM')}: ${items.length ? `елементів ${items.length}` : 'вільно'}`}
              className={cn(
                'flex w-[128px] shrink-0 flex-col rounded-2xl p-2.5 transition-colors lg:w-auto lg:min-w-0',
                isToday ? 'bg-surface shadow-pop ring-1 ring-primary/30' : 'bg-surface/70 hover:bg-surface',
                'min-h-[124px]',
              )}
            >
              <div className="mb-2 flex items-baseline justify-between px-0.5">
                <span className={cn('text-[12px] font-semibold', isToday ? 'text-primary' : 'text-subtle')}>
                  {isToday ? 'Сьогодні' : formatDateKey(day, 'EEEEEE')}
                </span>
                <span className={cn('text-[18px] font-bold leading-none tabular-nums', isToday ? 'text-primary' : past ? 'text-subtle' : 'text-ink')}>
                  {Number(day.slice(8))}
                </span>
              </div>
              <div className={cn('space-y-1', past && 'opacity-60')}>
                {shown.map((it) =>
                  it.kind === 'event' ? (
                    <p key={it.key} className="truncate rounded-md px-1.5 py-1 text-[11px] font-semibold text-ink" style={{ backgroundColor: tint(it.color!, 0.14) }}>
                      {it.title}
                    </p>
                  ) : (
                    <p key={it.key} className={cn('flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-muted', it.done && 'line-through')}>
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full border border-subtle', it.done && 'border-transparent bg-subtle')} />
                      <span className="truncate">{it.title}</span>
                    </p>
                  ),
                )}
                {items.length === 0 && <p className="px-1 py-1 text-[11px] text-subtle">Вільно</p>}
                {more > 0 && <p className="px-1 pt-0.5 text-[11px] font-medium text-muted">+{more} ще</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
