---
phase: "60"
slug: "studio-timeline-horizontal-zoom"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-09"
---

# Phase 60 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| wheel/trackpad input → zoom store | Untrusted numeric deltas and modifier flags cross into session view state | Numbers, modifier flags (no text) |
| zoom store → DOM style strings | Pitch-derived numbers become inline CSS values and a CSS custom property | Numeric px strings |
| zoom preference → localStorage | The per-layer density is a UI preference read/written across Studio webview recreation | Layer id → number |

---

## Threat Register

Register authored at plan time (all six PLAN.md files carry a `<threat_model>` block).

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-60-01 | Tampering | `timelineZoom.setScaleAtCursor` / `nextTimelineZoomWheelScale` | high | mitigate | `Number.isFinite` guards on every delta, pitch and anchored target (`physicsPaintTimelineZoom.ts:64,68,72,93,160`), plus `clampTimelineZoomScale` into 0.25–4 before any write; a non-finite wheel delta returns the current scale untouched | closed |
| T-60-02 | Denial of Service | lane extent and grid repeat | medium | mitigate | The 4× ceiling bounds scroll width to 4 × frameCount × 18 px; `frameCells` is already bounded by the engine frame limit | closed |
| T-60-03 | Tampering | inline style strings in the strip | medium | mitigate | Only module-produced numeric px strings enter styles; no `innerHTML` / `dangerouslySetInnerHTML` in the authority or pill; the percent readout renders a number | closed |
| T-60-04 | Information disclosure | cross-document zoom leakage | low | mitigate | `resetForStudioOpen(layerId)` runs on every Studio mount (strip mount effect) and restores only THAT layer's density; the store writes no document, schema, revision, cache or export surface. UAT 2026-11-09 added a per-layer localStorage preference — it is a UI preference keyed by layer id, so the boundary (no cross-document leakage) still holds | closed |
| T-60-SC | Tampering | package installs | high | mitigate | This phase installs nothing (REL-01): no commit in `7276353f7..HEAD` touches `package.json`, `app/package.json` or `pnpm-lock.yaml` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
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
| 2026-11-09 | 5 | 5 | 0 | gsd-secure-phase (L1 grep depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
