---
phase: quick/261115-oh9
verified: 2026-11-15T18:09:13Z
status: human_needed
score: 7/8 must-haves verified
covered_files: [".planning/quick/261115-oh9-fix-texture-becomes-a-setting-of-the-bru/261115-oh9-PLAN.md", ".planning/quick/261115-oh9-fix-texture-becomes-a-setting-of-the-bru/261115-oh9-SUMMARY.md", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/engine/aquarelleFootprint.ts", "app/src/components/physic-paint/physicsPaintStudio.css", "app/src/components/physic-paint/roto/aquarelleLiftErase.ts", "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts", "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts", "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx", "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx", "app/src/components/physic-paint/view/WatercolorTextureStrip.tsx", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/aquarelleStrokeBand.ts", "app/src/components/physic-paint/view/vectorPathHandles.ts", "app/src/components/physic-paint/view/watercolorMaskChip.ts", "app/src/components/physic-paint/view/watercolorStrokeThumb.ts", "packages/efx-watercolor/probe/vector-spine/probe.ts", "packages/efx-watercolor/probe/watercolor-opacity/probe.ts", "packages/efx-watercolor/src/adapter/engineAdapter.ts", "packages/efx-watercolor/src/brushes/maskRegistry.ts", "packages/efx-watercolor/src/payload/codec.ts", "packages/efx-watercolor/src/payload/toStudioStroke.ts", "packages/efx-watercolor/src/playground/Engine.ts", "packages/efx-watercolor/src/playground/brushBridge.ts", "packages/efx-watercolor/src/playground/brushes.ts", "packages/efx-watercolor/src/playground/index.ts"]
covered_digest: "v4:sha256:b3d3e6fd4e8f1ba98c4fc9593e41e999e39c1a320511350b73911738a65e079e"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 7/8
  gaps_closed: []
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "The eraser (lift) carries no texture, at live, record and punch time."
    test: "With a textured response selected (e.g. Chalk + Chalk grain), drag the pen's eraser end across painted strokes, then record that eraser stroke and undo/redo it."
    expected: "The live erase silhouette is the response's own untextured tip (no grain footprint); the recorded eraser stroke carries no textureId, replays as an untextured erase, and matches the punch."
    why_human: "The live leg runs inside Engine.lift() with a real WebGL context and the record leg is a gate in the canvas stroke-end handler; no test executes either path. Both are source-pinned only (engineTipIdentity.test.ts, aquarelleLayerContract.test.ts). The punch leg is behaviorally tested; the bake/replay legs are gated at engineAdapter.ts configure() (source-pinned) and at the toStudioStroke projection (behaviorally tested in codec.test.ts)."
human_verification:
  - test: "Paint a stroke with Chalk + Chalk grain, then paint the same response with the Default texture chip."
    expected: "The grain stroke keeps Chalk's dry-media physics (water 0, roughness, crumbly edges) over the grain stamp — visibly not the generic watercolor response — while the Default chip paints Chalk's own procedural tip exactly as before."
    why_human: "Visual appearance of painted output; acceptance 1 cannot be asserted by reading source or by the existing suite."
  - test: "Open the brush library and the top-bar brush popover and inspect the texture row."
    expected: "Every chip shows the real 192x192 grayscale mask on a dark ground with the white footprint; no chip shows a painted watercolor stroke; the grid above lists responses only."
    why_human: "Visual rendering property of canvas output (acceptance 3); the data source is proven, the appearance is not."
  - test: "With a textured response selected, erase with the pen's eraser end, then record and undo/redo that eraser stroke."
    expected: "The live erase silhouette matches the response's untextured tip; the recorded eraser stroke carries no texture and replays identically."
    why_human: "Behavior-unverified truth 8: the live and record legs run only with a WebGL context / real stroke handler."
---

# Quick 261115-oh9: Texture becomes a setting of the brush response — Verification Report

**Phase Goal:** A brush response (`BRUSH_PRESETS`) always owns the physics; a texture (`wc/builtin-*`, `wc/custom-*`, or none) only replaces the 192x192 footprint — and the pair survives live, record, replay, duplicate and Roto scripts while the eraser stays texture-free.
**Verified:** 2026-11-15T18:09:13Z
**Status:** human_needed
**Re-verification:** Yes — against HEAD `314209671`, after the prior report's tree advanced with the no-texture lift law enforced at every reader.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | A selected texture replaces only the footprint — the chosen response's own physics (water, load, flow, roughness, spacing, scatter, rotation) still drive the stroke. | ✓ VERIFIED | `brushBridge.ts` `resolveStrokeBrush`: `base = presetFor(brushId)`, `tip = mask ?? base.tip`, then the eight D-08 multipliers are applied ungated in `buildBrushForStroke`. Behavioral: `brushBridge.test.ts` LAW tests assert multipliers hold with a mask present across preset x texture combinations; `aquarelleTextureParity.test.ts` compares live/record/replay brush fields. |
| 2 | The Default texture chip paints the selected response's own procedural tip, and repaints when the response changes. | ✓ VERIFIED | `textureId: null` resolves to `base.tip` (`brushBridge.ts`). `watercolorMaskChip.ts` caches by `${responseId}|${textureId ?? ''}|g${maskGeneration()}` so a response change repaints. Behavioral: `brushBridge.test.ts` no-texture parity; `watercolorMaskChip.test.ts` (response-keyed cache, texture wins); `WatercolorTextureStrip.tsx` Default chip writes `textureId: null`. |
| 3 | A recorded stroke carries its texture through the payload codec, the record restore, duplicate/copy and a saved Roto script. | ✓ VERIFIED | `toStudioStroke.ts` writes `textureId` inside the opaque `engine` literal via conditional spread; `codec.ts` `isStrokeShape` validates present-non-empty; `aquarelleRecordState.ts` records and restores conditionally; `physicsPaintRotoDuplicateScript.ts` preserves it; `physicsPaintRotoScriptLibrary.ts` round-trips it. Behavioral: codec round-trip + absent-stays-absent (schemaVersion stays 1), `aquarelleRecordState.restore.test.ts`, duplicate test, serialize→parse test — all pass. |
| 4 | Live, bake and replay resolve the same brush for the same (brushId, textureId) pair. | ✓ VERIFIED | One resolution function used by every reader: `applyLiveConfig` (live), `engineAdapter.ts` `configure()` forwarding `payload.textureId` (bake/replay), payload re-resolution (replay). Behavioral: `aquarelleTextureParity.test.ts` asserts field-identical brushes across live/record/replay for the same pair, including the no-texture and unknown-texture cases. The adapter's forwarding is source-pinned (`engineAdapter.test.ts` slices `const configure`) because no injectable engine seam exists. |
| 5 | An unknown or unavailable texture falls back to the response's own tip without throwing, and is surfaced as exactly one aggregate warning. | ✓ VERIFIED | `resolveMask(id) ?? base.tip` fallback; `aquarelleRecordState.ts` WR-01 guard drops an unresolvable `textureId`; `WatercolorTextureStrip.tsx` disables unavailable chips and validates its selected state through `resolveMask` (IN-03); `WatercolorBrushLibrary.tsx` renders one aggregate warning. Behavioral: `brushBridge.test.ts` unknown-mask fallback, `aquarelleTextureParity.test.ts` unknown fallback, `WatercolorBrushLibrary.test.ts` one aggregate warning with greyed chips. |
| 6 | The brush grid lists responses only; textures appear only in the texture row, each chip showing the real grayscale mask. | ✓ VERIFIED | `WatercolorBrushLibrary.tsx` renders one responses-only section over `BRUSH_PRESETS`, textures in a row above. `watercolorMaskChip.ts` blits `strokeTipData(brushId, textureId)` — the engine's own 192x192 bytes — as `(v,v,v,255)`. Behavioral: `WatercolorBrushLibrary.test.ts` (one response section, strip above grid, chip order); `watercolorMaskChip.test.ts` (192x192, grayscale, zero → black, engine-tip source, no toDataURL). Visual appearance is acceptance 3 → human. |
| 7 | The top-bar popover lists responses plus a texture strip below the list; the eraser branch gains no strip. | ✓ VERIFIED | `PhysicsPaintBrushMenu.tsx` renders `<WatercolorTextureStrip compact />` as a sibling AFTER `SidebarScrollArea` inside `.physics-paint-brush-menu-textures`; the lift branch has no strip. Behavioral: `PhysicsPaintBrushPicker.test.ts` asserts strip in the brush branch only, sibling after scroller, texture pick keeps open / response pick closes, catalog-generation layout dep. |
| 8 | The eraser (lift) carries no texture, at live, record and punch time. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | All four legs exist and are wired after `314209671`. Punch: `liftShapeForStroke` forces `textureId: null` and its `Pick` excludes the field — behaviorally tested (`aquarelleLiftErase.test.ts`). Record: `...(recordedTool !== 'lift' && snap.textureId !== null ? ...)` in `AquarelleCanvasLayer.tsx` — source-pinned (`aquarelleLayerContract.test.ts`). Live: `applyLiveConfig` binds `engine.setLiftBrush` to the untextured response brush (filbert fallback, IN-04) and `Engine.lift()` uses `this.liftBrush ?? this.brush` — source/unit-pinned only (`engineTipIdentity.test.ts`). Bake/replay: `configure()` nulls the texture when `tool === 'lift'` (source-pinned, `engineAdapter.test.ts`) and `toStudioStroke` drops it for lift (behaviorally tested, `codec.test.ts` CR-01 case). No test executes the live WebGL lift path or the stroke-end record handler. See Human Verification 3. |

**Score:** 7/8 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/playground/brushBridge.ts` | One texture law | ✓ VERIFIED | `resolveStrokeBrush`, `BrushStrokeOptions`, `buildBrushForStroke`, `strokeTipData`; no `CUSTOM_BASE` base selection. |
| `packages/efx-watercolor/src/payload/toStudioStroke.ts` | Record-side carrier | ✓ VERIFIED | `textureId?` on payload and stroke; written only inside the `engine` literal, conditional spread; dropped when `tool === 'lift'` (CR-01). |
| `packages/efx-watercolor/src/payload/codec.ts` | Wire carrier + guard | ✓ VERIFIED | `isStrokeShape` accepts absent or non-empty string; `cloneStrokeForWire` carries via `...stroke.engine`; `AQUARELLE_SCHEMA_VERSION` stays 1. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Selection + record/restore | ✓ VERIFIED | `aquarelleSelectedTextureId`, compare-then-write setter, `aquarelleBrushForActiveTool` (WR-01 guard, lift → null), snapshot/restore conditional spread. |
| `app/src/components/physic-paint/view/watercolorMaskChip.ts` | Real-mask chip bytes | ✓ VERIFIED | `strokeTipData` → 192x192 grayscale ImageData, cache keyed response+texture+generation. |
| `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` | Texture chips | ✓ VERIFIED | Default first, then `BUILTIN_TIPS`, then `customBrushTips`; click writes only `setAquarelleSelectedTextureId`; unavailable chips disabled; selected state validated through `resolveMask` (IN-03). |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | Responses grid + texture row | ✓ VERIFIED | Responses-only grid; texture row above; import selects the new texture on arrival; one aggregate warning. |
| `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` | Pinned popover strip | ✓ VERIFIED | Strip sibling after scroller; lift branch includes no strip; mounted from `PhysicsPaintStudioView.tsx`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `aquarelleRecordState.ts` | `AquarelleCanvasLayer.tsx` | `aquarelleBrushForActiveTool().textureId` feeds `applyLiveConfig` and the stroke-end record literal | ✓ WIRED | `applyLiveConfig` re-binds each rAF tick and at mount; the record literal gates on `recordedTool`. |
| `WatercolorTextureStrip.tsx` | `brushBridge.ts` | `strokeTipData(brushId, textureId)` supplies chip bytes | ✓ WIRED | Chip renders the engine's tip bytes; no thumbnail approximation path. |
| `codec.ts` | `engineAdapter.ts` | `engine.textureId` survives `cloneStrokeForWire`; `configure()` forwards `payload.textureId` into `buildBrushForStroke` (nulled for lift) | ✓ WIRED | Source-pinned in `engineAdapter.test.ts` (no injectable engine seam in this project). |
| `PhysicsPaintBrushMenu.tsx` | `aquarelleRecordState.ts` | `setAquarelleSelectedTextureId` written in the chip click handler | ✓ WIRED | Click handler writes the signal; texture click keeps the menu open by design (D-07). |
| `physicsPaintRotoScriptLibrary.ts` | `physicsPaintRotoScriptSchema.ts` | `engine.textureId` rides the engine spread; `referencedCustomBrushIds` reads it | ✓ WIRED | Custom ids collected from both axes; save refuses by name; schema accepts/validates the field. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `watercolorMaskChip.ts` | `textureId` / chip pixels | `strokeTipData` → `resolveStrokeBrush` → `resolveMask` | Yes — real mask bytes, no literals | ✓ FLOWING |
| `WatercolorTextureStrip.tsx` | `customBrushTips`, `unavailableTipIds`, `brushCatalogGeneration` | brush catalog store | Yes — real catalog state | ✓ FLOWING |
| `WatercolorBrushLibrary.tsx` | `BRUSH_PRESETS`, texture row, import result | presets + catalog | Yes | ✓ FLOWING |
| `AquarelleCanvasLayer.tsx` | `selection.textureId` | `aquarelleBrushForActiveTool()` | Yes — signal read each tick | ✓ FLOWING |
| `physicsPaintRotoScriptLibrary.ts` | `engine.textureId` | script events / payloads | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Texture law + carriers (package, this tree) | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/brushBridge.test.ts src/payload/codec.test.ts src/adapter/engineAdapter.test.ts src/playground/engineTipIdentity.test.ts src/brushes/builtinBake.test.ts src/brushes/maskRegistry.test.ts` | 5 test files passed, 1 skipped; 118 passed, 9 skipped | ✓ PASS |
| Record/restore/lift/parity/UI/Roto (app, this tree) | `vitest run` over `aquarelleTextureParity.test.ts`, `aquarelleLayerContract.test.ts`, `aquarelleFootprint.test.ts`, `aquarelleLiftErase.test.ts`, `physicsPaintRotoDuplicateScript.test.ts`, `physicsPaintRotoScriptSchema.test.ts`, `physicsPaintRotoScriptLibrary.test.ts`, `WatercolorBrushLibrary.test.ts`, `PhysicsPaintBrushPicker.test.ts`, `aquarelleStrokeBand.test.ts`, `watercolorMaskChip.test.ts`, `watercolorStrokeThumb.test.ts`, `aquarelleRecordState.restore.test.ts` | 13 files, 315 passed (0 failed) | ✓ PASS |
| Full suites (orchestrator-run, this tree) | package suite / full app suite / `pnpm run build` | package 425 passed, 9 skipped; app 9409 passed, 1 skipped, 96 todo (444 files); build 1,902.84 kB | ✓ PASS |

### Probe Execution

Not applicable — the quick declares no probes and is not a migration/tooling phase. No `scripts/*/tests/probe-*.sh` exist. The two `packages/efx-watercolor/probe/{watercolor-opacity,vector-spine}/probe.ts` files touched by the texture plumbing are scratch harnesses requiring headless WebGL2 Chrome, not declarative verification probes.

### Requirements Coverage

PLAN declares `requirements: []` (quick task). The source spec's acceptance items map as follows:

| # | Acceptance item | Status | Evidence |
| - | --------------- | ------ | -------- |
| 1 | Chalk + Chalk grain paints with Chalk's physics, visibly not generic watercolor | ? HUMAN | Data path proven (truth 1); visual appearance must be painted. |
| 2 | Same response with Default paints its own procedural tip as before | ✓ SATISFIED | Truth 2 evidence. |
| 3 | Texture row shows the real mask per chip; no painted stroke chip | ? HUMAN | Data proven (truth 6 / mask-chip tests); appearance human. |
| 4 | Brush grid lists responses only | ✓ SATISFIED | `WatercolorBrushLibrary.test.ts`. |
| 5 | Live, bake and replay agree for the same ids | ✓ SATISFIED | `aquarelleTextureParity.test.ts` + adapter source pin. |
| 6 | Stroke round-trips through codec and Roto script | ✓ SATISFIED | Codec/restore/duplicate/script tests. |
| 7 | Unavailable texture falls back with exactly one warning | ✓ SATISFIED | Fallback + aggregate warning tests. |
| 8 | The eraser is unaffected | ? HUMAN (behavior-unverified) | Punch behavioral; projection (replay) behavioral; adapter (bake) source-pinned; live + record legs source-pinned only. |
| 9 | Top-bar popover lists responses and the texture strip | ✓ SATISFIED | `PhysicsPaintBrushPicker.test.ts`. |

### Anti-Patterns Found

None. Changed non-test implementation files were scanned: zero `TBD`/`FIXME`/`XXX`, zero `TODO`/`HACK`/`PLACEHOLDER`, zero placeholder/coming-soon copy, no hardcoded-empty stub flows in the texture path. The repo's accepted-loss note (a phase-63 stroke whose `brushId` is a texture id replays as `round`) is a declared contract, not a stub — documented in `brushBridge.ts` and the SUMMARY. The only skipped tests are pre-existing `describe.skipIf(!gpu)` WebGL blocks; no requirement-linked test is disabled.

Review disposition on the current tree: CR-01, WR-01, IN-01, IN-03, IN-04 and WR-02 are fixed (WR-02 now closes via `Engine.clearTipTextures()` swept by `appliedMaskGeneration` in `AquarelleCanvasLayer.tsx`); IN-02 is accepted by design (the library strip stays interactive during Lift; the pick is remembered for the next brush stroke and never reaches the eraser).

### Human Verification Required

#### 1. Chalk + Chalk grain paints with dry-media physics

**Test:** Paint a stroke with Chalk + Chalk grain, then the same response with Default.
**Expected:** The grain stroke keeps Chalk's physics (water 0, roughness, crumbly edges) over the grain stamp — visibly not generic watercolor — and Default paints Chalk's own tip.
**Why human:** Visual appearance of painted output; acceptance 1.

#### 2. Texture chips render the real mask

**Test:** Open the brush library and the top-bar popover and inspect the texture row.
**Expected:** Each chip shows the 192x192 grayscale mask on a dark ground with a white footprint; no chip shows a painted watercolor stroke.
**Why human:** Visual rendering property; acceptance 3.

#### 3. Eraser stays texture-free live and in the record

**Test:** With a textured response selected, lift with the pen's eraser end; record that eraser stroke and undo/redo.
**Expected:** The live erase silhouette is the response's untextured tip, and the recorded eraser stroke carries no texture and replays identically.
**Why human:** Truth 8's live and record legs require a WebGL context and a real stroke; only source pins exist. The punch, projection and bake gates are already automated.

### Gaps Summary

No gaps. All eight must-have truths are implemented and wired; seven are behaviorally proven. Truth 8 is present and wired at all four legs — punch behavioral; replay projection behavioral; bake/replay `configure()` source-pinned; live and record source-pinned only — so it is recorded as present-but-behavior-unverified rather than failed or verified. Two acceptance items are visual properties. The phase is automated-ready; the three human rows above close it.

---

_Verified: 2026-11-15T18:09:13Z_
_Verifier: Claude (gsd-verifier)_
