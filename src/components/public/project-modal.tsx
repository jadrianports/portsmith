'use client';

/**
 * ProjectsWithModal + ProjectModal (TMPL-06 / 06-04 / UI-SPEC Surface 5 — THE HERO
 * SURFACE). The deep-linkable, focus-trapped, keyboard-accessible work-item modal.
 *
 * LOAD-BEARING INVARIANT (D-18 / D-22 / RESEARCH Pitfall 1): the `?project=<slug>`
 * param is read ONLY client-side via `useSearchParams()`; the public `/[username]`
 * page NEVER reads `searchParams` server-side (that flips the route to `ƒ` dynamic
 * and breaks the SSG/ISR perf budget — the `tests/build/route-table-ssg.test.ts`
 * assertion is the binding regression guard). Open/close sync the URL via
 * `window.history.pushState` (a SHALLOW push — no server navigation), NEVER the
 * Pages-router `router.push(url, undefined, { shallow })`. The modal opens from item
 * data ALREADY in the rendered page payload — no fetch.
 *
 * This is a `'use client'` island. `projects.tsx` stays a Server Component that
 * passes the server-read `items` (+ heading) into this island; the island is the
 * ONLY client boundary. The frozen `SectionProps = { section }` contract is
 * untouched (no new section prop).
 *
 * RENDER REUSE: the cards + the modal detail reuse the EXACT `projects.tsx` field
 * vocabulary (16:9 image box, Clash Display title, Body description, mono tech
 * chips, "Visit ↗"/"Code ↗" links) and the SAME `safeHref`/`isHttpImageSrc` guards.
 * [TMPL] scoped `var(--token)` only — no chrome `ui/*`/`globals.css` classes, no raw
 * hex outside the documented decorative glow alphas (the same exemption the card
 * glow-lift uses in theme.css).
 *
 * A11y (hard): `role="dialog"` + `aria-modal="true"` + an accessible name (the
 * project title); focus moves into the dialog on open and is TRAPPED; Esc closes;
 * focus returns to the originating card on close; click-scrim closes; the close
 * button + links are 44px with `aria-label`s. Mirrors the shipped `CropModal`
 * (Phase 5) accessible-dialog pattern, template-scoped.
 *
 * REDUCED-MOTION (hard): the entrance keyframes (`.tmpl-project-modal-enter` /
 * `.tmpl-modal-backdrop-enter` in theme.css) are gated under
 * `@media (prefers-reduced-motion: no-preference)`; the blanket `.tmpl-minimal *`
 * reset zeroes animation/transition under reduce. The modal therefore renders its
 * FINAL visible state without relying on a JS class to reveal it — content (image,
 * title, body, chips, links) is fully visible immediately.
 */
import Image from 'next/image';
import { ArrowUpRight, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import type { ProjectItem } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { isHttpImageSrc } from '@/lib/safe-image';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** A single outbound project link ("Visit ↗" / "Code ↗") — cyan glow on hover. */
function ProjectLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="tmpl-project-link"
      // Clicking a link inside a card must NOT also open the modal.
      onClick={(e) => e.stopPropagation()}
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
        color: 'var(--fg)',
        textDecoration: 'none',
      }}
    >
      {label}
      <ArrowUpRight size={14} aria-hidden="true" strokeWidth={2} />
    </a>
  );
}

/** Resolve an item's safe image + alt (re-guarded exactly like the card render). */
function resolveImage(item: ProjectItem): { url: string; alt: string } | null {
  const url = isHttpImageSrc(item.image) ? item.image : null;
  const alt = present(item.image_alt) ? item.image_alt : null;
  return url && alt ? { url, alt } : null;
}

/** Resolve an item's safe outbound links. */
function resolveLinks(item: ProjectItem): { live: string | null; repo: string | null } {
  return {
    live: safeHref(item.live_url) ?? null,
    repo: safeHref(item.repo_url) ?? null,
  };
}

/** Filtered, non-empty tech-stack entries (defensive). */
function resolveTech(item: ProjectItem): string[] {
  return Array.isArray(item.tech_stack) ? item.tech_stack.filter((t) => present(t)) : [];
}

/**
 * A clickable project card (the modal trigger). Keeps the EXACT `projects.tsx`
 * card visuals; the whole card is a button-like trigger that calls `onOpen()`.
 */
function ProjectCardTrigger({
  item,
  onOpen,
  triggerRef,
}: {
  item: ProjectItem;
  onOpen: () => void;
  triggerRef?: (el: HTMLElement | null) => void;
}) {
  const image = resolveImage(item);
  const { live, repo } = resolveLinks(item);
  const techStack = resolveTech(item);

  return (
    // A11y (WCAG 4.1.2 nested-interactive): the card is a PLAIN container — NOT
    // `role="button"`/`tabindex`. An interactive `role="button"` element MUST NOT contain
    // focusable interactive descendants (the "Visit ↗"/"Code ↗" `<a>` links), which axe flags
    // `nested-interactive` (serious). The accessible modal TRIGGER is the title `<button>`
    // below (keyboard-operable, with the accessible name); the whole-card `onClick` is a
    // pointer-only convenience (mouse users can click anywhere on the card), and links inside
    // `stopPropagation()` so they don't also open the modal. Keyboard/AT users reach the modal
    // via the title button and the links as separate, non-nested controls.
    <article
      ref={triggerRef}
      className="tmpl-project-card"
      onClick={onOpen}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 24px -16px rgba(0, 0, 0, 0.5)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
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
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
            style={{ objectFit: 'cover' }}
          />
        </div>
      ) : null}

      {/* The accessible modal TRIGGER (WCAG 4.1.2 fix): a real <button> that LOOKS like the
          heading (transparent, no border, inherits the display-font scale). It is the
          keyboard/AT-operable control (Enter/Space) with the accessible name; the surrounding
          card is a plain container, so there is no nested-interactive violation. Visually
          identical to the prior <h3> — same font/size/color/weight, left-aligned, no chrome. */}
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          onClick={(e) => {
            // The title button is the canonical trigger; stop the card's onClick from
            // double-firing the open handler.
            e.stopPropagation();
            onOpen();
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
            fontWeight: 600,
            fontSize: '1.25rem',
            lineHeight: 1.2,
            color: 'var(--fg)',
          }}
        >
          {item.title}
        </button>
      </h3>

      {present(item.description) ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--muted-fg)',
            margin: 0,
          }}
        >
          {item.description}
        </p>
      ) : null}

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
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                lineHeight: 1.4,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-muted)',
                color: 'var(--muted-fg)',
                border: '1px solid var(--border)',
              }}
            >
              {tech}
            </li>
          ))}
        </ul>
      ) : null}

      {live || repo ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            marginTop: 'auto',
            paddingTop: '8px',
          }}
        >
          {live ? <ProjectLink href={live} label="Visit ↗" /> : null}
          {repo ? <ProjectLink href={repo} label="Code ↗" /> : null}
        </div>
      ) : null}
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

/** The set of focusable selectors for the focus trap (mirrors common patterns). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ProjectModalProps {
  item: ProjectItem;
  onClose: () => void;
}

/**
 * The presentational dialog — atmospheric synthwave backdrop + edge-glow surface +
 * the item's full detail. Focus-trapped, Esc-closable, click-scrim closes.
 */
function ProjectModal({ item, onClose }: ProjectModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const image = resolveImage(item);
  const { live, repo } = resolveLinks(item);
  const techStack = resolveTech(item);

  // Esc closes; focus moves into the dialog on open; focus is trapped within it.
  useEffect(() => {
    const dialog = dialogRef.current;
    // Move focus into the dialog on open (focus-trap entry — the deep-link
    // auto-open path also lands here).
    dialog?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Trap Tab/Shift+Tab inside the dialog (WR-07: drive the trap off the DIALOG BOUNDARY,
      // not a per-element visibility proxy). Visibility filter uses
      // `getClientRects().length > 0` instead of `offsetParent !== null`: `offsetParent` is
      // `null` for ANY `position: fixed` element even when fully visible, so the old proxy
      // would silently exclude a legitimately-focusable fixed control (a future template could
      // add one) and let Tab escape the dialog. `getClientRects()` correctly reports a visible
      // fixed element as focusable.
      const focusables = dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (el) => el.getClientRects().length > 0 || el === document.activeElement,
          )
        : [];
      if (focusables.length === 0) {
        // Nothing focusable but the dialog itself — keep focus on the dialog.
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      // WR-07: if the active element is NOT one of the tracked focusables (e.g. focus landed
      // on the scrim, the dialog container itself, or a control the visibility filter dropped),
      // the boundary checks below (`active === first`/`active === last`) would never fire and
      // focus could leak out of the modal — the trap would not be total. Force focus back to
      // the boundary in BOTH directions so the trap is complete regardless of where focus is.
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
    <div
      className="tmpl-modal-backdrop tmpl-modal-backdrop-enter"
      onClick={(e) => {
        // Click on the scrim (not the dialog) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        // Atmospheric backdrop: --bg at high alpha + blur + a faint sunset/grid
        // horizon echo bleeding from the bottom edge (NOT a flat scrim).
        background:
          'radial-gradient(120% 80% at 50% 120%, rgba(255, 45, 149, 0.10) 0%, rgba(140, 30, 255, 0.06) 35%, transparent 70%), color-mix(in srgb, var(--bg) 82%, transparent)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="tmpl-project-modal tmpl-project-modal-enter"
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
          // Magenta/violet edge-glow tying it to the card glow-lift.
          boxShadow:
            '0 0 0 1px var(--accent), 0 24px 60px -20px rgba(255, 45, 149, 0.45), 0 0 80px -30px rgba(157, 92, 255, 0.5)',
          outline: 'none',
        }}
      >
        {/* The signature sunset-gradient top-hairline (static; decorative — survives
            reduced-motion). The entrance "sweep" is gated under no-preference in
            theme.css; the hairline itself is always visible. */}
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
            background: 'var(--sunset-gradient)',
          }}
        />

        {/* Header: meta + title + 44px close. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 500,
                lineHeight: 1.4,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--accent-cyan)',
                margin: 0,
              }}
            >
              {'// project'}
            </p>
            <h2
              id={titleId}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                lineHeight: 1.2,
                color: 'var(--fg)',
                margin: 0,
              }}
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

        {/* Hero image — large 16:9 box (same ratio as the card, CLS-safe). Rendered
            only when a safe URL + its required alt are present. */}
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

        {/* Full description (Body 16/1.6 — not truncated like the card). */}
        {present(item.description) ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'var(--muted-fg)',
              margin: 0,
            }}
          >
            {item.description}
          </p>
        ) : null}

        {/* Tech chips (mono, surface-muted fill — softly glowing on the dialog). */}
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
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-muted)',
                  color: 'var(--muted-fg)',
                  border: '1px solid var(--border)',
                }}
              >
                {tech}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Outbound links — render-if-present, same treatment as the card. */}
        {live || repo ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              paddingTop: '4px',
            }}
          >
            {live ? <ProjectLink href={live} label="Visit ↗" /> : null}
            {repo ? <ProjectLink href={repo} label="Code ↗" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

/** The responsive card grid — shared by the live island AND the Suspense fallback. */
function ProjectCardGrid({
  items,
  onOpen,
  triggerRef,
}: {
  items: ProjectItem[];
  onOpen: (slug: string) => void;
  triggerRef?: (slug: string, el: HTMLElement | null) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '24px',
      }}
    >
      {items.map((item, i) => (
        <ProjectCardTrigger
          key={present(item.id) ? item.id : `${item.title}-${i}`}
          item={item}
          onOpen={() => onOpen(item.slug)}
          triggerRef={triggerRef ? (el) => triggerRef(item.slug, el) : undefined}
        />
      ))}
    </div>
  );
}

export interface ProjectsWithModalProps {
  /** The validated, server-read project items (already in the page payload). */
  items: ProjectItem[];
}

/**
 * The inner `'use client'` island: owns open state + the `useSearchParams()` initial
 * read + the `window.history.pushState` URL sync. Renders the clickable card grid
 * and, when an item is open, the focus-trapped modal. NEVER reads `searchParams`
 * server-side (the page stays SSG/ISR — D-22).
 *
 * `useSearchParams()` opts this subtree into client-side rendering; Next 16 requires
 * it to sit under a `<Suspense>` boundary so the rest of `/[username]` can still be
 * statically prerendered (the missing-suspense-with-csr-bailout build error). The
 * boundary is added by the exported `ProjectsWithModal` wrapper below — keeping the
 * page SSG (the param is read on the client only, exactly as D-18/D-22 require).
 */
function ProjectsWithModalInner({ items }: ProjectsWithModalProps) {
  const searchParams = useSearchParams();
  // Initial deep-link read: if `?project=<slug>` matches an item, open it on mount.
  const [openSlug, setOpenSlug] = useState<string | null>(() => searchParams.get('project'));

  // Remember the card that opened the modal so focus returns to it on close.
  const triggerRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const lastTriggerSlug = useRef<string | null>(null);

  const open = useCallback((slug: string) => {
    lastTriggerSlug.current = slug;
    setOpenSlug(slug);
    // Shallow push — NO server round-trip; the page stays static (D-18 / D-22).
    window.history.pushState(null, '', `?project=${encodeURIComponent(slug)}`);
  }, []);

  const close = useCallback(() => {
    const returnSlug = lastTriggerSlug.current;
    setOpenSlug(null);
    // Restore the bare path (drop the ?project= param).
    window.history.pushState(null, '', window.location.pathname);
    // Return focus to the originating card (a11y: focus returns to the trigger).
    if (returnSlug) {
      const el = triggerRefs.current.get(returnSlug);
      el?.focus();
    }
    lastTriggerSlug.current = null;
  }, []);

  // Resolve the open item from in-page data. A non-matching slug silently does NOT
  // open (UI-SPEC "item-not-found" — no error, no toast).
  const openItem = openSlug ? (items.find((i) => i.slug === openSlug) ?? null) : null;

  return (
    <>
      <ProjectCardGrid
        items={items}
        onOpen={open}
        triggerRef={(slug, el) => {
          if (el) triggerRefs.current.set(slug, el);
          else triggerRefs.current.delete(slug);
        }}
      />

      {openItem ? <ProjectModal item={openItem} onClose={close} /> : null}
    </>
  );
}

/**
 * The exported island. Wraps the `useSearchParams()`-using inner island in a
 * `<Suspense>` boundary (Next 16 `missing-suspense-with-csr-bailout` requirement) so
 * `/[username]` stays statically prerenderable (● SSG/ISR — D-22). The fallback
 * renders the SAME card grid (so the cards are present in the prerendered static
 * shell and during hydration); React swaps in the fully-interactive inner island
 * once `useSearchParams()` resolves on the client.
 */
export function ProjectsWithModal({ items }: ProjectsWithModalProps) {
  return (
    <Suspense fallback={<ProjectCardGrid items={items} onOpen={() => {}} />}>
      <ProjectsWithModalInner items={items} />
    </Suspense>
  );
}
