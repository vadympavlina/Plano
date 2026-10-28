import { forwardRef, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Button as GlassButton, Glass, Input as GlassInput, Switch as GlassSwitch, TabBar, type TabBarProps } from 'glisse';
import { cn } from '@/lib/utils/cn';

// Liquid Glass (glisse): buttons, fields, switches, tab bars and segmented controls.
export { Glass, GlassButton, GlassInput, GlassSwitch };

/** Glass tabs pass `href`; the app routes with react-router. */
export const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(function RouterLink({ href, ...props }, ref) {
  return <Link ref={ref} to={href} {...props} />;
});

/**
 * A glass tab bar. Its tabs share one fixed width: with `fill` they split the wrapper's
 * width, with `fit` they take the widest label's width (both measured before paint).
 */
export function GlassTabs({
  fill,
  fit,
  small,
  tabHeight,
  wrapperClassName,
  style,
  className,
  ...props
}: TabBarProps & { fill?: boolean; fit?: boolean; small?: boolean; tabHeight?: number; wrapperClassName?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const signature = props.items.map((i) => i.value).join('|');
  useLayoutEffect(() => {
    const el = fill ? box.current : ruler.current;
    if (!el || !(fill || fit)) return;
    const measure = () =>
      setWidth(fill ? Math.floor((el.clientWidth - 8) / props.items.length) : Math.ceil(Math.max(...[...el.children].map((c) => (c as HTMLElement).offsetWidth))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
    // Labels can change (counts); the observer catches the size change.
  }, [fill, fit, signature, props.items.length]);

  const vars = {
    ...(width && { '--lg-tab-width': `${width}px` }),
    '--lg-tab-height': `${tabHeight ?? (small ? 28 : 32)}px`,
    ...style,
  } as CSSProperties;
  const bar = <TabBar {...props} className={cn(small && 'glass-tabs-sm', className)} style={vars} />;
  if (!fill && !fit) return bar;
  return (
    <div ref={box} className={cn('relative min-w-0', !fill && 'inline-flex', wrapperClassName)}>
      {bar}
      {fit && (
        // Invisible copy of the labels, to size the tabs to the widest one.
        <span ref={ruler} aria-hidden className={cn('pointer-events-none invisible absolute left-0 top-0 flex', small ? 'text-[12.5px]' : 'text-[13.5px]')}>
          {props.items.map((i) => (
            <span key={i.value} className="flex items-center whitespace-nowrap px-3.5 font-medium">
              {i.label}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
