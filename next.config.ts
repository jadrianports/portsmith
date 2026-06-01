import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Dev-server only (Next 16): the 02-06 phase-gate E2E drives signup on the
  // `127.0.0.1:3000` origin (the config.toml site_url the confirm email carries).
  // Without this, Next 16 blocks cross-origin requests to dev resources
  // (/_next/webpack-hmr etc.), so the interactive /signup island never hydrates
  // and the always-pass Turnstile token never populates -> submit stays disabled
  // -> the smoke times out. No production effect (this gate is dev-only).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Later plans add image remote patterns (Supabase Storage), headers, etc.
};

export default nextConfig;
