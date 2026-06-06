/**
 * Admin template-gating read (GATE-04, 12-05) — every template + its grant list,
 * read via the AUTHENTICATED admin cookie/RLS client.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ READ BOUNDARY (D-P12-16, LOAD-BEARING):                                       │
 * │ The /admin/templates READ uses the AUTHENTICATED `createClient()` — never the │
 * │ elevated admin client. The `templates admin all` (004:239) + `template_grants │
 * │ admin all` (012) RLS policies already let an admin read every template +      │
 * │ grant; the elevated path is NEITHER needed NOR permitted on the Phase-12       │
 * │ gating surface (these tables have an admin-all RLS policy + NO protected-       │
 * │ columns trigger). Mirrors the `reports.ts` admin-RLS read boundary (T-06-W4).  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Per template the operator sees its `slug` / `name` / `visibility` and the list of
 * granted users (each `userId` + `username` + `email`, resolved by the
 * `template_grants → profiles` join so the operator can recognise the grantee). The
 * grant list is read in ONE query (newest grant first) keyed by `template_id`, then
 * folded onto its template — no per-template round-trip.
 *
 * `import 'server-only'` keeps the cookie/RLS read out of any client bundle (the
 * panel island receives the result as a plain serializable prop).
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** One granted user on a template (resolved via the `template_grants → profiles` join). */
export interface TemplateGrantee {
  userId: string;
  /** The grantee's username (joined); null only if the join breaks. */
  username: string | null;
  /** The grantee's email (joined) — operator-only surface, used to recognise the grantee. */
  email: string | null;
}

/** One template + its grant list — the per-card shape the panel renders. */
export interface TemplateGating {
  slug: string;
  name: string;
  /** Raw `templates.visibility` soft-enum value ('public' | 'restricted'). */
  visibility: string;
  /** The users granted this template (empty for a public template that has no grants). */
  grants: TemplateGrantee[];
}

/** The raw joined grant row Supabase returns before flattening. */
interface RawGrantRow {
  template_id: string;
  user_id: string;
  granted_at: string;
  profiles: { username: string | null; email: string | null } | null;
}

/**
 * Read every template + its grant list for the /admin/templates surface.
 * AUTHENTICATED admin RLS read (NOT service-role — D-P12-16). Returns `[]` on a
 * read error (the surface shows a calm load-error / empty state rather than
 * throwing). Templates are ordered by slug; each template's grants are ordered
 * newest-first.
 */
export async function getTemplateGating(): Promise<TemplateGating[]> {
  const supabase = await createClient();

  // 1) Active templates (the `templates admin all` / `templates public select`
  //    policies let the admin read every active row's visibility).
  const { data: templates, error: tErr } = await supabase
    .from('templates')
    .select('slug, name, visibility')
    .eq('is_active', true)
    .order('slug', { ascending: true });
  if (tErr) return [];

  // 2) Every grant row joined to its grantee profile (the `template_grants admin
  //    all` policy lets the admin read all grants). One query, folded by template_id.
  //    DISAMBIGUATION (load-bearing): template_grants has TWO FKs to profiles
  //    (`user_id` = grantee, `granted_by` = audit), so a bare `profiles(...)` embed
  //    is ambiguous and PostgREST errors ("more than one relationship found"),
  //    silently collapsing the whole surface to the empty state. Pin the embed to the
  //    grantee FK by its constraint name so we join the GRANTEE, not the granter.
  const { data: grants, error: gErr } = await supabase
    .from('template_grants')
    .select(
      'template_id, user_id, granted_at, profiles!template_grants_user_id_fkey(username, email)',
    )
    .order('granted_at', { ascending: false });
  if (gErr) return [];

  // We still need the slug↔id mapping to fold grants onto templates. Read the ids
  // alongside (the templates select above omits id intentionally — the panel keys
  // on slug — so read it here for the fold only).
  const { data: idRows, error: idErr } = await supabase
    .from('templates')
    .select('id, slug')
    .eq('is_active', true);
  if (idErr) return [];

  const slugForId = new Map<string, string>(
    (idRows ?? []).map((r) => [r.id, r.slug]),
  );

  const grantsBySlug = new Map<string, TemplateGrantee[]>();
  for (const g of (grants ?? []) as unknown as RawGrantRow[]) {
    const slug = slugForId.get(g.template_id);
    if (!slug) continue; // grant for an inactive/unknown template — skip
    const list = grantsBySlug.get(slug) ?? [];
    list.push({
      userId: g.user_id,
      username: g.profiles?.username ?? null,
      email: g.profiles?.email ?? null,
    });
    grantsBySlug.set(slug, list);
  }

  return (templates ?? []).map((t) => ({
    slug: t.slug,
    name: t.name,
    visibility: t.visibility,
    grants: grantsBySlug.get(t.slug) ?? [],
  }));
}
