/** Push notifications for this device, delivered by the Plano Worker (see worker/src/reminders.ts). */
import { call, TOKEN_SERVER_URL, usesTokenServer } from '@/services/integrations/google/server';
import type { Reminder } from '@/features/reminders/schedule';

const FLAG = 'plano:push';
export const pushSupported = () => usesTokenServer && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** iPhone/iPad: push works only from the Home Screen app. */
export const needsHomeScreen = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone;
export const pushEnabledHere = () => localStorage.getItem(FLAG) === '1';

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function enablePush() {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Сповіщення заборонені в налаштуваннях браузера.');
  const { key } = (await fetch(`${TOKEN_SERVER_URL}/push/key`).then((r) => r.json())) as { key?: string };
  if (!key) throw new Error('Сервер сповіщень ще не налаштований.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(key) }));
  await call('/push/subscribe', { subscription: sub.toJSON() });
  localStorage.setItem(FLAG, '1');
  localStorage.removeItem(SENT);
}

export async function disablePush() {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  localStorage.removeItem(FLAG);
  if (!sub) return;
  await call('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
}

export const sendTestPush = () => call('/push/test', {});

const SENT = 'plano:push-sent';
/** Sends the reminder list to the server unless it is unchanged since the last send. */
export async function syncReminders(items: Reminder[]) {
  const sig = JSON.stringify(items);
  if (localStorage.getItem(SENT) === sig) return;
  await call('/push/schedule', { items });
  localStorage.setItem(SENT, sig);
}
