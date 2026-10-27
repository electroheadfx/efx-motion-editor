---
phase: quick-261027-klx
plan: W4
wave: 4
status: complete
stop_conditions: []
resolved_conditions: []
commit: 5effa5e3
plan_head_before: ee7a3db96047fafedf8dc67864899c7bd3ac1a8a
plan_head_after: 5effa5e3535cb7d6a3d7553e1ed55bf15e51eeeb
commits: 1
files_changed: 34
insertions: 1226
deletions: 3433
date: 2026-10-27
---

# Phase quick-261027-klx — Wave 4 Summary

**Status: COMPLETE.** The Brush module surface is gone from the Studio. The
canvas mount renders only the Aquarelle sheet over the cached base; the engine
actions expose only the paper-display writes; the right panel, memory tab, tool
rail, top bar and module gate are Water color only; and the CSS lost the three
provably dead Brush selectors. `pnpm --dir app run typecheck` now exits **0**.
The app compiles for the first time since Wave 1.

## What landed (4.1 – 4.8)

1. **4.1 Canvas mount — engine 1 gone.** `PhysicsPaintCanvasMount.tsx` deletes
   `EfxPaintCanvas`, its wrapper div, every engine-1 prop (`onCompletedMutation`,
   `onPerformanceSample`, `onInputActivity`, `beforeEngineDestroy`,
   `getStrokeMetadata`, `onEngineReady`, `onNativePenInputReady`), the
   `BrushScriptOverlay` render plus its `brushScriptEditionActive` prop, and the
   three hard-coded paper URLs that fed the engine-1 constructor. Kept:
   `AquarelleCanvasLayer`, `AquarelleCachedBaseLayer`, the shell ref/style and
   all aquarelle seams including `onEnginePortReady` (Wave 3 D8).
   `PhysicsPaintCanvasMount.test.ts` and `.runtime.test.ts` were retargeted to
   the mount's shape (the engine-1 structural rows are deleted, the aquarelle
   rows stay). `MemoizedPhysicsPaintCanvasMount.ts` needed **no edit** — it
   forwards the mount's prop type by inference.
2. **4.2 Settings and lifecycle retype.** `physicsPaintStudioSettings.ts`
   imports `BgMode` / `ToolType` from `types/paintCore.ts` and drops
   `EfxPaintEngine`, `applyRotoBackgroundMetadataToEngine` and
   `applyBackgroundFallbackToEngine` (both engine-1-only). Every persisted key
   stays byte-identical. Its test drops the `EfxPaintEngine.ts` engine-source
   pin and keeps the settings unit cases.
   `usePhysicsPaintEngineLifecycle.ts` is retyped to a canvas-only lifecycle
   (`canvasMounted` + external-state cleanup); the watercolor engine is owned by
   `AquarelleCanvasLayer` and mirrored through `aquarelleEnginePortRef`.
   `usePhysicsPaintSessionController.ts` and
   `usePhysicsPaintWorkflowIntegration.ts` drop the engine type and keep frame
   export. `usePhysicsPaintLaunchIntegration.ts` drops `resetBrushScriptStore`
   and retypes `PreviewBackgroundEngine`; its test retargets the deleted-package
   types to `types/paintCore.ts`.
3. **4.3 Engine actions split.** `usePhysicsPaintEngineActions.ts` now exports
   exactly `updateSetting`, `setBackground`, `setGrainStrength`, `setGrainScale`
   with the `canMutate` / `canUpdatePaperDisplay` guards intact (the
   studio-reopen-paper-washout rule needs `updateSetting` to survive an unready
   engine) and `updatePaperDisplaySetting` as the private paper-only writer. The
   11 engine-1 tool setters and every `input.engine!.set*` call are gone
   (`grep -c "input.engine!"` = 0). Setters stay idempotent through the store's
   compare-then-write. The narrow engine surface is the app-owned
   `RotoPreviewBasePort` (`setBgMode`, optional `setEmbossStrength`), not an
   engine instance.
4. **4.4 Right panel, memory tab, tool rail, scripts panel.**
   `PhysicsPaintRightPanel.tsx`: `BrushModuleSection` import + render,
   `isWatercolorModule`, the `activeModule` import and every Brush branch are
   deleted; the top-pane union is `'color' | 'settings' | 'paper' | 'memory'`
   and the panel mounts `WatercolorModuleSection` directly.
   `RightPanelMemoryTab.tsx`: the whole Brush memory section leaves (store
   reads, rows, `brushScriptRevision` subscription, both-store totals); the
   watercolor registry is the whole script memory and the Aquarelle/audio
   counters stay.
   `PhysicsPaintToolRail.tsx`: the Brush tool set (Paint / Paint with physics /
   Erase / Move) and every engine-1 dispatch leave; `WatercolorRail` is the only
   return path and keeps Undo / Redo / Trash on the existing history props.
   `PhysicsPaintScriptsPanel.tsx`: **no-op** — after Wave 3's script-schema
   collapse the panel had no Brush rows or branches left; only the generic
   `row.brushCount` stroke counter survives (it counts non-Dry strokes on a
   watercolor document). The file is unchanged and therefore not in the commit.
5. **4.5 `frameScriptOwnership.ts` collapsed.** The `brushScriptRecordState`
   import and the `'brush'` / `'both'` returns are gone; the derivation is
   `hasWatercolor ? 'watercolor' : null` over the REAL-key predicate.
   `FrameScriptOwner` is still re-exported from `frameModuleLock.ts` (single
   declaration). Its test is rewritten to the collapsed truth table:
   real key + aquarelle script → `'watercolor'`; non-real cell → `null`;
   no script → `null`.
6. **4.6 Module gate collapse — literal-free both directions.**
   `activeModule.ts`: `ActiveModule = 'watercolor'`, `WATERCOLOR_ONLY` deleted;
   the single signal, the compare-then-write setter and localStorage
   persistence stay; `readStoredModule()` reads the legacy key for diagnostics
   and returns `'watercolor'` unconditionally — the stale-value guard contains
   **no `'brush'` literal**.
   `frameModuleLock.ts`: `FrameScriptOwner = 'watercolor' | null`;
   `lockedModuleForOwner` returns `null`; `lockedModuleTooltip` keeps only the
   watercolor text; `brushMoveAvailable` is **retyped, not deleted** —
   `computed(() => frameScriptOwner.value === 'watercolor')` — and its three
   Studio call sites keep working unchanged.
   `ModuleSwitcher.tsx`: two slots — Water color active, Krita display-only and
   native-disabled, never writes the signal. The `lockedModule` prop is kept on
   the contract and deliberately ignored (the Studio top bar no longer mounts
   the switcher; the Toolbar mount never passes a lock).
   `PhysicsPaintTopBar.tsx`: the `activeModule` import, `isWatercolor` branches
   and every Brush arm are removed; the bar always shows the aquarelle
   Pigment/Water/Edges/Grain row. `brushSize` / `opacity` stay on the props
   contract (the Studio memo still writes them; the paper single-home pin names
   them) but are no longer read — documented in the interface.
   Tests follow in the same commit: `activeModule.test.ts`,
   `frameModuleLock.test.ts`, `ModuleSwitcher.test.tsx`,
   `PhysicsPaintTopBar.test.ts`.
7. **4.7 CSS — 3 dead Brush selectors removed (−17 lines).** See the evidence
   section below.
8. **4.8 Commit** `5effa5e3` — `refactor(261027-klx): drop the Brush module
   surface from the Studio`, 34 files, +1,226 / −3,433, pathspec-scoped staging
   only.

## CSS dead-block evidence (4.7) — 3 removed, −17 lines

| # | Selector | Proof of death | Removed |
|---|---|---|---|
| 1 | `.physics-paint-options-tab-panel-brush` | Zero references anywhere in `app/src` after the Brush-tab retirement (261027-gh9g); `RightPanelBrushTab.tsx` (kept on disk) never used the class; the panel mounts only `-flat` / `-settings` / `-tool` variants. | comment + rule (6 lines + blank) |
| 2 | `.physics-paint-memory-frame-brush` | 4.4 removed the Brush memory row; `RightPanelMemoryTab.tsx` renders only `-frame-stats`. The selector was removed from the grouped rule that keeps `-watercolor` and `-stats`. | 1 selector line |
| 3 | `.physics-paint-brush-cursor-overlay` | The engine-1 ring canvas was the only mount; the StudioView auto-fix (below) removed it with the mount prop. The only remaining mention is a negative assertion in `PhysicsPaintCanvasMount.test.ts` — no production mount. | comment + rule (8 lines + blank) |

**Left in place on purpose:** `.physics-paint-memory-frame-watercolor` (not
Brush-scoped; its row retirement predates/parallels this wave and the mandate
is Brush-module-only), and every other unused selector in the file (~60 from
earlier feature retirements) — a dead rule is cheaper than a visual regression.
**Removed-block count: 3.**

## Module-gate grep gate

```
grep -rn "WATERCOLOR_ONLY\|'brush'" \
  app/src/components/shared/activeModule.ts \
  app/src/components/shared/frameModuleLock.ts \
  app/src/components/physic-paint/view/frameScriptOwnership.ts
→ exit 1 (no matches)
```

No `WATERCOLOR_ONLY`, no `'brush'` literal in any of the three.

## Commands run and results

| # | Command | Result |
|---|---|---|
| 1 | `pnpm --dir app run typecheck` | **exit 0** |
| 2 | exact plan `<verify>` — 14-suite vitest | **PASS — 14 files / 425 tests**, exit 0 |
| 3 | module-gate grep (three files) | **exit 1 — no matches** (gate passes) |
| 4 | `git add --` exact paths + commit | PASS — `5effa5e3`, 34 files, +1,226 / −3,433 |
| 5 | post-commit deletion / untracked checks | PASS — no deletions, no untracked files, tree clean |

Per-suite counts for #2:

| Suite | Tests |
|---|---:|
| `PhysicsPaintStudio.test.ts` | 277 |
| `PhysicsPaintRightPanel.test.ts` | 37 |
| `PhysicsPaintTopBar.test.ts` | 22 |
| `ModuleSwitcher.test.tsx.test.ts` | 12 |
| `panelSplitShell.test.tsx.test.ts` | 12 |
| `PhysicsPaintCanvasMount.test.ts` | 11 |
| `usePhysicsPaintLaunchIntegration.test.ts` | 11 |
| `physicsPaintRightPanelModuleGate.test.ts` | 9 |
| `frameScriptOwnership.test.ts` | 7 |
| `frameModuleLock.test.ts` | 7 |
| `usePhysicsPaintEngineActions.test.ts` | 6 |
| `physicsPaintRightPanelPaperSingleHome.test.ts` | 6 |
| `activeModule.test.ts` | 4 |
| `PhysicsPaintCanvasMount.runtime.test.ts` | 4 |

## Do-not-delete verification

Present and untouched: `BrushesDocker.tsx`, `BrushResponsePanel.tsx`,
`WatercolorBrushLibrary.tsx`, `WatercolorModuleSection.tsx`,
`AquarelleGlobalsPanel.tsx`, `engine/ScriptStrokeOverlay.tsx`,
`view/recordedStrokeGroups.ts`, `view/aquarelleRecordState.ts`,
`WatercolorRail`, the compositor and every store. The Brush-tab component file
survives on disk with its watercolor gate; only its mount stays retired
(261027-gh9g). The app-owned `previewBasePort` (`RotoPreviewBasePort`) replaces
every engine-1 preview-base call.

## Deviations from plan

1. **D1 — `PhysicsPaintStudioView.tsx` (out-of-plan, wave-caused auto-fix,
   Rule 3).** Removing `cursorOverlayCanvasRef` from the mount prop type broke
   the Studio view's brush-cursor overlay canvas. The canvas, its ref, its CSS
   class mount and the two "Brush one-law" comments are removed; Water color
   owns its DOM ring on the sheet. This deletion also made CSS block #3 dead.
2. **D2 — `PhysicsPaintPalette.test.ts` (out-of-plan, auto-fix, Rule 3).** The
   right panel's retired engine-1 props (`activeTool`, `opacity`,
   `onOpacityChange`, `edgeDetail`, `pickup`, `spread`, `smoothing`,
   `eraseStrength`, `physicsMode`, and their handlers) were dropped from
   `baseProps` so the suite still type-checks against the 4.4 panel contract.
3. **D3 — `physicsPaintRotoScriptClipboard.test.ts` (out-of-plan, auto-fix,
   Rule 3).** `settingsActions` is retyped to the surviving paper-display
   actions (`setBackground`, `setGrainStrength`, `setGrainScale`,
   `updateSetting`) against the app-owned preview-base double; the
   "blocks/resumes engine actions" rows now pin `setBgMode` /
   `setEmbossStrength` instead of the deleted tool setters.
4. **D4 — `PhysicsPaintTopBar.test.ts` destructure pin (auto-fix, Rule 3).**
   The pin sliced from `selectTool: selectToolEngine,` which 4.3 deleted. It now
   slices the paper-display destructure and asserts the tool funnel is absent.
5. **D5 — `PhysicsPaintScriptsPanel.tsx` no-op.** The plan's 4.4 row was
   already satisfied by Wave 3's script-schema collapse: no Brush script rows
   or branches remain; only the generic non-Dry `brushCount` counter is left,
   which is watercolor-correct.
6. **D6 — No-op plan files.** `MemoizedPhysicsPaintCanvasMount.ts` needed no
   edit (prop type inferred); `physicsPaintDevExport.ts` exposes no engine-1
   state and is untouched.
7. **D7 — No-op temporary-erase engine shim (Rule 2).** The held-Cmd / Cmd-tap
   module still exists for the Water color Select surface, but there is no
   engine-1 tool to switch: `getEngine` hands it a stable
   `{ setTool: () => {} }` no-op and `getSelectedTool` is always `'paint'`. The
   tap stays the ONE behaviour; the engine seam can never mutate anything.
8. **D8 — Studio test retargets (the bulk of `PhysicsPaintStudio.test.ts`).**
   Engine-1 describes were deleted (`261023-j5b paint-settings carrier seams`)
   or rewritten to the surviving watercolor seams: preview-base clear/reload
   navigation, the single `applyFrameModuleState` funnel, the ONE memoized
   ledger port, two restore-time clock seeds (launch + track switch; the
   engine-ready max-raise left with the canvas-ready seam), aquarelle-only
   composite/projection pins, and negative pins for every removed brush symbol
   (`resetBrushScriptStore`, `clearBrushScriptFrame`, `remapBrushScriptsForRecords`,
   `getBrushScriptPlayFrame`, `BrushScriptOverlay`, `engine.clear()`,
   `engine.forceDry()`, `engine.flushPendingStrokeFinalizations()`, brush Move
   gates). The `getAcceptedTarget` pin became a negative: the Studio publishes
   the ONE port identity; the controller consumes the accepted target.
9. **D9 — Studio production comment reword.** The flush comment named
   `forceDry` inside the `flushStudioStateRef` slice, which tripped the test's
   naive literal scan. Reworded to "wet-layer finalize call" — comment only, no
   behaviour change.
10. **D10 — CSS scope.** Only the three provably dead Brush selectors were
    removed. `.physics-paint-memory-frame-watercolor` and the pre-existing
    unused-selector backlog were deliberately left (§4.7 "if you cannot prove
    it is dead, leave it").
11. **D11 — Test-support typecheck fix.** `PhysicsPaintRightPanel.test.ts` had
    an unused `readFileSync` import after its source-scan rows were retargeted;
    removed (TS6133).

## Remaining waves

Wave 4 is the last app-side wave. Wave 5 (Rust / host side) is **not started**
by this execution. `STATE.md` / `ROADMAP.md` are owned by the orchestrator's
closeout, not by this summary.
