# Requirements: EFX-Motion Editor

**Defined:** 2026-11-06
**Milestone:** v2.1.0 Rail Motion, Timeline Zoom, Vector Painting & Curve Editing
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v2.1.0 Requirements

Each maps to exactly one roadmap phase.

### Motion — core (Phase 59)

- [x] **MOTN-01**: User can add, edit, and remove Motion keys on any rail — Standard, Motion, Static, Reveal, and bare Key Rails — with no conversion step and no cycle value
- [x] **MOTN-02**: Motion keys are independent of drawing keys; a rail with no drawing key animates, and adding or removing a Motion key never creates or alters a drawing key
- [x] **MOTN-03**: User can animate Position (grouped whole-position, or split X + Y channels), Scale, Rotation, and Opacity
- [x] **MOTN-04**: Channels open on demand, one at a time; no lane appears by default
- [x] **MOTN-05**: Motion lives in rail-local time — keys are positioned relative to the rail start and survive moving or repeating the rail
- [x] **MOTN-06**: Repeat semantics are observable — motion holds at the last key or fits the full occurrence
- [x] **MOTN-07**: The rail transform is applied at the compositor: one raster per track per frame, content cycles while motion continues, and nothing re-bakes
- [x] **MOTN-08**: Edit view, Play, and export produce the same transform, including when the rail is on the active track
- [x] **MOTN-09**: Rotation is unbounded (0°/360°/720° are distinct keys), values hold outside the keyed range, and the pivot is time-invariant in rail space
- [x] **MOTN-10**: Ease, Wiggle, and Hold attach only to Motion keys — never to drawing keys or the rail body — and Wiggle is seeded and deterministic at export
- [x] **MOTN-11**: Three selection scopes work independently — rail, drawing key, motion key — each with its own contextual commands
- [x] **MOTN-12**: Motion persists through save → close → reopen, with undo/redo per key operation

### Motion — v7 interface (Phase 59)

- [x] **MUI-01**: A track with motion shows the coloured chevron (`chevron-right` collapsed); expanding flips it to `chevron-down`; a track with no motion shows the grey `minus`
- [x] **MUI-02**: Channel rows render 18px lanes with a header cluster (icon, label, "N keys", previous/diamond/next), 16×18 rounded cells, 1.5px curves, and 6×6 Motion keys with the lighter type rim
- [x] **MUI-03**: The rounded bright outline wraps the rail row plus its expanded channels, and does not render when collapsed
- [x] **MUI-04**: Switching rail selection collapses the previous block — one open rail block at a time
- [x] **MUI-05**: Header column and lanes stay aligned while scrolling, including the 2px post-block gap; the reorder insertion indicator uses measured row offsets and never lands inside a channel block
- [x] **MUI-06**: Previous/next move the cursor to the adjacent Motion key; the diamond adds or removes a Motion key at the current frame; when an action is unavailable it is disabled with a real visible reason, never a silent no-op

### Timeline zoom (Phase 60)

- [x] **ZOOM-01**: Cmd/Ctrl+wheel zooms timeline frame density, keeping the frame under the cursor fixed
- [x] **ZOOM-02**: A zoom pill offers minus / percent / plus / 100%-reset (square-dimensions icon); presets are 0.25×, 0.5×, 0.75×, 1×, 1.5×, 2×, 3×, 4×; 100% equals the 18px pitch; every pill action keeps the playhead frame fixed, falling back to viewport centre
- [x] **ZOOM-03**: Row, lane, and cell heights stay fixed — only horizontal frame density scales
- [x] **ZOOM-04**: Zoom is a UI preference only — remembered per paint layer across Studio reopens (the Studio window is destroyed on close) and never written to the document, schema, project persistence, or export output
- [x] **ZOOM-05**: Every frame→pixel consumer (playhead, ruler, hit-testing, drag, scrub, selection, paste, sound stains, scroll-to-frame, rail geometry) reads one pitch authority — no local `× 18`

### Vector painting tool (Phase 61)

- [x] **VEC-01**: `pen-tool` draws a vector stroke with corner and smooth points
- [ ] **VEC-02**: `spline-pointer` edits the path — anchors, coupled handles, handle break, insert, delete, and multi-select
- [x] **VEC-03**: Stroke width can vary per vertex
- [ ] **VEC-04**: Brush type and colour are per stroke
- [x] **VEC-05**: A wireframe preview toggle shows strokes and paths without render, and serves as the drag-time performance mode
- [x] **VEC-06**: Vector strokes persist in the `.mce`, survive reopen, and export
- [ ] **VEC-07**: Undo/redo covers each vector operation

### Painted-stroke curve editing (Phase 62)

- [ ] **CRV-01**: User can select a painted stroke and enter curve mode, with anchors fitted on entry
- [ ] **CRV-02**: Editing anchors and handles commits as one ledger entry and re-bakes from the recovered pre-script base rather than deforming cached pixels
- [ ] **CRV-03**: Every loop occurrence of the edited stroke is invalidated together
- [ ] **CRV-04**: Undo cancels or settles an in-flight bake

### Delivery law (all phases)

- [x] **REL-01**: No new runtime dependencies
- [x] **REL-02**: Every new `.mce` field round-trips byte-identically through save → reopen, pinned by a test
- [x] **REL-03**: Motion joins the canonical document revision; sampled values never enter the flattened cache key
- [x] **REL-04**: Motion-blur export keeps paint on every frame — integer content raster with a fractional transform

## Decisions locked

- **Gate B (rail identity):** motion attaches to **any** rail. No cycle, no conversion, no gating. The durable ownership mechanism is Phase 59 planning work and must satisfy MOTN-01, MOTN-05, and MOTN-12.
- **Channel set:** Position (grouped or split X/Y), Scale, Rotation, Opacity — Scale ships despite its absence from the v7 mockup.
- **Curve model:** one evaluator; the user-facing set is Hold plus an eased/smoothed interpolation. No B-spline on motion channels (an approximating basis misses its keys).
- **Naming:** the new field is not called `motion` — that name belongs to `PhysicPaintRotoScriptMotionSettings`, which is a separate system and is not merged.

## Future Requirements

Deferred to a later milestone. Not in the current roadmap.

- Full graph/curve editor with per-key Bézier handles as the primary UI
- Skew, 3D, and perspective channels
- Per-vertex colour with segment semantics
- Copy/paste of Motion keys across rails
- On-canvas spatial motion path (Bézier) editing
- Zoom-to-selection and adaptive ruler labels at extreme zoom
- Vertex snapping and width-profile presets
- Multiple simultaneously expanded motion blocks
- Thumbnails inside timeline cells at zoom

## Out of Scope

| Feature | Reason |
|---------|--------|
| Studio API/MCP | Own v2.2.0 milestone (Phase 63), designed against the shipped v2.1.0 model |
| Per-vertex brush *type* | No reference implementation in any comparable tool |
| Baking motion into drawing keys or frame caches | Breaks the compositor law and forces re-bakes |
| Constraining Motion keys to drawing keys | Superseded by the v3 model |
| Silent auto-key on every transform | Unrequested document mutation |
| Five independent curve engines selectable per vertex | Permanent schema weight for no user value |
| Re-running the watercolour sim on every pointer move | Non-deterministic and infeasible at drag rate |
| Auto-vectorising existing paint strokes | Destroys the painted medium; conversion must be explicit |
| Persisting timeline zoom in `.mce` | Session-only view state, like canvas zoom |
| Merging rail motion with `PhysicPaintRotoScriptMotionSettings` | Different evaluation point, lifetime, and semantics |
| Seconds/frames equivalence, Studio canvas zoom | Shipped in v2.0.1 (261105-cgl, 261104-uyv) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOTN-01 | Phase 59 | Complete |
| MOTN-02 | Phase 59 | Complete |
| MOTN-03 | Phase 59 | Complete |
| MOTN-04 | Phase 59 | Complete |
| MOTN-05 | Phase 59 | Complete |
| MOTN-06 | Phase 59 | Complete |
| MOTN-07 | Phase 59 | Complete |
| MOTN-08 | Phase 59 | Complete |
| MOTN-09 | Phase 59 | Complete |
| MOTN-10 | Phase 59 | Complete |
| MOTN-11 | Phase 59 | Complete |
| MOTN-12 | Phase 59 | Complete |
| MUI-01 | Phase 59 | Complete |
| MUI-02 | Phase 59 | Complete |
| MUI-03 | Phase 59 | Complete |
| MUI-04 | Phase 59 | Complete |
| MUI-05 | Phase 59 | Complete |
| MUI-06 | Phase 59 | Complete |
| ZOOM-01 | Phase 60 | Complete |
| ZOOM-02 | Phase 60 | Complete |
| ZOOM-03 | Phase 60 | Complete |
| ZOOM-04 | Phase 60 | Complete |
| ZOOM-05 | Phase 60 | Complete |
| VEC-01 | Phase 61 | Complete |
| VEC-02 | Phase 61 | Pending |
| VEC-03 | Phase 61 | Complete |
| VEC-04 | Phase 61 | Pending |
| VEC-05 | Phase 61 | Complete |
| VEC-06 | Phase 61 | Complete |
| VEC-07 | Phase 61 | Pending |
| CRV-01 | Phase 62 | Pending |
| CRV-02 | Phase 62 | Pending |
| CRV-03 | Phase 62 | Pending |
| CRV-04 | Phase 62 | Pending |
| REL-01 | Phase 59 (enforced first; holds across Phases 59–62) | Complete |
| REL-02 | Phase 59 (re-enforced on Phase 61's vector fields) | Complete |
| REL-03 | Phase 59 (motion joins the canonical document revision) | Complete |
| REL-04 | Phase 59 (motion-blur export keeps paint) | Complete |

**Coverage:**
- v2.1.0 requirements: 38 total (12 MOTN + 6 MUI + 5 ZOOM + 7 VEC + 4 CRV + 4 REL)
- Mapped to phases: 38
- Unmapped: 0
- Per phase: Phase 59 = 22 (MOTN-01..12, MUI-01..06, REL-01..04); Phase 60 = 5 (ZOOM-01..05); Phase 61 = 7 (VEC-01..07); Phase 62 = 4 (CRV-01..04)
- Delivery law: REL-01..04 are cross-cutting but attached to Phase 59, the phase where each is first enforced — REL-01 holds for all four phases, REL-02 is re-enforced on every Phase 61 vector field, REL-03 covers motion only, REL-04 is Phase 59's motion-blur export parity

---
*Requirements defined: 2026-11-06*
*Traceability updated: 2026-11-06 — mapped to Phases 59-62 for milestone v2.1.0*
