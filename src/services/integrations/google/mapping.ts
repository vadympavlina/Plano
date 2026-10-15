import { addDaysKey, deviceTimeZone, diffDaysKey, minutesToTime, timeToMinutes, toDateKey } from '@/lib/date';
import type { CalendarEvent, DateKey, RecurrenceRule } from '@/types';

/** The parts of a Google Calendar event resource that Plano uses. */
export interface GEventTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GEventTime;
  end?: GEventTime;
  recurringEventId?: string;
  recurrence?: string[];
  htmlLink?: string;
}

export type GEventInput = Pick<GEvent, 'summary' | 'description' | 'location' | 'start' | 'end' | 'recurrence'> & { id?: string };

/** Fields of a Plano event that come from Google (identity and timestamps excluded). */
export type EventFields = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

// --- ids -----------------------------------------------------------------

/** 53-bit FNV-1a style hash → base36. Stable across devices. */
function hash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return ((h2 >>> 0).toString(36) + (h1 >>> 0).toString(36)).padStart(12, '0');
}

/**
 * Local id for an event imported from Google. Derived from the calendar and
 * event ids, so every device computes the same id — imports never duplicate.
 */
export function localIdForGoogle(calendarId: string, eventId: string): string {
  return `g_${hash(`${calendarId}\u0000${eventId}`)}`;
}

const BASE32HEX = '0123456789abcdefghijklmnopqrstuv';

/**
 * Google event id for an event created in Plano. Google accepts client ids in
 * base32hex (a–v, 0–9); deriving it from the Plano id makes inserts idempotent:
 * a second insert from another device returns 409 instead of a duplicate.
 */
export function googleIdForLocal(localId: string): string {
  const bytes = new TextEncoder().encode(`plano:${localId}`);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32HEX[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32HEX[(value << (5 - bits)) & 31];
  return out;
}

export const externalKey = (calendarId: string, eventId: string) => `${calendarId}\u0000${eventId}`;

// --- Google → Plano ------------------------------------------------------

function localDateTime(iso: string): { date: DateKey; time: string } {
  const d = new Date(iso);
  return { date: toDateKey(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

/** Converts a Google event (single instance) to Plano event fields. */
export function fromGoogle(g: GEvent, calendarId: string, color?: string): EventFields | null {
  if (g.status === 'cancelled' || !g.start || !g.end) return null;
  const base = {
    title: (g.summary ?? '').trim() || 'Без назви',
    description: g.description || undefined,
    location: g.location || undefined,
    exdates: [] as DateKey[],
    source: 'google' as const,
    timezone: g.start.timeZone,
    external: { provider: 'google' as const, calendarId, eventId: g.id, etag: g.etag, color },
  };
  if (g.start.date) {
    // Google's all-day end date is exclusive.
    const endInclusive = g.end.date ? addDaysKey(g.end.date, -1) : g.start.date;
    return { ...base, allDay: true, date: g.start.date, endDate: endInclusive > g.start.date ? endInclusive : undefined };
  }
  if (!g.start.dateTime || !g.end.dateTime) return null;
  const s = localDateTime(g.start.dateTime);
  const e = localDateTime(g.end.dateTime);
  // Plano's timed events live on one day; longer ones are shown until the end of the first day.
  let endTime = e.date === s.date ? e.time : '23:59';
  if (timeToMinutes(endTime) <= timeToMinutes(s.time)) endTime = minutesToTime(Math.min(timeToMinutes(s.time) + 15, 23 * 60 + 59));
  return { ...base, allDay: false, date: s.date, startTime: s.time, endTime };
}

// --- Plano → Google ------------------------------------------------------

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const compact = (d: DateKey) => d.replace(/-/g, '');

/** RFC 5545 recurrence lines (RRULE + EXDATE) for a Plano rule. */
export function toRecurrence(rule: RecurrenceRule, event: Pick<CalendarEvent, 'allDay' | 'startTime' | 'exdates'>, tz: string): string[] {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'weekly' && rule.byWeekday?.length) parts.push(`BYDAY=${[...rule.byWeekday].sort().map((d) => BYDAY[d]).join(',')}`);
  if (rule.until) parts.push(event.allDay ? `UNTIL=${compact(rule.until)}` : `UNTIL=${compact(rule.until)}T235959Z`);
  const lines = [`RRULE:${parts.join(';')}`];
  if (event.exdates.length) {
    lines.push(
      event.allDay
        ? `EXDATE;VALUE=DATE:${event.exdates.map(compact).join(',')}`
        : `EXDATE;TZID=${tz}:${event.exdates.map((d) => `${compact(d)}T${(event.startTime ?? '00:00').replace(':', '')}00`).join(',')}`,
    );
  }
  return lines;
}

export function toGoogle(e: CalendarEvent, tz: string = e.timezone || deviceTimeZone()): GEventInput {
  const out: GEventInput = {
    summary: e.title,
    // Empty strings (not undefined) so that clearing a field in Plano clears it in Google too.
    description: e.description ?? '',
    location: e.location ?? '',
  };
  if (e.allDay) {
    const last = e.endDate && e.endDate > e.date ? e.endDate : e.date;
    out.start = { date: e.date };
    out.end = { date: addDaysKey(last, 1) };
  } else {
    out.start = { dateTime: `${e.date}T${e.startTime ?? '09:00'}:00`, timeZone: tz };
    out.end = { dateTime: `${e.date}T${e.endTime ?? e.startTime ?? '10:00'}:00`, timeZone: tz };
  }
  out.recurrence = e.recurrence ? toRecurrence(e.recurrence, e, tz) : [];
  return out;
}

/** Number of days an all-day Plano event spans (for display). */
export const spanDays = (e: CalendarEvent) => (e.allDay && e.endDate ? diffDaysKey(e.endDate, e.date) + 1 : 1);
