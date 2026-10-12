---
phase: quick-260902-cfa
plan: 260902-cfa
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
  - app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
autonomous: true
requirements: [AUD-01, AUD-02, AUD-03, AUD-04]
estimate:
  tokens: 28000
  raw_tokens: 28000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Seek-while-idle re-anchors the audio anchor silently via positionedAt with zero engine dispatch (D-09 silent scrub, D-02).
    - Seek-while-playing performs a full audio seek-restart at the new cursor via playAtCursor (stopAll + re-dispatch, truth table section 5, D-02).
    - Seeking while playing keeps visual playback running, re-anchored at the new frame (main-editor seek-restart parity).
    - The locked Phase 41 truth-table behaviors (frame identity, audible window, revision guard, fps-match, ownership, toggle, engine release) still pass their regression tests.
  artifacts:
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts (seek method + frameIndexRef)
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts (seek tests)
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx (seek path wiring)
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts (seek path contract test)
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts (seek regression tests)
  key_links:
    - navigateToSyncedPhysicalFrame → rotoCachedPlayback.seek(frame) → efxPaintAudioMonitor.playAtCursor (playing) / positionedAt (idle)
    - useRotoCachedPlayback.seek → efxPaintAudioMonitor.playAtCursor / positionedAt (single audio funnel)
---

<objective>
Wire the v1.0 ruler seek / cursor navigation path (260827-s52 `onSeek` → `onNavigateToSyncedFrame` → `navigateToSyncedPhysicalFrame`) into the Phase 41 audio monitor per locked decision D-02: seek-while-idle → `positionedAt(cursorAppFrame)` (silent re-anchor, no sound); seek-while-playing → full seek-restart (`playAtCursor` at the new cursor). Add regression tests covering the locked Phase 41 audio truth table.

Purpose: Close the two scouted gaps — `positionedAt` has zero production callers, and the seek path stops playback without re-anchoring audio. After this task, seeking while playing keeps the animation running from the new frame with audio re-synced (main-editor seek-restart parity), and seeking while idle silently re-positions the audio anchor ready for the next Play.

Output: A `seek(targetAppFrame)` method on `useRotoCachedPlayback` (re-anchor + full audio seek-restart when active; silent `positionedAt` when idle), the seek path wired in `navigateToSyncedPhysicalFrame`, and regression tests pinning the seek wiring against the locked truth table.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/51-read-only-audio-preview/51-CONTEXT.md
@.planning/milestones/v0.9.0-phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md
@.planning/quick/260827-s52-nle-ruler-seek-playhead-bar-physics-pain/260827-s52-SUMMARY.md

# Code anchors (read before editing)
@app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
@app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx (navigateToSyncedPhysicalFrame, ~line 2122)
@app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
@app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Add seek(targetAppFrame) to useRotoCachedPlayback — re-anchor + full audio seek-restart</name>
  <files>app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts, app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts</files>
  <behavior>
    - Test 1: seek while active re-anchors the frame index at the target appFrame (the next timer tick shows the frame AFTER the target) and dispatches efxPaintAudioMonitor.playAtCursor(targetAppFrame, rangeEnd) exactly once.
    - Test 2: seek while idle dispatches efxPaintAudioMonitor.positionedAt(targetAppFrame) with zero engine calls (no playAtCursor, no prepare).
    - Test 3: seek to an out-of-range appFrame (not in getFrames()) is a silent re-anchor — positionedAt only, no frame-index change, no playAtCursor.
    - Test 4: seek after stop() is a silent re-anchor — positionedAt only.
  </behavior>
  <action>
    Per D-02 (seek-while-idle → positionedAt; seek-while-playing → full seek-restart via playAtCursor) and truth table section 5 (any position discontinuity is a full seek-restart, never a nudge of playing sources). In useRotoCachedPlayback.ts: (1) move the playback frame index from the start()-local `let frameIndex` to a `frameIndexRef = useRef(0)`; reset `frameIndexRef.current = 0` at the top of start() and use the ref in showNextFrame (read, write playbackTick, increment) so the loop-wrap branch and the tick path are behavior-identical. (2) Add `seek(targetAppFrame: number)` to the returned RotoCachedPlayback interface and implementation: resolve `cachedFrames = inputRef.current.getFrames()`; find `targetIndex = cachedFrames.findIndex(entry => entry.appFrame === targetAppFrame)`. When `isActive && targetIndex >= 0`: set `frameIndexRef.current = targetIndex`, write `playbackTick.value = { frameIndex: targetIndex, appFrame, frame }`, call `inputRef.current.onFrame(targetIndex, appFrame)`, then call `efxPaintAudioMonitor.playAtCursor(targetAppFrame, cachedFrames[cachedFrames.length - 1].appFrame + 1)` — the full seek-restart (stopAll + re-dispatch) at the new cursor, matching the start() audio range-end derivation. Otherwise (idle or out-of-range): call `efxPaintAudioMonitor.positionedAt(targetAppFrame)` — the D-09 silent re-anchor. The seek callback deps are `[isActive, playbackTick]`; it is invoked from the navigation handler, never from render (efx-preact-reactivity rule 6). Do NOT add a new monitor rule, new UI, or any audioStore/timelineStore/playbackEngine import (AUDIO-01 authority boundary). Do NOT change start()'s public signature.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts</automated>
  </verify>
  <done>seek() re-anchors the running playback at the target frame and dispatches playAtCursor at the new cursor when active; dispatches positionedAt silently when idle or out-of-range; the full useRotoCachedPlayback.test.ts suite passes.</done>
</task>

<task type="auto">
  <name>Task 2: Wire the seek path in navigateToSyncedPhysicalFrame — skip stop when playing, seek after navigation</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <action>
    Per D-02 (seek-while-idle → positionedAt; seek-while-playing → full seek-restart) and the main-editor seek-restart template (playbackEngine.ts: if playing, stopAll + restart at the new position — visual playback continues). In PhysicsPaintStudio.tsx `navigateToSyncedPhysicalFrame` (~line 2122): (1) replace the unconditional `rotoCachedPlayback.stop();` with `const wasPlaying = rotoCachedPlayback.isActive; if (!wasPlaying) { rotoCachedPlayback.stop(); }` — an idle seek keeps the current no-op stop (the monitor stop funnel is idempotent), a playing seek lets the playback timer keep running through the navigation. (2) After `await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);` add `rotoCachedPlayback.seek(frame);` — the seek method resolves both cases (active → re-anchor + playAtCursor full audio seek-restart; idle → positionedAt silent re-anchor). Do NOT add any other audio wiring in the Studio; the seek method is the single audio funnel. Do NOT change the save-before-leave flush, the generation guard, or the canvas repaint logic. Add a source-inspection contract test in PhysicsPaintStudio.test.ts (following the existing `onNavigateToSyncedFrame` contract-test convention at ~line 1074): assert the navigateToSyncedPhysicalFrame body contains `rotoCachedPlayback.seek(frame);` after the frame-sync call, contains `const wasPlaying = rotoCachedPlayback.isActive;`, and contains `if (!wasPlaying)` before `rotoCachedPlayback.stop();`.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>The seek path skips the playback stop when playing and calls rotoCachedPlayback.seek(frame) after navigation; the PhysicsPaintStudio.test.ts suite (including the new contract test) passes.</done>
</task>

<task type="auto">
  <name>Task 3: Regression tests pinning the seek wiring against the locked truth table + full suite</name>
  <files>app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts</files>
  <action>
    Add two regression tests to efxPaintAudioPreview.test.ts that pin the seek wiring semantics against the locked truth table (the existing suite already covers frame identity, audible window, revision guard, fps-match, ownership, toggle, and engine release — these must keep passing). (1) "seek-while-idle re-anchors silently (D-09/D-02): positionedAt repositions the anchor with zero engine dispatch" — prepare a section, call positionedAt(144), assert no play/playDelayed/ensureContext and isPlaying() false (mirrors the existing positionedAt test but framed as the seek-path entry). (2) "seek-while-playing is a full seek-restart (truth table section 5): playAtCursor at the new cursor performs stopAll then re-dispatch" — prepare, playAtCursor(96, 288), then playAtCursor(120, 288) and assert stopAll called exactly once BEFORE the second play dispatch, and the second play uses the new-cursor mapping (sourceOffset = (inFrame + slipOffset + (120 - offsetFrame)) / fps, maxPlaySec capped at effectiveEnd). Then run the full suite and the type check.
  </action>
  <verify>
    <automated>pnpm exec vitest run && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>The two seek regression tests pass; the full vitest suite (including all existing truth-table tests) is green; tsc --noEmit is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ruler seek → navigation | The ruler gesture (260827-s52) produces a cursor-only frame value that crosses into `navigateToSyncedPhysicalFrame`; it never carries selection or track-activation data (proven by the s52 region-scoped gates). |
| navigation → audio monitor | The seek path invokes `rotoCachedPlayback.seek(frame)`, which funnels into `efxPaintAudioMonitor.playAtCursor`/`positionedAt` — the single child-side audio funnel gated by the session toggle and the first-player-wins ownership guard. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-51-01 | Tampering | seek-while-playing audio restart | medium | mitigate | The seek method routes through the single audio funnel (`playAtCursor` = stopAll + re-dispatch); the monitor's idempotent state machine and the CR-01 audio-session guard prevent double-dispatch or orphaned audio after a stop during the navigation. |
| T-51-02 | Spoofing | seek target frame | low | mitigate | `seek` validates the target appFrame against the `getFrames()` enumeration; an out-of-range target falls back to silent `positionedAt` — never a wrong-frame dispatch. |
| T-51-03 | Denial of Service | seek-while-playing canvas conflict | low | accept | A brief playback-frame flicker during the navigation await is a UX artifact, not a correctness defect; the `seek` re-anchor settles the canvas at the target frame. |
| T-51-SC | Tampering | npm/pip/cargo installs | high | accept | No package installs in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
- `pnpm exec vitest run app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts` — seek method tests (Task 1).
- `pnpm exec vitest run app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — seek path contract test (Task 2).
- `pnpm exec vitest run` — full suite green, including the existing truth-table regression tests in efxPaintAudioPreview.test.ts (Task 3).
- `pnpm exec tsc --noEmit` — clean (Task 3).
</verification>

<success_criteria>
- Seek-while-idle re-anchors the audio anchor silently via positionedAt (D-09/D-02) — zero engine dispatch.
- Seek-while-playing performs a full audio seek-restart at the new cursor via playAtCursor (truth table section 5) — stopAll then re-dispatch, visual playback continues from the new frame.
- The seek path (ruler seek → onNavigateToSyncedFrame → navigateToSyncedPhysicalFrame → rotoCachedPlayback.seek) is wired end-to-end.
- The locked Phase 41 truth-table behaviors (frame identity, audible window, revision guard, fps-match, ownership, toggle, engine release) still pass their regression tests.
- No new monitor rule, no new UI, no audioStore/timelineStore/playbackEngine import in the child (AUDIO-01).
</success_criteria>

<output>
Create `.planning/quick/260902-cfa-wire-the-ruler-seek-to-the-audio-monitor/260902-cfa-SUMMARY.md` when done
</output>
