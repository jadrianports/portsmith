/**
 * Curated tech-stack brand-logo map for the edgerunner Skills section (PIPE-09 / D-09;
 * TMPL-04 the phase's top bundle risk). Translated from the export's
 * `src/data/tools.ts`, which imported `react-icons/si` — react-icons is NOT on the D-15
 * allowlist (T-13-04-ORIGIN), so the brand logos are re-authored against the in-repo
 * `simple-icons` `.path` server-render pattern (the same idiom as `minimal/sections/
 * icons.ts`), which ships ZERO client JS.
 *
 * THE ONE BUNDLE LEVER — read this before adding an icon:
 *   `simple-icons` ships ~3000 icons. Importing them NAMED and INDIVIDUALLY
 *   (`import { siReact } from 'simple-icons'`) lets the bundler tree-shake every icon
 *   that is NOT referenced here — only the handful below ever reach the chunk. A
 *   namespace import (star-as) of the whole package — or any whole-set / barrel / deep-
 *   glob entry point — DEFEATS tree-shaking and pulls the whole set in, blowing the
 *   ≤200kb budget. NEVER do that. To add a logo: add ONE named import + ONE map entry —
 *   keep the set curated (≤ ~15), not 40.
 *
 * SLUG SPELLINGS (the simple-icons slug, with dots → "dot"): Node.js → siNodedotjs,
 * Next.js → siNextdotjs. The map KEY is the slug stored in the seed content's
 * `skillItem.icon` field. The set below covers the founder's tool stack
 * (`founder-content` Tools) plus common dev headroom; a slug not present simply renders
 * no logo (the skill name + bar still render) — graceful, no crash.
 *
 * SHAPE: each `simple-icons` named export is `{ title, slug, hex, path, … }`. We keep
 * only `{ path, title }` — `path` is the 24×24 viewBox `<path d>` the BrandLogo renders
 * inside its OWN `<svg>` (server-rendered, zero client JS); `title` is the accessible
 * name (`aria-label`). `hex` is intentionally dropped: at-rest logos are monochrome
 * `currentColor` (neon-cyan-tinted on the dark canvas), and several brand hexes are
 * near-black which would vanish on the dark canvas.
 *
 * TAMPERING/XSS (T-13-04-XSS): every `path` below is a CONSTANT from the simple-icons
 * package — no user/seed string is ever interpolated into the SVG `d` attribute.
 */

// NAMED, individual imports ONLY — the tree-shaking guarantee (no namespace/star import).
import {
  siReact,
  siTypescript,
  siNextdotjs,
  siTailwindcss,
  siVite,
  siFramer,
  siNodedotjs,
  siBun,
  siPython,
  siGo,
  siGraphql,
  siPostgresql,
  siMongodb,
  siRedis,
  siSupabase,
  siPrisma,
  siDocker,
  siKubernetes,
  siVercel,
  siCloudflare,
  siGithubactions,
  siFigma,
  siSketch,
  siBlender,
} from 'simple-icons';

/** The minimal brand-logo shape the Skills BrandLogo consumes. */
export type BrandIcon = { path: string; title: string };

/**
 * slug → brand logo. Keys are the simple-icons slugs the seed stores in
 * `skillItem.icon`. A slug not present here simply renders no logo (the skill name +
 * bar still show) — graceful, no crash. Curated ≤15 (the founder's Tools stack).
 */
export const TECH_ICONS: Record<string, BrandIcon> = {
  // —— Frontend ——
  react: { path: siReact.path, title: siReact.title },
  typescript: { path: siTypescript.path, title: siTypescript.title },
  nextdotjs: { path: siNextdotjs.path, title: siNextdotjs.title },
  tailwindcss: { path: siTailwindcss.path, title: siTailwindcss.title },
  vite: { path: siVite.path, title: siVite.title },
  framer: { path: siFramer.path, title: siFramer.title },
  // —— Backend ——
  nodedotjs: { path: siNodedotjs.path, title: siNodedotjs.title },
  bun: { path: siBun.path, title: siBun.title },
  python: { path: siPython.path, title: siPython.title },
  go: { path: siGo.path, title: siGo.title },
  graphql: { path: siGraphql.path, title: siGraphql.title },
  // —— Database ——
  postgresql: { path: siPostgresql.path, title: siPostgresql.title },
  mongodb: { path: siMongodb.path, title: siMongodb.title },
  redis: { path: siRedis.path, title: siRedis.title },
  supabase: { path: siSupabase.path, title: siSupabase.title },
  prisma: { path: siPrisma.path, title: siPrisma.title },
  // —— DevOps ——
  docker: { path: siDocker.path, title: siDocker.title },
  kubernetes: { path: siKubernetes.path, title: siKubernetes.title },
  vercel: { path: siVercel.path, title: siVercel.title },
  cloudflare: { path: siCloudflare.path, title: siCloudflare.title },
  githubactions: { path: siGithubactions.path, title: siGithubactions.title },
  // —— Design ——
  figma: { path: siFigma.path, title: siFigma.title },
  sketch: { path: siSketch.path, title: siSketch.title },
  blender: { path: siBlender.path, title: siBlender.title },
};
