---
phase: 62
review: 62-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "The script-copy seam drops `vectorDrawn`, so Duplicate / +Key / rail-key copies reclassify a drawn vector and permanently lose its provenance"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The Curve-tab entrance drops the promise from `enterPaintedCurve`, leaving any unexpected rejection unhandled"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The AQTL v2 format header was not updated for flag bit 4 and still claims bit 3 is the highest reserved flag"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The new persisted engine key `vectorDrawn` is undeclared in the `MceAquarelleVectorPath` dual-language mirror and its exact-keys pin"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "`'lift-vector': 'Eraser-Vector'` is an unreachable filter label"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "The Vertex colour reading omits the `anchorWidthTarget` guard its Vertex size and Corner siblings use"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "The `requestAquarellePathEdit` doc claims any refusal leaves selection untouched, but the painted branch writes selection before an async entrance can refuse"
open: 0
total: 7
recorded: 2026-11-14T18:25:00.000Z
---

# Phase 62: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 62-REVIEW.md — `aquarelleStrokeFromScriptEvent` now carries `vectorDrawn` under the same conditional-spread law as `curveMode`; mirrored pin in `physicsPaintRotoDuplicateScript.vectorDrawn.test.ts`. 4b26cc5eb. |
| WR-01 | warning | fixed | 62-REVIEW.md — the dialog's painted entrance is wrapped in `Promise.resolve(...).catch(...)` and the source pin asserts the guard. 4b26cc5eb. |
| WR-02 | warning | fixed | 62-REVIEW.md — the AQTL v2 header now documents bit 4 (the bit IS the marker, no payload byte) and names both bit 3 and bit 4 in the older-reader refusal sentence. 4b26cc5eb. |
| WR-03 | warning | fixed | 62-REVIEW.md — `vectorDrawn` declared in `MceAquarelleVectorPath` on both sides (TS `vectorDrawn?: boolean`, Rust `Option<bool>` + serde rename) and added to the exact-keys pin. 4b26cc5eb. |
| IN-01 | info | deferred | 62-REVIEW.md — `'lift-vector': 'Eraser-Vector'` is unreachable because `ScriptStrokeFilterValue` excludes it and lift rows always resolve to `'lift'`. Cosmetic; a one-line delete when the label set is next touched. |
| IN-02 | info | deferred | 62-REVIEW.md — the Vertex colour reading omits the `anchorWidthTarget` guard its Vertex size and Corner siblings use, so one painted frame can pair another stroke's anchors with stale indices. Display-only and self-correcting. |
| IN-03 | info | deferred | 62-REVIEW.md — the `requestAquarellePathEdit` doc says any refusal leaves the selection untouched, but the painted branch writes selection before the async entrance can refuse. Doc/implementation mismatch only. |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

## Superseded — the previous review round (2026-11-14 16:23)

This round reuses the CR/WR/IN ids for a new set of findings, so the earlier decisions cannot keep a row
under the same id. They remain in git history (`f50b86138`, `e2753ad3a`) and in `62-UAT.md`; recorded here
so the product decisions stay visible:

| Prior finding | Disposition | Note |
|---------------|-------------|------|
| CR-01 (teardown destroyed a newer session's capture) | fixed | a07baf51b — identity-guarded teardown; re-verified as fixed by this round. |
| WR-01 (no try/finally around the awaited settle) | fixed | a07baf51b — plus a `.catch` at the ONE Studio exit-hook registration; re-verified as fixed. |
| WR-02 (conversion zeroes recorded stylus tilt) | deferred | Accepted for v1 with the phase UAT 2026-11-14. |
| WR-03 (busy gates not re-read after the durable-base await) | deferred | Accepted for v1; failure mode stays fail-closed. |
| WR-04 (silent refusal when both cancelled-bake replay attempts fail) | deferred | Accepted for v1; fallback restore + refusal copy recorded as a follow-up. |
| IN-01 (redo during an in-flight bake is a silent no-op) | skipped | Intended fail-closed behaviour, test-pinned. |
| IN-02 (`hasRecordedPressureProfile` throws on a null element) | deferred | Unreachable through the loader; doc/implementation mismatch. |
| IN-03 (`resetForStudioOpen` omits the two 62 latches) | deferred | Latent under the one-mount-per-webview topology. |

**Report-format note:** `gsd-code-reviewer` emits findings as `#### <ID>: <title>` under `### <Severity>`
sections, while the ledger's parser expects `### <ID>: <title>` under `## <Severity>` sections. That is why
the automated record-builder reported `unparsed: 7` for this round; the rows above were recorded by hand.
