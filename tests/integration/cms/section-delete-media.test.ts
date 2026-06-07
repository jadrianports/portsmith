/**
 * 13.1-01 (Wave 0, Nyquist) — D-05: removing a section FREES its media + decrements
 * `storage_used_bytes`.
 *
 * GREENED BY:
 *   - Plan 13.1-02 EXTENDS `section-media-diff.ts`'s `IMAGE_FIELDS` to cover the
 *     section-level image fields (`about.avatar`, `hero.background_image`) +
 *     `moodboard.items[].image` (RESEARCH Pitfall 1). TODAY the helper reads ONLY
 *     `content.items[]` for `projects`/`testimonials` — so diffing an `about`
 *     section against empty next-content returns `[]` and the avatar object is
 *     NEVER freed. THAT is this test's impl-driven RED.
 *   - The Wave-1 `removeSectionAction` plan wires the row DELETE (authenticated RLS)
 *     + the media-free leg (`serverDroppedItemImageUrls(type, prior, {})` →
 *     `deleteStorageObject`) the assertions below mirror.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE HARNESS FACT (mirrors media/section-media-diff.test.ts + orphan-delete.test.ts):
 * `removeSectionAction` reads `next/headers` / runs the action runtime the `node`
 * project can't supply. So this test exercises the media-free leg the EXACT way the
 * action does:
 *   1. seed a section whose `content` references a REAL uploaded object (service-role
 *      upload, the route's write client) under the owner's folder;
 *   2. compute the delete set with `serverDroppedItemImageUrls(type, prior, {})` —
 *      diff against EMPTY next-content so EVERY referenced image drops (RESEARCH
 *      §Open Q4 — the section-delete shape);
 *   3. feed each URL to `deleteStorageObject(url, userA.id)` (the service-role leg,
 *      the ONLY service-role use in remove — gated by the own-folder guard).
 * Then assert the object is GONE (admin list) AND `storage_used_bytes` decremented
 * (admin read-back; the `sync_storage_usage` AFTER-DELETE trigger).
 *
 * Section-row DELETE alone does NOT free Storage (RESEARCH Pitfall 3 — `sections`
 * cascades only to `section_history`); the explicit media-free leg is the ONLY
 * mechanism. This file pins that contract.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

import { serverDroppedItemImageUrls } from '@/lib/cms/section-media-diff';
import { deleteStorageObject } from '@/lib/media/delete-object';

// The future remove action under contract — runtime specifier (tsc 0); the RLS row
// DELETE + media-free leg are proven by the authenticated client + the real helpers.
const REMOVE_ACTION = '@/lib/cms/remove-section-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

/** Minimal valid 20-byte WebP container (Supabase derives metadata.size from length). */
function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
  ]);
}

/** Build the public media-bucket URL for an object path (what the helper parses). */
function publicMediaUrl(path: string): string {
  return admin.storage.from('media').getPublicUrl(path).data.publicUrl;
}

beforeAll(async () => {
  ctx = await setupTwoUsers('cmsdelm', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('13.1-01 — D-05: section delete frees media + decrements storage_used_bytes', () => {
  it('exposes the removeSectionAction the GREEN plan drives', async () => {
    const mod = (await import(/* @vite-ignore */ REMOVE_ACTION)) as {
      removeSectionAction?: unknown;
    };
    expect(typeof mod.removeSectionAction).toBe('function');
  });

  it('deleting an `about` section frees its section-level avatar object (Pitfall 1 / IMAGE_FIELDS extension)', async () => {
    // 1) Upload a REAL avatar object under the owner's folder (the trigger increments
    //    storage_used_bytes on the service-role upload).
    const folder = `${ctx.userA.id}/avatar`;
    const path = `${folder}/${RUN}-about.webp`;
    const { error: upErr } = await admin.storage
      .from('media')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();
    const avatarUrl = publicMediaUrl(path);

    // Usage is now NON-ZERO (the upload trigger fired).
    const { data: before } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    const usedBefore = Number(before!.storage_used_bytes ?? 0);
    expect(usedBefore).toBeGreaterThan(0);

    // 2) The `about` section's PRIOR content references the avatar at the SECTION
    //    level (`content.avatar`, NOT `content.items[]`). The remove action diffs it
    //    against EMPTY next-content so every referenced image drops.
    const priorContent = {
      bio: 'About me',
      skills: [],
      avatar: avatarUrl,
      avatar_alt: 'A portrait',
    };
    const dropped = serverDroppedItemImageUrls('about', priorContent, {});

    // RED until Plan 13.1-02 extends IMAGE_FIELDS for the section-level `about.avatar`:
    // today `imageUrlsOf` reads ONLY content.items[] for projects/testimonials, so the
    // section-level avatar is INVISIBLE to the diff and `dropped` is []. The contract:
    // the avatar URL MUST be in the delete set so the remove action frees it.
    expect(dropped).toContain(avatarUrl);

    // 3) The remove action's media-free leg — service-role delete with the verified sub.
    for (const url of dropped) {
      await deleteStorageObject(url, ctx.userA.id);
    }

    // The avatar object is GONE.
    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}-about.webp`);

    // storage_used_bytes decremented (the AFTER-DELETE trigger fired under service_role).
    const { data: after } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(after!.storage_used_bytes ?? 0)).toBeLessThan(usedBefore);
  });

  it('deleting a `moodboard` section frees its gallery item images (items[].image extension)', async () => {
    // The moodboard gallery lives in content.items[] (like projects/testimonials), but
    // `moodboard` is NOT in today's IMAGE_FIELDS — so the diff misses it too. Plan
    // 13.1-02 adds `moodboard: ['image']`.
    const folder = `${ctx.userA.id}/moodboard`;
    const path = `${folder}/${RUN}-mb.webp`;
    const { error: upErr } = await admin.storage
      .from('media')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();
    const galleryUrl = publicMediaUrl(path);

    const priorContent = {
      heading: 'Moodboard',
      items: [{ id: 'mb1', image: galleryUrl, image_alt: 'A swatch', caption: '' }],
    };
    const dropped = serverDroppedItemImageUrls('moodboard', priorContent, {});

    // RED until Plan 13.1-02 adds `moodboard` to IMAGE_FIELDS.
    expect(dropped).toContain(galleryUrl);

    for (const url of dropped) {
      await deleteStorageObject(url, ctx.userA.id);
    }
    const { data: listing } = await admin.storage.from('media').list(folder);
    expect((listing ?? []).map((o) => o.name)).not.toContain(`${RUN}-mb.webp`);
  });
});
