---
phase: 4
slug: drying-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Browser manual + automated canvas pixel checks |
| **Config file** | none — no test framework configured |
| **Quick run command** | `open efx-paint-physic-v3.html` |
| **Full suite command** | `open efx-paint-physic-v3.html` (manual verification) |
| **Estimated runtime** | ~30 seconds (manual visual check) |

---

## Sampling Rate

- **After every task commit:** Open v3.html, paint a stroke, verify behavior
- **After every plan wave:** Full visual check of all modified features
- **Before `/gsd:verify-work`:** All success criteria manually verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PHYS-04 | manual | visual: paint stroke, observe drying over 10-30s | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | STROKE-03 | manual | save strokes to JSON, reload, compare | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | DEMO-04 | manual | replay saved strokes, compare to original | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework needed for this canvas-based project.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wet-to-dry visual progression | PHYS-04 | Visual appearance judgment — organic drying curve | Paint a stroke, observe 10-30s drying timeline, verify gradual transition |
| Serialize/deserialize fidelity | STROKE-03 | Pixel-level visual comparison needed | Save strokes, reload, verify visually identical render |
| Stroke replay determinism | DEMO-04 | Visual comparison of replay vs original | Record strokes, replay, compare side-by-side |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
