import { useMemo } from 'react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useToday } from '@/hooks/useNow';
import { formatDuration, formatTimeRange, minutesToTime, relativeDayLabel, timeToMinutes } from '@/lib/date';
import { describeRecurrence } from '@/lib/date/recurrence';
import type { CalendarEvent, Category, Project, Task } from '@/types';
import { parseQuick, sameName, type ParsedQuick } from './parse';

const endOf = (start: string, minutes: number) => minutesToTime(Math.min(timeToMinutes(start) + minutes, 23 * 60 + 59));

/** #tags and @project → the user's own category / project; the rest stay plain tags. */
export function resolveLinks(p: ParsedQuick, categories: Category[], projects: Project[]) {
  let category: Category | undefined;
  let project: Project | undefined;
  const rest: string[] = [];
  for (const t of p.tags) {
    const c = !category && categories.find((x) => sameName(x.name, t));
    const pr = !c && !project && projects.find((x) => sameName(x.name, t));
    if (c) category = c;
    else if (pr) project = pr;
    else rest.push(t);
  }
  if (p.project) project = projects.find((x) => sameName(x.name, p.project!)) ?? project;
  return { category, project, tags: rest };
}

/**
 * The same reading as quick capture, for the title field of the full task and event
 * forms: «Звіт у пʼятницю о 15 #робота» → what to fill in and a short summary.
 */
export function useSmartTitle(title: string) {
  const today = useToday();
  const settings = useSettings();
  const { categories, projects } = useCollections();
  return useMemo(() => {
    const p = parseQuick(title, today);
    const { category, project, tags } = resolveLinks(p, categories, projects);
    const end = p.endTime ?? (p.time && p.duration ? endOf(p.time, p.duration) : undefined);
    const summary = [
      p.date && relativeDayLabel(p.date, today, 'EEEEEE, d MMM'),
      p.endDate && `по ${relativeDayLabel(p.endDate, today, 'd MMM')}`,
      p.allDay ? 'весь день' : p.time ? formatTimeRange(p.time, end, settings.timeFormat) : p.duration ? formatDuration(p.duration) : undefined,
      p.recurrence && describeRecurrence(p.recurrence).toLowerCase(),
      category?.name,
      project && `проєкт ${project.name}`,
      ...tags.map((t) => `#${t}`),
      p.priority === 'urgent' ? 'терміново' : p.priority === 'high' ? 'важливо' : p.priority === 'low' ? 'не терміново' : undefined,
      p.remindMin != null && (p.remindMin ? `нагадати за ${formatDuration(p.remindMin)}` : 'нагадати вчасно'),
      p.subtasks && `${p.subtasks.length} підзадач`,
      p.description && 'опис',
    ].filter(Boolean) as string[];
    // Nothing worth filling in (or nothing left for a title): leave the title alone.
    const found = summary.length > 0 && !!p.title;

    const task = (draft: { tags: string[]; description?: string; subtasks: Task['subtasks'] }): Partial<Task> => ({
      title: p.title,
      ...(p.date && { dueDate: p.date }),
      ...(p.time && !p.allDay && { startTime: p.time, endTime: end }),
      ...(p.recurrence && { recurrence: p.recurrence }),
      ...(p.priority && { priority: p.priority }),
      ...(p.remindMin != null && { remindMin: p.remindMin }),
      ...(category && { categoryId: category.id }),
      ...(project && { projectId: project.id }),
      ...(tags.length && { tags: [...new Set([...draft.tags, ...tags])] }),
      ...(p.description && !draft.description && { description: p.description }),
      ...(p.subtasks && {
        subtasks: [...draft.subtasks, ...p.subtasks.map((t, i) => ({ id: `st_${Date.now().toString(36)}${i}`, title: t, done: false, order: draft.subtasks.length + i }))],
      }),
    });
    const event = (draft: { description?: string }): Partial<CalendarEvent> => ({
      title: p.title,
      ...(p.date && { date: p.date }),
      ...(p.endDate && { endDate: p.endDate }),
      ...(p.allDay && { allDay: true, startTime: undefined, endTime: undefined }),
      ...(p.time && !p.allDay && { allDay: false, startTime: p.time, endTime: end ?? endOf(p.time, 60) }),
      ...(p.recurrence && { recurrence: p.recurrence }),
      ...(p.remindMin != null && { remindMin: p.remindMin }),
      ...(category && { categoryId: category.id }),
      ...(project && { projectId: project.id }),
      ...(p.description && !draft.description && { description: p.description }),
    });
    return { found, summary, task, event };
  }, [title, today, categories, projects, settings.timeFormat]);
}
