import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open, startSeeded } from './fixtures';

// The privacy policy and the terms are plain pages (public/privacy.html, public/terms.html): Google asks for both
// at a public address, with a contact and the Limited Use statement.

for (const [file, ukTitle, enTitle] of [
  ['privacy.html', 'Політика конфіденційності', 'Privacy Policy'],
  ['terms.html', 'Умови використання', 'Terms of Service'],
] as const) {
  test(`${file}: a public page in two languages, with the contact`, async ({ page }) => {
    const res = await page.goto(`/${file}`);
    expect(res?.status()).toBe(200);
    // The page itself, not the app: no app shell, the text is there at once.
    await expect(page.locator('#root')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ukTitle);
    await expect(page.getByRole('link', { name: 'support@edvault.online' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(enTitle);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // And the choice is kept.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(enTitle);
  });

  test(`${file}: passes the accessibility check`, async ({ page }) => {
    await page.goto(`/${file}#en`);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('the privacy policy says what Google asks for: the scopes and the Limited Use statement', async ({ page }) => {
  await page.goto('/privacy.html#en');
  const text = await page.locator('section[lang="en"]').innerText();
  expect(text).toContain('calendar.events');
  expect(text).toContain('calendar.calendarlist.readonly');
  expect(text).toContain('Google API Services User Data Policy');
  expect(text).toContain('Limited Use');
  await expect(page.getByRole('link', { name: 'Google API Services User Data Policy' })).toHaveAttribute(
    'href',
    /developers\.google\.com\/terms\/api-services-user-data-policy/,
  );
});

test('the app links to both pages (Settings → Data)', async ({ page }) => {
  await startSeeded(page);
  await open(page, '/settings');
  await expect(page.getByRole('link', { name: 'Конфіденційність' })).toHaveAttribute('href', /privacy\.html$/);
  await expect(page.getByRole('link', { name: 'Умови', exact: true })).toHaveAttribute('href', /terms\.html$/);
});
