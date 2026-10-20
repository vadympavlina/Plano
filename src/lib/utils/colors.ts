import type { ColorKey } from '@/types';

export interface ColorTokens {
  solid: string;
  label: string;
}

export const COLORS: Record<ColorKey, ColorTokens> = {
  blue: { solid: '#4778F5', label: 'Синій' },
  green: { solid: '#35B98A', label: 'Зелений' },
  purple: { solid: '#9275EF', label: 'Бузковий' },
  pink: { solid: '#E8628F', label: 'Рожевий' },
  orange: { solid: '#F0A54A', label: 'Помаранчевий' },
  teal: { solid: '#2BB3C0', label: 'Бірюзовий' },
  yellow: { solid: '#D9B42B', label: 'Жовтий' },
  red: { solid: '#E5484D', label: 'Червоний' },
  slate: { solid: '#7B8497', label: 'Сірий' },
};

export function colorOf(key: ColorKey | undefined): string {
  return COLORS[key ?? 'slate']?.solid ?? COLORS.slate.solid;
}

/** Hex → rgba with alpha, for soft tinted backgrounds. */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Opaque pastel: `hex` mixed into the surface colour, so grid lines and overlaps don't show through. */
export function solidTint(hex: string, amount: number): string {
  return `color-mix(in srgb, ${hex} calc(${Math.round(amount * 100)}% * var(--tint-k, 1)), rgb(var(--surface)))`;
}
