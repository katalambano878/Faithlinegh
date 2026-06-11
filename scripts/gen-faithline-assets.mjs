/**
 * Generate the full brand asset set from the FAITHLINE wordmark logo.
 *
 * The source (brand/logo-source.png) is an opaque, wide black wordmark on a
 * light background. This script:
 *   - keys out the light background to produce a clean transparent logo,
 *   - emits a black variant (for light backgrounds: header, auth, admin),
 *   - emits a white variant (for dark backgrounds: footer, PWA splash),
 *   - crops the cross emblem for square favicons / PWA icons so they stay
 *     legible at small sizes,
 *   - builds 1200x630 OG / Twitter share cards on the brand cream.
 *
 * Usage: node scripts/gen-faithline-assets.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = process.env.BRAND_LOGO_SRC || 'brand/logo-source.png';
const PUB = 'public';
const ICONS = path.join(PUB, 'icons');
fs.mkdirSync(ICONS, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CREAM = { r: 250, g: 243, b: 238, alpha: 1 }; // #FAF3EE

if (!fs.existsSync(SRC)) {
  console.error('Source image not found:', SRC);
  process.exit(1);
}

/**
 * Read the source and build two trimmed, transparent RGBA sharp pipelines:
 * one black (logo color preserved as black) and one white. Background light
 * pixels are mapped to transparent via a luminance ramp for clean edges.
 */
async function buildVariants() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const black = Buffer.alloc(width * height * 4);
  const white = Buffer.alloc(width * height * 4);
  const HI = 235; // >= this luminance -> fully transparent (background)
  const LO = 60;  //  <= this luminance -> fully opaque (logo ink)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let a;
    if (lum >= HI) a = 0;
    else if (lum <= LO) a = 255;
    else a = Math.round((255 * (HI - lum)) / (HI - LO));
    const o = i * 4;
    black[o] = 0; black[o + 1] = 0; black[o + 2] = 0; black[o + 3] = a;
    white[o] = 255; white[o + 1] = 255; white[o + 2] = 255; white[o + 3] = a;
  }
  const raw = { raw: { width, height, channels: 4 } };
  // Trim transparent margins so layouts control spacing, not the asset.
  const blackTrimmed = await sharp(black, raw).trim().png().toBuffer();
  const whiteTrimmed = await sharp(white, raw).trim().png().toBuffer();
  return { blackTrimmed, whiteTrimmed };
}

/**
 * The cross emblem is the left-most glyph of the wordmark. Detect its right
 * edge by finding the first wide run of fully-transparent columns (the gap
 * before the "F"), then return just the emblem cropped tight.
 */
async function emblem(trimmedBuf) {
  const { data, info } = await sharp(trimmedBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const colInk = new Array(width).fill(false);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] > 30) { colInk[x] = true; break; }
    }
  }
  const GAP = Math.max(6, Math.round(height * 0.06)); // separator width before "F"
  let right = width;
  let seenInk = false;
  for (let x = 0; x < width; x++) {
    if (colInk[x]) { seenInk = true; continue; }
    if (!seenInk) continue;
    let empty = 0;
    while (x + empty < width && !colInk[x + empty]) empty++;
    if (empty >= GAP) { right = x; break; }
    x += empty - 1;
  }
  return sharp(trimmedBuf).extract({ left: 0, top: 0, width: right, height }).trim().png().toBuffer();
}

/** Resize a transparent logo buffer to a target width, keep aspect, save. */
async function saveLogo(buf, file, width) {
  const meta = await sharp(buf).metadata();
  const height = Math.round(width * (meta.height / meta.width));
  await sharp(buf).resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(file);
  console.log('  ✓', file);
}

/** Square icon: logo art centered on a solid background with safe padding. */
async function squareIcon(art, size, file, { padRatio = 0.12, bg = WHITE } = {}) {
  const inner = Math.max(1, Math.round(size * (1 - padRatio * 2)));
  const logo = await sharp(art).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(logo).metadata();
  const top = Math.round((size - m.height) / 2);
  const left = Math.round((size - m.width) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, top, left }])
    .png()
    .toFile(file);
  console.log('  ✓', file);
}

/** 1200x630 share card: full wordmark centered on cream. */
async function shareCard(art, file) {
  const W = 1200, H = 630;
  const logo = await sharp(art).resize(900, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(logo).metadata();
  await sharp({ create: { width: W, height: H, channels: 4, background: CREAM } })
    .composite([{ input: logo, top: Math.round((H - m.height) / 2), left: Math.round((W - m.width) / 2) }])
    .png()
    .toFile(file);
  console.log('  ✓', file);
}

/** Minimal multi-frame ICO (PNG frames) from the emblem on white. */
async function favicon(art, file, sizes = [16, 32, 48]) {
  const pngs = [];
  for (const s of sizes) {
    const inner = Math.round(s * 0.92);
    const logo = await sharp(art).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const m = await sharp(logo).metadata();
    const buf = await sharp({ create: { width: s, height: s, channels: 4, background: WHITE } })
      .composite([{ input: logo, top: Math.round((s - m.height) / 2), left: Math.round((s - m.width) / 2) }])
      .png()
      .toBuffer();
    pngs.push({ size: s, buf });
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  fs.writeFileSync(file, Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]));
  console.log('  ✓', file);
}

async function main() {
  const { blackTrimmed, whiteTrimmed } = await buildVariants();
  const blackMeta = await sharp(blackTrimmed).metadata();
  console.log(`Trimmed wordmark: ${blackMeta.width}x${blackMeta.height}`);
  const emblemBlack = await emblem(blackTrimmed);

  console.log('Logos:');
  await saveLogo(blackTrimmed, path.join(PUB, 'logo.png'), 640);
  await saveLogo(whiteTrimmed, path.join(PUB, 'logo-white.png'), 640);

  console.log('Favicons:');
  await favicon(emblemBlack, path.join(PUB, 'favicon.ico'));
  await squareIcon(emblemBlack, 64, path.join(PUB, 'favicon.png'), { padRatio: 0.08 });
  await squareIcon(emblemBlack, 180, path.join(PUB, 'apple-touch-icon.png'), { padRatio: 0.14 });

  console.log('PWA icons:');
  for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) {
    await squareIcon(emblemBlack, s, path.join(ICONS, `icon-${s}x${s}.png`), { padRatio: 0.12 });
  }
  for (const s of [192, 512]) {
    await squareIcon(emblemBlack, s, path.join(ICONS, `icon-maskable-${s}x${s}.png`), { padRatio: 0.22 });
  }

  console.log('Share cards:');
  await shareCard(blackTrimmed, path.join(PUB, 'og-image.png'));
  await shareCard(blackTrimmed, path.join(PUB, 'twitter-image.png'));

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
