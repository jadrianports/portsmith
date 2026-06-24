/**
 * getAvailableTemplates — the GATE-02 allowed-list (D-P12-14): the templates the
 * caller may use, resolved at the DATA LAYER (RLS), not merely hidden in the UI.
 * Returns `public ∪ granted-to-me` as `{ slug, restricted, category }[]` — `category`
 * rides alongside `restricted` as PLAIN serializable display-grouping metadata (D-02,
 * TCAT-01/03), the single DB source of truth, with a `'general'` safe-degrade. It is
 * grouping-only and does NOT change the allowed-list set.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ READ BOUNDARY (mirrors reports.ts, LOAD-BEARING):                            │
 * │ This is a `server-only` AUTHENTICATED `createClient()` read — NEVER the      │
 * │ privileged/elevated admin client and NEVER a `SECURITY DEFINER` RPC. The RLS │
 * │ `template_grants own select` policy (012) is EXACTLY the GATE-02             │
 * │ enforcement — a DEFINER RPC would BYPASS it and break the gate. The two      │
 * │ plain SELECTs below run under the caller's own cookie/RLS, so the grant      │
 * │ read returns ONLY the caller's own grants. `import 'server-only'` keeps the  │
 * │ cookie/RLS read (and the DB shape) off any client bundle (D-25); the         │
 * │ dashboard RSC threads the result into the zod-free picker as a PLAIN prop.   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * DIVERGENCE from `reports.ts` (which is admin-all): this reads the caller's OWN
 * rows, not everyone's — there is NO `is_admin()` here, and NO elevated client. The
 * own-grant scoping is the `template_grants own select` RLS policy, not app code.
 *
 * The two reads:
 *   1. `templates` where `is_active = true AND visibility = 'public'` — every public
 *      template (readable by any authenticated caller via `templates public select`).
 *   2. `template_grants` (RLS-scoped to the caller's own rows) embedding the granted
 *      template's `slug/visibility/is_active` — the caller's own grants.
 * A public template carries `restricted = false`; a granted active-restricted
 * template carries `restricted = true` (the picker's copper "Exclusive" marker,
 * D-P12-09). A public-AND-granted template stays `false` (public wins — it is not an
 * exclusive thing to hold).
 *
 * Returns `[]` on a read error (the picker shows a calm empty state, never throws —
 * the reports.ts idiom).
 */
import 'server-only';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/**
 * One entry in the GATE-02 allowed-list. `slug` is a template the caller may switch
 * to; `restricted` is `true` only for a GRANTED active-restricted template (it drives
 * the picker's copper "Exclusive" marker — D-P12-09). This is PLAIN serializable data
 * (no zod, no DB type) — safe to thread through the dashboard RSC into the client
 * picker as a prop.
 */
export interface AllowedTemplate {
  slug: string;
  restricted: boolean;
  /**
   * The template's profession category (dev / marketer / creative / video / general).
   * Display-only GROUPING metadata (TCAT-01/03) — it rides this read as a PLAIN
   * serializable prop exactly like `restricted`, the single DB source of truth (D-02).
   * A null/unknown value safe-degrades to `'general'` (the `slugForTemplateId`
   * `?? '<default>'` idiom), so no allowed card is ever dropped. It does NOT touch the
   * allowed-list (GATE-02) logic — categorization re-buckets already-allowed rows only.
   */
  category: string;
}

/** The raw embedded-template shape Supabase returns on the grant read before flatten. */
interface GrantRow {
  templates: {
    slug: string;
    visibility: string;
    is_active: boolean;
    category: string | null;
  } | null;
}

/**
 * Resolve the caller's allowed templates (`public ∪ granted-to-me`) under the
 * AUTHENTICATED RLS client (never a privileged/elevated client). The own-grant
 * scoping is RLS (`template_grants own select`), so this read returns only the
 * caller's own grants — that scoping IS the GATE-02 enforcement. Returns `[]` on a
 * read error.
 */
export async function getAvailableTemplates(): Promise<AllowedTemplate[]> {
  // CR-04 / AUTH-05: verify identity before any read. The sole caller is the
  // auth-gated dashboard RSC, but an unauthenticated call would otherwise run as the
  // anon role and silently return the public templates as a "valid" allowed-list.
  const claims = await getVerifiedClaims();
  if (!claims) return [];

  const supabase = await createClient();

  // 1) Public templates — visible to any authenticated caller (`templates public
  //    select`, is_active=true). These are `restricted = false`.
  const { data: pub, error: pubError } = await supabase
    .from('templates')
    .select('slug, visibility, category')
    .eq('is_active', true)
    .eq('visibility', 'public');
  if (pubError) return [];

  // 2) The caller's OWN grants (RLS `template_grants own select` scopes the read —
  //    NO `is_admin()`, NO elevated client). Embed the granted template's slug/
  //    visibility/is_active so a granted active-restricted template carries the mark.
  const { data: granted, error: grantError } = await supabase
    .from('template_grants')
    .select('templates(slug, visibility, is_active, category)');
  if (grantError) return [];

  // Build a slug→{restricted, category} map: public first (restricted=false). A granted
  // active-restricted template adds restricted=true. A slug already present as public
  // stays false (public wins — it is not an exclusive thing to hold). `category` rides
  // alongside `restricted` as the single DB source of truth (D-02); a null/missing value
  // safe-degrades to 'general' HERE at the data layer (the `slugForTemplateId` idiom), so
  // no allowed card is ever dropped and the picker never sees an un-categorized slug.
  const out = new Map<string, { restricted: boolean; category: string }>();
  for (const t of pub ?? []) {
    out.set(t.slug, { restricted: false, category: t.category ?? 'general' });
  }
  for (const g of (granted ?? []) as unknown as GrantRow[]) {
    const t = g.templates;
    if (t?.is_active && t.visibility === 'restricted' && !out.has(t.slug)) {
      out.set(t.slug, { restricted: true, category: t.category ?? 'general' });
    }
  }

  return [...out].map(([slug, { restricted, category }]) => ({ slug, restricted, category }));
}
