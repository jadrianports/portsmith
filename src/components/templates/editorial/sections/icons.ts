/**
 * Curated tech-stack brand-logo map for the Newsprint Skills section (07-UI-SPEC
 * A.7 §3 / A.1; D-09; A.8 the phase's top bundle risk). Mirrors
 * `minimal/sections/icons.ts` VERBATIM in structure (07-PATTERNS — the simple-icons
 * named-import idiom is the engine-wide bundle guarantee, not a per-template choice).
 *
 * THE ONE BUNDLE LEVER — read this before adding an icon (T-07-08):
 *   `simple-icons` ships ~3000 icons. Importing them NAMED and INDIVIDUALLY
 *   (`import { siReact } from 'simple-icons'`) lets the bundler tree-shake every
 *   icon that is NOT referenced here — only the handful below ever reach the chunk.
 *   A namespace import (star-as) of the whole package — or any whole-set / barrel /
 *   per-icon deep-glob entry point — DEFEATS tree-shaking and pulls the whole set
 *   into the bundle, blowing the <=200kb per-template budget (hard-gated in 07-06).
 *   NEVER do that. To add a logo: add ONE named import + ONE map entry — keep the
 *   set curated (<= ~15), not 40.
 *
 * SLUG SPELLINGS (the simple-icons slug, with dots → "dot"):
 *   Node.js → siNodedotjs, Next.js → siNextdotjs (NOT siNode/siNext). The map KEY is
 *   the slug stored in the section content's `skillItem.icon` field.
 *
 * SHAPE: each `simple-icons` named export is `{ title, slug, hex, path, … }`. We keep
 *   only `{ path, title }` — `path` is the 24×24 viewBox `<path d>` data the Skills
 *   BrandLogo renders inside its OWN `<svg>` (server-rendered, zero client JS —
 *   T-07-08); `title` is the accessible name (`aria-label`). `hex` is intentionally
 *   dropped: in Newsprint logos render MONOCHROME INK (`currentColor`) at rest — flat,
 *   no chroma wall (A.1 / A.7 §3) — optionally ink→accent/brand on hover via CSS.
 *
 * TAMPERING/XSS (T-07-07): every `path` below is a CONSTANT from the simple-icons
 * package — no user/seed string is ever interpolated into the SVG `d` attribute.
 */

// NAMED, individual imports ONLY — the tree-shaking guarantee (no namespace/star import).
import {
  siTypescript,
  siReact,
  siNextdotjs,
  siNodedotjs,
  siPostgresql,
  siSupabase,
  siTailwindcss,
  siVercel,
  siJavascript,
  siHtml5,
  siCss,
  siGit,
  siDocker,
  siPython,
} from 'simple-icons';

/** The minimal brand-logo shape the Skills BrandLogo consumes. */
export type BrandIcon = { path: string; title: string };

/**
 * slug → brand logo. Keys are the simple-icons slugs the seed stores in
 * `skillItem.icon`. A slug not present here simply renders no logo (the skill name
 * still shows) — graceful, no crash.
 */
export const TECH_ICONS: Record<string, BrandIcon> = {
  // —— the slugs the founder seed currently uses ——
  typescript: { path: siTypescript.path, title: siTypescript.title },
  react: { path: siReact.path, title: siReact.title },
  nextdotjs: { path: siNextdotjs.path, title: siNextdotjs.title },
  nodedotjs: { path: siNodedotjs.path, title: siNodedotjs.title },
  postgresql: { path: siPostgresql.path, title: siPostgresql.title },
  // —— curated headroom for a seed edit (still tiny, still tree-shaken) ——
  supabase: { path: siSupabase.path, title: siSupabase.title },
  tailwindcss: { path: siTailwindcss.path, title: siTailwindcss.title },
  vercel: { path: siVercel.path, title: siVercel.title },
  javascript: { path: siJavascript.path, title: siJavascript.title },
  html5: { path: siHtml5.path, title: siHtml5.title },
  css: { path: siCss.path, title: siCss.title },
  git: { path: siGit.path, title: siGit.title },
  docker: { path: siDocker.path, title: siDocker.title },
  python: { path: siPython.path, title: siPython.title },
};
