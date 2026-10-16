import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Repeat } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { TaskTick, taskChipStyle } from './TaskTick';
import { useNow } from '@/hooks/useNow';
import { addDaysKey, eachDateKey, formatDateKey, formatDuration, formatTime, fromDateKey, minutesToTime, todayKey, weekRange } from '@/lib/date';
import { solidTint, colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toast';
import type { DateKey, Task } from '@/types';
import { expandEvents, layoutDay, occurrencesOnDay, selectionRange, type EventOccurrence } from './logic';
import { buildTimedItems, eventColor, type GridItem } from './items';

const HOUR_PX = 52;
const SNAP = 15;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const LONG_PRESS_MS = 350;
const DAY_END = 24 * 60;

type EventItem = Extract<GridItem, { kind: 'event' }>;

interface DragState {
  mode: 'move' | 'resize';
  item: EventItem;
  pointerId: number;
  startX: number;
  startY: number;
  dayIndex: number;
  deltaMin: number;
  deltaDays: number;
  moved: boolean;
}

/** Range being drawn on the time grid to create an event. */
interface Selection {
  pointerId: number;
  dayIndex: number;
  anchor: number;
  pointer: number;
  startY: number;
  startX: number;
  /** Touch selections start only after a long press. */
  active: boolean;
  moved: boolean;
}

/** Range of days being drawn in the all-day row. */
interface DaySelection {
  pointerId: number;
  from: number;
  to: number;
}

export function TimeGrid({
  days,
  occurrences,
  tasks,
  onSelectDay,
  onSwipe,
}: {
  days: DateKey[];
  occurrences: EventOccurrence[];
  tasks: Task[];
  onSelectDay: (d: DateKey) => void;
  /** Horizontal swipe on touch screens: -1 = previous, 1 = next. */
  onSwipe?: (dir: 1 | -1) => void;
}) {
  const { categoryById, events } = useCollections();
  const taskColor = (t: Task) => colorOf(categoryById(t.categoryId)?.color ?? 'slate');
  const settings = useSettings();
  const { openEvent, openEventForm, openTask } = useUI();
  const actions = useActions();
  const now = useNow(60_000);
  const today = todayKey(now);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const allDayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [daySel, setDaySel] = useState<DaySelection | null>(null);
  const [hover, setHover] = useState<{ dayIndex: number; min: number } | null>(null);
  /** Touch: the first tap on an empty slot places a draft block; tapping the block opens the form. */
  const [draftSlot, setDraftSlot] = useState<{ dayIndex: number; start: number; end: number; at: number } | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockScroll = useRef(false);
  const single = days.length === 1;
  const fmt = (m: number) => formatTime(minutesToTime(Math.min(m, DAY_END - 1)), settings.timeFormat);

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
  const earliest = Math.min(...columns.flatMap((c) => c.positioned.map((p) => p.item.start)), DAY_END);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const base = days.includes(today) ? Math.max(0, now.getHours() - 2) : 7;
    const hour = Math.min(base, Math.floor(earliest / 60));
    const apply = () => {
      el.scrollTop = Math.max(0, hour * HOUR_PX - 16);
    };
    apply();
    // Mobile Safari can lay the scroller out after the first effect; apply again once it has a size.
    const raf = requestAnimationFrame(apply);
    let done = el.clientHeight > 0 && el.scrollTop > 0;
    const ro = new ResizeObserver(() => {
      if (done || el.clientHeight === 0) return;
      done = true;
      apply();
    });
    ro.observe(el);
    setDraftSlot(null);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length]);

  // Swipe left/right to page through days (touch only, ignored while drawing a selection).
  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  useEffect(() => {
    const el = scrollRef.current?.parentElement;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || blockScroll.current) return (start = null);
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - start.t < 700) swipeRef.current?.(dx < 0 ? 1 : -1);
      start = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  // Day view: a week strip replaces the single big day header.
  const strip = useMemo(() => {
    if (!single) return null;
    const r = weekRange(days[0], settings.weekStartsOn);
    const marked = new Set(expandEvents(events, r.start, r.end).map((o) => o.date));
    for (const t of tasks) {
      const d = t.dueDate ?? t.startDate;
      if (d && t.status !== 'cancelled') marked.add(d);
    }
    return eachDateKey(r.start, r.end).map((d) => ({ d, marked: marked.has(d) }));
  }, [single, days, settings.weekStartsOn, events, tasks]);

  // While a touch selection or drag is in progress, stop the page from scrolling.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (blockScroll.current) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const minuteAt = (clientY: number) => {
    const rect = columnsRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(DAY_END, ((clientY - rect.top) / HOUR_PX) * 60));
  };
  const dayAt = (clientX: number, el: HTMLElement | null) => {
    const rect = el!.getBoundingClientRect();
    return Math.max(0, Math.min(days.length - 1, Math.floor(((clientX - rect.left) / rect.width) * days.length)));
  };
  const clearLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  // ---- creating by selection -------------------------------------------------

  const onColumnPointerDown = (e: ReactPointerEvent<HTMLDivElement>, dayIndex: number) => {
    if (e.target !== e.currentTarget || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const min = minuteAt(e.clientY);
    const touch = e.pointerType !== 'mouse';
    const next: Selection = { pointerId: e.pointerId, dayIndex, anchor: min, pointer: min, startY: e.clientY, startX: e.clientX, active: !touch, moved: false };
    setHover(null);
    setSel(next);
    if (touch) {
      const target = e.currentTarget;
      const pointerId = e.pointerId;
      longPress.current = setTimeout(() => {
        blockScroll.current = true;
        try {
          target.setPointerCapture(pointerId);
        } catch {
          /* pointer already gone */
        }
        navigator.vibrate?.(8);
        setSel((s) => (s && s.pointerId === pointerId ? { ...s, active: true } : s));
      }, LONG_PRESS_MS);
    } else {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const hourAt = (min: number) => {
    const start = Math.min(Math.floor(min / 30) * 30, 23 * 60);
    return { start, end: Math.min(start + 60, DAY_END - 1) };
  };
  const openSlot = (dayIndex: number, range: { start: number; end: number }) => {
    setDraftSlot(null);
    openEventForm({
      defaults: { date: days[dayIndex], allDay: false, startTime: minutesToTime(range.start), endTime: minutesToTime(Math.min(range.end, DAY_END - 1)) },
    });
  };

  const finishSelection = (s: Selection) => {
    clearLongPress();
    blockScroll.current = false;
    setSel(null);
    let range: { start: number; end: number };
    if (!s.moved) {
      // A click (or a long press without dragging) creates a one-hour event.
      range = hourAt(s.anchor);
    } else {
      range = selectionRange(s.anchor, s.pointer, SNAP);
    }
    openSlot(s.dayIndex, range);
  };

  // ---- creating all-day events in the all-day row ------------------------------

  const onAllDayPointerDown = (e: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (e.target !== e.currentTarget || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
    setDaySel({ pointerId: e.pointerId, from: index, to: index });
  };
  const onAllDayPointerMove = (e: ReactPointerEvent) => {
    if (!daySel || e.pointerId !== daySel.pointerId || e.pointerType !== 'mouse') return;
    const to = dayAt(e.clientX, allDayRef.current);
    if (to !== daySel.to) setDaySel({ ...daySel, to });
  };
  const onAllDayPointerUp = (e: ReactPointerEvent) => {
    if (!daySel || e.pointerId !== daySel.pointerId) return;
    const a = Math.min(daySel.from, daySel.to);
    const b = Math.max(daySel.from, daySel.to);
    setDaySel(null);
    openEventForm({ defaults: { date: days[a], endDate: b > a ? days[b] : undefined, allDay: true, startTime: undefined, endTime: undefined } });
  };

  // ---- moving and resizing events ------------------------------------------

  const onItemPointerDown = (e: ReactPointerEvent, item: GridItem, dayIndex: number, mode: DragState['mode']) => {
    if (item.kind !== 'event' || !item.draggable || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    blockScroll.current = true;
    setHover(null);
    setDrag({ mode, item, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dayIndex, deltaMin: 0, deltaDays: 0, moved: false });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (drag && e.pointerId === drag.pointerId) {
      const dy = e.clientY - drag.startY;
      const dx = e.clientX - drag.startX;
      const moved = drag.moved || Math.abs(dy) > 4 || Math.abs(dx) > 6;
      let deltaMin = Math.round(((dy / HOUR_PX) * 60) / SNAP) * SNAP;
      let deltaDays = 0;
      if (drag.mode === 'resize') {
        deltaMin = Math.max(drag.item.start + SNAP - drag.item.end, Math.min(deltaMin, DAY_END - drag.item.end));
      } else {
        deltaMin = Math.max(-drag.item.start, Math.min(deltaMin, DAY_END - drag.item.end));
        if (!single && columnsRef.current) {
          deltaDays = Math.round(dx / (columnsRef.current.getBoundingClientRect().width / days.length));
          deltaDays = Math.max(-drag.dayIndex, Math.min(deltaDays, days.length - 1 - drag.dayIndex));
        }
      }
      setDrag({ ...drag, deltaMin, deltaDays, moved });
      return;
    }
    if (sel && e.pointerId === sel.pointerId) {
      if (!sel.active) {
        // Touch: moving before the long press fires means the person is scrolling.
        if (Math.abs(e.clientY - sel.startY) > 8 || Math.abs(e.clientX - sel.startX) > 8) {
          clearLongPress();
          setSel(null);
        }
        return;
      }
      const pointer = minuteAt(e.clientY);
      const moved = sel.moved || Math.abs(e.clientY - sel.startY) > 4;
      setSel({ ...sel, pointer, moved });
      return;
    }
    if (e.pointerType === 'mouse' && !daySel) {
      const target = e.target as HTMLElement;
      const idx = target.dataset.dayIndex;
      if (idx !== undefined) setHover({ dayIndex: Number(idx), min: Math.floor(minuteAt(e.clientY) / 30) * 30 });
      else if (hover) setHover(null);
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (sel && e.pointerId === sel.pointerId) {
      if (sel.active || e.pointerType === 'mouse') finishSelection(sel);
      else {
        // Short tap on touch: place (or move) a draft block instead of opening the form right away.
        clearLongPress();
        setSel(null);
        setDraftSlot({ dayIndex: sel.dayIndex, ...hourAt(sel.anchor), at: Date.now() });
      }
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    blockScroll.current = false;
    const { mode, item, deltaMin, deltaDays, moved } = drag;
    setDrag(null);
    const ev = item.occurrence.event;
    if (!moved) {
      openEvent(ev.id, item.occurrence.date);
      return;
    }
    if (deltaMin === 0 && deltaDays === 0) return;
    if (mode === 'resize') {
      const end = minutesToTime(Math.min(item.end + deltaMin, DAY_END - 1));
      void actions.events.move(ev, item.occurrence.date, minutesToTime(item.start), end).then(
        () => toast.success(`Тривалість: ${formatDuration(item.end + deltaMin - item.start)}`),
        () => undefined,
      );
      return;
    }
    const date = addDaysKey(item.occurrence.date, deltaDays);
    const start = minutesToTime(item.start + deltaMin);
    const end = minutesToTime(Math.min(item.end + deltaMin, DAY_END - 1));
    void actions.events.move(ev, date, start, end).then(
      () => toast.success(`Перенесено: ${formatDateKey(date, 'EEEEEE, d MMM')} · ${formatTime(start, settings.timeFormat)}`),
      () => undefined,
    );
  };

  const onPointerCancel = () => {
    clearLongPress();
    blockScroll.current = false;
    setDrag(null);
    setSel(null);
  };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  // Weekends are shaded in multi-day views.
  const weekend = (d: DateKey) => !single && [0, 6].includes(fromDateKey(d).getDay());
  const showsToday = days.includes(today);
  const selRange = sel?.active ? (sel.moved ? selectionRange(sel.anchor, sel.pointer, SNAP) : null) : null;
  const daySelRange = daySel ? { a: Math.min(daySel.from, daySel.to), b: Math.max(daySel.from, daySel.to) } : null;

  return (
    <div className="flex h-full min-h-0 select-none flex-col">
      {/* Day headers */}
      {strip ? (
        <div className="grid grid-cols-7 gap-0.5 border-b border-line px-1.5 py-1.5 sm:px-3">
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
                className={cn('flex flex-col items-center gap-0.5 rounded-xl py-1 transition-colors', !on && 'hover:bg-surface-2')}
              >
                <span className={cn('text-[11px] font-medium', isToday ? 'text-primary' : 'text-subtle')}>{formatDateKey(d, 'EEEEEE')}</span>
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums transition-colors',
                    on ? (isToday ? 'bg-primary text-white' : 'bg-accent text-surface') : isToday ? 'text-primary' : 'text-ink',
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
                className={cn('flex flex-col items-center justify-center gap-0.5 py-2 transition-colors hover:bg-surface-2 lg:flex-row lg:gap-1.5 lg:py-3', weekend(d) && 'bg-surface-2/70')}
                aria-label={`Відкрити ${formatDateKey(d, 'EEEE, d MMMM')}`}
              >
                <span className={cn('text-[12.5px] font-medium', isToday ? 'text-danger' : 'text-subtle')}>{formatDateKey(d, 'EEEEEE')}</span>
                <span
                  className={cn(
                    'flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[14px] font-semibold tabular-nums',
                    isToday ? 'bg-danger text-white' : d < today ? 'text-subtle' : 'text-ink',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* All-day row: always present so all-day events can be drawn here */}
      <div className="flex border-b border-line">
        <div className="flex w-12 shrink-0 items-center justify-end pr-1.5 text-right text-[10px] leading-[1.1] text-subtle sm:w-14">
          <span>
            весь
            <br />
            день
          </span>
        </div>
        <div
          ref={allDayRef}
          className="grid flex-1"
          style={gridCols}
          onPointerMove={onAllDayPointerMove}
          onPointerUp={onAllDayPointerUp}
          onPointerCancel={() => setDaySel(null)}
        >
          {columns.map((c, index) => {
            const selected = daySelRange && index >= daySelRange.a && index <= daySelRange.b;
            return (
              <div
                key={c.day}
                onPointerDown={(e) => onAllDayPointerDown(e, index)}
                title="Натисніть або протягніть, щоб додати подію на весь день"
                className={cn(
                  'scrollbar-thin max-h-[108px] min-h-[30px] min-w-0 cursor-cell space-y-1 overflow-y-auto border-l border-line p-1 transition-colors',
                  selected ? 'bg-primary/10' : weekend(c.day) ? 'bg-surface-2/70 hover:bg-surface-2' : 'hover:bg-surface-2/60',
                )}
              >
                {c.allDay.map((o) => {
                  const color = eventColor(o.event, categoryById);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => openEvent(o.event.id, o.date)}
                      className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] font-semibold"
                      style={{ backgroundColor: solidTint(color, 0.18), color }}
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
                      'flex w-full items-center gap-1.5 truncate rounded-md border border-dashed px-1.5 py-1 text-left text-[11px] font-medium text-ink',
                      t.status === 'completed' && 'text-subtle line-through',
                    )}
                    style={taskChipStyle(taskColor(t), t.status === 'completed')}
                    title={`Задача: ${t.title}`}
                  >
                    <TaskTick task={t} color={taskColor(t)} size={12} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {selected && c.allDay.length === 0 && c.untimedTasks.length === 0 && (
                  <span className="pointer-events-none block truncate px-1.5 py-1 text-[11px] font-medium text-primary">
                    {daySelRange!.b > daySelRange!.a ? `${daySelRange!.b - daySelRange!.a + 1} дн.` : 'Весь день'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <div className="flex" style={{ height: HOUR_PX * 24 }}>
          <div className="relative w-12 shrink-0 sm:w-14" aria-hidden>
            {showsToday && (
              <span
                className="absolute right-1 z-10 -translate-y-1/2 rounded-md bg-danger px-1 text-[10px] font-bold tabular-nums text-white"
                style={{ top: (nowMinutes / 60) * HOUR_PX }}
              >
                {fmt(nowMinutes)}
              </span>
            )}
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className={cn('absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-subtle', showsToday && Math.abs(h * 60 - nowMinutes) < 14 && 'invisible')}
                style={{ top: h * HOUR_PX }}
              >
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
            onPointerCancel={onPointerCancel}
            onPointerLeave={() => setHover(null)}
          >
            {showsToday && !single && (
              <div className="pointer-events-none absolute inset-x-0 z-[5] h-px bg-danger/30" style={{ top: (nowMinutes / 60) * HOUR_PX }} aria-hidden />
            )}
            {/* hour and half-hour lines */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {HOURS.map((h) => (
                <div key={h}>
                  <div className="absolute inset-x-0 border-t border-line/80" style={{ top: h * HOUR_PX }} />
                  <div className="absolute inset-x-0 border-t border-dashed border-line/45" style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
                </div>
              ))}
            </div>
            {columns.map((c, dayIndex) => (
              <div
                key={c.day}
                data-day-index={dayIndex}
                className={cn('relative cursor-cell border-l border-line', weekend(c.day) && 'bg-surface-2/70')}
                onPointerDown={(e) => onColumnPointerDown(e, dayIndex)}
                role="presentation"
              >
                {/* hover hint */}
                {hover && hover.dayIndex === dayIndex && !sel && !drag && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-0 flex items-start rounded-md bg-primary/[0.07] px-1.5 py-0.5 text-[10.5px] font-medium text-primary"
                    style={{ top: (hover.min / 60) * HOUR_PX, height: HOUR_PX / 2 }}
                  >
                    + {fmt(hover.min)}
                  </div>
                )}

                {c.positioned.map(({ item, column, columns: cols }) => {
                  const isDragging = drag?.item.key === item.key;
                  const shiftMin = isDragging && drag.mode === 'move' ? drag.deltaMin : 0;
                  const extraMin = isDragging && drag.mode === 'resize' ? drag.deltaMin : 0;
                  const start = item.start + shiftMin;
                  const end = item.end + shiftMin + extraMin;
                  const top = (start / 60) * HOUR_PX;
                  const height = Math.max(((end - start) / 60) * HOUR_PX, 20);
                  const short = height < 40;
                  const done = item.kind === 'task' && item.task.status === 'completed';
                  const dayShift =
                    isDragging && drag.mode === 'move' && columnsRef.current
                      ? (drag.deltaDays * columnsRef.current.getBoundingClientRect().width) / days.length
                      : 0;
                  return (
                    <div
                      key={item.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.title}, ${fmt(start)} – ${fmt(end)}`}
                      onPointerDown={(e) => onItemPointerDown(e, item, dayIndex, 'move')}
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
                        'group/ev absolute z-[1] overflow-hidden rounded-lg px-1.5 text-left transition-shadow',
                        item.kind === 'event' ? 'border-l-[3px]' : 'border border-dashed hover:shadow-soft',
                        short ? 'py-0.5' : 'py-1',
                        item.draggable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
                        isDragging && drag.moved && 'z-20 opacity-90 shadow-pop',
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(column / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        transform: dayShift ? `translateX(${dayShift}px)` : undefined,
                        ...(item.kind === 'event' ? { borderLeftColor: item.color, backgroundColor: solidTint(item.color, 0.17) } : taskChipStyle(item.color, done)),
                      }}
                    >
                      <p
                        className={cn('flex items-center gap-1 truncate text-[11.5px] font-semibold leading-tight text-ink', done && 'text-subtle line-through')}
                        style={item.kind === 'event' ? { color: item.color } : undefined}
                      >
                        {item.kind === 'task' && <TaskTick task={item.task} color={item.color} size={13} />}
                        <span className="truncate">{item.title}</span>
                        {item.kind === 'event' && item.occurrence.event.recurrence && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                      </p>
                      {!short && (
                        <p className="truncate text-[10.5px] tabular-nums text-muted" style={item.kind === 'event' ? { color: item.color, opacity: 0.75 } : undefined}>
                          {item.kind === 'task' && 'Задача · '}
                          {fmt(start)} – {fmt(end)}
                        </p>
                      )}
                      {!short && single && item.kind === 'event' && item.occurrence.event.location && (
                        <p className="truncate text-[10.5px]" style={{ color: item.color, opacity: 0.75 }}>
                          {item.occurrence.event.location}
                        </p>
                      )}
                      {item.kind === 'event' && item.draggable && (
                        <div
                          aria-hidden
                          onPointerDown={(e) => onItemPointerDown(e, item, dayIndex, 'resize')}
                          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center pb-0.5 opacity-0 transition-opacity group-hover/ev:opacity-100"
                        >
                          <span className="h-[3px] w-6 rounded-full bg-ink/25" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* selection being drawn */}
                {selRange && sel!.dayIndex === dayIndex && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border-2 border-primary bg-primary/15 px-1.5 py-1 shadow-soft"
                    style={{ top: (selRange.start / 60) * HOUR_PX, height: Math.max(((selRange.end - selRange.start) / 60) * HOUR_PX, 14) }}
                  >
                    <p className="truncate text-[11px] font-semibold tabular-nums text-primary">
                      {fmt(selRange.start)} – {fmt(selRange.end)}
                    </p>
                    <p className="truncate text-[10.5px] text-primary/80">{formatDuration(selRange.end - selRange.start)}</p>
                  </div>
                )}
                {draftSlot && draftSlot.dayIndex === dayIndex && !sel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Ignore the click the browser synthesises from the tap that placed the block.
                      if (Date.now() - draftSlot.at < 450) return;
                      openSlot(dayIndex, draftSlot);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute inset-x-1 z-10 flex flex-col items-start rounded-lg bg-primary px-2 py-1 text-left text-white shadow-pop animate-scale-in"
                    style={{ top: (draftSlot.start / 60) * HOUR_PX, height: ((draftSlot.end - draftSlot.start) / 60) * HOUR_PX }}
                  >
                    <span className="text-[12px] font-semibold">+ Нова подія</span>
                    <span className="text-[11px] tabular-nums opacity-85">
                      {fmt(draftSlot.start)} – {fmt(draftSlot.end)}
                    </span>
                  </button>
                )}
                {sel?.active && !sel.moved && sel.dayIndex === dayIndex && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border-2 border-primary bg-primary/15"
                    style={{ top: (hourAt(sel.anchor).start / 60) * HOUR_PX, height: HOUR_PX }}
                  />
                )}

                {c.day === today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (nowMinutes / 60) * HOUR_PX - 1 }} aria-hidden>
                    <div className="relative h-[2px] bg-danger">
                      <span className="absolute -left-[5px] -top-[4px] h-2.5 w-2.5 rounded-full bg-danger" />
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
