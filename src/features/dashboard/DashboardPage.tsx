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
import { colorOf, tint } from '@/lib/utils/colors';
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
    red: 'bg-danger/12 text-danger',
    grey: 'bg-line/70 text-muted',
    orange: 'bg-warning/15 text-warning',
  }[tone];
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold [&>svg]:h-3.5 [&>svg]:w-3.5', cls)}>
      {icon}
      {children}
    </span>
  );
}

const BAD_TONE = {
  clean: { box: 'border-solid border-success bg-success/10', badge: 'bg-success', text: 'text-success' },
  near: { box: 'border-dashed border-warning bg-warning/10', badge: 'bg-warning', text: 'text-warning' },
  slip: { box: 'border-solid border-danger bg-danger/10', badge: 'bg-danger', text: 'text-danger' },
};

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
    const done = tasks.filter((t) => doneInList(t, 'today', day) && (taskDate(t) === day || day === today)).sort((a, b) => ((a.completedAt ?? a.updatedAt) < (b.completedAt ?? b.updatedAt) ? 1 : -1));
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
      toast.info(`Записано зрив: ${h.name}`, { action: { label: 'Скасувати', onClick: () => void actions.habits.setValue(h.id, day, before).catch(() => undefined) } });
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
        <button type="button" onClick={() => openEvent(o.event.id, o.date)} className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2/70">
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
              {cat && <span className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ backgroundColor: tint(colorOf(cat.color), 0.12), color: colorOf(cat.color) }}>{cat.name}</span>}
            </span>
          </span>
        </button>
      ),
    });
  }
  for (const t of dayData.open)
    entries.push({ key: `t${t.id}`, at: t.startTime ? minutes(t.startTime) : -1, node: <TaskRow task={t} today={today} showDate={false} /> });
  const habitRows: ReactNode[] = [];
  for (const h of goodHabits) {
    const value = habitValue(data.habitLogs, h.id, day);
    const done = isDone(h, data.habitLogs, day);
    const streak = currentStreak(h, data.habitLogs, today);
    const color = colorOf(h.color);
    habitRows.push(
      (
        <button
          type="button"
          onClick={() => tapHabit(h, day)}
          aria-label={`${h.name}: ${h.goalType === 'count' ? `${value} з ${h.target}` : done ? 'виконано' : 'не виконано'}`}
          className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2/70"
        >
          <span className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg text-[13px]" style={{ backgroundColor: tint(color, done ? 0.28 : 0.14) }}>
            {done ? <Check className="h-3.5 w-3.5 stroke-[3.2]" style={{ color }} /> : h.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[15.5px] font-medium leading-snug', done && 'text-muted line-through')}>
              {h.name}
              {h.goalType === 'count' && <span className="ml-2 text-[13px] font-normal text-muted">{value} з {h.target}{h.unit ? ` ${h.unit}` : ''}</span>}
            </span>
            <span className="mt-1 flex items-center gap-2 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5" style={{ color: streak ? '#ff7a1a' : undefined }} />{streak ? `серія ${streak}` : 'звичка'}</span>
            </span>
          </span>
        </button>
      ),
    );
  }
  entries.sort((a, b) => a.at - b.at);

  const nextUp = isToday
    ? upcomingOccurrences(events, now, today, 1, 1).find((o) => o.date === today)
    : undefined;
  const tomorrow = addDaysKey(today, 1);
  const dayLabel = isToday ? 'Сьогодні' : day === tomorrow ? 'Завтра' : day === addDaysKey(today, -1) ? 'Вчора' : formatDateKey(day, 'EEEE');

  // ---- inbox (right panel) ----
  const inbox = useMemo(() => {
    const open = tasks.filter(isOpen);
    return {
      overdue: open.filter((t) => { const d = taskDate(t); return !!d && d < today; }).sort(compareTasks('due')),
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
      <header className="flex items-start justify-between gap-3 px-2">
        <div className="min-w-0">
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-tight first-letter:uppercase sm:text-[38px]">{dayLabel}</h1>
          <p className="mt-1.5 text-[13px] text-muted first-letter:uppercase">
            <span className="sm:hidden">{formatDateKey(day, 'EEEE, d MMMM')}</span>
            <span className="hidden sm:inline">{formatDateKey(day, 'EEEE, d MMMM yyyy')}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-1">
          <button type="button" onClick={goToday} disabled={isToday} className={cn('h-8 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60', isToday && 'max-sm:hidden')}>
            Сьогодні
          </button>
          <button type="button" aria-label="Попередній день" onClick={() => move(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-ink">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Наступний день" onClick={() => move(1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-ink">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={stripRef} role="tablist" aria-label="Дні" className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto px-2 pb-1">
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
                'flex h-[62px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-[17px] font-bold tabular-nums transition-colors',
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

      <div className="mx-2 mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl bg-surface-2 px-4 py-3.5 text-[14.5px]">
        {empty ? (
          <span className="text-muted">
            {isToday ? `${salutation(now)}! ` : ''}Тут поки порожньо — додайте задачу або подію.
          </span>
        ) : (
          <>
            <span>{isToday ? `${salutation(now)}, сьогодні у вас` : past ? 'Цього дня було' : 'На цей день у вас'}</span>
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

      <div className="mx-2 mt-3">
        <QuickAdd />
      </div>

      <div className="mt-3">
        {entries.map((e) => (
          <div key={e.key}>{e.node}</div>
        ))}
        {dayData.done.map((t) => (
          <TaskRow key={t.id} task={t} today={today} showDate={false} />
        ))}
      </div>

      {habitRows.length > 0 && (
        <section className="mt-4" aria-label="Звички">
          <h2 className="mb-1 flex items-baseline justify-between px-3 text-[12px] font-semibold text-muted">
            Звички
            <span className="font-medium">{goodHabits.filter((h) => isDone(h, data.habitLogs, day)).length} з {goodHabits.length}</span>
          </h2>
          {habitRows.map((r, i) => (
            <div key={goodHabits[i]!.id}>{r}</div>
          ))}
        </section>
      )}

      {badHabits.length > 0 && (
        <section className="mx-2 mt-4 border-t border-line pt-4" aria-label="Кидаю">
          <h2 className="mb-2 flex items-baseline justify-between px-1 text-[12px] font-semibold text-muted">
            Кидаю
            <span className="font-medium">{badHolding} з {badHabits.length} {plural(badHolding, ['тримається', 'тримаються', 'тримаються'])}</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {badHabits.map((h) => {
              const st = badState(h);
              const tone = BAD_TONE[st.tone];
              const badge = st.tone === 'slip' ? <X className="h-3 w-3" strokeWidth={3} /> : st.tone === 'near' ? `${st.value}/${st.limit}` : st.streak || null;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => tapBad(h)}
                  aria-label={`${h.name}: ${st.tone === 'slip' ? 'зрив' : st.label}. Натисніть, щоб записати зрив`}
                  title={h.goalType === 'count' ? 'Натисніть, щоб додати ще один' : st.tone === 'slip' ? 'Натисніть, щоб прибрати зрив' : 'Натисніть, якщо не втримались'}
                  className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5 text-left transition-transform active:scale-[0.98]"
                >
                  <span className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border-[2.5px] text-[17px]', tone.box)}>
                    {h.icon}
                    {badge != null && (
                      <span className={cn('absolute -bottom-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-surface-2 px-1 text-[10px] font-bold tabular-nums text-white', tone.badge)}>
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{h.name}</span>
                    <span className={cn('block truncate text-[12px]', tone.text)}>{st.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11.5px] text-subtle">Натискання записує зрив; його можна скасувати.</p>
        </section>
      )}

      <RightPanel>
        <div className="flex items-center justify-between px-3">
          <h2 className="text-[22px] font-extrabold tracking-tight">Вхідні</h2>
          <Link to="/tasks" className="text-[12.5px] font-semibold text-muted hover:text-ink">
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
            placeholder="Нова задача"
            className="min-w-0 flex-1 bg-transparent text-[15.5px] font-medium outline-none placeholder:font-normal placeholder:text-subtle"
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
              <button key={o.key} type="button" onClick={() => openEvent(o.event.id, o.date)} className="flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface-2/70">
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
