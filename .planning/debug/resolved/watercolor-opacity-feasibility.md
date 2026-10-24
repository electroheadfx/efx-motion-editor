---
status: resolved
trigger: "Water color per-stroke global opacity feasibility — can aquarelle bake isolate one stroke's contribution so it can be alpha-composited without altering wet-on-wet behaviour? Prove it on engine 2 with a scratch sheet/FBO, a fixed seed, and a parity pin that opacity 100 reproduces today's bake. No UI, no schema, no persistence. Verdict: viable architecture + cost, or blocked with evidence. The current dialog row is left as-is (Water color Geometry 'Opacity' = Pigment) until you decide which path to take."
created: 2026-10-24
updated: 2026-10-24
---

# Debug Session: watercolor-opacity-feasibility

## Symptoms

- **Expected behavior:** A defensible verdict. Either (a) viable architecture — the aquarelle bake can isolate a single stroke's contribution into a scratch sheet/FBO, composite it with global alpha, and preserve wet-on-wet behavior — plus measured cost, or (b) blocked, with evidence naming the state/ordering dependency that makes isolation impossible. Opacity 100 must reproduce today's bake.
- **Actual behavior:** Unknown today (feasibility question, not a reported regression). The Studio dialog row "Water color → Geometry → Opacity" currently means Pigment, not global alpha, and is intentionally left as-is pending the verdict.
- **Errors:** none reported.
- **Timeline:** Raised 2026-10-24. Not a regression; no prior behavior to compare.
- **Reproduction:** On engine 2, with a fixed seed, render the same stroke sequence two ways — (a) the existing bake path, (b) an isolated-stroke scratch sheet/FBO composited at global opacity 100 — then pixel-compare. Also compare wet-on-wet sequences (stroke over wet stroke).

## Scope contract (user-confirmed 2026-10-24)

- **Deliverable:** Probe + measured cost + viable/blocked verdict.
- **Parity bar:** Tight pixel tolerance — ≤1 LSB per channel on ≥99% of pixels at opacity 100, same fixed seed.
- **Probe location:** Test/scratch harness only. Import engine internals freely; zero product-code behavior change.
- **Excluded:** No UI, no schema, no persistence, no shipped feature.

## Current Focus

- hypothesis: H1 (viable) — a stroke's contribution is a deterministic function of (incoming sheet state, stroke input, seed), and a scratch sheet/FBO seeded with the incoming sheet state can reproduce the stroke's deposition in isolation; scaling that isolated contribution at composite time yields global opacity without altering wet-on-wet. H2 (blocked) — wet-on-wet depends on intra-stroke readback of the accumulating sheet and/or a shared RNG stream/state, so the stroke cannot be isolated without changing its evolution.
- test: Real-WebGL2 probe in headless Chrome (Vitest cannot exercise the GPU path: its mock canvas returns no `webgl2`, so the engine is null and every capture is zero). The probe replicates the adapter's bake driver exactly, runs three sequences on a shared 256×256 sheet (`wet-on-wet` water 78 → flat-dry 90 ticks; `dry-on-dry` fully dried 600/300 ticks; `three-stroke` 8/90/300 ticks), and at every stroke boundary compares the shared after-frame with (a) a scratch restored from the public `DocumentSnapshot`, (b) a scratch restored from the snapshot plus the omitted private state (velocity/pressure, divergence/curl, ping-pong write halves, wetMask, `lastDir`/`lastAngle`, flow/fix/awake scalars, active/painted/everPainted rects). It also compares each stroke painted alone on blank paper, transmittances multiplied, against the shared final frame; measures the signed per-boundary delta; checks the alpha channel; pins opacity-100 crossfade identity; and measures clone/scratch memory.
- expecting: If H1 — parity passes and opacity < 100 is reachable by scaling at composite time. If H2 — parity fails and the failing state dependency is named.
- next_action: none — verdict recorded below. Do not change the dialog's Water color Opacity row (still Pigment) until a display-path implementation is explicitly chosen.

## Evidence

- timestamp: "2026-10-24T21:34:00"
  observation: "Engine 2 is `@efxlab/efx-watercolor`. The real bake path is `src/adapter/engineAdapter.ts` driving the vendored WebGL2 `WatercolorEngine` in `src/playground/Engine.ts`; `src/engine/fluid.ts` is a separate clean-room core and is not on the bake path. The adapter installs `setManual(true)`, a virtual clock, and `setRandom(seededRandom(1))`, then per stroke `engine.setRandom(seededRandom(stroke.traceSeed || 1))`."
  source: "/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/adapter/engineAdapter.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/Engine.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/bake/aquarelleBake.ts"

- timestamp: "2026-10-24T21:34:30"
  observation: "Vitest is blind to the real path: `src/adapter/engineAdapter.test.ts` gates GPU pins on `hasWebGL2()`, and the jsdom mock canvas has no `webgl2` context, so the engine is null and captures are all-zero. A real parity probe must run in a browser/webview. Headless Chrome (`--headless=new`) exposes WebGL2 plus `EXT_color_buffer_float` and `EXT_color_buffer_half_float` with complete half-float FBOs (measured; renderer `WebKit WebGL`)."
  source: "/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/adapter/engineAdapter.test.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/watercolor-opacity/run.mjs"

- timestamp: "2026-10-24T21:37:00"
  observation: "Driver fidelity: the probe rig matches `createAquarelleEngineAdapter` exactly — 100% of pixels within 1 LSB, maxAbs 0. The probe therefore exercises the real bake path, not an approximation."
  source: "/tmp/watercolor-opacity-probe/result.json (driverValidation)"

- timestamp: "2026-10-24T21:37:10"
  observation: "Determinism with the paper seed pinned: two fresh engines reproduce exactly (100% within 1 LSB, maxAbs 0). With the paper seed unpinned they diverge (96.31% within 1 LSB, maxAbs 153): `createDocument` draws `paperSeed = this.rng()` during construction, before the adapter installs `seededRandom(1)`, so `paperSeed` comes from `Math.random`. Any scratch isolation must restore/clone the paper seed (or pin `Math.random` around construction)."
  source: "/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/Engine.ts:388; /tmp/watercolor-opacity-probe/result.json (determinism, unseededPaper)"

- timestamp: "2026-10-24T21:37:20"
  observation: "Complete-state clone: 7/7 stroke boundaries across all three sequences reproduced the shared after-frame exactly (100% within 1 LSB, maxAbs 0), including both wet-on-wet boundaries. A stroke's evolution IS a deterministic function of the complete incoming state plus its per-stroke seed; isolation is technically possible."
  source: "/tmp/watercolor-opacity-probe/result.json (scenarios[].scratch[].augmentedClone)"

- timestamp: "2026-10-24T21:37:30"
  observation: "Public `DocumentSnapshot` is NOT sufficient to seed an exact scratch on a wet/damp sheet: worst boundary 88.69% within 1 LSB (maxAbs 171). It passes only after a fully dried preceding stroke (dry-on-dry boundary 1: 100%, maxAbs 0) and narrowly misses on a mixed boundary after 90 ticks (three-stroke boundary 2: 98.56% within 1, maxAbs 8). It omits velocity/pressure, `lastDir`/`lastAngle`, `flowSpeed`/`growCarry`/`fixTimer`/`autoFix`/`minAwakeUntil`, `wetMask`/`maskCounter`, and the ping-pong write halves; `restore()` also zeroes velocity/pressure."
  source: "/tmp/watercolor-opacity-probe/result.json (scenarios[].scratch[].publicSnapshot); /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/Engine.ts:548-600"

- timestamp: "2026-10-24T21:37:40"
  observation: "Independent isolated layers do not recompose: each stroke painted alone on blank paper, transmittances multiplied, versus the shared final frame — wet-on-wet 88.72% within 1 LSB (maxAbs 171), three-stroke 88.26% (maxAbs 139), dry-on-dry 99.67% (maxAbs 24). Only the fully dried two-stroke case meets the 99% bar; wet-on-wet cross-coupling cannot be decomposed into per-stroke layers."
  source: "/tmp/watercolor-opacity-probe/result.json (scenarios[].independentLayersMultiply)"

- timestamp: "2026-10-24T21:37:50"
  observation: "Every captured frame is fully opaque: alpha min 255, max 255, non-opaque 0 in all scenarios. `displayFS` MODE.transparent emits `vec4(toSRGB(rgb), 1.0)` — transmittance RGB with alpha 1, composited with CSS MULTIPLY over the fond. There is no RGBA alpha channel in the current export contract, so a literal 'alpha-composite the stroke layer' has nothing to composite against."
  source: "/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/shaders.ts (displayFS); /tmp/watercolor-opacity-probe/result.json (scenarios[].alpha)"

- timestamp: "2026-10-24T21:38:00"
  observation: "A stroke on a shared sheet can lighten existing paint, not only darken it: wet-on-wet boundary 2 changed 14.94% of pixels, 9.64% darker, delta range -189..+85; three-stroke boundary 3 changed 17.69%, 10.73% darker, range -127..+50; dry-on-dry boundary 2 changed 8.92%, all darker, range -146..0. A non-negative per-stroke over-composite cannot reproduce the lightening/bleach component."
  source: "/tmp/watercolor-opacity-probe/result.json (scenarios[].deltaForLastStroke)"

- timestamp: "2026-10-24T21:38:10"
  observation: "Opacity-100 display pin: `crossfade(before, after, 1)` equals the captured after-frame exactly (100% within 1 LSB, maxAbs 0) on every scenario. Opacity < 100 is a display blend of the two already-captured cumulative frames (or their signed delta); the simulation and wet-on-wet behaviour are untouched. At 50%, the blend changes 14.04% (wet-on-wet), 8.66% (dry-on-dry), and 16.84% (three-stroke) of pixels versus the before frame."
  source: "/tmp/watercolor-opacity-probe/result.json (scenarios[].crossfadeOpacity100, crossfadeAt50VsBefore)"

- timestamp: "2026-10-24T21:38:20"
  observation: "Measured cost. Exact scratch clone: 68.0 B/texel at 256×256 (the fixed 256-short-side sim grid dominates that small doc); at production sizes ~52 B/texel = 157.4 MiB at 2048×1536 and 352.4 MiB at 3072×2304. A live scratch engine adds 56 B/texel: clone + scratch ≈ 326.8 MiB and 731.9 MiB respectively. Retaining one clone per stroke is 15.37 GB at 2048×1536 and 34.42 GB at 3072×2304 for 100 strokes. The display crossfade needs no extra FBO and no extra simulation: the before-frame is the previous captured cumulative frame; one RGBA8 frame is 12 MiB at 2048×1536 if materialized."
  source: "/tmp/watercolor-opacity-probe/result.json (memory, examples); /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/Engine.ts:134-139"

- timestamp: "2026-10-24T21:38:42"
  observation: "No product code was touched. The full watercolor suite passes: 9 files, 130 tests passed, 4 skipped (the pre-existing GPU pins). Probe sources live outside `src/` and are not collected by Vitest or the package build."
  source: "pnpm --filter @efxlab/efx-watercolor exec vitest run"

## Eliminated

- **Public `DocumentSnapshot` as the scratch seed** — fails the parity bar on wet/damp boundaries (88.69% within 1 LSB, maxAbs 171). It is a persistence snapshot, not a full simulation-state clone.
- **Independent per-stroke RGBA layers recomposed by multiplication** — fails wet-on-wet (88.72%) and three-stroke (88.26%); only the fully dried two-stroke case passes (99.67%, maxAbs 24). Wet-on-wet cross-coupling is not decomposable into stroke-alone layers.
- **Alpha-compositing the current export** — impossible as stated: every frame is alpha 255 (opaque transmittance), and `MODE.transparent` has no alpha application.
- **Reducing deposition to fake opacity** — this changes pigment amount in the sheet and therefore wet-on-wet behaviour; it is also what the dialog's existing Pigment (`load`) row already does, not a global opacity.
- **Unseeded scratch creation** — two unpinned engines diverge (96.31% within 1 LSB, maxAbs 153) because `paperSeed` is drawn from `Math.random` before the adapter's seeded RNG is installed.

## Resolution

- root_cause: The requested architecture is blocked as stated, for three independent reasons: (1) the bake's output contract is opaque transmittance (`vec4(toSRGB(rgb), 1.0)`, alpha 255), so there is no RGBA alpha layer to composite; (2) wet-on-wet is a nonlinear shared-sheet coupling — isolated stroke-alone transmittances do not recompose to the shared bake (88.3–88.7% within 1 LSB on wet sequences), and a stroke can lighten existing paint, which a non-negative over-composite cannot represent; (3) the public `DocumentSnapshot` cannot seed an exact scratch on a wet/damp sheet (worst 88.69% within 1 LSB, maxAbs 171) because it omits velocity/pressure, `lastDir`/`lastAngle`, flow/fix/awake scalars, wetMask/maskCounter, and the ping-pong write halves. Exact isolation IS possible with a private complete-state clone (100% within 1 LSB, maxAbs 0 at 7/7 boundaries), but that clone is costly (~52 B/texel plus a 56 B/texel scratch engine: ~327 MiB combined at 2048×1536, ~732 MiB at 3072×2304) and is not needed for the viable path.
- verdict: **BLOCKED for isolated per-stroke RGBA alpha layers. VIABLE only as a display-space cumulative-frame crossfade/delta.** Opacity 100 is the already-captured after-frame (exact identity, 0 LSB). Opacity < 100 blends the already-captured before/after cumulative frames (or applies their signed delta to later frames) with no change to the simulation, so wet-on-wet behaviour is untouched. This is a display/export property, not a physical pigment reduction; it does not create editable per-stroke layers.
- viable_architecture: At bake/export time, keep the existing per-stroke cumulative frames (already produced). For a stroke at opacity a, composite `before + a·(after − before)` per pixel (or its signed delta form across later frames). Exact at a = 1; no extra simulation and no per-stroke FBO. If a fade must persist across later strokes, apply the signed per-boundary delta to subsequent frames with an explicit clipping policy (the delta can lighten and darken); validate the look before shipping. If exact per-stroke re-simulation is ever required for another feature, add a private `cloneForStroke()` inside `Engine` using same-context GPU blits (not the public snapshot, not cross-context readback).
- measured_cost: Display path — zero extra simulation, zero extra FBO; one RGBA8 frame if materialized (12 MiB at 2048×1536, 27 MiB at 3072×2304), otherwise reuse the consecutive captured frames; per-pixel blend at display/export. Exact scratch path — ~52 B/texel clone (157.4 MiB at 2048×1536; 352.4 MiB at 3072×2304) + 56 B/texel live scratch engine = ~326.8 MiB / ~731.9 MiB transient; 100 retained clones = 15.37 GB / 34.42 GB.
- opacity_100_parity: Passes exactly — crossfade(before, after, 1) matches the captured after-frame at 0 LSB on all scenarios; the existing bake is unchanged.
- fix: not applied. This was a feasibility session within a scope that explicitly forbids product-code behaviour changes; the probe and parity pin are the gate artifacts, not a shipping fix. No UI, schema, persistence, or engine code was changed.
- files_changed: /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/watercolor-opacity/probe.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/watercolor-opacity/index.html; /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/watercolor-opacity/run.mjs (test/scratch harness, outside `src/`; unshipped)
- verification: `node /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/watercolor-opacity/run.mjs` → `/tmp/watercolor-opacity-probe/result.json`; full package suite `pnpm --filter @efxlab/efx-watercolor exec vitest run` → 130 passed, 4 skipped (pre-existing GPU pins).
- recommendation: Keep the Studio dialog row "Water color → Geometry → Opacity" mapped to Pigment (`load`) for now. If global opacity is pursued, implement the display crossfade/delta at bake/export — do not build per-stroke scratch-FBO layers or alpha-composite the current opaque export. Open the implementation as its own scoped task; this session deliberately ships nothing.
