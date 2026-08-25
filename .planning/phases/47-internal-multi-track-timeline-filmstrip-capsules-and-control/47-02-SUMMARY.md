---
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
plan: 02
subsystem: ui
tags: [preact, signals, physics-paint, timeline, multi-track, header-column, crud, scroll]

# Dependency graph
requires:
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 01
    provides: Track CRUD store ops (addTrack/renameTrack/duplicateTrack/reorderTrack), document-order rows region, mockup header strip redesign, TRACK_NAME_CONTROL_CHAR export, requestDeleteTrack/commitDeleteTrack delete surface
provides:
  - Pinned header column surface (Tracks N strip, '+', per-row headers, eye/S/pencil/copy/trash tools, reorder grip, active accent, locked Bg row)
  - Track CRUD interactions: fail-closed rename with capsule rejections, duplicate intent, acknowledge-and-delete dialog, header-drag reorder with live insertion indicator
  - Vertical scroll machinery: pill scrollbar presence/drag, pinned column contract, exported pure computeEnsureRowScrollDelta + ensure-active-row effect
affects: [47-03, 47-04, 47-05]

# Actuals (#2632) — pairs with the plan's `estimate` (tokens 57000, tasks 3).
# estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 26980    # chars/4 over the 107,920-char realized diff (519499e8^..f3a6ab0c)
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook-free presentational components invoked as plain functions (strip owns rename/tools/delete/reorder state and flows it down as props)"
    - "Fail-closed validation before ANY store write (rename: trim -> control-char -> 64-char cap; delete: last-track refusal in the dialog)"
    - "Pure exported helper (computeEnsureRowScrollDelta) proven by direct-call tests, then wired into an effect (test the function, not the DOM)"
    - "publishStatus channel: rename/delete rejections route through the bundle's publishStatus to the capsule (same channel as the coordinator's failures)"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintDeleteTrackDialog.tsx
  modified:
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/stores/efxPaintStore.ts

key-decisions:
  - "Header column is hook-free by contract: the strip owns rename draft/tools-open/delete-preview/reorder-drag state and flows it down; the viewport + CRUD harnesses invoke it (and PhysicsPaintTrackRowHeader) as plain functions"
  - "Delete commit surface: the acknowledge-and-delete dialog's Confirm is the ONLY commitDeleteTrack call site in the strip tree; the strip's trash intent only opens a requestDeleteTrack preview (source-contract proven — the strip source must NOT contain commitDeleteTrack)"
  - "Rename rejections publish through rotoPhysicalActions.publishStatus — added publishStatus to RotoPhysicalTimelineActionBundle so the strip's status channel matches the coordinator's (the bundle now carries the input port it shares)"
  - "Geometry deviation (documented): the plan's stale 264px total / 141px rows region / 48px rows was superseded by the 47-01 UAT-approved geometry — 30px rows, dynamic strip height (124px chrome + rows, capped 270px), rows-region flex-sizing to content with overflow-y on overflow. No CSS change was needed for Task 3; the pill scrollbar + rows-region overflow already existed from 47-01 UAT rounds 4-5"
  - "Pinned header contract (plan test 4) is realized as: the .physics-paint-header-column element itself never scrolls (scrollTop stays 0, observable via the new strip-owned headerColumnRef) while the band INSIDE it scrolls 1:1 with the rows-region (approved lockstep) so header labels stay aligned with their rows"
  - "One extra effect-leg test beyond the plan's 4 (activeTrackId change scrolls the region into view, both directions) — the 4 listed tests only prove the pure helper and the scrollbar/pinned surfaces, not the auto-scroll behavior TML-03 requires"

patterns-established:
  - "CRUD intent flow: strip owns interaction state -> pure read/preview -> controller intent; the only store-direct leaves are the rename-validation constants and the delete dialog's commit"
  - "Vertical scroll trio: rows-region scroll handler (syncRowsScroll + updateVerticalScrollbar) -> pill geometry state -> header column renders the pill; pointer-capture drag on the pill mirrors the horizontal pill"
  - "ensure-active-row: pure delta helper + effect keyed on activeTrackId, reading row geometry from the DOM in content coordinates (viewport + (rowRect - regionRect))"

requirements-completed: [TML-02, TML-03, TML-05, TML-07]

coverage:
  - id: D1
    description: "Pinned header column surface — 'Tracks N' strip + '+', one 30px header cell per Paint track plus the locked Bg row, active accent, eye/S/pencil/copy/trash tools, rename grip, insertion indicator (TML-01/03/07)"
    requirement: TML-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#renders every Paint track as a row plus exactly one locked Bg row at the bottom (TML-01/07)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#active accent on the active row header and none elsewhere (D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fail-closed rename — trim, control-char rejection, 64-char cap, no store write on rejection, status published to the capsule; valid draft reaches the intent exactly once (T-47-02-01 / ASVS V5)"
    requirement: TML-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#rename rejection loop (strip harness)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Duplicate intent routing + acknowledge-and-delete dialog — requestDeleteTrack preview (frame/loop/Hold counts), commitDeleteTrack(layerId, trackId, true) exactly once, last-track refusal, cancel (D-16/D-17)"
    requirement: TML-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#opens the acknowledge-and-delete dialog and confirms with commitDeleteTrack once (D-17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Header-drag reorder — pointerdown on the grip area only, live insertion indicator, order-only commit via reorderTrack(layerId, trackId, newOrder) (T-47-02-03 / Pitfall 1, TML-05)"
    requirement: TML-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#computes the reorder insertion index (TML-05/D-08)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#routes the header-drag reorder (T-47-02-03 / Pitfall 1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Vertical scroll — pill scrollbar renders on rows-region overflow (and none when the rows fit), thumb drag scrolls the region, the pinned header column element keeps scrollTop 0 while the band follows 1:1 (TML-01/03, D-01/D-05)"
    requirement: TML-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#renders the vertical pill scrollbar on overflow (TML-01)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#keeps the header column pinned (D-01/D-05)"
        status: pass
    human_judgment: false
  - id: D6
    description: "ensure-active-row-visible — pure computeEnsureRowScrollDelta geometry table (below positive / above negative / visible 0 / taller-than-viewport clamp) plus the effect that scrolls the active row into view when activeTrackId changes"
    requirement: TML-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#computeEnsureRowScrollDelta returns a positive delta below, negative above, and 0 when fully visible"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#scrolls the rows region so the active row enters view (TML-03/D-05 effect leg)"
        status: pass
    human_judgment: false

# Metrics
duration: 3h 10m
completed: 2026-08-25
status: complete
---

# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls — Plan 2 Summary

**Pinned header column with the full track CRUD surface (rename with duplicate-flow rejections, acknowledge-and-delete dialog, header-drag reorder with a live insertion indicator), the vertical scroll machinery (pill scrollbar + pinned column contract), and ensure-active-row-visible auto-scroll — all committed TDD-atomic on the milestone branch**

## Performance

- **Duration:** 3h 10m (wall-clock span 18:03–21:13 +02:00; includes an interleaved compaction gap)
- **Completed:** 2026-08-25
- **Tasks:** 3 (plan tasks; RED+GREEN per task)
- **Commits:** 6 (3 test + 3 feat, atomic per task)
- **Files:** 2 created, 10 modified

## Accomplishments

- **Task 1 — pinned header column** (`physicsPaintTrackHeaderColumn.tsx`, commits `519499e8`/`d679269b`): hook-free 140px column outside the horizontal scroller — "Tracks N" strip + '+' add button, one 30px header per Paint track (active accent, ellipsis name + tooltip, eye hide/show, 'S' solo chip, hover tool panel with pencil/copy/trash, rename in place), and the locked 'Bg' row always last (no hover/select/reorder, checkerboard + lock). The column's header-rows band shares the rows-region's vertical scroll position.
- **Task 2 — track CRUD interactions** (`05f57267`/`4e13e88b`): fail-closed rename (trim → control-char rejection → 64-char cap, rejections published to the status capsule, valid draft reaches `onRenameTrack` exactly once), duplicate-click intent routing, the acknowledge-and-delete dialog (`PhysicsPaintDeleteTrackDialog.tsx`: `requestDeleteTrack` preview with frame/loop/Hold counts → `commitDeleteTrack(layerId, trackId, true)` exactly once on Confirm, last-track refusal disables the Confirm, Cancel aborts — the dialog is the ONLY delete-commit surface in the strip tree), and header-drag reorder (pointerdown on the grip only, live insertion indicator line, order-only `reorderTrack(layerId, trackId, newOrder)` on release).
- **Task 3 — vertical scroll + ensure-active-row** (`04125626`/`f3a6ab0c`): exported pure `computeEnsureRowScrollDelta(laneTop, laneBottom, viewportTop, viewportBottom)` (below → positive, above → negative, fully visible → 0, taller-than-viewport clamps to the row top), a deps-stable effect that scrolls the rows-region so the active row enters view whenever `activeTrackId` changes, and the strip-owned `headerColumnRef` so the pinned-column contract stays observable. The pill scrollbar, rows-region overflow, and band lockstep already existed from 47-01 UAT rounds 4-5 — Task 3 adds the auto-scroll effect and proves the surfaces.
- 5 new tests (the plan's 4 + the effect-leg test) with the pure-helper tests driven by the export import; full suite 2882 passed, tsc exit 0.

## Geometry deviation (documented)

The plan's Task 3 geometry — **264px total / 141px rows region / 48px rows** — is stale: 47-01 UAT approved **30px rows** (8px rail band + 22px cells) and a **dynamic strip height** (124px chrome + rows, capped at 270px, user-resizable). The rows region `flex: 1 1 auto` with `overflow-y: auto` and the pill scrollbar were already in place from 47-01; Task 3 needed no CSS change. Test 3's "141px rows region" is realized by the dynamic region with `clientHeight` < content overflow; the CSS continues to target the UAT-approved geometry.

## Known deviations / notes

- The plan's test 4 phrasing ("column scrollTop stays 0 while rows region scrollTop advances") is realized as: the `.physics-paint-header-column` element never scrolls (strip-owned ref) while the band inside it scrolls 1:1 with the rows-region (47-01-approved lockstep).
- `PhysicsPaintStudio`'s `handleDeleteTrack`/props.onDeleteTrack remains unused by the strip (the strip keeps the trash intent for interface compatibility; the dialog owns the commit). Cleanup deferred — no behavior impact.
- `useRotoTimelineActions` bundle gains `publishStatus` (the input port the coordinator already uses) so the strip's rename/delete rejections reach the same capsule channel; the harness stub casts the partial bundle to satisfy the full type.

## Task Commits

1. **Task 1: Pinned header column component** — `519499e8` (test RED), `d679269b` (feat)
2. **Task 2: Track CRUD interactions** — `05f57267` (test RED), `4e13e88b` (feat)
3. **Task 3: Vertical scroll + ensure-active-row-visible** — `04125626` (test RED), `f3a6ab0c` (feat)
