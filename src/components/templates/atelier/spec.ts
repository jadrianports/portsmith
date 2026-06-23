/**
 * Local template spec for the `atelier` template (36-02 — the gallery-forward creative
 * ship). The sibling of `minimal/spec.ts` + `editorial/spec.ts` + `aurora/spec.ts`.
 *
 * This MIRRORS the seeded `templates.spec` JSONB for slug `'atelier'` that the 032
 * migration seeds — the same per-section `{ supported, fields }` shape. Like the others,
 * the LOCAL spec is the field-gating source of truth at render time (Pitfall 4): the
 * renderer field-gates from THIS code, never from an anon read of the `templates` base
 * table (not on the public-views allowlist → would force a request-time read on the ISR'd
 * page).
 *
 * COVERAGE (D-10): atelier is IMAGE-FIRST. It supports 8 of the 15 soft-enum types — the
 * 5 normal ingested types (hero/about/projects/testimonials/contact) PLUS the 3
 * image-specific types (gallery/case_study/moodboard). The remaining 7
 * (skills/experience/education/metrics/services/certifications/blog_preview) are
 * `supported:false` — declared so the mismatch predicate is testable; still EDIT +
 * round-trip lossless in the CMS.
 *
 * Do NOT re-declare `TemplateSpec` here — it stays defined once in `minimal/spec.ts`.
 * `registry.ts` types `atelierSpec` to it via the `specRegistry: Record<string,
 * TemplateSpec>` assignment.
 */
export const atelierSpec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'],
    },
    about: { supported: true, fields: ['bio', 'avatar', 'avatar_alt'] },
    gallery: { supported: true, fields: ['heading', 'items'] },
    case_study: { supported: true, fields: ['heading', 'items'] },
    projects: {
      supported: true,
      fields: ['title', 'description', 'image', 'image_alt', 'tech_stack', 'live_url', 'repo_url'],
    },
    testimonials: {
      supported: true,
      fields: ['name', 'quote', 'avatar', 'avatar_alt', 'stars', 'company'],
    },
    contact: { supported: true, fields: ['heading', 'subheading'] },
    moodboard: { supported: true, fields: ['heading', 'subheading', 'items', 'palette'] },
    // UNSUPPORTED (7) — declared so the mismatch predicate is testable; still EDIT +
    // round-trip lossless. atelier is image-first (D-10), so these non-visual types are off.
    skills: { supported: false, fields: [] },
    experience: { supported: false, fields: [] },
    education: { supported: false, fields: [] },
    metrics: { supported: false, fields: [] },
    services: { supported: false, fields: [] },
    certifications: { supported: false, fields: [] },
    blog_preview: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
} as const;
