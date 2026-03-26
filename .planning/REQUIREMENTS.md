# Requirements: EFX-Motion Editor

**Defined:** 2026-03-26
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v0.6.0 Requirements

Requirements for v0.6.0 Various Enhancements. Each maps to roadmap phases.

### Paint Compositing

- [ ] **COMP-01**: User can composite FX paint over photos via luma matte extraction (paint without alpha)
- [ ] **COMP-02**: User can paint on a neutral gray background for improved luma matte compositing quality
- [ ] **COMP-03**: User can apply a paper/canvas texture to paint layer (tiled texture from file)
- [ ] **COMP-04**: User can load paper textures from ~/.config/efx-motion/papers/* directory
- [ ] **COMP-05**: User can select paper texture from available textures in paint properties

### Paint Interaction

- [ ] **PINT-01**: User can duplicate a stroke with Alt+move on the same frame in roto paint edit mode
- [ ] **PINT-02**: User can apply non-uniform scale to individual paint strokes
- [ ] **PINT-03**: User can edit stroke paths as bezier/spline curves in roto paint edit mode
- [ ] **PINT-04**: User can add, move, and delete bezier control points on existing strokes

### Stroke Management

- [ ] **STRK-01**: User can see a list of strokes for the current frame in roto paint edit mode
- [ ] **STRK-02**: User can reorder strokes via drag-and-drop in the stroke list
- [ ] **STRK-03**: User can delete strokes from the stroke list
- [ ] **STRK-04**: User can select strokes by clicking in the stroke list
- [ ] **STRK-05**: User can toggle stroke visibility (hide/show) in the stroke list

### UX Polish

- [x] **UXP-01**: Paint properties panel is reorganized for space optimization with cleaner buttons
- [x] **UXP-02**: New roto/paint layer is created only on isolated sequence when one is selected
- [x] **UXP-03**: Motion path shows denser interpolation dots for short sequences

## Future Requirements

### Paint Compositing (v0.7+)

- **COMP-06**: User can choose paper texture blend mode (multiply, overlay, soft-light)
- **COMP-07**: User can adjust paper texture opacity independently

### Paint Interaction (v0.7+)

- **PINT-05**: User can draw with a dedicated bezier pen tool (not just post-hoc editing)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time WebGL2 luma matte shader | Canvas 2D with caching sufficient; escalate only if profiling shows need |
| Bundled paper textures in app | User loads from Krita collection; no bundling for v0.6.0 |
| Multi-frame stroke operations | Scope to single-frame operations for v0.6.0 |
| Stroke grouping/nesting | Flat list sufficient; hierarchy adds complexity without clear benefit |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | Phase 25 | Pending |
| COMP-02 | Phase 25 | Pending |
| COMP-03 | Phase 25 | Pending |
| COMP-04 | Phase 25 | Pending |
| COMP-05 | Phase 25 | Pending |
| PINT-01 | Phase 23 | Pending |
| PINT-02 | Phase 23 | Pending |
| PINT-03 | Phase 26 | Pending |
| PINT-04 | Phase 26 | Pending |
| STRK-01 | Phase 24 | Pending |
| STRK-02 | Phase 24 | Pending |
| STRK-03 | Phase 24 | Pending |
| STRK-04 | Phase 24 | Pending |
| STRK-05 | Phase 24 | Pending |
| UXP-01 | Phase 22 | Complete |
| UXP-02 | Phase 22 | Complete |
| UXP-03 | Phase 22 | Complete |

**Coverage:**
- v0.6.0 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
