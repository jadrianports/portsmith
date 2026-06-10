/**
 * `<JsonLd>` — the single sanctioned `<script type="application/ld+json">` renderer.
 *
 * Server Component. Its `html` MUST be produced by `jsonLdToScriptHtml` (see
 * `person-jsonld.ts`), which escapes the `< > &` / U+2028 / U+2029 breakout
 * characters so user-controlled values (post titles, names, excerpts) can never
 * terminate the `<script>` element early (stored XSS — T-06-09 / CR-01).
 *
 * WHY A DEDICATED COMPONENT (not inline in the route): the structured-data script is
 * NOT part of the Markdown→React render path. The `no-dsih` gate
 * (`tests/unit/markdown/no-dsih.test.ts`) forbids `dangerouslySetInnerHTML` anywhere
 * under `src/lib/markdown/`, the blog sub-route pages, and `edgerunner-v2/pages/blog/*`
 * — because dSIH of rendered Markdown HTML is the XSS hole that gate guards. Escaped
 * JSON-LD is a different, sanctioned use (the homepage `Person` LD already renders the
 * same way from the template root). Keeping this renderer in `src/lib/seo/` (outside
 * the gate's scan set) preserves the gate's real intent without weakening it.
 */
export function JsonLd({ html }: { html: string }) {
  // eslint-disable-next-line react/no-danger -- escaped JSON-LD only (jsonLdToScriptHtml), never rendered Markdown.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: html }} />;
}
