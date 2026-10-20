// Domain types for Plano. All dates are stored as local wall-clock values:
// dates as "yyyy-MM-dd" keys and times as "HH:mm". Timestamps (createdAt etc.)
// are ISO-8601 strings.

export type ID = string;
export type DateKey = string; // yyyy-MM-dd
export type TimeString = string; // HH:mm
export type ISODateTime = string;

export const COLOR_KEYS = ['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'yellow', 'red', 'slate'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export interface Timestamps {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Repeat every N units (days / weeks / months / years). */
  interval: number;
  /** Weekly only: 0 = Sunday … 6 = Saturday. Empty means "same weekday as start". */
  byWeekday?: number[];
  /** Last date (inclusive) on which the rule may produce an occurrence. */
  until?: DateKey;
}

export interface Category extends Timestamps {
  id: ID;
  name: string;
  color: ColorKey;
  order: number;
  /** Emoji shown before the name in lists and on calendar items. */
  icon?: string;
}

export const TASK_STATUSES = ['todo', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
  order: number;
}

export interface Task extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  categoryId?: ID;
  projectId?: ID;
  goalId?: ID;
  dueDate?: DateKey;
  startDate?: DateKey;
  startTime?: TimeString;
  endTime?: TimeString;
  /** Push reminder minutes before the start (0 = none, missing = settings default). */
  remindMin?: number;
  subtasks: Subtask[];
  notes?: string;
  tags: string[];
  recurrence?: RecurrenceRule;
  /** Id of the first task of a recurring series (absent on the first one). */
  seriesId?: ID;
  /** First date of the recurring series (absent on the first task). */
  seriesStart?: DateKey;
  completedAt?: ISODateTime;
}

export type EventSource = 'plano' | 'google';

/** Link between a Plano event and an event in an external calendar. */
export interface ExternalEventRef {
  provider: 'google';
  calendarId: string;
  eventId: string;
  etag?: string;
  lastSyncedAt?: ISODateTime;
  /** Colour of the source calendar (hex), used when the event has no category. */
  color?: string;
}

export interface CalendarEvent extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  date: DateKey;
  /** All-day events may span several days. */
  endDate?: DateKey;
  allDay: boolean;
  startTime?: TimeString;
  endTime?: TimeString;
  categoryId?: ID;
  projectId?: ID;
  location?: string;
  url?: string;
  /** Push reminder minutes before (0 = none, missing = settings default). */
  remindMin?: number;
  recurrence?: RecurrenceRule;
  /** Occurrence dates removed from a recurring series. */
  exdates: DateKey[];
  /** IANA time zone the event was created in (informational). */
  timezone?: string;
  source: EventSource;
  external?: ExternalEventRef;
  /** Local change not yet sent to the external calendar. */
  syncPending?: boolean;
}

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Project extends Timestamps {
  id: ID;
  name: string;
  description?: string;
  color: ColorKey;
  status: ProjectStatus;
  startDate?: DateKey;
  targetDate?: DateKey;
  /** Emoji shown instead of the folder icon. */
  icon?: string;
  /** Colour of the cover band on the project page; none when empty. */
  cover?: ColorKey;
}

export type HabitGoalType = 'check' | 'count';

export interface Habit extends Timestamps {
  id: ID;
  name: string;
  icon: string;
  color: ColorKey;
  /** Weekdays (0 = Sunday … 6 = Saturday) on which the habit is scheduled. */
  schedule: number[];
  startDate: DateKey;
  goalType: HabitGoalType;
  /** For "count" habits: the value that counts as done for a day. */
  target: number;
  unit?: string;
  archived: boolean;
  /**
   * "bad" — a habit to quit: logs are slips, a day is clean while it stays within
   * the limit (0 for check habits, `target` for count habits). Missing = "good".
   */
  kind?: 'good' | 'bad';
  /** Push reminder times ("HH:mm") on scheduled days while the habit isn't done. */
  remindAt?: string[];
  /** Bad habits: first day actually tracked (days before it are "no data", not clean). */
  trackFrom?: DateKey;
  /** Breaks (illness, holiday): paused days don't count and never break a streak. Open-ended without `to`. */
  pauses?: { from: DateKey; to?: DateKey }[];
  /** A short note per day: why it slipped, how it felt. */
  dayNotes?: Record<DateKey, string>;
}

/** habitLogs/{habitId}/{dateKey} = value (1 for a check habit). */
export type HabitLogs = Record<ID, Record<DateKey, number>>;

export const GOAL_STATUSES = ['active', 'completed', 'paused', 'abandoned'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface GoalProgressEntry {
  id: ID;
  date: ISODateTime;
  value: number;
  note?: string;
}

export interface Goal extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  categoryId?: ID;
  targetValue: number;
  currentValue: number;
  unit?: string;
  startDate?: DateKey;
  targetDate?: DateKey;
  status: GoalStatus;
  projectIds: ID[];
  history: GoalProgressEntry[];
}

export interface Note extends Timestamps {
  id: ID;
  title: string;
  content: string;
  tags: string[];
  projectId?: ID;
  isPinned: boolean;
  /** Emoji shown next to the title. */
  icon?: string;
  /** Colour of the cover band; no cover when empty. */
  cover?: ColorKey;
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type CalendarView = 'day' | 'week' | 'month';

export interface Settings {
  theme: ThemePreference;
  weekStartsOn: 0 | 1;
  timeFormat: '12h' | '24h';
  dateFormat: 'd MMMM yyyy' | 'd MMM yyyy' | 'dd.MM.yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';
  defaultCalendarView: CalendarView;
  /** Overrides the device time zone for display of "now"; empty = device. */
  timezone?: string;
  showHabitStreakOnDashboard: boolean;
  /** Push reminders: minutes before timed events (0 = off). */
  remindEventsMin: number;
  /** Push reminders at the start time of timed tasks. */
  remindTasks: boolean;
  /** "HH:mm" for the evening habits nudge, '' = off. */
  habitsReminderAt: string;
  /** "HH:mm" for the morning summary, '' = off. */
  digestAt: string;
  /** "HH:mm" for the evening summary (done / left, move the rest to tomorrow), '' = off. */
  eveningAt: string;
  /** Accent colour of buttons, links, today markers. */
  accent: AccentColor;
}

export const ACCENT_COLORS = ['blue', 'violet', 'green', 'orange', 'pink'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export interface Profile {
  displayName?: string;
  avatarUrl?: string;
  updatedAt?: ISODateTime;
}

export type IntegrationStatus = 'not_connected' | 'connected' | 'error';

export interface ExternalCalendarInfo {
  id: string;
  name: string;
  color?: string;
  primary?: boolean;
  /** Google access role: owner / writer can receive events from Plano. */
  writable: boolean;
}

export interface PendingExternalDelete {
  calendarId: string;
  eventId: string;
}

export interface IntegrationState {
  provider: 'google_calendar';
  status: IntegrationStatus;
  /** Calendars selected for sync (external calendar ids). */
  calendarIds?: string[];
  /** Calendar that receives events created in Plano. */
  targetCalendarId?: string;
  /** Calendars seen at the last sync. */
  calendars?: ExternalCalendarInfo[];
  /** Deletions made in Plano that still have to be sent (keyed by local event id). */
  pendingDeletes?: Record<string, PendingExternalDelete>;
  lastSyncAt?: ISODateTime;
  lastError?: string;
  /** Google sync tokens per calendar (incremental fetches). */
  syncTokens?: { calendarId: string; token: string }[];
  /** Last full fetch of the window. */
  fullSyncAt?: ISODateTime;
  /** Google refresh token encrypted by the Plano token server; only that server can use it. */
  grant?: string;
}

export interface UserData {
  profile: Profile;
  settings: Settings;
  categories: Record<ID, Category>;
  tasks: Record<ID, Task>;
  events: Record<ID, CalendarEvent>;
  projects: Record<ID, Project>;
  habits: Record<ID, Habit>;
  habitLogs: HabitLogs;
  goals: Record<ID, Goal>;
  notes: Record<ID, Note>;
  integrations: Record<string, IntegrationState>;
}

export type CollectionName = 'categories' | 'tasks' | 'events' | 'projects' | 'habits' | 'goals' | 'notes';
