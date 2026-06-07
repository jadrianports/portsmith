'use client';
/**
 * ⌘K / Ctrl+K command palette for the edgerunner-v2 template.
 *
 * Built from scratch — NO cmdk dependency (not allowlisted; keeps bundle lean).
 *
 * DESIGN:
 *   - Dark holo-panel modal overlay (dark backdrop + neon-cyan focus, mono font).
 *   - Keyboard shortcut ⌘K (Mac) / Ctrl+K (Win) toggles open; Escape closes.
 *   - Click backdrop closes.
 *   - Arrow keys + Enter navigate + run selection.
 *   - Search input filters commands by label (case-insensitive).
 *   - Scroll-lock on body while open.
 *   - SSR-safe: renders nothing visible until open (closed by default).
 *   - Listens for window CustomEvent `'cmdk-open'` (dispatched by Navbar hint).
 *
 * NAVIGATION LOGIC (works from any page):
 *   - If item has `href` (a real route) → `router.push(href)`.
 *   - Else if item has `anchor` (#id) and we are on the homepage → smooth-scroll.
 *   - Else → navigate to `/${username}#anchor`.
 *
 * TOKENS ONLY: no hex, no chrome tokens. All styles via inline var(--token) refs
 * to the scoped .tmpl-edgerunner-v2 tokens defined in theme.css.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  User,
  Briefcase,
  FolderGit2,
  Cpu,
  Wrench,
  Mail,
  BookOpen,
  Download,
  X,
  Search,
  Globe,
} from 'lucide-react';
import { SocialIcon } from './ui/social-icon';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommandItem {
  label: string;
  /** Section anchor id (e.g. "experience") — used for scroll or /#anchor nav */
  anchor?: string;
  /** Full href to a real route (e.g. "/${username}/services") — takes priority */
  href?: string;
}

export interface CommandPaletteProps {
  username?: string | null;
  items: CommandItem[];
  resumeUrl?: string | null;
  email?: string | null;
  socials?: { label: string; href: string }[];
  /**
   * Start in the OPEN state on mount. Used by the lazy wrapper
   * (`command-palette-lazy.tsx`): when the visitor's first ⌘K loads this chunk, the
   * arming event has already been consumed, so the wrapper mounts us pre-opened
   * rather than relying on a racy re-dispatched event. Defaults to false (closed).
   */
  initialOpen?: boolean;
}

// ─── Icon map for Navigate items ─────────────────────────────────────────────

const NAV_ICONS: Record<string, React.ReactNode> = {
  home:       <Home size={16} aria-hidden="true" />,
  about:      <User size={16} aria-hidden="true" />,
  experience: <Briefcase size={16} aria-hidden="true" />,
  projects:   <FolderGit2 size={16} aria-hidden="true" />,
  stack:      <Cpu size={16} aria-hidden="true" />,
  services:   <Wrench size={16} aria-hidden="true" />,
  blog:       <BookOpen size={16} aria-hidden="true" />,
  contact:    <Mail size={16} aria-hidden="true" />,
};

function NavIcon({ label }: { label: string }) {
  const key = label.toLowerCase();
  return <>{NAV_ICONS[key] ?? <Globe size={16} aria-hidden="true" />}</>;
}

// ─── Command row ─────────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onRun: () => void;
  onHover: () => void;
}

function CommandRow({ label, icon, selected, onRun, onHover }: RowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onRun}
      onMouseEnter={onHover}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '8px 12px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        background: selected
          ? 'color-mix(in oklab, var(--neon-cyan) 12%, transparent)'
          : 'transparent',
        color: selected ? 'var(--neon-cyan)' : 'color-mix(in oklab, var(--fg) 80%, transparent)',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        textAlign: 'left',
        transition: 'background 80ms ease, color 80ms ease',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          color: selected
            ? 'var(--neon-cyan)'
            : 'color-mix(in oklab, var(--fg) 50%, transparent)',
        }}
      >
        {icon}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}

// ─── Group heading ────────────────────────────────────────────────────────────

function GroupHeading({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '6px 12px 4px',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'color-mix(in oklab, var(--neon-purple) 85%, transparent)',
      }}
    >
      {label}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette({
  username,
  items,
  resumeUrl,
  email,
  socials,
  initialOpen = false,
}: CommandPaletteProps) {
  const [open, setOpen]     = useState(initialOpen);
  const [query, setQuery]   = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const router    = useRouter();
  const pathname  = usePathname();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(0);
  }, []);

  // ── Keyboard toggle + open event ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => {
          if (v) {
            setQuery('');
            setSelected(0);
          }
          return !v;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Listen for navbar hint CustomEvent
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('cmdk-open', onOpen);
    return () => window.removeEventListener('cmdk-open', onOpen);
  }, []);

  // ── Focus input when opened ───────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      // rAF so the element is visible before we focus
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // ── Scroll-lock ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // ── Build command list ────────────────────────────────────────────────────

  const isHome = pathname !== undefined && (
    pathname === `/${username ?? ''}` ||
    pathname === `/${username ?? ''}/`
  );

  const runItem = useCallback(
    (item: CommandItem) => {
      close();
      setTimeout(() => {
        if (item.href) {
          router.push(item.href);
          return;
        }
        if (item.anchor) {
          if (isHome) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            document.getElementById(item.anchor)?.scrollIntoView({
              behavior: prefersReduced ? 'auto' : 'smooth',
              block: 'start',
            });
          } else {
            router.push(`/${username ?? ''}#${item.anchor}`);
          }
        }
      }, 50);
    },
    [close, isHome, router, username]
  );

  // Navigate group: items passed in as props
  const navGroup: Array<{ label: string; icon: React.ReactNode; run: () => void }> =
    items.map((item) => ({
      label: item.label,
      icon: <NavIcon label={item.anchor ?? item.label} />,
      run: () => runItem(item),
    }));

  // Actions group
  const actionGroup: Array<{ label: string; icon: React.ReactNode; run: () => void }> = [];
  if (resumeUrl) {
    actionGroup.push({
      label: 'Download CV',
      icon: <Download size={16} aria-hidden="true" />,
      run: () => { close(); setTimeout(() => window.open(resumeUrl, '_blank'), 50); },
    });
  }
  if (email) {
    actionGroup.push({
      label: `Email`,
      icon: <Mail size={16} aria-hidden="true" />,
      run: () => {
        close();
        setTimeout(() => { window.location.href = `mailto:${email}`; }, 50);
      },
    });
  }

  // Social group
  const socialGroup: Array<{ label: string; icon: React.ReactNode; run: () => void }> =
    (socials ?? []).map((s) => ({
      label: s.label,
      icon: <SocialIcon label={s.label} size={16} />,
      run: () => { close(); setTimeout(() => window.open(s.href, '_blank'), 50); },
    }));

  // Flatten for keyboard navigation
  interface FlatItem {
    group: string;
    label: string;
    icon: React.ReactNode;
    run: () => void;
  }

  const allGroups: { heading: string; cmds: FlatItem[] }[] = [];
  if (navGroup.length)    allGroups.push({ heading: 'Navigate', cmds: navGroup.map(c => ({ ...c, group: 'Navigate' })) });
  if (actionGroup.length) allGroups.push({ heading: 'Actions',  cmds: actionGroup.map(c => ({ ...c, group: 'Actions' })) });
  if (socialGroup.length) allGroups.push({ heading: 'Social',   cmds: socialGroup.map(c => ({ ...c, group: 'Social' })) });

  const flatFiltered: FlatItem[] = allGroups
    .flatMap((g) => g.cmds)
    .filter((c) => c.label.toLowerCase().includes(query.toLowerCase().trim()));

  // Reset selection when query changes
  useEffect(() => { setSelected(0); }, [query]);

  // ── Arrow / Enter key inside palette ─────────────────────────────────────
  const onListKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((v) => Math.min(v + 1, flatFiltered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((v) => Math.max(v - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flatFiltered[selected]?.run();
      } else if (e.key === 'Escape') {
        close();
      }
    },
    [flatFiltered, selected, close]
  );

  // Scroll selected row into view
  useEffect(() => {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    rows[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  // Groups with search filtering — rebuild filtered groups for rendering
  const filteredGroups = allGroups
    .map((g) => ({
      ...g,
      cmds: g.cmds.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase().trim())
      ),
    }))
    .filter((g) => g.cmds.length > 0);

  // Map flatFiltered items back to their index for selection tracking
  let rowIndex = 0;

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'clamp(60px, 12vh, 140px)',
        background: 'color-mix(in srgb, var(--bg) 75%, transparent)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {/* Panel */}
      <div
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
        style={{
          width: '100%',
          maxWidth: '560px',
          margin: '0 16px',
          borderRadius: '12px',
          border: '1px solid color-mix(in oklab, var(--neon-cyan) 35%, transparent)',
          background: `linear-gradient(145deg,
            color-mix(in oklab, var(--neon-purple) 10%, transparent),
            color-mix(in oklab, var(--neon-cyan) 5%, transparent)),
            var(--bg)`,
          boxShadow: `
            0 0 0 1px color-mix(in oklab, var(--neon-cyan) 20%, transparent),
            0 20px 60px -16px color-mix(in oklab, var(--neon-pink) 40%, transparent),
            0 0 80px -32px color-mix(in oklab, var(--neon-cyan) 50%, transparent)
          `,
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
        }}
      >
        {/* Search row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: '1px solid color-mix(in oklab, var(--neon-cyan) 20%, transparent)',
          }}
        >
          <Search
            size={16}
            aria-hidden="true"
            style={{ flexShrink: 0, color: 'color-mix(in oklab, var(--neon-cyan) 70%, transparent)' }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to a section…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            aria-autocomplete="list"
            aria-controls="cmdk-listbox"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              color: 'var(--fg)',
            }}
          />
          <button
            type="button"
            aria-label="Close command palette"
            onClick={close}
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              color: 'color-mix(in oklab, var(--fg) 50%, transparent)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Command list */}
        <div
          id="cmdk-listbox"
          role="listbox"
          ref={listRef}
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '8px',
            scrollbarWidth: 'thin',
            scrollbarColor: `color-mix(in oklab, var(--neon-purple) 40%, transparent) transparent`,
          }}
        >
          {filteredGroups.length === 0 && (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'color-mix(in oklab, var(--fg) 40%, transparent)',
              }}
            >
              No results found.
            </div>
          )}

          {filteredGroups.map((g) => (
            <div key={g.heading}>
              <GroupHeading label={g.heading} />
              {g.cmds.map((cmd) => {
                const idx = rowIndex++;
                return (
                  <CommandRow
                    key={`${g.heading}-${cmd.label}`}
                    label={cmd.label}
                    icon={cmd.icon}
                    selected={selected === idx}
                    onRun={cmd.run}
                    onHover={() => setSelected(idx)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            borderTop: '1px solid color-mix(in oklab, var(--neon-cyan) 15%, transparent)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'color-mix(in oklab, var(--fg) 40%, transparent)',
          }}
        >
          <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>↵</kbd> select</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
