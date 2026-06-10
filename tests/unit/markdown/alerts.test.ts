/**
 * RED (Wave 0, 13.2-01) — SC-1 / D-13: GitHub alert syntax → the export's `Callout`.
 *
 * The no-dependency alert approach (RESEARCH Pattern 1b — NOT the
 * remark-github-blockquote-alert plugin): the blockquote component detects a leading
 * `[!TYPE]` marker and renders the bespoke neon `Callout` with the mapped tone, else a
 * plain `ProseBlockquote`.
 *
 * ALERT_TONE map (RESEARCH Pattern 1b):
 *   NOTE / TIP            → 'cyan'
 *   IMPORTANT             → 'purple'
 *   WARNING / CAUTION     → 'pink'
 *
 * The `Callout` (prose.tsx:51-93) is a tone-styled <aside> whose tone selects a
 * `var(--neon-{tone})` text/border palette — so we assert on the tone's signature
 * neon var in the rendered output. A plain `> quote` (no marker) must render
 * ProseBlockquote (the my-8 border-l-2 font-display italic quote), NOT a Callout.
 *
 * RED today: `@/lib/markdown/render-markdown` does not exist — the import fails,
 * which IS the RED state. Greened when plan 13.2-02 builds the alert detection.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// The not-yet-existing render entry point. Import failure here = RED.
// @ts-expect-error — module is built in a later plan (Wave 0 RED).
import { renderMarkdown } from '@/lib/markdown/render-markdown';

async function html(md: string): Promise<string> {
  const element = await renderMarkdown(md);
  return renderToStaticMarkup(element);
}

describe('SC-1 / D-13 — alert syntax → Callout (tone-mapped); plain quote → blockquote', () => {
  it('> [!NOTE] → Callout tone cyan (neon-cyan palette)', async () => {
    const out = await html('> [!NOTE]\n> Heads up about something.');
    expect(out).toContain('Heads up about something.');
    expect(out).toContain('--neon-cyan');
  });

  it('> [!WARNING] → Callout tone pink (neon-pink palette)', async () => {
    const out = await html('> [!WARNING]\n> Be careful here.');
    expect(out).toContain('--neon-pink');
  });

  it('> [!IMPORTANT] → Callout tone purple (neon-purple palette)', async () => {
    const out = await html('> [!IMPORTANT]\n> This matters.');
    expect(out).toContain('--neon-purple');
  });

  it('a plain blockquote (no marker) → ProseBlockquote, NOT a Callout', async () => {
    const out = await html('> just a normal pull quote');
    expect(out).toContain('<blockquote');
    expect(out).toContain('just a normal pull quote');
  });
});
