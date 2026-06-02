/**
 * Owner-notification seam (D-01) — a deliberately clean NO-OP interface.
 *
 * Launch delivery is inbox-only: the owner reads contact messages in the dashboard
 * inbox (CONT-02). The Resend "you got a message" owner-notification email is
 * DEFERRED to the brand-domain milestone (Resend production sending requires a
 * verified domain — the $0-domains-at-launch constraint). This module is the seam
 * the contact route already calls so adding Resend later is a small DROP-IN, not a
 * route rewrite.
 *
 * INVARIANT: do NOT install or import `resend` (violates D-01 — no new packages this
 * phase). The signature matches what a future Resend implementation will accept, so
 * the brand-domain swap only fills in the body.
 */

/** The shape a future Resend implementation needs to render the owner email. */
export interface OwnerNotification {
  /** The portfolio whose owner should be notified. */
  portfolioId: string;
  /** The contact sender's name (for the email subject/preview). */
  senderName: string;
  /** The optional message subject. */
  subject?: string | null;
}

/**
 * No-op owner-notification seam. Resolves immediately; sends no email at launch
 * (inbox-only, D-01). The brand-domain milestone replaces the body with a Resend
 * call using this exact signature.
 */
export async function notifyOwnerOfMessage(_n: OwnerNotification): Promise<void> {
  // No-op seam — Resend lands at the brand-domain milestone (D-01). The owner reads
  // the message in the dashboard inbox (CONT-02) until then.
}
