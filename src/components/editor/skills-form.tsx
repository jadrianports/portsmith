'use client';

/**
 * SkillsForm (13-06 / PIPE-09 / D-10) — the NARROW, skills-ONLY `level` editor.
 *
 * D-10 wants the founder to ship complete (the seed, plan 05) AND adjust his
 * content in-app. The one net-new field edgerunner introduced (plan 02) is the
 * skills `level` (0–100 proficiency, the animated-bars input). This form is the
 * minimal honest interpretation of D-10's "in-app editability": a `level` number
 * input per skill item, bound to the EXISTING canonical write path
 * (`saveSectionAction` → `validateSectionContent`) — NOT the full per-type-form
 * overhaul (that is the deferred Phase 13.1 editing surface, EDIT-ALL).
 *
 * SCOPE DISCIPLINE: this is skills-ONLY. `editor-shell.tsx` routes ONLY the
 * `skills` type here; every other unsupported type (metrics, education, …) keeps
 * its "coming soon" placeholder. No metrics form, no generic per-type framework.
 *
 * SAVE PATH (mirrors SectionForm.doSave EXACTLY — section-form.tsx:115-160):
 * non-optimistic. On Save the WHOLE skills content (every group/item, with the
 * edited `level` values) is rebuilt and POSTed to
 * `saveSectionAction({ sectionId, type:'skills', content, username })`; the result
 * is mapped back — `{ ok:true }` → the saved-&-live beat, `{ ok:false }` →
 * field/banner errors, never a saved beat before the action resolves. The Zustand
 * `dirty` flag is ephemeral UI state (arms the CMS-07 guard); section content lives
 * in TanStack Query, never mirrored here (CLAUDE.md non-overlap).
 *
 * BUNDLE RULE (CLAUDE.md / CONTRACT §7 — LOAD-BEARING): this `'use client'` island
 * MUST NOT import the `@/lib/validations` barrel or `templates/registry.ts` — both
 * drag Zod onto the public First Load JS bundle. The level input bounds
 * (min=0 max=100 step=1) are UX-only LITERALS mirroring the schema's documented
 * 0–100 int range (`skillItemSchema.level`, sections.ts); the AUTHORITATIVE
 * validation is the SERVER re-parse inside `saveSectionAction` →
 * `validateSectionContent`. An out-of-range edit (e.g. 101) is rejected there and
 * surfaces as a fieldError (proven by tests/unit/validations.test.ts +
 * tests/unit/editor/skills-level-input.test.tsx).
 *
 * Source: the save idiom from `section-form.tsx` (doSave + useRegisterActiveSave +
 * the SaveState lifecycle); the field primitive from `ui/input.tsx`; the panel
 * header from `form-panel-header.tsx`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { saveSectionAction } from '@/lib/cms/save-section-action';
import { useUIStore } from '@/lib/stores/uiStore';

import { FormPanelHeader } from './form-panel-header';
import type { SaveState } from './save-button';
import { useRegisterActiveSave } from './unsaved-guard';

/**
 * Skills `level` UX bounds — LITERALS mirroring `skillItemSchema.level`
 * (`z.number().int().min(0).max(100).optional()`, sections.ts). Client UX only; the
 * server re-parse is the gate (the barrel is intentionally NOT imported here).
 */
const LEVEL_MIN = 0;
const LEVEL_MAX = 100;
const LEVEL_STEP = 1;

const GENERIC_ERROR = 'Something went wrong saving your changes. Please try again.';
/** ~2.2s success-beat hold (UI-SPEC Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;

/** A stable per-item key — `g{groupIndex}i{itemIndex}` — used by the level edit map. */
export function itemKey(groupIndex: number, itemIndex: number): string {
  return `g${groupIndex}i${itemIndex}`;
}

/** The save outcome shape this form maps (the saveSectionAction result union). */
type SaveResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

/** The mapped UI state mapSaveResult produces (the non-optimistic result mapping). */
export interface MappedSave {
  saveState: SaveState;
  fieldErrors: Record<string, string>;
  banner: string | null;
}

/**
 * PURE: map a `saveSectionAction` result to the form's UI state, mirroring
 * SectionForm.doSave (non-optimistic). `{ ok:true }` → the 'saved' beat with no
 * errors; `{ ok:false }` → re-enable for retry ('dirty') with the server's
 * fieldErrors mapped back and/or a form-level banner. The 101 reject arrives as a
 * server `fieldErrors` entry (the action re-parses through validateSectionContent);
 * the form SURFACES it rather than swallowing it.
 *
 * Exported (no DOM needed) so the behavior is unit-testable in the `node` vitest
 * project — the storage-meter precedent (lift the decision into a pure helper).
 */
export function mapSaveResult(result: SaveResult): MappedSave {
  if (result.ok) {
    return { saveState: 'saved', fieldErrors: {}, banner: null };
  }
  return {
    saveState: 'dirty',
    fieldErrors: result.fieldErrors ?? {},
    banner: result.error ?? null,
  };
}

/** The loose skills content shape the editor manipulates (schemaless JSONB). */
type SkillItem = Record<string, unknown> & { name?: unknown; level?: unknown };
type SkillGroup = Record<string, unknown> & { items?: unknown };
type SkillsContent = Record<string, unknown> & { groups?: unknown };

/** Read an item's current numeric level (or undefined when absent/non-numeric). */
function levelOf(item: SkillItem): number | undefined {
  return typeof item.level === 'number' ? item.level : undefined;
}

/**
 * PURE: rebuild the WHOLE skills content with the edited per-item `level` values.
 * Every group/item (name/icon/tier/… and all other keys) is preserved; only an
 * item whose `itemKey` appears in `levelById` has its `level` replaced. The builder
 * does NOT clamp/validate — it faithfully carries what the user typed (incl. an
 * out-of-range 101), so the SERVER re-parse stays the sole authority.
 *
 * Exported (no DOM needed) so the save payload is unit-testable in the `node`
 * vitest project (the storage-meter precedent).
 */
export function buildSkillsContent(
  initialContent: SkillsContent,
  levelById: Record<string, number>,
): SkillsContent {
  const groups = Array.isArray(initialContent.groups)
    ? (initialContent.groups as SkillGroup[])
    : [];

  const nextGroups = groups.map((group, gi) => {
    const items = Array.isArray(group.items) ? (group.items as SkillItem[]) : [];
    const nextItems = items.map((item, ii) => {
      const key = itemKey(gi, ii);
      if (Object.prototype.hasOwnProperty.call(levelById, key)) {
        return { ...item, level: levelById[key] };
      }
      return { ...item };
    });
    return { ...group, items: nextItems };
  });

  return { ...initialContent, groups: nextGroups };
}

export interface SkillsFormProps {
  sectionId: string;
  /** The section's current content (from TanStack Query — the source of truth). */
  initialContent: Record<string, unknown>;
  /** The owner's username, passed so the revalidate needs no extra round-trip. */
  username?: string;
}

export function SkillsForm({ sectionId, initialContent, username }: SkillsFormProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  // The groups/items snapshot (the source of truth from TanStack Query). The form
  // only EDITS the per-item level; names/tiers/icons are shown read-only (this is the
  // narrow D-10 input — full field editing is Phase 13.1).
  const groups = useMemo<SkillGroup[]>(
    () =>
      Array.isArray((initialContent as SkillsContent).groups)
        ? ((initialContent as SkillsContent).groups as SkillGroup[])
        : [],
    [initialContent],
  );

  // Edited levels keyed by `g{gi}i{ii}` — the ONLY mutable state (UI-local). The
  // string draft keeps the number input controlled while the user types; an empty /
  // non-numeric draft is treated as "no edit" so it falls back to the item's level.
  const [levelDrafts, setLevelDrafts] = useState<Record<string, string>>({});

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const dirty = saveState === 'dirty' || saveState === 'saving';

  // Mirror the dirty flag into the Zustand UI store (arms the CMS-07 guard).
  useEffect(() => {
    setDirty(saveState === 'dirty');
  }, [saveState, setDirty]);

  // Re-settle the success beat back to idle after ~2.2s.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = setTimeout(() => setSaveState('idle'), SAVED_BEAT_MS);
    return () => clearTimeout(t);
  }, [saveState]);

  /** The numeric level-edit map (drafts → integers), dropping empty/non-numeric drafts. */
  const levelById = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const [key, draft] of Object.entries(levelDrafts)) {
      if (draft.trim() === '') continue;
      const n = Number(draft);
      if (Number.isFinite(n)) out[key] = n;
    }
    return out;
  }, [levelDrafts]);

  function onLevelChange(key: string, value: string) {
    setLevelDrafts((d) => ({ ...d, [key]: value }));
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
  }

  /** The current displayed value for an item's level input (draft, else the item's level). */
  function displayLevel(key: string, item: SkillItem): string {
    if (Object.prototype.hasOwnProperty.call(levelDrafts, key)) return levelDrafts[key];
    const lvl = levelOf(item);
    return lvl === undefined ? '' : String(lvl);
  }

  /**
   * The canonical content save (mirrors SectionForm.doSave EXACTLY): rebuild the
   * WHOLE skills content with the edited levels, POST via saveSectionAction, and map
   * the result through the pure `mapSaveResult` (non-optimistic). Returns `{ ok }` so
   * the dirty guard's "Save and continue" (WR-01) can branch on success.
   */
  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saveState === 'saving') return { ok: false };

    setFieldErrors({});
    setBanner(null);
    setSaveState('saving');

    try {
      const content = buildSkillsContent(initialContent as SkillsContent, levelById);
      const result = await saveSectionAction({
        sectionId,
        type: 'skills',
        content,
        username,
      });

      const mapped = mapSaveResult(result);
      setSaveState(mapped.saveState);
      setFieldErrors(mapped.fieldErrors);
      setBanner(mapped.banner);
      return { ok: result.ok };
    } catch {
      setBanner(GENERIC_ERROR);
      setSaveState('dirty');
      return { ok: false };
    }
  }, [saveState, sectionId, initialContent, levelById, username]);

  // WR-01: register this panel's save so the dirty guard's "Save and continue"
  // performs a REAL save (and only navigates on a resolved ok save).
  useRegisterActiveSave(doSave);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doSave();
  }

  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormPanelHeader title="Skills" dirty={dirty} saveState={saveState} />

      {banner ? <Alert variant="error">{banner}</Alert> : null}

      <p className="text-[13px] leading-tight text-muted-foreground">
        Set each skill’s proficiency (0–100). The bar templates (like Edgerunner) use
        it; tier-label templates ignore it. Editing names &amp; tiers is coming soon.
      </p>

      {groups.length === 0 ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          No skill groups yet. Your existing content stays on your page.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group, gi) => {
            const items = Array.isArray(group.items) ? (group.items as SkillItem[]) : [];
            return (
              <fieldset key={gi} className="flex flex-col gap-3 border-0 p-0">
                <legend className="text-sm font-semibold text-foreground">
                  {str(group.label) || 'Skills'}
                </legend>
                {items.length === 0 ? (
                  <p className="text-[13px] leading-tight text-muted-foreground">
                    No skills in this group yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {items.map((item, ii) => {
                      const key = itemKey(gi, ii);
                      return (
                        <li key={key} className="list-none">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={LEVEL_MIN}
                            max={LEVEL_MAX}
                            step={LEVEL_STEP}
                            label={`${str(item.name) || 'Skill'} — proficiency (0–100)`}
                            value={displayLevel(key, item)}
                            onChange={(e) => onLevelChange(key, e.target.value)}
                            error={fieldErrors.level}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>
            );
          })}
        </div>
      )}
    </form>
  );
}
