import { expect, test, type Page } from '@playwright/test';
import { open, startSeeded } from './fixtures';

/** The records of one kind in the local preview's store. */
const records = (page: Page, kind: 'tasks' | 'events') =>
  page.evaluate((kind) => {
    const raw = JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}');
    return Object.values(raw.users.preview[kind] ?? {}) as Record<string, unknown>[];
  }, kind);

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone layout of the forms');
  await startSeeded(page);
});

test('task form on a phone: pick the day with one tap, a time from the sheet, save from the top bar', async ({ page }) => {
  await open(page, '/tasks?new=1');
  const form = page.getByRole('dialog', { name: 'Нова задача' });
  await form.getByLabel('Назва', { exact: true }).fill('Купити квитки');
  // The most common answer, «when», is the first thing under the title.
  await form.getByRole('radio', { name: 'Завтра' }).click();
  await expect(form.getByRole('button', { name: 'Термін' })).toContainText('Завтра');
  // A time comes from a sheet, not from a floating panel.
  await form.getByRole('button', { name: 'Час початку' }).click();
  const sheet = page.getByRole('dialog', { name: 'Час' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('option', { name: '09:30' }).click();
  await expect(sheet).toBeHidden();
  await expect(form.getByRole('button', { name: 'Час початку' })).toContainText('09:30');
  await form.getByRole('radio', { name: 'Високий' }).click();
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(form).toBeHidden();
  await expect
    .poll(async () => (await records(page, 'tasks')).find((t) => t.title === 'Купити квитки'))
    .toMatchObject({ dueDate: '2026-11-11', startTime: '09:30', priority: 'high' });
});

test('event form on a phone: all the time lines, a quick length, save from the top bar', async ({ page }) => {
  await open(page, '/calendar?new=1');
  const form = page.getByRole('dialog', { name: 'Нова подія' });
  await form.getByLabel('Назва', { exact: true }).fill('Зустріч з Олею');
  await expect(form.getByRole('button', { name: 'Початок' })).toContainText('10:30');
  await form.getByRole('radio', { name: '2 год' }).click();
  await expect(form.getByRole('button', { name: 'Кінець' })).toContainText('12:30');
  await form.getByLabel('Місце').fill('Кав’ярня');
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(form).toBeHidden();
  await expect
    .poll(async () => (await records(page, 'events')).find((e) => e.title === 'Зустріч з Олею'))
    .toMatchObject({ startTime: '10:30', endTime: '12:30', location: 'Кав’ярня' });
});

test('a picker sheet closes on its own without closing the form under it', async ({ page }) => {
  await open(page, '/tasks?new=1');
  const form = page.getByRole('dialog', { name: 'Нова задача' });
  await form.getByLabel('Назва', { exact: true }).fill('Чернетка');
  await form.getByRole('button', { name: 'Термін' }).click();
  const sheet = page.getByRole('dialog', { name: 'Дата' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Закрити' }).click();
  await expect(sheet).toBeHidden();
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Назва', { exact: true })).toHaveValue('Чернетка');
});

test('the sheet lifts itself above the on-screen keyboard', async ({ page }) => {
  // A stand-in for the browser's visual viewport that is 300 px shorter than the screen, as with a keyboard.
  await page.evaluate(() => {
    const fake = { height: window.innerHeight - 300, offsetTop: 0, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
  });
  await open(page, '/tasks?new=1');
  const form = page.getByRole('dialog', { name: 'Нова задача' });
  await expect(form).toBeVisible();
  await page.waitForTimeout(500);
  const box = (await form.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 290);
});
