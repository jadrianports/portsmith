// BLOG-02 / D-04
/**
 * D-04 "preview is truth" — REAL sanitized-bytes + prose-class-name parity proof.
 *
 * The CMS Preview action (`renderPostPreviewAction`) now renders through
 * `renderMarkdownToHtml` — a server-only, React-context-free pipeline that
 * reproduces the published `/blog/[slug]` sanitized output (same `skipHtml` +
 * `urlTransform` drop-rules + same Shiki pre-pass) MINUS the client copy-button.
 *
 * This test asserts the REAL emitted bytes (NOT a self-comparison):
 *   1. PROSE-CLASS-NAME PARITY — the emitted HTML carries the SAME prose class
 *      names that `prose.tsx` applies (h2/h3/p/ul/ol/li/inline-code/table/th/td/
 *      code-block), so any markup drift between the hand-reproduced server markup
 *      and the published prose FAILS here. The copy-button is the ONLY sanctioned
 *      omission (ACCEPTED DIVERGENCE) — asserted absent below.
 *   2. skipHtml (D-10) — a raw `<script>` / raw-HTML injection is DROPPED.
 *   3. urlTransform (D-11) — a `javascript:` link and a foreign-origin image src
 *      are DROPPED.
 */
import { describe, expect, it } from 'vitest';

import { renderMarkdownToHtml } from '@/lib/markdown/render-markdown-html';

// A representative GFM fixture exercising every prose primitive + the two
// non-trivial branches (fenced Shiki code, GitHub-alert Callout) and the two
// sanitization drop-rules (raw <script>, javascript: link, foreign image).
const FIXTURE = [
  '## Heading Two',
  '',
  '### Heading Three',
  '',
  'Some prose with `inline code` and a [safe link](https://example.com).',
  '',
  '- bullet one',
  '- bullet two',
  '',
  '1. first',
  '2. second',
  '',
  '> [!NOTE]',
  '> This is a GitHub alert that must render as a Callout.',
  '',
  '| Col A | Col B |',
  '| ----- | ----- |',
  '| a1    | b1    |',
  '',
  '```ts',
  'const x: number = 42;',
  'console.log(x);',
  '```',
  '',
  '<script>alert(1)</script>',
  '',
  '[evil link](javascript:alert(1))',
  '',
  '![foreign](https://evil.example.com/tracker.png)',
  '',
].join('\n');

describe('D-04 — renderMarkdownToHtml prose-class-name parity + sanitization', () => {
  // ── 1. Prose-class-name parity (markup drift guard) ──────────────────────────
  it('emits the SAME prose class names that prose.tsx applies (markup parity)', async () => {
    const html = await renderMarkdownToHtml(FIXTURE);

    // Headings (ProseH2 / ProseH3).
    expect(html).toContain('text-neon-cyan text-glow-cyan');
    expect(html).toContain('text-neon-purple text-glow-purple');
    expect(html).toContain('Heading Two');
    expect(html).toContain('Heading Three');

    // Paragraph (ProseP).
    expect(html).toContain('my-5 text-lg leading-relaxed');

    // Lists (ProseUl / ProseOl / ProseLi).
    expect(html).toContain('my-5 space-y-2 pl-1');
    expect(html).toContain('list-inside list-decimal');
    expect(html).toContain('flex items-start gap-3 text-lg');

    // Inline code (ProseInlineCode).
    expect(html).toContain('rounded font-mono-retro text-base text-neon-cyan');

    // Table (ProseTable / ProseTh / ProseTd).
    expect(html).toContain('w-full border-collapse text-left');
    expect(html).toContain('font-mono-retro text-sm uppercase tracking-wider text-neon-purple');

    // Fenced code block (ServerCodeBlock): the window-chrome wrapper + the
    // pre-highlighted token markup. Shiki tokenizes `const` as its own span.
    expect(html).toContain('group my-6 overflow-hidden rounded-lg transition-all');
    expect(html).toContain('overflow-x-auto p-4 text-[0.95rem] leading-relaxed');
    expect(html).toContain('./run');
    expect(html).toContain('const');

    // GitHub-alert Callout (D-13) fired (the alert marker is stripped + a Callout aside emitted).
    expect(html).toContain('font-display text-lg italic');
    expect(html).not.toContain('[!NOTE]');
  });

  // ── ACCEPTED DIVERGENCE: the copy-button is the ONLY omitted piece ───────────
  it('OMITS the client copy-button (the sole sanctioned preview/published divergence)', async () => {
    const html = await renderMarkdownToHtml(FIXTURE);
    expect(html).not.toContain('aria-label="Copy code"');
    expect(html.toLowerCase()).not.toContain('>copy<');
  });

  // ── 2. skipHtml (D-10): raw HTML / <script> is dropped ───────────────────────
  it('DROPS raw HTML injection (skipHtml — no <script> backdoor)', async () => {
    const html = await renderMarkdownToHtml(FIXTURE);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)</script>');
  });

  // ── 3. urlTransform (D-11): javascript: link + foreign image dropped ─────────
  it('DROPS a javascript: link and a foreign-origin image (urlTransform)', async () => {
    const html = await renderMarkdownToHtml(FIXTURE);
    // The javascript: href is stripped (react-markdown omits the empty attribute);
    // the safe https link survives.
    expect(html).not.toContain('javascript:');
    expect(html).toContain('https://example.com');
    // The foreign image src is dropped — its origin must not appear as an src.
    expect(html).not.toContain('evil.example.com/tracker.png');
  });
});
