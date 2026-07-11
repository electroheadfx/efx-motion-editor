---
status: complete
trigger: "Focused debug series: read SPECS/issues/phase-36.13-dynamic-interpolation-debug/README.md, then run only 01-physics-paint-studio-refactor.md on branch phase-36.13-debugs. Current main/36.13 implementation is buggy and not UAT-accepted. Goal: identify why PhysicsPaintStudio.tsx / current Roto state model causes inconsistent dynamic interpolation behavior; map current ownership of Roto source/display state; propose and begin the smallest refactor/model extraction required before more 36.13 fixes."
created: 2026-07-05
updated: 2026-07-05
---

# Debug Session: Phase 36.13 Roto Model

## Symptoms

- Expected behavior: Dynamic interpolation source/display behavior should be deterministic and shared across Save current, Paste, key creation with interpolation ON/OFF, far keys, toggle ON/OFF, closing/reopening Physics Paint, and saving/reopening the project.
- Actual behavior: The same apparent user intent can produce different source/display results depending on path, indicating source/display state is not consistently owned by one transaction path.
- Error messages: No explicit runtime errors supplied; failure is live UAT inconsistency.
- Timeline: Current main/36.13 implementation is buggy and not UAT-accepted.
- Reproduction: Run only `SPECS/issues/phase-36.13-dynamic-interpolation-debug/01-physics-paint-studio-refactor.md` from the focused debug series.

## Constraints

- Do not mark Phase 36.13 accepted.
- Do not run broad symptom patches for Save/Paste/toggle yet.
- Do not add more Roto internal `useEffect` orchestration.
- Existing Roto-related `useEffect` synchronization should be classified for removal/replacement with Preact Signals, `computed`, or explicit actions.
- Prefer pure model functions and Preact Signals/computed over React-style `useState` + `useEffect`.
- Do not touch blend mode, Pencil UI, reset/apply-to-all UI, or generated-to-real promotion.
- Stop before broad behavior fixes.

## Current Focus

- hypothesis: `PhysicsPaintStudio.tsx` and adjacent helpers split Roto source/display ownership across component-local state, effects, store helpers, workflow strip inputs, bridge payloads, and render/export paths, so Save/Paste/toggle/hydration take divergent transaction/projection routes.
- test: Inspect Roto-related state, effects, helpers, and tests; map current ownership; identify a pure model seam and first safe extraction that does not alter broad behavior.
- expecting: A clear current/target ownership map, classification of existing Roto-related `useEffect` blocks, smallest extraction plan, exact files to create/change, first tests to write, and only the first safe extraction step if the map is clear.
- next_action: gather initial evidence from PhysicsPaintStudio.tsx, Roto helpers, and existing tests
- reasoning_checkpoint:
- tdd_checkpoint: TDD mode enabled; write/identify first tests before implementation.

## Evidence

- timestamp: 2026-07-05T07:35:01Z
  observation: Initial TDD RED for `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.test.ts` failed because `./rotoSourceDisplayModel` did not exist, confirming the source/display boundary was missing.
  source: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoSourceDisplayModel.test.ts`
- timestamp: 2026-07-05T07:36:08Z
  observation: First safe extraction is green; pure source/display model tests and existing workflow-state tests pass.
  source: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/physicsPaintWorkflowState.test.ts src/components/physic-paint/rotoSourceDisplayModel.test.ts`

## Direct Studio Inspection Evidence

Source inspected: `app/src/components/physic-paint/PhysicsPaintStudio.tsx`.

### Roto-related `useState` fields

| Field | Lines | Current role | Target |
| --- | ---: | --- | --- |
| `savedRotoFrames` | 702 | Mirrored workflow-strip saved real-key markers from launch/cache state. | Remove as source/display owner; derive from timeline projection via computed adapter. |
| `occupiedRotoFrames` | 703 | Mirrored workflow-strip occupied display/source frame numbers. | Remove as source/display owner; derive from projection plus local dirty/edit overlay state. |
| `editableRotoFrames` | 704 | Local UI overlay for frames with unsaved/editable content. | Keep as transient edit overlay, but not as source/display authority. |
| `rotoSavingFrame` | 705 | Save-in-flight UI marker. | Keep as external async UI state. |
| `cachedRotoReferenceUrl` | 710 | Canvas background/reference URL for current frame. | External canvas boundary; not source/display authority. |
| `cachedRotoRepaintBaseFrame` | 711 | Current frame repaint base cache. | External canvas/cache boundary; keyed by model projection. |
| `isRotoCachedPlaybackActive` | 712 | Playback UI state. | External playback boundary. |
| `cachedRotoPlaybackFrame` | 713 | Playback frame payload. | External playback boundary fed by projection. |
| `rotoCachedPlaybackStatus` | 714 | Playback/interpolation status copy. | UI status computed/action result; not source/display owner. |
| `rotoCachedPlaybackLoop` | 715 | Playback option. | External playback boundary. |
| `rotoCachedPlaybackFps` | 716 | Playback option. | External playback boundary. |
| `rotoKeyActionInFlight` | 717 | Async key-transaction in-flight flag. | Keep as transaction UI state. |
| `rotoSessionVersion` | 718 | Manual invalidation trigger for memoized `rotoSession`. | Replace with Signal/computed invalidation from transaction/source state. |
| `rotoClosePromptState` / `rotoClosePromptMessage` | 721-722 | Unsaved-close UI state. | External close boundary. |

### Roto-related refs and non-state owners

| Field | Lines | Current role | Target |
| --- | ---: | --- | --- |
| `rotoFrameStatesRef` | 725 | Unsaved editable engine snapshots by display frame. | Keep as transient edit buffer keyed through adapter projection. |
| `confirmedCachedRotoFramesRef` | 726 | Extra real-key cache mirror used by lookup/projection fallback. | Remove as projection authority; keep only if needed as cache detail after model owns keys. |
| `rotoPreviewFramesRef` | 727 | Local unsaved preview frame cache. | Transient edit overlay, not source/display owner. |
| `rotoCapturedFramesRef` | 728 | Local captured canvas output before save. | Transient edit overlay. |
| `liveRotoOverlayActionCountRef` | 729 | Tracks live overlay edits. | Transient edit overlay. |
| `workflowModeRef` | 735 | Imperative callback mirror. | External imperative adapter boundary. |
| `pendingRotoAdvanceRef` | 746 | Navigation-after-save queue. | Transaction action state. |
| `saveOnLeaveSourceFrameRef` | 747 | Save-on-leave source/display marker. | Transaction action state; should use source/display model target. |
| `saveOnLeaveRenderedFrameRef` | 748 | Deferred rendered payload for save result. | External save/apply boundary. |
| `pendingCachedRotoMergeFrameRef` | 749 | Deferred merge payload. | External save/apply boundary. |
| `saveOnLeaveDeleteFrameRef` | 750 | Deferred delete marker. | Transaction action state. |
| `dirtyRotoFramesRef` | 751 | Dirty display/edit frames. | Transient edit overlay consumed by adapter. |
| `copiedRotoKeyRef` / `copiedRotoEditableStateRef` | 752-753 | Copy/paste session state. | Transaction module/session state. |
| `rotoFlushInFlightRef` | 754 | Save/apply in-flight promise. | External async boundary. |

### Roto-related `useEffect` blocks

| Location | Purpose | Classification | Why / replacement |
| --- | --- | --- | --- |
| `PhysicsPaintStudio.tsx:795-798` | Reset engine/canvas mount when canvas size key changes. | external boundary | Canvas lifecycle only; not source/display owner. |
| `PhysicsPaintStudio.tsx:839-841` | Mirror `engine` into `engineRef`. | external boundary | Imperative bridge/listener access only. |
| `PhysicsPaintStudio.tsx:843-845` | Mirror `workflowMode` into `workflowModeRef`. | external boundary | Imperative callback access; not Roto model ownership. |
| `PhysicsPaintStudio.tsx:847-849` | Mirror play preview frame into ref. | external boundary | Play-mode imperative state; not Roto source/display. |
| `PhysicsPaintStudio.tsx:851-854` | Rebuild `savedRotoFrames` and `occupiedRotoFrames` from `launchContext.cachedRotoFrames`. | computed | Replace with computed projection from `RotoSourceDisplayModel` plus edit overlay; no effect or mirror arrays. |
| `PhysicsPaintStudio.tsx:862-864` | Detect app bridge mode. | external boundary | Environment/bridge detection. |
| `PhysicsPaintStudio.tsx:914-950` | Fetch/listen for launch context and call `applyIncomingLaunchContext`. | external boundary + explicit action | Listener remains external; Roto hydration inside `applyIncomingLaunchContext`/`resetRotoSessionForLaunch` becomes model initialization action. |
| `PhysicsPaintStudio.tsx:952-970` | Engine initialization and Roto background metadata load. | external boundary | Engine/canvas lifecycle only. |
| `PhysicsPaintStudio.tsx:972-983` | Apply Play render options to engine. | external boundary | Play engine sync only. |
| `PhysicsPaintStudio.tsx:985-999` | Cleanup timers/pending refs on unmount. | external boundary | Resource cleanup. |
| `PhysicsPaintStudio.tsx:1117-1119` | Persist Roto background metadata to store. | external boundary | Background/tool metadata, not source/display. |
| `PhysicsPaintStudio.tsx:1212-1216` | Load Play preview cache. | external boundary | Play preview only. |
| `PhysicsPaintStudio.tsx:1218-1221` | Load cached Roto reference frame on current frame/context changes. | external boundary | Canvas/cache side effect may remain, but should consume canonical projection. |
| `PhysicsPaintStudio.tsx:1258-1262` | Auto-dismiss Play limit toast. | external boundary | UI timer only. |
| `PhysicsPaintStudio.tsx:2151-2166` | Browser/message apply-result listener. | external boundary + explicit action | Listener remains; source/display cache repair inside `handleApplyResult` must move to transaction/action boundary. |
| `PhysicsPaintStudio.tsx:2168-2191` | Tauri apply-result listener. | external boundary + explicit action | Listener remains; source/display cache repair inside `handleApplyResult` must move to transaction/action boundary. |
| `PhysicsPaintStudio.tsx:2703-2710` | Snapshot current Roto frame before unload. | external boundary | Browser lifecycle / unsaved edit protection. |
| `PhysicsPaintStudio.tsx:2757-2785` | Tauri close guard and unsaved Roto prompt. | external boundary | Window lifecycle / prompt UI. |
| `PhysicsPaintStudio.tsx:2879-2881` | Stop cached Roto playback when leaving Roto mode. | external boundary | Playback lifecycle only. |

### Current ownership map

| Concern | Current owner |
| --- | --- |
| Durable real-key source sequence | Split across `launchContext.cachedRotoFrames`, `physicPaintStore` real-key cache, `confirmedCachedRotoFramesRef`, and `rotoSession` construction at `PhysicsPaintStudio.tsx:773-787`. |
| Source/display normalization | Studio helpers near `PhysicsPaintStudio.tsx:174-203`, `physicsPaintWorkflowState.ts`, and store refresh paths. |
| Custom spacing overrides | `physicPaintStore` settings, Studio save path `PhysicsPaintStudio.tsx:2200-2210`, key-controller transaction persistence `PhysicsPaintStudio.tsx:1867-1888`, and toggle path `PhysicsPaintStudio.tsx:2883-2952`. |
| ON display projection | Mixed between store-generated `cachedRotoFrames`, `getRealCachedRotoDisplayFrameNumbers`, `findCachedRotoDisplayFrame`, `rotoSession.playbackFrameNumbers`, and workflow-strip props. |
| OFF display projection | Mixed between `getRealCachedRotoDisplayFrameNumbers`, `updateRotoInterpolationSettings` local repairs at `PhysicsPaintStudio.tsx:2912-2917`, and `savedRotoFrames`/`occupiedRotoFrames`. |
| Generated frame identity | Store cache frames with `source === 'generated-interpolation'`, Studio `currentFrameIsGeneratedRoto` at `PhysicsPaintStudio.tsx:788-793`, and lookup `findCachedRotoDisplayFrame` at `PhysicsPaintStudio.tsx:1159-1169`. |
| Save current far target | `saveRotoFrame` computes target at `PhysicsPaintStudio.tsx:2200-2210`, then `flushRotoFrame` persists source frame at `PhysicsPaintStudio.tsx:1678-1724`. |
| Paste far target | `createRotoSession` receives separate `resolvePasteTargetForDisplayFrame` at `PhysicsPaintStudio.tsx:785`, then `pasteRotoFrame` runs session effects at `PhysicsPaintStudio.tsx:2434-2438`. |
| Insert/Duplicate/Delete | `physicsPaintRotoSession`, `physicsPaintRotoKeyController`, and Studio `applyRotoKeyUtilityTransaction` at `PhysicsPaintStudio.tsx:1867-1888`. |
| Toggle ON/OFF | `updateRotoInterpolationSettings` at `PhysicsPaintStudio.tsx:2883-2952` seeds store, regenerates cache, repairs local frame lists, and moves current frame. |
| Hydration after reopen | `hydrateLaunchContextRotoInterpolation` plus `applyIncomingLaunchContext`/`resetRotoSessionForLaunch` at `PhysicsPaintStudio.tsx:800-837` and `866-884`. |
| Workflow strip visible cells | Direct Studio props at `PhysicsPaintStudio.tsx:3118-3122` from `occupiedRotoFrames`, `savedRotoFrames`, `launchContext.cachedRotoFrames`, `editableRotoFrames`, and `rotoSession.dirtyFrames.value`. |
| Onion anchors | Studio candidate collection at `PhysicsPaintStudio.tsx:2543-2582`, using `launchContext.cachedRotoFrames`, store cache, preview refs, and `getRotoOnionAnchorDisplayFrame`. |
| Preview/export frame source | `findCachedRotoDisplayFrame` at `PhysicsPaintStudio.tsx:1159-1169` and export/preview callbacks use launch/store/preview/confirmed refs. |

### Target ownership map

| Concern | Target owner |
| --- | --- |
| Durable real-key source sequence | `RotoSourceDisplayModel` initialized from durable real-key frames; mutations through transaction actions only. |
| Source/display normalization | Pure model functions; Studio consumes normalized projection. |
| Custom spacing overrides | `RotoSourceDisplayModel` + transaction module; Studio never manually merges overrides. |
| ON display projection | Pure `getRotoDisplayProjection(model, { enabled: true })`, exposed by Preact `computed`. |
| OFF display projection | Pure `getRotoDisplayProjection(model, { enabled: false })`, exposed by Preact `computed`. |
| Generated frame identity | Projection cells from the model; cache/render data attaches to projected display cells. |
| Save current far target | Explicit transaction action using `resolveRotoRealKeySaveTarget` and `upsertRotoRealKeySource`. |
| Paste far target | Same transaction action/target resolver as Save current. |
| Insert/Duplicate/Delete | Transaction module returns next model + external effects to persist/cache. |
| Toggle ON/OFF | Action updates settings only; computed projection changes visible cells without repairing arrays. |
| Hydration after reopen | Single model initialization action from durable real keys/settings. |
| Workflow strip visible cells | `useRotoTimelineModel` Signal/computed adapter; Studio passes adapter outputs. |
| Onion anchors | Computed projection from real source keys plus cache lookup. |
| Preview/export frame source | Adapter projection resolves source/display mapping; Studio only loads/render caches at external boundaries. |

### Moves to Signals / computed / explicit actions

| Current Studio concern | Move to |
| --- | --- |
| `savedRotoFrames` / `occupiedRotoFrames` mirrors | Preact `computed` selectors from `rotoModelSignal` and edit overlay state. |
| `currentRotoDisplayFrame` / `currentFrameIsGeneratedRoto` | `computed` selected cell from projection. |
| `rotoSessionVersion` manual invalidation | Signal value updates from model/edit transactions. |
| Save current source-frame override and override merge | Explicit `saveRotoRealKey` transaction action. |
| Paste target resolution | Same explicit transaction as Save current. |
| Insert/Duplicate/Delete rebasing | Explicit transaction module with model in/out. |
| Toggle ON/OFF local list repair | Explicit settings action + computed projection. |
| Hydration/reset local list repair | Explicit initialize action that sets the model once. |
| Workflow strip props | `useRotoTimelineModel` computed adapter values. |
| Cache/reference loading | External effects/actions that consume projected display/source cells. |

### First Studio wiring extraction step

Create `useRotoTimelineModel.ts` as a thin Preact Signals adapter around `rotoSourceDisplayModel.ts`, then replace only the workflow-strip input derivation in `PhysicsPaintStudio.tsx`:

1. Initialize a `rotoModel` signal from `launchContext.cachedRotoFrames` + `physicPaintStore.getRotoInterpolationSettings(layerId)` via `createRotoSourceDisplayModel`.
2. Expose computed `projection`, `savedRotoFrames`, `occupiedRotoFrames`, `currentCell`, `currentFrameIsGenerated`, and `workflowStripCachedRotoFrames`.
3. Keep `editableRotoFrames`, dirty refs, canvas/reference effects, and save/apply side effects in Studio for this first step.
4. Wire only `PhysicsPaintWorkflowStrip` props and `rotoInputDisabled`/generated-frame message to adapter outputs.
5. Do not change Save/Paste/toggle behavior in this first Studio step; after the strip reads canonical projection, move Save/Paste into a transaction module.

## Smallest Extraction Plan

1. Keep the existing pure `rotoSourceDisplayModel.ts` extraction and tests.
2. Add `useRotoTimelineModel.ts` with Preact Signals/computed as a read-only adapter first.
3. Add/extend workflow-strip-facing tests proving adapter output matches pure projection for ON/OFF, generated cells, and current generated status.
4. Replace Studio workflow-strip derived props with adapter outputs while leaving save/apply/cache side effects untouched.
5. Then introduce `rotoKeyTransactions.ts` to route Save current and Paste through the same transaction path.
6. Only after those seams exist, remove Studio-local `savedRotoFrames`/`occupiedRotoFrames` state and the `PhysicsPaintStudio.tsx:851-854` mirror effect.

## Exact Files

Created in first extraction:
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.test.ts`

Next files to create/change for first Studio wiring extraction:
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineModel.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineModel.test.ts` or workflow-strip-facing equivalent
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx`

Later files:
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoKeyTransactions.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintRotoSession.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintRotoKeyController.ts`

## First Tests Before More Implementation

- `useRotoTimelineModel` projects `savedRotoFrames` and `occupiedRotoFrames` from source keys/settings without reading Studio mirror arrays.
- `useRotoTimelineModel` reports `currentFrameIsGenerated` from projection for generated cells and false for real keys/custom empty positions.
- Workflow-strip input data contains expected real/generated cells for interpolation ON and only real/custom-spaced keys for interpolation OFF.
- Toggle settings changes projection without mutating source real-key sequence.
- Hydration model initialization produces the same projection as live model state.

Rule: no more Roto dynamic-spacing patches inside broad `PhysicsPaintStudio.tsx` `useEffect` repair paths; use pure model functions, explicit transactions, and Preact Signals/computed instead.

## Eliminated

- The missing Debug 01 deliverable was not code behavior; it was insufficient direct `PhysicsPaintStudio.tsx` ownership/effect inventory. That gap is now documented above.

## Resolution Status

- root_cause: Roto source/display ownership was split across Studio local state/effects/refs, store helpers, workflow helpers, session transactions, bridge payload refresh, and workflow-strip inputs, so Save/Paste/toggle/hydration could recompute or repair divergent projections.
- completed_so_far: Pure `rotoSourceDisplayModel` boundary exists; pure transaction and selector seams now exist; `useRotoTimelineModel` provides a thin Signals/computed adapter; `useRotoTimelineActions` provides the thin actions seam; `PhysicsPaintStudio.tsx` now reads workflow-strip timeline props and generated-frame status from the adapter.
- first_studio_wiring_extraction: `PhysicsPaintStudio.tsx` now wires `timelineOccupiedRotoFrames`, `timelineSavedRotoFrames`, `timelineCachedRotoFrames`, and `currentFrameIsGeneratedRoto` from `useRotoTimelineModel`, replacing the previous direct workflow-strip ownership path for those read-only consumers.
- toggle_write_path_extraction: Interpolation toggle now routes through `useRotoTimelineActions.updateInterpolationSettings`, which delegates status/current-frame/settings derivation to `updateRotoInterpolationSettingsTransaction` in `rotoKeyTransactions.ts`. Studio still owns the external side effects and legacy local cache/list updates needed to preserve behavior, but no longer owns the toggle transaction calculation/status branching.
- save_write_path_extraction: Save current now routes through `useRotoTimelineActions.saveRealKeyAtDisplayFrame`, which delegates source target compression, source-frame override clamping, and interpolation settings/segment override derivation to `saveRotoRealKeyTransaction` in `rotoKeyTransactions.ts`. Studio still owns snapshotting, dirty refs, and `flushRotoFrame` side effects, but no longer imports `resolveRotoFarEmptyDisplaySaveTarget` or owns `mergeRotoSegmentSpacingOverride` / `resolveRotoSaveTargetForDisplayFrame` helper logic.
- studio_ownership_reduced: `PhysicsPaintStudio.tsx` line count is now 3015 lines, down 153 lines from the 3168-line pre-key-utility-cluster baseline and 189 lines from the 3204-line original Debug 01 baseline.
- marker_ownership_removed: Removed `savedRotoFrames` and `occupiedRotoFrames` `useState` ownership, removed the launch-cache mirror effect that copied `launchContext.cachedRotoFrames` into those arrays, and removed legacy marker writes from save/apply/toggle/key-utility/conversion paths.
- marker_adapter_wiring: `PhysicsPaintStudio.tsx` now passes `timelineOccupiedRotoFrames` and `timelineSavedRotoFrames` from `useRotoTimelineModel`; `rotoTimelineSelectors.ts` derives occupied/saved markers directly from canonical cached real-key frames and interpolation settings without local marker overlays.
- key_utility_ownership_removed: `useRotoKeyUtilities.ts` now owns `createRotoSession`, key-action in-flight state, session reset/versioning, copied-key/copy-paste editable state, key utility transaction local-state application, session effect switch ownership, result running, and duplicate/insert/delete/copy/paste action callbacks.
- key_utility_studio_boundary: Studio keeps thin external callbacks only: canvas snapshot, dirty refs, flush/save-before-action side effects, bridge apply payload persistence, cache/reference cleanup, and navigation/restore canvas side effects.
- remaining_roto_state: Studio still owns external/transient Roto state for editable frame overlays, dirty refs, save/apply lifecycle, cached reference/repaint/playback UI, close prompts, bridge/listener effects, window close/beforeunload guards, and engine/canvas lifecycle.
- not_yet_done: Paste/hydration dynamic-spacing symptom fixes are intentionally not patched here; do not proceed to later debug specs until the approved extraction order says to.
- verification: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/physicsPaintRotoSession.test.ts src/components/physic-paint/physicsPaintRotoKeyController.test.ts src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/rotoSourceDisplayModel.test.ts src/components/physic-paint/rotoKeyTransactions.test.ts` passed with 185 tests; `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false` passed.
- files_changed: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoKeyTransactions.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoKeyTransactions.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoTimelineSelectors.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoTimelineSelectors.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineModel.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineActions.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoKeyUtilities.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/.planning/debug/phase-36-13-roto-model.md`

## 2026-07-06 07:47 UTC — Slice: extract real-key source-frame helper to timeline selector

### Selected slice
- Function moved: `getRealCachedRotoSourceFrameNumbers` logic (Roto real-key source-frame numbers).
- From: `PhysicsPaintStudio.tsx` inline helper.
- To: `rotoTimelineSelectors.ts` as `selectRealCachedRotoSourceFrameNumbers`.

### Why this is safe
- Pure, deterministic read path already mirrored by selector semantics.
- Removes repeated source-frame-number derivation ownership from Studio.
- No behavior changes at callsites; only shared implementation move.

### Target module/hook
- `app/src/components/physic-paint/rotoTimelineSelectors.ts` (new shared selector utility)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (imports and calls shared selector)

### Expected behavior preserved
- Real-key source frame resolution for `resolveRotoSourceFrameForDisplayFrame` now uses selector-derived source-frame list.
- Roto key transaction context uses selector-derived real source frame list for write-side resolution.
- Session reset remains anchored to `getRealCachedRotoFrames` for app frame->source cache mirroring.

### Code updates made
- `app/src/components/physic-paint/rotoTimelineSelectors.ts`:
  - Added `selectRealCachedRotoSourceFrameNumbers(contextCachedRotoFrames)`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`:
  - Imported selector helper.
  - Replaced local helper usage with selector helper in `resolveRotoSourceFrameForDisplayFrame` and `rotoTimelineActions` input.
  - Left local normalization helper for `getRealCachedRotoFrames` intact (still normalizes `appFrame/displayFrame` payloads used by confirmed/session usage).

### Tests run
- `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false`

### Line-count update
- `PhysicsPaintStudio.tsx`: 3013 lines.
- Before: 3168 baseline in first log (pre-key-utility-cluster baseline).
- Net change this slice: -3 lines (one helper moved, imports/call-site updates only).

### Ownership removed from Studio
- Removed one ownership decision from Studio-specific logic: real-key source-frame-number extraction for interpolation/source resolution is now centralized in selector module.

### Next suggested slice
- Move `getRealCachedRotoFrames` normalization helper into `rotoTimelineSelectors.ts` as a `selectRealCachedRotoFrames` helper and consume it from Studio + key-utility inputs.
- Then switch `confirmedCachedRotoFramesRef` priming from `getRealCachedRotoFrames` to the shared selector-backed helper to keep real-key normalization aligned.

## 2026-07-10 — Cluster: centralize cached real-key display normalization

### Selected cluster
- Functions/ownership moved: `getRealCachedRotoFrames` and `normalizeCachedRotoRealKeyDisplayFrame`.
- From: `PhysicsPaintStudio.tsx` local helpers and two Studio-owned consumers.
- To: `rotoTimelineSelectors.ts` as `selectRealCachedRotoFrames`.

### Why this is safe
- Pure read-only normalization with no store, engine, canvas, bridge, or lifecycle effects.
- Preserves the existing contract exactly: filter to `source === 'real-key'`, retain input order, derive missing `sourceFrame`, derive missing `displayFrame`, and key normalized `appFrame` to the display frame.
- Does not change source-key compaction, interpolation settings, Save/Paste behavior, dynamic spacing, hydration writes, or generated-frame regeneration.

### Ownership removed from Studio
- Studio no longer defines real cached-key display normalization.
- `resetRotoSessionForLaunch` now primes `confirmedCachedRotoFramesRef` from the shared selector.
- `useRotoKeyUtilities` now receives normalized real-key cache frames from the shared selector.
- Added a selector-level behavior test proving generated cells are excluded and source/display identity is normalized consistently.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoTimelineSelectors.ts`
- `app/src/components/physic-paint/rotoTimelineSelectors.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 3013 lines.
- `PhysicsPaintStudio.tsx` after: 3002 lines.
- Cluster delta: -11 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 202 lines.
- Pre-key-utility-cluster baseline: 3168 lines; cumulative reduction: 166 lines.

### Tests run
- RED boundary: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` failed because `selectRealCachedRotoFrames` did not exist and Studio still owned both consumers.
- Focused GREEN: the same command passed with 89 tests.
- Full Debug 01 focused suite: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/physicsPaintRotoSession.test.ts src/components/physic-paint/physicsPaintRotoKeyController.test.ts src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/rotoSourceDisplayModel.test.ts src/components/physic-paint/rotoKeyTransactions.test.ts` passed with 186 tests.
- Typecheck: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false` passed.

### Next suggested slice
- Move `normalizeCachedRotoRealKeySourceFrame` into `rotoTimelineSelectors.ts` as a shared source-key normalization selector/helper.
- Consume it from cache merge, hydration fallback, and interpolation-toggle compaction without changing those transaction or regeneration paths.

## 2026-07-10 — Cluster: extract pure Roto cache transactions

### Selected cluster
- Functions/ownership moved: `normalizeCachedRotoRealKeySourceFrame`, `upsertCachedRotoCacheFrame`, `removeCachedRotoCacheFrame`, and `mergeRotoCacheFramesPreservingLaunchRealKeys`.
- From: `PhysicsPaintStudio.tsx` local helpers.
- To: new pure module `rotoCacheTransactions.ts`.

### Why this is safe
- The moved functions are deterministic cache-array transformations with no store, engine, canvas, bridge, component state, or lifecycle effects.
- Existing call sites and source/display identity semantics remain unchanged.
- The merge keeps store real-key precedence, preserves generated store frames, and restores only launch real keys missing from the store.
- No interpolation spacing, regeneration, hydration scheduling, or Save/Paste policy changed.

### Ownership removed from Studio
- Studio no longer defines source-key normalization, source-identity cache upsert, display-key cache removal, or launch/store cache merge policy.
- Studio retains only orchestration callbacks that update refs/context and invoke the extracted transactions.
- No state or effects were added; four local helper implementations were deleted.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoCacheTransactions.ts`
- `app/src/components/physic-paint/rotoCacheTransactions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 3002 lines.
- `PhysicsPaintStudio.tsx` after: 2961 lines.
- Cluster delta: -41 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 243 lines.

### Tests run
- Focused cache + Studio suite passed with 89 tests.
- Full Debug 01 focused suite passed with 190 tests across 8 files.
- Typecheck: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto hydration, interpolation-toggle, and refresh orchestration behind an explicit action/controller boundary.
- Keep external cache/store writes explicit and preserve the current regeneration and source/display contracts.

## 2026-07-10 — Cluster: centralize interpolation cache refresh decisions

### Selected cluster
- Ownership moved: enabled store-display cache selection, disabled real-key compaction, editable display-key derivation, and confirmed source-key map derivation.
- From: `updateRotoInterpolationSettings` inside `PhysicsPaintStudio.tsx`.
- To: `refreshRotoInterpolationCache` in `rotoCacheTransactions.ts`.

### Why this is safe
- The extracted function is a pure calculation over launch frames, store frames, and the enabled flag.
- Store writes, interpolation transaction creation, frame-sync bridge messages, apply payload transmission, and UI status updates remain explicit in Studio.
- Existing store precedence, generated-frame filtering, source-key normalization, and OFF navigation semantics are preserved.
- No dynamic-spacing policy or internal workflow effect changed.

### Ownership removed from Studio
- Studio no longer decides which cache frames survive an interpolation toggle.
- Studio no longer derives real display frames or confirmed source-key cache entries from refreshed frames.
- Studio consumes one atomic refresh result and retains only state/ref assignment plus external bridge synchronization.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoCacheTransactions.ts`
- `app/src/components/physic-paint/rotoCacheTransactions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2961 lines.
- `PhysicsPaintStudio.tsx` after: 2956 lines.
- Cluster delta: -5 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 248 lines.

### Tests run
- Focused cache + Studio suite passed with 91 tests.
- Full Debug 01 focused suite passed with 192 tests across 8 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Move launch-context Roto interpolation hydration and store seeding behind a focused launch hydrator/controller boundary.
- Keep launch listener lifecycle and initial engine/reference loading in Studio while removing store/cache policy from the component.

## 2026-07-10 — Cluster: extract Roto launch hydration controller

### Selected cluster
- Functions/ownership moved: launch real-key seeding and interpolation-aware launch cache hydration.
- From: `seedStoreRotoRealKeysFromLaunchContext` and `hydrateLaunchContextRotoInterpolation` in Studio.
- To: dependency-injected `seedRotoLaunchRealKeys` and `hydrateRotoLaunchContext` in `rotoLaunchHydration.ts`.

### Why this is safe
- The controller receives the existing store API explicitly and preserves operation order: seed missing real keys, apply settings, read refreshed settings/cache, then select store display frames or compact real-key fallback.
- Tauri/browser launch listeners, component reset, status reset, and initial engine reference loading remain in Studio.
- The interpolation toggle reuses the same explicit seed action without adding lifecycle synchronization.
- No spacing, regeneration, Save/Paste, or bridge behavior changed.

### Ownership removed from Studio
- Studio no longer loops over launch cache frames to decide which real source keys enter the store.
- Studio no longer owns interpolation hydration cache selection or source-key fallback compaction.
- Studio retains one controller call at launch receipt and one seed action before interpolation updates.
- No state or effects were added; two local helpers were deleted.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoLaunchHydration.ts`
- `app/src/components/physic-paint/rotoLaunchHydration.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2956 lines.
- `PhysicsPaintStudio.tsx` after: 2933 lines.
- Cluster delta: -23 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 271 lines.

### Tests run
- Focused hydration + Studio + WorkflowStrip suite passed with 138 tests.
- Full Debug 01 focused suite passed with 196 tests across 9 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract cached Roto playback ownership: display-frame lookup projection, playback sequence construction, timer lifecycle, loop/FPS actions, and status derivation.
- Keep the timer as an external-boundary hook and avoid introducing state-mirroring effects.

## 2026-07-10 — Cluster: extract cached Roto playback hook

### Selected cluster
- Ownership moved: playback active/frame/status/loop/FPS state, FPS clamping, timer lifecycle, sequence playback, stop/toggle/restart/reset actions, and non-Roto cleanup.
- From: Studio-local state, timer ref, callbacks, and cleanup branches.
- To: focused `useRotoCachedPlayback.ts` hook.

### Why this is safe
- Cached frame lookup remains supplied by Studio, preserving existing launch/store/preview precedence and session display-frame sequence.
- The hook owns the browser interval as a legitimate external lifecycle boundary and cleans it on unmount or workflow exit.
- Existing status strings, missing-frame behavior, immediate first frame, looping, active FPS restart, navigation/edit stop behavior, and launch reset behavior are preserved.
- No cache mutation, interpolation generation, Save/Paste, or dynamic-spacing policy moved into playback.

### Ownership removed from Studio
- Removed five playback state declarations, the playback timer ref, FPS clamp constants/helper, start/stop/toggle/FPS callbacks, timer cleanup branches, and the workflow-mode cleanup effect.
- Studio now provides frame lookup and render callbacks and consumes one hook result for CanvasStack, WorkflowStrip, keyboard, navigation, and status wiring.
- No internal state-mirroring effect was added; the hook has only timer cleanup and external workflow-boundary cleanup.

### Files changed in this cluster
- `app/src/components/physic-paint/useRotoCachedPlayback.ts`
- `app/src/components/physic-paint/useRotoCachedPlayback.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2933 lines.
- `PhysicsPaintStudio.tsx` after: 2858 lines.
- Cluster delta: -75 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 346 lines.

### Tests run
- Focused hook behavior coverage includes FPS clamp, empty cache, missing frames, immediate playback, loop, stop, active FPS restart, and launch reset.
- Full Debug 01 focused suite passed with 201 tests across 10 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract cached Roto display/reference lookup and repaint-base loading into a focused cache/reference controller or hook.
- Preserve engine preview-base operations as explicit external actions and keep dirty/live-overlay decisions transactionally visible.

## 2026-07-10 — Cluster: extract cached Roto reference controller

### Selected cluster
- Ownership moved: cached display/reference lookup precedence, cached reference URL state, repaint-base state, dirty-frame refusal, and engine preview-base loading/reset behavior.
- From: Studio-local state plus `findCachedRotoDisplayFrame`, `findCachedRotoReferenceFrame`, and `loadCachedRotoReferenceFrame`.
- To: focused `useRotoReferenceController.ts`.

### Why this is safe
- The controller preserves lookup order: generated launch/store display frame, live preview real key, launch/store real key, confirmed display fallback, then generic store frame fallback.
- Engine operations remain explicit through an injected preview-background interface.
- Dirty frames still refuse cached reload, cached repaint bases remain available for merge, and successful loads clear stale dirty/live-overlay markers before syncing pending state.
- No Save/apply transaction, interpolation spacing, playback, or bridge lifecycle changed.

### Ownership removed from Studio
- Removed cached reference/repaint-base state declarations and the three lookup/load functions.
- Studio now supplies current context, cache maps, dirty/live-overlay sets, store lookups, engine settings, and status/sync callbacks to one controller.
- Existing external current-frame/engine loading effect remains thin and calls the controller action.
- No broad internal workflow effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/useRotoReferenceController.ts`
- `app/src/components/physic-paint/useRotoReferenceController.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2858 lines.
- `PhysicsPaintStudio.tsx` after: 2824 lines.
- Cluster delta: -34 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 380 lines.

### Tests run
- Focused controller tests cover lookup precedence, dirty refusal/repaint preservation, successful engine load/cleanup/status, and empty-cache reset.
- Full Debug 01 focused suite passed with 200 tests across 10 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto save/apply lifecycle ownership around timeout, flush, pending apply bookkeeping, success/failure result handling, and navigation continuation.
- Split pure payload/result transactions from external bridge/engine actions rather than creating one monolithic hook.

## 2026-07-10 — Cluster: extract Roto apply lifecycle state and matching

### Selected cluster
- Ownership moved: pending-apply construction, operation/kind/frame result matching, timeout transition data, close-after-save detection, active operation tracking, save-on-leave/advance bookkeeping, and timer setup/cleanup.
- From: Studio-local refs plus `startApplyTimeout` transition logic and apply-result matching preamble.
- To: pure `rotoApplyTransactions.ts` and focused external `useRotoApplyLifecycle.ts`.

### Why this is safe
- Pure transactions encode only pending/result/timeout decisions and status copy.
- The hook owns the browser timeout as an external lifecycle boundary and exposes explicit setters/getters/actions used by existing Studio workflows.
- Play-specific result handling, Roto rendering/merge, bridge sends, session success/failure effects, navigation continuation, and close execution remain in Studio.
- Existing operation/kind/start-frame mismatch rejection, timeout messages, dirty retry behavior, and close-after-save detection are preserved.

### Ownership removed from Studio
- Removed direct declarations for active/pending apply, timeout, pending advance, save-on-leave rendered/delete state, close operation/request/bypass state, and associated cleanup branches.
- Studio now asks the lifecycle controller to begin/match/clear/timeout operations and consumes pure transition results.
- No state-mirroring effect was added; the hook has only timeout cleanup.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoApplyTransactions.ts`
- `app/src/components/physic-paint/rotoApplyTransactions.test.ts`
- `app/src/components/physic-paint/useRotoApplyLifecycle.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2824 lines.
- `PhysicsPaintStudio.tsx` after: 2807 lines.
- Cluster delta: -17 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 397 lines.

### Tests run
- Pure transaction tests cover pending construction, exact/mismatched result matching, timeout transitions, close-after-save detection, and failure copy.
- Full Debug 01 focused suite passed with 210 tests across 12 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract `flushRotoFrame` and `saveRotoFrame` payload/render construction behind a focused save controller, keeping engine capture/merge and bridge sends explicit.
- Then extract successful Roto apply-result side effects and navigation continuation against the new lifecycle boundary.

## 2026-07-10 — Cluster: extract Roto save controller and payload planning

### Selected cluster
- Ownership moved: flush guards/in-flight serialization, delete/apply-canvas plan construction, source override resolution, rendered-frame preparation, cached repaint merge path, background-only/editable markers, bridge send orchestration, save-on-leave tracking, timeout startup, engine restoration, Save current, and Save pending.
- From: `flushRotoFrame`, `saveRotoFrame`, and `savePendingRotoFrames` in Studio.
- To: pure `rotoSaveTransactions.ts` and focused `useRotoSaveController.ts`.

### Why this is safe
- Pure transactions decide delete versus apply-canvas payload shape and preserve source/display/settings/background metadata.
- The controller receives engine, canvas, cache/reference, session, lifecycle, bridge, and status dependencies explicitly.
- Existing captured-frame reuse, cached alpha merge, transparent output, background-only handling, dirty/editable bookkeeping, advance request timing, error copy, and previous engine-state restoration are preserved.
- Successful apply-result side effects remain in Studio as the next isolated boundary.

### Ownership removed from Studio
- Removed the large flush/save/save-pending callback bodies and their detailed payload/render branches.
- Studio now configures one save controller and consumes `flushFrame`, `saveFrame`, and `savePendingFrames` actions.
- No internal workflow effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoSaveTransactions.ts`
- `app/src/components/physic-paint/rotoSaveTransactions.test.ts`
- `app/src/components/physic-paint/useRotoSaveController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2807 lines.
- `PhysicsPaintStudio.tsx` after: 2667 lines.
- Cluster delta: -140 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 537 lines.

### Tests run
- Pure transaction tests cover delete/apply-canvas planning, source overrides, background/onion metadata, generated/dirty guards, and payload construction.
- Full Debug 01 focused suite passed with 218 tests across 13 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract successful and failed Roto apply-result side effects, cached-merge completion, session success/failure transitions, navigation continuation, and close-after-save execution into a focused result controller.
- Keep Play result copy in Studio and reuse `useRotoApplyLifecycle` matching/clear operations.

## 2026-07-10 — Cluster: extract Roto apply-result completion

### Selected cluster
- Ownership moved: Roto result-kind classification, failed save/session retry cleanup, close-save failure recovery, key/interpolation success copy, apply-canvas/delete cache completion, session success effects, dirty/captured cleanup, cached repaint merge acceptance, preview-base restoration, editable marker removal, queued advance navigation/status, and close-after-save execution.
- From: the Roto branches of `handleApplyResult` in Studio.
- To: pure `rotoApplyResultTransactions.ts` and focused `useRotoApplyResultController.ts`.

### Why this is safe
- Exact operation/kind/start-frame matching remains owned by `useRotoApplyLifecycle` before the result controller runs.
- The pure transaction classifies only Roto result kinds and preserves existing failure diagnostics and success copy.
- The controller receives session, cache, engine, navigation, close, refs, and status dependencies explicitly and performs the existing side effects in their original order.
- Play result copy and Play-specific branches remain in Studio.
- No internal workflow `useEffect` was added.

### Ownership removed from Studio
- Removed Roto apply failure cleanup, save-on-leave retry/session synchronization, close-save failure handling, replace-key/interpolation success branches, apply-canvas/delete completion, cached repaint finalization, queued navigation, and close continuation from `handleApplyResult`.
- Studio now matches the result, delegates accepted Roto results, and retains only mismatch plus Play result handling.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoApplyResultTransactions.ts`
- `app/src/components/physic-paint/rotoApplyResultTransactions.test.ts`
- `app/src/components/physic-paint/useRotoApplyResultController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2667 lines.
- `PhysicsPaintStudio.tsx` after: 2634 lines.
- Cluster delta: -33 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 570 lines.

### Tests run
- Pure result transaction tests cover Roto/Play classification, save failure diagnostics/close continuation, apply/delete completion, key/interpolation success copy, and Play passthrough.
- Focused Studio/result tests passed with 91 tests across 2 files.
- Full Debug 01 matrix, typecheck, and `git diff --check` are recorded in the completion report after final validation.

### Next suggested slice
- Continue only with another coherent Debug 01 ownership extraction if needed; dynamic-spacing behavior and Debug 02+ remain out of scope.

## 2026-07-10 — Cluster: extract Roto close lifecycle

### Selected cluster
- Ownership moved: close prompt state/message, native close listener, dirty-current guard, snapshot-only beforeunload boundary, close-without-save, cancel, save-and-close initiation, Tauri close action, and browser fallback.
- From: Studio-local state, callbacks, and two window/Tauri effects.
- To: focused `useRotoCloseLifecycle.ts`.

### Why this is safe
- The hook consumes existing apply lifecycle/result controller refs and save action, preserving operation matching and close continuation.
- Native close remains guarded only for dirty current Roto frames; clean frames and non-Roto workflows are not intercepted.
- Beforeunload remains snapshot-only and never flushes or prevents browser unload.
- Exact prompt choices/copy, send/timeout/result recovery, close bypass, and browser fallback are preserved.

### Ownership removed from Studio
- Removed close prompt state declarations, close callbacks, window close implementation, beforeunload effect, and Tauri onCloseRequested effect.
- Studio now consumes close state/actions and retains only JSX wiring.
- The extracted effects synchronize only with external window/Tauri lifecycle.

### Files changed in this cluster
- `app/src/components/physic-paint/useRotoCloseLifecycle.ts`
- `app/src/components/physic-paint/useRotoCloseLifecycle.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2634 lines.
- `PhysicsPaintStudio.tsx` after: 2554 lines.
- Cluster delta: -80 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 650 lines.

### Tests run
- Focused close tests cover snapshot-only unload, dirty native prompt, bypass/cancel/save continuation, and browser fallback wiring.
- Full Debug 01 focused suite passed with 223 tests across 14 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract transient Roto edit-buffer ownership: dirty/editable/captured/preview/frame-state maps, snapshot/mark-dirty/clear/undo transitions, and pending-session synchronization.
- Keep engine canvas capture as injected external actions and avoid replacing one Studio monolith with one controller monolith.

## 2026-07-10 — Cluster: extract transient Roto edit buffer

### Selected cluster
- Ownership moved: dirty frames, editable engine states, preview/captured frames, live overlay action counts, editable-frame markers, snapshot persistence, dirty/begin-edit transitions, overlay undo, Roto clear behavior, and launch reset.
- From: Studio-local refs/state and snapshot/mark/clear/undo helper bodies.
- To: pure `rotoEditBufferTransactions.ts` and focused `useRotoEditBufferController.ts`.

### Why this is safe
- Pure transactions own collection updates and cached-base-preserving decisions.
- Engine save/capture/clear/reset and transparent canvas export remain explicit injected actions.
- Generated frames remain render-only, cached repaint bases remain preserved until live overlay changes, empty/non-persistable snapshots are removed, and editable markers still reflect actual content.
- Play clear/undo branches and user-facing status copy remain in Studio.

### Ownership removed from Studio
- Removed direct transient Roto map/set declarations and most add/remove/dirty/snapshot/clear/undo bookkeeping.
- Studio now supplies engine capture and consumes controller refs/actions shared with save/reference/key/close controllers.
- No state-mirroring effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoEditBufferTransactions.ts`
- `app/src/components/physic-paint/rotoEditBufferTransactions.test.ts`
- `app/src/components/physic-paint/useRotoEditBufferController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2554 lines.
- `PhysicsPaintStudio.tsx` after: 2521 lines.
- Cluster delta: -33 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 683 lines.

### Tests run
- Pure edit-buffer tests cover dirty/overlay increments, undo-to-empty, cached-base clear preservation, normal clear/delete, snapshot persistence, and launch reset.
- Full Physics Paint suite passed with 289 tests across 20 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Play editing/cache/preview/render ownership into focused controllers, starting with pure frame assignment/cache selectors before interval/render bridge actions.
- Then extract engine/canvas lifecycle, parent bridge/listeners, settings actions, and final composition helpers toward the 400–600 line target.

## 2026-07-10 — Cluster: extract Play edit/cache ownership

### Selected cluster
- Ownership moved: Play stroke-frame annotation/parsing/count, preview/start-frame normalization, wiggle normalization, cached frame/range selection, latest frame cache/ref/version, local preview frame/ref, cached preview URL/dirty state, selected-script dirty action, pending edit capture, begin-frame-edit, cached background load, local preview, and editable-state restore/reset.
- From: Studio-local helpers, state/refs, and edit/cache callbacks.
- To: pure `playFrameTransactions.ts` and focused `usePlayEditCacheController.ts`.

### Why this is safe
- Pure selectors preserve selected script start-frame math and launch/store fallback order.
- The controller receives engine preview-background actions explicitly and keeps stroke assignment tied to engine stroke count.
- Cached/stale semantics, local preview isolation from editor sync, background clearing/loading, dirty invalidation, and editable-state annotation remain unchanged.
- Animation/render/apply lifecycle and conversion actions remain separate.

### Ownership removed from Studio
- Removed Play assignment/count helpers and most latest/local/cached edit state declarations and callback bodies.
- Studio now consumes controller state/actions for preview, edit intent, save-state annotation, cache status, and conversion availability.
- No broad internal synchronization effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/playFrameTransactions.ts`
- `app/src/components/physic-paint/playFrameTransactions.test.ts`
- `app/src/components/physic-paint/usePlayEditCacheController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2521 lines.
- `PhysicsPaintStudio.tsx` after: 2412 lines.
- Cluster delta: -109 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 792 lines.

### Tests run
- Pure Play tests cover stroke assignment round-trip, frame-count derivation, wiggle/start/preview normalization, and cached range lookup.
- Full Physics Paint suite passed with 292 tests across 21 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract cached/live Play preview interval, AnimationPlayer lifecycle, Save Play render/apply, frame-count/wiggle launch updates, and selected Play options update into focused render/preview controllers.
- Keep Play/Roto conversion actions separate for the following cluster.

## 2026-07-10 — Cluster: extract Play render and preview lifecycle

### Selected cluster
- Ownership moved: cached/live Play preview, preview interval/timer cleanup, AnimationPlayer lifecycle, playing/progress state, render capture timeout, Save Play rendering/apply flow, selected option update, frame-count/wiggle cache invalidation, and related launch/cache state planning.
- From: Studio-local timer/player refs, preview/save/options callbacks, and update branches.
- To: pure `playLifecycleTransactions.ts` and focused `usePlayPreviewController.ts`.

### Why this is safe
- Pure transactions preserve selected script range/start-frame mapping, option equality, frame-count limits, wiggle normalization, and cached/stale launch updates.
- The controller owns browser interval and AnimationPlayer lifecycle as external boundaries.
- Immediate cached preview, live editable annotation, background reset, capture appFrame mapping, render timeout, apply registration/send ordering, and status strings remain unchanged.
- Roto cached playback stop integration remains explicit; conversion actions stay separate.

### Ownership removed from Studio
- Removed cached preview timer/player lifecycle details and most preview/save/options/frame-count/wiggle callback bodies.
- Studio now supplies engine, edit-cache controller, apply lifecycle, bridge, settings, and launch dependencies and consumes preview/render actions/state.
- No broad state-mirroring effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/playLifecycleTransactions.ts`
- `app/src/components/physic-paint/playLifecycleTransactions.test.ts`
- `app/src/components/physic-paint/usePlayPreviewController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2412 lines.
- `PhysicsPaintStudio.tsx` after: 2315 lines.
- Cluster delta: -97 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 889 lines.

### Tests run
- Pure lifecycle tests cover frame-count limits, option equality/cache invalidation, render frame mapping, and launch cache planning.
- Full Physics Paint suite passed with 296 tests across 22 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Play-to-Roto and Roto-to-Play conversion payload/state ownership into pure transactions and a focused bridge controller.
- Then extract engine/canvas lifecycle, parent bridge/listeners, settings actions, session file/dev export, and final composition helpers.

## 2026-07-10 — Cluster: extract Play/Roto conversion controller

### Selected cluster
- Ownership moved: Play-to-Roto missing-frame validation/range planning/payload/context transition and Roto-to-Play payload/context/cache transition, plus bridge registration/send/timeout/error cleanup and store writes/removals.
- From: `convertPlayToRoto` and `convertRotoToPlay` in Studio.
- To: pure `rotoPlayConversionTransactions.ts` and focused `useRotoPlayConversionController.ts`.

### Why this is safe
- Pure transactions preserve expected frame ordering, canonical missing-frame copy, operation IDs, payload fields, selected script metadata, render options/wiggle, start frame, frame count, preview frame, and cache status transitions.
- The controller receives engine/store/edit-cache/apply lifecycle/bridge dependencies explicitly.
- Existing registration-before-send, timeout startup, error cleanup, store writes/removals, latest Play reset, and cached Roto refresh remain unchanged.
- Roto source/display/interpolation modules were not modified.

### Ownership removed from Studio
- Removed both conversion callback bodies and their detailed payload/context/store branches.
- Studio now consumes two controller actions and retains UI wiring only.
- No internal workflow effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoPlayConversionTransactions.ts`
- `app/src/components/physic-paint/rotoPlayConversionTransactions.test.ts`
- `app/src/components/physic-paint/useRotoPlayConversionController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2315 lines.
- `PhysicsPaintStudio.tsx` after: 2232 lines.
- Cluster delta: -83 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 972 lines.

### Tests run
- Pure conversion tests cover missing Play frames, ordered payloads, Play-to-Roto context, and Roto-to-Play context/cache planning.
- Full Physics Paint suite passed with 302 tests across 23 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract engine/canvas mount, restore, preview-background, tablet input, and render-setting synchronization into focused external lifecycle hooks.
- Then extract parent launch/apply bridge listeners, settings/tool actions, session file/dev export, onion/navigation/keyboard helpers, and final composition.

## 2026-07-10 — Cluster: extract engine and canvas lifecycle

### Selected cluster
- Ownership moved: engine/canvas state, imperative engine ref, canvas-key reset, canvas mounting/measurement/readiness/error handling, tablet-pressure listener/pen bridge, editable-state resize/restore, Roto background engine sync, Play render-options engine sync, and lifecycle cleanup.
- From: Studio-local state/effects plus CanvasMountProbe and sizing helpers.
- To: `usePhysicsPaintEngineLifecycle.ts`, `PhysicsPaintCanvasMount.tsx`, and pure `physicsPaintCanvasSizing.ts`.

### Why this is safe
- Effects synchronize only with external engine/canvas/Tauri boundaries.
- Editable state is resized with the same point scaling before load; restore errors keep the same user copy.
- Roto paper metadata and Play render options call the same engine APIs with unchanged values.
- Canvas aspect/measurement, readiness, paper texture scale, native pen input, and canvas-key remount behavior remain unchanged.
- Parent launch/apply listeners and settings actions remain separate.

### Ownership removed from Studio
- Removed engine/canvas state/ref lifecycle effects, tablet listener, restore/sync effects, CanvasMountProbe component, and sizing/resize helpers.
- Studio now consumes lifecycle state/ref and renders the extracted canvas mount component.
- No internal workflow control effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/usePhysicsPaintEngineLifecycle.ts`
- `app/src/components/physic-paint/PhysicsPaintCanvasMount.tsx`
- `app/src/components/physic-paint/physicsPaintCanvasSizing.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2232 lines.
- `PhysicsPaintStudio.tsx` after: 2066 lines.
- Cluster delta: -166 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1138 lines.

### Tests run
- Full Physics Paint suite passed with 303 tests across 23 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract parent launch context acquisition/event listener and browser/Tauri apply-result listeners into focused bridge lifecycle hooks.
- Then extract settings/tool actions, session file/dev export, onion/navigation/keyboard helpers, and final JSX composition.

## 2026-07-10 — Cluster: extract parent bridge lifecycle

### Selected cluster
- Ownership moved: URL launch-context parsing/application, bridge-mode detection, stored Tauri launch fetch, launch event listener, browser custom/postMessage apply-result listeners, Tauri apply-result listener, origin/payload validation, diagnostics, and cleanup.
- From: Studio-local helpers/state/effects and listener installation.
- To: pure `physicsPaintLaunchContext.ts` and focused `usePhysicsPaintParentBridge.ts`.

### Why this is safe
- The bridge hook consumes existing launch hydration/reset/cache/reference and Play/Roto result dispatch callbacks.
- Stored launch and event launch use the same apply path; close-save continuation and status-reset rules remain unchanged.
- Browser messages remain same-origin filtered, custom results remain validated, and Tauri listeners preserve disposal cleanup and diagnostics.
- Effects synchronize only with external bridge/event sources.

### Ownership removed from Studio
- Removed URL parse/application helpers, bridge mode state/detection effect, incoming launch callback body, stored/event launch effect, and browser/Tauri result listener effects.
- Studio now receives bridge mode from the hook and supplies thin launch/result callbacks.
- No internal workflow synchronization effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/physicsPaintLaunchContext.ts`
- `app/src/components/physic-paint/physicsPaintLaunchContext.test.ts`
- `app/src/components/physic-paint/usePhysicsPaintParentBridge.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2066 lines.
- `PhysicsPaintStudio.tsx` after: 1899 lines.
- Cluster delta: -167 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1305 lines.

### Tests run
- Launch-context tests cover raw URL/query/hash parsing and deterministic state application.
- Full Physics Paint suite passed with 305 tests across 24 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract settings/tool/physics/background actions and persisted Roto background metadata into a focused engine-actions hook.
- Then extract session file/dev export, onion/navigation/keyboard helpers, readiness/status derivation, and final JSX composition.

## 2026-07-10 — Cluster: extract settings and engine actions

### Selected cluster
- Ownership moved: Studio settings type/defaults, Play render option build/apply, Roto background metadata build/apply, tool/color/brush/background/material/physics actions, and persisted Roto background synchronization.
- From: Studio-local type/helpers/state callbacks and metadata effect.
- To: `physicsPaintStudioSettings.ts`, `usePhysicsPaintEngineActions.ts`, and `useRotoBackgroundMetadataSync.ts`.

### Why this is safe
- Engine actions call the same APIs with the same values and preserve settings updates/status behavior.
- Play tool mapping and option snapshots remain byte-for-byte equivalent in meaning.
- Roto photo background still persists as transparent metadata and white still carries `#ffffff`.
- The metadata effect is isolated to an external store synchronization boundary.

### Ownership removed from Studio
- Removed settings type/default/conversion helpers and the individual engine action callback bodies.
- Studio now consumes one engine-actions result and shared settings utilities used by engine/Play/conversion controllers.
- No workflow-control effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/physicsPaintStudioSettings.ts`
- `app/src/components/physic-paint/physicsPaintStudioSettings.test.ts`
- `app/src/components/physic-paint/usePhysicsPaintEngineActions.ts`
- `app/src/components/physic-paint/usePhysicsPaintEngineActions.test.ts`
- `app/src/components/physic-paint/useRotoBackgroundMetadataSync.ts`
- `app/src/components/physic-paint/usePhysicsPaintEngineLifecycle.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1899 lines.
- `PhysicsPaintStudio.tsx` after: 1752 lines.
- Cluster delta: -147 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1452 lines.

### Tests run
- Settings tests cover defaults, Play tool mapping/snapshot application, and Roto background metadata conversion/application.
- Engine action tests cover method invocation and settings state transitions.
- Full Physics Paint suite passed with 310 tests across 26 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract editable session save/load and debug proof export into a focused utility hook/controller.
- Then extract onion preview/navigation/keyboard/readiness helpers and final JSX composition toward the 400–600 line target.

## 2026-07-10 — Cluster: extract session and debug export controller

### Selected cluster
- Ownership moved: editable state download, FileReader load/error/input reset, working-canvas resize/load, Play assignment/frame-count/preview/cache restoration, Roto direct load, and debug still/manifest export/status copy.
- From: Studio-local save/load/export callbacks.
- To: focused `usePhysicsPaintSessionController.ts`.

### Why this is safe
- Browser download and FileReader remain explicit external actions.
- Loaded states use the same resize helper before engine load.
- Play restoration preserves assignment parsing, preview selection, frame count, cache stale/reset, workflow metadata, and Roto gap-limit removal; Roto loads do not alter Play state.
- Save cancellation and debug proof fields/copy remain unchanged.

### Ownership removed from Studio
- Removed saveEditableState, loadEditableState, and exportDebugProof callback bodies.
- Studio now supplies engine/canvas/workflow/edit-cache/status dependencies and consumes three controller actions.
- No lifecycle effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/usePhysicsPaintSessionController.ts`
- `app/src/components/physic-paint/usePhysicsPaintSessionController.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1752 lines.
- `PhysicsPaintStudio.tsx` after: 1665 lines.
- Cluster delta: -87 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1539 lines.

### Tests run
- Controller tests cover Play and Roto load paths, FileReader errors/input reset, save cancellation, and debug export wiring.
- Full Physics Paint suite passed with 312 tests across 27 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto/Play navigation actions, onion preview projection, keyboard shortcuts, readiness/status derivation, and Play limit toast into focused pure/controller boundaries.
- Then move the large JSX tree into a presentational composition component, leaving Studio as dependency wiring.

## 2026-07-11 — Cluster: extract interaction and derived selectors

### Selected cluster
- Ownership moved: navigation target derivation, onion candidate/anchor/filter/order/opacity projection, readiness/missing conditions, Play conversion availability/cache status, Roto playback availability, and Play limit toast timer/actions.
- From: Studio-local helpers, derived blocks, and timer state.
- To: `rotoNavigationActions.ts`, `rotoOnionPreview.ts`, `physicsPaintStudioSelectors.ts`, and `usePlayLimitToast.ts`.

### Why this is safe
- Navigation still routes through the existing save-before-navigation/session coordinator and preserves frame sync/engine/reference behavior.
- Onion projection keeps real-key-only anchors, dirty preview precedence, direction/count filtering, ordering, and opacity depth.
- Readiness strings and cache/conversion booleans are pure derivations from existing inputs.
- Toast timing remains the same 5000 ms external timer boundary.

### Ownership removed from Studio
- Removed navigation target helpers, onion builder/opacity/anchor logic, readiness/cache/conversion derivations, and toast timer implementation.
- Studio consumes focused selectors/actions while retaining keyboard dispatch and external navigation side effects.
- No state-mirroring effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoNavigationActions.ts`
- `app/src/components/physic-paint/rotoNavigationActions.test.ts`
- `app/src/components/physic-paint/rotoOnionPreview.ts`
- `app/src/components/physic-paint/rotoOnionPreview.test.ts`
- `app/src/components/physic-paint/physicsPaintStudioSelectors.ts`
- `app/src/components/physic-paint/physicsPaintStudioSelectors.test.ts`
- `app/src/components/physic-paint/usePlayLimitToast.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1665 lines.
- `PhysicsPaintStudio.tsx` after: 1602 lines.
- Cluster delta: -63 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1602 lines.

### Tests run
- Focused tests cover navigation target routing, onion projection/opacity, readiness/cache/conversion selectors, and toast wiring.
- Full Physics Paint suite passed with 320 tests across 30 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Move the TopBar/ToolRail/Canvas/RightPanel/WorkflowStrip/confirmation/shortcuts JSX tree into a presentational `PhysicsPaintStudioView` component with cohesive view-model props.
- Then audit remaining Studio helpers/callbacks and extract keyboard/navigation coordination or orchestration bundles until the 400–600 line target is reached.

## 2026-07-11 — Cluster: extract Studio presentation view

### Selected cluster
- Ownership moved: main layout, TopBar, ToolRail, canvas mount/overlays/toast, RightPanel, WorkflowStrip, Roto close confirmation, and shortcuts help JSX.
- From: the Studio return tree.
- To: typed presentational `PhysicsPaintStudioView.tsx` with grouped layout/topBar/toolRail/canvas/rightPanel/workflow/status/action props.

### Why this is safe
- DOM structure, classes, ARIA attributes, visible copy, event handlers, and child component prop wiring are preserved.
- Studio retains all hooks/controllers, derived values, and action callbacks.
- Grouped typed props avoid an untyped bag and keep presentation ownership cohesive.

### Ownership removed from Studio
- Studio no longer owns the large UI tree and now returns one view component.
- Layout-specific source contracts inspect the view source while orchestration contracts remain on Studio.
- No behavior or lifecycle effect changed.

### Files changed in this cluster
- `app/src/components/physic-paint/PhysicsPaintStudioView.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1602 lines.
- `PhysicsPaintStudio.tsx` after: 1379 lines.
- Cluster delta: -223 lines.
- `PhysicsPaintStudioView.tsx`: 168 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 1825 lines.

### Tests run
- Full Physics Paint suite passed with 320 tests across 30 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Audit the remaining Studio orchestration and group controller configuration into focused Roto, Play, bridge, and view-model coordinator hooks.
- Keep Studio itself as top-level state selection/dependency wiring and drive it to the 400–600 line target without moving all logic into one monolith.

## 2026-07-11 — Cluster: extract pure Studio utilities

### Selected cluster
- Ownership moved: outbound parent transport, Roto canvas/frame rendering helpers, occupied-frame insertion, and shortcut target filtering.
- From: module-level helpers in `PhysicsPaintStudio.tsx`.
- To: `bridge/physicsPaintBridgeTransport.ts`, `roto/rotoCanvasFrames.ts`, and `physicsPaintStudioKeyboard.ts`.
- Reused the canonical Roto persistence predicates from `rotoSaveTransactions.ts` instead of retaining duplicate Studio definitions.

### Why this is safe
- Bridge transport preserves the existing Tauri emit, browser opener, same-origin apply, and frame-sync fallback behavior.
- Roto canvas export preserves temporary transparent background switching, engine-state restoration, output sizing, alpha-canvas registration, and rendered-frame metadata.
- Shortcut filtering preserves input, textarea, select, contenteditable, and nested editable-target guards.
- No lifecycle or internal workflow effect was added.

### Ownership removed from Studio
- Removed all module-level bridge transport implementations.
- Removed all module-level Roto canvas/frame implementations and duplicate save predicates.
- Removed the module-level shortcut target predicate.
- Studio retains only imports and orchestration call sites for these utilities.

### Files changed in this cluster
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts`
- `app/src/components/physic-paint/roto/rotoCanvasFrames.ts`
- `app/src/components/physic-paint/roto/rotoCanvasFrames.test.ts`
- `app/src/components/physic-paint/physicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/physicsPaintStudioKeyboard.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1379 lines.
- `PhysicsPaintStudio.tsx` after: 1282 lines.
- Cluster delta: -97 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 1922 lines.

### Tests run
- Focused utility, Studio, and WorkflowStrip tests passed with 150 tests across 4 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Play edit/cache, preview/render, persistence, and Play-facing session orchestration behind a focused coordinator with narrow ports.
- Move touched Play modules into `play/` and thin adapters into `hooks/` without creating a replacement monolith.

## 2026-07-11 — Cluster: extract Play coordinator

### Selected cluster
- Ownership moved: Play edit/cache and preview controller composition, frame-count and wiggle updates, selected Play option persistence, Play render/apply, cached-preview synchronization, and Play cache/conversion derivations.
- From: Play orchestration blocks in `PhysicsPaintStudio.tsx`.
- To: bounded `hooks/usePhysicsPaintPlayCoordinator.ts` with explicit apply-lifecycle and bridge ports.
- Pure Play transactions moved into `play/`; thin Play adapters and the toast hook moved into `hooks/` as their ownership was touched.

### Why this is safe
- Existing edit annotation, cached-preview precedence, animation playback/rendering, payload construction, apply timeout registration, cache invalidation, and error copy are preserved.
- Cross-workflow Play/Roto conversion and generic session import/export remain outside the Play coordinator.
- The only coordinator effect is the existing cached-preview synchronization with the external engine; no internal Roto repair effect was added.
- The coordinator is 209 lines and does not replace Studio with a mega-hook.

### Ownership removed from Studio
- Removed direct `usePlayEditCacheController` and `usePlayPreviewController` composition.
- Removed Studio-local Play frame-count, wiggle, option-update, save/render, cached-preview synchronization, and Play cache status/conversion derivation blocks.
- Studio consumes one focused Play state/action boundary while retaining cross-workflow wiring.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/usePhysicsPaintPlayCoordinator.ts`
- `app/src/components/physic-paint/hooks/usePlayEditCacheController.ts`
- `app/src/components/physic-paint/hooks/usePlayPreviewController.ts`
- `app/src/components/physic-paint/hooks/usePlayLimitToast.ts`
- `app/src/components/physic-paint/play/playFrameTransactions.ts`
- `app/src/components/physic-paint/play/playFrameTransactions.test.ts`
- `app/src/components/physic-paint/play/playLifecycleTransactions.ts`
- `app/src/components/physic-paint/play/playLifecycleTransactions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `app/src/components/physic-paint/physicsPaintLaunchContext.ts`
- `app/src/components/physic-paint/physicsPaintStudioSettings.ts`
- `app/src/components/physic-paint/usePhysicsPaintSessionController.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1282 lines.
- `PhysicsPaintStudio.tsx` after: 1100 lines.
- Cluster delta: -182 lines.
- `hooks/usePhysicsPaintPlayCoordinator.ts`: 209 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2104 lines.

### Tests run
- Focused Play transaction, Studio, and WorkflowStrip tests passed with 148 tests across 4 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto edit-buffer, snapshot/cache mutation, save/apply-result, and close persistence orchestration into a separate persistence coordinator with narrow navigation/session ports.
- Move touched Roto pure modules into `roto/` and thin lifecycle adapters into `hooks/` without absorbing key/navigation policy.

## 2026-07-11 — Cluster: extract Roto persistence foundation

### Selected cluster
- Ownership moved: transient edit-buffer creation/refs, confirmed real-key reference storage, cached-reference composition, launch-context cache upsert/removal, and persistence-owned launch reset.
- From: direct setup and cache mutation blocks in `PhysicsPaintStudio.tsx`.
- To: bounded `hooks/useRotoFramePersistenceCoordinator.ts` with narrow store, launch-context, pending-state, and status ports.
- Touched cache/edit transactions moved into `roto/`; touched lifecycle adapters moved into `hooks/`.

### Why this is safe
- Cache normalization, real-key upsert, interpolation-store precedence, editable-marker updates, cached reference lookup, and launch reset behavior are preserved.
- Save-on-leave, apply-result, close, key-session, playback, interpolation, and navigation policy remain outside this coordinator where their dependencies are still cyclic.
- The coordinator is 93 lines; it deliberately does not become a persistence mega-hook.
- No workflow effect was added.

### Ownership removed from Studio
- Removed direct edit-buffer and confirmed-frame ref construction.
- Removed direct cached-reference controller composition.
- Removed Studio-local cached-frame launch-context upsert/removal implementations.
- Reduced launch reset to delegation for persistence-owned state.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts`
- `app/src/components/physic-paint/hooks/useRotoEditBufferController.ts`
- `app/src/components/physic-paint/hooks/useRotoReferenceController.ts`
- `app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts`
- `app/src/components/physic-paint/hooks/useRotoSaveController.ts`
- `app/src/components/physic-paint/roto/rotoCacheTransactions.ts`
- `app/src/components/physic-paint/roto/rotoCacheTransactions.test.ts`
- `app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts`
- `app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts`
- `app/src/components/physic-paint/rotoLaunchHydration.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1100 lines.
- `PhysicsPaintStudio.tsx` after: 1067 lines.
- Cluster delta: -33 lines.
- `hooks/useRotoFramePersistenceCoordinator.ts`: 93 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2137 lines.

### Tests run
- Focused Roto transactions/reference, Studio, and WorkflowStrip tests passed with 157 tests across 5 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract the coupled Roto save-on-leave, key-session, playback, restore, and frame-navigation orchestration behind a navigation coordinator with narrow persistence ports.
- Remove `rotoKeyUtilitiesExternalRef` late binding rather than moving it into another module unchanged.

## 2026-07-11 — Cluster: extract Roto navigation coordinator

### Selected cluster
- Ownership moved: Roto key utility/session composition, cached playback composition, save-on-leave navigation requests, queued destinations, launch reset, and first/previous/next/last navigation action composition.
- From: direct key/playback/navigation composition in `PhysicsPaintStudio.tsx`.
- To: bounded `hooks/useRotoNavigationCoordinator.ts` using explicit persistence, display, and runtime ports defined in `roto/rotoCoordinatorPorts.ts`.
- Touched key/playback hooks moved into `hooks/`; touched navigation actions moved into `roto/`.

### Why this is safe
- Ordinary synchronized opening and post-save opening remain distinct concrete integration paths.
- Save-before-navigation still snapshots once, queues destinations while an operation is active, executes session effects, and opens the saved destination without re-snapshotting.
- Key persistence, source restoration, canvas clearing, and bridge/store mutations remain explicit port implementations in Studio pending the next composition cleanup.
- `rotoKeyUtilitiesExternalRef` was removed entirely rather than relocated.
- No internal Roto `useEffect` was introduced.

### Ownership removed from Studio
- Removed direct `useRotoKeyUtilities` composition and action extraction.
- Removed direct `useRotoCachedPlayback` composition and playback frame projection helpers.
- Removed Studio-local request-navigation and navigation-action construction.
- Replaced broad late-bound external utility ownership with narrow typed ports.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts`
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts`
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts`
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts`
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts`
- `app/src/components/physic-paint/roto/rotoNavigationActions.ts`
- `app/src/components/physic-paint/roto/rotoNavigationActions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1067 lines.
- `PhysicsPaintStudio.tsx` after: 1044 lines.
- Cluster delta: -23 lines.
- `hooks/useRotoNavigationCoordinator.ts`: 109 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2160 lines.

### Tests run
- Focused playback/navigation, Studio, and WorkflowStrip tests passed with 147 tests across 4 files.
- Typecheck passed.
- `git diff --check` passed.
- Source audit confirms `rotoKeyUtilitiesExternalRef` no longer exists.

### Next suggested slice
- Extract keyboard dispatch and final typed view-model construction into thin hooks.
- Then move the remaining concrete Roto persistence/display port implementations and apply/close composition into focused integration controllers until Studio reaches the target.

## 2026-07-11 — Cluster: extract keyboard and view model

### Selected cluster
- Ownership moved: keyboard command dispatch, shortcut target filtering, adjacent saved-frame selection, keyboard callback adaptation, and final typed Studio view-prop construction.
- From: the final interaction and prop-construction blocks in `PhysicsPaintStudio.tsx`.
- To: `view/physicsPaintStudioKeyboard.ts`, `hooks/usePhysicsPaintStudioKeyboard.ts`, and `hooks/usePhysicsPaintStudioViewModel.ts`.
- The presentational view moved into `view/PhysicsPaintStudioView.tsx` as its ownership was touched.

### Why this is safe
- Shortcut precedence, preventDefault behavior, Play/Roto dispatch, saved-key navigation, and editable-target guards are preserved in a pure dispatcher with focused tests.
- The keyboard hook is a 20-line callback adapter; the view-model hook is an 11-line typed identity boundary with no business state.
- The presentational view remains unchanged apart from its path.
- No Roto workflow effect was added.

### Ownership removed from Studio
- Removed the full keydown branching implementation.
- Removed inline grouped `PhysicsPaintStudioViewProps` construction.
- Studio now calls the keyboard and view-model boundaries and returns one presentational view.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts`
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts`
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1044 lines.
- `PhysicsPaintStudio.tsx` after: 977 lines.
- Cluster delta: -67 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2227 lines.

### Tests run
- Focused keyboard, Studio, and WorkflowStrip tests passed with 146 tests across 3 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract the remaining concrete Roto persistence/display port implementations, apply-result/close lifecycle composition, and launch/bridge integration into bounded controllers.
- Finish with a composition-only Studio audit and full Physics Paint matrix.

## 2026-07-11 — Cluster: extract Roto editing and persistence integration

### Selected cluster
- Ownership moved: Roto undo/dirty/edit/clear/snapshot actions, external cached-reference synchronization, save-controller composition, close lifecycle, synchronized frame opening, key cache/store/bridge persistence, engine restore, and navigation port configuration.
- From: concrete Roto integration blocks in `PhysicsPaintStudio.tsx`.
- To: `hooks/useRotoFrameEditingController.ts` and `hooks/useRotoPersistenceIntegration.ts`.

### Why this is safe
- Normal navigation and post-save opening remain distinct: only normal navigation snapshots and respects active save/apply blocking.
- Save-on-leave, queued destinations, real-key replacement, cached repaint alpha merging, source restoration, close choices, and bridge messages preserve their existing paths.
- The only moved effect is the existing external engine/reference synchronization effect; no internal Roto repair effect was added.
- New controllers are bounded at 136 and 254 lines.

### Ownership removed from Studio
- Removed Studio-local Roto edit actions and snapshot rendering.
- Removed direct save and close controller configuration.
- Removed synchronized frame opening, key persistence, restore, and navigation-port implementations.
- Studio retains top-level coordinator composition and apply-result/interpolation wiring.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts`
- `app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 977 lines.
- `PhysicsPaintStudio.tsx` after: 766 lines.
- Cluster delta: -211 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2438 lines.

### Tests run
- Directly verified focused Roto, Studio, and WorkflowStrip tests passed with 161 tests across 6 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract launch/apply-result lifecycle integration and cross-workflow session/conversion composition into bounded hooks.
- Run the full Physics Paint matrix and finish the composition-only Studio audit at 400–540 lines.
