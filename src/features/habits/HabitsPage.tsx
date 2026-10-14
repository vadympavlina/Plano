import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Flame, Heart, Minus, MoreHorizontal, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, Segmented } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { EmptyState } from '@/components/common/States';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useActions } from '@/hooks/useActions';
import { useToday } from '@/hooks/useNow';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';
import { addDaysKey, eachDateKey, formatDateKey, plural, weekRange } from '@/lib/date';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Habit } from '@/types';
import { completionStats, currentStreak, describeSchedule, habitValue, isDone, isScheduled, longestStreak, totalCompletions } from './logic';
import { HabitForm } from './HabitForm';

const HISTORY_DAYS = 84; // 12 weeks

function HabitCard({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  const { data } = useData();
  const settings = useSettings();
  const actions = useActions();
  const today = useToday();
  const logs = data.habitLogs;
  const color = colorOf(habit.color);
  const week = eachDateKey(weekRange(today, settings.weekStartsOn).start, weekRange(today, settings.weekStartsOn).end);
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStats = completionStats(habit, logs, week[0], week[6], today);
  const monthStats = completionStats(habit, logs, monthStart, today, today);
  const streak = currentStreak(habit, logs, today);
  const best = longestStreak(habit, logs, today);
  const total = totalCompletions(habit, logs);
  const todayValue = habitValue(logs, habit.id, today);

  const history = useMemo(() => {
    const { start } = weekRange(addDaysKey(today, -(HISTORY_DAYS - 7)), settings.weekStartsOn);
    return eachDateKey(start, weekRange(today, settings.weekStartsOn).end);
  }, [today, settings.weekStartsOn]);

  const setValue = (date: string, value: number) =>
    void actions.habits.setValue(habit.id, date, Math.max(0, value)).catch(() => undefined);

  const toggleDay = (date: string) => {
    if (date > today) return;
    const done = isDone(habit, logs, date);
    setValue(date, done ? 0 : habit.goalType === 'check' ? 1 : habit.target);
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Видалити звичку?', description: `«${habit.name}» і вся її історія буде видалено.`, confirmLabel: 'Видалити', danger: true });
    if (ok) await actions.habits.remove(habit.id).then(() => toast.success('Звичку видалено'), () => undefined);
  };

  return (
    <Card className={cn('p-5', habit.archived && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: tint(color, 0.14) }}>
          {habit.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">{habit.name}</h3>
          <p className="text-xs text-muted">
            {describeSchedule(habit.schedule)}
            {habit.goalType === 'count' && ` · ${habit.target} ${habit.unit ?? ''} на день`}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-xs font-semibold text-warning" title="Поточна серія">
          <Flame className="h-3.5 w-3.5" />
          {streak}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-ink" aria-label={`Дії для «${habit.name}»`}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>Редагувати</DropdownMenuItem>
            <DropdownMenuItem icon={habit.archived ? <ArchiveRestore /> : <Archive />} onSelect={() => void actions.habits.update(habit.id, { archived: !habit.archived }).catch(() => undefined)}>
              {habit.archived ? 'Відновити' : 'В архів'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => void remove()}>Видалити</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* This week */}
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const scheduled = isScheduled(habit, d);
          const done = isDone(habit, logs, d);
          const future = d > today;
          const value = habitValue(logs, habit.id, d);
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              onClick={() => toggleDay(d)}
              aria-pressed={done}
              aria-label={`${formatDateKey(d, 'EEEE')}: ${done ? 'виконано' : scheduled ? 'не виконано' : 'не заплановано'}`}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] transition-colors disabled:cursor-default',
                d === today && 'ring-1 ring-line',
                !done && 'hover:bg-surface-2',
              )}
            >
              <span className={cn('font-medium', d === today ? 'text-ink' : 'text-subtle')}>{formatDateKey(d, 'EEEEEE')}</span>
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                  !done && scheduled && !future && 'border-[1.5px] border-dashed border-subtle/60',
                  !done && !scheduled && 'bg-surface-2 text-subtle/50',
                  future && !done && 'opacity-50',
                )}
                style={done ? { backgroundColor: color, color: 'white' } : undefined}
              >
                {done ? '✓' : habit.goalType === 'count' && value > 0 ? value : ''}
              </span>
            </button>
          );
        })}
      </div>

      {habit.goalType === 'count' && isScheduled(habit, today) && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
          <span className="text-xs text-muted">Сьогодні</span>
          <div className="flex items-center gap-2">
            <Button size="icon-sm" variant="outline" className="h-7 w-7" aria-label="Зменшити" onClick={() => setValue(today, todayValue - 1)} disabled={todayValue <= 0}>
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[56px] text-center text-sm font-semibold tabular-nums">
              {todayValue} / {habit.target}
            </span>
            <Button size="icon-sm" variant="outline" className="h-7 w-7" aria-label="Збільшити" onClick={() => setValue(today, todayValue + 1)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* History heatmap */}
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-medium text-subtle">Останні 12 тижнів</p>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label="Історія виконання">
          {history.map((d) => {
            const done = isDone(habit, logs, d);
            const scheduled = isScheduled(habit, d);
            return (
              <span
                key={d}
                title={`${formatDateKey(d, 'd MMM')}: ${done ? 'виконано' : scheduled ? (d > today ? 'попереду' : 'пропущено') : 'не заплановано'}`}
                className="aspect-square w-full rounded-[3px]"
                style={{ backgroundColor: done ? color : d > today ? 'transparent' : scheduled ? tint(color, 0.12) : 'rgb(var(--line) / 0.5)' }}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
        {[
          ['Тиждень', `${weekStats.rate}%`],
          ['Місяць', `${monthStats.rate}%`],
          ['Рекорд', `${best}`],
          ['Усього', `${total}`],
        ].map(([l, v]) => (
          <div key={l}>
            <p className="text-sm font-semibold tabular-nums">{v}</p>
            <p className="text-[11px] text-muted">{l}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function HabitsPage() {
  const { habits } = useCollections();
  const { data } = useData();
  const today = useToday();
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  useOpenFromQuery(() => setEditing('new'));

  const active = habits.filter((h) => !h.archived);
  const list = habits.filter((h) => (filter === 'active' ? !h.archived : h.archived)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dueToday = active.filter((h) => isScheduled(h, today));
  const doneToday = dueToday.filter((h) => isDone(h, data.habitLogs, today)).length;
  const bestStreak = active.reduce((m, h) => Math.max(m, currentStreak(h, data.habitLogs, today)), 0);

  return (
    <PageContainer>
      <PageHeader
        title="Звички"
        subtitle={active.length ? `Сьогодні виконано ${doneToday} з ${dueToday.length} · найкраща серія ${bestStreak} ${plural(bestStreak, ['день', 'дні', 'днів'])}` : 'Формуйте звички день за днем.'}
        actions={
          <Button variant="dark" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Нова звичка
          </Button>
        }
      />
      {habits.some((h) => h.archived) && (
        <Segmented
          className="mb-4"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Активні', count: active.length },
            { value: 'archived', label: 'Архів', count: habits.length - active.length },
          ]}
        />
      )}
      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Heart />}
            title={filter === 'archived' ? 'В архіві порожньо' : 'Звичок поки немає'}
            description="Відстежуйте спортзал, читання, воду чи прогулянки. Незаплановані дні ніколи не переривають серію."
            action={
              filter === 'active' && (
                <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
                  <Plus className="h-3.5 w-3.5" /> Створити звичку
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((h) => (
            <HabitCard key={h.id} habit={h} onEdit={() => setEditing(h)} />
          ))}
        </div>
      )}
      {bestStreak >= 7 && (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
          <Trophy className="h-4 w-4 text-warning" /> Серія {bestStreak} {plural(bestStreak, ['день', 'дні', 'днів'])} — чудова послідовність.
        </p>
      )}
      {editing && <HabitForm habit={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </PageContainer>
  );
}
