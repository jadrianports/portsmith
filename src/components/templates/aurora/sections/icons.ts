/**
 * Curated brand-logo map for the aurora Skills section (11-04 Wave-C). Mirrors
 * `minimal/sections/icons.ts` + `editorial/sections/icons.ts` VERBATIM in structure —
 * the simple-icons NAMED-import idiom is the engine-wide bundle guarantee, not a
 * per-template choice.
 *
 * THE ONE BUNDLE LEVER (T-07-08): `simple-icons` ships ~3000 icons. Importing them NAMED
 * and INDIVIDUALLY lets the bundler tree-shake every icon NOT referenced here. A
 * namespace / barrel / whole-set import DEFEATS tree-shaking and blows the ≤200kb
 * per-template budget (hard-gated). To add a logo: ONE named import + ONE map entry.
 *
 * MARKETER FLAVOR: the curated set leans to the tools a marketer/creative cites
 * (analytics, social, design, ad platforms) PLUS the dev slugs the golden fixture uses
 * (so the conformance render finds its logos). A slug not present here simply renders no
 * logo (the skill name still shows) — graceful, no crash.
 *
 * SHAPE: each `simple-icons` named export is `{ title, slug, hex, path, … }`. We keep
 * only `{ path, title }` — `path` is the 24×24 viewBox `<path d>` data the BrandLogo
 * renders inside its OWN `<svg>` (server-rendered, zero client JS); `title` is the
 * accessible name. `hex` is dropped: logos render MONOCHROME (`currentColor`).
 *
 * TAMPERING/XSS (T-07-07): every `path` is a CONSTANT from the simple-icons package — no
 * user/seed string is ever interpolated into the SVG `d` attribute.
 */

// NAMED, individual imports ONLY — the tree-shaking guarantee (no namespace/star import).
import {
  siGoogleanalytics,
  siGoogleads,
  siMeta,
  siInstagram,
  siFacebook,
  siTiktok,
  siHubspot,
  siMailchimp,
  siSemrush,
  siFigma,
  siShopify,
  siWordpress,
  siNotion,
  siTypescript,
  siReact,
  siNextdotjs,
  siNodedotjs,
  siPostgresql,
  siTailwindcss,
  siDocker,
} from 'simple-icons';

/** The minimal brand-logo shape the Skills BrandLogo consumes. */
export type BrandIcon = { path: string; title: string };

/**
 * slug → brand logo. Keys are the simple-icons slugs the seed stores in `skillItem.icon`.
 * A slug not present here simply renders no logo (the skill name still shows).
 */
export const TECH_ICONS: Record<string, BrandIcon> = {
  // —— marketer / creative tooling ——
  googleanalytics: { path: siGoogleanalytics.path, title: siGoogleanalytics.title },
  googleads: { path: siGoogleads.path, title: siGoogleads.title },
  meta: { path: siMeta.path, title: siMeta.title },
  instagram: { path: siInstagram.path, title: siInstagram.title },
  facebook: { path: siFacebook.path, title: siFacebook.title },
  tiktok: { path: siTiktok.path, title: siTiktok.title },
  hubspot: { path: siHubspot.path, title: siHubspot.title },
  mailchimp: { path: siMailchimp.path, title: siMailchimp.title },
  semrush: { path: siSemrush.path, title: siSemrush.title },
  figma: { path: siFigma.path, title: siFigma.title },
  shopify: { path: siShopify.path, title: siShopify.title },
  wordpress: { path: siWordpress.path, title: siWordpress.title },
  notion: { path: siNotion.path, title: siNotion.title },
  // —— dev slugs the golden fixture uses (so the conformance render finds its logos) ——
  typescript: { path: siTypescript.path, title: siTypescript.title },
  react: { path: siReact.path, title: siReact.title },
  nextdotjs: { path: siNextdotjs.path, title: siNextdotjs.title },
  nodedotjs: { path: siNodedotjs.path, title: siNodedotjs.title },
  postgresql: { path: siPostgresql.path, title: siPostgresql.title },
  tailwindcss: { path: siTailwindcss.path, title: siTailwindcss.title },
  docker: { path: siDocker.path, title: siDocker.title },
};
