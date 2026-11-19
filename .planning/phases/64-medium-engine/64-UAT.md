---
status: testing
phase: 64-medium-engine
source: [64-VERIFICATION.md]
started: 2026-11-17T17:33:35Z
updated: 2026-11-18T19:08:56Z
---

## Current Test

number: 1
name: Set Viscosity to 100 on a fresh stroke and compare with 0.
expected: |
  Paint visibly hardens — it stops moving almost immediately and the deposit reads denser — while a neutral (0) watercolor stroke is unchanged.
awaiting: user response

## Tests

### 1. Set Viscosity to 100 on a fresh stroke and compare with 0.
expected: Paint visibly hardens — it stops moving almost immediately and the deposit reads denser — while a neutral (0) watercolor stroke is unchanged.
result: [pending]

### 2. Undo and redo a thick embossed stroke and a covering (Body high) stroke.
expected: Pigment, thickness and coverage restore together; redo restores the same values, and the covered underlayer disappears again with the coverage — an undo that leaves a stale cover channel would show through as a hole in the restored paint.
result: [pending]

### 3. Reopen the project and replay without repainting; then switch paint layers with different document lights.
expected: The same relief repaints from script alone; each layer re-shades to its own light.
result: [pending]

### 4. In the Paper & Light tab, drag Azimuth / Elevation / Intensity without painting.
expected: The settled wash re-lights immediately; the tab reads `Paper & Light`; one slider gesture is one undo step that restores the previous light.
result: [pending]

### 5. After a light change, Play (reveal) and Apply/stroke-edit bakes.
expected: The baked frames match the live sheet's new light. The Play-Script dialog bake is a separate declared deferral and is not part of this row.
result: [pending]

### 6. Zoom/pan over a thick embossed stroke; raise Emboss on a thick stroke.
expected: No shimmer or crawl; the paint reads as raised with a lit side and a shadow side.
result: [pending]

### 7. Pick the five mediums and paint five strokes; pick two brushes inside one group after a manual tweak; pick acrylic vs watercolor.
expected: Each stroke keeps its own look on replay; a same-group pick keeps the manual tweak; acrylic reads as opaque coverage — it hides the paint under it and keeps its own colour — watercolor a wash that does not cover.
result: [pending]

### 8. Body/order and scattering rows: light pigment high Body over a dried dark area; Body 50; dark pigment high Body; water above zero at the border.
expected: High Body covers the dried dark area by compositing — light, with no bleed-through and no paper-white; Body 50 partly covers and lightens without destroying the underlayer; a dark high-Body stroke hides the underlayer and stays its own dark colour; the border blends when water > 0.
result: [pending]

### 9. Dry, replay, undo/redo, and export in every mode (paper, transparent, white, pigment) after scattering; zoom over a scattered area.
expected: Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer.
result: [pending]

### 10. Open the medium dropdown in the Paint tab and inspect the five brush-library sections.
expected: Dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse.
result: [pending]

### 11. Acrylic Bristle Round and Bristle Flat, Feather 100 and Pickup 100.
expected: The stroke reads as loaded paint — distinguishable hairs, colour dragged from the canvas, a feathered edge — and the two controls visibly change the result as they move.
result: [failed] — no perceptible change between low and 100 % on either control; strokes read as flat soft bars.

### 12. Body as a mixer with the background (SPECS/v2.2.0-medium-engine/better-acrylic.md, request 1: "Blend instead transparence").
expected: Body 100 % acts as a full mixer with the underlying paint, Body 0 % mixes nothing, and the rim carries its own blend falloff rather than a hard line.
result: [failed] — Body behaves as a transparency/coverage term, the rim is a hard line, and a pale halo outlines every bristle stroke.

### 13. Edge anti-aliasing and acrylic water (spec requests 2 and 3).
expected: A directional smooth on the stroke edges (no aliasing on the border or inside), watery irregular edges that are not ruler-straight, and the wet control stopping edge mixing with Feather setting how much edge mixing happens.
result: [failed] — edges are uniformly soft/hard with visible aliasing, there is no water flow, and no wet gating of edge mixing.

### 14. Same stroke with a texture tip bound versus the default bristle tip.
expected: The bristle engine composites with a texture tip and the result is at least as good as either path alone.
result: [failed] — the texture-tip stroke reads closer to the reference than the new default-tip bristle path. Mechanically, `isBristleResponse()` excludes any brush carrying a `textureId`, so the textured stroke bypasses the new engine entirely.

## Summary

total: 14
passed: 0
issues: 4
pending: 10
skipped: 0
blocked: 0

## Gaps

**GAP-1 — Body is a transparency term, not a mixer (spec request 1).**
Expected: `Body` is the mixing ratio against the underlying paint, with a blend falloff on the rim.
Actual: Body feeds a coverage/cover mask; the live compositor derives its alpha as `max(darkAlpha, cov)` (`shaders.ts`, mode-4 display law) where `cov` is the union accumulated by `coverBristlePass` (`gl.blendFunc(ZERO, ONE_MINUS_SRC_COLOR)`). Where the cover union extends past the pigment, alpha is promoted while the solved pigment goes near-white — the pale halo, and the reason Body reads as opacity rather than mixing.
Reference law: `craft-brushes/notes/brush-blending.md` §1/§3.5 — the only compositing operation is `mix(canvas, carried, deposit)`.

**GAP-2 — Feather and Pickup are inert in the visible result.**
Expected: both controls move the look.
Actual: Feather only widens the gather's `softness` (0.09 → 0.34), a modest blur; Pickup only feeds the carrier rates. Neither changes the deposited colour's structure, so at 100 % the stroke is indistinguishable from a default one. The reference's visible structure comes from the per-bristle tufts, `broken`, the paper threshold and the rim contact noise — all present in the gather, but their effect is flattened by the compositing path in GAP-1.

**GAP-3 — Edge aliasing and no acrylic water (spec requests 2 and 3).**
Expected: a directional smooth along the brush direction, irregular watery edges, and a wet control that stops edge mixing with Feather setting the amount.
Actual: no directional anti-aliasing step exists; the only edge softening is the isotropic `smoothstep(threshold ± uSoftness)`. There is no edge-mixing term and no wet gate on it.

**GAP-4 — The bristle engine is disabled by a texture tip.**
Expected: the engine and a texture tip compose.
Actual: `isBristleResponse()` in `brushes.ts` requires `textureId == null`, so every textured stroke — the one that currently looks best — runs the old path. This is also why the two A/B tests compared two different engines.

**GAP-5 — Missing `smear` (spec: "les trainées… trainant des couleurs sous jacente").**
Expected: paint dragged from the canvas under the stroke, mottled along the stroke.
Actual: the reference's §3.3 deposit-time smear was deliberately unported (D-28, "never an RGB smear"). The user asks for the visible effect; the port needs to happen in coefficient space to respect D-28.

**Phase status: NOT complete.** Four UAT rows failed; the phase goal ("a stroke reads denser, heavier and genuinely opaque") is not met at the visible level even though every automated gate is green.
