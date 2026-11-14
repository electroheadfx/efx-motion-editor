---
phase: 261107-tfp-ui-boundaries-from-phase-59-rail-motion-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/railMotionPivot.ts
  - app/src/components/physic-paint/roto/railMotionPivot.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
autonomous: true
requirements: [QUICK-261107-TFP]
user_setup: []

estimate:
  tokens: 55000
  raw_tokens: 55000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "With a Motion block open and a non-opacity channel selected, the canvas boundary box hugs the painted (alpha) content of the drawing key displayed at the playhead instead of enclosing the whole project frame."
    - "Moving the playhead to another drawing key of the same rail re-fits the box to that key's ink; a generated in-between uses the union of its two flanking source keys."
    - "A displayed key with no measured alpha ink (empty key, undecoded raster, unreachable source) falls back to today's full-raster box; the box always renders when it renders today."
    - "The box stays aligned with the composited paint under Position/Scale/Rotation because it applies the compositor's own pivot and op order, and the gesture bodies (interior move, corner scale, rotation knob) keep their current mapping."
    - "Ink measurement is memoized per rail + raster revision and shared with the existing pivot measurement, so the change adds no second alpha scan and no per-frame pixel work."
    - "The gizmo still appears only in animate mode (open block + present channel + cursor inside the rail span); no other Motion UI, CSS, store field or persistence path changes."
  artifacts:
    - path: "app/src/components/physic-paint/roto/railMotionPivot.ts"
      provides: "Per-key ink boxes and a union helper served from the SAME bounded memo that already resolves the rail pivot"
    - path: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts"
      provides: "getRailMotionBounds — the pivot-based mirror of the compositor's translate/rotate/scale op order"
    - path: "app/src/stores/physicPaintStore.ts"
      provides: "getRotoRailMotionCanvasInk(layerId, trackId, frame) — the displayed key's normalized ink box plus the compositor pivot"
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
      provides: "The gizmo payload's inkBase field and its primitive signature terms"
    - path: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx"
      provides: "Rail-motion bounds dispatch: ink base when measured, full-raster fallback otherwise"
  key_links:
    - from: "railMotionGizmo computed (useRotoTimelineActions)"
      to: "physicPaintStore.getRotoRailMotionCanvasInk"
      via: "one call at state.cursorFrame, after the availability gate"
    - from: "getRotoRailMotionCanvasInk"
      to: "resolveRailMotionKeyInkBounds / computeRailInkBounds"
      via: "the shared railId + rasterRevision memo that _trackMotionTransformAtFrame's pivot already populates"
    - from: "PhysicsPaintReferenceTransformHandles rail-motion bounds"
      to: "getRailMotionBounds"
      via: "the payload pivot and normalized base rect; a null inkBase keeps getReferenceBounds byte-identical"
---

<objective>
Make the Studio rail-motion boundary box hug the painted (alpha) content of the drawing key displayed at the playhead, per key, instead of enclosing the full project raster.

Purpose: today the rail gizmo's base rect is `getReferenceBounds(transform, imageWidth, imageHeight, …)` with `imageWidth/Height` = the whole project frame, so the box is always the size of the canvas even when the painted layer covers a small part of it. The key displayed at the cursor is a normal project-sized raster whose alpha only covers the paint; the Phase 59-08 bounded alpha scanner (`measureRailMotionRasterInk`) already measures exactly that, but only the rotation pivot consumes it. This plan exposes per-key ink boxes from the same memo and feeds the displayed key's box to the gizmo.

Output: `getRailMotionBounds` (pivot-exact geometry in `PhysicsPaintReferenceTransform.ts`), `resolveRailMotionKeyInkBounds` + `unionRailInkBoxes` in `railMotionPivot.ts`, `getRotoRailMotionCanvasInk` in the store, an `inkBase` field on the gizmo payload, and the bounds dispatch in the handles component. The full-raster fallback and every gesture body stay untouched.

Locked decisions (do not revisit):
- D-01: the base rect is the DISPLAYED drawing key's ink at the cursor frame — not the rail's union, not the layer bounds, not the project frame. A generated in-between uses the union of its two flanking source keys.
- D-02: when no ink can be measured (empty key, undecoded raster, missing render source, no bound rail), the box falls back to today's `getReferenceBounds` full-raster geometry, unchanged.
- D-03: the box applies the compositor's pivot and op order (`translate(pivot + offset) → rotate → scale → translate(-pivot)`), so it rotates and scales exactly like the composited paint. `getReferenceBounds`, `getBackgroundBounds`, `transformBoundsCore` and `buildRailMotionEditCss` are not modified.
- D-04: reuse the Phase 59-08 scanner and memo. No new pixel API in the store (P4(c)), no per-frame scan, no image decode.
- D-05: no new UI, no CSS, no gesture-semantics change, no new persisted field, no new signal.

Scope notes: the gizmo mount and the animate-mode gate are unchanged; only the base rect changes. No tracer task applies — this fixes the geometry of an existing end-to-end path rather than opening a new architectural slice. `workflow.tdd_mode` is on: each task states the pins before the code.

Command grounding: `<automated>` commands assume cwd at the repo root; vitest paths are app-relative because the vitest root is `app/`. Never run Vitest in watch mode; never start the dev server.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Verified anchors at HEAD 093f16f76 (the only baseline this plan changes):

- `app/src/components/physic-paint/roto/railMotionInkScan.ts` (29-78): `measureRailMotionRasterInk(source, sourceWidth, sourceHeight)` draws an already-decoded raster into a 256px-long-edge offscreen canvas and returns `{ x, y, width, height, alphaInk }` normalized 0..1. `alphaInk: false` means no ink; `null` means the raster/context was unavailable.
- `app/src/components/physic-paint/roto/railMotionPivot.ts`: `RailMotionInkBounds` (24), `RailMotionMeasuredInk` (36), `RAIL_MOTION_PIVOT_FALLBACK` (46), memo map (76-77), `__resetRailMotionPivotMemoForTests` (80), `computeRailInkBounds` (96), `resolveRailMotionPivot` (134). Input is `{ railId, contentRevision, sources: readonly TSource[], measure }`; the memo key is `${railId}:${contentRevision}` with a 512-entry FIFO.
- `app/src/stores/physicPaintStore.ts`: `_resolveRotoRailMotionProjection` (1223), `_railMotionViewAtFrame` (1276), `_measureRotoDrawingKeyInk` (1301, alpha-canvas registry then decode LRU, delegates to the scanner), `_trackMotionTransformAtFrame` (1335-1365 — resolves the view at `contentFrame`, calls `resolveRailMotionPivot` with `view.keyIds → structural.recordMap`), `getRotoPhysicalTrackMotionTransform` (3844), `getRotoPhysicalRenderSource` (5561 — returns `kind: 'real'` with `keyId`, `kind: 'generated'` with `leftKeyId/rightKeyId`, `kind: 'loop-placeholder'`, or null). `structural.rasterRevision` is the pixel-identity revision; `structural.recordMap` holds the real key records.
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts`: `transformBoundsCore` (34), `getReferenceBounds` (72), `getBackgroundBounds` (89), `buildRailMotionEditCss` (109-124 — the compositor op order in CSS form: `translate(pivot + offset) rotate scale translate(-pivot)`).
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx`: rail-motion payload interface (80-95), handles props (97-108), the rail-motion `imageSize` branch (168-174 — sets project size = width/zoom, height/zoom), the bounds dispatch (293-295), and the gesture bodies (`applyMove` 430, `applyScale` 443, `applyRotation` 491 — all consume `state.startBounds.center`, no change).
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`: `RailMotionGizmoBundle` (2192), `railMotionGizmo` computed (2570-2650 — availability gate at 2591-2599, frozen payload at 2604-2649, primitive signature array at 2622-2637 including the pinned `selectedChannel,` term).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`: gizmo prop mount (10106-10115); `railMotionEditTransform` (9992-10006) already proves the store pivot path is the edit-view authority.
- Existing pins that must stay green or be updated intentionally: `app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts` (gizmo gate strings incl. `selectedChannel,`), `app/src/components/physic-paint/roto/railMotionCommands.test.ts:1490-1520` (one `writeMotionTransformAtCursor`, target union, three handles mounts, no `'opacity'` literal in the handles file), `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` (`getReferenceBounds` / `transformBoundsCore` still exported), `app/src/lib/paperPass.frameGuard.test.ts` P4(c) (no `getImageData`/`putImageData` in the store).
- Test harness facts: `app/src/components/physic-paint/roto/railMotionInkScan.test.ts` shows the node-environment fake-`document` pattern; `app/src/lib/rotoAlphaCanvasRegistry.ts` exports `registerRotoAlphaCanvasFrame(bytes, canvas)` (requires width/height > 0) and `rotoAlphaCanvasRegistry`; `app/src/stores/physicPaintStore.rotoRailMotions.test.ts` has `cycleRecords()` (keys A..E at frames 0..4), `railMotion(railId, anchorKeyId)`, `seedMotionDocument`-style `replaceRotoPhysicalDocument` seeding, and `record()` payloads built from `testWebpBytes`.

Project skill: `efx-preact-reactivity` — the hook change is one extra plain store read inside the existing computed (which already subscribes through `getTrackRotorRevision(...).value`); no useState, no render-body write, no new signal, no effect. The handles read the payload as props; the draft signal path is untouched.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — pin the per-key ink boxes and the pivot-exact gizmo geometry</name>
  <files>app/src/components/physic-paint/roto/railMotionPivot.test.ts, app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts</files>
  <behavior>
    - `unionRailInkBoxes([])` returns null; non-finite and zero/negative-size boxes are ignored; two boxes union to `{ x: min x, y: min y, width: rightMin − min x, height: bottomMin − min y }`; the result is frozen and clamped to nothing (no 0..1 clamp — the union only shrinks, the pivot helper keeps its own clamp).
    - `resolveRailMotionPivot` keeps every existing assertion (one measure per source per rail+revision, zero measures on a memo hit, `toBe` identity on the pivot object, blank key contributes no bounds, `measured: false` fallback) but its input sources become `{ keyId, source }` pairs.
    - `resolveRailMotionKeyInkBounds` on the same input returns a `ReadonlyMap` keyed by `keyId` containing ONLY keys whose scan found ink; blank keys and `null` measurements are absent.
    - The pivot and the key-ink map share one memo: calling `resolveRailMotionPivot` then `resolveRailMotionKeyInkBounds` for the same rail and revision measures each source exactly ONCE; a different `contentRevision` re-measures.
    - `getRailMotionBounds(transform, baseRect, pivotX, pivotY, projectWidth, projectHeight, zoom)` — identity transform, project 1000×800, zoom 1, base `{x:0.25, y:0.25, width:0.5, height:0.5}`, pivot 0.5/0.5 → corners (250,200), (750,200), (750,600), (250,600), center (500,400).
    - Position (100, −50) shifts all four corners by that amount and the center to (600,350); scale 2 about pivot 0.5/0.5 maps TL (250,200) to (0,0) and BR (750,600) to (1000,800) with an unchanged center; rotation 90° about pivot 0.5/0.5 maps TL (250,200) to about (700,150); pivot 0.25/0.25 (project px 250,200) with rotation 90° keeps a corner that sits exactly on the pivot fixed at (250,200) and maps (750,600) to about (50,450).
    - Zoom 0.5 halves every working coordinate, including the center; a full-frame base `{x:0, y:0, width:1, height:1}` with pivot 0.5/0.5 reproduces `getReferenceBounds` corner-for-corner for the same transform (regression guard for the fallback equality).
  </behavior>
  <action>
In `app/src/components/physic-paint/roto/railMotionPivot.test.ts`: update every `resolveRailMotionPivot` fixture to pass sources as `{ keyId, source }` objects (the injected `measure` keeps receiving the `source` field), keeping all existing describes and Gate D intact. Add a `unionRailInkBoxes` describe and a `resolveRailMotionKeyInkBounds` describe with the cases from `<behavior>`, including the shared-memo measurement-count assertion (pivot call then boxes call on the same input must leave the `vi.fn` call count unchanged). Add an import for the two new exports. Do not weaken or delete an existing assertion.

In `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts`: add a `getRailMotionBounds (261107 live UAT)` describe with the exact hand-computed numbers from `<behavior>`, plus the full-frame-equivalence case that compares `getRailMotionBounds` corners against `getReferenceBounds` for an identical transform. Keep every existing `getReferenceBounds` and `buildRailMotionEditCss` assertion byte-unchanged.

Run both files and confirm they FAIL because `unionRailInkBoxes`, `resolveRailMotionKeyInkBounds` and `getRailMotionBounds` do not exist yet (and because the keyed source shape is not accepted), not because of syntax errors. Do not implement the modules in this task.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPivot.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts</automated>
  </verify>
  <done>The two test files contain the new pins and fail only for the missing exports / unaccepted source shape; every pre-existing assertion in both files is preserved (sources updated to the keyed shape in the pivot file).</done>
  <reversibility rating="reversible">Tests only; no production file is touched in this task.</reversibility>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — per-key ink boxes in the shared memo and the pivot-exact rail-motion bounds</name>
  <files>app/src/components/physic-paint/roto/railMotionPivot.ts, app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts, app/src/stores/physicPaintStore.ts</files>
  <behavior>
    - The pivot module stays pure: no store, DOM, canvas or evaluator import (the existing source-scan pin in `railMotionPivot.test.ts` must stay green).
    - `resolveRailMotionPivot` keeps its exact return shape (`{ pivotX, pivotY, measured }`, frozen, memo-identity stable) while internally sharing one cache entry with the per-key boxes.
    - `resolveRailMotionKeyInkBounds` returns the memoized `ReadonlyMap<keyId, RailMotionInkBounds>` for the same rail + revision; the map is only built once per revision and only alpha-ink keys appear.
    - The memo remains bounded (512 FIFO) and `__resetRailMotionPivotMemoForTests` clears both views of the cache.
    - `getRailMotionBounds` mirrors the compositor op order exactly and returns a `LayerBounds` whose `center` is the TRANSFORMED PIVOT, so the scale/rotate gestures reference the same anchor the compositor uses; `getReferenceBounds`, `getBackgroundBounds`, `transformBoundsCore` and `buildRailMotionEditCss` are unchanged.
    - The store's `_trackMotionTransformAtFrame` pivot call keeps its previous behavior and measurement count; only the input shape changes.
  </behavior>
  <action>
In `app/src/components/physic-paint/roto/railMotionPivot.ts`:
- Add `export interface RailMotionInkSource<TSource> { readonly keyId: string; readonly source: TSource; }` and change `ResolveRailMotionPivotInput.sources` to `readonly RailMotionInkSource<TSource>[]`. `measure` still receives the `source` member.
- Replace the memo value with a cached entry holding both `pivot: RailMotionPivot` and `boxes: ReadonlyMap<string, RailMotionInkBounds>`. Keep the key `${railId}:${contentRevision}`, the 512-entry FIFO, the `_railMotionPivotMemo` name and `__resetRailMotionPivotMemoForTests`.
- Extract one internal resolver that measures each source once (skip `null`, skip `alphaInk === false`), stores a frozen `{ x, y, width, height }` per `keyId`, and computes the pivot through the unchanged `computeRailInkBounds`. `resolveRailMotionPivot` returns the cached pivot object (identity-stable); the new `resolveRailMotionKeyInkBounds(input)` returns the cached boxes map.
- Add `export function unionRailInkBoxes(bounds: readonly RailMotionInkBounds[]): RailMotionInkBounds | null` — skip non-finite and degenerate boxes, return a frozen union box, or null when nothing remains. Do NOT change `computeRailInkBounds`, `RAIL_MOTION_PIVOT_FALLBACK`, the clamp, or any doc comment contract.

In `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts`: add `export function getRailMotionBounds(transform: PhotoReferenceTransform, baseRect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, pivotX: number, pivotY: number, projectWidth: number, projectHeight: number, zoom: number): LayerBounds`. Compute pivotPx = (pivotX × projectWidth, pivotY × projectHeight); scale the normalized base rect into project pixels; for each TL/TR/BR/BL corner compute dx = (cornerX − pivotPx.x) × transform.scaleX and dy = (cornerY − pivotPx.y) × transform.scaleY, then qx = zoom × (pivotPx.x + transform.x + dx·cos − dy·sin) and qy = zoom × (pivotPx.y + transform.y + dx·sin + dy·cos) with rad = transform.rotation × π/180. Return corners in TL/TR/BR/BL order, `center` = zoom × (pivotPx + transform.x/transform.y) — the transformed pivot, deliberately not the box centroid — and `drawW/drawH` = baseRect.width × projectWidth × zoom / baseRect.height × projectHeight × zoom. Document that the order is the compositor's `applyEfxPaintTrackMotion` / `buildRailMotionEditCss` chain. Do not touch the three existing functions.

In `app/src/stores/physicPaintStore.ts`: change ONLY the `resolveRailMotionPivot` call inside `_trackMotionTransformAtFrame` so its sources are `view.keyIds` records mapped to `{ keyId: record.keyId, source: record }`. No other behavior change in this task.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPivot.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts</automated>
    <automated>pnpm --dir app run typecheck</automated>
  </verify>
  <done>Both Task 1 test files are green; the pivot result shape and identity are unchanged; the boxes map is shared with the pivot memo; `getRailMotionBounds` matches the compositor op order and the full-frame equivalence case; typecheck is clean.</done>
  <reversibility rating="reversible">Pure functions plus one call-site shape change; the compositor and the pivot math are untouched.</reversibility>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire the displayed key's ink into the gizmo and keep the full-raster fallback</name>
  <files>app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.rotoRailMotions.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx</files>
  <behavior>
    - `physicPaintStore.getRotoRailMotionCanvasInk(layerId, trackId, frame)` returns `{ base, pivotX, pivotY } | null`: `base` is the displayed drawing key's normalized ink box (a real/loop-occurrence key → its own box; a generated in-between → the union of its two flanking keys), or null when nothing is measurable; `pivotX/pivotY` is the union-ink centre over the rail view's keys with the existing 0.5/0.5 fallback.
    - The getter returns null when there is no structural entry, no rail motion on the track, no view covering the frame, no bound railId, or a negative/non-finite frame.
    - The getter measures nothing per frame: repeated calls for the same rail revision return the SAME `base` object (memo identity from Task 2's shared cache).
    - The gizmo payload gains `inkBase: { bounds, pivotX, pivotY } | null`, built from the getter at `state.cursorFrame`; the signature array gains primitive ink-base terms so the canvas-stack memo re-resolves on a key/ink change. The existing gates, `selectedChannel,`, the evaluated values, `interiorInteractive`, `commit` and `report` are unchanged.
    - The handles use `getRailMotionBounds` only when `inkBase` is present; otherwise they call `getReferenceBounds` exactly as today. The rail-motion `imageSize` effect, the early-return gate, the gesture bodies, the rotation knob and the SVG markup are untouched.
    - The store integration test proves per-key ink: a seeded cycle whose key A and key B carry distinct ink and whose key C carries none returns A's box at frame 0, B's box at frame 1, and a null base at frame 2 with an unchanged pivot equal to the union of A and B.
  </behavior>
  <action>
RED first, in `app/src/stores/physicPaintStore.rotoRailMotions.test.ts`: add a new describe (do not edit or reuse the existing helpers destructively) that seeds `replaceRotoPhysicalDocument` with `cycleRecords()` and a `railMotion('rail-1', 'A')` collection through `buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], [], [], railMotions)`, mirroring the file's existing `seedMotionDocument` shape, then registers per-key fake alpha canvases with `registerRotoAlphaCanvasFrame(payload.bytes, { width: 100, height: 100 } as unknown as HTMLCanvasElement)` and stubs `document` with the fake-canvas pattern from `railMotionInkScan.test.ts` (the fake `drawImage` records the source; `getImageData` fills alpha only inside that source's region). Use regions: key A cols/rows 10..29 → box {0.1, 0.1, 0.2, 0.2}; key B 40..59 → {0.4, 0.4, 0.2, 0.2}; keys C/D/E fully transparent. Assert the frame-0 box, the frame-1 box, the frame-2 null base, the pivot (0.35, 0.35 from the A∪B union), the null return after `replaceRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID, [])`, and the repeated-call `base` identity. Call `vi.unstubAllGlobals()` in `afterEach`. Confirm the new rows fail because the getter does not exist.

Then in `app/src/stores/physicPaintStore.ts`, add the public getter `getRotoRailMotionCanvasInk(layerId, trackId, frame)` beside `getRotoPhysicalTrackMotionTransform`: resolve the structural entry (return null when absent or `railMotions.length === 0`), floor the frame (return null when not finite or negative), resolve the projection and the view through `_resolveRotoRailMotionProjection` + `_railMotionViewAtFrame` at the floored frame (return null without a view or bound railId), build sources from `view.keyIds` through `structural.recordMap`, call `resolveRailMotionKeyInkBounds` with `structural.rasterRevision` and `_measureRotoDrawingKeyInk`, compute the pivot with the unchanged `computeRailInkBounds` over the map values, resolve the displayed key ids through `this.getRotoPhysicalRenderSource(layerId, trackId, contentFrame)` (`'real'` → its `keyId`; `'generated'` → `leftKeyId` and `rightKeyId`; anything else → none), and return the frozen `{ base, pivotX, pivotY }` where `base` is `unionRailInkBoxes` over the displayed keys' memoized boxes. Add the imports for the new pivot exports; add no pixel-array API to the store (P4(c) stays green).

In `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`: inside the `railMotionGizmo` computed, after the availability gate and before the frozen payload, call `physicPaintStore.getRotoRailMotionCanvasInk(state.layerId, state.trackId, state.cursorFrame)` and add `inkBase` to the payload — null when the getter is null or its `base` is null, otherwise a frozen `{ bounds: Object.freeze({ x, y, width, height }), pivotX, pivotY }`. Append primitive terms for the base box and the pivot to the `signature` array (a `'full'` sentinel when null) without reordering or removing any existing term, so `selectedChannel,` stays a literal line.

In `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx`: add `export interface PhysicsPaintRailMotionInkBase { readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }; readonly pivotX: number; readonly pivotY: number; }` and `readonly inkBase: PhysicsPaintRailMotionInkBase | null;` to `PhysicsPaintRailMotionGizmoProps` with a doc comment stating the bounds are normalized to the project raster and the pivot is normalized like the compositor's. Import `getRailMotionBounds`. Change only the bounds dispatch: background keeps `getBackgroundBounds`; rail-motion with a non-null `inkBase` calls `getRailMotionBounds(transform, railMotion.inkBase.bounds, railMotion.inkBase.pivotX, railMotion.inkBase.pivotY, imageSize.value.w, imageSize.value.h, zoom)`; every other case keeps `getReferenceBounds(transform, imageSize.value.w, imageSize.value.h, zoom, width, height)`. Do not add the literal `'opacity'` to this file, do not edit the gesture bodies, and do not touch the rail-motion `imageSize` effect.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.rotoRailMotions.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPivot.test.ts src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/roto/railMotionCommands.test.ts src/components/physic-paint/view/railMotionBoundaryTool.test.ts src/lib/paperPass.frameGuard.test.ts</automated>
    <automated>pnpm --dir app run typecheck</automated>
  </verify>
  <done>The gizmo payload carries the displayed key's ink box and the compositor pivot; the handles use them for the rail-motion bounds and keep the full-raster fallback; the seeded store test proves per-key boxes, the generated-in-between union path, the null base for an ink-less key, the union pivot, the null when motion is removed, and memo identity; the contract suites (Studio pins, motion commands, boundary tool, P4(c)) and typecheck are green.</done>
  <reversibility rating="reversible">One additive store getter, one additive payload field and one bounds branch; deleting them restores today's full-raster gizmo exactly.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| decoded artwork raster -> gizmo geometry | A bounded alpha scan of local pixels now sizes a UI overlay; a wrong box or an unnecessary per-frame scan degrades the editing surface. |
| store state -> preact computed -> DOM | The gizmo payload is rebuilt inside a computed read on the Studio render path; a render-body write or a new signal could loop the reactivity graph. |
| motion pivot -> gesture commit | The box's center feeds the existing scale/rotation gesture math; the committed motion values must stay identical in meaning. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261107-TFP-01 | Denial of Service | `getRotoRailMotionCanvasInk` on the render path | medium | mitigate | The scan reuses the Phase 59-08 bounded 256px measurer and is memoized per rail + raster revision in the SAME cache the compositor's pivot already populates; the getter resolves at most one displayed key plus the rail's key map per revision, never per evaluated frame; the store gains no pixel-array API (P4(c) pinned). |
| T-261107-TFP-02 | Information Disclosure | alpha ink scan of user artwork | low | accept | The scan is local, in-memory and downsampled; the normalized box is never persisted, never written into the `.mce` document, never sent over IPC and never exported. |
| T-261107-TFP-03 | Tampering | gizmo bounds vs. committed motion values | low | mitigate | Only the base rect and the gesture reference point change; `applyMove`/`applyScale`/`applyRotation` bodies and `writeMotionTransformAtCursor` are untouched, and the full-raster fallback keeps today's `getReferenceBounds` path byte-identical. |
| T-261107-TFP-04 | Repudiation | empty/undecoded key | low | mitigate | A key with no measurable ink returns `base: null` and the handles fall back to the full-frame box; the gizmo never disappears because of the new path. |
| T-261107-TFP-SC | Tampering | dependency installs | low | accept | No packages are added or upgraded; the change uses only existing project modules. |
</threat_model>

<verification>
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPivot.test.ts src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts src/stores/physicPaintStore.rotoRailMotions.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/roto/railMotionCommands.test.ts src/components/physic-paint/view/railMotionBoundaryTool.test.ts src/lib/paperPass.frameGuard.test.ts`
- `pnpm --dir app run typecheck`
- Scope check: `git diff --name-only HEAD -- app/src` lists exactly the eight files in `files_modified`; any other path means the scope broke — stop and report instead of widening.

Manual UAT (the user runs the dev server; Claude never starts it):
1. Open the Studio, open a rail's Motion block, select a present non-opacity channel (Position, Scale or Rotation). The blue boundary box now hugs the painted content of the key under the playhead instead of filling the project canvas.
2. Step the playhead to another key of the same rail whose paint sits elsewhere (or is smaller): the box re-fits to that key; a generated in-between uses the union of its two flanking keys' paint.
3. Step to an empty key (or a key whose raster cannot be decoded): the box falls back to the full project frame and stays draggable.
4. With a rotation and/or scale motion value set, the box stays aligned with the composited paint (same pivot); drag a corner to scale and the rotation knob to rotate — the values commit on release exactly as before.
5. Drag inside the box to move: the rail follows, and the value fields in the Motion sheet match the gesture.
6. Scrub within the rail: the box updates per key without a visible decode or scan hitch; closing the Motion block removes the box as today.
</verification>

<success_criteria>
- The rail-motion boundary box is sized by the displayed drawing key's alpha ink, per key, not by the whole project raster.
- A generated in-between uses the union of its two flanking source keys; an empty or unmeasurable key keeps the full-raster fallback.
- The box uses the compositor's pivot and op order, so it tracks rotation/scale with the paint; `getReferenceBounds` and every gesture body are unchanged.
- The measurement is memoized per rail + raster revision and shared with the existing pivot cache: no second scan and no per-frame pixel work.
- The animate-mode gate, the Motion sheet, the commit path, CSS and persistence are untouched.
- Targeted suites, the contract suites and typecheck are green; the app source diff is limited to this plan's files; the manual UAT rows are ready for the user.
</success_criteria>

<output>
Create `.planning/quick/261107-tfp-ui-boundaries-from-phase-59-rail-motion-/261107-tfp-SUMMARY.md` when done
</output>
