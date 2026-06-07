/**
 * Curated tech-stack brand-logo map for the edgerunner-v2 Skills section.
 * Direct copy of edgerunner/sections/icons.ts — identical imports, identical map.
 * Kept separate per D-17 (each template is self-contained).
 *
 * NAMED individual imports ONLY — the tree-shaking guarantee.
 * See edgerunner/sections/icons.ts for the full design rationale.
 */

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
 * `skillItem.icon`. A slug not present here simply renders no logo — graceful.
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
