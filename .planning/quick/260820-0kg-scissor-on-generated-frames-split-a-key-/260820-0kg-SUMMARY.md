---
phase: quick
plan: 260820-0kg
subsystem: ui
tags: [roto, scissor, key-rail, generated-frame, interpolation, break-ownership]

# Dependency graph
requires:
  - phase: 43.4
    provides: scissor-key-rail resolver intent + real-key scissor classification/availability/copy
  - phase: 43.1
    provides: incoming interpolation break ownership + deriveKeyRailSegments segment authority
provides:
  - Generated in-between frames inside a derived Key Rail classify as genuine split targets and enable Scissor
  - Mapper-owned tooltip + accepted-copy variants (split-at-point vs split-before-key)
  - Persistent gap between the surrounding real keys after a mid-interpolation cut
affects: [phase-44, future Scissor/rail work, strip tooltip wiring]

# Actuals (#2632) — chars/4 over the realized diff across all three commits.
actuals:
  tokens: 6389
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Mapper owns every Scissor copy variant (mapRotoScissorTooltip / mapRotoScissorAcceptedCopy) following the insertTooltipDescription precedent
    - Group/linked guards run ahead of generated acceptance inside the classifier
    - Segment membership reuses the exported deriveKeyRailSegments authority instead of duplicating segment math

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "Classify a generated in-between strictly inside a derived Key Rail segment as generated-ok { keyId, appFrame } and enable Scissor; the next real key after the cursor owns the new persistent incoming break."
  - "Group ownership of the following real key is checked BEFORE the linked frame-resolution check inside the generated branch (RED 3 asserts ownership: group), so a Motion/Static Group generated span is never accepted as a split target."
  - "The old 'generated' disabled kind is repurposed for the edge-of-segment case with the new locked reason 'Scissor is unavailable at the edge of a Key Rail segment.'"
  - "Mapper owns all enabled copy variants: mapRotoScissorTooltip (Split the Key Rail at this point. / before this key.) and mapRotoScissorAcceptedCopy (Split Key Rail at frame {N}. / before frame {N}.)."

patterns-established:
  - "One pure classifier + one product-reason mapper + one tooltip signal family owns the entire Scissor availability/activation surface (43.1/43.4 precedent)."
  - "Break ownership always resolves within the same derived Key Rail segment (deriveKeyRailSegments authority), never across segments."

requirements-completed: []

coverage:
  - id: D1
    description: "A generated in-between strictly inside a Key Rail classifies as generated-ok { keyId, appFrame } and maps to a null disabled reason."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#RED 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Scissor on a generated in-between dispatches one scissor-key-rail command with breakOwnerKeyId = next real key, deriving rails [0-2] + [6-8] and leaving frames 3-5 empty with interpolation On."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#RED 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "A generated frame whose next real key already owns a break is a silent exact no-op (zero history delta, no status publication)."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#RED 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "A generated frame inside a Motion/Static Group is disabled with the mapped Motion/Static Group reason."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#RED 3"
        status: pass
    human_judgment: false
  - id: D5
    description: "Undo/Redo restores the exact pre-split break-less rail and re-applies the split (break-ownership byte parity for the generated-origin scissor)."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#records one accepted scissor-key-rail command"
        status: pass
    human_judgment: false
  - id: D6
    description: "A generated frame at the edge of a Key Rail segment maps to the new disabled reason."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#edge of a Key Rail segment"
        status: pass
    human_judgment: false
  - id: D7
    description: "The mapper owns every enabled copy variant (tooltip + accepted status) for real-key and generated-frame targets."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#maps every enabled Scissor copy variant"
        status: pass
    human_judgment: false
  - id: D8
    description: "The Scissor tooltip is wired to the mapper-owned description signal in the workflow strip."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#guards activation"
        status: pass
    human_judgment: false
  - id: D9
    description: "Native visual UAT for the user example (keys 0/2/6/8 cursor 4 -> 3-frame hole, second cut no-op, real-key scissor unchanged, Interpolation Off/On never refills, Undo/Redo, save/reopen)."
    verification: []
    human_judgment: true
    rationale: "Automated proof covers the classification, dispatch, history byte-parity, and copy family; the visual timeline behavior and save/reopen parity require the user's native session per project convention."

# Metrics
duration: 14min
completed: 2026-08-20
status: complete
---

# Quick 260820-0kg: Scissor on Generated Frames — split a Key Rail mid-interpolation

**Scissor now accepts a generated/interpolated frame inside a Key Rail: the cut resolves to the next real key in the same derived segment, which owns a new persistent incoming break, leaving an intentional gap between the surrounding real keys.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-20T00:32:00Z (approx)
- **Completed:** 2026-08-20T00:36:30Z
- **Tasks:** 2
- **Commits:** 3

## Accomplishments

- Revised the locked 43.4 decision ("Scissor targets real keys only") in TARGET CLASSIFICATION + AVAILABILITY + COPY ONLY — the resolver (`scissor-key-rail`), history, bridge, and settlement paths are untouched.
- `classifyRotoScissorTarget` yields `{ kind: 'generated-ok', keyId, appFrame }` for a generated in-between strictly inside a derived Key Rail segment; the group/linked guards run ahead of acceptance (a Motion/Static Group generated span stays disabled); the following real key owns the new break.
- New edge-of-segment disabled reason replaces the old "unavailable on a generated frame" copy; `'generated'` kind is repurposed for that case.
- New exported mappers `mapRotoScissorTooltip` / `mapRotoScissorAcceptedCopy` own every enabled copy variant, and a `scissorTooltipDescription` computed signal wires the split-at-point tooltip into the strip.
- RED 1 proves keys 0/2/6/8 + cursor 4 -> one `scissor-key-rail` command with `breakOwnerKeyId: 'k6'`, derived segments `[0-2]` + `[6-8]`, and no generated cells at frames 3-5 with interpolation On.
- RED 4 history case pins break-ownership byte parity through Undo/Redo for the generated-origin scissor.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests** - `1ce36582` (test)
2. **Task 2: Implementation** (classification + availability + copy + tooltip signal + strip wiring) - `d27860eb` (feat)
3. **Supporting: mapper copy pinning** - `ed1332e8` (test)

**Plan metadata:** handled by the orchestrator (docs commit).

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - Added `generated-ok` target kind, reordered generated-cell classification (group > linked > break > segment), updated `mapRotoScissorProductReason`, added `mapRotoScissorTooltip`/`mapRotoScissorAcceptedCopy`, `scissorTooltipDescription` computed + bundle/interface/useMemo wiring, and dual-kind acceptance in `scissorKeyRail`.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - Scissor tooltip now consumes `physicalActions?.scissorTooltipDescription.value` with the locked fallback literal.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` - Updated the existing generated-frame expectation (RED 0), added edge-of-segment classification, RED 1/2/3, mapper copy pinning.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` - Added the generated-origin `scissor-key-rail` byte-parity case (RED 4).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - Updated the pinned source contract for the mapper-driven Scissor tooltip.

## Decisions Made

- See frontmatter `key-decisions`. The primary one: a generated in-between is a genuine split target when its following real key is inside the same derived Key Rail segment and not group-owned / not already breaking.

## Deviations from Plan

- **Plan order of the generated-cell guards (Task 2 bullet 2) listed the linked frame-resolution check before the group-ownership check. RED 3 asserts `ownership: 'group'` for a group-generated cell (`frameResolution: linked-generated`, `rightKeyId` group-owned). To make RED 3 green, the group-ownership check runs BEFORE the linked check inside the generated branch. Both guards still run ahead of acceptance, so the plan's design intent (generated acceptance never swallows a Group/linked span) is preserved.**
  - **Committed in:** `d27860eb` (Task 2).
- Added a small mapper copy-pinning test (`ed1332e8`) for the two new exported mappers to pin the locked tooltip/status copy family (the plan's RED set asserted only the accepted status string via RED 1).

## Issues Encountered

- TypeScript `input.currentAppFrame` narrowing: after the `deriveKeyRailSegments` call the compiler widens the property access back to `number | null`; fixed by capturing a local `const appFrame` after the guard and using it through the classifier body.
- The RED classification inputs needed explicit `RotoScissorTargetClassificationInput` annotations (contextual typing lost on a standalone const) and the mock `executePhysicalEdit` arg needed a typed cast to reach `proposal` safely.
- The strip's pinned source-contract test asserted the old hardcoded tooltip literal; updated it to assert the mapper-driven expression.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All automated gates green: 3-file plan suite (338 tests) + strip suites (475 total across the five files), `pnpm typecheck` clean, no stale generated-frame copy remains.
- Native UAT remains deferred to the user per the plan: the user example (keys 0/2/6/8, cursor 4 → 3-frame hole; second cut on the same span is a no-op), Scissor on real keys unchanged, Interpolation Off/On never refills the new gap, Undo/Redo, save/reopen.

---
*Phase: quick · Completed: 2026-08-20*
