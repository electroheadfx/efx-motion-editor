---
phase: 9
slug: canvas-zoom
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework configured in project |
| **Config file** | none — Wave 0 installs if unit tests desired |
| **Quick run command** | N/A |
| **Full suite command** | N/A |
| **Estimated runtime** | N/A |

---

## Sampling Rate

- **After every task commit:** Manual verification in running app
- **After every plan wave:** Full manual test pass
- **Before `/gsd:verify-work`:** All manual checks must pass
- **Max feedback latency:** ~5 seconds (app reload)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | SC-1 (zoom +/- buttons work) | manual-only | N/A | N/A | ⬜ pending |
| 09-01-02 | 01 | 1 | SC-1 (preset stop navigation) | manual-only | N/A | N/A | ⬜ pending |
| 09-01-03 | 01 | 1 | SC-1 (percent display updates) | manual-only | N/A | N/A | ⬜ pending |
| 09-01-04 | 01 | 1 | SC-2 (zoom persists during nav) | manual-only | N/A | N/A | ⬜ pending |
| 09-01-05 | 01 | 1 | SC-2 (zoom persists during playback) | manual-only | N/A | N/A | ⬜ pending |
| 09-01-06 | 01 | 1 | SC-3 (fit-to-window) | manual-only | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — this phase's behaviors are UI interactions best validated manually.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toolbar +/- buttons zoom in/out | SC-1 | Requires DOM interaction in Tauri webview | Click +/-, verify canvas scales and percent display updates |
| Preset stop snapping | SC-1 | Requires visual confirmation of zoom level jumps | Wheel zoom to arbitrary level, click +/-, verify snaps to next preset |
| Keyboard shortcuts (Cmd+=/-/0) | SC-1, SC-3 | Requires tinykeys + DOM + Tauri context | Press shortcuts, verify zoom changes match button behavior |
| Pinch-to-zoom | SC-1 | Requires macOS trackpad hardware | Pinch gesture on trackpad, verify smooth zoom anchored to cursor |
| Zoom persists across frames | SC-2 | Requires playback engine running | Set zoom, navigate frames, verify zoom level unchanged |
| Zoom persists during playback | SC-2 | Requires playback engine running | Set zoom, play animation, verify zoom level unchanged |
| Fit-to-window reset | SC-3 | Requires actual canvas container measurement | Click Fit button, verify canvas fills available space; resize window, click Fit again |

---

## Validation Sign-Off

- [ ] All tasks have manual verification instructions
- [ ] Sampling continuity: manual check after each task commit
- [ ] Wave 0: no automated test infrastructure needed (pure UI interactions)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (app reload)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
