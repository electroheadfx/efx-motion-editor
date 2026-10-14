# Stack Research

**Domain:** Stack additions/changes for the v2.0.0 multi-module paint workstation (Preact 11 bump · `efx-paint-host` split · `efx-watercolor` engine 2 · `efx-spectral` shared spectral package · 10-procedural-paper pack · module switcher)
**Researched:** 2026-10-14
**Mode:** Ecosystem (stack decisions for NEW capabilities only)
**Confidence:** HIGH on declared package compatibility (first-party peerDependency ranges + first-party changelogs); MEDIUM on runtime fit of our specific effect patterns (that is exactly what Phase 54 R1.1 probe + R4.2 live UAT exist to close)

---

## HARD GATE: `@preact/signals` ↔ Preact 11

**Verdict: GREEN** — declared compatibility is explicit, first-party, and current. The official Preact 11 upgrade guide is silent on signals (the spec's premise was correct), **but the package's own `peerDependencies` field states it.**

### Exact versions

| Package | Currently pinned | Recommended | Latest (2026-10-14) |
|---|---|---|---|
| `preact` | `10.29.8` | **`11.0.1`** | `11.0.1` (11.0.0 → 2026-09-30; 11.0.1 → 2026-10-08) |
| `@preact/signals` | `2.11.2` | **`2.11.3`** | `2.11.3` (released 2026-09-30 — same day as Preact 11.0.0) |

### Quoted peerDependency ranges (npm registry, verbatim)

```
@preact/signals@2.11.2  peerDependencies: { "preact": ">= 10.25.0 || >=11.0.0-0" }
@preact/signals@2.11.3  peerDependencies: { "preact": ">= 10.25.0 || >=11.0.0-0" }
```

`>=11.0.0-0` is npm's prerelease-inclusive major-11 range: it accepts `11.0.0-beta.*`, `11.0.0-rc.*`, `11.0.0`, and `11.0.1`. The range has been present since `@preact/signals@2.8.0` — Preact 11 support is long-declared, not a last-minute patch.

### Corroborating first-party changelog (the runtime half)

`@preact/signals@2.11.3` release notes, authored by the Preact team (JoviDeCroock):

> Don't re-run a `useSignalEffect` for a component that was unmounted by the same update. **Preact 11 disposes it after paint**, so the effect could otherwise run once more against an unmounted component.

This is the signals maintainers explicitly coding against Preact 11's new deferred-cleanup semantics — the exact change our `paintVersion` subscription law cares about. `2.11.3` is the Preact-11-ready release; `2.11.2` predates Preact 11.0.0 by 26 days and does not carry this fix.

### Why the guide's silence is not a red flag

The Preact 11 upgrade guide (`https://preactjs.com/guide/v11/upgrade-guide/`) contains **zero** mentions of `@preact/signals`, signals versions, or a required signals upgrade. That is expected: `@preact/signals` is a **separately versioned package** with its own release cadence and its own peer range. Compatibility is declared in `package.json`, not in the framework upgrade guide. The guide's own package-compatibility notes cover only `preact-root-fragment`, `preact/compat` CJS wrappers, and `createPortal`.

### Residual risk (not the gate — the gate is GREEN)

What is **not** proven by metadata alone: that *this codebase's* effect-subscription patterns survive the deferred-cleanup change at runtime. That is a live-behaviour question, and Phase 54 already designs the answer:

- R1.1 throwaway probe (run **before** the bump, as specified)
- R2.4 explicitly re-verifies `paintVersion` render-effect subscriptions still tear down, and **forbids** rewriting them into React-style cleanups
- R4.2 A1–A5 live UAT rows close the question on visible behaviour before Phase 55 opens

**Do not skip the probe.** GREEN means "the publisher declares support and has shipped a Preact-11-specific fix" — it does not mean "skip verification." It does mean the milestone is **not** blocked on an unknown.

### Gate-blocker that WAS found: `lucide-preact`

| Package | Pinned | Its `peerDependencies` | vs Preact 11 |
|---|---|---|---|
| `lucide-preact@0.577.0` | `^0.577.0` | `{ "preact": "^10.27.2" }` | **RED** — range excludes 11 |
| `lucide-preact@1.49.0` | — | `{ "preact": "^10.27.2" }` | **RED** |
| `lucide-preact@1.50.0` | — | `{ "preact": "^10.27.2 \|\| ^11.0.0-0" }` | **GREEN** — first version that allows 11 |
| `lucide-preact@1.57.0` (latest) | — | `{ "preact": "^10.27.2 \|\| ^11.0.0-0" }` | **GREEN** |

**`1.50.0` is the exact floor.** The currently pinned `0.577.0` will peer-warn (or hard-fail under strict pnpm resolution) against Preact 11. This is the one companion-package bump the milestone needs; it resolves the preact11 spec's open question Q2.

---

## Recommended Stack Changes (summary)

| # | Change | From | To | Kind |
|---|---|---|---|---|
| 1 | `preact` | `10.29.8` | `11.0.1` | major bump (Phase 54) |
| 2 | `@preact/signals` | `2.11.2` | `2.11.3` | patch bump — carries the Preact 11 deferred-dispose fix |
| 3 | `lucide-preact` | `^0.577.0` | `^1.57.0` | **required** bump (peer floor 1.50.0) |
| 4 | `packages/efx-paint-host` | — | new workspace package | **no new deps** — pure extraction |
| 5 | `packages/efx-spectral` | — | new workspace package | **no new runtime deps** — vendored MIT data + our ESM implementation |
| 6 | `packages/efx-watercolor` | — | new workspace package | **no new runtime deps** — clean-room WebGL2 |
| 7 | procedural paper pack | — | 10 papers → `PaperPassTile` | **one optional 3 KB dep** (`simplex-noise`), else none |

**Net new third-party runtime dependencies for the entire milestone: at most one (`simplex-noise`).** Everything else is either a version bump of something already present or a workspace-internal package split.

---

## Recommended Stack

### Core Technologies (changes only — everything else is unchanged)

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| `preact` | `11.0.1` | UI framework, all surfaces | Watercolour reference stack targets Preact 11; engines 2 and 3 must not be built on a dead major. 11.0.1 is the current stable patch. The bump is a **deliberate sequencing gate**, not a hard dependency of the engine (the engine is Preact-free) — do not unlock watercolour work early. |
| `@preact/signals` | `2.11.3` | Reactive state (the project's only state layer) | Same major line as today (2.x), so **no reactivity rewrite**. 2.11.3 specifically fixes `useSignalEffect` against Preact 11's deferred dispose. Keeps `feedback_no_usestate_only_signals` intact — still signals only, no `useState`, no React, no new state library. |
| `@preact/preset-vite` | `2.10.6` (unchanged) | Vite integration | Its peers are `vite: 2.x\|\|…\|\|8.x` + `@babel/core: 7.x` — **no `preact` peer at all**, so it needs no bump for Preact 11. |
| TypeScript | `~5.9.3` (unchanged) | Types | Preact 11 requires **TS ≥ 5.1**. We are on 5.9.3 — comfortably green. **Do not** jump to TypeScript 7.x (a different compiler generation, out of scope). |
| `lucide-preact` | `^1.57.0` | Icons | Required companion bump. Floor for Preact 11 is `1.50.0`. |

### Per-feature stack

#### (a) Preact 11 bump — Phase 54

Additions: **none** beyond the bumps above. This is a dependency + mechanical migration.

Breaking-change surface verified against the official upgrade guide, with our blast radius measured on the live tree:

| Preact 11 breaking change | Affects this repo? | Measured blast radius |
|---|---|---|
| ESM-only (`.module.js` / CJS / UMD removed) | Low | Both packages are `"type": "module"` already; `efx-physic-paint` publishes `.mjs` via tsup. Verify `exports` maps + `@preact/preset-vite` resolution (R2.1). |
| `useRef` now requires an initial value | **None found** | 171 `useRef(` call sites; **0** match `useRef()` / `useRef<T>()` with no arg. Already compliant. Re-verify at typecheck (R2.2). |
| `defaultProps` → `preact/compat` | **None found** | Zero `defaultProps` occurrences in `app/src` or `packages/`. |
| Automatic `px` suffixing → `preact/compat` | Negligible | Style objects use explicit string lengths (`'12px'`, `'34px'`) or CSS vars. Audit numeric-only style values at typecheck (R2.3). |
| `useEffect` cleanups deferred until after paint | **Yes — but already the project's shape** | Project law is `paintVersion` bump-and-subscribe in render effects (`feedback_paintversion`); it does **not** rely on effect cleanup for correctness. R2.4 re-verifies teardown and **forbids** rewriting into React-style cleanups. The signals 2.11.3 fix is aimed at exactly this change. |
| `JSX.*` namespace reduced; most types move to `preact` | Small | 29 `JSX.` references across **3 files** (`NumericStepper.tsx`, `SliderStepper.tsx`, +1). Mechanical type-import fix (R2.5). |
| `render()` third arg `replaceNode` removed | **None found** | Two `render(<App/>, root)` call sites in `main.tsx`, no third argument. |
| `Component.base` removed | **None found** | — |
| `SuspenseList` removed from compat | **None found** | — |
| Refs forwarded by default; `forwardRef` unnecessary | Low | `createPortal` / `memo` are imported from `preact/compat` (5 sites) — `createPortal` is now in core but **compat still re-exports it**, so imports keep working. |

**Conclusion for (a):** the migration is genuinely mechanical and small. The two real tasks are the type-import fix (3 files) and the `lucide-preact` bump. No `useState`/React/state-library introduction is warranted or permitted.

#### (b) `packages/efx-paint-host` — Phase 55

**No new dependencies.** This is a move + contract extraction out of `packages/efx-physic-paint`:

- Moves: `animation/` (player + progressive/static schedules + recorded motion), `util/traceSeed.ts` (FNV-1a), the script **envelope**, tick + `diffusionFrames` timing.
- Build: same as `efx-physic-paint` — **`tsup`** (already a devDep there, `^8.5.1`), `"type": "module"`, `exports` map with a root entry.
- **Preact-free by default.** The watercolour engine is Preact-free; the host should be too. If a Preact binding is ever needed, it goes in a `./preact` entry exactly like `efx-physic-paint` does today (open question Q3 — lean Preact-free core + optional `./preact` entry).
- API shape: generic over the per-engine stroke payload (`pts`, `ticks`, `cuisson`, `motion`, `brush id` + `toolOverrides`). Never `waterAmount` / `physicsMode` / krita property names in the host surface.

#### (c) `packages/efx-watercolor` — Phase 56 (engine 2, paint-aquarelle)

**No new runtime dependencies.** Clean-room reimplementation of published physics; the licence boundary forbids vendoring the reference.

| Need | Choice | Why |
|---|---|---|
| GPU fluid grid (velocity / wet / mobile pigment / fixed pigment / paper) | **Raw WebGL2** | The repo already runs WebGL2 (`glBlur.ts`, `glslRuntime`, `glMotionBlur`) in WKWebView. The reference engine is explicitly UI-free WebGL2. No Three.js / regl / Pixi — a single extra WebGL abstraction would fight the existing GL seams and the determinism law. |
| Float render targets | WebGL2 `RG16F` / `RGBA16F` via `EXT_color_buffer_float` / `EXT_color_buffer_half_float` | Platform-native; no wrapper library. |
| Pigment colour model | **`packages/efx-spectral`** (workspace) | Mandatory consumer. Never duplicate mixing code inside the engine. |
| Determinism | existing `traceSeed` philosophy (FNV-1a per stroke) + fixed tick grid (~1/60 s, integer ticks) | Host-owned timing. No `Math.random()` / bare `rand()` in deposit or sim paths. |
| Brush pack | data records + snapshot travelling in `.mce` | Deliberate exception to the 52.2 refs-only law. |
| Baking | existing `finalizationQueue` pattern (Effect v4 bounded turn queue) | **No Web Worker.** Port the pattern; do not invent a new cancellation model. |

Texture layout to implement (from the reference's published shader comments — method, not code):

```
velocity  RG16F   sim grid     water flow (sim texels / s)
wet       R16F    doc grid     standing water (dries over time)
ink       2×RGBA16F            mobile pigment: A = absorbance 0..3, B.rgb = 4..6, B.a = gouache
fixed     2×RGBA16F            settled pigment (no white)
paper     RGBA8                r = lit relief, g = height, b = mottle, a = fleck
```

Perf laws to honour: simulate only the wet region (wet-mask readback), stop when dry, cap sheet (~2048×1536 / MAX_DOC_PIXELS), bounded undo tiles.

#### (d) `packages/efx-spectral` — Phase 57 (shared MIT spectral package)

| Need | Choice | Why |
|---|---|---|
| Colour model | Own ESM package implementing the **published single-constant Kubelka-Munk / spectral.js method** | Licence table in the watercolour spec: `rvanwijnen/spectral.js` is **MIT** — "method and reflectance data may be used, with attribution." The watercolour oracle itself is unlicensed (clean-room only), so the method must be sourced from the MIT project, not from the reference tree. |
| Upstream | `spectral.js@3.0.0` on npm (MIT, `main: spectral.js`, **no `exports` map, no `module`, no `type`**) | Do **not** add it as a runtime dependency: it is a script-style bundle, not ESM, and our monorepo (and Preact 11) is ESM-only. Instead **vendor the MIT reflectance basis data** into `packages/efx-spectral` with a `NOTICE` file attributing `rvanwijnen/spectral.js`, and implement our own ESM surface. |
| Surface | 7-coeff absorbance basis (white, cyan, magenta, yellow, red, green, blue), 16-band quadrature display, **CPU helpers + GLSL basis export** | The watercolour engine needs the basis as GPU-friendly data (uniforms/textures), which is a different shape from upstream's `mix()` API. Engine 1 adopts the same package in v2.1.0 (replacing the `mixSubtractive` RYB heuristic). |
| Placement | `packages/efx-spectral` — **not** inside `efx-watercolor`, **not** inside `efx-paint-host` | Inside watercolour would make engine 1 depend on engine 2. Inside the host would turn the Studio law into a colour toolbox. Both rejected in the spec. |

API shape to aim for: pure functions, no I/O, no DOM, deterministic, tree-shakeable. Zero runtime dependencies.

#### (e) 10-procedural-paper pack

Rides Phase 56. Target shape is already in the repo: `PaperPassTile { valley: HTMLCanvasElement; peak: HTMLCanvasElement }` from `app/src/lib/paperPass.ts` — conditioned height map → valley (multiply) + peak (lighten) maps, applied by `drawImage` + `globalCompositeOperation` at the composite seam. **Paper is composite-only**: no rebake on paper change, swap tiles.

| Need | Choice | Why |
|---|---|---|
| Procedural fields (height / mottle / fleck) | Clean-room generation, seeded | Must satisfy the determinism law. |
| Seeded noise | **`simplex-noise@4.0.3`** (MIT, 0 deps, `sideEffects: false`, ESM+CJS) — **optional** | Its API is `createNoise2D(random?: PRNG)`, so it is deterministic when handed a seeded PRNG. ~3 KB unpacked overhead beyond the PRNG. A tiny in-house seeded value-noise + hash-noise is an acceptable alternative if the project prefers zero new deps; fractal octaves + a fleck field are ~100 lines. **Recommendation: take `simplex-noise`** — subtle non-determinism in hand-rolled gradient noise is a known footgun and this package is explicitly designed for seeded use. |
| Seeded PRNG | In-house (FNV-1a-seeded xorshift or mulberry32) — **no dep** | Same family as `traceSeed`. Do not add `alea` / `seedrandom` for one PRNG. |

The 10 papers (cold press, hot press, rough, khadi, washi, kraft, …) are **data + generation parameters**, not shader copies. Export each as height-map tiles in the `PaperPassTile` shape and register them in the **Studio paper library**, usable by every paint (normal, physic, aquarelle, and later krita) through the same `paperPass`.

#### Module switcher (Brush | Water color | Krita)

**No new dependencies.** A top-bar control over the one shared Studio engine; modules drain their own options/features into the panels. Krita is the v2.1.0 slot — do not implement it. Gray zones (placement, iconography, panel layout) are discuss-phase scope.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|---|---|---|
| **Mixbox** (any form — code, LUTs, spectra) | **CC BY-NC** — already banned project-wide; not needed here | `packages/efx-spectral` (MIT) for subtractive pigment mixing |
| Any code / shader transliteration from `SPECS/v1.1.0-water-color/watercolor-playground-main/` (= `msurguy/watercolor-playground`) or `johnowhitaker/inkwash` | **Both unlicensed.** Clean-room rule is hard | Reimplement the published physics (Beer–Lambert glazes, wet-gated pigment fluxes, capillary tide line, fix/dry, procedural paper tooth) in our own TS/WebGL, seeded through existing determinism machinery |
| `spectral.js` as a **runtime dependency** | npm package is a script-style bundle (`main: spectral.js`, no `exports`/`module`/`type`) — not ESM; fights Preact 11's ESM-only world | Vendor the MIT data into `packages/efx-spectral` + own ESM surface + `NOTICE` attribution |
| **Web Worker** for the bake host | Explicitly out of scope (Phase 55 R4, watercolour R3.3). WebGL2 + canvas encode are main-thread anyway | Port the `finalizationQueue` pattern (Effect v4 bounded turn queue, generation-stale commits, `beginFlush`) |
| React, `useState`, or any new state/reaction library | Project law (`feedback_no_usestate_only_signals`); Preact 11 does not change this | `@preact/signals` (bumped to 2.11.3) |
| Blind React migration codemods | This is Preact, not React | Mechanical fixes listed in Phase 54 R2 only |
| Rewriting `paintVersion` subscriptions into effect-cleanup patterns | Preact 11 defers cleanups; the project deliberately does **not** depend on cleanup for correctness | Keep bump-and-subscribe (`feedback_paintversion`); R2.4 forbids the rewrite |
| A flat shared `PaintScript` for every engine, or a standalone parallel script library | Kills per-engine brush vocabularies / breaks the Studio law | Shared Studio **envelope** + per-engine stroke **payload** + fail-closed Apply |
| Engine-specific params in the host API (`waterAmount`, `physicsMode`, krita property names) | Host must stay generic over the payload | Payload lives in the engine slot the host carries opaquely |
| GPU fluid sim on the timeline | Cache is the only playback path | Bake to WebP, timeline reads cache only |
| Forced Dry at frame boundaries | Kills the wet-in-wet / tide-line look the engine is bought for | Per-stroke `diffusionFrames` (cap 600), script-owned duration |
| Vite 6/7/8 bump | `@efxlab/motion-canvas-vite-plugin@4.0.0` peers `vite: 4.x\|\|5.x`; the v0.9.0 decision pins **Vite 5.4.21** (delicately patched interop) | Stay on `5.4.21` |
| TypeScript 7.x | Different compiler generation; not required (Preact 11 needs TS ≥ 5.1) | Stay on `~5.9.3` |
| `alea` / `seedrandom` / `@thi.ng/random` | One seeded PRNG does not justify a dependency | In-house FNV-1a-seeded PRNG |
| Three.js / regl / Pixi / WebGL abstraction layer | Would fight the existing `glBlur` / `glslRuntime` / `glMotionBlur` seams and the determinism law | Raw WebGL2, same as the existing GL modules |
| Backward-compat shims, dual-format readers, migration code | **CLEAN BREAK ACCEPTED** (2026-10-14, do not reopen) | Fail-closed: any unreadable script/asset refuses with a named visible error (53.1 law) |
| `@preact/signals-react` / `@preact/signals-preact-transform` | React-oriented / babel-transform tooling; this project uses plain signals imports | Direct `@preact/signals` imports (current pattern) |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `preact@11.0.1` | `@preact/signals@2.11.3` | **GREEN** — peer `>= 10.25.0 \|\| >=11.0.0-0`; 2.11.3 ships a Preact-11-specific `useSignalEffect` dispose fix |
| `preact@11.0.1` | `@preact/signals@2.11.2` (current) | Declared **GREEN** (same peer range) but **use 2.11.3** — it carries the deferred-dispose fix 2.11.2 lacks |
| `preact@11.0.1` | `lucide-preact@^1.50.0` | **GREEN** — peer `^10.27.2 \|\| ^11.0.0-0`. **0.577.0 is RED** (peer `^10.27.2` only) — must bump |
| `preact@11.0.1` | `@preact/preset-vite@2.10.6` | **GREEN** — no `preact` peer; peers only `vite 2.x–8.x` + `@babel/core 7.x` |
| `preact@11.0.1` | `preact/compat` (`createPortal`, `memo`) | **GREEN** — compat still re-exports `createPortal`; our 5 import sites keep working |
| `preact@11.0.1` | TypeScript `~5.9.3` | **GREEN** — Preact 11 requires TS ≥ 5.1 |
| `preact@11.0.1` | `preact-render-to-string` | Optional peer `>=6.7.0` on preact 11 (`>=6.8.0` latest also allows 11). **Not used by this project** — no action |
| `efx-physic-paint` peer `preact >=10.0.0` | Preact 11 | Technically satisfied, but **raise the floor to `>=11.0.0`** after Phase 54 (spec open question Q3) so the declared tested floor matches reality |
| `@efxlab/motion-canvas-*@4.0.0` | Vite `5.4.21` | Unchanged — the pinned interop. Do not bump Vite |
| `simplex-noise@4.0.3` | ESM + CJS, 0 deps | Safe under the ESM-only world; `sideEffects: false` |

---

## Installation

```bash
# Phase 54 — Preact 11 bump (workspace root / app/)
pnpm --filter efx-motion-editor add preact@11.0.1 @preact/signals@2.11.3 lucide-preact@^1.57.0

# Phase 55 — new workspace package (no deps to install)
#   packages/efx-paint-host  → tsup (devDep, mirrors efx-physic-paint)

# Phase 56 — new workspace package + optional paper noise
pnpm --filter @efxlab/efx-watercolor add simplex-noise@4.0.3   # optional; else in-house noise

# Phase 57 — new workspace package (no deps; vendored MIT data + NOTICE)
#   packages/efx-spectral

# After 54 closes — raise the declared floor
#   packages/efx-physic-paint/package.json → peerDependencies.preact = ">=11.0.0"
```

Verification gates (already specified in the phase contexts, restated as stack acceptance):

```bash
pnpm typecheck          # must be green — the JSX.* type fixes land here
pnpm vitest run         # never watch
pnpm build              # + cargo
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| `preact@11.0.1` + `@preact/signals@2.11.3` | Stay on Preact 10.29.8 | Only if the R1.1 probe goes **RED** — then STOP and escalate as a blocking decision (spec R1.2). Do not shim, do not pin an unofficial combo. |
| `lucide-preact@^1.57.0` | Keep `0.577.0` with a `pnpm` peer-workaround / `overrides` | Never — the peer range is a declaration of what was tested. Suppressing it hides a real matrix hole. |
| Vendored MIT data in `packages/efx-spectral` | Depend on `spectral.js@3.0.0` npm | Only if upstream ships a proper ESM `exports` map **and** exposes the 7-coeff basis as data. Today it does neither. |
| `simplex-noise@4.0.3` for paper fields | In-house seeded value/worley noise | Prefer in-house if the project wants zero new deps and accepts owning noise determinism. Both are acceptable; `simplex-noise` is the safer default. |
| Preact-free `efx-paint-host` core | Host carries a `./preact` entry by default | If the split proves to need a Preact binding at the seam, add `./preact` exactly like `efx-physic-paint` (Q3, decide at plan time). |
| Raw WebGL2 for engine 2 | Adopt a WebGL framework (Three/regl/Pixi) | Never for this engine — it must stay seedable, deterministic, and seam-compatible with the existing GL modules. |

---

## Sources

- **npm registry (`npm view`)** — `preact`, `@preact/signals`, `lucide-preact`, `@preact/preset-vite`, `spectral.js`, `simplex-noise`, `preact-render-to-string`, `@efxlab/motion-canvas-vite-plugin`: versions, `peerDependencies`, `exports`, `license`, publish timestamps. First-party package metadata — the authoritative machine-readable compatibility contract. **HIGH** for the version/peer claims quoted above.
- **`https://preactjs.com/guide/v11/upgrade-guide/`** (official Preact docs, fetched 2026-10-14) — complete breaking-change list (ESM-only, `useRef` initial value, `defaultProps`/auto-`px` → compat, deferred `useEffect` cleanups, `JSX` namespace reduction, `render()`/`replaceNode` removal, `Component.base` removal, `SuspenseList` removal, refs-forwarded-by-default, hydration 2.0, `Object.is` hook comparison). Confirmed: **zero mentions of `@preact/signals`**. **HIGH** for the breaking-change list.
- **`https://github.com/preactjs/signals` releases** (`@preact/signals@2.11.3`, `2.11.2`, `2.11.1`) — first-party changelogs. 2.11.3 quote: *"Preact 11 disposes it after paint, so the effect could otherwise run once more against an unmounted component."* **HIGH** for the runtime-fix claim.
- **`https://github.com/rvanwijnen/spectral.js`** — MIT `LICENSE`, README describing the single-constant Kubelka-Munk method and the seven primary reflectance curves (White, Cyan, Magenta, Yellow, Red, Green, Blue). Repo contains `spectral.js`, `spectral.min.js`, `shader/`, and **no root `package.json` on `master`** — reinforces the "vendor the data, don't depend on the bundle" recommendation. **HIGH** for the licence + method-surface claims.
- **Local oracle (read-only, method only)** — `SPECS/v1.1.0-water-color/watercolor-playground-main/` texture layout and algorithm map, as recorded in `SPECS/v1.1.0-water-color/00-grill-context.md` §7. **Unlicensed — clean-room boundary, no code.**
- **Live repo inspection** — `app/package.json`, `packages/efx-physic-paint/package.json`, `app/src/lib/paperPass.ts` (`PaperPassTile`), and grep sweeps for `useRef(`, `defaultProps`, `preact/compat`, `JSX.`, `render(`. **HIGH** for the blast-radius counts.
- **Existing research (superseded)** — previous `.planning/research/STACK.md` (v1.0.0 milestone, 2026-08-23): confirmed the Vite 5.4.21 pin and the "no new deps" pattern. Both carried forward unchanged.

---
*Stack research for: v2.0.0 multi-module paint workstation — NEW capabilities only (Preact 11 / efx-paint-host / efx-watercolor / efx-spectral / procedural paper / module switcher)*
*Researched: 2026-10-14*
