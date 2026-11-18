---
phase: 64-medium-engine
plan: 15
subsystem: physics-paint / aquarelle capture seam
tags: [aquarelle, pigment-coverage, coverage-export, pigment-alpha, lift-erase, capture, tdd, preact]

# Dependency graph
requires:
  - phase: 64-medium-engine (64-13)
    provides: the engine's pigment coverage channel — a Brush deposit composites ink/cover inside the pigment layer
  - phase: 64-medium-engine (64-14)
    provides: Lift destroys the same coverage with its own dabs; coverage and transmittance stay one mutation
provides:
  - `AquarelleExportBackground` gains `'pigment'` — the mode-4 coverage-aware compositor export
  - The capture handler exports the coverage sheet eagerly, guards it with `isFullyOpaqueRaster`, and feeds `mergeBlend: 'pigment-alpha'` while the ink gate, save path, clipboard and Lift stay on the transparent export
  - The rev-4 cover transaction, cover dab channel and deposit punch profile are DELETED from the app tree
  - `onResetSheetReady` is a one-argument reset again — both halves in one registration
  - `aquarelleCoverSeamContract.test.ts` proves the whole app seam: record-then-capture, punch-free brush path, single punch caller, medium record intact, MED-38 narrowed
affects: [64-16 (re-specifies the erase-model UAT rows), 64-17 (probe accepts crossCoverAlpha)]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized app diff)
actuals:
  tokens: 39000
  tasks: 3
  commits: 5
plan_head_before: 530d20efc036145e066d80f7b88602ca28571f14
plan_head_after: 799f82213

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two exports, two meanings: 'transparent' is the opaque transmittance sheet (ink gate, storage, save/clipboard, Lift); 'pigment' is the mode-4 coverage view whose real alpha is the coverage channel. A blank mode-4 sheet would read as maximum ink to the alpha-blind gate, so the two can never be swapped."
    - "Eager, guarded sheet split at capture: export the coverage sheet in the same turn as the transparent snapshot (before any await), and fall back to the transparent sheet when the export is null or unexpectedly fully opaque."
    - "Comment-stripped absence contracts: a deleted symbol's name may survive in prose, never in code — every absence pin runs on the stripped source."

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/engine/aquarelleEnginePort.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx
    - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
    - app/src/components/physic-paint/roto/aquarelleLiftPreview.ts
    - app/src/components/physic-paint/roto/aquarelleLiftPreview.test.ts
    - app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts
  deleted:
    - app/src/components/physic-paint/roto/aquarelleCoverFootprintParity.test.ts
    - app/src/components/physic-paint/roto/aquarelleLiftCoverageDeposit.test.ts

key-decisions:
  - "The merge slot keeps the field name `liveAlphaCanvas` while receiving the coverage canvas — the name is the merge API's slot; the STORED sheet remains the transparent export (save path, clipboard, ink gate, Lift all read `snapshot()`)."
  - "`LiftFootprintShape`'s deposit-only optional fields (`tipRotation`, `roughness`, `stampJitter`) were deleted with `coverShapeForBrush`, their only producer — the module carries only the Lift law."
  - "The punch call-site count is pinned at FIVE, not one: the Lift transaction has five `punchTransmittanceBytes` legs (recover, durable, composite, base, durable re-read). All five live inside `runAquarelleLiftErase`; the one-caller claim is about the transaction, not the call count."
  - "MED-38 is claimed only at the source level: exactly one `exportCanvas('pigment')` call site, the merge module's single `transmittanceSourceToPigmentAlpha` conversion, and none in the Studio. Live visual parity (screen vs export) stays UAT row 9 and is not claimed here."

patterns-established:
  - "Deletion-by-contract: rewrite the seam contract first (RED), then delete the architecture it names (GREEN); the contract's absence lists are the deletion checklist."
  - "A guard's evaluation and its fallback are pinned together: the `isFullyOpaqueRaster` call, its negation, and the `: liveAlphaCanvas` fallback are asserted as one window."

requirements-completed: [MED-22, MED-23, MED-38]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A covering brush stroke is an ordinary stroke: recorded through `recordAquarelleStrokeWhenEnabled` after the ledger allocation, committed through the shared `captureLivePixels` path, with no cover plan and no brush-side punch."
    requirement: MED-22
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#the cover seam is gone from the Studio > carries none of the deleted cover symbols"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#the brush path records then captures and never punches"
        status: pass
    human_judgment: false
  - id: D2
    description: "The commit consumes the coverage sheet end to end: `'pigment'` joins the export union, the capture handler exports it eagerly and guarded, and the merge keeps `pigment-alpha` with the transparent sheet still feeding the ink gate, save path and clipboard."
    requirement: MED-22
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#the capture seam exports the coverage sheet eagerly"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The cover preview and footprint plumbing is gone from the canvas stack and preview bus: no `onCoverDab`/`onAquarelleCoverDab`/`onApplied`, one-argument `begin`, one-argument reset registration, no deposit profile or `LiftDab.density`."
    requirement: MED-23
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#the cover preview and footprint plumbing is gone from the canvas stack"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftPreview.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Lift stays the only punch caller: five punch call sites, all inside `runAquarelleLiftErase`; tip laws byte-identical; preview and erase suites green."
    requirement: MED-22
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#the Lift transaction stays the only punch path"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The medium record is unchanged: `snapshotAquarelleRecord` still returns the per-stroke params bag, and `body` rides the one global key list like any other param."
    requirement: MED-23
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#the medium record is unchanged > records the per-stroke params bag and body like any other param"
        status: pass
    human_judgment: false
  - id: D6
    description: "MED-38 narrowed: one mode-4 program serves screen and commit — one `exportCanvas('pigment')` call site, the merge module's single transmittance-to-pigment conversion, none in the Studio. Live visual parity remains UAT row 9."
    requirement: MED-38
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#MED-38 (narrowed): one mode-4 program serves screen and commit"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-11-18
status: complete
---

# Phase 64 Plan 15: Medium Engine — the app seam deletes the cover punch and commits the coverage sheet

**A covering brush stroke is now an ordinary stroke committed through the shared capture of the engine's guarded mode-4 coverage export; the rev-4 cover transaction, cover dab channel and deposit punch profile are deleted, and the Lift remains the only punch caller.**

## Performance

- **Duration:** ~10 min (first RED artifact to summary)
- **Started:** 2026-11-18T18:45:30Z
- **Completed:** 2026-11-18T18:55:46Z
- **Tasks:** 3 (2 TDD, 1 proof task)
- **Files modified:** 14 (12 app-source, 2 TDD evidence records)

## Accomplishments

- `AquarelleExportBackground` gained `'pigment'`; the capture handler exports the coverage sheet eagerly beside the transparent snapshot, guards it with `isFullyOpaqueRaster`, and hands it to `mergeBlend: 'pigment-alpha'` under the unchanged `liveAlphaCanvas` slot — while the ink gate, stored sheet, save path, clipboard and Lift keep the transparent export.
- The rev-4 cover architecture is deleted, not disabled: `planAquarelleCoverErase`, `handleAquarelleCoverDab`, the 278-line `mode === 'cover'` punch branch, the cover dab/preview refs and the brush-side `runAquarelleLiftErase` are gone; the Lift dispatch is the one surviving call.
- The canvas stack carries no cover plumbing: no `onCoverDab`/`onAquarelleCoverDab`/`onApplied`, one-argument preview `begin`, one-argument `resetSheet` registration (both halves restored), and the punch library keeps only the Lift tip law.
- The app-wide seam is pinned by `aquarelleCoverSeamContract.test.ts` (18 tests): record-then-capture order, five punch sites all inside the Lift transaction, the post-ack swap channel unreachable, the medium record's params bag intact (including `body`), and MED-38's narrowed single-program claim.
- Two superseded suites deleted: `aquarelleCoverFootprintParity.test.ts` (its subject `coverShapeForBrush` is deleted; its tip-law coverage lives in `aquarelleLiftErase.test.ts`'s "the tip-shaped footprint" block) and `aquarelleLiftCoverageDeposit.test.ts` (its subject, the deposit punch profile, no longer exists).

## Task Commits

Each task was committed atomically (TDD tasks carry a RED then GREEN commit):

1. **Task 1: Commit consumes the coverage sheet; the cover transaction is deleted** — RED `7bc3cacd2` (test), GREEN `d5eb15b23` (feat)
2. **Task 2: Delete the cover preview and footprint plumbing from the canvas stack** — RED `7fa7b51a7` (test), GREEN `21c1da50d` (refactor)
3. **Task 3: Prove the whole app seam — no punch on the brush path, Lift untouched, medium record intact** — `799f82213` (test)

**Plan metadata:** the `docs(64-15): complete …` commit that carries this SUMMARY, STATE.md and ROADMAP.md.

## TDD Gate Compliance

- **Task 1 RED:** `.planning/phases/64-medium-engine/64-15-RED.json` — `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`; `targetTest` = "the cover seam is gone from the Studio > carries none of the deleted cover symbols"; the replacement contract failed on the absent implementation (7 tests, 5 failing), not on collection or fixture faults. Record committed in `7bc3cacd2`.
- **Task 2 RED:** `.planning/phases/64-medium-engine/64-15-TASK2-RED.json` — `RED_EVIDENCE_OK`; `targetTest` = "the cover preview and footprint plumbing is gone from the canvas stack > carries no cover dab channel and no cached-base-applied hook"; failures were exactly the planned plumbing pins plus the inverted CanvasMount `onApplied=` pin. Record committed in `7fa7b51a7`.
- **GREEN:** Task 1 `d5eb15b23`, Task 2 `21c1da50d`. Task 3 is `type="auto"` without `tdd`.

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — coverage export + guard in the capture handler; capture slot receives the coverage canvas; entire cover transaction (plan, dab handler, cover punch branch, dispatch) deleted; cover-only refs and cached-base-applied handler deleted; reset registration one-argument; Lift imports/tests unchanged.
- `app/src/components/physic-paint/engine/aquarelleEnginePort.ts` — `AquarelleExportBackground` gains `'pigment'` with the two-meanings doc block.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — `onCoverDab` prop/ref/forwarding and `strokeGeneration` deleted; `onResetSheetReady` reduced to `(resetSheet) => void`; reset's local implementation (session end + pixel wipe) intact.
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` — cover props and refs deleted; cached base mounts without `onApplied`; one-argument reset forwarding.
- `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` — `profileRef` and the deposit branch gone; one decode per URL and the tip shape resolution intact; no `onApplied` prop.
- `app/src/components/physic-paint/roto/aquarelleLiftPreview.ts` — one-argument `begin`, no profile, no `density` on the dab.
- `app/src/components/physic-paint/roto/aquarelleLiftErase.ts` — `CoverBrushSelection`, `coverShapeForBrush`, `LiftCoverageProfile`, `LiftDab.density`, the deposit branches, `stampJitterUv` and `smoothstep01` deleted; tip laws byte-identical.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — mount-wiring pin inverted to the ABSENT `onApplied`/`onAquarelleCachedBaseApplied` channel (comment-stripped); four-argument reset pins updated to the one-argument contract; cached-base URL pins unmoved.
- `app/src/components/physic-paint/roto/aquarelleLiftPreview.test.ts` — the one-argument `begin` assertion strengthened to the exact call.
- `app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts` — the plan's central contract: four absence/plumbing describes plus the Task 3 cross-file proofs.
- Deleted: `aquarelleCoverFootprintParity.test.ts`, `aquarelleLiftCoverageDeposit.test.ts` (coverage notes above).

## Decisions Made

- The merge slot keeps the field name `liveAlphaCanvas` while receiving the coverage canvas; the stored sheet stays the transparent export. The name is the merge API's slot, and swapping the canvases would read a blank mode-4 sheet as maximum ink to the alpha-blind gate.
- `LiftFootprintShape`'s deposit-only optional fields were deleted with their only producer (`coverShapeForBrush`); nothing else read them (verified app-wide before removal).
- The punch call-site pin is FIVE (all inside `runAquarelleLiftErase`), not one — the Lift transaction has five punch legs; the contract pins both the total and the containment.
- MED-38's automated claim stops at the source wiring; the live visual parity is explicitly left to UAT row 9.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The Studio's reset-contract pins were updated beside the mount-wiring pin**
- **Found during:** Task 2 (delete the cover plumbing)
- **Issue:** The plan's Task 2 action named only the `onApplied` mount-wiring pin, but `PhysicsPaintStudio.test.ts` also positively asserted the four-argument reset registration and the layer's `strokeGeneration` forwarding — the exact contract this task deletes (and the task's own `fails_when` names the four-argument registration as a failure).
- **Fix:** Replaced those assertions with the one-argument contract (`onResetSheetReady?: (resetSheet: () => void) => void;`, `onResetSheetReadyRef.current?.(resetSheet);`, the mount's one-argument forwarding, and the Studio handler signature), keeping the same test's flow assertions.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Verification:** Task 2 gate green (532 tests / 6 files, typecheck clean); the seam contract independently pins the same one-argument form.
- **Committed in:** `21c1da50d` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] A first-draft seam assertion contradicted the mandated field-name preservation**
- **Found during:** Task 1 RED authoring
- **Issue:** The initial contract draft asserted the capture call does not contain `liveAlphaCanvas`, but the plan mandates the merge slot keeps that field name (`liveAlphaCanvas: liveCoverageCanvas,`).
- **Fix:** Corrected the assertion to pin the exact slot literal before the RED evidence was finalized.
- **Files modified:** app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts
- **Verification:** RED evidence accepted (`RED_EVIDENCE_OK`); the pin now asserts the mandated literal.
- **Committed in:** `7bc3cacd2` (Task 1 RED commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both were corrections of the plan's own test surface to the contract it mandated; no scope creep, no architecture change.

## Issues Encountered

- The TDD RED classifier's JUnit identity is the full `describe > test` name, not the leaf test name; a leaf-name `targetTest` returned `INVALID_RED (no_target_test_failure)` until the describe prefix was included.
- RED evidence was recorded in JUnit (both records ~235–990 KB because the reporter embeds source dumps); no truncation was applied so the machine verification stays exact.
- Both gates ran against the known load-sensitive `physicPaintBridge.test.ts` flake noted in the dispatch's known state; it is outside this plan's gate chain and was not modified.

## User Setup Required

None — no external service configuration required.

## UAT

**No UAT row was answered by this plan.** Rows 2, 7 and 8 still encode the deleted erase model and are re-specified by 64-16. The plan's final gate verified `64-UAT.md` is untouched (`git status --porcelain` empty for that path). The narrowed MED-38 visual parity remains UAT row 9.

## Next Phase Readiness

- The app tree carries no cover punch; the coverage sheet is committed through the ordinary capture with the guard and the transparent fallback pinned.
- 64-16 can re-specify the erase-model UAT rows knowing the erase path is a plain Lift; 64-17's probe can accept `crossCoverAlpha` on the same mode-4 export this plan wires.
- No blockers.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-18*

## Self-Check: PASSED

