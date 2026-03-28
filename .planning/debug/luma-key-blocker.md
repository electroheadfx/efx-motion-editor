---
status: resolved
trigger: "Luma key compositing is making non-white paint transparent. Blue paint on white background appears semi-transparent. Only white pixels should become transparent (alpha key), but even blue/gray strokes are affected."
created: 2026-03-27T19:00:00Z
updated: 2026-03-27T19:30:00Z
---

## Current Focus

root_cause: **CONFIRMED** - The alpha formula `alpha = 255 - luma` in lumaKey.ts produces semi-transparent alpha for all non-fully-white/non-fully-black colors instead of fully opaque (alpha=255).

fix: Replace `alpha = 255 - luma` with a threshold-based formula: `alpha = (luma >= 254) ? 0 : 255` for luma key mode. This makes only near-white pixels transparent and all other pixels fully opaque.

## Symptoms

expected: Luma key should only make WHITE pixels transparent. A blue stroke should remain fully opaque (alpha=255).
actual: Blue paint on white background appears semi-transparent. Gray strokes also appear semi-transparent.
errors: No error messages - visual appearance bug.
reproduction: Paint blue stroke on white background, enable luma key, observe semi-transparent blue.
started: Phase 25 implementation (commit 2b56e67)

## Eliminated

- hypothesis: Luma key applied to entire canvas including white background
  evidence: The implementation correctly applies luma key only to the paint layer offscreen canvas, not after compositing onto background. Code at previewRenderer.ts line 295-309 creates a copy and applies luma key before compositing.
  timestamp: 2026-03-27T19:15:00Z

- hypothesis: Bug in alpha formula (255 - luma) being applied incorrectly
  evidence: The formula IS applied correctly. However, the formula itself is fundamentally wrong for the stated goal.
  timestamp: 2026-03-27T19:20:00Z

- hypothesis: Luma key applied at wrong stage (on composite result)
  evidence: Code correctly applies luma key to paint layer before compositing onto background (previewRenderer.ts lines 295-309).
  timestamp: 2026-03-27T19:15:00Z

## Evidence

- timestamp: 2026-03-27T19:10:00Z
  checked: lumaKey.ts - applyLumaKey function
  found: Formula `data[i + 3] = 255 - luma` is applied identically for both invert and non-invert modes (lines 41 and 46)
  implication: For a pure blue pixel (0,0,255), luma = 0.0722*255 = 18.4, so alpha = 255 - 18.4 = 236.6 (NOT 255). This is semi-transparent, not fully opaque.

- timestamp: 2026-03-27T19:12:00Z
  checked: lumaKey.ts - ITU-R BT.709 weights
  found: LUMA_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 }. For pure red (255,0,0): luma=54, alpha=201. For pure green (0,255,0): luma=182, alpha=73. Only black (0,0,0) gets alpha=255.
  implication: The formula produces semi-transparent results for ANY non-black/non-white color. Blue strokes are 93% opaque (alpha=237), gray (128,128,128) is 50% opaque (alpha=127).

- timestamp: 2026-03-27T19:15:00Z
  checked: previewRenderer.ts - compositing flow
  found: Lines 286-319 correctly create offscreen canvas, render paint frame with white background, then create a COPY for luma processing before compositing.
  implication: Luma key IS applied at the correct stage (paint layer only, before compositing onto background).

- timestamp: 2026-03-27T19:18:00Z
  checked: lumaKey.test.ts - unit tests
  found: Tests explicitly verify the formula `alpha = 255 - luma` produces alpha≈237 for blue, alpha≈201 for red, alpha≈127 for gray. Tests PASS because they test the formula, not the desired visual behavior.
  implication: Unit tests confirm the bug exists as designed - they test the current (incorrect) formula, not the intended behavior.

- timestamp: 2026-03-27T19:20:00Z
  checked: paintRenderer.ts - background rendering
  found: renderPaintFrameWithBg fills canvas with paintBgColor (default white) before rendering strokes. Blue stroke pixels do NOT blend with white - they have their own RGB values.
  implication: Blue stroke pixels on the canvas have their own blue RGB, NOT blended with white. The luma is calculated from the stroke color alone.

## Resolution

root_cause: The alpha formula `alpha = 255 - luma` in lumaKey.ts is fundamentally wrong for the stated goal of "only white pixels become transparent, colored strokes remain opaque."

For a blue stroke pixel RGB(0,0,255):
- luma = 0.0722 * 255 = 18.4
- alpha = 255 - 18.4 = 236.6 (semi-transparent, 93% opaque)

For a gray stroke pixel RGB(128,128,128):
- luma = 128
- alpha = 255 - 128 = 127 (50% transparent!)

The formula makes EVERYTHING semi-transparent except pure black (luma=0 → alpha=255) and pure white (luma=255 → alpha=0).

fix: Replace the `255 - luma` formula with a threshold-based approach for luma key mode:

```typescript
// Luma Key: white BG → transparent, colored strokes → opaque
if (luma >= 254) {
  data[i + 3] = 0;  // near-white: transparent
} else {
  data[i + 3] = 255;  // any other color: fully opaque
}
```

For luma invert mode, the formula should be:
```typescript
// Luma Invert: black strokes → white opaque, white BG → transparent
if (luma < 1) {
  data[i + 3] = 255;  // near-black: opaque (becomes white)
} else {
  data[i + 3] = 0;  // anything else: transparent
}
```

verification: After fix, verify:
1. Blue stroke on white BG with luma key: blue should be fully opaque
2. Gray stroke on white BG with luma key: gray should be fully opaque
3. White BG with luma key: white should be fully transparent
4. Black stroke on white BG with luma invert: stroke should be white opaque

files_changed:
- Application/src/lib/lumaKey.ts (fix alpha formula)
- Application/src/lib/lumaKey.test.ts (update tests to verify correct behavior)
