// CMS-06 — GREEN (04-03): the server-boundary Zod gate for section saves.
//
// Behavior under test (the server-boundary re-parse gate, T-V5 input-validation):
//   - a known type (hero) with VALID content passes the gate and resolves ok;
//   - a known type (hero) with INVALID content is REJECTED at the SERVER boundary
//     (not just the client) — the action returns { ok: false } with field errors;
//   - an UNREGISTERED type is rejected (no schema registered → cannot pass).
//
// The gate the action wraps is the existing `validateSectionContent` (sections.ts);
// these assertions describe the ACTION's contract over it (re-parse + result shape).
//
// Strategy (mirrors tests/unit/auth/signup-action.test.ts): the action calls
// `getVerifiedClaims()` + `createClient()` (which read cookies) and
// `revalidatePath`, none of which have a request scope in the `unit` project. We
// mock `@/lib/supabase/server` so identity succeeds and the write is a resolving
// spy, mock `next/cache` so the revalidate is a no-op, and stub `next/headers`
// defensively. With identity + write mocked to succeed, a VALID payload reaches
// `{ ok: true }` and an INVALID/UNREGISTERED payload is caught at the gate BEFORE
// the write — proving the gate, not the DB (RLS is proven by the integration
// test, rls-write.test.ts).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Verified identity succeeds (a fake authenticated claim); the section UPDATE is a
// chainable stub that resolves with no error. The action now ALSO reads the prior
// section `content` BEFORE the UPDATE (WR-03 server-recompute) — the `sections`
// branch exposes a `select` returning a prior-content row; the `profiles` fallback
// branch returns a username. None of this touches a real DB — the gate runs first.
const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
// profiles.select(...).eq(...).single() → the username fallback row.
const profileSingle = vi.fn(async () => ({ data: { username: 'tester' }, error: null }));
const profileSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: profileSingle })) }));
// sections.select('content').eq('id', ...).single() → the prior persisted content
// (WR-03 read). For the gate cases this is a hero section (no item images), so the
// server delete-set diff resolves to [] and no delete fires.
const sectionSingle = vi.fn(async () => ({
  data: { content: { heading: 'prior' } },
  error: null,
}));
const sectionSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: sectionSingle })) }));
const from = vi.fn((table: string) =>
  table === 'sections' ? { update, select: sectionSelect } : { select: profileSelect },
);

vi.mock('@/lib/supabase/server', () => ({
  getVerifiedClaims: async () => ({ sub: '00000000-0000-0000-0000-0000000000aa' }),
  createClient: async () => ({ from }),
}));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Map(),
}));

// Import AFTER the mocks are registered.
import { saveSectionAction } from '@/lib/cms/save-section-action';

// hero content: heading max 100; subheading optional (sections.ts heroContentSchema).
const validHeroContent = { heading: 'Hi, I build things', subheading: 'Engineer' };
// INVALID: heading exceeds the 100-char max → server gate must reject.
const invalidHeroContent = { heading: 'x'.repeat(101) };

describe('CMS-06 — saveSectionAction server-boundary Zod gate', () => {
  // The supabase/revalidate spies are module-scoped (the mock is hoisted once);
  // clear their call history between cases so each assertion sees only its own run.
  beforeEach(() => {
    update.mockClear();
    revalidatePath.mockClear();
  });

  it('accepts a known type (hero) with valid content', async () => {
    const result = await saveSectionAction({
      sectionId: '00000000-0000-0000-0000-000000000001',
      type: 'hero',
      content: validHeroContent,
      username: 'tester',
    });
    expect(result.ok).toBe(true);
    // The save-go-live revalidate fired on the owner's literal path (D-P4-01).
    expect(revalidatePath).toHaveBeenCalledWith('/tester');
  });

  it('rejects a known type (hero) with INVALID content at the server boundary', async () => {
    const result = await saveSectionAction({
      sectionId: '00000000-0000-0000-0000-000000000001',
      type: 'hero',
      content: invalidHeroContent,
    });
    expect(result.ok).toBe(false);
    // Server re-parse → field-level errors (mirrors the signup-action loop).
    if (!result.ok) {
      expect(result.fieldErrors ?? result.error).toBeTruthy();
      expect(result.fieldErrors?.heading).toBeTruthy();
    }
    // The gate rejected BEFORE the write — no section UPDATE was attempted.
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an UNREGISTERED section type (no schema in the soft enum)', async () => {
    const result = await saveSectionAction({
      sectionId: '00000000-0000-0000-0000-000000000001',
      type: 'not-a-real-type',
      content: { anything: true },
    });
    expect(result.ok).toBe(false);
  });
});
