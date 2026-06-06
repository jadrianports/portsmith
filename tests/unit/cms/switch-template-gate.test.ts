// GATE-03 — RED scaffold (Wave 0, Plan 12-01). GREENED BY 12-03
// (the new step-2.5 grant gate inside `@/lib/cms/switch-template-action`:
// after the existing `templateSlugSchema` Zod gate, read the target template's
// `visibility`; if 'restricted', read the caller's OWN `template_grants` row; an
// ungranted-restricted target is rejected with NO write — D-P12-13 / RESEARCH Rec 5).
//
// Mirrors `tests/unit/cms/switch-template.test.ts`'s spy idiom EXACTLY (the same
// `from`/`updateChain`/`updateEq` write spies + `getVerifiedClaims` mock + the
// `next/cache`/`next/headers` mocks + the variable-specifier dynamic import so
// `moduleResolution: bundler` does not compile-resolve the action and `tsc --noEmit`
// stays 0). It ADDS the `templates.select('visibility')` + `template_grants` reads
// the grant gate performs, and asserts THREE behaviours:
//
//   (a) ungranted-restricted → { ok:false } with the write spy UNTOUCHED (rejected
//       BEFORE the `portfolios` UPDATE — no template_id ever persisted for an
//       ungranted restricted target, the entire D-P12-13 argument).
//   (b) granted-restricted → the write IS attempted (a grant row is returned, so
//       the gate passes and the existing SHARED-A write runs).
//   (c) unknown slug → rejected by `templateSlugSchema` BEFORE the visibility read
//       (the Zod-stays-FIRST regression guard — the existing case (b) of
//       switch-template.test.ts must keep holding once the grant gate is inserted).
//
// ── WHY RED NOW (and tsc stays 0) ─────────────────────────────────────────────
// Cases (a)/(b) are RED until 12-03 inserts the grant gate: TODAY's
// `switchTemplateAction` has NO visibility/grant read — for a known slug it goes
// straight to the write, so (a) would see the write ATTEMPTED (the gate does not
// yet suppress it) and FAIL the `updateChain` not-called assertion. Case (c) is
// already GREEN (the Zod gate exists) and is the regression guard that must STAY
// green after 12-03. The action is imported via a runtime VARIABLE specifier
// (matching switch-template.test.ts), so tsc stays 0; it is genuinely RED at
// runtime until 12-03 ships the grant branch.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// The pinned literal minimal UUID (registry TEMPLATE_UUIDS) — `uuidForSlug('minimal')`
// returns this; the visibility/grant reads below are keyed on it.
const MINIMAL_UUID = '00000000-0000-4000-8000-000000000001';

// ── Write spies (mirror switch-template.test.ts) ──────────────────────────────
// The switch awaits `.from('portfolios').update({ template_id }).eq('user_id', sub)`.
// An UNTOUCHED `updateChain`/`updateEq` proves the grant gate short-circuited BEFORE
// the DB write.
const updateEq = vi.fn(() => Promise.resolve({ error: null }));
const updateChain = vi.fn(() => ({ eq: updateEq }));

// ── Read spies for the grant gate (NEW vs switch-template.test.ts) ────────────
// The grant gate (12-03) performs, in order:
//   1. `.from('templates').select('visibility').eq('id', templateId).single()`
//   2. (if restricted) `.from('template_grants').select('user_id')
//        .eq('template_id', templateId).eq('user_id', sub).maybeSingle()`
//   3. (revalidate) `.from('profiles').select('username').eq('id', sub).single()`
// Each test tunes what the templates + grants reads RESOLVE to.
let templatesVisibility: { visibility: string } | null = { visibility: 'restricted' };
let grantRow: { user_id: string } | null = null;

const templatesSingle = vi.fn(async () => ({ data: templatesVisibility, error: null }));
const templatesEq = vi.fn(() => ({ single: templatesSingle }));
const templatesSelect = vi.fn(() => ({ eq: templatesEq }));

const grantsMaybeSingle = vi.fn(async () => ({ data: grantRow, error: null }));
const grantsEqUser = vi.fn(() => ({ maybeSingle: grantsMaybeSingle }));
const grantsEqTemplate = vi.fn(() => ({ eq: grantsEqUser }));
const grantsSelect = vi.fn(() => ({ eq: grantsEqTemplate }));

const profilesSingle = vi.fn(async () => ({ data: { username: 'x' }, error: null }));
const profilesEq = vi.fn(() => ({ single: profilesSingle }));
const profilesSelect = vi.fn(() => ({ eq: profilesEq }));

// Route `.from(table)` to the right chain. `portfolios` carries the write spy;
// `templates`/`template_grants`/`profiles` carry the read chains.
const from = vi.fn((table: string) => {
  if (table === 'portfolios') return { update: updateChain };
  if (table === 'templates') return { select: templatesSelect };
  if (table === 'template_grants') return { select: grantsSelect };
  if (table === 'profiles') return { select: profilesSelect };
  return {};
});

// A valid `sub` so the ONLY thing that can stop the write is the slug Zod gate or
// the new grant gate (never the WR-05 sub guard).
const getVerifiedClaims = vi.fn(async () => ({ sub: 'user-123' }) as { sub?: string });
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

// Variable specifier → resolved at runtime (the [05-01]/07-01 idiom; tsc stays 0).
const SWITCH_ACTION = '@/lib/cms/switch-template-action';

type SwitchResult = { ok: boolean; error?: string };
async function loadSwitchTemplateAction(): Promise<(slug: string) => Promise<SwitchResult>> {
  const mod = (await import(/* @vite-ignore */ SWITCH_ACTION)) as {
    switchTemplateAction?: (slug: string) => Promise<SwitchResult>;
  };
  expect(typeof mod.switchTemplateAction).toBe('function');
  return mod.switchTemplateAction as (slug: string) => Promise<SwitchResult>;
}

beforeEach(() => {
  updateChain.mockClear();
  updateEq.mockClear();
  from.mockClear();
  // Clear the FULL read-chain spies — cases assert `.not.toHaveBeenCalled()` /
  // `.toHaveBeenCalledWith(...)` on `templatesSelect`/`templatesEq` (case b/c) and the
  // grant + profiles chains, so every spy these tests inspect must reset per-case or a
  // prior case's calls leak into the next assertion (the per-case clean slate the
  // scaffold's :116 comment intends).
  templatesSelect.mockClear();
  templatesEq.mockClear();
  templatesSingle.mockClear();
  grantsSelect.mockClear();
  grantsEqTemplate.mockClear();
  grantsEqUser.mockClear();
  grantsMaybeSingle.mockClear();
  profilesSelect.mockClear();
  profilesEq.mockClear();
  profilesSingle.mockClear();
  revalidatePath.mockClear();
  // Defaults: target is restricted, NO grant (the (a) ungranted-restricted case).
  templatesVisibility = { visibility: 'restricted' };
  grantRow = null;
  getVerifiedClaims.mockResolvedValue({ sub: 'user-123' } as { sub?: string });
});

describe('GATE-03 — switchTemplateAction grant gate (GREENED BY 12-03)', () => {
  it('(a) ungranted-restricted target → { ok:false } with NO write attempted', async () => {
    // 'minimal' is restricted; the grant read resolves to NULL (no grant) → reject.
    templatesVisibility = { visibility: 'restricted' };
    grantRow = null;

    const switchTemplateAction = await loadSwitchTemplateAction();
    const result = await switchTemplateAction('minimal');

    expect(result.ok).toBe(false);
    // The whole D-P12-13 argument: an ungranted restricted template_id is NEVER persisted.
    expect(updateChain).not.toHaveBeenCalled();
    expect(updateEq).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('(b) granted-restricted target → the write IS attempted', async () => {
    // 'minimal' is restricted AND the caller has a grant row → the gate passes.
    templatesVisibility = { visibility: 'restricted' };
    grantRow = { user_id: 'user-123' };

    const switchTemplateAction = await loadSwitchTemplateAction();
    const result = await switchTemplateAction('minimal');

    expect(result.ok).toBe(true);
    // The existing SHARED-A write runs for a granted target.
    expect(updateChain).toHaveBeenCalled();
    expect(updateEq).toHaveBeenCalledWith('user_id', 'user-123');
    // Sanity: the gate read the minimal template's visibility by its pinned UUID.
    expect(templatesEq).toHaveBeenCalledWith('id', MINIMAL_UUID);
  });

  it('(c) unknown slug → rejected by templateSlugSchema BEFORE the visibility read (Zod first)', async () => {
    const switchTemplateAction = await loadSwitchTemplateAction();
    const result = await switchTemplateAction('totally-not-a-real-template');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Unknown template.');
    // Zod-stays-FIRST: the grant gate's visibility read never runs for an unknown slug,
    // and no write is attempted (the existing switch-template.test.ts (b) guard).
    expect(templatesSelect).not.toHaveBeenCalled();
    expect(updateChain).not.toHaveBeenCalled();
  });
});
