---
phase: 60-studio-timeline-horizontal-zoom
reviewed: 2026-11-09T13:44:29Z
depth: deep
files_reviewed: 23
files_reviewed_list:
  - app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts
  - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts
  - app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts
  - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts
  - app/src/components/physic-paint/view/timelineRailDesign.ts
  - app/src/components/physic-paint/view/timelineZoomAuthorityAudit.test.ts
findings:
  critical: 2
  warning: 2
  info: 4
  total: 8
  necessity: 0
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-11-09T13:44:29Z
**Depth:** deep
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 60 introduces one session-only pitch authority (`physicsPaintTimelineZoom.ts`) and converts every horizontal consumer to it: the lane extent and cells grid, the adaptive ruler, the playhead, both rail families, the motion lanes, the track rows, the Bg filmstrip, the ruler scrub, the cross-track drag, and the Bg drag/resize projections. The pure authority math is sound when it is fed the committed layout: `resolveTimelineMetrics`, `resolveRulerStep`, the anchored-scroll law, the preset ladder (no rounding into presets, clamped no-ops at the ends), the exponential wheel factor, the fit scale, and the percentage readout all behave per the locked decisions, and the five `framePitch`/`frameGap` render sites are complete and consistently sourced from one render-body read. The mount reset/register/unregister pair, the RAF wheel coalescer, and its cancel-on-unmount are correct, and the two earlier fixed defects (no pitch² double-scaling in the cross-track drag; mount reset before port registration) verify.

The defects are at the DOM and CSS seams rather than in the math. Two are release-blocking: the current-frame marker still carries a fixed 16px width while its position scales (so it is wrong at every zoom level except 1x), and the anchored scroll write lands before Preact commits the new pitch, so the browser clamps zoom-in targets against the pre-zoom scrollable width and the cursor anchor is lost. Two warnings cover the mandatory CSS scroll-snap quantizing the fractional anchored offsets and the 6px content gutter being omitted from three pointer-to-frame projections. Four info items cover a playhead/ruler centring divergence, ruler tick overhang, a stale constant reference, and dead exported helpers.

Necessity: 0 findings. The `necessity-review.md` rubric was applied; every default/fallback left in the changed files (1x token defaults in helper signatures, the optional `frameGap` prop on the rails) serves test harnesses or external render callers rather than guarding an impossible state, and no dead production branch was provable.

## Critical Issues

### CR-01: Current-frame marker keeps a fixed 16px width while its position scales

**File:** `app/src/components/physic-paint/physicsPaintStudio.css:8147-8158` (rule), `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:6046-6053` (render)
**Issue:** The outline's `left` is computed from the live pitch (`style={{ left: `${(props.currentFrame - frameCells[0]!) * timelineMetrics.pitch}px` }}`), but the CSS rule still pins `width: 16px` (line 8151). The live cell width is `TIMELINE_GEOMETRY.cellWidth × scale`, i.e. 4px at 0.25x and 64px at 4x, so the marker is only correct at 1x. At 0.25x a 16px marker over a 4px cell spans roughly three and a half frames; at 4x it decorates a quarter of the current cell. The playhead and the ruler were both converted to live geometry, so the white current-frame marker is the one horizontal overlay left behind.
**Fix:** Consume the live cell width. The scroller already publishes it as `--timeline-cell-width` (`PhysicsPaintWorkflowStrip.tsx:6326` region), so the CSS-only change keeps 1x byte-identical:
```css
.physics-paint-current-frame-outline {
  position: absolute;
  top: 6px;
  box-sizing: border-box;
  width: var(--timeline-cell-width, 16px);
  height: 22px;
  /* ...unchanged... */
}
```
(The same variable resolves on the outline because it is rendered inside the scroller.) If you prefer explicitness, set `width: `${timelineMetrics.cellWidth}px`` inline beside the existing `left`.

### CR-02: Anchored zoom-in scroll is clamped against the pre-render layout, losing the cursor anchor

**File:** `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts:262-268` (`applyScale`), `:306-319` (`setScaleAtCursor`); port write at `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:2783-2786`
**Issue:** `applyScale` writes the scale signal and then immediately calls `scrollPort.setScrollLeft(target)` in the same synchronous task:
```ts
setScaleSignal(clamped);
if (target !== null && scrollPort) scrollPort.setScrollLeft(target);
```
Preact signal writes schedule the component re-render in a microtask (no `debounceRendering` override exists in `app/src`), so at the moment of the write the DOM still carries the OLD pitch: the rows' inline `gridTemplateColumns`, the lane `minWidth`, and the cells grid all describe the previous scale. The browser clamps `el.scrollLeft = target` to the stale `scrollWidth - clientWidth`. Any anchored target above the old maximum therefore lands short, and the re-render then widens the content without re-applying the target. This fires on every zoom-in whose anchor sits right of the scaled position: with a 1 → 1.5 pill step and the cursor near the right edge it always fires, and with a 1 → 4 step it fires for anything past roughly a quarter of the scroll range. Zoom-out (target smaller) is unaffected, which is why the failure is intermittent rather than constant. The store tests use a `makePort` stub whose setter records the value without clamping (`PhysicsPaintWorkflowStrip.zoomMatrix.test.ts:552-574`), so the defect is invisible to the suite.
**Fix:** Apply the scroll write after the new pitch is committed. Minimal form, ordered behind Preact's render microtask:
```ts
setScaleSignal(clamped);
if (target !== null && scrollPort) {
  queueMicrotask(() => scrollPort.setScrollLeft(target));
}
```
More robust: keep a module-level `pendingScrollLeft`, set it in `applyScale`, and consume it in the strip via a `useLayoutEffect` keyed on `timelineMetrics.pitch` (`useLayoutEffect` runs after DOM mutation and before paint, so the layout is guaranteed current and the write is not observable as a jump). Either way, add a test whose port clamps to `scrollWidth - clientWidth` so the regression is pinned.

## Warnings

### WR-01: Mandatory scroll-snap quantizes the anchored fractional scroll writes

**File:** `app/src/components/physic-paint/physicsPaintStudio.css:5111` (`scroll-snap-type: x mandatory`), `:5112` (`scroll-padding-left: 6px`), `:7916` (`scroll-snap-align: start`); anchored law at `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts:129-140`
**Issue:** `resolveAnchoredScrollLeft` deliberately produces an arbitrary fractional `scrollLeft` so the frame under the cursor keeps its on-screen x. The scroller, however, is a mandatory x snap container whose snap positions are the cell starts (every `.physics-paint-roto-cell` carries `scroll-snap-align: start`), and `scroll-padding-left: 6px` aligns those positions to the gutter. A programmatic `scrollLeft` assignment is a scroll operation, so the container must end on a snap position; the browser also re-snaps the current offset when the pitch change reflows the snap positions. The anchored offset is therefore rounded to a pitch boundary: up to ±`pitch/2` of positional error (36px at 4x) and, for a cursor near a cell boundary, a flip to the neighbouring frame. The zoom matrix tests exercise pure functions and a stub port, so the snap interaction is unmodelled.
**Fix:** Preserve the pre-existing cell-snapped plain-wheel scrolling (47-01 UAT) but exempt the zoom write: toggle a modifier class around the zoom (e.g. add `physics-paint-timeline-scroll--zooming` with `scroll-snap-type: none` before the write and drop it once the post-zoom layout has settled, such as one rAF after the pitch commit), or accept snap-quantized anchoring as the contract and re-derive/pin the accepted tolerance. Silent divergence between the math and the CSS is the one outcome to avoid.

### WR-02: The 6px content gutter is omitted from three pointer-to-frame projections

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:3982` (`getContentLeft`), `:4066-4072` (Bg clip drag delta), `:4154-4158` (Bg resize `projectFrame`); gutter at `app/src/components/physic-paint/physicsPaintStudio.css:5103`
**Issue:** The scroller pads its content by 6px (`padding-left: 6px`, the lane origin), so client-space content x is `clientX - scrollerRect.left + scrollLeft - 6`. The canonical helper gets this right (`pxToFrame` subtracts `TIMELINE_LANE_ORIGIN_PX`, `physicsPaintTimelineZoom.ts:148-152`), but these three sites treat the scroller's bounding-rect left as the content origin and never subtract the gutter. Every projected frame is biased by `6 / pitch` frames: +0.33 frame at 1x, +0.67 at 0.5x, +1.33 at 0.25x. `computeInsertionFrame` floors (`app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts:196-205`), so a cross-track drop or same-row slide lands one frame late at 0.25x, and even at 1x a pointer in the last third of a cell computes as the following frame; the insertion line at `PhysicsPaintTrackRow.tsx:1393` renders that biased frame. The Bg drag delta is biased by the difference of two independently rounded endpoints, so it can jump by one frame when the endpoints straddle a rounding boundary. Phase 60 made these sites pitch-aware but left their origin wrong.
**Fix:** Subtract the gutter at each site, or route all three through `pxToFrame`:
```ts
// e.g. the cross-track port
getContentLeft: () => (timelineScrollRef.current?.getBoundingClientRect().left ?? 0) + TIMELINE_LANE_ORIGIN_PX,
```
and in the two Bg projections replace `clientX - contentLeft + scrollLeft` with the canonical `clientX - scrollerLeft - TIMELINE_LANE_ORIGIN_PX + scrollLeft`.

## Info

### IN-01: Playhead centres on half the PITCH while the ruler centres on half the CELL

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1187-1192` (bar), `app/src/components/physic-paint/physicsPaintStudio.css:5177-5196` (ruler label/tick), `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts:110-122` (`resolvePlayheadAnchorLocalX`)
**Issue:** The bar is placed at `TIMELINE_LANE_ORIGIN_PX + frame * pitch + pitch / 2 - 1` and its comment claims that term is "half a cell minus half the 2px line". It equals half a cell only at 1x (18/2 − 1 = 8 = 16/2). The ruler label and tick use `calc(var(--timeline-cell-width) / 2)`, which is half a cell at every scale. At 4x the 2px playhead sits 3px right of the corresponding ruler tick centre; at 0.25x it sits 0.75px left. The same half-pitch expression is used for the playhead-anchored scroll in `resolvePlayheadAnchorLocalX`, so pill/Fit zooming anchors on a point 1px-class off the true frame centre (scaling with zoom).
**Fix:** Use the live cell half-width, which keeps the pinned 1x figure of 194px:
```ts
const left = TIMELINE_LANE_ORIGIN_PX + clampedFrame * pitch + (pitch - timelineMetrics.cellGap) / 2;
```
(either read `timelineZoom.metrics.value` in the leaf, or pass `cellWidth` down), and mirror the change in `resolvePlayheadAnchorLocalX` if the same centre is intended there.

### IN-02: Ruler tick row overhangs the lane when the frame count is not a multiple of the step

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:831-836` (`buildRulerTicks`), `:6326-6377` (ruler render, tick basis at `:6370`); `app/src/components/physic-paint/physicsPaintStudio.css:5140-5152`
**Issue:** `buildRulerTicks` emits every frame where `frame % step === 0` — `ceil(N / step)` ticks — and each tick is `flex: 0 0 step × pitch` inside a ruler whose width is fixed to `frameCount × pitch`. When `N % step !== 0` the last tick overhangs the lane by up to `(step − 1) × pitch`, and the ruler has no `overflow` clip, so the overhang contributes to the scroller's scrollable overflow. Example: 10 frames at step 3 gives four ticks of 54px (216px) in a 180px ruler at 1x, adding 36px of empty scroll past the last frame; at 4x the same shape is 864px in a 720px ruler, adding 144px. The defect pre-dates Phase 60 at 1x but scales with the zoom.
**Fix:** Size the last tick to the remaining frames (`Math.min(step, frameCount - frame) × pitch`) instead of a fixed step basis, or clip the ruler with `overflow: hidden` if the label straddle still fits.

### IN-03: Stale `ROTO_CELL_WIDTH_PX` reference in the audio controller port contract

**File:** `app/src/components/physic-paint/view/physicsPaintAudioController.ts:64`
**Issue:** The `getTimelineViewport` port documentation still defines its content space as `scrollLeft / ROTO_CELL_WIDTH_PX .. (scrollLeft + clientWidth) / ROTO_CELL_WIDTH_PX`. That constant no longer exists anywhere in the codebase; the real getter divides by the live pitch (`PhysicsPaintWorkflowStrip.tsx:2739-2748`). A maintainer reading the port contract is pointed at a removed authority.
**Fix:** Reword to "scrollLeft / live pitch .. (scrollLeft + clientWidth) / live pitch (the Phase 60 timeline zoom authority)".

### IN-04: Dead exported helpers `frameToPx`, `pxToFrame`, `resolveTimelineViewportFrames`

**File:** `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts:142-164`
**Issue:** All three are exported and unit-tested but have no production consumer — a repository-wide search finds only the definitions and test references. The documented consumer of `resolveTimelineViewportFrames` (the Studio audio "Fit to view") actually goes through the strip's registered getter, which inlines the same division at `PhysicsPaintWorkflowStrip.tsx:2740-2748`. Dead production code next to the live path invites drift (and the gutter-correct `pxToFrame` is exactly the helper WR-02's sites should be using).
**Fix:** Either route the strip viewport getter and the three projection sites through these helpers, or delete the unused exports and their tests.

---

_Reviewed: 2026-11-09T13:44:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
