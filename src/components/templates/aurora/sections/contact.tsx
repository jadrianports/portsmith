/**
 * Contact section (aurora section 12) — the rosy live contact, RESTORED 1:1 to the
 * marketing-girl two-column layout (`grid lg:grid-cols-2 gap-12` inside `max-w-6xl`):
 *
 *   LEFT  — a "Get in Touch" card: Mail / Phone / MapPin rows reading
 *           `settings.email_public` / `phone` / `location` (each omit-if-absent), each in a
 *           `w-12 h-12 rounded-full` gradient-filled icon wrapper; below them a `Follow Me`
 *           block (border-t divider) — a `flex gap-3` row of rounded-full outline icon-button
 *           links iterating `settings.socials` through the SHARED `<SocialIcon>` (D-01).
 *   RIGHT — the LIVE `<ContactForm>` client island (replaces the source's static form, D-09),
 *           with the mailto fallback when no portfolio id is present.
 *
 * The source's data-less "Book a Meeting" CTA is DROPPED (D-09 — kept absent).
 *
 * PUBLIC CONTACT DETAILS from SETTINGS (Phase 25 — D-07/D-08): email/location/phone/socials are
 * read from `data.settings` (the SINGLE source of truth), threaded in by `index.tsx` as the
 * Contact-scoped `ContactExtraProps`. This REPLACES the Phase-24-killed seed-copied
 * `content.email_public` idiom (D-07). The frozen global `SectionProps` is NOT widened (D-08).
 *
 * SECURITY (T-25-04): the email mailto goes through `safeHref(...,{allowMailto:true})`; each
 * social url goes through `safeHref` (http(s)-only — CR-01) and renders with
 * `target="_blank" rel="noopener noreferrer me"` (reverse-tabnabbing). Socials are `Json | null`
 * on the view → `Array.isArray` + per-element shape-guard (T-25-06).
 *
 * MOTION (T-25-05 / D-13): hovers are pure-CSS approximations only (transition: transform) —
 * NO `motion`/framer-motion import, so `/[username]` stays ● SSG and the bundle budget is held.
 *
 * COPY: solo-individual framing ONLY (D-12/D-13 — first person, never "team").
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import { Mail, MapPin, Phone } from 'lucide-react';

import { ContactForm } from '@/components/public/contact-form';

import type { ContactExtraProps, SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';
import { PLATFORM_LABELS, SocialIcon } from '../../_shared/social-icons';

/** The validated JSONB contact content (heading/subheading) — null-guarded below. */
type ContactSectionContent = ContactContent;

export function Contact({
  section,
  emailPublic: emailPublicProp,
  location: locationProp,
  phone: phoneProp,
  socials: socialsProp,
}: SectionProps & ContactExtraProps) {
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Get in touch';
  const subheading = present(content.subheading)
    ? content.subheading
    : "Have an idea in mind? Let's create marketing magic together.";

  // Public contact details from SETTINGS (D-07) — omit-if-absent. The email mailto is
  // built through the shared guard with `allowMailto` (CR-01). Phone + location render as
  // plain text (phone is NOT a tel: link — RESEARCH OQ-2).
  const emailPublic = present(emailPublicProp) ? emailPublicProp : null;
  const location = present(locationProp) ? locationProp : null;
  const phone = present(phoneProp) ? phoneProp : null;
  const mailtoHref = emailPublic
    ? safeHref(`mailto:${emailPublic}`, { allowMailto: true })
    : undefined;

  // The social links that exist, in array order (P24 D-01). T-25-04/06: `settings.socials`
  // is `Json | null` — `Array.isArray`-guard, then per-element `String(platform)` +
  // `safeHref(url)` (a dangerous scheme drops the entry rather than rendering a live
  // `javascript:` link). Each kept entry needs BOTH a non-empty platform slug + a safe href.
  const socialItems = Array.isArray(socialsProp) ? socialsProp : [];
  const socials: { key: string; platform: string; href: string }[] = [];
  socialItems.forEach((s, i) => {
    const entry = s as { platform?: unknown; url?: unknown } | null;
    const platform = String(entry?.platform ?? '').trim();
    const href = safeHref(typeof entry?.url === 'string' ? entry.url : undefined);
    if (platform && href) socials.push({ key: `${platform}-${i}`, platform, href });
  });

  const details: { key: string; Icon: typeof Mail; title: string; value: string; href?: string }[] =
    [];
  if (emailPublic && mailtoHref) {
    details.push({ key: 'email', Icon: Mail, title: 'Email', value: emailPublic, href: mailtoHref });
  }
  if (phone) details.push({ key: 'phone', Icon: Phone, title: 'Phone', value: phone });
  if (location) details.push({ key: 'location', Icon: MapPin, title: 'Location', value: location });

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

      {/* Two-column layout — RESTORED 1:1 from marketing-girl (`grid lg:grid-cols-2 gap-12`
          inside `max-w-6xl`): LEFT the Get-in-Touch + Follow-Me details card, RIGHT the live
          form. */}
      <div className="grid lg:grid-cols-2 gap-12" style={{ maxWidth: '72rem', width: '100%' }}>
        {/* LEFT — "Get in Touch" details + "Follow Me" socials */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '32px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '22px',
              color: 'var(--fg)',
              margin: '0 0 24px',
            }}
          >
            Get in Touch
          </h3>

          {details.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {details.map(({ key, Icon, title, value, href }) => {
                const valueNode = href ? (
                  <a
                    href={href}
                    className="tmpl-contact-detail-link"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '16px',
                      color: 'var(--muted-fg)',
                      textDecoration: 'none',
                    }}
                  >
                    {value}
                  </a>
                ) : (
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '16px',
                      color: 'var(--muted-fg)',
                    }}
                  >
                    {value}
                  </span>
                );
                return (
                  <div
                    key={key}
                    className="tmpl-contact-detail-row"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}
                  >
                    <span
                      aria-hidden="true"
                      className="tmpl-contact-detail-icon"
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        width: '48px',
                        height: '48px',
                        borderRadius: '9999px',
                        background: 'var(--aurora-gradient)',
                        color: '#fff',
                      }}
                    >
                      <Icon style={{ width: '24px', height: '24px' }} />
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 600,
                          fontSize: '15px',
                          color: 'var(--fg)',
                        }}
                      >
                        {title}
                      </span>
                      {valueNode}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* "Follow Me" — only when at least one social survives the guard. */}
          {socials.length > 0 ? (
            <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
              <h4
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '15px',
                  color: 'var(--fg)',
                  margin: '0 0 16px',
                }}
              >
                Follow Me
              </h4>
              <nav aria-label="Social links">
                <ul
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                  }}
                >
                  {socials.map((s) => (
                    <li key={s.key}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer me"
                        aria-label={PLATFORM_LABELS[s.platform] ?? s.platform}
                        className="tmpl-social-icon-btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '44px',
                          height: '44px',
                          borderRadius: '9999px',
                          border: '1px solid var(--border)',
                          color: 'var(--fg)',
                          textDecoration: 'none',
                        }}
                      >
                        <SocialIcon platform={s.platform} size={20} />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          ) : null}
        </div>

        {/* RIGHT — the LIVE `<ContactForm>` island (replaces the source's static form, D-09)
            when the portfolio id is present; else the mailto fallback (never a dead form). */}
        <div>
          {present(section?.portfolio_id) ? (
            <ContactForm portfolioId={section.portfolio_id} emailPublic={emailPublic} />
          ) : emailPublic && mailtoHref ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                padding: '32px',
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
      </div>
    </div>
  );
}
