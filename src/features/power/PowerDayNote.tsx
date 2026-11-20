import { Link } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { spanLabel } from './logic';

/** Above the day view of the calendar: which hours have no power that day (the grid shows them as a faint band). */
export function PowerDayNote({ spans, queue, className }: { spans: { start: number; end: number }[]; queue: string; className?: string }) {
  if (!spans.length) return null;
  return (
    <Link
      to="/power"
      className={cn('flex h-8 items-center gap-2 rounded-full bg-surface-2 px-3 text-[13px] text-muted transition-colors hover:text-ink', className)}
    >
      <Zap className="h-3.5 w-3.5 shrink-0 text-ink" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-ink">Без світла</span> {spans.map(spanLabel).join(', ')} · черга {queue}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
    </Link>
  );
}
