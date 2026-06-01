// PUB-01/02 — turned GREEN by 04-06 (publish/unpublish toggle + 404 chain).
// Threat ref: T-publish-gate.
//
// Wave-0 RED scaffold (04-01). INTENTIONALLY failing: imports the not-yet-built
// `setPublished` (publish) action so the import fails to resolve until 04-06 ships
// it (RED is the contract — 04-VALIDATION.md). The DB-level assertions describe the
// invariant the action must uphold; 04-06 turns this file GREEN.
//
// Behavior under test (the automatic 404 chain — PUB-02 needs no new read code):
//   - setting profiles.published=false makes portfolio_is_public() false → the
//     public_* views return NOTHING → the public read returns null (→ notFound()).
//   - re-publishing restores the public row.
//
// THE ASYMMETRY (01-RESEARCH Pitfall 3): a filtered view read returns
// `{ data: [], error: null }` (absent, not an error) → get-portfolio returns null.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  anonClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from '../_setup';
import { bootstrapPortfolioAs } from './_cms-fixtures';

// @ts-expect-error — RED: 04-06 creates this server action; module does not exist yet.
import { setPublished } from '@/lib/cms/publish-action';

const admin = adminClient();
const anon = anonClient();
const RUN = crypto.randomUUID().slice(0, 8);
const USERNAME = `cmspub${RUN}`.slice(0, 30);

let user: TestUser;

beforeAll(async () => {
  await sweepLeftoverTestUsers();
  user = await createTestUser({
    email: `${USERNAME}@example.test`,
    password: 'Test-Password-123!',
    username: USERNAME,
    display_name: 'CMS publish-404 User',
  });
  await bootstrapPortfolioAs(user);
  // Start published (service role bypasses the protected-cols trigger to flip it).
  const pub = await admin
    .from('profiles')
    .update({ published: true })
    .eq('id', user.id);
  expect(pub.error).toBeNull();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(user?.id);
});

describe('PUB-01/02 — unpublish makes the public read return null (404)', () => {
  it('published profile is visible via public_profiles', async () => {
    expect(typeof setPublished).toBe('function');
    const { data, error } = await anon
      .from('public_profiles')
      .select('username')
      .eq('username', USERNAME);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('setting published=false yields a length-0 public read (the 404 chain)', async () => {
    const { error } = await admin
      .from('profiles')
      .update({ published: false })
      .eq('id', user.id);
    expect(error).toBeNull();

    const { data, error: readErr } = await anon
      .from('public_profiles')
      .select('username')
      .eq('username', USERNAME);
    expect(readErr).toBeNull();
    expect(data).toHaveLength(0); // absent, not an error → notFound()

    // Restore for a clean teardown.
    await admin.from('profiles').update({ published: true }).eq('id', user.id);
  });
});
