'use client';

/**
 * BlogPanel (13.2-06 / D-19) — the Blog rail destination: a posts-list panel
 * (status dots + "+ New post") that opens the PostEditor in the SAME two-pane shell
 * (no new route). It is the lazy data lane for the owner's posts — fetched on mount
 * via TanStack Query calling the thin `listPostsAction` owner read (drafts +
 * published), so the dashboard RSC never threads posts through its initial payload.
 *
 * STATE SPLIT (CLAUDE.md non-overlap, LOAD-BEARING): TanStack Query owns the server
 * data (the post list, keyed under the `cmsKeys` factory); only EPHEMERAL UI
 * selection (which post is open, or the new-post draft) lives in local component
 * state — never mirrored server data, never Zustand. After a create/publish the
 * list is invalidated so it re-reads the owner truth.
 *
 * BUNDLE RULE (CLAUDE.md / D-25): this `'use client'` island imports NO Markdown
 * render library, NO validations barrel, NO template registry module — it lists
 * meta rows and routes to the PostEditor (whose preview is the server action).
 *
 * Two-layer identity (SHARED-E): Evergreen & Copper PLATFORM-CHROME tokens only —
 * mirrors the rail-entry styling in `editor-shell.tsx`.
 *
 * Source: the rail-entry + panel-routing idiom from `editor-shell.tsx`; the
 * TanStack list-read + `cmsKeys` factory from the editor cache discipline; the
 * owner list action from `list-posts-action.ts`.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { listPostsAction } from '@/lib/cms/list-posts-action';
import { cmsKeys } from '@/lib/query/cms-keys';
import type { OwnerPostListItem } from '@/lib/portfolio/get-posts-owner';

import { PostEditor, type PostEditorInitial } from './post-editor';

/** The post-list cache key — scoped to the owner's portfolio under the cmsKeys factory. */
function postsKey(portfolioId: string) {
  return [...cmsKeys.all, 'posts', portfolioId] as const;
}

const LIST_ERROR = 'We couldn’t load your posts. Please try again.';

export interface BlogPanelProps {
  /** The owner's portfolio id (scopes the list cache + a new post's CREATE). */
  portfolioId: string;
  /** The owner's username (drives the post actions' revalidate). */
  username: string;
}

/** Which post the panel is editing: a list selection (id), a brand-new draft, or none. */
type Selection = { mode: 'list' } | { mode: 'edit'; id: string } | { mode: 'new' };

export function BlogPanel({ portfolioId, username }: BlogPanelProps) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<Selection>({ mode: 'list' });

  const { data: posts = [], isLoading, isError } = useQuery<OwnerPostListItem[]>({
    queryKey: postsKey(portfolioId),
    queryFn: () => listPostsAction(),
    staleTime: 30_000,
  });

  /** Re-read the owner post list (after a create/publish changed it). */
  function refreshPosts() {
    void queryClient.invalidateQueries({ queryKey: postsKey(portfolioId) });
  }

  // ── Editor view (a selected post or a new draft) ───────────────────────────
  if (selection.mode === 'edit' || selection.mode === 'new') {
    const editing =
      selection.mode === 'edit' ? posts.find((p) => p.id === selection.id) : undefined;
    const initial: PostEditorInitial =
      selection.mode === 'edit' && editing
        ? {
            id: editing.id,
            title: editing.title,
            slug: editing.slug,
            display_date: editing.display_date ?? undefined,
            published: editing.published,
          }
        : {}; // a brand-new post
    return (
      <PostEditor
        // Remount per post so its field state is fresh.
        key={selection.mode === 'edit' ? selection.id : '__new__'}
        portfolioId={portfolioId}
        username={username}
        initial={initial}
        onBack={() => {
          refreshPosts();
          setSelection({ mode: 'list' });
        }}
        onSaved={(id) => {
          // Promote a new draft into an edit on the persisted id + refresh the list.
          refreshPosts();
          setSelection((prev) => (prev.mode === 'new' ? { mode: 'edit', id } : prev));
        }}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <h2 className="text-base font-semibold text-foreground">Blog</h2>
        <button
          type="button"
          onClick={() => setSelection({ mode: 'new' })}
          className={
            'ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md bg-brand px-4 ' +
            'text-sm font-semibold text-brand-foreground outline-none transition-colors ' +
            'hover:bg-brand-hover focus-visible:[box-shadow:var(--shadow-focus)] ' +
            'motion-reduce:transition-none'
          }
        >
          <Plus aria-hidden="true" className="size-4" />
          New post
        </button>
      </div>

      {isError ? <Alert variant="error">{LIST_ERROR}</Alert> : null}

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading your posts…</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-8">
          <p className="text-base font-semibold text-foreground">No posts yet</p>
          <p className="text-sm text-muted-foreground">
            Write your first post — it stays a draft until you publish it.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => setSelection({ mode: 'edit', id: post.id })}
                className={
                  'flex min-h-11 w-full items-center gap-2 rounded-md border border-border ' +
                  'bg-surface px-3 py-2 text-left outline-none transition-colors ' +
                  'hover:border-border-strong hover:text-accent ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                  'motion-reduce:transition-none'
                }
              >
                {/* Status dot — color + glyph + the suffix word keep it color-independent. */}
                <span
                  aria-hidden="true"
                  className={
                    'size-2 shrink-0 rounded-full ' +
                    (post.published ? 'bg-success' : 'bg-warning')
                  }
                />
                <span className="truncate text-sm font-semibold text-foreground">
                  {post.title || 'Untitled post'}
                </span>
                <span className="ml-auto shrink-0 text-[13px] leading-tight text-muted-foreground">
                  {post.published ? 'Published' : 'Draft'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
