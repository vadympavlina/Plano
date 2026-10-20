import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Flame, MapPin, Plus, Repeat } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { CheckCircle, Progress } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useNow } from '@/hooks/useNow';
import { useProfile } from '@/hooks/useProfile';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { eachDateKey, formatDateKey, formatDuration, formatTime, greetingFor, minutesToTime, plural, relativeDayLabel, todayKey, weekRange } from '@/lib/date';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptic';
import type { Habit } from '@/types';
import { isOverdue, percent, sortTasks, taskDate, weekProgress } from '@/features/tasks/logic';
import { expandEvents, occurrencesOnDay, upcomingOccurrences } from '@/features/calendar/logic';
import { currentStreak, habitValue, isDone, isScheduled, nextHabitValue } from '@/features/habits/logic';
import { goalPercent } from '@/features/goals/logic';
import { eventColor } from '@/features/calendar/items';
import { QuickAdd } from './QuickAdd';
import { WeekBoard } from './WeekBoard';
import { buildSchedule, busiestDay, freeTime, nextUpLabel, nowLineIndex } from './logic';

const panel = 'rounded-[20px] border border-line/60 bg-surface shadow-soft';

function Section({
  title,
  meta,
  link,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  link?: { to: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(panel, 'p-5', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {link ? (
          <Link to={link.to} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">
            {link.label} <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          meta && <span className="text-[12.5px] text-muted">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Ring({
  value,
  size,
  stroke,
  color,
  track = 'rgb(var(--line))',
  children,
}: {
  value: number;
  size: number;
  stroke: number;
  color: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}

export default function DashboardPage() {
  const now = useNow();
  const today = todayKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const { data } = useData();
  const { tasks, events, habits, goals, categoryById } = useCollections();
  const settings = useSettings();
  const profile = useProfile();
  const { openTask, openTaskForm, openEvent, openEventForm } = useUI();
  const actions = useActions();
  const fmt = (t?: string) => (t ? formatTime(t, settings.timeFormat) : '');

  const todayTasks = useMemo(() => tasks.filter((t) => taskDate(t) === today && t.status !== 'cancelled'), [tasks, today]);
  const doneCount = todayTasks.filter((t) => t.status === 'completed').length;
  const openCount = todayTasks.length - doneCount;
  const untimed = useMemo(
    () =>
      sortTasks(
        todayTasks.filter((t) => !t.startTime && t.status !== 'completed'),
        'due',
      ),
    [todayTasks],
  );
  const overdue = useMemo(() => tasks.filter((t) => isOverdue(t, today)), [tasks, today]);

  const todayOcc = useMemo(() => occurrencesOnDay(expandEvents(events, today, today), today), [events, today]);
  const allDay = todayOcc.filter((o) => o.event.allDay);
  const schedule = useMemo(() => buildSchedule(todayOcc, todayTasks), [todayOcc, todayTasks]);
  const nowAt = nowLineIndex(schedule, nowMinutes);
  const free = freeTime(schedule, nowMinutes);
  const next = useMemo(
    () => upcomingOccurrences(events, now, today, 14, 4).find((o) => !o.event.allDay) ?? upcomingOccurrences(events, now, today, 14, 1)[0],
    [events, now, today],
  );

  const weekCounts = weekProgress(tasks, today, settings.weekStartsOn);
  const ahead = useMemo(() => {
    const groups: {
      day: string;
      items: ReturnType<typeof upcomingOccurrences>;
    }[] = [];
    for (const o of upcomingOccurrences(events, now, today, 7, 30)) {
      if (o.date <= today) continue;
      const g = groups.find((x) => x.day === o.date);
      if (g) g.items.push(o);
      else groups.push({ day: o.date, items: [o] });
    }
    return groups.slice(0, 3);
  }, [events, now, today]);

  const week = useMemo(() => {
    const range = weekRange(today, settings.weekStartsOn);
    const days = eachDateKey(range.start, range.end);
    const occ = expandEvents(events, range.start, range.end);
    const perDay = days.map((d) => occurrencesOnDay(occ, d).length + tasks.filter((t) => taskDate(t) === d && t.status !== 'cancelled').length);
    const eventCount = days.reduce((n, d) => n + occurrencesOnDay(occ, d).length, 0);
    const habitChecks = Object.values(data.habitLogs ?? {}).reduce(
      (n, byDate) => n + Object.entries(byDate).filter(([d, v]) => d >= range.start && d <= range.end && v > 0).length,
      0,
    );
    const freeDays = perDay.filter((n) => n === 0).length;
    const busy = busiestDay(perDay);
    return { eventCount, habitChecks, freeDays, busiest: busy >= 0 && perDay[busy] > 1 ? days[busy] : undefined };
  }, [events, tasks, data.habitLogs, today, settings.weekStartsOn]);

  const activeHabits = habits.filter((h) => !h.archived);
  const habitsToday = activeHabits.filter((h) => isScheduled(h, today));
  const habitsDone = habitsToday.filter((h) => isDone(h, data.habitLogs, today)).length;
  const bestStreak = activeHabits.reduce((best, h) => Math.max(best, currentStreak(h, data.habitLogs, today)), 0);
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 4);

  const tapHabit = (h: Habit) => {
    haptic();
    void actions.habits.setValue(h.id, today, nextHabitValue(h, habitValue(data.habitLogs, h.id, today))).catch(() => undefined);
  };

  /* ---------- blocks ---------- */

  const nextUp = (
    <div className="relative flex min-h-[176px] flex-col overflow-hidden rounded-[20px] bg-sidebar p-5 text-sidebar-fg sm:p-6">
      <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-primary/30 blur-3xl" aria-hidden />
      {next ? (
        <>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-fg/55">
            {nextUpLabel(next.event, next.date, now, today, (d) => relativeDayLabel(d, today), fmt)}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[21px] font-bold leading-tight tracking-tight">{next.event.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-sidebar-fg/70">
            {next.event.allDay ? 'Весь день' : `${fmt(next.event.startTime)} – ${fmt(next.event.endTime)}`}
            {next.event.location && (
              <span className="inline-flex items-center gap-1">
                · <MapPin className="h-3.5 w-3.5" /> {next.event.location}
              </span>
            )}
          </p>
          <div className="mt-auto flex items-center gap-2 pt-5">
            {next.event.url && (
              <a
                href={next.event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-[#172033] hover:bg-white/90"
              >
                Приєднатися
              </a>
            )}
            <button
              type="button"
              onClick={() => openEvent(next.event.id, next.date)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-medium hover:bg-white/15"
            >
              Деталі
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-fg/55">Найближчі 2 тижні</p>
          <p className="mt-1.5 text-[21px] font-bold leading-tight">Календар вільний</p>
          <p className="mt-1 text-[13px] text-sidebar-fg/70">Подій не заплановано.</p>
          <div className="mt-auto pt-5">
            <button
              type="button"
              onClick={() => openEventForm()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-[#172033]"
            >
              <Plus className="h-3.5 w-3.5" /> Додати подію
            </button>
          </div>
        </>
      )}
    </div>
  );

  const progress = (
    <Link to="/tasks?filter=today" className={cn(panel, 'flex min-h-[120px] flex-col justify-between gap-4 p-5 transition-colors hover:border-line')}>
      <div className="flex items-center gap-4">
        <Ring value={todayTasks.length ? doneCount / todayTasks.length : 0} size={64} stroke={7} color="rgb(var(--success))">
          <span className="text-[15px] font-bold tabular-nums">
            {doneCount}/{todayTasks.length}
          </span>
        </Ring>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Задачі на сьогодні</p>
          <p className="text-[12.5px] text-muted">
            {todayTasks.length === 0
              ? 'Задач немає'
              : openCount === 0
                ? 'Усе виконано'
                : `Ще ${openCount}${overdue.length ? ` · ${overdue.length} ${plural(overdue.length, ['прострочена', 'прострочені', 'прострочених'])}` : ''}`}
          </p>
          {bestStreak > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[12.5px] font-medium text-warning">
              <Flame className="h-3.5 w-3.5" /> Серія {bestStreak} {plural(bestStreak, ['день', 'дні', 'днів'])}
            </p>
          )}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-[12px] text-muted">
          <span>Цей тиждень</span>
          <span className="tabular-nums">
            {weekCounts.done} з {weekCounts.total}
          </span>
        </div>
        <Progress value={percent(weekCounts.done, weekCounts.total)} color="rgb(var(--primary))" label="Задачі цього тижня" />
      </div>
    </Link>
  );

  const weekStats: [number, [string, string, string]][] = [
    [week.eventCount, ['подія', 'події', 'подій']],
    [weekCounts.done, ['задача виконана', 'задачі виконано', 'задач виконано']],
    activeHabits.length > 0 ? [week.habitChecks, ['відмітка звичок', 'відмітки звичок', 'відміток звичок']] : [week.freeDays, ['вільний день', 'вільні дні', 'вільних днів']],
  ];
  const weekSummary = (
    <Link to="/calendar?view=week" className={cn(panel, 'flex min-h-[120px] flex-col p-5 transition-colors hover:border-line')}>
      <p className="text-[15px] font-semibold">Підсумок тижня</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {weekStats.map(([v, forms]) => (
          <div key={forms[2]} className="min-w-0 rounded-xl bg-surface-2 px-1 py-2.5">
            <p className="text-[19px] font-bold leading-tight tabular-nums">{v}</p>
            <p className="truncate text-[11.5px] text-muted">{plural(v, forms)}</p>
          </div>
        ))}
      </div>
      <p className="mt-auto truncate pt-3 text-[12.5px] text-muted">
        {week.busiest ? `Найзавантаженіший день — ${formatDateKey(week.busiest, 'EEEE').toLowerCase()}` : 'Тиждень поки спокійний'}
      </p>
    </Link>
  );

  const freePill = (text: string) => (
    <div className="mb-2 ml-[4.25rem] rounded-xl border border-dashed border-line px-3.5 py-2 text-[12.5px] text-subtle">{text}</div>
  );

  const nowLine = (
    <div className="relative my-1 flex items-center gap-3" aria-label={`Зараз ${minutesToTime(nowMinutes)}`}>
      <span className="w-11 text-right text-[11.5px] font-semibold tabular-nums text-danger">{fmt(minutesToTime(nowMinutes))}</span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
      <span className="h-px flex-1 bg-danger/50" />
    </div>
  );

  const scheduleBlock = (
    <Section title="Розклад дня" link={{ to: `/calendar?date=${today}&view=day`, label: 'Календар' }}>
      {allDay.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {allDay.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => openEvent(o.event.id, o.date)}
              className="rounded-lg px-2.5 py-1 text-[12.5px] font-semibold"
              style={{
                backgroundColor: tint(eventColor(o.event, categoryById), 0.14),
              }}
            >
              {o.event.title} <span className="font-normal text-muted">· весь день</span>
            </button>
          ))}
        </div>
      )}
      {schedule.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-2/70 px-4 py-8 text-center">
          <CalendarDays className="h-6 w-6 text-subtle" />
          <p className="text-[14px] text-muted">На сьогодні нічого не заплановано за часом.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openEventForm({ defaults: { date: today } })}>
              <Plus className="h-3.5 w-3.5" /> Подія
            </Button>
            <Button size="sm" variant="outline" onClick={() => openTaskForm({ defaults: { dueDate: today } })}>
              <Plus className="h-3.5 w-3.5" /> Задача
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {schedule.map((item, i) => {
            const past = (item.end ?? item.start) <= nowMinutes;
            const started = item.start <= nowMinutes;
            const row =
              item.kind === 'event' ? (
                <button
                  type="button"
                  onClick={() => openEvent(item.occurrence.event.id, item.occurrence.date)}
                  className="mb-2 block w-full rounded-xl px-3.5 py-2.5 text-left transition-[filter] hover:brightness-[0.98]"
                  style={{
                    backgroundColor: tint(eventColor(item.occurrence.event, categoryById), 0.1),
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{item.occurrence.event.title}</span>
                    {item.occurrence.event.recurrence && <Repeat className="h-3.5 w-3.5 shrink-0 text-muted" />}
                    <span className="shrink-0 text-[11px] font-medium text-muted">Подія</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted">
                    {fmt(item.occurrence.event.startTime)}
                    {item.occurrence.event.endTime ? ` – ${fmt(item.occurrence.event.endTime)}` : ''}
                    {item.occurrence.event.location ? ` · ${item.occurrence.event.location}` : ''}
                  </span>
                </button>
              ) : (
                <div className="mb-2 flex w-full items-start gap-3 rounded-xl border border-line px-3.5 py-2.5">
                  <span className="pt-0.5">
                    <CheckCircle
                      checked={item.task.status === 'completed'}
                      onChange={(c) => void actions.tasks.setDone(item.task, c).catch(() => undefined)}
                      label={`Виконати «${item.task.title}»`}
                      size="sm"
                    />
                  </span>
                  <button type="button" onClick={() => openTask(item.task.id)} className="min-w-0 flex-1 text-left">
                    <span className={cn('block truncate text-[14px] font-medium', item.task.status === 'completed' && 'text-subtle line-through')}>
                      {item.task.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {fmt(item.task.startTime)}
                      {item.task.endTime ? ` – ${fmt(item.task.endTime)}` : ''}
                      {item.task.subtasks.length > 0 && ` · підзадачі ${item.task.subtasks.filter((s) => s.done).length}/${item.task.subtasks.length}`}
                    </span>
                  </button>
                </div>
              );
            const color =
              item.kind === 'event' ? eventColor(item.occurrence.event, categoryById) : colorOf(categoryById(item.task.categoryId)?.color ?? 'slate');
            return (
              <div key={item.key}>
                {i === nowAt && nowLine}
                {i === nowAt && free.untilNext && freePill(`Вільно ${formatDuration(free.untilNext)}`)}
                <div className={cn('flex items-stretch gap-3', past && 'opacity-60')}>
                  <span className={cn('w-11 shrink-0 pt-2.5 text-right text-[12.5px] font-semibold tabular-nums', started ? 'text-subtle' : 'text-ink')}>
                    {fmt(minutesToTime(item.start))}
                  </span>
                  <div className="flex w-2 shrink-0 flex-col items-center">
                    <span className="mt-[15px] h-2 w-2 rounded-full ring-4 ring-surface" style={{ backgroundColor: color }} />
                    <span className={cn('w-px flex-1 bg-line', i === schedule.length - 1 && nowAt !== schedule.length && 'bg-transparent')} />
                  </div>
                  <div className="min-w-0 flex-1">{row}</div>
                </div>
              </div>
            );
          })}
          {nowAt === schedule.length && nowLine}
          {free.freeAfter !== undefined && freePill(`Вільно після ${fmt(minutesToTime(free.freeAfter))}`)}
        </div>
      )}
    </Section>
  );

  const untimedBlock = (untimed.length > 0 || overdue.length > 0) && (
    <Section title="Без часу" meta={untimed.length ? String(untimed.length) : undefined}>
      <div className="-mx-1">
        {untimed.slice(0, 6).map((t) => {
          const cat = categoryById(t.categoryId);
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
              <CheckCircle
                checked={false}
                onChange={(c) => void actions.tasks.setDone(t, c).catch(() => undefined)}
                label={`Виконати «${t.title}»`}
                size="sm"
              />
              <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 truncate text-left text-[14px]">
                {t.title}
              </button>
              {cat && (
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: tint(colorOf(cat.color), 0.12),
                    color: colorOf(cat.color),
                  }}
                >
                  {cat.name}
                </span>
              )}
            </div>
          );
        })}
        {untimed.length > 6 && (
          <Link to="/tasks?filter=today" className="block px-1 py-1 text-[12.5px] font-medium text-muted hover:text-ink">
            Ще {untimed.length - 6}
          </Link>
        )}
      </div>
      {overdue.length > 0 && (
        <Link
          to="/tasks?filter=overdue"
          className="mt-2 flex items-center justify-between rounded-xl bg-danger/[0.07] px-3 py-2 text-[13px] font-medium text-danger hover:bg-danger/10"
        >
          <span className="truncate">
            Прострочено: {overdue.length === 1 ? overdue[0].title : `${overdue.length} ${plural(overdue.length, ['задача', 'задачі', 'задач'])}`}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      )}
    </Section>
  );

  const habitsBlock = activeHabits.length > 0 && (
    <Section
      title="Звички"
      link={habitsToday.length ? undefined : { to: '/habits', label: 'Усі звички' }}
      meta={habitsToday.length ? `${habitsDone} з ${habitsToday.length}` : undefined}
    >
      {habitsToday.length === 0 ? (
        <p className="text-[13px] text-muted">Сьогодні звичок не заплановано.</p>
      ) : (
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {habitsToday.slice(0, 8).map((h) => {
            const value = habitValue(data.habitLogs, h.id, today);
            const done = isDone(h, data.habitLogs, today);
            const color = colorOf(h.color);
            const ratio = h.goalType === 'count' && h.kind !== 'bad' ? value / Math.max(1, h.target) : done ? 1 : 0;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => tapHabit(h)}
                aria-label={`${h.name}: ${h.goalType === 'count' ? `${value} з ${h.target}` : done ? 'виконано' : 'не виконано'}`}
                className="group flex min-w-0 flex-col items-center gap-1.5"
              >
                <Ring value={ratio} size={52} stroke={4.5} color={color}>
                  <span
                    className={cn(
                      'flex h-[38px] w-[38px] items-center justify-center rounded-full text-[18px] transition-colors',
                      done ? '' : 'group-hover:bg-surface-2',
                    )}
                    style={done ? { backgroundColor: tint(color, 0.14) } : undefined}
                  >
                    {h.icon}
                  </span>
                </Ring>
                <span className="w-full truncate text-center text-[11.5px] font-medium">{h.name}</span>
                <span className="-mt-1 text-[10.5px] tabular-nums text-subtle">{h.kind === 'bad' ? (done ? 'Без зривів' : 'Зрив') : h.goalType === 'count' ? `${value}/${h.target}` : done ? 'Готово' : '—'}</span>
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );

  const aheadBlock = (
    <Section title="Попереду" link={{ to: '/calendar?view=week', label: 'Тиждень' }}>
      {ahead.length === 0 ? (
        <p className="text-[13px] text-muted">Найближчі 7 днів подій немає.</p>
      ) : (
        <div className="space-y-3">
          {ahead.map((g) => (
            <div key={g.day}>
              <p className="mb-1 text-[12px] font-semibold text-subtle">{relativeDayLabel(g.day, today, 'EEEE, d MMM')}</p>
              {g.items.slice(0, 4).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => openEvent(o.event.id, o.date)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <span
                    className="h-6 w-[3px] shrink-0 rounded-full"
                    style={{
                      backgroundColor: eventColor(o.event, categoryById),
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{o.event.title}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted">{o.event.allDay ? 'весь день' : fmt(o.event.startTime)}</span>
                </button>
              ))}
              {g.items.length > 4 && <p className="pl-3 text-[12px] text-muted">ще {g.items.length - 4}</p>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );

  const goalsBlock = activeGoals.length > 0 && (
    <Section title="Цілі" link={{ to: '/goals', label: 'Усі' }}>
      <div className="space-y-3.5">
        {activeGoals.map((g) => (
          <Link key={g.id} to="/goals" className="block">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="truncate font-medium">{g.title}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {g.currentValue}/{g.targetValue}
              </span>
            </div>
            <Progress value={goalPercent(g)} color={colorOf(categoryById(g.categoryId)?.color ?? 'blue')} label={g.title} />
          </Link>
        ))}
      </div>
    </Section>
  );

  return (
    <PageContainer className="flex flex-col pb-6 pt-2 lg:min-h-[calc(100dvh-72px)] lg:pt-0">
      <header className="mb-5">
        <p className="text-[13px] font-medium text-muted">{formatDateKey(today, 'EEEE, d MMMM')}</p>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">
          {greetingFor(now)}
          {profile.firstName ? `, ${profile.firstName}` : ''}
        </h1>
      </header>

      <QuickAdd className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">{nextUp}</div>
        <div className="flex min-w-0 [&>a]:flex-1">{progress}</div>
        <div className="flex min-w-0 [&>a]:flex-1">{weekSummary}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">{scheduleBlock}</div>
        <div className="min-w-0 space-y-4 lg:col-span-5">
          {aheadBlock}
          {untimedBlock}
          {habitsBlock}
          {goalsBlock}
        </div>
      </div>

      <WeekBoard today={today} className="mt-6 lg:flex-1" />
    </PageContainer>
  );
}
