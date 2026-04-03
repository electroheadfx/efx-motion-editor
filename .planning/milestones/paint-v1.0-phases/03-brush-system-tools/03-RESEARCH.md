# Phase 3: Brush System & Tools - Research

**Researched:** 2026-03-30
**Domain:** Canvas 2D brush system, tablet input, wet/dry paint physics brush types
**Confidence:** HIGH

## Summary

Phase 3 builds all 8 brush types (paint, erase, water, smear, blend, blow, wet, dry) in the existing single HTML file (`efx-paint-physic-v1.html`), wires the loaded-but-unused brush texture mask with quadrant mirroring, formalizes the stroke data model to match efx-motion-editor's PaintStroke format, and adds universal + contextual parameter controls. The existing `extractPenPoint()` and `getCoalescedEvents()` already handle tablet input capture -- no new input infrastructure is needed.

The primary technical challenge is implementing 6 new brush types (erase, water, smear, blend, blow, wet/dry) that operate directly on the wet layer arrays (`wetR`, `wetG`, `wetB`, `wetAlpha`, `wetness`) using a brush mask modulated by the brush texture. The existing paint tool's offscreen-canvas-to-wet-layer pipeline is the exception -- the new tools should manipulate wet arrays directly (like the original Rebelle code does), using the `sampleH()` heightmap as brush mask. Additionally, `strokeEdge()` artifacts must be fixed, the smudge tool removed, the mix tool merged into paint's pickup behavior, and `allActions[]` refactored to use a formal PaintStroke type.

**Primary recommendation:** Implement the 6 new brush types as direct wet-layer array manipulators (not offscreen canvas renderers), wire `brushGrain` into the brush mask calculation as `dH = sampleH * brushGrain * strength`, fix `strokeEdge()` by replacing jagged polygon edge strokes with smooth anti-aliased rendering, and refactor `allActions[]` to the PaintStroke type early so all new tools record in the correct format from the start.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Final tool set: paint, erase, water, smear, blend, blow, wet, dry + liquify (bonus)
- **D-02:** paint absorbs mix tool's pickup blending. Mix removed as separate tool
- **D-03:** smudge removed entirely (broken). smear built from scratch as Rebelle-style brush
- **D-04:** liquify stays as bonus tool (not one of 8 required)
- **D-05:** mix merged into paint -- paint tool already does pickup blending
- **D-06:** Fix paint brush strokeEdge() artifacts -- fix rendering, not edge slider
- **D-07:** Brush texture mask dual purpose: modulates paint deposit + adds per-stroke emboss grain
- **D-08:** Quadrant mirroring for seamless tiling (flip H and V across 4 quadrants)
- **D-09:** brushGrain loaded but unused -- wire into brush application code
- **D-10:** Universal sliders always visible: size, opacity, water amount, dry amount, pressure
- **D-11:** Per-type contextual extras appear when relevant tool selected
- **D-12:** Edge slider removed -- fix artifacts instead
- **D-13:** Mix-specific sliders removed -- mix merged into paint
- **D-14:** Pressure slider as multiplier: final = slider x penPressure. Mouse gets slider directly
- **D-15:** Match efx-motion-editor PaintStroke format: points as [x, y, pressure][] minimum + extended {tiltX, tiltY, twist, speed}
- **D-16:** Metadata per stroke: tool type, color, brush parameters, timestamp
- **D-17:** Refactor allActions[] to formal PaintStroke type

### Claude's Discretion
- Implementation details for each new brush type (erase, water, blend, blow, wet, dry)
- How quadrant mirroring is implemented (at load time vs at sample time)
- Specific pressure curve shape within multiplier model
- Which per-type contextual parameters each brush type exposes
- Bug fix approach for strokeEdge() artifacts

### Deferred Ideas (OUT OF SCOPE)
- Stroke persistence (serialize/deserialize to JSON) -- Phase 4
- Stroke replay from JSON (DEMO-04) -- Phase 4
- 24-slider Kontrol panel (original Rebelle style) -- Phase 5 if desired
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRUSH-01 | Brush types: paint, erase, water, smear, blend, blow, wet, dry | Architecture Patterns: all 8 types mapped with algorithms from original Rebelle code analysis |
| BRUSH-02 | Brush parameters: size, opacity, pressure, water amount, dry amount | Architecture Patterns: universal + contextual slider model, pressure multiplier pattern |
| BRUSH-03 | Brush texture mask (brush_texture.png) with quadrant mirroring, modulates paint amount | Architecture Patterns: quadrant mirroring at load time, brushGrain integration into mask calculation |
| STROKE-01 | Stroke data model {x, y, p, tx, ty, tw, spd} with [x, y, pressure] minimum | Architecture Patterns: PaintStroke type definition matching efx-motion-editor |
| STROKE-02 | Tablet/Wacom pen support via PointerEvent coalescing | Already implemented: extractPenPoint() + getCoalescedEvents() cover this requirement |
</phase_requirements>

## Standard Stack

No new libraries or packages needed. This phase works entirely within the existing single HTML file using vanilla JavaScript and Canvas 2D API.

### Core
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Canvas 2D API | Current | Pixel manipulation, offscreen rendering | Project constraint -- no WebGL |
| PointerEvent API | Current | Tablet pen input with pressure, tilt, twist | Already implemented in extractPenPoint() |
| Float32Array / Uint8ClampedArray | ES2015 | Wet layer arrays, brush grain storage | Performance for per-pixel operations |
| getCoalescedEvents() | Current | High-fidelity pen input coalescing | Already wired into pointermove handler |

### Browser Support for Key APIs (verified)
| API | Chrome | Firefox | Safari | Notes |
|-----|--------|---------|--------|-------|
| PointerEvent (pressure, tiltX, tiltY, twist) | 55+ | 59+ | 13+ | Full tablet support |
| getCoalescedEvents() | 58+ | 59+ | 17.2+ | Requires secure context (HTTPS) or localhost |
| Float32Array | Universal | Universal | Universal | ES2015 baseline |

## Architecture Patterns

### Brush Type Dispatch Pattern

The v1 file currently dispatches tools in `onPointerMove` (for smudge/liquify real-time) and `onPointerUp` (for paint/mix stroke completion). New brush types must follow the same dispatch pattern:

**Real-time tools** (applied per-chunk during pointer move): erase, smear, blow, wet, dry
**Stroke-completion tools** (applied on pointer up): paint (existing), water, blend

```javascript
// In onPointerMove -- real-time tools
if (tool === 'erase' && rawPts.length > 2) {
  applyEraseChunk(rawPts.slice(-3), getOpts());
} else if (tool === 'smear' && rawPts.length > 2) {
  applySmearChunk(rawPts.slice(-3), getOpts());
}
// ... etc

// In onPointerUp -- stroke-completion tools
if (tool === 'paint') {
  renderPaintStroke(rawPts, color, opts);
} else if (tool === 'water') {
  applyWaterStroke(rawPts, opts);
} else if (tool === 'blend') {
  applyBlendStroke(rawPts, opts);
}
```

### Brush Type Algorithms (from original Rebelle analysis)

Each brush type has a specific behavior derived from the original obfuscated code:

**1. paint (bG==0, function `aw`):** Already exists. Deposits paint to wet arrays via offscreen canvas + `transferToWetLayer`. Pickup blending (from mix tool) already works. Fix: `strokeEdge()` artifacts.

**2. erase (bG==1, function `bW`):** Multiplies `wetAlpha` and `wetness` (`f` in original) by `(1 - strength * brushMask)`. Uses `sampleH` as brush mask. Erases both wet and dry layers proportionally. Works per-point like smudge.

**3. water (bG==4, from `ep`):** NOT in the 8-tool dispatch but is the `wetBrush` function. Adds wetness (`f[i] += brushMask * amount`) without adding paint color. This makes existing wet paint spread via flow field. Does not deposit new color.

**4. smear (bG==12, function `c6`):** Captures paint under brush into temporary buffer, then deposits it at new position blended with existing paint. This is a "push paint around" tool. Operates on wet layer arrays directly. Reads wet RGB + alpha at previous position, writes blended values at current position using `brushMask * strength` as blend factor.

**5. blend (bG==13, function `cW`):** Averages wet paint within brush radius (area average), then replaces each pixel with weighted blend toward that average. This smooths color transitions. Two-pass: first compute weighted average of all wet paint in radius, then blend each pixel toward that average.

**6. blow (bG==14, function `bC`):** Adds displacement vectors (`dR`, `dQ` in original, which are flow field momentum) in the direction of pointer movement. Paint moves in the direction you drag. Modulated by brush mask and flow field.

**7. wet (bG==15, function `ep`):** Same as water -- adds wetness without color. `wetness[i] += brushMask * amount`. Existing paint becomes wetter and can flow again.

**8. dry (bG==16, function `dK`):** Reduces wetness: `wetness[i] *= (0.999 - brushMask * dryAmount)`. Forces paint to dry faster. Resets paper texture emboss.

### Direct Wet Layer Manipulation Pattern

The new brush types (erase, smear, blend, blow, wet, dry) should manipulate wet arrays directly. They do NOT need offscreen canvases. The pattern for each:

```javascript
function applyBrushAtPoint(cx, cy, radius, strength, opts) {
  const ri = Math.ceil(radius);
  const r2 = radius * radius;

  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      const dd = dx * dx + dy * dy;
      if (dd > r2) continue;

      const px = cx + dx, py = cy + dy;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;

      const i = py * W + px;
      const falloff = 1 - Math.sqrt(dd) / radius;

      // Brush mask: heightmap * brush grain * falloff * strength
      const hVal = sampleH(px, py);
      const grainVal = sampleBrushGrain(px, py); // NEW: from brushGrain
      const mask = hVal * grainVal * falloff * falloff * strength;

      // Per-tool operation on wet arrays:
      // erase:  wetAlpha[i] *= (1 - mask);
      // water:  wetness[i] += mask * waterAmount;
      // wet:    wetness[i] += mask * wetAmount;
      // dry:    wetness[i] *= (1 - mask * dryRate);
      // smear:  blend from previous position
      // blend:  blend toward area average
      // blow:   add flow displacement
    }
  }
}
```

### Brush Texture Quadrant Mirroring

The `brushGrain` is loaded as 128x128 Float32Array from brush_texture.png region (192,192). Quadrant mirroring creates seamless tiling by flipping the texture across both axes:

**Recommendation: Implement at load time** (pre-compute 256x256 mirrored version from 128x128 source).

```javascript
// At load time: create 256x256 mirrored texture from 128x128 source
function createMirroredBrushGrain(src128) {
  const S = 128;
  const mirrored = new Float32Array(S * 2 * S * 2); // 256x256

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const val = src128[y * S + x];
      // Q1: top-left (original)
      mirrored[y * S * 2 + x] = val;
      // Q2: top-right (flip H)
      mirrored[y * S * 2 + (S * 2 - 1 - x)] = val;
      // Q3: bottom-left (flip V)
      mirrored[(S * 2 - 1 - y) * S * 2 + x] = val;
      // Q4: bottom-right (flip H+V)
      mirrored[(S * 2 - 1 - y) * S * 2 + (S * 2 - 1 - x)] = val;
    }
  }
  return mirrored;
}

// At sample time: wrap coordinates into 256x256 space
function sampleBrushGrain(x, y) {
  if (!mirroredGrain) return 1.0; // fallback: no modulation
  const S = 256; // mirrored size
  const ix = ((Math.floor(x) % S) + S) % S;
  const iy = ((Math.floor(y) % S) + S) % S;
  return mirroredGrain[iy * S + ix];
}
```

**Why load-time:** Sampling happens thousands of times per stroke. The 256x256 lookup is O(1) per pixel. Runtime mirroring would add branching per sample.

### PaintStroke Type Definition

```javascript
// Stroke point -- matches extractPenPoint() output
// StrokePoint = {x, y, p, tx, ty, tw, spd}

// PaintStroke -- for allActions[] refactor
// Minimal serializable format for efx-motion-editor compatibility:
// {
//   tool: 'paint' | 'erase' | 'water' | 'smear' | 'blend' | 'blow' | 'wet' | 'dry' | 'liquify',
//   points: Array<{x, y, p, tx, ty, tw, spd}>,   // full pen data
//   color: '#rrggbb',                              // hex color (null for colorless tools)
//   params: {                                       // brush parameters at time of stroke
//     size: number,          // brush radius
//     opacity: number,       // 0-100
//     pressure: number,      // base pressure multiplier 0-100
//     waterAmount: number,   // 0-100
//     dryAmount: number,     // 0-100
//     pickup: number,        // 0-100 (paint tool)
//     // ... per-tool extras
//   },
//   timestamp: number,       // Date.now()
// }
```

The `[x, y, pressure][]` minimum format for efx-motion-editor compatibility means: `points.map(p => [p.x, p.y, p.p])` produces the minimal representation. Extended fields are preserved for full replay.

### Pressure Multiplier Model

```javascript
// D-14: Pressure slider acts as multiplier
function getEffectivePressure(penPoint, sliderValue) {
  const base = sliderValue / 100; // 0-1
  if (hasPenInput) {
    return base * penPoint.p; // slider * pen pressure
  }
  return base; // mouse users get slider value directly
}
```

### strokeEdge() Fix Strategy

The current `strokeEdge()` (line 400) draws jagged polygon outlines using `ctx.stroke()` on deformed polygon vertices. The jaggedness comes from `deformN()` creating sharp vertices that produce spiky marks at small radii.

**Fix approach:** Replace `strokeEdge()` with smooth anti-aliased edge rendering. Two options:

1. **Gaussian blur on the polygon edges** -- apply a small blur to the offscreen canvas after polygon rendering to soften edges. Simple but costs performance.

2. **Remove strokeEdge entirely, increase polygon layer count** -- the layered polygon fill approach (`fillPolyGrain` + `fillFlat`) already creates natural soft edges when enough layers overlap. Removing `strokeEdge` and slightly increasing layer count may produce better results with less code.

**Recommendation:** Option 2 -- remove `strokeEdge()` calls entirely, remove the edge slider (`#ed`), and let the layered polygon fills create natural edges. This aligns with D-06 and D-12 (edge slider removed). Test with various brush sizes to verify soft edges.

### UI Reorganization

Current toolbar sliders: Size, Wetness, Opacity, Pickup, Edge + Mix-specific (Smudge, Liquify, Paint)

New universal sliders (always visible per D-10):
- **Size** (existing `#sz`)
- **Opacity** (existing `#op`)
- **Water Amount** (rename from Wetness `#we`)
- **Dry Amount** (new slider)
- **Pressure** (new slider -- base pressure multiplier)

Per-tool contextual sliders (per D-11):
- **paint:** Pickup
- **blow:** Blow Strength
- **erase:** (none -- universal sliders sufficient)
- **water/wet:** (none -- water amount is universal)
- **smear:** Smear Strength
- **blend:** Blend Radius (how far averaging extends)
- **dry:** (none -- dry amount is universal)

### Anti-Patterns to Avoid

- **Creating offscreen canvases for simple array operations:** The new brush types (erase, water, smear, blend, blow, wet, dry) operate directly on wet arrays. Do NOT create per-stroke offscreen canvases for them. Only the paint tool needs the offscreen canvas pipeline for polygon rendering.
- **Sampling brush grain per pixel without wrapping:** Always use modulo wrapping for brush grain coordinates to handle any canvas position.
- **Applying brush grain to tools that should not have it:** The water, wet, and dry tools should use heightmap mask but may not need brush grain modulation (they affect wetness, not paint deposit). The original Rebelle uses brush grain only for paint and smear.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brush mask falloff | Custom falloff curves | Quadratic falloff `(1 - d/r)^2` | Same as existing smudge/liquify pattern, proven smooth |
| Texture tiling | Manual coordinate wrapping per sample | Pre-computed mirrored 256x256 array + modulo lookup | O(1) per pixel, no branching |
| Pressure curves | Complex Bezier pressure response | Linear multiplier (D-14) | User-decided simplicity, matches existing pattern |
| Stroke smoothing | New smoothing algorithm | Existing `smooth()` + `resample()` functions | Already proven in paint tool, handles pen jitter |
| Color blending for smear/blend | New blending math | Existing `lerp()` + weighted average pattern | Same math as original Rebelle `c6`/`cW` functions |

## Common Pitfalls

### Pitfall 1: Smear vs Smudge Confusion
**What goes wrong:** Building smear as a copy of the broken smudge tool.
**Why it happens:** Smudge operates on canvas ImageData (dry pixels). Smear should operate on wet layer arrays. Different data source.
**How to avoid:** Smear reads from wet arrays (`wetR`, `wetG`, `wetB`, `wetAlpha`), captures paint at previous cursor position, and deposits it at current position blended with existing wet paint. Never touch `X.getImageData()` from smear.
**Warning signs:** Code calls `X.getImageData()` inside smear function.

### Pitfall 2: Wet Layer Range Overflow
**What goes wrong:** Brush operations push `wetAlpha` or `wetness` past their expected ranges.
**Why it happens:** Multiple brush types adding values without clamping. `wetAlpha` range is 0-200000 (high cap for stack tracking), `wetness` range is 0-1000.
**How to avoid:** Always clamp after modification: `wetAlpha[i] = Math.min(200000, newVal)`, `wetness[i] = Math.min(1000, newVal)`.
**Warning signs:** Paint appears fully opaque instantly, or flow simulation goes haywire.

### Pitfall 3: Direct Canvas Writes Breaking Undo
**What goes wrong:** New brush types writing directly to the main canvas `X` instead of wet layer, making undo impossible.
**Why it happens:** The existing smudge and liquify tools do this (they operate on `X` directly). New tools must NOT follow this pattern.
**How to avoid:** All 8 required brush types must write to wet layer arrays. The `compositeWetLayer()` rAF loop handles display. Only the undo system should touch `X` directly.
**Warning signs:** Brush strokes appear on the dry canvas but not in the wet layer display.

### Pitfall 4: allActions[] Format Migration Mid-Implementation
**What goes wrong:** Refactoring allActions[] to PaintStroke format after implementing several tools, causing tool recording mismatches.
**Why it happens:** Temptation to "get tools working first, refactor later."
**How to avoid:** Define PaintStroke type and refactor allActions[] recording in onPointerUp FIRST, before implementing new brush types. Every new tool records in the correct format from day one.
**Warning signs:** Different tools record data in different formats in allActions[].

### Pitfall 5: Brush Grain Modulating Wrong Tools
**What goes wrong:** Applying brush grain texture to water/wet/dry tools, creating unnatural-looking wetness patterns.
**Why it happens:** Applying brush grain uniformly to all tools.
**How to avoid:** Brush grain modulates paint deposit (paint tool, smear) and emboss grain (paint tool). Water/wet/dry tools use only heightmap + falloff as mask. Blow tool uses only heightmap for displacement direction.
**Warning signs:** Water tool creates visible brush texture patterns in wetness instead of smooth water addition.

### Pitfall 6: strokeEdge Fix Regression
**What goes wrong:** Removing strokeEdge() but not compensating, resulting in strokes with no visible edges (too soft/blobby).
**Why it happens:** strokeEdge() was adding definition even when creating artifacts.
**How to avoid:** After removing strokeEdge, test with various brush sizes (small 6px, medium 24px, large 80px). If edges are too soft, slightly increase polygon layer count or add a subtle final darkened polygon layer.
**Warning signs:** Strokes look like blurry blobs with no definition at medium/large sizes.

## Code Examples

### Example 1: Erase Brush (direct wet layer manipulation)

```javascript
// Erase: reduces wet and dry paint under brush
// Based on original Rebelle bW() function
function applyEraseChunk(pts, opts) {
  if (pts.length < 2) return;
  const { size, pressure, opacity } = opts;
  const strength = (opacity / 100) * 0.2; // erase strength from opacity

  for (let ci = 1; ci < pts.length; ci++) {
    const p = pts[ci];
    const pMod = getEffectivePressure(p, pressure);
    const localR = size * (hasPenInput ? 0.5 + p.p * 0.5 : 1);
    const ri = Math.ceil(localR);
    const r2 = localR * localR;
    const cx = Math.round(p.x), cy = Math.round(p.y);

    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const dd = dx * dx + dy * dy;
        if (dd > r2) continue;
        const px = cx + dx, py = cy + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;

        const i = py * W + px;
        const falloff = 1 - Math.sqrt(dd) / localR;
        const hVal = sampleH(px, py);
        // Erase uses heightmap for mask shape but NOT brush grain
        const mask = hVal * falloff * falloff * strength * pMod;
        const keep = 1 - clamp(mask, 0, 1);

        // Reduce wet paint
        wetAlpha[i] *= keep;
        wetness[i] *= keep;
        if (wetAlpha[i] < 1) wetAlpha[i] = 0;
      }
    }
  }
}
```

### Example 2: Water/Wet Brush (adds wetness without color)

```javascript
// Water/Wet: adds wetness to make existing paint flow again
// Based on original Rebelle ep() (wetBrush)
function applyWetChunk(pts, opts) {
  if (pts.length < 2) return;
  const { size, waterAmount } = opts;
  const amount = waterAmount / 100;

  for (let ci = 0; ci < pts.length; ci++) {
    const p = pts[ci];
    const pMod = hasPenInput ? 0.3 + p.p * 0.7 : 1;
    const localR = size * (hasPenInput ? 0.5 + p.p * 0.5 : 1);
    const ri = Math.ceil(localR);
    const r2 = localR * localR;
    const cx = Math.round(p.x), cy = Math.round(p.y);

    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const dd = dx * dx + dy * dy;
        if (dd > r2) continue;
        const px = cx + dx, py = cy + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;

        const i = py * W + px;
        const hVal = sampleH(px, py);
        if (hVal <= 0) continue;

        // Add wetness -- no brush grain, just heightmap mask
        wetness[i] = Math.min(1000, wetness[i] + hVal * amount * pMod * 800);
      }
    }
  }
}
```

### Example 3: Smear Brush (push paint around)

```javascript
// Smear: captures wet paint at previous position, deposits at current
// Based on original Rebelle c6() (smudgeBrush -- the REAL smear)
function applySmearChunk(pts, opts) {
  if (pts.length < 2) return;
  const { size, opacity } = opts;
  const strength = (opacity / 100) * 0.6;

  for (let ci = 1; ci < pts.length; ci++) {
    const p = pts[ci], pp = pts[ci - 1];
    const pMod = hasPenInput ? 0.3 + p.p * 0.7 : 1;
    const localR = size * (hasPenInput ? 0.5 + p.p * 0.5 : 1);
    const ri = Math.ceil(localR);
    const r2 = localR * localR;

    // Capture paint at previous position
    const prevCx = Math.round(pp.x), prevCy = Math.round(pp.y);
    const captured = { r: [], g: [], b: [], a: [] };
    // ... read from wet arrays at previous position into buffer

    // Deposit at current position with brush grain modulation
    const cx = Math.round(p.x), cy = Math.round(p.y);
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const dd = dx * dx + dy * dy;
        if (dd > r2) continue;
        // ... blend captured into wet arrays at current position
        // Use sampleH * sampleBrushGrain * falloff * strength * pMod
      }
    }
  }
}
```

### Example 4: Blow Brush (push paint via flow displacement)

```javascript
// Blow: adds displacement vectors to make wet paint move
// Based on original Rebelle bC() (blow tool)
// In the original, blow modifies dR[] and dQ[] (flow displacement arrays)
// In v1, we add to the wetness and let the existing flowStep() move paint
function applyBlowChunk(pts, opts) {
  if (pts.length < 2) return;
  const { size, blowStrength } = opts;
  const strength = (blowStrength || 50) / 100;

  for (let ci = 1; ci < pts.length; ci++) {
    const p = pts[ci], pp = pts[ci - 1];
    // Direction of pointer movement
    let dx = p.x - pp.x, dy = p.y - pp.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;

    const pMod = hasPenInput ? 0.3 + p.p * 0.7 : 1;
    const localR = size * (hasPenInput ? 0.5 + p.p * 0.5 : 1);
    const ri = Math.ceil(localR);
    const r2 = localR * localR;
    const cx = Math.round(p.x), cy = Math.round(p.y);

    for (let oy = -ri; oy <= ri; oy++) {
      for (let ox = -ri; ox <= ri; ox++) {
        const dd = ox * ox + oy * oy;
        if (dd > r2) continue;
        const px = cx + ox, py = cy + oy;
        if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) continue;

        const i = py * W + px;
        if (wetness[i] < 1) continue; // only blow wet paint

        const falloff = 1 - Math.sqrt(dd) / localR;
        const hVal = sampleH(px, py);
        const mask = hVal * falloff * falloff * falloff * strength * pMod;

        // Increase wetness to enable flow, biased in movement direction
        wetness[i] = Math.min(1000, wetness[i] + mask * 500);
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Processing.js pixel arrays | Vanilla JS typed arrays (Float32Array) | Phase 1 | All brush ops use standard JS arrays |
| Direct canvas rendering | Wet layer -> compositeWetLayer() rAF loop | Phase 1 | All tools must write to wet arrays, not canvas |
| globalAlpha transparency | Density-weighted blending (DENSITY_K=3.5) | Phase 2 | Paint opacity accumulates naturally |
| Smudge tool on dry canvas | Smear tool on wet layer arrays | This phase | Per D-03: build smear from scratch |

## Open Questions

1. **Blow tool flow mechanics**
   - What we know: Original Rebelle uses `dR`/`dQ` displacement arrays that are consumed by `flowStep()`. The v1 file has `flowStep()` but may not have explicit displacement arrays.
   - What's unclear: Whether v1's `flowStep()` supports directional displacement or only height-gradient-based flow. May need to add displacement vectors to the physics.
   - Recommendation: Start with increasing wetness in blow direction (simpler). If paint does not visibly move in the blow direction, add explicit `flowDx`/`flowDy` displacement arrays.

2. **Blend tool performance**
   - What we know: Blend averages all wet paint in brush radius, then writes back. This is O(n) per pixel in the radius for the averaging pass.
   - What's unclear: Whether performance is acceptable for large brush sizes (80px radius = ~20K pixel reads per point).
   - Recommendation: Implement with sparse sampling (skip every other pixel in the averaging pass for radius > 30). The original Rebelle does not optimize this.

3. **Brush grain for emboss vs paint modulation**
   - What we know: D-07 says dual purpose -- modulates paint deposit AND adds emboss grain. Currently `applyPaperEmboss()` handles emboss using `paperHeight`, and `brushGrain` is unused.
   - What's unclear: Whether brush grain should replace paper heightmap in emboss or be additive.
   - Recommendation: Use brush grain in `compositeWetLayer()` as additional alpha modulation on wet paint display (creates visible bristle variation), AND multiply it into paint deposit mask for the paint tool. Keep paper heightmap for emboss (it comes from the paper texture, not the brush).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | none -- see Wave 0 |
| Quick run command | Manual visual testing in browser |
| Full suite command | Manual visual testing -- all 8 brush types + parameter controls |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRUSH-01 | All 8 brush types produce visible output | manual-only | Open in browser, select each tool, draw stroke | N/A |
| BRUSH-02 | Size, opacity, pressure, water, dry sliders affect output | manual-only | Adjust each slider, verify visual difference | N/A |
| BRUSH-03 | Brush texture mask creates visible bristle variation | manual-only | Paint with grain visible, compare with/without | N/A |
| STROKE-01 | allActions[] stores PaintStroke format | manual-only | `console.log(allActions[0])` in devtools | N/A |
| STROKE-02 | Pen data captured in stroke points | manual-only | Draw with tablet, check penInfo display + allActions | N/A |

**Justification for manual-only:** This is a single HTML file with Canvas 2D rendering. Automated visual regression testing would require Puppeteer + pixel comparison, which is out of scope for Phase 3. The stroke data model (STROKE-01) can be verified via browser devtools console.

### Sampling Rate
- **Per task commit:** Open browser, test modified tool visually
- **Per wave merge:** Test all 8 tools + parameter sliders
- **Phase gate:** All 8 tools paint visually correct strokes, allActions[] logs PaintStroke format

### Wave 0 Gaps
- None -- no test framework needed for manual visual testing phase

## Sources

### Primary (HIGH confidence)
- `efx-paint-physic-v1.html` -- direct code analysis of existing tool implementations (paint, smudge, liquify, mix), wet layer arrays, pointer events, brush grain loading
- `js/rebelle-paint.js` -- original Rebelle brush type implementations: `aw` (paint, line 1621), `bW` (erase, 1879), `c6` (smear, 1960), `cW` (blend, 2126), `bC` (blow, 2324), `ep` (wet, 2456), `dK` (dry, 2530)
- [MDN PointerEvent API](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent) -- verified pressure, tiltX, tiltY, twist properties
- [MDN getCoalescedEvents](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents) -- verified coalescing behavior and browser support

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- StrokeBuilder and PaintStroke type design from earlier research

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all Canvas 2D API verified
- Architecture: HIGH -- derived from direct code analysis of both v1 and original Rebelle source
- Pitfalls: HIGH -- identified from analysis of existing code patterns and original algorithm behavior

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain, no external dependency changes expected)

## Project Constraints (from CLAUDE.md)

- **Framework:** Vite + Preact + TypeScript for demo app; library is vanilla TS -- but Phase 3 stays in single HTML file per Phase 1 decision D-04
- **Rendering:** Canvas 2D only (not WebGL)
- **No Processing.js dependency:** All brush types must use vanilla JS/Canvas 2D patterns
- **Brush texture:** Must load and use brush_texture.png mask (BRUSH-03)
- **Package name:** @efxlab/efx-physic-paint -- no "rebelle" or "Rebelle" in identifiers
- **GSD Workflow:** Use `/gsd:execute-phase` for planned phase work -- no direct repo edits outside GSD workflow
