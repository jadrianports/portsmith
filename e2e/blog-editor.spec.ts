/**
 * D-15 (blog-editor display nits) — e2e proving the blog-editor behaviors against the
 * REAL running app, to be confirmed in a PRODUCTION build (both bugs were
 * display/state-only, so the decision requires post-build re-verification).
 *
 *   D-15(b) [PASSING — proves 17-04 Task 2] — a brand-new post keeps its typed
 *           title/body across its FIRST debounced auto-save (no blanking). The
 *           root-cause fix (blog-panel.tsx key-stability) means the PostEditor key no
 *           longer flips on the CREATE→UPDATE promotion (onSaved), so the editor is
 *           not remounted and the controlled field state survives. Editing then
 *           continues on the persisted row (the Publish control, gated
 *           `disabled={!postId}`, enables once the first save promotes the postId).
 *
 *   D-15(a) [PASSING — BLOG-02 / 26-01, escalation CLOSED] — the Write/Preview tab
 *           renders the IN-MEMORY draft body before the first save. The 17-04 finding
 *           was that `renderPostPreviewAction` was BROKEN in the real Next runtime
 *           (dev AND production): it serialized a tree containing the client-graph
 *           code-bridge provider, and a Server Action cannot invoke a client component
 *           synchronously, so the action always returned `{ ok:false }` and the editor
 *           showed "Couldn't render the preview." The unit suite never caught it
 *           because the client directive is inert in a plain node env.
 *
 *           BLOG-02 / 26-01 fixes the root cause: the action now renders through the
 *           server-only, context-free `renderMarkdownToHtml` (no client-graph
 *           component in the tree), so it no longer throws. This test is UN-SKIPPED
 *           and is the AUTHORITATIVE BLOG-02 gate — it MUST run against a PRODUCTION
 *           build (a node-env unit test cannot reproduce the original runtime throw).
 *
 * AUTH (model: cms-loop.spec.ts) — a CONFIRMED owner is created via the admin API and
 * bootstrapped with the real initialize_portfolio RPC, then signed into the BROWSER
 * via the @supabase/ssr cookie-injection helper (cms-auth.ts). A fresh account has
 * ZERO blog posts, so BlogPanel shows the empty state + "New post" — the brand-new
 * post path under test.
 *
 * PRODUCTION-BUILD RE-VERIFICATION (the decision) — run against a production build,
 * not just dev:
 *     npm run build && (npx next start -p 3000 &)   # a built server on :3000
 *     npx playwright test e2e/blog-editor.spec.ts    # reuseExistingServer:true reuses it
 * (playwright.config.ts boots `npm run dev` by default; with a built server already
 * on 127.0.0.1:3000 the local `reuseExistingServer` reuses it, so the SAME spec
 * exercises the built app.)
 *
 * CONTENT-INDEPENDENCE — the spec asserts on UNIQUE values it TYPES, never seeded
 * copy, so a regression in the key/preview path is what fails it.
 *
 * Run command: `npx playwright test e2e/blog-editor.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import { createConfirmedOwner, deleteOwner, signInAsOwner, type TestOwner } from './helpers/cms-auth';

test.describe('D-15 — blog editor: new-post retention + Preview-before-first-save', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('blog');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  // ── D-15(b): the 17-04 Task 2 contract (key-stability across CREATE→UPDATE) ──
  test('new-post title/body survive the first auto-save and editing continues on the persisted row (D-15b)', async ({
    page,
  }) => {
    // Cold Next 16 compile (dev) or a fresh production server + the real auth + write
    // + debounced-save paths run here; generous headroom on Windows.
    test.setTimeout(150_000);

    const stamp = Date.now().toString(36);
    const newTitle = `Draft Post ${stamp}`;
    const newBody = `My first post body ${stamp}. Editing should not blank this.`;

    // 1) Sign in → the dashboard editor mounts.
    await signInAsOwner(page, owner);

    // 2) Open the Blog authoring panel ("Blog" + "Write posts" rail entry).
    await page.getByRole('button', { name: /Write posts/ }).click();

    // A fresh account has no posts → the empty state + "New post". Open a brand-new
    // (unsaved) post editor.
    await page.getByRole('button', { name: 'New post' }).click();

    // Scope to the PostEditor region ("Section editor") — the dashboard ALSO has a
    // global PublishToggle in the banner + a "Saving…/Saved" idiom elsewhere, so the
    // post-editor-specific controls must be queried inside its region to avoid a
    // strict-mode collision with the portfolio-level Publish.
    const postEditor = page.getByLabel('Section editor');
    const titleField = postEditor.getByLabel('Title', { exact: true });
    const bodyField = postEditor.getByLabel('Post body (Markdown)');
    await expect(titleField).toBeVisible();
    await expect(bodyField).toBeVisible();

    // Before any save, the post's Publish control is gated `disabled={!postId}`.
    await expect(postEditor.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();

    // 3) Type a title + body into the NEW post. Each edit schedules the debounced
    //    content auto-save; the FIRST saveable flush is the CREATE that historically
    //    remounted the editor (key flip `'__new__'`→id) and BLANKED the fields.
    //    NOTE on typing: the editor builds the save snapshot from React state in the
    //    SAME tick as the keystroke, so a single one-shot `fill()` of the body can
    //    snapshot a stale (empty) body and the skip-invalid probe (title AND body)
    //    skips the save. Type the body with `pressSequentially` so a later keystroke
    //    fires a `queueSave` against the now-committed title+body and the CREATE flush
    //    actually dispatches (this is a typing-realism detail, not the D-15b behavior).
    await titleField.fill(newTitle);
    await bodyField.click();
    await bodyField.pressSequentially(newBody, { delay: 15 });

    // 4) Wait for the first auto-save to PERSIST. The durable, sticky signal that the
    //    CREATE succeeded and onSaved(id) promoted the post (new→edit) is the post's
    //    Publish control flipping from disabled (`disabled={!postId}`) to ENABLED —
    //    `postId` is set only by a resolved save. (The transient "Saved" status text
    //    is reset to idle by the postId-change effect in use-debounced-post-save.ts,
    //    so Publish-enabled is the reliable promotion signal.)
    await expect(postEditor.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled({
      timeout: 30_000,
    });

    // 5) D-15(b) CORE: across that CREATE→UPDATE promotion the typed title + body are
    //    RETAINED (no blanking). With the OLD key-flip the editor would have remounted
    //    on the promotion and reset both fields to the empty `initial`. This is the
    //    exact regression the blog-panel.tsx key-stability fix closes.
    await expect(titleField).toHaveValue(newTitle);
    await expect(bodyField).toHaveValue(newBody);

    // 6) Editing CONTINUES on the same persisted row: a further body edit keeps the
    //    fields stable (the promotion did not destabilize the editor instance). Use a
    //    caret-independent `fill` to set a new known body deterministically.
    const editedBody = `Edited body ${stamp} — still the same editor instance.`;
    await bodyField.fill(editedBody);
    await expect(bodyField).toHaveValue(editedBody);
    await expect(titleField).toHaveValue(newTitle);
    // Still the same persisted post → Publish stays enabled (no remount/reset).
    await expect(postEditor.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  });

  // ── D-15(a): Preview-before-first-save — ESCALATION CLOSED (BLOG-02 / 26-01).
  //    renderPostPreviewAction now renders through the server-only, context-free
  //    renderMarkdownToHtml (no client-graph code-bridge component in the tree), so it
  //    no longer throws in the real Next runtime. UN-SKIPPED — this is the AUTHORITATIVE
  //    BLOG-02 gate and MUST run against a PRODUCTION build: a node-env unit test
  //    provably CANNOT catch the original runtime throw (the client directive is inert
  //    in node), so only this production-build e2e proves the fix. ──
  test(
    'Preview renders the unsaved in-memory draft body before the first save (D-15a)',
    async ({ page }) => {
      test.setTimeout(150_000);

      const stamp = Date.now().toString(36);
      const previewHeadingText = `Unsaved Heading ${stamp}`;
      const bodyMarkdown = `# ${previewHeadingText}\n\nThis is the unsaved body ${stamp}.`;

      await signInAsOwner(page, owner);
      await page.getByRole('button', { name: /Write posts/ }).click();
      await page.getByRole('button', { name: 'New post' }).click();

      const bodyField = page.getByLabel('Post body (Markdown)');
      await expect(bodyField).toBeVisible();

      // Type Markdown into a NEW, never-saved post, switch to Preview, and assert the
      // server-rendered (sanitized) HTML reflects the unsaved in-memory body — NO
      // "save first" gate. (Currently the action throws → "Couldn't render the
      // preview"; see the header escalation.)
      await bodyField.fill(bodyMarkdown);
      await page.getByRole('tab', { name: 'Preview' }).click();
      await expect(page.getByRole('heading', { name: previewHeadingText })).toBeVisible({
        timeout: 30_000,
      });
    },
  );

  // ── BLOG-01 / D-01: reopening an existing post HYDRATES the editor body ──────────
  //    The owner LIST read omits body_md (D-01), and blog-panel builds the editor
  //    `initial` from the list row (NO body). Without the lazy single-post fetch the
  //    reopened editor would show a BLANK body (`initial.body_md ?? ''`, post-editor
  //    :139) that the next save could silently overwrite. This case proves the fetch:
  //    save a post with a known unique body, return to the list, reopen it, and assert
  //    the body textarea value equals the SAVED body (not blank). Runs against the
  //    production build (the authoritative gate).
  test('reopening an existing post hydrates the editor with its saved body (BLOG-01)', async ({
    page,
  }) => {
    test.setTimeout(150_000);

    const stamp = Date.now().toString(36);
    const postTitle = `Reopen Post ${stamp}`;
    const savedBody = `Saved body ${stamp} — reopening must hydrate this, never blank it.`;

    await signInAsOwner(page, owner);
    await page.getByRole('button', { name: /Write posts/ }).click();

    // 1) Create a brand-new post with a known title + body and let it auto-save.
    await page.getByRole('button', { name: 'New post' }).click();
    const postEditor = page.getByLabel('Section editor');
    const titleField = postEditor.getByLabel('Title', { exact: true });
    const bodyField = postEditor.getByLabel('Post body (Markdown)');
    await expect(titleField).toBeVisible();

    await titleField.fill(postTitle);
    await bodyField.click();
    // Type the body with pressSequentially so a later keystroke fires a queueSave
    // against the committed title+body and the CREATE flush actually dispatches.
    await bodyField.pressSequentially(savedBody, { delay: 12 });

    // The durable signal the CREATE persisted (onSaved → postId set) is the post's
    // Publish control flipping from disabled to ENABLED.
    await expect(postEditor.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled({
      timeout: 30_000,
    });

    // 2) Go back to the list, then REOPEN the just-saved post from it. The list row
    //    carries NO body — the editor must lazily fetch the full post to hydrate.
    await postEditor.getByRole('button', { name: '← Posts' }).click();
    await page.getByRole('button', { name: postTitle }).click();

    // 3) BLOG-01 CORE: the reopened editor's body textarea equals the SAVED body
    //    (it was fetched + hydrated, not left blank). The in-flight skeleton disables
    //    the body, so wait for it to be enabled (load resolved) before asserting.
    const reopenedBody = page.getByLabel('Section editor').getByLabel('Post body (Markdown)');
    await expect(reopenedBody).toBeEnabled({ timeout: 30_000 });
    await expect(reopenedBody).toHaveValue(savedBody);
  });
});
