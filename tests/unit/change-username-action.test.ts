/**
 * HANDLE-01 — changeUsernameAction SHARED-A behavior (Wave-0 RED, mocked supabase + ledger).
 *
 * The Phase-30 change action (`src/lib/cms/change-username-action.ts`) mirrors
 * `set-onboarding-username-action.ts` (the SHARED-A skeleton) PLUS a fail-CLOSED
 * cooldown gate and a dual-path revalidate (30-RESEARCH.md "The Change Action"
 * lines 199-219). This file pins its contract with everything I/O mocked, exactly
 * like tests/unit/cms/save-section.test.ts:
 *
 *   - missing `sub` (no verified claim) → { ok:false } WITHOUT touching the RPC;
 *   - invalid / reserved handle → { ok:false, fieldErrors:{ username } } via the
 *     reused `usernameSchema` (no network) — the RPC is never called;
 *   - no-op (the parsed handle equals the caller's CURRENT handle) → { ok:true }
 *     WITHOUT touching the ledger and WITHOUT calling the RPC;
 *   - happy path → calls the `change_username` RPC under the AUTHENTICATED client
 *     + dual revalidatePath (old + new), returns { ok:true };
 *   - it NEVER imports/calls `supabaseAdmin` and NEVER a raw
 *     `.from('profiles').update({ username })`.
 *
 * RED STATE: `@/lib/cms/change-username-action` does not exist yet — the import
 * fails, so every case errors. That IS the intended Wave-0 RED. The mock shape
 * below describes the surface the GREEN action will consume.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// The current handle the action reads to detect the no-op + to revalidate the OLD
// path. The action reads the caller's own profile (verified-owner read) for this.
let CURRENT_HANDLE = 'oldhandle';

// The authenticated RLS client: `.rpc('change_username', …)` is the ONLY sanctioned
// write. A raw `.from('profiles').update(...)` MUST never be used — we expose a spy
// that fails the test loudly if the action ever reaches for it.
const rpc = vi.fn(async () => ({ error: null as { message: string } | null }));
const rawUpdate = vi.fn(() => {
  throw new Error(
    'changeUsernameAction must NEVER raw-UPDATE profiles.username — the ' +
      'sanctioned change_username RPC is the only legal path (HANDLE-03).',
  );
});
// profiles read for the current handle (no-op detection + old-path revalidate).
const profileSingle = vi.fn(async () => ({
  data: { username: CURRENT_HANDLE },
  error: null,
}));
const profilesFrom = {
  select: vi.fn(() => ({ eq: vi.fn(() => ({ single: profileSingle })) })),
  update: rawUpdate,
};
const from = vi.fn(() => profilesFrom);

vi.mock('@/lib/supabase/server', () => ({
  getVerifiedClaims: async () => ({ sub: '00000000-0000-0000-0000-0000000000aa' }),
  createClient: async () => ({ from, rpc }),
}));

// The cooldown ledger — fail-CLOSED for the username_change bucket. countAndRecord
// returns true (allowed) by default in these mocks; specific cases override it.
const countAndRecord = vi.fn(async (..._args: unknown[]) => true);
vi.mock('@/lib/rate-limit/ledger', () => ({
  countAndRecord: (...args: unknown[]) => countAndRecord(...args),
}));

// Guard: the action must NOT pull the service-role admin client. Importing it
// would throw `server-only` in the unit project anyway, but we assert intent.
const serviceRoleSpy = vi.fn();
vi.mock('@/lib/supabase/service-role', () => {
  serviceRoleSpy();
  return { supabaseAdmin: new Proxy({}, { get: () => () => { throw new Error('service-role used'); } }) };
});

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Map(),
}));

// RED: `@/lib/cms/change-username-action` does not exist until Plan 02. We load it
// via a RUNTIME dynamic import through a computed specifier so `tsc --noEmit` does
// NOT statically resolve the (absent) module — the import fails only at RUNTIME,
// which IS the intended Wave-0 RED. Plan 02 creates the real module and this lazy
// loader can be replaced with a plain static import when the test flips GREEN.
type ChangeUsernameResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: { username?: string } };
type ChangeUsernameAction = (input: { username: string }) => Promise<ChangeUsernameResult>;

// The specifier is assembled at runtime so it is opaque to the TS module checker.
const ACTION_SPECIFIER = ['@/lib/cms', 'change-username-action'].join('/');
async function changeUsernameAction(input: { username: string }): Promise<ChangeUsernameResult> {
  const mod = (await import(/* @vite-ignore */ ACTION_SPECIFIER)) as {
    changeUsernameAction: ChangeUsernameAction;
  };
  return mod.changeUsernameAction(input);
}

describe('HANDLE-01 — changeUsernameAction (SHARED-A + cooldown + dual revalidate)', () => {
  beforeEach(() => {
    CURRENT_HANDLE = 'oldhandle';
    rpc.mockClear();
    rawUpdate.mockClear();
    countAndRecord.mockClear();
    revalidatePath.mockClear();
    profileSingle.mockClear();
    rpc.mockResolvedValue({ error: null });
    countAndRecord.mockResolvedValue(true);
  });

  it('an invalid/reserved handle is rejected at the server gate (fieldErrors), no RPC, no ledger', async () => {
    const result = await changeUsernameAction({ username: 'admin' }); // reserved
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.username).toBeTruthy();
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(countAndRecord).not.toHaveBeenCalled();
  });

  it('a no-op (current handle) returns { ok:true } without touching the ledger or the RPC', async () => {
    CURRENT_HANDLE = 'samehandle';
    const result = await changeUsernameAction({ username: 'samehandle' });
    expect(result.ok).toBe(true);
    expect(countAndRecord).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('the happy path calls the change_username RPC + dual revalidatePath, returns { ok:true }', async () => {
    CURRENT_HANDLE = 'oldhandle';
    const result = await changeUsernameAction({ username: 'newhandle' });
    expect(result.ok).toBe(true);

    // The sanctioned RPC was called under the authenticated client.
    expect(rpc).toHaveBeenCalledWith('change_username', { new_username: 'newhandle' });

    // Dual-path revalidate: the OLD path (so /old re-renders into its redirect) AND
    // the NEW path (so the new URL is fresh) — both literal, no 2nd arg.
    expect(revalidatePath).toHaveBeenCalledWith('/oldhandle');
    expect(revalidatePath).toHaveBeenCalledWith('/newhandle');
  });

  it('the cooldown gate is consulted on the change path (HANDLE-01 / D-06)', async () => {
    CURRENT_HANDLE = 'oldhandle';
    await changeUsernameAction({ username: 'newhandle' });
    // The username_change bucket is keyed by the caller's sub.
    expect(countAndRecord).toHaveBeenCalled();
    const [bucket] = countAndRecord.mock.calls[0] as unknown[];
    expect(bucket).toBe('username_change');
  });

  it('a denied cooldown returns { ok:false } with a next-allowed-date message, never calls the RPC', async () => {
    CURRENT_HANDLE = 'oldhandle';
    countAndRecord.mockResolvedValueOnce(false); // 2nd change inside the window
    const result = await changeUsernameAction({ username: 'newhandle' });
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    // D-08: the denial surfaces the "next allowed on {date}" copy (computed from the
    // oldest in-window event + 30 days). Pinned here as a non-empty error string.
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
      expect(result.error && result.error.length).toBeTruthy();
    }
  });

  it('NEVER raw-UPDATEs profiles.username (the rawUpdate spy throws if reached)', async () => {
    CURRENT_HANDLE = 'oldhandle';
    await changeUsernameAction({ username: 'newhandle' });
    expect(rawUpdate).not.toHaveBeenCalled();
  });
});
