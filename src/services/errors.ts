/** Sends app errors to the Plano Worker so they can be looked at later (Settings → Дані). */
import { call, usesTokenServer } from '@/services/integrations/google/server';

interface Report {
  at: string;
  message: string;
  stack?: string;
  url?: string;
  ua?: string;
}
let queue: Report[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

export function reportError(err: unknown) {
  if (!usesTokenServer || queue.length > 20) return;
  const e = err instanceof Error ? err : new Error(String(err));
  queue.push({ at: new Date().toISOString(), message: e.message || String(err), stack: e.stack, url: location.hash, ua: navigator.userAgent });
  clearTimeout(timer);
  timer = setTimeout(() => {
    const errors = queue;
    queue = [];
    void call('/errors/add', { errors }).catch(() => undefined);
  }, 4000);
}

/** Global listeners for errors that escape React. */
export function watchErrors() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}

export const listErrors = () => call<{ errors: Report[] }>('/errors/list', {});
export const clearErrors = () => call('/errors/clear', {});
