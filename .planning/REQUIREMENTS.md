# Requirements: EFX-Motion Editor

**Defined:** 2026-08-23
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v1.0.0 Requirements

Requirements for milestone v1.0.0 (EFX Paint Multi-Track Frames and Reveal). Each maps to a roadmap phase. Source spec: `SPECS/milestone-v1.0.0-plan.md` (locked).

### DOC — Document & Clean Cutover (Phase 1)

- [x] **DOC-01**: New v1.0 parent Paint layer owns exactly one versioned EFX Paint document with stable internal track IDs, document revision, and active track ID
- [x] **DOC-02**: Every new v1.0 EFX Paint document starts with one fresh default Paint track and one fixed Background track with configured fallback
- [ ] **DOC-03**: Pre-v1.0 Paint project data fails explicitly as unsupported without partial mutation or fallback rendering
- [ ] **DOC-04**: No legacy one-track schema reader, converter, renderer, cache path, or compatibility branch remains reachable
- [ ] **DOC-05**: Save/reopen preserves new document, track, Loop Clip, source asset, and cache identity
- [ ] **DOC-06**: Main-editor sequence timing and outer layer composition remain unchanged

### TRK — Track-local State (Phase 2)

- [ ] **TRK-01**: Each internal Paint track owns its Paint frames, Roto real keys, generated interpolation, Script Motion, and PlayScript output
- [ ] **TRK-02**: Each internal Paint track owns linked Hold Loop Clips and a shared Loop Clip resolver (modulo, finite/infinite repeat, next-clip interruption)
- [ ] **TRK-03**: Each internal Paint track has its own revision and dirty state with track-aware cache invalidation
- [ ] **TRK-04**: Copy/cut/paste/duplicate/clear/undo/redo operations are track-aware
- [ ] **TRK-05**: Async PlayScript/Reveal operations revalidate parent, document, and track revision before commit
- [ ] **TRK-06**: Editing one track never changes another track's real keys or caches; stale async work cannot commit to another selected track
- [ ] **TRK-07**: Track deletion cannot orphan accepted assets silently
- [ ] **TRK-08**: Editing one Hold source frame updates every linked occurrence without duplicating assets

### TML — Multi-track Timeline (Phase 3)

- [ ] **TML-01**: EFX Paint Studio shows a vertically scrollable multi-row Paint timeline with internal Paint track rows
- [ ] **TML-02**: User can add, rename, duplicate, delete, and reorder internal Paint tracks
- [ ] **TML-03**: User can select the active Paint track; the active track is always visually unambiguous
- [ ] **TML-04**: User can hide/solo Paint tracks and set internal track opacity and blend mode
- [ ] **TML-05**: Frame keys/caches show on the correct row; Paint/Roto/PlayScript/Cut/Copy/Paste/drag route to the active track
- [ ] **TML-06**: Hold Loop Clips show as adaptive filmstrip capsules (source cycle, linked repetition band, ×N/∞, requested/effective duration, partial-cycle interruption)
- [ ] **TML-07**: One visually distinct fixed Background row sits beneath Paint rows with imported clips, gaps/fallback, and "clip suivant — interrompt la boucle" label
- [ ] **TML-08**: Track CRUD survives save/reopen; reorder changes compositor order but not track identity

### CMP — Internal Compositor (Phase 4)

- [ ] **CMP-01**: One shared internal composition path resolves all Paint tracks into one deterministic per-frame flattened raster for Studio preview and flattened output
- [ ] **CMP-02**: Internal hide/solo truth table is applied (no solo → all visible; solo → visible+soloed only; hide wins over solo)
- [ ] **CMP-03**: Internal track opacity and blend mode are applied once inside EFX Paint; parent opacity/blend is applied once by the main editor (never double-applied)
- [ ] **CMP-04**: Track cache key includes track revision and composition dependencies; parent cache invalidates when any participating track/clip/source/fallback changes
- [ ] **CMP-05**: Missing source/asset states are explicit and recoverable
- [ ] **CMP-06**: The pixel acceptance matrix passes (opaque/semi-transparent/multiply/screen/overlay/add, hidden/soloed, empty upper frame, Background loops, gaps, parent opacity/blend)

### BKG — Background Track (Phase 5)

- [ ] **BKG-01**: Exactly one fixed Background track per EFX Paint document, beneath all Paint tracks, contributing to flattened output
- [ ] **BKG-02**: User can import one still image or an ordered image sequence as a Background clip (source cycle)
- [ ] **BKG-03**: Background clips are sequential and non-overlapping; move/insert reject or snap collisions
- [ ] **BKG-04**: User can set start frame and finite repeat count (1..∞) or infinity per clip
- [ ] **BKG-05**: Loop resolution follows cycleLength × repeatCount, bounded by next clip start and parent end; next clip interrupts without overlap after full or partial cycle
- [ ] **BKG-06**: Gaps reveal the document fallback (solid color or transparency)
- [ ] **BKG-07**: Source-frame references remain linked across all repetitions; no durable asset duplication
- [ ] **BKG-08**: Undo/redo clip creation, move, repeat changes, import references, deletion, and fallback changes by reference
- [ ] **BKG-09**: Imported clips, source order, IDs, repeats, gaps, fallback, and effective rendering survive save/reopen

### REF — Photo/Reference Track (Phase 6)

- [ ] **REF-01**: One photo/reference track per EFX Paint document with stable source identity and revision
- [ ] **REF-02**: Photo/reference track supports reference-only, reveal-source, and masked-transform-source modes
- [ ] **REF-03**: Reference-only visibility is excluded from ordinary flattened Paint output
- [ ] **REF-04**: Source revision invalidates dependent Reveal/transformation results; missing source is visible and recoverable
- [ ] **REF-05**: Save/reopen preserves source identity and mode

### AUD — Audio Preview (Phase 7)

- [ ] **AUD-01**: Main-editor audio remains authoritative and read-only during EFX Paint playback
- [ ] **AUD-02**: All internal Paint tracks share one application-frame playback cursor; audio monitoring follows it
- [ ] **AUD-03**: Local monitoring On/Off does not mutate source audio; closing Studio releases audio resources
- [ ] **AUD-04**: Multi-track Paint playback remains synchronized with main-editor audio (seek, loop, pause, resume, stop)

### RVL — Reveal (Phase 8)

- [ ] **RVL-01**: One offscreen source-plus-mask compositor shared by Studio and flattened output reveals the photo source through internal Paint/PlayScript coverage
- [ ] **RVL-02**: Empty mask reveals nothing; full mask reveals the entire source; partial alpha produces soft edges; eraser removes coverage
- [ ] **RVL-03**: Progressive PlayScript reveals progressively; static/hold PlayScript preserves the completed reveal
- [ ] **RVL-04**: Reveal result is written to or represented by an internal Paint/result track and included in flattened output
- [ ] **RVL-05**: Photo reference visibility alone never leaks into output; hide/solo/opacity/blend around Reveal behave predictably
- [ ] **RVL-06**: Undo/redo by reference, not raster-byte snapshots; save/reopen and export preserve the result

### ACC — Integrated Acceptance (Phase 9)

- [ ] **ACC-01**: All automated gates pass (vitest, typecheck, build, cargo test, release script preflight)
- [ ] **ACC-02**: Native UAT validates the full 17-step surface (document init, legacy rejection, track CRUD, Background loops, fallback, Reveal, save/reopen, main-editor parity)
- [ ] **ACC-03**: Release stop conditions are all not active; signed/notarized downloaded-artifact verification passes before publication

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Future

- **FUT-01**: Multiple photo/reference tracks per EFX Paint document
- **FUT-02**: Multiple Background tracks or overlapping Background clips with crossfades/transitions
- **FUT-03**: Independent transforms per internal Paint track beyond existing Paint semantics
- **FUT-04**: Advanced retiming or speed ramps on internal tracks
- **FUT-05**: Vector masks, mask tracking, or mask keyframes for Reveal
- **FUT-06**: Online AI providers or generation jobs
- **FUT-07**: Independent EFX Paint audio editing or persistence
- **FUT-08**: Rendering every internal track separately in the main editor

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New main-editor sequence tracks | Multi-track is internal to one EFX Paint document; main editor stays unchanged |
| Conversion of `Sequence.keyPhotos` into internal track collections | Main-editor key-photo streams remain outside EFX Paint |
| Migration/compatibility/rendering for pre-v1.0 EFX Paint projects | v1.0.0 is a clean format break; legacy data fails explicitly |
| Internal tracks as rows in the main-editor timeline | Internal tracks live only inside the parent Paint layer's EFX Paint document |
| Internal track timing changing main-editor sequence duration | All internal tracks share the parent application-frame axis |
| Nested internal track groups | Not in v1.0.0 MVP |
| Track effects stacks | Not in v1.0.0 MVP |
| Reordering the Background track above Paint tracks | One fixed Background row beneath all Paint tracks |
| Multiple masks per Reveal operation | One shared mask compositor in v1.0.0 |
| Online AI providers or generation jobs | Not in v1.0.0 MVP |
| Independent EFX Paint audio editing or persistence | Audio is read-only main-editor monitoring only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOC-01 | Phase 45 | Complete |
| DOC-02 | Phase 45 | Complete |
| DOC-03 | Phase 45 | Pending |
| DOC-04 | Phase 45 | Pending |
| DOC-05 | Phase 45 | Pending |
| DOC-06 | Phase 45 | Pending |
| TRK-01 | Phase 46 | Pending |
| TRK-02 | Phase 46 | Pending |
| TRK-03 | Phase 46 | Pending |
| TRK-04 | Phase 46 | Pending |
| TRK-05 | Phase 46 | Pending |
| TRK-06 | Phase 46 | Pending |
| TRK-07 | Phase 46 | Pending |
| TRK-08 | Phase 46 | Pending |
| TML-01 | Phase 47 | Pending |
| TML-02 | Phase 47 | Pending |
| TML-03 | Phase 47 | Pending |
| TML-04 | Phase 47 | Pending |
| TML-05 | Phase 47 | Pending |
| TML-06 | Phase 47 | Pending |
| TML-07 | Phase 47 | Pending |
| TML-08 | Phase 47 | Pending |
| CMP-01 | Phase 48 | Pending |
| CMP-02 | Phase 48 | Pending |
| CMP-03 | Phase 48 | Pending |
| CMP-04 | Phase 48 | Pending |
| CMP-05 | Phase 48 | Pending |
| CMP-06 | Phase 48 | Pending |
| BKG-01 | Phase 49 | Pending |
| BKG-02 | Phase 49 | Pending |
| BKG-03 | Phase 49 | Pending |
| BKG-04 | Phase 49 | Pending |
| BKG-05 | Phase 49 | Pending |
| BKG-06 | Phase 49 | Pending |
| BKG-07 | Phase 49 | Pending |
| BKG-08 | Phase 49 | Pending |
| BKG-09 | Phase 49 | Pending |
| REF-01 | Phase 50 | Pending |
| REF-02 | Phase 50 | Pending |
| REF-03 | Phase 50 | Pending |
| REF-04 | Phase 50 | Pending |
| REF-05 | Phase 50 | Pending |
| AUD-01 | Phase 51 | Pending |
| AUD-02 | Phase 51 | Pending |
| AUD-03 | Phase 51 | Pending |
| AUD-04 | Phase 51 | Pending |
| RVL-01 | Phase 52 | Pending |
| RVL-02 | Phase 52 | Pending |
| RVL-03 | Phase 52 | Pending |
| RVL-04 | Phase 52 | Pending |
| RVL-05 | Phase 52 | Pending |
| RVL-06 | Phase 52 | Pending |
| ACC-01 | Phase 53 | Pending |
| ACC-02 | Phase 53 | Pending |
| ACC-03 | Phase 53 | Pending |

**Coverage:**

- v1.0.0 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-23*
*Last updated: 2026-08-23 after initial definition*
