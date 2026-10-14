import { useState, useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Require the user to type this text before confirming. */
  typeToConfirm?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Promise-based confirmation dialog: `if (await confirm({...})) …` */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { ...options, resolve };
    emit();
  });
}

function close(ok: boolean) {
  pending?.resolve(ok);
  pending = null;
  emit();
}

export function ConfirmDialogHost() {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
  );
  const [typed, setTyped] = useState('');
  const canConfirm = !current?.typeToConfirm || typed === current.typeToConfirm;

  return (
    <Dialog
      open={!!current}
      onOpenChange={(open) => {
        if (!open) {
          setTyped('');
          close(false);
        }
      }}
    >
      {current && (
        <DialogContent title={current.title} description={current.description} size="sm">
          {current.typeToConfirm && (
            <div className="mt-2">
              <label className="mb-1.5 block text-[13px] text-muted">
                Введіть <span className="font-semibold text-ink">{current.typeToConfirm}</span> для підтвердження
              </label>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTyped('');
                close(false);
              }}
            >
              {current.cancelLabel ?? 'Скасувати'}
            </Button>
            <Button
              variant={current.danger ? 'danger' : 'dark'}
              disabled={!canConfirm}
              autoFocus={!current.typeToConfirm}
              onClick={() => {
                setTyped('');
                close(true);
              }}
            >
              {current.confirmLabel ?? 'Підтвердити'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
