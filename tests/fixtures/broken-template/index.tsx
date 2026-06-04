/**
 * THE NEGATIVE FIXTURE TEMPLATE — the D-P10-02 "prove RED" corpus (Phase-10 Plan 02).
 *
 * This is a DELIBERATELY-BROKEN template root that trips EVERY Wave-2/3 gate's reject
 * path. It exists SOLELY so each gate can assert a witnessed REJECT (a gate that has only
 * ever passed is untrusted). It is the inverted twin of `src/components/templates/minimal/`.
 *
 * HARD CONSTRAINT (D-P10-02a / T-10-02-NEGREG): this folder lives ONLY under
 * `tests/fixtures/` — it is ABSENT from `registry.ts` (`templateRegistry` / `TEMPLATE_UUIDS`
 * / `specRegistry`), `template-meta.ts`, and the picker, so it NEVER reaches a public
 * `/[username]` page. The gate harness loads it by FOLDER PATH, not via the registry. Plan
 * 10-03's `registry-consistency.test.ts` asserts this absence (a future accidental registry
 * add goes RED).
 *
 * COMPILES CLEAN (load-bearing): every break below is a GATE-level violation (source-text or
 * structural), NOT a TS error — a non-sanctioned `__html`, an external origin, a dropped
 * section, a missing null-guard, a dropped REQUIRED_TOKEN, a chrome token, an unknown import,
 * and an alt-less `<img>` all still `tsc --noEmit` clean. This keeps the rest of the suite
 * building while the gates do the rejecting.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ WHAT EACH GATE TRIPS ON (every break is DELIBERATE — this is the prove-RED corpus):  │
 * │                                                                                       │
 * │  security (D-13)      → (a) a NON-sanctioned dangerouslySetInnerHTML __html (not      │
 * │                            themeInitScript / personLdScriptHtml / jsonLdToScriptHtml) │
 * │                         (b) an EXTERNAL origin (https://evil.example/...) in <img src>│
 * │                         (c) an UNKNOWN/unallowlisted import (`canvas-confetti`)       │
 * │  a11y (B1)            → an <img> with NO alt attribute → axe `image-alt` serious/      │
 * │                         critical under wcag2a (the a11y gate's witnessed RED).        │
 * │                         Rendered in the POPULATED (variant=full) view since axe runs  │
 * │                         against the populated render (Pitfall 7).                     │
 * │  conformance (PIPE-05)→ (d) a section its spec marks supported:true (`contact`) is     │
 * │                            DROPPED (no data-section-type="contact" wrapper)           │
 * │                         (e) a null-guard BREAK — `profile.username.toUpperCase()`     │
 * │                            with no `?.`/`??` (throws / leaks on the all-null render)   │
 * │  isolation (D-17)     → theme.css adds a chrome `--color-*` token + an `@theme` block  │
 * │                         + a hardcoded hex outside the token block.                    │
 * │  token-conformance    → theme.css DROPS at least one REQUIRED_TOKEN (`--ring`).        │
 * │  budget (async cap)   → proven by the async-island-cap UNIT test, not a marker here.  │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 */
import './theme.css';

// (c) SECURITY REJECT — an UNKNOWN, unallowlisted dependency. `canvas-confetti` is NOT in
// scripts/template-allowlist.ts ALLOWED_IMPORT_SPECIFIERS → the dependency gate hard-fails
// (D-P10-03 unknown-dep). It is NOT installed; the gate scans the IMPORT SPECIFIER (source
// text), not installed-state, so this still `tsc --noEmit` clean is irrelevant — but to keep
// the suite building we declare the type locally and never call it at module load.
// eslint-disable-next-line
// @ts-expect-error — intentionally-missing module; the security gate reads the specifier text.
import confetti from 'canvas-confetti';

import { brokenFont } from './fonts';
import type { PortfolioData, PublicSection } from '@/components/templates/types';

void confetti; // referenced so the import is not elided before the gate scans the source.

function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

export default function BrokenTemplate({ data }: { data: PortfolioData }) {
  const { profile, sections } = data;

  // (e) CONFORMANCE / NULL-GUARD REJECT — dereferences `profile.username` (a `| null` view
  // column) with NO null-guard (`?.` / `??`). On the all-null render this throws / leaks
  // `undefined`/`null` into the DOM (PIPE-05 null-guard reject). The live templates always
  // guard this (`profile.username ?? ''`).
  const shoutName = (profile.username as string).toUpperCase();

  const fontVars = `${brokenFont.variable}`;

  // (a) SECURITY REJECT — a NON-sanctioned dangerouslySetInnerHTML. The __html is a
  // free-form, NON-allowlisted producer (not themeInitScript / personLdScriptHtml /
  // jsonLdToScriptHtml), so the security gate's sanctioned-__html allowlist rejects it.
  const untrustedHtml = `<span>${shoutName}</span>`;

  return (
    <div className={`tmpl-broken ${fontVars}`} data-template-root data-template-theme="dark">
      {/* (a) security: a NON-sanctioned __html producer → D-13 REJECT. */}
      <div dangerouslySetInnerHTML={{ __html: untrustedHtml }} />

      {/* B1 (a11y) + (b) security: an <img> with NO `alt` attribute (axe `image-alt`
          serious/critical under wcag2a — the a11y gate's witnessed RED) whose `src` is an
          EXTERNAL, non-Supabase-Storage origin (the external-origin security REJECT). One
          element trips BOTH the a11y gate and the external-origin security rule. */}
      <img src="https://evil.example/tracker.png" width={1} height={1} />

      {/* (d) conformance: the spec marks `contact` supported:true, but this root DROPS its
          wrapper (no data-section-type="contact") → PIPE-05 dropped-section REJECT. The
          other supported sections ARE rendered so only `contact` is the dropped pair. */}
      <section data-section-type="hero">
        <h1>{shoutName}</h1>
      </section>
      <section data-section-type="about">
        <p>{sectionOfType(sections, 'about')?.type}</p>
      </section>
      <section data-section-type="skills" />
      <section data-section-type="projects" />
      <section data-section-type="experience" />
      <section data-section-type="testimonials" />
      {/* NOTE: NO `<section data-section-type="contact">` — the deliberate dropped section. */}
    </div>
  );
}
