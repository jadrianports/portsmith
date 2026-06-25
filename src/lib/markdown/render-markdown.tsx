/**
 * The single MD → AST → React render pipeline (D-09).
 *
 * One server-renderable function shared by BOTH the public ISR post route
 * (13.2-05) and the CMS preview action (13.2-04) — so a preview can never lie
 * (D-20 "preview is truth"). No `'use client'`: it runs server-side, keeping
 * react-markdown / remark-gfm OFF the public First Load JS (D-25).
 *
 * Security mechanisms (zero `dangerouslySetInnerHTML`, no `rehype-raw`):
 *   - D-10: `skipHtml` drops ALL raw HTML nodes (no <script>/<u> backdoor).
 *   - D-11: `urlTransform` drops non-https links + foreign images (url-policy).
 *   - D-12: fenced code is pre-highlighted via Shiki and rendered as colored
 *           <span> token lines (code-bridge), never as an HTML string.
 *   - D-13: GitHub alert blockquotes render the neon Callout (callout-blockquote).
 *
 * GFM nodes map 1:1 onto the edgerunner-v2 prose primitives.
 */
import 'server-only';

import { type ReactElement } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  ProseH2,
  ProseH3,
  ProseP,
  ProseUl,
  ProseOl,
  ProseLi,
  ProseTable,
  ProseTh,
  ProseTd,
  ProseHr,
} from '@/components/templates/edgerunner-v2/pages/blog/prose';

import { CalloutOrQuote } from './callout-blockquote';
import {
  CodeBridge,
  CodeBridgeProvider,
  extractFencedBlocks,
  highlightFencedBlocks,
} from './code-bridge';
import { transformUrl } from './url-policy';

/**
 * The components map: GFM tag names → prose primitives. `code` bridges to the
 * pre-resolved Shiki tokens; `pre` is unwrapped to a fragment so the bridge's
 * own CodeBlock owns the <pre> chrome (no double-<pre> nesting); `blockquote`
 * routes through the D-13 alert detection; `a` carries rel="noopener
 * noreferrer". `img` needs no special component — `urlTransform` already drops
 * any non-own-storage `src` (react-markdown then omits the empty src).
 */
const defaultComponents: Components = {
  h2: ProseH2,
  h3: ProseH3,
  p: ProseP,
  ul: ProseUl,
  ol: ProseOl,
  li: ProseLi,
  table: ProseTable,
  th: ProseTh,
  td: ProseTd,
  hr: ProseHr,
  blockquote: CalloutOrQuote,
  // Unwrap react-markdown's default <pre> wrapper — CodeBlock renders its own.
  pre: ({ children }) => <>{children}</>,
  code: CodeBridge,
  a: ({ href, children }) => (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  ),
};

/**
 * Render a Markdown source string to a React element tree via the prose
 * primitives. Async because fenced code is pre-highlighted server-side before
 * the synchronous react-markdown render.
 */
export async function renderMarkdown(
  source: string,
  /**
   * Per-template prose primitives (PIPE — template-scoped blog styling). Defaults to the
   * edgerunner-v2 synthwave set ({@link defaultComponents}) so existing call sites are
   * UNCHANGED; a page-capable template (e.g. `blueprint`) passes its OWN GFM→element map so
   * its post body renders in ITS scoped voice. The shared security mechanisms (skipHtml /
   * urlTransform / CodeBridge highlight) are identical regardless of the components map.
   */
  components: Components = defaultComponents,
): Promise<ReactElement> {
  const tokens = await highlightFencedBlocks(extractFencedBlocks(source));

  return (
    <CodeBridgeProvider tokens={tokens}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml /* D-10: raw HTML dropped entirely (NOT rehype-raw) */
        urlTransform={transformUrl} /* D-11: https-only links, own-storage imgs */
        components={components}
      >
        {source}
      </Markdown>
    </CodeBridgeProvider>
  );
}

/**
 * Convenience server component wrapper for direct JSX use in an ISR route
 * (`<MarkdownRenderer source={post.body_md} />`). Identical pipeline. `components` is
 * optional and forwards to {@link renderMarkdown} (default = edgerunner-v2 prose).
 */
export async function MarkdownRenderer({
  source,
  components,
}: {
  source: string;
  components?: Components;
}): Promise<ReactElement> {
  return renderMarkdown(source, components ?? defaultComponents);
}
