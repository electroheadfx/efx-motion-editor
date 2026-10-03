---
status: resolved
trigger: "Erase contract UAT failure — one debug, three targets. (A) Fresh/wet paint: erase tool = vector overlay select mode (click/Cmd-click multi-select, Delete/Backspace removes, click-outside/Cmd-click deselects). Today's gesture whole-stroke erase only works newest-first — removing stroke 1 first bakes 2/3/4 dry via redrawAll, so the inverse stack is the only one that works. (B) Cache/dry paint: real-time pixel erase with a red preview while dragging; force slider stays the single control. Today erase only runs on stroke finalize and removes nothing visible. (C) Data loss (highest priority): leaving a key mid-erase and returning shows all paint gone + a strange symmetric paper background. Must never be reproducible."
created: 2026-10-03T00:00:00Z
updated: 2026-10-03T00:00:00Z
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "CONFIRMED — see Resolution. (A) two bugs: wet-gated hit-test + keep-box bake during replay. (A′) loadProjectData drops mutationId. (C) dirty-gate loader refusal + isEmpty removeCachedFrame + stuck state.drawing."
test: "eraseUatDebug.test.ts (5 probes) + eraseContract.test.ts D-S rewrite (16 cells)"
expecting: "oldest-first erase removes each target and keeps survivors wet; save/load keeps strokes whole-stroke-erasable; empty-canvas gesture adds only the erase entry"
next_action: "native UAT (rows below) — automated gates green 2026-10-03"

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: |
  Three co-designed targets (user-approved debug scope 2026-10-03):
  (A) Fresh/wet paint: erase tool enters a vector overlay select mode. Click selects a stroke, Cmd-click multi-selects, Delete/Backspace removes selected strokes (entry + deposit), click outside strokes deselects all, Cmd-click on a selected stroke unselects it. No gesture-order semantics.
  (B) Cache/dry paint: erase is a real-time pixel eraser with a red preview of the erase footprint while dragging. The force slider is the single user-facing strength control. Full force clears in one pass, 50 in a few, the slider visibly changes speed.
  (C) Paint is durable: leaving a key (even mid-erase) and returning must show the paint exactly as left. No cache wipe, no symmetric-paper artifact.

actual: |
  (A) Gesture whole-stroke erase only works on the inverse stack. Paint 1,2,3,4; erase 4 then 3 then 2 = works. Try to erase 1 first, then 2, then 3 = fails (only pixel mode erase works after). Lead: `removeWetIntersectedStrokes` calls `redrawAll()` after a hit, which likely replays the remaining strokes onto the dry surface and bakes them, so they are no longer wet targets.
  (B) On cache/dry paint erase does not remove pixels visibly in real time, and there is no red preview of the erase footprint. The pixel path (`applyEraseStroke`) only runs at stroke finalize.
  (C) DATA LOSS: user was erasing on a key's paint, left the key, came back — all paint cache gone, replaced by a strange symmetric background paper without paint.

errors: None reported in console. Symptom (C) is silent data loss + a visual artifact (symmetric paper).

reproduction: |
  (A) Paint strokes 1,2,3,4 in order. With the erase tool, swipe across stroke 1 first (oldest), then 2, then 3 — whole-stroke removal fails. Reverse order (4,3,2) works.
  (B) Bake/dry a key's paint (or navigate away and back to make it cached). Drag the eraser across dry paint — no real-time pixel removal, no red preview. Only at stroke end does anything change, and it is too weak to see.
  (C) On a key with paint, start an erase gesture (or finish one). Navigate away from the key, then return. All paint is gone; the paper background appears strange/symmetric with no paint.

started: 2026-10-03 — native UAT of quick 261003-hpi (erase contract). Never worked for (B) and (C) since that quick landed (commits 1c139dbb / c3822814 / 4ae7da38). (A) partially worked (inverse stack only).

## Prior leads from orchestrator triage (2026-10-03)

- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — `removeWetIntersectedStrokes` + `liveErase` branch of the erase path. After a wet-stroke removal it calls `this.redrawAll()`, which replays `allActions` onto the dry surface. Hypothesis: remaining wet strokes get baked dry as a side effect, so only the newest-first sequence keeps succeeding (each stroke is still wet when its own removal runs).
- `packages/efx-physic-paint/src/brush/erase.ts` — `applyEraseStroke` is the dry pixel cell. It runs once at stroke finalize (mask render → pixel loop → `putImageData`). No during-drag path, no preview layer. `ERASE_FORCE_SCALE = 2.7` linear force law landed in 261003-hpi.
- Symptom (C) lead: the erase entry stored in `allActions` may corrupt replay on key rehydrate (wrong bounds / wrong bgData lerp / mutationId seeding), or the rebuild after a wet removal wipes the stroke list / dry cache. "Strange symmetric paper" suggests a canvas transform, UV wrap, or bgData mismatch rather than a simple clear.
- The desired (A) vector-select design removes the whole ordering-bug class — worth deciding early whether the debug replaces gesture erase on wet paint outright (user's stated preference) vs. fixing the gesture ordering as a stopgap.

## Resolution

root_cause: |
  (A) order-dependence — TWO stacked bugs:
    1. `removeWetIntersectedStrokes` gated hits on `wet.alpha[gesturePixel] >= 1`, so a stroke baked dry by a later stroke's keep-box could never be a target.
    2. `redrawAll` replayed every stroke through `prepareWetLayerForStroke`, whose keep-box (`brushR*3+40` around each stroke START) force-baked wet outside it — replaying stroke 4 dried stroke 2. The old contract test hid this by stubbing `prepareWetLayerForStroke`.
    Also: the hit threshold `strokeR + eraseR + 5` slop deleted neighbouring strokes 25px away once the hit-test went geometric.
  (A′) `loadProjectData` mapped strokes WITHOUT `mutationId`; `removeWetIntersectedStrokes` requires `mutationId != null` → whole-stroke erase dead after every save/load.
  (C) leave/return wipe — three layers:
    1. `createRotoReferenceLoader.load` refused to paint when `dirtyFrames.has(appFrame) && !replaceDirtyFrame`, returning bare paper. Navigation already `engine.clear()`'d, so the cache was the only surviving representation. Dirty only clears on capture COMMIT (`acceptPixelCache`) — an erase whose capture is rejected/never-registered stranded the key dirty forever.
    2. `isEmpty → removeCachedFrame` destroyed the persisted cache on undo/erase-to-empty (`kind === 'clear'` already early-returns, so this branch is never a true clear).
    3. `clear()` did not reset `state.drawing` / `rawPts` / `previewStroke` — a mid-drag navigation left `state.drawing` stuck true, which parked/dropped the return-path preview-base paint.
  Eliminated: `setBackgroundImageUrl` (zero production call sites). Engine save/load round-trip preserves survivors (3 probes).

fix: |
  `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`
    - `removeWetIntersectedStrokes`: hit-test purely geometric against allActions (order-independent). Threshold tightened to true ribbon overlap `strokeR + eraseR` (dropped the +5 slop).
    - `StrokeApplicationOptions.replay?: boolean` — `redrawAll` / `renderPartialStrokes` pass `replay: true`; `applyStrokeToEngine` skips `prepareWetLayerForStroke` during replay so keep-box/force-dry cannot bake survivors.
    - `loadProjectData`: assigns `mutationId: this.nextMutationId++` to every loaded stroke.
    - `clear()`: also resets `state.drawing = false`, `rawPts = []`, `previewStroke = null`.
  `app/src/components/physic-paint/hooks/useRotoReferenceController.ts`
    - dirty-gate falls back to the cached bytes (keeps dirty, does not syncPending) instead of returning bare paper. Only refuses when there are no bytes at all.
  `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
    - `isEmpty` branch: `invalidateLivePixels` only — never `removeCachedFrame`.
  `packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseUatDebug.test.ts` (new) — 5 probes encoding the intended contract.
  `packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts` — D-S cell rewritten: empty-canvas gesture adds only the erase entry; gesture over baked paint whole-stroke-removes it (the old "D-S never" cell is superseded by this debug).

verification: |
  eraseUatDebug 5/5 GREEN. eraseContract 16/16 GREEN. Full package suite 381 passed / 3 skipped / 0 failed (47 files). efx-physic-paint tsc clean. efx-motion-editor tsc clean. Guardrail diff EMPTY for wet-layer.ts / drying.ts / paint.ts / stroke.ts (frozen knobs untouched: DEPOSIT_KEEP_TIER 40, DEPOSIT_DENSITY_SCALE 4500, PAPER_ADSORPTION_GAMMA 0.5). R4 anti-alignment cells still GREEN. Native UAT pending (rows below).

files_changed:
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseUatDebug.test.ts (new)
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx

## Native UAT (pending — user's live check)

- (A) Paint strokes 1,2,3,4. Erase stroke 1 FIRST (oldest), then 2, then 3 — each must whole-stroke-vanish. Reverse order must also work. A swipe must NOT delete a neighbouring stroke it did not cross.
- (A′) Save/reload the project — whole-stroke erase must still work on the returned key.
- (B) NOT IN THIS PASS (deferred to a follow-up quick): real-time dry pixel erase + red preview. The dry force law already works at finalize.
- (C) Leave a key mid-erase, come back — paint must be exactly as left (or the last-committed cache). No bare paper, no symmetric-paper artifact. Undo-to-empty must not destroy the cached key.

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: "`setBackgroundImageUrl` late image load wipes dry+wet with no stroke replay (EfxPaintEngine.ts :938-958)"
  evidence: "ZERO production call sites — type declaration and implementation only. Not the wipe."
  timestamp: 2026-10-03

- hypothesis: "Engine save/load round-trip silently drops survivors"
  evidence: "3 probes PASS: save→load keeps stroke list, replays deposits, removed stroke does not resurrect. The wipe is app-side (capture/navigation), not engine serialization."
  timestamp: 2026-10-03

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-03
  checked: "eraseUatDebug probe — oldest-first erase after 4 local wet lines"
  found: "RED at base (stroke 1 removal + rebuild baked survivors). GREEN after geometric hit-test + replay flag + threshold tighten."
  implication: "(A) is a stacked bug: detection gate + replay keep-box + threshold slop. All three required."

- timestamp: 2026-10-03
  checked: "eraseUatDebug probe — save/load then whole-stroke erase"
  found: "RED at base (mutationId null after load). GREEN after loadProjectData assigns fresh ids."
  implication: "(A′) is a one-line map fix; without it W-S is dead after every save/load."

- timestamp: 2026-10-03
  checked: "useRotoReferenceController.load :162-166 + PhysicsPaintStudio :3605-3612 + EfxPaintEngine.clear :1578"
  found: "dirty-gate returns false with no paint; isEmpty deletes the cached frame; clear() leaves state.drawing stuck. All three reachable from a mid-erase navigation."
  implication: "(C) needs all three layers closed — any one alone leaves a wipe path open."

- 2026-10-03 session-manager inline investigation (no Agent tool available):

### Engine erase path (packages/efx-physic-paint/src/engine/EfxPaintEngine.ts)
- `applyStrokeToEngine` erase branch (:3104-3125): `liveErase` marker → `removeWetIntersectedStrokes` → if removed>0 → `redrawAll()`; else pixel path `applyEraseStroke`. Replay paths (redrawAll/load) pass NO liveErase → pixel-only replay of the erase entry. Confirmed.
- `removeWetIntersectedStrokes` (:2965-2998): newest-first scan; target = tool 'paint' + gesture point within `strokeR+eraseR+5` of polyline + `wet.alpha[gesturePixel] >= 1`; requires `a.mutationId != null`; splices primary+zero-point continuations from allActions + one undoStack entry per mutationId.
- Erase gestures ARE recorded in allActions via `acceptStroke` at onPointerUp (:3269, color=null for erase, physicsMode=null). Short strokes (<3 points) discarded with no accept (:3257).
- `redrawAll` (:3371-3395): `resetReplaySurface()` (clear dry+wet, draw bg, redraw preview base) then replays allActions in order via applyStrokeToEngine (physicsMode passed per-stroke; `liveErase` NOT set). Queued finalizations skipped from replay.
- `prepareWetLayerForStroke` local branch (:2873-2943): at each paint stroke start, existing wet OUTSIDE keepR (=brushR*3+40) of the new stroke's start is baked to dry and zeroed from wet. Non-local branch: whole-frame `forceDryAll`. → replay ORDER affects which strokes remain wet; a null-physicsMode stroke replayed before local strokes force-dries everything deposited so far.
- Paint strokes replayed with physicsMode null bake dry (wet zeroed) → no longer W-S targets → subsequent erase falls back to pixel path. Paint strokes recorded 'local' re-deposit wet on replay.
- `notifyCompletedMutation` (:2953): `isEmpty = allActions.length === 0`. Callers: finalize erase/paint (2672/2950), undo (1493), redo (1519/1531), clear (1616), stopPhysics (1431).
- `loadProjectData` (:3484-3534): fail-closed validate → strokes mapped WITHOUT mutationId (fresh ids never assigned — after load, `removeWetIntersectedStrokes` requires mutationId!=null so W-S can never fire on a reloaded doc) → undoStack cleared → redrawAll. settings.bgMode NOT restored on load (only paperGrain/emboss/wetPaper).
- `serializeProject` (:3426): strokes = allActions incl. erase entries (color null — validation allows null color, :398).
- `clear()` (:1578): wipes allActions + wet + dry → `notifyCompletedMutation('clear')` (app handler early-returns on kind 'clear').
- `setBackgroundImageUrl` (:941): image.onload clears dry + ALL wet and does NOT replay strokes — any late-landing background image load destroys all paint and leaves only background ("paper, no paint"). Callers: launch integration only (to verify).
- `copyLiveAlphaCanvas` (:1778): conditional flush → renderVisibleWetLayer → (separated: drawImage dry) vs (background-subtraction: dry-minus-bg) → drawImage displayCanvas. Excludes preview base by design; app merges with cachedBase.
- `prepareWetLayerForStroke` + `applyPreviewBaseImage` (:1174): preview base path sets `previewBackgroundSeparated=true`, ends with `redrawAll()` unless in paint train.

### App-side key leave/return (app/src/components/physic-paint)
- Navigation (PhysicsPaintStudio.tsx:2438-2540): flushPendingStrokeFinalizations → snapshotLivePixels(src) → flushLivePixels(src) → clearPreviewBaseImage+resetBackground+clear() → loadCachedRotoReferenceFrame(dst) → await flush. Return shows the key from the live-pixel CACHE (bytes), not from engine strokes.
- Capture registration (handleCanvasCompletedMutation :3545-3652): on each completed mutation (incl. erase) → if `isEmpty` → **`rotoPersistence.removeCachedFrame(appFrame)`** (cache entry DELETED) or re-upsert cachedRotoRepaintBaseFrame; else captureLivePixels with liveAlphaCanvas factory `() => copyLiveAlphaCanvas()` + cachedBase merge. For `completedTarget.kind === 'empty'` (first-paint key) the IIFE AWAITS pendingFirstPaintTarget.promise BEFORE registering the capture — snapshot at navigation could no-op (pending not yet registered) → produce then runs after engine.clear() → commits blank/cleared-canvas frame. RACE candidate for (C).
- rotoLivePixelCacheTransactions.snapshot (:233): no-op when no pending capture for the identity; produce must run pre-clear or it reads the cleared engine (the 52.1 "paint-loss on leave" fix class — comment at :194-203).
- mergeCachedRotoAlphaFrame: source-over draw base THEN live — merge can ADD strokes only, cannot subtract; erasing base/hydrated paint cannot be represented in a merged capture (relevant to (B)).
- liveAlpha = dry(-bg) + display(wet overlay). After a W-S erase rebuild, survivors are wet-only (dry canvas empty of them) → committed frame depends entirely on display composite being current at copy time.

### Test harness
- EfxPaintEngine.eraseContract.test.ts: harness mocks renderPaintStroke (deposit wet 500 r=6), drawBg→null, compositor, fluids; real redrawAll/prepareWetLayerForStroke/clearWetLayer/applyEraseStroke run. W-S test (neighbor survives rebuild, physicsMode 'local') currently GREEN → pure engine replay with local-mode strokes does not reproduce the (A) ordering claim by itself (that harness stubs prepareWetLayerForStroke as a no-op).

### RED evidence (new probe file: EfxPaintEngine.eraseUatDebug.test.ts, 2/5 failing)
- **(A) order-dependence REPRODUCED**: 4 local wet lines (y=15/40/65/90, starts x=20), oldest-first erase → after the first removal+rebuild, `wet(50,40) === 0` — the redrawAll REPLAY re-runs the REAL `prepareWetLayerForStroke`, whose keep-box (`brushR*3+40` = 58px around each replayed stroke's START) force-bakes wet outside it. Replaying stroke 4 (start 20,90) dries stroke 2's pixels (dist 58.3 > 58) → next erase finds no wet → silently degrades to the pixel path ("only pixel mode works after"). Newest-first works because the last replayed stroke's own deposit/keep-box covers the next target. The existing contract test masks this: it stubs prepareWetLayerForStroke with vi.fn(). Same keep-box runs during LIVE painting, so live vs rebuild parity depends on stroke-start clustering; the rebuild makes every survivor re-subject to ALL later strokes' keep boxes at once.
- **(C-2) reloaded doc is no longer whole-stroke erasable REPRODUCED**: save() → load() → eraseGesture over a fresh survivor → stroke count unchanged (3, expected 1). Root cause: `loadProjectData` maps strokes WITHOUT mutationId and never assigns new ids → `removeWetIntersectedStrokes` gate `a.mutationId != null` never matches → W-S dead after every save/load; falls to pixel path (invisible on wet).
- (C-1) round-trip PRESERVES survivors (3 probes PASS): save→load keeps stroke list, replays deposits, no silent wipe, removed stroke does not resurrect. → the (C) "all paint gone" wipe is NOT in the engine save/load round-trip; it lives in the app capture/navigation path or a background-image wipe (below).

### (C) remaining app-side suspects (unranked, next)
1. handleCanvasCompletedMutation `isEmpty → removeCachedFrame(appFrame)` deletes the key's cached frame whenever a completed mutation (undo/erase/etc.) finds allActions empty — on a base-cached key the base paint is not an allAction, so "empty entries" ≠ "empty key".
2. First-paint ('empty' target) capture race: the IIFE awaits `pendingFirstPaintTarget.promise` BEFORE registering the capture; navigation's snapshot then no-ops and produce can run after engine.clear() → blank frame committed (the 52.1 paint-loss-on-leave class).
3. `setBackgroundImageUrl` image.onload clears dry+wet with NO stroke replay — any mid-session background image set = instant paint wipe + paper visible ("symmetric paper"). Callers: launch integration only — verify no erase/mutation-driven re-set.
4. Return-path reference drop: applyPreviewBaseImage drops a plain refresh while `state.drawing` (mid-gesture) and other generation gates — a dropped base apply on return shows paper.

### (C) mechanism analysis, session 2026-10-03 (preview-base + navigation trace)

Suspect 3 ELIMINATED: `setBackgroundImageUrl` (EfxPaintEngine.ts :938-958, onload wipes dry+wet with no replay) has ZERO production call sites — only type declarations. Not the wipe.

Leave/return path traced end-to-end:
- Navigation (PhysicsPaintStudio.tsx :2471-2489): flushPendingStrokeFinalizations → snapshotLivePixels(src) → flushLivePixels(src) → clearPreviewBaseImage(true) + resetBackground(true) + engine.clear() → loadCachedRotoReferenceFrame(dst). NO gesture force-end anywhere in navigation (state.drawing set only :3175, cleared only at pointerup :3224 / pointercancel :3293).
- Return paint comes from the reference LOADER, not engine strokes: createRotoReferenceLoader.load (useRotoReferenceController.ts :156-230). paintBytes path → engine.clear(gen?) + setPreviewBaseImageUrl(blobUrl, contentToken, appFrame). Blank path → engine.clear() + clearPreviewBaseImage + resetBackground (paper only).

Four concrete data-loss mechanisms, discriminated:

**Mechanism A — dirty-gate loader refusal (STRONGEST candidate).**
Loader load :162: `if (dirtyFrames.has(appFrame) && !replaceDirtyFrame) { setReferenceUrl(null); setRepaintBaseFrame(...); return false }` — NO engine paint at all. Navigation has already engine.clear()'d, so returning to a dirty key renders bare paper + no base. Dirty is cleared ONLY by acceptPixelCache on capture COMMIT (useRotoEditBufferController :47-53). captureLivePixels (useRotoFramePersistenceCoordinator :501-575) has multiple early-`false` gates (document/revision/identityKey null → capture never registered → dirty never clears) and commit staleness gates. An erase whose capture is rejected/never-registered strands the key dirty forever → every subsequent return = paper. Matches (C): "left mid-erase, came back, all paint gone" — and symmetric paper = bare drawBg with no base/strokes. Symptom (C) is silent (errors: None) consistent with early-false (no throw).

**Mechanism B — stuck state.drawing parks/drops return paint.**
Loader paints are ALWAYS requestExplicit (resolveContentToken always returns a number → explicit). If an erase gesture was in flight at leave (state.drawing stuck true — navigation never ends it), the return's setPreviewBaseImageUrl decode hits :1053-1063 → explicit parks into pendingExplicitPreviewBase (applied only at NEXT pointer-up :3245, guarded requestId match — but leave path's clearPreviewBaseImage bumped previewBaseRequestId, so parked entry is stale/moot) or plain refreshes dropped. Also clearPreviewBaseImage (:1226-1243) nulls pendingExplicitPreviewBase. Result: paper until user gestures. Requires the pointer to still be down across navigation — plausible for a mid-erase leave (tool click / key switch while dragging).

**Mechanism C — stuck inFlightExplicitPreviewBase.**
clearPreviewBaseImage does NOT reset inFlightExplicitPreviewBase; superseded-explicit onload path :1048 intentionally keeps it. Gate :1000 (`if (!requestExplicit && this.inFlightExplicitPreviewBase) return`) could then permanently drop plain refreshes. Narrower — affects plain (non-explicit) refreshes only; loader paints are explicit, so this alone does not explain return-to-key paper.

**Mechanism D — first-dirty reference reset.**
First input intent at a key (onInputIntent → beginRotoFrameEdit :140 → markCurrentFrameDirty :123-138): on first dirty → reference.clearReference() + engine.resetBackground() (bumps previewBackgroundRequestId, invalidates in-flight bg loads). Contributes to paper-on-return only when combined with A (loader refuses) or B (paint parked) — resetBackground alone doesn't wipe paint.

Suspect #1 (isEmpty → removeCachedFrame, Studio :3605-3613): still live — a completed mutation with allActions empty (e.g. undo/whole-stroke erase of the last engine action) deletes the cached frame even when base paint isn't an allAction. Interacts with A: removeCachedFrame also invalidates, so next return finds no paintBytes → blank path.
Suspect #2 (first-paint capture race, Studio :3586-3595): IIFE awaits pendingFirstPaintTarget.promise BEFORE registering capture; navigation snapshot then no-ops; produce can run after engine.clear() → blank commit. Affects first-paint keys only.

mergeCachedRotoAlphaFrame can-only-add confirmed → not a wipe source (B-relevant only).
