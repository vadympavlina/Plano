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
  // 12:00 in the first column (Playwright scrolls the grid to it).
  await page.locator('[data-day-index="0"]').click({ position: { x: 60, y: 12 * 52 + 20 } });
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

test('phone: the tab bar switches sections and the menu button opens every section', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the tab bar is for phones');
  await start(page);
  const nav = page.getByRole('navigation', { name: 'Головна навігація' });
  await nav.getByRole('link', { name: 'Календар' }).tap();
  await expect(page).toHaveURL(/#\/calendar/);
  await nav.getByRole('link', { name: 'Задачі' }).tap();
  await expect(page).toHaveURL(/#\/tasks/);
  await page.getByRole('button', { name: 'Меню', exact: true }).tap();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: 'Звички' }).tap();
  await expect(page).toHaveURL(/#\/habits/);
});

test('desktop: the sidebar leads to every section, including «Найближчі»', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar is for wide screens');
  await start(page);
  const side = page.getByRole('navigation', { name: 'Розділи' });
  await side.getByRole('link', { name: 'Найближчі' }).click();
  await expect(page).toHaveURL(/#\/upcoming/);
  await expect(page.getByRole('heading', { name: 'Найближчі' })).toBeVisible();
  await side.getByRole('link', { name: 'Сьогодні' }).click();
  await expect(page.getByRole('heading', { name: 'Сьогодні' })).toBeVisible();
});

test('today: a task added to the inbox shows in the side card and can be ticked off', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the side card is for wide screens');
  await start(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const input = page.getByLabel('Нова задача у вхідні');
  await input.fill('Розібрати папку');
  await input.press('Enter');
  const tick = page.getByRole('checkbox', { name: /Виконати «Розібрати папку»/ });
  await expect(tick).toBeVisible();
  await tick.click();
  await expect(page.getByRole('checkbox', { name: /Повернути «Розібрати папку»/ })).toBeVisible();
});

test('tasks: a task opens in the side card and closes again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the side card is for wide screens');
  await start(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/tasks');
  const field = page.getByLabel('Нова задача', { exact: true });
  await field.fill('Скласти план');
  await field.press('Enter');
  await page.getByRole('button', { name: /Скласти план/ }).click();
  const panel = page.getByRole('complementary', { name: 'Бічна панель' });
  await expect(panel).toContainText('Скласти план');
  await panel.getByRole('button', { name: 'Закрити' }).click();
  await expect(panel).toBeHidden();
});

test('calendar: the view switch changes the view', async ({ page }) => {
  await start(page);
  await page.goto('/#/calendar?view=week');
  await page.getByRole('combobox', { name: 'Вигляд календаря' }).click();
  await page.getByRole('option', { name: 'Місяць' }).click();
  await expect(page).toHaveURL(/view=month/);
});

test('quick add: «Детальніше…» with an empty title opens the full event form', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the «Подія» button is for wider screens; phones use the tab bar');
  await start(page);
  await page.goto('/#/calendar?view=week');
  await page.getByRole('button', { name: /поді[яю]/i }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'Детальніше…' }).click();
  await expect(page.getByRole('dialog')).toContainText('Нова подія');
  await expect(page.getByRole('switch', { name: 'Весь день' })).toBeVisible();
});

test('phone: the menu drawer follows the finger and a flick to the left closes it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch gestures');
  await start(page);
  await page.getByRole('button', { name: 'Меню', exact: true }).tap();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, x?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x!, y: 400, id: 1 }] });
  // Slowly 40px left and let go: it springs back and stays open.
  await touch('touchStart', 250);
  for (const x of [235, 220, 210]) {
    await touch('touchMove', x);
    await page.waitForTimeout(60);
  }
  expect(await drawer.evaluate((e) => (e as HTMLElement).style.translate)).toContain('-40px');
  await page.waitForTimeout(250);
  await touch('touchEnd');
  await expect(drawer).toBeVisible();
  await expect.poll(() => drawer.evaluate((e) => (e as HTMLElement).style.translate)).toBe('');
  // A quick flick closes it even though the distance is short.
  await touch('touchStart', 250);
  await touch('touchMove', 205);
  await page.waitForTimeout(40);
  await touch('touchMove', 160);
  await touch('touchEnd');
  await expect(drawer).toBeHidden();
});

test('tasks board: a card can be dragged into another column with the pointer', async ({ page }) => {
  await start(page);
  await page.getByLabel('Назва для швидкого додавання').fill('Перетягни мене сьогодні');
  await page.getByLabel('Назва для швидкого додавання').press('Enter');
  await page.goto('/#/tasks');
  await page.locator('[role=tab][title="Дошка"]').click();
  const from = page.locator('section[aria-label="До виконання"]').getByText('Перетягни мене').first();
  await expect(from).toBeVisible();
  const a = (await from.boundingBox())!;
  const t = (await page.locator('section[aria-label="Виконано"]').boundingBox())!;
  await page.mouse.move(a.x + 8, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + 20, { steps: 3 });
  await page.mouse.move(t.x + t.width / 2, t.y + 120, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('section[aria-label="Виконано"]').getByText('Перетягни мене')).toBeVisible();
});

test('phone: a sheet that is still sliding in can be caught by a finger', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch gestures');
  await start(page);
  await page.goto('/#/tasks?new=1');
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(700);
  // Fully open: no leftover offset.
  expect(await sheet.evaluate((e) => getComputedStyle(e).translate)).toMatch(/^(none|0px( 0px)?)$/);
  const cdp = await page.context().newCDPSession(page);
  const handle = (await sheet.locator('div.touch-none').first().boundingBox())!;
  const touch = (type: string, y?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y: y!, id: 1 }] });
  await touch('touchStart', handle.y + 10);
  await touch('touchMove', handle.y + 40);
  await page.waitForTimeout(60);
  await touch('touchMove', handle.y + 70);
  // While held, the entrance transition is off and the sheet sits where the finger put it.
  expect(await sheet.evaluate((e) => (e as HTMLElement).style.transition)).toBe('none');
  await touch('touchEnd');
  await expect.poll(() => sheet.evaluate((e) => (e as HTMLElement).style.transition)).toBe('');
});

test('share target: shared text opens quick add with that text, and the address is cleaned', async ({ page }) => {
  await start(page);
  await page.goto('/?title=Ідея&text=Купити%20молоко%20завтра%20о%2010&url=https%3A%2F%2Fexample.com');
  const field = page.getByRole('dialog').getByLabel('Назва для швидкого додавання');
  await expect(field).toHaveValue(/Ідея Купити молоко завтра о 10 https:\/\/example\.com/);
  expect(page.url()).not.toContain('text=');
});

test('pwa: the manifest declares install, share and shortcut metadata', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.share_target?.params?.text).toBe('text');
  expect(m.shortcuts?.length).toBeGreaterThanOrEqual(3);
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  expect(m.screenshots.some((s: { form_factor?: string }) => s.form_factor === 'wide')).toBe(true);
});
