/**
 * CONT-02 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-05-T1.
 *
 * Live-stack proof of the inbox tenant boundary (Pitfall 7): the inbox is an OWNER
 * read/write under RLS via the AUTHENTICATED client — NEVER service-role (which
 * would bypass isolation) and never the anon client (revoked). The `messages own
 * select/update/delete` policies (004) scope every op to the owner's portfolio:
 *   - owner A reads / marks-read / deletes ONLY their OWN messages via `clientA`
 *     (signed in as A);
 *   - user B's AUTHENTICATED client sees 0 of A's messages (cross-tenant denied).
 *
 * Seeding uses the SERVICE-ROLE admin (the route's write path) to create A's
 * messages — but every ASSERTION about the inbox uses `clientA`/`clientB`
 * (authenticated), never `adminClient()`, exactly as the inbox surface must.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * The cross-tenant / own-only RLS holds on the current foundation. The RED half is
 * the inbox read helper the slice ships: `getInboxMessages` from the not-yet-
 * existing `@/lib/cms/inbox`, imported at RUNTIME via the [05-01] variable
 * specifier (tsc stays 0; ERR_MODULE_NOT_FOUND until 06-05). Reuses `_setup.ts`
 * via `_cms-fixtures` — no hand-rolled clients.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
const TAG = `inbox-rls-${RUN}`;

const INBOX = '@/lib/cms/inbox';

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('inbox', RUN);
  // Seed two messages addressed to A's portfolio via the service-role write path.
  const { error } = await admin.from('messages').insert([
    {
      portfolio_id: ctx.portfolioA,
      sender_name: 'One',
      sender_email: 'one@example.test',
      subject: 'Hi A',
      body: `${TAG}-1`,
    },
    {
      portfolio_id: ctx.portfolioA,
      sender_name: 'Two',
      sender_email: 'two@example.test',
      subject: 'Hi again A',
      body: `${TAG}-2`,
    },
  ]);
  expect(error).toBeNull();
}, 30_000);

afterAll(async () => {
  await admin.from('messages').delete().like('body', `${TAG}%`);
  await teardownTwoUsers(ctx);
});

describe('CONT-02 — inbox RLS isolation (authenticated client, never service-role)', () => {
  it("owner A reads only their OWN messages via the AUTHENTICATED clientA", async () => {
    const { data, error } = await ctx.clientA
      .from('messages')
      .select('id, body')
      .like('body', `${TAG}%`);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(2);
  });

  it("user B's AUTHENTICATED client sees 0 of A's messages (cross-tenant denied)", async () => {
    const { data, error } = await ctx.clientB
      .from('messages')
      .select('id')
      .like('body', `${TAG}%`);
    expect(error).toBeNull(); // RLS filters rows out (absent, not an error)
    expect((data ?? []).length).toBe(0);
  });

  it('owner A can mark-read (UPDATE is_read) their OWN message under RLS', async () => {
    const { data: rows } = await ctx.clientA
      .from('messages')
      .select('id')
      .eq('body', `${TAG}-1`);
    const id = (rows ?? [])[0]?.id as string;
    expect(id).toBeTruthy();
    const { error } = await ctx.clientA
      .from('messages')
      .update({ is_read: true })
      .eq('id', id);
    expect(error).toBeNull();
    const { data } = await admin
      .from('messages')
      .select('is_read')
      .eq('id', id)
      .single();
    expect(data!.is_read).toBe(true);
  });

  it("user B CANNOT delete A's message (cross-tenant DELETE affects 0 rows)", async () => {
    await ctx.clientB.from('messages').delete().eq('body', `${TAG}-2`);
    const { data } = await admin
      .from('messages')
      .select('id')
      .eq('body', `${TAG}-2`);
    expect((data ?? []).length).toBe(1); // still present — B could not touch it
  });

  it('owner A can delete their OWN message under RLS', async () => {
    const { error } = await ctx.clientA
      .from('messages')
      .delete()
      .eq('body', `${TAG}-2`);
    expect(error).toBeNull();
    const { data } = await admin
      .from('messages')
      .select('id')
      .eq('body', `${TAG}-2`);
    expect((data ?? []).length).toBe(0);
  });

  it('exposes the authenticated inbox read helper (RED until 06-05)', async () => {
    const mod = (await import(/* @vite-ignore */ INBOX)) as {
      getInboxMessages?: unknown;
    };
    expect(typeof mod.getInboxMessages).toBe('function');
  });
});
