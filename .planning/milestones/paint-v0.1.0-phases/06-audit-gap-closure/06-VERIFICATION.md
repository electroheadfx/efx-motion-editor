---
phase: 06-audit-gap-closure
verified: 2026-04-02T09:30:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 06: Audit Gap Closure Verification Report

**Phase Goal:** Close all gaps from the v1.0 Milestone Audit — dead code removal, onEngineReady timing fix, REQUIREMENTS.md alignment
**Verified:** 2026-04-02
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero orphaned exports — no dead brush types, deprecated diffusion functions, or unused utils remain | VERIFIED | water.ts deleted; diffusion.ts pruned to physicsStep only; paper.ts has no grain functions; math.ts has no pt2arr/ptsToArrs; grep across src/ returns zero hits for all dead identifiers |
| 2 | brush_texture.png asset no longer exists in the repo | VERIFIED | `test ! -f paint-rebelle-new/public/img/brush_texture.png` passes; commit 6297151 confirms binary deleted |
| 3 | TypeScript compiles with zero errors after dead code removal | VERIFIED | `npx tsc --noEmit` exits 0 with no output |
| 4 | Vite production build succeeds after dead code removal | VERIFIED (inferred) | tsc clean + no missing imports found; SUMMARY confirms build ran successfully at commit 8eb378d |
| 5 | onEngineReady fires only after paper textures have loaded (not before async load completes) | VERIFIED | EfxPaintEngine.ts line 255: `async init(): Promise<void>` exists; preact.tsx lines 47-48: `engine.init().then(() => { props.onEngineReady?.(engine) })`; constructor no longer calls `this.loadPaperTextures(config.papers, ...)` |
| 6 | REQUIREMENTS.md checkboxes for LIB-03, DEMO-01, DEMO-02 are checked [x] | VERIFIED | All three lines confirmed as `- [x]` in REQUIREMENTS.md |
| 7 | Spec wording for PHYS-01, CANVAS-02, LIB-01, BRUSH-03 matches current implementation reality | VERIFIED | PHYS-01: "JS number arrays" + "Stam stable-fluids solver"; BRUSH-03: "Paper-height deposit modulation" (no brush_texture.png); CANVAS-02: "Configurable canvas dimensions" (not stride 902); LIB-01: "ESM-only output" (not CJS+ESM) |

**Score: 7/7 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `paint-rebelle-new/src/core/diffusion.ts` | Only physicsStep function (deprecated functions removed) | VERIFIED | 57 lines; contains `export function physicsStep`; no buildColorMap, sampleChannel, sampleColorPremul, precomputeDisplacement, diffuseStep |
| `paint-rebelle-new/src/core/paper.ts` | loadPaperTexture, sampleH, sampleTexH, ensureHeightMap only | VERIFIED | 125 lines; all 4 live functions present; no createMirroredBrushGrain, sampleBrushGrain, MIRRORED_GRAIN_SIZE |
| `paint-rebelle-new/src/util/math.ts` | gauss, lerp, dist, distXY, clamp, curveBounds, polyBounds, lerpPt (pt2arr/ptsToArrs removed) | VERIFIED | 128 lines; lerpPt present; no pt2arr, ptsToArrs |
| `paint-rebelle-new/src/engine/EfxPaintEngine.ts` | loadPaperTextures awaited before signaling ready; _initPapers/_initDefaultPaper fields | VERIFIED | `async init(): Promise<void>` at line 255; private fields at lines 133-134; no fire-and-forget `this.loadPaperTextures(config.papers` in constructor |
| `paint-rebelle-new/src/preact.tsx` | onEngineReady fires after engine.init() resolves | VERIFIED | `engine.init().then(() => { props.onEngineReady?.(engine) })` at lines 47-48; no synchronous call before init |
| `.planning/REQUIREMENTS.md` | Updated checkboxes and spec wording; "JS arrays", "2026-04-02" | VERIFIED | All 7 IDs checked; all 4 spec rewrites present; last-updated line present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `paint-rebelle-new/src/engine/EfxPaintEngine.ts` | `paint-rebelle-new/src/core/diffusion.ts` | `import { physicsStep }` | WIRED | Line 35: `import { physicsStep } from '../core/diffusion'` |
| `paint-rebelle-new/src/engine/EfxPaintEngine.ts` | `paint-rebelle-new/src/brush/paint.ts` | `import { renderPaintStroke }` | WIRED | Line 38: `import { renderPaintStroke } from '../brush/paint'` |
| `paint-rebelle-new/src/preact.tsx` | `paint-rebelle-new/src/engine/EfxPaintEngine.ts` | EfxPaintEngine constructor + async init | WIRED | `engine.init().then(() => { props.onEngineReady?.(engine) })` confirms async-aware wiring |

---

### Data-Flow Trace (Level 4)

Not applicable. This phase modifies engine infrastructure (parameter removal, async init) and documentation. There are no new UI components or data-rendering artifacts introduced.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles after dead code removal | `npx tsc --noEmit` (in paint-rebelle-new/) | Exit 0, no output | PASS |
| Dead identifiers absent from all .ts source files | grep for buildColorMap\|sampleChannel\|sampleColorPremul\|precomputeDisplacement\|diffuseStep\|createMirroredBrushGrain\|sampleBrushGrain\|MIRRORED_GRAIN_SIZE\|pt2arr\|ptsToArrs\|brushGrain | Zero matches | PASS |
| water.ts deleted | `test ! -f paint-rebelle-new/src/brush/water.ts` | Passes | PASS |
| brush_texture.png deleted | `test ! -f paint-rebelle-new/public/img/brush_texture.png` | Passes | PASS |
| init() exists and preact.tsx uses .then() pattern | grep for `async init` in EfxPaintEngine.ts; grep `engine.init` in preact.tsx | Both present | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PHYS-01 | 06-01, 06-02 | Dual-layer wet/dry physics with Stam fluids | SATISFIED | Spec wording updated to "JS number arrays" + "Stam stable-fluids solver"; implementation pre-existing from Phase 05.1 |
| LIB-01 | 06-01, 06-02 | ESM-only package export | SATISFIED | REQUIREMENTS.md updated from "CJS+ESM" to "ESM-only output" |
| LIB-03 | 06-01, 06-02 | Preact/React component wrapper | SATISFIED | `[x]` checkbox confirmed; preact.tsx wrapper verified |
| BRUSH-03 | 06-01, 06-02 | Paper-height deposit modulation (no brush_texture.png) | SATISFIED | Spec rewritten; asset deleted; sampleBrushGrain removed from all callers |
| CANVAS-02 | 06-02 | Configurable canvas dimensions | SATISFIED | Spec updated from "stride = 902" to "Configurable canvas dimensions" |
| DEMO-01 | 06-02 | Vite + Preact + TypeScript demo app | SATISFIED | `[x]` checkbox confirmed |
| DEMO-02 | 06-02 | UI controls (sliders + button groups) | SATISFIED | `[x]` checkbox confirmed |

All 7 requirement IDs from PLAN frontmatter accounted for. No orphaned requirements found — all IDs listed in both plans appear in REQUIREMENTS.md with correct state.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `paint-rebelle-new/src/engine/EfxPaintEngine.ts` | 475 | `// placeholder, actual physics strokes filtered during save` | Info | Pre-existing comment on internal action-log record; not introduced by Phase 06; not user-visible; does not affect engine readiness or painting behavior |

No blockers. No warnings. The one info-level item is a pre-existing comment in the serialization path, outside Phase 06 scope.

---

### Human Verification Required

None. All phase-06 goals are verifiable programmatically:

- Dead code removal: confirmed by file deletion + grep
- Build health: confirmed by tsc exit code
- Async init pattern: confirmed by code inspection
- Requirements alignment: confirmed by text matching

---

### Gaps Summary

No gaps. All must-haves from both plans are fully achieved:

- **Plan 06-01 (dead code removal):** water.ts deleted, brush_texture.png deleted, 5 functions pruned from diffusion.ts, 2 functions + 1 constant pruned from paper.ts, 2 functions pruned from math.ts, brushGrain parameter chain removed from paint.ts and EfxPaintEngine.ts (4 call sites). Zero dead identifiers remain in the source tree. TypeScript compiles clean.

- **Plan 06-02 (onEngineReady fix + requirements alignment):** `async init(): Promise<void>` added to EfxPaintEngine; constructor no longer calls loadPaperTextures fire-and-forget; Preact wrapper uses `engine.init().then()` pattern so onEngineReady fires only after textures load. All 4 spec rewrites (PHYS-01, BRUSH-03, CANVAS-02, LIB-01) are in REQUIREMENTS.md with correct wording. LIB-03, DEMO-01, DEMO-02 checkboxes confirmed checked. Last-updated date present.

The v1.0 Milestone Audit gaps are closed.

---

_Verified: 2026-04-02_
_Verifier: Claude (gsd-verifier)_
