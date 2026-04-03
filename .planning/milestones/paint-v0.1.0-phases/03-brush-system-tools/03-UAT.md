---
status: closed
phase: 03-brush-system-tools
source: 03-01-SUMMARY.md, 03-02-PLAN.md (executed, commit 5bc4afe)
started: 2026-03-30T17:00:00Z
updated: 2026-03-30T17:04:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Tool Selection UI
expected: 9 tool buttons visible (paint, erase, water, smear, blend, blow, wet, dry, liquify). Clicking each selects it with visual highlight. Universal sliders always visible. Paint tool shows contextual pickup slider; other tools hide it.
result: pass
note: User removed erase, water, smear, blend, blow, wet, dry, liquify tools (quality insufficient). Only paint tool remains.

### 2. Paint Tool with Brush Grain
expected: Selecting paint tool and drawing produces colored strokes. Stroke shows visible texture variation from brush grain — not a flat uniform fill but subtle grain modulation across the stroke body.
result: pass

### 3. Erase Tool
expected: Paint something first. Switch to erase tool and draw over existing paint. Both wet and dry paint under the brush stroke is removed/reduced, revealing the paper beneath.
result: skipped
reason: Tool removed by user — quality insufficient

### 4. Water Tool
expected: Paint a stroke, then switch to water tool. Drawing over wet paint causes it to flow/spread without adding any new color. The existing paint disperses outward.
result: skipped
reason: Tool removed by user — quality insufficient

### 5. Smear Tool
expected: Paint a colored area. Switch to smear tool. Drawing through the painted area picks up color from where the stroke starts and drags/deposits it along the stroke path, blending as it goes.
result: skipped
reason: Tool removed by user — quality insufficient

### 6. Blend Tool
expected: Paint two adjacent colors. Switch to blend tool. Drawing across the boundary smooths and averages the colors, creating a softer transition between them.
result: skipped
reason: Tool removed by user — quality insufficient

### 7. Blow Tool
expected: Paint a wet stroke. Switch to blow tool. Drawing in a direction near the wet paint pushes it in the stroke direction, like blowing on wet watercolor.
result: skipped
reason: Tool removed by user — quality insufficient

### 8. Wet/Dry Tools
expected: Wet tool: drawing over dried or drying paint reactivates it (adds wetness, paint may start flowing again). Dry tool: drawing over wet paint accelerates drying (paint stops flowing sooner in that area).
result: skipped
reason: Tools removed by user — quality insufficient

### 9. Brush Grain Emboss on Wet Paint
expected: When wet paint is on canvas, the surface shows a subtle emboss/texture grain effect — not a flat color but visible paper-like grain on the wet paint itself. This is separate from the paper texture background.
result: pass

### 10. Pressure Sensitivity
expected: If using a tablet/pen: stroke width and/or opacity varies with pen pressure. Lighter press = thinner/lighter stroke, harder press = wider/darker. If using mouse: pressure slider controls the fixed pressure value.
result: pass

### 11. Wet Layer Undo
expected: After painting, undo (Ctrl+Z or undo button if present) reverts the last stroke on the wet layer. The canvas returns to the state before that stroke was applied.
result: issue
reported: "A undo should stop the physics because it no undo on the last brush (the last brush stay at 50% transparence or strength)"
severity: major

## Summary

total: 11
passed: 4
issues: 1
pending: 0
skipped: 6
blocked: 0

## Gaps

- truth: "Undo reverts last stroke completely — canvas returns to pre-stroke state"
  status: failed
  reason: "User reported: A undo should stop the physics because it no undo on the last brush (the last brush stay at 50% transparence or strength)"
  severity: major
  test: 11
  root_cause: "Wet layer arrays are regular JS Arrays (new Array(W*H).fill(0)) but undo restore calls .set() which is TypedArray-only. TypeError aborts handler mid-execution — canvas image restores but wet arrays keep stroke data. Physics dryStep then bakes unreset wet paint onto restored canvas, creating ~50% ghost."
  artifacts:
    - path: "efx-paint-physic-v3.html"
      issue: "Lines 172-176: wet arrays declared as new Array() instead of Float32Array. Lines 2216-2217: .set() calls fail silently on regular Arrays."
  missing:
    - "Change wet array declarations from new Array(W*H).fill(0) to new Float32Array(W*H) so .set() works natively"
  debug_session: ".planning/debug/undo-physics-leak.md"
