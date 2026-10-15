---
phase: "55"
slug: "efx-paint-host-engine-1-host-split"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-15"
---

# Phase 55 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| script parse → engine dispatch | Parsed script envelope crosses into engine-1 codec with engineId discriminator | stroke payloads, animation schedules |
| Apply refuse-before-write | User-initiated Apply crosses into document mutation | document state, clip records |
| timeline scrub gesture → main-editor audio dispatch | user gesture crosses into audioEngine dispatch with clip identity and offsets derived from document state | audio buffer identity, frame offsets |
| import-graph boundary | efx-paint-host must not import engine-1 internals | module dependency graph |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-55-01 | Tampering | preSplitGoldenFixture.ts | medium | mitigate | Golden fixture is read-only test data; delta-zero parity pin verifies integrity | closed |
| T-55-02 | Tampering | Apply refuse-before-write | high | mitigate | Fail-closed Apply in physicsPaintRotoScriptApplyRefusal.ts; four named visible refusals; standing no-partial pin | closed |
| T-55-03 | Information Disclosure | refusal copy | low | mitigate | Refusal messages name the cause without exposing internal state | closed |
| T-55-06 | Tampering | parseStudioScriptEnvelope | high | mitigate | Schema-validated parse in packages/efx-paint-host/src/script/parse.ts; malformed envelopes rejected | closed |
| T-55-07 | Information Disclosure | parse error surface | low | mitigate | Parse errors surface as named refusals, not stack traces | closed |
| T-55-08 | Tampering | ticks.ts helpers | low | mitigate | Integer tick grid is deterministic; no external input reaches tick math | closed |
| T-55-09 | Tampering | engine-1 codec parse | high | mitigate | Clean-break refusal for legacy scripts; engineId discriminator validated before codec dispatch | closed |
| T-55-10 | Spoofing | engineId discriminator | high | mitigate | engineId checked against known engine registry; unknown engine → named visible refusal | closed |
| T-55-11 | Tampering | script library listing | medium | mitigate | Script library listing is read-only; schema validation on load | closed |
| T-55-12 | Tampering | import-graph leak | high | mitigate | hostImportGraphContract.test.ts pins the boundary; efx-paint-host has no engine-1 imports | closed |
| T-55-13 | Denial of Service | bake host queue | medium | mitigate | Bounded bake host queue; no unbounded accumulation | closed |
| T-55-14 | Information Disclosure | playbackEngine.startAudioSnippet | low | accept | Snippet reuses existing toDocumentSoundAudioTrack carrier (filePath stays empty; buffer keyed by sound.id); no new path, IO, or IPC surface | closed |
| T-55-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package-manager install; no new third-party package introduced in this phase | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-55-01 | T-55-14 | Snippet reuses existing audio carrier with no new IO surface; same boundary the play leg already crosses | plan 55-10 | 2026-10-15 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-15 | 13 | 13 | 0 | gsd-secure-phase (L1 grep-depth, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
