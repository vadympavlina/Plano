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

const noteText = (page: Page) =>
  page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}');
    return (Object.values(raw.users.preview.notes).find((n) => (n as { id: string }).id === 'n1') as { content: string }).content;
  });

test('notes: the text is edited as live blocks — a tick, «- [ ] », Enter in a list, «/» and the Markdown view', async ({ page }) => {
  await open(page, '/notes');
  await page.getByRole('link', { name: /Вікенд у Лісабоні/ }).click();
  const editor = page.getByLabel('Текст нотатки', { exact: true });
  await expect(editor).toBeVisible();

  // A tick is a tick, and it is saved as Markdown.
  await editor.locator('li', { hasText: 'Квитки' }).locator('input[type=checkbox]').click();
  await expect.poll(() => noteText(page)).toContain('- [x] Квитки');

  // «- [ ] » makes a checklist item; Enter makes the next one; Enter on an empty one ends the list.
  await editor.locator('li', { hasText: 'Готель' }).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- [ ] Таксі');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Метро');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Кінець **списку**');
  await expect.poll(() => noteText(page)).toMatch(/- \[ \] Таксі\n- \[ \] Метро\n\nКінець \*\*списку\*\*/);

  // «/» opens the blocks; typing narrows them; Enter adds the block.
  await page.keyboard.press('Enter');
  await page.keyboard.type('/заголовок 2');
  await expect(page.getByRole('listbox', { name: 'Блоки' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Розділ');
  await expect.poll(() => noteText(page)).toContain('## Розділ');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await page.getByRole('option', { name: /Цитата/ }).click();
  await page.keyboard.type('Мудра думка');
  await expect.poll(() => noteText(page)).toContain('> Мудра думка');

  // It survives a reload, and the Markdown view shows the very same text.
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByLabel('Текст нотатки', { exact: true }).locator('li', { hasText: 'Метро' })).toBeVisible();
  await page.getByRole('button', { name: 'Markdown' }).click();
  await expect(page.getByLabel('Текст нотатки (Markdown)')).toHaveValue(/## Розділ/);
  await page.getByRole('button', { name: 'Редактор' }).click();
  await expect(page.getByLabel('Текст нотатки', { exact: true }).getByRole('heading', { name: 'Розділ' })).toBeVisible();
});

test('notes: a new note is ready to type in, and the tools ride above the keyboard', async ({ page }) => {
  await open(page, '/notes');
  // A keyboard comes up: the visual viewport gets 300px shorter.
  await page.evaluate(() => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, 'height', { value: window.innerHeight - 300, configurable: true });
    vv.dispatchEvent(new Event('resize'));
  });
  await page.getByRole('button', { name: 'Нова нотатка' }).click();
  const title = page.getByLabel('Назва нотатки');
  await expect(title).toBeFocused();
  await page.keyboard.type('Ідея');
  // Enter in the title moves on to the text.
  await page.keyboard.press('Enter');
  await page.keyboard.type('Перший рядок');
  await expect(page.getByLabel('Текст нотатки', { exact: true })).toBeFocused();
  // While the text is being typed (a phone), the toolbar is pinned to the bottom of the screen, not up in the page.
  const bar = page.getByRole('toolbar', { name: 'Форматування' }).locator('..');
  await expect(bar).toHaveCSS('position', 'fixed');
  await expect(bar).toHaveCSS('bottom', '300px');
});

test('notes: a link is typed into a small bar, not a browser dialog', async ({ page }) => {
  await open(page, '/notes');
  await page.getByRole('link', { name: /Вікенд у Лісабоні/ }).click();
  const editor = page.getByLabel('Текст нотатки', { exact: true });
  await editor.locator('li', { hasText: 'Готель' }).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Посилання' }).click();
  await page.getByLabel('Адреса посилання').fill('example.com');
  await page.keyboard.press('Enter');
  await expect.poll(() => noteText(page)).toContain('[example.com](https://example.com)');
  await expect(editor.getByRole('link', { name: 'example.com' })).toBeVisible();
});

test('notes: deleting moves a note to the trash, with undo, restore and removal for good', async ({ page }) => {
  await open(page, '/notes');
  await page.getByRole('link', { name: /Вікенд у Лісабоні/ }).click();
  await page.getByRole('button', { name: 'Видалити нотатку' }).click();
  // Gone from the list; one tap on the toast brings it back.
  await expect(page.getByRole('link', { name: /Вікенд у Лісабоні/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Скасувати' }).click();
  await expect(page.getByRole('link', { name: /Вікенд у Лісабоні/ })).toBeVisible();

  // Deleted again: it is in the trash, from where it is restored.
  await page.getByRole('link', { name: /Вікенд у Лісабоні/ }).click();
  await page.getByRole('button', { name: 'Видалити нотатку' }).click();
  await expect(page.getByRole('button', { name: /Кошик/ })).toBeVisible();
  await page.getByRole('button', { name: /Кошик/ }).click();
  await page.getByRole('button', { name: /^Відновити/ }).click();
  await expect(page.getByRole('link', { name: /Вікенд у Лісабоні/ })).toBeVisible();

  // And removed for good, after a confirmation.
  await page.getByRole('link', { name: /Вікенд у Лісабоні/ }).click();
  await page.getByRole('button', { name: 'Видалити нотатку' }).click();
  await page.getByRole('button', { name: /Кошик/ }).click();
  await page.getByRole('button', { name: /назавжди$/ }).click();
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await expect(page.getByRole('button', { name: /Кошик/ })).toHaveCount(0);
  await expect(page.getByText('Нотаток поки немає')).toBeVisible();
});
