---
phase: 55-efx-paint-host-engine-1-host-split
plan: 10
subsystem: audio
tags: [playback, audible-scrub, document-sound, gap-closure, tdd, paint-audio]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split
    provides: "55-01..55-09 host-split plans (HOST-01..DATA-03 covered); 52.5-02 MAIN-MIX document-clip play leg"
provides:
  - "App-timeline scrub snippet dispatches paint document-sound clips (GAP-55-01 / UAT row A2 wiring)"
  - "collectEnabledDocumentClips(At) shared enumerator — play and scrub clip legs single-sourced"
affects: [audio, playback, paint-audio, phase-55-close]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 4507
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared clip enumerator (collectEnabledDocumentClips/At) so play and scrub audio legs cannot drift"

key-files:
  created:
    - .planning/phases/55-efx-paint-host-engine-1-host-split/55-10-red-evidence.json
  modified:
    - app/src/lib/playbackEngine.ts
    - app/src/lib/playbackEngine.test.ts

key-decisions:
  - "Extract collectEnabledDocumentClips + collectEnabledDocumentClipsAt as the single membership/gate/frame-math source for both startAudioPlayback's immediate arm and startAudioSnippet — the plan's drift-prevention requirement"
  - "Keep the future-clip playDelayed arm of startAudioPlayback unchanged (play leg only) — a snippet is what sounds AT the dragged frame, never a future-clip schedule (plan prohibition)"
  - "Update (s1) source-contract to track collectEnabledDocumentClipsAt (the extracted helper) instead of collectDocumentSoundClips directly in startAudioPlayback's body — the planned extraction moved the token"

patterns-established:
  - "Document-sound clip membership/gate/effective-end resolution is single-sourced in PlaybackEngine.collectEnabledDocumentClips; any new consumer (scrub, export, preview) must ride that helper"

requirements-completed: [A2]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "App-timeline scrub snippet dispatches paint document-sound clips (4-frame capped, D-12/D-13 gated, mixed with main-track snippets)"
    requirement: "A2"
    verification:
      - kind: unit
        ref: "app/src/lib/playbackEngine.test.ts#playbackEngine paint-clip audible scrub (GAP-55-01)"
        status: pass
      - kind: unit
        ref: "app/src/lib/playbackEngine.test.ts#(s4) startAudioSnippet carries the document-clip collection seam (GAP-55-01)"
        status: pass
      - kind: unit
        ref: "app/src/lib/playbackEngine.test.ts#playbackEngine document clip dispatch (52.5-02, MAIN-MIX-01/02)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts (Studio reference path non-regression)"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live UAT row A2 audible judgment on the running app: paint snippet audible while dragging the MAIN EDITOR timeline playhead, silent on release, play-from-cursor still works"
    requirement: "A2"
    verification: []
    human_judgment: true
    rationale: "Audio audibility and scrub feel are human-judgment rows (D-05 / feedback_no_done_before_uat) — a passing vitest proves the dispatch wiring, not that a human hears the snippet. GAP-55-01 stays open until the user records PASS."

# Metrics
duration: 15min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 10: GAP-55-01 audible-scrub paint-clip wiring Summary

**Paint document-sound clips now ride the app-timeline scrub snippet (4-frame capped, D-12/D-13 gated) via a shared clip enumerator with the play leg; live A2 audible judgment pending**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-15T10:45:53Z
- **Completed:** 2026-10-15T11:01:37Z
- **Tasks:** 2
- **Files modified:** 2 (plus 1 planning artifact)

## Accomplishments
- `startAudioSnippet` dispatches paint document-sound clips at the dragged frame, capped to `TIMELINE_SCRUB_AUDIO_SNIPPET_FRAMES` (4), gated by `mainPlaybackClipEnabled` (D-12 enabled switch + D-13 composite gate)
- Shared enumerator `collectEnabledDocumentClips` / `collectEnabledDocumentClipsAt` single-sources membership, gate, effective-end clamp, and frame math for the play leg's immediate arm AND the scrub snippet — the two arms cannot drift
- Clip-only A2 repro pinned: empty `audioStore.tracks`, one enabled document-sound clip, scrubToFrame inside the clip window → exactly one `audioEngine.play(sound.id, ...)`
- D-12/D-13 gate cases (enabled=false, solo ON, hidden fx sequence) each produce zero paint-clip dispatches during scrub
- No `playDelayed` from the snippet (a snippet is what sounds AT the dragged frame, never a future-clip schedule)
- Claim-guard (41-04 D-05) and `scrubAudioEnd` un-throttle law extended to cover the paint-clip leg
- Studio ruler scrub path (`usePhysicsPaintRulerScrub` / `useRotoCachedPlayback` / `efxPaintAudioMonitor`) proven unchanged — 164 PhysicsPaintStudio tests green with zero Studio source edits

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): paint-clip scrub snippet family** - `bd8166f4` (test) — 9-case family, RED_EVIDENCE_OK / target_test_failed on (p1)
2. **Task 1 (GREEN): shared enumerator + clip leg** - `70fdbdb4` (feat) — `collectEnabledDocumentClips(At)` + `startAudioSnippet` clip dispatch
3. **Task 2: source-contract pin (s4)** - `e84f1af2` (test) — `startAudioSnippet` body carries `collectEnabledDocumentClipsAt`

_Note: TDD task produced test → feat commits per the RED→GREEN contract._

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `app/src/lib/playbackEngine.ts` - Added `collectEnabledDocumentClips` + `collectEnabledDocumentClipsAt` private helpers; `startAudioSnippet` gains the paint-clip leg; `startAudioPlayback`'s immediate arm points at the helper (future-clip `playDelayed` arm unchanged)
- `app/src/lib/playbackEngine.test.ts` - New `playbackEngine paint-clip audible scrub (GAP-55-01)` describe (p1–p9); (s1) updated to track the extracted helper; new (s4) source-contract for the snippet seam
- `.planning/phases/55-efx-paint-host-engine-1-host-split/55-10-red-evidence.json` - TDD RED evidence record (RED_EVIDENCE_OK)

## TDD Gate Compliance

- **RED:** `bd8166f4` `test(55-10)` landed before `feat(55-10)` `70fdbdb4` — gate sequence satisfied
- **RED evidence:** `RED_EVIDENCE_OK` / `target_test_failed` on target test "(p1) a clip-only project dispatches exactly one paint snippet at the dragged frame (A2 repro)" — failed with `expected '' to be 'sound-clip-1'` (zero `audioEngine.play` calls because `startAudioSnippet` iterated only `audioStore.tracks`). Record at `.planning/phases/55-efx-paint-host-engine-1-host-split/55-10-red-evidence.json`
- **Semantic assessment:** Target (p1) and siblings (p2, p2b, p6, p9) failed on the planned missing-clip-leg assertion. Gate negatives (p3, p4, p5) and (p7, p8) passed as green-at-birth controls (nothing dispatched yet / already satisfied). 44 tests collected, 5 failed / 39 passed; not zero-tests; no fixture/load failure
- **GREEN:** all 45 tests pass (`playbackEngine.test.ts` 37 passed + 7 todo; PhysicsPaintStudio.test.ts 164 passed)
- **REFACTOR:** none — implementation is minimal and the extraction IS the plan's design

## Decisions Made
- **Shared enumerator over a second copy:** the plan forbids a second copy of membership/gate/frame math that can drift. Extracted `collectEnabledDocumentClips` (membership + gate + effective-end) and `collectEnabledDocumentClipsAt` (window filter + sourceOffset/remaining resolution). `startAudioPlayback`'s immediate arm and `startAudioSnippet` both call `collectEnabledDocumentClipsAt`; the future-clip `playDelayed` arm keeps its scheduling shape but rides `collectEnabledDocumentClips` for membership.
- **(s1) source-contract retargeted:** the planned extraction moved `collectDocumentSoundClips` from `startAudioPlayback`'s body into the helper. (s1) now asserts `collectEnabledDocumentClipsAt` appears in the play arm's body (the real identifier), preserving the pin's intent. File-level `collectDocumentSoundClips` assertion retained.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] (s1) source-contract broke when the planned extraction moved the collection token**
- **Found during:** Task 1 (GREEN verification)
- **Issue:** (s1) asserted `collectDocumentSoundClips` appears in `startAudioPlayback`'s body slice. The plan-mandated extraction of the shared helper moved that call into `collectEnabledDocumentClips`, so the token is no longer in the sliced body. Behavior tests (c1–c9) stayed green — only the source-scan pin broke.
- **Fix:** Retargeted (s1) to assert `collectEnabledDocumentClipsAt` (the real helper identifier) appears in `startAudioPlayback`'s body, matching the plan's "name the asserted token after the real identifier from Task 1" instruction. File-level `collectDocumentSoundClips` assertion retained so the membership source stays pinned.
- **Files modified:** `app/src/lib/playbackEngine.test.ts`
- **Verification:** `playbackEngine.test.ts` 45 tests green; full suite 5053 passed
- **Committed in:** `70fdbdb4` (part of Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — source-contract token drift from the planned extraction)
**Impact on plan:** None on behavior. The play leg's observable dispatch is unchanged (c1–c9 all green before and after). No scope creep.

## Issues Encountered
- TDD RED classifier first rejected the TAP capture (`Non-TAP data in report` / `Malformed TAP`): multi-line `toEqual` / `toHaveBeenCalledWith` diffs polluted the YAML diagnostics. Fixed by restructuring (p1)/(p2)/(p2b)/(p6) to single-line `toBe` assertions (same lesson as 53.1-02). `RED_EVIDENCE_OK` on rerun.

## Authentication Gates
None.

## Live UAT Status (GAP-55-01)

**A2 is UNJUDGED — GAP-55-01 stays open.**

The automated pins prove the dispatch wiring, not audibility (D-05 / feedback_no_done_before_uat). The user must re-judge row A2 on the running app:

1. Open a project whose physic-paint layer carries a document sound clip (the same surface that was silent)
2. Drag the **MAIN EDITOR** timeline playhead across the clip's window — expect a short paint-audio burst while dragging (re-arming roughly every 120ms)
3. Release — expect silence until the next drag
4. Play-from-cursor over the same window — expect the clip audible from the cursor (the previously-passing half must not regress)
5. Surface judged is the main-editor timeline, NOT the paint Studio

**Required observations:** (a) paint snippet audible WHILE dragging; (b) release stops it; (c) play-from-cursor still works; (d) main-editor surface.

Record PASS/FAIL with the user's words. **FAIL keeps GAP-55-01 open and Phase 55 un-closed.** A green vitest does NOT close the gap.

## Known Stubs
None — the clip leg is fully wired to `collectDocumentSoundClips` + `mainPlaybackClipEnabled` + `audioEngine.play`.

## Threat Flags
None — T-55-14 accepted (reuses existing `toDocumentSoundAudioTrack` carrier and `audioEngine` dispatch; no new path, IO, or IPC surface). T-55-SC not triggered (no package-manager install).

## Next Phase Readiness
- Wiring is automated-ready. GAP-55-01 closes only when the human records A2 PASS.
- Phase 55 close remains blocked on A2 (and any other open UAT rows in 55-UAT.md).

## Self-Check: PASSED

- FOUND: `app/src/lib/playbackEngine.ts`
- FOUND: `app/src/lib/playbackEngine.test.ts`
- FOUND: `.planning/phases/55-efx-paint-host-engine-1-host-split/55-10-SUMMARY.md`
- FOUND: `.planning/phases/55-efx-paint-host-engine-1-host-split/55-10-red-evidence.json`
- FOUND: commit `bd8166f4` (test RED)
- FOUND: commit `70fdbdb4` (feat GREEN)
- FOUND: commit `e84f1af2` (test source-contract)
- FOUND: commit `eccbc027` (docs SUMMARY)
- Pre-existing uncommitted work (`physicPaintBridge.ts`, `unknownPhysicLayerCapture.ts`) untouched (0-line diff vs plan base)
- Studio reference files untouched (zero diffs in `usePhysicsPaintRulerScrub.ts` / `useRotoCachedPlayback.ts` / `efxPaintAudioMonitor.ts`)

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*
