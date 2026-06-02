/**
 * Local template spec for the `editorial` ("Newsprint") template
 * (TMPL-01 / D-P7-05). The sibling of `minimal/spec.ts`.
 *
 * This MIRRORS the seeded `templates.spec` JSONB for slug `'editorial'` that the
 * 07-03 migration (008) seeds — the same per-section `{ supported, fields }` shape
 * as `minimalSpec`. Like `minimal`, the LOCAL spec is the field-gating source of
 * truth at render time (RESEARCH Pitfall 6): the renderer field-gates from THIS
 * code, never from an anon read of the `templates` base table (which is not on the
 * public-views allowlist and would force a request-time read on the ISR'd page).
 *
 * COVERAGE CONTRACT (D-P7-05 — HARD): every section type the CMS PRODUCES
 * (hero, about, skills, projects, experience, testimonials, contact) is
 * `supported: true` with the same `fields` arrays as `minimalSpec`. This is what
 * makes v1 switching lossless and means the mismatch warning (D-P7-11) never fires
 * in v1 — every filled section has a designed slot in Newsprint.
 *
 * `blog_preview` is `supported: false, fields: []` (D-P7-05 / LATER-02): the blog
 * engine is deferred to v2 and `blog_preview` is never produced by the CMS in v1.
 * Declaring it UNSUPPORTED here is what makes the `unsupportedFilledSections`
 * predicate testable (it is the one entry the v2 fires-case can target).
 *
 * `color_presets` / `font_presets` are `['default']` only (D-P7-03): each template
 * ships ONE curated look; the preset picker is deferred. (This differs from
 * `minimal`'s 4-preset arrays — fewer knobs = "hard to make ugly".)
 *
 * Do NOT re-declare `TemplateSpec` here — it stays defined once in
 * `minimal/spec.ts` (`type TemplateSpec = typeof minimalSpec`). `registry.ts`
 * imports it from there and types `editorialSpec` to it via the
 * `specRegistry: Record<string, TemplateSpec>` assignment.
 */
export const editorialSpec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'],
    },
    about: { supported: true, fields: ['bio', 'skills', 'avatar', 'avatar_alt'] },
    skills: { supported: true, fields: ['heading', 'groups'] },
    projects: {
      supported: true,
      fields: ['title', 'description', 'image', 'image_alt', 'tech_stack', 'live_url', 'repo_url'],
    },
    experience: {
      supported: true,
      fields: ['company', 'role', 'start_date', 'end_date', 'description'],
    },
    testimonials: {
      supported: true,
      fields: ['name', 'quote', 'avatar', 'avatar_alt', 'stars', 'company'],
    },
    contact: { supported: true, fields: ['heading', 'subheading'] },
    // Deferred to v2 (LATER-02): the blog engine is unbuilt and the CMS never
    // produces `blog_preview` in v1. Declared UNSUPPORTED so the mismatch predicate
    // is testable (D-P7-05).
    blog_preview: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
} as const;
