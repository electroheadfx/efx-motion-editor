---
phase: 64-medium-engine
reviewed: 2026-11-22T13:32:36Z
depth: standard
files_reviewed: 64
files_reviewed_list:
  - app/src-tauri/src/models/project.rs
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/committedFrameRelight.test.ts
  - app/src/components/physic-paint/engine/committedFrameRelight.ts
  - app/src/components/physic-paint/engine/documentLightGesture.test.ts
  - app/src/components/physic-paint/engine/documentLightGesture.ts
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/hooks/rotoReferenceOnlyTolerance.test.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
  - app/src/components/physic-paint/view/RightPanelPaperTab.tsx
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/lib/mceFieldContract.test.ts
  - app/src/lib/physicPaintBridge.launchPackBytes.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body0-1080.json
  - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-1080.json
  - packages/efx-watercolor/probe/medium-engine/baselines/bristle-body100-2048.json
  - packages/efx-watercolor/probe/medium-engine/baselines/bristle-edge-1080.json
  - packages/efx-watercolor/probe/medium-engine/baselines/bristle-round-body0-1080.json
  - packages/efx-watercolor/probe/medium-engine/baselines/bristle-wet-1080.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-advect.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-lift.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-textured.json
  - packages/efx-watercolor/probe/medium-engine/baselines/red-over-blue-50.json
  - packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/determinismContract.test.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/brushes.test.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/coverage.test.ts
  - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/gl.ts
  - packages/efx-watercolor/src/playground/kmBand.test.ts
  - packages/efx-watercolor/src/playground/lastTouch.test.ts
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/relief.test.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
findings:
  critical: 2
  warning: 2
  info: 4
  total: 8
  necessity: 0
status: issues_found
---

# Phase 64: Code Review Report (re-review)

**Reviewed:** 2026-11-22T13:32:36Z
**Depth:** standard
**Files Reviewed:** 64
**Status:** issues_found

## Summary

Re-review of the Phase 64 "Medium Engine" delta since `3641f46882ac` — plans 18-24: the light-gesture ledger, committed-frame relight, coverage/film coherence (coverage-composite capture merge), bristle gather/directional edges, the acrylic last-touch field (64-24 A/B), paper-seed replay, and KEY = CACHE sheet adoption. Standard depth over the 64-file scope; the earlier deep review's findings remain `open` in `64-REVIEW-DISPOSITION.md` and are not re-reported.

Two blockers. **CR-03**: the last-touch ping-pong never carries the field outside the current dab — `bristleTouch` draws a scissored pass into the write half and swaps, and the halves are independent textures, so every dab reverts everything the previous dab stamped. The documented "texels outside the dab rect keep their age untouched" law is false, the carrier/gather wetness inputs read a corrupted field, and `captureSheet`/`adoptSheet` persists the corruption into the live engine. **CR-04**: the new coverage-composite merge white-fills the coverage raster, but `exportCoverageCanvas()` encodes cover in the alpha channel — source-over white converts cover 0 into 255, inverting the merge law and erasing the committed base everywhere the new stroke did not paint (the unit test's no-op `drawImage` harness cannot see it).

Two warnings. **WR-03**: last-touch raw stamps are carried across a `timeBaseMs` reset by `resizeDocument` and the whole-doc undo/redo path; the shader clamps negative ages to 0, so carried stamps read as fully fresh. **WR-04**: a committed-frame relight refused while playing/draft/wireframe consumes its one follow-up and is never re-requested when the blocking state ends (`settle()` has no caller).

Four info items: a dead `uAmount` uniform in the touch shader, an under-specified sheet-cache signature, the now-dead `seedAquarelleEngine` path (KEY = CACHE replaced it), and a pickup probe invariant that cannot detect a collapsed dynamic range.

**Remediation confirmed in this delta (not re-reported):** the code answering CR-01 (light-change keying), CR-02 (one ledger entry per gesture) and WR-01 is present; WR-02's coverage-composite replacement is wired but carries CR-04 above.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-03: last-touch ping-pong corrupts the field outside the current dab

**File:** `packages/efx-watercolor/src/playground/Engine.ts:3561-3576` (with `packages/efx-watercolor/src/playground/gl.ts:120-127`)

**Issue:** `bristleTouch` is the only writer of the 64-24 last-touch field, and it writes only the current dab's scissored rect:

```ts
const rect = this.stampRect(x, y, r, this.dw, this.dh, 1.6);
t.bind();
gl.disable(gl.BLEND);
gl.uniform1i(t.u.uTimes!, g.bindTex(0, this.lastTouch.read.tex[0]!));
gl.uniform1i(t.u.uCover!, g.bindTex(1, this.cover.read.tex[0]!));
gl.uniform1f(t.u.uNow!, this.nowSec());
gl.uniform1f(t.u.uAmount!, amount);
g.draw(this.lastTouch.write, rect);
this.lastTouch.swap();
```

`DoubleTarget` halves are two independent textures created and cleared separately (`double()`), and `swap()` swaps the references only — nothing copies read into write. So every texel outside `rect` in the write half still holds the content from two stamps earlier: the previous dab's stamps are reverted (to the sentinel where that dab was the first touch, or to an older stamp where the texel was touched earlier). The field's memory is rolled back on every dab. The docstring at 3553-3560 ("Texels outside the dab rect keep their age untouched") is false.

Consequences:
- The carrier pass reads this field every dab (`Engine.ts:3336-3339`: `uTimes`/`uNow`/`uWetSeconds`) to decide `wetAt`/pickup/refill, and the gather binder reads it for smear (`3436-3437`). Those decisions see flickering, mostly-wrong ages — exactly the signal the 64-24 A/B acceptance is built on.
- `captureSheet()` converts the raw stamps to ages (`1046-1056`) and the app adopts the result into the LIVE engine (`AquarelleCanvasLayer.adoptSheet` → `engine.restoreSheet(sheet)`), so the corrupted field is persisted into the artist's live sheet, not confined to a bake.
- `lastTouch.test.ts` is a source-scan only (no WebGL), and no probe scenario stamps successive non-overlapping dabs — the defect is invisible to every gate.

**Fix:** preserve read→write before the scissored stamp:

```ts
// Engine.bristleTouch, before t.bind() / the scissored draw:
this.g.blit(this.lastTouch.read, this.lastTouch.write); // full-document carry
// ... existing scissored draw into lastTouch.write, then swap
```

(or copy at least the tracked union of dab rects stamped since the last capture, since `captureSheet` reads the full document). Add a gate that stamps two non-overlapping dabs and asserts the first dab's age survives the second.

### CR-04: coverage-composite white-fill inverts the merge law and wipes the committed base

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts:116-128` (with `:140-146`); raster source `packages/efx-watercolor/src/playground/Engine.ts:1548-1561`

**Issue:** `exportCoverageCanvas()` writes the coverage value into RGB **and alpha** (`img.data[i + 3] = Math.round(v * 255)`, Engine.ts:1561) — the coverage raster is transparent exactly where cover is 0. `scratchOf` fills the scratch canvas WHITE and then `drawImage`s the source, so the 2D compositor applies source-over: `observed = 255·(1 − c + c²)`.

- cover 0 → observed 255 → `cov = 255` → `pow = base^(1 − 255/255) = base^0` → the merge emits the SHEET pixel instead of the base. Every texel the new stroke did not paint has its committed base wiped to the sheet (white).
- cover 0.5 → observed ≈ 191 → exponent ≈ 0.25 instead of 0.5 — the blend is wrong across the whole partial-coverage band.

The intended law `t' = t_sheet × t_base^(1 − cover)` therefore never holds on the real WebKit compositor. The comment above `scratchOf` ("The sheet and the coverage are opaque rasters") is true for the sheet raster, false for the coverage raster — the white fill is only valid for the sheet.

The unit test cannot catch it: `physicsPaintRotoAlphaMerge.test.ts:198-275` uses a `PixelContext` whose `drawImage()` is a no-op and seeds `canvas.pixels` directly, so it asserts the intended arithmetic without ever modelling alpha-over-white.

Impact: every ordinary aquarelle capture whose cached base exists (`usedMerge = cachedBase || baseCanvas`, `useRotoFramePersistenceCoordinator.ts:753-755`, merged at `:755` with the coverage canvas forwarded at `:655`) commits a frame where the previous paint is erased outside the new stroke — a data-loss defect in the committed result.

**Fix:** do not route the coverage raster through a white-filled scratch. Read it directly (it has a 2D context), or draw it onto a TRANSPARENT scratch without the white fill, so red stays = cover:

```ts
const coverCanvas = (() => {
  if (!coverageCanvas) return null;
  const c = document.createElement('canvas');
  c.width = size.width; c.height = size.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // No white fill: the coverage raster carries cover in RGB and alpha.
  ctx.drawImage(coverageCanvas, 0, 0, size.width, size.height);
  return c;
})();
```

Add a regression that composites a real RGBA coverage raster (alpha = cover) and asserts cover 0 keeps the base.

## Warnings

### WR-03: last-touch raw stamps are carried across a time-base reset

**File:** `packages/efx-watercolor/src/playground/Engine.ts:777-786`, `:888`, `:915-934`, `:963-964`, `:2085`, `:2093`; consumer `packages/efx-watercolor/src/playground/shaders.ts:806`, `:1039`

**Issue:** last-touch stamps are stored in SECONDS relative to `timeBaseMs`. `clearLastTouch()` nulls the base (777-786), so the next `nowSec()` re-anchors to a fresh zero. Raw stamps are nevertheless carried across that reset:

- `resizeDocument`: after `allocateTargets()` (which calls `clearLastTouch()`), line 888 `copy(old.lastTouch, [read, write])` restores the pre-reset stamps under the re-anchored base.
- `captureWhole`/`uploadWhole` (915-934 / 937-966, used by `applyWhole` for boundary steps in `travel()` at 2093, and by `snapshot`/`restore`) round-trip raw stamps; a history tile captured before a clear/reset and applied after one re-bases them.
- The wetness gate clamps negative ages to 0 (`age = max(uNow - texture(uTimes, uv).r, 0.0)`, shaders.ts:806, also 1039), so a stamp from the old base reads as FULLY FRESH for up to the pre-reset session duration — the opposite of its true age.

`resizeDocument` has no app/probe caller today (latent, but it is public engine API reachable from the playground); the undo-of-clear path is app-reachable.

**Fix:** store last-touch inside WholeDoc as AGES (the `captureSheet`/`restoreSheet` representation), converting on capture and re-basing on upload, so every raw-stamp write is paired with the base it was written under; alternatively keep `timeBaseMs` monotonic in `clearLastTouch()` so carried stamps keep their meaning.

### WR-04: a committed-frame relight refused during playback/draft/wireframe is permanently dropped

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2933-2941`, `app/src/components/physic-paint/engine/committedFrameRelight.ts:58-84`

**Issue:** the relight runner returns false when `!launch`, while playing, in draft mode, or in wireframe (PhysicsPaintStudio.tsx:2937-2941). `createSingleFlightRelight` grants exactly one immediate follow-up for a `false` result (committedFrameRelight.ts:76-80); while the blocking state persists the follow-up also returns false and the budget is exhausted. Nothing re-requests when playback/draft/wireframe later ends — `settle()` exists (91-95) but has no caller anywhere. `syncBackgroundSettingsFromDocument` only runs from undo/redo (6549/6559/6568) and its first-call baseline (6495-6496) can swallow the request that an earlier refused relight left pending. Net: one light commit made during playback leaves the committed frame on the old light until an unrelated relight trigger.

**Fix:** re-request on the idle edge (invoke `settle()`/`request()` when isPlaying/draft/wireframe transitions to idle while the light signature still differs), or distinguish a refusal from "ran, no change" so a refusal does not consume the follow-up budget.

## Info

### IN-04: `uAmount` is a dead uniform in `bristleTouchFS`

**File:** `packages/efx-watercolor/src/playground/shaders.ts:1461-1469` (declared at 1465, unused in `main`); uploaded at `Engine.ts:3573`

**Issue:** the touch shader's weight is the accumulated cover; `uAmount` is declared and uploaded but never read (the 1455-1460 comment documents the deliberate cover-as-weight choice).
**Fix:** remove the uniform and its `uniform1f` upload, or use it to scale the mix and drop the misleading parameter.

### IN-05: `seedSignature` under-specifies the cached sheet's script identity

**File:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:868-878` (use sites 917, 1149, 1174)

**Issue:** the hash covers `events.length`, each event's `mutationId`, and `pts.length` only. Dry payloads, per-stroke parameters (tool/width/params) and appFrame/key-spacing remaps do not change the signature, so a changed script with equal stroke and point counts restores a stale cached sheet.
**Fix:** hash a canonical digest of the whole event list — ids plus the payload fields that affect the deposit plus key frames — not just counts.

### IN-06: dead seed path: `seedAquarelleEngine`, the adapter's injected engine/clock, and `yieldToHostMs`

**File:** `packages/efx-watercolor/src/bake/aquarelleSeed.ts:63`; `packages/efx-watercolor/src/bake/aquarelleBake.ts:230`, `:503`; `packages/efx-watercolor/src/adapter/engineAdapter.ts` (`engine`/`clock` options)

**Issue:** zero production callers — the only caller is `packages/efx-watercolor/src/playground/liveSeed.test.ts:201`/`:215`, and `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts:171-173` pins that KEY = CACHE replaced the seed. Dead code maintained as if shipped (Category: dead code).
**Fix:** delete `aquarelleSeed.ts` and the injected-engine/clock/`yieldToHostMs` seams, or justify them with a real caller; a test import plus a negative contract pin is not a use.

### IN-07: pickup probe invariant cannot detect a collapsed dynamic range

**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:577-620` (`PICKUP_MIN_DELTA = 1` at 588)

**Issue:** the recorded baseline gap is ~200 luma units (`bristle-wet-1080.json`: `pickupFreshMean` 50.64, `pickupAgedWetMean` 250.16), so a floor of 1 passes even if the pickup response has all but vanished (e.g. 49 vs 50).
**Fix:** assert a floor proportional to the baseline gap (e.g. at least 50% of the recorded delta) or an absolute floor such as 50.

---

_Reviewed: 2026-11-22T13:32:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
