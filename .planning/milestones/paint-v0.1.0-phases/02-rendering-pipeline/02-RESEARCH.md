# Phase 2: Rendering Pipeline - Research

**Researched:** 2026-03-29
**Domain:** Canvas 2D compositing, paint density transparency, wet paint diffusion/flow physics
**Confidence:** HIGH

## Summary

Phase 2 modifies `efx-paint-physic-v2.html` (the Phase 1 output, a single 1603-line HTML file) to achieve three goals: (1) replace the simple `wetAlpha/2000*240` alpha mapping in `compositeWetLayer()` with density-weighted per-pixel transparency, (2) make `flowStep()` produce visible stroke shape changes (paint spreading, gravity dripping) which currently does not happen visibly despite the code existing, and (3) decouple paper heightmap from background visibility so painting on transparent background still gets paper-grain-influenced physics, plus verify the paper selector works correctly with the new pipeline.

The implementation target is a single HTML file (`efx-paint-physic-v2.html`), not TypeScript modules. All changes are in vanilla JS within this file. The key functions to modify are `compositeWetLayer()` (line 1257), `flowStep()` (line 1090), `drawBg()` (line 1301), and possibly `dryStep()` (line 1022) for density integration.

**Primary recommendation:** Implement density-weighted alpha as a logarithmic curve mapping wetAlpha to display alpha (replacing the linear 2000->240 mapping), fix flow visibility by increasing effective flow rates and ensuring the flow/dry cycle runs automatically or with stronger per-tick effect, and decouple `paperHeight` from `bgMode` so it persists independently of background display choice.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep dual-canvas overlay approach (main canvas = dry + background, displayCanvas = wet overlay via CSS z-index). Current approach works and doesn't need refactoring to single-canvas merge.
- **D-02:** Fix flow/diffusion visibility -- currently strokes keep their shape, wet paint doesn't visibly spread. Flow physics exists in code (`flowStep()`) but isn't producing visible shape changes. This is included in Phase 2 scope.
- **D-03:** Paper texture is NOT double-applied -- current separation is correct. Paper heightmap influences physics (flow direction, drying modulation), paper image is visual background only. No change needed here.
- **D-04:** Paper grain (heightmap) must be decoupled from background visibility. When painting on transparent background, paper grain STILL influences flow, drying, and emboss in the paint strokes. User gets watercolor-look strokes on transparent canvas.
- **D-05:** Paper selector and background mode are two separate controls: Paper selector picks grain/heightmap for physics (always active). Background toggle: transparent or show paper image. Default state: paper background visible.
- **D-06:** Changing paper mid-session: new strokes use the new paper heightmap, old dried strokes remain unchanged. No visual reset when switching papers or background mode.
- **D-07:** Transparency uses density-driven model -- paint alpha comes from accumulated pigment density at each pixel. Light strokes = transparent washes, heavy strokes = opaque coverage. Overlapping strokes build up density naturally.
- **D-08:** NOT globalAlpha-based -- per-pixel density calculation replaces the current simple `wetAlpha/2000*240` mapping.
- **D-09:** Light washes show paper texture through the paint -- thin deposits are semi-transparent, revealing paper grain underneath. Heavier deposits cover more paper. Classic watercolor look.
- **D-10:** Paper selector UI already exists with 3 papers. Phase 2 just verifies it works correctly with the new pipeline -- switching papers updates both visual background AND physics heightmap.

### Claude's Discretion
- Exact density-to-alpha mapping curve (linear, logarithmic, or custom)
- Flow/diffusion tuning constants (threshold, fraction, gravity bias values)
- Implementation details for decoupling paper heightmap from background mode
- Whether `ensureHeightMap()` procedural fallback needs adjustment

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RENDER-01 | Multi-layer compositing pipeline (dryLayer + wetLayer -> canvas, paper as background only -- NOT double-applied) | Dual-canvas architecture already correct (D-01, D-03). Key work: decouple paperHeight from bgMode (D-04/D-05), density-weighted alpha in compositeWetLayer() |
| RENDER-02 | Transparency support via density-weighted blending (NOT globalAlpha -- from paint-studio-v9) | Replace linear wetAlpha/2000*240 mapping with logarithmic density curve. paint-studio-v9 uses layered polygon fills with `lAlpha` accumulation -- concept translates to wetAlpha density mapping |
| DEMO-03 | Paper texture selector (paper_1.jpg, paper_2.jpg, paper_3.jpg) | UI exists (`.bgb` buttons with `data-bg`). Needs: separate paper physics selector, verify heightmap updates on switch, test with new compositing |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Single HTML file target**: `efx-paint-physic-v2.html` -- no TypeScript modules until Phase 5
- **Canvas 2D only**: No WebGL
- **No Processing.js dependency**: Vanilla JS/Canvas 2D
- **Package name**: `@efxlab/efx-physic-paint` -- no "rebelle" or "Rebelle" in identifiers
- **Paper textures**: Must load and composite `paper_N.jpg` images
- **GSD workflow**: All edits go through GSD commands

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2023 | All implementation | Single HTML file, no build step |
| Canvas 2D API | Browser native | Rendering, compositing, pixel manipulation | Project constraint -- no WebGL |
| ImageData API | Browser native | Per-pixel alpha/color manipulation | Core of compositing and density calculations |

### Supporting
No external libraries needed. This phase is purely Canvas 2D pixel manipulation within the existing `efx-paint-physic-v2.html` file.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-pixel ImageData loop | OffscreenCanvas + composite modes | Canvas composite modes (multiply, overlay) can't express density-weighted alpha; per-pixel control is required |
| JS Array for wet layer | Float32Array | Current JS arrays give 64-bit float precision needed for color blending; no change needed |

## Architecture Patterns

### Current File Structure (single HTML file)
```
efx-paint-physic-v2.html
  Lines 1-100     : HTML + CSS (UI, canvas elements, toolbar)
  Lines 100-140   : Canvas setup, globals (W, H, tool, bgMode)
  Lines 140-200   : Paper texture loading (base64), heightmap extraction
  Lines 200-400   : Utility functions (math, color, curve, polygon)
  Lines 400-540   : Stroke rendering (paint, single-color, emboss)
  Lines 540-640   : Brush deposition (depositBrushToWetLayer)
  Lines 640-700   : Transfer functions (offscreen -> wet layer arrays)
  Lines 700-830   : Stroke rendering with pickup, emboss
  Lines 830-1015  : Smudge, liquify, mix tools
  Lines 1015-1065 : Drying simulation (dryStep)
  Lines 1065-1175 : Flow/diffusion simulation (flowStep)
  Lines 1175-1200 : Physics step, dry presets (startDry)
  Lines 1200-1260 : Brush cursor, stroke preview
  Lines 1257-1295 : WET LAYER COMPOSITING (compositeWetLayer) [KEY TARGET]
  Lines 1298-1330 : Background rendering (drawBg) [KEY TARGET]
  Lines 1330-1600 : Undo, event handlers, UI wiring
```

### Pattern 1: Density-Weighted Alpha Mapping
**What:** Replace linear `wetAlpha/2000*240` with a curve that maps accumulated pigment density to display alpha
**When to use:** In `compositeWetLayer()` for wet paint display, and conceptually consistent with `dryStep()` baking

**Current code (line 1280):**
```javascript
let alpha = Math.min(240, (wetAlpha[i] / 2000) * 240);
```

**Problem:** Linear mapping means all strokes look similar opacity. Light washes aren't translucent enough, and heavy deposits don't reach full coverage fast enough.

**Recommended replacement -- logarithmic density curve:**
```javascript
// Density-weighted alpha: logarithmic curve for natural watercolor look
// Light deposits (wetAlpha < 500): very transparent (washes)
// Medium deposits (500-2000): builds naturally
// Heavy deposits (>2000): approaches opaque
const density = wetAlpha[i] / 3000; // normalize to 0-1 (3000 = MAX_WETNESS)
const alpha = Math.min(245, Math.round(255 * (1 - Math.exp(-density * 4))));
```

**Why logarithmic:** Natural pigment absorption follows Beer-Lambert law -- opacity increases exponentially with pigment concentration, producing `1 - exp(-k*d)` curve. This gives transparent washes at low density and asymptotic approach to full opacity at high density. The constant `4` controls steepness (higher = faster approach to opaque).

**Tuning range (Claude's discretion):**
- Steepness constant `k`: 3-6 range. k=3 gives very gradual washes, k=6 gives faster buildup
- Max alpha cap: 240-250 range. Never fully 255 to maintain slight translucency feel
- Threshold: can skip pixels below density 0.001 for performance

### Pattern 2: Paper Heightmap Decoupling
**What:** Separate paper heightmap (physics) from paper background image (display)
**When to use:** When user selects transparent/white background but wants paper-textured strokes

**Current problem (drawBg, line 1301-1325):**
```javascript
// When bgMode is 'transparent' or 'white':
texHeight=null; paperHeight=null;  // <-- DESTROYS physics heightmap!
```

**Fix architecture -- two independent state variables:**
```javascript
// NEW: physicsHeightMap -- persists regardless of background mode
let physicsHeightMap = null;  // Float32Array W*H, selected by paper selector
let currentPaperKey = null;   // tracks which paper is active for physics

// EXISTING: paperHeight -- alias used by flowStep/dryStep/emboss
// Set paperHeight = physicsHeightMap at physics time, regardless of bgMode

// drawBg() changes: ONLY affect visual background, NOT paperHeight
function drawBg() {
  X.clearRect(0,0,W,H);
  if (bgMode === 'white') {
    X.fillStyle='#fff'; X.fillRect(0,0,W,H);
  } else if (bgMode.startsWith('canvas')) {
    // Draw paper image as visual background
    const tex = paperTextures[bgMode];
    if (tex) {
      X.fillStyle='#fff'; X.fillRect(0,0,W,H);
      X.globalAlpha=0.18;
      X.drawImage(tex.tiledCanvas, 0, 0);
      X.globalAlpha=1.0;
    }
  }
  // else transparent -- just clear

  // REMOVED: no longer touching paperHeight here
  bgCtx.drawImage(C,0,0); bgData=bgCtx.getImageData(0,0,W,H);
}
```

**Paper selector becomes independent control:**
```javascript
// Paper physics selector -- always active, separate from background
function setPaperPhysics(paperKey) {
  const tex = paperTextures[paperKey];
  if (tex && tex.height) {
    physicsHeightMap = tex.height;
    currentPaperKey = paperKey;
  }
  paperHeight = physicsHeightMap; // update alias used by flow/dry/emboss
}
```

### Pattern 3: Flow Visibility Fix
**What:** Make flowStep() produce visible stroke shape changes
**When to use:** During physics simulation (currently runs at 10fps via setInterval)

**Current problem analysis:**
The flow step exists (line 1090) with tuned constants (FLOW_THRESHOLD=15, FLOW_FRACTION=0.025, GRAVITY_BIAS=0.04), but visual inspection shows strokes don't change shape. Root causes:

1. **Wetness cap too low for flow to activate:** `transferToWetLayer()` caps wetness at 1000 (line 663), but `FLOW_THRESHOLD=15` and `flowAmt = FLOW_FRACTION * (wetness / 1000)` means even at max wetness, flowAmt = 0.025 -- only 2.5% of paint moves per tick. At 10fps this is ~25% per second, spread across 4 neighbors.

2. **wetAlpha cap at 3000 in flow (line 1163):** `wetAlpha[nIdx] = Math.min(3000, newA)` -- but `transferToWetLayer()` allows up to 200000 (line 649). The flow step's 3000 cap means paint that flows into a neighbor gets hard-clamped, losing mass.

3. **Checkerboard pattern skips half pixels each tick:** Only even/odd pixels processed per tick, so effective rate is halved.

4. **Transport velocity bug (from memory):** The full velocity-based transport system was disabled because velocity accumulates without damping. The current `flowStep()` is a simpler diffusion model (no velocity field), which is correct but weaker.

**Recommended fixes:**
```javascript
// 1. Increase flow fraction for visible spreading
FLOW_FRACTION = 0.06;  // ~6% per tick, ~60% per second

// 2. Remove wetAlpha cap in flow or raise significantly
wetAlpha[nIdx] = Math.min(200000, newA);  // match deposit cap

// 3. Lower flow threshold
FLOW_THRESHOLD = 8;  // allow wetter pixels to spread sooner

// 4. Add wetness diffusion (not just paint transport)
// When paint flows, wetness should also spread, creating the
// "bleeding" effect where water front advances ahead of pigment

// 5. Consider running flow step multiple times per physics tick
// for stronger visible effect (2-3 iterations)
```

**Important constraint from debug history:** Do NOT re-enable the velocity-based transport system. The simpler neighbor-diffusion approach in current `flowStep()` is the right model. Just strengthen its parameters.

### Anti-Patterns to Avoid
- **globalAlpha compositing:** Don't use `ctx.globalAlpha` for paint transparency -- this is explicitly rejected (D-08). Per-pixel density is required.
- **Destroying paperHeight on background switch:** Current `drawBg()` sets `paperHeight=null` when switching to transparent/white. This breaks flow/drying physics.
- **Re-enabling velocity transport:** The transport system was disabled for good reason (velocity runaway bug). Stay with the diffusion-based flow model.
- **Full-canvas ImageData scan every frame:** `compositeWetLayer()` already has a sparse check (every 64th pixel). Preserve this optimization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alpha compositing math | Custom blending formulas | Porter-Duff "over" operator: `oa = sa + da*(1-sa)`, `bt = sa/oa` | Standard compositing math, already used in dryStep |
| Density-to-alpha curve | Lookup table from scratch | `1 - exp(-k*d)` (Beer-Lambert) | Physically motivated, single formula, tunable via k |
| Paper texture tiling | Manual pixel copying | Canvas `drawImage` with pattern repeat | Already implemented via `tiledCanvas` in paperTextures |

**Key insight:** The compositing math (Porter-Duff over operator) is already correctly implemented in `dryStep()` (lines 1046-1051). The wet layer compositing should use the same math but with density-weighted source alpha.

## Common Pitfalls

### Pitfall 1: Density Alpha Too Steep
**What goes wrong:** If the exponential curve is too steep (k > 6), even light strokes appear nearly opaque, losing the watercolor wash effect.
**Why it happens:** `1 - exp(-6 * 0.3)` = 0.83 (83% opaque at just 30% density). The curve saturates too fast.
**How to avoid:** Start with k=3.5, test with single light strokes. A proper wash should be ~30-40% opaque on first pass.
**Warning signs:** No visible difference between 1-stroke and 3-stroke overlap areas.

### Pitfall 2: paperHeight Null After Background Switch
**What goes wrong:** User selects transparent background, paperHeight becomes null, flow stops working, drying loses paper modulation. Strokes look flat.
**Why it happens:** Current `drawBg()` sets `paperHeight=null` for transparent/white modes.
**How to avoid:** Decouple paperHeight from bgMode entirely. Use a separate `physicsHeightMap` that persists.
**Warning signs:** After switching to transparent mode, dry presets produce uniform drying (no paper texture variation).

### Pitfall 3: Flow wetAlpha Cap Mismatch
**What goes wrong:** Paint deposited with wetAlpha up to 200000 flows to neighbor, but neighbor gets capped at 3000. Mass is lost during flow, paint disappears.
**Why it happens:** `transferToWetLayer()` uses cap 200000 but `flowStep()` uses cap 3000.
**How to avoid:** Use consistent cap across deposit, flow, and compositing. The cap should be the same everywhere (suggest 200000 for deposit storage, normalize in compositing).
**Warning signs:** Paint gets lighter/thinner after flowing, instead of just spreading.

### Pitfall 4: Checkerboard Flow Creates Visual Banding
**What goes wrong:** Processing even/odd pixels alternately creates a visible checkerboard pattern in the flow, especially on solid color areas.
**Why it happens:** Half-pixel skip means adjacent pixels get different amounts of flow per tick.
**How to avoid:** After increasing flow strength, check for banding artifacts. If visible, switch to processing all pixels but with halved flow rate, or use red-black ordering that alternates per-row.
**Warning signs:** Diagonal striping or grid pattern in flowing paint areas.

### Pitfall 5: Background State Confusion on Paper Switch
**What goes wrong:** User clicks paper_2 button expecting physics change, but it also changes the visual background (or vice versa).
**Why it happens:** Current UI conflates paper physics selection with background display selection.
**How to avoid:** D-05 specifies two separate controls. When implementing, the paper buttons (data-bg="canvas1/2/3") need to be split into: (a) paper physics selector (always updates heightmap) and (b) background display toggle (transparent vs show paper).
**Warning signs:** Clicking "transparent" background removes paper texture influence from physics.

## Code Examples

### Density-Weighted compositeWetLayer()
```javascript
// Source: Analysis of efx-paint-physic-v2.html line 1257-1293
// Replaces: let alpha = Math.min(240, (wetAlpha[i] / 2000) * 240);
function compositeWetLayer() {
  displayCtx.clearRect(0, 0, W, H);

  let hasWet = false;
  for (let i = 0; i < W * H; i += 64) {
    if (wetAlpha[i] > DRY_ALPHA_THRESHOLD) { hasWet = true; break; }
  }

  if (!hasWet) {
    drawStrokePreview();
    drawBrushCursor();
    requestAnimationFrame(compositeWetLayer);
    return;
  }

  const id = displayCtx.createImageData(W, H);
  const d = id.data;
  const DENSITY_K = 3.5; // steepness: 3=gradual washes, 6=fast buildup
  const MAX_DISPLAY_ALPHA = 245;

  for (let i = 0; i < W * H; i++) {
    if (wetAlpha[i] < DRY_ALPHA_THRESHOLD) continue;

    // Density-weighted alpha: Beer-Lambert absorption model
    const density = wetAlpha[i] / 3000; // normalize (3000 = single full deposit)
    const alpha = Math.min(MAX_DISPLAY_ALPHA,
      Math.round(255 * (1 - Math.exp(-DENSITY_K * density))));

    const pi = i * 4;
    d[pi]     = Math.round(clamp(wetR[i], 0, 255));
    d[pi + 1] = Math.round(clamp(wetG[i], 0, 255));
    d[pi + 2] = Math.round(clamp(wetB[i], 0, 255));
    d[pi + 3] = alpha;
  }

  displayCtx.putImageData(id, 0, 0);
  drawStrokePreview();
  drawBrushCursor();
  requestAnimationFrame(compositeWetLayer);
}
```

### Decoupled Paper Heightmap Architecture
```javascript
// Source: Analysis of efx-paint-physic-v2.html drawBg() line 1301
// New globals alongside existing ones
let physicsHeightMap = null;  // persists across background changes
let currentPaperKey = 'canvas1'; // default paper for physics

// Called when user selects a paper texture for physics
function setPaperPhysics(key) {
  const tex = paperTextures[key];
  if (tex && tex.height) {
    physicsHeightMap = tex.height;
    currentPaperKey = key;
    paperHeight = physicsHeightMap; // alias for flow/dry/emboss
  }
}

// Modified drawBg() -- visual only, never touches paperHeight
function drawBg() {
  X.clearRect(0, 0, W, H);
  if (bgMode === 'white') {
    X.fillStyle = '#fff'; X.fillRect(0, 0, W, H);
  } else if (bgMode.startsWith('canvas')) {
    const tex = paperTextures[bgMode];
    if (tex) {
      X.fillStyle = '#fff'; X.fillRect(0, 0, W, H);
      X.globalAlpha = 0.18;
      X.drawImage(tex.tiledCanvas, 0, 0);
      X.globalAlpha = 1.0;
    }
  }
  // transparent: just cleared canvas
  bgCtx.drawImage(C, 0, 0);
  bgData = bgCtx.getImageData(0, 0, W, H);
}

// Initialize: set default paper physics on load
// (after paper textures are loaded)
setPaperPhysics('canvas1');
```

### Strengthened Flow Parameters
```javascript
// Source: Analysis of efx-paint-physic-v2.html flowStep() line 1090
// Current vs recommended constants:
// FLOW_THRESHOLD: 15 -> 8  (allow more pixels to participate)
// FLOW_FRACTION: 0.025 -> 0.06 (stronger per-tick spreading)
// GRAVITY_BIAS: 0.04 -> 0.06 (more visible dripping)

// Also fix wetAlpha cap in flow neighbor transfer:
// Current: wetAlpha[nIdx] = Math.min(3000, newA);
// Fix:     wetAlpha[nIdx] = Math.min(200000, newA); // match deposit cap
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `wetAlpha/2000*240` linear | Density-weighted `1-exp(-k*d)` | Phase 2 | Transparent washes, natural buildup |
| paperHeight tied to bgMode | Decoupled physicsHeightMap | Phase 2 | Paper physics works on any background |
| Flow diffusion (weak params) | Stronger flow constants | Phase 2 | Visible stroke shape changes |

**Deprecated/outdated:**
- Velocity-based transport: Disabled in Phase 1 due to velocity accumulation bug. Current diffusion model is the replacement.
- Processing.js pixel array patterns: Abandoned in Phase 1. All code is vanilla Canvas 2D.

## Open Questions

1. **Density normalization constant**
   - What we know: wetAlpha ranges from 0-200000 (deposit cap), single full deposit is ~3000, compositing currently normalizes by 2000
   - What's unclear: Should density normalization use 3000 (single stroke reference) or a higher value to account for multi-stroke accumulation?
   - Recommendation: Start with 3000 as the normalization reference (= "one full brush deposit"). Multi-stroke overlap naturally exceeds 1.0 density, which the exponential curve handles gracefully (asymptotic approach to max alpha).

2. **Flow step iteration count**
   - What we know: Physics runs at 10fps (100ms interval), flow processes half pixels per tick via checkerboard
   - What's unclear: Will strengthened constants alone produce visible flow, or do we need multiple iterations per physics tick?
   - Recommendation: Start with strengthened constants (single iteration). If flow is still not visible, add `itersPerTick` parameter to `physicsStep()` (the `startDry()` function already supports this).

3. **Paper selector UI split**
   - What we know: D-05 says paper selector and background mode are two separate controls. Currently they're combined (clicking a paper button sets both background and physics)
   - What's unclear: Should this be two rows of buttons, or a dropdown + toggle?
   - Recommendation: Add a separate "Paper grain" row of buttons (paper_1, paper_2, paper_3) that only affect physics. The existing background row keeps its current behavior for visual display. When a canvas background is selected, it auto-selects the matching paper grain.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies -- all changes are to a single HTML file using vanilla JS and Canvas 2D browser APIs)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no automated test infrastructure |
| Config file | none -- see Wave 0 |
| Quick run command | Manual visual testing in browser |
| Full suite command | Manual visual testing in browser |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RENDER-01 | Wet + dry layers composite correctly, paper as background only | manual-only | Open v2.html, paint strokes, verify layer ordering | N/A |
| RENDER-02 | Density-weighted transparency (light washes translucent, heavy opaque) | manual-only | Paint single light stroke (low opacity), verify paper shows through. Overlay 3+ strokes, verify buildup | N/A |
| DEMO-03 | Paper selector cycles through 3 papers, updates both visual + physics | manual-only | Click each paper button, verify background changes AND flow behavior changes | N/A |

**Manual-only justification:** This is a visual rendering project in a single HTML file with no build system or test framework. The output is visual fidelity (watercolor appearance), which cannot be meaningfully automated. Phase 5 will introduce the test framework alongside TypeScript modularization.

### Sampling Rate
- **Per task commit:** Open `efx-paint-physic-v2.html` in browser, paint test strokes, visually verify
- **Per wave merge:** Full manual test of all 3 requirements
- **Phase gate:** Visual verification of all success criteria before `/gsd:verify-work`

### Wave 0 Gaps
None -- manual visual testing is the appropriate method for this phase. No automated test infrastructure to set up.

## Sources

### Primary (HIGH confidence)
- `efx-paint-physic-v2.html` (1603 lines) -- Full source code audit of compositeWetLayer, flowStep, dryStep, drawBg, transferToWetLayer, paper texture loading
- `efx-paint-physic-v1.html` (1295 lines) -- Phase 1 baseline, same architecture with original constants
- `paint-studio-v9.html` (924 lines) -- Reference for polygon-based brush rendering, layered alpha accumulation pattern, wet composite blending
- `efx-paint-physic-v1.md` -- Architecture notes and design decisions from Phase 1
- `.planning/phases/01-algorithm-port-foundation/01-CONTEXT.md` -- Phase 1 locked decisions
- `paint-rebelle-new/src/types.ts` -- TypeScript type definitions (documentation contract)

### Secondary (MEDIUM confidence)
- Beer-Lambert absorption law for density-to-alpha mapping -- standard physics, well-established for pigment simulation
- Porter-Duff compositing operators -- already correctly implemented in dryStep, extending to compositeWetLayer

### Tertiary (LOW confidence)
- Memory: transport-velocity-bug -- Debug finding about velocity accumulation. Relevant as a constraint (don't re-enable transport), but the specific damping values in the recommendation are untested

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external dependencies, all Canvas 2D native APIs
- Architecture: HIGH -- full source code audit of all relevant functions, clear modification targets
- Pitfalls: HIGH -- identified from actual code analysis (cap mismatches, null assignments, parameter analysis)
- Density curve: MEDIUM -- Beer-Lambert is well-motivated but the exact k constant needs tuning
- Flow fix: MEDIUM -- parameter changes are informed by code analysis but visual results need empirical tuning

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- single HTML file, no external dependency changes)
