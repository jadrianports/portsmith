/**
 * Curated tech-stack brand-logo map for the Skills section (UI-SPEC §3 / D-09;
 * RESEARCH Pattern 5 + Pitfall 3; TMPL-04 the phase's top bundle risk).
 *
 * THE ONE BUNDLE LEVER — read this before adding an icon:
 *   `simple-icons` ships ~3000 icons. Importing them NAMED and INDIVIDUALLY
 *   (`import { siReact } from 'simple-icons'`) lets the bundler tree-shake every
 *   icon that is NOT referenced here — only the handful below ever reach the
 *   chunk. A namespace import (star-as) of the whole package — or any
 *   whole-set / barrel / per-icon deep-glob entry point — DEFEATS tree-shaking
 *   and pulls the whole set into the bundle, blowing the ≤200kb budget
 *   (hard-gated in 03-09). NEVER do that. To add a logo: add ONE named import +
 *   ONE map entry — keep the set curated (≤ ~15), not 40.
 *
 * SLUG SPELLINGS (the simple-icons slug, with dots → "dot"):
 *   Node.js → siNodedotjs, Next.js → siNextdotjs (NOT siNode/siNext). The map
 *   KEY is the slug stored in the seed content's `skillItem.icon` field
 *   (`founder-content.ts`: 'typescript' | 'react' | 'nextdotjs' | 'nodedotjs' |
 *   'postgresql'). A few extra common dev logos are pre-mapped for headroom so a
 *   seed edit that adds e.g. 'supabase' renders without a code change.
 *
 * SHAPE: each `simple-icons` named export is `{ title, slug, hex, path, … }`.
 *   We keep only `{ path, title }` — `path` is the 24×24 viewBox `<path d>` data
 *   the Skills BrandLogo renders inside its OWN `<svg>` (server-rendered, zero
 *   client JS — T-03-18); `title` is the accessible name (`aria-label`). `hex`
 *   is intentionally dropped: at-rest logos are monochrome `currentColor`
 *   (UI-SPEC: neutral/cyan-tinted, NOT magenta) and several brand hexes are
 *   near-black (e.g. Next.js #000000) which would vanish on the dark canvas —
 *   monochrome-at-rest is correct, not optional. (Brand-color-on-hover, if ever
 *   wanted, would be a CSS concern, not a per-item hex shipped here.)
 *
 * TAMPERING/XSS (T-03-17): every `path` below is a CONSTANT from the simple-icons
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
 * `skillItem.icon`. A slug not present here simply renders no logo (the skill
 * name still shows) — graceful, no crash.
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
