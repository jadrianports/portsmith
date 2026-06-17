/**
 * The owner-only edit-preview BRIDGE logic (Phase 27 — EDIT-04 / D-02 / D-03 / D-06 /
 * D-10 / D-11 / D-14 / D-18). The real click-capture + scroll bridge that runs INSIDE
 * the live-preview `<iframe>` document. It is lazily `import()`ed by
 * `edit-preview-bridge-mount.tsx` ONLY in a browser effect, so this whole module lives
 * in its OWN async chunk and is NEVER part of the public route's shared First Load JS
 * (`rootMainFiles`) — mirroring the `beacon.tsx` discipline (D-20/D-25).
 *
 * PLAIN MODULE — NOT `'use client'`, NO React (LOAD-BEARING, EDIT-04): exactly like
 * `beacon.tsx`, this is a framework-light browser module that exports a single
 * side-effecting function — NOT a React component. A `'use client'` React-component
 * export would mark the module a client REFERENCE that Turbopack co-bundles with the
 * importing route's client graph (measured: +12 kB onto `/[username]` First Load JS),
 * defeating the lazy split. Keeping it a plain function the mount `import()`s in an
 * effect lands it in its OWN async chunk, off the route bundle (the beacon idiom).
 *
 * HARD IMPORT RULE (asserted by `preview-bridge-import-guard.test.ts`): this module
 * imports ONLY `siteOrigin` from `@/lib/url` and the plain `@/lib/preview/bridge-messages`
 * contract (pure types + one const). It must NEVER import `@/lib/validations` (the
 * validations barrel evaluates `z.enum(...)` at module scope → ~63 kB Zod) or
 * `@/components/templates/registry` (slug `z.enum`) — either would drag Zod/template code
 * onto a public bundle. No `react`, no `next/*`.
 *
 * SELF-GATE (Pitfall 1, D-08): the bridge no-ops entirely unless the iframe URL carries
 * `?edit`. The page mounts it INSIDE the draft arm unconditionally, but a plain
 * draft-preview view (no `?edit`) attaches no listeners, injects no hover affordance,
 * and posts nothing — so an always-mounted-in-draft bridge adds nothing to the
 * non-editor experience and keeps `[username]/page.tsx` byte-for-byte unchanged (no
 * server-read `searchParams` → `/[username]` stays ● SSG).
 *
 * SECURITY:
 * - SEND origin-locked (T-27-05): every `window.parent.postMessage` uses an explicit
 *   `siteOrigin()` target — NEVER `'*'`. The editor serves under the same
 *   `NEXT_PUBLIC_SITE_URL` origin as the iframe `src`, so this is a same-origin send.
 * - LISTEN origin-checked + namespaced (T-27-05): the `message` listener rejects any
 *   event whose `origin !== siteOrigin()` or whose `data.ns !== PREVIEW_BRIDGE_NAMESPACE`
 *   before acting (the `ns` tag drops unrelated extension/library `postMessage` traffic).
 * - SELECTOR-INJECTION SAFE (T-27-06): the inbound scroll target is fed through
 *   `CSS.escape(...)` before `querySelector`; a sentinel/region value matching no
 *   section simply no-ops the scroll (D-10/D-14).
 *
 * LIVE-DOM ONLY (D-18): the bridge reads only the rendered draft DOM via
 * `closest('[data-section-type], [data-preview-region]')`. Hidden sections are not
 * rendered, hence not clickable and given no edit-only render mode — so the preview
 * mirrors exactly what visitors see.
 */
import { siteOrigin } from '@/lib/url';
import { PREVIEW_BRIDGE_NAMESPACE } from '@/lib/preview/bridge-messages';

/** The footer/contact region tag (mirrors `data-preview-region="contact"`, D-06). */
const CONTACT_REGION_TAG = '__contact_socials__';

/** The id of the injected hover-affordance `<style>` (D-11), removed on teardown. */
const STYLE_ID = 'edit-preview-bridge-style';

/**
 * Wire up the click-capture + scroll bridge on the current iframe document.
 *
 * Returns a teardown that removes both listeners + the hover-affordance style — so the
 * mount (or a re-import) can clean up on unmount. No-ops (returns a no-op teardown) when
 * the URL lacks `?edit` (the self-gate) or when run outside the browser.
 */
export function startEditPreviewBridge(): () => void {
  // SELF-GATE (Pitfall 1 / D-08): outside the browser, or without `?edit`, do nothing.
  if (typeof window === 'undefined') return () => {};
  if (!new URLSearchParams(window.location.search).has('edit')) return () => {};

  const origin = siteOrigin();

  // ── (a) hover affordance (D-11) — a 2px copper outline + pointer cursor on every
  //    clickable region, injected ONLY after the self-gate passes (never for the
  //    public/non-edit draft view). The copper accent is the one sanctioned chrome
  //    "interactive affordance" use; it reads the chrome token with a hex fallback.
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-section-type]:hover,
      [data-preview-region]:hover {
        outline: 2px solid var(--color-copper, #b87333);
        outline-offset: 2px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  // ── (b) click capture → origin-locked section-click (D-06). Read ONLY the live DOM
  //    (D-18): the nearest clickable region is a real `data-section-type` or the
  //    `data-preview-region="contact"` footer; anything else bails.
  function onClick(e: MouseEvent): void {
    const el = (e.target as Element | null)?.closest('[data-section-type], [data-preview-region]');
    if (!el) return;
    const sectionType =
      el.getAttribute('data-section-type') ??
      (el.getAttribute('data-preview-region') === 'contact' ? CONTACT_REGION_TAG : null);
    if (!sectionType) return;
    window.parent.postMessage(
      { ns: PREVIEW_BRIDGE_NAMESPACE, type: 'section-click', sectionType },
      origin, // explicit target origin — NEVER '*' (T-27-05)
    );
  }

  // ── (c) inbound scroll-to-section (D-10 reverse-sync / D-14 post-save re-scroll),
  //    origin-checked + namespaced + CSS.escape'd (T-27-05 / T-27-06). A type with no
  //    rendered section (a sentinel/region tag) simply finds nothing and no-ops.
  function onMessage(ev: MessageEvent): void {
    if (ev.origin !== origin) return;
    const d = ev.data as { ns?: unknown; type?: unknown; sectionType?: unknown } | null;
    if (d?.ns !== PREVIEW_BRIDGE_NAMESPACE || d.type !== 'scroll-to-section') return;
    if (typeof d.sectionType !== 'string') return;
    document
      .querySelector(`[data-section-type="${CSS.escape(d.sectionType)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('click', onClick);
  window.addEventListener('message', onMessage);

  // ── (d) bridge-ready handshake (Pitfall 4): announce that THIS (re)loaded iframe
  //    document's listeners are attached, so the editor can flush a pending D-14
  //    post-save scroll without racing the new document's listener registration.
  window.parent.postMessage({ ns: PREVIEW_BRIDGE_NAMESPACE, type: 'bridge-ready' }, origin);

  return () => {
    document.removeEventListener('click', onClick);
    window.removeEventListener('message', onMessage);
    document.getElementById(STYLE_ID)?.remove();
  };
}
