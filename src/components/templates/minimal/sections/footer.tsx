/**
 * Footer (template chrome — NOT a by-type section). Replaces the 03-04 stub: the
 * body is real, the SHARED `FooterProps` signature and the `index.tsx` wiring are
 * UNCHANGED (frozen 03-04 contract). The footer takes the WHOLE `PortfolioData`
 * (`FooterProps`) because it reads `settings` social links + `profile`, not a
 * single section row.
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): no platform tagline, no platform logo,
 * and no platform link anywhere here — the URL is the ONLY attribution. The footer
 * shows the founder's name/handle + the social links that exist.
 *
 * SOCIALS (render-only-if-present — hide-if-empty): each link renders ONLY when its
 * URL is a non-empty string on `data.settings` (github_url / linkedin_url /
 * twitter_url / dribbble_url / website_url).
 *
 * ABSOLUTE URLs (PUB-03 / SHARED-B): the canonical self-link to this portfolio is
 * built from `siteUrl()` — derived from `NEXT_PUBLIC_SITE_URL`, NEVER the request
 * host (keeps the route ISR-cacheable and blocks host-header injection). The
 * external social URLs are stored absolute and are used as-is.
 *
 * THEME TOGGLE: `index.tsx` already mounts `ThemeToggle` (gated on
 * `visitor_theme_toggle`) — the footer does NOT double-mount it.
 *
 * COLOR: no hardcoded hex for UI — every color via `var(--token)` (SHARED-D); the
 * only literal color is inside the documented decorative grid-horizon echo
 * gradient (the footer's faint sunset mirror of the hero).
 */
import type { FooterProps } from './types';
import { siteUrl } from '@/lib/url';

/** A URL field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function Footer({ data }: FooterProps) {
  const { profile, settings } = data;

  // Name/handle (null-guarded view columns).
  const name = present(profile.display_name) ? profile.display_name : null;
  const handle = present(profile.username) ? profile.username : null;

  // The social links that exist, in a stable order. NO platform link.
  const socials: { label: string; href: string }[] = [];
  if (present(settings.github_url)) socials.push({ label: 'GitHub', href: settings.github_url });
  if (present(settings.linkedin_url))
    socials.push({ label: 'LinkedIn', href: settings.linkedin_url });
  if (present(settings.twitter_url)) socials.push({ label: 'X', href: settings.twitter_url });
  if (present(settings.dribbble_url))
    socials.push({ label: 'Dribbble', href: settings.dribbble_url });
  if (present(settings.website_url))
    socials.push({ label: 'Website', href: settings.website_url });

  // The canonical self-link to this portfolio (PUB-03 — env-driven, host-safe).
  const canonicalHref = handle ? siteUrl(`/${handle}`) : siteUrl('/');
  const canonicalLabel = handle ? `${siteUrl(`/${handle}`).replace(/^https?:\/\//, '')}` : null;

  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        position: 'relative',
        marginTop: '96px',
        paddingTop: '48px',
        paddingBottom: '48px',
        borderTop: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Faint grid-horizon echo (a lower-opacity mirror of the hero horizon). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '60%',
          background:
            'repeating-linear-gradient(to right, var(--accent-cyan) 0 1px, transparent 1px 56px)',
          opacity: 0.05,
          transform: 'perspective(420px) rotateX(60deg)',
          transformOrigin: 'top',
          maskImage: 'linear-gradient(to bottom, #000, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        {/* Name / handle + the canonical URL (the ONLY attribution — TMPL-07). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {name ? (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '16px',
                color: 'var(--fg)',
              }}
            >
              {name}
            </span>
          ) : null}
          {canonicalLabel ? (
            <a
              href={canonicalHref}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                letterSpacing: '0.04em',
                color: 'var(--muted-fg)',
                textDecoration: 'none',
              }}
            >
              {canonicalLabel}
            </a>
          ) : null}
        </div>

        {/* Social links — only the ones that exist. */}
        {socials.length > 0 ? (
          <nav aria-label="Social links">
            <ul
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '24px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: '44px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--fg)',
                      textDecoration: 'none',
                    }}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {/* Copyright line — the owner's name only; NO platform attribution. */}
      <p
        style={{
          position: 'relative',
          zIndex: 1,
          marginTop: '32px',
          marginBottom: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          letterSpacing: '0.04em',
          color: 'var(--muted-fg)',
        }}
      >
        © {year}
        {name ? ` ${name}` : ''}
      </p>
    </footer>
  );
}
