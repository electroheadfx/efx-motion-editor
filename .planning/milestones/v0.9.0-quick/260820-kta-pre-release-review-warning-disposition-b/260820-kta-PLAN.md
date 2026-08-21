---
task: 260820-kta
slug: pre-release-review-warning-disposition-b
phase: milestone v0.9.0 pre-release
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
  - 43.5-WR-01: FIX
  - 43.5-WR-02: FIX
  - 43.5-WR-03: ACCEPTED
  - 43.6-WR-02: FIX
  - 43.6-WR-03: FIX
---

# Quick Task 260820-kta: Pre-release review-warning disposition (v0.9.0 final HEAD)

Disposition every milestone v0.9.0 code-review warning against the current HEAD.
Record a verdict (ALREADY-FIXED / FIX / ACCEPTED) in the corresponding phase
REVIEW.md with proof/rationale and date. Any FIX gets its own atomic commit with
a RED test first.

## Verified dispositions

### Phase 43 (43-REVIEW.md)
1. **WR-01** (export preflight frame coords) — **ALREADY-FIXED** by `0c182594`.
   `findUnresolvedExportLoop` (exportEngine.ts:80-82) translates the global
   export window to layer-local coords (`seqStart = seq.inFrame ?? 0`) and clamps
   to >= 0; resume test at exportEngine.loops.test.ts:430.
2. **WR-02** (double-click dead zone) — **ALREADY-FIXED** by `2404bbc4` (+
   `6fa3e28d` gesture-aware gate). `hasPendingSingleClick` (line 231) opens the
   editor for any pending single-click second press, closing the
   (220, 250] window.
3. **WR-03** (requestedEnd vs effectiveEnd) — **ALREADY-FIXED** by `0de760ab`.
   presentation:79 and rail:364-367 use the resolved `effectiveEnd`.

### Phase 8.3 (43.3-REVIEW.md)
4. **WR-01** (Escape armed cancel) — **ALREADY-FIXED** by `26c3d14f`.
   `handleEscape` (line 367) no longer gates on `session.started`.
5. **WR-02** (proposalVersion dead) — **ALREADY-FIXED** by `26c3d14f`.
   `commitRotoGroupDrag` (lines 2613-2620) recomputes and compares the
   break-aware fingerprint, rejecting on mismatch.
6. **WR-03** (re-derive duplication) — **ACCEPTED** with rationale (deterministic
   derivation from identical canonical inputs; low drift risk; dedupe would
   change the resolver proposal contract for marginal maintainability benefit).
7. **WR-04** (pointerCancel guard) — **ALREADY-FIXED** by `26c3d14f`. Guard
   `sessionRef.current !== session` present at line 355.
8. **WR-05** (Infinity derivation) — **ALREADY-FIXED** by `26c3d14f`. Resolver
   lines 5455-5463 honor `repeat === 'infinity'`; Infinity tests un-skipped.

### Phase 43.5 (43.5-REVIEW.md)
9. **WR-01** (stale blocked tooltip/cursor) — **FIX**. `onPreviewChange` only
   clears `pushDragBlocked` when `preview === null` (line 1540-1546). A valid
   preview must clear the blocked verdict. Visible-behavior → native UAT.
10. **WR-02** (round-trip push break) — **FIX**. Reverse-close normalization
    (resolver line 2867) only removes the break at frame 0; a round-trip to a
    non-zero original position leaves it. Generalize to `leftBoundary`. Changes
    interpolation state → native UAT.
11. **WR-03** (re-arm watchdog) — **ACCEPTED** with rationale (narrow async
    settlement race; documented design intent; distinguishing manual vs
    settlement disarm adds fragility).

### Phase 43.6 (43.6-REVIEW.md)
12. **WR-02** (silent undo no-op) — **FIX**. `beforeSelectionFromPayload`
    (physicPaintBridge.ts:1659) only excludes `delete-rails`. `delete-group` /
    `delete-action-groups` rewrite selection via cleanup sourceKeyIds → same
    silent-undo mechanism. Extend the guard.
13. **WR-03** (recovery-lease orphan) — **FIX**. Unmount effect (line 2159-2169)
    transfers the settled lease but never releases an already-held recovery
    token; on remount the self-heal no-ops and edits block until project reset.
    Release the recovery token in the unmount effect.

## Tasks
1. Fix 43.5 WR-01 (RED test + fix + commit).
2. Fix 43.5 WR-02 (RED test + fix + commit).
3. Fix 43.6 WR-02 (RED test + fix + commit).
4. Fix 43.6 WR-03 (RED test + fix + commit).
5. Record all 13 verdicts in the four phase REVIEW.md files.
6. Update STATE.md, write SUMMARY.md.
7. Run full suite + typecheck.
