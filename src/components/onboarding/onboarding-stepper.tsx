'use client';

/**
 * OnboardingStepper (18-04 / UI-SPEC Surface 1 — D-05/D-09/D-17/D-18/D-19) — the top
 * horizontal numbered stepper.
 *
 * Desktop: a horizontal row of clickable `<button>` step circles connected by a thin
 * connector line. Each node carries its NUMERAL (or a `check` glyph when done) + a
 * step LABEL — color is NEVER the only signal (D-19 color-independence: glyph +
 * numeral + label always present, `aria-current="step"` on the current node). The
 * connector segment to a done step fills `--color-brand`.
 *   - done     → `--color-success` circle + `check` glyph (no numeral); clickable (jump back).
 *   - current  → a copper (`--color-accent`) ring + numeral; `aria-current="step"`.
 *   - upcoming → a hollow `--color-surface-muted` circle + `--color-border-strong`
 *                ring + muted numeral; clickable (jump forward — safe, all steps persist, D-06).
 *
 * Mobile (D-18): the circle rail is hidden; it collapses to "Step {N} of {M} ·
 * {Label}" (`tnum`) + a thin `--color-brand`-on-`--color-surface-muted` progress bar
 * (role="progressbar"). The textual count is the source of truth; the bar is the
 * decorative reinforcement.
 *
 * D-09 SPEC-GATING: the stepper renders only the `visibleSteps` subset the RSC threads
 * in (a content step the chosen template marks `supported:false` is omitted), and
 * NUMBERS them 1..M over that subset (NOT always-6). The mobile "Step N of M" reflects
 * the rendered count.
 *
 * Reduced-motion (UI-SPEC): every transition is suppressed via `motion-reduce:` — the
 * progress fill / circle state changes instantly, no slide.
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome tokens ONLY (Evergreen/Copper, Inter via
 * `--font-sans`); no template token, no inline hex. Every circle is a ≥44px target
 * (`min-h-11 min-w-11`) with the chrome focus ring.
 */
import { Check } from 'lucide-react';

import { STEP_LABEL, type OnboardingStep } from './steps';

export interface OnboardingStepperProps {
  /** The spec-gated visible steps in order (D-09), numbered 1..M over this subset. */
  visibleSteps: readonly OnboardingStep[];
  /** The currently-active step (must be a member of `visibleSteps`). */
  current: OnboardingStep;
  /**
   * The set of steps the user has completed (drives the done/check rendering). The
   * shell derives this from the per-step done predicates; a step is "done" when its
   * predicate passes, independent of whether it is the current step.
   */
  completed: ReadonlySet<OnboardingStep>;
  /** Jump to a step (D-17 free navigation — safe because every step persists, D-06). */
  onJump: (step: OnboardingStep) => void;
}

/** A step's rendered status (drives glyph + tone; ALWAYS paired with numeral/label). */
type NodeStatus = 'done' | 'current' | 'upcoming';

export function OnboardingStepper({
  visibleSteps,
  current,
  completed,
  onJump,
}: OnboardingStepperProps) {
  const total = visibleSteps.length;
  const currentIndex = visibleSteps.indexOf(current);
  // 1-based ordinal of the current step over the VISIBLE subset (D-09 renumber).
  const currentOrdinal = currentIndex < 0 ? 1 : currentIndex + 1;
  const progressPct = total > 0 ? Math.round((currentOrdinal / total) * 100) : 0;

  function statusOf(step: OnboardingStep, index: number): NodeStatus {
    if (step === current) return 'current';
    if (completed.has(step)) return 'done';
    // A step BEFORE the current one that isn't explicitly completed still reads as
    // done for connector purposes (the user has moved past it); after = upcoming.
    if (index < currentIndex) return 'done';
    return 'upcoming';
  }

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      {/* ── Mobile collapse (< sm): "Step N of M · Label" + a thin progress bar ── */}
      <div className="flex flex-col gap-2 sm:hidden">
        <p className="text-sm font-semibold leading-tight text-foreground">
          <span className="tabular-nums">
            Step {currentOrdinal} of {total}
          </span>
          <span className="text-muted-foreground"> · {STEP_LABEL[current]}</span>
        </p>
        <div
          role="progressbar"
          aria-valuenow={currentOrdinal}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Step ${currentOrdinal} of ${total}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <span
            className="block h-full rounded-full bg-brand transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Desktop horizontal numbered rail (≥ sm) ── */}
      <ol className="hidden items-start sm:flex">
        {visibleSteps.map((step, index) => {
          const status = statusOf(step, index);
          const ordinal = index + 1;
          const isLast = index === total - 1;
          // The connector segment to the LEFT of this node fills brand once the
          // PREVIOUS node is done (i.e. this node's index ≤ currentIndex).
          const connectorFilled = index <= currentIndex;
          return (
            <li key={step} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Left connector (decorative). Hidden on the first node. */}
                <span
                  aria-hidden="true"
                  className={
                    'h-0.5 flex-1 ' +
                    (index === 0
                      ? 'invisible'
                      : connectorFilled
                        ? 'bg-brand'
                        : 'bg-border')
                  }
                />
                <StepCircle
                  status={status}
                  ordinal={ordinal}
                  label={STEP_LABEL[step]}
                  onClick={() => onJump(step)}
                />
                {/* Right connector (decorative). Hidden on the last node. */}
                <span
                  aria-hidden="true"
                  className={
                    'h-0.5 flex-1 ' +
                    (isLast
                      ? 'invisible'
                      : index < currentIndex
                        ? 'bg-brand'
                        : 'bg-border')
                  }
                />
              </div>
              <span
                className={
                  'mt-2 text-center text-sm font-semibold leading-tight ' +
                  (status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')
                }
              >
                {STEP_LABEL[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * One clickable step circle — a real `<button>` (Enter/Space activate, D-17 free
 * jump), ≥44px target, with an `aria-label` naming the step + its state, and
 * `aria-current="step"` on the current node. Color-independence: the glyph (check) /
 * numeral + the label below always convey the state, never color alone.
 */
function StepCircle({
  status,
  ordinal,
  label,
  onClick,
}: {
  status: NodeStatus;
  ordinal: number;
  label: string;
  onClick: () => void;
}) {
  const stateWord =
    status === 'done' ? 'completed' : status === 'current' ? 'current' : 'upcoming';

  const circleTone =
    status === 'done'
      ? 'border-transparent bg-success text-brand-foreground'
      : status === 'current'
        ? 'border-2 border-accent bg-surface text-foreground'
        : 'border border-border-strong bg-surface-muted text-muted-foreground';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={status === 'current' ? 'step' : undefined}
      aria-label={`Step ${ordinal}, ${label} — ${stateWord}`}
      className={
        'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ' +
        'outline-none transition-colors motion-reduce:transition-none ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        circleTone
      }
    >
      {status === 'done' ? (
        <Check aria-hidden="true" className="size-5" />
      ) : (
        <span className="tabular-nums">{ordinal}</span>
      )}
    </button>
  );
}
