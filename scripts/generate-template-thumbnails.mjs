/**
 * Generates the template-picker thumbnail PLACEHOLDERS
 * (`public/templates/minimal.webp` + `public/templates/editorial.webp`) referenced by
 * `TemplateCard` (07-05 / UI-SPEC B.5 #2, D-P7-07).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ REPLACE: these are neutral, on-brand PLACEHOLDERS — NOT real per-template     │
 * │ screenshots. They ship at the CORRECT 16:10 box + alt (zero CLS) so the cards │
 * │ render now, while the real founder-captured screenshots are a tracked         │
 * │ pre-public item (mirrors the 06-03 og-default.png precedent + its             │
 * │ `.planning/todos/pending/...` follow-up). To recapture: render each template  │
 * │ with representative content, screenshot at 16:10 (~1280×800), compress to     │
 * │ WebP, and overwrite these two files. The box/alt/aspect stay correct          │
 * │ regardless of the asset (TemplateCard owns them).                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Each placeholder is an on-brand vertical wash that hints the template's look WITHOUT
 * branding/text/avatars (Surface-B asset contract):
 *   - minimal  → dark synthwave (Midnight-Outrun: deep-midnight field + a restrained
 *                sunset-horizon glow), the same palette family as og-default.png.
 *   - editorial→ light "Newsprint" (warm ivory paper canvas + a faint ink masthead
 *                rule and a muted column band), the editorial/Swiss counterweight.
 *
 * Uses `sharp` (already installed, pulled transitively by Next image optimization) to
 * encode WebP from a raw RGB buffer — no @vercel/og, no canvas, no Three.js. Re-run:
 *   node scripts/generate-template-thumbnails.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 1280; // 16:10 source — TemplateCard reserves the box at aspect-[16/10].
const H = 800;

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const gauss = (t, c, s) => Math.exp(-((t - c) ** 2) / (2 * s * s));

/**
 * Render a placeholder to a raw RGB buffer via a per-row painter `(t) => [r,g,b]`
 * where `t` is the vertical position 0..1.
 */
function paint(rowColor) {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const [r, g, b] = rowColor(y / (H - 1));
    const R = clamp(r);
    const G = clamp(g);
    const B = clamp(b);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      buf[o] = R;
      buf[o + 1] = G;
      buf[o + 2] = B;
    }
  }
  return buf;
}

// ── MINIMAL — dark synthwave (Midnight-Outrun, mirrors og-default's palette) ──
const MIN_TOP = [12, 11, 30]; // #0c0b1e deep midnight
const MIN_BOTTOM = [18, 14, 40]; // slightly deeper/warmer toward the base
const MIN_GLOW = [120, 38, 96]; // magenta-purple horizon bloom (peak add)
const MIN_GLOW_C = 0.78;
const MIN_GLOW_S = 0.1;
const MIN_LINE = [180, 70, 120]; // a warmer sunset line just below the bloom
const MIN_LINE_C = 0.8;
const MIN_LINE_S = 0.014;
const minimal = paint((t) => {
  let r = MIN_TOP[0] + (MIN_BOTTOM[0] - MIN_TOP[0]) * t;
  let g = MIN_TOP[1] + (MIN_BOTTOM[1] - MIN_TOP[1]) * t;
  let b = MIN_TOP[2] + (MIN_BOTTOM[2] - MIN_TOP[2]) * t;
  const gw = gauss(t, MIN_GLOW_C, MIN_GLOW_S);
  r += MIN_GLOW[0] * gw;
  g += MIN_GLOW[1] * gw;
  b += MIN_GLOW[2] * gw;
  const lw = gauss(t, MIN_LINE_C, MIN_LINE_S);
  r += MIN_LINE[0] * lw;
  g += MIN_LINE[1] * lw;
  b += MIN_LINE[2] * lw;
  return [r, g, b];
});

// ── EDITORIAL — light "Newsprint" (ivory paper + a faint ink masthead rule) ──
const ED_PAPER = [247, 244, 236]; // #F7F4EC warm ivory canvas (the Newsprint paper)
const ED_MUTED = [239, 234, 221]; // #EFEADD muted inset band (a hinted column)
const ED_INK = [26, 25, 22]; // #1A1916 near-black ink (the masthead rule)
const ED_RULE_C = 0.3; // a single hairline masthead rule ~⅓ down
const ED_RULE_S = 0.006;
const ED_BAND_C = 0.62; // a faint muted column band lower in the frame
const ED_BAND_S = 0.16;
const editorial = paint((t) => {
  // Start from the ivory paper, dip slightly toward the muted inset in a lower band,
  // and lay one near-ink hairline rule near the top (the broadsheet masthead).
  const band = gauss(t, ED_BAND_C, ED_BAND_S) * 0.6; // 0..0.6 toward muted
  let r = ED_PAPER[0] + (ED_MUTED[0] - ED_PAPER[0]) * band;
  let g = ED_PAPER[1] + (ED_MUTED[1] - ED_PAPER[1]) * band;
  let b = ED_PAPER[2] + (ED_MUTED[2] - ED_PAPER[2]) * band;
  const rule = gauss(t, ED_RULE_C, ED_RULE_S); // 0..1 toward ink at the rule
  r += (ED_INK[0] - r) * rule;
  g += (ED_INK[1] - g) * rule;
  b += (ED_INK[2] - b) * rule;
  return [r, g, b];
});

mkdirSync('public/templates', { recursive: true });

for (const [slug, raw] of [
  ['minimal', minimal],
  ['editorial', editorial],
]) {
  const webp = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 80 })
    .toBuffer();
  const path = `public/templates/${slug}.webp`;
  writeFileSync(path, webp);
  console.log(`wrote ${path} — ${W}x${H} (16:10), ${webp.length} bytes [REPLACE: placeholder]`);
}
