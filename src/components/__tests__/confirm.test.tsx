// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { ConfirmDialogHost, confirm } from '@/components/common/ConfirmDialog';

afterEach(cleanup);

describe('confirm()', () => {
  it('resolves true on the confirm button and false on cancel', async () => {
    render(<ConfirmDialogHost />);
    let answer!: Promise<boolean>;
    act(() => {
      answer = confirm({ title: 'Видалити задачу?', confirmLabel: 'Видалити', cancelLabel: 'Скасувати' });
    });
    expect(await screen.findByRole('heading', { name: 'Видалити задачу?' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Видалити' }));
    await expect(answer).resolves.toBe(true);

    act(() => {
      answer = confirm({ title: 'Ще раз?', confirmLabel: 'Так', cancelLabel: 'Скасувати' });
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Скасувати' }));
    await expect(answer).resolves.toBe(false);
  });

  it('keeps the confirm button locked until the required text is typed', async () => {
    render(<ConfirmDialogHost />);
    act(() => void confirm({ title: 'Стерти все', confirmLabel: 'Стерти', typeToConfirm: 'СТЕРТИ' }));
    const button = await screen.findByRole('button', { name: 'Стерти' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByRole('textbox'), 'СТЕРТИ');
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
