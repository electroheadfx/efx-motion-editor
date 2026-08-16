# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-17) added audio import with waveforms and beat sync, GLSL shader effects and transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar. v0.4.0 (Phases 18-19) added After Effects-style canvas motion path editing and frame-by-frame paint/rotopaint layers with onion skinning. v0.5.0 (Phases 20-21) added expressive brush rendering with spectral pigment mixing and per-layer GLSL velocity motion blur with sub-frame accumulation for export. v0.6.0 (Phases 22-25) added stroke management, bezier path editing, and paint workflow UX improvements. v0.7.0 (Phases 26-33) converted to a pnpm monorepo and enhanced the current paint engine with a 3-mode system, inline color picker, wireframe overlay, and stroke animation. v0.8.0 (Phases 34-38.1) proved `packages/efx-physic-paint` as a standalone interactive physics paint app/window with a deterministic physical-frame Roto timeline, multi-select group operations, Roto Script Play fusion, and render-path performance. v0.9.0 (Phases 39-44) restores automatic Scripts hydration, ships a legible macOS identity with explicit desktop build hygiene, adds read-only frame-synchronized audio preview inside EFX Paint, and delivers PlayScript static/hold application modes with color override and linked Hold Loop Clips authored through an EFX-local Integrated Loop Rail and contextual Scripts inspector.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2019-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2019-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2025-03-24)
- ✅ **v0.4.0 Canvas & Paint** — Phases 18-19 (shipped 2025-03-25)
- ✅ **v0.5.0 Motion Blur & Paint Styles** — Phases 20-21 (shipped 2025-03-26)
- ✅ **v0.6.0 Various Enhancements** — Phases 22-25 (shipped 2026-04-03)
- ✅ **v0.7.0 Monorepo & Paint Enhancements** — Phases 26-33 (shipped 2026-04-05)
- ✅ **v0.8.0 Standalone Physics Paint** — Phases 34-38.1 (shipped 2026-08-01)
- 🚧 **v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity** — Phases 39-44 (in progress, target release 2026-08-31)

## Phases

### v0.9.0 — Active

- [x] **Phase 39: Scripts Auto-Hydration Fix** — Blocking prerequisite: saved-project scripts and Save Script appear automatically without manual Refresh, no timing hacks — **satisfied via quick task 260804-f2q with accepted native UAT (closed by verification 2026-08-04)**
- [x] **Phase 40: macOS Icon Regeneration + Build Hygiene** — Legible icon from the 794×794 alpha source, tracked generated icons stay release authority, documented 1100 kB chunk budget (completed 2026-08-04)
- [x] **Phase 41: EFX Paint Audio Preview + Monitoring Toggle** — Read-only frame-synchronized main-editor audio monitoring inside EFX Paint with session-local toggle (completed 2026-08-05)
- [x] **Phase 42: PlayScript Application Modes + Color Override** — Explicit progressive vs static/hold modes and application-time color override with clear Scripts panel UI (completed 2026-08-06)
- [x] **Phase 43: Hold Loop Clips + Integrated Loop Rail** — Deterministic static/hold rendering with linked Loop Clips (cycle × repeat 1..∞), an EFX-local integrated rail/contextual inspector, and one passive Motion Editor PPaint FX-bar duration marker per effective interval with zero Loop Clip-specific interaction (completed 2026-08-08)
- [x] **Phase 43.1: Intentional Gap Insert and Local Interpolation Breaks** — Existing Insert context-dispatches a genuinely empty cursor into one atomic empty-key-plus-stable-break transaction, preserving local interpolation, persistence, history, and accepted physical-strip geometry (completed 2026-08-10)
- [x] **Phase 43.2: Motion and Static Group Stabilization and Action Lifecycle** — Durable Groups, exact local lifecycle edits, leased bidirectional Action deletion history, and canonical save/playback/preview/export parity (completed 2026-08-13)
- [ ] **Phase 44: Integrated UAT + Signed Release** — All automated gates, packaged native UAT per spec, signed/notarized downloaded-artifact verification, publish 2026-08-31

## Phase Details

### Phase 39: Scripts Auto-Hydration Fix

**Goal**: Saved-project scripts and Save Script are available automatically when EFX Paint opens a parent Paint layer — the hidden manual Refresh workaround is eliminated without timing hacks.
**Depends on**: Nothing (first phase of milestone; blocking prerequisite for Phases 42-43)
**Requirements**: HYDR-01, HYDR-02, HYDR-03, HYDR-04, HYDR-05, HYDR-06
**Success Criteria** (what must be TRUE):

  1. User opens a saved project containing durable project scripts, opens its Paint/Physics Paint layer, and sees existing script rows populate automatically without clicking Refresh
  2. Save Script is enabled immediately when saved-project authority arrives and no library operation is busy
  3. A genuinely unsaved project still shows `Save the project first.` and makes no persistence request
  4. Closing and reopening EFX Paint hydrates exactly once per authoritative context — no duplicate scans/listeners, and stale context events from a replaced project or layer cannot populate rows
  5. Manual Refresh remains available as an explicit rescan/recovery action, and Copy/Apply/Clear Buffer/Load+Apply/Play/rename/delete/selection/diagnostics/clipboard behavior and default-open accessibility are unchanged

**Plans**: Satisfied by quick task 260804-f2q (`.planning/quick/260804-f2q-fix-the-phase-39-efx-paint-scripts-auto-/`) — owned regression tests, HYDR-06 timing-primitive diff gate, `VERIFICATION.md` status passed, native UAT approved 2026-08-04; closed by verification per the execution note below
**UI hint**: yes

**Execution note:** This phase may be satisfied by the dedicated `/gsd-quick` per `SPECS/milestone-v0.9.0-plan.md` (completion gate). If the quick lands first with owned regression tests and accepted native UAT evidence, Phase 39 closes by verification instead of reimplementation. Any `setTimeout`/polling/`requestAnimationFrame` in the fix diff is automatic rejection (HYDR-06).

### Phase 40: macOS Icon Regeneration + Build Hygiene

**Goal**: The release presents a legible, recognizable macOS identity and an explicit, test-pinned desktop build policy.
**Depends on**: Nothing (parallel-safe with Phase 39 — touches only icons, Vite config, build test seam, release preflight)
**Requirements**: ICON-01, ICON-02, ICON-03, ICON-04, BUILD-01, BUILD-02, BUILD-03
**Success Criteria** (what must be TRUE):

  1. User recognizes EFX Motion Editor from the new icon in Finder, Dock, Applications, application switcher, and the mounted DMG — legible at 16×16 through 512×512 with genuine alpha corners, no placeholder, no unreadable prior icon
  2. Release preflight validates the tracked generated icon set under `app/src-tauri/icons/` (non-empty entries, valid ICNS signature, packaged `.app` icon metadata) without depending on the ignored `SPECS/` path or exact source dimensions, and without altering bundle identity, signing, notarization, stapling, or Gatekeeper verification
  3. Production build runs with `chunkSizeWarningLimit: 1100` backed by a documented desktop rationale (packaged Tauri app, monitored budget, not a performance claim, not raised again without measurement)
  4. Only provably ineffective mixed static/dynamic imports are corrected — Tauri/browser runtime guards, genuine lazy chunks, and cycle-breaking imports preserved; dependency-inversion cases reported as separately scoped work
  5. The production-build test seam verifies the resolved 1100 limit, HTML entry, non-empty local assets, Motion Canvas output, intentional chunk separation, and non-return of corrected mixed-import warnings — without content-hash or exact-chunk-count fragility

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 40-01-PLAN.md — Icon regeneration via Tauri pipeline + packaged-icon proof on fresh unsigned build + user icon UAT (ICON-01..04)
- [x] 40-02-PLAN.md — chunkSizeWarningLimit: 1100 with rationale + build seam (resolved-limit, warning capture, separation pins) (BUILD-01, BUILD-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 40-03-PLAN.md — Mixed-import baseline, D-08 approval gate, approved corrections + non-return assertions (BUILD-02, BUILD-03)

### Phase 41: EFX Paint Audio Preview + Monitoring Toggle

**Goal**: Users hear the main editor's audio arrangement, frame-synchronized to the Paint cursor, while playing Paint/Roto frames inside EFX Paint — read-only, with a session-local monitoring toggle.
**Depends on**: Phase 39 (reuses the proven exact-payload bridge handoff idiom for revisioned audio context)
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06
**Success Criteria** (what must be TRUE):

  1. User hears the main editor's audio tracks at the correct Paint frame cursor position when playing in EFX Paint; main-editor muted tracks remain inaudible
  2. Seek, pause, resume, loop, and stop stay synchronized with the Paint cursor without drift during sustained playback, and no doubled audio from duplicate engines ever occurs
  3. User can silence monitoring with a session-local Audio Preview On/Off toggle without mutating main-editor track mute/volume state or export
  4. Main-editor audio changes while EFX Paint is open arrive as revisioned bridge updates; a stale update never overwrites newer audio context
  5. Missing audio assets surface a non-blocking warning, audio-preview failure never blocks Paint editing, and closing EFX Paint stops and releases all audio resources

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 41-01-PLAN.md — Locked frame→audio truth table + RED test suite + decision checkpoint (A4/A6/revision) (AUDIO-02, AUDIO-03, AUDIO-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 41-02-PLAN.md — Tracer: revisioned audioPreview launch section main→Rust→child + monitor fetch/decode/play-at-cursor (AUDIO-01, AUDIO-02, AUDIO-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 41-03-PLAN.md — Sync behaviors (silent scrub, loop-wrap re-seek, 40ms drift corrector) + push-on-change revisioned updates with mid-playback restart (AUDIO-03, AUDIO-04)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 41-04-PLAN.md — First-player-wins ownership guard with suppressed note + auto-resume; session-local Audio Preview toggle (AUDIO-05, AUDIO-06)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 41-05-PLAN.md — Engine release on close, CSP connect-src efxasset grant (RED-first contract test), native packaged-app UAT (AUDIO-06)

**Entry artifact:** Locked frame→audio truth table (paint appFrame == main-editor global frame; per-track offset/trim/slip combinations) written and tested before implementation. Main editor remains sole authority for audio IDs, assets, offset, trim, volume, mute, fades, ordering, persistence, and export mixing.

### Phase 42: PlayScript Application Modes + Color Override

**Goal**: Users can apply PlayScripts progressively (unchanged existing behavior) or as static/hold, with an optional application-time color override, all clearly presented in the Scripts panel.
**Depends on**: Phase 39 (Scripts panel hydration must be trustworthy before new controls land)
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04
**Success Criteria** (what must be TRUE):

  1. User explicitly selects `progressive` (current accumulating behavior, unchanged with default options) or `static`/`hold` mode, independent of Roto interpolation and Script Motion
  2. User can apply an optional override color that recolors paint strokes identically in both modes while erase strokes retain erase behavior and the reusable source script and its thumbnail remain byte-identical
  3. The Scripts panel clearly shows progressive vs static/hold, original vs override color, Script Motion position/deformation controls, destination range, and generated-frame count
  4. User can configure Hold Loop controls — source cycle frame count (min 1), repeat count (positive integer from 1), a separate infinity toggle — and see requested duration (`cycleLength × repeatCount`), effective duration after next-clip/parent-end boundary, and clear truncation status

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 42-01-PLAN.md — TDD: static/hold stroke schedule package module + additive animation exports (PLAY-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 42-02-PLAN.md — Tracer: controller + renderer wiring — mode selection, color override post-Motion, loop option state + readout, applied-summary state (PLAY-01, PLAY-02, PLAY-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 42-03-PLAN.md — Dialog expansion: segmented mode control, override swatch + inline picker, Motion sliders, Hold Loop block, scoped CSS (PLAY-03, PLAY-04)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 42-04-PLAN.md — Scripts panel two-line summary + tooltip update + native visual UAT (PLAY-03)

**UI hint**: yes

**Boundary note:** Interval and display conventions (half-open intervals, requested-vs-effective presentation) are locked in this phase so Phase 43's Integrated Loop Rail and resolver share them. Static/hold schedule ships as a new package export; the regression-locked progressive module is never branched.

### Phase 43: Hold Loop Clips + Integrated Loop Rail

**Goal**: Static/hold mode materializes the complete script drawing deterministically on every destination frame, and linked Loop Clips replay the timing of their authoritative real source-key positions from 1 to infinity without duplicating durable source assets. Loop Rails own multi-capsule Key Spacing selection and apply complete selected source cycles left-to-right with cumulative downstream ripple and source-attached placement follow in one atomic records-plus-Loop-Clips transaction; physical keys retain ordinary operations and partial spacing within one cycle only. Play Script publishes the current active Paint background in the same physical transaction, including first-document creation on a fresh layer. Loop Clips remain authored exclusively through the integrated Loop Rail and contextual Scripts inspector, while the Motion Editor main timeline shows only passive mode-colored 3px effective-interval paint with canonical endpoint cuts and owns no Loop Clip-specific interaction.
**Depends on**: Phase 42 (needs proven static/hold output and locked interval/display conventions)
**Requirements**: HOLD-01, HOLD-02, HOLD-03, HOLD-04, HOLD-05, HOLD-06
**Success Criteria** (what must be TRUE):

  1. Every static/hold destination frame receives the complete script stroke set, supporting progressive-then-hold workflows on adjacent ranges, and generated keys remain paint content of the opened parent Paint layer composited as one resolved raster per frame by the main editor
  2. Identical script, destination, and options produce identical output across save/reopen and cache regeneration — zero-variation produces a stable held drawing, nonzero variation is deterministic per frame, no random render-time jitter
  3. Cancellation, staging failure, transport rejection, timeout, or settlement mismatch never leaves partial records, Loop Clips, background metadata, or history. One Undo removes the accepted operation and Redo restores it through the existing atomic commit path. A first Play Script on a fresh layer creates the physical document with the current active Paint background, and main Studio, preview, export, and save/reopen use that accepted background.
  4. A 5-position source cycle repeated 5 times resolves across five repetitions while storing only the 5 authoritative source keys; source-key `appFrame` offsets define runtime cadence and cycle duration. Plain/Shift/Cmd rail selection authorizes one or more complete source cycles, deduplicates identical cycles, and processes them in canonical placement order. Each group is spaced after prior cumulative growth, all later real keys ripple by the exact growth, and source-attached downstream Loop Clip placement follows its first key. Physical selection remains exact for ordinary operations and partial spacing within one cycle; cross-cycle physical spacing rejects with Loop Rail guidance. Rail/physical modes are mutually exclusive, Select All has no hidden scope, Interpolation remains unchanged, and one Undo/Redo covers records plus allowed placement changes.
  5. Next-clip priority truncates loops after complete or partial cycles with half-open interval boundaries; moving or removing the next clip re-expands Effective duration without regenerating sources. Inside EFX Paint/Roto, a conditional 3px integrated Loop Rail adds zero row height and exposes derived name, Cycle math, Effective duration, mode, status, and rail-owned selection through its tooltip and contextual Scripts inspector, with no dedicated actions popover or replacement specialized transport. Rail selection paints only the selected 3px line: its complete source cycle remains the invisible Apply-time Key Spacing scope and does not mark or aria-select source frames. Explicit physical same-cycle proxy selection may visibly mark equivalent source positions, while linked/generated/gap/unresolved cells remain non-draggable navigation where applicable. The Motion Editor PPaint FX bar paints passive purple Progressive or cyan Static/Hold 3px intervals with white canonical endpoint cuts from `{startFrame, frameCount, mode}` only, with no identity, source/repeat metadata, text, badge, own hit target, tooltip, hover/focus, selection, keyboard route, navigation, Edit, drag, context menu, callback, command, or mutation; the term `clip bloquant` never appears in any language.

**Plans**: 15 plans
Plans:
**Wave 1**

- [x] 43-01-PLAN.md — Tracer: loopClips persistence gauntlet (four allowlists, placementStart identity) + revision/snapshot integration with Undo AND Redo proofs (HOLD-05)
- [x] 43-04-PLAN.md — HOLD-01..04 hardening specs: determinism, adjacent ranges, commit atomicity, single raster; test-only with bounded deviation protocol (HOLD-01..04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 43-02-PLAN.md — Resolver: lazy interval derivation + per-frame typed contract (real / linked / linked-unresolved / empty), D-24 boundary algebra, Pitfall-7 exhaustiveness sweep (HOLD-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 43-03-PLAN.md — Store: linked-loop render source, loop-aware end frame, atomic loopClips commit acceptance (HOLD-04, HOLD-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 43-05-PLAN.md — Guards: D-07/D-11/D-13 rejections, D-12 materialization, D-06 preflight warning (HOLD-05)
- [x] 43-07-PLAN.md — Capsule: pure geometry, frameMap feed, TimelineRenderer drawing at all zoom bands (HOLD-06)
- [x] 43-09-PLAN.md — D-28: export preflight block + placeholder variant with declared consumers + valid-loop preview/export parity (HOLD-04, HOLD-05)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 43-06-PLAN.md — Dialog loop-edit/source-edit modes, Link/Create, loop ops (Update/Unlink/Duplicate/Repair/Relink with Undo→Redo proofs), parent→child bridge message (HOLD-05)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 43-08-PLAN.md — Capsule interaction: hit regions, tooltip host, keyboard model, Studio strip link badge (HOLD-06)

**Wave 8** *(gap closure after failed native UAT Step 1)*

- [x] 43-11-PLAN.md — Current blocking tracer/checkpoint: integrated 3px Loop Rail plus contextual Scripts inspector, all nine ownership checks, the exact passive Motion Editor PPaint FX-bar marker, and Issue #2 validated source-position Key Spacing proxies with shared timed-loop cadence and zero occurrence materialization (HOLD-05, HOLD-06)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 43-12-PLAN.md — Expand rail states, accessibility, tooltip, contextual Scripts sidebar, exact-once local Edit activation, and the explicit no-popover boundary after tracer approval (HOLD-05, HOLD-06)

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 43-13-PLAN.md — Preserve the minimal passive marker type/projection/pure Canvas renderer while removing stale rich capsule types/drawing and every Motion Editor Loop Clip-specific input/tooltip route (HOLD-05, HOLD-06)

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 43-14-PLAN.md — Delete stale Motion Editor tooltip/geometry and rejected EFX lane/full-filmstrip residue, then remove specialized child listeners while preserving local controller authority (HOLD-05, HOLD-06)

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 43-15-PLAN.md — Remove specialized public Loop Clip transport, run the full HOLD/UI regression matrix, record UAT evidence, and release the final native checkpoint (HOLD-01..06)

**Wave 13** *(blocked on Wave 12 completion)*

- [x] 43-10-PLAN.md — Sole final native UAT checkpoint approved 2026-08-08; executed the corrected 43-UAT.md including native focus restoration and unsigned packaged smoke (HOLD-01..06)

**UI hint**: yes

**Boundary note:** Loop Clips persist as canonical linked loop regions in the existing physical-frame document authority. v0.9.0 adds no project schema migration or clean format break; accepted open/save/reopen behavior remains intact. The EFX-local Integrated Loop Rail ships with the resolver as a visible-window view of accepted ranges and owns Loop Clip selection/interaction. The Motion Editor receives only paint-only `{startFrame, frameCount, mode}` intervals for passive 3px Progressive-purple or Static/Hold-cyan paint with white canonical endpoint cuts. Key Spacing selection/provenance remains session-only, while accepted records, source-attached placement changes, and Play Script background remain inside the complete physical document transaction.

### Phase 43.4: Derived Key Groups and Scissor Breaks (INSERTED)

**Goal:** Ordinary real Roto keys not owned by a Motion/Static Group present as derived mid-gray Key Rails segmented by persistent 43.1 breaks — with a Scissor toolbar action splitting a rail via one stable-key-owned break, selection-scoped direct Delete Key Rail leaving a persistent intentional gap, and 43.3 clamp-and-commit Key Rail drag — each operation one atomic parent-acknowledged history command with one Undo/Redo, surviving save/reopen and Interpolation Off/On, under the coherent Motion Rail / Static Rail / Key Rail user-facing vocabulary.
**Requirements**: KRAIL-01, KRAIL-02, SCISSOR-01, SCISSOR-02, KDEL-01, KDEL-02, KDRAG-01, KDRAG-02, HIST-01, TERM-01, GUARD-01, REG-01 (planning-local; do not add to REQUIREMENTS.md)
**Depends on:** Phase 43.3
**Plans:** 8/8 plans complete

Plans:
**Wave 1**

- [x] 43.4-01-PLAN.md — Tracer: scissor closed-union intent + resolver break branch + pure Key Rail segment derivation with D-10 copy family + availability/no-op preflight + Scissor toolbar button after Cut (KRAIL-01, SCISSOR-01, SCISSOR-02, GUARD-01)
- [x] 43.4-02-PLAN.md — Key Rail drag session hook fork: 4px threshold, pointer capture, Escape cancel, click suppression, presentation-only ghost/preview state via injected ports (KDRAG-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 43.4-03-PLAN.md — TDD: move-key-rail/delete-key-rail transport members, pure key-rail clamp authority, (a)/(b)/(c) post-move break re-derivation, delete successor-break normalization (KDRAG-01, KDRAG-02, KDEL-02, GUARD-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 43.4-04-PLAN.md — key-rail delete classifier arm + dynamic Delete scope labels + D-14 acceptance copy through the single mapper (KDEL-01, KDEL-02)
- [x] 43.4-05-PLAN.md — prepareKeyRailDrag/commitKeyRailDrag with break-inclusive fingerprint + D-18/D-20 drag status copy (KDRAG-02, HIST-01, GUARD-01)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 43.4-06-PLAN.md — PhysicsPaintKeyRail host + additive gray CSS + strip mount with own gate + gap preview + Studio selection signal with mutual exclusion and stale-authority clearing (KRAIL-01, KRAIL-02, KDRAG-01)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 43.4-07-PLAN.md — D-01 terminology migration on touched rail surfaces with copy tests + residue gate + locked-boundary non-modification proofs (TERM-01, REG-01)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 43.4-08-PLAN.md — History/persistence integration proofs (one-command Undo/Redo, Redo truncation, save/reopen parity) + blocking frozen-session native UAT (HIST-01, REG-01)

### Phase 43.3: Motion and Static Group Drag Within Free Space (INSERTED)

**Goal:** Users can drag a Motion or Static Group directly from its integrated Group Rail into available empty timeline space — a source-attached Group moving its complete real source cycle, rail, linked repeat interval, placement, and lifecycle boundaries together, a duplicated shared-source placement moving only its placement — with clamp-and-commit at every collision boundary, a translucent ghost/blocked-edge/gap preview before commit, every vacated or newly opened interval recorded as a persistent Phase 43.1 stable-key-owned interpolation break, and the accepted movement landing as one atomic parent-acknowledged transaction with one Undo/Redo surviving save/reopen.
**Requirements**: GDRAG-01, GDRAG-02, GDRAG-03, GDRAG-04, GDRAG-05, GDRAG-06, GDRAG-07, GDRAG-08, GDRAG-09, GDRAG-10 (planning-local; do not add to REQUIREMENTS.md)
**Depends on:** Phase 43.2
**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 43.3-01-PLAN.md — Tracer: 'move-group' closed-union intent + resolver source-attached happy path + break-aware prepare/commit pair + rail drag session with unclamped ghost (GDRAG-01, GDRAG-03, GDRAG-07)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 43.3-02-PLAN.md — TDD: pure clamp authority vs all D-08 boundaries, duplicated placement-only branch, stable-key-owned break derivation D-09..D-13 (GDRAG-04, GDRAG-05, GDRAG-06, GDRAG-08)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 43.3-03-PLAN.md — Clamped ghost + red blocked-edge bar + roto-fill-empty gap preview, locked status copy via single mapper, busy gate, D-17 post-commit stability (GDRAG-02, GDRAG-06, GDRAG-07, GDRAG-08)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 43.3-04-PLAN.md — Full regression gate with locked-boundary/frozen-path non-modification proofs + blocking frozen-session native UAT (GDRAG-09, GDRAG-10)

### Phase 43.1: Intentional Gap Insert and Local Interpolation Breaks

**Goal**: Users can start a new isolated Roto key segment at a distant genuinely empty frame through the existing Insert action, without interpolation bridging from the preceding segment, while the empty key and its stable-identity-owned incoming break remain one accepted physical-document/history fact.
**Depends on**: Phase 43 (preserves the accepted parent-authoritative physical document, interpolation, Loop Clip, strip geometry, and native behavior)
**Requirements**: GAP-01, GAP-02, GAP-03, GAP-04, GAP-05, GAP-06
**Success Criteria** (what must be TRUE):

  1. On a genuinely empty cursor frame, the existing visible `Insert` action creates exactly one genuinely empty real Paint key at that frame and one persistent incoming interpolation break owned by the new key's stable identity; the prior rendered drawing is neither copied nor materialized.
  2. The break suppresses only the interpolation span entering its owner, remains durable while Interpolation is Off, becomes effective again when Interpolation is On, stays dormant while the owner has no predecessor, and permits later interpolation from the owner into a new local segment.
  3. Strict parsing, canonical revision/equality, bridge validation, save/reopen, complete coordinator snapshots, Undo/Redo, deletion, payload replacement, and identity-preserving timing edits preserve the exact stable-owner lifecycle atomically.
  4. The single `Insert` surface preserves occupied-key Insert/Open-and-Insert behavior, context-dispatches the empty-segment intent, and uses one target-specific product-reason mapper for disabled preflight and stale resolver rejection; every failure leaves records, breaks, Loop Clips, selection, cursor, canvas, and history unchanged.
  5. A compact non-interactive left-edge cut appears inside the existing real-key cell only when the break-bearing key has a predecessor, remains visible with Interpolation Off, adds zero row/track geometry, and appends `Starts a new interpolation segment` to the existing tooltip/accessibility copy.
  6. Focused and full automated gates preserve occupied Insert, physical-key, painting, deletion, Copy/Paste, drag, Key Spacing, Loop Clip, interpolation, persistence, selection, and history behavior; the phase remains automated-ready until the user approves the native visual/product UAT matrix.

**Plans**: 12 plans
Plans:
**Wave 1**

- [x] 43.1-01-PLAN.md — Tracer: stable-key break contract through strict parent-authoritative acceptance and canonical runtime state (GAP-01, GAP-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 43.1-02-PLAN.md — TDD: local interpolation projection, empty-segment resolver intent, and break lifecycle across existing key operations (GAP-01, GAP-02, GAP-03, GAP-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 43.1-03-PLAN.md — TDD: persistence, complete transaction/rollback, bridge semantics, structural cache, and accepted-only Undo/Redo (GAP-01, GAP-03, GAP-06)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 43.1-04-PLAN.md — TDD: Signals-derived contextual Insert dispatch, shared target-specific product reasons, exact accepted feedback, and blank-canvas reconciliation (GAP-01, GAP-04, GAP-06)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 43.1-05-PLAN.md — Integrated physical-cell cut, tooltip/accessibility projection, and zero-geometry/zero-target presentation contracts (GAP-05, GAP-06)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 43.1-06-PLAN.md — Full regression gate, source-coverage closure, and blocking native visual/product UAT (GAP-01..GAP-06)

**Wave 7** *(two independent gap-closure branches, both blocked on Plan 06)*

- [x] 43.1-07-PLAN.md — TDD: macOS-native atomic Physics Paint cache-generation publication via fixed-path `renameatx_np` exchange, typed invoke, and non-feature-gated Rust integration proof (depends on 43.1-06; GAP-03, GAP-06)
- [x] 43.1-08-PLAN.md — TDD: standalone transport-safe ordinary intent parser/serializer and canonical resolver reproduction without payload activation (depends on 43.1-06; GAP-03)

**Wave 8** *(blocked on Plan 08)*

- [x] 43.1-09-PLAN.md — TDD: atomic required-intent payload activation across every action, coordinator, parser fixture, and typed caller (depends on 43.1-08; GAP-03, GAP-06)

**Wave 9** *(blocked on Plan 09)*

- [x] 43.1-10-PLAN.md — TDD: intent-aware dedup fingerprint plus parent canonical recomputation and complete semantic comparison (depends on 43.1-09; GAP-03, GAP-06)

**Wave 10** *(blocked on Plan 10)*

- [x] 43.1-11-PLAN.md — TDD: authority-scoped immutable replay ledger, selection/cursor-aware live preflight, and complete production/harness migration (depends on 43.1-10; GAP-03, GAP-06)

**Wave 11** *(blocked on independent Plan 07 and the Plan 08→09→10→11 chain)*

- [x] 43.1-12-PLAN.md — Automated focused/full Nyquist revalidation with actual validation evidence and preserved native approval (depends on 43.1-07 and 43.1-11; GAP-03, GAP-06)

**Planning note:** spec-less probe fallback skipped: phase had no requirement IDs at plan-phase init; goal-backward must_haves were derived from the activated SPECS prompt, CONTEXT.md, RESEARCH.md, and canonicalized GAP-01..GAP-06 instead. Plans 07-12 are additive verification-gap closure and do not reopen completed Plans 01-06 or approved native UAT.

### Phase 43.2: Motion and Static Group Stabilization and Action Lifecycle

**Goal:** Users can preserve, locally modify, fragment, regenerate, navigate, detach, or remove durable Motion and Static Groups through a complete Action lifecycle while one canonical accepted physical document remains authoritative across save/reopen, playback, preview, and export.
**Requirements:** GRP-01, GRP-02, GRP-03, GRP-04, GRP-05, GRP-06, GRP-07, GRP-08 (planning-local; do not add to REQUIREMENTS.md)
**Depends on:** Phase 43.1
**Plans:** 25/25 plans complete

Plans:

**Wave 0 — passing tests/fixtures/checklist only**

- [x] 43.2-01-PLAN.md — Lifecycle/range fixtures and complete field-participation matrix (GRP-02, GRP-04, GRP-08)
- [x] 43.2-02-PLAN.md — Source-sharing, exact-frame COW, cleanup, canonical lease concurrency, and rejection contracts (GRP-03, GRP-04, GRP-06)
- [x] 43.2-03-PLAN.md — Separate recovery/retained-history, forward/Undo/Redo/release contracts, and deterministic native-UAT checklist (GRP-06, GRP-08)

**Wave 1 — blocked on all Wave 0 plans**

- [x] 43.2-04-PLAN.md — Leased production tracer: exact-occurrence Group Paint through pure proposal, parent authority, token-checked sole replacement, version, and history (GRP-02, GRP-03)

**Waves 2–7 — canonical leased lifecycle capabilities**

- [x] 43.2-05-PLAN.md — Complete canonical schema, transport, persistence, store, and save/reopen participation (GRP-02, GRP-08)
- [x] 43.2-18-PLAN.md — Canonical project/layer physical-operation lease across every mutator, replacement, hydration, settlement, and recovery path (GRP-03, GRP-04, GRP-05, GRP-06, GRP-08)
- [x] 43.2-06-PLAN.md — Pure lifecycle proposals, leased bridge semantic validation, and ordinary history completeness (GRP-03, GRP-04, GRP-05, GRP-06)
- [x] 43.2-07-PLAN.md — Leased exact-frame Paint, gap refill/reunion, cache/canvas reconciliation, Undo/Redo (GRP-03)
- [x] 43.2-08-PLAN.md — Unified Delete activation/dialog plus leased atomic Delete Frame/Delete Group (GRP-04)
- [x] 43.2-09-PLAN.md — Guarded leased one/shared Regenerate with exact disclosure and accepted restoration (GRP-05)

**Waves 8–13 — durable bidirectional Action history**

- [x] 43.2-10-PLAN.md — Rust active recovery journal, working tombstone, scan gating, and restart foundation (GRP-06)
- [x] 43.2-19-PLAN.md — Rust retained Action history artifact, direction-specific Undo/Redo recovery, protected release/GC, and orphan handling (GRP-06)
- [x] 43.2-11-PLAN.md — Closed TypeScript direction/history/release validators and IPC wrappers (GRP-06)
- [x] 43.2-12-PLAN.md — Leased committed-only initial deletion settlement, enriched history insertion, and hydration recovery (GRP-06)
- [x] 43.2-20-PLAN.md — Frontend referenced-deletion Undo/Redo replay, exact history-pointer settlement, eviction/truncation/clear release hooks (GRP-06)
- [x] 43.2-13-PLAN.md — Reference-aware Actions confirmation, consequences, focus, lease/recovery UI (GRP-06)

**Waves 14–15 — approved Group/Action UI**

- [x] 43.2-14-PLAN.md — Canonical product copy plus exact fragment rail, lifecycle dots, linked halos, and geometry (GRP-01, GRP-07)
- [x] 43.2-15-PLAN.md — Actions/Edit/Create terminology, cross-selection, and non-wrapping linked navigation (GRP-01, GRP-07)

**Waves 16–17 — parity, regression, and acceptance**

- [x] 43.2-16-PLAN.md — Shared accepted frameMap/playback/preview/export lifecycle resolution (GRP-08)
- [x] 43.2-17-PLAN.md — Motion Editor regressions, full lease/history/recovery gates, source audit, and blocking frozen-session native UAT (GRP-01..GRP-08)

### Phase 44: Integrated UAT + Signed Release

**Goal**: v0.9.0 ships as a signed, notarized macOS release on 2026-08-31 with every automated gate and native packaged-app UAT step green and no release stop condition active.
**Depends on**: Phases 39-43.2 (release acceptance begins only after the Group/Action lifecycle, shared physical-operation lease, retained Action history, bidirectional replay, and frozen-session acceptance are complete)
**Requirements**: REL-01, REL-02, REL-03
**Success Criteria** (what must be TRUE):

  1. All automated gates pass: `pnpm --dir app exec vitest run`, typecheck, `pnpm build`, cargo tests, release script syntax check and preflight
  2. User-run packaged-app UAT passes every spec step: icon surfaces, hydration without Refresh, audio sync/seek/loop/stop without drift or doubling, toggle isolation, progressive apply, 5-frame cycle × 5 integrated-rail Cycle/Effective display and resolution, infinity to next clip, partial-cycle truncation label, next-clip move/remove re-expansion, color override with unchanged source, save/reopen/export — Phase 43 handoff: the signed packaged UAT explicitly covers valid linked-loop preview/export parity and the unresolved-loop export block (the unsigned packaged smoke runs earlier in Phase 43-10; the signed-artifact boundary is verified here, never silently dropped)
  3. Signed/notarized downloaded-artifact verification and visible launch complete before publication (icon verified on the downloaded artifact, not the dev machine, since icon caches lie)

**Plans**: TBD

---

### Archived Milestones

<details>
<summary>v0.1.0 (Phases 1-7) — SHIPPED 2019-03-11</summary>

- [x] Phase 1: Foundation & Scaffolding (3/3 plans) — completed 2019-03-02
- [x] Phase 2: UI Shell & Image Pipeline (3/3 plans) — completed 2019-03-03
- [x] Phase 3: Project & Sequence Management (10/10 plans) — completed 2019-03-03
- [x] Phase 3.1: Fix Cross-Phase Integration Wiring (1/1 plan) — completed 2019-03-03
- [x] Phase 4: Timeline & Preview (5/5 plans) — completed 2019-03-03
- [x] Phase 5: Editing Infrastructure (5/5 plans) — completed 2019-03-06
- [x] Phase 6: Layer System & Properties Panel (8/8 plans) — completed 2019-03-08
- [x] Phase 7: Cinematic FX Effects (10/10 plans) — completed 2019-03-10

See: `milestones/v0.1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.2.0 Pipeline Complete (Phases 8-14) — SHIPPED 2019-03-21</summary>

- [x] Phase 8: UI Theme System (3/3 plans) — completed 2019-03-12
- [x] Phase 9: Canvas Zoom (4/4 plans) — completed 2019-03-12
- [x] Phase 10: FX Blur Effect (4/4 plans) — completed 2019-03-13
- [x] Phase 11: Live Canvas Transform (4/4 plans) — completed 2019-03-14
- [x] Phase 12: Layer Keyframe Animation (5/5 plans) — completed 2019-03-15
- [x] Phase 12.1: Remove Bottom Bar → Sidebar (4/4 plans) — completed 2019-03-16
- [x] Phase 12.1.1: Big UI Sidebar Design (5/5 plans) — completed 2019-03-16
- [x] Phase 12.2: Auto-seek Timeline (1/1 plans) — completed 2019-03-17
- [x] Phase 12.3: Quick Keys Navigation (1/1 plans) — completed 2019-03-17
- [x] Phase 12.4: ShortcutsOverlay Tabs (1/1 plan) — completed 2019-03-17
- [x] Phase 12.5: Vertical Scroll (2/2 plans) — completed 2019-03-18
- [x] Phase 12.6: Layer Auto-selection UX (3/3 plans) — completed 2019-03-18
- [x] Phase 12.7: Keyframe Icons (1/1 plan) — completed 2019-03-18
- [x] Phase 12.8: Timeline Thumb Cover (1/1 plans) — completed 2019-03-18
- [x] Phase 12.9: Add-Layer Dialogs (1/1 plans) — completed 2019-03-18
- [x] Phase 12.10: GPU-Accelerated Blur (2/2 plans) — completed 2019-03-18
- [x] Phase 12.11: Full-speed + Fullscreen (2/2 plans) — completed 2019-03-19
- [x] Phase 12.12: Content Overlay Layers (4/4 plans) — completed 2019-03-19
- [x] Phase 12.13: Linear Timeline (2/2 plans) — completed 2019-03-19
- [x] Phase 12.14: Timeline/Canvas Buttons (2/2 plans) — completed 2019-03-19
- [x] Phase 12.15: Sequence Isolation + Loop (4/4 plans) — completed 2019-03-20
- [x] Phase 13: Fade/Cross-Dissolve (5/5 plans) — completed 2019-03-20
- [x] Phase 14: PNG & Video Export (5/5 plans) — completed 2019-03-21

See: `milestones/v0.2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.3.0 Audio & Polish (Phases 15-17) — SHIPPED 2025-03-24</summary>

- [x] Phase 15: Audio Import & Waveform (4/4 plans) — completed 2019-03-21
- [x] Phase 15.1: Media In-Use & Safe Removal (2/2 plans) — completed 2025-03-22
- [x] Phase 15.2: Solid Sequence (4/4 plans) — completed 2025-03-22
- [x] Phase 15.3: GLSL Shadertoys (1/1 plan) — completed 2025-03-22
- [x] Phase 15.4: GL Transition (4/4 plans) — completed 2025-03-23
- [x] Phase 16: Audio Export & Beat Sync (6/6 plans) — completed 2025-03-23
- [x] Phase 17: Enhancements (6/6 plans) — completed 2025-03-24
- [x] Phase 17.1: Adaptive Sidebar (2/2 plans) — completed 2025-03-24

See: `milestones/v0.3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.4.0 Canvas & Paint (Phases 18-19) — SHIPPED 2025-03-25</summary>

- [x] Phase 18: Canvas Motion Path (3/3 plans) — completed 2025-03-24
- [x] Phase 19: Add Paint Layer Rotopaint (6/6 plans) — completed 2025-03-24

See: `milestones/v0.4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.5.0 Motion Blur & Paint Styles (Phases 20-21) — SHIPPED 2025-03-26</summary>

- [x] Phase 20: Paint Brush FX (4/4 plans) — completed 2025-03-26
- [x] Phase 21: Motion Blur (4/4 plans) — completed 2025-03-26

See: `milestones/v0.5.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.6.0 Various Enhancements (Phases 22-25) — SHIPPED 2026-04-03</summary>

- [x] Phase 22: Foundation & Quick Wins (5/5 plans) — completed 2025-03-26
- [x] Phase 23: Stroke Interactions (3/3 plans) — completed 2025-03-27
- [x] Phase 24: Stroke List Panel (3/3 plans) — completed 2025-03-27
- [x] Phase 25: Bezier Path Editing (3/3 plans) — completed 2026-04-03

See: `milestones/v0.6.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.7.0 Monorepo & Paint Enhancements (Phases 26-33) — SHIPPED 2026-04-05</summary>

- [x] Phase 26: Monorepo Scaffold (3/3 plans) — completed 2026-04-03
- [x] Phase 27-32: Engine Integration — FAILED (adapter approach abandoned)
- [x] Phase 33: Enhance Current Engine (20/20 plans) — completed 2026-04-05

See: `milestones/v0.7.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.8.0 Standalone Physics Paint (Phases 34-38.1) — SHIPPED 2026-08-01</summary>

- [x] Phase 34: Standalone Demo Shell (3/3 plans) — completed 2026-06-08
- [x] Phase 35: Interactive Physics Paint Controls (7/7 plans) — completed 2026-06-10
- [x] Phase 36: Session Persistence and Output Proof (11/11 plans) — completed 2026-06-13
- [x] Phase 36.1: Play-Script Timeline Markers and Sequential Playback (9/9 plans) — completed 2026-06-16
- [x] Phase 36.2: Roto Paint Enhancements (13 plan records closed) — FAILED/SUPERSEDED 2026-06-19
- [x] Phase 36.3: Roto Durable Core Recovery (2/2 plans) — completed 2026-06-19
- [x] Phase 36.4: Roto Explicit Close Behavior (2/2 plans) — completed 2026-06-20
- [x] Phase 36.5: Roto Cell Semantics (3/3 plans) — completed 2026-06-20
- [x] Phase 36.6: Roto Save On Leave (3/3 plans) — completed 2026-06-20; superseded by automatic live pixel caching (quick 260714-ail)
- [x] Phase 36.7: Roto Key Utilities (5/5 plans) — completed 2026-06-22
- [x] Phase 36.8: Roto State Refactor (5/5 plans) — completed 2026-06-25
- [x] Phase 36.9: Roto Cached Playback Auto-Play (3/3 plans) — completed 2026-06-26
- [x] Phase 36.10: Roto Missing Background Preview Export (5/5 plans) — completed 2026-06-27
- [x] Phase 36.11: Roto Repaint Cached Real Key (3/3 plans) — completed 2026-06-29
- [x] Phase 36.12: Roto Generated Interpolation (11/11 plans) — completed 2026-07-02
- [x] Phase 36.13: Roto Dynamic Interpolation Spacing (6/6 plans) — completed 2026-07-13
- [x] Phase 36.14: Deterministic Physical-Frame Roto Timeline Cutover (24/30 plans; 6 historical non-executable) — completed 2026-07-25
- [x] Phase 36.15: Roto Timeline Final UI Integration (13/13 plans) — completed 2026-07-26
- [x] Phase 37: Multi-Select Physical Roto Keys (6/6 plans) — completed 2026-07-27
- [x] Phase 38: Multi-Copy/Paste and Tooltip Polish (11/11 plans) — completed 2026-07-29
- [x] Phase 38.1: Studio Render-Path Performance (18/18 plans) — completed 2026-07-29

See: `milestones/v0.8.0-ROADMAP.md` for full details.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15-17 (8 phases) | v0.3.0 | 29/29 | Complete | 2025-03-24 |
| 18-19 (2 phases) | v0.4.0 | 9/9 | Complete | 2025-03-25 |
| 20-21 (2 phases) | v0.5.0 | 8/8 | Complete | 2025-03-26 |
| 22-25 (4 phases) | v0.6.0 | 14/14 | Complete | 2026-04-03 |
| 26-33 (8 phases) | v0.7.0 | 23/23 | Complete | 2026-04-05 |
| 34-38.1 (21 phases) | v0.8.0 | 170/170 | Complete | 2026-08-01 |
| 39. Scripts Auto-Hydration Fix | v0.9.0 | 0/TBD | Not started | - |
| 40. macOS Icon + Build Hygiene | v0.9.0 | 3/3 | Complete    | 2026-08-04 |
| 41. EFX Paint Audio Preview | v0.9.0 | 5/5 | Complete    | 2026-08-05 |
| 42. PlayScript Modes + Color Override | v0.9.0 | 6/6 | Complete    | 2026-08-06 |
| 43. Hold Loop Clips + Integrated Loop Rail | v0.9.0 | 15/15 | Complete | 2026-08-08 |
| 43.1 Intentional Gap Insert + Local Breaks | v0.9.0 | 12/12 | Complete    | 2026-08-10 |
| 43.2 Motion/Static Group + Action Lifecycle | v0.9.0 | 25/25 | Complete    | 2026-08-13 |
| 44. Integrated UAT + Signed Release | v0.9.0 | 0/TBD | Not started | - |
