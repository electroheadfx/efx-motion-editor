---
phase: 63
review: 63-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "WR-15's new contract text claims the gate is \"exactly the set of bases a save would write\"; it is a deliberate superset"
  - id: IN-02
    severity: info
    disposition: open
    title: "The Studio CR-03 pin checks strings anywhere in the file, so the load-bearing order inside the close step is unpinned"
  - id: CR-03
    severity: critical
    disposition: open
    title: "Close refusal is acknowledged once per Studio window, not once per latch episode — a later refused track closes silently and destroys its withheld script"
  - id: WR-14
    severity: warning
    disposition: open
    title: "Dead fallback — the short-body branch in the AQTL version read can never be taken"
  - id: WR-15
    severity: warning
    disposition: open
    title: "`hasWithheldContent()` counts another track's durable bases — a latched but empty binding refuses the close and names a destructive remedy"
  - id: IN-10
    severity: info
    disposition: open
    title: "The anchor encoder accepts a `mutationId` above `0xffffffff` and silently truncates it"
  - id: IN-11
    severity: info
    disposition: open
    title: "`deps.getIdentity` is dead wiring"
  - id: IN-12
    severity: info
    disposition: open
    title: "The explicit foreign-base guard is untested in the only configuration where it is load-bearing"
  - id: IN-13
    severity: info
    disposition: open
    title: "`persistAfterPurge`'s cache delete relies on an implicit `isDirty()` invariant instead of the latch"
  - id: IN-14
    severity: info
    disposition: open
    title: "Dead second-stage validation in the rotation encoder"
  - id: IN-15
    severity: info
    disposition: open
    title: "The AQTL header's rotation unit law describes code that does not exist"
  - id: IN-16
    severity: info
    disposition: open
    title: "An AQTL encode refusal is reported as an IO failure, and the catalog field that can trigger it is not range-validated on read"
  - id: CR-01
    severity: critical
    disposition: open
    title: "The withheld-save disclosure is destroyed with the window — the close path still silently accepts a withheld flush"
  - id: WR-13
    severity: warning
    disposition: open
    title: "Every purge action — including single-frame and raster purges — clears the refused-restore latch and replaces the unread snapshot session-only"
  - id: WR-01
    severity: warning
    disposition: open
    title: "`aqtl-retired` is broader than the retirement it names — every AQTL version other than 3 is reported as an \"older format\""
  - id: WR-02
    severity: warning
    disposition: open
    title: "A foreign track's session durable base can still be written under this track's snapshot"
  - id: IN-03
    severity: info
    disposition: open
    title: "Stale codec section comments"
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
  - id: IN-04
    severity: info
    disposition: open
    title: "The import request mask is decoded twice"
open: 34
total: 34
recorded: 2026-11-17T12:07:28.050Z
---

# Phase 63: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| CR-03 | critical | open | - (not in the current review) |
| WR-14 | warning | open | - (not in the current review) |
| WR-15 | warning | open | - (not in the current review) |
| IN-10 | info | open | - (not in the current review) |
| IN-11 | info | open | - (not in the current review) |
| IN-12 | info | open | - (not in the current review) |
| IN-13 | info | open | - (not in the current review) |
| IN-14 | info | open | - (not in the current review) |
| IN-15 | info | open | - (not in the current review) |
| IN-16 | info | open | - (not in the current review) |
| CR-01 | critical | open | - (not in the current review) |
| WR-13 | warning | open | - (not in the current review) |
| WR-01 | warning | open | - (not in the current review) |
| WR-02 | warning | open | - (not in the current review) |
| IN-03 | info | open | - (not in the current review) |
| CR-02 | critical | open | - (not in the current review) |
| WR-08 | warning | open | - (not in the current review) |
| WR-09 | warning | open | - (not in the current review) |
| WR-10 | warning | open | - (not in the current review) |
| WR-11 | warning | open | - (not in the current review) |
| WR-12 | warning | open | - (not in the current review) |
| IN-05 | info | open | - (not in the current review) |
| IN-06 | info | open | - (not in the current review) |
| IN-07 | info | open | - (not in the current review) |
| IN-08 | info | open | - (not in the current review) |
| IN-09 | info | open | - (not in the current review) |
| WR-03 | warning | open | - (not in the current review) |
| WR-04 | warning | open | - (not in the current review) |
| WR-05 | warning | open | - (not in the current review) |
| WR-06 | warning | open | - (not in the current review) |
| WR-07 | warning | open | - (not in the current review) |
| IN-04 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
