/**
 * Hero — the front-door value proposition (D-01 / D-08 / D-09 / D-10).
 *
 * The page's single `<h1>` Display headline + a Body subhead + the primary
 * "Get started — free" CTA, on the non-technical-professional framing (D-08). Calm,
 * spacious, editorial (D-01) — leans on the large end of the inherited spacing scale
 * (`3xl`/64px section padding, `2xl` internal rhythm), no hero background image, no
 * copper background (D-01 — copper is focus-only).
 *
 * Display sizing is a SIZE step (not a new weight): the headline reads big at the
 * inherited 600 weight, `-0.02em` tracking, ~28px mobile → 36px desktop. The reveal
 * uses the `.landing-reveal` keyframe (D-02 — final-state-at-rest, so reduced-motion
 * users see full content instantly). Every color is a chrome `@theme` token.
 */
import { CtaLink } from './cta-link';

export function Hero() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="landing-reveal mx-auto flex max-w-3xl flex-col items-start gap-6">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
          A polished portfolio in about 15 minutes — without designing anything.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Pick a curated template, fill in your experience, and publish. Portsmith handles
          the design, so you get a page you&rsquo;re proud to share — no skills required.
        </p>
        <CtaLink href="/signup">Get started — free</CtaLink>
      </div>
    </section>
  );
}
