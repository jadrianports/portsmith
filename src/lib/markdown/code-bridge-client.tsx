'use client';
/**
 * Fenced-code → Shiki bridge — the CLIENT half (D-12, Q-CODE pre-pass).
 *
 * react-markdown's `components` functions are SYNCHRONOUS, but Shiki is async. The
 * fix is a server-side PRE-PASS (see `code-bridge.tsx` — `extractFencedBlocks` +
 * `highlightFencedBlocks`) that resolves every fenced block to serializable tokens
 * BEFORE render; this module then renders the `code` component synchronously by
 * reading the pre-resolved tokens for the current block (matched by source order via
 * a closure counter held in React context).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WHY THIS IS A SEPARATE 'use client' MODULE (13.2-05 — LOAD-BEARING):            │
 * │ `createContext`/`useContext` are CLIENT-ONLY React APIs. Turbopack's production │
 * │ build (stricter than dev) HARD-ERRORS if a module importing `createContext` is  │
 * │ pulled into a Server Component graph. `render-markdown.tsx` is `server-only`    │
 * │ (it calls the server-only Shiki highlighter), so the context provider + the     │
 * │ `code` component MUST live here, behind a client boundary. The server renderer  │
 * │ imports + renders these as ordinary client components (the standard RSC slot    │
 * │ pattern): the pre-resolved `tokens` array crosses the boundary as a serializable │
 * │ prop. The pure (React-free) extraction/highlight pre-pass stays server-side in   │
 * │ `code-bridge.tsx`.                                                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Inline code (single backtick) renders as `ProseInlineCode` — no highlighting.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Element } from 'hast';

import {
  CodeBlock,
  ProseInlineCode,
  type CodeBlockTokens,
} from '@/components/templates/edgerunner-v2/pages/blog/prose';

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
