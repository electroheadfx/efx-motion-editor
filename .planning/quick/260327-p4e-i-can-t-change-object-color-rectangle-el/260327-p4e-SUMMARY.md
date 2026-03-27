# Quick Task 260327-p4e: Shape Color/Width Editing and Convert to Brush

## Summary

Fixed color change and stroke width change for shape tools (rect, ellipse, line) in SELECTION mode, and added Convert to Brush functionality for shapes.

## Truths Verified

- [x] User can select a rectangle, ellipse, or line and change its color via the color picker in SELECTION mode
- [x] User can select a rectangle, ellipse, or line and change its stroke width
- [x] User can select a rectangle, ellipse, or line and convert it to a brush stroke

## Key Changes

**File:** `Application/src/components/sidebar/PaintProperties.tsx`

### Color picker for shapes (SELECTION mode)
- Updated the color reading loop (line 246) to include `el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse'` alongside `'brush'`
- Updated the `onLiveChange` callback (line 1060) to apply color to shapes the same way it applies to brush strokes

### Stroke width for shapes (SELECTION mode)
- Updated the `applyWidth` function (lines 261-265) to check shapes for `strokeWidth` property instead of skipping them with `el.tool !== 'brush'`
- For shapes, updates `(el as any).strokeWidth = newSize`

### Convert to Brush button
- Added `shapeToBrushStrokes` helper function (lines 16-68) that converts:
  - `line`: 2-point stroke along the line path
  - `rect`: 4 separate strokes tracing top/right/bottom/left edges
  - `ellipse`: 36-point sampled stroke around the ellipse
- Added "Convert to Brush" button in SELECTION mode (line 362), visible only when shapes are selected
- On click: removes original shapes, adds new brush strokes, selects them, invalidates FX cache, and bumps paintVersion

## Deviations from Plan

None - all tasks executed as specified.

## Commit

| Hash | Message |
| ---- | ------- |
| 471a4b8 | feat(quick): add shape color/width editing and Convert to Brush |

## Self-Check: PASSED

- [x] Commit 471a4b8 exists
- [x] PaintProperties.tsx modified with all three features
- [x] Color reading includes shapes (line 246)
- [x] Color picker onLiveChange includes shapes (line 1060)
- [x] Width slider applies strokeWidth to shapes (lines 261-265)
- [x] Convert to Brush button exists (line 407)
- [x] shapeToBrushStrokes function defined (lines 16-68)
