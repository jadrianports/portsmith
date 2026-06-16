// SET-04 — the settings write under RLS (owner vs cross-tenant), proven against the
// live local Supabase stack.
//
// `saveSettingsAction` writes via the AUTHENTICATED client under RLS (never
// service-role), keyed on the owner's portfolio_id. The action itself CANNOT run in
// the vitest `node` project — its first step (getVerifiedClaims → cookies() via
// next/headers) throws "outside a request scope" here, exactly as the section/profile
// save specs do. So we assert the action's EXISTENCE directly, and prove the
// INVARIANT it upholds at the SAME RLS boundary the action uses, via each user's
// authenticated anon-key client against the live stack.
//
// Behavior under test (RLS is THE tenant boundary):
//   - SET-01/03: user A's authenticated UPDATE of their OWN portfolio_settings
//     (email_public / socials / location / phone) SUCCEEDS and round-trips;
//   - SET-04: user A's UPDATE targeting B's settings changes NOTHING (0 rows — the
//     RLS USING clause filters them; assert via admin read-back, NEVER `.rejects`);
//   - SET-03: location/phone set-and-clear (value then '' / null) → null on read-back.
//
// THE ASYMMETRY (Pitfall 3): a blocked UPDATE silently affects 0 rows — assert "no
// row changed" via the service-role admin read-back, never `.rejects`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

import { saveSettingsAction } from '@/lib/cms/save-settings-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('cmssw', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

// SET-04
describe('SET-04 — portfolio_settings write under RLS (owner vs cross-tenant)', () => {
  it('A can UPDATE their OWN settings — socials/location/phone round-trip (SET-01/03)', async () => {
    // Reference the action so this spec is wired to the real save path (existence).
    expect(typeof saveSettingsAction).toBe('function');

    const socials = [{ platform: 'github', url: 'https://github.com/a' }];
    const { error } = await ctx.clientA
      .from('portfolio_settings')
      .update({
        email_public: 'a@example.com',
        socials,
        location: 'Remote',
        phone: '+1 555',
      })
      .eq('portfolio_id', ctx.portfolioA)
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('portfolio_settings')
      .select('email_public, socials, location, phone')
      .eq('portfolio_id', ctx.portfolioA)
      .single();
    expect(data!.email_public).toBe('a@example.com');
    expect(data!.socials).toEqual(socials);
    expect(data!.location).toBe('Remote');
    expect(data!.phone).toBe('+1 555');
  });

  it("A's UPDATE of B's settings changes nothing (cross-tenant REJECTED — 0 rows, SET-04)", async () => {
    // Seed a known baseline on B's row (via B's own client — the owner write).
    const baselineSocials = [{ platform: 'linkedin', url: 'https://linkedin.com/in/b' }];
    await ctx.clientB
      .from('portfolio_settings')
      .update({
        email_public: 'b@example.com',
        socials: baselineSocials,
        location: 'Berlin',
        phone: '+49 30',
      })
      .eq('portfolio_id', ctx.portfolioB);

    // A attempts to overwrite B's row. The `portfolio_settings own all` RLS policy
    // filters it to 0 rows — NO throw, the write is simply a no-op for the foreign
    // portfolio_id.
    await ctx.clientA
      .from('portfolio_settings')
      .update({
        email_public: 'hacked@example.com',
        socials: [{ platform: 'website', url: 'https://evil.example.com' }],
        location: 'HACKED',
        phone: 'HACKED',
      })
      .eq('portfolio_id', ctx.portfolioB);

    // B's row is UNCHANGED (the RLS tenant boundary held).
    const { data } = await admin
      .from('portfolio_settings')
      .select('email_public, socials, location, phone')
      .eq('portfolio_id', ctx.portfolioB)
      .single();
    expect(data!.email_public).toBe('b@example.com');
    expect(data!.socials).toEqual(baselineSocials);
    expect(data!.location).toBe('Berlin');
    expect(data!.phone).toBe('+49 30');
  });

  it('location/phone set-and-clear normalizes to null on save (SET-03, D-10)', async () => {
    // Set non-empty values, then clear them to null (the saveSettingsAction
    // empty→null normalization writes null; here we write null directly to prove the
    // column round-trips a cleared value).
    await ctx.clientA
      .from('portfolio_settings')
      .update({ location: 'Lisbon', phone: '+351 21' })
      .eq('portfolio_id', ctx.portfolioA);

    await ctx.clientA
      .from('portfolio_settings')
      .update({ location: null, phone: null })
      .eq('portfolio_id', ctx.portfolioA);

    const { data } = await admin
      .from('portfolio_settings')
      .select('location, phone')
      .eq('portfolio_id', ctx.portfolioA)
      .single();
    expect(data!.location).toBeNull();
    expect(data!.phone).toBeNull();
  });
});
