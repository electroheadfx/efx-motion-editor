# Requirements: EFX-Motion Editor — v2.0.1

**Defined:** 2026-11-03
**Milestone:** v2.0.1 — Rail Editing & v7 Timeline Rails (PATCH)
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v2.0.1 Requirements

PATCH scope: two rail-editing regressions plus the approved v7 timeline-rail interface. No new module, no `.mce` schema change, no unrelated audit debt.

### Rail Editing (RAIL)

- [x] **RAIL-01**: User can open Edit Rail for a normal Key Rail — selected (or double-clicked) in the Studio timeline — from the sidebar, using the same Edit Rail entry point loop clips already use.
- [ ] **RAIL-02**: The Key Rail Edit Rail modal shows only the cycle count and the Infinity checkbox, prefilled at 1 for both a finite count and the infinite state; no script, motion, or reveal controls are shown.
- [x] **RAIL-03**: Confirming the modal converts the selected Key Rail segment into a provenance-free Standard loop clip — `sourceKeyIds` = the segment's keys in frame order, `placementStart` = the segment's first key frame, no `scriptId`, no `railKind`, no `motion` — and the keys become loop-owned; the Key Rail segment no longer renders and the rail presents as a Standard cycle.
- [x] **RAIL-04**: Cancelling the Key Rail Edit Rail modal performs zero writes (no store mutation, no revision bump, no undo entry).
- [x] **RAIL-05**: The Key Rail → cycle conversion is exactly one undo step: Undo restores the original Key Rail segment with its keys and Redo re-applies the conversion; cancel and refusal leave the ledger untouched.
- [x] **RAIL-06**: A single-key drag works on Motion/Static/Reveal loop clips under the law chosen at discuss-phase — preferred A: allowed when exactly one loop references the key (an independent cycle), while a key referenced by more than one loop keeps D-11 and the locked rigid-group copy; B (unlink + whole-cycle Force Spacing) and C (propagate retime to every linked loop) are the alternatives. Shared linked-cycle behavior is never silently relaxed.
- [x] **RAIL-07**: The new rail-editing behavior is regression-locked: resolver tests cover the conversion and the drag law, undo/redo pins cover both directions, existing D-11 guard tests remain green (or are deliberately updated with the chosen law), and no `.mce` schema field is added or changed.

### v7 Timeline Rails (VIS)

- [ ] **VIS-01**: The timeline shows four rail types with the locked v7 palettes — Standard green, Motion orange, Static violet, Reveal azure — where the selected rail uses the bright palette and every other rail (including other rails of the active track) uses the dim palette; no orange appears on any rail, track accent, or rail line.
- [ ] **VIS-02**: Paint rows are 30px; frame cells are 16×22 with radius 3 and a 2px gap on the 18px pitch, starting 6px below the row top; the rail line is a 4px radius-2 pill at the very top of the row, spanning `frames × 18 − 2` and extending to the viewport edge when clipped.
- [ ] **VIS-03**: Only four cell states render — `key` (rail key fill + lighter rim), `interp` (dark cell + rail-line contour + centred 12×2 dash, between keys only), `cycle` (gray fill/border by cycle-2/cycle-3 parity + a 4px rail-colour dot, never a dash), and `empty` (`#252A30` / `#3A4047`).
- [ ] **VIS-04**: Timeline surfaces match the locked darks (card `#171A1E`, header column `#1E2226`, ruler `#24282E`, rows `#1E2125`, Tracks strip `#2B2F34`, Bg lane `#1B1F24`); ruler ticks are centred on the cells with 10px normal labels; the playhead is blue `#2868FC` with a 12×10 radius-2 handle; the content gutter is 6px.
- [ ] **VIS-05**: The selected track header stays `#2B4BB5` and carries a 3px accent in the selected rail's bright colour (fallback `#8A939C`); unselected headers are `#333536`; the Bg header is `#3C3E40` with a 9px `#6F7883` label; tool chips are 16×16; every header shows an inert 14×14 grey `minus` motion slot with `aria-disabled`.
- [ ] **VIS-06**: Two juxtaposed rails keep their own palettes and selection — selecting one never recolours the other.
- [ ] **VIS-07**: Every existing gesture still works: cell select/navigate, key-rail select/drag, loop-clip select/drag, rail-set move, cross-track drag, Bg clip move/resize, scrub, and playback. No store, document, `.mce`, or persistence change.
- [ ] **VIS-08**: Resolver unit tests (`.test.ts` only) cover rail-type mapping, palette selection, cycle parity, the cell-state matrix, owning-rail precedence, and the `frames × 18 − 2` geometry; `vitest run` is green and no dependency is added.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Motion channels (Position/Rotation/Opacity lanes, curves, nav cluster, selected-rail rounded outline) | Belong to v2.1.0 per `SPECS/v2.1.0-motion-channels/`; v2.0.1 is the rail surface they build on |
| `.mce` schema, document/store, project package, persistence changes | The cycle conversion reuses the existing Loop Clip record; no new persisted field |
| New module, engine, or paint surface | v2.0.1 is a PATCH |
| Unrelated v2.0.0 audit debt (dead `efx-spectral`, dual paper fingerprint, DF-01..04, phase 54/55 review advisories) | Explicitly excluded by the user; separate future work |
| Redoing the locked v7 palette, geometry, or "no orange" decisions | The design package is approved; README §7 defaults all apply |
| A separate "Add cycle" toolbar action | Replaced by extending the existing Edit Rail flow to Key Rails |
| New dependencies, DOM snapshot tests | Spec constraint; resolvers are tested as pure functions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAIL-01 | Phase 58 | Complete |
| RAIL-02 | Phase 58 | Pending |
| RAIL-03 | Phase 58 | Complete |
| RAIL-04 | Phase 58 | Complete |
| RAIL-05 | Phase 58 | Complete |
| RAIL-06 | Phase 58 | Complete |
| RAIL-07 | Phase 58 | Complete |
| VIS-01 | v7 quick (in-milestone) | Pending |
| VIS-02 | v7 quick (in-milestone) | Pending |
| VIS-03 | v7 quick (in-milestone) | Pending |
| VIS-04 | v7 quick (in-milestone) | Pending |
| VIS-05 | v7 quick (in-milestone) | Pending |
| VIS-06 | v7 quick (in-milestone) | Pending |
| VIS-07 | v7 quick (in-milestone) | Pending |
| VIS-08 | v7 quick (in-milestone) | Pending |

**Coverage:**
- v2.0.1 requirements: 15 total (RAIL 7 + VIS 8)
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-03*
*Last updated: 2026-11-03 after initial definition*
