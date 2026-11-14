---
phase: 261029-eur
reviewed: 2026-10-29T11:03:42Z
depth: quick
files_reviewed: 21
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.tsx
  - app/src/components/physic-paint/view/LiftShapePicker.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts
  - app/src/components/physic-paint/view/aquarelleLiftRibbon.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Quick Task 261029-eur: Code Review Report

**Reviewed:** 2026-10-29T11:03:42Z
**Depth:** quick
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the 21-file scope of quick 261029-eur (derived Edit switch, stroke-type filter with `keepOpenOnEmpty`, lift ribbon rendering, Lift→Eraser copy-only rename). Targeted suite run: 6 test files / 212 tests, all green. Pattern scan (secrets, `eval`, `innerHTML`, empty catch, debug artifacts) clean; the diff is exactly the 21 submitted files.

What holds up: the filter/dismissal signal law, selection pruning (unjudgeable ids preserved, compare-then-write pruning), the single `setAquarelleSelectMode` choke point, cache keying (`revision|width|height` with monotonic revision bumps and `clear()` on a stale stamp), cache trimming against the FULL frame's lift ids (filter-independent, bounded growth), the no-render-body-selection-reads rule, and the copy-only rename contract test.

What does not: the ribbon's end caps are mathematically discontinuous with the band (CR-01) and the transform preview draws a different shape than the commit produces (WR-01). The submitted tests pin neither — the containment test checks dab *centers* and does not even pass the real tip shape (WR-04). Two smaller hazards: a dead exported hit-test that bypasses the active filter (WR-02), and a brush-pick path that can strand select mode with the Edit switch unmounted (WR-03).

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Lift ribbon end caps ignore the band's support at the junction (flare / notch at every stroke end)

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts:261-289` (band at `243-258`, support function at `159-173`)

**Issue:** The band vertices use the anisotropic support function (`supportHalfWidth(station, normalX, normalYUp, aspect)` at line 255), but both end caps emit points at the constant distance `last.radius` / `first.radius` (lines 270, 286). The cap loop starts at `index = 1` (angle π/8), so the already-emitted band junction vertex is never re-emitted and the first cap point is not the band's edge.

For a follow-angle brush the station's `theta` tracks the segment direction, so the band normal is ~perpendicular to `theta` (δ≈π/2) and the band half-width is `R·aspect`. The cap instead starts at ≈`0.92R` along the normal. Concretely, for the shipped presets:

- hake (`aspect 0.2`): band edge `0.2R`, first cap vertex ≈`0.92R` → ~4.6× outward flare
- fan (`0.5`): ≈1.85× flare
- dry (`0.75`): ≈1.23× flare
- chalk (`0.8`): ≈1.15× flare

For `aspect > 1` the sign flips: the band is up to `2R`/`3R` wide (the submitted tests use aspect 2 and 3) while the cap pulls back to ≈`0.92R`, cutting a deep notch into the ribbon at both ends. The backward cap has the identical discontinuity with `first.radius`.

`261029-eur-CONTEXT.md:33` and `261029-eur-PLAN.md:182` declare "semicircular caps with radius = the end point's own R" as a declared approximation, but the result is not merely a round-cap approximation — the polygon is discontinuous with its own band, and this is exactly what undermines the plan's drawn-edges-≤-hitRadius argument (`PLAN.md:184`). The spec needs amending with the fix.

**Fix:** use the per-direction support inside the cap sweep. Because the band junction is already emitted at `±n`, skipping `index = 0` and `index = CAP_SEGMENTS` reproduces the exact junction points and restores continuity and winding:

```ts
for (let index = 1; index < CAP_SEGMENTS; index += 1) {
  const angle = (index / CAP_SEGMENTS) * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dirX = cos * lastNormal.x + sin * lastTangent.x;
  const dirYUp = cos * lastNormal.y + sin * lastTangent.y;
  const half = supportHalfWidth(last, dirX, dirYUp, aspect);
  docPolygon.push({ x: last.px + dirX * half, y: last.pyUp + dirYUp * half });
}
```

Mirror the same change for the backward cap (`first`, `-firstNormal`, `-firstTangent`). Apply the same per-direction support to the single-point branch (see IN-02). Update the CONTEXT/PLAN approximation wording so the declared law matches the geometry.

### Warnings

#### WR-01: Transform preview scales and reorients the ribbon, the commit transforms points only

**Severity:** WARNING (preview diverges from committed result)
**File:** `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx:365-375` vs `app/src/components/physic-paint/view/aquarelleRecordState.ts:812-827` and `app/src/components/physic-paint/PhysicsPaintStudio.tsx:7298-7336`

**Issue:** The overlay maps every ribbon vertex through `applyScriptStrokeTransform` (line 370). A 2× scale therefore doubles the drawn band width, and any rotation/fixed-tip preview rotates the drawn tip orientation. The commit (`transformAquarelleStrokesInScript`) maps centerline points only and copies `p`, `tx`, `ty`, `tw` unchanged (lines 815-826), and the Studio forwards the same transform without touching radius or tip angle (lines 7311-7336). Result: on commit the band width snaps back to the pressure-derived radius and fixed/random tips snap back to their recorded `theta` — the preview lies. The inline comment at 363-364 ("every vertex goes through the same transform ... as its centerline") is true of the polygon, false of the engine's footprint law. Drag-only preview is exact; scale/rotation are not.

**Fix:** never transform ribbon vertices as free geometry. Transform the centerline and rebuild the ribbon with unchanged per-point pressure and shape angle — i.e. preview `buildLiftRibbon` over the transformed stroke (the overlay entry already receives a ribbon built from the source, so extend the entry with the source needed for the rebuild, or expose a pure `previewLiftRibbon(entry, transform)` helper in `aquarelleLiftRibbon.ts`). Alternatively, if the rebuild is too invasive for this quick, restrict the polygon preview to translation and fall back to the centerline outline for scale/rotation.

#### WR-02: `selectAquarelleStrokeAt` is dead, exported, and bypasses the active filter

**Severity:** WARNING (latent wrong-selection bug + misleading API)
**File:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:324-344` (filter-bypassing call at line 335)

**Issue:** The docstring calls this "the pointer handler's ONE selection write", but no production caller exists (the live path is `scriptStrokeEdition.selectScriptStrokeAt(..., port)`; only tests import it). Worse, it calls `hitTestAquarelleStroke(pointPx, playFrame, size)` with the default filter `'all'`, so anyone who wires it up will select a paint stroke while the Eraser filter is active — and the paint tab is hidden in that mode (`PhysicsPaintStrokeSettingsDialog.tsx:402-407`), producing an invisible selection the user cannot inspect. The docstring makes the trap look intentional.

**Fix:** delete `selectAquarelleStrokeAt` (preferred — the real path lives in the edition port), or require and forward the filter:

```ts
export function selectAquarelleStrokeAt(
  pointPx: CanvasPoint,
  playFrame: number,
  size: EnginePixelSize,
  filter: AquarelleStrokeTypeFilter,
  additive = false,
): number | null {
  const hit = hitTestAquarelleStroke(pointPx, playFrame, size, filter);
  ...
```

and correct the docstring.

#### WR-03: Picking a brush in the right panel strands select mode with no Edit switch

**Severity:** WARNING (UI state trap; painting silently blocked)
**File:** `app/src/components/physic-paint/view/aquarelleRecordState.ts:192-200` (`selectAquarelleTip`), reachable via `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx:319-325` → `view/RightPanelBrushTab.tsx:31` → `WatercolorBrushLibrary`; switch gate `view/PhysicsPaintTopBar.tsx:277-302`

**Issue:** `selectAquarelleTip` calls `setAquarelleTool('brush')` on any successful pick (line 200) and never exits select mode. The right-panel Brush tab renders unconditionally when the top pane's brush tab is active (`PhysicsPaintRightPanel.tsx:319-325`), independent of tool or select state. So while Edit is ON (`selectMode === true`, `filter === 'lift'`), a brush click flips the tool to `'brush'`; `LiftEditSwitch` only renders inside the `activeTool === 'lift'` cluster (`PhysicsPaintTopBar.tsx:277-302`, switch at 301), so the only visible control that can turn Edit off unmounts. Select mode stays armed (painting blocked) and the filter stays `'lift'`. The dialog stays open on empty (`keepOpenOnEmpty: true`, `PhysicsPaintStudio.tsx:9215`) and its close path only writes the dismissal flag (watercolor bundle has no `closeMoveMode`), so the dialog cannot disarm it either. The remaining exits — the rail Select toggle or the watercolor tool row — are not discoverable from this state.

**Fix:** leave select mode on a successful tip pick. Simplest cycle-safe spot is the library click handler (`WatercolorBrushLibrary`): call `setAquarelleSelectMode(false)` before `selectAquarelleTip`. Alternatively add a tool guard to the Studio disarm effect (`PhysicsPaintStudio.tsx:2364-2371`): when watercolor is active and `activeTool !== 'lift'`, disarm. Add a regression test that a pick during Edit mode leaves `aquarelleSelectMode.value === false`.

#### WR-04: The ribbon-containment test cannot detect CR-01 and skips the real tip shape

**Severity:** WARNING (test quality — a test that cannot fail)
**File:** `app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts:133-168` (aspect test at `170-193`)

**Issue:** The containment assertion checks only dab CENTERS, and calls `collectLiftDabs` without the `shape` argument (lines 144-147), so the punch's actual tip angles and mask are not used. Centers remain well inside any polygon whose radius is slightly off, so both the CR-01 cap flare/notch and a too-narrow band pass. The aspect-3 test asserts only the maximum across (`= 3R`) somewhere on the band; the cap region is never sampled. The cache-identity tests (195-211) are fine.

**Fix:** pass `liftShapeForStroke(stroke)` to `collectLiftDabs` so the oracle uses the production tip law, and add a cap-region invariant, e.g.: for every polygon vertex near an end station, `|v - station| <= supportHalfWidth(station, dir(v)) * 1.05` (export the support helper or reproduce its documented formula in the test). Also assert the polygon edges adjacent to the junction are continuous with the band half-width (no edge longer than the local station spacing by more than the cap chord length). These fail against the current cap construction and pass against the fix.

### Info

#### IN-01: `supportHalfWidth` lacks the finite guard `liftSupportFactor` has

**Severity:** Info
**File:** `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts:159-173` (cf. `65-68`)

**Issue:** `buildStations` guards `px`/`pyUp`/`radius`/`theta` ("Never emit NaN into a path `d`", T-261029-eur-01), and `liftSupportFactor` fallbacks non-finite/negative aspect to 1, but `supportHalfWidth` uses `aspect` raw. A non-finite aspect would emit NaN vertices. Currently unreachable (preset constants through `buildBrush`'s finite/positive `mult` guard, `brushBridge.ts:42-44`), but the guard is asymmetric with the declared threat model.
**Fix:** `if (!Number.isFinite(aspect) || aspect <= 0) return station.radius;` at the top of `supportHalfWidth`, or normalize once in `buildLiftRibbon` before use.

#### IN-02: Single-point lifts draw a circle of radius R, ignoring the tip aspect

**Severity:** Info
**File:** `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts:227-241` (hit radius at `180-196`)

**Issue:** A one-sample lift renders a circle of radius `R`, while `liftStrokeRadiusPx` includes the support factor and `hitTestAquarelleStroke` uses it. For `aspect > 1` (flat/hake/filbert presets and test fixtures) the click target extends past the drawn border: clicking outside the visible ribbon selects the stroke.
**Fix:** emit the single-point polygon with the same per-direction support used to fix CR-01, so drawing and hit radius share one law.

#### IN-03: Empty-appearance caption now also applies to the brush module

**Severity:** Info
**File:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:668-672`

**Issue:** Removing `if (appearances.length === 0) return null;` and rendering "Select a stroke to edit." changes the brush module too: a non-empty selection that resolves to zero appearances (e.g. ids filtered out by a frame/script change between listing and reading) now shows an empty sheet instead of hiding. Intended for watercolor Edit mode; a brush-side behavior change not called out in the plan.
**Fix:** scope the caption to `keepOpenOnEmpty` (`module === 'watercolor' || bundle?.keepOpenOnEmpty === true`) and keep the legacy hide for the brush module, or add a regression test documenting the new brush behavior as intended.

#### IN-04: Vacuous dismissal assertion in the Edit-switch test

**Severity:** Info
**File:** `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts:553`

**Issue:** After the on→off click, `expect(aquarelleStrokeSettingsDismissed.value).toBe(false)` passes trivially — nothing in the test ever set it to `true`, and the toggle path does not touch it. The assertion would keep passing if the dismissal law regressed.
**Fix:** set `aquarelleStrokeSettingsDismissed.value = true` before the off click and assert the genuine reset path (or delete the assertion; it does not belong in this test).

#### IN-05: Uniform decimation to 96 points can cut inside the punch on sharp turns

**Severity:** Info
**File:** `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts:75-85` (constant `MAX_POLYLINE_POINTS = 96`)

**Issue:** Decimating the station polyline to 96 samples makes the band a chord approximation, while the punch stamps every `0.5·r`. On long, fast scribbles with sharp turns the drawn band can fall inside the erased region between samples. This is a shared declared render cap, not a regression, but it is the remaining source of drawn-vs-erased drift after CR-01.
**Fix:** keep the cap but split segments longer than ~`1.5·r` adaptively (insert a midpoint) instead of uniform stride decimation, or raise the cap only for stations whose turn angle exceeds a threshold.

---

_Reviewed: 2026-10-29T11:03:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
