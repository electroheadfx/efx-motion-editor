# Quick 260925-iy6 — Deferred items

**Collected:** 2026-09-25
**Owner of the queue:** user
**Status:** CR-01 open (WINDOWS.md #79, NOT waived). WR-02 parked as a separate pass.

---

## 1. GPU paper-pass quick (CR-01 remediation) — QUEUED, design contract LOCKED before it starts

### Why this exists

CR-01 (code review of 260925-iy6, WINDOWS.md #79): `applyPaperPass` washes partial-alpha paint.
Measured in `app/src/lib/paperPass.composeLaw.test.ts` (W3C software compositor model, real
pixels — the op-log harness in `paperPass.test.ts` mocks `createElement` and cannot see colour):

| alpha | law `paint × valley` @ α | shipped `applyPaperPass` |
|---|---|---|
| 1.0 | `(108, 27, 54)` @ 255 | `(108, 27, 54)` ✓ exact |
| 0.5 | `(108, 27, 54)` @ 128 | **`(169, 128, 142)`** ✗ washed |
| 0 | transparent | transparent ✓ |

(paint `[120,30,60]`, valley `230`.) The paint contribution lands at **a²** instead of **a**, and a
`(1 − a) × valley` term is added inside the paint layer while the fond beneath already crosses with
weight `(1 − a)` — the paper is **double-counted**. This is not a physical thin-paint model, and it
leaves any future coverage/visibility pin disagreeing with the alpha byte (the 260924-m7w lesson).

**Proven un-fixable with `drawImage` + `globalCompositeOperation` alone.** Canvas couples every
blend mode to source-over (`Cs' = (1−αb)·Cs + αb·B(Cb,Cs)`, then `Co = αs·Cs' + (1−αs)·Cb`), so a
`(1−α)·other` contamination term survives on whichever side holds the partial alpha. Swapping
source/destination is a **proven no-op** (multiply is commutative) — pinned as
`"is numerically IDENTICAL to the shipped sequence at every alpha"` in
`paperPass.composeLaw.test.ts`. Saturation candidates were measured too: `lighter` self-add fixes
α = 0.5 but **doubles colour at α = 1**; `source-over` self-composite × 3 leaves a residual
`(1−α)³ × valley` = 8/255 at α = 0.5. Forcing alpha to 1 while preserving straight colour needs a
per-pixel divide by alpha — which the frame-path guardrail forbids.

### Escalation trigger (deliberate, not a lucky glance)

Native UAT **row 9** of `260925-iy6-SUMMARY.md`: one stroke on a track at **opacity 0.5**, plus a
**zoom on an AA edge**. If the wash is visible there, escalate to this quick **immediately**. If it
is not visible at that zoom, CR-01 stays open in WINDOWS.md #79 (do **not** waive) and this quick
waits in the queue.

### DESIGN CONTRACT — locked before this quick starts (user, 2026-09-25)

These are constraints, not suggestions. A plan that contradicts any of them is wrong.

1. **NO Canvas2D fallback that keeps the washed GCO chain.** It is **FORBIDDEN**. It would break
   the one-shared-routine export law pinned in 260925-iy6 (the exact dual-pipeline drift 9a deleted).
2. **The paper pass is either EXACT or NOT APPLIED.** On a context with no WebGL/WebGPU, skip the
   pass entirely — no tooth — which is consistent with 260925-dso's flat-without-paper law. A
   missing tooth is a visible, honest degradation; a silently washed tooth is a law break.
3. **One modulation path.** Exactly one implementation of the tooth, consumed by canvas, the
   program monitor, and export — the same `_resolveFlattenedFrame` single seam as today.
4. **The 2D frame pipeline is unchanged.** The GPU pass renders into a scratch surface; the
   existing 2D code `drawImage`s that result into the shared 2D target. Do not convert the
   compositor, the fond draw, or the record freeze/WebP encode to GPU.
5. **Still no per-pixel JS loop in the frame path.** The whole point of the escalation. The shader
   does `out.rgb = paint.rgb × valley.rgb` (+ the tint-scaled lift) and `out.a = paint.a` — one
   draw, exact at every alpha, PIN 0 satisfied by construction (the alpha byte is copied, never
   scaled).
6. **Straight-alpha law D-02 holds.** Do not switch to premultiplied-alpha buffers.
7. **`destination-out` stays absent.** Hole look is still the paper-tinted modulation map, never
   alpha-punch. WR-01's strength clamp stays (valley floor = the paper tint, never black).
8. **Playback real-time stays the hard constraint.** Measure before/after on the same content.

### Acceptance pins for the GPU quick (RED first, real pixels)

- α ∈ {0, 0.5, 1} truth table: `out.rgb = paint.rgb × valley.rgb` and `out.a == paint.a` exactly.
  The two `it.fails` cases in `paperPass.composeLaw.test.ts` flip to `it` and go green; delete the
  GCO model sequences once the shader replaces them, or keep them as the counter-examples.
- PIN 0: `out.a` byte-equal to `in.a` at every pixel (this is the pin 260924-m7w could not see).
- Export parity: the exported file and a canvas capture of the same frame match (shared routine).
- No-WebGL context → the pass returns without touching the target (no tooth), pinned.
- Frame path still contains zero `getImageData` / `putImageData` / typed-array pixel loops.

---

## 2. WR-02 — White + grain-on promises tooth but delivers none (PARKED, separate pass)

**Not in the GPU quick.** Different seam (the gate keys on `paperGrain`, the probe keys on
`background`), and it contains a product decision 260925-dso already settled: **no paper texture
means a flat height field** — procedural fbm was deleted and must not come back. So **White is
toothless by design**.

When this is picked up: make the gate stop promising tooth (align the gate's condition with what
the probe can actually resolve) — do **not** add procedural height, do **not** add a synthetic
grain for White.
