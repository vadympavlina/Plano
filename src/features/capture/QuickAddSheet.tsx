import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CaptureBox } from './CaptureBox';
import type { CapturePreset } from './useCapture';

/** «+» on phones, N on the keyboard, a tap on a calendar slot: quick capture from any page. */
export default function QuickAddSheet({ onClose, preset }: { onClose: () => void; preset?: CapturePreset }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={preset?.kind === 'event' ? 'Нова подія' : 'Швидке додавання'} quietTitle size="lg">
        <CaptureBox sheet onDone={onClose} preset={preset} />
      </DialogContent>
    </Dialog>
  );
}
