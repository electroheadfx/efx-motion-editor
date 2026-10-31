---
phase: 261031-cf9
plan: 01
subsystem: paint
tags: [watercolor, paint-seed, determinism, undo-ledger, preact-signals, tdd]

# Dependency graph
requires:
  - phase: quick-261024-p5q
    provides: the stroke appearance patch, the watercolor geometry/stack/paint dialog shell and the before/after edit ledger doors
  - phase: quick-261023-l35
    provides: the restore path that rebuilds every decoded event through the ONE toStudioStroke projection
provides:
  - persisted `paintSeedSalt` reserved host key folded into `traceSeed` by the ONE engine-2 projection
  - salt write on all five commit doors and the frame-scoped Rebake re-roll, each inside a stored undoable edit
  - watercolor Geometry "Paint seed variation" switch row using the shared script-switch chrome
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reserved host param key inside the open canonical engine.params bag; engine-2 projections stay inert to it"
    - "Deterministic seed mixing via hashMutationId + mixStrokeSeed only (no Math.random/clock/module state)"
    - "Salt mutations minted inside the before/after ledger pair; OFF path returns 0 with no revision bump"
    - "Render-body ref write carries the edit recorder to a handler declared above the history hook"

key-files:
  created:
    - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
    - .planning/quick/261031-cf9-add-a-paint-seed-variation-switch-to-the/red-evidence-task1.json
    - .planning/quick/261031-cf9-add-a-paint-seed-variation-switch-to-the/red-evidence-task2.json
    - .planning/quick/261031-cf9-add-a-paint-seed-variation-switch-to-the/red-evidence-task3.json
  modified:
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts

key-decisions:
  - "Fold the salt into `traceSeed` in `toStudioStroke` only — `configure()` already applies `stroke.traceSeed`, so the adapter is untouched"
  - "Keep `paintSeedSalt` inside the open `engine.params` record (zero format change) and never add it to AQUARELLE_GLOBAL_KEYS, so sliders cannot write it"
  - "Toggling ON writes salt 0, then the door's own bump performs the first re-roll (0 -> 1), making the switch immediately visible"
  - "Rebake mints its re-roll edit after the durable-base recovery, records only after a successful re-bake, and restores the edit on failure"
  - "The switch is the FIRST Geometry child, watercolor-only, with its own 15px padding above and below; ON is derived from the salt, never a second boolean"

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 15058
  tasks: 3
  commits: 7
  plan_head_before: eb89d7789bafc4c54d8bc5b30e95bc5d1c028b4a
  plan_head_after: 2a4c764af0a97e6138296e4dbebd2911e2d8861a

# Metrics
duration: 11min
completed: 2026-10-31
status: complete
---

# Quick 261031-cf9: Paint seed variation switch Summary

**Persisted `paintSeedSalt` folded into `traceSeed` by the one projection, re-rolled on every commit door and the Rebake action, and driven by a watercolor Geometry switch**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-31T08:10:33Z
- **Completed:** 2026-10-31T08:21:35Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `toStudioStroke` now folds a persisted `paintSeedSalt` through `mixStrokeSeed(hashMutationId(id), salt)`; absent or malformed salt reproduces today's exact seed, and the key survives the payload codec round-trip while staying engine-inert.
- All five commit doors (move, appearance, transform, stack step, stack place) advance the salt of ON strokes before their `after` snapshot, so undo restores the previous texture; the OFF path returns 0 with no revision bump and byte-identical seeds.
- `beginAquarellePaintSeedRerollEdit` + the Rebake handler re-roll the edited frame as one undoable edit, minted after the durable-base recovery and recorded only on a successful re-bake, with rollback on failure.
- The watercolor Geometry tab leads with the shared Script-switch chrome ("Paint seed variation"), OFF by default, committing the whole selection in one `applyAppearance` call; the brush module shows nothing new.

## Task Commits

Each TDD task was committed atomically (test -> feat):

1. **Task 1: Persisted salt -> deterministic traceSeed** - `8aee9eecb` (test), `ba3cf74b0` (feat)
2. **Task 2: Salt writes on every commit door + Rebake** - `6c373e39d` (test), `746c0aad9` (feat)
3. **Task 3: The switch row** - `71bd60ae8` (test), `e5f4b3516` (feat), `2a4c764af` (test: CSS out of source pins)

**Plan metadata:** not committed by the executor (orchestrator owns the docs commit).

## Files Created/Modified

- `packages/efx-watercolor/src/payload/toStudioStroke.ts` - reserved key, `paintSeedSaltOf`, salted `traceSeed`
- `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` - projection, helper, persistence pins
- `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` - additive salted acceptance pin
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` - flag patch, `bumpAquarellePaintSeedSalts`, frame-scoped bump
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` - door bumps + `beginAquarellePaintSeedRerollEdit`
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - `readPaintSeedVariation`, `buildPaintSeedVariationPatch`, patch field
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - first Geometry switch row
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Rebake wiring + recorder ref
- `app/src/components/physic-paint/physicsPaintStudio.css` - in-sheet switch margin reset
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` - script/door/reroll salt pins
- `app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts` - salted restore pins
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - model and switch-row pins

## Decisions Made

- Fold the salt in `toStudioStroke` only; the adapter's `configure()` already applies `traceSeed`, so no adapter change was needed.
- The salt lives inside the open `engine.params` record (AQTL's open sorted record), so no format version bump and the restore path rebuilds the seed for free.
- ON writes 0 and the door bump produces the first re-roll; already-ON targets are skipped and OFF deletes the key, keeping the OFF path free.
- The Rebake edit is minted after `ensureAquarelleDurableBaseRef` (recovery can bump the revision) and recorded through a render-body ref after a successful re-bake.
- The switch reuses `LiftEditSwitch`'s markup exactly and neutralizes the top bar's 12px margin only inside the sheet.

## Deviations from Plan

None affecting implementation - the plan was executed as written.

Two test-authoring adjustments (no behavior change):
- The plan asked to assert the switch precedes `stroke-settings-geometry-opacity`; watercolor renders no Opacity row, so the test asserts precedence over X/Y/Scale/Rotation instead.
- An initial CSS source pin was removed per the plan's explicit "keep `physicsPaintStudio.css` out of source pins; the component tree is the evidence".

## Issues Encountered

- A test-local TS cast (`childrenOf` returns `unknown`) failed typecheck; fixed with an explicit `AnyVNode` cast in the GREEN commit range (`2a4c764af`).
- Vitest RED evidence for Task 2 and Task 3 was validated with `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK`, target test failed on its planned assertion each time).

## Verification

- Watercolor package suite: **187 passed / 8 skipped**, and `pnpm --filter @efxlab/efx-watercolor build` rebuilt `dist` after Task 1.
- Full app suite: **359 files passed, 6571 passed / 1 skipped / 96 todo**, zero regressions.
- Typecheck: clean (`tsc --noEmit`).
- OFF byte parity: every pre-existing adapter/move/codec/restore pin passes with unmodified assertions; no existing fixture gained a salt.
- Off-limits files untouched: `aquarelleBake.ts`, `roto/*PhysicalModel*`, `script_library.rs` are absent from the diff.
- No dependency added; bundle remains under the 2000 kB ceiling (index 1,581.32 kB, PhysicsPaintStudio 961.59 kB).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated work is complete; live Studio UAT rows 1-9 from the plan remain pending (the executor never starts the dev server). Row 8 (toggle OFF -> pixel-for-pixel pre-change paint) is the OFF-regression gate; rows 4-6 are the re-roll gate.
- The three `red-evidence-task*.json` files sit untracked in this quick directory for the orchestrator's docs commit.

---
*Plan: quick 261031-cf9*
*Completed: 2026-10-31*

## Self-Check: PASSED

- All implementation files and the SUMMARY exist on disk.
- All seven task commits (`8aee9eecb`, `ba3cf74b0`, `6c373e39d`, `746c0aad9`, `71bd60ae8`, `e5f4b3516`, `2a4c764af`) are ancestors of HEAD.
- Full package and app suites green; typecheck clean.
