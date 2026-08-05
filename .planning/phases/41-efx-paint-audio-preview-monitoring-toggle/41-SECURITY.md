---
phase: 41
slug: efx-paint-audio-preview-monitoring-toggle
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-05
---

# Phase 41 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| main window → child window (launch payload) | audioPreview section crosses at child launch; closed-key + type-guard + revision validation | Audio track metadata + efxasset:// URLs (no raw paths, no bytes) |
| main window → child window (push events) | Revisioned audio-context updates cross repeatedly during a session | Small revisioned metadata sections |
| browser fallback (postMessage) | Same channels without Tauri event isolation; origin-checked | Same payloads as Tauri paths |
| main ↔ child (ownership events) | Transient playback-state/claim events cross in both directions | Transient hints only — never main-state mutation |
| child webview → efxasset protocol (Rust) | Audio/media byte fetches; handler read-only, scoped to canonical media roots (WR-08), 404/403 on rejection | Media bytes inbound only; no write surface |
| main window → Rust serde boundary | Launch context struct passes audioPreview as Option<Value> pass-through | Opaque JSON value |
| CSP configuration | Release security posture; single-token connect-src grant under contract-test guard | Directive token set |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-41-01 | Tampering | Truth table vs implementation divergence | medium | mitigate | RED suite of 62 tests in efxPaintAudioPreview.test.ts encodes every truth-table rule | closed |
| T-41-02 | Security misconfiguration | D-04 boundary built on unconfirmed interpretation | high | mitigate | Blocking decision checkpoint in plan 41-01 Task 3 — four user-locked decisions (a4-protocol-url, a6-matched-fps, rev-counter, d04-proof-packaged-build) recorded in 41-01-SUMMARY before any transport code | closed |
| T-41-03 | Tampering | Path injection via crafted protocol URL in payload | high | mitigate | URLs built main-side only via assetUrl(); closed-key + type guard before any fetch; efxasset handler read-only and root-scoped (WR-08); path-leak test pins JSON output | closed |
| T-41-04 | Information disclosure | Absolute paths leaking into bridge payload | high | mitigate | buildPhysicPaintAudioPreviewSection maps only allowed fields; path-leak test (efxPaintAudioPreview.test.ts) asserts no filePath/relativePath fields | closed |
| T-41-05 | Spoofing | Forged audioPreview section via browser-fallback postMessage | medium | mitigate | Single validation funnel for Tauri and fallback paths; revision compare-and-drop; origin check (usePhysicsPaintParentBridge.ts:142) | closed |
| T-41-06 | DoS | Oversized/foreign payload exhausting child parse | low | mitigate | Structured-clone check rejects non-plain data before field validation; section is small metadata; bytes never cross the bridge | closed |
| T-41-07 | Tampering | Stale/replayed update regresses child audio state mid-playback | high | mitigate | Strict newer-than compare at the single application funnel (efxPaintAudioPreviewContext.ts); out-of-order and double-delivery tests pin exactly-once-newest-wins; D-03 restart only after newer context commits | closed |
| T-41-08 | Spoofing | Forged 'physic-paint:audio-context' via opener.postMessage fallback | medium | mitigate | Origin check (window.location.origin) + closed-key/type-guard validation + revision guard; Tauri path uses emitTo window-label targeting, never broadcast | closed |
| T-41-09 | DoS | Rapid main-editor edits flooding the child with publishes | low | mitigate | Small metadata payloads; revision counter absorbs frequency (no debounce that could skip state); stale drops cost one compare | closed |
| T-41-10 | Tampering | Spoofed ownership/playback-state event suppresses or doubles audio | medium | mitigate | emitTo window-label targeting both directions (physicsPaintBridgeTransport.ts:33); origin check on fallback (efxPaintAudioOwnership.ts:149); events treated as transient hints — worst case is a suppressed note | closed |
| T-41-11 | DoS | Event storm from rapid Play/Stop toggling in both windows | low | mitigate | Two funnels only; O(1) signal transitions; idempotent claim/release (efxPaintAudioOwnership.ts:107) | closed |
| T-41-12 | Information disclosure | Toggle state leaking into project files/config | low | mitigate | Store module has no persistence imports; test (e) at efxPaintAudioPreview.test.ts:907 asserts no storage writes; D-13 session-only by construction | closed |
| T-41-13 | Security misconfiguration | CSP broadening creep beyond the proven grant | high | mitigate | Contract test (releaseContract.test.ts:139-157) pins connect-src token set exactly — efxasset: plus pre-existing sources, no data:/blob:; image contract untouched; grant proven necessary on a packaged build first | closed |
| T-41-14 | DoS | Audio resources leaking across open/close cycles | medium | mitigate | release() (efxPaintAudioMonitor.ts:274) stops all sources and tears down the engine on both close paths; idempotency tests; D-08 single-instance discipline; CR-01 generation guard on deferred plays | closed |
| T-41-15 | Tampering | fetch of unintended local files via efxasset now reachable from child | medium | mitigate | Child fetches only URLs from validated revisioned sections; handler is read-only; physics-paint.json capability grants the child no fs permissions; WR-08 scopes requests to canonical media roots with traversal/symlink/extension rejection | closed |
| T-41-SC | Tampering | npm/pip/cargo installs | low | accept | Phase installs no external packages (RESEARCH Package Legitimacy Audit); no install tasks exist (applies to all 5 plans) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-41-01 | T-41-SC | No external packages installed this phase; supply-chain surface unchanged. Accepted in all 5 plan registers. | user (plan approval) | 2026-08-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-05 | 16 | 16 | 0 | gsd-secure-phase (L1 grep-depth; ASVS 1 short-circuit — register authored at plan time, threats_open: 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-05
