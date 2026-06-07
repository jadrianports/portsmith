/**
 * Raw code strings for edgerunner-v2 blog posts.
 *
 * SERVER-SAFE (no 'use client') — extracted from posts.tsx so that the server
 * page component can import and pre-highlight them with shiki without crossing
 * a 'use client' boundary.
 *
 * Key format: `${slug}/${blockIndex}` (0-based within each post).
 * Language defaults to 'typescript' unless overridden in POST_CODE_BLOCKS.
 */

export interface CodeBlockData {
  code: string;
  lang: string;
}

/** All code blocks, keyed by `${slug}/${index}`. */
export const POST_CODE_BLOCKS: Record<string, CodeBlockData> = {
  // ── shipping-on-the-edge ────────────────────────────────────────────────────
  'shipping-on-the-edge/0': {
    lang: 'typescript',
    code: `export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return await context.db.profiles.findUnique({
      where: { id: context.userId },
    });
  });`,
  },

  // ── neon-motion-design ──────────────────────────────────────────────────────
  'neon-motion-design/0': {
    lang: 'typescript',
    code: `export const motionTokens = {
  quick: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
  emphasis: { type: "spring", stiffness: 480, damping: 32 },
  ambient: { duration: 6, ease: "easeInOut", repeat: Infinity },
} as const;`,
  },
  'neon-motion-design/1': {
    lang: 'tsx',
    code: `const reduce = useReducedMotion();
return (
  <motion.div
    initial={{ opacity: 0, y: reduce ? 0 : 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={motionTokens.emphasis}
  />
);`,
  },

  // ── type-safety-or-die ──────────────────────────────────────────────────────
  'type-safety-or-die/0': {
    lang: 'typescript',
    code: `const postQuery = (slug: string) =>
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
}`,
  },
  'type-safety-or-die/1': {
    lang: 'typescript',
    code: `export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(64),
});
export type User = z.infer<typeof UserSchema>;`,
  },
};
