'use server';

/**
 * renderPostPreviewAction — the owner-only server-side post preview (D-20
 * "preview is truth"). It runs the EXACT same `renderMarkdown` pipeline the
 * public ISR post route uses, so what the author sees in the preview is byte-for-
 * byte what publishes. ZERO markdown lib reaches the client (D-25): the editor
 * island imports only this action reference, never `react-markdown`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SERIALIZATION MECHANISM (RESEARCH Q-CODE / PATTERNS "No Analog Found" decision)
 *
 * Rendered React elements cannot cross a Server Action boundary as elements — a
 * React element is not a serializable RSC payload value the action can return to
 * a client island. The chosen mechanism is: render the SAME server pipeline to a
 * static HTML STRING via `react-dom/server`'s `renderToStaticMarkup`, and return
 * that string. The editor displays it through a sanctioned, SERVER-PRODUCED
 * container.
 *
 * WHY THIS KEEPS dSIH OUT OF THE FEATURE / WHY IT IS SAFE:
 *   - The HTML is produced entirely SERVER-SIDE from the `renderMarkdown` pipeline,
 *     which already applies the two-layer Markdown safety model — `skipHtml` drops
 *     ALL raw HTML nodes (no <script>/<u> backdoor, D-10) and `urlTransform` drops
 *     non-https links + foreign images (D-11). The string therefore contains ONLY
 *     the prose-primitive markup + pre-highlighted Shiki token spans — never the
 *     author's raw Markdown HTML. The author cannot inject markup the publish path
 *     would not also have dropped (that is the whole point of D-20 "preview is
 *     truth"): the preview is the SAME sanitized output, not a permissive variant.
 *   - It is the IDENTICAL mechanism the unit suite already uses to assert the
 *     pipeline (`tests/unit/markdown/render.test.ts` renders via
 *     `renderToStaticMarkup(await renderMarkdown(md))`), so the preview output is
 *     trivially parity-testable against the publish pipeline (preview-parity.test).
 *   - The alternative (returning a serializable mdast/token tree the client re-walks)
 *     was rejected because re-walking on the client would require the prose
 *     primitives + a walker in the client bundle — reintroducing exactly the markdown
 *     surface D-25 bans. A server-rendered HTML string keeps the entire pipeline
 *     (react-markdown, remark-gfm, Shiki) server-only.
 *
 * The editor island injects the returned string through ONE sanctioned container
 * that renders this SERVER-PRODUCED, already-sanitized output — never a client-side
 * dSIH of the author's RAW input. (Client-side dSIH of raw user Markdown would
 * bypass D-10/D-11 and is forbidden; this is the opposite — the server already ran
 * the drop rules.)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This action performs NO write: there is no `.insert`/`.update`/`.delete` to
 * `blog_posts` anywhere — it is a pure render behind the owner gate (the auth +
 * sub guard exist so the preview is owner-only, not publicly callable, even though
 * it touches no row).
 *
 * Source: the SHARED-A auth/sub guard from `save-section-action.ts` (the gate,
 * minus the write); the render pipeline from `@/lib/markdown/render-markdown`
 * (`renderMarkdown`, the SAME function the public route consumes — D-09/D-20);
 * `renderToStaticMarkup` from `react-dom/server` (the proven serialize seam,
 * `tests/unit/markdown/render.test.ts:19,27`).
 *
 * BUILD NOTE (13.2-07, Turbopack production build): `react-dom/server` is imported
 * DYNAMICALLY inside the action body, NOT as a static top-level import. A static
 * `import … from 'react-dom/server'` in a `'use server'` module makes Turbopack treat
 * this server action as "a component that imports react-dom/server" and FAILS the
 * production build ("render or return the content directly as a Server Component").
 * Deferring the import to the async body keeps it out of the action module's static
 * graph (it only ever runs server-side, behind the owner gate) while leaving the
 * mechanism — `renderToStaticMarkup(await renderMarkdown(body))` — byte-for-byte
 * identical to the unit-suite seam and the public render pipeline (D-20 "preview is
 * truth" is preserved exactly).
 */
import { renderMarkdown } from '@/lib/markdown/render-markdown';
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
    // The SAME pipeline the public route renders (D-20). Rendered to a static
    // HTML string server-side (the only serializable form that crosses the action
    // boundary) — the drop rules (skipHtml/urlTransform) already ran inside it.
    // `react-dom/server` is imported dynamically here (see the BUILD NOTE header) so
    // the Turbopack production build does not reject this 'use server' module.
    const { renderToStaticMarkup } = await import('react-dom/server');
    const element = await renderMarkdown(input.body_md);
    const html = renderToStaticMarkup(element);
    return { ok: true, html };
  } catch {
    return { ok: false, error: PREVIEW_FAILED };
  }
}
