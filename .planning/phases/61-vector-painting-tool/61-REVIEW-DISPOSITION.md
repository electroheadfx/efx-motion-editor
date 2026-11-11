---
phase: 61
review: 61-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Residual half of the earlier CR-01: a mid-drag Delete is undone on release — the key seam wrote the new anchors but left the drag alive, so the pointerup re-committed `anchorsAtStart`"
  - id: WR-01
    severity: warning
    disposition: open
    title: "The widened 61-21 predicate lets Delete fall through to whole-stroke deletion during a path edit on a focused control"
  - id: WR-02
    severity: warning
    disposition: open
    title: "+Key publishes ROTO_ADD_KEY_SCRIPT_COPY_FAILED when the previous real key has no recorded paint (a no-op should succeed)"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`addKey` claims `keyActionInFlightRef` after the blank-build await, so a second click can run the sequence twice"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The new curve-mode failure branch omits the reanchor/restore result the path-edit seam already carries"
  - id: IN-01
    severity: info
    disposition: open
    title: "The Curve row discards `applyCurveMode`'s boolean — guard refusals stay silent"
  - id: IN-02
    severity: info
    disposition: open
    title: "AQTL encode guard fails open on prototype keys (`VECTOR_CURVE_MODE_CODE['constructor']`); decode stays fail-closed"
  - id: IN-03
    severity: info
    disposition: open
    title: "`recordedCurveModeField` has no production caller (necessity) — three seams inline the same rule"
---

# Phase 61 — Review Disposition

Report: `61-REVIEW.md` (incremental, 39 files changed since `ab91201db5`).

| ID | Severity | Disposition | Finding |
|----|----------|-------------|---------|
| CR-01 | critical | **fixed** (`9be725501`) | Mid-drag Delete undone on release |
| WR-01 | warning | open | Widened key predicate lets Delete delete the whole stroke during a path edit |
| WR-02 | warning | open | +Key reports a copy failure when there was simply nothing to copy |
| WR-03 | warning | open | `keyActionInFlightRef` claimed after the first await — double-run window |
| WR-04 | warning | open | Curve-mode failure branch drops the reanchor/restore result |
| IN-01 | info | open | Curve row discards its apply boolean |
| IN-02 | info | open | Encode guard fails open on prototype keys |
| IN-03 | info | open | `recordedCurveModeField` has no caller |

**Totals:** 1 critical (fixed), 4 warnings open, 3 info open.

The blocker was fixed in this run because it defeats VEC-07's one-edit-per-operation
guarantee and VEC-02's edit correctness: the user's Delete was visibly undone by the
pointerup. The fix adds `cancelActiveDrag` to the key seam's handler contract and calls it
before the write, pinned by an overlay test asserting cancel-before-edit ordering.

The four warnings and three infos are triaged open — each is a narrower correctness or UX
seam that deserves its own pass rather than a rushed edit at phase close.
