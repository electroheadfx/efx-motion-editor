---
phase: 10
slug: fx-blur-effect
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test infrastructure in project |
| **Config file** | None — consistent with all previous phases |
| **Quick run command** | Manual visual inspection in Tauri dev mode |
| **Full suite command** | Full manual walkthrough of all blur levels and toggles |
| **Estimated runtime** | ~5 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual visual inspection in Tauri dev mode
- **After every plan wave:** Full manual walkthrough of all blur levels and toggles
- **Before `/gsd:verify-work`:** All success criteria verified visually
- **Max feedback latency:** ~60 seconds (app reload)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | Blur in FX menu | manual-only | Visual inspection in Tauri app | N/A | ⬜ pending |
| TBD | TBD | TBD | Fast blur during playback | manual-only | Play sequence with blur layer, check FPS | N/A | ⬜ pending |
| TBD | TBD | TBD | HQ blur (StackBlur) | manual-only | Toggle HQ, compare quality visually | N/A | ⬜ pending |
| TBD | TBD | TBD | Blur radius slider | manual-only | Drag slider, observe preview | N/A | ⬜ pending |
| TBD | TBD | TBD | Bypass toggle | manual-only | Toggle bypass, verify no blur | N/A | ⬜ pending |
| TBD | TBD | TBD | Generator blur alpha | manual-only | Add grain + blur, check no halos | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (all validation is manual).
- No test framework installation needed — consistent with Phases 1–9.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blur appears in Add FX menu | SC-1 | Visual UI check | Open Add FX menu, verify "Blur" option exists alongside grain, vignette, etc. |
| Fast blur during playback | SC-2 | Real-time performance check | Add blur layer, play sequence, verify smooth playback (no frame drops) |
| HQ blur on export/toggle | SC-3 | Visual quality comparison | Toggle HQ, compare blur quality visually (should be smoother/more precise) |
| Blur radius slider real-time | SC-4 | Interactive UI behavior | Drag blur radius slider, verify preview updates in real-time without lag |
| Bypass toggle disables blur | SC-4 | Global state check | Toggle Bypass Blur, verify all blur effects are removed from preview |
| Generator blur preserves alpha | SC-1 | Compositing artifact check | Add grain generator with blur, verify no dark halos around particles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
