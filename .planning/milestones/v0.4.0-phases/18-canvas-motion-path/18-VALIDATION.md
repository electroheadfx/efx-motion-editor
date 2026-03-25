---
phase: 18
slug: canvas-motion-path
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | Motion path rendering | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | Keyframe circle markers | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | Keyframe drag interaction | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | Playhead seek on drag | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for motion path dot generation from keyframe interpolation
- [ ] Test stubs for coordinate conversion (keyframe offset to project space)
- [ ] Test stubs for hit testing keyframe circles

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dotted trail visual appearance | D-01 | Canvas rendering requires visual inspection | Select keyframed layer, verify dots appear along path |
| Dot spacing reflects easing | D-01 | Visual density assessment | Set ease-in-out, verify dots cluster at start/end |
| Path hides during playback | D-10 | Requires playback state integration | Press Space, verify path disappears; pause, verify reappears |
| Current frame dot highlight | D-08 | Visual treatment assessment | Scrub timeline, verify highlighted dot moves along path |
| Drag keyframe circle updates trail | D-04 | Requires canvas pointer interaction | Drag keyframe circle, verify trail updates in real-time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
