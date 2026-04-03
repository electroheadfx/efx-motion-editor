---
phase: 2
slug: rendering-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual visual verification (single HTML file, no test framework) |
| **Config file** | none — no automated test framework |
| **Quick run command** | `open efx-paint-physic-v1.html` |
| **Full suite command** | `open efx-paint-physic-v1.html` (manual visual check) |
| **Estimated runtime** | ~30 seconds manual inspection |

---

## Sampling Rate

- **After every task commit:** Open HTML file and visually verify changes
- **After every plan wave:** Full manual visual check of all rendering behaviors
- **Before `/gsd:verify-work`:** All visual criteria verified by user
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | RENDER-01 | manual | visual: wet/dry composite order | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | RENDER-02 | manual | visual: density-weighted transparency | N/A | ⬜ pending |
| 02-02-01 | 02 | 1 | RENDER-02 | manual | visual: flow/diffusion visible shape changes | N/A | ⬜ pending |
| 02-03-01 | 03 | 2 | DEMO-03 | manual | visual: paper selector cycles 3 papers | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework needed. This phase operates on a single HTML file with visual output only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wet/dry composite order | RENDER-01 | Visual rendering output, no DOM assertions possible | Paint stroke, verify dry layer renders on top of wet layer |
| Density-weighted transparency | RENDER-02 | Per-pixel alpha from density, visual check required | Light stroke = translucent wash showing paper, heavy stroke = opaque |
| Flow/diffusion visible | RENDER-01 | Physics-driven visual change to stroke shape | Paint wet stroke, observe gravity drip and paper-guided spreading |
| Paper background decoupled from physics | RENDER-01 | Visual + behavior check | Switch to transparent BG, paint stroke — paper grain still affects flow |
| Paper selector | DEMO-03 | UI interaction + visual verification | Click each paper button, verify background AND heightmap change |

*All phase behaviors require manual visual verification — this is a rendering/physics phase with no programmatic test targets.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
