---
phase: quick-260714-ail
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts
  - packages/efx-physic-paint/src/preact.tsx
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoCloseLifecycle.ts
  - app/src/components/physic-paint/hooks/useRotoSaveController.ts
  - app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts
  - app/src/components/physic-paint/hooks/useRotoApplyResultController.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
  - app/src/components/physic-paint/roto/rotoCanvasFrames.ts
  - app/src/components/physic-paint/roto/rotoCanvasFrames.test.ts
  - app/src/components/physic-paint/roto/rotoSaveTransactions.ts
  - app/src/components/physic-paint/roto/rotoSaveTransactions.test.ts
  - app/src/lib/physicPaintRotoDurableCore.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintPersistence.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.test.ts
  - app/src/types/physicPaint.ts
  - app/src/types/project.ts
autonomous: true
requirements:
  - QUICK-260714-AIL
must_haves:
  truths:
    - "Completing a live mutation on an editable Roto real key automatically commits the exact already-rendered alpha-only pixels to that source frame without Save current, replay, a second physics/render pass, or navigation blocking."
    - "Per-source-frame monotonic revisions make the newest completed mutation authoritative: stale same-frame work is discarded, different frames proceed independently, and Clear, Undo-to-empty, key removal, or deletion cannot be undone by an older pending capture."
    - "A reopened cached key remains a flattened non-editable base under a fresh live overlay; existing per-brush Undo affects only new brushes, and undoing all new brushes restores the exact original base in both canvas and cache."
    - "Flattened alpha pixels and existing Roto metadata are the only durable Roto paint truth; editable Roto engine JSON and the manual/save-on-leave/pending/saving/retry model are absent while Play persistence remains unchanged."
    - "Only accepted real-key commits regenerate canonical interpolation and invalidate timeline, onion, parent preview, export, and project persistence; generated frames remain render-only and absolute keys, spacing, backgrounds, Clear/Delete semantics, and Play behavior remain intact."
  artifacts:
    - path: "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts"
      provides: "Completed-mutation notification and direct live alpha surface-copy API that excludes preview base and paper/background"
    - path: "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts"
      provides: "Controller-owned per-frame revision acceptance and bound source/base/live-overlay transaction"
    - path: "app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts"
      provides: "Editable-real-key mutation routing into automatic pixel cache commits while preserving Undo and approved Clear"
    - path: "app/src/lib/physicPaintRotoDurableCore.test.ts"
      provides: "Mounted/native mutation-to-engine-to-cache-to-derived-consumer regression coverage"
    - path: "app/src/stores/physicPaintStore.ts"
      provides: "Accepted pixel-only Roto upsert/removal and derived regeneration without durable editable Roto JSON"
  key_links:
    - from: "EfxPaintEngine completed mutation"
      to: "Roto live pixel cache transaction"
      via: "narrow Preact callback wired by PhysicsPaintStudio into the extracted Roto controller, not a render effect"
      pattern: "completed.*mutation|live.*alpha"
    - from: "Roto live pixel cache transaction"
      to: "physicPaintStore real-key upsert/removal"
      via: "latest revision check immediately before the first externally visible store mutation"
      pattern: "revision|accepted"
    - from: "cached repaint base and live alpha overlay"
      to: "flattened real-key cache"
      via: "existing mergeCachedRotoAlphaFrame base-first additive raster composition"
      pattern: "mergeCachedRotoAlphaFrame"
    - from: "accepted real-key store mutation"
      to: "interpolation, timeline, onion, preview, export, and project save/load"
      via: "existing canonical regeneration and physicPaintVersion/project invalidation path"
      pattern: "physicPaintVersion|upsertRealKey|removeRealKey"
---

<objective>
Replace QUICK-260714-AIL's Roto-only manual/save-on-leave rendering model with direct automatic caching of completed live pixels.

Purpose: Make Roto durability match the paint the artist actually saw, preserve working cached-base repaint and per-brush Undo, keep navigation immediate, and eliminate durable editable Roto JSON plus the obsolete competing save lifecycle without changing Play.
Output: Mandatory RED mounted/native and focused transaction coverage, a narrow engine/controller live-alpha commit seam, pixel-only Roto persistence, removed manual-save UX/lifecycle code, and complete automated regression evidence ready for native UAT.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/.planning/STATE.md
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260714-ail-replace-manual-save-on-leave-rendering-w/260714-ail-CONTEXT.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260714-ail-replace-manual-save-on-leave-rendering-w/260714-ail-RESEARCH.md
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/preact.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintRotoDurableCore.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — prove the native completed-mutation pixel-cache contract before production edits</name>
  <files>packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts, app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts, app/src/lib/physicPaintRotoDurableCore.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts, app/src/stores/physicPaintStore.test.ts, app/src/lib/physicPaintPersistence.test.ts, app/src/lib/physicPaintBridge.test.ts</files>
  <behavior>
    - Mounted tracer: native tool/input completion on an empty editable real key reaches the real-key cache and timeline without invoking any Save action; assert the cached PNG is the exact engine-visible alpha result and paper/background is excluded.
    - Engine boundary: paint and erase notify only after deferred finalization; Undo, Clear, Last physics, and All physics notify after their completed pixel mutation; copying live alpha combines dry/display paint only and does not change background mode, load serialized state, redraw/replay strokes, or rerun physics.
    - Ordering: bind source frame, revision, cached base, live overlay, size, layer, and background before asynchronous encode/merge; delayed revision N cannot overwrite N+1, frame A cannot retarget frame B, frames A/B commit independently, and stale work performs no store/project/derived invalidation.
    - Removal precedence: Clear, final Undo on an initially empty frame, key removal, and Delete advance the same frame revision so an older non-empty result cannot resurrect pixels; final Undo removes the pixel cache and does not create an empty durable key.
    - Cached-base Undo: reopen a flattened key, add two brushes, automatically commit base plus overlay after each mutation, Undo each existing live brush, and prove the final visible/cache pixels equal the original flattened base while old pixels never enter Undo history.
    - Derived/durable path: only the latest accepted real-key pixels reach interpolation, real-key-only onion anchors, timeline, parent preview, export, project round-trip, and close/reopen; generated frames stay non-durable/render-only and absolute positions, custom spacing, interpolation settings, missing backgrounds, and unrelated keys are unchanged.
    - Removal of old model: Roto exposes no Save current/Save pending action, save-on-leave rerender, blocking saving state, retry, durable editable-state payload, or manual-save keyboard route; Play still exposes and persists its existing editable save/update behavior.
  </behavior>
  <action>Before changing production code, add one mounted/native tracer that drives the public Studio canvas/tool boundary through the real engine callback seam expected by the contract and fails because no automatic cache commit exists. Then add focused RED cases one behavior at a time for engine completion/copy semantics and the pure per-frame revision transaction, followed by mounted Undo/base, navigation, derived-consumer, persistence, UI-removal, and Play-isolation assertions. Use independent literal pixel/data-URL fixtures and controllable deferred encode/merge promises; observe public engine, launch-context, store, renderer, bridge, and persistence outputs rather than private implementation calls. Preserve the accepted quick task 260714-9es Clear assertions as a baseline and add only the revision/removal race required here. Do not edit production files until the mounted tracer and focused contracts fail for the intended missing behavior, and do not add a separate Vitest configuration.</action>
  <verify>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts -t "automatic live pixel|latest revision|cached base" -x; test $? -ne 0</automated>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint exec vitest run src/engine/EfxPaintEngine.liveAlphaCache.test.ts -x; test $? -ne 0</automated>
  </verify>
  <done>The mandatory mounted/native tracer and focused engine/revision tests fail against the current manual-save architecture for the intended missing automatic-cache behavior, with no production changes made.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — commit direct live alpha pixels through frame-local latest-wins Roto transactions</name>
  <files>packages/efx-physic-paint/src/engine/EfxPaintEngine.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts, packages/efx-physic-paint/src/preact.tsx, app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts, app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts, app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts, app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/lib/physicPaintRotoDurableCore.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.test.ts</files>
  <behavior>
    - The engine exposes the narrowest optional completed-mutation callback/listener and a direct live-alpha canvas copy; notification follows finalized paint/erase, successful Undo, Clear, and completed physics baking, not pointer movement or queued intent.
    - The alpha copy flushes already-queued finalization only when required by an explicit caller boundary, renders the existing wet display surface, copies dry plus display paint, excludes preview base and paper/background, and never serializes/loads/replays engine state.
    - The Roto controller owns a non-reactive per-source-frame revision map; every mutation begins by fixing source identity and incrementing revision, and asynchronous work checks latest status immediately before store mutation.
    - Existing flattened cached base is bound to the same transaction and composed base-first with the captured live overlay through mergeCachedRotoAlphaFrame; accepted snapshots never reset the engine overlay/action/Undo session.
    - Empty/removal mutations use the same revision authority, and accepted commits alone update launch/session cache and store, regenerate derived interpolation, and trigger existing visual/project invalidation.
  </behavior>
  <action>Implement the smallest event-driven seam per the locked context: add an optional engine completion notification and a live-alpha copy method over the existing dry/display surfaces, then pass the notification through the Preact wrapper without Preact state or a broad effect. Extract or place a deep frame-local transaction behind the existing Roto controller/persistence boundary: a controller-owned Map assigns monotonically increasing revisions; begin captures source frame plus all composition inputs synchronously; encode or merge may await; acceptance occurs immediately before any launch-context/store mutation. Reuse mergeCachedRotoAlphaFrame for flattened base plus live overlay, never overlay alone when a base exists. Keep the live engine untouched after accepted snapshots so existing per-brush Undo remains authoritative. Route paint, erase, successful Undo, approved Clear, and completed Last/All physics through this boundary only for Roto editable real keys; generated and empty display ownership guards remain unchanged. Advance revisions for Undo-to-empty, Clear, key removal, and Delete, and make discarded work completely side-effect free. Use a regular controller transaction/ref rather than Signals or useEffect synchronization; do not introduce a queue, timer, polling, cancellation framework, state library, renderFromStrokes, stroke replay, or global serialization.</action>
  <verify>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint exec vitest run src/engine/EfxPaintEngine.liveAlphaCache.test.ts -x</automated>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts src/lib/physicPaintRotoDurableCore.test.ts -x</automated>
  </verify>
  <done>Every completed editable-Roto mutation automatically commits only its latest bound alpha pixels to the correct source frame, cached-base composition and existing Undo remain exact, stale/removal races are closed, and accepted commits alone update canonical derived consumers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: REFACTOR — delete the obsolete Roto save model, make persistence pixel-only, and run the full gate</name>
  <files>app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts, app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts, app/src/components/physic-paint/hooks/useRotoCloseLifecycle.ts, app/src/components/physic-paint/hooks/useRotoSaveController.ts, app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts, app/src/components/physic-paint/hooks/useRotoApplyResultController.ts, app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts, app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts, app/src/components/physic-paint/roto/rotoCanvasFrames.ts, app/src/components/physic-paint/roto/rotoCanvasFrames.test.ts, app/src/components/physic-paint/roto/rotoSaveTransactions.ts, app/src/components/physic-paint/roto/rotoSaveTransactions.test.ts, app/src/lib/physicPaintBridge.test.ts, app/src/lib/physicPaintPersistence.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.test.ts, app/src/types/physicPaint.ts, app/src/types/project.ts, app/src/lib/physicPaintRotoDurableCore.test.ts</files>
  <behavior>
    - Roto navigation and close are immediate and do not snapshot, render, serialize editable JSON, dispatch the former apply/save payload, wait for acknowledgement, expose saving/pending/retry state, or disable unrelated actions.
    - Roto durable project output contains flattened alpha real-key pixels plus current identity/timing/interpolation/segment-spacing/background metadata and no per-key editable engine state; reopen creates a fresh live overlay/Undo history over the cached base.
    - Play payloads, editable state, Render/Update/save keyboard behavior, bridge handling, and project round-trip remain byte-for-byte compatible in observable behavior.
    - Save current/Save pending UI, dirty-save-on-leave copy, Roto manual-save shortcuts, dead handlers, unreachable branches, and Roto-only controllers/result machinery with no remaining caller are removed rather than retained as compatibility paths.
    - Clear remains the approved same-key content reset, Delete remains key removal, key utilities remain real-key-only, and spacing/onion/preview/export contracts remain synchronized through the canonical store model.
  </behavior>
  <action>Once Task 2 is green, remove the superseded Roto-only model end to end. Delete Save current/Save pending controls and copy, Roto Cmd/Ctrl+S or Cmd/Ctrl+Enter routing, save-before-navigation/close blocking and destination queues, Roto global in-flight/retry/acknowledgement state, replaying transparent export usage, and dead save/apply controller modules or branches after an exact caller audit. Narrow bridge/apply and type contracts so Roto no longer transports editableState; remove Roto writes to durable editable-state maps and gate project editable_state emission to preserved Play ownership. Carry Roto background metadata explicitly rather than deriving it from editable JSON. Keep active-session engine state needed by current per-brush Undo, and keep general standalone engine state file controls if they are not part of Roto cache persistence. Update mounted, bridge, persistence, store, UI, navigation, close, interpolation, spacing, onion, preview, export, and Play tests to assert observable behavior rather than source text alone. Do not perform unrelated Studio restructuring: retain controller ownership, existing Signals invalidation, absolute source identities, generated-frame safety, dynamic spacing, approved Clear, and canonical projection. Finish by running every mandated command below; do not start the application server. After all automated checks pass, stop and report automated readiness only, followed by the exact 12 native UAT steps in this plan without claiming native completion.</action>
  <verify>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts -x</automated>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/roto/physicsPaintRotoSession.test.ts src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts src/components/physic-paint/roto/rotoCacheTransactions.test.ts src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts src/components/physic-paint/roto/rotoKeyTransactions.test.ts src/components/physic-paint/roto/rotoOnionPreview.test.ts src/lib/physicPaintPersistence.test.ts src/lib/physicPaintBridge.test.ts src/stores/physicPaintStore.test.ts src/lib/previewRenderer.test.ts src/lib/exportRenderer.test.ts -x</automated>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint src/lib/physicPaintRotoDurableCore.test.ts src/lib/physicPaintPersistence.test.ts src/lib/physicPaintBridge.test.ts src/stores/physicPaintStore.test.ts src/types/physicPaint.test.ts src/lib/previewRenderer.test.ts src/lib/exportRenderer.test.ts</automated>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run</automated>
    <automated>pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint build && pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck && pnpm -C /Users/lmarques/Dev/efx-motion-editor build && git -C /Users/lmarques/Dev/efx-motion-editor diff --check</automated>
  </verify>
  <done>The Roto manual/save-on-leave and durable editable-JSON paths are absent, direct pixel caching is the sole Roto persistence model, Play is unchanged, all focused and complete Physics Paint/app regressions plus package check/build, typecheck, production build, and diff check pass, and execution stops before native UAT.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Native engine mutation -> Roto controller | Completed mutable canvas pixels cross into an asynchronous durability transaction and must be bound to the editable source frame before any await. |
| Cached base/live overlay -> flattened cache | Two alpha rasters with different ownership must compose base-first without importing background or old pixels into current Undo history. |
| Async transaction -> launch context/store | Only the latest revision may mutate durable/project-visible state or trigger derived regeneration. |
| Roto/Play persistence split | Removing durable editable state for Roto must not alter Play's existing editable save contract. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260714-AIL-01 | Tampering | frame-local async cache acceptance | high | mitigate | Capture source frame and monotonically increasing revision synchronously; compare immediately before store mutation and test same-frame, cross-frame, navigation, and removal races. |
| T-260714-AIL-02 | Tampering | cached-base composition | high | mitigate | Bind the base and live overlay to one revision and use the established additive merge helper; mounted Undo tests require exact restoration of the original base. |
| T-260714-AIL-03 | Information Disclosure | durable Roto editable engine JSON | medium | mitigate | Remove Roto editableState transport/store/project emission while preserving only active-session state and explicit Play-owned persistence. |
| T-260714-AIL-04 | Denial of Service | navigation and cache scheduling | medium | mitigate | Use independent per-frame transactions with no global queue, save-on-leave render, timers, polling, or blocking acknowledgement lifecycle. |
| T-260714-AIL-05 | Tampering | generated interpolation and derived consumers | high | mitigate | Begin regeneration only after accepted real-key commits and preserve canonical source/display ownership, absolute keys, spacing, and real-key-only onion anchors. |
| T-260714-AIL-SC | Tampering | package installs | low | accept | No package installation is planned; all implementation uses existing workspace APIs. |
</threat_model>

<source_coverage_audit>

| SOURCE | ID | Feature/Requirement | Plan | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | — | Replace manual/save-on-leave Roto rendering with automatic direct live pixel caching | 01 | COVERED | Tasks 1-3 cover RED proof, implementation, cleanup, and full verification. |
| REQ | QUICK-260714-AIL | Full invoking task contract and 20 mandatory RED behaviors | 01 | COVERED | Task 1 behavior list maps the native path, ordering, Undo, durability, derived consumers, obsolete UI, and Play isolation. |
| RESEARCH | — | Engine-owned completed mutation plus direct dry/display alpha copy | 01 | COVERED | Task 2 implements the recommended narrow engine/Preact seam. |
| RESEARCH | — | Controller-owned per-frame revision acceptance before store mutation | 01 | COVERED | Tasks 1-2 cover latest-wins, independent frames, removal precedence, and no stale invalidation. |
| RESEARCH | — | Reuse additive cached-base merge and existing store regeneration | 01 | COVERED | Task 2 explicitly retains mergeCachedRotoAlphaFrame and canonical upsert/removal. |
| RESEARCH | — | Delete old Roto save lifecycle and preserve Play | 01 | COVERED | Task 3 performs caller-audited deletion and Play-specific persistence tests. |
| CONTEXT | D-01 | Controller owns capture/commit at completed mutation using existing alpha pixels | 01 | COVERED | Task 2 action. |
| CONTEXT | D-02 | Preserve additive flattened base plus live overlay; Undo only new brushes | 01 | COVERED | Tasks 1-2 mounted cached-base behaviors. |
| CONTEXT | D-03 | Paper/background remains outside cache | 01 | COVERED | Engine-copy and mounted literal-pixel assertions. |
| CONTEXT | D-04 | Per-source-frame monotonic revisions with source fixed at mutation start | 01 | COVERED | Transaction tests and Task 2 controller Map. |
| CONTEXT | D-05 | Latest wins independently per frame; no global queue/timers/polling/cancellation requirement | 01 | COVERED | Tasks 1-2 ordering behaviors and prohibited mechanisms. |
| CONTEXT | D-06 | Removal/Clear/Undo-to-empty/Delete outrank pending non-empty captures | 01 | COVERED | Task 1 removal RED and Task 2 shared revision authority. |
| CONTEXT | D-07 | Only accepted commits invalidate/regenerate derived consumers | 01 | COVERED | Tasks 1-2 assert no stale store/project/version effects. |
| CONTEXT | D-08 | Editable Roto JSON is active-session-only and not durable or reconstructable | 01 | COVERED | Task 3 removes Roto transport/store/project emission while preserving Undo memory. |
| CONTEXT | D-09 | Play persistence remains unchanged | 01 | COVERED | Tasks 1 and 3 include mounted/bridge/project Play regressions. |
| CONTEXT | D-10 | Approved Clear remains distinct from Delete | 01 | COVERED | Tasks 1-3 preserve quick 260714-9es baseline and add only revision wiring. |
| CONTEXT | D-11 | Preserve absolute keys, generated safety, spacing, interpolation, onion, backgrounds, preview/export | 01 | COVERED | Mounted and complete matrix gates in Tasks 1 and 3. |
| CONTEXT | D-12 | No backward-compatibility or legacy Roto persistence shim | 01 | COVERED | Task 3 deletes obsolete branches and competing paths. |
</source_coverage_audit>

<verification>
Follow mandatory RED -> GREEN -> REFACTOR ordering. Task 1 must establish a failing mounted/native path before any production edit. Task 2 turns the focused engine, transaction, additive-base, Undo, and mounted durability tests green. Task 3 removes the superseded model and runs focused suites, mounted/native Studio integration, Undo and session/edit-buffer regressions, persistence/bridge/store/interpolation/spacing/onion/preview/export coverage, the complete Physics Paint matrix, the full app Vitest suite, package checks, typecheck, production build, and git diff check. Do not run the application server. Automated success means ready for the user's native UAT, not native completion.
</verification>

<native_uat_to_present_exactly>
1. Paint a simple brush on an empty real frame, immediately navigate away, then return:
   the exact same visible paint is cached without pressing Save current.

2. Paint a rich/complex frame and navigate away:
   navigation remains immediate and no long second rendering operation occurs.

3. Paint several brushes, use the existing per-brush Undo repeatedly, then navigate away and return:
   every undone brush remains absent and the cache matches the visible post-Undo result.

4. Undo all brushes on a frame that was initially empty:
   the frame returns to empty and no stale cached paint remains.

5. Reopen an existing flattened cached key, add several new brushes, then use the existing per-brush Undo:
   only the new brushes are removed and the original flattened cached paint remains intact.

6. Undo all newly painted brushes on the reopened cached key:
   the visible result and cache both return exactly to the original flattened cached paint.

7. Paint on multiple frames in quick succession:
   each cached result remains attached to the correct source frame and no older result overwrites a newer one.

8. Close and reopen Physics Paint, then save and reopen the project:
   the latest flattened pixels remain; old brush JSON is not expected to remain editable.

9. Verify onion skin uses the latest cached paint.

10. Verify generated interpolation refreshes from the latest real-key paint without becoming editable.

11. Verify parent preview and export use the latest cached pixels.

12. Verify Play canvas still uses its existing save workflow.
</native_uat_to_present_exactly>

<success_criteria>
- A mounted native paint/erase/Undo/Clear/physics completion path commits the exact existing alpha pixels automatically and never performs a second paint render, replay, state reload, or physics simulation.
- Per-frame latest-wins acceptance prevents wrong-frame writes, stale overwrite, and removed-pixel resurrection without blocking unrelated frames or invalidating consumers for discarded work.
- Empty-frame Undo removes cache; cached-base repaint remains additive; Undo over reopened keys affects only new live brushes and returns exactly to the original base.
- Roto project persistence contains flattened pixels plus required metadata and no durable editable engine JSON, while Play editable persistence is unchanged.
- Roto Save current/Save pending/save-on-leave/pending/saving/retry/acknowledgement UI and code paths have no remaining live or compatibility branch.
- Generated-frame safety, absolute source positions, dynamic spacing, interpolation, onion, missing backgrounds, approved Clear/Delete distinction, preview, export, and project invalidation remain synchronized.
- Every mandated automated gate passes; the executor stops before native UAT and presents the exact 12 steps above without claiming completion.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260714-ail-replace-manual-save-on-leave-rendering-w/260714-ail-SUMMARY.md` when automated verification is complete, mark the result automated-ready rather than native-complete, and include the exact 12 native UAT steps from this plan.
</output>
