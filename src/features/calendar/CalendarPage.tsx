import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addMonths } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, Segmented } from '@/components/ui/misc';
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
import type { CalendarView, DateKey } from '@/types';
import { expandEvents, upcomingOccurrences } from './logic';
import { eventColor } from './items';
import { GoogleSyncButton } from '@/features/integrations/GoogleSyncButton';
import { TimeGrid } from './TimeGrid';
import { MonthView } from './MonthView';
import { MiniCalendar } from '@/components/ui/calendar';
import { EmptyState } from '@/components/common/States';

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
  const { openEventForm, openEvent } = useUI();

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

  return (
    <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-4 sm:px-6 lg:h-[calc(100dvh-72px-2.5rem)] lg:px-8">
      <Card className="flex h-[calc(100dvh-150px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] min-h-[460px] min-w-0 flex-1 flex-col overflow-hidden lg:h-auto lg:min-h-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4">
          <div className="flex min-w-0 items-center">
            <Button variant="ghost" size="icon-sm" aria-label="Назад" onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="truncate rounded-lg px-1.5 py-1 text-[14px] font-semibold tracking-tight hover:bg-surface-2 sm:px-2" aria-label="Обрати дату">
                  <span className="sm:hidden">{titleFor(view, anchor, settings.weekStartsOn, true)}</span>
                  <span className="hidden sm:inline">{titleFor(view, anchor, settings.weekStartsOn)}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px]">
                <MiniCalendar selected={anchor} today={today} weekStartsOn={settings.weekStartsOn} onSelect={(d) => navigate({ date: d })} markedDates={monthMarks} />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon-sm" aria-label="Вперед" onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Segmented
            ariaLabel="Вигляд календаря"
            size="sm"
            stretch
            className="order-last w-full sm:order-none sm:w-auto"
            value={view}
            onChange={(v) => navigate({ view: v })}
            options={[
              { value: 'day', label: 'День' },
              { value: 'week', label: 'Тиждень' },
              { value: 'month', label: 'Місяць' },
            ]}
          />
          <span className="ml-auto sm:ml-0">
            <GoogleSyncButton />
          </span>
          <Button variant="outline" size="sm" className="px-2.5" onClick={() => navigate({ date: today })} disabled={anchor === today}>
            Сьогодні
          </Button>
          <Button
            variant="dark"
            size="sm"
            className="w-8 px-0 sm:ml-auto sm:w-auto sm:px-3"
            aria-label="Додати подію"
            onClick={() => openEventForm({ defaults: { date: view === 'month' && anchor.slice(0, 7) !== today.slice(0, 7) ? anchor : view === 'day' ? anchor : today } })}
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Додати подію</span>
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          {view === 'month' ? (
            <MonthView anchor={anchor} occurrences={occurrences} tasks={tasks} onSelectDay={selectDay} />
          ) : (
            <TimeGrid days={days} occurrences={occurrences} tasks={tasks} onSelectDay={selectDay} />
          )}
        </div>
      </Card>

      <aside className="hidden w-[280px] shrink-0 flex-col gap-4 xl:flex">
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
        <Card className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
          <h3 className="mb-2 text-sm font-semibold">Найближче</h3>
          {upcoming.length === 0 ? (
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
          <button type="button" onClick={() => navigate({ view: 'month' })} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
            Відкрити місяць
          </button>
        </Card>
      </aside>
    </div>
  );
}
