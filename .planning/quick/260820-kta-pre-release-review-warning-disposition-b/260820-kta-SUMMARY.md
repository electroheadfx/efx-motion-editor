---
task: 260820-kta
slug: pre-release-review-warning-disposition-b
date: 2026-08-20
status: complete
verdicts:
  - 43-WR-01: ALREADY-FIXED (0c182594)
  - 43-WR-02: ALREADY-FIXED (2404bbc4, 6fa3e28d)
  - 43-WR-03: ALREADY-FIXED (0de760ab)
  - 43.3-WR-01: ALREADY-FIXED (26c3d14f)
  - 43.3-WR-02: ALREADY-FIXED (26c3d14f)
  - 43.3-WR-03: ACCEPTED
  - 43.3-WR-04: ALREADY-FIXED (26c3d14f)
  - 43.3-WR-05: ALREADY-FIXED (26c3d14f)
  - 43.5-WR-01: FIXED (17a44a9a)
  - 43.5-WR-02: ACCEPTED
  - 43.5-WR-03: ACCEPTED
  - 43.6-WR-02: ACCEPTED
  - 43.6-WR-03: FIXED (cc9ff0e7)
---

# Quick Task 260820-kta: Pre-release review-warning disposition (v0.9.0 final HEAD)

Dispositioned all 13 milestone v0.9.0 code-review warnings against the final
HEAD (832f0c20). Every verdict is recorded in the corresponding phase REVIEW.md
with proof/rationale and date.

## Verdicts

**ALREADY-FIXED (8):** 43 WR-01 (0c182594), 43 WR-02 (2404bbc4, 6fa3e28d),
43 WR-03 (0de760ab), 43.3 WR-01 (26c3d14f), 43.3 WR-02 (26c3d14f),
43.3 WR-04 (26c3d14f), 43.3 WR-05 (26c3d14f).

**FIXED (2):**
- **43.5 WR-01** (`17a44a9a`) — `onPreviewChange` now clears the stale blocked
  tooltip/cursor on any valid preview, not only a null one. RED test `A15`.
- **43.6 WR-03** (`cc9ff0e7`) — the unmount effect now releases a held recovery
  lease so a window close does not orphan the token and block edits on remount.
  RED test added.

**ACCEPTED (3):**
- **43.3 WR-03** — duplicate loop-range derivation is deterministic from the same
  canonical inputs; dedupe would change the resolver proposal contract for
  marginal benefit.
- **43.5 WR-02** — re-derived against the revised (option B) suffix-set semantics;
  the frame-0-only reverse-close is the deliberate safe case, and the proposed
  `leftBoundary` generalization would wrongly remove pre-existing breaks.
- **43.5 WR-03** — re-arm watchdog race is narrow and the design intent is
  documented; distinguishing manual vs settlement disarm adds fragility.
- **43.6 WR-02** — the silent-undo-no-op is real but the whitelist fix breaks the
  child-authoritative selection model (test 3487); a correct fix needs the child
  to communicate its true pre-op selection (architectural, deferred).

## Native UAT required (visible-behavior changes)

- **43.5 WR-01** — stale blocked-direction tooltip / not-allowed cursor after a
  blocked drag becomes valid.
- **43.6 WR-03** — window close while a recovery lease is held no longer blocks
  edits on remount.

## Test + typecheck

- Full suite: 2666 passed, 2 failed — both **pre-existing** (confirmed identical
  on base 832f0c20): `viteBuild` chunk-size budget and a paste test that fails
  only under full-suite pollution (passes alone).
- `tsc --noEmit`: clean (exit 0).
