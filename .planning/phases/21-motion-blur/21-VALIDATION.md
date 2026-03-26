---
phase: 21
slug: motion-blur
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | MBLR-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | MBLR-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | MBLR-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | MBLR-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | MBLR-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 21-02-03 | 02 | 2 | MBLR-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 21-02-04 | 02 | 2 | MBLR-07 | manual | N/A | N/A | ⬜ pending |
| 21-02-05 | 02 | 2 | MBLR-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 21-02-06 | 02 | 2 | MBLR-09 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for motion blur GLSL shader uniform validation
- [ ] Test stubs for velocity computation from keyframe interpolation
- [ ] Test stubs for shutter angle → blur strength mapping
- [ ] Test stubs for MceProject v15 serialization round-trip
- [ ] Test stubs for sub-frame accumulation export logic

*Existing vitest infrastructure covers test runner setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual blur quality matches directional motion | MBLR-07 | Perceptual quality requires visual inspection | 1. Create layer with horizontal keyframe motion 2. Enable motion blur 3. Play preview — verify blur direction matches motion 4. Verify stationary layers remain sharp |
| Preview playback smoothness | MBLR-09 | FPS measurement requires runtime observation | 1. Enable motion blur on 3+ layers 2. Play preview 3. Verify no dropped frames or stuttering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
