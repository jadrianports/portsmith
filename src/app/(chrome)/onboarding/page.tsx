/**
 * The onboarding wizard — `/onboarding` (18-04 / ONB-02 / ONB-03 / D-05 / D-19).
 *
 * This RSC is the wizard's entry: the headline first-run experience that WRAPS the
 * already-shipped CMS machinery (template picker, section forms, publish path) in a
 * stepped chrome shell. It is the structural twin of the `/dashboard` RSC
 * (`(chrome)/(dashboard)/dashboard/page.tsx`) — placed as a SIBLING inside
 * `(chrome)`, NOT nested under `(dashboard)`, so it inherits the chrome tokens (D-19)
 * but is structurally independent of the gate-bearing dashboard page (RESEARCH Risk 4).
 * `/onboarding` is middleware-protected (authenticated-only, 18-03); this page also
 * re-gates at the boundary (defense-in-depth).
 *
 * On every load it clones the dashboard's defense-in-depth sequence:
 *   1. AUTH-GATE via `getVerifiedClaims()` (verified JWT, AUTH-05 — NEVER getSession)
 *      → `redirect('/login')` on no session.
 *   2. IDEMPOTENT BOOTSTRAP via `ensurePortfolio()` (a cheap no-op after the first
 *      call; the first call seeds the 7 default sections) → `redirect('/login')` on
 *      a null return.
 *   3. Resolve the caller's OWN username from the verified row (WR-05: a missing `sub`
 *      is a HARD auth failure, never coerced to '').
 *   4. OWNER READ of the owner's OWN unpublished portfolio INCLUDING HIDDEN SECTIONS
 *      (`{ includeHidden: true }`) — the SINGLE data source for the resume predicate
 *      AND the embedded forms (the wizard edits the same unpublished portfolio the
 *      editor does).
 *   4a. GATE-02 allowed-list (`getAvailableTemplates()`) for the picker — threaded as
 *      the PLAIN serializable `{ slug, restricted }[]` (keeps zod/registry off the
 *      client bundle, D-25).
 *   5. DERIVE the resume step (`deriveOnboardingStep`) over the owner read so a
 *      returning user lands on their last-incomplete step (D-03/D-17).
 *
 * TWO-LAYER IDENTITY (SHARED-E, LOAD-BEARING): this page imports NO template
 * component and NO template token. `resolveSpec` (used below to compute the
 * spec-gated step set, D-09) is a SERVER-only helper — its result is reduced to a
 * plain `string[]` of supported step keys before it crosses into the client shell, so
 * zod/`registry.ts` never reach the client bundle. The ONLY template surface in the
 * whole wizard is the inline preview iframe (a separate document) inside the client
 * Template step.
 *
 * PUBLIC ISR UNTOUCHED (D-22): this is an authenticated chrome surface; it adds NO
 * `cookies()`/`headers()`/host-read to the public read branch (the username is
 * resolved from the verified profile row, never the request host).
 *
 * NEXT 16: this is an RSC; `cookies()` (read transitively inside `createClient`) is
 * async and awaited there. `redirect()` is called at the top level (it throws
 * NEXT_REDIRECT — never inside a try/catch that would swallow it).
 */
import { redirect } from 'next/navigation';

import { ensurePortfolio } from '@/lib/cms/bootstrap-portfolio';
import { deriveOnboardingStep } from '@/lib/cms/onboarding-step';
import { getPortfolioOwnerByUsername } from '@/lib/portfolio/get-portfolio-owner';
import { getAvailableTemplates } from '@/lib/templates/available-templates';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { resolveSpec } from '@/components/templates/registry';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import {
  ONBOARDING_STEP_ORDER,
  STEP_SECTION_TYPE,
} from '@/components/onboarding/steps';

/** The wizard is owner-private + always reflects last-saved (unpublished) state. */
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  // 1) AUTH GATE — verified identity only (AUTH-05, never getSession). No session
  //    → bounce to login (the middleware also guards /onboarding, 18-03).
  const claims = await getVerifiedClaims();
  if (!claims) redirect('/login');

  // 2) IDEMPOTENT BOOTSTRAP on load (cheap no-op after the first call; seeds the 7
  //    default sections on the first). A null return means no valid session at the
  //    RPC boundary → bounce to login.
  const bootstrap = await ensurePortfolio();
  if (!bootstrap) redirect('/login');

  // 3) Resolve the caller's OWN username from the verified profile row (PUB-03 —
  //    never the request host). WR-05: a missing `sub` is a HARD auth failure, never
  //    coerced to '' (which would make the read a guaranteed 0-row no-op).
  const supabase = await createClient();
  const sub = (claims as { sub?: string }).sub;
  if (!sub) redirect('/login');
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('username, locked')
    .eq('id', sub)
    .maybeSingle();
  // A suspended account must never load an authed surface (mirrors the dashboard
  // defense-in-depth re-check; `locked` is owner-readable for the own row under RLS).
  if ((profileRow as { locked?: boolean } | null)?.locked === true) {
    redirect('/login');
  }
  const username = (profileRow as { username?: string } | null)?.username ?? '';
  if (!username) {
    // A verified session with no profile row should not happen post-bootstrap.
    redirect('/login');
  }

  // 4) Owner read — the SINGLE data source for the resume predicate AND the embedded
  //    forms. INCLUDING HIDDEN SECTIONS (`{ includeHidden: true }`) so the wizard sees
  //    every section the same way the editor does (the steps edit the same unpublished
  //    portfolio). Owner-only by construction (it re-confirms ownership from claims.sub).
  const data = await getPortfolioOwnerByUsername(username, { includeHidden: true });
  if (!data) redirect('/login');

  // 4a) GATE-02 allowed-list for the picker (public ∪ granted-to-me). PLAIN
  //     serializable `{ slug, restricted }[]` — threaded as a prop so zod/DB never
  //     reach the client bundle (D-25). The picker is UX-narrowing only; the SOLE
  //     write-time grant authority is `switchTemplateAction` (GATE-02).
  const allowedTemplates = await getAvailableTemplates();

  // 4b) SPEC-GATED STEP SET (D-09): a content step auto-hides when the CHOSEN template
  //     marks that section `supported: false` in its `spec.ts`. `resolveSpec` is a
  //     SERVER-only helper (it lives in `registry.ts`, which carries zod) — we reduce
  //     its result to a plain `string[]` of supported step keys HERE so the client
  //     shell never imports the registry/zod. Template + Publish are always present;
  //     the content steps (hero/about/projects/contact) ride the chosen spec's
  //     `supported` flag. Today every public template supports all four → the full
  //     six steps render; the contract is future-proof for a template that drops one.
  const spec = resolveSpec(data.templateSlug);
  const visibleSteps = ONBOARDING_STEP_ORDER.filter((step) => {
    const sectionType = STEP_SECTION_TYPE[step];
    // Template + Publish carry no section type → always shown. A content step shows
    // only if the chosen template's spec marks that section `supported`.
    if (sectionType == null) return true;
    return spec.sections[sectionType]?.supported === true;
  });

  // 5) DERIVE the resume step (D-03/D-17) — the placeholder-aware predicate over the
  //    owner read (seeded-but-untouched reads as NOT done). A returning user lands on
  //    their last-incomplete step; a fresh user lands on Template.
  const resumeStep = deriveOnboardingStep({
    displayName: data.profile.display_name,
    avatarUrl: data.profile.avatar_url,
    published: data.published,
    // The public view columns are all `| null` — coalesce `type` to '' so a malformed
    // row simply matches no step predicate (it is never one of the named section types).
    sections: data.sections.map((s) => ({ type: s.type ?? '', content: s.content })),
  });

  return (
    <OnboardingWizard
      username={username}
      currentTemplateSlug={data.templateSlug}
      published={data.published}
      allowedTemplates={allowedTemplates}
      visibleSteps={visibleSteps}
      resumeStep={resumeStep}
    />
  );
}
