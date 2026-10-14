import { cn } from '@/lib/utils/cn';

export function Avatar({ name, src, className }: { name?: string | null; src?: string | null; className?: string }) {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#d9e2fb] to-[#e9defd] text-xs font-semibold text-[#3b4a6b]',
        className,
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials || '?'}
    </span>
  );
}
