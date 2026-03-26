---
status: resolved
trigger: "Investigate why motion path dots are not dense enough on short sequences (< 30 frames)"
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
---

## Current Focus

hypothesis: Math.round(f) on line 63 collapses sub-frame samples to integer keys, and duplicate React keys on line 186 cause Preact to discard all but one dot per integer frame -- nullifying the 0.25-step density boost entirely
test: Confirmed via code analysis
expecting: N/A -- root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: Short sequences (< 30 frames) should show ~4x denser dots due to sub-frame sampling at step=0.25
actual: Dots appear no denser than step=1 integer sampling
errors: No runtime errors; silent rendering deduplication
reproduction: Select a layer with motion keyframes spanning < 30 frames; observe motion path dots
started: Since sub-frame sampling was introduced (D-11/UXP-03)

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-26T00:01:00Z
  checked: sampleMotionDots function (MotionPath.tsx lines 42-69)
  found: step=0.25 for span < 30 frames; loop samples at fractional frames (0, 0.25, 0.5, ...)
  implication: Sub-frame sampling IS happening correctly at the data level

- timestamp: 2026-03-26T00:02:00Z
  checked: interpolateAt in keyframeEngine.ts
  found: Fully supports fractional frame values; lerp math has no integer rounding
  implication: Interpolation engine produces distinct positions for each sub-frame sample

- timestamp: 2026-03-26T00:03:00Z
  checked: Math.round(f) on line 63 of MotionPath.tsx
  found: All sub-frame values (0, 0.25, 0.5, 0.75) collapse to at most 2 integer values per frame
  implication: The 41 distinct positions generated for a 10-frame span become 11 unique frame keys

- timestamp: 2026-03-26T00:04:00Z
  checked: Rendering loop on line 186: key={dot.frame}
  found: Preact deduplicates elements by key; duplicate keys cause only the last element per key to survive
  implication: ~75% of computed dots are silently discarded by the renderer

- timestamp: 2026-03-26T00:05:00Z
  checked: currentDot lookup on line 156: dots.find((d) => d.frame === localFrame)
  found: localFrame is integer; lookup relies on dot.frame being integer-rounded
  implication: The currentDot highlight logic depends on integer frame values in the dots array

## Resolution

root_cause: Two compounding issues nullify sub-frame sampling:
  1. Line 63: `frame: Math.round(f)` collapses sub-frame positions (0, 0.25, 0.5, 0.75) to integer frame values
  2. Line 186: `key={dot.frame}` uses the rounded integer as the Preact element key, causing duplicate-key deduplication
  Result: For a 10-frame span, 41 computed dots collapse to 11 rendered dots -- identical to step=1

fix: (not yet applied -- diagnosis only)
verification: (not yet applied)
files_changed: []
