'use client';

/**
 * PostEditor (13.2-06 / D-19 / D-20) — the CMS Markdown post editor: meta fields +
 * a monospace Markdown textarea + a Write/Preview tab toggle, with auto-saved
 * drafts, an explicit Publish/Unpublish control, and upload-and-insert images.
 *
 * D-19 (swappable input): the body is a plain monospace `<textarea>` deliberately
 * structured so a richer editor can replace it later WITHOUT touching the save path
 * — the editor only ever feeds `{ title, slug, body_md, excerpt, display_date,
 * tags }` to the auto-save hook. The textarea ref + cursor-insert are the only
 * coupling, and they are local to the Write tab.
 *
 * D-20 "preview is truth": the Preview tab calls `renderPostPreviewAction`
 * (`{ body_md }`) and displays the SERVER-rendered, already-sanitized HTML string —
 * NEVER a client-side Markdown render. The author sees byte-for-byte what publishes.
 * The injected string is produced entirely server-side from the SAME `renderMarkdown`
 * pipeline (skipHtml + urlTransform drop rules already applied) — see
 * `render-post-preview-action.ts`; the editor injects it through ONE sanctioned
 * container that renders this server-produced output (not a dSIH of raw user input).
 *
 * D-20 auto-save vs publish (LOAD-BEARING): body/meta edits go through the
 * debounced `useDebouncedPostSave.scheduleSave` → `savePostAction` (content only,
 * never the `published` flag). Publish/Unpublish is a SEPARATE explicit button →
 * `useDebouncedPostSave.setPublished` → `publishPostAction`. An auto-save can never
 * push a draft live (draft-by-default, D-02).
 *
 * D-20 upload-and-insert: reuses `ImageUploader` (a FIELD CONTROL emitting a URL +
 * required alt). On a successful upload it inserts `![alt](url)` at the textarea
 * cursor with the uploaded own-storage URL + alt. WR-01: the inserted URL is
 * persisted only when the body auto-saves; the 13.2-04 delete cleanup frees
 * genuinely-dropped own-storage images. The own-storage origin is satisfied by
 * construction (the URL comes from `/api/media/upload`).
 *
 * BUNDLE RULE (CLAUDE.md / D-25 — LOAD-BEARING): this `'use client'` island MUST
 * NOT import the Markdown render library, the validations barrel, or the template
 * registry module — the preview is server-side and the auto-save probe is Zod-free.
 * `check:bundle` + the isolation greps catch a leak.
 *
 * Two-layer identity (SHARED-E): Evergreen & Copper PLATFORM-CHROME tokens ONLY —
 * zero inline hex, zero reach into any portfolio-template theme.
 *
 * Source: the form-island-calls-server-action flow from `section-form.tsx`; the
 * upload-and-insert FIELD CONTROL from `image-uploader.tsx:125-142`; the auto-save
 * hook from `use-debounced-post-save.ts`; the preview action from
 * `render-post-preview-action.ts`.
 */
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPostForEditAction } from '@/lib/cms/get-post-for-edit-action';
import { renderPostPreviewAction } from '@/lib/cms/render-post-preview-action';
import { cmsKeys } from '@/lib/query/cms-keys';
import { useUIStore } from '@/lib/stores/uiStore';

import { ImageUploader } from './image-uploader';
import { SaveStatus } from './save-status';
import { useGuardedNavigate, useRegisterActiveSave } from './unsaved-guard';
import { useDebouncedPostSave } from './use-debounced-post-save';

/** Zod `.max(...)` bounds, hand-mirrored from posts.ts (no validations-barrel import). */
const TITLE_MAX = 150;
const SLUG_MAX = 80;
const EXCERPT_MAX = 500;
const DATE_MAX = 40;
const TAGS_MAX = 6;

const PREVIEW_FAILED = 'Couldn’t render the preview. Please try again.';
const LOAD_FAILED = 'We couldn’t load this post. Please try again.';

/** The initial post the editor opens with (the META fields + body, from the list/row). */
export interface PostEditorInitial {
  /** Present ⇒ editing an existing post; absent ⇒ a brand-new unsaved post. */
  id?: string;
  title?: string;
  slug?: string;
  body_md?: string;
  excerpt?: string;
  display_date?: string;
  tags?: string[];
  published?: boolean;
}

export interface PostEditorProps {
  /** The owner's portfolio id (scopes a CREATE). */
  portfolioId: string;
  /** The owner's username (drives the action revalidate — never the request host). */
  username: string;
  /** The post being edited (a fresh `{}` for "+ New post"). */
  initial: PostEditorInitial;
  /** Back to the posts list (the panel's master-detail control). */
  onBack: () => void;
  /** Fired after a CREATE persists, so the panel can refresh its list. */
  onSaved?: (id: string) => void;
}

/**
 * Slugify a title into the strict `postContentSchema` charset (lowercase / digits /
 * single-hyphen-separated) WITHOUT importing the schema (D-25). A Zod-free mirror of
 * the regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` — the server re-validates it.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
}

/** Parse a comma-separated tag string into ≤6 trimmed non-empty tags. */
function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, TAGS_MAX);
}

type Tab = 'write' | 'preview';

export function PostEditor({
  portfolioId,
  username,
  initial,
  onBack,
  onSaved,
}: PostEditorProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  // Editing identity — a CREATE promotes to an UPDATE on the returned id (the hook
  // calls onSaved with it). `postId` is local so the next save targets the new row.
  const [postId, setPostId] = useState<string | undefined>(initial.id);
  const [published, setPublishedState] = useState<boolean>(initial.published ?? false);

  // Controlled meta + body fields.
  const [title, setTitle] = useState(initial.title ?? '');
  const [slug, setSlug] = useState(initial.slug ?? '');
  // Whether the user has hand-edited the slug — once they have, stop auto-deriving.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [body, setBody] = useState(initial.body_md ?? '');
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? '');
  const [displayDate, setDisplayDate] = useState(initial.display_date ?? '');
  const [tagsRaw, setTagsRaw] = useState((initial.tags ?? []).join(', '));

  // ── BLOG-01 / D-01/D-02/D-03: lazily fetch the full post on OPEN to hydrate the
  //    body the LIST read omits. A brand-new post (no initial.id) skips the query and
  //    is immediately editable. The editor is keyed on the post id by blog-panel, so
  //    this query resolves once per open into a fresh instance — we still guard with a
  //    `hydratedRef` so a later background refetch can never clobber the user's typed
  //    edits (Pitfall 4: hydrate via state, never a remount/re-key). ──
  const isExisting = Boolean(initial.id);
  const {
    data: loadedPost,
    isLoading: postLoading,
    isError: postLoadError,
    refetch: refetchPost,
  } = useQuery({
    queryKey: [...cmsKeys.all, 'post', initial.id] as const,
    queryFn: () => getPostForEditAction(initial.id!),
    enabled: isExisting,
    staleTime: 30_000,
  });

  // D-03: a resolved-but-null fetch for an existing id (RLS 0-row / deleted) is a load
  // FAILURE too — never present an empty editable body a save could overwrite.
  const loadFailed = isExisting && (postLoadError || (!postLoading && loadedPost === null));
  // D-02: the body + meta inputs stay DISABLED while the open-time fetch is in flight
  // OR the fetch failed (editing blocked until a successful hydrate).
  const inputsDisabled = isExisting && (postLoading || Boolean(loadFailed));

  // Hydrate the controlled fields from the fetched row ONCE (guarded), so the editor
  // shows the saved body/excerpt/tags/date — not the body-less list `initial`.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!loadedPost || hydratedRef.current) return;
    hydratedRef.current = true;
    setTitle(loadedPost.title ?? '');
    setSlug(loadedPost.slug ?? '');
    setSlugTouched(Boolean(loadedPost.slug));
    setBody(loadedPost.body_md ?? '');
    setExcerpt(loadedPost.excerpt ?? '');
    setDisplayDate(loadedPost.display_date ?? '');
    setTagsRaw((loadedPost.tags ?? []).join(', '));
    setPublishedState(loadedPost.published ?? false);
  }, [loadedPost]);

  const [tab, setTab] = useState<Tab>('write');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Upload-and-insert scratch state for the ImageUploader FIELD CONTROL (it emits a
  // URL + alt; we insert `![alt](url)` then clear so it is reusable for the next image).
  const [pendingImageUrl, setPendingImageUrl] = useState('');
  const [pendingImageAlt, setPendingImageAlt] = useState('');

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const slugId = useId();
  const bodyId = useId();
  const excerptId = useId();
  const dateId = useId();
  const tagsId = useId();

  // BLOG-03 / D-09: the last time a content save resolved ok — drives the SaveStatus
  // "Saved · HH:MM" stamp (set only on a real `{ ok: true }`, never on a skip/error).
  const [savedAt, setSavedAt] = useState<Date | undefined>(undefined);

  // The auto-save hook (debounced content saves + separate immediate publish, D-20).
  const { state, scheduleSave, immediateSave, setPublished } = useDebouncedPostSave({
    postId,
    portfolioId,
    username,
    onSaved: (id) => {
      // Promote a CREATE → UPDATE so subsequent saves target the new row, and let
      // the panel refresh its list to surface the new post + status dot.
      setPostId((prev) => prev ?? id);
      setSavedAt(new Date()); // D-09: stamp the resting "Saved · HH:MM" line.
      onSaved?.(id);
    },
  });

  // Mirror the save lifecycle into the Zustand dirty flag (arms the CMS-07 guard):
  // 'pending'/'saving' is dirty, anything else is clean. Content saves are
  // non-optimistic, so dirty clears only once the latest flush resolves.
  useEffect(() => {
    setDirty(state === 'pending' || state === 'saving');
  }, [state, setDirty]);

  /** Build the WHOLE post content payload for the auto-save hook (the swappable seam). */
  const buildContent = useCallback(() => {
    const effectiveSlug = slugTouched ? slug : slugify(title);
    return {
      title,
      slug: effectiveSlug,
      body_md: body,
      excerpt: excerpt.trim() ? excerpt : undefined,
      display_date: displayDate.trim() ? displayDate : undefined,
      tags: parseTags(tagsRaw),
    };
  }, [title, slug, slugTouched, body, excerpt, displayDate, tagsRaw]);

  /** Schedule a debounced content save after any field/body edit. */
  const queueSave = useCallback(() => {
    scheduleSave(buildContent());
  }, [scheduleSave, buildContent]);

  // BLOG-03 / D-08: register the post's content save with the dirty guard so the
  // "Save and continue" path FLUSHES the post (not a silent discard). `immediateSave`
  // returns the full SavePostResult; adapt it to the guard's `{ ok }` contract. A skip
  // (incomplete draft) resolves `{ ok:false }` from the hook, which keeps the guard
  // dialog open — but the editor only arms the guard via the Zustand `dirty` flag while
  // a real (saveable) edit is pending/saving, so a skip can't strand the dialog.
  const guardSave = useCallback(
    async () => ({ ok: (await immediateSave(buildContent())).ok }),
    [immediateSave, buildContent],
  );
  useRegisterActiveSave(guardSave);

  // BLOG-03 / D-08: route the "← Posts" back control through the shared dirty guard so
  // a navigate-away with unsaved edits prompts the "You have unsaved changes" dialog
  // (the beforeunload leg is already armed by the mounted guard via the `dirty` flag).
  const guardedNavigate = useGuardedNavigate();
  const handleBack = useCallback(() => guardedNavigate(onBack), [guardedNavigate, onBack]);

  // Title change → derive the slug (until the user hand-edits it) + queue a save.
  function onTitleChange(next: string) {
    setTitle(next);
    if (!slugTouched) setSlug(slugify(next));
    queueSave();
  }

  /** Insert `![alt](url)` at the textarea cursor (D-20 upload-and-insert). */
  const insertImageMarkdown = useCallback(
    (url: string, alt: string) => {
      const md = `![${alt}](${url})`;
      const el = bodyRef.current;
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? body.length;
      const next = body.slice(0, start) + md + body.slice(end);
      setBody(next);
      scheduleSave({ ...buildContent(), body_md: next });
      // Restore focus + place the cursor just after the inserted markup.
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = start + md.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [body, scheduleSave, buildContent],
  );

  // When the ImageUploader reports a successful upload (a non-empty URL + its
  // required alt), insert it and reset the control so it is reusable for the next.
  function handleImageUploaded(url: string) {
    if (!url) return;
    insertImageMarkdown(url, pendingImageAlt.trim() || 'image');
    setPendingImageUrl('');
    setPendingImageAlt('');
  }

  /**
   * Render the Preview tab via the SERVER pipeline (D-20 — never a client render).
   * D-05 unsaved-draft / D-07 published-prose parity: sends the LIVE `body` (the
   * in-flight unsaved draft, not the last-saved row) to renderPostPreviewAction,
   * which now returns context-free sanitized HTML carrying the published prose class
   * names — rendered below in the `prose max-w-none` container. // BLOG-02 / D-04
   */
  const runPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await renderPostPreviewAction({ body_md: body });
      if (result.ok) {
        setPreviewHtml(result.html);
      } else {
        setPreviewError(result.error ?? PREVIEW_FAILED);
      }
    } catch {
      setPreviewError(PREVIEW_FAILED);
    } finally {
      setPreviewLoading(false);
    }
  }, [body]);

  // Switch to Preview → run the server render against the live body.
  function showPreview() {
    setTab('preview');
    void runPreview();
  }

  /** Publish/Unpublish — the SEPARATE explicit lifecycle control (D-20). */
  async function togglePublished() {
    if (!postId) {
      setPublishError('Save your post before publishing.');
      return;
    }
    setPublishing(true);
    setPublishError(null);
    const next = !published;
    const effectiveSlug = slugTouched ? slug : slugify(title);
    const result = await setPublished(effectiveSlug, next);
    if (result.ok) {
      setPublishedState(next);
    } else {
      setPublishError(result.error ?? 'Something went wrong updating your post.');
    }
    setPublishing(false);
  }

  /** Retry a failed content save (D-09) — re-dispatch the current draft immediately. */
  const retrySave = useCallback(() => {
    void immediateSave(buildContent());
  }, [immediateSave, buildContent]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header: back + the auto-save status + the SEPARATE publish control. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface py-3">
        <button
          type="button"
          onClick={handleBack}
          className={
            'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold ' +
            'text-foreground outline-none transition-colors hover:text-accent ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
            'motion-reduce:transition-none'
          }
        >
          ← Posts
        </button>

        {/* BLOG-03 / D-09: the UNIFIED save-status vocabulary (Saving… / Saved · HH:MM /
            Unsaved changes), identical to the section managers. The `error` state is
            surfaced separately below as an inline Alert + Retry (SaveStatus renders null
            for error by contract). */}
        <SaveStatus state={state} savedAt={savedAt} />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[13px] font-semibold leading-tight text-muted-foreground">
            {published ? '● Published' : '○ Draft'}
          </span>
          <Button
            type="button"
            variant={published ? 'ghost' : 'primary'}
            onClick={togglePublished}
            loading={publishing}
            disabled={!postId}
            className="w-auto"
          >
            {published ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>

      {publishError ? <Alert variant="error">{publishError}</Alert> : null}

      {/* BLOG-03 / D-09: a content-save FAILURE is surfaced as an inline error + Retry
          (SaveStatus renders null for `error` by contract) — the save is never silently
          lost; Retry re-dispatches the current draft immediately. */}
      {state === 'error' ? (
        <Alert variant="error">
          <span className="flex flex-wrap items-center gap-3">
            <span>Couldn’t save your changes.</span>
            <Button type="button" variant="ghost" onClick={retrySave} className="w-auto">
              Retry
            </Button>
          </span>
        </Alert>
      ) : null}

      {/* BLOG-01 / D-03: a failed open-time fetch shows an inline error + Retry and
          keeps editing BLOCKED (the inputs below stay disabled) — never a blank,
          overwritable body. */}
      {loadFailed ? (
        <Alert variant="error">
          <span className="flex flex-wrap items-center gap-3">
            <span>{LOAD_FAILED}</span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                hydratedRef.current = false; // allow the next successful fetch to hydrate
                void refetchPost();
              }}
              className="w-auto"
            >
              Retry
            </Button>
          </span>
        </Alert>
      ) : null}

      {/* Meta fields. D-02: disabled while the open-time fetch is in flight / failed. */}
      <Input
        id={titleId}
        label="Title"
        value={title}
        maxLength={TITLE_MAX}
        disabled={inputsDisabled}
        onChange={(e) => onTitleChange(e.target.value)}
      />
      <Input
        id={slugId}
        label="URL slug"
        value={slug}
        maxLength={SLUG_MAX}
        disabled={inputsDisabled}
        helper="Auto-filled from the title. Lowercase letters, digits and hyphens."
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value);
          queueSave();
        }}
      />
      <Input
        id={dateId}
        label="Display date"
        value={displayDate}
        maxLength={DATE_MAX}
        disabled={inputsDisabled}
        helper="The date shown on the post (e.g. 2026-06-10)."
        onChange={(e) => {
          setDisplayDate(e.target.value);
          queueSave();
        }}
      />
      <Input
        id={excerptId}
        label="Excerpt (optional)"
        value={excerpt}
        maxLength={EXCERPT_MAX}
        disabled={inputsDisabled}
        helper="A short teaser shown in the blog list."
        onChange={(e) => {
          setExcerpt(e.target.value);
          queueSave();
        }}
      />
      <Input
        id={tagsId}
        label="Tags (optional)"
        value={tagsRaw}
        disabled={inputsDisabled}
        helper="Up to 6 tags, separated by commas."
        onChange={(e) => {
          setTagsRaw(e.target.value);
          queueSave();
        }}
      />

      {/* ── Write / Preview tab toggle ───────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div role="tablist" aria-label="Editor view" className="flex gap-1 border-b border-border">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'write'}
            onClick={() => setTab('write')}
            className={
              'min-h-11 rounded-t-md px-4 text-sm font-semibold outline-none transition-colors ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'motion-reduce:transition-none ' +
              (tab === 'write'
                ? 'border-b-2 border-brand text-foreground'
                : 'text-muted-foreground hover:text-accent')
            }
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={showPreview}
            className={
              'min-h-11 rounded-t-md px-4 text-sm font-semibold outline-none transition-colors ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'motion-reduce:transition-none ' +
              (tab === 'preview'
                ? 'border-b-2 border-brand text-foreground'
                : 'text-muted-foreground hover:text-accent')
            }
          >
            Preview
          </button>
        </div>

        {tab === 'write' ? (
          /* The monospace Markdown textarea — a plain native textarea (ref-able for
             cursor-insert), styled with chrome tokens. D-19: deliberately swappable
             — only this element couples to the cursor; the save path is field-only. */
          <div role="tabpanel" className="flex flex-col gap-3">
            <label htmlFor={bodyId} className="sr-only">
              Post body (Markdown)
            </label>
            {/* D-02: while the open-time fetch is in flight, show a skeleton in the body
                area and DISABLE the textarea — never let the author type into a blank
                field that is about to be replaced by the fetched body. */}
            {isExisting && postLoading ? (
              <div
                aria-hidden="true"
                className="min-h-[24rem] w-full animate-pulse rounded-sm border border-border bg-surface-muted motion-reduce:animate-none"
              />
            ) : null}
            <textarea
              id={bodyId}
              ref={bodyRef}
              value={body}
              disabled={inputsDisabled}
              onChange={(e) => {
                setBody(e.target.value);
                queueSave();
              }}
              rows={18}
              spellCheck
              placeholder="Write your post in Markdown…"
              className={
                'min-h-[24rem] w-full resize-y rounded-sm border border-border bg-surface px-3 py-2 ' +
                'font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground ' +
                'outline-none transition-colors focus-visible:border-border-strong ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                'disabled:bg-surface-muted disabled:text-muted-foreground ' +
                (isExisting && postLoading ? 'hidden' : '')
              }
            />

            {/* Upload-and-insert: the ImageUploader FIELD CONTROL → ![alt](url). */}
            <div className="rounded-md border border-border bg-surface-muted p-3">
              <p className="mb-2 text-sm font-semibold text-foreground">Insert an image</p>
              <ImageUploader
                kind="project"
                label="Image"
                value={pendingImageUrl}
                onValueChange={setPendingImageUrl}
                onUploaded={handleImageUploaded}
                alt={pendingImageAlt}
                onAltChange={setPendingImageAlt}
              />
              <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
                Uploading inserts the image into your post at the cursor.
              </p>
            </div>
          </div>
        ) : (
          /* Preview tab — the SERVER-rendered, already-sanitized HTML string (D-20).
             The string is produced entirely server-side from the publish pipeline
             (skipHtml + urlTransform already applied); this is the ONE sanctioned
             container that renders that server-produced output. */
          <div role="tabpanel" className="min-h-[24rem]">
            {previewLoading ? (
              <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
                Rendering your preview…
              </p>
            ) : previewError ? (
              <Alert variant="error">{previewError}</Alert>
            ) : (
              <div
                className="prose max-w-none"
                // D-20: server-produced, already-sanitized HTML from renderPostPreviewAction
                // (skipHtml + urlTransform ran inside the pipeline) — NOT a client dSIH of raw input.
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
