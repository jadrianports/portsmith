'use client';

/**
 * TemplateGatingPanel (GATE-04, 12-05) — the /admin/templates operator island:
 * per-template visibility toggle (public ↔ restricted) + (when restricted) the
 * granted-users list with an email/username add + a per-row remove, plus the
 * impact-note confirm shown ONLY when a destructive change would orphan users.
 *
 * CHROME layer (Evergreen & Copper, Inter): Tailwind utilities → `globals.css
 * @theme` tokens + lucide glyphs ONLY; NO template `.tmpl-*` tokens (two-layer
 * isolation, SHARED-E). The copper accent (`text-accent`) is reserved for the
 * "Exclusive"/restricted marker only — never a button fill.
 *
 * SERVER-DATA RULE (CLAUDE.md non-overlap): the template+grant list is SERVER data —
 * it lives in the TanStack Query cache keyed by `adminKeys.templateGating()`, seeded
 * from the RSC-loaded `initial`. It is NEVER mirrored into a Zustand store. Ephemeral
 * UI (which confirm dialog is open, the add-input text) lives in component state.
 *
 * NON-OPTIMISTIC (mirrors `report-queue.tsx`): every mutation calls its server action,
 * surfaces a generic Alert on `{ok:false}`/error, and `onSettled` invalidates the
 * list so the panel re-reads the authoritative `getTemplateGating()` snapshot (which
 * reflects the auto-fallback's grant/visibility effects). A polite live region
 * announces grant/revoke/visibility outcomes.
 *
 * IMPACT-NOTE CONFIRM (D-P12-11): before a flip→restricted OR a revoke, the panel
 * reads `templateImpactCount(slug)`; a count of 0 proceeds WITHOUT a confirm; a count
 * > 0 opens an `UnpublishConfirmDialog`-shaped alertdialog (the focus-trap shape from
 * `publish-toggle.tsx:278` reused verbatim) whose body is the impact count, proceeding
 * only on confirm.
 *
 * Source: the seed-from-RSC + cache-only query + non-optimistic mutation idiom from
 * `report-queue.tsx:85-125`; the focus-trapped alertdialog from `publish-toggle.tsx`;
 * the actions from `@/lib/admin/template-gating-actions`; the keys from
 * `@/lib/query/admin-keys`; the read shape from `@/lib/admin/template-gating`.
 */
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Gem, Globe, Lock, Plus, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { TemplateGating } from '@/lib/admin/template-gating';
import {
  grantTemplate,
  lookupUser,
  revokeGrant,
  revokeImpactCount,
  setTemplateVisibility,
  templateImpactCount,
} from '@/lib/admin/template-gating-actions';
import { adminKeys } from '@/lib/query/admin-keys';

const ACTION_ERROR = 'We couldn’t apply that change. Please try again.';
const NO_ACCOUNT = 'No account found for that email or username.';

export interface TemplateGatingPanelProps {
  /** The RSC-loaded templates + their grants — seeds the TanStack cache. */
  initial: TemplateGating[];
}

/** A pending destructive change awaiting the impact-note confirm. */
type PendingConfirm =
  | { kind: 'restrict'; slug: string; name: string; count: number }
  | {
      kind: 'revoke';
      slug: string;
      name: string;
      userId: string;
      grantee: string;
      count: number;
    };

export function TemplateGatingPanel({ initial }: TemplateGatingPanelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const listKey = useMemo(() => adminKeys.templateGating(), []);

  // Seed the cache from the RSC-loaded rows once per load (server data lives in
  // the query cache, never component state for the list itself).
  useEffect(() => {
    queryClient.setQueryData<TemplateGating[]>(listKey, initial);
  }, [queryClient, listKey, initial]);

  const { data: templates = [] } = useQuery<TemplateGating[]>({
    queryKey: listKey,
    queryFn: skipToken,
    initialData: () => initial,
    staleTime: Infinity,
  });

  // Re-read the authoritative getTemplateGating() snapshot after every mutation.
  // The list query is cache-only (queryFn: skipToken), so invalidateQueries alone
  // can't refetch — router.refresh() re-runs the force-dynamic RSC, which re-reads
  // getTemplateGating() and re-seeds `initial` (the useEffect below propagates it
  // into the cache). This is what reflects a grant/revoke and the auto-fallback's
  // server-side grant/visibility ripple in the panel without a manual reload.
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: listKey });
    router.refresh();
  }, [queryClient, listKey, router]);

  // ── Visibility flip (NON-optimistic) ────────────────────────────────────────
  const visibilityMutation = useMutation({
    mutationFn: (vars: { slug: string; visibility: 'public' | 'restricted' }) =>
      setTemplateVisibility(vars.slug, vars.visibility),
    onSuccess: (result, vars) => {
      if (!result.ok) {
        setActionError(ACTION_ERROR);
        return;
      }
      setActionError(null);
      setAnnounce(
        vars.visibility === 'restricted'
          ? 'Template set to restricted.'
          : 'Template set to public.',
      );
    },
    onError: () => setActionError(ACTION_ERROR),
    onSettled: invalidate,
  });

  // ── Revoke a grant (NON-optimistic) ─────────────────────────────────────────
  const revokeMutation = useMutation({
    mutationFn: (vars: { slug: string; userId: string }) =>
      revokeGrant(vars.slug, vars.userId),
    onSuccess: (result) => {
      if (!result.ok) {
        setActionError(ACTION_ERROR);
        return;
      }
      setActionError(null);
      setAnnounce('Grant removed.');
    },
    onError: () => setActionError(ACTION_ERROR),
    onSettled: invalidate,
  });

  // ── Grant a template (NON-optimistic; the add control resolves the user first) ─
  const grantMutation = useMutation({
    mutationFn: (vars: { slug: string; userId: string }) =>
      grantTemplate(vars.slug, vars.userId),
    onSuccess: (result) => {
      if (!result.ok) {
        setActionError(ACTION_ERROR);
        return;
      }
      setActionError(null);
      setAnnounce('Template granted.');
    },
    onError: () => setActionError(ACTION_ERROR),
    onSettled: invalidate,
  });

  /**
   * A flip→restricted is gated by the impact count: count 0 proceeds silently,
   * count > 0 opens the confirm (D-P12-11). flip→public is never gated.
   */
  async function handleVisibilityToggle(t: TemplateGating) {
    if (t.visibility === 'restricted') {
      // restricted → public: never orphans anyone, no confirm.
      visibilityMutation.mutate({ slug: t.slug, visibility: 'public' });
      return;
    }
    // public → restricted: check the impact first.
    setActionError(null);
    const impact = await templateImpactCount(t.slug);
    if (!impact.ok) {
      setActionError(ACTION_ERROR);
      return;
    }
    if (impact.count === 0) {
      visibilityMutation.mutate({ slug: t.slug, visibility: 'restricted' });
      return;
    }
    setPending({
      kind: 'restrict',
      slug: t.slug,
      name: t.name,
      count: impact.count,
    });
  }

  /**
   * A revoke is gated by the impact count too — removing the last grant that keeps a
   * user on a restricted template orphans them. count 0 proceeds silently.
   */
  async function handleRevoke(t: TemplateGating, userId: string, grantee: string) {
    setActionError(null);
    // Revoke-aware impact (D-P12-11 fix): count the POST-revoke orphan set, which
    // INCLUDES this user if they're currently on the template. templateImpactCount
    // (read pre-revoke, when the target is still granted) would miss them → count 0 →
    // no confirm → silent orphan. revokeImpactCount asks "who is orphaned IF I revoke?".
    const impact = await revokeImpactCount(t.slug, userId);
    if (!impact.ok) {
      setActionError(ACTION_ERROR);
      return;
    }
    // If the template is public OR the revoke orphans no one (the user isn't on it),
    // proceed without a confirm.
    if (impact.count === 0 || t.visibility === 'public') {
      revokeMutation.mutate({ slug: t.slug, userId });
      return;
    }
    setPending({
      kind: 'revoke',
      slug: t.slug,
      name: t.name,
      userId,
      grantee,
      count: impact.count,
    });
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === 'restrict') {
      visibilityMutation.mutate({ slug: pending.slug, visibility: 'restricted' });
    } else {
      revokeMutation.mutate({ slug: pending.slug, userId: pending.userId });
    }
    setPending(null);
  }

  return (
    <>
      {/* Live region: grant/revoke/visibility outcomes announce politely. */}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {actionError ? (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      ) : null}

      <ul className="flex flex-col gap-4">
        {templates.map((t) => (
          <TemplateGatingCard
            key={t.slug}
            template={t}
            busyVisibility={
              visibilityMutation.isPending &&
              visibilityMutation.variables?.slug === t.slug
            }
            onToggleVisibility={() => handleVisibilityToggle(t)}
            onRevoke={(userId, grantee) => handleRevoke(t, userId, grantee)}
            onGrant={(userId) => grantMutation.mutate({ slug: t.slug, userId })}
            onLookupMiss={() => setActionError(null)}
          />
        ))}
      </ul>

      {pending ? (
        <ImpactConfirmDialog
          name={pending.name}
          count={pending.count}
          grantee={pending.kind === 'revoke' ? pending.grantee : null}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
        />
      ) : null}
    </>
  );
}

/** One template card: visibility toggle + (when restricted) the granted-users list. */
function TemplateGatingCard({
  template,
  busyVisibility,
  onToggleVisibility,
  onRevoke,
  onGrant,
  onLookupMiss,
}: {
  template: TemplateGating;
  busyVisibility: boolean;
  onToggleVisibility: () => void;
  onRevoke: (userId: string, grantee: string) => void;
  onGrant: (userId: string) => void;
  onLookupMiss: () => void;
}) {
  const restricted = template.visibility === 'restricted';

  return (
    <li className="list-none rounded-md border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              {template.name}
            </span>
            {restricted ? (
              // Copper "Exclusive" marker — value, not restriction (glyph + word,
              // color-independent). The reserved accent role (never a fill).
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
                <Gem aria-hidden="true" className="size-4" />
                Exclusive
              </span>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {restricted ? (
              <Lock aria-hidden="true" className="size-3.5" />
            ) : (
              <Globe aria-hidden="true" className="size-3.5" />
            )}
            {restricted ? 'Restricted — granted users only' : 'Public — anyone can use'}
          </span>
        </div>

        {/* Visibility toggle. */}
        <Button
          variant="ghost"
          loading={busyVisibility}
          disabled={busyVisibility}
          onClick={onToggleVisibility}
          className="w-auto"
        >
          {restricted ? 'Make public' : 'Make restricted'}
        </Button>
      </div>

      {/* Granted-users list — only meaningful while restricted (grants are kept on a
          public template per D-P12-15, but they are not consulted while public). */}
      {restricted ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkles aria-hidden="true" className="size-4 text-muted-foreground" />
            Granted users
            <span className="text-[13px] font-normal tabular-nums text-muted-foreground">
              ({template.grants.length})
            </span>
          </h3>

          {template.grants.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No users granted yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {template.grants.map((g) => (
                <li
                  key={g.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {g.username ?? '(unknown user)'}
                    </span>
                    {g.email ? (
                      <span className="truncate text-[13px] text-muted-foreground">
                        {g.email}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRevoke(g.userId, g.username ?? g.email ?? 'this user')}
                    aria-label={`Remove ${g.username ?? 'this user'} from ${template.name}`}
                    className={
                      'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm ' +
                      'font-semibold text-destructive outline-none transition-colors ' +
                      'hover:bg-destructive-bg focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                      'focus-visible:outline-ring motion-reduce:transition-none'
                    }
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <GrantAddControl
            templateName={template.name}
            onGrant={onGrant}
            onLookupMiss={onLookupMiss}
          />
        </div>
      ) : null}
    </li>
  );
}

/** The add control: resolve an email/username → user id, then grant. */
function GrantAddControl({
  templateName,
  onGrant,
  onLookupMiss,
}: {
  templateName: string;
  onGrant: (userId: string) => void;
  onLookupMiss: () => void;
}) {
  const [value, setValue] = useState('');
  const [resolving, setResolving] = useState(false);
  const [miss, setMiss] = useState<string | null>(null);

  async function handleAdd() {
    const needle = value.trim();
    if (needle.length === 0 || resolving) return;
    setMiss(null);
    setResolving(true);
    try {
      const result = await lookupUser(needle);
      if (!result.ok) {
        setMiss(NO_ACCOUNT);
        onLookupMiss();
        return;
      }
      onGrant(result.user.id);
      setValue('');
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 grow items-center gap-2 rounded-md border border-border bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          <UserPlus aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
            }}
            placeholder="email or username"
            aria-label={`Grant ${templateName} to an email or username`}
            className="min-h-11 grow bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </span>
        <Button
          variant="primary"
          loading={resolving}
          disabled={resolving || value.trim().length === 0}
          onClick={() => void handleAdd()}
          className="w-auto"
        >
          <Plus aria-hidden="true" className="size-4" />
          Grant
        </Button>
      </div>
      {miss ? (
        <p aria-live="polite" className="text-[13px] text-warning">
          {miss}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The impact-note confirm (D-P12-11) — the `UnpublishConfirmDialog` focus-trap shape
 * (publish-toggle.tsx:278) reused verbatim: role="alertdialog", default focus on the
 * SAFE action, Esc → cancel, focus-return on close, backdrop → cancel. Only the body
 * copy changes (the impact count). Shown ONLY when the count is > 0.
 */
function ImpactConfirmDialog({
  name,
  count,
  grantee,
  onCancel,
  onConfirm,
}: {
  name: string;
  count: number;
  grantee: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const safe = dialogRef.current?.querySelector<HTMLElement>(
      'button[data-dialog-default-focus]',
    );
    safe?.focus();
    return () => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onCancel],
  );

  const peopleWord = count === 1 ? 'person' : 'people';
  const body = grantee
    ? `Removing ${grantee} from ${name} will move ${count} ${peopleWord} now using it to the Editorial template. Their content is kept.`
    : `Making ${name} restricted will move ${count} ${peopleWord} now using it to the Editorial template. Their content is kept.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 transition-opacity duration-100 motion-reduce:transition-none"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="impact-dialog-heading"
        aria-describedby="impact-dialog-body"
        onKeyDown={onKeyDown}
        className={
          'relative z-10 w-full max-w-sm rounded-md border border-border bg-surface p-5 shadow-card ' +
          'transition-[opacity,transform] duration-150 motion-reduce:transition-none'
        }
      >
        <h2
          id="impact-dialog-heading"
          className="text-base font-semibold text-foreground"
        >
          This affects {count} {peopleWord}
        </h2>
        <p id="impact-dialog-body" className="mt-2 text-sm text-muted-foreground">
          {body}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          {/* Keep — the safe default-focus action. */}
          <Button
            data-dialog-default-focus
            variant="primary"
            onClick={onCancel}
            className="sm:w-auto"
          >
            Keep as is
          </Button>
          {/* Proceed — the destructive action. */}
          <button
            type="button"
            onClick={onConfirm}
            className={
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-destructive px-4 ' +
              'text-sm font-semibold text-destructive outline-none transition-colors ' +
              'hover:bg-destructive-bg active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto'
            }
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
