import type { CalendarIntegrationProvider } from './types';

/**
 * Google Calendar provider — NOT IMPLEMENTED YET.
 *
 * Plano is a static site on GitHub Pages, so it cannot keep OAuth client
 * secrets or refresh tokens safely in the browser. A real integration needs a
 * server component (e.g. Firebase Cloud Functions) that performs the OAuth 2.0
 * code exchange, stores refresh tokens server-side and runs incremental sync
 * with syncTokens. See docs/google-calendar.md for the plan.
 *
 * Every method throws so nothing can pretend to be connected.
 */
const notImplemented = () => Promise.reject(new Error('Google Calendar integration is not available yet.'));

export const googleCalendarProvider: CalendarIntegrationProvider = {
  id: 'google_calendar',
  name: 'Google Calendar',
  availability: () => ({
    available: false,
    reason: 'Requires a server component for OAuth and sync (planned). See docs/google-calendar.md.',
  }),
  connect: notImplemented,
  disconnect: notImplemented,
  listCalendars: notImplemented,
  pull: notImplemented,
  push: notImplemented,
  remove: notImplemented,
};
