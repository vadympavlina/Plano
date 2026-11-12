// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { Progressive } from '@/components/common/Progressive';

/** A stand-in for IntersectionObserver that lets the test say which slices are near the screen. */
let observers: { cb: (e: { isIntersecting: boolean }[]) => void; el: Element }[] = [];
beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      cb: (e: { isIntersecting: boolean }[]) => void;
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        this.cb = cb;
      }
      observe(el: Element) {
        observers.push({ cb: this.cb, el });
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('Progressive', () => {
  it('renders a short list as it is, with no observers', () => {
    const { container } = render(<Progressive items={rows(100)}>{(i) => <p key={i}>row {i}</p>}</Progressive>);
    expect(container.querySelectorAll('p')).toHaveLength(100);
    expect(observers).toHaveLength(0);
  });

  it('mounts only the slices near the screen of a long list, and keeps the others as spacers', () => {
    const { container } = render(
      <Progressive items={rows(500)} step={40}>
        {(i) => <p key={i}>row {i}</p>}
      </Progressive>,
    );
    expect(observers).toHaveLength(13); // 500 rows / 40 per slice
    // Nothing reported as near the screen: nothing is mounted, the scroll height is held by spacers.
    act(() => observers.forEach((o) => o.cb([{ isIntersecting: false }])));
    expect(container.querySelectorAll('p')).toHaveLength(0);
    // The fifth slice comes into range.
    act(() => observers[4].cb([{ isIntersecting: true }]));
    expect(container.querySelectorAll('p')).toHaveLength(40);
    expect(container.textContent).toContain('row 160');
    expect(container.textContent).toContain('row 199');
    // And leaves again.
    act(() => observers[4].cb([{ isIntersecting: false }]));
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
