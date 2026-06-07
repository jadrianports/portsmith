/**
 * Footer (template chrome — NOT a by-type section). Rewritten from the single-row
 * colophon (Task-14) to match the 3-col layout of the export's
 * `lovable-exports/synthwave-founder/src/components/layout/Footer.tsx`:
 *
 *   Col 1 — Logo badge + display name / username + a short synthwave tagline.
 *   Col 2 — "Quick Links" anchor list (the 7 standard edgerunner section ids).
 *   Col 3 — "Channels" — social links from `data.settings` (render-only-if-present)
 *            + a graceful fallback (just the #contact anchor) when no socials exist.
 *
 * SERVER COMPONENT (NO `'use client'`): the footer contains no interactive state.
 *
 * PROP SIGNATURE: unchanged `{ data }: FooterProps` (engine contract — FROZEN).
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): no platform tagline, logo, or link anywhere.
 *
 * SOCIALS (render-only-if-present): each social renders ONLY when its URL is a non-empty
 * string on `data.settings`, passed through `safeHref` (http(s) only — CR-01).
 * The export's hardcoded Nakamura socials are NOT ported; the channels column renders
 * whatever the portfolio owner has set, or a graceful minimal fallback.
 *
 * ABSOLUTE URLS (PUB-03): canonical self-link via `siteUrl()` (NEXT_PUBLIC_SITE_URL),
 * never the request Host.
 *
 * SAFETY AFFORDANCE (D-15 / SAFE-03): the `<ReportDialog>` island renders only when
 * `settings.portfolio_id` is present (the single sanctioned safety element on the
 * chrome-free public page).
 *
 * YEAR: `new Date().getFullYear()` — mirrors aurora/sections/footer.tsx exactly
 * (rendered at ISR-revalidate time, not request time; semantically correct and
 * consistent with the rest of the template codebase).
 *
 * COLOR: no hardcoded hex — every value via `var(--token)` from theme.css (SHARED-D).
 * The grid-horizon backdrop echo is the ONLY decorative gradient and intentionally uses
 * the scoped `var(--neon-cyan)` token, not a literal color.
 */
import { ReportDialog } from '@/components/public/report-dialog';

import type { FooterProps } from './types';
import type { PublicSettings } from '../../types';
import { siteUrl } from '@/lib/url';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';

/** The standard edgerunner single-scroll section anchors (Col 2 Quick Links). */
const QUICK_LINKS: { id: string; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Stack' },
  { id: 'services', label: 'Services' },
  { id: 'contact', label: 'Contact' },
];

/** Named social sources keyed to `PublicSettings` field names. */
const SOCIAL_KEYS: { label: string; key: keyof PublicSettings }[] = [
  { label: 'GitHub', key: 'github_url' },
  { label: 'LinkedIn', key: 'linkedin_url' },
  { label: 'X', key: 'twitter_url' },
  { label: 'Dribbble', key: 'dribbble_url' },
  { label: 'Website', key: 'website_url' },
];

export function Footer({ data }: FooterProps) {
  const { profile, settings } = data;

  const name = present(profile.display_name) ? profile.display_name : null;
  const handle = present(profile.username) ? profile.username : null;

  const portfolioId = present(settings.portfolio_id) ? settings.portfolio_id : null;

  // Build social links — only those with a valid http(s) URL.
  const socials: { label: string; href: string }[] = [];
  for (const { label, key } of SOCIAL_KEYS) {
    const raw = settings[key] as string | null | undefined;
    const href = safeHref(raw);
    if (href) socials.push({ label, href });
  }

  const canonicalHref = handle ? siteUrl(`/${handle}`) : siteUrl('/');
  const canonicalLabel = handle
    ? siteUrl(`/${handle}`).replace(/^https?:\/\//, '')
    : null;

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
      {/* Decorative neon grid-horizon echo — matches the hero grid atmosphere. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '60%',
          background:
            'repeating-linear-gradient(to right, var(--neon-cyan) 0 1px, transparent 1px 56px)',
          opacity: 0.05,
          transform: 'perspective(420px) rotateX(60deg)',
          transformOrigin: 'top',
          maskImage: 'linear-gradient(to bottom, #000, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* 3-col grid */}
      <div
        className="tmpl-shell tmpl-footer-grid"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* ── Col 1: Logo + tagline ────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Logo badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              aria-hidden="true"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid color-mix(in oklab, var(--neon-pink) 60%, transparent)',
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--neon-pink)',
                textShadow:
                  '0 0 8px var(--neon-pink), 0 0 20px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
                animation: 'tmpl-edgerunner-neon-pulse 2.4s ease-in-out infinite',
                flexShrink: 0,
              }}
            >
              {name
                ? name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                : handle
                  ? handle.slice(0, 2).toUpperCase()
                  : '//'}
            </span>
            {(name || handle) ? (
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: 'var(--fg)',
                }}
              >
                {name ?? handle}
              </span>
            ) : null}
          </div>

          {/* Tagline */}
          <p
            style={{
              margin: 0,
              maxWidth: '240px',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              lineHeight: 1.55,
              color: 'var(--muted-fg)',
            }}
          >
            Architecting neon-lit web experiences at the edge of the grid.
          </p>

          {/* Canonical URL */}
          {canonicalLabel ? (
            <a
              href={canonicalHref}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                letterSpacing: '0.04em',
                color: 'var(--muted-fg)',
                textDecoration: 'none',
              }}
            >
              {canonicalLabel}
            </a>
          ) : null}
        </div>

        {/* ── Col 2: Quick Links ───────────────────────────────────────── */}
        <div>
          <p
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--neon-cyan)',
              textShadow:
                '0 0 8px var(--neon-cyan), 0 0 20px color-mix(in oklab, var(--neon-cyan) 50%, transparent)',
            }}
          >
            Quick Links
          </p>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px',
            }}
          >
            {QUICK_LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--muted-fg)',
                    textDecoration: 'none',
                    transition: 'color 140ms ease',
                  }}
                  className="tmpl-footer-ql-link"
                >
                  &gt; {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Col 3: Channels ─────────────────────────────────────────── */}
        <div>
          <p
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--neon-cyan)',
              textShadow:
                '0 0 8px var(--neon-cyan), 0 0 20px color-mix(in oklab, var(--neon-cyan) 50%, transparent)',
            }}
          >
            Channels
          </p>

          {socials.length > 0 ? (
            /* Socials present — render icon-button row */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  aria-label={s.label}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted-fg)',
                    textDecoration: 'none',
                    transition:
                      'border-color 140ms ease, color 140ms ease, box-shadow 140ms ease',
                  }}
                  className="tmpl-footer-channel-btn"
                >
                  {s.label.slice(0, 2)}
                </a>
              ))}
            </div>
          ) : (
            /* No socials — graceful fallback: link to contact section + handle */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a
                href="#contact"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--muted-fg)',
                  textDecoration: 'none',
                }}
                className="tmpl-footer-ql-link"
              >
                &gt; Contact
              </a>
              {handle ? (
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    letterSpacing: '0.04em',
                    color: 'var(--muted-fg)',
                    opacity: 0.65,
                  }}
                >
                  @{handle}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Copyright bar */}
      <div
        className="tmpl-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '1px solid color-mix(in oklab, var(--neon-purple) 20%, transparent)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            letterSpacing: '0.04em',
            color: 'var(--muted-fg)',
          }}
        >
          © {year}
          {name ? ` ${name}` : ''}. All signals reserved.
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.04em',
            color: 'var(--muted-fg)',
          }}
        >
          // crafted with neon &amp; coffee
        </p>

        {portfolioId ? <ReportDialog portfolioId={portfolioId} /> : null}
      </div>
    </footer>
  );
}
