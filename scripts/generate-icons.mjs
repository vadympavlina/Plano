// Generates PWA / favicon PNG icons from the SVG sources in assets-src/.
// Usage: npm run icons
import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';

const out = 'public/icons';
await mkdir(out, { recursive: true });

const rounded = 'assets-src/icon.svg';
const fullBleed = 'assets-src/icon-fullbleed.svg';

const jobs = [
  [rounded, 'icon-192.png', 192],
  [rounded, 'icon-512.png', 512],
  [rounded, 'favicon-32.png', 32],
  // Maskable + Apple icons must be full-bleed: the OS applies its own mask.
  [fullBleed, 'icon-maskable-512.png', 512],
  [fullBleed, 'apple-touch-icon.png', 180],
];

for (const [src, name, size] of jobs) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(`${out}/${name}`);
  console.log(`✓ ${out}/${name}`);
}
await copyFile(rounded, 'public/favicon.svg');
console.log('✓ public/favicon.svg');
