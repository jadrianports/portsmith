/**
 * Testimonials section (D-05 section 6). STUB — frozen against the SHARED
 * `SectionProps` contract; a Wave-4/5 plan replaces ONLY this body.
 *
 * When implemented: cast `section?.content` to `TestimonialsContent` and render
 * ONLY when `content.items.length >= 1` (D-06 — seeded hidden; the section owns its
 * own hide-if-empty path: `if (!content?.items?.length) return null;`). Read
 * `--token`s.
 */
import type { SectionProps } from './types';

export function Testimonials({ section }: SectionProps) {
  void section;
  return null;
}
