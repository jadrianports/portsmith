/**
 * CR-01 regression — the Person JSON-LD `<script>` serializer MUST escape the
 * HTML/JS breakout characters so user-controlled free-text (`display_name` →
 * `name`, `headline` → `jobTitle`, neither character-allowlisted) cannot break out
 * of the `<script type="application/ld+json">` element and inject HTML.
 *
 * Before the fix the template injected raw `JSON.stringify(personLd)` via
 * `dangerouslySetInnerHTML`. `JSON.stringify` does NOT escape `<`/`>`/`/`, so a
 * `headline` of `</script><img src=x onerror=alert(1)>` terminated the script tag
 * early — a stored XSS on every published public page. The fix routes serialization
 * through `personLdScriptHtml` / `jsonLdToScriptHtml`, which `\u`-escape the
 * breakout characters while remaining valid JSON (so it still `JSON.parse`s back to
 * the identical object).
 *
 * Module is imported at RUNTIME via a variable specifier (mirroring metadata.test.ts)
 * so the static-include tsconfig stays 0 and the suite is independent of build wiring.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const LD = '@/lib/seo/person-jsonld';

type PersonLd = {
  '@context': string;
  '@type': string;
  name: string;
  url: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
};

async function loadModule(): Promise<{
  buildPersonLd: (data: unknown, username: string) => PersonLd;
  jsonLdToScriptHtml: (obj: unknown) => string;
  personLdScriptHtml: (data: unknown, username: string) => string;
}> {
  return (await import(/* @vite-ignore */ LD)) as {
    buildPersonLd: (data: unknown, username: string) => PersonLd;
    jsonLdToScriptHtml: (obj: unknown) => string;
    personLdScriptHtml: (data: unknown, username: string) => string;
  };
}

/** The attack payload an owner could store in a free-text profile field. */
const XSS_PAYLOAD = '</script><img src=x onerror=alert(1)>';

/** A minimal PortfolioData-shaped fixture (only the fields buildPersonLd reads). */
function makeData(overrides: {
  display_name?: string | null;
  headline?: string | null;
}) {
  return {
    profile: {
      display_name: overrides.display_name ?? null,
      avatar_url: null,
      headline: overrides.headline ?? null,
    },
    settings: { github_url: null, linkedin_url: null, twitter_url: null },
    sections: [],
    recentPosts: [],
    templateSpec: {},
  };
}

/** Reverse the `<script>`-safe `\u` escapes so we can JSON.parse the output. */
function unescapeScriptHtml(html: string): string {
  return html
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\u2028/g, ' ')
    .replace(/\\u2029/g, ' ');
}

const PREV = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.vercel.app';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = PREV;
});

describe('CR-01 — JSON-LD <script> serialization escapes breakout characters', () => {
  it('jsonLdToScriptHtml escapes a raw </script> payload (no literal </script>, contains \\u003c)', async () => {
    const { jsonLdToScriptHtml } = await loadModule();
    const html = jsonLdToScriptHtml({ name: XSS_PAYLOAD });
    // The breakout sequence must be gone.
    expect(html).not.toMatch(/<\/script>/i);
    expect(html).not.toContain('<');
    // The escaped form must be present.
    expect(html).toContain('\\u003c');
  });

  it('personLdScriptHtml escapes a malicious display_name AND headline', async () => {
    const { personLdScriptHtml } = await loadModule();
    const html = personLdScriptHtml(
      makeData({ display_name: XSS_PAYLOAD, headline: XSS_PAYLOAD }),
      'ada',
    );
    expect(html).not.toMatch(/<\/script>/i);
    expect(html).not.toContain('<');
    expect(html).not.toContain('>');
    expect(html).toContain('\\u003c');
  });

  it('the escaped output STILL parses back to the correct object (valid JSON-LD preserved)', async () => {
    const { personLdScriptHtml, buildPersonLd } = await loadModule();
    const data = makeData({ display_name: XSS_PAYLOAD, headline: XSS_PAYLOAD });
    const html = personLdScriptHtml(data, 'ada');

    // 1) Directly parsing the escaped string works (\uXXXX are JSON-legal escapes).
    const parsedDirect = JSON.parse(html) as PersonLd;
    // 2) And it round-trips to the same object the builder produced.
    const expected = buildPersonLd(data, 'ada');
    expect(parsedDirect).toEqual(expected);
    // The payload survives intact as DATA (escaped on the wire, decoded by JSON.parse).
    expect(parsedDirect.name).toBe(XSS_PAYLOAD);
    expect(parsedDirect.jobTitle).toBe(XSS_PAYLOAD);

    // 3) Reversing the \u escapes also yields parseable, identical JSON (sanity).
    expect(JSON.parse(unescapeScriptHtml(html))).toEqual(expected);
  });

  it('U+2028 / U+2029 line separators in user text are escaped', async () => {
    const { jsonLdToScriptHtml } = await loadModule();
    const html = jsonLdToScriptHtml({ name: 'a b c' });
    expect(html).not.toContain(' ');
    expect(html).not.toContain(' ');
    expect(html).toContain('\\u2028');
    expect(html).toContain('\\u2029');
    // Still valid JSON.
    expect((JSON.parse(html) as { name: string }).name).toBe('a b c');
  });
});
