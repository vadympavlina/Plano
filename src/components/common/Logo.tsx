import { cn } from '@/lib/utils/cn';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/**
 * The Plano duck. On dark surfaces (`tone="light"`) it is the bare duck; elsewhere
 * it sits on its dark tile so the white duck stays visible on light backgrounds.
 */
export function LogoMark({ className, tone = 'auto' }: { className?: string; tone?: 'auto' | 'light' | 'dark' }) {
  return tone === 'light' ? (
    <img src={asset('logo-duck.png')} alt="" aria-hidden className={cn('h-6 w-6 object-contain', className)} />
  ) : (
    <img src={asset('icons/icon-192.png')} alt="" aria-hidden className={cn('h-6 w-6 rounded-[22%]', className)} />
  );
}

export function Logo({ className, tone = 'auto', showText = true }: { className?: string; tone?: 'auto' | 'light' | 'dark'; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-[26px] w-[26px]" tone={tone} />
      {showText && <span className="text-[20px] font-bold tracking-tight">Plano</span>}
      {!showText && <span className="sr-only">Plano</span>}
    </span>
  );
}

export function AppIcon({ className }: { className?: string }) {
  return <img src={asset('icons/icon-192.png')} alt="" aria-hidden className={cn('h-12 w-12 rounded-[14px]', className)} />;
}
