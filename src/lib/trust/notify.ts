import 'server-only';

import { siteUrl } from '@/lib/url';

import { getPortfolioOwner } from './owner-email';
import { sendOwnerEmail } from './resend';

/**
 * Owner-notification orchestrator (NOTIF-01 / NOTIF-03 · D-01..D-03) — degrade-OPEN.
 *
 * Phase 6 shipped this as a deliberate NO-OP seam (the old D-01: "do NOT install or
 * import resend" — the brand-domain deferral). Phase 21 D-01 OVERRIDES that: `resend`
 * IS installed and wired here, dormant-until-domain. The seam now orchestrates:
 *   1. a TRUSTED owner lookup keyed on `portfolioId` (`owner-email.ts`, NEVER the call
 *      site — NOTIF-03: a visitor must never choose the recipient);
 *   2. composing the brand-faithful Surface-B email (escaped user content + a
 *      mandatory plain-text alternative);
 *   3. sending it via `resend.ts` with `from` = the platform sender, `replyTo` = the
 *      visitor (D-02: the owner replies directly, the platform never spoofs the visitor).
 *
 * EVERY step degrades open. The contact `messages` insert ALREADY succeeded before
 * this runs (called AFTER the insert at `route.ts` step 6); notify is best-effort and
 * resolves `Promise<void>` WITHOUT ever throwing (NOTIF-02). When the RESEND env vars
 * are unset (the launch / $0-domains state) the send is a no-op — exactly the seam's
 * original behavior.
 */

/**
 * The notification payload. The two NEW fields (`senderEmail`, `body`) are the
 * already-Zod-validated contact-form fields the route holds (Discretion #4). The
 * owner's email + username are deliberately NOT on this shape — they are resolved
 * INSIDE via a trusted server lookup so a caller can never supply them (NOTIF-03).
 */
export interface OwnerNotification {
  /** The portfolio whose owner should be notified — the trusted lookup key. */
  portfolioId: string;
  /** The contact sender's name (validated) — the subject + email intro. */
  senderName: string;
  /** The contact sender's email (validated) — the Reply-To (D-02). */
  senderEmail: string;
  /** The optional message subject (validated). */
  subject?: string | null;
  /** The full message body (validated) — the quoted block + the plain-text part. */
  body: string;
}

/**
 * Notify a portfolio owner that a visitor sent them a contact message. Best-effort,
 * degrade-open: resolves `void` and NEVER throws. When the RESEND env vars are unset
 * it no-ops (dormant-until-domain, D-01).
 */
export async function notifyOwnerOfMessage(n: OwnerNotification): Promise<void> {
  try {
    // Dormant-until-domain short-circuit (D-01): if the platform sender is unset there
    // is nothing to send `from`, so skip the owner lookup entirely. `resend.ts` guards
    // again on its own (defense in depth), but short-circuiting here avoids a needless
    // service-role read when the feature is dormant (the launch state).
    const from = process.env.RESEND_FROM_EMAIL;
    if (!process.env.RESEND_API_KEY || !from) return;

    // NOTIF-03 — the owner address comes ONLY from this trusted server lookup keyed on
    // portfolioId, never from the visitor payload (T-21-09).
    const owner = await getPortfolioOwner(n.portfolioId);
    if (!owner) return; // a deleted portfolio / lookup miss → no-op, never throw.

    // The absolute inbox link (env-driven via NEXT_PUBLIC_SITE_URL — never the request
    // Host; a domain switch is env + DNS + 301, zero code edits — D-22 / PUB-03).
    const inboxUrl = siteUrl('/dashboard/inbox');

    const { html, text } = renderOwnerEmail({
      senderName: n.senderName,
      subject: n.subject,
      body: n.body,
      inboxUrl,
    });

    await sendOwnerEmail({
      from, // verified platform sender — NEVER the visitor (D-02 / T-21-10).
      to: owner.email, // trusted server lookup, NOT the client payload (NOTIF-03).
      replyTo: n.senderEmail, // the visitor — the owner replies directly (D-02).
      subject: `New message from ${n.senderName} via Portsmith`,
      html,
      text,
    });
  } catch {
    // Belt-and-suspenders: every callee already degrades open, but a thrown render /
    // lookup / send still resolves to a silent no-op here (NOTIF-02 — the message is
    // already stored; notify never fails the contact submission).
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface B — the brand-faithful contact-notify email (NOTIF-01/03 · UI-SPEC).
//
// A hostile third medium (mail clients): inline styles ONLY (no <style>, no CSS
// custom props), table-based layout (no flex/grid), light-mode only, web-safe font
// stack. The brand hex are hardcoded inline (each annotated "= chrome token X") — the
// email MIRRORS the chrome tokens, it cannot CONSUME them. A mandatory plain-text
// alternative ships alongside the HTML. ALL user content (sender name, subject, body)
// is HTML-escaped and rendered as TEXT — never raw HTML (NOTIF-03 / no executable
// user content on the shared multi-tenant domain).
// ─────────────────────────────────────────────────────────────────────────────

/** Inline brand hex — hardcoded (email cannot read `var(--…)`); = the chrome @theme tokens. */
const BRAND = {
  canvas: '#FBFAF8', // = --color-background (warm outer email background)
  card: '#FFFFFF', // = --color-surface (the white message card)
  brand: '#1B3A2E', // = --color-brand (header band + CTA button fill)
  onBrand: '#FBFAF8', // = --color-brand-foreground (button label + header text)
  body: '#16181C', // = --color-foreground (intro, quoted message, sign-off)
  muted: '#5B6066', // = --color-muted-foreground (sender/subject labels, footer)
  border: '#E4E1DB', // = --color-border (card border + the quoted-message left rule)
} as const;

/** The web-safe stack set inline on every text cell (Inter does not load in mail clients). */
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * HTML-escape user-controlled text so it renders as inert TEXT in the owner's mailbox
 * (NOTIF-03). Escapes the five markup-significant characters; the result is only ever
 * placed in element text content / a `mailto:`-free context, never an attribute that
 * could break out.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface OwnerEmailContent {
  senderName: string;
  subject?: string | null;
  body: string;
  inboxUrl: string;
}

/** Compose the Surface-B HTML + plain-text parts. Pure; both parts escape user content. */
function renderOwnerEmail(c: OwnerEmailContent): { html: string; text: string } {
  const senderName = escapeHtml(c.senderName);
  const subject = c.subject?.trim() ? escapeHtml(c.subject.trim()) : null;
  // Preserve the message's line breaks in the HTML quoted block (escape first, then
  // convert newlines to <br> — never the reverse, so injected markup can't survive).
  const bodyHtml = escapeHtml(c.body).replace(/\r?\n/g, '<br />');

  const preheader = `${senderName} sent you a message through your portfolio.`;

  // Light-mode-only, table-based, inline-styled HTML. All layout tables are
  // role="presentation" cellpadding/cellspacing/border=0 (a11y: screen readers skip
  // the layout grid). Every text cell sets an explicit inline line-height (clients
  // don't inherit reliably).
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light only" />
<title>New message via Portsmith</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.canvas};">
<!-- Hidden preheader (the snippet mail clients show beside the subject). -->
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.canvas};">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.canvas};border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <!-- The centered 600px card. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:10px;border-collapse:separate;">
        <!-- Evergreen header band. -->
        <tr>
          <td bgcolor="${BRAND.brand}" style="background-color:${BRAND.brand};border-radius:10px 10px 0 0;padding:20px 24px;">
            <span style="font-family:${FONT};font-size:20px;font-weight:600;line-height:1.25;color:${BRAND.onBrand};">New message via Portsmith</span>
          </td>
        </tr>
        <!-- Intro line. -->
        <tr>
          <td style="padding:24px 24px 16px 24px;">
            <p style="margin:0;font-family:${FONT};font-size:16px;font-weight:400;line-height:1.5;color:${BRAND.body};">${senderName} reached out through your portfolio. Here&rsquo;s what they said:</p>
          </td>
        </tr>
${
  subject
    ? `        <!-- Optional subject row. -->
        <tr>
          <td style="padding:0 24px 16px 24px;">
            <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:400;line-height:1.4;color:${BRAND.muted};">Subject</p>
            <p style="margin:4px 0 0 0;font-family:${FONT};font-size:16px;font-weight:400;line-height:1.5;color:${BRAND.body};">${subject}</p>
          </td>
        </tr>
`
    : ''
}        <!-- Quoted message block (inset, left hairline rule). -->
        <tr>
          <td style="padding:0 24px 24px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="padding:16px;border-left:3px solid ${BRAND.border};background-color:${BRAND.canvas};">
                  <p style="margin:0;font-family:${FONT};font-size:16px;font-weight:400;line-height:1.5;color:${BRAND.body};">${bodyHtml}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Bulletproof CTA button. -->
        <tr>
          <td style="padding:0 24px 8px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
              <tr>
                <td bgcolor="${BRAND.brand}" style="background-color:${BRAND.brand};border-radius:10px;">
                  <a href="${c.inboxUrl}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:${BRAND.onBrand};text-decoration:none;border-radius:10px;">Reply in your inbox</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Reply hint. -->
        <tr>
          <td style="padding:8px 24px 24px 24px;">
            <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:400;line-height:1.4;color:${BRAND.muted};">Or just reply to this email &mdash; it goes straight to ${senderName}.</p>
          </td>
        </tr>
        <!-- Footer disclaimer. -->
        <tr>
          <td style="padding:16px 24px 24px 24px;border-top:1px solid ${BRAND.border};">
            <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:400;line-height:1.4;color:${BRAND.muted};">You&rsquo;re receiving this because someone used the contact form on your Portsmith portfolio.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // The MANDATORY plain-text alternative: sender, subject, the full body, the
  // reply-by-email note, and the RAW inbox URL spelled out (no button to click).
  const textLines = [
    `${c.senderName} reached out through your portfolio. Here's what they said:`,
    '',
  ];
  if (c.subject?.trim()) textLines.push(`Subject: ${c.subject.trim()}`, '');
  textLines.push(
    c.body,
    '',
    'Reply in your inbox:',
    c.inboxUrl,
    '',
    `Or just reply to this email — it goes straight to ${c.senderName}.`,
    '',
    "You're receiving this because someone used the contact form on your Portsmith portfolio.",
  );
  const text = textLines.join('\n');

  return { html, text };
}
