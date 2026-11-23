---
phase: quick/261123-kpy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/reliefModifier.ts
  - packages/efx-watercolor/src/playground/reliefModifier.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/relief.test.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/coverage.test.ts
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
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
  - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
autonomous: true
requirements: []
estimate:
  # Three transactions. Task 1 is the engine latch + pressure law + guards +
  # payload/adapter plumbing with the pinned laws that move (plus the
  # pre-change identity captures). Task 2 is the app recording bag, the two
  # AQTL polarity bits, the Roto boundaries and the shortcuts help rows.
  # Task 3 is the modifier probe scenario (erode + deposit + pressure arms),
  # its self-contained relation/control/pressure modes and the gate runs.
  # estimate-calibration reports factor 1, sample_count 0, confidence low
  # (no calibration sample for quicks). Revision adds the two source-scan
  # pin files to Task 1 (the same guard literal) and reliefModifier.ts to
  # Task 3's scope for gain calibration: +2,000 tokens.
  tokens: 98000
  raw_tokens: 98000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Shift held at stroke START on the brush tool makes the stroke a relief ERODE pass and Cmd a relief DEPOSIT pass: the pass inverts or raises the emboss magnitude with NO paint — the probe `emboss-relief-modifier` shows the +15 band relief mean at most half its pre-pass value with the peak not raised (erode), a light band's mean AND peak raised (deposit), and the pigment plus the UNSHADED transparent film BYTE-IDENTICAL across the pass against an off-sheet inert twin, on the reliefFS arm for BOTH polarities and on the bristle gather arm for the erode arm (the no-paint guard is a single polarity-independent predicate)."
    - "The magnitude is PRESSURE-ONLY: a real pen's pressure drives the existing embossPress floor curve (erode at p=0.3 is measurably weaker than at p=1.0), a pressureless pointer (the recorded per-sample p < 0 sentinel) is full 1.0, and the Emboss slider is never read — the modifier works at Emboss 0. The pressureless case is derived from the recorded sentinel, never from pointerType, so a replayed bag reproduces the live magnitude; the exact equality is pinned by the pure `reliefModifierPress` unit test."
    - "The marker is latched at pointerdown on the RESOLVED tool: Shift wins over Cmd when both are held, mid-stroke modifier changes never flip the current stroke, and Alt stays the capture-phase colour picker (and Select-mode delete) — untouched (pinned latch literal plus the LATCH and ALT UAT rows)."
    - "The recorded per-stroke bag carries `relief: 'erode' | 'deposit'` ONLY when latched; an ordinary stroke keeps its exact pre-change key set; JSON, AQTL (bit 5 = erode, bit 6 = deposit, no payload byte, both bits set REFUSED, unknown values REFUSED), the Roto script schema and the duplicate projection all round-trip it; the adapter feeds it to `scriptBegin`."
    - "Normal strokes and Emboss 0 are byte-identical to pre-change HEAD captures: a +15 emboss capture and a neutral capture match the references on every digest, byte length and alpha-law field."
    - "Undo restores a modifier stroke in one step: the modifier dab takes its own touch on the same rects the ink pass uses (1.5 non-bristle, 1.6 bristle, PROTECT_MARGIN 24) for BOTH polarities; the normal path keeps today's protection sites."
    - "The modifier stroke paints nothing: no ink, no water, no cover pass, no carrier pickup/refill and no bristle touch stamp run; GAP-1 stands (paint never auto-erodes relief under its own coverage). Both modifiers are documented in the shared shortcuts help modal."
  artifacts:
    - packages/efx-watercolor/src/playground/reliefModifier.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
  key_links:
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/reliefModifier.ts
      via: "the dab resolves `reliefSigned` through the ONE pure law — `reliefModifierPress` (pressureless sentinel -> 1.0, else the embossPress curve) and `reliefModifierSigned` (polarity + calibrated gain); the normal path still reads the untouched `reliefAmount` literal, so its arithmetic is never re-associated"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      via: "the pointerdown latch is the ONE authority: it sets Stroke.relief once on the RESOLVED tool (Shift erode, Cmd deposit, Shift wins), and onStrokeEnd reports it beside the resolved tool; nothing downstream re-derives it from the modifier keys"
    - from: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      to: packages/efx-watercolor/src/payload/toStudioStroke.ts
      via: "the recorded bag writes `relief` only when latched; toStudioStroke's conditional spread is the ONE projection into the engine payload (record, restore, duplicate, script copy all share it)"
    - from: app/src/components/physic-paint/performance/scriptTimelineCodec.ts
      to: packages/efx-watercolor/src/adapter/engineAdapter.ts
      via: "AQTL vectorFlags bit 5 (erode) and bit 6 (deposit) carry the polarity with no payload byte; feedDueSample reads active.stroke.engine.relief and passes it to scriptBegin"
    - from: packages/efx-watercolor/probe/medium-engine/probe.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "the probe reads the private relief target (reliefBandStats) at each entry's fix and digests the pigment/transparent exports at light 0 against the off-sheet control twin"
---

<objective>
Supersede quick 261123-jak's Shift semantics: Studio paint's modifier relief
is PRESSURE-driven with a polarity. Holding Shift when a brush stroke STARTS
makes the stroke ERODE relief; holding Cmd makes it DEPOSIT relief; Shift wins
if both are held. The magnitude comes from pen pressure alone — the existing
`embossPress` floor curve at the real pen pressure, full 1.0 for a pressureless
pointer (the recorded `p < 0` sentinel) — and the Emboss slider is never read,
so both modifiers work at Emboss 0. jak's entire persistence spine survives
(the recorded marker, the JSON codec, an AQTL vectorFlags bit, the Roto schema,
the duplicate projection, the adapter replay): only the modifier rule, the
magnitude law and the marker's shape change.

Purpose: jak shipped a binary `reliefOnly` latch that only existed when the
slider was non-zero and whose magnitude was the slider's. The decided v2.3.0
design is a real modifier pair: Shift to smooth (erode) an impasto and Cmd to
build (deposit) one, both pressure-sensitive like a pen, both independent of
the Emboss slider. The recorded discriminator becomes the polarity itself
(`relief: 'erode' | 'deposit'`), which the AQTL carrier expresses with two
bits (both set = refuse) and every app boundary validates fail-closed.

Output: a latched `Stroke.relief` plus a per-sample pressureless carrier, the
pure calibrated magnitude law, the guarded brush stamp with its own per-dab
undo protection for both polarities, the polarity through toStudioStroke /
JSON codec / AQTL bits 5-6 / Roto schema / duplicate projection / adapter
replay, the two shortcuts-help rows, pinned laws for all of it, and the probe
scene `emboss-relief-modifier` with erode, deposit and pressure arms proven
against an off-sheet inert twin with byte-identical film.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@packages/efx-watercolor/src/playground/Engine.ts
@packages/efx-watercolor/src/playground/relief.test.ts
@packages/efx-watercolor/src/determinismContract.test.ts
@packages/efx-watercolor/src/payload/toStudioStroke.ts
@packages/efx-watercolor/src/payload/toStudioStroke.test.ts
@packages/efx-watercolor/src/payload/codec.ts
@packages/efx-watercolor/src/payload/codec.test.ts
@packages/efx-watercolor/src/adapter/engineAdapter.ts
@packages/efx-watercolor/src/adapter/engineAdapter.test.ts
@app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
@app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts
@app/src/components/physic-paint/performance/scriptTimelineCodec.ts
@app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
@app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
@app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts
@app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
@app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
@app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts
@packages/efx-watercolor/probe/medium-engine/probe.ts
@packages/efx-watercolor/probe/medium-engine/run.mjs
@packages/efx-watercolor/probe/medium-engine/compare.mjs
@packages/efx-watercolor/probe/medium-engine/harness.test.ts

Skills to load before implementing: `efx-studio-paint` (the compositing laws,
the probe harness, the live/settle/re-render surfaces, the undo protection
law), `spike-findings-efx-motion-editor` (the bristle gather / deposit laws),
`efx-preact-reactivity` (the layer callback and the recorded bag are signal-
adjacent — no render-body writes, no React patterns).

**Supersedes quick 261123-jak's Shift semantics.** Keep jak's spine: the
recorded marker, the JSON codec guard, an AQTL vectorFlags bit with no payload
byte, the Roto schema mirror + refusal label, the duplicate/+Key projection,
the adapter -> `scriptBegin` feed, the no-paint instrument (an inert twin
compared on FINAL UNSHADED digests, because an in-drive before/after pair
drifts), and the own ink-rect touch. Change only: the latch rule (Shift erode
/ Cmd deposit, no Emboss gate), the magnitude law (pressure-only, calibrated
gain, slider never read), the marker shape (`relief: 'erode' | 'deposit'`,
replacing the boolean), the AQTL encoding (two bits, both-set refused) and the
probe's inert twin (an off-sheet modifier stroke — `emboss: 0` is no longer
inert because the modifier ignores the slider).

**Project constraints that bind this plan**
- `pnpm`, `vitest run` only — never watch mode. Never start the dev server.
  Never push, never commit (conservative profile: report at handoff).
- Worktrees are disabled: execute sequentially in the main tree.
- Do NOT touch the display emboss law, the light, Body semantics, the medium
  records (`mediums.ts`), the shaders (`shaders.ts`), Lift, or any shader
  program. No new Tool value. No medium-record change, no migration.
- Do not make paint auto-erode relief under its coverage — the approved
  acrylic GAP-1 law stands; the erode is gated by the stroke's recorded
  polarity only.
- No backward-compat shims: `reliefOnly` is DELETED from every surface. An
  AQTL bit-5 project written by jak decodes as `relief: 'erode'` — the same
  behaviour it encoded. A pre-kpy build refuses bit 6 as a reserved flag
  (fail closed, by design).
- Do NOT commit `.planning/phases/64-medium-engine/64-BEADS-RECALL.md` — it
  carries unrelated pre-existing changes.

**Verified anchors at HEAD efedb75c6 (re-read before editing)**
- `Engine.ts` 174: `onStrokeEnd?(tool: Tool, reliefOnly?: boolean): void;`;
  sole call 2626 `this.callbacks.onStrokeEnd?.(s.tool, s.reliefOnly);` (live
  strokes only — a scripted stroke has `pointerId === SCRIPT_POINTER`).
- `Engine.ts` 262-273: `RELIEF_GAIN = 1.5`, `RELIEF_ERODE = 0.5`,
  `RELIEF_ERODE_NEGATIVE = 20`, `EMBOSS_PRESS_FLOOR = 0.15`.
- `Engine.ts` 293-330: `interface Sample` (293) and `interface Stroke`
  (`reliefOnly: boolean;` at 326; `widthFrom/To`, `pigFrom/To`, `simPressure`
  precedent); exactly TWO Stroke literals build it — `scriptBegin` 1453 and
  `pointerdown` 2304-2308.
- `Engine.ts` 343-351: `scriptPressure(p)` keeps the `p < 0` sentinel.
- `Engine.ts` 1444: `scriptBegin(tool, x, y, pressure, step = 'Stroke',
  maxRadius?, tiltX = 0, tiltY = 0, widthScale = 1, pigment?,
  reliefOnly = false): boolean`; literal 1457. Other callers pass ten or
  fewer args (`StrokeWriter.ts:143`, test/probe callers) — a trailing
  optional parameter is additive for all of them.
- `Engine.ts` 2288-2317: pointerdown resolves `let tool = this.tool;` then
  the touch/finger-water and pen-eraser/barrel overrides; the latch at 2301
  is `const reliefOnly = tool === 'brush' && e.shiftKey &&
  this.params.emboss !== 0;` — the site to replace.
- `Engine.ts` 2366-2397 `pushSample`: `let p = -1;` is the live
  mouse/finger sentinel (only a real pen or a force sample pushes >= 0).
- `Engine.ts` 2532 `pressureOf(s, p) = p >= 0 ? p : s.simPressure`; 2552
  start `s.pr = this.pressureOf(s, q.p)`; 2586 `const pr =
  this.pressureOf(s, q.p)`; 2619 dwell `this.pressureOf(s, -1)`.
- `Engine.ts` 2773-2792: `const embossPress = EMBOSS_PRESS_FLOOR + (1 -
  EMBOSS_PRESS_FLOOR) * clamp(pr, 0, 1);` / `const reliefAmount = P.emboss *
  amount * RELIEF_GAIN * embossPress;` (KEEP BYTE-IDENTICAL) / `const
  reliefSigned = s.reliefOnly ? -reliefAmount : reliefAmount;`.
- `Engine.ts` 2838 `if (!s.reliefOnly && (coverAmount > 0 || bristle)) {`;
  2873 `if (!s.reliefOnly) this.carrierPass(`; 2883 `if (!s.reliefOnly) {`
  (the one paint block, containing `bristleInk`/`coverageDeposit`/`brushInk`
  and `bristleTouch`); 2919 own-touch `if (s.reliefOnly && reliefSigned !== 0)
  this.touch(this.stampRect(dx, dy, dr, this.dw, this.dh, bristle ? 1.6 :
  1.5));`; 2920-2929 `if (reliefSigned > 0) {` / `else if (reliefSigned < 0)
  { const erodeAmount = Math.min(1, -reliefSigned * RELIEF_ERODE_NEGATIVE);`;
  2934 wet guard; 2939 splat guard.
- `Engine.ts` 3257 `stampRect` clamps to `[0,w]/[0,h]` (an off-sheet dab is
  an EMPTY rect); 3738-3750 `touch()` early-returns on an empty rect (no
  history, no dirty, no wake); `gl.ts` 140-159 `scissor` uses
  `Math.max(0, r.x1 - r.x0)` — a zero-size scissor rejects every fragment.
- `toStudioStroke.ts` `reliefOnly?: true` at ~133 (payload) and ~206
  (runtime); conditional-spread projection at ~286; `AquarellePoint` 163-170.
- `codec.ts` 134-135 `const reliefOnly = engine['reliefOnly']; if (reliefOnly
  !== undefined && reliefOnly !== true) return false;`.
- `engineAdapter.ts` 489-501: the ONE `scriptBegin(...)` with 11th arg
  `active.stroke.engine.reliefOnly === true`; `active.stroke.engine` is the
  payload in hand.
- `determinismContract.test.ts` 68/97-99/125: the fake's `scriptBegin` 11th
  param `reliefOnly = false` increments `reliefOnlyBegins`, salted as `0x80`
  into the exported blue byte; `makeStroke(viscosity?, emboss?, body?,
  reliefOnly?)` at 233-260; the relief row at 396-410.
- `AquarelleCanvasLayer.tsx` 722 `onStrokeEnd(tool, reliefOnly) {`; the
  recorded bag spread at 770 `...(reliefOnly === true ? { reliefOnly: true }
  : {})`.
- `scriptTimelineCodec.ts` flags 208-228 (`VECTOR_FLAG_DRAWN = 1 << 4`,
  `VECTOR_FLAG_RELIEF_ONLY = 1 << 5`, `VECTOR_FLAGS_MASK`); encode 645-646;
  `decodeVectorBlock` 943-1000 (reserved check 950-952, return type,
  `result.reliefOnly = true` at 998); merge 1141. Test 794-800 pins the
  reserved flag at `0x40` ("the next free bit is 0x40") — supersede to
  `0x80`; 837-838 pin the 0x20 bit round-trip.
- `physicsPaintRotoScriptSchema.ts` 536 `if (value.reliefOnly !== undefined
  && value.reliefOnly !== true) return 'engine.reliefOnly';` and 629 the
  mirror guard in `isEnginePayloadAquarelleStroke`.
- `physicsPaintRotoDuplicateScript.ts` 224 `...(engine.reliefOnly === true ?
  { reliefOnly: true as const } : {})`; model test
  `physicsPaintRotoDuplicateScript.reliefOnly.test.ts`.
- `physicsPaintShortcutsHelp.ts` Paint Tools group: keys `B, A, W, E, P, V,
  I, '⌥ + click', X, D, F, S, C`; `physicsPaintShortcutsHelp.test.ts` 73-88
  pins that keys array with `toEqual` and 49-58 pins the tab labels.
- Probe harness: `probe.ts` `ScriptEntry` 688-766 (incl. `reliefOnly?: true`
  at 765), `makeStroke` spread 801-803, `STROKE_POINTS` 282-287 (p 0.55/0.7/
  0.62/0.45), `EMBOSS_SMOOTH_BOX` 0.24-0.76 x 0.24-0.68,
  `embossReliefOnlyScript` 846-852, scenario chain 3375-3414,
  `reliefOnlyCapture` 3487-3500, entry-loop call site 3553-3556,
  `embossReliefOnlyReport` 3742-3760, `readScenario` 3866-3886 (closed list
  + `or "bristle-tip")` tail), `readReliefControl` 3881-3892, `main` 3936+;
  `run.mjs` docs 318-322, closed list 323-334 (`or "bristle-tip")` tail),
  `--relief-control` parse 431-440, query string 511, usage line;
  `compare.mjs` `RELIEF_ONLY_FIELDS` + `UNSHADED_FILM_FIELDS` 186-199,
  `reliefOnlyFailures` 1270-1307, `reliefOnlyControlFailures` 1318-1376,
  `SCENARIO_INVARIANTS` 1378-1390, usage 1466-1470, mode parse 1473-1500,
  `--relief-only` block 1621-1690, `--other` readings block 1858-1872;
  `harness.test.ts` 1748-1755 pins both closed-list tails at 2052-2060,
  and the jak pin block 2080-2098.

**Known pre-existing gap (do not repair here).** The committed
`baselines/neutral-identity.json` predates 64-31 and is stale (tracked as bd
efx-motion-editor-9zz). Both identity gates in this quick are before/after
comparisons against pre-change HEAD captures taken in Task 1 step 0 — never
the committed baseline. Do NOT re-capture or edit the committed baseline, and
do NOT widen `REFERENCE_OPTIONAL`.
</context>

<assumption_delta_decision>
**Promote.** The general discriminator `relief: 'erode' | 'deposit' |
undefined` REPLACES jak's specific `reliefOnly: boolean`; do not keep both.

Why promote: a boolean cannot express the deposit arm, and the recorded
discriminator is exactly the polarity the artist latched. Carrying both a
boolean and a polarity would create two contradictory sources of truth for
the same engine input, and the AQTL carrier needs the polarity anyway (bit 5
erode, bit 6 deposit, both set refused). Promotion also keeps the fail-closed
law clean: a present value must be one of the two literals or the stroke is
refused; absent means an ordinary stroke.

Consequence: `reliefOnly` is deleted from the recorded bag, both payload
types, the JSON codec, the AQTL symbols, the Roto schema, the duplicate
projection, the probe and every pin (the duplicate test file is renamed
`physicsPaintRotoDuplicateScript.relief.test.ts`). No migration. A jak-era
AQTL file (bit 5) decodes as `relief: 'erode'` — the same behaviour it
encoded — and a pre-kpy build refuses bit 6 as reserved.
</assumption_delta_decision>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pressure-driven modifier relief — the latch, the pure magnitude law, the guards, and the package pins</name>
  <files>
    packages/efx-watercolor/src/playground/reliefModifier.ts,
    packages/efx-watercolor/src/playground/reliefModifier.test.ts,
    packages/efx-watercolor/src/playground/Engine.ts,
    packages/efx-watercolor/src/playground/relief.test.ts,
    packages/efx-watercolor/src/playground/scattering.test.ts,
    packages/efx-watercolor/src/playground/coverage.test.ts,
    packages/efx-watercolor/src/determinismContract.test.ts,
    packages/efx-watercolor/src/payload/toStudioStroke.ts,
    packages/efx-watercolor/src/payload/toStudioStroke.test.ts,
    packages/efx-watercolor/src/payload/codec.ts,
    packages/efx-watercolor/src/payload/codec.test.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  </files>
  <behavior>
    - `reliefModifierPress(embossPressAtPr, pressureless)` returns exactly `1` when `pressureless` is true (any input) and the input verbatim otherwise — so the pressureless sentinel is EXACTLY the full-press magnitude, and the pressure case is the existing `embossPress` floor curve.
    - `reliefModifierSigned(mode, base, press)` is negative for `'erode'` and positive for `'deposit'`, with magnitude `base * press * GAIN[mode]`; both gains are positive constants calibrated on the probe.
    - `Stroke` carries `relief: ReliefMode | null` and `pressureless: boolean`; both literals set them (pointerdown latches, scriptBegin receives); no path leaves them undefined.
    - The latch is exactly `tool === 'brush' ? (e.shiftKey ? 'erode' : e.metaKey ? 'deposit' : null) : null`, computed from the RESOLVED tool — Shift wins when both are held, and mid-stroke modifier changes cannot flip a stroke. There is NO Emboss gate.
    - Every consumed sample sets `s.pressureless = q.p < 0` (the recorded sentinel, never pointerType); the start dab, the curve dabs and the dwell read the current value.
    - The brush stamp keeps `reliefAmount` BYTE-IDENTICAL and only computes `reliefSigned` differently when latched: the normal path still uses `reliefAmount`, the modifier path uses the pure law at `amount * RELIEF_GAIN`. The clamped erode law `Math.min(1, -reliefSigned * RELIEF_ERODE_NEGATIVE)` and the `reliefSigned > 0` deposit branch are unchanged.
    - A modifier dab runs NO paint/water/carrier site; it takes its own protection `touch(stampRect(..., 1.5/1.6))` for BOTH polarities when `reliefSigned !== 0`.
    - `onStrokeEnd` reports `(tool, relief)`; `scriptBegin` accepts a trailing `relief?: ReliefMode`; `toStudioStroke` projects `relief` only when present; the JSON codec accepts only `'erode'`/`'deposit'`; the adapter feeds the payload value at its ONE begin site.
    - A recorded bag without the marker replays exactly as today; a flagged bag replays byte-identically across two runs and the fake engine reports receiving it.
  </behavior>
  <action>
    **0. Capture the HEAD references BEFORE touching any file** (both identity
    gates are before/after comparisons on the untouched tree):
    `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate emboss-pos15-kpy-head --emboss 15`
    and `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity-kpy-head`
    (scenario omitted = neutral). Then copy both out of /tmp:
    `cp /tmp/medium-engine/emboss-pos15-kpy-head.json /tmp/emboss-pos15-kpy-head.json`
    and the same for `neutral-identity-kpy-head.json`.

    **1. RED — new `reliefModifier.test.ts`** (the pure law; this is the only
    executable pin of the pressure contract). Import from `./reliefModifier`.
    Pin: `reliefModifierPress(0.405, true) === 1` and
    `reliefModifierPress(0, true) === 1` and `reliefModifierPress(1, true)
    === 1` (the pressureless case is exactly full magnitude for ANY input);
    `reliefModifierPress(0.405, false) === 0.405` (verbatim);
    `reliefModifierSigned('erode', b, press)` is NEGATIVE and
    `reliefModifierSigned('deposit', b, press)` is POSITIVE (the engine's
    erode branch requires `reliefSigned < 0` and the clamped law reads
    `-reliefSigned`); magnitudes compared with `Math.abs`:
    `|signed('erode', b, 0.405)| < |signed('erode', b, 1)|` and the same for
    deposit (pressure is measurably weaker at p=0.3's curve value);
    `|signed('erode', b, 1)| === RELIEF_MODIFIER_ERODE_GAIN * b` and the
    deposit twin; both exported gains are finite and > 0.

    **2. RED — `relief.test.ts`.** REPLACE the jak describe `relief-only
    strokes (quick 261123-jak)` with `modifier relief (quick 261123-kpy)`
    pinned on the new literals, reusing `sliceBetween`, `extractBracket`,
    `splitTopLevel`:
    - `interface Stroke` contains `relief: ReliefMode | null;` and
      `pressureless: boolean;`, and no longer contains `reliefOnly`;
    - the pointerdown slice contains the exact latch line
      `const relief: ReliefMode | null = tool === 'brush' ? (e.shiftKey ? 'erode' : e.metaKey ? 'deposit' : null) : null;`
      and the literal fields `relief,` and `pressureless: false,`;
    - the `scriptBegin` signature ends `pigment?: Pigment, relief?: ReliefMode): boolean {`
      and its Stroke literal contains `relief,`;
    - the consume loop contains `s.pressureless = q.p < 0;` exactly TWICE,
      once in the `!s.started` branch after `s.pr = this.pressureOf(s, q.p);`
      and once in the steady branch before `const pr = this.pressureOf(s, q.p);`;
    - the brush slice keeps the `const reliefAmount = P.emboss * amount *
      RELIEF_GAIN * embossPress;` literal UNCHANGED and adds
      `const reliefSigned = s.relief === null` plus
      `reliefModifierSigned(s.relief, amount * RELIEF_GAIN, reliefModifierPress(embossPress, s.pressureless))`;
    - the skip guards read `if (s.relief === null && (coverAmount > 0 || bristle)) {`,
      `if (s.relief === null) this.carrierPass(`,
      `if (s.relief === null) {` (the paint-block opener — use
      `extractBracket` and assert it contains `this.coverPass(`,
      `this.bristleInk(`, `this.coverageDeposit(`, `this.brushInk(` and
      `this.bristleTouch(`), `if (s.relief === null && wet > 0) this.brushWet(`
      and `if (s.relief === null && moving && b.water > 0) this.splatVelocity(`;
    - the own touch reads `if (s.relief !== null && reliefSigned !== 0) this.touch(this.stampRect(dx, dy, dr, this.dw, this.dh, bristle ? 1.6 : 1.5));`
      placed BEFORE `if (reliefSigned > 0) {`;
    - the erode branch still contains
      `Math.min(1, -reliefSigned * RELIEF_ERODE_NEGATIVE)` and still no
      `this.cover`/`this.ink`/`this.fixed`;
    - `onStrokeEnd?(tool: Tool, relief?: ReliefMode): void;` and
      `this.callbacks.onStrokeEnd?.(s.tool, s.relief ?? undefined);`;
    - `reliefModifier.ts` is imported by Engine.ts (`from './reliefModifier'`).
    In the hr5 describes, MOVE the two ordering anchors that read
    `if (!s.reliefOnly && wet > 0) this.brushWet(` (relief.test.ts 369 and
    506) to `if (s.relief === null && wet > 0) this.brushWet(`; keep every
    other hr5 assertion (no `this.cover`, `this.ink`, `this.fixed` in the
    erode branch; no `touch(` inside `reliefErode`).

    **2b. RED — the two other source-scan pins of the SAME guard.**
    `scattering.test.ts` 795 pins it with `expectContains(brush, ...)` and
    `coverage.test.ts` 217 uses it as the `sliceBetween(brush, ...)` START
    anchor, both on the literal
    `if (!s.reliefOnly && (coverAmount > 0 || bristle)) {`. Move BOTH anchors
    to `if (s.relief === null && (coverAmount > 0 || bristle)) {` in this
    same RED step — the package has no vitest include config, so the full
    suite collects both files and a stale string here fails the gate for a
    literal this plan itself rewrote. `coverage.test.ts` splices a region on
    its anchor, so the replacement must be byte-exact.

    **3. RED — `determinismContract.test.ts`.** Rename the fake's 11th
    `scriptBegin` parameter to `relief` (type `'erode' | 'deposit' |
    undefined`) and replace the presence counter with
    `private reliefBegins: 'erode' | 'deposit' | null = null`, set by
    `if (relief !== undefined) this.reliefBegins = relief` (one `replayRun`
    drives one stroke, so the last value IS that stroke's polarity). Salt by
    POLARITY, not presence:
    `const reliefByte = this.reliefBegins === 'erode' ? 0x80 : this.reliefBegins === 'deposit' ? 0x40 : 0`
    — a presence-only salt makes both polarities export IDENTICAL bytes, so
    the cross-polarity assertion below could never pass. Change `makeStroke`'s
    4th parameter to `relief?: 'erode' | 'deposit'` with the conditional
    spread `...(relief !== undefined ? { relief } : {})`. Rewrite the row at
    396-410 as TWO rows beside the emboss -15 row: (a) two replays of
    `makeStroke(undefined, 15, undefined, 'erode')` yield identical bytes,
    `recorded.engine.relief === 'erode'`, the unflagged stroke has no key,
    and the erode bytes differ from the unflagged; (b) the same for
    `'deposit'`, and the deposit bytes differ from the ERODE bytes (the
    polarity, not just its presence, reaches the engine). Comment that the
    real-engine pigment-identity proof is the Task 3 probe.

    **4. RED — `codec.test.ts`** (replace the jak describe
    `reliefOnly carrier (quick 261123-jak)` with `relief carrier (quick
    261123-kpy)`): a stroke with `engine.relief: 'erode'` and one with
    `'deposit'` round-trip through the JSON wire; `relief: true`,
    `relief: 'smooth'` and `relief: ''` are refused when parsing (fail
    closed, never defaulted); an unflagged stroke invents no key and
    schemaVersion stays 1. Add matching rows to `toStudioStroke.test.ts`:
    absent stays absent; each polarity projects verbatim.

    **5. RED — `engineAdapter.test.ts`**, inside `feeds the factor at both
    script calls inside feedDueSample (source contract)`: replace
    `expect(beginBlock).toContain('active.stroke.engine.reliefOnly === true')`
    with `expect(beginBlock).toContain('active.stroke.engine.relief,')` (the
    existing `samplePigment,` assertion must keep matching).

    **6. GREEN — new `packages/efx-watercolor/src/playground/reliefModifier.ts`.**
    Module doc: quick 261123-kpy — the modifier magnitude is PRESSURE-only;
    the slider is never read, and the pressureless sentinel is the recorded
    per-sample `p < 0`, never pointerType. Export
    `type ReliefMode = 'erode' | 'deposit'`;
    `RELIEF_MODIFIER_ERODE_GAIN = 15` and `RELIEF_MODIFIER_DEPOSIT_GAIN =
    15` (starting values = the hr5 full-slider +15 magnitude equivalent at
    full pressure; a comment states they are calibrated on the
    `emboss-relief-modifier` probe — see Task 3, where saturation that kills
    the pressure arm forces the erode gain down);
    `reliefModifierPress(embossPressAtPr: number, pressureless: boolean)`
    returning `pressureless ? 1 : embossPressAtPr`;
    `reliefModifierSigned(mode: ReliefMode, base: number, press: number)`
    returning `mode === 'erode' ? -(base * press * RELIEF_MODIFIER_ERODE_GAIN)
    : base * press * RELIEF_MODIFIER_DEPOSIT_GAIN`. Pure, no imports.

    **7. GREEN — `Engine.ts`.**
    a. Import `{ reliefModifierPress, reliefModifierSigned, type ReliefMode }`
    from `'./reliefModifier'`.
    b. `interface Stroke`: replace `reliefOnly: boolean;` with
    `relief: ReliefMode | null;` (doc: latched at pointerdown or carried by a
    replayed bag; the polarity of the relief-only pass) and
    `pressureless: boolean;` (doc: the last consumed sample carried the
    recorded `p < 0` sentinel — a mouse/finger pointer; never derived from
    pointerType).
    c. pointerdown: replace the `reliefOnly` latch line with
    `const relief: ReliefMode | null = tool === 'brush' ? (e.shiftKey ? 'erode' : e.metaKey ? 'deposit' : null) : null;`
    and comment: stroke-START only on the RESOLVED tool; Shift wins when both
    are held; Alt never reaches here (the picker consumes it capture-phase);
    NO Emboss gate — the magnitude never reads the slider. Literal:
    `relief,` and `pressureless: false,`.
    d. `scriptBegin`: trailing `relief?: ReliefMode`; literal `relief,` and
    `pressureless: false,`.
    e. Consume loop: in the `!s.started` branch, after
    `s.pr = this.pressureOf(s, q.p);` add `s.pressureless = q.p < 0;`; in the
    steady branch, beside the width/pigment handoff and before
    `const pr = this.pressureOf(s, q.p);`, add `s.pressureless = q.p < 0;`.
    The dwell and catch-up traces introduce no sample and keep the current
    value.
    f. Brush stamp: keep `const embossPress = ...` and
    `const reliefAmount = P.emboss * amount * RELIEF_GAIN * embossPress;`
    BYTE-IDENTICAL (never re-associate — bit identity depends on evaluation
    order). Replace the `reliefSigned` line with
    `const reliefSigned = s.relief === null ? reliefAmount : reliefModifierSigned(s.relief, amount * RELIEF_GAIN, reliefModifierPress(embossPress, s.pressureless));`
    and comment: modifier magnitude is pressure-only; the pressureless
    sentinel is full strength; the gains are probe-calibrated.
    g. Guards: `if (s.relief === null && (coverAmount > 0 || bristle))`;
    `if (s.relief === null) this.carrierPass(...)`; the one paint block
    `if (s.relief === null) { ... }` (coverPass / bristleInk /
    coverageDeposit / brushInk / bristleTouch); the wet guard
    `if (s.relief === null && wet > 0)`; the splat guard
    `if (s.relief === null && moving && b.water > 0)`.
    h. Own protection before the relief branch:
    `if (s.relief !== null && reliefSigned !== 0) this.touch(this.stampRect(dx, dy, dr, this.dw, this.dh, bristle ? 1.6 : 1.5));`
    with a comment naming why (no ink pass ran to protect the rect; history
    merges repeated protections inside one step) — for BOTH polarities.
    i. The branch and the clamped erode law stay as shipped; pass
    `reliefSigned` unchanged.
    j. `onStrokeEnd?(tool: Tool, relief?: ReliefMode): void;` and the call
    `this.callbacks.onStrokeEnd?.(s.tool, s.relief ?? undefined);`.
    Do NOT touch `reliefErode`/`bristleReliefErode`/`brushRelief`/
    `bristleReliefPass`/`coverPass`/`bristleInk`/`brushInk`/`lift` bodies,
    the shaders, or `mediums.ts`.

    **8. GREEN — payload, codec, adapter.** `toStudioStroke.ts`: replace
    `reliefOnly?: true` in BOTH types with `relief?: 'erode' | 'deposit'`
    (doc: the modifier polarity latched at stroke start; pressure-driven;
    written only when latched); in the engine block replace the reliefOnly
    spread with `...(s.relief !== undefined ? { relief: s.relief } : {})`
    beside `vectorDrawn`. `codec.ts` `isStrokeShape`: replace the reliefOnly
    guard with `const relief = engine['relief']; if (relief !== undefined &&
    relief !== 'erode' && relief !== 'deposit') return false;` (comment:
    unknown values are refused, never defaulted; the Roto schema twin).
    `engineAdapter.ts` `feedDueSample`: replace the 11th argument with
    `active.stroke.engine.relief,` (typed `'erode' | 'deposit' | undefined`.

    NOTE (fix-before-tests ordering): the engine's RUNTIME behaviour is
    proven by Task 3's probe — these package pins fix the source shape and
    the pure law. If Task 3's calibration changes a gain constant, re-run
    this task's scoped suite after the constant change.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run src/playground/reliefModifier.test.ts src/playground/relief.test.ts src/playground/scattering.test.ts src/playground/coverage.test.ts src/determinismContract.test.ts src/payload/codec.test.ts src/payload/toStudioStroke.test.ts src/adapter/engineAdapter.test.ts</automated>
  </verify>
  <done>
    The engine latches Shift (erode) or Cmd (deposit) at stroke start with no
    Emboss gate, the modifier magnitude is the pure pressure-only law with a
    pressureless sentinel fixed by the recorded per-sample value, a modifier
    dab paints nothing and runs the signed relief law under its own ink-rect
    undo protection, the polarity reaches the engine through the payload and
    adapter on replay, every pinned law is green, and an unflagged stroke
    takes today's exact code path.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Recording and persistence — the polarity bag, AQTL bits 5-6, the app boundaries and the help rows</name>
  <files>
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx,
    app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts,
    app/src/components/physic-paint/performance/scriptTimelineCodec.ts,
    app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts,
    app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts,
    app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts,
    app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts
  </files>
  <behavior>
    - `onStrokeEnd(tool, relief)` receives the engine's polarity; the recorded bag writes `relief` ONLY when it is present, so an ordinary stroke keeps its exact key set (source-pinned on the record literal).
    - AQTL vectorFlags bit 5 (0x20) is erode and bit 6 (0x40) is deposit: an encode sets exactly one with NO extra payload byte (byteLength unchanged), a decode restores the polarity, an unflagged stroke leaves both bits clear and the key absent, a re-encode of a decoded stroke is byte-identical, and BOTH bits set is REFUSED.
    - The reserved-flag refusal moves to 0x80, and the Roto script schema refuses any present value that is not `'erode'` or `'deposit'` (label `engine.relief`).
    - The duplicate/`+Key` re-record projection carries the polarity, and an absent marker stays absent.
    - The lift/erase contract and the bridge pins move to the two-parameter callback; the shared shortcuts help documents both modifiers in the Paint Tools group; tsc accepts the whole surface.
  </behavior>
  <action>
    **1. Rename the duplicate test file** `git mv
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts`.

    **2. RED — `scriptTimelineCodec.test.ts`.** Supersede `still refuses an
    unknown vector flag bit` to use `0x80` (comment: `0x20` is the erode and
    `0x40` the deposit polarity marker; the next free bit is `0x80`).
    Replace the jak relief-only round-trip case with `round-trips the relief
    polarity bits with no extra payload byte (quick 261123-kpy)`: from
    `minimalStroke()` build one copy with `engine: { ...plain.engine, relief:
    'erode' }` and one with `'deposit'`; assert equal byteLength for all
    three, and READ THE BYTE at the flag index (`VECTOR_FLAG_OFFSET` is the
    byte OFFSET 73, not the flags value): the erode bytes satisfy
    `erodeBytes[VECTOR_FLAG_OFFSET] & 0x20` nonzero with
    `& 0x40 === 0`, the deposit bytes satisfy
    `depositBytes[VECTOR_FLAG_OFFSET] & 0x40` nonzero with `& 0x20 === 0`,
    `plainBytes[VECTOR_FLAG_OFFSET]` is zero for both bits, both decodes
    return the polarity, the plain decode has no key, and each decoded
    stroke re-encodes byte-identically. Add a refusal case: bytes with BOTH bits set fail to
    decode with the conflict error (build the byte by OR-ing the flags on a
    copy of the plain bytes at `VECTOR_FLAG_OFFSET`).

    **3. RED — `physicsPaintRotoScriptSchema.test.ts`** (replace the jak
    `reliefOnly on the script engine slot` describe with `relief polarity on
    the script engine slot (quick 261123-kpy)`, modeled on the
    textureRotation block): accepts `'erode'` and `'deposit'` through the
    runtime events; refuses `true`, `false` and `'smooth'` with the exact
    label `stroke 0: engine.relief`; an absent key stays absent in the
    runtime projection.

    **4. RED — the renamed duplicate test**: `aquarelleStrokeFromScriptEvent`
    carries `'erode'` and `'deposit'` onto the re-recorded stroke, and an
    absent marker stays absent (`'relief' in projected === false`). Build the
    source event with `toStudioStroke({ ...relief: 'deposit' })`.

    **5. RED — `aquarelleStrokeBridge.test.ts`** in `record-time stroke
    literal (61-07)`: replace the jak case with one asserting the record
    literal contains `...(relief !== undefined ? { relief } : {})` and that
    the layer source contains `onStrokeEnd(tool, relief)`.

    **6. RED — `aquarelleLiftEraseContract.test.ts`**: change the pinned
    literals `onStrokeEnd(tool, reliefOnly)` to `onStrokeEnd(tool, relief)`
    (both occurrences, ~117 comment and ~121 assertion).

    **7. RED — `physicsPaintShortcutsHelp.test.ts`**: extend the pinned Paint
    Tools keys array (73-88) with `'⇧ + stroke'` and `'⌘ + stroke'` inserted
    AFTER `'⌥ + click'`; the tab labels stay unchanged (no new group).

    **8. GREEN — `AquarelleCanvasLayer.tsx`.** The callback literal becomes
    `onStrokeEnd(tool, relief) {`; in the recorded bag literal, after the
    textureRotation spread, replace the jak spread with
    `...(relief !== undefined ? { relief } : {})` with a comment (quick
    261123-kpy: the ENGINE latched the polarity at pointerdown; written only
    when latched so an ordinary stroke keeps its exact key set).

    **9. GREEN — `scriptTimelineCodec.ts`.** Replace
    `VECTOR_FLAG_RELIEF_ONLY` with `VECTOR_FLAG_RELIEF_ERODE = 1 << 5` and
    `VECTOR_FLAG_RELIEF_DEPOSIT = 1 << 6` (doc: quick 261123-kpy; each bit IS
    the whole marker — no payload byte) and include BOTH in
    `VECTOR_FLAGS_MASK`. Encode: `if (engine.relief === 'erode') flags |=
    VECTOR_FLAG_RELIEF_ERODE;` and `if (engine.relief === 'deposit') flags |=
    VECTOR_FLAG_RELIEF_DEPOSIT;` before `writer.u8(flags);`. Decode: extend
    the returned type with `relief?: 'erode' | 'deposit'`; after the reserved
    check add the conflict refusal `if ((flags & VECTOR_FLAG_RELIEF_ERODE)
    !== 0 && (flags & VECTOR_FLAG_RELIEF_DEPOSIT) !== 0) fail('invalid-value',
    'vector block carries both relief polarity flags', reader.offset - 1);`
    then set `result.relief = 'erode'` / `'deposit'` from the single bit.
    Merge into the engine payload beside the vectorDrawn merge:
    `...(vector.relief !== undefined ? { relief: vector.relief } : {})`.
    Update the header wire docs (bits list; "bit 5 = modifier erode, bit 6 =
    modifier deposit, both set is refused") and keep version 4.

    **10. GREEN — `physicsPaintRotoScriptSchema.ts`.** In
    `isEnginePayloadAquarelleStroke` replace the reliefOnly mirror guard with
    `if (value.relief !== undefined && value.relief !== 'erode' &&
    value.relief !== 'deposit') return false;` (comment: duplicated
    deliberately, a saved Roto script can reach this guard without the
    codec) and in `describeEngineRefusal` return `'engine.relief'` for the
    same test.

    **11. GREEN — `physicsPaintRotoDuplicateScript.ts`:** in
    `aquarelleStrokeFromScriptEvent`, after the textureRotation spread,
    replace the jak spread with `...(engine.relief !== undefined ? { relief:
    engine.relief } : {})` with a comment (a copied/+Key stroke must keep its
    polarity; absent stays absent).

    **12. GREEN — `physicsPaintShortcutsHelp.ts`.** In the Paint Tools group,
    after `{keys: '⌥ + click', ...}`, add
    `{keys: '⇧ + stroke', description: 'Erode relief — pressure-driven (works at Emboss 0; wins over ⌘)'}`
    and
    `{keys: '⌘ + stroke', description: 'Deposit relief — pressure-driven (works at Emboss 0)'}`.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.relief.test.ts src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts && pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    A live modifier stroke records its polarity, the AQTL wire carries it in
    the two flag bits alone with the both-set conflict and reserved bits
    refused, every app boundary validates or projects it by the established
    optional-field law, the superseded pins are moved deliberately, both
    modifiers appear in the shared shortcuts help, and the scoped suites plus
    the app typecheck pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Probe scene `emboss-relief-modifier` — erode, deposit and pressure arms, and the gates</name>
  <files>
    packages/efx-watercolor/probe/medium-engine/probe.ts,
    packages/efx-watercolor/probe/medium-engine/run.mjs,
    packages/efx-watercolor/probe/medium-engine/compare.mjs,
    packages/efx-watercolor/probe/medium-engine/harness.test.ts,
    packages/efx-watercolor/src/playground/reliefModifier.ts
  </files>
  <action>
    **1. `probe.ts` — the entry knob.** In `ScriptEntry` replace
    `readonly reliefOnly?: true` with `readonly relief?: 'erode' | 'deposit'`
    (doc: quick 261123-kpy — drives a modifier relief stroke of this
    polarity; the discriminator rides the recorded bag so replay passes it
    into the engine exactly like a live stroke; omitted adds no key). In
    `makeStroke`'s `toStudioStroke({...})` literal replace the reliefOnly
    spread with `...(entry.relief !== undefined ? { relief: entry.relief } :
    {})`.

    **2. `probe.ts` — the scenario.** REPLACE `embossReliefOnlyScript` with
    `embossReliefModifierScript(mode: 'erode' | 'deposit', bandEmboss: number,
    press: number | 'none' | undefined, brushId?: string, control = false)`:
    entry 1 is the band at `bandEmboss` with `captureRelief: 'before'` and
    `STROKE_POINTS`; entry 2 is the SAME band with `relief: mode`,
    `captureRelief: 'after'`, and its points chosen by `control` — when
    `control`, map `STROKE_POINTS` to `{ ...point, y: point.y + 2 }` (two
    sheets away: `stampRect` clamps to an EMPTY rect, so `touch()`
    early-returns and every draw is a zero-size scissor — the same drive
    length, samples and settle ticks, no relief writes); otherwise when
    `press !== undefined` map each point's `p` to `press === 'none' ? -1 :
    press`, else keep `STROKE_POINTS`. Comment the WHY: `emboss: 0` is no
    longer inert (the modifier ignores the slider), so inertness must come
    from geometry, and an in-drive before/after digest pair cannot prove
    no-paint because the dry sim keeps evolving the film.

    **3. `probe.ts` — selection and operands.** In the scenario chain replace
    the `emboss-relief-only` arm with `emboss-relief-modifier` calling
    `embossReliefModifierScript(reliefMode, emboss ?? (reliefMode ===
    'deposit' ? 5 : 15), press, resolvedBrush, reliefControl)`; document that
    for this scenario `--emboss` is the BAND value (default 15 erode / 5
    deposit — the deposit arm needs headroom for the peak to rise). Add
    `readReliefMode()` (`get('reliefMode')`, `'erode'` default, anything else
    throws) and `readPress()` (`get('press')`; `'none'` stays the string;
    else a finite number in [0, 1]; anything else throws). Rename the
    scenario in `readScenario`'s closed list (keep the
    `or "bristle-tip")` tail literal) and rename `readReliefControl`'s
    scenario gate. In `main` parse both, refuse `--relief-mode`/`--press`
    outside `emboss-relief-modifier`, and pass them into `run(...)`.

    **4. `probe.ts` — the readback.** Replace `reliefOnlyCapture` with
    `reliefModifierCapture`: no-op unless the scenario is
    `emboss-relief-modifier`; read `reliefBandStats(engine, sheet,
    EMBOSS_SMOOTH_BOX)` and record `reliefModifierMean{Before,After}` and
    `reliefModifierPeak{Before,After}` (round4) into a
    `reliefModifierReadings` bag, adding the elapsed time to `captureMs` (the
    entry-loop call site stays shared with `reliefCapture`). Replace
    `embossReliefOnlyReport` with `embossReliefModifierReport`, gated on the
    renamed scenario: echo `reliefModifierMode` (the polarity),
    `reliefModifierEmboss` (the band value), `reliefModifierPress` (`press ??
    'recorded'`), `reliefModifierControl` (the boolean), spread the four
    readings, and digest the UNSHADED film exactly as jak did (`setLight({
    intensity: 0 })`, digest `exportCanvas('pigment')` and
    `exportCanvas('transparent')`, restore `light ?? DEFAULT_LIGHT.intensity`)
    as `unshadedPigmentDigest` / `unshadedTransparentDigest`, plus
    `pngTransparent`. Extend the `EMBOSS_SMOOTH_BOX` comment (the box serves
    the erode and deposit modifier bands).

    **5. `run.mjs`.** Rename `emboss-relief-only` to `emboss-relief-modifier`
    in the usage line, the closed list and its message (before
    `or "bristle-tip")`), and the `--relief-control` gate message. Add
    `--relief-mode` (`erode`|`deposit`, default erode) and `--press`
    (`0..1` or `none`), both refused unless the scenario is
    `emboss-relief-modifier`, and append `&reliefMode=` / `&press=` to the
    query string. Update the header docs: the scenario is the pressure-driven
    modifier pair; `--emboss` is the band; `--press` applies to the MODIFIER
    entry only (the band keeps STROKE_POINTS so the before reading is stable
    across pressure arms); `none` writes the recorded -1 sentinel.

    **6. `compare.mjs` — the relation, the control and the pressure modes.**
    Rename `RELIEF_ONLY_FIELDS` to `RELIEF_MODIFIER_FIELDS` with the four
    `reliefModifier*` names. Replace `reliefOnlyFailures` with
    `reliefModifierFailures(data)`: a control capture is judged with the pair
    message; missing fields fail naming `--scenario emboss-relief-modifier`;
    an unknown `reliefModifierMode` fails (fail closed, never defaulted);
    `'erode'` requires `meanBefore > 0`, `meanAfter <= meanBefore * 0.5` and
    `peakAfter <= peakBefore`; `'deposit'` requires `meanAfter > meanBefore`
    and `peakAfter > peakBefore`. Replace `reliefOnlyControlFailures` with
    `reliefModifierControlFailures(actual, control)`: the jak laws plus the
    new ones — both captures the renamed scenario, the same
    `reliefModifierMode` and `reliefModifierEmboss`, the control's
    `reliefModifierMean/PeakAfter === Before` exactly (relief target
    untouched), and the pair's two UNSHADED digests byte-identical. Add
    `reliefPressureFailures(actual, reference)`: both captures the renamed
    scenario with the same mode and band; `reference.reliefModifierPress ===
    1` (the full arm); `actual.reliefModifierPress` is `'none'` or a number
    `< 1`; both reductions `before - after` are positive; a numeric light
    arm must have a STRICTLY smaller reduction AND a higher
    `reliefModifierMeanAfter` than the reference (a light touch relieves
    less); the `'none'` arm must reach at least 0.9x the reference reduction
    (the pressureless sentinel is full magnitude — footprint differences are
    tolerated, the exact equality is pinned by `reliefModifier.test.ts`).
    Register `'emboss-relief-modifier': reliefModifierFailures` in
    `SCENARIO_INVARIANTS`. Rename the mode `--relief-only` to
    `--relief-modifier [controlGate]` and add the mode
    `--relief-pressure <fullPressGate>`; add self-contained blocks mirroring
    the existing jak block (header, mode label, printDurations, the echoes,
    the readings, alpha-law failures, relation failures, verdict; the
    pressure block prints both captures' readings and the delta) and update
    the usage string. In the `--other` a/b block, replace the relief-only
    field set with `RELIEF_MODIFIER_FIELDS` + `UNSHADED_FILM_FIELDS` and also
    compare `reliefModifierMode`, `reliefModifierEmboss` and
    `reliefModifierPress` when both sides carry them.

    **7. `harness.test.ts`.** Update the numbered law list (comment block
    ~2070) and the jak pin block: pin `emboss-relief-modifier` in BOTH
    closed lists with both `or "bristle-tip")` tails unchanged; pin
    `'--relief-control'`, `'--relief-mode'`, `'--press'`,
    `'--relief-modifier'`, `'--relief-pressure'`,
    `'emboss-relief-modifier': reliefModifierFailures,`,
    `function reliefModifierFailures(`, `function
    reliefModifierControlFailures(`, `function reliefPressureFailures(` and
    `UNSHADED_FILM_FIELDS = ['unshadedPigmentDigest', 'unshadedTransparentDigest']`.

    **8. Run the gates (checkout root, `vitest run` only, no server).**
    - Erode relation + no-paint control (watercolor):
      `--gate emboss-relief-modifier-erode --scenario emboss-relief-modifier --relief-mode erode`
      then `compare.mjs emboss-relief-modifier-erode --relief-modifier`;
      `--gate emboss-relief-modifier-erode-control --scenario emboss-relief-modifier --relief-mode erode --relief-control`
      then `compare.mjs emboss-relief-modifier-erode --relief-modifier emboss-relief-modifier-erode-control`.
    - Erode bristle arm:
      `--gate emboss-relief-modifier-erode-bristle --scenario emboss-relief-modifier --relief-mode erode --brush bristle-flat`
      + the relation, and the same with `--relief-control` + the pair check.
    - Deposit relation + control (watercolor):
      `--gate emboss-relief-modifier-deposit --scenario emboss-relief-modifier --relief-mode deposit`
      + the relation; `--gate emboss-relief-modifier-deposit-control ... --relief-control`
      + the pair check.
    - Replay parity (a/b) on BOTH polarities: rerun the erode and deposit
      gates under `-a` / `-b` suffixes and
      `compare.mjs <a> --other <b>` (identical digests, readings and echoes).
    - Pressure arm (erode): `--gate emboss-relief-modifier-erode-p1
      --scenario emboss-relief-modifier --relief-mode erode --press 1`,
      `--gate ...-p03 ... --press 0.3`, `--gate ...-none ... --press none`;
      `compare.mjs emboss-relief-modifier-erode-p03 --relief-pressure emboss-relief-modifier-erode-p1`
      (strictly weaker) and
      `compare.mjs emboss-relief-modifier-erode-none --relief-pressure emboss-relief-modifier-erode-p1`
      (at least 0.9x the full reduction).
    - CALIBRATION (the user's law): the erode default run must halve the band
      mean with the peak not raised AT THE RECORDED PRESSURE. If the
      pressure arm reads the SAME reduction at p=0.3 and p=1 (the clamped
      erode saturating), lower `RELIEF_MODIFIER_ERODE_GAIN` until the p=0.3
      arm is strictly weaker while the default run still halves the mean; if
      the deposit pass blows past the intended band, adjust
      `RELIEF_MODIFIER_DEPOSIT_GAIN` likewise. `reliefModifier.ts` is in this
      task's file scope ONLY for those two gain constants — no other edit to
      the module. Re-run Task 1's scoped suite after any gain change and
      record the final constants and measured bands in the SUMMARY.
    - Identity vs pre-change HEAD: `--gate emboss-pos15 --emboss 15` then
      `compare.mjs emboss-pos15 --other emboss-pos15-kpy-head`; and
      `--gate neutral-identity` then `compare.mjs neutral-identity --other
      neutral-identity-kpy-head` — every digest, byte length and alpha-law
      field equal, zero DIFFER, zero MISSING. The committed baseline is
      stale (bd efx-motion-editor-9zz) and is NOT used or repaired.
    - Full suites: `pnpm --dir packages/efx-watercolor exec vitest run`,
      `pnpm --dir packages/efx-watercolor run check`,
      `pnpm --dir app exec vitest run`, `pnpm --dir app exec tsc --noEmit`
      (the app suite is long — background it and resume on the result).
    - Untouchable audit:
      `git diff --exit-code -- packages/efx-watercolor/src/playground/shaders.ts packages/efx-watercolor/src/playground/mediums.ts packages/efx-watercolor/src/playground/mediums.test.ts`
      must exit 0; `git status --short` must list only this plan's files plus
      the untracked `.planning/phases/64-medium-engine/64-BEADS-RECALL.md`
      modification, which is NOT committed.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate emboss-relief-modifier-erode --scenario emboss-relief-modifier --relief-mode erode && node packages/efx-watercolor/probe/medium-engine/compare.mjs emboss-relief-modifier-erode --relief-modifier && pnpm --dir packages/efx-watercolor exec vitest run</automated>
  </verify>
  <done>
    The probe proves the pressure-driven pair: the erode pass over a +15 band
    at least halves the band relief mean without raising the peak on BOTH the
    reliefFS arm and the bristle gather arm, while the deposit pass raises a
    light band's mean and peak on the reliefFS arm; the pigment and unshaded
    transparent film are byte-identical against the off-sheet inert twin for
    BOTH polarities (the no-paint guard is polarity-independent);
    a/b replays match; a light pen press relieves strictly less than full
    press and the pressureless sentinel reaches at least 0.9x the full
    reduction; the +15 and neutral captures match the pre-change HEAD
    references field for field; the full package and app suites plus both
    typechecks pass; the shaders, medium records and display law are
    untouched.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| project file -> recorded bag | A persisted stroke bag is external input on project load, replay and bake; `relief` changes which channels a stroke writes and in which direction. |
| Roto script file -> engine | A saved/hand-edited script reaches the schema guard without passing the JSON codec. |
| AQTL bytes -> decode | The binary carrier is parsed from disk; a malformed flag byte must never smuggle a payload, a polarity or a contradiction. |
| pointer -> engine latch | The modifier keys and the resolved tool decide a per-stroke polarity; a stale or re-read modifier mid-stroke must not flip it, and Alt must stay the picker. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-KPY-01 | Tampering | `relief` on the recorded bag (JSON codec + Roto schema) | medium | mitigate | Both boundaries accept only the two literals when the key is present (`isStrokeShape`, `isEnginePayloadAquarelleStroke`) and REFUSE anything else instead of defaulting; `scriptBegin`'s trailing parameter defaults to `undefined` (an ordinary stroke), so an absent or unknown value can never start a modifier pass. Pinned in `codec.test.ts` and `physicsPaintRotoScriptSchema.test.ts`. |
| T-KPY-02 | Tampering / Denial of service | AQTL vectorFlags bits 5-6 | medium | mitigate | Each bit is the whole marker (no payload byte); the mask includes both; the reserved-flag test moves to 0x80 so unknown bits still fail closed; BOTH bits set is a decode refusal (no encoder can legally write it). Pinned in `scriptTimelineCodec.test.ts`. |
| T-KPY-03 | Tampering | the modifier brush stamp | medium | mitigate | Every paint/water/carrier write sits inside `s.relief === null` guards in ONE block (source-pinned); the relief branch draws only `this.relief`; the pressureless case reads ONLY the recorded per-sample `p < 0` sentinel (never pointerType), so a replayed bag cannot gain or lose magnitude; the probe proves pigment and unshaded transparent film byte-identical across the pass against an off-sheet twin for both polarities. A non-brush tool ignores the marker entirely. |
| T-KPY-04 | Elevation of privilege (UI intent) | the Shift/Cmd latch and Alt | low | mitigate | The latch is computed once at pointerdown from the RESOLVED tool (Shift wins over Cmd); mid-stroke modifier changes cannot flip the stroke (pinned literal + LATCH UAT row); the Alt picker is a capture-phase consumer that never reaches the engine (ALT UAT row), and Select mode keeps Alt-delete. |
| T-KPY-05 | Repudiation | undo of a modifier stroke | low | mitigate | The modifier dab takes its own `touch` on the exact ink-pass rects (1.5/1.6, PROTECT_MARGIN 24) for BOTH polarities, so undo restores the band in the stroke's step; the normal path keeps today's protection sites unchanged. |
| T-KPY-SC | Tampering | package installs | low | accept | No package is installed, added or upgraded by this quick; no legitimacy checkpoint is required. |
</threat_model>

<verification>
- **Per-task gates** are the scoped `vitest run` targets above, the probe
  gates in Task 3, `pnpm --dir packages/efx-watercolor run check` and
  `pnpm --dir app exec tsc --noEmit`.
- **Full gates (checkout root):** `pnpm --dir packages/efx-watercolor exec vitest run`,
  `pnpm --dir packages/efx-watercolor run check`, `pnpm --dir app exec vitest run`,
  `pnpm --dir app exec tsc --noEmit`. Never watch mode; never start the dev
  server.
- **Untouchable-surface audit:** `git diff --exit-code -- packages/efx-watercolor/src/playground/shaders.ts packages/efx-watercolor/src/playground/mediums.ts packages/efx-watercolor/src/playground/mediums.test.ts`
  must exit 0 (no shader, no medium-record, no display-emboss change).
  `git diff --stat HEAD` must list only this plan's `files_modified`; no Rust,
  persistence, schema-version or migration file may appear.
- **Guardrail audit:** in the engine diff, the brush stamp's changes are the
  `reliefSigned` assignment, the release of the latch into the pressure law,
  the own-touch line, the `s.relief === null` guards and the two new Stroke
  fields; `coverPass`, `brushInk`, `bristleInk`, `bristleTouch`,
  `reliefErode`, `bristleReliefErode`, `lift` and every shader are unchanged
  (the existing pins carry this), the `reliefAmount` literal is
  byte-identical, and the clamped erode law literal is byte-identical.
- **Live UAT (artist-run, exact surfaces; report automated-ready until it
  passes):**
  1. ERODE — brush tool, Emboss +15, paint an impasto band; then hold Shift
     for a second stroke across it (any Emboss): the band visibly smooths as
     you go, NO ink is added (the colour under the path is untouched), and
     the relief light follows the new surface.
  2. DEPOSIT — hold Cmd for a second stroke: the band visibly thickens/raises
     along the path with NO ink added.
  3. PRESSURE — with a pen, a light Shift stroke smooths gently and a
     full-press Shift stroke smooths strongly; the same for Cmd.
  4. MOUSE — with the mouse/trackpad, Shift erodes at FULL strength (the
     pressureless pointer is full magnitude).
  5. EMBOSS 0 — Shift and Cmd both work at Emboss 0 (the slider is not
     read), with no paint.
  6. ALT — Alt+click still picks the colour (and still deletes the selected
     stroke in Move/Edit Select mode); holding Alt never starts a relief
     pass.
  7. SETTLE — release and let the sheet settle: the smoothed/raised surface
     stays (no bounce-back, no water bloom — no water entered).
  8. RE-RENDER — re-render the committed key once: the committed frame
     re-bakes the same relief result (the polarity survived the recorded bag;
     on a fresh-session key the committed base keeps its baked shading in the
     gaps until that re-render — the known residual, not a defect).
  9. IDENTITY — a normal (no-modifier) stroke is unchanged, and Emboss 0
     paints exactly as today.
  10. LATCH — press or release Shift/Cmd MID-stroke: the current stroke keeps
      its latched polarity; only the NEXT stroke that starts with a modifier
      is a relief pass. With BOTH held at the start, Shift (erode) wins.
- **Help surface:** the shared Shortcuts modal shows both modifier rows in
  Paint Tools.
</verification>

<success_criteria>
- Shift at stroke start with the brush erodes relief and Cmd deposits; both
  ignore the Emboss slider entirely and both work at Emboss 0; every paint,
  water, cover and carrier channel is skipped; Shift wins when both are held
  and a mid-stroke change never alters the current stroke.
- The magnitude is pressure-only, fixed by `reliefModifierPress` (full 1.0
  for the recorded `p < 0` sentinel, the embossPress floor curve otherwise)
  and probe-calibrated gains; a pen at p=0.3 relieves measurably less than at
  p=1.0 and the pressureless arm reaches at least 0.9x the full reduction.
- The probe proves the law: the erode pass halves the +15 band mean with the
  peak not raised on both the reliefFS and bristle gather arms, the deposit
  pass raises a light band's mean and peak on the reliefFS arm, the pigment
  and unshaded transparent film are byte-identical across the pass against
  the off-sheet inert twin for both polarities, and a/b replays match.
- The polarity rides the recorded bag ONLY when latched, through
  toStudioStroke, the JSON codec, AQTL bits 5-6 (no payload byte, version 4,
  both-set and unknown bits refused), the Roto schema and the duplicate
  projection; an ordinary bag keeps its exact key set and replays
  byte-identically.
- Undo of a modifier stroke restores the band in one step via the dab's own
  ink-rect protection for both polarities; the normal path's protection sites
  are unchanged.
- Normal strokes and Emboss 0 are byte-identical to the pre-change HEAD
  captures; the shaders, medium records, display emboss law and Lift are
  untouched; the full package and app suites plus both typechecks pass.
</success_criteria>

<output>
Create `.planning/quick/261123-kpy-validate-v2-3-0-studio-paint-modifier-re/261123-kpy-SUMMARY.md`
when done, recording: (a) the calibrated gain constants and the per-arm gate
numbers (relief mean/peak before and after, the reduction deltas) for the
erode watercolor, erode bristle and deposit runs; (b) the pressure arm results
(p=1.0, p=0.3, none) and why the constants are safe against erode saturation;
(c) the no-paint results against the off-sheet inert twin for BOTH polarities
(the two unshaded digests) and the a/b replay results; (d) the +15 and
neutral identity results against the pre-change HEAD captures, with the stale
committed `neutral-identity` baseline recorded as a known follow-up (bd
efx-motion-editor-9zz) and not repaired; (e) the pins that moved (the jak
reliefOnly describe, the 0x40 reserved-bit test superseded to 0x80, the
`onStrokeEnd(tool)` literal, the record-literal and adapter source pins, the
renamed duplicate test file, the shortcuts key array) with the superseded
expectations; (f) the AQTL consequence (bit 5 keeps jak's erode meaning; bit 6
is new and pre-kpy builds refuse it — fail closed by design, no compat shim);
(g) the ten UAT rows with their exact surfaces, reported as automated-ready
until the artist confirms them live, plus the fresh-session key residual.
</output>
