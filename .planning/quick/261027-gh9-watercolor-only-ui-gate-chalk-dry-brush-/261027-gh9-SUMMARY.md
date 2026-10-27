---
phase: quick-261027-gh9
plan: 261027-gh9
subsystem: ui + watercolor-engine
tags: [preact, signals, module-switcher, watercolor, brush-presets, chalk, tdd]

requires: []
provides:
  - WATERCOLOR_ONLY seam with a clamped readStoredModule and a compare-then-write setActiveModule
  - Inert Brush/Krita switcher slots; Water color is the sole active module and no owner locks it
  - chalk dry-media BRUSH_PRESETS entry with a deterministic seeded Noise tip
affects: [module switching, Studio top bar, Brush tab catalog, Brush script hydration]

actuals:
  tokens: 11514
  tasks: 3
  commits: 4
plan_head_before: 24a2e17def60d4b84e6a5dfc5888c118f2b15d4c
plan_head_after: be27a4810c0215bed944ebd13e6c01c89fa19888

tech-stack:
  added: []
  patterns:
    - "One named boolean seam (WATERCOLOR_ONLY) gates a whole UI surface and is reversible by flipping one constant"
    - "Compare-then-write setter for a plain writable signal so every writer is idempotent"
    - "Procedural dry-media tip built only from the seeded Noise (worley tooth + fbm breakup + hard edge)"

key-files:
  created: []
  modified:
    - app/src/components/shared/activeModule.ts
    - app/src/components/shared/activeModule.test.ts
    - app/src/components/shared/frameModuleLock.ts
    - app/src/components/shared/frameModuleLock.test.ts
    - app/src/components/shared/ModuleSwitcher.tsx
    - app/src/components/shared/ModuleSwitcher.test.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - packages/efx-watercolor/src/playground/brushes.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts

key-decisions:
  - "D-01: ONE seam constant in activeModule.ts; init is always 'watercolor' and a stored 'brush' is neither read nor written"
  - "D-02: only the two production writers route through setActiveModule (ModuleSwitcher, Studio applyFrameModuleState)"
  - "D-04: frameScriptOwner still publishes 'brush'; the clamped module keeps brushModuleActive false so hydration refuses with reason 'watercolor'"
  - "D-06: chalk is preset-only — no engine, shader, simulation or brush-pack edit"

requirements-completed: []

coverage:
  - id: D1
    description: "Water color is always the initial and only writable module; a persisted or hand-edited 'brush' is ignored and never persisted"
    verification:
      - kind: unit
        ref: "app/src/components/shared/activeModule.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Brush-owned key never locks or switches the module; frameScriptOwner still resolves 'brush' for the DEV report and cached pixels render"
    verification:
      - kind: unit
        ref: "app/src/components/shared/frameModuleLock.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#declares ONE stable applyFrameModuleState callback with the owner rule"
        status: pass
    human_judgment: true
    rationale: "Live Studio behavior (selecting a Brush-scripted key keeps Water color unlocked and still paints its cached pixels) needs the user's native pass"
  - id: D3
    description: "Brush and Krita render as native-disabled inert slots; Water color is the only active slot and no lock disables it"
    verification:
      - kind: unit
        ref: "app/src/components/shared/ModuleSwitcher.test.tsx.test.ts"
        status: pass
    human_judgment: true
    rationale: "Greyed/disabled appearance and tooltips are visual judgments on the live toolbar and Studio top bar"
  - id: D4
    description: "The Brush tab offers Chalk, a dry grain-gated, water-free preset whose thumb paints and whose id replays through buildBrushForStroke"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm --dir packages/efx-watercolor run check && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor run build"
        status: pass
    human_judgment: true
    rationale: "The dry tooth/grain look with no wet bloom or pooling, plus survival through Move/transform/save-reopen/composite, is a visual judgment"

duration: 5min
completed: 2026-10-27
status: complete
---

# Quick 261027-gh9: Watercolor-only UI gate + Chalk dry-media preset

**Water color is now the only selectable module behind one reversible `WATERCOLOR_ONLY` seam, and the Brush tab gains a chalk preset whose seeded-worley tooth is dry, water-free and replay-deterministic.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-10-27T10:59:44Z
- **Completed:** 2026-10-27T11:04:37Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- `WATERCOLOR_ONLY` + `setActiveModule()` in `activeModule.ts`: init is always `watercolor`, a stored `'brush'` is never read, every write is clamped, and an unchanged write wakes no subscriber.
- `lockedModuleForOwner()` returns `null` for every owner under the seam (the ungated mapping stays behind its explicit second argument); both production writes (`ModuleSwitcher`, `PhysicsPaintStudio.applyFrameModuleState`) now route through the setter while `frameScriptOwner` keeps publishing `'brush'`.
- Brush joins Krita as a native-disabled inert slot with the `Unavailable — Water color only` tooltip; Water color is the only active slot and a passed lock can never disable it.
- `chalk` appended to `BRUSH_PRESETS`: worley cell-gap tooth, fbm cloud breakup, hard edge from r = 0.78, `water: 0`, `wetRound: 0`, `grain: 0.95`, `flow: 0.7`, `capacity: 0.5` — a preset-only change with no engine/shader edit.

## Task Commits

Each task was committed atomically (TDD: tests retargeted first, RED observed, then implementation):

1. **Task 1: watercolor-only seam + gated frame lock** - `e96f529f` (feat)
2. **Task 2: inert Brush/Krita slots + funnel through the setter** - `0582c716` (feat)
3. **Task 3: Chalk dry-media preset + 15-card catalog** - `fca9f598` (feat)
4. **Deviation fix: right-panel tab test pins the Brush module** - `be27a481` (test)

Plan metadata/docs commit is handled by the orchestrator after this summary (per the task contract, `.planning/` artifacts are not committed by the executor).

## TDD Evidence (RED → GREEN)

- **Task 1 RED:** `2 failed files | 5 failed, 11 passed` — missing `WATERCOLOR_ONLY`/`setActiveModule`, stored `'brush'` read, ungated lock mapping. GREEN: `16 passed`.
- **Task 2 RED:** `3 failed files | 10 failed, 315 passed` — switcher not gated yet, Studio funnel still assigning the signal directly, and the slim top-bar test still relying on the pre-seam `'brush'` default. GREEN: `325 passed`.
- **Task 3 RED:** `2 failed files | 9 failed, 20 passed` — the app resolves the package through `dist`, which still had 14 presets. After `pnpm --dir packages/efx-watercolor run build`: `29 passed`.
- **Package:** `run check` OK; `vitest run` 133 passed, 4 skipped; `run build` OK.

## Files Created/Modified

- `app/src/components/shared/activeModule.ts` — `WATERCOLOR_ONLY`, clamped `readStoredModule`, `setActiveModule`, clamped persistence.
- `app/src/components/shared/activeModule.test.ts` — stored `'brush'` ignored, setter clamp, no subscriber wake, storage never holds `'brush'`.
- `app/src/components/shared/frameModuleLock.ts` — `lockedModuleForOwner(owner, watercolorOnly = WATERCOLOR_ONLY)`; `null` for every owner by default.
- `app/src/components/shared/frameModuleLock.test.ts` — gated default + ungated explicit-false mapping; owner/brushMove/tooltip describes untouched.
- `app/src/components/shared/ModuleSwitcher.tsx` — inert Brush, constant active slot, seam outranks the lock, writes call `setActiveModule`.
- `app/src/components/shared/ModuleSwitcher.test.tsx` — gated interaction/lock matrix + hostile raw-`'brush'` test + source pins.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — funnel calls `setActiveModule(owner)`; `frameScriptOwner` publish and hydration expression unchanged.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — funnel slice pins `setActiveModule(owner);` and no `activeModule.value =`.
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` — both mock factories export `WATERCOLOR_ONLY`/`setActiveModule`; slim test pins the Brush branch.
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` — 47-UAT tab test pins the Brush branch (deviation, see below).
- `packages/efx-watercolor/src/playground/brushes.ts` — `chalk` preset with the seeded dry-media tip.
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` — header comment only (14 → 15).
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` — 15-card/paint-once counts + chalk thumb cache test.
- `app/src/components/physic-paint/view/aquarellePresetSelection.test.ts` — 15-id catalog order + chalk dry-media contract describe.

## Verification Results

- `pnpm --dir app exec vitest run` — **341 files passed, 2 skipped; 6249 tests passed, 1 skipped, 96 todo** (343 files).
- `pnpm --dir app run typecheck` — exit 0.
- `pnpm --dir app run build` — exit 0; largest chunk 1685.38 kB, under the unchanged 2000 kB `chunkSizeWarningLimit`/`assertProductionBundle` guard.
- Package: `check` exit 0, `vitest run` 133 passed/4 skipped, `build` success. `dist/` is gitignored and uncommitted.

## Decisions Made

- Followed D-01..D-07 exactly. `activeModule` stays a plain writable signal (30+ tests and every read path assign or peek it directly); the seam is a single constant plus a defaulted parameter.
- No engine/shader/simulation edit for chalk; the tip uses only the seeded `Noise` (`worley`, `fbm`, `smoothstep`). The D-06 STOP condition was not triggered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The top-bar slim test relied on the pre-seam 'brush' default**
- **Found during:** Task 2 (RED run)
- **Issue:** `PhysicsPaintTopBar.test.ts` "renders Brush size + Opacity…" rendered the real `activeModule`, whose default became `'watercolor'` under the seam, so the bar showed Pigment/Water/Edges/Grain.
- **Fix:** Pinned the raw module to `'brush'` for that branch test and restored it in a `finally`. No assertion changed.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts`
- **Verification:** Task 2 suite 18/18 green.
- **Committed in:** `0582c716`

**2. [Rule 3 - Blocking] The 47-UAT right-panel tab test relied on the pre-seam 'brush' default**
- **Found during:** Full app regression (after all three tasks)
- **Issue:** `PhysicsPaintRightPanel.test.ts` "keeps the manually selected tab across re-renders" clicked the Paint tab and expected the Brush `physics-edge-detail` stepper, which no longer renders by default.
- **Fix:** Pinned the raw module to `'brush'` inside that one test with a `finally` restore. No assertion changed. File was not in the plan's `files_modified` list — minimal test-only adaptation to the intended default change.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts`
- **Verification:** Suite 39/39 green; full app suite green.
- **Committed in:** `be27a481`

---

**Total deviations:** 2 auto-fixed (both blocking, both test-only)
**Impact on plan:** No production behavior beyond the plan; no scope creep, no dependency, no engine change.

## Issues Encountered

- `gsd_run` is not available in this executor environment (`gsd_run unavailable`), so the SDK state/commit verbs could not be used. Per the task contract, docs artifacts were left uncommitted (only code/test commits were made) and all commits were pathspec-scoped so the pre-staged `.planning/debug/` rename stayed untouched and uncommitted.
- Stale comments elsewhere still say "14-card" (`RightPanelBrushTab.tsx:3`, `panelSplitShell.test.tsx:323`). They are comments, not assertions, and were outside the plan's file list — left untouched.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model: the localStorage clamp (T-01) and the chalk replay path (T-02) are both pinned by the new tests, and no dependency was added (T-SC).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Automated-ready only — native visual UAT remains for the user (see the plan's five native rows): both windows always open in Water color (including with an old `'brush'` in localStorage), Brush/Krita greyed, a Brush-scripted key not switching or locking the module while its cached pixels render, and Chalk's dry tooth surviving navigation/transform/save-reopen/composite with existing watercolor flows unchanged.

---
*Quick: 261027-gh9*
*Completed: 2026-10-27*

## Self-Check: PASSED

- All 14 modified files exist.
- All 4 task commits are ancestors of HEAD.
