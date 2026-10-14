import type { CalendarEvent, Category, DateKey, Task } from '@/types';
import { colorOf } from '@/lib/utils/colors';
import { eventMinutes, taskMinutes, type EventOccurrence, type TimedItem } from './logic';

export type GridItem = TimedItem &
  (
    | { kind: 'event'; occurrence: EventOccurrence; title: string; color: string; draggable: boolean }
    | { kind: 'task'; task: Task; title: string; color: string; draggable: false }
  );

export function buildTimedItems(
  day: DateKey,
  occurrences: EventOccurrence[],
  tasks: Task[],
  categoryById: (id?: string) => Category | undefined,
): GridItem[] {
  const items: GridItem[] = [];
  for (const o of occurrences) {
    if (o.date !== day || o.event.allDay) continue;
    const m = eventMinutes(o.event);
    if (!m) continue;
    items.push({
      kind: 'event',
      key: o.key,
      start: m.start,
      end: m.end,
      occurrence: o,
      title: o.event.title,
      color: colorOf(categoryById(o.event.categoryId)?.color ?? 'blue'),
      draggable: !o.event.recurrence && o.event.source === 'plano',
    });
  }
  for (const t of tasks) {
    if ((t.dueDate ?? t.startDate) !== day || !t.startTime || t.status === 'cancelled') continue;
    const m = taskMinutes(t);
    if (!m) continue;
    items.push({
      kind: 'task',
      key: `task-${t.id}`,
      start: m.start,
      end: m.end,
      task: t,
      title: t.title,
      color: colorOf(categoryById(t.categoryId)?.color ?? 'slate'),
      draggable: false,
    });
  }
  return items;
}

export function isAllDayOn(o: EventOccurrence, day: DateKey): boolean {
  return o.event.allDay && o.date <= day && o.endDate >= day;
}

export function eventColor(event: CalendarEvent, categoryById: (id?: string) => Category | undefined) {
  return colorOf(categoryById(event.categoryId)?.color ?? 'blue');
}
