/**
 * Local template spec for the `edgerunner-v2` template.
 *
 * For NOW: only `hero` is supported (verified first before expanding).
 * Other sections supported:false — we add them after the hero is verified.
 *
 * Do NOT re-declare `TemplateSpec` here — it stays defined once in `minimal/spec.ts`.
 */
export const edgerunnerV2Spec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'],
    },
    about: { supported: false, fields: [] },
    metrics: { supported: false, fields: [] },
    experience: { supported: false, fields: [] },
    projects: { supported: false, fields: [] },
    skills: { supported: false, fields: [] },
    contact: { supported: false, fields: [] },
    services: { supported: false, fields: [] },
    blog_preview: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
} as const;
