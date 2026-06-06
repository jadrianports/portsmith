/**
 * /admin/templates — the Template Gating operator surface (GATE-04 / D-P12-08,
 * 12-05).
 *
 * The operator sets a template public ↔ restricted and grants/revokes a restricted
 * template to/from specific users. A SEPARATE surface from /admin (Trust & Safety) —
 * D-12 keeps /admin strictly trust-and-safety, so gating lives here (D-P12-08). This
 * RSC:
 *
 *   1. Is already GATED by `(admin)/layout.tsx` (getVerifiedClaims + the is_admin()
 *      RPC re-check). This page does NO second gate — it trusts the layout and reads
 *      the gating snapshot. (The actions it drives ALSO re-check admin server-side,
 *      defense-in-depth, since they are independently callable — T-06-18.)
 *   2. READS every template + its grant list via `getTemplateGating()` — the
 *      AUTHENTICATED admin cookie/RLS read (the `templates admin all` +
 *      `template_grants admin all` policies), never the elevated client (D-P12-16).
 *   3. Renders an H1 "Template Gating" + a `layout-template` glyph, then hands the
 *      snapshot to the `<TemplateGatingPanel>` client island.
 *
 * FORCE-DYNAMIC (operator-private; never statically cached). This is the chrome /
 * admin tree — it is NOT the public ISR `/[username]` route (which stays cookie-less
 * SSG/ISR; D-22 untouched). [CHROME] — Evergreen & Copper, Inter; imports NO template
 * token (two-layer identity, SHARED-E).
 *
 * Source: the RSC-loads-then-island idiom from `(admin)/admin/page.tsx`; the gating
 * read from `@/lib/admin/template-gating`; the panel island from
 * `@/components/admin/template-gating-panel`.
 */
import { LayoutTemplate } from 'lucide-react';

import { TemplateGatingPanel } from '@/components/admin/template-gating-panel';
import { getTemplateGating } from '@/lib/admin/template-gating';

/** Operator-private + always reflects current state — never ISR. */
export const dynamic = 'force-dynamic';

export default async function AdminTemplatesPage() {
  // Authenticated admin RLS read (NOT the elevated client — D-P12-16). The layout
  // already proved the caller is an admin.
  const templates = await getTemplateGating();

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 lg:p-8">
      {/* Header — H1 "Template Gating" + layout-template glyph. */}
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <LayoutTemplate
          aria-hidden="true"
          className="size-7 shrink-0 text-muted-foreground"
        />
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Template Gating
        </h1>
      </header>
      <p className="mb-6 max-w-prose text-sm text-muted-foreground">
        Set a template public or restricted, and grant or revoke a restricted
        template to specific users. Restricting a template, or revoking a grant,
        moves any affected portfolio to Editorial without losing its content.
      </p>

      <TemplateGatingPanel initial={templates} />
    </div>
  );
}
