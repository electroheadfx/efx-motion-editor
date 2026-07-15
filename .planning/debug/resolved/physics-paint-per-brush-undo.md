---
status: resolved
trigger: "Physics Paint per-brush Undo must preserve immediate queued/active cancellation and restore finalized brushes from the existing exact engine checkpoint while publishing restored pixels as a newer source-frame cache revision."
created: 2026-07-15T07:50:52Z
updated: 2026-07-15T13:41:00Z
---

## Current Focus

hypothesis: "Resolved: same-frame automatic cache acceptance retriggered reference loading and cleared finalized Undo history."
test: "Native finalized-brush Undo passed after narrowing the Preact effect dependencies to stable launch identity; focused regression, Undo/cache suites, full app tests, typechecks, and package build also pass."
expecting: "Finalized Undo continues to restore the exact pre-brush checkpoint without same-frame cache publication clearing active history."
next_action: "Closed after approved native UAT; Phase 36.14 is no longer blocked by this debug."
known_pattern_candidates:
  - "State Management: an accepted cache publication is incorrectly treated as a navigation/reload transition and destroys volatile active-frame history."
  - "Async/Timing: the asynchronous cache acceptance explains why immediate Undo works but finalized Undo runs after history destruction."
reasoning_checkpoint:
  hypothesis: "Same-frame automatic cache acceptance causes finalized Undo to no-op because a broad launchContext effect reload calls engine.clear(), erasing allActions and undoStack after finalization and before Undo."
  confirming_evidence:
    - "PhysicsPaintStudio.onCompletedMutation captures finalized pixels, and useRotoFramePersistenceCoordinator.upsertCachedFrame returns a new launchContext with refreshed cachedRotoFrames while acceptPixelCache removes the frame from dirtyFrames."
    - "useRotoFrameEditingController's reference-loading effect depends on the whole input.launchContext object, so that cache-only replacement reruns loadReferenceFrame for the unchanged current frame and engine."
    - "createRotoReferenceLoader sees the frame as non-dirty, resolves the newly accepted cached frame, then calls engine.clear(); EfxPaintEngine.clear() synchronously empties allActions, undoStack, undoneActions, queued/active ownership, and visible buffers before mounting the accepted PNG as the internal preview base."
    - "The UAT timing exactly differentiates this path: immediate queued/active Undo occurs before the asynchronous cache commit/effect, while finalized Undo occurs after it and both shared UI entry points become no-ops."
    - "Immediate queued Undo working in native UAT proves the edited mutation-aware engine artifact is loaded; the old implementation would flush/rasterize queued work."
  falsification_test: "If native finalized Undo still reaches an engine whose allActions and undoStack survive same-frame cache acceptance after the dependency correction, then another boundary such as snapshot restore/redraw or cache commit visibility is responsible."
  fix_rationale: "Cache publication is not navigation or launch hydration. Depending on stable operationId/layerId preserves true launch changes, while engine/currentFrame/workflow dependencies and the explicit native launch/navigation loaders continue to handle real mount and frame transitions without clearing active-frame history after every automatic cache commit."
  blind_spots: "No runtime console trace was needed because the production state transition is deterministic in source. Native UAT is still required to verify exact restored pixels and ensure no later caller clears history or masks the restored cache."

## Symptoms

expected: "Ctrl/Cmd+Z and the left tool-rail Undo icon both undo the latest accepted Physics Paint brush. Queued Undo removes the PaintStroke, queued job, and preview without rasterizing it. Active Undo cancels/invalidate the matching job and restores the exact visible pre-brush state. Finalized Undo removes the PaintStroke and restores its exact pre-brush snapshot and cache revision."
actual: "Native UAT on 2026-07-15 refined the symptom: both Undo entry points work when invoked within the approximately 500 ms queued/active cooperative-finalization window, but become visible no-ops after the brush reaches its final rendered state."
errors: "No reported error message; the failure is visible state/history divergence."
started: "After the cooperative stroke-finalization/pointer-latency refactor; Undo was explicitly deferred when that debug closed."
reproduction: "Open Physics Paint Roto, paint one or more brushes, then press Ctrl/Cmd+Z or click the left tool-rail Undo icon."

## Investigation Contract

- Treat the immutable PaintStroke record in `allActions` as the authoritative identity of each accepted brush.
- Bind the stroke, queued/active finalization job, Undo snapshot, completed mutation, and automatic cache publication through the same `mutationId` or equivalent stable identity.
- Keep this internal history distinct from the dedicated pre-36.14 Copy Script / Apply Script quick clipboard behavior.
- Inspect `allActions.length`, `undoStack.length`, `pendingStrokeFinalizations`, `activeStrokeFinalization`, `strokeFinalizationGeneration`, queued preview ownership, visible dry/wet/saved-wet buffers, completed mutation publication, and automatic cache revision.
- Preserve the removed immutable PaintStroke in a shape structurally capable of future Redo, but do not implement Redo.

## Locked Product Decisions

- Preserve immediate queued and active Undo without flushing or waiting for the 500 ms threshold.
- Use the existing exact engine `UndoSnapshot`; do not add a second full-frame Roto cache snapshot stack unless measured evidence proves it necessary.
- Bound finalized engine snapshots to the latest 10 brushes; queued brushes need no snapshot.
- `EfxPaintEngine.allActions`, exposed by `getStrokes()`, is the sole mutable active-frame PaintStroke script.
- Keep script lifetime active-frame-only; safely hand off/invalidate source work, then reset history on destination navigation. Never keep per-frame PaintStroke maps.
- Cached-only/reopened frames remain pixel-first and do not recover scripts.
- the dedicated pre-36.14 Copy Script / Apply Script quick will deep-copy `getStrokes()` into a separate volatile reusable clipboard; do not implement that workflow here.
- Never persist scripts or clipboard in `.mce`, sidecars, cache metadata, launch URLs, or bridge payloads.
- Keep per-brush Undo; retain removed immutable history only for possible future Redo structure, without implementing Redo.

## Required Focused Verification

1. Immediate queued cancellation creates no final pixels.
2. Active Undo restores exact checkpoint.
3. Finalized Undo restores exact dry/wet/saved-wet state.
4. Snapshot history is bounded to 10 finalized brushes.
5. Three rapid queued brushes undo in reverse order.
6. Mixed queued/active/finalized brushes preserve reverse order.
7. Trailing continuation is removed only with its owning brush.
8. Earlier baseline/brushes remain intact.
9. `getStrokes()` includes every accepted active-frame brush.
10. `getStrokes()` updates after queued, active, and finalized Undo.
11. Clear and Undo-to-empty leave `getStrokes()` empty.
12. Stale cancelled work cannot re-add history or pixels.
13. Finalized Undo captures restored pixels at a newer source-frame revision.
14. Stale pre-Undo encoding cannot overwrite restored cache.
15. Cached-base repaint Undo preserves the flattened base.
16. Navigation resets active history only after safe source handoff.
17. No script persistence or transport expansion is introduced.
18. Keyboard and tool-rail Undo share the same action.
19. Existing rapid-input/finalization/Clear/cache/interpolation/preview/export regressions remain green.

## State-Specific Undo Contract

1. Queued brush:
   - remove its PaintStroke and queued job;
   - remove its queued preview;
   - do not rasterize it merely to undo it.
2. Actively finalizing brush:
   - invalidate/cancel the matching job;
   - prevent every remaining continuation and stale publication;
   - restore the exact visible state before that brush.
3. Finalized brush:
   - remove the matching PaintStroke;
   - restore its exact pre-brush snapshot and cache revision.

## Known Call Path

- Keyboard handler calls `actions.undo()`.
- Tool-rail button calls the same Undo controller.
- `useRotoFrameEditingController.undo()` calls `EfxPaintEngine.undo()`.
- `onPointerUp()` appends the brush to `allActions` and `pendingStrokeFinalizations`.
- `pushUndoSnapshot()` is called later by `startNextStrokeFinalization()`.
- `EfxPaintEngine.undo()` currently calls `flushPendingStrokeFinalizations()` before reading `undoStack`.

## Eliminated

- hypothesis: "Failures in the broad root Vitest invocation indicate current app regressions."
  evidence: "The root runner recursively collected .claude/worktrees. The current app PhysicsPaintStudio suite passed 43/43; failures were exclusively stale worktree copies with missing node_modules or superseded assertions. app/vitest.config.ts scopes the real app gate to src/**/*.test.ts."
  timestamp: 2026-07-15T08:20:47Z
- hypothesis: "The full physics-package gate failures were introduced by per-brush Undo."
  evidence: "Only two AnimationPlayer Play-frame annotation tests fail; every engine/core/brush test, including all changed Undo/cache seams, passes. The failing files are unchanged and exercise Play sequencing rather than Undo history or Roto cache publication."
  timestamp: 2026-07-15T08:22:03Z

## Evidence

- timestamp: 2026-07-15T07:54:22Z
  checked: ".planning/debug/knowledge-base.md"
  found: "No prior entry overlaps the Physics Paint Undo symptoms; the only recorded bug concerns timeline keyframe label hit testing."
  implication: "There is no known-pattern shortcut; investigate this engine state transition directly."
- timestamp: 2026-07-15T07:54:22Z
  checked: "Common bug pattern map and current working tree"
  found: "The symptom matches Async/Timing (queued/active continuation races) and State Management (dual sources of truth/invalid transitions). The working tree contains only the untracked debug session file."
  implication: "The investigation can isolate engine behavior without confounding pre-existing code edits."
- timestamp: 2026-07-15T07:54:22Z
  checked: "Code discovery for cooperative finalization"
  found: "The indexed graph identifies EfxPaintEngine.flushPendingStrokeFinalizations in packages/efx-physic-paint/src/engine/EfxPaintEngine.ts and existing engine tests including EfxPaintEngine.cooperativeFinalization.contract.red.test.ts, liveAlphaCache, and pointerInput."
  implication: "The engine package already has a likely public-interface test seam for a red Undo regression test."
- timestamp: 2026-07-15T07:56:54Z
  checked: "EfxPaintEngine symbol-level state flow"
  found: "onPointerUp creates mutationId, appends the immutable PaintStroke to allActions, then queues DeferredStrokeFinalization. startNextStrokeFinalization later calls pushUndoSnapshot(mutationId), but UndoSnapshot stores no mutation identity. undo() first flushes all pending/active finalizations, then pops the last snapshot, restores buffers, and independently pops allActions."
  implication: "The code directly exhibits the hypothesized temporal/identity split: queued Undo cannot select/remove the accepted stroke without first rasterizing it, and snapshot/action matching is positional rather than identity-based."
- timestamp: 2026-07-15T07:56:54Z
  checked: "Undo entry-point search"
  found: "Keyboard Ctrl/Cmd+Z invokes actions.undo(); the Roto controller and standalone toolbar route to engine.undo(). No separate entry-point implementation explains the visible no-op."
  implication: "The engine's Undo semantics are the common failing boundary and should be tested/fixed there."
- timestamp: 2026-07-15T07:57:43Z
  checked: "Complete engine finalization and test implementations"
  found: "The existing cooperative-finalization test explicitly codifies the obsolete behavior 'flushes N pending brushes before Undo'. Public pointer tests already prove onPointerUp gives queued preview and allActions separate immutable point copies. The controller's undo only delegates to engine.undo, so a focused engine contract is the correct behavioral seam."
  implication: "The first RED test should replace the flush-before-Undo expectation with the required queued cancellation behavior, rather than testing private data shape in a new isolated harness."
- timestamp: 2026-07-15T07:57:43Z
  checked: "Visible-buffer restoration scope"
  found: "Undo snapshots currently preserve dry ImageData, wet buffers, drying positions, stroke opacity, and saved-wet buffers, but omit mutationId and other per-stroke ownership. Active finalization mutates these buffers in phases after snapshot capture."
  implication: "A same-identity pre-stroke snapshot can restore active/finalized visible state exactly; queued strokes need cancellation only because no raster mutation has occurred yet."
- timestamp: 2026-07-15T08:00:24Z
  checked: "Queued-Undo RED test via node .../vitest.mjs run packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts"
  found: "The focused test fails deterministically: expected no finalization side effects, but finalized contains ['brush-1', 'undefined']. The first value is queued brush raster finalization; the second is Undo publication from the harness listener."
  implication: "Direct causal evidence confirms flushPendingStrokeFinalizations() inside undo() violates the queued-brush contract by rasterizing the brush before removing it."
- timestamp: 2026-07-15T08:02:58Z
  checked: "Complete EfxPaintEngine implementation and focused engine tests before GREEN"
  found: "The engine stores mutationId only on DeferredStrokeFinalization; PaintStroke and UndoSnapshot omit it. startNextStrokeFinalization snapshots before any prepare/raster phase. completeActiveStrokeFinalization publishes the stroke mutation, while undo() flushes all work, pops an identity-free snapshot/action, and publishes an unrelated fresh Undo mutation id."
  implication: "Queued cancellation can be made green by selecting the latest action/job before flush, but the full contract requires mutationId on PaintStroke and UndoSnapshot plus generation-aware active restoration and identity-preserving completed publication."
- timestamp: 2026-07-15T08:08:48Z
  checked: "First queued-Undo GREEN run"
  found: "The original rasterization failure is gone; the test now stops only because its Object.create harness did not initialize the newly added structural undoneActions stack."
  implication: "The behavior change reached the intended queued-cancellation branch without finalization. Update the harness state, not engine behavior, before rerunning."
- timestamp: 2026-07-15T08:09:20Z
  checked: "Queued-Undo GREEN rerun, 19 focused cooperative-finalization tests"
  found: "All 19 tests pass. The queued brush is removed by mutationId with no snapshot capture, raster finalization, completed-mutation publication, or remaining queued preview; the removed PaintStroke is retained in undoneActions."
  implication: "Queued state contract is green. Proceed vertically to active finalization rather than broadening the implementation speculatively."
- timestamp: 2026-07-15T08:10:18Z
  checked: "Active-finalization RED tracer"
  found: "Current Undo synchronously completes the active brush before restoring, then the captured stale active object can publish again; observed publications are ['brush-1', '1', '1'] instead of one Undo publication, and generation remains uninvalidated."
  implication: "Active Undo must not flush. It must invalidate generation first, remove the active pending job, restore its same-id snapshot, clear active ownership, and only then publish Undo."
- timestamp: 2026-07-15T08:11:18Z
  checked: "Active-finalization GREEN rerun, 20 focused tests"
  found: "All tests pass. Active Undo increments generation, detaches the same-id job, clears active ownership, restores dry/wet/drying/saved-wet buffers from the pre-brush snapshot, suppresses a stale completion call, and publishes one Undo completion using mutationId 1."
  implication: "Active state contract is green. Proceed to finalized history/cache semantics."
- timestamp: 2026-07-15T08:16:00Z
  checked: "Finalized-Undo tracer via node .../vitest.mjs run EfxPaintEngine.cooperativeFinalization.contract.red.test.ts"
  found: "All 21 focused tests pass. With two identity-bearing actions and snapshots, Undo restores only snapshot 2, preserves action/snapshot 1, moves action 2 into undoneActions, and publishes one Undo completion carrying mutationId 2."
  implication: "Identity-aware finalized engine restoration is already GREEN in the intentional working tree. The remaining proof is the real automatic Roto cache capture boundary and package-wide regression/type gates."
- timestamp: 2026-07-15T08:18:58Z
  checked: "Engine-to-cache boundary regressions in EfxPaintEngine.liveAlphaCache.test.ts and rotoLivePixelCacheTransactions.test.ts"
  found: "All 15 tests pass. The real completed-mutation listener copies the restored dry/wet surfaces only after finalized Undo restoration and receives mutationId 2; a same-id Undo capture advances the frame revision from 1 to 2, commits restored pixels, and rejects the older in-flight finalized encoding."
  implication: "Finalized snapshot and automatic cache-revision semantics are GREEN end-to-end at the public listener/transaction seams without adding Redo or replay. Proceed to typecheck and broader package/app gates."
- timestamp: 2026-07-15T08:20:47Z
  checked: "TypeScript and focused regression gates"
  found: "Physics package tsc and app tsc both complete with zero output/errors. The four focused suites pass 51/51 tests. A root-config app test invocation accidentally included stale .claude/worktrees because the root runner has no include boundary; the current app PhysicsPaintStudio suite itself passed 43 tests, while failures came only from old worktree copies with missing dependencies/outdated assertions. git diff --check is clean."
  implication: "Current-tree code is type-safe and focused behavior is GREEN. Re-run current app suites from app/ with app/vitest.config.ts to exclude worktree noise, then run the full package/app test gates."
- timestamp: 2026-07-15T08:22:03Z
  checked: "Correctly rooted app and physics package suites"
  found: "The scoped app Physics Paint suites pass 52/52. The full physics package run passes all 43 engine/core/brush tests touched by this fix, but two pre-existing AnimationPlayer Play-frame annotation tests fail (expected first frame 3, got 2; expected point count 0, got 12). These failures are unrelated to Undo and occur outside changed files."
  implication: "Undo/cache regression coverage is GREEN. Record the unrelated full-package animation failures as baseline debt, re-run the updated finalized cache test, and run the full app suite plus changed-file gates."
- timestamp: 2026-07-15T08:26:15Z
  checked: "Intentional working-tree diff and final changed-file gates"
  found: "The diff is limited to the engine, PaintStroke identity type, and three Undo/cache contract suites. git diff --check is clean. The two changed engine suites pass 28/28 and the changed app cache transaction suite passes 8/8. Previously completed persistent gates remain valid: full app suite 72 passed/3 skipped files and 761 passed/1 skipped/101 todo tests, both typechecks pass, and the isolated physics package suite has only the two documented unchanged AnimationPlayer baseline failures."
  implication: "The per-brush Undo fix is automated-verified and can be resolved without changing unrelated AnimationPlayer behavior. Native visible UAT remains required before claiming user acceptance."
- timestamp: 2026-07-15T08:32:27Z
  checked: "Mounted package resolution after native UAT failure"
  found: "app/vite.config.ts explicitly aliases the bare package, /preact, and /animation imports to packages/efx-physic-paint/src files and excludes the package from dependency pre-bundling; the workspace lock also links app directly to the local package."
  implication: "A stale dist/index.mjs is not the mounted development runtime explanation. The next RED test must cross the actual Studio/controller lifecycle and observe engine identity/history rather than repeat package-source harnesses."
- timestamp: 2026-07-15T08:35:00Z
  checked: "Studio Undo routing and engine ownership"
  found: "PhysicsPaintStudio passes one `undo` callback from useRotoFrameEditingController to both usePhysicsPaintStudioStudioKeyboard and PhysicsPaintToolRail. The controller calls `input.engine?.undo()`. Engine lifecycle stores the ready engine in both state and engineRef; completed-mutation cache capture reads engineRef.current."
  implication: "Keyboard/tool-rail parity is expected and their shared visible no-op points below entry-point dispatch. The differentiating test is whether the controller callback sees the current mounted engine after lifecycle changes, before probing history internals again."
- timestamp: 2026-07-15T08:38:00Z
  checked: "Canvas-to-controller engine identity path"
  found: "EfxPaintCanvas creates one engine, forwards that same object after init, PhysicsPaintCanvasMount forwards it unchanged, and handleEngineReady synchronously writes both engineRef.current and state. The tool rail directly invokes the passed callback and the studio keyboard directly invokes the same action."
  implication: "There is no observed alternate engine construction or entry-point interception. A more specific state divergence is required; restored PaintStroke records are now suspicious because mutationId was added only to newly accepted strokes and made optional in serialized types."
- timestamp: 2026-07-15T08:40:00Z
  checked: "Engine serialization/load and Roto launch restore"
  found: "serializeProject omits mutationId. loadProjectData maps serialized strokes into allActions without mutationId and resets undoStack to []. usePhysicsPaintEngineLifecycle loads launchContext.editableState as soon as the mounted engine is ready. The edited undo() returns immediately when the last action lacks mutationId, then would also return if no matching snapshot exists."
  implication: "This is a direct mounted-runtime divergence absent from the source harnesses: visible restored Roto state has no runtime Undo identity or pre-stroke snapshots. It proves loaded-state Undo is broken, but native UAT after drawing may have an additional trailing-action cause."
- timestamp: 2026-07-15T08:42:00Z
  checked: "AllActions writer scan"
  found: "Besides onPointerUp, stopPhysics appends a synthetic diffusion action without mutationId. The new undo() always selects only allActions[allActions.length - 1] and immediately returns when mutationId is absent."
  implication: "A completed physics run can block Undo of the brush below it. The exact live sequence must be confirmed against Studio actions and normal/physics modes before choosing between loaded-baseline and trailing-physics fixes."
- timestamp: 2026-07-15T08:45:00Z
  checked: "Studio physics action lifecycle"
  found: "The left rail's hold actions call engine.startPhysics(mode) on press and engine.stopPhysics() on release. stopPhysics bakes the result, appends the identity-free synthetic action when any ticks ran, and publishes a separate physics completion."
  implication: "The mounted history can end with an identity-free record immediately after a real brush. The pointer-only tests never constructed this public history shape, explaining why they passed while native Undo remained visibly inert after using Physics Paint actions."
- timestamp: 2026-07-15T08:47:00Z
  checked: "First invocation of the new trailing-physics RED tracer"
  found: "The command did not execute Vitest because the previously used root node_modules/vitest/vitest.mjs path no longer exists in this workspace. No behavioral verdict was produced."
  implication: "This is test-runner path setup, not evidence for or against the hypothesis. Resolve the existing pnpm/Vitest executable and rerun the exact focused test."
- timestamp: 2026-07-15T08:45:35Z
  checked: "Current GREEN-phase undo implementation and confirmed trailing-continuation tracer"
  found: "undo() still fixes actionIndex at allActions.length - 1 and returns on undefined mutationId. The tracer history is [identity-free loaded baseline, mutationId 2 brush, identity-free physics continuation], so the selection guard deterministically blocks the existing finalized restoration branch."
  implication: "The minimal change is localized to target-range selection/removal; snapshot matching and queued/active/finalized restore ordering do not need redesign."
- timestamp: 2026-07-15T08:47:18Z
  checked: "First GREEN suite command via pnpm exec vitest run"
  found: "pnpm reported Command 'vitest' not found because Vitest is declared under the app package rather than the workspace root, although the installed root pnpm binary exists."
  implication: "The source change has not yet received a behavioral verdict. Invoke the already installed node_modules/.pnpm/node_modules/.bin/vitest directly; do not alter test configuration or dependencies."
- timestamp: 2026-07-15T08:48:01Z
  checked: "22-test cooperative GREEN run after bounded range selection/removal"
  found: "21/22 tests pass. The target brush is restored and removed, the loaded baseline is preserved, and undoneActions contains [latestBrush, physicsContinuation]. The sole failure expected only [latestBrush]."
  implication: "Engine behavior matches the explicit requirement to keep removed derived history structurally suitable for future Redo. Correct the outdated tracer expectation to include the continuation, then rerun."
- timestamp: 2026-07-15T08:48:47Z
  checked: "Cooperative finalization suite after aligning future-Redo structural expectation"
  found: "All 22 tests pass. Queued cancellation, active invalidation/restoration, finalized restoration, latest-brush selection through trailing continuation, loaded-baseline preservation, and removed suffix retention are GREEN together."
  implication: "The TDD cycle is GREEN. Proceed to cache, controller/UI, typecheck, and scoped package/app regression gates; no speculative refactor is needed."
- timestamp: 2026-07-15T08:51:06Z
  checked: "Engine cache suite plus app cache/controller/keyboard/Studio boundary suites"
  found: "EfxPaintEngine.liveAlphaCache passes 7/7. App rotoLivePixelCacheTransactions, useRotoFrameEditingController, physicsPaintStudioKeyboard, and PhysicsPaintStudio pass 57/57 across 4 files."
  implication: "Restored-surface cache publication and both shared Undo entry-point boundaries remain GREEN. Proceed to typechecks and scoped full package/app gates."
- timestamp: 2026-07-15T08:51:49Z
  checked: "Physics package and app TypeScript gates"
  found: "pnpm --filter @efxlab/efx-physic-paint check and pnpm --dir app typecheck both complete with zero errors."
  implication: "The identity-bearing history and range-removal change is type-safe in both the package and mounted app. Run the full scoped test gates next."
- timestamp: 2026-07-15T09:05:00Z
  checked: "Resumed-session working tree and final verification state"
  found: "The working tree contains exactly the five recorded Undo/cache source and test files plus this debug session. git diff --check is clean. The intentional diff still implements mutation-bound snapshots, latest identity-bearing brush selection through a trailing continuation suffix, exact restore-before-publication, and future-Redo-capable removed history. Fresh duplicate test/build commands required interactive approval, so the previously completed persistent verification results remain the available automated verdict."
  implication: "No code change occurred after the recorded full automated gates. The only unresolved success criterion is native visible UAT in the user's real workflow; move to awaiting_human_verify rather than claiming resolution."
- timestamp: 2026-07-15T09:44:46Z
  checked: "Locked snapshot bound and active-frame navigation history contract after foreground handoff recovery"
  found: "Two focused RED tests exposed remaining gaps: pushUndoSnapshot retained 12 snapshots because production still capped at 25, and the navigation Clear boundary emptied getStrokes()/undoStack but retained undoneActions from the prior frame."
  implication: "The persisted automated-ready checkpoint was incomplete. Apply only the locked cap of 10 and clear internal removed-action history at Clear/load frame boundaries."
- timestamp: 2026-07-15T09:46:00Z
  checked: "Focused GREEN rerun after minimal snapshot/navigation fixes"
  found: "The cooperative finalization suite passes 24/24. Finalized snapshots retain mutationIds 3-12 after 12 captures, and Clear resets getStrokes(), undoStack, undoneActions, active mutation ownership, queued/active work, and visible buffers. loadProjectData also resets removed-action history while preserving loaded strokes as an identity-free baseline."
  implication: "Verification areas 4, 11, and 16 are now explicitly covered without a per-frame script map, second pixel snapshot stack, Redo, or replay."
- timestamp: 2026-07-15T09:46:56Z
  checked: "Final focused, broad, typecheck, build, persistence-surface, and diff gates"
  found: "Focused engine Undo/cache suites pass 31/31; scoped mounted app cache/controller/Studio suites pass 52/52; the full scoped app suite passes 72 files with 3 skipped and 761 tests with 1 skipped/101 todo; physics and app typechecks pass; the Physics Paint package build passes; git diff --check passes; and changed files contain no package, store, bridge, persistence, transport, or serialized project expansion. The full physics package suite is 69/71 with only the same two unchanged AnimationPlayer Play-frame annotation baseline failures."
  implication: "All locked automated verification areas are satisfied or covered by unchanged green regressions. Stop at awaiting_human_verify for the user's eight native scenarios; do not claim UAT acceptance."
- timestamp: 2026-07-15T10:00:00Z
  checked: "Latest native UAT after the automated-ready checkpoint"
  found: "Immediate pre-finalization Undo still works, but after one brush reaches final rendered state both Cmd/Ctrl+Z and the left Undo icon are visible no-ops."
  implication: "The current automated model is invalid at the mounted finalized boundary. Reopen production-first investigation and locate the first runtime divergence before changing behavior or tests."
- timestamp: 2026-07-15T10:12:00Z
  checked: "Mounted native artifact, shared UI routing, and engine ownership"
  found: "The native Tauri window loads the app frontend, whose Vite aliases resolve @efxlab/efx-physic-paint and /preact to package source for development/build. Both Cmd/Ctrl+Z and the left Undo icon route through the same useRotoFrameEditingController.undo callback to the current engine object. Native queued/active Undo working also proves the mutation-aware engine artifact is loaded, because the old engine would flush queued work before Undo."
  implication: "The divergence is not a stale package artifact, separate UI handler, or alternate mounted engine. Trace the current engine state after finalized automatic cache acceptance."
- timestamp: 2026-07-15T10:20:00Z
  checked: "Finalized mutation to automatic source-frame cache and same-frame reference reload"
  found: "Finalization publishes completedMutation(kind=paint, mutationId=N); PhysicsPaintStudio copies the live alpha canvas and starts source-frame revision R+1. On accepted commit, upsertCachedFrame replaces launchContext.cachedRotoFrames and acceptPixelCache removes the source frame from dirtyFrames. useRotoFrameEditingController depends on the whole launchContext object, so this cache-only replacement reruns loadReferenceFrame for the unchanged frame/engine. createRotoReferenceLoader now sees the frame as clean, resolves the just-accepted cached frame, and synchronously calls engine.clear() before setting that PNG as the engine preview base."
  implication: "This is the first proven mounted divergence and explains the timing boundary: the asynchronous finalized cache commit destroys volatile active-frame Undo history; immediate Undo occurs before that commit/effect."
- timestamp: 2026-07-15T10:22:00Z
  checked: "Exact engine state at the later finalized Undo action"
  found: "Before the unintended reload, the current engine has latest allActions mutationId=N, matching finalized UndoSnapshot mutationId=N, no pending/active job, and a completed finalized cache revision. engine.clear() then empties allActions, undoStack, undoneActions, pending/active ownership, and visible live buffers. At the later Undo, the same mounted engine computes actionIndex=-1 and returns before mutation selection, snapshot lookup, restore, completedMutation('undo'), copyLiveAlphaCanvas, or a newer cache revision. PhysicsPaintCanvasStack's outer cached-reference img remains unmounted because cachedRotoReferenceUrl is null; the accepted brush remains visible through the engine's internal preview-base canvas instead."
  implication: "The first failing boundary is engine action selection, caused upstream by an erroneous same-frame cache-refresh reload. Snapshot restore, cache revision acceptance, and visible stack behavior are never reached by finalized Undo."
- timestamp: 2026-07-15T10:25:00Z
  checked: "Minimal production correction and static verification"
  found: "The reference-loading effect now depends on currentFrame, current engine, workflow mode, and stable launch identity (layerId/operationId), not the mutable launchContext object. Explicit native launch handling and navigation still call loadCachedRotoReferenceFrame directly. git diff --check passes, no DEBUG instrumentation exists, no tests were added or modified in this production-first continuation, and every prior uncommitted implementation change remains present."
  implication: "Same-frame automatic cachedRotoFrames publication no longer clears active-frame allActions/undoStack. One focused native finalized-Undo reproduction is required before acceptance."

## Resolution

root_cause: "After a brush finalized, automatic live-pixel cache acceptance replaced launchContext.cachedRotoFrames. useRotoFrameEditingController's reference-loading effect depended on the whole launchContext object, so the cache-only replacement reloaded the unchanged current frame. createRotoReferenceLoader called engine.clear(), which erased allActions and undoStack before the later Undo action. The shared Undo callback reached the correct engine, but EfxPaintEngine.undo() found actionIndex=-1 and returned before snapshot restoration or cache republication."
fix: "Preserve all mutation-aware engine behavior and narrow the Roto reference-loading effect dependency to stable launch identity (layerId/operationId) plus engine/currentFrame/workflow. Same-frame automatic cache publication no longer triggers engine.clear(); true native launch and navigation paths still explicitly load cached references."
verification: "Native finalized-Undo UAT approved on 2026-07-15 after the same-frame reference reload correction. Added a focused Preact hook regression proving that cache-only launchContext replacement with unchanged layerId/operationId does not reload the current frame. Focused engine Undo/cache tests pass 31/31, focused mounted controller/cache tests pass 10/10, the full app suite passes, both typechecks pass, the Physics Paint package build passes, and git diff --check passes."
files_changed:
  - "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts"
  - "packages/efx-physic-paint/src/types.ts"
  - "packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts"
  - "packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts"
  - "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts"
  - "app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts"
  - "app/src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts"
