import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CaptureBox } from './CaptureBox';

/** «+» on phones and N on the keyboard: quick capture from any page. */
export default function QuickAddSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Швидке додавання" quietTitle size="lg">
        <CaptureBox sheet onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}
