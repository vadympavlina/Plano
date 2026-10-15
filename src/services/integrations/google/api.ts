import type { GEvent, GEventInput } from './mapping';

const BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(message);
  }
  get needsAuth() {
    return this.status === 401;
  }
}

function describe(status: number, reason?: string, message?: string): string {
  if (status === 401) return 'Доступ до Google Calendar закінчився. Увійдіть у Google ще раз.';
  if (reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED')
    return 'Google Calendar API не ввімкнено в проєкті Google Cloud, де створено Client ID.';
  if (status === 403) return message || 'Google відмовив у доступі до календаря.';
  if (status === 429) return 'Забагато запитів до Google. Спробуйте трохи пізніше.';
  if (status >= 500) return 'Google Calendar тимчасово недоступний.';
  return message || `Помилка Google Calendar (${status}).`;
}

async function request<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GoogleApiError('Немає з’єднання з Google Calendar.', 0);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[]; status?: string } };
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason ?? data.error?.status;
    throw new GoogleApiError(describe(res.status, reason, data.error?.message), res.status, reason);
  }
  return data as T;
}

export interface GCalendar {
  id: string;
  summary: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
}

export async function listCalendars(token: string): Promise<GCalendar[]> {
  const out: GCalendar[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({ maxResults: '250', ...(pageToken ? { pageToken } : {}) });
    const r = await request<{ items?: GCalendar[]; nextPageToken?: string }>(token, 'GET', `/users/me/calendarList?${q}`);
    out.push(...(r.items ?? []));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}

const cal = (id: string) => `/calendars/${encodeURIComponent(id)}`;

/** All event instances (recurring series expanded) between two instants. */
export async function listEvents(token: string, calendarId: string, timeMin: string, timeMax: string): Promise<GEvent[]> {
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      singleEvents: 'true',
      timeMin,
      timeMax,
      maxResults: '2500',
      ...(pageToken ? { pageToken } : {}),
    });
    const r = await request<{ items?: GEvent[]; nextPageToken?: string }>(token, 'GET', `${cal(calendarId)}/events?${q}`);
    out.push(...(r.items ?? []));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}

export const insertEvent = (token: string, calendarId: string, body: GEventInput) =>
  request<GEvent>(token, 'POST', `${cal(calendarId)}/events`, body);

export const getEvent = (token: string, calendarId: string, eventId: string) =>
  request<GEvent>(token, 'GET', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`);

export const updateEvent = (token: string, calendarId: string, eventId: string, body: GEventInput) =>
  request<GEvent>(token, 'PATCH', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, body);

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await request<void>(token, 'DELETE', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`);
  } catch (e) {
    // Already gone — that is the desired end state.
    if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}
