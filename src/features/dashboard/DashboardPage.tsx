import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckSquare, Flame, Plus } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { StatStrip } from '@/components/common/StatCard';
import { Card, Progress, CheckCircle } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/States';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useNow } from '@/hooks/useNow';
import { useProfile } from '@/hooks/useProfile';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { addDaysKey, plural, formatDateKey, formatTime, greetingFor, relativeDayLabel, todayKey, weekRange } from '@/lib/date';
import { colorOf, tint } from '@/lib/utils/colors';
import { markdownExcerpt } from '@/lib/utils/markdown';
import { cn } from '@/lib/utils/cn';
import { TaskItem } from '@/features/tasks/TaskItem';
import { dayProgress, isOpen, isOverdue, percent, sortTasks, taskDate, weekProgress } from '@/features/tasks/logic';
import { expandEvents, loadByDay, upcomingOccurrences, type EventOccurrence } from '@/features/calendar/logic';
import { currentStreak, habitValue, isDone, isScheduled } from '@/features/habits/logic';
import { goalPercent } from '@/features/goals/logic';
import { QuickAdd } from './QuickAdd';

function Panel({ title, meta, link, children, className }: { title: string; meta?: ReactNode; link?: { to: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
        <h2 className="text-[15px] font-semibold tracking-tight">
          {title}
          {meta && <span className="ml-2 text-[13px] font-normal text-muted">{meta}</span>}
        </h2>
        {link && (
          <Link to={link.to} className="shrink-0 text-[13px] font-medium text-muted hover:text-ink">
            {link.label}
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const now = useNow();
  const today = todayKey(now);
  const { data } = useData();
  const { tasks, events, habits, goals, notes, categoryById } = useCollections();
  const settings = useSettings();
  const profile = useProfile();
  const { openTaskForm, openEvent, openEventForm } = useUI();
  const actions = useActions();

  const todayTasks = useMemo(() => sortTasks(tasks.filter((t) => taskDate(t) === today && t.status !== 'cancelled'), 'due'), [tasks, today]);
  const openToday = todayTasks.filter((t) => t.status !== 'completed');
  const doneToday = todayTasks.filter((t) => t.status === 'completed');
  const overdue = useMemo(() => tasks.filter((t) => isOverdue(t, today)), [tasks, today]);
  const todayCounts = dayProgress(tasks, today);
  const weekCounts = weekProgress(tasks, today, settings.weekStartsOn);
  const week = weekRange(today, settings.weekStartsOn);

  const upcoming = useMemo(() => upcomingOccurrences(events, now, today, 30, 6), [events, now, today]);
  const upcomingWeekCount = useMemo(() => upcomingOccurrences(events, now, today, 6, 999).length, [events, now, today]);
  const agenda = useMemo(() => {
    const groups: { day: string; items: EventOccurrence[] }[] = [];
    for (const o of upcoming) {
      const day = o.date < today ? today : o.date;
      const g = groups.find((x) => x.day === day);
      if (g) g.items.push(o);
      else groups.push({ day, items: [o] });
    }
    return groups;
  }, [upcoming, today]);
  const weekLoad = useMemo(() => loadByDay(expandEvents(events, week.start, week.end), tasks, week.start, week.end), [events, tasks, week.start, week.end]);
  const maxLoad = Math.max(1, ...weekLoad.map((d) => d.events + d.tasks));

  const activeHabits = habits.filter((h) => !h.archived);
  const habitsToday = activeHabits.filter((h) => isScheduled(h, today));
  const bestStreak = activeHabits.reduce((best, h) => Math.max(best, currentStreak(h, data.habitLogs, today)), 0);
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 4);
  const recentNotes = [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 3);
  const deadlines = sortTasks(tasks.filter((t) => isOpen(t) && t.dueDate && t.dueDate > today && t.dueDate <= addDaysKey(today, 14)), 'due').slice(0, 4);

  return (
    <PageContainer className="pt-2 lg:pt-0">
      <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">
            {greetingFor(now)}
            {profile.firstName ? `, ${profile.firstName}` : ''}
          </h2>
          <p className="mt-1 text-[15px] text-muted">
            {todayCounts.total === 0
              ? 'На сьогодні задач немає.'
              : openToday.length === 0
                ? 'Усі задачі на сьогодні виконано.'
                : `Сьогодні ${openToday.length} ${plural(openToday.length, ['задача', 'задачі', 'задач'])} в роботі${upcomingWeekCount ? `, найближча подія ${upcoming[0] && relativeDayLabel(upcoming[0].date < today ? today : upcoming[0].date, today).toLowerCase()}` : ''}.`}
          </p>
        </div>
        <p className="text-sm text-muted">{formatDateKey(today, 'EEEE, d MMMM')}</p>
      </header>

      <StatStrip
        stats={[
          { label: 'Задачі на сьогодні', value: `${todayCounts.done} з ${todayCounts.total}`, progress: percent(todayCounts.done, todayCounts.total), to: '/tasks?filter=today' },
          { label: 'Цей тиждень', value: `${weekCounts.done} з ${weekCounts.total}`, progress: percent(weekCounts.done, weekCounts.total), progressColor: 'rgb(var(--primary))' },
          { label: 'Події за 7 днів', value: upcomingWeekCount, hint: upcoming[0] ? `Далі: ${upcoming[0].event.title}` : 'Календар вільний', to: '/calendar' },
          activeHabits.length > 0
            ? {
                label: 'Найкраща серія',
                value: `${bestStreak} ${plural(bestStreak, ['день', 'дні', 'днів'])}`,
                hint: bestStreak > 0 ? 'Не перервіть її сьогодні' : 'Виконайте звичку, щоб почати',
                accent: <Flame className="h-3.5 w-3.5 text-warning" />,
                to: '/habits',
              }
            : { label: 'Прострочені', value: overdue.length, hint: overdue.length ? 'Потребують уваги' : 'Нічого не прострочено', to: '/tasks?filter=overdue' },
        ]}
      />

      <QuickAdd className="mt-4" />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          className="min-h-[320px] lg:col-span-7"
          title="Сьогодні"
          meta={todayCounts.total ? `${todayCounts.done} з ${todayCounts.total}` : undefined}
          link={{ to: '/tasks?filter=today', label: 'Усі задачі' }}
        >
          <div className="flex flex-1 flex-col px-2 pb-2 pt-1">
            {todayTasks.length === 0 ? (
              <EmptyState
                className="flex-1"
                compact
                icon={<CheckSquare />}
                title="На сьогодні нічого не заплановано"
                description="Додайте задачу або залиште день вільним."
              />
            ) : (
              <>
                {openToday.map((t) => (
                  <TaskItem key={t.id} task={t} showDate={false} />
                ))}
                {doneToday.length > 0 && <div className="mx-3 my-1 border-t border-dashed border-line" />}
                {doneToday.map((t) => (
                  <TaskItem key={t.id} task={t} showDate={false} compact />
                ))}
              </>
            )}
            {overdue.length > 0 && (
              <Link to="/tasks?filter=overdue" className="mx-3 mt-1 flex items-center justify-between rounded-lg bg-danger/[0.07] px-3 py-2 text-[13px] font-medium text-danger hover:bg-danger/10">
                Прострочено: {overdue.length} {plural(overdue.length, ['задача', 'задачі', 'задач'])}
                <span className="font-normal">Переглянути</span>
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => openTaskForm({ defaults: { dueDate: today } })}
            className="flex w-full items-center gap-3 border-t border-line px-5 py-3 text-left text-sm text-muted transition-colors hover:bg-surface-2/60 hover:text-ink"
          >
            <Plus className="h-4 w-4" /> Додати задачу на сьогодні
          </button>
        </Panel>

          <Panel className="min-h-[320px] lg:col-span-5" title="Найближчі події" link={{ to: '/calendar', label: 'Календар' }}>
            <div className="flex flex-1 flex-col px-2 pb-3 pt-1">
              {agenda.length === 0 ? (
                <EmptyState
                  className="flex-1"
                  compact
                  icon={<CalendarDays />}
                  title="Найближчих подій немає"
                  action={
                    <Button size="sm" variant="outline" onClick={() => openEventForm()}>
                      <Plus className="h-3.5 w-3.5" /> Додати подію
                    </Button>
                  }
                />
              ) : (
                agenda.map((g) => (
                  <div key={g.day} className="mt-1">
                    <p className="px-3 pb-1 pt-2 text-xs font-medium text-subtle">{relativeDayLabel(g.day, today, 'EEEEEE, d MMM')}</p>
                    {g.items.map((o) => {
                      const color = colorOf(categoryById(o.event.categoryId)?.color ?? 'blue');
                      return (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => openEvent(o.event.id, o.date)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-2"
                        >
                          <span className="w-11 shrink-0 text-[13px] font-medium tabular-nums text-ink">
                            {o.event.allDay ? 'Весь' : formatTime(o.event.startTime, settings.timeFormat)}
                          </span>
                          <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium">{o.event.title}</span>
                            <span className="block truncate text-xs text-muted">
                              {o.event.allDay ? 'Весь день' : `до ${formatTime(o.event.endTime, settings.timeFormat)}`}
                              {o.event.location ? `, ${o.event.location}` : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </Panel>

        <Panel className="min-h-[280px] lg:col-span-7" title="Тиждень" meta={`${formatDateKey(week.start, 'd MMM')} – ${formatDateKey(week.end, 'd MMM')}`}>
          <div className="flex min-h-[168px] flex-1 items-end gap-2 px-5 pb-4 pt-3" role="img" aria-label="Задачі й події за днями цього тижня">
            {weekLoad.map((d) => {
              const total = d.events + d.tasks;
              const isToday = d.date === today;
              return (
                <Link
                  key={d.date}
                  to={`/calendar?date=${d.date}&view=day`}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                  title={`${formatDateKey(d.date, 'EEEE')}: задач — ${d.tasks}, подій — ${d.events}`}
                >
                  <span className={cn('text-[11px] tabular-nums', isToday ? 'font-semibold text-ink' : 'text-subtle')}>{total || ''}</span>
                  <div className="flex w-full max-w-[34px] flex-1 flex-col justify-end">
                    <div
                      className="flex w-full flex-col gap-[2px] overflow-hidden rounded-[7px] transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max(total ? 10 : 3, (total / maxLoad) * 100)}%` }}
                    >
                      {total === 0 ? (
                        <div className="h-full rounded-[7px] bg-line" />
                      ) : (
                        <>
                          {d.events > 0 && <div className="rounded-[3px] bg-primary/60" style={{ flex: d.events }} />}
                          {d.tasks > 0 && <div className={cn('rounded-[3px]', isToday ? 'bg-accent' : 'bg-subtle/50')} style={{ flex: d.tasks }} />}
                        </>
                      )}
                    </div>
                  </div>
                  <span className={cn('text-xs', isToday ? 'font-semibold text-ink' : 'text-muted')}>{formatDateKey(d.date, 'EEEEEE')}</span>
                </Link>
              );
            })}
          </div>
          <div className="flex gap-4 px-5 pb-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-subtle/50" /> Задачі
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-primary/60" /> Події
            </span>
          </div>
        </Panel>

        <Panel className="min-h-[280px] lg:col-span-5" title="Звички на сьогодні" link={{ to: '/habits', label: 'Усі звички' }}>
          <div className="flex flex-1 flex-col px-2 pb-3 pt-1">
            {habitsToday.length === 0 ? (
              <EmptyState
                className="flex-1"
                compact
                icon={<Flame />}
                title={activeHabits.length ? 'Сьогодні звичок не заплановано' : 'Звичок поки немає'}
                action={
                  !activeHabits.length && (
                    <Link to="/habits?new=1">
                      <Button size="sm" variant="outline">
                        <Plus className="h-3.5 w-3.5" /> Створити звичку
                      </Button>
                    </Link>
                  )
                }
              />
            ) : (
              habitsToday.map((h) => {
                const done = isDone(h, data.habitLogs, today);
                const value = habitValue(data.habitLogs, h.id, today);
                const color = colorOf(h.color);
                return (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ backgroundColor: tint(color, 0.14) }}>
                      {h.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{h.name}</span>
                      <span className="block text-xs text-muted">
                        {h.goalType === 'count' ? `${value} з ${h.target} ${h.unit ?? ''}` : done ? 'Виконано' : 'Ще ні'}
                      </span>
                    </span>
                    {h.goalType === 'count' && !done ? (
                      <Button size="xs" variant="outline" onClick={() => void actions.habits.setValue(h.id, today, value + 1).catch(() => undefined)} aria-label={`Додати 1 до «${h.name}»`}>
                        +1
                      </Button>
                    ) : (
                      <CheckCircle
                        checked={done}
                        color={color}
                        label={`«${h.name}» виконано сьогодні`}
                        onChange={(c) => void actions.habits.setValue(h.id, today, c ? (h.goalType === 'count' ? h.target : 1) : 0).catch(() => undefined)}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        {(activeGoals.length > 0 || deadlines.length > 0) && (
          <>
            {deadlines.length > 0 && (
              <Panel className={activeGoals.length ? 'lg:col-span-7' : 'lg:col-span-12'} title="Дедлайни" meta="на 14 днів">
                <div className="px-2 pb-2 pt-1">
                  {deadlines.map((t) => (
                    <TaskItem key={t.id} task={t} compact />
                  ))}
                </div>
              </Panel>
            )}
            {activeGoals.length > 0 && (
              <Panel className={deadlines.length ? 'lg:col-span-5' : 'lg:col-span-12'} title="Цілі" link={{ to: '/goals', label: 'Усі цілі' }}>
                <div className="space-y-4 px-5 pb-5 pt-3">
                  {activeGoals.map((g) => (
                    <div key={g.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate font-medium">{g.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          {g.currentValue} з {g.targetValue} {g.unit}
                        </span>
                      </div>
                      <Progress value={goalPercent(g)} color={colorOf(categoryById(g.categoryId)?.color ?? 'blue')} label={g.title} />
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}

        {recentNotes.length > 0 && (
          <Panel className="lg:col-span-12" title="Останні нотатки" link={{ to: '/notes', label: 'Усі нотатки' }}>
            <div className="grid gap-2 p-3 sm:grid-cols-3">
              {recentNotes.map((n) => (
                <Link key={n.id} to={`/notes/${n.id}`} className="rounded-xl border border-line p-3.5 transition-colors hover:bg-surface-2">
                  <p className="truncate text-[13.5px] font-medium">{n.title || 'Без назви'}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{markdownExcerpt(n.content, 120) || 'Порожня нотатка'}</p>
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </PageContainer>
  );
}
