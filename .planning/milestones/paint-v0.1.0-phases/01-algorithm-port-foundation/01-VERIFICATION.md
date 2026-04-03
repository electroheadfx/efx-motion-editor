---
phase: 01-algorithm-port-foundation
verified: 2026-03-29T15:45:00Z
status: gaps_found
score: 9/11 must-haves verified
re_verification: false
gaps:
  - truth: "Dual-layer wet/dry physics uses wetLayer Float32Array + dryLayer Uint8Array matching requirement spec"
    status: partial
    reason: "REQUIREMENTS.md defines PHYS-01 as 'wetLayer Float32Array + dryLayer Uint8Array' but v2.html uses standard JS Arrays for wet layer (for 64-bit float precision) and the canvas ImageData buffer as the dry layer — no separate Uint8Array. The dual-layer physics behavior exists and works, but the data structure diverges from the spec. REQUIREMENTS.md marks PHYS-01 as complete, creating inconsistency."
    artifacts:
      - path: "efx-paint-physic-v2.html"
        issue: "Lines 140-144: wetR/wetG/wetB/wetAlpha/wetness are new Array(W*H), not Float32Array. No dryLayer Uint8Array exists — dry paint lives in canvas ImageData."
      - path: ".planning/REQUIREMENTS.md"
        issue: "PHYS-01 definition says 'Float32Array + Uint8Array' but marks status [x] Complete — status and definition contradict the actual implementation"
    missing:
      - "Either update REQUIREMENTS.md PHYS-01 description to match actual implementation (JS arrays for wet, canvas buffer for dry), OR accept the intentional design deviation in the verification. This is a documentation gap, not a functional gap."
  - truth: "DEMO-01 satisfied: Vite + Preact + TypeScript demo app with working canvas"
    status: failed
    reason: "REQUIREMENTS.md defines DEMO-01 as 'Vite + Preact + TypeScript demo app with working canvas'. No Vite+Preact app exists. paint-rebelle-new/ contains only types.ts and tsconfig.json. The demo is efx-paint-physic-v2.html (standalone HTML, no build tool). REQUIREMENTS.md and traceability table mark DEMO-01 as Pending."
    artifacts:
      - path: "paint-rebelle-new/"
        issue: "Only contains src/types.ts and tsconfig.json — no Vite config, no package.json, no Preact components, no index.html, no main.tsx"
    missing:
      - "A Vite+Preact+TypeScript app is required per DEMO-01. Phase 1 goal was intentionally scoped to HTML prototype (per CONTEXT.md D-04), so DEMO-01 is legitimately deferred — but it remains an open Phase 1 requirement that needs resolution: either close it via the HTML prototype or explicitly defer it to Phase 5."
human_verification:
  - test: "Open efx-paint-physic-v2.html in browser, draw strokes with paint tool, observe wet paint appearing immediately as semi-transparent overlay then drying over 10-15 seconds"
    expected: "Stroke appears instantly on displayCanvas as wet overlay; gradually transfers to main canvas via dryStep over ~10-15 seconds; wet paint visibly spreads at stroke edges biased by paper texture"
    why_human: "Visual physics behavior cannot be verified programmatically — requires watching the time-domain drying and flow progression"
  - test: "Select a paper texture background (canvas1/canvas2/canvas3), draw a stroke, verify paper grain is visible through wet paint and dried strokes show paper texture modulation"
    expected: "Paper texture grain visible through wet paint overlay; dried paint shows more pigment in valleys (lower paperHeight values), less on peaks (higher values)"
    why_human: "Paper texture interaction is a visual quality judgment requiring human inspection"
---

# Phase 1: Algorithm Port Foundation Verification Report

**Phase Goal:** Port the core paint physics algorithm from the Processing.js reference into a working HTML prototype with wet/dry paint physics, paper texture interaction, and correct canvas stride.
**Verified:** 2026-03-29T15:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification
**Implementation file:** `efx-paint-physic-v2.html` (user iterated to v2 instead of v1)

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Paint deposits to wet layer arrays, not directly to canvas | VERIFIED | `renderPaintStrokeSingleColor` (line 826-830) calls `transferToWetLayerClipped`; `directRender=false` during live painting |
| 2  | Wet layer compositing on displayCanvas is the primary visual output | VERIFIED | `compositeWetLayer()` runs via `requestAnimationFrame` loop starting at line 1296; reads wetR/G/B/wetAlpha arrays |
| 3  | Drying is the only mechanism that transfers paint from wet to main canvas | VERIFIED | `dryStep()` (line 1022) reads wet arrays and `putImageData` to main canvas X; `transferToWetLayerClipped` only writes to wet arrays |
| 4  | Flow/diffusion spreads wet paint along paper texture before drying | VERIFIED | `flowStep()` (line 1090) uses `paperHeight` to bias diffusion with gravity, FLOW_FRACTION=0.025, GRAVITY_BIAS=0.04 |
| 5  | Paper texture grain modulates wet paint visibility and drying rate | VERIFIED | `dryStep` applies `paperMod = clamp(1.4 - ph * 0.8, 0.3, 1.4)` (line 1039); paper loaded as Float32Array heightmap (line 166) |
| 6  | Main animation loop calls compositeWetLayer each frame | VERIFIED | Line 1296: `requestAnimationFrame(compositeWetLayer)` starts the loop; line 1292 re-queues it every frame |
| 7  | Canvas resizes responsively without breaking coordinate mapping | VERIFIED | CSS `width:100%;height:auto` on canvas (line 13-14); `extractPenPoint` uses `getBoundingClientRect` scale factors (line 1418-1419) |
| 8  | W and H are `let` not `const` for resize support | VERIFIED | Line 116: `let W=C.width,H=C.height` |
| 9  | CANVAS_STRIDE=902 (not 904) is correctly established | VERIFIED | `types.ts` line 19: `export const CANVAS_STRIDE = 902` with note about v2 using flat indexing |
| 10 | Physics uses actual v2 constant names (DRY_DRAIN not DRY_RATE) | VERIFIED | v2.html line 1019: `const DRY_ALPHA_THRESHOLD = 1`; line 1031: `wetAlpha[i] * DRY_DRAIN`; types.ts uses DRY_DRAIN=0.015 |
| 11 | Wet layer data structure matches PHYS-01 typed array spec | PARTIAL | JS arrays used (not Float32Array); dry layer is canvas buffer (not Uint8Array). Physics behavior works but diverges from requirement spec wording. |

**Score:** 10/11 truths fully verified, 1 partial (PHYS-01 data structure spec vs implementation divergence)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `efx-paint-physic-v2.html` | Complete rendering flow with wet/dry physics | VERIFIED | 1603 lines, 871KB. Contains transferToWetLayerClipped, compositeWetLayer rAF loop, dryStep, flowStep, physicsStep at 10fps, paper texture loading, responsive CSS |
| `paint-rebelle-new/src/types.ts` | TypeScript types documenting v2 physics interface | VERIFIED | 149 lines. Contains WetLayer, PhysicsConstants (DRY_DRAIN=0.015, GRAVITY_BIAS=0.04), PenPoint, ToolOpts, ToolType, BgMode, CANVAS_STRIDE=902 |
| `paint-rebelle-new/tsconfig.json` | TypeScript config for type checking | VERIFIED | Minimal config: ES2023, strict, DOM lib; `tsc --noEmit` exits 0 |
| Vite+Preact demo app | `paint-rebelle-new/` Vite+Preact+TypeScript app | MISSING | paint-rebelle-new/ contains only types.ts and tsconfig.json. No package.json, no vite.config, no Preact components. DEMO-01 not satisfied. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `renderPaintStrokeSingleColor` | `transferToWetLayerClipped` | offscreen canvas → wet arrays | WIRED | Line 830: `transferToWetLayerClipped(oc, bounds)` when `!directRender` |
| `renderPaintStroke` pickup path | `transferToWetLayerClipped` | per-segment offscreen canvas | WIRED | Line 765: `transferToWetLayerClipped(oc2, segBounds)` |
| `compositeWetLayer` | `displayCanvas` | requestAnimationFrame loop reading wet arrays | WIRED | Line 1257-1292: reads wetR/G/B/wetAlpha, writes to displayCtx via createImageData |
| `dryStep` | main canvas X | wet-to-canvas transfer via getImageData/putImageData | WIRED | Line 1023-1064: `X.getImageData` → modify → `X.putImageData` using wet array values |
| `flowStep` | wet layer arrays | neighbor diffusion biased by paperHeight | WIRED | Lines 1154-1164: writes to wetR/G/B/wetAlpha/wetness of neighbor cells |
| `physicsStep` | `flowStep` + `dryStep` | setInterval 100ms | WIRED | Line 1191: `setInterval(physicsStep, 100)`; lines 1176-1177: calls flowStep then dryStep |
| `extractPenPoint` | canvas coordinates | getBoundingClientRect scale factor | WIRED | Lines 1418-1419: `const r=C.getBoundingClientRect(); const sx=W/r.width, sy=H/r.height` |
| `loadPaperTexture` | `paperHeight` Float32Array | red channel of jpg → Float32Array | WIRED | Lines 165-167: `new Float32Array(W*H); height[i] = pd[i*4] / 255` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `compositeWetLayer` | `wetAlpha[i]`, `wetR/G/B[i]` | `transferToWetLayerClipped` writes during paint strokes | Yes — populated by actual brush strokes via offscreen canvas pixel transfer | FLOWING |
| `dryStep` | wet arrays → canvas ImageData | same wet arrays from brush strokes | Yes — transfers non-zero wet pixels to canvas | FLOWING |
| `flowStep` | `wetness[idx]`, `paperHeight[idx]` | brush strokes (wetness) + loadPaperTexture (paperHeight) | Yes — both populated by real operations | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `tsc --noEmit` compiles clean | `cd paint-rebelle-new && npx tsc --noEmit` | No output, exit 0 | PASS |
| `compositeWetLayer` function exists and is called via rAF | `grep -c "requestAnimationFrame(compositeWetLayer)" v2.html` | 3 matches (lines 1270, 1292, 1296) | PASS |
| `physicsStep` runs at 10fps | `grep "setInterval(physicsStep" v2.html` | `setInterval(physicsStep, 100)` at line 1191 | PASS |
| `dryStep` reads paper texture | `grep "paperHeight\[i\]" v2.html` | Found at line 1038 (paperMod computation) | PASS |
| v2.html is substantive (not stub) | `wc -l efx-paint-physic-v2.html` | 1603 lines, 871KB | PASS |
| `transferToWetLayerClipped` is the wet-layer write path | `grep -c "transferToWetLayerClipped" v2.html` | 3 occurrences (definition + 2 call sites) | PASS |
| CSS responsive canvas implemented | `grep "width:100%" v2.html` | Lines 13-14: canvas and #displayCanvas both have width:100%;height:auto | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PHYS-01 | 01-02-PLAN | Dual-layer wet/dry paint physics | PARTIAL | Wet layer (JS arrays) + dry layer (canvas buffer) physics works; data structure diverges from "Float32Array + Uint8Array" spec wording. Functional behavior is present; spec requires updating. |
| PHYS-02 | 01-02-PLAN | Paper texture loading (512x512 jpg → Float32Array heightmap) | SATISFIED | `loadPaperTexture()` loads jpg, tiles to canvas, extracts `pd[i*4]/255` into `new Float32Array(W*H)` for red-channel heightmap. 3 paper textures embedded as base64. |
| PHYS-03 | 01-02-PLAN | Flow field transport creating capillary spreading | SATISFIED | `flowStep()` diffuses wet paint using paperHeight gradient + GRAVITY_BIAS=0.04, FLOW_FRACTION=0.025. Spreads along texture valleys with downward pull. |
| DEMO-01 | 01-02-PLAN | Vite + Preact + TypeScript demo app with working canvas | NOT SATISFIED | paint-rebelle-new/ has only types.ts. No Vite config, no Preact app, no working canvas component. REQUIREMENTS.md marks as Pending. Phase goal explicitly scoped to HTML prototype (CONTEXT.md D-04) — intentional deferral but requirement remains open. |
| CANVAS-01 | 01-03-PLAN | Responsive canvas with correct coordinate mapping | SATISFIED | CSS width:100%;height:auto on canvas+displayCanvas; wrap max-width:100%;width:1000px; getBoundingClientRect scale factor in extractPenPoint. |
| CANVAS-02 | 01-03-PLAN | Canvas stride = 902 | SATISFIED | types.ts CANVAS_STRIDE=902 (fixed from 904 in commit 7864ec9). v2.html uses W*H flat indexing per design decision; stride preserved as reference constant. |

**Orphaned requirements check:** REQUIREMENTS.md traceability table shows LIB-02 as "Phase 1: Pending". CONTEXT.md lists LIB-02 as a Phase 1 requirement. No plan claims LIB-02 for this phase (plan 01-03 covers partial LIB-02 via types.ts but notes full compliance deferred to Phase 5). This is acknowledged in the ROADMAP Phase 1 note: "LIB-02 partially addressed via types.ts documentation contract".

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| efx-paint-physic-v2.html | 637 | Comment: "Transfer offscreen canvas pixel data into wet layer arrays (used by redrawAll directRender path)" — `transferToWetLayerClipped` is also used as the normal wet-layer write path, not just redrawAll | Info | Misleading comment only; code works correctly |
| efx-paint-physic-v2.html | 1591 | `directRender=!wetPaper` — sets directRender globally based on paper mode toggle without clearing on edge cases | Warning | In Dry mode, directRender=true persists; switching back to Wet while mid-stroke could leave directRender in wrong state. Low risk in current UI flow but brittle. |
| efx-paint-physic-v2.html | 698 | `wetness[i] = Math.min(1000, wetness[i] + waterSlider * 800 * (a / 255))` uses `800` while the nearby depositToWetLayer uses `1200` — inconsistency in water deposit scalar | Warning | Pickup path (`transferToWetLayerClipped` from `depositToWetLayerWithColors`) deposits less water than single-color path. May produce different flow behavior for mixed-color strokes. |
| .planning/REQUIREMENTS.md | 11 | `[x] PHYS-01` marked Complete but spec says "Float32Array + Uint8Array" while implementation uses JS arrays | Warning | Specification drift — could mislead future phases about expected data structures |

No blockers found. All anti-patterns are warnings or informational — none prevent the physics engine from functioning.

---

### Human Verification Required

#### 1. Wet Paint Overlay and Drying Progression

**Test:** Open `efx-paint-physic-v2.html` in a modern browser. Select the Wet paper mode (should be default). Draw a stroke with the Paint tool. Observe the displayCanvas overlay immediately, then watch for 10-15 seconds.
**Expected:** Stroke appears immediately as a semi-transparent colored overlay on the displayCanvas. Over 10-15 seconds, the wet overlay fades as paint transfers to the main canvas via dryStep. The main canvas should show the stroke color after drying completes.
**Why human:** Time-domain drying progression and visual appearance cannot be verified programmatically.

#### 2. Paper Texture Capillary Flow

**Test:** Select a paper texture background (canvas1, canvas2, or canvas3). Draw a stroke with high Wetness (~70+). Wait 5-10 seconds and observe stroke edges.
**Expected:** Wet paint spreads slightly along paper texture valleys (lower paperHeight areas) and is pulled downward by gravity bias. The dried stroke should show more pigment accumulation in texture valleys and less on peaks.
**Why human:** Subtle visual diffusion behavior requires human judgment; flow amounts are small and need contextual interpretation.

---

### Gaps Summary

**2 gaps require resolution:**

1. **PHYS-01 data structure specification drift** (partial, non-blocking): The implementation correctly achieves dual-layer wet/dry physics using JS arrays for the wet layer and the canvas ImageData as the dry layer. This is an intentional design choice for 64-bit float precision. However, REQUIREMENTS.md defines PHYS-01 as "wetLayer Float32Array + dryLayer Uint8Array" and marks it `[x]` Complete — creating a contradiction between the spec wording and the actual implementation. The resolution is documentation: update REQUIREMENTS.md PHYS-01 to match the actual data structure design, or add a note that the float precision choice supersedes the typed array spec.

2. **DEMO-01 unimplemented** (failed, acknowledged deferral): The REQUIREMENTS.md Phase 1 requirement DEMO-01 ("Vite + Preact + TypeScript demo app with working canvas") was not implemented in Phase 1. The working prototype is `efx-paint-physic-v2.html` (standalone HTML). This was an intentional scope decision per CONTEXT.md D-04 and D-05. However, the REQUIREMENTS.md traceability table still shows DEMO-01 as "Phase 1 | Pending" — it either needs to be explicitly deferred to Phase 5 in the traceability table, or accepted as a known gap until the Vite+Preact app is built.

**The core Phase 1 goal is achieved:** The HTML prototype `efx-paint-physic-v2.html` delivers working wet/dry paint physics, paper texture interaction (Float32Array heightmap), capillary flow spreading, drying progression, and correct canvas stride (902 in types.ts). The human-approved verification in 01-02-SUMMARY.md confirms the 5 physics features work together visually.

---

*Verified: 2026-03-29T15:45:00Z*
*Verifier: Claude (gsd-verifier)*
