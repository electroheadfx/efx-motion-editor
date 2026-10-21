# Requirements: EFX Motion Editor

**Defined:** 2026-10-14
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

**Milestone:** v2.0.0 Multi-Module Paint Workstation (MAJOR)

## v2.0.0 Requirements

Requirements for the multi-module paint workstation release. Each maps to a roadmap phase (54–57). Scope is locked 2026-10-14 — do not rescope.

### Runtime Foundation (Phase 54 — Preact 11)

- [x] **RUN-01**: Probe `@preact/signals` ↔ Preact 11 compatibility BEFORE any bump; STOP the milestone if red
- [x] **RUN-02**: App runs on `preact@11.0.1` + `@preact/signals@2.11.3` with exactly one `preact` copy across app + packages
- [x] **RUN-03**: `lucide-preact` bumped to `^1.57.0` (first version whose peer range allows Preact 11)
- [x] **RUN-04**: Mechanical migration handled: JSX types → preact namespace, `useRef` initial values, `defaultProps`/auto-px → compat
- [x] **RUN-05**: `paintVersion` bump+subscribe discipline preserved — NOT rewritten into effect cleanups
- [x] **RUN-06**: Live UAT of the reactivity paths (paintVersion, store setters) CLOSES before Phase 55 opens

### Engine Host Split (Phase 55 — efx-paint-host)

- [x] **HOST-01**: `packages/efx-paint-host` owns animation schedules, traceSeed, script envelope, ticks + diffusionFrames — moved out of efx-physic-paint
- [x] **HOST-02**: Host APIs are generic over the per-engine stroke payload (pts, ticks, cuisson, motion, brush id + toolOverrides) — never engine-specific params
- [x] **HOST-03**: Format-identical split proven against a pre-move golden bake (R5.2 / A4 replay parity) — a refactor guard, not a compatibility surface
- [x] **HOST-04**: Generic `StudioStroke<P>` + `EngineAdapter<P>` seam proven by a fake engine-2 payload (A5) with zero engine-1 types
- [x] **HOST-05**: Fail-closed Apply contract across engines — named visible refusal, never half-apply

### Watercolor Engine (Phase 56 — efx-watercolor)

- [x] **AQUA-01**: paint-aquarelle renders wet-in-wet blooms, hard wet-on-dry edges, and dark tide lines that survive into baked frames
- [x] **AQUA-02**: Four tools only: `brush | water | pen | lift`
- [x] **AQUA-03**: 14 brush tips + custom PNG/JPG tip import, with the per-brush property surface (tip/aspect/rotation/size-curve/scatter/capacity/grain/wetRound)
- [x] **AQUA-04**: 8 global params (`size, water, load, flow, bleed, dry, edge, granulation`) + per-brush multipliers drain into the panels
- [x] **AQUA-05**: Studio script law for aquarelle: record → play physics (no forced Dry) → WebP bake (`diffusionFrames` ≤ 600) → cache
- [x] **AQUA-06**: Deterministic replay: same script ⇒ same pixels, seeded per stroke (FNV-1a traceSeed), no `Math.random()` in deposit/sim path
- [x] **AQUA-07**: Bake survives leaving the frame (long cuisson > one diffusion window)
- [x] **AQUA-08**: Transparent where unpainted; acceptance rows A1–A5 pass

### Paper Pack (Phase 56)

- [x] **PAPER-01**: 10 named procedural papers (cold press, hot press, rough, khadi, washi, laid, canvas, toned sand, kraft, student)
- [x] **PAPER-02**: Usable by ALL paints through the same `paperPass` — composite-only, no rebake on paper change
- [x] **PAPER-03**: Paper display state (id, strength, scale) lives on the document/fond in undo + save, with display-class change-token rotation (learn from PKG-06/BKG-09)
- [x] **PAPER-04**: The 3 real paper backgrounds already in the repo (`app/public/img/paper_1.jpg` / `paper_2.jpg` / `paper_3.jpg` — today wired as canvas1/2/3 inside physic-paint) are recovered into the Studio paper library and usable by ALL paints through the same `paperPass`, alongside the 10 procedural papers. Not watercolour-only.

### Module Switcher & Shared Studio (Phase 56)

- [x] **MOD-01**: Top-bar MODULE SWITCHER icon with three slots "Brush | Water color | Krita"; Krita visible but inert ("coming in v2.1.0")
- [x] **MOD-02**: Switching drains the selected module's OWN options/features into the panels
- [x] **MOD-03**: ONE shared Studio engine (script, cache management, timeline) — never forked per module
- [x] **MOD-04**: Brush-pack snapshot travels in `.mce` (deliberate exception to the 52.2 refs-only law)
- [x] **MOD-05**: Fail-closed cross-engine Apply — unreadable/cross-engine scripts refuse with a named visible error (53.1 law)
- [x] **MOD-06**: v2.0.0 ships Brush + Water color only; Krita is the v2.1.0 slot (no krita implementation)

### Spectral Mixing (delivered inside Phase 56; Phase 57 retired 2026-10-21)

- [x] **SPEC-01**: `packages/efx-spectral` ships vendored MIT reflectance data + own ESM surface + `NOTICE`
- [x] **SPEC-02**: Subtractive pigment mixing (yellow + blue = green) visible in wet AND dry marks
- [x] **SPEC-03**: Display rebuild matches the bake (shipped as 38-band spectral reconstruction + `exp(−A)` → sRGB; display/bake parity is pinned by the A1/A2 bake rows and engine determinism tests)
- [x] **SPEC-04**: Shared package consumed by engine 2 — never duplicated inside the watercolor engine
- [x] **SPEC-05**: API frozen for engine-1 adoption in v2.1.0 (the adoption itself is out of scope)

> Delivered through the Phase 56 spectral dependency hook. `packages/efx-spectral` stays as the engine-2 mixing package; there is no standalone Phase 57. The runtime API is pinned by `packages/efx-spectral/src/mix.test.ts` (SPEC-05 pin).

### Data Honesty & Format

- [x] **DATA-01**: Clean break accepted — no migration code, no dual-format readers, no backward-compat shims/branches
- [x] **DATA-02**: Any unreadable script/asset refuses with a named visible error — never drop data silently
- [x] **DATA-03**: Time = fixed tick grid (~1/60 s), integer ticks, never raw ms
- [x] **DATA-04**: Every new `.mce` field declared in BOTH TS and Rust (`mceFieldContract` law)

## Quick Tasks (inside this milestone — never standalone)

- [ ] **QUICK-01**: audio-trim-to-view (parked from pre-53)

## Future Requirements

Deferred to a later release. Tracked but not in this roadmap.

### Krita Module (v2.1.0)

- **KRT-01**: Third module "Krita" becomes active in the switcher (libmypaint WASM + `.myb` property-rich pack)
- **KRT-02**: Engine 1 adopts `efx-spectral` (replaces RYB `mixSubtractive` heuristic) — Q5-gated at v2.0.0 close

### Later (v2.2+)

- **TOOL-01**: Fill tool (bucket wash) — own tranche
- **TOOL-02**: Text / Shape / Hand annex tools
- **PAPR-05**: User-imported paper scans
- **RES-01**: 2K resolution activation
- **SND-08**: Paint-timeline waveform (existing FUT backlog — never fold into another phase)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| paint-krita / libmypaint implementation | Krita is the v2.1.0 slot — the switcher ships the inert slot only |
| Engine-1 spectral mixing | Engine 1 adopts `efx-spectral` in v2.1.0 (Q5-gated at close), not now |
| 2K resolution | Deferred; 1920 working cap stands |
| AI features | Out of scope for v2.0.0 |
| Migration / dual-format readers / backward-compat shims | Clean break accepted 2026-10-14 — the release matters more than compatibility |
| Layer/module conversion commands | Engines have different physics and script payloads; conversion is lossy fiction |
| Live engine-per-frame or per-stroke module switching | Breaks determinism, script replay, and cache identity |
| Per-module Studio forks (script, cache, timeline) | Guarantees drift; the shared-engine invariant exists to prevent it |
| Forced Dry at frame boundaries | Kills the look — bloom must evolve across frames (prohibited P4) |
| Live GPU fluid sim on the timeline | Scrub/repeats/export read cache; nondeterministic and heavy |
| Paper baked into WebPs / per-stroke paper authority | Breaks the no-rebake compositor law |
| Mixbox (any form) | CC BY-NC — banned project-wide |
| Copying code from the watercolour oracle / inkwash | Clean-room P1 stands until the licence decision at 56 plan time |
| Pre-deciding panel layout / iconography | User decides at discuss-phase (DECIDED 2026-10-14) |
| Text / Shape / Fill / Hand tools in v2.0.0 | Locked out; only `brush\|water\|pen\|lift` animate through scripts |

## Plan-Time Items (not requirements)

Resolved during planning, not tracked as REQ-IDs:

- Oracle licence P1 decision at 56 plan time (on-disk MIT LICENSE contradicts the grill's no-licence premise) — record in PROJECT.md Key Decisions
- `simplex-noise@4.0.3` vs in-house seeded noise (research recommends simplex-noise)
- Host Preact-free core vs default `./preact` entry (lean Preact-free; paint-host Q3)
- Exact tick-grid value (~1/60 s) and `types.ts` envelope/payload split shape (paint-host Q1/Q2)
- 4th paint layer-kind naming (Water / Aquarelle / Wash) — UI-SPEC
- A2 GPU determinism acceptance shape (stated pixel-delta threshold vs CPU reference path)
- Module switcher placement / iconography / panel layout / option grouping — discuss-phase gray zones
- Chunk-budget line move if shaders/spectral/papers pressure the 2000 kB ceiling

## Traceability

Which phases cover which requirements. Updated 2026-10-21 after phase 56 close — mapping complete 38/38 + QUICK-01 (SPEC-01..05 delivered inside 56; Phase 57 retired).

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUN-01 | Phase 54 | Complete |
| RUN-02 | Phase 54 | Complete |
| RUN-03 | Phase 54 | Complete |
| RUN-04 | Phase 54 | Complete |
| RUN-05 | Phase 54 | Complete |
| RUN-06 | Phase 54 | Complete |
| HOST-01 | Phase 55 | Complete |
| HOST-02 | Phase 55 | Complete |
| HOST-03 | Phase 55 | Complete |
| HOST-04 | Phase 55 | Complete |
| HOST-05 | Phase 55 | Complete |
| AQUA-01 | Phase 56 | Complete |
| AQUA-02 | Phase 56 | Complete |
| AQUA-03 | Phase 56 | Complete |
| AQUA-04 | Phase 56 | Complete |
| AQUA-05 | Phase 56 | Complete |
| AQUA-06 | Phase 56 | Complete |
| AQUA-07 | Phase 56 | Complete |
| AQUA-08 | Phase 56 | Complete |
| PAPER-01 | Phase 56 | Complete |
| PAPER-02 | Phase 56 | Complete |
| PAPER-03 | Phase 56 | Complete |
| PAPER-04 | Phase 56 | Complete |
| MOD-01 | Phase 56 | Complete |
| MOD-02 | Phase 56 | Complete |
| MOD-03 | Phase 56 | Complete |
| MOD-04 | Phase 56 | Complete |
| MOD-05 | Phase 56 | Complete |
| MOD-06 | Phase 56 | Complete |
| SPEC-01 | Phase 56 (early spectral) | Complete |
| SPEC-02 | Phase 56 (early spectral) | Complete |
| SPEC-03 | Phase 56 (early spectral) | Complete |
| SPEC-04 | Phase 56 (early spectral) | Complete |
| SPEC-05 | Phase 56 (early spectral) | Complete |
| DATA-01 | Phase 55 | Complete |
| DATA-02 | Phase 55 | Complete |
| DATA-03 | Phase 55 | Complete |
| DATA-04 | Phase 56 | Complete |
| QUICK-01 | Quick (in-milestone) | Pending |

**Coverage:**
- v2.0.0 requirements: 38 total (RUN 6 + HOST 5 + AQUA 8 + PAPER 4 + MOD 6 + SPEC 5 + DATA 4)
- Quick tasks: 1 (QUICK-01 — in-milestone quick, never a phase)
- Mapped to phases: 38/38
- Unmapped: 0 ✓
- Orphaned: 0 ✓
- Duplicates: 0 ✓

**Phase rollup:**
| Phase | Requirements | Count |
|-------|--------------|-------|
| 54 Preact 11 update | RUN-01..RUN-06 | 6 |
| 55 efx-paint-host | HOST-01..HOST-05, DATA-01..DATA-03 | 8 |
| 56 efx-watercolor | AQUA-01..AQUA-08, PAPER-01..PAPER-04, MOD-01..MOD-06, DATA-04 | 19 |
| 56 (early spectral hook) | SPEC-01..SPEC-05 | 5 |
| Quick (in-milestone) | QUICK-01 | 1 |

---
*Requirements defined: 2026-10-14*
*Last updated: 2026-10-21 after phase 56 close (Phase 57 retired; SPEC-01..05 marked delivered inside 56; coverage 38/38 + QUICK-01)*
