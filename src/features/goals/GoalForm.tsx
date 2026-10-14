import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, Label } from '@/components/ui/input';
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
              {(p) => <Input {...p} type="number" min={0} step="any" value={draft.currentValue} onChange={(e) => patch({ currentValue: Number(e.target.value) })} />}
            </Field>
            <Field label="Мета" error={visible.target}>
              {(p) => <Input {...p} type="number" min={0} step="any" value={draft.targetValue} onChange={(e) => patch({ targetValue: Number(e.target.value) })} />}
            </Field>
            <Field label="Одиниця">
              {(p) => <Input {...p} placeholder="книжки, км, %" value={draft.unit ?? ''} onChange={(e) => patch({ unit: e.target.value })} />}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Дата початку">
              {(p) => <Input {...p} type="date" value={draft.startDate ?? ''} onChange={(e) => patch({ startDate: e.target.value || undefined })} />}
            </Field>
            <Field label="Цільова дата" error={visible.targetDate}>
              {(p) => <Input {...p} type="date" value={draft.targetDate ?? ''} onChange={(e) => patch({ targetDate: e.target.value || undefined })} />}
            </Field>
            <Field label="Категорія">
              {(p) => (
                <Select {...p} value={draft.categoryId ?? ''} onChange={(e) => patch({ categoryId: e.target.value || undefined })}>
                  <option value="">Немає</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Статус">
              {(p) => (
                <Select {...p} value={draft.status} onChange={(e) => patch({ status: e.target.value as Goal['status'] })}>
                  {GOAL_STATUSES.map((s) => <option key={s} value={s}>{GOAL_STATUS_LABEL[s]}</option>)}
                </Select>
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
                    <label key={pr.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        className="accent-[rgb(var(--primary))]"
                        checked={on}
                        onChange={() => patch({ projectIds: on ? draft.projectIds.filter((x) => x !== pr.id) : [...draft.projectIds, pr.id] })}
                      />
                      {pr.name}
                    </label>
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
