import { cn } from '@/lib/utils/cn';

/**
 * The Plano mark: a "P" drawn in one stroke that starts with a check mark —
 * plan it, then get it done. The check is the blue accent.
 */
export function LogoMark({ className, tone = 'auto' }: { className?: string; tone?: 'auto' | 'light' | 'dark' }) {
  const main = tone === 'light' ? '#ECEFF5' : tone === 'dark' ? '#171B24' : 'currentColor';
  return (
    <svg viewBox="86 104 292 292" className={cn('h-6 w-6', className)} aria-hidden fill="none">
      <g strokeWidth="58" strokeLinecap="round" strokeLinejoin="round">
        <path d="M118 292 L186 360 L186 136 H268 A78 78 0 0 1 268 292 H186" stroke={main} />
        <path d="M118 292 L186 360" stroke="#4778F5" />
      </g>
    </svg>
  );
}

export function Logo({ className, tone = 'auto', showText = true }: { className?: string; tone?: 'auto' | 'light' | 'dark'; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-[22px] w-[22px]" tone={tone} />
      {showText && <span className="text-[20px] font-bold tracking-tight">Plano</span>}
      {!showText && <span className="sr-only">Plano</span>}
    </span>
  );
}

export function AppIcon({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#171B24]', className)}>
      <LogoMark className="h-[56%] w-[56%]" tone="light" />
    </span>
  );
}
