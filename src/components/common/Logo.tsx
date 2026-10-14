import { cn } from '@/lib/utils/cn';

/** The Plano mark: a starting point and two rising steps — plan, focus, achieve. */
export function LogoMark({ className, tone = 'auto' }: { className?: string; tone?: 'auto' | 'light' | 'dark' }) {
  const mid = tone === 'light' ? '#ECEFF5' : tone === 'dark' ? '#171B24' : 'currentColor';
  return (
    <svg viewBox="0 0 232 232" className={cn('h-6 w-6', className)} aria-hidden fill="none">
      <circle cx="29" cy="203" r="29" fill="#8C94A6" />
      <rect x="87" y="60" width="58" height="172" rx="29" fill={mid} />
      <rect x="174" y="0" width="58" height="232" rx="29" fill="#4778F5" />
    </svg>
  );
}

export function Logo({ className, tone = 'auto', showText = true }: { className?: string; tone?: 'auto' | 'light' | 'dark'; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-[22px] w-[22px]" tone={tone} />
      {showText && <span className="text-[19px] font-semibold tracking-tight">Plano</span>}
      {!showText && <span className="sr-only">Plano</span>}
    </span>
  );
}

export function AppIcon({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#171B24]', className)}>
      <LogoMark className="h-[46%] w-[46%]" tone="light" />
    </span>
  );
}
