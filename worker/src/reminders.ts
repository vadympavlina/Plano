/**
 * One Durable Object per user (named Reminders for history): push subscriptions
 * and upcoming reminders (delivered by an alarm), weekly encrypted backups, and
 * the app's recent error reports.
 */
import { DurableObject } from 'cloudflare:workers';
import { sendPush, type PushSubscriptionJSON } from './push';
import { openGrant, sealGrant, snoozeToken } from './crypto';
import { describeDay, kyivParts, loadOutages, powerReminders, ukDate, type Outages } from './outages';
import type { Env } from './index';

export interface Reminder {
  at: number;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

const MAX = 300;
const BACKUPS = 8;
const CHUNK = 100_000; // storage values are capped at 128 KiB

interface BackupMeta {
  at: string;
  size: number;
  chunks: number;
}
interface ErrorReport {
  at: string;
  message: string;
  stack?: string;
  url?: string;
  ua?: string;
}
const SUBJECT = 'https://plano.edvault.online';
const SNOOZE_MS = 10 * 60_000;
/** How often a user's Durable Object looks at the power-outage schedule while «Світло» is on. */
const POWER_POLL_MS = 20 * 60_000;
const POWER_RETRY_MS = 10 * 60_000;

/** What the app asked for: the queue to watch and how many minutes ahead to warn. */
export interface PowerConfig {
  queue: string;
  leadMin: number;
}
const clean = (i: Reminder): Reminder => ({
  at: i.at,
  title: i.title.slice(0, 120),
  body: i.body?.slice(0, 240),
  url: i.url?.slice(0, 200),
  tag: i.tag?.slice(0, 80),
});

export class Reminders extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const body = (await req.json().catch(() => ({}))) as {
      subscription?: PushSubscriptionJSON;
      endpoint?: string;
      items?: Reminder[];
      item?: Reminder;
      data?: string;
      at?: string;
      errors?: ErrorReport[];
      queue?: string | null;
      leadMin?: number;
    };
    const uid = req.headers.get('x-uid') ?? '';
    const secret = this.env.GOOGLE_CLIENT_SECRET;
    const backups = (await this.ctx.storage.get<BackupMeta[]>('backups')) ?? [];
    if (pathname === '/backup/put' && typeof body.data === 'string' && body.data.length < 8_000_000) {
      // Unique, increasing timestamp (two backups in one millisecond must not share chunks).
      const at = new Date(Math.max(Date.now(), backups[0] ? Date.parse(backups[0].at) + 1 : 0)).toISOString();
      const sealed = await sealGrant(body.data, uid, secret);
      const chunks = Math.ceil(sealed.length / CHUNK);
      for (let i = 0; i < chunks; i++) await this.ctx.storage.put(`b:${at}:${i}`, sealed.slice(i * CHUNK, (i + 1) * CHUNK));
      const list = [{ at, size: body.data.length, chunks }, ...backups];
      for (const old of list.slice(BACKUPS)) await this.ctx.storage.delete(Array.from({ length: old.chunks }, (_, i) => `b:${old.at}:${i}`));
      await this.ctx.storage.put('backups', list.slice(0, BACKUPS));
      return Response.json({ ok: true, at });
    }
    if (pathname === '/backup/list') return Response.json({ backups });
    if (pathname === '/backup/get') {
      const meta = backups.find((b) => b.at === body.at);
      if (!meta) return Response.json({ error: 'not_found' }, { status: 404 });
      let sealed = '';
      for (let i = 0; i < meta.chunks; i++) sealed += (await this.ctx.storage.get<string>(`b:${meta.at}:${i}`)) ?? '';
      const data = await openGrant(sealed, uid, secret).catch(() => null);
      return data === null ? Response.json({ error: 'forbidden' }, { status: 403 }) : Response.json({ data });
    }
    if (pathname === '/errors/add' && Array.isArray(body.errors)) {
      const clean = body.errors.slice(0, 20).map((e) => ({
        at: String(e.at).slice(0, 40),
        message: String(e.message).slice(0, 500),
        stack: e.stack?.slice(0, 2000),
        url: e.url?.slice(0, 300),
        ua: e.ua?.slice(0, 200),
      }));
      const list = [...clean, ...((await this.ctx.storage.get<ErrorReport[]>('errors')) ?? [])].slice(0, 100);
      await this.ctx.storage.put('errors', list);
      return Response.json({ ok: true });
    }
    if (pathname === '/errors/list') return Response.json({ errors: (await this.ctx.storage.get<ErrorReport[]>('errors')) ?? [] });
    if (pathname === '/errors/clear') {
      await this.ctx.storage.put('errors', []);
      return Response.json({ ok: true });
    }
    const subs = (await this.ctx.storage.get<PushSubscriptionJSON[]>('subs')) ?? [];
    // Who and where, so pushes sent later by the alarm can carry a «Відкласти» token.
    if (pathname === '/push/subscribe' || pathname === '/push/schedule' || pathname === '/push/power') {
      await this.ctx.storage.put('uid', uid);
      const api = req.headers.get('x-api');
      if (api) await this.ctx.storage.put('api', api);
    }
    if (pathname === '/push/subscribe' && body.subscription?.endpoint && body.subscription.keys) {
      await this.ctx.storage.put('subs', [...subs.filter((s) => s.endpoint !== body.subscription!.endpoint), body.subscription].slice(-10));
    } else if (pathname === '/push/unsubscribe') {
      await this.ctx.storage.put(
        'subs',
        subs.filter((s) => s.endpoint !== body.endpoint),
      );
    } else if (pathname === '/push/schedule' && Array.isArray(body.items)) {
      const now = Date.now();
      const items = body.items
        .filter((i) => typeof i.at === 'number' && i.at > now && typeof i.title === 'string')
        .map(clean)
        .sort((a, b) => a.at - b.at)
        .slice(0, MAX);
      // Snoozed reminders aren't in the app's list; keep them.
      const snoozed = ((await this.ctx.storage.get<Reminder[]>('snoozed')) ?? []).filter((i) => i.at > now);
      await this.ctx.storage.put('items', items);
      await this.ctx.storage.put('snoozed', snoozed);
      await this.arm();
    } else if (pathname === '/push/snooze' && typeof body.item?.title === 'string') {
      const snoozed = [...((await this.ctx.storage.get<Reminder[]>('snoozed')) ?? []), clean({ ...body.item, at: Date.now() + SNOOZE_MS })].slice(-20);
      await this.ctx.storage.put('snoozed', snoozed);
      await this.arm();
    } else if (pathname === '/push/power') {
      const queue = typeof body.queue === 'string' && /^\d{1,2}\.\d{1,2}$/.test(body.queue) ? body.queue : null;
      if (queue) {
        const before = await this.ctx.storage.get<PowerConfig>('power');
        const leadMin = Math.min(180, Math.max(0, Math.round(Number(body.leadMin ?? 30))));
        await this.ctx.storage.put('power', { queue, leadMin } satisfies PowerConfig);
        // Another queue starts from a clean slate: what was known and sent belonged to the old one.
        if (before?.queue !== queue) {
          await this.ctx.storage.put('powerKnown', null);
          await this.ctx.storage.put('powerSent', []);
        }
        await this.pollPower(true);
      } else {
        for (const k of ['power', 'powerItems', 'powerKnown', 'powerSent', 'powerNext']) await this.ctx.storage.delete([k]);
      }
      await this.arm();
    } else if (pathname === '/push/test') {
      await this.deliver([{ at: Date.now(), title: 'Plano', body: 'Сповіщення працюють 👌', tag: 'test' }]);
    } else return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ ok: true, devices: (await this.ctx.storage.get<PushSubscriptionJSON[]>('subs'))?.length ?? 0 });
  }

  private async arm() {
    const all = [
      ...((await this.ctx.storage.get<Reminder[]>('items')) ?? []),
      ...((await this.ctx.storage.get<Reminder[]>('snoozed')) ?? []),
      ...((await this.ctx.storage.get<Reminder[]>('powerItems')) ?? []),
    ];
    const times = all.map((i) => i.at);
    // While «Світло» is on the object also wakes up now and then to look at the schedule.
    if (await this.ctx.storage.get<PowerConfig>('power')) times.push((await this.ctx.storage.get<number>('powerNext')) ?? Date.now() + POWER_POLL_MS);
    await (times.length ? this.ctx.storage.setAlarm(Math.min(...times)) : this.ctx.storage.deleteAlarm());
  }

  async alarm() {
    await this.pollPower();
    const now = Date.now() + 30_000;
    for (const key of ['items', 'snoozed', 'powerItems']) {
      const items = (await this.ctx.storage.get<Reminder[]>(key)) ?? [];
      const due = items.filter((i) => i.at <= now);
      await this.deliver(due);
      // A power warning is remembered by its tag, so the next look at the schedule does not repeat it.
      if (key === 'powerItems' && due.length) {
        const sent = (await this.ctx.storage.get<string[]>('powerSent')) ?? [];
        await this.ctx.storage.put('powerSent', [...sent, ...due.flatMap((i) => (i.tag ? [i.tag] : []))].slice(-100));
      }
      await this.ctx.storage.put(
        key,
        items.filter((i) => i.at > now),
      );
    }
    await this.arm();
  }

  /**
   * Looks at the power-outage schedule (at most every 20 minutes): plans a warning before each coming outage of the
   * queue and tells about a day's hours that were published or changed since the last look.
   */
  private async pollPower(force = false) {
    const cfg = await this.ctx.storage.get<PowerConfig>('power');
    if (!cfg) return;
    const now = Date.now();
    if (!force && now < ((await this.ctx.storage.get<number>('powerNext')) ?? 0)) return;
    let data: Outages;
    try {
      data = await loadOutages();
    } catch {
      await this.ctx.storage.put('powerNext', now + POWER_RETRY_MS);
      return;
    }
    const known = (await this.ctx.storage.get<Record<string, string> | null>('powerKnown')) ?? null;
    const sent = (await this.ctx.storage.get<string[]>('powerSent')) ?? [];
    const today = kyivParts(now).date;
    const seen: Record<string, string> = {};
    const news: Reminder[] = [];
    for (const d of data.days) {
      const hours = d.date < today ? null : describeDay(data, cfg.queue, d.date);
      if (hours === null) continue;
      seen[d.date] = hours;
      // The very first look only learns the schedule; later ones tell what is new or different.
      if (known && known[d.date] !== hours)
        news.push({
          at: now,
          title: known[d.date] === undefined ? `⚡ Графік на ${ukDate(d.date)}` : `⚡ Графік на ${ukDate(d.date)} змінено`,
          body: `Черга ${cfg.queue}: ${hours}`,
          url: '#/power',
          tag: `pwnews:${d.date}:${hours}`,
        });
    }
    await this.ctx.storage.put('powerKnown', seen);
    await this.ctx.storage.put('powerItems', cfg.leadMin > 0 ? powerReminders(data, cfg.queue, cfg.leadMin, now, sent) : []);
    await this.ctx.storage.put('powerNext', now + POWER_POLL_MS);
    if (news.length) await this.deliver(news);
  }

  private async deliver(items: Reminder[]) {
    if (!items.length || !this.env.VAPID_JWK) return;
    const jwk = JSON.parse(this.env.VAPID_JWK) as JsonWebKey;
    const subs = (await this.ctx.storage.get<PushSubscriptionJSON[]>('subs')) ?? [];
    const uid = await this.ctx.storage.get<string>('uid');
    const api = await this.ctx.storage.get<string>('api');
    const snooze = uid && api ? { api, uid, token: await snoozeToken(uid, this.env.GOOGLE_CLIENT_SECRET) } : undefined;
    const alive: PushSubscriptionJSON[] = [];
    for (const s of subs) {
      let ok = true;
      for (const i of items) ok = (await sendPush(s, { title: i.title, body: i.body, url: i.url, tag: i.tag, snooze }, jwk, SUBJECT).catch(() => true)) && ok;
      if (ok) alive.push(s);
    }
    if (alive.length !== subs.length) await this.ctx.storage.put('subs', alive);
  }
}
