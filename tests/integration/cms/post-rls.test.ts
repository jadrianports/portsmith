/**
 * RED (Wave 0, 13.2-01) — SC-2: the blog-post write under RLS (the SHARED-A
 * cross-tenant invariant, applied to `blog_posts`).
 *
 * The exact analog of `rls-write.test.ts` (sections), applied to the blog-post write
 * path: RLS is THE tenant boundary. A post write goes through the AUTHENTICATED client
 * under the `blog_posts` `*.own_all` policy (never service-role), so:
 *   - userA's authenticated UPDATE on their OWN post SUCCEEDS (1 row changed);
 *   - userB's UPDATE targeting userA's post is REJECTED — the policy's USING clause
 *     filters it to 0 rows (no error is thrown; the row is simply untouched).
 *
 * THE ASYMMETRY (the same pitfall rls-write.test.ts documents): a blocked UPDATE
 * silently affects 0 rows, so we assert "no row changed" by reading the row back with
 * the service-role admin client — never via `.rejects`.
 *
 * Runs against the live local Supabase stack (`fileParallelism:false`, the integration
 * project). Does NOT call `supabase db reset` (D-21); cleanup is scoped to the two test
 * users it provisions.
 *
 * RED today: `blog_posts` has not yet been reconciled to the `body_md` Markdown shape
 * (migration 017) — the INSERT/UPDATE on `body_md` errors, so the owner-succeeds
 * assertion fails. That IS the RED state. Greened when 017 reconciles the table and
 * the RLS policies cover it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminClient, setupTwoUsers, teardownTwoUsers, type TwoUsers } from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;
let postA: string;

beforeAll(async () => {
  ctx = await setupTwoUsers('postrls', RUN);

  // Seed one post owned by userA (service-role insert; ownership is via portfolio_id).
  const { data, error } = await admin
    .from('blog_posts')
    .insert({
      portfolio_id: ctx.portfolioA,
      slug: `rls-${RUN}`,
      title: 'RLS Probe',
      body_md: 'A owns this post body.',
      published: true,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  postA = data!.id as string;
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('SC-2 — blog_posts write under RLS (owner vs cross-tenant)', () => {
  it('A can UPDATE their OWN post', async () => {
    const { error } = await ctx.clientA
      .from('blog_posts')
      .update({ body_md: 'A edited their own body.' })
      .eq('id', postA)
      .select();
    expect(error).toBeNull();

    const { data } = await admin.from('blog_posts').select('body_md').eq('id', postA).single();
    expect(data!.body_md).toBe('A edited their own body.');
  });

  it("B's UPDATE of A's post changes nothing (cross-tenant REJECTED — 0 rows)", async () => {
    await ctx.clientB
      .from('blog_posts')
      .update({ body_md: 'B HACKED this body.' })
      .eq('id', postA);

    const { data } = await admin.from('blog_posts').select('body_md').eq('id', postA).single();
    expect(data!.body_md).not.toBe('B HACKED this body.');
    expect(data!.body_md).toBe('A edited their own body.');
  });
});
