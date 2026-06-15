/**
 * HowItWorks — the 3-step explainer (D-06 / D-10).
 *
 * EXACTLY 3 steps in the locked D-06 order (pick a template → fill in your content →
 * publish), on a `--color-surface-muted` band to separate it from the hero. A `<h2>`
 * lead-in over a 3-up grid (`gap-8` desktop, single column mobile). The three equal-
 * weight `<Step>`s read as one scannable sequence.
 *
 * Staggered reveal (D-02): each step applies `.landing-reveal` + a `.landing-reveal-delay-*`
 * helper from globals.css — a per-element `animation-delay`, still zero-JS, still
 * reduced-motion-safe (the delay lives inside the `no-preference` media block, so it
 * vanishes under reduced motion and every step renders in its final state instantly).
 * Each `<Step>` emits the stable `data-landing-step` selector (LAND-02, ≥3). Chrome
 * `@theme` tokens only.
 */
import { Globe, LayoutTemplate, Pencil } from 'lucide-react';

import { Step } from './step';

export function HowItWorks() {
  return (
    <section className="bg-surface-muted px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-semibold text-foreground">How it works</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          <div className="landing-reveal">
            <Step
              glyph={LayoutTemplate}
              title="Pick a template"
              body="Curated, professional designs. Every one is built to look great, so you don't have to be a designer."
            />
          </div>
          <div className="landing-reveal landing-reveal-delay-1">
            <Step
              glyph={Pencil}
              title="Fill in your content"
              body="Add your experience and work in simple guided fields. No layouts to wrangle, nothing to break."
            />
          </div>
          <div className="landing-reveal landing-reveal-delay-2">
            <Step
              glyph={Globe}
              title="Publish"
              body="Go live at your own clean link — ready to share with clients, recruiters, or anyone who asks."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
