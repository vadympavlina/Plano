import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CategoryIcon, categoryIcon } from '@/components/common/CategoryMark';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useToday } from '@/hooks/useNow';
import { formatTime, monthGrid, weekdayLabels } from '@/lib/date';
import { solidTint, colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { TaskTick, taskChipStyle } from './TaskTick';
import type { DateKey, Task } from '@/types';
import { occurrencesOnDay, type EventOccurrence } from './logic';
import { eventColor } from './items';

const MAX_ITEMS = 3;

export function MonthView({
  anchor,
  occurrences,
  tasks,
  onSelectDay,
}: {
  anchor: DateKey;
  occurrences: EventOccurrence[];
  tasks: Task[];
  onSelectDay: (d: DateKey) => void;
}) {
  const settings = useSettings();
  const { categoryById } = useCollections();
  const { openEvent, openEventForm, openTask } = useUI();
  const today = useToday();
  const days = useMemo(() => monthGrid(anchor, settings.weekStartsOn), [anchor, settings.weekStartsOn]);
  const month = anchor.slice(0, 7);
  const labels = weekdayLabels(settings.weekStartsOn);
  const weeks = days.length / 7;
  const [range, setRange] = useState<{ pointerId: number; from: number; to: number } | null>(null);

  // Drag across empty space in day cells to create a (multi-day) all-day event; a click creates one for that day.
  const indexAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-month-index]');
    return el ? Number(el.dataset.monthIndex) : null;
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (e.target !== e.currentTarget || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
    setRange({ pointerId: e.pointerId, from: index, to: index });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!range || e.pointerId !== range.pointerId || e.pointerType !== 'mouse') return;
    const to = indexAt(e.clientX, e.clientY);
    if (to !== null && to !== range.to) setRange({ ...range, to });
  };
  const onUp = (e: ReactPointerEvent) => {
    if (!range || e.pointerId !== range.pointerId) return;
    const a = Math.min(range.from, range.to);
    const b = Math.max(range.from, range.to);
    setRange(null);
    if (a === b) openEventForm({ defaults: { date: days[a] } });
    else openEventForm({ defaults: { date: days[a], endDate: days[b], allDay: true, startTime: undefined, endTime: undefined } });
  };
  const lo = range ? Math.min(range.from, range.to) : -1;
  const hi = range ? Math.max(range.from, range.to) : -1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b border-line">
        {labels.map((l) => (
          <div key={l} className="py-2 text-center text-[12px] font-medium text-subtle">
            {l}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 select-none grid-cols-7"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setRange(null)}
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(84px, 1fr))` }}>
        {days.map((d, index) => {
          const inMonth = d.startsWith(month);
          const isToday = d === today;
          const evs = occurrencesOnDay(occurrences, d);
          const dayTasks = tasks.filter((t) => (t.dueDate ?? t.startDate) === d && t.status !== 'cancelled');
          const items = [
            ...evs.map((o) => ({ type: 'event' as const, o })),
            ...dayTasks.map((t) => ({ type: 'task' as const, t })),
          ];
          const extra = items.length - MAX_ITEMS;
          return (
            <div
              key={d}
              data-month-index={index}
              onPointerDown={(e) => onDown(e, index)}
              className={cn(
                'relative min-w-0 cursor-cell border-b border-r border-line p-1 transition-colors sm:p-1.5',
                !inMonth && 'bg-surface-2/50',
                index >= lo && index <= hi ? 'bg-primary/10' : 'hover:bg-surface-2/40',
              )}
            >
              <div className="pointer-events-none mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectDay(d)}
                  aria-label={`Відкрити ${d}`}
                  className={cn(
                    'pointer-events-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums transition-colors hover:bg-surface-2',
                    isToday ? 'bg-danger font-semibold text-white hover:bg-danger' : inMonth ? 'text-ink' : 'text-subtle',
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              </div>
              {/* Phones: dots only */}
              <button type="button" className="flex flex-wrap gap-0.5 sm:hidden" onClick={() => onSelectDay(d)} aria-label={`Елементів: ${items.length}`}>
                {items.slice(0, 6).map((it, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        it.type === 'event' ? eventColor(it.o.event, categoryById) : 'rgb(var(--subtle))',
                    }}
                  />
                ))}
              </button>
              <div className="hidden space-y-0.5 sm:block">
                {items.slice(0, extra > 0 ? MAX_ITEMS - 1 : MAX_ITEMS).map((it) =>
                  it.type === 'event' ? (
                    <button
                      key={it.o.key}
                      type="button"
                      onClick={() => openEvent(it.o.event.id, it.o.date)}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px]"
                      style={
                        it.o.event.allDay
                          ? { backgroundColor: solidTint(eventColor(it.o.event, categoryById), 0.16) }
                          : undefined
                      }
                    >
                      {categoryIcon(categoryById(it.o.event.categoryId)) ? (
                        <CategoryIcon category={categoryById(it.o.event.categoryId)} className="h-3 w-3" color={eventColor(it.o.event, categoryById)} />
                      ) : (
                        !it.o.event.allDay && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: eventColor(it.o.event, categoryById) }} />
                      )}
                      {!it.o.event.allDay && it.o.event.startTime && (
                        <span className="shrink-0 tabular-nums text-muted">{formatTime(it.o.event.startTime, settings.timeFormat)}</span>
                      )}
                      <span className="truncate font-medium text-ink">{it.o.event.title}</span>
                    </button>
                  ) : (
                    <button
                      key={it.t.id}
                      type="button"
                      onClick={() => openTask(it.t.id)}
                      className={cn('flex w-full items-center gap-1 truncate rounded border border-dashed px-1 py-0.5 text-left text-[11px] font-medium text-ink', it.t.status === 'completed' && 'text-subtle line-through')}
                      style={taskChipStyle(colorOf(categoryById(it.t.categoryId)?.color ?? 'slate'), it.t.status === 'completed')}
                      title={`Задача: ${it.t.title}`}
                    >
                      <TaskTick task={it.t} color={colorOf(categoryById(it.t.categoryId)?.color ?? 'slate')} size={11} />
                      <CategoryIcon category={categoryById(it.t.categoryId)} className="h-3 w-3" color={colorOf(categoryById(it.t.categoryId)?.color ?? 'slate')} />
                      <span className="truncate">{it.t.title}</span>
                    </button>
                  ),
                )}
                {extra > 0 && (
                  <button type="button" onClick={() => onSelectDay(d)} className="px-1 text-[11px] font-medium text-muted hover:text-ink">
                    ще {extra + 1}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
