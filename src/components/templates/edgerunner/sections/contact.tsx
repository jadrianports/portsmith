/**
 * Contact section (edgerunner section 7) — the synthwave Direct Lines panel +
 * spinning-border live contact form (faithful clone of
 * `synthwave-founder/src/components/sections/Contact.tsx` with the fake form
 * replaced by the real platform `<ContactForm>` island, exactly as aurora does it).
 *
 * LAYOUT: 2-col `1fr / 1.4fr` grid (matching the export's `lg:grid-cols-[1fr_1.4fr]`).
 *   LEFT  — "Direct Lines" holo-panel: kicker + heading + subheading + optional mailto.
 *   RIGHT — conic-gradient SPINNING border wrapper (CSS-only, reduced-motion-zeroed by
 *           the blanket reset in theme.css) around the live `<ContactForm>` island.
 *
 * LIVE WIRING (CONT-01/03 / D-05) — mirrors aurora EXACTLY:
 *   `present(section?.portfolio_id)` → `<ContactForm portfolioId={…} emailPublic={…} />`
 *   else + emailPublic → mailto fallback panel only (never a dead form).
 *
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the INNER
 * content.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 * The spinning border uses `.tmpl-contact-spin-border` + `@keyframes tmpl-edgerunner-spin`
 * (already defined in theme.css).
 */
import { ContactForm } from '@/components/public/contact-form';
import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { present, sectionShellStyle } from './shared';
import { SectionHeading } from './ui/section-heading';

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
    : "Got a project, a problem, or just want to talk? Drop a transmission.";
  const emailPublic = present(content.email_public) ? content.email_public : null;
  const mailtoHref = emailPublic
    ? safeHref(`mailto:${emailPublic}`, { allowMailto: true })
    : undefined;

  return (
    <div
      id="contact"
      className="tmpl-shell"
      style={sectionShellStyle}
    >
      {/* Section header — centered eyebrow + big neon-glow title + optional subtitle. */}
      <SectionHeading
        eyebrow="// CONTACT"
        title={heading}
        description={subheading}
        accent="pink"
      />

      {/* 2-col grid: Direct Lines panel (left) + spinning-border form (right).
          Stacks to single column on mobile. */}
      <div className="tmpl-contact-grid">
        {/* LEFT: "Direct Lines" holo-panel — the export's `holo-panel rounded-2xl p-6`. */}
        <div
          className="tmpl-holo-panel"
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* "Direct Lines" heading — Orbitron display, neon-cyan (the export's exact label). */}
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1.2,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--neon-cyan)',
              margin: 0,
            }}
          >
            Direct Lines
          </h3>

          {/* Optional public email — neon mailto link (render-if-present). */}
          {emailPublic && mailtoHref ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Mail icon (inline SVG — template layer, no lucide import). */}
              <span
                aria-hidden="true"
                style={{
                  display: 'grid',
                  width: '40px',
                  height: '40px',
                  placeItems: 'center',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in oklab, var(--neon-pink) 40%, transparent)',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--neon-pink)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <a
                href={mailtoHref}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  color: 'var(--fg)',
                  textDecoration: 'none',
                  opacity: 0.9,
                }}
                className="tmpl-project-link"
              >
                {emailPublic}
              </a>
            </div>
          ) : null}

          {/* Status terminal line — the export's `> status: open to new transmissions`. */}
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in oklab, var(--neon-pink) 30%, transparent)',
              background: 'color-mix(in oklab, var(--bg) 60%, transparent)',
              padding: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              color: 'var(--neon-pink)',
            }}
          >
            {'>'}  status: open to new transmissions
          </div>
        </div>

        {/* RIGHT: spinning conic-gradient border wrapper + live form (or mailto fallback).
            The border ring is a `.tmpl-contact-spin-border` wrapper (defined in theme.css):
            a `position:relative; padding:1.5px` container whose `::before` pseudo carries
            the spinning `conic-gradient(…)` mask so only the ring is visible; the inner
            content sits above it via `position:relative; z-index:1`.
            Reduced-motion: the blanket reset in theme.css zeroes the spin via
            `animation:none !important` — the ring simply renders static.              */}
        <div className="tmpl-contact-spin-border" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            {/* LIVE WIRING: the `<ContactForm>` client island when the portfolio id is
                present on the section row (the FROZEN `SectionProps = { section }` is
                preserved — NO contract widening). The island owns the real `<form>` +
                Turnstile + submit + idle/submitting/success/error states, reusing the
                SAME `.tmpl-contact-field` hooks (defined in edgerunner/theme.css with the
                neon-pink focus ring).
                If the portfolio id is absent, render ONLY the mailto fallback — never
                a dead form (mirrors aurora exactly). */}
            {present(section?.portfolio_id) ? (
              <ContactForm portfolioId={section.portfolio_id} emailPublic={emailPublic} />
            ) : emailPublic && mailtoHref ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  padding: '24px',
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
        </div>
      </div>
    </div>
  );
}
