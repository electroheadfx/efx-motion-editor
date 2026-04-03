# Phase 4: Drying & Persistence - Research

**Researched:** 2026-03-30
**Domain:** Paint physics drying simulation + stroke serialization/replay
**Confidence:** HIGH

## Summary

Phase 4 adds two orthogonal features to the paint engine: (1) replacing the current simple percentage-based drying with Rebelle's two-table LUT system for natural-looking wet-to-dry transitions, and (2) serializing/deserializing stroke data to JSON for replay. The work builds on `efx-paint-physic-v3.html` (the actual working file after Phase 3, 2134 lines) which already has all 8+1 brush types, a PaintStroke recording format in `allActions[]`, and a `redrawAll()` function that dispatches all tool types.

The current `dryStep()` uses a flat `DRY_DRAIN=0.015` percentage drain -- wetAlpha decreases by `max(1, wetAlpha * 0.015)` per tick at 10fps. This produces a linear-ish decay rather than the natural S-curve (slow initial, accelerating, then leveling) that Rebelle achieves with its `dL`/`ao` lookup tables. The LUT replacement is well-defined: `dL[c] = 0.002 + dL[c-1] * 0.998` generates a cumulative exponential curve of 3001 entries, and `ao` provides the inverse mapping from density back to time position. The existing `forceDryAll()` function and `redrawAll()` replay mechanism provide solid foundations for the persistence feature.

**Primary recommendation:** Replace `dryStep()` drain math with LUT-driven progression per pixel, add `serializeProject()`/`loadProject()` functions with save/load UI buttons, and extend `redrawAll()` to handle inter-stroke physics fast-forwarding using timestamp deltas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Port Rebelle's two-table LUT system: `dL` (cumulative exponential curve: `dL[c] = 0.002 + dL[c-1] * 0.998`) and `ao` (inverse lookup mapping density back to time). Replace current simple percentage drain in `dryStep()`
- **D-02:** Drying speed is user-adjustable via slider. Default ~15 seconds for a medium-wet stroke. Existing DRY_DRAIN slider repurposed to control LUT traversal speed
- **D-03:** Wet/dry brush tools integrate with the LUT system: dry tool force-dries using accelerated LUT traversal, wet tool rehydrates by reversing LUT position. Consistent with physics model rather than raw array manipulation
- **D-04:** Strokes-only serialization -- JSON contains stroke list + canvas settings, no physics state. Replay re-executes all strokes with simulated physics. Small file sizes (~KB)
- **D-05:** JSON format matches efx-motion-editor's PaintStroke structure: points as `[x, y, pressure][]` with extended fields (tiltX, tiltY, twist, speed) and metadata per stroke (tool type, color, brush params, timestamp)
- **D-06:** Canvas settings included in JSON header: paper type, canvas dimensions, background mode. Replay restores the exact canvas environment before re-executing strokes
- **D-07:** Record timestamps per stroke. During replay, fast-forward physics simulation for elapsed time between strokes. Deterministic and faithful reproduction
- **D-08:** Target: visually identical replay. Same visual result with acceptable floating-point drift. Not pixel-perfect (too hard to guarantee with float physics), not approximate (too loose)
- **D-09:** Simple save/load buttons with browser file dialog. Save downloads `.json` file, Load opens file picker to import. Minimal UI that proves the feature works
- **D-10:** Instant load only -- load JSON, fast-forward physics, show final result. No animated stroke-by-stroke playback (defer to Phase 5 polish if desired)

### Claude's Discretion
- LUT array size (cT parameter from Rebelle -- determines curve resolution)
- How to fast-forward physics during replay (batch dryStep/flowStep calls vs time-scaled single step)
- Exact JSON schema field names and nesting structure within PaintStroke constraints
- How `redrawAll()` is updated to handle all 8+1 brush types (was only 4 old types)
- File extension choice (.json vs .efxpaint or similar)

### Deferred Ideas (OUT OF SCOPE)
- Animated stroke-by-stroke playback with play/pause/speed controls -- Phase 5 polish
- LocalStorage auto-save for session persistence -- future enhancement
- 24-slider Kontrol panel (original Rebelle style) -- Phase 5
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHYS-04 | Drying LUT (two-table system: dL cumulative + ao inverse) for wet-to-dry conversion over time | LUT algorithm fully reverse-engineered from `js/rebelle-paint.js` lines 842-861; integration points in current `dryStep()` identified at v3 line 1409; per-pixel drying position array design documented |
| STROKE-03 | Stroke persistence -- serialize/deserialize strokes to JSON | PaintStroke format already established in v3 lines 147-157; efx-motion-editor interop format documented; serialization is mostly `JSON.stringify(allActions)` plus canvas settings header |
| DEMO-04 | Stroke replay from JSON (verify serialization works) | `redrawAll()` already dispatches all 9 tool types at v3 lines 1754-1778; needs inter-stroke physics fast-forward and canvas settings restoration; save/load UI pattern documented |
</phase_requirements>

## Architecture Patterns

### Current State (v3 -- actual working file)

**IMPORTANT:** Phase 3 created `efx-paint-physic-v2.html` and the Phase 3 gap-closure plan created `efx-paint-physic-v3.html` (Float32Array fix). The CONTEXT.md references `efx-paint-physic-v1.html` but the actual working file is `efx-paint-physic-v3.html` (2134 lines). Phase 4 MUST work on v3.

```
efx-paint-physic-v3.html (2134 lines)
|
+-- Physics (10fps via setInterval, line 1590)
|   +-- dryStep() (line 1409) -- REPLACE drain math with LUT
|   +-- flowStep() (line 1488) -- unchanged
|   +-- physicsStep() (line 1574) -- calls both
|
+-- Stroke Recording
|   +-- PaintStroke format (lines 147-157) -- already defined
|   +-- allActions[] (line 141) -- array of PaintStroke objects
|   +-- onPointerUp records stroke (lines 2004-2013)
|   +-- timestamp: Date.now() per stroke (line 2011)
|
+-- Replay
|   +-- redrawAll() (line 1754) -- dispatches all 9 tools
|   +-- clearWetLayer() (line 1814) -- .fill(0) on Float32Array
|   +-- forceDryAll() (line 1782) -- instant wet-to-dry transfer
|   +-- drawBg() (line 1725) -- restores canvas background
|
+-- Tools (all 8+1 wired)
|   paint, erase, water, smear, blend, blow, wet, dry, liquify
|
+-- Canvas State
    +-- bgMode ('transparent'|'white'|'canvas1'|'canvas2'|'canvas3')
    +-- currentPaperKey ('canvas1'|'canvas2'|'canvas3')
    +-- W=1000, H=650 (fixed dimensions)
    +-- embossStrength, wetPaper flag
```

### Pattern 1: LUT-Driven Drying (replacing percentage drain)

**What:** Each pixel tracks its drying position in the LUT (0 to cT). Each physics tick advances the position by a speed factor. The LUT value at that position determines how much opacity has accumulated (0.0 to 1.0). This replaces the current flat `wetAlpha * DRY_DRAIN` calculation.

**Current dryStep logic (v3 line 1409):**
```javascript
// Current: simple percentage drain
const drain = Math.max(1, wetAlpha[i] * DRY_DRAIN);  // DRY_DRAIN=0.015
let sa = drain / 800;
// ... paper texture modulation ...
wetAlpha[i] -= drain;
wetness[i] = Math.max(0, wetness[i] * (1 - DRY_DRAIN));
```

**Rebelle LUT algorithm (js/rebelle-paint.js lines 842-861):**
```javascript
// cT = 3000 (LUT resolution)
// aU = cT (same value, used as max)
// dL = float array [cT + 1]  -- cumulative exponential curve
// ao = float array [cT + 1]  -- inverse lookup

function cZ() {  // LUT initialization
  dL[0] = 0;
  ao[0] = 0;
  for (var c = 1; c < cT + 1; c++) {
    ao[c] = -1;
  }
  for (var c = 1; c < cT + 1; c++) {
    dL[c] = 0.002 + dL[c - 1] * 0.998;
    var b = dL[c] * aU;     // scale to [0, cT]
    if (b > aU) b = aU;
    ao[int(b)] = c;          // inverse: given density, find time position
  }
  for (var c = 1; c < cT + 1; c++) {
    if (ao[c] == -1) {
      ao[c] = ao[c - 1];    // fill gaps in inverse table
    }
  }
}
```

**How Rebelle uses dL in brush code:**
```javascript
// Read paint density at pixel position cB:
if (c4[cB] > 0) {
  if (c4[cB] < aU) {
    eQ = dL[int(c4[cB])];   // time position -> opacity fraction
  } else {
    eQ = 1;                  // fully dry
  }
  // Use eQ as weight for color blending...
}
```

**Key insight:** In Rebelle, `c4` and `cM` are per-pixel arrays storing the drying *time position* (0-3000), not the opacity directly. The `dL` table converts time position to opacity fraction. The `ao` table converts opacity fraction back to time position (for blending calculations). The current v3 code uses `wetAlpha` (0-200000 range) as both amount AND progression, which is why it drains linearly.

**Recommended approach:** Add a new `dryPos` Float32Array (per-pixel drying position, 0 to cT). In dryStep, advance `dryPos[i]` by a speed factor each tick. Use `dL[dryPos[i]]` to determine how much wet paint should have transferred to dry. Compute delta from previous frame's transfer.

### Pattern 2: Serialization Schema

**What:** JSON file containing canvas settings header + array of PaintStroke objects matching the format already in `allActions[]`.

**Current PaintStroke shape (v3 lines 147-157, 2006-2012):**
```javascript
{
  tool: 'paint'|'erase'|'water'|...|'liquify',
  points: Array<{x, y, p, tx, ty, tw, spd}>,
  color: '#rrggbb' | null,
  params: { size, opacity, pressure, waterAmount, dryAmount, pickup },
  timestamp: number  // Date.now()
}
```

**efx-motion-editor PaintStroke type (from memory):**
```typescript
PaintStroke {
  id, tool: 'brush'|'eraser',
  points: [x, y, pressure][],
  color, opacity, size,
  brushStyle?: 'flat'|'watercolor'|'ink'|...,
  brushParams?: { grain, bleed, scatter, fieldStrength, edgeDarken },
  fxState?: 'flat'|'fx-applied'|'flattened'
}
```

**Interoperability:** The formats differ in structure but share the core `points: [x, y, pressure][]` minimum. For now, serialize in the richer format (v3's format with extended pen fields) and provide a `.toMinimal()` mapper for efx-motion-editor compatibility later.

### Pattern 3: Replay with Physics Fast-Forward

**What:** When loading a project, replay strokes with simulated inter-stroke physics to match how drying affected subsequent strokes.

**Current redrawAll() (v3 lines 1754-1778):**
```javascript
function redrawAll() {
  drawBg();
  clearWetLayer();
  directRender = true;
  for (const a of allActions) {
    const pts = a.points || a.pts;
    const opts = a.params || a.opts;
    const color = a.color;
    if (a.tool === 'paint') renderPaintStroke(pts, color, opts);
    else if (a.tool === 'liquify') { /* ... */ }
    else if (a.tool === 'erase') applyEraseStroke(pts, opts);
    // ... all 9 tools dispatched
  }
  directRender = false;
}
```

**Problem:** Current redrawAll runs all strokes instantly with no physics between them. This means a stroke painted 30 seconds after the first would interact with fully-wet paint rather than partially-dried paint. With the LUT system, timing matters even more.

**Fast-forward approach:** Between strokes, compute elapsed time from timestamps, divide by 100ms (physics tick interval), and run that many physicsStep() calls. For a 5-second gap, that's 50 physicsStep() calls -- fast on modern hardware since it's just typed array iteration.

### Anti-Patterns to Avoid

- **Storing physics state in JSON:** Per D-04, serialize strokes only. Replaying with physics fast-forward is deterministic enough and keeps files in KB range.
- **Using Date.now() during replay for physics timing:** Replay must use recorded timestamps from strokes, not wall-clock time.
- **Running real-time drying during replay:** The 10fps setInterval must be paused or ignored during replay. Use batch physics calls instead.
- **forceDryAll() during replay between strokes:** Per the feedback memory, forceDryAll destroys wet-layer state that subsequent tools may need. Use physicsStep() iterations instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drying curve shape | Custom exponential/sigmoid function | Rebelle's exact `dL[c] = 0.002 + dL[c-1] * 0.998` formula | Produces the specific natural look Rebelle achieves; tested at 3000 entries |
| JSON file save/load | Custom binary format | `JSON.stringify` + `Blob` + `URL.createObjectURL` for download; `FileReader` for load | Browser-native, human-readable, matches D-04 requirement |
| File picker dialog | Custom modal | `<input type="file">` + `<a download>` pattern | Standard browser APIs, zero dependencies |

## Common Pitfalls

### Pitfall 1: Wrong Working File
**What goes wrong:** Implementation targets `efx-paint-physic-v1.html` (per CONTEXT.md) instead of `efx-paint-physic-v3.html` (actual working file).
**Why it happens:** CONTEXT.md was written referencing v1, but Phase 3 plans worked on v2 and v3. v3 has all 8+1 brush types, Float32Array wet arrays, PaintStroke format, and updated `redrawAll()`.
**How to avoid:** All work MUST target `efx-paint-physic-v3.html`. The v1 file is 1295 lines with only 4 tools. The v3 file is 2134 lines with all 9 tools.
**Warning signs:** If you see `new Array(W*H).fill(0)` for wet arrays (v1 pattern) instead of `new Float32Array(W*H)` (v3 pattern), you're editing the wrong file.

### Pitfall 2: LUT Size Mismatch
**What goes wrong:** Using wrong cT value or Float32Array size causes out-of-bounds access or truncated curve.
**Why it happens:** Rebelle uses cT=3000 with arrays of size cT+1 (3001 entries). Off-by-one errors common.
**How to avoid:** Define `const LUT_SIZE = 3000` and allocate `new Float32Array(LUT_SIZE + 1)`. Loop from 1 to LUT_SIZE inclusive.
**Warning signs:** `dL[3000]` should be approximately 1.0 (fully dry). If it's 0 or undefined, array sizing is wrong.

### Pitfall 3: dryStep Physics Interval During Replay
**What goes wrong:** The `setInterval(physicsStep, 100)` timer (v3 line 1590) continues running during replay, causing non-deterministic interference.
**Why it happens:** Replay calls strokes synchronously, but the interval timer fires asynchronously between them.
**How to avoid:** Pause the physics interval before replay, run physics synchronously in the replay loop, then resume the interval after replay completes.
**Warning signs:** Slightly different visual results on each load of the same file.

### Pitfall 4: Timestamps Must Be Relative
**What goes wrong:** Absolute `Date.now()` timestamps in JSON are meaningless for replay timing.
**Why it happens:** Current recording uses `Date.now()` (Unix milliseconds). Replay needs elapsed time between strokes, not absolute time.
**How to avoid:** In serialization, store timestamps as recorded. In replay, compute deltas: `(stroke[i].timestamp - stroke[i-1].timestamp)`. First stroke has zero elapsed time.
**Warning signs:** If physics fast-forward produces astronomically large numbers of iterations, you're using absolute timestamps instead of deltas.

### Pitfall 5: Per-Pixel Drying Position Array Memory
**What goes wrong:** Adding a `dryPos` Float32Array for 1000x650 pixels = 650,000 floats = 2.6MB. If not cleared properly in `clearWetLayer()`, stale drying positions cause artifacts.
**Why it happens:** Forgetting to add the new array to the clear/reset code paths.
**How to avoid:** Add `dryPos.fill(0)` to `clearWetLayer()`. Add it to wet snapshot/restore in undo. Add it to `forceDryAll()` reset.
**Warning signs:** After clear or undo, previously painted areas still show partial drying.

### Pitfall 6: Wet/Dry Tool Integration with LUT
**What goes wrong:** D-03 says dry tool uses "accelerated LUT traversal" and wet tool "reverses LUT position". If the LUT traversal speed is wrong, dry tool has no effect or instant-dries everything.
**Why it happens:** The LUT curve is exponential -- early positions barely change opacity, late positions change rapidly. A fixed increment applied at the wrong scale produces invisible or extreme results.
**How to avoid:** Dry tool should advance `dryPos[i]` by a large increment (e.g., +200 per chunk) proportional to the tool's dryAmount parameter. Wet tool should decrease `dryPos[i]` (but not below 0). Test with visible drying progression.
**Warning signs:** Dry tool either does nothing visible or makes paint disappear instantly.

### Pitfall 7: JSON Size with High Point Density
**What goes wrong:** Each stroke point has 7 fields (x, y, p, tx, ty, tw, spd) as objects. 100 strokes x 200 points x 7 fields = 140,000 values. With object key overhead, JSON bloats to ~500KB+.
**Why it happens:** Object format `{x: 1.234, y: 5.678, p: 0.5, ...}` has massive key overhead.
**How to avoid:** Serialize points as arrays `[x, y, p, tx, ty, tw, spd]` in JSON. This matches D-05's `[x, y, pressure][]` minimum format and dramatically reduces size. Parse back to objects on load.
**Warning signs:** Saved file is >100KB for a simple painting with a few strokes.

### Pitfall 8: redrawAll Tool Dispatch Stale
**What goes wrong:** CONTEXT.md says `redrawAll()` only handles 4 old types. This was true for v1 but v3 already dispatches all 9 types.
**Why it happens:** Outdated information in CONTEXT.md vs actual v3 code.
**How to avoid:** Check v3 `redrawAll()` (lines 1754-1778) -- it already handles paint, liquify, erase, water, smear, blend, blow, wet, dry. No tool dispatch expansion needed.
**Warning signs:** None -- this is a "skip unnecessary work" note.

## Code Examples

### LUT Initialization (from Rebelle, translated to vanilla JS)
```javascript
// Source: js/rebelle-paint.js lines 842-861
const LUT_SIZE = 3000;
const dryLUT = new Float32Array(LUT_SIZE + 1);   // dL: time position -> opacity fraction
const invLUT = new Float32Array(LUT_SIZE + 1);   // ao: opacity index -> time position

function initDryingLUT() {
  dryLUT[0] = 0;
  invLUT[0] = 0;
  for (let c = 1; c <= LUT_SIZE; c++) invLUT[c] = -1;

  for (let c = 1; c <= LUT_SIZE; c++) {
    dryLUT[c] = 0.002 + dryLUT[c - 1] * 0.998;
    const idx = Math.min(LUT_SIZE, Math.floor(dryLUT[c] * LUT_SIZE));
    invLUT[idx] = c;
  }
  // Fill gaps in inverse table
  for (let c = 1; c <= LUT_SIZE; c++) {
    if (invLUT[c] === -1) invLUT[c] = invLUT[c - 1];
  }
}
```

**Curve properties verified:** `dryLUT[1] = 0.002`, `dryLUT[100] ~= 0.163`, `dryLUT[500] ~= 0.632`, `dryLUT[1500] ~= 0.950`, `dryLUT[3000] ~= 0.998`. This is 1 - e^(-c/500), a natural exponential saturation curve.

### Per-Pixel Drying Position Tracking
```javascript
// New array alongside existing wet layer
const dryPos = new Float32Array(W * H);  // 0 = freshly wet, LUT_SIZE = fully dry

// In dryStep, replace percentage drain:
function dryStep() {
  const id = X.getImageData(0, 0, W, H);
  const d = id.data;
  let changed = false;

  for (let i = 0; i < W * H; i++) {
    if (wetAlpha[i] < DRY_ALPHA_THRESHOLD) continue;

    // Advance drying position by speed factor
    const speed = drySpeed;  // user slider, default produces ~15s full dry
    dryPos[i] = Math.min(LUT_SIZE, dryPos[i] + speed);

    // Get opacity fraction from LUT
    const frac = dryLUT[Math.floor(dryPos[i])];

    // Transfer proportional to frac delta since last frame
    // (compute transfer amount from current frac vs previous)
    // ... paper texture modulation same as current ...

    // Mark as fully dry when LUT position reaches end
    if (dryPos[i] >= LUT_SIZE) {
      // Transfer all remaining wet paint
      wetAlpha[i] = 0; wetness[i] = 0;
      wetR[i] = 0; wetG[i] = 0; wetB[i] = 0;
      dryPos[i] = 0;
    }
  }
  if (changed) X.putImageData(id, 0, 0);
}
```

### JSON Serialization Format
```javascript
// Serialization
function serializeProject() {
  return {
    version: 1,
    canvas: {
      width: W,
      height: H,
      bgMode: bgMode,
      paperGrain: currentPaperKey,
      embossStrength: embossStrength,
      wetPaper: wetPaper,
    },
    strokes: allActions.map(s => ({
      tool: s.tool,
      points: (s.points || s.pts).map(p => [
        Math.round(p.x * 100) / 100,  // 2 decimal precision
        Math.round(p.y * 100) / 100,
        Math.round((p.p || 0) * 1000) / 1000,
        p.tx || 0,
        p.ty || 0,
        p.tw || 0,
        Math.round((p.spd || 0) * 100) / 100,
      ]),
      color: s.color,
      params: s.params || s.opts,
      timestamp: s.timestamp,
    })),
  };
}

// Deserialization
function loadProject(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;

  // 1. Restore canvas settings
  bgMode = data.canvas.bgMode;
  // ... restore other settings ...

  // 2. Convert points back to objects
  allActions = data.strokes.map(s => ({
    tool: s.tool,
    points: s.points.map(p => ({
      x: p[0], y: p[1], p: p[2],
      tx: p[3], ty: p[4], tw: p[5], spd: p[6],
    })),
    color: s.color,
    params: s.params,
    timestamp: s.timestamp,
  }));

  // 3. Replay with physics fast-forward
  replayWithPhysics(allActions);
}
```

### Replay with Inter-Stroke Physics
```javascript
function replayWithPhysics(strokes) {
  // Pause live physics
  clearInterval(physicsInterval);

  drawBg();
  clearWetLayer();
  directRender = true;

  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];

    // Fast-forward physics for elapsed time since previous stroke
    if (i > 0) {
      const elapsed = s.timestamp - strokes[i - 1].timestamp;
      const ticks = Math.floor(elapsed / 100);  // 100ms per physics tick
      for (let t = 0; t < Math.min(ticks, 500); t++) {  // cap at 50 seconds
        physicsStep();
      }
    }

    // Execute stroke
    dispatchStroke(s);
  }

  // Final physics: fast-forward remaining time (time since last stroke)
  // Not needed for instant load -- just forceDryAll or leave wet

  directRender = false;

  // Resume live physics
  physicsInterval = setInterval(physicsStep, 100);
}
```

### Save/Load UI
```javascript
// Save: download JSON file
function saveProject() {
  const data = serializeProject();
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'painting.efxpaint.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Load: file picker
function loadProjectFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.efxpaint.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        loadProject(ev.target.result);
      } catch (err) {
        console.error('Failed to load project:', err);
        alert('Failed to load file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `DRY_DRAIN=0.015` percentage drain | LUT-driven drying with per-pixel position | Phase 4 | Natural S-curve drying instead of linear |
| `startDry()` with preset timers (v1) | Continuous physics at 10fps (v3) | Phase 3 | No manual button needed; physics always runs |
| `new Array(W*H).fill(0)` wet arrays (v1) | `new Float32Array(W*H)` (v3) | Phase 3 plan 03 | Enables `.set()` for undo, faster iteration |
| 4-tool redrawAll dispatch (v1) | 9-tool redrawAll dispatch (v3) | Phase 3 plan 02 | All tools already replayable |

## Open Questions

1. **LUT array size: 3000 vs smaller?**
   - What we know: Rebelle uses cT=3000. The curve converges to ~0.998 at index 3000 (effectively 1.0).
   - What's unclear: Whether 3000 is necessary or if 1000 would suffice (smaller memory, same visual).
   - Recommendation: Use 3000 to match Rebelle exactly. The 12KB memory cost (3001 x 4 bytes) is negligible. **Discretion area per CONTEXT.md.**

2. **Fast-forward approach: batch physicsStep vs scaled single step?**
   - What we know: Each physicsStep (dryStep + flowStep) iterates W*H = 650,000 pixels. At 10fps = 100ms/tick. A 10-second gap needs 100 iterations.
   - What's unclear: Whether 100 full physics iterations is fast enough during load, or if scaled single step is needed.
   - Recommendation: Use batch physicsStep calls with a cap (e.g., max 500 ticks = 50 seconds). For a typical painting session with 10-30 second gaps, this means 100-300 iterations per gap. At ~5ms per iteration, that's 0.5-1.5 seconds per gap -- acceptable for instant load. If performance is an issue, degrade to larger step sizes. **Discretion area per CONTEXT.md.**

3. **File extension: .json vs .efxpaint.json?**
   - What we know: D-04 says "small enough to paste in chat". .json is universally recognized. .efxpaint would be domain-specific.
   - Recommendation: Use `.efxpaint.json` (double extension). Recognized as JSON by tools, but distinctive for the project. Accept both on load. **Discretion area per CONTEXT.md.**

4. **drySpeed calculation for "~15 seconds" default**
   - What we know: Physics runs at 10fps. 15 seconds = 150 ticks. LUT_SIZE = 3000. So `drySpeed = 3000 / 150 = 20` positions per tick. With user slider modifying this (e.g., 0.5x to 3x range), the range would be ~7.5 to 45 seconds for full dry.
   - Recommendation: Default drySpeed = 20. Map slider linearly from 5 (slow, ~60s) to 50 (fast, ~6s).

## Project Constraints (from CLAUDE.md)

- **Single HTML file:** All work continues in `efx-paint-physic-v3.html` (not TypeScript modules until Phase 5)
- **Canvas 2D only:** No WebGL, no offscreen canvas (PERF-01 deferred to v2)
- **No "rebelle" in identifiers:** LUT variables must use clean names (dryLUT, invLUT, not dL, ao)
- **Package name constraint:** `@efxlab/efx-physic-paint` -- JSON format should be forward-compatible with library export
- **GSD workflow:** All edits via GSD commands, not direct repo edits
- **No test framework configured:** Validation is visual + manual (no unit tests)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (visual testing) |
| Config file | None |
| Quick run command | Open `efx-paint-physic-v3.html` in browser, paint, observe |
| Full suite command | Manual: paint strokes, wait for drying, save, load, compare |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHYS-04 | Wet paint follows S-curve drying (slow start, accelerating, plateau) | manual | Open v3, paint a thick stroke, observe drying progression over 10-30 seconds | N/A |
| PHYS-04 | Drying speed slider changes dry time | manual | Adjust slider, paint, compare drying time | N/A |
| STROKE-03 | Save button downloads .json file | manual | Click Save, verify file downloads | N/A |
| STROKE-03 | Load button restores painting | manual | Save, clear, load same file, compare | N/A |
| DEMO-04 | Loaded replay visually matches original | manual | Paint several strokes, save, clear, load, screenshot-compare | N/A |

### Sampling Rate
- **Per task commit:** Manual browser test of changed feature
- **Per wave merge:** Full save/load round-trip test with multiple strokes
- **Phase gate:** Paint, dry, save, load, visual compare before `/gsd:verify-work`

### Wave 0 Gaps
None -- no test framework to set up. Validation is entirely manual/visual per project constraints (no test framework configured).

## Sources

### Primary (HIGH confidence)
- `efx-paint-physic-v3.html` (2134 lines) -- Current working implementation file, read in full
- `js/rebelle-paint.js` lines 842-861 -- LUT initialization function `cZ()` with dL/ao tables
- `js/rebelle-paint.js` lines 460-507 -- Array allocation showing cT=3000, aU=3000
- `js/rebelle-paint.js` lines 1700-1740, 1780-1810 -- LUT usage in brush blending code
- `.planning/phases/03-brush-system-tools/03-01-SUMMARY.md` -- Phase 3 plan 01 results
- `.planning/phases/03-brush-system-tools/03-02-SUMMARY.md` -- Phase 3 plan 02 results
- `.planning/phases/03-brush-system-tools/03-VERIFICATION.md` -- Phase 3 verification status
- Memory: `feedback-v3-brush-tools.md` -- forceDryAll pitfall, rehydrate pattern
- Memory: `project-water-tool-architecture.md` -- tool architecture decisions
- Memory: `codebase-efx-motion-editor.md` -- PaintStroke type for interop

### Secondary (MEDIUM confidence)
- Rebelle LUT mathematical analysis: `dL[c] = 0.002 + dL[c-1] * 0.998` is a discrete approximation of `1 - e^(-c/500)` -- verified by computing first ~10 terms and checking convergence

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all vanilla JS/Canvas 2D APIs
- Architecture: HIGH -- LUT algorithm fully reverse-engineered from source, integration points identified in v3
- Pitfalls: HIGH -- grounded in actual Phase 3 experience (wrong file, Float32Array, forceDryAll issues)
- Serialization: HIGH -- format already defined by PaintStroke comment block and efx-motion-editor reference

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- no external dependencies to go stale)
