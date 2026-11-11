import { forwardRef, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Button as GlassButton, TabBar, type TabBarProps } from 'glisse';
import { cn } from '@/lib/utils/cn';

// Liquid Glass (glisse) — only the phone's floating tab bar uses it.
export { GlassButton };

/** Glass tabs pass `href`; the app routes with react-router. */
export const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(function RouterLink(
  { href, ...props },
  ref,
) {
  return <Link ref={ref} to={href} {...props} />;
});

/**
 * A glass tab bar. Its tabs share one fixed width, so with `fill` they split the wrapper's
 * width (measured before paint, then on every resize).
 */
export function GlassTabs({
  fill,
  tabHeight = 32,
  wrapperClassName,
  style,
  ...props
}: TabBarProps & { fill?: boolean; tabHeight?: number; wrapperClassName?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const count = props.items.length;
  useLayoutEffect(() => {
    const el = box.current;
    if (!fill || !el) return;
    const measure = () => setWidth(Math.floor((el.clientWidth - 8) / count));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill, count]);

  const vars = {
    ...(width && { '--lg-tab-width': `${width}px` }),
    '--lg-tab-height': `${tabHeight}px`,
    '--lg-lens-grow-x': '10px',
    '--lg-lens-grow-y': '8px',
    ...style,
  } as CSSProperties;
  return (
    <div ref={box} className={cn('min-w-0', wrapperClassName)}>
      <TabBar {...props} style={vars} />
    </div>
  );
}
