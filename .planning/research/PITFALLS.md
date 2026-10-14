# Pitfalls Research

**Domain:** Adding to a mature signals-heavy Tauri/Preact paint workstation — (a) Preact 10→11 major bump, (b) format-identical engine-host split, (c) clean-room WebGL2 watercolor engine behind a module switcher, (d) shared spectral-mixing package
**Researched:** 2026-10-14
**Confidence:** HIGH (upgrade-guide and codebase findings verified against sources on disk / official docs; GPU-replay determinism generalized from the oracle's own code)

Scope: common mistakes when ADDING these features to THIS system (v1.0.1 codebase, `.planning/PROJECT.md` Key Decisions as incident oracle). Generic advice is deliberately excluded. Every pitfall names its owning phase (54 / 55 / 56 / 57, plus the switcher slice of 56). This replaces the v1.0.0-milestone pitfalls research (2026-08-23), which is archived in milestone artifacts.

---

## Critical Pitfalls

### Pitfall 1: Trusting the @preact/signals peer range instead of running the probe

**What goes wrong:**
The bump lands on the belief that signals "supports Preact 11", and reactivity dies silently: `paintVersion.value++` happens, no canvas re-render follows, Studio shows stale pixels, and the failure looks like a paint bug rather than a framework one.

**Why it happens:**
`@preact/signals` 2.11.x declares `peerDependencies: "preact": ">= 10.25.0 || >=11.0.0-0"`, which reads as green. But the official Preact 11 upgrade guide is **silent** on signals (verified 2026-10-14 — no compatibility statement in the guide). Signals integrates through Preact's options-hook layer (`options.vnode` / `diffed` / `unmount`), which is not covered by semver surface guarantees across majors. A peer range is necessary but not sufficient.

**How to avoid:**
R1.1's throwaway probe BEFORE any bump: mount a component that reads a signal, bump it, assert re-render, unmount, assert teardown. If red → STOP and escalate (R1.2). Do not shim, do not pin an unofficial combo, do not "fix" signals internals. Also resolve Q1 (exact signals version pairing) and Q2 (lucide-preact peer range) at the same probe, and bump `packages/efx-physic-paint`'s `peerDependencies: preact >=10.0.0` floor to `>=11` (Q3) in the same change — a stale peer range invites a second preact copy (see Pitfall 4).

**Warning signs:**
- Probe component renders once and never again on signal write
- `paintVersion` bumps in the store with zero subscriber re-runs
- Two `preact` entries in `pnpm why preact`
- The urge to "just pin signals to a git sha" — that is the STOP condition, not the fix

**Phase to address:** Phase 54 (hard gate R1; nothing else in the milestone starts until it is green)

---

### Pitfall 2: "Fixing" paintVersion subscriptions into React-style effect cleanups

**What goes wrong:**
A migration pass rewrites the paintVersion discipline (bump on mutation + subscribe in render effects: `void paintStore.paintVersion.value;`) into `useEffect(() => { const u = subscribe(); return () => u() })`. Preact 11 defers effect cleanups until after paint. Teardown timing moves, subscriptions outlive their components, and the Studio open/close round trip grows zombie effects and orphaned subscriptions — the exact class UAT row A4 exists to catch.

**Why it happens:**
The upgrade guide's deferred-cleanup item invites "audit all effects" reflexes, and React-trained hands reach for cleanup-on-unmount. This project's contract is the opposite: `feedback_paintversion` (always bump AND subscribe), `efx-preact-reactivity` (idempotent setters, identity-stable deps, narrow signal reads), and the phase 54 spec R2.4 explicitly says do not "fix" these into React-style cleanups.

**How to avoid:**
Re-verify existing subscriptions still tear down under Preact 11; change nothing about their shape. If (and only if) a future case needs synchronous teardown before DOM mutation, `useLayoutEffect` is the documented escape — the paintVersion pattern needs neither. Keep R3.1/R3.3 in force for the whole milestone. There are 13+ `paintVersion` consumer files (`paintStore.ts`, `Preview.tsx`, `StrokeList.tsx`, `PaintProperties.tsx`, `shortcuts.ts`, `autoSave.ts`, …) — treat them as a freeze-list for the bump.

**Warning signs:**
- A diff that touches `paintVersion` and `useEffect` in the same PR
- `return () =>` added around signal reads
- UAT A4 (Studio open/close) flakes or memory grows across open/close cycles
- Someone proposes React `useSyncExternalStore` patterns — out of scope, signals-only law (`feedback_no_usestate_only_signals`)

**Phase to address:** Phase 54 (R2.4 + R3.3; UAT row A4 is the closure test)

---

### Pitfall 3: Auto-px and type-namespace removal breaks UI silently while typecheck passes

**What goes wrong:**
Preact 11 removes automatic `px` suffixing from core (moved to `preact/compat`). Bare numeric styles like `style={{ width: 20, height: 20, borderRadius: 4 }}` (real site: `app/src/components/sidebar/PaintProperties.tsx` swatch) render as unitless `width:20` — invalid CSS — and swatches/icons collapse to zero size. The reverse mistake is just as bad: slapping `px` onto `fontWeight: 500`, `zIndex: 999`, or `opacity: 0.5` produces invalid styles the other way. Meanwhile 29 `JSX.*` type references (`JSX.CSSProperties`, `JSX.TargetedPointerEvent`, … in `NumericStepper.tsx`, `SliderStepper.tsx`, …) stop resolving because the namespace shrank to TS-required members only.

**Why it happens:**
These work today *because of* a Preact-core convenience that the major deletes. Typecheck stays green for the px problem (numbers are valid TS for CSSProperties), so only eyes-on UAT catches it. Blind React codemods (prohibited in this phase anyway) would paper over both issues incorrectly.

**How to avoid:**
- Property-aware style migration: add units only to length-like properties (width/height/borderRadius/fontSize/inset/…); leave unitless (fontWeight/zIndex/opacity/lineHeight/flex/…).
- Import types from the `preact` namespace (`import type { CSSProperties } from 'preact'`) — fix all 29 sites; `pnpm typecheck` green is a gate, not the proof.
- `useRef`: the sweep is smaller than R2.2 suggests — 0 bare `useRef()` call sites exist — but the **type meaning** change (`RefObject<T>.current` is now `T`, not `T | null`) hits the ~171 `useRef`/`forwardRef`-adjacent sites at type level. Fix the annotations; do not sprinkle `!`.
- Refs are forwarded by default and `ref.current` is the DOM node — audit any ref-on-component assumption (no `forwardRef` usage found, but ref props on wrappers deserve one look).
- Also from the guide and worth one checklist pass: `render()` third parameter removed, `Component.base` removed, `SuspenseList` gone, hook arg equality is `Object.is` (NaN now compares unequal in deps), TypeScript ≥ 5.1 required.
- Live visual UAT of Studio chrome (A1–A5), not a screenshot-free typecheck sign-off (`feedback_live_evidence_over_unit_probes` — vitest is blind to the real windows).

**Warning signs:**
- Zero-size swatches, toolbars, steppers after the bump
- `JSX.CSSProperties` type errors clustered in shared widgets
- A codemod commit titled "React 19 style migration" — reject it, this is Preact

**Phase to address:** Phase 54 (R2.2/R2.3/R2.5 + live UAT rows)

---

### Pitfall 4: ESM-only fallout and two Preact instances across the monorepo

**What goes wrong:**
Preact 11 ships ESM-only (`.mjs`; CJS/UMD dist removed). The standalone engine entry `packages/efx-physic-paint` → `./preact` (UAT A5) or the Vite build breaks on resolution, or — worse — app and package each resolve their own `preact`, signals hooks register on the wrong instance, and everything "mounts" while reactivity is dead. This is the monorepo twin of Pitfall 1.

**Why it happens:**
`app/package.json` pins `preact: 10.29.8` while `packages/efx-physic-paint` has `peerDependencies: preact >=10.0.0` + dev `10.29.0`. Peer ranges that allow both majors (or a workspace that doesn't dedupe) produce duplicate runtimes. Deep imports like `preact/dist/preact.js` (removed in 11) are another trap.

**How to avoid:**
Bump both packages to 11 in one change; set the package peer floor to `>=11`; verify `pnpm why preact` shows one copy; verify `@preact/preset-vite` + `exports` maps resolve with no CJS-only paths (R2.1); run the standalone `./preact` entry as A5, not just the app build. Keep `lucide-preact` green (Q2 — check its peer range at plan time). Full gate: `vitest run` (never watch) + `pnpm typecheck` + build + cargo.

**Warning signs:**
- `require(preact)` / "does not provide an export named" build errors
- Standalone demo shows a canvas that never reacts
- pnpm installs a second preact under `packages/efx-physic-paint/node_modules`

**Phase to address:** Phase 54 (R2.1 + A5)

---

### Pitfall 5: Opening Phase 55 before Phase 54's live reactivity UAT closes

**What goes wrong:**
The host split starts on a green suite while paintVersion/store-setter behavior is only typecheck-proven. Cross-webview and Tauri behavior is invisible to vitest in this codebase (known: DOM-fallback branch masks real failures — `feedback_live_evidence_over_unit_probes`), so a subtly broken subscription gets *moved* in 55 and blamed on the split, or worse, baked into the host contract.

**Why it happens:**
Phases look parallelizable; the suite is fast; the UAT rows feel like ceremony. But this project has a history of exactly this failure shape (Studio origin persist loss, layer-2 dead gestures — both live-only defects), and the milestone law is explicit: the phase-step gate replaces the old isolated-tag gate.

**How to avoid:**
Hard gate: 55 must not open until R4.2 rows A1 (paint reflects without refresh)–A5 (standalone entry mounts) are **user-asserted live**, not "automated-ready" (`feedback_no_done_before_uat`). The gate owner is 54's exit, and 55's plan should list it as a precondition.

**Warning signs:**
- A 55 plan whose first task is "move animation/" while A4 is still pending
- "We'll UAT both phases together at the end" — never acceptable here

**Phase to address:** Phase 54 (exit gate) — consumed by Phase 55's entry

---

### Pitfall 6: Engine-specific parameters leaking into the host API

**What goes wrong:**
`efx-paint-host` grows `physicsMode`, `waterAmount`, krita preset names, or typed `PaintStroke['params']` on its surface. Engines 2 and 3 then must speak engine-1 vocabulary through the "generic" host — the same adapter mistake that killed phases 27–32. The split pays for itself only if the seam is genuinely payload-generic.

**Why it happens:**
It is the path of least resistance: `PersistedRotoScriptStrokeV1` today carries `tool: PaintStroke['tool']`, `params: PaintStroke['params']`, `physicsMode?: PaintStroke['physicsMode']` (see `physicsPaintRotoScriptSchema.ts`). Moving "the script types" verbatim into the host moves engine-1 types with them. Format-identical (R5.2) is a *replay guard*, not a license to entangle the API.

**How to avoid:**
Host owns a payload interface parameterised over the per-engine stroke payload — shared shape only: `pts`, `ticks`, `cuisson`, `motion`, brush id + `toolOverrides` (R2.1/R2.2). Envelope = one shared shape + opaque per-engine payload slot (Q2: host-owned interface, engine re-exports). Acceptance row A5 is the detector: a **fake engine-2 payload** must compile and round-trip record → play → bake with **zero** engine-1 types in scope. Unknown engine id or malformed payload refuses fail-closed, never half-applies (R2.3).

**Warning signs:**
- Any `efx-paint-host` export mentioning `physicsMode` / `waterAmount` / libmypaint names
- A5 needs `as any` / `@ts-expect-error`
- Host imports from `efx-physic-paint` (dependency must point the other way)

**Phase to address:** Phase 55 (R2 + A5)

---

### Pitfall 7: Replay parity broken by "harmless" move drift — and "fixed" with compat shims

**What goes wrong:**
After the split, the same recorded script bakes different pixels than the pre-split golden. The parity failure is subtle (1–2 LSB float drift, seed input change, iteration order, default drift), and the tempting fix — a dual reader, a normalization branch, a "legacy format" shim — is exactly what the clean-break law forbids. Parity is a refactor guard; compatibility code is out of scope forever.

**Why it happens:**
Determinism here is load-bearing and fragile: `traceSeed` derives FNV-1a over the mutation id with arc-length-keyed draws (locked so resample/chunking can't shift noise — see `packages/efx-physic-paint/src/util/traceSeed.ts`), schedules (`progressiveStrokeSchedule` / `staticStrokeSchedule` / `recordedStrokeMotion`) carry timing defaults, and time is integer ticks (~1/60 s) — never raw ms. Any of these can drift during a "pure move" (reformatting the derivation path, reordering fields, changing a clamped default like `schemaRange`'s projection in `serializeRotoScriptStroke`).

**How to avoid:**
Capture the pre-split golden bake BEFORE moving anything (R5.2 is a measured WebP delta against that golden — not a green suite). Move code without touching derivation paths, seed inputs, or schedule defaults. No `Math.random()` / bare `rand()` anywhere in deposit or sim scheduling (R3.2) — including "temporary" debug draws. If parity fails, fix the move. NEVER add a reader that accepts both shapes. A4 (save/reopen replay identical) is the live twin of R5.2.

**Warning signs:**
- Golden WebP delta ≠ 0 after a commit that claims to be "just moving files"
- A new `if (legacy…)` / `migrateScript()` appearing in the diff
- `timestamp: number` (existing engine-1 field) getting "helpfully" converted to ticks mid-split — leave engine-1 payload as-is; the host timing law is for what the host owns

**Phase to address:** Phase 55 (R5.2 + A4)

---

### Pitfall 8: "Normalizing" the brush-pack snapshot into a disk reference (and silent `.mce` field loss)

**What goes wrong:**
During the split/persistence work, the brush-pack snapshot inside `.mce` gets converted to a 52.2-style disk reference, or new envelope/brush fields land in TS only. First breaks old-script replay after the pack evolves (the whole reason the snapshot exists). Second breaks worse and silently: serde drops keys the Rust structs don't declare — the PKG-06-class data-loss pattern — and the field vanishes on reopen.

**Why it happens:**
52.2's references-only law is strong muscle memory ("everything heavy is a ref"), and the snapshot is a **deliberate, documented exception** (old scripts must replay after the pack evolves; `toolOverrides` sit on top of a stable brush id). Meanwhile the v1.0.1 dual-language law (every `.mce` field declared in BOTH TS interface and Rust struct, enforced by `app/src/lib/mceFieldContract.test.ts`) is easy to forget when adding package-split fields.

**How to avoid:**
Keep the snapshot embedded — R3.4 prohibition, do not "fix" it. Every new persisted field (envelope, payload slot, brush-pack entry, tick fields) extends the TS interface **and** the Rust struct in the same change, and extends `mceFieldContract.test.ts`. Round-trip pin per the v1.0.1 pattern: Rust save→open **and** TS build→hydrate. Clean break ≠ silent loss: unreadable scripts refuse with a named visible error (53.1 law).

**Warning signs:**
- A PR that moves brush bytes to `frames/` / a media ref
- `mceFieldContract.test.ts` untouched while `.mce` fields change
- A script that opens with brushes: [] and nobody noticed

**Phase to address:** Phase 55 (envelope + snapshot law) with Phase 56 (aquarelle brush-pack fields) extending the same contract

---

### Pitfall 9: Inventing a new bake-cancellation model (or keeping dispose-abort for long cuissons)

**What goes wrong:**
Two async bake-like systems exist and behave differently: `finalizationQueue` (Effect v4 bounded queue, survives leaving the frame, generation-stale + `isStillWanted` guards) and the PlayScript renderer (`renderRotoPlayScriptFrames`, **aborts on `dispose()`**). Unifying them into a new cancellation model mid-split drops either the leave-frame guarantee or the dispose-abort guarantee. Later, a watercolour cuisson (up to 600 diffusion frames of fluid evolution) gets killed when the user navigates away, or leaks a queue after Studio closes.

**Why it happens:**
"Two patterns is tech debt, let's make one" is a natural refactor reflex — and the PlayScript dispose-abort looks like the bug to fix. But the laws are deliberate: the host ports the `finalizationQueue` pattern (R4.1/R4.2), no Web Worker (WebGL2 + canvas encode are main-thread anyway), no new cancellation model. Long bake survival is a 56 requirement (R3.3) that 55 must make *possible*.

**How to avoid:**
Port patterns as-is; change neither's semantics in 55. Any queue/state machine new code follows `efx-async-orchestration` (XState v6 lifecycle machines, Effect v4 bounded-turn queues) — no timer/boolean-flag FSMs (the race factory this project already post-mortemed). UAT A3 (leave frame mid-bake, return: bake completes, no torn frame, no orphaned queue) is the closure row.

**Warning signs:**
- A new `AbortController` owned by the timeline instead of the bake host
- Bake restarting from frame 0 after a navigation
- `setInterval`/boolean `isBaking` clusters in the diff

**Phase to address:** Phase 55 (port, R4) — stressed for real by Phase 56 (long fluid bake)

---

### Pitfall 10: Wall-clock time and unseeded randomness crossing into the host/engine time law

**What goes wrong:**
Time becomes `performance.now()` deltas (float seconds) and noise becomes `Math.random()`, both of which look fine in interactive play and make script bake irreproducible: two bakes of one script differ, the WebP cache can't be trusted, A2 fails, and the timeline's cache-only contract quietly loses its meaning.

**Why it happens:**
The oracle drives strokes with `performance.now()` timestamps (`Engine.ts`: `sdt = Math.max(q.t - s.t, 1) / 1000`, sample `t` fields) and seeds paper with `Math.random()` (`this.paperSeed = Math.random()`). Existing engine-1 scripts also carry a raw `timestamp: number`. Real pointer input arrives in ms. The project's law is stricter than all of this: fixed tick grid (~1/60 s), integer ticks, never raw ms (R3.3 / R1.5), FNV-1a `traceSeed` per stroke, no `Math.random()` in deposit or sim path (R3.2).

**How to avoid:**
Record snaps each sample's `dt` to the nearest tick and stores integer ticks; replay steps the sim on that grid only. Paper/brush noise draws are keyed by `(strokeSeed, arcLength, drawKey)` (arc-length, not sample index — so resample/chunking can't reshuffle noise). Grep-gate `Math.random` / `Date.now` / `performance.now` in deposit+sim paths as a phase check. Keep engine-1's legacy `timestamp` field as an engine-1 payload detail — do not let it become the host time authority.

**Warning signs:**
- Any `performance.now()` in `efx-paint-host` / `efx-watercolor` sim code
- Replay bakes that differ run-to-run ("GPU is flaky" is not an explanation — see Pitfall 11)
- `dt` stored as float seconds "for precision"

**Phase to address:** Phase 55 (host timing law R3.3) + Phase 56 (engine R1.5, A1/A2)

---

### Pitfall 11: Porting the oracle's look — and its non-determinism — into the clean-room engine

**What goes wrong:**
The watercolour look the user is buying (scattered dry-brush breaks, angle jitter, granulation pooling) was tuned with **unseeded randomness**: `Math.random()` drives `rotation: 'random'`, `angleJitter`, `scatter`, `sizeJitter`, flow splatter, and `paperSeed` in the oracle's `Engine.ts`. A faithful clean-room reimplementation either copies that non-determinism (violates the law, breaks A1/A2) or drops the random character entirely (wrong look — the "no-pigment line" / softSat class of look regression this project already fought). Separately, GPU float pipelines are not bit-stable across drivers/GPUs; "same script ⇒ same pixels" needs an explicit tolerance or a deterministic reference path, not wishful thinking.

**Why it happens:**
Clean-room work focuses on the physics (advection, tide line, fix/dry) and under-specifies the deposit noise model. The oracle never needed replay determinism — its history is raster undo tiles and `.wcp` is half-float layers; nothing stores strokes. Our Studio script law (record → play → bake → cache) demands determinism the reference never proved.

**How to avoid:**
Reimplement the *distribution* of scatter/jitter with seeded draws via `traceSeed` (FNV-1a, arc-length keyed) so the look survives but the pixels are stable; `paperSeed` is **data** (per document/script), never runtime RNG. Define the determinism acceptance honestly at plan time: A2 "two plays bake identical WebP" may need a defined pixel-delta threshold on GPU paths (this project already accepts grouped render thresholds — `feedback_render_uat_evidence`) or a CPU reference for tests. Look rows (A3: bloom + tide line visible in baked frames) are native visual UAT, not hashes (`feedback_live_evidence_over_unit_probes`).

**Warning signs:**
- `paperSeed = Math.random()` carried over "because the reference does it"
- Golden-hash tests that flake on the CI GPU but pass locally
- A look regression report ("too uniform", "no sparkle") right after seeding lands

**Phase to address:** Phase 56 (R1.5, A1–A3)

---

### Pitfall 12: Acting on a stale licence premise in either direction

**What goes wrong:**
Phase 56 either (a) transliterates oracle code while prohibition P1 still stands (project-law violation, and the prohibition is lifted verbatim into `must_haves`), or (b) pays full clean-room cost while upstream is actually permissively licensed — and nobody asks. Either way the decision was made by inertia, not by the user.

**Why it happens:**
The grill context locked (2026-10-06) that `msurguy/watercolor-playground` and `johnowhitaker/inkwash` have **no licence** → method-only clean-room (P1). **But the local oracle copy on disk contradicts that premise:** `SPECS/v1.1.0-water-color/watercolor-playground/LICENSE` is the MIT License, "Copyright (c) 2026 Maksim Surguy"; `package.json` says `"license": "MIT"`; `THIRD_PARTY_NOTICES.md` states the app's own code is MIT and lists inkwash, WebGL-Fluid-Simulation, spectral.js and water-brush all as MIT. The grill's own reopening clause says: "if either ever lands an OSI licence, direct port becomes an option; until then clean-room only" (00-grill-context §10.10). The licence evidence in the fetched tree suggests that clause may already be satisfied — but the LOCKED prohibition is what phase 56's plan will inherit.

**How to avoid:**
At Phase 56 **plan time**: re-verify upstream licence state (the on-disk LICENSE + upstream repo), then take an **explicit user decision** on whether P1 relaxes to "MIT port with attribution" or stays clean-room (user drives scope/decisions; the bake-model lock is NOT reopened by this). Until that decision, P1 stands — no copy, no transliteration. Whatever the outcome: MIT attribution/NOTICE obligations for anything reused (ship a `NOTICE` in `efx-spectral` per Q6), Mixbox stays banned (CC BY-NC, project-wide), single-line fonts stay out of scope (SIL OFL / Hershey terms), and record the verdict in PROJECT.md Key Decisions.

**Warning signs:**
- Phase 56 plan copies P1 forward without a licence re-check row
- A PR that opens with oracle shader code and a "clean-room" label
- `efx-spectral` ships without a `NOTICE` / attribution artefact

**Phase to address:** Phase 56 (decision at plan time) + Phase 57 (efx-spectral `NOTICE` attributed, Q6 = vendor MIT data)

---

### Pitfall 13: Baking paper into the WebP, forcing Dry at frame boundaries, or running a live sim on the timeline

**What goes wrong:**
Three "simplifications", each individually tempting, each destroying the product: (1) baking paper into the painted frames makes every paper change a rebake and breaks the compositor law (tracks transparent between each other, paper is the document fond); (2) forcing Dry at frame boundaries kills wet-in-wet blooms and tide lines — the entire reason this engine exists; (3) letting scrub/Loop Clips/export drive the live GPU sim breaks the cache-only timeline contract and export parity.

**Why it happens:**
Frame-boundary Dry makes bake bookkeeping trivial (each frame independent). Baking paper into layers makes the engine "look right" in isolation. Live sim on scrub looks smooth in a demo. All three violate locked decisions: R2.1/R2.2 (composite-only paper, no rebake), P4 (no forced Dry), P3 (no live GPU fluid on the timeline), and the Studio law (after bake, timeline reads cache only).

**How to avoid:**
Paint WebPs stay transparent where unpainted (A5 export row). Paper = `paperPass` conditioned height map → valley/peak tiles swapped at the composite seam (`app/src/lib/paperPass.ts`); engine-side tooth/granulation is the **deposit role** (bakes into the mark, keeps WebP paper-agnostic). Per-stroke `diffusionFrames` (cap 600, Q1=C) owns how long physics evolves — duration is data, not wall clock. Bake captures PlayScript cadence frames during/after play; scrub, repeats, Loop Clips, export, save all read the cache. The 10-paper pack (cold press, hot press, rough, khadi, washi, laid, canvas, toned sand, kraft, cellulose — `PaperPreset[]` in the oracle `papers.ts`, clean-room height/mottle/fleck fields) joins the **Studio paper library for ALL paints** via `PaperPassTile`, and paper display state (id, strength, scale) lives on the document/fond (undo + save), never per-stroke (R2.5).

**Warning signs:**
- Opaque WebP where the sheet is unpainted
- Any `dry()` call keyed to a frame index in the bake loop
- Paper change triggering `renderRotoPlayScriptFrames`
- Paper state appearing in a stroke payload as an authority field

**Phase to address:** Phase 56 (R2 + R3.3/R3.4; paper pack R2.4)

---

### Pitfall 14: GPU + texture footprint reintroduces the WKWebView OOM / decode-storm class

**What goes wrong:**
The wet-field engine's texture set (velocity RG16F, wet R16F, ink 2×RGBA16F, fixed 2×RGBA16F, paper RGBA8 at up to 2400×1600) plus undo tiles plus bake frames lands in the same WKWebView that this project already OOM-killed once (effect/signal feedback loop) and already slowed globally (image decode storms at HD, fixed in 52.1 by bytes/ImageBitmap + Rust WebP + 512 MB LRU). A second engine + module switcher + 10 paper tiles is the "heavier content breaks latent cost assumptions" pattern (`feedback_ride_existing_machinery`) all over again.

**Why it happens:**
Interactive painting at preview sizes is cheap; the Studio document is HD. Reference perf laws exist precisely because the oracle hit this: simulate only the wet region (wet-mask readback), stop when dry, cap sheet (`MAX_DOC_PIXELS` ~2048×1536), bounded undo tiles. It is easy to skip them while chasing the look, and easy to allocate GL textures per frame/draw and never free them across module switches (this project already learned the separate-WebGL-context lesson with `glMotionBlur`).

**How to avoid:**
Adopt the reference perf laws as acceptance criteria (R1.6), not aspirations. Reuse the 52.1 bytes/WebP + LRU cache path for bake output — do not invent a second frame cache. Dispose GL programs/textures/FBOs on module switch and Studio close (UAT A4's orphan hunt extends to GL objects). Measure the footprint before stacking the paper pack (deferred-and-measure is this project's own guidance). Decode-once + content-keyed cache discipline stays in force (`feedback_image_decode_cache`). Watch the vite chunk budget too: 2000 kB ceiling is a desktop lock with **no incremental raises** (`feedback_chunk_budget_desktop`) — watercolour shaders + spectral data + papers must not grow the main bundle without an explicit user decision.

**Warning signs:**
- Jetsam / "This webpage was reloaded because a problem occurred" in Studio
- GPU memory climbing across module switches (context/texture leak)
- Bakes re-decoding WebP per timeline paint
- A quiet `chunkSizeWarningLimit` bump "just this once"

**Phase to address:** Phase 56 (R1.6 perf laws + resource lifecycle) with Phase 54's bundle gate kept green

---

### Pitfall 15: Module switcher forks Studio, leaks state across modules, or ships the Krita slot

**What goes wrong:**
The switcher becomes a second Studio per module (duplicated script/cache/timeline controllers), or module options bleed into shared engine state (a Water color slider overwriting Brush params — the play-global-vs-stroke-props bug shape), or shortcuts fire in the wrong module's canvas (the unguarded-shortcuts class), or someone implements the Krita pane because the dropdown says "Brush | Water color | Krita". Switching modules mid-bake tears down the queue and loses the cuisson.

**Why it happens:**
"Modules change only the options/features surface" is easy to say and easy to violate when each engine's UI is isolated per paint (a locked invariant). The three-module design invites implementing the third; the milestone says v2.0.0 ships Brush + Water color only — Krita is the v2.1.0 slot.

**How to avoid:**
ONE shared Studio engine (script, cache, timeline) for all modules — a module is a registration (engine + its options panel + fail-closed Apply + brush vocabulary), not a fork. Per-module options drain into per-engine payload/`toolOverrides` only, never into shared envelope/timeline state (play globals vs per-stroke props separation). Global shortcuts gate on the active module the way `isPaintEditMode()` gates paint shortcuts (`feedback_shortcuts` — the unguarded-S-key debt is the cautionary tale). Module switch during an active bake goes through `finalizationQueue` `beginFlush`/stale-generation discipline, not a hard teardown. The switcher UI is designed for three modules but only two are implemented — gray zones (top-bar placement, iconography, panel layout) resolve at discuss-phase, and the third slot stays a disabled/deferred affordance.

**Warning signs:**
- Two PlayScript controllers in the tree
- A shared `toolOverrides` bucket mutated by both modules
- Any krita/libmypaint import in a v2.0.0 diff
- Shortcut firing while the wrong module's canvas is focused

**Phase to address:** Phase 56 (switcher slice over the shared host) — scope fence enforced through Phase 57

---

### Pitfall 16: Duplicating spectral mixing inside the watercolor engine (or misplacing efx-spectral)

**What goes wrong:**
The 7-coeff absorbance mixing gets implemented inside `efx-watercolor` (so engine 1 can never adopt it without depending on engine 2), or stuffed into `efx-paint-host` (host is Studio law, not a colour toolbox), or forked twice — CPU helper here, GLSL basis there — until the two mix differently (the hide/solo duplication debt pattern). Or spectral lands late in 56 and someone "temporarily" inlines `pigmentFromHex` into the engine.

**Why it happens:**
57 is scheduled after 56 but 56's mixing is the whole point of the engine ("yellow + blue = green"). The dependency pressure is real and already anticipated: if plan-time shows 56 needs spectral first, create `packages/efx-spectral` early inside 56 or pull 57's content forward — **never duplicate the mixing code** (decided).

**How to avoid:**
`packages/efx-spectral` as its own tiny shared package: MIT spectral.js method + reflectance data (vendor the data — Q6=A — do not regenerate it, or ΔE drifts), CPU helpers + GLSL basis export from **one** source of truth, `NOTICE` attributed. Consumers: `efx-watercolor` now, `efx-physic-paint` in v2.1.0 (replacing the `mixSubtractive` RYB heuristic — OUT of scope here; do not touch engine-1 colour now). `efx-krita` never uses it (libmypaint mixes internally). Add a CPU-vs-GPU mix parity test with a stated tolerance (ΔE_OK ≈ 0.1–0.2 is the reference's own accuracy). The oracle's shape is the spec: `COEFFS = 7`, `Pigment { coeffs: Float32Array, … }`, `pigmentFromHex` → reflectance → absorbance → basis projection (`spectral.ts` / `spectralData.ts`).

**Warning signs:**
- `coeffs` computed differently in TS vs GLSL
- A second `mixSubtractive`-style helper under `efx-watercolor/`
- Spectral source living under `efx-watercolor/src` or `efx-paint-host/src`
- 56 finishing with a `TODO: move to efx-spectral later`

**Phase to address:** Phase 56 (create early if needed — dependency order) / Phase 57 (own the package, NOTICE, parity test)

---

### Pitfall 17: Fail-closed Apply eroded across engines (half-applied scripts, silent drops)

**What goes wrong:**
With two engines live behind one Studio, a Brush script applied to a Water color layer (or an unknown/malformed payload) partially applies — some strokes land, some vanish — or the parse error is swallowed and the user sees a successful Apply with missing marks. Clean-break does not license silent data loss; fail-closed is data honesty.

**Why it happens:**
Shared envelope + per-engine payload invites a "best effort" reader: default unknown fields, skip bad strokes, continue. This project's law is the opposite: `physicsPaintRotoScriptApplyRefusal` class refusals, named visible errors for anything unreadable (53.1 law), and the schema's own `schemaRange` projection exists precisely because silent clamp-and-continue once lost saves.

**How to avoid:**
Envelope carries a discriminating engine id + opaque payload; Apply validates before mutating anything (atomic refuse, never half-apply — R2.3). Cross-engine pairs get explicit refusal tests (Brush↔Water at minimum). Every refusal surfaces a named visible error, never a console warning. No legacy fallback readers (P5) — a pre-clean-break script refuses with a named error rather than "helpfully" migrating.

**Warning signs:**
- `catch { /* skip stroke */ }` in Apply
- Engine id defaulted when missing
- Apply "success" toast with brushCount mismatch vs the library row

**Phase to address:** Phase 55 (contract R2.3) proven by Phase 56 (second engine live)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `preact/compat` import just to keep auto-px / defaultProps | Zero UI edits in 54 | Pulls the compat layer into a codebase that has never needed it; masks the real style/type migration; bundle + semantics drift | Never (prohibition: migrate explicitly) |
| Inline a temporary `mixHex()` inside efx-watercolor "until 57" | Unblocks 56's mixing week 1 | Two mixing implementations; engine-1 adoption becomes a rewrite; ΔE drift | Never — create `packages/efx-spectral` early instead (decided) |
| Engine-1 types reused in host payload "for now" (R5.2 format-identical pressure) | Smaller diff in 55 | Engine 2/3 blocked on engine-1 vocabulary; adapter-class rewrite later | Never — format-identical applies to replay pixels, not to type ownership |
| Keep `timestamp: number` as the replay time authority | No tick conversion work | Non-deterministic bake; cache untrustworthy | Never for host/engine timing (legacy field may persist as engine-1 payload detail only) |
| Skip the golden bake capture before the 55 move | Faster start | No R5.2 baseline; parity failures unattributable | Never — capture is the first task of 55 |
| Grow the chunk budget for shaders/spectral data | Quiet green build | Desktop ceiling is a lock (2000 kB, no incremental raises) | Only with an explicit user decision |
| Best-effort Apply (skip malformed strokes) | Fewer refusal dialogs | Silent data loss; 53.1 violation | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `.mce` package (TS ↔ Rust) | Add script/envelope/brush fields in TS only — serde silently drops them on open | Declare in BOTH TS interface and Rust struct; extend `mceFieldContract.test.ts`; round-trip pin both directions (v1.0.1 law) |
| `efx-paint-host` ↔ `efx-physic-paint` | Host imports engine (cycle / engine-1 leakage) | Engine consumes host; host is Preact-free with a `./preact` entry (Q3), payload opaque |
| `efx-watercolor` ↔ `efx-spectral` | Watercolor vendors its own spectral copy | Consume the shared package; create it early inside 56 if needed; engine 1 adopts only in v2.1.0 |
| Studio bake host ↔ timeline navigation | Hard abort on nav / dispose (PlayScript pattern) for long fluid bakes | `finalizationQueue` pattern: bounded Effect queue, generation-stale, `beginFlush` on nav/close/save/export; PlayScript dispose-abort stays where it is |
| Paper pack ↔ paints | Paper pack built as watercolour-only, or paper baked into WebP | 10 procedural papers → Studio paper library for ALL paints via `PaperPassTile`; composite-only fond, no rebake |
| Package/cache IO | Renderer plugin-fs touching package or cache paths | All package/cache IO through Rust (`project_package_fs_scope` — both sides pinned by static scans) |
| Oracle (`watercolor-playground/`) | Copy shaders because "it's MIT now" before a user decision; or ignore LICENSE evidence and over-clean-room | Re-verify licence at 56 plan time, explicit user decision on P1; attribution/NOTICE whatever is reused; fonts out of scope; Mixbox banned |
| Preact 11 + lucide-preact / preset-vite / efx-physic-paint peers | Bump preact alone | Resolve Q1/Q2/Q3 in the same change; one preact copy (`pnpm why preact`); `./preact` entry A5 mounts |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-doc fluid sim every tick | Studio stutter, GPU busy on dry sheet | Wet-region-only simulation (wet-mask readback), stop when dry (R1.6) | First HD sheet with a small wet patch |
| Half-float texture set + undo tiles at doc size | WKWebView memory pressure / jetsam | Sheet cap (~2048×1536 class), bounded undo tiles, dispose GL on close/switch, measure before adding papers | Second module open / paper pack in |
| Re-decoding bake WebPs per timeline paint | Global slowness class (decode storms) | 52.1 bytes/ImageBitmap + Rust WebP + 512 MB LRU — reuse it for engine-2 frames | Any HD multi-frame scrub |
| Bake output outside the LRU budget | Memory climbs across scripts | Byte-budgeted cache accounting includes engine-2 WebPs | Several 600-frame cuissons |
| Bundle growth from shaders + spectral data + papers | Silent chunk-size creep | 2000 kB ceiling lock; lazy-load engine-2 shader/paper assets; user decision to move the line | Milestone mid-point, casually |
| Effect/signal feedback loops in new module UI | Idle CPU growth → OOM (past incident) | `efx-preact-reactivity` laws; no render-body signal writes; idempotent setters | First complex options panel |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Copying oracle/inkwash code without a settled licence decision | Licence violation against project law (P1 is in `must_haves`) | Licence re-verification + explicit user decision at 56 plan time; until then method-only; keep attribution records |
| Shipping spectral data / mixing code without MIT attribution | Licence breach even when reuse is allowed | `NOTICE` in `packages/efx-spectral` (Q6); THIRD_PARTY_NOTICES-style record of upstream origins |
| Pulling Mixbox code/LUTs/spectra into the mixing path | CC BY-NC contamination (banned project-wide) | Q6 = spectral.js only; code review gate on the mixing package's provenance |
| Importing single-line fonts/text tools with the engine port | SIL OFL / Hershey obligations smuggled in; out of scope | Text/Shape/Hand are out of v1.1.0 scope (locked); don't vendor `public/fonts/` |
| Renderer fs access to package/cache paths from new engine code | Crosses the plugin-fs scope law | All package/cache IO through Rust; static scans cover new packages too |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent success on unreadable/foreign-engine scripts | User loses marks with no explanation | Fail-closed Apply + named visible error (53.1 law); refuse, never half-apply |
| Forcing Dry at frame boundaries for bake simplicity | Kills blooms/tide lines — the look they bought the engine for | Per-stroke `diffusionFrames` evolution; A3 UAT asserts the bloom survives into baked frames |
| Paper baked into paint / rebake on paper change | Compose becomes destructive; paper exploration is slow | Composite-only `paperPass` fond; tile swap; document-level paper state (undo + save) |
| Module switch mid-bake losing the cuisson | Lost work, torn frames | `finalizationQueue` flush/stale-generation on switch; A3-style "come back to a finished bake" row for the switcher too |
| Options panels writing into shared Studio/global state | Wrong module's parameters change; play globals stomp per-stroke props | Drain module options into per-engine payload/`toolOverrides` only |
| Unguarded global shortcuts during paint/module focus | Surprise tool changes (known S-key class) | Gate `shortcuts.ts` on active module/edit mode |
| Krita shown as if it works in v2.0.0 | Broken third module discovered by users | Ship Brush + Water color; the third slot is the v2.1.0 design reserve, not a fake control |

## "Looks Done But Isn't" Checklist

- [ ] **Preact 11 bump:** suite green ≠ signals work — verify probe + live A1–A5 rows; check one preact copy; `./preact` entry mounts
- [ ] **paintVersion discipline:** confirm no subscription was rewritten into effect cleanups; A4 open/close leaves no zombie effect
- [ ] **Numeric styles:** Studio chrome visually verified (swatches/steppers sized); unitless props not px-ified
- [ ] **Host split:** R5.2 measured against a **pre-move** golden (not "tests pass"); A5 fake engine-2 payload compiles with zero engine-1 types
- [ ] **Brush-pack snapshot:** still embedded in `.mce`; every new field declared in TS **and** Rust with a round-trip pin
- [ ] **Bake host:** leave-frame mid-bake completes (A3); dispose still aborts what should abort; no new cancellation model
- [ ] **Tick/seed law:** grep gate clean for `Math.random`/`performance.now` in deposit+sim; A2 two bakes identical (or delta under the stated threshold)
- [ ] **Watercolour look:** A3 bloom + tide line visible in **baked** frames — not just while painting live
- [ ] **Paper:** transparent WebPs; paper swap does not rebake; 10 papers usable from **every** paint; paper state in undo/save
- [ ] **Spectral:** one package, one basis source, CPU/GPU parity test, `NOTICE` shipped, no second mix helper
- [ ] **Apply:** cross-engine refusal tested with named visible errors; no best-effort skip
- [ ] **Switcher:** one Studio engine; two modules only; shortcuts gated; no krita code
- [ ] **Licence:** 56 plan carries an explicit licence re-check + user decision row (P1 outcome recorded in Key Decisions)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Signals red on Preact 11 probe | HIGH (milestone re-plan) | STOP as R1.2 says; escalate as blocking decision; do not shim. Re-sequence: engines can still be designed against the host contract while the bump is re-scoped |
| paintVersion regressions after bump | MEDIUM | Revert the cleanup rewrites (git is the truth — the freeze-list diff shows them); re-run A1–A4; re-apply only mechanical R2 items |
| R5.2 parity failure after the split | MEDIUM | Bisect the move commits against the pre-split golden; fix drift at the source (seed/iteration/defaults); never add a dual reader |
| Engine-1 types leaked into host | HIGH | Cut the type ownership over to host-defined payload interfaces before engine 2 code starts; A5 becomes the regression pin |
| Oracle code copied under stale P1 | HIGH (legal + trust) | Revert the copies immediately; re-run clean-room from method notes; surface to user for the licence decision before any re-land |
| Non-deterministic bake discovered mid-56 | HIGH | Introduce seeded draws + tick grid at the deposit/sim seam; rebaseline goldens deliberately (clean break accepted); A1/A2 re-run |
| WKWebView OOM with wet-field engine | MEDIUM | Apply reference perf laws (wet-region sim, sheet cap, bounded undo); dispose GL on switch/close; measure before resuming features |
| Chunk budget blown | LOW–MEDIUM | Lazy-load engine-2 assets; if the line must move, it is an explicit user decision, not a drive-by bump |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 — signals peer range trusted | Phase 54 | R1.1 probe green before bump; R1.2 stop-if-red honored |
| 2 — paintVersion → effect cleanups | Phase 54 | Diff freeze on subscription shape; UAT A4 |
| 3 — auto-px / JSX namespace / RefObject types | Phase 54 | Property-aware migration; typecheck green; visual Studio UAT A1–A3 |
| 4 — ESM-only / two preacts | Phase 54 | `pnpm why preact` single copy; A5 `./preact` entry mounts |
| 5 — 55 opens before live UAT | Phase 54 exit gate | R4.2 rows user-asserted before 55 opens |
| 6 — engine params in host API | Phase 55 | A5 fake engine-2 payload; R2.2 review gate |
| 7 — replay parity drift / compat shims | Phase 55 | R5.2 delta vs pre-move golden; A4 save/reopen; no legacy readers in diff |
| 8 — brush-pack ref / silent field loss | Phase 55 + 56 | Snapshot still embedded; mceFieldContract extended; round-trip pins |
| 9 — new cancellation model | Phase 55 | A3 leave-frame mid-bake; `efx-async-orchestration` review |
| 10 — wall-clock / unseeded RNG | Phase 55 + 56 | Tick grid + traceSeed; grep gate; A2 determinism row |
| 11 — oracle non-determinism ported | Phase 56 | Seeded draws reproduce look; A1–A3 rows; stated pixel-delta policy |
| 12 — stale licence premise | Phase 56 (plan time) | Licence re-check row + explicit user decision recorded; P1 outcome in Key Decisions |
| 13 — paper baked / forced Dry / live sim | Phase 56 | A5 transparent export; no rebake on paper; cache-only timeline |
| 14 — GPU/texture footprint | Phase 56 | Perf laws as acceptance rows; footprint measurement; chunk gate green |
| 15 — switcher forks Studio / ships Krita | Phase 56 switcher slice | One Studio engine; two modules; shortcut gating; no krita imports |
| 16 — duplicated/misplaced spectral mixing | Phase 56 early / 57 | Single package; CPU/GPU parity test; NOTICE shipped |
| 17 — fail-closed Apply erosion | Phase 55 + 56 | Cross-engine refusal tests; named visible errors |

## Sources

- `SPECS/v1.1.0-preact11/context.md` (R1–R4, prohibitions, ambiguity Q1–Q3) — HIGH
- `SPECS/v1.1.0-paint-host/context.md` (R1–R5, A5, prohibitions) — HIGH
- `SPECS/v1.1.0-water-color/00-grill-context.md` + `01-gsd-context.md` (bake model lock, licence table, algorithm map, P1–P7, R1–R4) — HIGH
- `.planning/PROJECT.md` Key Decisions + Known Debt (incidents: decode storms, OOM, adapter failure 27–32, PKG-06 serde drops, hide/solo duplication, unguarded shortcuts) — HIGH
- Preact 11 upgrade guide — https://preactjs.com/guide/v11/upgrade-guide/ (verified 2026-10-14) — HIGH
- `@preact/signals` peer range — https://github.com/preactjs/signals `packages/preact/package.json` (`preact >= 10.25.0 || >= 11.0.0-0`; no prose compat statement) — HIGH
- Oracle on disk: `SPECS/v1.1.0-water-color/watercolor-playground/` — `LICENSE` (MIT, Maksim Surguy 2026), `THIRD_PARTY_NOTICES.md`, `src/engine/Engine.ts` (Math.random/performance.now sites), `spectral.ts`/`spectralData.ts`, `papers.ts` — HIGH
- Codebase seams: `packages/efx-physic-paint/src/util/traceSeed.ts`, `src/animation/`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts`, `physicsPaintRotoPlayScriptController.ts`, `app/src/components/physic-paint/pilot/finalizationQueue.ts`, `app/src/lib/mceFieldContract.test.ts`, `app/src/lib/paperPass.ts`, `app/vite.config.ts` (chunk ceiling 2000) — HIGH
- Project memory laws: `feedback_paintversion`, `feedback_no_usestate_only_signals`, `feedback_live_evidence_over_unit_probes`, `feedback_chunk_budget_desktop`, `feedback_image_decode_cache`, `project_package_fs_scope`, `feedback_shortcuts`, `feedback_no_backward_compat` — HIGH
- GPU bit-stability of float pipelines (general rendering knowledge; not re-verified against a specific driver matrix) — LOW–MEDIUM: treat as a design constraint to specify (tolerance / reference path), not as a measured claim

---
*Pitfalls research for: v2.0.0 multi-module paint workstation — Preact 11 bump, efx-paint-host split, efx-watercolor engine, efx-spectral package, module switcher*
*Researched: 2026-10-14*
