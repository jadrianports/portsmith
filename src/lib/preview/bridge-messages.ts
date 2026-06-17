/**
 * The owner-preview `postMessage` bridge CONTRACT (Phase 27 — EDIT-04 / D-06 / D-10 / D-14).
 *
 * A single source of truth for the same-origin message shape spoken between the
 * `(portfolio)` edit-preview bridge (Plan 02 — mounted ONLY under the `?edit=1` flag)
 * and the chrome editor listener (Plan 03, in `editor-shell.tsx`). Co-located here as a
 * PLAIN module — exactly like `src/lib/preview/cookie.ts` — so BOTH the chrome editor
 * AND the public-side `(portfolio)` bridge can import the same contract.
 *
 * ZOD-FREE / REGISTRY-FREE / IMPORT-FREE (LOAD-BEARING, EDIT-04 / Pitfall 3): this module
 * imports NOTHING. No `@/lib/validations` (the validations barrel evaluates `z.enum(...)`
 * at module scope → ~63 kB zod onto a bundle), no template `registry.ts`, no browser API.
 * It is pure types + one string const, so importing it can NEVER drag Zod or template code
 * onto the public First-Load-JS, mirroring the beacon/cookie discipline. The
 * `preview-bridge-import-guard.test.ts` + `preview-bridge-chunk-absent.test.ts` Wave-0
 * guards assert the bridge (and thus this contract) stays off the public client chunks.
 *
 * SAME-ORIGIN ONLY (D-06 mandatory both sides): the iframe `src` is `siteUrl('/'+username)`
 * and the editor serves under the same `NEXT_PUBLIC_SITE_URL` origin, so `event.origin`
 * on both sides equals `siteOrigin()` (`src/lib/url.ts`). Every listener MUST check
 * `event.origin === siteOrigin()` THEN `data?.ns === PREVIEW_BRIDGE_NAMESPACE` before
 * acting (the `ns` tag rejects unrelated `message` events from extensions / other libs),
 * and every send MUST use an explicit target origin (`siteOrigin()`), never `'*'`.
 */

/**
 * The bridge namespace tag carried on EVERY message (D-06). Both listeners reject any
 * `message` event whose `data.ns` is not this literal, so unrelated `postMessage` traffic
 * (browser extensions, other libraries) is ignored. Discretionary literal (RESEARCH A3).
 */
export const PREVIEW_BRIDGE_NAMESPACE = 'portsmith-preview' as const;

/**
 * bridge → editor: the owner clicked a section (or the footer/contact region) in the
 * preview (D-06). `sectionType` is the soft-enum type read from `data-section-type`
 * (e.g. `'hero'`, `'projects'`), OR a region tag like `'__contact_socials__'` for the
 * footer (`data-preview-region="contact"`). The EDITOR resolves the type → the real
 * `activeSectionId` (a section-row UUID or a sentinel id) via its own `resolveSectionId`
 * — the bridge stays zero-knowledge of editor state (RESEARCH Pattern 4 KEY point).
 */
export interface SectionClickMessage {
  ns: typeof PREVIEW_BRIDGE_NAMESPACE;
  type: 'section-click';
  sectionType: string;
}

/**
 * editor → bridge: scroll the preview to a section (D-10 reverse-sync, D-14 post-save
 * re-scroll). `sectionType` is the soft-enum type whose `[data-section-type]` anchor the
 * bridge scrolls into view. A type with no rendered section (a sentinel panel) no-ops.
 */
export interface ScrollToSectionMessage {
  ns: typeof PREVIEW_BRIDGE_NAMESPACE;
  type: 'scroll-to-section';
  sectionType: string;
}

/**
 * bridge → editor: the bridge has mounted in a (re)loaded iframe document and its
 * listeners are attached (Pitfall-4 handshake). The editor, holding a pending scroll
 * target after a D-04 reload-on-save, replies with `scroll-to-section` in response to
 * THIS message — avoiding a race where the editor posts before the new iframe's listener
 * exists (RESEARCH Pattern 5).
 */
export interface BridgeReadyMessage {
  ns: typeof PREVIEW_BRIDGE_NAMESPACE;
  type: 'bridge-ready';
}

/** The discriminated union of every bridge message (discriminate on `type`). */
export type PreviewBridgeMessage =
  | SectionClickMessage
  | ScrollToSectionMessage
  | BridgeReadyMessage;
