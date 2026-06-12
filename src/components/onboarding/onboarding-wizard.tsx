'use client';

/**
 * OnboardingWizard (18-04 / UI-SPEC Surfaces 1 + 6 — the client step-shell).
 *
 * The centered single-column shell that hosts the top stepper, the active step's
 * card, and the footer nav. It holds ONLY UI state (the current step index, the
 * preview-cleanup flag) — it NEVER mirrors server data (the RSC props + TanStack
 * Query own that; CLAUDE.md state-split rule). Every wizard write goes through the
 * SAME editor actions (no parallel write path, D-06); this shell only orchestrates
 * navigation + the step slots.
 *
 * NAVIGATION (D-17 free jump — safe because every step persists, D-06):
 *   - Continue (brand fill, right) → next visible step.
 *   - Back (ghost, left, hidden on the first step) → previous visible step.
 *   - Skip for now (ghost, content steps only) → next step, seed retained (D-08).
 *   - "I'll finish later" (quiet ghost, always) → soft-skip: fires `/api/preview/disable`
 *     (cookie cleanup) THEN navigates to `/api/onboarding/skip` (the one-shot route from
 *     18-03 that drops the user into `/dashboard` for one visit, `onboarded_at` stays
 *     null so they're gently routed back next visit — D-04).
 *   - The stepper circles jump to any visible step (D-17).
 *
 * RESUME (D-03/D-17): the shell opens on `resumeStep` (the RSC-derived last-incomplete
 * step). When that is past Template, a calm welcome-back banner shows (UI-SPEC Surface
 * 6, `--color-surface-muted` band, never a warning tone).
 *
 * STEP 1 is the real Template step (picker + inline live-preview iframe). Steps 2–6
 * (Hero/About/Projects/Contact/Publish) land in 18-05 — this shell renders a calm
 * placeholder slot for them behind the step switch.
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome tokens ONLY (Evergreen/Copper, Inter); no
 * template token, no inline hex. The ONLY template surface is the preview iframe inside
 * the Template step (a separate document). Every focusable control is ≥44px with the
 * chrome focus ring; transitions are `motion-reduce:`-gated.
 */
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AllowedTemplate } from '@/lib/templates/available-templates';

import { TemplateStep } from './steps/template-step';
import {
  STEP_LABEL,
  type OnboardingStep,
} from './steps';
import { OnboardingStepper } from './onboarding-stepper';

/** Per-step coaching copy (UI-SPEC § Per-step coaching — heading + one-line subtext). */
const STEP_COACHING: Record<OnboardingStep, { heading: string; subtext: string }> = {
  template: {
    heading: 'Choose your look',
    subtext: 'Pick a template — you can change it anytime, even after you publish.',
  },
  hero: {
    heading: 'Introduce yourself',
    subtext:
      'Add your name, a photo, and one line on what you do — it’s the first thing visitors see.',
  },
  about: {
    heading: 'Tell your story',
    subtext: 'A few sentences in your own voice.',
  },
  projects: {
    heading: 'Show your work',
    subtext: 'Add a few highlights now — you can always add more later.',
  },
  contact: {
    heading: 'Make it easy to reach you',
    subtext: 'Choose how visitors get in touch.',
  },
  publish: {
    heading: 'Ready to go live?',
    subtext: 'Publish your page to the web — you can keep editing anytime.',
  },
};

/** UI copy (UI-SPEC § Navigation CTAs + Resume welcome-back banner). */
const COPY = {
  continue: 'Continue',
  continueToPublish: 'Continue to publish',
  back: 'Back',
  skip: 'Skip for now',
  finishLater: 'I’ll finish later',
  welcomeBack: 'Welcome back — let’s pick up where you left off.',
  welcomeBackSub: 'Your progress is saved.',
} as const;

export interface OnboardingWizardProps {
  /** The owner's username (drives the preview iframe target + the live URL). */
  username: string;
  /** The portfolio's CURRENT template slug — the picker's "● Current" mark + the preview seed. */
  currentTemplateSlug: string;
  /** The live publish flag (the wizard runs on the UNPUBLISHED portfolio; this is the source-truth). */
  published: boolean;
  /** GATE-02 allowed-list (public ∪ granted-to-me) — PLAIN serializable, no zod/registry (D-25). */
  allowedTemplates: AllowedTemplate[];
  /** The spec-gated visible steps in order (D-09), computed server-side from the chosen spec. */
  visibleSteps: readonly OnboardingStep[];
  /** The RSC-derived resume step (D-03) — the shell opens here. */
  resumeStep: OnboardingStep;
}

export function OnboardingWizard({
  username,
  currentTemplateSlug,
  published,
  allowedTemplates,
  visibleSteps,
  resumeStep,
}: OnboardingWizardProps) {
  // Land on the resume step if it is visible; otherwise the first visible step.
  const initialStep = visibleSteps.includes(resumeStep)
    ? resumeStep
    : (visibleSteps[0] ?? 'template');
  const [current, setCurrent] = useState<OnboardingStep>(initialStep);
  // Guard against a double-fire of the soft-skip navigation.
  const [leaving, setLeaving] = useState(false);

  const currentIndex = visibleSteps.indexOf(current);
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex === visibleSteps.length - 1;
  // The Publish step is terminal; the content step just before it advances "to publish".
  const nextIsPublish = visibleSteps[currentIndex + 1] === 'publish';
  // A CONTENT step (not Template, not Publish) shows "Skip for now" (D-08).
  const isContentStep = current !== 'template' && current !== 'publish';

  // The completed set: every step BEFORE the resume step is done (deriveOnboardingStep
  // returns the FIRST not-done step, so everything earlier passed its predicate). This
  // feeds the stepper's done/check rendering without mirroring server data.
  const completed = useMemo<ReadonlySet<OnboardingStep>>(() => {
    const resumeIdx = visibleSteps.indexOf(resumeStep);
    if (resumeIdx <= 0) return new Set<OnboardingStep>();
    return new Set<OnboardingStep>(visibleSteps.slice(0, resumeIdx));
  }, [visibleSteps, resumeStep]);

  const goTo = useCallback((step: OnboardingStep) => {
    setCurrent(step);
    // Scroll the new step card into view on jump (instant under reduced motion).
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const goNext = useCallback(() => {
    const next = visibleSteps[currentIndex + 1];
    if (next) goTo(next);
  }, [visibleSteps, currentIndex, goTo]);

  const goBack = useCallback(() => {
    const prev = visibleSteps[currentIndex - 1];
    if (prev) goTo(prev);
  }, [visibleSteps, currentIndex, goTo]);

  /**
   * Soft-skip "I'll finish later" (D-04): clear the draft-preview cookies FIRST
   * (`/api/preview/disable`, so no stale `__prerender_bypass` survives for the owner's
   * own later anon visit) THEN hand off to the one-shot skip route (18-03), which sets
   * the `onboarding-skip` cookie and redirects to `/dashboard`. `onboarded_at` stays
   * null → the user is gently routed back next visit, until they publish.
   */
  const finishLater = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      // Belt-and-suspenders cookie cleanup (GET, same-origin); ignore its redirect body.
      await fetch('/api/preview/disable', { method: 'GET' });
    } catch {
      // A failed cleanup must not trap the user — proceed to the skip route regardless.
    }
    // The skip route is a top-level redirect handler — a full navigation lands the user
    // in the editor for one visit (the gate's one-shot cookie bypass, 18-03).
    window.location.assign('/api/onboarding/skip');
  }, [leaving]);

  const coaching = STEP_COACHING[current];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      {/* Top stepper (Surface 1). */}
      <OnboardingStepper
        visibleSteps={visibleSteps}
        current={current}
        completed={completed}
        onJump={goTo}
      />

      {/* Welcome-back banner (Surface 6) — only on a resumed visit (resume past Template). */}
      {resumeStep !== 'template' && current === initialStep ? (
        <div className="rounded-md bg-surface-muted px-4 py-3">
          <p className="text-base font-medium text-foreground">{COPY.welcomeBack}</p>
          <p className="mt-0.5 text-[13px] leading-tight text-muted-foreground">
            {COPY.welcomeBackSub}
          </p>
        </div>
      ) : null}

      {/* The active step's card (Surface 1 focal point): coaching header + the slot. */}
      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-base font-semibold leading-snug text-foreground">
            {coaching.heading}
          </h1>
          <p className="text-base leading-normal text-muted-foreground">
            {coaching.subtext}
          </p>
        </header>

        {/* Step slot. Step 1 is the real Template step; steps 2–6 land in 18-05. */}
        {current === 'template' ? (
          <TemplateStep
            username={username}
            currentSlug={currentTemplateSlug}
            allowed={allowedTemplates}
          />
        ) : (
          <StepPlaceholder step={current} published={published} />
        )}
      </section>

      {/* Footer nav (Surface 1): Back (ghost) · Skip for now (ghost) · Continue (brand). */}
      <footer className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {!isFirst ? (
              <Button variant="ghost" onClick={goBack} className="w-auto">
                <ArrowLeft aria-hidden="true" className="size-4" />
                <span>{COPY.back}</span>
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {isContentStep ? (
              <Button variant="ghost" onClick={goNext} className="w-auto">
                {COPY.skip}
              </Button>
            ) : null}
            {!isLast ? (
              <Button variant="primary" onClick={goNext} className="w-auto">
                <span>{nextIsPublish ? COPY.continueToPublish : COPY.continue}</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* The always-available soft-skip (Surface 6) — a quiet, equal-weight escape. */}
        <button
          type="button"
          onClick={finishLater}
          disabled={leaving}
          className={
            'inline-flex min-h-11 items-center justify-center self-center rounded-md px-3 text-sm font-semibold ' +
            'text-muted-foreground outline-none transition-colors hover:text-foreground ' +
            'motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          }
        >
          {COPY.finishLater}
        </button>
      </footer>
    </main>
  );
}

/**
 * A calm placeholder slot for steps 2–6 (Hero/About/Projects/Contact/Publish). 18-05
 * fills these with the embedded Phase-17 forms (content steps) + the publish/payoff
 * steps. Until then this keeps the shell navigable + tsc-green without faking content.
 */
function StepPlaceholder({
  step,
  published,
}: {
  step: OnboardingStep;
  published: boolean;
}) {
  return (
    <div className="rounded-md bg-surface-muted px-4 py-6 text-center">
      <p className="text-base font-medium text-foreground">{STEP_LABEL[step]}</p>
      <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
        {step === 'publish' && published
          ? 'Your page is already published.'
          : 'This step is coming next.'}
      </p>
    </div>
  );
}
