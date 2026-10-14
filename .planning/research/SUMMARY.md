# Project Research Summary

**Project:** EFX Motion Editor — v2.0.0 multi-module paint workstation
**Domain:** Tauri + Preact monorepo; clean-room paint engines behind one shared Studio script/bake/timeline law
**Researched:** 2026-10-14
**Confidence:** HIGH

## Executive Summary

EFX Motion Editor is a mature Tauri desktop paint/animation workstation (Preact + `@preact/signals`, Rust-backed `.mce` IO, WebP cache timeline). v2.0.0 turns it into a **multi-module paint workstation**: a top-bar MODULE SWITCHER (Brush | Water color | Krita) over ONE shared Studio engine. Only Brush + Water color ship; Krita is an inert v2.1.0 slot. The recommended approach is a strict dependency ladder — Phase 54 Preact 11 (hard `@preact/signals` probe gate first), Phase 55 `efx-paint-host` engine-agnostic split, Phase 56 clean-room `efx-watercolor` + 10-paper pack, Phase 57 `efx-spectral` MIT spectral package (may be created early inside 56). Net new third-party runtime deps for the whole milestone: at most one (`simplex-noise`).

The stack verdict is **GREEN on declared compatibility**: `@preact/signals@2.11.3` explicitly supports Preact 11 (`peerDependencies: ">= 10.25.0 || >=11.0.0-0"`) and ships a Preact-11-specific deferred-dispose fix; `lucide-preact` is the one real gate-blocker (0.577.0 peers `^10.27.2` only — bump to `^1.57.0`, floor 1.50.0). GREEN does **not** waive the R1.1 throwaway probe: runtime effect-subscription behaviour under deferred cleanups is still live-verified before the bump lands. The project `paintVersion` bump-and-subscribe law is deliberately *not* cleanup-based — do not rewrite it into React-style effects.

The main risks are (1) trusting peer ranges instead of running the probe and live UAT, (2) engine-specific types leaking into the host seam (the phases 27-32 adapter failure class), (3) replay non-determinism from wall-clock/unseeded RNG, and (4) a **licence contradiction**: PITFALLS.md found the on-disk oracle `LICENSE` is MIT (Maksim Surguy 2026) while STACK/ARCHITECTURE/FEATURES still treat the oracle as unlicensed clean-room-only. Until the user decides at 56 plan time, prohibition P1 stands — method only, no code copy.

## Key Findings

### Recommended Stack

Dependency bumps plus three new workspace packages; everything else is unchanged. Stay on Vite 5.4.21 (motion-canvas plugin peer pin) and TypeScript `~5.9.3` (do not jump to TS 7). All new packages are ESM, Preact-free (except optional `./preact` entries), and dep-free except one optional 3 KB noise helper.

**Core technologies:**
- `preact@11.0.1`: UI framework — current stable; engines 2-3 must not build on a dead major. Mechanical migration measured on the live tree (0 bare `useRef()`, 0 `defaultProps`, 3 files with `JSX.*` types).
- `@preact/signals@2.11.3`: the project only state layer — same 2.x major (no reactivity rewrite); 2.11.3 is the Preact-11-ready release (deferred `useSignalEffect` dispose fix).
- `lucide-preact@^1.57.0`: **required** companion bump — 1.50.0 is the first version whose peer range allows Preact 11; do not suppress the peer warning with overrides.
- `packages/efx-paint-host`: pure extraction (animation/, traceSeed, script envelope, tick/cuisson timing, bake-queue pattern) — **no new deps**, Preact-free core.
- `packages/efx-watercolor`: clean-room WebGL2 fluid grid — **no new runtime deps**; raw WebGL2 matching existing `glBlur`/`glslRuntime` seams; no Three/regl/Pixi.
- `packages/efx-spectral`: vendored MIT spectral.js reflectance data + own ESM surface + `NOTICE` — do **not** depend on the npm `spectral.js` bundle (script-style, not ESM).
- Procedural paper pack: `simplex-noise@4.0.3` (optional, recommended) + in-house seeded PRNG; output is `PaperPassTile` shapes into the Studio paper library.

**Critical version requirements:** `@preact/signals` **must** be 2.11.3 (not 2.11.2); `lucide-preact` **must** be >= 1.50.0; after 54 closes, raise `efx-physic-paint` peer floor to `preact >=11`; verify one `preact` copy via `pnpm why preact`.

**What NOT to add:** Mixbox (CC BY-NC, banned), any oracle/inkwash code until the licence decision, `spectral.js` as a runtime dep, Web Workers for bake, React/`useState`/codemods, Vite or TS major bumps, GPU fluid on the timeline, forced Dry at frame boundaries, backward-compat shims (clean break accepted 2026-10-14).

### Expected Features

Full detail in FEATURES.md. Launch scope is locked; the differentiator is **animateable** watercolour via the Studio script law — the oracle and competitors cannot script blooms over time.

**Must have (table stakes):**
- Top-bar module switcher, 3 named slots, Krita visible-but-inert ("coming in v2.1.0")
- ONE shared Studio engine — script/cache/timeline never fork per module
- Per-module option drain (brush pack + sliders) into the panels
- Fail-closed cross-engine Apply (named visible refusal, never half-apply)
- Aquarelle wet look surviving bake: wet-in-wet blooms, hard wet-on-dry edges, dark tide lines
- Subtractive pigment mixing (yellow + blue = green) via `efx-spectral`
- Four tools only: `brush | water | pen | lift`; 14 tips + custom import; 8 global params (`size, water, load, flow, bleed, dry, edge, granulation`) + per-brush multipliers
- Studio script law for aquarelle: record -> play (no forced Dry) -> WebP bake (`diffusionFrames` <= 600) -> cache; bake survives leaving the frame
- Acceptance rows A1-A5 (replay parity, identical bakes, bloom/tide in baked frames, independent cache ranges, transparent export)
- 10 procedural papers in the Studio paper library — composite-only, ALL paints, document-owned paper state (undo + save)

**Should have (competitive):**
- Animateable watercolour / scripted blooms over time (the headline differentiator vs Rebelle/oracle)
- Property-rich brush set (tip/aspect/rotation/size-curve/scatter/capacity/grain/wetRound) drained by the module surface
- White gouache pigment channel; wet-region-only sim + stop-when-dry
- Brush-pack snapshot travelling in `.mce` (deliberate exception to the 52.2 refs-only law)
- Third-module readiness proven by two (the seam is validated before Krita)

**Defer (v2.1.0 / later):**
- Krita module (libmypaint WASM + .myb) — v2.1.0 slot; do not implement now
- Engine-1 `efx-spectral` adoption (replaces RYB `mixSubtractive`) — v2.1.0, Q5-gated
- Fill tool (bucket wash) — own tranche; Text/Shape/Hand annex tools — v2.2+
- User-imported paper scans; 2K resolution; AI features; Paint-timeline waveform (existing FUT backlog)

**Anti-features to refuse:** layer/module conversion commands; live per-frame engine switching; Studio forks per module; v1.0.1 migration code; pre-decided panel layout/iconography (user decides at discuss-phase); forced Dry at frame boundaries; live GPU fluid on the timeline; paper baked into WebPs; best-effort Apply.

### Architecture Approach

One Studio, N engines. `efx-paint-host` is the Preact-free Studio law sitting between `app/` and engines; engines are opaque payload carriers behind `EngineAdapter<P>` (`applyStroke` / `stepTick` / `captureFrame` / `dispose` + `payloadCodec`). The host owns `StudioStroke<P>` (shared: `pts`, integer `ticks`, `cuisson`, `motion`, `brushId`, `toolOverrides`, `traceSeed`) and `StudioScriptEnvelope<P>` (shared metadata + opaque `engine: P` + `engineId` fail-closed discriminator); host code never inspects `P`. Determinism is host-owned: FNV-1a `traceSeed` + fixed integer tick grid (~1/60 s) + arc-length-keyed seeded draws.

**Major components:**
1. `packages/efx-paint-host` — Studio law: animation schedules, traceSeed, generic script envelope, tick/cuisson mechanism, bake host (port the `finalizationQueue` Effect v4 bounded-queue pattern — no new cancellation model, no Web Worker)
2. `packages/efx-physic-paint` — engine 1 (refactor only): keeps brush/core/engine/render/paper; loses animation/ + traceSeed; behaviour unchanged (R5.2 replay parity vs pre-move golden)
3. `packages/efx-watercolor` — engine 2, clean-room WebGL2 fluid grid (velocity/wet/ink/fixed/paper textures; wet-gated diffusion, capillary tide line, fix/dry); consumes `efx-spectral`
4. `packages/efx-spectral` — tiny shared MIT spectral package (7-coeff absorbance basis, CPU helpers + GLSL basis export, `NOTICE`); engine 1 adopts in v2.1.0; krita never uses it
5. `app/` module registry + top-bar switcher + per-module option panels + 4th paint layer kind + paper-pack library — compositor `getFlattenedFrame` path unchanged (CMP-01)

**Key patterns:** generic envelope + opaque payload; EngineAdapter plug point; bake host = ported `finalizationQueue`; composite-only paper (`PaperPassTile` valley/peak swap, no rebake); determinism by seeded draws only. Paper pack rides 56 but is Studio-library-shaped from the first commit (all paints).

### Critical Pitfalls

1. **Trusting the signals peer range instead of running the R1.1 probe** (Phase 54) — reactivity can die silently (`paintVersion` bumps, no re-render). Run the throwaway probe BEFORE any bump; if RED -> STOP and escalate (R1.2). No shims, no git-sha pins.
2. **Rewriting `paintVersion` subscriptions into React-style effect cleanups** (Phase 54) — Preact 11 defers cleanups until after paint; rewriting the bump-and-subscribe discipline creates zombie effects. Treat the 13+ `paintVersion` consumer files as a freeze-list; re-verify teardown, change nothing.
3. **Engine-specific params leaking into the host API** (Phase 55) — `physicsMode` / `waterAmount` / krita names on host types re-creates the phases 27-32 adapter failure. A5 (fake engine-2 payload round-trips with zero engine-1 types) is the detector. Format-identical is a *replay* guard, not a license to entangle types.
4. **Replay parity drift "fixed" with compat shims** (Phase 55) — capture the pre-split golden bake BEFORE moving anything; fix drift at the source (seed inputs, iteration order, schedule defaults); NEVER add a dual reader (clean break law).
5. **Porting the oracle unseeded randomness** (Phase 56) — `Math.random()` scatter/jitter/paperSeed must become seeded, arc-length-keyed draws; `paperSeed` is data. Define the A2 GPU pixel-delta tolerance honestly at plan time.

Also critical and easy to miss: opening 55 before 54 live UAT closes (vitest is blind to cross-webview/Tauri behaviour); wall-clock time in the host; baking paper into WebPs / forced Dry / live sim on the timeline; GPU texture footprint re-triggering the WKWebView OOM class (chunk ceiling 2000 kB is a lock); module switcher forking Studio or shipping Krita; duplicated spectral mixing; silent `.mce` field loss (every new field in TS **and** Rust + `mceFieldContract.test.ts`); eroded fail-closed Apply.

## Implications for Roadmap

Based on research, suggested phase structure (maps to locked phases 54-57 + the switcher/paper slices; user drives insertion via `gsd-phase --insert`):

### Phase 54: Preact 11 + signals hard gate
**Rationale:** Nothing later may build on a dead major; the probe is the milestone first hard gate.
**Delivers:** `preact@11.0.1` + `@preact/signals@2.11.3` + `lucide-preact@^1.57.0`; mechanical migration (3-file `JSX.*` type fix, property-aware style units, `RefObject` type annotations); single `preact` copy; `efx-physic-paint` peer floor -> `>=11`.
**Addresses:** the foundation everything else assumes; keeps signals-only law intact.
**Avoids:** Pitfalls 1-5 (probe, paintVersion cleanups, auto-px/JSX types, dual preact, premature 55).
**Hard stop:** R1.1 probe RED -> STOP and escalate as a blocking decision. Exit gate: R4.2 rows A1-A5 user-asserted live before 55 opens.

### Phase 55: `efx-paint-host` split (tranche 0b)
**Rationale:** Pay the generic seam ONCE before engines 2 and 3 exist; 55 is the hard prerequisite of both 56 and 57.
**Delivers:** host package (animation/, traceSeed, script envelope, time/, bake host); engine-1 re-pointed with replay parity vs pre-move golden; generic `StudioStroke<P>` + `EngineAdapter<P>`; fail-closed Apply contract.
**Uses:** tsup ESM build mirroring `efx-physic-paint`; no new deps.
**Implements:** ARCHITECTURE seam map sections 2.2-2.3.
**Avoids:** Pitfalls 6-10, 17 (host leakage, parity drift + shims, brush-pack "fix", new cancellation model, wall-clock, Apply erosion).
**Signature row:** A5 fake engine-2 payload compiles and round-trips with zero engine-1 types. First task is golden-bake capture, not file moves.

### Phase 56: `efx-watercolor` engine 2 + 10-paper pack + switcher slice
**Rationale:** Consumes the host seam; mixing may pull 57 content forward (locked fallback — never duplicate spectral code).
**Delivers:** clean-room WebGL2 fluid engine (`brush|water|pen|lift`, 14 tips + custom, 8-param surface); Studio script law for aquarelle A1-A5; paper pack -> Studio library for ALL paints; module switcher shell + per-module option drain (Krita inert).
**Uses:** raw WebGL2; `efx-spectral` (created early if needed); `finalizationQueue` pattern; `PaperPassTile`/`paperPass`; 52.1 WebP/LRU cache path.
**Implements:** EngineAdapter, 4th paint layer kind, module registry.
**Avoids:** Pitfalls 11-16 (oracle non-determinism, stale licence, paper/Dry/live-sim violations, GPU footprint, Studio fork / Krita ship, misplaced spectral).
**User decision at plan time:** oracle licence P1 (see Research Flags).

### Phase 57: `efx-spectral` hardening
**Rationale:** Owns the shared colour contract and MIT attribution; must not block 56 on ceremony — content may be created inside 56, 57 freezes the API for engine-1 adoption.
**Delivers:** vendored MIT reflectance data + `NOTICE`; CPU helpers + `displayBasisGLSL()`; CPU/GPU parity test (deltaE_OK approx 0.1-0.2); API freeze.
**Avoids:** Pitfall 16 (duplication/misplacement); licence breach on missing attribution.

### Phase Ordering Rationale

- **54 -> 55 -> 56 is hard** — the watercolour stack targets Preact 11; the host split is "pay once, ride forever"; 56 must not re-grow script/tick/bake machinery.
- **57 may interleave with 56** — if pigment work needs the package first, create `packages/efx-spectral` early inside 56; 57 then finishes NOTICE/tests/API freeze. Never fold spectral into the watercolor engine or the host.
- **Paper pack and switcher ride 56** — paper is engine-agnostic Studio library content; the switcher needs >=2 modules to be meaningful and is a consumer of the 55 seam. Layout/iconography are discuss-phase (user decides).
- **Krita, engine-1 spectral, Fill/Text/Shape/Hand are out** — v2.1.0+ only; the milestone is already large and clean-break + GPU work is the risk concentration.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase`):
- **Phase 56:** highest residual uncertainty — GPU determinism tolerance policy (A2), wet-region perf laws at HD, texture footprint budget, licence P1 outcome, layer-kind naming (UI-SPEC). The physics/look is method-specified but the runtime fit is not.
- **Phase 55:** seam map is well-specified from live code, but the golden-parity procedure and envelope/payload split of `physicsPaintRotoScriptSchema.ts` deserve a focused plan-time pass (Q1/Q2 types.ts shape).

Phases with standard patterns (skip research-phase):
- **Phase 54:** mechanical migration fully measured on the live tree; the gate is the probe + live UAT, not research.
- **Phase 57:** vendoring MIT data + tests + NOTICE is a known shape once 56 consumption is proven.

### Hard Stops, User Decisions, Plan-Time Items

**Hard stops:**
1. R1.1 signals probe RED -> STOP, escalate, do not shim or pin unofficial combos.
2. Phase 55 must not open until 54 R4.2 rows A1-A5 are user-asserted live (not "automated-ready").
3. No oracle/inkwash code copy until the licence decision is recorded; P1 stands meanwhile.
4. Never duplicate spectral mixing; never add compat/migration readers; never bump the 2000 kB chunk ceiling without an explicit user decision.

**User decisions:**
- Oracle licence at 56 plan time: relax P1 to "MIT port with attribution" or stay clean-room (record in PROJECT.md Key Decisions).
- `simplex-noise` vs in-house seeded noise (research recommends `simplex-noise@4.0.3`).
- Host Preact-free core vs default `./preact` entry (lean Preact-free; Q3).
- Module switcher placement/iconography/panel layout (discuss-phase gray zones — do not pre-decide).
- Chunk-budget line move, if shaders/spectral/papers pressure the 2000 kB ceiling.
- kmerp vs spectral sufficiency for engine 1 — only at v2.0.0 close, not now.

**Plan-time items:**
- Exact tick-grid value (~1/60 s) and types.ts split shape (paint-host Q1/Q2).
- 4th paint layer-kind naming (Water/Aquarelle/Wash — UI-SPEC).
- A2 determinism acceptance: stated pixel-delta threshold or CPU reference path (GPU float pipelines are not bit-stable).
- Raise `efx-physic-paint` peer floor and re-verify `pnpm why preact` single copy as 54 exit checklist.

### Contradictions Resolved / Flagged

| Tension | Resolution |
|---|---|
| STACK says signals/Preact 11 is GREEN; PITFALLS says never trust the peer range | **Both true.** Metadata + 2.11.3 fix justify no milestone block; the R1.1 probe + live UAT remain mandatory before the bump is accepted. |
| PITFALLS: on-disk oracle LICENSE is MIT; STACK/ARCH/FEATURES: unlicensed, clean-room only | **Unresolved — user decision at 56 plan time.** Until recorded, P1 stands (method only). The grill reopening clause ("if either ever lands an OSI licence...") may already be satisfied; the locked prohibition is what the plan inherits. |
| 57 scheduled after 56 but 56 needs spectral | **Locked fallback:** create `packages/efx-spectral` early inside 56 (or pull 57 forward); 57 hardens/freezes. Never inline mixing in the engine. |
| "Format-identical" split vs generic payload | Parity applies to **replay pixels** (R5.2), not type ownership. Host types are generic; engine-1 payload stays as-is (including legacy `timestamp` as an engine-1 detail only). |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | First-party peerDependency ranges + changelogs + npm metadata; blast radius measured on the live tree (171 `useRef`, 0 `defaultProps`, 3 `JSX.` files). Residual runtime risk is exactly what R1.1 + R4.2 close. |
| Features | HIGH | Oracle/local tree read directly (`BrushPreset`, `PaperPreset`, `Params`, tools); competitor tier MEDIUM (Rebelle page; Krita/CSP/Procreate knowledge tier). Scope is locked in PROJECT.md. |
| Architecture | HIGH | Seam map derived from locked specs + live inspection of `efx-physic-paint` and `app/`; MEDIUM only on spectral.js upstream API details (local `spectral.ts` is the working reference). |
| Pitfalls | HIGH | Upgrade-guide and codebase findings verified on disk; GPU bit-stability is LOW-MEDIUM (general knowledge) — treat as a design constraint to specify, not a measured claim. |

**Overall confidence:** HIGH

### Gaps to Address

- **Oracle licence verdict** — re-verify on-disk LICENSE + upstream at 56 plan time; explicit user decision on P1; record in Key Decisions. Until then, clean-room only.
- **GPU determinism policy** — define A2 acceptance shape (pixel-delta threshold vs CPU reference) at plan time; do not discover it mid-56.
- **Tick-grid exact value and types.ts split** — plan-time pins for 55 `time/` module and envelope/payload split.
- **Paper-pack memory footprint** — 10 tile pairs at HD stress the deferred cache-footprint issue; generate at working resolution on demand and measure before stacking.
- **Licence/NOTICE hygiene checklist** — `efx-spectral` ships `NOTICE`; whatever is reused after the licence decision carries attribution; Mixbox stays banned; fonts stay out.

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`) — preact, @preact/signals, lucide-preact, @preact/preset-vite, spectral.js, simplex-noise, motion-canvas-vite-plugin peers/versions
- Preact 11 upgrade guide — https://preactjs.com/guide/v11/upgrade-guide/ (breaking-change list; zero signals mentions)
- @preact/signals releases — 2.11.3 Preact-11 deferred-dispose fix; peer `>= 10.25.0 || >=11.0.0-0`
- rvanwijnen/spectral.js — MIT method + reflectance data (attribution required)
- Locked specs: `SPECS/v1.1.0-preact11/context.md`, `SPECS/v1.1.0-paint-host/context.md`, `SPECS/v1.1.0-water-color/{00-grill,01-gsd}-context.md`
- Live code: `packages/efx-physic-paint` (animation/, traceSeed, types), `app/.../physicsPaintRotoScriptSchema.ts`, `finalizationQueue.ts`, `paperPass.ts`, `mceFieldContract.test.ts`
- `.planning/PROJECT.md` — v2.0.0 milestone lock (semver, clean break, invariants)

### Secondary (MEDIUM confidence)
- Local oracle `SPECS/v1.1.0-water-color/watercolor-playground/` — method/behaviour reference only; **on-disk LICENSE is MIT (2026 Maksim Surguy) contradicting the grill no-licence premise — user decision required**
- Rebelle product page — competitor feature tier (marketing-level)
- GPU float bit-stability — general rendering knowledge; specify tolerance, do not treat as measured

### Tertiary (LOW confidence)
- Krita / CSP / Procreate feature knowledge tier (docs URLs 404 at research time)

---
*Research completed: 2026-10-14*
*Ready for roadmap: yes*
