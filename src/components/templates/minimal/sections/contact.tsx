/**
 * Contact section (D-05 section 7). STUB — frozen against the SHARED `SectionProps`
 * contract; a Wave-4/5 plan replaces ONLY this body.
 *
 * When implemented: cast `section?.content` to `ContactContent`, render the form
 * SHELL only (inert "Send Message" button, magenta focus-ring, `email_public`
 * mailto) — the functional submit is P6 (CONT-01/02/03). Read `--token`s, return
 * `null` when there is nothing to render.
 */
import type { SectionProps } from './types';

export function Contact({ section }: SectionProps) {
  void section;
  return null;
}
