import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { MapPin, Repeat } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { useData } from '@/app/providers/DataProvider';
import { TASK_DRAG, TaskTick, startTaskDrag } from './TaskTick';
import { useNow } from '@/hooks/useNow';
import { addDaysKey, eachDateKey, formatDateKey, formatDuration, formatTime, minutesToTime, todayKey, weekRange } from '@/lib/date';
import { colorOf, solidTint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toast';
import type { DateKey, Task } from '@/types';
import { expandEvents, layoutDay, occurrencesOnDay, selectionRange, type EventOccurrence } from './logic';
import { buildTimedItems, eventColor, type GridItem } from './items';
import {
  DAY_END,
  HOURS,
  HOUR_PX_DAY,
  HOUR_PX_MULTI,
  LONG_PRESS_MS,
  PICK_UP_MS,
  SNAP,
  type DaySelection,
  type DragState,
  type Selection,
} from './timeGridModel';
import { Marker } from './TimeGridParts';
import { GridHeader } from './TimeGridHeader';
import { useBlockTouchScroll, usePageSwipe, useScrollToUsefulHour } from './useTimeGridScroll';

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
  const { data } = useData();
  const gcal = data.integrations.google_calendar;
  const taskColor = (t: Task) => colorOf(categoryById(t.categoryId)?.color ?? 'slate');
  const settings = useSettings();
  const { openEvent, openQuickAdd, openTask } = useUI();
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
  /** An untimed task dragged over the grid: where it would land. */
  const [dropAt, setDropAt] = useState<{ dayIndex: number; min: number } | null>(null);
  /** Touch: the first tap on an empty slot places a draft block; tapping the block opens the form. */
  const [draftSlot, setDraftSlot] = useState<{ dayIndex: number; start: number; end: number; at: number } | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockScroll = useRef(false);
  /** Set when a mouse drag ends, so the click that follows doesn't open the event. */
  const suppressClick = useRef(false);
  const single = days.length === 1;
  const HOUR_PX = single ? HOUR_PX_DAY : HOUR_PX_MULTI;
  const fmt = (m: number) => formatTime(minutesToTime(Math.min(m, DAY_END - 1)), settings.timeFormat);

  /** Share of each day's tasks that are done: the small ring in the day header. */
  const dayProgress = useMemo(() => {
    const m = new Map<DateKey, { done: number; total: number }>();
    for (const t of tasks) {
      const d = t.dueDate ?? t.startDate;
      if (!d || t.status === 'cancelled') continue;
      const v = m.get(d) ?? { done: 0, total: 0 };
      v.total++;
      if (t.status === 'completed') v.done++;
      m.set(d, v);
    }
    return m;
  }, [tasks]);

  const columns = useMemo(
    () =>
      days.map((day) => ({
        day,
        positioned: layoutDay(buildTimedItems(day, occurrences, tasks, categoryById, gcal)),
        allDay: occurrencesOnDay(occurrences, day).filter((o) => o.event.allDay),
        untimedTasks: tasks.filter((t) => (t.dueDate ?? t.startDate) === day && !t.startTime && t.status !== 'cancelled'),
      })),
    [days, occurrences, tasks, categoryById, gcal],
  );

  // Scroll to a useful hour: the earliest item in view, or shortly before now.
  const earliest = Math.min(...columns.flatMap((c) => c.positioned.map((p) => p.item.start)), DAY_END);
  useScrollToUsefulHour({ scrollRef, days, today, now, earliest, hourPx: HOUR_PX, onSettle: () => setDraftSlot(null) });

  usePageSwipe(scrollRef, blockScroll, onSwipe);

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
  useBlockTouchScroll(scrollRef, blockScroll);

  const minuteAt = (clientY: number) => {
    const rect = columnsRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(DAY_END, ((clientY - rect.top) / HOUR_PX) * 60));
  };
  const dayAt = (clientX: number, el: HTMLElement | null) => {
    const rect = el!.getBoundingClientRect();
    return Math.max(0, Math.min(days.length - 1, Math.floor(((clientX - rect.left) / rect.width) * days.length)));
  };
  const dropMinute = (clientY: number) => Math.min(DAY_END - 60, Math.round((minuteAt(clientY) - 30) / SNAP) * SNAP);
  const onTaskDragOver = (e: DragEvent, dayIndex: number) => {
    if (!e.dataTransfer.types.includes(TASK_DRAG)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const min = Math.max(0, dropMinute(e.clientY));
    if (dropAt?.dayIndex !== dayIndex || dropAt.min !== min) setDropAt({ dayIndex, min });
  };
  const onTaskDrop = (e: DragEvent, dayIndex: number) => {
    const task = data.tasks[e.dataTransfer.getData(TASK_DRAG)];
    setDropAt(null);
    if (!task) return;
    e.preventDefault();
    const start = Math.max(0, dropMinute(e.clientY));
    const day = days[dayIndex];
    void actions.tasks.place(task, day, minutesToTime(start), minutesToTime(Math.min(start + 60, DAY_END - 1))).catch(() => undefined);
  };
  /** An untimed task dragged over the all-day row: the day it would move to. */
  const [dropDay, setDropDay] = useState<number | null>(null);
  const onDayDragOver = (e: DragEvent, dayIndex: number) => {
    if (!e.dataTransfer.types.includes(TASK_DRAG)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropDay !== dayIndex) setDropDay(dayIndex);
  };
  const onDayDrop = (e: DragEvent, dayIndex: number) => {
    const task = data.tasks[e.dataTransfer.getData(TASK_DRAG)];
    setDropDay(null);
    if (!task) return;
    e.preventDefault();
    void actions.tasks.place(task, days[dayIndex]).catch(() => undefined);
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
    // The quick box with the slot filled in: only the title is left to type.
    openQuickAdd({ kind: 'event', date: days[dayIndex], time: minutesToTime(range.start), endTime: minutesToTime(Math.min(range.end, DAY_END - 1)) });
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
    openQuickAdd({ kind: 'event', date: days[a], endDate: b > a ? days[b] : undefined, allDay: true });
  };

  // ---- moving and resizing events ------------------------------------------

  /** Touch: a finger resting on a block (not scrolling) picks it up. */
  const hold = useRef<{ pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const clearHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  };
  /** Where the pointer is now, for the edge auto-scroll while dragging. */
  const lastPoint = useRef({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const beginDrag = (
    target: HTMLElement,
    e: { pointerId: number; clientX: number; clientY: number },
    item: GridItem,
    dayIndex: number,
    mode: DragState['mode'],
  ) => {
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    blockScroll.current = true;
    setHover(null);
    lastPoint.current = { x: e.clientX, y: e.clientY };
    setDrag({
      mode,
      item,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dayIndex,
      deltaMin: 0,
      deltaDays: 0,
      moved: false,
      startScroll: scrollRef.current?.scrollTop ?? 0,
    });
  };

  const onItemPointerDown = (e: ReactPointerEvent, item: GridItem, dayIndex: number, mode: DragState['mode']) => {
    if (!item.draggable || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // The tick inside a task block is a button of its own: let it be clicked.
    if ((e.target as HTMLElement).closest('button,[role=checkbox]')) return;
    if (e.pointerType === 'touch') {
      // A finger scrolls first: only a press that stays put picks the block up (the resize handle is mouse-only).
      if (mode === 'resize') return;
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const point = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY };
      clearHold();
      lastPoint.current = { x: e.clientX, y: e.clientY };
      hold.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(() => {
          hold.current = null;
          navigator.vibrate?.(10);
          beginDrag(target, { ...point, clientX: lastPoint.current.x, clientY: lastPoint.current.y }, item, dayIndex, 'move');
          // Picked up: it counts as a drag at once, so letting go without moving does not open the block.
          setDrag((d) => (d ? { ...d, moved: true } : d));
        }, PICK_UP_MS),
      };
      return;
    }
    e.stopPropagation();
    beginDrag(e.currentTarget as HTMLElement, e, item, dayIndex, mode);
  };

  /** Works out how far the dragged block has moved (pointer travel plus scrolling) and re-renders only when a step changes. */
  const refreshDrag = (d: DragState, x: number, y: number) => {
    const dy = y - d.startY + ((scrollRef.current?.scrollTop ?? 0) - d.startScroll);
    const dx = x - d.startX;
    const moved = d.moved || Math.abs(dy) > 4 || Math.abs(dx) > 6;
    let deltaMin = Math.round(((dy / HOUR_PX) * 60) / SNAP) * SNAP;
    let deltaDays = 0;
    if (d.mode === 'resize') {
      deltaMin = Math.max(d.item.start + SNAP - d.item.end, Math.min(deltaMin, DAY_END - d.item.end));
    } else {
      deltaMin = Math.max(-d.item.start, Math.min(deltaMin, DAY_END - d.item.end));
      if (!single && columnsRef.current) {
        deltaDays = Math.round(dx / (columnsRef.current.getBoundingClientRect().width / days.length));
        deltaDays = Math.max(-d.dayIndex, Math.min(deltaDays, days.length - 1 - d.dayIndex));
      }
    }
    // The block moves in 15-minute steps: re-render only when a step changes, not on every pixel.
    if (deltaMin !== d.deltaMin || deltaDays !== d.deltaDays || moved !== d.moved) setDrag({ ...d, deltaMin, deltaDays, moved });
  };

  // Near the top or bottom edge the grid scrolls by itself while a block is held there.
  const dragging = drag?.moved === true;
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const tick = () => {
      const el = scrollRef.current;
      const d = dragRef.current;
      if (el && d) {
        const r = el.getBoundingClientRect();
        const { x, y } = lastPoint.current;
        const zone = 64;
        const speed =
          y < r.top + zone ? -Math.ceil(((r.top + zone - y) / zone) * 14) : y > r.bottom - zone ? Math.ceil(((y - (r.bottom - zone)) / zone) * 14) : 0;
        if (speed) {
          const before = el.scrollTop;
          el.scrollTop = before + speed;
          if (el.scrollTop !== before) refreshDrag(d, x, y);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // refreshDrag only reads refs and stable values of this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const onPointerMove = (e: ReactPointerEvent) => {
    if (hold.current && e.pointerId === hold.current.pointerId) {
      lastPoint.current = { x: e.clientX, y: e.clientY };
      // Moving before the press has lasted long enough means the person is scrolling.
      if (Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 8) clearHold();
      return;
    }
    if (drag && e.pointerId === drag.pointerId) {
      lastPoint.current = { x: e.clientX, y: e.clientY };
      refreshDrag(drag, e.clientX, e.clientY);
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
      // selectionRange snaps to SNAP anyway, so snap here and skip the render while it is the same slot.
      const pointer = Math.round(minuteAt(e.clientY) / SNAP) * SNAP;
      const moved = sel.moved || Math.abs(e.clientY - sel.startY) > 4;
      if (pointer !== sel.pointer || moved !== sel.moved) setSel({ ...sel, pointer, moved });
      return;
    }
    if (e.pointerType === 'mouse' && !daySel) {
      const target = e.target as HTMLElement;
      const idx = target.dataset.dayIndex;
      if (idx !== undefined) {
        const next = { dayIndex: Number(idx), min: Math.floor(minuteAt(e.clientY) / 30) * 30 };
        // Same half-hour slot: keep the state object, so a moving mouse does not re-render the grid.
        setHover((h) => (h && h.dayIndex === next.dayIndex && h.min === next.min ? h : next));
      } else if (hover) setHover(null);
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (hold.current && e.pointerId === hold.current.pointerId) clearHold();
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
    // The page-swipe listener reads this on touchend, which comes a moment after pointerup.
    if (e.pointerType === 'touch') setTimeout(() => (blockScroll.current = false), 80);
    else blockScroll.current = false;
    const { mode, item, deltaMin, deltaDays, moved } = drag;
    setDrag(null);
    // A plain click opens the event (onClick); only a real drag swallows that click.
    if (!moved) return;
    suppressClick.current = true;
    // ...and if no click follows (a long press that did not move), the next real click must not be eaten.
    setTimeout(() => (suppressClick.current = false), 400);
    if (deltaMin === 0 && deltaDays === 0) return;
    const day = item.kind === 'event' ? item.occurrence.date : days[drag.dayIndex];
    const put = (date: DateKey, start: string, end: string) =>
      item.kind === 'event' ? actions.events.move(item.occurrence.event, date, start, end) : actions.tasks.place(item.task, date, start, end);
    if (mode === 'resize') {
      const end = minutesToTime(Math.min(item.end + deltaMin, DAY_END - 1));
      void put(day, minutesToTime(item.start), end).then(
        () => toast.success(`Тривалість: ${formatDuration(item.end + deltaMin - item.start)}`),
        () => undefined,
      );
      return;
    }
    const date = addDaysKey(day, deltaDays);
    const start = minutesToTime(item.start + deltaMin);
    const end = minutesToTime(Math.min(item.end + deltaMin, DAY_END - 1));
    void put(date, start, end).then(
      () => toast.success(`Перенесено: ${formatDateKey(date, 'EEEEEE, d MMM')} · ${formatTime(start, settings.timeFormat)}`),
      () => undefined,
    );
  };

  const onPointerCancel = () => {
    clearLongPress();
    clearHold();
    blockScroll.current = false;
    setDrag(null);
    setSel(null);
  };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  const showsToday = days.includes(today);
  const selRange = sel?.active ? (sel.moved ? selectionRange(sel.anchor, sel.pointer, SNAP) : null) : null;
  const daySelRange = daySel ? { a: Math.min(daySel.from, daySel.to), b: Math.max(daySel.from, daySel.to) } : null;

  return (
    <div className="flex h-full min-h-0 select-none flex-col">
      <GridHeader strip={strip} days={days} today={today} dayProgress={dayProgress} gridCols={gridCols} onSelectDay={onSelectDay} />

      {/* All-day row: always present so all-day events can be drawn here */}
      <div className="flex border-b border-line/70">
        <div className="flex w-12 shrink-0 items-center justify-end pr-1.5 text-right text-[12px] leading-[1.1] text-subtle sm:w-14">
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
                onDragOver={(e) => onDayDragOver(e, index)}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropDay(null)}
                onDrop={(e) => onDayDrop(e, index)}
                title="Натисніть або протягніть, щоб додати подію на весь день"
                className={cn(
                  'scrollbar-thin max-h-[116px] min-h-[34px] min-w-0 cursor-cell space-y-1 overflow-y-auto border-l border-line/60 p-1 transition-colors max-sm:max-h-[92px]',
                  selected || dropDay === index ? 'bg-primary/10' : 'hover:bg-surface-2/50',
                )}
              >
                {c.allDay.map((o) => {
                  const color = eventColor(o.event, categoryById);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => openEvent(o.event.id, o.date)}
                      className="flex w-full items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-1.5 text-left text-[12px] font-semibold max-sm:py-1.5"
                      title={o.event.title}
                    >
                      <Marker category={categoryById(o.event.categoryId)} color={color} />
                      <span className="truncate">{o.event.title}</span>
                    </button>
                  );
                })}
                {c.untimedTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable={t.status !== 'completed'}
                    onDragStart={(e) => startTaskDrag(e, t.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-1.5 text-[12px] font-semibold text-ink max-sm:py-1.5',
                      t.status === 'completed' && 'text-subtle line-through',
                    )}
                  >
                    <TaskTick task={t} color={taskColor(t)} size={14} />
                    <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 truncate text-left" title={`Задача: ${t.title}`}>
                      {t.title}
                    </button>
                  </div>
                ))}
                {selected && c.allDay.length === 0 && c.untimedTasks.length === 0 && (
                  <span className="pointer-events-none block truncate px-1.5 py-1 text-[12px] font-medium text-primary">
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
                className="absolute right-1 z-10 -translate-y-1/2 rounded-md bg-danger px-1 text-[11.5px] font-bold tabular-nums text-on-fill"
                style={{ top: (nowMinutes / 60) * HOUR_PX }}
              >
                {fmt(nowMinutes)}
              </span>
            )}
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className={cn(
                  'absolute right-2 -translate-y-1/2 text-[11.5px] tabular-nums text-subtle',
                  showsToday && Math.abs(h * 60 - nowMinutes) < 14 && 'invisible',
                )}
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
              <div className="pointer-events-none absolute inset-x-0 z-5 h-px bg-danger/30" style={{ top: (nowMinutes / 60) * HOUR_PX }} aria-hidden />
            )}
            {/* hour and half-hour lines */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {HOURS.map((h) => (
                <div key={h}>
                  <div className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR_PX }} />
                  <div className="absolute inset-x-0 border-t border-dashed border-line/35" style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
                </div>
              ))}
            </div>
            {columns.map((c, dayIndex) => (
              <div
                key={c.day}
                data-day-index={dayIndex}
                className="relative cursor-cell border-l border-line/60"
                onPointerDown={(e) => onColumnPointerDown(e, dayIndex)}
                onDragOver={(e) => onTaskDragOver(e, dayIndex)}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
                onDrop={(e) => onTaskDrop(e, dayIndex)}
                role="presentation"
              >
                {dropAt?.dayIndex === dayIndex && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-primary bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-primary"
                    style={{ top: (dropAt.min / 60) * HOUR_PX, height: HOUR_PX }}
                  >
                    {fmt(dropAt.min)} – {fmt(dropAt.min + 60)}
                  </div>
                )}
                {/* hover hint */}
                {hover && hover.dayIndex === dayIndex && !sel && !drag && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-0 flex items-start rounded-md bg-primary/[0.07] px-1.5 py-0.5 text-[11.5px] font-medium text-primary"
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
                      // A task block contains its own tick button, so it cannot itself be a button.
                      role={item.kind === 'task' ? 'group' : 'button'}
                      tabIndex={0}
                      aria-label={`${item.title}, ${fmt(start)} – ${fmt(end)}`}
                      onPointerDown={(e) => onItemPointerDown(e, item, dayIndex, 'move')}
                      onContextMenu={(e) => item.draggable && e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressClick.current) return void (suppressClick.current = false);
                        if (item.kind === 'task') openTask(item.task.id);
                        else openEvent(item.occurrence.event.id, item.occurrence.date);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (item.kind === 'task') openTask(item.task.id);
                          else openEvent(item.occurrence.event.id, item.occurrence.date);
                        }
                      }}
                      className={cn(
                        'group/ev absolute z-1 overflow-hidden text-left transition-shadow [-webkit-touch-callout:none] hover:shadow-soft',
                        single && item.kind === 'event' ? 'rounded-2xl border-l-[5px]' : 'rounded-xl bg-surface-2',
                        short ? 'px-2 py-0.5' : single ? 'px-3.5 py-2.5' : 'px-2.5 py-2',
                        item.draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                        isDragging && drag.moved && 'z-20 scale-[1.02] opacity-90 shadow-pop',
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(column / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        transform: dayShift ? `translateX(${dayShift}px)` : undefined,
                        ...(single && item.kind === 'event' ? { borderLeftColor: item.color, backgroundColor: solidTint(item.color, 0.13) } : {}),
                      }}
                    >
                      <div className={cn('flex gap-2.5', short ? 'items-center' : 'items-start')}>
                        <span className={cn(!short && 'pt-0.5')}>
                          {item.kind === 'task' ? (
                            <TaskTick task={item.task} color={item.color} size={short ? 13 : 16} />
                          ) : (
                            <Marker category={item.category} color={item.color} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'flex items-center gap-1 truncate font-semibold leading-tight',
                              single ? 'text-[14.5px]' : 'text-[12.5px]',
                              done && 'text-subtle line-through',
                            )}
                          >
                            <span className="truncate">{item.title}</span>
                            {item.kind === 'event' && item.occurrence.event.recurrence && <Repeat className="h-3 w-3 shrink-0 opacity-50" />}
                            {short && <span className="ml-auto shrink-0 pl-1 text-[12px] font-medium tabular-nums text-muted">{fmt(start)}</span>}
                          </p>
                          {!short && (
                            <p className={cn('mt-0.5 truncate tabular-nums text-muted', single ? 'text-[12.5px]' : 'text-[11.5px]')}>
                              {fmt(start)} – {fmt(end)}
                              {end - start >= 30 && ` · ${formatDuration(end - start)}`}
                              {item.kind === 'task' &&
                                item.task.subtasks.length > 0 &&
                                ` · ${item.task.subtasks.filter((x) => x.done).length} з ${item.task.subtasks.length}`}
                            </p>
                          )}
                          {!short && single && item.kind === 'event' && item.occurrence.event.location && (
                            <p className="mt-1 flex items-center gap-1 truncate text-[12.5px] text-muted">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.occurrence.event.location}</span>
                            </p>
                          )}
                          {height >= 110 && single && item.kind === 'event' && item.occurrence.event.description && (
                            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{item.occurrence.event.description}</p>
                          )}
                        </div>
                      </div>
                      {item.draggable && (
                        <div
                          aria-hidden
                          onPointerDown={(e) => onItemPointerDown(e, item, dayIndex, 'resize')}
                          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none pointer-coarse:hidden items-end justify-center pb-0.5 opacity-0 transition-opacity group-hover/ev:opacity-100"
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
                    <p className="truncate text-[12px] font-semibold tabular-nums text-primary">
                      {fmt(selRange.start)} – {fmt(selRange.end)}
                    </p>
                    <p className="truncate text-[11.5px] text-primary/80">{formatDuration(selRange.end - selRange.start)}</p>
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
                    className="absolute inset-x-1 z-10 flex flex-col items-start rounded-lg bg-primary px-2 py-1 text-left text-primary-fg shadow-pop animate-scale-in"
                    style={{ top: (draftSlot.start / 60) * HOUR_PX, height: ((draftSlot.end - draftSlot.start) / 60) * HOUR_PX }}
                  >
                    <span className="text-[12px] font-semibold">+ Нова подія</span>
                    <span className="text-[12px] tabular-nums opacity-85">
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
                  <div className="pointer-events-none absolute inset-x-0 z-0" style={{ top: (nowMinutes / 60) * HOUR_PX - 1 }} aria-hidden>
                    <div className="relative h-[2px] bg-danger">
                      <span className="absolute left-[-5px] top-[-4px] h-2.5 w-2.5 rounded-full bg-danger" />
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
