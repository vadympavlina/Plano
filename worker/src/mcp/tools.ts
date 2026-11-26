/**
 * The tools Plano offers to an AI assistant over MCP. They do what the app does: the same quick-capture parser, the same
 * completion rules for recurring tasks, the same checks (the app's zod schemas) before anything is written.
 */
import { z } from 'zod';
import { parseQuick, sameName } from '../../../src/features/capture/parse';
import { completionPatch, nextRecurringInstance } from '../../../src/features/tasks/logic';
import { expandEvents } from '../../../src/features/calendar/logic';
import { addDaysKey, minutesToTime, timeToMinutes } from '../../../src/lib/date';
import { categorySchema, eventSchema, habitSchema, noteSchema, projectSchema, taskSchema } from '../../../src/lib/validation/schemas';
import type { CalendarEvent, Category, Habit, Note, Project, Task } from '../../../src/types';
import type { Db } from './rtdb';

export interface Ctx {
  db: Db;
  /** Time zone of the owner (where «today» is). */
  tz: string;
  now: () => Date;
}

export interface ToolResult {
  [key: string]: unknown;
}
export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: false };
  run: (args: Record<string, unknown>, ctx: Ctx) => Promise<ToolResult>;
}

/** A problem to tell the assistant about (not a crash): it can fix the call and try again. */
export class ToolError extends Error {}

// ---- reading -------------------------------------------------------------------------------------------------

async function readAll<T>(db: Db, path: string, schema: z.ZodType<T>): Promise<T[]> {
  const raw = (await db.get<Record<string, unknown>>(path)) ?? {};
  const out: T[] = [];
  for (const [id, value] of Object.entries(raw)) {
    const r = schema.safeParse({ ...(value as object), id });
    if (r.success) out.push(r.data);
  }
  return out;
}
const loadTasks = (db: Db) => readAll<Task>(db, 'tasks', taskSchema as unknown as z.ZodType<Task>);
const loadEvents = (db: Db) => readAll<CalendarEvent>(db, 'events', eventSchema as unknown as z.ZodType<CalendarEvent>);
const loadNotes = (db: Db) => readAll<Note>(db, 'notes', noteSchema as unknown as z.ZodType<Note>);
const loadCategories = (db: Db) => readAll<Category>(db, 'categories', categorySchema as unknown as z.ZodType<Category>);
const loadProjects = (db: Db) => readAll<Project>(db, 'projects', projectSchema as unknown as z.ZodType<Project>);
const loadHabits = (db: Db) => readAll<Habit>(db, 'habits', habitSchema as unknown as z.ZodType<Habit>);

export function zonedToday(tz: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
const weekday = (date: string) => new Intl.DateTimeFormat('uk-UA', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---- argument helpers -------------------------------------------------------------------------------------------

const str = (v: unknown, name: string, required = false): string | undefined => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ToolError(`«${name}» is required`);
    return undefined;
  }
  if (typeof v !== 'string') throw new ToolError(`«${name}» must be a string`);
  return v.trim();
};
const dateArg = (v: unknown, name: string): string | undefined => {
  const s = str(v, name);
  if (s !== undefined && !DATE.test(s)) throw new ToolError(`«${name}» must be a date like 2026-11-24`);
  return s;
};
const timeArg = (v: unknown, name: string): string | undefined => {
  const s = str(v, name);
  if (s !== undefined && !TIME.test(s)) throw new ToolError(`«${name}» must be a time like 15:30`);
  return s;
};
const limitArg = (v: unknown, def = 30, max = 100) => Math.max(1, Math.min(max, typeof v === 'number' ? Math.floor(v) : def));

// ---- shapes shown to the assistant ----------------------------------------------------------------------------------

interface Lookups {
  categories: Category[];
  projects: Project[];
}
const taskView = (t: Task, l?: Lookups) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  priority: t.priority,
  date: t.dueDate ?? t.startDate ?? null,
  time: t.startTime ?? null,
  endTime: t.endTime ?? null,
  repeats: !!t.recurrence,
  category: l?.categories.find((c) => c.id === t.categoryId)?.name ?? null,
  project: l?.projects.find((p) => p.id === t.projectId)?.name ?? null,
  tags: t.tags,
  subtasks: t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : null,
  description: t.description ?? null,
});
const eventView = (e: CalendarEvent, date: string, l?: Lookups) => ({
  id: e.id,
  title: e.title,
  date,
  endDate: e.endDate ?? null,
  allDay: e.allDay,
  time: e.startTime ?? null,
  endTime: e.endTime ?? null,
  repeats: !!e.recurrence,
  location: e.location ?? null,
  category: l?.categories.find((c) => c.id === e.categoryId)?.name ?? null,
  project: l?.projects.find((p) => p.id === e.projectId)?.name ?? null,
});
const noteView = (n: Note) => ({ id: n.id, title: n.title || 'Без назви', tags: n.tags, pinned: n.isPinned, updatedAt: n.updatedAt });

const byDate = (a: Task, b: Task) =>
  (a.dueDate ?? a.startDate ?? '9999').localeCompare(b.dueDate ?? b.startDate ?? '9999') || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99');

function pickOne<T extends { id: string; title?: string; name?: string }>(items: T[], id: string | undefined, query: string | undefined, what: string): T {
  if (id) {
    const x = items.find((i) => i.id === id);
    if (!x) throw new ToolError(`No ${what} with id «${id}»`);
    return x;
  }
  if (!query) throw new ToolError(`Give the id or the title of the ${what}`);
  const q = query.toLowerCase();
  const label = (i: T) => (i.title ?? i.name ?? '').toLowerCase();
  const exact = items.filter((i) => label(i) === q);
  const found = exact.length ? exact : items.filter((i) => label(i).includes(q));
  if (found.length === 1) return found[0];
  if (!found.length) throw new ToolError(`No ${what} matches «${query}»`);
  throw new ToolError(
    `Several ${what}s match «${query}»; use one of these ids: ${found
      .slice(0, 8)
      .map((i) => `${i.id} («${i.title ?? i.name}»)`)
      .join(', ')}`,
  );
}

const googleOn = async (db: Db) => {
  const g = await db.get<{ status?: string; targetCalendarId?: string }>('integrations/google_calendar');
  return g?.status === 'connected' ? g : null;
};
const clean = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

// ---- quick add -------------------------------------------------------------------------------------------------

const endOf = (start: string, minutes: number) => minutesToTime(Math.min(timeToMinutes(start) + minutes, 23 * 60 + 59));

async function add(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const text = str(args.text, 'text', true)!;
  const forced = str(args.kind, 'kind');
  if (forced && !['task', 'event', 'note'].includes(forced)) throw new ToolError('«kind» is task, event or note');
  const today = zonedToday(ctx.tz, ctx.now());
  const [categories, projects, google] = await Promise.all([loadCategories(ctx.db), loadProjects(ctx.db), googleOn(ctx.db)]);
  const stamp = ctx.now().toISOString();
  const writes: Record<string, unknown> = {};
  const created: ToolResult[] = [];
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);

  for (const line of lines) {
    const p = parseQuick(line, today, ctx.now());
    const kind = (forced as 'task' | 'event' | 'note' | undefined) ?? p.kind ?? 'task';
    const category = p.tags.map((t) => categories.find((c) => sameName(c.name, t))).find(Boolean);
    const project = projects.find((x) => sameName(x.name, p.project ?? '') || p.tags.some((t) => sameName(x.name, t)));
    const usedTags = new Set(p.tags.filter((t) => (category && sameName(category.name, t)) || (project && sameName(project.name, t))));
    const tags = p.tags.filter((t) => !usedTags.has(t));
    const title = (p.title || line).slice(0, 300);
    const links = { categoryId: category?.id, projectId: project?.id };
    const id = ctx.db.newId();
    const end = p.endTime ?? (p.time && p.duration ? endOf(p.time, p.duration) : undefined);
    const date = p.date;

    if (kind === 'note') {
      const note = noteSchema.parse({
        id,
        title,
        content: p.description ?? '',
        tags: [],
        isPinned: false,
        projectId: project?.id,
        createdAt: stamp,
        updatedAt: stamp,
      });
      writes[`notes/${id}`] = clean(note);
      created.push({ kind: 'note', id, title });
    } else if (kind === 'event') {
      const ev = eventSchema.parse({
        id,
        title,
        date: date ?? today,
        endDate: p.endDate,
        allDay: !p.time,
        startTime: p.time,
        endTime: p.time ? (end ?? endOf(p.time, 60)) : undefined,
        recurrence: p.recurrence,
        remindMin: p.remindMin,
        description: p.description,
        ...links,
        exdates: [],
        source: 'plano',
        timezone: ctx.tz,
        // Google Calendar is connected: the app sends the new event there the next time it runs.
        ...(google?.targetCalendarId ? { syncPending: true } : {}),
        createdAt: stamp,
        updatedAt: stamp,
      });
      writes[`events/${id}`] = clean(ev);
      created.push({ kind: 'event', id, title, date: ev.date, time: ev.startTime ?? null, endTime: ev.endTime ?? null });
    } else {
      const multi = !!(date && p.endDate && p.endDate > date);
      const task = taskSchema.parse({
        id,
        title,
        status: 'todo',
        priority: p.priority ?? 'medium',
        tags,
        startDate: multi ? date : undefined,
        dueDate: multi ? p.endDate : (date ?? (p.time || p.recurrence ? today : undefined)),
        startTime: p.time,
        endTime: end,
        recurrence: p.recurrence,
        remindMin: p.remindMin,
        description: p.description,
        subtasks: (p.subtasks ?? []).map((s, order) => ({ id: `st_${Date.now().toString(36)}${order}`, title: s, done: false, order })),
        ...links,
        createdAt: stamp,
        updatedAt: stamp,
      });
      writes[`tasks/${id}`] = clean(task);
      created.push({ kind: 'task', ...taskView(task as Task, { categories, projects }) });
    }
  }
  if (!created.length) throw new ToolError('Nothing to add: the text is empty');
  await ctx.db.update(writes);
  return { added: created, today };
}

// ---- reading tools -----------------------------------------------------------------------------------------------

async function todayTool(_args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const today = zonedToday(ctx.tz, ctx.now());
  const [tasks, events, categories, projects, habits, logs] = await Promise.all([
    loadTasks(ctx.db),
    loadEvents(ctx.db),
    loadCategories(ctx.db),
    loadProjects(ctx.db),
    loadHabits(ctx.db),
    ctx.db.get<Record<string, Record<string, number>>>('habitLogs'),
  ]);
  const l = { categories, projects };
  const open = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const dateOf = (t: Task) => t.dueDate ?? t.startDate;
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return {
    date: today,
    weekday: weekday(today),
    overdue: open
      .filter((t) => dateOf(t) && dateOf(t)! < today)
      .sort(byDate)
      .map((t) => taskView(t, l)),
    tasksToday: open
      .filter((t) => dateOf(t) === today)
      .sort(byDate)
      .map((t) => taskView(t, l)),
    noDate: open
      .filter((t) => !dateOf(t))
      .slice(0, 20)
      .map((t) => taskView(t, l)),
    events: expandEvents(events, today, today).map((o) => eventView(o.event, o.date, l)),
    habits: habits
      .filter((h) => !h.archived && h.schedule.includes(dow))
      .map((h) => ({
        id: h.id,
        name: h.name,
        kind: h.kind ?? 'good',
        done: logs?.[h.id]?.[today] ?? 0,
        target: h.goalType === 'count' ? h.target : 1,
        unit: h.unit ?? null,
      })),
  };
}

async function listTasks(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const status = str(args.status, 'status') ?? 'open';
  if (!['open', 'done', 'all'].includes(status)) throw new ToolError('«status» is open, done or all');
  const from = dateArg(args.from, 'from');
  const to = dateArg(args.to, 'to');
  const query = str(args.query, 'query')?.toLowerCase();
  const project = str(args.project, 'project');
  const category = str(args.category, 'category');
  const [tasks, categories, projects] = await Promise.all([loadTasks(ctx.db), loadCategories(ctx.db), loadProjects(ctx.db)]);
  const projectId = project ? projects.find((p) => sameName(p.name, project))?.id : undefined;
  const categoryId = category ? categories.find((c) => sameName(c.name, category))?.id : undefined;
  if (project && !projectId) throw new ToolError(`No project «${project}»`);
  if (category && !categoryId) throw new ToolError(`No category «${category}»`);
  const list = tasks
    .filter((t) => (status === 'all' ? true : status === 'done' ? t.status === 'completed' : t.status !== 'completed' && t.status !== 'cancelled'))
    .filter((t) => {
      const d = t.dueDate ?? t.startDate;
      return (!from || (d && d >= from)) && (!to || (d && d <= to));
    })
    .filter((t) => !query || t.title.toLowerCase().includes(query) || (t.description ?? '').toLowerCase().includes(query))
    .filter((t) => !projectId || t.projectId === projectId)
    .filter((t) => !categoryId || t.categoryId === categoryId)
    .sort(byDate);
  const limit = limitArg(args.limit);
  return { total: list.length, tasks: list.slice(0, limit).map((t) => taskView(t, { categories, projects })) };
}

async function listEvents(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const today = zonedToday(ctx.tz, ctx.now());
  const from = dateArg(args.from, 'from') ?? today;
  const to = dateArg(args.to, 'to') ?? addDaysKey(from, 7);
  if (to < from) throw new ToolError('«to» is before «from»');
  if (addDaysKey(from, 400) < to) throw new ToolError('Ask for at most about a year at a time');
  const [events, categories, projects] = await Promise.all([loadEvents(ctx.db), loadCategories(ctx.db), loadProjects(ctx.db)]);
  const occ = expandEvents(events, from, to).slice(0, limitArg(args.limit, 60, 200));
  return { from, to, events: occ.map((o) => eventView(o.event, o.date, { categories, projects })) };
}

// ---- changing tasks ----------------------------------------------------------------------------------------------

async function setDone(args: Record<string, unknown>, ctx: Ctx, done: boolean): Promise<ToolResult> {
  const tasks = await loadTasks(ctx.db);
  const pool = tasks.filter((t) => (done ? t.status !== 'completed' && t.status !== 'cancelled' : t.status === 'completed'));
  const task = pickOne(pool, str(args.id, 'id'), str(args.title, 'title'), 'task');
  const now = ctx.now().toISOString();
  const patch = completionPatch(task, done, now);
  const values: Record<string, unknown> = {
    [`tasks/${task.id}/status`]: patch.status,
    [`tasks/${task.id}/completedAt`]: patch.completedAt ?? null,
    [`tasks/${task.id}/updatedAt`]: now,
  };
  let next: Task | null = null;
  if (done) {
    next = nextRecurringInstance(task, new Set(tasks.map((t) => t.id)), now);
    if (next) values[`tasks/${next.id}`] = clean(next);
  }
  await ctx.db.update(values);
  return {
    [done ? 'completed' : 'reopened']: { id: task.id, title: task.title },
    nextRepeat: next ? { id: next.id, date: next.dueDate ?? next.startDate ?? null } : null,
  };
}

async function updateTask(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const tasks = await loadTasks(ctx.db);
  const task = pickOne(tasks, str(args.id, 'id'), str(args.title, 'title'), 'task');
  const patch: Record<string, unknown> = {};
  const set = (key: string, v: unknown) => (patch[`tasks/${task.id}/${key}`] = v === undefined ? null : v);

  const newTitle = str(args.new_title, 'new_title');
  if (newTitle) set('title', newTitle.slice(0, 300));
  if ('date' in args) {
    const d = args.date === null ? null : dateArg(args.date, 'date');
    // The date field the task already uses moves (as in the app).
    set(task.dueDate || !task.startDate ? 'dueDate' : 'startDate', d ?? undefined);
  }
  if ('time' in args) {
    const t = args.time === null ? null : timeArg(args.time, 'time');
    set('startTime', t ?? undefined);
    if (t === null || t === undefined) set('endTime', undefined);
  }
  const priority = str(args.priority, 'priority');
  if (priority) {
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) throw new ToolError('«priority» is low, medium, high or urgent');
    set('priority', priority);
  }
  if ('description' in args) set('description', args.description === null ? undefined : str(args.description, 'description'));
  if (!Object.keys(patch).length) throw new ToolError('Nothing to change');
  patch[`tasks/${task.id}/updatedAt`] = ctx.now().toISOString();
  await ctx.db.update(patch);
  const fresh = (await loadTasks(ctx.db)).find((t) => t.id === task.id) ?? task;
  return { updated: taskView(fresh) };
}

async function deleteTask(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const id = str(args.id, 'id', true)!;
  const task = (await loadTasks(ctx.db)).find((t) => t.id === id);
  if (!task) throw new ToolError(`No task with id «${id}»`);
  await ctx.db.update({ [`tasks/${id}`]: null });
  return { deleted: { id, title: task.title } };
}

async function deleteEvent(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const id = str(args.id, 'id', true)!;
  const event = (await loadEvents(ctx.db)).find((e) => e.id === id);
  if (!event) throw new ToolError(`No event with id «${id}»`);
  const values: Record<string, unknown> = { [`events/${id}`]: null };
  // An event that lives in Google Calendar too: the app deletes it there on its next run.
  if (event.external && (await googleOn(ctx.db)))
    values[`integrations/google_calendar/pendingDeletes/${id}`] = { calendarId: event.external.calendarId, eventId: event.external.eventId };
  await ctx.db.update(values);
  return { deleted: { id, title: event.title } };
}

// ---- notes ---------------------------------------------------------------------------------------------------------

const excerpt = (text: string, q: string) => {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, 160).replace(/\s+/g, ' ');
  return text.slice(Math.max(0, i - 60), i + 120).replace(/\s+/g, ' ');
};

async function searchNotes(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const q = str(args.query, 'query')?.toLowerCase();
  const notes = (await loadNotes(ctx.db)).filter((n) => !(n as Note & { deletedAt?: string }).deletedAt);
  const found = notes
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt));
  return {
    total: found.length,
    notes: found
      .slice(0, limitArg(args.limit, 20, 50))
      .map((n) => ({ ...noteView(n), excerpt: q ? excerpt(n.content, q) : n.content.slice(0, 160).replace(/\s+/g, ' ') })),
  };
}

async function getNote(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const notes = (await loadNotes(ctx.db)).filter((n) => !(n as Note & { deletedAt?: string }).deletedAt);
  const note = pickOne(notes, str(args.id, 'id'), str(args.title, 'title'), 'note');
  return { ...noteView(note), content: note.content.slice(0, 60_000), truncated: note.content.length > 60_000 };
}

async function addNote(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const title = str(args.title, 'title', true)!.slice(0, 300);
  const content = str(args.content, 'content') ?? '';
  const projectName = str(args.project, 'project');
  const projects = projectName ? await loadProjects(ctx.db) : [];
  const project = projectName ? projects.find((p) => sameName(p.name, projectName)) : undefined;
  if (projectName && !project) throw new ToolError(`No project «${projectName}»`);
  const id = ctx.db.newId();
  const stamp = ctx.now().toISOString();
  const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === 'string').slice(0, 10) : [];
  const note = noteSchema.parse({
    id,
    title,
    content: content.slice(0, 190_000),
    tags,
    isPinned: false,
    projectId: project?.id,
    createdAt: stamp,
    updatedAt: stamp,
  });
  await ctx.db.update({ [`notes/${id}`]: clean(note) });
  return { created: noteView(note as Note) };
}

async function appendNote(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const text = str(args.text, 'text', true)!;
  const notes = (await loadNotes(ctx.db)).filter((n) => !(n as Note & { deletedAt?: string }).deletedAt);
  const note = pickOne(notes, str(args.id, 'id'), str(args.title, 'title'), 'note');
  const content = `${note.content.replace(/\s+$/, '')}${note.content.trim() ? '\n\n' : ''}${text}`;
  if (content.length > 190_000) throw new ToolError('The note would become too long');
  await ctx.db.update({ [`notes/${note.id}/content`]: content, [`notes/${note.id}/updatedAt`]: ctx.now().toISOString() });
  return { appendedTo: { id: note.id, title: note.title || 'Без назви' } };
}

// ---- habits --------------------------------------------------------------------------------------------------------

async function listHabits(_args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const today = zonedToday(ctx.tz, ctx.now());
  const [habits, logs] = await Promise.all([loadHabits(ctx.db), ctx.db.get<Record<string, Record<string, number>>>('habitLogs')]);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return {
    date: today,
    habits: habits
      .filter((h) => !h.archived)
      .map((h) => ({
        id: h.id,
        name: h.name,
        kind: h.kind ?? 'good',
        type: h.goalType,
        scheduledToday: h.schedule.includes(dow),
        today: logs?.[h.id]?.[today] ?? 0,
        target: h.goalType === 'count' ? h.target : 1,
        unit: h.unit ?? null,
      })),
  };
}

async function logHabit(args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const habits = (await loadHabits(ctx.db)).filter((h) => !h.archived);
  const habit = pickOne(
    habits.map((h) => ({ ...h, title: h.name })),
    str(args.id, 'id'),
    str(args.name, 'name'),
    'habit',
  );
  const date = dateArg(args.date, 'date') ?? zonedToday(ctx.tz, ctx.now());
  const current = (await ctx.db.get<number>(`habitLogs/${habit.id}/${date}`)) ?? 0;
  let value: number;
  if (typeof args.value === 'number') {
    if (!(args.value >= 0) || args.value > 100_000) throw new ToolError('«value» must be a number from 0');
    value = args.value;
  } else value = habit.goalType === 'count' ? current + 1 : 1;
  await ctx.db.update({ [`habitLogs/${habit.id}/${date}`]: value > 0 ? value : null, [`habits/${habit.id}/updatedAt`]: ctx.now().toISOString() });
  return { habit: { id: habit.id, name: habit.name }, date, value, target: habit.goalType === 'count' ? habit.target : 1 };
}

// ---- the list ------------------------------------------------------------------------------------------------------

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const readOnly = { readOnlyHint: true, openWorldHint: false as const };
const writes = { readOnlyHint: false, destructiveHint: false, openWorldHint: false as const };
const idOrTitle = {
  id: { type: 'string', description: 'Exact id (from a list)' },
  title: { type: 'string', description: 'Or part of the title, when it is unique' },
};

export const TOOLS: Tool[] = [
  {
    name: 'add',
    title: 'Add to Plano',
    description:
      "Adds a task, an event or a note from a line of natural language (Ukrainian works best; Russian and English words are understood). The words are read like in the app's quick-add box: «Купити молоко завтра», «Зустріч з Олею в п'ятницю о 15 на годину #робота», «щодня о 8 зарядка», «нотатка: ідея …». Several lines add several items. Returns what was created, with ids.",
    inputSchema: obj(
      {
        text: { type: 'string', description: 'What to add; one item per line.' },
        kind: {
          type: 'string',
          enum: ['task', 'event', 'note'],
          description: 'Force the kind (otherwise it is guessed: a time range or «зустріч» means an event).',
        },
      },
      ['text'],
    ),
    annotations: writes,
    run: add,
  },
  {
    name: 'today',
    title: 'Today in Plano',
    description: "What is on today: overdue tasks, tasks due today, tasks without a date, today's events and the habits scheduled today with their progress.",
    inputSchema: obj({}),
    annotations: readOnly,
    run: todayTool,
  },
  {
    name: 'list_tasks',
    title: 'List tasks',
    description: 'Lists tasks (open by default), oldest date first. Filter by dates, text, project or category.',
    inputSchema: obj({
      status: { type: 'string', enum: ['open', 'done', 'all'] },
      from: { type: 'string', description: 'Date like 2026-11-24: tasks on or after it' },
      to: { type: 'string', description: 'Date: tasks on or before it' },
      query: { type: 'string', description: 'Text in the title or description' },
      project: { type: 'string' },
      category: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    }),
    annotations: readOnly,
    run: listTasks,
  },
  {
    name: 'list_events',
    title: 'List events',
    description: 'Calendar events between two dates (recurring events are expanded). Default: the next 7 days.',
    inputSchema: obj({ from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 200 } }),
    annotations: readOnly,
    run: listEvents,
  },
  {
    name: 'complete_task',
    title: 'Complete a task',
    description: 'Marks a task done. A recurring task gets its next copy automatically, as in the app.',
    inputSchema: obj(idOrTitle),
    annotations: { ...writes, idempotentHint: false },
    run: (a, c) => setDone(a, c, true),
  },
  {
    name: 'reopen_task',
    title: 'Reopen a task',
    description: 'Puts a completed task back to «to do».',
    inputSchema: obj(idOrTitle),
    annotations: writes,
    run: (a, c) => setDone(a, c, false),
  },
  {
    name: 'update_task',
    title: 'Change a task',
    description: 'Changes a task: rename it, move it to another day (date = null removes the date), set or clear the time, priority or description.',
    inputSchema: obj({
      ...idOrTitle,
      new_title: { type: 'string' },
      date: { type: ['string', 'null'], description: 'YYYY-MM-DD, or null for no date' },
      time: { type: ['string', 'null'], description: 'HH:MM, or null for no time' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      description: { type: ['string', 'null'] },
    }),
    annotations: { ...writes, idempotentHint: true },
    run: updateTask,
  },
  {
    name: 'delete_task',
    title: 'Delete a task',
    description: 'Deletes a task for good. Needs the exact id (from list_tasks or today). Ask the person before using it.',
    inputSchema: obj({ id: { type: 'string' } }, ['id']),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    run: deleteTask,
  },
  {
    name: 'delete_event',
    title: 'Delete an event',
    description: 'Deletes a calendar event (all of a recurring series). Needs the exact id. Ask the person before using it.',
    inputSchema: obj({ id: { type: 'string' } }, ['id']),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    run: deleteEvent,
  },
  {
    name: 'search_notes',
    title: 'Search notes',
    description:
      'Finds notes by text in the title, body or tags (all recent notes when the query is empty). Returns short excerpts; use get_note for the whole text.',
    inputSchema: obj({ query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 50 } }),
    annotations: readOnly,
    run: searchNotes,
  },
  {
    name: 'get_note',
    title: 'Read a note',
    description: 'The full text (Markdown) of a note.',
    inputSchema: obj(idOrTitle),
    annotations: readOnly,
    run: getNote,
  },
  {
    name: 'add_note',
    title: 'Create a note',
    description: 'Creates a note. The content is Markdown (headings, lists, - [ ] checklists).',
    inputSchema: obj(
      { title: { type: 'string' }, content: { type: 'string' }, project: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
      ['title'],
    ),
    annotations: writes,
    run: addNote,
  },
  {
    name: 'append_to_note',
    title: 'Add to a note',
    description: 'Appends Markdown text to the end of an existing note.',
    inputSchema: obj({ ...idOrTitle, text: { type: 'string' } }, ['text']),
    annotations: writes,
    run: appendNote,
  },
  {
    name: 'list_habits',
    title: 'List habits',
    description: "The habits with today's progress and whether each is scheduled today.",
    inputSchema: obj({}),
    annotations: readOnly,
    run: listHabits,
  },
  {
    name: 'log_habit',
    title: 'Log a habit',
    description:
      'Marks a habit for a day (today by default). A yes/no habit becomes done; a counting habit goes up by one, or is set to `value`. For a habit to quit this records a slip. value = 0 clears the day.',
    inputSchema: obj({
      id: { type: 'string' },
      name: { type: 'string', description: "Or the habit's name" },
      date: { type: 'string' },
      value: { type: 'number', minimum: 0 },
    }),
    annotations: { ...writes, idempotentHint: false },
    run: logHabit,
  },
];
