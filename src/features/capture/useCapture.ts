import { useMemo, useState } from 'react';
import { useActions } from '@/hooks/useActions';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useToday } from '@/hooks/useNow';
import { useCreateNote } from '@/components/layout/CreateMenu';
import { settleWrite } from '@/services/sync';
import { toast } from '@/components/ui/toast';
import { deviceTimeZone, formatDuration, formatTimeRange, minutesToTime, relativeDayLabel, timeToMinutes } from '@/lib/date';
import { describeRecurrence } from '@/lib/date/recurrence';
import type { Category, DateKey, Project } from '@/types';
import { parseQuick, removeSpans, sameName, type Span } from './parse';

export type CaptureKind = 'task' | 'event' | 'note';

export interface CaptureChip {
  key: string;
  type: 'kind' | 'date' | 'time' | 'repeat' | 'category' | 'project' | 'tag' | 'priority' | 'reminder';
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
export function useCapture() {
  const today = useToday();
  const actions = useActions();
  const createNote = useCreateNote();
  const settings = useSettings();
  const { categories, projects } = useCollections();
  const [text, setText] = useState('');
  const [kindOverride, setKindOverride] = useState<CaptureKind>();
  const [dateOverride, setDateOverride] = useState<DateKey>();
  const [busy, setBusy] = useState(false);

  const r = useMemo(() => {
    const p = parseQuick(text, today);
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
    const kind: CaptureKind = kindOverride ?? p.kind ?? 'task';
    const end = p.endTime ?? (p.time && p.duration ? endOf(p.time, p.duration) : undefined);
    const of = (type: Span['type']) => p.spans.filter((s) => s.type === type);

    const chips: CaptureChip[] = [];
    const add = (c: Omit<CaptureChip, 'key'>) => chips.push({ key: `${c.type}:${c.label}`, ...c });
    if (text.trim()) add({ type: 'kind', label: kind === 'event' ? 'Подія' : kind === 'note' ? 'Нотатка' : 'Задача', spans: of('kind') });
    if (kind !== 'note') {
      if (date && (of('date').length || dateOverride)) add({ type: 'date', label: relativeDayLabel(date, today, 'EEEEEE, d MMM'), spans: of('date') });
      if (p.time) add({ type: 'time', label: formatTimeRange(p.time, end, settings.timeFormat), spans: [...of('time'), ...of('duration')] });
      else if (p.duration) add({ type: 'time', label: formatDuration(p.duration), spans: of('duration') });
      if (p.recurrence) add({ type: 'repeat', label: describeRecurrence(p.recurrence), spans: of('repeat') });
      if (p.priority && p.priority !== 'medium') add({ type: 'priority', label: p.priority === 'urgent' ? 'Терміново' : p.priority === 'high' ? 'Важливо' : 'Не терміново', spans: of('priority') });
      if (p.remindMin) add({ type: 'reminder', label: `Нагадати за ${formatDuration(p.remindMin)}`, spans: of('reminder') });
      if (category) add({ type: 'category', label: category.name, category, spans: tagSpan(used.find((t) => sameName(t, category!.name))!) });
    }
    if (project) add({ type: 'project', label: project.name, project, spans: p.project ? of('project') : tagSpan(used.find((t) => sameName(t, project!.name)) ?? '') });
    if (kind !== 'note') for (const t of tags) add({ type: 'tag', label: `#${t}`, spans: tagSpan(t) });
    return { p, kind, date, end, category, project, tags, chips };
  }, [text, today, categories, projects, kindOverride, dateOverride, settings.timeFormat]);

  const reset = () => {
    setText('');
    setKindOverride(undefined);
    setDateOverride(undefined);
  };

  /** ✕ on a chip: drop its words from the line (and a manual date). */
  const removeChip = (chip: CaptureChip) => {
    if (chip.type === 'date') setDateOverride(undefined);
    if (chip.type === 'kind') setKindOverride(undefined);
    setText((t) => removeSpans(t, chip.spans, chip.spans.map((s) => s.type)).trimEnd() + ' ');
  };
  const setDate = (d: DateKey | undefined) => {
    setText((t) => removeSpans(t, r.p.spans, ['date']));
    setDateOverride(d);
  };

  /** Creates the item; returns false when there's nothing to add. */
  const save = async (): Promise<boolean> => {
    const { p, kind, date, end, category, project, tags } = r;
    const title = p.title || text.trim();
    if (!title || busy) return false;
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
          subtasks: [],
          tags,
          dueDate: date ?? (p.time || p.recurrence ? today : undefined),
          startTime: p.time,
          endTime: end,
          recurrence: p.recurrence,
          remindMin: p.remindMin,
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
          recurrence: p.recurrence,
          remindMin: p.remindMin,
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

  return { text, setText, ...r, busy, save, reset, removeChip, setDate, setKind: setKindOverride, categories, projects };
}
