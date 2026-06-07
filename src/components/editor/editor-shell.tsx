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
import { ArrowLeft, ExternalLink, Mail, X } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import { cmsKeys } from '@/lib/query/cms-keys';
import { useUIStore } from '@/lib/stores/uiStore';
import { deriveCompleteness } from '@/lib/cms/completeness';
import { clearTemplateFallbackNotice } from '@/lib/cms/clear-template-fallback-action';
import { isSupported } from '@/lib/templates/rail-grouping';
import type { OwnerPortfolioData } from '@/lib/portfolio/get-portfolio-owner';
import type { AllowedTemplate } from '@/lib/templates/available-templates';

import { CompletenessChecklist } from './completeness-checklist';
import { ItemManager, type ItemSectionType } from './item-card';
import { MoodboardManager } from './moodboard-manager';
import { ProfileForm } from './profile-form';
import { PublishToggle } from './publish-toggle';
import { SectionForm, type SimpleSectionType } from './section-form';
import { SkillsNestedManager } from './skills-nested-manager';
import { SectionList, type EditorSection } from './section-list-row';
import { StorageMeter } from './storage-meter';
import { TemplatePicker } from './template-picker';
import { UnsupportedSectionBanner } from './unsupported-section-banner';
import { UnsavedChangesGuard, useGuardedNavigate } from './unsaved-guard';

/**
 * The sentinel `activeSectionId` for the PROFILE / IDENTITY panel (WR-02). The
 * profile is not a `sections` row, so it gets its own non-UUID id; selecting the
 * "Profile" rail entry sets this, routing the panel to the ProfileForm.
 */
const PROFILE_PANEL_ID = '__profile__';

/**
 * The sentinel `activeSectionId` for the TEMPLATE picker panel (07-05). Like the
 * profile, the template gallery is not a `sections` row, so it gets its own non-UUID
 * id; selecting the "Template" rail entry sets this, routing the panel to the
 * TemplatePicker (Surface B — platform chrome).
 */
const TEMPLATE_PANEL_ID = '__template__';

/** The simple (single-form) section types handled by SectionForm. */
const SIMPLE_TYPES = new Set<string>(['hero', 'about', 'contact']);
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
 * is present for the rail title (it can exist as a legacy row) even though it is NOT
 * addable from the picker until 13.2 (D-19).
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
  // Item-based families + moodboard's gallery (items[]) are "filled" once they have
  // ≥1 item; the seeded heading-only row reads as empty (D-21 "started, not done").
  if (ITEM_TYPES.has(type) || type === 'moodboard') {
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
}: EditorShellProps) {
  const queryClient = useQueryClient();

  const router = useRouter();

  const activeSectionId = useUIStore((s) => s.activeSectionId);
  const setActiveSectionId = useUIStore((s) => s.setActiveSectionId);
  const dirty = useUIStore((s) => s.dirty);
  const guardedNavigate = useGuardedNavigate();

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

  return (
    <div className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
      {/* The CMS-07 dirty guard: arms beforeunload while dirty + renders the
          in-app "unsaved changes" dialog when a guarded navigation is intercepted.
          "Save and continue" runs the active panel's registered save (WR-01). */}
      <UnsavedChangesGuard
        sectionLabel={
          templateActive
            ? 'Template'
            : profileActive
              ? 'Profile'
              : activeRaw
                ? titleFor(activeRaw.type, activeRaw.content)
                : undefined
        }
      />

      {/* ── Header bar (surface, hairline) — H1 + status + Preview + Publish ── */}
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Your portfolio
        </h1>

        <div className="ml-auto flex flex-wrap items-center gap-3">
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

      {/* ── Body: rail + panel (desktop) / master-detail (tablet+mobile) ── */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* SECTION-LIST RAIL. On mobile/tablet it hides once a section is picked
            (master-detail); on desktop it is always the 288px left column. */}
        <aside
          className={
            'shrink-0 border-b border-border bg-surface-muted p-4 ' +
            'lg:w-72 lg:border-b-0 lg:border-r ' +
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
            <CompletenessChecklist items={checklistItems} />

            {/* Read-only storage usage meter (D-09) — rail bottom, with the
                checklist. Reads the protected `storage_used_bytes` (seeded from the
                RSC owner read), NEVER writes it (T-05-22). */}
            <StorageMeter ownerId={ownerId} initialUsedBytes={storageUsedBytes} />
          </div>
        </aside>

        {/* FORM PANEL. On mobile/tablet it shows only once a section is picked. */}
        <section
          className={
            'flex-1 p-4 sm:p-6 lg:p-8 ' + (activeSectionId ? 'block' : 'hidden lg:block')
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
            {templateActive ? (
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
      </div>
    </div>
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
  if (SIMPLE_TYPES.has(type)) {
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
  } else {
    // A form-LESS type (only `blog_preview` today — no editor until 13.2). It is NOT
    // addable from the picker, so this branch is only reachable for a legacy row.
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
  return (
    <div className="flex flex-col items-start gap-2 py-12">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        Pick a section to edit
      </h2>
      <p className="text-base text-muted-foreground">
        Choose a section on the left to start editing. Every change you save goes
        live on your page.
      </p>
    </div>
  );
}
