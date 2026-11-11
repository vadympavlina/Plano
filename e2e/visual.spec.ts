import { expect, test } from '@playwright/test';
import { open, startSeeded } from './fixtures';

// Screenshots of the main pages, light and dark, on the desktop and phone profiles. The clock and the
// data are fixed (see fixtures.ts), so a changed pixel is a changed design.
// Baselines live next to this file. After an intended change: npm run e2e:visual:update

const PAGES = [
  ['today', '/'],
  ['tasks', '/tasks'],
  ['calendar', '/calendar'],
  ['habits', '/habits'],
  ['goals', '/goals'],
  ['projects', '/projects'],
  ['note', '/notes/n1'],
  ['settings', '/settings'],
] as const;
const DARK = new Set(['today', 'tasks', 'calendar', 'habits']);

for (const theme of ['light', 'dark'] as const) {
  test.describe(`@visual ${theme}`, () => {
    for (const [name, hash] of PAGES) {
      if (theme === 'dark' && !DARK.has(name)) continue;
      test(`${name}`, async ({ page }) => {
        await startSeeded(page, theme);
        await open(page, hash);
        await expect(page).toHaveScreenshot(`${name}-${theme}.png`, { animations: 'disabled', caret: 'hide' });
      });
    }
  });
}
