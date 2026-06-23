/**
 * Contact section (atelier section — "Contact") — a FAITHFUL clone of the export's
 * `Contact.tsx`: a kicker ("08 — Contact") + an OVERSIZED uppercase Bebas headline
 * ("Let's work together." with the last word in the acid accent), then a top-hairline
 * 12-column grid — LEFT a "Commissions & press" block with the big underlined mailto
 * link + a short note, RIGHT a "Studio" (location) block and an "Elsewhere" (socials)
 * block. The export's static form is replaced by the LIVE `<ContactForm>` island when a
 * portfolio id is present (template-agnostic), else the mailto stands alone.
 *
 * PUBLIC CONTACT DETAILS from SETTINGS (Phase 25 — D-07/D-08): email/location/phone/
 * socials are read from `data.settings` (the SINGLE source of truth), threaded in by
 * `index.tsx` as the Contact-scoped `ContactExtraProps`. The frozen global `SectionProps`
 * is NOT widened (D-08).
 *
 * SECURITY (T-25-04): the mailto goes through `safeHref(...,{allowMailto:true})`; each
 * social url goes through `safeHref` (http(s)-only — CR-01) and renders with
 * `target="_blank" rel="noopener noreferrer me"`. Socials are `Json | null` on the view →
 * `Array.isArray` + per-element shape-guard (T-25-06).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import { ContactForm } from '@/components/public/contact-form';

import type { ContactExtraProps, SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { kickerStyle, present } from './shared';
import { PLATFORM_LABELS, SocialIcon } from '../../_shared/social-icons';

export function Contact({
  section,
  emailPublic: emailPublicProp,
  location: locationProp,
  phone: phoneProp,
  socials: socialsProp,
}: SectionProps & ContactExtraProps) {
  const content = (section?.content ?? null) as ContactContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : "Let's work together";
  const subheading = present(content.subheading)
    ? content.subheading
    : 'Currently booking new work. Please include scope, dates, and a one-line description of the project.';

  const emailPublic = present(emailPublicProp) ? emailPublicProp : null;
  const location = present(locationProp) ? locationProp : null;
  const phone = present(phoneProp) ? phoneProp : null;
  const mailtoHref = emailPublic
    ? safeHref(`mailto:${emailPublic}`, { allowMailto: true })
    : undefined;

  // Socials: `Array.isArray`-guard, then per-element `String(platform)` + `safeHref(url)`.
  const socialItems = Array.isArray(socialsProp) ? socialsProp : [];
  const socials: { key: string; platform: string; href: string }[] = [];
  socialItems.forEach((s, i) => {
    const entry = s as { platform?: unknown; url?: unknown } | null;
    const platform = String(entry?.platform ?? '').trim();
    const href = safeHref(typeof entry?.url === 'string' ? entry.url : undefined);
    if (platform && href) socials.push({ key: `${platform}-${i}`, platform, href });
  });

  return (
    <div id="contact" className="tmpl-shell" style={{ paddingBlock: 'clamp(96px, 14vh, 160px)' }}>
      <p style={kickerStyle}>08 — Contact</p>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(3.5rem, 13vw, 14rem)',
          lineHeight: 0.82,
          textTransform: 'uppercase',
          color: 'var(--fg)',
          margin: '24px 0 0',
        }}
      >
        {heading}
      </h2>

      {/* Top-hairline 12-col grid. */}
      <div
        style={{
          marginTop: 'clamp(56px, 8vh, 96px)',
          paddingTop: 'clamp(48px, 6vh, 64px)',
          borderTop: '1px solid var(--border-strong)',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: '48px',
        }}
      >
        {/* LEFT — Commissions & press: the big underlined mailto + note (cols 1–6). */}
        <div className="tmpl-contact-left" style={{ gridColumn: 'span 12', minWidth: 0 }}>
          <p style={{ ...kickerStyle, color: 'var(--muted-fg)' }}>Commissions &amp; press</p>
          {emailPublic && mailtoHref ? (
            <a
              href={mailtoHref}
              style={{
                display: 'inline-block',
                marginTop: '16px',
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: 'clamp(1.75rem, 4vw, 3.5rem)',
                lineHeight: 1,
                textTransform: 'uppercase',
                color: 'var(--fg)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--accent)',
                textDecorationThickness: '3px',
                textUnderlineOffset: '10px',
              }}
              className="tmpl-link"
            >
              {emailPublic}
            </a>
          ) : null}
          <p
            style={{
              marginTop: '24px',
              maxWidth: '28rem',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'var(--muted-fg)',
            }}
          >
            {subheading}
          </p>
        </div>

        {/* RIGHT — Studio (location/phone) + Elsewhere (socials) (cols 7–12). */}
        <div
          className="tmpl-contact-right"
          style={{
            gridColumn: 'span 12',
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '40px',
          }}
        >
          {location || phone ? (
            <div>
              <p style={{ ...kickerStyle, color: 'var(--muted-fg)' }}>Studio</p>
              <p
                style={{
                  marginTop: '16px',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  lineHeight: 1.3,
                  textTransform: 'uppercase',
                  color: 'var(--fg)',
                  whiteSpace: 'pre-line',
                }}
              >
                {[location, phone].filter(present).join('\n')}
              </p>
            </div>
          ) : null}

          {socials.length > 0 ? (
            <div>
              <p style={{ ...kickerStyle, color: 'var(--muted-fg)' }}>Elsewhere</p>
              <nav aria-label="Social links" style={{ marginTop: '16px' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {socials.map((sl) => (
                    <li key={sl.key}>
                      <a
                        href={sl.href}
                        target="_blank"
                        rel="noopener noreferrer me"
                        aria-label={PLATFORM_LABELS[sl.platform] ?? sl.platform}
                        className="tmpl-link"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.25rem',
                          textTransform: 'uppercase',
                          color: 'var(--fg)',
                          textDecoration: 'none',
                        }}
                      >
                        <SocialIcon platform={sl.platform} size={18} />
                        {PLATFORM_LABELS[sl.platform] ?? sl.platform} →
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          ) : null}
        </div>
      </div>

      {/* LIVE contact form island when a portfolio id is present (template-agnostic);
          else the mailto above stands alone (never a dead form). */}
      {present(section?.portfolio_id) ? (
        <div style={{ marginTop: 'clamp(48px, 6vh, 64px)', maxWidth: '40rem' }}>
          <ContactForm portfolioId={section.portfolio_id} emailPublic={emailPublic} />
        </div>
      ) : null}
    </div>
  );
}
