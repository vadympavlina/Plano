import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CaptureBox } from './CaptureBox';
import type { CaptureKind, CapturePreset } from './useCapture';

/** «+» on phones, N on the keyboard, a tap or a drag on the calendar: quick capture from any page. */
export default function QuickAddSheet({ onClose, preset }: { onClose: () => void; preset?: CapturePreset }) {
  // Opened from the calendar the sheet can switch between an event and a task; the title follows.
  const [kind, setKind] = useState<CaptureKind | undefined>(preset?.kind);
  const fromCalendar = !!(preset?.date || preset?.time || preset?.allDay);
  const title = !fromCalendar ? 'Швидке додавання' : kind === 'task' ? 'Нова задача' : 'Нова подія';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title} quietTitle size="lg">
        <CaptureBox sheet onDone={onClose} preset={preset} onKindChange={setKind} />
      </DialogContent>
    </Dialog>
  );
}
