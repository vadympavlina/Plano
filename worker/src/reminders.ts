/**
 * One Durable Object per user: keeps the user's push subscriptions and the
 * upcoming reminders the app sent, and wakes itself (alarm) to deliver them.
 */
import { DurableObject } from 'cloudflare:workers';
import { sendPush, type PushSubscriptionJSON } from './push';
import type { Env } from './index';

export interface Reminder {
  at: number;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

const MAX = 300;
const SUBJECT = 'https://plano.edvault.online';

export class Reminders extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const body = (await req.json().catch(() => ({}))) as { subscription?: PushSubscriptionJSON; endpoint?: string; items?: Reminder[] };
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
