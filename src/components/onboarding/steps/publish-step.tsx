'use client';

/**
 * PublishStep (18-05 / UI-SPEC Surface 4 — the discrete go-live step, D-14 / D-16).
 *
 * The wizard's terminal-before-payoff step. It clones the SHIPPED `publish-toggle.tsx`
 * action-call flow (set phase 'publishing' → await the action → advance on ok, show the
 * Alert on error → settle the phase) but calls the 18-01 sibling
 * `markOnboardedAndPublish` (NOT `setPublished`) so the single authenticated RLS write
 * ALSO stamps `profiles.onboarded_at` — the canonical "finished onboarding" moment
 * (D-14 / ONB-05). On success the wizard advances to the full-screen payoff (the shell's
 * `onPublished` callback flips `showPayoff`).
 *
 * NO CONFIRM (the inherited rule): publishing is safe + reversible — only UNpublishing
 * confirms, and there is no unpublish here. One click → `markOnboardedAndPublish()`.
 *
 * THE D-16 PLACEHOLDER NUDGE (NON-BLOCKING — load-bearing): when any core section still
 * holds untouched seed content (`hasPlaceholders`, the RSC-derived seed-aware signal),
 * a gentle `--color-warning`-toned note is shown ABOVE the CTA. It is informational,
 * paired with a glyph + WORD (never color alone via the Alert's TriangleAlert glyph),
 * and it NEVER disables Publish. `deriveCompleteness` is advisory only — publishing with
 * placeholders is allowed by design ("hard to make ugly").
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome tokens ONLY (Evergreen/Copper); the CTA is the
 * brand fill (44px, loader-circle spinner + aria-busy + disabled-while-in-flight,
 * motion-reduce:animate-none via the Button primitive). No inline hex; the warning tone
 * comes from the Alert's `warning` variant (`--color-warning` on `--color-surface-muted`).
 */
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { markOnboardedAndPublish } from '@/lib/cms/publish-action';

/** Copy (UI-SPEC § Publish step Copywriting — verbatim). */
const COPY = {
  publish: 'Publish my page',
  publishing: 'Publishing…',
  alreadyLive: 'Your page is already published.',
  nudge:
    'Some sections still show example content — you can publish now and polish anytime.',
  error: 'We couldn’t publish your page. Please try again.',
} as const;

type Phase = 'idle' | 'publishing';

export interface PublishStepProps {
  /** The live publish flag (the wizard runs on the UNPUBLISHED portfolio). */
  published: boolean;
  /**
   * D-16: true when any core section still holds untouched seed content — shows the
   * NON-BLOCKING placeholder nudge above the CTA. NEVER disables Publish.
   */
  hasPlaceholders: boolean;
  /** Fired on a resolved-ok publish → the shell advances to the full-screen payoff. */
  onPublished: () => void;
}

export function PublishStep({ published, hasPlaceholders, onPublished }: PublishStepProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const busy = phase === 'publishing';

  /**
   * Publish + stamp onboarded_at (D-14) — frictionless, NO confirm. Mirrors the
   * publish-toggle handlePublish lifecycle but calls `markOnboardedAndPublish` and
   * advances to the payoff on success. On error nothing changed; the user retries.
   */
  async function handlePublish() {
    if (busy) return;
    setError(null);
    setPhase('publishing');
    try {
      const result = await markOnboardedAndPublish();
      if (result.ok) {
        onPublished();
        return; // leave the phase 'publishing' — the payoff takes over the viewport.
      }
      setError(result.error ?? COPY.error);
    } catch {
      setError(COPY.error);
    } finally {
      // Settle only on the error path; on success the payoff has already replaced us.
      setPhase('idle');
    }
  }

  // Already published (a resumed already-live owner): publishing again would re-stamp;
  // we simply offer the go-live again as a no-op-friendly re-publish (the action is
  // idempotent — it sets published=true + re-stamps), still advancing to the payoff.
  return (
    <div className="flex flex-col gap-4">
      {/* D-16 (NON-BLOCKING): the gentle placeholder nudge. The Alert `warning` variant
          pairs the WORD with the TriangleAlert glyph (color-independence) and never
          disables the CTA below. Shown only when seed content remains untouched. */}
      {hasPlaceholders && !published ? (
        <Alert variant="warning">{COPY.nudge}</Alert>
      ) : null}

      {published ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          {COPY.alreadyLive}
        </p>
      ) : null}

      {/* Error → the UI-SPEC Alert; nothing changed; the user retries. */}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {/* The primary CTA — brand fill, 44px, loader-circle spinner + aria-busy +
          disabled-while-in-flight; NO confirm. The spinner + "Publishing…" copy mirror
          the publish-toggle idiom (the Button's default "Submitting…" would be wrong copy). */}
      <div>
        <Button
          variant="primary"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={handlePublish}
          className="w-auto"
        >
          {busy ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              <span>{COPY.publishing}</span>
            </>
          ) : (
            COPY.publish
          )}
        </Button>
      </div>
    </div>
  );
}
