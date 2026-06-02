/**
 * Contact-form validation (FND-04).
 *
 * The request body for POST /api/contact (docs/04). That route is the SOLE writer
 * to the `messages` table (no public INSERT policy — ADR-004); it re-parses this
 * schema server-side before the service-role insert. Client-side parse is UX; the
 * server-boundary parse is the real gate (CLAUDE.md).
 *
 * Shape (docs/04): `{ portfolio_id, sender_name, sender_email, subject?, body,
 * turnstile_token }`. The `turnstile_token` is required and verified server-side
 * against Cloudflare `siteverify`; it is NOT stored (the `messages` table dropped
 * that column — docs/01).
 */
import { z } from 'zod';

export const contactFormSchema = z.object({
  // A Postgres `uuid` column accepts ANY 8-4-4-4-12 GUID-format string — it does
  // NOT enforce the RFC 4122 version/variant bits that Zod's stricter `z.uuid()`
  // requires. Use `z.guid()` so the boundary validator matches what the DB accepts
  // (a portfolio_id that Postgres stores must never be rejected here).
  portfolio_id: z.guid({ error: 'A valid portfolio id is required' }),
  sender_name: z
    .string()
    .min(1, { error: 'Your name is required' })
    .max(100, { error: 'Name must be at most 100 characters' }),
  sender_email: z.email({ error: 'A valid email is required' }).max(320),
  subject: z.string().max(200, { error: 'Subject must be at most 200 characters' }).optional(),
  body: z
    .string()
    .min(1, { error: 'Message body is required' })
    .max(5000, { error: 'Message must be at most 5000 characters' }),
  turnstile_token: z.string().min(1, { error: 'Turnstile verification is required' }),
});

export type ContactForm = z.infer<typeof contactFormSchema>;

/**
 * Report validation (SAFE-03) — the sibling of `contactFormSchema`.
 *
 * The request body for POST /api/report (the second service-role sole-writer, a
 * mirror of /api/contact — D-16). `reports` has NO public INSERT policy, so the
 * route is the only writer; it re-parses this schema server-side before the
 * service-role insert. Client-side parse is UX; the server-boundary parse is the
 * real gate (CLAUDE.md).
 *
 * Shape: `{ portfolio_id, reason, details?, turnstile_token }`. The
 * `turnstile_token` is required and verified server-side; it is NOT stored.
 *
 * The `reason` is the HUMAN-reportable subset of the `reports.reason` CHECK enum
 * (migration 001:235 — `'auto_flagged','hate_speech','illegal_content','spam',
 * 'harassment','other'`). `auto_flagged` is RESERVED for a future automated signal
 * and is deliberately NOT offered to humans (D-17): a user-submitted `auto_flagged`
 * (or any value outside this enum) is rejected at this boundary, so the route
 * returns 400 before any write.
 */
export const reportSchema = z.object({
  // Same `z.guid()` posture as `contactFormSchema.portfolio_id` above: a Postgres
  // `uuid` column accepts ANY 8-4-4-4-12 GUID-format string and does NOT enforce the
  // RFC 4122 version/variant bits that the stricter `z.uuid()` requires — so a
  // portfolio_id Postgres stores must never be over-rejected here.
  portfolio_id: z.guid({ error: 'A valid portfolio id is required' }),
  // HUMAN subset of the reports CHECK enum — NO `auto_flagged` (reserved, D-17).
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'illegal_content', 'other'], {
    error: 'Please choose a reason',
  }),
  details: z.string().max(2000, { error: 'Details must be at most 2000 characters' }).optional(),
  turnstile_token: z.string().min(1, { error: 'Turnstile verification is required' }),
});

export type ReportForm = z.infer<typeof reportSchema>;
