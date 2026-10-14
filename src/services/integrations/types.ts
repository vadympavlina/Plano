import type { CalendarEvent, ExternalEventRef, ISODateTime } from '@/types';

/**
 * Contract for external calendar providers (Google Calendar first).
 * Plano's own events never depend on a provider: imported events are stored
 * as regular CalendarEvents with `source` set to the provider and an
 * `external` reference (calendar id + event id + etag) used to de-duplicate
 * and to apply updates/cancellations.
 */
export interface ExternalCalendar {
  id: string;
  name: string;
  color?: string;
  primary?: boolean;
}

export interface SyncResult {
  imported: number;
  updated: number;
  removed: number;
  /** Provider cursor for incremental sync (Google: nextSyncToken). */
  syncToken?: string;
  finishedAt: ISODateTime;
}

export type IntegrationAvailability =
  | { available: true }
  | { available: false; reason: string };

export interface CalendarIntegrationProvider {
  readonly id: 'google_calendar';
  readonly name: string;
  availability(): IntegrationAvailability;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listCalendars(): Promise<ExternalCalendar[]>;
  /** Pulls changes from the selected calendars and upserts them into Plano. */
  pull(calendarIds: string[], syncToken?: string): Promise<SyncResult>;
  /** Pushes a Plano event to the provider and returns its external reference. */
  push(event: CalendarEvent, calendarId: string): Promise<ExternalEventRef>;
  remove(ref: ExternalEventRef): Promise<void>;
}

/** Stable key used to detect duplicates of an external event. */
export function externalKey(ref: Pick<ExternalEventRef, 'provider' | 'calendarId' | 'eventId'>): string {
  return `${ref.provider}:${ref.calendarId}:${ref.eventId}`;
}
