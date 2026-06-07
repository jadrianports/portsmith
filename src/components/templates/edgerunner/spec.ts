/**
 * Local template spec for the `edgerunner` template (PIPE-09 — the rich/viz-lane
 * synthwave dogfood). The sibling of `minimal/spec.ts` + `aurora/spec.ts`.
 *
 * This MIRRORS the seeded `templates.spec` JSONB for slug `'edgerunner'` that the 015
 * migration seeds (plan 05) — the same per-section `{ supported, fields }` shape. Like
 * the others, the LOCAL spec is the field-gating source of truth at render time
 * (RESEARCH Pitfall 6): the renderer field-gates from THIS code via `resolveSpec(slug)`,
 * NEVER from an anon read of the `templates` base table (not on the public-views
 * allowlist → would force a request-time read on the ISR'd `/[username]` page, D-22).
 *
 * COVERAGE (D-01 — single-scroll ONLY): edgerunner supports 7 of the soft-enum types —
 * `hero, about, metrics, experience, projects, skills, contact` (the export's
 * single-scroll composition; `tools → skills`, `profile.stats → metrics`, `timeline`
 * is an experience render-style, all per D-08). `services` is `supported:false` (the
 * export links it to a dedicated `/services` page — multi-page, OUT by D-01 → Phase
 * 13.2) and `blog_preview` is `supported:false` (the blog engine is deferred, D-01 →
 * 13.2). The types already exist; nothing is invented (CMS-08).
 *
 * Do NOT re-declare `TemplateSpec` here — it stays defined once in `minimal/spec.ts`.
 * `registry.ts` types `edgerunnerSpec` to it via the `specRegistry: Record<string,
 * TemplateSpec>` assignment.
 */
export const edgerunnerSpec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'],
    },
    about: { supported: true, fields: ['bio', 'avatar', 'avatar_alt'] },
    metrics: { supported: true, fields: ['heading', 'subheading', 'items'] },
    experience: {
      supported: true,
      fields: ['company', 'role', 'start_date', 'end_date', 'description', 'highlights'],
    },
    projects: {
      supported: true,
      fields: ['title', 'description', 'image', 'image_alt', 'tech_stack', 'live_url', 'repo_url'],
    },
    // The SIGNATURE (D-09): edgerunner renders animated bars from skills `level`
    // (minimal/editorial render tier pills and ignore `level`). `level` is part of the
    // skill item shape (Zod), gated at the item level — the section spec lists the
    // group-level fields the same way minimal/aurora do.
    skills: { supported: true, fields: ['heading', 'groups'] },
    contact: { supported: true, fields: ['heading', 'subheading'] },
    // Faithful-clone task: services is now a SUPPORTED single-scroll section.
    // The export's multi-page `/services` route is adapted as an inline "OFFERINGS" block.
    services: { supported: true, fields: ['heading', 'subheading', 'items'] },
    // Dropped (D-01 → 13.2): the blog engine is unbuilt + the CMS never produces
    // `blog_preview`. Declared UNSUPPORTED so the mismatch predicate is testable.
    blog_preview: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
} as const;
