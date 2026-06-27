---
status: diagnosed
trigger: "Investigate the Phase 36.10 UAT gap: after painting Roto with paper background, saving the project, closing, and reopening, the paint remains but the paper background is removed/transparent. Context: project root /Users/lmarques/Dev/efx-motion-editor, phase directory .planning/phases/36.10-physics-paint-roto-missing-background-preview-export. Read 36.10-UAT.md and relevant source files. Do not edit code. Find the likely root cause with evidence: file paths, functions, and line numbers where persistence/save/load or paper metadata is lost. Return a concise diagnosis with artifacts and missing fix steps suitable for filling the UAT Gaps section."
created: 2026-06-27T00:00:00Z
updated: 2026-06-27T18:54:52Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Reopened Roto uses cached PNG overlays plus editable state, but the standalone studio launch does not receive or apply persisted roto_background; initial settings stay at defaults and engine.load intentionally keeps the current/default background instead of restoring saved bgMode.
test: Verify launch context lacks rotoBackground, validator rejects it, applyLaunchContext ignores it, and engine.load does not restore bgMode.
expecting: Source lines showing save/load persist roto_background for preview, but reopen-to-studio path omits/applies no paper metadata, explaining transparent/default background after close/reopen.
next_action: Document exact evidence and return diagnose-only root cause; no code edits.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After painting Roto with paper background, saving, closing, and reopening the project, the paint and paper background should both remain visible.
actual: After reopen, paint remains but paper background is removed/transparent.
errors: None reported.
reproduction: Paint Roto with paper background, save project, close, reopen.
started: Phase 36.10 UAT gap.

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-27T00:00:00Z
  checked: 36.10-UAT.md test 5 and Gaps
  found: Lines 36-45 record the user report that after painting Roto with paper background, saving, closing, and reopening, paint remains but paper background is removed; lines 126-133 leave artifacts and missing fix steps empty for this exact gap.
  implication: Need to trace only persisted project/save/load paths for Roto paper/background metadata, not live painting correctness.
- timestamp: 2026-06-27T00:00:00Z
  checked: app/src/types/physicPaint.ts
  found: PhysicPaintWorkflowMetadata includes optional rotoBackground at lines 71-79; PhysicPaintRotoBackgroundMetadata requires background, paperGrain, grainStrength, and optional color at lines 22-27; validator isPhysicPaintRotoBackgroundMetadata exists at lines 395-405.
  implication: The intended persisted data model has explicit Roto background metadata, so a loss can occur if save/load or normalizers omit workflowMetadata.rotoBackground.

- timestamp: 2026-06-27T00:00:00Z
  checked: app/src/stores/physicPaintStore.ts save/load path
  found: The store can persist Roto paper metadata: _metadataToMce writes metadata.rotoBackground to roto_background at lines 98-107; toMceOutputs includes _metadataToMce at lines 590-609; _metadataFromMce reads output.roto_background at lines 374-394; loadFromMceOutputs stores that metadata at lines 618-658; applyCanvas derives rotoBackground from editableState at lines 747-760.
  implication: The raw project .mce path is not the only failure point; preview/export can have metadata after load if it was saved.
- timestamp: 2026-06-27T00:00:00Z
  checked: app/src/stores/projectStore.ts and app/src/types/project.ts
  found: Project schema includes McePhysicPaintOutput.roto_background at project.ts lines 50-63; project save writes physic_paint_outputs via savePhysicPaintData at projectStore.ts lines 640-661; open hydrates them through loadPhysicPaintData and physicPaintStore.loadFromMceOutputs at projectStore.ts lines 715-725 and 519-520.
  implication: Project-level serialization supports the field, so the remaining high-probability loss is in the reopened standalone launch/editing path or validator contract.
- timestamp: 2026-06-27T00:00:00Z
  checked: app/src/lib/physicPaintPersistence.ts
  found: savePhysicPaintData spreads ...output into persistedOutputs at lines 110-114, preserving top-level roto_background; loadPhysicPaintData spreads ...metadata back into hydratedOutputs at lines 165-170, preserving top-level roto_background. However tests in physicPaintPersistence.test.ts lines 50-97 cover PNG/cache/onion hydration only and do not assert roto_background survival.
  implication: Persistence implementation appears capable, but missing regression coverage allowed the user-visible launch contract gap to survive.
- timestamp: 2026-06-27T00:00:00Z
  checked: app/src/lib/physicPaintBridge.ts createPhysicPaintLaunchContext
  found: createPhysicPaintLaunchContext builds the standalone window context at lines 239-316 from editableState, cachedRotoFrames, and rotoInterpolationSettings, but never reads physicPaintStore.getRotoBackgroundMetadata(layerId) and never includes a rotoBackground/roto_background field.
  implication: After close/reopen, the standalone Physics Paint window is relaunched without the persisted paper/background metadata.
- timestamp: 2026-06-27T00:00:00Z
  checked: app/src/types/physicPaint.ts launch context validator
  found: PhysicPaintWorkflowMetadata has rotoBackground at lines 71-79, but PhysicPaintLaunchContext at lines 81-105 has no rotoBackground field; isPhysicPaintLaunchContext validates known launch fields at lines 234-260 and likewise does not accept/apply a Roto background field.
  implication: Even if createPhysicPaintLaunchContext added the metadata, the launch contract must be extended or the standalone window cannot receive it reliably.
- timestamp: 2026-06-27T00:00:00Z
  checked: app/src/components/physic-paint/PhysicsPaintStudio.tsx reopened studio initialization
  found: Initial settings default to canvas1/canvas1/grainStrength 0.45 at lines 511-528; applyLaunchContext only applies playRenderOptions to settings at lines 200-217 and has no Roto background branch; engine restore effect only engine.load(resizePhysicsPaintState(...)) at lines 816-831.
  implication: Reopened Roto editing starts with default settings rather than persisted Roto paper metadata.
- timestamp: 2026-06-27T00:00:00Z
  checked: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts SerializedProject load/save behavior
  found: serializeProject saves settings.bgMode, paperGrain, and embossStrength at lines 1268-1299, but loadProjectData explicitly says it restores brush settings while keeping current background at lines 1301-1310 and does not set state.bgMode from json.settings.bgMode.
  implication: Saved editableState can preserve stroke data and paper grain strength, but cannot restore the selected background mode into the standalone engine on load; it relies on host launch/settings to set bgMode, which are missing for Roto.
- timestamp: 2026-06-27T00:00:00Z
  checked: PreviewRenderer preview/export path
  found: PreviewRenderer can draw missing Roto background from physicPaintStore.getRotoBackgroundMetadata at lines 90-105 and draws background-only instructions before frame PNG at lines 360-379; collectRotoPaperTextures also reads this metadata at lines 187-197.
  implication: The issue is specifically the reopened editing/standalone canvas background path, not necessarily preview/export once store metadata exists.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Reopened Roto launches the standalone Physics Paint editor without the persisted Roto paper/background metadata. The project/store layer has a roto_background field and can round-trip it, but createPhysicPaintLaunchContext omits it from PhysicPaintLaunchContext; the validator/type contract lacks a Roto background field; PhysicsPaintStudio only applies playRenderOptions, not Roto background metadata; and EfxPaintEngine.load intentionally does not restore bgMode from editableState. Therefore after save/close/reopen, cached paint PNGs remain, but the live standalone canvas/settings fall back to default/transparent background instead of the saved paper.
fix: Not applied per user request. Missing fix steps: extend PhysicPaintLaunchContext with optional rotoBackground metadata; populate it from physicPaintStore.getRotoBackgroundMetadata(layerId) in createPhysicPaintLaunchContext; validate it with isPhysicPaintRotoBackgroundMetadata; apply it in PhysicsPaintStudio/applyLaunchContext for Roto by updating settings and calling engine.setBgMode/setPaperGrain/setEmbossStrength when engine is ready; add regression tests for save -> load -> create launch context -> studio engine settings preserving paper.
verification: Diagnosis only; source evidence inspected, no code edited.
files_changed: []
