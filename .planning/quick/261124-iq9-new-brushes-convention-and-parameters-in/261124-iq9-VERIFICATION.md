---
phase: quick/261124-iq9
verified: 2026-11-24T13:21:42Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - ".planning/quick/261124-iq9-new-brushes-convention-and-parameters-in/261124-iq9-PLAN.md"
  - ".planning/quick/261124-iq9-new-brushes-convention-and-parameters-in/261124-iq9-SUMMARY.md"
  - "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx"
  - "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx"
  - "app/src/components/physic-paint/view/aquarelleParamVisibility.ts"
  - "app/src/components/physic-paint/view/aquarelleRecordState.ts"
  - "app/src/components/physic-paint/view/aquarelleStrokeBand.ts"
  - "app/src/components/physic-paint/view/brushToolFamily.ts"
  - "packages/efx-watercolor/src/playground/Engine.ts"
  - "packages/efx-watercolor/src/playground/brushBridge.ts"
  - "packages/efx-watercolor/src/playground/brushes.ts"
  - "packages/efx-watercolor/src/playground/mediums.ts"
covered_digest: "v4:sha256:de67aa14bee3a50cf8cca6595f1286831bee09825279b32a826c8d11e59bc17c"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the Studio and the Medium dropdown; select Gouache and paint a stroke."
    expected: "The dropdown lists exactly Watercolor and Gouache; the Gouache selection paints the shipped opaque body-colour deposit."
    why_human: "The painted appearance of the deposit is a visual property — unit pins only prove the record/catalog wiring."
  - test: "Brush tool + Gouache medium: inspect the Paint panel AND the Studio top bar."
    expected: "Panel shows only Pigment, Pickup, Dry speed and Feather (no Viscosity, no Water row, no Medium heading) AND the top bar shows Brush size, Pigment, Edges and Grain with no Water slider."
    why_human: "Live-surface UAT of both visible surfaces in the running Studio."
  - test: "Brush tool + Watercolor medium: inspect both surfaces, then paint and re-bake a stroke."
    expected: "Panel brings Viscosity and Water back with the watercolor row set; the top bar's Water slider is back between Pigment and Edges; the painted look is unchanged."
    why_human: "Paint/re-bake look parity needs the artist's eye."
  - test: "Water tool under each medium, then the Eraser."
    expected: "The Water tool renders Viscosity under both media (no Water slider in either); the Eraser keeps Lift alone with its own Size/Strength cluster."
    why_human: "The running tool cluster is the acceptance surface."
  - test: "Open the brush library (floating brush modal and right-panel Brush tab)."
    expected: "Two headings only — Watercolor (eleven cards) and Gouache (one card, the renamed Bristle Round); the Chalk and Graphite sections are gone."
    why_human: "Rendered library layout is a visual property."
  - test: "Open an older project whose stroke recorded a removed response (e.g. chalk)."
    expected: "The mark still renders through the round fallback, with no error and no crash on open or re-render."
    why_human: "Exercises the full load/re-render path in a real old project; unit evidence proves only the resolver."
---

# Phase quick/261124-iq9: New Brushes Convention and Parameters in Studio — Verification Report

**Phase Goal:** New Brushes convention and parameters — two media (Watercolor, Gouache), Viscosity and Water hidden in the Brush context for non-watercolor media, removal of the old Gouache Round/Flat, Chalk and Graphite responses (and their media), Bristle Flat removed, Bristle Round renamed Gouache, Acrylic medium renamed Gouache.
**Verified:** 2026-11-24T13:21:42Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Medium dropdown offers exactly Watercolor and Gouache; the medium set is exactly `watercolor` + `acrylic`; acrylic keeps its id and every parameter and changes only its display name; old gouache/pastel/graphite media no longer exist. | ✓ VERIFIED | `mediums.ts:23` `MediumId = 'watercolor' \| 'acrylic'`; `mediums.ts:58` `MEDIUM_IDS` frozen to the two ids; two frozen records (`mediums.ts:96` Watercolor, `mediums.ts:118` name `'Gouache'`). Diff `074bdafc3..f5da7c094` shows only the `name` key changed in the acrylic record — all 14 params byte-identical. Executed against `dist/index.mjs`: `MEDIUM_IDS` = `["watercolor","acrylic"]`; `mediumById('gouache'/'pastel'/'graphite'/'chalk')` all `null`. `AquarelleGlobalsPanel.test.ts` pins the dropdown to 2 items named `['Watercolor','Gouache']`; package `mediums.test.ts` green. |
| 2 | Brush library renders exactly two groups in order: Watercolor (11 responses) and Gouache (1 — the renamed Bristle Round, id stays `bristle-round`); Gouache Round/Flat, Bristle Flat, Fan, Dry, Stipple, Soft Pastel, Conté Hard, Graphite Pencil/6B no longer exist. | ✓ VERIFIED | `brushes.ts` holds exactly 12 presets; executed against `dist/index.mjs`: ids `round, detail, rigger, flat, hake, filbert, mop, sponge, spatter, sumi, dagger` (group `watercolor`) + `{id:'bristle-round', name:'Gouache', group:'acrylic'}`; `brushGroupOrder = ['watercolor','acrylic']`; `brushGroupLabels = {watercolor:'Watercolor', acrylic:'Gouache'}`. All 11 retired ids confirmed absent from the built table. `WatercolorBrushLibrary.tsx` imports `brushGroupLabels` (lines 62–64) and `brushSectionsForTool` (line 77), renders sections + `title={brushGroupLabels[section.group]}` (lines 374–390); `WatercolorBrushLibrary.test.ts` pins the two section ids and titles. `brushes.test.ts` pins the 12-entry classification and the 11+1 sections. |
| 3 | Brush + Gouache: NO Studio surface exposes Viscosity or Water — panel renders exactly Pigment, Pickup, Dry speed, Feather; top bar renders Brush size, Pigment, Edges, Grain. | ✓ VERIFIED | `aquarelleParamVisibility.ts:132` `ACRYLIC_HIDDEN = ['acrylic']`, attached to the `viscosity` row (line 145) and `water` row (line 174); `hiddenForMedia` is consulted only in the paint branch (line 212); `isAquarelleParamRowVisible` exported (line 223). `PhysicsPaintTopBar.tsx`: import line 39, `selectedMediumId = aquarelleSelectedMediumId.value` line 416, `waterRowVisible = isAquarelleParamRowVisible(activeTool, selectedMediumId, 'water')` line 472, and ONLY the `physics-aquarelle-water` slider wrapped in `{waterRowVisible && ...}` (lines 619–633). `AquarelleGlobalsPanel.test.ts` pins exactly `['Pigment','Pickup','Dry speed','Feather']` for Gouache; `PhysicsPaintTopBar.test.ts` real-store release renders four sliders with `physics-aquarelle-water` undefined, plus a source pin asserting both imports. |
| 4 | Brush + Watercolor both surfaces unchanged: panel keeps its eight watercolor-context rows; top bar renders Brush size, Pigment, Water, Edges, Grain. | ✓ VERIFIED | `AquarelleGlobalsPanel.test.ts` pins the eight watercolor rows (incl. Viscosity and Water); `PhysicsPaintTopBar.test.ts` pins the five-label watercolor bar (Water between Pigment and Edges) and has a real-store case where selecting Watercolor restores the Water slider. `aquarelleParamVisibility.test.ts` P_W key set `viscosity\|load\|water\|dry\|flow\|bleed\|edge\|granulation` — watercolor context unchanged. `hiddenForMedia` only subtracts for `acrylic`, so the watercolor branch is untouched. |
| 5 | Water tool still renders Viscosity with its fluid set under every medium; Eraser still renders the Lift row alone. | ✓ VERIFIED | `aquarelleParamVisibility.test.ts` W_KEYS (6 rows incl. `viscosity`) is pinned identically for watercolor and Gouache media; L_KEYS pinned to `['lift']`. `AquarelleGlobalsPanel.test.ts` pins the Water tool's six rows and the Eraser's `['Lift']`. The top-bar gate keys on `'water'` only, and the Eraser branch is untouched in the diff — hence no regression to the Lift surface. |
| 6 | An old stroke whose recorded response id no longer exists replays through the shipped unknown-id fallback to round — no migration, no back-compat branch, no hidden registration. | ✓ VERIFIED | `brushBridge.ts:87` `presetFor`: `TIP_TO_PRESET[brushId] ?? (BRUSH_PRESETS.some(...) ? brushId : 'round')` — untouched by the quick, and `TIP_TO_PRESET` was only trimmed of dead entries (lines 36–40). Executed against `dist/index.mjs`: `buildBrushForStroke` for `chalk`, `gouache-round`, `bristle-flat`, `no-such-response` all resolve to `round`. The live/bake path uses the same resolver: `engineAdapter.ts:425` `buildBrushForStroke(payload.brushId ?? stroke.brushId, …)`. Diff contains no migration or back-compat code. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

`gsd-tools query verify.artifacts` returned `{all_passed:false, passed:0, total:0}` because the plan's `must_haves.artifacts` are plain path strings rather than `{path, provides}` objects, so the verb found nothing to score. Manual three-level verification (exists / substantive / wired) was used instead.

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/playground/mediums.ts` | Two frozen medium records, narrowed `MediumId` | ✓ VERIFIED | 147 lines; two records; consumed by `aquarelleRecordState`, `AquarelleGlobalsPanel`, visibility law; package tests green. |
| `packages/efx-watercolor/src/playground/brushes.ts` | 12 presets, 2 groups/labels, `isBristleResponse` narrowed | ✓ VERIFIED | Substantive table consumed by library, top bar, engine, bridge; dist enumeration matches source. |
| `packages/efx-watercolor/src/playground/brushBridge.ts` | Dead `TIP_TO_PRESET` entries removed; fallback untouched | ✓ VERIFIED | `presetFor` fallback intact (line 87); used by `engineAdapter` live/bake paths. |
| `packages/efx-watercolor/src/playground/Engine.ts` | Default-brush initializer uses the round fallback | ✓ VERIFIED | `BRUSH_PRESETS.find(p => p.id === 'round') ?? BRUSH_PRESETS[0]!`; no bristle literals remain. |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | Shared row-visibility selector; acrylic hides viscosity + water | ✓ VERIFIED | `ACRYLIC_HIDDEN` on both rows; exported selector; imported by panel and top bar. |
| `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` | Water slider gated by the shared selector | ✓ VERIFIED | Import line 39; call line 472; render gate lines 619–633; Edges/Grain ungated; Eraser branch untouched. |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | Two group sections over the package table | ✓ VERIFIED | `brushSectionsForTool(activeTool)` + `brushGroupLabels`; no local group list. |
| `packages/efx-watercolor/src/playground/mediums.test.ts` | Retirement + two-medium pins | ✓ VERIFIED | Runs green (package targeted suite). |
| `packages/efx-watercolor/src/playground/brushes.test.ts` | 12-preset classification + group pins | ✓ VERIFIED | Runs green. |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts` | P_A / P_W / W_KEYS / L_KEYS matrix pins | ✓ VERIFIED | Runs green. |
| `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` | Five-label watercolor + four-slider acrylic pins | ✓ VERIFIED | Runs green. |

### Key Link Verification

`gsd-tools query verify.key-links` returned 4/4 `verified:false` with "Target not referenced in source" — its same-file heuristic cannot follow Preact imports across files. Manual import + usage verification (Step 5 fallback) confirmed all four links WIRED.

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `packages/efx-watercolor/src/playground/brushes.ts` | `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | `brushSections` / `brushGroupLabels` / `brushPresetsForTool` | ✓ WIRED | `brushGroupLabels` imported (lines 62–64), used at line 378; `brushSectionsForTool` imported (line 77) and rendered (line 374). No group list in components (verified `brushToolFamily.ts` derives from `brushGroupOrder`). |
| `packages/efx-watercolor/src/playground/mediums.ts` | `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | `MediumId` union typing | ✓ WIRED | `type MediumId` imported; `BRISTLE_MEDIA` (line 116) and `ACRYLIC_HIDDEN` (line 132) typed `readonly MediumId[]`; both package `check` and app `tsc --noEmit` pass, so a straggler medium id cannot compile. |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` | `visibleAquarelleParamGroups(activeTool, selectedMediumId)` | ✓ WIRED | Imported and called at `AquarelleGlobalsPanel.tsx:184`; groups render with `data-testid="aquarelle-param-group-${group.id}"`; panel tests pin both contexts. |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` | `isAquarelleParamRowVisible(activeTool, aquarelleSelectedMediumId.value, 'water')` | ✓ WIRED | Import line 39; call line 472; renders the Water slider only when true (lines 619–633). |

### Data-Flow Trace (Level 4)

All values come from the shipped static catalog plus in-memory document signals — there is no fetch/DB layer for this surface, and none is expected.

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `AquarelleGlobalsPanel.tsx` Medium dropdown | `MEDIUMS` | Package catalog (`mediums.ts`) | Yes — two frozen records | ✓ FLOWING |
| `AquarelleGlobalsPanel.tsx` row groups | `selectedMediumId`, `activeTool` | `aquarelleSelectedMediumId` / `aquarelleActiveTool` signals, seeded from the loaded document via `applyAquarelleMedium`/`mediumById` | Yes — real selection state, default `acrylic` | ✓ FLOWING |
| `PhysicsPaintTopBar.tsx` Water slider | `waterRowVisible` | Same shared selector + same `aquarelleSelectedMediumId` signal | Yes | ✓ FLOWING |
| `WatercolorBrushLibrary.tsx` sections | `activeTool`, `brushSectionsForTool` | `aquarelleActiveTool` signal + `BRUSH_PRESETS` | Yes | ✓ FLOWING |
| Replay resolution | recorded `brushId` | Stroke payload → `engineAdapter.ts:425` → `presetFor` → `round` fallback | Yes — executed against dist | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Package targeted suites (mediums, brushes, dryMedia, engineStartDwell, brushBridge, maskRegistry) | `pnpm --dir packages/efx-watercolor exec vitest run <6 files>` | 6 files / 87 tests passed | ✓ PASS |
| App targeted suites (AquarelleGlobalsPanel, aquarelleParamVisibility, PhysicsPaintTopBar, WatercolorBrushLibrary, brushToolFamily) | `pnpm --dir app exec vitest run <5 files>` | 5 files / 156 passed, 3 skipped (pre-existing emboss `describe.skip`, present at base) | ✓ PASS |
| Full package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | 43 files / 1024 tests passed | ✓ PASS |
| Package typecheck | `pnpm --dir packages/efx-watercolor run check` | exit 0 | ✓ PASS |
| Package build (must precede app tsc — app tsc resolves `dist/*.d.ts`) | `pnpm --dir packages/efx-watercolor run build` | exit 0 | ✓ PASS |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | exit 0 | ✓ PASS |
| Full app suite | `pnpm --dir app exec vitest run` | 468 files / 9961 tests, 2 skipped, 1 failed: `physicPaintBridge.test.ts > catalog pull > removes its one-shot listener when no receiver answers (bounded wait)` timed out at 20009ms | ⚠️ FAIL — diagnosed pre-existing/unrelated: the file is untouched by the quick (`git diff --stat 074bdafc3..f5da7c094` empty for it; last commits `5d02eb62c`/`3a8007f3f`/`87247fa9b` predate it), passes in isolation in 66ms, and matches the executor's disclosed fake-timer flake under parallel load. Not a must-have failure; no full-suite re-run (Step 7b). |
| Structural enumeration (built `dist/index.mjs`) | `node --input-type=module -e "import('./packages/efx-watercolor/dist/index.mjs')…"` | 12 presets in 2 groups; labels `{watercolor:'Watercolor', acrylic:'Gouache'}`; 11 retired ids absent; `mediumById` null for gouache/pastel/graphite/chalk | ✓ PASS |
| Unknown-id fallback (built dist) | same module — `buildBrushForStroke(id, {})` for `chalk`, `gouache-round`, `bristle-flat`, `no-such-response` | all four resolve to `round` | ✓ PASS |
| Debt markers in changed files | `git diff --name-only 074bdafc3..f5da7c094 \| xargs grep -n -E "TBD\|FIXME\|XXX"` (+ placeholder copy scan) | no matches | ✓ PASS |

### Probe Execution

Not applicable — this is a catalog/visibility change, not a migration or CLI/tooling phase. No `scripts/*/tests/probe-*.sh` exists, the plan declares probe sources under `packages/efx-watercolor/probe/**` archival and out of scope, and the scope audit confirmed `git diff --exit-code -- packages/efx-watercolor/probe` is clean.

### Requirements Coverage

None declared — the plan's frontmatter carries `requirements: []`, and this is a quick task with no ROADMAP mapping; no orphaned requirement applies.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` | 496 | Stale test title: "lists the five D-18 names in the fixed order…" while the case asserts the two-entry Watercolor/Gouache dropdown | ℹ️ Info | Title-only mismatch; assertions are correct. |
| `261124-iq9-SUMMARY.md` (coverage D6) | — | Cites a test ref `brushBridge.test.ts#presetFor falls back to round for an unknown id` that does not exist in the suite | ⚠️ Warning | No dedicated regression test pins the unknown-id fallback; truth 6 is verified here by direct execution of the built resolver instead. A pin would protect it going forward. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | — | Modified although the plan's untouched list implied not to | ℹ️ Info | Disclosed in SUMMARY as a Rule 1 fix: five call sites fed `brushId: 'chalk'` into catalog-validating writers; retargeted to `bristle-round` with assertion intent preserved; required for the full app suite to be green. |
| `app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts` | — | Expected aspect derived from `BRUSH_PRESETS` instead of a literal | ℹ️ Info | Disclosed Rule 1 fix; derives `RESPONSE_ASPECT` from the table so it cannot go stale again. Correct direction. |

No `TBD`/`FIXME`/`XXX` markers, no placeholder copy, and no stub implementations were found in any of the 36 changed files.

Non-blocking observations:

- The full app suite's one failure is the pre-existing `physicPaintBridge` bounded-wait fake-timer flake (see Behavioral Spot-Checks); the executor disclosed the same flake.
- Suite counts differ slightly from SUMMARY's claim (SUMMARY: 466 files / 9861 passed; measured: 468 files / 9961 tests). Collection drift only; no goal-relevant effect.

### Human Verification Required

These are the six artist-run UAT rows from the plan; they stay pending and are the ONLY unverified items (code-level truths are all verified above).

#### 1. Two-entry Medium dropdown and the Gouache deposit

**Test:** Open the Studio and the Medium dropdown; select Gouache and paint a stroke.
**Expected:** The dropdown lists exactly Watercolor and Gouache; the Gouache selection paints the shipped opaque body-colour deposit.
**Why human:** The painted appearance of the deposit is a visual property — unit pins only prove the record/catalog wiring.

#### 2. Brush + Gouache hides Viscosity and Water on both surfaces

**Test:** Brush tool + Gouache medium; inspect the Paint panel AND the Studio top bar.
**Expected:** Panel shows only Pigment, Pickup, Dry speed and Feather (no Viscosity, no Water row, no Medium heading); top bar shows Brush size, Pigment, Edges and Grain with no Water slider.
**Why human:** Live-surface UAT of both visible surfaces in the running Studio.

#### 3. Brush + Watercolor restores both with unchanged paint

**Test:** Brush tool + Watercolor medium; inspect both surfaces, paint and re-bake a stroke.
**Expected:** Panel brings Viscosity and Water back with the watercolor row set; the top bar's Water slider is back between Pigment and Edges; the painted look is unchanged.
**Why human:** Paint/re-bake look parity needs the artist's eye.

#### 4. Water tool keeps Viscosity under both media

**Test:** Water tool under each medium, then the Eraser.
**Expected:** The Water tool renders Viscosity under both media (no Water slider in either); the Eraser keeps Lift alone with its own Size/Strength cluster.
**Why human:** The running tool cluster is the acceptance surface.

#### 5. Library shows two headings only

**Test:** Open the brush library (floating brush modal and right-panel Brush tab).
**Expected:** Two headings only — Watercolor (eleven cards) and Gouache (one card, the renamed Bristle Round); the Chalk and Graphite sections are gone.
**Why human:** Rendered library layout is a visual property.

#### 6. Old project with a removed response renders via the round fallback

**Test:** Open an older project whose stroke recorded a removed response (e.g. chalk).
**Expected:** The mark still renders through the round fallback, with no error and no crash on open or re-render.
**Why human:** Exercises the full load/re-render path in a real old project; unit evidence proves only the resolver.

### Gaps Summary

None. All six must-have truths are verified against the live tree — catalog taxonomy (two media, twelve presets in two groups, the Gouache rename), the shared row-visibility selector gating both the Paint panel and the top-bar Water slider, the Water/Eraser exceptions, and the unchanged round fallback for retired response ids. All plan artifacts exist, are substantive and wired; all four key links are manually confirmed; no debt markers or stubs were introduced. The only unverified items are the six artist-run UAT rows, which the plan explicitly keeps pending.

---

_Verified: 2026-11-24T13:21:42Z_
_Verifier: Claude (gsd-verifier)_
