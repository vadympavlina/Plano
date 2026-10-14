import { useState, type FormEvent } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, Label } from '@/components/ui/input';
import { RecurrenceEditor } from '@/components/common/RecurrenceEditor';
import { useCollections } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { useToday } from '@/hooks/useNow';
import { PRIORITIES, TASK_STATUSES, type Subtask, type Task } from '@/types';
import { PRIORITY_LABEL, STATUS_LABEL } from './logic';
import { timeToMinutes } from '@/lib/date';
import { confirm } from '@/components/common/ConfirmDialog';

type Draft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

function toDraft(task: Task | undefined, defaults: Partial<Task> | undefined): Draft {
  const base: Draft = {
    title: '',
    description: undefined,
    status: 'todo',
    priority: 'medium',
    categoryId: undefined,
    projectId: undefined,
    goalId: undefined,
    dueDate: undefined,
    startDate: undefined,
    startTime: undefined,
    endTime: undefined,
    subtasks: [],
    notes: undefined,
    tags: [],
    recurrence: undefined,
  };
  if (task) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = task;
    return { ...base, ...rest };
  }
  return { ...base, ...defaults } as Draft;
}

function validate(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.title.trim()) errors.title = 'Give the task a title.';
  if (d.endTime && !d.startTime) errors.time = 'Set a start time too.';
  if (d.startTime && d.endTime && timeToMinutes(d.endTime) <= timeToMinutes(d.startTime))
    errors.time = 'End time must be after start time.';
  if ((d.startTime || d.recurrence) && !d.dueDate && !d.startDate) errors.dueDate = 'Pick a date for a scheduled or repeating task.';
  if (d.startDate && d.dueDate && d.startDate > d.dueDate) errors.startDate = 'Start date must be on or before the due date.';
  return errors;
}

let subtaskSeq = 0;
const newSubtaskId = () => `st_${Date.now().toString(36)}${(subtaskSeq++).toString(36)}`;

export default function TaskFormDialog({
  task,
  defaults,
  onClose,
}: {
  task?: Task;
  defaults?: Partial<Task>;
  onClose: () => void;
}) {
  const { categories, projects, goals } = useCollections();
  const actions = useActions();
  const today = useToday();
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(toDraft(task, defaults), onClose);
  const [showErrors, setShowErrors] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [tagsText, setTagsText] = useState(draft.tags.join(', '));
  const [showMore, setShowMore] = useState(
    !!(task && (task.startDate || task.notes || task.tags.length || task.goalId || task.recurrence)),
  );
  const errors = validate(draft);
  const visible = showErrors ? errors : {};

  const requestClose = async () => {
    if (!dirty || (await confirm({ title: 'Discard changes?', description: 'Your edits to this task will be lost.', confirmLabel: 'Discard', danger: true })))
      onClose();
  };

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    const list: Subtask[] = [...draft.subtasks, { id: newSubtaskId(), title, done: false, order: draft.subtasks.length }];
    patch({ subtasks: list });
    setNewSubtask('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    const pendingSubtask = newSubtask.trim();
    const subtasks = pendingSubtask
      ? [...draft.subtasks, { id: newSubtaskId(), title: pendingSubtask, done: false, order: draft.subtasks.length }]
      : draft.subtasks;
    const tags = [...new Set(tagsText.split(',').map((s) => s.trim()).filter(Boolean))];
    const clean: Draft = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      subtasks: subtasks.map((s, i) => ({ ...s, order: i })),
      tags,
      completedAt: draft.status === 'completed' ? (draft.completedAt ?? new Date().toISOString()) : undefined,
    };
    if (task) {
      void submit(() => actions.tasks.update(task.id, clean), 'Task updated');
    } else {
      void submit(() => actions.tasks.create(clean).write, 'Task created');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent
        title={task ? 'Edit task' : 'New task'}
        size="lg"
        preventDismiss={dirty}
        onDismissBlocked={() => void requestClose()}
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Title" error={visible.title}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                placeholder="What needs to be done?"
                value={draft.title}
                maxLength={300}
                onChange={(e) => patch({ title: e.target.value })}
              />
            )}
          </Field>

          <Field label="Description">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                placeholder="Add details"
                value={draft.description ?? ''}
                onChange={(e) => patch({ description: e.target.value })}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Due date" error={visible.dueDate} className="col-span-2 sm:col-span-2">
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} type="date" value={draft.dueDate ?? ''} onChange={(e) => patch({ dueDate: e.target.value || undefined })} />
                  {draft.dueDate !== today && (
                    <Button variant="outline" size="md" className="px-3" onClick={() => patch({ dueDate: today })}>
                      Today
                    </Button>
                  )}
                </div>
              )}
            </Field>
            <Field label="Start" error={visible.time}>
              {(p) => (
                <Input {...p} type="time" value={draft.startTime ?? ''} onChange={(e) => patch({ startTime: e.target.value || undefined })} />
              )}
            </Field>
            <Field label="End">
              {(p) => (
                <Input {...p} type="time" value={draft.endTime ?? ''} onChange={(e) => patch({ endTime: e.target.value || undefined })} />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Priority">
              {(p) => (
                <Select {...p} value={draft.priority} onChange={(e) => patch({ priority: e.target.value as Task['priority'] })}>
                  {PRIORITIES.map((pr) => (
                    <option key={pr} value={pr}>
                      {PRIORITY_LABEL[pr]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Status">
              {(p) => (
                <Select {...p} value={draft.status} onChange={(e) => patch({ status: e.target.value as Task['status'] })}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
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
                  {projects
                    .filter((pr) => pr.status !== 'archived' || pr.id === draft.projectId)
                    .map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          </div>

          <div>
            <Label>Subtasks</Label>
            {draft.subtasks.length > 0 && (
              <ul className="mb-2 space-y-1">
                {draft.subtasks.map((s, i) => (
                  <li key={s.id} className="group flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1">
                    <GripVertical className="h-3.5 w-3.5 text-subtle" aria-hidden />
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                      checked={s.done}
                      aria-label={`Done: ${s.title}`}
                      onChange={() =>
                        patch({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })
                      }
                    />
                    <input
                      className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
                      value={s.title}
                      aria-label={`Subtask ${i + 1}`}
                      onChange={(e) =>
                        patch({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove subtask"
                      className="rounded p-1 text-subtle hover:bg-surface-2 hover:text-danger"
                      onClick={() => patch({ subtasks: draft.subtasks.filter((x) => x.id !== s.id) })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Add a subtask"
                value={newSubtask}
                aria-label="New subtask"
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
              />
              <Button variant="outline" size="icon" aria-label="Add subtask" onClick={addSubtask}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!showMore ? (
            <Button variant="link" size="sm" onClick={() => setShowMore(true)}>
              More options (repeat, start date, tags, notes)
            </Button>
          ) : (
            <div className="space-y-4 border-t border-line pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Repeat">
                  {(p) => (
                    <RecurrenceEditor
                      id={p.id}
                      value={draft.recurrence}
                      startDate={draft.dueDate ?? draft.startDate}
                      onChange={(recurrence) => patch({ recurrence })}
                    />
                  )}
                </Field>
                <div className="space-y-3">
                  <Field label="Start date" error={visible.startDate} hint="When you plan to begin working on it.">
                    {(p) => (
                      <Input {...p} type="date" value={draft.startDate ?? ''} onChange={(e) => patch({ startDate: e.target.value || undefined })} />
                    )}
                  </Field>
                  {goals.length > 0 && (
                    <Field label="Goal">
                      {(p) => (
                        <Select {...p} value={draft.goalId ?? ''} onChange={(e) => patch({ goalId: e.target.value || undefined })}>
                          <option value="">None</option>
                          {goals.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}
                </div>
              </div>
              <Field label="Tags" hint="Separate with commas.">
                {(p) => <Input {...p} placeholder="e.g. errands, deep-work" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />}
              </Field>
              <Field label="Notes">
                {(p) => (
                  <Textarea {...p} rows={3} placeholder="Notes, links, context…" value={draft.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} />
                )}
              </Field>
            </div>
          )}

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
              {task ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
