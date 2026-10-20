/**
 * One Durable Object per user (named Reminders for history): push subscriptions
 * and upcoming reminders (delivered by an alarm), weekly encrypted backups, and
 * the app's recent error reports.
 */
import { DurableObject } from 'cloudflare:workers';
import { sendPush, type PushSubscriptionJSON } from './push';
import { openGrant, sealGrant } from './crypto';
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

export class Reminders extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const body = (await req.json().catch(() => ({}))) as {
      subscription?: PushSubscriptionJSON;
      endpoint?: string;
      items?: Reminder[];
      data?: string;
      at?: string;
      errors?: ErrorReport[];
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
    if (pathname === '/push/subscribe' && body.subscription?.endpoint && body.subscription.keys) {
      await this.ctx.storage.put('subs', [...subs.filter((s) => s.endpoint !== body.subscription!.endpoint), body.subscription].slice(-10));
    } else if (pathname === '/push/unsubscribe') {
      await this.ctx.storage.put('subs', subs.filter((s) => s.endpoint !== body.endpoint));
    } else if (pathname === '/push/schedule' && Array.isArray(body.items)) {
      const now = Date.now();
      const items = body.items
        .filter((i) => typeof i.at === 'number' && i.at > now && typeof i.title === 'string')
        .map((i) => ({ at: i.at, title: i.title.slice(0, 120), body: i.body?.slice(0, 240), url: i.url?.slice(0, 200), tag: i.tag?.slice(0, 80) }))
        .sort((a, b) => a.at - b.at)
        .slice(0, MAX);
      await this.ctx.storage.put('items', items);
      await (items.length ? this.ctx.storage.setAlarm(items[0].at) : this.ctx.storage.deleteAlarm());
    } else if (pathname === '/push/test') {
      await this.deliver([{ at: Date.now(), title: 'Plano', body: 'Сповіщення працюють 👌', tag: 'test' }]);
    } else return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ ok: true, devices: (await this.ctx.storage.get<PushSubscriptionJSON[]>('subs'))?.length ?? 0 });
  }

  async alarm() {
    const items = (await this.ctx.storage.get<Reminder[]>('items')) ?? [];
    const now = Date.now() + 30_000;
    await this.deliver(items.filter((i) => i.at <= now));
    const rest = items.filter((i) => i.at > now);
    await this.ctx.storage.put('items', rest);
    if (rest.length) await this.ctx.storage.setAlarm(rest[0].at);
  }

  private async deliver(items: Reminder[]) {
    if (!items.length || !this.env.VAPID_JWK) return;
    const jwk = JSON.parse(this.env.VAPID_JWK) as JsonWebKey;
    const subs = (await this.ctx.storage.get<PushSubscriptionJSON[]>('subs')) ?? [];
    const alive: PushSubscriptionJSON[] = [];
    for (const s of subs) {
      let ok = true;
      for (const i of items) ok = (await sendPush(s, { title: i.title, body: i.body, url: i.url, tag: i.tag }, jwk, SUBJECT).catch(() => true)) && ok;
      if (ok) alive.push(s);
    }
    if (alive.length !== subs.length) await this.ctx.storage.put('subs', alive);
  }
}
