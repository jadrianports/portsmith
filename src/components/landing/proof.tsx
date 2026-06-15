/**
 * Proof — the 2-up browser-frame proof grid (D-03 / D-04 / D-05 / D-12).
 *
 * EXACTLY two contrasting `<ShowcaseCard>`s — the founder's dev portfolio
 * (`/jadrianports`) + the seeded marketer demo on aurora (`/aurora-demo`, seeded by
 * Plan 02) — proving "works across professions, always looks good." Each is a browser-
 * frame mockup over a committed static screenshot (D-12, captured by Plan 04), printing
 * the real `portsmith.vercel.app/<username>` and linking to the live page in a new tab.
 * The block is NEVER empty (static assets, no empty state by construction).
 *
 * 2-up grid (`gap-8`), single column on mobile. Chrome `@theme` tokens only.
 */
import { ShowcaseCard } from './showcase-card';

export function Proof() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-semibold text-foreground">Real pages, really published</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <ShowcaseCard
            username="jadrianports"
            imageSrc="/landing/showcase-dev.webp"
            alt="Screenshot of a developer's published Portsmith portfolio."
            caption="A developer's portfolio"
            name="the developer"
          />
          <ShowcaseCard
            username="aurora-demo"
            imageSrc="/landing/showcase-aurora.webp"
            alt="Screenshot of a marketer's published Portsmith portfolio on the aurora template."
            caption="A marketer's portfolio"
            name="the marketer"
          />
        </div>
      </div>
    </section>
  );
}
