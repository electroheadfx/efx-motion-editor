---
phase: 63
review: 63-REVIEW.md
titles: json
findings:
  - id: CR-02
    severity: critical
    disposition: open
    title: "The AQTL v3 gate makes every existing snapshot unreadable, and the next save overwrites the unread authoritative file"
  - id: WR-08
    severity: warning
    disposition: open
    title: "WR-06 bounds each asset read but the batch itself is unbounded"
  - id: WR-09
    severity: warning
    disposition: open
    title: "Catalog pushes carry no ordering token; a late older snapshot erases newer catalog state"
  - id: WR-10
    severity: warning
    disposition: open
    title: "The WR-03 save gate classifies custom ids by the `wc/custom-` prefix, so a script-registered id of another shape bypasses it"
  - id: WR-11
    severity: warning
    disposition: open
    title: "The legacy-byte fixture inserts its byte at 117 — inside the last anchor — not after the anchor block at 118"
  - id: WR-12
    severity: warning
    disposition: open
    title: "A deliberate format retirement is reported to the user as a corrupt snapshot, with no named notice"
  - id: IN-05
    severity: info
    disposition: open
    title: "A stored WebP the script carrier cannot hold fails the save with a raw message after the whole build"
  - id: IN-06
    severity: info
    disposition: open
    title: "The wire guard admits a `custom` tip whose id equals a built-in id"
  - id: IN-07
    severity: info
    disposition: open
    title: "The JSON baseline validator never learned `textureId`"
  - id: IN-08
    severity: info
    disposition: open
    title: "The decode-side empty-id refusal is unpinned although the threat register claims it"
  - id: IN-09
    severity: info
    disposition: open
    title: "No textured fixture crosses the vector block, and every id is ASCII"
  - id: CR-01
    severity: critical
    disposition: open
    title: "Cross-layer guard disagreement silently blinds the Studio catalog and writes mask-less Roto scripts"
  - id: WR-01
    severity: warning
    disposition: open
    title: "The \"never throws\" wire guards call an unguarded `atob`"
  - id: WR-02
    severity: warning
    disposition: open
    title: "One degraded custom tip blocks every Roto script save, including scripts that never used it"
  - id: WR-03
    severity: warning
    disposition: open
    title: "An absent catalog is indistinguishable from a project with no imports, so scripts are saved without masks"
  - id: WR-04
    severity: warning
    disposition: open
    title: "A publish failure after the mutation destroys the import answer and reports a false timeout"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Mask ids are not reserved — a script or package can shadow a built-in mask"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Unbounded asset read precedes the digest and dimension guards"
  - id: WR-07
    severity: warning
    disposition: open
    title: "The project save can silently erase the whole brush pack"
  - id: IN-01
    severity: info
    disposition: open
    title: "Redundant rejection arm"
  - id: IN-02
    severity: info
    disposition: open
    title: "Dead docker modified with a mask-dropping importer"
  - id: IN-03
    severity: info
    disposition: open
    title: "Entry guard omits the id/name length caps it defines"
  - id: IN-04
    severity: info
    disposition: open
    title: "The import request mask is decoded twice"
open: 23
total: 23
recorded: 2026-11-15T22:33:11.662Z
---

# Phase 63: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-02 | critical | open | - |
| WR-08 | warning | open | - |
| WR-09 | warning | open | - |
| WR-10 | warning | open | - |
| WR-11 | warning | open | - |
| WR-12 | warning | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| CR-01 | critical | open | - (not in the current review) |
| WR-01 | warning | open | - (not in the current review) |
| WR-02 | warning | open | - (not in the current review) |
| WR-03 | warning | open | - (not in the current review) |
| WR-04 | warning | open | - (not in the current review) |
| WR-05 | warning | open | - (not in the current review) |
| WR-06 | warning | open | - (not in the current review) |
| WR-07 | warning | open | - (not in the current review) |
| IN-01 | info | open | - (not in the current review) |
| IN-02 | info | open | - (not in the current review) |
| IN-03 | info | open | - (not in the current review) |
| IN-04 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
