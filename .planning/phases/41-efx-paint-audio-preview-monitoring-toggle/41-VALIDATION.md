---
phase: 41
slug: efx-paint-audio-preview-monitoring-toggle
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
validated: 2026-08-21
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --dir app exec vitest run <file>` |
| **Full suite command** | `pnpm --dir app exec vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app exec vitest run <file>`
- **After every plan wave:** Run `pnpm --dir app exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | AUDIO-03 | — | Frame→audio truth table locked before implementation | docs | `pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` (truth-table-derived expectations) | ✓ W0 | ✅ green |
| 41-01-02 | 01 | 0 | AUDIO-02 | T-41-01 | RED suite encodes schema parse, revision guard, resolveTrackPlayback mapping, path-leak guard | unit | `pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | ✓ W0 | ✅ green |
| 41-01-03 | 01 | 0 | AUDIO-04 | — | Four D-04-gating decisions locked (a4-protocol-url, a6-matched-fps, rev-counter, d04-proof-packaged-build) | docs | user-confirmed checkpoint | ✓ W0 | ✅ green |
| 41-02-01 | 02 | 0 | AUDIO-02 | T-41-03 | Launch audioPreview section plumbing, fail-null parse funnel, strict revision guard | unit | `pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | ✓ | ✅ green |
| 41-02-02 | 02 | 0 | AUDIO-01,06 | T-41-04 | Child monitor fetch/decode/play-at-cursor; missing-asset warn-and-skip only that track | unit | `pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | ✓ | ✅ green |
| 41-03-01 | 03 | 0 | AUDIO-03 | T-41-05 | Silent scrub, loop-wrap re-seek, 40ms drift corrector, matched-fps note | unit | `pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | ✓ | ✅ green |
| 41-03-02 | 03 | 0 | AUDIO-04 | T-41-07..09 | Push-on-change revisioned updates with mid-playback restart; idempotent/out-of-order | unit | `vitest run .../efxPaintAudioPreview.test.ts src/lib/physicPaintBridge.test.ts` | ✓ | ✅ green |
| 41-04-01 | 04 | 0 | AUDIO-06 | T-41-10..12 | First-player-wins guard, suppressed note, auto-resume, claim lifecycle, main-side claim gate | unit | `vitest run .../efxPaintAudioPreview.test.ts src/lib/playbackEngine.test.ts src/lib/physicPaintBridge.test.ts` | ✓ | ✅ green |
| 41-04-02 | 04 | 0 | AUDIO-05 | T-41-12 | Session-local toggle, immediate mid-playback effect, idempotent + concurrency edges | unit | `pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | ✓ | ✅ green |
| 41-05-01 | 05 | 0 | AUDIO-06 | T-41-13 | Engine release on close: idempotent stopAll + ctx.close on both close paths | unit | `pnpm --dir app exec vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | ✓ | ✅ green |
| 41-05-02 | 05 | 0 | AUDIO-06 | T-41-14 | CSP connect-src efxasset grant + pinned contract guard, no data:/blob: | unit | `pnpm --dir app exec vitest run src/releaseContract.test.ts` | ✓ | ✅ green |
| 41-05-03 | 05 | 0 | AUDIO-06 | — | Native packaged-app UAT (8 steps): sync, scrub, loop, live-edit, ownership, toggle, warn-skip, close release | manual | user-approved native UAT 2026-08-05 | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Frame→audio truth-table document + test suite (locked entry artifact per roadmap) — `41-FRAME-AUDIO-TRUTH-TABLE.md` + `efxPaintAudioPreview.test.ts`
- [x] Audio preview context schema/guard tests (revisioned payload) — `efxPaintAudioPreview.test.ts#parseEfxPaintAudioPreviewSection` / `applyRevisionedEfxPaintAudioPreview`
- [x] Drift-correction tests — `efxPaintAudioPreview.test.ts#checkDrift` (30ms ignored / 50ms restart / 10-tick throttle)
- [x] First-player-wins ownership guard tests — `efxPaintAudioPreview.test.ts` + `playbackEngine.test.ts` + `physicPaintBridge.test.ts`
- [x] Monitoring toggle tests — `efxPaintAudioPreview.test.ts#Audio Preview toggle`
- [x] `releaseContract.test.ts` extension for the `connect-src` grant (CSP proof, packaged-app discipline per D-04) — `releaseContract.test.ts#Tauri CSP connect-src efxasset contract`

*Existing vitest infrastructure covers the runner; Wave 0 creates the phase-specific test files above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audible frame-synced monitoring in EFX Paint (no drift, no doubled audio) | AUDIO-01..05 | Audio sync quality is inherently a native-UAT judgment (project convention) | **PASSED** — 8-step packaged-app UAT approved by user 2026-08-05 (`EFX Motion Editor.app` bundle 08:31 local): cursor sync, scrub silence, loop re-seek no drift, live-edit restart, doubled-audio ownership + auto-resume, speaker toggle isolation, missing-file warn-and-skip, close release + clean reopen |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands use `vitest run`, never watch)
- [x] Feedback latency < 60s (audio suites run in ~1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-21 — 0 gaps found; 11/12 tasks automated, 1 native-UAT manual (passed)

---

## Validation Audit 2026-08-21
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Evidence:** Re-audit confirmed green suites — `efxPaintAudioPreview.test.ts` (62 tests), `physicPaintBridge.test.ts` (115 passed), `releaseContract.test.ts` (11 tests), `playbackEngine.test.ts` (11 tests). Native packaged-app UAT (41-05-03) approved by user 2026-08-05. All AUDIO-01..06 closed across plans 41-01..05.
