'use client';

/**
 * MarkdownToolbar (38-01 / MDED-01..03 / D-01..D-08) — the dashboard-only Markdown
 * formatting toolbar for the blog post editor's Write tab. It renders the 7 locked
 * commands (D-02: bold, italic, H2, link, bulleted list, quote, inline code) as
 * icon buttons plus a native `<details>` "Formatting help" cheatsheet (D-07 /
 * MDED-02), and it owns the PURE, DOM-free command transforms that the parent's
 * shared cursor-insert seam (`post-editor.tsx` `applyTransform`) applies.
 *
 * The component is intentionally PURE of the textarea ref: it takes a single pinned
 * `onCommand(kind)` callback (the fixed cross-plan contract plan 02 wires against)
 * plus a `disabled` flag. The PARENT maps each `kind` to the correct helper —
 * wrap kinds (bold/italic/code) → `wrapOrInsert`, line-prefix kinds (h2/list/quote)
 * → `prefixLines`, and `link` → the `[text](url)` template insert. This keeps the
 * ref + save coupling in the parent and lets a node vitest assert the transforms
 * below WITHOUT a DOM.
 *
 * MDED-03 boundary: the toolbar writes only Markdown TEXT (no HTML, no rich-text
 * model) and adds ZERO new dependency — the glyphs come from `lucide-react`, already
 * in the tree. The server-side `renderMarkdown` sanitize gate (skipHtml +
 * urlTransform) and the `postContentSchema` Zod re-parse remain the unchanged
 * boundary; the literal `[text](url)` is inert text until the server processes it.
 *
 * BUNDLE RULE (CLAUDE.md / D-25 — LOAD-BEARING): this island MUST NOT import the
 * Markdown render library, the validations barrel, or the template registry. It
 * imports only `lucide-react`.
 *
 * Two-layer identity (SHARED-E): Evergreen & Copper PLATFORM-CHROME tokens ONLY —
 * zero inline hex; the button styling mirrors the editor's Write/Preview tablist.
 */
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  Quote,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────── */
/* Pure, DOM-free command transforms (D-03..D-06).                              */
/*                                                                              */
/* Each maps `(value, selStart, selEnd)` → `{ next, selStart, selEnd }` — the   */
/* new body string plus the selection the parent restores via rAF. They are     */
/* exported so the node vitest (`tests/unit/editor/markdown-toolbar.test.ts`)   */
/* can assert the selection behavior WITHOUT a DOM (the project precedent:       */
/* pure helpers tested render-free in the `node` env).                          */
/* ──────────────────────────────────────────────────────────────────────────── */

/** The shape every command transform returns: the next body + the selection to set. */
export interface TransformResult {
  next: string;
  selStart: number;
  selEnd: number;
}

/**
 * Wrap-or-placeholder (D-03). With a selection: `before + selected + after`, cursor
 * placed AFTER the wrapped run. With an empty selection: `before + placeholder +
 * after`, with the inner `placeholder` segment SELECTED so the next keystroke
 * replaces it. Used by bold (`**`), italic (`*`), inline code (`` ` ``).
 */
export function wrapOrInsertTransform(
  value: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string,
  placeholder: string,
): TransformResult {
  const selected = value.slice(selStart, selEnd);
  if (selected.length > 0) {
    const inserted = before + selected + after;
    const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
    const pos = selStart + inserted.length;
    return { next, selStart: pos, selEnd: pos };
  }
  const inserted = before + placeholder + after;
  const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
  const innerStart = selStart + before.length;
  return { next, selStart: innerStart, selEnd: innerStart + placeholder.length };
}

/**
 * Line-prefix (D-04 / D-05). Expand the selection to whole lines and prefix EACH
 * line with `marker` (list `- `, quote `> `, H2 `## `). With an empty selection,
 * insert a single `marker + placeholder` line with `placeholder` selected.
 */
export function prefixLinesTransform(
  value: string,
  selStart: number,
  selEnd: number,
  marker: string,
  placeholder: string,
): TransformResult {
  // Empty selection → a single fresh marker line with the placeholder selected.
  if (selStart === selEnd) {
    const inserted = marker + placeholder;
    const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
    const innerStart = selStart + marker.length;
    return { next, selStart: innerStart, selEnd: innerStart + placeholder.length };
  }
  // Expand the selection to cover whole lines (back to the prior newline, forward
  // to the next), so a partial multi-line selection prefixes every touched line.
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  let lineEnd = value.indexOf('\n', selEnd);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split('\n')
    .map((line) => marker + line)
    .join('\n');
  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
  // Select the whole prefixed block so a follow-up command sees the same lines.
  return { next, selStart: lineStart, selEnd: lineStart + prefixed.length };
}

/**
 * Link template (D-06) — `[text](url)`, NO `window.prompt`. With a selection the
 * selected text becomes the label and the `url` segment is preselected
 * (`[selected](url)`); with no selection the `text` segment is preselected.
 */
export function linkTransform(
  value: string,
  selStart: number,
  selEnd: number,
): TransformResult {
  const selected = value.slice(selStart, selEnd);
  if (selected.length > 0) {
    // `[selected](url)` — preselect the `url` placeholder for immediate typing.
    const inserted = `[${selected}](url)`;
    const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
    // The `url` segment sits between the `](` and the closing `)`.
    const urlStart = selStart + `[${selected}](`.length;
    return { next, selStart: urlStart, selEnd: urlStart + 'url'.length };
  }
  // `[text](url)` — preselect the `text` label placeholder.
  const inserted = '[text](url)';
  const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
  const textStart = selStart + 1; // just after the opening `[`
  return { next, selStart: textStart, selEnd: textStart + 'text'.length };
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* The component.                                                               */
/* ──────────────────────────────────────────────────────────────────────────── */

/** The 7 locked commands (D-02). The parent maps each to the right helper. */
export type ToolbarCommand =
  | 'bold'
  | 'italic'
  | 'h2'
  | 'link'
  | 'list'
  | 'quote'
  | 'code';

export interface MarkdownToolbarProps {
  /**
   * The single pinned contract (the fixed cross-plan seam plan 02 wires against):
   * the parent receives the command `kind` and applies the matching transform
   * through its shared cursor-insert seam. NOT a multi-callback shape.
   */
  onCommand: (kind: ToolbarCommand) => void;
  /** Disable every button (the parent passes `inputsDisabled`). */
  disabled?: boolean;
}

/** One toolbar button's static config (glyph + accessible label + command kind). */
interface CommandButton {
  kind: ToolbarCommand;
  label: string;
  Icon: typeof Bold;
}

const COMMANDS: readonly CommandButton[] = [
  { kind: 'bold', label: 'Bold', Icon: Bold },
  { kind: 'italic', label: 'Italic', Icon: Italic },
  { kind: 'h2', label: 'Heading', Icon: Heading2 },
  { kind: 'link', label: 'Link', Icon: LinkIcon },
  { kind: 'list', label: 'Bulleted list', Icon: List },
  { kind: 'quote', label: 'Quote', Icon: Quote },
  { kind: 'code', label: 'Inline code', Icon: Code },
];

/** Chrome-token icon-button styling, copied from the editor's Write/Preview tabs. */
const BUTTON_CLASS =
  'inline-flex size-11 items-center justify-center rounded-md text-muted-foreground ' +
  'outline-none transition-colors hover:text-accent ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground ' +
  'motion-reduce:transition-none';

export function MarkdownToolbar({ onCommand, disabled }: MarkdownToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface-muted p-1"
      >
        {COMMANDS.map(({ kind, label, Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onCommand(kind)}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={BUTTON_CLASS}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        ))}
      </div>

      {/* D-07 / MDED-02: an inline native <details> cheatsheet — accessible by
          default (no focus-trap / scroll-lock), with worked examples in plain text. */}
      <details className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Formatting help
        </summary>
        <div className="mt-2 flex flex-col gap-1 leading-relaxed">
          <p>
            Wrap words in <code className="font-mono">**two stars**</code> for{' '}
            <strong>bold</strong>, or <code className="font-mono">*one star*</code> for{' '}
            <em>italic</em>.
          </p>
          <p>
            Start a line with <code className="font-mono">## </code> for a heading.
          </p>
          <p>
            Make a link with <code className="font-mono">[the words people see](https://example.com)</code>.
          </p>
          <p>
            Start each line with <code className="font-mono">- </code> for a bulleted list, or{' '}
            <code className="font-mono">&gt; </code> for a quote.
          </p>
          <p>
            Wrap text in <code className="font-mono">`backticks`</code> to show it as code.
          </p>
        </div>
      </details>
    </div>
  );
}
