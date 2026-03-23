---
phase: 16
slug: audio-export-beat-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | Application/vitest.config.ts |
| **Quick run command** | `cd Application && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd Application && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd Application && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd Application && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | BEAT-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | BEAT-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | BEAT-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | BEAT-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | BEAT-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-03-02 | 03 | 2 | BEAT-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for audio export mixing (OfflineAudioContext, WAV encoding)
- [ ] Test stubs for BPM detection algorithm (onset detection, autocorrelation)
- [ ] Test stubs for beat marker rendering (timeline canvas)
- [ ] Test stubs for snap-to-beat and auto-arrange logic

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audio plays correctly in exported video | BEAT-01 | Requires FFmpeg encode + media playback | Export video with audio, play in VLC, verify sync |
| Beat markers visually align with audio beats | BEAT-02 | Visual alignment verification | Import known-BPM track, check marker positions |
| Snap feedback feels responsive | BEAT-04 | UX feel during drag interaction | Drag hold-duration handle near beat marker, verify snap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
