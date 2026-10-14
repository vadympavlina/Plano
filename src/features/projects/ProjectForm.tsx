import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { PROJECT_STATUSES, type Project } from '@/types';
import { PROJECT_STATUS_LABEL } from './logic';
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
  if (!draft.name.trim()) errors.name = 'Give the project a name.';
  if (draft.startDate && draft.targetDate && draft.targetDate < draft.startDate) errors.targetDate = 'Target date must be after the start date.';
  const visible = showErrors ? errors : {};

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    const clean = { ...draft, name: draft.name.trim(), description: draft.description?.trim() || undefined };
    if (project) void submit(() => actions.projects.update(project.id, clean), 'Project updated');
    else
      void submit(() => {
        const { id, write } = actions.projects.create(clean);
        return write.then(() => onCreated?.(id));
      }, 'Project created');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={project ? 'Edit project' : 'New project'} preventDismiss={dirty}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Name" error={visible.name}>
            {(p) => <Input {...p} autoFocus maxLength={120} placeholder="e.g. EdFlow, Home renovation" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />}
          </Field>
          <Field label="Description">
            {(p) => <Textarea {...p} rows={3} placeholder="What is this project about?" value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} />}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Color</p>
            <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              {(p) => (
                <Select {...p} value={draft.status} onChange={(e) => patch({ status: e.target.value as Project['status'] })}>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Start date">
              {(p) => <Input {...p} type="date" value={draft.startDate ?? ''} onChange={(e) => patch({ startDate: e.target.value || undefined })} />}
            </Field>
            <Field label="Target date" error={visible.targetDate}>
              {(p) => <Input {...p} type="date" value={draft.targetDate ?? ''} onChange={(e) => patch({ targetDate: e.target.value || undefined })} />}
            </Field>
          </div>
          {submitError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{submitError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="dark" loading={saving}>
              {project ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
