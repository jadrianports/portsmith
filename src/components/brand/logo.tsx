/**
 * <Logo> — the Portsmith maker's-mark: a circular wax-seal stamp containing a
 * rounded-geometric "P" (D-01/D-02/D-03). Pure Server Component, zero runtime deps.
 *
 * ── COLOR / THEME (D-05/D-06/D-08) ────────────────────────────────────────────
 * Every color resolves to an EXISTING chrome @theme var — NO new token, NO inline
 * hex. The seal ring is `var(--color-brand)` (evergreen); the "P" is
 * `var(--color-accent)` (copper). The light/dark swap is AUTOMATIC: the
 * globals.css `@media (prefers-color-scheme: dark)` block re-points these same
 * vars to the dark evergreen/copper values, so the mark recolors with ZERO JS and
 * no new theming mechanism / no FOUC guard (D-08). The SVG is static markup; the
 * CSS cascade resolves the vars in the browser regardless of RSC vs client.
 *
 * ── D-07 SANCTIONED COPPER-FILL EXCEPTION (document, do not flag) ─────────────
 * The copper `var(--color-accent)` FILL on the "P" below is the explicitly
 * sanctioned exception to the chrome standing rule "accent is never a fill". A
 * logomark is NOT a UI control, so this carve-out does not violate the rule and
 * MUST NOT be flagged by the checker or any token-wall guard. This is a single,
 * mark-scoped exception — it is NOT a license to fill any button/control with
 * copper anywhere else in chrome.
 *
 * ── 16px LEGIBILITY (D-04) ────────────────────────────────────────────────────
 * 32×32 viewBox, 28px seal (r=14, 2px optical margin), even 2px rounded stroke.
 * The "P" is built from a vertical stem + a single rounded bowl whose counter
 * stays OPEN at 16px (no fill-in) — the favicon detail budget.
 */
export function Logo({
  size = 28,
  decorative = false,
}: {
  size?: number;
  decorative?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Portsmith'}
      aria-hidden={decorative || undefined}
    >
      {/* Seal ring — evergreen brand token (28px diameter, 2px rounded stroke). */}
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/*
        The "P" — copper accent FILL (D-07 SANCTIONED logomark exception).
        Rounded-geometric construction: a vertical stem plus a single rounded bowl
        with an OPEN counter (the inner notch is cut back to background so the
        counter never fills in at 16px — the D-04 legibility gate). Even visual
        weight matching the 2px seal ring; optically centered in the seal.
      */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 9.5a1.25 1.25 0 0 1 1.25-1.25h4.25a4.75 4.75 0 0 1 0 9.5H14.5v5.25a1.25 1.25 0 0 1-2.5 0V9.5Zm2.5 5.75h3a2.25 2.25 0 0 0 0-4.5h-3v4.5Z"
        fill="var(--color-accent)"
      />
    </svg>
  );
}
