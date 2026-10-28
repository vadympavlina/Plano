import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as GlassButton } from 'glisse';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'dark' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

// Liquid Glass (glisse): outline/secondary are clear glass, primary/dark/danger are filled glass.
// Ghost and link stay plain — they sit in lists by the dozen, where glass would only add noise.
const GLASS: Partial<Record<Variant, { variant?: 'filled'; tint?: string; className?: string }>> = {
  primary: { variant: 'filled' },
  dark: { variant: 'filled', tint: 'rgb(var(--ink))', className: 'dark:!text-bg' },
  danger: { variant: 'filled', tint: 'rgb(var(--danger))' },
  secondary: { className: 'text-ink' },
  outline: { className: 'text-ink' },
};

const plain: Partial<Record<Variant, string>> = {
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink active:bg-line/70',
  link: 'text-primary hover:underline underline-offset-2 !px-0 !h-auto',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1',
  sm: 'h-8 px-3.5 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  icon: 'h-10 w-10 !px-0',
  'icon-sm': 'h-8 w-8 !px-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, type = 'button', ...props },
  ref,
) {
  const glass = GLASS[variant];
  const cls = cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors duration-150 disabled:pointer-events-none [&_svg]:shrink-0',
    sizes[size],
    glass ? glass.className : cn(plain[variant], 'disabled:opacity-50'),
    className,
  );
  // `contents` keeps icons out of glisse's `.lg-button > svg` sizing, so h-4/w-4 still apply.
  const body = (
    <span className="contents">
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </span>
  );
  if (!glass)
    return (
      <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cls} {...props}>
        {body}
      </button>
    );
  return (
    <GlassButton
      ref={ref}
      type={type}
      variant={glass.variant}
      tint={glass.tint}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cls}
      {...props}
    >
      {body}
    </GlassButton>
  );
});
