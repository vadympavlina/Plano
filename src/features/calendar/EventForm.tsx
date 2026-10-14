import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { RecurrenceEditor } from '@/components/common/RecurrenceEditor';
import { confirm } from '@/components/common/ConfirmDialog';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
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
  if (!d.title.trim()) e.title = 'Give the event a title.';
  if (!d.date) e.date = 'Pick a date.';
  if (!d.allDay) {
    if (!d.startTime) e.time = 'Set a start time.';
    else if (!d.endTime) e.time = 'Set an end time.';
    else if (timeToMinutes(d.endTime) <= timeToMinutes(d.startTime)) e.time = 'End time must be after start time.';
  } else if (d.endDate && d.endDate < d.date) e.endDate = 'End date must be on or after the start date.';
  if (d.url && !/^https?:\/\/\S+$/i.test(d.url.trim())) e.url = 'Use a full link starting with https://';
  return e;
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
  const readOnly = draft.source !== 'plano';

  const conflicts = useMemo(() => {
    if (draft.allDay || !draft.date || !draft.startTime || !draft.endTime || errors.time) return [];
    return findConflicts(events, draft.date, draft.startTime, draft.endTime, event?.id);
  }, [events, draft.allDay, draft.date, draft.startTime, draft.endTime, errors.time, event?.id]);

  const requestClose = async () => {
    if (!dirty || (await confirm({ title: 'Discard changes?', description: 'Your edits to this event will be lost.', confirmLabel: 'Discard', danger: true })))
      onClose();
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
    if (event) void submit(() => actions.events.update(event.id, clean), 'Event updated');
    else void submit(() => actions.events.create(clean).write, 'Event created');
  };

  return (
    <Dialog open onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent title={event ? 'Edit event' : 'New event'} size="lg" preventDismiss={dirty} onDismissBlocked={() => void requestClose()}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {readOnly && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
              This event was imported from an external calendar. Changes made here are not sent back yet.
            </p>
          )}
          <Field label="Title" error={visible.title}>
            {(p) => (
              <Input {...p} autoFocus placeholder="Event name" maxLength={300} value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
            )}
          </Field>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[rgb(var(--primary))]"
              checked={draft.allDay}
              onChange={(e) => {
                const allDay = e.target.checked;
                patch(
                  allDay
                    ? { allDay }
                    : { allDay, startTime: draft.startTime ?? '09:00', endTime: draft.endTime ?? '10:00', endDate: undefined },
                );
              }}
            />
            All-day event
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={draft.allDay ? 'Starts' : 'Date'} error={visible.date} className="col-span-2">
              {(p) => <Input {...p} type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value })} />}
            </Field>
            {draft.allDay ? (
              <Field label="Ends" error={visible.endDate} className="col-span-2">
                {(p) => (
                  <Input {...p} type="date" min={draft.date} value={draft.endDate ?? draft.date} onChange={(e) => patch({ endDate: e.target.value || undefined })} />
                )}
              </Field>
            ) : (
              <>
                <Field label="Start" error={visible.time}>
                  {(p) => (
                    <Input
                      {...p}
                      type="time"
                      value={draft.startTime ?? ''}
                      onChange={(e) => {
                        const startTime = e.target.value;
                        // Keep the duration when the start time moves.
                        if (startTime && draft.startTime && draft.endTime) {
                          const dur = timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime);
                          const end = timeToMinutes(startTime) + Math.max(dur, 15);
                          patch({ startTime, endTime: minutesToTime(Math.min(end, 23 * 60 + 59)) });
                        } else patch({ startTime });
                      }}
                    />
                  )}
                </Field>
                <Field label="End">
                  {(p) => <Input {...p} type="time" value={draft.endTime ?? ''} onChange={(e) => patch({ endTime: e.target.value })} />}
                </Field>
              </>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[13px] text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                Overlaps with{' '}
                {conflicts
                  .slice(0, 3)
                  .map((c) => `${c.title} (${formatTimeRange(c.startTime, c.endTime, settings.timeFormat)})`)
                  .join(', ')}
                . You can still save it.
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              {(p) => (
                <Select {...p} value={draft.categoryId ?? ''} onChange={(e) => patch({ categoryId: e.target.value || undefined })}>
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Project">
              {(p) => (
                <Select {...p} value={draft.projectId ?? ''} onChange={(e) => patch({ projectId: e.target.value || undefined })}>
                  <option value="">None</option>
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Repeat">
            {(p) => (
              <RecurrenceEditor id={p.id} value={draft.recurrence} startDate={draft.date} onChange={(recurrence) => patch({ recurrence })} />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location">
              {(p) => <Input {...p} placeholder="Add a place" value={draft.location ?? ''} onChange={(e) => patch({ location: e.target.value })} />}
            </Field>
            <Field label="Link" error={visible.url}>
              {(p) => (
                <Input {...p} type="url" inputMode="url" placeholder="https://" value={draft.url ?? ''} onChange={(e) => patch({ url: e.target.value })} />
              )}
            </Field>
          </div>

          <Field label="Description">
            {(p) => (
              <Textarea {...p} rows={3} placeholder="Agenda, notes…" value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} />
            )}
          </Field>

          {submitError && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="dark" loading={saving}>
              {event ? 'Save changes' : 'Create event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
