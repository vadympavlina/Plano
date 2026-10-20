import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckSquare, Heart, Plus } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useUI } from '@/app/providers/UIProvider';
import { useNow } from '@/hooks/useNow';
import { formatDateKey, formatTimeRange, nowTime, plural, todayKey } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { compareOccurrences, expandEvents } from '@/features/calendar/logic';
import { eventColor } from '@/features/calendar/items';
import { openInList, doneInList } from '@/features/tasks/lists';
import { sortTasks } from '@/features/tasks/logic';
import { TaskRow } from '@/features/tasks/TaskViews';
import { habitValue, isDone, isScheduled } from '@/features/habits/logic';
import { HabitQuickButton } from '@/features/habits/parts';

/** Short list of the day for the app-icon shortcut: what's next, what to do, which habits are left. */
export default function TodayPage() {
  const { events, tasks, habits, categoryById } = useCollections();
  const { data } = useData();
  const settings = useSettings();
  const { openEvent, openTaskForm } = useUI();
  const now = useNow(60_000);
  const today = todayKey(now);
  const time = nowTime(now);

  const day = useMemo(() => {
    const occ = expandEvents(events, today, today).sort(compareOccurrences);
    return {
      events: occ,
      open: sortTasks(tasks.filter((t) => openInList(t, 'today', today)), 'due'),
      done: tasks.filter((t) => doneInList(t, 'today', today)),
      habits: habits.filter((h) => !h.archived && isScheduled(h, today)),
    };
  }, [events, tasks, habits, today]);
  const habitsLeft = day.habits.filter((h) => !isDone(h, data.habitLogs, today)).length;

  const section = 'rounded-[20px] border border-line/60 bg-surface p-4 shadow-soft';
  const head = (icon: React.ReactNode, title: string, extra?: React.ReactNode) => (
    <h2 className="mb-2 flex items-center gap-2 px-1 text-[14px] font-semibold [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-muted">
      {icon}
      <span className="flex-1">{title}</span>
      {extra}
    </h2>
  );

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-4 pb-8 pt-2 sm:px-6">
      <header className="px-1">
        <p className="text-[13px] text-muted first-letter:uppercase">{formatDateKey(today, 'EEEE, d MMMM')}</p>
        <h1 className="text-[26px] font-bold tracking-tight">Сьогодні</h1>
        <p className="text-[13px] text-muted">
          {[
            `${day.events.length} ${plural(day.events.length, ['подія', 'події', 'подій'])}`,
            `${day.open.length} ${plural(day.open.length, ['задача', 'задачі', 'задач'])}`,
            habitsLeft ? `${plural(habitsLeft, ['лишилась', 'лишилось', 'лишилось'])} ${habitsLeft} ${plural(habitsLeft, ['звичка', 'звички', 'звичок'])}` : day.habits.length ? 'звички виконано' : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <section className={section} aria-label="Події">
        {head(<CalendarDays />, 'Розклад', <Link to={`/calendar?date=${today}&view=day`} className="text-[12px] font-medium text-primary">Календар</Link>)}
        {day.events.length === 0 ? (
          <p className="px-1 py-2 text-[13px] text-muted">Подій немає — вільний день.</p>
        ) : (
          <ul>
            {day.events.map((o) => {
              const e = o.event;
              const past = !e.allDay && !!e.endTime && e.endTime <= time;
              const color = eventColor(e, categoryById);
              return (
                <li key={o.key}>
                  <button type="button" onClick={() => openEvent(e.id, o.date)} className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2/70', past && 'opacity-50')}>
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{e.title}</span>
                      <span className="block text-[12px] tabular-nums text-muted">{e.allDay ? 'Весь день' : formatTimeRange(e.startTime, e.endTime, settings.timeFormat)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={section} aria-label="Задачі">
        {head(
          <CheckSquare />,
          'Задачі',
          <button type="button" onClick={() => openTaskForm({ defaults: { dueDate: today } })} className="flex items-center gap-1 text-[12px] font-medium text-primary">
            <Plus className="h-3.5 w-3.5" /> Додати
          </button>,
        )}
        {day.open.length === 0 && <p className="px-1 py-2 text-[13px] text-muted">{day.done.length ? 'Усе зроблено 🎉' : 'На сьогодні задач немає.'}</p>}
        <div className="-mx-2">
          {day.open.map((t) => (
            <TaskRow key={t.id} task={t} today={today} />
          ))}
          {day.done.map((t) => (
            <TaskRow key={t.id} task={t} today={today} showDate={false} />
          ))}
        </div>
        {day.open.length > 0 && <p className="mt-1 px-1 text-[11.5px] text-subtle sm:hidden">Свайп вправо — виконано, вліво — на завтра.</p>}
      </section>

      {day.habits.length > 0 && (
        <section className={section} aria-label="Звички">
          {head(<Heart />, 'Звички', <Link to="/habits" className="text-[12px] font-medium text-primary">Усі</Link>)}
          <ul className="space-y-1">
            {day.habits.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <span className="text-[20px]">{h.icon}</span>
                <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{h.name}</span>
                  {h.goalType === 'count' && (
                    <span className="block text-[12px] tabular-nums text-muted" style={{ color: isDone(h, data.habitLogs, today) ? colorOf(h.color) : undefined }}>
                      {habitValue(data.habitLogs, h.id, today)} з {h.target} {h.unit ?? ''}
                    </span>
                  )}
                </Link>
                <HabitQuickButton habit={h} today={today} size={38} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
