/**
 * <Wordmark> — the live "Portsmith" wordmark (D-15). Pure Server Component.
 *
 * LIVE TEXT, not a hand-drawn letterform (D-15): real, i18n-safe text rendered in
 * the chrome default Inter (via `--font-sans`) at semibold (600) with slightly
 * tightened tracking, in `text-brand` (evergreen). Call sites size it per surface
 * via `className` (header `text-lg`, footer/hero per their container). NEVER an
 * SVG-traced letterform — keeping it real text means it stays selectable,
 * translatable, and weight-consistent with the surrounding chrome type.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-brand ${className ?? ''}`}>
      Portsmith
    </span>
  );
}
