import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Flame, Plus, TriangleAlert, X } from 'lucide-react';
import { RightPanel } from '@/components/layout/RightPanel';
import { toast } from '@/components/ui/toast';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useData } from '@/app/providers/DataProvider';
import { useNow } from '@/hooks/useNow';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { addDaysKey, formatDateKey, formatTime, plural, relativeDayLabel, todayKey } from '@/lib/date';
import { colorOf, inkOf, onColor, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptic';
import type { DateKey, Habit } from '@/types';
import { doneInList } from '@/features/tasks/lists';
import { compareTasks, isOpen, taskDate } from '@/features/tasks/logic';
import { TaskRow } from '@/features/tasks/TaskViews';
import { compareOccurrences, expandEvents, upcomingOccurrences } from '@/features/calendar/logic';
import { eventColor } from '@/features/calendar/items';
import { currentStreak, habitValue, isBad, isDone, isScheduled, nextHabitValue, slipLimit } from '@/features/habits/logic';
import { QuickAdd } from './QuickAdd';

const STRIP_DAYS = 21;

function salutation(now: Date) {
  const h = now.getHours();
  return h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
}

/** A coloured count inside the summary sentence. */
function Chip({ tone, icon, children }: { tone: 'red' | 'grey' | 'orange'; icon: ReactNode; children: ReactNode }) {
  const cls = {
    red: 'text-danger',
    grey: 'bg-line/70 text-muted',
    orange: 'bg-warning/15 text-warning-ink',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold [&>svg]:h-3.5 [&>svg]:w-3.5',
        cls,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const BAD_TONE = {
  clean: { box: 'border-solid border-success bg-success/10', badge: 'bg-success', text: 'text-success' },
  near: { box: 'border-dashed border-warning bg-warning/10', badge: 'bg-warning text-[#1b1b1d]!', text: 'text-warning-ink' },
  slip: { box: 'border-solid border-danger bg-danger/10', badge: 'bg-danger', text: 'text-danger' },
};

/** A habit as a tile with a ring around it: one tap marks it. The ring fills with the day's progress. */
function HabitTile({
  name,
  icon,
  color,
  progress,
  done,
  badge,
  badgeClass,
  caption,
  dashed,
  ariaLabel,
  title,
  onClick,
}: {
  name: string;
  icon: ReactNode;
  color: string;
  progress: number;
  done: boolean;
  badge?: ReactNode;
  badgeClass?: string;
  caption?: string;
  dashed?: boolean;
  ariaLabel: string;
  title?: string;
  onClick: () => void;
}) {
  const r = 23;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className="group flex w-[60px] shrink-0 flex-col items-center gap-1 transition-transform active:scale-95 sm:w-[68px]"
    >
      <span
        className="relative flex h-[54px] w-[54px] items-center justify-center rounded-full text-[22px]"
        style={{ backgroundColor: tint(color, done ? 0.26 : 0.1) }}
      >
        <svg viewBox="0 0 54 54" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="27" cy="27" r={r} fill="none" stroke={tint(color, 0.22)} strokeWidth="3" strokeDasharray={dashed ? '4 4' : undefined} />
          {progress > 0 && (
            <circle
              cx="27"
              cy="27"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - Math.min(1, progress))}
            />
          )}
        </svg>
        <span className="relative">{icon}</span>
        {badge != null && (
          <span
            className={cn(
              'absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface px-1 text-[11px] font-bold tabular-nums',
              badgeClass && 'text-on-fill',
              badgeClass,
            )}
            style={badgeClass ? undefined : { backgroundColor: color, color: onColor(color) }}
          >
            {badge}
          </span>
        )}
      </span>
      <span className={cn('w-full truncate text-center text-[11.5px] font-medium leading-tight sm:text-[12px]', done ? 'text-muted' : 'text-ink')}>{name}</span>
      {caption && <span className="-mt-0.5 w-full truncate text-center text-[11px] leading-tight text-subtle">{caption}</span>}
    </button>
  );
}

export default function DashboardPage() {
  const { events, tasks, habits, categoryById } = useCollections();
  const { data } = useData();
  const settings = useSettings();
  const actions = useActions();
  const { openEvent } = useUI();
  const now = useNow(60_000);
  const today = todayKey(now);
  const [selected, setSelected] = useState<DateKey>(today);
  const day = selected;
  const isToday = day === today;
  const past = day < today;

  // The strip of days: it keeps the selected day in view and starts a few days before today.
  const [stripStart, setStripStart] = useState<DateKey>(today);
  const stripRef = useRef<HTMLDivElement>(null);
  const strip = useMemo(() => Array.from({ length: STRIP_DAYS }, (_, i) => addDaysKey(stripStart, i)), [stripStart]);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-current="date"]');
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  const move = (by: number) => {
    const next = addDaysKey(selected, by);
    setSelected(next);
    if (next < stripStart) setStripStart(next);
    else if (next > addDaysKey(stripStart, STRIP_DAYS - 1)) setStripStart(addDaysKey(next, -(STRIP_DAYS - 1)));
  };
  const goToday = () => {
    setSelected(today);
    setStripStart(today);
  };

  const dayData = useMemo(() => {
    const occ = expandEvents(events, day, day).sort(compareOccurrences);
    const dated = tasks.filter((t) => taskDate(t) === day && t.status !== 'cancelled');
    const open = dated.filter(isOpen).sort(compareTasks('due'));
    const done = tasks
      .filter((t) => doneInList(t, 'today', day) && (taskDate(t) === day || day === today))
      .sort((a, b) => ((a.completedAt ?? a.updatedAt) < (b.completedAt ?? b.updatedAt) ? 1 : -1));
    return { occ, open, done, habits: habits.filter((h) => !h.archived && isScheduled(h, day)) };
  }, [events, tasks, habits, day, today]);

  const goodHabits = dayData.habits.filter((h) => !isBad(h));
  const badHabits = dayData.habits.filter(isBad);
  const important = dayData.open.filter((t) => t.priority === 'high' || t.priority === 'urgent').length;
  const badHolding = badHabits.filter((h) => isDone(h, data.habitLogs, day)).length;
  const empty = !dayData.occ.length && !dayData.open.length && !dayData.done.length && !dayData.habits.length;

  const tapHabit = (h: Habit, date: DateKey) => {
    if (date > today) return;
    haptic();
    void actions.habits.setValue(h.id, date, nextHabitValue(h, habitValue(data.habitLogs, h.id, date))).catch(() => undefined);
  };
  const tapBad = (h: Habit) => {
    const before = habitValue(data.habitLogs, h.id, day);
    const next = nextHabitValue(h, before);
    tapHabit(h, day);
    // A slip is easy to log by accident: offer a way back.
    if (next > before)
      toast.info(`Записано зрив: ${h.name}`, {
        action: { label: 'Скасувати', onClick: () => void actions.habits.setValue(h.id, day, before).catch(() => undefined) },
      });
  };
  const badState = (h: Habit) => {
    const value = habitValue(data.habitLogs, h.id, day);
    const limit = slipLimit(h);
    if (value > limit) return { tone: 'slip' as const, value, limit, label: 'Зрив' };
    if (value > 0) return { tone: 'near' as const, value, limit, label: value === limit ? 'ліміт вичерпано' : `ще ${limit - value} до ліміту` };
    const streak = currentStreak(h, data.habitLogs, today);
    return { tone: 'clean' as const, value, limit, streak, label: streak > 0 ? `${streak} дн. без` : 'Сьогодні чисто' };
  };

  // ---- the day, in one list: all-day first, then by time ----
  type Entry = { key: string; at: number; node: ReactNode };
  const entries: Entry[] = [];
  const minutes = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : -1);
  for (const o of dayData.occ) {
    const color = eventColor(o.event, categoryById);
    const cat = o.event.categoryId ? categoryById(o.event.categoryId) : undefined;
    entries.push({
      key: o.key,
      at: o.event.allDay ? -2 : minutes(o.event.startTime),
      node: (
        <button
          type="button"
          onClick={() => openEvent(o.event.id, o.date)}
          className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2/70"
        >
          <span className="mx-[6.5px] mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-medium leading-snug">{o.event.title}</span>
            <span className="mt-1 flex items-center gap-2.5 text-[12px] text-muted">
              <span className="tabular-nums">
                {o.event.allDay || !o.event.startTime
                  ? 'Весь день'
                  : `${formatTime(o.event.startTime, settings.timeFormat)}${o.event.endTime ? ` – ${formatTime(o.event.endTime, settings.timeFormat)}` : ''}`}
              </span>
              {o.event.location && <span className="truncate">{o.event.location}</span>}
              {cat && (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
                  style={{ backgroundColor: tint(colorOf(cat.color), 0.12), color: inkOf(colorOf(cat.color)) }}
                >
                  {cat.name}
                </span>
              )}
            </span>
          </span>
        </button>
      ),
    });
  }
  for (const t of dayData.open)
    entries.push({ key: `t${t.id}`, at: t.startTime ? minutes(t.startTime) : -1, node: <TaskRow task={t} today={today} showDate={false} /> });
  entries.sort((a, b) => a.at - b.at);

  const nextUp = isToday ? upcomingOccurrences(events, now, today, 1, 1).find((o) => o.date === today) : undefined;
  const tomorrow = addDaysKey(today, 1);
  const dayLabel = isToday ? 'Сьогодні' : day === tomorrow ? 'Завтра' : day === addDaysKey(today, -1) ? 'Вчора' : formatDateKey(day, 'EEEE');

  // ---- inbox (right panel) ----
  const inbox = useMemo(() => {
    const open = tasks.filter(isOpen);
    return {
      overdue: open
        .filter((t) => {
          const d = taskDate(t);
          return !!d && d < today;
        })
        .sort(compareTasks('due')),
      undated: open.filter((t) => !taskDate(t)).sort(compareTasks('due')),
      soon: upcomingOccurrences(events, now, today, 7, 6),
    };
  }, [tasks, events, now, today]);
  const [draft, setDraft] = useState('');
  const addInbox = (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    const { id, write } = actions.tasks.create({ title, status: 'todo', priority: 'medium', tags: [], subtasks: [] });
    write.catch(() => toast.error('Не вдалося додати задачу'));
    toast.success(`Додано до вхідних: ${title}`, { action: { label: 'Скасувати', onClick: () => void actions.tasks.remove(id).catch(() => undefined) } });
    setDraft('');
  };
  const sec = (title: string, count?: number) => (
    <h3 className="mb-1 mt-5 flex items-center gap-2 px-3 text-[12px] font-semibold text-muted">
      {title}
      {count != null && <span className="font-medium text-subtle">{count}</span>}
    </h3>
  );

  return (
    <div className="pb-6">
      <header className="flex items-center justify-between gap-3 px-2">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-tight first-letter:uppercase sm:text-[38px]">{dayLabel}</h1>
          <p className="mt-1 truncate text-[13px] text-muted first-letter:uppercase">
            {isToday && `${salutation(now)} · `}
            <span className="sm:hidden">{isToday ? formatDateKey(day, 'EEEE, d MMMM') : formatDateKey(day, 'd MMMM')}</span>
            <span className="hidden sm:inline">{formatDateKey(day, 'EEEE, d MMMM yyyy')}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={goToday}
            disabled={isToday}
            className={cn(
              'h-8 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60',
              isToday && 'max-sm:hidden',
            )}
          >
            Сьогодні
          </button>
          <button
            type="button"
            aria-label="Попередній день"
            onClick={() => move(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Наступний день"
            onClick={() => move(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        ref={stripRef}
        role="tablist"
        aria-label="Дні"
        className="no-scrollbar mt-2.5 flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-px-2 px-2 pb-0.5 sm:mt-5"
      >
        {strip.map((d) => {
          const on = d === selected;
          const dot = d === today;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              aria-current={on ? 'date' : undefined}
              aria-label={formatDateKey(d, 'EEEE, d MMMM')}
              onClick={() => setSelected(d)}
              className={cn(
                'flex h-[50px] w-[calc((100%-2.25rem)/7)] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl text-[16px] sm:h-[62px] sm:w-[52px] sm:text-[17px] font-bold tabular-nums transition-colors',
                on ? 'border-[1.5px] border-primary text-primary' : 'border-[1.5px] border-transparent hover:bg-surface-2',
                !on && dot && 'text-primary',
              )}
            >
              <span>{Number(d.slice(8))}</span>
              <span className={cn('text-[11.5px] font-medium capitalize', on ? 'text-primary' : 'text-muted')}>{formatDateKey(d, 'EEEEEE')}</span>
            </button>
          );
        })}
      </div>

      {/* The day in numbers: one plain line on a phone, a block of chips on a desktop. */}
      {!empty && (
        <p className="mx-2 mt-2 truncate text-[13px] text-muted sm:hidden">
          {[
            dayData.occ.length > 0 && `${dayData.occ.length} ${plural(dayData.occ.length, ['подія', 'події', 'подій'])}`,
            dayData.open.length > 0 && `${dayData.open.length} ${plural(dayData.open.length, ['задача', 'задачі', 'задач'])}`,
            important > 0 && `${important} ${plural(important, ['важлива', 'важливі', 'важливих'])}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          {nextUp && (
            <>
              {' · '}Далі: <span className="font-semibold text-ink">{nextUp.event.title}</span> о {formatTime(nextUp.event.startTime!, settings.timeFormat)}
            </>
          )}
        </p>
      )}
      <div className={cn('mx-2 mt-3 flex-wrap items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3.5 text-[14.5px] max-sm:hidden sm:flex')}>
        {empty ? (
          <span className="text-muted">Тут поки порожньо — додайте задачу або подію.</span>
        ) : (
          <>
            <span>{isToday ? 'Сьогодні у вас' : past ? 'Цього дня було' : 'На цей день у вас'}</span>
            {dayData.occ.length > 0 && (
              <Chip tone="red" icon={<CalendarDays />}>
                {dayData.occ.length} {plural(dayData.occ.length, ['подія', 'події', 'подій'])}
              </Chip>
            )}
            {dayData.habits.length > 0 && (
              <Chip tone="grey" icon={<Flame />}>
                {dayData.habits.length} {plural(dayData.habits.length, ['звичка', 'звички', 'звичок'])}
              </Chip>
            )}
            {dayData.open.length > 0 && (
              <Chip tone="grey" icon={<Check />}>
                {dayData.open.length} {plural(dayData.open.length, ['задача', 'задачі', 'задач'])}
              </Chip>
            )}
            {important > 0 && (
              <Chip tone="orange" icon={<TriangleAlert />}>
                {important} {plural(important, ['важлива', 'важливі', 'важливих'])}
              </Chip>
            )}
          </>
        )}
        {nextUp && (
          <span className="basis-full text-[13px] text-muted">
            Далі: <span className="font-semibold text-ink">{nextUp.event.title}</span> о {formatTime(nextUp.event.startTime!, settings.timeFormat)}
          </span>
        )}
      </div>

      {/* Habits first, right under the numbers: one tap marks one. «Кидаю» tiles have their own look and an undo. */}
      {(goodHabits.length > 0 || badHabits.length > 0) && (
        <div className="no-scrollbar mx-2 mt-2.5 flex gap-3 overflow-x-auto sm:mt-3 sm:flex-wrap sm:gap-5 sm:overflow-visible">
          {goodHabits.length > 0 && (
            <div role="group" aria-label="Звички" className="shrink-0">
              <h2 className="mb-1.5 px-0.5 text-[12px] font-semibold text-muted max-sm:sr-only">
                Звички{' '}
                <span className="ml-1 font-medium text-subtle">
                  {goodHabits.filter((h) => isDone(h, data.habitLogs, day)).length} з {goodHabits.length}
                </span>
              </h2>
              <div className="flex gap-2">
                {goodHabits.map((h) => {
                  const value = habitValue(data.habitLogs, h.id, day);
                  const done = isDone(h, data.habitLogs, day);
                  const streak = currentStreak(h, data.habitLogs, today);
                  const color = colorOf(h.color);
                  const progress = h.goalType === 'count' ? value / Math.max(1, h.target) : done ? 1 : 0;
                  return (
                    <HabitTile
                      key={h.id}
                      name={h.name}
                      icon={h.icon}
                      color={color}
                      progress={progress}
                      done={done}
                      badge={done ? <Check className="h-3 w-3 stroke-[3.5]" /> : h.goalType === 'count' && value > 0 ? `${value}/${h.target}` : undefined}
                      ariaLabel={`${h.name}: ${h.goalType === 'count' ? `${value} з ${h.target}` : done ? 'виконано' : 'не виконано'}`}
                      title={streak ? `Серія: ${streak} ${plural(streak, ['день', 'дні', 'днів'])}` : undefined}
                      onClick={() => tapHabit(h, day)}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {badHabits.length > 0 && (
            <div role="group" aria-label="Кидаю" className="shrink-0 border-l border-line pl-3 sm:border-0 sm:pl-0">
              <h2 className="mb-1.5 px-0.5 text-[12px] font-semibold text-muted max-sm:sr-only">
                Кидаю{' '}
                <span className="ml-1 font-medium text-subtle">
                  {badHolding} з {badHabits.length}
                </span>
              </h2>
              <div className="flex gap-2">
                {badHabits.map((h) => {
                  const st = badState(h);
                  const tone = BAD_TONE[st.tone];
                  const color = st.tone === 'slip' ? '#E5484D' : st.tone === 'near' ? '#F0A54A' : '#35B98A';
                  const badge =
                    st.tone === 'slip' ? <X className="h-3 w-3" strokeWidth={3} /> : st.tone === 'near' ? `${st.value}/${st.limit}` : st.streak || null;
                  return (
                    <HabitTile
                      key={h.id}
                      name={h.name}
                      icon={h.icon}
                      color={color}
                      progress={st.tone === 'clean' ? 1 : st.tone === 'slip' ? 1 : st.value / Math.max(1, st.limit)}
                      done={st.tone === 'clean'}
                      dashed={st.tone === 'near'}
                      badge={badge}
                      badgeClass={tone.badge}
                      ariaLabel={`${h.name}: ${st.tone === 'slip' ? 'зрив' : st.label}. Натисніть, щоб записати зрив`}
                      title={
                        h.goalType === 'count'
                          ? 'Натисніть, щоб додати ще один зрив'
                          : st.tone === 'slip'
                            ? 'Натисніть, щоб прибрати зрив'
                            : 'Натисніть, якщо не втримались'
                      }
                      onClick={() => tapBad(h)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mx-2 mt-2.5 sm:mt-3">
        <QuickAdd />
      </div>

      <div className="mt-2">
        {entries.map((e) => (
          <div key={e.key}>{e.node}</div>
        ))}
        {dayData.done.map((t) => (
          <TaskRow key={t.id} task={t} today={today} showDate={false} />
        ))}
      </div>

      <RightPanel>
        <div className="flex items-center justify-between px-3">
          <h2 className="text-[22px] font-extrabold tracking-tight">Вхідні</h2>
          <Link to="/tasks" className="-mr-2 rounded-full px-2 py-2 text-[12.5px] font-semibold text-muted hover:text-ink">
            Усі задачі
          </Link>
        </div>
        <form onSubmit={addInbox} className="mt-3 flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-subtle/70 text-subtle">
            <Plus className="h-3 w-3" strokeWidth={3} />
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Нова задача у вхідні"
            placeholder="Нова задача…"
            className="-my-2 min-w-0 flex-1 bg-transparent py-2 text-[15.5px] font-medium outline-hidden placeholder:font-normal placeholder:text-subtle"
          />
        </form>
        {inbox.overdue.length > 0 && (
          <>
            {sec('Прострочено', inbox.overdue.length)}
            {inbox.overdue.map((t) => (
              <TaskRow key={t.id} task={t} today={today} />
            ))}
          </>
        )}
        {sec('Без дати', inbox.undated.length)}
        {inbox.undated.map((t) => (
          <TaskRow key={t.id} task={t} today={today} />
        ))}
        {inbox.undated.length === 0 && <p className="px-3 py-1 text-[13px] text-subtle">Усе розібрано</p>}
        {inbox.soon.length > 0 && (
          <>
            {sec('Найближчі події')}
            {inbox.soon.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => openEvent(o.event.id, o.date)}
                className="flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface-2/70"
              >
                <span className="mx-[6.5px] mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: eventColor(o.event, categoryById) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{o.event.title}</span>
                  <span className="text-[12px] text-muted">
                    {relativeDayLabel(o.date, today, 'EEEEEE, d MMM')}
                    {!o.event.allDay && o.event.startTime ? ` · ${formatTime(o.event.startTime, settings.timeFormat)}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </RightPanel>
    </div>
  );
}
