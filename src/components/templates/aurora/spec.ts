/**
 * Local template spec for the `aurora` template (11-04 Wave-C — the marketer dogfood
 * ship). The sibling of `minimal/spec.ts` + `editorial/spec.ts`.
 *
 * This MIRRORS the seeded `templates.spec` JSONB for slug `'aurora'` that the 010
 * migration seeds — the same per-section `{ supported, fields }` shape. Like the others,
 * the LOCAL spec is the field-gating source of truth at render time (RESEARCH Pitfall 6):
 * the renderer field-gates from THIS code, never from an anon read of the `templates`
 * base table (not on the public-views allowlist → would force a request-time read on the
 * ISR'd page).
 *
 * COVERAGE (D-P11-06): aurora supports 12 of the 13 soft-enum types — every type EXCEPT
 * `blog_preview`. This is the BROADEST template (minimal/editorial support 7); the 5
 * marketer-vertical types (education/metrics/services/moodboard/certifications, the
 * Step-C1 additions) are FIRST-CLASS `supported:true` here, each rendered by its own
 * `sections/*.tsx`. `blog_preview` is `supported:false` (D-19 — the Blog section is
 * dropped; the dedicated blog/posts capability is a deferred future phase).
 *
 * Do NOT re-declare `TemplateSpec` here — it stays defined once in `minimal/spec.ts`.
 * `registry.ts` types `auroraSpec` to it via the `specRegistry: Record<string,
 * TemplateSpec>` assignment.
 */
export const auroraSpec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'],
    },
    about: { supported: true, fields: ['bio', 'avatar', 'avatar_alt'] },
    education: { supported: true, fields: ['heading', 'items'] },
    experience: {
      supported: true,
      fields: ['company', 'role', 'start_date', 'end_date', 'description'],
    },
    metrics: { supported: true, fields: ['heading', 'subheading', 'items'] },
    projects: {
      supported: true,
      fields: ['title', 'description', 'image', 'image_alt', 'tech_stack', 'live_url', 'repo_url'],
    },
    services: { supported: true, fields: ['heading', 'subheading', 'items'] },
    skills: { supported: true, fields: ['heading', 'groups'] },
    testimonials: {
      supported: true,
      fields: ['name', 'quote', 'avatar', 'avatar_alt', 'stars', 'company'],
    },
    moodboard: { supported: true, fields: ['heading', 'subheading', 'items', 'palette'] },
    certifications: { supported: true, fields: ['heading', 'items'] },
    contact: { supported: true, fields: ['heading', 'subheading'] },
    // Dropped (D-19): the blog engine is unbuilt + the CMS never produces `blog_preview`.
    // Declared UNSUPPORTED so the mismatch predicate is testable.
    blog_preview: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
} as const;
