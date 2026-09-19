---
phase: "52"
slug: "shared-mask-compositor-and-reveal"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-04"
---

# Phase 52 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| saved document → parser | a malformed reveal rail record in a saved `.mce` document crosses the fail-closed parser boundary | railKind discriminator, mode, scriptId, sourceKeyIds |
| reference registry → bake | the frame-aligned reference verdict feeds the bake; a missing reference must fail closed, not bake garbage | reference verdict, reference transform |
| bake → physical commit | the bake writes keys through the acknowledged physical-edit transaction; a stale document must not be overwritten | baked key records, document revision |
| saved document → parser | a PhotoReferenceTrack (with or without a legacy mode field) crosses the fail-closed parser boundary | track fields (id, sourceFrameRefs, revision, visibleInStudio, opacity, transform, transformLocked) |
| rail surface → store | the Replay control triggers a store mutation; a disabled reason must gate it before any write | replay intent, disabled reason |
| modal → store | the "Reveal with script…" flow triggers the create-reveal-rail mutation; a missing reference must gate it before any write | scriptId, variant, current track |
| track rail-creation → store | the track flow triggers the SAME create-reveal-rail mutation; a missing reference must gate it before any write (D-19) | scriptId, variant, current track |
| reference registry → flattened output | photo reference pixels must cross only through reveal keys; any other path is a leak | reference tokens (excluded) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-52-01 | Information disclosure | reveal bake / compositor | high | mitigate | the bake reads `_resolveReferenceSourceImage` + the reference transform, never the composited preview (physicPaintStore.ts:1254,1308); photo pixels reach output only through reveal keys (RVL-05); token allow-list scan lands in Plan 05 | closed |
| T-52-02 | Tampering | physicPaintStore bake commit | high | mitigate | the bake commits through the existing acknowledged physical-edit transaction, which revalidates the document revision before any write (commitRevealBake, physicPaintStore.ts:1295,1384) (TRK-05) | closed |
| T-52-03 | Tampering | physicsPaintRotoPhysicalModel parser | medium | mitigate | `railKind` is a fail-closed allowlist (`'playscript' | 'reveal'`); unknown values throw, absent defaults to `'playscript'`, no normalization, no ID allocation (physicsPaintRotoPhysicalModel.ts:642) | closed |
| T-52-04 | Tampering | efxPaintDocumentParsers parsePhotoReferenceTrack | medium | mitigate | fail-closed allowlist: `PHOTO_REFERENCE_KEYS` drops `mode` (efxPaintDocumentParsers.ts:70); a legacy mode-bearing record throws (unknown member, hasOnlyKeys :348), never normalized or silently accepted | closed |
| T-52-05 | Denial of service | PhysicsPaintLoopClipRail Replay control | low | mitigate | the Replay control is disabled with a `regenerateDisabledReason`-style reason when no reference is placed or the script is deleted (`REVEAL_REPLAY_DISABLED_NO_REFERENCE` / `REVEAL_REPLAY_DISABLED_SCRIPT_DELETED`, physicsPaintLoopClipPresentation.ts:49-50); the red unresolved state is reserved for fail-closed cases only (D-24) | closed |
| T-52-06 | Denial of service | PhysicsPaintPhotoReferenceDialog reveal entry + track rail-creation flow | low | mitigate | both creation paths are gated on a placed reference (D-12); the create-reveal-rail mutation fail-closes when `document.photoReference === null` (efxPaintStore.ts:1325) | closed |
| T-52-07 | Information disclosure | efxPaintCompositor / flattenedCache / previewRenderer / exportRenderer | high | mitigate | token allow-list scan over the four raster surfaces asserts no reference-input token appears in any of them; the bake reads the reference verdict, never the composited preview (efxPaintRevealLeakContract.test.ts, 2 tests green) (RVL-05, D-15) | closed |
| T-52-SC | Tampering | npm/pip/cargo installs | low | accept | no external packages are installed this phase (RESEARCH.md Package Legitimacy Audit: not applicable) | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-52-SC | T-52-SC | No external packages are installed this phase; the supply-chain surface is unchanged (RESEARCH.md Package Legitimacy Audit: not applicable) | gsd-secure-phase | 2026-09-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-04 | 8 | 8 | 0 | gsd-secure-phase (L1 grep-depth short-circuit — threats_open: 0, register authored at plan time, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-04
