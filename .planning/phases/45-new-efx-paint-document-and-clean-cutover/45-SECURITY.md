---
phase: 45
slug: new-efx-paint-document-and-clean-cutover
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-23
---

# Phase 45 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| .mce JSON → document parser | Untrusted project JSON is parsed by `parseEfxPaintDocument` only through the fail-closed parser | serialized document bytes → typed domain model |
| .mce file → Rust serde | Untrusted project JSON parsed by `open_project` on the native side | project JSON → Rust types |
| project file → native cache service | Crafted cache paths could attempt traversal into arbitrary dirs | cache path strings |
| document payload → filesystem sidecars | Crafted sidecar paths could traverse outside `cache/efx-paint` | frame bytes → PNG data-URL sidecars |
| TS orchestrator → native cache service | Two-resource (project file + cache) commit must never tear | transaction_id + cache generation |
| .mce file → gate predicate | Untrusted project JSON scanned before any hydration or sidecar IO | raw JSON scanned by `findLegacyPhysicPaintRejection` |
| dialog → user | Rejection UX must be unspoofable by alternate open entry points | native modal message |
| session file → parsePhysicsPaintStateFile | User-supplied JSON file imported into the app | session JSON → v1.0 document |
| parent window ↔ Studio window (postMessage) | Existing DF-04 surface — must not be widened | message events |
| app ↔ workspace package | Document payloads cross the package boundary | serialized document |
| deleted code ↔ remaining callers | A missed reference re-opens a legacy path (partial cutover) | code references |
| user UAT actions → project files | UAT must not mutate protected data | project file access |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-45-01 | Tampering | parseEfxPaintDocument | high | mitigate | fail-closed parse at every record level; unknown/malformed/wrong-version members throw, never normalize/allocate IDs — `efx-paint/document/efxPaintDocumentParsers.ts` (Task 2 behavior tests 1–7) | closed |
| T-45-02 | Tampering | track identity | medium | mitigate | duplicate track IDs and dangling activeTrackId throw (spec fail-loud identity) — `efxPaintDocumentParsers.ts` (Task 2 tests 4–5) | closed |
| T-45-04 | Tampering | physic_paint_cache.rs path construction | high | mitigate | prefix-locked `CANONICAL_CACHE_BASENAME="efx-paint"` root; `validate_staging_basename` rejects `../`, absolute paths, NUL with crafted-path tests — `app/src-tauri/src/services/physic_paint_cache.rs` (lines 8–9, 513+, 707–723, 805) | closed |
| T-45-05 | Tampering | legacy on-disk data | high | mitigate | D-04 non-destruction: create/settle never reads, moves, or deletes a pre-existing legacy cache dir; `exists()` guards and the `!cache/physic-paint` assertion prove no legacy path is created or touched — `physic_paint_cache.rs` (lines 64–67, 90, 743–744) | closed |
| T-45-06 | Elevation of Privilege | IPC command surface | medium | mitigate | no new `#[tauri::command]`; existing publish/settle keep transaction-id validation identical — `app/src-tauri/src/commands/physic_paint_cache.rs` (lines 38–61) | closed |
| T-45-08 | Tampering | findLegacyPhysicPaintRejection | high | mitigate | pure scan over raw parsed JSON; no throws, no mutation, no open on unexpected shapes; a hostile file can only be rejected or passed — `efx-paint/document/efxPaintCleanBreak.ts` | closed |
| T-45-09 | Tampering | gate discrimination | high | mitigate | structure-discrimination contract test with fresh-v1 must-pass fixture — `app/src/efx-paint/efxPaintCleanBreakContract.test.ts` | closed |
| T-45-11 | Tampering | sidecar path construction | high | mitigate | `isSafeEfxPaintCachePath` prefix-lock + per-segment allow-list; `stableSegment` FNV-1a sanitization — `app/src/lib/efxPaintPersistence.ts` (lines 66, 121–124, 310) | closed |
| T-45-12 | Tampering | save transaction | high | mitigate | stage → write → settle commit/rollback; write failure rolls back and leaves prior committed generation intact — `efxPaintPersistence.ts` (lines 4–9, 148, 243, 252) | closed |
| T-45-13 | Tampering | load path | high | mitigate | `loadEfxPaintDocuments` delegates to fail-closed `parseEfxPaintDocument`; unknown/malformed members throw before any store hydration — `efxPaintPersistence.ts` | closed |
| T-45-15 | Tampering | openProject gate placement | high | mitigate | gate runs before any sidecar open/closeProject/hydration/startAutoSave; spies assert zero downstream invocation on reject — `app/src/stores/projectStore.ts` (line 824) | closed |
| T-45-16 | Tampering | alternate open paths | high | mitigate | every open path (Toolbar, WelcomeScreen, shortcuts) audited to funnel through `projectStore.openProject` — 45-05 SUMMARY audit (T-45-16) | closed |
| T-45-17 | Tampering | rejection dialog | medium | mitigate | native modal `message()` with `kind: 'error'` and single OK; no backdrop-dismiss, no recourse actions — `app/src/lib/efxPaintRejectionDialog.ts` (lines 31–33) | closed |
| T-45-18 | Tampering | save-path switch | medium | mitigate | both save call sites switched in one commit; no `physic_paint_outputs` emission remains in projectStore (single save path) — `projectStore.ts` (line 334) | closed |
| T-45-19 | Tampering | session-file parse | high | mitigate | fail-closed via `parseEfxPaintDocument`; malformed → generic invalid, no partial read — `app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts` (lines 77–88) | closed |
| T-45-20 | Elevation of Privilege | bridge/postMessage surface | medium | mitigate | no new events or channels; launch-context swap reuses the existing message flow; events union unchanged — session controller | closed |
| T-45-21 | Tampering | engine load() | high | mitigate | fail-closed hydrate; legacy v2 explicit reject; unknown members throw — engine load path (Task 3 tests 2–3) | closed |
| T-45-22 | Tampering | partial cutover | high | mitigate | grep contract test enumerates every legacy token against a strict allowlist; typecheck + cargo test catch dangling references — `app/src/efx-paint/efxPaintCleanBreakContract.test.ts` | closed |
| T-45-23 | Tampering | user legacy on-disk data | high | mitigate | deletion is code-only; no filesystem operation targets user project dirs; non-destruction enforced by 45-02 test and absence of cleanup code in this phase | closed |
| T-45-25 | Tampering | real v0.9 project used as UAT evidence | high | mitigate | D-12: only a copy is opened; the original is never touched by the app or the tester — 45-08 UAT evidence | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-45-03 | Non-cryptographic canonical fingerprint for revision change-detection; collision risk acceptable for a lease, not a security boundary | Phase 45-01 | 2026-08-23 |
| AR-02 | T-45-07 | Legacy blob presence round-tripped to TS for gate detection only; never interpreted or rendered | Phase 45-02 | 2026-08-23 |
| AR-03 | T-45-10 | Rejection reasons typed union only; no logging pipeline required for single-user desktop app | Phase 45-03 | 2026-08-23 |
| AR-04 | T-45-14 | PNG data-URL decode bounded by project file size; desktop single-user, no remote input channel | Phase 45-04 | 2026-08-23 |
| AR-05 | T-45-24 | Loss of legacy behavior reference accepted; Git history is the archive, no quarantine copies retained | Phase 45-07 | 2026-08-23 |

*Accepted risks do not resurface in future audit runs.*

**Package legitimacy:** no packages installed by this phase (45-RESEARCH Package Legitimacy Audit satisfied vacuously; `added: []` in 45-01 dependency change record).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-23 | 25 | 25 | 0 | claude / gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-23

---

## Security Audit 2026-08-23

| Metric | Count |
|--------|-------|
| Threats found | 25 |
| Closed | 25 |
| Open | 0 |
