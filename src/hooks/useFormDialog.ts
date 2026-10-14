import { useCallback, useRef, useState } from 'react';
import { settleWrite } from '@/services/sync';
import { toast } from '@/components/ui/toast';

/**
 * Shared behaviour for create/edit dialogs: dirty tracking (so accidental
 * outside clicks do not discard input), single in-flight submit, and honest
 * success/failure reporting.
 */
export function useFormDialog<T>(initial: T, onClose: () => void) {
  const [draft, setDraft] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initialJson = useRef(JSON.stringify(initial));
  const dirty = JSON.stringify(draft) !== initialJson.current;
  const inFlight = useRef(false);

  const patch = useCallback((p: Partial<T>) => setDraft((d) => ({ ...d, ...p })), []);

  const submit = useCallback(
    async (write: () => Promise<unknown>, successMessage?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setSubmitError(null);
      try {
        const result = await settleWrite(write());
        if (result === 'queued') toast.info('Saved on this device', { description: 'It will sync when you are back online.' });
        else if (successMessage) toast.success(successMessage);
        onClose();
      } catch (e) {
        setSubmitError((e as Error).message || 'Could not save. Please try again.');
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [onClose],
  );

  return { draft, setDraft, patch, dirty, saving, submitError, submit };
}
