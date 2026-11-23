---
phase: quick/261123-jak
plan: 01
subsystem: studio-paint-engine
tags: [relief, emboss, shift-modifier, aquarelle, aqtl, probe-gate, undo-protection]

# Dependency graph
requires:
  - quick: 261123-hr5
    provides: the signed Emboss band (-15..15) — reliefSigned's erode law and the probe band readings
provides:
  - "Stroke.reliefOnly latched once at pointerdown (brush + Shift + non-zero Emboss)"
  - "relief-only brush stamp: inverted emboss sign, every paint/water/cover/carrier write guarded, own ink-rect undo protection"
  - "recording: bag conditional spread, JSON codec, AQTL v4 vectorFlags bit 5 (0x20), Roto schema + duplicate projection, adapter replay"
  - "probe scenario emboss-relief-only with the --relief-control no-paint twin and the --relief-only [<control>] compare mode"
affects: [studio-paint-uat, roto-duplicate-script, script-timeline-codec-readers, fresh-session-key-residual]

# Actuals (#2632) — pairs with the plan's estimate (84000 tokens, 3 tasks, confidence low).
actuals:
  tokens: 24465    # chars/4 over the realized diff (git diff 4ab8b58a7..HEAD = 97858 chars)
  tasks: 3
  commits: 3
plan_head_before: 4ab8b58a78aef6ed50240d128baec8e45687443c
plan_head_after: 6657718781fe74a1c622448df8923eb6d75a181d

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-stroke mode flag latched at pointerdown from the RESOLVED tool, never re-derived downstream"
    - "Conditional-spread optional carrier (textureId precedent) extended to reliefOnly across every projection"
    - "AQTL vectorFlags bit as the whole marker — no payload byte, version stays 4"
    - "No-paint proof by inert-control twin on FINAL unshaded film digests (light off), never an in-drive pair"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts
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
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
    - packages/efx-watercolor/src/playground/coverage.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts

key-decisions:
  - "The latch is computed once from the resolved tool after the stylus/finger overrides; mid-stroke Shift cannot flip a stroke and Emboss 0 is inert"
  - "reliefSigned (not reliefAmount) drives the deposit/erode branch; the reliefAmount literal stays byte-identical to hr5"
  - "AQTL keeps version 4 and spends bit 5 as the whole marker; the reserved-bit refusal moves to 0x40 (pre-jak builds fail closed on relief-only projects by design)"
  - "No-paint proof redesigned to an inert-control twin on FINAL unshaded digests — the plan's in-drive byte-identical pair is unsatisfiable (display shading by design + settle drift), see Deviations"

requirements-completed: []

coverage:
  - id: D1
    description: "Shift held at stroke start with the brush tool and a non-zero Emboss latches a relief-only stroke that inverts the emboss sign and paints nothing; own ink-rect undo protection; normal path unchanged"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts#relief-only strokes (quick 261123-jak)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#relief-only replay is deterministic and salted"
        status: pass
      - kind: other
        ref: "node probe/medium-engine/compare.mjs emboss-relief-only --relief-only emboss-relief-only-control"
        status: pass
    human_judgment: false
  - id: D2
    description: "The marker rides the recorded bag and every persistence boundary (toStudioStroke, JSON codec, AQTL bit 5, Roto schema, duplicate projection, adapter replay); absent stays absent"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#round-trips the relief-only marker bit with no extra payload byte"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#reliefOnly on the script engine slot"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts#record-time stroke literal"
        status: pass
    human_judgment: false
  - id: D3
    description: "The probe proves the law on both masks (reliefFS and bristle gather): band mean at most half, peak not raised, and the FINAL unshaded film byte-identical to the inert control; flagged stroke replays identically"
    verification:
      - kind: other
        ref: "compare.mjs emboss-relief-only --relief-only emboss-relief-only-control (PASS)"
        status: pass
      - kind: other
        ref: "compare.mjs emboss-relief-only-bristle --relief-only emboss-relief-only-bristle-control (PASS)"
        status: pass
      - kind: other
        ref: "compare.mjs emboss-relief-only-a --other emboss-relief-only-b (PASS 12 fields)"
        status: pass
      - kind: other
        ref: "compare.mjs emboss-relief-only-bristle-a --other emboss-relief-only-bristle-b (PASS 12 fields)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Normal strokes and Emboss 0 are byte-identical to the pre-change HEAD captures (+15 and neutral); shaders, medium records and display law untouched"
    verification:
      - kind: other
        ref: "compare.mjs emboss-pos15 --other emboss-pos15-jak-head (PASS 12 fields)"
        status: pass
      - kind: other
        ref: "compare.mjs neutral-identity --other neutral-identity-jak-head (PASS 12 fields)"
        status: pass
      - kind: other
        ref: "git diff --exit-code -- shaders.ts mediums.ts mediums.test.ts (exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live Shift relief-only behavior on the Studio surface: smoothing visible with no ink added, settle stable, re-render replays the smoothing, normal/Emboss-0 identity, mid-stroke latch, Emboss 0 inert"
    verification: []
    human_judgment: true
    rationale: "The six plan UAT rows are native live judgments (visible smoothing, no added colour, settle, re-render) — the probe proves the engine law, not what the artist sees."

# Metrics
duration: ~25min
completed: 2026-11-23
status: complete
---

# Quick 261123-jak: Shift paints relief Summary

**Shift at stroke start on the brush tool with a non-zero Emboss now latches a per-stroke `reliefOnly` flag that inverts the signed Emboss and suppresses every paint/water/cover/carrier write — the artist smooths impasto without adding a pigment byte, and the flag rides the recorded bag so re-renders replay the smoothing.**

## Performance

- **Duration:** ~25 min (first pre-change capture 14:04 to final gate 14:26, 2026-11-23, +01:00)
- **Started:** 2026-11-23T14:04:00+01:00 (HEAD reference captures, Task 1 step 0)
- **Completed:** 2026-11-23T14:26:00+01:00
- **Tasks:** 3
- **Files modified:** 24 (23 modified + 1 created)

## Accomplishments

- **Engine law:** `Stroke.reliefOnly` is latched once at pointerdown (`tool === 'brush' && e.shiftKey && this.params.emboss !== 0`, from the RESOLVED tool after the stylus/finger overrides); the brush stamp computes the same dab law, sets `reliefSigned = s.reliefOnly ? -reliefAmount : reliefAmount`, guards every paint/water/cover/carrier site behind `!s.reliefOnly`, and takes its own `touch(stampRect(..., 1.5 non-bristle / 1.6 bristle))` on the ink-pass rects for both signs so undo restores the smoothed band in one step.
- **Persistence:** `toStudioStroke` projects `reliefOnly: true` only when true (conditional spread); the JSON codec and Roto schema refuse any present non-true value (`engine.reliefOnly` label); AQTL version stays 4 and bit 5 (0x20) of `vectorFlags` IS the whole marker (no payload byte); the adapter feeds `active.stroke.engine.reliefOnly === true` at its one `scriptBegin` site; the Roto duplicate/`+Key` projection carries the marker.
- **Probe proof:** scenario `emboss-relief-only` plus a `--relief-control` inert twin proves the no-paint law on both the reliefFS and bristle-gather arms, with a/b replay parity on both arms and byte-identical identity vs the pre-change HEAD captures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Relief-only engine core — latch, skip guards, inverted sign, package pins** - `668f06f88` (feat)
2. **Task 2: Recording and persistence — the bag, AQTL bit 5, the three app boundaries** - `2cdd99cbd` (feat)
3. **Task 3: Probe scene `emboss-relief-only`, relation mode, six gates** - `665771878` (test)

Measured via the plan ledger: `git rev-list --count 4ab8b58a7..HEAD` = **3** commits.

## Gate Results

### Relief-only probe — watercolor arm (`emboss-relief-only`)

| Reading | Before | After |
|---|---|---|
| `reliefOnlyMean` | 0.0024 | 0.0010 |
| `reliefOnlyPeak` | 0.0659 | 0.0167 |

Final UNSHADED film (light off, shade exactly 1): pigment `92fb355b`, transparent `88022845` — **identical to the inert control** (`emboss-relief-only-control`). Shaded finals differ (`7269cc6e`/`19f493bc` vs `c9048ec2`/`b0285f46`) — the smoothing is visible by design; only the unshaded film carries the no-paint proof.

`compare.mjs emboss-relief-only --relief-only emboss-relief-only-control` → **PASS** (relation holds + unshaded film matches the inert control).

### Relief-only probe — bristle gather arm (`emboss-relief-only-bristle`, `--brush bristle-flat`)

| Reading | Before | After |
|---|---|---|
| `reliefOnlyMean` | 0.0081 | 0.0001 |
| `reliefOnlyPeak` | 0.225 | 0.0640 |

Final UNSHADED film: pigment `f6a0893b`, transparent `160aa53d` — identical to its inert control. **PASS**.

### Replay parity (a/b, both arms)

- `emboss-relief-only-a` vs `-b` → **PASS, 12 fields equal** (4 numeric readings + unshaded pigment `92fb355b` + transparent `88022845` + all alpha-law fields).
- `emboss-relief-only-bristle-a` vs `-b` → **PASS, 12 fields equal** (readings + `f6a0893b` / `160aa53d`).

### Identity vs pre-change HEAD captures

- `emboss-pos15` vs `emboss-pos15-jak-head` → **PASS, all 12 fields equal** (paper `202fec08`, transparent `26983446`, white `20a6ecc0`, pigment `c423bd83`).
- `neutral-identity` vs `neutral-identity-jak-head` → **PASS, all 12 fields equal** (paper `d2bd637a`, transparent `291d4a11`, white `6ba88334`, pigment `13b8af1d`).
- The committed `baselines/neutral-identity.json` is stale (bd **efx-motion-editor-9zz**) and was NOT used, re-captured or repaired; `REFERENCE_OPTIONAL` was not widened.

### Full suites and audits

- `pnpm --dir packages/efx-watercolor exec vitest run` → 41/41 files, **999 passed, 8 skipped**.
- `pnpm --dir packages/efx-watercolor run check` (tsc) → clean.
- `pnpm --dir app exec vitest run` → 466/466 files (2 skipped), **9803 passed, 1 skipped, 96 todo, exit 0**.
- `pnpm --dir app exec tsc --noEmit` → clean.
- Untouchable audit `git diff --exit-code -- shaders.ts mediums.ts mediums.test.ts` → **exit 0**.
- `git status --short` lists only this plan's files (plus the pre-existing, uncommitted `.planning/phases/64-medium-engine/64-BEADS-RECALL.md` modification).

## Files Created/Modified

Engine core (Task 1): `Engine.ts` (latch, guards, inverted sign, own touch, `onStrokeEnd(tool, reliefOnly)`, `scriptBegin` trailing `reliefOnly = false`), `toStudioStroke.ts`, `codec.ts`, `engineAdapter.ts` and their pin suites, `relief.test.ts`, `determinismContract.test.ts`.

App boundaries (Task 2): `AquarelleCanvasLayer.tsx` (`onStrokeEnd(tool, reliefOnly)` + the bag spread), `scriptTimelineCodec.ts` (`VECTOR_FLAG_RELIEF_ONLY = 1 << 5`, mask, encode/decode/merge, header docs), `physicsPaintRotoScriptSchema.ts` (mirror guard + refusal label), `physicsPaintRotoDuplicateScript.ts` (conditional spread), plus `aquarelleStrokeBridge.test.ts`, `scriptTimelineCodec.test.ts`, `physicsPaintRotoScriptSchema.test.ts`, `physicsPaintRotoDuplicateScript.reliefOnly.test.ts` (new), `aquarelleLiftEraseContract.test.ts`.

Probe (Task 3): `probe.ts` (`ScriptEntry.reliefOnly`, `embossReliefOnlyScript(bandEmboss, brushId, control)`, band readings + final unshaded digests, `readReliefControl`, closed list), `run.mjs` (`--relief-control`, usage/docs), `compare.mjs` (`--relief-only [<control>]`, `reliefOnlyFailures`, `reliefOnlyControlFailures`, `UNSHADED_FILM_FIELDS`, `--other` extension), `harness.test.ts` (closed-list + compare-surface pins).

Full-suite pin repair: `coverage.test.ts`, `scattering.test.ts` (see Deviation 2).

## Pinned Laws That Moved (with superseded expectations)

- `relief.test.ts` — the hr5 branch pins moved from `if (reliefAmount > 0) {` / `else if (reliefAmount < 0) {` / `-reliefAmount * RELIEF_ERODE_NEGATIVE` / `if (wet > 0) this.brushWet(` to the `reliefSigned` forms and the guarded wet line; the `const reliefAmount = P.emboss * amount * RELIEF_GAIN * embossPress;` literal stayed byte-identical. New relief-only describe pins the latch, the skip guards, the own-touch order and the two-argument `onStrokeEnd`.
- `scriptTimelineCodec.test.ts` — the reserved-bit test that pinned `0x20` as the next free bit was superseded to `0x40`; new round-trip row asserts the bit IS the marker with byteLength unchanged and version 4.
- `aquarelleLiftEraseContract.test.ts` — the source literal pin moved from `onStrokeEnd(tool)` to `onStrokeEnd(tool, reliefOnly)`.
- `aquarelleStrokeBridge.test.ts` — the record-literal pin now asserts `...(reliefOnly === true ? { reliefOnly: true } : {})`.
- `engineAdapter.test.ts` — the begin-site pin now asserts `active.stroke.engine.reliefOnly === true` as the 11th argument.
- `harness.test.ts` — both closed lists gained `emboss-relief-only` BEFORE the unchanged `or "bristle-tip")` tails; new pins for `--relief-control`, `reliefOnlyFailures`, `reliefOnlyControlFailures` and `UNSHADED_FILM_FIELDS`.
- `coverage.test.ts` / `scattering.test.ts` — the cover-pass literal pin moved from `if (coverAmount > 0 || bristle) {` to `if (!s.reliefOnly && (coverAmount > 0 || bristle)) {` (Deviation 2).

## AQTL Consequence

AQTL stays **version 4**. A project containing a relief-only stroke sets `vectorFlags` bit 5 (`0x20`), which **pre-jak builds refuse as a reserved flag — fail closed, by design, no compat shim**. Old projects (bit clear) load and replay byte-identically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's in-drive no-paint instrument is unsatisfiable — replaced by an inert-control twin on final unshaded digests**
- **Found during:** Task 3 (probe gates).
- **Issue:** Plan steps 3/6 required `reliefOnlyPigmentDigestAfter === Before` and the same for transparent, captured inside the drive. Measured first attempt: pigment `c423bd83` → `19f493bc`, transparent `26983446` → `c6bb602f`. Cause 1: the shipped display shades every export with the relief gradient (mode 4 `o = vec4(pigment * alpha * shade, alpha)`, mode 2 `lit` includes shade), so the smoothing is visible in the export by design. Cause 2: with the light off (`engine.setLight({ intensity: 0 })` makes shade exactly 1 — the UNSHADED film), the in-drive before/after pair STILL drifts because the settle loop plus the async `fix()` keep evolving the film between the two capture moments; a diagnostic run with an emboss-0 (provably inert) entry 2 produced the same after digests (`92fb355b` / `88022845`), proving the drift is the drive, not the stroke.
- **Fix:** two-run design. `embossReliefOnlyScript` takes a `control` flag (`--relief-control`): same entry 1, entry 2 `reliefOnly` with emboss 0 = inert, same drive length. The probe records the band readings and, at report time, the FINAL unshaded pigment/transparent digests (light off, then restored). `compare.mjs --relief-only <control>` asserts the smoothing relation on the real run AND byte-identical unshaded digests between the pair; `--other` compares the two new digest fields as well.
- **Files modified:** `probe.ts`, `run.mjs`, `compare.mjs`, `harness.test.ts`.
- **Verification:** both arms PASS (watercolor `92fb355b`/`88022845`, bristle `f6a0893b`/`160aa53d`, identical to their controls); the light-off before digests cross-validated against the neutral-identity references (`13b8af1d`/`291d4a11`), confirming the instrument.
- **Committed in:** `665771878`.

**2. [Rule 1 - Bug] Two cover-pass source pins went stale under Task 1's guard — full suite caught them**
- **Found during:** Task 3 full-suite gate.
- **Issue:** `coverage.test.ts` (slices from the literal) and `scattering.test.ts` still asserted `if (coverAmount > 0 || bristle) {`; Task 1 moved the law behind `!s.reliefOnly &&`, so both failed with `missing source text`.
- **Fix:** both pins updated to the guarded literal with a comment naming the quick; the law they pin (one protection block before the first dab) is unchanged.
- **Files modified:** `coverage.test.ts`, `scattering.test.ts`.
- **Verification:** package suite 41/41 files green (999 passed).
- **Committed in:** `665771878`.

---

**Total deviations:** 2 auto-fixed (2 Rule 1).
**Impact on plan:** Both were necessary for a correct proof and a green suite; no scope creep — no shader, medium-record, display-law or Lift change.

## Issues Encountered

- **App-suite flake under concurrent load (out of scope):** `src/lib/physicPaintBridge.test.ts > catalog pull > removes its one-shot listener...` timed out once at 20 s while the package suite ran in parallel; it passes standalone (186 passed, 1 skipped) and the final full app run is green (exit 0). Unrelated to paint; not fixed.

## User Setup Required

None — no external service configuration, no package installs.

## Live UAT Rows (automated-ready — the artist confirms live; NOT reported done)

| # | Surface | Row | Expected |
|---|---|---|---|
| 1 | LIVE | Brush tool, Emboss +15, paint an impasto band; then a Shift-held second stroke across it at the same Emboss | The band visibly smooths as you go, NO ink is added (colour under the path untouched), relief light follows the new surface |
| 2 | SETTLE | Release and let the sheet settle | Smoothed surface stays — no bounce-back, no water bloom (no water entered) |
| 3 | RE-RENDER | Re-render the committed key once | The frame re-bakes the same smoothed result (flag survived the bag). Fresh-session key residual: the committed base keeps its baked shading in the gaps until that one re-render — the known KEY = CACHE residual, not a defect |
| 4 | IDENTITY | A normal (no-Shift) stroke; Emboss 0 paint; a Shift stroke at Emboss 0 | Normal stroke unchanged; Emboss 0 paints exactly as today; Shift at Emboss 0 paints normally (nothing to invert) |
| 5 | LATCH | Press Shift MID-stroke | Current stroke keeps painting normally; only the NEXT stroke started with Shift is relief-only |
| 6 | EMBOSS 0 | Shift at Emboss 0 | Paints exactly like a normal stroke — no relief, no suppression |

## Known Stubs

None — no stub patterns, placeholders or unwired data sources were introduced.

## Threat Flags

None — no new trust-boundary surface beyond the plan's threat model (probe changes are measurement infrastructure).

## Decisions Made

- Latch once at pointerdown from the RESOLVED tool; nothing downstream re-derives Shift.
- `reliefSigned` drives the deposit/erode branch; `reliefAmount` stays byte-identical to hr5.
- AQTL version 4 + bit 5 as the whole marker; reserved-bit refusal moves to 0x40; pre-jak builds fail closed on relief-only projects (documented consequence).
- No-paint proof via inert-control twin on final unshaded digests (Deviation 1) — the only instrument that survives both the display shading and the settle drift.

## Next Phase Readiness

- Engine, persistence, Roto boundaries and probe gates are complete and green; only the artist's live UAT (six rows above) remains before marking this quick done.
- Follow-up on record: bd **efx-motion-editor-9zz** (stale committed `neutral-identity` baseline) — untouched by design.

---
*Quick: 261123-jak-v2-3-0-studio-paint-shift-paints-relief*
*Completed: 2026-11-23*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts
- FOUND: .planning/quick/261123-jak-v2-3-0-studio-paint-shift-paints-relief-/261123-jak-SUMMARY.md
- FOUND: 668f06f88
- FOUND: 2cdd99cbd
- FOUND: 665771878
