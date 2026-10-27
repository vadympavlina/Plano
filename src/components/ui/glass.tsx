import { forwardRef, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Button as GlassButton, Glass, TabBar, type TabBarProps } from 'glisse';
import { cn } from '@/lib/utils/cn';

// Liquid Glass (glisse) for the floating controls: the phone tab bar, calendar view switch, toolbar buttons.
export { Glass, GlassButton };

/** Glass tabs pass `href`; the app routes with react-router. */
export const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(function RouterLink({ href, ...props }, ref) {
  return <Link ref={ref} to={href} {...props} />;
});

/**
 * A glass tab bar. Its tabs have a fixed width, so with `fill` they share the width
 * of the wrapper instead (measured before paint, then on every resize).
 */
export function GlassTabs({
  fill,
  tabHeight,
  wrapperClassName,
  style,
  ...props
}: TabBarProps & { fill?: boolean; tabHeight?: number; wrapperClassName?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!fill || !el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill]);

  const tab = fill && width ? Math.floor((width - 8) / props.items.length) : undefined;
  const vars = {
    ...(tab && { '--lg-tab-width': `${tab}px` }),
    ...(tabHeight && { '--lg-tab-height': `${tabHeight}px` }),
    ...style,
  } as CSSProperties;
  const bar = <TabBar {...props} style={vars} />;
  return fill ? (
    <div ref={box} className={cn('min-w-0', wrapperClassName)}>
      {bar}
    </div>
  ) : (
    bar
  );
}
