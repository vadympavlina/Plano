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

/**
 * Share of the colour kept when it is used as TEXT on its own 12% tint: the rest is the page's ink,
 * so the label stays readable (4.5:1) in both themes. Worked out per colour.
 */
const INK_SHARE: Record<string, number> = {
  '#4778F5': 65,
  '#35B98A': 45,
  '#9275EF': 60,
  '#E8628F': 55,
  '#F0A54A': 40,
  '#2BB3C0': 50,
  '#D9B42B': 40,
  '#E5484D': 65,
  '#7B8497': 65,
};

/** The colour as readable text on a tint of itself; use for labels and chips, not for dots or icons. */
export function inkOf(hex: string): string {
  const share = INK_SHARE[hex.toUpperCase()] ?? 60;
  return `color-mix(in srgb, ${hex} ${share}%, rgb(var(--ink)))`;
}

/** Black or white, whichever reads better on a solid fill of this colour (check marks, counters). */
export function onColor(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast of white vs near-black on this fill; take the better one.
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0105 ? '#ffffff' : '#161618';
}

export function colorOf(key: ColorKey | undefined): string {
  return COLORS[key ?? 'slate']?.solid ?? COLORS.slate.solid;
}

/** Hex → rgba with alpha, for soft tinted backgrounds. */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Opaque pastel: `hex` mixed into the surface colour, so grid lines and overlaps don't show through. */
export function solidTint(hex: string, amount: number): string {
  return `color-mix(in srgb, ${hex} calc(${Math.round(amount * 100)}% * var(--tint-k, 1)), rgb(var(--surface)))`;
}
