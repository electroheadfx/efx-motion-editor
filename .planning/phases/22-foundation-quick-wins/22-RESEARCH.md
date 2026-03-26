# Phase 22: Foundation & Quick Wins - Research

**Researched:** 2026-03-26
**Domain:** Preact UI panel reorganization, Preact signals store bug fixes, SVG motion path rendering
**Confidence:** HIGH

## Summary

Phase 22 addresses four distinct workstreams: (1) reorganizing the PaintProperties panel layout to reduce vertical space, (2) making layer creation aware of sequence isolation, (3) increasing motion path interpolation density for short sequences, and (4) fixing pre-existing bugs in paintStore move/reorder operations that lack `paintVersion++` and undo/redo support.

All four workstreams operate on well-understood existing code. The paint panel reorganization (~930 lines) is purely structural -- moving, removing, and regrouping existing JSX blocks with no new components. The layer isolation scope change requires reading `isolationStore.isolatedSequenceIds` in two AddLayerMenu components and routing layer creation to the correct sequence. The motion path density improvement modifies the pure `sampleMotionDots()` function to use fractional frame steps. The bug fixes follow an established pattern (addElement/removeElement already have correct paintVersion++ and pushAction).

**Primary recommendation:** Tackle bug fixes first (they stabilize the paint store for all subsequent phases), then the three UX improvements in any order since they touch disjoint files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Remove PAINT BACKGROUND title. Background color swatch and "Show Seq BG" checkbox on same row (2-col), with Reset button right-aligned at end of row. Remove description text under the checkbox.
- **D-02:** Rename "Show Sequence overlay" to "Show Seq BG"
- **D-03:** Remove BRUSH STYLE title. Move style buttons (Watercolor, Ink, Charcoal, Pencil, Marker) into the BRUSH section, before size controls
- **D-04:** BRUSH section uses 2-col rows: Size (slider+field) | Color (swatch+hex) on one row; Opacity (slider) | Clear Brushes (red button, white text) on second row
- **D-05:** Replace "Clear Frame" button with "Clear Brushes" inline in the BRUSH section (red bg, white text). Remove separate ACTIONS section
- **D-06:** Remove STROKE title. Thinning/Smoothing/Streamline sliders live under BRUSH section (no section label)
- **D-07:** Bottom section order (top to bottom): BRUSH, TABLET, ONION SKIN. These are the only sections at the bottom of the panel
- **D-08:** SELECT mode: group "Select All Strokes" and "Delete Selected" on one row (2-col). Group Width (slider+field) and Color (swatch+hex) on one row (2-col)
- **D-09:** When a sequence is isolated (soloed), creating any new layer type (static image, image sequence, video, paint/roto) adds it only to that sequence
- **D-10:** Add menu shows "Adding to: [Sequence Name]" indicator when a sequence is isolated, so the user knows the target
- **D-11:** Use sub-frame sampling (fractional frame steps, e.g., 0.25) when total frame span is below a threshold, so short sequences always produce a smooth-looking dotted path
- **D-12:** Fix moveElementsForward, moveElementsBackward, moveElementsToFront, moveElementsToBack in paintStore.ts: add paintVersion++ and pushAction undo/redo support (matching pattern from addElement/removeElement)

### Claude's Discretion
- Sub-frame sampling threshold and step size for motion path density
- Exact 2-col CSS layout approach (grid vs flex) for panel reorganization
- _notifyVisualChange helper API design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UXP-01 | Paint properties panel is reorganized for space optimization with cleaner buttons | D-01 through D-08 define exact layout; current panel structure fully mapped at ~930 lines in PaintProperties.tsx |
| UXP-02 | New roto/paint layer is created only on isolated sequence when one is selected | D-09, D-10; both AddLayerMenu components (sidebar + timeline) identified; isolationStore API documented |
| UXP-03 | Motion path shows denser interpolation dots for short sequences | D-11; sampleMotionDots() pure function identified; interpolateAt() already supports fractional frames |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Find GSD tools from `.claude/get-shit-done` not from `$HOME/.claude/get-shit-done`
- Do not run the server -- user does that on their side
- Use p5.brush for brush FX (not relevant to this phase)
- Always bump paintVersion for any visual paint change (directly relevant to D-12 bug fixes)
- Guard shortcuts in paint mode (not directly relevant)

## Architecture Patterns

### Current PaintProperties.tsx Structure (pre-reorganization)

The file is ~933 lines with this section order:
```
1. Layer name + Exit Paint Mode button
2. Rendering FX indicator
3. Flat preview mode indicator
4. PAINT BACKGROUND (collapsible: bg color swatch + Reset)
5. SELECT mode tools (Select All, Delete, reorder buttons, width/color editors)
6. BRUSH STYLE (style buttons: Watercolor, Ink, etc.)
7. BRUSH FX (param sliders, conditional on non-flat style)
8. BRUSH (Size, Color, Opacity sliders)
9. STROKE (Thinning, Smoothing, Streamline)
10. TABLET (collapsible: Curve, Tilt, Taper In/Out)
11. SHAPE (Filled checkbox, stroke width)
12. FILL (Tolerance slider)
13. Flatten Frame + Copy to Next Frame (select mode only)
14. Sequence overlay checkbox + opacity slider
15. ONION SKIN (collapsible)
16. ACTIONS (Clear Frame button with confirm)
17. Color Picker Modal
```

### Target Structure (per D-01 through D-08)

```
1. Layer name + Exit Paint Mode
2. Rendering FX indicator
3. Flat preview mode indicator
4. Background row: [swatch] [Show Seq BG checkbox] [Reset button] -- NO section header
5. SELECT mode (conditional):
   - Row 1: [Select All Strokes] [Delete Selected] -- 2-col
   - Row 2: [Width slider+field] [Color swatch+hex] -- 2-col
   - Reorder buttons (existing)
   - Flatten Frame / Copy to Next Frame
6. BRUSH section:
   - Style buttons (moved from separate BRUSH STYLE section)
   - BRUSH FX sliders (conditional on non-flat style)
   - Row 1: [Size slider+field] [Color swatch+hex] -- 2-col
   - Row 2: [Opacity slider] [Clear Brushes (red bg, white text)] -- 2-col
   - Thinning/Smoothing/Streamline sliders (moved from STROKE, no section label)
7. SHAPE (unchanged, conditional)
8. FILL (unchanged, conditional)
9. TABLET (collapsible, unchanged)
10. ONION SKIN (collapsible, unchanged)
11. Color Picker Modal
```

**Removed sections:** PAINT BACKGROUND header, BRUSH STYLE header, STROKE header, ACTIONS section
**Removed elements:** Description text under "Show Seq BG" checkbox
**Renamed:** "Show sequence overlay" -> "Show Seq BG"
**Moved:** Style buttons into BRUSH, stroke sliders into BRUSH, Clear Frame -> "Clear Brushes" inline

### Two-Column Layout Pattern (Claude's Discretion)

**Recommendation: CSS Grid (`grid-template-columns: 1fr 1fr`)**

Rationale: The panel needs pairs of controls to share a single row with equal width. CSS Grid with `1fr 1fr` provides exact 50/50 splits without flexbox wrapping concerns. The existing codebase uses Tailwind utility classes mixed with inline styles. Grid is a single `display: grid; grid-template-columns: 1fr 1fr; gap: 8px` declaration.

```tsx
// 2-col row pattern
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
  <div>{/* Left control: Size slider+field */}</div>
  <div>{/* Right control: Color swatch+hex */}</div>
</div>
```

### Layer Creation Flow

There are TWO separate AddLayerMenu components:

1. **Sidebar AddLayerMenu** (`components/layer/AddLayerMenu.tsx`): Handles static image, image sequence, video. Uses `uiStore.setAddLayerIntent()` pattern -- dispatches an intent, then `ImportedView` processes the file selection and creates the layer.

2. **Timeline AddLayerMenu** (`components/timeline/AddFxMenu.tsx`): Handles ALL layer types including paint/roto, generators, adjustments, content overlays, and shader browser. Creates layers directly via `sequenceStore.createFxSequence()` or dispatches intent for content layers.

**Both must be modified for D-09/D-10 (isolation awareness).**

### Isolation Store API

```typescript
// Read isolated sequence IDs
isolationStore.isolatedSequenceIds.value  // Signal<Set<string>>
isolationStore.hasIsolation.value         // computed boolean

// Get sequence names for display
const seqs = sequenceStore.sequences.peek();
const isolated = isolationStore.isolatedSequenceIds.peek();
const isolatedSeq = seqs.find(s => isolated.has(s.id));
// isolatedSeq.name for D-10 "Adding to: [name]" indicator
```

### Layer Addition to Existing Sequence

Currently `createFxSequence()` always creates a NEW fx sequence. For UXP-02, when a sequence is isolated, layers should be added TO that sequence instead:

```typescript
// sequenceStore.addLayer(layer) -- adds to activeSequenceId
// For isolation: set activeSequenceId to the isolated sequence, then use addLayer()
// OR: create a new method addLayerToSequence(sequenceId, layer)
```

**Recommendation:** Add a `addLayerToSequence(sequenceId: string, layer: Layer)` method to `sequenceStore` that does what `addLayer` does but targets a specific sequence ID instead of `activeSequenceId`. This avoids side effects of changing the active sequence.

### _notifyVisualChange Helper (Claude's Discretion)

The bug in D-12 is that moveElements* functions call `_dirtyFrames.add()` and `_markProjectDirty?.()` but are MISSING:
1. `paintVersion.value++` (triggers visual re-render)
2. `pushAction()` (enables undo/redo)

**Recommendation:** Create a `_notifyVisualChange` helper that encapsulates the common post-mutation pattern:

```typescript
function _notifyVisualChange(layerId: string, frame: number): void {
  _dirtyFrames.add(`${layerId}:${frame}`);
  paintVersion.value++;
  _markProjectDirty?.();
}
```

Then each moveElements* function calls `_notifyVisualChange` and adds its own `pushAction()`. The undo/redo requires element array snapshots specific to each operation, so `pushAction` cannot be fully generalized into the helper.

### Motion Path Sub-Frame Sampling (Claude's Discretion)

Current `sampleMotionDots()` steps frame-by-frame (integer increments). For short sequences (e.g., 3 keyframes spanning 5 frames), this produces only ~6 dots, which looks sparse.

**Recommendation:**
- **Threshold:** If `lastFrame - firstFrame < 30`, use sub-frame sampling
- **Step size:** `0.25` frames (4x density) -- yields 4 dots per frame instead of 1
- `interpolateAt()` already handles fractional frame values via its `(frame - prev.frame) / span` calculation, so no engine changes needed
- For the dot's `frame` property (used for current-frame highlighting), round to nearest integer for matching

```typescript
export function sampleMotionDots(
  keyframes: Keyframe[],
  canvasW: number,
  canvasH: number,
): {x: number; y: number; frame: number}[] {
  if (keyframes.length < 2) return [];

  const firstFrame = keyframes[0].frame;
  const lastFrame = keyframes[keyframes.length - 1].frame;
  const span = lastFrame - firstFrame;

  // Sub-frame sampling for short sequences
  const step = span < 30 ? 0.25 : 1;
  const dots: {x: number; y: number; frame: number}[] = [];

  for (let f = firstFrame; f <= lastFrame; f += step) {
    const vals = interpolateAt(keyframes, f);
    if (vals) {
      dots.push({
        x: vals.x + canvasW / 2,
        y: vals.y + canvasH / 2,
        frame: Math.round(f),  // integer frame for hit testing
      });
    }
  }

  return dots;
}
```

### Anti-Patterns to Avoid

- **Mutating signals without .value++:** The core bug being fixed. Every paint data mutation MUST bump `paintVersion.value++` or the canvas will not re-render.
- **Forgetting pushAction for undo:** All user-visible data mutations need undo/redo support.
- **Changing activeSequenceId as side effect:** For layer isolation scoping, do NOT change the active sequence to add a layer. Add a targeted method instead.
- **Creating a new FX sequence when isolated:** UXP-02 specifically says add to the existing isolated sequence, not create a new one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 2-col layout | Custom flex calculations | CSS Grid `grid-template-columns: 1fr 1fr` | Native browser layout, no JS needed |
| Undo/redo | Custom history stack | Existing `pushAction()` from `lib/history` | Already handles undo/redo throughout the app |
| Fractional interpolation | Custom lerp for sub-frame | Existing `interpolateAt()` | Already handles fractional frame values correctly |

## Common Pitfalls

### Pitfall 1: Missing paintVersion++ in undo/redo callbacks
**What goes wrong:** The undo/redo callbacks for moveElements* also need `paintVersion.value++` inside both `undo()` and `redo()` functions, not just in the main operation.
**Why it happens:** Easy to add paintVersion++ to the main function but forget that undo() and redo() also need to trigger re-renders.
**How to avoid:** Follow the exact pattern from `addElement`/`removeElement` -- check that both undo and redo callbacks include the version bump.
**Warning signs:** Undo/redo works (data changes) but canvas does not visually update.

### Pitfall 2: FX cache invalidation after reorder
**What goes wrong:** After moveElements* operations, the frame FX cache may show stale rendering order.
**Why it happens:** The FX cache (`_frameFxCache`) stores a rendered canvas with strokes in a specific order. After reordering, the cache is stale.
**How to avoid:** Call `invalidateFrameFxCache()` and `refreshFrameFx()` after reorder. Note the UI code in PaintProperties.tsx already does this in the `doReorder` handler (line ~185-186), but the store should also handle it for programmatic callers.
**Warning signs:** Reordered strokes appear in old order until the user forces a refresh.

### Pitfall 3: Two AddLayerMenu components
**What goes wrong:** UXP-02 isolation scoping is only applied to one of the two menus.
**Why it happens:** There are TWO separate files both named AddLayerMenu -- one in `components/layer/` (sidebar) and one in `components/timeline/AddFxMenu.tsx`.
**How to avoid:** Both must be updated. The sidebar one handles static/sequence/video imports via intent. The timeline one handles paint/roto, generators, adjustments, and content overlays directly.
**Warning signs:** Layer creation respects isolation in one location but not the other.

### Pitfall 4: Sequence overlay checkbox rename regression
**What goes wrong:** Renaming "Show sequence overlay" to "Show Seq BG" is cosmetic, but the signal name `showSequenceOverlay` and store methods should NOT be renamed (D-02 is UI text only).
**Why it happens:** Over-enthusiastic refactoring of the underlying signal/store to match the new label text.
**How to avoid:** Only change the display text in JSX, not the signal or method names.
**Warning signs:** Broken imports or runtime errors after renaming store internals.

### Pitfall 5: Content layer intent flow vs. direct creation
**What goes wrong:** For sidebar AddLayerMenu, isolation-scoped layer creation must work with the asynchronous intent flow (user selects file, then layer is created in ImportedView).
**Why it happens:** The sidebar menu dispatches an intent, and the actual layer creation happens later in a different component.
**How to avoid:** The intent object (`addLayerIntent`) may need a `targetSequenceId` field so ImportedView knows to add to the isolated sequence instead of creating a new content-overlay sequence.
**Warning signs:** Sidebar-created layers ignore isolation even though the menu shows the indicator.

## Code Examples

### Bug Fix Pattern: moveElementsForward (D-12)

Current broken code (lines 155-166 of paintStore.ts):
```typescript
moveElementsForward(layerId: string, frame: number, ids: Set<string>): void {
  const frameData = _frames.get(layerId)?.get(frame);
  if (!frameData) return;
  const els = frameData.elements;
  for (let i = els.length - 2; i >= 0; i--) {
    if (ids.has(els[i].id) && !ids.has(els[i + 1].id)) {
      [els[i], els[i + 1]] = [els[i + 1], els[i]];
    }
  }
  _dirtyFrames.add(`${layerId}:${frame}`);
  _markProjectDirty?.();
  // BUG: Missing paintVersion.value++ and pushAction()
},
```

Fixed pattern (following addElement/removeElement):
```typescript
moveElementsForward(layerId: string, frame: number, ids: Set<string>): void {
  const frameData = _frames.get(layerId)?.get(frame);
  if (!frameData) return;
  const before = [...frameData.elements]; // snapshot for undo
  const els = frameData.elements;
  for (let i = els.length - 2; i >= 0; i--) {
    if (ids.has(els[i].id) && !ids.has(els[i + 1].id)) {
      [els[i], els[i + 1]] = [els[i + 1], els[i]];
    }
  }
  _notifyVisualChange(layerId, frame);
  pushAction({
    id: crypto.randomUUID(),
    description: `Move elements forward on frame ${frame}`,
    timestamp: Date.now(),
    undo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      f.elements = [...before];
      _notifyVisualChange(layerId, frame);
    },
    redo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      f.elements = [...before];
      // Re-apply the forward move
      const reEls = f.elements;
      for (let i = reEls.length - 2; i >= 0; i--) {
        if (ids.has(reEls[i].id) && !ids.has(reEls[i + 1].id)) {
          [reEls[i], reEls[i + 1]] = [reEls[i + 1], reEls[i]];
        }
      }
      _notifyVisualChange(layerId, frame);
    },
  });
},
```

**Note:** An alternative undo/redo approach is to snapshot the element order array and restore it directly (simpler and avoids re-executing the algorithm):

```typescript
undo: () => {
  const f = _getOrCreateFrame(layerId, frame);
  f.elements = [...before]; // restore pre-move order
  _notifyVisualChange(layerId, frame);
},
redo: () => {
  const f = _getOrCreateFrame(layerId, frame);
  f.elements = [...after]; // restore post-move order
  _notifyVisualChange(layerId, frame);
},
```

### Isolation-Scoped Layer Creation (D-09, D-10)

```typescript
// In AddFxMenu.tsx (timeline AddLayerMenu)
import { isolationStore } from '../../stores/isolationStore';

// Check for isolation before creating
const isolatedIds = isolationStore.isolatedSequenceIds.value;
const hasIsolation = isolatedIds.size > 0;

// If isolated, find the target sequence
let targetSequenceId: string | null = null;
let targetSequenceName: string | null = null;
if (hasIsolation) {
  const seqs = sequenceStore.sequences.peek();
  const isolatedSeq = seqs.find(s => isolatedIds.has(s.id));
  if (isolatedSeq) {
    targetSequenceId = isolatedSeq.id;
    targetSequenceName = isolatedSeq.name;
  }
}

// Show indicator in menu (D-10)
{hasIsolation && targetSequenceName && (
  <div class="px-3 py-1 text-[9px] text-(--color-accent) font-medium">
    Adding to: {targetSequenceName}
  </div>
)}
```

### Sub-Frame Motion Dots (D-11)

```typescript
export function sampleMotionDots(
  keyframes: Keyframe[],
  canvasW: number,
  canvasH: number,
): {x: number; y: number; frame: number}[] {
  if (keyframes.length < 2) return [];

  const firstFrame = keyframes[0].frame;
  const lastFrame = keyframes[keyframes.length - 1].frame;
  const span = lastFrame - firstFrame;
  const step = span < 30 ? 0.25 : 1;
  const dots: {x: number; y: number; frame: number}[] = [];

  for (let f = firstFrame; f <= lastFrame; f += step) {
    const vals = interpolateAt(keyframes, f);
    if (vals) {
      dots.push({
        x: vals.x + canvasW / 2,
        y: vals.y + canvasH / 2,
        frame: Math.round(f),
      });
    }
  }

  return dots;
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `Application/vitest.config.ts` |
| Quick run command | `cd Application && npx vitest run --reporter=verbose` |
| Full suite command | `cd Application && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UXP-01 | Panel reorganization renders correctly | manual-only | N/A -- JSX layout changes require visual verification | N/A |
| UXP-02 | Layer creation scoped to isolated sequence | unit | `cd Application && npx vitest run src/stores/sequenceStore.test.ts -x` | Partial (sequenceStore.test.ts exists but needs new tests) |
| UXP-03 | Sub-frame dots for short sequences | unit | `cd Application && npx vitest run src/components/canvas/motionPath.test.ts -x` | Exists -- needs new test cases |
| D-12 | moveElements* has paintVersion++ and undo | unit | `cd Application && npx vitest run src/stores/paintStore.test.ts -x` | Does not exist -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd Application && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd Application && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `Application/src/stores/paintStore.test.ts` -- covers D-12 (moveElements* paintVersion++ and undo/redo)
- [ ] New test cases in `Application/src/components/canvas/motionPath.test.ts` -- covers UXP-03 (sub-frame sampling)
- [ ] New test cases in `Application/src/stores/sequenceStore.test.ts` -- covers UXP-02 (addLayerToSequence)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all canonical reference files
- `Application/src/stores/paintStore.ts` -- confirmed bug: moveElements* missing paintVersion++ and pushAction
- `Application/src/components/sidebar/PaintProperties.tsx` -- full 933-line panel structure mapped
- `Application/src/components/canvas/MotionPath.tsx` -- sampleMotionDots() and rendering confirmed
- `Application/src/lib/keyframeEngine.ts` -- interpolateAt() supports fractional frames (confirmed by code review)
- `Application/src/stores/isolationStore.ts` -- isolation API documented
- `Application/src/components/timeline/AddFxMenu.tsx` -- timeline layer creation (paint, FX, content)
- `Application/src/components/layer/AddLayerMenu.tsx` -- sidebar layer creation (static, sequence, video)
- `Application/src/stores/sequenceStore.ts` -- addLayer() and createFxSequence() confirmed

## Metadata

**Confidence breakdown:**
- Panel reorganization: HIGH - exact current structure mapped, decisions are precise layout instructions
- Bug fixes: HIGH - bug site confirmed, fix pattern established by existing addElement/removeElement
- Layer isolation: HIGH - both creation paths identified, isolationStore API documented
- Motion path density: HIGH - sampleMotionDots is a pure function, interpolateAt confirmed for fractional frames

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable internal codebase, no external dependencies)
