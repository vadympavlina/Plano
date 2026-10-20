import { addDaysKey, combineDateTime, formatTime, plural, todayKey } from '@/lib/date';
import { expandEvents } from '@/features/calendar/logic';
import { taskDate } from '@/features/tasks/logic';
import { habitValue, isBad, isDone, isScheduled } from '@/features/habits/logic';
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
  // A reminder window reaches a day further, so "1 day before" for the last day still fires.
  const all = expandEvents(Object.values(data.events), today, addDaysKey(end, 1));
  const occ = all.filter((o) => !o.event.allDay && o.event.startTime && o.date <= end);
  const ahead = (m: number) => (m >= 1440 && m % 1440 === 0 ? `${m / 1440} д` : m >= 60 && m % 60 === 0 ? `${m / 60} год` : `${m} хв`);

  // Events: own reminder or the default; all-day ones only when set on the event (from 09:00).
  for (const o of all) {
    const m = o.event.remindMin ?? (o.event.allDay ? 0 : s.remindEventsMin);
    if (!m) continue;
    const start = combineDateTime(o.date, o.event.allDay ? '09:00' : o.event.startTime!);
    add({
      at: start.getTime() - m * 60_000,
      title: o.event.title,
      body: `${o.event.allDay ? 'Весь день' : `О ${t(o.event.startTime)}`} · через ${ahead(m)}${o.event.location ? ` · ${o.event.location}` : ''}`,
      url: `#/calendar?date=${o.date}&view=day`,
      tag: `ev:${o.key}`,
    });
  }

  // Tasks: own reminder (from the start time, or 09:00 without one), else at the start if enabled.
  for (const k of tasks) {
    const d = taskDate(k);
    if (!d || d < today || d > addDaysKey(end, 1)) continue;
    const m = k.remindMin ?? (s.remindTasks && k.startTime ? 0 : undefined);
    if (m === undefined || (k.remindMin === 0)) continue;
    add({
      at: combineDateTime(d, k.startTime ?? '09:00').getTime() - m * 60_000,
      title: k.title,
      body: k.startTime ? `Задача на ${t(k.startTime)}${m ? ` · через ${ahead(m)}` : ''}` : `Задача на ${d === today ? 'сьогодні' : 'день'}${m ? ` · через ${ahead(m)}` : ''}`,
      url: '#/tasks?list=today',
      tag: `task:${k.id}`,
    });
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
    // Habit's own reminder times (e.g. water at 10, 14, 18) while it isn't done that day.
    for (const h of Object.values(data.habits)) {
      if (h.archived || isBad(h) || !h.remindAt?.length || !isScheduled(h, day) || isDone(h, data.habitLogs, day)) continue;
      const v = habitValue(data.habitLogs, h.id, day);
      for (const time of h.remindAt)
        add({
          at: combineDateTime(day, time).getTime(),
          title: `${h.icon} ${h.name}`,
          body: h.goalType === 'count' ? `${v} з ${h.target}${h.unit ? ` ${h.unit}` : ''} — час відмітити` : 'Час відмітити звичку',
          url: `#/habits/${h.id}`,
          tag: `habit:${h.id}:${day}:${time}`,
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
