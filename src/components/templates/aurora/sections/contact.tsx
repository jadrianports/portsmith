/**
 * Contact section (aurora section 12) — the rosy live contact (translated from
 * `marketing-girl/src/components/Contact.tsx`). Mirrors the FROZEN `SectionProps`
 * contract + `present()` + content cast + null-guard + `safeHref` + the LIVE
 * `<ContactForm>` wiring EXACTLY. `index.tsx` wraps this in `<ScrollReveal as="section">`,
 * so this renders the INNER content.
 *
 * LIVE WIRING (CONT-01/02/03 — Phase-6 COMPLETE, template-agnostic). This server section
 * hosts the live `<ContactForm>` client island exactly as minimal/editorial do: it reads
 * `section.portfolio_id` and, when present, renders the island (real `<form>` + Turnstile
 * + POST `/api/contact` + states). The source's own `<form>` + hardcoded contact details
 * (phone/email/social with example.com URLs — must-strip findings) are DROPPED; the live
 * platform form + the optional public-email mailto fallback replace them.
 *
 * The `<ContactForm>` island reads scoped `var(--token)` + the SHARED `.tmpl-contact-field`
 * class hooks — which `aurora/theme.css` defines scoped to `.tmpl-aurora` (the rose focus
 * ring). When the portfolio id is absent, ONLY the mailto fallback renders — never a dead
 * form.
 *
 * COPY: solo-individual framing ONLY (D-12/D-13 — first person, never "team").
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import { ContactForm } from '@/components/public/contact-form';

import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/**
 * The contact content as it flows through the section contract: `ContactContent`
 * (validated at seed time) plus the OPTIONAL `email_public` the seed surfaces from
 * `settings.email_public` for the `mailto:` fallback. Optional ⇒ the mailto hides when absent.
 */
type ContactSectionContent = ContactContent & { email_public?: string | null };

export function Contact({ section }: SectionProps) {
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Get in touch';
  const subheading = present(content.subheading)
    ? content.subheading
    : "Have an idea in mind? Let's create marketing magic together.";
  const emailPublic = present(content.email_public) ? content.email_public : null;
  const mailtoHref = emailPublic
    ? safeHref(`mailto:${encodeURIComponent(emailPublic)}`, { allowMailto: true })
    : undefined;

  return (
    <div id="contact" className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Contact</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      <p
        className="tmpl-measure"
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: 1.55,
          color: 'var(--muted-fg)',
          margin: 0,
        }}
      >
        {subheading}
      </p>

      {/* LIVE WIRING: the `<ContactForm>` client island when the portfolio id is present
          on the section row (the FROZEN `SectionProps = { section }` is preserved). The
          island owns the real `<form>` + Turnstile + submit + states, reusing the SAME
          `.tmpl-contact-field` hooks (defined in aurora/theme.css with the rose focus
          ring). If the portfolio id is absent, render ONLY the mailto fallback. */}
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
            <a href={mailtoHref} className="tmpl-project-link" style={{ color: 'var(--accent)' }}>
              {emailPublic}
            </a>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
