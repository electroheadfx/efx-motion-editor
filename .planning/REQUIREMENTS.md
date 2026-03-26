# Requirements: EFX-Motion Editor

**Defined:** 2026-03-25
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v0.5.0 Requirements

Requirements for milestone v0.5.0: Motion Blur & Paint Styles. Each maps to roadmap phases.

### Paint Brush FX

- [x] **PAINT-01**: User can select brush style (flat/watercolor/ink/charcoal/pencil/marker) from PaintProperties panel
- [x] **PAINT-02**: User can draw with ink brush style showing edge darkening and variable opacity overlap
- [x] **PAINT-03**: User can draw with charcoal brush style showing grain texture and scatter
- [x] **PAINT-04**: User can draw with pencil brush style showing fine-grain texture
- [x] **PAINT-05**: User can draw with marker brush style showing flat semi-transparent strokes
- [x] **PAINT-06**: User can see physically-correct color blending when overlapping strokes mix (spectral mixing: blue + yellow = green)
- [x] **PAINT-07**: User can draw with watercolor brush style showing edge bleed and paper texture
- [x] **PAINT-08**: User can adjust brush FX parameters (grain, bleed, scatter, field strength, edge darken)
- [x] **PAINT-09**: User can see flow field distortion affecting stroke paths for organic rendering
- [x] **PAINT-10**: User can see grain/texture post-effects simulating paper absorption
- [x] **PAINT-11**: Flat brush strokes render identically to current behavior (no regression)
- [x] **PAINT-12**: Paint brush FX render correctly in export pipeline
- [x] **PAINT-13**: Brush style and FX params persist in paint sidecar JSON files

### Motion Blur

- [x] **MBLR-01**: User can toggle motion blur on/off for preview playback
- [ ] **MBLR-02**: User can see per-layer directional blur based on layer movement velocity during preview
- [x] **MBLR-03**: User can adjust motion blur strength via shutter angle control (0-360 degrees)
- [x] **MBLR-04**: User can configure motion blur preview quality (off/low/medium)
- [x] **MBLR-05**: User can enable motion blur for export with configurable sub-frame count (4/8/16)
- [x] **MBLR-06**: Export renders motion blur using combined GLSL velocity blur + sub-frame accumulation
- [x] **MBLR-07**: Motion blur settings persist in project file (.mce format)
- [x] **MBLR-08**: Stationary layers are not blurred (velocity threshold skip)
- [ ] **MBLR-09**: Motion blur preview maintains smooth playback at target fps

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Paint Brush FX

- **PAINT-14**: User can create and save custom brush presets
- **PAINT-15**: User can import/export brush preset files

### Motion Blur

- **MBLR-10**: User can override motion blur per-layer (enable/disable on specific layers)
- **MBLR-11**: Motion blur preview auto-reduces quality when fps drops below threshold
- **MBLR-12**: User can visualize velocity vectors for motion blur debugging

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time watercolor fluid simulation (Navier-Stokes) | Requires dedicated physics engine, would consume entire frame budget at 24fps, conflicts with vector stroke data model |
| Full-frame velocity buffer motion blur (Strategy B) | Causes artifacts at layer boundaries, prevents per-layer override, more complex than per-layer approach |
| Wet-on-wet paint interaction | Requires per-pixel wetness state incompatible with vector stroke model; spectral mixing handles overlap at render time |
| Brush preset import/export | Premature — brush parameter space needs to stabilize first (v0.6+) |
| Motion blur on paint layers | Paint layers are frame-by-frame with no keyframe transforms; no velocity vector to compute |
| Kuwahara filter post-processing | Post-processing effect, not a brush style; belongs in GLSL shader effects pipeline if added later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAINT-01 | Phase 20 | Complete |
| PAINT-02 | Phase 20 | Complete |
| PAINT-03 | Phase 20 | Complete |
| PAINT-04 | Phase 20 | Complete |
| PAINT-05 | Phase 20 | Complete |
| PAINT-06 | Phase 20 | Complete |
| PAINT-07 | Phase 20 | Complete |
| PAINT-08 | Phase 20 | Complete |
| PAINT-09 | Phase 20 | Complete |
| PAINT-10 | Phase 20 | Complete |
| PAINT-11 | Phase 20 | Complete |
| PAINT-12 | Phase 20 | Complete |
| PAINT-13 | Phase 20 | Complete |
| MBLR-01 | Phase 21 | Complete |
| MBLR-02 | Phase 21 | Pending |
| MBLR-03 | Phase 21 | Complete |
| MBLR-04 | Phase 21 | Complete |
| MBLR-05 | Phase 21 | Complete |
| MBLR-06 | Phase 21 | Complete |
| MBLR-07 | Phase 21 | Complete |
| MBLR-08 | Phase 21 | Complete |
| MBLR-09 | Phase 21 | Pending |

**Coverage:**
- v0.5.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after initial definition*
