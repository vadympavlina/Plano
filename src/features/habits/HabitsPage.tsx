import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useToday } from '@/hooks/useNow';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';
import { addDaysKey, eachDateKey, formatDateKey, plural, weekRange } from '@/lib/date';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Habit } from '@/types';
import { completionStats, currentStreak, describeSchedule, habitValue, isDone, isScheduled, longestStreak } from './logic';
import { HabitForm } from './HabitForm';
import { HabitQuickButton } from './parts';

const HEAT_WEEKS = 18;

function HabitCard({ habit }: { habit: Habit }) {
  const { data } = useData();
  const settings = useSettings();
  const today = useToday();
  const logs = data.habitLogs;
  const color = colorOf(habit.color);
  const streak = currentStreak(habit, logs, today);
  const best = longestStreak(habit, logs, today);
  const month = completionStats(habit, logs, addDaysKey(today, -29), today, today);
  const value = habitValue(logs, habit.id, today);
  const scheduledToday = isScheduled(habit, today);

  const days = useMemo(() => {
    const end = weekRange(today, settings.weekStartsOn).end;
    const start = weekRange(addDaysKey(today, -(HEAT_WEEKS - 1) * 7), settings.weekStartsOn).start;
    return eachDateKey(start, end);
  }, [today, settings.weekStartsOn]);

  return (
    <Link
      to={`/habits/${habit.id}`}
      className={cn('group flex flex-col rounded-[20px] border border-line/60 bg-surface p-5 shadow-soft transition-shadow hover:shadow-pop', habit.archived && 'opacity-60')}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[24px]" style={{ backgroundColor: tint(color, 0.13) }}>
          {habit.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold tracking-tight">{habit.name}</h3>
          <p className="truncate text-[12.5px] text-muted">
            {describeSchedule(habit.schedule)}
            {habit.goalType === 'count' && ` · ${scheduledToday ? `${value}/` : ''}${habit.target} ${habit.unit ?? ''}`}
          </p>
        </div>
        {!habit.archived && (scheduledToday || isDone(habit, logs, today)) && <HabitQuickButton habit={habit} today={today} />}
      </div>

      <div
        className="mt-4 grid grid-flow-col grid-rows-7 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Історія «${habit.name}» за ${HEAT_WEEKS} тижнів`}
      >
        {days.map((d) => {
          const done = isDone(habit, logs, d);
          const partial = !done && habit.goalType === 'count' && habitValue(logs, habit.id, d) > 0;
          const scheduled = isScheduled(habit, d);
          return (
            <span
              key={d}
              title={`${formatDateKey(d, 'd MMM')}: ${done ? 'виконано' : d > today ? 'попереду' : scheduled ? (partial ? 'частково' : 'пропущено') : 'не заплановано'}`}
              className={cn('aspect-square w-full rounded-[3px]', d === today && 'ring-1 ring-ink/40')}
              style={{
                backgroundColor: d > today ? 'transparent' : done ? color : partial ? tint(color, 0.45) : scheduled ? 'rgb(var(--surface-2))' : 'rgb(var(--line) / 0.35)',
              }}
            />
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          [String(streak), 'серія'],
          [String(best), 'рекорд'],
          [`${month.rate}%`, 'за 30 днів'],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-surface-2 py-2">
            <p className="text-[16px] font-bold tabular-nums">{v}</p>
            <p className="text-[11px] text-muted">{l}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

export default function HabitsPage() {
  const { habits } = useCollections();
  const { data } = useData();
  const today = useToday();
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [creating, setCreating] = useState(false);
  useOpenFromQuery(() => setCreating(true));

  const active = habits.filter((h) => !h.archived);
  const list = habits.filter((h) => (filter === 'active' ? !h.archived : h.archived)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dueToday = active.filter((h) => isScheduled(h, today));
  const doneToday = dueToday.filter((h) => isDone(h, data.habitLogs, today)).length;
  const bestStreak = active.reduce((m, h) => Math.max(m, currentStreak(h, data.habitLogs, today)), 0);

  return (
    <div className="w-full px-4 pb-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3">
        <h1 className="text-[26px] font-bold tracking-tight sm:text-[28px]">Звички</h1>
        {active.length > 0 && (
          <span className="text-[13.5px] text-muted">
            Сьогодні {doneToday} з {dueToday.length}
            {bestStreak > 0 && ` · найдовша серія ${bestStreak} ${plural(bestStreak, ['день', 'дні', 'днів'])}`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {habits.some((h) => h.archived) && (
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'active', label: 'Активні', count: active.length },
                { value: 'archived', label: 'Архів', count: habits.length - active.length },
              ]}
            />
          )}
          <Button variant="dark" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Звичка
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-[20px] border border-line/60 bg-surface shadow-soft">
          <EmptyState
            icon={<Heart />}
            title={filter === 'archived' ? 'В архіві порожньо' : 'Звичок поки немає'}
            description="Відстежуйте спортзал, читання, воду чи прогулянки. Незаплановані дні ніколи не переривають серію."
            action={
              filter === 'active' && (
                <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-3.5 w-3.5" /> Створити звичку
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((h) => (
            <HabitCard key={h.id} habit={h} />
          ))}
        </div>
      )}
      {bestStreak >= 7 && (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
          <Trophy className="h-4 w-4 text-warning" /> Серія {bestStreak} {plural(bestStreak, ['день', 'дні', 'днів'])} — чудова послідовність.
        </p>
      )}
      {creating && <HabitForm onClose={() => setCreating(false)} />}
    </div>
  );
}
