import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckSquare, Flame, Plus, Target } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardHeader, Progress, CheckCircle } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/States';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useNow } from '@/hooks/useNow';
import { useProfile } from '@/hooks/useProfile';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { addDaysKey, formatDateKey, formatTimeRange, greetingFor, relativeDayLabel, todayKey, weekRange } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { markdownExcerpt } from '@/lib/utils/markdown';
import { cn } from '@/lib/utils/cn';
import { TaskItem } from '@/features/tasks/TaskItem';
import { dayProgress, isOpen, isOverdue, percent, sortTasks, taskDate, weekProgress } from '@/features/tasks/logic';
import { expandEvents, loadByDay, upcomingOccurrences } from '@/features/calendar/logic';
import { currentStreak, habitValue, isDone, isScheduled } from '@/features/habits/logic';
import { goalPercent } from '@/features/goals/logic';
import { QuickAdd } from './QuickAdd';
import { MotivationCard } from './MotivationCard';

export default function DashboardPage() {
  const now = useNow();
  const today = todayKey(now);
  const { data } = useData();
  const { tasks, events, habits, goals, notes, categoryById } = useCollections();
  const settings = useSettings();
  const profile = useProfile();
  const { openTaskForm, openEvent, openEventForm } = useUI();
  const actions = useActions();

  const todayTasks = useMemo(
    () => sortTasks(tasks.filter((t) => taskDate(t) === today && t.status !== 'cancelled'), 'due'),
    [tasks, today],
  );
  const overdue = useMemo(() => tasks.filter((t) => isOverdue(t, today)), [tasks, today]);
  const todayCounts = dayProgress(tasks, today);
  const weekCounts = weekProgress(tasks, today, settings.weekStartsOn);
  const week = weekRange(today, settings.weekStartsOn);

  const upcoming = useMemo(() => upcomingOccurrences(events, now, today, 30, 5), [events, now, today]);
  const upcomingWeekCount = useMemo(() => upcomingOccurrences(events, now, today, 6, 999).length, [events, now, today]);
  const weekLoad = useMemo(
    () => loadByDay(expandEvents(events, week.start, week.end), tasks, week.start, week.end),
    [events, tasks, week.start, week.end],
  );
  const maxLoad = Math.max(1, ...weekLoad.map((d) => d.events + d.tasks));

  const activeHabits = habits.filter((h) => !h.archived);
  const habitsToday = activeHabits.filter((h) => isScheduled(h, today));
  const bestStreak = activeHabits.reduce((best, h) => Math.max(best, currentStreak(h, data.habitLogs, today)), 0);
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 4);
  const recentNotes = [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 3);
  const deadlines = sortTasks(
    tasks.filter((t) => isOpen(t) && t.dueDate && t.dueDate > today && t.dueDate <= addDaysKey(today, 14)),
    'due',
  ).slice(0, 4);

  const firstName = profile.firstName;

  return (
    <PageContainer className="pt-2 lg:pt-0">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight sm:text-[28px]">
            {greetingFor(now)}
            {firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
          </h2>
          <p className="mt-1 text-sm text-muted">Small steps every day lead to big results.</p>
        </div>
        <p className="text-sm text-muted">{formatDateKey(today, 'EEE, MMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Today's tasks"
          value={`${todayCounts.done} / ${todayCounts.total}`}
          progress={percent(todayCounts.done, todayCounts.total)}
          to="/tasks?filter=today"
        />
        <StatCard
          label="Upcoming events"
          value={upcomingWeekCount}
          hint="Next 7 days"
          icon={<CalendarDays />}
          to="/calendar"
        />
        <StatCard
          label="This week"
          value={`${weekCounts.done} / ${weekCounts.total}`}
          progress={percent(weekCounts.done, weekCounts.total)}
          progressColor="rgb(var(--primary))"
        />
        {activeHabits.length > 0 ? (
          <StatCard
            label="Current streak"
            value={`${bestStreak} ${bestStreak === 1 ? 'day' : 'days'}`}
            hint={bestStreak > 0 ? 'Keep going!' : 'Complete a habit today to start one'}
            icon={<Flame className="text-warning" />}
            to="/habits"
          />
        ) : (
          <StatCard
            label="Overdue"
            value={overdue.length}
            hint={overdue.length ? 'Tasks past their due date' : 'Nothing overdue'}
            to="/tasks?filter=overdue"
          />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader
            title="Today"
            subtitle={formatDateKey(today, 'EEE, MMM d')}
            action={
              <Link to="/tasks?filter=today" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="px-2 pb-3 pt-2">
            {todayTasks.length === 0 ? (
              <EmptyState
                compact
                icon={<CheckSquare />}
                title="Nothing planned for today"
                description="Add a task or enjoy the free time."
                action={
                  <Button size="sm" variant="outline" onClick={() => openTaskForm({ defaults: { dueDate: today } })}>
                    <Plus className="h-3.5 w-3.5" /> Add task
                  </Button>
                }
              />
            ) : (
              <div className="space-y-0.5">
                {todayTasks.slice(0, 7).map((t) => (
                  <TaskItem key={t.id} task={t} showDate={false} />
                ))}
                {todayTasks.length > 7 && (
                  <Link to="/tasks?filter=today" className="block px-3 py-2 text-xs font-medium text-muted hover:text-ink">
                    +{todayTasks.length - 7} more
                  </Link>
                )}
              </div>
            )}
            {overdue.length > 0 && (
              <Link
                to="/tasks?filter=overdue"
                className="mx-3 mt-2 flex items-center justify-between rounded-lg bg-danger/[0.07] px-3 py-2 text-xs font-medium text-danger"
              >
                {overdue.length} overdue {overdue.length === 1 ? 'task' : 'tasks'}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Card>
            <CardHeader
              title="Next events"
              action={
                <Link to="/calendar" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <div className="px-2 pb-3 pt-2">
              {upcoming.length === 0 ? (
                <EmptyState
                  compact
                  icon={<CalendarDays />}
                  title="No upcoming events"
                  action={
                    <Button size="sm" variant="outline" onClick={() => openEventForm()}>
                      <Plus className="h-3.5 w-3.5" /> Add event
                    </Button>
                  }
                />
              ) : (
                upcoming.map((o) => {
                  const cat = categoryById(o.event.categoryId);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => openEvent(o.event.id, o.date)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: colorOf(cat?.color ?? 'blue') }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{o.event.title}</span>
                        <span className="block text-xs tabular-nums text-muted">
                          {o.event.allDay ? 'All day' : formatTimeRange(o.event.startTime, o.event.endTime, settings.timeFormat)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-subtle">{relativeDayLabel(o.date < today ? today : o.date, today)}</span>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Quick add</h2>
            <QuickAdd />
          </Card>
        </div>

        <MotivationCard className="hidden lg:col-span-3 lg:flex" />

        <Card className="lg:col-span-5">
          <CardHeader title="This week" subtitle={`${formatDateKey(week.start, 'MMM d')} – ${formatDateKey(week.end, 'MMM d')}`} />
          <div className="flex h-[150px] items-end gap-2 px-5 pb-5 pt-4" role="img" aria-label="Tasks and events per day this week">
            {weekLoad.map((d) => {
              const total = d.events + d.tasks;
              const isToday = d.date === today;
              return (
                <Link
                  key={d.date}
                  to={`/calendar?date=${d.date}&view=day`}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                  title={`${formatDateKey(d.date, 'EEEE')}: ${d.tasks} tasks, ${d.events} events`}
                >
                  <span className="text-[11px] tabular-nums text-subtle">{total || ''}</span>
                  <div className="flex w-full max-w-[28px] flex-1 flex-col justify-end">
                    <div
                      className="flex w-full flex-col overflow-hidden rounded-md transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max(total ? 8 : 4, (total / maxLoad) * 100)}%` }}
                    >
                      {total === 0 ? (
                        <div className="h-full bg-line" />
                      ) : (
                        <>
                          <div className="bg-primary/70" style={{ flex: d.events }} />
                          <div className={cn(isToday ? 'bg-accent' : 'bg-subtle/60')} style={{ flex: d.tasks }} />
                        </>
                      )}
                    </div>
                  </div>
                  <span className={cn('text-[11px]', isToday ? 'font-semibold text-ink' : 'text-muted')}>
                    {formatDateKey(d.date, 'EEEEE')}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex gap-4 border-t border-line px-5 py-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-subtle/60" /> Tasks
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-primary/70" /> Events
            </span>
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader
            title="Habits today"
            action={
              <Link to="/habits" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="px-2 pb-3 pt-2">
            {habitsToday.length === 0 ? (
              <EmptyState
                compact
                icon={<Flame />}
                title={activeHabits.length ? 'No habits scheduled today' : 'No habits yet'}
                action={
                  !activeHabits.length && (
                    <Link to="/habits?new=1">
                      <Button size="sm" variant="outline">
                        <Plus className="h-3.5 w-3.5" /> Create habit
                      </Button>
                    </Link>
                  )
                }
              />
            ) : (
              habitsToday.map((h) => {
                const done = isDone(h, data.habitLogs, today);
                const value = habitValue(data.habitLogs, h.id, today);
                return (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${colorOf(h.color)}22` }}>
                      {h.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{h.name}</span>
                      <span className="block text-xs text-muted">
                        {h.goalType === 'count' ? `${value} / ${h.target} ${h.unit ?? ''}` : done ? 'Done' : 'Not yet'}
                      </span>
                    </span>
                    {h.goalType === 'count' && !done ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void actions.habits.setValue(h.id, today, value + 1).catch(() => undefined)}
                        aria-label={`Add one to ${h.name}`}
                      >
                        +1
                      </Button>
                    ) : (
                      <CheckCircle
                        checked={done}
                        color={colorOf(h.color)}
                        label={`${h.name} done today`}
                        onChange={(c) =>
                          void actions.habits.setValue(h.id, today, c ? (h.goalType === 'count' ? h.target : 1) : 0).catch(() => undefined)
                        }
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Goals"
            action={
              <Link to="/goals" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="space-y-4 px-5 pb-5 pt-4">
            {activeGoals.length === 0 ? (
              <EmptyState compact icon={<Target />} title="No active goals" className="!py-4" />
            ) : (
              activeGoals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate font-medium">{g.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">{goalPercent(g)}%</span>
                  </div>
                  <Progress value={goalPercent(g)} color={colorOf(categoryById(g.categoryId)?.color ?? 'blue')} label={g.title} />
                </div>
              ))
            )}
          </div>
        </Card>

        {deadlines.length > 0 && (
          <Card className="lg:col-span-5">
            <CardHeader title="Upcoming deadlines" subtitle="Next 14 days" />
            <div className="px-2 pb-3 pt-2">
              {deadlines.map((t) => (
                <TaskItem key={t.id} task={t} compact />
              ))}
            </div>
          </Card>
        )}

        {recentNotes.length > 0 && (
          <Card className={deadlines.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <CardHeader
              title="Recent notes"
              action={
                <Link to="/notes" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                  All notes <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <div className="grid gap-2 p-3 sm:grid-cols-3">
              {recentNotes.map((n) => (
                <Link key={n.id} to={`/notes/${n.id}`} className="rounded-xl border border-line p-3 transition-colors hover:bg-surface-2">
                  <p className="truncate text-[13.5px] font-medium">{n.title || 'Untitled note'}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{markdownExcerpt(n.content, 120) || 'Empty note'}</p>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
