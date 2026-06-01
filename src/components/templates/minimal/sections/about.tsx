/**
 * About section (D-05 section 2). STUB — frozen against the SHARED `SectionProps`
 * contract; a Wave-4/5 plan replaces ONLY this body. Do NOT render the About
 * `skills` array — it is superseded by the dedicated Skills section (UI-SPEC §2).
 *
 * When implemented: cast `section?.content` to `AboutContent`, null-guard fields,
 * read `--token`s, return `null` when empty.
 */
import type { SectionProps } from './types';

export function About({ section }: SectionProps) {
  void section;
  return null;
}
