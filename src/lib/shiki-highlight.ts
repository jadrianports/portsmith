/**
 * Server-only shiki highlighting utility.
 *
 * Returns serializable token lines so that client components can render
 * syntax-highlighted code as <span style={{ color }}> elements — no
 * dangerouslySetInnerHTML required.
 *
 * Usage (server component / server action):
 *   import { highlightCode } from '@/lib/shiki-highlight'
 *   const result = await highlightCode(code, 'typescript')
 *   // result.lines  →  { text: string; color: string }[][]
 *   // result.bg     →  background color hex for the block
 */
import 'server-only';

import { createHighlighter, type Highlighter } from 'shiki';

// ── Token shape (serializable over the server→client prop boundary) ───────────

export interface HighlightToken {
  text: string;
  /** Hex color string, e.g. "#ff79c6". Falls back to "inherit" if absent. */
  color: string;
}

export interface HighlightResult {
  /** 2-D array: outer = lines, inner = tokens within each line. */
  lines: HighlightToken[][];
  /** Background color of the theme (for the pre element). */
  bg: string;
}

// ── Singleton highlighter (initialised once per Node process) ─────────────────

let _highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!_highlighterPromise) {
    _highlighterPromise = createHighlighter({
      // synthwave-84 is a first-party shiki theme — perfect dark synthwave palette
      themes: ['synthwave-84'],
      // D-12: curated common language set (~15). An unknown fence degrades to
      // plaintext (see the codeToTokens try/catch below) rather than throwing.
      langs: [
        'typescript',
        'tsx',
        'javascript',
        'jsx',
        'json',
        'bash',
        'css',
        'html',
        'python',
        'sql',
        'yaml',
        'go',
        'rust',
        'markdown',
        'diff',
      ],
    });
  }
  return _highlighterPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Highlight a code string using shiki + synthwave-84 theme.
 * Returns serializable { lines, bg } — safe to pass as RSC → client props.
 */
export async function highlightCode(
  code: string,
  lang: string = 'typescript',
): Promise<HighlightResult> {
  const hl = await getHighlighter();

  let tokenResult: ReturnType<Highlighter['codeToTokens']>;
  try {
    tokenResult = hl.codeToTokens(code, {
      lang: lang as Parameters<Highlighter['codeToTokens']>[1]['lang'],
      theme: 'synthwave-84',
    });
  } catch {
    // D-12 plaintext fallback: an unloaded/unknown language must never throw.
    // Degrade to uncolored token lines that keep the serializable HighlightResult
    // shape (one token per source line, color 'inherit').
    return {
      lines: code.split('\n').map((line) => [{ text: line, color: 'inherit' }]),
      bg: 'transparent',
    };
  }

  const lines: HighlightToken[][] = tokenResult.tokens.map((lineTokens) =>
    lineTokens.map((token) => ({
      text: token.content,
      color: token.color ?? 'inherit',
    })),
  );

  return {
    lines,
    bg: tokenResult.bg ?? 'transparent',
  };
}
