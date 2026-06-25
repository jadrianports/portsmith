/**
 * Local template spec for the `blueprint` template — the dark "engineering bench" ship. The
 * sibling of `minimal`/`editorial`/`aurora`/`atelier` spec.ts. MIRRORS the seeded
 * `templates.spec` JSONB for slug `'blueprint'` (the seed migration); the LOCAL spec is the
 * field-gating source of truth at render time (Pitfall 4) — the renderer field-gates from THIS
 * code, never from an anon read of the `templates` base table.
 *
 * COVERAGE: blueprint is a FULL developer/engineering single-scroll — it supports 13 of the 15
 * soft-enum types (every type the export ships). The 2 NOT shipped by the export
 * (gallery / moodboard — the image-wall creative types) are `supported: false` (still EDIT +
 * round-trip lossless in the CMS).
 *
 * PAGES (D-14/D-15): blueprint is the first PUBLIC page-capable template (operator decision) —
 * it opts into the dedicated `/blog` + `/blog/[slug]` sub-routes via `pages: ['blog']`. The
 * export had no `/services` page (services renders inline in the single scroll), so `services`
 * is NOT in `pages`.
 *
 * Do NOT re-declare `TemplateSpec` here — it stays defined once in `minimal/spec.ts`.
 */
export const blueprintSpec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image', 'resume_url'],
    },
    about: { supported: true, fields: ['bio', 'skills', 'avatar', 'avatar_alt'] },
    skills: { supported: true, fields: ['heading', 'groups'] },
    metrics: { supported: true, fields: ['heading', 'subheading', 'items'] },
    projects: {
      supported: true,
      fields: ['heading', 'items', 'title', 'description', 'image', 'image_alt', 'tech_stack', 'tags', 'live_url', 'repo_url'],
    },
    case_study: { supported: true, fields: ['heading', 'items'] },
    experience: {
      supported: true,
      fields: ['heading', 'items', 'company', 'role', 'start_date', 'end_date', 'description', 'highlights'],
    },
    education: { supported: true, fields: ['heading', 'items'] },
    certifications: { supported: true, fields: ['heading', 'items'] },
    services: { supported: true, fields: ['heading', 'subheading', 'items'] },
    testimonials: {
      supported: true,
      fields: ['heading', 'items', 'name', 'quote', 'avatar', 'avatar_alt', 'stars', 'company'],
    },
    blog_preview: { supported: true, fields: ['heading', 'items'] },
    contact: { supported: true, fields: ['heading', 'subheading'] },
    // UNSUPPORTED (2) — the export ships no image-wall creative sections. Declared so the
    // mismatch predicate is testable; still EDIT + round-trip lossless in the CMS.
    gallery: { supported: false, fields: [] },
    moodboard: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
  // D-14/D-15 — blueprint opts into the dedicated /blog sub-routes (the first PUBLIC
  // page-capable template). No /services page (the export rendered services inline).
  pages: ['blog'],
} as const;
