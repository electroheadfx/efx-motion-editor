# Quick Task 261029-lsr: Script-authoritative undo for aquarelle strokes - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Task Boundary

Script-authoritative undo/redo for aquarelle strokes.

Symptom: undo removes the script event but leaves the live-sheet paint (and vice
versa), so the frame drifts from its bake; after undo, Move/Lift can see a display
that disagrees with the script.

Required: undo/redo re-bake the frame after mutating events, reset the live sheet,
and never leave a capture able to commit pre-undo sheet pixels. Add a deterministic
pin: after undo, display digest == bake digest. Native UAT is the user's.

**Base branch:** `dev` HEAD. The literal branch name in the request
(`v2.0.0/lift-three-state`) is 61 commits behind `dev` — the user confirmed the work
runs on `dev`, not on that stale branch.

**Known starting point (verified during discussion):**
`app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` records an
ordinary stroke as `{ kind: 'paint', mutationId }` (line ~731) and undoes it with
`inputRef.current.undoPaint()` (line ~947), which reaches
`AquarelleEnginePort.undo()` → `WatercolorEngine.undo()` — a framebuffer-tile
restore that never touches the recorded script. The delete/move path already does
the right thing: `beginAquarelleDeleteEdit` → `aquarelleScriptHistory.replay`
(PhysicsPaintStudio.tsx ~4737-4753) restores the script snapshot, calls
`aquarelleResetSheetRef.current?.()`, then re-applies the frame timeline.

</domain>

<decisions>
## Implementation Decisions

### Unrecorded strokes
- When a stroke was never recorded in the script (script recording OFF, or a raster
  Lift that pins/records nothing), undo stays **engine-only**: restore tiles via the
  existing `undoPaint()` path, no script mutation and no re-bake.
- Script-authoritative undo applies only to strokes that have a recorded script
  event. Never invent a script trace for recording-off paint.

### Re-bake scope/cost
- Reuse the existing delete machinery: treat an undo of a recorded stroke as a
  **single-stroke delete edit** — `beginAquarelleDeleteEdit([mutationId])` style
  before/after script snapshots, reset the live sheet, re-apply through the shared
  Apply/re-bake path, and record it as one ledger command. Redo is the inverse
  snapshot swap.
- No dedicated lighter re-bake path and no second rendering authority.

### Capture guard
- Add a **monotonic sheet/capture epoch** that is bumped on every script mutation
  (record, delete, move, undo, redo, reset).
- A capture records the epoch when it starts and **refuses its commit** if the epoch
  moved before the commit lands. Late acks and async merges must be dropped, never
  written into the frame's baked pixels.
- No settle/await barrier before undo: Cmd+Z must stay immediate.

### Undo stack shape
- Recorded strokes **keep the `paint` ledger entry kind**; the entry carries (or can
  resolve) the script edit identity so undo/redo take the
  `aquarelleScriptHistory.replay` route instead of `undoPaint()`.
- Unrecorded paint entries keep the current `undoPaint()` / `redoPaint()` route.
- The stack model stays one ledger; do not fork a second script-authoritative stack.

### Deterministic pin shape
- Real GPU pixels are not reachable under `vitest run` (no WebGL; every existing
  bake test mocks the engine). The pin is an **orchestration pin**: extract the
  replay body into a pure module with injected ports, then assert
  - step order: `invalidate` → `restore` → `reset` → `rebake`;
  - `digestRenderedFrameBytes(publishedBytes) === digestRenderedFrameBytes(displayBytes)`
    using `performance/aquarelleRenderSplitCapture.ts`'s existing FNV-1a digest;
  - a capture queued before undo resolves after undo and is rejected, never published.
- Plus a source-contract row in the house `PhysicsPaintStudio.test.ts` style.
- Real pixels remain the user's native UAT. No headless-GL harness, no new infra.

### Auto-key-paint composites
- Include them: the same recorded-stroke predicate applies before the
  `undoPaint()`/`redoPaint()` calls in the `auto-key-paint` branch, so
  create-key + first-stroke undo is script-authoritative too.

### Undo during playback
- A script-authoritative undo **stops playback first**, exactly like the existing
  engine undo path (`input.playback.stop()`), then re-bakes. No cross-frame bake,
  no silent no-op during playback.

### Claude's Discretion
- Exact epoch ownership (ref vs signal vs module counter) and where the check seats.
- Whether the edit identity is stored on the entry or resolved from `mutationId` at
  replay time (the latter keeps the entry shape untouched — prefer it if the
  recorded registry can answer reliably).
- How the deterministic pin measures "display digest == bake digest" using the
  existing `digestRenderedFrameBytes` helper from
  `performance/aquarelleRenderSplitCapture.ts`.

</decisions>

<specifics>
## Specific Ideas

- The user explicitly named the failing invariant: **after undo, display digest ==
  bake digest**. The pin must assert equality of the two, not merely that a re-bake
  was requested.
- "Never leave a capture able to commit pre-undo sheet pixels" is a hard
  requirement, not a nice-to-have: an epoch check at commit time, not at capture
  start only.
- Native UAT is the user's. Automated work stops at the deterministic pin.

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — the
  undo/redo ledger; `paint` entries and the `aquarelle-script` route live here.
- `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts` — the
  `undo`/`redo`/`snapshotCurrentFrame` controller and the engine port calls.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `aquarelleScriptHistory`
  port (~4737), `aquarelleResetSheetRef` (~1474), stroke acceptance and
  `recordAquarelleStrokeWhenEnabled` (~7082), delete path (~7106).
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` —
  `markAquarelleStrokeDeleted` / `clearAquarelleStrokeDeletion`,
  `aquarelleStrokesRevision`, `getRecordedAquarelleStrokeEntries`.
- `app/src/components/physic-paint/engine/aquarelleEnginePort.ts` — the narrow port
  (`undo`/`redo` return whether the engine moved).
- `packages/efx-watercolor/src/playground/Engine.ts` — `travel()`, `undo()`,
  `redo()`, `docState()`; the doc state carries paper/reference only, never the
  script.
- `app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts` —
  `digestRenderedFrameBytes` for the deterministic pin.

</canonical_refs>
