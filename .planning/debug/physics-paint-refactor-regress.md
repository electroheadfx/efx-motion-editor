---
status: verifying
trigger: "Run a focused GSD debug for regressions introduced by the Phase 36.13 Debug 01 PhysicsPaintStudio refactor."
created: 2026-07-11
updated: 2026-07-11T15:35:00Z
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

- hypothesis: "Four extracted-boundary ownership/lifecycle errors caused the regressions: stale launch echoes could replace local selection, playback preview mutated editable selection, interpolation seek raced persistence, and callback churn disposed the async launch listener."
- test: "Automated regression suites and build gates now exercise all four corrected boundaries."
- expecting: "Final diff review confirms only minimal boundary fixes, behavioral tests, and the preserved ToolRail asset correction before the authorized atomic commit."
- next_action: "Review git status/diff/log, populate Resolution, stage only regression files plus ToolRail, and create the atomic commit."
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

## Eliminated

- hypothesis: A stale pendingFrameSyncRef survives navigation and overwrites the later durable-core reopen launch.
  evidence: The failing durable-core scenario performs no openFrame/navigation call before the genuine reopen launch, so the only writer of pendingFrameSyncRef is never reached.
  timestamp: 2026-07-11T15:02:00Z

## Resolution

- root_cause: The Debug 01 extraction introduced four boundary errors: incoming stale Roto launch echoes unconditionally replaced locally selected startFrame; cached playback wrote preview frames into canonical editable launchContext.startFrame; interpolation frame synchronization could run before settings persistence and rehydrate stale enabled settings; and the async Tauri launch listener effect depended on an unstable callback, repeatedly disposing listener installation during render churn.
- fix: Added explicit pending self-sync frame ownership consumed by incoming Roto launches; removed playback writes to editable selection; awaited interpolation apply persistence before dependent frame sync; installed the external launch listener once and dispatched through a latest-callback ref; captured browser window targets for safe async cleanup; preserved the ToolRail asset import correction.
- verification: Focused Physics Paint regression matrix 236/236; broader Physics Paint matrix 469/469; durable cached relaunch 2/2; pnpm --dir app typecheck passed; pnpm --dir app build passed; git diff --check passed; no DEBUG-36-13 instrumentation remains. Live Tauri UAT pending.
- files_changed:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoInterpolationController.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/hooks/useRotoCloseLifecycle.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
