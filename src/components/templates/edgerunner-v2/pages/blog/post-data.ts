/**
 * Static blog post metadata for edgerunner-v2 template.
 *
 * This module is SERVER-SAFE (no 'use client') — it only exports plain data
 * and types, NOT React components. The Body components live in posts.tsx
 * (which is 'use client') and are imported separately by client components.
 *
 * Split from posts.tsx so that server components (generateStaticParams,
 * generateMetadata, page.tsx) can import POST_SLUGS / getPostBySlug without
 * crossing a 'use client' boundary.
 */

export type Accent = 'pink' | 'cyan' | 'purple';

export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readingTime: string;
  tags: string[];
  accent: Accent;
}

/** All 3 post metadata entries, sorted newest-first. */
export const blogPostMetas: BlogPostMeta[] = [
  {
    slug: 'shipping-on-the-edge',
    title: 'Shipping React on the Edge in 2026',
    excerpt:
      'Why edge runtimes are the new default for product engineering — and the patterns that actually scale.',
    date: '2026-04-18',
    readingTime: '8 min',
    tags: ['Edge', 'React', 'Performance'],
    accent: 'pink',
  },
  {
    slug: 'neon-motion-design',
    title: 'Motion as a First-Class Citizen',
    excerpt:
      'How I treat motion the same way I treat color and typography — as a design token, not an afterthought.',
    date: '2026-03-02',
    readingTime: '6 min',
    tags: ['Motion', 'Design Systems', 'Framer'],
    accent: 'cyan',
  },
  {
    slug: 'type-safety-or-die',
    title: 'Type Safety or Die: My TanStack Setup',
    excerpt:
      'End-to-end type safety from the database to the JSX. No more guessing what your API returns.',
    date: '2026-01-21',
    readingTime: '10 min',
    tags: ['TypeScript', 'TanStack', 'DX'],
    accent: 'purple',
  },
];

/** All valid post slugs — used in generateStaticParams. */
export const POST_SLUGS: string[] = blogPostMetas.map((p) => p.slug);

/** Look up post metadata by slug. Returns undefined if not found. */
export function getPostMetaBySlug(slug: string): BlogPostMeta | undefined {
  return blogPostMetas.find((p) => p.slug === slug);
}
