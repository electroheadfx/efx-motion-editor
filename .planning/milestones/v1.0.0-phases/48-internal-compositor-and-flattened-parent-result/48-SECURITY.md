---
phase: 48
slug: internal-compositor-and-flattened-parent-result
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-30
---

# Phase 48 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| parsed document → compositor | the compositor consumes EfxPaintDocument records that crossed the fail-closed parsers at the store boundary; it must never accept `unknown` | typed document records |
| content port → composite pass | per-track rasters arrive through the injected port; a hostile/buggy port returning malformed shapes is a store defect, and the port contract narrows the surface | raster data |
| document clips → resolver input | FrameLoopClip records are parser-validated at the store boundary; the adapter re-validates by passing them through the resolver's own fail-closed derivation validation | clip records |
| known-source set → missing report | the injected knownSources set is the fail-closed oracle for dangling refs; the adapter never fabricates a source | source refs |
| compositor → renderer/export | the flattened raster crosses into the main-editor boundary as straight-alpha RGBA; the renderer must treat it as final internal content (parent properties only) | straight-alpha raster |
| export preflight scan set | the preflight's authority is the same truth table the compositor draws with; divergence silently ships or silently blocks content | track participation set |
| background resolution → composite pass | the 48-02 union narrows what the pass can draw; a resolution that fabricates a source is impossible by construction (knownSources oracle) | background resolution union |
| cache key ↔ participating inputs | the key is the integrity boundary between an edit and the pixels it should invalidate; under-coverage serves stale pixels | cache key terms |
| composite output → Studio canvas | the monitor draws only what getFlattenedFrame returns; no Studio-side pixel mutation | flattened raster |
| missing report → status capsule | the capsule publish is the user's only missing-source signal; a re-fire loop would spam the surface and mask real state changes | missing report summary |
| unit contract ↔ pixel truth | the recording-context suite asserts the drawing contract; only the native UAT asserts pixels — neither substitutes for the other | test evidence |
| Studio ↔ main preview ↔ export | the three surfaces are one path by construction (48-03/48-05); the UAT is the evidence that construction holds visually | flattened raster |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-48-01 | Tampering | compositeFrame input | high | mitigate | typed to EfxPaintDocument (never `unknown`); parse-at-boundary stays in efxPaintStore/parseEfxPaintDocument (ASVS V5 inherited); tests construct documents via createEfxPaintDocument + parse round-trip | closed |
| T-48-02 | Tampering | track identity in caches/participation | high | mitigate | identity is always track.id (UUID); order is sort-only; Test 4 pins the tiebreak; no array-index addressing anywhere in the module (Pitfall 1) | closed |
| T-48-03 | Denial of Service | composite pass cost | medium | mitigate | per-frame flattened memo + per-track content keys (D-07/D-08); the resolver derives ranges and never materializes infinite loops (Pitfall 11 discipline carried into 48-02) | closed |
| T-48-04 | Tampering | adapter type confusion (FrameLoopClip → PhysicPaintRotoLoopClip) | high | mitigate | single mapping function with the exact field correspondence pinned by Test 1; resolver's own validation re-checks the mapped input (fail-closed throw at derivation) | closed |
| T-48-05 | Denial of Service | infinite repeat materialization | high | mitigate | derive-once context + per-frame query (D-32); Test 8 pins capacity bounding; no per-range frame arrays are ever built (Pitfall 11) | closed |
| T-48-06 | Tampering | dangling source refs | medium | mitigate | missing refs resolve to a typed 'missing' result carrying the ref ids (D-31 → D-09 chain); never a fabricated or cross-track lookup (46-06 foreign-source-refs discipline) | closed |
| T-48-07 | Tampering | stale flattened cache serving wrong pixels after an edit | high | mitigate | derived-revision keys (48-01 Task 2) + Task 1 Test 6/7 cache-hit/pending semantics; invalidation matrix completed in 48-04 Task 2 | closed |
| T-48-08 | Tampering | placeholder pixels leaking into export | high | mitigate | placeholder arm excised from the flattened path (Task 2 Test 5); missing → transparent + report (D-09); preflight hard-block retained and generalized (Task 3) | closed |
| T-48-09 | Information Disclosure (content correctness) | preflight scanning only the active track | medium | mitigate | participatingPaintTracks is the single scan authority (Task 3 Tests 1-3); the compositor and the preflight cannot diverge | closed |
| T-48-10 | Tampering | double application of parent opacity/blend | high | mitigate | parent sites untouched and exclusive (Task 2 Test 2 — 25% contract); the compositor never reads parent layer properties (48-01 prohibition) | closed |
| T-48-11 | Tampering | stale flattened raster after a Background clip/fallback edit | high | mitigate | Task 2 matrix rows 4-5 pin key rotation on clip add/edit/repeat, fallback flips, and visibility toggles (CMP-04) | closed |
| T-48-12 | Denial of Service | infinite Background loop composite cost | high | mitigate | per-frame query over the derived context, capacity-bounded (Task 1 Test 6); flattened memo absorbs playback redraws (D-08) | closed |
| T-48-13 | Tampering | per-track cache cross-contamination | high | mitigate | content keys carry trackId + contentRevision + frame (Task 2 Test 1 spy-count proof; identity discipline, Pitfall 1) | closed |
| T-48-14 | Denial of Service | reactivity feedback loop in the Studio canvas stack (OOM incident class) | high | mitigate | efx-preact-reactivity skill gates: narrow signal reads, identity-stable deps, compare-then-draw on cacheKey, compare-then-write capsule publish, no render-body signal writes (Tasks 1-2 acceptance criteria + tests b/c) | closed |
| T-48-15 | Tampering | Studio/main/export pixel divergence | high | mitigate | the monitor consumes getFlattenedFrame only — the same seam previewRenderer/export use (CMP-01); test (a) pins the draw source; 48-06 UAT compares surfaces | closed |
| T-48-16 | Information Disclosure (state confusion) | editing base double-drawing the active track | medium | mitigate | active-track exclusion in editing mode (Task 1 test b); full inclusion in playback (test a) | closed |
| T-48-17 | Tampering | pixel drift between surfaces (Pitfall 8) | high | mitigate | UAT part 1 compares all three surfaces per matrix row group; the shared-path construction (one compositeFrame) makes divergence a build error, not a behavior | closed |
| T-48-18 | Tampering | double-premultiplied alpha halos (Pitfall 7) | high | mitigate | UAT part 2 is the D-02 pixel test (50% white, never dark gray); contract row 21 pins the structural half | closed |
| T-48-19 | Denial of Service | composite cost at playback rates (Pitfall P-48-6) | medium | mitigate | UAT part 6 at 3+ tracks × 15/24 fps; D-07/D-08 caches are the construction | closed |
| T-48-SC | Tampering | npm/pip/cargo installs | high | mitigate | package-legitimacy gate — NOT APPLICABLE: zero packages installed this phase (48-RESEARCH.md Package Legitimacy Audit: none; no package manifests touched in phase commits) | closed |

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
| 2026-08-30 | 25 | 25 | 0 | gsd-security-auditor (L1 grep-depth, short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-30
