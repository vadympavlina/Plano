import type { ColorKey } from '@/types';

export interface ColorTokens {
  solid: string;
  label: string;
}

export const COLORS: Record<ColorKey, ColorTokens> = {
  blue: { solid: '#4778F5', label: 'Blue' },
  green: { solid: '#35B98A', label: 'Green' },
  purple: { solid: '#9275EF', label: 'Lilac' },
  pink: { solid: '#E8628F', label: 'Pink' },
  orange: { solid: '#F0A54A', label: 'Orange' },
  teal: { solid: '#2BB3C0', label: 'Teal' },
  yellow: { solid: '#D9B42B', label: 'Yellow' },
  red: { solid: '#E5484D', label: 'Red' },
  slate: { solid: '#7B8497', label: 'Slate' },
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
