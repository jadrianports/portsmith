/**
 * Self-hosted font faces for the `edgerunner-v2` template.
 * Orbitron (display) + Space Grotesk (body) + VT323 (mono) via next/font/google.
 * Copied verbatim from edgerunner/fonts.ts — same font triple, same variable names.
 */
import { Orbitron, Space_Grotesk, VT323 } from 'next/font/google';

export const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['600', '800'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

export const vt323 = VT323({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
});
