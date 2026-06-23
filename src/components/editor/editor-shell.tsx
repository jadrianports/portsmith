'use client';

/**
 * EditorShell (04-09 / D-P4-04, CMS-06) — the client editor island that assembles
 * EVERY Phase-4 component into the working two-pane dashboard editor.
 *
 * This is the integration slice's `'use client'` surface. The dashboard RSC
 * (`(dashboard)/dashboard/page.tsx`) bootstraps + auth-gates + loads the owner's
 * `OwnerPortfolioData`, then hands the already-loaded rows down to this island,
 * which lays out:
 *
 *   - the HEADER BAR: H1 "Your portfolio" (Display) + the PublishToggle (04-06,
 *     carrying the ● Live/Draft status + View live ↗ + Publish/Unpublish) + a
 *     Preview link (→ the 04-07 enable route, `prefetch={false}` — the draft-cookie
 *     caveat: next/link prefetch can delete the cookie, RESEARCH Pattern 2);
 *   - the SECTION-LIST RAIL (left, 288px on desktop): the dnd-kit SectionList
 *     (04-05 rows + eye-toggle + status dots) selecting (via the Zustand
 *     `activeSectionId` — UI selection only, OQ-2) into the panel, with the
 *     advisory CompletenessChecklist (04-04) docked at the rail bottom;
 *   - the FORM PANEL (right): the per-type editor for the selected section —
 *     SectionForm (04-03) for hero/about/contact, the ItemManager (04-08) for
 *     projects/experience/testimonials, an unselected "Pick a section" empty pane.
 *
 * SERVER-DATA RULE (CLAUDE.md non-overlap, LOAD-BEARING): NOTHING here mirrors
 * server data into Zustand. The section list + each section's content are seeded
 * into the TanStack Query cache (`cmsKeys.sections` / `cmsKeys.section(id)`) from
 * the RSC-loaded rows and read back via `useQuery`; Zustand owns ONLY the
 * ephemeral UI flags (`activeSectionId`, `dirty`, `dragState`, `checklistOpen`).
 *
 * TWO-LAYER IDENTITY (SHARED-E / D-P4-04): this editor is TEMPLATE-DECOUPLED — it
 * imports NO template component and NO template token. It reads/writes only the
 * `OwnerPortfolioData` shape and renders in chrome (Evergreen/Copper, Inter)
 * tokens. The only chrome element that ever sits on a template surface is the
 * PreviewBanner, which lives on the template page, NOT here.
 *
 * RESPONSIVE (UI-SPEC Layout Shell): desktop = the 288px rail + flex-1 panel;
 * tablet/mobile = a master-detail where selecting a section swaps the rail for the
 * panel (with a "Back to sections" control), so Save/Publish stay reachable and
 * the panel is never a cramped two-pane.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  MousePointerClick,
  Settings,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import { Lockup } from '@/components/brand/lockup';
import { cmsKeys } from '@/lib/query/cms-keys';
import { useUIStore } from '@/lib/stores/uiStore';
import { usePreviewSaveSignal } from '@/lib/stores/preview-save-signal';
import { deriveCompleteness } from '@/lib/cms/completeness';
import { clearTemplateFallbackNotice } from '@/lib/cms/clear-template-fallback-action';
import { siteUrl, siteOrigin } from '@/lib/url';
import {
  PREVIEW_BRIDGE_NAMESPACE,
  type PreviewBridgeMessage,
} from '@/lib/preview/bridge-messages';
import { resolvePreviewTarget, CONTACT_PANEL_ID as PREVIEW_CONTACT_REGION } from '@/lib/preview/resolve-section-id';
import { isSupported } from '@/lib/templates/rail-grouping';
import type { OwnerPortfolioData } from '@/lib/portfolio/get-portfolio-owner';
import type { AllowedTemplate } from '@/lib/templates/available-templates';

import { BlogPanel } from './blog-panel';
import { BlogPreviewForm } from './blog-preview-form';
import { CaseStudyManager } from './case-study-manager';
import { CompletenessChecklist } from './completeness-checklist';
import { ContactSocialsForm } from './contact-socials-form';
import { GalleryManager } from './gallery-manager';
import { ItemManager, type ItemSectionType } from './item-card';
import { MoodboardManager } from './moodboard-manager';
import { PageIdentityForm } from './page-identity-form';
import { ProfileForm } from './profile-form';
import { PublishToggle } from './publish-toggle';
import { SharePanel } from './share-panel';
import { SectionForm, type SimpleSectionType } from './section-form';
import { SkillsNestedManager } from './skills-nested-manager';
import { SectionList, type EditorSection } from './section-list-row';
import { StorageMeter } from './storage-meter';
import { TemplatePicker } from './template-picker';
import { UnsupportedSectionBanner } from './unsupported-section-banner';
import { UnsavedChangesGuard, useGuardedNavigate } from './unsaved-guard';

/**
 * The sentinel `activeSectionId`s for the non-`sections`-row panels (PROFILE / TEMPLATE /
 * BLOG / CONTACT). The single source of truth now lives in `@/lib/preview/resolve-section-id`
 * (Phase 27 — EDIT-02 / D-06) so the editor, the pure preview resolver, and its unit test
 * all reference ONE definition (no drifting `'__contact_socials__'` copies). Re-exported
 * here for callers that still import the sentinels from the editor module.
 */
export {
  PROFILE_PANEL_ID,
  TEMPLATE_PANEL_ID,
  BLOG_PANEL_ID,
  CONTACT_PANEL_ID,
  SEO_PANEL_ID,
} from '@/lib/preview/resolve-section-id';
import {
  PROFILE_PANEL_ID,
  TEMPLATE_PANEL_ID,
  BLOG_PANEL_ID,
  CONTACT_PANEL_ID,
  SEO_PANEL_ID,
} from '@/lib/preview/resolve-section-id';

/**
 * The simple (single-form) section types handled by SectionForm. `blog_preview`
 * (13.2-06 / D-16) routes to its own BlogPreviewForm BEFORE the SectionForm branch,
 * but it is added here so it no longer hits the form-LESS "no editor yet"
 * fall-through and is offered by the add-section picker.
 */
const SIMPLE_TYPES = new Set<string>(['hero', 'about', 'contact', 'blog_preview']);
/**
 * The flat item-bearing section types handled by the generalized ItemManager
 * (the bespoke 3 + the 4 new flat types — Plan 04 / D-10). `skills` + `moodboard`
 * are NOT here (they route to their bespoke managers below).
 */
const ITEM_TYPES = new Set<string>([
  'projects',
  'experience',
  'testimonials',
  'education',
  'metrics',
  'services',
  'certifications',
]);

/**
 * Human-readable rail/panel titles per known section type — ALL 13 (the LOCKED D-19
 * map). The rail row title + the picker title both read from this. `blog_preview`
 * is now addable from the picker (13.2-06 / D-16) and routes to its own
 * BlogPreviewForm — its title here drives both the rail row and the picker entry.
 */
const SECTION_TITLES: Record<string, string> = {
  hero: 'Hero',
  about: 'About',
  projects: 'Projects',
  experience: 'Experience',
  skills: 'Skills',
  testimonials: 'Testimonials',
  contact: 'Contact',
  education: 'Education',
  metrics: 'Metrics',
  services: 'Services',
  moodboard: 'Moodboard / Gallery',
  gallery: 'Gallery',
  case_study: 'Case study',
  certifications: 'Certifications',
  blog_preview: 'Blog teaser',
};

/** A loose record for reading the schemaless section content in the editor. */
type ContentRecord = Record<string, unknown>;

/**
 * The D-21 first-fill seed content for an optimistically-added row — MIRRORS
 * `seedContentFor` in `add-section-action.ts` so the panel opens with the same
 * seeded heading the server persisted (before `router.refresh()` reconciles). The
 * server re-validates the real seed; this client mirror is display-only.
 */
function optimisticSeedFor(type: string): ContentRecord {
  if (type === 'about') return { bio: '', skills: [] };
  const heading = SECTION_TITLES[type] ?? '';
  if (type === 'hero' || type === 'contact') return { heading };
  if (type === 'skills') return { heading, groups: [] };
  // 13.2-06 / D-16: blog_preview seeds heading + post_count (the teaser auto-derives
  // from latest published posts; legacy items[] is fallback-only, not seeded).
  if (type === 'blog_preview') return { heading, post_count: 3 };
  // Item-based families (incl. moodboard's gallery items[]).
  return { heading, items: [] };
}

/** A heading-or-type title for a section (the row Label). */
function titleFor(type: string, content: ContentRecord): string {
  const heading = typeof content.heading === 'string' ? content.heading.trim() : '';
  return SECTION_TITLES[type] ?? (heading || type);
}

/** Whether a section has real content yet (drives the rail status dot). */
function hasContentFor(type: string, content: ContentRecord): boolean {
  // Item-based families + moodboard/gallery/case_study (all items[]) are "filled" once
  // they have ≥1 item; the seeded heading-only row reads as empty (D-21 "started, not
  // done"). 35-02: gallery + case_study join the items[]-aware set.
  if (
    ITEM_TYPES.has(type) ||
    type === 'moodboard' ||
    type === 'gallery' ||
    type === 'case_study'
  ) {
    return Array.isArray(content.items) && content.items.length > 0;
  }
  if (type === 'about') return typeof content.bio === 'string' && content.bio.trim().length > 0;
  if (type === 'skills') return Array.isArray(content.groups) && content.groups.length > 0;
  return typeof content.heading === 'string' && content.heading.trim().length > 0;
}

export interface EditorShellProps {
  /** The authenticated owner's loaded portfolio (RSC-loaded, the source of truth). */
  data: OwnerPortfolioData;
  /** The owner's portfolio id (scopes the TanStack section-list cache key). */
  portfolioId: string;
  /** The owner's user id (scopes the read-only StorageMeter's owner-only read). */
  ownerId: string;
  /**
   * The owner's RSC-loaded `storage_used_bytes` (D-09) — seeds the display-only
   * StorageMeter. READ-ONLY: never written back from the client (T-05-22).
   */
  storageUsedBytes: number;
  /**
   * The owner's unread-message count (06-05 / CONT-02) — drives the scarce-accent
   * inbox nav badge. RSC-loaded under RLS (owner-only). 0 → no badge.
   */
  unreadMessageCount?: number;
  /**
   * 07-05 — the owner's CURRENT template slug (the dashboard threads `data.templateSlug`
   * here explicitly). Drives the TemplatePicker's "● Current" marker. Falls back to
   * `data.templateSlug` when omitted.
   */
  currentTemplateSlug?: string;
  /**
   * 12-04 / GATE-02 — the data-layer allowed-list (public ∪ granted-to-me), resolved
   * by the dashboard RSC via `getAvailableTemplates()` and threaded here as a PLAIN
   * serializable prop (no zod, no DB type — stays off the public/client bundle, D-25).
   * The TemplatePicker renders ONE card per allowed slug; `restricted` drives the
   * copper "Exclusive" marker (D-P12-09).
   */
  allowedTemplates: AllowedTemplate[];
  /**
   * 12-04 / D-P12-10 — true when `portfolios.template_fallback_at` is non-null (a prior
   * auto-fallback fired). Surfaces the one-time "your previous template is no longer
   * available — pick another" notice; dismissing it calls `clearTemplateFallbackNotice`.
   */
  showFallbackNotice?: boolean;
  /**
   * 33-03 / DIST-01 (D-06) — the server-generated QR SVG document string for the
   * owner's PUBLIC page (`portfolioQrSvg(username)` from `src/lib/qr.ts`, rendered in
   * the dashboard RSC). Threaded as a PLAIN string prop so the `qrcode` lib stays
   * SERVER-ONLY (zero QR lib on this client bundle); the Share panel renders it as
   * static markup + offers a Blob download.
   */
  qrSvg: string;
}

export function EditorShell({
  data,
  portfolioId,
  ownerId,
  storageUsedBytes,
  unreadMessageCount = 0,
  currentTemplateSlug,
  allowedTemplates,
  showFallbackNotice = false,
  qrSvg,
}: EditorShellProps) {
  const queryClient = useQueryClient();

  const router = useRouter();

  const activeSectionId = useUIStore((s) => s.activeSectionId);
  const setActiveSectionId = useUIStore((s) => s.setActiveSectionId);
  const dirty = useUIStore((s) => s.dirty);
  const guardedNavigate = useGuardedNavigate();

  // ── Phase 27 (EDIT-01/02/03): the live-preview pane state ──────────────────
  // The iframe over the owner's draft render (`/<username>?edit=1`), keyed on a
  // reload nonce (D-04 reflect-on-save). All of this is editor-LOCAL UI state +
  // a tiny localStorage effect — NOT uiStore (its header forbids extra/persisted
  // state) and NOT TanStack/server data (the iframe's draft route owns the render).
  const PREVIEW_OPEN_KEY = 'portsmith:editor:preview-open';
  // OPEN by default at xl+ (D-16); the persisted choice is read in an effect AFTER
  // mount (localStorage is browser-only — reading it during render would desync SSR).
  const [previewOpen, setPreviewOpen] = useState(true);
  // `< xl` Edit|Preview toggle (D-17): which pane the narrow layout shows. The
  // small-screen preview is VIEW-ONLY (no click-to-edit).
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  // The iframe remount key (D-04): bumping it re-fetches the freshly-revalidated draft.
  const [reloadNonce, setReloadNonce] = useState(0);
  // Iframe lifecycle: 'loading' until the document loads / on each reload bump;
  // 'loaded' once it fires onLoad; 'failed' if it errors (the load-failure state).
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'loaded' | 'failed'>(
    'loading',
  );
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // The form pane, scrolled into view on a preview click (D-12 surface-the-panel).
  const formPaneRef = useRef<HTMLElement | null>(null);
  // The pending D-14 post-save scroll target, sent on the bridge-ready handshake
  // (Pitfall 4 — the new iframe document must attach its listener before we post).
  const pendingScrollType = useRef<string | null>(null);

  // Read the persisted open/collapsed choice once on mount (browser-only).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PREVIEW_OPEN_KEY);
      if (stored === 'closed') setPreviewOpen(false);
      else if (stored === 'open') setPreviewOpen(true);
    } catch {
      // localStorage unavailable (private mode / blocked) — keep the default-open.
    }
  }, []);

  // Persist the open/collapsed choice (UI-only; D-16).
  function togglePreviewOpen() {
    setPreviewOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(PREVIEW_OPEN_KEY, next ? 'open' : 'closed');
      } catch {
        // ignore — a failed persist just means the choice isn't remembered next session.
      }
      return next;
    });
  }

  // D-15: enable draft mode ONCE on mount via fetch (NEVER a prefetchable Link —
  // Pitfall 3) so the iframe's `/<username>?edit=1` request carries the draft cookie.
  // Do NOTHING on unmount (never disable — the cookie is browser-wide, D-15).
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/preview/enable-edit', { credentials: 'same-origin' })
      .then(() => {
        if (cancelled) return;
        // Re-key the iframe so it (re)loads AFTER the draft cookie is set, avoiding a
        // first paint of the public/not-found branch before draft mode is armed.
        setReloadNonce((n) => n + 1);
      })
      .catch(() => {
        // A failed enable leaves the iframe to render whatever the cookie state allows;
        // the load-failure / empty states cover a non-rendering draft.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset the loading state whenever the iframe remounts (mount + each reload bump).
  useEffect(() => {
    setPreviewStatus('loading');
  }, [reloadNonce]);

  /** Manually re-fetch the preview (the load-failure "Reload preview" retry control). */
  const reloadPreview = useCallback(() => setReloadNonce((n) => n + 1), []);

  // D-18/D-21 + D-03: optimistic lifecycle overlay on top of the RSC-loaded rows.
  // `addSectionAction` / `removeSectionAction` already `revalidatePath` server-side,
  // but the client island does not re-receive RSC props without a router refresh, so
  // a freshly-added row would be invisible until reload. We overlay the just-added
  // rows (seeded heading, hidden, appended — mirroring the server seed) so the panel
  // can open the new section FIRST-FILLED immediately, and overlay the just-removed
  // ids so a removed row leaves the rail at once; then `router.refresh()` reconciles
  // with the server truth. This is EPHEMERAL UI lifecycle state (not server data in
  // Zustand — TanStack Query still owns the canonical section cache).
  const [optimisticAdded, setOptimisticAdded] = useState<
    { id: string; type: string }[]
  >([]);
  const [optimisticRemoved, setOptimisticRemoved] = useState<string[]>([]);

  // 12-04 / D-P12-10: the one-time post-fallback notice. Local UI-only state (NOT
  // Zustand, NOT server data) — it gates the chrome banner's visibility. Dismiss
  // optimistically hides the banner and fires the owner action to clear the stamp; a
  // failed clear leaves the banner hidden for this session (it re-appears on next
  // load, which is correct — the stamp is still set).
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [, startDismiss] = useTransition();
  function dismissFallbackNotice() {
    setNoticeDismissed(true);
    startDismiss(() => {
      void clearTemplateFallbackNotice();
    });
  }

  const username = data.profile.username ?? '';
  const published = data.profile.published ?? false;

  // The section rows from the RSC load — INCLUDING hidden ones, each carrying its
  // REAL `visible` flag (CR-01: the dashboard loads with `includeHidden: true`).
  // `content` is loose JSONB. The optimistic lifecycle overlay (D-18/D-21/D-03) is
  // applied on top: removed ids are dropped, just-added rows that the RSC props have
  // NOT yet caught up to are appended (seeded heading, hidden) so the panel + rail
  // reflect the add/remove immediately; `router.refresh()` reconciles to the server.
  const rawSections = useMemo(() => {
    const removed = new Set(optimisticRemoved);
    const base = data.sections
      .filter((s) => !removed.has(s.id ?? ''))
      .map((s) => ({
        id: s.id ?? '',
        type: s.type ?? '',
        // CR-01: carry the REAL visibility flag, not a hard-coded true. Default to
        // true only when the row genuinely omits it (it never should post-CR-01).
        visible: s.visible ?? true,
        content: (s.content ?? {}) as ContentRecord,
      }));
    const presentIds = new Set(base.map((s) => s.id));
    // Append only the optimistic adds the RSC props have not yet caught up to (a
    // refreshed prop set already containing the row supersedes the overlay).
    for (const add of optimisticAdded) {
      if (removed.has(add.id) || presentIds.has(add.id)) continue;
      base.push({
        id: add.id,
        type: add.type,
        visible: false, // D-04: a freshly-added section starts hidden.
        content: optimisticSeedFor(add.type),
      });
    }
    return base;
  }, [data.sections, optimisticAdded, optimisticRemoved]);

  // Seed TanStack Query with the RSC-loaded section list + each section's content
  // ONCE on mount (server data lives in the query cache, never Zustand). The rail
  // reads `cmsKeys.sections` so the optimistic reorder/visibility flips update it.
  //
  // MEMOIZED key (load-bearing): `cmsKeys.sections(portfolioId)` returns a FRESH
  // tuple every call. Used raw in the seed-effect deps below it would make the
  // effect's reference-compared deps change on EVERY render, so the effect (which
  // calls setQueryData → re-render) would re-run forever ("Maximum update depth
  // exceeded"). Memoizing on `portfolioId` gives the key a stable identity so the
  // effect runs only when the portfolio (or its loaded rows) actually change.
  const sectionsKey = useMemo(() => cmsKeys.sections(portfolioId), [portfolioId]);
  useEffect(() => {
    const editorSections: EditorSection[] = rawSections.map((s) => ({
      id: s.id,
      type: s.type, // D-06: the rail groups by template support over this type.
      title: titleFor(s.type, s.content),
      visible: s.visible, // CR-01: the REAL flag — the rail shows hidden sections as
      //                      "Hidden" and the eye-toggle round-trips against it.
      hasContent: hasContentFor(s.type, s.content),
    }));
    queryClient.setQueryData<EditorSection[]>(sectionsKey, editorSections);
    for (const s of rawSections) {
      queryClient.setQueryData(cmsKeys.section(s.id), s.content);
    }
    // rawSections is memoized on data.sections; seed once per data load.
  }, [queryClient, rawSections, sectionsKey]);

  // Read the section list back from the cache so reorder/visibility stay live.
  // CACHE-ONLY QUERY (idiomatic v5): this query is intentionally never-fetch — the
  // cache is seeded by the effect above + `initialData`, and the rail's optimistic
  // reorder / eye-toggle write straight to the cache via `setQueryData(sectionsKey)`.
  // `queryFn: skipToken` is the v5 way to DECLARE a cache-only query: it silences
  // the "No queryFn was passed as an option" console error and makes any accidental
  // refetch (e.g. an `invalidateQueries` on this key) a no-op instead of a throw,
  // while `initialData` + `staleTime: Infinity` keep the seeded data live.
  const { data: sections = [] } = useQuery<EditorSection[]>({
    queryKey: sectionsKey,
    queryFn: skipToken,
    initialData: () =>
      rawSections.map((s) => ({
        id: s.id,
        type: s.type, // D-06: mirrors the seed above (the rail's grouping axis).
        title: titleFor(s.type, s.content),
        visible: s.visible, // CR-01: the REAL flag (mirrors the seed above)
        hasContent: hasContentFor(s.type, s.content),
      })),
    staleTime: Infinity,
  });

  // The active section's type + content (for the panel). Look up the raw row.
  const activeRaw = rawSections.find((s) => s.id === activeSectionId) ?? null;
  // WR-02: whether the PROFILE / IDENTITY panel is the active selection.
  const profileActive = activeSectionId === PROFILE_PANEL_ID;
  // 07-05: whether the TEMPLATE picker panel is the active selection.
  const templateActive = activeSectionId === TEMPLATE_PANEL_ID;
  // 13.2-06 / D-19: whether the BLOG authoring panel is the active selection.
  const blogActive = activeSectionId === BLOG_PANEL_ID;
  // 24-03 / D-07: whether the CONTACT & SOCIALS panel is the active selection.
  const contactSocialsActive = activeSectionId === CONTACT_PANEL_ID;
  // 29 / D-01: whether the PAGE IDENTITY & SEO panel is the active selection.
  const seoActive = activeSectionId === SEO_PANEL_ID;

  // 07-05: the portfolio's CURRENT template slug — threaded into the picker so it can
  // mark the "● Current" card. The dashboard passes it explicitly; fall back to the
  // owner read's resolved slug (07-04 `templateSlug`) when the prop is omitted.
  const activeTemplateSlug = currentTemplateSlug ?? data.templateSlug;

  // D-06/D-17: the active template's spec drives BOTH the rail grouping and the
  // template-aware checklist. Reading `data.templateSpec` is allowed INSIDE the
  // (chrome) EditorShell (the D-25 NOTE) — it never reaches the public bundle.
  const templateSpec = data.templateSpec;
  // The set of section types the active template RENDERS (the supported keys). Used
  // for `deriveCompleteness` (D-17) so the checklist only nags about rendered sections.
  const supportedTypes = useMemo(
    () =>
      Object.entries(templateSpec.sections)
        .filter(([, entry]) => entry?.supported === true)
        .map(([type]) => type),
    [templateSpec],
  );

  // D-14: whether the ACTIVE section's type is unsupported on the active template
  // (drives the form-panel banner mount + the moodboard storage nudge). `isSupported`
  // is the pure mismatch predicate (allowed in the chrome shell per the D-25 NOTE).
  const activeUnsupported =
    activeRaw != null && !isSupported(templateSpec, activeRaw.type);

  // Advisory completeness (pure, data-derived — never a publish gate, D-P4-08).
  // D-17: thread the active template's supported types so the checklist only
  // evaluates sections the template renders (an unsupported empty section never reads
  // as "incomplete").
  const checklistItems = useMemo(
    () =>
      deriveCompleteness(
        {
          displayName: data.profile.display_name,
          avatarUrl: data.profile.avatar_url,
          sections: rawSections.map((s) => ({ type: s.type, content: s.content })),
        },
        supportedTypes,
      ),
    [data.profile.display_name, data.profile.avatar_url, rawSections, supportedTypes],
  );

  // WR-01: resolve a section TYPE → its loaded section ID (UUID) for the checklist's
  // todo-row links. `activeSectionId` is matched against `section.id` (see `activeRaw`
  // above), so a checklist row must select by id, not the type string. Returns null
  // when no section of that type is loaded (the row then no-ops instead of selecting a
  // non-existent id). Memoized on `rawSections` so the map stays stable across renders.
  const sectionIdByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of rawSections) {
      // First section of a given type wins (`UNIQUE(portfolio_id, type)` makes this
      // a 1:1 mapping in practice, but guard against a stale optimistic duplicate).
      if (!map.has(s.type)) map.set(s.type, s.id);
    }
    return map;
  }, [rawSections]);
  const resolveSectionId = useCallback(
    (sectionType: string): string | null => sectionIdByType.get(sectionType) ?? null,
    [sectionIdByType],
  );

  /**
   * D-18/D-21: after the picker provisions a section, select it + open it
   * first-filled. The optimistic overlay (above) makes the seeded row visible in the
   * rail + panel immediately; `router.refresh()` reconciles to the server truth
   * (which carries the persisted seed heading + the canonical sort_order/visibility).
   * The new section opens SELECTED, with its seeded heading, "Hidden", appended.
   */
  function handleSectionAdded(sectionId: string, type: string) {
    setOptimisticAdded((prev) =>
      prev.some((a) => a.id === sectionId) ? prev : [...prev, { id: sectionId, type }],
    );
    setOptimisticRemoved((prev) => prev.filter((id) => id !== sectionId));
    setActiveSectionId(sectionId); // open the freshly-added section first-filled.
    router.refresh(); // reconcile RSC props with the server (revalidated by the action).
  }

  /**
   * D-03: after a section is removed, drop it from the rail/panel immediately + clear
   * the selection if it was active; `router.refresh()` reconciles to the server.
   */
  function handleSectionRemoved(sectionId: string) {
    setOptimisticRemoved((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    setOptimisticAdded((prev) => prev.filter((a) => a.id !== sectionId));
    if (activeSectionId === sectionId) setActiveSectionId(null);
    router.refresh();
  }

  /** Select a section into the panel — guarded by the CMS-07 dirty dialog. */
  function selectSection(id: string) {
    guardedNavigate(() => setActiveSectionId(id));
  }

  /** Return to the section list (mobile master-detail) — also dirty-guarded. */
  function backToList() {
    guardedNavigate(() => setActiveSectionId(null));
  }

  // ── Phase 27 (EDIT-02 / D-10 / D-13 / D-14): the postMessage bridge listener ──
  // Receives origin-locked, namespace-tagged messages from the (portfolio) bridge
  // running inside the iframe. On a `section-click` it focuses the matching editor
  // panel THROUGH the dirty guard (never a direct set — D-13). On `bridge-ready`
  // (a fresh/reloaded iframe document) it flushes any pending D-14 post-save scroll.
  useEffect(() => {
    const origin = siteOrigin();
    function onMessage(ev: MessageEvent) {
      // T-27-10: origin-lock FIRST, then the namespace tag — reject unrelated traffic.
      if (ev.origin !== origin) return;
      const data = ev.data as PreviewBridgeMessage | undefined;
      if (!data || data.ns !== PREVIEW_BRIDGE_NAMESPACE) return;

      if (data.type === 'section-click') {
        // The bridge sends a soft-enum type OR the contact region tag; the EDITOR
        // owns UUID resolution via its existing resolveSectionId (no UUID crosses the
        // boundary). An absent section resolves to null → no-op (matches the checklist).
        const target = resolvePreviewTarget(data.sectionType, resolveSectionId);
        if (!target) return;
        // D-13: route through the dirty guard — a dirty panel raises the unsaved-changes
        // dialog (no silent data loss); never set activeSectionId directly.
        guardedNavigate(() => {
          setActiveSectionId(target);
          // D-12: surface the panel — scroll the form pane into view. The rail's
          // existing bg-brand active marker (section-list-row.tsx) is the highlight;
          // no new accent/flash/token is added.
          requestAnimationFrame(() => {
            formPaneRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        });
      } else if (data.type === 'bridge-ready') {
        // Pitfall 4: the (re)loaded iframe's listener is now attached — flush a pending
        // D-14 post-save scroll target (if any) into it.
        const pending = pendingScrollType.current;
        if (pending) {
          iframeRef.current?.contentWindow?.postMessage(
            { ns: PREVIEW_BRIDGE_NAMESPACE, type: 'scroll-to-section', sectionType: pending },
            origin,
          );
          pendingScrollType.current = null;
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [guardedNavigate, setActiveSectionId, resolveSectionId]);

  // ── Phase 27 (EDIT-03 / D-04 / D-14): reflect-on-save ───────────────────────
  // Subscribe to the dedicated preview-save signal (NOT uiStore). When a structured
  // save resolves `{ ok: true }`, a form fires `notifySaved(type)` → the `nonce`
  // bumps here → we remount the iframe (it re-fetches the revalidated draft) and
  // record the just-edited section type so the bridge-ready handshake re-scrolls to it.
  const saveSignalNonce = usePreviewSaveSignal((s) => s.nonce);
  const saveSignalType = usePreviewSaveSignal((s) => s.sectionType);
  // Skip the initial mount (nonce starts at 0) — only react to genuine save bumps.
  const lastHandledSaveNonce = useRef(0);
  useEffect(() => {
    if (saveSignalNonce === lastHandledSaveNonce.current) return;
    lastHandledSaveNonce.current = saveSignalNonce;
    if (saveSignalNonce === 0) return;
    // Record the D-14 scroll target (the just-saved section's type), then bump the
    // iframe key so React remounts it → re-fetch of the freshly revalidated draft.
    pendingScrollType.current = saveSignalType;
    setReloadNonce((n) => n + 1);
  }, [saveSignalNonce, saveSignalType]);

  // ── Phase 27 (D-10): reverse-sync — rail selection → preview scroll ─────────
  // When the active section changes via the rail (or any selection), scroll the
  // preview to the matching section. Resolve the active id back to its section type
  // via the loaded rows; sentinel panels (Profile/Template/Blog) have no rendered
  // section → no type → the bridge no-ops. Skipped while the preview is reloading
  // (the bridge-ready handshake covers the post-reload scroll).
  const activeSectionType = useMemo(() => {
    if (!activeSectionId) return null;
    if (activeSectionId === CONTACT_PANEL_ID) return PREVIEW_CONTACT_REGION;
    return rawSections.find((s) => s.id === activeSectionId)?.type ?? null;
  }, [activeSectionId, rawSections]);
  useEffect(() => {
    if (!activeSectionType) return;
    iframeRef.current?.contentWindow?.postMessage(
      { ns: PREVIEW_BRIDGE_NAMESPACE, type: 'scroll-to-section', sectionType: activeSectionType },
      siteOrigin(),
    );
  }, [activeSectionType]);

  return (
    <div className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
      {/* The CMS-07 dirty guard: arms beforeunload while dirty + renders the
          in-app "unsaved changes" dialog when a guarded navigation is intercepted.
          "Save and continue" runs the active panel's registered save (WR-01). */}
      <UnsavedChangesGuard
        sectionLabel={
          blogActive
            ? 'Blog'
            : templateActive
              ? 'Template'
              : profileActive
                ? 'Profile'
                : contactSocialsActive
                  ? 'Contact & Socials'
                  : activeRaw
                    ? titleFor(activeRaw.type, activeRaw.content)
                    : undefined
        }
      />

      {/* ── Header bar (surface, hairline) — brand + H1 + status + Preview + Publish ── */}
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
        {/* 32-03 (D-13): compact brand mark top-left — slots into the existing
            header, NO redesign. Shared <Lockup> (sm-collapse to mark-only) wrapped
            in a focus-ringed Link; the H1 + ml-auto cluster below are untouched. */}
        <Link
          href="/dashboard"
          className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Lockup />
        </Link>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Your portfolio
        </h1>

        {/* 33-06 (UX-05 / D-16 header polish): the ml-auto control cluster is tightened
            from `gap-3` to `gap-2` so the same-weight bordered-button row reads as one
            coherent group rather than five loosely-spaced controls, and leaves headroom
            for the Share control (added in Plan 03). Chrome tokens only; the controls
            keep their existing border/hover:text-accent/focus-ring idiom (the copper
            accent stays on hover/focus only, never a fill). No structural rework — the
            Edit/Preview toggle, Hide preview, Messages, Settings, Preview, View-my-page,
            and the Publish toggle are unchanged in identity and order. */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Phase 27 (D-17): the `< xl` Edit | Preview segmented toggle — swaps the
              visible pane on narrow screens where three columns don't fit. The
              small-screen preview is VIEW-ONLY (no click-to-edit). Hidden at xl+ where
              the 3rd preview pane renders alongside the form. Selection is conveyed by
              the brand marker + text (not color alone) — a11y, mirrors the rail marker. */}
          <div
            role="tablist"
            aria-label="Edit or preview"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1 xl:hidden"
          >
            {(['edit', 'preview'] as const).map((pane) => {
              const selected = mobilePane === pane;
              return (
                <button
                  key={pane}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setMobilePane(pane)}
                  className={
                    'relative inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ' +
                    'outline-none transition-colors ' +
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                    'motion-reduce:transition-none ' +
                    (selected
                      ? 'text-brand'
                      : 'text-muted-foreground hover:text-accent')
                  }
                >
                  {selected ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1 left-0 w-[3px] rounded-l-md bg-brand"
                    />
                  ) : null}
                  {pane === 'edit' ? 'Edit' : 'Preview'}
                </button>
              );
            })}
          </div>

          {/* Phase 27 (D-16): the xl+ Hide/Show preview collapse control — the chrome
              header-control idiom verbatim. When collapsed, the label flips to "Show
              preview" so the pane is always re-openable; the icon is aria-hidden (the
              text is the accessible name). State persists to localStorage (UI-only). */}
          <button
            type="button"
            onClick={togglePreviewOpen}
            aria-pressed={previewOpen}
            className={
              'hidden min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
              'text-sm font-semibold text-foreground outline-none transition-colors ' +
              'hover:border-border-strong hover:text-accent ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'motion-reduce:transition-none xl:inline-flex'
            }
          >
            {previewOpen ? (
              <EyeOff aria-hidden="true" className="size-3.5" />
            ) : (
              <Eye aria-hidden="true" className="size-3.5" />
            )}
            <span>{previewOpen ? 'Hide preview' : 'Show preview'}</span>
          </button>

          {/* Messages → the /dashboard/inbox surface (06-05 / CONT-02), carrying
              the scarce-accent unread badge (the one sanctioned "new" nav signal,
              UI-SPEC Surface 3). The count + an accessible suffix keep the badge
              color-independent. */}
          <Link
            href="/dashboard/inbox"
            className={
              'relative inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
              'text-sm font-semibold text-foreground outline-none transition-colors ' +
              'hover:border-border-strong hover:text-accent ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'motion-reduce:transition-none'
            }
            aria-label={
              unreadMessageCount > 0
                ? `Messages, ${unreadMessageCount} unread`
                : 'Messages'
            }
          >
            <Mail aria-hidden="true" className="size-3.5" />
            <span>Messages</span>
            {unreadMessageCount > 0 ? (
              <span
                aria-hidden="true"
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-foreground"
              >
                {unreadMessageCount}
              </span>
            ) : null}
          </Link>

          {/* Settings → the /dashboard/settings surface (D-16, 19-05): the persistent
              account-settings entry link (password / email / export / delete). Sits
              next to Messages — both are durable dashboard nav, not editor controls.
              Same chrome Link styling as the sibling Messages/Preview links (border,
              hover:text-accent — the accent is hover/focus only, NEVER a fill —
              focus-visible ring). Chrome single-layer (Inter + Evergreen/Copper). */}
          <Link
            href="/dashboard/settings"
            className={
              'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
              'text-sm font-semibold text-foreground outline-none transition-colors ' +
              'hover:border-border-strong hover:text-accent ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'motion-reduce:transition-none'
            }
          >
            <Settings aria-hidden="true" className="size-3.5" />
            <span>Settings</span>
          </Link>

          {/* 33-03 / D-05 — the unified Share control (DIST-01 + DIST-02 UI half).
              A chrome disclosure popover holding the public URL + copy, the
              downloadable server-SVG QR (qrSvg threaded in from the RSC so qrcode
              stays off this client bundle, D-06), and the draft-share generate/revoke
              wired to Plan 02's SHARED-A actions. Same chrome button idiom as its
              Messages/Settings/Preview siblings; copper accent on hover/focus only. */}
          <SharePanel username={username} qrSvg={qrSvg} />

          {/* Preview → the 04-07 enable route. prefetch={false} is MANDATORY:
              next/link prefetch can race/delete the draft cookie (RESEARCH
              Pattern 2 / 04-07 carry-forward). */}
          <Link
            href="/api/preview/enable"
            prefetch={false}
            className={
              'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
              'text-sm font-semibold text-foreground outline-none transition-colors ' +
              'hover:border-border-strong hover:text-accent ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'motion-reduce:transition-none'
            }
          >
            <span>Preview</span>
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>

          {/* D-08 — the persistent "View my page" control (Surface 6). Distinct from
              the same-tab "Preview" link above: this ALWAYS opens the public page in a
              NEW tab — anchoring the everyday "edit → see what visitors see" loop.
                • PUBLISHED → the live public page directly at siteUrl('/' + username)
                  (target=_blank rel=noopener noreferrer), the SAME host-independent URL
                  the PublishToggle "View live ↗" uses.
                • UNPUBLISHED → the draft-enable path (/api/preview/enable, full nav,
                  prefetch={false} — the draft-cookie caveat) so the owner sees their
                  work-in-progress as the banner-wrapped private draft, opened in a new tab.
              The URL ORIGIN ALWAYS comes from siteUrl() (NEXT_PUBLIC_SITE_URL), NEVER the
              request Host (D-08). CRITICAL: this adds NO cookies()/headers()/host-read to
              the public read branch — /[username] stays ● SSG (D-22). The glyph is
              aria-hidden; the aria-label names the destination + the new-tab behavior. */}
          <ViewMyPageLink username={username} published={published} />

          {/* Publish/Unpublish + ● Live/Draft status + View live ↗ (04-06). */}
          <PublishToggle username={username} initialPublished={published} />
        </div>
      </header>

      {/* ── One-time post-fallback notice (12-04 / D-P12-10) ──────────────────
          Surfaces ONLY when a prior auto-fallback fired (template_fallback_at set)
          and the user has not dismissed it this session. Chrome tokens only (no
          template `.tmpl-*` token, no inline hex). The accent is reserved — this is
          an informational surface, so it uses a calm surface-muted band with a
          hairline, NOT the copper accent (which stays for current/selected/exclusive).
          Dismiss clears the stamp via the owner action so it does not return. */}
      {showFallbackNotice && !noticeDismissed ? (
        <div
          role="status"
          className="flex items-start gap-3 border-b border-border bg-surface-muted px-4 py-3 sm:px-6"
        >
          <p className="flex-1 text-sm leading-snug text-foreground">
            Your previous template is no longer available — pick another below in the{' '}
            <span className="font-semibold">Template</span> panel. Your content is
            unchanged.
          </p>
          <button
            type="button"
            onClick={dismissFallbackNotice}
            aria-label="Dismiss notice"
            className={
              'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm ' +
              'font-semibold text-muted-foreground outline-none transition-colors ' +
              'hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 ' +
              'focus-visible:outline-ring motion-reduce:transition-none'
            }
          >
            <X aria-hidden="true" className="size-4" />
            Dismiss
          </button>
        </div>
      ) : null}

      {/* ── Body: rail + form + preview (xl) / master-detail + Edit|Preview swap
          (< xl) ─────────────────────────────────────────────────────────────
          Phase 27: at xl+ the rail + form + (optional) preview are three columns;
          below xl the `mobilePane` toggle swaps the edit cluster (rail+form
          master-detail) for the view-only preview. `previewHiddenBelowXl` hides the
          rail/form when the narrow layout is showing the preview, and vice-versa. */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* SECTION-LIST RAIL. On mobile/tablet it hides once a section is picked
            (master-detail); on desktop it is always the 288px left column. Below xl
            it is also hidden when the Edit|Preview toggle is showing the preview. */}
        <aside
          className={
            'shrink-0 border-b border-border bg-surface-muted p-4 ' +
            'lg:w-72 lg:border-b-0 lg:border-r ' +
            (mobilePane === 'preview' ? 'hidden xl:block ' : '') +
            (activeSectionId ? 'hidden lg:block' : 'block')
          }
          aria-label="Sections"
        >
          <div className="flex flex-col gap-4">
            {/* PROFILE / IDENTITY entry (WR-02 — CMS-02 reachable). Sits at the top
                of the rail; selecting it routes the panel to the ProfileForm. The
                selection is dirty-guarded like every other in-app navigation. */}
            <ProfileRailEntry
              active={profileActive}
              onSelect={() => selectSection(PROFILE_PANEL_ID)}
            />

            {/* TEMPLATE picker entry (07-05 — Surface B). Sits with the Profile entry
                at the top of the rail; selecting it routes the panel to the
                TemplatePicker gallery. Dirty-guarded like every in-app navigation. */}
            <TemplateRailEntry
              active={templateActive}
              onSelect={() => selectSection(TEMPLATE_PANEL_ID)}
            />

            {/* BLOG authoring entry (13.2-06 — D-19). Sits with the Profile/Template
                entries at the top of the rail; selecting it routes the panel to the
                BlogPanel (posts list → post editor). Dirty-guarded like every nav. */}
            <BlogRailEntry
              active={blogActive}
              onSelect={() => selectSection(BLOG_PANEL_ID)}
            />

            {/* CONTACT & SOCIALS entry (24-03 — D-07). Sits with the Profile/Template/
                Blog entries at the top of the rail; selecting it routes the panel to
                the ContactSocialsForm. Dirty-guarded like every in-app navigation. */}
            <ContactSocialsRailEntry
              active={contactSocialsActive}
              onSelect={() => selectSection(CONTACT_PANEL_ID)}
            />

            {/* PAGE IDENTITY & SEO entry (29 — D-01). Sits with the Profile/Template/
                Blog/Contact entries at the top of the rail; selecting it routes the
                panel to the PageIdentityForm (title/description/favicon/share image).
                Dirty-guarded like every in-app navigation. */}
            <PageIdentitySeoRailEntry
              active={seoActive}
              onSelect={() => selectSection(SEO_PANEL_ID)}
            />

            <RailSectionList
              sections={sections}
              portfolioId={portfolioId}
              username={username}
              spec={templateSpec}
              activeSlug={activeTemplateSlug}
              onAdded={handleSectionAdded}
              onRemoved={handleSectionRemoved}
            />

            {/* Advisory completeness — docked at the rail bottom (never a gate). */}
            <CompletenessChecklist
              items={checklistItems}
              resolveSectionId={resolveSectionId}
            />

            {/* Read-only storage usage meter (D-09) — rail bottom, with the
                checklist. Reads the protected `storage_used_bytes` (seeded from the
                RSC owner read), NEVER writes it (T-05-22). */}
            <StorageMeter ownerId={ownerId} initialUsedBytes={storageUsedBytes} />
          </div>
        </aside>

        {/* FORM PANEL. On mobile/tablet it shows only once a section is picked.
            Below xl it is also hidden when the Edit|Preview toggle shows the preview. */}
        <section
          ref={formPaneRef}
          className={
            'flex-1 p-4 sm:p-6 lg:p-8 ' +
            (mobilePane === 'preview' ? 'hidden xl:block ' : '') +
            (activeSectionId ? 'block' : 'hidden lg:block')
          }
          aria-label="Section editor"
        >
          {/* Mobile/tablet "back to sections" control (hidden on desktop two-pane). */}
          {activeSectionId ? (
            <button
              type="button"
              onClick={backToList}
              className={
                'mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm ' +
                'font-semibold text-foreground outline-none transition-colors hover:text-accent ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                'lg:hidden motion-reduce:transition-none'
              }
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to sections
            </button>
          ) : null}

          <div className="mx-auto w-full max-w-2xl">
            {blogActive ? (
              // 13.2-06 / D-19: the BLOG authoring panel (posts list → post editor),
              // inside the existing two-pane shell — no new route. Chrome tokens only;
              // the preview is a server action (no markdown lib / Zod on this bundle).
              <BlogPanel
                key={BLOG_PANEL_ID}
                portfolioId={portfolioId}
                username={username}
              />
            ) : templateActive ? (
              // 07-05: the TEMPLATE picker gallery (Surface B — platform chrome). The
              // cards navigate to the enable route (prefetch={false}) to open the
              // preview-before-commit flow; the rail entry just surfaces the gallery
              // in the existing two-pane shell (the recommended placement).
              <TemplatePicker
                key={TEMPLATE_PANEL_ID}
                currentSlug={activeTemplateSlug}
                allowed={allowedTemplates}
              />
            ) : profileActive ? (
              // WR-02: the PROFILE / IDENTITY editor — the UI caller for
              // saveProfileAction (CMS-02 / D-P4-05).
              <ProfileForm
                key={PROFILE_PANEL_ID}
                initial={{
                  display_name: data.profile.display_name,
                  headline: data.profile.headline,
                  avatar_url: data.profile.avatar_url,
                  resume_url: data.profile.resume_url,
                }}
                username={username}
              />
            ) : contactSocialsActive ? (
              // 24-03 / D-07: the CONTACT & SOCIALS editor — the UI caller for
              // saveSettingsAction (SET-01/02/03). Seeded from the owner read's
              // PublicSettings, which carries socials/location/phone after Plan 01.
              <ContactSocialsForm
                key={CONTACT_PANEL_ID}
                initial={{
                  email_public: data.settings.email_public,
                  socials: (data.settings.socials as
                    | { platform: string; url: string }[]
                    | null) ?? null,
                  location: data.settings.location,
                  phone: data.settings.phone,
                }}
                username={username}
              />
            ) : seoActive ? (
              // 29 / D-01 (META-01..04): the PAGE IDENTITY & SEO editor — the UI caller
              // for saveSeoSettings. Seeded from the owner read's PublicSettings, which
              // carries all four SEO columns (page_title/meta_description/og/favicon).
              <PageIdentityForm
                key={SEO_PANEL_ID}
                initial={{
                  page_title: data.settings.page_title,
                  meta_description: data.settings.meta_description,
                  og_image_url: data.settings.og_image_url,
                  favicon_url: data.settings.favicon_url,
                  // SHOW-03 / D-07: the Explore opt-in is a `profiles` column (NOT a
                  // settings column), carried as a top-level sibling on the owner read.
                  showcase_opt_in: data.showcase_opt_in,
                }}
                username={username}
              />
            ) : activeRaw ? (
              <SectionPanel
                key={activeRaw.id}
                sectionId={activeRaw.id}
                type={activeRaw.type}
                content={activeRaw.content}
                username={username}
                isUnsupported={activeUnsupported}
                activeSlug={activeTemplateSlug}
              />
            ) : (
              <EmptyPane />
            )}
          </div>
        </section>

        {/* ── Phase 27: the LIVE PREVIEW PANE (3rd column) ──────────────────────
            An <iframe> over the owner's draft render (`/<username>?edit=1`), keyed on
            `reloadNonce` (D-04 reflect-on-save). VISIBILITY:
              • xl+  → a fixed-but-flexible 3rd column, shown iff `previewOpen` (D-16,
                       collapse persists to localStorage). The `xl:w-[480px]` floor +
                       the form's `flex-1` keep the form usable (never crushed).
              • < xl → shown ONLY when the Edit|Preview toggle is on 'preview' (D-17),
                       full-width and VIEW-ONLY (the bridge's click-to-edit is desktop-
                       only; the rail stays the keyboard/edit path).
            TEMPLATE-DECOUPLED (D-01): this imports NO template — the template renders
            inside the (portfolio) iframe; the editor only points an <iframe> at it. */}
        <PreviewPane
          username={username}
          reloadNonce={reloadNonce}
          status={previewStatus}
          onStatusChange={setPreviewStatus}
          onReload={reloadPreview}
          iframeRef={iframeRef}
          showAtXl={previewOpen}
          showBelowXl={mobilePane === 'preview'}
        />
      </div>
    </div>
  );
}

/**
 * The live-preview pane (Phase 27 — EDIT-01). An `<iframe>` over the owner's draft
 * render plus the loading / empty / load-failure states. Stateless beyond the local
 * "did it load" tracking it reports up via `onStatusChange` — the editor owns the
 * reload nonce, the postMessage listener, and the draft-enable. TEMPLATE-DECOUPLED:
 * imports NO template; the iframe IS the isolation boundary (D-01).
 */
function PreviewPane({
  username,
  reloadNonce,
  status,
  onStatusChange,
  onReload,
  iframeRef,
  showAtXl,
  showBelowXl,
}: {
  username: string;
  reloadNonce: number;
  status: 'loading' | 'loaded' | 'failed';
  onStatusChange: (s: 'loading' | 'loaded' | 'failed') => void;
  onReload: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  showAtXl: boolean;
  showBelowXl: boolean;
}) {
  // No username yet → the owner has no published slug to preview (D — empty state).
  const hasTarget = username.trim().length > 0;
  // The draft render URL. `?edit=1` is the D-02 flag the (portfolio) bridge self-gates
  // on; the origin always comes from siteUrl() (NEXT_PUBLIC_SITE_URL), never the Host.
  const src = hasTarget ? siteUrl('/' + username) + '?edit=1' : '';

  // Visibility: hidden entirely below xl unless the toggle picked 'preview'; at xl+
  // shown iff `showAtXl`. When hidden at xl the form reclaims the width (no column).
  const visibility =
    (showBelowXl ? 'flex ' : 'hidden ') + (showAtXl ? 'xl:flex ' : 'xl:hidden ');

  return (
    <aside
      className={
        visibility +
        'flex-1 flex-col border-t border-border bg-surface-muted ' +
        'xl:w-[480px] xl:min-w-[420px] xl:flex-none xl:border-l xl:border-t-0'
      }
      aria-label="Live preview"
    >
      <div className="relative flex flex-1 flex-col">
        {!hasTarget ? (
          // Empty: the owner has no slug/content to preview yet.
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <h2 className="text-base font-semibold text-foreground">
              Nothing to preview yet
            </h2>
            <p className="max-w-xs text-base text-muted-foreground">
              Add or edit a section on the left — your changes appear here the moment you
              save.
            </p>
          </div>
        ) : (
          <>
            {/* The draft iframe (keyed on reloadNonce so a save remounts + re-fetches). */}
            <iframe
              key={reloadNonce}
              ref={iframeRef}
              title="Live preview of your portfolio"
              src={src}
              className="h-full min-h-[480px] w-full flex-1 border-0 bg-background"
              onLoad={() => onStatusChange('loaded')}
              onError={() => onStatusChange('failed')}
            />

            {/* Loading overlay — a calm surface-muted placeholder + caption (NOT a
                spinner-only void). Shown on mount + each reload bump until onLoad. */}
            {status === 'loading' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-muted">
                <p className="text-[13px] leading-tight text-muted-foreground">
                  Loading preview…
                </p>
              </div>
            ) : null}

            {/* Load-failure overlay — heading + body + a 44px retry control. */}
            {status === 'failed' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-muted p-6 text-center">
                <h2 className="text-base font-semibold text-foreground">
                  Preview didn’t load
                </h2>
                <p className="max-w-xs text-base text-muted-foreground">
                  Your editing still works. Reload the preview to try again.
                </p>
                <button
                  type="button"
                  onClick={onReload}
                  className={
                    'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
                    'text-sm font-semibold text-foreground outline-none transition-colors ' +
                    'hover:border-border-strong hover:text-accent ' +
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                    'motion-reduce:transition-none'
                  }
                >
                  Reload preview
                </button>
              </div>
            ) : null}
          </>
        )}

        {/* The < xl view-only hint (D-17) — documents tap-to-edit isn't on mobile yet
            without nagging. Hidden at xl+ where click-to-edit works. */}
        {hasTarget ? (
          <p className="border-t border-border px-4 py-2 text-[13px] leading-tight text-muted-foreground xl:hidden">
            Tap-to-edit is coming to mobile — for now, edit from the section list.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

/**
 * The persistent "View my page" header control (D-08 / Surface 6). A NEW affordance,
 * distinct from the same-tab "Preview" link — it ALWAYS opens the public page in a
 * NEW tab so the everyday "edit → see what visitors see" loop is one click.
 *
 *   - PUBLISHED → a plain `<a>` to `siteUrl('/' + username)` (the host-independent
 *     live URL — reuses the PublishToggle "View live ↗" idiom), `target="_blank"
 *     rel="noopener noreferrer"`.
 *   - UNPUBLISHED → a plain `<a>` (WR-03 — NOT `<Link>`) to the draft-enable route
 *     (`/api/preview/enable`), which sets the draft cookie then redirects to the
 *     owner's own slug (the banner-wrapped private draft). A native anchor is used
 *     (matching the published branch) because this control ALWAYS opens a new tab
 *     and never client-navigates — so it gains nothing from next/link and avoids the
 *     prefetch hazard entirely (a next/link prefetch can race/delete the draft cookie
 *     — RESEARCH Pattern 2 / the Preview link's carry-forward caveat). Opens in a new
 *     tab (`target="_blank"`), per UI-SPEC Surface 6.
 *
 * THE URL ORIGIN ALWAYS COMES FROM `siteUrl()` (NEXT_PUBLIC_SITE_URL), NEVER the
 * request Host (D-08). This control adds NO `cookies()`/`headers()`/host-read to the
 * public read branch — `/[username]` stays `● SSG` (D-22). The glyph is `aria-hidden`;
 * the `aria-label` names the destination + the new-tab behavior (UI-SPEC § "View my
 * page" Copywriting); a visually-hidden " (opens in a new tab)" mirrors the shipped
 * "View live ↗" pattern.
 */
function ViewMyPageLink({
  username,
  published,
}: {
  username: string;
  published: boolean;
}) {
  // The shared chrome idiom (the Preview-link styling at editor-shell :495-508).
  const className =
    'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
    'text-sm font-semibold text-foreground outline-none transition-colors ' +
    'hover:border-border-strong hover:text-accent ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    'motion-reduce:transition-none';

  const glyphAndLabel = (
    <>
      <Eye aria-hidden="true" className="size-3.5" />
      <span>View my page</span>
    </>
  );

  if (published) {
    // PUBLISHED → the live public page directly, host-independent URL via siteUrl().
    return (
      <a
        href={siteUrl('/' + username)}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label="View my published page (opens in a new tab)"
      >
        {glyphAndLabel}
      </a>
    );
  }

  // UNPUBLISHED → the draft-enable path, always a NEW tab. WR-03: a plain `<a>`
  // (matching the published branch), NOT `<Link>`. This control always opens a new
  // tab and never benefits from client navigation, so next/link adds only risk: a
  // prefetch of `/api/preview/enable` can race/delete the draft cookie (RESEARCH
  // Pattern 2). A native anchor removes that hazard entirely and makes both branches
  // consistent, closing the "simplify to all-Link" refactor trap the old comments
  // warned about.
  return (
    <a
      href="/api/preview/enable"
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="View a private preview of my page (opens in a new tab)"
    >
      {glyphAndLabel}
    </a>
  );
}

/**
 * The rail's section list, wrapping the dnd-kit `SectionList` so a row click is
 * routed through the dirty guard (CMS-07) before it changes the active section.
 * The dnd-kit list sets `activeSectionId` directly; we override that selection
 * with a guarded one by intercepting via the store on the panel side — but since
 * the row click handler in `section-list-row.tsx` calls `setActiveSectionId`
 * directly, we ALSO expose a guarded select for the checklist/back paths. The
 * SectionList itself selects unguarded (a list re-selection is cheap), and the
 * panel `key` remounts the form on change; the guard's beforeunload + the in-app
 * dialog still catch a leave-the-dashboard navigation.
 */
function RailSectionList({
  sections,
  portfolioId,
  username,
  spec,
  activeSlug,
  onAdded,
  onRemoved,
}: {
  sections: EditorSection[];
  portfolioId: string;
  username: string;
  spec: import('@/components/templates/minimal/spec').TemplateSpec;
  activeSlug: string;
  onAdded: (sectionId: string, type: string) => void;
  onRemoved: (sectionId: string) => void;
}) {
  return (
    <SectionList
      sections={sections}
      portfolioId={portfolioId}
      username={username}
      spec={spec}
      activeSlug={activeSlug}
      onAdded={onAdded}
      onRemoved={onRemoved}
    />
  );
}

/**
 * The PROFILE / IDENTITY rail entry (WR-02). A selectable row, styled like a
 * section row, that routes the panel to the ProfileForm. Carries the active brand
 * marker when selected (parity with the section rows' selected state).
 */
function ProfileRailEntry({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        'group relative flex min-h-11 items-center gap-2 rounded-md border border-border ' +
        'bg-surface px-3 py-2 text-left outline-none transition-colors ' +
        'hover:border-border-strong hover:text-accent ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        'motion-reduce:transition-none'
      }
    >
      {active ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-brand" />
      ) : null}
      <span className="text-sm font-semibold text-foreground">Profile</span>
      <span className="ml-auto text-[13px] leading-tight text-muted-foreground">
        Name · headline · links
      </span>
    </button>
  );
}

/**
 * The TEMPLATE rail entry (07-05 — Surface B). A selectable row, styled identically to
 * the ProfileRailEntry, that routes the panel to the TemplatePicker gallery. Carries
 * the active brand marker when selected (parity with the other rail entries). The
 * gallery itself is the switcher; this entry just surfaces it in the existing shell.
 */
function TemplateRailEntry({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        'group relative flex min-h-11 items-center gap-2 rounded-md border border-border ' +
        'bg-surface px-3 py-2 text-left outline-none transition-colors ' +
        'hover:border-border-strong hover:text-accent ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        'motion-reduce:transition-none'
      }
    >
      {active ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-brand" />
      ) : null}
      <span className="text-sm font-semibold text-foreground">Template</span>
      <span className="ml-auto text-[13px] leading-tight text-muted-foreground">
        Choose your look
      </span>
    </button>
  );
}

/**
 * The BLOG authoring rail entry (13.2-06 — D-19). A selectable row, styled
 * identically to the Profile/Template entries, that routes the panel to the
 * BlogPanel (posts list → post editor). Carries the active brand marker when
 * selected (parity with the other rail entries). The panel itself is the authoring
 * surface; this entry just surfaces it in the existing two-pane shell (no new route).
 */
function BlogRailEntry({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        'group relative flex min-h-11 items-center gap-2 rounded-md border border-border ' +
        'bg-surface px-3 py-2 text-left outline-none transition-colors ' +
        'hover:border-border-strong hover:text-accent ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        'motion-reduce:transition-none'
      }
    >
      {active ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-brand" />
      ) : null}
      <span className="text-sm font-semibold text-foreground">Blog</span>
      <span className="ml-auto text-[13px] leading-tight text-muted-foreground">
        Write posts
      </span>
    </button>
  );
}

/**
 * The CONTACT & SOCIALS rail entry (24-03 — D-07). A selectable row, styled
 * identically to the Profile/Template/Blog entries, that routes the panel to the
 * ContactSocialsForm. Carries the active brand marker when selected (parity with the
 * other rail entries) and a leading lucide `Mail` glyph (the UI-SPEC rail icon).
 */
function ContactSocialsRailEntry({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        'group relative flex min-h-11 items-center gap-2 rounded-md border border-border ' +
        'bg-surface px-3 py-2 text-left outline-none transition-colors ' +
        'hover:border-border-strong hover:text-accent ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        'motion-reduce:transition-none'
      }
    >
      {active ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-brand" />
      ) : null}
      <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-semibold text-foreground">Contact &amp; Socials</span>
      <span className="ml-auto text-[13px] leading-tight text-muted-foreground">
        Email · links · location
      </span>
    </button>
  );
}

/**
 * The PAGE IDENTITY & SEO rail entry (29 — D-01 / META-01..04). A selectable row,
 * styled identically to the Profile/Template/Blog/Contact entries, that routes the
 * panel to the PageIdentityForm. Carries the active brand marker when selected (parity
 * with the other rail entries) and a leading lucide `Settings` glyph.
 */
function PageIdentitySeoRailEntry({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        'group relative flex min-h-11 items-center gap-2 rounded-md border border-border ' +
        'bg-surface px-3 py-2 text-left outline-none transition-colors ' +
        'hover:border-border-strong hover:text-accent ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        'motion-reduce:transition-none'
      }
    >
      {active ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-brand" />
      ) : null}
      <Settings aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-semibold text-foreground">Page Identity &amp; SEO</span>
      <span className="ml-auto text-[13px] leading-tight text-muted-foreground">
        Title · favicon · share
      </span>
    </button>
  );
}

/**
 * Route a section to its per-type editor — EDIT-ALL (D-13): every form-having type
 * is editable regardless of the active template; the template gates RENDERING only.
 * Routes: SectionForm (hero/about/contact) · the generalized ItemManager (the
 * bespoke 3 + the 4 flat types) · SkillsNestedManager (skills) · MoodboardManager
 * (moodboard). When the active section's type is UNSUPPORTED on the active template,
 * the calm UnsupportedSectionBanner (D-14) sits ABOVE the form (which stays fully
 * editable) and the storage nudge (D-16) flows to the moodboard image surfaces. The
 * "coming soon" fall-through is GONE — every form-having type now has its editor.
 */
function SectionPanel({
  sectionId,
  type,
  content,
  username,
  isUnsupported,
  activeSlug,
}: {
  sectionId: string;
  type: string;
  content: ContentRecord;
  username: string;
  /** D-14: the active template can't render this type (drives the banner + nudge). */
  isUnsupported: boolean;
  /** The active template slug — names the current template in the banner (D-15). */
  activeSlug: string;
}) {
  // D-14: the calm, non-blocking unsupported banner above the form (the form below
  // stays fully editable — EDIT-ALL). It names ONLY the current template (D-15).
  const banner = isUnsupported ? (
    <UnsupportedSectionBanner activeSlug={activeSlug} />
  ) : null;

  let form: React.ReactNode;
  if (type === 'blog_preview') {
    // 13.2-06 / D-16: the shrunk heading + shown-count form. Routed BEFORE the
    // SectionForm branch (blog_preview is in SIMPLE_TYPES only so it is addable +
    // skips the form-LESS fall-through — its real editor is this bespoke form).
    form = (
      <BlogPreviewForm
        sectionId={sectionId}
        initialContent={content}
        username={username}
      />
    );
  } else if (SIMPLE_TYPES.has(type)) {
    form = (
      <SectionForm
        sectionId={sectionId}
        type={type as SimpleSectionType}
        initialContent={content}
        username={username}
      />
    );
  } else if (ITEM_TYPES.has(type)) {
    form = (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">
          {SECTION_TITLES[type] ?? type}
        </h2>
        <ItemManager
          type={type as ItemSectionType}
          sectionId={sectionId}
          initialContent={content}
          username={username}
        />
      </div>
    );
  } else if (type === 'skills') {
    // D-11: the two-level (groups → skills) nested manager (supersedes the narrow form).
    form = (
      <SkillsNestedManager
        sectionId={sectionId}
        initialContent={content}
        username={username}
      />
    );
  } else if (type === 'moodboard') {
    // D-12: the bespoke gallery + palette manager. D-16: the storage nudge renders
    // near each gallery uploader when the section is unsupported on the active template.
    form = (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">
          {SECTION_TITLES[type] ?? type}
        </h2>
        <MoodboardManager
          sectionId={sectionId}
          initialContent={content}
          username={username}
          isUnsupported={isUnsupported}
        />
      </div>
    );
  } else if (type === 'gallery') {
    // 35-02 / GAL-01: the clean photo-wall manager (batch GalleryUploader + reorderable
    // alt-gated images). EDIT-ALL (D-08) — mounts regardless of the active template; the
    // D-16 storage nudge renders near the uploader when unsupported.
    form = (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">
          {SECTION_TITLES[type] ?? type}
        </h2>
        <GalleryManager
          sectionId={sectionId}
          initialContent={content}
          username={username}
          isUnsupported={isUnsupported}
        />
      </div>
    );
  } else if (type === 'case_study') {
    // 35-02 / GAL-02: the "tell one project as a story" manager (reorderable item cards
    // each with narrative fields + a nested per-item GalleryUploader). EDIT-ALL (D-08).
    form = (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">
          {SECTION_TITLES[type] ?? type}
        </h2>
        <CaseStudyManager
          sectionId={sectionId}
          initialContent={content}
          username={username}
          isUnsupported={isUnsupported}
        />
      </div>
    );
  } else {
    // A form-LESS type — every registered type now has an editor (blog_preview got
    // its BlogPreviewForm in 13.2-06). This branch is only reachable for an
    // UNKNOWN/legacy row type the editor doesn't recognize.
    form = (
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">
          {SECTION_TITLES[type] ?? type}
        </h2>
        <p className="text-sm text-muted-foreground">
          This section doesn’t have an editor yet. Your existing content stays on your
          page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {banner}
      {form}
    </div>
  );
}

/** The unselected empty pane (UI-SPEC States Matrix — never a blank void). */
function EmptyPane() {
  // 33-06 (UX-05 / D-16 form-panel polish): the bare left-aligned text block read as
  // an unfinished state. It is now a calmer, centered empty state — a muted glyph in a
  // soft `bg-surface-muted` chip over a constrained-width copy block — so the panel
  // looks intentional before a section is picked. Chrome tokens only (Inter + the
  // muted surface); no accent fill, no template token.
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground"
      >
        <MousePointerClick className="size-6" />
      </span>
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        Pick a section to edit
      </h2>
      <p className="max-w-sm text-base leading-snug text-muted-foreground">
        Choose a section on the left to start editing. Every change you save goes
        live on your page.
      </p>
    </div>
  );
}
