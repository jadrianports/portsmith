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
 * The `as const` assertion makes `minimalSpec` a precise readonly value; the shared
 * {@link TemplateSpec} contract below is a STRUCTURAL widening of that shape so a
 * SIBLING template's spec (e.g. `editorialSpec`, which legitimately marks
 * `blog_preview` `supported: false` and ships a single `['default']` preset) also
 * satisfies it — `specRegistry: Record<string, TemplateSpec>` types every entry to
 * this contract (Phase 7 / D-P7-05). Widening here keeps `TemplateSpec` defined
 * ONCE; nothing reads the literal field tuples off it (it is the field-gating /
 * mismatch contract, not a per-template equality constraint).
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
    // WR-02: `MinimalTemplate` renders no `blog_preview` section (the CMS never produces
    // one in v1), so this MUST be `supported: false` to match what the template actually
    // renders — matching editorial. A `supported: true` here is a spec/template mismatch the
    // conformance gate cannot catch (golden fixture omits blog_preview), so the spec is the
    // source of truth that must be correct.
    blog_preview: { supported: false, fields: [] },
    // NEW (Task 1 of this plan): the `skills` section type. The DB row's spec JSONB
    // lags here until a future migration; the local spec leads (RESEARCH Pitfall 6).
    skills: { supported: true, fields: ['heading', 'groups'] },
  },
  color_presets: ['default', 'ocean', 'warm', 'monochrome'],
  font_presets: ['default', 'mono', 'serif', 'editorial'],
} as const;

/** One section's support entry in a template spec: rendered? + which fields. */
export interface TemplateSectionSpec {
  supported: boolean;
  fields: readonly string[];
}

/**
 * The shape of a template spec — a STRUCTURAL contract (not `typeof minimalSpec`)
 * so every template's local spec satisfies it regardless of which sections it marks
 * `supported: false` or how many presets it ships. `minimalSpec` and the Phase-7
 * `editorialSpec` both conform; `types.ts`, the renderer, the read paths
 * (`templateSpec: TemplateSpec`), and the mismatch predicate import this type.
 *
 * `sections` is keyed by the soft-enum section types (a partial record — a template
 * MAY omit a type entirely, which the mismatch predicate treats as unsupported).
 */
export interface TemplateSpec {
  sections: Partial<Record<string, TemplateSectionSpec>>;
  color_presets: readonly string[];
  font_presets: readonly string[];
}
