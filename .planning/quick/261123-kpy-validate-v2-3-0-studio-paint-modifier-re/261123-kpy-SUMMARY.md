---
phase: quick/261123-kpy
plan: 01
subsystem: studio-paint-engine
tags: [relief, emboss, modifier, pressure, aquarelle, aqtl, probe-gate, undo-protection]

# Dependency graph
requires:
  - quick: 261123-hr5
    provides: the signed Emboss band (-15..15) — the thickness target, reliefErode and the probe band readings
  - quick: 261123-jak
    provides: the persistence spine (recorded marker, JSON codec, AQTL bit, Roto schema, duplicate projection, adapter replay, no-paint twin) — semantics superseded, spine kept
provides:
  - "Stroke.relief latched ONCE at pointerdown from the resolved tool (Shift erode / Cmd deposit, Shift wins, no Emboss gate) plus a per-sample pressureless sentinel (p < 0)"
  - "reliefModifier.ts: the pure magnitude law (pressure-only, GAIN 15 per polarity, sentinel = full 1.0) with both modifier branches guarded out of every paint/water/cover/carrier write and own ink-rect undo protection"
  - "relief: 'erode' | 'deposit' through the recorded bag, JSON codec, AQTL v4 vectorFlags bits 5-6 (both-set refused), Roto schema + duplicate projection, adapter replay"
  - "probe scenario emboss-relief-modifier with erode, deposit and pressure arms plus the off-sheet inert twin (--relief-control) and compare modes --relief-modifier [<control>] / --relief-pressure <full-press>"
affects: [studio-paint-uat, roto-duplicate-script, script-timeline-codec-readers, fresh-session-key-residual]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 39036    # chars/4 over the realized diff (git diff 5c0c7fa7c..HEAD = 156144 chars)
  tasks: 3
  commits: 5
plan_head_before: 5c0c7fa7cb2f101080763f29524926fe2d3ae2c6
plan_head_after: 04ec5c7433842157601845cd7c27757ce606a0ac

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-stroke polarity latched at pointerdown from the RESOLVED tool, never re-derived downstream"
    - "Pressure-only magnitude: the pure law takes the embossPress curve value or the full 1.0 sentinel; the Emboss slider is never read"
    - "AQTL vectorFlags bit as the whole marker — two bits now (0x20 erode / 0x40 deposit), no payload byte, version stays 4, both-set refused"
    - "No-paint proof stays an off-sheet inert twin (two sheets away, empty stampRect, touch() early-returns) compared on FINAL unshaded film digests for BOTH polarities"
    - "Pressure law proven geometrically on the real engine: a light pen relieves strictly less than full press; the sentinel holds a measured 0.9x floor"

key-files:
  created:
    - packages/efx-watercolor/src/playground/reliefModifier.ts
    - packages/efx-watercolor/src/playground/reliefModifier.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/relief.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/payload/codec.test.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
    - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
    - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
    - packages/efx-watercolor/src/playground/coverage.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts

key-decisions:
  - "Shift wins over Cmd at pointerdown; the latch is read from the resolved tool and never re-derived, so a mid-stroke modifier change cannot flip the stroke"
  - "Magnitude is pressure-only through reliefModifierSigned with both gains at 15 — this reproduces jak's approved +15 erode magnitude exactly at recorded pressure and mirrors it for deposit; the Emboss slider is never read, so both modifiers work at Emboss 0"
  - "The p < 0 recorded sentinel resolves to exactly full press (1.0); amount and radius still scale through the existing simPressure path, which is why the pressureless arm is near-full but not identical"
  - "Gains stayed 15/15: the measured p=0.3 arm is strictly weaker (ratio 0.7917), so the clamped erode is NOT saturating and the plan's gain-lowering condition does not trigger"
  - "AQTL keeps version 4: bit 5 (0x20) keeps jak's erode meaning, bit 6 (0x40) is new for deposit, both-set is a decode refusal, and the unknown-flag test moves to 0x80"
  - "Every boundary refuses an unknown relief value instead of defaulting (encode side included) — an absent key can never start a modifier pass"

requirements-completed: []

coverage:
  - id: D1
    description: "Engine: Stroke.relief latched once at pointerdown (Shift erode / Cmd deposit, Shift wins, no Emboss gate), per-sample p < 0 sentinel, the pure magnitude law, every paint/water/cover/carrier write guarded, own ink-rect undo protection, normal path byte-identical"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#modifier relief (quick 261123-kpy)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/reliefModifier.test.ts#modifier relief magnitude law (quick 261123-kpy)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#resolveStrokeWidthFactors (61-04)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#relief-only replay is deterministic and salted"
        status: pass
    human_judgment: false
  - id: D2
    description: "The polarity rides the recorded bag only when latched: toStudioStroke, JSON codec (refuses unknown values), AQTL bits 5-6 (no payload byte, both-set refused, bit 7 still refused), Roto schema, duplicate projection, adapter replay; an ordinary stroke keeps its exact key set"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/toStudioStroke.test.ts#relief engine block (quick 261123-kpy)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#relief carrier (quick 261123-kpy)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL v2 per-vertex colour (261111-wd6)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#relief polarity on the script engine slot (quick 261123-kpy)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts#quick 261123-kpy — a copied modifier stroke keeps its polarity"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts#Studio catalog accuracy"
        status: pass
    human_judgment: false
  - id: D3
    description: "Probe scene emboss-relief-modifier proves the law on the real engine: erode halves the +15 band mean with the peak not raised on reliefFS and bristle arms, deposit raises a light band, both polarities paint nothing against the off-sheet twin, a/b replays match, a light press relieves strictly less"
    verification:
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate emboss-relief-modifier-erode --scenario emboss-relief-modifier --relief-mode erode && node packages/efx-watercolor/probe/medium-engine/compare.mjs emboss-relief-modifier-erode --relief-modifier emboss-relief-modifier-erode-control"
        status: pass
      - kind: integration
        ref: "compare.mjs emboss-relief-modifier-deposit --relief-modifier; emboss-relief-modifier-erode-bristle pair; erode and deposit -a/-b --other pairs; --relief-pressure p03/none vs p1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Neutral and Emboss-15 film identity vs pre-change HEAD captures; full package and app suites plus both typechecks; shaders, medium records and display law untouched"
    verification:
      - kind: integration
        ref: "compare.mjs emboss-pos15 --other emboss-pos15-kpy-head; compare.mjs neutral-identity --other neutral-identity-kpy-head (12/12 fields equal each)"
        status: pass
      - kind: integration
        ref: "pnpm --dir packages/efx-watercolor exec vitest run; run check; pnpm --dir app exec vitest run; pnpm --dir app exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D5
    description: "the ten live UAT rows (erode, deposit, pressure, mouse, Emboss 0, Alt, settle, re-render, identity, latch) on the real Studio surface with a pen and mouse"
    verification: []
    human_judgment: true
    rationale: "Visible paint behaviour, pen pressure feel, modifier feel and the settled/re-rendered surfaces are artist judgment — the probe proves the law but not the feel; the artist runs the Studio."
---

# Quick 261123-kpy: Pressure-driven Studio paint modifier relief Summary

**Shift-at-start erodes relief and Cmd-at-start deposits it — both pressure-only, Emboss-slider-independent, paint-free and latched once per stroke — carried as `relief: 'erode' | 'deposit'` through the bag, JSON codec, AQTL bits 5-6 and Roto, and proven on the real engine by a new probe scene with byte-identical-film control twins.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-11-23T14:13:26Z
- **Completed:** 2026-11-23T14:43:14Z
- **Tasks:** 3
- **Files modified:** 28 (25 modified, 2 created, 1 renamed)

## Accomplishments

- Replaced jak's binary `reliefOnly` latch with a real modifier pair: Shift at brush-stroke start erodes relief, Cmd deposits it, Shift wins both; magnitude comes from pen pressure only (the recorded `p < 0` sentinel is exactly full 1.0), so both work identically at Emboss 0.
- Extracted the pure law into `reliefModifier.ts` (both gains 15, reproducing jak's approved erode magnitude exactly and mirroring it for deposit) and wired the polarity through the recorded bag, JSON codec, AQTL vectorFlags bits 5-6 (no payload byte, both-set refused, version stays 4), the Roto schema, duplicate projection and the adapter's `scriptBegin` replay.
- Rebuilt the probe scene as `emboss-relief-modifier` with erode, deposit and pressure arms plus the off-sheet inert twin, and measured the whole law on the real WebGL2 engine — relation, no-paint, replay parity, pressure ordering and identity all pass.

## Task Commits

Each task was committed atomically (TDD: RED test then GREEN feat):

1. **Task 1: pressure-driven modifier relief (engine)** — `0b1f8529c` (test) + `a26dc7daf` (feat)
2. **Task 2: the polarity across the app boundaries** — `cadad9211` (test) + `efe819015` (feat)
3. **Task 3: probe scene and gates** — `04ec5c743` (test)

**Plan metadata:** docs commit handled by the orchestrator (this quick is dispatched with docs-commit deferred).

_Note: the TDD pairs mirror jak's two-commit per-task pattern._

## Files Created/Modified

- `packages/efx-watercolor/src/playground/reliefModifier.ts` — the pure magnitude law (`ReliefMode`, both gains, `reliefModifierPress`, `reliefModifierSigned`)
- `packages/efx-watercolor/src/playground/reliefModifier.test.ts` — sentinel exactness, curve passthrough, polarity signing, light-press weakness, per-gain scaling
- `packages/efx-watercolor/src/playground/Engine.ts` — the one latch at pointerdown (from the resolved tool, no Emboss gate), the `p < 0` per-sample sentinel in both consume branches, the `s.relief === null` guard block, the own ink-rect touch, the latched report at stroke end
- `packages/efx-watercolor/src/playground/relief.test.ts` — new `modifier relief (quick 261123-kpy)` describe (9 pins)
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` + `.test.ts` — `relief` against the conditional-spread convention; the jak describe rewritten per W1
- `packages/efx-watercolor/src/payload/codec.ts` + `.test.ts` — literal validation both directions, never defaulted
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` + `.test.ts` — the trailing `scriptBegin` argument from `active.stroke.engine.relief`
- `packages/efx-watercolor/src/determinismContract.test.ts` — erode replay pinned; new deposit arm pinned byte-different from erode
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — the record bag writes `...(relief !== undefined ? { relief } : {})`
- `app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts` — record-literal pin
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` + `.test.ts` — bits 5-6, both-set refusal, unknown-value refusal on encode, reserved bit 7
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` + `.test.ts` — mirror guard and `engine.relief` refusal label
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts` — polarity spread on the copy
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts` — renamed from `.reliefOnly.test.ts` (git mv, 62 % similarity)
- `app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts` — `onStrokeEnd(tool, relief)` literal
- `app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts` + `.test.ts` — `⇧ + stroke` / `⌘ + stroke` rows in Paint Tools
- `packages/efx-watercolor/probe/medium-engine/{probe.ts,run.mjs,compare.mjs,harness.test.ts}` — the `emboss-relief-modifier` scene, `--relief-mode` / `--press` operands, the relation/control/pressure compare modes

## Gate Record (authoritative: plan Task 3 step 8)

**i1 decision:** the plan's Task 3 step 8 action list is the authoritative gate record; its `<automated>` verify chains the primary erode gate + relation + package suite, and every remaining step-8 gate was run individually below. The chained verify is a subset of this record, so the two are consistent.

### (a) Calibrated gains and per-arm gate numbers

Final constants: `RELIEF_MODIFIER_ERODE_GAIN = 15`, `RELIEF_MODIFIER_DEPOSIT_GAIN = 15` — unchanged after measurement.

| Arm | Band | Mean before | Mean after | Peak before | Peak after | Verdict |
|---|---|---|---|---|---|---|
| erode, watercolor | 15 | 0.0024 | 0.0001 | 0.0659 | 0.0053 | PASS — mean −95.8 %, peak not raised |
| erode, bristle (`bristle-flat`) | 15 | 0.0081 | 0 | 0.225 | 0.064 | PASS — mean −100 %, peak not raised |
| deposit, watercolor | 5 | 0.0008 | 0.2389 | 0.022 | 6.6094 | PASS — mean and peak raised |

Calibration reasoning: GAIN 15 reproduces jak's approved +15 erode magnitude exactly at recorded pressure (`15 × amount × 1.5 × embossPress`), so the measured erode bands are the reference band behaviour. The deposit arm mirrors the same magnitude in the opposite direction; its large peak on a light 5-band is by design — the modifier never reads the slider, so on a light band it is deliberately much stronger than the band's own deposit. No constant change was warranted; Task 1's scoped suite was not re-run for gains.

### (b) Pressure arms (erode, band 15) and the saturation question

| Arm | `--press` | meanAfter | peakAfter | Reduction | Ratio vs p=1 |
|---|---|---|---|---|---|
| p1 | 1 | 0 | 0.0011 | 0.0024 | 1.0 |
| p03 | 0.3 | 0.0005 | 0.0261 | 0.0019 | 0.7917 |
| none | `none` (recorded −1) | 0.0002 | 0.0128 | 0.0022 | 0.9167 |

Both `--relief-pressure` comparisons PASS. The p=0.3 arm is strictly weaker than p=1, so the clamped erode law is NOT saturating and the plan's "lower the gain" condition does not trigger.

**W2 record (measured tolerance basis):** the 0.9x pressureless tolerance is justified by the RELIEF PRESS FACTOR alone (`1.0` for the sentinel, the `EMBOSS_PRESS_FLOOR` curve otherwise — exact and unit-pinned). The dab still derives `amount` from `0.4 + 0.6·pr` and radius from `pow(clamp(pr,0,1), pressureSize)` with simPressure easing, so the pressureless arm differs from p=1 by footprint only: measured reductions p1 = 0.0024, p03 = 0.0019, none = 0.0022 → ratio 0.9167 ≥ 0.9. All three numbers recorded; the floor holds without needing `reliefPressureFailures`' fallback branch, though the constant (`RELIEF_PRESSURELESS_NONE_FLOOR`) and its comment citing this measurement are in place should a future engine change move it.

### (c) No-paint controls and a/b replay parity

| Arm | `unshadedPigmentDigest` | `unshadedTransparentDigest` | Pair verdict |
|---|---|---|---|
| erode, watercolor | 92fb355b == control | 88022845 == control | PASS |
| erode, bristle | f6a0893b == control | 160aa53d == control | PASS |
| deposit, watercolor | 92fb355b == control | 88022845 == control | PASS |

The two watercolor arms share the same film digests because neither polarity paints — the no-paint guard is polarity-independent. The control's own `Mean/PeakAfter === Before` exactly in all three pairs (the relief target is untouched by the off-sheet twin).

a/b replay parity: erode pair and deposit pair each report 12/12 fields equal (including `visibleAlphaSamples 1693` at `x=174,y=91`), zero DIFFER, zero MISSING — deterministic replay of the polarity through the recorded bag.

### (d) Identity vs pre-change HEAD captures

| Gate | transparent | white | pigment | Result |
|---|---|---|---|---|
| `emboss-pos15 --other emboss-pos15-kpy-head` | 26983446 | 20a6ecc0 | c423bd83 | 12/12 fields equal |
| `neutral-identity --other neutral-identity-kpy-head` | 291d4a11 | 6ba88334 | 13b8af1d | 12/12 fields equal |

Paper digests also equal (202fec08 / d2bd637a) — the compare requires all 12 fields. The committed `baselines/neutral-identity.json` is stale (bd efx-motion-editor-9zz); it was NOT used or repaired, and was not part of these gates. Known follow-up: refresh that baseline under 9zz.

### (e) Pins that moved (with superseded expectations)

- `toStudioStroke.test.ts` — jak's `reliefOnly engine block` describe rewritten as `relief engine block (quick 261123-kpy)` in the SAME step that projects `relief` (W1). Superseded: `engine.reliefOnly === true` and `[..., 'reliefOnly']` key expectations; now both polarities project verbatim and absence is `'relief' in engine === false`.
- `codec.test.ts` — `reliefOnly carrier (quick 261123-jak)` → `relief carrier (quick 261123-kpy)`. Superseded: "refuses a present non-true marker"; now each polarity round-trips and any non-polarity value is refused, never defaulted (`unknown engine.relief "<value>"`).
- `scriptTimelineCodec.test.ts` — the unknown-bit test now injects `0x80` (was `0x40`, superseded by the deposit bit). Superseded: the single `0x20` round-trip; now erode 0x20 / deposit 0x40 both round-trip with byte-size invariance, absence stays absent, re-encode is byte-identical, and a new test refuses a block carrying BOTH polarity bits.
- `engineAdapter.test.ts` — source pin `active.stroke.engine.reliefOnly === true` → `active.stroke.engine.relief,`.
- `aquarelleStrokeBridge.test.ts` — `onStrokeEnd(tool, reliefOnly)` → `onStrokeEnd(tool, relief)`; `...(reliefOnly === true ? { reliefOnly: true } : {})` → `...(relief !== undefined ? { relief } : {})`.
- `aquarelleLiftEraseContract.test.ts` — the same `onStrokeEnd(tool, relief)` literal supersedes `onStrokeEnd(tool, reliefOnly)`.
- `physicsPaintRotoDuplicateScript.reliefOnly.test.ts` → `physicsPaintRotoDuplicateScript.relief.test.ts` (git mv, 62 % similarity); describe now `quick 261123-kpy — a copied modifier stroke keeps its polarity`.
- `physicsPaintRotoScriptSchema.test.ts` — the boolean-marker describe superseded by `relief polarity on the script engine slot (quick 261123-kpy)`; non-polarity values refused.
- `physicsPaintShortcutsHelp.test.ts` — Paint Tools key array gains `⇧ + stroke` and `⌘ + stroke` after `⌥ + click`.
- `determinismContract.test.ts` — superseded the single marker replay test: erode pins `'erode'`, a new deposit arm pins `'deposit'` and asserts its bytes differ from the erode arm.
- `relief.test.ts` — new `modifier relief (quick 261123-kpy)` describe (9 tests) replacing the relief-only pins.
- `coverage.test.ts` / `scattering.test.ts` — source-pin counts updated for the new guard block (6 lines each).

### (f) AQTL consequence

Bits 5 (0x20) and 6 (0x40) are each the whole marker — no payload byte, version stays 4. Bit 5 keeps jak's erode meaning; bit 6 is new. Pre-kpy builds treat bit 6 as an unknown flag and refuse the block — fail closed by design, no compat shim. A block with both bits set is refused on read (no encoder can legally write it). Bit 7 remains reserved and still refused (the unknown-flag test now injects 0x80).

### (g) Live UAT rows (artist-run — automated-ready until confirmed)

| # | Surface | What to check |
|---|---|---|
| 1 | ERODE — brush, Emboss +15 band | Shift stroke across the band: it smooths as you go, NO ink added, the relief light follows |
| 2 | DEPOSIT — Cmd stroke | The band visibly thickens/raises along the path, NO ink added |
| 3 | PRESSURE — pen | A light Shift smooths gently, full press strongly; same for Cmd |
| 4 | MOUSE — mouse/trackpad | Shift erodes at FULL strength (pressureless = full magnitude) |
| 5 | EMBOSS 0 | Shift and Cmd both work at Emboss 0, no paint |
| 6 | ALT | Alt+click still picks; Alt+click in Move/Edit Select still deletes; Alt never starts a relief pass |
| 7 | SETTLE | Release and let settle: surface stays, no bounce-back, no water bloom |
| 8 | RE-RENDER | Re-render the committed key once: it re-bakes the same relief result; on a fresh-session key the committed base keeps its baked shading in the gaps until that re-render (known residual, not a defect) |
| 9 | IDENTITY | A normal (no-modifier) stroke is unchanged; Emboss 0 paints exactly as today |
| 10 | LATCH | Mid-stroke Shift/Cmd changes never flip the current stroke; the next modifier-start stroke is a relief pass; with BOTH held at start, Shift (erode) wins |

Help surface: the shared Shortcuts modal shows both rows in Paint Tools.

## Full gates run

- `pnpm --dir packages/efx-watercolor exec vitest run` — 42 files, 1008 passed, 8 skipped.
- `pnpm --dir packages/efx-watercolor run check` (tsc) — exit 0.
- `pnpm --dir app exec vitest run` — 466 passed / 2 skipped files, 9804 passed, 1 skipped, 96 todo.
- `pnpm --dir app exec tsc --noEmit` — exit 0.
- Untouchable audit `git diff --exit-code -- …/shaders.ts …/mediums.ts …/mediums.test.ts` — exit 0. `git status --short` listed only this plan's files.

## Decisions Made

- Gains stay 15/15 (measured, not assumed) — see Gate Record (a)/(b).
- The p < 0 sentinel resolves the press factor to exactly 1.0; footprint scaling remains through the existing simPressure path, so the pressureless arm is judged against the measured 0.9167 floor rather than exact equality.
- Encode side refuses unknown relief values in addition to decode, so no writer can smuggle a third literal into AQTL or JSON.
- The off-sheet control twin stays at `y + 2` sheets (empty stampRect → `touch()` early-returns) — the jak instrument, now proven polarity-independent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `relief` normalized to `null` at the engine boundary**
- **Found during:** Task 1 (`a26dc7daf`)
- **Issue:** tsc TS2322 — `ReliefMode | undefined` is not assignable to `ReliefMode | null` in the Stroke literal the plan specified bare.
- **Fix:** `relief: relief ?? null,` with pin updates.
- **Files modified:** `packages/efx-watercolor/src/playground/Engine.ts`
- **Verification:** package suite + `run check` green.
- **Committed in:** `a26dc7daf` (Task 1 GREEN)

**2. [Rule 2 - Missing Critical] Encode-side unknown-relief refusal**
- **Found during:** Task 2 (`efe819015`)
- **Issue:** The plan specified the decode-side literal guard; the encode side could still write an unknown value, which every other boundary refuses.
- **Fix:** `fail('invalid-value', 'unknown engine.relief "<value>"')` on encode — the T-KPY-01/02 refusal rule now holds at both directions.
- **Files modified:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts`
- **Verification:** codec tests + full app suite green.
- **Committed in:** `efe819015` (Task 2 GREEN)

**3. [Rule 3 - Blocking] Package dist rebuild before the app suite**
- **Found during:** Task 2
- **Issue:** `app/vitest.config.ts` has no vite aliases; `@efxlab/efx-watercolor/*` resolves through package.json exports to the gitignored `dist/`, which was stale after the engine change (duplicate-projection test failed).
- **Fix:** `pnpm --dir packages/efx-watercolor build` (tsup). `packages/*/dist/` is gitignored — nothing committed; an ordinary local step in this repo's flow.
- **Verification:** app suite green after rebuild.
- **Committed in:** not committed (build artifact)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All three necessary for correctness or to unblock the planned tests. No scope creep; no law change beyond the plan.

## Issues Encountered

- The first full app run reported 1 failure in `src/lib/physicPaintBridge.test.ts` ("answers success when the catalog publish rejects after the mutation landed (WR-04)"). The isolated file run passed (186/187, 1 skipped) and a full re-run passed 9804/0 failed — a timing flake in an unrelated async test, not caused by this quick.
- Probe determinism held: repeated gates reproduced identical readings (p1 gates ~839-940 ms after the first bundle build).

## Known Stubs

None. No placeholder wiring or empty data paths were introduced.

## Threat Flags

None — no new network, auth, file-access or trust-boundary surface beyond the plan's threat model (T-KPY-01..05 mitigations all pinned and green).

## Known Follow-ups

- Refresh the stale committed `baselines/neutral-identity.json` under bd efx-motion-editor-9zz (deliberately not repaired here).
- The fresh-session key residual stands: the committed base keeps its baked shading in the gaps until one manual re-render adopts the bake sheet (skill-documented, by design; never "fix" with a stroke replay).
- The ten UAT rows above are automated-ready; the artist confirms them live before this quick is called approved.

## Next Phase Readiness

The v2.3.0 modifier relief design is implemented end-to-end and proven on the real engine. The relief-volume parameter quick can build on the settled polarity law; the milestone v2.2.0 close-out remains the operator's next step.

---

*Quick: 261123-kpy — supersedes 261123-jak's Shift semantics, keeps its persistence spine*
*Completed: 2026-11-23*

## Self-Check: PASSED

- All created files exist on disk.
- All five task commits are ancestors of HEAD (`0b1f8529c`, `a26dc7daf`, `cadad9211`, `efe819015`, `04ec5c743`).

## Gap fix — rebuild seams

A verification pass found that a recorded modifier stroke lost its polarity through the two live full-rebuild seams. Both seams reconstruct an `AquarelleStroke` field-by-field and did not copy `relief`, so after a reopen+re-render (or immediately on Studio Duplicate) the relief-less event won the snapshot merge for a shared `mutationId` and the marker was written back — a Shift-erode or Cmd-deposit stroke silently became a NORMAL paint stroke that paints ink where it previously painted nothing. (jak's `reliefOnly` had been dropped by the same two seams; this closes that latent gap too.)

Two lines added:

- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `restoreAquarelleRecordTimeline` reads `const relief = engine.relief` beside `textureRotation` and spreads `...(relief !== undefined ? { relief } : {})` into the rebuilt stroke before `toStudioStroke(stroke)`.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — `cloneAquarelleStrokeForDuplicate` spreads `...(stroke.relief !== undefined ? { relief: stroke.relief } : {})` beside the texture carriers.

Pins (driven through the real seams, not restating the literals):

- `app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts` — restored erode and deposit events keep their polarity through both the rebuilt stroke and the `toStudioStroke` payload projection; a markerless event restores with no `relief` key (`'relief' in …` and `Object.keys`).
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.clone.test.ts` — cloned erode and deposit strokes keep their polarity; a cloned normal stroke keeps no `relief` key; plus an end-to-end pin `recordAquarelleStroke -> restoreAquarelleRecordTimeline -> cloneAquarelleStrokeForDuplicate -> toStudioStroke` asserting `engine.relief` still holds the latched polarity, for both polarities.

Commit: `e45a72d11` — `fix(261123-kpy): carry the modifier polarity through the restore and duplicate rebuild seams`.

Verify output (run in this order):

```
pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleRecordState.restore.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.clone.test.ts src/components/physic-paint/view/aquarelleRecordState.test.ts src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
 Test Files  4 passed (4)
      Tests  146 passed (146)

pnpm --dir app exec tsc --noEmit
 exit 0 (no output)

pnpm --dir app exec vitest run
 Test Files  466 passed | 2 skipped (468)
      Tests  9811 passed | 1 skipped | 96 todo (9908)
 Duration  17.38s
```

The +7 app tests over the pre-fix run (9804 -> 9811) are exactly these pins (3 restore, 4 clone/end-to-end). The known `physicPaintBridge.test.ts` flake did not appear on this run.

Observed, deliberately untouched (outside the two named seams): `aquarelleEventsFromScript` in `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` is a persisted-first fallback that also rebuilds the stroke field-by-field and does not copy `relief` — flagged for the verifier, not changed here.

## Gap fix — Play Script fallback seam

The flagged third seam is now closed. The persisted-first branch is untouched (AQTL events already carry vectorFlags bits 5/6); only the in-memory fallback changes.

- Branch: `aquarelleEventsFromScript` in `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`, the `const raw: AquarelleStroke = { … }` literal fed to `toStudioStroke(raw)`.
- One line, immediately after the `textureRotation` spread: `...(storedStroke?.relief !== undefined ? { relief: storedStroke.relief } : {}),`.
- Accessor confirmed, not guessed: `getRecordedAquarellePayload` returns the params-only `AquarelleStrokePayload` BODY (no `.engine` slot) and its field-by-field projection does not copy `relief`, so `stored?.relief` would always be `undefined` and `stored?.engine.relief` does not type-check. The same recorded entry's `getRecordedAquarelleStroke` result (`storedStroke`, already bound in the literal's scope) carries the latch on every producer (record, restore, clone), so the spread reads that.
- Pins: `physicsPaintRotoPlayScriptController.test.ts`, extending the existing run-script stacking suite (no new harness; driven through the public reveal-run port path that calls `aquarelleEventsFromScript`). A snapshot with no `aquarelleEvents` and a brush referencing a recorded `mutationId` projects `engine.relief` equal to the latch for both `erode` and `deposit`; an ordinary recorded stroke projects with no `relief` key (`'relief' in` and `Object.keys`). The modifier pin was RED before the line (`expected undefined to be 'erode'`), GREEN after.
- Commit: `44ba44cc1` — `fix(261123-kpy): carry the modifier polarity through the Play Script fallback projection`.

Verify output (run in this order):

```
pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
 Test Files  1 passed (1)
      Tests  289 passed (289)

pnpm --dir app exec tsc --noEmit
 exit 0 (no output)

pnpm --dir app exec vitest run
 Test Files  466 passed | 2 skipped (468)
      Tests  9813 passed | 1 skipped | 96 todo (9910)
 Duration  16.48s
```

The +2 app tests over the previous gap-fix run (9811 -> 9813) are exactly these pins. The known `physicPaintBridge.test.ts` flake did not appear on this run either.
