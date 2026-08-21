---
phase: 41-efx-paint-audio-preview-monitoring-toggle
plan: 04
subsystem: audio
tags: [audio, ownership-guard, toggle-ui, first-player-wins, cross-window, web-audio, tauri, preact-signals]

requires:
  - phase: 41-efx-paint-audio-preview-monitoring-toggle (plan 41-03)
    provides: monitor control funnel (idempotent playAtCursor/stop, live-cursor tracking), publishPhysicPaintAudioContext publish shape, useEfxPaintAudioContextBridge listener idiom, publishStatus gate
  - phase: 41-efx-paint-audio-preview-monitoring-toggle (plan 41-01)
    provides: locked decisions D-05..D-07 (first-player-wins, suppressed note, auto-resume), D-12..D-14 (toggle placement/default/effect), A5 (ownership events stay off the revision counter)
provides:
  - First-player-wins doubled-audio guard (D-05..D-07, AUDIO-06): PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT broadcast from playbackEngine start/stop, PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT claim/release, efxPaintAudioOwnership session module (canStartAudio/noteMainPlaybackState/claimAudio/releaseAudio), main-side claim gate in startAudioPlayback, suppressed note + auto-resume at the live cursor
  - Session-local Audio Preview toggle (D-12..D-14, AUDIO-05): audioPreviewEnabled signal(true) + idempotent setAudioPreviewEnabled, monitor setPreviewEnabled funnel with toggleSilenced lifecycle, speaker button with styled tooltip in the playback pill — including both AUDIO-05 edge rows (idempotency, concurrency) test-pinned
affects: [41-05, audio, efx-paint]

actuals:
  tokens: 18337
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "First-player-wins arbitration: both windows check ownership before starting audio — child gate in the monitor play funnel (canStartAudio = claimHeld || !otherWindowPlaying), symmetric main gate inside startAudioPlayback so start/seek/loop-wrap restarts are all covered by one check"
    - "Ownership events are transient session signals on lightweight events (locked A5), never revisioned context; claim is idempotent, release-for-non-held-claim is a no-op, stale claims reset on every fresh child launch"
    - "Injectable session wiring for leaf modules: ownership/toggle effects travel through configure() slots (statusPublisher, claimSender, resumeHandler, toggleEffect) so child-only modules keep the AUDIO-01 authority boundary (no audioStore/timelineStore/playbackEngine imports) and tests drive exact dispatch counts"
    - "Single-funnel race serialization: the revisioned-update restart decision is taken AFTER prepare resolves, so a toggle racing an update always ends silent (Off) or positioned at the current cursor (On)"

key-files:
  created:
    - app/src/components/physic-paint/audio/efxPaintAudioOwnership.ts
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/playbackEngine.ts
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
    - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/main.tsx
    - app/src/main.test.ts
    - app/src/lib/playbackEngine.test.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts

key-decisions:
  - "Suppression implies visually-playing by construction: the suppressed flag is set only by a blocked Play and cleared only by the monitor stop funnel (which every visual stop traverses) — so D-07 needs no separate visual-state query"
  - "noteVisualStop clears suppression WITHOUT publishing — the 38.1-D-02 stop funnel owns the status line; a null publish there would wipe the flushed stop message"
  - "A main stop while suppressed-but-muted still clears the note (the 'Audio playing in main editor' status would be stale) while the resume itself dispatches nothing through the toggle gate"
  - "The toggle gate marks toggleSilenced on any muted Play attempt, so a Play started while muted resumes on toggle-On at the live cursor; the visual-stop funnel clears the flag so a post-stop toggle-On stays silent"
  - "The revisioned-update restart decision moved after the prepare await — the funnel's final word reflects acceptance-time state (AUDIO-05 concurrency edge)"

patterns-established:
  - "TDD per task in this plan: RED test commit → GREEN feat commit, both gates visible in git log"
  - "Main-side ownership listener records a claim signal read synchronously by playbackEngine; the listener's Tauri branch falls back to DOM transports on failure instead of rejecting (established child-side idiom applied main-side)"

requirements-completed: [AUDIO-05, AUDIO-06]

coverage:
  - id: D1
    description: "First-player-wins guard (D-05): main playing blocks the child audio start with zero engine dispatch and publishes the suppressed note exactly once; a claim-holding child is never suppressed by a later main start"
    requirement: AUDIO-06
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(a) main playing blocks the child audio start and publishes the suppressed note; the child keeps monitoring when the main editor starts later"
        status: pass
    human_judgment: false
  - id: D2
    description: "Suppressed note (D-06): 'Audio playing in main editor' appears exactly once in source (EFX_PAINT_AUDIO_SUPPRESSED_NOTE) and routes through the publishStatus funnel"
    requirement: AUDIO-06
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(a) published sequence assertion + source grep (single occurrence in efxPaintAudioOwnership.ts)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Auto-resume (D-07): main stop while child suppressed resumes at the CURRENT Paint cursor, clears the note, and claims ownership; toggle Off blocks the resume and still clears the stale note"
    requirement: AUDIO-06
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(b) main stop auto-resumes at the current Paint cursor and clears the note; (e) toggle Off blocks the D-07 auto-resume"
        status: pass
    human_judgment: false
  - id: D4
    description: "Claim lifecycle (D-05): claim on audio start, idempotent release on stop/pagehide, release-for-non-held no-op, main-side claim gate suppresses startAudioPlayback, fresh launch clears stale claims"
    requirement: AUDIO-06
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#(c) claim/release round-trip + monitor.stop() release; playbackEngine.test.ts#(d) held claim suppresses main startAudioPlayback; physicPaintBridge.test.ts#ownership listener gate + launch reset"
        status: pass
    human_judgment: false
  - id: D5
    description: "Session toggle (D-13/D-14): signal(true) default-On per session with no persistence; Off mid-playback stops audio exactly once while visual playback continues; On resumes at the live cursor without a visual restart"
    requirement: AUDIO-05
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#toggle tests (a), (b), (e) + muted-start and visual-stop no-resume pins"
        status: pass
    human_judgment: false
  - id: D6
    description: "AUDIO-05 edge rows: same-value set performs zero engine calls (idempotency); a toggle racing a revisioned update serializes through the single funnel — Off ends silent, On ends positioned at the current cursor (concurrency)"
    requirement: AUDIO-05
    verification:
      - kind: unit
        ref: "efxPaintAudioPreview.test.ts#toggle tests (c) idempotency and (d) race serialization"
        status: pass
    human_judgment: false
  - id: D7
    description: "Toggle button UI (D-12): speaker icon (Volume2/VolumeX size 15) in the playback pill beside the loop toggle with aria-pressed, dynamic aria-label, and the useStyledTooltip mount (region bottom); props wired through the strip to PhysicsPaintStudio"
    requirement: AUDIO-05
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (exit 0) + code review against the loop-toggle pattern; no .tsx component test harness exists in this suite (vitest include is src/**/*.test.ts)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Native doubled-audio behavior and toggle audibility in the running app (both windows playing, suppression note visibility, auto-resume timing, mid-playback mute/resume feel)"
    requirement: AUDIO-06
    verification: []
    human_judgment: true
    rationale: "Doubled-audio arbitration and toggle feel are inherently native-UAT judgments (phase convention); deferred to the 41-05 packaged-app UAT checkpoint per the plan's verification section"

duration: 32min
completed: 2026-08-04
status: complete
---

# Phase 41 Plan 04: Ownership Guard + Audio Preview Toggle Summary

**First-player-wins doubled-audio arbitration between the main editor and the EFX Paint window — playback-state broadcasts, claim/release events, a suppressed-status note with auto-resume at the live cursor — plus a session-local speaker toggle that silences/resumes monitoring immediately mid-playback and persists nothing**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-08-04T22:01:42Z
- **Completed:** 2026-08-04T22:33:51Z
- **Tasks:** 2
- **Files modified:** 14 (1 created)

## Accomplishments
- Ownership guard (Task 1): `PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT = 'physic-paint:audio-playback-state'` broadcast from the only two main-side funnel points (`playbackEngine.start()/stop()`); child gate at the monitor play funnel (`canStartAudio = claimHeld || !otherWindowPlaying`) publishes the D-06 note through the injectable publishStatus slot and dispatches zero engine calls when suppressed; symmetric main gate inside `startAudioPlayback()` (one check covers start, seek restarts, and tick loop-wrap restarts); claim/release ride `PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT = 'physic-paint:audio-ownership'` via `sendPhysicPaintAudioOwnership` targeting `'main'`; D-07 auto-resume re-enters the monitor funnel at the live cursor and clears the note
- Toggle (Task 2): `audioPreviewEnabled = signal(true)` + idempotent `setAudioPreviewEnabled` in the session store (soloStore discipline — no persistence imports, verified by grep and test); monitor `setPreviewEnabled` funnel — Off stops audio immediately through the single stop funnel while visual playback continues, On resumes at the live cursor only when playback is running silent (`toggleSilenced` lifecycle); speaker button (Volume2/VolumeX, size 15) beside the loop toggle with `aria-pressed`, dynamic aria-label, and a `useStyledTooltip` anchor at `region="bottom"`
- Gates: touched test files green (57 audio tests, 7 playbackEngine tests incl. 5 todo, 39 bridge tests); full app suite 1083 passed / 1 skipped (exit 0, no unhandled errors); `tsc --noEmit` clean

## Task Commits

Each task was committed atomically (TDD: RED → GREEN per task):

1. **Task 1 RED: failing ownership-guard tests** - `a55b2870` (test)
2. **Task 1 GREEN: first-player-wins ownership guard with auto-resume** - `23f58f53` (feat)
3. **Task 2 RED: failing toggle tests** - `f7715e80` (test)
4. **Task 2 GREEN: session-local Audio Preview toggle with immediate mid-playback effect** - `363b3569` (feat)
5. **Rule 1 fix: importOriginal spread in playbackEngine frameMap mock** - `3bca3422` (fix)

## Files Created/Modified
- `app/src/components/physic-paint/audio/efxPaintAudioOwnership.ts` — NEW: session ownership module (otherWindowPlaying signal, claim/suppression state, canStartAudio/noteSuppressed/noteVisualStop/claimAudio/releaseAudio/noteMainPlaybackState, configure slots, installEfxPaintAudioPlaybackStateListener with pagehide release)
- `app/src/lib/physicPaintBridge.ts` — playback-state/ownership event constants, publishPhysicPaintAudioPlaybackState, main-side claim signal + isPhysicPaintChildAudioClaimed + installPhysicPaintAudioOwnershipListener (Tauri branch falls back to DOM transports), stale-claim reset on launch
- `app/src/lib/playbackEngine.ts` — start/stop broadcast; startAudioPlayback claim gate
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` — sendPhysicPaintAudioOwnership dual-transport sender targeting 'main'
- `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts` — toggle + ownership gates at the play funnel, claim on dispatch, release/suppression-clear in the stop funnel, toggleSilenced lifecycle, setPreviewEnabled funnel, post-prepare restart decision, resumeEfxPaintAudioAtLiveCursor, module-scope effect registrations
- `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts` — audioPreviewEnabled signal(true), idempotent setAudioPreviewEnabled, configureAudioPreviewToggleEffect channel
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — speaker toggle button + tooltip in the playback pill; audioPreviewEnabled/onAudioPreviewToggle props threaded through
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — claimSender wiring (live bridgeModeRef) and handleAudioPreviewToggle + workflow-bundle props
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` — installs the child playback-state listener next to the 41-03 audio-context bridge
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` — injects publishStatus as the ownership guard's status publisher
- `app/src/main.tsx` — installs the main-side ownership listener
- `app/src/main.test.ts` — startup flush now awaits the ownership listener registration (deadline-bounded)
- `app/src/lib/playbackEngine.test.ts` — main-side guard tests (d) + control with mocked bridge/audioEngine/frameMap
- `app/src/lib/physicPaintBridge.test.ts` — event-name, publish-shape, claim-listener, and launch-reset tests
- `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` — 19 new tests (6 ownership + 8 toggle + bridge coverage)

## Decisions Made
- `suppressed` implies visually-playing by construction — set only by a blocked Play, cleared only by the monitor stop funnel that every visual stop traverses — so D-07 needs no separate visual-state query and no useRotoCachedPlayback state export
- `noteVisualStop()` clears suppression WITHOUT publishing: the 38.1-D-02 stop funnel owns the status line, and a null publish there would wipe the flushed stop message (caught during design review, before it could regress the capsule)
- A main stop while suppressed-but-muted still clears the note (a lingering "Audio playing in main editor" would be stale) while the resume attempt dispatches nothing through the toggle gate
- The toggle gate marks `toggleSilenced` on ANY muted Play attempt — a Play started while muted resumes on toggle-On at the live cursor — and the visual-stop funnel clears the flag so a post-stop toggle-On stays silent
- The revisioned-update restart decision moved to AFTER the prepare await (deviation 5) so a racing toggle always gets the funnel's final word

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired the child playback-state listener in usePhysicsPaintLaunchIntegration.ts (not in the task file list)**
- **Found during:** Task 1 (GREEN wiring)
- **Issue:** `installEfxPaintAudioPlaybackStateListener()` needs a consume site in the child studio; none was listed. The 41-02/41-03 precedents wired the same sibling seam for launch hydration and the push channel
- **Fix:** `useEffect(() => installEfxPaintAudioPlaybackStateListener(), [])` directly below `useEfxPaintAudioContextBridge`
- **Files modified:** `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`
- **Committed in:** `23f58f53`

**2. [Rule 3 - Blocking] Injected the D-06 status publisher from useRotoCachedPlayback.ts (not in the task file list)**
- **Found during:** Task 1 (GREEN wiring)
- **Issue:** The plan mandates routing the suppressed note through "useRotoCachedPlayback's publishStatus", but that file was absent from the task's `<files>` list
- **Fix:** A small effect configures `statusPublisher: publishStatus` (stable useCallback, runs once, cleaned up on unmount)
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts`
- **Committed in:** `23f58f53`

**3. [Rule 3 - Blocking] Wired the ownership claimSender in PhysicsPaintStudio.tsx (not in the task file list)**
- **Found during:** Task 1 (GREEN wiring)
- **Issue:** `sendPhysicPaintAudioOwnership(claim, bridgeMode)` needs the live bridge mode, which only exists in the Studio (`bridgeModeRef`) — the ownership module deliberately stays transport-agnostic session state
- **Fix:** One effect configures the claimSender closure (fire-and-forget with a console.warn catch), cleaned up on unmount
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Committed in:** `23f58f53`

**4. [Rule 2 - Missing critical] Reset the main-side audio claim on every fresh child launch**
- **Found during:** Task 1 (design of the claim lifecycle)
- **Issue:** The plan's claim lifecycle covers release on stop/close (pagehide is best-effort); a child closed abruptly without its release landing would leave the main editor permanently self-suppressing its audio — a silent-mute defect
- **Fix:** `openPhysicPaintCanvas` clears the claim signal after launch validation; a fresh bundle always starts claim-free. Test-pinned in physicPaintBridge.test.ts
- **Files modified:** `app/src/lib/physicPaintBridge.ts`
- **Committed in:** `23f58f53`

**5. [Rule 1 - Bug] Restart decision in applyRevisionedContext moved after the prepare await**
- **Found during:** Task 2 (race test (d) design)
- **Issue:** Capturing `restartAtCursor` before the async prepare meant a toggle landing inside the await raced a stale decision — the update could restart audio after the user muted it
- **Fix:** The playing check now runs at acceptance time (after prepare), giving the single funnel the final word: Off always ends silent, On always ends positioned. Existing 41-03 tests (no toggle involved) behave identically
- **Files modified:** `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts`
- **Committed in:** `363b3569`

**6. [Rule 1 - Bug] main.test.ts startup flush extended to the ownership listener + listener Tauri branch made fallback-resilient**
- **Found during:** Task 1 (post-GREEN full-suite run)
- **Issue:** The ownership install is the LAST awaited install in the main.tsx startup chain; its dynamic `import('@tauri-apps/api/event')` could resolve after beforeAll's flush stopped waiting, escaping the file's mocked module context and rejecting against the real Tauri module (`transformCallback is not a function`) — an unhandled rejection failing the full-suite gate despite all tests passing
- **Fix:** (a) the flush now waits (deadline-bounded, 2000ms) until the `physic-paint:audio-ownership` listener registers; (b) the listener's Tauri branch falls back to the DOM transports on failure instead of rejecting — the established child-side `.catch(() => undefined)` idiom applied main-side
- **Files modified:** `app/src/main.test.ts`, `app/src/lib/physicPaintBridge.ts`
- **Verification:** Full suite exit 0 twice consecutively (1083 passed / 1 skipped, zero unhandled errors); the previously failing main+viteBuild combination is clean
- **Committed in:** `363b3569`

**7. [Rule 1 - Bug] importOriginal spread in the playbackEngine.test.ts frameMap mock**
- **Found during:** Task 1 (first GREEN run)
- **Issue:** The bare replacement frameMap mock omitted `fxTrackLayouts`, which timelineStore reads at module evaluation — the test file failed at collection
- **Fix:** Spread the real module and override only `totalFrames`/`frameMap`/`trackLayouts`
- **Files modified:** `app/src/lib/playbackEngine.test.ts`
- **Committed in:** `3bca3422` (the edit missed the Task 1 GREEN staging set; committed as its own fix)

**8. [Plan interpretation] The `audioPreviewEnabled` signal and the monitor's toggle gate landed in Task 1 GREEN**
- **Found during:** Task 1 (RED authoring)
- **Issue:** Task 1's own test (e) — "toggle Off blocks auto-resume (D-07 condition)" — requires the toggle signal, but the plan allocates efxPaintAudioPreviewStore.ts to Task 2
- **Fix:** Task 1 adds the minimal `signal(true)` and the monitor's gate check (Task 1 test (e) drives the raw signal); Task 2 adds the setter, effect channel, silenced lifecycle, and UI as planned
- **Files modified:** `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts`, `efxPaintAudioMonitor.ts`
- **Committed in:** `23f58f53`

---

**Total deviations:** 8 auto-fixed (3 blocking wiring, 2 missing-critical/bug correctness, 2 test-harness bugs, 1 plan interpretation)
**Impact on plan:** All auto-fixes necessary for correctness or end-to-end wiring; the three wiring deviations mirror the 41-02/41-03 precedent for the same seams. No scope creep; the toggle never touches main-editor audio state (AUDIO-05 prohibition holds — the only main-side changes are the broadcast and the self-suppression gate).

## Authentication Gates

None.

## Known Stubs

None. All new code is wired end-to-end (publisher in playbackEngine, listener installed at startup, child listener consumed in the launch integration, claimSender/statusPublisher/resumeHandler/toggleEffect all connected, toggle button wired through the strip to the Studio). Deliberately out-of-scope behaviors owned by 41-05 (not stubs): the CSP `connect-src` grant with packaged-build proof (locked d04-proof-packaged-build) and the native doubled-audio/toggle UAT (coverage D8).

## Threat Flags

None — the new event surface is covered by the plan's threat register and the mitigations are implemented: emitTo window-label targeting both directions + origin-checked postMessage fallbacks (T-41-10), two funnel-only emission points with O(1) idempotent signal transitions (T-41-11), and the toggle store's no-persistence source contract plus the no-storage-writes test (T-41-12).

## TDD Gate Compliance

Both tasks carried `tdd="true"` and followed RED → GREEN with visible gate commits (`a55b2870` test before `23f58f53` feat; `f7715e80` test before `363b3569` feat). Every RED run failed for the expected reason (missing APIs: `setAudioPreviewEnabled is not a function`, `installPhysicPaintAudioOwnershipListener is not a function`, unsatisfied dispatch/broadcast assertions); no test passed unexpectedly during RED.

## Issues Encountered

The floating-startup-chain unhandled rejection (deviation 6) required reproducing with a minimal file combination (main + viteBuild) to isolate — the initial 5-iteration flush bound was marginally too small under full-suite parallel load and was replaced with a deadline-bounded wait plus the resilient listener fallback.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 41-05 (CSP proof + UAT): run the packaged-build failure proof for `efxasset:` in `connect-src` BEFORE the grant (locked d04-proof-packaged-build); native UAT judges doubled-audio arbitration (both windows Play in both orders), the suppressed note's visibility, auto-resume timing, and mid-playback toggle feel (coverage D8)
- The toggle is session-only by construction — opening a fresh EFX Paint window resets it On; nothing to migrate or persist
- All automated gates green: full suite 1083 passed / 1 skipped (exit 0), `tsc --noEmit` exit 0

## Self-Check: PASSED

- FOUND: commit a55b2870 (Task 1 RED)
- FOUND: commit 23f58f53 (Task 1 GREEN)
- FOUND: commit f7715e80 (Task 2 RED)
- FOUND: commit 363b3569 (Task 2 GREEN)
- FOUND: commit 3bca3422 (Rule 1 fix)
- VERIFIED: `PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT = 'physic-paint:audio-playback-state'` and `PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT = 'physic-paint:audio-ownership'` exported from app/src/lib/physicPaintBridge.ts; `'Audio playing in main editor'` appears exactly once in non-test source (efxPaintAudioOwnership.ts:25); efxPaintAudioOwnership.ts imports no audioStore/timelineStore/playbackEngine
- VERIFIED: full suite exit 0 (1083 passed / 1 skipped / 101 todo, zero unhandled errors, two consecutive runs); `tsc --noEmit` exit 0

---
*Phase: 41-efx-paint-audio-preview-monitoring-toggle*
*Completed: 2026-08-04*
