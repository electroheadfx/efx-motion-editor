---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 56-10
requirement: AQUA-08
status: complete
verdict: passed
staged: 2026-10-16T05:25:00Z
closed: 2026-10-21
rows_total: 5
rows_pass: 5
rows_pending: 0
---

# Phase 56 Live UAT — AQUA-08 Acceptance Rows (A1–A5)

**Scope:** R3.6 acceptance rows for the watercolour engine, bake, and Studio script path.
**Evidence policy:** Live/disk over unit probes for anything crossing WebGL or Tauri (`01-gsd-context.md` §8). A1–A2 may use golden WebP hashes. **A3 is live visual judgment and cannot be closed by unit tests.**
**Phase verdict:** **PASSED** — the user ran the end-of-phase batch and approved all five rows on 2026-10-21.

## Tests

### 1. A1 — record → save → load → play reproduces the marks
expected: record a short aquarelle script, save, close, reopen, play and bake — the baked marks match the pre-save bake (pixel-stable).
result: pass
evidence: golden WebP hash compare (disk)
evidence_note: user-approved live UAT 2026-10-21.

### 2. A2 — two plays of one script bake identical WebP
expected: two bakes of the same script from a clean cache produce identical bytes.
result: pass
evidence: golden hash compare (disk)
evidence_note: user-approved live UAT 2026-10-21.

### 3. A3 — wet-in-wet bloom and tide line survive (LIVE VISUAL)
expected: soft bloom where wet pigment meets wet pigment; a darker tide line at the drying edge; neither killed at a frame boundary during playback.
result: pass
evidence: live visual (native app)
evidence_note: user-approved live visual assertion 2026-10-21. No forced Dry at frame boundaries; bloom and tide line are visible in the baked frames.

### 4. A4 — independent cache ranges
expected: one script applied at two touching, non-overlapping ranges yields two independent cache ranges with no cross-talk.
result: pass
evidence: cache-path / inspect (disk)
evidence_note: user-approved live UAT 2026-10-21. Overlapping ranges remain out of scope.

### 5. A5 — export transparency
expected: exporting the baked range leaves the background transparent where paint is absent; an empty range is a no-op, not an error.
result: pass
evidence: export file alpha inspect (disk)
evidence_note: user-approved live UAT 2026-10-21.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.

## Row procedures (as executed)

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
4. **PASS** if background is transparent where paint is absent. **FAIL** if an opaque fill covers empty regions. Empty-range export is a no-op, not an error.

## Human UAT batch protocol (completed 2026-10-21)

1. Ran the native app (local-dev) with the user driving the UI.
2. Executed rows A1→A5 serially.
3. Recorded PASS per row above; A3 is a live visual assertion.
4. AQUA-08 closes and Phase 56 is complete.
