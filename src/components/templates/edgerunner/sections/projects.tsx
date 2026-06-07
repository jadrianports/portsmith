'use client';
/**
 * Projects section (edgerunner section 5) — faithful synthwave "selected work" grid
 * (translated from `synthwave-founder/src/components/sections/Projects.tsx`).
 *
 * STRUCTURE:
 *   - 3-col responsive grid of TiltCard + GlowCard cards (SSR-visible; JS-enhanced tilt).
 *   - Per-card entrance stagger via <ScrollReveal as="li" delay={i*60}>.
 *   - Each card: optional image, tech pills, title (display font), description (clamped),
 *     footer links (GitHub + Live via safeHref + lucide icons, stopPropagation).
 *   - The card itself has an accessible trigger (title <button> + whole-card onClick) that
 *     opens the modal for that item.
 *   - Modal: overlay + dialog with focus trap, Escape closes, click-backdrop closes,
 *     scroll-lock while open, return focus to trigger on close, AnimatePresence entrance.
 *
 * MODAL A11Y: focus trap + Escape + scroll-lock + return-focus mechanics are copied
 * directly from `@/components/public/project-modal` (the minimal template's proven
 * accessible-dialog island). The same FOCUSABLE_SELECTOR + WR-07 visibility filter are
 * reproduced verbatim.
 *
 * MODAL TOKENS: `--tmpl-modal-backdrop`, `--tmpl-modal-shadow`, `--tmpl-modal-hairline`
 * (already defined in theme.css). `.tmpl-modal-backdrop-enter` / `.tmpl-project-modal-enter`
 * CSS animation classes are already defined in theme.css.
 *
 * NOTE: AnimatePresence is ONLY used for reduced-motion-gated entrance animation. The
 * modal renders its FINAL visible state without motion — under reduced-motion the CSS
 * animation classes are zeroed by theme.css's blanket reset, so the dialog appears
 * immediately.
 *
 * R1: motion/react (not framer-motion). R3: tokens only. R4: isHttpImageSrc + unoptimized.
 * R5: grid SSR-visible; modal closed by default. R6: 'use client' (modal state + AnimatePresence).
 * R7: safeHref on live_url/repo_url; stopPropagation on card footer links.
 */
import Image from 'next/image';
import { GitBranch, ExternalLink, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import type { SectionProps } from './types';
import type { ProjectsContent, ProjectItem } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { isHttpImageSrc } from '@/lib/safe-image';
import { ScrollReveal } from '../../_kit';
import { TiltCard } from './ui/tilt-card';
import { GlowCard } from './ui/glow-card';
import { present, kickerStyle, headingStyle, sectionShellStyle } from './shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve safe image URL + alt (both must be present). */
function resolveImage(item: ProjectItem): { url: string; alt: string } | null {
  const url = isHttpImageSrc(item.image) ? item.image : null;
  const alt = present(item.image_alt) ? item.image_alt : null;
  return url && alt ? { url, alt } : null;
}

/** Resolve safe outbound links. */
function resolveLinks(item: ProjectItem): { live: string | null; repo: string | null } {
  return {
    live: safeHref(item.live_url) ?? null,
    repo: safeHref(item.repo_url) ?? null,
  };
}

/** Filtered, non-empty tech-stack entries. */
function resolveTech(item: ProjectItem): string[] {
  return Array.isArray(item.tech_stack) ? item.tech_stack.filter((t) => present(t)) : [];
}

// Per-accent neon glow colors for tech pill borders on the card.
const ACCENT_CYCLE: Array<'pink' | 'cyan' | 'purple'> = ['cyan', 'purple', 'pink'];

// ---------------------------------------------------------------------------
// Focus-trap constants (verbatim from project-modal.tsx / WR-07)
// ---------------------------------------------------------------------------
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------------------
// ProjectModal
// ---------------------------------------------------------------------------

interface ProjectModalProps {
  item: ProjectItem;
  onClose: () => void;
}

/**
 * The accessible dialog — atmospheric neon backdrop + edge-glow surface + item detail.
 * Focus-trapped, Esc-closable, click-scrim closes, scroll-locked, return-focus on close.
 * Entrance animation via AnimatePresence (reduced-motion-gated via CSS + JS gate).
 */
function ProjectModal({ item, onClose }: ProjectModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const image = resolveImage(item);
  const { live, repo } = resolveLinks(item);
  const techStack = resolveTech(item);

  // Scroll-lock: prevent page scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus management + focus trap (verbatim from project-modal.tsx / WR-07).
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // WR-07: drive the trap off the DIALOG BOUNDARY. Use getClientRects() not
      // offsetParent (offsetParent is null for position:fixed even when visible).
      const focusables = dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (el) => el.getClientRects().length > 0 || el === document.activeElement,
          )
        : [];

      if (focusables.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      // WR-07: if active is not in the trap, force it back to the boundary.
      const activeInTrap = active instanceof HTMLElement && focusables.includes(active);
      if (!activeInTrap) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="tmpl-modal-backdrop tmpl-modal-backdrop-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      initial={prefersReduced ? undefined : { opacity: 0 }}
      animate={prefersReduced ? undefined : { opacity: 1 }}
      exit={prefersReduced ? undefined : { opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'var(--tmpl-modal-backdrop)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="tmpl-project-modal tmpl-project-modal-enter"
        initial={prefersReduced ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
        animate={prefersReduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? undefined : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: 'min(680px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '28px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--tmpl-modal-shadow)',
          outline: 'none',
        }}
      >
        {/* Neon top-hairline (always visible; entrance sweep is reduced-motion-gated in CSS). */}
        <span
          aria-hidden="true"
          className="tmpl-modal-hairline"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            borderTopLeftRadius: 'var(--radius-lg)',
            borderTopRightRadius: 'var(--radius-lg)',
            background: 'var(--tmpl-modal-hairline)',
          }}
        />

        {/* Header: eyebrow + title + 44px close button. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 400,
                lineHeight: 1.3,
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                color: 'var(--neon-cyan)',
                margin: 0,
              }}
            >
              {'// project'}
            </p>
            <h2
              id={titleId}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                lineHeight: 1.15,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--neon-pink)',
                margin: 0,
              }}
              className="tmpl-glow-pink"
            >
              {item.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tmpl-modal-close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              flexShrink: 0,
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted-fg)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <X size={20} aria-hidden="true" strokeWidth={2} />
          </button>
        </div>

        {/* Hero image — 16:9 CLS-safe box, rendered only when guarded URL + alt present. */}
        {image ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'var(--surface-muted)',
            }}
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(max-width: 720px) 92vw, 680px"
              unoptimized
              style={{ objectFit: 'cover' }}
            />
          </div>
        ) : null}

        {/* Full description (untruncated — no separate longDescription, reuse description). */}
        {present(item.description) ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.55,
              color: 'var(--muted-fg)',
              margin: 0,
            }}
          >
            {item.description}
          </p>
        ) : null}

        {/* Tech chips (mono, surface-muted + neon-cyan glow class). */}
        {techStack.length > 0 ? (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {techStack.map((tech, ti) => (
              <li
                key={`${tech}-${ti}`}
                className="tmpl-modal-chip"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  lineHeight: 1.4,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-muted)',
                  color: 'var(--neon-cyan)',
                  border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
                }}
              >
                {tech}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Outbound links — render-if-present with neon styling. */}
        {live || repo ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '4px',
            }}
          >
            {repo ? (
              <a
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in oklab, var(--neon-cyan) 50%, transparent)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--neon-cyan)',
                  textDecoration: 'none',
                }}
              >
                <GitBranch size={14} aria-hidden="true" strokeWidth={2} />
                Source
              </a>
            ) : null}
            {live ? (
              <a
                href={live}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--neon-gradient)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--bg)',
                  textDecoration: 'none',
                  boxShadow: 'var(--tmpl-modal-cta-shadow)',
                }}
              >
                <ExternalLink size={14} aria-hidden="true" strokeWidth={2} />
                Live Demo
              </a>
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Projects section root
// ---------------------------------------------------------------------------

export function Projects({ section }: SectionProps) {
  const content = (section?.content ?? null) as ProjectsContent | null;
  if (!content) return null;

  // hide-if-empty: only items with a title survive; no items → hide the section.
  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Selected Work';

  // Modal state: open item + per-item trigger refs for return-focus.
  const [activeItem, setActiveItem] = useState<ProjectItem | null>(null);
  const triggerRefs = useRef<Map<string, HTMLElement | null>>(new Map());
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
      // Defer focus return by one tick so the modal's unmount doesn't steal it back.
      if (el) setTimeout(() => el.focus(), 0);
    }
    lastOpenSlug.current = null;
  }, []);

  return (
    <>
      <div
        className="tmpl-shell"
        style={sectionShellStyle}
      >
        {/* Mono section kicker */}
        <p style={kickerStyle}>05 / work</p>

        {/* Section heading (Orbitron display, foreground) */}
        <h2 style={headingStyle}>{heading}</h2>

        {/* 3-col responsive card grid as a <ul> (list-reset via inline style). */}
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: '24px',
            gridTemplateColumns: 'repeat(1, 1fr)',
          }}
          className="tmpl-projects-grid"
        >
          {items.map((item, i) => {
            const accentIdx = i % ACCENT_CYCLE.length;
            const accent = ACCENT_CYCLE[accentIdx];
            const image = resolveImage(item);
            const { live, repo } = resolveLinks(item);
            const techStack = resolveTech(item);
            // Show max 5 tech pills on the card; rest visible in modal.
            const visibleTech = techStack.slice(0, 5);

            return (
              <ScrollReveal key={present(item.id) ? item.id : `${item.title}-${i}`} as="li" delay={i * 60}>
                <TiltCard>
                  <GlowCard accent={accent} as="div">
                    {/* The whole inner div is click-to-open; links inside stop propagation. */}
                    <div
                      ref={(el) => {
                        if (el) triggerRefs.current.set(item.slug, el);
                        else triggerRefs.current.delete(item.slug);
                      }}
                      onClick={() => openModal(item)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        cursor: 'pointer',
                        height: '100%',
                      }}
                    >
                      {/* Optional project image (origin-guarded, 16:9 CLS-safe). */}
                      {image ? (
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '16 / 9',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            background: 'var(--surface-muted)',
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

                      {/* Tech pills (capped at 5 on the card). */}
                      {visibleTech.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {visibleTech.map((t) => (
                            <span
                              key={t}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'color-mix(in oklab, var(--neon-cyan) 8%, var(--surface-muted))',
                                color: 'var(--neon-cyan)',
                                border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* Title — the accessible modal trigger (canonical keyboard control). */}
                      <h3 style={{ margin: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(item);
                          }}
                          aria-haspopup="dialog"
                          aria-label={`View details for ${item.title}`}
                          style={{
                            display: 'block',
                            width: '100%',
                            margin: 0,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: '1.15rem',
                            lineHeight: 1.2,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--fg)',
                          }}
                        >
                          {item.title}
                        </button>
                      </h3>

                      {/* Description — clamped to 3 lines on the card. */}
                      {present(item.description) ? (
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontWeight: 400,
                            fontSize: '14px',
                            lineHeight: 1.55,
                            color: 'var(--muted-fg)',
                            margin: 0,
                            // Clamp to 3 lines on the card.
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 3,
                            overflow: 'hidden',
                          }}
                        >
                          {item.description}
                        </p>
                      ) : null}

                      {/* Card footer: GitHub + Live links (stopPropagation so they don't open modal). */}
                      {live || repo ? (
                        <div
                          style={{
                            marginTop: 'auto',
                            paddingTop: '12px',
                            borderTop: '1px solid color-mix(in oklab, var(--neon-purple) 20%, transparent)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                          }}
                        >
                          {repo ? (
                            <a
                              href={repo}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="tmpl-project-link"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                minHeight: '44px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '13px',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                color: 'var(--muted-fg)',
                                textDecoration: 'none',
                              }}
                            >
                              <GitBranch size={14} aria-hidden="true" strokeWidth={2} />
                              GitHub
                            </a>
                          ) : null}
                          {live ? (
                            <a
                              href={live}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="tmpl-project-link"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                minHeight: '44px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '13px',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                color: 'var(--muted-fg)',
                                textDecoration: 'none',
                              }}
                            >
                              <ExternalLink size={14} aria-hidden="true" strokeWidth={2} />
                              Live
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </GlowCard>
                </TiltCard>
              </ScrollReveal>
            );
          })}
        </ul>
      </div>

      {/* Modal — AnimatePresence for mount/unmount transition. */}
      <AnimatePresence>
        {activeItem ? (
          <ProjectModal key={activeItem.slug} item={activeItem} onClose={closeModal} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
