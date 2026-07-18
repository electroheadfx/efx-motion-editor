# Quick Task 260717-m9k: Merge Physics Paint Play into Roto SCRIPTS - Research

**Researched:** 2026-07-17
**Domain:** Physics Paint progressive scheduling, durable Roto scripts, atomic multi-frame Roto publication, and obsolete Play workflow removal
**Confidence:** HIGH for codebase architecture; MEDIUM for the new transaction shape because the required parent revision token does not yet exist

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Existing real-key collision behavior
- Preserve unrelated paint already present on an existing real key.
- Add the corresponding progressive script output through the established additive Roto composition path.
- Never erase an existing real key as an accidental consequence of old Play cache behavior.

### Canonical destination mapping
- Generate consecutive canonical real-key source positions beginning at the selected canonical Roto start position.
- Let the existing interpolation and display projection system determine visible spacing.
- Do not target projected display slots as editable identities.

### Generated render-only start positions
- Disable Play Script with a clear explanation when the selected start is a generated render-only interpolation frame.
- Require a real canonical key position rather than inventing an implicit owner mutation rule.

### Atomicity and cancellation
- Render and validate the complete sequence off-timeline first.
- Publish one coordinated all-or-nothing real-key batch.
- Cancellation or failure before commit leaves every Roto key unchanged.
- Regenerate interpolation once after the final real-key set is committed.

### Legacy Play data
- Make a clean format break: stop reading and writing obsolete Play workflow records.
- Remove the dual-workflow compatibility architecture rather than retaining adapters or migration code.
- Research must still identify current data-loss consequences and affected fields before removal.

### Completion focus
- After success, select the first newly affected real key.
- Preserve the complete generated sequence and leave cached Roto playback stopped.

### Locked behavioral constraints
- `Max` is the authoritative remaining real-key capacity from the selected canonical start through the current parent-owned layer/timeline boundary.
- Confirmation reloads and validates the selected durable row; stale clipboard content is never authoritative.
- Durable preset JSON and raw per-stroke brush properties remain unchanged.
- Current visible Deform and Move values are destination-time deterministic held-pose overrides only.
- Play Script creates or updates real Roto keys only; generated interpolation frames remain render-only.
- Existing row Load, single-frame `paintBrush` Apply, durable Save/Rename/Delete/Refresh, and cached Roto playback remain distinct and functional.

### Claude's Discretion

- Reuse `AnimationPlayer` scheduling behavior and `transformRecordedStrokeForHeldPose` or the current shared equivalent.
- Expose progress phases for preparing, rendering `x / y`, committing, regenerating interpolation, and terminal complete/cancelled/failed states.
- Keep the existing `play` icon immediately after `paintBrush` and provide accurate disabled reasons, tooltip, accessible label, keyboard operation, focus containment/restoration, and compact-panel overflow safety.
- Revalidate selected-script loadability, canonical start ownership, operation locks, destination capacity, and parent revision/operation identity before rendering and before atomic publication.

### Deferred Ideas (OUT OF SCOPE)

None stated.
</user_constraints>

## Summary

The implementation should not drive the existing `AnimationPlayer` through `requestAnimationFrame`, workflow mode `play`, or the old Play cache. Instead, extract its pure ordering/allocation/frame-visibility logic into an engine-level scheduling module, retain `AnimationPlayer` as the timed preview wrapper over that module, and add an offline renderer that consumes an explicitly reloaded, immutable durable-script snapshot. This preserves the scheduling oracle—play-frame anchors, timestamp reconstruction, weighted spans, partial points, cumulative completed strokes, overflow distribution, sequential same-anchor edits, and complete final frame—without entering obsolete Play orchestration. [VERIFIED: codebase inspection — `packages/efx-physic-paint/src/animation/AnimationPlayer.ts`, `AnimationPlayer.test.ts`]

The durable SCRIPTS path already provides the correct selected-row authority, strict persisted-schema validation, immutable runtime conversion, operation IDs, stale generation checks, status/LOG routing, and a prepared reload token for the one-frame Paintbrush action. The new Play Script controller should parallel that prepared lifecycle but own a separate multi-frame operation: reload selected row, freeze a private snapshot, validate real canonical start and parent capacity, stage every progressive alpha result off-timeline, additively compose staged alpha over existing real-key alpha, then publish one complete real-key set through the existing parent `replace-roto-key-frames` batch seam. Parent acceptance must precede local mirrored publication; otherwise the current optimistic local key-utility pattern would violate “failure before commit changes nothing.” [VERIFIED: codebase inspection — `physicsPaintRotoScriptLibrary.ts`, `physicsPaintRotoScriptClipboard.ts`, `useRotoPersistenceIntegration.ts`, `physicPaintStore.ts`]

The obsolete Play workflow is broad, not a single component. Removal must cover Play coordinator/edit cache/preview, conversion, launch selection, persisted Play ranges and metadata, parent sidebar launch controls, bridge payload variants, workflow strip Play lane and CSS, session-file behavior, selectors, keyboard behavior, and their tests. Dropping old records intentionally loses editable Play scripts, Play range markers/options/motion, and any cached frames that were not also represented as Roto real-key metadata; there must be no adapter or migration. [VERIFIED: codebase inspection]

**Primary recommendation:** Extract a pure progressive schedule/frame-plan API from `AnimationPlayer`, add a focused `RotoPlayScriptController` plus offline staged renderer, and commit via one parent-authoritative full real-key replacement transaction with explicit stale/capacity preconditions. [VERIFIED: codebase inspection; target shape is a recommendation]

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD installation under `.claude/gsd-core`. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Do not run the development server. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Use `vitest run`, never watch mode, when tests are eventually approved. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Treat this as Preact, not React; prefer existing Signals/controllers and avoid React-specific state workarounds. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Prefer Signals for shared/derived reactive state; effects should synchronize external systems and include cleanup rather than serve as control flow. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`; `developing-preact` skill]
- Inspect and preserve nearby project conventions; do not refactor unrelated hooks solely to replace them with Signals. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Use pnpm for project commands. [VERIFIED: project package scripts and repository memory]
- Production code/type/build checks come before native visible UAT; no test creation or modification until explicit UAT approval. [VERIFIED: task CONTEXT.md]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Selected preset reload and validation | Standalone frontend controller | Parent/native script-library authority | UI owns intent/token lifecycle; parent filesystem owns canonical JSON. [VERIFIED: codebase inspection] |
| Progressive frame scheduling | Physics Paint package engine layer | Standalone controller | Scheduling is reusable engine behavior; UI only supplies frame count/snapshot/motion. [VERIFIED: codebase inspection] |
| Offline frame rendering | Physics Paint package engine/render service | Standalone controller | Engine APIs own physics replay and alpha extraction; controller owns cancellation/progress. [VERIFIED: codebase inspection] |
| Canonical start and generated-frame eligibility | Roto source/display model | Standalone view/controller | Canonical source identity is separate from projected display identity. [VERIFIED: codebase inspection] |
| Capacity (`Max`) | Parent/editor authority | Launch/confirmation bridge | Sequence `outFrame` or content duration defines exclusive boundary; standalone cannot infer later parent edits. [VERIFIED: `app/src/lib/physicPaintBridge.ts:579-630`] |
| Additive collision composition | Standalone staging renderer | Parent batch store | Existing cached alpha must be composited under staged script alpha before batch publication. [VERIFIED: `physicsPaintRotoAlphaMerge.ts`] |
| Atomic real-key publication | Parent/editor store and bridge | Standalone mirrored store | Parent project state is durable authority; standalone local state updates only after accepted result. [VERIFIED: codebase inspection] |
| Interpolation regeneration | Parent/editor `physicPaintStore` | Standalone mirror | `replaceRotoKeyFrames` removes generated cache and regenerates once after the real-key set is installed. [VERIFIED: `physicPaintStore.ts:1088-1128`] |
| Dialog/progress/disabled reasons | Preact Scripts panel | Controller Signals | Compact accessible UI reflects controller state and restores focus. [VERIFIED: `PhysicsPaintScriptsPanel.tsx`] |

## Current Architecture and Call/Data-Flow Map

```text
Parent PhysicPaintProperties
  -> openPhysicPaintCanvas(requestedWorkflowMode roto|play)
  -> createPhysicPaintLaunchContext
       -> layer/sequence range, Play ranges, cached Play/Roto metadata
  -> standalone PhysicsPaintStudio

Current obsolete Play branch:
PhysicsPaintStudio
  -> usePhysicsPaintPlayCoordinator
       -> usePlayEditCacheController (Play-frame annotations/cache/edit assignments)
       -> usePlayPreviewController
            -> AnimationPlayer.play(rAF + fps)
                 -> engine.getStrokes()
                 -> private distributeStrokes()
                 -> engine.renderPartialStrokes()
                 -> engine.exportCompositeCanvas()
       -> apply-play-canvas payload
  -> useRotoPlayConversionController
       -> convert-play-to-roto / convert-roto-to-play payloads
  -> parent applyPhysicPaintPayload
       -> physicPaintStore.applySequence / convertPlayToRoto / convertRotoToPlay
       -> Play ranges, workflow metadata, editable state, cached frames

Current durable SCRIPTS branch:
PhysicsPaintScriptsPanel row activation
  -> library.activateAndLoad(id)
       -> parent/native load request with operationId
       -> persisted schema validation
       -> persistedRotoScriptToRuntime()
       -> replaceClipboardFromPersisted(deep-frozen snapshot)
Paintbrush
  -> prepareScriptLoadAndApply()
  -> library.activateAndLoad(selectedId, preparation)
  -> applyPreparedScript()
       -> enqueue one logical brush at a time
       -> transformRecordedStrokeForHeldPose(destination source frame)
       -> completed-mutation observer
       -> final live alpha capture
       -> optional cached-base additive merge
       -> apply-canvas publication

Recommended Play Script branch:
Scripts-panel Play button
  -> accessible count/Max confirmation
  -> RotoPlayScriptController.prepare()
       -> freeze start identity + parent token + motion + selected row ID
       -> reload selected row through library authority
       -> validate canonical real key, lock state, capacity
  -> pure progressive scheduler(snapshot strokes, count)
  -> offline renderer for frame 0..N-1
       -> destinationSourceFrame = canonicalStart + frameIndex
       -> render progressive alpha from immutable script
       -> merge existing real-key alpha under staged output
       -> stage complete real-key result set without store mutation
  -> revalidate parent context/range/revision/operation
  -> one replace-roto-key-frames batch
       -> parent installs all real keys
       -> parent regenerates interpolation once
  -> accepted result
       -> mirror refreshed Roto cache locally
       -> select first affected real key
       -> stop cached playback
```

All current-flow claims above are verified by the named code paths. [VERIFIED: codebase inspection]

## AnimationPlayer Oracle Inventory

| Behavior | Current implementation/evidence | Required target preservation |
|---|---|---|
| Recorded ordering | `orderStrokesForPlayback`; timestamp/source-index sorting reconstructs saved scripts where first action is physically last. [VERIFIED: `AnimationPlayer.ts:261-330`; tests lines 327-348] | Move unchanged into exported pure scheduler. |
| Play-frame anchors | `getPlayFrameAnchor` clamps valid `stroke.playFrame` into range. [VERIFIED: `AnimationPlayer.ts:328-330`] | Preserve for durable scripts because schema still stores `playFrame`. |
| Inserted edits | `hasSourceOrderInsertion`/`getInsertionTargetIndex` insert appended anchored strokes into sequence. [VERIFIED: `AnimationPlayer.ts:265-325`] | Preserve exact ordering. |
| Weighted allocation | Point counts are weights; remaining-weight ratio allocates contiguous spans. [VERIFIED: `AnimationPlayer.ts:112-156`] | Pure plan must return exact start/end/pointsPerFrame. |
| Partial revelation | Active stroke point count is `min(total, pointsPerFrame * framesIntoStroke)`. [VERIFIED: `AnimationPlayer.ts:204-227`] | Offline frame renderer uses same formula. |
| Cumulative completed strokes | Strokes whose `endFrame < frameIndex` are included fully on every later frame. [VERIFIED: `AnimationPlayer.ts:209-224`] | Every staged frame is cumulative. |
| More strokes than frames | Start frames are spread with `floor(index * (usableFrames + 1) / strokeCount)`; multiple strokes may share frames. [VERIFIED: `AnimationPlayer.ts:97-109`; overflow test lines 177-195] | Do not replace with one-stroke-per-frame logic. |
| Final completeness | Last scheduled stroke consumes remaining frames; timed completion also calls `renderAllStrokes`. [VERIFIED: `AnimationPlayer.ts:141-155, 183-193`; tight-duration test] | Last staged frame must explicitly contain all strokes; do not rely on post-completion canvas state. |
| Same-anchor continuation order | `playFrameCursors` makes same-anchor strokes sequential. [VERIFIED: `AnimationPlayer.ts:120-152`; tests lines 375-450] | Retain sequential same-anchor behavior. |
| Logical diffusion continuations | Durable scripts group zero-point diffusion records after a primary; engine `renderPartialStrokes` replays `diffusionFrames` only when a record is complete. [VERIFIED: `normalizeLogicalBrushes`; `EfxPaintEngine.ts:1069-1085`] | Flatten each immutable brush as primary followed immediately by continuations before scheduling, preserving raw continuation order. |
| FPS/timer | rAF accumulator, `1000/fps`, drift correction, one-shot completion. [VERIFIED: `AnimationPlayer.ts:163-198`] | Retain only for interactive preview; offline staging must not wait wall-clock time. |
| Stop/cleanup | `stop()` cancels rAF, renders all, exits animation mode, unlocks input; hook cleanup calls stop. [VERIFIED: `AnimationPlayer.ts:53-66`; `usePlayPreviewController.ts:43-51`] | Offline renderer needs `try/finally` restoration and AbortSignal checks, not rAF. |
| Motion | `transformRecordedStrokeForHeldPose` uses stroke hash, stroke index, destination frame quantized in two-frame holds, and clamped Move/Deform. Zero/zero returns the original object. [VERIFIED: `recordedStrokeMotion.ts`] | Use canonical destination source frame (`start + index`), current visible values captured at confirmation, and unchanged raw preset data. |
| Existing tests | `AnimationPlayer.test.ts` covers sequential order, weighting, tight durations, overflow, anchors, insertions, style passthrough, modes, deterministic held poses, and zero-motion geometry. [VERIFIED: codebase inspection] | Tests remain oracle but are not modified or run before UAT under this task’s locked validation order. |

### Required extraction boundary

Prescribe these package-level pure APIs (names may be adjusted, responsibilities must not):

```ts
buildProgressiveStrokeSchedule(strokes, frameCount): FrameStroke[]
getProgressiveFrameStrokes(schedule, frameIndex, transform?): Array<{ stroke; pointCount }>
```

`AnimationPlayer.distributeStrokes` and `renderFrame` should delegate to these APIs. A new offline service should iterate synchronously/asynchronously over frame indices and call the same frame-plan function. This avoids a second scheduling implementation. [VERIFIED: codebase inspection; API names are recommended]

## Progressive Offline Rendering Design

1. Reload the selected durable row with `activateAndLoad(selectedId, preparationToken)`-style authority; do not use existing clipboard contents as input. [VERIFIED: existing prepared Paintbrush lifecycle]
2. Convert persisted JSON with `persistedRotoScriptToRuntime`, deep-clone/freeze into operation-owned memory, and flatten logical brushes to scheduling records while preserving primary/continuation order. [VERIFIED: schema and clipboard implementation]
3. Use an isolated/offscreen engine instance or a rigorously reset render-only engine session. Do not load into the mounted editable engine because `renderPartialStrokes` resets replay surfaces and the operation must not disturb the current Roto frame before commit. [VERIFIED: `EfxPaintEngine.renderPartialStrokes` resets replay surface]
4. For each frame, derive the exact progressive records from the shared schedule, apply held-pose Motion using `destinationSourceFrame = startSourceFrame + frameIndex`, render, and capture transparent paint alpha. `exportCompositeCanvas()` includes dry/background plus wet display; ordinary Roto persistence expects transparent alpha, so the offline path must produce an alpha-only composite equivalent to `copyLiveAlphaCanvas`, not a paper/background-baked Play PNG. [VERIFIED: `EfxPaintEngine.exportCompositeCanvas` and `copyLiveAlphaCanvas` comments]
5. Stage every rendered output in memory. For a destination with an existing real key, compose existing alpha first and staged script alpha second, matching `mergeCachedRotoAlphaFrame` draw order. [VERIFIED: `physicsPaintRotoAlphaMerge.ts:24-29`]
6. No call to `physicPaintStore.upsertRealRotoKeyFrame`, `captureLivePixels`, or bridge apply may occur during rendering. Cancellation checks occur before each frame, after each asynchronous image decode/render, and before commit. [VERIFIED: atomicity requirement; current APIs identified]
7. Construct the full next real-key set: untouched existing real keys plus staged/merged destinations. Publish it once. [VERIFIED: `replaceRotoKeyFrames` is whole-set replacement]

**Important engine fact:** current `copyLiveAlphaCanvas()` captures all completed live paint, while `renderPartialStrokes()` redraws the replay surface. The implementation should expose a render-only alpha capture from the engine package rather than decode a paper-inclusive `exportCompositeCanvas()` afterward. [VERIFIED: engine code; exact new method is a recommendation]

## Recommended Target Seams and Integration Points

### 1. Package: shared progressive scheduler

- **Retain/extract from:** `packages/efx-physic-paint/src/animation/AnimationPlayer.ts`.
- **Export through:** `packages/efx-physic-paint/src/animation/index.ts`.
- **Consumer A:** existing `AnimationPlayer` timed wrapper.
- **Consumer B:** new app offline Play Script renderer.
- **Do not change:** stroke order semantics, point allocation, anchor behavior, or final-frame completeness. [VERIFIED: codebase inspection]

### 2. App service: offline script sequence renderer

Create a focused module under `app/src/components/physic-paint/roto/`, not a block in `PhysicsPaintStudio.tsx`. It should accept only immutable script, frame count, canonical start, captured Motion, canvas/background render dependencies, `AbortSignal`, and progress callback; return staged alpha frames without touching stores. [VERIFIED: project architecture; module shape is recommended]

### 3. Controller: `RotoPlayScriptController`

Use Signals for `confirmation`, `busy`, `phase`, `progress`, `status`, and `error`. Keep async operation generations/tokens as private non-reactive fields, following `createRotoScriptLibraryController`. It should coordinate prepare → reload → render → commit → local mirror → select. [VERIFIED: existing Signals/controller conventions]

Recommended phases:

```text
idle | preparing | rendering {completed,total} | committing |
regenerating | complete | cancelled | failed
```

The parent `replaceRotoKeyFrames` currently regenerates interpolation inside the same synchronous store transaction, so “regenerating” may be a short status around parent acceptance rather than a second mutation. Do not send a separate interpolation update. [VERIFIED: `physicPaintStore.replaceRotoKeyFrames`]

### 4. Scripts UI

Integrate into `PhysicsPaintScriptsPanel.tsx`:

- Replace the disabled Play button immediately after Paintbrush with `onPlayScript` and `playDisabledReason` props. [VERIFIED: current button position lines 46-50]
- Reuse the current compact absolute dialog pattern and focus trap from delete confirmation, but use a distinct dialog state/ref and restore focus to the Play button. [VERIFIED: current accessible confirmation lines 26-38, 97-110]
- Input accepts a positive integer or case-insensitive `Max`; invalid, zero, fractional, overflow, or stale capacity is an inline error—never clamp. The generic `clampPhysicPaintFrameCount` is therefore inappropriate for confirmation validation. [VERIFIED: locked decision; current clamp silently clamps]
- Show resolved Max and destination range based on canonical source frames, not projected display cells. [VERIFIED: source/display model]
- Support Enter to confirm valid input, Escape to cancel, trapped Tab, labelled input/error, and focus restoration. [VERIFIED: existing UI accessibility pattern]
- Keep overflow inside `.physics-paint-scripts-panel`; current panel/list use `min-height: 0` and scroll containment, while confirmation is absolutely positioned. [VERIFIED: `physicsPaintStudio.css:1132-1209`]

### 5. Studio integration

`PhysicsPaintStudio.tsx` should only wire the controller ports alongside `rotoScriptLibrary` and `rotoScript`, then pass state/actions into the right-panel view model. Remove the current Play coordinator and conversion wiring rather than replacing it inline. [VERIFIED: current Studio already contains the large Play block at lines 398-423 and conversion at 476-497]

### 6. Parent bridge and capacity authority

Current capacity logic is in `app/src/lib/physicPaintBridge.ts`: it finds the containing sequence, treats `outFrame` as exclusive, otherwise derives content duration from key-photo holds, and returns `rangeEnd - max(frame, rangeStart)`. The old gap-to-next-Play-range limit must be deleted; Play Script `Max` is only the remaining parent-owned layer/timeline capacity, capped by any retained hard safety maximum if product policy still requires it. [VERIFIED: `physicPaintBridge.ts:579-629`; old gap dependency verified]

Launch-time `maxPlayFrameCount` is only a snapshot. Confirmation and commit require a fresh parent query/validation because the main editor can change while the standalone window remains open. Add a request/response authority seam or include preconditions in the commit payload; do not trust launch context alone. [VERIFIED: current launch context snapshot has no refresh request]

## Atomic Transaction Design

### Existing best seam

`replace-roto-key-frames` is the strongest existing publication primitive: it replaces the complete real-key set, removes old generated/support cache, installs real keys, recomputes support, regenerates interpolation once, and emits one visual/project-dirty notification. [VERIFIED: `physicPaintStore.replaceRotoKeyFrames`]

### Required strengthening

The existing payload has only operation ID, layer ID, start frame, complete frames, and interpolation settings. It does **not** carry project-context identity, authoritative range boundary, expected real-key revision/signature, or selected-start ownership. `deliveredOperationIds` provides idempotence only after success; it is not optimistic concurrency control. [VERIFIED: `types/physicPaint.ts`; `physicPaintBridge.ts:75-128`]

The planner should add parent preconditions to the batch seam, either by extending `replace-roto-key-frames` or introducing a narrowly named Roto batch kind:

```ts
{
  operationId,
  projectContextId,
  layerId,
  canonicalStartFrame,
  frameCount,
  expectedLayerEndExclusive,
  expectedRotoRevision, // or deterministic real-key signature
  frames: completeNextRealKeySet,
  rotoInterpolationSettings
}
```

At commit, parent authority must atomically validate: current project context, target layer identity, canonical range still within current layer boundary, start is not generated-only, expected Roto revision/signature still matches, every incoming frame is a real key, and operation ID is not already failed/stale. Only then call the store replacement. [VERIFIED: current gaps; field design is recommended]

### Publication sequence

1. Stop cached Roto playback before preparation; leave it stopped through terminal state. [VERIFIED: locked decision; cached playback has explicit `stop()`]
2. Capture operation token: library context generation, selected row ID/revision, launch operation ID, project context ID, layer ID, canonical start, source/display selection identity, Motion, capacity token/revision, and Roto revision/signature. [VERIFIED: existing identifiers plus identified missing revision]
3. Reload selected preset and validate schema/revision. [VERIFIED: library load path]
4. Render/stage all outputs; cancellation only marks the operation and prevents further staging/commit. [VERIFIED: locked decision]
5. Requery/revalidate parent capacity and all token identities immediately before commit. [VERIFIED: locked decision; no current seam]
6. Send one parent batch. Do not optimistically call local `physicPaintStore.replaceRotoKeyFrames` first. [VERIFIED: current key utility does optimistic local apply; recommendation avoids atomicity breach]
7. On accepted result, mirror the known committed real-key set locally, refresh cached frames, update launch context, navigate/select the first affected real key, and keep cached playback stopped. [VERIFIED: existing local mirror/navigation APIs]
8. On rejection/timeout, discard staging and leave local/parent keys unchanged. [VERIFIED: locked decision]

### Additive composition

For each affected source frame:

```text
existing real-key alpha (if any)
  + staged progressive script alpha
  = committed real-key alpha
```

Use the existing draw order from `mergeCachedRotoAlphaFrame`; generalize it to accept staged canvas/frame inputs if needed. Do not use `apply-play-canvas`, which overwrites range frames and creates Play records, and do not use repeated `apply-canvas`, which regenerates interpolation and publishes partial progress per frame. [VERIFIED: existing store behavior]

## UI/State/Disabled-Reason Constraints

Play Script is disabled when any of the following applies:

- no selected durable row;
- library operation busy;
- current workflow is not Roto after obsolete Play removal (normally impossible once removal is complete);
- current selection is `generated-interpolation`;
- current selection is not a canonical real key (locked decision requires a real start, so unlike Paintbrush Apply it should not promote an empty cell);
- Roto script/apply/key mutation/navigation operation is locked;
- parent bridge/capacity authority is unavailable;
- project/layer context changed or is unsaved/unavailable;
- selected row failed reload/validation;
- resolved remaining capacity is zero. [VERIFIED: existing availability patterns plus locked decisions]

Recommended generated reason: reuse the established wording, “Generated frame N is render-only…” and add “Select a real Roto key to generate a Play Script.” [VERIFIED: `GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE`; wording extension is recommended]

Status/error routing should use the existing Scripts status plus shared `applyMessage`/`lastError` LOG ports, as `rotoScriptLibrary` already does. Do not add a parallel toast-only error channel. [VERIFIED: `PhysicsPaintStudio.tsx:231-247`; `PhysicsPaintScriptsPanel.tsx:95`]

## Deletion Matrix

| Area | Remove | Retain/extract | Consequence/evidence |
|---|---|---|---|
| Timed engine player | No | `AnimationPlayer`, but delegate scheduling/frame planning to pure functions | Existing package API and tests remain useful for interactive engine replay. [VERIFIED] |
| Held-pose Motion | No | `transformRecordedStrokeForHeldPose` unchanged | Already shared by AnimationPlayer and Roto Apply; deterministic and zero-motion-safe. [VERIFIED] |
| Engine progressive APIs | No | `getStrokes`, `renderPartialStrokes`, render-mode hooks; add alpha-only offline capture if required | Core rendering, not Play orchestration. [VERIFIED] |
| Old Play coordinator | `usePhysicsPaintPlayCoordinator.ts` | Nothing except concepts moved to new focused controller/renderer | Owns old cache/apply workflow. [VERIFIED] |
| Old Play preview/edit cache | `usePlayPreviewController.ts`, `usePlayEditCacheController.ts`, `usePlayLimitToast.ts` if no remaining caller | Shared scheduler only | Cached Roto playback remains separate. [VERIFIED] |
| Play transaction helpers | `play/playFrameTransactions.ts`, `play/playLifecycleTransactions.ts`, `play/physicsPaintPlayWorkflow.ts` | Scheduling logic belongs in package extraction, not these app helpers | These files annotate Play edits, manage Play cache/ranges, and markers. [VERIFIED] |
| Roto↔Play conversion | `rotoPlayConversionTransactions.ts`, `useRotoPlayConversionController.ts`, conversion wiring in workflow integration/apply-result controller | None | Clean break forbids conversion adapter. [VERIFIED] |
| Studio Play state | `playCoordinator` block, latest Play frames/cache/edit refs, Play clear branch, Play preview keyboard paths, conversion ports | New controller wiring only | Shrinks Studio rather than adding orchestration. [VERIFIED] |
| Workflow strip Play lane | Play mode tabs, frame-count controls, render/update options, Play range cells/markers, conversion confirmations, Play preview handlers/props | Roto timeline, key tools, interpolation, cached Roto playback, Roto script controls | Play workflow presentation is obsolete; cached playback previews committed Roto keys. [VERIFIED] |
| Scripts panel Play button | Disabled placeholder behavior | Same icon position, now opens Play Script confirmation | Required product integration point. [VERIFIED] |
| Parent sidebar | Play paint launch buttons/status and requested mode branching in `PhysicPaintProperties.tsx` | Roto window launch | Separate Play window entry is obsolete. [VERIFIED] |
| Launch context | `requestedWorkflowMode: play`, `workflowMode: play`, Play start/count/source/script/cache/motion/render options/preview/cache frames/gap limit | Roto context, project identity, layer/canvas/fps, Roto cache/interpolation/background; add fresh capacity authority | Clean format/runtime boundary. [VERIFIED] |
| Bridge payload kinds | `apply-play-canvas`, `convert-play-to-roto`, `convert-roto-to-play`, `update-play-render-options` and handlers | `apply-canvas`, delete, replace real keys, interpolation update, script-library requests; strengthen batch preconditions | Removes old persistence mutations. [VERIFIED] |
| Store Play state | `_playScriptRanges`, Play range helpers/APIs, `applySequence`, conversions, Play render-option update, Play workflow metadata branches, Play editable state behavior | Roto frame/cache/interpolation/background stores and whole-key replacement | Old Play records stop being loaded/written. [VERIFIED] |
| TS persisted model | `PhysicPaintPlay*` types, Play workflow metadata fields, Play payload interfaces, validators/normalizers | Roto types and durable external script schema | Durable `.efx-roto-script.json` schema remains unchanged, including optional per-stroke `playFrame`. [VERIFIED] |
| Project TS model | Play fields in `McePhysicPaintOutput`/`RuntimePhysicPaintOutput` | frames, Roto cache/interpolation/background | Clean output format. [VERIFIED] |
| Rust project model | `play_script_ranges`, `workflow_mode` if Roto no longer needs it, `play_start_frame`, `play_frame_count`, `editable_source`, `play_motion`; update fixture tests | Roto cache/interpolation/background fields | Stop Rust round-trip of obsolete records. [VERIFIED: `models/project.rs`] |
| Native launch struct/URL | Play-specific context fields and URL params in `src-tauri/src/lib.rs` | Roto launch fields; new capacity query/commit preconditions as needed | Removes standalone Play selection bridge. [VERIFIED] |
| CSS | Play workflow/range/tab/animation/options selectors and obsolete conversion styles | Scripts panel, Roto timeline/playback, new compact confirmation/progress styles | Search `physicsPaintStudio.css`, especially Play range at 2006+. [VERIFIED] |
| Tests after UAT approval | Delete/update old Play coordinator, lifecycle, conversion, bridge/store/persistence/session/sidebar/workflow-strip assertions | Keep AnimationPlayer oracle tests; add focused new scheduler/controller/batch/UI tests post-UAT | No test edits before approval. [VERIFIED: task constraint and test inventory] |

## Legacy Data-Loss Consequences

A clean break will stop reading/writing these old project records: `play_script_ranges`, Play `editable_state`, `workflow_mode: play`, `play_start_frame`, `play_frame_count`, `editable_source: play`, and `play_motion`; runtime launch-only Play cache/render fields also disappear. [VERIFIED: TypeScript and Rust persistence models]

Consequences when opening an old project after removal:

- editable Play script strokes stored only in a Play range are lost;
- Play range identity, markers, selected script ID, range duration, saved Motion, and render options are lost;
- cached Play PNG frames are retained only if the simplified loader deliberately treats ordinary `frames` as valid Roto real keys **and** has Roto provenance; the locked clean break should not infer missing Roto metadata from Play mode, so Play-only frame ranges may disappear from normal Roto behavior;
- old Play overlap/gap constraints no longer apply;
- no Play→Roto conversion remains available after upgrade. [VERIFIED: current persistence and loader behavior; outcome follows locked clean break]

Do not add compatibility adapters, inferred migrations, or one-time conversion prompts. The release note/UAT plan should state the intentional loss. [VERIFIED: locked decision]

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `.mce` project `physic_paint_outputs` can contain Play ranges, editable state, workflow fields, motion, and cached frames. Durable project script files may contain optional per-stroke `playFrame`, which remains valid scheduling data. [VERIFIED] | Code edit: stop loading/writing Play project fields. No data migration. Keep durable script schema unchanged. |
| Live service config | None found; script-library authority is parent/native runtime state but contains durable Roto presets, not obsolete Play workflow records. [VERIFIED: codebase inspection] | None. |
| OS-registered state | Native Physics Paint window URL/launch struct carries Play-specific fields, but no separate OS registration or service name was found. [VERIFIED: `src-tauri/src/lib.rs`] | Code edit to launch serialization only; no re-registration. |
| Secrets/env vars | None found for Play workflow names. [VERIFIED: codebase search] | None. |
| Build artifacts / installed packages | Package declaration outputs may expose Animation exports but no separate Play package installation was found. Existing compiled artifacts will be refreshed by normal build. [VERIFIED: package layout] | Rebuild package/app; no package migration. |

## Common Pitfalls

### Pitfall 1: Reimplementing the scheduler in the app
**What goes wrong:** subtle divergence in overflow, anchor insertion, weighted spans, and final completeness. [VERIFIED: extensive oracle behavior]
**Avoid:** extract pure planning from `AnimationPlayer`; both timed and offline paths call it.

### Pitfall 2: Using rAF for generation
**What goes wrong:** generation takes real time, depends on window timing, complicates cancellation, and captures mounted engine state. [VERIFIED: current rAF implementation]
**Avoid:** deterministic frame-index iteration over a private render engine.

### Pitfall 3: Capturing `exportCompositeCanvas`
**What goes wrong:** paper/background may be baked into ordinary transparent Roto keys. [VERIFIED: engine export comments]
**Avoid:** expose/use alpha-only progressive capture.

### Pitfall 4: Repeated per-frame publication
**What goes wrong:** cancellation leaves partial keys and interpolation regenerates repeatedly. [VERIFIED: `upsertRealRotoKeyFrame` regenerates when enabled]
**Avoid:** stage all, one complete replacement batch.

### Pitfall 5: Optimistic local batch before parent acceptance
**What goes wrong:** parent timeout/rejection leaves standalone and project authority divergent and violates no-change-before-commit. [VERIFIED: current local-then-parent key utility pattern]
**Avoid:** parent commit first, local mirror after accepted operation ID.

### Pitfall 6: Replacing only generated destinations
**What goes wrong:** `replace-roto-key-frames` is whole-set replacement; unrelated real keys disappear. [VERIFIED: store implementation]
**Avoid:** send the complete next real-key set.

### Pitfall 7: Overwriting existing target alpha
**What goes wrong:** unrelated paint is destroyed. [VERIFIED: locked decision]
**Avoid:** merge existing alpha under staged script alpha.

### Pitfall 8: Trusting launch-time Max
**What goes wrong:** parent sequence range can change while dialog/rendering is active. [VERIFIED: launch context is snapshot-only]
**Avoid:** fresh parent check at confirmation and commit.

### Pitfall 9: Using projected display frames as destination IDs
**What goes wrong:** generated interpolation cells become editable or source spacing changes incorrectly. [VERIFIED: source/display model]
**Avoid:** consecutive canonical source frames only.

### Pitfall 10: Reusing stale clipboard
**What goes wrong:** Play Script uses an older row or previous Copy action. [VERIFIED: clipboard and library are separate authorities]
**Avoid:** selected row ID → authoritative reload → private immutable snapshot.

### Pitfall 11: Moving held-pose continuations independently
**What goes wrong:** continuation metadata/order can diverge from its primary brush. [VERIFIED: durable grouping]
**Avoid:** schedule flattened records for replay semantics, but preserve each durable brush group and raw fields; apply geometric Motion to primary point geometry only.

### Pitfall 12: Deleting all “Play” names indiscriminately
**What goes wrong:** cached **Roto playback** transport or generic `AnimationPlayer` gets removed. [VERIFIED: separate code paths]
**Avoid:** remove Play workflow orchestration; retain Roto cached playback and reusable engine scheduler/player.

## Security Domain

No new external packages are required. [VERIFIED: recommended design uses existing stack]

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | Local desktop project workflow. [VERIFIED: project architecture] |
| V3 Session Management | No | Use operation/context generations, not auth sessions. [VERIFIED] |
| V4 Access Control | Yes, local authority boundary | Parent validates project context and layer ownership before commit. [VERIFIED: current bridge validates target layer; strengthened checks recommended] |
| V5 Input Validation | Yes | Strict integer/`Max` parser; persisted script schema validation; payload validation; frame/capacity bounds. [VERIFIED] |
| V6 Cryptography | No | No cryptographic operation needed. [VERIFIED] |

Threats to account for:

- **Tampering/stale message:** mismatched operation/project/layer/revision must be rejected. [VERIFIED: current operation matching exists but revision is missing]
- **Resource exhaustion:** durable schema allows up to 2,000 brushes/250,000 points and frame count can be large; render must be cancellable, bounded by authoritative capacity and existing hard frame cap, and release canvases promptly. [VERIFIED: schema limits and frame cap]
- **Untrusted persisted JSON:** continue strict schema validation and never execute script content. [VERIFIED: schema parser]
- **Oversized batch/data URLs:** parent payload validator already checks PNG prefixes but not aggregate bytes; planner should consider a practical staged-memory/batch-size guard. [VERIFIED: current validator; guard recommendation]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | TypeScript/Vite/package build | Yes | v24.15.0 | None needed. [VERIFIED: local command] |
| pnpm | Workspace commands | Yes | 10.27.0 | None; project requires pnpm. [VERIFIED: local command] |
| Cargo | Tauri Rust type/build work if native structs change | Yes | 1.93.1 | None needed. [VERIFIED: local command] |
| Development server | Not required | Not run | — | Native UAT is performed by user after production checks. [VERIFIED: task constraint] |

## Validation Architecture and Order

The repository has Vitest coverage and package/app build scripts, but this quick task explicitly defers all test creation/modification and regression runs until native visible UAT approval. [VERIFIED: package scripts and CONTEXT.md]

### Pre-UAT production checks only

1. `pnpm --filter @efxlab/efx-physic-paint build` — catches extracted package API/type/build failures. [VERIFIED: package script]
2. `pnpm --filter efx-motion-editor typecheck` — catches app and bridge TypeScript integration failures. [VERIFIED: app script]
3. If Rust launch/project structs are changed, run the minimum non-server native compile check selected by the implementer (prefer `cargo check` in `app/src-tauri` rather than a full packaged app build). [VERIFIED: Rust code is affected; exact command is repository-standard recommendation]
4. Stop and request native visible UAT. Do not run or modify Vitest before approval. [VERIFIED: locked task constraint]

### Native UAT focus

- Play icon eligibility/disabled explanations on real/generated/no-selection/busy states.
- Accessible dialog, integer/Max validation, focus/keyboard/overflow.
- Exact progressive visual behavior versus current AnimationPlayer oracle.
- Deterministic two-frame held Move/Deform and zero-motion parity.
- Existing-key additive preservation.
- Cancellation before commit leaves all keys unchanged.
- Successful batch creates consecutive canonical real keys, regenerates interpolation, selects first affected key, and leaves cached playback stopped.
- Save/reopen/preview/cached playback/export use ordinary Roto paths.
- Separate Play workflow and parent launch controls are absent.

### Post-UAT only

After explicit user approval, add focused tests for extracted scheduler parity, offline renderer alpha/motion, selected-row reload token, Max revalidation, cancellation, stale parent revision, additive composition, single batch/interpolation regeneration, UI focus/validation, and deletion of old persistence/bridge variants; run focused `vitest run`, then broader gates. [VERIFIED: required validation policy]

## Open Implementation Facts

1. **Parent Roto revision token does not exist.**
   - Known: there is global `physicPaintVersion`, launch `operationId`, library revisions, and idempotent delivered operation IDs. [VERIFIED]
   - Gap: none is a layer-specific optimistic concurrency token suitable for atomic commit validation. [VERIFIED]
   - Recommendation: add a layer-scoped Roto revision or deterministic real-key signature returned with capacity authority and required by commit.

2. **Offline alpha-only progressive capture is not a public engine API.**
   - Known: `renderPartialStrokes`, `exportCompositeCanvas`, and `copyLiveAlphaCanvas` exist. [VERIFIED]
   - Gap: the exact alpha capture after replay must be proven not to include paper/background and not to mutate mounted state. [VERIFIED]
   - Recommendation: add a package-level render-only service/private engine adapter with explicit alpha output.

3. **Capacity refresh transport is absent.**
   - Known: launch calculates parent layer range once. [VERIFIED]
   - Gap: no standalone request rechecks it. [VERIFIED]
   - Recommendation: add a small authority request or include all capacity validation in the parent batch response; confirmation should also query for immediate feedback.

4. **`playFrame` remains in durable preset JSON.**
   - Known: optional field is validated/serialized and is required to preserve AnimationPlayer anchor semantics. [VERIFIED]
   - Recommendation: retain it as generic progressive scheduling metadata even though Play workflow persistence is removed.

5. **Whole-set batch size/memory.**
   - Known: replacement sends all real-key PNG data URLs and staging holds N canvases/frames. [VERIFIED]
   - Recommendation: estimate memory from canvas dimensions × 4 × frame count, release intermediate canvases, and fail before commit with a clear message if a safe local bound is exceeded; do not stream partial commits.

## Sources

### Primary (HIGH confidence)
- Repository source and tests under `packages/efx-physic-paint/src/animation/` — scheduling and held-pose oracle.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` and `physicsPaintRotoScriptClipboard.ts` — durable selected-row, immutable snapshot, apply lifecycle.
- `app/src/stores/physicPaintStore.ts` and `app/src/lib/physicPaintBridge.ts` — parent publication, persistence, interpolation, capacity, idempotence.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` and focused hooks/views — current integration and removal surface.
- `app/src/types/physicPaint.ts`, `app/src/types/project.ts`, `app/src-tauri/src/models/project.rs`, `app/src-tauri/src/lib.rs` — transport and persisted Play fields.

### Secondary (MEDIUM confidence)
- Project `CLAUDE.md` and `developing-preact` skill — Preact/state/accessibility constraints.

### Tertiary (LOW confidence)
- None. No external ecosystem claims or packages were needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| — | No `[ASSUMED]` claims. Recommendations are explicitly identified as target design rather than factual current behavior. | — | — |

## Metadata

**Confidence breakdown:**
- Scheduling and current architecture: HIGH — directly inspected implementation and tests.
- Durable scripts/Roto publication: HIGH — directly inspected controllers, store, bridge, and persistence.
- Deletion surface: HIGH — cross-file symbol/reference inventory across TypeScript, CSS, and Rust.
- New atomic revision/capacity contract: MEDIUM — required gap is verified, exact token shape is a design recommendation.

**Research date:** 2026-07-17
**Valid until:** 2026-08-16, or earlier if Physics Paint/Roto architecture changes.
