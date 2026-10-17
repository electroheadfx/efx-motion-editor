---
status: resolved
trigger: >
  I-09 — regression frame/key selection stuck on launch frame in PHYSIC PAINT
  STUDIO (Phase 55 issues, SPECS/v1.1.0-water-color/phase-55-issues/index.md).
  Symptom: clicking a timeline frame OR a key rail key does nothing; playhead
  stays on launchContext.startFrame. No console error. Regression from UI batch
  8dab034e..0ba56e12 which touched no strip/navigation file. Known silent
  gates: scrubActiveRef stuck armed, prepareNavigation blocked by
  busy/activeApply, multiTrackRowBundle undefined handlers, overlay hit-test
  steal.
created: 2026-10-17
updated: 2026-10-17
---

# I-09 — frame/key selection stuck on launch frame

## Symptoms

- **Expected behavior:** Clicking a timeline frame or a key rail key moves the playhead / edit frame to that frame.
- **Actual behavior:** Nothing happens — playhead stays on `launchContext.startFrame` (the frame the Studio was opened on from the main app).
- **Error messages:** None — no console error.
- **Timeline:** Regression from UI batch `8dab034e..0ba56e12` (right panel tabs, tool rail, PaperPicker, CSS, top bar, Studio size-routing). That diff touched **no file in the strip/navigation path**.
- **Reproduction:** In PHYSIC PAINT STUDIO, click any frame in the timeline strip **or** any key in the key rail.

## Known wiring (traced, to verify)

Frame click path:
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (~541-567) `handleRowClick` → `consumeCrossTrackClickSuppression()` swallow → `onSelectTrackFrame(trackId, frame)`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (~3458) `handleSelectTrackFrame` → early-return if `launchContext?.layerId` falsy → `handleNavigateToSyncedFrame(frame)` (~3429)
- `handleNavigateToSyncedFrame` has TWO silent early-outs:
  1. `scrubActiveRef.current === true` → writes only into `rotoScrubFrameSignal`, never propagates `startFrame`. Set in `onScrubStart` (~5340), cleared in `onScrubEnd` (~5342).
  2. `requestRotoFrameNavigation(frame)` is called with `void` — a resolved `false` is dropped.
- `useRotoNavigationCoordinator.requestNavigation` (`app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts` ~119-133) silently returns false when `beforeNavigation` returns false. `beforeNavigation` = `rotoScript.prepareNavigation`.
- `prepareNavigation` (`app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` ~805-820) returns false when `disposed || disposalRequested || activeApply || busy.peek()`.
- `multiTrackRowBundle` (`PhysicsPaintStudio.tsx` ~4347) returns `onSelectTrackFrame: undefined` when `!layerId || !document` — clicks then no-op at the row.

Key click path:
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` (~229-268) `handleClick` → `drag.consumeClickSuppression()` → `onSelectKeyRail(...)` — a **different** handler from the frame path, but the user reports BOTH dead. That is a strong hint: either a shared gate, a shared overlay stealing hit-tests, or a render-time error dropping both updates.

## Candidate causes (ordered)

1. **`scrubActiveRef` stuck armed.** A scrub that never fired `onScrubEnd` (pointer capture lost, overlay swallowing pointerup — e.g. the new `AquarelleCanvasLayer` pointer wrapper with `cursor: none`, or the always-on `PaperPicker` grid) would freeze every later frame click into scrub-only mode.
2. **Overlay stealing the timeline hit-test.** The aquarelle brush-cursor pointer layer (`AquarelleCanvasLayer` wrapper is `position:absolute; inset:0`) or an expanded Paper grid sitting over the strip. Check `document.elementFromPoint` at a frame cell during a click.
3. **`prepareNavigation` blocked** by `busy` / `activeApply` stuck true (e.g. an `endOperation` that never ran because `navigationLockHeld` stayed set).
4. **`multiTrackRowBundle` early-return** leaving `onSelectTrackFrame: undefined` (and the key-rail equivalent) because `layerId` / `document` is momentarily undefined in the standalone window.
5. **Render exception in the new tab panel / PaperPicker** dropping the Preact update.

## Current Focus

- hypothesis: CONFIRMED — two cooperating faults. (1) `completeNavigation` skipped `endOperation` when `engineState` was null, stranding `busy` true so every `prepareNavigation` returned false and `void request…` dropped it. (2) `bacc26f0` probe comments swallowed three live statements onto `//` lines (`setActiveTrackId`, startFrame reseed `selectedKeyId` assign, flush-failure `setApplyStatus`).
- test: 6 source-scan pins in `physicsPaintFrameSelectionContract.test.ts` — all RED before the fix, all GREEN after.
- expecting: exactly one gate fires on a plain frame click that should have navigated.
- next_action: live UAT (user)

## Evidence

- 2026-10-17: `completeNavigation` body is `const engine = engineState.peek(); if (engine) endOperation(engine);` — a null engine skips the busy-lease release. `prepareNavigation` then returns false on `busy.peek()`. `requestNavigation` drops the false (`void requestRotoFrameNavigationRef.current(frame)`).
- 2026-10-17: three statements sit on `//` comment lines in PhysicsPaintStudio.tsx (raw `sed`/`cat -vet` confirmed): line ~633 `selectedKeyId.value = …getRotoRealKeyRecordByAppFrame…`, line ~2685 `setApplyStatus('error')`, line ~3463 `setActiveTrackId(layerId, trackId);`. All three introduced by `bacc26f0 fix(studio-realm-divergence)`, an ancestor of the UI batch (464 commits before `8dab034e`).
- 2026-10-17: UI batch `8dab034e..0ba56e12` touched no navigation file. Its extra re-renders (tab `useState`, `activeModule` signal reads, `canvasMount` memo invalidation) raise the odds of an engine-swap render hitting the latent busy-leak — explaining the apparent regression timing.
- 2026-10-17: `PhysicsPaintRightPanel` requires `onUndo`/`onRedo`/`onClearFrame` but the Studio's `rightPanelPropsMemo` never passed them (Actions tab threw on click).
- 2026-10-17: ruler scrub `cleanup()` ran `onSeek(pendingFrame)` before `onScrubEnd` with no try/finally — a throw stranded `scrubActiveRef` armed.
- 2026-10-17: full suite 5152 passed (was 5152 before with 3015 physic-paint; now 3021 physic-paint incl. 6 new pins). viteBuild chunk-budget gate green.

## Eliminated

- Overlay hit-test steal (candidate 2): `AquarelleBrushCursor` is `pointerEvents: none` inside `demo-canvas-shell` (`overflow: hidden`). PaperPicker is inside the right panel. CSS diff is topbar-flex + `cursor: none` only — nothing covers the strip.
- `multiTrackRowBundle` early-return (candidate 4): the strip renders tracks and cells, so `layerId`/`document` are present; `onSelectTrackFrame` is wired at the viewModel seam.
- Render exception in tab panel (candidate 5): missing Actions-tab props only throw on click (default tab is `color`); full suite green; tsc shows only pre-existing errors in untouched files.

## Resolution

- root_cause: >
  Two cooperating faults. (1) `physicsPaintRotoScriptClipboard.completeNavigation`
  released the navigation lease only when `engineState` was non-null — a detached
  engine skipped `endOperation`, left `busy` stuck true, and every later
  `prepareNavigation` returned false, which `requestNavigation` dropped via
  `void request…`. Every frame click was a silent no-op. (2) Commit `bacc26f0`'s
  probe comments swallowed three live statements onto `//` lines:
  `handleSelectTrackFrame`'s `setActiveTrackId`, the startFrame reseed's
  `selectedKeyId` assignment, and the flush-failure `setApplyStatus('error')`.
  The UI batch did not touch navigation; its extra re-renders raised the odds of
  an engine-swap render hitting the latent busy-leak.
- fix: >
  `endOperation` accepts a null engine and always drops the busy lease;
  `completeNavigation` releases against the engine that took the lock
  (`navigationLockEngine`). Un-swallowed the three statements. Ruler scrub
  cleanup wraps `onSeek`+`onScrubEnd` in try/finally; window-level
  pointerup/pointercancel disarms `scrubActiveRef` (belt). Refused navigations
  surface `"Frame change is busy — try again."`. `onUndo`/`onRedo`/`onClearFrame`
  wired into right-panel props.
- verification: >
  6 source-scan pins in physicsPaintFrameSelectionContract.test.ts (RED→GREEN);
  full suite 5152 passed; viteBuild chunk-budget gate green. Live UAT pending
  (steps in SPECS/v1.1.0-water-color/phase-55-issues/index.md under I-09 fix notes).
- files_changed: >
  app/src/components/physic-paint/PhysicsPaintStudio.tsx;
  app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts;
  app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts;
  app/src/components/physic-paint/view/physicsPaintFrameSelectionContract.test.ts (new)
- commit: e82f7cbe
