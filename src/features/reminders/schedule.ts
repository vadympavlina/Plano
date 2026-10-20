import { addDaysKey, combineDateTime, formatTime, plural, todayKey } from '@/lib/date';
import { expandEvents } from '@/features/calendar/logic';
import { taskDate } from '@/features/tasks/logic';
import { isBad, isDone, isScheduled } from '@/features/habits/logic';
import type { UserData } from '@/types';

export interface Reminder {
  at: number;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

const DAYS = 7;

/** Every reminder due in the next week, from the user's data and reminder settings. */
export function buildReminders(data: UserData, now: Date): Reminder[] {
  const s = data.settings;
  const today = todayKey(now);
  const end = addDaysKey(today, DAYS - 1);
  const t = (time?: string) => formatTime(time, s.timeFormat);
  const out: Reminder[] = [];
  const add = (r: Reminder) => r.at > now.getTime() && out.push(r);
  const tasks = Object.values(data.tasks).filter((x) => x.status === 'todo' || x.status === 'in_progress');
  const occ = expandEvents(Object.values(data.events), today, end).filter((o) => !o.event.allDay && o.event.startTime);

  if (s.remindEventsMin > 0)
    for (const o of occ) {
      const m = s.remindEventsMin;
      add({
        at: combineDateTime(o.date, o.event.startTime!).getTime() - m * 60_000,
        title: o.event.title,
        body: `О ${t(o.event.startTime)} · через ${m >= 60 && m % 60 === 0 ? `${m / 60} год` : `${m} хв`}${o.event.location ? ` · ${o.event.location}` : ''}`,
        url: `#/calendar?date=${o.date}&view=day`,
        tag: `ev:${o.key}`,
      });
    }

  if (s.remindTasks)
    for (const k of tasks) {
      const d = taskDate(k);
      if (!d || !k.startTime || d < today || d > end) continue;
      add({ at: combineDateTime(d, k.startTime).getTime(), title: k.title, body: `Задача на ${t(k.startTime)}`, url: '#/tasks?list=today', tag: `task:${k.id}` });
    }

  for (let i = 0; i < DAYS; i++) {
    const day = addDaysKey(today, i);
    if (s.digestAt) {
      const dayTasks = tasks.filter((k) => taskDate(k) === day).length;
      const dayEvents = occ.filter((o) => o.date === day).sort((a, b) => a.event.startTime!.localeCompare(b.event.startTime!));
      if (dayTasks || dayEvents.length)
        add({
          at: combineDateTime(day, s.digestAt).getTime(),
          title: 'Доброго ранку ☀️',
          body: [
            dayTasks && `${dayTasks} ${plural(dayTasks, ['задача', 'задачі', 'задач'])}`,
            dayEvents.length && `${dayEvents.length} ${plural(dayEvents.length, ['подія', 'події', 'подій'])}, перша о ${t(dayEvents[0].event.startTime)}`,
          ]
            .filter(Boolean)
            .join(' · '),
          url: '#/',
          tag: `digest:${day}`,
        });
    }
    if (s.habitsReminderAt) {
      const left = Object.values(data.habits).filter((h) => !h.archived && !isBad(h) && isScheduled(h, day) && !isDone(h, data.habitLogs, day));
      if (left.length)
        add({
          at: combineDateTime(day, s.habitsReminderAt).getTime(),
          title: 'Звички на сьогодні',
          body: `Ще не відмічено: ${left.map((h) => h.name).join(', ')}`,
          url: '#/habits',
          tag: `habits:${day}`,
        });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 300);
}
