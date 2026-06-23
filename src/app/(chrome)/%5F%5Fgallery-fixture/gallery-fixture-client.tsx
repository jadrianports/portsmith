'use client';

/**
 * Client island for the dev/test-only gallery fixture (34-02). Mounts the real
 * `GalleryUploader` and records every emitted `{url,width,height}` item, surfacing
 * them as JSON in a `[data-testid="gallery-emit"]` element for the orientation e2e to
 * read (e2e/gallery-orientation.spec.ts). No persistence — this is purely the emit
 * seam (Pattern 2 — the uploader is a field control; Phase 35 owns persistence).
 */
import { useState } from 'react';

import {
  GalleryUploader,
  type GalleryUploadItem,
} from '@/components/editor/gallery-uploader';

export function GalleryFixtureClient() {
  const [items, setItems] = useState<GalleryUploadItem[]>([]);

  return (
    <div className="flex flex-col gap-4">
      <GalleryUploader
        onUploaded={(item) => setItems((prev) => [...prev, item])}
        persistedUrls={new Set(items.map((i) => i.url))}
      />
      {/* The e2e reads the latest emitted payload from here. */}
      <pre data-testid="gallery-emit">{JSON.stringify(items)}</pre>
    </div>
  );
}
