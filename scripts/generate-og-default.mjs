/**
 * Generates `public/og-default.png` — the neutral fallback Open Graph share-card
 * image referenced by `buildPublicMetadata` (06-03 / SEO-01, D-10).
 *
 * This is a PLACEHOLDER per 06-UI-SPEC Surface 6: a 1200x630 (1.91:1) Midnight-Outrun
 * canvas at LOW intensity — a deep-midnight (#0c0b1e) field with a restrained sunset
 * horizon glow. NO branding/logo/wordmark, NO avatar, NO text. The founder may swap in
 * an art-directed asset later (tracked as a pre-public-launch item); regenerate/tweak
 * the palette here and re-run `node scripts/generate-og-default.mjs`.
 *
 * Pure Node — no Sharp, no @vercel/og, no canvas (matches the no-server-image-processing
 * constraint). Hand-encodes a truecolor (RGB) PNG: signature + IHDR + IDAT (zlib) + IEND.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 1200;
const H = 630;

// CRC32 (PNG polynomial 0xEDB88320).
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

// Midnight-Outrun palette (LOW intensity / restrained).
const TOP = [12, 11, 30]; // #0c0b1e deep midnight
const BOTTOM = [15, 12, 34]; // barely deeper toward the base
const GLOW = [46, 20, 58]; // soft magenta-purple horizon bloom (peak add)
const GLOW_CENTER = 0.8;
const GLOW_SIGMA = 0.085;
const LINE = [72, 34, 56]; // thin warmer sunset line just below the bloom
const LINE_CENTER = 0.815;
const LINE_SIGMA = 0.012;

const rowBytes = W * 3 + 1; // +1 filter byte per scanline
const raw = Buffer.alloc(rowBytes * H);
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  let r = TOP[0] + (BOTTOM[0] - TOP[0]) * t;
  let g = TOP[1] + (BOTTOM[1] - TOP[1]) * t;
  let b = TOP[2] + (BOTTOM[2] - TOP[2]) * t;
  const gw = Math.exp(-((t - GLOW_CENTER) ** 2) / (2 * GLOW_SIGMA * GLOW_SIGMA));
  r += GLOW[0] * gw;
  g += GLOW[1] * gw;
  b += GLOW[2] * gw;
  const lw = Math.exp(-((t - LINE_CENTER) ** 2) / (2 * LINE_SIGMA * LINE_SIGMA));
  r += LINE[0] * lw;
  g += LINE[1] * lw;
  b += LINE[2] * lw;
  const R = clamp(r);
  const G = clamp(g);
  const B = clamp(b);
  const rowStart = y * rowBytes;
  raw[rowStart] = 0; // filter type: none
  for (let x = 0; x < W; x++) {
    const o = rowStart + 1 + x * 3;
    raw[o] = R;
    raw[o + 1] = G;
    raw[o + 2] = B;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type 2 = truecolor RGB
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync('public', { recursive: true });
writeFileSync('public/og-default.png', png);
console.log(`wrote public/og-default.png — ${W}x${H}, ${png.length} bytes`);
