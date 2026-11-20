import { Link } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { spanLabel } from './logic';
import { PowerTimeline } from './PowerTimeline';

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

/** «Смужка доби»: the whole day as one bar (with «now») and the hours in words, above the grid. */
export function PowerDayBar({
  spans,
  queue,
  nowMinutes,
  className,
}: {
  spans: { start: number; end: number }[];
  queue: string;
  nowMinutes?: number;
  className?: string;
}) {
  if (!spans.length) return null;
  return (
    <Link to="/power" className={cn('block rounded-2xl bg-surface-2 px-3.5 py-2.5 transition-colors hover:bg-surface-2/70', className)}>
      <span className="flex items-center gap-2 text-[13px] text-muted">
        <Zap className="h-3.5 w-3.5 shrink-0 text-ink" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-ink">Без світла</span> {spans.map(spanLabel).join(', ')} · черга {queue}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
      </span>
      <PowerTimeline className="mt-2" ticks spans={spans} now={nowMinutes} />
    </Link>
  );
}
