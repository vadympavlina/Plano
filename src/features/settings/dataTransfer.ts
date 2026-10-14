import { z } from 'zod';
import {
  categorySchema,
  eventSchema,
  goalSchema,
  habitLogsSchema,
  habitSchema,
  integrationSchema,
  noteSchema,
  profileSchema,
  projectSchema,
  settingsSchema,
  taskSchema,
} from '@/lib/validation/schemas';
import { stripUndefined } from '@/lib/validation/parse';
import type { UserData } from '@/types';

export const EXPORT_FORMAT = 'plano-export';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  data: UserData;
}

export function buildExport(data: UserData, now = new Date()): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    data: stripUndefined(data),
  };
}

const keyed = <T extends z.ZodTypeAny>(schema: T) =>
  z.record(z.string(), schema).superRefine((rec, ctx) => {
    for (const [key, value] of Object.entries(rec)) {
      if ((value as { id?: string })?.id !== key) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Record key "${key}" does not match its id`, path: [key] });
      }
    }
  });

const importSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number().int().min(1).max(EXPORT_VERSION),
  exportedAt: z.string(),
  data: z
    .object({
      profile: profileSchema.default({}),
      settings: settingsSchema.partial().default({}),
      categories: keyed(categorySchema).default({}),
      tasks: keyed(taskSchema).default({}),
      events: keyed(eventSchema).default({}),
      projects: keyed(projectSchema).default({}),
      habits: keyed(habitSchema).default({}),
      habitLogs: habitLogsSchema.default({}),
      goals: keyed(goalSchema).default({}),
      notes: keyed(noteSchema).default({}),
      integrations: z.record(z.string(), integrationSchema).default({}),
    })
    .strict(),
});

export type ImportResult =
  | { ok: true; file: ExportFile; summary: Record<string, number> }
  | { ok: false; errors: string[] };

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export function validateImport(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errors: ['File is too large (max 20 MB).'] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const data = parsed.data.data as unknown as UserData;
  const summary = {
    categories: Object.keys(data.categories).length,
    tasks: Object.keys(data.tasks).length,
    events: Object.keys(data.events).length,
    projects: Object.keys(data.projects).length,
    habits: Object.keys(data.habits).length,
    goals: Object.keys(data.goals).length,
    notes: Object.keys(data.notes).length,
  };
  return { ok: true, file: { ...parsed.data, format: EXPORT_FORMAT, data }, summary };
}
