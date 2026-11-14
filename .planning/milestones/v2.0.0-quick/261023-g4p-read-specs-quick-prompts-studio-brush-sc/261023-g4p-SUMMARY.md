---
phase: quick-261023-g4p
plan: 261023-g4p
subsystem: ui
tags: [preact, signals, efx-physic-paint, paint-studio, brush-script, watercolor, script-edition, memory-measurement]

# Dependency graph
requires:
  - quick-261022-pim
  - quick-261022-ujp
  - quick-261023-f9c
provides:
  - Session-scoped, per-frame brush script store (immutable RecordedStrokeGroup[] per frame, O(1) dirty marks, fail-closed prune)
  - DEV script-memory probe brush section (per-frame rows + session totals, frame caches kept separate)
  - ONE shared script-edition seam (selection/drag signals, geometry, keyboard consume law, per-module ports)
  - Brush Move/Select surface: outlines, badges, click-select, drag-move, Backspace/Alt delete, '<'/'>' restack
  - Engine by-id APIs deleteStroke / moveStroke / getStrokeSerials / setStrokeLabelsSuppressed / setCursorVisible
affects:
  - snapshot persistence (every brush key can now be captured)
  - any future script-edition module (Krita module, additional engines)

actuals:
  tokens: 48367
  tasks: 3
  commits: 3
plan_head_before: abc4d219d0448c482008c13cac3fae72ea7d8fb7
plan_head_after: 2c2fb99fc8c6da391df544880d048a5b7dcd9135

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-frame immutable session store keyed by the Studio's current frame"
    - "O(1) dirty mark at mutation completion; O(n) projection only at leave/Move entry/edit/DEV read"
    - "Fail-closed frame-anchor prune from the first divergent physical key record"
    - "One shared gesture implementation behind per-module ScriptStrokeEditionPort adapters"
    - "Render-body refs (plain module variables) for event-time port/deps registration"

key-files:
  created:
    - app/src/components/physic-paint/view/recordedStrokeGroups.ts
    - app/src/components/physic-paint/view/brushScriptRecordState.ts
    - app/src/components/physic-paint/view/brushScriptRecordState.test.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.test.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/engine/BrushScriptOverlay.tsx
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
    - app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
    - app/src/components/physic-paint/performance/scriptMemoryProbe.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts

key-decisions:
  - "The store keys frames from launchContextRef.current.startFrame, never stroke metadata (brush strokes carry no playFrame)."
  - "Completion only marks a frame dirty; the projection runs at frame leave, Move entry, an accepted port edit, or a DEV probe read."
  - "Pruning is fail-closed and never remaps: drop every captured frame at/after the first divergent app frame."
  - "The engine keeps tool 'move' while the overlay is armed (stepStrokeInStack requires it); badges and the engine cursor are suppressed instead."
  - "One gesture implementation (ScriptStrokeOverlay) behind ScriptStrokeEditionPort; watercolor aliases the shared signals by identity."
  - "The hook's selectTool was renamed selectToolEngine; a useCallback funnel named selectTool preserves the rail/Cmd-tap call sites and memo identity."
  - "A recreated engine re-applies Move suppression and re-projects the current frame at the engine-ready seam."

patterns-established:
  - "Per-frame session store: Map<frame, frozen entry> + Set<frame> dirty marks + monotonic revision signal read only by narrow leaves."
  - "Dual-port registration: setScriptStrokeEditionPorts({ watercolor, brush }) resolves the active surface at key time, never in a render body."
  - "Engine stand-down flags with undefined-safe defaults (=== true / !== false) so prototype-based test harnesses skip no initializer."

requirements-completed: []

duration: 22min
completed: 2026-10-23
status: complete
---

# Quick 261023-g4p: Brush Script Retention + Move Surface Summary

**Session-scoped per-frame brush script store with a fail-closed prune law, a DEV memory probe, and a Brush Move surface that shares Water color's exact gesture, selection and keyboard seam**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-23T09:49:00Z (plan created 11:49 local)
- **Completed:** 2026-10-23T10:11:00Z
- **Tasks:** 3
- **Files modified:** 24 (9 created, 15 modified across the three task commits)

## Accomplishments

- Retained every painted/left brush frame for the Studio session as an immutable, ordered `RecordedStrokeGroup[]`, with exactly one retained points copy per stroke produced by the existing `normalizeLogicalBrushes` projection.
- Added a fail-closed physical-lifecycle prune (deleted key, inserted/rippled frame, deleted slot, any first divergent record) plus launch and Studio-disposal resets.
- Extended `window.__EFX_SCRIPT_MEMORY__.snapshot()` with per-frame brush rows and session totals under `brush.scope: 'per-frame-session-store'`; the four frame caches stay separate.
- Extracted ONE shared script-edition seam (signals, geometry, keyboard consume law, port contract) and rebuilt the watercolor overlay on it with identical test ids and handlers.
- Delivered Brush Move parity: outlines and badges, click-select, drag-move with ghost, Backspace/Alt-click delete, `<`/`>` restack — with the engine's own badges and brush cursor suppressed while the overlay owns the surface.
- Added four additive engine APIs (`deleteStroke`, `moveStroke`, `getStrokeSerials`, `setStrokeLabelsSuppressed`, `setCursorVisible`) with direct-API contract cells.

## Task Commits

Each task was committed atomically:

1. **Task 1: Retain per-frame brush scripts for the Studio session** - `77ad5689` (feat)
2. **Task 2: Extract one shared script-edition seam** - `be1bb3c5` (refactor)
3. **Task 3: Brush Move parity end-to-end** - `2c2fb99f` (feat)

Plan metadata commit is produced by the orchestrator (docs artifacts are not committed by the executor).

## Store Memory Cost (MEASURED)

**Method (MEASURED):** the store's own capture path computes `approxBytes = TextEncoder().encode(JSON.stringify(groups)).byteLength` (`measureApproxBytes` in `brushScriptRecordState.ts`, `approxMethod: 'json-utf8-byte-length'`). The numbers below were produced by running `captureBrushScriptForFrame` over a structurally valid fixture (`PaintStroke` with 7-field `PenPoint` x/y/p/tx/ty/tw/spd, realistic decimal coordinates, full `BrushOpts`), then reading the entry totals. They are **measured, not estimated**, for the serialized JSON byte count.

| Fixture (one frame) | Strokes | Points | approxBytes | Bytes / stroke | Bytes / point |
|---|---:|---:|---:|---:|---:|
| light: 10 × 60 points | 10 | 600 | 59,857 | 5,985.70 | 99.76 |
| typical: 25 × 90 points | 25 | 2,250 | 222,324 | 8,892.96 | 98.81 |
| heavy: 40 × 180 points | 40 | 7,200 | 699,650 | 17,491.25 | 97.17 |
| 3-frame session total | 75 | 10,050 | 981,831 | 13,091.08 | 97.69 |

**Estimated (not measured):** JS heap cost beyond the serialized bytes (object/array headers, frozen wrappers, Map entries). A conventional 1.5–2× of the serialized figure is an estimate only; do not quote it as measured. At the measured rate, a 100-frame session of typical 25 × 90-point frames holds roughly **21.7 MB** of serialized stroke data (plus the estimated heap overhead), and is dropped on Studio disposal or launch replacement.

## Prune / Lifecycle Law (as implemented)

**Capture and cost**
- Stroke completion writes only `markBrushScriptFrameDirty(frame)` — O(1); kind `'clear'` calls `deleteBrushScriptFrame(frame)` instead.
- O(n) projection runs only at frame leave (beside the aquarelle frame-leave capture, **before** `engine.clear()`), on Move entry (the selectTool funnel), after every accepted brush-port edit, and on a DEV probe read.
- `flushBrushScriptFrame` is a no-op for a clean, already-captured frame (entry identity preserved); an empty projection deletes any stale entry rather than storing a zero row.
- Entries are deep-frozen at capture; the read API returns a shared frozen empty array when a frame was never captured.

**Frame-anchor prune (fail closed, never remapped)**
- `computeBrushScriptPruneFrame(before, after)` sorts records by `appFrame` then `keyId` and returns `min(appFrame)` at the first index whose `keyId` or `appFrame` differs; for an identical common prefix with a length change it returns the first record's `appFrame` on the longer side at the boundary; identical lists return `null`.
- `pruneBrushScriptsFromFrame(frame)` drops every captured entry **at or after** that app frame (and its dirty mark), then bumps the revision. Nothing is shifted or remapped.
- Prune is invoked only after a **successful** accepted physical replace (`replacePhysicalRecordsWithOwnership`, `replacePhysicalDocumentWithOwnership`); a rejected edit prunes nothing.

**Lifecycle**
- `resetBrushScriptStore()` runs on launch replacement (`usePhysicsPaintLaunchIntegration`) and on Studio unmount; the brush edition port is also detached there (`configureBrushScriptEdition(null)`).
- A recreated engine re-applies the Move surface at the engine-ready seam (tool `'move'`, labels suppressed, cursor hidden, current frame re-projected).

## Live UAT (user-run; this environment does not launch the app)

| # | Row | Status |
|---|---|---|
| 1 | Paint on brush keys A and B; navigate away and back: no visible behavior change (the store is passive). | PENDING |
| 2 | DEV console `window.__EFX_SCRIPT_MEMORY__.snapshot()`: brush rows for every captured frame plus totals; frameCache still its own section. | PENDING |
| 3 | Delete a key or insert/ripple a frame: stale brush frames are pruned; the probe shows no ghost counts. | PENDING |
| 4 | Close the Studio and reopen: the brush store is empty (no cross-launch leak). | PENDING |
| 5 | Brush Move mode: outlines/badges appear, click selects, drag moves, Backspace/Alt-click deletes, `<`/`>` restacks; Water color behaves exactly as before. | PASSED (2026-10-23, user-confirmed) |
| 6 | Enter/leave Move: the engine brush cursor and duplicate badges are gone while the overlay is active and return on exit. | PENDING |

## Verification

| Command | Result |
|---|---|
| `vitest run --root ../packages/efx-physic-paint` (moveTranslate, erasePointerDelete, strokeReorder) | PASS — 3 files, 51 tests |
| `pnpm --filter @efxlab/efx-physic-paint build` | PASS — ESM + DTS build success |
| App suites (brushScriptEditionPort, brushScriptRecordState, scriptStrokeEdition, PhysicsPaintStudio, scriptMemorySnapshot) | PASS — 5 files, 271 tests |
| Overall-check extras (aquarelleStrokeSelection, physicsPaintRotoScriptClipboard, usePhysicsPaintEngineActions) | PASS — 3 files, 80 tests |
| `pnpm --filter efx-motion-editor run typecheck` | **Blocked by a pre-existing baseline** — 15 errors, all in files untouched by this plan (`PaperPicker.tsx`, `physicPaintBridge.ts`, `usePhysicsPaintEngineActions.test.ts`, `physicsPaintRotoBackgroundValidatorParity.test.ts`, `PhysicsPaintPalette.test.ts`, `projectPaperRaster.test.ts`). `git diff HEAD` for every one of those paths is empty; the plan files contribute zero errors. Out of scope per the executor scope boundary — not fixed. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `redrawDisplayOverlays` drew the cursor unconditionally**
- **Found during:** Task 3 (engine cursor seam)
- **Issue:** The plan stated all three draw paths already handled a null cursor bounds. `render()` and `renderCursorOverlay()` did; `redrawDisplayOverlays()` computed bounds but drew regardless, so `setCursorVisible(false)` would leave the glyph painted.
- **Fix:** Guard the draw with `if (cursorRect)` and still assign `this.lastCursorRect = cursorRect` (null), so re-enabling repaints from a clean state.
- **Files modified:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`
- **Verification:** `EfxPaintEngine.strokeReorder.test.ts` cursor cell asserts no draw while hidden and a clean `lastCursorRect`.
- **Committed in:** `2c2fb99f` (Task 3 commit)

### Implementation notes (not behavior deviations)

- **Tool funnel naming:** the hook's `selectTool` was destructured as `selectToolEngine`; a `useCallback` funnel now owns the `selectTool` name. This preserves the existing rail/Cmd-tap call sites and their source pins while keeping identity stable per engine + lock.
- **Engine harness defaults:** the new flags use undefined-safe comparisons (`=== true` / `!== false`) because prototype-based engine test harnesses skip class field initializers.
- **Measurement harness:** the memory numbers were produced with a temporary vitest measurement file that was deleted before the Task 3 commit (measurement only; no artifact or config change).
- **Dual-port registry:** `scriptStrokeEdition.ts` gained `setScriptStrokeEditionPorts` + active-port resolution as the plan's Step 7 required; the legacy single-port setter remains for one-port callers.

**Total deviations:** 1 auto-fixed (Rule 1) + 3 implementation notes.
**Impact on plan:** No scope creep; all per-task `<automated>` suites pass. The typecheck gate cannot go green without fixing unrelated pre-existing errors.

## Deferred Issues

Logged for the cross-phase register (`.planning/WINDOWS.md` population is best-effort in this environment):

- 15 pre-existing typecheck errors in 6 untouched files (see Verification). They predate quick 261023-g4p and are outside its scope.
- Live UAT row 5 (Brush Move parity) PASSED on 2026-10-23 (user-confirmed). Rows 1–4 and 6 remain PENDING.
- Backward editability (reloading a stored brush script into the engine on navigation) was deliberately NOT implemented — the spec lists it as a later feature. Previous brush keys remain non-editable until that follow-up load-back path exists.

## Issues Encountered

- None during planned work. One RED-first expectation was confirmed (engine APIs absent) and then implemented; the port suite was written against the real store and passed 12/12 on the first green run.

## Next Phase Readiness

- Snapshot persistence can now capture every brush key through `getBrushScriptReport()`; no persistence/schema/package change was made here.
- The shared seam is ready for any additional script-edition module.
- Blockers: live UAT approval only.

---
*Phase: quick-261023-g4p*
*Completed: 2026-10-23*
