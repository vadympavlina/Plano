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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ключ запису «${key}» не збігається з його id`, path: [key] });
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

/** Ukrainian messages for import validation errors. */
const ukErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === 'undefined' ? 'Обов’язкове поле відсутнє' : `Неправильний тип: очікується ${issue.expected}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Недопустиме значення (дозволено: ${issue.options.join(', ')})` };
    case z.ZodIssueCode.invalid_literal:
      return { message: 'Це не файл експорту Plano' };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Невідомі поля: ${issue.keys.join(', ')}` };
    case z.ZodIssueCode.too_small:
      return { message: 'Значення закоротке або замале' };
    case z.ZodIssueCode.too_big:
      return { message: 'Значення задовге або завелике' };
    case z.ZodIssueCode.invalid_string:
      return { message: 'Неправильний формат рядка' };
    default:
      return { message: ctx.defaultError };
  }
};

export type ImportResult =
  | { ok: true; file: ExportFile; summary: Record<string, number> }
  | { ok: false; errors: string[] };

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export function validateImport(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errors: ['Файл завеликий (максимум 20 МБ).'] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Файл не є коректним JSON.'] };
  }
  const parsed = importSchema.safeParse(json, { errorMap: ukErrorMap });
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(корінь)'}: ${i.message}`),
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
