---
phase: 41-efx-paint-audio-preview-monitoring-toggle
plan: 05
subsystem: audio
tags: [audio, web-audio, csp, tauri, lifecycle, uat]

# Dependency graph
requires:
  - phase: 41-efx-paint-audio-preview-monitoring-toggle (plans 41-01..41-04)
    provides: locked frame→audio truth table, revisioned launch/push audio context, monitor sync behaviors, ownership guard, session-local toggle
provides:
  - monitor.release() — stopAll + AudioContext close + reference discard, idempotent, wired into BOTH the onCloseRequested close funnel (outside the hasPending gate) and the Studio unmount cleanup (D-08, AUDIO-06)
  - Read-only engineHasContext() probe on the audioEngine singleton (app/src/lib/audioEngine.ts) — no change to play/playDelayed/stopAll/fade logic
  - Single-token efxasset: grant in connect-src (tauri.conf.json), proven necessary by the literal D-04 packaged-build refusal observation AND the RED-first contract test, pinned by the 'Tauri CSP connect-src efxasset contract' block
  - User-approved native packaged-app UAT (8 steps) — the phase's sync-quality oracle
affects: [phase-44 integrated release acceptance (REL-01/REL-02 audio steps), future CSP changes (releaseContract guard)]

# Actuals (#2632) — chars/4 over the realized diff (23445 chars), same scale as the plan's estimate.
actuals:
  tokens: 5861
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent lifecycle release: state-check guard absorbs double-fire from close-requested + unmount paths; a closed AudioContext is discarded, never resurrected (D-08)"
    - "D-04 CSP grant discipline: literal packaged-build proof of the refusal BEFORE the grant, RED contract test, single narrow token, permanent contract-test guard (v0.8.1 img-src precedent extended to connect-src)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
    - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/lib/audioEngine.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
    - app/src-tauri/tauri.conf.json
    - app/src/releaseContract.test.ts

key-decisions:
  - "release() is idempotent via context-state check — double-fire from the close funnel and unmount cleanup performs one stopAll and at most one ctx.close(); after release, ensureContext creates a fresh context (D-08)"
  - "audioEngine.ts diff limited to a read-only context probe accessor per plan acceptance criteria — no behavior change to play/playDelayed/stopAll/fade"
  - "D-04 proof satisfied by the literal reading (d04-proof-packaged-build, locked at the 41-01 checkpoint): the user observed the verbatim connect-src refusal in the pre-grant packaged build on 2026-08-05 before the grant landed"

patterns-established:
  - "Release must not depend on the flush's hasPending early-return — wired unconditionally inside the close-requested handler"
  - "CSP grants: prove necessity first (packaged observation + RED contract test), grant exactly one token, pin the token set in the same change; never add data:/blob: to connect-src"

requirements-completed: [AUDIO-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Engine release on EFX Paint close: release() stopAll + AudioContext close, idempotent, fires on both the close-requested funnel (outside the hasPending gate) and the Studio unmount path; re-open starts from a fresh context (D-08, AUDIO-06)"
    requirement: AUDIO-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts#release cases (a)-(d): stopAll then ctx.close; second release no-op; never-created context safe no-op; post-release playAtCursor creates fresh context"
        status: pass
    human_judgment: false
  - id: D2
    description: "Single-token efxasset: grant in connect-src, proven necessary (literal D-04 packaged-build refusal observed pre-grant), no data:/blob: in connect-src, img-src/media-src byte-identical, image contract tests unmodified"
    requirement: AUDIO-06
    verification:
      - kind: unit
        ref: "app/src/releaseContract.test.ts#Tauri CSP connect-src efxasset contract"
        status: pass
      - kind: manual_procedural
        ref: "Pre-grant packaged build console: 'Refused to connect to efxasset://localhost/... because it does not appear in the connect-src directive of the Content Security Policy.' (observed 2026-08-05, recorded in 41-FRAME-AUDIO-TRUTH-TABLE.md section 7)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Native packaged-app UAT: 8 steps — audio sync at cursor, scrub silence, loop re-seek without drift, live-edit restart, doubled-audio ownership with auto-resume, speaker toggle isolation, missing-file warn-and-skip, close release with clean reopen"
    requirement: AUDIO-06
    verification:
      - kind: manual_procedural
        ref: "Packaged app /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app (built 2026-08-05 08:31 local); all 8 steps approved by user 2026-08-05"
        status: pass
    human_judgment: true
    rationale: "Audio sync quality, drift, and doubling are only honestly provable by a human listening in the packaged app (project convention; REL-02 audio steps) — user approved 2026-08-05"

# Metrics
duration: 1 day across blocking native UAT checkpoint (implementation 2026-08-04, packaged proof + UAT 2026-08-05)
completed: 2026-08-05
status: complete
---

# Phase 41 Plan 05: Engine Release on Close + CSP Grant + Native UAT Summary

**Release-safe audio monitor lifecycle on EFX Paint close (idempotent stopAll + AudioContext close on both close paths), a D-04-proven single-token connect-src efxasset grant pinned by contract test, and a user-approved 8-step native packaged-app UAT — AUDIO-06 closed and Phase 41 complete**

## Performance

- **Duration:** 1 day across the blocking native UAT checkpoint (implementation 2026-08-04; D-04 packaged proof, fresh bundle, and UAT 2026-08-05)
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `monitor.release()`: stopAll (covers scheduled playDelayed sources), then AudioContext close guarded by a state check, then reference discard — idempotent, and a closed context is never reused (D-08). Wired unconditionally into the `usePhysicsPaintCloseFlush` close-requested funnel (outside the `hasPending` early-return) and into the Studio unmount cleanup; double-fire is absorbed by idempotency. Tests (a)-(d) pin: stopAll→close ordering, second-release no-op, never-created-context safe no-op, fresh context after release.
- Read-only `engineHasContext()` probe added to the audioEngine singleton — the only engine diff; play/playDelayed/stopAll/fade logic untouched per the plan's acceptance criteria.
- D-04 proof satisfied by the **literal reading** (`d04-proof-packaged-build`, locked at the 41-01 checkpoint): the user ran the pre-grant packaged build on 2026-08-05 and the EFX Paint webview console showed the refusal verbatim:

  > "Refused to connect to efxasset://localhost/Users/lmarques/Desktop/efx-motion-editor-project-test/phase-36.14/audio/Drex3emRush-sansRouli.aif because it does not appear in the connect-src directive of the Content Security Policy."

  (Recorded in `41-FRAME-AUDIO-TRUTH-TABLE.md` section 7.) The RED contract test (`d4cac3f9`) then confirmed the new 'Tauri CSP connect-src efxasset contract' block failed against the unmodified config, and the single-token grant landed (`532e026e`): `connect-src` gains exactly `efxasset:`, no `data:`/`blob:`, `img-src`/`media-src` byte-identical, image contract tests unmodified and green. No Rust handler changes (RESEARCH Pitfall 8 held).
- **Native packaged-app UAT — PASSED (native, packaged, 2026-08-05, user approved).** Fresh bundle built 2026-08-05 08:31 local. All 8 steps: (1) audible frame-synced monitoring at the Paint cursor with main-editor muted track inaudible; (2) scrub silence + Play restarts at the new position; (3) loop wraps re-seek audio twice with no accumulating drift; (4) main-editor audio edit mid-playback restarts monitoring at the cursor; (5) doubled-audio ownership — no doubling, suppressed note shown, auto-resume after main stop; (6) speaker toggle Off/On with immediate effect and main-editor mute state untouched; (7) missing file warn-and-skip with remaining track playing and Paint editing unblocked; (8) close while playing stops audio immediately and reopen starts clean.
- Full gate green at closure: `pnpm --dir app exec vitest run` — 97 files passed, 1091 tests passed (1 skipped, 101 todo), exit 0; `pnpm --dir app typecheck` exit 0.

## Task Commits

1. **Task 1: Engine release on close (TDD)** — `090ee3dc` (test: failing release tests) + `2f4d5c93` (feat: release audio engine on EFX Paint close)
2. **Task 2: CSP connect-src efxasset grant (TDD)** — `d4cac3f9` (test: failing contract test) + `532e026e` (feat: grant efxasset in connect-src)
3. **Task 3: Native packaged-app UAT (checkpoint:human-verify, gate=blocking)** — APPROVED BY USER 2026-08-05 (no code commit)

**Plan docs:** `015ea87f` (D-04 packaged proof satisfied + research A1 confirmed), `a3cd611a` (STATE.md checkpoint wait state)

## Files Created/Modified

- `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts` — new idempotent `release()` (stopAll + guarded ctx.close + reference discard)
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — release wired unconditionally into the close-requested handler, outside the `hasPending` gate
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — release wired into the Studio unmount cleanup path
- `app/src/lib/audioEngine.ts` — read-only `engineHasContext()` probe (only engine diff)
- `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` — release tests (a)-(d)
- `app/src-tauri/tauri.conf.json` — `connect-src` gains exactly one token: `efxasset:`
- `app/src/releaseContract.test.ts` — 'Tauri CSP connect-src efxasset contract' block (token-set pin + data:/blob: exclusion guard)

## Decisions Made

- release() idempotency via context-state check (absorbs close-funnel + unmount double-fire); closed contexts are discarded, never resurrected (D-08).
- Engine diff kept to a read-only context probe — the plan's smallest-possible-engine-diff constraint held.
- D-04 proof executed per the literal packaged-build reading locked at the 41-01 checkpoint; the refusal quote is preserved verbatim in the truth table as the permanent record.

## Deviations from Plan

**1. [Rule 3 - Blocking] Task 2 committed as RED+GREEN pair instead of one combined commit**
- **Found during:** Task 2 (CSP grant)
- **Issue:** The plan's acceptance criteria asked for a single commit containing both the tauri.conf.json change and the test extension (v0.8.1 precedent), while the plan's action also mandated RED-first TDD discipline (confirm the block fails before the grant).
- **Fix:** Followed TDD discipline: RED contract test committed alone (`d4cac3f9`, observed failing against the unmodified config), then the grant committed (`532e026e`). The RED-then-GREEN history makes the proof-of-necessity auditable in git; the contract guard and config remain inseparable in the pair.
- **Files modified:** app/src/releaseContract.test.ts, app/src-tauri/tauri.conf.json
- **Verification:** RED observed failing pre-grant; full releaseContract suite green post-grant, including the unmodified image contract block
- **Committed in:** `d4cac3f9`, `532e026e`

---

**Total deviations:** 1 auto-fixed (1 blocking/procedural)
**Impact on plan:** None on scope or security posture — the grant is the same single token, the guard is the same contract test, and the D-04 literal packaged proof adds evidence beyond the plan's minimum.

## Issues Encountered

None blocking. Out-of-scope observation (not fixed, candidate backlog item): the pre-grant packaged-build console also showed a **pre-existing, unrelated `style-src` stylesheet refusal at physics-paint:24** — visible in the packaged EFX Paint webview, independent of this phase's audio work. Recorded in the truth table section 7 annotation; recommend a follow-up quick task to investigate whether it affects packaged styling.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 41 complete (5/5 plans).** AUDIO-01..AUDIO-06 all closed: AUDIO-01/02/06 partial in 41-02, AUDIO-02/03/04 in 41-01, AUDIO-03/04 in 41-03, AUDIO-05/06 in 41-04, AUDIO-06 finalized here with the native UAT oracle passed.
- Requirements status cross-check: REQUIREMENTS.md already shows AUDIO-01..AUDIO-06 checked and Complete in the traceability table — confirmed accurate after this plan.
- Phase 44 (Integrated Release Acceptance) inherits: the REL-02 audio UAT steps now have a proven packaged-app pass, the connect-src grant is pinned against CSP creep, and close-release is test-pinned.
- Follow-up candidates: the pre-existing `style-src` refusal at physics-paint:24 (above); no other open items.

---
*Phase: 41-efx-paint-audio-preview-monitoring-toggle*
*Completed: 2026-08-05*
