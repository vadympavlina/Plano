/**
 * What the app and the Worker share about the power-outage schedule: its shape, Kyiv time and the outages of a queue.
 * Pure code with no browser or Worker APIs, so both sides import this one file.
 */

export const OUTAGES_SOURCE = 'https://www.roe.vsei.ua/disconnections/';

/** [from, to] as «HH:MM». «24:00» and «23:59» both mean the end of the day. */
export type Interval = [string, string];

export interface OutageDay {
  /** YYYY-MM-DD */
  date: string;
  /** `schedule`: hours are published; `pending`: «Очікується»; `none`: no outages are planned. */
  state: 'schedule' | 'pending' | 'none';
  /** Per queue («4.1»): its intervals, or null while that queue's hours are not published yet. */
  slots: Record<string, Interval[] | null>;
}

export interface Outages {
  source: string;
  /** When the company updated the page: «YYYY-MM-DDTHH:MM», Kyiv time. */
  updatedAt?: string;
  fetchedAt: number;
  /** The copy is older than it should be: the site could not be reached. */
  stale?: boolean;
  queues: string[];
  days: OutageDay[];
  /** Where a household finds its queue by address (PDF lists). */
  lookup: { city?: string; region?: string };
}

// ---- Kyiv time ---------------------------------------------------------------------------

const kyiv = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The date and the minute of the day in Kyiv at an instant. */
export function kyivParts(ms: number): { date: string; minutes: number } {
  const p = Object.fromEntries(kyiv.formatToParts(ms).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The instant of a Kyiv wall-clock time («2026-11-20», 540 minutes). */
export function kyivEpoch(date: string, minutes: number): number {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const offsetAt = (t: number) => {
    const p = kyivParts(t);
    const [py, pm, pd] = p.date.split('-').map(Number);
    return Date.UTC(py, pm - 1, pd, 0, p.minutes) - t;
  };
  return guess - offsetAt(guess - offsetAt(guess));
}

export const toMinutes = (t: string, end = false): number => {
  const [h, m] = t.split(':').map(Number);
  const v = h * 60 + m;
  return end && v >= 23 * 60 + 59 ? 1440 : v;
};

export interface Outage {
  start: number;
  end: number;
}

/** Every outage of a queue, as instants; an outage that runs over midnight into the next day's first hours is one. */
export function outagesOf(o: Outages, queue: string): Outage[] {
  const list: Outage[] = [];
  for (const day of o.days) {
    for (const [a, b] of day.slots[queue] ?? []) {
      const start = kyivEpoch(day.date, toMinutes(a));
      const end = kyivEpoch(day.date, toMinutes(b, true));
      if (end <= start) continue;
      const last = list[list.length - 1];
      if (last && start <= last.end) last.end = Math.max(last.end, end);
      else list.push({ start, end });
    }
  }
  return list;
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
