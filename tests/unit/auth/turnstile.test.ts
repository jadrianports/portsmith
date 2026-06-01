/**
 * Unit coverage for the server-only Turnstile verifier (AUTH-01).
 *
 * `verifyTurnstile` is a raw `fetch` POST to Cloudflare `siteverify` (no SDK,
 * CLAUDE.md). We MOCK `fetch` (never hit the network) and assert:
 *   - success  → {success:true}  → returns true
 *   - failure  → {success:false} → returns false
 *   - expired/duplicate replay ({success:false, 'error-codes':['timeout-or-duplicate']}) → false
 *   - the request body carries { secret, response, remoteip } to the documented URL
 *
 * Plus a source assertion: the module's FIRST line is `import 'server-only';`
 * (the FND-05 wall that keeps TURNSTILE_SECRET_KEY out of the browser bundle).
 *
 * NOTE: `import 'server-only'` throws in a non-RSC context, so we mock it to a
 * no-op for this unit test — the real compile-time wall is exercised by the
 * Next build, and the first-line presence is asserted directly from source.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `import 'server-only'` is a build-time guard that throws outside an RSC graph.
// Stub it so the module under test can be imported in the node unit env.
vi.mock('server-only', () => ({}));

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

describe('verifyTurnstile — server-side siteverify (AUTH-01)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function load() {
    const mod = await import('@/lib/auth/turnstile');
    return mod.verifyTurnstile;
  }

  function mockFetch(payload: unknown) {
    const fetchMock = vi.fn(async () => ({
      json: async () => payload,
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock as unknown as ReturnType<typeof vi.fn>;
  }

  it('returns true when siteverify responds { success: true }', async () => {
    mockFetch({ success: true });
    const verifyTurnstile = await load();
    await expect(verifyTurnstile('good-token')).resolves.toBe(true);
  });

  it('returns false when siteverify responds { success: false }', async () => {
    mockFetch({ success: false, 'error-codes': ['invalid-input-response'] });
    const verifyTurnstile = await load();
    await expect(verifyTurnstile('bad-token')).resolves.toBe(false);
  });

  it('returns false on an expired/duplicate (replayed) token', async () => {
    mockFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    const verifyTurnstile = await load();
    await expect(verifyTurnstile('replayed-token')).resolves.toBe(false);
  });

  it('POSTs { secret, response, remoteip } as JSON to the Cloudflare siteverify URL', async () => {
    const fetchMock = mockFetch({ success: true });
    const verifyTurnstile = await load();
    await verifyTurnstile('tok-123', '203.0.113.7');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      secret: 'test-secret',
      response: 'tok-123',
      remoteip: '203.0.113.7',
    });
  });

  it('returns false (never throws) when fetch rejects', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const verifyTurnstile = await load();
    await expect(verifyTurnstile('tok')).resolves.toBe(false);
  });
});

describe('turnstile.ts — server-only wall (FND-05 / T-02-09)', () => {
  it('declares `import \'server-only\';` as the first line', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/turnstile.ts'), 'utf-8');
    const firstCode = src
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));
    expect(firstCode).toBe("import 'server-only';");
  });

  it('does not import a Cloudflare Turnstile SDK (raw fetch only)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/turnstile.ts'), 'utf-8');
    // No `@`-scoped turnstile/cloudflare verify SDK import.
    expect(src).not.toMatch(/from\s+['"]@[^'"]*turnstile/i);
    expect(src).toMatch(/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  });
});
