import { z } from 'zod';
import {
  COLOR_KEYS,
  GOAL_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  ACCENT_COLORS,
} from '@/types';

// Firebase Realtime Database does not store empty arrays and may return arrays
// as objects with numeric keys. These helpers normalise that on read.
const arrayish = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v.filter((x) => x != null);
    if (typeof v === 'object') return Object.values(v as object).filter((x) => x != null);
    return v;
  }, z.array(item));

const optionalString = z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional());

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Очікується дата у форматі yyyy-MM-dd');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Очікується час у форматі HH:mm');
const optionalDateKey = z.preprocess((v) => (v === null || v === '' ? undefined : v), dateKeySchema.optional());
const optionalTime = z.preprocess((v) => (v === null || v === '' ? undefined : v), timeSchema.optional());
const isoSchema = z.string().min(1);

const timestamps = {
  createdAt: isoSchema,
  updatedAt: isoSchema,
};

export const colorSchema = z.enum(COLOR_KEYS).catch('blue');

export const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(365),
  byWeekday: arrayish(z.number().int().min(0).max(6)).optional(),
  until: optionalDateKey,
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  color: colorSchema,
  order: z.number().default(0),
  ...timestamps,
});

export const subtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(300),
  done: z.boolean().default(false),
  order: z.number().default(0),
});

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  description: optionalString,
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  categoryId: optionalString,
  projectId: optionalString,
  goalId: optionalString,
  dueDate: optionalDateKey,
  startDate: optionalDateKey,
  startTime: optionalTime,
  endTime: optionalTime,
  remindMin: z.number().int().min(0).max(20160).optional().catch(undefined),
  subtasks: arrayish(subtaskSchema),
  notes: optionalString,
  tags: arrayish(z.string()),
  recurrence: recurrenceSchema.optional(),
  seriesId: optionalString,
  seriesStart: optionalDateKey,
  completedAt: optionalString,
  ...timestamps,
});

export const externalRefSchema = z.object({
  provider: z.literal('google'),
  calendarId: z.string(),
  eventId: z.string(),
  etag: optionalString,
  lastSyncedAt: optionalString,
  color: optionalString,
});

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  description: optionalString,
  date: dateKeySchema,
  endDate: optionalDateKey,
  allDay: z.boolean().default(false),
  startTime: optionalTime,
  endTime: optionalTime,
  categoryId: optionalString,
  projectId: optionalString,
  location: optionalString,
  url: optionalString,
  remindMin: z.number().int().min(0).max(20160).optional().catch(undefined),
  recurrence: recurrenceSchema.optional(),
  exdates: arrayish(dateKeySchema),
  timezone: optionalString,
  source: z.enum(['plano', 'google']).default('plano'),
  external: externalRefSchema.optional(),
  syncPending: z.boolean().optional(),
  ...timestamps,
});

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: optionalString,
  color: colorSchema,
  status: z.enum(PROJECT_STATUSES),
  startDate: optionalDateKey,
  targetDate: optionalDateKey,
  icon: z.string().max(16).optional().catch(undefined),
  cover: z.enum(COLOR_KEYS).optional().catch(undefined),
  ...timestamps,
});

export const habitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  icon: z.string().max(16).default('✓'),
  color: colorSchema,
  schedule: arrayish(z.number().int().min(0).max(6)),
  startDate: dateKeySchema,
  goalType: z.enum(['check', 'count']),
  target: z.number().min(1).default(1),
  kind: z.enum(['good', 'bad']).optional().catch(undefined),
  trackFrom: dateKeySchema.optional().catch(undefined),
  remindAt: arrayish(z.string().regex(/^\d\d:\d\d$/)).optional().catch(undefined),
  pauses: arrayish(z.object({ from: dateKeySchema, to: optionalDateKey })).optional().catch(undefined),
  dayNotes: z.record(dateKeySchema, z.string().max(1000)).optional().catch(undefined),
  unit: optionalString,
  archived: z.boolean().default(false),
  ...timestamps,
});

export const habitLogsSchema = z.record(z.string(), z.record(dateKeySchema, z.number().min(0)));

export const goalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: optionalString,
  categoryId: optionalString,
  targetValue: z.number().positive(),
  currentValue: z.number().min(0),
  unit: optionalString,
  startDate: optionalDateKey,
  targetDate: optionalDateKey,
  status: z.enum(GOAL_STATUSES),
  projectIds: arrayish(z.string()),
  history: arrayish(
    z.object({
      id: z.string(),
      date: isoSchema,
      value: z.number(),
      note: optionalString,
    }),
  ),
  ...timestamps,
});

export const noteSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(300).default(''),
  content: z.string().max(200_000).default(''),
  tags: arrayish(z.string()),
  projectId: optionalString,
  isPinned: z.boolean().default(false),
  icon: z.string().max(16).optional().catch(undefined),
  cover: z.enum(COLOR_KEYS).optional().catch(undefined),
  ...timestamps,
});

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).catch('light'),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).catch(1),
  timeFormat: z.enum(['12h', '24h']).catch('24h'),
  dateFormat: z.enum(['d MMMM yyyy', 'd MMM yyyy', 'dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']).catch('d MMM yyyy'),
  defaultCalendarView: z.enum(['day', 'week', 'month']).catch('week'),
  timezone: optionalString,
  showHabitStreakOnDashboard: z.boolean().catch(true),
  remindEventsMin: z.number().int().min(0).max(1440).catch(15),
  remindTasks: z.boolean().catch(true),
  habitsReminderAt: z.string().regex(/^(\d\d:\d\d)?$/).catch('21:00'),
  digestAt: z.string().regex(/^(\d\d:\d\d)?$/).catch('08:00'),
  accent: z.enum(ACCENT_COLORS).catch('blue'),
});

export const profileSchema = z.object({
  displayName: optionalString,
  avatarUrl: optionalString,
  updatedAt: optionalString,
});

export const integrationSchema = z.object({
  provider: z.literal('google_calendar'),
  status: z.enum(['not_connected', 'connected', 'error']),
  calendarIds: arrayish(z.string()).optional(),
  targetCalendarId: optionalString,
  calendars: arrayish(
    z.object({
      id: z.string(),
      name: z.string(),
      color: optionalString,
      primary: z.boolean().optional(),
      writable: z.boolean().default(false),
    }),
  ).optional(),
  pendingDeletes: z.record(z.string(), z.object({ calendarId: z.string(), eventId: z.string() })).optional(),
  lastSyncAt: optionalString,
  lastError: optionalString,
  grant: optionalString,
  syncTokens: arrayish(z.object({ calendarId: z.string(), token: z.string() })).optional(),
  fullSyncAt: optionalString,
});

export const collectionSchemas = {
  categories: categorySchema,
  tasks: taskSchema,
  events: eventSchema,
  projects: projectSchema,
  habits: habitSchema,
  goals: goalSchema,
  notes: noteSchema,
} as const;
