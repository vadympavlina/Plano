import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface Slot {
  el: HTMLElement | null;
  mount: () => () => void;
}
export const PanelSlot = createContext<Slot>({ el: null, mount: () => () => undefined });

/**
 * A page's side card (inbox, details). On wide screens it fills the layout's right-hand
 * card; on narrower ones it just follows the page content.
 */
export function RightPanel({ children, className }: { children: ReactNode; className?: string }) {
  const slot = useContext(PanelSlot);
  const wide = useMediaQuery('(min-width: 1280px)');
  const { mount } = slot;
  useEffect(() => (wide ? mount() : undefined), [wide, mount]);
  if (wide && slot.el) return createPortal(children, slot.el);
  return <section className={className ?? 'mt-8 border-t border-line pt-6'}>{children}</section>;
}
