---
phase: 15
slug: audio-import-waveform
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `Application/vitest.config.ts` |
| **Quick run command** | `cd Application && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd Application && npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd Application && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd Application && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-00 | 01 | 1 | ALL | scaffold | `cd Application && npx vitest run --reporter=verbose` | W0 creates | pending |
| 15-01-01 | 01 | 1 | AUDIO-01 | unit | `cd Application && npx vitest run src/stores/audioStore.test.ts` | W0 | pending |
| 15-01-02 | 01 | 1 | AUDIO-01,05 | unit | `cd Application && npx vitest run src/stores/audioStore.test.ts` | W0 | pending |
| 15-01-03 | 01 | 1 | AUDIO-02,04,06 | unit | `cd Application && npx vitest run src/lib/audioWaveform.test.ts src/lib/audioEngine.test.ts` | W0 | pending |
| 15-02-01 | 02 | 2 | AUDIO-01 | unit+tsc | `cd Application && npx vitest run src/stores/audioStore.test.ts && npx tsc --noEmit` | W0 | pending |
| 15-02-02 | 02 | 2 | AUDIO-02 | unit+tsc | `cd Application && npx vitest run src/lib/audioWaveform.test.ts && npx tsc --noEmit` | W0 | pending |
| 15-03-01 | 03 | 3 | AUDIO-03,05 | unit+tsc | `cd Application && npx vitest run src/stores/audioStore.test.ts src/lib/playbackEngine.test.ts && npx tsc --noEmit` | W0 | pending |
| 15-03-02 | 03 | 3 | AUDIO-03 | unit+tsc | `cd Application && npx vitest run src/lib/playbackEngine.test.ts && npx tsc --noEmit` | W0 | pending |
| 15-04-01 | 04 | 4 | AUDIO-04,06 | unit+tsc | `cd Application && npx vitest run src/lib/audioEngine.test.ts && npx tsc --noEmit` | W0 | pending |
| 15-04-02 | 04 | 4 | AUDIO-07 | unit+tsc | `cd Application && npx vitest run src/stores/projectStore.test.ts && npx tsc --noEmit` | W0 | pending |

*Status: pending -- all Wave 0*

---

## Wave 0 Requirements

- [ ] `Application/src/stores/audioStore.test.ts` -- stubs for AUDIO-01, AUDIO-05 (addTrack, removeTrack, updateTrack, setOffset, setInOut, setSlipOffset, reorderTracks, setMuted, setVolume)
- [ ] `Application/src/lib/audioWaveform.test.ts` -- stubs for AUDIO-02 (computeWaveformPeaks produces 3 tiers, mono mixdown, correct peak counts)
- [ ] `Application/src/lib/audioEngine.test.ts` -- stubs for AUDIO-04, AUDIO-06 (decode, play, stop, setVolume, applyFadeSchedule)
- [ ] `Application/src/lib/playbackEngine.test.ts` -- stubs for AUDIO-03 (start hooks audioEngine, stop calls stopAll, seek restarts audio)
- [ ] `Application/src/stores/projectStore.test.ts` -- stubs for AUDIO-07 (buildMceProject includes audio_tracks, hydrateFromMce restores them)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Waveform renders visually on timeline canvas | AUDIO-02 | Canvas 2D rendering requires visual inspection | Import audio, verify teal waveform appears below FX tracks |
| Audio playback audibly syncs with preview | AUDIO-03 | Audio output requires human hearing | Play preview, listen for audio sync with visual timeline |
| Properties panel layout and interaction | AUDIO-04,06 | UI layout requires visual inspection | Select audio track, verify properties panel shows correct controls |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-21
