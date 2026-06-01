/**
 * Local template spec for the `minimal` template (TMPL-03 engine half / D-19).
 *
 * This MIRRORS the seeded `templates.spec` JSONB for slug `'minimal'` in
 * `supabase/migrations/001_initial_schema.sql` (the `INSERT INTO templates` block)
 * — the seven original section entries, `color_presets`, and `font_presets` are
 * reproduced verbatim — PLUS a `skills` entry for the new section type added in
 * Task 1 of this plan.
 *
 * WHY A LOCAL SPEC (RESEARCH Pitfall 6): in Phase 3 the renderer field-gates from
 * THIS code, not from an anon read of the `templates` base table. The local spec is
 * the P3 source of truth for which sections/fields a template supports; the DB row's
 * `spec` lags (it has no `skills` entry yet) until a future migration adds it. Do NOT
 * read the `templates` table from the anon client for field-gating — it is not on the
 * public-views allowlist and would force a request-time read on the ISR'd page.
 *
 * The `as const` assertion makes `TemplateSpec = typeof minimalSpec` a precise,
 * readonly contract that `types.ts` and the template renderer consume.
 */
export const minimalSpec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'],
    },
    about: { supported: true, fields: ['bio', 'skills', 'avatar', 'avatar_alt'] },
    projects: {
      supported: true,
      fields: ['title', 'description', 'image', 'image_alt', 'tech_stack', 'live_url', 'repo_url'],
    },
    testimonials: {
      supported: true,
      fields: ['name', 'quote', 'avatar', 'avatar_alt', 'stars', 'company'],
    },
    experience: {
      supported: true,
      fields: ['company', 'role', 'start_date', 'end_date', 'description'],
    },
    contact: { supported: true, fields: ['heading', 'subheading'] },
    blog_preview: { supported: true, fields: ['heading', 'post_count'] },
    // NEW (Task 1 of this plan): the `skills` section type. The DB row's spec JSONB
    // lags here until a future migration; the local spec leads (RESEARCH Pitfall 6).
    skills: { supported: true, fields: ['heading', 'groups'] },
  },
  color_presets: ['default', 'ocean', 'warm', 'monochrome'],
  font_presets: ['default', 'mono', 'serif', 'editorial'],
} as const;

/**
 * The shape of a template spec — derived from {@link minimalSpec} so the contract
 * stays in lockstep with the canonical local spec. `types.ts` and the renderer
 * import this type to field-gate.
 */
export type TemplateSpec = typeof minimalSpec;
