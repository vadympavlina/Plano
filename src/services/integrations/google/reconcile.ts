import { occurrencesInRange } from '@/lib/date/recurrence';
import type { CalendarEvent, DateKey } from '@/types';
import { externalKey, fromGoogle, localIdForGoogle, type GEvent } from './mapping';

export interface RemoteCalendar {
  calendarId: string;
  color?: string;
  events: GEvent[];
}

export interface PullInput {
  local: CalendarEvent[];
  remote: RemoteCalendar[];
  /** Calendars currently selected for sync. */
  selected: string[];
  /** The window that was fetched from Google (inclusive date keys). */
  window: { start: DateKey; end: DateKey };
  /** Calendars fetched incrementally: only changes came back, so missing events are not deletions. */
  incremental?: Set<string>;
  /** External keys deleted in Plano but not yet sent to Google. */
  pendingDeleteKeys: Set<string>;
  now: string;
}

export interface PullPlan {
  upserts: CalendarEvent[];
  deletes: string[];
}

const touchesWindow = (e: CalendarEvent, w: PullInput['window']) => {
  if (e.recurrence) return occurrencesInRange(e.recurrence, e.date, w.start, w.end, e.exdates).length > 0;
  const end = e.endDate ?? e.date;
  return end >= w.start && e.date <= w.end;
};

function sameFields(a: CalendarEvent, b: Partial<CalendarEvent>): boolean {
  const keys: (keyof CalendarEvent)[] = ['title', 'description', 'location', 'date', 'endDate', 'allDay', 'startTime', 'endTime'];
  return keys.every((k) => (a[k] ?? undefined) === (b[k] ?? undefined)) && a.external?.color === b.external?.color;
}

/**
 * Decides how to bring local events in line with what Google returned for the
 * fetched window. Pure: the caller performs the writes.
 *
 * - New Google events are imported with a deterministic id.
 * - Changed Google events update their local copy unless the local copy has
 *   unsent changes (local edits win and are pushed next).
 * - Events that disappeared from Google inside the window are deleted locally.
 * - Instances of recurring series that were created in Plano are not imported
 *   again — the Plano series already represents them.
 * - Imported events from calendars that are no longer selected are removed.
 */
export function planPull({ local, remote, selected, window, pendingDeleteKeys, incremental, now }: PullInput): PullPlan {
  const byKey = new Map<string, CalendarEvent>();
  for (const e of local) if (e.external) byKey.set(externalKey(e.external.calendarId, e.external.eventId), e);
  const seen = new Set<string>();
  const upserts: CalendarEvent[] = [];
  const deletes: string[] = [];
  const selectedSet = new Set(selected);

  for (const cal of remote) {
    for (const g of cal.events) {
      const key = externalKey(cal.calendarId, g.id);
      if (g.status === 'cancelled') {
        // Incremental fetches report deletions explicitly.
        const gone = byKey.get(key);
        if (gone && !gone.syncPending) deletes.push(gone.id);
        continue;
      }
      if (pendingDeleteKeys.has(key)) continue;
      if (g.recurringEventId) {
        const master = byKey.get(externalKey(cal.calendarId, g.recurringEventId));
        if (master && master.source === 'plano') {
          seen.add(master.id);
          continue;
        }
      }
      const fields = fromGoogle(g, cal.calendarId, cal.color);
      if (!fields) continue;
      const existing = byKey.get(key);
      if (existing) {
        seen.add(existing.id);
        if (existing.syncPending) continue;
        if (existing.external?.etag === g.etag && sameFields(existing, fields)) continue;
        upserts.push({
          ...existing,
          title: fields.title,
          description: fields.description,
          location: fields.location,
          date: fields.date,
          endDate: fields.endDate,
          allDay: fields.allDay,
          startTime: fields.startTime,
          endTime: fields.endTime,
          external: { ...fields.external!, lastSyncedAt: now },
          updatedAt: now,
        });
      } else {
        const id = localIdForGoogle(cal.calendarId, g.id);
        seen.add(id);
        upserts.push({ ...fields, id, external: { ...fields.external!, lastSyncedAt: now }, createdAt: now, updatedAt: now });
      }
    }
  }

  const fetched = new Set(remote.filter((r) => !incremental?.has(r.calendarId)).map((r) => r.calendarId));
  for (const e of local) {
    if (!e.external || e.syncPending || seen.has(e.id)) continue;
    const cal = e.external.calendarId;
    if (e.source === 'google' && !selectedSet.has(cal)) {
      deletes.push(e.id);
      continue;
    }
    if (fetched.has(cal) && touchesWindow(e, window)) deletes.push(e.id);
  }
  return { upserts, deletes };
}
