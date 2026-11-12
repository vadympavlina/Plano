// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, Stepper, Switch } from '@/components/ui/controls';

afterEach(cleanup);

describe('Switch', () => {
  it('is announced as a switch and flips on click', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} label="Сповіщення" />);
    const sw = screen.getByRole('switch', { name: 'Сповіщення' });
    expect(sw).toHaveProperty('ariaChecked', 'false');
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does nothing while disabled', async () => {
    const onChange = vi.fn();
    render(<Switch checked disabled onCheckedChange={onChange} label="Звук" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Звук' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Checkbox', () => {
  it('can be named by its visible text and toggles from the text too', async () => {
    const onChange = vi.fn();
    render(
      <Checkbox checked={false} onChange={onChange}>
        Запам'ятати мене
      </Checkbox>,
    );
    await userEvent.click(screen.getByText("Запам'ятати мене"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });
});

describe('Stepper', () => {
  it('steps by one and stays inside its limits', async () => {
    const onChange = vi.fn();
    render(<Stepper value={5} min={5} max={6} onChange={onChange} aria-label="Хвилин" />);
    await userEvent.click(screen.getByRole('button', { name: 'Збільшити' }));
    expect(onChange).toHaveBeenLastCalledWith(6);
    // At the minimum the «−» button is off.
    expect((screen.getByRole('button', { name: 'Зменшити' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
