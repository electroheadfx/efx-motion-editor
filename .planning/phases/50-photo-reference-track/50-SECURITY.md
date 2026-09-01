---
phase: "50"
slug: "photo-reference-track"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-01"
---

# Phase 50 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| .mce disk JSON → parseEfxPaintDocument | persisted project data crosses into the runtime model; the photoReference record is attacker/legacy-writable | track structure (mode, source refs, opacity, transform, revision) |
| .mce disk JSON → hydrateRuntimeFromDocument | persisted photoReference source refs cross into the runtime store; crafted refs must fail closed | source refs, track fields |
| store registry → getFlattenedFrame | the reference registry must never cross into the flattened compositor path (D-06) | reference tokens (excluded) |
| picker selection → setPhotoReferenceSource | user-selected image IDs cross into the store; ordering and asset-ID provenance enforced here | selected asset IDs, ordering |
| monitor-paint layer → compositor | the ghost draw must never cross into the flattened compositor path (D-06) | ghost canvas (monitor-only) |
| right-panel controls → store setters | mode/opacity/lock inputs cross into the store; the mutation vs display-preference split must hold | mode flag, opacity, lock |
| transform handles → compositor | the transform must never write to the compositor or cache keys (D-13, D-06) | transform display properties |
| persisted track → hydrate on reopen | round-trip must preserve every field and stay idempotent (REF-05) | all seven track fields |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-50-01-01 | Tampering | parsePhotoReferenceTrack | high | mitigate | exact-member fail-closed parse of the track; tests assert throws on unknown mode, extra/missing member, non-finite opacity, negative revision (efxPaintDocumentParsers.ts:343-381; tests :66,97,118) (ASVS V5) | closed |
| T-50-01-02 | Tampering | encodeCanonicalPhotoReference | medium | mitigate | deterministic per-field terms excluding display prefs; field-reorder stability and opacity-identical-hash tests (efxPaintDocumentRevision.ts:109-117; tests :135-151,:46) | closed |
| T-50-01-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase (package manifests clean across phase commits) | closed |
| T-50-02-01 | Tampering | setPhotoReferenceSource | high | mitigate | library MceImageRef asset IDs only, never external paths (Phase 49 D-09); non-empty refs validated at parse and guarded fail-closed by _isValidSourceRefs (efxPaintStore.ts:601-603,1121,:353) | closed |
| T-50-02-02 | Information Disclosure | getFlattenedFrame / export | high | mitigate | structural D-06 exclusion — no reference ref threaded into the flattened compositor/export path; Test 8 asserts byte-identical output (physicPaintStore.ts:1806-1828; efxPaintStore.photoReference.test.ts:328-344) (REF-03) | closed |
| T-50-02-03 | Denial of Service | _resolveReferenceSourceImage | medium | mitigate | fail-closed null on missing asset + `:missing` revision suffix; never silent transparency (physicPaintStore.ts:1224-1232,:1710-1715; test :201-215) (D-04) | closed |
| T-50-02-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-50-03-01 | Tampering | Confirm ordering path | medium | mitigate | natural sort of original filenames only, applied before the store call; never asset UUID or click order (BackgroundAssetPickerView.ts:139-148; PhysicsPaintStudio.tsx:3599,3734) (D-02) | closed |
| T-50-03-02 | Tampering | picker source | medium | mitigate | library asset IDs only via requestLibrary/refreshLibrary (MceImageRef[]); already-imported images reuse existing assets (Phase 49 D-09) | closed |
| T-50-03-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-50-04-01 | Information Disclosure | drawReferenceGhost | high | mitigate | monitor-paint-only draw with save/restore confined; ghost never enters the compositor or flattened path (PhysicsPaintReferenceGhost.ts:58-86; D-06 token scan) | closed |
| T-50-04-02 | Denial of Service | shouldDrawReferenceGhost | medium | mitigate | fail-closed null on missing source + capsule report; never a placeholder fill or silent transparency; tests assert draw:false on null/hidden/playing/missing (PhysicsPaintReferenceGhost.ts:26-38) (D-04) | closed |
| T-50-04-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-50-05-01 | Tampering | mode control | medium | mitigate | single undoable mutation via setPhotoReferenceMode (descriptor op `set-photo-reference-mode`); flag-only, no compositor change (efxPaintStore.ts:1181-1207) (D-06, D-07) | closed |
| T-50-05-02 | Information Disclosure | transform handles | medium | mitigate | writes display properties only via setPhotoReferenceTransform; no layerStore/keyframeStore imports, never compositor or cache keys (PhysicsPaintReferenceTransformHandles.tsx:1-14,257-319) (D-13, D-06) | closed |
| T-50-05-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-50-06-01 | Tampering | persistence round-trip | medium | mitigate | round-trip contract asserts all seven track fields survive serialize→parse→hydrate and the round-trip is idempotent; source refs validated at parse (efxPaintPersistenceMultiTrackRoundTrip.test.ts:129-170) (REF-05) | closed |
| T-50-06-02 | Information Disclosure | getFlattenedFrame / export after save/reopen | high | mitigate | D-06 non-regression — 14 reference-input tokens absent from compositor, cache, preview, and export after save/reopen; 128-test suite passed (PhysicsPaintStudio.test.ts:1781-1806) | closed |
| T-50-06-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-01 | 19 | 19 | 0 | gsd-security-auditor (L1 grep-depth + test verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-01
