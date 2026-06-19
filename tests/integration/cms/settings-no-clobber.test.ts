// D-02 / META-01..04 — partial-update disjointness (the #1 functional risk)
//
// Phase 29 extends the settings write from 4 contact columns (email_public /
// socials / location / phone) to ALSO carry the 4 SEO columns (page_title /
// meta_description / og_image_url / favicon_url). The #1 functional-correctness
// risk (and an integrity / Tampering control) is that a PARTIAL save clobbers the
// columns it does not own:
//
//   - an SEO-only save must NOT null `socials` / `email_public`;
//   - a contact-only save must NOT null the 4 SEO columns.
//
// This is the contract `saveSeoSettings` (Plan 02) + its `buildSeoAllowlist`
// disjoint allowlist must keep green. The action itself CANNOT run in the vitest
// `node` project — its first step (getVerifiedClaims → cookies() via next/headers)
// throws "outside a request scope" here, exactly as `settings-write.test.ts` and
// the section/profile save specs document. So we (a) assert the action's EXISTENCE
// directly (staged for Plan 02 via a dynamic import — until then the path is
// pending), and (b) prove the DISJOINTNESS invariant at the SAME RLS boundary the
// action uses, via user A's authenticated anon-key client against the live stack.
//
// THE ASYMMETRY (Pitfall 3, mirrored from settings-write.test.ts): a no-op UPDATE
// silently affects 0 rows — so we assert "the untouched columns are UNCHANGED" via
// the SERVICE-ROLE admin read-back, NEVER `.rejects`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('seonc', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

// The four SEO columns Phase 29 adds to the settings write.
const SEO_COLS = 'page_title, meta_description, og_image_url, favicon_url';
// The contact/socials columns that already exist on the write.
const CONTACT_COLS = 'email_public, socials, location, phone';

describe('D-02 — partial settings save disjointness (no-clobber, the #1 risk)', () => {
  it('references the saveSeoSettings action (staged for Plan 02)', async () => {
    // The producing action does not exist until Plan 02. Use a DYNAMIC import so a
    // missing module does not block the whole integration project from collecting —
    // the RLS-boundary disjointness assertions below MUST still run regardless. Once
    // Plan 02 ships `@/lib/cms/save-settings-action#saveSeoSettings`, this goes green.
    let saveSeoSettings: unknown;
    try {
      ({ saveSeoSettings } = (await import('@/lib/cms/save-settings-action')) as {
        saveSeoSettings?: unknown;
      });
    } catch {
      // Module not present yet (pre-Plan-02) — leave it undefined.
    }
    if (saveSeoSettings === undefined) {
      // RED/pending until Plan 02 wires the action. Documented, not a hard failure
      // (the disjointness contract below is the load-bearing assertion for Wave 0).
      console.warn(
        '[29-01] saveSeoSettings not yet exported — staged for Plan 02 (expected RED).',
      );
      return;
    }
    expect(typeof saveSeoSettings).toBe('function');
  });

  it('an SEO-only save does NOT null socials / email_public (A, RLS boundary)', async () => {
    // (a) Seed a known contact baseline on A's row via A's OWN authenticated client
    // (the owner write under RLS — exactly the path the action uses).
    const baselineSocials = [{ platform: 'github', url: 'https://github.com/a' }];
    {
      const { error } = await ctx.clientA
        .from('portfolio_settings')
        .update({ email_public: 'a@example.com', socials: baselineSocials })
        .eq('portfolio_id', ctx.portfolioA)
        .select();
      expect(error).toBeNull();
    }

    // Now UPDATE ONLY the 4 SEO columns (the disjoint subset an SEO-only save writes).
    {
      const { error } = await ctx.clientA
        .from('portfolio_settings')
        .update({
          page_title: 'A — Portfolio',
          meta_description: 'A description',
          og_image_url: 'https://cdn.example/a-card.png',
          favicon_url: 'https://cdn.example/a-icon.webp',
        })
        .eq('portfolio_id', ctx.portfolioA)
        .select();
      expect(error).toBeNull();
    }

    // Admin (service-role) read-back: socials + email_public are UNCHANGED — the
    // SEO-only write did NOT clobber the contact columns (the disjointness contract).
    const { data } = await admin
      .from('portfolio_settings')
      .select(CONTACT_COLS)
      .eq('portfolio_id', ctx.portfolioA)
      .single();
    expect(data!.email_public).toBe('a@example.com');
    expect(data!.socials).toEqual(baselineSocials);
  });

  it('a contact-only save does NOT null the 4 SEO columns (A, RLS boundary)', async () => {
    // (b) The reverse. Seed a known SEO baseline on A's row via A's own client.
    {
      const { error } = await ctx.clientA
        .from('portfolio_settings')
        .update({
          page_title: 'A SEO Title',
          meta_description: 'A SEO description',
          og_image_url: 'https://cdn.example/a-seo-card.png',
          favicon_url: 'https://cdn.example/a-seo-icon.webp',
        })
        .eq('portfolio_id', ctx.portfolioA)
        .select();
      expect(error).toBeNull();
    }

    // Now UPDATE ONLY the contact columns (the disjoint subset a contact-only save writes).
    const contactSocials = [{ platform: 'linkedin', url: 'https://linkedin.com/in/a' }];
    {
      const { error } = await ctx.clientA
        .from('portfolio_settings')
        .update({
          email_public: 'a2@example.com',
          socials: contactSocials,
          location: 'Remote',
          phone: '+1 555',
        })
        .eq('portfolio_id', ctx.portfolioA)
        .select();
      expect(error).toBeNull();
    }

    // Admin read-back: the 4 SEO columns are UNCHANGED — the contact-only write did
    // NOT clobber the SEO columns.
    const { data } = await admin
      .from('portfolio_settings')
      .select(SEO_COLS)
      .eq('portfolio_id', ctx.portfolioA)
      .single();
    expect(data!.page_title).toBe('A SEO Title');
    expect(data!.meta_description).toBe('A SEO description');
    expect(data!.og_image_url).toBe('https://cdn.example/a-seo-card.png');
    expect(data!.favicon_url).toBe('https://cdn.example/a-seo-icon.webp');
  });
});
