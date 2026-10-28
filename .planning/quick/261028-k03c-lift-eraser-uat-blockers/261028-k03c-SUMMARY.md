---
phase: quick-261028-k03c
plan: 261028-k03c
subsystem: physic-paint
tags: [watercolor, lift, eraser, roto, script-recovery, durable-base, footprint, cursor, tilt, persistence]

# Dependency graph
requires:
  - phase: quick-261028-k03
    provides: the three-state Lift pipeline (pointerdown gate, punch module, physical-edit commit, live preview)
  - phase: quick-261028-k03b
    provides: script-authoritative scripted Lift, the recorded tip/punch shape seam, Lift strength and Select lifts
  - phase: quick-261027-klx
    provides: the ONE watercolor engine (liftFS, Engine.lift, brush presets) and the cached-base display
  - phase: 52.1
    provides: captureLivePixels / flushLivePixels and the physical-edit transaction
provides:
  - pigment-alpha base recovery for legacy scripted keys (fail-closed at 3/255, session-lifetime failure memo)
  - a single-punch-per-transaction law with the recovery arm owning the punch
  - raster erase durability (one retry, strokes-revision bump + markDirty, per-(track, frame) settle-capture fence)
  - a shared footprint law (radius/aspect/angle) and a cursor that renders the engine's true footprint
  - Lift tip selection separate from the Brush tip, Filbert default, restored sidebar Brush tab
affects: [physic-paint, roto-scripts, watercolor-engine, uat]

actuals:
  tokens: 46080
  tasks: 3
  commits: 4
  plan_head_before: 86c910c16c51dd0d70d2f3f3ab9edebf780b2b64
  plan_head_after: 3690114aa1d97fb9ddda9d1f473c779a0a001c12

tech-stack:
  added: []
  patterns:
    - "Pigment-alpha inversion: S = a·C + (1−a)·255, P = a·C + (1−a)·B, so B = (P − (S − min S)) / (1 − a); validated by recomposition at ≤3/255 mean RGB error"
    - "Single-punch law: mutually exclusive recover/durable arms, exactly one punchTransmittanceBytes per lift transaction"
    - "Fail-closed recovery: the just-recorded event is deleted, the sheet session dropped and the preview reverted on any failure; a session-lifetime memo refuses a failed key without re-baking"
    - "Durable write ordering: set the map -> bumpAquarelleStrokesRevision() -> markDirty(), because markDirty no-ops on an unchanged signature"
    - "Capture fence keyed on the exact (track, frame) the lift owns; set before the first await, cleared in finish()"
    - "One footprint law shared by engine, punch and cursor, property-tested against buildBrushForStroke/toEngineParams rather than copied constants"

key-files:
  created:
    - app/src/components/physic-paint/view/LiftShapePicker.tsx
    - app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts
    - app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts
    - app/src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts
    - app/src/components/physic-paint/engine/aquarelleFootprint.ts
    - app/src/components/physic-paint/engine/aquarelleFootprint.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/RightPanelBrushTab.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
    - app/src/components/physic-paint/roto/aquarelleLiftPreview.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts

key-decisions:
  - "The recovery arm OWNS the transaction's punch; the pre-existing scripted punch lives in the else arm so t^(K·K) is structurally impossible"
  - "A failed recovery is remembered for the whole session (never cleared on frame/track change), so a legacy key that cannot be recovered is refused at the preflight without repeating the bake"
  - "The raster commit retries exactly once (a settle race, not a lease rejection), and both diagnostics carry the attempt count"
  - "The revision bump is the load-bearing write before markDirty on every durable write, including the seed and the punched rewrite"
  - "The cursor is drawn from the same footprint module the engine mirrors (tip, overrides, tilt azimuth, rounded-rect/ellipse branch), scaled by the displayed rect height"
  - "The controller's bake was split into bakeAquarelleEventsToFrame; Apply now publishes after disposal because the baked bytes are self-contained"

patterns-established:
  - "Recover-then-punch: adopt a validated recovered base durably, then punch it once in the same transaction"
  - "A settle capture that would merge pre-erase bytes is skipped by (track, frame), never globally suppressed"
  - "Cursor geometry is computed, never hand-tuned: one pure law, a CSS size helper, and the engine's own mirrored rotation"

requirements-completed: []

coverage:
  - id: D1
    description: "A legacy scripted frame (empty durable-base section) lifts visibly: the base is recovered from the displayed composite plus a raw bake, the script event stays, deleting it restores the script paint, Apply re-erases, pre-script raster paint outside the lift survives"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts#recoverBase lift owns its single punch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#261028-k03c pins the legacy scripted base recovery"
        status: pass
    human_judgment: true
    rationale: "Only a live frame can confirm the erase is visible on the real legacy project, that the scripted event survives navigation and that deleting it restores the exact pre-lift script paint."
  - id: D2
    description: "A failed recovery is fail-closed: the just-recorded event is removed, the sheet session dropped, the preview reverted, the unknown-base copy published, and a diagnostic carries reason/meanError"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts (validation at 4/255, decode, recombine, encode failures)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts#failed recovery erases nothing"
        status: pass
    human_judgment: true
    rationale: "The failure path is proven structurally, but the visible refusal copy and the absence of a ghost erase are native-UI judgments."
  - id: D3
    description: "A raster-only lift survives leave/return, Studio close/reopen and project close/reopen with Script ON and OFF: the punched key payload, not a stale settle capture, is what a return loads"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts#raster commit retries once and survives leave/return"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts#settle capture for the lift-owned (track, frame) is fenced"
        status: pass
    human_judgment: true
    rationale: "Reopen behaviour crosses the cache/persistence boundary; only a native close/reopen can prove the punched payload is what loads."
  - id: D4
    description: "The cursor is the engine footprint: true size and shape for pen and mouse on Brush, Water, Pen and Lift (rotated ellipse or rounded rect, fixed-rotation tilt azimuth), hidden in select/move, crosshair under 8 px"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleFootprint.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts#the ring IS the engine footprint"
        status: pass
    human_judgment: true
    rationale: "Size, shape and rotation alignment with the painted footprint is a visual judgment, including the pen-tilt azimuth."
  - id: D5
    description: "The sidebar Brush tab is restored and shares one state with the top bar and floating modal: catalog, Size, the seven globals, the eight response multipliers, Lift shape/strength/Select lifts"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/panelSplitShell.test.tsx#Brush tab is the catalog + response multipliers again"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Lift owns its tip (default Filbert): a Lift pick never flips the tool nor mutates the Brush selection, and the live pass, the recorded brushId and the bake use that one tip"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts"
        status: pass
    human_judgment: false

duration: unknown (multi-session executor)
completed: 2026-10-28
status: complete
---

# Quick 261028-k03c: Lift (eraser) UAT blockers — Summary

**Legacy scripted lifts now recover their pre-script base through a validated pigment-alpha inversion, raster erases survive leave/return via a revision bump and a capture fence, and the cursor renders the engine's true tip footprint (Filbert default, sidebar Brush tab restored)**

## Performance

- **Duration:** multi-session executor run (Tasks 1-2 in the first session, Task 3 resumed after a context compaction; no single start timestamp survived)
- **Completed:** 2026-10-28
- **Tasks:** 3 / 3
- **Commits:** 4 (measured: `git rev-list --count 86c910c1..HEAD`)
- **Files modified:** 29 (`git diff --stat 86c910c1..HEAD`)
- **Realized diff:** 2,699 insertions / 239 deletions (≈ 184.3 kB ≈ 46.1 k estimate-tokens at chars/4) against the plan's 78 k estimate

## Accomplishments

- **D1 — legacy scripted recovery.** `aquarelleBaseRecovery.ts` inverts the pigment-alpha law per pixel (`B = (P − (S − min S)) / (1 − a)`), validates by recombining `S` over `B` with `mergeRotoAlphaCanvases(..., 'pigment-alpha')` at a 3/255 mean RGB error, and is node-pure behind an injected codec. `planAquarelleLiftErase` routes `scripted && !has(keyId)` to `recoverBase: true` instead of refusing.
- **D2 — fail-closed, single punch.** The recovery arm seeds the recovered base, bumps the strokes revision, `markDirty`s, then owns the transaction's ONE punch; the pre-existing scripted punch lives in the exclusive `else` arm. On any failure the just-recorded event is deleted, the sheet session reset, the preview reverted, the unknown-base copy published, and a session-lifetime memo refuses the key without re-baking.
- **D3 — raster durability.** The commit closure is retried once (`attempts` in both diagnostics), the durable map write is followed by `bumpAquarelleStrokesRevision()` + `markDirty()`, and a settle capture for the exact (track, frame) the lift owns is fenced with a `lift-in-flight` diagnostic. Set before the first await, cleared in `finish()`, so later and other captures still run.
- **D4 — the cursor is the footprint.** New `aquarelleFootprint.ts` reproduces the engine's radius law for all four tools (property-tested against `toEngineParams`/`buildBrushForStroke`), water = brush × 1.3, pen/lift formulas, aspect, the fixed-rotation sticky tilt azimuth, follow and random semantics. The layer renders a rotated ellipse (aspect ≥ 0.6) or rounded rect (`rx = height·0.4`, aspect < 0.6), scaled by the displayed rect height, crosshair under 8 px, dual dark/white ring.
- **D5 — the Brush tab is back.** Catalog, Size, the seven globals, the eight response multipliers and a Lift section (shared shape picker, strength, Select lifts) — every control writes the existing signals through existing setters; Settings keeps its own `BrushResponsePanel` (two views, one state).
- **D6 — Lift owns its tip.** `aquarelleLiftTipId` defaults to `'filbert'`; `setAquarelleLiftTipId` is compare-then-write and never flips the tool or touches the Brush selection; `aquarelleActiveTipId` / `aquarelleBrushForActiveTool` are the one live/record binding law; the Brush and Lift defaults flip to Filbert for new strokes.
- **Shared bake seam.** `bakeAquarelleEventsToFrame` owns adapter + bake + flush + disposal (same dispose order) and is reused by the recovery bake; Apply publishes the self-contained bytes after disposal.

## Task Commits

Each task was committed atomically (code only — the orchestrator owns `.planning/`):

1. **Task 1: Lift tip selection, Filbert defaults, restored Brush tab** — `d88aec5f` (feat)
2. **Task 2: Tip-shaped Lift footprint end to end** — `86da1294` (feat)
3. **Verification pin fix: retarget the Brush-tab response and mount pins** — `eebd27b7` (test)
4. **Task 3: Legacy base recovery, raster durability and the footprint cursor** — `3690114a` (feat)

**Plan metadata:** not committed by the executor (orchestrator-owned docs commit).

## Files Created/Modified

- `app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts` (new) — inversion, mean error, base ink, `recoverAquarelleDurableBase`, default codec.
- `app/src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts` (new) — 12 tests: forward-model round trip, white/saturated/no-pigment guards, clamping, error metric, accept-at-3/reject-at-4, all failure reasons.
- `app/src/components/physic-paint/engine/aquarelleFootprint.ts` (new) — `aquarelleFootprintFor`, `cursorPreviewPressure`, `footprintCssSize`, single-entry brush cache.
- `app/src/components/physic-paint/engine/aquarelleFootprint.test.ts` (new) — 16 property tests against the engine's own laws.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `bakeAquarelleEventsToFrame` split; `applyAquarelleEventsToKey` publishes the baked frame.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — recovery arm, failure memo, single-punch guard, rewrite targets, retried raster commit, revision bumps, capture fence, per-render paper ref.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — guard literal retarget, set-count 5 → 7, new recovery ordering/fail-closed/single-punch test.
- `app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts` — +9 pins: preflight recovery routing, recovery ordering, fail-closed, retry/revision, capture fence; set count 5 → 7.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — cursor rebuilt on the footprint law; pointer tilt/type/buttons/move-angle/rect-height tracking.
- `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts` — cursor pin retargeted to the footprint call plus shape/rotation/tilt pins.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — Lift tip signal/setter, active-tip/brush laws, Filbert defaults, one snapshot law.
- `app/src/components/physic-paint/view/LiftShapePicker.tsx` (new) — one picker for the top bar and the Brush tab.
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` — the D2 Brush tab body.
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — `brush` tab restored before settings; `onSelectLiftStrokes` threaded.
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — Shape row in the Lift cluster.
- `packages/efx-watercolor/src/playground/shaders.ts` — tip-shaped `liftFS` (mask shave, radial envelope kept).
- `packages/efx-watercolor/src/playground/Engine.ts` — `lift(x, y, r, angle, amount)` binds the tip and passes `brushAngle(s)` to the 5-arg `onLiftDab`.

## Decisions Made

- **Recovery owns the punch.** The two scripted arms are exclusive, so the single-punch law is structural rather than a counted condition; the pre-existing punch block stays byte-identical in the `else` arm.
- **One recovery attempt per key per session.** The failure memo is a `Set` in a ref, added to and never cleared (not on frame/track change), so a permanently unrecoverable legacy key costs one bake, not one per gesture.
- **Retry once, then surface.** The raster commit retries exactly once against the pinned merge base; both `commit-failed` and `committed` diagnostics record the attempt count so a genuine rejection stays distinguishable.
- **The revision bump precedes markDirty everywhere.** `markDirty` no-ops on an unchanged signature, so a durable write without the bump would not survive leave/return — the seed, the punched rewrite, the raster rewrite and the recovery seed all follow this order.
- **The cursor is a consumer of the footprint module, not a second law.** Tilt, overrides and tip come from the same inputs the layer binds, and the rotation is the engine's mirrored angle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1 left two stale Brush-tab pins in `panelSplitShell.test.tsx`**
- **Found during:** Task 3 overall verification (full app suite)
- **Issue:** The full suite had only been run as targeted suites after Tasks 1-2, so two pins contradicted the plan's restored Brush tab: "response leaves the Brush tab" (`not.toMatch(/<BrushResponsePanel\b/)`) and "no Brush tab mount" (`not.toMatch(/<RightPanelBrushTab\b/)`). The first failing assertion aborted its `it` block, masking the second.
- **Fix:** Both pinned literals retargeted to the new truth (Brush tab mounts `BrushResponsePanel`, `LiftShapePicker` and `setAquarelleParam('lift'`; the panel mounts `RightPanelBrushTab` again), with the obsolete 261018/261027 comments rewritten. Plan item 205 explicitly authorizes these exact retargets ("the Brush tab is mounted again, `BrushResponsePanel` enters the Brush tab again").
- **Files modified:** `app/src/components/physic-paint/view/panelSplitShell.test.tsx`
- **Verification:** Launcher `panelSplitShell.test.tsx.test.ts` 12/12; full app suite 350 files / 6,190 tests passing.
- **Committed in:** `eebd27b7` (separate from the task commits so Task 3 stays atomic)

### Deliberate pin updates (literal only, never weakened)

- `PhysicsPaintStudio.test.ts`: stroke-end guard literal retargeted to `if (scriptRecordingOn && !(liftPlan?.kind === 'erase' && liftPlan.recoverBase)) {`; durable set count 5 → 7 (re-derived by grep: 7 set sites, 2 deletes); new ordering/fail-closed/single-punch test.
- `aquarelleLiftEraseContract.test.ts`: set count 5 → 7; +9 pins (recovery routing, recovery arm ordering, fail-closed content, retry/attempts, revision bump ordering, capture fence, preflight memo).
- `aquarelleLayerContract.test.ts`: the `aquarelleParams.value.size` pin was replaced by the footprint-call pins (`aquarelleFootprintFor(`, `size: params.size`, `footprintCssSize(`, rect/ellipse branch, `rotate(${-footprint.angle}rad)`, tilt inputs) — the old expression no longer exists in the cursor.

### Deltas from the plan's wording (no behavior change)

- `AquarelleFootprintInput.toolOverrides` accepts `AquarelleToolOverrides | null` (the plan wrote non-null) so the neutral override bag can flow through unchanged.
- `applyAquarelleEventsToKey` now publishes after `bake.dispose()` / `adapter.dispose()`; the plan's item 7 explicitly allows this and the baked bytes are self-contained.

**Total deviations:** 1 auto-fixed (Rule 1, test pin), plus 3 deliberate pin groups and 2 wording deltas.
**Impact on plan:** No scope creep, no weakened assertion, no behavior change beyond the locked decisions D1-D8.

## Issues Encountered

- The recovery event filter initially cast `event.engine` on a union that includes `AquarelleDryEvent` — TS2339; fixed with an `'engine' in event` narrowing (Dry events always stay, D-15).
- A test cast of `null` to `AquarelleBasePixels` narrowed inside a callback — replaced by a pushed array of seen bases.
- The first `aquarelleBaseRecovery` run failed 11/12 on `baseInk`: the recovered base is the displayed grey (100) against a white script, so `baseInk = 1 − 100/255`, not 0. The fixture expectation was corrected (source unchanged) and the suite went 12/12.
- `failRecovery` contains its own `aquarelleResetSheetRef.current?.()`, so an `indexOf` on that literal finds the helper, not the shared tail; the Studio test pins the tail occurrence after the punched write instead.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Automated gates green on the committed tree:
  - Package: `pnpm --filter @efxlab/efx-watercolor run check` and `run build` green (Task 2; the package is untouched since).
  - App typecheck: `tsc --noEmit` clean.
  - Targeted Task 3 suites: 5 files / 346 tests passing (`aquarelleBaseRecovery` 12, `aquarelleFootprint` 16, `aquarelleLiftEraseContract` 21, `aquarelleLayerContract` 19, `PhysicsPaintStudio` 278).
  - Full app suite: 350 files passed, 2 skipped, 6,190 tests passed, 1 skipped, 96 todo.
- Native visual UAT remains for the user; rows to watch most closely:
  - **Scripted legacy frame (D1)** — the recovery bake runs once; confirm the erase is visible and that deleting the scripted event restores the script paint, Apply re-erases, and raster paint outside the lift survives.
  - **Raster-only durability (D3)** — leave/return and close/reopen with Script ON and OFF; the punched payload, not a settle capture, must be what loads.
  - **Cursor (D4)** — Flat/Round/Filbert shapes, pen tilt on a fixed-rotation tip, and the select/move hiding.
  - **Legend** — the cursor's ring and the painted/erased footprint must agree at high zoom, where a rounding mismatch is most visible.

---
*Quick: 261028-k03c*
*Completed: 2026-10-28*

## Self-Check: PASSED

- Created files verified on disk: aquarelleBaseRecovery.ts/.test.ts, aquarelleFootprint.ts/.test.ts, LiftShapePicker.tsx, aquarelleLiftTipSelection.test.ts, this SUMMARY.
- Commits verified as ancestors of HEAD: `d88aec5f`, `86da1294`, `eebd27b7`, `3690114a`.
- Measured ledger: `plan_head_before: 86c910c16c51dd0d70d2f3f3ab9edebf780b2b64`, `plan_head_after: 3690114aa1d97fb9ddda9d1f473c779a0a001c12`, `commits: 4`.
