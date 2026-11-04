---
phase: quick-261104-uyv
plan: 261104-uyv
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts
  - app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx
  - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx
  - app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - .planning/STATE.md
  - .planning/quick/261104-uyv-add-studio-canvas-zoom-controls-full-zoo/261104-uyv-SUMMARY.md
autonomous: true
requirements: [QUICK-261104-UYV]
user_setup: []

estimate:
  tokens: 72000
  raw_tokens: 72000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The Studio still opens on the whole sheet fitted and centered (today's default view); Fit restores that view and keeps following container resizes while in fit mode."
    - "The percent readout reports the working-pixel-to-CSS-pixel ratio: 1:1 reads 100% and renders one engine working-canvas pixel per CSS pixel; fit reads the contained ratio (about 34-36% for a 1080x1920 sheet in a typical canvas region)."
    - "Zooming in past fit lets the sheet overflow the canvas viewport; the viewport clips it and closes with the region padding, so the side panels, workflow strip, and floating dialogs are never overdrawn."
    - "Cmd/Ctrl+wheel and macOS trackpad pinch zoom about the cursor with the point under the cursor held fixed; plain wheel and middle-button drag pan only while the sheet overflows, and the paint engine never sees a middle-button press."
    - "Every bounds-anchored surface (fond, transparency checkerboard, program monitor + above slice, onion overlay, reference ghost and transform handles, background handles, brush ring, picker visor) stays glued to the sheet at every zoom and pan, and pointer/color-pick mapping stays exact because the shell's real CSS size grows."
    - "No bare keyboard shortcut is added (Space, F, C, B, W, E, P, A, D, I unchanged); the mount's pinned effect dependency line, its four performance counters, the existing mount/view/pill tests, and the engine, document, working size, paperTextureScale, and paint data are untouched."
  artifacts:
    - path: "app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts"
      provides: "Pure zoom/pan math plus the module-level signals store (sizes, mode, scale, pan, actions)"
    - path: "app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts"
      provides: "Fit parity, 1:1 = 100%, preset stepping, cursor-anchored zoom, pan clamp, resize-in-fit/absolute, reset, idempotence pins"
    - path: "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx"
      provides: "Reports measured container + working size to the store and renders the shell at the store's display size (max caps neutralized only when sized)"
    - path: "app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx"
      provides: "Clipping viewport, translate-only pan layer, wheel/gesture/middle-drag interactions, Studio-open reset"
    - path: "app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx"
      provides: "Floating zoom pill: minus, percent, plus, Fit, 1:1 with disabled/active states"
    - path: "app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts"
      provides: "Static pins: stack wrapped once, bar gated by pickerOpen, clip on the viewport only, no shortcuts added"
  key_links:
    - "Mount ResizeObserver (group box) -> zoom store container/work size -> effectiveScale -> shell inline width/height -> stack shell ResizeObserver -> canvasBounds -> every anchored overlay."
    - "Pan layer transform (ancestor of the stack) -> shellRect.left - stackRect.left is translation-invariant -> canvasBounds and pointer ratios stay correct with no double scaling."
    - "Wheel/pinch/middle-drag -> one rAF-coalesced store write per frame -> shell resize; pan writes are a transform-only update on the pan layer leaf."
---

<objective>
Add a full Studio canvas zoom surface: a floating pill with minus, percent, plus, Fit, and 1:1; Fit stays the default opening view and follows container resizes; 1:1 maps one engine working-canvas pixel to one CSS pixel and is pannable because a 1080x1920 sheet at 100% is larger than the Studio window; panning also works by plain wheel and middle-button drag while the sheet overflows.

Purpose: the Studio currently sizes the sheet fit-only (`getContainedCanvasDisplaySize` on every container resize), so fine paint detail cannot be inspected at working-pixel fidelity. This is a display-only feature: no engine, document, persistence, export, or paint-data change.

Output: a pure, unit-tested zoom module, a mount sizing seam that reads it, a clipping viewport with pan, and the floating zoom pill — one end-to-end slice carried in three sequential tasks (store -> sizing seam -> surface).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@CLAUDE.md

Planning sources (verified against the live tree at plan time):
@app/src/components/physic-paint/engine/physicsPaintCanvasSizing.ts
@app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
@app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts
@app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/physicsPaintStudio.css
@app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
@app/src/stores/canvasStore.ts
@app/src/components/layout/CanvasArea.tsx

Ground rules:
- Preact + @preact/signals only. No useState; signals with compare-then-write setters, identity-stable effect deps, narrow signal reads, no render-body writes. A rAF coalescer states its termination condition and is cancelled on unmount.
- Do not touch the engine's sizing law, `paperTextureScale`, working size, document, persistence, export, or paint data. The sheet grows by real CSS size; never by a scale transform on the stack (client-rect-derived mapping would double-scale).
- Do not run the dev server or the Tauri app. The user runs live UAT; never record a live row as passed.
- Tests: `pnpm --dir app exec vitest run <paths>`, never watch. Vitest collects only `src/**/*.test.ts` — a `.test.tsx` target runs nothing. Typecheck: `pnpm --dir app run typecheck`. No new dependencies. Never push.
- Never add a bare-key shortcut. Wheel, gesture, and middle-button are the only new inputs.
- Keep the pinned contracts intact: the mount effect dependency line, its four counters, `<MemoizedPhysicsPaintCanvasStack {...canvas} />`, the `}, [props.height, props.width]);` line, and every existing test.
</context>

<tasks>

<task type="tdd">
  <name>Task 1: TDD the pure zoom/pan math and its signals store</name>
  <files>app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts, app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts</files>
  <behavior>
    Cases pinned by the test file, all through pure functions plus the store:
    1. Fit parity: resolveFitScale(800, 700, 1080, 1920) equals getContainedCanvasDisplaySize(800, 700, 1080, 1920).width / 1080; percent rounds to the same integer the contained size implies.
    2. 1:1: actualSize() yields effectiveScale 1 and zoomPercent 100; displayWidth equals workWidth and displayHeight equals workHeight.
    3. Max: resolveMaxScale(1080, 1920) is >= 1 and <= 4; resolveMaxScale(512, 512) is 4; resolveMaxScale(1920, 1920) is >= 1 (the budget always admits 1:1 at the 1920 working cap).
    4. Min: resolveMinScale(fitScale) is fitScale when fit is below 1 and 1 when fit is above 1.
    5. Preset stepping: from a fit of 0.3646 plus lands on 0.5 and minus is a no-op (already at min); from 1 plus lands on 1.5 and minus on 0.75; at the max plus is a no-op; at the min minus is a no-op.
    6. Cursor-anchored zoom: with container 1000x800, display 400x600, pan 0,0, and a cursor offset of (100, -50) from the container center, setZoomAtCursor(scale * 1.5, 100, -50) leaves the same local sheet point under the cursor (recompute the fraction before and after and compare within 1e-6).
    7. Pan clamp: with display <= container in both axes pan resolves to 0,0; with display 2000x1600 in a 1000x800 container setPan(9999, -9999) clamps to +-500 and +-400.
    8. Fit follows resize: in fit mode a container change from 800x700 to 400x350 halves effectiveScale and keeps pan at 0,0. In absolute mode the same resize keeps the scale and only re-clamps pan.
    9. Reset: after panning and zooming, resetForStudioOpen() restores fit mode, absoluteScale 1, pan 0,0.
    10. Idempotence: a signals effect subscribed to containerWidth/count-observed runs zero additional times when setContainerSize repeats the current value, and setPan repeats likewise; setWorkSize with an unchanged size is a no-op.
  </behavior>
  <action>
    RED: create `app/src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts` first with the ten groups above and run it; it must fail because the module does not exist. Use a `.test.ts` file (never `.test.tsx`). Import `effect` from `@preact/signals` for the idempotence group and dispose it in each test.

    GREEN: create `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts` with pure helpers and a thin store over module-level signals.

    Pure layer (export everything for tests):
    - Constants: PHYSICS_PAINT_ZOOM_PRESETS `[0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]` (the same preset ladder as the main editor's canvasStore), PHYSICS_PAINT_ZOOM_MAX 4, PHYSICS_PAINT_ZOOM_EPSILON 0.001, PHYSICS_PAINT_ZOOM_BACKING_BUDGET 16_000_000, PHYSICS_PAINT_ENGINE_DPR_CAP 2.
    - resolveFitScale(containerWidth, containerHeight, workWidth, workHeight): returns 0 when unmeasurable, else delegates to `getContainedCanvasDisplaySize` from `../engine/physicsPaintCanvasSizing` and divides its width by workWidth. Delegating keeps Fit byte-identical to today's sizing authority.
    - resolveMaxScale(workWidth, workHeight, budget, dprCap): `Math.max(1, Math.min(PHYSICS_PAINT_ZOOM_MAX, Math.sqrt(budget / (workWidth * workHeight * dprCap * dprCap))))`, or PHYSICS_PAINT_ZOOM_MAX for non-positive inputs. The budget exists because the watercolor engine's `fitCanvas` sizes its WebGL backing store from the shell's CSS box times devicePixelRatio (capped at 2), so backing pixels grow with scale squared: a flat 400% on a 1080x1920 sheet would allocate roughly 132 megapixels (about 530 MB) and kill the WebView. The 16 MP budget (about 64 MB RGBA in the worst case) still admits 1:1 for every reachable working size, since the working long edge is capped at 1920 (1920x1920 = 3.69 MP, times 4 = 14.7 MP).
    - resolveMinScale(fitScale): Math.min(fitScale, 1).
    - clampZoomScale(scale, minScale, maxScale).
    - nextScalePreset(current, direction, minScale, maxScale): the first preset strictly above (direction 1) or below (direction -1) by more than epsilon, clamped into the range; returns current when there is none. This makes the boundary a no-op rather than an overshoot.
    - resolveDisplaySize(workWidth, workHeight, scale).
    - resolveZoomPercent(scale): Math.round(scale * 100).
    - resolveMaxPan(displayWidth, displayHeight, containerWidth, containerHeight): non-negative half-overflow per axis.
    - clampPanToBounds(x, y, displayWidth, displayHeight, containerWidth, containerHeight).
    - resolveCursorAnchoredPan({ containerWidth, containerHeight, displayWidth, displayHeight, panX, panY, nextDisplayWidth, nextDisplayHeight, cursorX, cursorY }): cursorX/cursorY are offsets from the container CENTER. The local fraction is (cursor + display/2 - pan) / display; the anchored pan is cursor + nextDisplay/2 - fraction * nextDisplay; the result is clamped. Center-anchored button steps are the same helper with a zero cursor, so one math path serves both.

    Store (signals `containerWidth`, `containerHeight`, `workWidth`, `workHeight`, `mode` typed `'fit' | 'absolute'`, `absoluteScale`, `panX`, `panY`; computeds `fitScale`, `minScale`, `maxScale`, `effectiveScale` (fit clamped into [minScale, maxScale], absolute clamped the same way, 0 while unmeasured), `displayWidth`, `displayHeight`, `zoomPercent`, `hasOverflow`, `isAtMin`, `isAtMax`, `isFit`, `isActualSize`). Every setter compares before writing (a repeated value writes nothing) per the reactivity skill.

    Actions:
    - setContainerSize(width, height): idempotent; re-clamp pan when it actually changes.
    - setWorkSize(width, height): idempotent; clamp absoluteScale into the new range and re-clamp pan.
    - fitToWindow(): mode 'fit', pan 0,0; leave absoluteScale untouched so returning to 1:1 is predictable.
    - actualSize(): mode 'absolute', absoluteScale = clamp(1) (1:1 is always inside the range given the budget), pan re-clamped from its current value so overflow recenters.
    - zoomIn()/zoomOut(): compute the next preset from the CURRENT effective scale, set mode 'absolute' and absoluteScale, and anchor at the container center through resolveCursorAnchoredPan with a zero cursor.
    - setZoomAtCursor(scale, cursorX, cursorY): no-op while unmeasured; clamp the target; anchor from the current display size to the next display size; write mode 'absolute', absoluteScale, and the anchored pan.
    - setPan(x, y): clamp and write.
    - resetForStudioOpen(): mode 'fit', absoluteScale 1, pan 0,0; container and work size are left for the next measurement so no size flash is introduced. Used by the viewport on mount.

    REFACTOR: remove duplication between the button stepping and cursor zoom (one anchored-pan path), keep every helper pure, and rerun the test file until green. Then run typecheck.

    Commit the test plus the module as one atomic commit (`feat(studio): add canvas zoom math and signals store`). Never push.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>The zoom module exists with the pure helpers and store described; the ten behavior groups pass; fit parity with getContainedCanvasDisplaySize is pinned; 1:1 reads 100%; the max-scale budget guarantees 1:1 for every reachable working size and refuses the 530 MB path; typecheck is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Feed the store from the mount and render the shell at its display size</name>
  <files>app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx</files>
  <action>
    Replace the FIT-ONLY sizing path with the store-driven one, keeping every pinned contract intact.

    Remove the `displaySize` useState and `setDisplaySize`. In the existing effect (line 115 onward), keep the exact declaration order, both `updateDisplaySize()` call sites, the ResizeObserver install/cleanup, the rAF/`onCanvasMounted` block, the four `recordPhysicsPaintPerformanceCounter` calls with their current names, and the closing dependency line `}, [props.height, props.width]);` verbatim. Only the body of `updateDisplaySize` changes: it still measures `region.getBoundingClientRect()` (the region is `shell.parentElement`, the tracks group), then calls `physicsPaintCanvasZoom.setWorkSize(props.width, props.height)` followed by `physicsPaintCanvasZoom.setContainerSize(rect.width, rect.height)`. Both are idempotent, so the observer callback cannot produce a render loop; the group is absolutely inset and its size does not depend on the shell, so there is no measurement feedback cycle.

    In the render body, derive the shell size from the store instead of state: read `physicsPaintCanvasZoom.effectiveScale.value`, and treat the store as measured for THIS mount only when `physicsPaintCanvasZoom.workWidth.value === props.width && physicsPaintCanvasZoom.workHeight.value === props.height` (a remount on `canvasKey` must not paint the previous layer's scale for a frame). When measured and the scale is positive, size the shell to `props.width * scale` by `props.height * scale`; otherwise leave the shell unsized and let the existing CSS caps (`height: 100%; max-width: 100%; max-height: 100%` on `.physics-paint-tracks-group > .demo-canvas-shell`) provide today's fallback.

    In the shell style spread, when sized, add `maxWidth: 'none'` and `maxHeight: 'none'` alongside width/height, because the CSS caps would otherwise clamp a zoomed shell back into the region. Do not add them unconditionally — the pre-measure fallback still relies on the caps. Change nothing else about the shell style: the aspect ratio, the paper texture custom property, and the track opacity/blend tint group stay exactly as they are.

    Do not add props, do not change the component signature, and do not touch any engine call, `paperTextureScale`, canvas width/height, or callback ref. The mount imports the store module directly (module-level store read by a narrow leaf pattern); no prop threading through the Studio memo. Then run the two pinned suites and typecheck.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>The mount reports measured container and working size to the zoom store and renders the shell from the store's effective scale, neutralizing the max caps only while sized; the pinned dependency line, its four counters, the memo identity, and every existing test are unchanged; typecheck is clean.</done>
</task>

<task type="auto">
  <name>Task 3: Clip, pan, interact, and seat the floating zoom pill</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx, app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <action>
    Create `PhysicsPaintCanvasZoomViewport.tsx` with two exports.

    `PhysicsPaintCanvasZoomViewport({ children })`: render `<div class="physics-paint-canvas-zoom-viewport" ref={viewportRef}>` containing `<PhysicsPaintCanvasZoomPanLayer>{children}</PhysicsPaintCanvasZoomPanLayer>`. On mount only, an effect calls `physicsPaintCanvasZoom.resetForStudioOpen()` (the Studio window is a fresh document per open, so this is a no-op there; it also covers a view remount inside one document). The component itself reads no signals.

    `PhysicsPaintCanvasZoomPanLayer({ children })` is the narrow leaf: it reads `panX.value` and `panY.value` and renders `<div class="physics-paint-canvas-zoom-pan" style={x || y ? { transform: 'translate(Xpx, Ypx)' } : undefined}>{children}</div>`. Emit the transform only when non-zero so the default view keeps today's DOM/stacking exactly (a transform creates a stacking context). The `children` vnode is the stable `MemoizedPhysicsPaintCanvasStack` vnode created by the view, so panning re-renders only this two-div leaf and never the memoized stack.

    One interaction effect in the viewport, deps `[]`, cleanup removing every listener and cancelling the pending frame. All handlers read the store through its action/`peek` surface, never through a render subscription.
    - A module-local one-frame coalescer inside the effect: a `pendingScale` and `pendingCursor`, a `pendingPan`, and a single `rafId`. A wheel/gesture event only updates the pending values and schedules one rAF when none is queued; the callback applies one store write and clears its state. Termination is the callback clearing the pending state and `rafId`; cleanup cancels the queued frame. Accumulate scale multiplicatively from the previously queued target so a burst does not lose steps.
    - `wheel` listener with `{ passive: false }`. When `event.metaKey || event.ctrlKey`: preventDefault and queue a cursor zoom with `factor = Math.exp(-event.deltaY * 0.0025)` clamped to [0.5, 2]. Otherwise, only while `hasOverflow` is true: preventDefault and queue a pan by `-event.deltaX`/`-event.deltaY`. In fit (no overflow) leave plain wheel alone.
    - `gesturestart` (preventDefault, record the base scale) and `gesturechange` (preventDefault, target = base times `event.scale`, curated at `event.clientX`/`clientY` with the container-center fallback used in `CanvasArea.tsx`), both `{ passive: false }`. This is the WKWebView/Safari pinch path; the ctrl+wheel branch above covers the other one.
    - Middle-button pan on the viewport with a CAPTURE-phase `pointerdown` listener: when `event.button === 1`, preventDefault and stopPropagation (the stack's own capture handler and the engine must never see it), `setPointerCapture`, record the start client point and the current pan, and set `viewport.style.cursor = 'grabbing'`. `pointermove` applies `setPan(startPan + delta)` only while dragging; `pointerup`/`pointercancel` end the drag, release capture, and restore the cursor. Add an `auxclick` preventDefault for the middle button. Do not add Space+drag: Space is playback.
    - Cursor offsets for zoom are computed at event time from `viewportRef.current.getBoundingClientRect()`, expressed as an offset from the rect center.

    Create `PhysicsPaintCanvasZoomBar.tsx`: a floating pill reading only `zoomPercent`, `isAtMin`, `isAtMax`, `isFit`, and `isActualSize`. Order: a minus icon button (lucide-preact `Minus`, size 14, `aria-label="Zoom out"`, title naming the action), the percent readout as a non-interactive span with tabular numerals and `aria-label="Zoom level"`, a plus icon button (`Plus`, size 14, `aria-label="Zoom in"`), a `Fit` text button with `aria-pressed` bound to `isFit`, and a `1:1` text button with `aria-pressed` bound to `isActualSize`. Minus is disabled at min, plus at max; every button is `type="button"` and calls only the store actions. No keydown handler and no shortcut hint beyond the button titles.

    In `PhysicsPaintStudioView.tsx`, wrap the single `<MemoizedPhysicsPaintCanvasStack {...canvas} />` in `<PhysicsPaintCanvasZoomViewport>` and keep that literal exactly once, before every picker overlay (the ordering pins at PhysicsPaintStudio.test.ts:1606 and :1723 compare `indexOf`). Render `{!pickerOpen ? <PhysicsPaintCanvasZoomBar /> : null}` as a region sibling AFTER the viewport and after the apply pill, so the pill stays inside the non-clipping region astride the pickers. Do not add hooks to the view body (the node harness invokes it as a plain function).

    CSS in `physicsPaintStudio.css`, next to the canvas region rules: `.physics-paint-canvas-zoom-viewport` gets `position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden;` — the clip lives ONLY here, never on `.physics-paint-canvas-region` (its floating dialogs and the apply pill must stay unclipped, the 52.1 lesson). `.physics-paint-canvas-zoom-pan` gets `position: absolute; inset: 0;`. `.physics-paint-canvas-zoom-bar` is an absolute pill at `left: 16px; bottom: 16px; z-index: 10` (above the sheet at auto, below the gallery picker at 20 and the dialogs at 70/72), with `display: inline-flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid rgba(255,255,255,0.09); border-radius: 999px; background: rgba(28,30,34,0.82); box-shadow: 0 8px 24px rgba(0,0,0,0.45)`, matching the apply-pill family. Buttons are 26x26 transparent circles with a hover wash, `[aria-pressed="true"]` in the Studio selected orange, and disabled at reduced opacity. The percent readout keeps a fixed min-width so the pill does not jump as digits change.

    Then create `physicsPaintCanvasZoomWiring.test.ts` (`.test.ts`, read-only source pins): the stack literal appears exactly once and inside `PhysicsPaintCanvasZoomViewport`; the bar is rendered under the `!pickerOpen` gate; the viewport rule carries the clip and the canvas-region rule is unchanged in that respect; the mount still contains the pinned dependency line and its four counters; `physicsPaintStudioKeyboard.ts` gains no zoom binding (assert it still contains none of the `'='`, `'-'`, `'+'` key arms and no `zoom` action).

    Run the focused view/studio suites and typecheck. Then write `261104-uyv-SUMMARY.md` with the architecture, the max-scale budget rationale, and these UAT rows marked PENDING (never passed): (1) the Studio opens fitted with the pill showing the fit percent; (2) 1:1 reads 100% and one working pixel maps to one CSS pixel; (3) Fit restores and keeps tracking window/panel resizes; (4) pan by middle-drag and plain wheel while zoomed, clipped at the canvas viewport; (5) Cmd/Ctrl+wheel and trackpad pinch keep the point under the cursor fixed; (6) overlays (fond, monitors, onion, reference handles, brush ring, picker visor) stay glued at zoom and pan; (7) painting at 1:1 lands under the pen; (8) Space/F/C and the tool keys behave exactly as before. Append a concise STATE.md entry (current quick 261104-uyv, awaiting live UAT) and commit the surface plus docs atomically; never push.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts src/components/physic-paint/view/PhysicsPaintStudioView.test.ts src/components/physic-paint/view/PhysicsPaintApplyProgressPill.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>The region renders a clipping viewport around the memoized stack and a floating zoom pill (minus, percent, plus, Fit, 1:1); middle-drag, plain wheel, Cmd/Ctrl+wheel, and trackpad pinch drive the store through a cancelled rAF coalescer; the views' ordering pins, the apply-pill placement pins, the mount contract, and typecheck are green; the SUMMARY and STATE.md record the quick as awaiting live UAT, with nothing pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local pointer/wheel/gesture input -> zoom store | Untrusted (but local, HID-only) event deltas cross into display state that sizes a WebGL-backed canvas. |
| zoom store -> shell CSS size | Display-only values drive layout and, through the engine's own resize path, the size of its drawing buffer. |
| zoom bar UI -> store actions | Button intents cross into the same display state; no document or persistence path is reachable. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261104-UYV-01 | Tampering | physicsPaintCanvasZoom mutators | low | mitigate | Every mutator clamps scale into [minScale, maxScale] and pan into the non-negative half-overflow before writing; values are pure numbers from local events, no store/document write path exists, and setters are compare-then-write. |
| T-261104-UYV-02 | Denial of service | engine WebGL backing store via shell size | medium | mitigate | The watercolor engine sizes its drawing buffer from the CSS box times devicePixelRatio (capped at 2), so the max scale is bounded by PHYSICS_PAINT_ZOOM_BACKING_BUDGET (16 MP, about 64 MB worst case), which still admits 1:1 for every working size (long edge capped at 1920). A flat 400% would allocate about 530 MB on a 1080x1920 sheet and kill the WebView. |
| T-261104-UYV-03 | Tampering | middle-button pointer routing | low | mitigate | A capture-phase pointerdown consumer for button 1 stops propagation before the stack's picker/block gates and the engine (which already ignores button 1); no stroke, pick, or document mutation can start from a pan gesture. |
| T-261104-UYV-04 | Information disclosure | zoom bar / percent readout | low | accept | Only a locally derived percentage is displayed; nothing is logged, persisted, sent, or added to export output. |
| T-261104-UYV-SC | Tampering | dependency installs | high | mitigate | No package installs occur in this quick; no manifest or lockfile change. |
</threat_model>

<verification>
- `pnpm --dir app run typecheck` is clean.
- `pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintCanvasZoom.test.ts` passes all ten groups.
- The pinned mount contract test passes unchanged (`}, [props.height, props.width]);`, the four counters, the memo boundary, the shell anchor), as do the sizing suite, the Studio view suite, the apply-pill placement suite, and the wiring pins.
- The full `pnpm --dir app exec vitest run` suite passes as the closing gate (run it in the background if it is slow; resume on the completion notice).
- Only the ten listed files change. No engine, document, persistence, export, working-size, paperTextureScale, or paint-data path is modified; no bare-key shortcut is added; nothing is pushed.
- Live UAT stays the user's: the SUMMARY records the eight visual rows as pending, never passed.
</verification>

<success_criteria>
- The Studio opens on the fitted sheet with a floating pill showing the contained percent; Fit restores that view and follows container resizes.
- 1:1 reads 100% and maps one engine working pixel to one CSS pixel; the sheet overflows the viewport and is clipped there.
- Cmd/Ctrl+wheel and trackpad pinch zoom about the cursor; plain wheel and middle-drag pan only while the sheet overflows; the engine never starts a stroke or a pick from a pan gesture.
- Every bounds-anchored overlay and every pointer/color-pick mapping stays exact at all zooms and pans because the shell grows in real CSS size and the pan is an ancestor translation.
- The max scale is bounded by the backing-pixel budget (1:1 always reachable, 400% only on small sheets), so zoom cannot OOM the WebView.
- The three commits are atomic, tests and typecheck are green, and UAT rows are recorded as pending.
</success_criteria>

<output>
Create .planning/quick/261104-uyv-add-studio-canvas-zoom-controls-full-zoo/261104-uyv-SUMMARY.md when done.
</output>
