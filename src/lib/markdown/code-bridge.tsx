/**
 * Fenced-code → Shiki bridge (D-12, Q-CODE pre-pass).
 *
 * react-markdown's `components` functions are SYNCHRONOUS, but Shiki
 * (`highlightCode`) is async (Pitfall 2). The fix is a PRE-PASS: before
 * rendering, extract every fenced `{ code, lang }` block from the Markdown
 * source, `await Promise.all` them through `highlightCode()` into an
 * index-keyed array, then render the `code` component synchronously by reading
 * the pre-resolved tokens for the current fenced block (matched by source
 * order via a closure counter held in React context).
 *
 * Unknown languages degrade to the Task-1 plaintext fallback inside
 * `highlightCode` (never throws). Inline code (single backtick) renders as
 * `ProseInlineCode` — no highlighting.
 *
 * This module is server-renderable (no 'use client'); the only client island is
 * `CodeBlock` itself (it owns the copy-button state).
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Element } from 'hast';

import { CodeBlock, ProseInlineCode, type CodeBlockTokens } from '@/components/templates/edgerunner-v2/pages/blog/prose';
import { highlightCode } from '@/lib/shiki-highlight';

// ── Pre-pass extraction ─────────────────────────────────────────────────────

interface FencedBlock {
  code: string;
  lang: string;
}

/**
 * Matches a fenced code block: ```lang\n…\n``` (or ~~~). Captures the info
 * string (group 1) and the body (group 2). Tolerant of CRLF and trailing
 * whitespace on the fence lines.
 */
const FENCE_RE = /^[ \t]*(?:```|~~~)[ \t]*([^\n`~]*)\r?\n([\s\S]*?)\r?\n[ \t]*(?:```|~~~)[ \t]*$/gm;

/** Extract fenced blocks IN SOURCE ORDER (the stable index the bridge keys on). */
export function extractFencedBlocks(source: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  for (const match of source.matchAll(FENCE_RE)) {
    const info = match[1].trim();
    // The language is the first token of the info string (`ts {1,3}` → `ts`).
    const lang = info.split(/\s+/)[0] || 'text';
    blocks.push({ code: match[2], lang });
  }
  return blocks;
}

/**
 * Pre-resolve all fenced blocks to serializable Shiki tokens. Unknown langs
 * degrade to plaintext inside highlightCode (Task-1 try/catch), so this never
 * throws on a bad fence.
 */
export async function highlightFencedBlocks(blocks: FencedBlock[]): Promise<CodeBlockTokens[]> {
  return Promise.all(
    blocks.map(async ({ code, lang }) => {
      const { lines } = await highlightCode(code, lang);
      return { lines };
    }),
  );
}

// ── Render context (sync token lookup, source-ordered) ───────────────────────

interface CodeBridgeState {
  tokens: CodeBlockTokens[];
  /** Mutable cursor — incremented as each fenced block renders, matching order. */
  cursor: { i: number };
}

const CodeBridgeContext = createContext<CodeBridgeState | null>(null);

/** Provider wrapping the <Markdown> tree with the pre-resolved token array. */
export function CodeBridgeProvider({
  tokens,
  children,
}: {
  tokens: CodeBlockTokens[];
  children: ReactNode;
}) {
  // A fresh cursor per render so re-renders re-walk the blocks in order.
  return (
    <CodeBridgeContext.Provider value={{ tokens, cursor: { i: 0 } }}>
      {children}
    </CodeBridgeContext.Provider>
  );
}

// ── The `code` component (inline vs fenced) ──────────────────────────────────

/**
 * react-markdown renders fenced code as `<pre><code class="language-xxx">` and
 * inline code as a bare `<code>` (no language class, no surrounding <pre>).
 * We distinguish: a `language-*` className OR a multi-line value ⇒ fenced.
 */
export function CodeBridge({
  className,
  children,
  node,
}: {
  className?: string;
  children?: ReactNode;
  node?: Element;
}) {
  const state = useContext(CodeBridgeContext);
  const isFenced =
    typeof className === 'string' && /\blanguage-/.test(className)
      ? true
      : // Fallback: a code element whose only child is multi-line text is fenced.
        typeof children === 'string' && children.includes('\n');

  if (!isFenced) {
    return <ProseInlineCode>{children}</ProseInlineCode>;
  }

  // Fenced: pull the next pre-resolved token set by source order.
  const tokens = state ? state.tokens[state.cursor.i++] : undefined;
  // `node` is unused for rendering but kept in the signature so react-markdown's
  // ExtraProps shape is satisfied without an unused-var lint hit.
  void node;
  return <CodeBlock tokens={tokens}>{children}</CodeBlock>;
}
