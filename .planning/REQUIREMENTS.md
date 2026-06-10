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

### Standalone Persistence and Output

- [ ] **SAVE-01**: User can save the standalone paint session as JSON.
- [ ] **SAVE-02**: User can reload saved JSON and continue testing the same paint session.
- [ ] **OUT-01**: User can export the current rendered paint result as a PNG or still image.
- [ ] **OUT-02**: User can produce a frame-sequence or cache-manifest proof from the live engine for future editor consumption.

### Future Integration Seam

- [ ] **SEAM-01**: Developer has typed contracts for future transport/cache messages without implementing editor integration in this milestone.
- [ ] **SEAM-02**: Developer has architecture notes explaining how later EFX Motion Editor integration will consume rendered standalone outputs as cached frames.
- [ ] **TEST-01**: Browser/manual smoke tests prove the standalone demo runs, accepts pointer input, and exports output.

## Future Requirements

Deferred to later milestones.

### Editor Integration

- **EDIT-01**: User can create a physics paint layer/session from EFX Motion Editor.
- **EDIT-02**: User can launch or reopen the standalone physics paint surface from the editor.
- **EDIT-03**: Editor receives rendered physics paint stills or frame sequences through a transport path.
- **EDIT-04**: Editor composites cached physics paint frames in preview and export.
- **EDIT-05**: Physics paint sessions persist in `.mce` or paint sidecar data.

## Out of Scope

Explicitly excluded from v0.8.0.

| Feature | Reason |
|---------|--------|
| EFX Motion Editor layer integration | v0.8.0 proves the standalone package first; editor integration should start after standalone validation. |
| Tauri child-window IPC | Runtime app-to-window transport belongs with editor integration, likely v0.9.0. |
| `.mce` physics paint persistence | Requires editor integration and project-format decisions. |
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
| SAVE-01 | Phase 36 | Pending |
| SAVE-02 | Phase 36 | Pending |
| OUT-01 | Phase 36 | Pending |
| OUT-02 | Phase 36 | Pending |
| SEAM-01 | Phase 37 | Pending |
| SEAM-02 | Phase 37 | Pending |
| TEST-01 | Phase 37 | Pending |

**Coverage:**

- v0.8.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 after v0.8.0 roadmap creation*
