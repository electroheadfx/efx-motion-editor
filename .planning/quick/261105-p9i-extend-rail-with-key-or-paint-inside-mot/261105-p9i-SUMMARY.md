---
phase: 261105-p9i-extend-rail-with-key-or-paint-inside-mot
plan: 01
subsystem: physic-paint-roto
tags: [roto, rails, loop-clips, key-rail, physical-edit, resolver, dissolve, playscript, reveal]

requires:
  - quick: 261104-l0i-v2-0-1-version-issue-when-i-add-a-key-ke
    provides: the user-approved Standard rail dissolve machinery (qualification helper, paste-key intent field, resolver branch, addEmptyKey dispatch)
  - phase: 58
    provides: the in-rail insert precedence, canonical lifecycle clip contract and repeat-occurrence mapping that the dissolve must not disturb

provides:
  - isCompleteCanonicalLifecycleRailClip — the dissolve helper widened to every complete canonical lifecycle rail kind (Motion, Static, Reveal)
  - rail-kind-agnostic dissolve pins for scripted Motion, scripted Static and Reveal at the helper, full-resolve and + Key dispatch layers
  - fail-closed pins proving overridden scripted/Reveal clips keep the detached key at both layers
  - unchanged CR-05 append guard (isStandardMergedLoopClip) and 58 in-rail insert precedence

affects: [physic-paint roto rails, key rail segmentation, paint promotion, physical-edit proposals, undo]

actuals:
  tokens: 4215
  tasks: 2
  commits: 2

plan_head_before: 7ead6f0cf931bcc9a2c07210e635108c37152772
plan_head_after: 715c9c155fe641330a7f27ecac1d473945436765

tech-stack:
  added: []
  patterns:
    - "Predicate-only widening: the dissolve machinery was already rail-kind agnostic; the rail-kind gate lived in one terminal return of the qualification helper, so the fix is one renamed helper plus a widened doc block."
    - "Fail-closed qualification is unchanged: canonical lifecycle membership (one full-span visible range, empty frameOverrides), unique ending ownership, ascending contiguous sources, exact stored end, shared-cycle and other-extent refusals still gate every dissolve."
    - "The Standard discriminator stays the append-path authority only (CR-05), so scripted/reveal rails dissolve instead of being mutated through the append."

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts

key-decisions:
  - "The dissolve law now accepts every complete canonical lifecycle rail kind; the disclosed consequence (the rail's script/reveal effect is discarded with the clip, and the user re-runs the script or re-adds a cycle afterwards) is the same user-approved Standard law, unchanged."
  - "The rail-kind gate was removed from the helper only; the resolver's paste-key dissolve branch still re-resolves from its own validated identities and clip collection, so a child realm can never remove a clip the canonical parent did not authorise."
  - "isStandardMergedLoopClip remains imported and still gates the CR-05 append path byte-identically; only the dissolve doc/helper stopped referencing it (grep count 4 at baseline → 2, import + append use)."
  - "Overridden scripted/Reveal rails stay on the detached-key path because isCanonicalLifecycleRailClip already requires frameOverrides.length === 0 — no new condition was needed."
  - "No persisted model, parser or serializer change: clip removal rides the existing nextLoopClips proposal field, so one undo entry restores the rail."

patterns-established:
  - "Rail dissolve qualification is kind-agnostic at the helper layer; kind-specific edit laws (append, script/rereveal rebuild) stay in their own paths."
  - "Pin matrix per rail kind at three layers (helper, resolver proposal, + Key dispatch) with an overridden fail-closed twin."

requirements-completed: [QUICK-261105-P9I]

coverage:
  - id: D1
    description: "Every complete canonical lifecycle rail kind (Standard, scripted Motion, scripted Static, Reveal) qualifies for the post-end dissolve at the helper layer."
    requirement: QUICK-261105-P9I
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: every unproven qualification refuses to dissolve"
        status: pass
    human_judgment: false
  - id: D2
    description: "The resolver dissolves scripted Motion, scripted Static and Reveal rails into one proposal: nextLoopClips [], every source record at its frame, the new key joined at the clicked frame."
    requirement: QUICK-261105-P9I
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: scripted Motion and Reveal rails dissolve into one joined Key Rail"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: a scripted Static rail dissolves into one joined Key Rail"
        status: pass
    human_judgment: false
  - id: D3
    description: "+ Key and the paint promotion dispatch the dissolve for scripted Motion, scripted Static and Reveal rails (dissolve id, no rail-insert id, clip removed, joined key, no incoming break)."
    requirement: QUICK-261105-P9I
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a scripted Motion rail beyond its end dissolves into one joined rail"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a scripted Static rail beyond its end dissolves into one joined rail"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a Reveal rail beyond its end dissolves into one joined rail"
        status: pass
    human_judgment: false
  - id: D4
    description: "Overridden scripted and Reveal rails, non-canonical clips, shared cycles and covered destinations keep the detached-key fallback with zero data loss."
    requirement: QUICK-261105-P9I
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#an overridden scripted rail keeps the detached key — CR-05"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: every unproven qualification refuses to dissolve"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live canvas/timeline result: one continuous Key Rail from the first source key to the new key for scripted Motion/Static/Reveal rails, one Undo restores the rail."
    requirement: QUICK-261105-P9I
    verification: []
    human_judgment: true
    rationale: "Visible rail geometry and the single-undo feel are native UAT judgments on the running Studio window; vitest cannot observe the rendered timeline."
---

# Quick 261105-p9i: Extend Rail With Key/Paint Inside Motion Summary

**Rail dissolve widened from Standard-only to every canonical lifecycle rail kind: a + Key or paint on an empty frame after a scripted Motion, scripted Static or Reveal rail now removes the clip and lands one joined Key Rail in a single undoable edit.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-11-05T17:07:00Z
- **Completed:** 2026-11-05T17:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- The dissolve qualification helper no longer consults the rail kind: `isCompleteStandardRailClip` is now `isCompleteCanonicalLifecycleRailClip`, ending on `return true` after the unchanged lifecycle/repeat/source checks.
- Scripted Motion, scripted Static and Reveal rails each dissolve through `resolvePhysicPaintRotoRailDissolveTarget` and the resolver's paste-key branch into one proposal with `nextLoopClips: []`, every source record at its frame and the new key joined at the clicked frame.
- `addEmptyKey` dispatches the dissolve for all three kinds with no behavioural edit, since the dispatch was already rail-kind agnostic.
- The CR-05 append path and its `isStandardMergedLoopClip` guard are byte-identical; overridden scripted/Reveal rails still take the detached-key path because `isCanonicalLifecycleRailClip` requires an empty `frameOverrides`.
- Full suite green (374 files passed, 2 skipped; 7296 tests passed, 1 skipped, 96 todo), typecheck clean, no persisted model/parser diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: A scripted Motion rail past its end dissolves into one joined Key Rail end-to-end (predicate + docs + pins)** - `8bf0ab4ed` (fix)
2. **Task 2: Pin scripted Static, Reveal and the fail-closed override matrix; prove the untouched rail laws** - `715c9c155` (test)

**Plan metadata:** docs commit handled by the orchestrator.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` - renamed/widened dissolve helper, updated import comment, rewritten dissolve doc block; append guard untouched
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` - flipped scripted Motion/Reveal helper pins, scripted Static helper/full-resolve pin, overridden scripted/Reveal fail-closed pins
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - `addEmptyKey` comment updated only (dispatch code unchanged)
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` - flipped scripted Motion/Reveal dispatch pins, added scripted Static dispatch pin; overridden pins untouched

## Decisions Made

- Widened the predicate only, per the plan: the qualification helper is the single place the rail kind was consulted for the dissolve.
- Kept the dissolve doc block's existing qualification bullets verbatim except the rail-kind bullet, which now states the widened law and its disclosed script/reveal discard consequence.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification Evidence

- Targeted suites: `physicsPaintRotoPhysicalResolver.test.ts` (247 tests) and `useRotoTimelineActions.test.ts` (161 tests) — 408 passed, 0 failed.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — 374 files passed, 2 skipped; 7296 passed, 1 skipped, 96 todo, 0 failed.
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` — clean.
- Schema tripwire: `git diff --stat 7ead6f0cf..715c9c155` shows only the four plan files; no `physicsPaintRotoPhysicalModel.ts` or parser/serializer change.
- Static check: `grep -c 'isStandardMergedLoopClip' physicsPaintRotoPhysicalResolver.ts` = 2 (import + append use at the CR-05 guard); baseline at `fc8143f1c` was 4.

## Known Stubs

None.

## Threat Flags

None - no new network, auth, file-access or schema surface.

## UAT Rows Handed to the User

- Motion rail (scripted) without a cycle: + Key on an empty frame after its last key draws ONE rail line from the first key to the new key, with in-between dashes only when interpolation is on.
- Static rail (mode Static) beyond its end: same contiguous result.
- Reveal rail beyond its end: same contiguous result; the reveal effect is gone with the clip and re-running Reveal restores it.
- Same documents, paint on an empty frame after the rail: same contiguous result through the paint promotion route.
- One Undo restores the rail (script/reveal intact) and removes the added key.
- A rail carrying painted overrides keeps today's detached key for all three kinds.
- + Key inside a rail still grows the rail by a source phase (58 law), and + Key on a repeat occurrence still opens the key at its first-cycle phase.
- Ordinary Copy/Paste on the same empty frame still creates a detached key.

## Next Phase Readiness

- Automated side is ready; live visible UAT (native Studio window) is the remaining gate.
- No blockers; the change is local to the dissolve predicate, its docs and pins.

---
*Quick: 261105-p9i-extend-rail-with-key-or-paint-inside-mot*
*Completed: 2026-11-05*

## Self-Check: PASSED
