'use client';

/**
 * MessageInbox (06-UI-SPEC Surface 3, CONT-02) — the dashboard inbox island: an
 * H1 + unread count, the message list, and the mark-read / delete / reply
 * interactions. CHROME layer (Evergreen & Copper, Inter) — `globals.css @theme`
 * tokens + `lucide-react` glyphs ONLY; NO template `.tmpl-*` tokens (SHARED-E).
 *
 * SERVER-DATA RULE (CLAUDE.md non-overlap, LOAD-BEARING): the message list is
 * SERVER data — it lives in the TanStack Query cache keyed by
 * `inboxKeys.list(portfolioId)`, seeded from the RSC-loaded `initialMessages`
 * (the editor seed idiom). It is NEVER mirrored into a Zustand store; only the
 * ephemeral UI state (which row is open) is local component state.
 *
 * MUTATIONS:
 *   - Mark-read is OPTIMISTIC (mirrors `eye-toggle.tsx`, SHARED-C): `onMutate`
 *     flips `is_read` in the inbox cache INSTANTLY, `onError` rolls the flip back
 *     and surfaces a destructive Alert (optimistic UI honesty — never silently
 *     lie about read state), `onSettled` invalidates the list. A polite live
 *     region announces "Marked read."
 *   - Delete is NON-OPTIMISTIC (the inline confirm in the row gates it):
 *     `mutationFn` deletes, `onSuccess` removes the row from the cache, `onError`
 *     surfaces the Alert, `onSettled` invalidates.
 *
 * Source: the seed-from-RSC + cache-only query idiom from `editor-shell.tsx`; the
 * optimistic mutation + Alert idiom from `editor/eye-toggle.tsx`; the inbox keys
 * from `@/lib/query/inbox-keys`; the actions from `@/lib/cms/message-actions`.
 */
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import type { InboxMessage } from '@/lib/cms/inbox';
import { deleteMessage, markMessageRead } from '@/lib/cms/message-actions';
import { inboxKeys } from '@/lib/query/inbox-keys';

import { MessageRow } from './message-row';

const MARK_ERROR =
  'We couldn’t update that message — it’s been put back. Please try again.';
const DELETE_ERROR = 'We couldn’t delete that message. Please try again.';
const LOAD_ERROR = 'We couldn’t load your messages. Please try again.';

export interface MessageInboxProps {
  /** The RSC-loaded owner messages (newest-first) — seeds the TanStack cache. */
  initialMessages: InboxMessage[];
  /** The owner's portfolio id — scopes the inbox cache key. */
  portfolioId: string;
}

export function MessageInbox({ initialMessages, portfolioId }: MessageInboxProps) {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  // The inbox cache key (stable per portfolio — memoized so the seed effect below
  // does not loop, mirroring editor-shell's sectionsKey discipline).
  const listKey = useMemo(() => inboxKeys.list(portfolioId), [portfolioId]);

  // Seed the cache from the RSC-loaded rows ONCE per load (server data lives in
  // the query cache, never component state for the list itself).
  useEffect(() => {
    queryClient.setQueryData<InboxMessage[]>(listKey, initialMessages);
  }, [queryClient, listKey, initialMessages]);

  // Read the list back from the cache. CACHE-ONLY query (idiomatic v5): seeded by
  // the effect + `initialData`; mutations write straight to the cache. `skipToken`
  // declares the never-fetch query so an accidental invalidate is a no-op, not a
  // throw (mirrors editor-shell.tsx).
  const { data: messages = [], isError } = useQuery<InboxMessage[]>({
    queryKey: listKey,
    queryFn: skipToken,
    initialData: () => initialMessages,
    staleTime: Infinity,
  });

  const unreadCount = messages.filter((m) => !m.is_read).length;

  // ── Mark-read (OPTIMISTIC, mirrors eye-toggle) ──────────────────────────────
  const markMutation = useMutation({
    mutationFn: (vars: { id: string; next: boolean }) =>
      markMessageRead(vars.id, vars.next),
    onMutate: async (vars) => {
      setActionError(null);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<InboxMessage[]>(listKey);
      queryClient.setQueryData<InboxMessage[]>(listKey, (old) =>
        old?.map((m) => (m.id === vars.id ? { ...m, is_read: vars.next } : m)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back to server truth + announce (optimistic UI honesty).
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
      setActionError(MARK_ERROR);
    },
    onSuccess: (result, vars, ctx) => {
      if (!result.ok) {
        // Server-handled failure (not a throw): roll back + announce.
        if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
        setActionError(MARK_ERROR);
        return;
      }
      if (vars.next) setAnnounce('Marked read.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  // ── Delete (NON-OPTIMISTIC, gated by the row's inline confirm) ──────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: (result, id) => {
      if (!result.ok) {
        setActionError(DELETE_ERROR);
        return;
      }
      setActionError(null);
      if (openId === id) setOpenId(null);
      queryClient.setQueryData<InboxMessage[]>(listKey, (old) =>
        old?.filter((m) => m.id !== id),
      );
    },
    onError: () => setActionError(DELETE_ERROR),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const busyId =
    (markMutation.isPending ? markMutation.variables?.id : undefined) ??
    (deleteMutation.isPending ? deleteMutation.variables : undefined) ??
    null;

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 lg:p-8">
      {/* Header — H1 + unread count caption (tnum) when there are unread. */}
      <header className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Messages
        </h1>
        {unreadCount > 0 ? (
          <span className="text-[13px] tabular-nums text-muted-foreground">
            {unreadCount} unread
          </span>
        ) : null}
      </header>

      {/* Live region: mark-read announces politely; action errors are role="alert". */}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {actionError ? (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      ) : null}

      {isError ? (
        <Alert variant="error">{LOAD_ERROR}</Alert>
      ) : messages.length === 0 ? (
        // Empty state — confident, never a void (inherited rule).
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Inbox aria-hidden="true" className="size-10 text-muted-foreground" />
          <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            No messages yet
          </h2>
          <p className="max-w-md text-base text-muted-foreground">
            When someone uses your contact form, their message shows up here. Share
            your portfolio link to start the conversation.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-md border border-border">
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              open={openId === m.id}
              busy={busyId === m.id}
              onToggleOpen={() => setOpenId((cur) => (cur === m.id ? null : m.id))}
              onToggleRead={(next) => markMutation.mutate({ id: m.id, next })}
              onDelete={() => deleteMutation.mutate(m.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
