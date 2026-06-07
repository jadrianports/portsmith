/**
 * Template spec for the `edgerunner-v2` template.
 *
 * hero, about, experience, projects, skills, services, contact — all supported.
 * metrics — folded into About (stats grid), so supported:false here.
 * blog_preview, testimonials — not rendered by this template.
 * footer is chrome — not a section type.
 */
export const edgerunnerV2Spec = {
  sections: {
    hero: {
      supported: true,
      fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'],
    },
    about: {
      supported: true,
      fields: ['bio', 'avatar', 'avatar_alt'],
    },
    metrics: {
      // Folded into About's stats grid by index.tsx; not rendered as its own section.
      supported: false,
      fields: [],
    },
    experience: {
      supported: true,
      fields: ['heading', 'subheading', 'items'],
    },
    projects: {
      supported: true,
      fields: ['heading', 'subheading', 'items'],
    },
    skills: {
      supported: true,
      fields: ['heading', 'subheading', 'groups'],
    },
    services: {
      supported: true,
      fields: ['heading', 'subheading', 'items'],
    },
    contact: {
      supported: true,
      fields: ['heading', 'subheading'],
    },
    blog_preview: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
} as const;
