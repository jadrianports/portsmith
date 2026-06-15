/**
 * FinalCta — the closing conversion moment (D-08 / D-09 / D-10).
 *
 * A closing restatement of the value + the SAME "Get started — free" CTA → `/signup`
 * (D-09), on the D-08 framing. The closing headline is an `<h2>` rendered at Display
 * size — the page keeps exactly ONE `<h1>` (the hero), so this repeats the visual
 * weight without a second top-level heading. `3xl`/64px vertical padding, the
 * `.landing-reveal` reveal (D-02), chrome `@theme` tokens only.
 */
import { CtaLink } from './cta-link';

export function FinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="landing-reveal mx-auto flex max-w-3xl flex-col items-start gap-6">
        <h2 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
          Your portfolio is 15 minutes away.
        </h2>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Pick a template, add your experience, and publish — free.
        </p>
        <CtaLink href="/signup">Get started — free</CtaLink>
      </div>
    </section>
  );
}
