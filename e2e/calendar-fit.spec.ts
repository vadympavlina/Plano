import { expect, test } from '@playwright/test';
import { open, startSeeded } from './fixtures';

// Phones: the calendar takes exactly the screen above the tab bar. The page itself does not scroll (the top bar stays),
// and scrolling the grid to its end leaves the last hour visible above the bar, not under it.
for (const view of ['day', '3days', 'week', 'month']) {
  test(`phone: the ${view} view fits above the tab bar`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phones');
    await startSeeded(page);
    await open(page, `/calendar?view=${view}`);
    const size = await page.evaluate(() => ({ page: document.documentElement.scrollHeight, screen: window.innerHeight }));
    expect(size.page).toBeLessThanOrEqual(size.screen + 1);
    // A wheel or a swipe over the grid cannot push the top bar away.
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const nav = (await page.getByRole('navigation', { name: 'Головна навігація' }).boundingBox())!;
    const grid = page.locator(view === 'month' ? '[data-month-index="0"]' : '[data-day-index="0"]');
    if (view !== 'month') {
      await grid.evaluate((el) => {
        let n = el.parentElement;
        while (n && n.scrollHeight <= n.clientHeight) n = n.parentElement;
        if (n) n.scrollTop = n.scrollHeight;
      });
      await page.waitForTimeout(150);
      const last = (await page.getByText('23:00', { exact: true }).first().boundingBox())!;
      expect(last.y + last.height).toBeLessThanOrEqual(nav.y);
    } else {
      const lastRow = (await page.locator('[data-month-index="35"]').boundingBox())!;
      expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(nav.y + 1);
    }
  });
}
