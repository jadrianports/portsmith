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
 * PUBLIC EMAIL via the content (Option A — additive field, NOT a contract change):
 * the seed copies `settings.email_public` → `contact.email_public`; this section
 * renders the `mailto:` render-if-present (the SAME idiom minimal uses).
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
import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';

/**
 * The contact content as it flows through the section contract: `ContactContent`
 * (validated at seed time) plus the OPTIONAL `email_public` the seed surfaces from
 * `settings.email_public` for the `mailto:` fallback (Option A). Optional ⇒ the mailto
 * simply hides when absent.
 */
type ContactSectionContent = ContactContent & { email_public?: string | null };

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

export function Contact({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Get in touch';
  // The subhead is the locked D-12 copy unless the seed overrides it.
  const subheading = present(content.subheading)
    ? content.subheading
    : "Have an idea in mind? Let's talk";
  // The public-email mailto is render-if-present (Option A). Absent/empty ⇒ no mailto.
  // The email is validated by `z.email()`, but the `href` is still built through the
  // shared guard with `allowMailto` (CR-01). The address is interpolated literally — the
  // `@` MUST stay literal (percent-encoding it breaks the recipient in many mail clients).
  const emailPublic = present(content.email_public) ? content.email_public : null;
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
