# Phase 55: efx-paint-host (engine-1 host split) - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Split `packages/efx-paint-host` out of `packages/efx-physic-paint`. The host owns the shared Studio script law — animation schedules, `traceSeed`, the script envelope, ticks + `diffusionFrames` — and is generic over the per-engine stroke payload. `efx-physic-paint` keeps only engine-1 physics. This is a **move + contract extraction**, not a rewrite: engine-1 observable behavior is unchanged, proven by a pre-split golden bake.

Scope anchor: capture the pre-split golden fixture FIRST → extract `packages/efx-paint-host` (animation/ + traceSeed + script envelope + time/) → re-point `app/` and `efx-physic-paint` imports → standing parity pin (golden re-bake, delta zero) → genericity pin (fake engine-2 round-trip + import-graph) → fail-closed Apply pins → live UAT A1–A4 closes the phase.

Requirements in scope: HOST-01..HOST-05, DATA-01..DATA-03.

</domain>

<decisions>
## Implementation Decisions

### Golden replay parity (HOST-03 / R5.2 / success criterion 1)
- **D-01:** The golden is a **stored fixture**: one recorded engine-1 script plus its pre-split baked frames checked into the repo. The split re-bakes the same script in vitest and compares pixel-by-pixel with **target delta zero** on a deterministic re-bake (same `traceSeed`, integer ticks). Do **NOT** use `computeTierParityMetrics` — it compares the final-tier plane against itself and reports false green. Live side-by-side is reserved for the final visual UAT row, not for the parity guard. — **Reversibility:** costly — a wrong parity oracle makes the whole refactor guard untrustworthy; re-capturing the golden requires running pre-split code again.
- **D-02:** One fixture with **broad seam coverage** — a single recorded engine-1 script that exercises every shape the split moves: progressive + static schedules, a held-pose/motion wiggle, a `diffusionFrames`/cuisson tail, and at least one erase. If the split is clean the golden passes; if it fails, the pixel-delta output names which baked frame drifted. Per-shape fixtures are a maintenance matrix, not a split guard.
- **D-03:** The comparison is a **standing `.test.ts` pin** on the existing vitest setup (no one-off config), same family as the `paintVersion` / `mceFieldContract` / `preactSingleCopy` pins. A regression is caught the moment it lands. The phase-close SUMMARY already records the suite result — no separate close-gate machinery.
- **D-04:** The golden is **captured first**, entirely on pre-split code: the plan's first work item records the script, bakes it, and checks the fixture into the repo, then and only then starts moving modules. A golden captured after the move would be split-vs-itself and would prove nothing. The fixture is produced by the same deterministic path the pin re-bakes — no human capture step.

### Fake engine-2 genericity proof (HOST-04 / success criterion 2)
- **D-05:** **A5 is an automated pin, not a live UAT row.** The fake engine-2 payload compiles against the host, round-trips record → play → bake, and a static import-graph pin proves the host API carries zero engine-1 types — all in vitest. Genericity is a contract, not a visible behavior; asserting it live is theater for something a pin already proves. The **live UAT rows are A1–A4** (look, scrub, bake-survives-leave, save/reopen) — the rows only a human can judge. — **Reversibility:** reversible — a row can be added later if a reviewer insists; the pin carries the proof either way.
- **D-06:** The fake engine-2 is a **stub `EngineAdapter<P>` with real lifecycle methods** (`applyStroke` / `stepTick` / `captureFrame` / `dispose`) that record their calls and emit deterministic blank/tinted frames. The round-trip produces an actual baked frame whose pixels the test asserts — proving the host drives the adapter lifecycle end to end. Types-only would not exercise record → play → bake at all; a drawable engine is more maintenance than a refactor guard needs.
- **D-07:** Zero engine-1 types is proven by a **static import-graph pin**: a `.test.ts` walks `efx-paint-host`'s public entry points and fails if any import resolves into `efx-physic-paint` or any engine package, plus a type-level assertion that `StudioStroke<unknown>` / `EngineAdapter<unknown>` compile with zero engine-1 imports. The static pin subsumes a runtime assertion (if no import exists there is no call to make) and a source-level scan also catches dynamic-import leaks.
- **D-08:** The stub adapter and fake payload are a **test-only fixture** — not published from `efx-paint-host`, not importable by `app/` or engine packages. Exporting them would put test scaffolding into the public API, the opposite of the genericity goal; an example package is a Phase 56 consumer concern, not this phase's guard.

### Fail-closed Apply / named visible refusal (HOST-05 / DATA-02 / success criterion 3)
- **D-09:** Cross-engine refusal reaches the user through the **existing owned-refusal surface** — `buildRotoScriptApplyRefusalMessage` + `setLastError` / `setApplyStatus` / `clearOwnedScriptApplyRefusal` — extended with named cross-engine cases (e.g. "this script is for Water color, not Brush"). **No second error channel.** The host stays UI-free: it detects the engine mismatch and yields a typed refusal with no user-facing wording; the Studio boundary names it. The proof row is the fake engine-2 stub declaring a foreign `engineId` and the host refusing with that named message — a live watercolor refusal is Phase 56 scope. — **Reversibility:** costly — the Studio refusal surface has contract tests around it; a second channel would need those re-baselined.
- **D-10:** The user SEES the refusal on the **existing apply-status / lastError line** where Apply feedback already lives, named. No new UI chrome. The red-triangle row marker is the Phase 46 timeline-paste rejection language — reusing it for Apply would blur two distinct rejection vocabularies; a modal is the heavy pattern this project already rejects for non-blocking refusals.
- **D-11:** **Four named refusal cases**, each with its own message through the same extended mapper and the same apply-status line: (1) unknown `engineId`, (2) malformed/unparseable engine payload, (3) engine mismatch onto a different engine's layer, (4) unreadable/legacy script — the clean-break refusal. Every failure names what went wrong; nothing fails silently (DATA-02).
- **D-12:** "Never half-applies" is **refuse-before-write plus a no-partial pin**. Validation runs to completion before any write — on any named refusal case, no strokes, no cache, no Loop Clip are applied. On top of that, a pin fires each refusal path and asserts the document/canvas is untouched, so "never half-applies" is a tested fact rather than a construction assumption. Same family as the `paintVersion` / `mceFieldContract` standing pins.

### On-disk script format (DATA-01 / success criterion 4)
- **D-13:** Extracting `StudioScriptEnvelope` + `engineId` **does change the saved script JSON**. `StudioScriptEnvelope` + `engineId` becomes the saved shape — HOST-01/02 delivered for real, with a discriminator on disk for the fake engine-2 round-trip and for Phase 56 engines. Existing v1.0.1 scripts **refuse** with the named clean-break case (D-11 case 4). No migration, no dual-format reader (DATA-01). The "format-identical split" wording is the golden's job (prove moving code did not change what the engine produces), **not** a promise that old files keep opening ("not a compatibility surface"). One clean break in v2.0.0 rather than a second one in Phase 56. An optional `engineId` field would be exactly the dual-format soft migration DATA-01 forbids. — **Reversibility:** one-way — published on-disk format contract; no dual-format reader left to fall back on, and the clean-break law forbids reintroducing one.
- **D-14:** The clean-break refusal bites **all script surfaces**: the durable script library, scripts embedded in a `.mce`, and every Apply path. One format, one refusal. A v1.0.1 project with unparseable scripts still opens its frames, layers, and media — only the scripts refuse with the named clean-break message. Refusing the whole project conflates two payloads and is heavier than the named-visible-error law requires.
- **D-15:** `engineId` values on disk are the **package identities**: `'efx-physic-paint' | 'efx-watercolor' | 'efx-krita'`. The Studio maps them to the switcher's display names (Brush / Water color / Krita), so disk identity and UI label stay decoupled. User-facing names on disk would make a module rename break the discriminator (this project already carries EFX Paint vs EFX Physic Paint naming drift); numeric codes are opaque in a refusal message and in a hand-inspected script JSON. — **Reversibility:** one-way — once scripts are written with these ids, renaming them needs a migration the clean-break law forbids.
- **D-16:** Old scripts **stay visible in the library as refused rows** carrying the named clean-break message ("this script is from an older version"). Nothing is dropped silently (DATA-02), and deletion stays the user's explicit action — clean break means the format refuses to parse, not that the app destroys data on open.

### Locked by requirement / prior spec (not re-litigated)
- **D-17:** Host is **Preact-free** (paint-host spec Q3). If anything Preact-flavoured is needed it lives in a `./preact` entry exactly like `efx-physic-paint` already does. The watercolour engine is Preact-free; the host must not force Preact into engine packages. — **Reversibility:** costly — the package surface is published; a Preact dependency would leak into every engine.
- **D-18:** Whole `animation/` folder moves (Q1 default): `AnimationPlayer`, `progressiveStrokeSchedule`, `staticStrokeSchedule`, `recordedStrokeMotion`, `types.ts`. `AnimationStrokeStyleOverride` must lose `physicsMode` at the boundary — that becomes engine payload.
- **D-19:** Host-owned payload interface (Q2 preference): `StudioStroke<P>` / `StudioScriptEnvelope<P>` live in `efx-paint-host`; the engine defines its own `P` and a `payloadCodec`. Host code never inspects `P` (R2.2). No `waterAmount`, no `physicsMode`, no krita property names in the host API.
- **D-20:** Host owns the `diffusionFrames` **mechanism**; each engine owns its **cap policy** (e.g. watercolour cap 600 is the engine's bake window, not the host's) (Q4).
- **D-21:** No Web Worker, no new cancellation model. The bake host ports the `finalizationQueue` pattern (Effect v4 bounded queue, concurrency 2, `beginFlush`, generation-stale commits). PlayScript bake aborts on dispose; long fluid cuissons use flush-survives-navigation semantics (R4).
- **D-22:** Brush-pack **snapshot travels in `.mce`** — a deliberate exception to the 52.2 references-only law. Do not "fix" it into a reference (R3.4).
- **D-23:** Time is a fixed tick grid (~1/60 s), integer ticks, never raw ms (DATA-03). Exact tick value and the `types.ts` envelope/payload split shape are **plan-time items** (paint-host spec Q1/Q2 residue).
- **D-24:** Clean break law stands: no migration code, no dual-format readers, no backward-compat shims/branches (DATA-01). No engine-2 / engine-3 implementation in this phase — the split is the deliverable. No change to engine-1 physics behavior (R5.2 is the guard).
- **D-25:** `traceSeed` derivation (FNV-1a offset 2166136261 / prime 16777619 + mulberry32 stream) moves to `efx-paint-host/util/traceSeed.ts` **keeping the `seededRng(strokeSeed, streamKey)` signature** so engine-1 deposit paths re-point without logic changes. This IS the determinism law (R3.1–R3.2).

### Claude's Discretion
- Exact file layout inside `efx-paint-host` (`animation/` / `util/` / `script/` / `time/` / bake host), as long as the seam map in ARCHITECTURE.md §2.2 is honored.
- Commit sequencing of the extraction, as long as the golden fixture is captured and checked in **before** any module moves (D-04).
- The exact integer tick value and the precise `types.ts` field mapping between `PersistedRotoScriptV1` and `StudioScriptEnvelope` (plan-time residue, paint-host Q1/Q2).
- Shape of the stub `EngineAdapter<P>` test fixture (D-06/D-08), as long as the round-trip produces assertable pixels and the fixture is not published.

### Reviewed Todos (not folded)
- `261003-d08-tier-parity-harness-rescope.md` — "Retire or re-scope the D-08 tier-parity harness row to the one-pipeline contract". Matched on generic keywords only (parity, phase). It is about the physics-paint tier-parity harness (`computeTierParityMetrics` family), not host-split replay parity. Left out of Phase 55 scope. Note D-01 explicitly forbids reusing that harness for the golden guard.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec and requirements
- `SPECS/v1.1.0-paint-host/context.md` — phase-importable spec: R1–R5 requirements, A1–A5 UAT rows (A5 re-scoped to automated pin by D-05), prohibitions, ambiguity report (Q1–Q4 all resolved here/locked above). The requirement text lives here — do not paraphrase it away.
- `.planning/REQUIREMENTS.md` §Engine Host Split — HOST-01..HOST-05 and §Data Honesty — DATA-01..DATA-03 as locked milestone requirements
- `.planning/ROADMAP.md` §Phase 55 — goal + four success criteria; hard-gate wording from Phase 54 (now CLOSED)

### Seam map / architecture research
- `.planning/research/ARCHITECTURE.md` §2 (a) The efx-paint-host seam — the module move table (§2.2), `StudioStroke<P>` / `StudioScriptEnvelope<P>` / `EngineAdapter<P>` shapes (§2.3), dependency direction diagram, parity guard (§2.4). This is the authoritative seam map.
- `.planning/research/SUMMARY.md` §Phase 55 + §One Studio, N engines — tranche 0b wording, locked invariants
- `.planning/research/FEATURES.md` §Module switcher + §Phase 55 prerequisites — what consumes this seam next

### Upstream contracts (locked earlier, not re-litigated)
- `SPECS/v1.1.0-water-color/01-gsd-context.md` — tranche 0b wording; Q1 = per-stroke `diffusionFrames` (cap 600, script-owned); Q2 = fixed tick grid ~1/60 s (integer ticks); Q3 = `packages/efx-paint-host` split; Q4 = Studio law + per-engine payload + fail-closed Apply. All locked 2026-10-06.
- `SPECS/v1.1.0-water-color/00-grill-context.md` — packages target, tick grid, determinism, brush-pack snapshot exception

### Reactivity / async law (mandatory)
- `.claude/skills/efx-preact-reactivity/SKILL.md` — project reactivity discipline; the host is Preact-free (D-17) but `app/` re-pointing must keep `paintVersion` bump+subscribe intact
- `.claude/skills/efx-async-orchestration/SKILL.md` — Effect v4 bounded-turn queue conventions; the bake host ports this pattern (D-21)
- `CLAUDE.md` §Preact — binding project instruction

### Live code (the move surface)
- `packages/efx-physic-paint/src/animation/` — `AnimationPlayer.ts`, `progressiveStrokeSchedule.ts`, `staticStrokeSchedule.ts`, `recordedStrokeMotion.ts`, `types.ts` + their tests (whole folder moves, D-18)
- `packages/efx-physic-paint/src/util/traceSeed.ts` — `fnv1a`, `hashMutationId`, `seededRng` (moves, signature kept, D-25)
- `packages/efx-physic-paint/src/types.ts` — `PaintStroke.diffusionFrames`, `AnimationConfig` (engine-1 payload extraction source)
- `packages/efx-physic-paint/src/index.ts` — current export surface to re-point
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` — today's `PersistedRotoScriptV1` (becomes engine-1's payload codec on top of the host envelope, D-13)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — bake host consumer (re-pointed, no behaviour change at the seam)
- `app/src/components/physic-paint/pilot/finalizationQueue.ts` — the bake-host pattern to port (D-21)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` + `PhysicsPaintStudio.tsx` (`buildRotoScriptApplyRefusalMessage`, `clearOwnedScriptApplyRefusal`) — the refusal surface to extend (D-09/D-10)

### Law / constraints
- `.planning/PROJECT.md` §Key Decisions — v2.0.0 clean break, fail-closed, ONE shared Studio engine, generic host APIs, tick grid, brush-pack snapshot exception
- `project_package_fs_scope.md` law (memory) — all package/cache IO through Rust; static scans pin both

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/efx-physic-paint/src/animation/` — moves whole; its tests move with it and become the host's first coverage
- `packages/efx-physic-paint/src/util/traceSeed.ts` — moves as-is (signature kept); this IS the determinism law the golden re-bake depends on
- `app/src/components/physic-paint/pilot/finalizationQueue.ts` — Effect v4 bounded-queue pattern to port as the bake host (not a copy-paste; the pattern, per D-21)
- `buildRotoScriptApplyRefusalMessage` + owned-refusal refs in `PhysicsPaintStudio.tsx` — the refusal surface D-09 extends; existing contract tests around it are the baseline
- Existing vitest setup (`pnpm --filter efx-motion-editor exec vitest run`) — home of the golden pin (D-03), the fake-engine-2 pin (D-05), the import-graph pin (D-07), and the no-partial pin (D-12). No new config.

### Established Patterns
- **Standing contract pins** — `paintVersion` discipline, `mceFieldContract`, `preactSingleCopy`: a normal `.test.ts` that fails loudly when an invariant drifts. Every new guard in this phase joins that family (D-03, D-07, D-12).
- **paintVersion bump + subscribe** — must survive the `app/` re-point (R1.3 says no behaviour change at the seam).
- **Owned-refusal pattern** — `scriptApplyRefusalOwnedRef` + `clearOwnedScriptApplyRefusal` keeps one error channel coherent; D-09 extends it rather than adding a second.
- **Workspace singletons via root `pnpm.overrides`** — `packages/efx-paint-host` joins the pnpm workspace the same way `efx-physic-paint` does.

### Integration Points
- `packages/efx-paint-host` sits between `app/` (Studio) and engine packages. Dependency direction after the split: `app/ → efx-paint-host → (nothing engine-specific)`; `app/ → efx-physic-paint → efx-paint-host`; later `app/ → efx-watercolor → efx-paint-host`.
- `app/` import re-point sites: `physicsPaintRotoPlayScriptController.ts`, `finalizationQueue.ts` callers, any `efx-physic-paint/animation` import (R1.3 — re-point only, no behaviour change).
- `packages/efx-physic-paint` `exports` map already has the `.` / `./preact` / `./animation` shape — the host should mirror that (with `./preact` only if needed, per D-17).
- Script library UI reads the durable scripts folder — the refused-row surface (D-16) lands there.

### Measured tree facts (2026-10-14)
- `animation/` is 5 source files + 4 tests + `index.ts` — small enough to move whole
- `diffusionFrames` appears across `types.ts`, `core/spreadScale.ts` (`TICK_FLOOR = 3`), and `engine/EfxPaintEngine.ts` — the engine-side usages stay; only the mechanism moves
- An owned-refusal surface with contract tests already exists in `PhysicsPaintStudio.test.ts` (mentions `buildRotoScriptApplyRefusalMessage`, `clearOwnedScriptApplyRefusal`)
- No golden/parity harness exists in tree today — D-01..D-04 build it

</code_context>

<specifics>
## Specific Ideas

- "Do NOT use computeTierParityMetrics — it compares the final-tier plane against itself and reports false green." The golden guard must be an independent oracle, not a re-run of the thing it is checking.
- "Live side-by-side is reserved for the final visual UAT row, not for the parity guard." The parity guard is a deterministic pin; the look is a human judgment (A1–A4).
- "If the golden were captured after the move, the comparison would be split-vs-itself and would prove nothing." Sequencing is the guard: capture first, on pre-split code.
- "The project just re-learned that an unasserted invariant is a false green waiting to happen." Every law in this phase that can be pinned, is pinned (D-03, D-07, D-12) — construction assumptions are not acceptance.
- "One clean break in v2.0.0 rather than a second one in Phase 56." The envelope change is taken now, once, so engine 2 does not force a second format break.
- "Clean break means the format refuses to parse, not that the app destroys data on open." Refused rows stay visible; deletion is the user's action.

</specifics>

<deferred>
## Deferred Ideas

- **Live watercolor cross-engine refusal** — D-09's proof row uses the fake engine-2 stub; a real watercolor-vs-brush refusal is Phase 56 scope.
- **Example engine package** (a copyable `EngineAdapter<P>`) — a Phase 56 consumer concern, not this phase's guard (D-08).
- **`computeTierParityMetrics` retirement / D-08 tier-parity harness re-scope** — reviewed and left out (see Reviewed Todos). Separate concern from host-split replay parity.
- **Engine-1 spectral adoption (KRT-02)** — v2.1.0, Q5-gated at milestone close.
- **Export smoke + chunk-budget checks** — release gates, not host-split gates. (Watch the 2000 kB vite ceiling if the new package shifts chunking — but that is a release gate, not this phase's deliverable.)

None else — discussion stayed within phase scope.

</deferred>

---

*Phase: 55-efx-paint-host-engine-1-host-split*
*Context gathered: 2026-10-14*
