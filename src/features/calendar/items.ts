import type { CalendarEvent, Category, DateKey, IntegrationState, Task } from '@/types';
import { colorOf } from '@/lib/utils/colors';
import { eventMinutes, taskMinutes, type EventOccurrence, type TimedItem } from './logic';

export type GridItem = TimedItem &
  (
    | { kind: 'event'; occurrence: EventOccurrence; title: string; category?: Category; color: string; draggable: boolean }
    | { kind: 'task'; task: Task; title: string; category?: Category; color: string; draggable: false }
  );

/** Events from Google calendars we may only read (no edits, no drag, nothing sent back). */
export const isReadOnly = (e: CalendarEvent, gcal?: IntegrationState) =>
  !!e.external && gcal?.calendars?.find((c) => c.id === e.external!.calendarId)?.writable === false;

export function buildTimedItems(
  day: DateKey,
  occurrences: EventOccurrence[],
  tasks: Task[],
  categoryById: (id?: string) => Category | undefined,
  gcal?: IntegrationState,
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
      category: categoryById(o.event.categoryId),
      color: eventColor(o.event, categoryById),
      draggable: !o.event.recurrence && !isReadOnly(o.event, gcal),
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
      category: categoryById(t.categoryId),
      color: colorOf(categoryById(t.categoryId)?.color ?? 'slate'),
      draggable: false,
    });
  }
  return items;
}

/** Category colour, else the colour of the source Google calendar, else blue. */
export function eventColor(event: CalendarEvent, categoryById: (id?: string) => Category | undefined) {
  const category = categoryById(event.categoryId);
  if (category) return colorOf(category.color);
  return event.external?.color ?? colorOf('blue');
}
