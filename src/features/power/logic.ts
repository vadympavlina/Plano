import { hhmm, kyivEpoch, kyivParts, outagesOf, toMinutes, type Outage, type Outages } from '@/lib/power/shared';

export type { Outage, OutageDay, Outages } from '@/lib/power/shared';
export { kyivParts } from '@/lib/power/shared';

/** A stretch of a day, in minutes from midnight (0–1440). */
export interface Span {
  start: number;
  end: number;
}

/** The queue's outages published for a day; null while its hours are not published («Очікується» or no such day). */
export function spansOf(data: Outages, queue: string, date: string): Span[] | null {
  const slots = data.days.find((d) => d.date === date)?.slots[queue];
  if (!slots) return null;
  return slots.map(([a, b]) => ({ start: toMinutes(a), end: toMinutes(b, true) })).filter((s) => s.end > s.start);
}

/** The queue's outages that touch a day, cut to it (one that began the evening before shows from 00:00). */
export function dayBands(data: Outages, queue: string, date: string): Span[] {
  const from = kyivEpoch(date, 0);
  const to = kyivEpoch(kyivParts(from + 36 * 3_600_000).date, 0);
  const bands: Span[] = [];
  for (const o of outagesOf(data, queue)) {
    if (o.end <= from || o.start >= to) continue;
    const start = o.start <= from ? 0 : kyivParts(o.start).minutes;
    const e = kyivParts(o.end);
    const end = o.end >= to || e.date !== date ? 1440 : e.minutes;
    if (end > start) bands.push({ start, end });
  }
  return bands;
}

export type PowerStatus =
  /** There is no power now; it should come back at `until`. */
  | { kind: 'off'; until: number; outage: Outage; then?: Outage }
  /** There is power; the next outage is `next` (none known yet when it is undefined). */
  | { kind: 'on'; next?: Outage }
  /** Today's hours for the queue are not published, so nothing can be said. */
  | { kind: 'unknown' };

export function statusAt(data: Outages, queue: string, now: number): PowerStatus {
  const list = outagesOf(data, queue);
  const current = list.find((o) => o.start <= now && now < o.end);
  if (current) return { kind: 'off', until: current.end, outage: current, then: list.find((o) => o.start >= current.end) };
  if (spansOf(data, queue, kyivParts(now).date) === null) return { kind: 'unknown' };
  return { kind: 'on', next: list.find((o) => o.start > now) };
}

/** The clock of an instant in Kyiv; the end of a day reads «24:00». */
export const clock = (ms: number, endOfDay = false) => {
  const p = kyivParts(ms);
  return endOfDay && p.minutes === 0 ? '24:00' : hhmm(p.minutes);
};

const tomorrowOf = (today: string) => kyivParts(kyivEpoch(today, 0) + 36 * 3_600_000).date;

/** «13:00», «завтра 02:00», «22.11 09:00»; midnight at the end of today reads «24:00». */
export function untilLabel(ms: number, now: number): string {
  const day = kyivParts(ms).date;
  const today = kyivParts(now).date;
  if (day === today) return clock(ms);
  if (kyivParts(ms).minutes === 0 && day === tomorrowOf(today)) return '24:00';
  return `${day === tomorrowOf(today) ? 'завтра' : `${day.slice(8)}.${day.slice(5, 7)}`} ${clock(ms)}`;
}

/** «1 год 20 хв», «45 хв»; whole hours drop the minutes. */
export function lengthLabel(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m} хв`;
  return m % 60 ? `${Math.floor(m / 60)} год ${m % 60} хв` : `${m / 60} год`;
}

export const totalMinutes = (spans: Span[]) => spans.reduce((n, s) => n + (s.end - s.start), 0);
export const spanLabel = (s: Span) => `${hhmm(s.start)}–${s.end >= 1440 ? '24:00' : hhmm(s.end)}`;

/** «9–13», «21–24», «9:30–11»: hours as short as they can be, for a narrow day header. */
export const compactSpan = (s: Span) => {
  const h = (m: number) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m / 60));
  return `${h(s.start)}–${h(s.end)}`;
};
