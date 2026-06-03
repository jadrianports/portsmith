/**
 * WR-03 — server-recomputed media-delete set (D-09 / D-10 / MEDIA-04).
 *
 * GREENED BY: Plan 08-05 (`serverDroppedItemImageUrls` + the `saveSectionAction`
 * rewrite that recomputes the delete set from prior persisted `content.items`
 * instead of trusting a client `deleteUrls`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXECUTION PATH (the committed shape — resolves the request-scope ambiguity).
 * `saveSectionAction` reads `next/headers` and runs the server-action runtime,
 * which the vitest `integration` project cannot supply (it aliases `server-only`
 * to a no-op stub and runs no Next request scope — vitest.config.ts). So this test
 * exercises the server-recompute the EXACT way `saveSectionAction` does:
 *
 *   1. compute the dropped set with `serverDroppedItemImageUrls(type, prior, next)`
 *      — the SAME helper the action calls between the RLS read and the delete loop;
 *   2. feed each result URL to `deleteStorageObject(url, userA.id)` with the
 *      SERVER-TRUSTED owner id (never a client-supplied list).
 *
 * The complementary proof that `saveSectionAction` ITSELF no longer accepts/uses a
 * client `deleteUrls` is the SOURCE assertion in Plan 08-05 Task 2 (the field is
 * removed from `SaveSectionInput`; the client-list loop is gone). The two together
 * cover the full WR-03 contract: helper correctness + the recompute effect HERE,
 * the action-boundary trust model in Task 2.
 *
 * This proves (against the live local stack):
 *   - DROP-ONE-KEEP-ONE: a section with TWO item images, saved with content that
 *     drops ONE, deletes ONLY the dropped object; the KEPT object survives.
 *   - FORGED-LIST-IGNORED: a forged "client delete hint" naming the KEPT (or own)
 *     URL is NEVER in the server-recomputed dropped set — the kept object is never
 *     deleted regardless of any client-supplied hint (the client cannot influence
 *     deletions; T-08-05-01).
 *   - OWN-FOLDER BOUNDARY (D-10): a cross-tenant / foreign-folder URL reached via
 *     `deleteStorageObject` is REJECTED by the own-folder guard (defense-in-depth;
 *     T-08-05-02), mirroring orphan-delete's OPTION B BOUNDARY case.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

import { serverDroppedItemImageUrls } from '@/lib/cms/section-media-diff';
import { deleteStorageObject } from '@/lib/media/delete-object';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

/** Minimal WebP magic bytes (a real item-image object the route would store). */
function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
  ]);
}

/** Build the public Storage URL for a media-bucket object path (what the helper parses). */
function publicMediaUrl(path: string): string {
  return admin.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** A projects-shaped section content carrying the given item-image URLs (alt set
 *  so the shape mirrors a real validated content; the diff only reads `.image`). */
function projectsContent(images: string[]) {
  return {
    heading: 'Projects',
    items: images.map((image, i) => ({
      id: `p${i}`,
      slug: `p${i}`,
      title: `Project ${i}`,
      description: '',
      image,
      image_alt: 'a screenshot',
      tech_stack: [],
      live_url: '',
      repo_url: '',
    })),
  };
}

beforeAll(async () => {
  ctx = await setupTwoUsers('mediadiff', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('WR-03 — saveSectionAction server-recomputes the delete set from prior content', () => {
  it('GREEN: the server diff helper exists', async () => {
    const HELPER = '@/lib/cms/section-media-diff';
    const mod = (await import(/* @vite-ignore */ HELPER)) as {
      serverDroppedItemImageUrls?: unknown;
    };
    expect(typeof mod.serverDroppedItemImageUrls).toBe('function');
  });

  it('DROP-ONE-KEEP-ONE: dropping one of two item images deletes ONLY that object', async () => {
    // Seed two REAL uploaded item images under the owner's media folder (the
    // service-role upload path the route uses), mirroring orphan-delete.
    const folder = `${ctx.userA.id}/project`;
    const keepPath = `${folder}/${RUN}-keep.webp`;
    const dropPath = `${folder}/${RUN}-drop.webp`;

    const { error: keepErr } = await admin.storage
      .from('media')
      .upload(keepPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(keepErr).toBeNull();
    const { error: dropErr } = await admin.storage
      .from('media')
      .upload(dropPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(dropErr).toBeNull();

    const keepUrl = publicMediaUrl(keepPath);
    const dropUrl = publicMediaUrl(dropPath);

    // PRIOR persisted content references BOTH images; NEXT (validated) content keeps
    // only `keepUrl` (the user removed/replaced the other item). The action computes
    // the dropped set from prior-vs-next — exactly this call.
    const prior = projectsContent([keepUrl, dropUrl]);
    const next = projectsContent([keepUrl]);
    const dropped = serverDroppedItemImageUrls('projects', prior, next);

    // The server recompute targets ONLY the genuinely-dropped URL.
    expect(dropped).toEqual([dropUrl]);

    // Apply the action's delete loop with the SERVER-TRUSTED owner id.
    for (const url of dropped) {
      await deleteStorageObject(url, ctx.userA.id);
    }

    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}-drop.webp`); // the dropped object is GONE
    expect(names).toContain(`${RUN}-keep.webp`); // the kept object SURVIVES

    // Cleanup the surviving kept object.
    await admin.storage.from('media').remove([keepPath]);
  });

  it('FORGED-LIST-IGNORED: a forged client hint naming the KEPT URL has NO effect', async () => {
    // Seed the kept object again for this case (independent of the prior `it`).
    const folder = `${ctx.userA.id}/project`;
    const keepPath = `${folder}/${RUN}-forge.webp`;
    const { error: upErr } = await admin.storage
      .from('media')
      .upload(keepPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();
    const keepUrl = publicMediaUrl(keepPath);

    // The user KEEPS the image (prior === next references the same URL), so the
    // server-recomputed dropped set is EMPTY — nothing is genuinely dropped.
    const prior = projectsContent([keepUrl]);
    const next = projectsContent([keepUrl]);
    const dropped = serverDroppedItemImageUrls('projects', prior, next);

    // A malicious owner forges a "delete this" hint for the KEPT (own) URL — the
    // exact T-08-05-01 attack (delete an own object out from under the section).
    // The server NEVER consults a client list: there is no `deleteUrls` field, and
    // the recomputed set is derived solely from prior-vs-next. The forged URL is
    // therefore ABSENT from the dropped set, so it is never passed to the delete.
    const forgedDeleteUrls = [keepUrl];
    expect(dropped).toEqual([]);
    for (const forged of forgedDeleteUrls) {
      expect(dropped).not.toContain(forged);
    }

    // Run the action's delete loop on the SERVER-RECOMPUTED set (not the forged
    // list) — nothing is deleted.
    for (const url of dropped) {
      await deleteStorageObject(url, ctx.userA.id);
    }

    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).toContain(`${RUN}-forge.webp`); // the kept/own object is STILL there

    // Cleanup.
    await admin.storage.from('media').remove([keepPath]);
  });

  it('OWN-FOLDER BOUNDARY (D-10): a cross-tenant URL is REJECTED even if reached', async () => {
    // Defense-in-depth: even if a foreign-folder URL somehow reached the delete
    // loop, deleteStorageObject's own-folder guard (path[0] === ownerSub) rejects
    // it. User B uploads in B's folder; A's verified sub cannot delete it.
    const bFolder = `${ctx.userB.id}/project`;
    const bPath = `${bFolder}/${RUN}-b.webp`;
    const { error: upErr } = await admin.storage
      .from('media')
      .upload(bPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    // Attempt the delete with A's server-verified sub — the guard rejects it.
    await deleteStorageObject(publicMediaUrl(bPath), ctx.userA.id);

    const { data: listing } = await admin.storage.from('media').list(bFolder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).toContain(`${RUN}-b.webp`); // B's object was NOT steered cross-tenant

    // Cleanup B's object via admin (intentionally left undeleted by the guard).
    await admin.storage.from('media').remove([bPath]);
  });
});
