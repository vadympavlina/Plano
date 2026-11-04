import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addMonths } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Segmented } from '@/components/ui/misc';
import { RightPanel } from '@/components/layout/RightPanel';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useActions } from '@/hooks/useActions';
import { solidTint } from '@/lib/utils/colors';
import { taskDate } from '@/features/tasks/logic';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useNow } from '@/hooks/useNow';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import {
  addDaysKey,
  eachDateKey,
  formatDateKey,
  formatDuration,
  formatTimeRange,
  fromDateKey,
  isDateKey,
  monthGrid,
  relativeDayLabel,
  timeToMinutes,
  toDateKey,
  todayKey,
  weekRange,
} from '@/lib/date';
import type { CalendarView, DateKey } from '@/types';
import { expandEvents, occurrencesOnDay, upcomingOccurrences } from './logic';
import { eventColor } from './items';
import { GoogleSyncButton } from '@/features/integrations/GoogleSyncButton';
import { TimeGrid } from './TimeGrid';
import { startTaskDrag } from './TaskTick';
import { MonthView } from './MonthView';
import { MiniCalendar } from '@/components/ui/calendar';
import { EmptyState } from '@/components/common/States';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';

function rangeFor(view: CalendarView, anchor: DateKey, weekStartsOn: 0 | 1) {
  if (view === 'day') return { start: anchor, end: anchor };
  if (view === 'week') return weekRange(anchor, weekStartsOn);
  const grid = monthGrid(anchor, weekStartsOn);
  return { start: grid[0], end: grid[grid.length - 1] };
}

function titleFor(view: CalendarView, anchor: DateKey, weekStartsOn: 0 | 1, compact = false) {
  if (compact) {
    if (view === 'day') return formatDateKey(anchor, 'EEEEEE, d MMM');
    if (view === 'month') return formatDateKey(anchor, 'LLLL');
    const r = weekRange(anchor, weekStartsOn);
    return r.start.slice(0, 7) === r.end.slice(0, 7)
      ? `${formatDateKey(r.start, 'd')}–${formatDateKey(r.end, 'd MMM')}`
      : `${formatDateKey(r.start, 'd MMM')} – ${formatDateKey(r.end, 'd MMM')}`;
  }
  if (view === 'day') return formatDateKey(anchor, 'EEEE, d MMMM yyyy');
  if (view === 'month') return formatDateKey(anchor, 'LLLL yyyy');
  const { start, end } = weekRange(anchor, weekStartsOn);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth ? `${formatDateKey(start, 'd')} – ${formatDateKey(end, 'd MMMM yyyy')}` : `${formatDateKey(start, 'd MMM')} – ${formatDateKey(end, 'd MMM yyyy')}`;
}

export default function CalendarPage() {
  const settings = useSettings();
  const isDesktop = useIsDesktop();
  const now = useNow(60_000);
  const today = todayKey(now);
  const [params, setParams] = useSearchParams();
  const { events, tasks, categoryById } = useCollections();
  const { openEventForm, openEvent, openTask, openQuickAdd } = useUI();
  useOpenFromQuery(() => openEventForm());
  const actions = useActions();

  const paramView = params.get('view');
  const view: CalendarView =
    paramView === 'day' || paramView === 'week' || paramView === 'month'
      ? paramView
      : !isDesktop && settings.defaultCalendarView === 'week'
        ? 'day'
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
    else if (view === 'week') navigate({ date: addDaysKey(anchor, 7 * dir) });
    else navigate({ date: toDateKey(addMonths(fromDateKey(anchor), dir)) });
  };

  const range = rangeFor(view, anchor, settings.weekStartsOn);
  const occurrences = useMemo(() => expandEvents(events, range.start, range.end), [events, range.start, range.end]);
  const days = useMemo(() => (view === 'month' ? [] : eachDateKey(range.start, range.end)), [view, range.start, range.end]);
  const upcoming = useMemo(() => upcomingOccurrences(events, now, today, 30, 6), [events, now, today]);

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

  // Right rail: what's left of today, and today's tasks without a time.
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const laterToday = useMemo(
    () =>
      occurrencesOnDay(expandEvents(events, today, today), today).filter(
        (o) => !o.event.allDay && o.event.endTime && timeToMinutes(o.event.endTime) > nowMinutes,
      ),
    [events, today, nowMinutes],
  );
  const untimedToday = useMemo(
    () => tasks.filter((t) => taskDate(t) === today && !t.startTime && t.status !== 'completed' && t.status !== 'cancelled'),
    [tasks, today],
  );

  const viewSwitch = (className?: string, stretch?: boolean) => (
    <Segmented
      ariaLabel="Вигляд календаря"
      size="sm"
      stretch={stretch}
      className={className}
      value={view}
      onChange={(v) => navigate({ view: v })}
      options={[
        { value: 'day', label: 'День' },
        { value: 'week', label: 'Тиждень' },
        { value: 'month', label: 'Місяць' },
      ]}
    />
  );

  const datePicker = (children: ReactNode, className: string) => (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={className} aria-label="Обрати дату">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px]">
        <MiniCalendar selected={anchor} today={today} weekStartsOn={settings.weekStartsOn} onSelect={(d) => navigate({ date: d })} markedDates={monthMarks} />
      </PopoverContent>
    </Popover>
  );

  const wide = useMediaQuery('(min-width: 1280px)');

  const sidePanel = (
    <>
      <MiniCalendar selected={anchor} today={today} weekStartsOn={settings.weekStartsOn} onSelect={(d) => navigate({ date: d })} markedDates={monthMarks} highlightRange={view === 'week' ? range : undefined} />
      <h3 className="mb-3 mt-6 text-[15px] font-bold">{laterToday.length ? 'Далі сьогодні' : 'Найближче'}</h3>
      {laterToday.length > 0 ? (
        <div className="space-y-2">
          {laterToday.map((o, i) => {
            const color = eventColor(o.event, categoryById);
            const start = timeToMinutes(o.event.startTime!);
            const badge = start <= nowMinutes ? 'зараз' : i === 0 ? `через ${formatDuration(start - nowMinutes)}` : '';
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => openEvent(o.event.id, o.date)}
                className="block w-full rounded-2xl p-3 text-left transition-[filter] hover:brightness-[0.97]"
                style={{ backgroundColor: solidTint(color, 0.1) }}
              >
                <span className="flex items-center justify-between gap-2 text-[12px] font-semibold tabular-nums" style={{ color }}>
                  {formatTimeRange(o.event.startTime, o.event.endTime, settings.timeFormat)}
                  {badge && <span className="rounded-full bg-surface px-2 text-[10.5px]">{badge}</span>}
                </span>
                <span className="mt-0.5 block truncate text-[14px] font-semibold">{o.event.title}</span>
              </button>
            );
          })}
        </div>
      ) : upcoming.length === 0 ? (
        <EmptyState compact icon={<CalendarDays />} title="Нічого не заплановано" className="!py-6" />
      ) : (
        <div className="-mx-2 space-y-0.5">
          {upcoming.map((o) => (
            <button key={o.key} type="button" onClick={() => openEvent(o.event.id, o.date)} className="flex w-full items-start gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2">
              <span className="mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: eventColor(o.event, categoryById) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{o.event.title}</span>
                <span className="block text-[12px] tabular-nums text-muted">
                  {relativeDayLabel(o.date < today ? today : o.date, today)} · {o.event.allDay ? 'весь день' : formatTimeRange(o.event.startTime, o.event.endTime, settings.timeFormat)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {untimedToday.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-6 text-[15px] font-bold">Задачі без часу</h3>
          <div className="-mx-1">
            {untimedToday.map((t) => (
              <div key={t.id} draggable onDragStart={(e) => startTaskDrag(e, t.id)} title="Перетягніть у календар, щоб призначити час" className="flex cursor-grab items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2 active:cursor-grabbing">
                <CheckCircle checked={false} size="sm" label={`Виконати «${t.title}»`} onChange={(c) => void actions.tasks.setDone(t, c).catch(() => undefined)} />
                <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 truncate text-left text-[14px]">
                  {t.title}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="flex w-full flex-col lg:h-[var(--page-h)]">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-2 pb-3 sm:pb-4">
        <div className="min-w-0 max-w-full">
          {datePicker(
            <span className="block truncate text-left text-[26px] font-extrabold leading-[1.1] tracking-tight first-letter:uppercase sm:text-[38px] sm:leading-[1.05]">
              <span className="sm:hidden">{titleFor(view, anchor, settings.weekStartsOn, true)}</span>
              <span className="hidden sm:inline">{titleFor(view, anchor, settings.weekStartsOn)}</span>
            </span>,
            'block max-w-full rounded-xl text-left',
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 sm:gap-2 sm:pt-1">
          <GoogleSyncButton />
          <Button variant="outline" size="icon-sm" aria-label="Назад" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate({ date: today })} disabled={anchor === today} className={anchor === today ? 'hidden sm:inline-flex' : undefined}>
            Сьогодні
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Вперед" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {viewSwitch()}
          <Button variant="dark" size="sm" onClick={addEvent} className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" /> Подія
          </Button>
        </div>
      </header>

      <div className="h-[calc(100dvh-330px)] min-h-[440px] min-w-0 flex-1 overflow-hidden rounded-2xl lg:h-auto lg:min-h-0">
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
