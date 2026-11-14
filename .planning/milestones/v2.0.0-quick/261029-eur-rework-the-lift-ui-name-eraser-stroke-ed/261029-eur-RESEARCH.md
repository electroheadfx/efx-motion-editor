# Quick 261029-eur: Lift ("Eraser") stroke-editing UX rework — Research

**Researched:** 2026-10-29
**Domain:** Preact signals + watercolor stroke-overlay geometry (Physic Paint Studio)
**Confidence:** HIGH (every finding below is read from the repo this session; no external packages are added)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ribbon shape fidelity**
- The lift ribbon is a **normal-offset band with round end caps**: walk the decimated
  centerline, offset each point by its own footprint support radius along the local
  normal to build the left and right edges, then close the polygon with
  semicircular caps at both ends (radius = the end point's own radius).
- Self-intersections on very tight turns are accepted and left to nonzero fill.
- No union-of-dabs outline tracing.

**Ribbon cost during drag**
- The ribbon polygon is **memoized per stroke**, keyed by
  `(mutationId, aquarelleStrokesRevision, canvas width, canvas height)`.
- The overlay's drag and transform previews **translate / transform the cached
  polygon** — the same offset and the same transform matrix applied to the
  centerline — and never rebuild it during a pointermove.
- The memo must be bounded (entries for strokes that leave the listing are dropped,
  or the cache is reset on revision change) so repeated frame navigation cannot
  grow it without limit.

**Dialog dismissal in Edit**
- An **explicit close wins**. Once the user dismisses the Stroke Settings dialog
  while select mode is on, it stays closed until select mode fully exits and
  re-enters. `keepOpenOnEmpty` must not resurrect it through the existing
  `sawEmptySinceDismiss` re-arm edge.
- Brush-module behavior is unchanged.

### Claude's Discretion
- The exact signature that lets `setAquarelleSelectMode` distinguish a
  lift-edit entry from a normal toggle (an optional filter argument is the
  expected shape) — the planner chooses, provided `setAquarelleSelectMode` stays
  the single entry/exit choke point.
- The `AquarelleFootprint`-style helper's module name and export shape, provided
  it lives under `view/` and stays pure.
- Which existing source-pin tests are extended vs. rewritten, as long as coverage
  is not deleted.

### Deferred Ideas (OUT OF SCOPE)

None recorded in CONTEXT.md. The four requirement blocks passed by the orchestrator
are the scope; identifiers, serialization, `tool:'lift'`, and engine math are out.
</user_constraints>

## Summary

The four requirements land on one hot path of four files: `aquarelleStrokeSelection.ts`
(filter + entry/exit choke point), `scriptStrokeEdition.ts` (`SelectableScriptStroke.kind`),
`ScriptStrokeOverlay.tsx` (one new per-entry branch), and `PhysicsPaintStrokeSettingsDialog.tsx`
(filter row + empty state + tab hide). The only genuinely new math is the lift **footprint
support radius**, and every input to it already exists (`liftShapeForStroke`, the punch's
`normalizePressure` sentinel, `toEngineParams`, `aquarelleUvToEnginePixel`).

Two findings change the shape of the plan:

1. **The dialog close path must stop exiting select mode.** Today `closeMoveMode` calls
   `toggleAquarelleSelectMode()`; with an Edit switch whose state is derived from
   `selectMode && filter === 'lift'`, closing the dialog would flip the switch off and
   contradict "stays closed until select mode fully exits and re-enters". The watercolor
   bundle needs a dismiss-without-exit path — and that makes the `dismissed` /
   `sawEmptySinceDismiss` machinery live for the first time, which is exactly why the
   re-arm edge must be gated under `keepOpenOnEmpty`.
2. **The footprint math must not be borrowed from `aquarelleFootprintFor`.** That function
   writes the module-level `lastShapedAngle` and resolves the LIVE lift tip; the outline must
   resolve the RECORDED `brushId`/`toolOverrides` and stay side-effect free. Reuse
   `liftShapeForStroke` + a shared pressure/radius helper instead.

**Primary recommendation:** Add the filter as an optional third argument everywhere
(`listSelectableAquarelleStrokes`, `hitTestAquarelleStroke`), pass it ONLY from the edition
port, keep the Studio's dialog-bundle call at the 2-arg default `'all'`, and put the ribbon
builder in a new pure `view/aquarelleLiftRibbon.ts` with a module-level bounded cache keyed
by `(mutationId, revision, width, height)`.

## Findings

### A. The select/outline stack — where the filter and the switch attach

- **Single exit/entry choke point** is `setAquarelleSelectMode`, which today is a bare
  delegation:
  `export function setAquarelleSelectMode(on: boolean): void {` / `setScriptSelectMode(on);`
  `}` — [VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:150-152]
- `setScriptSelectMode` **early-returns when the value is unchanged**, so a filter reset
  placed *after* the delegation would be skipped whenever select mode is already on
  (the Edit-ON-from-rail-toggle case):
  `if (scriptSelectMode.value === on) return;` — [VERIFIED: app/src/components/physic-paint/view/scriptStrokeEdition.ts:129-139]
  Its off-branch clears selection + drag + transform (`clearScriptStrokeSelection(); clearScriptStrokeDrag(); clearScriptStrokeTransform();`), which already satisfies "OFF leaves select mode (selection clears)".
- `aquarelleSelectMode` is an alias of the shared signal (`export const aquarelleSelectMode` re-export of `scriptSelectMode`), so there is no second boolean to add; active state
  `selectMode && filter === 'lift'` belongs in the switch leaf. `temporaryMove` already exists
  as the *other* arm of `selectActive` and must not be folded into the Edit switch
  (`const selectActive = aquarelleSelectMode.value || temporaryMove.value;` —
  [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:73]).
- The listing is `listSelectableAquarelleStrokes(playFrame, size)`; it reads the revision,
  builds `stackOrder` from `getAquarelleEventsForFrame`, and pushes one entry per live stroke
  of that frame with `pointsPx: decimateScriptPoints(pointsPx)` and
  `bounds: scriptStrokeBoundsPx(pointsPx, Number(stroke.params['size']))` —
  [VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:279-314].
  `stackPosition` / `stackTotal` come from the full frame listing, which is why the Studio's
  dialog-bundle call must stay unfiltered.
- **Callers of the listing** (all 2-arg today): the edition port
  `listStrokes: (playFrame, size) => listSelectableAquarelleStrokes(playFrame, size),` —
  [VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:321-327]; the
  Studio dialog bundle `listStrokes: (frame, size) => listSelectableAquarelleStrokes(frame, size),`
  — [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:9220]; and tests
  (`aquarelleStrokeSelection.test.ts`, `aquarelleRecordState.reorder.test.ts:391`).
- **Hit test** is newest-first, frame- and deleted-scoped, with the radius from
  `strokeRadiusPx` = `Math.max(MIN_STROKE_PAD_PX, declared / 2)` —
  [VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:196-230].
  Lifts need the footprint radius instead, so this function needs the same optional filter +
  a `kind`-aware radius.
- **The overlay leaf** is `ScriptStrokeOverlay` (one implementation for all modules):
  early return `if (!selectMode && !moveArmed && drag === null && transformPreview === null) return null;`,
  then `const strokes = props.port.listStrokes(playFrame, size);` on every render —
  [VERIFIED: app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx:127-137].
  Because the leaf re-renders on every drag/transform preview tick, a listing that rebuilt
  ribbons would rebuild them per pointermove — hence the memo.
- Per-entry drawing is one `strokes.map(entry => …)` with the selected polyline
  (`stroke={SELECTED_STROKE_COLOR}` 2px) vs. the unselected dual outline (dark 2px + light
  1px), a `<rect>` box that is solid-when-selected / `strokeDasharray='4 3'` when not, and
  the badge chip — [VERIFIED: app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx:349-459].
  The drag/transform preview already maps each centerline point through the SAME generic:
  `const moved = transformed ? applyScriptStrokeTransform(p, transformPreview!) : p;` then
  `+ offsetX/offsetY` — [VERIFIED: app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx:361-368].
  `applyScriptStrokeTransform<T extends ScriptTransformPoint>(point: T, transform)` is
  generic over `{x,y}` — [VERIFIED: app/src/components/physic-paint/view/scriptStrokeTransform.ts:208-220] —
  so the ribbon polygon maps with the identical call; nothing new is needed.
- The watercolor adapter binds the port and passes `selectMode={aquarelleSelectMode.value}`
  / `moveArmed={temporaryMove.value}` — [VERIFIED: app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx:32-55];
  it mounts between the canvas and the cursor
  ([VERIFIED: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:961-969]).
- `AquarelleBrushCursor` returns null while `aquarelleSelectMode.value || temporaryMove.value`,
  so the cursor ring can never be confused with the red ribbon
  ([VERIFIED: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:111-114], asserted in `PhysicsPaintStudio.test.ts:3096-3101`).
- Deleting the last stroke exits select mode inside `beginAquarelleDeleteEdit`:
  `if (aquarelleLiveStrokeCount.value === 0) setAquarelleSelectMode(false);` —
  [VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:492]. That path
  now also resets the filter (it goes through the wrapper) — desired.
- Tool switches also exit select mode before switching
  (`setAquarelleSelectMode(false); setAquarelleTool(id);` —
  [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:90-93] and
  [VERIFIED: app/src/components/physic-paint/view/AquarelleToolRow.tsx:59-61]).

### B. Stroke Settings dialog — open law, tabs, empty state, dismissal

- Open law (shared, module-agnostic):
  `return args.surfaceActive` / `&& args.selectionSize > 0` /
  `&& (!args.dismissed || args.sawEmptySinceDismiss);` —
  [VERIFIED: app/src/components/physic-paint/view/strokeSettingsModel.ts:211-215]
- Re-arm edge: `return args.dismissed && args.surfaceActive && args.selectionSize === 0;` —
  [VERIFIED: app/src/components/physic-paint/view/strokeSettingsModel.ts:224-226]
- Dialog state: `dismissed` is a ref-held signal created once and **never reset**
  ([VERIFIED: app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:273-274]);
  `sawEmptySinceDismiss` is a module-level `let` armed by a plain render-body flag write
  ([VERIFIED: …/PhysicsPaintStrokeSettingsDialog.tsx:306-308]).
- Close path: `closeSurface` prefers the bundle's `closeMoveMode` and only falls back to
  sticky dismissal when it is absent
  ([VERIFIED: …/PhysicsPaintStrokeSettingsDialog.tsx:325-332]). The **only** bundle producer
  supplies it as `closeMoveMode: () => { if (aquarelleSelectMode.peek()) toggleAquarelleSelectMode(); }` —
  [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:9227-9229]. The 261027-klx
  Brush bundle is gone (`module: 'watercolor'` is the only producer,
  [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:9214-9215]).
  **Consequence:** "explicit close wins while the Edit switch stays on" requires the
  watercolor close to dismiss WITHOUT exiting select mode. That is the one behavioral change
  the requirement forces, and it activates the `dismissed` branch for the first time.
- Shell gates: `if (!bundle || !open) return null;` then
  `if (appearances.length === 0) return null;` —
  [VERIFIED: …/PhysicsPaintStrokeSettingsDialog.tsx:355, 365]. The empty state ("Select a
  stroke to edit.") is inserted at line 365 and must render the header (close button),
  the new filter row, and the tab row so the dialog stays dismissible.
- Tabs: `type StrokeSettingsTab = 'geometry' | 'stack' | 'paint';` —
  [VERIFIED: …/PhysicsPaintStrokeSettingsDialog.tsx:102]; active-tab fallback is
  `requestedSettingsTab === 'stack' && !stackTabAvailable ? 'geometry' : requestedSettingsTab`
  ([…:357-361]) and the row skips a tab with `if (tab.key === 'stack' && !stackTabAvailable) return null;`
  ([…:574-575]). The Paint-tab hide under filter `'lift'` is the same pattern; the fallback
  must include `'paint'` when the filter is `'lift'`.
- The dialog computes `strokes = bundle.listStrokes(bundle.playFrame, bundle.canvasSize)` for
  the selection box and Stack neighbours ([…:395-415]) — this is the call that must keep
  `'all'`.
- The filter row goes between the header (`:543-566`) and the tab row (`:568-592`). Existing
  chrome to reuse: `.physics-paint-segmented-button` + `.active`
  ([VERIFIED: app/src/components/physic-paint/physicsPaintStudio.css:570-600]) or the tab
  chrome `.physics-paint-options-tab` ([…css:1350-1408]). Requirement fixes the testids:
  `stroke-settings-filter-all|eraser|paint`.

### C. `watercolorMoveAvailable` through the memoized top bar

- `const watercolorMoveAvailable = useComputed(() => { … void aquarelleStrokesRevision.value; void rotoModelGeneration.value; … return hasAquarelleScriptForFrame(cell.appFrame); });` —
  [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:1686-1700].
- **The precedent to copy** is the tool rail: the memo deps list carries the signal object by
  identity and the leaf reads `.value`:
  `selectAvailable: watercolorMoveAvailable,` in the memo body
  [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:5553-5556],
  typed `selectAvailable: ReadonlySignal<boolean>` [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:62-63]
  and read in the leaf as `disabled={disabled || !selectAvailable.value}`
  [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:105].
- The top bar memo deps are explicit:
  `topBarPropsMemo.resolve([settings.size, settings.opacity, readyToApply, staticControlsLocked, handleBrushSizeChange, handleOpacityChange, handleSelectLiftStrokes], …)` —
  [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:5531-5546]. Remove
  `handleSelectLiftStrokes` from BOTH the deps and the body; add `watercolorMoveAvailable` by
  identity.
- **Hard test constraint:** `expect(studio).not.toContain('aquarelleSelectMode.value');` —
  [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.test.ts:3087]. The switch must
  read `aquarelleSelectMode.value` / the filter signal inside `PhysicsPaintTopBar.tsx` (its
  own leaf), never in the Studio body. `MemoizedPhysicsPaintTopBar` is a `memo()` wrap, so a
  signal read inside it still re-renders only the top bar.
- **Vestigial dep to delete:** `handleSelectLiftStrokes` appears in the right-panel memo deps
  although the build body never uses it
  ([VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:5769]).
- The switch is placed where the removed button sits — inside the Lift cluster
  (`activeTool === 'lift'`), after the Strength row:
  `<button … class="physics-paint-segmented-button physics-paint-topbar-lift-select" data-testid="physics-lift-select" onClick={onSelectLiftStrokes} disabled={disabled || onSelectLiftStrokes === undefined} title="Select every Lift stroke on this frame">` `Select lifts`
  — [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:256-265].
  Markup to copy verbatim — `ScriptRecordingSwitch`
  [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:108-129]:
  `role="switch"`, `aria-checked={enabled ? 'true' : 'false'}`,
  `class={\`physics-paint-script-switch${enabled ? ' is-on' : ''}\`}`,
  track/knob/label spans, click via `setter(!signal.peek())`. CSS already exists at
  `.physics-paint-script-switch` … `-label`
  ([VERIFIED: app/src/components/physic-paint/physicsPaintStudio.css:817-879]) — reuse the
  class names for identical styling, or add an `.is-disabled` arm; there is currently no
  `:disabled` rule on the switch because the Script switch is never disabled
  (`/* Never disabled … */`, [PhysicsPaintTopBar.tsx:106]).

### D. Footprint math to reuse

The punch radius (what the red ribbon must depict) is, verbatim:

```
const LIFT_SIZE_BASE = 0.012;
const LIFT_SIZE_PRESSURE = 0.03;
…
function normalizePressure(p: number | undefined): number {
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0) return LIFT_PRESSURE_SENTINEL;
  return p > 1 ? 1 : p;
}
…
const engineSize =
  typeof engine.size === 'number' && Number.isFinite(engine.size) ? engine.size : 0.375;
const sizeMult = Math.pow(3, (engineSize - 0.5) * 2);
…
const radiusAt = (pressure: number | undefined): number =>
  (LIFT_SIZE_BASE + LIFT_SIZE_PRESSURE * normalizePressure(pressure)) * sizeMult;
```
[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:48-49, 154-158, 176-189]
with `const LIFT_PRESSURE_SENTINEL = 0.45;` [VERIFIED: …:58].

> `normalizePressure` is **module-private** (not in the `export` list of that file). Sharing the
> sentinel requires exporting it, or exporting a `liftRadiusDoc(pressure, engineSize)` helper and
> having `collectLiftDabs` call it too. Same for `LIFT_SIZE_BASE` / `LIFT_SIZE_PRESSURE`.
> [VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:45-67 vs 154-158]

- `engineSize` above is `toEngineParams(stroke.params).size ?? 0.375`
  ([VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:175-177]) and the
  canonical→engine mapping is
  `if (sizePx <= 32) return Math.max(0, sizePx / 32); if (sizePx <= LEGACY_SIZE_MAX_PX) return 1;` then a
  linear 80..800 band [VERIFIED: packages/efx-watercolor/src/playground/params.ts:51-65].
  The engine multiplies by the same `Math.pow(3, (this.params.size - 0.5) * 2)`
  ([VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1527]) and lift radius is
  `(0.012 + 0.03 * pr) * m` ([VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1537]).
  Note the two different defaults (0.5 in `aquarelleFootprint.ts`, 0.375 in the punch) — for a
  recorded stroke `params.size` is always present, so it does not matter, but do not copy 0.5
  into the ribbon path.
- **Do NOT call `aquarelleFootprintFor`.** It writes module state
  (`let lastShapedAngle = 0;` at :60, written by `angleFor` at :103-115) and resolves the
  LIVE tip through its single-entry brush cache
  ([VERIFIED: app/src/components/physic-paint/engine/aquarelleFootprint.ts:57-84, 103-146]).
  Its lift arm does contain the right law (`radiusDoc: (0.012 + 0.03 * input.pressure) * sizeMult`,
  `aspect: brush.aspect`, `rounded: brush.aspect < ROUNDED_ASPECT`,
  [VERIFIED: …:131-138]) — mirror those three fields, do not call the function.
- The recorded shape comes from `liftShapeForStroke(stroke)` →
  `{ tipData, tipSize, aspect, angle: brush.angle * DEG, rotation }`
  ([VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:90-101]).
  `rounded` should mirror `aspect < 0.6` (`const ROUNDED_ASPECT = 0.6;`
  [VERIFIED: app/src/components/physic-paint/engine/aquarelleFootprint.ts:55]).
- **What the punch actually covers:** both shaders build
  `vec2 p = vUv - uPoint; p.x *= uAspect; vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius; q.y /= uTipAspect; if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;`
  ([VERIFIED: packages/efx-watercolor/src/playground/shaders.ts:265-287] for `liftFS`, same
  envelope in `stampFS` at :35-66). So the erase boundary is a **rotated rectangle** with
  half-extents `(R, aR)` in document-height units, masked by the tip contour — an ellipse (or
  capsule) band is a declared visual approximation, not the exact set.
- **UV → px bridge:** `{ x: point.x * size.width, y: (1 - point.y) * size.height }`
  ([VERIFIED: app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts:36-44]).
  The punch converts radius as `rPx = max(1, one.r * height)` on BOTH axes (document heights),
  so the ribbon radius in canvas px is `radiusDoc * canvasHeight` — not a per-axis conversion.
- **Support radius formulae** for the band offset (normal at angle φ, tip axis at θ, long
  semi-axis R, aspect a):
  - ellipse (a ≥ 0.6): `h = R * sqrt(cos²(φ−θ) + a² * sin²(φ−θ))`
  - capsule/rounded (a < 0.6): `h = (R − aR) * |cos(φ−θ)| + aR`
  - actual punch square: `h = R * |u·n| + aR * |v·n|`
  Recommendation: elliptical support for a ≥ 0.6 and capsule for a < 0.6 (matches the
  round-cap law and stays smooth); the square support is up to ~40 % wider on the diagonals
  and would look boxy against circular caps. Caps use the end point's own R per the locked
  decision.
- **Angle law to mirror** (so the ribbon's `θ` matches the punch):
  `if (shape.rotation === 'follow') return segmentAngle + shape.angle;`
  `if (shape.rotation === 'random') return shape.angle;`
  `return azimuth ?? shape.angle;`
  [VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:201-206]
  For `'random'` use `shape.angle` (the preset) — the declared approximation, do not call RNG.
- Ribbon direction is in the **canvas** frame: the punch angle is a UV-frame (y-up) angle, so
  the normal used for the offset must be derived in UV (or the y component negated when mapped
  to px). `aquarelleUvToEnginePixel` flips y, and `aquarelleEnginePixelToUv` is its inverse
  ([VERIFIED: app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts:46-66]); the
  transform handler already negates the angle on the way in
  (`angleRad: -transform.angleRad,` [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:7347]).

### E. Tilt semantics (sticky azimuth)

- Recorded points carry `tx`/`ty` on top of `{x, y, p, tw}`
  (`AquarellePoint {x,y,p,tx,ty,tw}` in `packages/efx-watercolor/src/payload/toStudioStroke.ts:69-90`).
- The punch mirrors the engine exactly:
  `if (Math.hypot(p.tx, p.ty) > 12) azimuth = Math.atan2(-p.ty, p.tx);` — scanned **before**
  the point's dabs, and the azimuth is **sticky** (never cleared), so the tilt of point *i*
  governs the segment ending on it
  [VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:194-197].
- The engine source of truth: `if (Math.hypot(q.tx, q.ty) > 12) s.azimuth = Math.atan2(-q.ty, q.tx);`
  in `processInput` [VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1571], and
  `else a = s.azimuth ?? b.angle * DEG;` in `brushAngle`
  [VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1549-1559].
- `follow` uses the segment direction with the document aspect applied to x
  (`dx = (b.x - a.x) * aspect; dy = b.y - a.y;`), which is the punch's declared approximation
  for the engine's smoothed velocity angle
  [VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:193-206].
- `TILT_THRESHOLD = 12` and `ROUNDED_ASPECT = 0.6` are duplicated in
  `aquarelleFootprint.ts:53-55`; reuse those constants rather than adding literals.

### F. Test landscape — every pin on the changed surface

| File | What it pins | Effect of this task |
|---|---|---|
| `view/PhysicsPaintTopBar.test.ts:494-559` | `physics-lift-select` exists and routes; source contains `onSelectLiftStrokes`, `label="Lift strength"`, `min={5}`, `max={90}` | **Rewrite**: expect `physics-lift-edit`, `role="switch"`, no `onSelectLiftStrokes`; `label="Lift strength"` → "Eraser strength" |
| `…PhysicsPaintTopBar.test.ts:248-257` | partial `vi.doMock('./aquarelleRecordState', …)` with 8 exports only | Safe (ESM live bindings go `undefined`, no module-scope call in `aquarelleStrokeSelection.ts`) — but re-run this test after adding the import; it renders the full TopBar with `aquarelleActiveTool: {value:'brush'}` mock, so the switch never mounts there |
| `…PhysicsPaintTopBar.test.ts:475-490` | switch CSS contract (track 40×22, `#5a5d61`, `#2f9fe0`, knob 16px, `translateX(18px)`, label 12px) | Unchanged if the class names are reused; extend with an `.is-on`/`disabled` assertion for Edit |
| `view/aquarelleStrokeSelection.test.ts:471-494` | `selectAquarelleLiftStrokes` returns counts | **Delete** with the function; add filter + ribbon-radius coverage |
| `view/aquarelleStrokeSelection.test.ts:115-200` | hit-test/listing return ids | Extend: filtered listing/hit-test, `kind`, prune-on-filter |
| `view/AquarelleToolRow.test.tsx:144-148` + launcher `AquarelleToolRow.test.tsx.test.ts` | `const TOOLS = ['Brush','Water','Pen','Lift']` and label asserts | **Update** to `'Eraser'` (this is the only `.test.tsx` collected via the launcher sibling — `.test.tsx` alone is never collected, `app/vitest.config.ts:5`) |
| `view/strokeSettingsModel.test.ts:271, 290` | two `SelectableScriptStroke` literals (`pointsPx: []`, `bounds`, `serial`, `stackPosition`, `stackTotal`, `color`) | **Add `kind: 'paint'`** to both; add open-law cases for `keepOpenOnEmpty` |
| `…strokeSettingsModel.test.ts:440-478, 486-876` | open law, tabs, stack visibility, empty | Extend: filter row, Paint tab hidden at `'lift'`, fallback, empty state |
| `PhysicsPaintStudio.test.ts:3024-3044` | rail select pins incl. `disabled={disabled || !selectAvailable.value}` | Unchanged; the new switch must follow the same idiom (new pin) |
| `PhysicsPaintStudio.test.ts:3086-3102` | Studio body must NOT contain `aquarelleSelectMode.value`/`scriptSelectMode.value`; layer reads live after `function AquarelleBrushCursor` | **Constraint on the design**, not a rewrite |
| `PhysicsPaintStudio.test.ts:1024-1035`, `2589-2628` | top-bar memo deps/body | Update if `handleSelectLiftStrokes` is asserted anywhere (it is not) — keep `onBrushSizeChange`/`onOpacityChange` pins intact |
| `PhysicsPaintStudio.test.ts:2986-3002` | overlay mount order + early-return string | Unchanged |
| `roto/aquarelleLiftEraseContract.test.ts:532-537` | pins the three user-facing strings **containing "Lift"** (`'Lift needs Script ON…'`, `'Lifted — erased pixels…'`, `'…The recorded Lift applies on the next Apply.'`) | **Update** to the "Eraser" copy (copy-only rename in `PhysicsPaintStudio.tsx:268, 272-273`) |
| `roto/aquarelleLiftErase.test.ts:623-720` | per-dab angle law + `liftShapeForStroke` | Unchanged; the ribbon pins here should be additive |
| `view/aquarelleRecordState.reorder.test.ts:391` | `listSelectableAquarelleStrokes(708, SIZE)` | Default arg keeps it green |
| `components/shared/NumericStepper.test.tsx` | scans `PhysicsPaintTopBar.tsx` for `type="number"` | Unchanged (no number input added) |

### G. Repo-specific pitfalls

1. **Filter reset must precede the early return.** Put it in `setAquarelleSelectMode`, compute
   `next = on ? (filter ?? 'all') : 'all'`, compare-then-write the filter, *then* delegate
   ([scriptStrokeEdition.ts:129-139]).
2. **Never read the filter inside `listSelectableAquarelleStrokes`.** It must be a parameter
   with default `'all'`; otherwise the Studio's dialog-bundle call would silently become
   filter-scoped and Stack positions would collapse.
3. **The header of `aquarelleSelection.test.ts` imports `selectAquarelleLiftStrokes` at line 42** —
   delete the import with the function or the suite fails to load.
4. **Placement of the top bar:** the Lift cluster is only mounted when `activeTool === 'lift'`
   (`{activeTool === 'lift' ? (…` at [PhysicsPaintTopBar.tsx:232]). The Edit switch therefore
   only appears with the Eraser tool selected — that is the literal "replace in place"
   reading of the requirement; confirm with the planner that this is intended rather than
   lifting the switch into the left cluster.
5. **`MIN_STROKE_PAD_PX = 6`** is the floor for both the existing hit radius and the new
   lift `hitRadiusPx` ([scriptStrokeEdition.ts:288-296] shows the same floor for bounds).
6. **Ribbon bounds feed the transform box.** `scriptStrokeSelectionBox` unions `bounds`, so
   changing lift bounds to the padded ribbon bbox automatically moves the 9 handles. Do not
   separately touch the handle code.
7. **`aquarelleStrokesRevision` bumps** on move/transform commit
   (`bumpAquarelleStrokesRevision();` at the end of `translateAquarelleStrokesInScript`
   and `transformAquarelleStrokesInScript`,
   [VERIFIED: app/src/components/physic-paint/view/aquarelleRecordState.ts:623, 841]) and on
   delete/record/restack — so the locked memo key `(mutationId, revision, w, h)` does
   invalidate after a committed edit. A move that FAILS restores the snapshot and returns
   without a bump; the ribbon is then already correct because nothing moved.
8. **Nonzero fill for self-intersections** means the `<path>` needs `fill-rule="nonzero"` and a
   closed `d` (append `Z`); do not use `evenodd`.
9. **Do not emit a `<polyline>` plus a ribbon** for lifts — the requirement forbids the dual
   outline; a single `<path>` fill + one stroke is the whole lift branch.
10. **Copy-only rename scope (verified visible strings):**
    `label="Lift strength"` / `ariaLabel="Lift strength"` [PhysicsPaintTopBar.tsx:246, 253];
    `aria-label="Lift shape"` [view/LiftShapePicker.tsx:45];
    `{ id: 'lift', label: 'Lift', Icon: Eraser }` in both
    [PhysicsPaintToolRail.tsx:48] and [AquarelleToolRow.tsx:27];
    the three Studio refusal/status constants [PhysicsPaintStudio.tsx:268, 272-273];
    the two `Select lifts` messages [PhysicsPaintStudio.tsx:5524, 5528] (removed with the handler).
    Do **not** touch `tool: 'lift'`, `params['lift']`, `aquarelleLift*` identifiers,
    `AQUARELLE_LIFT_*` constants, CSS class names, file names, or serialized payloads.

## Recommended approach

1. **`view/scriptStrokeEdition.ts`** — extend `SelectableScriptStroke` with
   `kind: 'paint' | 'lift'` and optional `ribbonPx?: CanvasPoint[]` + `hitRadiusPx?: number`
   (additive for paint strokes keeps `scriptStrokeSelectionBox`, the badge and the material
   fixtures simple). No new signals here.
2. **`view/aquarelleLiftRibbon.ts`** (new, pure) — `liftFootprintAt(point, shape, sizeMult, aspect)` →
   `{ radiusPx, angleRad, rounded }`; `buildLiftRibbon(pointsPx, radii, angles, rounded)` →
   closed polygon with round caps; `buildLiftRibbonCached(stroke, size, revision)` backed by a
   module-level `Map<number, { stamp: string; polygon: CanvasPoint[]; hitRadiusPx: number }>`
   that **clears whenever `(revision, width, height)` changes** and drops ids absent from the
   newest listing. Import `liftShapeForStroke` + the exported pressure helper from
   `roto/aquarelleLiftErase.ts`; never import `aquarelleFootprintFor`.
3. **`roto/aquarelleLiftErase.ts`** — export `normalizePressure` (or a
   `liftRadiusDoc(pressure, engineSize)` built on `LIFT_SIZE_BASE`/`LIFT_SIZE_PRESSURE`) and have
   `radiusAt` use it, so the ribbon and the punch share one law by construction.
4. **`view/aquarelleStrokeSelection.ts`** — add `aquarelleStrokeTypeFilter` + compare-then-write
   `setAquarelleStrokeTypeFilter` with selection pruning (drop selected ids whose stroke tool no
   longer matches); widen `setAquarelleSelectMode(on, filter?)` per the choke-point rule; add the
   optional filter to the listing and the hit test; set `kind`, `ribbonPx`, `hitRadiusPx` and the
   padded ribbon `bounds` for lifts in the listing; make the port read
   `aquarelleStrokeTypeFilter.value` (live read, no capture); delete `selectAquarelleLiftStrokes`.
5. **`engine/ScriptStrokeOverlay.tsx`** — one `entry.kind === 'lift'` branch: `<path>` with the
   memoized polygon mapped through `applyScriptStrokeTransform`/drag offset, `fill="#ef4444"`
   `fillOpacity≈0.14`, `fill-rule="nonzero"`, one `stroke="#ef4444"` at 2.5 px (3.5 px selected),
   no dashed rect; badge unchanged; paint branch untouched.
6. **`view/PhysicsPaintTopBar.tsx`** — delete `onSelectLiftStrokes`; add
   `moveAvailable: ReadonlySignal<boolean>` and an `EditSwitch` (markup copied from
   `ScriptRecordingSwitch`, `data-testid="physics-lift-edit"`, label "Edit") that reads
   `aquarelleSelectMode.value`, `aquarelleStrokeTypeFilter.value` and `props.moveAvailable.value`
   in its own body, and on click calls `setAquarelleSelectMode(!active, 'lift')` /
   `setAquarelleSelectMode(false)`.
7. **`view/strokeSettingsModel.ts`** — `keepOpenOnEmpty?: boolean` in the open args (default
   false) and gate `shouldMarkSawEmpty` on it; dialog bundle gains the filter accessors.
8. **`view/PhysicsPaintStrokeSettingsDialog.tsx`** — filter segmented row above the tabs
   (`stroke-settings-filter-all|eraser|paint`), Paint tab hidden at `'lift'` with fallback,
   empty state at line 365, close path that dismisses without exiting select mode for
   watercolor, `dismissed` re-armed on the select-mode exit→enter edge.
9. **`PhysicsPaintStudio.tsx`** — remove `handleSelectLiftStrokes`, its import and both memo
   references; add `watercolorMoveAvailable` to the top-bar memo by identity; pass
   `keepOpenOnEmpty: true` and the close behavior in the dialog bundle; rename the three visible
   "Lift" copy constants; keep `listStrokes` 2-arg.

## Risks / pitfalls

- **The switch is only reachable with the Eraser tool active** (Lift cluster is conditional).
  If the intent is a global Edit switch, the placement must move — flag as a planning decision,
  not an implementation detail.
- **`keepOpenOnEmpty` widens the open law.** With `selectionSize === 0` allowed, the dialog can
  render over an empty frame; the Empty state must not depend on `bundle.readAppearance`.
- **`dismissed` never resets today.** Re-arming it on the select-mode edge requires either a
  session-key comparison inside the dialog or a signal the Studio bumps on exit — a render-body
  reset would violate rule 6 of `efx-preact-reactivity`.
- **Ribbon cost:** decimation caps at 96 points (`MAX_POLYLINE_POINTS = 96`,
  [scriptStrokeEdition.ts:316-326]); 96 radii + 96 normals + 2 caps ≈ 200 vertices per lift per
  rebuild. Keep it in the cache, never in the render body.
- **Self-intersecting caps** on a 2-point stroke: the cap sweep degenerates when consecutive
  points coincide; skip zero-length segments (the punch does the same via its stationery-dab
  rule).
- **Angle frame:** using a canvas-frame angle with a UV-frame tilt sign silently mirrors the
  ribbon on a 2:1 canvas — that is the most likely geometry bug. Pin it with a test that
  compares one ribbon vertex against `collectLiftDabs` geometry on an asymmetric sheet.
- **String pins:** three tests assert literal "Lift" copy (`aquarelleLiftEraseContract.test.ts:532-537`,
  `PhysicsPaintTopBar.test.ts:519`, `AquarelleToolRow.test.tsx:144-148`); a copy rename without
  touching them leaves the suite red.

## Files to touch

| File | Change |
|---|---|
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | `SelectableScriptStroke.kind` (+ optional ribbon fields) |
| `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts` | **new** pure ribbon builder + bounded cache |
| `app/src/components/physic-paint/roto/aquarelleLiftErase.ts` | share `normalizePressure` / radius law (exports only) |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | filter signal + setter + pruning, choke-point filter, listing/hit-test filter + `kind`/ribbon/bounds, port, remove `selectAquarelleLiftStrokes` |
| `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` | lift ribbon branch; keep gestures/transform box/badge |
| `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` | Edit switch, remove `onSelectLiftStrokes`, "Eraser strength" copy |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | `keepOpenOnEmpty`, `shouldMarkSawEmpty` gate, bundle filter accessors |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | filter row, Paint-tab hide + fallback, empty state, dismiss-without-exit |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | handler removal, memo changes, bundle flags, copy rename |
| `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`, `view/AquarelleToolRow.tsx`, `view/LiftShapePicker.tsx` | copy-only "Eraser" |
| `app/src/components/physic-paint/physicsPaintStudio.css` | only if the switch needs a `:disabled` arm or the filter row needs its own class |

## Assumptions log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The Edit switch stays inside the Lift cluster (replace-in-place), so it is visible only with the Eraser tool active | If the user expects it always visible, the placement changes and the top-bar pin rewrites |
| A2 | Elliptical support radius (capsule below aspect 0.6) is the intended band offset, not the punch's exact square support | Ribbon appears ~15-40 % narrower than the true square erase envelope on diagonals |
| A3 | Round caps use the end point's long semi-axis R even for a flat tip (declared by the locked decision) | Slight over-estimate at the endpoints of a flat eraser |
| A4 | Closing the dialog must not exit select mode (derived from "stays closed until select mode fully exits and re-enters") | If close should also exit select mode, the current `closeMoveMode` behavior is already correct and only `keepOpenOnEmpty` gating is needed |
| A5 | Pruning on filter change can be frame-agnostic (drop selected ids whose stroke tool does not match) | If frame scoping matters, the setter needs a playFrame argument |

## Sources

- All findings read directly from this repo this session (file:line citations inline above).
- Engine/watercolor behaviour cross-checked against the vendored package sources
  (`packages/efx-watercolor/src/playground/{Engine,params,shaders}.ts`) — no external docs, no
  new packages.
