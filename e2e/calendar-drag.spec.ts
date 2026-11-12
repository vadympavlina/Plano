import { expect, test, type Page } from '@playwright/test';
import { open, startSeeded } from './fixtures';

const stored = (page: Page, id: string) =>
  page.evaluate((id) => {
    const raw = JSON.parse(localStorage.getItem('plano:preview:data') ?? '{}');
    return raw.users.preview.tasks[id] as { dueDate?: string; startTime?: string; endTime?: string };
  }, id);

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(isMobile, 'moving by pointer is for mouse and pen; a finger scrolls');
  await startSeeded(page);
});

test('calendar: a timed task is dragged to another hour, and stretched', async ({ page }) => {
  await open(page, '/calendar?view=day');
  const block = page.getByRole('group', { name: /Подзвонити мамі/ });
  await expect(block).toBeVisible();
  await block.scrollIntoViewIfNeeded();
  const before = (await stored(page, 't3'))!;
  expect(before.startTime).toBe('19:00');
  const b = (await block.boundingBox())!;
  // 68 px per hour: two hours up.
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 6 - 10);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y - 40, { steps: 6 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 16 - 136, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await stored(page, 't3')).startTime).toBe('17:00');
  expect((await stored(page, 't3')).endTime).toBe('17:30');
  // Stretch by the bottom edge: +30 minutes.
  await block.hover();
  const m = (await page.getByRole('group', { name: /Подзвонити мамі/ }).boundingBox())!;
  await page.mouse.move(m.x + m.width / 2, m.y + m.height - 4);
  await page.mouse.down();
  await page.mouse.move(m.x + m.width / 2, m.y + m.height + 34, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await stored(page, 't3')).endTime).toBe('18:00');
});

test('calendar: a task is dragged to another day in the week and in the month', async ({ page }) => {
  await open(page, '/calendar?view=week');
  const block = page.getByRole('group', { name: /Подзвонити мамі/ });
  await block.scrollIntoViewIfNeeded();
  const b = (await block.boundingBox())!;
  const day = (await page.locator('[data-day-index="0"]').boundingBox())!;
  const dueBefore = (await stored(page, 't3')).dueDate!;
  // One column to the right.
  await page.mouse.move(b.x + b.width - 5, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 5 + 20, b.y + b.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width - 5 + day.width, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await stored(page, 't3')).dueDate).not.toBe(dueBefore);
  expect((await stored(page, 't3')).startTime).toBe('19:00');

  // Month: the task chip is dragged onto another cell (a real HTML5 drag).
  await open(page, '/calendar?view=month');
  const chip = page.locator('[draggable=true]', { hasText: 'Подзвонити мамі' }).first();
  const target = page.locator('[data-month-index="3"]');
  await chip.dragTo(target);
  await expect.poll(async () => (await stored(page, 't3')).dueDate).not.toBe(dueBefore);
  await expect.poll(async () => (await stored(page, 't3')).startTime).toBe('19:00');
});
