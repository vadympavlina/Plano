import { describe, expect, it } from 'vitest';
import type { Goal } from '@/types';
import { expectedValue, goalPace, paceText } from './logic';

const goal = (extra: Partial<Goal>): Goal =>
  ({ id: 'g', title: 'g', targetValue: 100, currentValue: 0, status: 'active', projectIds: [], history: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '', startDate: '2026-01-01', targetDate: '2026-12-31', ...extra }) as Goal;

describe('goal pace', () => {
  it('computes the expected value on a straight line', () => {
    expect(Math.round(expectedValue(goal({}), '2026-07-02')!)).toBe(50);
    expect(expectedValue(goal({ targetDate: undefined }), '2026-07-02')).toBeUndefined();
  });

  it('describes being ahead or behind in the goal unit', () => {
    expect(paceText(goal({ currentValue: 70, unit: 'км' }), '2026-07-02')).toBe('Випереджаєте на 20 км');
    expect(paceText(goal({ currentValue: 30, unit: 'км' }), '2026-07-02')).toBe('Відстаєте на 20 км');
    expect(paceText(goal({ currentValue: 50 }), '2026-07-02')).toBe('За планом');
  });

  it('asks for a daily amount near the deadline and handles the edge states', () => {
    expect(paceText(goal({ currentValue: 70, unit: 'км' }), '2026-12-21')).toBe('Потрібно ~3 км на день');
    expect(paceText(goal({ currentValue: 100 }), '2026-07-02')).toBe('Ціль досягнуто 🎉');
    expect(goalPace(goal({ currentValue: 10 }), '2027-01-05')).toBe('overdue');
    expect(paceText(goal({ targetDate: undefined }), '2026-07-02')).toBe('Без дедлайну');
  });
});
