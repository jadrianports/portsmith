/**
 * Footer for edgerunner-v2 — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/layout/Footer.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *      border-neon-purple/20 → color-mix(in oklab, var(--neon-purple) 20%, transparent)
 *      text-neon-pink / text-neon-cyan → var(--neon-pink) / var(--neon-cyan)
 *      border-neon-pink/60 → color-mix(in oklab, var(--neon-pink) 60%, transparent)
 *      text-foreground/90 → color-mix(in oklab, var(--fg) 90%, transparent)
 *      text-foreground/65 → color-mix(in oklab, var(--fg) 65%, transparent)
 *      text-foreground/75 → color-mix(in oklab, var(--fg) 75%, transparent)
 *      text-foreground/80 → color-mix(in oklab, var(--fg) 80%, transparent)
 *      text-foreground/55 → color-mix(in oklab, var(--fg) 55%, transparent)
 *      text-foreground/40 → color-mix(in oklab, var(--fg) 40%, transparent)
 *      border-neon-cyan/30 → color-mix(in oklab, var(--neon-cyan) 30%, transparent)
 *      hover:border-neon-pink hover:text-neon-pink hover:shadow-neon-pink → CSS class
 *   3. Custom classes (animate-neon-pulse, text-glow-pink, font-display, font-mono-retro,
 *      text-neon-pink, text-neon-cyan) KEPT AS-IS.
 *   4. NO framer-motion (footer is Server Component).
 *   5. DATA BINDING: real socials/email from PortfolioData settings.
 *      Derived initials from display_name. No invented data.
 *   6. YEAR: deterministic new Date().getFullYear().
 *   7. SERVER COMPONENT — no 'use client'.
 *   8. ReportDialog island for safety affordance.
 *   9. NO platform branding (D-23 / TMPL-07).
 */
import { ReportDialog } from '@/components/public/report-dialog';
import { PLATFORM_LABELS, SocialIcon } from '../../_shared/social-icons';

import type { FooterProps } from './types';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';

const quickLinks = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'services', label: 'Services' },
  { id: 'contact', label: 'Contact' },
];

export function Footer({ data }: FooterProps) {
  const { profile, settings } = data;

  const name = present(profile.display_name) ? profile.display_name : null;
  const handle = present(profile.username) ? profile.username : null;
  const emailPublic = settings.email_public ?? null;

  const portfolioId = present(settings.portfolio_id) ? settings.portfolio_id : null;

  // Derive initials from display_name (badge in logo)
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : handle
      ? handle.slice(0, 2).toUpperCase()
      : '//';

  // Compact wordmark: last word of display_name (or handle) uppercased + ".dev"
  // e.g. "Kai Nakamura" → "NAKAMURA.dev" (matches export footer + navbar)
  const nameParts = (name ?? handle ?? '').trim().split(/\s+/).filter(Boolean);
  const wordmarkStem = nameParts.length > 0
    ? nameParts[nameParts.length - 1].toUpperCase()
    : 'PORTFOLIO';

  // Build social links from `settings.socials` (P24 D-01 — array order = display order).
  // T-25-04/06: `settings.socials` is `Json | null` → `Array.isArray`-guard, then
  // per-element `String(platform)` + `safeHref(url)` (CR-01: a dangerous scheme drops the
  // entry rather than rendering a live `javascript:` link).
  const socialItems = Array.isArray(settings.socials) ? settings.socials : [];
  const socials: { key: string; platform: string; href: string }[] = [];
  socialItems.forEach((s, i) => {
    const entry = s as { platform?: unknown; url?: unknown } | null;
    const platform = String(entry?.platform ?? '').trim();
    const href = safeHref(typeof entry?.url === 'string' ? entry.url : undefined);
    if (platform && href) socials.push({ key: `${platform}-${i}`, platform, href });
  });

  const year = new Date().getFullYear();

  return (
    <footer
      className="relative border-t px-6 py-10"
      style={{ borderColor: 'color-mix(in oklab, var(--neon-purple) 20%, transparent)' }}
    >
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        {/* Col 1: Logo + tagline */}
        <div>
          <div className="flex items-center gap-2">
            <span
              className="grid h-9 w-9 place-items-center rounded-md font-display text-sm font-bold text-neon-pink text-glow-pink animate-neon-pulse"
              style={{
                border: '1px solid color-mix(in oklab, var(--neon-pink) 60%, transparent)',
              }}
            >
              {initials}
            </span>
            <span
              className="font-display text-sm font-semibold uppercase tracking-[0.25em]"
              style={{ color: 'color-mix(in oklab, var(--fg) 90%, transparent)' }}
            >
              {wordmarkStem}<span className="text-neon-cyan">.dev</span>
            </span>
          </div>
          <p
            className="mt-3 max-w-xs"
            style={{ color: 'color-mix(in oklab, var(--fg) 65%, transparent)' }}
          >
            Architecting neon-lit web experiences at the edge of the grid.
          </p>
        </div>

        {/* Col 2: Quick Links */}
        <div>
          <div
            className="font-display text-sm font-bold uppercase tracking-widest text-neon-cyan"
          >
            Quick Links
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {quickLinks.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className="font-mono-retro text-base transition-colors hover:text-neon-pink"
                  style={{
                    color: 'color-mix(in oklab, var(--fg) 75%, transparent)',
                    textDecoration: 'none',
                  }}
                >
                  &gt; {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3: Channels */}
        <div>
          <div
            className="font-display text-sm font-bold uppercase tracking-widest text-neon-cyan"
          >
            Channels
          </div>
          <div className="mt-3 flex gap-2.5">
            {socials.map(({ key, platform, href }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer me"
                aria-label={PLATFORM_LABELS[platform] ?? platform}
                className="grid h-10 w-10 place-items-center rounded-full transition-all tmpl-social-icon-btn"
                style={{
                  border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
                  color: 'color-mix(in oklab, var(--fg) 80%, transparent)',
                  textDecoration: 'none',
                }}
              >
                <SocialIcon platform={platform} size={16} />
              </a>
            ))}
          </div>
          {emailPublic ? (
            <p
              className="mt-4 font-mono-retro text-base"
              style={{ color: 'color-mix(in oklab, var(--fg) 55%, transparent)' }}
            >
              {emailPublic}
            </p>
          ) : null}
        </div>
      </div>

      {/* Copyright bar */}
      <div
        className="mx-auto mt-10 max-w-6xl border-t pt-5 flex flex-col gap-2 sm:flex-row items-center justify-between"
        style={{ borderColor: 'color-mix(in oklab, var(--neon-purple) 20%, transparent)' }}
      >
        <p
          className="font-mono-retro text-base"
          style={{ color: 'color-mix(in oklab, var(--fg) 55%, transparent)' }}
        >
          © {year}{name ? ` ${name}` : ''}. All signals reserved.
        </p>
        <p
          className="font-mono-retro text-base"
          style={{ color: 'color-mix(in oklab, var(--fg) 60%, transparent)' }}
        >
          {'// crafted with neon & coffee'}
        </p>

        {portfolioId ? <ReportDialog portfolioId={portfolioId} /> : null}
      </div>
    </footer>
  );
}
