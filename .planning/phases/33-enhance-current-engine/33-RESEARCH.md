# Phase 33: Enhance Current Engine - Research

**Researched:** 2026-04-05
**Domain:** Paint engine UX improvements, color picker, undo fixes, animation feature
**Confidence:** HIGH

## Summary

Phase 33 is a pure enhancement phase on the existing Canvas 2D + p5.brush paint pipeline. No new engines, no new major dependencies. The work spans seven domains: (1) UX flow improvements (auto-enter paint mode, clear brush, exit button styling), (2) undo/render bug fixes (clearFrame undo missing paintVersion bump and FX cache invalidation), (3) circle cursor overlay, (4) inline color picker with four modes, (5) paint mode system (flat/FX/physical-placeholder with mutual exclusivity per frame), (6) modal color picker improvements, and (7) stroke draw-reveal animation.

The codebase is well-structured with signal-based reactivity (`@preact/signals`), a command-pattern undo system (`pushAction`), and clear separation between flat rendering (`paintRenderer.ts` via `perfect-freehand`) and FX rendering (`brushP5Adapter.ts` via `p5.brush`). All changes are incremental additions to existing patterns.

**Primary recommendation:** Fix undo bugs first (they affect testing of all other features), then build the mode system and color picker in parallel, then the animation feature last (it depends on the mode system being stable).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Creating a new paint layer auto-switches to paint edit mode (equivalent to pressing `[p]`)
- D-02: Default brush color is last-used color from preferences; without saved preference, default is `#203769` at size 35px. Color and size persist across sessions in app preferences.
- D-03: "Clear Brush" button deletes all strokes on current frame without confirmation dialog
- D-04: `Cmd+Z` must properly undo clear brush and re-render the canvas (currently broken)
- D-05: `Cmd+Z` after drawing or clearing must update the canvas render immediately
- D-06: FX paint mode undo bug: after undo, FX strokes render as flat until next interaction. Fix: invalidate FX cache on undo and force re-render.
- D-07: Paint brush shows a circle cursor at the current brush pixel size
- D-08: Circle cursor scales with canvas zoom (35px brush at 200% zoom = 70px circle on screen), matching Photoshop behavior
- D-09: Brush color button in PaintProperties toggles inline color picker docked on canvas left side
- D-10: Inline picker has 4 visual modes: Box (HSV square + hue/alpha sliders, default), TSL (H/S/L/A sliders), RVB (R/G/B/A sliders), CMYK (C/M/Y/K/A sliders). Plus HEX input field.
- D-11: Inline picker auto-applies color on interaction -- no Apply/Cancel buttons
- D-12: Swatches section: row of recent colors (auto-collected) + row of saved favorites (user-managed, add/remove). Both persisted in preferences.
- D-13: Remove Apply/Cancel buttons from modal color picker -- selected color applies in realtime
- D-14: Remove dark background overlay effect on modal
- D-15: Modal opens near mouse position, clamped to stay within app bounds
- D-16: Close by clicking outside the modal
- D-17: Flat brush mode renders on transparent background by default
- D-18: User can toggle a colored background if desired. "Show Seq BG" hidden in flat brush mode.
- D-19: "Exit Paint Mode" button is larger and styled in orange with CSS pulsate animation
- D-20: STROKES panel moves before SELECTION panel in sidebar
- D-21: Three brush modes: Paint (flat), FX Paint, Physical Paint (grayed out placeholder)
- D-22: Default mode is Paint (flat). FX brush styles hidden in flat mode.
- D-23: Mode switch only affects the current frame
- D-24: Each stroke has a mode type: flat, fx-paint (future: physic-paint)
- D-25: Cannot mix flat and FX strokes on the same frame -- mutually exclusive per frame
- D-26: Switching from flat to FX with strokes: dialog asks to pick FX style and "current frame or all frames?"
- D-27: Switching from FX to flat: confirmation dialog "Convert all strokes to flat on current frame or all frames?"
- D-28: Switching when canvas is empty: toggles immediately
- D-29: All paint modes show Blend Mode and Opacity slider in edit mode
- D-30: "Show flat preview" toggle only visible in FX Paint mode
- D-31: FX paint background always white (p5.brush limitation). Background color option hidden in FX mode.
- D-32: Compositing over photos via layer blend mode and opacity
- D-33: BUG FIX: Selecting FX brush style must actually paint in that style
- D-34: BUG FIX: Undo in FX mode must invalidate FX cache and re-render
- D-35: Selected FX stroke shows visible stroke wireframe/path line for easy grab. Transform bounding box for move.
- D-36: "Animate" button placed right of "Copy to next frame"
- D-37: Animate modal with two targets: (1) current frame to end of layer, (2) current frame to end of current sequence
- D-38: Animation uses speed-based point distribution -- slow drawing = more frames, fast drawing = fewer
- D-39: No preview before confirming. Can undo.

### Claude's Discretion
- Inline color picker component implementation (build custom or adapt existing library)
- Circle cursor rendering approach (CSS, canvas overlay, or SVG)
- FX cache invalidation strategy details for undo fix
- Speed-based point distribution algorithm for animate feature
- Exact pulsate animation CSS keyframes for exit button

### Deferred Ideas (OUT OF SCOPE)
- Physical Paint mode integration (efx-physic-paint engine) -- next phase
- Custom user brush presets via JSON (PAINT-09) -- future phase
- Per-stroke physics parameter isolation (PAINT-10) -- future phase
- Multi-frame stroke operations (PAINT-11) -- separate from animate feature
- Stroke grouping/nesting hierarchy (PAINT-12) -- future phase
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| perfect-freehand | ^1.2.3 | Flat stroke outline generation | Already used, no change |
| p5.brush | 2.1.3-beta | FX brush rendering (watercolor, ink, charcoal, pencil, marker) | Already used, standalone mode |
| @preact/signals | ^2.8.1 | Reactive state management | Already used throughout |
| @tauri-apps/plugin-store | ^2.4.2 | Persistent preferences (LazyStore) | Already used for app config |
| lucide-preact | ^0.577.0 | Icons | Already used throughout |

### No New Dependencies Needed
This phase adds no new libraries. All features are implementable with existing stack:
- Color picker: Build custom using existing `ColorPickerModal.tsx` color conversion utilities (already has `hexToRgba`, `rgbToHsl`, `hslToRgb`, `rgbaToHex`)
- Circle cursor: CSS or canvas overlay (no library needed)
- Animation: Pure math on existing stroke point arrays

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom inline color picker | react-colorful / @radix-ui/color | Custom avoids dependency, reuses existing 713-line ColorPickerModal utilities, full control over 4-mode layout |
| Canvas cursor overlay | Custom CSS cursor via `cursor: url(data:...)` | CSS cursor is simpler but limited -- cannot do smooth scaling with zoom. Canvas overlay recommended. |

## Architecture Patterns

### Key Codebase Patterns (existing, follow them)

**Signal + paintVersion bump pattern:**
Every paint data mutation MUST: (1) mutate data, (2) call `_notifyVisualChange()` which bumps `paintVersion`, marks dirty, and notifies project. All reactive consumers (Preview, canvas) subscribe to `paintVersion`.

**Undo pattern (pushAction):**
Every undoable mutation calls `pushAction({ undo: () => {...}, redo: () => {...} })`. Undo/redo closures MUST bump `paintVersion` and invalidate FX cache when touching FX strokes. Current bug: `clearFrame` undo closure does NOT do this.

**FX cache pattern:**
`_frameFxCache` Map stores pre-rendered `HTMLCanvasElement` per frame. Key: `"layerId:frame"`. Must be invalidated on ANY stroke mutation (add, remove, reorder, undo). `refreshFrameFx()` re-renders after invalidation.

**Preferences pattern:**
App uses `@tauri-apps/plugin-store` with `LazyStore('app-config.json')` in `appConfig.ts`. Brush color/size preferences should follow the same pattern: `store.set('brushColor', color)` / `store.get<string>('brushColor')`.

### Recommended New File Structure
```
app/src/
  components/
    canvas/
      PaintCursor.tsx              # NEW: Circle cursor overlay component
    sidebar/
      InlineColorPicker.tsx        # NEW: Inline color picker with 4 modes + swatches
      PaintModeSelector.tsx        # NEW: Flat/FX/Physical mode toggle UI
    shared/
      ColorPickerModal.tsx         # MODIFY: Remove overlay, position near mouse, remove buttons
  lib/
    strokeAnimation.ts             # NEW: Speed-based point distribution for animate feature
    paintPreferences.ts            # NEW: Brush color/size persistence via LazyStore
  stores/
    paintStore.ts                  # MODIFY: Add frame mode, fix undo bugs
  types/
    paint.ts                       # MODIFY: Add PaintFrameMode type
```

### Anti-Patterns to Avoid
- **Missing paintVersion bump in undo closures:** This is the root cause of D-04, D-05, D-06. Every undo/redo closure that modifies paint data MUST call `_notifyVisualChange()` or at minimum `paintVersion.value++`.
- **Missing FX cache invalidation in undo closures:** The `clearFrame` and `addElement` undo closures do not call `invalidateFrameFxCache()`. This causes FX strokes to render as flat after undo.
- **Mixing flat and FX strokes on same frame:** D-25 says mutually exclusive. The mode system must enforce this at the `addElement` level, not just in UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HSV color space math | Custom RGB-to-HSV formulas | Existing utilities in `ColorPickerModal.tsx` | Already has `hexToRgba`, `rgbToHsl`, `hslToRgb`, `rgbaToHex` -- extend with `rgbToHsv`/`hsvToRgb` |
| CMYK conversion | CMYK color profiles | Simple RGB-to-CMYK formula (no ICC profiles) | For a paint tool, approximate CMYK is fine: `C = 1 - R/255`, etc. No need for color management library. |
| Confirmation dialogs | Custom modal system | Existing modal pattern in codebase (portal-based) | `ColorPickerModal` uses `createPortal` -- reuse pattern |

## Common Pitfalls

### Pitfall 1: Undo Closure Missing Visual Notification
**What goes wrong:** After `Cmd+Z`, canvas shows stale content. User thinks undo didn't work.
**Why it happens:** `clearFrame` undo closure restores elements but does NOT call `_notifyVisualChange()`. The `paintVersion` signal doesn't bump, so reactive consumers (Preview, PaintOverlay render effect) don't re-run.
**How to avoid:** Every undo/redo closure that modifies `elements` array must call `_notifyVisualChange(layerId, frame)` AND `paintStore.invalidateFrameFxCache(layerId, frame)` if FX strokes exist.
**Warning signs:** Canvas looks unchanged after Cmd+Z; moving mouse or clicking triggers a delayed update.

### Pitfall 2: FX Cache Stale After Mode Conversion
**What goes wrong:** Converting strokes from flat to FX (or vice versa) leaves stale cache, causing wrong rendering.
**Why it happens:** Mode conversion changes `brushStyle` and `fxState` on strokes but forgets to invalidate the frame FX cache.
**How to avoid:** After any mode conversion operation, invalidate FX cache for affected frames and call `refreshFrameFx()`.
**Warning signs:** Strokes appear in wrong style after mode switch.

### Pitfall 3: Circle Cursor Size Drift at Extreme Zoom
**What goes wrong:** Circle cursor doesn't match actual brush stroke width at very high or very low zoom.
**Why it happens:** CSS transforms or canvas overlay math doesn't account for both canvas zoom AND device pixel ratio.
**How to avoid:** Circle diameter = `brushSize * canvasStore.zoom * devicePixelRatio` for canvas overlay, or `brushSize * canvasStore.zoom` for CSS overlay (CSS handles DPR automatically).
**Warning signs:** At 400%+ zoom, cursor ring doesn't match stroke width.

### Pitfall 4: Inline Picker Z-Index Conflicts
**What goes wrong:** Inline color picker overlaps with PaintToolbar or other floating UI.
**Why it happens:** Multiple absolute/fixed positioned elements compete for z-index space.
**How to avoid:** Define z-index hierarchy: canvas < cursor overlay < inline picker < toolbar < modal.
**Warning signs:** Picker appears behind toolbar or vice versa.

### Pitfall 5: Frame Mode Enforcement Gap
**What goes wrong:** User draws flat stroke on an FX frame via programmatic path (e.g., paste, import).
**Why it happens:** Mode enforcement only exists in UI toggles, not in `addElement()`.
**How to avoid:** Add mode check in `addElement()`: if frame has existing strokes of different mode, reject or convert.
**Warning signs:** Mixed flat/FX strokes on same frame causing rendering artifacts.

### Pitfall 6: Speed-Based Animation with Zero-Speed Segments
**What goes wrong:** Animation hangs or produces empty frames for very slow drawing segments.
**Why it happens:** Speed = distance / time. If user pauses (speed ~= 0), the algorithm tries to allocate infinite frames.
**How to avoid:** Clamp minimum speed to a floor value (e.g., 1 pixel/ms). Clamp maximum frames per segment.
**Warning signs:** Animate produces 1000+ frames for a short stroke.

## Code Examples

### Fix: clearFrame Undo Closure (D-04, D-05)
```typescript
// In paintStore.clearFrame -- current broken undo:
undo: () => {
  const f = _getOrCreateFrame(layerId, frame);
  f.elements = [...backup];
  // MISSING: these two lines fix the bug
  _notifyVisualChange(layerId, frame);
  paintStore.invalidateFrameFxCache(layerId, frame);
  paintStore.refreshFrameFx(layerId, frame);
},
redo: () => {
  const f = _getOrCreateFrame(layerId, frame);
  f.elements = [];
  _notifyVisualChange(layerId, frame);  // Also missing from redo
  paintStore.invalidateFrameFxCache(layerId, frame);
},
```

### Auto-Enter Paint Mode on Layer Creation (D-01)
```typescript
// In AddFxMenu.tsx handleAddPaintLayer, after layerStore.setSelected(layerId):
if (!paintStore.paintMode.peek()) {
  paintStore.togglePaintMode();
}
```

### Brush Preferences Persistence (D-02)
```typescript
// In new paintPreferences.ts
import { LazyStore } from '@tauri-apps/plugin-store';
const store = new LazyStore('app-config.json');

export async function saveBrushPreferences(color: string, size: number): Promise<void> {
  await store.set('brushColor', color);
  await store.set('brushSize', size);
}

export async function loadBrushPreferences(): Promise<{color: string; size: number}> {
  const color = await store.get<string>('brushColor') ?? '#203769';
  const size = await store.get<number>('brushSize') ?? 35;
  return { color, size };
}
```

### Circle Cursor (D-07, D-08) -- Canvas Overlay Approach
```typescript
// In PaintCursor.tsx -- render a circle that follows mouse position
// The circle size accounts for canvas zoom:
const diameter = brushSize * zoom;
// Position via CSS transform on a fixed-position div:
<div
  style={{
    position: 'absolute',
    left: `${screenX - diameter/2}px`,
    top: `${screenY - diameter/2}px`,
    width: `${diameter}px`,
    height: `${diameter}px`,
    border: '1px solid rgba(255,255,255,0.8)',
    borderRadius: '50%',
    pointerEvents: 'none',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
  }}
/>
```

### Speed-Based Point Distribution (D-38)
```typescript
// Core algorithm for animate feature
function distributePointsBySpeed(
  points: [number, number, number][],
  targetFrameCount: number,
): [number, number, number][][] {
  // 1. Calculate speed at each point (distance / time between consecutive points)
  // 2. Normalize speeds to get "time weight" per segment
  // 3. Allocate frames proportional to inverse speed (slow = more frames)
  // 4. Split points array into per-frame chunks
  
  const speeds: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i-1][0];
    const dy = points[i][1] - points[i-1][1];
    const dist = Math.sqrt(dx*dx + dy*dy);
    speeds.push(Math.max(dist, 0.5)); // clamp minimum speed
  }
  
  // Inverse speed = time weight (slow segments get more frames)
  const invSpeeds = speeds.map(s => 1 / s);
  const totalWeight = invSpeeds.reduce((a, b) => a + b, 0);
  
  // Allocate points per frame proportionally
  const frames: [number, number, number][][] = [];
  let pointIdx = 0;
  for (let f = 0; f < targetFrameCount; f++) {
    const frameWeight = (f + 1) / targetFrameCount;
    const targetPointIdx = Math.round(frameWeight * points.length);
    frames.push(points.slice(0, targetPointIdx));
  }
  return frames;
}
```

### Inline Color Picker HSV Box Mode
```typescript
// HSV square: x-axis = saturation (0-1), y-axis = value (1-0 top to bottom)
// Separate hue slider (0-360) and alpha slider (0-1)
// RGB to HSV (not in existing utils -- needs to be added):
function rgbToHsv(r: number, g: number, b: number): {h: number; s: number; v: number} {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h, s, v };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Confirmation dialog for Clear Brush | No confirmation (D-03) | Phase 33 | Faster workflow, undo is the safety net |
| Modal color picker with Apply/Cancel | Inline auto-apply picker (D-09) | Phase 33 | More natural painting workflow |
| Single brush mode (flat + FX mixed) | 3-mode system with per-frame exclusivity (D-21) | Phase 33 | Cleaner rendering pipeline, prepares for physics mode |
| Crosshair cursor for brush | Circle cursor at brush size (D-07) | Phase 33 | Photoshop-standard UX |

## Open Questions

1. **Frame mode storage location**
   - What we know: D-23 says mode switch affects current frame only. D-25 says flat/FX are mutually exclusive per frame.
   - What's unclear: Should frame mode be stored on the `PaintFrame` object or inferred from the strokes present?
   - Recommendation: Infer from strokes -- if all strokes are flat, frame is flat mode; if all are FX, frame is FX mode; if empty, frame accepts either. This avoids needing to persist an extra field and is self-consistent with D-25's exclusivity rule.

2. **Recent colors auto-collection trigger**
   - What we know: D-12 says recent colors are auto-collected and persisted.
   - What's unclear: Collect on every stroke commit, or on color change in picker?
   - Recommendation: Collect on stroke commit (when pointer lifts after drawing). This avoids flooding recents with intermediate slider values.

3. **CMYK accuracy expectations**
   - What we know: D-10 lists CMYK as one of 4 picker modes.
   - What's unclear: Whether ICC profile accuracy matters or simple mathematical conversion suffices.
   - Recommendation: Simple mathematical CMYK (no ICC profiles). This is a brush color picker, not a print proofing tool. Users just want a familiar input mode.

## Project Constraints (from CLAUDE.md)

- Use `pnpm` not `npm` for all package operations
- GSD tools are in `.claude/get-shit-done`, not `$HOME/.claude/get-shit-done`
- Do not run the server -- user runs it separately
- Always bump AND subscribe to `paintVersion` on mutations
- Guard shortcuts in paint mode via `isPaintEditMode()` check in `shortcuts.ts`
- No backward compat for old projects -- clean break on format changes
- Engine integration must be incremental (not relevant for this phase but good to note)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all canonical reference files listed in CONTEXT.md
- `paintStore.ts` -- verified undo bug in `clearFrame` (lines 343-363): undo closure missing `_notifyVisualChange` and FX cache invalidation
- `brushP5Adapter.ts` -- verified FX rendering pipeline, cache system, and style mapping
- `ColorPickerModal.tsx` -- verified existing color conversion utilities (713 lines)
- `appConfig.ts` -- verified `LazyStore` preferences pattern
- `history.ts` -- verified pushAction/undo/redo mechanics
- `AddFxMenu.tsx` -- verified paint layer creation flow (lines 100-121)

### Secondary (MEDIUM confidence)
- Circle cursor scaling approach: based on standard Photoshop/Procreate behavior (brush size * zoom = screen size)
- Speed-based animation algorithm: standard approach in drawing apps, verified concept but implementation details need iteration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing libraries verified in package.json
- Architecture: HIGH - all patterns observed directly in codebase, bugs located at exact line numbers
- Pitfalls: HIGH - undo bugs confirmed by code analysis; other pitfalls from established UX patterns
- Color picker: MEDIUM - building custom is straightforward but 4-mode picker is substantial UI work
- Animation algorithm: MEDIUM - speed-based distribution concept is sound but needs tuning

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable domain, no external dependency changes expected)
