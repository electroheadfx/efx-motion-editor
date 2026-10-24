---
id: 261024-frame-fade-compositing
title: "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)"
status: pending
created: 2026-10-24
source: debug watercolor-opacity-feasibility
severity: low (idea, not scheduled)
---

# Frame fade — compositing/export cumulative-frame crossfade

**Contract (explicit, not per-stroke opacity):**

- Fades the cumulative frame before/after a stroke boundary: `before + a·(after − before)` per pixel, or the signed per-boundary delta applied to later frames.
- Opacity 100 is an exact identity with the already-baked after-frame (measured 0 LSB on every probe scenario).
- It is a display/export property. It does not alter the simulation, wet-on-wet behaviour, or the stroke's own pixels.
- It goes **stale** if the stroke is later moved, scaled, or re-baked: the captured before/after delta no longer describes the current bake. Any implementation must either invalidate and rebuild the fade on those edits or explicitly document the stale behaviour.
- It must never be surfaced as "Opacity" or per-stroke alpha. Name it **Frame fade**.
- The signed delta can lighten and darken; the clipping policy must be explicit.

**Why separate:** The user chose to keep true per-stroke opacity only in engine 1 (Brush), where it is a real composited alpha, and to keep the Water color dialog free of an "Opacity" label for Pigment. This item records the only viable display-space path from the feasibility probe, with its own name and contract.

**Probe evidence:** `.planning/debug/resolved/watercolor-opacity-feasibility.md`; result JSON `/tmp/watercolor-opacity-probe/result.json`. Display path needs no extra simulation and no extra FBO; one RGBA8 frame is 12 MB at 2048×1536 if materialized.

**Not scheduled.** Revisit only if a compositing/export frame-fade look is explicitly requested.
