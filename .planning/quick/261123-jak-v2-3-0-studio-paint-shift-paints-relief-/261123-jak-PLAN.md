---
phase: quick/261123-jak
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
autonomous: true
requirements: []
estimate:
  # Three transactions. Task 1 is the engine latch + the skip guards + the
  # payload/adapter plumbing with the pinned laws that move (plus the
  # pre-change identity captures). Task 2 is the app recording bag, the AQTL
  # flag bit and the Roto boundaries. Task 3 is the probe scenario, its
  # self-contained relation mode and the six gate runs. estimate-calibration
  # reports factor 1, sample_count 0, confidence low (no calibration sample
  # for quicks).
  tokens: 84000
  raw_tokens: 84000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A Shift-held stroke start on the brush tool with a non-zero Emboss becomes a relief-only stroke: it inverts the Emboss sign and paints nothing — the probe `emboss-relief-only` shows the band relief mean at most half its pre-pass value and the peak not raised, while the pigment and transparent digests are BYTE-IDENTICAL before and after, on both the reliefFS arm and the bristle gather arm."
    - "Normal strokes are byte-identical to HEAD: a +15 emboss capture and an Emboss 0 capture match the pre-change captures on every digest, byte length and alpha-law field."
    - "The marker is latched at pointerdown — mid-stroke Shift changes never flip the current stroke — and Emboss 0 is inert, so Shift paints normally there (probe-independent: pinned latch law plus the LATCH and EMBOSS 0 UAT rows)."
    - "The recorded per-stroke bag carries `reliefOnly: true` ONLY when the engine reported it; an unflagged stroke keeps its exact pre-emboss key set; JSON, AQTL and the Roto script boundaries all round-trip it; the adapter feeds it to `scriptBegin`; a bag without the flag replays exactly as today."
    - "Undo restores a smoothed band in one step: the relief-only dab takes its own touch on the same rects the ink pass uses (1.5 non-bristle, 1.6 bristle, PROTECT_MARGIN 24) for both signs — no new undo step is added per dab and the normal path keeps today's protection sites."
    - "The relief-only stroke is a pure relief smoother: no ink, no water, no cover pass, no carrier pickup/refill and no bristle touch stamp run; GAP-1 stands (paint never auto-erodes relief under its own coverage)."
  artifacts:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/relief.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
  key_links:
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      via: "the pointerdown latch is the ONE authority: it sets Stroke.reliefOnly once, and onStrokeEnd reports it beside the resolved tool; nothing downstream re-derives it from Shift"
    - from: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      to: packages/efx-watercolor/src/payload/toStudioStroke.ts
      via: "the recorded bag writes reliefOnly only when true; toStudioStroke's conditional spread is the ONE projection into the engine payload (record, restore, duplicate, script copy all share it)"
    - from: app/src/components/physic-paint/performance/scriptTimelineCodec.ts
      to: packages/efx-watercolor/src/adapter/engineAdapter.ts
      via: "AQTL vectorFlags bit 5 carries the marker with no payload byte; feedDueSample reads active.stroke.engine.reliefOnly and passes it to scriptBegin"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "the brush stamp computes the same reliefAmount, flips its sign for reliefOnly, and gates every paint/water/carrier site on !s.reliefOnly — the relief branch targets only this.relief"
    - from: packages/efx-watercolor/probe/medium-engine/probe.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "the probe reads the private relief target (reliefBandStats) and digests the pigment/transparent exports before and after the relief-only entry"
---

<objective>
Make Shift a relief smoother in Studio paint: holding Shift at stroke START
with the brush tool and a non-zero Emboss turns the stroke into a relief-only
pass — the emboss sign inverts and every paint channel is suppressed, so the
artist flattens (or lifts) an existing impasto without adding or removing a
single pigment byte.

Purpose: after the signed-Emboss quick (261123-hr5) the artist can already
subtract thickness with Emboss -N while painting — but every such stroke still
deposits paint. The decided design is a modifier, not a new tool: Shift at
pointerdown latches a per-stroke `reliefOnly` flag; the brush stamp keeps its
radius/spacing/pressure/width/angle math, computes the SAME dab amount, then
runs the existing signed relief branch with the sign flipped, and skips the
ink, water, cover and carrier pipeline entirely. The flag rides the recorded
stroke bag (JSON and AQTL) so a re-render of a committed key replays the
smoothing instead of repainting it.

Output: a latched `Stroke.reliefOnly`, the guarded brush stamp with its own
per-dab undo protection, the engineering flag through toStudioStroke / JSON
codec / AQTL bit 5 / Roto schema / adapter replay, pinned laws for all of it,
and the probe scene `emboss-relief-only` proving the smoothing with
byte-identical pigment.
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
@app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
@packages/efx-watercolor/probe/medium-engine/probe.ts
@packages/efx-watercolor/probe/medium-engine/run.mjs
@packages/efx-watercolor/probe/medium-engine/compare.mjs
@packages/efx-watercolor/probe/medium-engine/harness.test.ts

Skills to load before implementing: `efx-studio-paint` (the compositing laws,
the probe harness, the live/settle/re-render surfaces, the undo protection
law), `spike-findings-efx-motion-editor` (the bristle gather / deposit laws),
`efx-preact-reactivity` (the layer callback and the recorded bag are signal-
adjacent — no render-body writes, no React patterns).

**Project constraints that bind this plan**
- `pnpm`, `vitest run` only — never watch mode. Never start the dev server.
  Never push.
- Do not run the server; the artist drives the live UAT.
- Do NOT touch the display emboss law, the light, Body semantics, the medium
  records (`mediums.ts`), the shaders (`shaders.ts`), Lift, or any shader
  program. No new Tool value. No medium-record change, no migration.
- Do not make paint auto-erode relief under its coverage — the approved
  acrylic GAP-1 law stands; the erode is gated by the recorded emboss sign
  only.
- No backward-compat shims, but OLD bags (no `reliefOnly` key) must replay
  exactly as today.
- Do NOT commit `.planning/phases/64-medium-engine/64-BEADS-RECALL.md` — it
  carries unrelated pre-existing changes.

**Verified anchors at HEAD 964914dac (re-read before editing)**
- `Engine.ts` ~295-323: `interface Stroke` (fields incl. `widthFrom/To`,
  `pigFrom/To`); exactly TWO Stroke literals build it — `scriptBegin` ~1444
  and `pointerdown` ~2288.
- `Engine.ts` 174: `onStrokeEnd?(tool: Tool): void;`; the sole call is 2611
  `this.callbacks.onStrokeEnd?.(s.tool);` (live strokes only — a scripted
  stroke has `pointerId === SCRIPT_POINTER`).
- `Engine.ts` 1436: `scriptBegin(tool, x, y, pressure, step='Stroke',
  maxRadius?, tiltX=0, tiltY=0, widthScale=1, pigment?)`. Other callers pass
  six or fewer args (`StrokeWriter.ts:143`, `engineScriptWidth.test.ts`,
  `probe/vector-spine`, `probe/watercolor-opacity`) — a trailing optional
  parameter is additive for all of them.
- `Engine.ts` ~2278: pointerdown resolves `let tool = this.tool;` then the
  touch/finger-water and pen-eraser/barrel overrides — the latch site.
- `Engine.ts` 2734-2920 (`case 'brush'`): `reliefAmount` at 2773 (keep this
  literal byte-identical — its pin must not move); pre-dab protection block
  at ~2819-2837; eachDab: `bristleTravel`+`carrierPass` ~2849-2852,
  `coverPass` ~2858, ink chain ~2871-2873, `bristleTouch` ~2877, the signed
  relief branch 2887-2896, `brushWet` 2899, `splatVelocity` 2904.
- `Engine.ts` 3087/3089: `brushInk` touches `stampRect(..., 1.5)`;
  `bristleInk` 3573/3578 touches `stampRect(..., 1.6)`; `touch()` 3703 saves
  `snapshotLayers()` (which includes `this.relief.views[0]`) with
  `PROTECT_MARGIN = 24` (411). `reliefErode` 3060 / `bristleReliefErode`
  3074 (`ZERO, ONE_MINUS_SRC_COLOR`; the caller owns protection).
- `Engine.ts` `bindGather` 3461 binds only bristles/bristleShape — it never
  reads `cover`/`ink`, so a relief-only bristle dab needs `beginBristles` +
  `bristleTravel` (kept) but no carrier/cover/ink pass.
- `toStudioStroke.ts`: `AquarelleStrokePayload` ~87, runtime
  `AquarelleStroke` ~166; projection conditional spreads 257-267
  (`textureId`/`textureRotation`, the precedent shape).
- `codec.ts` `isStrokeShape` ~101-139 (validates `anchors`, `curveMode`,
  `vectorDrawn !== undefined && !== true`, `textureId`);
  `cloneStrokeForWire` spreads `...stroke.engine`, schemaVersion stays 1.
- `engineAdapter.ts` `feedDueSample` ~460-508: `engine.scriptBegin(...,
  widthFactor, samplePigment)` at the one begin site; `active.stroke.engine`
  is the payload in hand.
- `AquarelleCanvasLayer.tsx` 722 `onStrokeEnd(tool) {`, recorded bag literal
  739-775 with the lift-gated conditional spreads; `PhysicsPaintStudio.tsx`
  4706 re-projects recorded runtime strokes through `toStudioStroke`, so the
  payload projection covers that slow path for free.
- `scriptTimelineCodec.ts`: flags 213-221 (`VECTOR_FLAG_DRAWN = 1 << 4`,
  `VECTOR_FLAGS_MASK`), encode 639-642 (`if (engine.vectorDrawn === true)
  flags |= VECTOR_FLAG_DRAWN;` then `writer.u8(flags);`), decode 944 (reserved
  check) / 989 (`result.vectorDrawn = true`), merge 1131; header docs 12-93.
- `scriptTimelineCodec.test.ts` 795-801 pins 0x20 as the next FREE bit (must
  be superseded to 0x40); 803-815 is the drawn round-trip model
  (`minimalStroke()` and `coloredVectorStroke()` fixtures, `VECTOR_FLAG_OFFSET`).
- `physicsPaintRotoScriptSchema.ts` 598-628 `isEnginePayloadAquarelleStroke`
  (mirror of the codec; `textureId` "duplicated deliberately") and 425-540
  `describeStrokeRefusal` / `describeEngineRefusal` (525-540) which produce
  the `engine.<field>` refusal labels the tests assert.
- `physicsPaintRotoDuplicateScript.ts` 178-224
  `aquarelleStrokeFromScriptEvent` — a THIRD conditional-spread projection
  (anchors, curveMode, vectorDrawn, textureId, textureRotation); model test
  `physicsPaintRotoDuplicateScript.vectorDrawn.test.ts` (61 lines).
- `aquarelleLiftEraseContract.test.ts` 117-123 pins the literal
  `onStrokeEnd(tool)`.
- Probe harness: `run.mjs` closed list 304 + message 306 (tail
  `or "bristle-tip")`), usage 240, docs 170-176/297-299;
  `probe.ts` `readScenario` 3768-3780 (same tail), `ScriptEntry` 688-763,
  `paramsBag` 765, `makeStroke` 779 (the `toStudioStroke({...})` literal),
  `embossSmoothScript` 815-821, `EMBOSS_SMOOTH_BOX` 809, scenario selection
  3366-3371, `reliefCapture` 3427-3438 + call site 3492, exports 3546-3549,
  report blocks 3610-3700 (`embossSmoothReport` 3656-3664),
  `reliefBandStats` 2034 + `bandPigment` 442 + `digestCanvas` 374,
  `visibleAlpha` 3560 (`scenario.startsWith('bristle-') ? skipped : check`);
  `compare.mjs` `RELIEF_SMOOTH_FIELDS` 161-168, `reliefSmoothFailures`
  1193-1230, mode parse 1341-1360, self-contained `relief-smooth` block
  1425-1465, `--other` field loop 1587-1630, `SCENARIO_INVARIANTS`
  1225-1240; `harness.test.ts` 1746-1751 pins both closed-list tails.

**Known pre-existing gap (do not repair here).** The committed
`baselines/neutral-identity.json` predates 64-31 and is stale (tracked as bd
efx-motion-editor-9zz). Both identity gates in this quick are before/after
comparisons against pre-change HEAD captures taken in Task 1 step 0 — never
the committed baseline. Do NOT re-capture or edit the committed baseline, and
do NOT widen `REFERENCE_OPTIONAL`.

**Known consequence of the AQTL bit.** AQTL stays version 4; a project file
containing a relief-only stroke sets vectorFlags bit 5, which PRE-jak builds
refuse as a reserved flag (fail closed, by design — no compat shim). Old
projects (bit clear) load and replay byte-identically.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Relief-only engine core — the latch, the skip guards, the inverted sign, and the package pins</name>
  <files>
    packages/efx-watercolor/src/playground/Engine.ts,
    packages/efx-watercolor/src/playground/relief.test.ts,
    packages/efx-watercolor/src/determinismContract.test.ts,
    packages/efx-watercolor/src/payload/toStudioStroke.ts,
    packages/efx-watercolor/src/payload/toStudioStroke.test.ts,
    packages/efx-watercolor/src/payload/codec.ts,
    packages/efx-watercolor/src/payload/codec.test.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  </files>
  <behavior>
    - `Stroke` carries `reliefOnly: boolean`; both literals set it (pointerdown latches it, scriptBegin receives it); no path leaves it undefined.
    - The latch is exactly `tool === 'brush' && e.shiftKey && this.params.emboss !== 0`, computed from the RESOLVED tool after the stylus/finger overrides — so mid-stroke Shift changes cannot flip a stroke.
    - In the brush stamp, a relief-only dab sets `reliefSigned` to the negated `reliefAmount`; the deposit/erode branch reads `reliefSigned`, so slider +N erodes and slider −N deposits with the same magnitudes as the hr5 signed path.
    - A relief-only dab runs NO paint/water/carrier site: pre-dab cover protection, carrierPass, coverPass, the ink chain (bristleInk/coverageDeposit/brushInk), the bristle touch stamp, brushWet and splatVelocity are all skipped; bristleTravel and beginBristles still run (the gather mask and alongPx are the relief input).
    - A relief-only dab takes its own protection before the relief draw: `touch(stampRect(..., 1.5))` non-bristle, `1.6` bristle, for BOTH signs, guarded so a zero-sign dab touches nothing.
    - `onStrokeEnd` reports `(tool, reliefOnly)`; `scriptBegin` accepts a trailing `reliefOnly = false`; `toStudioStroke` projects `reliefOnly: true` only when true; the JSON codec accepts only `true`; the adapter feeds the flag at its ONE begin site.
    - A recorded bag without the flag replays exactly as today (every existing digest row holds); a flagged bag replays byte-identically across two runs.
  </behavior>
  <action>
    **0. Capture the HEAD references BEFORE touching any file** (both identity
    gates are before/after comparisons on the untouched tree):
    `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate emboss-pos15-jak-head --emboss 15`
    and `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity-jak-head`
    (scenario omitted = neutral). Then copy both to /tmp:
    `cp /tmp/medium-engine/emboss-pos15-jak-head.json /tmp/emboss-pos15-jak-head.json`
    and the same for `neutral-identity-jak-head.json`.

    **1. RED — `relief.test.ts`, new describe `relief-only strokes (quick
    261123-jak)`** beside the hr5 describe, reusing `sliceBetween`,
    `extractBracket`, `splitTopLevel`. Pin:
    - the latch line verbatim inside the pointerdown slice, and that the
      pointerdown Stroke literal contains `reliefOnly,`;
    - `interface Stroke` contains `reliefOnly: boolean;` and the
      `scriptBegin` signature ends `pigment?: Pigment, reliefOnly = false):
      boolean {`;
    - the scriptBegin Stroke literal contains `reliefOnly,` (count the
      `reliefOnly,` literal occurrences across the file = exactly 2);
    - inside the brush slice, in this order: the `reliefSigned` line, the own
      touch line `if (s.reliefOnly && reliefSigned !== 0) this.touch(this.stampRect(dx, dy, dr, this.dw, this.dh, bristle ? 1.6 : 1.5));`,
      `if (reliefSigned > 0) {`, `else if (reliefSigned < 0) {`, then the wet
      guard `if (!s.reliefOnly && wet > 0) this.brushWet(`;
    - the erode branch contains `Math.min(1, -reliefSigned * RELIEF_ERODE_NEGATIVE)`
      and still no `this.cover`/`this.ink`/`this.fixed`;
    - the skip guards exist: `if (!s.reliefOnly && (coverAmount > 0 || bristle)) {`,
      `if (!s.reliefOnly) this.carrierPass(`, and
      `if (!s.reliefOnly && moving && b.water > 0) this.splatVelocity(`;
    - the one paint block: from `if (!s.reliefOnly) {` (the occurrence that
      wraps the draws) use `extractBracket` and assert it contains
      `this.coverPass(`, `this.bristleInk(`, `this.coverageDeposit(`,
      `this.brushInk(` and `this.bristleTouch(`;
    - `onStrokeEnd?(tool: Tool, reliefOnly?: boolean): void;` and
      `this.callbacks.onStrokeEnd?.(s.tool, s.reliefOnly);`;
    - the `const reliefAmount = P.emboss * amount * RELIEF_GAIN * embossPress;`
      literal is UNCHANGED (the hr5 positive-path law).
    Then MOVE the hr5 pins that the rewrite renames: in `branches on the sign
    after the untouched positive deposit, before the wet pass` swap
    `if (reliefAmount > 0) {` / `else if (reliefAmount < 0) {` /
    `-reliefAmount * RELIEF_ERODE_NEGATIVE` / `if (wet > 0) this.brushWet(`
    for their `reliefSigned` / guarded-wet forms; keep every negative
    assertion (no `this.cover`, `this.ink`, `this.fixed` in the erode branch;
    no `touch(` inside `reliefErode`).

    **2. RED — `determinismContract.test.ts`.** Extend the fake's
    `scriptBegin` with a 10th parameter `_reliefOnly = false`, storing it
    (e.g. increment `reliefOnlyBegins` when true) and folding a
    `reliefOnlyBegins > 0 ? 0x80 : 0` salt into the exported blue byte —
    the render-mode precedent: the flag is replay INPUT. Add a 4th
    `makeStroke(viscosity?, emboss?, body?, reliefOnly?)` parameter with the
    conditional spread `...(reliefOnly === true ? { reliefOnly: true } : {})`
    into the `toStudioStroke` literal. Add one row beside the emboss -15
    row: two replays of `makeStroke(undefined, 15, undefined, true)` yield
    identical bytes, `recorded.engine.reliefOnly === true`,
    `'reliefOnly' in makeStroke(undefined, 15).engine === false`, and the
    flagged run's bytes differ from the unflagged run's (the fake received
    the flag). Comment that the real-engine pigment-identity proof is the
    `emboss-relief-only` probe in Task 3.

    **3. RED — `codec.test.ts` (new describe `reliefOnly carrier (quick
    261123-jak)`, model on the textureId/vectorDrawn rows):** a stroke with
    `engine.reliefOnly: true` round-trips through the JSON wire;
    `reliefOnly: false` and any non-true value are refused when parsing
    (fail closed); an unflagged stroke invents no key and schemaVersion
    stays 1. Add the two matching rows to `toStudioStroke.test.ts` (absent
    stays absent; `true` projects `reliefOnly: true`).

    **4. RED — `engineAdapter.test.ts`**, inside `feeds the factor at both
    script calls inside feedDueSample (source contract)`: add
    `expect(beginBlock).toContain('active.stroke.engine.reliefOnly === true')`
    (the existing `samplePigment,` assertion must keep matching).

    **5. GREEN — `Engine.ts`.**
    a. `Stroke` interface: add `reliefOnly: boolean;` with a one-line doc
    (quick 261123-jak: latched at pointerdown; inverts the emboss sign and
    suppresses every paint/water channel for this stroke).
    b. pointerdown: after the pen barrel-button line, add
    `const reliefOnly = tool === 'brush' && e.shiftKey && this.params.emboss !== 0;`
    followed by the literal field `reliefOnly,`. Comment: the latch is
    stroke-start only; mid-stroke Shift never flips; Emboss 0 is inert.
    c. `scriptBegin`: trailing `reliefOnly = false` parameter; the Stroke
    literal gains `reliefOnly,`.
    d. Brush stamp — keep `const reliefAmount = ...` byte-identical; add
    `const reliefSigned = s.reliefOnly ? -reliefAmount : reliefAmount;`
    with a comment (relief-only inverts the sign; the magnitude and the
    per-dab amount are the same dab law).
    e. Pre-dab protection block: `if (!s.reliefOnly && (coverAmount > 0 || bristle))`
    — a relief-only dab takes its own touch below, on the ink-pass rects.
    f. In eachDab: inside the bristle branch keep `bristleTravel` and
    `alongPx`, guard the carrier: `if (!s.reliefOnly) this.carrierPass(...)`.
    Then wrap the paint/order writes in ONE block `if (!s.reliefOnly) { ... }`
    containing the coverPass call (`coverAmount > 0 && !bristle`), the ink
    chain (bristleInk / coverageDeposit / brushInk) and `bristleTouch`.
    g. Before the relief branch add the own protection, for both signs:
    `if (s.reliefOnly && reliefSigned !== 0) this.touch(this.stampRect(dx, dy, dr, this.dw, this.dh, bristle ? 1.6 : 1.5));`
    with a comment naming why (no ink pass ran to protect the rect; the same
    1.5/1.6 rects the ink passes use, PROTECT_MARGIN applied by touch()).
    h. The branch: `if (reliefSigned > 0) {` / `else if (reliefSigned < 0) {`
    with `Math.min(1, -reliefSigned * RELIEF_ERODE_NEGATIVE)`; pass
    `reliefSigned` to bristleReliefPass/brushRelief. Keep the GAP-1 comment.
    i. `if (!s.reliefOnly && wet > 0) this.brushWet(...)` and
    `if (!s.reliefOnly && moving && b.water > 0) this.splatVelocity(...)`.
    j. `onStrokeEnd?(tool: Tool, reliefOnly?: boolean): void;` and the call
    `this.callbacks.onStrokeEnd?.(s.tool, s.reliefOnly);`.
    Do NOT touch `reliefErode`/`bristleReliefErode`/`brushRelief`/
    `bristleReliefPass`/`coverPass`/`bristleInk`/`brushInk`/`lift` bodies,
    the shaders, or `mediums.ts`.

    **6. GREEN — payload, codec, adapter.** `toStudioStroke.ts`: add
    `reliefOnly?: true` to `AquarelleStrokePayload` and `AquarelleStroke`
    with the Shift-relief doc; in the engine block add the conditional
    spread `...(s.reliefOnly === true ? { reliefOnly: true as const } : {})`
    beside `vectorDrawn`. `codec.ts` `isStrokeShape`: mirror the vectorDrawn
    rule (`reliefOnly !== undefined && reliefOnly !== true` refuses) with a
    one-line comment pointing at the Roto schema twin.
    `engineAdapter.ts` `feedDueSample`: append
    `active.stroke.engine.reliefOnly === true` as the 11th argument of the
    one `scriptBegin` call.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run src/playground/relief.test.ts src/determinismContract.test.ts src/payload/codec.test.ts src/payload/toStudioStroke.test.ts src/adapter/engineAdapter.test.ts</automated>
  </verify>
  <done>
    The engine latches Shift at stroke start, a relief-only dab paints nothing
    and runs the signed relief law with the inverted sign under its own
    ink-rect undo protection, the flag reaches the engine through the payload
    and adapter on replay, every pinned law is green, and an unflagged stroke
    takes today's exact code path.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Recording and persistence — the bag, AQTL bit 5, and the three app boundaries</name>
  <files>
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx,
    app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts,
    app/src/components/physic-paint/performance/scriptTimelineCodec.ts,
    app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts,
    app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  </files>
  <behavior>
    - `onStrokeEnd(tool, reliefOnly)` receives the engine's flag; the recorded bag writes `reliefOnly: true` ONLY when it is exactly true, so an unflagged stroke keeps its exact key set (source-pinned on the record literal).
    - AQTL bit 5 (0x20) of vectorFlags is the whole marker: an encode of a flagged stroke sets it with NO extra payload byte (byteLength unchanged), a decode restores `reliefOnly: true`, an unflagged stroke leaves the bit clear and the key absent, and re-encoding a decoded flagged stroke is byte-identical.
    - The reserved-bit refusal moves to 0x40 (0x20 is now legal), and the Roto script schema refuses any present value that is not `true` (label `engine.reliefOnly`).
    - The duplicate/`+Key` re-record projection carries the marker through its conditional-spread convention, and an absent marker stays absent.
    - The lift/erase contract pin moves to the two-parameter callback; tsc accepts the whole surface.
  </behavior>
  <action>
    **1. RED — `scriptTimelineCodec.test.ts`.** Supersede `still refuses an
    unknown vector flag bit` to use `0x40` (comment: `0x20` is the quick
    261123-jak relief-only marker; the next free bit is `0x40`). Add
    `round-trips the relief-only marker bit with no extra payload byte
    (quick 261123-jak)` modeled on the 62-UAT drawn test: build
    `minimalStroke()` and a copy with `engine: { ...plain.engine, reliefOnly:
    true }`; assert equal byteLength, the flagged bytes carry
    `VECTOR_FLAG_OFFSET & 0x20 === 0x20`, the plain bytes carry 0, the decode
    returns `engine.reliefOnly === true`, the plain decode has no key, and a
    decoded flagged stroke re-encodes byte-identically. If `minimalStroke`
    lacks an engine payload helper, reuse the fixtures already in the file —
    no new fixture shapes.

    **2. RED — `physicsPaintRotoScriptSchema.test.ts`** (new describe
    `reliefOnly on the script engine slot (quick 261123-jak)`, modeled on
    the textureRotation block at ~528): accepts `reliefOnly: true` through
    the runtime events; refuses `false` and `'yes'` with the exact label
    `stroke 0: engine.reliefOnly`; an absent key stays absent in the runtime
    projection.

    **3. RED — new `physicsPaintRotoDuplicateScript.reliefOnly.test.ts`**
    (61-line model: `physicsPaintRotoDuplicateScript.vectorDrawn.test.ts`):
    `aquarelleStrokeFromScriptEvent` carries `reliefOnly` onto the
    re-recorded stroke, and an absent marker stays absent
    (`'reliefOnly' in projected === false`). Build the source event with
    `toStudioStroke({ ...reliefOnly: true })`.

    **4. RED — `aquarelleStrokeBridge.test.ts`** in
    `record-time stroke literal (61-07)`: add a case asserting the record
    literal contains
    `...(reliefOnly === true ? { reliefOnly: true } : {})` and that the
    layer source contains `onStrokeEnd(tool, reliefOnly)`.

    **5. RED — `aquarelleLiftEraseContract.test.ts`**: change the pinned
    literal `onStrokeEnd(tool)` to `onStrokeEnd(tool, reliefOnly)` (and the
    comment at ~117 naming the signature).

    **6. GREEN — `AquarelleCanvasLayer.tsx`.** The callback literal becomes
    `onStrokeEnd(tool, reliefOnly) {`; in the recorded bag literal, after
    the textureRotation spread, add the engine-reported marker:
    `...(reliefOnly === true ? { reliefOnly: true } : {})` with a comment
    (quick 261123-jak: the ENGINE latched Shift at pointerdown; written only
    when true so an unflagged stroke keeps its exact key set — the
    textureId precedent).

    **7. GREEN — `scriptTimelineCodec.ts`.** Beside `VECTOR_FLAG_DRAWN` add
    `const VECTOR_FLAG_RELIEF_ONLY = 1 << 5;` (doc: quick 261123-jak, the
    bit IS the whole marker, no payload byte) and include it in
    `VECTOR_FLAGS_MASK`. Encode: `if (engine.reliefOnly === true) flags |=
    VECTOR_FLAG_RELIEF_ONLY;` before `writer.u8(flags);`. Decode: extend the
    returned type with `reliefOnly?: true`, set it when the bit is present,
    and merge `...(vector.reliefOnly === true ? { reliefOnly: true as const }
    : {})` into the engine payload beside the vectorDrawn merge. Update the
    header wire docs (bits list, "bit 5 = the stroke was a Shift relief-only
    pass") and keep version 4.

    **8. GREEN — `physicsPaintRotoScriptSchema.ts`.** In
    `isEnginePayloadAquarelleStroke` add the mirror guard
    `if (value.reliefOnly !== undefined && value.reliefOnly !== true) return false;`
    (comment: duplicated deliberately, a saved Roto script can reach this
    guard without the codec) and in `describeEngineRefusal` add
    `if (value.reliefOnly !== undefined && value.reliefOnly !== true) return 'engine.reliefOnly';`.

    **9. GREEN — `physicsPaintRotoDuplicateScript.ts`:** in
    `aquarelleStrokeFromScriptEvent`, after the textureRotation spread, add
    `...(engine.reliefOnly === true ? { reliefOnly: true as const } : {})`
    with a comment (a copied/+Key stroke must stay a relief smoother;
    absent stays absent).
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.reliefOnly.test.ts src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts && pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    A live Shift relief-only stroke records the marker, the AQTL wire carries
    it in the flag byte alone, every app boundary validates or projects it by
    the established optional-field law, the superseded pins are moved
    deliberately, and the scoped suites plus the app typecheck pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Probe scene `emboss-relief-only`, the relation mode, and the six gates</name>
  <files>
    packages/efx-watercolor/probe/medium-engine/probe.ts,
    packages/efx-watercolor/probe/medium-engine/run.mjs,
    packages/efx-watercolor/probe/medium-engine/compare.mjs,
    packages/efx-watercolor/probe/medium-engine/harness.test.ts
  </files>
  <action>
    **1. `probe.ts` — the entry knob.** Add `readonly reliefOnly?: true` to
    `ScriptEntry` (doc: drives a Shift relief-only stroke; the flag rides the
    recorded bag so replay passes it into the engine exactly like a live
    stroke; omitted adds no key). In `makeStroke`'s `toStudioStroke({...})`
    literal add `...(entry.reliefOnly === true ? { reliefOnly: true } : {})`
    beside the textureId spread.

    **2. `probe.ts` — the scenario.** Add
    `embossReliefOnlyScript(bandEmboss: number, brushId?: string)` returning
    two entries over the SAME `STROKE_POINTS` band and colour: entry 1
    `emboss: bandEmboss, captureRelief: 'before'`; entry 2
    `mutationId: MUTATION_ID + 1, emboss: bandEmboss, reliefOnly: true,
    captureRelief: 'after'`; each carries the resolved brush when requested.
    Reuse `EMBOSS_SMOOTH_BOX` (extend its comment: the box serves both emboss
    band scenarios). Wire the selection chain after the emboss-smooth arm:
    `scenario === 'emboss-relief-only' ? embossReliefOnlyScript(emboss ?? 15, resolvedBrush) : ...`
    and document that for this scenario the `--emboss` operand is the BAND
    value (default 15; both entries carry it, the second as a relief-only
    stroke, so slider +15 erodes through the inversion).

    **3. `probe.ts` — the readback.** Beside `reliefCapture`, add
    `reliefOnlyCapture(surface)` that returns unless the scenario is
    `emboss-relief-only`; take `reliefBandStats(engine, sheet,
    EMBOSS_SMOOTH_BOX)` plus `digestCanvas(engine.exportCanvas('pigment'))` and
    `digestCanvas(engine.exportCanvas('transparent'))` at that moment, add the
    elapsed time to `captureMs`, and record `reliefOnlyMean{Before,After}`,
    `reliefOnlyPeak{Before,After}` (round4), `reliefOnlyPigmentDigest{Before,After}`
    and `reliefOnlyTransparentDigest{Before,After}`. At the entry-loop capture
    call site (3492) call BOTH helpers for an entry with `captureRelief`
    (each no-ops for the other scenario). Emit an `embossReliefOnlyReport`
    block (`reliefOnlyEmboss: emboss ?? 15`, the eight readings,
    `pngTransparent`) spread only for that scenario, so every other report
    shape is unchanged.

    **4. `probe.ts` — the closed list.** Add `raw !== 'emboss-relief-only'`
    to `readScenario`'s chain and `"emboss-relief-only"` to its message
    BEFORE `or "bristle-tip")` (the harness pins that tail); extend the
    scenario doc comment.

    **5. `run.mjs`.** Add `emboss-relief-only` to the usage line (after
    emboss-smooth), to the whitelist condition line 304, and to the error
    message before `or "bristle-tip")`. Document in the header (170-176 and
    297-299) that for this scenario `--emboss` is the band value (default 15).

    **6. `compare.mjs` — the relation mode.** Add
    `RELIEF_ONLY_FIELDS` (the four numeric readings) and
    `RELIEF_ONLY_DIGEST_FIELDS` (the four digests). Add
    `reliefOnlyFailures(data)`: missing readings fail with a message naming
    `--scenario emboss-relief-only`; `reliefOnlyMeanBefore` must be positive
    (the impasto landed); `reliefOnlyMeanAfter` at most half of before (a
    normal Shift pass visibly flattens); `reliefOnlyPeakAfter` not above
    before; and `reliefOnlyPigmentDigestAfter === reliefOnlyPigmentDigestBefore`
    AND `reliefOnlyTransparentDigestAfter === reliefOnlyTransparentDigestBefore`
    — the pigment must be BYTE-IDENTICAL (this is not Lift, and nothing was
    painted). Parse `--relief-only` in the mode switch and add a
    self-contained block mirroring the relief-smooth block (header, mode
    label, printDurations, echo `reliefOnlyEmboss`, readings, alpha-law
    failures, relation failures, verdict); update the usage string.
    Register `'emboss-relief-only': reliefOnlyFailures` in
    `SCENARIO_INVARIANTS` so the a/b `--other` run also asserts the relation.
    Extend the `--other` field block: when BOTH captures carry the numeric
    relief-only fields, compare all four numeric and four digest fields field
    for field (the a/b replay parity law).

    **7. `harness.test.ts`.** Add a case pinning that
    `emboss-relief-only` is declared in BOTH closed lists (the
    `scenarioRaw !== 'emboss-relief-only'` and `raw !== 'emboss-relief-only'`
    literals) and that both `or "bristle-tip")` tails are unchanged; add a
    case pinning the compare surface (`--relief-only` and
    `'emboss-relief-only': reliefOnlyFailures,`).

    **8. Run the gates (checkout root, `vitest run` only, no server).**
    - Smoothing + byte-identical pigment/transparent, watercolor arm:
      `--gate emboss-relief-only --scenario emboss-relief-only` then
      `compare.mjs emboss-relief-only --relief-only`.
    - Bristle gather arm: `--gate emboss-relief-only-bristle --scenario emboss-relief-only --brush bristle-flat`
      then the same relation.
    - Replay parity (a/b) on BOTH arms: run the watercolor scenario under
      `emboss-relief-only-a` / `emboss-relief-only-b` and the bristle arm
      under `emboss-relief-only-bristle-a` / `-b`, then
      `compare.mjs <a> --other <b>` for each pair (identical digests AND
      identical readings).
    - Positive byte-identity: `--gate emboss-pos15 --emboss 15` then
      `compare.mjs emboss-pos15 --other emboss-pos15-jak-head` — every
      digest, byte length and alpha-law field equal, zero DIFFER, zero
      MISSING.
    - Emboss 0 identity: `--gate neutral-identity` (scenario omitted) then
      `compare.mjs neutral-identity --other neutral-identity-jak-head` —
      same bar. The committed baseline is stale (bd efx-motion-editor-9zz)
      and is NOT used or repaired.
    - Full suites: `pnpm --dir packages/efx-watercolor exec vitest run`,
      `pnpm --dir packages/efx-watercolor run check`,
      `pnpm --dir app exec vitest run`, `pnpm --dir app exec tsc --noEmit`
      (the app suite is long — background it and resume on the result if
      needed).
    - Untouchable audit:
      `git diff --exit-code -- packages/efx-watercolor/src/playground/shaders.ts packages/efx-watercolor/src/playground/mediums.ts packages/efx-watercolor/src/playground/mediums.test.ts`
      must exit 0; `git status --short` must list only this plan's files plus
      the untracked `.planning/phases/64-medium-engine/64-BEADS-RECALL.md`
      modification, which is NOT committed.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate emboss-relief-only --scenario emboss-relief-only && node packages/efx-watercolor/probe/medium-engine/compare.mjs emboss-relief-only --relief-only && pnpm --dir packages/efx-watercolor exec vitest run</automated>
  </verify>
  <done>
    The probe proves a Shift relief-only pass over a +15 impasto at least
    halves the band relief mean without raising the peak while the pigment
    and transparent digests stay byte-identical, on both the reliefFS and
    bristle gather masks; the flagged stroke replays to identical digests and
    readings; the +15 and Emboss 0 captures match the pre-change HEAD
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
| project file -> recorded bag | A persisted stroke bag is external input on project load, replay and bake; `reliefOnly` changes which channels a stroke writes. |
| Roto script file -> engine | A saved/hand-edited script reaches the schema guard without passing the JSON codec. |
| AQTL bytes -> decode | The binary carrier is parsed from disk; a malformed flag byte must never smuggle a payload or a state. |
| pointer -> engine latch | The Shift modifier and the resolved tool decide a per-stroke mode; a stale or re-read modifier mid-stroke must not flip it. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-JAK-01 | Tampering | `reliefOnly` on the recorded bag (JSON codec + Roto schema) | medium | mitigate | Both boundaries accept only `true` when present (`isStrokeShape` and `isEnginePayloadAquarelleStroke`); the engine's `scriptBegin` default is `false`, so an absent or unknown value can never flip a stroke into relief-only. Pinned in `codec.test.ts` and `physicsPaintRotoScriptSchema.test.ts`. |
| T-JAK-02 | Tampering | the relief-only brush stamp | medium | mitigate | Every paint/water/carrier write sits inside `!s.reliefOnly` guards in ONE block (source-pinned), the relief branch draws only `this.relief`, and the probe proves the pigment and transparent digests are byte-identical across the relief-only pass. A non-brush tool ignores the flag entirely. |
| T-JAK-03 | Tampering / Denial of service | AQTL vectorFlags bit 5 | low | mitigate | The bit IS the whole marker (no payload byte), the reserved-bit mask includes it, unknown bits still fail closed, and the superseded 0x20 test moves to 0x40. Pre-jak builds refuse a new file by design (documented consequence, no compat shim). |
| T-JAK-04 | Repudiation | undo of a relief-only stroke | low | mitigate | The relief-only dab takes its own `touch` on the exact ink-pass rects (1.5/1.6, PROTECT_MARGIN 24) for both signs, so undo restores the smoothed band in the stroke's step; the normal path keeps today's protection sites unchanged. |
| T-JAK-05 | Elevation of privilege (UI intent) | Shift latch | low | mitigate | The latch is computed once at pointerdown from the resolved tool and stroke-start modifier; mid-stroke Shift cannot flip the stroke (pinned literal + LATCH UAT row). Emboss 0 is inert. |
| T-JAK-SC | Tampering | package installs | low | accept | No package is installed, added or upgraded by this quick; no legitimacy checkpoint is required. |
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
  reliefSigned line, the own-touch line, the `!s.reliefOnly` guards and the
  branch rename; `coverPass`, `brushInk`, `bristleInk`, `bristleTouch`,
  `reliefErode`, `bristleReliefErode`, `lift` and every shader are unchanged
  (the existing pins carry this), and the `reliefAmount` literal is
  byte-identical.
- **Live UAT (artist-run, exact surfaces; report automated-ready until it
  passes):**
  1. LIVE — brush tool, Emboss +15, paint an impasto band; then hold Shift
     for a second stroke across it at the same Emboss: the band visibly
     smooths as you go, NO ink is added (the colour under the path is
     untouched), and the relief light follows the new surface.
  2. SETTLE — release and let the sheet settle: the smoothed surface stays
     (no bounce-back, no water bloom — no water entered).
  3. RE-RENDER — re-render the committed key once: the committed frame
     re-bakes the same smoothed result (the flag survived the recorded bag;
     on a fresh-session key the committed base keeps its baked shading in the
     gaps until that re-render — the known residual, not a defect).
  4. IDENTITY — a normal (no-Shift) stroke is unchanged, Emboss 0 paints
     exactly as today, and a Shift stroke at Emboss 0 paints normally
     (nothing to invert).
  5. LATCH — press Shift MID-stroke: the current stroke keeps painting
     normally; only the NEXT stroke that starts with Shift is relief-only.
  6. EMBOSS 0 — Shift at Emboss 0 paints exactly like a normal stroke (no
     relief, no suppression).
</verification>

<success_criteria>
- Shift held at stroke start with the brush tool and a non-zero Emboss turns
  the stroke into a relief-only pass: the emboss sign is inverted inside the
  brush stamp and every paint, water, cover and carrier channel is skipped; a
  mid-stroke Shift change never affects the current stroke and Emboss 0 keeps
  Shift inert.
- The probe proves the law on both masks: band relief mean at most half,
  peak not raised, pigment and transparent digests byte-identical across the
  relief-only pass, and an a/b replay to identical digests and readings.
- The marker rides the recorded bag ONLY when true, through toStudioStroke,
  the JSON codec, AQTL bit 5 (no payload byte, version 4), the Roto schema
  and the duplicate projection; an unflagged bag keeps its exact key set and
  replays byte-identically.
- Undo of a relief-only stroke restores the band in one step via the dab's
  own ink-rect protection; the normal path's protection sites are unchanged.
- Normal strokes and Emboss 0 are byte-identical to the pre-change HEAD
  captures; the shaders, medium records, display emboss law and Lift are
  untouched; the full package and app suites plus both typechecks pass.
</success_criteria>

<output>
Create `.planning/quick/261123-jak-v2-3-0-studio-paint-shift-paints-relief-/261123-jak-SUMMARY.md`
when done, recording: (a) the per-arm gate numbers (relief mean/peak before
and after, the pigment/transparent digests) for the watercolor and bristle
runs, plus the a/b replay results; (b) the +15 and Emboss 0 identity results
against the pre-change HEAD captures, with the stale committed
`neutral-identity` baseline recorded as a known follow-up (bd
efx-motion-editor-9zz) and not repaired; (c) the pinned laws that moved (the
hr5 branch literals now reading reliefSigned and the guarded wet line, the
0x20 reserved-bit test superseded to 0x40, the `onStrokeEnd(tool)` literal,
the record-literal and adapter source pins) with the superseded expectations;
(d) the AQTL consequence (pre-jak builds refuse a project containing a
relief-only stroke — fail closed by design, no compat shim); (e) the six UAT
rows with their exact surfaces, reported as automated-ready until the artist
confirms them live, plus the fresh-session key residual.
</output>
