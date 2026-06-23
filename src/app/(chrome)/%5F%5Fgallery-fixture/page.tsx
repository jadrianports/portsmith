/**
 * Dev/test-only GalleryUploader render harness (34-02, MEDIA-02 orientation e2e).
 *
 * `/__gallery-fixture` mounts the real `GalleryUploader` inside the `(chrome)` root
 * (so it inherits the `QueryClientProvider` the uploader's `useQueryClient` needs)
 * and surfaces every emitted `onUploaded({url,width,height})` payload as JSON in a
 * `[data-testid="gallery-emit"]` element. The orientation e2e
 * (e2e/gallery-orientation.spec.ts) signs in as a verified owner, picks an
 * EXIF-Orientation-6 JPEG, and asserts the emitted dims are the DISPLAY orientation
 * (portrait stays portrait) — proving the EXIF rotation is baked into the downscale
 * canvas BEFORE encode (Pitfall 1 / T-34-09).
 *
 * FOLDER NAME (load-bearing, mirrors the `%5F%5Ffixture` template route): the
 * directory is the URL-ENCODED `__gallery-fixture`. Next treats any folder starting
 * with `_` as PRIVATE and excludes it from the route tree; percent-encoding the
 * underscores opts it back into routing while Next decodes the segment to the public
 * URL `/__gallery-fixture`. Do NOT rename it to a bare `__gallery-fixture` — it would
 * silently stop routing.
 *
 * `dynamic = 'force-dynamic'` + the `NODE_ENV === 'production'` prod-guard keep this
 * off every prerendered/SSG surface and serve NOTHING in a production build (ASVS V4
 * dev/test-only render surface — same contract as the `__fixture` template route).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GalleryFixtureClient } from './gallery-fixture-client';

/** Explicitly NOT an ISR/SSG path — never prerenders, never goes on the public surface. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gallery uploader fixture (dev/test only)',
  robots: { index: false, follow: false },
};

export default function GalleryFixturePage() {
  // ASVS V4 prod-guard: a production build serves nothing here.
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-4 text-lg font-semibold">Gallery uploader fixture</h1>
      <GalleryFixtureClient />
    </main>
  );
}
