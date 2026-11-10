// Generates every app icon from the mascot artwork in assets-src/ (logo-duck-black.webp, logo-duck-transparent.webp).
// Usage: npm run icons
import sharp from 'sharp';
import { writeFile, copyFile, mkdir, readFile } from 'node:fs/promises';

// Two renders of the same mascot: one on solid black (app icons, launch screens) and one on a
// transparent background (the in-app logo, where the page colour shows through).
const ON_BLACK = 'assets-src/logo-duck-black.webp';
const TRANSPARENT = 'assets-src/logo-duck-transparent.webp';
const BG = '#000000';

const roundMask = (size, radius) => Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="#fff"/></svg>`);

/** The mascot filling a square tile. `fill` = share of the tile it takes, `radius` = corner rounding (0 = full bleed). */
async function icon(size, fill = 1, radius = 0, src = ON_BLACK) {
  const d = Math.round(size * fill);
  const tile = sharp({ create: { width: size, height: size, channels: 4, background: BG } }).composite([
    { input: await sharp(src).resize(d, d, { kernel: 'lanczos3' }).png().toBuffer(), left: (size - d) >> 1, top: (size - d) >> 1 },
  ]);
  if (!radius) return tile.png().toBuffer();
  return sharp(await tile.png().toBuffer()).composite([{ input: roundMask(size, radius), blend: 'dest-in' }]).png().toBuffer();
}

const out = 'public/icons';
await writeFile(`${out}/icon-192.png`, await icon(192, 1, 0.22));
await writeFile(`${out}/icon-512.png`, await icon(512, 1, 0.22));
await writeFile(`${out}/favicon-32.png`, await icon(32, 1, 0.22));
// Maskable + Apple icons are full bleed: the OS applies its own mask (maskable keeps the 80% safe zone).
await writeFile(`${out}/icon-maskable-512.png`, await icon(512, 1, 0));
await writeFile(`${out}/apple-touch-icon.png`, await icon(180, 1, 0));
await copyFile(`${out}/apple-touch-icon.png`, 'public/apple-touch-icon.png');
// The in-app logo (sidebar mark): the transparent render with softly rounded corners.
await writeFile(
  'public/logo-duck.png',
  await sharp(await sharp(TRANSPARENT).resize(256, 256, { kernel: 'lanczos3' }).png().toBuffer())
    .composite([{ input: roundMask(256, 0.22), blend: 'dest-in' }])
    .png()
    .toBuffer(),
);
const fav = (await icon(128, 1, 0.22)).toString('base64');
await writeFile('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${fav}"/></svg>\n`);

// iPhone launch screens (iOS shows a white screen without them): duck on the dark app background.
const SPLASH = [
  [440, 956, 3], [430, 932, 3], [428, 926, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3],
  [402, 874, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3], [375, 667, 2],
];
await mkdir('public/splash', { recursive: true });
const links = [];
for (const [w, h, r] of SPLASH) {
  const [W, H] = [w * r, h * r];
  const d = Math.round(W * 0.34);
  const name = `splash/${W}x${H}.png`;
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: '#0D0D0F' } })
    .composite([{ input: await icon(d, 1, 0.22), left: (W - d) >> 1, top: (H - d) >> 1 }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await writeFile(`public/${name}`, png);
  links.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="%BASE_URL%${name}" />`);
}
const html = await readFile('index.html', 'utf8');
await writeFile('index.html', html.replace(/ *<!-- splash:start -->[\s\S]*<!-- splash:end -->/, `    <!-- splash:start -->\n${links.join('\n')}\n    <!-- splash:end -->`));
console.log('icons written');
