---
phase: quick-260905-ibd
plan: 260905-ibd
subsystem: ui
tags: [preact, signals, physics-paint, timeline, audio, scrub, perf]

# Dependency graph
requires:
  - phase: quick-260827-s52
    provides: ruler seek/scrub hook (onSeek/onScrubStart/onScrubEnd lifecycle) and the playhead bar leaf
  - phase: quick-260902-cfa
    provides: D-02 audible scrub monitor (scrubAt/scrubEnd, throttle, snippet) and the seek/scrub audio funnel
provides:
  - Paint scrub drag-gate: mid-drag seeks write only the rotoScrubFrame playhead feed + audio snippet; the full navigation settles once on release
  - Release exactness: the ruler hook flushes a queued rAF frame synchronously at release, so the settle lands on the exact pointer frame
  - Sticky-feed catch-up: the scrub feed clears only when the settle propagation's startFrame matches it (no playhead jump-back)
  - Main-studio audible scrub: playbackEngine.scrubToFrame (idle: 120ms-throttled 4-frame snippet, D-05 ownership-guarded; playing: seek-restart) + scrubAudioEnd on release
  - Launch-time audio monitor prepare: launch hydration routes through handleEfxPaintAudioContextEvent, so idle scrub is audible without pressing Play first
  - Profile-gated [efx-paint-audio] gate diagnostics in efxPaintAudioMonitor (efx.physicsPaint.profile=1)
affects: [quick-260827-s52, quick-260902-cfa, PhysicsPaintStudio, PhysicsPaintWorkflowStrip, playbackEngine, TimelineInteraction]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Net against the pre-quick base 279726c4 (the revert cancels the 8 failed commits).
actuals:
  tokens: 8225    # chars/4 over the net realized diff (32902 chars, +352/-22 across 12 files)
  tasks: 4
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drag-gate: gate per-frame work OFF during a gesture (a ref armed by onScrubStart/onScrubEnd) instead of streaming state and mitigating render cost with memos"
    - "Sticky playhead feed: a signal cleared by a catch-up effect when the settled authority equals it — source switches are always value-identical, so zero flicker without render-body writes"
    - "Release exactness: cancel the pending rAF and emit its frame synchronously inside the gesture cleanup before the end callback"
    - "Audible idle scrub: throttle-gated short snippet through the shared audioEngine.play with maxDurationSec, mirroring the paint monitor's D-02 design on the main side"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
    - app/src/lib/playbackEngine.ts
    - app/src/components/timeline/TimelineInteraction.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts
    - app/src/lib/playbackEngine.test.ts
    - app/src/components/timeline/TimelineInteraction.test.ts

key-decisions:
  - "REVERT the 8 failed commits (8a1b01f0..6bc3fcae, backed out in 269c2bd9): three UAT rounds proved per-frame propagation + memo mitigation cannot be made invisible — one fresh-object dep silently busts a ~109-dep identity memo, and the per-frame rotoCachedPlayback.stop() → audioEngine.stopAll() chopped each scrub snippet within 16ms. The user's re-scoped law (drag = playhead + audio only) is simpler and provably invisible."
  - "Gate in handleNavigateToSyncedFrame on scrubActiveRef: while armed, a seek writes rotoScrubFrameSignal + rotoCachedPlayback.scrub(frame) and returns — skipping the flush, canvas repaint, setLaunchContext, selection reseed, and sendPhysicPaintFrameSyncMessage. onScrubEnd runs the ONE settle navigation at the final frame."
  - "Keep the scrub feed sticky after release (cleared by the startFrame catch-up effect, plus defensive clears at arm and on the next non-scrub navigation) so the playhead bar never switches to a stale source mid-settle."
  - "Main-studio scrub silence was a MISSING FEATURE (seekToFrame restarted audio only while playing), not a regression — added scrubToFrame/scrubAudioEnd mirroring the paint D-02 constants (120ms / 4 frames) with the D-05 child-claim guard."
  - "Paint scrub silence root cause: launch hydration applied the audioPreview section to the store ONLY — the monitor's prepare() ran solely on Play or a live track push, so scrubAt's !context gate silenced idle scrub in Play-less sessions. Launch hydration now uses the same single funnel as push events (handleEfxPaintAudioContextEvent)."
  - "Leave the [efx-paint-audio] diagnostics in place, gated by efx.physicsPaint.profile=1 — zero cost when off, names the exact gate (no-context / toggle-off / ownership / AudioContext state / prepared count) when on."

patterns-established:
  - "Pattern: for gesture-frame work, prefer gating the work off over optimizing its render — a ref-armed drag-gate at the navigation port, with a single settle on release, beats any memo wall."
  - "Pattern: cross-window sync events during a drag are sent ONCE on release, never per frame (each window's scrub is independent; G-01 sync preserved on release)."

requirements-completed: [G-52-9]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Paint ruler scrub drag moves only the playhead bar + audible snippet; no Studio/strip re-render, no main-window frame sync mid-drag; release settles once at the exact pointer frame"
    requirement: G-52-9
    verification: native UAT 2026-09-05 (user: scrub slow+fast — only the vertical line moves, buttons/canvas frozen, main studio untouched; release at frame N settles; +Key/Delete/Scissor/Paste land on N)
  - id: D2
    description: "Main-studio timeline scrub plays a throttled 4-frame audio snippet while idle (seek-restart while playing), stopping on release; D-05 child-claim guard respected"
    requirement: G-52-9
    verification: native UAT 2026-09-05 (user: 'its perfect in studio all work'); behavioral tests cover snippet cap, 120ms throttle, ownership guard, playing restart, scrubAudioEnd reset
  - id: D3
    description: "Paint idle scrub is audible in a fresh window without pressing Play first (launch hydration prepares the monitor)"
    requirement: G-52-9
    verification: native UAT 2026-09-05 (user: 'it works !' — scrubbed without Play first)

# Verification
verification:
  status: passed
  date: 2026-09-05
  gates:
    - "pnpm exec vitest run — 3471 passed, 1 skipped, 101 todo (185 files)"
    - "pnpm exec tsc --noEmit — clean"
  native_uat:
    - "Paint scrub slow+fast: only the vertical line moves; buttons, canvas, and main studio frozen — PASSED"
    - "Release at frame N: canvas/buttons settle once; main studio seeks once; actions land on N — PASSED"
    - "Paint scrub audio without pressing Play first — PASSED"
    - "Main studio scrub audio while dragging, stops on release — PASSED"
  commits:
    - "269c2bd9 revert(quick-260905-ibd): back out the 8 failed G-52-9 perf commits"
    - "1cf575e0 feat(quick-260905-ibd): scrub drag-gate — playhead+audio only during drag, settle on release (G-52-9)"
    - "aea03d2a chore(quick-260905-ibd): profile-gated scrub audio diagnostics in the paint monitor"
    - "c10af211 fix(quick-260905-ibd): prepare the paint audio monitor at launch hydration"
---
