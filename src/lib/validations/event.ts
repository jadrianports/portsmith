/**
 * Outbound-click event beacon validation (ANLY-05 / D-09) — the `/api/event` server gate.
 *
 * The request body for POST /api/event (Plan 04). That route is the SOLE writer to the
 * `analytics_events` table (no public INSERT policy — D-09); it re-parses this schema
 * server-side before the service-role insert. Like the page-view beacon, the click
 * beacon is fire-and-forget and framework-free, so there is NO client-side parse — the
 * server-boundary parse is the ONLY Zod gate (CLAUDE.md / D-08). There is no
 * `turnstile_token`: a high-volume, fire-and-forget click beacon does not use Turnstile;
 * the per-hashed-IP flood-guard rate-limit is the abuse gate (mirrors page-view).
 *
 * Shape: `{ portfolio_id, destination_host?, path?, kind? }`. `kind` is an OPTIONAL
 * client hint only — the server DERIVES the real `category` (social/contact/project/
 * other, D-10) from `destination_host` and never trusts a client-tagged category.
 * No raw IP is ever in this shape (D-09).
 */
import { z } from 'zod';

export const eventSchema = z.object({
  // A Postgres `uuid` column accepts ANY 8-4-4-4-12 GUID-format string — it does NOT
  // enforce the RFC 4122 version/variant bits the stricter Zod UUID format requires.
  // Use the top-level GUID format (matching pageViewSchema.portfolio_id) so the boundary
  // validator matches what the DB accepts — a stored portfolio_id must never over-reject.
  portfolio_id: z.guid({ error: 'A valid portfolio id is required' }),
  // The outbound link's destination host — bounded, optional/nullable. The server derives
  // the coarse `category` from this (D-10); it is never persisted as a category from the client.
  destination_host: z.string().max(255).nullish(),
  // The page path the click fired on — bounded, optional/nullable. Stored verbatim,
  // rendered as plain text (React escapes — no HTML/SQL interpolation).
  path: z.string().min(1).max(2048).nullish(),
  // Optional client hint for the link kind; the server derives the authoritative category.
  kind: z.string().max(32).nullish(),
});

export type EventPayload = z.infer<typeof eventSchema>;
