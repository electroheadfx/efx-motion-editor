---
phase: 42
slug: playscript-application-modes-color-override
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-20
---

# Phase 42 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| caller → schedule module | frameCount/strokes arrive from the app renderer; numeric normalization is the only input surface | frameCount / strokes |
| user input → controller | repeat/cycle text fields are untrusted numeric input | repeat / cycle input |
| controller → engine | color string assigned onto stroke.color before canvas render | override color |
| child → parent bridge | authority/commit path (regression-locked, unchanged) | commit payload |
| user → dialog inputs | Frames/Repeat text, slider values, picked color | dialog input |
| dialog → controller signals | all edits flow through the validated signal layer | dialog signal state |
| controller signals → panel DOM | read-only projection of session option state | option state |
| Studio settings → dialog/controller | live brush color read (read-only; single writer setBrushColor unchanged) | brush color |
| modal CSS scope → Studio | dark tokens must not leak outside the modal scope | CSS tokens |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-42-01-01 | DoS | buildStaticStrokeSchedule frameCount | low | mitigate | `Math.max(1, Math.trunc(frameCount))` normalization; downstream renderer MAX_FRAME_COUNT=10_000 guard remains the sole volume bound (unchanged) | closed |
| T-42-01-SC | Tampering | package installs | low | accept | No package installs in this plan (zero new dependencies) | closed |
| T-42-02-01 | Tampering | parseRepeat numeric input | medium | mitigate | Strict trim + `/^\d+$/` + safe-integer + positive validation, plus the dynamic safe-product bound `maxRepeat = floor(Number.MAX_SAFE_INTEGER / cycleLength)` derived before multiplication; table-driven rejection tests (controller parseRepeat) | closed |
| T-42-02-02 | Tampering | overrideColor into stroke.color | low | mitigate | Value only ever sourced from InlineColorPicker hex output; assigned solely to stroke.color (`#rrggbb` \| null); never interpolated into HTML/CSS | closed |
| T-42-02-03 | DoS | generation volume | low | accept | Existing guards unchanged and sole bound: authority capacity gate, MAX_FRAME_COUNT=10_000, MAX_AGGREGATE_RGBA_BYTES=512MB; Repeat bound is display-math safety only, never raises generation volume | closed |
| T-42-02-04 | Tampering | mid-render authority change | low | accept | Existing triple authority re-check + revision/capacity equality before commit applies identically to both modes | closed |
| T-42-02-SC | Tampering | package installs | low | accept | No package installs (zero new dependencies) | closed |
| T-42-03-01 | Tampering | numeric text fields | medium | mitigate | Controller-side strict-regex validation is the single gate; dialog only mirrors aria-invalid/disabled state — no dialog-side parsing | closed |
| T-42-03-02 | Information disclosure | color/motion values in DOM | low | accept | User's own session data rendered by Preact with framework escaping; no persistence | closed |
| T-42-03-SC | Tampering | package installs | low | accept | No package installs (zero new dependencies) | closed |
| T-42-04-01 | Information disclosure | summary text in panel DOM | low | accept | User's own session options rendered by Preact with framework escaping; no persistence | closed |
| T-42-04-SC | Tampering | package installs | low | accept | No package installs (zero new dependencies) | closed |
| T-42-05-01 | Tampering | getBrushColor port value | low | mitigate | Controller validates/normalizes the hex at confirm (`normalizeBrushColor` strict `/^#[0-9a-fA-F]{6}$/`); malformed port value falls back to null (Original-colors behavior) | closed |
| T-42-05-02 | Tampering | numeric text fields | medium | mitigate | Controller-side strict-regex validation (42-02) remains the single gate; dialog mirrors aria-invalid/disabled only | closed |
| T-42-05-SC | Tampering | package installs | low | accept | No package installs (zero new dependencies) | closed |
| T-42-06-01 | Tampering | CSS scope leakage | low | mitigate | Diff confined to `.physics-paint-play-script-*` selectors (all 62 verified scoped); no pre-existing rule modified | closed |
| T-42-06-SC | Tampering | package installs | low | accept | No package installs (zero new dependencies) | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-42-01 | T-42-01-SC | No package installs in this plan; zero new dependencies (RESEARCH). | Phase 42 | 2026-08-20 |
| AR-42-02 | T-42-02-03 | Generation volume bounded by existing unchanged guards: authority capacity gate, MAX_FRAME_COUNT=10_000, MAX_AGGREGATE_RGBA_BYTES=512MB. The Repeat bound is display-math safety only and never raises generation volume. | Phase 42 | 2026-08-20 |
| AR-42-03 | T-42-02-04 | Existing triple authority re-check + revision/capacity equality before commit applies to both modes identically. | Phase 42 | 2026-08-20 |
| AR-42-04 | T-42-02-SC | No package installs; zero new dependencies. | Phase 42 | 2026-08-20 |
| AR-42-05 | T-42-03-02 | User's own session data rendered by Preact with framework escaping; no persistence. | Phase 42 | 2026-08-20 |
| AR-42-06 | T-42-03-SC | No package installs; zero new dependencies. | Phase 42 | 2026-08-20 |
| AR-42-07 | T-42-04-01 | User's own session options rendered by Preact with framework escaping; no persistence. | Phase 42 | 2026-08-20 |
| AR-42-08 | T-42-04-SC | No package installs; zero new dependencies. | Phase 42 | 2026-08-20 |
| AR-42-09 | T-42-05-SC | No package installs; zero new dependencies. | Phase 42 | 2026-08-20 |
| AR-42-10 | T-42-06-SC | No package installs; zero new dependencies. | Phase 42 | 2026-08-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-20 | 17 | 17 | 0 | gsd-secure-phase (ASVS L1, short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-20
