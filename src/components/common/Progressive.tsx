import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** The nearest ancestor that scrolls vertically, or null for the page itself. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/**
 * One slice of a long list. In range it renders its rows; out of range it renders an empty block of
 * the height it had, so the scrollbar and the position stay where they were.
 */
function Chunk<T>({ items, estimate, eager, children }: { items: T[]; estimate: number; eager: boolean; children: (item: T) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(eager);
  const height = useRef(items.length * estimate);

  useLayoutEffect(() => {
    // Remember the real height while the rows are there: it is what the spacer will keep.
    if (shown && box.current) height.current = box.current.offsetHeight;
  });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return void setShown(true);
    // The margin has to be measured against the scrolling container itself: with the page as the
    // root, a nested scroller would clip the margin away and rows would pop in as they arrive.
    const io = new IntersectionObserver(([e]) => setShown(e.isIntersecting), { root: scrollParent(el), rootMargin: '1400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} style={shown ? undefined : { height: height.current }}>
      {shown && items.map(children)}
    </div>
  );
}

/**
 * A long list that keeps only what is near the screen in the DOM (about three screens): the list is cut
 * into slices of `step` rows, and slices far from view are swapped for a spacer of the same height.
 * Short lists render as they are. Rows off screen also skip layout and paint (content-visibility on the row).
 * (The browser's find-in-page does not see rows that are not mounted.)
 */
export function Progressive<T>({
  items,
  step = 40,
  estimate = 58,
  children,
}: {
  items: T[];
  step?: number;
  estimate?: number;
  children: (item: T) => ReactNode;
}) {
  if (items.length <= step * 3) return <>{items.map(children)}</>;
  return (
    <Windowed items={items} step={step} estimate={estimate}>
      {children}
    </Windowed>
  );
}

function Windowed<T>({ items, step, estimate, children }: { items: T[]; step: number; estimate: number; children: (item: T) => ReactNode }) {
  const chunks = useMemo(() => {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
    return out;
  }, [items, step]);
  return (
    <>
      {chunks.map((c, i) => (
        <Chunk key={i} items={c} estimate={estimate} eager={i < 2}>
          {children}
        </Chunk>
      ))}
    </>
  );
}
