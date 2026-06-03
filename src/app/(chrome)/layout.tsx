import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

/**
 * Platform-chrome UI font (02-UI-SPEC A-4 — founder-confirmed Inter). Variable
 * font, `display: swap`, latin subset. Exposed as the `--font-inter` CSS
 * variable, which `--font-sans` (globals.css `@theme`) consumes as the head of
 * its fallback stack so every chrome surface renders in Inter.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Portsmith',
  description:
    'Publish a polished, single-scroll portfolio by filling in structured content and choosing a curated template.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
