# Phase 1: Algorithm Port Foundation - Research

> **STALE CONTEXT WARNING (2026-03-29):** This research was generated against the original context (2026-03-28) which assumed a Processing.js port approach. The approach was changed on 2026-03-28 to build from paint-studio-v9.html instead. Locked decisions D-01 through D-12 below are OUTDATED. Refer to `01-CONTEXT.md` (updated 2026-03-29) for current locked decisions. The architecture patterns, code examples, and pitfalls sections remain useful as conceptual reference.

**Researched:** 2026-03-28
**Domain:** Canvas 2D paint physics, Processing.js algorithm port, TypedArray-based simulation
**Confidence:** HIGH (primary source = original minified JS, verified against types.ts)

## Summary

Phase 1 ports the Rebelle Processing.js watercolor algorithm to vanilla TypeScript + Canvas 2D. The algorithm uses a dual-layer wet/dry paint system with typed arrays, a flow field for capillary paint transport, paper texture for brush influence, and a drying LUT for wet-to-dry conversion. All 8 brush types (paint, erase, water, smear, blend, blow, wet, dry) are implemented via a single combined mask dH = circularFalloff * textureMask. The rendering loop runs at 40fps with physics stepped every other frame. The demo uses Vite + Preact + TypeScript on a fresh canvas (NOT the broken paint-rebelle-new attempt).

**Primary recommendation:** Faithfully port Processing.js pixel array patterns using the exact constant values from `paint-rebelle-new/src/types.ts`, with CANVAS_STRIDE resolved to 902 from the original code.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep full Toolbar with all 8 brushes and 5 parameter sliders (size, opacity, pressure, water amount, dry amount)
- **D-02:** Demo is the original `./index.html` + `./js/rebelle-paint.js` Processing.js sketch, NOT the failed attempts in `paint-rebelle-new/` or `paint-rebelle/`
- **D-03:** Manual side-by-side verification in browser tabs
- **D-04:** Success criteria: "visually identical output" judged by eye
- **D-05:** All 8 brush types must work and produce correct wet/dry physics
- **D-06:** Wet/dry physics fully verified (wet spreads via flow field, dries over time, paper texture influences behavior)
- **D-07:** Port Processing.js algorithm faithfully — two previous rewrite attempts failed
- **D-08:** Canvas 2D (not WebGL)
- **D-09:** No Processing.js dependency — translate Processing.js pixel array patterns to vanilla Canvas 2D
- **D-10:** CANVAS_STRIDE = 904 (900 + 2 boundary pixels, verified against original)
- **D-11:** Dual-layer system: wetLayer Float32Array + dryLayer Uint8Array
- **D-12:** Package name: `@efxlab/efx-physic-paint` — no "rebelle" or "Rebelle" in any identifier

### Claude's Discretion
- Exact constant values (already defined in `types.ts` as DEFAULT_PHYSICS)
- Render loop timing details (40fps target already set)
- Paper texture loading path details

### Deferred Ideas (OUT OF SCOPE)
None.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHYS-01 | Dual-layer wet/dry paint physics (wetLayer Float32Array + dryLayer Uint8Array) matching original | Algorithm uses cA/cI/cL/cM (Float32 wet) + cV/c0/c3 (Uint8 dry) + c4 (Float32 dry alpha). Confirmed in `js/rebelle-paint.js` lines 493-500 |
| PHYS-02 | Paper texture loading (512x512 jpg to Float32Array heightmap) influencing brush and flow | Paper texture (ae) is 512x512 loaded as red channel, accessed with wrapping via `& ar` where `ar = 511`. Confirmed lines 544-552, 505 |
| PHYS-03 | Flow field transport (dH array) calculated from brush mask times paper texture heightmap | dH = cp * aN (circular falloff times brush texture). aO function computes flow field from paper texture and wetness. Confirmed lines 817, 2887-2991 |
| CANVAS-01 | Responsive canvas with correct coordinate mapping | Canvas is 902x536 (UI takes 86px), drawing area is bR=900 x bQ=450. Coordinate mapping via getBoundingClientRect + scale factor confirmed in index.html |
| CANVAS-02 | Canvas stride = 902 (NOT 904) | **DISCREPANCY**: Original code (`js/rebelle-paint.js` line 409) shows `a4 = bR + 2 = 902`. REQUIREMENTS.md says 902. CONTEXT D-10 says 904. types.ts says 904. Must resolve before implementation. |
| LIB-02 | TypeScript with full type definitions, no runtime dependencies | paint-rebelle-new has valid TypeScript setup with tsc 5.9.3. Library itself is vanilla TS per CLAUDE.md |
| DEMO-01 | Vite + Preact + TypeScript demo app with working canvas | paint-rebelle-new has working Vite + Preact setup. Fresh engine implementation needed |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type-safe physics engine | Strict mode from paint-rebelle-new |
| Vite | 8.0.1 | Build/dev server | Already in paint-rebelle-new |
| Preact | 10.29.0 | UI components | Per CLAUDE.md |
| @preact/preset-vite | 2.10.4 | Vite Preact integration | Already configured |
| Canvas 2D API | — | Pixel-level paint simulation | Original uses Processing.js 2D pixel arrays |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | Physics is all typed arrays | No external physics library needed |

**Installation:**
```bash
cd paint-rebelle-new
pnpm install
```

**Version verification:**
```bash
npm view typescript version   # 5.9.3
npm view vite version         # 8.0.1 (verify)
npm view preact version       # 10.29.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
paint-rebelle-new/src/
├── engine/
│   ├── types.ts           # Physics constants, layer types (EXISTING - use as-is)
│   ├── PhysicsEngine.ts   # Core typed arrays, physics loop
│   ├── BrushEngine.ts     # dH mask computation, 8 brush types
│   ├── PaintEngine.ts     # Canvas management, event handlers, render loop
│   └── ColorConverter.ts  # HSB/RGB utilities (EXISTING)
├── app.tsx                # Preact UI, toolbar, sliders
└── main.tsx               # Entry point
```

### Pattern 1: Dual-Layer Typed Array Physics
**What:** Two separate paint layers backed by typed arrays, operated on in the same pixel loop.
**When to use:** All physics computation in Phase 1.
**Source:** `js/rebelle-paint.js` lines 493-500 (array allocation), `q()` function (initialization)

```typescript
// Wet layer: Float32 precision for mixing
const wet = {
  r: new Float32Array(av),     // cA
  g: new Float32Array(av),     // cI
  b: new Float32Array(av),     // cL
  alpha: new Float32Array(av)  // cM
};

// Dry layer: Uint8 for composited RGB, Float32 for alpha
const dry = {
  r: new Uint8Array(av),       // cV
  g: new Uint8Array(av),       // c0
  b: new Uint8Array(av),       // c3
  alpha: new Float32Array(av)  // c4
};

// av = stride * (height + 2) = 902 * 452 = 407,704
// Confirmed from js/rebelle-paint.js line 411: av = a4 * a3
```

### Pattern 2: Canvas 2D Pixel Access (Processing.js to Vanilla)
**What:** Processing.js `loadPixels()` / `updatePixels()` / `pixels.getPixel()` / `pixels.setPixel()` pattern translated to vanilla `ImageData`.
**When to use:** Compositing wet/dry layers to canvas in dM() render function.
**Source:** `js/rebelle-paint.js` lines 403, 469, 618, 3433

```typescript
// Instead of Processing.js:
// bu.loadPixels();
// bu.pixels.setPixel(eO, argbValue);
// bu.updatePixels();

// Vanilla Canvas 2D:
const imageData = ctx.createImageData(stride, canvasHeight);
const pixels = imageData.data; // Uint8ClampedArray
// Set pixel at index i: pixels[i] = r, pixels[i+1] = g, pixels[i+2] = b, pixels[i+3] = a
ctx.putImageData(imageData, 0, 0);
```

### Pattern 3: Flow Field Transport with Bilinear Interpolation
**What:** Wet paint transport advects via velocity field dR/dQ using bilinear sampling from surrounding 4 pixels.
**When to use:** aO() and dT() functions for wet paint spreading.
**Source:** `js/rebelle-paint.js` lines 3043-3127 (dT function)

```typescript
// dT transport (lines 3043-3127):
// For each pixel (eT, eR) with velocity (d8, d6):
//   - Compute source coordinates: eK = eT - d8[eN], eJ = eR - d6[eN]
//   - Bilinear sample from 4 surrounding integer pixels
//   - Transport wet paint (cA, cI, cL, cM) and wetness (f) accordingly
//   - Clamp and normalize
```

### Pattern 4: Dirty Rect Optimization
**What:** Only process a sub-rectangle of pixels each frame instead of full canvas.
**When to use:** All physics loops (aO, ba, dT, b1, dl).
**Source:** `js/rebelle-paint.js` lines 2639-2651 (bL sets bounds)

```typescript
// aB=1, dP=bR=900 (x bounds), az=1, dO=bQ=450 (y bounds)
// bL() sets dirty rect for full canvas; incremental updates use dirty brush region
for (let y = az; y <= dO; y++) {
  for (let x = aB; x <= dP; x++) {
    const idx = x + y * a4;
    // process pixel
  }
}
```

### Pattern 5: Paper Texture Wrapping via Bitmask
**What:** 512x512 paper texture accessed with `& 511` (bitmask) instead of modulo for wrapping.
**When to use:** Flow field computation in aO(), roughness computation in x().
**Source:** `js/rebelle-paint.js` lines 461-462, 2892-2911

```typescript
const TEXTURE_SIZE = 512;
const TEXTURE_MASK = 511; // bitmask for wrapping
// Paper texture coordinate: (x & TEXTURE_MASK) + (y & TEXTURE_MASK) * TEXTURE_SIZE
```

### Pattern 6: Combined Brush Mask (dH = cp * aN)
**What:** Single dH array = circular falloff (cp) element-wise multiplied by brush texture (aN).
**When to use:** All 8 brush types use the same dH mask; only how dH is applied differs per brush.
**Source:** `js/rebelle-paint.js` line 817

```typescript
// Brush falloff computed first (cp), then texture applied:
// dH[c] = cp[c] * aN[c] * intensity;
// dH[c] = Math.min(1, Math.max(0, dH[c]));
```

### Pattern 7: Drying LUT (Two-Table System)
**What:** dL accumulates drying factor, ao is inverse mapping for lookup speed.
**When to use:** b1() drying function, dM() compositing.
**Source:** `js/rebelle-paint.js` lines 843-860 (cZ initialization), lines 1710-1725 (usage)

```typescript
// dL cumulative table (3001 elements):
dL[0] = 0;
for (let c = 1; c < cT + 1; c++) {
  dL[c] = 0.002 + dL[c - 1] * 0.998;  // accumulates toward 1.0
}

// ao inverse table:
ao[0] = 0;
for (let c = 1; c < cT + 1; c++) {
  const b = dL[c] * aU;  // aU = MAX_WETNESS = 3000
  ao[Math.floor(b)] = c;
}
```

### Anti-Patterns to Avoid
- **WebGL for initial port:** Processing.js uses Canvas 2D pixel arrays, not GPU. Stick to Canvas 2D.
- **Rewrite rather than port:** Two previous rewrite attempts failed. Faithful port first.
- **globalAlpha compositing:** Rebelle algorithm uses per-pixel density mixing (dL lookup), NOT ctx.globalAlpha. paint-studio-v9 uses globalAlpha but Rebelle does not.
- **Using paint-rebelle-new as implementation reference:** That attempt is broken (paper texture compositing was wrong). Use js/rebelle-paint.js as the single source of truth.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typed array physics | Custom array management | Float32Array/Uint8Array as specified | Performance-critical pixel loop requires typed arrays |
| Paper texture loading | Custom image loading | Canvas 2D `drawImage` + `getImageData` | Same red-channel sampling as Processing.js |
| Brush mask generation | Custom circular gradient | Compute cp from bJ + distance formula (line 795) | Original uses mirrored quadrant pattern |
| Drying simulation | Custom drying formula | dL LUT (cumulative) + ao (inverse) from dq() | Matches original behavior exactly |

---

## Common Pitfalls

### Pitfall 1: CANVAS_STRIDE Discrepancy
**What goes wrong:** Implementation uses wrong stride leading to pixel index misalignment.
**Why it happens:** Three conflicting values exist — 902 (original code), 904 (CONTEXT D-10 + types.ts), 902 (REQUIREMENTS.md).
**How to avoid:** Verify against original `js/rebelle-paint.js` line 409: `a4 = bR + 2`. Since bR=900, a4=902. The 904 value in CONTEXT and types.ts appears to be an error.
**Warning signs:** Paint appearing at wrong coordinates, physics breaking on resize.

### Pitfall 2: Processing.js Array vs Vanilla TypedArray
**What goes wrong:** `bD.createJavaArray("float", [av])` creates a regular JS array in Processing.js, but the equivalent in vanilla must be a true `Float32Array`.
**Why it happens:** Processing.js arrays have different behavior (auto-growing, different indexing).
**How to avoid:** Use explicit `new Float32Array(av)` for wet layer and flow fields. Use `new Uint8Array(av)` for dry layer RGB. Do NOT use `new Array(av)` or `[]`.
**Warning signs:** Extremely slow performance, wrong pixel values.

### Pitfall 3: Brush Texture Wrapping
**What goes wrong:** Paper texture coordinates not wrapping correctly, causing black edges.
**Why it happens:** Original uses `& ar` (bitmask) for wrapping, not `% b3` (modulo). Bitmask only works when dimension is power of 2 (512 = 2^9, ar = 511 = 2^9 - 1).
**How to avoid:** Use `& TEXTURE_MASK` (511) instead of `% TEXTURE_SIZE` (512). Only equivalent for power-of-2 sizes.
**Warning signs:** Paper texture shows dark seams at edges, brush behaves differently near canvas edges.

### Pitfall 4: Boundary Padding Off-by-One
**What goes wrong:** Physics computation writes to boundary pixels causing canvas edge artifacts.
**Why it happens:** Original uses `a4 = bR + 2` (902) and `a3 = bQ + 2` (452) for array dimensions with 1-pixel boundary. Loop iterates from 1 to bR/bQ.
**How to avoid:** Initialize all arrays fully. Physics loops use `for (x = 1; x <= bR; x++)` and `for (y = 1; y <= bQ; y++)` — NOT 0-based or full array bounds.
**Warning signs:** Paint bleeding off canvas edges, or strange artifacts at canvas perimeter.

### Pitfall 5: Wet/Dry Compositing Order
**What goes wrong:** Wet paint renders behind dry paint (visually incorrect watercolor layering).
**Why it happens:** Original dM() composites dry first (with paper roughness), then wet on top. Order matters.
**How to avoid:** Always composite dryLayer first, then wetLayer. The paper background is drawn once as a CSS/image background, not re-applied each frame.
**Warning signs:** Wet paint looks flat or wrong; watercolor spreading effect absent.

---

## Code Examples

### Array Index Computation (from bL/render)
```typescript
// Source: js/rebelle-paint.js lines 2644-2649
// Index into flat pixel array: x + y * stride
for (let y = 1; y <= bQ; y++) {
  const rowOffset = y * a4;
  for (let x = 1; x <= bR; x++) {
    const idx = x + rowOffset;
    // process physics at pixel (x, y)
  }
}
```

### Paper Texture Load (from ee/setup)
```typescript
// Source: js/rebelle-paint.js lines 543-552
// Red channel sampling with wrapping
for (let gy = 0; gy < 512; gy++) {
  for (let gx = 0; gx < 512; gx++) {
    const u = gx % paperImage.width;
    const c = gy % paperImage.height;
    const pixel = paperImage.pixels[u + c * paperImage.width];
    const value = (pixel >> 16 & 255) / 255; // red channel normalized to 0-1
    ae[gx + gy * 512] = value;
  }
}
```

### Brush Mask Generation (dH computation)
```typescript
// Source: js/rebelle-paint.js lines 813-820
// dH[c] = cp[c] * aN[c] * intensity
const intensity = 1.0; // Y = flowStrength = 0.8 from DEFAULT_PHYSICS
for (let i = 0; i < maskSize; i++) {
  dH[i] = cp[i] * aN[i] * intensity;
  dH[i] = Math.min(1, Math.max(0, dH[i]));
}
```

### Flow Field Computation (aO function excerpt)
```typescript
// Source: js/rebelle-paint.js lines 2912-2946
// Paper texture gradient influences flow direction
const bb = (f[idx - 1] - f[idx + 1]) * aE;  // wetness gradient X
const v = (f[idx - stride] - f[idx + stride]) * aE;  // wetness gradient Y
eK += Math.min(b7, Math.max(-b7, bb));  // add to velocity X
eT += Math.min(b7, Math.max(-b7, v));   // add to velocity Y
// Paper texture heightmap influence (if wetness below threshold):
if (ae[eX] > ae[eL]) {
  e1 = ae[eX] - ae[eV]; // texture gradient Y
}
// ...
eK += e2 * cz;  // add paper texture influence to velocity X
eT += e1 * cz;  // add paper texture influence to velocity Y
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Processing.js pixel arrays | Vanilla Canvas 2D ImageData | Phase 1 | No dependency on Processing.js |
| Java `createJavaArray()` | TypeScript `Float32Array`/`Uint8Array` | Phase 1 | True typed arrays for performance |
| Browser Processing.js lib | Native Canvas 2D API | Phase 1 | Full control, no abstraction layer |

**Deprecated/outdated:**
- `paint-rebelle-new/src/engine/` — Failed port attempt, broken paper texture compositing
- `paint-rebelle/` — First failed attempt
- Processing.js `pixels.getPixel()` / `pixels.setPixel()` — Replaced with direct `ImageData.data` access

---

## Open Questions

1. **CANVAS_STRIDE = 902 vs 904**
   - What we know: Original code shows `a4 = bR + 2 = 902`. CONTEXT D-10 says 904. types.ts says 904.
   - What's unclear: Which value was actually verified against the running original demo?
   - Recommendation: Run original demo, inspect pixel array size in browser DevTools before implementing. Set stride to 902 (matching original line 409) unless proven otherwise.

2. **UI Toolbar Implementation**
   - What we know: 24 Kontrol objects in original (D-01 says 5 core sliders for Phase 1: size, opacity, pressure, water amount, dry amount)
   - What's unclear: Should the toolbar be Preact components or plain HTML/CSS controls?
   - Recommendation: Plain HTML with event handlers mapped to PaintEngine API for Phase 1 simplicity.

3. **Responsive Canvas Scaling**
   - What we know: Original canvas element is 902x536, scaled via CSS to fit viewport with letterboxing.
   - What's unclear: Should physics canvas match CSS-scaled display size or fixed 902x536?
   - Recommendation: Fixed 902x536 canvas (matching original), CSS scales to fit with `object-fit: contain`. Mouse coordinates transformed to canvas space same as original index.html event handlers.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | yes | v22.22.1 | — |
| pnpm | Package management | yes | 10.28.0 | — |
| Vite | Dev server + build | yes | 8.0.1 | — |
| TypeScript | Type checking | yes | 5.9.3 | — |
| Browser | Canvas 2D API | yes | — | — |

**Missing dependencies with no fallback:**
- None identified. All required tools are available.

**Missing dependencies with fallback:**
- None identified.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (no test framework in paint-rebelle-new) |
| Config file | None |
| Quick run command | N/A — no test framework |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PHYS-01 | Dual-layer wet/dry arrays allocated correctly | Manual | N/A | N/A |
| PHYS-02 | Paper texture loads as 512x512 heightmap | Manual | N/A | N/A |
| PHYS-03 | Flow field creates visible capillary spreading | Manual | N/A | N/A |
| CANVAS-01 | Canvas responsive without breaking physics | Manual | N/A | N/A |
| CANVAS-02 | Canvas stride is 902 | Manual | N/A | N/A |
| LIB-02 | TypeScript compiles without errors | Automated | `tsc --noEmit` | Yes (existing) |
| DEMO-01 | Demo app loads and canvas is interactive | Manual | N/A | N/A |

### Sampling Rate
- **Per task commit:** N/A (no automated tests)
- **Per wave merge:** N/A
- **Phase gate:** Manual verification (D-03: side-by-side browser comparison)

### Wave 0 Gaps
- [ ] No test infrastructure exists in paint-rebelle-new
- [ ] Phase 1 relies on manual verification per D-03/D-04 (side-by-side browser tabs)
- [ ] If automated pixel verification is desired: consider adding a headless canvas test utility

---

## Sources

### Primary (HIGH confidence)
- `js/rebelle-paint.js` — Original Processing.js sketch, authoritative reference. Lines 400-450 (setup), 493-507 (array allocation), 541-640 (draw loop), 643-709 (dq physics constants), 712-737 (q reset), 2744-3152 (physics functions b1/aO/ba/dT/dl), 3297-3440 (dM render)
- `paint-rebelle-new/src/types.ts` — Physics constant values (DEFAULT_PHYSICS), layer type definitions

### Secondary (MEDIUM confidence)
- `index.html` — Original event handling and canvas sizing
- `paint-rebelle-new/src/engine/PhysicsEngine.ts` — Structure reference (broken but structure is informative)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified package versions from npm, already in paint-rebelle-new
- Architecture: HIGH — algorithm extracted directly from original minified JS with line references
- Pitfalls: HIGH — all pitfalls identified from known discrepancy (stride) and Processing.js-to-vanilla conversion patterns

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (algorithm is stable; only potential change is CANVAS_STRIDE resolution)
