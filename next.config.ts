import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

const nextConfig: NextConfig = {
  // Dev-server only (Next 16): the 02-06 phase-gate E2E drives signup on the
  // `127.0.0.1:3000` origin (the config.toml site_url the confirm email carries).
  // Without this, Next 16 blocks cross-origin requests to dev resources
  // (/_next/webpack-hmr etc.), so the interactive /signup island never hydrates
  // and the always-pass Turnstile token never populates -> submit stays disabled
  // -> the smoke times out. No production effect (this gate is dev-only).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // D-13 / D-14 / HARD-02 — static, SSG-safe defense-in-depth security headers.
  // Emitted at the framework/edge `headers()` layer on EVERY response, so there is
  // ZERO change to any page render path: `/[username]` stays ● SSG/ISR (D-22).
  // CRITICAL (D-14): the CSP carries NO `script-src` nonce (a nonce forces
  // per-request rendering and would break SSG); inline FOUC/JSON-LD scripts + the
  // Turnstile widget run via `script-src-elem ... 'unsafe-inline'`.
  async headers() {
    // Supabase Storage/API origin derived at BUILD from the public env var (host-
    // locked image source). Falls back to the local stack origin when unset.
    const supabase = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
    ).origin;
    const turnstile = 'https://challenges.cloudflare.com';
    const csp = [
      "default-src 'self'",
      `img-src 'self' blob: data: ${supabase}`, // Storage images + cropper blob/data previews
      "style-src 'self' 'unsafe-inline'", // template inline style={...}
      `script-src-elem 'self' 'unsafe-inline' ${turnstile}`, // NO nonce (D-14) — inline FOUC/JSON-LD + Turnstile
      `connect-src 'self' ${supabase} ${turnstile}`, // Supabase API + Turnstile siteverify-side
      `frame-src ${turnstile}`, // Turnstile challenge iframe
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'", // clickjacking (D-13, replaces X-Frame-Options)
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // HSTS: 1 year, includeSubDomains, NO `preload` (OQ-4). `*.vercel.app` is
          // already Vercel-HSTS-preloaded; `preload` is hard to undo, so the upgrade
          // is deferred to the portsmith.app launch (16-DEPLOY-CHECKLIST item).
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()',
          },
        ],
      },
    ];
  },
};

// D-06 / HARD-02 — wrap with withBotId so BotID rewrites + Server-Action
// protection inject at build. botid Basic no-ops off-Vercel, so local build/dev
// are unaffected; the gate goes live on Vercel deploy.
export default withBotId(nextConfig);
