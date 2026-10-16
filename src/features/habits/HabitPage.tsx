import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { addMonths } from 'date-fns';
import { Archive, ArchiveRestore, ArrowLeft, Check, ChevronLeft, ChevronRight, Minus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useActions } from '@/hooks/useActions';
import { useToday } from '@/hooks/useNow';
import { addDaysKey, formatDateKey, fromDateKey, monthGrid, plural, toDateKey, weekdayLabels } from '@/lib/date';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Habit } from '@/types';
import {
  completionStats,
  currentStreak,
  describeSchedule,
  habitValue,
  isDone,
  isScheduled,
  longestStreak,
  totalCompletions,
  weekdayInsight,
  weeklyRates,
  isBad,
} from './logic';
import { HabitForm } from './HabitForm';
import { Ring, useHabitToggle } from './parts';

const WEEKDAY_ACC = ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', "п'ятницю", 'суботу'];
const days = (n: number) => `${n} ${plural(n, ['день', 'дні', 'днів'])}`;
const joinDays = (ds: number[]) => {
  const w = ds.map((d) => WEEKDAY_ACC[d]);
  return w.length > 1 ? `${w.slice(0, -1).join(', ')} і ${w[w.length - 1]}` : w[0];
};

function HabitListItem({ habit, active }: { habit: Habit; active: boolean }) {
  const { data } = useData();
  const today = useToday();
  const color = colorOf(habit.color);
  const value = habitValue(data.habitLogs, habit.id, today);
  const done = isDone(habit, data.habitLogs, today);
  const streak = currentStreak(habit, data.habitLogs, today);
  const ratio = habit.goalType === 'count' ? value / Math.max(1, habit.target) : done ? 1 : 0;
  return (
    <Link
      to={`/habits/${habit.id}`}
      aria-current={active ? 'page' : undefined}
      className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors', active ? 'bg-surface shadow-soft ring-1 ring-line' : 'hover:bg-surface/60')}
    >
      <Ring value={ratio} size={40} stroke={4} color={color}>
        <span className="text-[17px]">{habit.icon}</span>
      </Ring>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">{habit.name}</span>
        <span className="block text-[11.5px] text-muted">
          {!isScheduled(habit, today) && !done ? 'Сьогодні вихідний' : habit.goalType === 'count' ? `${value}/${habit.target} ${habit.unit ?? ''}` : isBad(habit) ? (done ? 'Без зривів' : 'Зрив') : done ? 'Виконано' : 'Ще ні'}
        </span>
      </span>
      {streak > 0 && <span className="text-[12px] font-semibold text-warning">🔥 {streak}</span>}
    </Link>
  );
}

export default function HabitPage() {
  const { habitId } = useParams();
  const { habits } = useCollections();
  const { data } = useData();
  const settings = useSettings();
  const actions = useActions();
  const toggle = useHabitToggle();
  const navigate = useNavigate();
  const today = useToday();
  const [month, setMonth] = useState(today.slice(0, 7) + '-01');
  const [editing, setEditing] = useState(false);

  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return <Navigate to="/habits" replace />;

  const logs = data.habitLogs;
  const color = colorOf(habit.color);
  const value = habitValue(logs, habit.id, today);
  const done = isDone(habit, logs, today);
  const bad = isBad(habit);
  const streak = currentStreak(habit, logs, today);
  const best = longestStreak(habit, logs, today);
  const month30 = completionStats(habit, logs, addDaysKey(today, -29), today, today);
  const total = totalCompletions(habit, logs);
  const weeks = weeklyRates(habit, logs, today, settings.weekStartsOn, 8);
  const insight = weekdayInsight(habit, logs, today);
  const grid = monthGrid(month, settings.weekStartsOn);
  const list = habits.filter((h) => !h.archived || h.id === habit.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const setValue = (v: number) => void actions.habits.setValue(habit.id, today, Math.max(0, v)).catch(() => undefined);
  const remove = async () => {
    const ok = await confirm({ title: 'Видалити звичку?', description: `«${habit.name}» і вся її історія буде видалено.`, confirmLabel: 'Видалити', danger: true });
    if (!ok) return;
    navigate('/habits', { replace: true });
    await actions.habits.remove(habit.id).then(() => toast.success('Звичку видалено'), () => undefined);
  };

  return (
    <div className="flex w-full gap-5 px-4 pb-8 sm:px-6 lg:h-[calc(100dvh-72px-2.5rem)] lg:px-6 lg:pb-0">
      {/* Habit list */}
      <nav aria-label="Звички" className="hidden w-[290px] shrink-0 flex-col lg:flex">
        <div className="mb-3 flex items-center justify-between px-1">
          <Link to="/habits" className="text-[22px] font-bold tracking-tight hover:text-muted">
            Звички
          </Link>
        </div>
        <div className="scrollbar-thin -mx-1 space-y-1 overflow-y-auto px-1 pb-4">
          {list.map((h) => (
            <HabitListItem key={h.id} habit={h} active={h.id === habit.id} />
          ))}
        </div>
      </nav>

      {/* Detail */}
      <div className="scrollbar-thin flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-[20px] border border-line/60 bg-surface p-5 shadow-soft sm:p-6">
        <Link to="/habits" className="mb-4 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-muted hover:text-ink lg:hidden">
          <ArrowLeft className="h-4 w-4" /> Усі звички
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[28px]" style={{ backgroundColor: tint(color, 0.13) }}>
            {habit.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[24px] font-bold tracking-tight sm:text-[26px]">{habit.name}</h1>
            <p className="text-[13.5px] text-muted">
              {describeSchedule(habit.schedule)}
              {habit.goalType === 'count' && ` · ${habit.target} ${habit.unit ?? ''} на день`} · з {formatDateKey(habit.startDate, 'd MMMM')}
              {habit.archived && ' · в архіві'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {habit.goalType === 'count' ? (
              <div className="flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: tint(color, 0.1) }}>
                <Button size="icon-sm" variant="ghost" aria-label="Зменшити" onClick={() => setValue(value - 1)} disabled={value <= 0}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[72px] text-center text-[14px] font-semibold tabular-nums" style={{ color: done ? color : undefined }}>
                  {value} / {habit.target}
                </span>
                <Button size="icon-sm" variant="ghost" aria-label="Збільшити" onClick={() => setValue(value + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void toggle(habit, today)}
                aria-pressed={done}
                className={cn('flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-colors', done ? 'text-white' : 'border-2')}
                style={done ? { backgroundColor: color } : { borderColor: tint(color, 0.5), color }}
              >
                <Check className="h-4 w-4 stroke-[3]" /> {bad ? (done ? 'Сьогодні без зривів · позначити зрив' : 'Зрив сьогодні · скасувати') : done ? 'Виконано сьогодні' : 'Відмітити сьогодні'}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-xl border border-line p-2.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Дії зі звичкою">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
                  Редагувати
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={habit.archived ? <ArchiveRestore /> : <Archive />}
                  onSelect={() => void actions.habits.update(habit.id, { archived: !habit.archived }).catch(() => undefined)}
                >
                  {habit.archived ? 'Відновити' : 'В архів'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => void remove()}>
                  Видалити
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [bad ? 'Без зривів' : 'Поточна серія', `${bad ? '🛡️' : '🔥'} ${days(streak)}`],
            ['Рекорд', `🏆 ${days(best)}`],
            ['За 30 днів', `${month30.rate}%`],
            [bad ? 'Зривів усього' : 'Усього', `${total} ${plural(total, ['раз', 'рази', 'разів'])}`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-surface-2 p-4">
              <p className="text-[12px] text-muted">{l}</p>
              <p className="mt-1 text-[20px] font-bold tabular-nums sm:text-[22px]">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Month calendar: tap a past day to fix it */}
          <section aria-label="Календар виконання">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold first-letter:uppercase">{formatDateKey(month, 'LLLL yyyy')}</h2>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Попередній місяць" onClick={() => setMonth(toDateKey(addMonths(fromDateKey(month), -1)))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Наступний місяць"
                  disabled={month >= today.slice(0, 7) + '-01'}
                  onClick={() => setMonth(toDateKey(addMonths(fromDateKey(month), 1)))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {weekdayLabels(settings.weekStartsOn).map((l) => (
                <span key={l} className="pb-1 text-[11px] text-subtle">
                  {l}
                </span>
              ))}
              {grid.map((d) => {
                const inMonth = d.slice(0, 7) === month.slice(0, 7);
                if (!inMonth) return <span key={d} />;
                const scheduled = isScheduled(habit, d);
                const future = d > today;
                const dDone = !future && scheduled && isDone(habit, logs, d);
                const slip = bad && !dDone && !future && scheduled;
                const v = habitValue(logs, habit.id, d);
                const partial = !dDone && habit.goalType === 'count' && v > 0;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={future || d < habit.startDate}
                    onClick={() => void toggle(habit, d, 'toggle')}
                    aria-pressed={dDone}
                    aria-label={`${formatDateKey(d, 'd MMMM')}: ${dDone ? 'виконано' : scheduled ? 'не виконано' : 'не заплановано'}`}
                    className={cn(
                      'flex aspect-square max-h-14 w-full items-center justify-center rounded-xl text-[13px] font-semibold tabular-nums transition-colors disabled:cursor-default',
                      d === today && 'ring-2 ring-offset-2 ring-offset-surface',
                      !dDone && !future && 'hover:brightness-95',
                    )}
                    style={{
                      backgroundColor: slip ? 'rgb(var(--danger))' : dDone ? (bad ? 'rgb(var(--success))' : color) : partial ? tint(color, 0.35) : future ? undefined : scheduled ? 'rgb(var(--surface-2))' : undefined,
                      color: dDone || slip ? '#fff' : future || !scheduled ? 'rgb(var(--subtle))' : 'rgb(var(--muted))',
                      ['--tw-ring-color' as string]: tint(color, 0.5),
                    }}
                  >
                    {Number(d.slice(8))}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-subtle">{bad ? 'Натисніть на день, щоб позначити або зняти зрив.' : 'Натисніть на день, щоб відмітити або зняти відмітку.'}</p>
          </section>

          <section aria-label="Статистика">
            <h2 className="mb-3 text-[14px] font-semibold">{bad ? 'Чисті дні по тижнях' : 'Виконання по тижнях'}</h2>
            <div className="flex h-[180px] items-end gap-2 rounded-2xl bg-surface-2 p-4">
              {weeks.map((w, i) => (
                <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Тиждень з ${formatDateKey(w.start, 'd MMM')}: ${w.rate}%`}>
                  <span className="text-[10.5px] tabular-nums text-muted">{w.scheduled ? `${w.rate}%` : ''}</span>
                  <div
                    className="w-full rounded-md transition-[height] duration-500"
                    style={{ height: `${Math.max(w.scheduled ? 4 : 2, w.rate)}%`, backgroundColor: i === weeks.length - 1 ? color : tint(color, 0.4) }}
                  />
                  <span className="text-[10px] text-subtle">{formatDateKey(w.start, 'd.MM')}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-[13px] leading-relaxed text-muted">
              {insight ? (
                <>
                  Найкраще виходить у <b className="text-ink">{joinDays(insight.best)}</b>. Найчастіше пропускаєте <b className="text-ink">{joinDays(insight.worst)}</b>.
                </>
              ) : (
                'Ще замало даних, щоб побачити закономірності. Продовжуйте відмічати — підказки з’являться за кілька тижнів.'
              )}
            </div>
          </section>
        </div>
      </div>
      {editing && <HabitForm habit={habit} onClose={() => setEditing(false)} />}
    </div>
  );
}
