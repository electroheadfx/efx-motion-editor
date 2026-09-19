---
phase: "49"
slug: "fixed-background-track-and-imported-loop-clips"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-01"
---

# Phase 49 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| .mce disk JSON → parseEfxPaintDocument | persisted project data crosses into the runtime model; the fallback record is attacker/legacy-writable | document structure (version, tracks, background) |
| document JSON (disk) → clip/fallback records | persisted clip fields (repeat, refs) cross into runtime; crafted values must fail closed | repeat counts, sourceFrameRefs |
| library assets → runtime byte registry | hydrated bytes are trusted post-decode; refs are library ids only | image bytes, asset refs |
| selector UI → document fallback mutation | user-driven but must stay one-of and idempotent (render-loop safety) | fallback mode selection |
| main webview ↔ Studio webview (bridge events) | cross-window payload crossing JS realms; spoofed/malformed events must fail closed | image-library request/result pairs |
| Studio webview → native dialog/fs surface | capability-gated plugin APIs crossing into native code | dialog returns, import paths |
| pointer gestures → document mutations | untrusted spatial input crosses into persisted state via store verdicts | drag/commit coordinates |
| right-panel text input → document mutation | user text crosses into persisted repeat values via store validation | repeat text input |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-49-01-01 | Tampering | fallback parser branch | high | mitigate | exact-member fail-closed parse of every new fallback arm; tests assert throws on unknown mode, extra member, non-finite grainStrength (efxPaintBackgroundFallback.test.ts:40,78) | closed |
| T-49-01-02 | Tampering | canonical encoder | medium | mitigate | deterministic per-mode terms; revision-stability test proves field-reorder insensitivity so crafted key order cannot churn or collide revisions (efxPaintDocument.test.ts:154,197) | closed |
| T-49-01-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase (no package.json changes in Phase 49 commits) | closed |
| T-49-02-01 | Tampering | clip CRUD repeat/refs validation | high | mitigate | repeat coerced to integer ≥ 1 or rejected uncommitted; empty sourceFrameRefs rejected at the store boundary; resolver derivation also throws on malformed clips (validateTrackHoldLoopClipRefs, setBackgroundClipRepeat) | closed |
| T-49-02-02 | Tampering | sourceFrameRefs as path vector | high | mitigate | refs are opaque library asset IDs; no path string is ever parsed from a ref; efxasset:// allowed-roots enforcement unchanged (canonicalize + starts_with + extension allow-list in lib.rs) | closed |
| T-49-02-03 | Denial of Service | infinite repeat resolution | medium | mitigate | no UI extent math exists to explode; derivation is WeakMap-identity memoized; visible-window bound lives in the rail layer (efxPaintBackgroundResolution.ts:62) | closed |
| T-49-02-04 | Spoofing | hydration decode of non-image bytes | low | mitigate | decode goes through the existing typed image-decode idiom; a failed decode leaves the ref unregistered → missing verdict, never partial bytes (hydrateBackgroundSourceImages) | closed |
| T-49-02-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-49-03-01 | Denial of Service | fallback setter reactivity | high | mitigate | revision-stable no-op on same-mode writes asserted by test (setBackgroundFallback returns descriptor: null on identical revision; per-frame write loop OOM lesson) | closed |
| T-49-03-02 | Tampering | cache-key fallback term | medium | mitigate | fallback term uses the canonical encoder term (single source), so crafted/corrupt fallback records cannot produce divergent keys between save and render paths | closed |
| T-49-03-03 | Information Disclosure | checkerboard leaking into output | low | mitigate | raster non-regression test asserts the treatment exists only in the Studio monitor module; flattened/preview/export modules carry no reference (PhysicsPaintStudio.test.ts:1236) | closed |
| T-49-03-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-49-04-01 | Spoofing | image-library request/result pair | high | mitigate | operationId correlation + payload validation at the bridge boundary; unknown/mismatched events rejected without consumer visibility (physicPaintBridge.ts:255-262,389) | closed |
| T-49-04-02 | Elevation of Privilege | physics-paint.json capability delta | high | mitigate | exactly one permission added (dialog:allow-open); structural test asserts no fs:* grant; efxasset:// allowed-roots + extension allow-list unchanged (physics-paint.json) | closed |
| T-49-04-03 | Tampering | importFiles path input from dialog | medium | mitigate | paths come only from the native dialog's return value (no user-typed path field exists); processing stays in image_pool.rs with is_supported_format gating | closed |
| T-49-04-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-49-05-01 | Tampering | drag commit path | medium | mitigate | release-time commit only; the 49-02 store verdict is the single mutation gate; a crafted rapid pointer sequence cannot skip validation because preview state never persists (PhysicsPaintWorkflowStrip.tsx:1331) | closed |
| T-49-05-02 | Denial of Service | infinite-repeat rail rendering | medium | mitigate | visible-frame-window bound carried verbatim; fully-outside clips render nothing; derivation memoized per record identity | closed |
| T-49-05-03 | Repudiation | silent rejection outcomes | low | mitigate | every rejection publishes the fixed English reason via the aria-live/role="alert" capsule; zero-mutation invariant asserted by tests (WorkflowStrip.test.ts:767-770) | closed |
| T-49-05-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |
| T-49-06-01 | Tampering | repeat input validation | high | mitigate | invalid input never commits (prior value preserved); setBackgroundClipRepeat enforces integer ≥ 1 / infinite at the store boundary; tested in Task 1 | closed |
| T-49-06-02 | Denial of Service | infinite-repeat display | medium | mitigate | visible-window bound + derivation memoization; UAT step 2 evidence | closed |
| T-49-06-03 | Repudiation | silent delete | low | mitigate | delete commits immediately and is one-step undoable by reference (deleteBackgroundClip descriptor before/after); UAT step 6 evidence | closed |
| T-49-06-SC | Tampering | npm installs | low | mitigate | zero packages installed this phase | closed |

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
| 2026-09-01 | 24 | 24 | 0 | gsd-security-auditor (L1 grep-depth + test verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-01
