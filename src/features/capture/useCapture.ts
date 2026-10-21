import { useMemo, useState } from 'react';
import { useActions } from '@/hooks/useActions';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useToday } from '@/hooks/useNow';
import { useCreateNote } from '@/components/layout/CreateMenu';
import { settleWrite } from '@/services/sync';
import { toast } from '@/components/ui/toast';
import { deviceTimeZone, formatDuration, formatTimeRange, minutesToTime, plural, relativeDayLabel, timeToMinutes } from '@/lib/date';
import { describeRecurrence } from '@/lib/date/recurrence';
import type { Category, DateKey, Project } from '@/types';
import { parseQuick, removeSpans, sameName, type Span } from './parse';

export type CaptureKind = 'task' | 'event' | 'note';

/** What the box starts with when opened from a calendar slot: the day, the hours, an event. */
export interface CapturePreset {
  date?: DateKey;
  endDate?: DateKey;
  time?: string;
  endTime?: string;
  allDay?: boolean;
  kind?: CaptureKind;
}

export interface CaptureChip {
  key: string;
  type: 'kind' | 'date' | 'time' | 'repeat' | 'category' | 'project' | 'tag' | 'priority' | 'reminder' | 'note' | 'subtasks';
  label: string;
  category?: Category;
  project?: Project;
  /** Text pieces the chip's ✕ removes. */
  spans: Span[];
}

const endOf = (start: string, minutes: number) => minutesToTime(Math.min(timeToMinutes(start) + minutes, 23 * 60 + 59));

/**
 * Quick capture: the typed line, what it means (with the user's own categories
 * and projects), the chips to show and the save itself.
 */
export function useCapture(preset?: CapturePreset) {
  const today = useToday();
  const actions = useActions();
  const createNote = useCreateNote();
  const settings = useSettings();
  const { categories, projects, tasks, events } = useCollections();
  const [text, setText] = useState('');
  const [kindOverride, setKindOverride] = useState<CaptureKind>();
  const [dateOverride, setDateOverride] = useState<DateKey>();
  const [busy, setBusy] = useState(false);
  const [pre, setPre] = useState<CapturePreset>(preset ?? {});

  const r = useMemo(() => {
    // What the text says wins; the preset (calendar slot) fills what it doesn't.
    const raw = parseQuick(text, today);
    const p = { ...raw };
    if (!raw.time && !raw.allDay && pre.time) Object.assign(p, { time: pre.time, endTime: raw.duration ? undefined : pre.endTime });
    if (!raw.time && !raw.allDay && !pre.time && pre.allDay) p.allDay = true;
    if (!raw.date && !raw.endDate && pre.endDate) p.endDate = pre.endDate;
    p.date ??= pre.date;
    const tagSpan = (tag: string) => p.spans.filter((s) => s.type === 'tag' && sameName(text.slice(s.start, s.end).replace(/^#|^хештег\s+|^хеш тег\s+/i, ''), tag));
    let category: Category | undefined;
    let project: Project | undefined;
    const used: string[] = [];
    for (const t of p.tags) {
      const c = !category && categories.find((x) => sameName(x.name, t));
      const pr = !c && !project && projects.find((x) => sameName(x.name, t));
      if (c) category = c;
      else if (pr) project = pr;
      else continue;
      used.push(t);
    }
    if (p.project) project = projects.find((x) => sameName(x.name, p.project!)) ?? project;
    const tags = p.tags.filter((t) => !used.includes(t));
    const date = dateOverride ?? p.date;
    const kind: CaptureKind = kindOverride ?? p.kind ?? pre.kind ?? 'task';
    // No #category given: suggest the one used last time for a title starting with the same word.
    const first = p.title.toLowerCase().match(/^[\p{L}']{4,}/u)?.[0];
    let suggested: Category | undefined;
    if (!category && first && kind !== 'note') {
      let best = '';
      for (const x of [...tasks, ...events]) {
        if (!x.categoryId || x.updatedAt <= best || !x.title.toLowerCase().startsWith(first)) continue;
        const cat = categories.find((k) => k.id === x.categoryId);
        if (cat) {
          suggested = cat;
          best = x.updatedAt;
        }
      }
    }
    const end = p.endTime ?? (p.time && p.duration ? endOf(p.time, p.duration) : undefined);
    const of = (type: Span['type']) => p.spans.filter((s) => s.type === type);

    const chips: CaptureChip[] = [];
    const add = (c: Omit<CaptureChip, 'key'>) => chips.push({ key: `${c.type}:${c.label}`, ...c });
    if (text.trim()) add({ type: 'kind', label: kind === 'event' ? 'Подія' : kind === 'note' ? 'Нотатка' : 'Задача', spans: of('kind') });
    if (kind !== 'note') {
      if (date && (of('date').length || dateOverride)) add({ type: 'date', label: relativeDayLabel(date, today, 'EEEEEE, d MMM'), spans: of('date') });
      if (p.endDate) add({ type: 'date', label: `по ${relativeDayLabel(p.endDate, today, 'EEEEEE, d MMM')}`, spans: of('date') });
      if (p.allDay) add({ type: 'time', label: p.endDate ? 'Кілька днів' : 'Весь день', spans: of('time') });
      else if (p.time) add({ type: 'time', label: formatTimeRange(p.time, end, settings.timeFormat), spans: [...of('time'), ...of('duration')] });
      else if (p.duration) add({ type: 'time', label: formatDuration(p.duration), spans: of('duration') });
      if (p.recurrence) add({ type: 'repeat', label: describeRecurrence(p.recurrence), spans: of('repeat') });
      if (p.priority && p.priority !== 'medium') add({ type: 'priority', label: p.priority === 'urgent' ? 'Терміново' : p.priority === 'high' ? 'Важливо' : 'Не терміново', spans: of('priority') });
      if (p.remindMin != null) add({ type: 'reminder', label: p.remindMin ? `Нагадати за ${formatDuration(p.remindMin)}` : 'Нагадати вчасно', spans: of('reminder') });
      if (p.subtasks) add({ type: 'subtasks', label: `${p.subtasks.length} ${plural(p.subtasks.length, ['підзадача', 'підзадачі', 'підзадач'])}`, spans: [] });
      if (category) add({ type: 'category', label: category.name, category, spans: tagSpan(used.find((t) => sameName(t, category!.name))!) });
    }
    if (project) add({ type: 'project', label: project.name, project, spans: p.project ? of('project') : tagSpan(used.find((t) => sameName(t, project!.name)) ?? '') });
    if (kind !== 'note') for (const t of tags) add({ type: 'tag', label: `#${t}`, spans: tagSpan(t) });
    if (p.description) add({ type: 'note', label: p.description, spans: of('note') });
    // Several lines: each becomes its own item.
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    // Highlights: each line parsed on its own, so every line shows what it means.
    let spans = p.spans;
    if (lines.length > 1) {
      spans = [];
      let at = 0;
      for (const line of text.split('\n')) {
        spans.push(...parseQuick(line, today).spans.map((x) => ({ ...x, start: x.start + at, end: x.end + at })));
        at += line.length + 1;
      }
    }
    return { p, kind, date, end, category, project, tags, chips, suggested, spans, lines: lines.length > 1 ? lines.length : 0 };
  }, [text, today, categories, projects, tasks, events, kindOverride, dateOverride, pre, settings.timeFormat]);

  const reset = () => {
    setText('');
    setKindOverride(undefined);
    setDateOverride(undefined);
  };

  /** ✕ on a chip: drop its words from the line (and a manual date). */
  const removeChip = (chip: CaptureChip) => {
    if (chip.type === 'date') setDateOverride(undefined);
    if (chip.type === 'kind') setKindOverride(undefined);
    // A preset time or day range has no words to remove: drop it from the preset.
    if (chip.type === 'time') setPre((x) => ({ ...x, time: undefined, endTime: undefined, allDay: undefined }));
    if (chip.type === 'date') setPre((x) => ({ ...x, endDate: undefined }));
    setText((t) => removeSpans(t, chip.spans, chip.spans.map((s) => s.type)).trimEnd() + ' ');
  };
  const setDate = (d: DateKey | undefined) => {
    setText((t) => removeSpans(t, r.p.spans, ['date']));
    setDateOverride(d);
    if (!d) setPre((x) => ({ ...x, date: undefined }));
  };

  /** Creates the item(s); returns false when there's nothing to add. */
  const save = async (): Promise<boolean> => {
    if (busy) return false;
    if (r.lines) return saveLines();
    const { p, kind, date, end, category, project, tags } = r;
    const title = p.title || text.trim();
    if (!title) return false;
    if (kind === 'note') {
      createNote({ title, projectId: project?.id });
      reset();
      return true;
    }
    setBusy(true);
    try {
      const links = { categoryId: category?.id, projectId: project?.id };
      if (kind === 'task') {
        const { id, write } = actions.tasks.create({
          title,
          status: 'todo',
          priority: p.priority ?? 'medium',
          tags,
          dueDate: date ?? (p.time || p.recurrence ? today : undefined),
          startTime: p.time,
          endTime: end,
          recurrence: p.recurrence,
          remindMin: p.remindMin,
          description: p.description,
          subtasks: (p.subtasks ?? []).map((t, order) => ({ id: `st_${Date.now().toString(36)}${order}`, title: t, done: false, order })),
          ...links,
        });
        await settleWrite(write);
        const when = date ? ` на ${relativeDayLabel(date, today, 'd MMMM').toLowerCase()}` : '';
        toast.success(`Задачу «${title}» додано${when}`, { action: { label: 'Скасувати', onClick: () => void actions.tasks.remove(id).catch(() => undefined) } });
      } else {
        const start = p.time;
        const { id, write } = actions.events.create({
          title,
          date: date ?? today,
          allDay: !start,
          startTime: start,
          endTime: start ? (end ?? endOf(start, 60)) : undefined,
          endDate: p.endDate,
          recurrence: p.recurrence,
          remindMin: p.remindMin,
          description: p.description,
          ...links,
          exdates: [],
          source: 'plano',
          timezone: deviceTimeZone(),
        });
        await settleWrite(write);
        toast.success(`Подію «${title}» додано на ${relativeDayLabel(date ?? today, today, 'd MMMM').toLowerCase()}${start ? `, ${start}` : ''}`, {
          action: { label: 'Скасувати', onClick: () => void actions.events.remove(id).catch(() => undefined) },
        });
      }
      reset();
      return true;
    } catch {
      /* the sync layer shows the error */
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** A pasted list: every line is parsed on its own (its own date, #category…) and added. */
  const saveLines = async () => {
    setBusy(true);
    try {
      const ids: { kind: 'task' | 'event'; id: string }[] = [];
      for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
        const p = parseQuick(line, today);
        const cat = p.tags.map((t) => categories.find((x) => sameName(x.name, t))).find(Boolean);
        const proj = projects.find((x) => sameName(x.name, p.project ?? '') || p.tags.some((t) => sameName(x.name, t)));
        const title = p.title || line;
        const links = { categoryId: cat?.id, projectId: proj?.id };
        const end = p.endTime ?? (p.time && p.duration ? endOf(p.time, p.duration) : undefined);
        if (p.kind === 'event') {
          const { id, write } = actions.events.create({ title, date: p.date ?? today, endDate: p.endDate, allDay: !p.time, startTime: p.time, endTime: p.time ? (end ?? endOf(p.time, 60)) : undefined, recurrence: p.recurrence, remindMin: p.remindMin, description: p.description, ...links, exdates: [], source: 'plano', timezone: deviceTimeZone() });
          await settleWrite(write);
          ids.push({ kind: 'event', id });
        } else {
          const { id, write } = actions.tasks.create({ title, status: 'todo', priority: p.priority ?? 'medium', subtasks: [], tags: [], dueDate: p.date ?? (p.time || p.recurrence ? today : undefined), startTime: p.time, endTime: end, recurrence: p.recurrence, remindMin: p.remindMin, description: p.description, ...links });
          await settleWrite(write);
          ids.push({ kind: 'task', id });
        }
      }
      toast.success(`Додано: ${ids.length}`, {
        action: { label: 'Скасувати', onClick: () => ids.forEach((x) => void (x.kind === 'task' ? actions.tasks.remove(x.id) : actions.events.remove(x.id)).catch(() => undefined)) },
      });
      reset();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Accept the suggested category: add «#Назва» to the line. */
  const acceptSuggestion = () => {
    if (!r.suggested) return;
    const tag = `#${r.suggested.name.replace(/\s+/g, '_')}`;
    // Before « // опис», not inside it.
    const note = r.p.spans.find((x) => x.type === 'note');
    setText((t) => (note ? `${t.slice(0, note.start).trimEnd()} ${tag} ${t.slice(note.start)}` : `${t.trimEnd()} ${tag} `));
  };

  return { text, setText, ...r, preset: pre, busy, save, reset, removeChip, setDate, setKind: setKindOverride, acceptSuggestion, categories, projects };
}
