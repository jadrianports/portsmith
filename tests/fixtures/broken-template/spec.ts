/**
 * The negative fixture's local spec (Phase-10 Plan 02; the inverted twin of
 * `src/components/templates/minimal/spec.ts`). It satisfies the structural `TemplateSpec`
 * contract (so it type-checks + the gate can read it), but it declares `contact` as
 * `supported: true` — a section the fixture's `index.tsx` then DELIBERATELY DROPS (no
 * `data-section-type="contact"` wrapper). That dropped pair is the PIPE-05 conformance
 * gate's witnessed REJECT (Plan 10-04 asserts the gate goes RED on this folder).
 *
 * D-P10-02a: this spec lives ONLY under `tests/fixtures/` and is ABSENT from
 * `specRegistry` (and every other registry surface).
 */
import type { TemplateSpec } from '@/components/templates/contract';

export const brokenSpec: TemplateSpec = {
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
    // DROPPED-SECTION PAIR (PIPE-05 REJECT): declared supported:true here, but
    // `index.tsx` renders NO data-section-type="contact" wrapper. The conformance gate
    // asserts every supported+filled section is in the DOM → this goes RED.
    contact: { supported: true, fields: ['heading', 'subheading'] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
};
