---
phase: quick-261022-ljt
plan: 261022-ljt
subsystem: physic-paint-roto
tags: [preact-signals, aquarelle, bake, progress, play-script, efx-watercolor]
requires:
  - phase: 56-08
    provides: aquarelle Play Script consume branch and AquarelleBakeOptions.onCommit seam
provides:
  - Watercolor Play Script per-commit progress on the shared progress/status signals
  - Generation/dispose-guarded late-commit suppression and count clamping
affects: [physic-paint-play-script, efx-watercolor-bake]

actuals:
  tokens: 2505      # chars/4 over the realized diff (10021 chars)
  tasks: 2
  commits: 2
  plan_head_before: 22b5dd47b030a6764c6b48a34e5b6e7eee1704b5
  plan_head_after: c0163344ca5a161ab0099607834628ff070e1ebe

tech-stack:
  added: []
  patterns:
    - "Consume an existing per-commit seam instead of adding a parallel progress mechanism"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts

key-decisions:
  - "Reuse AquarelleBakeOptions.onCommit and write the SAME progress/status signals engine-1's onProgress writes — parity, not a second mechanism."
  - "Use a monotonic committedFrames counter clamped to count (engine-1 frameIndex+1 semantics), not frame.eventIndex + 1."
  - "Guard late commits with disposed || generation !== acceptedGeneration because AQUA-07 flush-survives-navigation keeps committing after Cancel/close."

requirements-completed: [LJT-01, LJT-02]

coverage:
  - id: D1
    description: "Watercolor Play Script bake advances the dialog footer bar and 'Rendering k / N' status once per committed frame, reaching N/N before completion."
    requirement: LJT-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts#aquarelle bake reports per-frame progress on the shared progress signal"
        status: pass
    human_judgment: true
    rationale: "The dialog DOM lives in the Physic Paint WKWebView; unit tests prove the signals, only the live Studio UAT proves the rendered bar."
  - id: D2
    description: "Late bake commits after Cancel or dispose never move the progress bar, and completed never exceeds total."
    requirement: LJT-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts#a late aquarelle commit after cancel does not move progress"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts#a late aquarelle commit after dispose does not move progress"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts#committed frames clamp at the requested count"
        status: pass
    human_judgment: true
    rationale: "Cancel/dispose UAT in the live Studio is a listed verification row; automation cannot observe the WKWebView dialog."
  - id: D3
    description: "Engine-1 (brush) Play path and the efx-watercolor bake package are unchanged."
    requirement: LJT-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts#the engine-1 path is unchanged (renderRotoPlayScriptFrames, no createAquarelleBake)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts (150 tests)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-10-22
status: complete
---

# Quick 261022-ljt: Watercolor Play Script progress Summary

**Aquarelle Play Script bakes now drive the existing `progress`/`status` signals from the bake's per-commit seam, so the dialog bar advances 0/N → N/N exactly like brush mode, with late commits ignored after Cancel or dispose.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-22T13:35:07Z
- **Completed:** 2026-10-22T13:37:21Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- The aquarelle bake branch now passes `onCommit` to `createAquarelleBake`; each committed frame updates `progress.value` and `status.value = 'Rendering k / N'` — the exact signals and string engine-1 uses, so the dialog needs no change.
- Late commits are synchronously ignored when `disposed` or when `generation !== acceptedGeneration` (required because AQUA-07 flush survives navigation), and `completed` is clamped with `Math.min(count, ...)`.
- Regression pins added for mid-bake advancement, post-cancel suppression, post-dispose suppression, and clamping; every pre-existing case in both controller suites stays green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Watercolor Play progress — bake commits drive the shared progress signal** — `b7fbc64f` (feat)
2. **Task 2: Late commits never move the bar — cancel, dispose, and clamp guards** — `c0163344` (test)

Plan metadata commit is handled by the orchestrator (docs artifacts intentionally not committed by the executor).

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `onCommit` wired into the aquarelle bake options, guarded and clamped, with the parity/never-throw comment.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` — one RED→GREEN progress case plus three guard cases.

## Decisions Made

- Reused the existing `AquarelleBakeOptions.onCommit` seam rather than adding a new progress mechanism, signal, or UI surface.
- Used a monotonic counter clamped to `count` rather than `frame.eventIndex + 1` (eventIndex is an event index on the non-progressive path).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- The full app suite is not 100% green: 5 failures in 4 suites unrelated to this plan (see Deferred Issues). None of those suites import the Play Script controller; they are pre-existing.
- Typecheck baseline and post-change both report exactly 16 pre-existing `error TS` lines, none mentioning `physicsPaintRotoPlayScriptController`.

## Deferred Issues

Out of scope (Rule 1 scope boundary — untouched, pre-existing):

- `src/lib/exportEngine.test.ts` — "solo narrows the scan to the soloed visible track (a visible-not-soloed track cannot block)".
- `src/lib/paperPass.frameGuard.test.ts` — "P4(f) both flattened getters delegate to the ONE _resolveFlattenedFrame seam".
- `src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` — matrix rows 8 and 9 (soloed track drawing).
- `src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` — "renders a pinned header column with a label cell for every row including the active lane".

## Verification

- Targeted bake suite: 9/9 passed.
- Both controller suites: 159/159 passed.
- Full app suite: 5368 passed, 5 failed (the pre-existing list above), 1 skipped, 96 todo.
- Typecheck: 16 errors before and after; no touched-file errors.
- Source gates: `onCommit:` present in the controller; the dialog still reads `playScript.progress.value`; `packages/efx-watercolor` untouched.

## User Setup Required

None.

## Next Phase Readiness

Automated-ready. Live UAT rows (user, in the Physic Paint Studio) still pending and are the verdict:

1. Watercolor mode, multi-frame Play Script: footer bar fills 0/N → N/N and status reads `Rendering k / N` while the bake runs.
2. Brush (paint) mode Play Script: progress behavior unchanged.
3. Cancel a watercolor bake mid-render: the dialog cancels and the bar does not jump or advance afterwards.

## Self-Check: PASSED
