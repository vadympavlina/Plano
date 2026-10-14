import { useEffect } from 'react';
import { onWriteFailure, describeError } from '@/services/sync';
import { toast } from '@/components/ui/toast';

/** Shows a toast with a Retry action whenever a write fails. */
export function SyncFeedback() {
  useEffect(
    () =>
      onWriteFailure(({ label, error, retry }) => {
        toast.error(`${label} failed`, { description: describeError(error), action: { label: 'Retry', onClick: retry } });
      }),
    [],
  );
  return null;
}
