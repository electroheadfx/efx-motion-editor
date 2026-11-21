---
phase: quick/261121-mtu
verified: 2026-11-21T16:25:31Z
status: human_needed
score: 12/12 must-haves verified
covered_files: [".planning/quick/261121-mtu-refill-acrylic-only-three-paint-tool-cat/261121-mtu-PLAN.md", ".planning/quick/261121-mtu-refill-acrylic-only-three-paint-tool-cat/261121-mtu-SUMMARY.md", "SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/performance/scriptTimelineCodec.ts", "app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx", "app/src/components/physic-paint/view/AquarelleToolRow.tsx", "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx", "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx", "app/src/components/physic-paint/view/aquarellePaintControls.ts", "app/src/components/physic-paint/view/aquarelleParamVisibility.ts", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/aquarelleStrokeBand.ts", "app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts", "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts", "app/src/components/physic-paint/view/scriptStrokeEdition.ts", "app/src/components/physic-paint/view/strokeSettingsModel.ts", "packages/efx-watercolor/src/adapter/engineAdapter.ts", "packages/efx-watercolor/src/engine/deposit.ts", "packages/efx-watercolor/src/payload/toStudioStroke.ts", "packages/efx-watercolor/src/playground/mediums.ts"]
covered_digest: "v4:sha256:3bbe5d0e5e285372745d48ad37cbe0676ea5e599df6f5489b1a7eb376554eca6"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Paint tab (a): with each tool (Brush, Watercolor, Water, Pen, Eraser) and each medium (Acrylic, Watercolor, Gouache, Chalk, Graphite), read the panel — group order Medium · Paint & reservoir · Drying · Edge · Watercolor only · Eraser, headings only over non-empty groups, no Body and no wetSeconds row."
    expected: "Six-group order holds; Refill is absent for Acrylic AND Watercolor, present for Gouache/Chalk/Graphite; Feather absent for Watercolor; Eraser shows the Lift row alone; Water shows Viscosity, Dry speed, Flow, Bleed, Edges, Grain."
    why_human: "Native visual layout and heading presence on the live Studio surface — a rendered-look judgement no unit pin can make."
  - test: "Tool row (b): on both tool surfaces (left rail and the module row), check order Brush · Watercolor · Water · Pen · Eraser with Paintbrush / Droplet / WavesArrowDown / Pen / Eraser icons and B / A / W / P / E; on a dry sheet the Water button is greyed with its title reason."
    expected: "The five entries render in order with those icons and shortcuts; Water is inert and explains why while the sheet is dry."
    why_human: "Icon rendering, spacing and the grey-out are visual/interactive qualities."
  - test: "Acrylic preset (c): pick an acrylic brush and compare against the previous Feather 100 / Emboss 0 — check the edge is softer-but-defined and a light relief pass shows."
    expected: "Feather 85 visible as a softer silhouette (not smeared at 100); Emboss 3 gives a light relief."
    why_human: "The acceptance criterion is a visual paint quality only the artist can judge."
  - test: "Refill behaviour on the live surface (d): acrylic Refill stays 0 through applying the Acrylic medium, an acrylic brush pick and Reset; watercolor keeps 60 behind its hidden row; Reset in Gouache/Chalk/Graphite leaves Refill at 60."
    expected: "No UI path raises acrylic Refill above 0; hidden rows never zero a non-acrylic medium."
    why_human: "Confirms the action sequence on the native surface; the value transitions themselves are unit-pinned, the live surface wiring is the human check."
  - test: "Shortcuts (e): bare A picks the Watercolor tool, bare M toggles Move/Edit (Select), Shift+A still selects/deselects every stroke; the rail Select tooltip and the shortcuts catalog say M."
    expected: "A paints watercolor-family, M toggles Select, Shift+A selects all; copy reads M everywhere."
    why_human: "Keyboard feel and the live shortcut surface are interactive judgements."
---

# Quick 261121-mtu Verification Report

**Task Goal:** Refill hidden for acrylic and watercolor (acrylic fixed at 0), acrylic preset Feather 85 / Emboss 3, a third paint tool category (Watercolor, shortcut A, Move/Edit moved to M) with an explicit payload→engine mapping, and a tool×medium-context Paint panel replacing the flat 12-row list.
**Verified:** 2026-11-21T16:25:31Z (HEAD `c068a0139`)
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Refill row hidden for acrylic AND watercolor, shown for gouache, pastel and graphite; hiding never changes a stored value | ✓ VERIFIED | `aquarelleParamVisibility.ts:95` `REFILL_HIDDEN = ['acrylic','watercolor']` on the `refill` row only; selector subtracts it inside the paint context; gouache/pastel/graphite records keep `refill: 60` (`mediums.ts`). Matrix suite pins absence/presence per tool × medium and the "hiddenForMedia on Refill only" law (20 tests green). |
| 2 | Acrylic refill 0 and stays 0 through medium apply, acrylic brush pick and Reset; ONE selection patch; `DEFAULT_PARAMS` unchanged | ✓ VERIFIED | `mediums.ts` acrylic `refill: 0`; `AquarelleGlobalsPanel.tsx:165-178` reset loop writes `acrylic && key === 'refill' ? 0 : round(DEFAULT_PARAMS[key]*100)` then one `commitAquarelleSelectionParams(next)`. `Engine.ts` is NOT in the phase diff (`DEFAULT_PARAMS.refill` still `0.6`). Pins: `mediumSelection.test.ts` (acrylic 0 / watercolor 60), `aquarellePaintControls.test.ts` (same-group acrylic pick leaves 0), `AquarelleGlobalsPanel.test.ts` (reset patch carries refill 0 as one call; watercolor resets 60; size/lift never written). |
| 3 | Acrylic record feather 85 / emboss 3 / pickup 100 / refill 0 with all other numbers unchanged; obsolete comment replaced; spec §5 Acrylic row states Feather 85 / Emboss 3 | ✓ VERIFIED | `mediums.ts:177-203`: water 26, load 100, flow 60, bleed 22, dry 70, edge 65, granulation 25, viscosity 90, body 100, emboss 3, feather 85, pickup 100, refill 0, wetSeconds 12; comment states current numbers and why. Spec §5 line 171: `Acrylic … 100 | 85 | 3 | 100 | 0 | 12`, line 163 paragraph updated, line 173 Refill note added. |
| 4 | `AquarelleTool` is the additive five-member union brush \| watercolor \| water \| pen \| lift; `AQUARELLE_TOOLS` lists all five; `Engine.Tool` stays four; stored brush/water/pen/lift strokes unchanged (no migration/shim) | ✓ VERIFIED | `toStudioStroke.ts:65-74` (union + frozen list in order); `Engine.ts:44` still `'brush' \| 'water' \| 'pen' \| 'lift'` (file untouched by the diff). Codec and roto schema read `AQUARELLE_TOOLS` and extend automatically (`codec.ts:117`, `physicsPaintRotoScriptSchema.ts:522/600`). Pins: union order + `isAquarellePaintTool`; four legacy payloads byte-identical through a JSON round trip; legacy codec codes 0–3 frozen. |
| 5 | Payload→engine mapping explicit and pinned: watercolor → brush, unknown fallback → brush; `AquarelleCanvasLayer` no longer casts | ✓ VERIFIED | `engineAdapter.ts:170-187` frozen `PAYLOAD_TOOL_TO_ENGINE` table + `engineToolForAquarelleTool`; `asTool` delegates. `AquarelleCanvasLayer.tsx:370` `engine.setTool(engineToolForAquarelleTool(aquarelleActiveTool.value))`; the `as Tool` cast and the `type Tool` import are gone. Pins in `engineAdapter.test.ts` (table entry + separate unknown fallback) and `aquarelleLiftEraseContract.test.ts:133-134` (source pin: no `as Tool`, mapping call present). |
| 6 | Engine fail-closed guard stays closed on four via a LOCAL `ENGINE_TOOLS`; `assertAquarelleTool('watercolor')` throws; `fluid.test.ts` pins the closure; Studio codec APPENDS `watercolor` at code 4 with a round-trip pin | ✓ VERIFIED | `deposit.ts:50-64`: local frozen four-member `ENGINE_TOOLS`, `TOOL_SET` built from it, error message lists the four; `deposit.ts` no longer derives the guard from `AQUARELLE_TOOLS`. `fluid.test.ts` pins the engine list and that `stampTool(…, 'watercolor')` throws `/Unknown aquarelle tool/`. `scriptTimelineCodec.ts:179-187` `TOOL_NAMES` appends `watercolor` at index 4, `TOOL_CODE_BY_NAME` frozen at 0–3 + 4; `scriptTimelineCodec.test.ts` round-trips a watercolor stroke through JSON and binary and pins the numeric codes `['brush',0],['water',1],['pen',2],['lift',3],['watercolor',4]`. |
| 7 | Watercolor keeps the top-bar settings cluster | ✓ VERIFIED | `PhysicsPaintTopBar.tsx:459-460` `toolOwnsSettings = activeTool === 'brush' \|\| activeTool === 'watercolor' \|\| activeTool === 'lift'`; `PhysicsPaintTopBar.test.ts` pins that the cluster renders for Watercolor (and the Water/Pen removal cases still pass). |
| 8 | Both tool surfaces are Brush · Watercolor · Water · Pen · Eraser with Paintbrush / Droplet / WavesArrowDown / Pen / Eraser, shortcuts B / A / W / P / E; Water dry-sheet gate unchanged | ✓ VERIFIED | `PhysicsPaintToolRail.tsx:59-70` `WATERCOLOR_RAIL_TOOLS` and `AquarelleToolRow.tsx:22-33` `TOOLS` are identical five-entry tables in that order; lucide imports match. Rail gate line 135 `disabled={railDisabled \|\| wireframeActive \|\| (id === 'water' && !wetAvailable)}` and the `'Water (W) — needs standing water'` title are byte-unchanged (`aquarelleWetPaintGate.test.ts` green). Both surfaces route clicks through `selectAquarellePaintTool` (rail L152, row L75). |
| 9 | Brush pick sets the paint tool from the picked brush's group (watercolor → Watercolor; other group / no preset → Brush); Watercolor tool applies the Watercolor medium and selects the group's first preset only when the tip is outside it; Brush changes neither tip nor medium; brush library not filtered | ✓ VERIFIED | `aquarelleRecordState.ts:478-483` `paintToolForTip` (BRUSH_PRESETS lookup + `brushGroupOf`); `selectAquarelleTip` calls it behind the shipped `nextId !== null` guard (the old blanket flip is gone). `selectAquarellePaintTool` (L501-523) applies `applyAquarelleMedium('watercolor')` + the group's first preset via a lookup (resolves `round`) and keeps an in-group tip; Brush path is `setAquarelleTool('brush')` only. No library component is in the diff (no filtering added). `aquarelleToolFamily.test.ts` (126 lines) pins all branches; WatercolorBrushLibrary/`aquarellePresetSelection`/`aquarelleLiftTipSelection` suites updated and green. |
| 10 | Bare A = Watercolor tool, bare M toggles Move/Edit, Shift+A untouched; rail Select tooltip, shortcuts catalog and detected-context copy say M | ✓ VERIFIED | `physicsPaintStudioKeyboard.ts:376-385` bare `a` → `selectAquarelleTool('watercolor')` (no `canSelectWater` probe; W still probes), `:402-406` bare `m` → `toggleAquarelleSelect` with `preventDefault`; Shift+A branch at `:225` untouched; action type widened to `AquarelleTool` (L50). `PhysicsPaintToolRail.tsx:209-210` both Select variants say `(M)`; `physicsPaintShortcutsHelp.ts` Paint Tools gains `{keys:'A', description:'Watercolor'}`, Move/Edit is `{keys:'M', …}`, `⇧A` stays, detected-context copy says "press M". Pins in `physicsPaintStudioKeyboard.test.ts` (a → watercolor; the old bare-a Select case converted to m; m added to the modifier-ignore list), `physicsPaintShortcutsHelp.test.ts`, `PhysicsPaintStudio.test.ts`. |
| 11 | Panel renders six groups in the fixed order, headings only over non-empty groups; visibility is a pure function of (tool, medium); Body row-less/Reset-only; wetSeconds row-less; Lift only in the Eraser context | ✓ VERIFIED | `aquarelleParamVisibility.ts:72-79` frozen group order with the exact labels; `visibleAquarelleParamGroups` drops empty groups; `AquarelleGlobalsPanel.tsx:202-283` renders `data-testid="aquarelle-param-group-<id>"` + `RuleSectionHeader` from the selector only (no local row list; `GLOBAL_ROWS` deleted), keeps `aquarelle-globals-panel` / `aquarelle-params-reset`, the medium dropdown and ONE `onCommit` passthrough. `body`/`wetSeconds`/`size` absent from the 13-row table; Lift is the only Eraser-context row; its release commits with the `'lift'` filter (`aquarellePaintControls.ts:101-109`, pinned). Panel tests green. |
| 12 | `visibleAquarelleParamGroups` / `visibleAquarelleParamRows` pure, exported, DOM-free, with a full matrix unit suite | ✓ VERIFIED | Both exported from `aquarelleParamVisibility.ts` (imports only a type + `DEFAULT_MEDIUM_ID`; no Preact/signals/DOM — source-pinned in the suite). `aquarelleParamVisibility.test.ts` pins all 5 tools × 5 media key lists and order, null→default medium, row counts P-A 7 / P-W 10 / P-D 8 / W 6 / L 1, empty-group drop, decision-B Refill presence/absence, Body/wetSeconds/size row-less, Emboss cap 15. |

**Score:** 12/12 truths verified (0 present-but-behavior-unverified, 0 overrides)

### Notes on disclosed deviations (not gaps)

- **Unknown brush id never flips the tool** (SUMMARY deviation 1): the plan's Task 2 `<behavior>` line said an unknown id "sets `brush`"; the shipped, pre-existing law normalizes an unknown id to `null` and the tool write stays behind `nextId !== null`, so the selection clears and the tool is unchanged. The must-have's family law (watercolor group → Watercolor; every other group and every catalog tip → Brush) holds, and `aquarelleToolFamily.test.ts` pins the true law with its header stating the reason. No production change was needed.
- **`EMBOSS_MAX` moved into the row table** (SUMMARY deviation 2): the panel no longer defines rows, so the cap lives beside the Emboss row in `aquarelleParamVisibility.ts` at the same 15, pinned behaviourally (min 0 / max 15). `GLOBAL_MIN`/`GLOBAL_MAX` remain in the panel.
- **Spec is gitignored** (`.gitignore:47`): §3/§5/§8 were verified on disk; absence from git is expected and not a gap.
- **Structured `verify.key-links` reported 0/4** because its heuristic looks for the target FILE NAME inside the source; every link here is a symbol-level import (`@efxlab/efx-watercolor` index, or a hook/selector call). All four were verified manually — see the Key Link table.
- **Structured `verify.artifacts` parsed 0 artifacts** because the plan's `must_haves.artifacts` is a bare path list (not `{path, provides}`). All 15 were checked manually and pass.
- **Pre-existing spec drift (informational, outside this quick's scope):** spec §5's Gouache row still states Emboss 20 while the shipped gouache record caps it at 15. The must-have only required the Acrylic row; flagging for a future spec pass, not a gap here.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-watercolor/src/payload/toStudioStroke.ts` | Five-member payload union | ✓ VERIFIED | 276 lines; union + `AQUARELLE_TOOLS` + `isAquarellePaintTool`; wired via `@efxlab/efx-watercolor/payload` |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | Explicit mapping | ✓ VERIFIED | 707 lines; `PAYLOAD_TOOL_TO_ENGINE` + `engineToolForAquarelleTool` used by `asTool` and the app |
| `packages/efx-watercolor/src/playground/mediums.ts` | Acrylic preset | ✓ VERIFIED | 209 lines; acrylic Feather 85 / Emboss 3, rest byte-identical |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | No cast at the live seam | ✓ VERIFIED | 1432 lines; `engine.setTool(engineToolForAquarelleTool(...))` |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Tool-pick seam + family law | ✓ VERIFIED | 2589 lines; `selectAquarellePaintTool`, `paintToolForTip`, family-aware `selectAquarelleTip` |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | Pure selector | ✓ VERIFIED | NEW, 171 lines; six groups, 13 rows, two selectors, no signals/DOM |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts` | Matrix pins | ✓ VERIFIED | NEW, 249 lines, 20 tests green |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` | Group rendering + reset law | ✓ VERIFIED | 300 lines; rows only from the selector; Reset with acrylic Refill 0 as one patch |
| `app/src/components/physic-paint/view/AquarelleToolRow.tsx` | Five-tool row | ✓ VERIFIED | 104 lines; five entries, routes through the seam |
| `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` | Five-tool rail | ✓ VERIFIED | 311 lines; same five entries, gate unchanged |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` | A/M/Shift+A | ✓ VERIFIED | 501 lines; bare a/m dispatch, Shift+A untouched |
| `app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts` | Catalog copy | ✓ VERIFIED | 134 lines; A Watercolor, M Move/Edit, "press M" |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Stroke-list categories | ✓ VERIFIED | 1307 lines; label, vector label, filter value, order, curve eligibility |
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | Widened display union | ✓ VERIFIED | 678 lines; `watercolor` + `watercolor-vector` |
| `SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md` | §3/§5/§8 contract | ✓ VERIFIED | 233 lines on disk; §3 Refill UI line, §5 Acrylic 85/3, §8 six-group organization + DEFERRED note |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `aquarelleParamVisibility.ts` | `AquarelleGlobalsPanel.tsx` | `visibleAquarelleParamGroups(activeTool, selectedMediumId)` as the ONLY row/heading source | ✓ WIRED | Panel L202 computes `groups`, L268-283 maps them; no local row table remains |
| `aquarelleRecordState.ts` | `brushes.ts` (`brushGroupOf`, `BRUSH_PRESETS`) | `selectAquarelleTip` → `paintToolForTip` flips to watercolor/brush from the group | ✓ WIRED | Record state L480-481, L556; `aquarelleToolFamily.test.ts` exercises every group |
| `toStudioStroke.ts` | `AquarelleCanvasLayer.tsx` | `AquarelleTool` (5) → `engineToolForAquarelleTool` → `engine.setTool` (`Engine.Tool`, 4) | ✓ WIRED | Canvas layer L370; no `as Tool` remains (source-pinned) |
| `aquarellePaintControls.ts` | `AquarelleGlobalsPanel.tsx` | brush pick applies its group's medium (`applyAquarelleMedium`) — the same write that decides the Refill row | ✓ WIRED | `pickAquarelleBrush` L82-96; panel uses `commitAquarelleSelectionParam(s)`; Reset/medium-apply pins green |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AquarelleGlobalsPanel.tsx` rows/headings | `groups` | `visibleAquarelleParamGroups(aquarelleActiveTool.value, aquarelleSelectedMediumId.value)` — live signals | Yes (selector over state) | ✓ FLOWING |
| Row values | `params[row.key]` | `aquarelleParams.value`, written by `applyAquarelleMedium` / `setAquarelleParam` (real record path) | Yes | ✓ FLOWING |
| Live engine tool | `aquarelleActiveTool.value` | `engineToolForAquarelleTool` → `engine.setTool` | Yes | ✓ FLOWING |
| Stroke list category | `stroke.tool` | recorded payload `engine.tool` (five-member union) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package union / mapping / engine guard / acrylic record | `pnpm --dir packages/efx-watercolor exec vitest run src/playground/mediums.test.ts src/payload/toStudioStroke.test.ts src/adapter/engineAdapter.test.ts src/engine/fluid.test.ts` | 4 files, 94 passed (8 pre-existing GPU-gated skips) | ✓ PASS |
| Package build (app tests resolve `dist`) | `pnpm --dir packages/efx-watercolor build` | success | ✓ PASS |
| Tool family law, rail/row surfaces, A/M shortcuts, categories, codec, top bar | `pnpm --dir app exec vitest run` (17 suites: aquarelleToolFamily, AquarelleToolRow launcher, PhysicsPaintToolRail, physicsPaintStudioKeyboard, shortcutsHelp, strokeSettingsModel, vectorPathSession, PhysicsPaintStudio, aquarellePresetSelection, aquarelleLiftTipSelection, aquarelleWetPaintGate, WatercolorBrushLibrary, physicsPaintHandToolWiring, aquarelleLiftEraseContract, scriptTimelineCodec, brushGroupMedium, PhysicsPaintTopBar) | 17 files, 1116 passed | ✓ PASS |
| Visibility matrix, panel groups/Reset, lift commit, right-sidebar pin, stroke band | `pnpm --dir app exec vitest run` (7 suites: aquarelleParamVisibility, AquarelleGlobalsPanel, AquarelleParamsPanel launcher, aquarellePaintControls, mediumSelection, PhysicsPaintRightSidebar, aquarelleStrokeBand) | 7 files, 126 passed | ✓ PASS |
| Typecheck | `pnpm --dir app exec tsc --noEmit` | clean (no output) | ✓ PASS |

### Probe Execution

N/A — no probes are declared or implied by this quick (UI/preset/organisation change, not a migration or tooling phase); no `scripts/*/tests/probe-*.sh` referenced.

### Requirements Coverage

Plan declares `requirements: []`. No REQUIREMENTS.md mapping applies to quicks; nothing orphaned.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX` in any modified file; no placeholder/coming-soon copy; no added `useState`; no empty-implementation stubs in the touched production surface | — | None |

The only `skipIf` matches in changed tests are the pre-existing GPU-gated suites in `engineAdapter.test.ts` (not linked to a must-have; the mapping pins run unconditionally).

### Test Quality Audit

| Test File | Linked Must-Have | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|------------------|--------|---------|----------|-----------------|---------|
| `packages/.../payload/toStudioStroke.test.ts` | 4 | 27 | 0 | No | Value (union order, paint predicate, round trip) | OK |
| `packages/.../adapter/engineAdapter.test.ts` | 5 | 49 | 8 (pre-existing GPU gate) | No | Value (table + fallback) | OK |
| `packages/.../engine/fluid.test.ts` | 6 | 17 | 0 | No | Behavioral (guard throws) | OK |
| `packages/.../playground/mediums.test.ts` | 3 | 9 | 0 | No | Value (record literals) | OK |
| `view/aquarelleParamVisibility.test.ts` | 1, 11, 12 | 20 | 0 | No | Value (full 5×5 matrix) | OK |
| `view/AquarelleGlobalsPanel.test.ts` | 2, 11 | 28 | 0 | No | Behavioral (reset patch values, headings) | OK |
| `view/aquarelleToolFamily.test.ts` | 9 | 8 | 0 | No | Behavioral (tool/medium/tip transitions) | OK |
| `view/physicsPaintStudioKeyboard.test.ts` | 10 | 54 | 0 | No | Behavioral (dispatch + preventDefault) | OK |
| `view/PhysicsPaintToolRail.test.ts` | 8, 10 | 40 | 0 | No | Value (titles/order/select copy) | OK |
| `performance/scriptTimelineCodec.test.ts` | 6 | 33 | 0 | No | Value (round trip + numeric codes) | OK |
| `view/AquarelleGlobalsPanel.test.ts` etc. | — | — | — | — | — | — |

**Disabled tests on requirements:** 0 → no blocker.
**Circular patterns detected:** 0.
**Insufficient assertions:** 0 — every must-have has value- or behavioral-level pins.

### Decision Coverage

Skipped — the quick task directory holds no CONTEXT.md, so there are no `<decisions>` entries to map.

### Human Verification Required

1. **Paint panel per tool and medium**
   **Test:** Open the Studio Paint tab; with each tool (Brush, Watercolor, Water, Pen, Eraser) and each medium (Acrylic, Watercolor, Gouache, Chalk, Graphite), inspect the panel.
   **Expected:** Group order Medium · Paint & reservoir · Drying · Edge · Watercolor only · Eraser, headings only over non-empty groups, no Body and no wetSeconds row; Refill absent for Acrylic AND Watercolor, present for Gouache/Chalk/Graphite; Feather absent for Watercolor.
   **Why human:** Native visual layout/heading presence on the live surface.

2. **Tool row on both surfaces**
   **Test:** Inspect the left rail and the module tool row; hover each button on a dry sheet.
   **Expected:** Brush · Watercolor · Water · Pen · Eraser with Paintbrush / Droplet / WavesArrowDown / Pen / Eraser and B / A / W / P / E; Water greyed with its dry-sheet reason.
   **Why human:** Icon rendering, spacing and grey-out are visual qualities.

3. **Acrylic preset feel**
   **Test:** Pick an acrylic brush and compare to the previous Feather 100 / Emboss 0.
   **Expected:** Softer-but-defined edge (85) and a light relief pass (3).
   **Why human:** Paint quality judgement only the artist can accept.

4. **Refill behaviour on the live surface**
   **Test:** Acrylic: apply the medium, pick an acrylic brush, press Reset — watch Refill; repeat for Watercolor and Gouache.
   **Expected:** Acrylic stays 0 through all three; watercolor keeps 60 behind the hidden row; gouache/chalk/graphite reset to 60.
   **Why human:** Confirms the live action sequence (the value transitions are unit-pinned).

5. **Shortcuts**
   **Test:** Press bare A, bare M, Shift+A; read the rail Select tooltip and the shortcuts catalog.
   **Expected:** A picks Watercolor, M toggles Move/Edit, Shift+A selects/deselects all; copy says M.
   **Why human:** Keyboard feel and live copy.

### Gaps Summary

No gaps. All 12 must-have truths are implemented, wired and behaviorally pinned; all 15 plan artifacts exist and are substantive; all 4 key links are connected (verified manually — the structured verb's file-name heuristic cannot see symbol-level imports). Guardrails hold: `Engine.Tool` still four members, `deposit.ts` keeps a local four-member `ENGINE_TOOLS` and `assertAquarelleTool('watercolor')` throws (pinned), `Engine.ts` `DEFAULT_PARAMS` untouched, no carrier/compositing/live-seed/capture-merge/seed-parity file changed, no `useState` introduced, no brush preset id or group renamed/removed, the codec's legacy codes 0–3 frozen with `watercolor` appended at 4, and the spec's §3/§5/§8 content verified on disk (gitignored by design).

The remaining items are the artist's native visual UAT (rows a–e) and the explicitly **DEFERRED** decision on whether gouache/chalk/graphite should also lose the Refill row (the row is shown and keeps 60 until then — pinned so it cannot silently drift).

---

_Verified: 2026-11-21T16:25:31Z_
_Verifier: Claude (gsd-verifier)_
