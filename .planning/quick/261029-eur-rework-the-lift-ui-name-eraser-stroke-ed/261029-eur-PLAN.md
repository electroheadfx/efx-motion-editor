---
phase: 261029-eur
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/aquarelleLiftRibbon.ts
  - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
  - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.tsx
  - app/src/components/physic-paint/view/LiftShapePicker.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
  - app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements:
  - EDIT-SWITCH
  - STROKE-FILTER
  - LIFT-RIBBON
  - ERASER-COPY
user_setup: []

estimate:
  # 98k, revised down from 110k: the 21-file surface is 13 source files plus 8
  # MECHANICAL pin updates (one `kind` literal, the TOOLS array, three string
  # pins, source pins) — only the three behavioural suites carry real reading
  # cost. Calibration factor is 1.0 (sample_count 0), so tokens === raw_tokens.
  tokens: 98000
  raw_tokens: 98000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The Eraser tool's top bar carries an Edit switch (role=switch, data-testid=physics-lift-edit, label 'Edit', off by default) and no one-shot 'Select lifts' button; ON derives from selectMode AND filter === 'lift'."
    - "Edit ON outlines/hit-tests only recorded lift strokes and opens Stroke Settings with Geometry | Stack (no Paint); OFF exits select mode, clears the selection and returns to painting with the Eraser tool still active."
    - "Edit ON over a frame with no lifts shows no outlines, opens the dialog with the 'Select a stroke to edit.' empty state and raises no error."
    - "The Stroke Settings filter row (All | Eraser | Paint) changes outline + hit-test only, prunes the selection, never changes rendered artwork, and leaves the Stack positions global because the Studio bundle still lists with 'all'."
    - "An explicit close of the Stroke Settings dialog during select mode leaves it closed through every later selection change and re-opens only when select mode exits and re-enters; the dismissal flag is cleared exclusively at the setAquarelleSelectMode choke point and no signal is written from a render body."
    - "Lift strokes draw as one red (#ef4444) translucent ribbon polygon whose border follows the punch's own footprint radius law; drag and transform previews move the polygon exactly like the centerline (every vertex through the same transform plus the same drag offset); clicking anywhere inside the drawn border selects it for every tip aspect, including an aspect > 1 tip whose wide side reaches beyond the bare footprint radius."
    - "CollectLiftDabs, the punch (buildLiftCoverage / punchTransmittance*), the bake and the engine are byte-identical: this is display-only. tool:'lift', the 'lift' param key, aquarelleLift* identifiers, AQUARELLE_LIFT_* constants, CSS class names, file names and serialized data keep their names."
    - "No visible 'Lift' string remains in the Studio UI copy while every existing project with recorded lift strokes still loads and edits them."
  artifacts:
    - app/src/components/physic-paint/view/aquarelleLiftRibbon.ts
    - app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  key_links:
    - "Edit switch leaf -> setAquarelleSelectMode(on, 'lift') -> aquarelleStrokeTypeFilter write BEFORE the setScriptSelectMode early return -> filtered listing -> overlay"
    - "liftRadiusDoc (exported from aquarelleLiftErase) -> collectLiftDabs radiusAt AND aquarelleLiftRibbon: one footprint law by construction"
    - "listSelectableAquarelleStrokes lift branch -> buildLiftRibbonCached(revision, width, height) -> ribbonPx / hitRadiusPx (max support) / polygon bbox + 6px grab margin -> overlay <path> and the transform box"
    - "dialog filter row -> setAquarelleStrokeTypeFilter (compare-then-write + prune) -> Paint tab visibility, Geometry fallback, live port filter"
    - "explicit close -> closeSurface writes aquarelleStrokeSettingsDismissed = true -> setAquarelleSelectMode off -> on edge clears it compare-then-write -> the dialog's open law re-arms; that choke point is the ONLY reset site and no signal is written from a render body"
---

<objective>
Rework the Lift stroke-editing UX (UI name "Eraser") in Physic Paint Studio: replace the one-shot "Select lifts" button with a derived "Edit" switch (requirement EDIT-SWITCH), add an All | Eraser | Paint stroke-type filter to the Stroke Settings dialog (STROKE-FILTER), draw lift strokes as a red ribbon that follows the real eraser footprint (LIFT-RIBBON), and rename every visible "Lift" string to "Eraser" (ERASER-COPY).

Purpose: a user must be able to enter an eraser-only editing mode in one click, see eraser strokes as shapes rather than polylines, and filter/resize/stack them without ever confusing an eraser stroke for a paint stroke. The recording, punch, bake and engine math must stay untouched — this is a display/editing-surface change only.

Output: a filtered, filter-aware stroke listing; a new pure ribbon builder; a lift branch in the shared stroke overlay; the Edit switch; the dialog filter row and its open/dismiss laws; the Eraser copy; and rewritten/extended unit tests that preserve every existing pin.

DECISION SOURCES (locked, do not revisit): `.planning/quick/261029-eur-.../261029-eur-CONTEXT.md` (ribbon = normal-offset band with round caps; memo keyed by mutationId + revision + w/h; explicit close wins; Edit switch replaces the button in place inside the Eraser cluster; ellipse support for aspect >= 0.6 and rounded-rect support below; normals derived in the UV frame; explicit close wins, and the `dismissed` reset belongs at the `setAquarelleSelectMode` choke point, never in a render body).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.planning/quick/261029-eur-rework-the-lift-ui-name-eraser-stroke-ed/261029-eur-CONTEXT.md
@.planning/quick/261029-eur-rework-the-lift-ui-name-eraser-stroke-ed/261029-eur-RESEARCH.md

Working surfaces (read only what the current task names):
- app/src/components/physic-paint/view/aquarelleStrokeSelection.ts — select mode choke point, listing, hit-test, port
- app/src/components/physic-paint/view/scriptStrokeEdition.ts — SelectableScriptStroke, setters, MIN_STROKE_PAD_PX, decimate
- app/src/components/physic-paint/roto/aquarelleLiftErase.ts — collectLiftDabs, liftShapeForStroke, the punch radius law
- app/src/components/physic-paint/engine/aquarelleFootprint.ts — the law to MIRROR but never call (it writes module state)
- app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx — the one outline/gesture surface
- app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx — ScriptRecordingSwitch markup, Lift cluster
- app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx — tabs, dismissal law, empty-state site
- app/src/components/physic-paint/view/strokeSettingsModel.ts — resolveStrokeSettingsOpen, shouldMarkSawEmpty, bundle contract
- app/src/components/physic-paint/PhysicsPaintStudio.tsx — top-bar memo, dialog bundle, copy constants (lines ~230-280, 1686-1700, 5520-5560, 7500-7515, 9210-9235)
</context>

<tasks>

<task type="tracer">
  <name>Task 1: End-to-end "Edit" switch — filter signal, choke point, filtered listing and hit-test, top-bar switch</name>
  <files>
    app/src/components/physic-paint/view/scriptStrokeEdition.ts,
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts,
    app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx,
    app/src/components/physic-paint/physicsPaintStudio.css,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts,
    app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts,
    app/src/components/physic-paint/view/strokeSettingsModel.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
Wire ONE path end to end: the Edit switch -> the filter signal -> the select-mode choke point -> the listing/hit-test -> the overlay. No ribbon geometry yet (Task 2); lift entries are still outlined as polylines in this task, and lift hit-testing keeps today's half-size radius (a functionality gap Task 2 fills, not an architectural one).

1. `scriptStrokeEdition.ts`: extend `SelectableScriptStroke` with a required `readonly kind: 'paint' | 'lift'`, plus optional `readonly ribbonPx?: CanvasPoint[]` (closed polygon in canvas px) and `readonly hitRadiusPx?: number`. Additive only; no new signals in this module. Because `kind` is required, add `kind: 'paint'` to the two `SelectableScriptStroke` literals in `strokeSettingsModel.test.ts` (`selectableStroke`, `stackStrokeFixture`) so `tsc --noEmit` stays clean.

2. `aquarelleStrokeSelection.ts`:
   - Add `export type AquarelleStrokeTypeFilter = 'all' | 'paint' | 'lift';` and `export const aquarelleStrokeTypeFilter = signal<AquarelleStrokeTypeFilter>('all');` (import `signal` alongside `computed`). Semantics per requirement STROKE-FILTER: `'paint'` means `stroke.tool !== 'lift'`.
   - Add one pure predicate `matchesAquarelleStrokeFilter(stroke, filter)` implementing exactly that.
   - `export function setAquarelleStrokeTypeFilter(next)` — compare-then-write on the value AND prune the selection to strokes matching the new filter: iterate `scriptSelectedStrokeIds.value`; keep an id when the recorded entry is absent (nothing to judge; the delete paths already prune those) or when it matches the next filter; drop it when a recorded entry mismatches. Write the pruned set through `setScriptStrokeSelection` (already compare-then-write) and write the filter only when it changed. Calling this 1000x with the same value must produce zero notifications.
   - `setAquarelleSelectMode(on: boolean, filter: AquarelleStrokeTypeFilter = 'all')` — this is the SINGLE entry/exit choke point. It MUST write the filter BEFORE delegating, because `setScriptSelectMode` early-returns when the value is unchanged: compute `const was = scriptSelectMode.peek();`, call `setAquarelleStrokeTypeFilter(on ? filter : 'all')`, then `setScriptSelectMode(on)`. This yields: entering with 'lift' keeps 'lift'; entering with no arg resets to 'all'; leaving always resets to 'all'; re-entering while already on with no arg still resets to 'all' (the early-return case). Keep `toggleAquarelleSelectMode` as is (it inherits the law).
   - Add `export const aquarelleStrokeSettingsDismissed = signal(false);` — the Stroke Settings dialog's dismissal flag, owned here so the choke point also owns its reset. Inside `setAquarelleSelectMode`, on the off -> ON transition ONLY (`on && !was`, using the `was` computed above), clear it compare-then-write: `if (aquarelleStrokeSettingsDismissed.peek()) aquarelleStrokeSettingsDismissed.value = false;`. This is the ONLY reset site in the codebase, and nothing writes it from a render body: the dialog's close handler is the only other writer (Task 3), and re-entering while already ON is NOT an exit/re-enter edge, so it never clears the flag.
   - `listSelectableAquarelleStrokes(playFrame, size, filter: AquarelleStrokeTypeFilter = 'all')`: set `kind` from `stroke.tool === 'lift'`, skip entries whose kind does not match `filter`, and keep `stackPosition` / `stackTotal` derived from the FULL frame (unchanged code: the stack order is built from every event of the frame, so a filtered listing still reports global positions — never scope the stack to the filtered subset).
   - `hitTestAquarelleStroke(pointPx, playFrame, size, filter: AquarelleStrokeTypeFilter = 'all')`: skip non-matching kinds, then apply the existing radius law (Task 2 replaces it for lifts only).
   - Editor port: `listStrokes` and `hitTestStroke` pass `aquarelleStrokeTypeFilter.value` (a LIVE read, not `.peek()`), so the overlay leaf re-renders on a filter change and the keyboard paths always agree with what is drawn.
   - Delete `selectAquarelleLiftStrokes` entirely (requirement EDIT-SWITCH removes the one-shot selection path) and drop its now-unused imports.

3. `PhysicsPaintTopBar.tsx`:
   - Remove the `onSelectLiftStrokes` prop, its destructure, and the `Select lifts` button inside the Lift cluster (the Eraser cluster holds Size + Strength + the new switch, in that order).
   - Add a required `moveAvailable: ReadonlySignal<boolean>` prop (import the type from `@preact/signals`) — the same idiom the tool rail already uses (`selectAvailable`).
   - Export a leaf `LiftEditSwitch({ disabled, moveAvailable })` that reads `aquarelleSelectMode.value` and `aquarelleStrokeTypeFilter.value` in ITS OWN body (never the Studio body — `PhysicsPaintStudio.test.ts` forbids `aquarelleSelectMode.value` in the Studio source). Derive `const active = selectMode && filter === 'lift';` (no second boolean state anywhere). Render exactly the `ScriptRecordingSwitch` markup: `<button type="button">` with `class={'physics-paint-script-switch' + (active ? ' is-on' : '')}`, `role="switch"`, `aria-checked`, track/knob/label spans, label text `Edit`, `data-testid="physics-lift-edit"`, `disabled={disabled === true || !moveAvailable.value}`, and a short title naming what ON does. Click handler: `setAquarelleSelectMode(!active, 'lift')` — one call covers both directions (OFF resets the filter to 'all' and clears the selection inside the shared setter).
   - Rename the strength slider's `label` AND `ariaLabel` to `Eraser strength` (copy-only; the id, bounds, step and `setAquarelleParam('lift', …)` call stay).
   - Update the file's header comments that still describe the removed button.

4. `physicsPaintStudio.css`: keep `.physics-paint-script-switch` and its parts untouched (their pins are a contract), add one `.physics-paint-script-switch:disabled { opacity: 0.45; cursor: not-allowed; }` arm (the Script switch is never disabled, so this is inert there), and delete the now-unused `.physics-paint-topbar-lift-select` rule plus the comment that mentions it.

5. `PhysicsPaintStudio.tsx`: delete the `handleSelectLiftStrokes` callback (including the `No Lift strokes on this frame.` message) and remove `selectAquarelleLiftStrokes` from the imports; in `topBarPropsMemo.resolve` replace `handleSelectLiftStrokes` with `watercolorMoveAvailable` by IDENTITY and pass `moveAvailable: watercolorMoveAvailable`; remove the vestigial `handleSelectLiftStrokes` entry from the `rightPanelPropsMemo` deps array (its build body never referenced it — confirm with grep before removing). Do not introduce any `.value` read of a selection signal in the Studio body.

6. Tests (rewrite pins, never delete coverage):
   - `aquarelleStrokeSelection.test.ts`: remove the `selectAquarelleLiftStrokes` import and the whole `261028-k03b select all Lift strokes` describe. Add: `kind` on listing entries; `setAquarelleSelectMode(true, 'lift')` sets filter `'lift'` + select mode on and the filtered listing returns only lifts; the filtered hit-test misses a paint stroke and hits a lift under the same pointer; `setAquarelleSelectMode(false)` resets the filter to `'all'`; `setAquarelleSelectMode(true)` while ALREADY on with filter `'lift'` resets to `'all'` and keeps select mode on (the pre-delegation reset); filter change prunes the selection both ways; the filter setter is idempotent (counting effect over `aquarelleStrokeTypeFilter` — reuse the effect/dispose idiom already in this file — 1000 identical writes run once); the edition port lists and hits through the LIVE filter; the choke-point dismissal law (set `aquarelleStrokeSettingsDismissed` true, then `setAquarelleSelectMode(true)` from OFF clears it compare-then-write, while `setAquarelleSelectMode(true)` on an already-ON session leaves it set — the early-return edge is not an exit/re-enter). Keep every existing pin.
   - `PhysicsPaintTopBar.test.ts`: `baseTopBarProps()` gains `moveAvailable: signal(true)`. Replace the `physics-lift-select` assertions with: no `physics-lift-select` anywhere; the Edit switch mounts with the Eraser tool and carries `physics-lift-edit`, `role="switch"`, `aria-checked`; clicking it from off calls the real setter (select mode on + filter `'lift'`), clicking again turns both off and resets the filter to `'all'` (restore the signals in `finally`); `moveAvailable: signal(false)` renders it disabled; source pins for `data-testid="physics-lift-edit"`, `setAquarelleSelectMode(!active, 'lift')`, `label="Eraser strength"`, `ariaLabel="Eraser strength"`, and the absence of `onSelectLiftStrokes`; a CSS pin for the new `:disabled` arm.
   - `PhysicsPaintStudio.test.ts`: pin that the Studio source no longer contains `handleSelectLiftStrokes`, `selectAquarelleLiftStrokes`, `onSelectLiftStrokes` or the removed message, that the top-bar memo deps contain `watercolorMoveAvailable`, and that the memo body contains `moveAvailable: watercolorMoveAvailable`. Keep the existing `not.toContain('aquarelleSelectMode.value')` pin green.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --dir app run typecheck</automated>
  </verify>
  <done>
    The Eraser tool's top bar shows an Edit switch (role=switch, physics-lift-edit, label "Edit", off by default) inside the Eraser cluster and no one-shot selection button; ON sets select mode + filter 'lift' and the overlay lists only lift strokes; OFF leaves select mode and clears the selection; the filter resets to 'all' on every entry/exit that does not explicitly ask for 'lift'; the selection is pruned on every filter change; the Studio body still contains no `.value` read of a selection signal; the dismissal flag exists and is cleared only on an off -> on select-mode edge; `tsc --noEmit` is clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Lift ribbon — one shared footprint radius law, a pure ribbon builder, and the overlay lift branch</name>
  <files>
    app/src/components/physic-paint/roto/aquarelleLiftErase.ts,
    app/src/components/physic-paint/view/aquarelleLiftRibbon.ts,
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts,
    app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx,
    app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts,
    app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts,
    app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
Display-only change: `collectLiftDabs`, `buildLiftCoverage`, `punchTransmittanceRgba`, `punchTransmittanceCanvas`, `punchTransmittanceBytes` and every engine file must stay behaviorally byte-identical. Nothing here may alter what a lift erases.

1. `roto/aquarelleLiftErase.ts` — share the law by construction, exports only (requirement LIFT-RIBBON): export `liftEngineSize(params)` returning `toEngineParams(params).size` when finite else `0.375`, and `liftRadiusDoc(pressure, engineSize)` returning `(0.012 + 0.03 * normalizePressure(pressure)) * 3^((engineSize - 0.5) * 2)`. Rewrite `collectLiftDabs`'s private `radiusAt` to call `liftRadiusDoc(pressure, engineSize)`; nothing else in the file changes. Keep `LIFT_SIZE_BASE`, `LIFT_SIZE_PRESSURE`, `LIFT_PRESSURE_SENTINEL`, `LIFT_TIP_ROUND` and every other export exactly as they are.

2. New `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts` — pure, Preact-free, signal-free, DOM-free, side-effect free. It MUST NOT import from `../engine/aquarelleFootprint` (that module writes `lastShapedAngle`); use `liftShapeForStroke` for the recorded shape instead. Work entirely in a doc-pixel frame `{x: uv.x * width, yUp: uv.y * height}` and convert to canvas px only at the end (`y = height - yUp`) — this is the frame that prevents the mirror bug on non-square sheets. Length-units are isotropic: `R_px = liftRadiusDoc(pressure, engineSize) * height` on BOTH axes, exactly like `buildLiftCoverage`.
   - Station law, mirroring `collectLiftDabs`: decimate to `MAX_POLYLINE_POINTS`; scan the tilt BEFORE each point with the punch's own rule (`Math.hypot(tx, ty) > 12 -> azimuth = Math.atan2(-ty, tx)`, sticky, never cleared); angle = `segmentAngle + shape.angle` for `follow` (segment angle from the punch's aspect-corrected law `Math.atan2(dy, dx * (width / height))`), `shape.angle` for `random` (the declared approximation — never call RNG, never call `aquarelleFootprintFor`), else `azimuth ?? shape.angle`.
   - Band: per station take a unit tangent from the neighbouring stations (central difference; endpoints use the adjacent segment; a zero-length step reuses the previous tangent; a single-point stroke uses (1, 0)), then `n = (-t.yUp, t.x)`, `phi = atan2(n.yUp, n.x)`, `delta = phi - theta`. Support half-width: `R * sqrt(cos²delta + a² sin²delta)` when `aspect >= LIFT_ROUNDED_ASPECT` (ellipse) and `R * |cos delta| + aR * |sin delta|` when `aspect < LIFT_ROUNDED_ASPECT` (rounded-rect) — the locked decision, one constant shared with the support maximum below. Left edge = `P + n * h`, right edge = `P - n * h`.
   - Caps: semicircles at both ends with radius = that end station's own R (declared approximation), about 8 segments each; a single-point stroke becomes a closed circle of radius R.
   - Support maximum, exported as `liftSupportFactor(aspect)`: `aspect >= LIFT_ROUNDED_ASPECT ? Math.max(1, aspect) : Math.hypot(1, aspect)` — the analytic maximum of the band's OWN support formula over the normal angle, i.e. `R * max(1, a)` on the ellipse branch (a tip wider than it is long, `a > 1`, reaches `aR` on its wide side) and `R * sqrt(1 + a^2)` on the rounded-rect branch. Declare a module-local `LIFT_ROUNDED_ASPECT = 0.6` (the engine layer's value, mirrored — this module must stay free of that module entirely, same rule as the rest of the file).
   - Exports: `liftStrokeRadiusPx(stroke, size)` = `Math.max(MIN_STROKE_PAD_PX, max over stations of liftRadiusDoc(p, engineSize) * size.height * liftSupportFactor(liftShapeForStroke(stroke).aspect))` — the hit radius is the band's MAXIMUM SUPPORT over the stroke, never the bare footprint radius. This is a correctness requirement, not a margin: every drawn edge point sits `h <= hitRadiusPx` off its own station (caps included: their radius is `R <= hitRadiusPx`), and `hitsScriptStroke` measures distance to the centerline SEGMENTS, so any pointer inside the drawn border is inside the click target for every tip aspect. A bare `max(R)` misses the wide side of an `a > 1` tip along its whole length.
   - `buildLiftRibbon(stroke, size)` returning `{ polygonPx: CanvasPoint[]; hitRadiusPx: number }`, with `hitRadiusPx` produced by that same `liftStrokeRadiusPx` law, and a closed polygon (the first vertex repeated at the end is not required; the renderer closes with Z); `buildLiftRibbonCached(stroke, mutationId, size, revision)` backed by a module-level `Map<number, { stamp: string; polygonPx; hitRadiusPx }>` whose `stamp` is `${revision}|${width}|${height}` — any stamp change clears the whole map before storing; `trimLiftRibbonCache(liveIds)` deleting ids absent from the newest listing so frame navigation cannot grow the cache. The cache is the only module state; the geometry functions themselves return fresh arrays.
   - Skip non-finite stations/radii (never emit NaN into a path `d`).

3. `aquarelleStrokeSelection.ts` — the listing fills the new fields:
   - Determine `kind` for every frame stroke; collect every lift id of the frame for `trimLiftRibbonCache`, THEN skip entries that do not match the filter (trimming must be filter-independent).
   - Lift entries: `ribbonPx` from `buildLiftRibbonCached(stroke, mutationId, size, aquarelleStrokesRevision.value)`, `hitRadiusPx` from that result, and `bounds` = the polygon's EXACT bbox expanded by `MIN_STROKE_PAD_PX` on every side. The polygon already IS the drawn border, so only the shared 6px grab margin is added — padding by `hitRadiusPx` would double the box for no visible gain and would make the nine handles float far off the ribbon. The shared transform box then follows the drawn border automatically — do not touch the handle code.
   - Paint entries: unchanged (`scriptStrokeBoundsPx`, no `ribbonPx`, no `hitRadiusPx`).
   - `hitTestAquarelleStroke`: for `kind === 'lift'` use `liftStrokeRadiusPx(stroke, size)` instead of the declared half-size radius; paints keep today's law.

4. `engine/ScriptStrokeOverlay.tsx` — one new branch per entry, no change to the gesture code:
   - Before the map, add `const LIFT_RIBBON_COLOR = '#ef4444';`.
   - Inside the map, after the drag offset and transform preview are computed for the entry, branch on `entry.kind === 'lift' && entry.ribbonPx`: map EVERY polygon vertex through the same `applyScriptStrokeTransform` call (generic over `{x, y}`) plus the same `offsetX` / `offsetY`, build one closed `d` string, and render ONE `<path>`: `fill` and `stroke` = the ribbon colour, `fillOpacity` 0.14, `fillRule="nonzero"` (self-intersections on tight turns stay filled), `strokeWidth` 2.5 unselected / 3.5 selected, `strokeLinejoin="round"`, `vectorEffect="non-scaling-stroke"`. No polyline and no per-stroke `<rect>` box for lifts (the requirement forbids the dual dark/light outline and the dashed bbox).
   - Keep the lift badge chip (same position/label/`data-testid`/`data-stroke-*` attributes) but tint its stroke and text with `LIFT_RIBBON_COLOR` when selected instead of `entry.color`.
   - The paint branch stays exactly as today; the union selection box and its handles stay for every selection (lift `bounds` now drive them); the `data-testid={dragged ? props.ghostTestId : undefined}` attribute stays on the `<g>`.

5. Tests (additive, never weakening):
   - New `view/aquarelleLiftRibbon.test.ts`: a round-tip two-point lift's band half-width at a middle station equals `liftRadiusDoc(pressure, engineSize) * canvasHeight`; a single-point round-tip lift yields a closed polygon whose bbox is the centre ± R and `hitRadiusPx === Math.max(MIN_STROKE_PAD_PX, R_px)`; an `aspect > 1` tip (built through the same recorded-shape fixture `aquarelleLiftErase.test.ts` uses to pin `liftShapeForStroke`) on a straight stroke gives `hitRadiusPx === R_px * aspect` and a probe at `1.5 * R_px` perpendicular to the centerline HITS, while the same probe misses once the shape resolves to aspect `0.5` (the bare `max(R)` law would fail the first case); on a NON-square 400x200 sheet with recorded tilt (`tx`/`ty` above the 12 threshold) and a flat tip, every dab produced by `collectLiftDabs` lies INSIDE the ribbon polygon (even-odd point-in-polygon helper in the test) while a point offset beyond the dab's own radius along the dab `across` axis lies OUTSIDE — this is the pin that catches the UV/canvas mirror; `rotation: 'random'` builds are byte-identical across calls and the long axis follows the preset angle (no RNG); the cached builder returns the same array identity for the same `(revision, width, height)` and a fresh one after a revision bump; `trimLiftRibbonCache` drops unlisted ids. Source pins: the module imports `liftRadiusDoc`/`liftShapeForStroke` from `../roto/aquarelleLiftErase` and never mentions `aquarelleFootprint`.
   - `aquarelleStrokeSelection.test.ts`: lift entries carry `kind: 'lift'`, a `ribbonPx` with more than two vertices, `hitRadiusPx >= MIN_STROKE_PAD_PX` and equal to the ribbon's maximum support (assert it against the polygon: the farthest emitted edge vertex from its station never exceeds `hitRadiusPx`), and `bounds` equal to the polygon bbox expanded by exactly `MIN_STROKE_PAD_PX`; paint entries have `ribbonPx === undefined` and their old bounds; a lift hit-test uses that radius (a probe outside the declared half-size radius but inside the widest drawn edge hits; a probe beyond `hitRadiusPx` misses).
   - `roto/aquarelleLiftErase.test.ts` (additive only): `collectLiftDabs`'s `r` at the same stations equals `liftRadiusDoc(p, liftEngineSize(params))` for a couple of pressures and sizes — the one-law pin shared with the ribbon. Leave every existing expectation untouched.
   - `PhysicsPaintStudio.test.ts` (additive source pins on the already-read `scriptStrokeOverlay` text): the overlay contains the `entry.kind === 'lift'` branch, `#ef4444`, `fillRule="nonzero"`, and preserves the paint-mode `SELECTED_STROKE_COLOR` / `OUTLINE_DARK` / `OUTLINE_LIGHT` constants; AND the LIFT-BRANCH REGION — the slice of that text from `entry.kind === 'lift'` up to the paint branch marker — contains `applyScriptStrokeTransform`, `offsetX` and `offsetY`. A branch-exists-only pin cannot catch a preview that stops mapping the polygon vertices; this region pin is the automated half of UAT row 6.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleLiftRibbon.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/roto/aquarelleLiftErase.test.ts src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --dir app run typecheck</automated>
  </verify>
  <done>
    Lift strokes list with `kind: 'lift'`, a closed `ribbonPx` polygon, a `hitRadiusPx` equal to the band's maximum support over the stroke (floored at 6px, so the wide side of an aspect > 1 tip is inside the click target) and bounds equal to the polygon bbox plus the 6px grab margin; the overlay draws one red translucent ribbon with a single solid edge whose every vertex follows the same transform and drag offset as the centerline, with the badge kept and no dashed box; the ribbon radius is produced by the same exported helper the punch uses; the ribbon builder never calls `aquarelleFootprintFor` and never mutates module state outside its bounded, revision-keyed cache; every dab centre of `collectLiftDabs` falls inside the ribbon on an asymmetric sheet.
  </done>
</task>

<task type="auto">
  <name>Task 3: Stroke Settings filter laws (dialog row, Paint-tab hide, keep-open-on-empty, explicit close wins) and the Eraser copy rename</name>
  <files>
    app/src/components/physic-paint/view/strokeSettingsModel.ts,
    app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx,
    app/src/components/physic-paint/view/AquarelleToolRow.tsx,
    app/src/components/physic-paint/view/LiftShapePicker.tsx,
    app/src/components/physic-paint/view/strokeSettingsModel.test.ts,
    app/src/components/physic-paint/view/AquarelleToolRow.test.tsx,
    app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
Requirement STROKE-FILTER (dialog half) plus ERASER-COPY. Copy rename is UI strings only: never rename `tool: 'lift'`, the `lift` param key, `aquarelleLift*` identifiers, `AQUARELLE_LIFT_*` constants, CSS class names (including `.physics-paint-topbar-lift*`), file names, or anything serialized — an existing project with recorded lift strokes must still load and edit them unchanged.

1. `view/strokeSettingsModel.ts` (pure core):
   - Add `readonly keepOpenOnEmpty?: boolean;` to `StrokeSettingsOpenArgs` and `SawEmptyArgs`.
   - `resolveStrokeSettingsOpen`: replace the `selectionSize > 0` term with `(args.selectionSize > 0 || args.keepOpenOnEmpty === true)`; the surface and dismissal terms are unchanged.
   - `shouldMarkSawEmpty`: append `&& args.keepOpenOnEmpty !== true`, so under keep-open-on-empty the `sawEmptySinceDismiss` re-arm edge is switched OFF (explicit close wins until select mode exits and re-enters).
   - Leave the bundle contract unchanged; add a one-line comment that the Studio's `listStrokes` must keep listing with the default `'all'` so Stack positions/neighbours stay global.

2. `view/PhysicsPaintStrokeSettingsDialog.tsx`:
   - Import `aquarelleStrokeTypeFilter`, `setAquarelleStrokeTypeFilter` and `aquarelleStrokeSettingsDismissed` from `./aquarelleStrokeSelection`.
   - `keepOpenOnEmpty = engineModule === 'watercolor'`; pass it into BOTH `resolveStrokeSettingsOpen` and `shouldMarkSawEmpty`. Brush behavior is unchanged (`keepOpenOnEmpty` false there).
   - Dismissal: DELETE the per-instance `dismissedRef` (the `useRef<Signal<boolean>>` declaration and its lazy init) and read the module signal in the body instead — `const dismissed = aquarelleStrokeSettingsDismissed.value;`. In `closeSurface`'s sticky branch (the one taken once the Studio stops providing `closeMoveMode`) write `aquarelleStrokeSettingsDismissed.value = true; sawEmptySinceDismiss = false;` — an EVENT-handler write. Those two sites, plus the choke point from Task 1, are the only writers of that signal.
   - Do NOT reset `dismissed` anywhere in this file, and do NOT add any session/ref bookkeeping for it: the re-arm edge lives entirely inside `setAquarelleSelectMode` (Task 1). No signal is written from a render body — the only render-body write in the file is the pre-existing plain-boolean `sawEmptySinceDismiss = true;`, which stays exactly as it is and is inert under `keepOpenOnEmpty` because `shouldMarkSawEmpty` returns false there.
   - `PhysicsPaintStudioView.tsx` mounts this dialog once with a nullable bundle and watercolor is the only bundle producer, so the module signal is behaviourally identical to the retired ref there; brush keeps its `closeMoveMode` close path and never reaches the sticky branch.
   - Read `const strokeTypeFilter = aquarelleStrokeTypeFilter.value;` in the dialog body (it is a narrow leaf — this is the subscription that repaints the row and the tab law).
   - Filter row, watercolor only, placed between the header and the tab row: a `role="group"` container with `data-testid="stroke-settings-filter"`, three buttons in the exact order All | Eraser | Paint with `data-testid="stroke-settings-filter-all" | "-eraser" | "-paint"`, `aria-pressed` on the active one, reusing the existing `SEGMENT_STYLE` / `SEGMENT_ACTIVE_STYLE` chrome, each `onClick` calling `setAquarelleStrokeTypeFilter('all' | 'lift' | 'paint')` (the setter owns pruning).
   - Paint tab hidden when the filter is `'lift'` (`const paintTabAvailable = strokeTypeFilter !== 'lift';`): skip the tab in the row (same pattern as the stack-tab skip) and extend the active-tab fallback so a requested `'paint'` resolves to `'geometry'` when the tab is unavailable.
   - Empty state: delete the `if (appearances.length === 0) return null;` early return. Keep the shell (header + filter row + tabs + resize handle) rendering, and inside the scroll area render `<span data-testid="stroke-settings-empty">Select a stroke to edit.</span>` in place of the tab content when there are no appearances. The dialog must stay dismissible in that state. `!bundle || !open` still returns null, so a brush bundle with an empty selection still closes exactly as before.
   - Do NOT add or change `closeMoveMode` handling: the Studio simply stops providing it, so `closeSurface` uses its documented sticky-dismissal fallback.

3. `PhysicsPaintStudio.tsx`: in the stroke-settings bundle remove `closeMoveMode` and add `keepOpenOnEmpty: true`; keep `listStrokes: (frame, size) => listSelectableAquarelleStrokes(frame, size)` at the 2-arg default `'all'` (Stack positions must never be filtered). Remove the now-unused `toggleAquarelleSelectMode` import if grep shows the removed close path was its only use (`noUnusedLocals` will fail typecheck otherwise). Rename the three visible message constants (constant names keep the LIFT spelling): the script-off refusal becomes `Eraser needs Script ON to erase recorded paint. Turn Script ON, or use Raster Key for a pixel-only erase.`, the permanent message becomes `Erased — removed pixels are permanent (no undo).`, and the failure message becomes `The erase did not commit — the picture is unchanged. The recorded Eraser applies on the next Apply.`.

4. Copy-only rename elsewhere: `{ id: 'lift', label: 'Eraser', Icon: Eraser }` in BOTH `view/PhysicsPaintToolRail.tsx` and `view/AquarelleToolRow.tsx`; `aria-label="Eraser shape"` in `view/LiftShapePicker.tsx`. Nothing else in those files changes.

5. Tests:
   - `view/strokeSettingsModel.test.ts`: keep the two `kind: 'paint'` literals from Task 1; add open-law cases — open with `selectionSize: 0` + `keepOpenOnEmpty: true`; stay closed when `dismissed: true` even with `keepOpenOnEmpty`; `shouldMarkSawEmpty` returns false whenever `keepOpenOnEmpty` is true; an inactive surface still never opens. Dialog component cases: the filter row renders for a watercolor bundle and not for a brush bundle (correct order/testids/`aria-pressed`); the Paint tab disappears at filter `'lift'` and returns at `'all'` and `'paint'`, with a requested `'paint'` falling back to Geometry; with select mode on and an empty selection the dialog renders `stroke-settings-empty` and the close button; clicking `stroke-settings-filter-paint` writes the filter signal; after an explicit close the dialog stays closed through further selection changes and re-opens only after select mode exits and re-enters through the real pair `setAquarelleSelectMode(false)` then `setAquarelleSelectMode(true)`; a dialog close writes `aquarelleStrokeSettingsDismissed` and the open law reads it back. Reset `aquarelleStrokeSettingsDismissed` and the filter signal in `finally` — the flag is module-level now, so an un-reset case leaks into the next one.
   - `view/AquarelleToolRow.test.tsx`: `TOOLS` becomes `['Brush', 'Water', 'Pen', 'Eraser']` (and the describe/it wording); keep the four-tool and Dry-leak assertions. It is collected only through the `AquarelleToolRow.test.tsx.test.ts` launcher — always run the launcher, never the `.test.tsx` alone.
   - `roto/aquarelleLiftEraseContract.test.ts`: update exactly the three visible message pins to the new Eraser copy; leave the group-refusal and the two "unavailable" pins untouched. Add one copy-law pin that scans the four UI files (`PhysicsPaintTopBar.tsx`, `PhysicsPaintToolRail.tsx`, `AquarelleToolRow.tsx`, `LiftShapePicker.tsx`) for user-facing `Lift` labels/aria strings (asserting their absence) while asserting the identifiers survive (`'lift'` tool ids, `setAquarelleLiftTipId`, `AQUARELLE_LIFT_` constants, `.physics-paint-topbar-lift` CSS class) — that is UAT row 8's automated half.
   - `PhysicsPaintStudio.test.ts`: pin `keepOpenOnEmpty: true`, the absence of `closeMoveMode` in the bundle, and the 2-arg unfiltered `listStrokes` call.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts</automated>
    <automated>pnpm --dir app run typecheck</automated>
  </verify>
  <done>
    In watercolor the Stroke Settings dialog carries an All | Eraser | Paint row above the tabs; the Paint tab hides in Eraser mode and a paint request falls back to Geometry; the dialog stays open on an empty selection with "Select a stroke to edit.", an explicit close wins until select mode fully exits and re-enters, and every filter change prunes the selection; switching the filter out of Eraser leaves Edit mode but stays in select mode; no visible "Lift" string remains in the Studio UI while every legacy identifier, CSS class, file name and serialized value is untouched.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| recorded script -> overlay geometry | Recorded stroke points/params drive an SVG path; malformed or non-finite values could produce an invalid/absurd path (rendering cost, broken overlay). All inputs are already-local project data; no network or IPC is added. |
| UI copy constants -> user | Copy-only renames must not touch serialized keys; no data crosses a new boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261029-eur-01 | Tampering / DoS | `view/aquarelleLiftRibbon.ts` polygon -> `ScriptStrokeOverlay` `d` | low | mitigate | The builder skips non-finite stations and radii, caps the station count at `MAX_POLYLINE_POINTS` (96, ~210 polygon vertices) and is memoized per `(mutationId, revision, width, height)` with a trim step, so a hostile or corrupt script cannot inflate path size per frame or per pointermove. No `dangerouslySetInnerHTML`; the path is built from numbers only. |
| T-261029-eur-02 | Information disclosure / Elevation | filter + select-mode choke point | low | accept | The filter only narrows outline + hit-test against the same in-memory registry the Studio already reads; no new persistence, IPC, file or network access, and no privilege change. Accepted. |
| T-261029-eur-SC | Tampering | pnpm/npm dependency installs | low | accept | No packages are added or upgraded; no manifest/lockfile change in this task. Accepted. |
</threat_model>

<verification>
Automated gates (cwd = repo root; vitest collects `src/**/*.test.ts` only, so `.test.tsx` suites run through their `.test.tsx.test.ts` launcher):

1. Per-task targeted runs listed in each `<verify>`.
2. Full app suite before declaring the plan complete: `pnpm --dir app exec vitest run` (expect the pre-existing ~6,247 app tests plus the new ones, zero failures; never run vitest in watch mode).
3. Typecheck: `pnpm --dir app run typecheck` (it also checks test files; `noUnusedLocals` catches orphaned imports such as the removed `closeMoveMode`/`selectAquarelleLiftStrokes` paths).
4. Do not start the dev server — the user runs it.

Invariants to re-assert by reading the diff:
- `collectLiftDabs`, `buildLiftCoverage`, `punchTransmittanceRgba`, `punchTransmittanceCanvas`, `punchTransmittanceBytes` and every `packages/efx-watercolor` file are unmodified in behavior (the only `aquarelleLiftErase.ts` change is extracting `liftRadiusDoc`/`liftEngineSize` and calling them from `radiusAt`).
- No `useState`; no `useEffect` used for selection or filtering; every new setter is compare-then-write; NO signal is written from any render body — `aquarelleStrokeSettingsDismissed` is written only by the dialog's close handler (event) and cleared only at the `setAquarelleSelectMode` off -> on choke point. The one render-body write left in the dialog is the pre-existing plain-boolean `sawEmptySinceDismiss = true;`, untouched and inert under `keepOpenOnEmpty`.
- `PhysicsPaintStudio.tsx` still contains no `aquarelleSelectMode.value`. The top-bar switch and the dialog read the signals.

Native UAT rows (user-run, live UI — the executor stops at "automated-ready"):
1. Eraser tool top bar: no "Select lifts"; an "Edit" switch matching Script, off by default.
2. Edit ON on a frame with lifts: overlay shows ONLY lift strokes in the new ribbon style; dialog shows Geometry | Stack (no Paint); OFF returns to painting with the Eraser tool still active.
3. Edit ON on a frame with no lifts: nothing outlined, dialog opens empty, no error, OFF works.
4. Move mode on a frame with paint + lifts: filter All by default; lifts read as a different shape/color; paint outlines unchanged.
5. Filter switcher: All/Eraser/Paint prunes the selection, the dialog stays open when the filtered set is empty, Paint tab hides in Eraser, returns in All/Paint.
6. A lift ribbon follows drag/scale/rotate previews; the move commit matches; clicking the ribbon selects it.
7. The ribbon border reads as the real eraser footprint (compare with the live cursor at the same Size and similar pressure).
8. No visible "Lift" remains in the Studio UI; an existing project with `tool:'lift'` strokes still loads and edits them.
</verification>

<success_criteria>
- Requirement EDIT-SWITCH: the "Select lifts" button, its prop, Studio handler, message and pins are gone; an Edit switch (role=switch, `physics-lift-edit`, label "Edit", off by default) sits in the same slot, derives its state from select mode + filter, drives `setAquarelleSelectMode(on, 'lift')`, and is disabled by the `watercolorMoveAvailable` signal read in the switch leaf.
- Requirement STROKE-FILTER: `aquarelleStrokeTypeFilter` + a pruning compare-then-write setter exist; the filter resets on every select-mode entry/exit except an explicit lift entry; the listing and hit-test take an optional filter and the port reads it live; the Studio bundle keeps `'all'`; lift entries never stay selected while hidden; the dialog row is All | Eraser | Paint with the pinned testids, the Paint tab hides in Eraser with a Geometry fallback, the dialog stays open on an empty watercolor selection with the "Select a stroke to edit." caption, and an explicit close wins until select mode exits and re-enters — the dismissal flag being reset only at the choke point, never in a render body.
- Requirement LIFT-RIBBON: lift entries carry `kind`, `ribbonPx` and `hitRadiusPx`; `hitRadiusPx` is the band's analytic maximum support (so an aspect > 1 wide side is clickable) and bounds are the polygon bbox plus the 6px grab margin; the overlay draws one red 0.14-opacity nonzero-filled ribbon with a single 2.5/3.5px edge, no dual outline, no dashed bbox, badge kept, every polygon vertex mapped through the same transform/offset as the centerline and pinned by a source-region test; the radius law is shared with `collectLiftDabs` through one exported helper and the ribbon builder is pure and bounded.
- Requirement ERASER-COPY: every visible string names Eraser; no identifier, constant, CSS class, file name or serialized value changed.
- Every existing test pin is preserved or rewritten (never deleted for convenience); new unit coverage exists for filter matching + pruning, edit-mode enter/exit, the empty-selection dialog + Paint-tab law, ribbon width vs `collectLiftDabs` (including a single-point lift), and the side-effect-free footprint requirement.
- `pnpm --dir app run typecheck` and the full `pnpm --dir app exec vitest run` pass.
</success_criteria>

<output>
Create `.planning/quick/261029-eur-rework-the-lift-ui-name-eraser-stroke-ed/261029-eur-SUMMARY.md` when done.
</output>
