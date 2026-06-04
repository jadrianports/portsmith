# `e2e/__source-reference__/` — the Phase-11 source-design parity slot (D-P10-04)

This directory is the **documented slot** for the operator's **source-design screenshots** —
the visual reference a Phase-11 ingested template must be translated to *faithfully*. Phase 10
ships the **slot + the convention**; Phase 11 **fills it and flips the skip**.

## Why this exists (the two parity tiers)

The visual-parity gate (`e2e/template-visual-parity.spec.ts`) has **two** purposes:

1. **Self-baseline (Phase 10, LIVE today).** Render every registered template over the
   src-side golden fixture via the stack-free `__fixture` route and commit a per-slug
   self-baseline (`e2e/__screenshots__/template-visual-parity.spec.ts/<slug>-golden.png`).
   This catches **drift** — any later pixel change to a template render re-fails the gate.
   It answers *"did this template render change from the last known-good?"*

2. **Source-design parity (Phase 11, the SLOT this dir documents).** When a template is
   **ingested** from an external source design (e.g. a Lovable / Figma export), the gate must
   also answer *"does the ingested render match the SOURCE design it was supposed to
   translate?"* — i.e. **translate, not redesign**. That requires a reference image of the
   *intended* design, which only the operator can supply. This directory holds those
   references.

The self-baseline proves a template is **stable**; the source reference proves it is
**faithful to its source**. A drift from either is a **finding the gate catches**, never a
render to silently trust (D-P10-02 / D-P10-04).

## The convention

| Item | Value |
|------|-------|
| File name | `<slug>-source.png` (e.g. `minimal-source.png`, `editorial-source.png`) |
| Content | The operator's source-design screenshot rendered at the **golden-fixture content** (same copy/images the `__fixture` `variant=full` render uses) so the diff is content-aligned. |
| Viewport | The **same viewport** Playwright captures with (the project default — full-page, `scale:'css'`, the founder's Win11 display). Capture the source design at that width so layout aligns. |
| Determinism | Same as the self-baseline: animations frozen, reduced-motion, fonts settled. The source screenshot should be a static, settled frame. |

> `minimal` and `editorial` are **bespoke, in-repo** templates (no external Lovable source
> design) — for them the **self-baseline IS the reference**, so no `*-source.png` is shipped in
> Phase 10. The first `*-source.png` arrives with the first **ingested** Phase-11 template.

## Phase 11: filling the slot

1. Drop the operator's `<slug>-source.png` into this directory.
2. In `e2e/template-visual-parity.spec.ts`, flip the `test.skip('<slug> — source-design
   parity …')` placeholder to a real test that renders the ingested template over the golden
   fixture and diffs against `../__source-reference__/<slug>-source.png` via
   `toHaveScreenshot` (the commented body in that `test.skip` is the template).
3. Tune the source-parity `maxDiffPixelRatio` if the source design and the rendered template
   differ in inherently-non-pixel-exact ways (anti-aliasing, sub-pixel font hinting) — a
   source-vs-render diff is looser than a self-baseline drift diff. Document the chosen
   threshold inline.

A non-trivial diff against the source ref is the **signal to fix the template** (it drifted
from its source design) — exactly the translate-not-redesign guard Phase 11 needs.
