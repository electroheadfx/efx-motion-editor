---
phase: quick-261017-w4x
plan: 261017-w4x
subsystem: ui
tags: [preact, physic-paint, watercolor, aquarelle, top-bar, tool-rail, opacity, dry]

requires:
  - phase: 56
    provides: WatercolorModuleSection / PhysicsPaintRightPanel paint-tab shell and the D-15 aquarelle Dry record seam
provides:
  - Paint tab shows settings only (Water color label + AquarelleParamsPanel + BrushesDocker)
  - Top-bar Opacity call-time module router (watercolor -> aquarelleParams.load, else settings.opacity)
  - Dry reachable only from the left vertical tool rail (D-15 record seam preserved)
affects: [phase-55-issues I-05 I-06 I-10, physic-paint right panel, physic-paint studio top bar]

actuals:
  tokens: 6263
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Call-time module router in topBarPropsMemo (activeModule.value read inside the handler, never a memo dep) — mirrors the existing onBrushSizeChange branch"
    - "Negative source scans strip comments (`stripComments` idiom) so docs naming a moved seam never trip the pin"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/WatercolorModuleSection.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
    - app/src/components/physic-paint/view/aquarelleDryWiring.test.ts
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx

key-decisions:
  - "Top-bar Opacity routes at call time by activeModule: watercolor writes aquarelleParams.load (Pigment) so the Paint-tab Opacity deletion does not orphan Pigment before I-01 lands; Brush mode keeps settings.opacity"
  - "SectionLabel import dropped from PhysicsPaintRightPanel.tsx — its only use was inside the deleted shared block (plan claimed it remained used elsewhere; its own drop-now-unused-imports rule applied)"
  - "Dry pins target the control (data-testid / button label / emit helper), not the bare 'Dry' substring — the 'Dry rate' param slider in AquarelleParamsPanel keeps that substring alive"

patterns-established:
  - "Control-scope pins: assert on testid/button-label/emit-helper, never a bare label substring that a sibling param can also match"

requirements-completed: [I-05, I-06]

coverage:
  - id: I-05
    description: "Opacity is top-bar only for every paint mode; Paint tab has no Opacity row (Q3)"
    requirement: I-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#Paint tab branch has no Opacity option-group and starts at the MODULE-ONLY switch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#onOpacityChange routes watercolor to setAquarelleParam('load') and else to setBrushOpacity"
        status: pass
    human_judgment: true
    rationale: "Routing correctness is pinned by source-scan, but the visible Pigment/opacity response in the live Studio needs a human pass"
  - id: I-06
    description: "Paint tab (watercolor) shows settings only; Dry lives only in the left vertical tool rail (Q4)"
    requirement: I-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/panelSplitShell.test.tsx#watercolor shell is settings only: no tool row, no Dry button"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleDryWiring.test.ts#the Dry button uses the CSS class carrying :active, not inline styles"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleToolRow.test.tsx#rail click path emits the record-path Dry event"
        status: pass
    human_judgment: true
    rationale: "Rail-only Dry and the recorded script seam must be judged live (click Dry, confirm flash-dry + replay)"

duration: 11min
completed: 2026-10-17
status: complete
---

# Quick 261017-w4x: I-05 + I-06 Paint tab shows settings only Summary

**Paint tab de-duplicated to settings only — Opacity is top-bar-only with a call-time Pigment/brush router, and Dry is rail-only with the D-15 record seam intact.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-17T21:16:21Z
- **Completed:** 2026-10-17T21:27:14Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Deleted the Paint-tab shared wrapper + Opacity option-group (Q3); the paint-tab branch now starts at the MODULE-ONLY switch.
- Wired the top-bar `onOpacityChange` call-time router (watercolor → `setAquarelleParam('load')`, else `setBrushOpacity`) so Pigment is not orphaned before I-01.
- WatercolorModuleSection is now label + params + brushes; the tool row and bottom Dry button left the Paint tab (Q4).
- Dry is reachable only from the left rail `WatercolorRail`; `emitAquarelleDry(aquarelleRecordClock())` semantics (D-15) unchanged and byte-untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: I-05 — Opacity top-bar only (Q3)** - `d461fb9b` (feat)
2. **Task 2: I-06 — watercolor tools leave the Paint tab; Dry only in the left rail (Q4)** - `7ef4671b` (feat)

_Note: TDD RED evidence for both tasks is persisted at `red-evidence-task1.json` / `red-evidence-task2.json` in this directory. Per the plan's locked output spec ("two atomic commits"), tests + implementation landed in one commit per task rather than separate test/feat commits._

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - paint-tab branch loses the shared wrapper + Opacity option-group; drops now-unused `aquarelleParams`/`setAquarelleParam`/`SectionLabel` imports
- `app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` - shared-block anchors rewritten to the post-I-05 shape (negative region scan + MODULE-ONLY-first)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `onOpacityChange` becomes the call-time module router beside `onBrushSizeChange`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - pins the `onOpacityChange` watercolor/else arms and the no-activeModule-memo-dep invariant
- `app/src/components/physic-paint/view/WatercolorModuleSection.tsx` - body is SectionLabel + AquarelleParamsPanel + BrushesDocker
- `app/src/components/physic-paint/view/AquarelleToolRow.test.tsx` - Dry cases retarget to the rail Dry wiring; unit cases unchanged
- `app/src/components/physic-paint/view/aquarelleDryWiring.test.ts` - class/emit pin retargets to `PhysicsPaintToolRail.tsx`; record-seam pins unchanged
- `app/src/components/physic-paint/view/panelSplitShell.test.tsx` - shared-label case asserts settings-only paint-tab; new module-section settings-only pin

## Decisions Made
- **Call-time opacity router mirrors Brush size:** `activeModule.value` is read inside the handler, never captured in the topBar memo deps — same locked pattern as `onBrushSizeChange`.
- **SectionLabel import dropped** (see deviations).
- **"Dry" pins target the control, not the substring** — `AquarelleParamsPanel` keeps a "Dry rate" slider, so a bare `not.toContain('Dry')` would self-invalidate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SectionLabel import left behind after the shared-block deletion**
- **Found during:** Task 1 (I-05)
- **Issue:** The plan stated `SectionLabel` "remains used elsewhere in the file — keep them", but its only use in `PhysicsPaintRightPanel.tsx` was inside the deleted shared block. Keeping it would leave a dead import.
- **Fix:** Dropped `SectionLabel` alongside `aquarelleParams`/`setAquarelleParam`, per the plan's own "drop now-unused imports from that file if nothing else references them" rule.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`
- **Commit:** `d461fb9b`

**2. [Rule 1 - Bug] Bare `Dry` substring pins would self-invalidate on the "Dry rate" param**
- **Found during:** Task 2 (I-06) RED
- **Issue:** Two retargeted pins used `not.toContain('Dry')` on the materialized module tree; `AquarelleParamsPanel` renders a "Dry rate" slider, so those pins would stay red even after the Dry button left.
- **Fix:** Retargeted to the Dry control itself (`data-testid="aquarelle-dry"` / button label `Dry` / `emitAquarelleDry` helper), and comment-stripped the negative source scans so the doc that names the rail seam never trips them.
- **Files modified:** `app/src/components/physic-paint/view/AquarelleToolRow.test.tsx`, `app/src/components/physic-paint/view/aquarelleDryWiring.test.ts`, `app/src/components/physic-paint/view/panelSplitShell.test.tsx`
- **Commit:** `7ef4671b`

### Process notes
- `gsd_run check tdd-red-evidence` is not available in this `gsd-tools` build (subcommand missing from `check`). RED runs were captured as TAP reports with semantic assessment in `red-evidence-task1.json` / `red-evidence-task2.json` — same evidence-file pattern as 261017-vcn. Both RED runs failed on the planned target assertions for the planned reasons before any implementation edit.

## Known Stubs
None.

## Threat Flags
None — no new network endpoints, auth paths, file access, or trust-boundary schema changes. The `onOpacityChange` router mitigation (T-261017-W4X-01) is pinned in `PhysicsPaintStudio.test.ts`; the shared-wrapper over-delete guard (T-261017-W4X-02) is pinned in `physicsPaintRightPanelPaperSingleHome.test.ts`; the Dry entry-point guard (T-261017-W4X-03) is pinned in `aquarelleDryWiring.test.ts` / `AquarelleToolRow.test.tsx` against the byte-untouched rail.

## Live UAT Checklist (user-run — status stays automated-ready until these pass)

**I-05 — Opacity top-bar only (Q3)**
1. Open Water color → Paint tab: settings only (Water color label + param sliders + brushes docker). No Opacity row.
2. Move the top-bar Opacity slider in watercolor mode → Pigment (Load) responds and the stroke deposit follows.
3. Switch to Brush mode → the same top-bar slider drives paint opacity.
4. Track tab still shows per-track Opacity; onion opacity still works; top-bar Opacity slider still present.

**I-06 — tools leave the Paint tab; Dry rail-only (Q4)**
5. Paint tab shows no Brush/Water/Pen/Lift row and no Dry button.
6. Left rail shows Brush | Water | Pen | Lift | Dry. Click Dry → sheet flash-dries and the action is recorded in the script (replay re-applies it). Console clean.

## Self-Check: PASSED
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — FOUND (commit `d461fb9b`)
- `app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` — FOUND (commit `d461fb9b`)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — FOUND (commit `d461fb9b`)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — FOUND (commit `d461fb9b`)
- `app/src/components/physic-paint/view/WatercolorModuleSection.tsx` — FOUND (commit `7ef4671b`)
- `app/src/components/physic-paint/view/AquarelleToolRow.test.tsx` — FOUND (commit `7ef4671b`)
- `app/src/components/physic-paint/view/aquarelleDryWiring.test.ts` — FOUND (commit `7ef4671b`)
- `app/src/components/physic-paint/view/panelSplitShell.test.tsx` — FOUND (commit `7ef4671b`)
- `d461fb9b` — FOUND (ancestor of HEAD)
- `7ef4671b` — FOUND (ancestor of HEAD)
- `AquarelleToolRow.tsx` still on disk — FOUND
- Guardrail audit: `git diff SPECS/` empty; `git diff PhysicsPaintToolRail.tsx` empty; `git diff app/package.json app/vitest.config.ts` empty; `git diff packages/efx-watercolor/src/playground/` empty; `physics-track-opacity` + `physics-onion-opacity` still present
