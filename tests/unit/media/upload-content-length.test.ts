/**
 * D-12 / HARD-04 — the upload-route `Content-Length` pre-buffer reject.
 *
 * `POST /api/media/upload` buffers the WHOLE request body (`req.formData()` →
 * `file.arrayBuffer()`) before the per-kind byte-ceiling check, so an oversized body
 * is buffered into memory before being rejected — a $0-tier function-OOM / memory-
 * pressure lever. The fix is a COARSE `Content-Length` pre-check (= the max per-kind
 * ceiling = `MAX_UPLOAD_CEILING` = 10 MiB) that rejects with 413 BEFORE `formData()`.
 *
 * Content-Length is UNTRUSTED (Pitfall 4): a forged/absent/garbage header must NOT
 * become the authority, so the existing post-read `bytes.byteLength > cfg.ceiling`
 * per-kind check (route line ~131) STAYS the real gate. KEEP BOTH (D-12).
 *
 * Three behaviors:
 *   1. Oversized declared `content-length` → 413 `{error:'too_large'}` WITHOUT the
 *      body being read (`req.formData` is never reached — asserted via a spy that
 *      throws if called).
 *   2. Absent (or too-small/forged) `content-length` → passes the pre-check and falls
 *      through to the authoritative post-read per-kind 413 for an actually-oversized
 *      body. (Content-Length is untrusted; the post-read check is the real gate.)
 *   3. Garbage/non-finite `content-length` (`NaN`, empty) → no false 413 at the
 *      pre-check; it only rejects on a FINITE value strictly greater than the ceiling.
 *
 * Mock idiom mirrors `tests/unit/contact/contact-route.test.ts` /
 * `tests/unit/page-view/page-view-route.test.ts`: stub `server-only`, mock the
 * service-role admin client + the verified-claims gate, then exercise `POST` directly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_UPLOAD_CEILING } from '@/lib/media/upload-config';

vi.mock('server-only', () => ({}));

// Verified identity gate — return a valid UUID `sub` so the route passes the [A]
// auth + UUID guard and reaches the body-handling code under test.
const VALID_SUB = '00000000-0000-0000-0000-0000000000aa';
const getVerifiedClaims = vi.fn(async (): Promise<{ sub?: string } | null> => ({
  sub: VALID_SUB,
}));
vi.mock('@/lib/supabase/server', () => ({
  getVerifiedClaims: () => getVerifiedClaims(),
}));

// Service-role admin client — a chainable stub. The profile read returns a fresh
// account (0 used bytes); the storage upload resolves no-error. None of this touches
// a real DB, and these legs are only reached AFTER the post-read ceiling check passes.
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

// Magic-byte sniff — return a valid image/webp so a body that PASSES both ceiling
// checks would proceed; oversized bodies never reach here.
vi.mock('@/lib/media/magic-bytes', () => ({
  ALLOWED_IMAGE_MIME: new Set(['image/webp']),
  ALLOWED_PDF_MIME: new Set(['application/pdf']),
  sniffMime: vi.fn(async () => 'image/webp'),
}));

import { POST } from '@/app/api/media/upload/route';

/**
 * Build a POST request with a controllable `content-length` header and a `formData`
 * spy. When `formDataThrows` is true, `req.formData()` throws immediately if called —
 * so a test that expects the pre-check to reject BEFORE the buffer can assert the
 * 413 without `formData` ever running (a body-read tripwire).
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
      throw new Error('formData() must NOT be reached — body was buffered');
    }
    if (opts.body) return opts.body;
    throw new Error('no body provided');
  });
  // A bare object with the bits the route touches: headers + formData. Cast to Request
  // — the route only reads `req.headers.get('content-length')` and `req.formData()`.
  const req = { headers, formData: formDataSpy } as unknown as Request;
  return { req, formDataSpy };
}

/** A valid multipart body whose `file` is an actually-oversized Blob (> 10 MiB). */
function oversizedBody(): FormData {
  const fd = new FormData();
  fd.set('kind', 'avatar');
  // A Blob just over the per-kind avatar ceiling (5 MiB) AND over the coarse 10 MiB
  // coarse bound, so the post-read per-kind check rejects it when no/forged CL header.
  const big = new Uint8Array(MAX_UPLOAD_CEILING + 1024);
  fd.set('file', new Blob([big]));
  return fd;
}

describe('D-12 — upload Content-Length pre-buffer reject', () => {
  beforeEach(() => {
    getVerifiedClaims.mockClear();
    getVerifiedClaims.mockResolvedValue({ sub: VALID_SUB });
    profileSingle.mockClear();
    storageUpload.mockClear();
  });

  it('rejects an oversized declared content-length with 413 WITHOUT buffering the body', async () => {
    const { req, formDataSpy } = uploadReq({
      contentLength: String(MAX_UPLOAD_CEILING + 1),
      formDataThrows: true, // trips if the pre-check fails to short-circuit
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    // The cheap pre-check fired BEFORE the body was buffered.
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it('passes the pre-check on an ABSENT content-length and falls through to the authoritative post-read 413 (Pitfall 4)', async () => {
    // No content-length header at all — the pre-check must not reject; the actually-
    // oversized body is caught by the retained per-kind post-read byteLength check.
    const { req, formDataSpy } = uploadReq({ body: oversizedBody() });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    // The body WAS read (the pre-check passed) — the post-read check is the real gate.
    expect(formDataSpy).toHaveBeenCalledTimes(1);
    // It never reached the privileged write.
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('passes the pre-check on a too-small/forged content-length and still hits the post-read 413', async () => {
    // A forged tiny content-length on an actually-oversized body — the post-read
    // per-kind check still rejects (Content-Length is untrusted).
    const { req, formDataSpy } = uploadReq({
      contentLength: '10', // forged, far below the real body size
      body: oversizedBody(),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    expect(formDataSpy).toHaveBeenCalledTimes(1);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('does NOT false-reject a garbage/non-finite content-length at the pre-check', async () => {
    // `NaN` (from a non-numeric header) and an empty header must NOT trigger the
    // pre-check 413 — it only rejects on a FINITE value strictly over the ceiling.
    // A small valid body then flows through to a normal 200.
    const smallBody = new FormData();
    smallBody.set('kind', 'avatar');
    smallBody.set('file', new Blob([new Uint8Array(1024)])); // 1 KiB, under every cap

    const { req: garbageReq, formDataSpy: garbageSpy } = uploadReq({
      contentLength: 'not-a-number',
      body: smallBody,
    });
    const garbageRes = await POST(garbageReq);
    // No false 413 — the garbage header was ignored and the small upload succeeded.
    expect(garbageRes.status).toBe(200);
    expect(garbageSpy).toHaveBeenCalledTimes(1);

    const { req: emptyReq } = uploadReq({
      contentLength: '',
      body: (() => {
        const fd = new FormData();
        fd.set('kind', 'avatar');
        fd.set('file', new Blob([new Uint8Array(1024)]));
        return fd;
      })(),
    });
    const emptyRes = await POST(emptyReq);
    expect(emptyRes.status).toBe(200);
  });

  // WR-04 (Phase-16 code-review fix, 39c3fbc) — the pre-check parses ONLY a clean
  // decimal (`/^\d+$/` on the trimmed header). The shipped fix replaced a bare
  // `Number(header)` that would coerce a hex (`0x989680` -> 10000000) or a padded
  // header to a small finite value, letting a genuinely oversized body sail past the
  // coarse pre-buffer guard. These lock that parse so a regression can't silently
  // reopen the OOM lever.

  it('WR-04: a whitespace-padded oversized content-length still rejects pre-buffer (trim + strict decimal)', async () => {
    // The trimmed value is a clean decimal over the bound — the guard must still fire
    // BEFORE the body is buffered (padding must not defeat the pre-check).
    const { req, formDataSpy } = uploadReq({
      contentLength: `   ${MAX_UPLOAD_CEILING + 1}   `,
      formDataThrows: true, // trips if the pre-check fails to short-circuit
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it('WR-04: a hex content-length (0x989680) is NOT honored as a pre-check length — an oversized body still hits the authoritative post-read 413', async () => {
    // `Number('0x989680') === 10000000` (< the 10 MiB ceiling): a bare-Number pre-check
    // would treat the hex header as a valid small length and let the oversized body
    // buffer unbounded. The strict `/^\d+$/` parse rejects the hex form, degrading to
    // the authoritative post-read byteLength check (Content-Length is untrusted).
    const { req, formDataSpy } = uploadReq({
      contentLength: '0x989680',
      body: oversizedBody(),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    // The hex header fell through to the real gate (the body WAS read, then rejected).
    expect(formDataSpy).toHaveBeenCalledTimes(1);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('WR-04: a hex content-length does NOT false-reject a small valid upload', async () => {
    // The hex form is "not a trustworthy decimal length" → skip the pre-check (no false
    // 413); a small valid body then flows through to a normal 200.
    const smallBody = new FormData();
    smallBody.set('kind', 'avatar');
    smallBody.set('file', new Blob([new Uint8Array(1024)]));
    const { req } = uploadReq({ contentLength: '0x989680', body: smallBody });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
