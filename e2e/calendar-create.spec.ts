import { expect, test, type Page } from '@playwright/test';
import { open, startSeeded } from './fixtures';

const records = (page: Page, kind: 'tasks' | 'events') =>
  page.evaluate((kind) => {
    const raw = JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}');
    return Object.values(raw.users.preview[kind] ?? {}) as Record<string, unknown>[];
  }, kind);

/** Picks a slot (at the hour given) of the day view: a click with a mouse, a press-and-hold with a finger. */
async function pickSlot(page: Page, isMobile: boolean, hour = 14) {
  const column = page.locator('[data-day-index="0"]');
  await column.evaluate((el, hour) => {
    let n = el.parentElement;
    while (n && n.scrollHeight <= n.clientHeight) n = n.parentElement;
    if (n) n.scrollTop = hour * 68 - 160;
  }, hour);
  const box = (await column.boundingBox())!;
  const y = box.y + hour * 68 + 14;
  if (!isMobile) {
    await page.mouse.click(box.x + 40, y);
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const at = { x: box.x + 30, y };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1 }] });
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page }) => {
  await startSeeded(page);
});

test('calendar: the same gesture that makes an event can make a task, and it remembers the choice', async ({ page, isMobile }) => {
  await open(page, '/calendar?view=day');
  await pickSlot(page, isMobile);
  const dialog = page.getByRole('dialog');
  // An event by default; one tap switches to a task, and the title follows.
  await expect(dialog).toContainText('Нова подія');
  await dialog.getByRole('radio', { name: 'Задача' }).click();
  await expect(dialog).toContainText('Нова задача');
  await dialog.getByLabel('Назва для швидкого додавання').fill('Подзвонити в банк');
  await dialog.getByLabel('Назва для швидкого додавання').press('Enter');
  await expect(dialog).toBeHidden();
  await expect
    .poll(async () => (await records(page, 'tasks')).find((t) => t.title === 'Подзвонити в банк'))
    .toMatchObject({ dueDate: '2026-11-10', startTime: '14:00' });
  expect((await records(page, 'events')).find((e) => e.title === 'Подзвонити в банк')).toBeUndefined();

  // Next time the same gesture starts with a task.
  await pickSlot(page, isMobile, 17);
  await expect(dialog).toContainText('Нова задача');
  await expect(dialog.getByRole('radio', { name: 'Задача' })).toHaveAttribute('aria-checked', 'true');
  // …and switching back makes an event.
  await dialog.getByRole('radio', { name: 'Подія' }).click();
  await dialog.getByLabel('Назва для швидкого додавання').fill('Масаж');
  await dialog.getByLabel('Назва для швидкого додавання').press('Enter');
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await records(page, 'events')).find((e) => e.title === 'Масаж')).toMatchObject({ date: '2026-11-10', startTime: '17:00' });
});

test('calendar month: a tap on a day can add a task to that day', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones show dots in the month and open the day instead');
  await open(page, '/calendar?view=month');
  await page.locator('[data-month-index="12"]').click({ position: { x: 8, y: 60 } });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Задача' }).click();
  await dialog.getByLabel('Назва для швидкого додавання').fill('Оплатити рахунок');
  await dialog.getByLabel('Назва для швидкого додавання').press('Enter');
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await records(page, 'tasks')).find((t) => t.title === 'Оплатити рахунок')).toBeDefined();
  const created = (await records(page, 'tasks')).find((t) => t.title === 'Оплатити рахунок')!;
  expect(created.dueDate).toMatch(/^2026-11-\d\d$/);
  expect(created.startTime).toBeUndefined();
});
