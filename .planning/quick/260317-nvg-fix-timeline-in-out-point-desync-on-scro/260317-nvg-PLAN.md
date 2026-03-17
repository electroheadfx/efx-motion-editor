---
phase: quick
plan: 260317-nvg
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/timeline/TimelineRenderer.ts
autonomous: false
requirements: [BUG-FIX]
must_haves:
  truths:
    - "FX track in/out edge handles stay visually aligned with their range bar after horizontal scroll"
    - "FX range bar body correctly clips when partially scrolled behind the track header"
    - "FX range bar body, edge handles, and border all remain synchronized at every scroll position"
  artifacts:
    - path: "Application/src/components/timeline/TimelineRenderer.ts"
      provides: "Fixed drawFxTrack clipping logic"
  key_links:
    - from: "drawFxTrack clippedW calculation"
      to: "barX + barW visual boundary"
      via: "clipped right edge computed from raw bar coordinates"
      pattern: "clippedRight.*barX.*barW"
---

<objective>
Fix FX track in/out point marker desync on horizontal scroll in the timeline canvas.

Purpose: When scrolling horizontally, FX range bar edge handles (in/out point markers) become visually misaligned with their bar body because the bar body's clipped width calculation does not account for the left-side clipping offset. The bar body extends too far right when partially scrolled behind the track header, while edge handles remain at correct positions.

Output: Corrected clipping logic in `drawFxTrack` so bar body, border stroke, and edge handles all stay synchronized at every scroll position.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/timeline/TimelineRenderer.ts (lines 398-432 — drawFxTrack range bar drawing)
@Application/src/components/timeline/TimelineCanvas.tsx (signal subscriptions, draw call)

<interfaces>
From Application/src/components/timeline/TimelineRenderer.ts:
```typescript
export const BASE_FRAME_WIDTH = 60;
export const TRACK_HEADER_WIDTH = 80;
export const FX_TRACK_HEIGHT = 28;

// drawFxTrack receives:
//   fxTrack: FxTrackLayout { inFrame, outFrame, color, visible, ... }
//   y: number (track vertical position)
//   frameWidth: number (BASE_FRAME_WIDTH * zoom)
//   scrollX: number (horizontal scroll offset)
//   canvasWidth: number (display width)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix FX range bar clippedW calculation in drawFxTrack</name>
  <files>Application/src/components/timeline/TimelineRenderer.ts</files>
  <action>
In `drawFxTrack`, the range bar clipping logic at ~line 405-432 has a bug in the `clippedW` calculation.

**Current (buggy) code:**
```typescript
const clippedLeft = Math.max(barX, TRACK_HEADER_WIDTH);
const clippedW = Math.min(barW, canvasWidth - clippedLeft);
```

When `barX < TRACK_HEADER_WIDTH` (bar partially scrolled behind header), `clippedLeft` jumps to `TRACK_HEADER_WIDTH` but `clippedW` still uses the full `barW`. This makes the bar body extend too far to the right (`clippedLeft + barW` overshoots `barX + barW`), desynchronizing it from the edge handles which use the correct `barX` and `barX + barW` positions.

**Fix:** Compute the clipped right edge from the RAW bar coordinates, then derive width:
```typescript
const clippedLeft = Math.max(barX, TRACK_HEADER_WIDTH);
const clippedRight = Math.min(barX + barW, canvasWidth);
const clippedW = Math.max(0, clippedRight - clippedLeft);
```

This ensures the bar body's right edge always matches `barX + barW` (clamped to canvas), staying aligned with the right edge handle. The `Math.max(0, ...)` prevents negative width if the bar is fully outside view.

Apply this fix to the `clippedW` calculation. The `roundRect` fill and `stroke` calls that follow already use `clippedLeft` and `clippedW`, so they will automatically use the corrected values.

Do NOT change the edge handle drawing code (lines ~420-431) — those already use the correct raw `barX` and `rightEdge` positions.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit --pretty 2>&1 | head -20</automated>
  </verify>
  <done>
    - The `clippedW` calculation derives from `barX + barW` (true right edge) minus `clippedLeft`, not from raw `barW`
    - TypeScript compiles without errors
    - FX range bar body right edge matches the right edge handle position at all scroll offsets
    - When FX bar is partially scrolled behind the track header, the visible bar body correctly terminates at `barX + barW` (not `clippedLeft + barW`)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify in/out point markers stay aligned during scroll</name>
  <files>Application/src/components/timeline/TimelineRenderer.ts</files>
  <action>Human verifies the visual fix in the running application.</action>
  <what-built>Fixed FX range bar clipping so in/out edge handles stay aligned with the bar body during horizontal scroll</what-built>
  <how-to-verify>
    1. Open the app and load a project with FX layers (or add an FX layer like Film Grain or Blur)
    2. Look at the timeline — FX tracks should show colored range bars with small colored edge handles at left and right ends
    3. Scroll horizontally on the timeline (trackpad swipe or shift+scroll)
    4. Verify: The edge handles (in/out point markers) stay perfectly aligned with the ends of the range bar at every scroll position
    5. Scroll until the FX bar is partially behind the track header (left side) — the visible bar portion should correctly terminate at the bar's true right edge, not extend further
    6. Zoom in/out and repeat scrolling — edge handles should remain aligned at all zoom levels
  </how-to-verify>
  <verify>Human visual confirmation</verify>
  <done>User confirms in/out point markers remain synchronized with FX range bars during horizontal scroll</done>
  <resume-signal>Type "approved" or describe any remaining desync issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- FX range bar body and edge handles remain visually synchronized during horizontal scroll
- No regression in FX bar drag (move/resize-left/resize-right) behavior
- No regression in content track rendering during scroll
</verification>

<success_criteria>
FX track in/out edge handles remain perfectly aligned with their range bar body at all horizontal scroll positions and zoom levels. The visual desync between markers and bars no longer occurs.
</success_criteria>

<output>
After completion, create `.planning/quick/260317-nvg-fix-timeline-in-out-point-desync-on-scro/260317-nvg-SUMMARY.md`
</output>
