import { expect, test, type Page } from '@playwright/test';

/** Fresh local preview (data lives only in this browser). */
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Відкрити локальний перегляд' }).click();
  await expect(page.getByText(/Доброго (ранку|дня|вечора|ночі)/)).toBeVisible();
}

test('task: quick add, find it in Tasks, tick it off', async ({ page }) => {
  await start(page);
  // «сьогодні» is read as the date and dropped from the title.
  await page.getByLabel('Назва для швидкого додавання').fill('Купити молоко сьогодні');
  await page.getByLabel('Назва для швидкого додавання').press('Enter');
  await page.goto('/#/tasks?list=today');
  const row = page.getByText('Купити молоко').first();
  await expect(row).toBeVisible();
  await page.getByRole('checkbox', { name: /Купити молоко/ }).first().click();
  await expect(page.getByRole('checkbox', { name: /Купити молоко/ }).first()).toHaveAttribute('aria-checked', 'true');
});

test('habit: create one and mark today', async ({ page }) => {
  await start(page);
  await page.goto('/#/habits');
  await page.getByRole('button', { name: /Звичка/ }).first().click();
  await page.getByLabel('Назва').fill('Вода');
  await page.getByRole('button', { name: 'Створити звичку' }).click();
  await expect(page.getByText('Вода').first()).toBeVisible();
  await page.getByRole('button', { name: 'Відмітити «Вода»' }).click();
  await expect(page.getByText(/Сьогодні 1 з 1/)).toBeVisible();
});

test('settings: search narrows the list', async ({ page }) => {
  await start(page);
  await page.goto('/#/settings');
  await page.getByLabel('Знайти налаштування').fill('формат');
  await expect(page.getByText('Формат часу')).toBeVisible();
  await expect(page.getByText('Початок тижня')).toBeHidden();
});

test('offline: the installed app still opens', async ({ page, context }) => {
  await start(page);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Доброго (ранку|дня|вечора|ночі)/)).toBeVisible();
});

test('app icon shortcut: «Нова задача» opens the task form', async ({ page }) => {
  await start(page);
  await page.goto('/#/tasks?new=1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).not.toHaveURL(/new=1/);
});

test('calendar: tapping my own event opens its details (phone too)', async ({ page, isMobile }) => {
  await start(page);
  await page.getByLabel('Назва для швидкого додавання').fill('Нарада сьогодні о 9 на годину');
  await page.getByLabel('Назва для швидкого додавання').press('Enter');
  await page.goto('/#/calendar?view=day');
  const block = page.getByRole('button', { name: /^Нарада, / });
  if (isMobile) await block.tap();
  else await block.click();
  await expect(page.getByRole('dialog')).toContainText('Нарада');
});

test('quick capture: «+» / N reads date, time and category, then adds a task', async ({ page, isMobile }) => {
  await start(page);
  if (isMobile) await page.getByRole('button', { name: 'Швидко додати' }).click();
  else await page.keyboard.press('n');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Назва для швидкого додавання').fill('купити ліки завтра ввечері #Особисте');
  await expect(dialog.getByRole('button', { name: 'Прибрати «Особисте»' })).toBeVisible();
  await dialog.getByLabel('Назва для швидкого додавання').press('Enter');
  await expect(dialog).toBeHidden();
  await page.goto('/#/tasks?list=all');
  await expect(page.getByText('Купити ліки', { exact: true })).toBeVisible();
});

test('quick capture: a pasted list adds every line', async ({ page }) => {
  await start(page);
  const field = page.getByLabel('Назва для швидкого додавання');
  await field.fill('Оплатити інтернет завтра\nКупити: молоко, хліб');
  await expect(page.getByText(/2 записи/)).toBeVisible();
  await field.press('Enter');
  await page.goto('/#/tasks?list=all');
  await expect(page.getByText('Оплатити інтернет', { exact: true })).toBeVisible();
  await expect(page.getByText('Купити', { exact: true })).toBeVisible();
});

test('calendar: clicking an hour opens quick add with the time filled in', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on phones a slot is picked with a long press');
  await start(page);
  await page.goto('/#/calendar?view=day');
  const column = page.locator('[data-day-index="0"]');
  await column.scrollIntoViewIfNeeded();
  const box = (await column.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Нова подія');
  await dialog.getByLabel('Назва для швидкого додавання').fill('Обід');
  await dialog.getByLabel('Назва для швидкого додавання').press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Обід, / })).toBeVisible();
});

test('task form: dates, time and category are read from the title', async ({ page }) => {
  await start(page);
  await page.goto('/#/tasks?new=1');
  const title = page.getByRole('dialog').getByLabel('Назва', { exact: true });
  await title.fill('Звіт завтра о 15 #Особисте');
  await title.press('Tab');
  await expect(title).toHaveValue('Звіт');
  await expect(page.getByText('Заповнено з назви')).toBeVisible();
  await expect(page.getByLabel('Час початку')).toContainText('15:00');
});
