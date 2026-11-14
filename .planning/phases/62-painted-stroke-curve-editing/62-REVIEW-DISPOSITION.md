---
phase: 62
review: 62-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
  - id: WR-01
    severity: warning
    disposition: fixed
  - id: WR-02
    severity: warning
    disposition: deferred
  - id: WR-03
    severity: warning
    disposition: deferred
  - id: WR-04
    severity: warning
    disposition: deferred
  - id: IN-01
    severity: info
    disposition: skipped
  - id: IN-02
    severity: info
    disposition: deferred
  - id: IN-03
    severity: info
    disposition: deferred
open: 0
total: 8
unparsed: 7
recorded: 2026-11-14T18:18:10.551Z
---

# Phase 62: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 62-REVIEW.md — teardown now identity-guards every write, runs the tail in `finally`, and lets a bracket armed during the settle take the capture over while inheriting the original pre-entry values. Fix + two pins: a07baf51b. (not in the current review) |
| WR-01 | warning | fixed | 62-REVIEW.md — same fix: `try/finally` around the awaited settle, plus a `.catch` at the ONE Studio exit-hook registration so a rejected settle is not an unhandled rejection. a07baf51b. (not in the current review) |
| WR-02 | warning | deferred | 62-REVIEW.md — accepted for v1 with the phase UAT on 2026-11-14: the conversion still stamps `tx: 0, ty: 0`, so a stylus-painted stroke repaints with a different dab azimuth for fixed-rotation brushes. A carry/remap tilt follow-up can revisit it; it does not block ship. (not in the current review) |
| WR-03 | warning | deferred | 62-REVIEW.md — accepted for v1 with the phase UAT on 2026-11-14: busy gates are not re-checked after `await ensureAquarelleDurableBaseRef`; a latch stolen during the await write fails closed (no half-written terminal). (not in the current review) |
| WR-04 | warning | deferred | 62-REVIEW.md — accepted for v1 with the phase UAT on 2026-11-14: when both cancelled-bake undo replays are refused, the branch returns false silently. The fallback restore + refusal copy is a recorded follow-up, not a phase blocker. (not in the current review) |
| IN-01 | info | skipped | 62-REVIEW.md — redo during an in-flight bake is an intended fail-closed no-op and is test-pinned (`PhysicsPaintStudio.test.ts:8194`). (not in the current review) |
| IN-02 | info | deferred | 62-REVIEW.md — `hasRecordedPressureProfile` throws on a null element; unreachable through the loader (`aquarelleRecordState.ts:1767`). Doc/implementation mismatch only. (not in the current review) |
| IN-03 | info | deferred | 62-REVIEW.md — `resetForStudioOpen` omits the two 62 signal latches; latent under the one-mount-per-webview topology. (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
