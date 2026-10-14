import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-time';
import { Stepper } from '@/components/ui/controls';
import { categoryOptions } from '@/components/common/options';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { useActions } from '@/hooks/useActions';
import { useCollections } from '@/hooks/useCollections';
import { useFormDialog } from '@/hooks/useFormDialog';
import { todayKey } from '@/lib/date';
import { GOAL_STATUSES, type Goal } from '@/types';
import { GOAL_STATUS_LABEL } from './logic';

type Draft = Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>;

export function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const actions = useActions();
  const { categories, projects } = useCollections();
  const initial: Draft = goal
    ? (({ id: _i, createdAt: _c, updatedAt: _u, ...rest }) => rest)(goal)
    : { title: '', targetValue: 1, currentValue: 0, status: 'active', projectIds: [], history: [], startDate: todayKey() };
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(initial, onClose);
  const [showErrors, setShowErrors] = useState(false);
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = 'Вкажіть назву цілі.';
  if (!(draft.targetValue > 0)) errors.target = 'Ціль має бути більшою за 0.';
  if (!(draft.currentValue >= 0)) errors.current = 'Поточне значення не може бути від’ємним.';
  if (draft.startDate && draft.targetDate && draft.targetDate < draft.startDate) errors.targetDate = 'Цільова дата має бути пізніше за дату початку.';
  const visible = showErrors ? errors : {};

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    const clean: Draft = { ...draft, title: draft.title.trim(), description: draft.description?.trim() || undefined, unit: draft.unit?.trim() || undefined };
    if (goal) {
      const history =
        clean.currentValue !== goal.currentValue
          ? [...clean.history, { id: `h${Date.now().toString(36)}`, date: new Date().toISOString(), value: clean.currentValue }]
          : clean.history;
      void submit(() => actions.goals.update(goal.id, { ...clean, history }), 'Ціль оновлено');
    } else {
      const history = clean.currentValue > 0 ? [{ id: 'h0', date: new Date().toISOString(), value: clean.currentValue }] : [];
      void submit(() => actions.goals.create({ ...clean, history }).write, 'Ціль створено');
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={goal ? 'Редагувати ціль' : 'Нова ціль'} preventDismiss={dirty} size="lg">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Ціль" error={visible.title}>
            {(p) => <Input {...p} autoFocus maxLength={200} placeholder="напр. Прочитати 12 книжок цього року" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />}
          </Field>
          <Field label="Опис">
            {(p) => <Textarea {...p} rows={2} value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} />}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Зараз" error={visible.current}>
              {(p) => <Stepper {...p} min={0} value={draft.currentValue} onChange={(currentValue) => patch({ currentValue })} />}
            </Field>
            <Field label="Мета" error={visible.target}>
              {(p) => <Stepper {...p} min={0} value={draft.targetValue} onChange={(targetValue) => patch({ targetValue })} />}
            </Field>
            <Field label="Одиниця">
              {(p) => <Input {...p} placeholder="книжки, км, %" value={draft.unit ?? ''} onChange={(e) => patch({ unit: e.target.value })} />}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Дата початку">
              {(p) => <DatePicker {...p} value={draft.startDate} onChange={(startDate) => patch({ startDate })} />}
            </Field>
            <Field label="Цільова дата" error={visible.targetDate}>
              {(p) => <DatePicker {...p} placeholder="Без дедлайну" min={draft.startDate} value={draft.targetDate} onChange={(targetDate) => patch({ targetDate })} />}
            </Field>
            <Field label="Категорія">
              {(p) => (
                <Select {...p} value={draft.categoryId ?? ''} onChange={(v) => patch({ categoryId: v || undefined })} options={categoryOptions(categories)} />
              )}
            </Field>
            <Field label="Статус">
              {(p) => (
                <Select {...p} value={draft.status} onChange={(status) => patch({ status })} options={GOAL_STATUSES.map((s) => ({ value: s, label: GOAL_STATUS_LABEL[s] }))} />
              )}
            </Field>
          </div>
          {projects.length > 0 && (
            <div>
              <Label>Пов’язані проєкти</Label>
              <div className="flex flex-wrap gap-2">
                {projects.map((pr) => {
                  const on = draft.projectIds.includes(pr.id);
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => patch({ projectIds: on ? draft.projectIds.filter((x) => x !== pr.id) : [...draft.projectIds, pr.id] })}
                      className={cn(
                        'inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium transition-colors',
                        on ? 'border-accent bg-accent text-surface' : 'border-line text-muted hover:text-ink',
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf(pr.color) }} />
                      {pr.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {submitError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{submitError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>Скасувати</Button>
            <Button type="submit" variant="dark" loading={saving}>{goal ? 'Зберегти зміни' : 'Створити ціль'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
