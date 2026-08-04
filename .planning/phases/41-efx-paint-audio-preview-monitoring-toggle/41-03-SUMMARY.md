---
phase: 41-efx-paint-audio-preview-monitoring-toggle
plan: 03
subsystem: audio
tags: [audio, playback-sync, drift-correction, bridge-updates, revisioned-push, web-audio, tauri]

requires:
  - phase: 41-efx-paint-audio-preview-monitoring-toggle (plan 41-02)
    provides: tracer monitoring path — revisioned audioPreview launch section, child monitor state machine (idle|positioned|playing) with playAtCursor/stop/positionedAt, applyRevisionedEfxPaintAudioPreview funnel, 31-test suite
  - phase: 41-efx-paint-audio-preview-monitoring-toggle (plan 41-01)
    provides: locked truth table (sections 4/5/6/8) and locked decisions a6-matched-fps + rev-counter
  - phase: 38.1-studio-render-path-performance
    provides: per-tick single-write signal discipline (peek-only reads in playback loops)
provides:
  - Full AUDIO-03 sync behavior in the child monitor — silent-scrub anchor repositioning (D-09), loop-wrap re-seek via notifyLoopWrap (D-11), free-run drift correction with 40ms threshold and 10-tick throttle (D-10), fps-mismatch status note with no playbackRate scaling (locked A6)
  - AUDIO-04 push-on-change channel — PHYSIC_PAINT_AUDIO_CONTEXT_EVENT + publishPhysicPaintAudioContext (emitTo window-label targeting + browser fallbacks), main-window signal effect over audioStore.tracks sharing the launch rev-counter for total ordering
  - Child-side handleEfxPaintAudioContextEvent funnel — validate + strict newer-than guard + mid-playback restart at the current Paint cursor (D-03); idempotent and out-of-order delivery test-pinned
  - useEfxPaintAudioContextBridge triple-transport listener (disposed guard + unlisten cleanup) wired into usePhysicsPaintLaunchIntegration
affects: [41-04, 41-05, audio, efx-paint]

actuals:
  tokens: 9458
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Monitor drift anchor: capture { appFrame, ctxTime } from the Web Audio clock at each seek-aligned start; the audioTime term cancels in |expected - actual|, so the anchor needs only frame + clock readings"
    - "Self-throttling tick hook: checkDrift is invoked every playback tick but compares only every 10th call — the tick keeps 38.1-D-01 single-write discipline with zero per-frame audio chatter"
    - "Main-only signal-effect publisher: gated installer (installPhysicPaintAudioContextPublisher) called from main.tsx, never at module scope — the child bundle imports the same module for constants and its audioStore singleton would be empty (AUDIO-01)"
    - "Handler funnel returning Promise<void> | null: null = dropped delivery (stale/invalid), promise = accepted application — gives tests exact application counts for idempotency and out-of-order cases"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/main.tsx
    - app/src/main.test.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
    - app/src/lib/physicPaintBridge.test.ts

key-decisions:
  - "Drift anchor stores only { appFrame, ctxTime } — the truth-table audioTime term cancels in the expected-vs-actual difference, so multi-track offset ambiguity never enters the corrector"
  - "checkDrift updates the monitor's live Paint cursor on every call (pre-throttle) so a mid-playback revisioned update restarts at the true current cursor, not the last seek-aligned anchor"
  - "Push publisher fires even with zero tracks (unlike the launch embed) — deleting the last track while EFX Paint is open must reach the child (AUDIO-04)"
  - "fps-mismatch note routes through the existing publishStatus gate (queued during playback, flushed once on stop) rather than bypassing the 38.1-D-02 capsule arbitration"
  - "Scrub-to-positionedAt wiring stays inside the monitor API: the child's Play always starts at the first cached frame, so no scrub seam outside useRotoCachedPlayback influences the audio start position"

patterns-established:
  - "TDD per task in this plan: RED test commit → GREEN feat commit, both gates visible in git log"
  - "Mocking the Web Audio clock in monitor tests: vi.hoisted fakeAudioContext with a mutable currentTime returned by the ensureContext mock — drift scenarios are pure arithmetic on that clock"

requirements-completed: [AUDIO-03, AUDIO-04]

coverage:
  - id: D1
    description: "Silent scrub (D-09): positionedAt repositions the monitor anchor with zero audio dispatch, playing or positioned; a subsequent Play starts at the anchor"
    requirement: AUDIO-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts#(a) scrub while playing repositions the anchor with zero audio dispatch"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loop wrap re-seeks audio (D-11): useRotoCachedPlayback showNextFrame wrap branch calls monitor.notifyLoopWrap → stopAll + play at the mapped loop start, range-end capped, source metadata untouched"
    requirement: AUDIO-03
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(b) notifyLoopWrap performs stopAll then play at the mapped loop-start offset (+ no-op when not playing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Free-run drift correction (D-10): throttled checkDrift compares every 10th tick and seek-restarts only beyond the 40ms named threshold — 30ms ignored, 50ms one restart, never per frame"
    requirement: AUDIO-03
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(c) 30ms ignored / 50ms one restart; (d) nine calls nothing, tenth compares"
        status: pass
    human_judgment: false
  - id: D4
    description: "FPS mismatch (locked A6): non-blocking status note once per playback session via the publishStatus gate; no playbackRate scaling ever reaches the engine"
    requirement: AUDIO-03
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(e) fps mismatch note once per session, no playbackRate"
        status: pass
    human_judgment: false
  - id: D5
    description: "Push-on-change publisher (D-01/D-02): signal effect over audioStore.tracks publishes the full rebuilt section on every change with strictly increasing revisions (shared launch/push counter); emitTo targets efx-physic-paint, no bare emit"
    requirement: AUDIO-04
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#(1) publishes a revisioned audio context push on every tracks change with strictly increasing revisions"
        status: pass
    human_judgment: false
  - id: D6
    description: "Revisioned application edges (AUDIO-04): double-delivery applies exactly once; out-of-order 3/2/4 ends at 4 with exactly two applications; stale event while playing causes zero audio dispatch"
    requirement: AUDIO-04
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#push-on-change revisioned updates — tests (2), (3), (5)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Mid-playback update restart (D-03): a newer context while playing performs stopAll then play at the CURRENT Paint cursor with the new context; idle/positioned updates only the stored context + anchor"
    requirement: AUDIO-04
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(4) mid-playback restart at current cursor; idle/positioned anchor reposition test"
        status: pass
    human_judgment: false
  - id: D8
    description: "Audible sync quality of scrub/loop/drift behavior and live push updates in the running app (loop tightness, drift audibility, mid-playback restart perception)"
    requirement: AUDIO-03
    verification: []
    human_judgment: true
    rationale: "Audio sync quality is inherently a native-UAT judgment (phase convention); deferred to the 41-05 packaged-app UAT checkpoint per the plan's verification section"

duration: 18min
completed: 2026-08-04
status: complete
---

# Phase 41 Plan 03: Playback Sync + Revisioned Push Channel Summary

**Complete AUDIO-03 sync behavior (silent scrub, loop-wrap re-seek, 40ms-threshold drift corrector, matched-fps note) and the AUDIO-04 push-on-change channel — a main-window signal effect republishes the revisioned audio section on every tracks change, and the child applies newer-only through a single funnel that restarts mid-playback at the current Paint cursor**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-04T21:24:14Z
- **Completed:** 2026-08-04T21:42:33Z
- **Tasks:** 2
- **Files modified:** 9 (0 created)

## Accomplishments
- Monitor sync behaviors (Task 1): drift anchor model `{ appFrame, ctxTime }` captured at every seek-aligned start; `notifyLoopWrap(loopStart, rangeEnd)` performs stopAll + restart at the mapped loop start (D-11), wired to the `showNextFrame` wrap branch; `checkDrift` self-throttles to one comparison per 10 ticks and seek-restarts only past `EFX_PAINT_AUDIO_DRIFT_THRESHOLD_SEC = 0.04` (D-10); `noteFpsMismatchOnce` publishes the A6 note once per playback session through the existing publishStatus gate with no playbackRate scaling; scrub stays zero-dispatch (D-09)
- Push channel (Task 2): `PHYSIC_PAINT_AUDIO_CONTEXT_EVENT = 'physic-paint:audio-context'`, `publishPhysicPaintAudioContext()` (emitTo window-label targeting + CustomEvent + opener.postMessage fallbacks, verbatim `publishPhysicPaintProjectContext` shape), and `installPhysicPaintAudioContextPublisher()` — a Preact `effect()` over `audioStore.tracks` installed from `main.tsx` only, sharing the launch rev-counter so ordering is total across channels
- Child funnel: `handleEfxPaintAudioContextEvent` (validate → strict newer-than guard → monitor) returning `Promise<void> | null` so idempotency/out-of-order application counts are exactly test-pinned; `applyRevisionedContext` restarts mid-playback at the live cursor tracked per tick; `useEfxPaintAudioContextBridge` triple-transport listener with disposed guard wired into `usePhysicsPaintLaunchIntegration`
- Gates: touched test files 38 + 35 green; full app suite 1063 passed / 1 skipped (exit 0); `tsc --noEmit` clean

## Task Commits

Each task was committed atomically (TDD: RED → GREEN per task):

1. **Task 1 RED: failing monitor sync tests** - `070fd84c` (test)
2. **Task 1 GREEN: monitor scrub/loop/drift sync behaviors** - `d4016ff7` (feat)
3. **Task 2 RED: failing push-channel tests** - `3a28a92d` (test)
4. **Task 2 GREEN: revisioned push channel with mid-playback restart** - `1ae8e84c` (feat)
5. **Rule 1 fix: emitTo in main.test.ts Tauri mock** - `4b2069ea` (fix)

## Files Created/Modified
- `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts` — anchor model, notifyLoopWrap, checkDrift (throttled, 40ms named constant), noteFpsMismatchOnce, live-cursor tracking, applyRevisionedContext, handleEfxPaintAudioContextEvent funnel
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` — wrap-branch notifyLoopWrap, per-tick checkDrift, fps-note routing through publishStatus; no new useEffect (signal/ref wiring only)
- `app/src/lib/physicPaintBridge.ts` — PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, publishPhysicPaintAudioContext, installPhysicPaintAudioContextPublisher (signal effect over audioStore.tracks)
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — useEfxPaintAudioContextBridge listener (Tauri listen + CustomEvent + origin-checked postMessage, disposed guard, unlisten cleanup)
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` — wires useEfxPaintAudioContextBridge(handleEfxPaintAudioContextEvent) next to the project-context bridge
- `app/src/main.tsx` — installs the audio-context publisher in the main-window startup branch only
- `app/src/main.test.ts` — emitTo added to the strict Tauri event mock (deviation 3)
- `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` — 13 new tests (7 sync + 6 push-channel); vi.hoisted fakeAudioContext clock
- `app/src/lib/physicPaintBridge.test.ts` — event-name test + publisher effect test with makeAudioTrack fixture

## Decisions Made
- The drift anchor stores only `{ appFrame, ctxTime }`: the truth-table `audioTime` term cancels in `|expected - actual|`, so per-track offset ambiguity never enters the corrector
- `checkDrift` updates the monitor's live cursor on every call (before the throttle gate) so D-03 mid-playback restarts target the true current cursor
- The push publisher fires even with zero tracks (deleting the last track must reach the child), unlike the launch embed which omits an empty section to keep audio-less launches byte-stable
- The fps-mismatch note is queued through the publishStatus gate during playback (flushed once on stop) rather than bypassing 38.1-D-02 capsule arbitration — per the plan's explicit routing instruction
- `handleEfxPaintAudioContextEvent` lives in the monitor module (audio cohesion; no import cycle) and returns null/promise so tests assert exact application counts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed the push publisher from main.tsx (not in the task file list)**
- **Found during:** Task 2 (GREEN wiring)
- **Issue:** The plan action directs registering the tracks-change effect "from the same module/init path that installs the other bridge listeners" — that path is `main.tsx`, absent from the task's `<files>` list. Module-scope registration in physicPaintBridge.ts was rejected: the child bundle imports that module for event constants, and its `audioStore` singleton is an empty independent instance (AUDIO-01 authority boundary)
- **Fix:** Exported `installPhysicPaintAudioContextPublisher()` (gated installer) and called it from the main-window startup branch of `main.tsx`, next to the sibling bridge installs
- **Files modified:** `app/src/main.tsx`, `app/src/lib/physicPaintBridge.ts`
- **Committed in:** `1ae8e84c`

**2. [Rule 3 - Blocking] Wired the child listener in usePhysicsPaintLaunchIntegration.ts (not in the task file list)**
- **Found during:** Task 2 (GREEN wiring)
- **Issue:** `useEfxPaintAudioContextBridge(handleSection)` needs a consume site in the child studio; none was listed. The 41-02 precedent (deviation 1 there) wired the same sibling seam for launch hydration
- **Fix:** Consumed the hook with `handleEfxPaintAudioContextEvent` directly below `usePhysicsPaintLaunchBridge`, mirroring the project-context bridge wiring
- **Files modified:** `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`
- **Committed in:** `1ae8e84c`

**3. [Rule 1 - Bug] Added emitTo to the main.test.ts Tauri event mock**
- **Found during:** Post-Task-2 full-suite run
- **Issue:** The new publisher's install effect publishes once at startup; `main.test.ts` models the native runtime (`__TAURI_INTERNALS__`) but its strict `vi.mock('@tauri-apps/api/event')` lacked `emitTo`, so the property access threw an unhandled rejection and the full suite exited 1 despite all tests passing
- **Fix:** Added `emitTo: vi.fn(() => Promise.resolve())` to the mock — the bridge legitimately uses emitTo at startup now
- **Files modified:** `app/src/main.test.ts`
- **Verification:** Full suite exit 0 (1063 passed / 1 skipped)
- **Committed in:** `4b2069ea`

**4. [Plan interpretation] Scrub wiring kept inside the monitor API**
- **Found during:** Task 1 (wiring step)
- **Issue:** The plan action mentions calling `monitor.positionedAt` "on cursor/scrub changes", but no scrub seam exists in `useRotoCachedPlayback` (the plan's only wiring file) and the child's Play always starts at the first cached frame — scrub position never influences the audio start, so external positionedAt wiring would be dead code
- **Fix:** positionedAt remains the zero-dispatch scrub API (test-pinned, including while-playing); cursor tracking flows through playAtCursor/checkDrift/notifyLoopWrap, which is every path that can change what the user hears
- **Files modified:** none beyond plan scope
- **Committed in:** `d4016ff7`

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug, 1 plan interpretation)
**Impact on plan:** All auto-fixes necessary for correctness or end-to-end wiring. No scope creep; both deviations 1-2 mirror the 41-02 precedent for the same seams.

## Authentication Gates

None.

## Known Stubs

None. All new code is wired end-to-end (publisher installed at startup, listener consumed in the launch integration, monitor funnel called by the playback hook). Deliberately out-of-scope behaviors owned by later plans (not stubs): the On/Off toggle UI (41-04), the first-player-wins ownership guard (41-04), and the CSP `connect-src` grant with packaged-build proof (41-05).

## Threat Flags

None — the new push event surface is covered by the plan's threat register (T-41-07/T-41-08/T-41-09 mitigations implemented: strict newer-than funnel, origin check + closed-key validation, emitTo window-label targeting, no debounce).

## TDD Gate Compliance

Both tasks carried `tdd="true"` and followed RED → GREEN with visible gate commits (`070fd84c` test before `d4016ff7` feat; `3a28a92d` test before `1ae8e84c` feat). RED runs failed for the expected reason in every new test (missing APIs); no test passed unexpectedly during RED.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 41-04 (toggle + ownership): the monitor's idempotent playAtCursor/stop funnel, `noteFpsMismatchOnce` status route, and the live push channel are the control surface; the toggle gates the existing unconditional audio block in `useRotoCachedPlayback.start()`; ownership events can follow the publisher/listener pair shape established here
- 41-05 (CSP proof + UAT): run the packaged-build failure proof for `efxasset:` in `connect-src` BEFORE the grant (locked d04-proof-packaged-build); native UAT judges loop tightness, drift audibility, mid-playback restart perception, and live-update behavior (coverage D8)
- Native audible confirmation of all sync behavior remains deferred to the 41-05 packaged-app UAT checkpoint

## Self-Check: PASSED

- FOUND: commit 070fd84c (Task 1 RED)
- FOUND: commit d4016ff7 (Task 1 GREEN)
- FOUND: commit 3a28a92d (Task 2 RED)
- FOUND: commit 1ae8e84c (Task 2 GREEN)
- FOUND: commit 4b2069ea (Rule 1 fix)
- VERIFIED: `PHYSIC_PAINT_AUDIO_CONTEXT_EVENT = 'physic-paint:audio-context'` exported from app/src/lib/physicPaintBridge.ts; `EFX_PAINT_AUDIO_DRIFT_THRESHOLD_SEC = 0.04` named constant in efxPaintAudioMonitor.ts; `useEfxPaintAudioContextBridge` exported from usePhysicsPaintParentBridge.ts
- VERIFIED: full suite exit 0 (1063 passed / 1 skipped / 101 todo); `tsc --noEmit` exit 0

---
*Phase: 41-efx-paint-audio-preview-monitoring-toggle*
*Completed: 2026-08-04*
