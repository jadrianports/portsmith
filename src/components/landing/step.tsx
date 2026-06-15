/**
 * Step — one how-it-works step (UI-SPEC §3).
 *
 * A lightly-carded presentational unit: an optional decorative `aria-hidden` lucide
 * glyph, an `<h3>` Section-heading title, and a `--color-muted-foreground` Body blurb.
 * Carries the stable `data-landing-step` attribute the e2e spec counts (the STEP
 * SELECTOR CONTRACT documented in 22-01's e2e spec — ≥3 of these on `/`). Headings
 * stay sequential: section `<h2>` → step `<h3>`. Chrome `@theme` tokens only.
 */
import type { LucideIcon } from 'lucide-react';

export interface StepProps {
  title: string;
  body: string;
  /** Optional decorative glyph (rendered aria-hidden — the title is the accessible name). */
  glyph?: LucideIcon;
}

export function Step({ title, body, glyph: Glyph }: StepProps) {
  return (
    <div
      data-landing-step
      className="flex flex-col items-start gap-3 rounded-md border border-border bg-surface p-6"
    >
      {Glyph ? <Glyph aria-hidden="true" className="size-6 text-brand" /> : null}
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
