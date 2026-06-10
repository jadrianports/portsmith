/**
 * Page-view beacon validation (ANLY-01 / D-04) — the `/api/page-view` server gate.
 *
 * The request body for POST /api/page-view (Plan 03). That route is the SOLE writer
 * to the `page_views` table (no public INSERT policy — ADR-004); it re-parses this
 * schema server-side before the service-role insert. The beacon is fire-and-forget,
 * so there is NO client-side parse — the server-boundary parse is the ONLY gate
 * (CLAUDE.md). Unlike `contactFormSchema`/`reportSchema` there is **no
 * `turnstile_token`**: a high-volume page-view beacon does not use Turnstile (a
 * human-friction gate for low-volume writes); the flood-guard rate-limit is the
 * abuse gate (D-04 / D-08).
 *
 * Shape (15-RESEARCH.md § Code Examples §2): `{ portfolio_id, path, referrer_host?,
 * utm_source?, utm_medium? }`. The beacon sends the referrer HOST only (D-10 — also
 * all the browser exposes under `strict-origin-when-cross-origin`); the route maps
 * `referrer_host` → the existing `referrer` column and stores raw host + raw UTM,
 * bucketed at READ time (D-18). No raw IP is ever in this shape (D-09).
 */
import { z } from 'zod';

export const pageViewSchema = z.object({
  // A Postgres `uuid` column accepts ANY 8-4-4-4-12 GUID-format string — it does
  // NOT enforce the RFC 4122 version/variant bits that the stricter Zod UUID format
  // requires. Use the top-level GUID format (matching `contactFormSchema.portfolio_id`)
  // so the boundary validator matches what the DB accepts — a portfolio_id Postgres
  // stores must never be over-rejected here.
  portfolio_id: z.guid({ error: 'A valid portfolio id is required' }),
  // Bound the path to a sane length; it is stored verbatim and rendered as plain
  // text (React escapes on render — no HTML/SQL interpolation).
  path: z.string().min(1).max(2048),
  // Source attribution (D-10) — all optional/nullable; raw host + raw UTM, bucketed
  // at READ time via `toSourceBucket` (D-18).
  referrer_host: z.string().max(255).nullish(),
  utm_source: z.string().max(255).nullish(),
  utm_medium: z.string().max(255).nullish(),
});

export type PageView = z.infer<typeof pageViewSchema>;
