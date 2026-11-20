/**
 * Power-outage schedule of PrAT «Рівнеобленерго» (https://www.roe.vsei.ua/disconnections/).
 *
 * The company publishes the schedule as an HTML table (rows = days, columns = queues 1.1 … 6.2) and does
 * not allow other sites to read the page from a browser (CORS), so the Worker reads it, turns the table into
 * JSON and keeps a copy for a few minutes. The app asks the Worker; a user's Durable Object uses the same
 * data to send «світло вимкнуть о …» pushes.
 */

import { OUTAGES_SOURCE, kyivParts, hhmm, toMinutes, outagesOf, type Interval, type OutageDay, type Outages } from '../../src/lib/power/shared';
export { OUTAGES_SOURCE, kyivEpoch, kyivParts, outagesOf, toMinutes } from '../../src/lib/power/shared';
export type { Interval, Outage, OutageDay, Outages } from '../../src/lib/power/shared';

const CACHE_KEY = 'https://plano.internal/outages';
const FRESH_S = 300; // a copy is good for 5 minutes
const STALE_S = 86_400; // and is kept for a day, to answer when the site is down

// ---- reading the page ----------------------------------------------------------------------

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', ndash: '–', mdash: '—' };
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
const text = (html: string) =>
  decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const pad = (t: string) => (t.length === 4 ? `0${t}` : t);

interface Cell {
  text: string;
  html: string;
  span: number;
}

function rowsOf(table: string): Cell[][] {
  const rows: Cell[][] = [];
  for (const tr of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: Cell[] = [];
    for (const td of tr[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      const span = Number(/colspan\s*=\s*"?(\d+)/i.exec(td[1])?.[1] ?? 1);
      cells.push({ text: text(td[2]), html: td[2], span });
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

const RANGE = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/g;

/** Turns the page's table into data. Throws when the page no longer looks like the schedule. */
export function parseOutages(html: string, fetchedAt = Date.now()): Outages {
  const at = html.indexOf('fetched-data-container');
  const tableStart = html.indexOf('<table', at >= 0 ? at : 0);
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableStart < 0 || tableEnd < 0) throw new Error('no table');
  const rows = rowsOf(html.slice(tableStart, tableEnd));

  // The header row that starts with «Підчерга» lists the queues («1.1», «1.2» …).
  const head = rows.find((r) => /підчерг/i.test(r[0].text));
  const queues = head ? head.slice(1).flatMap((c) => (/^\d+\.\d+$/.test(c.text) ? [c.text] : [])) : [];
  if (!queues.length) throw new Error('no queues');

  const days: OutageDay[] = [];
  for (const row of rows) {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(row[0].text);
    if (!m) continue;
    // A cell can span several columns: it then applies to each of them.
    const values: Cell[] = row.slice(1).flatMap((c) => Array.from({ length: Math.max(1, c.span) }, () => c));
    const slots: Record<string, Interval[] | null> = {};
    queues.forEach((q, i) => {
      const cell = values[i];
      if (!cell) return void (slots[q] = null);
      const found = [...cell.html.matchAll(RANGE)].map((r): Interval => [pad(r[1]), pad(r[2])]);
      if (found.length) slots[q] = found;
      else slots[q] = /очікує/i.test(cell.text) ? null : [];
    });
    const all = Object.values(slots);
    const state = all.every((v) => v === null) ? 'pending' : all.some((v) => v && v.length) ? 'schedule' : 'none';
    days.push({ date: `${m[3]}-${m[2]}-${m[1]}`, state, slots });
  }
  if (!days.length) throw new Error('no days');
  days.sort((a, b) => a.date.localeCompare(b.date));

  const u = /Оновлено:\s*(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})/.exec(html);
  const lookup: Outages['lookup'] = {};
  for (const a of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = text(a[2]);
    if (/черг[уи].*м\.\s*Рівне/i.test(label)) lookup.city ??= a[1];
    else if (/черг[уи].*Рівненськ/i.test(label)) lookup.region ??= a[1];
  }
  return {
    source: OUTAGES_SOURCE,
    updatedAt: u ? `${u[3]}-${u[2]}-${u[1]}T${u[4].padStart(2, '0')}:${u[5]}` : undefined,
    fetchedAt,
    queues,
    days,
    lookup,
  };
}

// ---- loading, with a copy kept for a few minutes ----------------------------------------------

interface CacheLike {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}
const defaultCache = (): CacheLike | undefined =>
  typeof caches !== 'undefined' ? ((caches as unknown as { default: CacheLike }).default ?? undefined) : undefined;

/** The schedule, from the copy if it is fresh, else from the company's site; the old copy answers if the site does not. */
export async function loadOutages(fetcher: typeof fetch = fetch, cache: CacheLike | undefined = defaultCache(), now = Date.now()): Promise<Outages> {
  const fresh = cache && (await cache.match(new Request(`${CACHE_KEY}?fresh`)).catch(() => undefined));
  if (fresh) return (await fresh.json()) as Outages;
  try {
    const res = await fetcher(OUTAGES_SOURCE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Plano/1.0; +https://plano.edvault.online)', Accept: 'text/html' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parseOutages(await res.text(), now);
    if (cache) {
      const body = JSON.stringify(data);
      const put = (k: string, s: number) =>
        cache.put(new Request(`${CACHE_KEY}?${k}`), new Response(body, { headers: { 'Cache-Control': `max-age=${s}` } })).catch(() => undefined);
      await Promise.all([put('fresh', FRESH_S), put('stale', STALE_S)]);
    }
    return data;
  } catch (e) {
    const stale = cache && (await cache.match(new Request(`${CACHE_KEY}?stale`)).catch(() => undefined));
    if (stale) return { ...((await stale.json()) as Outages), stale: true };
    throw e;
  }
}

// ---- what a queue gets ---------------------------------------------------------------------

const dur = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} год${m % 60 ? ` ${m % 60} хв` : ''}` : `${m} хв`;
};

export interface PowerPush {
  at: number;
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * A push before each coming outage. `lead` minutes ahead; if that moment has passed but the outage has not
 * begun, it is due now. `sent` (tags) holds those already delivered.
 */
export function powerReminders(o: Outages, queue: string, lead: number, now: number, sent: string[] = []): PowerPush[] {
  const out: PowerPush[] = [];
  for (const x of outagesOf(o, queue)) {
    if (x.start <= now) continue;
    const tag = `pw:${x.start}`;
    if (sent.includes(tag)) continue;
    const when = hhmm(kyivParts(x.start).minutes);
    const till = hhmm(kyivParts(x.end).minutes);
    out.push({
      at: Math.max(now, x.start - lead * 60_000),
      title: `⚡ Світло вимкнуть о ${when}`,
      body: `Черга ${queue} · до ${till === '00:00' ? '24:00' : till} (${dur(x.end - x.start)})`,
      url: '#/power',
      tag,
    });
  }
  return out;
}

/** «09:00–13:00, 21:00–24:00» for a queue on a day, null when nothing is published. */
export function describeDay(o: Outages, queue: string, date: string): string | null {
  const day = o.days.find((d) => d.date === date);
  const slots = day?.slots[queue];
  if (!slots) return null;
  return slots.length ? slots.map(([a, b]) => `${a}–${toMinutes(b, true) === 1440 ? '24:00' : b}`).join(', ') : 'відключень немає';
}

const UK_MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const ukDate = (date: string) => `${Number(date.slice(8))} ${UK_MONTHS[Number(date.slice(5, 7)) - 1]}`;
