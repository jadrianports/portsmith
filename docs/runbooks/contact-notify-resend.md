# Runbook: Contact-Notify via Resend (NOTIF-01/02/03)

> **Purpose.** When a visitor sends a contact message through a published portfolio, the owner
> should be emailed the full message (+ a Reply-To = the visitor + a link to their inbox). The
> code for this is shipped and tested (Phase 21), but it is **dormant-until-domain**: it sends an
> email **only** when both `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` are present. With
> either unset (the launch / `$0`-domains state) it is a silent no-op — exactly the behavior the
> seam had before Resend was wired. This runbook is the durable, version-controlled half of the
> turn-on; verifying the brand domain in Resend and setting the two env vars is a founder-owned
> deploy step, **not** a code blocker.
>
> **Requirements:** NOTIF-01 (full message + Reply-To) · NOTIF-02 (degrade-open, best-effort) ·
> NOTIF-03 (trusted owner resolution) · **Decisions:** D-01..D-04 · **Phase:**
> 21-activation-funnel-contact-notify

---

## How it works (the invariants this runbook does not let you break)

The send is wired into the existing `POST /api/contact` route, **after** the `messages` insert
(step 6). The message is already stored before notify runs, so notify is best-effort:

- **Degrade-open (NOTIF-02).** A missing key, an unverified domain, a network error, an SDK throw,
  or a Resend `{ error }` response are all swallowed and logged — they NEVER fail the contact
  submission and NEVER 500 the route. The visitor always gets the generic `200 { ok: true }`, and
  the owner can always read the message in their dashboard inbox regardless of email delivery.
- **Dormant-until-domain (D-01).** `src/lib/trust/resend.ts` and `src/lib/trust/notify.ts` both
  guard on `RESEND_API_KEY && RESEND_FROM_EMAIL`. Unset → no client is constructed, no send is
  attempted (no-op). This is why the feature ships safely before the domain exists.
- **Trusted owner resolution (NOTIF-03).** The recipient (`to`) is resolved **only** by a
  service-role lookup keyed on `portfolio_id` (`src/lib/trust/owner-email.ts`) — never from the
  visitor's payload. A visitor can never choose who receives the email.
- **No visitor spoofing (D-02).** `from` is always the verified platform sender
  (`RESEND_FROM_EMAIL`); the visitor's address is carried only as `Reply-To`, so the owner can
  reply directly from their mail client while SPF/DKIM stay aligned to the platform sender.
- **Escaped user content (NOTIF-03).** The sender name + message body are HTML-escaped and rendered
  as inert text in the email — a crafted message cannot inject markup/links into the owner's mailbox.

---

## Environment variables

| Var | Example | Notes |
|-----|---------|-------|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxxxxxxxxxxxx` | Secret. Server-only (`import 'server-only'`), never bundled; CI greps `.next/static` for it. |
| `RESEND_FROM_EMAIL` | `notifications@portsmith.app` | Must be an address on a **verified** Resend domain in production (see below). |

Both are already scaffolded in `.env.example`. Setting **either** to empty/unset keeps the feature
dormant (no send).

---

## A. Production turn-on (brand domain — founder-owned deploy step)

Do this once, when `portsmith.app` (or the chosen brand domain) is ready to send email.

1. **Verify the domain in Resend.**
   - In the Resend dashboard → **Domains** → **Add Domain** → enter `portsmith.app`.
   - Add the DNS records Resend shows (SPF/`TXT`, DKIM `CNAME`s, and the recommended DMARC record)
     at the domain's DNS host. Wait for Resend to mark the domain **Verified**.
2. **Create an API key.** Resend dashboard → **API Keys** → **Create** (sending permission). Copy it
   once (it is shown only at creation).
3. **Set the env vars in the host (Vercel).**
   - `RESEND_API_KEY` = the key from step 2.
   - `RESEND_FROM_EMAIL` = `notifications@portsmith.app` (an address on the verified domain).
   - Set both on the Production environment; redeploy so the running build picks them up.
4. **Confirm `NEXT_PUBLIC_SITE_URL` is the production origin** — the email's "Reply in your inbox"
   button links to `siteUrl('/dashboard/inbox')`, which is derived from this env (never the request
   Host). If it is still `localhost`, the button will point at localhost.
5. **Post-deploy verification — send a real test contact.**
   - Open a **published** portfolio's public page and submit the contact form with a real message.
   - Confirm the portfolio **owner** receives the email: correct subject
     (`New message from {sender} via Portsmith`), the full body, a working "Reply in your inbox"
     button to `…/dashboard/inbox`, and that hitting **Reply** addresses the **visitor's** email
     (Reply-To), not the platform sender.
   - Confirm the visitor still saw a normal success state, and the message also appears in the
     owner's dashboard inbox.

If the email does not arrive: the submission still succeeded (the message is in the inbox). Check
the Resend dashboard **Logs** for the send, and the server logs for a `[notify] Resend send …`
line (the swallowed error is logged, never thrown).

---

## B. $0 local-dev proof (no domain required — D-04)

You can prove the end-to-end wiring **before** any domain is verified, at no cost, using Resend's
shared test sender `onboarding@resend.dev`. The catch: `onboarding@resend.dev` delivers **only to
the email address of the Resend account owner** — so this proves delivery to *yourself*, which is
exactly enough to confirm the seam fires and renders correctly.

1. **Get a personal Resend API key** (free tier). Note the email on the Resend account — call it
   `you@example.com`.
2. **Point the local env at the test sender.** In `.env.local`:
   ```
   RESEND_API_KEY=re_your_personal_key
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```
3. **Make sure the target portfolio's owner is `you@example.com`.** The email goes to the
   *portfolio owner's* account email (the trusted lookup), and `onboarding@resend.dev` only
   delivers to the Resend account owner — so seed/use a local portfolio whose owner account email
   is the same `you@example.com`. (The founder's local seed account is the natural choice.)
4. **Run the app locally and submit a contact message** to that portfolio's public page.
5. **Check your inbox.** You should receive the brand-faithful email. This confirms: the env guard
   opened, the owner lookup resolved, the HTML + plain-text rendered, and Resend accepted the send —
   all before owning a domain.

> Local-dev note: if `RESEND_*` are unset locally, the contact form still works end-to-end (message
> stored, generic success) — the send is simply skipped. That is the dormant default, and it is the
> correct behavior, not a failure.

---

## Rollback / kill-switch

To disable owner-notification emails without a code change: **unset `RESEND_API_KEY` (or
`RESEND_FROM_EMAIL`) and redeploy.** The route immediately returns to the dormant no-op — contact
messages are still stored and still readable in the dashboard inbox. There is nothing else to undo.
