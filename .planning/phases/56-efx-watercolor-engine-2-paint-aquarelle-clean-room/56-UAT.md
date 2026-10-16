---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 56-10
requirement: AQUA-08
status: staged
verdict: automated-ready
staged: 2026-10-16T05:25:00Z
rows_total: 5
rows_pass: 0
rows_pending: 5
---

# Phase 56 Live UAT — AQUA-08 Acceptance Rows (A1–A5)

**Scope:** R3.6 acceptance rows for the watercolour engine, bake, and Studio script path.
**Evidence policy:** Live/disk over unit probes for anything crossing WebGL or Tauri (`01-gsd-context.md` §8). A1–A2 may use golden WebP hashes. **A3 is live visual judgment and cannot be closed by unit tests.**
**Phase verdict:** `automated-ready` until the user asserts A1–A5. Do not claim done before live UAT (project law `feedback_no_done_before_uat`).

## Rows

| Row | Truth | Evidence type | Verdict | Evidence note |
|-----|-------|---------------|---------|---------------|
| A1 | record → save → load → play reproduces the marks (pixel-stable bake) | golden WebP hash compare (disk) | PENDING | human_judgment |
| A2 | two plays of one script bake identical WebP | golden hash compare (disk) | PENDING | human_judgment |
| A3 | wet-in-wet bloom and tide line are visible in the baked frames (not killed at a frame boundary) | **LIVE visual (native app)** | PENDING | human_judgment — screenshot or written confirmation; never a unit-test cite |
| A4 | a script applied twice at different timeline ranges yields two independent cache ranges (no cross-talk) | cache-path / inspect evidence (disk) | PENDING | human_judgment — touching ranges only |
| A5 | export of the baked range has transparent background where paint is absent | export file alpha inspect (disk) | PENDING | human_judgment |

## Row procedures

### A1 — pixel-stable bake across save/load
1. Record a short aquarelle script (2–3 strokes, one Dry event) in Water color module.
2. Save the project. Close. Reopen.
3. Play the script and bake.
4. Compare the baked WebP bytes (or frame digests) against the pre-save bake of the same script.
5. **PASS** if marks are reproduced (hash match under one encoder version). **FAIL** if any frame drifts.

### A2 — bake idempotence
1. Play + bake one script twice from a clean cache.
2. Compare the two WebP sets.
3. **PASS** if identical bytes. **FAIL** if any byte differs.

### A3 — bloom and tide line survive (LIVE VISUAL)
1. Record a wet-in-wet stroke pair (wet bleed across the seam) plus a slow wash that dries into a tide line.
2. Bake and scrub the baked frames in the native app.
3. Look for: soft bloom where wet pigment meets wet pigment; a darker tide line at the drying edge.
4. **P4:** no forced Dry at frame boundaries during playback — if bloom dies at a frame boundary the row **FAILS**.
5. **PASS** only on live visual confirmation (screenshot or written assertion). Unit probes do not close this row.

### A4 — independent cache ranges
1. Apply one script at timeline range R1. Let it bake. Note the cache range.
2. Apply the same (or another) script at a non-overlapping range R2 (touching is allowed).
3. Inspect cache paths / ranges.
4. **PASS** if two independent ranges exist with no cross-talk (editing/clearing one leaves the other). **FAIL** if ranges merge or one apply overwrites the other. Overlapping ranges are out of scope.

### A5 — export transparency
1. Bake a range that leaves part of the canvas unpainted.
2. Export the baked range.
3. Inspect the exported file alpha where paint is absent.
4. **PASS** if background is transparent where paint is absent. **FAIL** if a opaque fill covers empty regions. Empty-range export is a no-op, not an error.

## Human UAT batch protocol (end of phase)

1. Run the native app (local-dev). Do **not** let Claude drive the UI (project law `feedback_no_chrome_devtools` / `feedback_live_evidence_over_unit_probes`).
2. Execute rows A1→A5 in order. Keep UAT runs serial — no two sessions share one cache directory.
3. Record PASS/FAIL per row in the table above with an evidence note (hash pair, cache paths, screenshot ref, or written confirmation).
4. **A3 evidence must be a live visual assertion** (screenshot or written confirmation), not a unit-test cite.
5. On any FAIL: **stop** and route to a gap-closure plan. Do not paper over.
6. When all five rows read PASS with evidence notes, AQUA-08 closes and Phase 56 is complete.

## Current state

All rows **PENDING**. Phase is **automated-ready** (full suite + typecheck green — see `56-VERIFICATION.md`). Awaiting the end-of-phase human batch.
