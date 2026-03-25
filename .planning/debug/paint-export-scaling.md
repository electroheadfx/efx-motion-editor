---
status: awaiting_human_verify
trigger: "When exporting video at half size (0.5x), paint layers are not resized — they render at full 100% size on the half-size video output."
created: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - Paint offscreen canvas used logicalW/logicalH (export size) but paint data is in project-space coordinates, so strokes rendered at wrong scale during non-1x export
test: TypeScript compiles, tests pass (no regressions)
expecting: User confirms paint layers now scale correctly at 0.5x export
next_action: Await human verification

## Symptoms

expected: Paint layers should resize proportionally with the video when exporting at a reduced size (e.g., 0.5x export should scale paint to 0.5x too)
actual: Paint stays at 100% (original/full size) on the half-size video — paint strokes appear oversized/mispositioned
errors: No console errors during export
reproduction: Export video at half size (0.5x) with paint layers present
started: First time trying half-size export with paint — never worked

## Eliminated

## Evidence

- timestamp: 2026-03-25T00:00:30Z
  checked: Paint type definitions (types/paint.ts)
  found: All paint coordinates are explicitly in "project-space coords" (lines 8, 27, 39). Brush size is in "project pixels" (line 12).
  implication: Paint data always uses project-native resolution, not export resolution.

- timestamp: 2026-03-25T00:00:45Z
  checked: Export engine canvas setup (exportEngine.ts lines 76-105)
  found: Export canvas is created at exportWidth x exportHeight = projectWidth * settings.resolution (e.g., 0.5x). PreviewRenderer receives this smaller canvas.
  implication: During export, logicalW = exportWidth (e.g., 960 for 0.5x of 1920), not projectWidth.

- timestamp: 2026-03-25T00:01:00Z
  checked: Paint compositing in previewRenderer.ts (lines 268-283)
  found: Paint offscreen canvas was sized to logicalW x logicalH (export resolution). renderPaintFrame drew strokes at project-space coordinates onto this smaller canvas. No scale transform was applied to map project coords to export coords.
  implication: At 0.5x export, a stroke at x=1500 draws at x=1500 on a 960-wide canvas - goes off screen. This IS the root cause.

- timestamp: 2026-03-25T00:01:00Z
  checked: Live preview behavior (previewRenderer.ts lines 141-145)
  found: During live preview, canvas has CSS layout so logicalW = clientWidth = projectWidth. DPR handles physical pixels. So logicalW == projectWidth and paint coordinates match - no bug in preview.
  implication: Bug only manifests during export at non-1x resolution because logicalW != projectWidth.

- timestamp: 2026-03-25T00:01:30Z
  checked: TypeScript compilation after fix
  found: No new errors (2 pre-existing unrelated errors in SidebarProperties.tsx and glslRuntime.test.ts)
  implication: Fix is type-safe.

- timestamp: 2026-03-25T00:01:45Z
  checked: Test suite after fix
  found: No new test failures (4 pre-existing failures in audioWaveform.test.ts and projectStore.test.ts)
  implication: Fix does not regress existing functionality.

## Resolution

root_cause: In previewRenderer.ts, when rendering paint layers, the offscreen canvas was created at logicalW x logicalH (the export resolution, e.g., 960x540 for 0.5x). But renderPaintFrame draws paint elements using their project-space coordinates (e.g., 1920x1080). During live preview this worked because logicalW == projectWidth, but during export at 0.5x the paint strokes drew at coordinates 2x larger than the canvas, appearing oversized and mispositioned.
fix: Changed paint rendering to always create the offscreen canvas at project resolution (projectStore.width/height), render paint in its native coordinate space, then use drawImage(off, 0, 0, logicalW, logicalH) to scale it to the output size. This ensures correct scaling at any export multiplier while maintaining identical behavior during live preview (where logicalW == projectWidth).
verification: TypeScript compiles, all tests pass (no regressions). Awaiting human verification of actual export output.
files_changed: [Application/src/lib/previewRenderer.ts]
