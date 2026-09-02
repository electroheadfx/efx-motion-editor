---
phase: quick-260902-cfa-amendments
plan: 260902-cfa-amendments
subsystem: physic-paint audio preview (D-01 Play cursor + D-02 audible scrub)
tags: [physics-paint, audio-preview, d-01, d-02, play-cursor, audible-scrub, ruler]
requires:
  - Quick 260902-cfa seek wiring (rotoCachedPlayback.seek, positionedAt production caller)
  - Phase 41 audio monitor (efxPaintAudioMonitor playAtCursor/positionedAt, locked truth table)
provides:
  - useRotoCachedPlayback.getCurrentAppFrame input — start() re-anchors at the shared application-frame cursor (D-01)
  - efxPaintAudioMonitor.scrubAt/scrubEnd — throttled audible-scrub snippet (D-02 amendment)
  - useRotoCachedPlayback.scrub/scrubEnd funnels + ruler scrub lifecycle (onScrubStart/onScrubEnd)
affects:
  - Phase 51 (Read-only Audio Preview)
tech-stack:
  added: []
  patterns:
    - Play-after-idle-seek resumes at the cursor (D-01): start() resolves getCurrentAppFrame, finds its index in cachedFrames, begins visual playback there, playAtCursor(cursorAppFrame, rangeEnd); out-of-range falls back to range start; loop wrap still returns to range start
    - Audible scrub (D-02 amendment): each ruler-drag update re-dispatches a short snippet (cursor + 4 frames) through playAtCursor, throttled ~120ms; muted sessions stay a silent positionedAt re-anchor (D-09); drag release stops the snippet and re-anchors at the final frame
key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
    - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts
key-decisions:
  - "D-01: Play re-anchors at the shared application-frame cursor — start() resolves getCurrentAppFrame at press time, begins visual playback at that frame, and dispatches playAtCursor(cursorAppFrame, rangeEnd); out-of-range falls back to the range start; loop wrap still returns to the range start"
  - "D-02 amendment: audible scrub is a throttled short snippet through the monitor (playAtCursor = stopAll + re-dispatch), gated on the existing Volume2/VolumeX toggle — muted scrub stays a silent positionedAt re-anchor (D-09 unchanged), no new UI"
requirements-completed: [AUD-01, AUD-02, AUD-03, AUD-04]
coverage:
  - id: D1
    description: "start() re-anchors at the current application-frame cursor (getCurrentAppFrame input) — visual playback begins at the cursor frame, playAtCursor(cursorAppFrame, rangeEnd); out-of-range falls back to range start; loop wrap returns to range start"
    requirement: AUD-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts#start honors the current application-frame cursor (D-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Audible scrub — efxPaintAudioMonitor.scrubAt dispatches a short snippet (cursor + 4 frames) through playAtCursor throttled to 120ms; muted sessions stay a silent positionedAt re-anchor; scrubEnd stops the snippet and re-anchors at the final frame"
    requirement: AUD-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts#audible scrub (260902-cfa amendment: D-02 throttled snippet / D-09 silent when muted)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Scrub lifecycle wiring — usePhysicsPaintRulerScrub onScrubStart/onScrubEnd, strip props, Studio scrubActiveRef gates scrub vs seek in navigateToSyncedPhysicalFrame, onScrubEnd stops the snippet and re-anchors at the final frame"
    requirement: AUD-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#wires the audible scrub path: scrubActiveRef gates seek vs scrub and scrubEnd on release (D-02 amendment)"
        status: pass
    human_judgment: false
metrics:
  duration: 30min
  completed: 2026-09-02
  tasks: 3
  commits: 4
actuals:
  tokens: 0
  tasks: 3
  commits: 4
status: complete
---

# Quick 260902-cfa-amendments: D-01 Play Cursor + D-02 Audible Scrub Summary

**One-liner:** Two D-amendments to the Phase 51 audio-preview wiring — (1) Play now re-anchors at the shared application-frame cursor (an idle seek to frame N resumes visually AND audibly at N, never the range start), and (2) dragging the ruler with playback idle and monitoring enabled plays a throttled short audio snippet at the dragged position, stopping and re-anchoring at the final frame on release — with muted scrub staying silent (D-09 unchanged) and no new UI.

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-02T09:31:00Z
- **Completed:** 2026-09-02T09:38:30Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- **D-01 fix — Play honors the cursor:** `useRotoCachedPlayback` gains an optional `getCurrentAppFrame` input (default `() => 0`), passed through `useRotoNavigationCoordinator`; the Studio provides `() => currentFrame`. `start()` resolves the cursor index in `cachedFrames` and begins visual playback there, dispatching `playAtCursor(cursorAppFrame, rangeEnd)` — an idle seek to frame N resumes at N, never the range start. An out-of-range cursor (or no matching frame) falls back to the range start; loop wrap still returns to the range start.
- **D-02 amendment — audible scrub:** `efxPaintAudioMonitor` gains `scrubAt`/`scrubEnd`. Each ruler-drag update re-dispatches a short snippet (`cursor + EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES` = 4 frames) through `playAtCursor` (stopAll + re-dispatch), throttled to `EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS` = 120ms to avoid stopAll/re-prepare spam and crackle. With the session toggle Off (or no audio section) the scrub stays a silent `positionedAt` re-anchor (D-09 unchanged) — the toggle check happens in `scrubAt` so a muted scrub never sets the D-14 `toggleSilenced` flag. `scrubEnd` stops the snippet through the single stop funnel and re-anchors at the final frame.
- **Scrub lifecycle wiring:** `usePhysicsPaintRulerScrub` gains `onScrubStart`/`onScrubEnd` (fired on 4px arm and on release with the last emitted frame; a plain click never fires them). The strip routes them to new props; the Studio tracks a `scrubActiveRef` — `navigateToSyncedPhysicalFrame` routes the audio funnel to `scrub` (audible snippet) while armed, `seek` (silent re-anchor) after, and `onScrubEnd` clears the flag and calls `rotoCachedPlayback.scrubEnd(frame)`.
- The AUDIO-01 authority boundary is preserved: no new monitor rule, no new UI, no audioStore/timelineStore/playbackEngine import in the child. The existing Volume2/VolumeX toggle governs audible scrub.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-01 fix — Play re-anchors at the cursor** (TDD)
   - `13a98b89` (feat: getCurrentAppFrame input + start() re-anchor)
2. **Task 2: Audible scrub — monitor scrubAt/scrubEnd + hook scrub/scrubEnd** (TDD)
   - `d326b1f5` (feat)
3. **Task 3: Scrub lifecycle wiring — ruler scrub hook + strip + Studio** (TDD + contract tests)
   - `9fed9875` (feat)
4. **Task 4: Docs** — `(docs commit)`

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` - `getCurrentAppFrame` input (optional, default `() => 0`), `start()` re-anchor at the cursor index, `scrub`/`scrubEnd` funnels (active → seek-restart, idle → scrubAt / scrubEnd)
- `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts` - `getCurrentAppFrame` pass-through on the playback input
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `getCurrentAppFrame: () => currentFrame`, `scrubActiveRef`, `onScrubStart`/`onScrubEnd` strip props, scrub-vs-seek routing in `navigateToSyncedPhysicalFrame`
- `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts` - `EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS`/`EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES`, `lastScrubAt` throttle (reset in `stop()`), `scrubAt`/`scrubEnd`
- `app/src/components/physic-paint/hooks/usePhysicsPaintRulerScrub.ts` - `onScrubStart`/`onScrubEnd` lifecycle callbacks
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - `onScrubStart`/`onScrubEnd` props wired to the ruler scrub hook
- Test files: `useRotoCachedPlayback.test.ts` (D-01 + scrub tests), `efxPaintAudioPreview.test.ts` (audible scrub tests), `usePhysicsPaintRulerScrub.test.ts` (lifecycle tests), `PhysicsPaintStudio.test.ts` (scrub-wiring contract test), `PhysicsPaintWorkflowStrip.rulerSeek.test.ts` (strip routing contract test)

## Decisions Made

- **D-01: Play re-anchors at the cursor, never the range start.** `start()` resolves the shared application-frame cursor at press time via `getCurrentAppFrame`, finds its index in `cachedFrames`, and begins visual playback there, dispatching `playAtCursor(cursorAppFrame, rangeEnd)`. Out-of-range falls back to the range start; loop wrap still returns to the range start.
- **D-02 amendment: audible scrub is a throttled short snippet through the monitor.** Each scrub update re-dispatches `playAtCursor(cursor, cursor + 4)` (stopAll + re-dispatch), throttled to 120ms. The toggle check lives in `scrubAt` (not `playAtCursor`) so a muted scrub never sets the D-14 `toggleSilenced` flag. Drag release stops the snippet and re-anchors at the final frame.
- **The scrub lifecycle is a gesture concern, the audio is a monitor concern.** `usePhysicsPaintRulerScrub` reports arm/release; the Studio gates the audio funnel by `scrubActiveRef`; the monitor owns the throttle, snippet window, and toggle gate.

## Deviations from Plan

No deviations. The implementation followed the user's spec exactly (D-01 cursor re-anchor with range-start clamp and loop-wrap preservation; D-02 throttled snippet with release-stop and muted-silent behavior).

## Issues Encountered

- The `installWindowTimers` helper in `useRotoCachedPlayback.test.ts` is scoped to the outer describe; the new D-01 describe defines its own local copy (test-only, no production impact).
- The deferred prepare→playAtCursor chain in `start()` requires a microtask flush in the D-01 tests (same pattern as the existing CR-01 tests).

## Next Phase Readiness

- The D-01 cursor re-anchor and the D-02 audible scrub are wired end-to-end; the locked Phase 41 truth-table regression suite remains green.
- Phase 51 (Read-only Audio Preview) can build on the single seek/scrub funnels; multi-track sync, toggle non-mutation, and release-on-close remain verification-only (native UAT).

## Self-Check

- Files: all 11 modified files confirmed on disk.
- Commits: 13a98b89, d326b1f5, 9fed9875, plus the docs commit — all present in git log.
- Full suite: 3320 passed / 1 skipped / 101 todo (179 files); `tsc --noEmit` clean.

## Self-Check: PASSED

---
*Phase: quick-260902-cfa-amendments*
*Completed: 2026-09-02*
