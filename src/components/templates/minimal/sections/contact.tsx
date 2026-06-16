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
 * PUBLIC CONTACT DETAILS from SETTINGS (Phase 25 — D-07/D-08): the public email,
 * location, and phone are read from `data.settings` (the SINGLE source of truth),
 * threaded in by `index.tsx` as the scoped `ContactExtraProps` (`emailPublic` /
 * `location` / `phone`). This REPLACES the Phase-24-killed seed-copied
 * `content.email_public` idiom (D-07). The frozen global `SectionProps` is NOT
 * widened (D-08) — the extra prop is Contact-scoped. Each field is omit-if-absent:
 * the email renders a `mailto:` link via `safeHref(...,{allowMailto:true})`; the
 * location + phone render as plain text rows (phone is NOT a `tel:` link —
 * RESEARCH OQ-2). Absent/empty ⇒ that row simply does not render (never a dead link
 * or empty row).
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
import type { ContactExtraProps, SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';

/** The validated JSONB contact content (heading/subheading) — null-guarded below. */
type ContactSectionContent = ContactContent;

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function Contact({
  section,
  emailPublic: emailPublicProp,
  location: locationProp,
  phone: phoneProp,
}: SectionProps & ContactExtraProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Get in touch';
  // The subhead is the locked D-12 copy unless the seed overrides it.
  const subheading = present(content.subheading)
    ? content.subheading
    : "Have an idea in mind? Let's talk";
  // Public contact details from SETTINGS (D-07) — omit-if-absent. The email mailto is
  // built through the shared guard with `allowMailto` (CR-01 belt-and-suspenders). The
  // address is interpolated literally — the `@` MUST stay literal (percent-encoding it
  // breaks the recipient in many mail clients); z.email() + the safeHref mailto guard
  // are the gates. Phone renders as plain text (NOT a tel: link — RESEARCH OQ-2).
  const emailPublic = present(emailPublicProp) ? emailPublicProp : null;
  const location = present(locationProp) ? locationProp : null;
  const phone = present(phoneProp) ? phoneProp : null;
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

      {/* Contact details from SETTINGS (Phase 25 / D-07) — email (mailto:), location,
          phone, each omit-if-absent. Mono labels in the cyan accent, values in the
          foreground. Phone is plain text (NOT a tel: link — RESEARCH OQ-2). The row
          renders only when at least one detail is present. */}
      {emailPublic || location || phone ? (
        <ul
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px 48px',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {emailPublic && mailtoHref ? (
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--accent-cyan)',
                }}
              >
                Email
              </span>
              <a
                href={mailtoHref}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  color: 'var(--fg)',
                  textDecoration: 'none',
                }}
              >
                {emailPublic}
              </a>
            </li>
          ) : null}
          {location ? (
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--accent-cyan)',
                }}
              >
                Location
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  color: 'var(--fg)',
                }}
              >
                {location}
              </span>
            </li>
          ) : null}
          {phone ? (
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--accent-cyan)',
                }}
              >
                Phone
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  color: 'var(--fg)',
                }}
              >
                {phone}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

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
