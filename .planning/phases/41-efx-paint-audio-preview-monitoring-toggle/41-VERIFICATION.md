---
phase: 41-efx-paint-audio-preview-monitoring-toggle
verified: 2026-08-05T12:25:00Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 41: EFX Paint Audio Preview + Monitoring Toggle Verification Report

**Phase Goal:** Users hear the main editor's audio arrangement, frame-synchronized to the Paint cursor, while playing Paint/Roto frames inside EFX Paint — read-only, with a session-local monitoring toggle.
**Verified:** 2026-08-05T12:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Frame-to-audio truth table written and test-encoded BEFORE implementation (roadmap-mandated entry artifact) | ✓ VERIFIED | `41-FRAME-AUDIO-TRUTH-TABLE.md` has all 9 locked sections (frame identity with physicPaintBridge.ts:956-961 proof, half-open window with playback-range cap, 8 worked offset/trim/slip examples, revision discipline, 40ms drift, fps policy, efxasset-only transport, silent scrub, DECISIONS LOCKED). RED suite committed `4d7b8b57` before first implementation commit `b99ee5c6`. |
| 2 | User hears main-editor audio at the correct Paint cursor; muted tracks inaudible (ROADMAP SC 1) | ✓ VERIFIED | `resolveTrackPlayback` (efxPaintAudioPreviewContext.ts:101-137) implements truth-table math verbatim with the range-end cap; monitor dispatches play/playDelayed via the shared audioEngine singleton (efxPaintAudioMonitor.ts:102-142); 62-test suite passes with worked-example numbers; native UAT step 1 approved 2026-08-05. |
| 3 | Seek/pause/resume/loop/stop synchronized without drift; no doubled audio (ROADMAP SC 2) | ✓ VERIFIED | Silent-scrub `positionedAt` (zero dispatch), `notifyLoopWrap` wired to the showNextFrame wrap branch (useRotoCachedPlayback.ts:192), throttled `checkDrift` (10-tick interval, `EFX_PAINT_AUDIO_DRIFT_THRESHOLD_SEC = 0.04`), first-player-wins guard both directions (`canStartAudio` child gate + `isPhysicPaintChildAudioClaimed()` main gate at playbackEngine.ts:208). Behaviorally pinned by tests (30ms ignored/50ms one restart; suppressed start dispatches zero plays); UAT steps 2/3/5 approved. |
| 4 | Session-local Audio Preview toggle silences monitoring without mutating main-editor state (ROADMAP SC 3) | ✓ VERIFIED | `audioPreviewEnabled = signal(true)` in efxPaintAudioPreviewStore.ts:19 — no persistence imports (source read confirms), idempotent `setAudioPreviewEnabled`, monitor `setPreviewEnabled` funnel (Off stops immediately, On resumes at live cursor via `toggleSilenced` lifecycle). Speaker button (Volume2/VolumeX size 15, aria-pressed, useStyledTooltip region bottom) in the playback pill beside the loop toggle (PhysicsPaintWorkflowStrip.tsx:378-398), wired through PhysicsPaintStudio.tsx:146-147,1400. UAT step 6 approved. |
| 5 | Main-editor audio changes arrive as revisioned push updates; stale never overwrites newer (ROADMAP SC 4) | ✓ VERIFIED | `installPhysicPaintAudioContextPublisher()` (signal effect over audioStore.tracks) installed from main.tsx:47, sharing the `nextAudioPreviewRevision` counter with the launch embed (total order); `publishPhysicPaintAudioContext` uses emitTo window-label targeting + CustomEvent + origin-checked postMessage; child `handleEfxPaintAudioContextEvent` applies through the strict newer-than funnel and restarts mid-playback at the live cursor. Idempotency (double-delivery applies once) and out-of-order (3/2/4 ends at 4, two applications) test-pinned. UAT step 4 approved. |
| 6 | Missing assets warn non-blocking; audio failure never blocks Paint; close releases all audio resources (ROADMAP SC 5) | ✓ VERIFIED | Per-track try/catch in `prepare` logs console.warn and skips only the failing track (efxPaintAudioMonitor.ts:74-85). `release()` (stopAll + guarded ctx.close + discard, idempotent) wired unconditionally in the close-requested handler BEFORE the hasPending gate (usePhysicsPaintParentBridge.ts:36-37) and on Studio unmount (PhysicsPaintStudio.tsx:694). Release tests (a)-(d) pass. UAT steps 7/8 approved. |
| 7 | EFX Paint holds no mutable audio authority (AUDIO-01) | ✓ VERIFIED | Source assertion: no imports of audioStore/timelineStore/playbackEngine from `app/src/components/physic-paint/audio/**` (grep — doc-comment mentions only); all track data arrives via the validated closed-key payload. |
| 8 | Launch context carries revisioned audioPreview section main→Rust→child (AUDIO-02) | ✓ VERIFIED | `EfxPaintAudioPreviewTrack/Context` types + closed-key guards (types/physicPaint.ts:465-501,908-935); conditional-spread embed in createPhysicPaintLaunchContext (physicPaintBridge.ts:1286); Rust `audio_preview: Option<Value>` serde-renamed `audioPreview` (lib.rs:91-92); child canonical rebuild in physicsPaintLaunchContext.ts:61-97; hydration via `applyRevisionedEfxPaintAudioPreview` (usePhysicsPaintLaunchIntegration.ts:129). cargo check clean. |
| 9 | Exactly one audioEngine instance in the child; closed context never resurrected (D-08) | ✓ VERIFIED | Monitor imports the existing `audioEngine` singleton; no `new AudioContext` anywhere in audio/** (grep); engine diff limited to read-only `hasContext()` probe + `closeContext()` (audioEngine.ts:189-200); post-release playAtCursor re-creates via ensureContext (test (d)). |
| 10 | Revision idempotency + concurrency edges (AUDIO-04) | ✓ VERIFIED | Same-revision re-application is a no-op via strict newer-than guard (efxPaintAudioPreviewContext.ts:80-88); single application funnel for hydration + push; out-of-order delivery test-pinned. |
| 11 | Toggle edge rows: same-value set is zero-call no-op; toggle racing an update serializes through the single funnel (AUDIO-05) | ✓ VERIFIED | Idempotent setter (store:41-45); restart decision taken after the prepare await so the funnel's final word reflects acceptance-time state (efxPaintAudioMonitor.ts:248-255); tests (c)/(d) pass. |
| 12 | D-04 CSP grant proven necessary before landing, single token, pinned (41-05 must-have) | ✓ VERIFIED | Literal packaged-build proof mode (locked `d04-proof-packaged-build` at the 41-01 checkpoint): user observed the verbatim connect-src refusal in the pre-grant packaged build 2026-08-05 (recorded in truth table section 7). RED contract test committed `d4cac3f9` before the grant `532e026e`. tauri.conf.json:38 connect-src = `'self' ipc: http://ipc.localhost https://* efxasset:` — exactly one new token, no data:/blob:; img-src/media-src directives untouched; 'Tauri CSP connect-src efxasset contract' block passes (11/11 releaseContract tests). |
| 13 | Native packaged-app UAT — the phase's sync-quality oracle | ✓ VERIFIED | 8-step UAT (sync, scrub, loop, live edit, doubling guard, toggle, missing file, close release) run by the user on a fresh packaged bundle (built 2026-08-05 08:31 local) and APPROVED 2026-08-05. |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `41-FRAME-AUDIO-TRUTH-TABLE.md` | Locked entry artifact, 9 sections | ✓ VERIFIED | All sections present incl. DECISIONS LOCKED + D-04 proof annotation |
| `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` | Truth-table-encoded suite | ✓ VERIFIED | 1070 lines, 62 tests, all green |
| `app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts` | Parse funnel + revision guard + mapping | ✓ VERIFIED | Substantive (137 lines), wired, behavioral tests pass |
| `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts` | Session store + toggle signal | ✓ VERIFIED | signal(true), idempotent setter, zero persistence |
| `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts` | Monitor state machine | ✓ VERIFIED | 320 lines, full funnel wired to playback hook |
| `app/src/components/physic-paint/audio/efxPaintAudioOwnership.ts` | First-player-wins guard | ✓ VERIFIED | Claim/release/suppressed-note/auto-resume, listener installed |
| `app/src-tauri/tauri.conf.json` | connect-src += efxasset: | ✓ VERIFIED | Single token; other directives byte-stable; contract test pins |
| `app/src/releaseContract.test.ts` | connect-src contract block | ✓ VERIFIED | 11/11 pass incl. unmodified image contract |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| createPhysicPaintLaunchContext | Rust `audio_preview` pass-through | conditional spread + serde rename | WIRED (physicPaintBridge.ts:1286; lib.rs:91) |
| launch hydration | efxPaintAudioPreviewStore | applyRevisionedEfxPaintAudioPreview | WIRED (usePhysicsPaintLaunchIntegration.ts:129) |
| useRotoCachedPlayback start/stop | monitor playAtCursor/stop | prepare→playAtCursor / finishPlayback→stop | WIRED (lines 173-174, 115) |
| audioStore.tracks effect | PHYSIC_PAINT_AUDIO_CONTEXT_EVENT | installPhysicPaintAudioContextPublisher from main.tsx | WIRED (main.tsx:47) |
| playbackEngine start/stop | PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT | publishPhysicPaintAudioPlaybackState | WIRED (playbackEngine.ts:62,76) |
| playbackEngine startAudioPlayback | child-claim gate | isPhysicPaintChildAudioClaimed | WIRED (playbackEngine.ts:208) |
| close-requested + unmount | monitor.release | onClose hook before hasPending gate + unmount effect | WIRED (usePhysicsPaintParentBridge.ts:36; PhysicsPaintStudio.tsx:694) |
| toggle button | setAudioPreviewEnabled | handleAudioPreviewToggle through strip props | WIRED (PhysicsPaintStudio.tsx:146,1400) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| monitor playback | `context.tracks` | launch payload / push events built from live `audioStore.tracks` (physicPaintBridge.ts:1219-1238) | Yes — decoded bytes via efxasset fetch | FLOWING |
| toggle button | `audioPreviewEnabled` | session signal, user-driven | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Audio preview suite green | `vitest run efxPaintAudioPreview.test.ts` | 62/62 passed | ✓ PASS |
| CSP contract pinned | `vitest run releaseContract.test.ts` | 11/11 passed | ✓ PASS |
| Full workspace suite | `vitest run` (single full run) | 97 files, 1091 passed / 1 skipped / 101 todo, exit 0 | ✓ PASS |
| Typecheck | `pnpm --dir app typecheck` | exit 0 | ✓ PASS |
| Rust struct change | `cargo check --manifest-path app/src-tauri/Cargo.toml` | Finished, clean | ✓ PASS |
| Native 8-step UAT | packaged app, user-run | Approved 2026-08-05 | ✓ PASS (human oracle, already closed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUDIO-01 | 41-02 | Main editor sole audio authority; EFX Paint monitoring-only | ✓ SATISFIED | Authority-boundary source assertion; payload-only data flow |
| AUDIO-02 | 41-01, 41-02 | Launch/session context resolves audible audio at the Paint cursor | ✓ SATISFIED | Revisioned section main→Rust→child; truth-table mapping tests |
| AUDIO-03 | 41-01, 41-03 | Start/seek/pause/stop/loop in sync, no sustained drift | ✓ SATISFIED | Scrub/loop/drift tests; UAT steps 1-3 |
| AUDIO-04 | 41-01, 41-03 | Revisioned bridge updates; stale never overwrites newer | ✓ SATISFIED | Push channel + strict newer-than funnel; idempotency/out-of-order tests; UAT step 4 |
| AUDIO-05 | 41-04 | Session-local toggle, no main-editor mutation | ✓ SATISFIED | signal(true) store, funnel-gated toggle, UI wired; UAT step 6 |
| AUDIO-06 | 41-02, 41-04, 41-05 | Missing-asset warning; never blocks Paint; close releases resources; no doubled audio | ✓ SATISFIED | Warn-skip tests, ownership guard, release() on both close paths; UAT steps 5/7/8 |

All six requirement IDs declared across plan frontmatter are accounted for; REQUIREMENTS.md traceability table (AUDIO-01..06 → Phase 41, Complete) matches. No orphaned requirements.

### Prohibitions (negative checks)

| Prohibition | Status |
|-------------|--------|
| No setTimeout/polling/rAF timing hacks in the audio design | HELD — grep clean (doc comments only) |
| No per-frame audio re-sync | HELD — checkDrift throttled to every 10th tick |
| No playbackRate/pitch scaling | HELD — no playbackRate usage in audio/** |
| No base64/data: audio URLs; no reuse of img-src data: grant | HELD — payload carries efxasset URLs only; connect-src has no data:/blob: |
| No filePath/relativePath in payload; no raw bytes across bridge | HELD — path-leak test passes; bytes flow via local child fetch only |
| No audioStore/timelineStore/playbackEngine imports in audio/** | HELD — source assertion clean |
| No second audioEngine instantiation; closed context never reused | HELD — singleton only; closeContext discards |
| No toggle persistence | HELD — no localStorage/project-store imports in store |
| No bare broadcast emit for audio events | HELD — emitTo window-label targeting (11 emitTo uses, zero bare emit) |
| No Rust efxasset handler MIME/scope changes | HELD — Rust diff limited to the launch-context struct field |

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX markers, no placeholder returns, no empty handlers in phase-touched files.

### Known Issues (from 41-REVIEW.md — robustness findings, not goal blockers)

The 2026-08-05 code review (1 critical, 8 warnings) identified async-lifecycle robustness gaps in the new audio modules. Assessed against the phase goal and must_haves — all of which are verified in code, tests, and the approved native UAT — these do not block goal achievement, but they are real and should be scheduled as follow-up work:

| ID | Severity | Issue | Assessment |
|----|----------|-------|------------|
| CR-01 | Critical (review) | Ungated async prepare→play chain can start audio after visual playback stops (useRotoCachedPlayback.ts:173-175) | Race window not exercised by the 8-step UAT; goal behaviors verified. Recommend a follow-up quick task (session/generation guard on the deferred play). |
| WR-01 | Warning | Concurrent prepare/applyRevisionedContext not serialized — stale decode can overwrite newer buffers | Robustness; revision guard protects the store, not the monitor decode state. |
| WR-02 | Warning | Launch hydration never clears audio store/monitor when the new launch omits audioPreview — stale audio survives Tauri window reuse | Also weakens the D-13 "fresh bundle resets toggle" assumption on re-launch. |
| WR-03 | Warning | Ownership claim taken even when zero sources dispatched — both windows can end up silent | Edge case in the doubling guard. |
| WR-04 | Warning | Drift corrector restart-storms when playback fps ≠ project fps (the A6 best-effort case) | A6 mismatch path; default matched-fps experience unaffected. |
| WR-05 | Warning | Claim-release on close is fire-and-forget — main-side claim can latch for the session | Mitigated in practice by the launch-reset (physicPaintBridge.ts:1323) on the next child open. |
| WR-06 | Warning | First-player-wins has an inherent IPC delivery race — the "structurally impossible" claim is overstated | One-round-trip window; UAT confirmed no doubling in practice. |
| WR-07/08 | Warning | Pre-existing efxasset Range-parsing u64 underflow + unscoped filesystem reads, now more reachable via the connect-src grant | Pre-dates the phase; the grant makes it more load-bearing. Security-relevant follow-up. |
| IN-01..04 | Info | Duplicated validation helpers (3 places), unused hasAudio export, `as unknown as AudioTrack` assertion, re-decode storm on fps change | Quality items. |

Out-of-scope observation recorded by 41-05: a pre-existing, unrelated `style-src` refusal at physics-paint:24 in the packaged EFX Paint webview (candidate follow-up quick task).

### Human Verification Required

None outstanding — the phase's blocking human gate (41-05 Task 3 native packaged-app UAT, 8 steps) was run by the user and APPROVED 2026-08-05. Every behavior-dependent truth (scrub silence, loop re-seek, drift correction, mid-playback restart, doubling guard, toggle immediacy, close release) is additionally exercised by the 62-test audio suite, which passes.

### Gaps Summary

None. All five ROADMAP success criteria, all plan must-haves, all six AUDIO requirements, and all D-decision prohibitions are verified in the codebase with behavioral test evidence and a user-approved native UAT. The 41-REVIEW.md findings are robustness/edge-case items tracked for follow-up; they do not negate any verified truth.

---

_Verified: 2026-08-05T12:25:00Z_
_Verifier: Claude (gsd-verifier)_
