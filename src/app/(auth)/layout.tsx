/**
 * (auth) route-group shell (02-UI-SPEC "Auth card + shell").
 *
 * The centered single-column composition every auth page renders its card body
 * into: a full-bleed canvas (`--color-background`), the brand wordmark
 * "Portsmith" linking to `/` above, and a footer caption row (legal link +
 * cross-link to the other auth action) below. `min-h-dvh`, vertical breathing
 * room at `2xl` (48px). No marketing split-screen — calm, fast, content-first
 * (the funnel IS the product, UI-SPEC A-8).
 *
 * Stays an RSC: only the form islands inside each page are `'use client'`.
 * Token-driven — no inline hex.
 */
import { Link } from '@/components/ui/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <header>
        <Link
          href="/"
          className="text-xl font-semibold !text-brand !no-underline hover:!text-brand-hover"
        >
          Portsmith
        </Link>
      </header>

      <main className="w-full max-w-[440px]">{children}</main>

      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <Link href="/legal" className="text-[13px]">
          Terms &amp; Privacy
        </Link>
      </footer>
    </div>
  );
}
