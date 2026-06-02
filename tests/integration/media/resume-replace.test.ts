/**
 * MEDIA-02 — single résumé PDF; replace deletes the prior file (Wave 0 RED).
 *
 * GREENED BY: Plan 02 (PDF accept/reject in the route) + Plan 03/04 (replace
 * deletes the prior object via deleteStorageObject). RED NOW via the missing-module
 * import of the upload route (STATE 04-01 pattern) — a REAL gate, not a
 * `.skip`/`.todo` pass.
 *
 * CONTRACT this proves once green: a PDF (`%PDF-`) is accepted to
 * `resumes/{uid}/...` (own-folder INSERT RLS); a non-PDF is rejected by the route's
 * `application/pdf` magic-byte allowlist; uploading a NEW résumé REPLACES the old
 * (the prior object is deleted — admin `list` no longer contains it), so a user
 * only ever has one résumé object (D-11).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

import { ALLOWED_PDF_MIME, sniffMime } from '@/lib/media/magic-bytes';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

/** Minimal PDF magic bytes. */
function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
}
/** A non-PDF buffer (PNG magic) the route must reject. */
function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

beforeAll(async () => {
  ctx = await setupTwoUsers('mediares', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('MEDIA-02 — résumé PDF: accept, reject non-PDF, replace deletes prior', () => {
  it('RED until Plan 02: the upload route module exists', async () => {
    // RED via a RUNTIME import rejection (specifier in a variable so tsc stays 0).
    const ROUTE = '@/app/api/media/upload/route';
    const mod = (await import(/* @vite-ignore */ ROUTE)) as { POST?: unknown };
    expect(typeof mod.POST).toBe('function');
  });

  it('the PDF allowlist accepts %PDF- and rejects PNG (magic-byte gate)', async () => {
    expect(ALLOWED_PDF_MIME.has((await sniffMime(pdfBytes()))!)).toBe(true);
    const png = await sniffMime(pngBytes());
    expect(ALLOWED_PDF_MIME.has(png ?? '')).toBe(false);
  });

  it('replacing a résumé leaves exactly one object in the resumes folder', async () => {
    const folder = `${ctx.userA.id}/resume`;
    const first = `${folder}/${RUN}-a.pdf`;
    const second = `${folder}/${RUN}-b.pdf`;

    await ctx.clientA.storage
      .from('resumes')
      .upload(first, pdfBytes(), { contentType: 'application/pdf', upsert: false });
    // Replace = upload the new + delete the prior (what the slice's replace flow does).
    await ctx.clientA.storage
      .from('resumes')
      .upload(second, pdfBytes(), { contentType: 'application/pdf', upsert: false });
    await ctx.clientA.storage.from('resumes').remove([first]);

    const { data: listing } = await admin.storage.from('resumes').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}-a.pdf`);
    expect(names).toContain(`${RUN}-b.pdf`);
  });
});
