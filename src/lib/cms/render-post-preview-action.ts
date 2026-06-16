'use server';

/**
 * renderPostPreviewAction — the owner-only server-side post preview (D-20 / D-04
 * "preview is truth"). It returns the SAME sanitized HTML STRING the public
 * `/blog/[slug]` page produces for the author's live Markdown body, so what the
 * author sees in the preview is byte-for-byte what publishes (minus the published
 * page's interactive copy-button — the one ACCEPTED DIVERGENCE, D-04). ZERO markdown
 * lib reaches the client (D-25): the editor island imports only this action
 * reference, never `react-markdown`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RENDER MECHANISM (BLOG-02 fix — the 17-04 D-15a escalation, CLOSED)
 *
 * This action now calls `renderMarkdownToHtml(body)` — a server-only, REACT-CONTEXT-
 * FREE pipeline (`src/lib/markdown/render-markdown-html.tsx`) that reproduces the
 * published sanitized output via SERVER-PURE elements (no client-graph code-bridge
 * provider). The previous mechanism — static-markup serialization over the old
 * element-tree renderer — ALWAYS THREW in the real Next runtime
 * because that tree contains client-graph components, and a Server Action cannot
 * invoke a client component synchronously ("Attempted to call a client component
 * from the server"). The client directive is inert in a plain node test env, so the
 * unit suite never caught it (17-04 finding). `renderMarkdownToHtml` removes the
 * client component from the tree, so the render is now safe in production.
 *
 * WHY THIS KEEPS dSIH OUT OF THE FEATURE / WHY IT IS SAFE:
 *   - The HTML is produced entirely SERVER-SIDE; `renderMarkdownToHtml` applies the
 *     SAME two-layer Markdown safety model as the publish path — `skipHtml` drops
 *     ALL raw HTML nodes (no <script>/<u> backdoor, D-10) and `urlTransform` drops
 *     non-https links + foreign images (D-11). The string contains ONLY the
 *     prose-primitive markup + pre-highlighted Shiki token spans — never the author's
 *     raw Markdown HTML. The preview is the SAME sanitized output, not a permissive
 *     variant (D-04 single source of truth; pinned by preview-parity.test.ts).
 *
 * The editor island injects the returned string through ONE sanctioned container
 * that renders this SERVER-PRODUCED, already-sanitized output — never a client-side
 * dSIH of the author's RAW input.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This action performs NO write: there is no `.insert`/`.update`/`.delete` to
 * `blog_posts` anywhere — it is a pure render behind the owner gate (the auth +
 * sub guard exist so the preview is owner-only, not publicly callable, even though
 * it touches no row).
 *
 * Source: the SHARED-A auth/sub guard (the gate, minus the write); the render from
 * `@/lib/markdown/render-markdown-html` (`renderMarkdownToHtml`, the context-free
 * sanitizer shared with the publish path — D-04). No static-markup serializer import
 * here: the dynamic serializer now lives INSIDE `renderMarkdownToHtml`, off this
 * action's static graph (so the Turbopack production build does not reject this
 * 'use server' module).
 */
// BLOG-02 / D-04
import { renderMarkdownToHtml } from '@/lib/markdown/render-markdown-html';
import { getVerifiedClaims } from '@/lib/supabase/server';

/** The preview outcome — on success a server-produced sanitized HTML string. */
export type RenderPostPreviewResult =
  | { ok: true; html: string }
  | { ok: false; error?: string };

/** The preview input — the live Markdown body the author is editing. */
export interface RenderPostPreviewInput {
  body_md: string;
}

const NOT_SIGNED_IN = 'Not signed in.';
const PREVIEW_FAILED = 'Couldn’t render the preview. Please try again.';

/**
 * Render the author's live Markdown body through the SAME publish pipeline and
 * return the server-produced, already-sanitized HTML string (D-20). Owner-only.
 */
export async function renderPostPreviewAction(
  input: RenderPostPreviewInput,
): Promise<RenderPostPreviewResult> {
  // Owner gate (no public exposure). Verified identity + WR-05 hard `sub` guard —
  // never coerce to ''. There is NO write past this point; the guard exists purely
  // so an anon caller cannot drive the (server-only) render pipeline.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  try {
    // The SAME sanitized output the public route produces (D-04), via the
    // context-free renderer — the drop rules (skipHtml/urlTransform) already ran
    // inside it. No client-graph component in the tree, so this no longer throws in
    // the real Next runtime (the 17-04 D-15a escalation is closed). // BLOG-02 / D-04
    const html = await renderMarkdownToHtml(input.body_md);
    return { ok: true, html };
  } catch {
    return { ok: false, error: PREVIEW_FAILED };
  }
}
