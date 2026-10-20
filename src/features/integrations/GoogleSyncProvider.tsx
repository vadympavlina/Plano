import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useData } from '@/app/providers/DataProvider';
import { addDaysKey, deviceTimeZone, fromDateKey, todayKey } from '@/lib/date';
import { stripUndefined } from '@/lib/validation/parse';
import { nowIso } from '@/services/repositories';
import { describeError } from '@/services/sync';
import {
  clearStoredToken,
  getStoredToken,
  isGoogleConfigured,
  requestGoogleCode,
  requestGoogleToken,
  revokeGoogleToken,
  storeToken,
} from '@/services/integrations/google/auth';
import { TokenServerError, exchangeCode, refreshAccess, revokeGrant, usesTokenServer } from '@/services/integrations/google/server';
import {
  GoogleApiError,
  deleteEvent,
  getEvent,
  insertEvent,
  listCalendars,
  listEvents,
  updateEvent,
} from '@/services/integrations/google/api';
import { externalKey, googleIdForLocal, toGoogle } from '@/services/integrations/google/mapping';
import { planPull } from '@/services/integrations/google/reconcile';
import type { CalendarEvent, ExternalCalendarInfo, IntegrationState } from '@/types';

export const GCAL_KEY = 'google_calendar';
const SYNC_INTERVAL_MS = 5 * 60_000;
const PAST_DAYS = 60;
const FUTURE_DAYS = 400;

export type GoogleSyncPhase = 'unavailable' | 'off' | 'needs_auth' | 'syncing' | 'idle' | 'error';

interface GoogleSyncValue {
  phase: GoogleSyncPhase;
  state: IntegrationState | undefined;
  error: string | null;
  /** Number of local changes waiting to be sent. */
  pending: number;
  connect: () => Promise<void>;
  /** Signs in to Google again: after the hourly token expired, or when access was revoked (needs a click). */
  reauthorize: () => Promise<void>;
  syncNow: () => Promise<void>;
  disconnect: (removeImported: boolean) => Promise<void>;
  setSelected: (calendarIds: string[]) => Promise<void>;
  setTarget: (calendarId: string) => Promise<void>;
  /** Marks all future Plano events without a Google link to be sent. */
  pushExisting: () => Promise<number>;
}

const Ctx = createContext<GoogleSyncValue | null>(null);

function toInfo(c: { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; accessRole: string }): ExternalCalendarInfo {
  return {
    id: c.id,
    name: c.summaryOverride || c.summary,
    color: c.backgroundColor,
    primary: !!c.primary,
    writable: c.accessRole === 'owner' || c.accessRole === 'writer',
  };
}

export function GoogleSyncProvider({ children }: { children: ReactNode }) {
  const { data, repos, backendKind } = useData();
  const state = data.integrations[GCAL_KEY] as IntegrationState | undefined;
  const connected = state?.status === 'connected';
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(() => !!getStoredToken());
  // With the token server a stored grant is enough: fresh access tokens are fetched on demand.
  const canSync = hasToken || (usesTokenServer && !!state?.grant);

  // Always read the latest data inside async sync runs.
  const dataRef = useRef(data);
  dataRef.current = data;
  const busy = useRef(false);
  const again = useRef(false);

  const pending = useMemo(
    () => Object.values(data.events).filter((e) => e.syncPending).length + Object.keys(state?.pendingDeletes ?? {}).length,
    [data.events, state?.pendingDeletes],
  );

  const writeState = useCallback(
    (patch: Partial<IntegrationState>) => {
      const current = (dataRef.current.integrations[GCAL_KEY] as IntegrationState | undefined) ?? { provider: 'google_calendar', status: 'not_connected' };
      return repos.integrations.set(GCAL_KEY, stripUndefined({ ...current, ...patch, provider: 'google_calendar' }) as IntegrationState);
    },
    [repos],
  );

  /** A valid access token: the cached one, or a fresh one from the token server. */
  const ensureToken = useCallback(async (): Promise<string | null> => {
    const cached = getStoredToken();
    if (cached) return cached;
    const grant = (dataRef.current.integrations[GCAL_KEY] as IntegrationState | undefined)?.grant;
    if (!usesTokenServer || !grant) return null;
    const r = await refreshAccess(grant);
    storeToken(r.accessToken, r.expiresIn);
    return r.accessToken;
  }, []);

  const runSync = useCallback(async () => {
    const st = dataRef.current.integrations[GCAL_KEY] as IntegrationState | undefined;
    if (st?.status !== 'connected') return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setRunning(true);
    setError(null);
    try {
      let token = await ensureToken();
      setHasToken(!!token);
      if (!token) return;
      // 1. Calendars. A token can be revoked before it expires: drop it and, with the token server, get a new one once.
      let rawCalendars;
      try {
        rawCalendars = await listCalendars(token);
      } catch (err) {
        if (!(err instanceof GoogleApiError && err.needsAuth) || !usesTokenServer) throw err;
        clearStoredToken();
        token = await ensureToken();
        if (!token) return;
        rawCalendars = await listCalendars(token);
      }
      const calendars = rawCalendars.map(toInfo);
      const calById = new Map(calendars.map((c) => [c.id, c]));
      const selected = (st.calendarIds ?? []).filter((id) => calById.has(id));
      const target = st.targetCalendarId && calById.get(st.targetCalendarId)?.writable ? st.targetCalendarId : undefined;
      const tz = deviceTimeZone();
      const now = nowIso();

      // 2. Deletions made in Plano
      const pendingDeletes = { ...(st.pendingDeletes ?? {}) };
      for (const [localId, ref] of Object.entries(pendingDeletes)) {
        if (calById.get(ref.calendarId)?.writable !== false) await deleteEvent(token, ref.calendarId, ref.eventId);
        delete pendingDeletes[localId];
        await repos.batch('Google Calendar', { [`integrations/${GCAL_KEY}/pendingDeletes/${localId}`]: null });
      }

      // 3. Local changes → Google. Results are also kept in `overrides`, so the
      // pull below sees the new Google links even before React re-renders.
      const overrides = new Map<string, CalendarEvent | null>();
      for (const e of Object.values(dataRef.current.events).filter((x) => x.syncPending)) {
        if (e.external && calById.get(e.external.calendarId)?.writable === false) {
          // Read-only calendar: drop the local change, the pull below restores Google's version.
          await repos.events.update(e.id, { syncPending: false });
          continue;
        }
        const body = toGoogle(e, e.timezone || tz);
        if (e.source === 'google') delete body.recurrence; // instances of Google series keep their own rules
        try {
          if (e.external) {
            const saved = await updateEvent(token, e.external.calendarId, e.external.eventId, body);
            const external = { ...e.external, etag: saved.etag, lastSyncedAt: now };
            overrides.set(e.id, { ...e, syncPending: false, external });
            await repos.events.update(e.id, { syncPending: false, external });
          } else if (target) {
            const gid = googleIdForLocal(e.id);
            let saved;
            try {
              saved = await insertEvent(token, target, { ...body, id: gid });
            } catch (err) {
              // Created earlier (e.g. by another device) — update it instead.
              if (err instanceof GoogleApiError && err.status === 409) {
                await getEvent(token, target, gid);
                saved = await updateEvent(token, target, gid, body);
              } else throw err;
            }
            const external = { provider: 'google' as const, calendarId: target, eventId: gid, etag: saved.etag, color: calById.get(target)?.color, lastSyncedAt: now };
            overrides.set(e.id, { ...e, syncPending: false, external });
            await repos.events.update(e.id, { syncPending: false, external });
          } else {
            await repos.events.update(e.id, { syncPending: false });
          }
        } catch (err) {
          if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410) && e.external) {
            // Deleted in Google meanwhile: an imported event follows Google; a Plano event is re-created.
            if (e.source === 'google') {
              overrides.set(e.id, null);
              await repos.events.remove(e.id);
            } else {
              overrides.set(e.id, { ...e, external: undefined, syncPending: true });
              await repos.events.update(e.id, { external: undefined, syncPending: true });
            }
          } else throw err;
        }
      }

      // 4. Google → Plano
      const today = todayKey();
      const window = { start: addDaysKey(today, -PAST_DAYS), end: addDaysKey(today, FUTURE_DAYS) };
      const timeMin = fromDateKey(window.start).toISOString();
      const timeMax = fromDateKey(addDaysKey(window.end, 1)).toISOString();
      const remote = [];
      for (const calendarId of selected) {
        remote.push({ calendarId, color: calById.get(calendarId)?.color, events: await listEvents(token, calendarId, timeMin, timeMax) });
      }
      const plan = planPull({
        local: Object.values(dataRef.current.events)
          .map((e) => (overrides.has(e.id) ? overrides.get(e.id)! : e))
          .filter((e): e is CalendarEvent => e !== null),
        remote,
        selected,
        window,
        pendingDeleteKeys: new Set(Object.values(pendingDeletes).map((r) => externalKey(r.calendarId, r.eventId))),
        now,
      });
      if (plan.upserts.length || plan.deletes.length) {
        const values: Record<string, unknown> = {};
        for (const ev of plan.upserts) values[`events/${ev.id}`] = stripUndefined(ev);
        for (const id of plan.deletes) values[`events/${id}`] = null;
        await repos.batch('Google Calendar', values);
      }

      await writeState({ calendars, calendarIds: selected, targetCalendarId: target, lastSyncAt: nowIso(), lastError: undefined, status: 'connected' });
    } catch (err) {
      if (err instanceof GoogleApiError && err.needsAuth) {
        clearStoredToken();
        setHasToken(false);
      } else if (err instanceof TokenServerError && err.code === 'invalid_grant') {
        // Access was revoked in the Google account (or expired): ask to connect again.
        clearStoredToken();
        setHasToken(false);
        await writeState({ grant: undefined }).catch(() => undefined);
      } else {
        const message = err instanceof Error ? err.message : describeError(err);
        setError(message);
        await writeState({ lastError: message }).catch(() => undefined);
      }
    } finally {
      busy.current = false;
      setRunning(false);
      if (again.current) {
        again.current = false;
        void runSync();
      }
    }
  }, [repos, writeState, ensureToken]);

  // Sync on start, on a timer, when the app returns to the foreground and
  // shortly after local changes.
  useEffect(() => {
    if (!connected || !canSync || backendKind !== 'firebase') return;
    void runSync();
    const id = setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void runSync();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connected, canSync, backendKind, runSync]);

  useEffect(() => {
    if (!connected || !canSync || pending === 0) return;
    const t = setTimeout(() => void runSync(), 1500);
    return () => clearTimeout(t);
  }, [pending, connected, canSync, runSync]);

  /** Google sign-in popup → access token (and, with the token server, a lasting grant). */
  const signIn = useCallback(async (): Promise<{ token: string; grant?: string }> => {
    if (usesTokenServer) {
      const r = await exchangeCode(await requestGoogleCode());
      storeToken(r.accessToken, r.expiresIn);
      return { token: r.accessToken, grant: r.grant };
    }
    return { token: await requestGoogleToken({ consent: true }) };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const { token, grant } = await signIn();
    setHasToken(true);
    const calendars = (await listCalendars(token)).map(toInfo);
    const primary = calendars.find((c) => c.primary) ?? calendars.find((c) => c.writable);
    await writeState({
      status: 'connected',
      calendars,
      calendarIds: primary ? [primary.id] : [],
      targetCalendarId: primary?.writable ? primary.id : undefined,
      lastError: undefined,
      grant,
    });
  }, [writeState, signIn]);

  const reauthorize = useCallback(async () => {
    setError(null);
    if (usesTokenServer) {
      const { grant } = await signIn();
      await writeState({ grant, lastError: undefined });
    } else await requestGoogleToken({ consent: false });
    setHasToken(true);
  }, [signIn, writeState]);

  const disconnect = useCallback(
    async (removeImported: boolean) => {
      const grant = (dataRef.current.integrations[GCAL_KEY] as IntegrationState | undefined)?.grant;
      if (grant) await revokeGrant(grant).catch(() => undefined);
      const values: Record<string, unknown> = {
        [`integrations/${GCAL_KEY}`]: { provider: 'google_calendar', status: 'not_connected' },
      };
      for (const e of Object.values(dataRef.current.events)) {
        if (e.source === 'google' && removeImported) values[`events/${e.id}`] = null;
        else if (e.external || e.syncPending) {
          // Plano events keep their content; the link to Google is dropped.
          values[`events/${e.id}/external`] = null;
          values[`events/${e.id}/syncPending`] = null;
          if (e.source === 'google') values[`events/${e.id}/source`] = 'plano';
        }
      }
      await repos.batch('Google Calendar', values);
      await revokeGoogleToken();
      setHasToken(false);
      setError(null);
    },
    [repos],
  );

  const setSelected = useCallback(async (calendarIds: string[]) => {
    await writeState({ calendarIds });
    void runSync();
  }, [writeState, runSync]);

  const setTarget = useCallback((calendarId: string) => writeState({ targetCalendarId: calendarId }), [writeState]);

  const pushExisting = useCallback(async () => {
    const today = todayKey();
    const values: Record<string, unknown> = {};
    for (const e of Object.values(dataRef.current.events) as CalendarEvent[]) {
      const relevant = e.recurrence ? !e.recurrence.until || e.recurrence.until >= today : (e.endDate ?? e.date) >= today;
      if (e.source === 'plano' && !e.external && !e.syncPending && relevant) values[`events/${e.id}/syncPending`] = true;
    }
    const n = Object.keys(values).length;
    if (n) await repos.batch('Google Calendar', values);
    return n;
  }, [repos]);

  const phase: GoogleSyncPhase = !isGoogleConfigured || backendKind !== 'firebase'
    ? 'unavailable'
    : !connected
      ? 'off'
      : !canSync
        ? 'needs_auth'
        : running
          ? 'syncing'
          : error
            ? 'error'
            : 'idle';

  const value = useMemo<GoogleSyncValue>(
    () => ({ phase, state, error, pending, connect, reauthorize, syncNow: runSync, disconnect, setSelected, setTarget, pushExisting }),
    [phase, state, error, pending, connect, reauthorize, runSync, disconnect, setSelected, setTarget, pushExisting],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGoogleSync() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGoogleSync must be used inside GoogleSyncProvider');
  return ctx;
}
