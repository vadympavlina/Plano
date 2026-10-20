// Generates every app icon from the duck artwork in assets-src/logo-duck.webp.
// Usage: npm run icons
import sharp from 'sharp';
import { writeFile, copyFile, mkdir, readFile } from 'node:fs/promises';

const SRC = 'assets-src/logo-duck.webp';
const BG = '#000000';

// Cut the duck out of its black background: alpha follows brightness.
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
for (let i = 0; i < data.length; i += 4) {
  const m = Math.max(data[i], data[i + 1], data[i + 2]);
  const a = Math.min(1, Math.max(0, (m - 24) / 150));
  data[i + 3] = Math.round(a * 255);
  if (a > 0) for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(data[i + c] / Math.max(a, 0.35)));
  if (a > 0.5) {
    const p = i / 4, x = p % info.width, y = (p - x) / info.width;
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
}
const side = Math.max(x1 - x0, y1 - y0);
const duck = await sharp(data, { raw: info })
  .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  .extend({ top: (side - (y1 - y0)) >> 1, bottom: (side - (y1 - y0) + 1) >> 1, left: (side - (x1 - x0)) >> 1, right: (side - (x1 - x0) + 1) >> 1, background: '#0000' })
  .png()
  .toBuffer();

/** Duck on a dark tile. `fill` = share of the tile the duck takes, `radius` = corner rounding (0 = full bleed). */
async function icon(size, fill, radius) {
  const d = Math.round(size * fill);
  const tile = sharp({ create: { width: size, height: size, channels: 4, background: BG } }).composite([
    { input: await sharp(duck).resize(d, d).toBuffer(), left: (size - d) >> 1, top: Math.round((size - d) / 2 + size * 0.02) },
  ]);
  if (!radius) return tile.png().toBuffer();
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="#fff"/></svg>`);
  return sharp(await tile.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const out = 'public/icons';
await writeFile(`${out}/icon-192.png`, await icon(192, 0.74, 0.22));
await writeFile(`${out}/icon-512.png`, await icon(512, 0.74, 0.22));
await writeFile(`${out}/favicon-32.png`, await icon(32, 0.82, 0.22));
// Maskable + Apple icons are full bleed: the OS applies its own mask (maskable keeps the 80% safe zone).
await writeFile(`${out}/icon-maskable-512.png`, await icon(512, 0.6, 0));
await writeFile(`${out}/apple-touch-icon.png`, await icon(180, 0.7, 0));
await copyFile(`${out}/apple-touch-icon.png`, 'public/apple-touch-icon.png');
// Transparent duck for dark UI (sidebar), and an SVG favicon wrapping the rounded tile.
await writeFile('public/logo-duck.png', await sharp(duck).resize(128, 128).png().toBuffer());
const fav = (await icon(64, 0.8, 0.22)).toString('base64');
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
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: '#0E1117' } })
    .composite([{ input: await sharp(duck).resize(d, d).toBuffer(), left: (W - d) >> 1, top: (H - d) >> 1 }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await writeFile(`public/${name}`, png);
  links.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="%BASE_URL%${name}" />`);
}
const html = await readFile('index.html', 'utf8');
await writeFile('index.html', html.replace(/ *<!-- splash:start -->[\s\S]*<!-- splash:end -->/, `    <!-- splash:start -->\n${links.join('\n')}\n    <!-- splash:end -->`));
console.log('icons written');
