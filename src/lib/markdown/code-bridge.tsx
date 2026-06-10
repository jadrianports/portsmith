/**
 * Fenced-code → Shiki bridge — the SERVER pre-pass (D-12, Q-CODE pre-pass).
 *
 * react-markdown's `components` functions are SYNCHRONOUS, but Shiki
 * (`highlightCode`) is async (Pitfall 2). The fix is a PRE-PASS: before rendering,
 * extract every fenced `{ code, lang }` block from the Markdown source IN SOURCE
 * ORDER, `await Promise.all` them through `highlightCode()` into an index-keyed
 * array, then render the `code` component synchronously by reading the pre-resolved
 * tokens for the current fenced block (matched by source order via a closure counter
 * held in React context — the CLIENT half, `code-bridge-client.tsx`).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ SERVER/CLIENT SPLIT (13.2-05): this module is PURE + `highlightCode` is         │
 * │ `server-only`, so it stays in the server graph. The React-context pieces        │
 * │ (`createContext`/`useContext` — client-only APIs that Turbopack's prod build    │
 * │ rejects in an RSC graph) live in `code-bridge-client.tsx` behind `'use client'`.│
 * │ The `code-bridge-client` symbols are re-exported here for a single import site. │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Unknown languages degrade to the Task-1 plaintext fallback inside `highlightCode`
 * (never throws). Inline code (single backtick) renders as `ProseInlineCode`.
 */
import type { CodeBlockTokens } from '@/components/templates/edgerunner-v2/pages/blog/prose';
import { highlightCode } from '@/lib/shiki-highlight';

// Re-export the client-side bridge pieces so the renderer imports from one place.
export { CodeBridge, CodeBridgeProvider } from './code-bridge-client';

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
