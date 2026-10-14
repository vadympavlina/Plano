import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useToday } from '@/hooks/useNow';
import { formatTime, monthGrid, weekdayLabels } from '@/lib/date';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { DateKey, Task } from '@/types';
import { occurrencesOnDay, type EventOccurrence } from './logic';

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b border-line">
        {labels.map((l) => (
          <div key={l} className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-subtle">
            {l}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(84px, 1fr))` }}>
        {days.map((d) => {
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
              className={cn('group relative min-w-0 border-b border-r border-line p-1 sm:p-1.5', !inMonth && 'bg-surface-2/50')}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectDay(d)}
                  aria-label={`Відкрити ${d}`}
                  className={cn(
                    'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums transition-colors hover:bg-surface-2',
                    isToday ? 'bg-accent font-semibold text-surface hover:bg-accent' : inMonth ? 'text-ink' : 'text-subtle',
                  )}
                >
                  {Number(d.slice(8))}
                </button>
                <button
                  type="button"
                  aria-label={`Нова подія ${d}`}
                  onClick={() => openEventForm({ defaults: { date: d } })}
                  className="hidden rounded p-0.5 text-subtle hover:bg-surface-2 hover:text-ink sm:group-hover:block"
                >
                  <Plus className="h-3.5 w-3.5" />
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
                        it.type === 'event' ? colorOf(categoryById(it.o.event.categoryId)?.color ?? 'blue') : 'rgb(var(--subtle))',
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
                          ? { backgroundColor: tint(colorOf(categoryById(it.o.event.categoryId)?.color ?? 'blue'), 0.16) }
                          : undefined
                      }
                    >
                      {!it.o.event.allDay && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(categoryById(it.o.event.categoryId)?.color ?? 'blue') }} />
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
                      className={cn('flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-muted', it.t.status === 'completed' && 'line-through')}
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-[3px] border border-subtle', it.t.status === 'completed' && 'border-transparent bg-accent')} />
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
