import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Repeat } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { useNow } from '@/hooks/useNow';
import { addDaysKey, formatDateKey, formatTime, minutesToTime, todayKey } from '@/lib/date';
import { tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toast';
import type { DateKey, Task } from '@/types';
import { layoutDay, occurrencesOnDay, type EventOccurrence } from './logic';
import { buildTimedItems, eventColor, type GridItem } from './items';

const HOUR_PX = 52;
const SNAP = 15;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface DragState {
  item: Extract<GridItem, { kind: 'event' }>;
  pointerId: number;
  startX: number;
  startY: number;
  dayIndex: number;
  deltaMin: number;
  deltaDays: number;
  moved: boolean;
}

export function TimeGrid({
  days,
  occurrences,
  tasks,
  onSelectDay,
}: {
  days: DateKey[];
  occurrences: EventOccurrence[];
  tasks: Task[];
  onSelectDay: (d: DateKey) => void;
}) {
  const { categoryById } = useCollections();
  const settings = useSettings();
  const { openEvent, openEventForm, openTask } = useUI();
  const actions = useActions();
  const now = useNow(60_000);
  const today = todayKey(now);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const single = days.length === 1;

  const columns = useMemo(
    () =>
      days.map((day) => ({
        day,
        positioned: layoutDay(buildTimedItems(day, occurrences, tasks, categoryById)),
        allDay: occurrencesOnDay(occurrences, day).filter((o) => o.event.allDay),
        untimedTasks: tasks.filter((t) => (t.dueDate ?? t.startDate) === day && !t.startTime && t.status !== 'cancelled'),
      })),
    [days, occurrences, tasks, categoryById],
  );
  // Scroll to a useful hour: the earliest item in view, or shortly before now.
  const earliest = Math.min(...columns.flatMap((c) => c.positioned.map((p) => p.item.start)), 24 * 60);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const base = days.includes(today) ? Math.max(0, now.getHours() - 2) : 7;
    const hour = Math.max(0, Math.min(base, Math.floor(earliest / 60)) - (earliest < base * 60 ? 0.25 : 0));
    el.scrollTop = hour * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length]);

  const hasAllDayRow = columns.some((c) => c.allDay.length > 0 || c.untimedTasks.length > 0);

  const onSlotClick = (day: DateKey, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 60 / 30) * 30;
    const start = Math.max(0, Math.min(minutes, 23 * 60));
    openEventForm({ defaults: { date: day, startTime: minutesToTime(start), endTime: minutesToTime(Math.min(start + 60, 23 * 60 + 59)) } });
  };

  const onPointerDown = (e: ReactPointerEvent, item: GridItem, dayIndex: number) => {
    if (item.kind !== 'event' || !item.draggable || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ item, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dayIndex, deltaMin: 0, deltaDays: 0, moved: false });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY;
    const dx = e.clientX - drag.startX;
    const moved = drag.moved || Math.abs(dy) > 4 || Math.abs(dx) > 6;
    let deltaMin = Math.round((dy / HOUR_PX) * 60 / SNAP) * SNAP;
    deltaMin = Math.max(-drag.item.start, Math.min(deltaMin, 24 * 60 - drag.item.end));
    let deltaDays = 0;
    if (!single && columnsRef.current) {
      const colW = columnsRef.current.getBoundingClientRect().width / days.length;
      deltaDays = Math.round(dx / colW);
      deltaDays = Math.max(-drag.dayIndex, Math.min(deltaDays, days.length - 1 - drag.dayIndex));
    }
    setDrag({ ...drag, deltaMin, deltaDays, moved });
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { item, deltaMin, deltaDays, moved } = drag;
    setDrag(null);
    const ev = item.occurrence.event;
    if (!moved) {
      openEvent(ev.id, item.occurrence.date);
      return;
    }
    if (deltaMin === 0 && deltaDays === 0) return;
    const date = addDaysKey(item.occurrence.date, deltaDays);
    const start = minutesToTime(item.start + deltaMin);
    const end = minutesToTime(Math.min(item.end + deltaMin, 24 * 60 - 1));
    void actions.events.move(ev, date, start, end).then(
      () => toast.success(`Перенесено: ${formatDateKey(date, 'EEEEEE, d MMM')} · ${formatTime(start, settings.timeFormat)}`),
      () => undefined,
    );
  };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Day headers */}
      <div className="flex border-b border-line">
        <div className="w-12 shrink-0 sm:w-14" />
        <div className="grid flex-1" style={gridCols}>
          {days.map((d) => {
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDay(d)}
                className={cn('flex flex-col items-center gap-1 py-2.5 transition-colors hover:bg-surface-2', single && 'items-start pl-3')}
                aria-label={`Відкрити ${formatDateKey(d, 'EEEE, d MMMM')}`}
              >
                <span className={cn('text-[12px] font-medium', isToday ? 'text-ink' : 'text-subtle')}>
                  {formatDateKey(d, single ? 'EEEE' : 'EEEEEE')}
                </span>
                <span
                  className={cn(
                    'flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-[15px] font-semibold tabular-nums',
                    isToday ? 'bg-accent text-surface' : 'text-ink',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* All-day row */}
      {hasAllDayRow && (
        <div className="flex border-b border-line">
          <div className="flex w-12 shrink-0 items-start justify-end whitespace-nowrap pr-1.5 pt-2 text-[10px] leading-tight text-subtle sm:w-14">весь<br />день</div>
          <div className="grid flex-1" style={gridCols}>
            {columns.map((c) => (
              <div key={c.day} className="scrollbar-thin max-h-[108px] min-w-0 space-y-1 overflow-y-auto border-l border-line p-1">
                {c.allDay.map((o) => {
                  const color = eventColor(o.event, categoryById);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => openEvent(o.event.id, o.date)}
                      className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium"
                      style={{ backgroundColor: tint(color, 0.16), color: 'rgb(var(--ink))' }}
                      title={o.event.title}
                    >
                      {o.event.title}
                    </button>
                  );
                })}
                {c.untimedTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTask(t.id)}
                    className={cn(
                      'flex w-full items-center gap-1 truncate rounded-md border border-line bg-surface px-1.5 py-1 text-left text-[11px]',
                      t.status === 'completed' && 'text-subtle line-through',
                    )}
                    title={t.title}
                  >
                    <span className={cn('flex h-3 w-3 shrink-0 items-center justify-center rounded-[4px] border border-subtle', t.status === 'completed' && 'border-transparent bg-accent text-surface')}>
                      {t.status === 'completed' && <Check className="h-2 w-2 stroke-[3]" />}
                    </span>
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto">
        <div className="flex" style={{ height: HOUR_PX * 24 }}>
          <div className="relative w-12 shrink-0 sm:w-14" aria-hidden>
            {HOURS.slice(1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-subtle" style={{ top: h * HOUR_PX }}>
                {formatTime(minutesToTime(h * 60), settings.timeFormat).replace(':00', settings.timeFormat === '12h' ? '' : ':00')}
              </span>
            ))}
          </div>
          <div
            ref={columnsRef}
            className="relative grid flex-1"
            style={gridCols}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
          >
            {/* hour lines */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {HOURS.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR_PX }} />
              ))}
            </div>
            {columns.map((c, dayIndex) => (
              <div
                key={c.day}
                className={cn('relative border-l border-line', c.day === today && 'bg-primary/[0.025]')}
                onClick={(e) => {
                  if (e.target === e.currentTarget) onSlotClick(c.day, e);
                }}
                role="presentation"
              >
                {c.positioned.map(({ item, column, columns: cols }) => {
                  const isDragging = drag?.item.key === item.key;
                  const top = (item.start / 60) * HOUR_PX + (isDragging ? (drag.deltaMin / 60) * HOUR_PX : 0);
                  const height = Math.max(((item.end - item.start) / 60) * HOUR_PX, 20);
                  const short = height < 40;
                  const done = item.kind === 'task' && item.task.status === 'completed';
                  const dayShift = isDragging && columnsRef.current ? (drag.deltaDays * columnsRef.current.getBoundingClientRect().width) / days.length : 0;
                  const startLabel = minutesToTime(item.start + (isDragging ? drag.deltaMin : 0));
                  const endLabel = minutesToTime(item.end + (isDragging ? drag.deltaMin : 0));
                  return (
                    <div
                      key={item.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.title}, ${formatTime(startLabel, settings.timeFormat)} – ${formatTime(endLabel, settings.timeFormat)}`}
                      onPointerDown={(e) => onPointerDown(e, item, dayIndex)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.kind === 'task') openTask(item.task.id);
                        else if (!item.draggable) openEvent(item.occurrence.event.id, item.occurrence.date);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (item.kind === 'task') openTask(item.task.id);
                          else openEvent(item.occurrence.event.id, item.occurrence.date);
                        }
                      }}
                      className={cn(
                        'absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 text-left transition-shadow',
                        short ? 'py-0.5' : 'py-1',
                        item.draggable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
                        isDragging && drag.moved && 'z-20 opacity-90 shadow-pop',
                        item.kind === 'task' && 'border border-l-[3px] border-line bg-surface shadow-soft',
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(column / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        transform: dayShift ? `translateX(${dayShift}px)` : undefined,
                        borderLeftColor: item.color,
                        backgroundColor: item.kind === 'event' ? tint(item.color, 0.16) : undefined,
                      }}
                    >
                      <p className={cn('flex items-center gap-1 truncate text-[11.5px] font-semibold leading-tight text-ink', done && 'text-subtle line-through')}>
                        {item.kind === 'task' && (
                          <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] border border-subtle', done && 'border-transparent bg-accent')} />
                        )}
                        <span className="truncate">{item.title}</span>
                        {item.kind === 'event' && item.occurrence.event.recurrence && <Repeat className="h-2.5 w-2.5 shrink-0 text-muted" />}
                      </p>
                      {!short && (
                        <p className="truncate text-[10.5px] tabular-nums text-muted">
                          {formatTime(startLabel, settings.timeFormat)} – {formatTime(endLabel, settings.timeFormat)}
                        </p>
                      )}
                      {!short && single && item.kind === 'event' && item.occurrence.event.location && (
                        <p className="truncate text-[10.5px] text-muted">{item.occurrence.event.location}</p>
                      )}
                    </div>
                  );
                })}
                {c.day === today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (nowMinutes / 60) * HOUR_PX }} aria-hidden>
                    <div className="relative h-px bg-danger">
                      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
