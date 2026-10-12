---
phase: "51"
slug: "read-only-audio-preview"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-11"
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed 2026-09-11 by `/gsd-validate-phase 51` (State B variant — the phase was delivered via quicks 260902-cfa + 260902-cfa-amendments, so its execution artifacts live in `.planning/quick/` and there are no phase-local PLAN/SUMMARY files).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node env) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <app-relative test path>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` + `pnpm --filter efx-motion-editor exec tsc --noEmit` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run <touched suite>`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Delivered workstreams (from the quick PLAN/SUMMARYs; the phase ran without a numbered plan set):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 260902-cfa-01 | cfa | 1 | AUD-04, AUD-02 | T-51-01 / T-51-02 | Seek target validated against `getFrames()`; single audio funnel (`playAtCursor`= stopAll + re-dispatch) | unit | `vitest run src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts` (seek describe) | ✅ | ✅ green |
| 260902-cfa-02 | cfa | 1 | AUD-02, AUD-04 | T-51-01 | Seek path routes through `rotoCachedPlayback.seek` only — no new monitor rule, no second funnel | unit (source contract) | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ | ✅ green |
| 260902-cfa-03 | cfa | 1 | AUD-01..AUD-04 | — | Locked Phase 41 truth table stays green (frame identity, audible window, revision guard, fps, ownership, toggle, release) | unit | `vitest run src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | ✅ | ✅ green |
| 260902-cfa-am-01 | amendments | 1 | AUD-02, AUD-04 | — | `start()` re-anchors at the live app-frame cursor (D-01); out-of-range clamps to range start | unit | `vitest run …/useRotoCachedPlayback.test.ts` (D-01 describe) | ✅ | ✅ green |
| 260902-cfa-am-02 | amendments | 1 | AUD-04 | T-51-01 | Audible scrub is a throttled snippet (`scrubAt` ~120ms, stop gate) → `playAtCursor`; muted scrub dispatches nothing | unit | `vitest run …/efxPaintAudioPreview.test.ts` (audible scrub describe) | ✅ | ✅ green |
| 260902-cfa-am-03 | amendments | 1 | AUD-04 | — | Scrub lifecycle gates the funnel (`scrubActiveRef` → scrub vs seek, `scrubEnd` on release) | unit (source contract) | `vitest run …/PhysicsPaintStudio.test.ts …/usePhysicsPaintRulerScrub.test.ts` | ✅ | ✅ green |
| 260902-cfa-am-04 | amendments | 1 | AUD-04 | — | Loop wrap returns to the initial scrub position, not the range start | unit | `vitest run …/useRotoCachedPlayback.test.ts` (loop wrap describes) | ✅ | ✅ green |
| 51-VAL-01 | validate-phase | — | AUD-01 | — | Child audio module imports NOTHING from `audioStore` / `timelineStore` / `playbackEngine` (authority boundary) | unit (source-scan contract) | `vitest run src/components/physic-paint/audio/efxPaintAudioAuthorityContract.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements — the Phase 41 truth-table suite (`efxPaintAudioPreview.test.ts`) was already the RED suite encoding the locked truth table; the quick series extended it.
- [x] `efxPaintAudioAuthorityContract.test.ts` — the AUD-01 boundary contract, added by this validation audit (2026-09-11); the only coverage gap found.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audible multi-track sync in the live Studio | AUD-04 | Perceptual: real audio output through WebKit/WKWebView with real assets; unit tests pin the dispatch math, not audibility | Play a multi-track document with monitoring On; seek, loop, pause/stop, resume; confirm audio follows the shared app-frame cursor without drift or doubled playback |
| Toggle non-mutation + release on close, live | AUD-03 | Session/lifecycle behavior on the real engine (AudioContext teardown) — perceptual and process-level | Toggle monitoring Off/On mid-playback → silence/resume with no visual restart; close Studio → no lingering audio, source audio unmodified in the main editor |
| First-player-wins across windows, live | AUD-01 | Requires two live webviews (main editor + Studio) and real playback | Start playback in the main editor → Studio suppresses itself with the note; stop main → Studio auto-resumes at the live cursor |
| Synchronized audio in the packaged (signed) build | AUD-01, AUD-04 | Packaged CSP differs from dev (connect-src/data:); only a packaged run proves the `efxasset://` path | Phase 53 native UAT step 6 on the signed artifact: play internal tracks with synchronized main-editor audio |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-11

---

## Validation Audit 2026-09-11

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

*Gap: AUD-01 authority boundary was comment-documented only. Resolved by `efxPaintAudioAuthorityContract.test.ts` (source-scan contract with a positive/negative control; 2 tests). Full suite re-run green: 194 files / 3540 passed / 1 skipped / 101 todo; `tsc --noEmit` clean. Caveat recorded (not a gap): the contract pins the three named modules; other main-side imports (the ownership event constant, the shared `audioEngine`) remain permitted by the documented boundary.*
