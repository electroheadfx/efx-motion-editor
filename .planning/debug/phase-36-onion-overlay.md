---
status: investigating
trigger: "Phase 36 Physics Paint onion overlay bug: after Save roto frame, onion preview appears as a yellow/white full-window/UI overlay instead of being clipped to the canvas and transparent over only strokes."
created: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:00:00Z
---

# Debug Session: Phase 36 Onion Overlay

## Symptoms

expected_behavior: |
  Onion preview should render only over the actual paint canvas surface, clipped to the canvas bounds, and should show transparent/tinted previous/next stroke content rather than an opaque paper/background snapshot.
actual_behavior: |
  After clicking Save roto frame, onion preview appears as a yellow/white screen or wash over the top of the EFX Physics Paint UI/window. It is not limited to the canvas and includes the paper/background.
error_messages: |
  No console error reported by user. Visual bug shown in screenshot.
timeline: |
  Observed after Phase 36 gap-closure implementation that added local Roto preview snapshots for onion overlays.
reproduction: |
  Open EFX Physics Paint, draw on Roto canvas, click Save roto frame so the studio advances to the next frame. Onion preview displays the saved frame as a yellow/white full-window or UI overlay instead of canvas-only transparent strokes.

## Current Focus

hypothesis: "The onion preview uses full composite canvas snapshots that include paper/background and renders them in an absolutely positioned overlay sized to the canvas stack/window rather than the actual canvas element box."
test: "Inspect PhysicsPaintStudio snapshot generation and physicsPaintStudio.css onion overlay sizing/blend rules."
expecting: "buildRotoPreviewFrame uses engine.exportCompositeCanvas().toDataURL and .physics-paint-onion-overlay.canvas-region is inset over the full canvas stack, with no transparent mask."
next_action: "Create failing/source-contract tests, then fix snapshot masking and overlay clipping."
reasoning_checkpoint: "User confirmed this is a serious implementation bug and suggested using GSD debug."
tdd_checkpoint: null

## Evidence

- timestamp: 2026-06-13T14:00:00Z
  source: app/src/components/physic-paint/PhysicsPaintStudio.tsx
  observation: buildRotoPreviewFrame used engine.exportCompositeCanvas().toDataURL('image/png'), which captures the paper/background along with strokes.
- timestamp: 2026-06-13T14:00:00Z
  source: app/src/components/physic-paint/physicsPaintStudio.css
  observation: .physics-paint-onion-overlay was absolutely positioned over the canvas stack with inset-based sizing rather than measured canvas bounds.
- timestamp: 2026-06-13T14:00:00Z
  source: specialist review
  observation: typescript-expert review agreed with exporting a transparent-background preview and restoring engine state in finally; noted mutation/flicker is acceptable for Save/navigate path.

## Eliminated

- The overlay is rendered inside .physics-paint-canvas-stack, not globally fixed over the whole application; the UI wash came from an opaque full-frame snapshot plus stack-level sizing.

## Specialist Review

LOOKS_GOOD — the fix direction is appropriate: generate the onion preview with a transparent background via the engine instead of post-processing paper pixels, restore engine state afterward, and position the overlay from the measured canvas rect. One pitfall to guard is avoiding visible flicker/state mutation during export; because this runs during Save/navigate rather than every paint frame and restores in `finally`, the tradeoff is acceptable for the focused fix.

## Resolution

root_cause: Roto onion previews captured full composite canvases including paper/background and displayed them in an overlay sized from the canvas stack instead of the actual canvas element.
fix: Roto preview export now temporarily switches the engine to transparent background, exports the composite stroke canvas, restores the saved engine state, and clips the onion overlay to measured canvas bounds.
verification: pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts passed; earlier pnpm --dir app test -- PhysicsPaintStudio.test.ts --run also reported all tests passing before entering watch mode.
files_changed:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
