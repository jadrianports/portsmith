import 'server-only';

/**
 * renderMarkdownToHtml — the server-only, REACT-CONTEXT-FREE Markdown → sanitized
 * HTML-string pipeline (BLOG-02 / D-04).
 *
 * WHY THIS EXISTS (the 17-04 D-15a escalation): `renderMarkdown` (render-markdown.tsx)
 * wraps its tree in a client-graph code-bridge provider and maps `code` to a
 * client-graph bridge component. Calling `renderToStaticMarkup(await renderMarkdown(...))`
 * from a Server Action throws in the REAL Next runtime ("Attempted to call a client
 * component from the server") — the client directive is inert in a plain node test
 * env, so the unit suite never caught it.
 *
 * This module reproduces the IDENTICAL sanitized output as the published
 * `/blog/[slug]` page — the SAME `skipHtml` (D-10 raw-HTML drop) + `urlTransform`
 * (D-11 https-only links, own-storage-only images) drop-rules and the SAME Shiki
 * pre-pass (code-bridge `extractFencedBlocks`/`highlightFencedBlocks`, which are pure,
 * no React context) — but emits SERVER-PURE elements only: no client directive, no
 * `createContext`/`useContext`, no `useRef`/`useState`. The element tree therefore
 * serializes safely via `renderToStaticMarkup` from inside a Server Action.
 *
 * ACCEPTED DIVERGENCE (D-04): the published page keeps its interactive `prose.tsx`
 * tree (the client copy-button on code blocks). The server-pure elements here
 * reproduce the SAME prose markup + class names MINUS the copy-button only. The
 * copy-button is the SOLE intended difference between preview and published; every
 * other element's class names match `prose.tsx` (pinned by the parity unit test, so
 * any OTHER markup drift fails).
 *
 * Fenced code blocks are matched to their pre-resolved Shiki tokens by source order
 * via a plain CLOSURE counter (the 17-04 "plain non-context cursor") — NOT React
 * context (which is what made the original path client-only).
 */
import { type ReactElement, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { HighlightToken } from '@/lib/shiki-highlight';

import { CalloutOrQuote } from './callout-blockquote';
import { extractFencedBlocks, highlightFencedBlocks } from './code-bridge';
import { transformUrl } from './url-policy';

/**
 * Pre-highlighted Shiki token lines for one fenced block — structurally identical
 * to the prose `CodeBlockTokens` shape, declared locally so this server module imports
 * NOTHING from the client-graph prose primitives (keeps the client-isolation grep
 * gate green; the `highlightFencedBlocks` pre-pass returns exactly this shape).
 */
type CodeBlockTokens = { lines: HighlightToken[][] };

// ── Server-pure prose elements (class-name parity with prose.tsx, NO hooks) ──────
//
// These reproduce the exact markup + class names of the client-graph prose
// primitives (prose.tsx) as plain server functions. They carry NO useRef/useState/
// createContext — that is the whole point (the original client tree could not be
// rendered to a string from a Server Action). The parity unit test derives the
// expected class set from prose.tsx and asserts these match.

const ProseH2 = ({ children }: { children?: ReactNode }) => (
  <h2 className="mt-12 mb-3 font-display text-2xl font-bold uppercase tracking-wider text-neon-cyan text-glow-cyan">
    {children}
  </h2>
);

const ProseH3 = ({ children }: { children?: ReactNode }) => (
  <h3 className="mt-8 mb-2 font-display text-xl font-semibold uppercase tracking-wide text-neon-purple text-glow-purple">
    {children}
  </h3>
);

const ProseP = ({ children }: { children?: ReactNode }) => (
  <p
    className="my-5 text-lg leading-relaxed"
    style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
  >
    {children}
  </p>
);

const ProseUl = ({ children }: { children?: ReactNode }) => (
  <ul
    className="my-5 space-y-2 pl-1"
    style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
  >
    {children}
  </ul>
);

const ProseOl = ({ children }: { children?: ReactNode }) => (
  <ol
    className="my-5 list-inside list-decimal space-y-2 pl-1 text-lg marker:text-neon-cyan"
    style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
  >
    {children}
  </ol>
);

const ProseLi = ({ children }: { children?: ReactNode }) => (
  <li className="flex items-start gap-3 text-lg">
    <span
      className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{
        background: 'var(--neon-pink)',
        boxShadow: '0 0 6px var(--neon-pink)',
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
    <span>{children}</span>
  </li>
);

const ProseInlineCode = ({ children }: { children?: ReactNode }) => (
  <code
    className="rounded font-mono-retro text-base text-neon-cyan"
    style={{
      border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
      background: 'color-mix(in srgb, var(--neon-cyan) 10%, transparent)',
      padding: '0.125rem 0.375rem',
    }}
  >
    {children}
  </code>
);

const ProseHr = () => <div className="my-10 h-px bg-gradient-neon" />;

const ProseTable = ({ children }: { children?: ReactNode }) => (
  <div
    className="my-6 overflow-x-auto rounded-lg"
    style={{ border: '1px solid color-mix(in oklab, var(--border) 60%, transparent)' }}
  >
    <table className="w-full border-collapse text-left">{children}</table>
  </div>
);

const ProseTh = ({ children }: { children?: ReactNode }) => (
  <th
    className="border-b px-4 py-2 font-mono-retro text-sm uppercase tracking-wider text-neon-purple"
    style={{
      borderColor: 'color-mix(in oklab, var(--neon-purple) 40%, transparent)',
      background: 'color-mix(in srgb, var(--neon-purple) 10%, transparent)',
    }}
  >
    {children}
  </th>
);

const ProseTd = ({ children }: { children?: ReactNode }) => (
  <td
    className="border-b px-4 py-2"
    style={{
      borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)',
      color: 'color-mix(in oklab, var(--fg) 85%, transparent)',
    }}
  >
    {children}
  </td>
);

/**
 * Server-pure code block: reproduces `CodeBlock`'s window-chrome wrapper + the
 * pre-highlighted Shiki token markup (`<pre><code className="font-mono">` with
 * `<span className="block">` lines and `<span style={{ color }}>` tokens) — the
 * SAME markup `CodeBlock` emits on its `tokens` path — but OMITS the copy button
 * (the only client-graph piece, dropped per RESEARCH A2 / the ACCEPTED DIVERGENCE).
 */
const ServerCodeBlock = ({ tokens }: { tokens: CodeBlockTokens }) => (
  <div
    className="group my-6 overflow-hidden rounded-lg transition-all"
    style={{
      border: '1px solid color-mix(in oklab, var(--neon-purple) 40%, transparent)',
      background: 'color-mix(in srgb, var(--bg-deep) 80%, transparent)',
      boxShadow: '0 0 12px color-mix(in oklab, var(--neon-purple) 30%, transparent)',
    }}
  >
    {/* Window chrome header (copy button omitted — the only client-only piece). */}
    <div
      className="flex items-center justify-between border-b px-4 py-2"
      style={{
        borderColor: 'color-mix(in oklab, var(--neon-purple) 30%, transparent)',
        background: 'oklch(0.08 0.05 290)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: 'var(--neon-pink)', boxShadow: '0 0 6px var(--neon-pink)' }}
        />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--neon-yellow)' }} />
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: 'var(--neon-cyan)', boxShadow: '0 0 6px var(--neon-cyan)' }}
        />
        <span
          className="ml-3 font-mono-retro text-xs uppercase tracking-[0.3em]"
          style={{ color: 'color-mix(in oklab, var(--neon-cyan) 70%, transparent)' }}
        >
          ./run
        </span>
      </div>
    </div>
    <pre className="overflow-x-auto p-4 text-[0.95rem] leading-relaxed">
      <code className="font-mono">
        {tokens.lines.map((lineTokens, lineIdx) => (
          <span key={lineIdx} className="block">
            {lineTokens.map((token, tokenIdx) => (
              <span
                key={tokenIdx}
                style={token.color !== 'inherit' ? { color: token.color } : undefined}
              >
                {token.text}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  </div>
);

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Render a Markdown source string to a sanitized HTML STRING — server-only,
 * React-context-free, safe to serialize from a Server Action.
 *
 * BLOG-02 / D-04: this is the single source of truth shared with the publish path
 * (same drop-rules + same Shiki pre-pass), so preview == published (minus the
 * copy-button, the one accepted divergence).
 */
export async function renderMarkdownToHtml(source: string): Promise<string> {
  // Shiki pre-pass — PURE (no React context). Fenced blocks are pre-resolved to
  // serializable token lines IN SOURCE ORDER (the stable index the closure cursor reads).
  const tokens = await highlightFencedBlocks(extractFencedBlocks(source));

  // Plain CLOSURE counter (the 17-04 "plain non-context cursor"): react-markdown's
  // `code` callback fires synchronously in source order for each FENCED block; we
  // hand each its pre-resolved tokens by incrementing this index. Inline code (no
  // `\n`, no `pre` wrapper) renders as ProseInlineCode and does NOT consume a token.
  let fenceCursor = 0;

  const components: Components = {
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
    // Unwrap react-markdown's default <pre> wrapper — ServerCodeBlock renders its own.
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      // Fenced blocks carry a `language-*` class (or are multi-line); inline code
      // has neither. Match react-markdown's own fenced-vs-inline distinction: a
      // fenced block is wrapped in <pre>, so it arrives with a className OR a newline.
      const text = String(children ?? '');
      const isFenced = /language-/.test(className ?? '') || text.includes('\n');
      if (!isFenced) return <ProseInlineCode>{children}</ProseInlineCode>;
      const blockTokens = tokens[fenceCursor];
      fenceCursor += 1;
      // Defensive: if the pre-pass missed this block (shouldn't happen — same source),
      // fall back to the raw text in the same <pre><code> chrome.
      const safeTokens: CodeBlockTokens = blockTokens ?? {
        lines: text.replace(/\n$/, '').split('\n').map((line) => [{ text: line, color: 'inherit' }]),
      };
      return <ServerCodeBlock tokens={safeTokens} />;
    },
    a: ({ href, children }) => (
      <a href={href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ),
  };

  const tree: ReactElement = (
    <Markdown
      remarkPlugins={[remarkGfm]}
      skipHtml /* D-10: raw HTML dropped entirely (no <script>/<u> backdoor) */
      urlTransform={transformUrl} /* D-11: https-only links, own-storage imgs */
      components={components}
    >
      {source}
    </Markdown>
  );

  // `react-dom/server` is imported DYNAMICALLY inside the async body (the Turbopack
  // production-build note from render-post-preview-action.ts) — but unlike the old
  // path the tree contains ZERO client-graph components, so this is now SAFE in the
  // real Next runtime (the 17-04 D-15a throw is gone).
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(tree);
}
