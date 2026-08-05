# Requirements: EFX-Motion Editor — Milestone v0.9.0

**Defined:** 2026-08-03
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.
**Source spec:** `SPECS/milestone-v0.9.0-plan.md` (user-approved; locked ownership boundaries and stop conditions)
**Target release:** 2026-08-31

## v0.9.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Scripts Auto-Hydration (blocking prerequisite)

- [x] **HYDR-01**: When a saved project containing durable project scripts opens its Paint/Physics Paint layer, existing script rows populate automatically without clicking Refresh
- [x] **HYDR-02**: Save Script enables immediately when saved-project authority arrives and no library operation is busy
- [x] **HYDR-03**: The automatic scan occurs exactly once per authoritative context; stale context events from a replaced project or layer cannot populate rows; no duplicate scan/listener behavior after close/reopen
- [x] **HYDR-04**: Genuinely unsaved projects remain blocked with `Save the project first.` and make no persistence request
- [x] **HYDR-05**: Manual Refresh remains available as an explicit rescan/recovery action; Copy/Apply/Clear Buffer/Load+Apply/Play/rename/delete/selection/diagnostics/clipboard behavior and default-open accessibility remain unchanged
- [x] **HYDR-06**: The fix consumes the exact updated project context (or genuinely authoritative committed context) — no setTimeout, polling, or requestAnimationFrame timing hacks

### macOS Release Identity

- [x] **ICON-01**: The macOS application icon is replaced using `SPECS/efxmotioneditor-icon-2.png` as design input (794×794 square alpha source used directly, no manual 1024 upscale), preserving the approved logo, typography, colors, rounded-square silhouette, and genuine alpha corners
- [x] **ICON-02**: The regenerated tracked icon set under `app/src-tauri/icons/` (32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico) remains the release authority; release preflight does not depend on the ignored `SPECS/` path or exact source dimensions
- [x] **ICON-03**: Release-contract validation confirms every declared desktop icon exists and is non-empty, the ICNS has a valid signature, and the packaged `.app` declares and contains the expected icon resource — without altering bundle identity, signing, notarization, stapling, Gatekeeper, or downloaded-artifact verification
- [x] **ICON-04**: The new icon is legible at 16×16, 32×32, 64×64, 128×128, 256×256, and 512×512, and presents correctly in Finder, Dock, Applications, application switcher, and DMG (no placeholder, no unreadable prior icon)

### Desktop Build Hygiene

- [x] **BUILD-01**: Vite build sets `chunkSizeWarningLimit: 1100` with a documented desktop rationale (packaged Tauri app, monitored entry-bundle budget, not a performance claim, not raised again without measurement)
- [x] **BUILD-02**: Only provably ineffective mixed static/dynamic imports are corrected — Tauri/browser runtime guards, genuine lazy chunks, and cycle-breaking dynamic imports are preserved; no global warning suppression; dependency-inversion cases reported as separately scoped work
- [x] **BUILD-03**: The production-build test seam verifies the resolved 1100 limit, HTML entry, non-empty local assets, Motion Canvas output, intentional chunk separation, and non-return of corrected mixed-import warnings — without depending on content hashes or exact chunk counts

### EFX Paint Audio Preview (read-only)

- [x] **AUDIO-01**: The main editor remains the sole authority for audio track IDs, assets, offset, trim, volume, mute, fades, ordering, persistence, and export mixing; EFX Paint receives only monitoring data/commands
- [x] **AUDIO-02**: Opening a parent Paint layer in EFX Paint provides enough launch/session context (revision, sequence, parent layer, fps, per-track timing/gain state) to resolve audible audio at the Paint frame cursor
- [x] **AUDIO-03**: Audio preview starts, seeks, pauses, stops, and loops in sync with the EFX Paint playback cursor across the locked frame/time mapping, without drift during sustained playback
- [x] **AUDIO-04**: Main-editor audio changes while EFX Paint is open arrive as revisioned bridge updates (or defined refresh/reopen behavior); no stale update overwrites newer audio context
- [x] **AUDIO-05**: A session-local Audio Preview On/Off toggle silences local monitoring without mutating main-editor track mute state or export
- [x] **AUDIO-06**: Missing audio assets surface a non-blocking warning; audio-preview failure never blocks Paint editing; closing EFX Paint stops and releases audio resources; no doubled audio from duplicate engines

### PlayScript Application Controls

- [x] **PLAY-01**: An explicit PlayScript application mode selects `progressive` (current accumulating behavior) or `static`/`hold` (complete script stroke set materialized on every destination frame), independent of Roto interpolation and Script Motion
- [x] **PLAY-02**: An optional application-time color override recolors paint strokes (erase strokes retain erase behavior) identically in both modes, without modifying the reusable source script or its thumbnail
- [ ] **PLAY-03**: The Scripts panel clearly shows progressive vs static/hold, original vs override color, Script Motion position/deformation controls, destination range, and generated-frame count
- [ ] **PLAY-04**: Static/hold mode exposes Hold Loop controls — source cycle frame count (min 1), repeat count (positive integer from 1), a separate infinity toggle, requested duration (`cycleLength × repeatCount`), effective duration after next-clip/parent-end boundary, and clear truncation status

### Deterministic Static/Hold Rendering

- [ ] **HOLD-01**: Every static/hold destination frame receives the complete script stroke set, supporting progressive-then-hold workflows on adjacent ranges
- [ ] **HOLD-02**: Static/hold reuses the deterministic Script Motion model — zero variation produces a stable held drawing; nonzero variation is deterministic per frame; identical inputs produce identical output across save/reopen and cache regeneration; no random render-time jitter
- [ ] **HOLD-03**: Static/hold reuses the existing commit path (engine init, existing-frame merge, PNG alpha encoding, staged real-key creation, capacity/memory validation, progress, cancellation, authority/revision checks, atomic commit, undo/redo); no cancellation or failure leaves a partial destination range
- [ ] **HOLD-04**: Generated keys remain paint content of the opened parent Paint layer; the main editor composites one resolved Paint raster per frame
- [ ] **HOLD-05**: Loop Clips persist as canonical linked loop regions (not duplicated durable assets) with modulo source resolution, half-open interval boundaries, next-clip priority with full/partial cycle interruption, re-expansion when the next clip moves/is removed, and source-frame edits propagating to every linked occurrence
- [ ] **HOLD-06**: The timeline filmstrip capsule shows the detailed source cycle, a linked-repetition band, `Cycle Nf × R = Df` / `× ∞` badges, requested vs effective duration, and the label `Boucle raccourcie par le clip suivant` on truncation (the term `clip bloquant` is never used)

### Integrated Release Acceptance

- [ ] **REL-01**: All automated gates pass: `pnpm --dir app exec vitest run`, typecheck, `pnpm build`, cargo tests, release script syntax check and preflight
- [ ] **REL-02**: Native packaged-app UAT passes all spec steps (icon surfaces, hydration without Refresh, audio sync/seek/loop/stop without drift or doubling, toggle isolation, progressive apply, 5-frame cycle × 5 repeat badge and resolution, infinity to next clip, partial-cycle truncation label, next-clip move/remove re-expansion, color override with unchanged source, save/reopen/export)
- [ ] **REL-03**: Signed/notarized downloaded-artifact verification and visible launch complete before publication; no release stop condition is active

## Future Requirements (deferred)

### PlayScript Loops

- **LOOP-01**: Ping-pong loop mode — after linked-loop resolution is proven (v0.9.x)
- **LOOP-02**: Combined progressive-plus-hold scheduler — convenience; today the user applies two operations to adjacent ranges (v0.9.x)

### Paint / Editor

- **PAINT-01**: Multiple internal Paint tracks — v1.0 scope
- **PAINT-02**: Reveal masks — v1.0 scope
- **INTG-01**: Typed physics-paint transport/cache message contract — v0.8.0 follow-up, carried in PROJECT.md Active

## Out of Scope

Explicitly excluded for v0.9.0. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Audio editor inside EFX Paint | Main editor is the sole audio authority (locked boundary) |
| Independent EFX Paint audio persistence/timeline | Read-only monitoring only; no second audio system |
| Persisted default color overrides inside script documents | Override is application-time only; library stays immutable |
| Web-oriented bundle splitting to satisfy Vite's 500 kB default | Desktop app loads local assets; 1100 budget documented instead |
| Broad `manualChunks` / fake lazy bootstrap / warning filters | Alter reporter output without real gains; spec-excluded |
| Internal Paint multi-track, photo/reference track changes, Reveal | v1.0 scope |
| Online AI generation, provider accounts, API keys, local AI CLIs | Spec-excluded |
| Broad store-cycle refactors | Spec-excluded; targeted changes only |
| Manual 1024×1024 icon upscale | 794×794 source used directly per Tauri v2 tooling |
| Timing-hack hydration fixes (setTimeout/polling/rAF) | Mask the race; exact-context handoff required |
| Windows/Linux builds, live camera tethering, plugin system, node-based compositing, real-time collaboration | Standing project exclusions (see PROJECT.md) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HYDR-01 | Phase 39 | Complete |
| HYDR-02 | Phase 39 | Complete |
| HYDR-03 | Phase 39 | Complete |
| HYDR-04 | Phase 39 | Complete |
| HYDR-05 | Phase 39 | Complete |
| HYDR-06 | Phase 39 | Complete |
| ICON-01 | Phase 40 | Complete |
| ICON-02 | Phase 40 | Complete |
| ICON-03 | Phase 40 | Complete |
| ICON-04 | Phase 40 | Complete |
| BUILD-01 | Phase 40 | Complete |
| BUILD-02 | Phase 40 | Complete |
| BUILD-03 | Phase 40 | Complete |
| AUDIO-01 | Phase 41 | Complete |
| AUDIO-02 | Phase 41 | Complete |
| AUDIO-03 | Phase 41 | Complete |
| AUDIO-04 | Phase 41 | Complete |
| AUDIO-05 | Phase 41 | Complete |
| AUDIO-06 | Phase 41 | Complete |
| PLAY-01 | Phase 42 | Complete |
| PLAY-02 | Phase 42 | Complete |
| PLAY-03 | Phase 42 | Pending |
| PLAY-04 | Phase 42 | Pending |
| HOLD-01 | Phase 43 | Pending |
| HOLD-02 | Phase 43 | Pending |
| HOLD-03 | Phase 43 | Pending |
| HOLD-04 | Phase 43 | Pending |
| HOLD-05 | Phase 43 | Pending |
| HOLD-06 | Phase 43 | Pending |
| REL-01 | Phase 44 | Pending |
| REL-02 | Phase 44 | Pending |
| REL-03 | Phase 44 | Pending |

**Coverage:**

- v0.9.0 requirements: 32 total
- Mapped to phases: 32 (Phases 39-44)
- Unmapped: 0

---
*Requirements defined: 2026-08-03*
*Last updated: 2026-08-04 after roadmap creation (Phases 39-44 mapped, 100% coverage)*
