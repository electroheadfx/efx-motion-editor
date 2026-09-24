---
phase: quick-260924-koa
plan: 260924-koa
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts
  - packages/efx-physic-paint/src/render/canvas.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 35000
  raw_tokens: 35000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "While a stroke is in progress, the live preview renders as a filled ribbon whose half-width follows brushRenderRadius(brushOpts) modulated per sample by pen pressure (hasPenInput) and the existing end taper — the thick/thin variation is visible along the stroke."
    - "The live preview draw performs a single fill of the ribbon polygon: it never issues stroke() or setLineDash() on the display context for the preview path."
    - "Each queued stroke awaiting finalization renders as the same sized filled ribbon computed from its own pending.opts radius, pending color/opacity and pending.hasPenInput — two queued strokes show two sized ribbons, not bare centerlines."
    - "When the stroke commits (pointer-up clears previewStroke), the next overlay pass draws no live-preview fill: the restore/composite machinery removes the transient ribbon and only the true paint plus queued ribbons remain — no leftover outline artifact."
    - "The committed stroke is pixel/geometry-identical to before this quick: finalization, applyStrokeToEngine, and the document format are untouched; the brush cursor ring/crosshair drawing is unchanged."
    - "The preview is display-overlay only: no document state, no stroke-geometry change, no per-point Image/decode — the existing ribbon() polygon is reused per draw."
  artifacts:
    - packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts — RED-first pins: live fill + pressure-varying width, no dash/stroke on the preview path, sized queued ribbon, clear-on-commit sequence (MUST end in .test.ts)
    - packages/efx-physic-paint/src/render/canvas.ts — drawStrokePreview fills the ribbon polygon with preview.color at preview.opacity; drawQueuedStrokePolyline gains a style argument and fills its own ribbon; drawDashedPath and its pathX/pathY/PreviewPathPoint helpers removed with their last caller
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts — drawQueuedStrokePreview passes the whole pending (radius via brushRenderRadius(pending.opts), color, opacity, hasPenInput) at all three redraw sites
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts — the old "draws queued points directly" pin retargeted to the sized-ribbon contract (its title pinned the defect this quick fixes)
  key_links:
    - "packages/efx-physic-paint/src/render/canvas.ts:296-305 drawStrokePreview — THE BUG SITE: already builds smooth → resample → ribbon(curve, radius, 0.8, hasPenInput) but hands the polygon to drawDashedPath, which strokes a 1.5px double dash instead of filling it."
    - "packages/efx-physic-paint/src/render/canvas.ts:289-294 drawQueuedStrokePolyline — receives points only (no radius/color), so queued strokes cannot show brush size today; its new style parameter is the contract the three engine call sites must supply."
    - "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts drawQueuedStrokePreviews / the append-only loop in render() / restoreDisplayRect's clipped redraw — the THREE sites that must pass pending (radius, color, opacity, hasPenInput); missing any one leaves a bare centerline on that path."
    - "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts overlayBoundsForPreview (m = ceil(radius)+3) — already bounds the fill: the ribbon half-width never exceeds radius, so the existing pen-up restore rect clears the filled preview with no bbox change."
    - "packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts:869-879 — existing pin asserts drawQueuedStrokePreview is called with bare points and titles it 'without smoothing or ribbon construction'; it must be retargeted in the same GREEN commit or the suite goes red."
    - "packages/efx-physic-paint/src/brush/stroke.ts:101-129 ribbon() — the pressure-varying polygon builder being reused as-is; no geometry changes allowed (committed-stroke invariance)."
    - "app/vitest.config.ts include is src/**/*.test.ts and vitest collects only *.test.ts — the new pin file is .test.ts; a .tsx target would exit 0 running nothing."
---

<objective>
Turn the in-progress and queued stroke previews from a 1.5px dashed centerline into a filled, brush-sized ribbon that tapers with pen pressure, while the stroke is still rendering/queueing — then get out of the way the moment true paint lands.

Purpose: during the render/queue window the user currently sees a hairline wire with no width and no pressure feedback; the ribbon polygon (the exact shape the brush would cover) already exists and is only being drawn with the wrong canvas primitive (outline stroke instead of fill).

Output: one new RED-first pin file, canvas.ts preview draws switched to fill (live + queued), engine call sites passing queued-stroke style, one legacy pin retargeted.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

Defect brief (quick 8): drawStrokePreview already computes smooth → resample → ribbon() but passes the polygon to drawDashedPath (canvas.ts:262-305) which strokes it as a 1.5px dashed outline; drawQueuedStrokePolyline gets points only, so queued strokes are bare centerlines with no brush size.

Guardrails from the brief: keep the queued-preview concept (no early final-pencil rendering); display overlay only — no document state, no stroke-geometry change, no change to what gets committed; cheap per frame — reuse ribbon(), no per-point Image/decode, no allocation storms in the pointer loop; existing brush cursor unchanged.

Harness notes: package tests run with `pnpm --filter @efxlab/efx-physic-paint exec vitest run <path-relative-to-package>` (never watch); typecheck is `pnpm --filter @efxlab/efx-physic-paint run check` (tsc --noEmit). Vitest collects only *.test.ts. Engine tests use the Object.create(EfxPaintEngine.prototype) + Object.assign harness pattern (see EfxPaintEngine.pointerInput.test.ts). The user runs the dev server and native UAT themselves — do not start any server.

Existing behavior that already helps and must NOT be churned: overlayBoundsForPreview pads by ceil(radius)+3 (covers the fill); restoreDisplayRect restores from the wet scratch then redraws queued + live previews clipped (single redraw, so preview alpha cannot accumulate); pointer-up sets previewStroke = null and the pen-up branch restores lastPreviewBbox.
</context>

<tasks>

<task type="auto">
  <name>Task 1: RED — pin filled pressure-varying preview, sized queued ribbon, clear-on-commit</name>
  <files>packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts</files>
  <action>Create the pin file BEFORE any production edit. Build a recording mock CanvasRenderingContext2D helper: vi.fn() for beginPath/moveTo/lineTo/closePath/fill/stroke/setLineDash/save/restore/clearRect, capturing the current path's vertices on moveTo/lineTo and snapshotting that path into a fills[] array on fill() and a strokes[] array on stroke(); record any setLineDash argument into a dashes[] array; plain writable lineWidth/fillStyle/strokeStyle/globalAlpha properties. Leg 1 — live preview fills: call drawStrokePreview(ctx, {pts, color: '#123456', opacity: 0.8, radius: 10, hasPenInput: true}) with ≥6 PenPoint samples along a horizontal line and pen pressures varying (e.g. p = 0.2, 0.4, 0.9, 1.0, 0.5, 0.8; tx/ty/tw/spd = 0); assert fills.length ≥ 1, strokes.length === 0, and dashes.length === 0. Leg 2 — pressure-derived width: from the captured fill polygon split vertices into left/right halves (ribbon() returns L then reversed R) and compute per-index width = |L_i − R_i|; run the same geometry twice, once with hasPenInput: true and varying p and once with hasPenInput: false (uniform width), and assert the mid-stroke width of the pen run is at least 2× the mid-stroke width of the uniform run at the same index (pins per-point pressure feeding the fill geometry, not a constant lineWidth). Also assert the fillStyle/globalAlpha applied equal the preview's color and opacity. Leg 3 — sized queued ribbon: call drawQueuedStrokePolyline(ctx, points, style) where style = { radius: 10, hasPenInput: true, color: '#123456', opacity: 0.8 } over a straight horizontal 4-point stroke; assert a fill occurred, no stroke/setLineDash occurred, and max |vertex.y − 50| over the fill polygon ≥ 5 (half-width at brush radius 10; the old centerline draw yields 0). At base this signature does not accept style and draws a dashed bare line, so legs 1-3 fail — that is the RED. Leg 4 — clear-on-commit sequence: on a fresh recording ctx, drawStrokePreview with a live preview (assert a fill was recorded), then simulate commit exactly as the engine does: call ctx.clearRect(0,0,120,80) (what compositeDisplayNow starts with), call drawStrokePreview(ctx, null), then drawQueuedStrokePolyline(ctx, queuedPoints, style); assert exactly one fill occurred after the clearRect marker and it is the queued ribbon (the live preview contributes nothing post-commit). Leg 5 — engine control: using the Object.create(EfxPaintEngine.prototype) harness, assign state: {drawing: true}, previewStroke: {pts: [...], color, radius, opacity}, rawPts of 2 short points, pendingExplicitPreviewBase: null, performanceListener: null, nextMutationId: 1, inputLocked: false, dualCanvas: {dryCanvas: {releasePointerCapture: vi.fn()}}, onInputActivity: undefined, getStrokeMetadata: undefined, and call engine.onPointerUp(pointerEventLike with timeStamp/buttons/pointerId/preventDefault); assert engine.previewStroke === null (pins that pointer-up clears the live preview state the restore path relies on; green at base as the control leg). Run the file and capture RED evidence: `pnpm --filter @efxlab/efx-physic-paint exec vitest run src/render/canvas.strokePreviewRibbon.test.ts` — legs 1-3 (and 4's first fill assertion) MUST fail, leg 5 passes; commit the RED file alone with the RED evidence in the message. Do not edit any production file in this task.</action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-physic-paint exec vitest run src/render/canvas.strokePreviewRibbon.test.ts</automated>
  </verify>
  <done>Pin file committed; run output shows the fill/queued-width legs failing at base with the fill expectation unmet (strokes/dashes recorded instead), the clear-on-commit leg failing on its first fill assertion, and the engine pointer-up control leg passing; no production file modified.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — fill the live ribbon, size the queued ribbon, retarget the legacy pin</name>
  <files>packages/efx-physic-paint/src/render/canvas.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts</files>
  <behavior>
    - Task 1 legs 1-4 go green: preview path issues fill() with the ribbon polygon at preview.color/preview.opacity, zero stroke()/setLineDash() on that path; the fill polygon's width tracks per-point pressure; queued draw fills a ribbon reaching ≥5px off-centerline at radius 10; post-clear sequence records only the queued fill.
    - EfxPaintEngine.cooperativeFinalization.contract.red.test.ts queued-outline pin passes with the new signature (pending object, not bare points) and a title describing the sized-ribbon contract.
    - drawDashedPath and its PreviewPathPoint/pathX/pathY helpers have zero remaining references in packages/efx-physic-paint/src.
  </behavior>
  <action>In canvas.ts drawStrokePreview, keep the existing smooth → resample(Math.max(3, radius*0.25)) → ribbon(curve, preview.radius, 0.8, preview.hasPenInput ?? false) pipeline unchanged and replace the drawDashedPath call with a single polygon fill: save, beginPath, moveTo/lineTo over the ribbon vertices, closePath, fillStyle = preview.color, globalAlpha = preview.opacity, fill, restore; early-return before any ctx call when the ribbon array has fewer than 2 vertices. Extend drawQueuedStrokePolyline with a third parameter style: {radius: number, hasPenInput: boolean, color: string, opacity: number} and implement it with the same pipeline as the live path (smooth(pts, 2), resample with Math.max(3, radius * 0.25), ribbon(curve, radius, 0.8, hasPenInput)) filled with style.color at style.opacity — it must produce the identical shape family as drawStrokePreview so live and queued previews read as the same object before/after handoff; keep the exported function name so import churn stays at zero. Once both callers fill, drawDashedPath plus its PreviewPathPoint, pathX, pathY helpers have no remaining users — remove them in the same edit (leave dead helpers and the suite's source-shape expectations drift). In EfxPaintEngine.ts change the private drawQueuedStrokePreview to accept the whole pending: DeferredStrokeFinalization instead of points, deriving radius = brushRenderRadius(pending.opts), color = pending.tool === 'paint' ? pending.color ?? '#000000' : pending.tool === 'erase' ? '#ff4444' : '#888888' (mirroring the previewStroke color rule at the pointer-move site), opacity = pending.tool === 'paint' ? (pending.opts.opacity ?? 100) / 100 : 0.3 (mirroring previewStroke.opacity), and hasPenInput = pending.hasPenInput; update ALL THREE call sites to pass the pending object — drawQueuedStrokePreviews' loop, the append-only queued branch inside render() (currently queued[i].points), and restoreDisplayRect's clipped redraw loop (currently pending.points). Do not touch compositeDisplayNow, overlayBoundsForPreview, drawBrushCursor, acceptStroke, or any finalization/apply path. In EfxPaintEngine.cooperativeFinalization.contract.red.test.ts rewrite the test titled 'draws queued points directly without smoothing or ribbon construction during the idle window' — retitle it to the sized-ribbon contract and assert drawQueuedStrokePreview is called with (ctx, the pending object) via NthCalledWith(1, expect.anything(), engine.pendingStrokeFinalizations[0]) (same for call 2); do not weaken any other assertion in that file. Then run the new pin file and the touched engine suite: both green.</action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-physic-paint exec vitest run src/render/canvas.strokePreviewRibbon.test.ts src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts src/engine/EfxPaintEngine.pointerInput.test.ts</automated>
  </verify>
  <done>New pin file fully green (all 5 legs); cooperativeFinalization suite green with the retargeted title/assertions; pointerInput suite green (pointer-up preview clearing unchanged); grep over packages/efx-physic-paint/src shows zero references to drawDashedPath.</done>
</task>

<task type="auto">
  <name>Task 3: Full suite, typecheck, hand off to native UAT</name>
  <files>packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts, packages/efx-physic-paint/src/render/canvas.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts</files>
  <action>Run the whole package suite to catch any other suite that read drawQueuedStrokePolyline's old arity or the dashed-preview source shape: `pnpm --filter @efxlab/efx-physic-paint exec vitest run`. If a failure asserts the pre-quick dashed/bare-centerline behavior that this quick intentionally changes, retarget that assertion to the sized-ribbon contract in the same way as the cooperativeFinalization pin (never weaken the new Task 1 pins); if a failure is unrelated collateral, fix it only when it is a direct consequence of this edit and record the file in the return message. Run `pnpm --filter @efxlab/efx-physic-paint run check` (tsc --noEmit) and fix any type error introduced by the new style parameter (the RED run executed without typechecking — expect the signature to typecheck only now). Run the app suite once as the cross-package guard: `pnpm --filter efx-motion-editor exec vitest run` (app imports the workspace package; the export set did not change, so this is a confirm-nothing-moved gate). Do not start any server and do not claim done — surface the four native UAT rows from the brief in the return message (pressure ribbon visible live; sized preview during render window then replaced by true paint with no leftover artifact; two queued strokes both sized; committed stroke + cursor ring unchanged). Commit atomically with a message noting automated-ready + native UAT pending.</action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-physic-paint exec vitest run && pnpm --filter @efxlab/efx-physic-paint run check && pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>Package suite fully green including the new pin file; package tsc --noEmit clean; app suite green; no server started; return message lists the 4 native UAT rows as pending; work described as automated-ready only, not done.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| pointer → display overlay | Pen/pointer samples influence only what is painted on the display canvas overlay during the render/queue window; nothing here crosses into document persistence or the finalization pipeline. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-koa-01 | Tampering | EfxPaintEngine finalization / applyStrokeToEngine | high | accept | This quick edits display-preview draw code only; Task 2 action explicitly forbids touching acceptStroke/finalization/apply, and Task 3's full-suite gate plus the committed-stroke invariance must_have catch accidental bleed. |
| T-koa-02 | Denial of Service | drawStrokePreview / drawQueuedStrokePolyline per-frame path | medium | mitigate | Reuse the existing smooth/resample/ribbon pipeline and a single fill per draw; no Image/createImageBitmap/decode and no per-point allocation beyond the ribbon polygon already allocated today (guardrail carried in must_haves). |
| T-koa-03 | Info Disclosure | none applicable | low | accept | Pure local rendering change; no data leaves the process, no new inputs, no secrets touched. |
| T-koa-SC | Tampering | npm/pip/cargo installs | high | accept | This quick installs no packages — no package-manager command appears in any task; no legitimacy checkpoint required. |
</threat_model>

<verification>
1. RED gate (Task 1): `pnpm --filter @efxlab/efx-physic-paint exec vitest run src/render/canvas.strokePreviewRibbon.test.ts` fails at base on the fill/queued-width legs (evidence captured before any production edit).
2. GREEN gate (Task 2): same command plus `src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts src/engine/EfxPaintEngine.pointerInput.test.ts` all green.
3. Full gate (Task 3): `pnpm --filter @efxlab/efx-physic-paint exec vitest run && pnpm --filter @efxlab/efx-physic-paint run check && pnpm --filter efx-motion-editor exec vitest run` — all green, tsc clean.
4. Source sweep: zero references to drawDashedPath remain under packages/efx-physic-paint/src.
5. Native UAT (user, after GREEN): the 4 rows in the brief — live pressure ribbon; sized preview during render window then replaced by true paint with no leftover; two queued strokes both sized; committed stroke pixels + cursor ring unchanged.
</success_criteria>
- All automated gates above green; automated-ready declared (never "done" before live UAT).
- The in-progress stroke is a brush-sized, pressure-tapering filled ribbon on screen during the render window, and queued strokes match it.
- Committed stroke output and the brush cursor are byte-for-byte unchanged from before the quick; no server was started by the executor.
</success_criteria>

<output>
Create `.planning/quick/260924-koa-quick-8-stroke-preview-as-a-pressure-var/260924-koa-SUMMARY.md` when done, including RED evidence and the 4 pending native UAT rows.
</output>
