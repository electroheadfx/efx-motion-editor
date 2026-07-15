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

### Physics Paint Roto Timeline UI Integration

- [ ] **36.14-PENCIL-LAYOUT**: The final Roto timeline follows the corrected visual reference for color, proportions, hierarchy, ruler, cells, and compact fit-content actions while runtime geometry remains projection-driven.
- [ ] **36.14-CONTROL-GROUPING**: Transport, quick key actions, interpolation, fps, and the quick-delivered script actions are visibly distinct; Tools/header Log and obsolete Save controls are absent.
- [ ] **36.14-VISUAL-STATES**: Real, generated, empty/background, current, disabled, active, and destructive states remain clear without a permanent developer legend.
- [ ] **36.14-LOG-ROUTING**: The timeline shows concise latest-operation status while errors and detail appear in the existing right-panel LOG tab.
- [ ] **36.14-SELECTION-GUARD**: Application chrome resists accidental browser text selection while inputs, editable fields, and Log text remain selectable.
- [ ] **36.14-REGRESSION**: Phase 36.9–36.13 behavior, exact Undo/Redo, the approved script workflow, and rapid-stroke/cooperative-finalization contracts remain unchanged.

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
| 36.14-PENCIL-LAYOUT | Phase 36.14 | Pending |
| 36.14-CONTROL-GROUPING | Phase 36.14 | Pending |
| 36.14-VISUAL-STATES | Phase 36.14 | Pending |
| 36.14-LOG-ROUTING | Phase 36.14 | Pending |
| 36.14-SELECTION-GUARD | Phase 36.14 | Pending |
| ROTO-SCRIPT-COPY | Dedicated pre-36.14 GSD quick | Pending |
| ROTO-SCRIPT-APPLY | Dedicated pre-36.14 GSD quick | Pending |
| 36.14-REGRESSION | Phase 36.14 | Pending |

**Coverage:**

- v0.8.0 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-07-15 after extracting functional Roto paint-script reuse into a dedicated pre-36.14 GSD quick*
