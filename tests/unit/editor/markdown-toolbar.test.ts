/**
 * 38-01 (MDED-01..03 / D-02..D-07) — the MarkdownToolbar's PURE command transforms
 * and its rendered structure, asserted render-free.
 *
 * WHY render-free (the project precedent — debounced-save.test.ts / the template
 * `.test.tsx` specs): the vitest `unit` project is the `node` environment (NO jsdom,
 * no @testing-library/react). So the four selection-behavior decisions are exported
 * as pure `(value, selStart, selEnd) → { next, selStart, selEnd }` transforms and
 * asserted WITHOUT a DOM, and the component STRUCTURE (7 aria-labelled buttons + the
 * D-07 <details>/<summary> cheatsheet) is asserted via react-dom/server
 * `renderToStaticMarkup` (the same SSR-string idiom the template specs use).
 *
 *   D-03 wrap-or-placeholder — bold/italic/code: wrap a selection, else insert a
 *         SELECTED placeholder (assert the returned selection offsets).
 *   D-04 line-prefix per-line — list `- ` / quote `> ` prefix EVERY line of a
 *         multi-line selection.
 *   D-05 single H2 — `## ` (one heading level, no picker) via the line-prefix path.
 *   D-06 link template — `[text](url)` with a preselected segment, NO window.prompt.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  MarkdownToolbar,
  linkTransform,
  prefixLinesTransform,
  wrapOrInsertTransform,
} from '@/components/editor/markdown-toolbar';

describe('D-03 — wrapOrInsertTransform (wrap-or-placeholder: bold/italic/inline-code)', () => {
  it('wraps a selection with the markers and places the cursor AFTER the wrapped run', () => {
    // value = "a selected b", selection covers "selected" (indices 2..10).
    const value = 'a selected b';
    const start = 2;
    const end = 10;
    const r = wrapOrInsertTransform(value, start, end, '**', '**', 'bold text');
    expect(r.next).toBe('a **selected** b');
    // Cursor lands after the closing `**` (collapsed selection).
    const pos = start + '**selected**'.length;
    expect(r.selStart).toBe(pos);
    expect(r.selEnd).toBe(pos);
  });

  it('with NO selection inserts `**bold text**` and SELECTS the inner placeholder', () => {
    const r = wrapOrInsertTransform('', 0, 0, '**', '**', 'bold text');
    expect(r.next).toBe('**bold text**');
    // The inner `bold text` segment is selected so the next keystroke replaces it.
    expect(r.selStart).toBe('**'.length); // 2
    expect(r.selEnd).toBe('**'.length + 'bold text'.length); // 11
    expect(r.next.slice(r.selStart, r.selEnd)).toBe('bold text');
  });

  it('inline code uses single backticks with a `code` placeholder', () => {
    const r = wrapOrInsertTransform('', 0, 0, '`', '`', 'code');
    expect(r.next).toBe('`code`');
    expect(r.next.slice(r.selStart, r.selEnd)).toBe('code');
  });
});

describe('D-04 — prefixLinesTransform (list/quote prefix EVERY line of a selection)', () => {
  it('prefixes each line of a 3-line selection with `- ` (bulleted list)', () => {
    const value = 'one\ntwo\nthree';
    const r = prefixLinesTransform(value, 0, value.length, '- ', 'List item');
    expect(r.next).toBe('- one\n- two\n- three');
  });

  it('prefixes each line of a 3-line selection with `> ` (quote)', () => {
    const value = 'one\ntwo\nthree';
    const r = prefixLinesTransform(value, 0, value.length, '> ', 'Quote');
    expect(r.next).toBe('> one\n> two\n> three');
  });

  it('expands a PARTIAL multi-line selection to whole lines before prefixing', () => {
    // Selection starts mid-"one" and ends mid-"three" — both touched lines prefix.
    const value = 'one\ntwo\nthree';
    const r = prefixLinesTransform(value, 1, value.length - 1, '- ', 'List item');
    expect(r.next).toBe('- one\n- two\n- three');
  });

  it('with NO selection inserts a single `- List item` line and selects the placeholder', () => {
    const r = prefixLinesTransform('', 0, 0, '- ', 'List item');
    expect(r.next).toBe('- List item');
    expect(r.next.slice(r.selStart, r.selEnd)).toBe('List item');
  });
});

describe('D-05 — single H2 (line-prefix `## `, one heading level)', () => {
  it('inserts `## ` with a `Heading` placeholder on an empty selection', () => {
    const r = prefixLinesTransform('', 0, 0, '## ', 'Heading');
    expect(r.next).toBe('## Heading');
    expect(r.next.slice(r.selStart, r.selEnd)).toBe('Heading');
  });

  it('prefixes a selected line with a SINGLE `## ` (no H1/H3 variants)', () => {
    const r = prefixLinesTransform('Title', 0, 'Title'.length, '## ', 'Heading');
    expect(r.next).toBe('## Title');
    // Exactly one `## ` marker — single heading level.
    expect(r.next.match(/#/g)?.length).toBe(2);
  });
});

describe('D-06 — linkTransform (the `[text](url)` template, NO window.prompt)', () => {
  it('with a selection produces `[selected](url)` and preselects the `url` segment', () => {
    const value = 'see foo here';
    const start = 4;
    const end = 7; // "foo"
    const r = linkTransform(value, start, end);
    expect(r.next).toBe('see [foo](url) here');
    expect(r.next.slice(r.selStart, r.selEnd)).toBe('url');
  });

  it('with NO selection produces `[text](url)` and preselects the `text` label', () => {
    const r = linkTransform('', 0, 0);
    expect(r.next).toBe('[text](url)');
    expect(r.next.slice(r.selStart, r.selEnd)).toBe('text');
  });
});

describe('MarkdownToolbar — rendered structure (7 aria-labelled buttons + D-07 cheatsheet)', () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownToolbar, { onCommand: () => {} }),
  );

  it('renders exactly 7 command buttons, each a <button type="button"> with an aria-label', () => {
    const buttons = html.match(/<button[^>]*type="button"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(7);
    for (const btn of buttons) {
      expect(btn).toMatch(/aria-label="[^"]+"/);
    }
  });

  it('carries the 7 D-02 command labels', () => {
    for (const label of ['Bold', 'Italic', 'Heading', 'Link', 'Bulleted list', 'Quote', 'Inline code']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
  });

  it('renders a native <details> cheatsheet with a <summary> (D-07 / MDED-02)', () => {
    expect(html).toMatch(/<details/);
    expect(html).toMatch(/<summary[^>]*>Formatting help<\/summary>/);
  });

  it('forwards `disabled` to the buttons', () => {
    const disabledHtml = renderToStaticMarkup(
      createElement(MarkdownToolbar, { onCommand: () => {}, disabled: true }),
    );
    const disabledButtons = disabledHtml.match(/<button[^>]*disabled[^>]*>/g) ?? [];
    expect(disabledButtons).toHaveLength(7);
  });
});
