/**
 * 13.1-05 (Wave 2, TDD) — D-11: the two-level skills-nested-manager's PURE content
 * builder. RED first — `buildSkillsContent` does not yet exist, so the import below
 * fails to resolve (the impl-driven RED, NOT a syntax error).
 *
 * WHY render-free (the storage-meter / skills-form / debounced-save precedent): the
 * vitest `unit` project is the `node` environment (NOT jsdom; the repo ships no
 * @testing-library/react). So — exactly as `skills-form.tsx` lifts `buildSkillsContent`
 * into a pure export asserted WITHOUT a DOM — the two-level manager's whole-section
 * rebuild is lifted into a pure `buildSkillsContent(heading, groups)` export and
 * asserted here.
 *
 * THE CONTRACT (D-11, Pitfall 7):
 *   - The builder rebuilds the WHOLE `{ heading, groups: [...] }` content from the
 *     editor's working state (groups carry a CLIENT-ONLY `__id` for dnd-kit/React keys;
 *     each skill carries a CLIENT-ONLY `__id` too). Those client ids are STRIPPED — the
 *     persisted content matches `skillsContentSchema` (groups: { label, items }, items:
 *     { name, icon?, tier?, level? }) with NO `__id` leaking into the JSONB.
 *   - The `level` field ROUND-TRIPS (a numeric 0–100 proficiency must survive the
 *     rebuild — the edgerunner animated-bars data, Phase-13 D-09). `tier` and `icon`
 *     round-trip too; absent optionals stay absent.
 *
 * The builder does NOT clamp/validate — it faithfully carries what the editor holds; the
 * SERVER re-parse (`validateSectionContent` → `skillsContentSchema`) stays the sole gate
 * (the island MUST NOT import the Zod barrel — D-25).
 */
import { describe, expect, it } from 'vitest';

// The not-yet-existing pure builder + its editor-state types. RED until the impl ships.
import {
  buildSkillsContent,
  type SkillsEditorGroup,
} from '@/components/editor/skills-nested-manager';

/** A small editor-state fixture: two groups, the second carrying icon + tier + level. */
function fixtureGroups(): SkillsEditorGroup[] {
  return [
    {
      __id: 'g-client-1',
      label: 'Core Competencies',
      items: [
        { __id: 'i-1', name: 'API Design', tier: 'core', level: 85 },
        { __id: 'i-2', name: 'System Design' },
      ],
    },
    {
      __id: 'g-client-2',
      label: 'Tech Stack',
      items: [
        { __id: 'i-3', name: 'TypeScript', icon: 'typescript', tier: 'core', level: 95 },
        { __id: 'i-4', name: 'Next.js', icon: 'nextdotjs', tier: 'proficient', level: 80 },
      ],
    },
  ];
}

describe('D-11 — buildSkillsContent rebuilds the whole { heading, groups } content', () => {
  it('round-trips heading + the two-level group/skill structure', () => {
    const content = buildSkillsContent('What I work with', fixtureGroups());

    expect(content.heading).toBe('What I work with');
    expect(content.groups).toHaveLength(2);
    expect(content.groups[0].label).toBe('Core Competencies');
    expect(content.groups[0].items).toHaveLength(2);
    expect(content.groups[1].label).toBe('Tech Stack');
    expect(content.groups[1].items).toHaveLength(2);
  });

  it('PRESERVES the level field (the edgerunner animated-bars data) on every skill that has it', () => {
    const content = buildSkillsContent('Skills', fixtureGroups());

    expect(content.groups[0].items[0]).toMatchObject({ name: 'API Design', tier: 'core', level: 85 });
    expect(content.groups[1].items[0]).toMatchObject({
      name: 'TypeScript',
      icon: 'typescript',
      tier: 'core',
      level: 95,
    });
    // level=80 survives the rebuild for the second tech-stack skill too.
    expect(content.groups[1].items[1].level).toBe(80);
  });

  it('STRIPS the client-only __id keys — nothing leaks into the persisted JSONB', () => {
    const content = buildSkillsContent('Skills', fixtureGroups());

    for (const group of content.groups) {
      expect(group).not.toHaveProperty('__id');
      for (const item of group.items) {
        expect(item).not.toHaveProperty('__id');
      }
    }
  });

  it('OMITS absent optionals — a skill with only a name carries no icon/tier/level keys', () => {
    const content = buildSkillsContent('Skills', fixtureGroups());

    const bare = content.groups[0].items[1]; // { name: 'System Design' }
    expect(bare).toEqual({ name: 'System Design' });
    expect(bare).not.toHaveProperty('icon');
    expect(bare).not.toHaveProperty('tier');
    expect(bare).not.toHaveProperty('level');
  });

  it('trims/passes the name through faithfully (the server min(1) re-parse is the gate, not the builder)', () => {
    const groups: SkillsEditorGroup[] = [
      { __id: 'g', label: 'G', items: [{ __id: 'i', name: '  React  ' }] },
    ];
    const content = buildSkillsContent('H', groups);
    // The builder does not clamp/validate — it carries the value verbatim.
    expect(content.groups[0].items[0].name).toBe('  React  ');
  });
});
