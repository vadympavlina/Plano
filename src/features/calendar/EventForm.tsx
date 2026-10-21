import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSmartTitle } from '@/features/capture/useSmartTitle';
import { SmartTitleHint } from '@/features/capture/SmartTitleHint';
import { CategoryMark } from '@/components/common/CategoryMark';
import { AlertTriangle, AlignLeft, FolderKanban, Link2, MapPin, Repeat, Sun } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker, TimePicker } from '@/components/ui/date-time';
import { RepeatChip } from '@/components/common/RepeatChip';
import { projectOptions } from '@/components/common/options';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { confirm } from '@/components/common/ConfirmDialog';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { ReminderSelect, reminderLabel } from '@/features/reminders/ReminderSelect';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { useData } from '@/app/providers/DataProvider';
import { deviceTimeZone, formatDuration, formatTimeRange, minutesToTime, diffDaysKey, plural, roundUpTime, timeToMinutes, todayKey } from '@/lib/date';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
import type { CalendarEvent } from '@/types';
import { findConflicts } from './logic';

type Draft = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

function toDraft(event?: CalendarEvent, defaults?: Partial<CalendarEvent>): Draft {
  if (event) {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = event;
    return rest;
  }
  const start = defaults?.startTime ?? roundUpTime(new Date());
  return {
    title: '',
    date: todayKey(),
    allDay: false,
    startTime: start,
    endTime: minutesToTime(Math.min(timeToMinutes(start) + 60, 23 * 60 + 59)),
    exdates: [],
    source: 'plano',
    timezone: deviceTimeZone(),
    ...defaults,
  };
}

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.title.trim()) e.title = 'Вкажіть назву події.';
  if (!d.date) e.date = 'Оберіть дату.';
  if (!d.allDay) {
    if (!d.startTime) e.time = 'Вкажіть час початку.';
    else if (!d.endTime) e.time = 'Вкажіть час завершення.';
    else if (timeToMinutes(d.endTime) <= timeToMinutes(d.startTime)) e.time = 'Час завершення має бути пізніше за початок.';
  } else if (d.endDate && d.endDate < d.date) e.endDate = 'Дата завершення не може бути раніше за початок.';
  if (d.url && !/^https?:\/\/\S+$/i.test(d.url.trim())) e.url = 'Вкажіть повне посилання, що починається з https://';
  return e;
}

/** A compact detail row: icon on the left, an inline field on the right. */
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-1">
      <span className="mt-2 flex h-4 w-4 shrink-0 text-subtle [&_svg]:h-4 [&_svg]:w-4" title={label} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const QUICK_DURATIONS = [30, 60, 90, 120];
const bareInput = 'h-9 border-transparent bg-transparent px-0 shadow-none hover:border-transparent focus:border-transparent focus:ring-0';

export default function EventFormDialog({
  event,
  defaults,
  onClose,
}: {
  event?: CalendarEvent;
  defaults?: Partial<CalendarEvent>;
  onClose: () => void;
}) {
  const { categories, projects, events } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(toDraft(event, defaults), onClose);
  const [showErrors, setShowErrors] = useState(false);
  // New events: «Зал завтра на 15:00 до 16:30 #здоровʼя» in the title fills the fields.
  const [smartOff, setSmartOff] = useState(!!event);
  const [undo, setUndo] = useState<Draft | null>(null);
  const smart = useSmartTitle(smartOff ? '' : draft.title);
  const applySmart = () => {
    if (!smart.found) return;
    setUndo(draft);
    patch(smart.event(draft));
  };
  const revertSmart = () => {
    if (undo) patch(undo);
    setUndo(null);
    setSmartOff(true);
  };
  const errors = validate(draft);
  const visible = showErrors ? errors : {};
  const fromGoogle = draft.source === 'google';
  const gcal = useData().data.integrations.google_calendar;
  const linkedCalendar = draft.external ? gcal?.calendars?.find((c) => c.id === draft.external!.calendarId) : undefined;
  const willSync = gcal?.status === 'connected' && (!!draft.external || !!gcal.targetCalendarId);
  const syncCalendarName = linkedCalendar?.name ?? gcal?.calendars?.find((c) => c.id === gcal?.targetCalendarId)?.name;

  const conflicts = useMemo(() => {
    if (draft.allDay || !draft.date || !draft.startTime || !draft.endTime || errors.time) return [];
    return findConflicts(events, draft.date, draft.startTime, draft.endTime, event?.id);
  }, [events, draft.allDay, draft.date, draft.startTime, draft.endTime, errors.time, event?.id]);

  const requestClose = async () => {
    if (!dirty || (await confirm({ title: 'Скасувати зміни?', description: 'Ваші зміни в події буде втрачено.', confirmLabel: 'Скасувати зміни', danger: true })))
      onClose();
  };

  const setStart = (startTime: string | undefined) => {
    if (!startTime) return;
    // Keep the duration when the start moves.
    const dur = draft.startTime && draft.endTime ? timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime) : 60;
    patch({ startTime, endTime: minutesToTime(Math.min(timeToMinutes(startTime) + Math.max(dur, 15), 23 * 60 + 59)) });
  };

  const duration = draft.startTime && draft.endTime ? timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime) : 0;
  const setDuration = (m: number) => {
    if (!draft.startTime) return;
    patch({ endTime: minutesToTime(Math.min(timeToMinutes(draft.startTime) + m, 23 * 60 + 59)) });
  };
  const toggleAllDay = (allDay: boolean) =>
    patch(allDay ? { allDay } : { allDay, startTime: draft.startTime ?? '09:00', endTime: draft.endTime ?? '10:00', endDate: undefined });
  const spanDays = draft.endDate && draft.endDate > draft.date ? diffDaysKey(draft.endDate, draft.date) + 1 : 1;
  const allDaySpan = spanDays > 1 ? `${spanDays} ${plural(spanDays, ['день', 'дні', 'днів'])}` : 'Один день';
  const categoryColor = draft.categoryId ? colorOf(categories.find((c) => c.id === draft.categoryId)?.color) : undefined;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    const final: Draft = smart.found ? { ...draft, ...smart.event(draft) } : draft;
    if (smart.found) applySmart();
    if (Object.keys(validate(final)).length) return;
    const clean: Draft = {
      ...final,
      title: final.title.trim(),
      description: final.description?.trim() || undefined,
      location: final.location?.trim() || undefined,
      url: final.url?.trim() || undefined,
      startTime: final.allDay ? undefined : final.startTime,
      endTime: final.allDay ? undefined : final.endTime,
      endDate: final.allDay && final.endDate && final.endDate > final.date ? final.endDate : undefined,
    };
    if (event) void submit(() => actions.events.update(event.id, clean), 'Подію оновлено');
    else void submit(() => actions.events.create(clean).write, 'Подію створено');
  };

  const timeError = visible.date ?? visible.time ?? visible.endDate;

  return (
    <Dialog open onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent quietTitle title={event ? 'Редагувати подію' : 'Нова подія'} size="md" preventDismiss={dirty} onDismissBlocked={() => void requestClose()}>
        <form
          onSubmit={onSubmit}
          noValidate
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.currentTarget.requestSubmit();
            }
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full transition-colors"
              style={{ backgroundColor: categoryColor ?? linkedCalendar?.color ?? '#4778F5' }}
              aria-hidden
            />
            <input
              autoFocus
              aria-label="Назва"
              aria-invalid={visible.title ? true : undefined}
              placeholder="Назва події"
              maxLength={300}
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              onBlur={applySmart}
              className="w-full bg-transparent text-[21px] font-semibold tracking-tight text-ink outline-none placeholder:text-subtle/80 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          {visible.title && <p role="alert" className="ml-6 mt-1 text-[13px] text-danger">{visible.title}</p>}
          <div className="ml-6">
            <SmartTitleHint summary={smart.summary} found={smart.found} applied={!!undo} onApply={applySmart} onRevert={revertSmart} />
          </div>

          {/* When */}
          <section aria-label="Час" className="mt-4 rounded-2xl bg-surface-2/70 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <DatePicker
                variant="chip"
                aria-label={draft.allDay ? 'Початок' : 'Дата'}
                clearable={false}
                weekStartsOn={settings.weekStartsOn}
                value={draft.date}
                onChange={(date) => date && patch({ date, endDate: draft.endDate && draft.endDate < date ? undefined : draft.endDate })}
              />
              {draft.allDay ? (
                <>
                  <span className="text-subtle">→</span>
                  <DatePicker
                    variant="chip"
                    aria-label="Кінець"
                    clearable={false}
                    min={draft.date}
                    weekStartsOn={settings.weekStartsOn}
                    value={draft.endDate ?? draft.date}
                    onChange={(endDate) => patch({ endDate })}
                  />
                </>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <TimePicker variant="chip" aria-label="Початок" timeFormat={settings.timeFormat} value={draft.startTime} onChange={setStart} />
                  <span className="text-subtle">–</span>
                  <TimePicker
                    variant="chip"
                    aria-label="Кінець"
                    after={draft.startTime}
                    timeFormat={settings.timeFormat}
                    value={draft.endTime}
                    onChange={(endTime) => patch({ endTime })}
                  />
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-1 text-[12.5px]">
              {draft.allDay ? (
                <span className="text-muted">{allDaySpan}</span>
              ) : (
                <>
                  {!QUICK_DURATIONS.includes(duration) && (
                    <span className="mr-1 tabular-nums text-muted">{duration > 0 ? formatDuration(duration) : '—'}</span>
                  )}
                  {QUICK_DURATIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDuration(m)}
                      aria-pressed={duration === m}
                      className={cn(
                        'h-7 shrink-0 rounded-md px-2 font-medium tabular-nums transition-colors',
                        duration === m ? 'bg-surface text-ink shadow-soft ring-1 ring-line' : 'text-subtle hover:bg-surface hover:text-ink',
                      )}
                    >
                      {formatDuration(m).replace(' год 30 хв', ',5 год')}
                    </button>
                  ))}
                </>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={draft.allDay}
                onClick={() => toggleAllDay(!draft.allDay)}
                className={cn(
                  'ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-medium transition-colors',
                  draft.allDay ? 'border-accent bg-accent text-surface' : 'border-line bg-surface text-muted hover:text-ink',
                )}
              >
                <Sun className="h-3.5 w-3.5" />
                Весь день
              </button>
            </div>

            <div className="mt-2 border-t border-line/70 pt-2">
              {fromGoogle ? (
                <p className="flex items-center gap-2 py-1 text-[13px] text-muted">
                  <Repeat className="h-3.5 w-3.5" /> Повторення налаштовується в Google Calendar
                </p>
              ) : (
                <RepeatChip variant="ghost" className="-ml-2" value={draft.recurrence} startDate={draft.date} onChange={(recurrence) => patch({ recurrence })} />
              )}
            </div>
            {timeError && <p role="alert" className="mt-2 text-[13px] text-danger">{timeError}</p>}
            {conflicts.length > 0 && (
              <p className="mt-2 flex items-start gap-2 text-[12.5px] text-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Перетинається з{' '}
                  {conflicts
                    .slice(0, 3)
                    .map((c) => `«${c.title}» (${formatTimeRange(c.startTime, c.endTime, settings.timeFormat)})`)
                    .join(', ')}
                </span>
              </p>
            )}
          </section>

          {/* Category & project */}
          <div className="mt-4 space-y-2.5">
            {categories.length > 0 && (
              <div role="radiogroup" aria-label="Категорія" className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = draft.categoryId === c.id;
                  const color = colorOf(c.color);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch({ categoryId: on ? undefined : c.id })}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
                        on ? 'text-ink' : 'border-line bg-surface text-muted hover:text-ink',
                      )}
                      style={on ? { backgroundColor: tint(color, 0.16), borderColor: tint(color, 0.5) } : undefined}
                    >
                      <CategoryMark category={c} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {(projects.some((p) => p.status !== 'archived') || draft.projectId) && (
              <Select
                variant="chip"
                aria-label="Проєкт"
                icon={<FolderKanban />}
                placeholder="Додати до проєкту"
                value={draft.projectId}
                onChange={(v) => patch({ projectId: v || undefined })}
                options={projectOptions(projects, draft.projectId)}
              />
            )}
            <ReminderSelect value={draft.remindMin} onChange={(remindMin) => patch({ remindMin })} fallback={draft.allDay ? 'вимкнено' : reminderLabel(settings.remindEventsMin)} />
          </div>

          {/* Details */}
          <div className="mt-4 divide-y divide-line/70 rounded-2xl border border-line/80">
            <Row icon={<MapPin />} label="Місце">
              <Input aria-label="Місце" placeholder="Місце" value={draft.location ?? ''} onChange={(e) => patch({ location: e.target.value })} className={bareInput} />
            </Row>
            <Row icon={<Link2 />} label="Посилання">
              <Input
                aria-label="Посилання"
                aria-invalid={visible.url ? true : undefined}
                type="url"
                inputMode="url"
                placeholder="Посилання на зустріч"
                value={draft.url ?? ''}
                onChange={(e) => patch({ url: e.target.value })}
                className={bareInput}
              />
              {visible.url && <p role="alert" className="mb-1.5 text-[13px] text-danger">{visible.url}</p>}
            </Row>
            <Row icon={<AlignLeft />} label="Опис">
              <Textarea
                aria-label="Опис"
                rows={2}
                placeholder="Нотатки"
                value={draft.description ?? ''}
                onChange={(e) => patch({ description: e.target.value })}
                className="min-h-[60px] resize-none border-transparent bg-transparent px-0 py-2 shadow-none hover:border-transparent focus:border-transparent focus:ring-0"
              />
            </Row>
          </div>

          {willSync && (
            <p className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: linkedCalendar?.color ?? '#4778F5' }} />
              Синхронізується з Google Calendar{syncCalendarName ? ` · ${syncCalendarName}` : ''}
            </p>
          )}

          {submitError && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => void requestClose()} disabled={saving}>
              Скасувати
            </Button>
            <Button type="submit" variant="dark" loading={saving}>
              {event ? 'Зберегти' : 'Створити подію'}
              <kbd className="ml-1.5 hidden font-sans text-[11.5px] font-medium opacity-50 lg:inline">{isMac ? '⌘' : 'Ctrl'}↵</kbd>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
