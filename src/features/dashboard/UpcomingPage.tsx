import { useMemo, useState, type DragEvent } from 'react';
import { Columns3, List, Plus } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useNow } from '@/hooks/useNow';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { addDaysKey, eachDateKey, formatDateKey, formatTime, todayKey } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toast';
import { Segmented } from '@/components/ui/misc';
import type { DateKey, Task } from '@/types';
import { compareTasks, isOpen, taskDate } from '@/features/tasks/logic';
import { TaskCheck, TaskRow } from '@/features/tasks/TaskViews';
import { compareOccurrences, expandEvents, occurrencesOnDay, type EventOccurrence } from '@/features/calendar/logic';
import { eventColor } from '@/features/calendar/items';
import { CategoryChip } from '@/components/common/CategoryMark';

const VIEW_KEY = 'plano:upcoming-view';
const DAYS = 30;

type View = 'list' | 'board';
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
};

/** Everything planned for the next 30 days: a list grouped by day, or a board with a column per day. */
export default function UpcomingPage() {
  const { events, tasks, categoryById } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const { openEvent, openTask, openTaskForm } = useUI();
  const now = useNow(60_000);
  const today = todayKey(now);
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const days = useMemo(() => eachDateKey(today, addDaysKey(today, DAYS - 1)), [today]);
  const plan = useMemo(() => {
    const occ = expandEvents(events, today, days[days.length - 1]!);
    const open = tasks.filter(isOpen);
    const byDay = new Map<DateKey, { events: EventOccurrence[]; tasks: Task[] }>();
    for (const d of days) byDay.set(d, { events: occurrencesOnDay(occ, d).sort(compareOccurrences), tasks: [] });
    const overdue: Task[] = [];
    for (const t of open) {
      const d = taskDate(t);
      if (!d) continue;
      if (d < today) overdue.push(t);
      else byDay.get(d)?.tasks.push(t);
    }
    for (const v of byDay.values()) v.tasks.sort(compareTasks('due'));
    overdue.sort(compareTasks('due'));
    return { byDay, overdue };
  }, [events, tasks, days, today]);

  const dayName = (d: DateKey) => (d === today ? 'Сьогодні' : d === addDaysKey(today, 1) ? 'Завтра' : formatDateKey(d, 'EEEE'));

  const eventCard = (o: EventOccurrence) => {
    const cat = o.event.categoryId ? categoryById(o.event.categoryId) : undefined;
    return (
      <button key={o.key} type="button" onClick={() => openEvent(o.event.id, o.date)} className="flex w-full items-start gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-left transition-colors hover:bg-line/60">
        <span className="mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: eventColor(o.event, categoryById) }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-snug">{o.event.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
            <span className="tabular-nums">
              {o.event.allDay || !o.event.startTime
                ? 'Весь день'
                : `${formatTime(o.event.startTime, settings.timeFormat)}${o.event.endTime ? ` – ${formatTime(o.event.endTime, settings.timeFormat)}` : ''}`}
            </span>
            {cat && <CategoryChip category={cat} />}
          </span>
        </span>
      </button>
    );
  };

  // ---- board: drag a task onto another day to move it ----
  const [over, setOver] = useState<DateKey | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  const drop = (d: DateKey) => {
    setOver(null);
    const t = dragging;
    setDragging(null);
    if (!t || taskDate(t) === d) return;
    const was = taskDate(t);
    void actions.tasks.reschedule(t, d).then(
      () => toast.success(`«${t.title}» → ${formatDateKey(d, 'd MMMM')}`, { action: { label: 'Скасувати', onClick: () => void actions.tasks.reschedule(t, was).catch(() => undefined) } }),
      () => undefined,
    );
  };
  const onDragStart = (e: DragEvent, t: Task) => {
    setDragging(t);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t.id);
  };

  const groups = days.filter((d) => d === today || plan.byDay.get(d)!.events.length || plan.byDay.get(d)!.tasks.length);

  return (
    <div className="pb-6">
      <header className="flex items-start justify-between gap-3 px-2">
        <div>
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[38px]">Найближчі</h1>
          <p className="mt-1.5 text-[13px] text-muted">Наступні {DAYS} днів</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Segmented<View>
            ariaLabel="Вигляд"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: <Columns3 className="h-4 w-4" aria-label="Дошка" />, title: 'Дошка' },
              { value: 'list', label: <List className="h-4 w-4" aria-label="Список" />, title: 'Список' },
            ]}
          />
        </div>
      </header>

      {view === 'list' ? (
        <div className="mt-6 space-y-7 px-2">
          {plan.overdue.length > 0 && (
            <section className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-[110px_minmax(0,1fr)]">
              <h2 className="text-[15px] font-bold text-danger">Прострочено</h2>
              <div className="min-w-0 space-y-2">
                {plan.overdue.map((t) => (
                  <div key={t.id} className="rounded-2xl bg-surface-2">
                    <TaskRow task={t} today={today} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {groups.map((d) => {
            const g = plan.byDay.get(d)!;
            const isToday = d === today;
            return (
              <section key={d} className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-[110px_minmax(0,1fr)]">
                <h2 className="sm:pt-2.5">
                  <span className={cn('block text-[17px] font-bold capitalize', isToday && 'text-primary')}>{dayName(d)}</span>
                  <span className="text-[12px] font-medium text-muted">{formatDateKey(d, 'd MMM')}</span>
                </h2>
                <div className="min-w-0 space-y-2">
                  {g.events.map(eventCard)}
                  {g.tasks.map((t) => (
                    <div key={t.id} className="rounded-2xl bg-surface-2">
                      <TaskRow task={t} today={today} showDate={false} />
                    </div>
                  ))}
                  {!g.events.length && !g.tasks.length && <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-[13.5px] text-muted">На сьогодні вільно</p>}
                </div>
              </section>
            );
          })}
          {groups.length === 1 && !plan.byDay.get(today)!.events.length && !plan.byDay.get(today)!.tasks.length && !plan.overdue.length && (
            <p className="text-[13.5px] text-muted">Найближчим часом нічого не заплановано.</p>
          )}
        </div>
      ) : (
        <div className="no-scrollbar mt-6 flex gap-3 overflow-x-auto px-2 pb-2">
          {days.slice(0, 14).map((d) => {
            const g = plan.byDay.get(d)!;
            const isToday = d === today;
            return (
              <section
                key={d}
                aria-label={dayName(d)}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  if (over !== d) setOver(d);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(d);
                }}
                className={cn('flex w-[260px] shrink-0 flex-col rounded-[20px] bg-surface-2/60 p-2.5 transition-colors', over === d && 'bg-primary/10 ring-2 ring-primary/30')}
              >
                <div className="mb-2 flex items-baseline justify-between px-1.5">
                  <h2>
                    <span className={cn('text-[15px] font-bold capitalize', isToday && 'text-primary')}>{dayName(d)}</span>
                    <span className="ml-2 text-[12px] font-medium text-muted">{formatDateKey(d, 'd MMM')}</span>
                  </h2>
                  <button type="button" aria-label={`Додати задачу на ${formatDateKey(d, 'd MMMM')}`} onClick={() => openTaskForm({ defaults: { dueDate: d } })} className="rounded-full p-1 text-subtle hover:bg-line/60 hover:text-ink">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {g.events.map((o) => (
                    <div key={o.key} className="[&>button]:bg-surface">{eventCard(o)}</div>
                  ))}
                  {g.tasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, t)}
                      className="cursor-grab rounded-2xl bg-surface p-3 active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-3">
                        <TaskCheck task={t} />
                        <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left">
                          <span className="block text-[14.5px] font-medium leading-snug">{t.title}</span>
                          {t.startTime && <span className="mt-1 block text-[12px] tabular-nums text-muted">{formatTime(t.startTime, settings.timeFormat)}</span>}
                        </button>
                      </div>
                    </div>
                  ))}
                  {!g.events.length && !g.tasks.length && <p className="px-2 py-3 text-[12.5px] text-subtle">Вільно</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
