---
status: diagnosed
trigger: "Investigate the Phase 36.10 UAT gap: when rendering/exporting, the Physics Paint layer is not removed on the video."
created: 2026-06-27T00:00:00Z
updated: 2026-06-27T18:54:52Z
---

## Current Focus

hypothesis: "The export/render path still composites the visible Physics Paint FX sequence, while saved Roto real-key frames contain transparent strokes only and do not draw the selected paper/background behind real keys."
test: "Trace Physics Paint FX sequence creation, export overlay compositing, PreviewRenderer real-key drawing, and Roto output frame generation."
expecting: "If true, export renders the visible Physics Paint FX layer and real-key Roto drawing uses only saved transparent dataUrl pixels; paper/background is drawn only for missing frames."
next_action: "Plan fixes from the diagnosed UAT gap."

## Symptoms

expected: "During rendering/export, the live Physics Paint editing layer should be hidden/removed from the video capture surface, and only intended saved/composited Physics Paint content should appear."
actual: "Phase 36.10 UAT gap reports that when rendering/exporting, the Physics Paint layer is not removed on the video."
errors: "No explicit error message provided."
reproduction: "Render/export a video from Phase 36.10 workflow with a Physics Paint layer present."
started: "Observed during Phase 36.10 UAT."

## Eliminated

- The exporter does not capture the DOM canvas stack directly; `startExport` creates an offscreen canvas and renders through `PreviewRenderer`.
- `exportRenderer.ts` stays delegated through `PreviewRenderer`; there is no separate export-only Physics Paint replay branch.

## Evidence

- `app/src/components/timeline/AddFxMenu.tsx` creates Physics Paint as a visible FX sequence with a `physic-paint` layer.
- `app/src/lib/exportRenderer.ts` composites all visible non-content overlay sequences in `renderGlobalFrame`, so visible Physics Paint FX sequences participate in video export.
- `app/src/lib/previewRenderer.ts` draws Physics Paint real-key frames by loading and drawing the saved `renderedFrame.dataUrl` only.
- `app/src/lib/previewRenderer.ts` draws `drawMissingRotoBackground` only when `missingDraw.kind === 'background-only'`; real-key frames skip that background branch.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` builds Roto output with `buildRotoOutputFrame`, which calls `exportTransparentStrokeCanvas` and forces `engine.setBgMode('transparent')` before capturing.

## Resolution

root_cause: "The video/export path renders all visible non-content overlay sequences, including Physics Paint FX sequences, and the Roto save path now stores transparent stroke-only PNGs. For frames with real Roto paint, PreviewRenderer draws the saved stroke PNG but only draws paper/background for missing frames; it does not draw the saved Roto paper background behind real-key stroke PNGs or provide a render/export mode that hides/removes the Physics Paint FX layer after baking it. The user therefore sees the live Physics Paint layer/transparent rectangle behavior in rendered video instead of a clean composite."
fix: "Define render/export semantics for real-key Roto frames: composite saved paper/background behind transparent stroke PNGs when the Roto background is paper, without baking paper into editable alpha caches; ensure rendered video uses the intended baked/composited Roto output and does not leave an extra live Physics Paint FX layer visible after render/export."
verification: "Add preview/export regression coverage for real-key Roto frames with paper background, not only missing background frames."
files_changed: []
