---
phase: quick/261121-umu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/brushes.test.ts
  - packages/efx-watercolor/probe/long-stroke/captures/before/result.json
  - packages/efx-watercolor/probe/long-stroke/captures/after/result.json
autonomous: true
requirements: []
estimate:
  # Production diff is ~12 lines across three files; the weight is the pin
  # surface (two existing suites gain a pressure-link block), three headless
  # Chrome probe runs, one package rebuild and the 280-file app physic-paint
  # suite. estimate-calibration returned factor 1, sample_count 0 — confidence
  # stays low because there is no calibration sample for quick tasks.
  tokens: 55000
  raw_tokens: 55000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "On the acrylic bag (Dry 0, Pigment 100, size 40, `bristle-round`, one three-row serpentine stroke at constant pressure) pressures 0.15 and 0.4 paint CONTINUOUSLY: every one of the 12 sampled path segments reads > 1 (not a rounded zero) and covered% > 0. Measured before the change at HEAD 6024f7454: 0.15 paints 0 texels (covered 0, all segments 0) and 0.4 dies mid-stroke (segments 165.97 162.31 142.1 76.24 133.34 29.12 0.02 0 0 0 0 0, covered 6.83) while the bristle load is still there (0.67/0.74/0.97)."
    - "Pressure 1.0 is unchanged: the probe's case (pressure 1, dry 0) — segments, covered, loadMin/Mean/Max, bristles — is exactly equal to the pre-change capture, and the (pressure 1, dry 70) control keeps its mid-stroke fade (segments tail 120.98 50.15 24.93 24.9 7.5, loadMean 0.05). The authored pen still owns the footprint, so a light press stays THINNER: covered(0.15) < covered(1.0) and covered(0.4) < covered(1.0) after the fix."
    - "Every response that omits `pressureLink` renders exactly as today: `bristleContactPressure(p, s, d, short)` and `bristleContactPressure(p, s, d, short, 1)` return the same float (`toBe`, not close-to) for p in {0, 0.15, 0.3, 0.75, 1}, and `BRUSH_PRESETS` states the field on exactly `bristle-flat` and `bristle-round` (both 0), on no other preset, and not in `BASE` / `CUSTOM_BASE`."
    - "The link is ONE term. At `pressureLink` 0 the contact gate is independent of the authored pen (`bristleContactPressure(0.15, 10, 100, 600, 0) === bristleContactPressure(1, 10, 100, 600, 0)`) while the speed ramp (rest 1.0 → 0.42 past `BRISTLE_PRESSURE_SPEED`) and the attack ramp (0.45 floor over `BRISTLE_PRESSURE_ATTACK · docShortPx`) still apply; between 0 and 1 the value is monotone; a non-finite link reads as the shipped 1."
    - "The engine has exactly ONE `bristleContactPressure` call site and it passes the brush's link (`b.pressureLink ?? 1`). No shader file, no uniform, no pass and no render target changes; `shaders.ts`, `mediums.ts` and the `touchOf` thresholds are untouched; the Dry/tank law (`dryDistance`, `loadFactor`, `uDepletion`) and the radius/`wet` paths in `stamp()` are untouched."
    - "`buildBrush` carries the field without new code (its `...rest` spread) and `brushBridge.buildBrushForStroke` inherits it from the preset, so a stroke resolves `brushId → preset → Brush → Engine.setBrush → stamp()` with no payload, `.mce` or serializer change."
  artifacts:
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/bristles.test.ts
    - packages/efx-watercolor/src/playground/brushes.test.ts
    - packages/efx-watercolor/probe/long-stroke/captures/before/result.json
    - packages/efx-watercolor/probe/long-stroke/captures/after/result.json
  key_links:
    - from: packages/efx-watercolor/src/playground/brushes.ts
      to: packages/efx-watercolor/src/adapter/engineAdapter.ts
      via: "presetFor(brushId) → buildBrushForStroke → buildBrush's `...rest` spread puts `pressureLink` on the Brush that Engine.setBrush receives; the field rides the preset table, never the stroke payload"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/bristles.ts
      via: "the single `bristleContactPressure(clamp(pr, 0, 1), s.speed, s.travelled * this.dh, this.dh, b.pressureLink ?? 1)` call feeds `contactPr` to carrierPass / bristleInk / bristleReliefPass only"
    - from: packages/efx-watercolor/probe/long-stroke/probe.ts
      to: packages/efx-watercolor/src/playground/brushes.ts
      via: "the probe paints brushId 'bristle-round' through the real adapter, so the changed acrylic preset is exercised end-to-end by the recorded evidence"
---

<objective>
Give the acrylic bristle family a per-response `pressureLink` (0..1) that decides how much authored pen pressure enters the reference brush's CONTACT pressure, and set it to 0 on `bristle-flat` and `bristle-round` so the carrier/gather contact gate no longer shuts the deposit off at light pressure.

Purpose: with Dry 0 / Pigment 100 the artist's acrylic stroke still empties within one letter, and the breakup tracks PRESSURE, not speed (probe `long-stroke`, 2026-11-21): paint is present (load 0.71-0.94 left) but nothing deposits at 0.15, and 0.4 dies mid-stroke. `bristleContactPressure` folds the authored pressure into a contact gate whose per-bristle `touchOf` thresholds (0.04-0.92) then block the deposit. Authored pressure must keep owning the footprint WIDTH; only the deposit is freed.

Output: one optional `BrushPreset` field, one defaulted argument on `bristleContactPressure`, one engine argument at the single call site, RED-first pins for the law / the preset table / the call site, and a recorded before/after probe JSON pair proving continuous paint at 0.15 and 0.4 with pressure 1.0 and the Dry-70 control byte-identical.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@packages/efx-watercolor/src/playground/bristles.ts
@packages/efx-watercolor/src/playground/brushes.ts
@packages/efx-watercolor/probe/long-stroke/probe.ts
@packages/efx-watercolor/probe/long-stroke/run.mjs

Do NOT read all of `Engine.ts` (4003 lines): after re-locating the call site with `grep -n "bristleContactPressure" packages/efx-watercolor/src/playground/Engine.ts`, read only the `stamp()` region around it (+/- 80 lines) and the import header. `STATE.md` is not needed for this quick beyond the branch line; `.planning/quick/` is the whole tracking surface here.

Skills to load before implementing: `efx-studio-paint` (the one-law / parity rules — no compositing law moves here) and `spike-findings-efx-motion-editor` (the contact-pressure port and the headless-Chrome measurement harness).

**Project constraints that bind this plan**
- `vitest run` only, never watch; no dev server; no push; commit locally. pnpm, not npm. Artifacts in English.
- The engine change is ONE term. No shader edit, no new uniform, no new pass or target, no change to the radius/size path, the `wet` amount, or the Dry/tank law.
- `pressureLink` is compile-time only, exactly like `BrushPreset.group` (brushes.ts L62-70): no `.mce` field, no serializer, no Rust mirror. A stroke persists the response id and the preset table is the authority at read time. This is ADD-ALONGSIDE (an optional per-preset field whose engine default is the shipped formula), not a promotion of a new default.
- Do not touch `BASE`, `CUSTOM_BASE`, `buildBrush`, `brushBridge.ts`, `mediums.ts`, `shaders.ts`, `params.ts`, or the app.

**Measured anchors at HEAD 6024f7454 (re-read before editing; line numbers drift)**
- `bristles.ts` L258-275: `bristleContactPressure(penPressure, speed, strokeDistPx, docShortPx)` — `pen` finite-guarded + `clamp01`, `speedRamp = smoothstep(0, BRISTLE_PRESSURE_SPEED, v)`, `attackRamp = smoothstep(0, BRISTLE_PRESSURE_ATTACK * docShortPx, d)`, product `mix(SLOW 1, FAST 0.42, speedRamp) · pen · mix(ATTACK_FLOOR 0.45, 1, attackRamp)`. `mix` is declared at L353, `clamp01` at L311 — both already visible to this function at call time.
- `brushes.ts`: `BrushPreset` L14-71 (`group?: MediumId` is the precedent for an optional compile-time-only field); `Brush extends Omit<BrushPreset, 'tip'>` L74 so the field reaches the engine automatically; `BASE` L265-271; `buildBrush` L588-603 returns `{ ...rest, tipSize, tipData, tipMean }` — no change needed for the field to ride; `bristle-flat` L563-570 and `bristle-round` L571-578 (currently no `pressureLink`); `isBristleResponse` L259-261 matches exactly these two ids.
- `Engine.ts` L22 imports `bristleContactPressure`; `stamp()` L2641 binds `const b = this.brush` inside `case 'brush'`; the ONE call site is L2714-2716:
  `const contactPr = bristle ? bristleContactPressure(clamp(pr, 0, 1), s.speed, s.travelled * this.dh, this.dh) : pr;`
  `contactPr` feeds exactly three bristle consumers: `carrierPass`, `bristleInk`, `bristleReliefPass`. `brushRadius` (L2451-2457) keeps reading the authored `pr`.
- `probe/long-stroke/probe.ts` paints one serpentine stroke with `brushId 'bristle-round'`, acrylic record + `dry` override, `load 100`, `water 5`, size 40, sheet 800×600, seeded paper (`0xc0ffee`) and seeded `Math.random`; it imports engine SOURCE (`../../src/playground/Engine`), so the probe needs no dist build. `run.mjs` bundles with esbuild and drives headless Chrome, writing `/tmp/long-stroke/result.json`.

**Measured probe baseline (HEAD 6024f7454, captured twice at planning time with byte-identical output — run-to-run determinism confirmed)**
| p | dry | covered% | load min/mean/max | segments |
|---|---|---|---|---|
| 0.15 | 0 | 0.00 | 0.71/0.85/0.94 | 0 ×12 |
| 0.4 | 0 | 6.83 | 0.67/0.74/0.97 | 165.97 162.31 142.1 76.24 133.34 29.12 0.02 0 0 0 0 0 |
| 0.7 | 0 | 33.40 | 0/0.27/0.88 | 184.07 180.67 187.21 189.12 200.39 193.23 198.3 192.72 142.84 89.15 117.06 66.59 |
| 1.0 | 0 | 57.11 | 0/0.32/0.82 | 171.19 169.32 174.6 184.45 177.36 187 183.74 188.92 192.07 198.26 193.68 199.28 |
| 1.0 | 70 | 33.99 | 0/0.05/0.47 | 171.64 170.86 178.66 192.64 195.86 197.26 181.6 120.98 50.15 24.93 24.9 7.5 |
The 0.7 row is EXPECTED TO MOVE (its authored pen left the gate) and is not gated. The 1.0 rows must not move. The 0.4 "dies mid-stroke" signature is `segments[6] < 1` plus an all-zero tail from index 7 — segment 6 records 0.02, not 0 — with the head `segments.slice(0, 6)` carrying a value > 100. Encode it that way: an all-zero `slice(6)` gate is false at HEAD and can never pass.

**Test conventions to reuse**
- `bristles.test.ts` reads its own source into `SOURCE` and reaches new exports through `import * as bristleModule` + a local cast, so a missing symbol fails as an assertion, never an ESM load error. Extend the existing `describe('bristleContactPressure …')` (L907-962) rather than starting a new suite.
- `brushes.test.ts` already reads `brushes.ts` into a local `source` inside one test and uses `brushesModule as unknown as GroupHelpers` for the same RED-safety reason. Add the preset pins the same way.
- `packages/efx-watercolor/probe/port-comparison/captures/before|after/` is the house convention for recorded probe evidence (tracked, not ignored).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pin the pressure link RED, and capture the pre-change probe evidence</name>
  <files>packages/efx-watercolor/src/playground/bristles.test.ts, packages/efx-watercolor/src/playground/brushes.test.ts, packages/efx-watercolor/probe/long-stroke/captures/before/result.json</files>
  <behavior>
    Written against the CURRENT source. Every bullet marked RED must FAIL after this task; the three bullets marked GUARD pass pre-change (the two argument guards ignore a fifth argument, inert at runtime; the BASE/CUSTOM_BASE absence already holds because the field does not exist yet) — they exist to stay green after the change and carry no RED evidence.

    bristles.test.ts (extend the existing `bristleContactPressure` describe; add `const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')` beside `SOURCE`):
    - `an absent link is the shipped formula, bit for bit` GUARD: for p in {0, 0.15, 0.3, 0.75, 1}, `expect(bristleContactPressure(p, 2, 100, 600, 1)).toBe(bristleContactPressure(p, 2, 100, 600))` (exact `toBe`), and `bristleContactPressure(0.15, 10, 100, 600)` ≈ 0.063.
    - `link 0 takes the authored pen out of the contact gate` RED: `bristleContactPressure(0.15, 10, 100, 600, 0)` ≈ 0.42; `(1, 10, 100, 600, 0)` ≈ 0.42; `(0, 10, 100, 600, 0)` ≈ 0.42.
    - `link 0 keeps the speed ramp` RED: `(0.15, 0, 100, 600, 0)` ≈ 1; `(0.15, 10, 100, 600, 0)` ≈ 0.42; monotone non-increasing over speed {0, 0.35, 0.7, 1.05, 1.4, 4}.
    - `link 0 keeps the attack ramp` RED: `(0.15, 10, 0, 600, 0)` ≈ 0.42 × 0.45; `(0.15, 10, 600 × 0.018, 600, 0)` ≈ 0.42; monotone non-decreasing over distance {0, 3, 6, 10.8}.
    - `the link interpolates between authored and 1` RED: at pen 0.15, speed 10, link 0.5 ≈ 0.42 × 0.575; monotone NON-INCREASING over link {0, 0.25, 0.5, 0.75, 1} (a higher link lets more authored pressure back into the gate, so a light press lowers the contact value; at link 0 it is 0.42, at link 1 it is 0.063).
    - `a non-finite link reads as the shipped 1` GUARD: `bristleContactPressure(0.5, 2, 100, 600, Number.NaN)` is exactly the 4-arg value.
    - `the engine passes the brush's link at its ONE contact-pressure call site` RED: `(ENGINE_SOURCE.match(/bristleContactPressure\s*\(/g) ?? [])` has length 1, and the source matches `/bristleContactPressure\(clamp\(pr, 0, 1\), s\.speed, s\.travelled \* this\.dh, this\.dh, b\.pressureLink \?\? 1\)/`.

    brushes.test.ts (new describe, `pressureLink` read through a local `{ pressureLink?: number }` cast):
    - `only the two acrylic responses state a pressure link` RED: `BRUSH_PRESETS.filter((p) => linkOf(p) !== undefined).map((p) => p.id)` equals `['bristle-flat', 'bristle-round']`, and both values are exactly 0.
    - `buildBrush carries the link` RED: `buildBrush(presetById('bristle-flat')).pressureLink` is 0; `'pressureLink' in buildBrush(presetById('round'))` is false.
    - `BASE and CUSTOM_BASE do not state a link` GUARD: `BASE` is private, so pin it through the existing `readFileSync(resolve(here, 'brushes.ts'), 'utf8')` idiom — locate `const BASE:` and `const define =` (assert both indexes, `baseEnd` after `baseStart`) and assert the window between them does not contain `pressureLink`; then `'pressureLink' in presetById('round')` is false (a `define`-built preset that inherits `BASE`), and `'pressureLink' in CUSTOM_BASE` is false (import `CUSTOM_BASE` from './brushes').
  </behavior>
  <action>
    1. Record the starting commit for the guardrail audit: `git rev-parse HEAD | tee /tmp/umu-start-sha` (also note it for the SUMMARY; do not commit yet). Every later audit diffs against that SHA, so a per-task commit cannot hide a file from the check.
    2. Add the pins exactly as `<behavior>` states. Use the namespace-cast idiom already in each file so a not-yet-exported symbol or missing field fails as a Vitest assertion, not a module/transform error. Name every new `it` so the words `pressureLink` appear (the RED log gate greps for them). Do not touch any production file in this task.
    3. Prove RED: `pnpm --dir packages/efx-watercolor exec vitest run src/playground/bristles.test.ts src/playground/brushes.test.ts > /tmp/umu-red.log 2>&1; grep -q "pressureLink" /tmp/umu-red.log`. Confirm from the log that the pre-existing assertions still pass and only the link-dependent ones fail.
    4. Capture the pre-change evidence. Run `node packages/efx-watercolor/probe/long-stroke/run.mjs` and copy `/tmp/long-stroke/result.json` to `packages/efx-watercolor/probe/long-stroke/captures/before/result.json` (create the directory). Run it a second time and require the two JSON files to be identical (`diff`) — the harness is deterministic on this machine (verified twice at planning time); if they differ, STOP and report the noise floor instead of inventing a tolerance.
    5. Record in the SUMMARY the five baseline rows (pressure, dry, covered, load min/mean/max, segments) and the RED test names.
  </action>
  <verify>
    <automated>node -e "const r=require(process.cwd()+'/packages/efx-watercolor/probe/long-stroke/captures/before/result.json');const c=r.cases;if(c.length!==5)throw new Error('baseline must carry 5 cases');const a=c[0],b=c[1],d=c[3],e=c[4];if(a.pressure!==0.15||a.covered!==0||a.segments.some(s=>s!==0))throw new Error('0.15 baseline signature moved');if(b.pressure!==0.4||!b.segments.slice(0,6).some(s=>s>100)||!(b.segments[6]<1)||!b.segments.slice(7).every(s=>s===0))throw new Error('0.4 baseline signature moved');if(d.pressure!==1||d.dry!==0||d.segments.some(s=>s<=100))throw new Error('1.0 baseline signature moved');if(e.pressure!==1||e.dry!==70||e.segments[e.segments.length-1]>=100)throw new Error('Dry-70 baseline signature moved');console.log('BASELINE OK')" && (pnpm --dir packages/efx-watercolor exec vitest run src/playground/bristles.test.ts src/playground/brushes.test.ts > /tmp/umu-red.log 2>&1 || true) && grep -q "pressureLink" /tmp/umu-red.log</automated>
  </verify>
  <done>
    Both suites carry the new pressure-link pins; running them on the untouched source fails on exactly the link-dependent assertions (RED proven, log kept at /tmp/umu-red.log); `captures/before/result.json` holds the five recorded cases, passes the baseline gate verbatim (`BASELINE OK`, including the 0.4 `segments[6] < 1` + zero tail signature) and is byte-reproducible by a second run; no production file was modified.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add the field, the defaulted link and the one engine argument</name>
  <files>packages/efx-watercolor/src/playground/brushes.ts, packages/efx-watercolor/src/playground/bristles.ts, packages/efx-watercolor/src/playground/Engine.ts</files>
  <action>
    **1. `brushes.ts` — the field and the two presets.** On `BrushPreset` (after `group`, using the same compile-time-only doc style): `pressureLink?: number;` documented as 0..1, "how much the authored pen pressure enters the bristle CONTACT pressure (carrier + gather). 1 = the shipped law; 0 = the contact gate is independent of authored pressure while the speed and attack ramps still apply. The authored pressure still owns the footprint/radius. Absent reads as 1. Compile-time only like `group`: no serializer, no `.mce` field — a stroke persists the response id and this table is the authority at read time." Set `pressureLink: 0` on `bristle-flat` and `bristle-round` (the acrylic family) and nowhere else. Do not touch `BASE`, `CUSTOM_BASE` or `buildBrush` — its `...rest` spread already carries the field.

    **2. `bristles.ts` — the law.** `bristleContactPressure` gains a fifth parameter `pressureLink = 1`. Derive `const link = Number.isFinite(pressureLink) ? clamp01(pressureLink) : 1;` (a non-finite link reads as the shipped 1, matching the module's never-NaN contract) and replace the existing `pen` binding with the specified blend of the already-guarded authored pressure `authored` toward 1: `const pen = authored + (1 - authored) * (1 - link);` — algebraically `mix(1, authored, link)`, associated this way so `link === 1` returns `authored` EXACTLY (the `(1 - link)` factor is 0 and `authored + 0 === authored`). Keep `speedRamp`, `attackRamp` and the returning product byte-for-byte; do not introduce a second copy of any constant. Update the function's JSDoc to name the argument and its contract, and note that at link 0 a light press thins the mark through the footprint, not through the gate.

    **3. `Engine.ts` — the one call site.** In `stamp()`'s `contactPr` expression (the only `bristleContactPressure` call in the file) append `, b.pressureLink ?? 1` after `this.dh`. Change nothing else: the authored `pr` keeps feeding `wet`, the radius (`brushRadius`), the non-bristle branches and every `pr`-shaped term outside `contactPr`; no shader file, uniform, pass or target is touched. Extend the existing comment by one line stating that a response's link decides how much authored pressure reaches the gate.

    **4. Green.** Run the package suite. If a pin still fails, fix the source — never the pin — unless the pin contradicts the brief, in which case stop and report.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run</automated>
  </verify>
  <done>
    All 38 package suites pass (the two new pin blocks included); `bristleContactPressure(p, s, d, short, 1)` is exactly the 4-arg value; at link 0 the pen factor is gone while speed and attack still shape the result; `BRUSH_PRESETS` states the field on exactly the two acrylic responses; the engine's single call site passes `b.pressureLink ?? 1`; against the SHA recorded in Task 1, `git diff --name-only <start-sha> -- packages/efx-watercolor/src` lists exactly `Engine.ts`, `bristles.ts`, `bristles.test.ts`, `brushes.ts`, `brushes.test.ts` — no shader, medium, params, bake or adapter file.
  </done>
</task>

<task type="auto">
  <name>Task 3: Record the after-probe, gate the pixels, rebuild and run the app suite</name>
  <files>packages/efx-watercolor/probe/long-stroke/captures/after/result.json</files>
  <action>
    1. Re-run the probe (`node packages/efx-watercolor/probe/long-stroke/run.mjs`) and copy `/tmp/long-stroke/result.json` to `packages/efx-watercolor/probe/long-stroke/captures/after/result.json`. The probe imports engine source, so no build is needed for this step.
    2. Apply the pixel gate below and read the five rows. Expected: 0.15 and 0.4 are continuous with covered% > 0 and strictly below the 1.0 covered%; 0.7 moves (its pen left the gate); the two 1.0 rows are byte-identical to `captures/before/result.json`.
    3. Rebuild the package the app consumes: `pnpm --dir packages/efx-watercolor build` (app tests resolve `@efxlab/efx-watercolor` through its `exports` to `dist/*.mjs`; a stale build hides the change).
    4. Run the app's physic-paint tree: `pnpm --dir app exec vitest run src/components/physic-paint` (green at planning time: 280 files / 7042 tests).
    5. If pressure 1.0 or the Dry-70 control moved: STOP. That is a regression of the shipped path (or the Dry law), not a tuning opportunity — do not relax the gate, do not adjust tolerances, report the diff.
    6. Record in the SUMMARY: the before/after table, the JSON paths, and the explicit statement that no Dry/tank term (`dryDistance`, `loadFactor`, `uDepletion`), no `touchOf` threshold, no speed/attack term and no radius/wet pass changed.
  </action>
  <verify>
    <automated>node -e "const a=require(process.cwd()+'/packages/efx-watercolor/probe/long-stroke/captures/after/result.json');const b=require(process.cwd()+'/packages/efx-watercolor/probe/long-stroke/captures/before/result.json');const pick=(r,p,d)=>{const c=r.cases.find(x=>x.pressure===p&&x.dry===d);if(!c)throw new Error('missing case '+p+'/'+d);return c};const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);if(!eq(pick(a,1,0),pick(b,1,0)))throw new Error('pressure 1.0 moved: '+(JSON.stringify(pick(a,1,0))));if(!eq(pick(a,1,70),pick(b,1,70)))throw new Error('Dry 70 moved: '+(JSON.stringify(pick(a,1,70))));for(const p of [0.15,0.4]){const c=pick(a,p,0);if(!(c.covered>0))throw new Error('covered 0 at pressure '+p);const dead=c.segments.filter(s=>s<=1);if(dead.length)throw new Error('segments die at pressure '+p+': '+c.segments.join(' '));}if(!(pick(a,0.15,0).covered<pick(a,1,0).covered))throw new Error('0.15 is not thinner than 1.0');if(!(pick(a,0.4,0).covered<pick(a,1,0).covered))throw new Error('0.4 is not thinner than 1.0');console.log('PROBE GATE OK')" && pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint</automated>
  </verify>
  <done>
    `captures/after/result.json` records continuous paint at 0.15 and 0.4 (every segment > 1, covered > 0, both thinner than 1.0); pressure 1.0 and the Dry-70 control are exactly equal to the pre-change capture; the package dist is rebuilt and the 280-file app physic-paint suite is green; the SUMMARY carries the before/after table and the untouched-law statement.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| preset table → engine stamp | `pressureLink` is authored code on a built-in response (no user input, no payload). A wrong value changes the look of the acrylic family only. |
| engine CPU scalar → GPU uniforms | `contactPr` is an existing scalar bound as a uniform; this change adds no uniform, no shader edit and no new render target. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-UMU-01 | Tampering | `bristleContactPressure` pen term | medium | mitigate | The link is clamped to 0..1 and a non-finite link reads as the shipped 1, so no caller can inject NaN into the bounded contact scalar; pinned by an exact-equality test on the non-finite path. |
| T-UMU-02 | Tampering | shipped look of every non-acrylic response | medium | mitigate | An absent field means link 1 (bit-identical arithmetic, `toBe`-pinned), only the two acrylic presets state 0, and the probe's pressure-1.0 and Dry-70 cases must equal the pre-change capture exactly — a move is a STOP, not a tolerance. |
| T-UMU-03 | Denial of service | probe harness (`run.mjs`) | low | accept | Local scratch harness; a failed run exits non-zero and writes only to `/tmp/long-stroke` and the captures directory. No network, no server. |
| T-UMU-SC | Tampering | package installs | low | accept | No package is installed in this task — no `package.json`, lockfile or install command is touched, so no legitimacy checkpoint is required. |
</threat_model>

<verification>
- Package gate: `pnpm --dir packages/efx-watercolor exec vitest run` (green at planning time: 38 files, 849 passing / 8 skipped).
- App gate after a fresh build: `pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint` (green at planning time: 280 files, 7042 tests).
- Pixel gate: the Task 3 node gate over `captures/after/result.json` vs `captures/before/result.json` (continuity at 0.15/0.4, exact identity at 1.0 and 1.0+Dry 70, thinness ordering).
- Source pins: exactly one `bristleContactPressure(` call in `Engine.ts`, passing `b.pressureLink ?? 1`; `BRUSH_PRESETS` states `pressureLink` on exactly the two acrylic ids.
- Guardrail audit against the SHA recorded in Task 1 — run once at the end, over the whole quick: `git diff --name-only "$(cat /tmp/umu-start-sha)" -- packages/efx-watercolor/src` must list exactly `playground/Engine.ts`, `playground/bristles.ts`, `playground/bristles.test.ts`, `playground/brushes.ts`, `playground/brushes.test.ts`. `shaders.ts`, `mediums.ts`, `params.ts`, the bake and adapter trees, and every app file must be untouched. Record the command and its output in the SUMMARY; a stale or missing SHA file is a visible failure, never an assumed pass.
- No push, no dev server, no watch mode; the artist runs the native UAT.
</verification>

<success_criteria>
- 0.15 and 0.4 paint continuously on the acrylic bag (Dry 0, Pigment 100) — every sampled segment > 1 and covered% > 0 — while remaining thinner than the 1.0 line (authored pressure still owns width).
- Pressure 1.0 is bit-identical to the pre-change capture; the Dry-70 control still fades mid-stroke; the 0.7 row moves as expected and is un-gated.
- `pressureLink` exists only on `bristle-flat` and `bristle-round` (both 0); an absent field reproduces the shipped formula exactly; `buildBrush` and `brushBridge` carry it with no new code and no payload/serializer change.
- One engine term: one call site, no shader/uniform/pass/target/radius/wet/Dry/touchOf change.
- Both suites green, the two probe captures committed, the SUMMARY records the before/after table, the RED evidence, and the automated-ready UAT rows (a) very light press = thinner but continuous line, (b) full press unchanged, (c) a fast gesture still thins, (d) Dry 70 still fades a long stroke.
- Local commit(s) only; nothing pushed.
</success_criteria>

<output>
Create `.planning/quick/261121-umu-task-decouple-the-acrylic-bristle-deposi/261121-umu-SUMMARY.md` when done, with (a) the five-case before/after probe table and both JSON paths, (b) the RED evidence (which new pins failed on the untouched source and why), (c) the explicit untouched-law statement (Dry/tank `dryDistance`/`loadFactor`/`uDepletion`, `touchOf`, speed/attack, radius/wet passes, no shader edit, one call site), (d) the guardrail audit against the starting SHA, and (e) the four UAT rows marked automated-ready — never "done".
</output>
