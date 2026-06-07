'use client';
/**
 * Blog prose element components for edgerunner-v2.
 *
 * Transcribed from:
 *   lovable-exports/synthwave-founder/src/components/blog/mdx-components.tsx
 *   lovable-exports/synthwave-founder/src/components/blog/Callout.tsx
 *   lovable-exports/synthwave-founder/src/components/blog/CodeBlock.tsx
 *
 * TRANSCRIPTION RULES:
 *   1. Layout/sizing/typography classes VERBATIM from export.
 *   2. Color utility classes → inline style with scoped var(--token):
 *        text-foreground/85 → color-mix(in oklab, var(--fg) 85%, transparent)
 *        text-muted-foreground → var(--muted-fg)
 *        border-border/60 → color-mix(in oklab, var(--border) 60%, transparent)
 *        border-border/40 → color-mix(in oklab, var(--border) 40%, transparent)
 *        bg-card/50 → color-mix(in srgb, var(--surface) 50%, transparent)
 *        bg-background/40 → color-mix(in srgb, var(--bg) 40%, transparent)
 *        bg-neon-N/5 → color-mix(in srgb, var(--neon-N) 5%, transparent)
 *        bg-neon-N/10 → color-mix(in srgb, var(--neon-N) 10%, transparent)
 *        border-neon-N/30 → color-mix(in oklab, var(--neon-N) 30%, transparent)
 *        border-neon-N/40 → color-mix(in oklab, var(--neon-N) 40%, transparent)
 *        border-neon-N/50 → color-mix(in oklab, var(--neon-N) 50%, transparent)
 *        bg-bg-deep/80 → color-mix(in srgb, var(--bg-deep) 80%, transparent)
 *   3. Custom classes (font-display, font-mono-retro, text-glow-*, text-neon-*)
 *      KEPT AS-IS (scoped in theme.css).
 *   4. 'use client' required for CodeBlock copy button state.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

// ── Callout ───────────────────────────────────────────────────────────────────

type Tone = 'pink' | 'cyan' | 'purple';

interface CalloutToneStyle {
  borderColor: string;
  background: string;
  color: string;
  textShadow: string;
}

const calloutToneStyles: Record<Tone, CalloutToneStyle> = {
  pink: {
    borderColor: 'color-mix(in oklab, var(--neon-pink) 50%, transparent)',
    background: 'color-mix(in srgb, var(--neon-pink) 5%, transparent)',
    color: 'var(--neon-pink)',
    textShadow: '0 0 8px var(--neon-pink), 0 0 24px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
  },
  cyan: {
    borderColor: 'color-mix(in oklab, var(--neon-cyan) 50%, transparent)',
    background: 'color-mix(in srgb, var(--neon-cyan) 5%, transparent)',
    color: 'var(--neon-cyan)',
    textShadow: '0 0 8px var(--neon-cyan), 0 0 24px color-mix(in oklab, var(--neon-cyan) 50%, transparent)',
  },
  purple: {
    borderColor: 'color-mix(in oklab, var(--neon-purple) 50%, transparent)',
    background: 'color-mix(in srgb, var(--neon-purple) 5%, transparent)',
    color: 'var(--neon-purple)',
    textShadow: '0 0 8px var(--neon-purple), 0 0 24px color-mix(in oklab, var(--neon-purple) 50%, transparent)',
  },
};

export function Callout({
  tone = 'cyan',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const s = calloutToneStyles[tone];
  return (
    <aside
      className="my-8 rounded-lg border-l-2 px-5 py-4 font-display text-lg italic"
      style={{
        borderColor: s.borderColor,
        background: s.background,
        color: s.color,
        textShadow: s.textShadow,
      }}
    >
      {children}
    </aside>
  );
}

// ── CodeBlock ────────────────────────────────────────────────────────────────

export function CodeBlock({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLPreElement> & { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = preRef.current?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };

  return (
    <div
      className="group my-6 overflow-hidden rounded-lg transition-all"
      style={{
        border: '1px solid color-mix(in oklab, var(--neon-purple) 40%, transparent)',
        background: 'color-mix(in srgb, var(--bg-deep) 80%, transparent)',
        boxShadow: '0 0 12px color-mix(in oklab, var(--neon-purple) 30%, transparent)',
      }}
    >
      {/* Window chrome header */}
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{
          borderColor: 'color-mix(in oklab, var(--neon-purple) 30%, transparent)',
          background: 'oklch(0.08 0.05 290)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--neon-pink)', boxShadow: '0 0 6px var(--neon-pink)' }}
          />
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--neon-yellow)' }}
          />
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--neon-cyan)', boxShadow: '0 0 6px var(--neon-cyan)' }}
          />
          <span
            className="ml-3 font-mono-retro text-xs uppercase tracking-[0.3em]"
            style={{ color: 'color-mix(in oklab, var(--neon-cyan) 70%, transparent)' }}
          >
            ./run
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono-retro text-xs uppercase tracking-wider transition-colors"
          style={{
            border: '1px solid color-mix(in oklab, var(--border) 60%, transparent)',
            color: 'var(--muted-fg)',
          }}
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> copy
            </>
          )}
        </button>
      </div>
      <pre
        ref={preRef}
        className={[
          'overflow-x-auto p-4 text-[0.95rem] leading-relaxed',
          '[&_code]:!bg-transparent [&_code]:!border-0 [&_code]:!p-0 [&_code]:!text-inherit [&_code]:!rounded-none [&_code]:font-mono',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {children}
      </pre>
    </div>
  );
}

// ── Prose element components (mdx-components transcription) ──────────────────

export const ProseH2 = ({ children }: { children?: ReactNode }) => (
  <h2 className="mt-12 mb-3 font-display text-2xl font-bold uppercase tracking-wider text-neon-cyan text-glow-cyan">
    {children}
  </h2>
);

export const ProseH3 = ({ children }: { children?: ReactNode }) => (
  <h3 className="mt-8 mb-2 font-display text-xl font-semibold uppercase tracking-wide text-neon-purple text-glow-purple">
    {children}
  </h3>
);

export const ProseP = ({ children }: { children?: ReactNode }) => (
  <p
    className="my-5 text-lg leading-relaxed"
    style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
  >
    {children}
  </p>
);

export const ProseUl = ({ children }: { children?: ReactNode }) => (
  <ul
    className="my-5 space-y-2 pl-1"
    style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
  >
    {children}
  </ul>
);

export const ProseLi = ({ children }: { children?: ReactNode }) => (
  <li className="flex items-start gap-3 text-lg">
    <span
      className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{
        background: 'var(--neon-pink)',
        boxShadow: '0 0 6px var(--neon-pink)',
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
    <span>{children}</span>
  </li>
);

export const ProseBlockquote = ({ children }: { children?: ReactNode }) => (
  <blockquote
    className="my-8 border-l-2 px-6 py-4 font-display text-xl italic text-neon-purple text-glow-purple"
    style={{
      borderColor: 'color-mix(in oklab, var(--neon-purple) 100%, transparent)',
      background: 'color-mix(in srgb, var(--neon-purple) 5%, transparent)',
    }}
  >
    {children}
  </blockquote>
);

export const ProseInlineCode = ({ children }: { children?: ReactNode }) => (
  <code
    className="rounded font-mono-retro text-base text-neon-cyan"
    style={{
      border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
      background: 'color-mix(in srgb, var(--neon-cyan) 10%, transparent)',
      padding: '0.125rem 0.375rem',
    }}
  >
    {children}
  </code>
);

export const ProseHr = () => (
  <div className="my-10 h-px bg-gradient-neon" />
);

// Table components
export const ProseTable = ({ children }: { children?: ReactNode }) => (
  <div
    className="my-6 overflow-x-auto rounded-lg"
    style={{ border: '1px solid color-mix(in oklab, var(--border) 60%, transparent)' }}
  >
    <table className="w-full border-collapse text-left">{children}</table>
  </div>
);

export const ProseTh = ({ children }: { children?: ReactNode }) => (
  <th
    className="border-b px-4 py-2 font-mono-retro text-sm uppercase tracking-wider text-neon-purple"
    style={{
      borderColor: 'color-mix(in oklab, var(--neon-purple) 40%, transparent)',
      background: 'color-mix(in srgb, var(--neon-purple) 10%, transparent)',
    }}
  >
    {children}
  </th>
);

export const ProseTd = ({ children }: { children?: ReactNode }) => (
  <td
    className="border-b px-4 py-2"
    style={{
      borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)',
      color: 'color-mix(in oklab, var(--fg) 85%, transparent)',
    }}
  >
    {children}
  </td>
);
