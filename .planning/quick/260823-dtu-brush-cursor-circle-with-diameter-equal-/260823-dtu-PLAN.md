---
phase: quick-260823-dtu
plan: 260823-dtu
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/canvas/PaintCursor.tsx
autonomous: true
requirements: []

estimate:
  tokens: 8000
  raw_tokens: 8000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - The brush cursor circle's outer edge matches the brush pixel size (clamped to a 4px minimum) and stays centered on the pointer while painting.
    - The circle is legible on both light and dark canvas backgrounds without depending on the CSS blend-mode for contrast.
    - The change is confined to the cursor overlay; PaintOverlay geometry and brush-size plumbing are untouched.
  artifacts:
    - app/src/components/canvas/PaintCursor.tsx
  key_links:
    - PaintCursor reads paintStore.brushSize.value (pixel units) and receives screenX/screenY/visible from PaintOverlay — this contract stays byte-identical.
---

<objective>
Make the paint brush cursor a circle whose diameter equals the brush pixel size, centered on the pointer, and clearly legible on both light and dark canvas backgrounds.

Purpose: The current circle cursor (white 1.5px border + two semi-transparent black box-shadows, composited with the CSS blend-mode) renders illegible — especially on light canvases it reads as a faint crosshair because the blend-mode backdrop compositing and translucent shadows produce low-contrast, muddy outlines. The user accepted the double-outline alternative for guaranteed contrast.

Output: A rewritten cursor style in PaintCursor.tsx using a solid bright inner ring plus a solid dark outer halo, with no blend-mode dependency.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/quick.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/canvas/PaintCursor.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/canvas/PaintOverlay.tsx  (only the circle-cursor call site ~L2367-2410 and cursor visibility ~L582-584, ~L1311-1324)
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/layout/CanvasArea.tsx (transform wrapper ~L414-445)
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/paintStore.ts (brushSize signal, L18/L84)

Relevant facts already established:
- PaintCursor.tsx is the single brush-circle cursor component; it renders a div with borderRadius '50%', width/height = displayDiameter = Math.max(brushSize, 4), centered at (screenX, screenY), pointerEvents 'none', zIndex 50.
- PaintOverlay renders <PaintCursor visible={showCircleCursor && cursorVisible} /> with screenX/screenY from the pointer-move handler (L2405-2410); when visible, the native CSS cursor is 'none' (L2371), so the circle replaces the crosshair.
- brushSize is a paintStore signal holding pixel units (clamped at the store boundary).
- The overlay sits inside a parent with CSS transform scale(zoom) translate(pan); position and diameter are authored in pre-transform space, so brushSize is used directly (the parent transform scales it visually).
- The vitest environment has no DOM/render harness (include pattern `src/**/*.test.ts`, no jsdom/testing-library) — automated verification for this styling-only change is typecheck + the existing suite + grep gates; the visual result is confirmed by the user.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite brush cursor circle with a deterministic double-outline</name>
  <files>app/src/components/canvas/PaintCursor.tsx</files>
  <action>
    In app/src/components/canvas/PaintCursor.tsx, replace the cursor-circle styling so contrast no longer depends on the CSS blend-mode property (the current source-mode blend with semi-transparent black box-shadows produces muddy, low-contrast rings that read as a faint crosshair on light canvases).

    KEEP UNCHANGED (do not touch PaintOverlay.tsx or any store wiring):
    - Position math: left = `${screenX - displayDiameter / 2}px`, top = `${screenY - displayDiameter / 2}px`.
    - Diameter: displayDiameter = Math.max(brushSize, 4) read via paintStore.brushSize.value.
    - borderRadius '50%', pointerEvents 'none', zIndex 50, position 'absolute'.
    - The PaintCursorProps interface (screenX, screenY, zoom, visible) and the early `if (!visible) return null` guard.
    - The comment noting position is in pre-transform space (parent applies CSS scale(zoom)).

    IMPLEMENT the double-outline alternative:
    1. Set `border` to a near-opaque bright inner ring (e.g. `1.5px solid rgba(255, 255, 255, 0.95)`).
    2. Set `boxShadow` to a solid dark outer halo PLUS a solid dark inner hairline (e.g. `0 0 0 1.5px rgba(0, 0, 0, 0.85), inset 0 0 0 1px rgba(0, 0, 0, 0.85)`).
    3. Remove the CSS blend-mode property entirely. The dark outer halo is the visible ring on light canvases, the white inner ring is the visible ring on dark canvases — this is deterministic and independent of mix-blend-mode backdrop compositing, which is the reported legibility failure.

    Verify the final visual layering reads (outside to inside): dark halo 1.5px, white ring 1.5px, dark hairline 1px, transparent interior — the white ring's outer edge equals the border-box edge = brushSize diameter.
  </action>
  <verify>
    <automated>
      pnpm --filter efx-motion-editor exec tsc --noEmit
      pnpm --filter efx-motion-editor exec vitest run
      ! grep -q blend-mode app/src/components/canvas/PaintCursor.tsx
      grep -q 'rgba(255, 255, 255, 0.95)' app/src/components/canvas/PaintCursor.tsx
      grep -q 'rgba(0, 0, 0, 0.85)' app/src/components/canvas/PaintCursor.tsx
    </automated>
    <human-check>
      In the running app with the brush tool active in paint mode, verify on a light (white/near-white) canvas AND on a dark/black canvas that:
      1. The cursor circle is clearly visible on both (dark halo on light backgrounds, white ring on dark backgrounds).
      2. Its outer edge tracks the brush-size slider value.
      3. It stays centered on the pointer while painting (and while not painting).
    </human-check>
  </verify>
  <done>
    PaintCursor.tsx now renders a double-outline circle (solid white inner ring + solid dark outer halo) with no remaining blend-mode dependency; the circle is still centered on the pointer, its diameter equals max(brushSize, 4), and typecheck plus the full vitest suite pass. Visual legibility is confirmed by the user on both light and dark backgrounds.
  </done>
</task>

</tasks>

<success_criteria>
- The brush cursor circle is visually legible on both light and dark canvas backgrounds (dark halo on light, white ring on dark), with no reliance on blend-mode compositing.
- The circle diameter equals the brush pixel size (clamped to 4px minimum) and the circle is centered on the pointer.
- Existing paint/brush behavior is unaffected (geometry, visibility, and brush-size plumbing unchanged); typecheck and the vitest suite pass.
- User confirms the visual result with a native UAT pass on both a light and a dark canvas.
</success_criteria>

<output>
Create `.planning/quick/260823-dtu-brush-cursor-circle-with-diameter-equal-/260823-dtu-SUMMARY.md` when done.
</output>
