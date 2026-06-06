/**
 * Contact section (edgerunner section 7) — the synthwave contact panel (translated from
 * `synthwave-founder/src/components/sections/Contact.tsx`). Mirrors the FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty.
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the INNER
 * content.
 *
 * LIVE WIRING (CONT-01/03 / D-05). This server section hosts the live `<ContactForm>`
 * client island: it reads `section.portfolio_id` (present on the `public_sections` row)
 * and, when present, renders the island (real `<form>` + Turnstile + POST /api/contact
 * + idle/submitting/success/error states), reusing the SAME `.tmpl-contact-field`
 * class so the live form is pixel-identical. When the portfolio id is absent, ONLY the
 * public-email `mailto:` fallback renders — never a dead form.
 *
 * PUBLIC EMAIL via the content (Option A — additive optional `email_public` field on
 * the schemaless JSONB content, the SAME idiom minimal uses; no Postgres migration,
 * CMS-08). The seed copies `settings.email_public` → `contact.email_public`; this
 * renders the `mailto:` render-if-present.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import { ContactForm } from '@/components/public/contact-form';
import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';

/**
 * The contact content as it flows through the section contract: `ContactContent`
 * (validated at seed time) plus the OPTIONAL `email_public` the seed surfaces from
 * `settings.email_public` for the `mailto:` fallback (Option A). Optional ⇒ the mailto
 * simply hides when absent.
 */
type ContactSectionContent = ContactContent & { email_public?: string | null };

export function Contact({ section }: SectionProps) {
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Get in touch';
  const subheading = present(content.subheading)
    ? content.subheading
    : "Have an idea in mind? Let's talk";
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
      {/* Mono section label `07 / contact` (neon-cyan CRT label). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          fontWeight: 400,
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--neon-cyan)',
          margin: 0,
        }}
      >
        07 / contact
      </p>

      {/* Heading (Orbitron display, foreground — not gradient). */}
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

      {/* Subhead — Muted-Body. */}
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

      {/* The live `<ContactForm>` island when the portfolio id is present on the section
          row (the FROZEN `SectionProps = { section }` is preserved, NO new prop). If the
          id is absent, render ONLY the mailto fallback (never a dead form). */}
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
            <a
              href={mailtoHref}
              style={{ color: 'var(--neon-cyan)', textDecoration: 'underline' }}
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
