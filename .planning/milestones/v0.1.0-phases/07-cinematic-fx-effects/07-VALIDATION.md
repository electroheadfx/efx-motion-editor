---
phase: 7
slug: cinematic-fx-effects
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual visual inspection + TypeScript type-check |
| **Config file** | none |
| **Quick run command** | `pnpm build` |
| **Full suite command** | `pnpm build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm build`
- **After every plan wave:** Manual visual inspection in running Tauri app
- **Before `/gsd:verify-work`:** Full build must pass + all FX types visible and configurable in preview
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | FX-01 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-02 | 01 | 1 | FX-02 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-03 | 01 | 1 | FX-03 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-04 | 01 | 1 | FX-04 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-05 | 01 | 1 | FX-05 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-06 | 01 | 1 | FX-06 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-07 | 01 | 1 | FX-07 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-08 | 01 | 1 | FX-08 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-09 | 01 | 1 | FX-09 | manual-only | `pnpm build` + visual inspection | N/A | ⬜ pending |
| 7-01-10 | 01 | 1 | FX-10 | manual-only | `pnpm build` + compare preview vs export | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework to install — validation is manual visual inspection backed by `pnpm build` type-checking.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Film grain renders on canvas | FX-01 | Visual effect — requires human judgment | Add film grain FX layer, verify noise pattern visible on preview canvas |
| Grain intensity adjustable | FX-02 | Visual parameter — requires human judgment | Adjust grain intensity slider, verify visual change |
| Vignette renders on canvas | FX-03 | Visual effect — requires human judgment | Add vignette FX layer, verify darkened edges visible |
| Vignette params adjustable | FX-04 | Visual parameters — requires human judgment | Adjust intensity/size/softness, verify visual changes |
| Color grade applies to canvas | FX-05 | Visual effect — requires human judgment | Add color grade FX layer, verify color shift visible |
| Color grade params adjustable | FX-06 | Visual parameters — requires human judgment | Adjust brightness/contrast/saturation/hue/fade sliders individually |
| Dirt/scratches video overlay | FX-07 | Video compositing — requires visual check | Import dirt/scratches video, verify overlay composited on preview |
| Light leaks video overlay | FX-08 | Video compositing — requires visual check | Import light leaks video, verify overlay composited on preview |
| Intensity adjustable for all FX | FX-09 | Visual parameter — requires human judgment | Adjust intensity for each FX type, verify visual change |
| Resolution-independent parameters | FX-10 | Requires multi-resolution comparison | Compare preview at 830px with mental model; full verification at Phase 10 export |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
