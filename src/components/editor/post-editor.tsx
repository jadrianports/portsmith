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
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renderPostPreviewAction } from '@/lib/cms/render-post-preview-action';
import { useUIStore } from '@/lib/stores/uiStore';

import { ImageUploader } from './image-uploader';
import { useDebouncedPostSave } from './use-debounced-post-save';

/** Zod `.max(...)` bounds, hand-mirrored from posts.ts (no validations-barrel import). */
const TITLE_MAX = 150;
const SLUG_MAX = 80;
const EXCERPT_MAX = 500;
const DATE_MAX = 40;
const TAGS_MAX = 6;

const PREVIEW_FAILED = 'Couldn’t render the preview. Please try again.';

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

  // The auto-save hook (debounced content saves + separate immediate publish, D-20).
  const { state, scheduleSave, setPublished } = useDebouncedPostSave({
    postId,
    portfolioId,
    username,
    onSaved: (id) => {
      // Promote a CREATE → UPDATE so subsequent saves target the new row, and let
      // the panel refresh its list to surface the new post + status dot.
      setPostId((prev) => prev ?? id);
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

  const saveLabel =
    state === 'saving' || state === 'pending'
      ? 'Saving…'
      : state === 'saved'
        ? 'Saved'
        : state === 'error'
          ? 'Couldn’t save'
          : '';

  return (
    <div className="flex flex-col gap-5">
      {/* Header: back + the auto-save status + the SEPARATE publish control. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface py-3">
        <button
          type="button"
          onClick={onBack}
          className={
            'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold ' +
            'text-foreground outline-none transition-colors hover:text-accent ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
            'motion-reduce:transition-none'
          }
        >
          ← Posts
        </button>

        <span
          aria-live="polite"
          className={
            'text-[13px] leading-tight ' +
            (state === 'error' ? 'text-destructive' : 'text-muted-foreground')
          }
        >
          {saveLabel}
        </span>

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

      {/* Meta fields. */}
      <Input
        id={titleId}
        label="Title"
        value={title}
        maxLength={TITLE_MAX}
        onChange={(e) => onTitleChange(e.target.value)}
      />
      <Input
        id={slugId}
        label="URL slug"
        value={slug}
        maxLength={SLUG_MAX}
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
            <textarea
              id={bodyId}
              ref={bodyRef}
              value={body}
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
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
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
