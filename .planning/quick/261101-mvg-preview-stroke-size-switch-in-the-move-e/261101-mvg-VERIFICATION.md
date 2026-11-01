---
phase: 261101-mvg-preview-stroke-size-switch-in-the-move-e
verified: 2026-11-01T16:11:19Z
status: human_needed
score: 7/7 must-haves verified
covered_files: [".planning/quick/261101-mvg-preview-stroke-size-switch-in-the-move-e/261101-mvg-PLAN.md", ".planning/quick/261101-mvg-preview-stroke-size-switch-in-the-move-e/261101-mvg-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx", "app/src/components/physic-paint/physicsPaintStudio.css", "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx", "app/src/components/physic-paint/view/aquarelleLiftRibbon.ts", "app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts", "app/src/components/physic-paint/view/aquarelleStrokeBand.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts", "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts", "app/src/components/physic-paint/view/scriptStrokeEdition.ts", "app/src/components/physic-paint/view/strokeSettingsModel.test.ts"]
covered_digest: "v3:sha256:39707a432fbf8b0aaf78655982d321d1bd1919446b679516d018e408f39947db"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "With the switch OFF (default), open Stroke settings in Water color Select or Brush Move on a frame holding both a paint stroke and an Eraser (lift) stroke."
    expected: "No bold surface anywhere: the paint stroke shows its thin centerline (cyan when selected, dual dark/light otherwise) with its bbox as today; the Eraser shows the same thin centerline, no red ribbon, and no bbox."
    why_human: "The rendered SVG surface is visual; source and resolver pins prove the branch, only a live look proves the pixels."
  - test: "Click the header switch ON and compare each paint band with the stroke's real coverage (a size-12 round brush, a non-round tip, pressure variation, a water stroke)."
    expected: "Every listed paint stroke draws the area it actually covers on canvas (size, tip aspect, per-point pressure, water x1.3), matching the baked stroke; the Eraser keeps its red 261029-eur ribbon unchanged."
    why_human: "Footprint agreement is pinned numerically against aquarelleFootprintFor, but visual coverage against the painted result is a judgement only a live look can make."
  - test: "With the switch ON, drag a selected stroke (ghost) and rotate/scale it with the transform handles."
    expected: "Every band vertex moves with the same drag offset and transform as the centerline did before; the bold surface never lags or detaches."
    why_human: "Motion-following under a live pointer gesture cannot be exercised by the source-level pin or a headless unit run."
  - test: "Toggle between the list and settings views and check the header control, its glyph and its ON chrome."
    expected: "The Spline switch is present in the header in BOTH views (never inside the Geometry/Stack/Paint tabs), defaults to unpressed, turns blue on press, and pressing it does not start a header drag."
    why_human: "Header placement, icon legibility and the blue ON state are visual."
  - test: "Toggle the switch, close and reopen the sheet, navigate frames; then perform an edit and check Undo."
    expected: "The preference survives within the session, is never written to the document, resets to OFF on a project reload, and creates no undo entry."
    why_human: "Session lifetime and the absence of an undo entry are runtime behaviours that the unit pins model but do not observe in the live app."
---

# Quick 261101-mvg: Preview stroke size switch — Verification Report

**Task Goal:** Add a "Preview stroke size" switch to the Move/Edit Stroke settings dialog (the surface shared by Water color Select mode and Brush Move). ON draws every listed stroke as the area it actually covers on canvas — paint from its own bake footprint law, eraser keeping the 261029-eur ribbon; OFF (default, eraser included) keeps the thin centerline outlines.
**Verified:** 2026-11-01T16:11:19Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OFF (default, Eraser included) draws no bold surface: paint keeps the thin centerline (cyan selected / dual dark-light otherwise) and an Eraser draws that same centerline instead of its ribbon | ✓ VERIFIED | `ScriptStrokeOverlay.tsx:378-390` gates the band on `previewStrokeSize`; with `bandPx === undefined` the render falls to the unchanged `isSelected ? polyline : <>dual polylines</>` branches (`:432-459`), Eraser included. `resolveAquarelleStrokeBandPx` returns `undefined` whenever `strokeSizePreview.value` is false (`aquarelleStrokeSelection.ts:563`), pinned by "resolves no band for either kind while the switch is off". `strokeSizePreview` is `signal(false)` (`scriptStrokeEdition.ts:117`). |
| 2 | ON: paint draws its bake footprint band (declared size, recorded tip aspect, per-point recorded pressure, water x1.3) and the Eraser keeps the 261029-eur ribbon; `pen` is always aspect 1 even with a non-round recorded tip | ✓ VERIFIED | `buildStrokeBand` delegates `lift` to `buildLiftRibbon` (`aquarelleStrokeBand.ts:157-158`) and derives paint stations via `paintTipForStroke` + `paintRadiusDocFor` (`:161-170`). Pen forced to `{aspect: 1, angle: 0, rotation: 'fixed'}` (`:93-95`). Unit pins: element-for-element lift delegation, pressure-driven width, water ×1.3, pen non-vacuous isotropic pin, drift pin vs `aquarelleFootprintFor(radiusDoc, aspect)` with a fixed-rotation aspect-2 tip (`closeness 12`). |
| 3 | The switch renders in the Stroke settings sheet header, reachable in BOTH list and settings views, never inside Geometry/Stack/Paint tabs; toggle button with stable data-testid + aria-pressed, default OFF, session-only | ✓ VERIFIED | `PhysicsPaintStrokeSettingsDialog.tsx:809-825` places the button in the header (header is above the `view` gate at `:881`), gated on `engineModule === 'watercolor'`, `data-testid="stroke-settings-preview-stroke-size"`, `aria-pressed={previewStrokeSize}`, `title`/`aria-label` "Preview stroke size", `onPointerDown` stopPropagation, handler uses `.peek()`. Harness test renders it in both `renderDialog` and `renderSettings`, asserts default false, click → true → false, and its absence for a brush bundle. |
| 4 | Selection, hit-test, bounds, stack positions, serial, recorded script and every engine/bake/punch input identical ON vs OFF; preference never persisted, never undoable | ✓ VERIFIED | The listing diff adds only `liveBandIds` bookkeeping + `trimStrokeBandCache` (`aquarelleStrokeSelection.ts:471-480`); entry construction (`:482-541`) untouched. Test "leaves the listed entries byte-identical across the toggle" deep-equals the arrays and every field (`bounds`, `pointsPx`, `ribbonPx`, `hitRadiusPx`, `serial`, `stackPosition`, `kind`, `tool`, `brushId`, `customResponse`); "hit-tests the same stroke in both states"; "never bumps the stroke revision". Grep: `strokeSizePreview` is only defined/read in `scriptStrokeEdition.ts`, the dialog render body, the overlay leaf and the resolver — no persistence, undo/ledger or payload path. No bake/punch/engine file was touched by the phase commits. |
| 5 | Drag ghosts and transform previews move the bold surface exactly like the old ribbon/polyline: every band vertex passes through `applyScriptStrokeTransform` + drag `offsetX`/`offsetY` inside the per-entry loop | ✓ VERIFIED | `ScriptStrokeOverlay.tsx:381-390` maps every `bandPx` vertex through the same `transformed ? applyScriptStrokeTransform(p, transformPreview!) : p` expression plus `offsetX`/`offsetY` used by the centerline at `:393-400`. Studio source pin scopes the `const bandPx` → `const badgeAccent` region and asserts `previewStrokeSize`, `applyScriptStrokeTransform`, `offsetX`, `offsetY`. |
| 6 | Band geometry is ONE pure, Preact-free, signal-free reusable module that delegates the Eraser branch to the 261029-eur law | ✓ VERIFIED | `aquarelleStrokeBand.ts` (217 lines) imports only `buildBrushForStroke`/`toEngineParams`/types from `@efxlab/efx-watercolor`, payload types, `aquarelleLiftRibbon` builders, and `scriptStrokeEdition` types. Purity pin reads the source and rejects `from ...preact...` and `from ...aquarelleFootprint...` import statements (header comment names them, so it is not a bare substring gate). The lift branch is `buildLiftRibbon(stroke, size).polygonPx` — delegation, pinned element-for-element. |
| 7 | Bounded: stations decimated to `MAX_POLYLINE_POINTS`, polygon under the shared vertex budget, revision-keyed cache trimmed to the frame's live paint ids; zero valid stations returns an empty polygon and never throws on both branches | ✓ VERIFIED | `buildSupportBandStations` reuses `decimateStations` (`aquarelleLiftRibbon.ts:121`); `buildSupportBandPolygon` opens with `if (stations.length === 0) return [];` (`:236`); `buildStrokeBand` guards its paint branch (`aquarelleStrokeBand.ts:169`) and `buildLiftRibbon` keeps its early return returning `hitRadiusPx` (`aquarelleLiftRibbon.ts:337`); cache stamp `revision|width|height` + `trimStrokeBandCache` (`:186-217`); listing calls it (`aquarelleStrokeSelection.ts:480`). Unit pins: 1000-point budget, non-finite safety, zero-station paint/pen/water/lift, cache identity/trim. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Deferred Items

None — this is a quick task with no later milestone phase covering the remaining live-UAT rows.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` | One pure footprint-band entry point, both kinds, bounded cache | ✓ VERIFIED | 217 lines; exports `buildStrokeBand`, `buildStrokeBandCached`, `trimStrokeBandCache`, `paintTipForStroke`, `paintRadiusDocFor`; imported by `aquarelleStrokeSelection.ts:65` and exercised by the unit suite. |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts` | Delegation, law, framing, budget, cache, purity pins | ✓ VERIFIED | 435 lines, 21 tests green; includes the non-vacuous aspect-2 pen/footprint pins and the import-statement purity pin. |
| `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts` | Behaviour-preserving extraction of the shared station/polygon core | ✓ VERIFIED | 409 lines; exports `SupportBandStation`, `buildSupportBandStations`, `buildSupportBandPolygon`; `buildLiftRibbon` recomposes them with `liftRadiusDoc` and keeps the zero-station early return. Existing 9-test ribbon suite passes unchanged. |
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | Session signal + compare-then-write setter + optional `bandFor` port member | ✓ VERIFIED | `strokeSizePreview = signal(false)`; setter early-returns on equality; `setScriptSelectMode` does not reset it (pinned). `bandFor?` documented display-only. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Resolver + port registration + band-cache trim | ✓ VERIFIED | `resolveAquarelleStrokeBandPx` (`:559-573`), lift returns `entry.ribbonPx` by identity, paint via `buildStrokeBandCached`; port widened to `'listStrokes' | 'hitTestStroke' | 'bandFor'` (`:585-593`); cache trim in the listing. |
| `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` | Switch-gated band path with transform/drag mapping, centerline fallback | ✓ VERIFIED | Narrow read at `:137`; band gated on `previewStrokeSize && props.port.bandFor`; `stroke-size-band` / `stroke-lift-ribbon` test ids; `fillRule="nonzero"`, `fillOpacity` and `strokeWidth` ternaries preserved; paint bbox / lift-no-bbox rule untouched. |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | Header switch in both views | ✓ VERIFIED | Button in the shared header (`:809-825`), above the view gate; Spline glyph; `.peek()` handler write. |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Pressed-state chrome | ✓ VERIFIED | `:5831-5843` adds `.physics-paint-stroke-settings-preview-toggle[aria-pressed='true']` plus hover with the audio-preview blue; existing header rules untouched. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `strokeSizePreview` signal | Dialog header `aria-pressed` + overlay leaf gate | Render-body reads in the two leaves; handler uses `.peek()` | ✓ WIRED | `PhysicsPaintStrokeSettingsDialog.tsx:443`, `ScriptStrokeOverlay.tsx:137`; no reference in `PhysicsPaintStudio.tsx` (Studio render body). |
| `aquarelleScriptStrokeEditionPort.bandFor` | Overlay band path `d` | `resolveAquarelleStrokeBandPx` → `buildStrokeBandCached` → `buildStrokeBand` → shared stations/polygon | ✓ WIRED | Spread into the adapter (`AquarelleStrokeOverlay.tsx:31-39`) and the Studio registration (`PhysicsPaintStudio.tsx:8512-8521`) with no other call-site change; called at `ScriptStrokeOverlay.tsx:379`. |
| `buildStrokeBand` lift branch | `buildLiftRibbon` (261029-eur) | Direct call, cached path delegates to `buildLiftRibbonCached` | ✓ WIRED | `aquarelleStrokeBand.ts:157-158`, `:197-201`; identity pinned by test. |
| Listing | Both caches frame-bounded | `trimLiftRibbonCache(liveLiftIds)` + `trimStrokeBandCache(liveBandIds)` | ✓ WIRED | `aquarelleStrokeSelection.ts:471-480`, collected filter-independently over the frame. |
| Band vertices | `applyScriptStrokeTransform` + `offsetX/offsetY` | Per-vertex map inside the overlay's per-entry loop | ✓ WIRED | `ScriptStrokeOverlay.tsx:381-390`; source pin asserts the region. |
| `aquarelleFootprintFor` (engine/cursor law) | `paintRadiusDocFor` + `paintTipForStroke` | Pinned equal by test (radius `closeness 12`, aspect equality, pen forced to 1) | ✓ WIRED | `aquarelleStrokeBand.test.ts:213-265` uses a fixed-rotation aspect-2 tip so the pen assertion is non-vacuous. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ScriptStrokeOverlay` band path | `bandPx` | `props.port.bandFor` → `resolveAquarelleStrokeBandPx` → `getRecordedAquarelleStroke(entry.mutationId)` → `buildStrokeBandCached` | Yes — real recorded stroke (points, pressure, params, tip overrides) from the registry; lift path returns the listing's real `ribbonPx` | ✓ FLOWING |
| `ScriptStrokeOverlay` lift band | `entry.ribbonPx` | Listing → `buildLiftRibbonCached(stroke, …)` → registry | Yes | ✓ FLOWING |
| Dialog header switch | `previewStrokeSize` | `strokeSizePreview` session signal (module state, written only by the toggle) | Yes — real session state, not a static literal | ✓ FLOWING |

No static return, hardcoded literal or mock feeds the drawn band.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted gate (7 suites incl. the new band suite) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeBand.test.ts src/components/physic-paint/view/aquarelleLiftRibbon.test.ts src/components/physic-paint/view/scriptStrokeEdition.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/roto/aquarelleLiftErase.test.ts` | 7 files / 599 tests passed (0 failures, 858 ms) | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` clean | ✓ PASS |

No dev server was started (per project instruction) and no further spot-check can execute the SVG surface headlessly; live rendering is routed to Human Verification.

### Probe Execution

No probes are declared by the plan and the quick is not a migration/tooling phase (`scripts/*/tests/probe-*.sh` — none referenced). Step 7c: N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261101-MVG | 261101-mvg-PLAN.md | One switch turns the bold footprint preview ON for every listed stroke (paint bake law; eraser 261029-eur), default OFF for all kinds, display-only, session-only, reachable in both views | ✓ SATISFIED (code) | Truths 1-7 above; coverage-audit items D-01…D-13 each map to the verified truths/artifacts. Live visual rows remain for the user (Human Verification). |

No orphaned requirements: the quick declares a single requirement and no plan claims an additional phase requirement.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `aquarelleStrokeBand.test.ts` | QUICK-261101-MVG | 21 | 0 | No | Value/Behavioral (numeric toBeCloseTo 12, element identity, budget) | PASS |
| `aquarelleStrokeSelection.test.ts` (new block) | QUICK-261101-MVG | 5 | 0 | No | Value/Behavioral (deep equality, identity, hit ids, revision) | PASS |
| `scriptStrokeEdition.test.ts` (new case) | QUICK-261101-MVG | 1 | 0 | No | Behavioral (effect notification counts) | PASS |
| `strokeSettingsModel.test.ts` (new block) | QUICK-261101-MVG | 3 | 0 | No | Behavioral (rendered props, aria-pressed, drag guard) | PASS |
| `PhysicsPaintStudio.test.ts` (rewritten pin) | QUICK-261101-MVG | 1 | 0 | No | Source-contract (file's established style) | PASS |

**Disabled tests on requirements:** 0 → no BLOCKER.
**Circular patterns detected:** 0 (the only `readFileSync` is a read-only purity pin; no expected values are generated by the system under test).
**Insufficient assertions:** 0.

### Decision Coverage

Skipped — the quick task directory holds no `CONTEXT.md` (nothing to cross-reference).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No `TBD`/`FIXME`/`XXX` markers, no empty implementations or placeholder paths in any of the 12 changed files; the overlay's `return null` is the pre-existing surface gate, not a stub. |

### Human Verification Required

#### 1. Default OFF on both kinds (visual)

**Test:** Open Stroke settings (Water color Select or Brush Move) on a frame with a paint stroke and an Eraser stroke; leave the switch unpressed.
**Expected:** Both strokes show the thin centerline (cyan when selected, dual dark/light otherwise); no red eraser ribbon, no bold surface, eraser has no bbox, paint keeps its bbox.
**Why human:** The SVG surface is visual; the branch is proven but the pixels are not.

#### 2. ON draws real coverage, eraser unchanged (visual)

**Test:** Press the switch ON and inspect paint bands (round size-12, a flat/non-round tip, a pressure-varying stroke, a water stroke) and an Eraser.
**Expected:** Each paint band matches the area the baked stroke covers (size, tip aspect, pressure, water ×1.3); the Eraser keeps the red 261029-eur ribbon. Check a non-square sheet.
**Why human:** Numeric footprint agreement is pinned; visual agreement with the painted result is a human judgement.

#### 3. Drag ghosts and transform previews follow the band (motion)

**Test:** With the switch ON, drag a selected stroke and rotate/scale it with the handles.
**Expected:** Every band vertex moves by the same drag offset / transform — no lag, no detachment.
**Why human:** Live pointer motion cannot be exercised by the source pin or a headless unit run.

#### 4. Header switch reachable in both views with the ON chrome (visual)

**Test:** Toggle between list and settings; press the Spline control; try dragging from the button.
**Expected:** The switch is in the header in both views (never inside a tab), unpressed by default, blue when ON, and pressing it never starts a header drag.
**Why human:** Placement, glyph legibility and colour are visual.

#### 5. Session-only lifetime (runtime)

**Test:** Toggle the switch, close/reopen the sheet, navigate frames, then edit and Undo; reload the project.
**Expected:** The preference survives within the session, creates no undo entry, is not written into the document, and resets to OFF on a reload.
**Why human:** Session lifetime and the absence of an undo entry are runtime behaviours.

### Gaps Summary

No gaps. All 7 must-have truths, all 8 artifacts and all 6 key links are verified against the live tree; the targeted gate (7 suites / 599 tests) and typecheck were independently reproduced green; the listing produces byte-identical entries across the toggle (only a cache trim was added); the switch has no document/persistence/undo path; and `aquarelleStrokeBand.ts` is Preact/signal/DOM-free with the lift branch delegated to `buildLiftRibbon`.

The only outstanding work is the user's live visual UAT (five rows above), which is why the status is `human_needed` rather than `passed`.

---

_Verified: 2026-11-01T16:11:19Z_
_Verifier: Claude (gsd-verifier)_
