---
phase: 64-medium-engine
reviewed: 2026-11-22T16:41:17Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/engine/aquarelleSheetSignature.test.ts
  - app/src/components/physic-paint/engine/aquarelleSheetSignature.ts
  - app/src/components/physic-paint/engine/committedFrameRelight.test.ts
  - app/src/components/physic-paint/engine/committedFrameRelight.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/lastTouch.test.ts
  - packages/efx-watercolor/src/playground/lastTouchCarry.test.ts
  - packages/efx-watercolor/src/playground/lastTouchCarry.ts
  - packages/efx-watercolor/src/playground/lastTouchClock.test.ts
  - packages/efx-watercolor/src/playground/lastTouchClock.ts
  - packages/efx-watercolor/src/playground/liveSeed.test.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
  necessity: 0
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-11-22T16:41:17Z
**Depth:** deep
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Adversarial deep review of the 64-25..64-28 gap-closure change set (diff base `386af367`): the CR-04 coverage-composite read, the CR-03 last-touch ping-pong carry, the WR-03 ages↔stamps clock-boundary law, the WR-04 parked relight gate, and the IN-05 canonical sheet-cache digest / IN-07 derived pickup floor.

The four substantive fixes are sound. The coverage composite was verified by hand against the LUT law (cover 0 → base 128; cover 128 → exponent 0.498 → 182; cover 255 → sheet; blue 64; derived alphas 127/159/191), and `exportCoverageCanvas` writes cover into RGB *and* alpha (and flips rows like every other export), so the direct red read, and the transparent-scratch fallback, are both correct and orientation-consistent with the sheet scratch. The carry invariant was proved by induction over dab sequences, including empty clamped rects, `clearLastTouch`, resize and `uploadWhole`; `restoreSheet`/`captureSheet` are now correctly pass-through and only the two whole-document boundaries convert; the shader's `uAmount` removal is complete (declaration, upload and parameter). The digest is injective-framed, key-order independent, cycle-total, and both the provider (`getAquarelleEventsForFrame`) and each call site are deterministic, so capture/restore digests agree. The IN-07 floor is exactly `|50.64 − 250.16| / 2 = 99.76`, matching the committed baseline.

Two WARNINGs remain: the WR-04 park guarantee has a deterministic same-frame gap where a light change is still dropped instead of parked, and the CR-04 coverage read's dimension guard is vacuous (it checks the returned `ImageData`, which the spec pins to the requested size, not the source raster), so a differently-sized coverage raster is silently cropped instead of scaled. Three INFO items cover a doc/table-size error, an un-restorable sheet-cache entry class, and a whole-target carry site that does not invalidate.

Verification: every scoped suite executed and passed — app `physicsPaintRotoAlphaMerge` (18), `committedFrameRelight` (10), `aquarelleSheetSignature` (10), `aquarelleLayerContract` (26), `PhysicsPaintStudio` (446), plus adjacent `aquarelleCoverSeamContract` (18) and `physicsPaintRotoPlayScriptRenderer` (9); package `lastTouchCarry` (7), `lastTouchClock` (4), `scattering` (64), `lastTouch` (26), `liveSeed` (15); probe `harness` (53).

## Warnings

### WR-01: 64-27 — a relight request in the frame between playback start and the gate-effect flush is dropped, not parked

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2965-2971` and `app/src/components/physic-paint/engine/committedFrameRelight.ts:100-104`
**Issue:** The scheduler only learns about playback through the passive `useEffect` gate (`setBlocked` runs after the commit), while the runner's own guard (`isPlayingRef.current`, set in the render body at `PhysicsPaintStudio.tsx:2932-2933`) is already live. A request that lands after the playing render commits but before the passive effect flushes calls `request()` with `blocked === false`, so the scheduler starts a run; the runner returns `false`; the automatic follow-up immediately calls `start()` again (its blocked check is still stale, and the second run's `false` resolves in a microtask, before any passive effect can run) and returns `false` again; `followUpUsed` is now true, so the burst stops and `pending` is never set. When the gate finally calls `setBlocked(true)` with `pending === false`, the blocked-to-idle edge has nothing to drain: the light change is neither retried nor parked, and the committed frame keeps the pre-change shading until some later request (an undo/redo light diff or another gesture) happens to re-request. This is exactly the 64-27 contract ("a relight refused during playback/Draft/wireframe must be parked and run exactly once when the block clears") failing in a window that is deterministic once a request lands in it, not merely a theoretical race.
**Fix:** Give the scheduler the same live predicate the runner uses and consult it synchronously in `start()`, so a run can never be launched into an externally blocked state and the follow-up budget is never spent on an external refusal:

```ts
export function createSingleFlightRelight(
  run: () => Promise<boolean>,
  isBlocked: () => boolean = () => false,
): SingleFlightRelight {
  // ...
  const start = (): void => {
    if (isBlocked() || blocked) {   // live predicate closes the effect-flush window
      pending = true;
      return;
    }
    // ... unchanged
```

and in the Studio: `createSingleFlightRelight(runner, () => isPlayingRef.current || draftMode.peek() || wireframeMode.peek())`. Keep `setBlocked` as the drain trigger (the idle edge still has to fire), but let `start()`/`request()` consult `isBlocked()` so a refusal caused by an external block parks instead of spending the one automatic follow-up.

### WR-02: 64-25 — the coverage read's dimension guard is vacuous; a mis-sized coverage raster is silently cropped instead of scaled

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts:149-160` (guard at `:155-156`)
**Issue:** `own.getImageData(0, 0, size.width, size.height)` returns an `ImageData` of exactly `size.width × size.height` by specification — pixels outside the source canvas are transparent black — so `direct.width === size.width && direct.height === size.height` can never be false. The intended guard (the raster is the right size) therefore never fires, and the two paths disagree about sizing: the transparent-scratch fallback draws with `ctx.drawImage(source, 0, 0, size.width, size.height)` (scales), while the direct path takes an unscaled top-left crop. If the coverage canvas dimensions ever differ from `size` (e.g., an engine mid-resize while the Studio's `canvasWidth`/`canvasHeight` already updated, `PhysicsPaintStudio.tsx:10143` vs `:10338-10339`), the exponent is sampled from misaligned source pixels while the sheet and base are scaled — a silently wrong composite rather than the fail-open the comment promises. A smaller stale raster instead pads with transparent black (cover 0 → base kept), which is conservative but still inconsistent with the scaled fallback.
**Fix:** Compare the source's own dimensions, not the returned object's, and let the scaling fallback handle a mismatch:

```ts
const own = typeof source.getContext === 'function' ? source.getContext('2d', { willReadFrequently: true }) : null;
if (
  own && typeof own.getImageData === 'function'
  && source.width === size.width && source.height === size.height
) {
  return own.getImageData(0, 0, size.width, size.height);
}
```

## Info

### IN-01: the `pow` LUT size claim is wrong by 4× (64 KiB vs 256 KiB)

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts:46-48` (table at `:61`)
**Issue:** The doc comment says "`pow` is a 64 KiB Float32 table"; `new Float32Array(256 * 256)` is 65,536 entries × 4 bytes = 262,144 bytes = 256 KiB.
**Fix:** Say 256 KiB (or "a 256 KiB Float32 table").

### IN-02: `rememberSheet` can park a sheet that `restoreCachedSheet` can never take (empty event list)

**File:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1140-1141`, `:1163-1167` (guard at `:908`)
**Issue:** `restoreCachedSheet` refuses an empty event list before `takeSheet` (`:908`), so a sheet remembered for a frame whose recorded event list is empty can never be consumed. Unlike a signature mismatch (`:891-894`, which deletes the entry), it is never invalidated: it occupies one of the three cache slots (and up to half the 256 MiB budget) until natural eviction, and can push out a sheet that a later frame would actually restore. `adoptSheet` and the frame-leave path both call `rememberSheet` with any non-null list.
**Fix:** Mirror the restore guard at the write sites: `if (leavingEvents && leavingEvents.length > 0) rememberSheet(...)` (same in `adoptSheet`).

### IN-03: `travel()` is a whole-target last-touch write that does not invalidate the carry

**File:** `packages/efx-watercolor/src/playground/Engine.ts:2090-2134` (comment at `:3588`; module doc `lastTouchCarry.ts:17-21`)
**Issue:** The carry module and the `bristleTouch` doc both state that whole-target writes invalidate the pending rect, and the clear / resize / `uploadWhole` sites do. `travel()` is also a whole-target write of the pair (the atlas blit writes both halves, `history.ts:190-192` with the pair supplied at `Engine.ts:2107-2108`) but leaves the carried rect live. It is harmless today — after the swap both halves hold identical saved texels, so the pending-rect blit is a no-op — but the stated invariant is not upheld at this site, and any future whole-target write that does not write both halves identically would silently reintroduce the rollback inside the pending rect.
**Fix:** Add `invalidateCarry(this.touchCarry);` after `if (!res) return;` in `travel()` (`Engine.ts:2111-2112`) so the invariant is exhaustive and cheap to check, or amend the doc to name `travel` and explain why the carry is harmless there.

---

_Reviewed: 2026-11-22T16:41:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
