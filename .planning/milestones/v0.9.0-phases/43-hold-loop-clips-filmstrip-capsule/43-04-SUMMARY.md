---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 04
subsystem: testing
tags: [roto, physics-paint, static-hold, determinism, atomic-commit, undo-redo, vitest, hardening]

requires:
  - phase: 42-playscript-application-modes
    provides: buildStaticStrokeSchedule, transformRecordedStrokeForHeldPose, staged atomic commit via renderRotoPlayScriptFrames + confirm()
provides:
  - HOLD-01 pinned green — static/hold complete-stroke-set materialization per destination frame, adjacent progressive-then-hold ranges with half-open boundaries (no overlap, no gap, no cross-range strokes), single-stroke multi-frame cycle
  - HOLD-02 pinned green — byte-identical held-pose output across double application, save/reopen JSON round-trip, and cache regeneration; zero variation returns the input stroke by identity; adversarial percent inputs clamp without NaN (T-43-04-01)
  - HOLD-03 pinned green — mid-stage cancellation and mid-generation renderer failure commit zero destination keys; one accepted generation is exactly one history command (one Undo removes every generated key, one Redo restores them) proven through the real useRotoPhysicalEditHistory hook; re-application is byte-identical with zero fresh key identity
  - HOLD-04 pinned green — every destination frame resolves via getRotoPhysicalRenderSource to exactly one canonical rendered raster owned by the parent Paint layer; identical re-commit is a revision-stable no-op
affects: [43-05, 43-06, 43-07, 43-08, 43-09, 43-10, hold-loop-clips]

actuals:
  tokens: 9600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Hardening-spec protocol: specs exercise the REAL shipped modules (no mocks in the determinism spec) and are expected to pass on first run; a RED result is a regression signal routed through the bounded deviation protocol — never asserted away"
    - "Cross-module integration proof inside a port-level spec: the controller spec drives the real useRotoPhysicalEditHistory hook with the accepted play-script output to pin one-command Undo/Redo semantics without a second commit path"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts
    - app/src/stores/physicPaintStore.rotoHoldComposite.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts

key-decisions:
  - "Determinism spec imports the real @efxlab/efx-physic-paint/animation modules unmocked — the hash-seeded held-pose transform is proven pure at the stroke level, which is the byte-identical substrate every dataUrl encode consumes (HOLD-02)"
  - "HOLD-03 one-Undo/one-Redo semantics proven by composing the real controller confirm() output with the real useRotoPhysicalEditHistory hook — one accepted generation records exactly one history command"
  - "HOLD-04 single-raster proof asserts reference identity (renderedFrame IS the stored record payload) so no second composite or copy can satisfy the spec"

requirements-completed: [HOLD-01, HOLD-02, HOLD-03, HOLD-04]

coverage:
  - id: HOLD-01
    description: "Complete stroke set on every destination frame; adjacent progressive 10-14 then static/hold 15-19 with no overlap/gap/cross-range strokes; single-stroke 3-frame cycle"
    proof: physicsPaintRotoHoldDeterminism.test.ts + physicsPaintRotoPlayScriptRenderer.test.ts (HOLD-01 describe)
  - id: HOLD-02
    description: "Byte-identical output across double application, save/reopen round-trip, cache regeneration; zero-variation identity; adversarial clamp without NaN"
    proof: physicsPaintRotoHoldDeterminism.test.ts
  - id: HOLD-03
    description: "Mid-stage cancellation and renderer failure commit zero destination keys; one generation = one history command with one-Undo/one-Redo; idempotent re-application"
    proof: physicsPaintRotoPlayScriptController.test.ts (HOLD-03 describe)
  - id: HOLD-04
    description: "One resolved raster per destination frame via getRotoPhysicalRenderSource, owned by the parent Paint layer; identical re-commit is a no-op"
    proof: physicPaintStore.rotoHoldComposite.test.ts

status: complete
---

# Phase 43 Plan 04: Hold Determinism and Commit Hardening Specs Summary

**One-liner:** Wave 0 hardening specs pinning HOLD-01..04 against shipped Phase 42 machinery — complete-stroke-set materialization, byte-identical held-pose determinism, atomic single-command commits, and one-resolved-raster-per-frame compositing — all green on first run with zero production edits.

## What Was Built

### Task 1: HOLD-01/HOLD-02 specs (commit c8396aa3)

- **New `physicsPaintRotoHoldDeterminism.test.ts`** (19 cases) exercising the REAL animation modules unmocked: `buildStaticStrokeSchedule` maps every stroke to `[0, usableFrames-1]` with full `pointsPerFrame`; zero variation returns the input stroke object by identity; nonzero position/deformation/combined Motion re-renders byte-identically across double application, save/reopen JSON round-trips, and cache regeneration via a rebuilt schedule; stop-motion hold quantization keeps adjacent frames in one hold step byte-identical; adversarial percent inputs (1e6, -500, NaN, Infinity, non-finite frame) clamp per `clampPercent` with finite output only (T-43-04-01).
- **`physicsPaintRotoPlayScriptRenderer.test.ts` HOLD-01 describe** (4 cases): complete stroke set on every destination frame under static mode; progressive frames 10-14 then static/hold frames 15-19 with half-open boundaries (10 distinct destinations, no overlap, no gap, no cross-range stroke colors); single-stroke script over 3 frames yields 3 frames each containing exactly that stroke; per-frame `destinationSourceFrame` seeding of the held-pose transform pinned call-by-call (HOLD-02 renderer wiring).

### Task 2: HOLD-03/HOLD-04 specs (commit d009f467)

- **`physicsPaintRotoPlayScriptController.test.ts` HOLD-03 describe** (4 cases): mid-stage cancellation (renderer parked between staged frames, cancel lands after frame 1 of 3) commits zero destination keys with the document byte-identical to before the attempt; renderer failure after two staged frames surfaces the inline error (`failed` phase, dialog open) with the commit port never invoked; a completed static/hold generation is exactly ONE history command — proven end to end by feeding the real accepted `play-script` output through the real `useRotoPhysicalEditHistory` hook (one Undo removes all three generated keys, one Redo restores them, replay kinds exactly `['undo','redo']`); re-application after parent acceptance produces a byte-identical publication reusing existing keyIds with zero fresh identity.
- **New `physicPaintStore.rotoHoldComposite.test.ts`** (4 cases): each destination frame (4, 5, 6) resolves via `getRotoPhysicalRenderSource` to exactly one `real` raster owned by the parent Paint layer with reference identity to the stored canonical payload; out-of-range/invalid frames resolve null; identical re-commit is a revision-stable no-op (content revision, projection reference, and both version counters unchanged); out-of-order installs read back in deterministic ascending frame order.

## Verification

| Check | Result |
|-------|--------|
| `vitest run physicsPaintRotoHoldDeterminism physicsPaintRotoPlayScriptRenderer` | 38/38 passed |
| `vitest run physicsPaintRotoPlayScriptController physicPaintStore.rotoHoldComposite` | 46/46 passed |
| Full suite `vitest run` | 1250 passed, 1 skipped, 101 todo — exit 0 |
| `git diff --stat packages/efx-physic-paint` | empty — zero production edits under this plan |

## Deviations from Plan

None — plan executed exactly as written. All hardening specs passed green on first run, so the bounded deviation protocol was never triggered and no production file was touched.

## Known Stubs

None — test-only plan; every assertion exercises shipped production behavior.

## Threat Flags

None — no new security-relevant surface; the threat register's T-43-04-01 (adversarial Motion percent inputs) is explicitly covered by the clamp spec cases, and T-43-04-02 (weakened assertions) is countered by byte-exact `JSON.stringify` equality throughout. No installs occurred (T-43-04-SC).

## Self-Check: PASSED

All 4 spec files and this SUMMARY exist on disk; commits c8396aa3 and d009f467 verified in git history.
