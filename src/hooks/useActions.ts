import { useMemo } from 'react';
import { useData } from '@/app/providers/DataProvider';
import { nowIso, type NewEntity } from '@/services/repositories';
import { addDaysKey, diffDaysKey } from '@/lib/date';
import { stripUndefined } from '@/lib/validation/parse';
import { completionPatch, nextRecurringInstance } from '@/features/tasks/logic';
import type { CalendarEvent, Category, DateKey, Goal, Habit, Note, Project, Task, TimeString } from '@/types';

/**
 * Domain actions used by the UI. Business rules (recurrence, cascading
 * unlinks, atomic multi-path writes) live here, not in components.
 */
export function useActions() {
  const { repos, data } = useData();

  return useMemo(() => {
    const t = (id: string, field: string) => `tasks/${id}/${field}`;

    const tasks = {
      create: (input: NewEntity<Task>) => repos.tasks.create(input),
      update: (id: string, patch: Partial<Task>) => repos.tasks.update(id, patch),
      remove: (id: string) => repos.tasks.remove(id),
      /** Completes / reopens a task. Completing a recurring task schedules the next one atomically. */
      setDone(task: Task, done: boolean) {
        const now = nowIso();
        const patch = completionPatch(task, done, now);
        const values: Record<string, unknown> = {
          [t(task.id, 'status')]: patch.status,
          [t(task.id, 'completedAt')]: patch.completedAt ?? null,
          [t(task.id, 'updatedAt')]: now,
        };
        if (done) {
          const next = nextRecurringInstance(task, new Set(Object.keys(data.tasks)), now);
          if (next) values[`tasks/${next.id}`] = stripUndefined(next);
        }
        return repos.batch(done ? 'Complete task' : 'Reopen task', values);
      },
      setStatus(task: Task, status: Task['status']) {
        if (status === 'completed') return tasks.setDone(task, true);
        return repos.tasks.update(task.id, { status, completedAt: undefined });
      },
      reschedule: (task: Task, date: DateKey | undefined) =>
        repos.tasks.update(task.id, task.dueDate || !task.startDate ? { dueDate: date } : { startDate: date }),
      toggleSubtask(task: Task, subtaskId: string) {
        const subtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
        return repos.tasks.update(task.id, { subtasks });
      },
    };

    const events = {
      create: (input: NewEntity<CalendarEvent>) => repos.events.create(input),
      update: (id: string, patch: Partial<CalendarEvent>) => repos.events.update(id, patch),
      remove: (id: string) => repos.events.remove(id),
      /** Removes a single occurrence of a recurring series. */
      removeOccurrence: (event: CalendarEvent, date: DateKey) =>
        repos.events.update(event.id, { exdates: [...new Set([...event.exdates, date])].sort() }),
      move: (event: CalendarEvent, date: DateKey, startTime?: TimeString, endTime?: TimeString) => {
        const patch: Partial<CalendarEvent> = { date };
        if (event.allDay && event.endDate) patch.endDate = addDaysKey(date, diffDaysKey(event.endDate, event.date));
        if (startTime) patch.startTime = startTime;
        if (endTime) patch.endTime = endTime;
        return repos.events.update(event.id, patch);
      },
    };

    const projects = {
      create: (input: NewEntity<Project>) => repos.projects.create(input),
      update: (id: string, patch: Partial<Project>) => repos.projects.update(id, patch),
      /** Deletes a project and unlinks its tasks, events, notes and goals (they are kept). */
      remove(id: string) {
        const values: Record<string, unknown> = { [`projects/${id}`]: null };
        for (const task of Object.values(data.tasks)) if (task.projectId === id) values[t(task.id, 'projectId')] = null;
        for (const ev of Object.values(data.events)) if (ev.projectId === id) values[`events/${ev.id}/projectId`] = null;
        for (const note of Object.values(data.notes)) if (note.projectId === id) values[`notes/${note.id}/projectId`] = null;
        for (const goal of Object.values(data.goals))
          if (goal.projectIds.includes(id)) values[`goals/${goal.id}/projectIds`] = goal.projectIds.filter((p) => p !== id);
        return repos.batch('Delete project', values);
      },
    };

    const categories = {
      create: (input: NewEntity<Category>) => repos.categories.create(input),
      update: (id: string, patch: Partial<Category>) => repos.categories.update(id, patch),
      remove(id: string) {
        const values: Record<string, unknown> = { [`categories/${id}`]: null };
        for (const task of Object.values(data.tasks)) if (task.categoryId === id) values[t(task.id, 'categoryId')] = null;
        for (const ev of Object.values(data.events)) if (ev.categoryId === id) values[`events/${ev.id}/categoryId`] = null;
        for (const goal of Object.values(data.goals)) if (goal.categoryId === id) values[`goals/${goal.id}/categoryId`] = null;
        return repos.batch('Delete category', values);
      },
    };

    const habits = {
      create: (input: NewEntity<Habit>) => repos.habits.create(input),
      update: (id: string, patch: Partial<Habit>) => repos.habits.update(id, patch),
      remove: (id: string) => repos.batch('Delete habit', { [`habits/${id}`]: null, [`habitLogs/${id}`]: null }),
      setValue: (habitId: string, date: DateKey, value: number) => repos.habitLogs.set(habitId, date, value),
    };

    const goals = {
      create: (input: NewEntity<Goal>) => repos.goals.create(input),
      update: (id: string, patch: Partial<Goal>) => repos.goals.update(id, patch),
      remove: (id: string) => repos.goals.remove(id),
      /** Sets the current value and records it in the goal's history. */
      logProgress(goal: Goal, value: number, note?: string) {
        const entry = { id: repos.goals.newId(), date: nowIso(), value, note: note || undefined };
        const reached = value >= goal.targetValue;
        return repos.goals.update(goal.id, {
          currentValue: value,
          history: [...goal.history, entry].slice(-200),
          status: reached && goal.status === 'active' ? 'completed' : goal.status,
        });
      },
    };

    const notes = {
      create: (input: NewEntity<Note>) => repos.notes.create(input),
      update: (id: string, patch: Partial<Note>) => repos.notes.update(id, patch),
      remove: (id: string) => repos.notes.remove(id),
    };

    return { tasks, events, projects, categories, habits, goals, notes, repos };
  }, [repos, data]);
}
