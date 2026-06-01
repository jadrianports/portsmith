/**
 * Projects section (D-05 section 4). STUB — frozen against the SHARED `SectionProps`
 * contract; a Wave-4/5 plan replaces ONLY this body.
 *
 * When implemented: cast `section?.content` to `ProjectsContent`, render cards only
 * (NO modal — TMPL-06 → P6); "Visit ↗"/"Code ↗" links render only when `live_url`/
 * `repo_url` are present. Read `--token`s, return `null` when no items.
 */
import type { SectionProps } from './types';

export function Projects({ section }: SectionProps) {
  void section;
  return null;
}
