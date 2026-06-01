// WR-05 — the missing-claim guard across the CMS write actions.
//
// The verified-claims gate (getVerifiedClaims → getClaims) realistically always
// yields a `sub`, but a claim with NO `sub` must be a HARD auth failure, not a
// silent 0-row no-op. Before WR-05 every action did `.eq('id', sub ?? '')`, which
// turned a missing identity into a query for `id = ''` (a guaranteed 0-row write
// that LOOKS like success). For save-profile / publish that meant the WRITE itself
// was silently scoped to a non-existent row — the user's edit/publish appeared to
// succeed while nothing was written.
//
// This test mocks `getVerifiedClaims` to return a claim WITHOUT `sub` and asserts
// each action returns { ok:false } and NEVER attempts the write (the update/RPC spy
// is untouched). It complements the integration RLS tests (which prove the happy
// path + cross-tenant scoping) by pinning the defensive guard at the unit level.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// A write spy shared across the mocked supabase client. If a guard fails, the
// action would reach a write and call `.update(...)` — so an untouched spy proves
// the guard short-circuited BEFORE any DB touch. The chainable `.update().eq()`
// returns an await-able + further-chainable shape covering every action's form
// (section/reorder/toggle await `.update().eq()`; profile/publish add `.select().single()`).
const updateEq = vi.fn(() => {
  const result = Promise.resolve({ error: null });
  return Object.assign(result, {
    select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { username: 'x' }, error: null })) })),
  });
});
const updateChain = vi.fn(() => ({ eq: updateEq }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
const from = vi.fn(() => ({ update: updateChain, select: vi.fn() }));

// getVerifiedClaims returns a NON-NULL claim that is MISSING `sub` (the exact
// invariant violation WR-05 must refuse to silently absorb).
vi.mock('@/lib/supabase/server', () => ({
  getVerifiedClaims: async () => ({ role: 'authenticated' }), // no `sub`
  createClient: async () => ({ from, rpc }),
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
import { saveProfileAction } from '@/lib/cms/save-profile-action';
import { setPublished } from '@/lib/cms/publish-action';
import { saveSectionAction } from '@/lib/cms/save-section-action';
import { reorderSectionsAction } from '@/lib/cms/reorder-sections-action';
import { toggleVisibilityAction } from '@/lib/cms/toggle-visibility-action';

beforeEach(() => {
  updateChain.mockClear();
  updateEq.mockClear();
  rpc.mockClear();
  from.mockClear();
  revalidatePath.mockClear();
});

describe('WR-05 — a verified claim missing `sub` is a hard auth failure (no silent 0-row write)', () => {
  it('saveProfileAction refuses to write and returns { ok:false }', async () => {
    const result = await saveProfileAction({ display_name: 'Valid Name', username: 'x' });
    expect(result.ok).toBe(false);
    // The profile UPDATE must never be attempted with an empty id.
    expect(updateChain).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('setPublished refuses to flip and returns { ok:false }', async () => {
    const result = await setPublished(true);
    expect(result.ok).toBe(false);
    expect(updateChain).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('saveSectionAction refuses (a valid hero payload still short-circuits on the missing claim)', async () => {
    const result = await saveSectionAction({
      sectionId: '00000000-0000-0000-0000-000000000001',
      type: 'hero',
      content: { heading: 'Hi', subheading: 'There' },
      // username omitted → would have hit the `sub ?? ''` fallback read pre-WR-05.
    });
    expect(result.ok).toBe(false);
    expect(updateChain).not.toHaveBeenCalled();
  });

  it('reorderSectionsAction refuses to write and returns { ok:false }', async () => {
    const result = await reorderSectionsAction(['11111111-1111-1111-1111-111111111111']);
    expect(result.ok).toBe(false);
    expect(updateChain).not.toHaveBeenCalled();
  });

  it('toggleVisibilityAction refuses to write and returns { ok:false }', async () => {
    const result = await toggleVisibilityAction('11111111-1111-1111-1111-111111111111', false);
    expect(result.ok).toBe(false);
    expect(updateChain).not.toHaveBeenCalled();
  });
});
