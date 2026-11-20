import { cn } from '@/lib/utils/cn';
import { spanLabel, type Span } from './logic';

const pct = (min: number) => `${(Math.min(1440, Math.max(0, min)) / 1440) * 100}%`;

/**
 * A day as one bar: light where there is power, dark where there is none, a marker for «now».
 * `spans` null = the hours are not published yet (a dashed bar).
 */
export function PowerTimeline({
  spans,
  now,
  ticks = false,
  large = false,
  className,
}: {
  spans: Span[] | null;
  /** Minutes from midnight, to put the marker. */
  now?: number;
  ticks?: boolean;
  large?: boolean;
  className?: string;
}) {
  const label = spans === null ? 'Графік ще не опублікований' : spans.length ? `Без світла: ${spans.map(spanLabel).join(', ')}` : 'Відключень немає';
  return (
    <div className={className}>
      <div role="img" aria-label={label} className="relative">
        <div
          className={cn(
            'relative overflow-hidden rounded-full',
            large ? 'h-3.5' : 'h-2.5',
            spans === null ? 'border border-dashed border-subtle/60 bg-transparent' : 'bg-success/25',
          )}
        >
          {spans?.map((s) => (
            <span
              key={s.start}
              className="absolute inset-y-0 rounded-[3px] bg-ink"
              style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }}
            />
          ))}
        </div>
        {now !== undefined && (
          <span
            aria-hidden
            className="absolute -inset-y-[3px] w-[3px] -translate-x-1/2 rounded-full bg-primary ring-2 ring-surface"
            style={{ left: pct(now) }}
          />
        )}
      </div>
      {ticks && (
        <div aria-hidden className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-subtle">
          {['00', '06', '12', '18', '24'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
