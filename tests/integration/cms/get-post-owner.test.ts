/**
 * BLOG-01 / D-01 — the lazy single-post owner read (`getOwnerPostById`) RLS coverage.
 *
 * `getOwnerPostById` (get-posts-owner.ts) is the body-carrying counterpart to the
 * body-less owner LIST read: it returns the FULL editable post (incl. `body_md`) for
 * ONE id so the editor can hydrate a post that the list deliberately omits the body
 * from. The security invariant (T-26-04 — cross-tenant body leak): it reads the BASE
 * `blog_posts` table under the `blog_posts.own_all` RLS policy via the AUTHENTICATED
 * client, so `.eq('id', postId)` on a FOREIGN id reads 0 rows → null (no body leak).
 *
 * Like `owner-preview-read.test.ts`, the read itself calls `getClaims()→cookies()`,
 * which has NO request scope under the vitest node project — so these assertions run
 * at the base-table level via the two signed-in anon clients, exercising the EXACT
 * `POST_EDIT_COLUMNS` projection + `.eq('id', …)` filter the read maps over. That
 * proves the SQL truth the function relies on:
 *   - owner A reading their OWN post id gets the full row incl. the known `body_md`;
 *   - owner B reading A's post id gets 0 rows (RLS USING clause) → no body leak.
 *
 * Runs against the live local Supabase stack (the integration project). Does NOT call
 * `supabase db reset` (D-21); cleanup is scoped to the two users it provisions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminClient, setupTwoUsers, teardownTwoUsers, type TwoUsers } from './_cms-fixtures';

// The import must resolve cleanly (the read added in 26-02 Task 1 exists).
import { getOwnerPostById } from '@/lib/portfolio/get-posts-owner';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

/** The exact projection `getOwnerPostById` selects — kept in lock-step with the read. */
const POST_EDIT_COLUMNS = 'id, title, slug, body_md, excerpt, display_date, tags, published';

const KNOWN_BODY = `A's saved body ${RUN} — the editor must hydrate this, never blank.`;

let ctx: TwoUsers;
let postA: string;

beforeAll(async () => {
  ctx = await setupTwoUsers('getpostowner', RUN);

  // Seed one post owned by userA with a KNOWN body_md (service-role insert; ownership
  // is via portfolio_id).
  const { data, error } = await admin
    .from('blog_posts')
    .insert({
      portfolio_id: ctx.portfolioA,
      slug: `gpo-${RUN}`,
      title: 'Owner Read Probe',
      body_md: KNOWN_BODY,
      excerpt: 'A teaser',
      tags: ['alpha', 'beta'],
      published: false, // a DRAFT — must still be editable via the base-table read.
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  postA = data!.id as string;
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('BLOG-01 — getOwnerPostById: own full row (incl. body_md); cross-tenant → null', () => {
  it('exports the single-post owner read', () => {
    expect(typeof getOwnerPostById).toBe('function');
  });

  it('owner A reads their OWN draft post incl. the saved body_md (full editable row)', async () => {
    const { data, error } = await ctx.clientA
      .from('blog_posts')
      .select(POST_EDIT_COLUMNS)
      .eq('id', postA)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    // The body the list omits is present — exactly what the editor hydrates.
    expect(data!.body_md).toBe(KNOWN_BODY);
    expect(data!.excerpt).toBe('A teaser');
    expect(data!.tags).toEqual(['alpha', 'beta']);
    expect(data!.published).toBe(false); // a draft is editable
  });

  it('owner B reading A’s post id gets 0 rows → null (T-26-04: no body leak)', async () => {
    const { data, error } = await ctx.clientB
      .from('blog_posts')
      .select(POST_EDIT_COLUMNS)
      .eq('id', postA)
      .maybeSingle();
    // RLS USING clause filters the foreign row out — no error, just no row → null.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
