/**
 * Shared sub-components + helpers for the `blueprint` template sections — a FAITHFUL 1:1
 * transcription of the export's `src/components/portfolio/` primitives (`Eyebrow`, `MonoPill`,
 * `SectionShell`, `Stars`, `TraceDivider`, `GridBackground`) + `lib/sections.ts` helpers. Pure
 * Server Components — NO client JS, NO chrome token. Layout/sizing/typography Tailwind classes
 * are kept VERBATIM from the export (they work — Portsmith ships Tailwind); only the export's
 * COLOR utilities are translated to inline `var(--token)` (the chrome registers `--color-*`,
 * so the export's `text-accent`/`bg-surface` would render chrome copper — gotcha 1). `font-mono`
 * → the scoped `.bp-mono` class (theme.css); headings get `--font-display` from the base rule.
 */
import type { CSSProperties, ReactNode } from 'react';

/** A string field is "present" when it is a non-empty trimmed string. */
export function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// ── Date helpers (export lib/sections.ts, verbatim) ─────────────────────────────────────
export function formatMonth(ym: string | null | undefined): string {
  if (!ym) return '';
  if (ym.toLowerCase() === 'present') return 'Present';
  const [y, m] = ym.split('-');
  if (!m) return y;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Eyebrow ─────────────────────────────────────────────────────────────────────────────
/** The export's `Eyebrow` — a mono accent micro-label with a leading muted `channel` tag
 *  (`CH1`) + a short accent rule, then the `// LABEL` text. */
export function Eyebrow({ children, channel }: { children: ReactNode; channel?: string }) {
  return (
    <div
      className="bp-mono text-xs tracking-[0.18em] uppercase flex items-center gap-3"
      style={{ color: 'var(--accent)' }}
    >
      {channel ? <span style={{ color: 'var(--muted-fg)' }}>{channel}</span> : null}
      <span
        aria-hidden
        className="h-px w-6"
        style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 60%, transparent)' }}
      />
      <span>{children}</span>
    </div>
  );
}

// ── MonoPill ────────────────────────────────────────────────────────────────────────────
export type PillVariant = 'default' | 'accent' | 'core' | 'proficient' | 'learning' | 'muted';

/** The export's six MonoPill variants, translated 1:1 to scoped-token inline styles. */
const pillStyles: Record<PillVariant, CSSProperties> = {
  default: {
    borderColor: 'var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'color-mix(in srgb, var(--fg) 90%, transparent)',
  },
  accent: {
    borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    color: 'var(--accent)',
  },
  core: {
    borderColor: 'var(--accent)',
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-fg)',
  },
  proficient: {
    borderColor: 'color-mix(in srgb, var(--accent) 60%, transparent)',
    backgroundColor: 'transparent',
    color: 'var(--accent)',
  },
  learning: {
    borderColor: 'var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--muted-fg)',
  },
  muted: {
    borderColor: 'var(--border)',
    backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)',
    color: 'var(--muted-fg)',
  },
};

export function MonoPill({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: PillVariant;
}) {
  return (
    <span
      className="bp-mono inline-flex items-center text-[11px] tracking-wider uppercase px-2 py-[3px] rounded-sm border"
      style={pillStyles[variant]}
    >
      {children}
    </span>
  );
}

// ── SectionShell ────────────────────────────────────────────────────────────────────────
/**
 * The export's `SectionShell` INNER content (the outer `<section>` + `data-section-type` is
 * provided by `index.tsx`'s `<ScrollReveal as="section">`). Renders the anchor `id` wrapper,
 * the `px-6 py-24 md:py-32` rhythm, the centered `max-w-[1100px]` column, and the optional
 * header (Eyebrow + heading + subheading).
 */
export function SectionShell({
  id,
  channel,
  eyebrow,
  heading,
  subheading,
  children,
}: {
  id: string;
  channel?: string;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="relative scroll-mt-20 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1100px]">
        {eyebrow || heading || subheading ? (
          <header className="mb-12 max-w-2xl">
            {eyebrow ? <Eyebrow channel={channel}>{eyebrow}</Eyebrow> : null}
            {heading ? (
              <h2 id={`${id}-heading`} className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight">
                {heading}
              </h2>
            ) : null}
            {subheading ? (
              <p className="mt-4 text-base md:text-lg leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
                {subheading}
              </p>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// ── Stars ───────────────────────────────────────────────────────────────────────────────
/** The export's accent star rating (integer 1–5). */
export function Stars({ count, max = 5 }: { count: number; max?: number }) {
  const safe = Math.max(0, Math.min(max, Math.round(count)));
  return (
    <div className="inline-flex gap-1" role="img" aria-label={`${safe} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          aria-hidden
          fill="currentColor"
          style={{ color: i < safe ? 'var(--accent)' : 'var(--border)' }}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// ── TraceDivider ────────────────────────────────────────────────────────────────────────
/** Right-angle "PCB trace" hairline divider between sections (export TraceDivider.tsx). */
export function TraceDivider() {
  return (
    <div aria-hidden className="mx-auto max-w-[1100px] px-6">
      <svg
        viewBox="0 0 1100 24"
        className="w-full h-6"
        fill="none"
        preserveAspectRatio="none"
        style={{ color: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
      >
        <path d="M0 12 L380 12 L400 2 L700 2 L720 22 L1100 22" stroke="currentColor" strokeWidth="1" />
        <circle cx="400" cy="2" r="2.5" fill="currentColor" />
        <circle cx="720" cy="22" r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}

// ── GridBackground ──────────────────────────────────────────────────────────────────────
/** The export's faint blueprint-grid overlay (uses the scoped `.bp-bench-grid` texture). */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 bp-bench-grid pointer-events-none ${className ?? ''}`}
      style={{ opacity: 0.35 }}
    />
  );
}
