import { occurrencesInRange } from '@/lib/date/recurrence';
import { addDaysKey, diffDaysKey, timeToMinutes } from '@/lib/date';
import type { CalendarEvent, DateKey, Task } from '@/types';

export interface EventOccurrence {
  /** Unique key of this occurrence: eventId@date. */
  key: string;
  event: CalendarEvent;
  /** Date of this occurrence (first day for multi-day all-day events). */
  date: DateKey;
  endDate: DateKey;
}

/** Expands events (including recurring series) into occurrences that intersect the range. */
export function expandEvents(events: CalendarEvent[], rangeStart: DateKey, rangeEnd: DateKey): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  for (const event of events) {
    const span = event.allDay && event.endDate && event.endDate > event.date ? diffDaysKey(event.endDate, event.date) : 0;
    if (event.recurrence) {
      // Include occurrences that started before the range but still span into it.
      const dates = occurrencesInRange(event.recurrence, event.date, addDaysKey(rangeStart, -span), rangeEnd, event.exdates);
      for (const date of dates) {
        out.push({ key: `${event.id}@${date}`, event, date, endDate: addDaysKey(date, span) });
      }
    } else {
      const end = addDaysKey(event.date, span);
      if (end >= rangeStart && event.date <= rangeEnd) {
        out.push({ key: `${event.id}@${event.date}`, event, date: event.date, endDate: end });
      }
    }
  }
  return out.sort(compareOccurrences);
}

export function compareOccurrences(a: EventOccurrence, b: EventOccurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  const sa = a.event.startTime ?? '00:00';
  const sb = b.event.startTime ?? '00:00';
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.event.title.localeCompare(b.event.title);
}

export function occurrencesOnDay(occurrences: EventOccurrence[], day: DateKey): EventOccurrence[] {
  return occurrences.filter((o) => o.date <= day && o.endDate >= day);
}

/** Item placed on a time grid (an event occurrence or a scheduled task). */
export interface TimedItem {
  key: string;
  start: number; // minutes from midnight
  end: number;
}

export interface PositionedItem<T extends TimedItem> {
  item: T;
  column: number;
  columns: number;
}

const MIN_DURATION = 15;

/**
 * Lays out overlapping items side by side. Items that overlap form a cluster;
 * each item gets the first free column and the cluster's column count.
 */
export function layoutDay<T extends TimedItem>(items: T[]): PositionedItem<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: PositionedItem<T>[] = [];
  let cluster: PositionedItem<T>[] = [];
  let columnsEnd: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const count = columnsEnd.length;
    for (const p of cluster) p.columns = count;
    result.push(...cluster);
    cluster = [];
    columnsEnd = [];
  };

  for (const item of sorted) {
    const end = Math.max(item.end, item.start + MIN_DURATION);
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    let col = columnsEnd.findIndex((e) => e <= item.start);
    if (col === -1) {
      col = columnsEnd.length;
      columnsEnd.push(end);
    } else columnsEnd[col] = end;
    cluster.push({ item, column: col, columns: 0 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return result;
}

export function eventMinutes(event: CalendarEvent): { start: number; end: number } | null {
  if (event.allDay || !event.startTime) return null;
  const start = timeToMinutes(event.startTime);
  const end = event.endTime ? timeToMinutes(event.endTime) : start + 60;
  return { start, end: Math.max(end, start + MIN_DURATION) };
}

export function taskMinutes(task: Task): { start: number; end: number } | null {
  if (!task.startTime) return null;
  const start = timeToMinutes(task.startTime);
  const end = task.endTime ? timeToMinutes(task.endTime) : start + 30;
  return { start, end: Math.max(end, start + MIN_DURATION) };
}

/** Events overlapping a proposed time slot on a date (for a gentle warning). */
export function findConflicts(
  events: CalendarEvent[],
  date: DateKey,
  start: string,
  end: string,
  ignoreId?: string,
): CalendarEvent[] {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return expandEvents(events, date, date)
    .filter((o) => o.event.id !== ignoreId && !o.event.allDay)
    .map((o) => o.event)
    .filter((ev) => {
      const m = eventMinutes(ev);
      return !!m && m.start < e && s < m.end;
    });
}

/** Next upcoming occurrences from now. */
export function upcomingOccurrences(
  events: CalendarEvent[],
  now: Date,
  todayKey: DateKey,
  days = 30,
  limit = 5,
): EventOccurrence[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return expandEvents(events, todayKey, addDaysKey(todayKey, days))
    .filter((o) => {
      if (o.endDate > todayKey) return true;
      if (o.date < todayKey) return o.endDate >= todayKey;
      if (o.event.allDay) return true;
      const m = eventMinutes(o.event);
      return !m || m.end > nowMinutes;
    })
    .slice(0, limit);
}

const DAY_END = 24 * 60;

/**
 * Time range picked by dragging on the grid. The anchor is where the pointer
 * went down; the range always covers at least one `snap` slot and works when
 * dragging upwards too.
 */
export function selectionRange(anchorMin: number, pointerMin: number, snap = 15): { start: number; end: number } {
  const a = Math.floor(anchorMin / snap) * snap;
  const p = Math.round(pointerMin / snap) * snap;
  const start = Math.max(0, Math.min(a, p >= a + snap ? a : Math.min(p, a)));
  const end = Math.min(DAY_END, Math.max(p, a + snap));
  return { start, end: Math.max(end, start + snap) };
}
