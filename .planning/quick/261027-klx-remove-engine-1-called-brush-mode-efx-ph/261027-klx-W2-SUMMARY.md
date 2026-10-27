---
phase: quick-261027-klx
plan: W2
wave: 2
status: complete
stop_conditions: []
resolved_conditions: []
commit: 79ca9804
plan_head_before: 2ac6cebc9d44fc6cb52a8e6c79f000a04c2afb32
plan_head_after: 79ca98046782a9dd0b33e83a14b2b22e13b4eac9
commits: 1
files_changed: 21
insertions: 264
deletions: 8025
date: 2026-10-27
---

# Phase quick-261027-klx — Wave 2 Summary

**Status: COMPLETE.** The engine-1-only app modules and their tests are gone;
`physicsPaintTemporaryErase.ts` is split to the surviving Move arm with zero
`@efxlab/efx-physic-paint` imports; the engine-actions test is retargeted to
the paper-display surface; and the deleted mixed test's Aquarelle coexistence
intent moved into the surviving aquarelle record-state test. The app remains
**intentionally non-compiling** for the Wave 3-4 file sets only.

## Pre-delete importer census (step 2.1)

Grep of every deleted module's basename across `app/src`, measured before the
deletes. Every surviving importer re-homes in a later wave; **no S2 stop
condition fired** (no importer without a re-home wave).

| Deleted module | Surviving importers | Re-home wave |
|---|---|---|
| `view/brushScriptRecordState.ts` | `PhysicsPaintStudio.tsx`, `PhysicsPaintStudio.test.ts`, `snapshot/studioScriptSnapshotController(.test).ts`, `performance/studioScriptMemoryGauge(.test).ts`, `performance/moveProvenanceCapture.ts`, `hooks/usePhysicsPaintLaunchIntegration.ts`, `view/frameScriptOwnership(.test).ts`, `view/RightPanelMemoryTab.tsx` | 3 (Studio/snapshot/gauge/memory/provenance), 4 (launch/frame ownership/memory tab) |
| `view/brushScriptEditionPort.ts` | `PhysicsPaintStudio.tsx`, `PhysicsPaintStudio.test.ts` | 3 |
| `view/brushScriptHydration.ts` | `PhysicsPaintStudio.tsx`, `PhysicsPaintStudio.test.ts`, `performance/scriptMemorySnapshot(.test).ts`, `performance/moveProvenanceCapture.ts` | 3 |
| `engine/BrushScriptOverlay.tsx` | `engine/PhysicsPaintCanvasMount.tsx`, `PhysicsPaintStudio.test.ts` | 4 (mount), 3 (test load-reads) |
| `view/BrushModuleSection.tsx` | `view/PhysicsPaintRightPanel.tsx`, `view/PhysicsPaintRightPanel.test.ts`, `view/physicsPaintRightPanelModuleGate.test.ts`, `view/physicsPaintRightPanelPaperSingleHome.test.ts`, `view/panelSplitShell.test.tsx` | 4 |
| `performance/depositSpeckleCapture.ts` | `PhysicsPaintStudio.tsx` | 3 |
| `performance/scriptMemoryProbe.ts` | `PhysicsPaintStudio.tsx`, `PhysicsPaintStudio.test.ts`, `performance/studioScriptMemoryGauge.test.ts` | 3 |
| `performance/lookDeltaCapture.ts` | `PhysicsPaintStudio.tsx` | 3 |
| `efx-paint/host-split/preSplitGoldenFixture.ts` | none (only `preSplitGoldenParity.test.ts`, deleted with it) | — retired pair |
| `efx-paint/host-split/preSplitGoldenParity.test.ts` | none | — retired pair |

Post-commit re-grep: the only remaining mentions of the deleted basenames are
(1) real dangling imports in the Wave 3-4 files above, and (2) prose —
`aquarelleScriptRecording.test.ts`'s porting comment naming the deleted test,
and `hostAnimationResidueContract.test.ts:28` listing `preSplitGoldenParity` in
its family doc comment. Neither is a dependency.

## What landed

1. **2.2 Deleted 8 modules:** `view/brushScriptRecordState.ts`,
   `view/brushScriptEditionPort.ts`, `view/brushScriptHydration.ts`,
   `engine/BrushScriptOverlay.tsx`, `view/BrushModuleSection.tsx`,
   `performance/depositSpeckleCapture.ts`, `performance/scriptMemoryProbe.ts`,
   `performance/lookDeltaCapture.ts`.
2. **2.3 Deleted their tests:** `brushScriptRecordState.test.ts` (mixed — see
   2.6), `brushScriptEditionPort.test.ts`, `brushScriptHydration.test.ts`,
   `engine/EfxPaintCanvas.lifecycle.test.ts`,
   `performance/depositSpeckleCapture.metrics.test.ts`.
3. **2.4 Retired the golden pair:** deleted `preSplitGoldenFixture.ts` and
   `preSplitGoldenParity.test.ts`; removed exactly their two entries from
   `hostSplitSuiteGate.test.ts` (`STANDING_PINS` + `PIN_FIXTURES`) plus the
   stale doc-comment line naming the parity pin. `fakeEngine2Fixture.ts` and
   every other pin are untouched; the gate is green with 6 tests (was 6 before
   — the entries were data, not test cases). The golden-parity pin is retired
   because its subject (the engine-1 host split) is retired; the four surviving
   host-split pins stay green in intent.
4. **2.5 Split `physicsPaintTemporaryErase.ts`** (KEEP/SPLIT, not delete) —
   see the erase-arm verdict and the `engine.setTool` interpretation below.
5. **2.6 Split the mixed tests.**
6. **2.7 Retargeted `engine/usePhysicsPaintEngineActions.test.ts`.**
7. **2.8 Commit** `79ca9804` — `refactor(261027-klx): delete engine-1-only app
   modules`, 21 files, +264 / -8,025. Pathspec-scoped staging only.

## Erase-arm verdict — NO watercolor writer, arm removed

Command (exactly as the plan requires):

```
grep -rn "temporaryErase\|setTemporaryErase" app/src --include='*.ts' --include='*.tsx'
```

Result before the split: the only **writers** of the erase arm were the
module's own Alt `keydown`/`keyup` handlers (`handleTemporaryEraseKeyDown` /
`handleTemporaryEraseKeyUp`). Readers were `PhysicsPaintStudio.tsx:2370`
(`temporaryErase.peek()`) and the two temporary-erase/move test files. **No
aquarelle/watercolor path armed it** — the now-deleted `AquarelleCanvasLayer`
render gate read only `temporaryMove`.

Verdict: **no aquarelle-path writer exists → the erase arm was deleted**,
together with its exported `temporaryErase` signal, both Alt handlers, and the
engine-adapter's erase-specific Alt call. The surviving module keeps:

- `temporaryMove` and its render gate (Meta hold, gated; Cmd-tap toggle intact);
- `syncTemporaryErase`, `handleTemporaryMoveKeyDown/KeyUp`,
  `handleTemporaryEraseBlur`, `handleTemporaryEraseVisibilityChange`,
  `handleTemporaryEraseGestureBoundary`, `mountPhysicsPaintTemporaryErase`,
  `resetTemporaryEraseForTests`;
- the ONE combination rule `combineEffectiveTool(selected, moveArmed = false)`,
  now move-only: armed + selected `'paint'` resolves to `'move'`; a disarmed
  selection and a selected `'erase'` pass through untouched;
- the localized `import type { ToolType } from '../types/paintCore'` — **zero
  `@efxlab/efx-physic-paint` imports** (gate re-run green).

`temporaryErase` is no longer exported; `PhysicsPaintStudio.tsx:83` now reports
TS2724 against it (Wave 3/4 surface — see Deferred/deviations).

## `engine.setTool` interpretation (deviation D1)

Wave 2 step 5 says remove the erase arm's "`engine.setTool` call (`:167`)";
step 6 says keep every `temporaryMove` case, including the gesture-boundary
deferral cells. Taken literally together these conflict: the move arm's only
mechanism IS the single writer `syncTemporaryErase` → `engine.setTool(desired)`
(with `desired` resolving to `'move'` while armed). Deleting that call would
gut the surviving move arm and every boundary test.

Resolved in favour of the move arm: the **erase-specific apply path** is gone
(the Alt arm, its signal, and its handlers no longer exist, so `'erase'` can
never be produced by this feature); the single writer survives and can now
apply only the effective tool — `'move'` while the Meta arm is up, the selected
tool otherwise. This satisfies the Wave 2 hard gate (file exists,
`temporaryMove` intact, zero engine-1 imports) and keeps the module's only
engine interaction (`setTool`) meaningful. Recorded here as required.

## Mixed-test split decisions (2.6) and what was preserved

- **`physicsPaintTemporaryMove.test.ts`** — kept every `temporaryMove` cell:
  arm/disarm gating, unconditional keyup, blur/visibility, event hygiene,
  gesture-boundary deferral (6 cells), mount wiring, Cmd-tap toggle (6 cells),
  the 2-arg precedence law. Deleted the engine-erase cells and the
  `temporaryErase`/`setTemporaryErase` signal assertions. Retargeted
  `ToolType` to `types/paintCore.ts`.
- **`physicsPaintTemporaryErase.test.ts`** — **deleted** (per 2.5: it tested
  ONLY the erase arm once the move cases lived in the move file). Before
  deleting it, its three **dispatcher Alt-exclusion** pins were moved into the
  move test (new describe `'dispatcher Alt exclusions —
  physicsPaintStudioKeyboard.ts untouched (PRESERVED ALT)'`) so the coverage
  that `physicsPaintStudioKeyboard.ts` never consumes Alt/Escape chords was not
  dropped. That file is deliberately never edited by this feature.
- **`brushScriptRecordState.test.ts`** — the Brush half (1087 lines) died with
  its store. Its Aquarelle coexistence describe (`'aquarelle guide proxies are
  never Brush script content'`) exercised only Brush-store exports
  (`flushBrushScriptFrame`, `adoptBrushScriptFrameAsComplete`,
  `restoreBrushScriptFrames`, `dropNonKeyCellBrushScript`,
  `purgeAquarelleGuideGroups`), so none of it survives its subject. The
  coexistence INTENT was moved instead:
  - the guide-proxy marker half is already pinned against the surviving
    projection in `engine/aquarelleStrokeBridge.test.ts:195`
    (`paint.guideProxy === true`);
  - the registry half now lives in `view/aquarelleScriptRecording.test.ts`
    (new describe `'261027-klx aquarelle registry is the only script
    authority'`, 3 cells): recording order + key anchors, an unrecorded
    mutation id absent from every script view (no implicit capture), and an
    unanchored record carrying no key identity.
- **Cross-file source pins dropped (deviation D2).** The old move test
  `readFileSync`-pinned strings in `PhysicsPaintStudio.tsx` and
  `PhysicsPaintToolRail.tsx` — both Wave 3/4-owned files that WILL be rewritten
  by waves whose `<files>` do not include this test. Keeping those pins would
  strand a red test at Wave 6 with no owning wave. The module behavioural pins
  (which read only `physicsPaintTemporaryErase.ts` itself) were kept.

## Retargeted `usePhysicsPaintEngineActions.test.ts` (2.7)

Kept only the paper-display surface — 6 cells: settings+engine mirror for
`setBackground`/`setGrainStrength`; the PAPER-01 law that a library paper id
never reaches `engine.setBgMode` (mapped to `'transparent'`); the 260923-bcm
law that `setGrainScale` makes NO engine call; the studio-reopen-paper-washout
law that all three paper-display writers survive a null engine; the controller
lock gating every paper-display write; and `updateSetting`'s single-key patch.
The engine is structurally faked via
`NonNullable<PhysicsPaintEngineActionsInput['engine']>`, so the test carries no
`@efxlab/efx-physic-paint` import. All 11 engine-1 tool/physics cases removed.

## Commands run and results

| # | Command | Result |
|---|---|---|
| 1 | targeted vitest on the 4 rewritten/retargeted files | PASS — 4 files, **62 tests** (`physicsPaintTemporaryMove` 40, `aquarelleScriptRecording` 9, `usePhysicsPaintEngineActions` 6, `stackOrder` 7) |
| 2 | exact plan `<verify>` (below), pre-commit | PASS — 5 files / **28 tests** green; census 49 files |
| 3 | `git add --` 5 exact paths + `git commit` | PASS — `79ca9804`, 21 files, +264 / -8,025 |
| 4 | post-commit deletion check | PASS — exactly the 16 intended deletions, no others |
| 5 | exact plan `<verify>` re-run on the committed tree | PASS — identical output (below) |

Exact verify command and output (re-run post-commit):

```
test ! -e app/src/components/physic-paint/view/brushScriptRecordState.ts && test ! -e app/src/efx-paint/host-split/preSplitGoldenFixture.ts && test -e app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts && ! grep -q "@efxlab/efx-physic-paint" app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts app/src/components/physic-paint/view/stackOrder.ts && pnpm --filter efx-motion-editor exec vitest run src/efx-paint/host-split/hostSplitSuiteGate.test.ts src/efx-paint/host-split/hostAnimationResidueContract.test.ts src/efx-paint/host-split/hostImportGraphContract.test.ts src/components/physic-paint/view/stackOrder.test.ts src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts && (pnpm --dir app run typecheck > /tmp/klx-wave2-typecheck.log 2>&1; grep -oE "^[^ (]+\.(ts|tsx)" /tmp/klx-wave2-typecheck.log | sort -u)
```

```
 RUN  v2.1.9 /Users/lmarques/Dev/efx-motion-editor/app

 ✓ src/efx-paint/host-split/hostSplitSuiteGate.test.ts (6 tests) 3ms
 ✓ src/components/physic-paint/view/stackOrder.test.ts (7 tests) 2ms
 ✓ src/efx-paint/host-split/hostImportGraphContract.test.ts (5 tests) 6ms
 ✓ src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts (6 tests) 3ms
 ✓ src/efx-paint/host-split/hostAnimationResidueContract.test.ts (4 tests) 180ms

 Test Files  5 passed (5)
      Tests  28 passed (28)
   Duration  412ms (transform 102ms, setup 0ms, collect 138ms, tests 195ms, environment 0ms, prepare 153ms)
```

## Typecheck census — 49 files (Wave 1: 61)

Distinct failing files, paths as tsc emits them (relative to `app/`):

```
src/components/physic-paint/engine/aquarelleStrokeBridge.ts
src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts
src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
src/components/physic-paint/engine/physicsPaintStudioSettings.ts
src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
src/components/physic-paint/hooks/usePhysicsPaintWorkflowIntegration.ts
src/components/physic-paint/hooks/useRotoFrameEditingController.ts
src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
src/components/physic-paint/hooks/useRotoReferenceController.ts
src/components/physic-paint/performance/moveProvenanceCapture.ts
src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
src/components/physic-paint/performance/scriptMemorySnapshot.ts
src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts
src/components/physic-paint/performance/studioScriptMemoryGauge.ts
src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
src/components/physic-paint/PhysicsPaintStudio.tsx
src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
src/components/physic-paint/roto/rotoCanvasFrames.ts
src/components/physic-paint/roto/rotoCoordinatorPorts.ts
src/components/physic-paint/roto/rotoEditBufferTransactions.ts
src/components/physic-paint/roto/rotoSaveTransactions.ts
src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
src/components/physic-paint/view/frameScriptOwnership.test.ts
src/components/physic-paint/view/frameScriptOwnership.ts
src/components/physic-paint/view/panelSplitShell.test.tsx
src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
src/components/physic-paint/view/PhysicsPaintToolRail.tsx
src/components/physic-paint/view/recordedStrokeGroups.ts
src/components/physic-paint/view/RightPanelMemoryTab.tsx
```

**Census verdict: PASS.**

- **Strictly smaller:** 49 < 61. Exact delta: **16 files gone** (the 16
  deleted/rewritten/retargeted census entries above) and **4 files newly
  surfaced** — `snapshot/studioScriptSnapshotController.ts`,
  `view/frameScriptOwnership.ts`, `view/panelSplitShell.test.tsx`,
  `view/RightPanelMemoryTab.tsx` — which now show a *direct* dangling import of
  a Wave-2-deleted module (their types previously resolved through it). 61 −
  16 + 4 = 49.
- **Inside the expected-failure set:** mechanical `comm` of the census against
  the Wave 3 + Wave 4 `<files>` blocks (83 distinct files) returns **zero
  census files outside those sets**.

**Error classes (93 errors), all engine-1-caused:**

| Code | Count | Cause |
|---|---:|---|
| TS2307 | 68 | `Cannot find module '@efxlab/efx-physic-paint'` (and `…/preact`) — direct |
| TS7006 | 22 | implicit-`any` cascades from the now-unresolved package types (all inside the census files) |
| TS2345 | 2 | `physicsPaintRotoPlayScriptRenderer.ts:161,449` — unchanged from Wave 1 (engine `any` no longer narrows) |
| TS2724 | 1 | `PhysicsPaintStudio.tsx(83,3)` imports the removed `temporaryErase` export — expected Wave 3/4 surface |

No error of any other class appears. No file outside the Wave 3-4 sets appears.

## Deviations from plan

1. **D1 — `engine.setTool` retained for the Move arm** (see the dedicated
   section above). The erase-specific apply path is deleted; the surviving
   single writer applies only `'move'`/the selected tool.
2. **D2 — cross-file source pins dropped from `physicsPaintTemporaryMove.test.ts`**
   (Studio/rail string pins). Their subjects are Wave 3/4-owned and would be
   rewritten by waves that do not own this test; keeping them would guarantee
   a stranded red at Wave 6. All module-level behavioural pins were kept.
3. **D3 — `hostSplitSuiteGate.test.ts` doc comment updated** in addition to the
   two required array entries, so the file's "Pins covered" list no longer
   names the retired parity pin.
4. **D4 — Aquarelle coexistence ported as registry-authority pins** rather than
   verbatim: the deleted block's cells all used Brush-store exports and die
   with their subject. The surviving half (registry authority + the
   `guideProxy` marker, already pinned in `aquarelleStrokeBridge.test.ts`) is
   preserved.

## Constraints honoured

- Pathspec-scoped staging only: `git rm --` for the 16 deletions and
  `git add --` for exactly the 5 modified files. No `git add -A`/`git add .`.
  `.planning/`, `SPECS/`, `app/dist/` and unrelated dirty files were never
  staged; `git status` is clean after the commit.
- `pnpm` only, `vitest run` only, no dev server, no push.
- Wave 3/4 imports deliberately NOT fixed; the app remains intentionally
  non-compiling outside Wave 2's surface.
- Ledger: `plan_head_before 2ac6cebc` -> `plan_head_after 79ca9804`, 1 commit.
- Summary written with `status: complete` and deliberately NOT committed.

## Notes for Wave 3

- `PhysicsPaintStudio.tsx:83` must drop the `temporaryErase` import and its
  `:2370` peek read; that is the only TS2724 in the tree.
- `PhysicsPaintStudio.test.ts` still performs module-load `readFileSync` over
  `brushScriptEditionPort.ts`, `BrushScriptOverlay.tsx`, `scriptMemoryProbe.ts`
  and `brushScriptRecordState.ts` (Wave 3 step 3.8b already schedules their
  removal — three of those sources no longer exist and throw ENOENT at load).
- The four census files that newly surfaced (`studioScriptSnapshotController.ts`,
  `frameScriptOwnership.ts`, `panelSplitShell.test.tsx`,
  `RightPanelMemoryTab.tsx`) are already in the Wave 3/4 `<files>` sets.
- `stackOrder.ts` remains engine-1-free (Wave 0 copy; permanent pin green).
- `hostSplitFailClosedApply.test.ts:226`'s `'efx-physic-paint': 'Brush'`
  refusal row is still green and untouched — Wave 3/5 own the classification
  change.

## Self-Check: PASSED

- `test ! -e .../brushScriptRecordState.ts` — the file is absent (committed
  deletion).
- `test ! -e .../preSplitGoldenFixture.ts` — absent (committed deletion).
- `test -e .../physicsPaintTemporaryErase.ts` — present, and
  `! grep -q "@efxlab/efx-physic-paint"` holds for it and `stackOrder.ts`.
- Five verify test files green — 28/28 tests.
- Commit `79ca9804` is HEAD; `git show --first-parent --diff-filter=D` lists
  exactly the 16 intended deletions; tree clean apart from this untracked
  summary file.
- Typecheck census 49 files, all inside the Wave 3-4 `<files>` sets.
