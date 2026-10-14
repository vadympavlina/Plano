import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/misc';
import { cn } from '@/lib/utils/cn';

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  progress?: number;
  progressColor?: string;
  to?: string;
  accent?: ReactNode;
}

/** One cell of the stats strip. */
export function StatCard({ label, value, hint, progress, progressColor, to, accent }: Stat) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
        {accent}
        {label}
      </p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</p>
      {progress != null ? (
        <Progress value={progress} className="mt-3 h-1" color={progressColor} label={label} />
      ) : (
        <p className="mt-2.5 truncate text-xs text-muted">{hint}</p>
      )}
    </>
  );
  const cls = 'block min-w-0 px-5 py-4 transition-colors sm:px-6 sm:py-5';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-surface-2/70')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Stats in a single panel separated by hairlines instead of four separate cards. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="card grid grid-cols-2 divide-line overflow-hidden lg:grid-cols-4 lg:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-line lg:[&>*:nth-child(-n+2)]:border-b-0 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-line lg:[&>*:nth-child(odd)]:border-r-0">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}
