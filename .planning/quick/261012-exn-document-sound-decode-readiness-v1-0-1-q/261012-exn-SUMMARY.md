---
phase: quick-261012-exn
plan: 261012-exn
subsystem: audio
tags: [audio, web-audio, decode, playback, export, preact-signals, tdd, fail-closed]

requires:
  - phase: quick-261010-ht0
    provides: shared fadeCurves law and the setValueCurveAtTime export/preview contract this quick's mixer validation wraps
provides:
  - engine-level `pendingDecodes` registry inside `audioEngine.decode()` — play/playDelayed await an in-flight decode (reopen race closed) or record a named refusal, ONE seam inherited by playbackEngine and the Studio monitor with zero call-site changes
  - visible `audioDecodeErrors` Preact signal (idempotent setter, cleared by `audioStore.reset()`) rendered as a red strip in TimelinePanel, mirroring imageStore.importErrors
  - surfaced decode catches: projectStore reopen, documentSoundPeaks, and ImportedView audio import all reach a rendered strip — console is never the only trace
  - exportEngine pre-check computing the FULL missing-buffer set (partial AND zero) and throwing names through the existing exportStore error status
  - audioExportMixer pre-scan validating every non-muted buffer BEFORE `new OfflineAudioContext` — the in-loop silent `continue` is gone
affects: [release-v1.0.1, snd-01, snd-02, export, playback]

actuals:
  tokens: 10073
  tasks: 3
  commits: 3
  plan_head_before: 743edfbab9f7d8c86e03217b6c2b1c451625b67e
  plan_head_after: f19399e6a8f30fdd771c9cbf9bf590950c082a7a

tech-stack:
  added: []
  patterns:
    - "pending-decode registry: decode() stores its chained promise (compare-before-delete in finally); every consumer that needs a buffer awaits the SAME promise"
    - "async never-reject play/playDelayed: whole-body try/catch routes every failure into a named refusal signal; `buffers.get(id) ?? (await resolveBufferForPlay(...))` keeps the buffer-present path synchronous (scrub law preserved)"
    - "two independent fail-closed doors on one law: exportEngine pre-check (exportStore error status) + mixer pre-scan (throw before any Web Audio object) — either alone leaves a bypass"

key-files:
  created: []
  modified:
    - app/src/lib/audioEngine.ts
    - app/src/lib/audioEngine.test.ts
    - app/src/lib/audioExportMixer.ts
    - app/src/lib/audioExportMixer.test.ts
    - app/src/lib/exportEngine.ts
    - app/src/lib/exportEngine.test.ts
    - app/src/lib/documentSoundPeaks.ts
    - app/src/lib/documentSoundPeaks.test.ts
    - app/src/stores/audioStore.ts
    - app/src/stores/projectStore.ts
    - app/src/components/views/ImportedView.tsx
    - app/src/components/layout/TimelinePanel.tsx

key-decisions:
  - "The reopen race is fixed ONLY inside audioEngine (pendingDecodes), never at call sites — playbackEngine.ts and efxPaintAudioMonitor.ts stay byte-untouched, so both realms inherit identical behavior"
  - "play/playDelayed never reject on any path (whole-body catch) — the 9 fire-and-forget call sites stay safe with zero churn; leg (b2) pins `resolves.toBeUndefined()`"
  - "Buffer-present fast path uses `??` short-circuit so the happy path never yields a microtask before source.start (seek-restart/scrub sequencing unchanged)"
  - "playDelayed anchors `ctx.currentTime` BEFORE awaiting the decode, so a slow decode cannot push the scheduled start past the caller's intent"
  - "Two independent SND-02 doors rather than one: the pre-check can be skipped (empty/late mixEntries) and the mixer can be called directly — both must fail closed by name"
  - "New visible error state is a module-level `signal<string[]>` in audioEngine mirroring imageStore.importErrors — no useState, no new notification system, deduped setter, cleared on project close"

patterns-established:
  - "Named-refusal-on-play pattern: any future playback precondition failure composes through `refusalMessage(track, reason)` into audioDecodeErrors instead of returning silently"

requirements-completed: []

coverage:
  - id: D1
    description: "play() and playDelayed() await an in-flight decode and start once it resolves, or record a visible refusal naming the track — silent early-return is gone, one engine fix covers both clip families and both realms"
    requirement: SND-01
    verification:
      - kind: unit
        ref: "app/src/lib/audioEngine.test.ts — 261012-exn decode readiness legs (a) refusal, (b) await-then-start-once, (b2) never-reject + named refusal"
        status: pass
      - kind: unit
        ref: "app/src/lib/audioEngine.test.ts — audioDecodeError dedupe pin + audioStore.reset() clears pin"
        status: pass
    human_judgment: true
    rationale: "UAT rows 1-2 (reopen race audible start, broken-source visible strip) are live judgments in the packaged app — vitest cannot observe the timeline strip rendering or real decode timing"
  - id: D2
    description: "Decode failures reach a rendered strip, never console-only: projectStore reopen catch and documentSoundPeaks catch append to audioDecodeErrors (TimelinePanel strip); ImportedView audio catch appends to imageStore.importErrors (existing strip)"
    requirement: SND-01
    verification:
      - kind: unit
        ref: "app/src/lib/documentSoundPeaks.test.ts — fail-closed legs with surfaced catch wired to addAudioDecodeError mock"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.test.ts + app/src/lib/playbackEngine.test.ts — pre-existing suites green with zero assertion edits"
        status: pass
    human_judgment: true
    rationale: "The visible strip itself (red bar in TimelinePanel/ImportedView naming the clip) is judged live in UAT row 2"
  - id: D3
    description: "Export pre-check computes the FULL missing-buffer set (partial AND zero) and aborts through the existing exportStore error status with an errorMessage naming every missing non-muted clip; muted entries never trigger a diagnostic"
    requirement: SND-02
    verification:
      - kind: unit
        ref: "app/src/lib/exportEngine.test.ts — 261012-exn export buffer diagnostic legs: partial outage, complete outage, muted exemption (renderMixedAudio never reached)"
        status: pass
    human_judgment: true
    rationale: "UAT row 3 (export with one bad clip stops with a message naming it) must be judged on a real export in the packaged app"
  - id: D4
    description: "renderMixedAudio validates every non-muted buffer BEFORE constructing OfflineAudioContext and throws naming all missing clips — a clip can never be silently omitted from a rendered mix"
    requirement: SND-02
    verification:
      - kind: unit
        ref: "app/src/lib/audioExportMixer.test.ts — 261012-exn mixer buffer pre-scan leg (`/Broken Vocals\\.wav/` rejection reaches the assertion only when the scan precedes the constructor)"
        status: pass
      - kind: unit
        ref: "app/src/lib/audioExportMixer.test.ts — source-scan describe byte-untouched (fadeCurves law pins green)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-12
status: complete
---

# Phase quick-261012-exn: Document-Sound Decode Readiness Summary

**Playback now awaits an in-flight decode or refuses with a named visible error (SND-01), and both export surfaces abort by clip name instead of silently dropping it (SND-02) — one engine-level pendingDecodes seam, zero call-site churn, 7 new RED-first regression legs.**

## Performance

- **Duration:** 13 min (2026-10-12T09:53:52Z → 10:06:50Z)
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `audioEngine.decode()` registers its chained promise in a `pendingDecodes` map (compare-before-delete in `finally`), and both `play()`/`playDelayed()` await it through one shared `resolveBufferForPlay` helper — pressing play during the projectStore reopen re-decode now starts when the decode lands instead of skipping in silence, with zero changes at the 9 call sites (`playbackEngine.ts`, `efxPaintAudioMonitor.ts` byte-untouched).
- `play`/`playDelayed` are async and never reject: whole-body try/catch routes every failure into `audioDecodeErrors`, a new idempotent Preact signal rendered as a red strip in TimelinePanel (mirrors imageStore.importErrors markup); `audioStore.reset()` clears it on project close; the buffer-present fast path stays synchronous via `??` short-circuit so scrub/seek sequencing is unchanged.
- The three console-only decode catches now surface: projectStore reopen and documentSoundPeaks append named messages to the signal; ImportedView appends to the existing `imageStore.importErrors` strip — zero new UI.
- SND-02 has two independent fail-closed doors: exportEngine's pre-check computes the FULL missing set (partial AND zero) and throws names into the existing exportStore error status; audioExportMixer pre-scans BEFORE `new OfflineAudioContext` and throws naming every missing clip, so the in-loop `continue` drop is gone and the scheduling/fade/WAV code below is byte-unchanged.
- Full TDD cycle held: Task 1 RED (7 new legs failed under their own names, 13 pre-existing green, typecheck clean), Tasks 2-3 turned exactly those legs green with ZERO Task-1 assertion edits.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — decode readiness regressions for SND-01/SND-02** - `0fae48bb` (test)
2. **Task 2: GREEN playback — pendingDecodes, never-reject play, visible refusal signal, surfaced catches** - `b1f7fcba` (feat)
3. **Task 3: GREEN export — named pre-check diagnostic + fail-closed mixer pre-scan** - `f19399e6` (feat)

**Plan head before:** `743edfba` · **Plan head after:** `f19399e6` · **Commits measured:** 3 (`git rev-list --count 743edfba..HEAD`)

## Files Created/Modified

- `app/src/lib/audioEngine.ts` — `audioDecodeErrors` signal + `addAudioDecodeError`/`clearAudioDecodeErrors`; `pendingDecodes` registry in `decode()`; `resolveBufferForPlay`; async never-reject `play`/`playDelayed` with `refusalMessage`; playDelayed anchors `currentTime` before awaiting
- `app/src/lib/audioEngine.test.ts` — FakeAudioContext harness (vi.stubGlobal), `261012-exn decode readiness (SND-01)` describe: legs (a)/(b)/(b2) + dedupe pin + reset-clears pin
- `app/src/lib/audioExportMixer.ts` — pre-scan of all non-muted buffers before the OfflineAudioContext line; throws naming every missing clip; scheduling loop consumes `resolved` pairs
- `app/src/lib/audioExportMixer.test.ts` — `261012-exn mixer buffer pre-scan (SND-02)` describe (spy on `audioEngine.getBuffer`); source-scan describe untouched
- `app/src/lib/exportEngine.ts` — pre-check replaced with full missing-set computation, thrown through the existing catch into exportStore error status; zero-only `console.warn` path deleted
- `app/src/lib/exportEngine.test.ts` — hoisted `audioTracks`/`audioBuffers` + `261012-exn export buffer diagnostic (SND-02)` describe (partial / complete / muted-exemption)
- `app/src/stores/audioStore.ts` — `reset()` calls `clearAudioDecodeErrors()`
- `app/src/stores/projectStore.ts` — reopen catch appends a named message to the signal (IIFE shape unchanged)
- `app/src/lib/documentSoundPeaks.ts` — decode catch appends `sourcePath`-carrying message
- `app/src/lib/documentSoundPeaks.test.ts` — mock factory exposes `addAudioDecodeError` (see deviation)
- `app/src/components/views/ImportedView.tsx` — audio decode catch appends to `imageStore.importErrors`
- `app/src/components/layout/TimelinePanel.tsx` — conditional red strip rendering `audioDecodeErrors` (signal read in render body only, no useState)

## Decisions Made

- **One seam, zero forks:** the reopen race closes inside `decode()` itself, so no call site changes — the plan's guardrail "playbackEngine.ts and efxPaintAudioMonitor.ts byte-untouched" is the design, not an accident.
- **Never-reject contract** on `play`/`playDelayed` is what makes the existing fire-and-forget call sites safe; leg (b2) pins it.
- **Two SND-02 doors** (pre-check + mixer pre-scan) because each alone leaves a bypass path (pre-check skipped when `mixEntries` is empty/late; mixer callable directly).
- **No new notification machinery** — the one new signal mirrors the existing importErrors shape, strip markup is copied from ImportedView, and the export channel is the pre-existing `exportStore.progress.errorMessage`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] documentSoundPeaks.test.ts mock factory missing the new export**
- **Found during:** Task 2 verify
- **Issue:** After `documentSoundPeaks.ts` started calling the named export `addAudioDecodeError`, the test's `vi.mock('./audioEngine', ...)` factory did not expose it — the surfaced catch itself threw (`No "addAudioDecodeError" export is defined on the "./audioEngine" mock`) and one fail-closed leg rejected instead of resolving.
- **Fix:** Added `addAudioDecodeError: vi.fn()` to the existing factory with a one-line comment. Zero assertion edits (the plan's Task-1-assertion guardrail is about the three RED test files' assertions; this is mock maintenance in a pre-existing suite).
- **Files modified:** app/src/lib/documentSoundPeaks.test.ts
- **Verification:** the suite went green with no assertion changes; full suite green afterwards.
- **Committed in:** `b1f7fcba` (Task 2)

**2. [Rule 1 - RED evidence variant] Leg (b2) failed pre-fix with a TypeError instead of the assertion message**
- **Found during:** Task 1 RED run
- **Issue:** Pre-fix `play()` returns `void`, so `.resolves` on the promise threw `You must provide a Promise to expect() when using .resolves` before the never-reject assertion could evaluate.
- **Fix:** None needed — this is valid RED (the leg fails under its own test name against current code, and post-fix `play` returns a Promise so both the never-reject and named-refusal assertions execute). No assertion edited.
- **Committed in:** `0fae48bb` (Task 1)

---

**Total deviations:** 2 (1 blocking mock fix, 1 RED-evidence note)
**Impact on plan:** No assertion weakened, no scope change, no guardrail broken.

## Issues Encountered

- `gsd_run` not on PATH; used project-local `.claude/gsd-core/bin/gsd_run` per CLAUDE.md. No other issues.

## Verification Results

- **Task 1 RED gate:** 7 new legs failed under their own names (`audioEngine.test.ts`, `audioExportMixer.test.ts`, `exportEngine.test.ts`); 13 pre-existing cases in those files green; `tsc --noEmit` rc=0.
- **Task 2 verify:** `vitest run` on audioEngine/documentSoundPeaks/projectStore/playbackEngine/documentSoundMultiClip — green (after the Rule 3 mock fix); typecheck rc=0; `git diff --stat` shows NO playbackEngine.ts, NO efxPaintAudioMonitor.ts; `grep useState TimelinePanel` = none.
- **Task 3 verify:** vitest run on audioExportMixer + the four exportEngine suites — green; typecheck rc=0; `grep "if (!buffer) continue"` in mixer = no matches; zero-only `console.warn` audio path gone.
- **Full suite:** `vitest run` → **262 files passed | 2 skipped; 4858 tests passed | 1 skipped | 96 todo — 0 failed** (no new failures vs pre-quick baseline).
- **Guardrail audit** (`git diff 743edfba..HEAD --stat`): 12 files, all in plan scope (the 11 planned files + the Rule 3 mock file). No vitest.config.ts, no package.json, no new dependency, no Rust, no capabilities.

## Known Stubs

None — no hardcoded empties, placeholder text, or unwired data sources introduced.

## Status: UAT APPROVED (2026-10-12)

| # | Case | Pass condition | Result |
|---|------|----------------|--------|
| 1 | Reopen race | Open a project and press play IMMEDIATELY — audio starts when the decode lands, or a red strip in the timeline names the track; silence with no message fails the row | pass |
| 2 | Broken source | Import/reopen a project whose audio file is missing/corrupt — the named failure appears in the UI (import strip or timeline strip), not only in the console | pass |
| 3 | Export with one bad clip | Export with include-audio on while one clip is undecodable — the export stops with an error naming that clip; a video-with-missing-audio output fails the row | pass |
| 4 | Clean export + playback | A fully decoded project plays and exports exactly as before this quick (no new strips, no behavior drift) | pass |

User native UAT passed 4/4 2026-10-12 — SND-01/SND-02 marked Approved in .planning/REQUIREMENTS.md.

Row 2 evidence (user screenshot): `Failed to decode document sound ".../Drex3emRush-sansRouli.aiff": efxasset fetch failed (status 404)` — named failure visible in the UI strip.

### Known-Accepted Behavior (not a defect — do not reopen as a v1.0.1 quick)

- A document-sound clip whose source file is missing still plays from the in-memory decode cache while the session lives. `audioEngine.buffers` is never cleared by `audioStore.reset()` — buffers die only on track removal or app restart. So the same broken project plays during the session and is silent after a restart.
- The visible strip in this case is the decode/peaks path (`documentSoundPeaks.ts`), not a playback refusal (that would read `Audio "<name>" not played: ...`). Quick 3 added the visibility; the cache predates it and is not a regression.
- Accepted for the v1.0.1 PATCH. If ever revisited, it is a v1.1.0 item (proper media-offline state + cache invalidation policy), not a PATCH quick.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Quick 3 (261012-exn) CLOSED — native UAT approved 4/4 2026-10-12. Milestone standing: 8/10 requirements approved. Next: Release quick (REL-01/02), dispatched separately by the user after a fresh go.
- No blockers.

## Self-Check: PASSED

- FOUND: commit 0fae48bb (ancestor of HEAD)
- FOUND: commit b1f7fcba (ancestor of HEAD)
- FOUND: commit f19399e6 (ancestor of HEAD)
- FOUND: app/src/lib/audioEngine.ts (pendingDecodes + audioDecodeErrors)
- FOUND: app/src/lib/audioEngine.test.ts (SND-01 legs)
- FOUND: app/src/lib/audioExportMixer.ts (pre-scan before constructor)
- FOUND: app/src/lib/exportEngine.ts (named pre-check)
- FOUND: app/src/components/layout/TimelinePanel.tsx (audioDecodeErrors strip, 3 refs)
- GUARDRAIL: playbackEngine.ts and efxPaintAudioMonitor.ts absent from `git diff 743edfba..HEAD`

---
*Phase: quick-261012-exn*
*Completed: 2026-10-12*
