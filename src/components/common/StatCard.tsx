import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/misc';
import { cn } from '@/lib/utils/cn';

export function StatCard({
  label,
  value,
  hint,
  progress,
  icon,
  to,
  progressColor,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  progress?: number;
  icon?: ReactNode;
  to?: string;
  progressColor?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        {icon && <span className="text-subtle [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      </div>
      <p className="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {progress != null ? (
        <Progress value={progress} className="mt-3" color={progressColor} label={label} />
      ) : (
        hint && <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>
      )}
    </>
  );
  const cls = 'card block p-4 sm:p-5 transition-colors';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-subtle/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
