'use client';
/**
 * Blog posts with React body components for edgerunner-v2 template.
 *
 * Content FAITHFULLY TRANSCRIBED (not paraphrased) from:
 *   lovable-exports/synthwave-founder/src/content/blog/*.mdx
 *
 * This module is 'use client' because the Body components use prose.tsx
 * which has CodeBlock (with useState for the copy button).
 *
 * Server-safe metadata (slugs, titles, dates, etc.) lives in post-data.ts.
 *
 * Re-exports Accent and BlogPostMeta from post-data.ts for convenience.
 */
import type { ReactNode } from 'react';
import {
  ProseH2,
  ProseP,
  ProseUl,
  ProseLi,
  ProseInlineCode,
  ProseTable,
  ProseTh,
  ProseTd,
  Callout,
  CodeBlock,
} from './prose';
import {
  blogPostMetas,
  type Accent,
  type BlogPostMeta,
} from './post-data';

// Re-export for convenience
export type { Accent, BlogPostMeta };

// ── Post body components ──────────────────────────────────────────────────────

function ShippingOnTheEdgeBody() {
  return (
    <>
      <ProseP>
        The edge stopped being a novelty about two years ago. Today every serious app I ship
        runs as close to the user as physically possible — and the developer experience has
        finally caught up with the promise.
      </ProseP>

      <ProseH2>Cold starts are dead</ProseH2>

      <ProseP>
        With V8 isolates booting in single-digit milliseconds, you can colocate auth, data
        fetching, and rendering in the same request without paying a 200ms tax. The result is
        a frontend that feels native — even on a flaky 4G connection from a tunnel.
      </ProseP>

      <CodeBlock>
        <code>{`export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return await context.db.profiles.findUnique({
      where: { id: context.userId },
    });
  });`}</code>
      </CodeBlock>

      <ProseH2>Patterns that scale</ProseH2>

      <ProseUl>
        <ProseLi>Stream as early as possible — your hero should never wait on a slow query</ProseLi>
        <ProseLi>Cache at the edge with stale-while-revalidate, invalidate from server functions</ProseLi>
        <ProseLi>Push real-time over WebSockets, not polling — the runtime is finally good enough</ProseLi>
        <ProseLi>Treat your database client as a first-class citizen of the bundle</ProseLi>
      </ProseUl>

      <Callout tone="cyan">
        If your TTFB is over 100ms in 2026, the network isn&apos;t the problem — your architecture is.
      </Callout>

      <ProseH2>What&apos;s next</ProseH2>

      <ProseP>
        Multi-region writes are still the unsolved frontier. Most apps fake it with eventual
        consistency and a strongly-consistent primary region — which works until your users
        notice. The next big unlock is going to be conflict-free replicated data types becoming
        a first-class primitive in mainstream databases.
      </ProseP>

      <ProseP>Until then: ship fast, ship close, and instrument everything.</ProseP>
    </>
  );
}

function NeonMotionDesignBody() {
  return (
    <>
      <ProseP>
        Motion is the part of your design system that users feel before they see. Get it wrong
        and the brand feels cheap, no matter how clean the typography. Get it right and a button
        press becomes a small piece of theater.
      </ProseP>

      <ProseH2>Token everything</ProseH2>

      <ProseP>
        I export easing curves, durations, and spring presets the same way I export colors. A{' '}
        <ProseInlineCode>motion-quick</ProseInlineCode> is 180ms with an aggressive ease. A{' '}
        <ProseInlineCode>motion-emphasis</ProseInlineCode> is a stiff spring. Components consume
        tokens, never raw values.
      </ProseP>

      <CodeBlock>
        <code>{`export const motionTokens = {
  quick: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
  emphasis: { type: "spring", stiffness: 480, damping: 32 },
  ambient: { duration: 6, ease: "easeInOut", repeat: Infinity },
} as const;`}</code>
      </CodeBlock>

      <ProseH2>Reduced motion is non-negotiable</ProseH2>

      <ProseP>
        Every animated component checks{' '}
        <ProseInlineCode>prefers-reduced-motion</ProseInlineCode>{' '}
        and falls back to opacity-only transitions. It&apos;s not an edge case — it&apos;s
        accessibility.
      </ProseP>

      <CodeBlock>
        <code>{`const reduce = useReducedMotion();
return (
  <motion.div
    initial={{ opacity: 0, y: reduce ? 0 : 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={motionTokens.emphasis}
  />
);`}</code>
      </CodeBlock>

      <Callout tone="pink">
        Motion that ignores user preferences isn&apos;t tasteful — it&apos;s hostile.
      </Callout>

      <ProseH2>A short taxonomy</ProseH2>

      <ProseTable>
        <thead>
          <tr>
            <ProseTh>Category</ProseTh>
            <ProseTh>When to use</ProseTh>
            <ProseTh>Token</ProseTh>
          </tr>
        </thead>
        <tbody>
          <tr>
            <ProseTd>Quick</ProseTd>
            <ProseTd>Hover, focus, micro-feedback</ProseTd>
            <ProseTd><ProseInlineCode>motion-quick</ProseInlineCode></ProseTd>
          </tr>
          <tr>
            <ProseTd>Emphasis</ProseTd>
            <ProseTd>Modals, sheets, route swaps</ProseTd>
            <ProseTd><ProseInlineCode>motion-emphasis</ProseInlineCode></ProseTd>
          </tr>
          <tr>
            <ProseTd>Ambient</ProseTd>
            <ProseTd>Backgrounds, glow loops</ProseTd>
            <ProseTd><ProseInlineCode>motion-ambient</ProseInlineCode></ProseTd>
          </tr>
        </tbody>
      </ProseTable>

      <ProseP>
        Once motion is tokenized, it stops being an opinion and starts being part of the system.
      </ProseP>
    </>
  );
}

function TypeSafetyOrDieBody() {
  return (
    <>
      <ProseP>
        If you can&apos;t rename a database column and let TypeScript walk you through every
        affected component, you don&apos;t have a type-safe stack — you have a type-flavored one.
      </ProseP>

      <ProseH2>The full chain</ProseH2>

      <ProseUl>
        <ProseLi>
          <strong>Drizzle</strong> for the schema — types flow from the database itself
        </ProseLi>
        <ProseLi>
          <strong>Zod</strong> validators on every server function input
        </ProseLi>
        <ProseLi>
          <strong>TanStack Router</strong> for path params and search state
        </ProseLi>
        <ProseLi>
          <strong>TanStack Query</strong> for fetch + cache, typed from the server fn
        </ProseLi>
      </ProseUl>

      <ProseH2>A real query, end to end</ProseH2>

      <CodeBlock>
        <code>{`const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["post", slug],
    queryFn: () => getPost({ data: { slug } }),
  });

export const Route = createFileRoute("/posts/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(postQuery(params.slug)),
  component: PostPage,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(slug));
  //      ^? Post  — fully inferred from the server fn return type
  return <Article post={data} />;
}`}</code>
      </CodeBlock>

      <Callout tone="purple">
        Types aren&apos;t ceremony. They&apos;re the cheapest documentation you&apos;ll ever write.
      </Callout>

      <ProseH2>The rule of one schema</ProseH2>

      <ProseP>
        Every shape that crosses a boundary (HTTP, database, queue) gets exactly one source of
        truth. Everything else is derived. The moment you have two definitions of{' '}
        <ProseInlineCode>User</ProseInlineCode> floating around, you&apos;re already drifting.
      </ProseP>

      <CodeBlock>
        <code>{`export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(64),
});
export type User = z.infer<typeof UserSchema>;`}</code>
      </CodeBlock>

      <ProseP>
        Use that one schema in the API validator, in the form, in the test fixtures. The compiler
        becomes your QA engineer.
      </ProseP>
    </>
  );
}

// ── Post full type (meta + Body) ──────────────────────────────────────────────

export interface BlogPost extends BlogPostMeta {
  Body: () => ReactNode;
}

const bodyComponents: Record<string, () => ReactNode> = {
  'shipping-on-the-edge': ShippingOnTheEdgeBody,
  'neon-motion-design': NeonMotionDesignBody,
  'type-safety-or-die': TypeSafetyOrDieBody,
};

/** All 3 posts (meta + Body), sorted newest-first (order from post-data.ts). */
export const blogPosts: BlogPost[] = blogPostMetas.map((meta) => ({
  ...meta,
  Body: bodyComponents[meta.slug]!,
}));

/** Look up a full post (meta + Body) by slug. */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
