/**
 * RED (Wave 0, 13.2-01) — SC-2 / D-07: the blog-post history trigger prunes to 5.
 *
 * Mirrors the section-history trigger (`save_section_history`, migration 002:542-568)
 * which snapshots the PRIOR `content` into `section_history` on UPDATE and prunes that
 * post's history to the most-recent 10. The blog equivalent (`save_blog_post_history`,
 * migration 017) snapshots the prior `body_md` into `blog_post_history` and prunes to
 * the most-recent 5 (D-07 cap = 5, NOT 10).
 *
 * Behavior under test (against the live local stack):
 *   - insert one `blog_posts` row;
 *   - UPDATE its `body_md` 7 times with DISTINCT bodies (7 prior-value snapshots);
 *   - assert `blog_post_history` holds EXACTLY 5 rows for that post (the trigger kept
 *     the 5 most-recent prior snapshots and pruned the 2 oldest).
 *
 * Runs against the live local Supabase stack (`fileParallelism:false`, the integration
 * project). Does NOT call `supabase db reset` (D-21 — the founder's local data is live);
 * cleanup is scoped to the single test user it provisions.
 *
 * RED today: migration 017 (the `blog_post_history` table + `save_blog_post_history`
 * trigger) and the `body_md` column do not exist yet — the INSERT/UPDATE error or the
 * history read returns no rows, so the "exactly 5" assertion fails. That IS the RED
 * state. Greened when 017 lands.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminClient, setupTwoUsers, teardownTwoUsers, type TwoUsers } from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;
let postId: string;

beforeAll(async () => {
  ctx = await setupTwoUsers('posthist', RUN);

  // Insert one published post for userA's portfolio (service-role; the trigger fires
  // regardless of which client writes — it is a DB-level BEFORE UPDATE OF body_md).
  const { data, error } = await admin
    .from('blog_posts')
    .insert({
      portfolio_id: ctx.portfolioA,
      slug: `hist-${RUN}`,
      title: 'History Probe',
      body_md: 'v0 — the initial body',
      published: true,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  postId = data!.id as string;
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('SC-2 / D-07 — blog_post_history prunes to 5 (not the sections trigger 10)', () => {
  it('keeps exactly 5 history rows after 7 distinct body_md updates', async () => {
    // 7 distinct updates → 7 prior-value snapshots; the trigger prunes to the most
    // recent 5.
    for (let v = 1; v <= 7; v++) {
      const { error } = await admin
        .from('blog_posts')
        .update({ body_md: `v${v} — distinct body revision ${v}` })
        .eq('id', postId);
      expect(error).toBeNull();
    }

    const { count, error } = await admin
      .from('blog_post_history')
      .select('id', { count: 'exact', head: true })
      .eq('blog_post_id', postId);
    expect(error).toBeNull();
    expect(count).toBe(5);
  });
});
