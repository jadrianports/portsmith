/**
 * One-shot generator for e2e/fixtures/orientation-6.jpg (34-02, MEDIA-02).
 *
 * Produces a small REAL, decodable BASELINE JPEG whose ENCODED pixels are LANDSCAPE
 * (width > height) but whose EXIF Orientation tag is 6 (rotate 90° CW for display) —
 * so the DISPLAY orientation is PORTRAIT (height > width). A naive <img>-to-canvas /
 * raw createImageBitmap draw would store it sideways (landscape); the GalleryUploader's
 * EXIF-baking downscale must store it portrait. The e2e asserts the emitted dims have
 * height > width, proving the rotation was baked.
 *
 * Self-contained baseline (Huffman, 4:4:4-ish single-component is insufficient for a
 * color decode contract, so we encode full YCbCr) JPEG encoder — no dependency. Based
 * on the public-domain Jon Olick / Google jslib baseline encoder pattern.
 *
 * Run: node scripts/gen-orientation-fixture.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── Standard JPEG tables (Annex K) ───────────────────────────────────────────
const ZIGZAG = [
  0, 1, 5, 6, 14, 15, 27, 28, 2, 4, 7, 13, 16, 26, 29, 42, 3, 8, 12, 17, 25, 30, 41,
  43, 9, 11, 18, 24, 31, 40, 44, 53, 10, 19, 23, 32, 39, 45, 52, 54, 20, 22, 33, 38,
  46, 51, 55, 60, 21, 34, 37, 47, 50, 56, 59, 61, 35, 36, 48, 49, 57, 58, 62, 63,
];
const STD_LUM_QT = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40,
  57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24,
  35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98,
  112, 100, 103, 99,
];
const STD_CHR_QT = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99,
  99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99,
];
// DC/AC Huffman bit/value tables (Annex K).
const DC_LUM_BITS = [0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUM_VAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUM_BITS = [0, 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUM_VAL = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51,
  0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1,
  0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18,
  0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
  0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57,
  0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92,
  0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
  0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
  0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8,
  0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2,
  0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];
const DC_CHR_BITS = [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHR_VAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_CHR_BITS = [0, 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHR_VAL = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07,
  0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09,
  0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25,
  0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38,
  0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56,
  0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74,
  0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
  0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba,
  0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6,
  0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2,
  0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];

// ── Build Huffman code tables (size, code) from the bits/values arrays ────────
function buildHuff(bits, values) {
  const codes = [];
  let code = 0;
  let k = 0;
  for (let i = 1; i <= 16; i++) {
    for (let j = 0; j < bits[i]; j++) {
      codes[values[k]] = { code, size: i };
      code++;
      k++;
    }
    code <<= 1;
  }
  return codes;
}
const DC_LUM = buildHuff(DC_LUM_BITS, DC_LUM_VAL);
const AC_LUM = buildHuff(AC_LUM_BITS, AC_LUM_VAL);
const DC_CHR = buildHuff(DC_CHR_BITS, DC_CHR_VAL);
const AC_CHR = buildHuff(AC_CHR_BITS, AC_CHR_VAL);

// ── Bit writer ────────────────────────────────────────────────────────────────
class Writer {
  constructor() {
    this.bytes = [];
    this.acc = 0;
    this.nbits = 0;
  }
  byte(b) {
    this.bytes.push(b & 0xff);
  }
  word(w) {
    this.byte(w >> 8);
    this.byte(w & 0xff);
  }
  bits(code, size) {
    this.acc = (this.acc << size) | (code & ((1 << size) - 1));
    this.nbits += size;
    while (this.nbits >= 8) {
      this.nbits -= 8;
      const b = (this.acc >> this.nbits) & 0xff;
      this.byte(b);
      if (b === 0xff) this.byte(0x00); // byte-stuffing
    }
  }
  flush() {
    if (this.nbits > 0) {
      const b = (this.acc << (8 - this.nbits)) & 0xff;
      // pad with 1s
      const padded = b | ((1 << (8 - this.nbits)) - 1);
      this.byte(padded);
      if (padded === 0xff) this.byte(0x00);
      this.nbits = 0;
      this.acc = 0;
    }
  }
}

// ── DCT (forward) — straightforward float DCT (small image, perf irrelevant) ──
function fdct(block) {
  const out = new Array(64).fill(0);
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          sum +=
            block[x * 8 + y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / 16) *
            Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      const cu = u === 0 ? 1 / Math.SQRT2 : 1;
      const cv = v === 0 ? 1 / Math.SQRT2 : 1;
      out[u * 8 + v] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

function bitCount(v) {
  let n = 0;
  let a = Math.abs(v);
  while (a) {
    a >>= 1;
    n++;
  }
  return n;
}

function encodeBlock(w, block, qt, dcTab, acTab, prevDC) {
  const dct = fdct(block);
  const q = new Array(64);
  for (let i = 0; i < 64; i++) {
    q[ZIGZAG[i]] = Math.round(dct[i] / qt[i]);
  }
  // Reorder into zigzag sequence for entropy coding.
  const zz = new Array(64);
  for (let i = 0; i < 64; i++) zz[i] = q[ZIGZAG[i]];
  // DC
  const diff = zz[0] - prevDC;
  const dcBits = bitCount(diff);
  w.bits(dcTab[dcBits].code, dcTab[dcBits].size);
  if (dcBits) {
    const dcVal = diff < 0 ? diff - 1 + (1 << dcBits) : diff;
    w.bits(dcVal, dcBits);
  }
  // AC
  let run = 0;
  for (let i = 1; i < 64; i++) {
    if (zz[i] === 0) {
      run++;
    } else {
      while (run > 15) {
        w.bits(acTab[0xf0].code, acTab[0xf0].size);
        run -= 16;
      }
      const sz = bitCount(zz[i]);
      const sym = (run << 4) | sz;
      w.bits(acTab[sym].code, acTab[sym].size);
      const val = zz[i] < 0 ? zz[i] - 1 + (1 << sz) : zz[i];
      w.bits(val, sz);
      run = 0;
    }
  }
  if (run > 0) w.bits(acTab[0x00].code, acTab[0x00].size); // EOB
  return zz[0];
}

// ── Encode an RGB image (Uint8 [r,g,b] per px) to a baseline JPEG (4:4:4) ──────
function encodeJpeg(rgb, width, height, quality = 90) {
  // Scale quant tables by quality.
  const scale = quality < 50 ? 5000 / quality : 200 - quality * 2;
  const scaleQt = (t) =>
    t.map((v) => Math.min(255, Math.max(1, Math.floor((v * scale + 50) / 100))));
  const lumQt = scaleQt(STD_LUM_QT);
  const chrQt = scaleQt(STD_CHR_QT);

  const w = new Writer();
  w.word(0xffd8); // SOI
  // APP0 JFIF
  w.word(0xffe0);
  w.word(16);
  [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0].forEach((b) => w.byte(b));
  // DQT lum
  w.word(0xffdb);
  w.word(67);
  w.byte(0);
  lumQt.forEach((v) => w.byte(v));
  // DQT chr
  w.word(0xffdb);
  w.word(67);
  w.byte(1);
  chrQt.forEach((v) => w.byte(v));
  // SOF0
  w.word(0xffc0);
  w.word(17);
  w.byte(8);
  w.word(height);
  w.word(width);
  w.byte(3);
  w.byte(1); w.byte(0x11); w.byte(0); // Y
  w.byte(2); w.byte(0x11); w.byte(1); // Cb
  w.byte(3); w.byte(0x11); w.byte(1); // Cr
  // DHT (4 tables)
  const dht = (cls, id, bits, vals) => {
    w.word(0xffc4);
    w.word(19 + vals.length);
    w.byte((cls << 4) | id);
    for (let i = 1; i <= 16; i++) w.byte(bits[i]);
    vals.forEach((v) => w.byte(v));
  };
  dht(0, 0, DC_LUM_BITS, DC_LUM_VAL);
  dht(1, 0, AC_LUM_BITS, AC_LUM_VAL);
  dht(0, 1, DC_CHR_BITS, DC_CHR_VAL);
  dht(1, 1, AC_CHR_BITS, AC_CHR_VAL);
  // SOS
  w.word(0xffda);
  w.word(12);
  w.byte(3);
  w.byte(1); w.byte(0x00);
  w.byte(2); w.byte(0x11);
  w.byte(3); w.byte(0x11);
  w.byte(0); w.byte(63); w.byte(0);

  // Encode MCUs (8x8, 4:4:4). Pad edges by clamping.
  let dcY = 0, dcCb = 0, dcCr = 0;
  for (let my = 0; my < height; my += 8) {
    for (let mx = 0; mx < width; mx += 8) {
      const Y = new Array(64), Cb = new Array(64), Cr = new Array(64);
      for (let by = 0; by < 8; by++) {
        for (let bx = 0; bx < 8; bx++) {
          const px = Math.min(width - 1, mx + bx);
          const py = Math.min(height - 1, my + by);
          const o = (py * width + px) * 3;
          const r = rgb[o], g = rgb[o + 1], b = rgb[o + 2];
          Y[by * 8 + bx] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
          Cb[by * 8 + bx] = -0.168736 * r - 0.331264 * g + 0.5 * b;
          Cr[by * 8 + bx] = 0.5 * r - 0.418688 * g - 0.081312 * b;
        }
      }
      dcY = encodeBlock(w, Y, lumQt, DC_LUM, AC_LUM, dcY);
      dcCb = encodeBlock(w, Cb, chrQt, DC_CHR, AC_CHR, dcCb);
      dcCr = encodeBlock(w, Cr, chrQt, DC_CHR, AC_CHR, dcCr);
    }
  }
  w.flush();
  w.word(0xffd9); // EOI
  return Buffer.from(w.bytes);
}

// ── Build the EXIF APP1 segment with Orientation = 6 ──────────────────────────
function buildExifApp1Orientation(orientation) {
  // TIFF header (big-endian "MM") + 0th IFD with one entry (Orientation, SHORT, =orientation).
  const tiff = [];
  const push16 = (v) => { tiff.push((v >> 8) & 0xff, v & 0xff); };
  const push32 = (v) => { tiff.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); };
  push16(0x4d4d); // big-endian
  push16(0x002a); // TIFF magic
  push32(0x00000008); // IFD0 offset (right after the 8-byte header)
  push16(1); // 1 entry
  push16(0x0112); // tag: Orientation
  push16(3); // type: SHORT
  push32(1); // count
  push16(orientation); push16(0); // value (SHORT in first 2 bytes of the 4-byte field)
  push32(0); // next IFD offset = 0
  const exifBody = Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    Buffer.from(tiff),
  ]);
  const len = exifBody.length + 2; // +2 for the length field itself
  return Buffer.concat([
    Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff]),
    exifBody,
  ]);
}

// Insert the APP1 right after SOI (the first 2 bytes).
function withExif(jpeg, app1) {
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

// ── Generate a LANDSCAPE gradient image (width > height), then mark Orientation 6 ─
const WIDTH = 160; // raw landscape
const HEIGHT = 96;
const rgb = new Uint8Array(WIDTH * HEIGHT * 3);
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const o = (y * WIDTH + x) * 3;
    // A diagonal gradient so the image is visibly non-uniform (real decode contract).
    rgb[o] = Math.floor((x / WIDTH) * 255); // R varies with x
    rgb[o + 1] = Math.floor((y / HEIGHT) * 255); // G varies with y
    rgb[o + 2] = 128;
  }
}
const baseJpeg = encodeJpeg(rgb, WIDTH, HEIGHT, 90);
const app1 = buildExifApp1Orientation(6); // 6 = rotate 90° CW → display PORTRAIT
const final = withExif(baseJpeg, app1);

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'e2e', 'fixtures', 'orientation-6.jpg');
writeFileSync(out, final);
console.log(
  `Wrote ${out} (${final.length} bytes) — raw ${WIDTH}x${HEIGHT} landscape, EXIF Orientation=6 → displays ${HEIGHT}x${WIDTH} portrait.`,
);
