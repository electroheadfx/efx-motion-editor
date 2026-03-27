# Phase 25: Paint Compositing Pipeline - Research

**Researched:** 2026-03-27
**Domain:** Canvas 2D luma key compositing, non-destructive paint layer workflow
**Confidence:** HIGH

## Summary

This phase implements luma key compositing for paint layers: white background pixels become transparent so painted strokes composite over photos. A Luma Invert mode inverts the luma so black strokes on white become white strokes (transparent BG) over photos. The existing flatten/cache infrastructure (Phase 5) is reused for performance.

**Primary recommendation:** Apply luma key as a pixel pass on the offscreen paint canvas before it is composited in previewRenderer. Use ITU-R BT.709 luma weights (0.2126, 0.7152, 0.0722). Spike Canvas 2D performance at 1920x1080 + 24fps; escalate to WebGL2 only if profiling shows it is necessary (per Out of Scope note in REQUIREMENTS.md).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace "Show Seq BG" checkbox with **Luma Key** toggle in PaintProperties
- **D-02:** White background is always the luma key -- `paintBgColor` setting is removed (white is the key, always)
- **D-03:** Luma key is real-time during paint edit -- white pixels = transparent = photo shows through
- **D-04:** Exit paint mode: layer becomes a normal compositable layer with blend mode + opacity
- **D-05:** Re-enter paint mode: can still edit strokes -- changes update live (non-destructive)
- **D-06:** Add **Luma Invert** option alongside Luma Key toggle
- **D-07:** When enabled: extract luma -> convert to grayscale -> invert
- **D-08:** Effect: black strokes on white BG -> white strokes after invert
- **D-09:** This allows "white paint" strokes over photos
- **D-10:** Exit paint mode: layer is a normal compositable layer (blend mode + opacity work)
- **D-11:** Re-enter paint mode: strokes remain editable, changes propagate live
- **D-12:** Use existing flatten/cache infrastructure (frame FX cache from Phase 5) for performance
- **D-13:** Watercolor brush style requires white background
- **D-16:** Background color setting removed -- white is always the key
- **D-17:** Key color picker removed (white is fixed)
- **D-18:** Paper texture in paint layer removed -- user uses image layer underneath instead
- **D-19:** Gray background (COMP-02) obsolete -- white is the luma key

### Claude's Discretion

- Exact luma extraction algorithm (grayscale formula: luminance weights or simple average)
- Whether luma invert preview is live during paint or only on exit
- Flatten/cache trigger timing (exit paint, or explicit "flatten" action)

### Deferred Ideas (OUT OF SCOPE)

- Paper texture in paint layer -- user uses image layer underneath instead
- Key color picker -- white is fixed luma key
- Gray background (COMP-02) -- obsolete since white is always the luma key

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | User can composite FX paint over photos via luma matte extraction | Luma key algorithm in previewRenderer paint layer composite; ImageData pixel pass |
| COMP-02 | ~~User can paint on neutral gray background~~ | OBSOLETE per D-19; white is always the luma key |
| COMP-03 | ~~User can apply paper/canvas texture to paint layer~~ | OUT OF SCOPE per D-18; user adds paper texture as image layer underneath |
| COMP-04 | ~~User can load paper textures from ~/.config/efx-motion/papers/*~~ | OUT OF SCOPE |
| COMP-05 | ~~User can select paper texture from available textures in paint properties~~ | OUT OF SCOPE |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D ImageData | native | Luma extraction via getImageData/putImageData | Direct pixel access for luma-to-alpha conversion |
| ITU-R BT.709 luma | -- | Luminance formula: 0.2126R + 0.7152G + 0.0722B | Standard video/photo luminance weights; perceptual accuracy |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| WebGL2 (glslRuntime) | existing | WebGL2 fallback if Canvas 2D is too slow | Only if Canvas 2D pixel pass fails profiling at 1920x1080 + 24fps |
| frameFxCache (paintStore) | existing | Pre-rendered p5.brush FX canvas | Avoid re-rendering FX strokes on every compositing pass |

### Not Needed This Phase
- p5.brush -- already used for FX strokes; no changes needed
- glslRuntime luma key shader -- Canvas 2D sufficient; escalation only if needed

**No new npm packages required.**

---

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
├── lib/
│   ├── lumaKey.ts          # NEW: luma key / luma invert algorithm
│   └── previewRenderer.ts   # MODIFIED: apply luma key in paint layer composite
├── stores/
│   └── paintStore.ts       # MODIFIED: add lumaKeyEnabled, lumaInvertEnabled signals; remove auto-flatten on exit
└── components/sidebar/
    └── PaintProperties.tsx # MODIFIED: replace "Show BG Sequence" with Luma Key toggle + Luma Invert
```

### Pattern 1: Pixel Pass on Offscreen Canvas

**What:** Apply luma key as a post-render pixel pass on the offscreen paint canvas before it is composited onto the preview.

**When to use:** Luma key compositing, luma invert compositing.

**Integration point:** In previewRenderer.ts, after `renderPaintFrameWithBg()` produces the offscreen canvas, and before `ctx.drawImage(off, ...)`.

**Algorithm:**
```
LUMA_WEIGHTS = (0.2126, 0.7152, 0.0722)  // ITU-R BT.709

function applyLumaKey(canvas: HTMLCanvasElement, invert: boolean): void {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;  // 0-255

    if (invert) {
      data[i+3] = luma;         // Luma Invert: white BG -> transparent, black strokes -> opaque
    } else {
      data[i+3] = 255 - luma;  // Luma Key: white BG -> transparent, colored strokes -> opaque
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
```

### Pattern 2: Non-Destructive Paint Layer (existing infrastructure)

**What:** Strokes remain editable after exiting paint mode. Changes update live via `paintVersion` signal. Frame FX cache avoids re-rendering FX strokes every frame.

**Existing code:** `paintStore.flattenFrame()` / `unflattenFrame()`, `_frameFxCache` Map.

**Modification:** Remove the auto-flatten `effect()` in paintStore.ts (lines 656-669) that calls `flattenFrame()` when exiting paint mode. Keep the layer as a compositable layer (blend mode + opacity work) without rasterizing strokes.

### Pattern 3: Signal-Driven UI Toggle

**What:** `lumaKeyEnabled` and `lumaInvertEnabled` signals in paintStore, consumed reactively in previewRenderer via `effect()` or paintVersion bump.

**Integration:** When either signal changes, `paintVersion.value++` to trigger preview re-render.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Luminance calculation | Simple RGB average (0.33, 0.33, 0.33) | ITU-R BT.709 (0.2126, 0.7152, 0.0722) | Perceptually accurate; matches video/photo industry standard |
| Custom key color picker | UI + algorithm for custom key color | Fixed white key per D-02 | Simplicity; watercolor use case is white BG |
| Real-time luma preview | WebGL2 shader initially | Canvas 2D ImageData first | Per Out of Scope: "Canvas 2D with caching sufficient; escalate only if profiling shows need" |
| Paper texture compositing | Texture overlay in paint layer | Image layer underneath (existing layer stack) | Cleaner architecture; non-destructive |

**Key insight:** White is the fixed luma key. No key color customization in this phase. Paper texture goes under the paint layer as a separate image layer, not inside the paint layer.

---

## Runtime State Inventory

> Skip this section -- Phase 25 does not involve rename, rebrand, refactor, string replacement, or migration of stored runtime state. It is a feature implementation phase.

---

## Common Pitfalls

### Pitfall 1: Performance at Full Resolution (HIGH risk)

**What goes wrong:** Canvas 2D `getImageData()` + `putImageData()` at 1920x1080 x 24fps = ~50 million pixels/second. This can cause frame drops during live paint preview.

**Why it happens:** `getImageData` reads pixels from GPU to CPU; `putImageData` writes pixels back. Both are synchronous and block the main thread.

**How to avoid:** Profile at 1920x1080 + 24fps first. If bottleneck detected:
1. Cache the luma-keyed result in `_frameFxCache` -- only recompute when strokes change or luma settings change
2. Only apply luma key to the cached frame canvas, not on every render frame
3. Escalate to WebGL2 fragment shader only if above fails

**Warning signs:** Preview playback stutters when paint layer is visible, especially at full project resolution.

### Pitfall 2: Auto-Flatten Breaks Non-Destructive Edit (MEDIUM risk)

**What goes wrong:** Current `effect()` in paintStore.ts (lines 656-669) auto-flattens on exit paint mode. Flattening rasterizes strokes and breaks re-entry editability.

**Why it happens:** Existing Phase 5 behavior where exiting paint mode triggers `flattenFrame()`.

**How to avoid:** Remove or disable the auto-flatten effect. Strokes should remain in `_frames` (not flattened) so re-entering paint mode allows continued editing. The frame FX cache still provides fast playback without flattening.

**Warning signs:** After exiting and re-entering paint mode, stroke edits no longer appear; layer is rasterized.

### Pitfall 3: Luma Key Applied to Already-Cached FX Canvas

**What goes wrong:** Applying luma key to the `frameFxCache` canvas (which contains pre-rendered p5.brush FX strokes) would corrupt the cache for non-luma-keyed renders.

**Why it happens:** The same `_frameFxCache` canvas is reused for both normal preview and luma-keyed preview.

**How to avoid:** Apply luma key AFTER fetching from `_frameFxCache`, on a copy or on the final compositing offscreen canvas, not on the cache itself. Never write back to `_frameFxCache`.

**Warning signs:** Toggling luma key off leaves permanent artifacts; luma key effect persists for other layers.

### Pitfall 4: Alpha Premultiplication in ImageData

**What goes wrong:** Setting alpha via ImageData while RGB channels are in their original state may not composite correctly with `source-over` if the canvas context has `imageSmoothingEnabled` or if the canvas was created with premultiplied alpha.

**Why it happens:** Canvas 2D internal representation uses premultiplied alpha. Direct pixel writes via `putImageData` replace (not composite) pixel values, but compositing with `drawImage` after may behave unexpectedly.

**How to avoid:** Create a fresh offscreen canvas for the luma-keyed result, apply the pixel pass there, and use `drawImage` to composite. Alternatively, use a WebGL2 shader which handles alpha directly.

**Warning signs:** Dark fringes or halos around strokes after luma key; ghosting artifacts at stroke edges.

---

## Code Examples

### Luma Key Algorithm (Canvas 2D)

```typescript
// Source: Computed from ITU-R BT.709 standard
// Integration: Called in previewRenderer after renderPaintFrameWithBg()
// and before ctx.drawImage(off, ...)

export function applyLumaKey(
  canvas: HTMLCanvasElement,
  invert: boolean,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // ITU-R BT.709 luma
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (invert) {
      // Luma Invert: black strokes on white BG → white strokes (opaque BG)
      data[i + 3] = luma;
    } else {
      // Luma Key: white BG → transparent, dark/colored strokes → opaque
      data[i + 3] = 255 - luma;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
```

### Integration in previewRenderer.ts (paint layer composite)

```typescript
// Around line 290 in previewRenderer.ts
// Current:
renderPaintFrameWithBg(offCtx, paintFrame, projW, projH, layer.id, paintLookupFrame);

// After luma key (conceptual):
renderPaintFrameWithBg(offCtx, paintFrame, projW, projH, layer.id, paintLookupFrame);

// Apply luma key if enabled
if (lumaKeyEnabled || lumaInvertEnabled) {
  applyLumaKey(off, paintStore.lumaInvertEnabled.peek());
}

// Then composite with blend mode
ctx.save();
ctx.globalCompositeOperation = blendModeToCompositeOp(
  paintStore.paintMode.peek() ? 'normal' : layer.blendMode
);
ctx.globalAlpha = effectiveOpacity;
ctx.drawImage(off, 0, 0, logicalW, logicalH);
ctx.restore();
```

### paintStore Signals Addition

```typescript
// In paintStore.ts -- add these signals alongside existing ones
const lumaKeyEnabled = signal(false);
const lumaInvertEnabled = signal(false);

// Add to store export
export const paintStore = {
  // ... existing signals ...
  lumaKeyEnabled,
  lumaInvertEnabled,

  // Methods
  setLumaKeyEnabled(v: boolean): void {
    lumaKeyEnabled.value = v;
    paintVersion.value++;
  },
  setLumaInvertEnabled(v: boolean): void {
    lumaInvertEnabled.value = v;
    paintVersion.value++;
  },
  // ...
};
```

### Remove Auto-Flatten on Exit Paint Mode

```typescript
// paintStore.ts -- comment out or remove lines 656-669
// The auto-flatten effect breaks non-destructive editability.
// With frame FX cache, no flatten is needed for fast playback.
/*
let _wasPaintMode = false;
effect(() => {
  const active = paintMode.value;
  if (_wasPaintMode && !active) {
    const {layerStore} = require('./layerStore');
    const {timelineStore} = require('./timelineStore');
    const layerId = layerStore.selectedLayerId.peek();
    const frame = timelineStore.currentFrame.peek();
    if (layerId) {
      paintStore.flattenFrame(layerId, frame);
    }
  }
  _wasPaintMode = active;
});
*/
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Show BG Sequence overlay (checkbox shows photo ON TOP of paint at reduced opacity) | Luma Key (paint layer becomes transparent where white, photo shows THROUGH from below) | Phase 25 | Actual compositing, not just visibility toggle |
| Auto-flatten on exit paint mode | Non-destructive: strokes stay editable, frame FX cache provides fast playback | Phase 25 | Strokes can be edited after exiting paint mode |
| paintBgColor configurable background | Fixed white background = fixed luma key | Phase 25 | Simpler UI; removes color picker for key |
| Gray background (COMP-02) for luma matte quality | White background is always the luma key | Phase 25 | OBSOLETE per D-19 |

**Deprecated/outdated:**
- `showSequenceOverlay` signal -- replaced by `lumaKeyEnabled`
- `paintBgColor` signal -- key color is fixed white; signal can be kept (ignored) for backward compat
- Background color picker in PaintProperties -- removed per D-16

---

## Open Questions

1. **Live luma invert preview during paint, or only on exit/composite?**
   - What we know: D-03 says luma key is real-time during paint edit. D-07 (luma invert) is silent on this.
   - What's unclear: Should luma invert also be live during paint, or only applied when compositing?
   - Recommendation: Apply both luma key and luma invert live during paint edit. The pixel pass is fast enough when cached, and the user should see the actual result immediately.

2. **Canvas 2D performance at 1920x1080 + 24fps**
   - What we know: STATE.md flags this as a concern. `getImageData` at full resolution is synchronous.
   - What's unclear: Whether the pixel pass causes measurable frame drops during live paint preview.
   - Recommendation: Implement Canvas 2D first, profile with real strokes at project resolution. Add WebGL2 escalation only if needed.

3. **What happens to Show BG Sequence when luma key is active?**
   - What we know: "Show BG Sequence" currently overlays the photo ON TOP of paint at reduced opacity. Luma key composites paint OVER photo.
   - What's unclear: Does "Show BG Sequence" become redundant? Should it be hidden when luma key is active?
   - Recommendation: Keep "Show BG Sequence" but repurpose it as a "show original photo" toggle (for comparison), or remove it entirely since luma key replaces its function.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified -- Canvas 2D and WebGL2 are browser-native APIs already used by the project).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing project test setup) |
| Config file | `Application/vitest.config.ts` or `package.json` vitest section |
| Quick run command | `cd Application && npx vitest run --filter lumaKey` |
| Full suite command | `cd Application && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Luma key makes white pixels transparent | unit | `npx vitest run --filter lumaKey` | TBD (new test file) |
| COMP-01 | Luma key composited over photo in preview | integration | `npx vitest run --filter previewRenderer` | TBD |
| COMP-01 | Non-destructive: strokes editable after exit paint mode | unit | `npx vitest run --filter paintStore` | TBD |
| COMP-01 | Luma invert: black strokes become white opaque after invert | unit | `npx vitest run --filter lumaInvert` | TBD |

### Sampling Rate
- **Per task commit:** Unit tests for lumaKey algorithm + paintStore signal changes
- **Per wave merge:** Full vitest suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `Application/src/lib/lumaKey.test.ts` -- unit tests for luma extraction, luma invert, edge cases
- [ ] `Application/src/lib/lumaKey.ts` -- algorithm implementation (new file)
- Framework install: Vitest already present in project (existing test infrastructure)

*(If no gaps: "None -- existing test infrastructure covers all phase requirements")*

---

## Sources

### Primary (HIGH confidence)
- `Application/src/lib/paintRenderer.ts` -- `renderPaintFrameWithBg()` rendering pipeline, lines 194-231
- `Application/src/lib/previewRenderer.ts` -- paint layer composite point (lines 280-318), blend mode handling
- `Application/src/stores/paintStore.ts` -- signals, `flattenFrame()` / `unflattenFrame()`, `_frameFxCache`, auto-flatten effect
- `Application/src/components/sidebar/PaintProperties.tsx` -- current "Show BG Sequence" UI to replace
- ITU-R BT.709 standard -- luma weight coefficients (0.2126, 0.7152, 0.0722)

### Secondary (MEDIUM confidence)
- Canvas 2D ImageData performance characteristics -- known browser API behavior, widely documented
- p5.brush frame cache pattern -- existing Phase 5 infrastructure, documented in paintStore

### Tertiary (LOW confidence)
- WebGL2 escalation path -- not implemented; would be new, unverified approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Canvas 2D ImageData is the standard browser API; ITU-R BT.709 is the standard luminance formula
- Architecture: HIGH -- Existing infrastructure (frameFxCache, renderPaintFrameWithBg, previewRenderer composite) provides clear integration points
- Pitfalls: MEDIUM -- Performance risk is flagged but Canvas 2D first approach is recommended per Out of Scope agreement; non-destructive workflow is a behavior change that must be carefully tested

**Research date:** 2026-03-27
**Valid until:** 2026-04-26 (30 days -- stable Canvas 2D API)
