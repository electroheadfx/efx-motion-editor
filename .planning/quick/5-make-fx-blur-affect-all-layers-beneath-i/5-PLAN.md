---
phase: quick-5
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/Preview.tsx
autonomous: true
requirements: [QUICK-5]
must_haves:
  truths:
    - "FX blur layer blurs all layers beneath it in the timeline stack, including other FX layers like Particles"
    - "Reordering the blur FX higher in the stack causes it to affect more layers below"
    - "Non-blur FX layers (particles, grain, etc.) still render correctly when no blur is above them"
  artifacts:
    - path: "Application/src/components/Preview.tsx"
      provides: "Reversed FX sequence compositing order so top-of-timeline renders last"
  key_links:
    - from: "Application/src/components/Preview.tsx"
      to: "Application/src/lib/previewRenderer.ts"
      via: "renderFrame calls with clearCanvas=false for FX sequences"
      pattern: "renderer\\.renderFrame.*false"
---

<objective>
Make the FX blur layer affect all layers beneath it in the timeline stack, not just the content sequence.

Purpose: Currently the FX sequence rendering order in Preview.tsx matches the array order (top-to-bottom in the timeline UI). This means FX sequences at the TOP of the timeline are rendered FIRST onto the canvas. When Blur is above Particles in the timeline, the blur is applied to the canvas before particles are drawn, so particles escape the blur. The fix is to reverse the FX sequence rendering order so that sequences lower in the timeline are composited first, and higher sequences (like Blur) are composited last -- affecting everything below them.

Output: Modified Preview.tsx with corrected FX compositing order.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/Preview.tsx
@Application/src/lib/previewRenderer.ts
@Application/src/types/layer.ts

<interfaces>
From Application/src/lib/previewRenderer.ts:
```typescript
export class PreviewRenderer {
  renderFrame(
    layers: Layer[],
    frame: number,
    frames: FrameEntry[],
    fps: number,
    clearCanvas?: boolean, // default true; false for FX overlay passes
  ): void;
}
```

From Application/src/types/layer.ts:
```typescript
export function isAdjustmentLayer(layer: Layer): boolean; // true for adjustment-* types
// adjustment-blur is an adjustment layer type
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reverse FX sequence compositing order in Preview.tsx</name>
  <files>Application/src/components/Preview.tsx</files>
  <action>
In Preview.tsx there are TWO identical FX compositing loops that need the same fix:

1. The `renderFromFrameMap` function (lines ~43-53) -- used during playback rAF loop
2. The `disposeRender` effect (lines ~98-108) -- used during scrubbing/seeking

In BOTH loops, after collecting the FX sequences to render, reverse the iteration order so that FX sequences at the bottom of the timeline (last in the array) are rendered FIRST, and FX sequences at the top of the timeline (first in the array) are rendered LAST.

The current code iterates `allSeqs` forward:
```typescript
for (const fxSeq of allSeqs) {
  if (fxSeq.kind !== 'fx') continue;
  ...
}
```

Change BOTH loops to collect FX sequences first, then iterate in reverse:
```typescript
// Composite FX sequences: reverse order so top-of-timeline renders last
// (higher FX layers affect/blur everything beneath them)
const fxSeqs = allSeqs.filter(s => s.kind === 'fx' && s.visible !== false);
for (let i = fxSeqs.length - 1; i >= 0; i--) {
  const fxSeq = fxSeqs[i];
  if (fxSeq.inFrame != null && globalFrame < fxSeq.inFrame) continue;
  if (fxSeq.outFrame != null && globalFrame >= fxSeq.outFrame) continue;
  const fxLayers = fxSeq.layers.filter((l) => l.visible);
  if (fxLayers.length > 0) {
    renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false);
  }
}
```

Key points:
- The `s.visible !== false` check replaces the inline `fxSeq.visible === false` continue check
- The `inFrame`/`outFrame` gating remains identical
- The only change is iteration direction: bottom-of-timeline-stack renders first, top renders last
- This ensures adjustment-blur (which modifies existing canvas pixels in-place) processes AFTER the layers it should affect have been drawn

Do NOT modify previewRenderer.ts -- the adjustment-blur code already correctly operates on "all existing canvas pixels." The bug is purely in the compositing ORDER in Preview.tsx.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Both FX compositing loops in Preview.tsx iterate FX sequences in reverse order. TypeScript compiles without errors. When Blur FX is above Particles FX in the timeline, the blur affects the particles because particles render first and blur processes last.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Reversed FX sequence rendering order so blur affects all layers beneath it in the timeline stack</what-built>
  <how-to-verify>
    1. Open the app with a project that has: Sequence 1 (content), Particles (FX), and Blur (FX)
    2. Arrange timeline top-to-bottom: Blur, Particles, Sequence 1
    3. Verify the blur now affects BOTH the particles AND the sequence images (everything looks blurred)
    4. Drag the Blur FX below Particles in the timeline stack
    5. Verify only the sequence is blurred, particles are NOT blurred (they are above the blur now)
    6. Move Blur back to the top -- everything should be blurred again
    7. Test playback to confirm no rendering glitches during animation
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- FX sequences at the top of the timeline visually affect all layers below them
- Blur FX layer blurs particles, grain, and content when positioned above them
- Reordering blur below other FX layers correctly changes what gets blurred
</verification>

<success_criteria>
The adjustment-blur FX layer blurs all composited content beneath its position in the timeline stack, including other FX layers like particles and grain. The compositing order respects the visual timeline hierarchy: higher = renders later = affects more.
</success_criteria>

<output>
After completion, create `.planning/quick/5-make-fx-blur-affect-all-layers-beneath-i/5-SUMMARY.md`
</output>
