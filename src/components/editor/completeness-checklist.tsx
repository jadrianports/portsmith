'use client';

/**
 * CompletenessChecklist (04-UI-SPEC §13) — the advisory, data-derived
 * "Get publish-ready" card (ONB-01 / D-P4-08).
 *
 * Consumes the PURE `deriveCompleteness(...)` output and renders it as a
 * collapsible chrome card (rail bottom on desktop). It NUDGES the user toward a
 * publish-ready portfolio; it NEVER disables or blocks Publish. There is no
 * "blocked" affordance here at all — the hard noindex-until-complete gate is a
 * separate, later concern (P6 SAFE-04). Completing every item simply swaps the
 * list for an encouraging "You're ready to publish." line.
 *
 * Open/closed state is UI-only and lives in Zustand (`checklistOpen`), so the
 * card's expansion never mirrors server data. A todo row links to its section by
 * setting the Zustand `activeSectionId` (UI selection only — D-P4-04).
 *
 * Accessibility / color-independence (SHARED-E): every row pairs a glyph with
 * text — a filled `check` (done, `--color-success`) or a hollow `circle` (todo,
 * `--color-muted-foreground`) — so state is never color-only. The header toggle
 * is a real `<button aria-expanded>` with the chrome focus ring. Token-driven
 * chrome only — zero inline hex.
 */
import { Check, ChevronDown, ChevronUp, Circle } from 'lucide-react';

import { useUIStore } from '@/lib/stores/uiStore';
import type { ChecklistItem } from '@/lib/cms/completeness';

export interface CompletenessChecklistProps {
  /** The derived advisory items from `deriveCompleteness(...)`. */
  items: ChecklistItem[];
}

export function CompletenessChecklist({ items }: CompletenessChecklistProps) {
  const open = useUIStore((s) => s.checklistOpen);
  const setOpen = useUIStore((s) => s.setChecklistOpen);
  const setActiveSectionId = useUIStore((s) => s.setActiveSectionId);

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const allDone = total > 0 && done === total;

  const ChevronIcon = open ? ChevronUp : ChevronDown;

  return (
    <section
      className="rounded-md border border-border bg-surface-muted"
      aria-label="Get publish-ready"
    >
      {/* Header toggle: title + a done/total count (tnum, success when all done). */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={
          'flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 ' +
          'text-left outline-none transition-colors hover:bg-surface ' +
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
        }
      >
        <span className="text-sm font-semibold text-foreground">Get publish-ready</span>
        <span
          className={
            'text-[13px] tabular-nums leading-tight ' +
            (allDone ? 'text-success' : 'text-muted-foreground')
          }
        >
          {done}/{total}
          <ChevronIcon aria-hidden="true" className="ml-1 inline size-4 align-text-bottom" />
        </span>
      </button>

      {open ? (
        <div className="px-3 pb-3">
          {allDone ? (
            // All-complete: encouragement, NOT a gate (advisory only — D-P4-08).
            <p className="flex items-center gap-2 text-[13px] leading-tight text-success">
              <Check aria-hidden="true" className="size-4 shrink-0" />
              <span>You&apos;re ready to publish.</span>
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.id}>
                  {item.done ? (
                    // Done row: filled check + label, success color + glyph.
                    <span className="flex min-h-9 items-center gap-2 px-1 text-[13px] leading-tight text-success">
                      <Check aria-hidden="true" className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                  ) : item.sectionType ? (
                    // Todo row WITH a section target: a link that selects the
                    // section into the form panel (UI selection only).
                    <button
                      type="button"
                      onClick={() => setActiveSectionId(item.sectionType ?? null)}
                      className={
                        'flex min-h-9 w-full items-center gap-2 rounded-sm px-1 text-left ' +
                        'text-[13px] leading-tight text-muted-foreground outline-none ' +
                        'transition-colors hover:text-foreground ' +
                        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
                      }
                    >
                      <Circle aria-hidden="true" className="size-4 shrink-0" />
                      <span className="underline-offset-2 hover:underline">{item.label}</span>
                    </button>
                  ) : (
                    // Todo row WITHOUT a section target (e.g. name / avatar live on
                    // the profile form): hollow circle + label, no link.
                    <span className="flex min-h-9 items-center gap-2 px-1 text-[13px] leading-tight text-muted-foreground">
                      <Circle aria-hidden="true" className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
