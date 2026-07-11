---
status: awaiting_human_verify
trigger: "Run a focused GSD debug for regressions introduced by the Phase 36.13 Debug 01 PhysicsPaintStudio refactor."
created: 2026-07-11
updated: 2026-07-11T16:47:00Z
---

# Physics Paint Refactor Regressions

## Symptoms

### Expected behavior

When playback is stopped, manual timeline clicks and previous/next controls update the canonical selected frame and all projections. Interpolation can be disabled persistently per layer and generated frames disappear. During playback, key utility state is frozen and non-actionable, then recomputed once after Stop.

### Actual behavior

Manual Roto navigation remains stuck at frame 0 while playback advances. The interpolation toggle immediately remains or returns enabled. Key utility controls visibly update on every playback frame.

### Error messages

No reported error messages.

### Timeline

The regressions appeared after the Phase 36.13 Debug 01 refactor that extracted PhysicsPaintStudio ownership into hooks, roto, play, engine, bridge, and view modules.

### Reproduction

Open Physics Paint in Roto mode on branch `phase-36.13-debugs`. Starting at frame 0, click another timeline cell or previous/next; toggle interpolation off; start playback and observe Insert, Duplicate, Copy, Paste, and Delete across playback ticks.

## Scope and Constraints

- Debug 01 regression fix only; do not start Debug 02 or dynamic-spacing work.
- Do not add feature scope.
- Do not restore ownership to `PhysicsPaintStudio.tsx`.
- Do not add Roto internal `useEffect`.
- Do not create compatibility re-exports.
- Do not start the dev server; live UAT is user-owned.
- Preserve the existing uncommitted asset-import correction in `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` and include it in the atomic regression commit if still uncommitted.
- Diagnose the manual navigation, playback progression, and interpolation toggle data flows separately before patching.
- Use Preact Signals, computed/selectors, and explicit actions; keep playback preview distinct from editable selection.
- Add behavioral regression tests for canonical navigation, persistent interpolation disable/projection, and playback utility stability.
- Run focused tests, broader Physics Paint tests, `pnpm --dir app typecheck`, `pnpm --dir app build`, and `git diff --check`.
- Commit atomically after automated gates pass, then stop at live UAT. Do not mark fully accepted before user UAT.

## Current Focus

- hypothesis: "Confirmed: cached Roto playback was additive because PhysicsPaintCanvasStack left the editable engine/preview-base/live-alpha shell and cached reference visible while adding the transient playback image."
- test: "Focused red/green render-ownership contract plus focused/broad Physics Paint tests, typecheck, build, diff check, and live Tauri UAT."
- expecting: "During playback only the transient cached frame is visible; canonical selected frame and utilities stay frozen; Stop reveals the selected editable visual once."
- next_action: "Await live Tauri UAT for exclusive playback composition and Stop restoration; do not mark Debug 01 accepted yet."
- reasoning_checkpoint:
  hypothesis: "The transient playback image composites with frame 1 because the view has no exclusive visual-owner state: it leaves the editable engine canvas/preview base/live alpha and cached reference visible while adding the playback image."
  confirming_evidence:
    - "Live UAT shows the frozen selected blue frame simultaneously with the advancing green playback frame."
    - "Studio always passes cachedRotoReferenceUrl and mounts PhysicsPaintCanvasMount while passing cachedRotoPlaybackUrl."
    - "CanvasStack renders all owners together, and CSS places the second engine canvas at z-index 4 above the z-index 3 overlay."
  falsification_test: "If a focused view contract already suppresses every editable/reference visual owner while playback is active, or if adding that suppression does not eliminate the red composition test, this hypothesis is wrong."
  fix_rationale: "Make playback-active select the transient cached image as the sole Roto visual owner while preserving the mounted engine/session state invisibly; Stop already clears frame/isActive, so the selected editable visual is revealed once without canonical state mutation."
  blind_spots: "DOM/source tests cannot inspect real engine pixel alpha composition; live Tauri UAT remains required after automated gates."

- reasoning_checkpoint:
  hypothesis: "Four extracted-boundary ownership/lifecycle errors caused the regressions: stale launch echoes could replace local selection, playback preview mutated editable selection, interpolation seek raced persistence, and callback churn disposed the async launch listener."
  confirming_evidence:
    - "Each targeted test failed before its corresponding correction and passes after it."
    - "The durable relaunch test observed zero listeners before the callback-ref fix and receives the real launch context afterward."
    - "Focused 236 tests, broad 469 tests, typecheck, build, and diff/debug checks pass."
  falsification_test: "Any original behavioral regression reproducing in the focused tests, durable relaunch test, or live UAT would disprove the complete correction."
  fix_rationale: "Each change restores the canonical owner or external lifecycle boundary rather than mirroring state: editable launch frame stays canonical, playback stays transient, persistence precedes dependent seek, and the bridge listener has stable installation with latest callback dispatch."
  blind_spots: "Automated DOM tests cannot verify the exact real Tauri parent echo multiplicity or visible utility freeze timing; live UAT remains required."
- reasoning_checkpoint:
  hypothesis: "Self-originated stale launch echoes, playback writes, and interpolation message ordering each mutate or overwrite canonical editable state from a transient/stale source."
  confirming_evidence:
    - "Playback onFrame directly writes launchContext.startFrame, which is Studio's canonical currentFrame and key-utility dependency."
    - "Interpolation controller dispatches frame sync before awaiting settings persistence."
    - "Incoming launch handling unconditionally resets Roto session state and replaces launchContext."
  falsification_test: "If removing playback writes, preserving one pending local selection across its stale launch echo, and persisting interpolation before seek do not make the exact behavioral tests pass, the ownership/order hypothesis is wrong."
  fix_rationale: "Keep launchContext.startFrame editable-only, make cached playback transient-only, and serialize interpolation persistence before dependent navigation so stale projections cannot win."
  blind_spots: "Live parent may emit more than one stale launch echo; automated tests cover the one-response bridge contract and live UAT must confirm the real event sequence."
- tdd_checkpoint: RED tests required before production fixes

## Evidence

- timestamp: 2026-07-11T11:12:00Z
  checked: Manual timeline click/navigation trace
  found: PhysicsPaintWorkflowStrip cell/transport events call requestRotoFrameNavigation through useRotoNavigationCoordinator.requestNavigation. The Roto session updates only its short-lived session.currentFrame, then the configured display port useRotoPersistenceIntegration.openFrame updates launchContext.startFrame, loads/clears the engine, and sends physic-paint:seek-frame. Studio derives currentFrame and all workflow projections exclusively from launchContext.startFrame. Any incoming launch context is passed through usePhysicsPaintLaunchIntegration, which resets persistence/navigation sessions and replaces launch state.
  implication: launchContext.startFrame is the canonical editable selected frame; the session currentFrame is transactional only. A stale parent launch echo after frame sync can overwrite the local selection and reset the session.

- timestamp: 2026-07-11T11:14:00Z
  checked: Playback trace
  found: useRotoCachedPlayback owns transient playback frame/image, but PhysicsPaintStudio playback.onFrame also calls setLaunchContext(...startFrame: appFrame). Because currentFrame is derived from launchContext.startFrame, every playback tick rebuilds the Roto session and workflow/key-utility projection around the preview frame.
  implication: playback preview incorrectly mutates the canonical editable selection. The transient owner must remain useRotoCachedPlayback; launchContext.startFrame and utility dependencies must remain frozen, with utility actions disabled while playback is active.

- timestamp: 2026-07-11T11:16:00Z
  checked: Interpolation toggle trace
  found: The checkbox calls useRotoInterpolationController, which mutates physicPaintStore settings through useRotoTimelineActions, refreshes generated projection, and updates launchContext.rotoInterpolationSettings. When disabling from a generated display frame, transaction.nextCurrentFrame differs and the controller immediately sends frame sync before the interpolation apply payload is acknowledged. Incoming launch contexts hydrate their persisted interpolation settings back into the canonical store and reset the Roto session.
  implication: physicPaintStore is the canonical interpolation owner, but stale launch hydration can overwrite the just-disabled value because frame synchronization races persistence. The action must persist settings before frame synchronization and stale launch echoes must not re-enable local canonical state.

- timestamp: 2026-07-11T11:18:00Z
  checked: Existing uncommitted ToolRail correction
  found: PhysicsPaintToolRail.tsx changes all physics-paint icon imports from ../../assets to the correct ../../../assets path after the view-module move.
  implication: Preserve and include this independent refactor correction in the authorized atomic commit.

- timestamp: 2026-07-11T14:19:00Z
  checked: Red/green regression ownership tests
  found: The three new tests failed before production edits on missing pending frame-sync ownership, playback mutating launchContext, and interpolation seek preceding awaited persistence; all 94 PhysicsPaintStudio contract tests pass after the minimal corrections.
  implication: The ownership/order hypotheses are directly reproduced and corrected at the extracted module boundaries without restoring Studio ownership or adding Roto effects.

- timestamp: 2026-07-11T15:02:00Z
  checked: Remaining durable-core relaunch sequence
  found: The failing test never performs frame navigation before emitting reopenContext; it starts and saves frame 8, persists/reloads the store, then attempts a genuine frame-8 launch. Therefore pendingFrameSyncRef is never populated in this scenario.
  implication: The bare pending marker is not the cause of this failure.

- timestamp: 2026-07-11T15:14:00Z
  checked: Tagged launch/reset observability in the single durable-core test
  found: paintHarness.launchListeners is zero when reopenContext is emitted, and resetRotoSessionForLaunch/resetForLaunch never execute. The test remains on the original editable session, which correctly labels frame 8 Current.
  implication: The relaunch event is being missed before it reaches launch integration.

- timestamp: 2026-07-11T15:25:00Z
  checked: usePhysicsPaintLaunchBridge listener lifecycle against Studio render churn
  found: The effect depends on applyIncomingLaunchContext, whose identity changes with extracted hook input objects. Each render disposes an in-flight async listener installation; when listen resolves, the disposed branch immediately unlistens it. The durable test's zero-listener observation directly matches this mechanism.
  implication: The production bridge listener must be installed independently of callback identity and dispatch through a ref to the latest launch handler.

- timestamp: 2026-07-11T15:31:00Z
  checked: Durable cached-only relaunch after stable listener correction
  found: The unchanged integration test now receives reopenContext, resets the editable session, loads the saved PNG through the preview-base path, clears stale strokes, and passes both durable-core tests.
  implication: Stable external listener ownership fixes the relaunch/reset regression and validates the exact production mechanism.

- timestamp: 2026-07-11T16:05:00Z
  checked: Live Tauri UAT after the first automated-ready checkpoint
  found: Manual navigation, interpolation disable, utility freeze, playback advancement, and tool stability now work. During cached Roto playback, however, the originally selected first-frame blue drawing remains visibly rendered while a green playback frame animates over it, producing additive frame-1-plus-playback composition.
  implication: Canonical editable state freezing is correct, but visual ownership during playback remains wrong. The transient playback frame must visually replace/suppress editable Roto canvas/reference output while playing, and Stop must reveal the selected editable frame once without changing canonical selection.

- timestamp: 2026-07-11T16:18:00Z
  checked: Studio-to-view render ownership and canvas stack CSS
  found: Studio passes rotoCachedPlayback.frame.dataUrl as cachedRotoPlaybackUrl while always passing cachedRotoReferenceUrl and always mounting PhysicsPaintCanvasMount. PhysicsPaintCanvasStack renders the engine canvas first, then the cached reference, Play preview, cached Roto playback image, and onion children together inside one overlay. No prop or class represents exclusive Roto playback composition. CSS places engine canvases at z-index 2/4 and the overlay at z-index 3; cached playback has no distinct z-index, while cached reference is z-index 1 within the overlay.
  implication: The live screenshot is predicted directly by the render tree: playback adds an image but does not hide the editable engine canvas or reference layers, and the upper engine canvas can remain above the playback overlay. The defect is visual-owner selection at the extracted Studio/View boundary, not playback frame advancement or canonical selection state.

- timestamp: 2026-07-11T16:42:00Z
  checked: Red behavioral render-ownership contract
  found: The focused command `pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts -t "delegates cached Roto playback state"` fails 1/1 because Studio provides no cachedRotoPlaybackActive visual-owner state. The test also requires reference suppression, a dedicated playback image class, and hiding the mounted editable shell while active.
  implication: The regression has a deterministic sub-second red-capable test at the actual Studio/View composition seam before production edits.

- timestamp: 2026-07-11T16:43:00Z
  checked: Minimal exclusive visual-owner fix against focused regression
  found: Studio now passes rotoCachedPlayback.isActive to the view; CanvasStack keeps the engine mounted but hides its shell while active, suppresses cached reference/Play preview/onion children, and renders the transient cached Roto frame with a dedicated top-layer class. The same focused command passes 1/1. Stop already clears frame and isActive synchronously through the playback hook, so the unchanged selected engine/reference visual is revealed without launchContext mutation or reload.
  implication: The fix addresses only rendering ownership, preserves Preact controller state and Stop semantics, and does not restore ownership to Studio or add effects.

## Eliminated

- hypothesis: A stale pendingFrameSyncRef survives navigation and overwrites the later durable-core reopen launch.
  evidence: The failing durable-core scenario performs no openFrame/navigation call before the genuine reopen launch, so the only writer of pendingFrameSyncRef is never reached.
  timestamp: 2026-07-11T15:02:00Z

## Resolution

- root_cause: The Debug 01 extraction introduced four state/lifecycle boundary errors, and the follow-up ownership correction exposed a fifth visual boundary error: incoming stale Roto launch echoes replaced local selection; cached playback mutated canonical editable selection; interpolation seek raced persistence; the async launch listener was disposed by callback churn; and after playback was made transient-only, PhysicsPaintCanvasStack still rendered the editable engine/preview-base/live-alpha canvas and cached reference while adding the transient playback image, causing additive frame composition.
- fix: Added explicit pending self-sync ownership; kept playback out of editable selection; serialized interpolation persistence before seek; stabilized the launch listener; and made cached Roto playback the exclusive visual owner while active by hiding (not unmounting) the editable canvas shell, suppressing cached reference/Play preview/onion overlays, and using a dedicated top playback layer. Stop continues clearing transient frame/activity and thereby reveals the unchanged selected editable visual once.
- verification: Previous focused 236/236 and broad 469/469 gates passed for the first correction. Follow-up exclusive-composition regression went red 1/1 then green 1/1; focused playback/view matrix 148/148; broader current Physics Paint matrix 334/334; pnpm --dir app typecheck passed; pnpm --dir app build passed; git diff --check passed; no DEBUG instrumentation remains. Live Tauri UAT pending.
- files_changed:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoInterpolationController.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/hooks/useRotoCloseLifecycle.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
