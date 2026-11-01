---
phase: 261101-mvg-preview-stroke-size-switch-in-the-move-e
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
  - app/src/components/physic-paint/view/aquarelleLiftRibbon.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements:
  - QUICK-261101-MVG
user_setup: []

estimate:
  tokens: 68000
  raw_tokens: 68000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "With the Stroke settings sheet's 'Preview stroke size' switch OFF (the default, Eraser included) NO listed stroke draws a bold surface: paint strokes keep their thin centerline (cyan when selected, dual dark/light when not) and an Eraser stroke draws that same thin centerline instead of its 261029-eur ribbon."
    - "With the switch ON every listed stroke draws the area it actually covers: a paint stroke draws its brush footprint band (declared size, recorded tip aspect, per-point recorded pressure, water x1.3) and an Eraser keeps the 261029-eur ribbon law unchanged; a `pen` band is ALWAYS aspect 1, whatever non-round tip the stroke recorded, exactly like the engine's isotropic ink dab."
    - "The switch renders in the Stroke settings sheet header, so it is reachable in BOTH list and settings views and never inside the Geometry/Stack/Paint tabs; it is a toggle button with a stable data-testid and aria-pressed, default OFF, session-only."
    - "Selection, hit-test, bounds, stack positions, serial, the recorded script and every engine/bake/punch input are identical with the switch ON and OFF; the preference is never persisted in the document and never enters the undo stack."
    - "Drag ghosts and transform previews move the bold surface exactly like today's ribbon/polyline: every band vertex passes through applyScriptStrokeTransform and the drag offsetX/offsetY inside the overlay's per-entry loop."
    - "Paint band geometry is produced by ONE pure, Preact-free, signal-free reusable module that delegates the Eraser branch to the existing 261029-eur law, so the next quick (Draft mode) reuses it instead of rebuilding paint footprint geometry."
    - "A long paint stroke and a long session stay bounded: stations are decimated to MAX_POLYLINE_POINTS, the polygon stays under the shared vertex budget, and the band cache is revision-keyed and trimmed to the current frame's live paint ids; a stroke that yields zero valid stations returns an empty polygon and never throws, for both the paint and the Eraser branch."
  artifacts:
    - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
    - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
    - app/src/components/physic-paint/view/aquarelleLiftRibbon.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
  key_links:
    - "strokeSizePreview signal (scriptStrokeEdition) -> dialog header aria-pressed (event-handler write) + ScriptStrokeOverlay leaf gate (narrow read) — the Studio render body never reads it"
    - "aquarelleScriptStrokeEditionPort.bandFor -> resolveAquarelleStrokeBandPx(entry, size) -> buildStrokeBandCached -> buildStrokeBand -> buildSupportBandStations/buildSupportBandPolygon -> the overlay's band path `d`"
    - "buildStrokeBand lift branch -> buildLiftRibbon (261029-eur): the eraser polygon is delegated, never re-derived"
    - "listSelectableAquarelleStrokes -> trimLiftRibbonCache(lift ids) + trimStrokeBandCache(paint ids) keeps both caches frame-bounded"
    - "band path vertices -> applyScriptStrokeTransform + offsetX/offsetY, the same per-vertex mapping the ribbon and centerline already use"
    - "aquarelleFootprintFor (the engine/cursor law) <-> paintRadiusDocFor + paintTipForStroke (the band law): radius AND tip aspect pinned equal by test (pen forced to aspect 1) so the drawn area and the stamped area cannot drift"
---

<objective>
Add a "Preview stroke size" switch to the Move/Edit Stroke settings sheet (the surface shared by Water color Select mode and Brush Move) that turns the bold footprint preview ON for every listed stroke: a paint stroke draws the area the brush actually covers on canvas, derived from its own bake footprint law (size, tip aspect, per-point recorded pressure, water x1.3), while an Eraser stroke keeps the 261029-eur red ribbon. OFF — the default, Eraser included — renders nothing bold and puts the Eraser back on the same thin centerline outline paint strokes use.

Purpose: today only the Eraser draws its real footprint; paint strokes draw a thin centerline, so judging a stroke's real coverage in Move/Edit is guesswork. The switch makes "where does this stroke actually land" visible for every kind, without touching a single recorded byte.

Output: one new pure reusable band module (`aquarelleStrokeBand.ts`) that exposes both stroke kinds behind one entry point and delegates the Eraser to the existing 261029-eur law, a small behaviour-preserving extraction in `aquarelleLiftRibbon.ts` so both kinds share the normal-offset band core, a session-only shared switch signal with its declared resolver, the overlay's band branch (transform + drag mapped per vertex), the dialog header control in both views, a pressed-state CSS modifier, and updated/new tests. No schema change, no persistence, no undo entry, no hit-test/bounds change, no engine or bake access.
</objective>

<coverage_audit>
| SOURCE | ID | Item | Plan/Task | Status |
|--------|----|------|-----------|--------|
| GOAL | — | "Preview stroke size" switch on the Move/Edit Stroke settings dialog, shared by Water color Select and Brush Move | 01 / T1+T2+T3 | COVERED |
| REQ | QUICK-261101-MVG-1 | One switch turns the bold footprint preview ON for EVERY listed stroke (paint band from the bake footprint law; eraser keeps the 261029-eur ribbon law) | 01 / T1 (module) + T2 (draw) | COVERED |
| REQ | QUICK-261101-MVG-2 | Default OFF for all kinds, Eraser included; OFF renders nothing bold and the Eraser falls back to the thin centerline | 01 / T2 + T3 | COVERED |
| CONTEXT | D-01 | Geometry is display-only: `listSelectableAquarelleStrokes` keeps byte-identical bounds/hitRadiusPx/ribbonPx/stack/serial/kind/tool/brushId/customResponse; `hitTestAquarelleStroke`/`hitTestStroke` stay switch-independent | 01 / T2 + T3 | COVERED |
| CONTEXT | D-02 | Default OFF (`signal(false)`), compare-then-write setter, session-only, never persisted, never undoable | 01 / T2 | COVERED |
| CONTEXT | D-03 | New pure reusable band module under `view/`, both kinds behind one entry point, lift delegated to `buildLiftRibbon`/`liftRadiusDoc`/`liftShapeForStroke`, paint from `buildBrushForStroke`/`toEngineParams`/recorded `p`/water x1.3, no Preact/signals/DOM/stateful engine import, bounded revision-keyed cache, focused unit tests | 01 / T1 | COVERED |
| CONTEXT | D-04 | Reachability: header control present in BOTH `view === 'list'` and `view === 'settings'`, outside the tabs, stable `data-testid` + `aria-pressed` | 01 / T3 | COVERED |
| CONTEXT | D-05 | Ghosts/transform previews: every band vertex through `applyScriptStrokeTransform` + drag `offsetX/offsetY` inside the overlay loop; no pre-translation in the band module | 01 / T2 | COVERED |
| CONTEXT | D-06 | The 261029-eur always-on-eraser-ribbon pins are UPDATED deliberately (never deleted); the "one footprint law" and "preview follows the band" intents survive | 01 / T2 (overlay pin) + T3 (behaviour pins) | COVERED |
| CONTEXT | D-07 | Gates: `pnpm vitest run` (never watch), typecheck, no dev server | 01 / all tasks | COVERED |
| CONTEXT | D-08 | Decision (a): the paint band is built in the OVERLAY leaf through a port resolver, not by the listing — `hitTestAquarelleStroke` reads the registry directly (verified at `aquarelleStrokeSelection.ts:404-427`), and the OFF path builds zero paint geometry | 01 / T2 | COVERED |
| CONTEXT | D-09 | Decision (b): no display field on `SelectableScriptStroke`; `ribbonPx`/`hitRadiusPx` semantics unchanged; the resolver returns the polygon | 01 / T2 | COVERED |
| CONTEXT | D-10 | Decision (c): the switch lives in `scriptStrokeEdition.ts` next to the shared selection/drag signals | 01 / T2 | COVERED |
| CONTEXT | D-11 | Decision (d): per-point recorded pressure drives paint band width (brush `pressureSize` response), water x1.3, pen law; the lift branch keeps its per-station support law | 01 / T1 | COVERED |
| CONTEXT | D-12 | Decision (e): `MAX_POLYLINE_POINTS` decimation + the shared `CAP_SEGMENTS`; bounded revision-keyed cache trimmed by the listing | 01 / T1 + T2 | COVERED |
| CONTEXT | D-13 | Decision: band colour follows the badge accent law (Eraser red `#ef4444`, paint its own recorded colour); the paint bbox stays as today and an Eraser keeps having no bbox | 01 / T2 | COVERED |
</coverage_audit>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<required_reading>
- .claude/skills/efx-preact-reactivity/SKILL.md
- app/src/components/physic-paint/view/aquarelleLiftRibbon.ts (the pure-band precedent this module must follow)
- app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts (the test style and the laws already pinned)
- app/src/components/physic-paint/engine/aquarelleFootprint.ts (the engine/cursor footprint law the paint band must mirror — never import it: it carries module state)
- app/src/components/physic-paint/roto/aquarelleLiftErase.ts (lines 100-180: `liftShapeForStroke`, `liftEngineSize`, `liftRadiusDoc`)
- app/src/components/physic-paint/view/scriptStrokeEdition.ts (lines 25-105 the entry type, 107-170 the shared signals/setters, 368-423 the edition port)
- app/src/components/physic-paint/view/aquarelleStrokeSelection.ts (lines 380-535 the listing and hit-test, 546-554 the watercolor port)
- app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx (lines 322-500 the render loop and the lift/paint branches)
- app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx (lines 382-505 the render-body reads, 751-880 the header and the view gate)
- app/src/components/physic-paint/physicsPaintStudio.css (lines 5799-5868 the header-button chrome and the audio-preview ON precedent)
- app/src/components/physic-paint/physicsPaintStudio.css (lines 1499-1574 the stroke-list rules)
</required_reading>

Grounded facts (verified against the live tree — do not re-derive, do not invent APIs):

- `aquarelleLiftRibbon.ts` (373 lines) is pure: it imports only types from `@efxlab/efx-watercolor/payload`, the lift helpers `liftEngineSize/liftRadiusDoc/liftShapeForStroke/LiftFootprintShape` from `../roto/aquarelleLiftErase`, and shared constants/types from `./scriptStrokeEdition`. Its only module state is `liftRibbonCache` (a `Map<number, LiftRibbonCacheEntry>` with the stamp `revision|width|height`). `bandStations` is built by the private `buildStations` (sticky tilt azimuth above `hypot(tx,ty) > 12`, aspect-corrected segment angle, `follow`/`random`/fixed angle law mirroring `Engine.brushAngle`), the polygon by the body of `buildLiftRibbon` (single point = 16-gon sweep; otherwise left/right normals with `supportHalfWidth`, `CAP_SEGMENTS = 8` forward and backward caps). `buildLiftRibbon` returns `{ polygonPx, hitRadiusPx }`.
- `aquarelleFootprint.ts` is the engine/cursor law but carries module state (`cachedBrush`, `lastShapedAngle`) — `aquarelleLiftRibbon.ts` deliberately does not import it. Its paint numbers: `engineSizeMult(size) = 3^((toEngineParams({size}).size - 0.5) * 2)`; `brushRadius(brush, p, mult) = (size[0] + (size[1]-size[0]) * clamp01(p)^pressureSize) * mult * 0.8`; `water` multiplies by `1.3` at speed 0; `pen` is `(0.0016 + 0.0042 * p) * 1.12 * mult`; `rounded` is `aspect < 0.6`; `brushFor` uses `tipId ?? 'round'`.
- `Engine.ts:1564-1587` confirms the same laws live, and `engineAdapter.ts:220` binds the replay brush with `buildBrushForStroke(payload.brushId ?? stroke.brushId, payload.toolOverrides ?? stroke.toolOverrides)` — the band must resolve the tip through the recorded `brushId`/`toolOverrides`.
- `aquarelleLiftErase.ts:167-170`: `liftEngineSize(params) = toEngineParams(params).size` (finite, default 0.375). `liftRadiusDoc` is the punch's radius law (261029-eur "the ONE footprint law", pinned at `aquarelleLiftErase.test.ts:253`).
- `hitTestAquarelleStroke` (`aquarelleStrokeSelection.ts:404-427`) walks `getRecordedAquarelleStrokeEntries()` DIRECTLY — it never calls the listing. The listing (`:447-535`) builds the lift ribbon always (bounds + hit radius + `ribbonPx`) and leaves paint entries on `scriptStrokeBoundsPx`. It already trims the lift cache against the frame's live lift ids (`:466-472`).
- `getRecordedAquarelleStroke(mutationId)` exists (`aquarelleRecordState.ts:1595`) and returns the raw recorded `AquarelleStroke`.
- `ScriptStrokeEditionPort` (`scriptStrokeEdition.ts:373-384`) is the per-module contract; the watercolor implementation is `Pick<ScriptStrokeEditionPort, 'listStrokes' | 'hitTestStroke'>` (`aquarelleStrokeSelection.ts:546-554`) and is spread into the adapter port (`AquarelleStrokeOverlay.tsx:31-39`) and the Studio registration (`PhysicsPaintStudio.tsx:8512-8515`). Adding an optional `bandFor` flows through both spreads with no other call-site change.
- `ScriptStrokeOverlay.tsx` already reads `scriptStrokeDrag.value`, `scriptStrokeTransform.value` and `scriptSelectedStrokeIds.value` in its render body (`:127-136`) — it is the sanctioned narrow leaf. Its per-entry loop maps every lift-ribbon vertex through `applyScriptStrokeTransform` + `offsetX/offsetY` (`:365-375`).
- Dialog header (`PhysicsPaintStrokeSettingsDialog.tsx:751-853`): icon + title + spacer + [delete-selection, watercolor && deleteStrokes] + [view toggle, watercolor] + close. Every header button stops `pointerdown` propagation because the header is the drag handle. `const view` is resolved at `:474-476`; the header is ABOVE the view gates, so a control placed there exists in both views.
- The dialog harness (`strokeSettingsModel.test.ts:101-264`) mocks `preact/hooks` with a ref cursor runtime, keeps the real signals core, and exposes `renderDialog`, `renderSettings`, `renderDialogTab`, `findByTestId`. `beforeEach` (`:146-173`) resets module signals explicitly — a new session signal needs its reset there.
- `.physics-paint-stroke-settings-header-button` already exists (`physicsPaintStudio.css:5799-5828`) with the 22px chrome, hover, focus-visible and disabled states. `.physics-paint-audio-preview-toggle[aria-pressed='true']` (`:5862-5873`) is the ON-state precedent (blue `#2d5be3`), chosen there so the state never collides with the global `button.active` rule.
- Source pins that encode today's always-on Eraser ribbon live in `PhysicsPaintStudio.test.ts:3032-3054` (the overlay source: `LIFT_RIBBON_COLOR`, `entry.kind === 'lift'`, `fillRule="nonzero"`, the fill/stroke ternaries, and the region `entry.kind === 'lift'` → `// Paint branch:` containing `applyScriptStrokeTransform`, `offsetX`, `offsetY`). No other Studio test pins the ribbon branch.
- Listing pins in `aquarelleStrokeSelection.test.ts:760-847` assert a lift entry HAS `ribbonPx` + a max-support `hitRadiusPx` + polygon bounds, and a paint entry has NEITHER. Those stay TRUE (the listing is unchanged) — keep them and ADD switch-gated resolution pins beside them.
- `Spline` is already imported elsewhere from `lucide-preact` (`PaintModeSelector.tsx`, `PaintToolbar.tsx`) — safe icon choice.
- Test law: `pnpm --filter efx-motion-editor exec vitest run <app-relative path>` from the checkout root. Never watch (`pnpm … run test` is watch mode). Typecheck: `pnpm --filter efx-motion-editor run typecheck`. Vitest collects only `.test.ts` — the new surface test is `aquarelleStrokeBand.test.ts`, never `.tsx`.
- Preact law: no `useState`; no signal writes in a render body; setters compare-then-write; the new signal is read by the dialog leaf and the overlay leaf only — never by the Studio render body (the bundle comment at `PhysicsPaintStudio.tsx:10335-10337` states that law).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: One footprint band for both stroke kinds — pure geometry, Eraser delegated to the 261029-eur law</name>
  <files>app/src/components/physic-paint/view/aquarelleStrokeBand.ts, app/src/components/physic-paint/view/aquarelleLiftRibbon.ts, app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts</files>
  <behavior>
    - RED first. `buildStrokeBand(liftStroke, size).polygonPx` equals `buildLiftRibbon(liftStroke, size).polygonPx` element-for-element (same length, same x/y) — the Eraser delegates, it is never re-derived.
    - A horizontal brush stroke (points at y = 0.5, several pressures) produces a closed polygon whose every vertex sits within the tip support half-width of the recorded centerline (the same `distanceToSegmentPx` check the 261029-eur suite uses); every vertex is finite.
    - Pressure drives width: with all other inputs fixed, a stroke recorded at p = 1 yields a band whose maximum distance from the centerline is strictly greater than the same stroke recorded at p = 0.2.
    - Tool law: the same points/params recorded as `water` yield a band 1.3x wider than the same stroke recorded as `brush`; a `pen` stroke yields an aspect-1 band no wider than its bare radius EVEN WHEN the recorded stroke carries a non-round tip (the engine draws the pen as an isotropic ink splat); a `lift` stroke yields the ribbon.
    - Drift pin against the engine/cursor law: use a FIXED-rotation NON-ROUND tip — the `round` preset with `toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 }`, i.e. `rotation: 'fixed'`, non-unit aspect, never `follow`/`random`, so no declared approximation is involved and the aspect assertion cannot be vacuous. For tools `brush` and `water`, `paintRadiusDocFor(tool, brush, engineSize, p)` equals `aquarelleFootprintFor({...}).radiusDoc` at the same canonical size, pressure and tip (closeness 12) AND `paintTipForStroke({ tool, brushId, toolOverrides }).aspect` equals the footprint's aspect (2). Then record a `pen` stroke with that SAME aspect-2 tip: `aquarelleFootprintFor` reports aspect 1, `paintTipForStroke` reports aspect 1, and the band's widest vertex stays within the pen radius — non-vacuous precisely because the recorded tip is not round.
    - Tip aspect law: an aspect-2 tip's band reaches about 2R on the wide side (the max support factor), and a tip below `LIFT_ROUNDED_ASPECT` uses the rounded-rectangle support branch, never NaN.
    - Frames: on a NON-square sheet (1000 x 600) the band is symmetric about the centerline in canvas px (the isotropic-unit mirror pin), i.e. the band's vertical half-extent in canvas px equals the doc-frame support at the same size.
    - Determinism and freshness: `buildStrokeBand` twice with the same input returns equal polygons but NOT the same array instance.
    - Budget: a 1000-point paint stroke yields at most `MAX_POLYLINE_POINTS * 2 + (CAP_SEGMENTS - 1) * 2` vertices, and every value is finite; a stroke whose points are non-finite produces no NaN vertices.
    - Zero stations: a stroke with `points: []`, and a stroke whose points are ALL non-finite, each yield `{ polygonPx: [] }` and never throw — asserted for a paint stroke AND for a lift stroke; on the lift path `buildLiftRibbon` still returns its `hitRadiusPx` (the 261029-eur early return survives the extraction).
    - Cache: `buildStrokeBandCached` returns the SAME `polygonPx` array instance for the same (mutationId, revision, size) and a different instance after the revision or the size changes; `trimStrokeBandCache` drops ids the newest listing no longer contains; a lift through the cached entry point returns the lift-cache polygon (identity with `buildLiftRibbonCached`).
  </behavior>
  <action>
    FIRST, the behaviour-preserving extraction in `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts` (the existing `aquarelleLiftRibbon.test.ts` is the pin that it changes nothing):
    - Rename the private `BandStation` interface to an EXPORTED `SupportBandStation` (same four fields: `px`, `pyUp`, `radius`, `theta`) and update its two internal uses.
    - Export `buildSupportBandStations(stroke, shape, size, radiusOf)`: `shape` is `Pick<LiftFootprintShape, 'rotation' | 'angle'>` (only those two are read), `radiusOf` is `(point: AquarelleStroke['points'][number]) => number`. Move the body of today's `buildStations` verbatim EXCEPT that the `const engineSize = liftEngineSize(stroke.params)` line leaves and the `radius` line becomes `const radius = radiusOf(point);`. Keep `decimateStations`, the sticky azimuth (`Math.hypot(point.tx, point.ty) > 12`), the aspect-corrected segment direction, the follow/random/fixed angle law and both finite guards (never emit NaN).
    - Export `buildSupportBandPolygon(stations, height, aspect): CanvasPoint[]` containing today's single-point 16-gon sweep plus the left/right normal arrays, the `stationTangent` walk, and the forward/backward `CAP_SEGMENTS` caps exactly as written. It OPENS with `if (stations.length === 0) return [];` — with zero stations the cap prologue dereferences `stations[last]!`/`tangents[last]!` and throws, so this guard is what makes both callers safe. `stationTangent` and `supportHalfWidth` stay private.
    - Rewrite `buildLiftRibbon` as: `hitRadiusPx = liftStrokeRadiusPx(...)`; the same size guard; `shape = liftShapeForStroke(stroke)`; `engineSize = liftEngineSize(stroke.params)`; `stations = buildSupportBandStations(stroke, shape, size, (point) => liftRadiusDoc(point.p, engineSize) * size.height)`; keep today's zero-station guard VERBATIM as `if (stations.length === 0) return { polygonPx: [], hitRadiusPx };` (it must still return `hitRadiusPx` on the empty path); then return `{ polygonPx: buildSupportBandPolygon(stations, size.height, shape.aspect), hitRadiusPx }`. The output must be byte-identical to today; do not change `liftStrokeRadiusPx`, `liftSupportFactor`, `liftRibbonBoundsPx`, the caches or `trimLiftRibbonCache`.

    SECOND, create `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` — the ONE pure, reusable footprint-band entry point for BOTH stroke kinds. Header comment in the `aquarelleLiftRibbon.ts` style: provenance `261101-mvg`, the REUSE CONTRACT (the next quick, Draft mode, must import this module and never rebuild paint footprint geometry), the purity rules (no Preact, no signals, no DOM, no stateful engine import — `aquarelleFootprint.ts` is deliberately NOT imported because it carries `cachedBrush`/`lastShapedAngle`), the frames law (uv → doc px `{ x: ux * width, yUp: uy * height }`, radius converts as `r * height` on both axes, only the final polygon flips to canvas px), and the declared approximations (recorded 60 Hz samples, speed 0 so no speed-thin term, `random` tips use the preset angle and never RNG, raw segment direction).
    - Constants: `const DEG = Math.PI / 180;` and reuse the exported `LIFT_ROUNDED_ASPECT` for the rounded-tip branch.
    - `export interface StrokeBandGeometry { readonly polygonPx: CanvasPoint[]; }`.
    - `export function paintTipForStroke(stroke: Pick<AquarelleStroke, 'tool' | 'brushId' | 'toolOverrides'>)` returning `{ brush, aspect, angle, rotation }` from `buildBrushForStroke(stroke.brushId || 'round', stroke.toolOverrides)`. When `stroke.tool === 'pen'` return `{ brush, aspect: 1, angle: 0, rotation: 'fixed' }`, ignoring the recorded tip's aspect and angle: the engine stamps the pen as an isotropic ink splat (`splatInk` takes no angle) and `aquarelleFootprintFor` returns `aspect: 1, angle: 0` for pen (`aquarelleFootprint.ts:120-127`), while `aquarelleBrushForActiveTool` records the SELECTED tip's overrides for pen too (`aquarelleRecordState.ts:309-312`) — an unforced band would draw an off-law ellipse for a pen stroke recorded with flat/chalk. Otherwise return the recorded `{ aspect: brush.aspect, angle: brush.angle * DEG, rotation: brush.rotation }` — mirroring `aquarelleFootprint.ts`'s `brushFor` fallback and `liftShapeForStroke`'s DEG conversion.
    - `export function paintRadiusDocFor(tool: 'brush' | 'water' | 'pen', brush: Brush, engineSize: number, pressure: number): number` reproducing `Engine.radius` at speed 0: `sizeMult = 3^((engineSize - 0.5) * 2)`; pen = `(0.0016 + 0.0042 * clamp01(pressure)) * 1.12 * sizeMult`; otherwise `t = clamp01(pressure) ^ brush.pressureSize`, `radius = (brush.size[0] + (brush.size[1] - brush.size[0]) * t) * sizeMult * 0.8`, times `1.3` for `water`. Declare in a comment that this mirrors `aquarelleFootprint.ts`/`Engine.ts:1564-1587` and is pinned equal by test.
    - `export function buildStrokeBand(stroke: Pick<AquarelleStroke, 'tool' | 'points' | 'params' | 'brushId' | 'toolOverrides'>, size: ScriptStrokeSize): StrokeBandGeometry` — guard non-finite/non-positive size with an empty polygon; `tool === 'lift'` returns `{ polygonPx: buildLiftRibbon(stroke, size).polygonPx }` (DELEGATION — never re-derive the erase law); otherwise resolve `engineSize = toEngineParams(stroke.params).size ?? 0.5`, the tip via `paintTipForStroke(stroke)`, build stations via `buildSupportBandStations(stroke, tip, size, (point) => paintRadiusDocFor(tool, tip.brush, engineSize, point.p) * size.height)`, and return `{ polygonPx: [] }` when `stations.length === 0` (a stroke with no points, or one whose every sample is non-finite) BEFORE calling `buildSupportBandPolygon`; then `buildSupportBandPolygon(stations, size.height, tip.aspect)`.
    - A bounded, revision-keyed cache mirroring `liftRibbonCache`: stamp `revision|width|height`, `clear()` on any stamp change, `trimStrokeBandCache(liveIds)`; `export function buildStrokeBandCached(stroke, mutationId, size, revision)` returns the lift-cache result for a lift (delegate to `buildLiftRibbonCached` so there is exactly ONE eraser cache) and caches only paint polygons.

    THIRD, the tests in `app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts` (`.test.ts`, never `.tsx`). Reuse the fixture style of `aquarelleLiftRibbon.test.ts` (`SIZE`, canonical params, `point(x, y, pressure, tiltX, tiltY)`, `NEUTRAL_TOOL_OVERRIDES`). Cover every behaviour line above, including the drift pin against `aquarelleFootprintFor` (with the aspect-2 fixed-rotation tip, so the pen assertion is non-vacuous), the delegation identity against `buildLiftRibbon`, the zero-station cases for both branches, and a SOURCE-TEXT PURITY PIN for truth #6: read `aquarelleStrokeBand.ts` through `readFileSync(fileURLToPath(new URL('./aquarelleStrokeBand.ts', import.meta.url)), 'utf8')` (the `aquarelleLiftRibbon.test.ts:295-304` imports) and assert its IMPORT STATEMENTS match none of `preact`, `@preact/signals` or `aquarelleFootprint` — use `not.toMatch(/from\s+['"][^'"]*preact[^'"]*['"]/)` and `not.toMatch(/from\s+['"][^'"]*aquarelleFootprint[^'"]*['"]/)`, NOT a bare `not.toContain`: the module's own header comment NAMES those excluded modules, so a bare substring gate would be self-invalidating.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeBand.test.ts src/components/physic-paint/view/aquarelleLiftRibbon.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>`aquarelleStrokeBand.ts` exposes `buildStrokeBand`, `buildStrokeBandCached`, `trimStrokeBandCache`, `paintTipForStroke` and `paintRadiusDocFor`; the Eraser branch delegates to `buildLiftRibbon` and the paint branch derives its radius/angle/aspect from the recorded brush law (size, pressure, recorded tip aspect, water x1.3), with `pen` forced to aspect 1 and angle 0 regardless of the recorded tip; a stroke with zero valid stations returns an empty polygon without throwing on BOTH branches; the extraction in `aquarelleLiftRibbon.ts` is behaviour-identical (the whole existing ribbon suite passes unchanged, zero-station guard included); the new unit suite proves delegation, pressure-driven width, the tool laws, the drift pin against `aquarelleFootprintFor` with a non-round tip, the impurity-free import surface, the non-square mirror, NaN safety, the vertex budget and the cache laws; typecheck green; one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The session switch and the bold band in the drawing leaf (paint band + Eraser fallback), with the 261029-eur overlay pin rewritten</name>
  <files>app/src/components/physic-paint/view/scriptStrokeEdition.ts, app/src/components/physic-paint/view/aquarelleStrokeSelection.ts, app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    - `strokeSizePreview` starts false; `setStrokeSizePreview(true)` notifies an `effect` subscriber exactly once and a repeated `setStrokeSizePreview(true)` notifies zero times (compare-then-write); turning select mode off does NOT reset it (session preference).
    - `resolveAquarelleStrokeBandPx(entry, size)` returns `undefined` for a paint entry AND for a lift entry while the switch is OFF; with the switch ON it returns the lift entry's `ribbonPx` BY IDENTITY (`toBe`) and a paint polygon with more than two finite vertices.
    - The listing is switch-independent: for the same recorded frame, `listSelectableAquarelleStrokes` produces entries deep-equal in `bounds`, `pointsPx`, `ribbonPx`, `hitRadiusPx`, `serial`, `stackPosition`, `stackTotal`, `kind`, `tool`, `brushId`, `customResponse` with the switch OFF and ON; `hitTestAquarelleStroke` returns the same mutation id in both states.
    - Overlay source contract ((source-text pins on `ScriptStrokeOverlay.tsx`, the file's established test style): it reads `strokeSizePreview`; the band path is obtained from `props.port.bandFor` and is gated on the switch; the paint band carries `data-testid="stroke-size-band"`, a lift band keeps `data-testid="stroke-lift-ribbon"`; the band keeps `LIFT_RIBBON_COLOR` for the Eraser and the entry's own colour for paint; `fillRule="nonzero"`, `fillOpacity={isSelected ? 0.14 : 0.07}` and `strokeWidth={isSelected ? 3.5 : 1.5}` survive; the band region maps every vertex through `applyScriptStrokeTransform` and `offsetX`/`offsetY`; the paint bbox rule still renders for paint only.
  </behavior>
  <action>
    Session switch (`app/src/components/physic-paint/view/scriptStrokeEdition.ts`): beside `scriptSelectMode` (`:107-108`) add `export const strokeSizePreview = signal(false);` documented as the Move/Edit "Preview stroke size" VIEW PREFERENCE — session/UI state only, never written to the document, never in the undo stack, never persisted — and `export function setStrokeSizePreview(on: boolean): void` with a compare-then-write guard and an early return when unchanged (rule 3). It must NOT be reset by `setScriptSelectMode`.

    Extend the port (`:373-384`) with the optional display-only member `bandFor?(entry: SelectableScriptStroke, size: ScriptStrokeSize): CanvasPoint[] | undefined;` documented as the footprint band the overlay draws while the preview switch is on; absent means the module has no band geometry and the overlay draws its centerline. It is NEVER a hit-test or bounds input.

    Resolver (`app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`): import `buildStrokeBandCached, trimStrokeBandCache` from `./aquarelleStrokeBand` and `strokeSizePreview` from `./scriptStrokeEdition`. In `listSelectableAquarelleStrokes`, extend the existing live-id loop (`:466-472`) to also collect `liveBandIds` for every non-lift entry of the frame and call `trimStrokeBandCache(liveBandIds)` next to `trimLiftRibbonCache(liveLiftIds)` — cache hygiene only, zero geometry, so the listing's entries stay byte-identical. Add `export function resolveAquarelleStrokeBandPx(entry: SelectableAquarelleStroke, size: EnginePixelSize): CanvasPoint[] | undefined`: return `undefined` when `strokeSizePreview.value` is false (this read happens inside the overlay's render, so the subscription is the narrow leaf's); for `kind === 'lift'` return `entry.ribbonPx` (already built by the listing — never rebuild it); otherwise look up `getRecordedAquarelleStroke(entry.mutationId)` and return `buildStrokeBandCached(stroke, entry.mutationId, size, aquarelleStrokesRevision.value).polygonPx`, or `undefined` when the polygon is empty. Comment that this path is display-only and unreachable from `hitTestAquarelleStroke`.

    Register it on the watercolor port (`:546-554`): widen the `Pick` to `'listStrokes' | 'hitTestStroke' | 'bandFor'` and add `bandFor: (entry, size) => resolveAquarelleStrokeBandPx(entry, size),`. The adapter and the Studio registration already spread this object, so no other wiring is needed — do not touch `AquarelleStrokeOverlay.tsx`, `PhysicsPaintStudio.tsx`, the listing entries or any hit/bounds law.

    Overlay (`app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`): import `strokeSizePreview` from `../view/scriptStrokeEdition`; read `const previewStrokeSize = strokeSizePreview.value;` beside the other narrow reads (`:127-136`) with a comment naming it the 261101-mvg leaf gate. In the per-entry loop replace `liftPath` with `const bandPx = previewStrokeSize && props.port.bandFor !== undefined ? props.port.bandFor(entry, size) : undefined;` and build `bandPath` only when `bandPx !== undefined && bandPx.length > 0`, mapping EVERY vertex through `applyScriptStrokeTransform(p, transformPreview!)` and `+ offsetX` / `+ offsetY` exactly as the current lift path does (no geometry translation anywhere else). Derive `const bandAccent = entry.kind === 'lift' ? LIFT_RIBBON_COLOR : entry.color;` (the badge accent law, D-13). Render the band when `bandPath !== null`: one `<path>` with `data-testid={entry.kind === 'lift' ? 'stroke-lift-ribbon' : 'stroke-size-band'}`, `d={bandPath}`, `fill={bandAccent}`, `fillOpacity={isSelected ? 0.14 : 0.07}`, `fillRule="nonzero"`, `stroke={bandAccent}`, `strokeWidth={isSelected ? 3.5 : 1.5}`, `strokeLinejoin="round"`, `vectorEffect="non-scaling-stroke"`. When `bandPath === null` fall through to TODAY'S centerline branches unchanged: selected cyan `#38bdf8` 2px polyline, else the dual `#111111` 2px / `#ffffff` 1px polylines. Keep the bbox `<rect>` rule exactly as today (`entry.kind === 'lift' ? null : <rect …>`): an Eraser never gets a box, paint keeps its box with or without the band. Keep the badge, its accent, the union transform box and its handles untouched. Delete the now-dead `liftPath` block and its `// Paint branch:` comment, and update the file-header paragraph that describes outlines so it names the switch-gated band.

    Pins (`app/src/components/physic-paint/PhysicsPaintStudio.test.ts:3032-3054`): rewrite the case (rename it to state the new contract, e.g. "draws the size band for paint and the red ribbon for a lift only while the preview switch is on") keeping the same intents — `LIFT_RIBBON_COLOR`, the fill/stroke ternaries, `fillRule="nonzero"`, the constants — and ADD: `strokeSizePreview` read, `props.port.bandFor`, `data-testid="stroke-size-band"`, and `stroke-lift-ribbon`. Replace the old `entry.kind === 'lift'` → `// Paint branch:` slice with a region from the `const bandPx` line to the `const badgeAccent` line and assert it contains `applyScriptStrokeTransform`, `offsetX` and `offsetY` (the ghost/transform guarantee), and assert the region contains `previewStrokeSize`. Do not touch the gesture pins at `:3486-3740`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/scriptStrokeEdition.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The shared session signal exists with a compare-then-write setter and is not coupled to select mode; the watercolor port exposes `bandFor` through the shared resolver, which returns nothing while OFF (Eraser included) and the listing's lift ribbon or a freshly built paint polygon while ON; the overlay draws the band from the resolver with every vertex transformed and offset, falls back to today's centerline when the switch is off or the module has no band, and keeps the Eraser box-free and the paint box as today; the listing/hit-test/bounds are provably unchanged; the rewritten overlay pin carries the 261029-eur intents into the new contract; targeted tests plus typecheck green; one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: The header switch (reachable in both views) and the switch-gated behaviour pins</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/strokeSettingsModel.test.ts, app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts</files>
  <behavior>
    - Dialog harness: with a watercolor bundle and a non-empty selection, the header contains `stroke-settings-preview-stroke-size` with `aria-pressed === false`; invoking its `onClick` sets `strokeSizePreview.value` to true; re-rendering shows `aria-pressed === true`; a second click returns it to false. The button is present in BOTH the list view and the settings view (find it before and after `renderSettings`), and its click is not gated by the selection size.
    - A brush bundle renders no such button.
    - BOTH harnesses reset the switch in `beforeEach` (`strokeSettingsModel.test.ts:146-173` and the file-level `aquarelleStrokeSelection.test.ts:95-97`) so no case leaks into the next one.
    - The button carries `aria-label`/`title` "Preview stroke size", uses the shared header-button chrome class plus its own pressed-state class, and stops pointerdown propagation (the header is the drag handle).
    - Resolution pins (in `aquarelleStrokeSelection.test.ts`, beside the untouched 261029-eur listing block): with the switch OFF no entry resolves a band (paint AND lift); with it ON the lift resolves its own `ribbonPx` by identity and the paint resolves a polygon; the listing entries are deep-equal across the toggle; `hitTestAquarelleStroke` returns the same id in both states; toggling the switch never bumps `aquarelleStrokesRevision` (it is not an edit).
  </behavior>
  <action>
    Dialog (`app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`): import `Spline` from `lucide-preact` beside `List, Settings2, SlidersHorizontal, Trash2, X`; import `setStrokeSizePreview` and `strokeSizePreview` from `./scriptStrokeEdition` (keep the existing `scriptSelectedStrokeIds, scriptSelectMode`). In the render body beside the other narrow reads (`:420-436`) add `const previewStrokeSize = strokeSizePreview.value;` — this dialog is the leaf that owns the control, never the Studio body. In the header, immediately BEFORE the watercolor view-toggle block (`:800-838`) and gated on `engineModule === 'watercolor'`, render `<button type="button" data-testid="stroke-settings-preview-stroke-size" class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-preview-toggle" aria-pressed={previewStrokeSize} aria-label="Preview stroke size" title="Preview stroke size — draw every stroke as the area it covers" onPointerDown={(event) => event.stopPropagation()} onClick={() => setStrokeSizePreview(!strokeSizePreview.peek())}>` containing `<Spline size={12} aria-hidden="true" />`. Use `.peek()` in the handler so a rapid second click reads the live value without subscribing from the handler; the render body's read is the subscription. Do NOT put the control inside the filter rows, the tabs or the `SidebarScrollArea` content: the header is above both `view` branches, which is what makes it reachable in list AND settings.

    CSS (`app/src/components/physic-paint/physicsPaintStudio.css`, right after the `.physics-paint-stroke-settings-header-button:disabled` rule at ~5828): add a short block with the comment `261101-mvg: the "Preview stroke size" switch — the shared header chrome plus an aria-pressed On look (the audio-preview-toggle precedent: the state never collides with the global button.active rule).` and the rules `.physics-paint-stroke-settings-preview-toggle[aria-pressed='true'] { border-color: #2d5be3; background: #2d5be3; color: #fff; }` plus the `:hover:not(:disabled)` variant using `#3f6ce8`. Do not restyle the existing header-button or view-toggle rules.

    Dialog harness (`app/src/components/physic-paint/view/strokeSettingsModel.test.ts`): import `strokeSizePreview` and `setStrokeSizePreview` from `./scriptStrokeEdition`; add `setStrokeSizePreview(false)` to `beforeEach` (`:146-173`) beside the other module-signal resets. Add a behavioural case covering the behaviour lines above using `renderDialog` and `findByTestId`, plus one that enters settings with `renderSettings` and finds the same testid there (or asserts its absence only for a brush bundle). Assert the default is false before any click.

    Resolution pins (`app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts`): import `resolveAquarelleStrokeBandPx` from the selection module and `setStrokeSizePreview` from `./scriptStrokeEdition`. First HOIST the existing `distanceToPolyline` helper (currently declared INSIDE the `261029-eur lift ribbon listing` describe at `:770-782`, so a later describe cannot see it) to file scope beside `point`/`stroke`, and reuse it from both blocks — do not duplicate it and do not leave a second copy behind. Add `setStrokeSizePreview(false)` to the file-level `beforeEach` (`:95-97`, beside `resetAquarelleStrokeFineFilters()`), the same leak guard `strokeSettingsModel.test.ts` gets. Then add a `261101-mvg preview stroke size band` block after the existing `261029-eur lift ribbon listing` block. Use the file's existing `stroke(...)` + `recordAquarelleStroke(...)` harness and `SHEET`: record one paint stroke and one wide lift on a dedicated frame, list them, and assert (1) both resolve `undefined` while OFF, (2) with ON the lift's resolved array is `toBe(entry.ribbonPx)` and the paint's is a >2-vertex polygon whose vertices stay within the footprint support of the recorded centerline (the hoisted `distanceToPolyline`), (3) the two entries are deep-equal in `bounds`/`pointsPx`/`ribbonPx`/`hitRadiusPx`/`serial`/`stackPosition`/`kind`/`tool`/`brushId`/`customResponse` before and after the toggle, (4) `hitTestAquarelleStroke` returns the same id at probes inside each stroke in both states, (5) `aquarelleStrokesRevision.value` is unchanged by the toggle. Leave the existing 261029-eur listing pins untouched — they still describe the listing contract and must stay green. Do not add CSS-rule assertions.

    Finally run the FULL gate from the checkout root and report the exact commands and results; never start the dev server.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeBand.test.ts src/components/physic-paint/view/aquarelleLiftRibbon.test.ts src/components/physic-paint/view/scriptStrokeEdition.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/roto/aquarelleLiftErase.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The "Preview stroke size" toggle renders in the Stroke settings header for watercolor in BOTH list and settings views, outside every tab, with `data-testid="stroke-settings-preview-stroke-size"`, `aria-pressed`, the Spline icon, a visible ON state and pointerdown isolation from the header drag; the default is OFF and BOTH harnesses reset it; the switch-gated resolution pins prove that OFF renders no band for either kind while the listing, bounds, hit-test, revision and stack metadata are identical across the toggle; the shared `distanceToPolyline` helper is hoisted to file scope and reused, not duplicated; the existing 261029-eur listing pins and the "one footprint law" pin remain green unchanged; the full targeted suite (aquarelleLiftErase included) plus typecheck are green; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| recorded stroke data → drawn band geometry | Numeric stroke data (uv coordinates, pressure, params, tip overrides) is turned into an SVG path `d`; non-finite values would corrupt the path or the renderer. |
| session UI state → document/undo | The switch must never cross into the recorded script, the package or the history ledger. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261101-mvg-01 | Tampering | `aquarelleStrokeBand.ts` polygon construction | medium | mitigate | Every emitted vertex is finite: the shared station builder keeps the existing `Number.isFinite` guards (px, pyUp, radius, theta) and skips invalid samples; the radius law clamps pressure to `0..1`; a non-finite/non-positive canvas size returns an empty polygon. A stroke that yields ZERO valid stations returns an empty polygon instead of dereferencing the last station in the cap prologue: `buildSupportBandPolygon` opens with a zero-station guard, `buildStrokeBand` guards its paint branch, and `buildLiftRibbon` keeps today's early return. Pinned by the NaN-safety and zero-station unit cases. |
| T-261101-mvg-02 | Information disclosure / DoS (resource) | band cache | low | mitigate | Revision-keyed stamp (`revision|width|height`) clears the whole map on any change; `trimStrokeBandCache` drops ids the newest listing no longer contains; stations are decimated to `MAX_POLYLINE_POINTS`; no unbounded per-frame growth. Pinned by the cache/trim and vertex-budget cases. |
| T-261101-mvg-03 | Tampering | live preference leaking into the document or undo | high | mitigate | The switch is a `signal(false)` in `scriptStrokeEdition.ts` with a compare-then-write setter, read only in render bodies of leaves; no booking in the edit ledger, no payload field, no persistence call. Pinned by the revision-unchanged and listing-deep-equality cases. |
| T-261101-mvg-04 | Spoofing (visual) | band drawn where the stroke is not | medium | mitigate | The paint radius/aspect law is pinned equal to `aquarelleFootprintFor` (the engine/cursor law) and the Eraser polygon is delegated to `buildLiftRibbon`; the band is display-only and never feeds hit-test or bounds. |
| T-261101-mvg-05 | DoS (render loop) | new signal subscription | medium | mitigate | The signal is read by the dialog leaf and the overlay leaf only (never the Studio body); the setter is idempotent; no effect watches it. `efx-preact-reactivity` rules 3 and 5. |
| T-261101-mvg-SC | Tampering | package installs | high | mitigate | No package is added, removed or upgraded by this plan; if any task finds itself needing an install, it must stop and run the package-legitimacy gate with a blocking human checkpoint. |
</threat_model>

<verification>
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeBand.test.ts src/components/physic-paint/view/aquarelleLiftRibbon.test.ts src/components/physic-paint/view/scriptStrokeEdition.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/roto/aquarelleLiftErase.test.ts` — all green, never watch mode.
- `pnpm --filter efx-motion-editor run typecheck` — green.
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/aquarelleLiftErase.test.ts` — the 261029-eur "ONE footprint law" pin stays green (the lift law is untouched); this file is part of the Task 3 gate, not an out-of-band check.
- Manual live UAT (the user's): switch OFF default on both paint and Eraser; switch ON widens every listed stroke to its covered area; drag a selected stroke and confirm the bold surface follows; rotate/scale with the handles and confirm the band follows; toggle in the settings view and confirm the control is still in the header.
- Do NOT start the dev server.
</verification>

<success_criteria>
- A "Preview stroke size" toggle sits in the Stroke settings header, reachable in list and settings views, default OFF, `aria-pressed`, stable `data-testid`, session-only.
- OFF: no bold surface for any kind; the Eraser draws the thin centerline (selected cyan / unselected dual outline) and keeps no bbox.
- ON: paint strokes draw a footprint band from the bake law (size, tip aspect, per-point recorded pressure, water x1.3, pen law); Eraser strokes draw the unchanged 261029-eur ribbon.
- Selection, hit-test, bounds, stack metadata, the recorded script, the bake/punch/engine math and the undo ledger are untouched by the switch.
- Ghosts and transform previews map every band vertex through the same transform + drag offset.
- The band geometry lives in ONE pure module (`aquarelleStrokeBand.ts`) that delegates the Eraser and is ready for the next quick's Draft mode.
- Targets: vitest run + typecheck green; one atomic commit per task.
</success_criteria>

<output>
Create `.planning/quick/261101-mvg-preview-stroke-size-switch-in-the-move-e/261101-mvg-SUMMARY.md` when done
</output>
