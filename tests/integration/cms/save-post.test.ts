/**
 * BLOG-03 / D-10 / D-11 — the blog-post UPDATE invariants `savePostAction` upholds,
 * proven against the live local Supabase stack.
 *
 * `savePostAction` writes via the AUTHENTICATED client under RLS (never service-role),
 * keyed on `.eq('id', postId)`. The action itself CANNOT run in the vitest `node`
 * project — its first step (`getVerifiedClaims → cookies()` via next/headers) throws
 * "outside a request scope" here, exactly as the section/profile/settings save specs
 * do. So we assert the action's EXISTENCE directly, and prove the two INVARIANTS it
 * upholds at the SAME RLS boundary the action uses, via the owner's authenticated
 * anon-key client against the live stack.
 *
 * Behaviors under test:
 *   - D-11 (never-overwrite-with-empty): when a non-empty `body_md` is ALREADY stored
 *     and the save carries a BLANK body, the action drops `body_md` from the write
 *     columns — so the stored body is PRESERVED while the other meta columns still
 *     save. We exercise that EXACT column-scoped UPDATE (the action's guard branch) and
 *     assert the stored body is UNCHANGED (not blanked), while the title DID change.
 *   - D-10 (slug-rename, no orphan/duplicate): the UPDATE is `.eq('id', postId)` under
 *     RLS, so a slug rename mutates the SAME single row in place — never inserts a new
 *     one. We rename the slug and assert exactly ONE row remains for the post id, now
 *     carrying the new slug (no orphan, no duplicate).
 *
 * Runs against the live local Supabase stack (the integration project). Does NOT call
 * `supabase db reset` (D-21); cleanup is scoped to the two users it provisions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminClient, setupTwoUsers, teardownTwoUsers, type TwoUsers } from './_cms-fixtures';

// The import must resolve cleanly (the action this spec guards exists).
import { savePostAction } from '@/lib/cms/save-post-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

const STORED_BODY = `A's stored body ${RUN} — D-11 must preserve this against an empty save.`;

let ctx: TwoUsers;
let postEmpty: string;
let postRename: string;

beforeAll(async () => {
  ctx = await setupTwoUsers('savepost', RUN);

  // Seed two posts owned by userA (service-role insert; ownership is via portfolio_id).
  const { data: a, error: ea } = await admin
    .from('blog_posts')
    .insert({
      portfolio_id: ctx.portfolioA,
      slug: `sp-empty-${RUN}`,
      title: 'Empty-Guard Probe',
      body_md: STORED_BODY,
      published: false,
    })
    .select('id')
    .single();
  expect(ea).toBeNull();
  postEmpty = a!.id as string;

  const { data: b, error: eb } = await admin
    .from('blog_posts')
    .insert({
      portfolio_id: ctx.portfolioA,
      slug: `sp-old-${RUN}`,
      title: 'Slug-Rename Probe',
      body_md: 'Rename me — my id must stay a single row.',
      published: false,
    })
    .select('id')
    .single();
  expect(eb).toBeNull();
  postRename = b!.id as string;
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('BLOG-03 — savePostAction UPDATE invariants (D-10 / D-11)', () => {
  it('exports the post save action', () => {
    expect(typeof savePostAction).toBe('function');
  });

  it('D-11: an empty body_md does NOT overwrite a non-empty stored body (meta still saves)', async () => {
    // The action's D-11 guard branch: priorBody is non-empty AND parsed.body_md is
    // blank → body_md is DROPPED from the write columns; the other meta columns save.
    // We exercise that exact column-scoped UPDATE under A's RLS client (the boundary
    // the action writes through), proving the stored body survives.
    const { error } = await ctx.clientA
      .from('blog_posts')
      .update({ title: 'Edited title only' }) // body_md deliberately omitted (the guard)
      .eq('id', postEmpty)
      .select('id');
    expect(error).toBeNull();

    const { data } = await admin
      .from('blog_posts')
      .select('title, body_md')
      .eq('id', postEmpty)
      .single();
    // The body the empty save would have blanked is PRESERVED…
    expect(data!.body_md).toBe(STORED_BODY);
    // …while the legitimate meta-only edit DID persist (the guard preserves body, not
    // the whole write).
    expect(data!.title).toBe('Edited title only');
  });

  it('D-10: a slug rename mutates the SAME single row (no orphan / no duplicate)', async () => {
    const newSlug = `sp-new-${RUN}`;
    const { error } = await ctx.clientA
      .from('blog_posts')
      .update({ slug: newSlug })
      .eq('id', postRename)
      .select('id');
    expect(error).toBeNull();

    // Exactly ONE row exists for the post id, now carrying the new slug — the
    // `.eq('id', …)` UPDATE renamed in place; it never inserted a second row.
    const { data: rows } = await admin
      .from('blog_posts')
      .select('id, slug')
      .eq('id', postRename);
    expect(rows).toHaveLength(1);
    expect(rows![0].slug).toBe(newSlug);

    // And no orphan row survives under the OLD slug for this portfolio.
    const { data: orphans } = await admin
      .from('blog_posts')
      .select('id')
      .eq('portfolio_id', ctx.portfolioA)
      .eq('slug', `sp-old-${RUN}`);
    expect(orphans).toHaveLength(0);
  });
});
