/**
 * MEDIA slice (full upload → render loop) — GREEN as of Plan 05.
 *
 * The whole Phase-5 promise end-to-end: a signed-in owner opens the Projects section,
 * adds a project, and uploads its image through the REAL ImageUploader (pick a real
 * PNG → the fixed-ratio CropModal → "Use photo" → client WebP encode → POST
 * /api/media/upload → the thumbnail lands), fills the required alt text, then
 * Publishes — and the PUBLIC `/[username]` page renders that project image as a
 * Supabase-Storage-origin image, proving the D-08 host-lock (only Storage URLs
 * render) AND the full upload → persist → revalidate → render loop.
 *
 * WHY THE PROJECT-IMAGE SLOT (not the profile avatar): the profile avatar
 * (`profiles.avatar_url`) is NOT rendered by the public `minimal` template — the
 * public page only renders image slots that live in section content (the About
 * avatar and the project / testimonial item images). The project image is the
 * fully-wired, publicly-rendered slot, so it is the only honest way to assert the
 * plan's "the public page renders the Storage image" + "rendered src origin equals
 * NEXT_PUBLIC_SUPABASE_URL" must-have. It exercises the IDENTICAL ImageUploader,
 * the IDENTICAL /api/media/upload route, and the IDENTICAL D-08 host-lock. (Rule-1/2
 * deviation from the plan's literal "avatar" wording — documented for the founder
 * checkpoint; the avatar slot cannot satisfy its own public-render acceptance.)
 *
 * AUTH: a CONFIRMED owner created via the admin API + the real initialize_portfolio
 * RPC, signed into the browser via the deterministic @supabase/ssr cookie injection
 * (e2e/helpers/cms-auth.ts) — the same model cms-loop.spec.ts uses.
 *
 * REAL FIXTURE: `e2e/fixtures/avatar.png` is a real, decodable 256×256 PNG (NOT a
 * 1-byte stub): the client decodes it (`Image.decode()`), react-cropper renders it,
 * and `getCroppedCanvas().toBlob('image/webp')` produces the uploaded bytes — so the
 * route's magic-byte sniff sees a genuine `image/webp`.
 *
 * Run command: `npx playwright test e2e/media-upload.spec.ts`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  waitForPublicState,
  type TestOwner,
} from './helpers/cms-auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The Storage public-object path prefix for a project image (proves D-08 origin + bucket). */
const PROJECT_STORAGE_PREFIX = '/storage/v1/object/public/media/';

test.describe('MEDIA — upload a project image → publish → the public page renders the Storage image', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('media');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('an uploaded image appears as a Storage-origin <img> on the published page', async ({
    page,
  }) => {
    // Cold Next 16 dev compiles + the real auth + upload + write + revalidate paths
    // all run here; give generous headroom on Windows.
    test.setTimeout(180_000);

    // REGRESSION GUARD (05-05 UAT, Bug 1 — hydration): capture any React
    // hydration-mismatch console error across the whole run. The editor's dnd-kit
    // DndContexts (section rail + item manager) now carry stable explicit ids, so the
    // server and client aria-describedby ids match and zero mismatches are emitted.
    const hydrationErrors: string[] = [];
    page.on('console', (msg) => {
      const t = msg.text();
      if (/hydrat|did not match|server rendered HTML/i.test(t)) hydrationErrors.push(t);
    });

    const projectTitle = `Media Project ${Date.now().toString(36)}`;

    // 1) Sign in → the editor mounts (populated, not blank).
    await signInAsOwner(page, owner);

    // 2) Open the Projects section — its ItemManager owns the project ImageUploader.
    await page.getByRole('button', { name: 'Projects', exact: true }).click();

    // 3) Add a project — the new card opens expanded, ready to fill.
    await page.getByRole('button', { name: 'Add project' }).click();

    // Fill the title FIRST so the section's auto-save (on the final patch) has all
    // required fields (title min 1) + the image + its required alt → a clean save.
    // Use the textbox role (the card's Reorder/Remove buttons also carry "...Title"
    // in their accessible names, so a bare getByLabel('Title') is ambiguous).
    await page.getByRole('textbox', { name: 'Title' }).fill(projectTitle);

    // 4) Drive the REAL uploader: set the project file input. The hidden input carries
    //    data-testid="project-uploader"; setInputFiles fires its onChange → the client
    //    decodes the PNG and opens the fixed-ratio CropModal ("Position your photo").
    const fixture = path.join(__dirname, 'fixtures', 'avatar.png');
    await page.getByTestId('project-uploader').setInputFiles(fixture);

    const cropDialog = page.getByRole('dialog', { name: 'Position your photo' });
    await expect(cropDialog).toBeVisible({ timeout: 30_000 });

    // 5) "Use photo" → client WebP encode → POST /api/media/upload. Assert the route
    //    returns 200 with a Storage media URL (the network proof of the upload).
    const uploadResponse = page.waitForResponse(
      (res) => res.url().includes('/api/media/upload') && res.request().method() === 'POST',
      { timeout: 60_000 },
    );
    await cropDialog.getByRole('button', { name: 'Use photo' }).click();
    const res = await uploadResponse;
    expect(res.status()).toBe(200);
    const payload = (await res.json()) as { url?: string };
    expect(payload.url, 'upload route returned a url').toBeTruthy();
    expect(payload.url).toContain(PROJECT_STORAGE_PREFIX);

    // The success beat confirms the thumbnail landed + the value swapped.
    await expect(page.getByText('Photo added — it’s on your page')).toBeVisible({
      timeout: 30_000,
    });

    // REGRESSION GUARD (05-05 UAT, Bug 2 — spurious save error): the image is now set
    // but its REQUIRED alt is still empty, so the project item is not yet valid.
    // ItemManager.persist must SKIP the auto-save (no doomed {ok:false} POST) and must
    // NOT raise the "couldn’t save" toast the user never triggered. The error Alert
    // must be absent until alt is filled (when the save legitimately fires below).
    await expect(
      page.getByText('We couldn’t save your changes. Please try again.'),
    ).toBeHidden();

    // 6) Fill the required alt text LAST. This onPatch triggers the section auto-save
    //    with title + image + alt all present → the server alt refine passes and the
    //    whole-section write + revalidate succeeds.
    await page.getByRole('textbox', { name: 'Alt text' }).fill('A landscape project screenshot');

    // 7) Publish (frictionless, no confirm) → the status flips to Live. Allow a brief
    //    settle so the section auto-save lands before publish revalidates.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 });

    // 8) The PUBLIC page goes live (200) and renders the uploaded image as a
    //    Storage-origin image (the D-08 host-lock renders ONLY Storage URLs). Poll
    //    until the body carries the Storage media path, then assert the rendered
    //    <img> src ORIGIN equals NEXT_PUBLIC_SUPABASE_URL's origin.
    await waitForPublicState(page, `/${owner.username}`, {
      status: 200,
      expectText: PROJECT_STORAGE_PREFIX,
      timeoutMs: 40_000,
    });

    await page.goto(`/${owner.username}`);
    const storageBase = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    );
    // The minimal template renders the project image via next/image (unoptimized) —
    // the rendered <img> src is the raw Storage URL. Find it by its Storage path.
    const projectImg = page.locator(`img[src*="${PROJECT_STORAGE_PREFIX}"]`).first();
    await expect(projectImg).toBeVisible({ timeout: 30_000 });
    const renderedSrc = await projectImg.getAttribute('src');
    expect(renderedSrc, 'project img has a src').toBeTruthy();
    // D-08 proof: the rendered image origin is the Supabase Storage origin, nothing else.
    expect(new URL(renderedSrc!).origin).toBe(storageBase.origin);

    // Bug 1 final assertion: no React hydration mismatch was logged at any point in
    // the run (stable DndContext ids hold across SSR + client hydration).
    expect(hydrationErrors, 'no React hydration mismatch on the dashboard').toEqual([]);
  });
});
