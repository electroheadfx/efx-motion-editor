---
phase: 61-vector-painting-tool
verified: 2026-11-10T22:33:21Z
status: gaps_found
score: 17/19 must-haves verified
covered_files:
  - ".planning/phases/61-vector-painting-tool/61-01-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-01-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-02-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-02-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-03-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-03-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-04-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-04-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-05-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-05-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-06-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-06-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-07-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-07-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-08-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-08-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-09-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-09-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-10-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-10-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-11-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-11-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-12-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-12-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-13-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-13-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-14-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-14-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-15-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-15-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-16-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-16-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-17-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-17-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-18-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-18-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-19-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-19-SUMMARY.md"
  - ".planning/phases/61-vector-painting-tool/61-20-PLAN.md"
  - ".planning/phases/61-vector-painting-tool/61-20-SUMMARY.md"
  - "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
  - "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
  - "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx"
  - "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts"
  - "app/src/components/physic-paint/engine/VectorPathOverlay.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx"
  - "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts"
  - "app/src/components/physic-paint/view/aquarelleColorPicker.ts"
  - "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts"
  - "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
  - "app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts"
  - "app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts"
  - "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts"
  - "app/src/components/physic-paint/view/scriptStrokeEdition.ts"
  - "app/src/components/physic-paint/view/shortcutTextTarget.test.ts"
  - "app/src/components/physic-paint/view/shortcutTextTarget.ts"
  - "app/src/components/physic-paint/view/strokeSettingsModel.test.ts"
  - "app/src/components/physic-paint/view/strokeSettingsModel.ts"
  - "app/src/components/physic-paint/view/vectorPathLatches.test.ts"
  - "app/src/components/physic-paint/view/vectorPathLatches.ts"
  - "app/src/components/physic-paint/view/vectorPathSession.test.ts"
  - "app/src/components/physic-paint/view/vectorPathSession.ts"
  - "packages/efx-watercolor/probe/vector-spine/probe.ts"
  - "packages/efx-watercolor/probe/vector-spine/result.json"
  - "packages/efx-watercolor/probe/vector-spine/run.mjs"
covered_digest: "v4:sha256:407bf959ed13a4d45656f76aac9d0fe73c5d1fb37fa3ed2883d2b0431713c84b"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/18
  gaps_closed:
    - "G-1: a drawn vector path is re-baked on commit, and Script Off is refused with fixed copy instead of silently dropping the path (truth 3)"
    - "G-2: a completed path edit is re-baked through the one shared commit (truth 5)"
    - "G-3: path-edit drags capture the pointer and release it after the commit decision (truth 6)"
    - "G-4: the capture-phase vector key dispatcher yields to text-entry targets (truth 7)"
    - "G-5: the Anchor width commit resolves its target from the open path edit or refuses (truth 8)"
    - "G-6: Select entry and picker entry release the vector pen and close the open path edit (truth 9)"
    - "G-7: Draft OFF is unrepresentable while wireframe is ON, the Draft settle refuses, and the rail states why Select is inert (truth 12, prohibition 17)"
    - "G-8: every committed path edit records exactly one aquarelle-script ledger entry at the single writer (truth 15)"
  gaps_remaining: []
  regressions:
    - "CR-01: an interrupted path-edit drag is never cleared — deleted anchors resurrect and a stranded drag can commit a phantom edit (new truth 19 FAILED)"
gaps:
  - truth: "An interrupted path-edit drag is terminated: closing the edit, deleting anchors, or switching input surfaces clears the drag, so no stranded drag can commit a phantom path edit or resurrect a deleted anchor"
    status: failed
    reason: "dragRef and vectorPathEditDrag are cleared only by finishEditDrag/cancelEditDrag, and those handlers unbind the moment editMutationId goes null. exitPathEdit and resetForStudioOpen never touch the overlay's gesture state, the overlay stays mounted while any vector stroke exists on the frame, and an empty-space press returns without clearing dragRef. Deleting an anchor mid-drag therefore resurrects it in the preview and re-commits it on release, and reopening an edit lets a stale drag commit against a stroke the user may no longer be editing (review CR-01, confirmed at HEAD)."
    artifacts:
      - path: "app/src/components/physic-paint/engine/VectorPathOverlay.tsx"
        issue: "dragRef cleared only at 945 (finishEditDrag) and 964 (cancelEditDrag); handlers bound only while editInteractive (981-984); the stale editDrag preview wins over recorded anchors at 700-702; an empty-space press returns at 900 without clearing dragRef"
    missing:
      - "An effect on editMutationId that clears dragRef and vectorPathEditDrag and releases pointer capture when the edit closes"
      - "Target guards at the top of continueEditDrag and finishEditDrag (drag.mutationId must equal editTargetMutationId)"
      - "Clear dragRef at the START of startEditDrag so an empty-space press cannot inherit a stale drag"
  - truth: "Shift+A is refused while wireframe is on — no stroke selection is written behind the construction view"
    status: partial
    reason: "handleToggleSelectAllAquarelleStrokes calls setAquarelleSelectMode(true), which refuses under wireframe, but then unconditionally runs setAquarelleStrokeSelection(...) with the live frame's ids. The selection survives the wireframe session and the settings sheet opens in multi-selection mode from a shortcut that appeared to do nothing (review WR-01, confirmed at HEAD)."
    artifacts:
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "handleToggleSelectAllAquarelleStrokes (2717-2727) always writes the selection after the possibly-refused mode entry"
      - path: "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
        issue: "setAquarelleSelectMode refuses entry under wireframe (341) — the caller ignores that refusal"
    missing:
      - "Early return on wireframeMode.peek(), and a re-check of select mode after the entry attempt, before any selection write"
  - truth: "A failed path-edit bake always restores the pre-edit script — the rollback cannot silently skip while the capsule claims restoration"
    status: partial
    reason: "onFailure calls restoreAquarelleEditSnapshot(editId, 'undo') and ignores its return. That restore is revision-authoritative and returns null without touching the script whenever aquarelleStrokesRevision moved past the edit's after side, so an interleaved bump leaves the edit half-applied (script written, pixels not) while the user is told the path edit was restored. The module already documents the raw rollback for exactly this case (review WR-02, confirmed)."
    artifacts:
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "onFailure at 10153-10164 ignores the restore result and always publishes '…the path edit was restored.'"
      - path: "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
        issue: "restoreAquarelleEditSnapshot fails closed on revision mismatch (1049-1061); reanchorAquarelleEditFromLiveContent (1124-1135) is the shipped remedy, unused here"
    missing:
      - "Call reanchorAquarelleEditFromLiveContent(editId, 'undo') before the restore, or use the documented restoreAquarelleSnapshotRaw rollback path"
  - truth: "A draw commit whose re-bake is skipped because another script edit is in flight is retried or surfaced, never silently left unbaked"
    status: partial
    reason: "The draw tail discards the bake result: `if (isVectorAquarelleStroke(stroke)) void bakeAquarelleVectorCommit();`. runAquarelleScriptRebake's in-flight branch returns false and calls neither terminal callback, so a path drawn while another script edit is still baking is recorded in the timeline but never re-rendered, with no message and no dirty flag (review WR-03, confirmed)."
    artifacts:
      - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
        issue: "vector tail at 8807 discards the boolean from bakeAquarelleVectorCommit"
      - path: "app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts"
        issue: "the in-flight branch (49) returns false without onSuccess/onFailure"
    missing:
      - "On a false result, arm the existing Draft retry (setDraftPixelsDirty(true)) or publish a bounded refusal"
  - truth: "An open path edit is closed when the stroke selection moves to a different vector stroke — the sheet and the edit surface never name different strokes"
    status: partial
    reason: "shouldExitPathEdit only asks whether an edit is active and the gate is closed. The gate is selectionSize === 1 && vectorStrokeCount === 1 and never compares ids, so selecting stroke B keeps stroke A's path edit open: the sheet shows B while every canvas drag still edits A (review WR-04, confirmed). The width write itself is safe because resolveAnchorWidthTarget refuses the mismatch."
    artifacts:
      - path: "app/src/components/physic-paint/view/strokeSettingsModel.ts"
        issue: "shouldExitPathEdit (886-888) is not target-aware; resolvePathEditGate (839-852) compares only counts"
      - path: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx"
        issue: "the exit effect consumes the count-only predicate"
    missing:
      - "Make the exit predicate compare selectedMutationId with pathEditMutationId and exit on any mismatch"
  - truth: "The capture-phase vector key dispatcher also yields to non-text interactive targets, so Enter on a focused button is not swallowed"
    status: partial
    reason: "isTextEntryTarget refuses only INPUT/TEXTAREA/SELECT/contenteditable. While a vector draft exists, Enter on a focused rail or sheet button finishes the draft and preventDefault/stopPropagation suppresses the button's activation (review WR-05, confirmed)."
    artifacts:
      - path: "app/src/components/physic-paint/view/shortcutTextTarget.ts"
        issue: "TEXT_ENTRY_SELECTOR (13) and isTextEntryTarget (23-40) cover text fields only"
      - path: "app/src/components/physic-paint/engine/VectorPathOverlay.tsx"
        issue: "handleVectorPathWindowKey (337-350) yields only to text-entry targets"
    missing:
      - "Add button/a[href]/[role=button|menuitem|link] to the yielded-target predicate"
behavior_unverified_items:
  - truth: "Vertex editing stays responsive at the measured reference stroke count"
    test: "Load the 10-stroke reference sheet at 1920x1080, drag an anchor continuously, and watch for lag"
    expected: "The drag stays native-feeling and commits without visible stutter; the probe's raster cost for a 10-stroke sheet re-bake is 789.3 ms at 1920x1080 (75.9 ms/stroke), so the reference-count claim is a judgment, not a measured pass"
    why_human: "Interaction latency has no automated harness; the probe measures raster cost only, and no test exercises drag responsiveness. The probe's printed `ref=10` is its fallback floor (probe.ts:964-969), not a sub-33 ms measurement — the previous report repeated that line as a measured claim, which this report corrects"
---

# Phase 61: Vector Painting Tool Verification Report

**Phase Goal:** Users can draw and edit resolution-independent vector strokes whose paint properties vary per vertex, that persist, export, and replay deterministically.
**Verified:** 2026-11-10T22:33:21Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 61-15..61-20) and a fresh code review (`61-REVIEW.md`, `ab91201db`)

Must-haves = the 5 ROADMAP success criteria expanded to 18 observable truths (carried from the previous verification), plus the 18 plan prohibitions, plus one new truth derived from the fresh review (truth 19). The six gap-closure plans added detail; they did not reduce the roadmap contract.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The vector pen is a fifth, visually separated rail entry with `aria-pressed` and the V shortcut; entering it clears Select, the picker and path edit (SC1/VEC-01) | ✓ VERIFIED | `PhysicsPaintToolRail.tsx` fifth entry (`data-testid="aquarelle-vector-pen-toggle"`); `vectorPathSession.ts` `enterVectorPen`; rail/session tests green in the 929-test app run |
| 2 | The draw gesture places Alt-corner and smooth anchors, previews the spine between them, commits on Enter and cancels on Escape, producing one recorded stroke (SC1/VEC-01) | ✓ VERIFIED | `VectorPathOverlay.tsx` draw handlers (753-905), `handleVectorPathKey` (270-285), `AquarelleCanvasLayer.handleVectorCommit`; overlay suite green |
| 3 | A finished drawn path is baked onto the live sheet on commit and is visible without a settle/reopen; Script Off refuses/warns instead of silently dropping it (SC1/VEC-01) | ✓ VERIFIED | Script-Off refusal before ledger allocation (`PhysicsPaintStudio.tsx` 8726-8731, fixed copy `VECTOR_PATH_SCRIPT_OFF_MESSAGE`); vector tail re-bakes after the record (8807); `bakeAquarelleVectorCommit` (8645-8676) owns the single flight and the failure capsule. Open warning WR-03 covers the contention case where the bake is skipped silently |
| 4 | The edit gesture set is reachable: anchor drag, coupled-handle drag, handle break, insert, delete, multi-select (SC1/VEC-02) | ✓ VERIFIED | `VectorPathOverlay.tsx` `startEditDrag`/`continueEditDrag` (827-940), `handleVectorPathEditKey` (300-327); overlay suite green |
| 5 | A completed path edit is re-baked on the live sheet (SC1/VEC-02) | ✓ VERIFIED | `commitAquarelleVectorPathEdit` (10115-10177): defer branch for Draft/wireframe, `runAquarelleScriptRebake` (aquarelleVectorPathCommit.ts 48-63) for Live; failure restores the snapshot and publishes the refusal. Open warning WR-02 covers a rollback that can silently skip |
| 6 | A path-edit drag captures the pointer; release outside the overlay still ends and commits the edit (SC1/VEC-02) | ✓ VERIFIED | `capturePointer` (184-195) on both drag branches (861, 890); `releasePointerCapture` honours `hasPointerCapture` and is called after the commit decision (959) and on cancel (966); 61-16 pins green |
| 7 | The vector keyboard shortcuts stand down while a dialog input has focus (SC1/VEC-02) | ✓ VERIFIED | `handleVectorPathWindowKey` (337-350) yields to `isTextEntryTarget` before either handler; `shortcutTextTarget.ts` duck-typed predicate; 61-16 pins green. Open warning WR-05 covers focused buttons |
| 8 | The Anchor width commit writes to the path the Edit-path gate says it is editing (SC2/VEC-03) | ✓ VERIFIED | `resolveAnchorWidthTarget` (strokeSettingsModel.ts 867-874) fails closed unless the single selected stroke IS the open edit; `applyAnchorWidths` (11542-11558) routes through the shared commit. 61-19 pins green |
| 9 | The four input surfaces (paint tools, vector pen, Select, picker) are mutually exclusive by construction (61-08 must-have, D-06) | ✓ VERIFIED | `setAquarelleSelectMode` releases pen + path edit on entry (aquarelleStrokeSelection.ts 346-356); picker latch entry releases both (aquarelleColorPicker.ts 43-46); rail Select and paint keys gated. Open warning WR-01 covers Shift+A writing a selection while Select entry is refused |
| 10 | Per-vertex width: a sparse factor interpolates, absent = 1.0, uniform stores nothing; the engine consumes the width channel (not clamped `scriptScale`) (SC2/VEC-03) | ✓ VERIFIED | `spine.ts` / `engineAdapter.ts` / `Engine.ts` unchanged since the previous verification; `engineScriptWidth.test.ts` (10) and `spine.test.ts` (33) green in the 123-test watercolor run; probe width arm 1.75x vs scriptScale-clamped 1.0 |
| 11 | Brush id and colour are stroke-level with no per-vertex brush field; the simple-ribbon render mode is stroke-level through the codec and engine (SC2/VEC-04) | ✓ VERIFIED | Unchanged since the previous verification (green there); `engineRenderMode.test.ts` (10) and `payload/vectorPath.test.ts` (25) re-ran green |
| 12 | While wireframe is ON, nothing is captured, reset, re-baked, or persisted (SC3/VEC-05) | ✓ VERIFIED | `setDraftMode` refuses OFF under `draftPixelsDirty`/`wireframeMode` (scriptStrokeEdition.ts 165-169); `setWireframeMode(true)` forces Draft (202-206); `settleDraftScript` refuses wireframe FIRST (PhysicsPaintStudio.tsx 5392-5396); `runWireframeOffTransition` clears the latch before the settle (230-244); rail Select disabled with reason (PhysicsPaintToolRail.tsx 213-216). Every `setDraftMode(false)` site is the guarded setter |
| 13 | Vertex editing stays responsive at the measured reference stroke count (SC3/VEC-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Probe PASS for seam and width; cost at 1920x1080 is 75.9 ms/stroke, 789.3 ms for a 10-stroke sheet. No automated test exercises drag latency; manual-only row. See Human Verification Required |
| 14 | Vector strokes persist in `.mce` (TS + Rust), survive reopen, and export as previewed (SC4/VEC-06) | ✓ VERIFIED | Unchanged since the previous verification (green there: `mceFieldContract.test.ts`, `vectorStrokeExportParity.test.ts`); `codec.test.ts` (33) re-ran green |
| 15 | Every vector path operation is exactly one undo entry, and undo/redo re-applies it (SC5/VEC-07) | ✓ VERIFIED | Inside the one writer: defer route records at 10133 before the dirty flag; re-bake records in `onSuccess` at 10149; the failure route records nothing; the stable `rotoMoveHistory.recordAquarelleScriptEdit` is the dependency (10172). `useRotoPhysicalEditHistory.ts` 986-991 pushes one `aquarelle-script` entry. 61-20's seven pins green. CR-01 can still fabricate an operation — see VEC-07 |
| 16 | Deterministic replay and export: the same stroke yields the same raster across runs and render modes; cache keys track the vector payload (SC5/VEC-06) | ✓ VERIFIED | `determinismContract.test.ts` (12) green; probe verdict `VECTOR-SPINE PASS seam=payload-extension density=4 width=scriptFactor(1.75)`; cache/parity pins unchanged and green in the previous verification |
| 17 | Session state (pen, draft, wireframe, selection) never enters the document, revision, cache key, or export (SC3/SC4) | ✓ VERIFIED | Session signals only; export parity excludes view flags; no wireframe/draft field in `project.ts`/`project.rs`; unchanged since the previous verification |
| 18 | Path refusal is whole and fail-closed: a malformed path produces no stroke and an honest rejection message (61-09/61-10 must-have) | ✓ VERIFIED | `normaliseAquarelleAnchors` fail-closed; `handleAquarelleVectorPathEdit` (10184-10196) refuses the whole path with `VECTOR_PATH_REJECTION_MESSAGE`; codec refuses v1 bytes |
| 19 | An interrupted path-edit drag is terminated by the edit closing; no stranded drag can commit a phantom edit or resurrect a deleted anchor (new — review CR-01) | ✗ FAILED | `dragRef`/`vectorPathEditDrag` cleared only in finish/cancel (VectorPathOverlay.tsx 945, 964); handlers bound only while `editInteractive` (981-984); no cleanup on `editMutationId`; empty-space press returns at 900 without clearing the drag; stale preview wins at 700-702. Review CR-01 confirmed at HEAD; disposition `open` |

**Score:** 17/19 truths verified (1 present, behavior-unverified; 1 failed)

### Previous Gap Closure (G-1..G-8)

| Gap | Truth | Status | Root evidence |
|-----|-------|--------|---------------|
| G-1 | Draw bake + Script-Off refusal | CLOSED | `PhysicsPaintStudio.tsx` 8726-8731 (refusal before ledger, no sheet reset), 8807 (vector tail bake), `bakeAquarelleVectorCommit` 8645-8676 |
| G-2 | Path-edit re-bake | CLOSED | `commitAquarelleVectorPathEdit` 10115-10177; `runAquarelleScriptRebake` 48-63 |
| G-3 | Pointer capture | CLOSED | `VectorPathOverlay.tsx` 184-216, 861, 890, 959, 966; 61-16 pins green |
| G-4 | Key target guard | CLOSED | `handleVectorPathWindowKey` 337-350; `shortcutTextTarget.ts`; 61-16 pins green |
| G-5 | Width target from the open edit | CLOSED | `strokeSettingsModel.ts` 867-874; `PhysicsPaintStudio.tsx` 11542-11558 |
| G-6 | Input-surface exclusivity | CLOSED | `aquarelleStrokeSelection.ts` 341, 346-356; `aquarelleColorPicker.ts` 43-46 |
| G-7 | Wireframe holds Draft; settle + rail refuse | CLOSED | `scriptStrokeEdition.ts` 165-169, 202-206, 230-244; `PhysicsPaintStudio.tsx` 5392-5396; `PhysicsPaintToolRail.tsx` 213-216 |
| G-8 | One ledger entry per path edit | CLOSED | `PhysicsPaintStudio.tsx` 10133, 10149, none on failure (10153-10164), stable dep 10172; `useRotoPhysicalEditHistory.ts` 986-991; 61-20 pins green |

Every original gap is closed in the current source, not merely claimed by a SUMMARY.

### Prohibitions (must NOT)

| # | Prohibition (plan) | Status | Evidence |
|---|--------------------|--------|----------|
| 1 | No runtime dependency added to the probe; no probe import promoted into product code (61-01) | ✓ VERIFIED | No package.json change; probe files unchanged |
| 2 | No payload extension shipped before the verdict JSON exists (61-01) | ✓ VERIFIED | Probe commit precedes the payload plans; unchanged |
| 3 | No derived handles stored on an auto anchor; the evaluator must not clamp width at 1.0 (61-02) | ✓ VERIFIED | `resolveAnchorHandles` derives; `ANCHOR_WIDTH_MIN/MAX = 0.2/2.0` |
| 4 | No per-vertex brush type, per-vertex colour, or paint property beyond width (61-03) | ✓ VERIFIED | `VectorAnchor` fields: x, y, kind, optional handles, optional width |
| 5 | Width must not route through clamped `scriptScale` (61-04) | ✓ VERIFIED | `scriptWidthFactor` channel; probe width 1.75 vs clamp 1.0 |
| 6 | Derived per-sample width array must not be persisted (61-04) | ✓ VERIFIED | Widths derived in the adapter; payload stores anchors |
| 7 | No AQTL v1 acceptance, no v1 reader or upgrade path (61-05) | ✓ VERIFIED | `scriptTimelineCodec.ts` refuses v1; codec suite green |
| 8 | No `ALLOWED_ONE_LANGUAGE` entry for any new vector field (61-06) | ✓ VERIFIED | `mceFieldContract.test.ts` green (unchanged since the previous verification) |
| 9 | No second parameter bag, fifth `AquarelleTool`, or second engine for ribbon (61-07) | ✓ VERIFIED | `renderMode` is a stroke string; same engine/parameter bag |
| 10 | Vector pen must not join the `AquarelleTool` union; session state must not persist (61-08) | ✓ VERIFIED | `vectorPathSession.ts` signals only; no persistence surface |
| 11 | Overlay must not bake, capture or write engine state directly (61-09) | ✓ VERIFIED | `VectorPathOverlay.tsx` works through callbacks only; no engine import |
| 12 | No per-vertex paint properties beyond the width factor (61-10) | ✓ VERIFIED | Same type pin as #4 |
| 13 | Must not create one undo entry per selected anchor (61-10) | ✓ VERIFIED | One `beginAquarellePathEdit` call site in the Studio (grep: 1); width bundle routes through the shared commit |
| 14 | `MULTIPLIER_MIN` unchanged; the multiplier band is not reused for anchor width (61-11) | ✓ VERIFIED | `MULTIPLIER_MIN` stays 0.5; dedicated `AQUARELLE_ANCHOR_WIDTH_MIN/MAX/STEP/DEFAULT` |
| 15 | A render-mode write must not create/drop/rewrite a stroke's anchors (61-12) | ✓ VERIFIED | `aquarelleRecordState.renderMode.test.ts` pins anchors byte-identical |
| 16 | Wireframe must not persist in `.mce`, revision, cache key or export (61-13) | ✓ VERIFIED | Session signals only; export parity + cache tests green; no field in TS/Rust models |
| 17 | Nothing may bake or capture a frame while wireframe is ON (61-13) | ✓ VERIFIED | `setDraftMode` refuses OFF under wireframe; the settle refuses; `runWireframeOffTransition` clears the latch first. All `setDraftMode(false)` sites are the guarded setter |
| 18 | Close-out proofs must not weaken a gate to make it pass (61-14) | ✓ VERIFIED | Diff since the previous verification removes 8 `expect` lines, each replaced by a stricter pin of the new route (rail wireframe gate, target-resolved width commit, async commit prop, window key dispatcher, stable recorder dep, call-site count). No pin was deleted without a replacement |

## Review Findings Adjudication (`61-REVIEW.md`, `61-REVIEW-DISPOSITION.md`)

The review confirms all five original blockers are closed — the code agrees. Ten findings remain `open` in the disposition; this verification classifies them against HEAD:

| Finding | Disposition | Verifier verdict at HEAD |
|---------|-------------|--------------------------|
| CR-01 | open | **CONFIRMED — BLOCKER.** Drag state has no lifecycle beyond the overlay's own pointer handlers; see gap 1 / truth 19 |
| CR-02 | open | **REFUTED as stated.** The claimed "loser writes the script" is not reachable: `beginAquarellePathEdit` checks the same module latch BEFORE `updateAquarellePathInScript` (aquarelleStrokeSelection.ts 945 vs 948), and `runAquarelleScriptRebake` claims the latch synchronously before its first await (aquarelleVectorPathCommit.ts 49-54). The Studio's post-await body (10120-10139) has no await between `beginAquarellePathEdit` and the rebake, so a second commit resuming in that window either runs first (and becomes the writer) or reads the claimed latch and returns null before writing. Residual real issue: that post-await refusal is silent — a completed drag finishing while another script edit holds the latch is dropped with no message (same class as WR-03/IN-02). Recommendation: record this adjudication and close CR-02 as `skipped` with the latch-guard evidence, or keep only the silent-refusal part as a warning |
| WR-01 | open | CONFIRMED — gap 2 |
| WR-02 | open | CONFIRMED — gap 3 |
| WR-03 | open | CONFIRMED — gap 4 |
| WR-04 | open | CONFIRMED — gap 5 |
| WR-05 | open | CONFIRMED — gap 6 |
| IN-01 | open | CONFIRMED — `VectorDrawDraft.cursor` is written and never read (also the UI review's top priority: no live rubber-band) |
| IN-02 | open | CONFIRMED — `settleDraftScript` returns false without a message when a gate holds it (5392-5407), and `switchActiveTrack` assumes a message was surfaced |
| IN-03 | open | CONFIRMED — the dialog discards `applyAnchorWidths`' result (PhysicsPaintStrokeSettingsDialog.tsx 1713-1718) |

**Requirement dependency on open findings:** VEC-02 and VEC-07 depend on CR-01 (open). No requirement depends on CR-02 once the refutation above is accepted; its residual silent-refusal is a warning. VEC-03's hazard from CR-05/WR-04 is contained by `resolveAnchorWidthTarget` (the width write refuses a mismatch).

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` | Draw + edit gestures, pointer capture, key dispatcher | ✓ VERIFIED (with BLOCKER) | Exists, substantive, wired; drag lifecycle fails truth 19 |
| `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts` | ONE route decision + ONE single-flight rebake | ✓ VERIFIED | Leaf, no Studio import, unit-tested (152 lines of pins) |
| `app/src/components/physic-paint/view/vectorPathLatches.ts` | Dependency-free latch leaf with compare-then-write writers | ✓ VERIFIED | Signals-only module; session tests green |
| `app/src/components/physic-paint/view/shortcutTextTarget.ts` | Duck-typed text-entry predicate | ✓ VERIFIED | Text fields only — WR-05 |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Edit snapshots, select choke point, path write | ✓ VERIFIED | Guarded writers; revision-authoritative restore (WR-02) |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Bake seam, commit seam, ledger records, wireframe settle | ✓ VERIFIED | 176 added lines since the previous verification; both record sites inside the one writer |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Fail-closed width target, exit predicate | ✓ VERIFIED | Target resolver correct; exit predicate not target-aware (WR-04) |
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | Draft/wireframe setters, settle refusal copy | ✓ VERIFIED | OFF-leave refusal + ON-forces-Draft + latch-first off-transition |
| `app/src/components/physic-paint/view/aquarelleColorPicker.ts` | Picker latch releases pen + edit | ✓ VERIFIED | Entry-edge-only release |
| `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` | Fifth pen entry; Select wireframe gate + reason | ✓ VERIFIED | 213-216 disabled + title |
| `packages/efx-watercolor/probe/vector-spine/*` | Probe runner + committed result | ✓ VERIFIED | Re-run: exit 0, PASS |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `handleAquarelleStrokeEnd` | `bakeAquarelleVectorCommit` | vector tail after the record | WIRED | PhysicsPaintStudio.tsx 8807 |
| `commitAquarelleVectorPathEdit` | `runAquarelleScriptRebake` | reset + `applyAquarelleTimeline` | WIRED | 10139-10165 |
| `commitAquarelleVectorPathEdit` | `rotoMoveHistory.recordAquarelleScriptEdit` | defer + onSuccess tails | WIRED | 10133, 10149; none on failure |
| `setAquarelleSelectMode(true)` | `exitVectorPen` / `exitPathEdit` | entry choke point | WIRED | aquarelleStrokeSelection.ts 354-355 |
| picker latch | `exitVectorPen` / `exitPathEdit` | entry edge | WIRED | aquarelleColorPicker.ts 43-46 |
| wireframe ON | Draft OFF unrepresentable | guarded setter | WIRED | scriptStrokeEdition.ts 165-169 |
| wireframe ON | settle refusal | first branch | WIRED | PhysicsPaintStudio.tsx 5392-5396 |
| path-edit close | drag cleanup | none | NOT_WIRED | CR-01 — truth 19 |
| path edit | ledger | one entry per commit | WIRED | truth 15 |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Draw commit | recorded stroke + anchors | `handleAquarelleStrokeEnd` record → timeline | Yes (re-bake) | ✓ FLOWING (WR-03 contention caveat) |
| Path edit | edit id + script write | `beginAquarellePathEdit` → snapshot | Yes (re-bake) | ✓ FLOWING |
| Undo | `aquarelle-script` entry | `recordAquarelleScriptEdit` → replay port | Yes | ✓ FLOWING |
| Anchor width | selected anchors + target | `resolveAnchorWidthTarget` → shared commit | Yes | ✓ FLOWING |
| Edit-path sheet | gate + target | selection count only | Target id does not flow into the exit predicate | ⚠️ PARTIAL (WR-04) |
| Drag preview | `vectorPathEditDrag` | live drag state | Yes, but no lifecycle reset | ✗ HOLLOW on interruption (CR-01) |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| App suites (Studio, overlay, commit leaf, latches, settings, rail, history) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint` | `Test Files 14 passed (14)`, `Tests 929 passed (929)` | ✓ PASS |
| Watercolor package suites (codec, spine, engine width/mode, determinism) | `pnpm --filter @efxlab/efx-watercolor exec vitest run` | `Test Files 6 passed (6)`, `Tests 123 passed (123)` | ✓ PASS |
| One width gesture = one begin call | `grep -c "beginAquarellePathEdit(" app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 1 | ✓ PASS |
| Interrupted drag cleanup | Source inspection (no test exists) | No effect or guard clears the drag on edit close | ✗ FAIL (truth 19) |
| Debt markers in changed files | `grep -n -E "TBD|FIXME|XXX"` over the 25 changed files | no hits | ✓ PASS |

## Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `packages/efx-watercolor/probe/vector-spine/run.mjs` | `node packages/efx-watercolor/probe/vector-spine/run.mjs` | exit 0 — `VECTOR-SPINE PASS seam=payload-extension density=4 ref=10 width=scriptFactor(1.75)`; seam at 16x 0.345px; cost 1920x1080 75.9 ms/stroke, sheet10 789.3 ms | PASS |

The probe's `ref=10` is the fallback floor (`probe.ts:964-969`), not evidence of a sub-33 ms sheet. The previous report misread it; truth 13 stays behavior-unverified.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VEC-01 | 61-02, 61-03, 61-08, 61-09, 61-15, 61-16, 61-17 | Pen tool draws corner + smooth points | ✓ SATISFIED | Truths 1, 2, 3; Script-Off refusal; live re-bake. WR-03 is a contention warning |
| VEC-02 | 61-08, 61-10, 61-11, 61-15, 61-16, 61-17 | Spline-pointer edits anchors, handles, break, insert, delete, multi-select | ✗ BLOCKED | All original edit gaps closed (truths 4-7), but **CR-01 remains open** — a stranded drag can commit a phantom edit and resurrect a deleted anchor (truth 19 FAILED) |
| VEC-03 | 61-01, 61-02, 61-03, 61-04, 61-11, 61-13, 61-19 | Width varies per vertex | ✓ SATISFIED | Truth 10; target-safe width commit (truth 8); probe width arm 1.75x |
| VEC-04 | 61-03, 61-07, 61-12 | Brush type and colour are per stroke | ✓ SATISFIED | Truths 11, 16; **REQUIREMENTS.md is stale**: it still shows VEC-04 "Gaps Found" though no open finding touches it |
| VEC-05 | 61-01, 61-13, 61-18 | Wireframe preview + drag-time performance mode | ? NEEDS HUMAN | Truth 12 VERIFIED; truth 13 behavior-unverified (responsiveness). WR-01 warns that Shift+A writes a selection under wireframe (no bake) |
| VEC-06 | 61-01, 61-05, 61-06, 61-07, 61-14 | Vector strokes persist, survive reopen, export | ✓ SATISFIED | Truths 14, 16; probe PASS; **REQUIREMENTS.md is stale**: it still shows VEC-06 "Gaps Found" though no open finding touches it |
| VEC-07 | 61-09, 61-10, 61-14, 61-15, 61-16, 61-20 | Undo/redo covers each vector operation | ✗ BLOCKED | Truth 15 VERIFIED for genuine operations (61-20 closed G-8), but **CR-01 remains open** — a phantom operation can be recorded as one undo entry, so the user-facing guarantee is not achieved. CR-02 is refuted (see adjudication) |

No orphaned requirements: all seven VEC ids mapped to Phase 61 are claimed by at least one plan. Plan 61-06 additionally lists REL-02, which belongs to a different requirement family and does not create an orphan here.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `engine/VectorPathOverlay.tsx` | 945, 964 (only clears); 981-984 (bindings); 900; 700-702 | Gesture state with no lifecycle beyond its own pointer handlers | 🛑 BLOCKER | CR-01 — truth 19; phantom edit + anchor resurrection |
| `PhysicsPaintStudio.tsx` | 2717-2727 | Selection written after a refused mode entry | ⚠️ WARNING | WR-01 — selection leaks across the wireframe session |
| `PhysicsPaintStudio.tsx` | 10153-10164 | Ignored restore result behind "restored" copy | ⚠️ WARNING | WR-02 — half-applied script on a foreign revision bump |
| `PhysicsPaintStudio.tsx` | 8807 | Discarded boolean from the bake | ⚠️ WARNING | WR-03 — silent unbaked draw under contention |
| `view/strokeSettingsModel.ts` | 886-888 | Exit predicate not target-aware | ⚠️ WARNING | WR-04 — sheet and edit surface name different strokes |
| `view/shortcutTextTarget.ts` | 13, 23-40 | Yield predicate covers text fields only | ⚠️ WARNING | WR-05 — Enter on a focused button is swallowed |
| `view/vectorPathSession.ts` | 42, 78, 91 | `VectorDrawDraft.cursor` written, never read | ℹ️ INFO | IN-01 / UI review #1 — no rubber-band preview |
| `PhysicsPaintStudio.tsx` | 5402-5407 | Silent settle refusal | ℹ️ INFO | IN-02 — `switchActiveTrack` assumes a message |
| `view/PhysicsPaintStrokeSettingsDialog.tsx` | 1713-1718 | Discarded width-commit result | ℹ️ INFO | IN-03 — refusal indistinguishable from success |
| `PhysicsPaintToolRail.tsx` / dialog / `SliderStepper` | UI review | Title copy, readout typography, overlay alpha deviations | ⚠️ WARNING | `61-UI-REVIEW.md` 17/24, no UI blockers; visual rows remain human |

No debt markers (`TBD`/`FIXME`/`XXX`) exist in the 25 files changed since the previous verification.

## Behavioral / Human Verification Required

1. **Vertex-drag responsiveness (truth 13)**
   **Test:** Load the 10-stroke reference sheet at 1920x1080, drag an anchor continuously, then release.
   **Expected:** Native-feeling drag and commit without visible stutter. The probe's raster cost for a 10-stroke re-bake is 789.3 ms, so "responsive at the reference count" is a judgment.
   **Why human:** No automated harness measures interaction latency; the probe measures raster cost only.

2. **One Undo reverts one whole path edit (61-20 live row)**
   **Test:** Drag an anchor or bezier handle, then press Cmd+Z once; repeat in Draft mode and after forcing a failing re-bake.
   **Expected:** The whole path edit reverts as one step; Redo re-applies; a failed re-bake leaves the undo stack unchanged and restores the pre-edit path.
   **Why human:** Source pins prove the record sites; only a live sheet proves the on-screen round trip.

3. **Wireframe / Draft exclusivity live row (61-18)**
   **Test:** Turn wireframe on, try to leave Draft, try Select (rail and A), try Shift+A, then turn wireframe off.
   **Expected:** Draft cannot leave; Select is disabled with its reason; Shift+A does not visibly select; the off transition re-bakes once.
   **Why human:** Gates are source-pinned; the visible state is the contract. WR-01 predicts Shift+A still mutates the selection invisibly.

4. **CR-01 reproduction after the fix**
   **Test:** Start an anchor drag, press Delete mid-drag, then release; separately, start a drag and press V, then reopen the edit and hover/release on empty space.
   **Expected after fix:** The drag is cleared; the deleted anchor stays deleted; no phantom edit is committed. (Currently FAILS per truth 19.)
   **Why human:** The failing behavior is a gesture sequence with no automated harness.

5. **UI review held-out rows (`61-UI-REVIEW.md`)**
   **Test:** E5 overflow (settings sheet), E6 loading (rail during wireframe-off re-bake), E7 loading/populated (canvas during re-bake, dense sheet), E8 thumb (Simple ribbon row), plus the three UI warnings: draw-state rubber band, Vector pen title grammar, `→ n px` tabular-nums.
   **Expected:** Per `61-UI-SPEC.md`.
   **Why human:** The UI review is code-derived; no rendered pixels were inspected.

## Gaps Summary

All eight original gaps (G-1..G-8) are genuinely closed in the current source: the draw route bakes and refuses Script-Off draws, the path-edit commit re-bakes, pointer capture and the text-target key guard landed, the width commit resolves its target, the input surfaces release each other, wireframe holds Draft and refuses the settle, and the ledger records exactly one entry per edit at the single writer.

The phase goal is nevertheless not achieved because the fresh review's CR-01 is a real regression in the new path-edit code: an interrupted drag is never cleared, so a deleted anchor can be resurrected and a stale drag can commit a phantom edit — and under Draft that edit becomes a real undo entry. Truth 19 is FAILED, VEC-02 and VEC-07 are blocked by it, and truth 13 remains behavior-unverified. The review's CR-02 is refuted on the current code (the latch guard inside `beginAquarellePathEdit` prevents the claimed write-without-ledger); its residual silent-refusal belongs with WR-03/IN-02. The five warnings and three info findings are confirmed and recorded for gap-closure planning; `REQUIREMENTS.md` also needs its stale VEC-04/VEC-06 rows corrected.

---

_Verified: 2026-11-10T22:33:21Z_
_Verifier: Claude (gsd-verifier)_
