---
phase: quick-260719-gmn-new-deterministic-physical-frame-roto-in
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/types/physicPaint.ts
  - app/src/types/project.ts
  - app/src/components/physic-paint/roto/rotoPhysicalFrameModel.ts
  - app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts
  - app/src/components/physic-paint/roto/rotoTimelineSelectors.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/components/physic-paint/roto/rotoLaunchHydration.ts
  - app/src/lib/physicPaintPersistence.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoSession.ts
  - app/src/components/physic-paint/roto/rotoKeyTransactions.ts
  - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts
  - app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts
  - app/src/components/physic-paint/roto/rotoSaveTransactions.ts
  - app/src/components/physic-paint/roto/rotoCanvasFrames.ts
  - app/src/components/physic-paint/roto/rotoCacheTransactions.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/lib/physicPaintBridge.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintApplyResultController.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoInterpolationController.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
  - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
  - app/src/components/physic-paint/roto/rotoOnionPreview.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/lib/rotoFrameDraw.ts
  - app/src/lib/previewRenderer.ts
  - app/src/lib/exportRenderer.ts
  - app/src/lib/frameMap.ts
  - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
autonomous: true
requirements:
  - QUICK-260719-GMN
must_haves:
  truths:
    - "D-01/D-02/D-03: Every real Roto key has one stable `keyId` and one physical `appFrame`; interpolation persists only `{ enabled }`, derives interior generated frames from physical gaps, never moves real keys when toggled, and has no compatibility projection or spacing state."
    - "D-01: Copy produces identity-free clipboard content; Paste over a real destination preserves that destination `keyId`; Paste into an empty/generated physical cell allocates exactly one fresh `keyId`; a copied source identity is never reused for a newly created key."
    - "D-04/D-05/D-06/D-07/D-08: Insert Frame, Delete Frame, ripple Drag, and Force Spacing resolve one complete final `keyId -> appFrame` map, validate full capacity, rebuild frame-owned state from one snapshot, regenerate generated cache exactly once inside the single optimistic `replaceRotoKeyFrames()` stage, publish once, and await one matching acknowledgement. Acceptance only finalizes status/selection/history; rejection restores the captured cache snapshot and leaves history unchanged."
    - "D-04/D-05: Insert shifts the selected identity and every later key right by one without creating a key; Delete removes the selected identity and physical slot, shifts every later survivor left by one, and selects the next survivor, otherwise previous, otherwise none."
    - "D-06: Drag is cut-and-insert ripple movement with one preview/commit resolver. For A@1, B@3 moved, C@5, D@8 target, cutting B maps C->4 and D->7, then inserting B immediately after target identity D yields A->1, C->4, D->7, B->8."
    - "D-07: Force Spacing is an explicit integer action where `N` produces intervals of `N + 1`, the first ordered key stays anchored, `0` makes keys adjacent, and capacity failure leaves all state untouched."
    - "D-09/D-10/D-11/D-12: Reopen, cache publication, playback, onion, preview, timeline length, export, compact controls, and Script motion all consume the physical model; production typecheck/build precede native UAT, with no regression-test changes or execution."
  artifacts:
    - path: "app/src/types/physicPaint.ts"
      provides: "Discriminated stable-ID real/generated frame contracts, enabled-only interpolation settings, separate Script motion settings, and strict physical batch payload validation"
    - path: "app/src/components/physic-paint/roto/rotoPhysicalFrameModel.ts"
      provides: "Pure ordered physical timeline derivation plus shared Insert/Delete/Drag/Force Spacing intent resolution"
      exports: ["deriveRotoPhysicalTimeline", "resolveRotoPhysicalBatch"]
    - path: "app/src/stores/physicPaintStore.ts"
      provides: "Single physical real-key replacement boundary and runtime-only generated-gap cache materialization"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts"
      provides: "Complete identity-based batch transaction construction for all four physical timeline edits"
    - path: "app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts"
      provides: "One optimistic local batch stage, one parent publication, and one acknowledgement settlement seam"
    - path: "app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts"
      provides: "General physical-edit snapshots and accepted-only chronological Undo/Redo coordination"
    - path: "app/src/lib/physicPaintBridge.ts"
      provides: "Parent-authoritative identity, revision, complete-map, removal, payload, and layer-capacity validation"
    - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      provides: "Physical drag intent/boundary presentation and explicit Force Spacing control using the shared resolver result"
  key_links:
    - from: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      to: "app/src/components/physic-paint/roto/rotoPhysicalFrameModel.ts"
      via: "Workflow emits physical target intent while Studio/domain returns the shared preview result; UI does not reconstruct timing"
      pattern: "resolveRotoPhysicalBatch"
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts"
      via: "One post-save-barrier coordinator re-reads latest stable identities and resolves Insert/Delete/Drag/Force through the same complete-map transaction"
      pattern: "physical.*batch"
    - from: "app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts"
      to: "app/src/lib/physicPaintBridge.ts"
      via: "One complete replacement payload carries operation, expected revision, mappings, removals, candidate real keys, and identity-based selection"
      pattern: "replace-roto-key-frames"
    - from: "app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts"
      to: "app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts"
      via: "Forward, rollback, Undo, and Redo rebuild every frame-owned collection from immutable snapshots and use the same acknowledged batch seam"
      pattern: "operationId"
    - from: "app/src/stores/physicPaintStore.ts"
      to: "app/src/lib/previewRenderer.ts"
      via: "Preview and export request the physical frame directly; the store returns a real key or runtime-derived interior generated frame without source/display translation"
      pattern: "getRotoFrame"
---

<objective>
Replace the projected/spacing-based Physics Paint Roto timing architecture with the deterministic physical-frame model locked in D-01 through D-12, preserving the approved acknowledgement/rollback discipline while changing all timeline edits to identity-based ripple batches.

Purpose: Make real-key position, persisted position, displayed position, and downstream render position one trustworthy coordinate; remove obsolete timing compensation; preserve complete paint and Script motion behavior; and make Insert/Delete/Drag/Force Spacing deterministic across reopen, playback, onion, preview, cache, history, and export.
Output: Stable-ID physical frame contracts, pure gap/intent resolution, one shared acknowledged batch transaction, physical persistence/store/render consumers, concise Force Spacing and drag-boundary UI, exact production legacy cleanup, and green production typecheck/build ready for native UAT.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/PROJECT.md
@.planning/quick/260719-gmn-new-deterministic-physical-frame-roto-in/260719-gmn-RESEARCH.md
@.planning/quick/260718-m2f-add-single-real-physics-paint-roto-key-d/260718-m2f-PLAN.md
@.planning/quick/260718-m2f-add-single-real-physics-paint-roto-key-d/260718-m2f-SUMMARY.md
@.planning/quick/260718-m2f-add-single-real-physics-paint-roto-key-d/260718-m2f-VERIFICATION.md
@app/src/types/physicPaint.ts
@app/src/types/project.ts
@app/src/stores/physicPaintStore.ts
@app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts
@app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
@app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts
@app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts
@app/src/lib/physicPaintBridge.ts
@app/src/lib/physicPaintPersistence.ts
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
@app/src/components/physic-paint/physicsPaintStudio.css

This is a production-only pre-UAT architecture replacement. Do not add, modify, rename, delete, or run regression tests; do not run Vitest; do not start the application server; do not install packages. Use existing Preact Signals/direct derivation and focused event/lifecycle hooks rather than effect-driven state synchronization. Old Roto projects lacking the new required stable real-key identity are outside the supported format: make a clean schema replacement with no migration, adapter, fallback identity allocation during hydration, or duplicate legacy fields.
</context>

<decisions>
- D-01: Real Roto keys have stable identity and exactly one coordinate: `keyId` plus physical `appFrame`; source, stored, displayed, and rendered frame are the same value, and every key-owned payload moves with that identity.
- D-02: Automatic interpolation persists only enabled/disabled state and derives exactly `max(0, rightFrame - leftFrame - 1)` interior frames; adjacent keys are valid, no leading/trailing paint interpolation exists, and toggling cannot move keys.
- D-03: Remove all production projection, global count, minimum-spacing, per-segment/moved-key override, stale-spacing restore, and dual-coordinate readers/writers without compatibility code.
- D-04: Insert Frame shifts the selected key identity and every later key by `+1`, creates no key, preserves selection by identity, validates capacity, and is one acknowledged atomic history action.
- D-05: Delete Frame removes the selected identity and physical slot, shifts later survivors by `-1`, shares toolbar/keyboard routing, selects deterministically, and is one acknowledged atomic history action.
- D-06: Drag is ripple cut-and-insert; empty/generated physical cells and occupied-key before/after boundaries are valid intents, occupied keys are never overwritten, and one pure resolver owns preview and commit semantics.
- D-07: Force Spacing is an explicit action where integer `N >= 0` produces `N + 1` intervals, anchors the first ordered key, allows `N = 0`, validates full capacity, and records one acknowledged atomic history action.
- D-08: Insert/Delete/Drag/Force Spacing share one complete identity-based batch mapping, one immutable local stage, one parent publication, one matching acknowledgement, complete rollback, and one accepted-only Undo/Redo command.
- D-09: Reopen, playback, onion, preview, cache publication, timeline length, and export consume direct physical frames and regenerated interior gaps.
- D-10: Keep interpolation toggle, replace count input with concise Force Spacing input/action, retain Insert/Delete and Delete/Backspace, and distinguish physical cells versus occupied before/after boundaries with existing visual conventions.
- D-11: Production-first sequencing only: typecheck/build, then stop ready for native UAT; regression tests remain deferred until explicit approval.
- D-12: Preserve Script `deform` and `position` by moving them from interpolation settings into a separate Script motion contract and updating every production reader/writer in the same schema wave.
</decisions>

<tasks>

<task type="auto">
  <name>Task 1: Add the self-contained pure physical model and resolver foundation</name>
  <files>app/src/components/physic-paint/roto/rotoPhysicalFrameModel.ts</files>
  <read_first>app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts, app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts, app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts, app/src/components/physic-paint/roto/rotoTimelineSelectors.ts</read_first>
  <action>
Implement the D-01/D-02/D-04/D-05/D-06/D-07/D-08 pure foundation in one new, independently compilable module without changing or deleting any existing production contract, import, store, caller, or persistence shape in this task. Define module-local structural contracts for identity-bearing physical keys, generated cells, complete survivor mappings, removals, final selection, operation intents, and drag destinations so this file does not require the Task 2 schema cutover to compile. Do not switch callers yet and do not add a compatibility adapter around the old model.

Provide deterministic pure functions that order keys by physical frame, derive only interior generated cells when interpolation is enabled, validate unique IDs/frames and full-layer capacity, and resolve Insert, Delete, Force Spacing, empty/generated drag, and occupied-key before/after drag into one complete final identity map. The resolver must preserve all survivor IDs and leave payload cloning to the cutover task. Insert shifts the selected and later keys right; Delete removes the selected identity, shifts later survivors left, and returns deterministic next/previous selection; Force Spacing anchors the first ordered identity at intervals of `N + 1`.

For occupied drag, make target identity plus boundary authoritative for movement in either direction: capture the target `keyId`, cut the moved identity and close its source slot by shifting every later survivor left, re-find the target by ID in that post-cut order, choose the insertion frame at the target's post-cut frame for `before` or one frame later for `after`, then open that insertion slot and place the moved identity. Reject self-target and invalid/capacity results. The exact rightward example is A@1, B@3 moved, C@5, D@8 target: the cut yields A@1, C@4, D@7; inserting B after D yields A@1, C@4, D@7, B@8. For leftward movement the same steps apply, with a target before the source retaining its post-cut frame before the insertion slot opens. Export this one resolver for both preview and commit in Task 2.
  </action>
  <verify>
    <automated>pnpm --dir app typecheck</automated>
  </verify>
  <done>`rotoPhysicalFrameModel.ts` exists as a self-contained pure domain foundation, encodes the authoritative leftward/rightward identity-bound drag algorithm and all four physical operations, changes no existing production contract or caller, and the unchanged application still typechecks after this commit.</done>
</task>

<task type="auto">
  <name>Task 2: Cut every production caller over atomically and remove the old timing model</name>
  <files>app/src/types/physicPaint.ts, app/src/types/project.ts, app/src/components/physic-paint/roto/rotoPhysicalFrameModel.ts, app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts, app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts, app/src/components/physic-paint/roto/rotoTimelineSelectors.ts, app/src/stores/physicPaintStore.ts, app/src/components/physic-paint/roto/rotoLaunchHydration.ts, app/src/lib/physicPaintPersistence.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts, app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts, app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx, app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts, app/src/components/physic-paint/roto/physicsPaintRotoSession.ts, app/src/components/physic-paint/roto/rotoKeyTransactions.ts, app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts, app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts, app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts, app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts, app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts, app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts, app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts, app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts, app/src/components/physic-paint/roto/rotoSaveTransactions.ts, app/src/components/physic-paint/roto/rotoCanvasFrames.ts, app/src/components/physic-paint/roto/rotoCacheTransactions.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/lib/physicPaintBridge.ts, app/src/components/physic-paint/hooks/usePhysicsPaintApplyResultController.ts, app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts, app/src/components/physic-paint/hooks/useRotoInterpolationController.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts, app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts, app/src/components/physic-paint/roto/rotoOnionPreview.ts, app/src/components/physic-paint/hooks/useRotoReferenceController.ts, app/src/lib/rotoFrameDraw.ts, app/src/lib/previewRenderer.ts, app/src/lib/exportRenderer.ts, app/src/lib/frameMap.ts, app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts</files>
  <read_first>app/src/components/physic-paint/roto/rotoPhysicalFrameModel.ts, app/src/types/physicPaint.ts, app/src/types/project.ts, app/src/stores/physicPaintStore.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts, app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts, app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts, app/src/lib/physicPaintBridge.ts, app/src/lib/physicPaintPersistence.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/lib/rotoFrameDraw.ts</read_first>
  <action>
Perform the complete D-01 through D-12 production cutover in this single architectural task so no commit exposes a half-migrated schema or caller graph. Replace shared project/launch/frame/settings/payload validators with required stable real-key identity, one physical coordinate, enabled-only interpolation persistence, runtime-only generated frames, and a separate Script motion contract. Switch store, hydration, persistence, bridge authority, transaction/history/session code, Studio orchestration, compact UI, live edit/cache buffers, Script/clipboard/library paths, onion/reference, playback/navigation, Preview, Export, timeline length, missing-frame drawing, diagnostics, and every production caller to the new contracts before deleting the old projection module. Final production state must contain no aliases, adapters, deprecated duplicate fields, migration logic, hydration-time fallback IDs, old model imports, or durable generated timing records.

Apply exhaustive D-01 identity rules at every creation and validation seam. Initial save into an empty physical cell, Duplicate, Script-created output, and Paste into an empty or generated physical cell each allocate exactly one fresh `crypto.randomUUID()` when the new real key is created. Save/repaint/reopen/Insert/Delete/Drag/Force/Undo/Redo preserve existing identities. Copy creates an identity-free clipboard payload. Paste replacing an existing real key preserves the destination key's `keyId` while replacing only the allowed paint/script payload; Paste creating a key allocates a fresh ID and never reuses any source clipboard identity. Make clipboard validators reject identity-bearing copied payloads, make real-key validators require unique non-empty IDs and unique physical frames, and make persistence/bridge validation preserve destination identity versus new-key allocation exactly.

Adopt the Task 1 resolver as the single source for D-04/D-05/D-06/D-07 preview and commit. The UI emits only operation intent; Studio re-resolves after the live-pixel save barrier and latest authority reread. For occupied drag in either direction, carry target `keyId` plus `before`/`after`, cut and close the source slot, resolve the target's post-cut frame by identity, then insert relative to that frame. Preserve the authoritative rightward map A@1, B@3 moved, C@5, D@8 target -> A@1, C@4, D@7, B@8 when B is inserted after D; the old target identity D is at frame 7, not last. Use the identical resolver output for hover preview and release commit. Preserve the locked Insert, Delete, and Force Spacing examples, deterministic selection, full-layer capacity rejection, and occupied-key non-overwrite behavior.

Generalize the approved move lifecycle into one D-08 acknowledged transaction for all four physical edits. After playback stop, pending-stroke finalization, live-pixel flush, latest launch/revision/capacity/key/selection/lock reread, capture one complete immutable before snapshot. Rebuild all real-key payload maps, editable/preview/captured/dirty/overlay/repaint/reference/background/paper/canvas/navigation/selection/history-owned state collision-safely from that snapshot and the complete identity map. Call `replaceRotoKeyFrames()` exactly once for the optimistic local stage; that call is the sole generated-cache regeneration for the action. Register and publish one parent payload. Matching acceptance finalizes status, selected identity/frame, and one history command only; it must not regenerate cache or call the replacement boundary again. Rejection, timeout, or transport failure restores the captured cache and full state snapshot while the original launch remains authoritative and creates no history entry. Launch replacement/disposal settles without stale restoration. Undo and Redo use the same acknowledged transaction and advance the cursor only after acceptance.

Preserve Preact-native state flow: continue explicit Physics Paint version bumps/subscriptions where store mutation drives Preview, use Signals/direct derivation for shared or derived physical timeline state, and do not add effect chains that copy resolver/store state. Keep the interpolation toggle independent from key mapping; toggling persists enabled state, regenerates or clears its derived runtime cache for the toggle action, and preserves selection. Replace the count control with explicit nonnegative Force Spacing intent; keep Insert/Delete and Delete/Backspace on the shared coordinator; preserve approved Pointer Events, accessibility, focus, compact dimensions, existing visual conventions, and no multi-selection UI.

Complete D-09/D-12 conversion in the same cutover: persisted truth contains real keys, Roto background, interpolation enabled state, and separate Script motion settings; reopen regenerates interior cache from physical gaps; playback, onion/reference, Preview, Export, timeline length, and `app/src/lib/rotoFrameDraw.ts` use direct physical frames; Script deform/position and approved Script behavior remain intact. Do not add, modify, rename, delete, or run tests; do not run Vitest, start a server, install dependencies, or add debug/fault-injection surfaces. After the binary clean-break scans, run production typecheck and build, fix only task-caused production errors, and stop ready for native UAT without claiming visible approval.
  </action>
  <verify>
    <automated>! rg -q --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/dist/**' '\b(inBetweenCount|in_between_count|segmentSpacingOverrides|segment_spacing_overrides|fromSourceFrame|toSourceFrame|nearestRealKeyFrame|interpolationT)\b' app/src &amp;&amp; ! rg -q --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/dist/**' 'rotoSourceDisplayModel' app/src &amp;&amp; ! rg -q --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/dist/**' '\b(sourceFrame|source_frame|displayFrame|display_frame)\b' app/src/components/physic-paint/roto app/src/components/physic-paint/PhysicsPaintStudio.tsx app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts app/src/components/physic-paint/hooks/useRotoInterpolationController.ts app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts app/src/components/physic-paint/hooks/useRotoReferenceController.ts app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts app/src/components/physic-paint/hooks/useRotoTimelineActions.ts app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts app/src/stores/physicPaintStore.ts app/src/lib/physicPaintBridge.ts app/src/lib/physicPaintPersistence.ts app/src/lib/previewRenderer.ts app/src/lib/exportRenderer.ts app/src/lib/frameMap.ts app/src/lib/rotoFrameDraw.ts app/src/types/physicPaint.ts app/src/types/project.ts &amp;&amp; pnpm --dir app typecheck &amp;&amp; pnpm --dir app build</automated>
  </verify>
  <done>The full production caller graph compiles only against the stable-ID physical model; Paste identity behavior is exhaustive and validated; the authoritative occupied-target drag map is A->1, C->4, D->7, B->8; each acknowledged edit regenerates generated cache once during optimistic replacement and never again on acceptance; rejection restores the captured cache snapshot; all binary clean-break scans, typecheck, and build pass; and execution stops ready for native UAT.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Workflow intent → physical resolver | Pointer cells, occupied boundaries, keyboard actions, and numeric spacing input are untrusted intents that must not mutate state until a complete identity map validates. |
| Standalone optimistic state → parent bridge | A complete local replacement is provisional until the matching parent operation validates project context, revision, identities, capacity, removals, and payload. |
| Persisted project/PNG metadata → hydration | Loaded real-key metadata is untrusted and must require the new discriminated identity/physical-frame schema without synthesizing legacy identities. |
| Physical store → playback/onion/preview/export | All downstream rendering relies on the store returning the correct direct physical real/generated frame and must not revive stale projected ownership. |
| Acknowledgement → history/selection | Only the matching operation settlement may finalize selection, status, cache publication, and the local history cursor. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260719-GMN-01 | Tampering | `resolveRotoPhysicalBatch` | high | mitigate | Validate complete survivor coverage, unique stable IDs, unique integer destinations, removals, operation semantics, and every final frame against `layerEndExclusive` before local staging. |
| T-260719-GMN-02 | Spoofing / Tampering | Occupied drag boundary intent | high | mitigate | Carry the target `keyId` plus before/after boundary and re-resolve that identity after the cut; never trust a stale raw target frame or overwrite an occupied key. |
| T-260719-GMN-03 | Tampering | `physicPaintBridge` replacement authority | high | mitigate | Require matching project/layer context, expected Roto revision, operation fingerprint, complete map, declared removals, unchanged survivor payload by ID, and full-range capacity before parent mutation. |
| T-260719-GMN-04 | Information / Integrity loss | Optimistic batch rollback | high | mitigate | Snapshot and immutable-rebuild every frame-owned cache/edit/reference/background/selection/history field; restore only under the original authoritative launch identity and leave the cursor unchanged on failure. |
| T-260719-GMN-05 | Tampering | Persistence/hydration | high | mitigate | Strictly reject missing/duplicate IDs and obsolete dual-coordinate/generated durable records; do not allocate fallback IDs or run compatibility migration during load. |
| T-260719-GMN-06 | Denial of Service | Ripple/spacing mapping and generated cache | medium | mitigate | Validate capacity before allocation, derive only bounded interior physical gaps, regenerate exactly once inside the optimistic replacement stage, never regenerate again on matching acceptance, and restore the captured cache snapshot on rejection. |
| T-260719-GMN-07 | Repudiation | Local physical edit history | medium | mitigate | Record operation kind, complete before/after snapshots, and identity map only after matching acknowledgement; Undo/Redo also await acknowledgement before advancing the cursor. |
| T-260719-GMN-SC | Tampering | Package supply chain | low | accept | No package installation or dependency change is planned; native UUID, Preact Signals, Pointer Events, and existing project modules are sufficient. |
</threat_model>

<verification>
1. Task 1 adds only the self-contained pure physical model/resolver and passes `pnpm --dir app typecheck` without changing existing production contracts or callers.
2. Task 2 performs the complete schema/caller/store/transaction/UI/persistence/Script/downstream cutover and deletion in one compilable wave; its automated gate contains three fail-on-match `! rg -q` scans followed by production typecheck and build.
3. Source inspection confirms Copy is identity-free, replacement Paste preserves destination identity, creation Paste allocates one fresh identity, and persistence/validators never reuse clipboard source identity for a new key.
4. Source inspection confirms the same occupied-target resolver drives preview and commit, including A@1, B@3 moved, C@5, D@8 target -> A@1, C@4, D@7, B@8 after inserting B after D.
5. Each physical edit calls `replaceRotoKeyFrames()` once during optimistic staging; matching acceptance only finalizes status/selection/history, while rejection restores the captured cache/full-state snapshot.
6. No regression test file changes, Vitest execution, server startup, dependency installation, compatibility adapter, old-project migration, hydration fallback identity, or debug fault-injection surface is permitted before UAT.
7. After all binary scans, typecheck, and build pass, execution stops and reports readiness for native UAT; automated success does not claim visible behavior approved.
</verification>

<uat_handoff>
Native UAT is intentionally not executed by this plan. Hand the following matrix to the user after the production gates pass:

1. Reopen a project created with the new schema and confirm each real key keeps its paint, strokes, cached alpha, thumbnail, background/paper metadata, and Script provenance at its physical frame; interpolation ON for keys `1,2,5` shows generated paint only at `3,4`, OFF removes those generated cells, and toggling never moves the real keys.
2. Insert Frame twice through the existing action and confirm `1,2,3 -> 2,3,4 -> 2,4,5`, selected identity follows its physical moves, no key is created, payloads do not swap, and Undo/Redo treats each insertion as one action.
3. Delete the selected old frame-7 identity from `1,4,7,8` and confirm survivors are `1,4,7`, the final key is still the old frame-8 identity with exact payload, toolbar and Delete/Backspace match, deterministic next/previous selection works, and Undo/Redo is one action.
4. Drag a real key to empty and generated physical cells, then before/after occupied identities in both directions. Confirm previews match release and occupied keys are never overwritten. For A@1, B@3 moved, C@5, D@8 target, dropping B immediately after D must show and commit the exact identity map A->1, C->4, D->7, B->8: the source-slot cut moves C and D left first, target identity D resolves at frame 7, and moved identity B becomes frame 8.
5. Force Spacing with `N = 2` maps `1,2,5 -> 1,4,7`; `N = 0` makes ordered keys adjacent; invalid text, negative values, and out-of-capacity results leave the complete timeline/canvas/history unchanged.
6. For Insert/Delete/Drag/Force, confirm each action stops playback, calls the optimistic replacement stage once, regenerates generated cache exactly once during that stage, and publishes once. On matching acceptance, confirm status/selection/history finalize without a second cache regeneration or replacement call. If a real rejection/timeout occurs naturally, confirm the captured cache and complete state snapshot restore with no history entry; do not manufacture failures with DevTools or debug UI.
7. Paint before and after physical edits, then exercise Undo/Redo chronologically. Confirm editable state, dirty/live cache, repaint base, onion/reference state, background-only metadata, selected identity, and visible canvas all follow the correct key without collision or stale rollback.
8. Save, close, reopen, play cached Roto, inspect onion/reference, use main Preview, and export frames. Confirm every surface uses the same physical positions and regenerated gaps, no stale generated frame persists, no leading/trailing paint interpolation appears, and export matches preview.
9. Use Copy on a real key and confirm the clipboard payload creates no identity. Paste onto an existing real key and confirm that destination `keyId` is preserved while paint payload changes. Paste the same clipboard repeatedly into empty/generated physical cells and confirm each newly created real key receives one fresh distinct `keyId`, never the copied source ID. Then verify Duplicate and Script-created keys also allocate fresh IDs, while Apply Script, Play Script, Save As/Load, deform, and position preserve approved behavior and durable existing identities.
10. Confirm the concise Force Spacing control, toggle, Insert/Delete controls, Delete/Backspace, empty/generated targets, and occupied before/after boundaries fit existing compact visual conventions, retain keyboard/focus cues, and introduce no multi-selection or group-move UI.
</uat_handoff>

<source_audit>
| SOURCE | ID | Feature/Requirement | Task | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | QUICK-260719-GMN | Replace projected/spacing Roto timing with deterministic physical frames and identity-preserving edits | Tasks 1-2 | COVERED | A compilable pure foundation precedes one complete production cutover. |
| REQ | QUICK-260719-GMN | One physical model plus atomic identity-preserving timeline edits | Tasks 1-2 | COVERED | Requirement frontmatter and all implementation seams are mapped. |
| RESEARCH | Pure physical derivation and complete batch resolver | Task 1 | COVERED | Local contracts allow an independently compilable foundation before caller migration. |
| RESEARCH | Stable identity, Paste creation/replacement semantics, and one coordinate | Task 2 | COVERED | Copy is identity-free; replacement preserves destination identity; creation allocates one fresh identity; validators and persistence enforce it. |
| RESEARCH | Enabled-only gaps, store, persistence, and hydration | Task 2 | COVERED | Runtime interior gaps only, no leading/trailing generation, no compatibility or fallback IDs. |
| RESEARCH | Parent authority, acknowledgement, rollback, and history | Task 2 | COVERED | One complete map, optimistic stage, publication, settlement, snapshot restore, and accepted-only command. |
| RESEARCH | Script motion separation and downstream physical consumers | Task 2 | COVERED | Script behavior, reopen, playback, onion, Preview, Export, timeline length, and missing-frame drawing cut over together. |
| RESEARCH | Exact legacy cleanup | Task 2 | COVERED | Binary fail-on-match scans run before typecheck/build. |
| CONTEXT | D-01 | Stable identity and sole physical coordinate | Tasks 1-2 | COVERED | Foundation defines identity mapping; cutover applies exhaustive creation, preservation, Paste, validation, and persistence rules. |
| CONTEXT | D-02 | Enabled-only automatic interpolation from gaps | Tasks 1-2 | COVERED | Pure derivation plus complete store/UI cutover. |
| CONTEXT | D-03 | Remove obsolete timing fields/readers/writers with no compatibility | Task 2 | COVERED | Old contracts/model/imports are removed in the same compilable wave and gated by fail-on-match scans. |
| CONTEXT | D-04 | Ripple Insert Frame | Tasks 1-2 | COVERED | Resolver semantics, capacity, selection identity, acknowledgement, rollback, and history. |
| CONTEXT | D-05 | Ripple Delete Frame | Tasks 1-2 | COVERED | Resolver semantics, survivor identity, deterministic selection, and shared UI/keyboard path. |
| CONTEXT | D-06 | Cut-and-insert ripple Drag with shared preview/commit | Tasks 1-2 | COVERED | Target identity resolves after cut for both directions; exact final map A->1, C->4, D->7, B->8. |
| CONTEXT | D-07 | Explicit Force Spacing | Tasks 1-2 | COVERED | Formula, anchor, zero case, capacity, one action, and concise UI. |
| CONTEXT | D-08 | Shared acknowledged batch transaction | Task 2 | COVERED | Cache regenerates once during optimistic replacement; acceptance does not regenerate; rejection restores snapshot. |
| CONTEXT | D-09 | Physical reopen/render/cache/export consumers | Task 2 | COVERED | Direct physical lookups and regenerated interior gaps throughout. |
| CONTEXT | D-10 | Required compact UI controls and target distinctions | Task 2 | COVERED | Existing conventions, accessibility, and no multi-selection. |
| CONTEXT | D-11 | Production-first pre-UAT sequencing | Task 2 | COVERED | Binary scans, typecheck, and build only, then stop ready for human UAT. |
| CONTEXT | D-12 | Preserve deform/position in separate motion contract | Task 2 | COVERED | Script behavior and serialization remain intact in the cutover. |
| CONTEXT | Deferred | Multi-selection/group movement | None | EXCLUDED | Transaction shape does not block it, but no UI or behavior is implemented. |
| CONTEXT | Deferred | Deterministic regression tests | None | EXCLUDED | Explicitly deferred until native UAT approval. |
</source_audit>

<success_criteria>
- Task 1 is independently compilable and changes only the new self-contained pure physical model/resolver; Task 2 performs the complete production contract/caller deletion and cutover in one compilable wave.
- Every durable real Roto key has one stable `keyId`, one physical `appFrame`, complete payload preservation, and no compatibility alias, migration, hydration fallback identity, or old model import.
- Copy creates no identity; Paste over a real key preserves destination identity; Paste into an empty/generated cell allocates one fresh identity; clipboard source identity is never reused for a newly created key.
- Interpolation persists only enabled state and derives interior generated frames from adjacent physical gaps without moving keys or creating leading/trailing paint interpolation.
- Insert, Delete, ripple Drag, and Force Spacing satisfy the locked examples and use one complete identity map, one immutable local stage, one parent payload, one acknowledgement lifecycle, complete rollback, and one accepted Undo/Redo command.
- Occupied drag preview and commit use the same target-ID resolver for both movement directions; A@1, B@3 moved, C@5, D@8 target resolves to A@1, C@4, D@7, B@8 when B is inserted after D.
- Each physical edit regenerates generated cache exactly once inside its optimistic `replaceRotoKeyFrames()` stage; matching acceptance does not regenerate, and rejection restores the captured cache/full-state snapshot.
- Script deform/position, persistence/reopen, live cache, playback, onion/reference, Preview, timeline length, missing-frame drawing, and Export all consume direct physical frames and runtime-regenerated gaps.
- The final automated command's three fail-on-match scans, `pnpm --dir app typecheck`, and `pnpm --dir app build` pass, after which execution stops ready for native UAT without tests, server startup, dependency changes, or a behavioral-completion claim.
</success_criteria>

<output>
Create `.planning/quick/260719-gmn-new-deterministic-physical-frame-roto-in/260719-gmn-SUMMARY.md` after implementation, report the absolute plan path and production gate results, and stop with `ready for native UAT`. Do not create a verification approval artifact or claim the quick complete until the user performs and approves native UAT.
</output>
