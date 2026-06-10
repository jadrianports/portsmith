/**
 * RED (Wave 0, 13.2-01) — SC-1 / D-13: GFM Markdown maps onto the existing prose
 * primitives (no HTML-string intermediate, no MDX).
 *
 * Asserts the core D-09 pipeline: `renderMarkdown` (server, react-markdown +
 * remark-gfm with a `components` map onto `prose.tsx`) turns GFM source into the
 * styled prose elements. We render the output to a static HTML string via
 * `react-dom/server` (`renderToStaticMarkup` — node env, no DOM) and assert on the
 * prose primitives' signature class strings:
 *   - `## h2`            → ProseH2 (text-neon-cyan / text-glow-cyan)
 *   - `### h3`           → ProseH3 (text-neon-purple)
 *   - a pipe table       → ProseTable (font-mono-retro th, the table wrapper)
 *   - a `- [ ]` task list / `- item` bullets → ProseUl / ProseLi
 *   - `~~strike~~`       → a <del> (remark-gfm strikethrough)
 *
 * RED today: `@/lib/markdown/render-markdown` does not exist — the import fails,
 * which IS the RED state. Greened when plan 13.2-02 builds the renderer.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// The render entry point (GREEN as of 13.2-03).
import { renderMarkdown } from '@/lib/markdown/render-markdown';

/** Render the server pipeline output to a static HTML string for assertion. */
async function html(md: string): Promise<string> {
  const element = await renderMarkdown(md);
  return renderToStaticMarkup(element);
}

describe('SC-1 / D-13 — GFM → prose primitives (component-mapped render)', () => {
  it('## maps to ProseH2 (neon-cyan signature class)', async () => {
    const out = await html('## Hello World');
    expect(out).toContain('Hello World');
    expect(out).toMatch(/text-neon-cyan|text-glow-cyan/);
  });

  it('### maps to ProseH3 (neon-purple signature class)', async () => {
    const out = await html('### A Subsection');
    expect(out).toMatch(/text-neon-purple/);
  });

  it('a pipe table maps to ProseTable + ProseTh/ProseTd', async () => {
    const out = await html(['| A | B |', '| - | - |', '| 1 | 2 |'].join('\n'));
    expect(out).toContain('<table');
    // ProseTh carries the font-mono-retro uppercase header signature.
    expect(out).toMatch(/font-mono-retro/);
  });

  it('bullets and task lists map to the prose list primitives', async () => {
    const out = await html(['- one', '- [ ] todo', '- [x] done'].join('\n'));
    expect(out).toContain('<ul');
    expect(out).toContain('<li');
  });

  it('~~strikethrough~~ (remark-gfm) renders a <del>', async () => {
    const out = await html('This is ~~gone~~ text.');
    expect(out).toContain('<del');
  });
});
