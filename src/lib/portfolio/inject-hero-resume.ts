/**
 * `withHeroResumeUrl` — inject the LIVE `profiles.resume_url` into the hero section's
 * content at READ time (D-14 / the "Download CV/résumé" button).
 *
 * `resume_url` is a PROFILE attribute (single source of truth: `profiles.resume_url`,
 * edited via the profile form's ResumeUploader → `saveProfileAction`). But every
 * template renders the download button from the HERO section's `content.resume_url`.
 * Originally the SEED copied `profile.resume_url` into the hero content once — so the
 * value was frozen at seed time and a later CMS resume change never reached the button
 * (it kept rendering the seeded placeholder). Worse, a non-seeded user's button could
 * never populate at all (only the seed wrote it).
 *
 * Doing the injection at read time instead makes `profiles.resume_url` the single source
 * of truth: a profile save (which `revalidatePath`s the public page) drives the button
 * live for every account and template. Pure + cookie-less → safe on the ISR public read
 * (no dynamism introduced). When `resumeUrl` is null the button simply hides
 * (render-only-if-present, D-14).
 */
import type { PublicSection } from '@/components/templates/types';

export function withHeroResumeUrl(
  sections: PublicSection[],
  resumeUrl: string | null,
): PublicSection[] {
  return sections.map((s) => {
    // Only the hero carries the button; only a plain-object content can take the field.
    if (
      s.type !== 'hero' ||
      s.content === null ||
      typeof s.content !== 'object' ||
      Array.isArray(s.content)
    ) {
      return s;
    }
    return { ...s, content: { ...s.content, resume_url: resumeUrl } };
  });
}
