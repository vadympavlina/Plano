import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-time';
import { projectStatusOptions } from '@/components/common/options';
import { ColorPicker } from '@/components/ui/color-picker';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import type { Project } from '@/types';
import { todayKey } from '@/lib/date';

type Draft = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

export function ProjectForm({ project, onClose, onCreated }: { project?: Project; onClose: () => void; onCreated?: (id: string) => void }) {
  const actions = useActions();
  const initial: Draft = project
    ? (({ id: _i, createdAt: _c, updatedAt: _u, ...rest }) => rest)(project)
    : { name: '', color: 'blue', status: 'active', startDate: todayKey() };
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(initial, onClose);
  const [showErrors, setShowErrors] = useState(false);
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Вкажіть назву проєкту.';
  if (draft.startDate && draft.targetDate && draft.targetDate < draft.startDate) errors.targetDate = 'Цільова дата має бути пізніше за дату початку.';
  const visible = showErrors ? errors : {};

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    const clean = { ...draft, name: draft.name.trim(), description: draft.description?.trim() || undefined };
    if (project) void submit(() => actions.projects.update(project.id, clean), 'Проєкт оновлено');
    else
      void submit(() => {
        const { id, write } = actions.projects.create(clean);
        return write.then(() => onCreated?.(id));
      }, 'Проєкт створено');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={project ? 'Редагувати проєкт' : 'Новий проєкт'} preventDismiss={dirty}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Назва" error={visible.name}>
            {(p) => <Input {...p} autoFocus maxLength={120} placeholder="напр. EdFlow, Ремонт" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />}
          </Field>
          <Field label="Опис">
            {(p) => <Textarea {...p} rows={3} placeholder="Про що цей проєкт?" value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} />}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Колір</p>
            <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Статус">
              {(p) => (
<Select {...p} value={draft.status} onChange={(status) => patch({ status })} options={projectStatusOptions} />
              )}
            </Field>
            <Field label="Дата початку">
              {(p) => <DatePicker {...p} value={draft.startDate} onChange={(startDate) => patch({ startDate })} />}
            </Field>
            <Field label="Цільова дата" error={visible.targetDate}>
              {(p) => <DatePicker {...p} placeholder="Без дати" min={draft.startDate} value={draft.targetDate} onChange={(targetDate) => patch({ targetDate })} />}
            </Field>
          </div>
          {submitError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{submitError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Скасувати
            </Button>
            <Button type="submit" variant="dark" loading={saving}>
              {project ? 'Зберегти зміни' : 'Створити проєкт'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
