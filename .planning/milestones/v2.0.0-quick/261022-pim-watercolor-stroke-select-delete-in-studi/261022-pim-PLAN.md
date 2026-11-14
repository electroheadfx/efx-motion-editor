---
phase: quick-261022-pim
plan: 261022-pim
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts
  - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []

estimate:
  tokens: 66000
  raw_tokens: 33000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "In Water color mode, select mode is active while the new rail Move/Select toggle is on OR the Cmd/Meta key is held; while it is active the watercolor brush paints nothing (no stroke reaches the vendor engine) and every recorded stroke of the current frame draws a point polyline plus a brush-size-inflated bbox."
    - "A plain click selects the stroke under the pointer (newest stroke wins when ribbons overlap) and highlights it; selection is written in the pointer handler, never by an effect."
    - "Alt+click deletes the clicked stroke from the script: its payload-timeline entry and its recorded-stroke registration leave the script, the live sheet resets, and the whole script re-bakes through the shared Apply path with the existing 0/N → N/N progress pill."
    - "Delete plus its re-bake is exactly ONE undo step; Cmd+Z restores the stroke in the script and re-bakes it back, Cmd+Shift+Z removes it again — each direction re-bakes, and a failed re-bake leaves the history stacks untouched."
    - "Saving a script after a delete serializes the stroke as absent (buildAquarelleEventsFromCapture skips it without falling back to the engine-1 serialize path)."
    - "The live gate (user-run) is the only completion signal: rows are reported automated-ready until the user confirms select outline, Alt+click delete, and Undo/Redo in the running Studio."
  artifacts:
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts
  key_links:
    - "Recorded stroke -> recordedStrokes Map + payloadTimeline (aquarelleRecordState) -> selectable list keyed by mutationId -> overlay click -> select signal -> highlight."
    - "Alt+click -> deleteAquarelleStrokeFromScript (marker + timeline splice + revision bump) -> aquarelleResetSheetRef() -> rotoScript.applyCurrentScript() -> prepareTarget + applyAquarelleEventsToKey -> applyProgressState pill -> upsertCachedFrame + loadCachedRotoReferenceFrame."
    - "Delete success -> rotoMoveHistory.recordAquarelleScriptEdit(editId) -> ONE `aquarelle-script` ledger entry -> undo/redo branch -> replay port -> restore snapshot + reset sheet + applyCurrentScript."
---

<objective>
Add stroke select + delete to the Water color sheet in the Physic Paint Studio.

1. **Select mode** = the new Water color rail Move/Select toggle is on, or Cmd/Meta is held. Recorded strokes of the current frame render an outline (point polyline + brush-size-inflated bbox) and stop the brush from painting.
2. **Click selects** the stroke under the pointer (newest wins); the selected stroke is highlighted.
3. **Alt+click deletes** that stroke from the script.
4. **Delete re-bakes**: the recorded payload timeline is mutated, the live sheet resets, and the whole script re-applies through the SAME aquarelle Apply path (bake + progress pill + publish + display reconcile).
5. **One undo step** covers delete + re-bake, and its inverse covers the re-bake back; wired into the existing Studio Cmd+Z / Cmd+Shift+Z route and the rail Undo/Redo buttons.

Purpose: the user can prune a finished watercolor script without repainting the sheet, with the same settled wash Apply Script produces.
Output: a selectable/outlined sheet, an Alt+click delete that re-bakes through the shared Apply pipeline, and a single ledger command for delete + replay.

The live UAT gate (select outline, Alt+click progress + disappearance, Undo/Redo) is the acceptance. The executor finishes at "automated-ready" and hands the three live rows to the user.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Verified in the live tree on 2026-10-22 (line numbers drift after edits):

- `app/src/components/physic-paint/view/aquarelleRecordState.ts`
  - 262-298: `recordedStrokes`, `recordedStrokeEntries`, `recordAquarelleStroke` (advances the record clock, pushes `toStudioStroke(stroke)` onto `payloadTimeline`), `setAquarelleStrokeDiffusionFrames` (patches `entry.cuisson` + `engine.diffusionFrames` IN PLACE — snapshots must preserve object identity).
  - 300-323: `getRecordedAquarelleStroke` / `getRecordedAquarellePayload`. Keep `getRecordedAquarelleStroke` returning the stroke even when deleted: `buildAquarelleEventsFromCapture` uses its presence to decide aquarelle vs engine-1 serialization.
  - 363-379: `payloadTimeline` and `getRecordedAquarellePayloadTimeline` (live array — restore with `splice(0, len, ...)`).
  - 391-396: `emitAquarelleDry`.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`
  - 280-521: `attachEngine` (vendor `WatercolorEngine` owns canvas pointer events), 443-452 `resetSheet` registered through `onResetSheetReady` (`engine.clear()` + stamp pending settle + `onSheetSessionEnd`), 499-503 `applyLiveConfig` rAF poll, 523-530 canvas style (`pointerEvents` follows `props.disabled`), 532-557 wrapper + `AquarelleBrushCursor` (zIndex 50).
  - The canvas is exact-fit over the Studio working canvas (`setCompositorLayer(true)`, no fit margin), so display rect px map linearly to canvas px.
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` 31-70 (prop signature + refs) and 205-220 (`AquarelleCanvasLayer`, `disabled={false}` hardcoded today).
- `app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts` 36-44: `aquarelleUvToEnginePixel(point, {width,height})` = `(x*w, (1-y)*h)` — the ONE UV→pixel crossing. Use it for every select/outline coordinate; never hand-roll the flip.
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` 67-131: `WatercolorRail` (Brush | Water | Pen | Lift | Dry | Undo | Redo | Trash). The engine-1 rail (with Move) is NOT rendered in watercolor mode — the new select toggle must live in `WatercolorRail`.
- `app/src/components/physic-paint/view/AquarelleToolRow.tsx` 43-78: the right-panel four-tool row (same tools, `setAquarelleTool`).
- `app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts` 50-57 `temporaryErase`/`temporaryMove` signals, 94-113 `combineEffectiveTool`/`resolveEffectiveTool`/`readEffectiveTool`, 185-205 Cmd arm (gated on `getSelectedTool() === 'paint'`).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
  - 1090 `aquarelleResetSheetRef`; 4818-4844 `handleAquarelleSheetSessionEnd` / `handleAquarelleResetSheetReady` (both clear `aquarelleMergeBaseRef`, set `aquarelleSheetHasPaintRef = false`); 4846-4852 `getAquarellePlayFrame` (launch start frame).
  - 1412-1441 temporary-arm deps + mount; `getSelectedTool: () => settings.tool`.
  - 1521-1541 `handleApplyScript` (reuses `buildRotoScriptApplyRefusalMessage` for the refusal surface); 2328-2355 `prepareRotoScriptTargetRef`.
  - 3429-3512 `useRotoPhysicalEditHistory` wiring + `undo`/`redo` wrappers; 3514+ native menu:undo/menu:redo route.
  - 4416-4424 history-availability listener (`strokeScriptInMemory`).
  - 4648-4666 `handleAquarelleStrokeEnd` / `handleAquarelleStrokeSettled`.
  - 4861-4900 `canvasMountPropsMemo.resolve([...])` — every new mount prop must be added to BOTH the deps list and the props object.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
  - 100-180 ports + controller interface (`applyScript`, `applyProgress`).
  - 280-314 `availability` (`canApply` requires a clipboard; `canCopy` requires real-key + brushes + not busy).
  - 431-439 `snapshotBoundSource` (copy path — does NOT attach aquarelle events).
  - 474-509 `captureScriptForPersistence` (drain + flush + `normalizeLogicalBrushes` + `buildAquarelleEventsFromCapture`) — the capture shape to reuse.
  - 721-817 `applyScript`: `prepareTarget` → target validation → aquarelle branch (progress pill + `ports.applyAquarelleEvents`) → brush burst path. `endOperation` is called once per branch; keep that.
  - 1107-1141 `buildAquarelleEventsFromCapture` (`if (!recorded) return undefined` = engine-1 fallback; Dry merge on `recordedOrder`, stroke wins a tie).
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` 1812-1854 `applyAquarelleEventsToKey`; 1877-1965 `aquarelleEventsFromScript` fallback (per-brush projection via `getRecordedAquarelleStroke`).
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` 582-1161: entry union (196-239), `publishAvailability` (593-603), `recordBackgroundEdit` (840-845) as the pattern for a new record method, undo/redo branches (895-1148). 10-entry cap.
- Tests: `app/vitest.config.ts` collects only `src/**/*.test.ts` (node env, no DOM). Component behaviour is pinned with `readFileSync` source pins (`PhysicsPaintStudio.test.ts` 1-40). `pnpm --filter efx-motion-editor exec` runs inside `app/`, so vitest filters are app-package-relative; all other paths in this plan are repo-root-relative.

Design decisions (locked by this plan):
- **The engine-1 guide stroke is never removed.** Each live aquarelle stroke is mirrored into engine-1 via `enqueueRecordedStroke` (Studio 4653) and stays there; deleting adds the mutationId to a `deleted` marker set in aquarelleRecordState. This keeps capture order stable (undo is a set flip, not a re-enqueue at the tail), keeps the engine's paint-barrier ledger untouched, and needs no package change. The marker is honored by `buildAquarelleEventsFromCapture` (skip, never `return undefined`) and by `aquarelleEventsFromScript`'s fallback loop.
- **No forked Apply pipeline.** `applyCurrentScript()` builds the script exactly like `captureScriptForPersistence` and dispatches through the SAME internal function that `applyScript()` uses, so bake, progress pill, publish, and display reconcile are identical.
- **One history entry.** Delete records one `aquarelle-script` command only after its re-bake succeeds. On a real key the apply creates no physical command (prepareTarget returns the record), so nothing else enters the ledger.

Scope fences: no new dependencies; no package edits; no project/package-format changes; no dev-server runs; no pushes; Preact + @preact/signals only (no useState; selection applied in the pointer handler, never an effect); new signals are read only in narrow leaves (never the Studio render body); every setter is compare-then-write. Tests: `vitest run` only, never watch; pnpm only.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Select mode — outlines, hit-test, click-to-select, painting blocked</name>
  <files>
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    app/src/components/physic-paint/view/aquarelleRecordState.ts
    app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    app/src/components/physic-paint/view/AquarelleToolRow.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <behavior>
    RED first in `aquarelleStrokeSelection.test.ts`, then implement. Pure-module cases (no DOM):
    - "maps UV points to canvas pixels through the one bridge": a stroke point `{x:0.25, y:0.75}` on a 400x200 sheet maps to `{x:100, y:50}` (y flip).
    - "hits a stroke within its brush radius and misses outside it": a horizontal stroke at uv y=0.5 with `params.size = 20` on 400x200; a click 8 px away hits, a click 40 px away misses.
    - "newest wins when two strokes overlap": two overlapping strokes, the later-recorded mutationId is returned.
    - "deleted strokes are not selectable": after `deleteAquarelleStrokeFromScript(id)`, the hit-test returns null and the outline list omits it.
    - "strokes of another playFrame are not selectable": a stroke with `playFrame: 3` is absent when the current frame is 7.
    - "bbox is inflated by half the brush size": min/max is padded by `max(6, size/2)` px on each side.
    - "setAquarelleSelectMode is compare-then-write": calling it twice with the same value changes the signal exactly once at the signal level (no extra write path, no revision bump).
    Studio source pins: the overlay is mounted inside `AquarelleCanvasLayer`; the overlay root's pointer-events are `auto` only in select mode; the overlay click reads `event.altKey`; `WatercolorRail` renders a select/Move toggle bound to `aquarelleSelectMode`; neither the Studio body nor `AquarelleCanvasLayer` reads `temporaryMove.value`.
  </behavior>
  <action>
    Test first, then implement.

    1. `aquarelleRecordState.ts`: add a module-level `aquarelleStrokesRevision` signal (init 0) and a compare-free internal `bumpAquarelleStrokesRevision()`; have `recordAquarelleStroke` bump it after the timeline push. Add a private `deletedAquarelleStrokeIds = new Set<number>()` with `markAquarelleStrokeDeleted` / `isAquarelleStrokeDeleted` / `clearAquarelleStrokeDeletion` helpers (Task 2 uses them; export the read predicate now). Do NOT change `getRecordedAquarelleStroke`'s presence semantics.

    2. New `aquarelleStrokeSelection.ts` (no Preact hooks; signals + pure functions only):
       - `aquarelleSelectMode = signal(false)`, `setAquarelleSelectMode(on: boolean)` compare-then-write, `toggleAquarelleSelectMode()`.
       - `aquarelleSelectedStrokeMutationId = signal<number | null>(null)`, `selectAquarelleStroke(id | null)` compare-then-write.
       - `aquarelleLiveStrokeCount = computed(...)` counting current-frame, non-deleted recorded strokes (reads `aquarelleStrokesRevision`).
       - `aquarelleStrokePointsPx(stroke, size)` mapping every point with `aquarelleUvToEnginePixel`, `aquarelleStrokeBoundsPx(points, size)` inflating min/max by `max(6, size/2)`.
       - `hitTestAquarelleStroke(pointPx, playFrame, size): number | null` iterating the map newest-first (`Array.from(recordedStrokes.entries()).reverse()`), skipping deleted, skipping `stroke.playFrame !== playFrame`, testing point-to-segment distance against `max(6, Number(stroke.params['size']) / 2)`.
       - `selectAquarelleStrokeAt(pointPx, playFrame, size)` = hit-test then `selectAquarelleStroke`.
       - `listSelectableAquarelleStrokes(playFrame, size)` returning `{ mutationId, pointsPx, bounds }` in recording order, decimating polylines to at most 96 points per stroke for rendering.
       - No Studio import; no render-body writes.

    3. New `engine/AquarelleStrokeOverlay.tsx` — a narrow leaf component:
       - props: `{ width, height, getPlayFrame: () => number, onDeleteStroke: (mutationId: number) => void }`.
       - reads ONLY `aquarelleSelectMode.value` and `temporaryMove.value` in its own body; returns null when neither is active (so the canvas keeps all pointer events).
       - when active: a root `div` `position:absolute; inset:0; zIndex:40; pointerEvents:auto; cursor:default`, containing an SVG `viewBox="0 0 width height"` with one polyline + one rect per selectable stroke. Selected stroke: accent color and 2 px stroke; others: a subtle dark/white dual outline. Include `data-testid="aquarelle-stroke-overlay"`.
       - `onPointerDown`: ignore non-left buttons; compute local px from `currentTarget.getBoundingClientRect()` scaled by `width / rect.width` and `height / rect.height`; call `selectAquarelleStrokeAt`; if a hit and `event.altKey`, call `onDeleteStroke(mutationId)`. Apply the selection here, in the handler — no effect. `onPointerDown` calls `event.preventDefault()`.
       - Painting is blocked purely by this overlay: it sits above the vendor canvas and is the pointer target, so the canvas never receives pointerdown/move. Do not render it when select mode is off.

    4. `AquarelleCanvasLayer.tsx`: add an optional `onDeleteStroke?: (mutationId: number) => void` prop; render `<AquarelleStrokeOverlay width={props.width} height={props.height} getPlayFrame={() => getPlayFrameRef.current()} onDeleteStroke={(id) => onDeleteStrokeRef.current?.(id)} />` between the canvas and the brush cursor; the brush cursor returns null while `aquarelleSelectMode.value || temporaryMove.value`. Keep the canvas `style.pointerEvents` unchanged.

    5. `PhysicsPaintCanvasMount.tsx`: add `onAquarelleDeleteStroke?: (mutationId: number) => void` to the props type + ref, and pass it to the layer.

    6. `PhysicsPaintToolRail.tsx` `WatercolorRail`: after Lift, add a Move/Select toggle using `moveToolIcon` (title `Select`, `aria-pressed` from `aquarelleSelectMode.value`, disabled when `disabled || aquarelleLiveStrokeCount.value === 0`), calling `toggleAquarelleSelectMode()`. Read `aquarelleLiveStrokeCount.value` — this is a narrow leaf, never the Studio. `AquarelleToolRow` and the watercolor rail tool buttons call `setAquarelleSelectMode(false)` alongside `setAquarelleTool(id)` so picking a paint tool returns to painting.

    7. `PhysicsPaintStudio.tsx`: pass `onAquarelleDeleteStroke: (id) => { void handleAquarelleDeleteStroke(id); }` into the canvas-mount props object AND into `canvasMountPropsMemo.resolve([...])`'s deps list. Add the temporary-arm deps change: `getSelectedTool: () => (activeModule.peek() === 'watercolor' ? 'paint' : settings.tool)` so a held Cmd arms the move arm in watercolor mode. Declare a placeholder `handleAquarelleDeleteStroke` callback now (selection only in this task — log-free no-op) so wiring exists; Task 2 fills it. Use a stable `useCallback` and the render-body ref pattern already used by `canvasMountPropsMemo`.

    Reactivity: no `useState`, no effect that applies selection; no `.value` reads of the new signals in the Studio or `AquarelleCanvasLayer` render bodies; no writes during render.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/pim-typecheck-task1.txt; test "$(grep -c 'error TS' /tmp/pim-typecheck-task1.txt)" -le "$(cat /tmp/pim-typecheck-baseline-count.txt 2>/dev/null || echo 999)"</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    In Water color mode a rail toggle and a held Cmd both activate select mode; while active the vendor canvas receives no pointer events, every current-frame recorded stroke renders a polyline plus its inflated bbox, clicking selects the newest stroke under the pointer, and the selected stroke highlights. Hit-test/mapping/bbox cases and the Studio source pins are green; the app suite and typecheck show no new errors. Capture the typecheck error count to `/tmp/pim-typecheck-baseline-count.txt` BEFORE the first production edit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Alt+click delete — script mutation + shared Apply re-bake with progress</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
  </files>
  <behavior>
    RED first, then implement.
    `aquarelleRecordState.delete.test.ts`:
    - "delete marks the stroke and splices its timeline entry": after `deleteAquarelleStrokeFromScript(id)`, `isAquarelleStrokeDeleted(id)` is true, the timeline no longer holds that entry, `getRecordedAquarelleStroke(id)` still returns the stroke (presence gate intact), and the revision advanced.
    - "a second delete of the same id is a no-op returning false".
    - "restoring the snapshot puts the entry back at its original index" (use the snapshot helpers added in Task 3's module boundary; if the snapshot API lands in Task 3, test only the marker + splice here and keep the restore case for Task 3).
    `physicsPaintRotoScriptClipboard.test.ts`:
    - "applyCurrentScript applies the live capture without touching the clipboard": engine fake reports two strokes that both have recorded aquarelle strokes; assert `applyAquarelleEvents` received `aquarelleEvents` with both, `clipboard.value` stayed null (or unchanged), and the apply resolved true.
    - "the capture skips a deleted stroke without falling back to engine-1": mark one stroke deleted; assert the captured `aquarelleEvents` has one stroke (not undefined / not the engine-1 burst path) and the injected port was used.
    - "progress is the shared pill": assert `applyProgress.value` was seeded `{completed: 0, total: 1}` during the call and cleared after it.
  </behavior>
  <action>
    Test first, then implement.

    1. `aquarelleRecordState.ts`: add `deleteAquarelleStrokeFromScript(mutationId): boolean` — return false when unknown or already deleted; otherwise `markAquarelleStrokeDeleted`, splice the exact `recordedStrokeEntries.get(mutationId)` reference from `payloadTimeline`, clear the selection if it matched, bump `aquarelleStrokesRevision`, return true. Add `restoreAquarelleStrokeInScript(mutationId, atIndex)` (unmark + reinsert at the original index + bump) for Task 3's undo.

    2. `physicsPaintRotoScriptClipboard.ts`:
       - `buildAquarelleEventsFromCapture`: keep `if (!recorded) return undefined` (engine-1 fallback law). Immediately after it, add `if (isAquarelleStrokeDeleted(mutationId)) continue;` so a deleted stroke is skipped WITHOUT tripping the fallback.
       - Extract the body of `applyScript` after `beginOperation(engine)` (target preparation through both apply branches, keeping every existing `endOperation` call exactly once) into a private `dispatchApply(script, source, engine)`. `applyScript()` keeps its gates and calls it.
       - Add `applyCurrentScript(): Promise<boolean>` to the interface and implementation: same gates as copy (real-key source, `refreshSourceHasBrushes`, not busy, not disposed) but no clipboard requirement; `beginOperation`; drain accepted mutations; flush source publication; revalidate engine/launch generations; capture with `normalizeLogicalBrushes(engine.getStrokes())` + `buildAquarelleEventsFromCapture` + the same `provenance`/`sourceFrame`/`sourceRevision + 1` shape as `captureScriptForPersistence`; then `dispatchApply(script, source, engine)`. On any failure before dispatch, `endOperation` exactly once (track a `dispatched` flag); `dispatchApply` owns its own end. Never write `clipboard.value`.
       - The aquarelle branch already publishes `applyProgressState` + `Applying k/N`; no progress code changes here.

    3. `physicsPaintRotoPlayScriptController.ts` `aquarelleEventsFromScript` fallback loop (1932-1937): skip a brush/continuation whose `mutationId` is deleted (import `isAquarelleStrokeDeleted`), so a script without persisted `aquarelleEvents` also omits deleted strokes.

    4. `aquarelleStrokeSelection.ts`: add `deleteAquarelleStrokeForEdit(mutationId): number | null` — guard against an in-flight delete (module-level flag) and unknown/deleted ids; call `deleteAquarelleStrokeFromScript`; return an edit id (Task 3 attaches snapshots). Add `setAquarelleDeleteInFlight`/`isAquarelleDeleteInFlight` helpers or keep the flag internal with `try/finally`.

    5. `PhysicsPaintStudio.tsx`: replace the Task 1 placeholder with the real `handleAquarelleDeleteStroke` (stable `useCallback`):
       - Guard (peek only): `isPhysicalMutationLocked()`, `rotoScript.applying.peek()`, `rotoScript.mutationLocked.peek()`, and the current cell must be a real key (`currentPhysicalCellRef`/peek equivalent already used near 3040).
       - `deleteAquarelleStrokeForEdit(mutationId)`; if null return.
       - `aquarelleResetSheetRef.current?.()`; then `const ok = await rotoScript.applyCurrentScript();`.
       - On failure: revert the in-memory delete (Task 3's snapshot restore, or `restoreAquarelleStrokeInScript` with the recorded index), publish the refusal through the same route as `handleApplyScript` (`buildRotoScriptApplyRefusalMessage(rotoScript.error.peek()) ?? error?.message` → `setLastError` + `setApplyMessage` + `setApplyStatus('error')`), and return.
       - On success: `setLastError(null)`, clear the owned refusal, and hand the edit to Task 3's `rotoMoveHistory.recordAquarelleScriptEdit(editId)`.
       - Keep the callback in the canvas-mount memo deps (Task 1 already added the prop).

    Do not touch the bake package, the paper, `frameCount: 1`, or the brush burst path.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.delete.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/pim-typecheck-task2.txt; test "$(grep -c 'error TS' /tmp/pim-typecheck-task2.txt)" -le "$(cat /tmp/pim-typecheck-baseline-count.txt)"</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    Alt+click on an outlined stroke removes it from the recorded script (marker + timeline splice + revision bump), resets the live sheet, and re-applies the whole current-frame script through the shared Apply path — the same bake, the same 0/N → N/N pill, the same publish and display reconcile. A capture after the delete yields aquarelleEvents without the stroke and never falls back to engine-1. The clipboard is not overwritten. Suites and the typecheck comparison are green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: One undo step for delete + re-bake</name>
  <files>
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <behavior>
    RED first, then implement.
    `useRotoPhysicalEditHistory.test.ts` (extend the existing harness):
    - "recordAquarelleScriptEdit pushes exactly one entry and clears redo": availability `{undo: 1, redo: 0}`; a second record after an undo clears redo.
    - "undo of an aquarelle command calls the replay port with direction undo and moves the stacks only on true": replay resolved false leaves `{undo: 1, redo: 0}`; resolved true yields `{undo: 0, redo: 1}`.
    - "redo is symmetric".
    - "a paint barrier above an aquarelle command is consumed first": observe a paint mutation after the record, undo consumes the paint barrier (engine undo called, aquarelle replay NOT called), the next undo calls the replay with `undo`.
    `aquarelleRecordState.delete.test.ts`:
    - "undo snapshot restores the entry at its original index, unmarks, and bumps the revision": delete the middle of three timeline entries, restore, assert order `[0,1,2]` by the stroke refs and `isAquarelleStrokeDeleted` false.
    - "a stale snapshot is refused": restore after a newer revision was recorded → returns null and changes nothing.
    `PhysicsPaintStudio.test.ts` pins: `recordAquarelleScriptEdit` is called only after a successful `applyCurrentScript`; the replay port restores the snapshot, calls `aquarelleResetSheetRef.current?.()`, and awaits `applyCurrentScript`; a failed re-bake restores the pre-attempt snapshot and returns false.
  </behavior>
  <action>
    Test first, then implement.

    1. `useRotoPhysicalEditHistory.ts`:
       - Add an entry variant `{ kind: 'aquarelle-script'; editId: number }` to the union.
       - Add an input port `aquarelleScriptHistory?: { replay: (editId: number, direction: 'undo' | 'redo') => Promise<boolean> }`.
       - Add `recordAquarelleScriptEdit(editId: number)` to the returned API, mirroring `recordBackgroundEdit` exactly (push, trim to 10, `discardRedoHistory`, `publishAvailability`).
       - undo: when the top entry is `aquarelle-script`, if no port return false; else `await replay(editId, 'undo')`; only on true pop applied → push redo and publish (no coordinator call). redo symmetric. Leave every existing branch byte-identical. Add the new fields to the declared return type/interface if one exists.
       - `clear()` already empties the stacks on launch identity change — no extra reset needed.

    2. `aquarelleStrokeSelection.ts` — the edit store:
       - `interface AquarelleScriptSnapshot { timeline: readonly AquarellePayloadEvent[]; deleted: readonly number[]; revision: number }` (shallow copies: same event/stroke object identity so in-place cuisson patches survive).
       - `const edits = new Map<number, { before: AquarelleScriptSnapshot; after: AquarelleScriptSnapshot }>()` with a monotonic id, capped at 10 (drop the oldest).
       - `beginAquarelleDeleteEdit(mutationId): number | null` = capture `before`, perform the delete, capture `after`, store, return id.
       - `restoreAquarelleEditSnapshot(editId, direction: 'undo' | 'redo'): AquarelleScriptSnapshot | null` — resolve the target; refuse (return null) when the live `aquarelleStrokesRevision` is not the revision recorded on the EXPECTED side (`before.revision` for undo, `after.revision` for redo); otherwise splice `payloadTimeline` in place, replace the deleted-set membership, bump the revision, clear the selection when it points at a now-missing stroke, and return the snapshot that was live before the swap (for failure rollback).
       - `restoreAquarelleSnapshotRaw(snapshot): void` — splice + membership + bump + selection cleanup, no authority check (rollback path).

    3. `PhysicsPaintStudio.tsx`:
       - Extend the `useRotoPhysicalEditHistory` input with `aquarelleScriptHistory.replay`:
         ```
         const revert = restoreAquarelleEditSnapshot(editId, direction);
         if (revert === null) return false;
         aquarelleResetSheetRef.current?.();
         const ok = await rotoScript.applyCurrentScript();
         if (!ok) { restoreAquarelleSnapshotRaw(revert); return false; }
         rotoScript.notifySourceRevision();
         return true;
         ```
       - Delete handler: call `beginAquarelleDeleteEdit(mutationId)` (replacing `deleteAquarelleStrokeForEdit` use so the snapshots are stored), then reset + apply exactly as Task 2; on failure `restoreAquarelleSnapshotRaw(before)`; on success `rotoMoveHistory.recordAquarelleScriptEdit(editId)`.
       - The existing `undo`/`redo` wrappers and the native `menu:undo`/`menu:redo` route need no change — they delegate to the hook.

    Guardrails: one ledger entry per delete; never call the coordinator for an aquarelle replay; never move stacks on a failed replay; a paint barrier on top must be consumed first (tested).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/view/aquarelleRecordState.delete.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/pim-typecheck-task3.txt; test "$(grep -c 'error TS' /tmp/pim-typecheck-task3.txt)" -le "$(cat /tmp/pim-typecheck-baseline-count.txt)"</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    Delete + re-bake is one ledger command. Cmd+Z / the rail Undo restores the stroke in the script and re-bakes it back; Cmd+Shift+Z / Redo removes it and re-bakes again. A stale snapshot fails closed with both stacks untouched, and a failed re-bake restores the pre-attempt script. A later paint stroke is undone before the delete. Suites and the typecheck comparison are green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Pointer (canvas pixels) -> script identity (mutationId) | A mis-mapped click could delete a different stroke than the one the user sees outlined. |
| Script mutation -> live bake | Delete mutates session-global recorded state that the Apply capture and the Save path both read. |
| Ledger -> script restore | Undo/redo mutates the script outside the coordinator; a stale snapshot could clobber newer paint. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261022-pim-01 | Tampering | `aquarelleUvToEnginePixel` + hit-test | medium | mitigate | One mapping through the existing bridge; unit cases pin the y flip, threshold, newest-wins, frame scoping, and deleted exclusion before the Alt+click path exists. |
| T-261022-pim-02 | Denial of service | delete during an Apply / double delete | medium | mitigate | `isPhysicalMutationLocked` + `rotoScript.applying.peek()` + `mutationLocked` guards and a module-level in-flight flag; the second delete is a no-op. |
| T-261022-pim-03 | Tampering | capture fallback trip after delete | high | mitigate | The presence check (`getRecordedAquarelleStroke`) stays true for a marked stroke, and the skip is a separate `continue`; a test asserts the captured `aquarelleEvents` excludes the stroke and the engine-1 burst path is never used. |
| T-261022-pim-04 | Tampering | undo/redo restoring a stale script | high | mitigate | Snapshot revision authority check; fail closed (`null` → stacks untouched); failed re-bake rolls the raw snapshot back. |
| T-261022-pim-05 | Information disclosure | new signals/snapshots | low | accept | Selection state and timeline snapshots stay in memory; nothing new is persisted or logged. |
| T-261022-pim-SC | Tampering | pnpm/npm installs | high | mitigate | No installs in this quick; any install would require the package-legitimacy audit and a blocking human checkpoint. |
</threat_model>

<verification>
Automated (executor, from the checkout root):
- `pnpm --filter efx-motion-editor exec vitest run` — full app suite green.
- Typecheck error count not above the pre-edit baseline (`/tmp/pim-typecheck-baseline-count.txt`).
- Targeted suites for the five touched surfaces (selection, record state, clipboard, history hook, Studio pins).

LIVE GATE — user-run in the running Studio (do not simulate, do not claim done before this):
1. Water color mode → activate the rail Select/Move toggle or hold Cmd → every recorded stroke on the current frame shows its polyline + bbox outline; clicking one selects and highlights it. While select mode is active, dragging on the canvas paints nothing.
2. Alt+click an outlined stroke → the Apply pill advances 0/N → N/N → the stroke disappears and the remaining strokes re-bleed into the settled wash.
3. Cmd+Z / rail Undo → the stroke is back and re-baked; Cmd+Shift+Z / rail Redo → it is gone again. Exactly one press per direction.

Until all three rows are confirmed live, report the work as automated-ready only.
</verification>

<success_criteria>
- Select mode (rail toggle or held Cmd) outlines current-frame recorded strokes, blocks painting, and click-selects the newest stroke under the pointer.
- Alt+click deletes the clicked stroke from the script and re-bakes through the shared Apply path with the shared progress pill; save-after-delete serializes the stroke as absent without falling back to engine-1.
- Delete + replay is one undo step in both directions, failed re-bakes and stale snapshots fail closed, and paint barriers keep their order.
- No new dependency, no package/format change, no dev-server run, no push; signals only, narrow reads, compare-then-write setters.
</success_criteria>

<output>
Create `.planning/quick/261022-pim-watercolor-stroke-select-delete-in-studi/261022-pim-SUMMARY.md` when done, recording the automated results and the three live UAT rows as PENDING until the user confirms them.
</output>
