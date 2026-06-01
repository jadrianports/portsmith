/**
 * Skills section (D-05 section 3). STUB — frozen against the SHARED `SectionProps`
 * contract; a Wave-4/5 plan replaces ONLY this body.
 *
 * When implemented: cast `section?.content` to `SkillsContent` (the new soft-enum
 * type from 03-01), render curated `simple-icons` `.path` data inside own
 * `<svg viewBox="0 0 24 24" fill="currentColor">` (Server Component — ships zero
 * client JS), tier labels Core/Proficient/Learning (NEVER % gauges — D-09). Return
 * `null` when there are no groups.
 */
import type { SectionProps } from './types';

export function Skills({ section }: SectionProps) {
  void section;
  return null;
}
