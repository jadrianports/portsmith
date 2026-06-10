/**
 * RED (Wave 0, 13.2-01) — SC-1 / D-10 + D-11: the render-time sanitization contract.
 *
 *   D-10  Raw HTML is DROPPED entirely (GFM syntax only; no <script>, no <u> backdoor).
 *   D-11  Links render https-only (javascript:/data:/foreign-scheme links are dropped);
 *         image syntax renders ONLY when the URL points at our own Supabase storage
 *         public bucket — every foreign image is dropped.
 *
 * These are the framework-boundary drops react-markdown applies via `skipHtml`
 * (D-10) and `urlTransform` (D-11). Defense-in-depth: the Zod write gate
 * (posts.test.ts) is layer 1; this render-time drop is the authoritative layer 2.
 *
 * The own-storage host is DERIVED from `NEXT_PUBLIC_SUPABASE_URL` (the same source
 * the production url-policy reads) — never hardcoded — so the test tracks the real
 * storage origin (locally `http://127.0.0.1:54321`).
 *
 * RED today: `@/lib/markdown/render-markdown` does not exist — the import fails,
 * which IS the RED state. Greened when plan 13.2-02 builds the renderer + url-policy.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// The not-yet-existing render entry point. Import failure here = RED.
// @ts-expect-error — module is built in a later plan (Wave 0 RED).
import { renderMarkdown } from '@/lib/markdown/render-markdown';

const STORAGE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(
  /\/$/,
  '',
);
const OWN_IMAGE = `${STORAGE_ORIGIN}/storage/v1/object/public/portfolio-media/u/avatar.webp`;
const FOREIGN_IMAGE = 'https://evil.example/tracking-pixel.png';

async function html(md: string): Promise<string> {
  const element = await renderMarkdown(md);
  return renderToStaticMarkup(element);
}

describe('SC-1 / D-10 — raw HTML is dropped', () => {
  it('drops a <script> tag embedded in the source', async () => {
    const out = await html('Hello\n\n<script>alert(1)</script>\n\nWorld');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('drops an inline <u> (no underline backdoor — Markdown has no underline)', async () => {
    const out = await html('plain <u>underlined</u> text');
    expect(out.toLowerCase()).not.toContain('<u>');
  });
});

describe('SC-1 / D-11 — link scheme + image origin policy', () => {
  it('drops a javascript: link href', async () => {
    const out = await html('[click](javascript:alert(1))');
    expect(out).not.toMatch(/href=["']?javascript:/i);
  });

  it('drops a data: link href', async () => {
    const out = await html('[d](data:text/html,<b>x</b>)');
    expect(out).not.toMatch(/href=["']?data:/i);
  });

  it('keeps an https link', async () => {
    const out = await html('[ok](https://example.com/page)');
    expect(out).toContain('https://example.com/page');
  });

  it('drops a foreign (non-own-storage) image', async () => {
    const out = await html(`![pic](${FOREIGN_IMAGE})`);
    expect(out).not.toContain(FOREIGN_IMAGE);
  });

  it('renders an own-storage image', async () => {
    const out = await html(`![avatar](${OWN_IMAGE})`);
    expect(out).toContain(OWN_IMAGE);
  });
});
