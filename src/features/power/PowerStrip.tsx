import { Link } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/utils/cn';
import { clock, lengthLabel, statusAt, untilLabel } from './logic';
import { powerReachable } from './api';
import { usePowerSetup } from './usePower';

/** One line on «Сьогодні»: is there power now, and when does that change. A tap opens the page. */
export function PowerStrip({ className }: { className?: string }) {
  const { on, queue, data, failed, loading } = usePowerSetup();
  const nowMs = useNow(30_000).getTime();
  if (!on || !powerReachable) return null;

  const status = data && queue ? statusAt(data, queue, nowMs) : undefined;
  const tone = status?.kind === 'off' ? 'off' : status?.kind === 'on' ? 'on' : 'idle';
  let text: React.ReactNode;
  if (!queue) text = <span className="text-muted">Оберіть чергу, щоб бачити графік</span>;
  else if (!data) text = <span className="text-muted">{failed ? 'Немає зв’язку із сервером' : loading ? 'Завантажую графік…' : 'Графік ще не отримано'}</span>;
  else if (status?.kind === 'off')
    text = (
      <>
        <b className="font-semibold">Світла немає</b>
        <span className="text-muted">
          {' '}
          · до {untilLabel(status.until, nowMs)} (ще {lengthLabel(status.until - nowMs)})
        </span>
      </>
    );
  else if (status?.kind === 'on')
    text = (
      <>
        <b className="font-semibold">Світло є</b>
        <span className="text-muted">
          {status.next ? ` · вимкнуть о ${clock(status.next.start)} (через ${lengthLabel(status.next.start - nowMs)})` : ' · більше відключень не заплановано'}
        </span>
      </>
    );
  else
    text = (
      <>
        <b className="font-semibold">Світло</b>
        <span className="text-muted"> · графік на сьогодні ще не опублікований</span>
      </>
    );

  return (
    <Link
      to="/power"
      aria-label="Графік відключень світла"
      className={cn(
        'flex h-11 items-center gap-3 rounded-2xl bg-surface-2 pl-2.5 pr-3 text-[14px] transition-colors hover:bg-surface-2/60 active:bg-line/60',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          tone === 'off' ? 'bg-ink text-surface' : tone === 'on' ? 'bg-success/20 text-success' : 'bg-line text-muted',
        )}
      >
        <Zap className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
    </Link>
  );
}
