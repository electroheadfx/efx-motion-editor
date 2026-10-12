---
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
plan: 04
subsystem: ui
tags: [preact, signals, physics-paint, timeline, multi-track, filmstrip, capsule, background-row, shortened-loop]

# Dependency graph
requires:
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 01
    provides: the single resolver path (derivePhysicPaintRotoLoopRanges) and its per-track memoized store context getTrackRotoResolutionContext, the Loop Clip rail with Phase 43 locked semantics (purple/cyan, passive markers, white endpoint cuts), the presentation projection module (projectPhysicsPaintLoopClipPresentation / projectPhysicsPaintLoopClipGeometry)
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 02
    provides: the rows region (multi-track rows + Bg row), row cell geometry (ROW_CELL_WIDTH_PX 18, 30px rows per UAT), background FrameLoopClip document records, the Bg-row fallback display surface
provides:
  - Capsule presentation shortened/partial-cycle facts (TML-06): `shortened`, `partialCycle`, `shortenedLabel` ('Loop shortened by next clip', D-14 English), `repeatInstanceCount`, `interruptionTooltipLine` ('next clip — interrupts the loop') — all derived from the single resolver's `range.truncated` / `range.partialCycle` / `effectiveEnd`, never touching `cycleLabel` (requested-duration badge, Pitfall m2)
  - `PhysicsPaintFilmstripCapsule` component + `FILMSTRIP_CELL_EXPAND_THRESHOLD_PX = 12` (D-13): source-cycle head cells, ×N/×∞ badge from the requested `cycleLabel`, distinct shortened visual + label (D-12), compact hatched repetition band below the threshold vs expanded lighter linked cells above it, diagonal partial-cut class only when `partialCycle` — paint-only (aria-hidden, pointer-events none, z-index 7)
  - Per-row capsule paint: the active loop-clip rail renders the capsule as a paint sibling, non-active rows and the Bg row render capsule paint in a `.physics-paint-track-row-capsules` layer fed by the store's memoized per-track context (no resolver math in the strip); Bg row additionally projects `FrameLoopClip` records through `projectBackgroundFrameLoopClipCapsule` (RESEARCH A3 — clip facts only, infinite bounded by the visible window, null outside it)
affects: [47-05]

# Actuals — pairs with the plan's `estimate` (tokens 65000, tasks 3, confidence low).
# estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 10980     # chars/4 over the 43,918-char realized diff (c48a1aea..HEAD, 8 files, +815/-9)
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capsule-never-math contract: the filmstrip capsule receives presentation (labels/tooltips), resolver-derived facts (sourceOffsets/sourceFrameCount/cycleLength/repeat), geometry (left/width), and cellWidth — it never computes loop math of its own; the ×N/∞ badge is built from the requested `cycleLabel` (Pitfall m2 held)"
    - "Single resolver path held in the strip: per-row capsule data comes from the store's memoized getTrackRotoResolutionContext + getRotoPhysicalLoopClips, projected through the same presentation/geometry module the rail uses — no resolver math in the strip (grep gate)"
    - "Paint-as-sibling layering: capsule paint mounts as a sibling of interactive targets with pointer-events: none and z-index 7, so per-row capsule paint can never intercept rail drags or selection"
    - "Background records get their own projection (RESEARCH A3): FrameLoopClip is a document record (startFrame/sourceFrameRefs/repeat), not a Hold resolver input, so projectBackgroundFrameLoopClipCapsule reads clip facts only and bounds infinite repeats by the visible frame window (T-47-04-03 DoS guard)"

key-files:
  created:
    - app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.tsx
    - app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.test.ts
  modified:
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "repeatInstanceCount = Math.floor(max(0, effectiveEnd - phaseOrigin) / cycleLength): the number of fully completed source cycles within the effective range — verified against the fixtures (12→24 / 4 → 3; truncated 22 → 2; full-cycle 20 → 2)"
  - "The capsule badge never changes when shortened: `cycleLabel` always shows the REQUESTED duration (Pitfall m2); shortened is a distinct visual + label (D-12) driven by `range.truncated` straight from the resolver (D-32), and the diagonal cut is driven by `range.partialCycle` alone"
  - "The interruption tooltip line is appended at index 5 (right after `Status:`); the fragment projection (`projectPhysicsPaintLoopClipFragmentPresentation`) re-slices 0..5 and intentionally drops it — fragment views are out of scope for this plan"
  - "Per-row capsule data path: the strip reads the store's memoized `getTrackRotoResolutionContext(layerId, trackId)` and `getRotoPhysicalLoopClips`, then projects each range through the shared presentation module — no loop math in the strip (the grep gate)"
  - "The Background row: `FrameLoopClip` records are projected through `projectBackgroundFrameLoopClipCapsule` (RESEARCH A3) instead of the Hold resolver — one record → one capsule, no modulo or effective-end math; infinite repeats are bounded by the visible frame window (startFrame → max(startFrame, window.endFrameExclusive)) so the capsule can never generate unbounded cells"
  - "CSS-presence assertions live in the unit tests (cssRule reads physicsPaintStudio.css) and were folded into the Task 2 GREEN commit; the compact/expanded threshold is a named export (FILMSTRIP_CELL_EXPAND_THRESHOLD_PX = 12) so the D-13 formula is testable and tunable in UAT"

patterns-established:
  - "Filmstrip capsule contract: presentation + resolver facts + geometry + cellWidth in, pure paint out — the component stays dumb, every fact is resolver-authoritative"
  - "Layer-order discipline: rail targets and capsule paint coexist as siblings at different z-indices; capsule paint never owns pointer events"

requirements-completed: [TML-06, TML-07]

coverage:
  - id: D1
    description: "Capsule presentation shortened/partial-cycle facts (TML-06) — shortened true exactly when range.truncated, partialCycle from range.partialCycle, requested badge byte-identical ('Cycle 4f × 3 = 12f'/'Cycle 4f × ∞'), shortenedLabel 'Loop shortened by next clip', interruptionTooltipLine 'next clip — interrupts the loop', repeatInstanceCount full cycles in the effective range, no shortened state at the natural bound"
    requirement: TML-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#projects a shortened finite loop with the requested badge and the interruption tooltip line"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#shortens an infinity loop without touching its ×∞ requested badge"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#projects no shortened state when the loop ends at its natural bound"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#distinguishes a mid-cycle truncation from one landing on a cycle boundary"
        status: pass
    human_judgment: false
  - id: D2
    description: "Filmstrip capsule component (TML-06, UI-SPEC) — source-cell band at the head, ×N/×∞ badge from cycleLabel, diagonal partial-cut across the repetition band only when partialCycle, compact hatched band below the cell-width threshold and expanded linked cells above it, distinct shortened visual + label while keeping the requested badge"
    requirement: TML-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.test.ts#renders one source-cycle cell per source frame at the capsule head, each carrying the source-frame index"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.test.ts#derives the ×N/×∞ badge from the requested cycleLabel, never from the effective duration"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.test.ts#renders the diagonal cut across the repetition band only when the cycle is partial"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.test.ts#switches the repetition band between the compact hatched form and expanded linked cells at the cell-width threshold"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.test.ts#renders the distinct shortened visual and label while keeping the requested badge (D-12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Background-row capsule projection (TML-07, RESEARCH A3) — FrameLoopClip records project into the shared capsule inputs with clip facts only (no loop math), infinite repeats are bounded by the visible frame window, fully-outside clips return null"
    requirement: TML-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#projects a finite background clip into the shared capsule inputs without loop math"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#bounds an infinite background clip display by the visible frame window"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#returns null for a background clip fully outside the visible window"
        status: pass
    human_judgment: false

# Metrics
duration: 2h10min
completed: 2026-08-25
status: complete
---

# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls — Plan 4 Summary

**The Loop Clip filmstrip capsule ships: shortened/partial-cycle presentation facts, a dumb paint-only capsule component, per-row capsule paint on every track row plus a Background-row projection of `FrameClip` records — all unit-proven on the milestone branch**

## Performance

- **Duration:** 2h10 min (wall-clock span of the execution; commit timestamps span the 47-04 authoring session)
- **Completed:** 2026-08-25
- **Tasks:** 3 (plan tasks; RED+GREEN for Tasks 1–2, Task 3 single commit)
- **Commits:** 5 (1 test RED + 1 feat per Task 1 and Task 2; 1 feat for Task 3)
- **Files:** 8 (2 created, 6 modified) — plan listed 7 files; the per-row mount surface (`PhysicsPaintTrackRow.tsx`) was added

## Accomplishments

- **Task 1 — capsule presentation shortened state** (`physicsPaintLoopClipPresentation.ts`, commits `9a325551` test + `8ed16d97` feat): the presentation gains `shortened` (= `range.truncated`), `partialCycle` (= `range.partialCycle`), `shortenedLabel` ('Loop shortened by next clip'), `interruptionTooltipLine` ('next clip — interrupts the loop', tooltip index 5 after Status), and `repeatInstanceCount` (full cycles within the effective range). The requested badge (`cycleLabel`) is never touched — Pitfall m2 holds, verified for both finite and infinity loops.
- **Task 2 — filmstrip capsule component** (`physicsPaintFilmstripCapsule.tsx` + test, commits `4d8895c3` test + `d81e2e68` feat): a paint-only capsule (`aria-hidden`, `pointer-events: none`, `z-index: 7`) rendering the source-cycle head cells, the ×N/×∞ badge from the requested label, the shortened visual + label when shortened (never a badge swap), the compact/expanded repetition band around `FILMSTRIP_CELL_EXPAND_THRESHOLD_PX = 12`, and the diagonal partial-cut class only when `partialCycle`. Mounted in `PhysicsPaintLoopClipRail` as a sibling of the Phase 43 rail targets — rail targets/semantics untouched.
- **Task 3 — per-row and Background-row capsule mounts** (`physicsPaintLoopClipPresentation.ts` + test, `PhysicsPaintTrackRow.tsx`, `PhysicsPaintWorkflowStrip.tsx`, CSS, commit `cfccefa4`): each non-active row receives capsule paint through a new `loopCapsules` prop (data from the store's memoized `getTrackRotoResolutionContext`, projected through the shared presentation module — no resolver math in the strip), the active lane keeps the full rail + capsule, and the Bg row projects `FrameClip` records through the new `projectBackgroundFrameLoopClipCapsule` (RESEARCH A3 — clip facts only, infinite bounded by the visible window, null when outside).
- 12 new behavior tests (4 presentation shortened-state + 3 Background projection + 5 capsule component), 8 files touched, full suite 2890 → 2902 passed (3 files skipped), tsc exit 0.

## Known deviations / notes

- **Row geometry** — the plan's UI-SPEC quoted 48px rows / 36px pitch, but the UAT-approved geometry in place is 30px rows / 18px pitch (ROW_CELL_WIDTH_PX 18). The capsule cell width therefore follows the approved 18px pitch; the spec's 48px value is stale.
- **Task 3 single commit** — the Task-3 tests (Background projection + per-row mount) landed in the same commit as the implementation (`cfccefa4`) rather than a standalone RED commit; the shared shortened-state surface was already RED-first from Task 1, and the whole suite was green (2902 passed) at plan close.
- **TrackRow beyond the plan's file list** — the plan's `files_modified` omitted `PhysicsPaintTrackRow.tsx`; the per-row mount needed the new presentational `loopCapsules` prop there (row stays presentational, full-frame interactive rail remains active-track-only).
- `projectPhysicsPaintLoopClipFragmentPresentation` re-slices `tooltipLines.slice(0,5)`, so fragment views drop the interruption line — intentional; fragment projection is out of scope.

## Task Commits

1. **Task 1: capsule presentation shortened state** — `9a325551` (test RED) → `8ed16d97` (feat)
2. **Task 2: filmstrip capsule component** — `4d8895c3` (test RED) → `d81e2e68` (feat; component + test + rail mount + CSS)
3. **Task 3: per-row and Background-row capsule mounts** — `cfccefa4` (test + feat in one commit)
