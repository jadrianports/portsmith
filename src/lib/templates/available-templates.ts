/**
 * getAvailableTemplates — the GATE-02 allowed-list (D-P12-14): the templates the
 * caller may use, resolved at the DATA LAYER (RLS), not merely hidden in the UI.
 * Returns `public ∪ granted-to-me` as `{ slug, restricted }[]`.
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

import { createClient } from '@/lib/supabase/server';

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
}

/** The raw embedded-template shape Supabase returns on the grant read before flatten. */
interface GrantRow {
  templates: { slug: string; visibility: string; is_active: boolean } | null;
}

/**
 * Resolve the caller's allowed templates (`public ∪ granted-to-me`) under the
 * AUTHENTICATED RLS client (never a privileged/elevated client). The own-grant
 * scoping is RLS (`template_grants own select`), so this read returns only the
 * caller's own grants — that scoping IS the GATE-02 enforcement. Returns `[]` on a
 * read error.
 */
export async function getAvailableTemplates(): Promise<AllowedTemplate[]> {
  const supabase = await createClient();

  // 1) Public templates — visible to any authenticated caller (`templates public
  //    select`, is_active=true). These are `restricted = false`.
  const { data: pub, error: pubError } = await supabase
    .from('templates')
    .select('slug, visibility')
    .eq('is_active', true)
    .eq('visibility', 'public');
  if (pubError) return [];

  // 2) The caller's OWN grants (RLS `template_grants own select` scopes the read —
  //    NO `is_admin()`, NO elevated client). Embed the granted template's slug/
  //    visibility/is_active so a granted active-restricted template carries the mark.
  const { data: granted, error: grantError } = await supabase
    .from('template_grants')
    .select('templates(slug, visibility, is_active)');
  if (grantError) return [];

  // Build a slug→restricted map: public first (restricted=false). A granted
  // active-restricted template adds restricted=true. A slug already present as public
  // stays false (public wins — it is not an exclusive thing to hold).
  const out = new Map<string, boolean>();
  for (const t of pub ?? []) {
    out.set(t.slug, false);
  }
  for (const g of (granted ?? []) as unknown as GrantRow[]) {
    const t = g.templates;
    if (t?.is_active && t.visibility === 'restricted' && !out.has(t.slug)) {
      out.set(t.slug, true);
    }
  }

  return [...out].map(([slug, restricted]) => ({ slug, restricted }));
}
