---
phase: quick-261022-pim
plan: 261022-pim
subsystem: physic-paint / watercolor
tags: [preact, signals, watercolor, stroke-selection, undo-redo, canvas-overlay, vitest]

# Dependency graph
requires:
  - phase: quick-261022-o2a
    provides: Tools/Scripts surface and Save-Script gate that the delete path reuses (context only, no code dependency)
provides:
  - Water color select mode (rail Move/Select toggle or held Cmd) with per-stroke polyline + inflated bbox outlines
  - Pointer-handler selection (newest stroke wins) and highlight above the vendor canvas; painting blocked while active
  - Alt+click delete that mutates the recorded script (marker + timeline splice) and re-bakes through the shared Apply pipeline
  - One undoable ledger command per delete + re-bake, revision-authoritative snapshots, fail-closed stale restores
  - Capture/save skip for deleted strokes without tripping the engine-1 fallback
affects: [physic-paint, watercolor-script, roto-script-apply, uat]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 22326
  tasks: 3
  commits: 3
plan_head_before: 832a15890c68c8f8ed8c70c60ca72bab1f48598e
plan_head_after: e6914b288bd2ecdcbed3ffd53b9f3c2f12cc612c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signal-only select surface: narrow leaf components read select/revision signals; the Studio render body holds no reference"
    - "Script snapshots with revision authority: undo/redo validates the live side before swapping; failures fail closed"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.tsx
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts

key-decisions:
  - "Deleting a stroke marks its mutationId and splices its payload-timeline entry; the engine-1 guide stroke stays so capture order and paint barriers remain stable."
  - "The presence gate (getRecordedAquarelleStroke) stays true for a deleted stroke; the skip is a separate continue so a delete can never trip the engine-1 fallback."
  - "Delete re-bake reuses the Apply dispatch: applyCurrentScript captures the live engine exactly like captureScriptForPersistence and dispatches through the same internal function as applyScript."
  - "Delete + re-bake is one 'aquarelle-script' ledger entry recorded only after the re-bake succeeds; replay is revision-authoritative and never calls the physical-edit coordinator."
  - "Selection is written in the overlay pointer handler, never an effect; the Studio and AquarelleCanvasLayer bodies read no select signal."

patterns-established:
  - "Frame-scoped outline listing through aquarelleUvToEnginePixel with decimated polylines (max 96 points) and full-point bounds"
  - "Compare-then-write select-mode signal with highlight clearing on disarm"

requirements-completed: []

coverage:
  - id: D1
    description: "Water color select mode outlines the current frame's recorded strokes, blocks painting, and click-selects the newest stroke under the pointer"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts (8 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#261022-pim watercolor stroke select surface"
        status: pass
    human_judgment: true
    rationale: "Outline visibility, highlight fidelity, and 'dragging paints nothing' are live-canvas behaviors the user must confirm in the running Studio."
  - id: D2
    description: "Alt+click removes the stroke from the script and re-bakes the sheet through the shared Apply pipeline with the 0/N -> N/N progress pill"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts#261022-pim applyCurrentScript"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts"
        status: pass
    human_judgment: true
    rationale: "The visual result (stroke disappears, remaining strokes re-bleed into the settled wash) and the progress pill are only observable in the running Studio."
  - id: D3
    description: "Delete + re-bake is exactly one undo step; Undo/Redo restore and re-bake in both directions; stale snapshots fail closed"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#useRotoPhysicalEditHistory aquarelle script commands (261022-pim Task 3)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts#261022-pim aquarelle delete edit snapshots"
        status: pass
    human_judgment: true
    rationale: "One-keypress-per-direction undo/redo and the re-baked visual state are live UAT behaviors."

# Metrics
duration: ~20min (prior interrupted execution) + ~10min verification
completed: 2026-10-22
status: complete
---

# Quick 261022-pim: Watercolor Stroke Select + Alt+Click Delete Summary

**Water color sheet gained a select surface (rail toggle or held Cmd) with per-stroke outlines, pointer-handler selection, Alt+click delete that re-bakes through the shared Apply pipeline, and one undoable ledger command per delete.**

## Performance

- **Duration:** ~20 min for the three task commits (prior run), plus ~10 min verification/summary in this session
- **Started:** 2026-10-22T18:29+02:00 (plan commit), first task commit 18:38+02:00
- **Completed:** 2026-10-22T18:48+02:00 (task commits); verification 2026-10-22T19:50–19:52+02:00
- **Tasks:** 3/3
- **Files modified:** 16 (4 created, 12 modified)

## Accomplishments

- Select mode: rail Move/Select toggle or held Cmd/Meta arms a pointer-owning overlay above the vendor canvas; every recorded stroke of the launch/edit frame draws a decimated polyline plus a brush-size-inflated bbox, and painting is blocked by the overlay itself.
- Click selection: hit-test through the one UV→canvas bridge, newest-wins, frame-scoped and deleted-scoped, written in the pointer handler and highlighted in accent color.
- Alt+click delete: marker-set script mutation plus payload-timeline splice; `applyCurrentScript()` captures the live engine without touching the clipboard and dispatches through the shared Apply function (same bake, progress pill, publish, display reconcile).
- Undo/redo: one `aquarelle-script` ledger entry per delete, revision-authoritative before/after snapshots, symmetric replay on Cmd+Z / Cmd+Shift+Z and the rail buttons, stacks move only on a successful re-bake.
- Capture/save: `buildAquarelleEventsFromCapture` skips deleted strokes without returning `undefined`, and the in-memory playback fallback honors the same marker.

## Task Commits

The three task commits already existed when this session started (a prior execution was interrupted before the SUMMARY). They were verified, not re-executed:

1. **Task 1: Select mode — outlines, hit-test, click-to-select, painting blocked** — `fa8b03a1` (feat, tracer)
2. **Task 2: Alt+click delete — script mutation + shared Apply re-bake with progress** — `f67fe1db` (feat)
3. **Task 3: One undo step for delete + re-bake** — `e6914b28` (feat)

**Plan metadata:** none (docs artifacts intentionally left uncommitted for the orchestrator).

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` (created) — select/selection signals, UV→px mapping, hit-test, outline listing, delete-edit snapshot ledger.
- `app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx` (created) — narrow leaf overlay; outlines, pointer-handler selection, Alt+click delete hand-off.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` (created) — mapping, hit radius, newest wins, frame/deleted scope, bbox inflation, decimation, compare-then-write.
- `app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts` (created) — marker + splice, no-op second delete, snapshot restore/stale refusal.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — stroke revision signal, deleted marker set, delete/restore helpers, entry registry.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — overlay mount and delete callback; brush cursor hidden while select/move armed; return type widened.
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` — `onAquarelleDeleteStroke` prop + ref pass-through.
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — WatercolorRail Select toggle bound to `aquarelleSelectMode` / live stroke count.
- `app/src/components/physic-paint/view/AquarelleToolRow.tsx` — picking a paint tool disarms select mode.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — `applyCurrentScript`, shared `dispatchApply` extraction, deleted-stroke skip and `forceAquarelle`.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — fallback replay skips deleted strokes.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — `aquarelle-script` entry, replay port, symmetric undo/redo branch.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — delete handler, replay port, Cmd arm in watercolor, canvas-mount wiring.
- Test files for the clipboard, history hook, and Studio source pins extended accordingly.

## Decisions Made

- Kept the engine-1 guide stroke in the engine ledger; the marker set + timeline splice is the script-level removal (stable capture order, stable paint barriers, no package change).
- Reused the Apply pipeline instead of forking a delete-specific bake; `forceAquarelle` keeps an all-deleted script on the aquarelle path so a blank sheet bakes rather than repainting guide strokes.
- Snapshots are revision-authoritative: undo validates against the edit's `after` revision, redo against `before`; any newer script mutation fails closed with both stacks untouched.
- The rail toggle's enable gate is session-wide (`aquarelleLiveStrokeCount`) because the rail has no frame prop; the overlay listing remains strictly frame-scoped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing TS2322 fixed while widening the brush cursor return type**
- **Found during:** Task 1 (AquarelleCanvasLayer overlay mount)
- **Issue:** `AquarelleBrushCursor(): JSX.Element` already returned `null` for the hidden cursor, producing baseline typecheck error `TS2322` at AquarelleCanvasLayer.tsx:68. The new select-mode early return needed the same nullability.
- **Fix:** Declared `JSX.Element | null`.
- **Files modified:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`
- **Verification:** Typecheck error count 15 vs pre-edit baseline 16 (no new errors; one pre-existing error gone).
- **Committed in:** `fa8b03a1` (Task 1 commit)

### Implementation clarifications

**2. Select-toggle count is session-wide, not frame-scoped**
- The plan's step 2 described `aquarelleLiveStrokeCount` as "current-frame" but the rail receives no play-frame prop; the implementation counts all non-deleted recorded strokes and keeps frame scoping in the overlay listing. Consequence: the toggle can be enabled on a frame with no strokes (outlines stay empty); correctness of selection/delete is unaffected.

**3. Task 2 helper superseded by Task 3 (as the plan directs)**
- `deleteAquarelleStrokeForEdit` from Task 2 was replaced by `beginAquarelleDeleteEdit` in Task 3; the Studio test pins that the former is absent. `restoreAquarelleStrokeInScript` remains exported from Task 2 but is unused at HEAD because Task 3's snapshots own restore.

**4. Failed-re-bake rollback path**
- The delete handler rolls back with the authority-checked `restoreAquarelleEditSnapshot(editId, 'undo')`; the undo/redo replay port uses `restoreAquarelleSnapshotRaw(revert)` for a failed re-bake, matching the Task 3 contract where the raw snapshot is available.

---

**Total deviations:** 1 auto-fixed (Rule 1), 3 documented implementation clarifications
**Impact on plan:** No scope creep. The one auto-fix was required by the touched function; the clarifications are consequences of the rail's existing prop surface and Task 3 superseding Task 2.

## Automated Verification

- **Targeted suites** (7 files): 482 tests passed — selection, record-state delete, clipboard, play-script controller (incl. bake), history hook, Studio source pins.
- **Full app suite:** 5418 passed, 96 todo, 1 skipped, 7 failed. All 7 failures are pre-existing and in files untouched by this quick: `PhysicsPaintRightSidebar.test.ts` (2), `PhysicsPaintWorkflowStrip.viewport.test.ts` (1), `efxPaintCompositorMatrix.test.ts` (2), `exportEngine.test.ts` (1), `paperPass.frameGuard.test.ts` (1). The `PhysicsPaintRightSidebar` failures reference the prior `261022-o2a` Scripts-toolbar layout (`repeat(4, auto)`, per-row Delete), i.e. already failing at the plan base.
- **Typecheck:** 15 `error TS` vs baseline 16 recorded at `/tmp/pim-typecheck-baseline-count.txt` — passes the `-le` gate.
- **No new dependencies, no package/format changes, no dev-server runs, no pushes.**

## Issues Encountered

None beyond the pre-existing suite failures above (out of scope: not caused by this quick's files, and not fixed here).

## Known Stubs

None. No placeholder data sources, TODO/FIXME markers, or un-wired surfaces were introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Pointer→identity mapping (T-01), delete-during-apply and double-delete (T-02), capture-fallback trip (T-03), and stale undo/redo restore (T-04) are mitigated exactly as planned and covered by unit tests.

## Live UAT — APPROVED (user-run, 2026-10-22)

The live gate is the only completion signal. The user confirmed the feature
end-to-end in the running Studio on 2026-10-22.

1. **Select outline** — Water color mode → Cmd tap or the rail Select toggle → every recorded stroke on the current frame shows its polyline + bbox; clicking one selects and highlights it; painting is blocked while active. **PASSED.**
2. **Delete** — select a stroke, then Backspace/Delete (Alt+click also works) → Apply pill advances 0/N → N/N → the stroke disappears and the remaining strokes re-bleed. Repeated deletes keep working (the re-bake replays the recorded timeline, not the engine capture). **PASSED.**
3. **Undo/Redo** — Cmd+Z / rail Undo restores the stroke and re-bakes; Cmd+Shift+Z / rail Redo removes it again. One press per direction. **PASSED.**

Follow-up UAT also approved in the same session:

- **Cmd tap toggle** — one Cmd tap selects the Move/Select tool persistently; a second tap or picking any tool leaves it. Brush mode selects Move itself (previous tool deselected); Water color selects the stroke overlay (paint tool deselected).
- **No-script state** — with no live script (cooked/reopened), Move/Select is greyed and Cmd is inert in both modes; deleting the last stroke leaves select mode.
- **Tooltips** — Move/Select names the Cmd toggle and the Backspace delete.

Follow-up commits: `ab9594a3`, `6df49ed2`, `ad9633dc`, `59f86867`, `c7ee1aee`.

## Next Phase Readiness

- Live UAT approved; the quick task is closed.
- Deferred (out of scope, pre-existing): the 7 failing suites listed above.

## Self-Check: PASSED

- Created files verified on disk; task commits `fa8b03a1`, `f67fe1db`, `e6914b28` verified as ancestors of HEAD; `plan_head_before`/`plan_head_after` measured from the persisted ledger.
- Docs artifacts (this SUMMARY, STATE.md) intentionally left uncommitted for the orchestrator.

---
*Plan: 261022-pim*
*Completed: 2026-10-22*
