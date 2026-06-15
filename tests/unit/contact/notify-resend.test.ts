/**
 * NOTIF-01/02/03 — RED scaffold (Wave 0, Plan 21-01). FLIPPED ACTIVE BY 21-04.
 *
 * Encodes the secure contract of the not-yet-wired Resend owner-notification seam
 * (`notifyOwnerOfMessage`, `src/lib/trust/notify.ts`). At launch the seam is a no-op
 * (D-01, Phase 6); Phase 21 (D-01 OVERRIDE) wires it to Resend, degrade-open /
 * dormant-until-domain: it sends ONLY when both `RESEND_API_KEY` and
 * `RESEND_FROM_EMAIL` are present, and a Resend outage / missing key / send error
 * NEVER throws (the `messages` insert already succeeded — notify is best-effort,
 * called AFTER the insert at `route.ts:158-163`).
 *
 * The contract this file pins:
 *   - NOTIF-01: when both env vars are set, `resend.emails.send` is called EXACTLY
 *     once with `to` = the OWNER email resolved from the `supabaseAdmin` lookup
 *     (keyed on `portfolioId`, joining portfolios → profiles), `replyTo` = the
 *     INPUT visitor `senderEmail`, `from` = `process.env.RESEND_FROM_EMAIL`, a
 *     subject of `New message from ${senderName} via Portsmith`, and BOTH `html`
 *     and `text` present.
 *   - NOTIF-03: the `to` value ORIGINATES from the mocked admin lookup — NO
 *     call-site / payload field is ever used as `to` (the owner address is never
 *     client-supplied; that would let a visitor email an attacker-chosen address).
 *   - NOTIF-02 (degrade): three sub-cases — `resend.emails.send` REJECTS (throws),
 *     it RESOLVES `{ error: <obj> }`, and the env vars are UNSET. In all three
 *     `notifyOwnerOfMessage` resolves WITHOUT throwing; for the unset case
 *     `resend.emails.send` is never called (dormant-until-domain).
 *
 * ── WHY THIS IS RED NOW (and survives `tsc --noEmit`) ─────────────────────────
 * The notify module's CURRENT shape is the no-op `{ portfolioId, senderName,
 * subject? }`; 21-04 expands it to `{ portfolioId, senderName, senderEmail,
 * subject?, body }` and fills in the Resend body. A STATIC import of the not-yet-
 * expanded module would compile against the OLD signature and the active assertions
 * would fail for the wrong reason. Per the proven Phase-15 / contact-route scaffold
 * posture this whole contract ships inside ONE wrapping `describe.skip(...)`:
 * committed + visible, but INERT — the module is imported at RUNTIME through a
 * VARIABLE specifier (`const NOTIFY = '@/lib/trust/notify'` + `await import(...)`)
 * so `tsc --noEmit` never resolves the expanded shape at compile time. 21-04
 * flips this single `describe.skip` → `describe` once the Resend code lands.
 *
 * The mock idiom mirrors `tests/unit/contact/contact-route.test.ts`: stub
 * `server-only` → `{}`, mock the `resend` package's named `Resend` export so
 * `resend.emails.send` is a controllable spy returning `{ data, error }`, and mock
 * `@/lib/supabase/service-role` so the owner lookup returns a fixed
 * `{ email, username }`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// The Resend SDK named export. `new Resend(apiKey)` yields an object whose
// `emails.send(...)` is the controllable spy. Default: resolves `{ data, error: null }`.
const emailsSend = vi.fn(
  async (
    ..._a: unknown[]
  ): Promise<{ data: { id: string } | null; error: unknown }> => ({
    data: { id: 'email-id-123' },
    error: null,
  }),
);
const ResendCtor = vi.fn((..._a: unknown[]) => ({ emails: { send: emailsSend } }));
vi.mock('resend', () => ({
  Resend: ResendCtor,
}));

// The service-role owner lookup. `notify` resolves the OWNER email + username via
// `supabaseAdmin` keyed on `portfolioId` (joining portfolios → profiles) — NEVER the
// client payload (NOTIF-03). The spy returns a fixed owner the test asserts `to`
// against. The exact chain (`.from(...).select(...).eq('id', portfolioId).single()`)
// mirrors `route.ts:123-127`; the stub is deliberately chain-shape-agnostic so it
// survives the planner's exact lookup query in 21-04.
const OWNER = { email: 'owner@portsmith.test', username: 'owneruser' };
const single = vi.fn(async () => ({ data: OWNER, error: null }));
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock('@/lib/supabase/service-role', () => ({
  supabaseAdmin: { from },
}));

// The not-yet-expanded notify module — RUNTIME import through a variable specifier
// so `tsc` compiles against neither the old nor the new shape (no TS2307 / no
// signature mismatch) but the suite is genuinely RED until 21-04 lands.
const NOTIFY = '@/lib/trust/notify';
async function loadNotify(): Promise<{
  notifyOwnerOfMessage: (n: Record<string, unknown>) => Promise<void>;
}> {
  return (await import(/* @vite-ignore */ NOTIFY)) as {
    notifyOwnerOfMessage: (n: Record<string, unknown>) => Promise<void>;
  };
}

// The expanded notification payload 21-04 accepts: the two NEW fields (`senderEmail`,
// `body`) are the already-Zod-validated route fields (`contactFormSchema`).
const notification = {
  portfolioId: '00000000-0000-0000-0000-0000000000aa',
  senderName: 'Visitor Vera',
  senderEmail: 'visitor@example.com',
  subject: 'Hello there',
  body: 'I would like to work with you on a project.',
};

const ENV_KEYS = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'] as const;
let savedEnv: Record<string, string | undefined>;

describe.skip('NOTIF — notifyOwnerOfMessage wired to Resend (FLIPPED ACTIVE BY 21-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the lookup chain to the happy owner on every case.
    single.mockResolvedValue({ data: OWNER, error: null });
    emailsSend.mockResolvedValue({ data: { id: 'email-id-123' }, error: null });
    // Snapshot the two env vars so each case can set/unset deterministically.
    savedEnv = {};
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  });

  afterEach(() => {
    // Restore the env exactly as it was (no cross-case bleed).
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  function setEnvPresent() {
    process.env.RESEND_API_KEY = 're_test_key_123';
    process.env.RESEND_FROM_EMAIL = 'notifications@portsmith.app';
  }

  function setEnvUnset() {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  }

  describe('NOTIF-01 — send is called with the resolved owner + visitor reply-to', () => {
    it('sends exactly once with to=ownerEmail (lookup), replyTo=visitorEmail, from=RESEND_FROM_EMAIL', async () => {
      setEnvPresent();
      const { notifyOwnerOfMessage } = await loadNotify();

      await notifyOwnerOfMessage(notification);

      expect(emailsSend).toHaveBeenCalledTimes(1);
      const sent = emailsSend.mock.calls[0]![0] as Record<string, unknown>;

      // `to` is the OWNER address from the mocked admin lookup — NOT any input field.
      const toVal = Array.isArray(sent.to) ? (sent.to as string[])[0] : sent.to;
      expect(toVal).toBe(OWNER.email);

      // `replyTo` is the VISITOR's email (the owner replies directly from their client).
      const replyVal = Array.isArray(sent.replyTo)
        ? (sent.replyTo as string[])[0]
        : sent.replyTo;
      expect(replyVal).toBe(notification.senderEmail);

      // `from` is the verified platform sender — NEVER the visitor (no spoofing).
      expect(sent.from).toContain('notifications@portsmith.app');

      // Subject names the sender (D-02).
      expect(sent.subject).toBe(
        `New message from ${notification.senderName} via Portsmith`,
      );

      // Both an HTML and a plain-text alternative are present.
      expect(typeof sent.html).toBe('string');
      expect((sent.html as string).length).toBeGreaterThan(0);
      expect(typeof sent.text).toBe('string');
      expect((sent.text as string).length).toBeGreaterThan(0);
    });

    it('the owner email is resolved via the supabaseAdmin lookup keyed on portfolioId', async () => {
      setEnvPresent();
      const { notifyOwnerOfMessage } = await loadNotify();

      await notifyOwnerOfMessage(notification);

      // The service-role lookup ran (the trusted server resolution of the owner).
      expect(from).toHaveBeenCalled();
      // The lookup was keyed on the portfolioId from the payload (never the owner address).
      expect(eq).toHaveBeenCalledWith(expect.anything(), notification.portfolioId);
    });
  });

  describe('NOTIF-03 — the owner address is never client-supplied', () => {
    it('to comes from the lookup; no input/payload field is used as to', async () => {
      setEnvPresent();
      const { notifyOwnerOfMessage } = await loadNotify();

      await notifyOwnerOfMessage(notification);

      const sent = emailsSend.mock.calls[0]![0] as Record<string, unknown>;
      const toVal = Array.isArray(sent.to) ? (sent.to as string[])[0] : sent.to;

      // The `to` is the looked-up owner — and is NOT any of the visitor-controlled
      // payload fields (an attacker must never be able to choose the recipient).
      expect(toVal).toBe(OWNER.email);
      expect(toVal).not.toBe(notification.senderEmail);
      expect(toVal).not.toBe(notification.senderName);
      expect(toVal).not.toBe(notification.portfolioId);
      expect(toVal).not.toBe(notification.subject);
      expect(toVal).not.toBe(notification.body);
    });
  });

  describe('NOTIF-02 — degrade-open: a Resend failure never throws', () => {
    it('resolves without throwing when resend.emails.send REJECTS (transient outage)', async () => {
      setEnvPresent();
      emailsSend.mockRejectedValueOnce(new Error('Resend network timeout'));
      const { notifyOwnerOfMessage } = await loadNotify();

      // Must NOT reject — the message is already stored; notify is best-effort.
      await expect(notifyOwnerOfMessage(notification)).resolves.toBeUndefined();
    });

    it('resolves without throwing when resend.emails.send RESOLVES { error }', async () => {
      setEnvPresent();
      emailsSend.mockResolvedValueOnce({
        data: null,
        error: { name: 'application_error', message: 'domain not verified' },
      });
      const { notifyOwnerOfMessage } = await loadNotify();

      await expect(notifyOwnerOfMessage(notification)).resolves.toBeUndefined();
    });

    it('when RESEND env vars are UNSET it no-ops: send is never called (dormant-until-domain)', async () => {
      setEnvUnset();
      const { notifyOwnerOfMessage } = await loadNotify();

      await expect(notifyOwnerOfMessage(notification)).resolves.toBeUndefined();
      // Dormant: no Resend client construction, no send — exactly the launch no-op.
      expect(emailsSend).not.toHaveBeenCalled();
    });
  });
});
