---
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
plan: 05
subsystem: ui
tags: [preact, signals, physics-paint, timeline, multi-track, cross-track-drag, pointer-capture, moveTrackItems, status-capsule]

# Dependency graph
requires:
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 01
    provides: the per-track memoized store context (getTrackRotoResolutionContext), the Key Rail / Loop Clip rail targets with Phase 43 locked semantics, keyRailSegments + loopResolutionContext in the strip
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 02
    provides: the multi-track rows region with per-row data-track-id lanes and the pinned header reorder grab column OUTSIDE the rows-region (D-18 separation), 18px cell pitch (ROTO_CELL_WIDTH_PX), 30px rows (STRIP_ROW_HEIGHT_PX), timeline scroll container
  - phase: 46
    provides: physicPaintStore.moveTrackItems (D-08/D-09 cross-track move, fail-closed reasons 'track-missing'/'duplicate-destination-frame'/'partial-loop-overlap'/'empty-set'/'missing-key'/'apply-failed'), the status-capsule publication path (publishStatus / setApplyStatus) and the Phase 46 paste rejection UX the rejections mirror
provides:
  - `usePhysicsPaintCrossTrackDrag` (Task 1, TML-05/D-15/D-16): the plain-drag cross-row gesture with NO modifier — any existing draggable (real key, Key Rail, Loop Clip Rail, rail-set member) crosses from its source row into a destination row; the hook exposes read-only signals `destinationTrackId` / `insertionFrame` / `isCrossing` that the strip renders as the destination highlight + live insertion preview, and NEVER mutates any document during the gesture (byte-unchanged until release)
  - Pure geometry helpers `computeCrossTrackDestination` (row bounds + pointerY → destination trackId; source row resolves to the source trackId = no crossing) and `computeInsertionFrame` (pointerX + scrollLeft against the 18px pitch, clamped at 0) — exported and unit-proven
  - Takeover mechanics: the first row-boundary crossing sets pointer capture on the rows-region; the previous capture holder (the same-row drag's source element) receives lostpointercapture and cancels non-committing, so no same-row drag can commit to a target on another row (D-15/D-16 plain-drag preservation)
  - The strip source-resolution authority (D-17 membership never re-derived): real key cells resolve directly; rails resolve their segment/range by first-frame; a rail-set move member hands the WHOLE explicit set; the header reorder grab (47-02) lives outside the rows-region and never starts the gesture (D-18)
  - The commit + rejection path (Task 2, TML-05/D-17): a crossed release calls physicPaintStore.moveTrackItems(layerId, fromTrackId, toTrackId, keys) exactly once; { ok: true } publishes the English move summary ('Moved N key(s) to another track.'); { ok: false, reason } publishes the fixed English reason map ('Track not found' / 'Destination frame is occupied' / 'Loop would be partially moved' / 'Nothing to move' / 'Key not found', generic 'Move failed.' fallback) and flips the capsule's red warning triangle via setApplyStatus('error') — identical to the Phase 46 paste rejection UX
  - The action bundle now forwards setApplyStatus alongside publishStatus, so strip-level gestures can drive the capsule tone (the strip already renders capsuleIsError from Studio's applyStatus state)
affects: [48-internal-compositor, 49-fixed-background-and-imported-loop-clips, 50-photo-reference-track]

# Actuals — pairs with the plan's `estimate` (tokens 65000, tasks 2, confidence low).
# estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 12847     # chars/4 over the 51,388-char realized diff (298a7bd0..HEAD, 6 files, +946/-2)
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook never computes move semantics: usePhysicsPaintCrossTrackDrag holds only the gesture (destination + frame + signals); the commit port is the minimal structural view CrossTrackMoveResult = {ok:true} | {ok:false, reason?} and the strip wires the bound store closure — copy-paste-delete stays in moveTrackItems (D-09/D-17)"
    - "Store-port-injection contract: the hook is decoupled from the store by construction; unit tests double the port with a spy that applies D-09 fresh identities ('key-1' → 'key-1-fresh') and a configured rejection, asserting byte-identical rows on failure"
    - "Read-only gesture state: destination signals render feedback only; the gesture never mutates a document — the tests snapshot the document mid-gesture and assert byte-unchanged until release (T-47-05-04)"
    - "Pointer-capture takeover as same-row-drag cancellation: on row-boundary crossing the rows-region takes capture; the previous holder (same-row drag) receives lostpointercapture and cancels non-committing — no targeted mutation (D-15/D-16)"
    - "Optional windowLike fallback: the hook mounts with windowLike: undefined and falls back to the real window — node-env contract tests render the strip without a global window (the same pattern as the other drags; passing window directly regressed 42 tests in Task 1)"

key-files:
  created:
    - app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts

key-decisions:
  - "The hook's commit surface is a store port, not an onCommit callback: the Task 2 release handler calls the injected moveTrackItems(layerId, fromTrackId, toTrackId, keys) and maps the result through buildCrossTrackMoveSuccessMessage / mapCrossTrackMoveRejection — the hook never computes copy-paste-delete itself (D-09/D-17)"
  - "Rejection copy is the plan's fixed English map verbatim (track-missing → 'Track not found', duplicate-destination-frame → 'Destination frame is occupied', partial-loop-overlap → 'Loop would be partially moved', empty-set → 'Nothing to move', missing-key → 'Key not found'); unmapped or missing reasons publish the generic 'Move failed.' — never empty or French (D-14, T-47-05-03)"
  - "The success capsule line mirrors the Phase 46 paste style with a count: 'Moved 1 key to another track.' / 'Moved N keys to another track.' (buildCrossTrackMoveSuccessMessage)"
  - "The red warning triangle needs the tone port: Phase 46 paste rejections set the tone inside the coordinator (RotoTimelineActionsInput.setApplyStatus); the strip-level gesture reaches the store directly, so RotoPhysicalTimelineActionBundle now forwards setApplyStatus alongside publishStatus (Studio already wires both at the bundle input)"
  - "Source resolution authority lives in the strip (D-17): data-roto-key-id / data-rail-first-frame with the rail discriminator classes / the rail-set move members; the hook never re-derives membership"
  - "The frame-preview math is pure and exported: computeInsertionFrame(pointerX, scrollLeft, zoom, framePitch) clamps at 0 and scales with zoom — the strip passes the 18px pitch and the timeline's scrollLeft"
  - "CSS-presence assertions live in the unit tests (cssRule reads physicsPaintStudio.css); the Task 2 reason map and the success builder are exported from the hook module so the D-14 copy is testable"

patterns-established:
  - "Gesture hook with injected store port: usePhysicsPaintCrossTrackDrag exposes read-only signals + one entry point (onPointerDown) + a release handler that commits through the injected move call — no document access, no move math"
  - "D-18 disjoint gestures: the header reorder grab (47-02) and the content cross-track drag have disjoint grab areas (the grip is outside the rows-region) and the source resolver only resolves content draggables; tests assert the grip handler contains no moveTrackItems/crossTrackDrag and that a grab-area release never reaches the store"

requirements-completed: [TML-05]

coverage:
  - id: D1
    description: "Cross-track drag gesture (TML-05, D-15/D-16) — any existing draggable crosses rows with NO modifier, exposing destinationTrackId/insertionFrame/isCrossing read-only signals; the destination row highlights and the live insertion preview shows the landing frame; the document is byte-unchanged during the gesture; a same-row drag stays plain; the header reorder grab never starts the gesture"
    requirement: TML-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#captures the destination row and live insertion frame when the pointer crosses, without mutating the document (D-16)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#keeps a same-row drag plain: no preview, no commit, no capture when the pointer never crosses (D-16)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#clears the crossing signals when the pointer returns to the source row"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#computeCrossTrackDestination (47-05 Task 1, TML-05/D-16) > resolves the row below the source to that row trackId"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#computeInsertionFrame (47-05 Task 1, TML-05/D-16) > resolves the frame from the pointer X against the 18px pitch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#wires the cross-track gesture ONLY through the rows-region capture listener, never through the header reorder grab (D-18)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Commit via moveTrackItems and rejection publication (TML-05, D-17/D-09) — a crossed release calls physicPaintStore.moveTrackItems exactly once with source/destination/keys (fresh identities in the destination, source items removed), success publishes the English move summary; a rejected move leaves both rows byte-identical and publishes the fixed English reason with the red via setApplyStatus('error'); no-crossing and grab-area releases call nothing (D-16/D-18)"
    requirement: TML-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#commits the move through moveTrackItems exactly once on a crossed release — source loses the items, the destination gains fresh identities (D-09)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#a rejected move leaves both rows byte-identical and publishes the specific English reason with the red warning triangle (D-17)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#maps every moveTrackItems rejection reason to a fixed English message and falls back to a generic failure (T-47-05-03)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#never calls moveTrackItems when the release never crossed a row boundary — the same-row drag owns it (D-16)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#never reaches moveTrackItems when the press resolved no draggable source — the header reorder grab path owns it (D-18)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#routes the crossed release through physicPaintStore.moveTrackItems and publishes through the action bundle (D-17)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#keeps the header reorder grab release completely outside the cross-track commit (D-18)"
        status: pass
    human_judgment: false

# Metrics
duration: 2h
completed: 2026-08-25
status: complete
---

# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls — Plan 5 Summary

**Every Paint-track draggable now crosses rows with a plain drag: read-only destination highlight + live insertion preview, a single moveTrackItems commit with fresh identities on release, English rejections through the status capsule's red triangle, and the header reorder drag strictly separated — the last plan of the phase**

## Performance

- **Duration:** 2h (wall-clock across the two execution sessions; commit timestamps 2026-08-25)
- **Completed:** 2026-08-25
- **Tasks:** 2 (plan tasks; RED+GREEN per task)
- **Commits:** 4 (1 test RED + 1 feat per Task)
- **Files:** 6 (2 created, 4 modified) — plan listed 5 files; the bundle port (`useRotoTimelineActions.ts`) was added to expose the tone setter

## Accomplishments

- **Task 1 — cross-track drag gesture** (`usePhysicsPaintCrossTrackDrag.ts` + test, commits `c157f2c7` test + `4733513e` feat): a row-drag gesture that any existing draggable (real keys, Key Rails, Loop Clip Rails, rail sets) enters when crossing row boundaries. The pure helpers compute the destination row from pointer Y and the landing frame from the pointer X against the 18px pitch with scrollLeft and zoom; read-only signals drive the destination highlight and the live insertion preview; the takeover capture on the rows-region cancels the same-row drag non-committing (lostpointercapture). The strip mounts the gesture with a source resolver that reads pressed-element data attributes only (membership is never re-derived, D-17), and the header reorder grab (outside the rows-region) never reaches the gesture (D-18).
- **Task 2 — commit via moveTrackItems + rejection publication** (commits `e9efcebe` test + `12f65a8d` feat): a crossed release calls `physicPaintStore.moveTrackItems(layerId, fromTrackId, toTrackId, keys)` exactly once with the captured destination and keys. `{ ok: true }` publishes the English success line with the count; `{ ok: false, reason }` publishes the fixed English reason map and flips the capsule tone via `setApplyStatus('error')` — identical to the Phase 46 paste rejection UX (D-17). No-crossing and grab-area releases call nothing (D-16/D-18). The bundle now forwards `setApplyStatus` alongside `publishStatus` (the strip drives the triangle directly from the gesture).
- 19 new tests (3 destination + 3 insertion-frame + 2 copy + 11 hook behavior in the hook suite; 5 strip wiring/source contracts), 6 files touched, full suite 2916 → 2924 passed (1 skipped, 101 todo), tsc exit 0.

## Known deviations / notes

- **Bundle port beyond the plan's files list** — the plan's Task 2 files omit `useRotoTimelineActions.ts`; the red warning triangle requires the strip to toggle `applyStatus`, which the bundle only exposed as `publishStatus` (message-only). The bundle type gained `setApplyStatus?: (status) => void` forwarded alongside `publishStatus`, exactly the same port the coordinator's rejections use — no new pattern.
- **Task 1 regression guard** — the strip mounts the gesture with `windowLike: undefined` (hook falls back to the real window): passing `window` directly regressed 42 node-env contract tests in Task 1 (no global window in those suites) — fixed before GREEN.
- **Test counts** — the Task 1 suite went from 11 tests to 17 in Task 2 RED (2 copy + 4 commit/rejection added, 3 Task 1 assertions switched from `onCommit` to the store port).

## Task Commits

1. **Task 1: cross-track drag gesture** — `c157f2c7` (test RED) → `4733513e` (feat; hook + strip mount + TrackRow props + CSS)
2. **Task 2: commit via moveTrackItems and rejection publication** — `e9efceb` (test RED) → `12f65a8d` (feat; release handler + reason map + strip wiring + bundle port)
