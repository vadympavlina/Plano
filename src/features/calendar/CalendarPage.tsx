import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { RightPanel } from '@/components/layout/RightPanel';
import { TaskCheck } from '@/features/tasks/TaskViews';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { compareTasks, isOpen, taskDate } from '@/features/tasks/logic';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useNow } from '@/hooks/useNow';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import {
  addDaysKey,
  eachDateKey,
  formatDateKey,
  formatTimeRange,
  fromDateKey,
  isDateKey,
  monthGrid,
  relativeDayLabel,
  toDateKey,
  todayKey,
  weekRange,
} from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { CalendarView, DateKey, Task } from '@/types';
import { expandEvents, upcomingOccurrences } from './logic';
import { eventColor } from './items';
import { GoogleSyncButton } from '@/features/integrations/GoogleSyncButton';
import { TimeGrid } from './TimeGrid';
import { startTaskDrag } from './TaskTick';
import { MonthView } from './MonthView';
import { MiniCalendar } from '@/components/ui/calendar';
import { CategoryChip } from '@/components/common/CategoryMark';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'День' },
  { value: '3days', label: '3 дні' },
  { value: 'week', label: 'Тиждень' },
  { value: 'month', label: 'Місяць' },
];

function rangeFor(view: CalendarView, anchor: DateKey, weekStartsOn: 0 | 1) {
  if (view === 'day') return { start: anchor, end: anchor };
  if (view === '3days') return { start: anchor, end: addDaysKey(anchor, 2) };
  if (view === 'week') return weekRange(anchor, weekStartsOn);
  const grid = monthGrid(anchor, weekStartsOn);
  return { start: grid[0], end: grid[grid.length - 1] };
}

/** A big title and, under it, the year. */
function titleFor(view: CalendarView, anchor: DateKey, weekStartsOn: 0 | 1, compact: boolean) {
  const year = formatDateKey(anchor, 'yyyy');
  if (view === 'day') return { main: formatDateKey(anchor, compact ? 'EEEEEE, d MMM' : 'EEEE, d MMMM'), sub: year };
  if (view === 'month') return { main: formatDateKey(anchor, 'LLLL'), sub: year };
  const { start, end } = rangeFor(view, anchor, weekStartsOn);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const main = sameMonth
    ? `${formatDateKey(start, 'd')} – ${formatDateKey(end, compact ? 'd MMM' : 'd MMMM')}`
    : `${formatDateKey(start, 'd MMM')} – ${formatDateKey(end, 'd MMM')}`;
  return { main, sub: start.slice(0, 4) === end.slice(0, 4) ? year : `${start.slice(0, 4)} – ${end.slice(0, 4)}` };
}

export default function CalendarPage() {
  const settings = useSettings();
  const isDesktop = useIsDesktop();
  const wide = useMediaQuery('(min-width: 1280px)');
  const now = useNow(60_000);
  const today = todayKey(now);
  const [params, setParams] = useSearchParams();
  const { events, tasks, categoryById } = useCollections();
  const { openEventForm, openEvent, openTask, openQuickAdd } = useUI();
  useOpenFromQuery(() => openEventForm());

  const paramView = params.get('view');
  const view: CalendarView =
    paramView === 'day' || paramView === '3days' || paramView === 'week' || paramView === 'month'
      ? paramView
      : !isDesktop
        ? 'day' // phones open on today only; other views are one tap away
        : settings.defaultCalendarView;
  const paramDate = params.get('date');
  const anchor = paramDate && isDateKey(paramDate) ? paramDate : today;

  const navigate = (next: { date?: DateKey; view?: CalendarView }) => {
    const p = new URLSearchParams(params);
    if (next.date) p.set('date', next.date);
    if (next.view) p.set('view', next.view);
    setParams(p, { replace: true });
  };

  const step = (dir: 1 | -1) => {
    if (view === 'day') navigate({ date: addDaysKey(anchor, dir) });
    else if (view === '3days') navigate({ date: addDaysKey(anchor, 3 * dir) });
    else if (view === 'week') navigate({ date: addDaysKey(anchor, 7 * dir) });
    else navigate({ date: toDateKey(addMonths(fromDateKey(anchor), dir)) });
  };

  const range = rangeFor(view, anchor, settings.weekStartsOn);
  const occurrences = useMemo(() => expandEvents(events, range.start, range.end), [events, range.start, range.end]);
  const days = useMemo(() => (view === 'month' ? [] : eachDateKey(range.start, range.end)), [view, range.start, range.end]);
  const upcoming = useMemo(() => upcomingOccurrences(events, now, today, 30, 5), [events, now, today]);

  const monthMarks = useMemo(() => {
    const grid = monthGrid(anchor, settings.weekStartsOn);
    const set = new Set<DateKey>();
    for (const o of expandEvents(events, grid[0], grid[grid.length - 1])) {
      for (const d of eachDateKey(o.date, o.endDate)) set.add(d);
    }
    return set;
  }, [events, anchor, settings.weekStartsOn]);

  const selectDay = (d: DateKey) => navigate({ date: d, view: 'day' });
  const addEvent = () =>
    openQuickAdd({ kind: 'event', date: view === 'month' && anchor.slice(0, 7) !== today.slice(0, 7) ? anchor : view === 'day' ? anchor : today });

  // Side card: tasks waiting for a slot (drag them into the grid), then what is coming up.
  const inbox = useMemo(() => {
    const open = tasks.filter(isOpen);
    const rows = (list: Task[]) => list.sort(compareTasks('due'));
    return {
      overdue: rows(
        open.filter((t) => {
          const d = taskDate(t);
          return !!d && d < today;
        }),
      ),
      untimed: rows(open.filter((t) => taskDate(t) === today && !t.startTime)),
      undated: rows(open.filter((t) => !taskDate(t))),
    };
  }, [tasks, today]);

  const title = titleFor(view, anchor, settings.weekStartsOn, !wide && !isDesktop);

  const datePicker = (children: ReactNode) => (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="block max-w-full rounded-xl text-left" aria-label="Обрати дату">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px]">
        <MiniCalendar
          selected={anchor}
          today={today}
          weekStartsOn={settings.weekStartsOn}
          onSelect={(d) => navigate({ date: d })}
          markedDates={monthMarks}
          highlightRange={view === 'week' || view === '3days' ? range : undefined}
        />
      </PopoverContent>
    </Popover>
  );

  const taskRow = (t: Task) => (
    <div
      key={t.id}
      draggable
      onDragStart={(e) => startTaskDrag(e, t.id)}
      title="Перетягніть у календар, щоб призначити час"
      className="flex cursor-grab items-start gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-2/70 active:cursor-grabbing"
    >
      <span className="pt-px">
        <TaskCheck task={t} />
      </span>
      <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[14.5px] font-medium leading-snug">{t.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          {taskDate(t) && taskDate(t)! < today && <span>{relativeDayLabel(taskDate(t)!, today, 'EEEEEE, d MMM')}</span>}
          {t.categoryId && categoryById(t.categoryId) && <CategoryChip category={categoryById(t.categoryId)!} />}
        </span>
      </button>
    </div>
  );
  const sec = (label: string, list: Task[]) =>
    list.length > 0 && (
      <>
        <h3 className="mb-1 mt-5 px-2 text-[12px] font-semibold text-muted">
          {label} <span className="ml-1 font-medium text-subtle">{list.length}</span>
        </h3>
        {list.map(taskRow)}
      </>
    );

  const sidePanel = (
    <>
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[22px] font-extrabold tracking-tight">Вхідні</h2>
        <span className="text-[12px] text-subtle">перетягніть задачу в календар</span>
      </div>
      {sec('Прострочено', inbox.overdue)}
      {sec('Сьогодні без часу', inbox.untimed)}
      {sec('Без дати', inbox.undated)}
      {inbox.overdue.length + inbox.untimed.length + inbox.undated.length === 0 && <p className="px-2 pt-4 text-[13px] text-subtle">Усе розкладено по днях</p>}
      {upcoming.length > 0 && (
        <>
          <h3 className="mb-1 mt-6 px-2 text-[12px] font-semibold text-muted">Далі в календарі</h3>
          {upcoming.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => openEvent(o.event.id, o.date)}
              className="flex w-full items-start gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-surface-2/70"
            >
              <span className="mx-[6.5px] mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: eventColor(o.event, categoryById) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{o.event.title}</span>
                <span className="block text-[12px] tabular-nums text-muted">
                  {relativeDayLabel(o.date < today ? today : o.date, today, 'EEEEEE, d MMM')} ·{' '}
                  {o.event.allDay ? 'весь день' : formatTimeRange(o.event.startTime, o.event.endTime, settings.timeFormat)}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
    </>
  );

  return (
    <div className="flex w-full flex-col lg:h-[var(--page-h)]">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-2 pb-2 sm:pb-4">
        <div className="min-w-[9.5rem] max-w-full flex-1">
          {datePicker(
            <span className="block">
              <span className="block truncate text-[23px] font-extrabold leading-[1.1] tracking-tight first-letter:uppercase sm:text-[38px] sm:leading-[1.05]">
                {title.main}
              </span>
              <span className="mt-0.5 block text-[12.5px] font-medium text-muted sm:mt-1 sm:text-[13px]">{title.sub}</span>
            </span>,
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:gap-2 sm:pt-1">
          <GoogleSyncButton />
          <Select<CalendarView>
            variant="chip"
            aria-label="Вигляд календаря"
            value={view}
            onChange={(v) => navigate({ view: v })}
            options={VIEWS.map((v) => ({ value: v.value, label: v.label }))}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ date: today })}
            disabled={anchor === today}
            className={cn(anchor === today && 'hidden sm:inline-flex')}
          >
            Сьогодні
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Назад" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Вперед" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="dark" size="sm" onClick={addEvent} className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" /> Подія
          </Button>
        </div>
      </header>

      <div className="h-[calc(100dvh-250px)] min-h-[440px] min-w-0 flex-none overflow-hidden rounded-2xl lg:h-auto lg:min-h-0 lg:flex-1">
        {view === 'month' ? (
          <MonthView anchor={anchor} occurrences={occurrences} tasks={tasks} onSelectDay={selectDay} />
        ) : (
          <TimeGrid days={days} occurrences={occurrences} tasks={tasks} onSelectDay={selectDay} onSwipe={step} />
        )}
      </div>

      {wide && <RightPanel>{sidePanel}</RightPanel>}
    </div>
  );
}
