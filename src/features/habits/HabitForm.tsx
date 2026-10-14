import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { todayKey } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { Habit } from '@/types';

type Draft = Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>;
const ICONS = ['🏋️', '📚', '💧', '🧠', '🚶', '🧘', '🥗', '😴', '✍️', '🎸', '💊', '🌱'];
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const actions = useActions();
  const initial: Draft = habit
    ? (({ id: _i, createdAt: _c, updatedAt: _u, ...rest }) => rest)(habit)
    : { name: '', icon: '🏋️', color: 'green', schedule: [0, 1, 2, 3, 4, 5, 6], startDate: todayKey(), goalType: 'check', target: 1, archived: false };
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(initial, onClose);
  const [showErrors, setShowErrors] = useState(false);
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Give the habit a name.';
  if (!draft.schedule.length) errors.schedule = 'Pick at least one day.';
  if (draft.goalType === 'count' && (!Number.isFinite(draft.target) || draft.target < 1)) errors.target = 'Target must be 1 or more.';
  if (!draft.startDate) errors.startDate = 'Pick a start date.';
  const visible = showErrors ? errors : {};

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    const clean: Draft = {
      ...draft,
      name: draft.name.trim(),
      target: draft.goalType === 'check' ? 1 : Math.round(draft.target),
      unit: draft.goalType === 'count' ? draft.unit?.trim() || undefined : undefined,
    };
    if (habit) void submit(() => actions.habits.update(habit.id, clean), 'Habit updated');
    else void submit(() => actions.habits.create(clean).write, 'Habit created');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={habit ? 'Edit habit' : 'New habit'} preventDismiss={dirty}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Name" error={visible.name}>
            {(p) => <Input {...p} autoFocus maxLength={120} placeholder="e.g. Read 20 pages" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Icon</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={draft.icon === i}
                  onClick={() => patch({ icon: i })}
                  className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors', draft.icon === i ? 'bg-surface-2 ring-2 ring-primary/50' : 'hover:bg-surface-2')}
                >
                  {i}
                </button>
              ))}
              <Input aria-label="Custom icon" className="h-9 w-16 text-center" maxLength={4} value={ICONS.includes(draft.icon) ? '' : draft.icon} placeholder="✨" onChange={(e) => e.target.value && patch({ icon: e.target.value })} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Color</p>
            <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Schedule</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
              {DAYS.map((d) => {
                const on = draft.schedule.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ schedule: on ? draft.schedule.filter((x) => x !== d) : [...draft.schedule, d].sort() })}
                    className={cn('h-9 rounded-lg px-3 text-xs font-semibold transition-colors', on ? 'bg-accent text-surface' : 'bg-surface-2 text-muted hover:text-ink')}
                  >
                    {DAY_NAMES[d]}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => patch({ schedule: [0, 1, 2, 3, 4, 5, 6] })}>Every day</button>
              <button type="button" className="text-primary hover:underline" onClick={() => patch({ schedule: [1, 2, 3, 4, 5] })}>Weekdays</button>
              <button type="button" className="text-primary hover:underline" onClick={() => patch({ schedule: [0, 6] })}>Weekends</button>
            </div>
            {visible.schedule && <p role="alert" className="mt-1.5 text-xs text-danger">{visible.schedule}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Goal type">
              {(p) => (
                <div className="flex gap-2" id={p.id}>
                  {(['check', 'count'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={draft.goalType === t}
                      onClick={() => patch({ goalType: t, target: t === 'check' ? 1 : Math.max(2, draft.target) })}
                      className={cn('h-10 flex-1 rounded-xl border text-sm font-medium', draft.goalType === t ? 'border-accent bg-surface-2' : 'border-line text-muted')}
                    >
                      {t === 'check' ? 'Yes / No' : 'Count'}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Start date" error={visible.startDate}>
              {(p) => <Input {...p} type="date" value={draft.startDate} onChange={(e) => patch({ startDate: e.target.value })} />}
            </Field>
          </div>
          {draft.goalType === 'count' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Daily target" error={visible.target}>
                {(p) => <Input {...p} type="number" min={1} value={draft.target} onChange={(e) => patch({ target: Number(e.target.value) })} />}
              </Field>
              <Field label="Unit">
                {(p) => <Input {...p} placeholder="glasses, pages…" value={draft.unit ?? ''} onChange={(e) => patch({ unit: e.target.value })} />}
              </Field>
            </div>
          )}
          {submitError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{submitError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="dark" loading={saving}>{habit ? 'Save changes' : 'Create habit'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
