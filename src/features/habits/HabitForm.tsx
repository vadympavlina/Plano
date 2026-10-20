import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-time';
import { Stepper } from '@/components/ui/controls';
import { ColorPicker } from '@/components/ui/color-picker';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { todayKey } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { Habit } from '@/types';

type Draft = Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>;
const ICONS = ['🏋️', '📚', '💧', '🧠', '🚶', '🧘', '🥗', '😴', '✍️', '🎸', '💊', '🌱', '🚬', '🍬', '📱', '🍺', '☕'];
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const actions = useActions();
  const initial: Draft = habit
    ? (({ id: _i, createdAt: _c, updatedAt: _u, ...rest }) => rest)(habit)
    : { name: '', icon: '🏋️', color: 'green', schedule: [0, 1, 2, 3, 4, 5, 6], startDate: todayKey(), goalType: 'check', target: 1, archived: false };
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(initial, onClose);
  const [showErrors, setShowErrors] = useState(false);
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Вкажіть назву звички.';
  if (!draft.schedule.length) errors.schedule = 'Оберіть хоча б один день.';
  if (draft.goalType === 'count' && (!Number.isFinite(draft.target) || draft.target < 1)) errors.target = 'Ціль має бути не менше 1.';
  if (!draft.startDate) errors.startDate = 'Оберіть дату початку.';
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
    // A bad habit is tracked from the day it became one: earlier days are unknown, not "clean".
    const becameBad = clean.kind === 'bad' && habit?.kind !== 'bad';
    if (becameBad) clean.trackFrom = todayKey();
    if (habit)
      void submit(async () => {
        await actions.habits.update(habit.id, clean);
        // Today's mark of the old good habit is not a slip.
        if (becameBad) await actions.habits.setValue(habit.id, todayKey(), 0);
      }, 'Звичку оновлено');
    else void submit(() => actions.habits.create(clean).write, 'Звичку створено');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={habit ? 'Редагувати звичку' : 'Нова звичка'} preventDismiss={dirty}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Тип звички">
            {(
              [
                ['good', 'Корисна', 'Робити регулярно'],
                ['bad', 'Шкідлива', 'Позбутися або обмежити'],
              ] as const
            ).map(([k, t, d]) => {
              const on = (draft.kind ?? 'good') === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => patch(k === 'bad' ? { kind: 'bad', schedule: [0, 1, 2, 3, 4, 5, 6] } : { kind: undefined })}
                  className={cn('rounded-xl border-2 px-3 py-2 text-left transition-colors', on ? (k === 'bad' ? 'border-danger/60 bg-danger/[0.06]' : 'border-primary bg-surface-2') : 'border-line')}
                >
                  <span className="block text-sm font-semibold">{t}</span>
                  <span className="block text-xs text-muted">{d}</span>
                </button>
              );
            })}
          </div>
          <Field label="Назва" error={visible.name}>
            {(p) => <Input {...p} autoFocus maxLength={120} placeholder={draft.kind === 'bad' ? 'напр. Курити, Солодке, Соцмережі' : 'напр. Прочитати 20 сторінок'} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Іконка</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Іконка">
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
              <Input aria-label="Своя іконка" className="h-9 w-16 text-center" maxLength={4} value={ICONS.includes(draft.icon) ? '' : draft.icon} placeholder="✨" onChange={(e) => e.target.value && patch({ icon: e.target.value })} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Колір</p>
            <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
          </div>
          <div className={cn(draft.kind === 'bad' && 'hidden')}>
            <p className="mb-1.5 text-[13px] font-medium">Розклад</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Дні">
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
              <button type="button" className="text-primary hover:underline" onClick={() => patch({ schedule: [0, 1, 2, 3, 4, 5, 6] })}>Щодня</button>
              <button type="button" className="text-primary hover:underline" onClick={() => patch({ schedule: [1, 2, 3, 4, 5] })}>Будні</button>
              <button type="button" className="text-primary hover:underline" onClick={() => patch({ schedule: [0, 6] })}>Вихідні</button>
            </div>
            {visible.schedule && <p role="alert" className="mt-1.5 text-xs text-danger">{visible.schedule}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={draft.kind === 'bad' ? 'Мета' : 'Тип цілі'}>
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
                      {draft.kind === 'bad' ? (t === 'check' ? 'Відмовитись' : 'Обмежити') : t === 'check' ? 'Так / Ні' : 'Кількість'}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Дата початку" error={visible.startDate}>
              {(p) => <DatePicker {...p} clearable={false} value={draft.startDate} onChange={(startDate) => startDate && patch({ startDate })} />}
            </Field>
          </div>
          {draft.goalType === 'count' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={draft.kind === 'bad' ? 'Не більше на день' : 'Ціль на день'} error={visible.target}>
                {(p) => <Stepper {...p} min={1} max={10000} value={draft.target} onChange={(target) => patch({ target })} />}
              </Field>
              <Field label="Одиниця">
                {(p) => <Input {...p} placeholder={draft.kind === 'bad' ? 'сигарети, чашки…' : 'склянки, сторінки…'} value={draft.unit ?? ''} onChange={(e) => patch({ unit: e.target.value })} />}
              </Field>
            </div>
          )}
          {submitError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{submitError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>Скасувати</Button>
            <Button type="submit" variant="dark" loading={saving}>{habit ? 'Зберегти зміни' : 'Створити звичку'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
