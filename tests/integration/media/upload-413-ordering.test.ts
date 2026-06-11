/**
 * D-14 (upload-413) — REGRESSION PIN for the `/api/media/upload` Content-Length
 * pre-buffer ORDERING + the strict-decimal degrade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIRM-OF-SHIPPED-GUARD (Phase 17, D-14). The guard itself is ALREADY shipped
 * and Phase-16 hardened in `src/app/api/media/upload/route.ts`:
 *   - `:117-128` the COARSE pre-check: reads `content-length`, a strict-decimal
 *     (`/^\d+$/`) gate, rejects `declared > MAX_UPLOAD_CEILING` (10 MiB) with 413
 *     BEFORE `req.formData()` at `:133` buffers the body into memory.
 *   - `:154-156` the AUTHORITATIVE post-read re-check: `bytes.byteLength >
 *     cfg.ceiling` → 413 (Content-Length is UNTRUSTED — Pitfall 4 — so the
 *     post-read per-kind byte check stays the real gate).
 *
 * This test PINS the ORDERING + the strict-decimal degrade so a future refactor
 * cannot silently reopen the function-OOM lever. It is a CONFIRM + regression
 * test — it changes NO production code under `src/app/api/media/upload/`.
 *
 * RELATIONSHIP TO THE EXISTING UNIT COVERAGE (do not treat as accidental dup):
 *   `tests/unit/media/upload-content-length.test.ts` (Phase-16 WR-04, commit
 *   39c3fbc) already exercises the full hex/padded/garbage matrix in the `unit`
 *   project. THIS file is the Phase-17 D-14 artifact required by `17-04-PLAN.md`
 *   (`must_haves.artifacts` → `tests/integration/media/upload-413-ordering.test.ts`):
 *   it pins the THREE ordering invariants from `17-VALIDATION.md` (oversized
 *   decimal → pre-buffer 413; hex over bound → post-read 413; small valid → not
 *   falsely 413'd) at the integration tier as the durable ordering regression.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HARNESS (mirrors `tests/integration/media/upload-image.test.ts` header style +
 * the route-unit drive idiom proven by `upload-content-length.test.ts`): the route
 * reads `next/headers` (via `getVerifiedClaims`) and the service-role admin client,
 * neither of which has a request scope in the `node` integration project, so we
 * stub `server-only`, mock the verified-claims gate + the admin client + the
 * magic-byte sniff, then drive the route's `POST(req)` with a synthesized
 * `Request`. The size-ordering assertions are therefore PURE route assertions (no
 * live DB needed — the plan's "Requires the local Supabase stack only if the
 * valid-upload case writes; otherwise the size cases are pure route assertions").
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_UPLOAD_CEILING } from '@/lib/media/upload-config';

// D-14: `server-only` is the route's secret-module guard; stub it so the route
// imports cleanly under the `node` test environment.
vi.mock('server-only', () => ({}));

// D-14: verified identity gate — a valid UUID `sub` so the route clears the [A]
// auth + UUID guard and reaches the Content-Length ordering code under test.
const VALID_SUB = '00000000-0000-0000-0000-0000000000aa';
const getVerifiedClaims = vi.fn(async (): Promise<{ sub?: string } | null> => ({
  sub: VALID_SUB,
}));
vi.mock('@/lib/supabase/server', () => ({
  getVerifiedClaims: () => getVerifiedClaims(),
}));

// D-14: service-role admin client — a chainable stub. The profile read returns a
// fresh account (0 used bytes) so the quota pre-check passes; the storage upload
// resolves no-error. These legs are reached ONLY by the small-valid case, AFTER
// the post-read ceiling check; the oversized cases never get here.
const profileSingle = vi.fn(async () => ({
  data: { storage_used_bytes: 0 },
  error: null,
}));
const storageUpload = vi.fn(async () => ({ error: null }));
const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://x/y.webp' } }));
vi.mock('@/lib/supabase/service-role', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: profileSingle })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({ upload: storageUpload, getPublicUrl })),
    },
  },
}));

// D-14: magic-byte sniff — a valid `image/webp` so a body that PASSES both ceiling
// checks proceeds to a 200; oversized bodies never reach the sniff.
vi.mock('@/lib/media/magic-bytes', () => ({
  ALLOWED_IMAGE_MIME: new Set(['image/webp']),
  ALLOWED_PDF_MIME: new Set(['application/pdf']),
  sniffMime: vi.fn(async () => 'image/webp'),
}));

import { POST } from '@/app/api/media/upload/route';

/**
 * Build a POST request with a controllable `content-length` header and a `formData`
 * spy. With `formDataThrows: true`, `req.formData()` throws if reached — so a case
 * expecting the pre-check to reject BEFORE buffering asserts the 413 with the body
 * never read (a body-buffer tripwire). The route reads only `headers.get(...)` +
 * `formData()`, so a bare object cast to `Request` is sufficient (D-14).
 */
function uploadReq(opts: {
  contentLength?: string;
  body?: FormData;
  formDataThrows?: boolean;
}): { req: Request; formDataSpy: ReturnType<typeof vi.fn> } {
  const headers = new Headers();
  if (opts.contentLength !== undefined) {
    headers.set('content-length', opts.contentLength);
  }
  const formDataSpy = vi.fn(async () => {
    if (opts.formDataThrows) {
      throw new Error('formData() must NOT be reached — the body was buffered (D-14 ordering regression)');
    }
    if (opts.body) return opts.body;
    throw new Error('no body provided');
  });
  const req = { headers, formData: formDataSpy } as unknown as Request;
  return { req, formDataSpy };
}

/** A valid multipart body whose `file` is an actually-oversized Blob (> 10 MiB). */
function oversizedBody(): FormData {
  const fd = new FormData();
  fd.set('kind', 'avatar');
  // Just over the coarse 10 MiB bound AND over the per-kind avatar ceiling (5 MiB),
  // so the post-read per-kind check rejects it when the pre-check degrades.
  const big = new Uint8Array(MAX_UPLOAD_CEILING + 1024);
  fd.set('file', new Blob([big]));
  return fd;
}

/** A small valid WebP-kind body, well under every cap (the small-valid case). */
function smallValidBody(): FormData {
  const fd = new FormData();
  fd.set('kind', 'avatar');
  fd.set('file', new Blob([new Uint8Array(1024)])); // 1 KiB
  return fd;
}

describe('D-14 — upload-413 Content-Length pre-buffer ORDERING + strict-decimal degrade', () => {
  beforeEach(() => {
    getVerifiedClaims.mockClear();
    getVerifiedClaims.mockResolvedValue({ sub: VALID_SUB });
    profileSingle.mockClear();
    storageUpload.mockClear();
  });

  // (1) Oversized clean-decimal Content-Length → 413 BEFORE the body is buffered.
  it('rejects a clean decimal content-length over the ceiling with 413 WITHOUT parsing the body (pre-buffer ordering)', async () => {
    const { req, formDataSpy } = uploadReq({
      contentLength: String(MAX_UPLOAD_CEILING + 1), // clean decimal, over 10 MiB
      formDataThrows: true, // trips if the pre-check fails to short-circuit first
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    // The ORDERING invariant: the coarse pre-check fired BEFORE `req.formData()`.
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  // (2) Hex Content-Length over the bound → NOT pre-rejected (strict-decimal gate
  //     degrades) but IS rejected by the authoritative post-read byteLength check.
  it('does NOT pre-reject a hex content-length (0x989680) over the bound — the oversized body still hits the post-read 413', async () => {
    // `Number('0x989680') === 10000000` (< the 10 MiB ceiling): a bare-`Number`
    // pre-check would honor the hex as a small length and let the oversized body
    // buffer unbounded. The strict `/^\d+$/` gate degrades to the post-read check.
    const { req, formDataSpy } = uploadReq({
      contentLength: '0x989680',
      body: oversizedBody(),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    // The hex header was NOT honored as a pre-check length → the body WAS read,
    // then rejected by the AUTHORITATIVE per-kind post-read byteLength gate.
    expect(formDataSpy).toHaveBeenCalledTimes(1);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  // (3) Small valid upload WITH a present (correct, small) Content-Length →
  //     never falsely 413'd; it proceeds to the normal downstream 200.
  it('does NOT falsely 413 a small valid upload that carries a present small content-length', async () => {
    const body = smallValidBody();
    const { req, formDataSpy } = uploadReq({
      contentLength: '1024', // a correct, small, clean-decimal length
      body,
    });
    const res = await POST(req);
    // No false pre-check 413 — a small clean-decimal length under the bound passes,
    // the body is read, both ceiling checks pass, and the route returns 200.
    expect(res.status).toBe(200);
    expect(formDataSpy).toHaveBeenCalledTimes(1);
    expect(storageUpload).toHaveBeenCalledTimes(1);
  });
});
