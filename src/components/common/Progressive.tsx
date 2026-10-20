import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Long lists in steps: the first batch renders at once, the next one mounts as the
 * end comes near. Rows off screen also skip layout and paint (content-visibility on the row).
 */
export function Progressive<T>({ items, step = 60, children }: { items: T[]; step?: number; children: (item: T) => ReactNode }) {
  const [count, setCount] = useState(step);
  const end = useRef<HTMLDivElement>(null);
  const more = count < items.length;
  useEffect(() => {
    const el = end.current;
    if (!more || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setCount((c) => c + step), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, count, step]);
  return (
    <>
      {items.slice(0, count).map(children)}
      {more && <div ref={end} aria-hidden className="h-px" />}
    </>
  );
}
