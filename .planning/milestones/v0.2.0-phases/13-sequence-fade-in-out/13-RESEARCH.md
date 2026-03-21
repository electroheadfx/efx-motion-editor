# Phase 13: Sequence Fade In/Out - Research

**Researched:** 2026-03-20 (updated with UI-SPEC integration)
**Domain:** Canvas 2D compositing, timeline transition overlays, signal-driven state management
**Confidence:** HIGH

## Summary

This phase adds a Transition FX system to the EFX Motion Editor with three transition types: Fade In, Fade Out, and Cross Dissolve. The implementation spans five subsystems: (1) a data model for transition objects as optional properties on sequences, (2) Canvas 2D rendering of DaVinci Resolve-style overlay graphics on the timeline with gradient fills, white outline borders, and single diagonal lines, (3) opacity/color compositing in the preview renderer during playback, (4) sidebar property editing via a new TransitionProperties component with selection mutual exclusion against layers, and (5) .mce file format persistence with version bump to v7.

The codebase is well-structured for this addition. The existing `keyframeEngine.ts` provides `applyEasing()` and `lerp()` functions that directly serve fade interpolation. The `PreviewRenderer` already applies `globalAlpha` per layer, so extending it to apply a sequence-level opacity envelope is straightforward. The `TimelineRenderer` uses Canvas 2D drawing with a clear pattern (`drawFxTrack`, `drawLinearTrack`) that can be extended with a `drawTransitionOverlay()` method. The `TimelineInteraction` has established hit-testing patterns (FX track selection, name label click, keyframe diamond hit) that guide transition selection. The sidebar routing in `LeftPanel.tsx` conditionally renders `SidebarProperties` vs `SidebarFxProperties` based on selected layer type -- extending this to render `TransitionProperties` when `selectedTransition` is set follows the same pattern.

**Primary recommendation:** Model transitions as optional properties on the `Sequence` type (not a separate store). Render them as Canvas 2D overlays on the timeline using `createLinearGradient` for the graduated transparency effect. Apply fade opacity in `Preview.tsx`'s `renderFromFrameMap()` by wrapping the content sequence render call with a computed `globalAlpha` multiplier. Add transitions via sidebar buttons in a "TRANSITIONS" CollapsibleSection within the PROPERTIES panel.

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
| FADE-02 | Fade supports two modes: opacity fade (transparent PNG+alpha) and solid color fade (configurable color, default black) | `globalAlpha` multiplier for opacity mode; `ctx.fillRect` with solid color overlay for solid mode in Preview.tsx |
| FADE-03 | Fade is visible in real-time preview playback and correctly rendered in PNG export | Apply fade opacity in `Preview.tsx renderFromFrameMap()` before `renderer.renderFrame()` call; pure function design ensures same logic works for future export pipeline |
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
| CollapsibleSection | Project sidebar | Collapsible section wrapper | "TRANSITIONS" section in PROPERTIES panel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequence-level transitions | Separate transitionStore | Separate store adds complexity; transitions are tightly coupled to sequences and benefit from structuredClone undo/redo |
| Canvas 2D gradients for timeline | SVG overlay | SVG would require a separate DOM layer; Canvas 2D is already used for everything in the timeline |
| Sidebar buttons for adding | Context menu on timeline | Context menu system doesn't exist; sidebar buttons follow established pattern for FX layer creation |

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  types/
    sequence.ts          # Extended: Transition interface + fadeIn/fadeOut/crossDissolve on Sequence
    project.ts           # Extended: MceTransition for .mce serialization
  lib/
    transitionEngine.ts  # NEW: computeFadeOpacity(), computeSolidFadeAlpha()
  stores/
    sequenceStore.ts     # Extended: addTransition(), removeTransition(), updateTransition()
    uiStore.ts           # Extended: selectedTransition signal for transition selection state
  components/
    timeline/
      TimelineRenderer.ts     # Extended: drawTransitionOverlay() method, drawLinearTrack() modified
      TimelineInteraction.ts  # Extended: transitionHitTest(), onPointerDown transition check
    sidebar/
      TransitionProperties.tsx # NEW: sidebar panel when transition is selected
    layout/
      LeftPanel.tsx            # Extended: conditionally render TransitionProperties
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
import { applyEasing } from './keyframeEngine';
import type { Transition } from '../types/sequence';

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
**What:** Draw transition overlays ON TOP of existing sequence thumbnails using Canvas 2D `createLinearGradient` for graduated transparency and `moveTo/lineTo` for diagonal lines. Uses 4px inset from track edges per UI-SPEC.
**When to use:** In `TimelineRenderer.drawLinearTrack()` after drawing sequence thumbnails and key photo separators, before sequence boundary markers and name overlay.
**Example:**
```typescript
// In TimelineRenderer -- called within drawLinearTrack() clip context
private drawTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,         // transition start X in canvas coords
  w: number,         // transition width in pixels
  trackY: number,    // track top Y
  trackH: number,    // track height (TRACK_HEIGHT)
  type: 'fade-in' | 'fade-out' | 'cross-dissolve',
  isSelected: boolean,
): void {
  ctx.save();

  const inset = 4;  // 4px inset from track edges per UI-SPEC spacing grid
  const overlayY = trackY + inset;
  const overlayH = trackH - inset * 2;

  // Graduated transparency fill (dark-to-clear or clear-to-dark)
  const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
  if (type === 'fade-in') {
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
  } else if (type === 'fade-out') {
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  }
  // Cross dissolve uses triangular zones (see Pattern 7)
  ctx.fillStyle = gradient;
  ctx.fillRect(x, overlayY, w, overlayH);

  // Selected highlight fill
  if (isSelected) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, overlayY, w, overlayH);
  }

  // White outline border
  ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, overlayY, w, overlayH);

  // Single diagonal line
  ctx.beginPath();
  if (type === 'fade-in') {
    ctx.moveTo(x, trackY + trackH - inset);      // bottom-left
    ctx.lineTo(x + w, trackY + inset);             // top-right
  } else if (type === 'fade-out') {
    ctx.moveTo(x, trackY + inset);                 // top-left
    ctx.lineTo(x + w, trackY + trackH - inset);    // bottom-right
  } else {
    ctx.moveTo(x, trackY + trackH - inset);      // bottom-left
    ctx.lineTo(x + w, trackY + inset);             // top-right
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label text (only when overlay is wide enough)
  const label = type === 'fade-in' ? 'In' : type === 'fade-out' ? 'Out' : 'Cross Dissolve';
  ctx.font = '8px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.textAlign = 'center';
  if (w > ctx.measureText(label).width + 8) {
    ctx.fillText(label, x + w / 2, trackY + trackH / 2);
  }
  ctx.textAlign = 'start'; // Reset

  ctx.restore();
}
```

### Pattern 4: Preview Compositing with Fade Opacity
**What:** In `Preview.tsx renderFromFrameMap()`, compute the fade opacity for the current frame and apply it as a `globalAlpha` wrapper around the content sequence render. For solid color mode, render a filled rectangle after the content. Both the reactive render effect and the rAF playback tick call the same `renderFromFrameMap()` function, so the fade logic is applied universally.
**When to use:** Both in the reactive render effect and in the rAF playback tick.
**Example:**
```typescript
// In Preview.tsx renderFromFrameMap() -- after computing localFrame
import { computeFadeOpacity, computeSolidFadeAlpha } from '../lib/transitionEngine';

const totalSeqFrames = seqFrames.length;
const fadeOpacity = computeFadeOpacity(localFrame, totalSeqFrames, seq.fadeIn, seq.fadeOut);

// Determine which fade is active to get mode/color
const activeFadeIn = seq.fadeIn && localFrame < seq.fadeIn.duration ? seq.fadeIn : undefined;
const activeFadeOut = seq.fadeOut && localFrame >= totalSeqFrames - seq.fadeOut.duration ? seq.fadeOut : undefined;
const isSolidMode = activeFadeIn?.mode === 'solid' || activeFadeOut?.mode === 'solid';

if (isSolidMode) {
  // Solid mode: render content at full opacity, then overlay solid color
  renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);
  // After content render, overlay solid color
  const solidAlpha = 1.0 - fadeOpacity;
  if (solidAlpha > 0) {
    const color = activeFadeIn?.color ?? activeFadeOut?.color ?? '#000000';
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // physical pixel coords
    ctx.globalAlpha = solidAlpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
} else if (fadeOpacity < 1.0) {
  // Transparency mode: render content with reduced globalAlpha
  // Need to render to offscreen first, then composite with alpha
  // OR set globalAlpha on the canvas context before renderFrame
  renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);
  // For transparency mode to work correctly with alpha export,
  // the content render must be pre-multiplied by fadeOpacity.
  // The simplest approach: use an offscreen canvas, render at full opacity,
  // then composite onto main canvas with globalAlpha = fadeOpacity.
}
```

**Important nuance for transparency mode:** Simply setting `ctx.globalAlpha` before `renderFrame()` won't work because `renderFrame()` does its own `ctx.save()/restore()` with DPI scaling. The renderer internally applies per-layer globalAlpha. For transparency mode to work, either:
- (a) Pass a `sequenceOpacity` parameter to `renderFrame()` that multiplies into each layer's `globalAlpha`, OR
- (b) Use an offscreen canvas for the content render, then composite onto the main canvas with `globalAlpha = fadeOpacity`

Option (a) is simpler and more performant. Add an optional `sequenceOpacity?: number` parameter to `renderFrame()`.

### Pattern 5: Selection State for Transitions
**What:** Extend `uiStore` with a `selectedTransition` signal. When a transition is selected, `selectedLayerId` is nulled (mutual exclusion per UI-SPEC). The sidebar in `LeftPanel.tsx` checks `selectedTransition` to decide whether to render `TransitionProperties` instead of layer properties.
**When to use:** On timeline click in transition hit zone.
**Example:**
```typescript
// In uiStore.ts
export type TransitionSelection = {
  sequenceId: string;
  type: 'fade-in' | 'fade-out' | 'cross-dissolve';
} | null;

const selectedTransition = signal<TransitionSelection>(null);

// Extend uiStore object:
selectTransition(sel: TransitionSelection) {
  selectedTransition.value = sel;
  if (sel) {
    selectedLayerId.value = null;  // mutual exclusion
  }
},
```

```typescript
// In LeftPanel.tsx -- PROPERTIES panel rendering
const transitionSel = uiStore.selectedTransition.value;

<CollapsibleSection title="PROPERTIES" ...>
  {transitionSel && (
    <SidebarScrollArea>
      <TransitionProperties selection={transitionSel} />
    </SidebarScrollArea>
  )}
  {!transitionSel && selectedLayer && isFx && (
    <SidebarScrollArea>
      <SidebarFxProperties layer={selectedLayer} fxSequenceId={fxSequenceId} />
    </SidebarScrollArea>
  )}
  {!transitionSel && selectedLayer && !isFx && (
    <SidebarScrollArea>
      <SidebarProperties layer={selectedLayer} isContentOverlay={isContentOverlay} />
    </SidebarScrollArea>
  )}
</CollapsibleSection>
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

```typescript
// In projectStore.ts buildMceProject() -- add to the MceSequence mapping:
...(seq.fadeIn ? {
  fade_in: {
    type: seq.fadeIn.type,
    duration: seq.fadeIn.duration,
    mode: seq.fadeIn.mode,
    color: seq.fadeIn.color,
    curve: seq.fadeIn.curve,
  },
} : {}),
// ... same for fadeOut, crossDissolve

// In projectStore.ts hydrateFromMce() -- add to the Sequence reconstruction:
...(mceSeq.fade_in ? {
  fadeIn: {
    type: mceSeq.fade_in.type as TransitionType,
    duration: mceSeq.fade_in.duration,
    mode: (mceSeq.fade_in.mode ?? 'transparency') as FadeMode,
    color: mceSeq.fade_in.color ?? '#000000',
    curve: (mceSeq.fade_in.curve ?? 'ease-in-out') as EasingType,
  },
} : {}),
```

### Pattern 7: Sidebar Transition Buttons (How User Adds Transitions)
**What:** The PROPERTIES panel in LeftPanel shows a "TRANSITIONS" section when a content sequence is selected. This section has "Add Fade In" / "Add Fade Out" buttons. Cross dissolve button appears only when a next content sequence exists. Per the UI-SPEC, this is the primary way users add transitions.
**When to use:** When `uiStore.selectedSequenceId` points to a content sequence.
**Example:**
```typescript
// In LeftPanel.tsx -- inside PROPERTIES panel, alongside/below TransitionProperties
const selectedSeqId = uiStore.selectedSequenceId.value;
const selectedSeq = selectedSeqId
  ? sequenceStore.sequences.value.find(s => s.id === selectedSeqId)
  : null;
const isContentSeq = selectedSeq?.kind === 'content';

// Show "TRANSITIONS" section when content sequence is selected
{isContentSeq && !transitionSel && (
  <TransitionButtons sequenceId={selectedSeqId} sequence={selectedSeq} />
)}
```

### Pattern 8: DrawState Extension for Transition Data
**What:** The `DrawState` interface in `TimelineRenderer.ts` needs to carry transition data so the renderer can draw overlays. Pass transition info as part of each `TrackLayout`.
**When to use:** When extending `drawLinearTrack()`.
**Example:**
```typescript
// Extend TrackLayout in types/timeline.ts
export interface TrackLayout {
  // ... existing fields ...
  fadeIn?: { duration: number };    // frames
  fadeOut?: { duration: number };   // frames
  crossDissolve?: { duration: number }; // frames
}

// In frameMap.ts trackLayouts computed, populate from sequence data:
fadeIn: seq.fadeIn ? { duration: seq.fadeIn.duration } : undefined,
fadeOut: seq.fadeOut ? { duration: seq.fadeOut.duration } : undefined,
```

### Pattern 9: FX Track Transition Overlays
**What:** D-03 states fade in/out applies to FX layers too. The FX track range bars in `drawFxTrack()` need the same transition overlay rendering. Draw the overlay on top of the FX bar (inside the bar, using `barY`/`barH` coordinates instead of `trackY`/`trackH`).
**When to use:** When an FX sequence has fadeIn or fadeOut set.
**Example:**
```typescript
// In drawFxTrack(), after drawing bar fill/border, before name text:
if (fxTrack.fadeIn) {
  const fadeW = fxTrack.fadeIn.duration * frameWidth;
  this.drawTransitionOverlay(ctx, barX, Math.min(fadeW, barW), barY, barH, 'fade-in', isSelected);
}
```

### Anti-Patterns to Avoid
- **Separate transition entity store:** Don't create a `transitionStore` with its own signal array. Transitions belong to sequences and share undo/redo via `sequenceStore.snapshot()`. A separate store would require coordinating two undo stacks.
- **Modifying `frameMap` for fade in/out:** Don't change the frame map computation for simple fades. Fade opacity is a rendering concern, not a timeline structure concern. The frameMap should remain a pure sequence-to-frame mapping. (Cross dissolve DOES require frameMap changes -- see Open Questions.)
- **Drawing transitions in a separate canvas layer:** Don't add a DOM overlay for transitions. Keep everything in the single Canvas 2D drawing pipeline that `TimelineRenderer` already uses.
- **Computing fade opacity inside PreviewRenderer:** Keep the renderer agnostic to fade. Compute opacity in `Preview.tsx` (the compositor) and pass it via a `sequenceOpacity` parameter or offscreen compositing.
- **Transition properties in a new sidebar panel:** Don't create a 4th panel. Use the existing PROPERTIES panel with conditional rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Easing curves | Custom bezier/cubic math | `applyEasing()` from keyframeEngine.ts | Already tested, used throughout the codebase, supports linear/ease-in/ease-out/ease-in-out |
| Linear interpolation | Custom lerp | `lerp()` from keyframeEngine.ts | One-liner, already imported everywhere |
| Numeric input with scrub | Custom input component | `NumericInput` from shared/ | Has pointer-drag scrub, blur-bypass during drag, coalescing support |
| Undo/redo for transitions | Custom history | `sequenceStore.snapshot()/restore()` with `pushAction()` | Transitions live on Sequence objects; the existing structuredClone undo pattern covers them automatically |
| Color picker | Custom RGB/HSL widget | HTML `<input type="color">` | Native color picker is sufficient for solid color selection; matches existing tint color pattern in SidebarFxProperties |
| Collapsible sections | Custom toggle | `CollapsibleSection` from sidebar/ | Already used for SEQUENCES, LAYERS, PROPERTIES panels |
| Section labels | Custom header | `SectionLabel` from shared/ | 11px/600 weight convention throughout sidebar |

**Key insight:** The transition system is primarily a rendering overlay (timeline + preview) with minimal new state. By modeling transitions as Sequence properties, all existing infrastructure (undo/redo, save/load, signal reactivity) works with zero additional plumbing.

## Common Pitfalls

### Pitfall 1: Fade Opacity Applied at Wrong Compositing Level
**What goes wrong:** Applying `globalAlpha` inside `PreviewRenderer.renderFrame()` would affect only individual layers, not the entire composited sequence output. FX overlay sequences would also be faded.
**Why it happens:** The render pipeline has multiple passes: content sequence, then FX overlays. Fade should only affect the content pass.
**How to avoid:** Apply fade opacity in `Preview.tsx` around the `renderer.renderFrame()` call for the content sequence, BEFORE the FX overlay loop. FX sequences should NOT be affected by the content sequence's fade. Either add a `sequenceOpacity` parameter to `renderFrame()` or use offscreen canvas compositing.
**Warning signs:** FX layers (grain, color grade) visually fading in/out when they shouldn't.

### Pitfall 2: Cross Dissolve Changing Total Frame Count
**What goes wrong:** If the cross dissolve overlap isn't properly subtracted from `frameMap`, the total frame count changes unexpectedly, breaking playback boundaries.
**Why it happens:** Cross dissolve (D-14) shortens the timeline by the overlap amount. This requires modifying `frameMap` computation, which is a computed signal used everywhere.
**How to avoid:** Implement fade in/out first (no frameMap changes needed), then cross dissolve in a separate plan. Cross dissolve requires careful changes to `frameMap.ts` to handle the overlap zone where two sequences contribute frames simultaneously.
**Warning signs:** Total frame count changing when adding/removing cross dissolve; playhead jumping to wrong positions.

### Pitfall 3: Timeline Overlay Not Clipped to Track Header Boundary
**What goes wrong:** Transition overlay gradient bleeds into the track header column (left 80px).
**Why it happens:** The `drawLinearTrack` method already sets up a clip rect at line 397 that excludes the header (`ctx.rect(TRACK_HEADER_WIDTH, trackY, w - TRACK_HEADER_WIDTH, TRACK_HEIGHT)`). Transition drawing MUST happen inside this clip context.
**How to avoid:** Draw transition overlays INSIDE the existing clip context in `drawLinearTrack()`, after thumbnails but before the name overlay. The drawing order per the UI-SPEC is: thumbnails -> transition overlays -> pink boundary markers -> name overlay.
**Warning signs:** White diagonal lines or gradient appearing in the track header area.

### Pitfall 4: Hit Testing Missing scrollX/scrollY Offset
**What goes wrong:** Clicking on a transition selects the wrong thing or nothing at all.
**Why it happens:** Transition hit-testing must account for `scrollX` (horizontal scroll) and `scrollY` (vertical scroll for FX tracks) just like existing FX range bar hit-testing does.
**How to avoid:** Follow the exact same coordinate transformation pattern used in `TimelineInteraction.nameLabelHitTest()` (lines 188-218) and `isInFxArea()` (lines 118-125). Convert clientX/clientY to canvas-local coordinates, subtract header width, add scrollX.
**Warning signs:** Transitions only clickable when scrolled to position 0.

### Pitfall 5: Solid Color Fade Ignoring DPI Scaling
**What goes wrong:** The solid color rectangle doesn't cover the full canvas in Retina/HiDPI mode.
**Why it happens:** `PreviewRenderer` applies DPI scaling via `ctx.scale(dpr, dpr)`. If the solid color overlay is drawn in logical coordinates after the renderer restores the transform, it would only cover a portion.
**How to avoid:** Use `ctx.setTransform(1, 0, 0, 1, 0, 0)` to reset to identity (physical pixel coords) and draw with `canvas.width`/`canvas.height`. This pattern is already used by the adjustment-color-grade layer (lines 416-417) and adjustment-blur layer (lines 441-442) in previewRenderer.ts.
**Warning signs:** Solid black fade only covering top-left quarter of the canvas.

### Pitfall 6: Transition Duration Exceeding Sequence Length
**What goes wrong:** User sets a fade-in duration longer than the sequence, causing negative or undefined opacity values.
**Why it happens:** No validation on duration input.
**How to avoid:** Clamp fade-in duration to `totalFrames / 2` and fade-out duration similarly. When both are set, ensure `fadeIn.duration + fadeOut.duration <= totalFrames`. The `NumericInput` component supports `min`/`max` props. Also clamp in `transitionEngine.ts` defensively.
**Warning signs:** NaN opacity values, visual glitches at sequence boundaries.

### Pitfall 7: Selection Mutual Exclusion Incomplete
**What goes wrong:** Selecting a transition doesn't deselect the layer, causing both TransitionProperties AND SidebarProperties to render simultaneously.
**Why it happens:** `uiStore.selectedLayerId` and `uiStore.selectedTransition` aren't coordinated.
**How to avoid:** When setting `selectedTransition`, always null `selectedLayerId`. When setting `selectedLayerId`, always null `selectedTransition`. When clicking away from both, null both. Follow the pattern established by `clearFxLayerSelection()` in TimelineInteraction.
**Warning signs:** Two property panels rendering simultaneously; Delete key deleting wrong thing.

### Pitfall 8: Transition Hit Test Priority vs Keyframe Diamonds
**What goes wrong:** Clicking on a keyframe diamond inside a transition zone selects the transition instead.
**Why it happens:** Both keyframe diamonds and transition overlays occupy the same screen region.
**How to avoid:** In `onPointerDown()`, check keyframe hit test BEFORE transition hit test, following the established pattern where keyframe diamonds have priority over FX range bar interactions (lines 379-392 and 417-435 in TimelineInteraction.ts).
**Warning signs:** Unable to click keyframe diamonds that overlap with transition overlays.

### Pitfall 9: Name Label Shift Not Accounting for Scroll Position
**What goes wrong:** The sequence name shift for fade-in is calculated with unscrolled coordinates, causing the label to appear at the wrong position when scrolled.
**Why it happens:** `fadeInWidth` is computed from `fadeIn.duration * frameWidth` but the name label position already accounts for scrollX.
**How to avoid:** Compute `fadeInWidth` using the same frame-to-pixel math used for the segment X position. The offset is purely a width value (not position-dependent), so it doesn't need scroll adjustment -- just `fadeIn.duration * frameWidth`.
**Warning signs:** Name label shifting incorrectly when timeline is horizontally scrolled.

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
  if (!this.canvas || !this.renderer) return null;
  if (this.isInRuler(clientY)) return null;
  if (this.isInFxArea(clientY)) return null;

  const rect = this.canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  if (localX < TRACK_HEADER_WIDTH) return null;

  const frameWidth = BASE_FRAME_WIDTH * timelineStore.zoom.peek();
  const scrollX = timelineStore.scrollX.peek();
  const canvasWidth = rect.width;
  const trackY = this.renderer.getContentTrackY();
  const scrollY = this.renderer.getScrollY();
  const localY = clientY - rect.top;

  const tracks = trackLayouts.peek();
  for (const track of tracks) {
    const labelRect = this.renderer.getNameLabelRect(track, frameWidth, scrollX, canvasWidth, trackY - scrollY);
    if (!labelRect) continue;
    if (localX >= labelRect.x && localX <= labelRect.x + labelRect.w &&
        localY >= labelRect.y && localY <= labelRect.y + labelRect.h) {
      return track.sequenceId;
    }
  }
  return null;
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

### Existing: LeftPanel Conditional Property Rendering
```typescript
// Source: Application/src/components/layout/LeftPanel.tsx lines 228-239
<CollapsibleSection title="PROPERTIES" collapsed={uiStore.propertiesSectionCollapsed} onCollapse={handlePropCollapse}>
  {selectedLayer && isFx && (
    <SidebarScrollArea>
      <SidebarFxProperties layer={selectedLayer} fxSequenceId={fxSequenceId} />
    </SidebarScrollArea>
  )}
  {selectedLayer && !isFx && (
    <SidebarScrollArea>
      <SidebarProperties layer={selectedLayer} isContentOverlay={isContentOverlay} />
    </SidebarScrollArea>
  )}
</CollapsibleSection>
```

### Existing: DPI Reset for Canvas Operations
```typescript
// Source: Application/src/lib/previewRenderer.ts lines 416-417
// Used by adjustment layers that need physical pixel access
ctx.save();
ctx.setTransform(1, 0, 0, 1, 0, 0);
// ... operate in physical pixel coords ...
ctx.restore();
```

### Existing: DrawLinearTrack Drawing Order (Before Modification)
```typescript
// Source: Application/src/components/timeline/TimelineRenderer.ts lines 370-536
// Current order:
// 1. Track background fill (line 384)
// 2. Selection highlight per sequence (line 406-411)
// 3. Thumbnail tiles with key photo separators (lines 414-478)
// 4. Sequence boundary pink markers (lines 481-491)
// 5. Isolation overlay (lines 493-507)
// 6. Name overlay at bottom-left (lines 509-535)

// Required new order (per UI-SPEC):
// 1. Track background fill
// 2. Selection highlight per sequence
// 3. Thumbnail tiles with key photo separators
// 4. *** NEW: Transition overlays ***
// 5. Sequence boundary pink markers (visible through transition transparency)
// 6. Isolation overlay
// 7. Name overlay (shifted right when fade-in present)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS opacity transitions | Canvas 2D globalAlpha | Project inception | All compositing is Canvas 2D; no CSS transitions in render pipeline |
| Per-layer animation only | Sequence-level opacity envelope | Phase 13 (this phase) | New concept: opacity applied to entire sequence composite |
| No transition overlays on timeline | DaVinci Resolve-style transparent overlay | Phase 13 (this phase) | Timeline gains visual transition indicators |

**Deprecated/outdated:**
- Nothing relevant deprecated. Canvas 2D `createLinearGradient` and `globalAlpha` are stable APIs with full browser support.

## Open Questions

1. **Cross dissolve overlap mechanics and frameMap impact**
   - What we know: D-12 through D-15 define that cross dissolve creates overlap, shortens timeline, and centers on boundary. The current `frameMap.ts` creates one `FrameEntry` per global frame, with each entry mapping to exactly one `sequenceId`. During a cross dissolve overlap, BOTH sequences need to be rendered simultaneously.
   - What's unclear: The `FrameEntry` type (`{ globalFrame, sequenceId, keyPhotoId, imageId, localFrame }`) cannot represent two simultaneous sequences. The `trackLayouts` computed signal builds sequential non-overlapping ranges. Both would need redesign for cross dissolve.
   - Recommendation: Implement fade in/out first (no frameMap changes needed) in one or more plans. Then tackle cross dissolve in a dedicated plan that modifies `frameMap.ts`. For cross dissolve, keep `frameMap` as-is but add a separate `crossDissolveOverlaps` computed signal that the renderer checks. In `Preview.tsx`, when the current frame is in a cross dissolve zone, render BOTH sequences with their respective opacity ramps and composite them.

2. **PNG export pipeline doesn't exist yet (Phase 17)**
   - What we know: D-18 says fade must work in PNG export. The ROADMAP shows Phase 17 (PNG Export) as a future phase.
   - What's unclear: How will export work when it's implemented?
   - Recommendation: Design the fade opacity computation as pure functions (`transitionEngine.ts`) that take frame position and transition config. This ensures the same logic works regardless of whether it's called from the preview pipeline or a future export pipeline. No export-specific code needed now. The pure function approach already matches project conventions (keyPhotoNav.ts, sequenceNav.ts).

3. **Transition on FX track visual rendering for non-linear modes**
   - What we know: D-03 says fade in/out applies to FX layers too. FX tracks use `drawFxTrack()` with different geometry (barY + 4, barH = FX_TRACK_HEIGHT - 8).
   - What's unclear: Should the FX track overlay use the exact same visual style (gradient + border + diagonal + label) scaled to the smaller FX bar dimensions? At FX_TRACK_HEIGHT=28px, the bar is only 20px tall -- very limited space for a diagonal line + label.
   - Recommendation: Use the same `drawTransitionOverlay()` function but with the FX bar geometry. The label will naturally hide when the overlay is too narrow (width < measureText + 8px check). The diagonal and border still work at 20px height. This keeps the visual language consistent.

4. **Delete key ambiguity when transition is selected**
   - What we know: D-10 says transitions are deletable via Delete key. The existing Delete key handler also handles keyframe deletion (`deleteSelectedKeyframes()`) and pending new sequence cancellation.
   - Recommendation: In the keyboard shortcut handler, check `uiStore.selectedTransition` first. If set, remove the transition. Otherwise fall through to existing Delete key behavior (keyframe deletion, etc.).

## Sources

### Primary (HIGH confidence)
- Application/src/lib/keyframeEngine.ts -- applyEasing(), lerp() API verified by reading source
- Application/src/lib/previewRenderer.ts -- renderFrame() globalAlpha pattern verified by reading source, DPI scaling pattern verified (lines 85-88, 127-128, 416-417)
- Application/src/components/Preview.tsx -- renderFromFrameMap() compositing pipeline verified by reading source, dual render path (reactive + rAF) confirmed
- Application/src/components/timeline/TimelineRenderer.ts -- drawLinearTrack() drawing order verified (lines 370-536), drawFxTrack() bar geometry verified (lines 294-367), DrawState interface verified (lines 55-72)
- Application/src/components/timeline/TimelineInteraction.ts -- nameLabelHitTest() pattern (lines 188-218), keyframe priority over FX drag (lines 379-392), onPointerDown flow (lines 336-475) verified
- Application/src/types/sequence.ts -- Sequence interface verified by reading source (16 lines, no transition fields yet)
- Application/src/types/project.ts -- MceSequence interface at version 6, MceProject shape verified by reading source
- Application/src/stores/sequenceStore.ts -- snapshot/restore undo pattern verified by reading source
- Application/src/stores/projectStore.ts -- buildMceProject() version 6 at line 155, hydrateFromMce() deserialization at lines 168-289 verified
- Application/src/stores/uiStore.ts -- signal structure, selectSequence/selectLayer methods, no selectedTransition signal yet (200 lines) verified
- Application/src/components/layout/LeftPanel.tsx -- sidebar routing, PROPERTIES conditional render at lines 228-239 verified
- Application/src/components/sidebar/CollapsibleSection.tsx -- Signal<boolean> collapsed prop, onCollapse callback pattern verified
- Application/src/lib/frameMap.ts -- frameMap computed, trackLayouts computed, single-entry-per-frame structure verified (lines 7-74)
- Design mockups in .planning/phases/13-sequence-fade-in-out/design/ -- all 4 reference images reviewed
- .planning/phases/13-sequence-fade-in-out/13-UI-SPEC.md -- full UI design contract reviewed, Canvas 2D rendering spec, sidebar layout spec, interaction contract, state contract, copywriting contract

### Secondary (MEDIUM confidence)
- Canvas 2D createLinearGradient API -- standard browser API, well-documented, used for horizontal gradients in this design
- Canvas 2D globalAlpha compositing -- used extensively in existing codebase for per-layer opacity

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase source code and approved UI-SPEC

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries/APIs already in use in the project
- Architecture: HIGH -- all patterns derived from reading existing code and following established conventions
- Pitfalls: HIGH -- identified from analyzing actual rendering pipeline flow, data structures, and interaction handlers

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no external dependencies, all patterns from existing codebase)
