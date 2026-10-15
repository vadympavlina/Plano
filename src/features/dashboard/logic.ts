import { combineDateTime, formatDuration, timeToMinutes } from '@/lib/date';
import type { CalendarEvent, DateKey, Task } from '@/types';
import type { EventOccurrence } from '@/features/calendar/logic';

export type ScheduleItem =
  | { kind: 'event'; key: string; start: number; end?: number; occurrence: EventOccurrence }
  | { kind: 'task'; key: string; start: number; end?: number; task: Task };

/** Timed events and timed tasks of one day, merged into a single list ordered by start time. */
export function buildSchedule(occurrences: EventOccurrence[], tasks: Task[]): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  for (const o of occurrences) {
    if (o.event.allDay || !o.event.startTime) continue;
    items.push({
      kind: 'event',
      key: o.key,
      start: timeToMinutes(o.event.startTime),
      end: o.event.endTime ? timeToMinutes(o.event.endTime) : undefined,
      occurrence: o,
    });
  }
  for (const t of tasks) {
    if (!t.startTime || t.status === 'cancelled') continue;
    items.push({
      kind: 'task',
      key: `task:${t.id}`,
      start: timeToMinutes(t.startTime),
      end: t.endTime ? timeToMinutes(t.endTime) : undefined,
      task: t,
    });
  }
  // Events before tasks at the same minute keep meetings visually anchored.
  return items.sort((a, b) => a.start - b.start || (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : 1));
}

/** Index in `items` before which the "now" line goes (items.length = after the last one). */
export function nowLineIndex(items: ScheduleItem[], nowMinutes: number): number {
  const i = items.findIndex((x) => x.start > nowMinutes);
  return i === -1 ? items.length : i;
}

/** "Зараз", "через 40 хв", "Завтра о 10:00"… for the next-up card. */
export function nextUpLabel(
  event: CalendarEvent,
  date: DateKey,
  now: Date,
  today: DateKey,
  dayLabel: (d: DateKey) => string,
  time: (t: string) => string,
): string {
  if (event.allDay || !event.startTime) return date <= today ? 'Сьогодні · весь день' : `${dayLabel(date)} · весь день`;
  const start = combineDateTime(date, event.startTime).getTime();
  const end = event.endTime ? combineDateTime(date, event.endTime).getTime() : start;
  const t = now.getTime();
  if (t >= start && t < end) return 'Зараз';
  if (date !== today) return `${dayLabel(date)} о ${time(event.startTime)}`;
  const minutes = Math.max(1, Math.round((start - t) / 60_000));
  return `Через ${formatDuration(minutes)}`;
}

export type FreeTime = {
  /** Free minutes from now until the next item starts (only when nothing is running and the gap is ≥ 30 min). */
  untilNext?: number;
  /** When the last item of the day ends, if the rest of the evening is free. */
  freeAfter?: number;
};

const MIN_GAP = 30;
const DAY_END = 22 * 60;

/** Free windows around "now" for the day schedule: "Вільно 1 год 20 хв", "Вільно після 18:00". */
export function freeTime(items: ScheduleItem[], nowMinutes: number): FreeTime {
  const endOf = (x: ScheduleItem) => x.end ?? x.start + MIN_GAP;
  const res: FreeTime = {};
  if (items.length === 0) return res;
  const running = items.some((x) => x.start <= nowMinutes && endOf(x) > nowMinutes);
  const next = items.find((x) => x.start > nowMinutes);
  if (!running && next && next.start - nowMinutes >= MIN_GAP) res.untilNext = next.start - nowMinutes;
  const lastEnd = Math.max(...items.map(endOf));
  if (lastEnd > nowMinutes && lastEnd <= DAY_END - 60) res.freeAfter = lastEnd;
  return res;
}

/** Index of the busiest day (most items), or -1 when every day is empty. Ties go to the earliest day. */
export function busiestDay(counts: number[]): number {
  let best = -1;
  counts.forEach((c, i) => {
    if (c > 0 && (best === -1 || c > counts[best])) best = i;
  });
  return best;
}
