# Phase 13: Sequence Fade In/Out - Research

**Researched:** 2026-03-20
**Domain:** Canvas 2D compositing, timeline transition overlays, signal-driven state management
**Confidence:** HIGH

## Summary

This phase adds a Transition FX system to the EFX Motion Editor with three transition types: Fade In, Fade Out, and Cross Dissolve. The implementation spans four subsystems: (1) a data model for transition objects on sequences, (2) Canvas 2D rendering of DaVinci Resolve-style overlay graphics on the timeline, (3) opacity/color compositing in the preview renderer during playback and export, and (4) sidebar property editing when a transition is selected.

The codebase is well-structured for this addition. The existing `keyframeEngine.ts` provides `applyEasing()` and `lerp()` functions that directly serve fade interpolation. The `PreviewRenderer` already applies `globalAlpha` per layer, so extending it to apply a sequence-level opacity envelope is straightforward. The `TimelineRenderer` uses Canvas 2D drawing with a clear pattern (drawFxTrack, drawLinearTrack) that can be extended with a `drawTransitionOverlay()` method. The `TimelineInteraction` has established hit-testing patterns (FX track selection, name label click) that guide transition selection.

**Primary recommendation:** Model transitions as optional properties on the `Sequence` type (not a separate store). Render them as Canvas 2D overlays on the timeline using `createLinearGradient` for the graduated transparency effect. Apply fade opacity in `Preview.tsx`'s `renderFromFrameMap()` by wrapping the content sequence render call with a computed `globalAlpha` multiplier.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Transitions are overlay objects rendered ON sequences/FX bars -- not on a separate track
- **D-02:** Three transition types: Fade In, Fade Out, Cross Dissolve
- **D-03:** Fade In/Out applies to both sequences and FX layers; Cross Dissolve is sequences-only
- **D-04:** Each transition stores: type, duration (frames), mode (transparency/solid), color (when solid), curve (easing)
- **D-05:** Transparent overlay with white outline border + single diagonal line -- content (thumbnails, pink boundary marker) visible underneath
- **D-06:** Fade In: diagonal from bottom-left to top-right, graduated transparency dark-to-clear (left to right)
- **D-07:** Fade Out: diagonal from top-left to bottom-right, graduated transparency clear-to-dark (left to right)
- **D-08:** Cross Dissolve: single diagonal from bottom-left to top-right, two triangular transparency zones
- **D-09:** Pink boundary marker renders BEHIND the cross dissolve overlay but is visible through transparency
- **D-10:** Transition objects are selectable (click) and deletable (Delete key)
- **D-11:** Transition labels: "In" on fade in, "Out" on fade out, "Cross Dissolve" on cross dissolve
- **D-12:** Cross dissolve creates an overlap zone -- Seq 2 slides left to overlap Seq 1 by the dissolve duration
- **D-13:** During overlap: Seq 1 opacity ramps 100%-to-0% while Seq 2 ramps 0%-to-100% with cubic easing
- **D-14:** Total timeline duration SHORTENS by the overlap amount (no extra frames created)
- **D-15:** Cross dissolve is centered on the original sequence boundary (pink marker stays at center)
- **D-16:** Fade supports two modes: opacity fade (for transparent PNG+alpha export) and solid color fade
- **D-17:** Natural cubic interpolation for all transition curves (reuse existing `applyEasing` from keyframeEngine.ts)
- **D-18:** Fade is visible in real-time preview playback and correctly rendered in PNG export
- **D-19:** Sequence names render at bottom-left of the sequence bar (existing behavior)
- **D-20:** When fade in is present at sequence start, name shifts right past the transition object
- **D-21:** Short sequences clip or hide the name when too narrow (natural CSS/canvas overflow)
- **D-22:** Duration -- NumericInput in frames (reuse existing NumericInput component)
- **D-23:** Mode -- Toggle: Transparency / Solid Color (fade in/out only)
- **D-24:** Color -- Color picker, visible only in Solid mode, default black (fade in/out only)
- **D-25:** Curve -- Dropdown: Linear / Ease In / Ease Out / Ease In-Out (reuse existing EasingType)
- **D-26:** Cross dissolve sidebar shows Duration and Curve only (always opacity-based, no mode/color)

### Claude's Discretion
- Transition data structure details (property on Sequence vs standalone store)
- Timeline Canvas 2D rendering implementation for diagonal/gradient
- Hit testing approach for transition click targets
- .mce format version bump strategy for transition persistence
- How user adds a transition (context menu, drag from palette, button)

### Deferred Ideas (OUT OF SCOPE)
- Phase 14 (Cross-Sequence Transitions) may overlap with the cross dissolve implemented here -- reconcile scope during Phase 14 planning
- Drag-to-resize transition duration on timeline -- could be added as enhancement
- Transition presets/favorites -- future phase
- Wipe transitions (directional wipe, iris wipe) -- future transition types
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FADE-01 | User can set fade-in and fade-out duration (in frames) on a sequence | Transition data model on Sequence type + sidebar TransitionProperties component with NumericInput |
| FADE-02 | Fade supports two modes: opacity fade (transparent PNG+alpha) and solid color fade (configurable color, default black) | `globalAlpha` multiplier for opacity mode; `ctx.fillRect` with solid color overlay for solid mode in PreviewRenderer |
| FADE-03 | Fade is visible in real-time preview playback and correctly rendered in PNG export | Apply fade opacity in `Preview.tsx renderFromFrameMap()` before `renderer.renderFrame()` call; same logic applies to future export pipeline |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser native | Timeline transition overlay rendering (gradients, paths, clipping) | Already used by TimelineRenderer for all timeline drawing |
| @preact/signals | 1.3.x (in project) | Reactive state for transition selection and properties | All stores use this pattern |
| Preact | 10.x (in project) | UI components for sidebar transition properties | Existing framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| keyframeEngine.ts | Project lib | `applyEasing()` and `lerp()` for fade interpolation curves | All transition opacity calculations |
| NumericInput | Project shared | Duration input in sidebar | Transition property editing |
| SectionLabel | Project shared | Section headers in sidebar | Transition properties panel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequence-level transitions | Separate transitionStore | Separate store adds complexity; transitions are tightly coupled to sequences and benefit from structuredClone undo/redo |
| Canvas 2D gradients for timeline | SVG overlay | SVG would require a separate DOM layer; Canvas 2D is already used for everything in the timeline |

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  types/
    sequence.ts          # Extended: Transition interface + fadeIn/fadeOut/crossDissolve on Sequence
    project.ts           # Extended: MceTransition for .mce serialization
  lib/
    transitionEngine.ts  # NEW: computeFadeOpacity(), computeCrossDissolveOpacity(), getTransitionAtFrame()
  stores/
    sequenceStore.ts     # Extended: addTransition(), removeTransition(), updateTransition()
    uiStore.ts           # Extended: selectedTransition signal for transition selection state
  components/
    timeline/
      TimelineRenderer.ts     # Extended: drawTransitionOverlay() method
      TimelineInteraction.ts  # Extended: transition hit-testing and selection
    sidebar/
      TransitionProperties.tsx # NEW: sidebar panel when transition is selected
    Preview.tsx                # Extended: apply fade opacity in renderFromFrameMap()
```

### Pattern 1: Transition as Sequence Property
**What:** Transitions are optional properties on the `Sequence` interface, not a separate entity store. Each sequence can have a `fadeIn`, `fadeOut`, and (for content sequences only) a `crossDissolve` that references the next sequence.
**When to use:** Always -- this is the chosen data model.
**Example:**
```typescript
// In types/sequence.ts
export type TransitionType = 'fade-in' | 'fade-out' | 'cross-dissolve';
export type FadeMode = 'transparency' | 'solid';

export interface Transition {
  type: TransitionType;
  duration: number;       // in frames
  mode: FadeMode;         // 'transparency' for alpha, 'solid' for color overlay
  color: string;          // hex color, used when mode === 'solid', default '#000000'
  curve: EasingType;      // reuse existing EasingType from layer.ts
}

export interface Sequence {
  // ... existing fields ...
  fadeIn?: Transition;      // optional fade-in at sequence start
  fadeOut?: Transition;     // optional fade-out at sequence end
  crossDissolve?: Transition; // optional cross dissolve TO the next sequence (content only)
}
```

### Pattern 2: Transition Engine (Pure Functions)
**What:** A pure-function module that computes opacity values from transition config + frame position. No signal reads -- caller passes values in. Mirrors the project pattern from `keyPhotoNav.ts`, `sequenceNav.ts`.
**When to use:** In preview rendering, playback tick, and future export.
**Example:**
```typescript
// In lib/transitionEngine.ts
import { applyEasing, lerp } from './keyframeEngine';
import type { Transition } from '../types/sequence';
import type { EasingType } from '../types/layer';

/**
 * Compute the fade opacity multiplier for a given local frame within a sequence.
 * Returns 1.0 when no fade is active, 0.0-1.0 during fade regions.
 */
export function computeFadeOpacity(
  localFrame: number,
  totalFrames: number,
  fadeIn: Transition | undefined,
  fadeOut: Transition | undefined,
): number {
  let opacity = 1.0;

  // Fade in: frames 0..fadeIn.duration
  if (fadeIn && localFrame < fadeIn.duration) {
    const t = fadeIn.duration > 0 ? localFrame / fadeIn.duration : 1;
    opacity *= applyEasing(t, fadeIn.curve);
  }

  // Fade out: last fadeOut.duration frames
  if (fadeOut && localFrame >= totalFrames - fadeOut.duration) {
    const framesFromEnd = totalFrames - 1 - localFrame;
    const t = fadeOut.duration > 0 ? framesFromEnd / fadeOut.duration : 1;
    opacity *= applyEasing(t, fadeOut.curve);
  }

  return opacity;
}

/**
 * Compute solid color overlay alpha for a given frame.
 * Returns 0.0 when fully visible, 1.0 when fully covered by solid color.
 * This is the INVERSE of the fade opacity.
 */
export function computeSolidFadeAlpha(
  localFrame: number,
  totalFrames: number,
  fadeIn: Transition | undefined,
  fadeOut: Transition | undefined,
): number {
  return 1.0 - computeFadeOpacity(localFrame, totalFrames, fadeIn, fadeOut);
}
```

### Pattern 3: Timeline Overlay Drawing (Canvas 2D)
**What:** Draw transition overlays ON TOP of existing sequence thumbnails using Canvas 2D `createLinearGradient` for graduated transparency and `moveTo/lineTo` for diagonal lines. Follow existing `drawFxTrack` pattern.
**When to use:** In `TimelineRenderer.drawLinearTrack()` after drawing sequence thumbnails.
**Example:**
```typescript
// In TimelineRenderer -- after drawing thumbnails but before name overlay
private drawTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,         // transition start X in canvas coords
  w: number,         // transition width in pixels
  trackY: number,    // track top Y
  trackH: number,    // track height
  type: 'fade-in' | 'fade-out' | 'cross-dissolve',
  isSelected: boolean,
): void {
  ctx.save();

  // Graduated transparency fill (dark-to-clear or clear-to-dark)
  const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
  if (type === 'fade-in') {
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
  } else if (type === 'fade-out') {
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(x, trackY, w, trackH);

  // White outline border
  ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, trackY + 2, w, trackH - 4);

  // Single diagonal line
  ctx.beginPath();
  if (type === 'fade-in') {
    // Bottom-left to top-right
    ctx.moveTo(x, trackY + trackH - 2);
    ctx.lineTo(x + w, trackY + 2);
  } else if (type === 'fade-out') {
    // Top-left to bottom-right
    ctx.moveTo(x, trackY + 2);
    ctx.lineTo(x + w, trackY + trackH - 2);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label text
  const label = type === 'fade-in' ? 'In' : type === 'fade-out' ? 'Out' : 'Cross Dissolve';
  ctx.font = '8px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.textAlign = 'center';
  if (w > ctx.measureText(label).width + 8) {
    ctx.fillText(label, x + w / 2, trackY + trackH / 2);
  }

  ctx.restore();
}
```

### Pattern 4: Preview Compositing with Fade Opacity
**What:** In `Preview.tsx renderFromFrameMap()`, compute the fade opacity for the current frame and apply it as a `globalAlpha` wrapper around the content sequence render. For solid color mode, render a filled rectangle after the content.
**When to use:** Both in the reactive render effect and in the rAF playback tick.
**Example:**
```typescript
// In Preview.tsx renderFromFrameMap() -- after computing localFrame, before renderer.renderFrame()
import { computeFadeOpacity, computeSolidFadeAlpha } from '../lib/transitionEngine';

const totalSeqFrames = seqFrames.length;
const fadeOpacity = computeFadeOpacity(localFrame, totalSeqFrames, seq.fadeIn, seq.fadeOut);

// For opacity mode: wrap the render call
if (fadeOpacity < 1.0 && (!seq.fadeIn?.mode || seq.fadeIn.mode === 'transparency') &&
    (!seq.fadeOut?.mode || seq.fadeOut.mode === 'transparency')) {
  // Apply opacity to the whole content render
  const canvas = canvasRef.current!;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.globalAlpha = fadeOpacity;
  renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);
  ctx.restore();
} else {
  renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);
}

// For solid color mode: overlay a colored rectangle
const solidAlpha = computeSolidFadeAlpha(localFrame, totalSeqFrames, seq.fadeIn, seq.fadeOut);
if (solidAlpha > 0) {
  const color = seq.fadeIn?.color ?? seq.fadeOut?.color ?? '#000000';
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.globalAlpha = solidAlpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}
```

### Pattern 5: Selection State for Transitions
**What:** Extend `uiStore` with a `selectedTransitionId` signal that tracks which transition is currently selected. The "id" is a composite key like `${sequenceId}:fadeIn` or `${sequenceId}:crossDissolve`. When a transition is selected, the sidebar shows `TransitionProperties` instead of layer properties.
**When to use:** On timeline click in transition hit zone.
**Example:**
```typescript
// In uiStore.ts
export type TransitionSelection = {
  sequenceId: string;
  type: 'fade-in' | 'fade-out' | 'cross-dissolve';
} | null;

const selectedTransition = signal<TransitionSelection>(null);
```

### Pattern 6: .mce Version Bump (v6 -> v7)
**What:** Add optional `fade_in`, `fade_out`, `cross_dissolve` fields to `MceSequence`. Bump version to 7. v6 files load fine (fields are undefined). v7 files with transitions degrade gracefully in older versions (transitions ignored).
**When to use:** In `buildMceProject()` and `hydrateFromMce()`.
**Example:**
```typescript
// In types/project.ts
export interface MceTransition {
  type: string;        // 'fade-in' | 'fade-out' | 'cross-dissolve'
  duration: number;
  mode: string;        // 'transparency' | 'solid'
  color: string;
  curve: string;       // EasingType
}

export interface MceSequence {
  // ... existing fields ...
  fade_in?: MceTransition;
  fade_out?: MceTransition;
  cross_dissolve?: MceTransition;
}
```

### Anti-Patterns to Avoid
- **Separate transition entity store:** Don't create a `transitionStore` with its own signal array. Transitions belong to sequences and share undo/redo via `sequenceStore.snapshot()`. A separate store would require coordinating two undo stacks.
- **Modifying `frameMap` for fade overlay:** Don't change the frame map computation. Fade opacity is a rendering concern, not a timeline structure concern. The frameMap should remain a pure sequence-to-frame mapping.
- **Drawing transitions in a separate canvas layer:** Don't add a DOM overlay for transitions. Keep everything in the single Canvas 2D drawing pipeline that `TimelineRenderer` already uses.
- **Computing fade opacity inside PreviewRenderer:** Keep the renderer agnostic to fade. Compute opacity in `Preview.tsx` (the compositor) and pass it via `globalAlpha` context state before calling `renderFrame()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Easing curves | Custom bezier/cubic math | `applyEasing()` from keyframeEngine.ts | Already tested, used throughout the codebase, supports linear/ease-in/ease-out/ease-in-out |
| Linear interpolation | Custom lerp | `lerp()` from keyframeEngine.ts | One-liner, already imported everywhere |
| Numeric input with scrub | Custom input component | `NumericInput` from shared/ | Has pointer-drag scrub, blur-bypass during drag, coalescing support |
| Undo/redo for transitions | Custom history | `sequenceStore.snapshot()/restore()` with `pushAction()` | Transitions live on Sequence objects; the existing structuredClone undo pattern covers them automatically |
| Color picker | Custom RGB/HSL widget | HTML `<input type="color">` | Native color picker is sufficient for solid color selection; matches DaVinci simplicity |

**Key insight:** The transition system is primarily a rendering overlay (timeline + preview) with minimal new state. By modeling transitions as Sequence properties, all existing infrastructure (undo/redo, save/load, signal reactivity) works with zero additional plumbing.

## Common Pitfalls

### Pitfall 1: Fade Opacity Applied at Wrong Compositing Level
**What goes wrong:** Applying `globalAlpha` inside `PreviewRenderer.renderFrame()` would affect only individual layers, not the entire composited sequence output. FX overlay sequences would also be faded.
**Why it happens:** The render pipeline has multiple passes: content sequence, then FX overlays. Fade should only affect the content pass.
**How to avoid:** Apply `globalAlpha` in `Preview.tsx` around the `renderer.renderFrame()` call for the content sequence, BEFORE the FX overlay loop. FX sequences should NOT be affected by the content sequence's fade.
**Warning signs:** FX layers (grain, color grade) visually fading in/out when they shouldn't.

### Pitfall 2: Cross Dissolve Changing Total Frame Count
**What goes wrong:** If the cross dissolve overlap isn't properly subtracted from `frameMap`, the total frame count changes unexpectedly, breaking playback boundaries.
**Why it happens:** Cross dissolve (D-14) shortens the timeline by the overlap amount. This requires modifying `frameMap` computation, which is a computed signal used everywhere.
**How to avoid:** Cross dissolve is the most complex feature. Consider implementing fade in/out first (no frameMap changes needed), then cross dissolve in a separate plan. Cross dissolve requires careful changes to `frameMap.ts` to handle the overlap zone where two sequences contribute frames simultaneously.
**Warning signs:** Total frame count changing when adding/removing cross dissolve; playhead jumping to wrong positions.

### Pitfall 3: Timeline Overlay Not Clipped to Track Header Boundary
**What goes wrong:** Transition overlay gradient bleeds into the track header column (left 80px).
**Why it happens:** The `drawLinearTrack` method already sets up a clip rect that excludes the header. But if transition drawing happens outside this clip scope, it won't be clipped.
**How to avoid:** Draw transition overlays INSIDE the existing clip context in `drawLinearTrack()`, after thumbnails but before the name overlay.
**Warning signs:** White diagonal lines or gradient appearing in the track header area.

### Pitfall 4: Hit Testing Missing scrollX/scrollY Offset
**What goes wrong:** Clicking on a transition selects the wrong thing or nothing at all.
**Why it happens:** Transition hit-testing must account for `scrollX` (horizontal scroll) and `scrollY` (vertical scroll for FX tracks) just like existing FX range bar hit-testing does.
**How to avoid:** Follow the exact same coordinate transformation pattern used in `TimelineInteraction.nameLabelHitTest()` and `isInFxArea()`. Convert clientX/clientY to canvas-local coordinates, subtract header width, add scrollX.
**Warning signs:** Transitions only clickable when scrolled to position 0.

### Pitfall 5: Solid Color Fade Ignoring DPI Scaling
**What goes wrong:** The solid color rectangle doesn't cover the full canvas in Retina/HiDPI mode.
**Why it happens:** `PreviewRenderer` applies DPI scaling via `ctx.scale(dpr, dpr)`. If the solid color overlay is drawn in physical pixel coordinates instead of logical coordinates, it only covers a fraction of the canvas.
**How to avoid:** Draw the solid color overlay in `Preview.tsx` AFTER the renderer's `ctx.restore()` (which resets DPI scaling), using `canvas.width`/`canvas.height` (physical pixels). Or draw it within the renderer's DPI-scaled context using `logicalW`/`logicalH`.
**Warning signs:** Solid black fade only covering top-left quarter of the canvas.

### Pitfall 6: Transition Duration Exceeding Sequence Length
**What goes wrong:** User sets a fade-in duration longer than the sequence, causing negative or undefined opacity values.
**Why it happens:** No validation on duration input.
**How to avoid:** Clamp fade-in duration to `totalFrames / 2` and fade-out duration similarly. When both are set, ensure `fadeIn.duration + fadeOut.duration <= totalFrames`. The `NumericInput` component supports `min`/`max` props.
**Warning signs:** NaN opacity values, visual glitches at sequence boundaries.

## Code Examples

Verified patterns from the existing codebase:

### Existing: applyEasing for Curve Interpolation
```typescript
// Source: Application/src/lib/keyframeEngine.ts lines 11-33
export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear': return t;
    case 'ease-in': return t * t * t;
    case 'ease-out':
      const inv = 1 - t;
      return 1 - inv * inv * inv;
    case 'ease-in-out':
      if (t < 0.5) return 4 * t * t * t;
      const p = -2 * t + 2;
      return 1 - (p * p * p) / 2;
    default: return t;
  }
}
```

### Existing: PreviewRenderer globalAlpha per Layer
```typescript
// Source: Application/src/lib/previewRenderer.ts lines 618-622
ctx.save();
ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
ctx.globalAlpha = layer.opacity;
// ... draw operations ...
ctx.restore();
```

### Existing: FX Track Range Bar Drawing Pattern
```typescript
// Source: Application/src/components/timeline/TimelineRenderer.ts lines 294-314
const barX = fxTrack.inFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
const barW = (fxTrack.outFrame - fxTrack.inFrame) * frameWidth;
const barY = y + 4;
const barH = FX_TRACK_HEIGHT - 8;

// Bar fill (semi-transparent color)
ctx.fillStyle = resolvedColor + '40';
ctx.beginPath();
ctx.roundRect(clippedLeft, barY, clippedW, barH, 3);
ctx.fill();

// Bar border
ctx.strokeStyle = resolvedColor + '80';
ctx.lineWidth = 1;
ctx.stroke();
```

### Existing: Hit Test Coordinate Transformation
```typescript
// Source: Application/src/components/timeline/TimelineInteraction.ts lines 188-218
private nameLabelHitTest(clientX: number, clientY: number): string | null {
  const rect = this.canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  if (localX < TRACK_HEADER_WIDTH) return null;

  const frameWidth = BASE_FRAME_WIDTH * timelineStore.zoom.peek();
  const scrollX = timelineStore.scrollX.peek();
  // ... compare against computed rects ...
}
```

### Existing: Sequence Store Undo/Redo Pattern
```typescript
// Source: Application/src/stores/sequenceStore.ts
const before = snapshot();           // structuredClone of all sequences
sequences.value = sequences.value.map(s =>
  s.id === id ? { ...s, ...updates } : s,
);
markDirty();
const after = snapshot();
pushAction({ id, description, timestamp, undo: () => restore(before), redo: () => restore(after) });
```

### Existing: Name Overlay Drawing (Shift Pattern for Fade In)
```typescript
// Source: Application/src/components/timeline/TimelineRenderer.ts lines 510-535
// Name overlay at bottom-left of sequence bar
const segX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
const segW = (track.endFrame - track.startFrame) * frameWidth;
const labelH = 16;
const labelY = trackY + TRACK_HEIGHT - 2 - labelH;
const clippedX = Math.max(segX, TRACK_HEADER_WIDTH);
const leftPad = 8;
// When fade-in present: shift leftPad by fadeIn width
// const leftPad = 8 + (fadeInWidth > 0 ? fadeInWidth + 4 : 0);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS opacity transitions | Canvas 2D globalAlpha | Project inception | All compositing is Canvas 2D; no CSS transitions in render pipeline |
| Per-layer animation only | Sequence-level opacity envelope | Phase 13 (this phase) | New concept: opacity applied to entire sequence composite |

**Deprecated/outdated:**
- Nothing relevant deprecated. Canvas 2D `createLinearGradient` and `globalAlpha` are stable APIs with full browser support.

## Open Questions

1. **How does the user ADD a transition?**
   - What we know: Transitions need to be added somehow. No context menu or palette exists on the timeline currently.
   - What's unclear: Should it be a right-click context menu on the sequence, a button in the sidebar when a sequence is selected, or both?
   - Recommendation: Add a "Transitions" section in the sidebar when a content sequence is selected (via `uiStore.selectedSequenceId`). Show "Add Fade In" / "Add Fade Out" buttons. This is the simplest approach that doesn't require building a context menu system. For FX sequences, add the same in the FX properties sidebar. Cross dissolve can be added via a button that appears when two adjacent content sequences exist.

2. **Cross dissolve overlap mechanics and frameMap impact**
   - What we know: D-12 through D-15 define that cross dissolve creates overlap, shortens timeline, and centers on boundary.
   - What's unclear: This requires significant changes to `frameMap.ts` -- the most fundamental data structure in the timeline. During the overlap zone, BOTH sequences contribute frames, which the current single-entry-per-frame `FrameEntry` structure doesn't support.
   - Recommendation: Implement fade in/out first (no frameMap changes). Cross dissolve requires either (a) a separate "overlap" concept in frameMap where entries have two sequence references, or (b) handling cross dissolve purely in the render pipeline by looking at adjacent sequences. Option (b) is safer -- keep frameMap as-is, and in `Preview.tsx` detect when the current frame is in a cross dissolve zone by checking the next sequence's cross dissolve config.

3. **PNG export pipeline doesn't exist yet**
   - What we know: D-18 says fade must work in PNG export. The welcome screen mentions PNG export as a goal, but no export code exists yet.
   - What's unclear: How will export work when it's implemented?
   - Recommendation: Design the fade opacity computation as pure functions (`transitionEngine.ts`) that take frame position and transition config. This ensures the same logic works regardless of whether it's called from the preview pipeline or a future export pipeline. No export-specific code needed now.

## Sources

### Primary (HIGH confidence)
- Application/src/lib/keyframeEngine.ts -- applyEasing(), lerp() API verified by reading source
- Application/src/lib/previewRenderer.ts -- renderFrame() globalAlpha pattern verified by reading source
- Application/src/components/Preview.tsx -- renderFromFrameMap() compositing pipeline verified by reading source
- Application/src/components/timeline/TimelineRenderer.ts -- drawLinearTrack(), drawFxTrack() patterns verified by reading source
- Application/src/components/timeline/TimelineInteraction.ts -- hit testing patterns verified by reading source
- Application/src/types/sequence.ts -- Sequence interface verified by reading source
- Application/src/types/project.ts -- MceSequence, MceProject at version 6 verified by reading source
- Application/src/stores/sequenceStore.ts -- snapshot/restore undo pattern verified by reading source
- Application/src/stores/projectStore.ts -- buildMceProject() and hydrateFromMce() serialization verified by reading source
- Design mockups in .planning/phases/13-sequence-fade-in-out/design/ -- all 4 reference images reviewed

### Secondary (MEDIUM confidence)
- Canvas 2D createLinearGradient API -- standard browser API, well-documented
- Canvas 2D globalAlpha compositing -- used extensively in existing codebase

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries/APIs already in use in the project
- Architecture: HIGH -- all patterns derived from reading existing code and following established conventions
- Pitfalls: HIGH -- identified from analyzing actual rendering pipeline flow and data structures

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no external dependencies, all patterns from existing codebase)
