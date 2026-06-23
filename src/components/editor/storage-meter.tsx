'use client';

/**
 * StorageMeter (05-UI-SPEC §4, D-09; cap raised D-10) — the display-only "X / 65 MB" usage meter.
 *
 * READ-ONLY by construction (threat register T-05-22): it READS the protected,
 * trigger-maintained `profiles.storage_used_bytes` and NEVER writes it. There is no
 * `.update(...)`, no `setQueryData` that writes the column, and no Zustand mirror
 * here — usage is the server's, maintained ONLY by the `sync_storage_usage` trigger
 * (migration 003). An upload/remove invalidates the meter's query so it RE-READS the
 * fresh value; it never sets it.
 *
 * The owner-scoped read (T-05-24): the value is seeded from the RSC owner read
 * (`dashboard/page.tsx` reads the caller's OWN profile row under RLS) and backed by
 * a TanStack Query (browser anon client, the owner's own_* RLS policy scopes it to
 * their row) keyed on the owner id so an upload/remove can invalidate it for a live
 * update without a full page reload. The `public_*` views never expose this column
 * (FND-02), so a non-owner can never read it.
 *
 * Color-independence (05-UI-SPEC, SHARED-E): the three threshold states (B-10) use
 * brand / warning / destructive (B-11 — NEVER accent) and color is ALWAYS paired
 * with the numeric readout (tnum) + a short text label. `aria-live="polite"` sits on
 * the state LABEL only (not the readout digits — too chatty), announcing when usage
 * crosses into "Almost full" / "Storage full". Reduced-motion-safe (the fill width
 * transition drops under `motion-reduce:`).
 *
 * Two-layer identity (SHARED-E): Evergreen & Copper PLATFORM-CHROME tokens ONLY —
 * zero inline hex, zero reach into any portfolio-template theme.
 */
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { cmsKeys } from '@/lib/query/cms-keys';
import { createClient } from '@/lib/supabase/client';
import {
  formatStorageReadout,
  meterFillRatio,
  meterState,
} from '@/lib/media/upload-config';

export interface StorageMeterProps {
  /** The owner's id (scopes the owner-only read + the invalidation key). */
  ownerId: string;
  /**
   * The RSC-loaded `storage_used_bytes` (the owner's verified, last-read usage) —
   * seeds the query so the meter paints correct immediately (no loading flash) and
   * is then kept live by invalidation after an upload/remove.
   */
  initialUsedBytes: number;
}

/** Per-state fill + readout-text tokens (B-11 — brand / warning / destructive, NEVER accent). */
const STATE_STYLE = {
  under: { fill: 'bg-brand', text: 'text-muted-foreground' },
  approaching: { fill: 'bg-warning', text: 'text-warning' },
  over: { fill: 'bg-destructive', text: 'text-destructive' },
} as const;

export function StorageMeter({ ownerId, initialUsedBytes }: StorageMeterProps) {
  // Owner-scoped read of the protected usage column. Seeded from the RSC value, so
  // the first paint is correct; an upload/remove invalidates this key to RE-READ
  // (never to write). RLS scopes the row to the owner; `staleTime: 0` lets an
  // invalidation refetch the fresh trigger-maintained value.
  const { data: usedBytes = initialUsedBytes } = useQuery<number>({
    queryKey: cmsKeys.storageUsed(ownerId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('storage_used_bytes')
        .eq('id', ownerId)
        .maybeSingle();
      if (error) throw error;
      const value = (data as { storage_used_bytes?: number } | null)?.storage_used_bytes;
      return typeof value === 'number' ? value : initialUsedBytes;
    },
    initialData: initialUsedBytes,
  });

  const state = meterState(usedBytes);
  const ratio = meterFillRatio(usedBytes);
  const readout = formatStorageReadout(usedBytes);
  const style = STATE_STYLE[state];

  const label =
    state === 'approaching' ? 'Almost full' : state === 'over' ? 'Storage full' : null;

  return (
    <section
      className="flex flex-col gap-1 rounded-md border border-border bg-surface-muted px-3 py-2.5"
      aria-label="Storage usage"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">Storage</span>
        {/* Readout: tabular numerals (tnum on globally); color paired with the
            number, never color-alone. NO aria-live here (the digits are too chatty). */}
        <span className={`text-[13px] tabular-nums leading-tight ${style.text}`}>
          {readout}
        </span>
      </div>

      {/* Track + fill. The fill width = used / cap (clamped). 6px tall, full-radius,
          a border-strong edge per the spec. The width eases on change unless the
          visitor prefers reduced motion. */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full border border-border-strong bg-surface-muted"
        role="presentation"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${style.fill}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      {/* State label — the ONLY aria-live region (announces crossing into
          "Almost full" / "Storage full"). Color + glyph + text — never color alone.
          At/over the cap, a solution hint points at the fix. */}
      {label ? (
        <p
          aria-live="polite"
          className={`flex items-center gap-1.5 text-[13px] leading-tight ${style.text}`}
        >
          {state === 'over' ? (
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          )}
          <span>{label}</span>
        </p>
      ) : (
        // Keep a (sr-only, empty) live region present so the SR announces the
        // transition INTO a labeled state, not just its arrival.
        <p aria-live="polite" className="sr-only" />
      )}

      {state === 'over' ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          Remove a photo or your résumé to free up space.
        </p>
      ) : null}
    </section>
  );
}
