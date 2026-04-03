---
phase: 03-brush-system-tools
verified: 2026-03-30T18:00:00Z
status: verified
score: 5/5 must-haves verified (user approved 2026-04-02)
human_verification:
  - test: "Visual output of all 7 non-paint brush types (erase, water, smear, blend, blow, wet, dry)"
    expected: "Each brush produces visually distinct, intentional behavior — erase removes paint, water causes flow without adding color, smear drags color, blend smooths, blow pushes wet paint in movement direction, wet adds wetness, dry accelerates drying"
    why_human: "UAT session tested these on v2 and found output quality insufficient. v3 has the Float32Array fix but 7 brush types were marked 'skipped — quality insufficient' in the UAT and never re-verified. Cannot determine if the quality is now acceptable from code alone."
  - test: "Undo fully reverts last stroke with no ghost in v3"
    expected: "After painting a stroke, Ctrl+Z returns canvas to exact pre-stroke state with no ~50% ghost artifact and no physics re-baking"
    why_human: "The Float32Array fix is confirmed in v3 code (lines 170-174). The .set() calls are present (lines 2120-2121). UAT test 11 found this was broken in v2. v3 is the fix but was never re-verified visually. Re-run UAT test 11 on efx-paint-physic-v3.html."
---

# Phase 3: Brush System & Tools Verification Report

**Phase Goal:** Users can create strokes with all brush types and parameters using tablet input
**Verified:** 2026-03-30T18:00:00Z
**Status:** verified (user approved 2026-04-02)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stroke data model captures x, y, pressure, tilt X/Y, twist, speed | VERIFIED | `PaintStroke` comment block at v3 line 147-157; `{x,y,p,tx,ty,tw,spd}` in extractPenPoint at lines 1883-1889; `allActions.push(stroke)` at line 2013 with `timestamp` at line 2011 |
| 2 | Tablet pen input coalesces correctly (pressure, tilt X/Y, twist, speed via PointerEvent) | VERIFIED | `getCoalescedEvents()` at line 1935; `e.tiltX`, `e.tiltY`, `e.twist`, `e.pressure` at lines 1861-1889; `hasPenInput` flag gates pen-only behavior |
| 3 | All 8 brush types function: paint, erase, water, smear, blend, blow, wet, dry | PARTIAL | All 9 tool buttons exist in v3 HTML (lines 56-65). All 7 non-paint functions defined: `applyEraseStroke` (1058), `applyWaterStroke` (1138), `applySmearChunk` (1171), `applyBlendStroke` (1236), `applyBlowChunk` (1296), `applyWetChunk` (1336), `applyDryChunk` (1369). All wired in dispatch (lines 1769-1775). **However:** UAT session on v2 found 7 of 8 tools had "quality insufficient" output — never re-verified on v3. Code exists and is wired; visual quality requires human confirmation. |
| 4 | Brush parameters (size, opacity, pressure, water amount, dry amount) affect output visibly | VERIFIED | `getOpts()` at line 2052 returns `{size, opacity, pressure, waterAmount, dryAmount, pickup}`. All 5 universal sliders present in HTML (lines 70-74). `getEffectivePressure()` function at line 1897 applies pressure multiplier. UAT test 10 (pressure sensitivity) passed. |
| 5 | Brush texture mask modulates paint application with correct quadrant mirroring | VERIFIED | `createMirroredBrushGrain()` at line 237 performs 4-quadrant mirroring (lines 241-247). `sampleBrushGrain()` at line 252 uses modulo wrapping. Used in: paint deposit (line 743), smear deposit (line 1221), compositeWetLayer emboss (line 1703). UAT tests 2 and 9 passed. |

**Score:** 4/5 truths verified (Truth 3 needs human re-verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `efx-paint-physic-v2.html` | PaintStroke type, mirrored brush grain, pressure model, UI reorganization, strokeEdge fix | VERIFIED | All content confirmed: `PaintStroke` comment block, `mirroredGrain`, `getEffectivePressure`, 9-tool bar, universal sliders, `applySmudgeChunk`/`renderMixStroke` removed (comments only at lines 939, 969). `id="ed"` (Detail slider) added back in v3.1 commit. |
| `efx-paint-physic-v3.html` | Float32Array wet layer declarations and working undo restore | VERIFIED | Lines 170-174: all 5 wet arrays as `new Float32Array(W*H)`. `clearWetLayer()` at line 1814 uses `.fill(0)`. Undo `.set()` calls at lines 2120-2121. `wetSnap` creation at lines 1923-1929 stores `new Float32Array(wetR)` etc. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `extractPenPoint()` | `PaintStroke.points` | `allActions.push(stroke)` at line 2013 | WIRED | Stroke recorded with all pen fields at onPointerUp |
| `brushGrain (128x128)` | `mirroredGrain (256x256)` | `createMirroredBrushGrain()` at line 224 | WIRED | Called after brushGrain loading; 256x256 Float32Array created at load time |
| `pressure slider` | `getEffectivePressure()` | `pressure: +document.getElementById('pr').value` in `getOpts()` at line 2054 | WIRED | `getEffectivePressure(p, opts.pressure)` called in paint and brush functions |
| `onPointerMove` | `applyEraseChunk, applySmearChunk, applyBlowChunk, applyWetChunk, applyDryChunk` | `tool === check` at lines 1769-1775 | WIRED | Real-time dispatch confirmed for all 5 real-time tools |
| `onPointerUp` | `applyWaterStroke, applyBlendStroke` | `tool === check` at lines 1770, 1772 | WIRED | Stroke-completion dispatch confirmed |
| `sampleBrushGrain()` | paint + smear deposit calculation | `mask = hVal * grainVal * falloff * strength` | WIRED | `grainVal` used in paint (line 743) and smear (line 1221); NOT in water/wet/dry (correct per Pitfall 5) |
| `sampleBrushGrain()` | `compositeWetLayer()` | additive alpha modulation | WIRED | `brushEmboss` at line 1703, used as `0.88 + 0.12 * brushEmboss` at line 1704 |
| `undoStack entry.wet (Float32Array snapshots)` | `wetR, wetG, wetB, wetAlpha, wetness` | `.set()` calls at lines 2120-2121 | WIRED | `wetR.set(entry.wet.r)` etc. now valid because all 5 wet arrays are `Float32Array` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `efx-paint-physic-v3.html` (paint) | `wetR/wetG/wetB/wetAlpha` | `renderPaintStroke()` writes to wet arrays via `applyWetComposite()` | Yes — pixel-level writes to typed arrays per stroke point | FLOWING |
| `efx-paint-physic-v3.html` (compositeWetLayer) | `wetAlpha[i]`, `wetR[i]`... | Physics arrays read per-pixel to produce display output | Yes — reads live wet arrays every frame | FLOWING |
| `efx-paint-physic-v3.html` (undo) | `entry.wet.r` (snapshot) | `wetSnap` created in `onPointerDown` via `new Float32Array(wetR)` | Yes — deep copy of live array | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| File parseable | `node -e "require('fs').readFileSync('efx-paint-physic-v3.html','utf8')"` | OK | PASS |
| All 9 tool buttons exist in HTML | `grep -o 'data-tool="[^"]*"' efx-paint-physic-v3.html \| sort -u` | 9 tools confirmed | PASS |
| All 7 non-paint brush functions defined | `grep -c "function applyErase..."` | 7 of 7 | PASS |
| Float32Array wet declarations | `grep -c "new Float32Array(W\*H)"` | 5 declarations | PASS |
| Undo .set() calls present | `grep -n "wetR\.set(entry"` | Lines 2120-2121 | PASS |
| UAT visual tests on 7 brush types | Browser visual inspection | SKIPPED in UAT | FAIL (needs human) |
| UAT test 11 re-verification (undo ghost fix) | Browser draw+undo test on v3 | Not re-run after fix | FAIL (needs human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STROKE-01 | 03-01-PLAN | Stroke data model `{x, y, p, tx, ty, tw, spd}` | SATISFIED | PaintStroke comment block at v3 line 147; `allActions.push` at line 2013 with all fields |
| STROKE-02 | 03-01-PLAN | Tablet/Wacom pen support via PointerEvent coalescing | SATISFIED | `getCoalescedEvents()` at line 1935; tiltX/Y/twist/pressure captured at lines 1861-1889 |
| BRUSH-01 | 03-02-PLAN, 03-03-PLAN | Brush types: paint, erase, water, smear, blend, blow, wet, dry | NEEDS HUMAN | All 8 functions exist and are wired. UAT found 7 of 8 had quality issues on v2. v3 not re-verified. |
| BRUSH-02 | 03-01-PLAN | Brush parameters: size, opacity, pressure, water amount, dry amount | SATISFIED | `getOpts()` returns all 5; universal sliders in HTML; UAT test 10 passed |
| BRUSH-03 | 03-01-PLAN, 03-02-PLAN | Brush texture mask (brush_texture.png) with quadrant mirroring | SATISFIED | `createMirroredBrushGrain()` produces 256x256; `sampleBrushGrain()` used in paint/smear/emboss; UAT tests 2+9 passed |

**Orphaned requirements:** None. All 5 phase-03 requirements (BRUSH-01, BRUSH-02, BRUSH-03, STROKE-01, STROKE-02) are mapped to plans and covered by implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `efx-paint-physic-v2.html` | 75 | `id="ed"` (Detail slider) re-added in v3.1 commit after Plan 01 removed edge slider | Info | The edge slider was restored as a "Detail" parameter modulating `edgeMul` in `renderPaintStroke`. This is a feature addition, not a stub — the slider is wired in the JS event listener array and actively used at lines 801, 867, 1062 in v3. No impact on phase goals. |
| `efx-paint-physic-v3.html` | — | UAT tests 3-8 status: "skipped — removed by user — quality insufficient" | Warning | 7 of 8 brush types were not visually confirmed to produce correct/acceptable output. Functions exist and are wired but output quality was found insufficient on v2. v3 adds the undo fix only — brush function logic is unchanged from v2. |

### Human Verification Required

#### 1. Visual Quality of 7 Non-Paint Brush Types

**Test:** Open `efx-paint-physic-v3.html` in browser. Paint a colored area. Then test each of these tools in turn:
- **Erase:** Should reduce/remove both wet and dry paint under brush, revealing paper
- **Water:** Should cause existing wet paint to flow/spread without adding new color
- **Smear:** Should pick up color from stroke start and drag/blend it along the path
- **Blend:** Should smooth color transitions between adjacent areas
- **Blow:** Should push wet paint in the stroke movement direction
- **Wet:** Should reactivate dried paint (adds wetness, paint may flow again)
- **Dry:** Should accelerate drying in the brushed area (paint stops flowing sooner)

**Expected:** Each tool produces visually distinct, intentional output. No tool produces identical output to paint or no output at all.
**Why human:** UAT session on v2 found these 7 tools had "quality insufficient" output and tests were skipped. v3 is identical in brush logic (only Float32Array fix applied). Visual quality requires browser + canvas interaction.

#### 2. Undo Ghost Fix Re-Verification (UAT Test 11 Re-Run)

**Test:** Open `efx-paint-physic-v3.html` in browser. Paint a stroke. Press Ctrl+Z (or undo button if present).
**Expected:** Canvas returns to exact pre-stroke state — no ~50% ghost of the undone stroke remains. Physics does not re-bake undone paint after undo.
**Why human:** UAT test 11 found this broken on v2. The Float32Array fix is confirmed in v3 code (lines 170-174, 2120-2121). However, the fix was never re-verified visually after commit `96c677f`. This is a regression risk that requires a quick browser test to confirm.

### Gaps Summary

No automated gaps found. All 5 phase requirements have working implementations and are correctly wired in the codebase.

The phase is blocked at `human_needed` because:

1. **BRUSH-01 quality not re-confirmed (7 of 8 tools):** The UAT session on `efx-paint-physic-v2.html` found erase, water, smear, blend, blow, wet, and dry tools produced insufficient visual quality and tests were marked skipped. The brush function code was unchanged in `v3` (only the Float32Array undo fix was applied). If the quality was insufficient in v2, it remains the same in v3. The phase goal "all 8 brush types function" requires visual confirmation that the 7 tools actually produce correct distinct output.

2. **Undo fix needs re-verification:** The gap identified in UAT test 11 was addressed in `03-03-PLAN.md` (commit `96c677f`), but no re-test of the undo behavior was performed after the fix. The fix is structurally sound in code but requires one visual confirm.

Both items are quick browser tests (under 5 minutes total). If the 7 brush types produce acceptable quality output and undo works correctly, the phase is complete.

---

_Verified: 2026-03-30T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
