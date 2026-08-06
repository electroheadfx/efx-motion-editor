---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 02
subsystem: roto-resolver
tags: [roto, physics-paint, loop-clips, lazy-resolution, interval-derivation, typed-contract, exhaustiveness, vitest]

requires:
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 01
    provides: PhysicPaintRotoLoopClip record, loopClips document collection, revision fingerprint
provides:
  - PhysicPaintRotoFrameResolution typed union ('real' | 'linked' | 'linked-unresolved' | 'empty') — THE single per-frame contract for store, dialog, capsule, tooltip, preview, and export (audit finding 3)
  - derivePhysicPaintRotoLoopRanges — ONE compact interval record per Loop Clip in O(keys + loops), independent of repeat count (D-32)
  - resolvePhysicPaintRotoLoopFrame — lazy per-frame query: real-key check first (D-26), binary-search interval lookup O(log loops), O(1) modulo
  - D-24 boundary algebra with self-exclusion; D-14 loop-loop priority; D-08/D-22 zero-effective survival; D-25/Q4 infinity bounded by min(parent end, capacity); D-31 verbatim unresolved records
  - Pitfall-7 exhaustiveness sweep: never-fallback switches in selectors, ports, and presentation; selection/drag exclusion for virtual occurrences; visible-window-bounded strip querying
affects: [43-03, 43-05, 43-06, 43-07, 43-08, 43-09, 43-10, filmstrip-capsule, hold-loop-clips]

actuals:
  tokens: 16000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Compact interval derivation + lazy per-frame query: one record per Loop Clip, resolution only for the requested frame or visible window — never duration-proportional (D-32, audit finding 2)"
    - "Single typed per-frame contract consumed via never-fallback exhaustiveness switches so a future resolution kind is a compile-time error at every consumer (Pitfall 7)"
    - "Infinity effective range folds the capacity clamp into the 'parent-end' boundary kind (Q4): min(parentEndExclusive, PHYSIC_PAINT_MAX_APPLY_FRAMES)"
    - "Boundary tie attribution: an exact frame tie between a loop start and a real key resolves to 'loop-start' — an original loop's first source key structurally coincides with its placement start"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopResolver.test.ts
    - app/src/components/physic-paint/roto/rotoPhysicalTimelinePorts.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/rotoTimelineSelectors.ts
    - app/src/components/physic-paint/roto/rotoPhysicalTimelinePorts.ts
    - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/stores/physicPaintStore.rotoHoldComposite.test.ts (Rule 3 typecheck-gate fix)

key-decisions:
  - "Derivation API shape: derivePhysicPaintRotoLoopRanges({ identities, loopClips, parentEndExclusive, capacity }) returns a frozen context { ranges (sorted by placementStart, loopId tiebreak), keyIdByAppFrame } — the sorted array makes the per-frame interval lookup an honest O(log loops) binary search"
  - "Finite loops are NOT capacity-clamped (distant frames beyond 600 resolve correctly along a longer parent); only infinity loops fold the 600 cap into the parent-end bound (Q4)"
  - "Zero-effective realizability: a non-owned blocker cannot share a frame with the loop's own first source key (one key per physical frame), so the D-08/D-22 spec exercises the duplicated-placement identity"
  - "The strip's loop wiring is opt-in via the rotoLoopResolutionContext prop: absent means byte-identical pre-43 behavior; store/Studio subscription threading is 43-03 scope"

patterns-established:
  - "getRotoFrameKeyInteraction / getRotoPhysicalSelectableKeyId / getRotoResolutionCellTooltipKind — the three exhaustiveness-guarded mappers every resolution-union consumer routes through"
  - "resolveRotoVisibleFrameResolutions(context, visibleFrames, query?) — visible-window derivation with an injectable query so specs spy the query count (proves D-32 boundedness)"

requirements-completed: [HOLD-05]

coverage:
  - id: D1
    description: "Loop-range derivation produces ONE compact interval record per Loop Clip with requested/effective ends, boundary kind/frame, truncation, partial-cycle, and unresolved metadata — complexity independent of repetition duration (D-32, audit finding 2)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopResolver.test.ts#compact interval derivation (20 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lazy per-frame query maps modulo sourceIndex/repeatInstance with real keys always winning; huge finite repeat and Infinity resolve distant frames without materializing intermediate frames (D-26/D-32)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoLoopResolver.test.ts#lazy per-frame typed contract + laziness cases (repeat 100000, frame 499995)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-24 boundary algebra: non-owned real key / other loop's placementStart / parentEndExclusive are the only boundaries; a loop never truncates itself; zero-effective survives; removal re-expands; D-14 later loop starts at its placementStart and is never pushed (D-08/D-14/D-24/D-25)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoLoopResolver.test.ts#boundary algebra + loop-loop priority + infinity describes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Typed 'linked-unresolved' contract carries loopId/appFrame/placementStart/sourceKeyIds/missingSourceKeyIds per frame — never throws, never blanks unrelated frames, unresolved records survive verbatim (D-31, audit finding 3)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoLoopResolver.test.ts#typed unresolved contract describe"
        status: pass
    human_judgment: false
  - id: D5
    description: "Virtual linked occurrences are excluded from key selection and drag eligibility in every consumer; strip queries are bounded to the visible window (query-count spy over a 100000-repeat loop) (D-11/D-23, Pitfall 7)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "rotoTimelineSelectors.test.ts, rotoPhysicalTimelinePorts.test.ts, physicsPaintWorkflowPresentation.test.ts, useRotoTimelineModel.test.ts, PhysicsPaintWorkflowStrip.test.ts (14 new tests)"
        status: pass
    human_judgment: false

duration: ~28min
completed: 2026-08-06
status: complete
---

# Phase 43 Plan 02: Loop Range Derivation + Lazy Typed Resolution Summary

**The physical resolver now derives ONE compact interval record per Loop Clip and answers a lazy per-frame query through the single typed contract real/linked/linked-unresolved/empty — no virtual occurrence is ever materialized, and every consumer guards the union with compile-time exhaustiveness**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-08-06T20:34:41Z
- **Completed:** 2026-08-06T21:03:00Z
- **Tasks:** 3
- **Files modified:** 13 (2 new specs, 6 source files, 5 spec updates)

## Accomplishments

- `derivePhysicPaintRotoLoopRanges` — one frozen interval record per Loop Clip: `loopId, placementStart, cycleLength, sourceKeyIds, repeat, requestedEnd (number | 'infinity'), effectiveEnd, boundary { kind: 'real-key' | 'loop-start' | 'parent-end', frame }, truncated, partialCycle, unresolved { missingSourceKeyIds } | null`. Derivation is O(keys + loops), pure, and deterministic (D-30); a repeat-100000 loop and an Infinity loop each produce exactly one record with a fixed key set — the spec asserts the record shape and resolves frame 499995 correctly with no intermediate-frame work (D-32, audit finding 2)
- `resolvePhysicPaintRotoLoopFrame` — the lazy canonical query: real-key map first (real always wins, making D-06 shrink and D-12 materialize-local-key emergent), then an honest O(log loops) binary search over placementStart-sorted intervals (commented as such — no false O(1) claim), then O(1) modulo for `sourceIndex`/`repeatInstance`
- D-24 boundary algebra with full self-exclusion (own start, own virtual occurrences, own source keyIds never truncate the loop — the spec proves the own-first-source-key-at-placementStart collapse is impossible); D-14 loop-loop priority with loop-start tie attribution; D-08/D-22 zero-effective survival; automatic re-expansion on boundary/loop removal; D-25/Q4 infinity tracking bounded by `min(parentEndExclusive, 600)` with the clamp folded into the 'parent-end' kind; D-21 partial-cycle detection
- D-31 unresolved contract: a strict-subset or fully missing source list keeps the full interval record with the exact `missingSourceKeyIds`; frames inside resolve 'linked-unresolved' per-frame — never a throw, never a global failure, sibling loops and unrelated real frames resolve normally
- Pitfall-7 sweep: `getRotoFrameKeyInteraction` (selectors), `getRotoPhysicalSelectableKeyId` (ports), `getRotoResolutionCellTooltipKind` (presentation) each switch the union with a `never` fallback; the model threads `rotoLoopClips`/`rotoParentEndExclusive` into the structural selector and exposes `loopResolutionContext` + `getFrameResolution`; the strip gains the opt-in `rotoLoopResolutionContext` prop with visible-window-only querying proven by a query-count spy (120 visible frames over a 500000-frame effective range → exactly 120 queries)

## Task Commits

Each task was committed atomically (TDD: RED then GREEN per task):

1. **Task 1 (RED): loop resolver spec** — `c3f05205` (test) + `e03d1224` (test fixture corrections)
2. **Task 2 (GREEN): interval derivation + lazy per-frame resolution** — `9ec11422` (feat)
3. **Task 3: Pitfall-7 consumer sweep** — `647e5179` (test, RED) + `f4288c6f` (feat, GREEN)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoLoopResolver.test.ts` — 20-test spec: interval derivation, laziness (huge finite + Infinity), modulo mapping, duplicated-placement identity, boundary algebra, loop-loop priority, zero-effective, re-expansion, infinity tracking/cap, typed unresolved contract, determinism
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — `PhysicPaintRotoFrameResolution` union, `PhysicPaintRotoLoopRange`, derivation input/context, `derivePhysicPaintRotoLoopRanges`, `resolvePhysicPaintRotoLoopFrame` (~300 lines appended; existing edit/projection seams untouched)
- `app/src/components/physic-paint/roto/rotoTimelineSelectors.ts` — structural `loopResolution` derivation (fail-closed empty context preserved), `getRotoFrameKeyInteraction`, `resolveRotoVisibleFrameResolutions`
- `app/src/components/physic-paint/roto/rotoPhysicalTimelinePorts.ts` — optional `getFrameResolution` port member, `getRotoPhysicalSelectableKeyId` exhaustiveness switch
- `app/src/components/physic-paint/roto/rotoPhysicalTimelinePorts.test.ts` — new spec: selection exclusion across all four kinds + port pass-through
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` — `getRotoResolutionCellTooltipKind` (D-18: existing semantics only)
- `app/src/components/physic-paint/hooks/useRotoTimelineModel.ts` — `rotoLoopClips`/`rotoParentEndExclusive` inputs, `loopResolutionContext` signal, `getFrameResolution`
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `rotoLoopResolutionContext` prop, visible-window memo, drag/tooltip gating via the mappers (byte-identical when the prop is absent)
- Spec updates: `rotoTimelineSelectors.test.ts`, `physicsPaintWorkflowPresentation.test.ts`, `useRotoTimelineModel.test.ts`, `PhysicsPaintWorkflowStrip.test.ts` (14 new tests), `physicPaintStore.rotoHoldComposite.test.ts` (Rule 3 narrowing fix)

## Decisions Made

- Derivation returns a prepared context (`ranges` sorted by placementStart + `keyIdByAppFrame` map) so repeated per-frame queries are O(log loops) after one O(keys + loops) derivation — re-derivation per document revision, never per frame
- Boundary tie rule: on an exact frame tie, 'loop-start' outranks 'real-key' outranks 'parent-end' — an original loop's first source key structurally coincides with its placement start, so real-key-wins-ties would make 'loop-start' unreachable for original loops
- Finite loops are bounded by requested end, D-24 candidates, and parentEndExclusive only; the 600 capacity clamp applies solely to infinity loops (Q4 was scoped to infinity) — proven by the distant-frame laziness case
- The strip consumes the contract through two exhaustiveness-checked mappers and never branches on resolution kinds locally; all four kinds are named in the cell-loop comment for the consumer-grep contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected two RED spec fixtures before GREEN**
- **Found during:** Task 1 (pre-GREEN review)
- **Issue:** (a) the zero-effective fixture placed a non-owned blocker at frame 10 while the loop's own source key A also lived at frame 10 — a duplicate physical frame, unrealizable in a validated document; (b) the unresolved-contract sibling loop referenced the same partially-missing source set, so it would itself have been unresolved and could not prove "no global failure"
- **Fix:** zero-effective case uses the duplicated-placement identity (blocker at the chosen destination frame); sibling loop references only present sources
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoLoopResolver.test.ts`
- **Commit:** `e03d1224`

**2. [Rule 3 - Blocking] Narrowed real render sources in the 43-04 hold-composite spec**
- **Found during:** Task 3 verification (`pnpm --dir app run typecheck`)
- **Issue:** pre-existing typecheck failure (2 errors) from 43-04's `physicPaintStore.rotoHoldComposite.test.ts`: `source?.keyId` accessed on the `PhysicPaintRotoPhysicalRenderSource` union after a non-narrowing `expect(kind).toBe('real')`, blocking this plan's mandated typecheck gate
- **Fix:** explicit `if (source?.kind !== 'real') throw` narrowing at both sites — assertion strength preserved (a non-real resolution still fails the test); the 43-04 spec still passes (4 tests)
- **Files modified:** `app/src/stores/physicPaintStore.rotoHoldComposite.test.ts`
- **Commit:** `f4288c6f`

**3. [Plan-directed] Updated the strip's pinned `dragEligible` source-contract assertion**
- **Found during:** Task 3 GREEN
- **Issue:** the pre-existing source-contract test pinned `const dragEligible = isPhysicalRealKey && !rotoDragLocked;` verbatim; Task 3 explicitly modifies that site (plan names the line-1315 pattern)
- **Fix:** assertion updated to the Pitfall-7 gated expression with a comment documenting that the gate is a no-op for real keys; runtime semantics for real keys unchanged
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`
- **Commit:** `f4288c6f`

## Issues Encountered

- Shell cwd resets between Bash calls repeatedly dropped the `app/` working directory (`vitest not found` / `typecheck script missing`); re-ran with explicit `cd` — no functional impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **43-03 (store):** subscribe the store's `loopClips` + parent end into `useRotoTimelineModel` (`rotoLoopClips`/`rotoParentEndExclusive`) and pass `loopResolutionContext` into the strip's `rotoLoopResolutionContext` prop — the prop is intentionally unwired here (opt-in, byte-identical when absent); 43-03 owns the store subscription
- **43-07 (capsule):** consume `PhysicPaintRotoLoopRange` records directly for capsule geometry (requested vs effective, boundary kind/frame, partialCycle, zero-effective anchor)
- **43-08 (tooltip/badge):** `resolvePhysicPaintRotoLoopFrame` supplies `repeatInstance`/`sourceIndex` for the D-17 tooltip; linked cells currently keep existing fills pending the additive badge
- **43-09 (preview/export):** the 'linked-unresolved' per-frame result carries everything the D-28 export preflight needs (loopId, placementStart, missingSourceKeyIds)

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-02-SUMMARY.md`
- FOUND: `app/src/components/physic-paint/roto/physicsPaintRotoLoopResolver.test.ts`
- FOUND: `app/src/components/physic-paint/roto/rotoPhysicalTimelinePorts.test.ts`
- FOUND commits: `c3f05205`, `e03d1224`, `9ec11422`, `647e5179`, `f4288c6f`
- Verify: `pnpm --dir app exec vitest run physicsPaintRotoLoopResolver physicsPaintRotoPhysicalResolver` — 42 passed; consumer five-file run — 115 passed; full suite — 1285 passed, 0 failed (104 files); `pnpm --dir app run typecheck` — exit 0 with exhaustiveness switches in place
- Acceptance greps: `grep -c "linked-unresolved"` resolver = 5; all five consumer files ≥ 1; honest `O(log loops)` / `O(keys + loops)` complexity comments present; no store/signal imports in the resolver (pure)

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-06*
