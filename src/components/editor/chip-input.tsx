'use client';

/**
 * ChipInput (04-UI-SPEC §10, CMS-04 / D-P4-06) — the tech-stack tag input.
 *
 * A reusable wrapping field of chips + a trailing text input. Type a label + Enter
 * or comma → a chip appears. Used for the project `tech_stack` array (max 10, icons
 * ON) AND the project `tags`/categories array (max 6, icons OFF — see the `max` /
 * `resolveIcons` props). Backspace removes the last chip when the input is empty.
 * Typing an existing label (case-insensitively) FLASHES the existing chip instead
 * of adding a duplicate. At the cap the input disables with the `maxHint` copy.
 *
 * CAPITALIZATION (SAVE/CAPS-FIX): the chip STORES the typed DISPLAY string verbatim
 * ("Next.js", "Web App", "TypeScript") — what you type is what the public template
 * renders. The simple-icons slug is derived ONLY for the optional glyph lookup +
 * the case-insensitive dedupe; it is never the stored value. (Previously the chip
 * stored the lowercased slug, which forced "nextdotjs" onto the public page and
 * stripped all capitalization the user typed.)
 *
 * GLYPH RESOLUTION mirrors the P3 curated idiom (`templates/minimal/sections/icons.ts`,
 * 03-06): the typed name is normalized to a simple-icons slug and looked up in a
 * small curated NAMED-import map; the MONOCHROME brand glyph renders if it resolves,
 * else the chip is text-only (both valid — `icon` is OPTIONAL in the schema; no user
 * string is ever interpolated into the SVG `d`).
 *
 * TAMPERING/XSS (T-04-08a): the tech name is never rendered as a URL or an href —
 * it is a plain text label + an OPTIONAL `<svg>` whose `path` is a CONSTANT from
 * the simple-icons package (no user string is interpolated into the SVG `d`). The
 * section save re-validates the whole content via `validateSectionContent`.
 *
 * Token-driven chrome only (SHARED-E): zero inline hex, zero template-token reach.
 * Reduced-motion-safe (the duplicate flash collapses to no animation).
 *
 * Source: the Input wrapper focus-ring/label contract (`ui/input.tsx`); the curated
 * NAMED simple-icons map idiom (`templates/minimal/sections/icons.ts`, 03-06)
 * [VERIFIED: simple-icons 16.22.0].
 */
import { X } from 'lucide-react';
// NAMED, individual imports ONLY — the tree-shaking guarantee (mirrors icons.ts):
// a namespace/star import of `simple-icons` would pull the whole ~3000-icon set.
import {
  siCss,
  siDocker,
  siGit,
  siGithub,
  siGraphql,
  siHtml5,
  siJavascript,
  siNextdotjs,
  siNodedotjs,
  siPostgresql,
  siPython,
  siReact,
  siRedis,
  siSupabase,
  siTailwindcss,
  siTypescript,
  siVercel,
} from 'simple-icons';
import { useId, useRef, useState } from 'react';

import { FieldError } from '@/components/ui/field-error';

/** Max tech-stack chips (mirrors `tech_stack: z.array(z.string()).max(10)`). */
const TECH_MAX = 10;

/** The minimal brand-glyph shape the chip renders (mirrors icons.ts BrandIcon). */
type BrandGlyph = { path: string; title: string };

/**
 * Curated slug → brand glyph. Keys are the simple-icons slugs the EDITOR stores
 * (so the public template's curated map renders the same logo). A name that does
 * not resolve to one of these keys renders text-only — still valid (icon optional).
 */
const TECH_GLYPHS: Record<string, BrandGlyph> = {
  typescript: { path: siTypescript.path, title: siTypescript.title },
  javascript: { path: siJavascript.path, title: siJavascript.title },
  react: { path: siReact.path, title: siReact.title },
  nextdotjs: { path: siNextdotjs.path, title: siNextdotjs.title },
  nodedotjs: { path: siNodedotjs.path, title: siNodedotjs.title },
  postgresql: { path: siPostgresql.path, title: siPostgresql.title },
  supabase: { path: siSupabase.path, title: siSupabase.title },
  tailwindcss: { path: siTailwindcss.path, title: siTailwindcss.title },
  vercel: { path: siVercel.path, title: siVercel.title },
  html5: { path: siHtml5.path, title: siHtml5.title },
  css: { path: siCss.path, title: siCss.title },
  git: { path: siGit.path, title: siGit.title },
  github: { path: siGithub.path, title: siGithub.title },
  docker: { path: siDocker.path, title: siDocker.title },
  python: { path: siPython.path, title: siPython.title },
  graphql: { path: siGraphql.path, title: siGraphql.title },
  redis: { path: siRedis.path, title: siRedis.title },
};

/**
 * Common display-name aliases → the canonical simple-icons slug. Lets a user type
 * "Next.js" / "Node" / "TS" and still resolve a glyph. Anything not listed falls
 * through to the normalized form (dots → "dot", spaces/punctuation stripped),
 * matching simple-icons' own slug convention (e.g. "Next.js" → "nextdotjs").
 */
const SLUG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  node: 'nodedotjs',
  'node.js': 'nodedotjs',
  nodejs: 'nodedotjs',
  next: 'nextdotjs',
  'next.js': 'nextdotjs',
  nextjs: 'nextdotjs',
  postgres: 'postgresql',
  'postgre sql': 'postgresql',
  tailwind: 'tailwindcss',
  'tailwind css': 'tailwindcss',
  html: 'html5',
  reactjs: 'react',
  'react.js': 'react',
};

/**
 * Normalize a typed tech name to a simple-icons slug: lowercase, trim, apply the
 * alias map, else strip to alphanumerics (simple-icons drops dots/spaces/punct).
 */
export function normalizeSlug(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower in SLUG_ALIASES) return SLUG_ALIASES[lower];
  // simple-icons slugs: "Node.js" → "nodedotjs", "C++" → "cplusplus"-style; for
  // the curated set, stripping to [a-z0-9] resolves the common single-word logos.
  return lower.replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/[^a-z0-9]/g, '');
}

/** Resolve a stored slug to its curated glyph (or null → render text-only). */
function glyphFor(slug: string): BrandGlyph | null {
  return TECH_GLYPHS[slug] ?? null;
}

export interface ChipInputProps {
  label: string;
  /** Controlled array of stored chip labels (the DISPLAY strings, capitalization kept). */
  values: string[];
  /** Change handler — receives the next array. */
  onChange: (next: string[]) => void;
  /** Optional explicit id; auto-generated otherwise. */
  id?: string;
  error?: string;
  /** Max chips (default 10 — `tech_stack`). Projects `tags`/categories pass 6. */
  max?: number;
  /**
   * Resolve a brand glyph for each chip (default true — tech stack). Category/tag
   * chips pass false: they render text-only (no icon match), so an arbitrary label
   * like "Web App" is never coerced toward an icon slug.
   */
  resolveIcons?: boolean;
  /** Per-entry maxLength on the draft input (mirrors the schema's per-item `.max(N)`). */
  entryMaxLength?: number;
  /** The empty-state placeholder (default tech-stack copy). */
  placeholder?: string;
  /** The hint shown below when under the cap (default tech-stack copy). */
  addHint?: string;
  /** The hint shown below when AT the cap (default tech-stack copy). */
  maxHint?: string;
}

export function ChipInput({
  label,
  values,
  onChange,
  id: idProp,
  error,
  max = TECH_MAX,
  resolveIcons = true,
  entryMaxLength,
  placeholder,
  addHint = 'Press Enter or comma to add a technology.',
  maxHint = 'Up to 10 technologies',
}: ChipInputProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const errorId = error ? `${id}-error` : undefined;

  const [draft, setDraft] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const atMax = values.length >= max;

  /**
   * Commit the draft as a chip. We STORE the typed DISPLAY string (capitalization
   * preserved — "Next.js", "Web App"), and only NORMALIZE for icon lookup + dedupe
   * (so "React" and "react" don't both get added, and a glyph still resolves). The
   * public templates render this string verbatim, so what you type is what shows.
   * No-op when empty or at max.
   */
  function commit() {
    const name = draft.trim();
    setDraft('');
    if (!name) return;
    const slug = normalizeSlug(name);
    // Case-insensitive dedupe by normalized slug — flash the existing chip.
    const existing = values.find((v) => normalizeSlug(v) === slug);
    if (existing) {
      setFlashId(existing);
      window.setTimeout(() => setFlashId(null), 600);
      return;
    }
    if (values.length >= max) return;
    onChange([...values, name]);
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      e.preventDefault();
      removeAt(values.length - 1);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>

      {/* The wrapper carries the focus ring (focus-within), matching the Input
          field model. Chips wrap; the text input trails. */}
      <div
        className={
          'flex min-h-11 w-full flex-wrap items-center gap-2 rounded-sm border bg-surface ' +
          'px-2 py-1.5 transition-colors focus-within:border-border-strong ' +
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ' +
          'motion-reduce:transition-none ' +
          (error ? 'border-destructive' : 'border-border')
        }
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((value, index) => {
          // Resolve the glyph from the NORMALIZED form of the stored display label
          // (so "React"/"Next.js" still match), only when this chip wants icons.
          const glyph = resolveIcons ? glyphFor(normalizeSlug(value)) : null;
          const flashing = flashId === value;
          return (
            <span
              key={`${value}-${index}`}
              className={
                'inline-flex items-center gap-1 rounded-sm bg-surface-muted px-2 py-1 ' +
                'text-sm font-semibold text-foreground transition-shadow motion-reduce:transition-none ' +
                (flashing ? 'outline-2 outline-offset-1 outline-ring' : '')
              }
            >
              {glyph ? (
                <svg
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label={glyph.title}
                  width="14"
                  height="14"
                  fill="currentColor"
                  className="shrink-0 text-muted-foreground"
                >
                  <path d={glyph.path} />
                </svg>
              ) : null}
              <span>{value}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(index);
                }}
                aria-label={`Remove ${value}`}
                className={
                  'flex size-5 items-center justify-center rounded-full text-muted-foreground ' +
                  'outline-none hover:text-foreground focus-visible:outline-2 ' +
                  'focus-visible:outline-offset-1 focus-visible:outline-ring'
                }
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          );
        })}

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          disabled={atMax}
          maxLength={entryMaxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          placeholder={
            atMax ? '' : values.length === 0 ? (placeholder ?? 'Type a tech, press Enter') : ''
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          className={
            'min-w-[8rem] flex-1 bg-transparent px-1 text-base text-foreground outline-none ' +
            'placeholder:text-muted-foreground disabled:cursor-not-allowed'
          }
        />
      </div>

      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : (
        <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
          {atMax ? maxHint : addHint}
        </p>
      )}
    </div>
  );
}
