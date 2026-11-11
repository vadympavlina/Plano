import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open, startSeeded } from './fixtures';

const ROUTES = [
  ['today', '/'],
  ['upcoming', '/upcoming'],
  ['tasks', '/tasks'],
  ['calendar', '/calendar'],
  ['habits', '/habits'],
  ['habit', '/habits/h1'],
  ['goals', '/goals'],
  ['projects', '/projects'],
  ['project', '/projects/p1'],
  ['notes', '/notes'],
  ['note', '/notes/n1'],
  ['settings', '/settings'],
] as const;

async function scan(page: Page) {
  // Let colour and opacity transitions settle: axe would read a colour halfway between two.
  await page.waitForTimeout(350);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Experimental «label in name»: day buttons show «Ср 11» but are named «Середа, 11 листопада» on purpose.
    .disableRules(['label-content-name-mismatch'])
    .analyze();
  // One readable line per rule and element, so a failure says what to fix.
  const lines = result.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${v.help}`));
  expect(lines, lines.join('\n')).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`axe, ${theme} theme`, () => {
    for (const [name, hash] of ROUTES) {
      test(`page: ${name}`, async ({ page }) => {
        await startSeeded(page, theme);
        await open(page, hash);
        await scan(page);
      });
    }

    test('dialogs: new task, new event, quick add, search', async ({ page }) => {
      await startSeeded(page, theme);
      for (const hash of ['/tasks?new=1', '/calendar?new=1']) {
        await open(page, hash);
        await page.getByRole('dialog').waitFor();
        await scan(page);
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'detached' });
      }
      await open(page, '/');
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog').waitFor();
      await scan(page);
    });
  });
}

test('axe: the phone menu, opened', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the menu drawer is a phone control');
  await startSeeded(page, 'light');
  await page.getByRole('button', { name: 'Меню', exact: true }).tap();
  await page.getByRole('dialog', { name: 'Меню' }).waitFor();
  await scan(page);
});
