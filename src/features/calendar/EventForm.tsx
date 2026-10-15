import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, AlignLeft, Clock, FolderKanban, Link2, MapPin, Repeat, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker, TimePicker } from '@/components/ui/date-time';
import { Switch } from '@/components/ui/controls';
import { RepeatChip } from '@/components/common/RepeatChip';
import { categoryOptions, projectOptions } from '@/components/common/options';
import { confirm } from '@/components/common/ConfirmDialog';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { useData } from '@/app/providers/DataProvider';
import { deviceTimeZone, formatTimeRange, minutesToTime, roundUpTime, timeToMinutes, todayKey } from '@/lib/date';
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

/** A labelled row: icon on the left, controls on the right. */
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="mt-2 flex h-4 w-4 shrink-0 text-subtle [&_svg]:h-4 [&_svg]:w-4" title={label} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    const clean: Draft = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      location: draft.location?.trim() || undefined,
      url: draft.url?.trim() || undefined,
      startTime: draft.allDay ? undefined : draft.startTime,
      endTime: draft.allDay ? undefined : draft.endTime,
      endDate: draft.allDay && draft.endDate && draft.endDate > draft.date ? draft.endDate : undefined,
    };
    if (event) void submit(() => actions.events.update(event.id, clean), 'Подію оновлено');
    else void submit(() => actions.events.create(clean).write, 'Подію створено');
  };

  const timeError = visible.date ?? visible.time ?? visible.endDate;

  return (
    <Dialog open onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent quietTitle title={event ? 'Редагувати подію' : 'Нова подія'} size="md" preventDismiss={dirty} onDismissBlocked={() => void requestClose()}>
        <form onSubmit={onSubmit} noValidate>
          {willSync && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: linkedCalendar?.color ?? '#4778F5' }} />
              Синхронізується з Google Calendar{syncCalendarName ? ` · ${syncCalendarName}` : ''}
            </p>
          )}
          <input
            autoFocus
            aria-label="Назва"
            aria-invalid={visible.title ? true : undefined}
            placeholder="Назва події"
            maxLength={300}
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            className="mb-3 w-full bg-transparent text-[21px] font-semibold tracking-tight text-ink outline-none placeholder:text-subtle/80 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {visible.title && <p role="alert" className="-mt-2 mb-3 text-[13px] text-danger">{visible.title}</p>}

          <div className="divide-y divide-line/70 border-y border-line/70">
            <Row icon={<Clock />} label="Час">
              <div className="flex flex-wrap items-center gap-1.5">
                <DatePicker
                  variant="chip"
                  aria-label={draft.allDay ? 'Початок' : 'Дата'}
                  clearable={false}
                  weekStartsOn={settings.weekStartsOn}
                  value={draft.date}
                  onChange={(date) => date && patch({ date })}
                />
                {draft.allDay ? (
                  <>
                    <span className="text-subtle">–</span>
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
                  <>
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
                  </>
                )}
              </div>
              <Switch
                className="mt-2.5 max-w-[220px]"
                label="Весь день"
                checked={draft.allDay}
                onChange={(allDay) =>
                  patch(
                    allDay
                      ? { allDay }
                      : { allDay, startTime: draft.startTime ?? '09:00', endTime: draft.endTime ?? '10:00', endDate: undefined },
                  )
                }
              />
              {timeError && <p role="alert" className="mt-2 text-[13px] text-danger">{timeError}</p>}
              {conflicts.length > 0 && (
                <p className="mt-2 flex items-start gap-2 text-[13px] text-muted">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>
                    Перетинається з{' '}
                    {conflicts
                      .slice(0, 3)
                      .map((c) => `«${c.title}» (${formatTimeRange(c.startTime, c.endTime, settings.timeFormat)})`)
                      .join(', ')}
                    . Зберегти все одно можна.
                  </span>
                </p>
              )}
            </Row>
            <Row icon={<Repeat />} label="Повторення">
              {fromGoogle ? (
                <p className="py-1.5 text-sm text-muted">Повторення цієї події налаштовується в Google Calendar.</p>
              ) : (
              <RepeatChip variant="ghost" showIcon={false} className="-ml-2" value={draft.recurrence} startDate={draft.date} onChange={(recurrence) => patch({ recurrence })} />
              )}
            </Row>
            <Row icon={<Tag />} label="Категорія">
              <div className="-ml-2 flex flex-wrap gap-1">
                <Select
                  variant="ghost"
                  aria-label="Категорія"
                  value={draft.categoryId ?? ''}
                  onChange={(v) => patch({ categoryId: v || undefined })}
                  options={categoryOptions(categories)}
                />
              </div>
            </Row>
            <Row icon={<FolderKanban />} label="Проєкт">
              <Select
                variant="ghost"
                className="-ml-2"
                aria-label="Проєкт"
                value={draft.projectId ?? ''}
                onChange={(v) => patch({ projectId: v || undefined })}
                options={projectOptions(projects, draft.projectId)}
              />
            </Row>
            <Row icon={<MapPin />} label="Місце">
              <Input
                aria-label="Місце"
                placeholder="Додати місце"
                value={draft.location ?? ''}
                onChange={(e) => patch({ location: e.target.value })}
                className="h-8 border-transparent px-0 shadow-none hover:border-transparent focus:border-transparent focus:ring-0"
              />
            </Row>
            <Row icon={<Link2 />} label="Посилання">
              <Input
                aria-label="Посилання"
                aria-invalid={visible.url ? true : undefined}
                type="url"
                inputMode="url"
                placeholder="Додати посилання"
                value={draft.url ?? ''}
                onChange={(e) => patch({ url: e.target.value })}
                className="h-8 border-transparent px-0 shadow-none hover:border-transparent focus:border-transparent focus:ring-0"
              />
              {visible.url && <p role="alert" className="mt-1 text-[13px] text-danger">{visible.url}</p>}
            </Row>
            <Row icon={<AlignLeft />} label="Опис">
              <Textarea
                aria-label="Опис"
                rows={3}
                placeholder="Порядок денний, нотатки…"
                value={draft.description ?? ''}
                onChange={(e) => patch({ description: e.target.value })}
                className="min-h-[72px] resize-none border-transparent px-0 py-1.5 shadow-none hover:border-transparent focus:border-transparent focus:ring-0"
              />
            </Row>
          </div>

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
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
