# Requirements: EFX-Motion Editor

**Defined:** 2026-06-08
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v0.8.0 Requirements

Requirements for the Standalone Physics Paint milestone. This milestone proves `packages/efx-physic-paint` can run and be tested standalone before any EFX Motion Editor integration.

### Runnable Standalone Demo

- [x] **RUN-01**: User can start standalone physics paint from the repo root with a documented pnpm command.
- [x] **RUN-02**: User can iterate on the standalone demo with Vite/Preact HMR while the library build remains separate.
- [x] **RUN-03**: User can follow README instructions that match the actual package scripts.

### Interactive Physics Paint Testing

- [x] **PAINT-01**: User can paint on a live physics canvas using the local `@efxlab/efx-physic-paint` package.
- [x] **PAINT-02**: User can change core paint settings such as color, brush size, opacity, and available physics controls.
- [x] **PAINT-03**: User can use at least paint and erase tools through the real engine APIs.
- [x] **PAINT-04**: User can test efx-physic-paint as a separate physics paint tool without replacing perfect-freehand basic paint or p5.brush FX paint.
- [x] **DIAG-01**: User can see engine readiness, canvas/session state, active settings, and errors while testing.

### Physics Paint UI Rebuild

- [x] **UI-REBUILD-01**: User can use a rebuilt physics paint package UI with clear layout, modern controls, and polished interaction states.
- [x] **UI-REBUILD-02**: Rebuilt UI remains standalone-package-first and does not add editor integration scope beyond rendered-output proof artifacts.

### Standalone Persistence and Output

- [x] **SAVE-01**: User can save the standalone paint session as JSON.
- [x] **SAVE-02**: User can reload saved JSON and continue testing the same paint session.
- [x] **OUT-01**: User can export the current rendered paint result as a PNG or still image.
- [x] **OUT-02**: User can produce a frame-sequence or cache-manifest proof from the live engine for future editor consumption.

### Physics Paint Roto Automatic Live Pixel Caching

The former Phase 36.6 save-on-leave lifecycle was superseded by quick task `260714-ail`.

- [x] **36.6-AC-01**: Roto navigation remains immediate and does not block on manual save or save-on-leave rendering.
- [x] **36.6-AC-02**: Each completed visible Roto mutation automatically captures immutable flattened alpha pixels for its source real frame.
- [x] **36.6-AC-03**: The accepted source-frame revision appears in the correct cache and timeline position.
- [x] **36.6-AC-04**: Returning to the source frame shows the latest accepted cached result.
- [x] **36.6-AC-05**: Roto requires no `Save current`, save-pending, saving, retry, or navigation-blocking UI.
- [x] **36.6-AC-06**: Rapid same-frame and cross-frame mutations use source-bound monotonic revisions so stale work cannot overwrite newer pixels.
- [x] **36.6-FB-01**: Failed or stale background cache work does not discard visible editable state or publish over a newer mutation, Undo, or Clear.

### Physics Paint Roto Missing Background Preview Export

- [x] **36.10-MISSING-TRANSPARENT**: Missing Roto frames can render transparent without accidental paint content.
- [x] **36.10-MISSING-BACKGROUND**: Missing Roto frames can render paper/background-only without paint content or baked real-key alpha cache pixels.
- [x] **36.10-PREVIEW-EXPORT-PARITY**: Preview and export use the same Roto missing-frame and real-key paper compositing rules.

### Physics Paint Roto Paint Script Reuse

- [ ] **ROTO-SCRIPT-COPY**: User can copy the current live recorded paint script into active-session memory, with source-bound completed mutations keeping it current until navigation freezes the snapshot.
- [ ] **ROTO-SCRIPT-APPLY**: User can repeatedly apply the copied script to real or true empty Roto frames through existing deterministic Deform/Move replay, Undo/Redo, and automatic pixel-cache publication.

These functional requirements are owned by a dedicated GSD quick that must pass native UAT before Phase 36.14 begins. Phase 36.14 only presents and wires the resulting controller contract.

### Physics Paint Roto Deterministic Physical Timeline and Final UI Integration

The former active Phase 36.14 UI-only contract (`36.14-PENCIL-LAYOUT`, `36.14-CONTROL-GROUPING`, `36.14-VISUAL-STATES`, `36.14-LOG-ROUTING`, `36.14-SELECTION-GUARD`, and `36.14-REGRESSION`) is superseded by the single physical-model contract below; its still-valid UI and regression outcomes are retained under `36.14-UI-INTEGRATION` and `36.14-UAT-THEN-REGRESSION`.

- [x] **36.14-PHYSICAL-IDENTITY**: Every durable real Roto key has one stable `keyId`, one direct physical `appFrame`, and identity-owned payload that stays together across edits, persistence, cache publication, reopen, preview, export, rollback, Undo, and Redo; no source/display compatibility or migration authority remains.
- [x] **36.14-DERIVED-INTERPOLATION**: Roto persists only interpolation enabled state and derives exactly `max(0, rightFrame - leftFrame - 1)` strict interior generated cells from adjacent physical real keys, with no leading/trailing generation and no timing effect on real keys.
- [x] **36.14-ATOMIC-FRAME-MAPPING**: Insert, Delete, Drag, Force Spacing, Undo, and Redo use one complete validated `keyId -> appFrame` transaction with immutable snapshot staging, one parent publication, exact matching acknowledgement, accepted-only history, and complete rollback on rejection, timeout, transport failure, launch replacement, or disposal.
- [x] **36.14-RIPPLE-INSERT-DELETE**: Insert Frame shifts the selected identity and all later real keys right by one physical slot without creating a key, while Delete Frame removes the selected identity and slot and shifts later survivors left by one; both preserve surviving identity-owned payload, validate capacity before mutation, select deterministically, and record one accepted Undo/Redo action.
- [x] **36.14-RIPPLE-DRAG**: Drag performs deterministic ripple cut-and-insert by stable identity and uses the same complete-map resolver for preview and acknowledged commit. Occupied before/after boundaries remove only the moved identity, preserve its source gap, and ripple only at the destination (`before D`: `A@1,C@5,B@8,D@9`; `after D`: `A@1,C@5,D@8,B@9`), while empty/generated whole-cell destinations preserve source-closing direct-frame behavior (`frame 6`: `A@1,C@4,B@6,D@8`).
- [x] **36.14-FORCE-SPACING**: A session-only nonnegative integer `N` plus explicit **Apply** action creates exactly `N` empty physical slots between adjacent ordered real keys, anchors the first key, accepts `N = 0`, rejects invalid or over-capacity results without state/history changes, and records one accepted Undo/Redo action on success.
- [x] **36.14-DOWNSTREAM-PARITY**: Persistence, launch/reopen, live cache publication, playback, onion/reference, preview, export, missing/background rendering, and timeline length consume stable identities, direct physical frames, and runtime-derived interiors without reviving source/display ownership.
- [x] **36.14-UI-INTEGRATION**: The final Roto timeline follows the corrected compact reference with fixed ruler/cell proportions and synchronized horizontal scrolling; keeps transport, quick key actions, interpolation/Force Spacing, cadence, and `Copy Script | Apply Script` in distinct visible groups; omits Tools/header Log/obsolete Save controls and a permanent developer legend; clearly presents real, generated, empty/background, current, disabled, active, destructive, and complete ripple-preview states; routes concise latest-operation status to the header capsule and full detail to the existing right-panel LOG; keeps unavailable script controls focusable with controller-supplied reasons; relocates Discard Script to the Scripts toolbar; and prevents accidental chrome text selection while preserving inputs, editable fields, and LOG text selection.
- [x] **36.14-UAT-THEN-REGRESSION**: Under D-30's current rejected-UAT recovery track, Plans 21-27 complete production gap fixes using bounded static checks only, Plan 28 performs integrated bounded static read-only review, and Plan 29 is the user-owned native UAT gate. No tests, test discovery, typecheck, build, package command, server, browser, or native process is run by Plans 21-28. Only after the user's exact native approval may separate later regression/typecheck/build planning become eligible; that approval does not automatically execute or unlock Plans 13-18, create `36.14-12-APPROVAL.txt`, alter Validation flags, or complete the phase.

### Physics Paint Roto Timeline Final UI Integration

Presentation-only integration of the approved 36.15 UI-SPEC over the 36.14 physical contract; base contract is the 36.14 UI-SPEC, complement spec `SPECS/36.x-phases/phase-36.15-final-ui/spec-36.15-final-ui.md` (C-01..C-06) wins on conflict.

- [ ] **36.15-STRIP-GEOMETRY**: The workflow strip implements the Fixed Layout Contract: fixed 155px strip (bands 46/1/28/38/28/14), locked header hierarchy, fixed 18px abutting timeline cells in a derived 2160px lane, 54px fixed-pitch ruler ticks, 14px synchronized scrollbar band, fit-content non-wrapping context action row, no responsive height override, and horizontal scroll below minimum host width.
- [x] **36.15-GROUP-SEPARATION**: Control groups render as visually distinct gray-background pill groups with minimum 5px spacing around each divider: playback (loop/fps), interpolation (lucide `blend` icon, no border), apply-key-spacing (lucide `align-horizontal-space-around` before the number), key space — per complement spec C-01..C-03.
- [x] **36.15-ICON-ACTIONS**: The bottom timeline action row is icon-only with tooltips per complement spec C-05 (`between-vertical-start`, `copy-plus`, `clipboard-copy`, `clipboard-paste`, `trash-2`, `clipboard`, `clipboard-pen`, `clipboard-x`); Discard Script lives in the right-panel Scripts toolbar.
- [x] **36.15-STATUS-CAPSULE**: The bottom cell-states legend area is removed (C-06); an elastic truncating header status capsule replaces the permanent status stack; LOG tab remains the only detailed diagnostic surface.
- [x] **36.15-LAYER-KEY-MARKERS**: Paint keys are visually marked on the EFX Motion layer (C-04).
- [x] **36.15-SELECTION-GUARD**: The application selection guard exists in `app/index.html` with the exact exception list, preserving inputs, editable fields, and LOG text selection.
- [x] **36.15-SCRIPT-CONTROLS**: Guarded Script controls stay in order and focusable with controller-supplied unavailable reasons; all wiring consumes existing controller/resolver seams with no business logic in the view.

## Implemented Integration Baseline

The former future integration seam was implemented during the v0.8.0 Roto recovery phases and is now baseline behavior.

- [x] **EDIT-01**: User can create a Physics Paint layer/session from EFX Motion Editor.
- [x] **EDIT-02**: User can launch or reopen the Physics Paint surface from the editor.
- [x] **EDIT-03**: Editor receives rendered Physics Paint stills and frame sequences through the typed parent/window bridge.
- [x] **EDIT-04**: Editor composites cached Physics Paint frames in preview and export.
- [x] **EDIT-05**: Physics Paint cache, background, interpolation, and source/display metadata persist through project save/load.

## Out of Scope

Still explicitly excluded from v0.8.0.

| Feature | Reason |
|---------|--------|
| Replacing perfect-freehand | Basic fast/direct paint remains a production layer type. |
| Replacing p5.brush | FX brush paint remains a production layer type. |
| Headless batch adapter replay | Prior phases proved this destroys physics quality and creates O(n²) behavior. |
| Removing existing paint dependencies | Existing basic/FX paint paths must remain available. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUN-01 | Phase 34 | Complete |
| RUN-02 | Phase 34 | Complete |
| RUN-03 | Phase 34 | Complete |
| PAINT-01 | Phase 35 | Complete |
| PAINT-02 | Phase 35 | Complete |
| PAINT-03 | Phase 35 | Complete |
| PAINT-04 | Phase 35 | Complete |
| DIAG-01 | Phase 35 | Complete |
| UI-REBUILD-01 | Phase 36 | Complete |
| UI-REBUILD-02 | Phase 36 | Complete |
| SAVE-01 | Phase 36 | Complete |
| SAVE-02 | Phase 36 | Complete |
| OUT-01 | Phase 36 | Complete |
| OUT-02 | Phase 36 | Complete |
| 36.6-AC-01 | Phase 36.6 | Complete |
| 36.6-AC-02 | Phase 36.6 | Complete |
| 36.6-AC-03 | Phase 36.6 | Complete |
| 36.6-AC-04 | Phase 36.6 | Complete |
| 36.6-AC-05 | Phase 36.6 | Complete |
| 36.6-AC-06 | Phase 36.6 | Complete |
| 36.6-FB-01 | Phase 36.6 | Complete |
| 36.10-MISSING-TRANSPARENT | Phase 36.10 | Complete |
| 36.10-MISSING-BACKGROUND | Phase 36.10 | Complete |
| 36.10-PREVIEW-EXPORT-PARITY | Phase 36.10 | Complete |
| EDIT-01 through EDIT-05 | Phases 36.1–36.13 | Complete |
| ROTO-SCRIPT-COPY | Dedicated pre-36.14 GSD quick | Pending |
| ROTO-SCRIPT-APPLY | Dedicated pre-36.14 GSD quick | Pending |
| 36.14-PHYSICAL-IDENTITY | Phase 36.14 | Complete |
| 36.14-DERIVED-INTERPOLATION | Phase 36.14 | Complete |
| 36.14-ATOMIC-FRAME-MAPPING | Phase 36.14 | Complete |
| 36.14-RIPPLE-INSERT-DELETE | Phase 36.14 | Complete |
| 36.14-RIPPLE-DRAG | Phase 36.14 | Complete |
| 36.14-FORCE-SPACING | Phase 36.14 | Complete |
| 36.14-DOWNSTREAM-PARITY | Phase 36.14 | Complete |
| 36.14-UI-INTEGRATION | Phase 36.14 | Complete |
| 36.14-UAT-THEN-REGRESSION | Phase 36.14 | Complete |
| 36.15-STRIP-GEOMETRY | Phase 36.15 | Planned |
| 36.15-GROUP-SEPARATION | Phase 36.15 | Complete |
| 36.15-ICON-ACTIONS | Phase 36.15 | Complete |
| 36.15-STATUS-CAPSULE | Phase 36.15 | Complete |
| 36.15-LAYER-KEY-MARKERS | Phase 36.15 | Complete |
| 36.15-SELECTION-GUARD | Phase 36.15 | Complete |
| 36.15-SCRIPT-CONTROLS | Phase 36.15 | Complete |

**Coverage:**

- v0.8.0 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-07-25 after registering the Phase 36.15 requirement IDs assigned during planning*
