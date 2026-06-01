'use client';

/**
 * EyeToggle (04-UI-SPEC §3, CMS-05 / D-P4-09) — show/hide a section, OPTIMISTically.
 *
 * An icon-only 44px button mirroring the password show/hide toggle inside
 * src/components/ui/input.tsx (lines 78–96): `eye` (visible) / `eye-off` (hidden)
 * lucide glyphs, `--color-muted-foreground` at rest → `--color-foreground` on
 * hover, `aria-pressed` reflecting the published state, a descriptive
 * `aria-label`, and the 2px accent focus ring that never covers itself.
 *
 * Visibility is ONE of only two OPTIMISTIC editor operations (the other is
 * reorder; content Save is NOT optimistic). The optimism lives here via a
 * TanStack Query mutation (SHARED-C / RESEARCH Pattern 3): `onMutate` flips this
 * section's `visible` in the `cmsKeys.sections` cache INSTANTLY (the eye icon
 * updates immediately), calls `toggleVisibilityAction(sectionId, next)`,
 * `onError` reverts the optimistic flip + surfaces a destructive Alert
 * (OPTIMISTIC UI HONESTY — never silently lie about what's published — T-04-05d),
 * `onSettled` invalidates. Because a visibility change is a save-class action the
 * server action revalidates the public page, so a hidden section disappears live
 * within seconds (D-P4-09; the public_sections view already filters `visible`).
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY. No inline hex. The icon swap
 * is instant (no motion to suppress) — reduced-motion safe by construction.
 *
 * Source: the icon-only-button idiom from src/components/ui/input.tsx (the
 * password toggle); the optimistic mutation from RESEARCH Pattern 3 on the
 * makeQueryClient substrate; toggleVisibilityAction (Task 1).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { toggleVisibilityAction } from '@/lib/cms/toggle-visibility-action';
import { cmsKeys } from '@/lib/query/cms-keys';

/** Minimal cache shape the optimistic flip mutates (id + visible). */
interface VisibilityCacheRow {
  id: string;
  visible: boolean;
}

const TOGGLE_ERROR =
  'We couldn’t update visibility — it’s been put back. Please try again.';

export interface EyeToggleProps {
  sectionId: string;
  /** The section title — woven into the descriptive aria-label. */
  title: string;
  /** Current visibility (drives the glyph + aria-pressed). */
  visible: boolean;
  /** The portfolio id whose `cmsKeys.sections` cache the optimistic flip mutates. */
  portfolioId?: string;
  /** The owner's username — passed to the action's revalidate. */
  username?: string;
}

export function EyeToggle({
  sectionId,
  title,
  visible,
  portfolioId,
  username,
}: EyeToggleProps) {
  const queryClient = useQueryClient();
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Scope the optimistic flip to this portfolio's section list when known;
  // otherwise fall back to invalidating the single-section key on settle.
  const sectionsKey = portfolioId ? cmsKeys.sections(portfolioId) : undefined;

  const toggle = useMutation({
    mutationFn: (next: boolean) => toggleVisibilityAction(sectionId, next, username),
    onMutate: async (next: boolean) => {
      setToggleError(null);
      if (!sectionsKey) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey: sectionsKey });
      const previous = queryClient.getQueryData<VisibilityCacheRow[]>(sectionsKey);
      // Flip this one section's `visible` in place (optimistic, instant).
      queryClient.setQueryData<VisibilityCacheRow[]>(sectionsKey, (old) =>
        old?.map((s) => (s.id === sectionId ? { ...s, visible: next } : s)),
      );
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      // Revert + announce (optimistic UI honesty — T-04-05d).
      if (sectionsKey && ctx?.previous) {
        queryClient.setQueryData(sectionsKey, ctx.previous);
      }
      setToggleError(TOGGLE_ERROR);
    },
    onSettled: () => {
      if (sectionsKey) queryClient.invalidateQueries({ queryKey: sectionsKey });
    },
  });

  function handleToggle() {
    const next = !visible;
    toggle.mutate(next, {
      onSuccess: (result) => {
        if (!result.ok) {
          // Server-handled failure (not a throw): roll back to server truth + announce.
          if (sectionsKey) queryClient.invalidateQueries({ queryKey: sectionsKey });
          setToggleError(TOGGLE_ERROR);
        }
      },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={visible}
        aria-label={
          visible ? `Hide ${title} from your page` : `Show ${title} on your page`
        }
        className={
          'flex size-11 shrink-0 items-center justify-center text-muted-foreground ' +
          'outline-none hover:text-foreground focus-visible:outline-2 ' +
          'focus-visible:-outline-offset-2 focus-visible:outline-ring'
        }
      >
        {visible ? (
          <Eye aria-hidden="true" className="size-5" />
        ) : (
          <EyeOff aria-hidden="true" className="size-5" />
        )}
      </button>
      {toggleError ? (
        <Alert variant="error" className="absolute inset-x-0 top-full z-10 mt-1">
          {toggleError}
        </Alert>
      ) : null}
    </>
  );
}
