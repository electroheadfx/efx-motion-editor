---
id: 261003-d08-tier-parity-harness-rescope
title: "Retire or re-scope the D-08 tier-parity harness row to the one-pipeline contract"
status: pending
created: 2026-10-03
resolves_phase: "53.1"
source: 52.4-REVIEW.md CR-01
severity: critical
---

# Retire or re-scope the D-08 tier-parity harness row

**CR-01 (from 52.4-REVIEW.md):** `computeTierParityMetrics` compares the final-tier plane against itself → `tierParityPasses` returns true unconditionally (false green).

**Root cause:** Since quick 260930-wm6, the engine runs exactly one `tier='final'` continuation. The `'stroke-first-raster-publication'` event fires after `transferToWetLayerClipped` already read the offscreen, so the "live plane" and the "final plane" are two reads of the same buffer with no writes between. `computeTierParityMetrics` receives byte-identical inputs → all metrics 0 → pass.

**Files:**
- `app/src/components/physic-paint/performance/depositSpeckleCapture.ts:1692-1729` (capture logic)
- `app/src/components/physic-paint/performance/depositSpeckleCapture.ts:1663-1675, 1342-1355` (wiring)

**Fix options:**
1. **Retire the row** — the D-08 two-tier contract is superseded by the one-pipeline contract (260930-wm6); remove `tierParity` from the DH1 manifest
2. **Re-scope the row** — capture two genuinely distinct surfaces (e.g. pre-transfer vs post-transfer) that exercise the one-pipeline contract meaningfully

**Not covered by 52.4 supersession overrides** — this is a measurement-harness defect, not a plan-literal vs quick conflict.

**Links:** 52.4-REVIEW.md CR-01, 52.4-VERIFICATION.md gap 1 (D-07 override), quick 260930-wm6
