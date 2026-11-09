# Phase 60: Studio Timeline Horizontal Zoom - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 17 (5 new, 12 modified/repointed)
**Analogs found:** 17 / 17 (16 with a codebase analog; the zoom-matrix test is a composite of two)

> All analog paths below are **git-tracked** (`git ls-files` verified this session). No `.gsd/capabilities/*` mirror path is cited.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts` | store / utility module | transform (pure math) + request-response (event-time reads) | `view/physicsPaintCanvasZoom.ts` | exact (role + precedent) |
| `app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx` | component (leaf pill) | request-response | `view/PhysicsPaintCanvasZoomBar.tsx` | exact |
| `app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` | test (unit, node env) | transform | `view/physicsPaintCanvasZoom.test.ts` | exact |
| `app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts` | test (source-contract, node env) | request-response | `view/physicsPaintCanvasZoomWiring.test.ts` | exact |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` | test (matrix, node env) | transform | `view/timelineRailDesign.test.ts` + `view/physicsPaintCanvasZoom.test.ts` | composite |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | component (host, 6817 lines) | event-driven + request-response | itself — in-file precedents (wheel listener, playhead leaf, viewport getter) | self |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | component (row renderer) | render / transform | `view/PhysicsPaintKeyRail.tsx` (already prop-driven pitch) | role-match |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | component (motion lane) | render / transform | itself + `view/PhysicsPaintKeyRail.tsx` | self |
| `app/src/components/physic-paint/view/TimelineMotionKeyDrag.tsx` | component (drag leaf) | event-driven | itself (delegates to `usePhysicsPaintKeyRailDrag`) | self |
| `app/src/components/physic-paint/view/timelineRailDesign.ts` | utility (design tokens) | transform | itself — `projectTimelineRailLineWidth` already takes pitch+gap | self |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | utility (geometry) | transform | itself — one `projectTimelineRailLineWidth` call site | self |
| `app/src/components/physic-paint/physicsPaintStudio.css` | style (config) | — | `.physics-paint-pill` + `.physics-paint-canvas-zoom-*` grammar | role-match |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | test (source-contract) | — | itself — 9 pins to repoint | repoint |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts` | test (source-contract) | — | itself — playhead pin | repoint |
| `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` | test (vnode harness) | render | itself — 18px pitch row | extend |
| `app/src/components/physic-paint/view/timelineRailDesign.test.ts` | test (unit) | transform | itself — default-pitch pins | extend |
| `app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts` | test (unit) | transform | itself — `computeInsertionFrame(…, 18)` pins | extend |

**Reference-only (must NOT be edited by this phase):** `view/PhysicsPaintKeyRail.tsx`, `view/PhysicsPaintLoopClipRail.tsx`, `view/soundBandGeometry.ts`, `hooks/usePhysicsPaintRulerScrub.ts`, `hooks/usePhysicsPaintCrossTrackDrag.ts`, `roto/railMotionEvaluator.ts`, `view/physicsPaintTrackHeaderColumn.tsx`.

---

## Pattern Assignments

### `view/physicsPaintTimelineZoom.ts` (NEW — store/utility, transform)

**Analog:** `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts`

The canvas precedent is a **near-copy for shape, not for math**: module-level signals, exported pure helpers, one store object, compare-then-write, and `resetForStudioOpen()`. Its pan/anchor law does NOT transfer — the timeline anchors a *frame under the cursor* by adjusting `scrollLeft`, not a pan offset.

**Imports pattern** (`physicsPaintCanvasZoom.ts:1-2`):
```typescript
import { computed, signal, type Signal } from '@preact/signals';
import { getContainedCanvasDisplaySize } from '../engine/physicsPaintCanvasSizing';
```
For Phase 60 the second import becomes the base tokens:
```typescript
import { computed, signal, type Signal } from '@preact/signals';
import { TIMELINE_GEOMETRY } from './timelineRailDesign';
```

**Constants + epsilon pattern** (`physicsPaintCanvasZoom.ts:20-25`) — mirror this declaration block verbatim in shape:
```typescript
/** The same preset ladder as the main editor's canvasStore. */
export const PHYSICS_PAINT_ZOOM_PRESETS: readonly number[] = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
export const PHYSICS_PAINT_ZOOM_MAX = 4;

/** A step smaller than this is a no-op, never an overshoot. */
export const PHYSICS_PAINT_ZOOM_EPSILON = 0.001;
```
Phase 60 exports: `TIMELINE_ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`, `TIMELINE_ZOOM_MIN = 0.25`, `TIMELINE_ZOOM_MAX = 4`, `TIMELINE_ZOOM_EPSILON = 0.001`, `TIMELINE_LANE_ORIGIN_PX = 6`, `TIMELINE_RULER_MIN_TICK_PX = 40`, `TIMELINE_RULER_MIN_STEP = 3`.

**Clamp pattern** (`physicsPaintCanvasZoom.ts:103-108`) — copy exactly, including the non-finite fallback:
```typescript
export function clampZoomScale(scale: number, minScale: number, maxScale: number): number {
  if (!Number.isFinite(scale)) return minScale;
  const lower = Number.isFinite(minScale) ? minScale : 0;
  const upper = Number.isFinite(maxScale) ? Math.max(lower, maxScale) : PHYSICS_PAINT_ZOOM_MAX;
  return Math.min(upper, Math.max(lower, scale));
}
```

**Preset stepping pattern — the D-06 law** (`physicsPaintCanvasZoom.ts:110-128`): first preset *strictly* beyond `current ± EPSILON`, clamped; a boundary step returns the clamped current value so callers can no-op:
```typescript
export function nextScalePreset(current: number, direction: 1 | -1, minScale: number, maxScale: number): number {
  if (!Number.isFinite(current)) return current;
  if (direction > 0) {
    for (const preset of PHYSICS_PAINT_ZOOM_PRESETS) {
      if (preset > current + PHYSICS_PAINT_ZOOM_EPSILON) return clampZoomScale(preset, minScale, maxScale);
    }
    return current;
  }
  for (let index = PHYSICS_PAINT_ZOOM_PRESETS.length - 1; index >= 0; index -= 1) {
    const preset = PHYSICS_PAINT_ZOOM_PRESETS[index];
    if (preset < current - PHYSICS_PAINT_ZOOM_EPSILON) return clampZoomScale(preset, minScale, maxScale);
  }
  return current;
}
```

**Compare-then-write setter** (`physicsPaintCanvasZoom.ts:232-237`) — the reactivity law (skill rule 3):
```typescript
/** Compare-then-write: a repeated value writes nothing (reactivity rule 3). */
function setSignal<T>(target: Signal<T>, value: T): boolean {
  if (Object.is(target.peek(), value)) return false;
  target.value = value;
  return true;
}
```

**Derived-value + percent pattern** (`physicsPaintCanvasZoom.ts:211-228`, `137-140`):
```typescript
export function resolveZoomPercent(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  return Math.round(scale * 100);
}
// …
const zoomPercent = computed(() => resolveZoomPercent(effectiveScale.value));
const isAtMin = computed(() => measured.value && effectiveScale.value <= minScale.value + PHYSICS_PAINT_ZOOM_EPSILON);
const isAtMax = computed(() => measured.value && effectiveScale.value >= maxScale.value - PHYSICS_PAINT_ZOOM_EPSILON);
```
Phase 60 uses the same shape but without a `measured` gate: `scale` is a plain module signal initialised to 1 (100% = 18px is always measurable).

**Single-write anchored zoom pattern** (`physicsPaintCanvasZoom.ts:252-280`) — the model for `applyTimelineZoom`; every input (wheel, minus, plus, Fit) ends in ONE function so two paths cannot drift:
```typescript
function applyAnchoredZoom(cursorX: number, cursorY: number, targetScale: number): void {
  if (!measured.peek() || !Number.isFinite(targetScale)) return;
  const scale = clampZoomScale(targetScale, minScale.peek(), maxScale.peek());
  // A target inside the epsilon of the current view changes nothing — keep the
  // current mode (a no-op wheel tick must not flip Fit off).
  if (Math.abs(scale - effectiveScale.peek()) <= PHYSICS_PAINT_ZOOM_EPSILON) return;
  // …one setSignal batch…
}
```
Timeline equivalent: `applyTimelineZoom(targetScale, anchorFrameFloat | null)` — writes `scale` and the anchored `scrollLeft` together; `null` anchor falls back to the playhead frame, then the viewport centre.

**Store object + reset pattern** (`physicsPaintCanvasZoom.ts:296-382`), specifically the reset (this is ZOOM-04's implementation):
```typescript
  /**
   * Studio open (and a view remount inside one document) always lands on the
   * fitted sheet. Container/work sizes are left for the next measurement so no
   * size flash is introduced before the observer reports.
   */
  resetForStudioOpen(): void {
    setSignal(zoomMode, 'fit');
    setSignal(absoluteScale, 1);
    setSignal(panX, 0);
    setSignal(panY, 0);
  },
```

**Phase-60-only helpers that have no canvas analog** (derive from `timelineRailDesign.ts`; these are the only genuinely new math):
```typescript
export function resolveTimelineMetrics(scale: number): TimelineMetrics {
  const s = clampTimelineZoomScale(scale);
  return {
    scale: s,
    cellWidth: TIMELINE_GEOMETRY.cellWidth * s,   // 16 → 16 × scale
    cellGap: TIMELINE_GEOMETRY.cellGap * s,       //  2 → 2 × scale
    pitch: TIMELINE_GEOMETRY.cellPitch * s,       // 18 → 18 × scale
  };
}
// D-09/D-10: smallest multiple of the 3-frame step leaving >= 40px per tick; never subdivides.
export function resolveRulerStep(pitch: number): number {
  let step = TIMELINE_RULER_MIN_STEP;
  while (step * pitch < TIMELINE_RULER_MIN_TICK_PX) step += TIMELINE_RULER_MIN_STEP;
  return step;
}
// Wheel anchor: content x = clientX - scrollerLeft - 6px gutter.
export function resolveAnchoredScrollLeft(input: {
  scrollLeft: number; clientX: number; scrollerLeft: number;
  oldPitch: number; newPitch: number;
}): number {
  const localX = input.clientX - input.scrollerLeft - TIMELINE_LANE_ORIGIN_PX;
  const frameFloat = (input.scrollLeft + localX) / input.oldPitch;
  return frameFloat * input.newPitch - localX;
}
```

**Acceptance numbers to encode as fixtures** (verified arithmetic, not prose):
| scale | pitch | ruler step | tick px |
|---|---|---|---|
| 0.25 | 4.5 | 9 | 40.5 |
| 0.5 | 9 | 6 | 54 |
| 0.75 | 13.5 | 3 | 40.5 |
| 1 | 18 | 3 | 54 (today, byte-identical) |
| 2 | 36 | 3 | 108 |
| 4 | 72 | 3 | 216 |

---

### `view/PhysicsPaintTimelineZoomBar.tsx` (NEW — leaf pill, request-response)

**Analog:** `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx`

**Imports + narrow-subscription pattern** (`PhysicsPaintCanvasZoomBar.tsx:1-3, 33-38`):
```tsx
import { useEffect, useRef } from 'preact/hooks';
import { Hand, Minus, Plus } from 'lucide-preact';
import { physicsPaintCanvasZoom } from './physicsPaintCanvasZoom';
// …
export function PhysicsPaintCanvasZoomBar() {
  const zoomPercent = physicsPaintCanvasZoom.zoomPercent.value;
  const isAtMin = physicsPaintCanvasZoom.isAtMin.value;
  const isAtMax = physicsPaintCanvasZoom.isAtMax.value;
```
Phase 60 drops the `Hand`, `useEffect`/`useRef` press-and-hold machinery (timeline zoom has no pan tool) and keeps exactly the percent/min/max triple. It is a **prop-less leaf** so the memoized static chrome (`PhysicsPaintWorkflowStaticChrome = memo(...)`, strip `:2290`) never re-renders on a zoom write.

**Markup grammar — the exact D-01/D-02/D-03 clone** (`PhysicsPaintCanvasZoomBar.tsx:109-133, 150-158`):
```tsx
<div class="physics-paint-canvas-zoom-bar" role="group" aria-label="Canvas zoom">
  <button type="button" class="physics-paint-canvas-zoom-button" aria-label="Zoom out" title="Zoom out"
    disabled={isAtMin} onClick={() => physicsPaintCanvasZoom.zoomOut()}>
    <Minus size={14} aria-hidden="true" />
  </button>
  <span class="physics-paint-canvas-zoom-percent" aria-label="Zoom level">{zoomPercent}%</span>
  <button type="button" class="physics-paint-canvas-zoom-button" aria-label="Zoom in" title="Zoom in"
    disabled={isAtMax} onClick={() => physicsPaintCanvasZoom.zoomIn()}>
    <Plus size={14} aria-hidden="true" />
  </button>
  {/* … */}
  <button type="button" class="physics-paint-canvas-zoom-text-button" title="Fit the whole sheet in the window"
    aria-pressed={isFit} onClick={() => physicsPaintCanvasZoom.fitToWindow()}>Fit</button>
</div>
```
Phase-60 deltas, all local to this file:
- outer class becomes `physics-paint-pill` (NOT `physics-paint-canvas-zoom-bar`, which is `position: absolute; bottom: 16px` — the pill must sit *in the header flow*, strip `:1839`);
- percent span stays non-interactive (D-02) — no `<button>`, no `onClick`;
- `Fit` is a one-shot action (D-04): `aria-pressed` is intentionally OMITTED, because Fit is not a mode. `title="Fit the whole frame range"`.
- reuse `.physics-paint-nav-button` (the header's existing 15px icon button) or `.physics-paint-canvas-zoom-button`; the CSS block in the next section decides. Do not invent a third button class.

---

### `view/physicsPaintTimelineZoom.test.ts` (NEW — unit test, node env)

**Analog:** `app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts`

**Header + reset helper pattern** (`physicsPaintCanvasZoom.test.ts:1-3, 33-37`) — the `// @vitest-environment node` directive is mandatory (vitest config `include: ['src/**/*.test.ts', …]`; no DOM is available):
```typescript
// @vitest-environment node
import { effect } from '@preact/signals';
import { describe, expect, it } from 'vitest';
// …
function resetStore(workWidth: number, workHeight: number, containerWidth: number, containerHeight: number): void {
  physicsPaintCanvasZoom.setWorkSize(workWidth, workHeight);
  physicsPaintCanvasZoom.setContainerSize(containerWidth, containerHeight);
  physicsPaintCanvasZoom.resetForStudioOpen();
}
```
Phase-60 equivalent: `resetTimelineZoom()` + direct `setSignal` seams; no sizes are involved.

**Preset-stepping test pattern** (`physicsPaintCanvasZoom.test.ts:95-113`) — copy the table-shape and the "boundary is a no-op, never an overshoot" assertion:
```typescript
it('steps to the first preset beyond the current scale, clamped into range', () => {
  expect(nextScalePreset(1, 1, min, max)).toBe(1.5);
  expect(nextScalePreset(1, -1, min, max)).toBe(0.75);
  expect(nextScalePreset(4, 1, min, max)).toBe(4);
});
```
Phase-60 adds the D-06 continuous case the canvas store cannot express: `nextTimelineZoomPreset(1.37, 1) === 1.5`, `nextTimelineZoomPreset(1.37, -1) === 1`.

**Idempotence test pattern — the "no re-render on a no-op tick" proof** (`physicsPaintCanvasZoom.test.ts:311-352`): count `effect()` runs, fire repeated identical writes, `await Promise.resolve()` twice, assert the counters did not move. This is the direct D-08 oracle.

**Cases this file must cover** (ZOOM-01/02/04): anchored `pxToFrame(scrollLeft + localX)` invariance across a scale change (incl. the 6px gutter); wheel factor `exp(-normalized * 0.001)` with `deltaMode === 1` normalisation and clamp; preset ladder equality; Fit clamp + one-shot; `resetForStudioOpen()` → scale 1; ruler step table above; vertical-fixed assertions (no `cellHeight`/`laneHeight`/`rowHeight` in the metrics object).

---

### `view/physicsPaintTimelineZoomWiring.test.ts` (NEW — source-contract test, node env)

**Analog:** `app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts`

**File-read + rule-body helper pattern** (`physicsPaintCanvasZoomWiring.test.ts:1-4, 15-27`) — copy this scaffolding exactly:
```typescript
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const view = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('}', start);
  expect(end, `${selector} rule end`).toBeGreaterThan(start);
  return source.slice(start, end);
}
```

**Ordering-pin pattern** (`physicsPaintCanvasZoomWiring.test.ts:45-54`) — this is the shape for the pill host and header order:
```typescript
it('seats the pill as a region sibling after the viewport and the apply pill, gated by pickerOpen', () => {
  expect(view).toContain("import { PhysicsPaintCanvasZoomBar } from './PhysicsPaintCanvasZoomBar';");
  const barLiteral = '{!pickerOpen ? <PhysicsPaintCanvasZoomBar /> : null}';
  expect(view.split(barLiteral).length - 1).toBe(1);
  const barIndex = view.indexOf(barLiteral);
  // …indexOf inequalities…
});
```

**Reset-seam pin pattern** (`physicsPaintCanvasZoomWiring.test.ts:97-99`):
```typescript
expect(viewport).toContain('physicsPaintCanvasZoom.resetForStudioOpen();');
```
Phase-60 pins: `PhysicsPaintWorkflowStrip.tsx` contains `timelineZoom.resetForStudioOpen();` inside the mount effect; the pill file contains `role="group" aria-label="Timeline zoom"`, the literal `<span` percent (and NOT an `onClick` on that span), and no `aria-pressed` on Fit; the wheel block contains the modifier branch **before** `if (event.shiftKey) return;`.

---

### `view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` (NEW — matrix test, node env)

**Analog:** `app/src/components/physic-paint/view/timelineRailDesign.test.ts` (pure-function table assertions) + `physicsPaintCanvasZoom.test.ts` (store idempotence).

**Pure-table assertion pattern** (`timelineRailDesign.test.ts:342-353`):
```typescript
it('ends a single-frame visible rail on the cell right edge (v2.0.1 UAT)', () => {
  expect(projectTimelineRailLineWidth(1, 18, true)).toBe(16);
  expect(projectTimelineRailLineWidth(0, 18, true)).toBe(16);
});
it('projects a two-frame visible rail to 34px', () => {
  expect(projectTimelineRailLineWidth(2, 18, true)).toBe(34);
});
it('defaults to an 18px pitch and a visible end', () => {
  expect(projectTimelineRailLineWidth(30)).toBe(538);
  expect(projectTimelineRailLineWidth(4)).toBe(70);
});
```

**Matrix predicates to assert at 0.25 / 0.5 / 1 / 2 / 4** (with `P = 18·s`, `CW = 16·s`, `G = 2·s`):
- playhead centre `6 + f·P + P/2 − 1` — must equal `6 + f·18 + 8` at s = 1;
- hit-test round-trip `frameToPx(f).pitch` / `pxToFrame` at a fixed clientX;
- ruler `step = min{3k : 3k·P ≥ 40}`, tick extent `step·P` (54 at 1×);
- sound stain left `start·P`, width `(out−in)·P`;
- Loop Clip extent `n·P − G` (endVisible) vs full extent (clipped);
- audio visible range `scrollLeft/P` … `(scrollLeft + clientWidth)/P`.

**Write this file LAST** — ROADMAP prerequisite: the literal-`18` audit must reach zero first.

---

### `view/PhysicsPaintWorkflowStrip.tsx` (MODIFIED — host, 6817 lines)

**Analog:** itself. Every pattern below is an existing in-file precedent; the job is substitution, not invention.

**Pitch constants to delete/derive** (`:643-649`):
```typescript
const RULER_STEP = 3;
/* 47-01 UAT round 5: 18px-wide × 22px-tall frames (user test request). This
   drives lane width, ruler ticks, drag/scroll math, and the per-cell grid; one
   ruler tick spans RULER_STEP cells (3 × 18px = 54px). */
const ROTO_CELL_WIDTH_PX = 18;
/** One ruler tick spans RULER_STEP abutting cells (3 × 18px = 54px). */
const RULER_TICK_WIDTH_PX = RULER_STEP * ROTO_CELL_WIDTH_PX;
```
→ `RULER_STEP` stays (D-10 minimum). `ROTO_CELL_WIDTH_PX` becomes `const timelineMetrics = timelineZoom.metrics.value;` (one render-body read; `pitch` feeds all 56 sites). `RULER_TICK_WIDTH_PX` becomes `rotoRulerStep * timelineMetrics.pitch`.

**Ruler step builder to convert to a step parameter** (`:823-825`, used at `:3073`):
```typescript
function buildRulerTicks(frameCells: number[]): number[] {
  return frameCells.filter((frame) => frame % RULER_STEP === 0);
}
// :3073
const rotoRulerTicks = useMemo(() => buildRulerTicks(frameCells), [frameCells]);
```
→ `buildRulerTicks(frameCells, step)`; memo deps `[frameCells, rotoRulerStep]`.

**Ruler tick markup — the inline basis already overrides CSS** (`:6235-6243`):
```tsx
{rotoRulerTicks.map(frame => (
  <span key={frame} class="physics-paint-ruler-tick" style={{ flex: `0 0 ${RULER_TICK_WIDTH_PX}px` }}>
    <span class="physics-paint-ruler-label">
      {timelineUnitMode === 'seconds'
        ? formatRulerSecondsLabel(framesToSeconds(frame, props.projectFps ?? 1))
        : frame}
    </span>
  </span>
))}
```
Labels stay on every tick (D-09); only `flex` basis changes.

**Playhead leaf — the `+8` bug** (`:1167-1182`). This is the *only* strip leaf that should read the scale signal for its left offset (narrow subscriber, skill rule 5):
```tsx
function PhysicsPaintPlayheadBar(props: { currentFrame: Signal<number>; scrubFrame?: ReadonlySignal<number | null>; playbackActive: boolean; playbackTick: Signal<RotoCachedPlaybackTick | null> | null | undefined; frameCount: number; onHandlePointerDown?: (event: PointerEvent) => void }) {
  const frame = props.playbackActive ? (props.playbackTick?.value?.appFrame ?? props.currentFrame.value) : (props.scrubFrame?.value ?? props.currentFrame.value);
  const clampedFrame = Math.max(0, Math.min(frame, Math.max(0, props.frameCount - 1)));
  // 6 = the v2.0.1 timeline-scroll content gutter …; +8 = half a cell
  // (18/2 = 9) minus half the 2px line → the bar centers on the frame.
  const left = 6 + clampedFrame * ROTO_CELL_WIDTH_PX + 8;
```
→ `const left = 6 + clampedFrame * pitch + pitch / 2 - 1;` where `pitch = timelineZoom.metrics.value.pitch`. Reproduces 8 exactly at 1×.

**Wheel listener — insert the modifier branch FIRST** (`:5402-5429`). Keep the comment block's structure and the three unchanged guards byte-identical:
```typescript
useLayoutEffect(() => {
  const el = timelineScrollRef.current;
  if (!el) return;
  const handleTimelineWheel = (event: WheelEvent) => {
    if (!mountedRef.current) return;
    if (event.shiftKey) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
  };
  el.addEventListener('wheel', handleTimelineWheel, { passive: false });
  return () => el.removeEventListener('wheel', handleTimelineWheel);
}, []);
```
Insertion:
```typescript
    if (!mountedRef.current) return;
    if (event.metaKey || event.ctrlKey) {          // 60: D-05/D-07
      event.preventDefault();
      const normalized = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      queueTimelineZoom(normalized, event.clientX);
      return;
    }
    if (event.shiftKey) return;                    // unchanged
```

**rAF-coalescer pattern for `queueTimelineZoom`** — analog `PhysicsPaintCanvasZoomViewport.tsx:44-102`. The load-bearing lines: accumulate from the previously *queued* target, then one write per frame:
```typescript
const schedule = () => {
  if (rafId !== 0) return;
  rafId = window.requestAnimationFrame(flush);
};
// Zoom targets accumulate multiplicatively from the previously QUEUED
// target, so a burst of wheel events inside one frame never loses steps.
const queueZoom = (scale: number, cursorX: number, cursorY: number) => {
  pending = { kind: 'zoom', scale, cursorX, cursorY };
  schedule();
};
```
Cleanup must cancel the queued frame (`window.cancelAnimationFrame(rafId)` — pinned in the wiring test at `physicsPaintCanvasZoomWiring.test.ts:105`).

**Mount effect — the reset seam** (`:2710-2721`). This effect (`[]` deps, module-level getter registration, cleanup on unmount) is the exact shape to extend with `timelineZoom.resetForStudioOpen()`:
```typescript
  // 261010-ht0 F5: register the stable viewport getter (module-level read, no
  // per-scroll signal). Unregister on unmount so a closed Studio never leaks.
  useEffect(() => {
    registerTimelineViewportGetter(() => {
      const el = timelineScrollRef.current;
      if (!el) return null;
      return {
        visStart: el.scrollLeft / ROTO_CELL_WIDTH_PX,
        visEnd: (el.scrollLeft + el.clientWidth) / ROTO_CELL_WIDTH_PX,
      };
    });
    return () => registerTimelineViewportGetter(null);
  }, []);
```
→ add `timelineZoom.resetForStudioOpen();` as the first statement; convert the two divisions to `timelineZoom.metrics.peek().pitch`.

**Lane extent + lane/grid render** (`:3042`, `:5621-5630`, `:5635`, `:5667`, `:5697`):
```typescript
const rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX;          // :3042
// :5621-5630
style={{ width: `${rotoLaneWidthPx}px`, minWidth: `${rotoLaneWidthPx}px`, gridTemplateColumns: `${rotoLaneWidthPx}px` }}
// :5635 / :5667
framePitch={ROTO_CELL_WIDTH_PX}       // Key Rail / Loop Clip Rail — already prop-driven
// :5697
style={{ gridTemplateColumns: `repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)` }}
```
Cells grid additionally carries the sanctioned CSS custom property (Pitfall 11):
```tsx
style={{
  gridTemplateColumns: `repeat(${frameCells.length}, ${timelineMetrics.pitch}px)`,
  '--timeline-cell-width': `${timelineMetrics.cellWidth}px`,
}}
```

**Band extents** (`:6193-6197` ruler, `:6273-6277` rows region) — both already consume `rotoLaneWidthPx`, so they convert for free once `:3042` does:
```tsx
style={{ width: `${rotoLaneWidthPx}px`, minWidth: `${rotoLaneWidthPx}px` }}
```

**Crucially unchanged (Pitfall 13):** the open-frame effect (`:4986-4996`, deps `props.timelineOpenFrame, props.rotoPhysicalCells.length, updateScrollbar`) and the reveal effect (`:5004-5016`, dep `props.revealRequest?.nonce`). Read the live pitch inside them; never add `scale` to either dep array.

**Static-chrome pill host** (`:1753` impl, `:1839` header, `:2290` memo, `:6047` render):
```tsx
<div class="physics-paint-workflow-header">
  <div class="physics-paint-pill physics-paint-pill--navigation …" …>…</div>
  <div class="physics-paint-pill physics-paint-pill--playback …" …>…</div>
  <PhysicsPaintWorkflowLiveStatus … />
```
Insert `<PhysicsPaintTimelineZoomBar />` immediately after the playback pill and before `<PhysicsPaintWorkflowLiveStatus>` — the pinned order (navigation → playback → capsule → Close, `PhysicsPaintWorkflowStrip.test.ts:1103-1116`) still holds because the pill is not one of those four anchors.

**TrackRow render sites** (`:6346` paint rows, `:6378` Bg row) receive `framePitch={timelineMetrics.pitch}`.

---

### `view/PhysicsPaintTrackRow.tsx` (MODIFIED — row renderer)

**Analog for the prop-driven shape:** `view/PhysicsPaintKeyRail.tsx` — it already takes `framePitch: number` as a required prop and every geometry line multiplies it (`:56-59`, `:215-221`). Copy that contract, not a module read.

**Constant to delete** (`:88-90`):
```typescript
/** 47-01 geometry: the same 18px frame pitch as the active track. */
const ROW_CELL_WIDTH_PX = 18;
```

**Props interface to extend** (`:129-226`) — add one required field beside `frameCells`:
```typescript
export interface PhysicsPaintTrackRowProps {
  /** The stable track UUID this row renders — identity, never an array index. */
  readonly trackId: string;
  readonly layerId: string;
  /** The strip-level shared horizontal extent (frameCells), mapped 1:1 per row. */
  readonly frameCells: readonly number[];
  // ADD:
  /** 60: the live session pitch (TIMELINE_GEOMETRY.cellPitch × zoom scale). */
  readonly framePitch: number;
```
Also thread it into `TimelineMotionBlockProps` (`:570-610`) and down to `TimelineMotionBlock`.

**All eight consumer sites** (`:882`, `:1129`, `:1134`, `:1229`, `:1234`, `:1303`, `:1306`, `:1354`), verifiable as a complete list by `grep -n "ROW_CELL_WIDTH_PX"`:
```typescript
const cellCount = Math.max(1, Math.round(props.width / ROW_CELL_WIDTH_PX));                   // :882
gridTemplateColumns: `repeat(${frameCells.length}, ${ROW_CELL_WIDTH_PX}px)`,                  // :1129
minWidth: `${frameCells.length * ROW_CELL_WIDTH_PX}px`,                                       // :1134
left: `${segment.firstKeyFrame * ROW_CELL_WIDTH_PX}px`,                                       // :1229
width: `${projectTimelineRailLineWidth(…, ROW_CELL_WIDTH_PX, true)}px`,                        // :1234 → pass scaled gap too
projectPhysicsPaintLoopClipGeometry(range, {…}, ROW_CELL_WIDTH_PX)                            // :1303 → pass scaled gap
const cellCount = Math.max(1, Math.round(geometry.width / ROW_CELL_WIDTH_PX));                // :1306
style={{ left: `${crossInsertionFrame * ROW_CELL_WIDTH_PX}px` }}                              // :1354
```
`:882` is a *ratio* (`width / pitch`): keeping it as a division by the scaled pitch is correct — it stays constant while both scale.

**Hard-coded literal `18`** (`:785`) — the quintessential partial conversion:
```typescript
const geometry = projectPhysicsPaintLoopClipGeometry(continuousRange, { startFrame: 0, endFrameExclusive: capacity }, 18);
```
→ `props.framePitch`.

**Motion block lane offset** (`:649`):
```typescript
marginLeft: railStartFrame * TIMELINE_GEOMETRY.cellPitch,
```
→ `railStartFrame * framePitch`.

---

### `view/TimelineMotionChannels.tsx` (MODIFIED — motion lane)

**Analog:** itself + `PhysicsPaintKeyRail.tsx`'s required-pitch prop contract. RESEARCH Open Question 4 resolution: take a **required prop, no default**, so pure component tests stay explicit and module state never leaks in.

**Props interface** (`:93-113`) — add:
```typescript
export interface TimelineMotionChannelLaneProps {
  // …existing…
  /** 60: the live session pitch; required, so a test can never silently read 18. */
  readonly framePitch: number;
}
```
Thread the same field through `TimelineMotionBlockProps`, `TimelineMotionChannelHeaderRowProps`, and `TimelineMotionKeyDragLaneProps`.

**Four geometry sites** (`:323`, `:338-339`, `:361`, `:400-403`):
```typescript
const laneWidth = frameCount * TIMELINE_GEOMETRY.cellPitch;                                    // :323
left: frame * TIMELINE_GEOMETRY.cellPitch + (TIMELINE_MOTION.cellWidth - TIMELINE_MOTION.keySize) / 2,  // :338-339
left: frame * TIMELINE_GEOMETRY.cellPitch,                                                    // :361
d={buildRailMotionCurvePath(lane.channels[0], frameCount, laneHeight, { railId, snapFrames })} // :400-403
```
→ `framePitch` for the first three; the curve call adds the seam that already exists:
`{ railId, snapFrames, cellPitch: framePitch }` (`railMotionEvaluator.ts:320-321` declares `readonly cellPitch?: number`, `:438` defaults it — no edit needed there).

**Fixed, do NOT touch:** the header cluster's `TIMELINE_MOTION.cellWidth` inside the 185px header column (`:542-543`) and `laneHeight` (`TIMELINE_MOTION.laneHeight`).

**Outline call** (`:799-806`) — extend `resolveMotionBlockOutlineRect` input with `pitch` + `gap` (see `timelineRailDesign.ts` below) and pass `railStartFrame`, `railFrameCount` unchanged.

---

### `view/TimelineMotionKeyDrag.tsx` (MODIFIED — drag leaf, event-driven)

**Analog:** itself. Two lines, both in the hook port table (`:68`, `:81-82`):
```typescript
projectDestination: ({ originClientX, clientX }) => {
  const armed = armedFrameRef.current ?? 0;
  // Frame delta over the lane's own column pitch: no measure is inlined.
  return armed + Math.round((clientX - originClientX) / TIMELINE_GEOMETRY.cellPitch);
},
// …
left: clamped.frame * TIMELINE_GEOMETRY.cellPitch + (TIMELINE_MOTION.cellWidth - TIMELINE_MOTION.keySize) / 2,
```
→ `latestRef.current.laneProps.framePitch` in both. Preserve the latest-value ref pattern (`:52-56`) — do not add `framePitch` to a hook dep array.

---

### `view/timelineRailDesign.ts` (MODIFIED — design tokens, transform)

**Analog:** itself. `projectTimelineRailLineWidth` is already the exact shape the phase needs — pitch AND gap are parameters with token defaults (`:346-353`):
```typescript
export function projectTimelineRailLineWidth(
  frameCount: number,
  pitch: number = TIMELINE_GEOMETRY.cellPitch,
  endVisible: boolean = true,
  gap: number = TIMELINE_GEOMETRY.cellGap,
): number {
  return Math.max(pitch - gap, frameCount * pitch - (endVisible ? gap : 0));
}
```

**The one edit** — `resolveMotionBlockOutlineRect` (`:162-208`) currently hardcodes both tokens:
```typescript
export interface TimelineMotionBlockOutlineInput {
  readonly rowTop: number;
  readonly rowHeight: number;
  readonly laneCount: number;
  readonly railStartFrame: number;
  readonly railFrameCount: number;
}
// …
    left: startFrame * TIMELINE_GEOMETRY.cellPitch + half,
    width: frameCount * TIMELINE_GEOMETRY.cellPitch - TIMELINE_GEOMETRY.cellGap - TIMELINE_GEOMETRY.outlineWidth,
```
→ add `readonly pitch?: number; readonly gap?: number;` to the input and default them to the tokens inside; substitute in the two expressions. Optional-with-token-default (not required) keeps `timelineRailDesign.test.ts` green unchanged and preserves the documented "design contract" role of the file.

**Do NOT change** `TIMELINE_GEOMETRY` (`:97-113`) — `cellWidth: 16`, `cellPitch: 18`, `cellGap: 2` stay the **base constants the authority multiplies**. Same for `TIMELINE_MOTION` (`:121-151`). VIS-02 (`rowHeight: 30`) is explicitly out of scope.

---

### `view/physicsPaintLoopClipPresentation.ts` (MODIFIED — geometry, transform)

**Analog:** itself. One call site (`:386-409`):
```typescript
export function projectPhysicsPaintLoopClipGeometry(
  loop: PhysicPaintRotoLoopRange,
  visibleFrameWindow: { readonly startFrame: number; readonly endFrameExclusive: number },
  framePitch: number,
): PhysicsPaintLoopClipGeometry | null {
  // …
  return {
    left: (clippedStart - visibleFrameWindow.startFrame) * framePitch,
    width: projectTimelineRailLineWidth(clippedEnd - clippedStart, framePitch, endVisible),
  };
}
```
Pitfall 2: the width omits `gap`, so at 0.25× the rail is 1.5px long and at 4× it is 6px long. Add an optional `frameGap: number = TIMELINE_GEOMETRY.cellGap` 4th parameter and pass it as the 4th argument to `projectTimelineRailLineWidth`. All four call sites (`PhysicsPaintLoopClipRail.tsx:428`, `PhysicsPaintTrackRow.tsx:785`, `:1300`) then pass `metrics.cellGap`.

**Same defect, same fix, in two other files** (both nominally "unchanged", so flag them for the planner as one-line gap threading — not pitch refactors):
- `view/PhysicsPaintKeyRail.tsx:59` and `:219` — `projectTimelineRailLineWidth(…, framePitch, …)` with no gap.
- `view/PhysicsPaintTrackRow.tsx:1234` — covered above.

---

### `physicsPaintStudio.css` (MODIFIED — style)

**Analog:** the existing pill + zoom grammar in the same file.

**Pill grammar to inherit** (`:3979-3995`) — the header pill is 32px, `border-radius: 999px`, `flex: 0 0 auto`:
```css
.physics-paint-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  height: 32px;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  white-space: nowrap;
}

.physics-paint-pill--navigation {
  border-color: #575e66;
  background: #34383c;
}
```

**Controls + readout grammar** (`:1045-1096`) — reuse the button/percent rules (rename only if you add a timeline-specific class; prefer reuse):
```css
.physics-paint-canvas-zoom-percent {
  min-width: 38px;
  padding: 0 2px;
  color: #dfe5ec;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}
.physics-paint-canvas-zoom-button:disabled,
.physics-paint-canvas-zoom-text-button:disabled {
  opacity: 0.38;
  cursor: default;
}
```

**Two authoritative literals to remove/derive** (Pitfall 11 + "Deprecated/outdated"):
```css
/* :5146-5157 — the CSS-level fallback; the inline basis already overrides it today. */
.physics-paint-ruler-tick {
  flex: 0 0 54px;   /* DELETE or make the rule layout-only (no flex basis) */
}

/* :7882-7893 — independent 16px authority beside the inline repeat(n, 18px) grid. */
.physics-paint-roto-cell {
  width: 16px;      /* → width: var(--timeline-cell-width, 16px); */
}
```
`--timeline-cell-width` is the ONE sanctioned custom property (CSS only renders the value; JS-derived mappings stay in the module). The grid gap is already `gap: 0` (`:7870-7874`) — the visual 2px gap is track-width minus cell-width, so both derive from the module automatically.

**Fixed values that must NOT change (ZOOM-03):** `.physics-paint-timeline-scroll { padding-left: 6px; scroll-padding-left: 6px }` (`:5095`, `:5103-5104`), `.physics-paint-ruler { flex: 0 0 36px; height: 36px }` (`:5137-5138`), `.physics-paint-lane { height: 31px; padding-top: 6px }` (`:5906-5907`), `.physics-paint-header-column { flex: 0 0 185px }` (`:5934`), `.physics-paint-roto-cell { height: 22px }` (`:7892`).

---

### Pin tests to repoint (MODIFIED — source-contract)

**Analog:** themselves. Repoint, never relax or delete (skill: "Source-string pin tests … must be repointed at the authority").

`view/PhysicsPaintWorkflowStrip.test.ts`:
```typescript
expect(code).toContain('ROTO_CELL_WIDTH_PX = 18');                                        // :942
expect(code).toContain('const rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX;'); // :946
expect(code).toContain('style={{ gridTemplateColumns: `repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)` }}'); // :955 → :963
expect(getCssRuleBlock(styles, '.physics-paint-ruler-tick {')).toContain('54px');          // :973, :1432
expect(project).toContain('ROTO_CELL_WIDTH_PX');                                           // :2016, :2024
// header order (must keep passing): navigation < playback < capsule < Close            // :1103-1116
```
Repoint targets: assert `timelineZoom.metrics` / `.pitch` presence and that `physicsPaintTimelineZoom.ts` contains `cellPitch: 18` (the one surviving base token); assert the strip no longer contains `ROTO_CELL_WIDTH_PX = 18`.

`view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts:65-67`:
```typescript
expect(block).toContain('6 +');
expect(block).toContain('ROTO_CELL_WIDTH_PX');
expect(block).toContain('+ 8');
```
→ repoint to `6 +`, `pitch`, `pitch / 2 - 1`.

**Must keep passing unchanged at default scale:** `PhysicsPaintWorkflowStrip.test.ts:488-492` (cell height 22), `timelineRailDesign.test.ts:351` (`projectTimelineRailLineWidth(30) === 538`), `TimelineMotionChannels.test.ts:502` (`style.left === index * TIMELINE_GEOMETRY.cellPitch`), `usePhysicsPaintCrossTrackDrag.test.ts:205` (`computeInsertionFrame(…, 18)`).

**Test harness conventions (mandatory):**
- vitest config `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` (`app/vitest.config.ts`) — a `.test.tsx` target runs **zero** tests. Existing workaround in the tree: `PhysicsPaintTrackRow.test.tsx.test.ts` (kept beside its `.test.tsx` source).
- Component tests run in the **node vnode harness** — `materialize()` walks the returned vnode tree as plain function calls, no DOM (`TimelineMotionChannels.test.ts:1-70`). Follow that shape for the pill if it needs a render assertion; otherwise pin it with source strings.
- Command: `pnpm --filter efx-motion-editor exec vitest run <file>`. Never watch mode.

---

## Shared Patterns

### Session-only view state (applies to: the new module, the pill, every consumer)
**Source:** `view/physicsPaintCanvasZoom.ts:4-18` (the header comment) and `PhysicsPaintCanvasZoomViewport.tsx:28-37`.
**Apply to:** `physicsPaintTimelineZoom.ts`, `PhysicsPaintTimelineZoomBar.tsx`, the strip's wheel branch.
Nothing view-only may reach `.mce`, the document store, a revision signal, a cache key, or export output. No new signal may be bumped per scroll or per pointer move.

### Compare-then-write / epsilon no-op (D-08)
**Source:** `physicsPaintCanvasZoom.ts:232-237` (setter) + `:261` (the epsilon short-circuit inside `applyAnchoredZoom`).
**Apply to:** every zoom write — wheel, minus, plus, Fit.

### Narrow leaf subscription inside a giant component
**Source:** `PhysicsPaintPlayheadBar` (strip `:1167`) and `PhysicsPaintWorkflowLiveStatus` (strip `:1205`); wiring test `physicsPaintCanvasZoomWiring.test.ts:106-109` asserts the leaf reads only what it needs.
**Apply to:** the pill (prop-less leaf), the playhead (reads `metrics.value.pitch` in its own body). The strip body will re-render once per rAF flush — that is accepted and bounded by the coalescer.

### Event-time `.peek()` reads (never subscribe a handler)
**Source:** `PhysicsPaintCanvasZoomViewport.tsx:79-101` (`physicsPaintCanvasZoom.effectiveScale.peek()` / `.minScale.peek()` inside `onWheel`).
**Apply to:** push/rail-set/bg drag projections, sound drag delta, push click frame, ruler-scrub `cellWidthPx`, scroll-to-frame/reveal targets, `getTimelineViewportFrames`.

### Single derivation, never a local multiply
**Source:** the strip's `:644-646` comment ("This drives lane width, ruler ticks, drag/scroll math, and the per-cell grid") — the file already documents one authority; the phase makes it true.
**Apply to:** every file in the classification table. The zero-tolerance audit is `grep -n "ROTO_CELL_WIDTH_PX\|ROW_CELL_WIDTH_PX\|× 18\|\* 18"` across `view/` and `hooks/`.

### Faithful helper reuse (do not hand-roll)
**Sources, all already parametric:** `projectTimelineRailLineWidth` (`timelineRailDesign.ts:346`), `soundStainLeftPx`/`soundStainWidthPx` (`soundBandGeometry.ts:91-98`), `projectPhysicsPaintLoopClipGeometry` (`physicsPaintLoopClipPresentation.ts:386`), `usePhysicsPaintRulerScrub`'s `cellWidthPx` option (`usePhysicsPaintRulerScrub.ts:49-50`), `buildRailMotionCurvePath`'s `cellPitch` option (`railMotionEvaluator.ts:320-321`).

### The `usePhysicsPaintCrossTrackDrag` zoom seam (Pitfall 6)
**Source:** `hooks/usePhysicsPaintCrossTrackDrag.ts:96-98` — `readonly framePitch: number; readonly zoom?: number;` / `const pitch = framePitch * zoom;` (zoom defaults to 1). Strip call site `:3922` passes `framePitch: ROTO_CELL_WIDTH_PX`.
**Rule:** pass the **already-scaled** pitch as `framePitch` and never pass `zoom`. Double-application produces pitch² behaviour.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` | test | transform | No five-level geometry matrix exists yet; compose the pure-table style of `timelineRailDesign.test.ts` with the store/idempotence style of `physicsPaintCanvasZoom.test.ts` (both cited above) |

All other files have an exact or role-match analog. No file in this phase requires RESEARCH.md-only patterns.

---

## Metadata

**Analog search scope:** `app/src/components/physic-paint/{view,hooks,roto}`, `app/src/components/physic-paint/physicsPaintStudio.css`, `app/vitest.config.ts`.
**Files read this session (17):** `physicsPaintCanvasZoom.ts`, `physicsPaintCanvasZoom.test.ts`, `physicsPaintCanvasZoomWiring.test.ts`, `PhysicsPaintCanvasZoomBar.tsx`, `PhysicsPaintCanvasZoomViewport.tsx`, `PhysicsPaintWorkflowStrip.tsx` (targeted ranges), `PhysicsPaintWorkflowStrip.test.ts` (pin ranges), `PhysicsPaintWorkflowStrip.rulerSeek.test.ts`, `PhysicsPaintTrackRow.tsx` (targeted ranges), `TimelineMotionChannels.tsx` (targeted ranges), `TimelineMotionChannels.test.ts` (harness + pitch row), `TimelineMotionKeyDrag.tsx`, `timelineRailDesign.ts`, `timelineRailDesign.test.ts` (pin range), `physicsPaintLoopClipPresentation.ts`, `soundBandGeometry.ts`, `usePhysicsPaintRulerScrub.ts`, `usePhysicsPaintCrossTrackDrag.test.ts` (pin range), `PhysicsPaintKeyRail.tsx` (width call sites), `physicsPaintStudio.css` (6 rule blocks), `app/vitest.config.ts`.
**Tracked-source gate:** all cited analog paths verified with `git ls-files` (non-empty). No gitignored mirror path is cited.
**Reactivity law applied:** `.claude/skills/efx-preact-reactivity/SKILL.md` rules 2 (signals over hooks), 3 (compare-then-write), 4 (identity-stable deps), 5 (narrow version reads), 6 (no render-body writes), 7 (loop termination).
**Pattern extraction date:** 2026-11-09
