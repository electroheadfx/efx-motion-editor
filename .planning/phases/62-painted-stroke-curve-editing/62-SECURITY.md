---
phase: "62"
slug: "painted-stroke-curve-editing"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-14"
---

# Phase 62 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| persisted script -> fitter | Recorded points arrive from the document (possibly reopened or hand-edited on disk) and are untrusted input to the fit and the re-sampling law. | stroke point arrays (x, y, pressure) |
| session fit -> document | The held fit is view state; only a committed gesture may cross into the record store. | anchor lists, curve mode |
| conversion write -> replay | `points` are what every replay deposits; a wrong count or a stale spine is a permanent visual lie that survives reopen. | replay spine, pressures |
| cache identity -> loop occurrence | One source-scoped cache identity governs every Loop Clip occurrence; a divergent identity leaves an occurrence on stale pixels. | cache revision strings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-62-01 | Tampering (untrusted persisted path) | `updateAquarellePathInScript` / `fitVectorPathAnchors` | high | mitigate | Normalise before mutate; non-finite or sub-two-sample strokes yield no fit and the conversion returns 0 with zero writes; no partial write path (`normaliseAquarelleAnchors` returns undefined → 0) | closed |
| T-62-02 | Denial of service (pathological stroke) | `vectorPathFit.ts` | high | mitigate | Finite-sample sanitisation, linear passes with a bounded tolerance-doubling loop, `VECTOR_PATH_FIT_MAX_ANCHORS = 40`, no recursion, no RNG | closed |
| T-62-03 | Integrity (data loss on a one-way conversion) | `beginAquarellePathEdit` snapshots | high | mitigate | One pre/after snapshot pair per gesture; undo pin asserts exact hand points and pressures return and the new keys disappear | closed |
| T-62-04 | Information disclosure (session state leaking into persistence) | `vectorPathCurveBracket.ts` | medium | mitigate | The bracket imports only signals, types, `vectorPathLatches` and `vectorPathFit` — no record, codec or save module; session signals cleared on every exit | closed |
| T-62-05 | Repudiation (a commit that never renders) | conversion write -> payload entry | high | mitigate | Same-index entry replacement plus one revision bump; end-to-end pin asserts the payload entry's anchors and points agree after the write | closed |
| T-62-06 | Tampering (stale edit target) | fit session target | high | mitigate | Fit keyed by `mutationId`; `shouldExitPathEdit` target comparison plus the single-selection gate close the edit when the target changes and the exit hook drops the fit | closed |
| T-62-07 | Denial of service (double entry) | entry/exit latches | low | mitigate | Compare-then-write via `writeIfChanged`; a second entry on the same stroke re-arms the same value and performs no extra work | closed |
| T-62-08 | Integrity (dropped deferred render) | exit resolver | high | mitigate | The exit action is a pure resolver with five pinned cases; a dirty Draft can only leave through the shipped settle or stay behind the user's own wireframe setting | closed |
| T-62-09 | Elevation of privilege (leaf writing engine state) | `PhysicsPaintStrokeSettingsDialog.tsx` | medium | mitigate | All reads and writes stay on the Studio bundle; the dialog imports no record module and the source pins assert the branch | closed |
| T-62-10 | Information disclosure / Tampering (session state reaching the document) | `VectorPathOverlay.tsx` | high | mitigate | The overlay reads the session and writes nothing; no record-write, codec or bake import is added; tests assert an unchanged revision and no ledger entry across draw and gesture | closed |
| T-62-11 | Denial of service (malformed recorded points) | `aquarelleStrokeBand.ts` | medium | mitigate | Non-finite projections filtered; fewer than two survivors draw nothing; anchors go through `normaliseVectorAnchors`; no branch throws into the render | closed |
| T-62-12 | Integrity (misleading footprint) | construction-view band | high | mitigate | Cache keyed by revision, width and height and cleared on any stamp change; an equality pin against `buildStrokeBand` proves the drawn ring is the real band for the current samples | closed |
| T-62-13 | Tampering (a cancelled apply publishing history) | `aquarelleVectorPathCommit.ts` | high | mitigate | Cancellation is a first-class third terminal checked after the apply and before success/failure; exactly-one-terminal tests cover cancel-before, cancel-during and cancel-on-rejection | closed |
| T-62-14 | Repudiation (undo consuming the previous edit) | undo router | high | mitigate | The pending record names the `editId` and the branch replays that exact id; the stack path is unreachable while the record is armed; the revision-authoritative restore fails closed on a foreign mutation | closed |
| T-62-15 | Denial of service (stranded latch or hung undo) | path-edit latches | medium | mitigate | The epoch is cleared in `finally` keyed by token; undo awaits only promises the shipped paths already settle; the bake releases its latch in `finally` before any terminal | closed |
| T-62-16 | Tampering (identity divergence) | `physicsPaintRotoPhysicalModel.ts` | high | mitigate | ONE `buildRotoRealCacheRevision` builder; every real, remap and persistence site routes through it; production construction-site scan outside the builder's module is 0; four shipped suites pin the exact strings | closed |
| T-62-17 | Spoofing (occurrence masquerading as an edit target) | loop occurrence resolution | high | mitigate | Occurrence frames list no selectable row and report no recorded script (pinned over frames 1..24); `loop-placeholder` carries no `keyId` and no `cacheRevision`, so frame-driven target resolution cannot name it | closed |
| T-62-18 | Integrity (per-occurrence materialization) | Loop Clip occurrence payloads | medium | mitigate | The source edit leaves the record count and loop-clip collection unchanged and keeps every occurrence's payload the same object reference as the source record | closed |
| T-62-SC | Tampering (supply chain) | package installs | high | mitigate | REL-01: no dependency is added — `git diff` over the phase's commits shows no `package.json` or lockfile change; `fit-curve` remains a reference only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*No accepted risks.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-14 | 19 | 19 | 0 | gsd-secure-phase orchestrator (ASVS L1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-14
