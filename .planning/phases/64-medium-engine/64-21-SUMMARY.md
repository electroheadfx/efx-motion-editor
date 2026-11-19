---
phase: 64-medium-engine
plan: 21
subsystem: watercolor / determinism foundation — recorded paper seed and per-bristle state
tags: [watercolor, determinism, paper-seed, bristles, carrier, reservoirs, doc-targets, tdd, identity-gates]

# Dependency graph
requires:
  - phase: 64-07
    provides: the document read path that resolves the paint-layer document at render time
  - phase: 64-13
    provides: the coverage composite and its committed pins
  - phase: 64-20
    provides: the coverage transport, the shared FILM_PRESENCE gate and the committed identity baselines
provides:
  - the deterministic bristle set (`bristles.ts`): one RNG, one fixed call order, 8-float stride, §4.1 count law
  - `paperSeed` recorded end to end — TS document field, fail-closed parser, FNV-1a `derivePaperSeed`, Rust mirror, mceFieldContract tripwire — and the `setPaperSeed` engine seam + adapter option
  - the retiral of `withSeededMathRandom`; a difference control proves the seed load-bearing
  - the fixed 1 × 256 three-attachment RGBA16F bristle reservoir pair plus the static shape texture, in `docTargets()` for wipe/resize/disposal reach
  - `bristleCarrierFS` (§3.1 pickup/refill/load law) and its pass, wired before every cover/deposit on bristle responses only
affects: [64-22 (the gather deposit reads the reservoirs), 64-24 (the last-touch field and the eleventh texture), phase-64 verification]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 22210
  tasks: 3
  commits: 4
plan_head_before: 82520a8161625a616e2c715c0bbe91778ad061c0
plan_head_after: cada96ae2f892c2f454c49384ab1f6e7a05182d4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Record-first determinism: engine entropy that shapes a stroke is either recorded (`paperSeed`) or derived from recorded identity (`derivePaperSeed(layerId)`), applied before the first dab, and proven load-bearing by a difference control — never hidden by a `Math.random` patch"
    - "Inert-state-first slices: allocate and update per-stroke state before any consumer reads it, so the look cannot move and the acceptance is byte-identical identity digests"
    - "Fixed-size GPU state in docTargets(): a document-independent 1 × 256 target joins the sheet targets for wipe/resize/disposal reach and is made safe by re-seeding at every stroke start"
    - "Same-session twin gates: a pass with no visual law yet is proven deterministic by two identical runs compared with `--other`"

key-files:
  created:
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/bristles.test.ts
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/playground/brushes.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src-tauri/src/models/project.rs
    - app/src/types/project.ts
    - app/src/lib/mceFieldContract.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "The paper seed rides the light's optional-additive precedent: `paperSeed?: number` on the document, absent reads as `derivePaperSeed(layerId)` (FNV-1a 32-bit / 2^32), one adapter option applied before the first stroke, and `resetSheet`/`setPaper` keep the seed."
  - "The Rust mirror is a declaration-class `MceDocumentPaperSeed` struct: the paint document is opaque (`HashMap<String, Value>`) in Rust, so the cross-language pin is declaration-level (the PATTERNS-endorsed shape), with a deliberate no-validation asymmetry documented in source."
  - "The bristle set consumes `this.rng` (the stroke's `traceSeed`) at the first dab, before `eachDab`; the seeded stroke is tracked by object identity, so a new stroke always re-seeds and no cleanup hook exists."
  - "The carrier ships proxy wetness only (`wet * coverage`): `uWetMode` and the last-touch sampler are 64-24's, so the pass binds ten textures, not eleven."
  - "The reservoir pair and the shape target stay in `docTargets()` deliberately — membership buys disposal reach (resize, applyWhole) and wipe reach; the shape's re-upload at every stroke start is the safety that makes a zeroed or replaced target unobservable."
  - "No deposit change, no second engine, no document-sized target: the D-29 delivery law is honoured exactly and no committed baseline was edited."

patterns-established:
  - "Record-first determinism: an unrecorded seed is a replay defect, not a test problem — pin it in the record, apply it before the first stroke, prove it with a same-seed/different-seed control."
  - "An inert-state-first slice is accepted by byte-identical digests: when nothing visible moves, any digest movement is a plumbing defect rather than a look to judge."

requirements-completed: [MED-02]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The deterministic bristle set: one RNG, one fixed call order (6 per run header incl. a clipped run, 8 per bristle), the §4.1 count law, and pure-function equality/difference controls."
    requirement: MED-02
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/bristles.test.ts (18 tests) + gsd_run check tdd-red-evidence → RED_EVIDENCE_OK (target_test_failed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The paper sheet seed is recorded end to end: optional additive `paperSeed` in TS and Rust in one pass, fail-closed parser ([0,1) finite), derived fallback, applied before the first stroke at every bake site and on the live layer, with `withSeededMathRandom` retired."
    requirement: MED-02
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts (15) + app/src/lib/mceFieldContract.test.ts (25) + document suites (151)"
        status: pass
      - kind: integration
        ref: "pnpm --filter @efxlab/efx-watercolor check && build; pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fixed 1 × 256 three-attachment RGBA16F reservoir pair and the static shape texture exist, allocated after the coverage pair, listed in docTargets() between the wet mask and the thickness target."
    requirement: MED-02
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#declares no additional render target… (thirteen allocations) and #keeps the 64-21 bristle targets inside docTargets"
        status: pass
    human_judgment: false
  - id: D4
    description: "The carrier runs before every cover/deposit on a bristle response only, samples the canvas under the dab, writes only the reservoir pair, and re-seeds once per stroke object from the stroke RNG."
    requirement: MED-02
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#runs the 64-21 carrier before every deposit, only on a bristle response"
        status: pass
      - kind: integration
        ref: "same-session twin: run.mjs --gate bristle-carrier-a/-b --scenario cover-textured --size 512 --brush bristle-flat; compare.mjs bristle-carrier-a --other bristle-carrier-b"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every committed identity gate is byte-identical and no baseline file was edited: neutral-identity (256), neutral-pigment (256), watercolor-50 (1080), cover-textured --brush chalk (512), cover-advect/cover-lift/cover-over-wet (256, Body 100), red-over-blue-50 (1080, Body 100)."
    requirement: MED-02
    verification:
      - kind: integration
        ref: "compare.mjs neutral-identity, neutral-pigment, watercolor-50, cover-textured, cover-advect, cover-lift, cover-over-wet, red-over-blue-50 — all PASS with git status clean under probe/medium-engine/baselines"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-11-19
status: complete
---

# Phase 64 Plan 21: A Recorded Sheet and a Per-Bristle Set, With Nothing Visible Moved Summary

**The extension's foundation is recorded contract: the paper seed is a document field (derived when absent) applied before the first stroke, the bristle set is a pure function of the stroke's `traceSeed`, and the §3.1 carrier already feeds three 1 × 256 reservoirs ahead of every deposit — while all eight committed identity gates stay byte-identical and no baseline file was touched.**

## Performance

- **Duration:** 13 min (span of this plan's commits; the analysis that preceded the RED commit ran in the pre-compaction context and is not in this measure)
- **Started:** 2026-11-19T13:02:52Z (first task commit, RED)
- **Completed:** 2026-11-19T13:15:46Z (final task commit)
- **Tasks:** 3 of 3
- **Files modified:** 20 (2 created, 18 modified)

## Accomplishments

- `bristles.ts`: the deterministic per-bristle set, a faithful port of spike 002's `makeBristles` — one RNG, one fixed call order, 8-float stride, `count = round(clamp(2·halfWidth/1.1, 40, 256))` (§4.1), run headers of 3–17 sharing radius/touch/load/value (§4.2). 18 pinned tests including draw counts (`14·6 + 40·8`, `4·6 + 40·8`, `3·6 + 40·8`), a scripted six-value header pinning each header slot's role, and a source scan forbidding wall-clock/`Math.random` call forms.
- `paperSeed` end to end: `readonly paperSeed?: number` on the document (optional-additive law), `derivePaperSeed(layerId)` (FNV-1a 32-bit / 2^32), a fail-closed parser normalizer (`[0, 1)`, finite; `null` is not absence), the Rust mirror `MceDocumentPaperSeed` with `skip_serializing_if`, the mceFieldContract member/casing pins, and the engine seam `setPaperSeed` (compare-then-write, redraws the paper once) applied through the adapter option before the first stroke. Every bake site (Apply, both recovery bakes, the Roto renderer/controller) and the live layer (`AquarelleCanvasLayer` + its mount) receive `document.paperSeed ?? derivePaperSeed(layerId)`.
- `determinismContract.test.ts` no longer patches `Math.random`: a same-seed pair reproduces the exported digests and `PAPER_SEED + 1` diverges — the seed is load-bearing, proven by a difference control.
- The carrier: `bristleCarrierFS` ports §3.1 verbatim (thirst, pickup ≤ 0.75, refill ≤ 1, the two mix stages, the load depletion/top-up) with the rim-contact noise (§5.3) and `touchOf`; three outputs into the reservoir pair; proxy wetness only. `beginBristles` seeds and uploads the reservoirs into the WRITE half and swaps; the shape (radiusScale, touchReach, loadRate, jitter) is re-uploaded at every stroke start; `bristleTravel` supplies per-dab distance; `carrierPass` draws one invocation per bristle before the cover pass and the deposit; `readBristles()` exposes the three attachments as half floats for 64-22's probe.
- The fixed targets joined `docTargets()` between the wet mask and the thickness target with the coverage pair still LAST; thirteen allocations, the 23-program literal untouched (the carrier registers outside it).
- Identity, measured: eight gates byte-identical, no baseline edit. New same-session twin (`cover-textured --brush bristle-flat`, 512, runs a/b): all 7 fields equal, invariants hold — the carrier path is deterministic in a real GL context before it has a look.

## Task Commits

Each task was committed atomically (the TDD task split into RED then GREEN):

1. **Task 1: The deterministic bristle set** (TDD)
   - `7ce49b39b` (test) add failing pins for the deterministic bristle set
   - `b90e3b886` (feat) implement the deterministic bristle set
2. **Task 2: The recorded sheet seed** — `1d83bfe48` (feat) record the sheet seed end to end and retire the Math.random patch
3. **Task 3: The reservoirs and the carrier** — `cada96ae2` (feat) add the bristle reservoirs and carrier pass

**Plan metadata:** the docs commit that carries this SUMMARY.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/bristles.ts` — **created.** The deterministic set: `BRISTLE_CAP`/`BRISTLE_SPACING_PX`/`BRISTLE_MIN`, `bristleCount`, `makeBristles`; the determinism contract in the header.
- `packages/efx-watercolor/src/playground/bristles.test.ts` — **created.** 18 pins: count law, pure-function equality, difference control, closed RNG draw counts, header roles, run sharing, monotone across/edge laws, stride.
- `packages/efx-watercolor/src/playground/Engine.ts` — `paperSeedPin` + `setPaperSeed`/`getPaperSeed` (compare-then-write, redraw once); `bristles`/`bristleShape` targets + allocation comments; `docTargets()` membership; `bristleCarrier` outside the pinned literal; `beginBristles`/`bristleTravel`/`carrierPass`/`readBristles`; the brush case's single predicate + per-stroke seeding and the carrier-first eachDab ordering.
- `packages/efx-watercolor/src/playground/shaders.ts` — `bristleCarrierFS` with the NOISE family, `BRISTLE_TEXTURES`, the reservoir/shape layout documented, and the §3.1/§3.4 citations.
- `packages/efx-watercolor/src/playground/brushes.ts` — `isBristleResponse` (D-27), declared after `bristleTip` so the tip-source pin's first match is unchanged.
- `packages/efx-watercolor/src/playground/brushes.test.ts` — the D-27 predicate truth table (absent/null texture, texture pick refused, other responses refused).
- `packages/efx-watercolor/src/playground/scattering.test.ts` — the allocation pin repointed to thirteen with the reservoir text; new pins for carrier ordering, the single predicate site, and the docTargets placement.
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — `paperSeed?: number` option applied before the first stroke.
- `packages/efx-watercolor/src/determinismContract.test.ts` — FakeWatercolorEngine `setPaperSeed`, digest byte 2, `replayBytes(paperSeed)`, `withSeededMathRandom` retired with a sealing comment, and the load-bearing test.
- `app/src/efx-paint/document/efxPaintDocument.ts` — `paperSeed?: number` (optional-additive comment) and `derivePaperSeed`.
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` — `DOCUMENT_KEYS` admission, `normalizeDocumentPaperSeed` (fail-closed), the spread into the returned document.
- `app/src-tauri/src/models/project.rs` — `MceDocumentPaperSeed` declaration struct with the derivation and no-validation-asymmetry notes.
- `app/src/types/project.ts` — the TS declaration `MceDocumentPaperSeed` the field-contract tripwire parses.
- `app/src/lib/mceFieldContract.test.ts` — the Phase 64-21 describe: member keys, snake_case/lowercase negatives, one-language negatives.
- `app/src/stores/physicPaintStore.ts` — both bake sites pass `paperSeed: document.paperSeed ?? derivePaperSeed(input.layerId)`.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` / `…Controller.ts` — `paperSeed` on the render input and the adapter factory/forwarding.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` / `PhysicsPaintCanvasMount.tsx` — the live getter chain (`getPaperSeed` → `applyLiveConfig`).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `documentPaperSeed()` beside `documentLight()`: document value or derived fallback; passed at Apply + both recovery bakes and to the canvas mount.

## Decisions Made

- **The seed is recorded, not patched.** A document carries `paperSeed` when it has one; absent reads as `derivePaperSeed(layerId)` — no migration, no mount write, and `resetSheet`/`setPaper` never re-roll it. The determinism suite proves same-seed equality AND different-seed inequality.
- **The Rust side is a declaration-class mirror.** The paint document is an opaque map in Rust, so `MceDocumentPaperSeed` exists to make the cross-language edit tripwire real — the shape PATTERNS.md records, with the deliberate no-validation asymmetry documented in the struct.
- **Bristle seeding rides the stroke object.** The predicate is computed once per stamp from the active brush; `this.bristleStroke !== s` seeds `beginBristles` before `eachDab` — a new stroke always re-seeds, the same stroke never does, no cleanup hook.
- **The carrier ships proxy wetness only.** `uWetMode`/`uTimes`/`uNow`/`uWetSeconds` belong to 64-24, so the pass binds ten textures; the spike's unread `uSheetAspect` is not declared (an unread uniform is optimized out and could not be bound).
- **docTargets membership is deliberate.** A resize/applyWhole disposes `docTargets()`; keeping the fixed targets out would leak them. The shape's re-upload at every stroke start makes a zeroed/replaced target unobservable, and the reservoirs are only read inside a seeded stroke.
- **No deposit change.** The gather is 64-22's; this plan changes no rendered pixel and the acceptance is byte-identical digests.

## TDD Gate Compliance

- RED before GREEN: `7ce49b39b` (`test(64-21)`) precedes `b90e3b886` (`feat(64-21)`); Tasks 2 and 3 are `type="auto"` without `tdd="true"`, so no RED commit exists for them.
- RED evidence: `.gsd/tdd-evidence/64-21/bristles-red.json` (+ `bristles-red-junit.xml`) validated by `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` — the named header-order test failed on its planned assertion (JUnit: 18 tests, 15 failing; the skeleton was type-correct so the suite collected).
- GREEN proven: `vitest run` over the package — 34 files, 628 passed, 8 skipped (the skips are pre-existing in `engineAdapter.test.ts`); `bristles.test.ts` 18/18.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan arithmetic: `bristleCount(55)` is 100, not 91**
- **Found during:** Task 1
- **Issue:** The plan's `<behavior>` claims `bristleCount(55) === 91`, but the law it states (`round(clamp(2·halfWidth/1.1, 40, 256))`) yields 100; 91 corresponds to halfWidth 50.
- **Fix:** Implemented the stated law and pinned both `bristleCount(50) === 91` and `bristleCount(55) === 100`.
- **Files modified:** `bristles.test.ts`
- **Commit:** `7ce49b39b` / `b90e3b886`

**2. [Rule 2 - Correctness] Two files the plan's list missed**
- **Found during:** Task 2
- **Issue:** (a) `mceFieldContract.test.ts` parses `app/src/types/project.ts`, not the document module, so the TS declaration the tripwire needs lives there; (b) the live light plumbing rides `PhysicsPaintCanvasMount`, so `paperSeed` needs the same prop/ref threading or the live layer would never receive it.
- **Fix:** Added `MceDocumentPaperSeed` to `types/project.ts` and the `getAquarellePaperSeed` prop/ref to the mount.
- **Files modified:** `app/src/types/project.ts`, `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`
- **Commit:** `1d83bfe48`

**3. [Rule 1 - Adaptation] No Rust paint-document struct exists**
- **Found during:** Task 2
- **Issue:** The plan says "mirrored in Rust", but the paint document is an opaque `HashMap<String, Value>` there; there is no struct to add a field to.
- **Fix:** A declaration-class `MceDocumentPaperSeed` struct (PATTERNS-endorsed), carrying the field name, the derivation reference and the deliberate no-validation asymmetry; the tripwire now binds both languages.
- **Files modified:** `app/src-tauri/src/models/project.rs`
- **Commit:** `1d83bfe48`

### Scope adaptations (recorded)

**4. The carrier binds ten textures, not the plan's eleven.** `uWetMode`, `uTimes`, `uNow` and `uWetSeconds` are 64-24's by the plan's own instruction; the proxy mode is the only one shipped. The spike's `uSheetAspect` was declared but never read, so it is not declared here.
**5. `beginBristles` takes the radius only.** The plan names `beginBristles(pr, radiusValue)`, but no seeding law reads pressure (the spike's `pr` was unused too).
**6. `isBristleResponse` is declared after `bristleTip`.** The pre-existing tip-source pin matches the FIRST `*bristle*` function; moving the predicate below the tip generator keeps that pin intact without editing it.
**7. Test files beyond the plan's list.** `brushes.test.ts` gained the D-27 predicate table (the plan's action asks for a test beside the ids) and `scattering.test.ts` gained ordering/docTargets pins (the acceptance asks for source pins proving the carrier ordering and the target placement).

### Operational note

The app resolves `@efxlab/efx-watercolor` from its built `dist/*.d.ts`; after the package change, `pnpm --filter @efxlab/efx-watercolor build` must run before the app's `tsc --noEmit` (it is already part of Task 3's verify chain).

## Issues Encountered

- The tip-source pin's `/\w*[Bb]ristle\w*/` regex matched the new `isBristleResponse` name because it preceded `bristleTip`; resolved by declaring the predicate after the tip generator (the pin itself is untouched).
- No baseline files were edited; `git status` under `probe/medium-engine/` is clean after all eight gates and the bristle twin.

## Known Forward Seams (not stubs)

- `readBristles()` has no in-repo consumer yet: 64-22's gather probe and tests read it. It is the documented window into the reservoir state, not placeholder data.
- The carrier's `uCount` uniform is bound but unread by the shader (the draw rect is the count authority); it stays declared for 64-22's gather, which reads it.

## Threat Flags

None — no security-relevant surface beyond the plan's register. All five mitigations are live: T-64-67 (one pin/derivation/option, fail-closed parser, load-bearing control), T-64-68 (fixed RNG order, draw-count pins, pure-function pins), T-64-69 (docTargets placement + shape re-seed), T-64-70 (same-pass dual declaration + tripwire), T-64-71 (accepted: a few kilobytes of fixed-size targets).

## Self-Check: PASSED
