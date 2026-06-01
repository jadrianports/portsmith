/**
 * Hero section (D-05 section 1). STUB — frozen against the SHARED `SectionProps`
 * contract; 03-05 replaces ONLY this body (CTA "Work with me" magenta fill + résumé
 * button from `profile.resume_url`). The signature, export name, and `index.tsx`
 * wiring NEVER change.
 *
 * When implemented: cast `section?.content` to `HeroContent` (from `@/lib/validations`),
 * null-guard every field, read `--token`s (no hardcoded hex — SHARED-D), and return
 * `null` when there is no hero content.
 */
import type { SectionProps } from './types';

export function Hero({ section }: SectionProps) {
  void section;
  return null;
}
