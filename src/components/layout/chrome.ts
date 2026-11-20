import { createContext, useContext } from 'react';

/** What the layout lets a page do with its chrome: a page that draws its own top bar on a phone opens the menu through this. */
export const ChromeCtx = createContext<{ openMenu: () => void }>({ openMenu: () => undefined });
export const useChrome = () => useContext(ChromeCtx);
