---
phase: 46
slug: track-local-paint-roto-playscript-state-loop-clips-and-cache
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-24
---

# Phase 46 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| bridge payload → store mutation | apply payloads carry a trackId that must match the captured authority, not the current active track | trackId + trackRevision in apply payloads |
| per-track maps ↔ document identity | runtime maps keyed by UUID trackId mirror the document; a mismatched key is a store bug, not a security boundary | per-track runtime maps |
| persisted document JSON → parseEfxPaintDocument | unchanged fail-closed boundary (Phase 45) | document JSON |
| document trackId → sidecar path | trackId interpolates into the cache path; a crafted trackId could traverse | cache path segments |
| clipboard payload → paste | the payload is created in-process but crosses the track boundary on paste; a foreign-track reference must never survive | Hold sourceFrameRefs |
| undo replay → coordinator | replay revalidates the track's current state before writing | undo entries + trackId |
| async commit payload → store | the payload's captured trackId/trackRevision cross the authority gate before any store write | commit payload |
| transported payload lease → publication | the submitted lease token's trackId must match the payload before a publication lease is used | lease token + payload |
| delete preview → commit | the acknowledged flag is the gate; the preview must be computed before any mutation | acknowledged flag |
| commit → sidecar removal | the deletion directory is a relative path under cache/efx-paint validated by isSafeEfxPaintCachePath | deletion directory list |
| clip creation refs → track maps | sourceFrameRefs are validated against the OWNING track's real-key map only; never cross-track | Hold clip refs |
| linked answer → cache/persistence | resolutions are virtual; only 'real' and record-owned cells may persist | linked resolution cells |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-46-01 | Tampering | per-track map addressing | high | mitigate | trackId is always the UUID from the document; every accessor takes it explicitly; no tracks[i] indexing (Task 1 tests 2, 3; ASVS V5) | closed |
| T-46-02 | Spoofing | duplicate track identity | high | mitigate | store never allocates IDs; trackId not in document rejected at accessor boundary (fail closed, no auto-create except mountTrackRuntime, Task 3 test 3) | closed |
| T-46-03 | Tampering | cross-track lease confusion | high | mitigate | lease identity includes trackId; _validateRotoPhysicalLayerPublication checks token.trackId against claimed track before any write (Task 3 test 1) | closed |
| T-46-04 | Tampering | cache path with trackId | high | mitigate | buildEfxPaintFrameCachePath embeds raw UUID trackId between guarded segments; every path passes isSafeEfxPaintCachePath (Task 2 tests 1 and 4; ASVS V12) | closed |
| T-46-05 | Spoofing | unknown/malformed document on load | high | mitigate | loadEfxPaintDocuments delegates to parseEfxPaintDocument (duplicate track IDs + dangling activeTrackId rejected) before any hydration (Task 2 test 4) | closed |
| T-46-06 | Tampering | save fingerprint ambiguity | medium | mitigate | fingerprint terms include the trackId so identical bytes on distinct tracks never dedupe incorrectly (Task 2 action) | closed |
| T-46-07 | Tampering | cross-track paste reference | high | mitigate | D-06 fail-closed re-pointing: Hold sourceFrameRefs never point at a foreign track; rejection instead of dangling refs (Task 1 tests 3/4; ASVS V4) | closed |
| T-46-08 | Tampering | undo replay on the wrong track | high | mitigate | entries carry trackId; replay revalidates the entry's track state and auto-activates the target before write (Task 3 tests 1/3) | closed |
| T-46-09 | Integrity | raster bytes in history | medium | mitigate | snapshots are refs + deterministic revision hashes only (Task 3 test 5) | closed |
| T-46-10 | Tampering | async commit onto the wrong track | high | mitigate | capture-then-revalidate: commit checks authority.trackId/trackRevision/documentRevision vs captured values before write; no live activeTrackId read at commit time (Task 2 tests 1-4; ASVS V5) | closed |
| T-46-11 | Spoofing | foreign/missing trackId in authority request | high | mitigate | strict validator requires non-empty trackId; getPhysicPaintRotoAuthority fails closed 'Track is unavailable.' with zeroed capacity (Task 1 tests 2,4,5) | closed |
| T-46-12 | Spoofing | lease-token track spoofing | medium | mitigate | applyTransportedPhysicPaintPayload compares submittedLeaseToken.trackId with payload.trackId; mismatch falls to the prepared path (Task 2 test 5) | closed |
| T-46-13 | Spoofing | unacknowledged delete | high | mitigate | commit refuses without acknowledged === true; preview reports the full destruction surface (Task 1 tests 1-2; ASVS V4) | closed |
| T-46-14 | Tampering | dangling Hold refs after delete | high | mitigate | every surviving Hold that referenced the deleted track is severed before teardown; 'linked-unresolved' is the only answer after (Task 2 test 2; D-16) | closed |
| T-46-15 | Tampering | sidecar deletion outside the transaction | medium | mitigate | the deletion list is settled only in the commit arm of the cache transaction; rollback keeps sidecars (Task 3 tests 1-2; D-15) | closed |
| T-46-16 | Spoofing | foreign-track Hold refs | high | mitigate | validateTrackHoldLoopClipRefs closes 'foreign-source-refs' before any clip persists; refs resolve only within the owning track (Task 3 tests 1-2; ASVS V5) | closed |
| T-46-17 | Tampering | stale linked answer after source edit | high | mitigate | atomic composite-key memo invalidation on the owning track; no cross-track invalidation (Task 2 tests 2/3; D-12) | closed |
| T-46-18 | Integrity | unresolved cells persisted | medium | mitigate | 'linked'/'linked-unresolved' are query-only; persistence never contains them (Task 1 test 5, Task 2 test 4) | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks.

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-24 | 18 | 18 | 0 | gsd-secure-phase (orchestrator, L1 grep-depth short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-24
