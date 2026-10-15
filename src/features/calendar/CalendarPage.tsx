import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addMonths } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CheckCircle, Segmented } from '@/components/ui/misc';
import { useActions } from '@/hooks/useActions';
import { tint } from '@/lib/utils/colors';
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
import { MonthView } from './MonthView';
import { MiniCalendar } from '@/components/ui/calendar';
import { EmptyState } from '@/components/common/States';
import { cn } from '@/lib/utils/cn';

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
  const now = useNow();
  const today = todayKey(now);
  const [params, setParams] = useSearchParams();
  const { events, tasks, categoryById } = useCollections();
  const { openEventForm, openEvent, openTask } = useUI();
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
    openEventForm({ defaults: { date: view === 'month' && anchor.slice(0, 7) !== today.slice(0, 7) ? anchor : view === 'day' ? anchor : today } });

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

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col px-4 sm:px-6 lg:h-[calc(100dvh-72px-2.5rem)] lg:px-8">
      {/* Desktop toolbar */}
      <div className="mb-3 hidden items-center gap-2 lg:flex">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Назад" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Вперед" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {datePicker(
          titleFor(view, anchor, settings.weekStartsOn),
          'ml-1 truncate rounded-lg px-2 py-1 text-[22px] font-bold tracking-tight first-letter:uppercase hover:bg-surface',
        )}
        <div className="ml-auto flex items-center gap-2">
          <GoogleSyncButton />
          <Button variant="outline" size="sm" onClick={() => navigate({ date: today })} disabled={anchor === today}>
            Сьогодні
          </Button>
          {viewSwitch()}
          <Button variant="dark" size="sm" onClick={addEvent}>
            <Plus className="h-4 w-4" /> Подія
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <Card className="flex h-[calc(100dvh-150px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] min-h-[460px] min-w-0 flex-1 flex-col overflow-hidden lg:h-auto lg:min-h-0">
          {/* Phone & tablet toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4 lg:hidden">
            <div className="flex min-w-0 flex-1 basis-0 items-center sm:flex-none sm:basis-auto">
              <Button variant="ghost" size="icon-sm" aria-label="Назад" onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {datePicker(
                <>
                  <span className="sm:hidden">{titleFor(view, anchor, settings.weekStartsOn, true)}</span>
                  <span className="hidden sm:inline">{titleFor(view, anchor, settings.weekStartsOn)}</span>
                </>,
                'truncate rounded-lg px-1.5 py-1 text-[14px] font-semibold tracking-tight hover:bg-surface-2 sm:px-2',
              )}
              <Button variant="ghost" size="icon-sm" aria-label="Вперед" onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {viewSwitch('order-last w-full sm:order-none sm:w-auto', true)}
            <GoogleSyncButton />
            <Button
              variant="outline"
              size="sm"
              className={cn('px-2.5', anchor === today && 'hidden sm:inline-flex')}
              onClick={() => navigate({ date: today })}
              disabled={anchor === today}
            >
              Сьогодні
            </Button>
            <Button variant="dark" size="sm" className="w-8 px-0 sm:ml-auto sm:w-auto sm:px-3" aria-label="Додати подію" onClick={addEvent}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Додати подію</span>
            </Button>
          </div>

          <div className="min-h-0 flex-1">
            {view === 'month' ? (
              <MonthView anchor={anchor} occurrences={occurrences} tasks={tasks} onSelectDay={selectDay} />
            ) : (
              <TimeGrid days={days} occurrences={occurrences} tasks={tasks} onSelectDay={selectDay} onSwipe={step} />
            )}
          </div>
        </Card>

        <aside className="hidden w-[272px] shrink-0 flex-col gap-4 xl:flex">
          <Card className="p-4">
            <MiniCalendar
              selected={anchor}
              today={today}
              weekStartsOn={settings.weekStartsOn}
              onSelect={(d) => navigate({ date: d })}
              markedDates={monthMarks}
              highlightRange={view === 'week' ? range : undefined}
            />
          </Card>
          <Card className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
            <h3 className="mb-3 text-sm font-semibold">{laterToday.length ? 'Далі сьогодні' : 'Найближче'}</h3>
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
                      className="block w-full rounded-xl p-2.5 text-left transition-[filter] hover:brightness-[0.97]"
                      style={{ backgroundColor: tint(color, 0.1) }}
                    >
                      <span className="flex items-center justify-between gap-2 text-[12px] font-semibold tabular-nums" style={{ color }}>
                        {formatTimeRange(o.event.startTime, o.event.endTime, settings.timeFormat)}
                        {badge && <span className="rounded bg-surface px-1.5 text-[10.5px]">{badge}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] font-semibold">{o.event.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState compact icon={<CalendarDays />} title="Нічого не заплановано" className="!py-6" />
            ) : (
              <div className="-mx-2 space-y-0.5">
                {upcoming.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => openEvent(o.event.id, o.date)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                  >
                    <span className="mt-0.5 h-8 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: eventColor(o.event, categoryById) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{o.event.title}</span>
                      <span className="block text-[11.5px] tabular-nums text-muted">
                        {o.event.allDay ? 'Весь день' : formatTimeRange(o.event.startTime, o.event.endTime, settings.timeFormat)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-subtle">{relativeDayLabel(o.date < today ? today : o.date, today)}</span>
                  </button>
                ))}
              </div>
            )}

            {untimedToday.length > 0 && (
              <>
                <h3 className="mb-1.5 mt-5 text-sm font-semibold">Задачі без часу</h3>
                <div className="-mx-1">
                  {untimedToday.map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                      <CheckCircle checked={false} size="sm" label={`Виконати «${t.title}»`} onChange={(c) => void actions.tasks.setDone(t, c).catch(() => undefined)} />
                      <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px]">
                        {t.title}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
