---
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
plan: 01
subsystem: ui
tags: [preact, signals, physics-paint, timeline, multi-track, preview-renderer, store]

# Dependency graph
requires:
  - phase: 46-internal-multi-track-timeline-filmstrip-capsules-and-control
    provides: InternalPaintTrack/BackgroundTrack document model, store mutation + notify idiom, requestDeleteTrack/commitDeleteTrack delete surface
provides:
  - Track CRUD store ops (addTrack, renameTrack, duplicateTrack, reorderTrack)
  - Hide/solo/opacity/blend per-track setters with per-track revision bump
  - resolvePhysicPaintTrackVisibility hide/solo truth table in the preview renderer
  - Document-order multi-row timeline strip with the mockup header column + rows region redesign (140px pinned header, 48px rows, Bg row last)
affects: [47-02, 47-03, 47-04, 47-05]

# Actuals (#2632) — pairs with the plan's `estimate` (tokens 75000, tasks 3).
# estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 42238    # chars/4 over the 168,952-char realized diff
  tasks: 3
  commits: 11

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Store mutation + notify: fail-closed validation -> immutable next document -> _documents.set -> _notifyChange (per-op, TDD)"
    - "Per-track revision bump via bumpTrackRevision for visible/solo/opacity/blend (non-docrev terms)"
    - "Row-based strip: per-row trackId threaded through every read; header components hook-free for viewport harness"

key-files:
  created: []
  modified:
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/efxPaintStore.test.ts
    - app/src/lib/previewRenderer.ts
    - app/src/lib/previewRenderer.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts

key-decisions:
  - "Rows render in document order (not active-first); the active lane renders in place via an extracted renderActiveLane() closure"
  - "Header components are hook-free so the viewport harness can invoke PhysicsPaintTrackRow/Header as plain functions; rename edit-in-place state lives in the strip"
  - "Whole-track duplicate reuses duplicateTrack(layerId, trackId) from Task 2; new/duplicated tracks become active"
  - "Delete path uses requestDeleteTrack preview then commitDeleteTrack(layerId, trackId, true); last-track refusal published to the status capsule"
  - "PhysicsPaintStudioView.tsx passes the workflow props object wholesale, so the CRUD/visibility wiring landed in PhysicsPaintStudio.tsx's multiTrackRowBundle instead (no PhysicsPaintStudioView.tsx change needed)"

patterns-established:
  - "Header-strip contract: pinned 140px column, Tracks N badge + add button strip, 48px per-row headers, Bg row locked/last"
  - "Rows region sizes to content (N rows + Bg x 48px), vertical scroll on overflow, single shared horizontal scroller at strip level"

requirements-completed: [TML-01, TML-02, TML-03, TML-04, TML-05, TML-08]

coverage:
  - id: D1
    description: "Multi-row strip vertical slice — every InternalPaintTrack renders as a 48px row plus exactly one Bg row; per-row reads route through the row's own trackId; row-click sets the active track"
    requirement: TML-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts#renders rows in document order with the active lane highlighted in place (mockup redesign)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts#per-row reads"
        status: pass
    human_judgment: false
  - id: D2
    description: "Track CRUD store ops (addTrack, renameTrack, duplicateTrack, reorderTrack) — fail-closed, UUID-identity, write-through serialize/hydrate round-trip"
    requirement: TML-02
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#track CRUD tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hide/solo/opacity/blend per-track setters with per-track revision bump and no documentRevision bump"
    requirement: TML-04
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#setter tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolvePhysicPaintTrackVisibility hide/solo truth table applied at the top of resolvePhysicPaintFrameSource; hide wins over solo; soloed-out active track resolves null"
    requirement: TML-04
    verification:
      - kind: unit
        ref: "app/src/lib/previewRenderer.test.ts#hide/solo truth table"
        status: pass
    human_judgment: false
  - id: D5
    description: "Mockup header strip + rows region redesign (140px pinned column, Tracks N badge, per-row header tools, active accent, Bg row last) and Studio wiring of CRUD + visibility buttons"
    requirement: TML-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts#header order matches rows 1:1"
        status: pass
    human_judgment: true
    rationale: "Structural layout and button wiring are test-proven, but visual fidelity to the approved tracks-ui.html mockup (spacing, hover affordances, tool glyph rendering) requires human visual sign-off in native UAT."

# Metrics
duration: 3h 45m
completed: 2026-08-24
status: complete
---

# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls — Plan 1 Summary

**Multi-row Paint timeline slice: document-order rows with per-row reads and active selection, full track CRUD + hide/solo/opacity/blend store ops with the hide/solo truth table, plus the approved mockup header strip (140px pinned column, Tracks badge, per-row tool buttons, Bg row last)**

## Performance

- **Duration:** 3h 45m (wall-clock span 18:27–22:12 +02:00; includes an interleaved conversation-compaction gap)
- **Started:** 2026-08-24T18:27:23+02:00
- **Completed:** 2026-08-24T22:12:13+02:00
- **Tasks:** 3 (plan tasks; plus the user-approved design-direction slice folded into Task 1 surface)
- **Files modified:** 12

## Accomplishments

- Multi-row strip: every `InternalPaintTrack` renders as a 48px row (plus exactly one Bg row), each row reading its own `trackId` through `getRotoPhysicalRenderSource`/`getFrame` — no fallback to the active track; frame cells stay 18px pitch.
- Row-click active selection: clicking a row header calls `setActiveTrackId(layerId, trackId)`; the active row gets the 3px `#6F90FF` accent border, blue-family tint, and bold name — distinct from selection orange and rail purple/cyan.
- Track CRUD store ops (`addTrack`, `renameTrack`, `duplicateTrack`, `reorderTrack`) — fail-closed result unions, UUID identity (never array position), auto-names 'Paint 1'/'Paint 2'/' Copy'/' Copy 2', write-through `serializeRuntimeIntoDocument`/`hydrateRuntimeFromDocument`.
- Per-track setters (`setTrackVisible`, `setTrackSolo`, `setTrackOpacity`, `setTrackBlend`) bump the per-track revision (cache invalidation) without bumping documentRevision.
- `resolvePhysicPaintTrackVisibility` implements the locked truth table at the top of `resolvePhysicPaintFrameSource`: no solo -> all visible; solo -> visible+soloed only; hide wins over solo; a hidden or soloed-out active track resolves an empty preview (null).
- Mockup header redesign (user-approved direction): 140px pinned column with a top "Tracks" strip (title + `Tracks N` count badge + '+' add), per-row 48px headers (6-dot reorder grip, ellipsis name + tooltip, hover-visible eye/pencil/copy/trash buttons, rename edit-in-place), Bg row LAST with checkerboard icon + 'Bg' label + lock semantics (no reorder grip, delete/duplicate guarded), rows region sized to content (max 141px) with a single shared horizontal scrollbar at the strip level.
- CRUD + visibility wired end-to-end in `PhysicsPaintStudio.tsx` (`multiTrackRowBundle` + handlers), including the last-track delete refusal published to the status capsule.

## Task Commits

Each task was committed atomically (TDD: test commit then feat commit):

1. **Task 1: Multi-row strip vertical slice** — `5679e1f4` (test RED), `67ac5e16` (feat), `238aeaa9` (fix: 140px pinned header, per-row labels, 48px Bg header, distinct rows band)
2. **Task 2: Track CRUD store ops** — `01d7778b` (test RED), `d96f4e8f` (feat)
3. **Task 3: Hide/solo/opacity/blend setters** — `08514d88` (test RED), `343fc6f0` (feat)
4. **Design-direction slice (user-approved)** — `3eee318a` (feat: mockup header strip and rows region redesign), `0ab1ec92` (feat: wire track CRUD + visibility buttons)
5. **Test hardening** — `da947596` (refactor-resistant source-order assertions), `16647c3c` (viewport document-order regression test)

**Plan metadata:** committed on plan completion.

## Files Created/Modified

- `app/src/stores/efxPaintStore.ts` - addTrack, renameTrack, duplicateTrack, reorderTrack + setTrackVisible/solo/opacity/blend (fail-closed, immutable, per-track revision)
- `app/src/stores/efxPaintStore.test.ts` - RED/GREEN tests for both store task groups (10 behavior tests)
- `app/src/lib/previewRenderer.ts` - resolvePhysicPaintTrackVisibility + hide/solo filter call at top of resolvePhysicPaintFrameSource (loop-placeholder branch byte-unchanged)
- `app/src/lib/previewRenderer.test.ts` - hide/solo truth-table tests (incl. hide-wins-over-solo ordering)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - rows region (document-order, active lane in place via renderActiveLane()), header column rewritten to strip + per-row headers, shared horizontal scroller, CRUD/rename props
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` - new row + hook-free header components (grip, name, tools, Bg lock, edit-in-place rename input)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - source-order snapshot tests made refactor-resistant
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` - multi-row harness tests (27 tests)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - CRUD/visibility/delete handlers + wiring in multiTrackRowBundle + workflow spread
- `app/src/components/physic-paint/physicsPaintStudio.css` - strip/header/row/tool/Bg redesign styles
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx`, `PhysicsPaintTopBar.test.ts` - minor source-order assertion updates

## Decisions Made

- **Document-order rows, not active-first** — the active lane renders in place via an extracted `renderActiveLane()` closure that captures the whole scope, so no prop-drilling refactor was required and header/rows match 1:1 (mockup-faithful).
- **Header components are hook-free** — the viewport harness invokes `PhysicsPaintTrackRow`/`PhysicsPaintTrackRowHeader` as plain functions; rename edit-in-place state lives in the strip (`useState`) and flows down as props, with focus/select handled by a callback ref.
- **Whole-track duplicate reuses the Task 2 store op**; new/duplicated tracks become active.
- **Delete path** uses `requestDeleteTrack` preview then `commitDeleteTrack(..., true)`; the last-track refusal publishes the exact guard copy to the status capsule.
- **PhysicsPaintStudioView.tsx untouched** — it spreads the whole workflow object, so wiring landed in `PhysicsPaintStudio.tsx`'s `multiTrackRowBundle` (no interface change required).

## Deviations from Plan

### User-Approved Scope Change

**1. [User-directed] Header strip + rows region redesign to match tracks-ui.html mockup**
- **Found during:** Execution (master prompt for this slice)
- **Issue:** The plan's task-1 141px band + simple active-first lanes was replaced by the user-approved mockup direction: pinned 140px header column, "Tracks" strip with count badge and add button, 48px per-row headers with hover tools, Bg row last with lock semantics, rows region sized to content.
- **Fix:** Rewrote the header column to `PhysicsPaintTrackColumnStrip` + per-row headers, extracted the active lane into `renderActiveLane()`, added CRUD/rename/visibility props, and rewired in `PhysicsPaintStudio.tsx`.
- **Files modified:** PhysicsPaintWorkflowStrip.tsx, PhysicsPaintTrackRow.tsx, PhysicsPaintStudio.tsx, physicsPaintStudio.css, PhysicsPaintWorkflowStrip.viewport.test.ts
- **Committed in:** `3eee318a`, `0ab1ec92` (+ `da947596`, `16647c3c` test hardening)

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-order snapshot tests broke after the lane extraction**
- **Found during:** Task 1 / design slice
- **Issue:** Extracting the ~330-line active lane into `renderActiveLane()` moved the `physics-paint-lane` class physically ahead of the ruler in source, so the two source-order tests that asserted `laneIndex > scrollIndex` / `physicalLaneIndex > rulerIndex` returned -1 or failed.
- **Fix:** Anchored both tests to the `renderActiveLane()` mount point / function body, preserving their intent (rail + cells inside the lane; action row / scrollbar outside the scroll container).
- **Files modified:** PhysicsPaintWorkflowStrip.test.ts
- **Verification:** `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` passes
- **Committed in:** `da947596`

**2. [Rule 3 - Blocking] TS18048 'props.tracks' possibly undefined inside `.map` callback**
- **Found during:** Design slice (rows region wiring)
- **Issue:** TypeScript cannot narrow the object property across the callback, so `props.tracks.length` errored.
- **Fix:** `deletable={(props.tracks?.length ?? 0) > 1}`.
- **Files modified:** PhysicsPaintWorkflowStrip.tsx
- **Committed in:** `3eee318a`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3) + 1 user-approved design change
**Impact on plan:** All fixes were necessary for correctness of the changed surface. The design change was explicitly user-approved. No scope creep.

## Issues Encountered

- A node-script extraction bug (`newRows is not defined`) during the lane extraction — corrected the variable reference; no code impact.
- CSS hover typo (`#455a5c` -> `#45505c`) caught and fixed during the redesign.
- The `PhysicsPaintStudioView.tsx` plan file list did not match reality (wiring landed in `PhysicsPaintStudio.tsx`); no behavior impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The multi-row render + active-selection contract is proven; plan 47-02 can build the full vertically scrollable layout (ensure-active-row-visible auto-scroll, pinned header during vertical scroll) on top of the document-order rows region.
- Track CRUD ops and setters are stable, fail-closed, and write-through, so 47-02/47-05 (drag reorder) and 47-04 (filmstrip capsules + Bg row full surface) can consume them directly.
- The hide/solo truth table is locked at a single point (`resolvePhysicPaintTrackVisibility`), so preview/right-panel opacity/blend binding (Phase 48) plugs in without touching the filter.

---
*Phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control*
*Completed: 2026-08-24*

## Self-Check: PASSED

- SUMMARY file exists at `.planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-01-SUMMARY.md`
- All 11 task commits verified in git history (5679e1f4, 67ac5e16, 238aeaa9, 01d7778b, d96f4e8f, 08514d88, 343fc6f0, 3eee318a, 0ab1ec92, da947596, 16647c3c)
- Full suite green (149 files / 2847 tests passed), `pnpm --dir app exec tsc --noEmit` exit 0
- `previewRenderer.ts` byte-unchanged across the design-slice commits (hide/solo truth table and loop-placeholder branch preserved)

---

## UAT Round 2 (2026-08-24)

User-reported visual issues in the mockup timeline redesign, fixed with presentation-only changes (no `efxPaintStore` ops, no `previewRenderer` truth-table edits).

**Commits:**
- `b67bf62b` — `fix(47-01): restore full frame-capacity horizontal scroll on the rows region` (Issue 2)
- `b8f4d72b` — `fix(47-01): tighten row packing, restore hover tools, drop fake scrollbar, fix empty add icon` (Issues 1, 3, 4, 5)

**Per-issue root cause + fix:**
1. **Row vertical spacing too large** — shared cell height was 24px inside the locked 48px row, leaving ~12px dead gray per side. Cell height now 44px (2px rhythm above/below); the region and first row drop their top border so the cells sit flush under the ruler line.
2. **Horizontal scroll void at window width** — the `.physics-paint-rows-region` was a viewport-width block child (`width: auto`, `overflow-x: hidden`), so per-track cells clipped at the visible window while the ruler and active lane reached full capacity. The region now carries the same explicit `rotoLaneWidthPx` width/minWidth, and every presentational track-row cells grid mirrors it, so tracks scroll to the last cell with the ruler.
3. **Fake static vertical bar at the strip's right end** — the region's styled 6px webkit scrollbar rendered as a decorative bar. It is now hidden; the only visible vertical scroll control is a slim 6px native scrollbar on the pinned header-rows band, which overflows exactly when the region does (real control, never decorative).
4. **Hover state unreadable** — the tools group's dark right-to-left gradient washed a veil over the track name and the tool buttons were transparent (`color: #a9b0b8`). Gradient removed; buttons got solid `#3a424c` surfaces + `#58616b` borders + `#d8dde3` icons; header hover background lightened to `#3f4145`.
5. **'+' add button rendered empty** — the Plus icon at `size={12}` was clipped/invisible in the 18px button. Now `size={11}` + `strokeWidth={2.5}`, `padding: 0; line-height: 0`, and `svg { flex: 0 0 auto }`.

**Test adjustments:**
- `PhysicsPaintWorkflowStrip.test.ts` — two source-contract assertions updated from the old `height: 24px` to the new `height: 44px` (intended UAT geometry).
- `PhysicsPaintWorkflowStrip.viewport.test.ts` — new assertion: a 600-frame document's rows-region and every presentational track-row cells grid carry the full `capacity × 18px` width/minWidth.

**Verification:** viewport + previewRenderer (43 tests), efxPaintStore (26 tests), full suite (2848 passed / 1 skipped / 101 todo), `pnpm exec tsc --noEmit` exit 0.
