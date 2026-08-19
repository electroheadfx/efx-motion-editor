---
phase: quick-260819-wzi-fix-addemptykey-to-join-an-existing-key-
plan: 01
subsystem: physics-paint-roto
status: complete
tags: [roto, addEmptyKey, key-rails, interpolation-breaks, paste-key]

# Dependency graph
requires:
  - phase: 43.4
    provides: Key Rail segment derivation (deriveKeyRailSegments) from incoming interpolation break ownership and Group ownership
provides:
  - addEmptyKey joins an existing Key Rail when the destination is strictly inside a segment span (firstKeyFrame < dest < lastKeyFrame)
  - Trailing empty space, intentional gaps, and any position outside a segment span keep the own-one-key-rail broken-key contract (43.4 SC-10)
affects: [43.6, milestone v0.9.0 UAT]

# Actuals — pairs with the plan's estimates to calibrate future estimates.
actuals:
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "addEmptyKey derives startsNewSegment from deriveKeyRailSegments instead of a hard-coded true; a destination strictly inside a segment span joins the rail (startsNewSegment=false)"
    - "The segment input mirrors the rail-set branch construction: groupOwnedKeyIds from getRotoLoopClips, orderedRealKeys sorted by appFrame then keyId, breaks from getIncomingInterpolationBreakKeyIds"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts

key-decisions:
  - "Destination strictly inside a segment span (firstKeyFrame < dest < lastKeyFrame) -> startsNewSegment=false: the new key connects and the rail re-derives over it (0/4/6/8). Splitting remains the Scissor tool's job."
  - "Any destination NOT strictly inside a span keeps startsNewSegment=true (own one-key rail), preserving the 260816 broken-key contract and 43.4 SC-10."
  - "The resolver reports an unchanged-empty incoming-break collection as null (no-change marker); a join therefore yields null rather than a new-key break."

requirements-completed: [QUICK-260819-WZI]

coverage:
  - id: WZI-01
    description: "addEmptyKey at a destination strictly inside a derived Key Rail segment span joins the rail instead of spawning a spurious one-key rail"
    requirement: QUICK-260819-WZI
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#joins an existing Key Rail when the destination is strictly inside a segment span"
        status: pass
  - id: WZI-02
    description: "addEmptyKey at a trailing-space destination keeps its own one-key rail (broken-key guard)"
    requirement: QUICK-260819-WZI
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#keeps a trailing-space destination on its own one-key rail (guard)"
        status: pass
  - id: WZI-03
    description: "addEmptyKey at a gap destination not inside any segment span keeps its own one-key rail while preserving the pre-existing owning break (43.4 SC-10)"
    requirement: QUICK-260819-WZI
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#keeps a gap destination on its own one-key rail when no segment strictly spans it (guard)"
        status: pass

verification:
  - "pnpm vitest run app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts -- all 118 tests pass"
  - "pnpm typecheck -- no errors"

## Commits

- 22590503 test(roto): RED - addEmptyKey joins an existing Key Rail inside a segment span
- 3dd70c05 fix(roto): addEmptyKey joins an existing Key Rail inside a segment span
