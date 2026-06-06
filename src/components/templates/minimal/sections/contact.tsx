/**
 * Contact section (D-05 section 7) — UI-SPEC §"7. Contact". Replaces the 03-04
 * stub: the body is real, the SHARED `SectionProps` signature, the export name, and
 * the `index.tsx` wiring are UNCHANGED (frozen 03-04 contract — `index.tsx` is NOT
 * edited, no new prop). `index.tsx` already wraps this in `<ScrollReveal
 * as="section">`, so this renders the section's INNER content (no `<section>` of its
 * own).
 *
 * LIVE WIRING (06-02, CONT-01/03 / D-05). This server section now hosts the live
 * `<ContactForm>` client island: it reads `section.portfolio_id` (present on the
 * `public_sections` row — RESEARCH Open-Q1) and, when present, renders the island
 * (real `<form>` + Turnstile + POST `/api/contact` + idle/submitting/success/error
 * states). The FROZEN `SectionProps = { section }` is preserved (NO new prop). When
 * the portfolio id is absent, ONLY the public-email `mailto:` fallback renders —
 * never a dead form. The 03 design is untouched: the island reuses the SAME
 * `.tmpl-contact-field` / field + label styles, so the live form is pixel-identical.
 *
 * PUBLIC EMAIL via the content (Option A — additive field, NOT a contract change):
 * the FROZEN `SectionProps` passes this section ONLY its resolved `section` row, so
 * `data.settings.email_public` is NOT reachable here. Rather than widen the frozen
 * contract (which 03-05/06/07 depend on), the public email is surfaced INTO the
 * contact CONTENT as an OPTIONAL `email_public` field (the SAME idiom the hero uses
 * for `resume_url`): the seed copies `settings.email_public` → `contact.email_public`,
 * and this section renders the `mailto:` render-if-present. No public email ⇒ no
 * mailto element (never a dead/empty mailto). The field is additive on the
 * schemaless JSONB content — no Postgres migration (CMS-08).
 *
 * RENDER CONTRACT (UI-SPEC §7):
 *   - mono `07 / contact` label + the heading (`contact.heading`) + the subhead
 *     "Have an idea in mind? Let's talk" (`contact.subheading`).
 *   - the form SHELL: Name / Email / Message fields (magenta focus-ring on
 *     `:focus-visible` via the scoped `.tmpl-contact-field` class in theme.css) + a
 *     clearly-RESERVED Turnstile widget slot (placeholder, not wired) + the public
 *     email as a working `mailto:` + a clearly-styled but INERT "Send Message" button
 *     (magenta fill, dark-ink label `var(--bg)` = #0C0B1E in dark — never white).
 *   - the error-slot copy is authored for P6 but the shell is inert now.
 *
 * COPY: solo-individual framing ONLY (D-12/D-13 — first person, never "team").
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 * The button label is `var(--bg)` (dark ink on the magenta fill) — the UI-SPEC's
 * hard "never white on magenta" rule, AA-safe in both modes.
 */
import { ContactForm } from '@/components/public/contact-form';
import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';

/**
 * The contact content as it flows through the section contract: `ContactContent`
 * (validated at seed time) plus the OPTIONAL `email_public` the seed surfaces from
 * `settings.email_public` for the `mailto:` fallback (Option A). Optional ⇒ the
 * mailto simply hides when absent. The cast is local so the shape is explicit even
 * before `tsc` picks up the additive schema field.
 */
type ContactSectionContent = ContactContent & { email_public?: string | null };

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function Contact({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Get in touch';
  // The subhead is the locked D-12 copy unless the seed overrides it.
  const subheading = present(content.subheading)
    ? content.subheading
    : "Have an idea in mind? Let's talk";
  // The public-email mailto is render-if-present (Option A — sourced from
  // settings.email_public through the seed). Absent/empty ⇒ no mailto element. The
  // email is validated by `z.email()` (well-behaved), but the `href` is still built
  // through the shared guard with `allowMailto` (CR-01 belt-and-suspenders). The address
  // is interpolated literally — the `@` MUST stay literal (percent-encoding it breaks the
  // recipient in many mail clients); z.email() + the safeHref mailto guard are the gates.
  const emailPublic = present(content.email_public) ? content.email_public : null;
  const mailtoHref = emailPublic
    ? safeHref(`mailto:${emailPublic}`, { allowMailto: true })
    : undefined;

  return (
    <div
      id="contact"
      // `.tmpl-shell`: the shared centered max-width + horizontal gutter (theme.css).
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: '64px',
      }}
    >
      {/* Mono section label `07 / contact` (cyan, per the hero precedent). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent-cyan)',
          margin: 0,
        }}
      >
        07 / contact
      </p>

      {/* Heading (Clash Display Heading scale, foreground — not gradient). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2rem)',
          lineHeight: 1.2,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* Subhead — "Have an idea in mind? Let's talk" as Muted-Body. */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.5,
          color: 'var(--muted-fg)',
          margin: 0,
          maxWidth: '60ch',
        }}
      >
        {subheading}
      </p>

      {/* LIVE WIRING (06-02, CONT-01/03 / D-05): the inert shell is replaced by the
          `<ContactForm>` client island when the portfolio id is present on the
          section row (`public_sections.portfolio_id` — RESEARCH Open-Q1; the FROZEN
          `SectionProps = { section }` is preserved, NO new prop). The island owns the
          real `<form>` + Turnstile + submit + states, reusing the SAME
          `.tmpl-contact-field` / `fieldStyle` / `labelStyle` so it is pixel-identical
          to the locked 03 design. If the portfolio id is absent, render ONLY the
          mailto fallback (never a dead form). */}
      {present(section?.portfolio_id) ? (
        <ContactForm portfolioId={section.portfolio_id} emailPublic={emailPublic} />
      ) : emailPublic && mailtoHref ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            maxWidth: '640px',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Mailto-only fallback (no portfolio id ⇒ no live form, never a dead one). */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'var(--muted-fg)',
              margin: 0,
            }}
          >
            Prefer email? Reach me directly at{' '}
            <a
              href={mailtoHref}
              style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}
            >
              {emailPublic}
            </a>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
