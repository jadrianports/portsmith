// TMPL-01/02 — RED scaffold (Wave 0, Plan 07-01). GREENED BY 07-04
// (`@/lib/cms/switch-template-action`).
//
// Encodes the switch action's two unit-level gates, mirroring
// tests/unit/cms/missing-claim-guard.test.ts:
//   (a) WR-05 / SHARED-3 — a verified claim MISSING `sub` is a HARD auth failure:
//       the action returns { ok:false } and NEVER reaches the write (the
//       `update().eq('user_id', …)` spy is untouched). NOT `.eq('id', sub ?? '')`.
//   (b) V5 / T-07-01 — an UNKNOWN slug is rejected by `templateSlugSchema.safeParse`
//       → { ok:false, error:'Unknown template.' } with NO write attempted. (This is
//       the new Zod gate `publish-action.ts` lacks — its payload is a bare boolean.)
//
// SHARED-4 deviation vs missing-claim-guard: the switch writes `portfolios`
// scoped `.eq('user_id', sub)` (the UNIQUE FK to the auth id), NOT `profiles`
// `.eq('id', sub)`. The write spy below therefore matches `.eq('user_id', …)`.
//
// ── WHY RED NOW (and tsc stays 0) ─────────────────────────────────────────────
// `@/lib/cms/switch-template-action` does not exist until 07-04. It is imported at
// RUNTIME through a VARIABLE specifier (the [05-01] idiom) so `moduleResolution:
// bundler` does NOT compile-time-resolve it (no TS2307) — `tsc --noEmit` stays 0 —
// while every case is genuinely RED now (ERR_MODULE_NOT_FOUND at the dynamic import)
// and GREEN once 07-04 ships the module.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// A write spy shared across the mocked supabase client. The switch awaits
// `.from('portfolios').update({ template_id }).eq('user_id', sub)`, then a separate
// `.from('profiles').select('username').eq('id', sub).single()` for the revalidate
// path. An UNTOUCHED `updateEq` proves a gate short-circuited BEFORE any DB write.
const updateEq = vi.fn(() => Promise.resolve({ error: null }));
const updateChain = vi.fn(() => ({ eq: updateEq }));
const selectSingle = vi.fn(async () => ({ data: { username: 'x' }, error: null }));
const selectEq = vi.fn(() => ({ single: selectSingle }));
const selectChain = vi.fn(() => ({ eq: selectEq }));
const from = vi.fn(() => ({ update: updateChain, select: selectChain }));

// getVerifiedClaims returns a NON-NULL claim that is MISSING `sub` (the WR-05
// invariant violation). The unknown-slug case overrides this per-test.
const getVerifiedClaims = vi.fn(async () => ({ role: 'authenticated' }) as { sub?: string });
vi.mock('@/lib/supabase/server', () => ({
  getVerifiedClaims: () => getVerifiedClaims(),
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

// Variable specifier → resolved at runtime (RED until 07-04 ships the module).
const SWITCH_ACTION = '@/lib/cms/switch-template-action';

type SwitchResult = { ok: boolean; error?: string };
async function loadSwitchTemplateAction(): Promise<(slug: string) => Promise<SwitchResult>> {
  const mod = (await import(/* @vite-ignore */ SWITCH_ACTION)) as {
    switchTemplateAction?: (slug: string) => Promise<SwitchResult>;
  };
  // RED until 07-04 adds the export: undefined !== 'function'.
  expect(typeof mod.switchTemplateAction).toBe('function');
  return mod.switchTemplateAction as (slug: string) => Promise<SwitchResult>;
}

beforeEach(() => {
  updateChain.mockClear();
  updateEq.mockClear();
  from.mockClear();
  revalidatePath.mockClear();
  // Default: a claim missing `sub`. The unknown-slug case sets a valid `sub`.
  getVerifiedClaims.mockResolvedValue({ role: 'authenticated' } as { sub?: string });
});

describe('TMPL-01/02 — switchTemplateAction unit gates (GREENED BY 07-04)', () => {
  it('(a) WR-05: a verified claim missing `sub` is a hard auth failure (no write)', async () => {
    const switchTemplateAction = await loadSwitchTemplateAction();
    const result = await switchTemplateAction('editorial');
    expect(result.ok).toBe(false);
    // The portfolios UPDATE must never be attempted with a coerced-empty id.
    expect(updateChain).not.toHaveBeenCalled();
    expect(updateEq).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('(b) V5: an unknown slug is rejected by templateSlugSchema with no write', async () => {
    // A real `sub` so the ONLY thing that can stop the write is the slug Zod gate.
    getVerifiedClaims.mockResolvedValue({ sub: 'user-123' } as { sub?: string });
    const switchTemplateAction = await loadSwitchTemplateAction();
    const result = await switchTemplateAction('totally-not-a-real-template');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Unknown template.');
    expect(updateChain).not.toHaveBeenCalled();
    expect(updateEq).not.toHaveBeenCalled();
  });
});
