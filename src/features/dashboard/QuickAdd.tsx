import { CaptureBox } from '@/features/capture/CaptureBox';

/** Quick capture on the dashboard (the same smart box as «+» / N). */
export function QuickAdd({ className }: { className?: string }) {
  return <CaptureBox className={className} />;
}
