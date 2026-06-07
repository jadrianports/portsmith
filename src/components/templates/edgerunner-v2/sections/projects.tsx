'use client';
/**
 * Projects section — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/Projects.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *      border-neon-cyan/30 → color-mix(in oklab, var(--neon-cyan) 30%, transparent)
 *      bg-neon-cyan/5 → color-mix(in oklab, var(--neon-cyan) 5%, transparent)
 *      text-neon-cyan → var(--neon-cyan)
 *      bg-background/60 → color-mix(in srgb, var(--bg) 60%, transparent)
 *      text-foreground/75 → color-mix(in oklab, var(--fg) 75%, transparent)
 *      text-foreground/80 → color-mix(in oklab, var(--fg) 80%, transparent)
 *      text-foreground/85 → color-mix(in oklab, var(--fg) 85%, transparent)
 *      bg-background/80 → color-mix(in srgb, var(--bg) 80%, transparent)
 *      border-neon-purple/20 → color-mix(in oklab, var(--neon-purple) 20%, transparent)
 *      border-neon-purple/30 → color-mix(in oklab, var(--neon-purple) 30%, transparent)
 *      border-neon-cyan/50 → color-mix(in oklab, var(--neon-cyan) 50%, transparent)
 *      bg-gradient-neon → background: var(--gradient-neon)
 *      text-foreground/70 → color-mix(in oklab, var(--fg) 70%, transparent)
 *   3. Custom classes (holo-panel, shadow-neon-pink, text-glow-pink, font-mono-retro,
 *      font-display, text-neon-pink, text-neon-cyan, bg-gradient-neon) KEPT AS-IS.
 *   4. framer-motion → motion/react. ALL motion values VERBATIM.
 *   5. DATA BINDING: projects content items.
 *      active.longDescription → active.description (no longDescription in schema).
 *   6. Modal: focus-trap/Escape/scroll-lock/return-focus (from edgerunner/projects.tsx).
 *   7. 'use client' required.
 */
import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { GitBranch, ExternalLink, X } from 'lucide-react';
import Image from 'next/image';

import type { SectionProps } from './types';
import type { ProjectsContent, ProjectItem } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { isHttpImageSrc } from '@/lib/safe-image';
import { present } from './shared';
import { SectionHeading } from './ui/section-heading';
import { GlowCard } from './ui/glow-card';
import { TiltCard } from './ui/tilt-card';

// ---------------------------------------------------------------------------
// Focus-trap constant (verbatim from edgerunner/projects.tsx / WR-07)
// ---------------------------------------------------------------------------
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Per-accent cycle matches the export
const ACCENT_CYCLE: Array<'pink' | 'cyan' | 'purple'> = ['cyan', 'purple', 'pink'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resolveImage(item: ProjectItem): { url: string; alt: string } | null {
  const url = isHttpImageSrc(item.image) ? item.image : null;
  const alt = present(item.image_alt) ? item.image_alt : null;
  return url && alt ? { url, alt } : null;
}

function resolveTags(item: ProjectItem): string[] {
  return Array.isArray(item.tags) ? item.tags.filter((t) => present(t)) : [];
}

function resolveTech(item: ProjectItem): string[] {
  return Array.isArray(item.tech_stack) ? item.tech_stack.filter((t) => present(t)) : [];
}

// ---------------------------------------------------------------------------
// ProjectModal — bar-for-bar from export, with real a11y mechanics
// ---------------------------------------------------------------------------
function ProjectModal({
  active,
  onClose,
}: {
  active: ProjectItem;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const image = resolveImage(active);
  const repoHref = safeHref(active.repo_url) ?? null;
  const liveHref = safeHref(active.live_url) ?? null;
  const tags = resolveTags(active);
  const tech = resolveTech(active);

  // Scroll-lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Focus trap + Escape
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusables = dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (el) => el.getClientRects().length > 0 || el === document.activeElement
          )
        : [];
      if (focusables.length === 0) { e.preventDefault(); dialog?.focus(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const activeInTrap = active instanceof HTMLElement && focusables.includes(active);
      if (!activeInTrap) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey) { if (active === first) { e.preventDefault(); last.focus(); } }
      else if (active === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] grid place-items-center p-4 backdrop-blur-md"
      style={{ background: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}
      onClick={() => onClose()}
    >
      <m.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={prefersReduced ? undefined : { opacity: 0, scale: 0.92, y: 12 }}
        animate={prefersReduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? undefined : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="holo-panel relative w-full max-w-2xl rounded-2xl p-8 shadow-neon-pink"
        style={{ outline: 'none' }}
      >
        <button
          onClick={() => onClose()}
          aria-label="Close"
          className="absolute right-4 top-4 hover:text-neon-pink"
          style={{ color: 'color-mix(in oklab, var(--fg) 70%, transparent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <X />
        </button>

        {/* Tags eyebrow */}
        {tags.length > 0 ? (
          <div className="font-mono-retro text-base uppercase tracking-widest text-neon-cyan">
            {tags.join(' · ')}
          </div>
        ) : null}

        {/* Title */}
        <h3
          id={titleId}
          className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-glow-pink"
          style={{ color: 'var(--neon-pink)' }}
        >
          {active.title}
        </h3>

        {/* Optional hero image */}
        {image ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'var(--surface-muted)',
              marginTop: '16px',
            }}
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(max-width: 672px) 92vw, 672px"
              unoptimized
              style={{ objectFit: 'cover' }}
            />
          </div>
        ) : null}

        {/* Description */}
        {present(active.description) ? (
          <p
            className="mt-4"
            style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
          >
            {active.description}
          </p>
        ) : null}

        {/* Tech pills */}
        {tech.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tech.map((t) => (
              <span
                key={t}
                className="rounded-md font-mono-retro px-2.5 py-1"
                style={{
                  border: '1px solid color-mix(in oklab, var(--neon-purple) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                  color: 'color-mix(in oklab, var(--fg) 85%, transparent)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Links */}
        <div className="mt-6 flex gap-3">
          {repoHref ? (
            <a
              href={repoHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md font-display text-sm uppercase tracking-widest text-neon-cyan px-4 py-2 hover:shadow-neon-cyan"
              style={{
                border: '1px solid color-mix(in oklab, var(--neon-cyan) 50%, transparent)',
                textDecoration: 'none',
              }}
            >
              <GitBranch className="h-4 w-4" /> Source
            </a>
          ) : null}
          {liveHref ? (
            <a
              href={liveHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-neon font-display text-sm uppercase tracking-widest shadow-neon-pink px-4 py-2"
              style={{ color: 'var(--bg)', textDecoration: 'none' }}
            >
              <ExternalLink className="h-4 w-4" /> Live Demo
            </a>
          ) : null}
        </div>
      </m.div>
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// Projects section root
// ---------------------------------------------------------------------------

export function Projects({ section }: SectionProps) {
  const content = (section?.content ?? null) as ProjectsContent | null;
  const items = content && Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];

  const [activeItem, setActiveItem] = useState<ProjectItem | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const lastOpenSlug = useRef<string | null>(null);

  const openModal = useCallback((item: ProjectItem) => {
    lastOpenSlug.current = item.slug;
    setActiveItem(item);
  }, []);

  const closeModal = useCallback(() => {
    setActiveItem(null);
    const slug = lastOpenSlug.current;
    if (slug) {
      const el = triggerRefs.current.get(slug);
      if (el) setTimeout(() => el.focus(), 0);
    }
    lastOpenSlug.current = null;
  }, []);

  if (!content || items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Selected Work';

  return (
    <>
      <section id="projects" className="relative py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Projects"
            title={heading}
            description="A small slice of recent builds — click any card for the full transmission."
            accent="purple"
          />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => {
              const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
              const image = resolveImage(item);
              const tags = resolveTags(item);
              const tech = resolveTech(item);
              const repoHref = safeHref(item.repo_url) ?? null;
              const liveHref = safeHref(item.live_url) ?? null;

              return (
                <div
                  key={present(item.id) ? item.id : `${item.title}-${i}`}
                >
                  <TiltCard className="h-full">
                    <GlowCard accent={accent} className="h-full cursor-pointer">
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) triggerRefs.current.set(item.slug, el);
                          else triggerRefs.current.delete(item.slug);
                        }}
                        onClick={() => openModal(item)}
                        aria-haspopup="dialog"
                        aria-label={`View details for ${item.title}`}
                        className="block w-full text-left"
                      >
                        {/* Optional project image */}
                        {image ? (
                          <div
                            style={{
                              position: 'relative',
                              width: '100%',
                              aspectRatio: '16 / 9',
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden',
                              background: 'var(--surface-muted)',
                              marginBottom: '12px',
                            }}
                          >
                            <Image
                              src={image.url}
                              alt={image.alt}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              unoptimized
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                        ) : null}

                        {/* Category tags */}
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full font-mono-retro text-sm uppercase tracking-wider text-neon-cyan px-2.5 py-0.5"
                                style={{
                                  border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
                                  background: 'color-mix(in oklab, var(--neon-cyan) 5%, transparent)',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <h3
                          className="mt-3 font-display text-xl font-bold uppercase tracking-wide transition-colors group-hover:text-neon-pink"
                          style={{ color: 'var(--fg)' }}
                        >
                          {item.title}
                        </h3>

                        {present(item.description) ? (
                          <p
                            className="mt-2"
                            style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
                          >
                            {item.description}
                          </p>
                        ) : null}

                        {/* Tech pills */}
                        {tech.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {tech.slice(0, 5).map((t) => (
                              <span
                                key={t}
                                className="rounded-md font-mono-retro px-2 py-0.5"
                                style={{
                                  background: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                                  color: 'color-mix(in oklab, var(--fg) 75%, transparent)',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>

                      {/* Footer links */}
                      {(repoHref || liveHref) ? (
                        <div
                          className="mt-5 flex items-center gap-3 pt-4"
                          style={{
                            borderTop: '1px solid color-mix(in oklab, var(--neon-purple) 20%, transparent)',
                          }}
                        >
                          {repoHref ? (
                            <a
                              href={repoHref}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 font-mono-retro text-base transition-colors hover:text-neon-cyan"
                              style={{
                                color: 'color-mix(in oklab, var(--fg) 80%, transparent)',
                                textDecoration: 'none',
                              }}
                            >
                              <GitBranch className="h-4 w-4" /> GitHub
                            </a>
                          ) : null}
                          {liveHref ? (
                            <a
                              href={liveHref}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 font-mono-retro text-base transition-colors hover:text-neon-pink"
                              style={{
                                color: 'color-mix(in oklab, var(--fg) 80%, transparent)',
                                textDecoration: 'none',
                              }}
                            >
                              <ExternalLink className="h-4 w-4" /> Live
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </GlowCard>
                  </TiltCard>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {activeItem ? (
          <ProjectModal key={activeItem.slug} active={activeItem} onClose={closeModal} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
