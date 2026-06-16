/**
 * Contact section (D-P7-10 section 7) — the Newsprint live contact (07-UI-SPEC A.7
 * §7). Mirrors `minimal/sections/contact.tsx`'s FROZEN `SectionProps` contract +
 * `present()` + content cast + null-guard + `safeHref` + the LIVE `<ContactForm>`
 * wiring EXACTLY; the visual body is the editorial layout. `index.tsx` wraps this in
 * `<ScrollReveal as="section">`, so this renders the section's INNER content.
 *
 * LIVE WIRING (Architecture Note #5 / CONT-01/02/03 — Phase-6 COMPLETE). The contact
 * write path, inbox, and rate-limit exist and are TEMPLATE-AGNOSTIC. This server
 * section hosts the live `<ContactForm>` client island exactly as `minimal` does: it
 * reads `section.portfolio_id` (present on the `public_sections` row) and, when
 * present, renders the island (real `<form>` + Turnstile + POST `/api/contact` +
 * idle/submitting/success/error states). It is NOT a P3-style inert shell. The FROZEN
 * `SectionProps = { section }` is preserved (NO new prop). When the portfolio id is
 * absent, ONLY the public-email `mailto:` fallback renders — never a dead form.
 *
 * The `<ContactForm>` island reads scoped `var(--token)` + the SHARED
 * `.tmpl-contact-field` / `.tmpl-contact-spinner` / `.tmpl-contact-success-pulse`
 * class hooks — which `editorial/theme.css` defines scoped to `.tmpl-editorial` (the
 * vermilion focus ring, A.7 §7). So the same template-agnostic island renders in the
 * Newsprint palette automatically. Error/success/Turnstile copy is inherited from the
 * live Phase-6 contract — NOT re-declared here.
 *
 * PUBLIC CONTACT DETAILS from SETTINGS (Phase 25 — D-07/D-08): the public email,
 * location, and phone are read from `data.settings` (the single source of truth),
 * threaded in by `index.tsx` as the scoped `ContactExtraProps`. This REPLACES the
 * Phase-24-killed seed-copied `content.email_public` idiom (D-07); the frozen global
 * `SectionProps` is NOT widened (D-08). Each field is omit-if-absent — email →
 * `mailto:` via `safeHref(...,{allowMailto:true})`, location + phone as plain text
 * rows (phone is NOT a `tel:` link — RESEARCH OQ-2), in editorial's newsprint voice.
 *
 * LAYOUT (A.7 §7): mono `07 — CONTACT` kicker, the heading (`contact.heading`) +
 * subhead (`contact.subheading`) above an ink rule, then the live ruled form (thin ink
 * borders, vermilion `:focus-visible` ring) + the Turnstile slot + the mailto fallback.
 *
 * COPY: solo-individual framing ONLY (D-12/D-13 — first person, never "team").
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
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

/** Mono kicker label — uppercase JetBrains Mono. */
const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'var(--muted-fg)',
  margin: 0,
};

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
  // built through the shared guard with `allowMailto` (CR-01). The address is
  // interpolated literally — the `@` MUST stay literal (percent-encoding it breaks the
  // recipient in many mail clients). Phone renders as plain text (NOT tel: — OQ-2).
  const emailPublic = present(emailPublicProp) ? emailPublicProp : null;
  const location = present(locationProp) ? locationProp : null;
  const phone = present(phoneProp) ? phoneProp : null;
  const mailtoHref = emailPublic
    ? safeHref(`mailto:${emailPublic}`, { allowMailto: true })
    : undefined;

  return (
    <div
      id="contact"
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: 'clamp(64px, 12vh, 120px)',
      }}
    >
      {/* Mono kicker `07 — CONTACT` above an ink rule. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={kickerStyle}>07 — Contact</p>
        <div
          aria-hidden="true"
          style={{ height: '1px', width: '100%', background: 'var(--fg)' }}
        />
      </div>

      {/* Heading (Fraunces, ink — not the accent). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          lineHeight: 1.15,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* Subhead — Body in --muted-fg, capped measure. */}
      <p
        className="tmpl-measure"
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: 1.5,
          color: 'var(--muted-fg)',
          margin: 0,
        }}
      >
        {subheading}
      </p>

      {/* Contact details from SETTINGS (Phase 25 / D-07) — email (mailto:), location,
          phone, each omit-if-absent, in editorial's newsprint voice (mono uppercase
          label in --muted-fg, value in --fg). Phone is plain text (NOT tel: — OQ-2).
          The row renders only when at least one detail is present. */}
      {emailPublic || location || phone ? (
        <ul
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px 56px',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {emailPublic && mailtoHref ? (
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={kickerStyle}>Email</span>
              <a
                href={mailtoHref}
                className="tmpl-project-link"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--accent)',
                }}
              >
                {emailPublic}
              </a>
            </li>
          ) : null}
          {location ? (
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={kickerStyle}>Location</span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--fg)',
                }}
              >
                {location}
              </span>
            </li>
          ) : null}
          {phone ? (
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={kickerStyle}>Phone</span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--fg)',
                }}
              >
                {phone}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* LIVE WIRING (Architecture Note #5 / CONT-01/02/03): the `<ContactForm>` client
          island when the portfolio id is present on the section row
          (`public_sections.portfolio_id`; the FROZEN `SectionProps = { section }` is
          preserved, NO new prop). The island owns the real `<form>` + Turnstile +
          submit + states, reusing the SAME `.tmpl-contact-field` hooks (defined in
          editorial/theme.css with the vermilion focus ring) so it renders in the
          Newsprint palette. If the portfolio id is absent, render ONLY the mailto
          fallback (never a dead form). */}
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
              className="tmpl-project-link"
              style={{ color: 'var(--accent)' }}
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
