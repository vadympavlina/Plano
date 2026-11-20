import { useEffect, useSyncExternalStore } from 'react';
import { useSettings } from '@/hooks/useCollections';
import { fetchOutages, powerReachable } from './api';
import type { Outages } from './logic';

const KEY = 'plano:power';
/** A copy younger than this is used as it is. */
const FRESH_MS = 5 * 60_000;

interface State {
  data?: Outages;
  /** When this device last got the schedule. */
  savedAt?: number;
  loading: boolean;
  /** The last try failed: what is shown is the last copy, if any. */
  failed: boolean;
}

function readCache(): Pick<State, 'data' | 'savedAt'> {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { data?: Outages; savedAt?: number } | null;
    return c?.data && Array.isArray(c.data.days) ? { data: c.data, savedAt: c.savedAt } : {};
  } catch {
    return {};
  }
}

// One copy for the whole app: the page, the line on Today and the calendar read the same data and trigger one request.
let state: State = { ...readCache(), loading: false, failed: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
let inflight: Promise<void> | null = null;

export function refreshPower(force = false): Promise<void> {
  if (!powerReachable) return Promise.resolve();
  if (!force && state.savedAt && Date.now() - state.savedAt < FRESH_MS) return Promise.resolve();
  if (inflight) return inflight;
  set({ loading: true });
  inflight = fetchOutages()
    .then((data) => {
      const savedAt = Date.now();
      try {
        localStorage.setItem(KEY, JSON.stringify({ data, savedAt }));
      } catch {
        /* the copy is only a convenience */
      }
      set({ data, savedAt, loading: false, failed: false });
    })
    .catch(() => set({ loading: false, failed: true }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** The schedule while «Світло» is on: kept fresh every few minutes and whenever the app comes back to the screen. */
export function usePower(enabled = true) {
  const snap = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!enabled) return;
    void refreshPower();
    const timer = setInterval(() => void refreshPower(), FRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refreshPower();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
  return { ...snap, refresh: () => refreshPower(true) };
}

/** The setup: on or off, which queue, and the schedule when it is on. */
export function usePowerSetup() {
  const s = useSettings();
  const power = usePower(s.powerOn);
  return { on: s.powerOn, queue: s.powerQueue, calendar: s.powerCalendar, style: s.powerStyle ?? 'hours', lead: s.powerLeadMin, ...power };
}
