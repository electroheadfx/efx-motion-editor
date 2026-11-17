# Quick Task 261117-tq7: Cover pass erases pre-stroke wet ink and the cached base — Research

**Researched:** 2026-11-17
**Domain:** efx-watercolor WebGL2 engine (`packages/efx-watercolor/src/playground`) + Studio aquarelle cache seam (`app/src/components/physic-paint`)
**Confidence:** HIGH on engine mechanics and cache-seam locations; MEDIUM on `FUNC_REVERSE_SUBTRACT` acceptance on the packaged WKWebView (chosen blend mode is new to the tree).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**preInk snapshot extent**
- **Full document, always.** Two RGBA16F attachments at document size, lazily
  allocated only for a covering Brush stroke, disposed at stroke end, `clear()`,
  history travel and resize.
- Rationale: the engine caps the sheet at `MAX_DOC_LONG = 3072` and
  `MAX_DOC_PIXELS = 4_200_000` (`Engine.ts:267-268`), so the worst case is
  ~67 MB and it exists only for the duration of a covering stroke. Correctness
  beats the memory: the stroke can travel anywhere, so a clip would under-erase.
- No clipping, no threshold, no second size-dependent code path.

**Wet-ink fallback**
- **Ship the ink cover and record the advection limitation.** `preInk` does not
  follow the fluid flow, so the subtraction is exact at snapshot positions and
  approximate after diffusion. If UAT shows over- or under-removal, keep the ink
  path and record the limitation rather than dropping to cached-base-only.
- No scope reduction to the cached base is pre-authorized; that would be a
  follow-up decision, not a silent fallback.

**Cooked-frame authority (double erase)**
- **Mirror the Lift seam: the engine always emits, the Studio gates.** The engine
  emits one `onCoverDab` per cover draw with no display knowledge; the Studio
  resolves once per stroke whether a cached display needs the punch, exactly as
  `planAquarelleLiftErase` does for lift today.
- The cached-base layer stays a dumb sink: it punches what it is given.

**Bake seam depth**
- **The authoritative bake must land in this quick task.** UAT rows 3
  (leave/reopen) and 7 (export) cannot pass without it, so it is in scope with no
  deferral option. If the bake investigation reveals an unexpectedly large
  refactor, stop and report before writing speculative code.

### Claude's Discretion
- Exact shape of the cover-capable sink (extend `AquarelleLiftPreviewSink` with a
  `kind: 'lift' | 'cover'` discriminator vs a sibling bridge) — whichever keeps
  the existing lift contract and its contract tests intact with the least
  disruption.
- How the `core` profile is expressed in `buildLiftCoverage` (new profile value
  vs a shape flag), provided the Lift's tip-shaped erase is untouched.
- Whether the ink subtraction lives in a new `inkCoverFS` program or reuses
  `liftFS` with different blending — provided Law 1's uniforms and profile are
  unchanged.

### Deferred Ideas (OUT OF SCOPE)

None recorded in CONTEXT.md. The spec's Non-goals remain out of scope: the KM-over-fond composite `R + T²·fond/(1 − R·fond)`, raising `SCATTERING_MAX`, changing `Body`'s curve / `COVER_GAIN`, any emboss/relief change, a per-stroke opacity control, a new tool, or new UI.

## Summary

All fifteen focus questions are answered from the tree at HEAD `fe4b2531e`. The engine work is bounded: a document-size `Target` mirroring `this.fixed` (two RGBA16F attachments), a `GL.blit` snapshot inside `processInput`'s `if (!s.started)` branch, and one extra draw per cover dab into `this.ink.read` with a reverse-subtract equation. The existing `gl.blit` path is already proven on RGBA16F by `resizeDocument` and `trimActive`/`sleep`, so no copy shader is needed. Float16 blending already ships (`brushInk` blends `ONE, ONE` into `ink.read`); only the blend *equation* (`FUNC_REVERSE_SUBTRACT`) is new, and `EXT_float_blend` is not a blocker because it governs 32-bit float buffers only.

The cached-base work reuses intact primitives — `buildLiftCoverage`, `punchTransmittanceRgba`/`Canvas`/`Bytes`, `DEFAULT_LIFT_ERASE_CODEC` — but the transaction around them (plan, refusals, durable-base pin/recovery, merge-base pin, drift checks, commit retries) is Lift-specific and lives in `runAquarelleLiftErase`. The frame bake needs no new plumbing for script paint: recorded strokes replay through `scriptBegin/scriptMove/scriptEnd` → `tick` → `processInput` → `stamp` → `coverPass`, and `toEngineParams` maps `body`. What the bake cannot recreate is the durable pre-script raster, which needs the same explicit punch the Lift path already performs.

**Primary recommendation:** mirror `this.fixed` for `preInk`; snapshot with `GL.blit`; add a dedicated `inkCoverFS` (samples the two `preInk` attachments, outputs `preInk * coreMask`) drawn into `ink.read` with `blendEquation(FUNC_REVERSE_SUBTRACT)` + `blendFunc(ONE, ONE)` from a separate `inkCover` method called in the `eachDab` callback (not inside `coverPass`, whose source-scan pin forbids `this.ink`); emit `onCoverDab` from `coverPass`; extend `AquarelleLiftPreviewSink` with a `kind: 'lift' | 'cover'` discriminator and add a `core` coverage profile to `buildLiftCoverage`; route the authoritative punch/bake through the same `runAquarelleLiftErase` transaction shape.

## Project Constraints (from CLAUDE.md)

- Do not run the server; the user drives the app live.
- Use `vitest run` (never Vitest watch). Use pnpm (not npm).
- Preact + `@preact/signals` only; consult `efx-preact-reactivity` before touching any component, hook, effect, store setter or signal subscription. Never apply React patterns by default.
- GSD artifacts in English. Beads (`bd`) owns task state; do not use TodoWrite/markdown TODO lists.
- Conservative git profile: do not commit or push unless explicitly asked (no push, ever).
- Git index-lock recovery: `lsof` first, remove only a stale `.git/index.lock`.

## Answers at a glance

| # | One-line answer | Evidence |
|---|---|---|
| A1 | `preInk` = one `g.target(dw, dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR)` mirroring `this.fixed`; free with `g.disposeTarget` | `Engine.ts:504-505`; `gl.ts:84-118`, `251-255` |
| A2 | Snapshot with `GL.blit` per attachment — no new copy shader; already proven on RGBA16F by resize/trim | `gl.ts:184-191`; `Engine.ts:590-596`, `2615-2616` |
| A3 | 16F blending already ships; `EXT_float_blend` is 32-bit-only; `FUNC_REVERSE_SUBTRACT` is new but core state | `Engine.ts:2242-2245`, `415-416`; Khronos registry |
| A4 | Dispose at stroke end, abort, travel, clear, resetSheet, resize, createDocument, destroy (8 sites) | see Group A4 |
| A5 | Snapshot in `if (!s.started)` before the first `stampScripted`; one end seam serves live and script | `Engine.ts:1926-1941`, `1979-1986` |
| A6 | Law 6 holds: per-stamp `touch(coverRect)` saves pre-dab ink tiles, so the subtraction is inside the stroke's undo step | `Engine.ts:2093-2100`, `2325-2343`; `history.ts:127-145` |
| B7 | Punch primitives are generic; the transaction is Lift-specific and lives in `runAquarelleLiftErase` | `aquarelleLiftErase.ts:456`, `576`; `PhysicsPaintStudio.tsx:8164`, `8789` |
| B8 | Bake replays through `processInput`, so the ink cover lands automatically; the durable base still needs an explicit punch | `engineAdapter.ts:385-406`, `310`; `params.ts:135`; `PhysicsPaintStudio.tsx:8737-8771` |
| B9 | `planAquarelleLiftErase` = `normal`/`refuse`/`erase`; preview is active iff `kind === 'erase'` | `PhysicsPaintStudio.tsx:398-414`, `7905-7959`, `7981` |
| B10 | Brush strokes record once with `params` (incl. body); `onCoverDab` must stay a preview-only callback | `AquarelleCanvasLayer.tsx:645-681`; `PhysicsPaintStudio.tsx:9057` |
| C11 | Source-scan conventions; `coverPass` is pinned to contain no `this.ink` — put the ink draw in its own method | `coverage.test.ts:37-63`, `143-158` |
| C12 | Gate = 3 digests + byteLength + width + height; probe fixes after EVERY stroke; no cached-base staging | `compare.mjs:53-54`; `probe.ts:301-306`, `283` |
| C13 | `vitest run` only; app `test` script is watch-mode and forbidden | `packages/efx-watercolor/package.json:63`; `app/package.json:11` |
| D14 | No measured punch-cost baseline; documented commit latency ~1.5 s | `aquarelleLiftPreview.ts:7-8`; `compare.mjs:90-96` |
| D15 | Two stale anchors (COVER_GAIN at 178 not 173; coverAmount at 2079 not 2088-2103); sim clamps only the scattering channel | `Engine.ts:178`, `2079`; `shaders.ts:282-284` |

---

## Group A — Engine mechanics

### A1. Target / DoubleTarget allocation and disposal idiom

`allocateTargets()` is the one allocation site for document-sized layers (`[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:496-513]`):

```ts
this.ink = g.double(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
this.fixed = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
this.wet = g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
this.relief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
```

`g.target` creates one FBO, `texStorage2D`s each format, attaches `COLOR_ATTACHMENT0 + i`, calls `gl.drawBuffers(...)`, and registers a disposer (`[VERIFIED: packages/efx-watercolor/src/playground/gl.ts:84-118]`). `Target.views` are single-attachment FBOs for blits (`[VERIFIED: gl.ts:22-29, 104-109]`).

**Shape:** `preInk` is a single `Target` (not a `DoubleTarget`) — nothing ping-pongs it. Attachment 0 is the spectral basis vector `A` (signed, `[VERIFIED: shaders.ts:282-284]`), attachment 1 is `B` (`rgb` coefficients + scattering `a`). Full screen is `gl.LINEAR` for `fixed`/`ink`; either filter works for a read-only snapshot, but matching `this.fixed` is the least-surprise choice.

**Disposal:** `g.disposeTarget(t)` frees one target now (`[VERIFIED: gl.ts:251-255]`). `g.disposeTargets()` frees everything (`[VERIFIED: gl.ts:257-261]`) and is called by `createDocument` (`[VERIFIED: Engine.ts:537]`) and `destroy` (`[VERIFIED: Engine.ts:1680]`) — after either, the JS field must be nulled or it references dead GL objects.

`docTargets()` enumerates what resize frees and copies (`[VERIFIED: Engine.ts:526-529]`; list ends `... this.wetMask, this.relief]`) and does **not** know about `preInk`. `resizeDocument` snapshots `old = { targets: this.docTargets(), ... }` then disposes only `old.targets` (`[VERIFIED: Engine.ts:582, 597]`), so `preInk` must be disposed explicitly there (it is stroke-scoped, and resize already sets `this.stroke = null` at `[VERIFIED: Engine.ts:574]`).

**Memory:** the cap is `MAX_DOC_LONG = 3072` / `MAX_DOC_PIXELS = 4_200_000` (`[VERIFIED: Engine.ts:267-268]`). 4.2 M px × 2 attachments × 8 B (RGBA16F) = **67.2 MB**, matching the CONTEXT's ~67 MB. `clampDocSize` (285-290) enforces it.

### A2. Snapshotting `ink.read`

**Use `GL.blit` — no new copy shader.** `gl.blit(src, sx, sy, dst, dx, dy, w, h)` copies rectangles between same-format single-attachment FBOs (`[VERIFIED: gl.ts:184-191]`), and it is already used on RGBA16F:

- `resizeDocument`'s `copy(old.ink, [this.ink.read, this.ink.write])` (`[VERIFIED: Engine.ts:590-596]`).
- `trimActive`/`sleep`'s read→write sync for `ink`/`wet` (`[VERIFIED: Engine.ts:2615-2616, 2626-2627]`).

Snapshot per attachment:

```ts
this.ink.read.views.forEach((v, i) =>
  this.g.blit(v, 0, 0, this.preInk!.views[i], 0, 0, this.dw, this.dh));
```

`ink.write` must not be sampled: `brushInk` writes into `ink.read` and the advect pass writes into `ink.write` then swaps, so `read` is the authoritative half at any tick (`[VERIFIED: Engine.ts:2245, 2559-2573]`). Snapshotting only `read` is symmetric with the deposit path.

### A3. Float blending, `FUNC_REVERSE_SUBTRACT`, `EXT_float_blend`

- **Float16 blending already ships.** `brushInk` binds `FUNC_ADD` + `blendFunc(ONE, ONE)` and draws the stamp program into `this.ink.read` (two RGBA16F attachments) (`[VERIFIED: Engine.ts:2239-2247]`). The whole pigment stack depends on it.
- **`EXT_float_blend` is not required here.** Per Khronos, the extension lifts the `INVALID_OPERATION` "when blending is enabled and the draw buffer has **32-bit** floating-point components"; it "applies to both WebGL 1.0 and 2.0 contexts" (`[CITED: registry.khronos.org/webgl/extensions/EXT_float_blend]`). `EXT_color_buffer_float` makes `RGBA16F` color-renderable (`[CITED: registry.khronos.org/webgl/extensions/EXT_color_buffer_float]`). The engine requires either `EXT_color_buffer_float` or `EXT_color_buffer_half_float` and never requests `EXT_float_blend` (`[VERIFIED: Engine.ts:415-416]`; grep over `packages/efx-watercolor/src` + `app/src` returns zero hits).
- **`FUNC_REVERSE_SUBTRACT` is new to the tree** (grep: zero hits). It is core WebGL2 blend state, not extension-gated, and the only format carve-out is the 32F one above. Confidence MEDIUM: `brushInk` proves additive 16F blending, but not this equation. Cheap validation: after the first subtract draw, run `gl.getError()` once, or capture one probe run through the new path (the probe harness is available — see C12).

**Blend state for the subtraction:** `blendEquation(FUNC_REVERSE_SUBTRACT)` + `blendFunc(ONE, ONE)` → `dst − src`. The fragment shader supplies `src = preInk * f`, so the result is `ink − preInk·f` per channel. `liftFS` already declares two outputs (`layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;`) (`[VERIFIED: shaders.ts:307-309]`), so a two-attachment program is the established shape — but the *source* must be `preInk`, not the mask, hence a new program (`inkCoverFS`) or an added `preInk` sampler path; reusing `liftFS` unchanged cannot express "subtract the snapshot's values".

**Signed coefficients:** the sim clamps only `b.a` (`oB = vec4((b + dB).rgb, max(b.a + dB.a, 0.0)) * uKeep;`) and explicitly does not clamp `A` ("no clamping: basis coefficients are signed") (`[VERIFIED: shaders.ts:282-284]`). Over-subtraction (advection moved ink out of the pixel since the snapshot) therefore leaves negative basis coefficients; the display clamps at the sRGB conversion (`c = clamp(c, 0.0, 1.0)` in `toSRGB`, `[VERIFIED: shaders.ts:589-593]`). This is the accepted advection limitation from the locked decision, not a defect to fix here.

### A4. Lifecycle hooks — every place `preInk` must be disposed

All sites are verified at HEAD; each already clears `this.stroke`:

| Site | Line | Evidence |
|---|---|---|
| Stroke end | `processInput` `if (s.ending) { this.stroke = null; ... }` | `[VERIFIED: Engine.ts:1979-1986]` |
| Abort | `abortStroke()` `this.stroke = null` | `[VERIFIED: Engine.ts:1547-1555]` |
| History travel | `travel()` `this.stroke = null` (undo/redo/`jumpTo`/`cancelAutoFix` all route here) | `[VERIFIED: Engine.ts:1574-1584]` |
| Clear | `clear()` `this.stroke = null` | `[VERIFIED: Engine.ts:1510-1524]` |
| Reset sheet | `resetSheet()` `this.stroke = null` | `[VERIFIED: Engine.ts:1536-1544]` |
| Resize | `resizeDocument()` `this.stroke = null`; old targets exclude `preInk` | `[VERIFIED: Engine.ts:570-618, 582, 597]` |
| New document | `createDocument()` → `g.disposeTargets()` | `[VERIFIED: Engine.ts:532-549, 537]` |
| Destroy | `destroy()` → `g.disposeTargets()` | `[VERIFIED: Engine.ts:1672-1681, 1680]` |

Note `scriptEnd()` does not clear the stroke — it sets `ending = true` (`[VERIFIED: Engine.ts:1018-1022]`), and the disposal happens on the next `processInput` through the `s.ending` branch. A single private `dropPreInk()` called from those nine places is the low-risk shape.

### A5. Stroke-start and stroke-end seams

`processInput` (`[VERIFIED: Engine.ts:1916-1987]`):

```ts
const startedThisTick = !s.started;            // 1926
...
if (!s.started) {                              // 1931
  s.started = true;
  ...
  this.stampScripted(s, q.x, q.y, s.pr, 0, 0, 1, 0, q.w, 1);   // 1940
  continue;
}
```

The snapshot belongs immediately after `if (!s.started) {` and **before line 1940**. Guards: `s.tool === 'brush'`, `Math.min(1, bodyCurve(P.body) * COVER_GAIN) > 0`, and `this.preInk === null`.

Both stroke sources converge here: live pointer strokes and `scriptBegin` (`[VERIFIED: Engine.ts:991-1008]`) queue their first sample and run the same `processInput`. The bake is a scripted feed, so the snapshot runs once per replayed stroke.

Stroke end: the `s.ending` branch clears `this.stroke`, restores the pigment and fires the live callbacks only for non-script pointers (`[VERIFIED: Engine.ts:1979-1986]`). Scripted bakes therefore have no stroke-end callback — disposal must not depend on `onStrokeEnd`.

`fix()`/`cancelAutoFix()` do not end the stroke (`[VERIFIED: Engine.ts:1482-1507]`), so `preInk` survives a mid-stroke Dry — correct, since the snapshot is pre-stroke by definition.

### A6. Law 6 — is the subtraction inside the stroke's undo step?

**Yes, verified structurally.**

- `touch()` calls `this.history.protect(0, rect ± PROTECT_MARGIN, this.snapshotLayers())` (`[VERIFIED: Engine.ts:2325-2337]`), and `snapshotLayers()` is `[this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0]]` (`[VERIFIED: Engine.ts:2339-2343]`).
- Per stamp, before the first dab: `const coverRect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2); this.touch(coverRect);` then `this.history.protect(1, ..., this.fixed.views)` (`[VERIFIED: Engine.ts:2093-2100]`).
- `History.protect` copies current tile content into the atlas, only while recording, and only for tiles not yet saved this step (`[VERIFIED: packages/efx-watercolor/src/playground/history.ts:127-145]`). The first save for any tile in a stroke therefore captures the stroke's pre-state — which for the first stamp equals `preInk`.

`coverRect` extent 2 with `r*(1 + sizeJitter + scatter)` covers `brushInk`'s `stampRect(..., 1.5)` (`[VERIFIED: Engine.ts:2241]`) and the cover draw's own `stampRect(..., 2)` (`[VERIFIED: Engine.ts:2287]`), so a subtract drawn into `ink.read` is captured by that protection regardless of its position inside the `eachDab` callback. `preInk` itself must stay out of `snapshotLayers()` — it is transient and the locked decision forbids it in the undo layers.

## Group B — Cached-base seam

### B7. Lift punch/commit path and what is reusable

**Chain (all verified):** `onLiftDab` declared on `EngineCallbacks` (`[VERIFIED: Engine.ts:120]`), emitted after the last draw of `lift()` (`[VERIFIED: Engine.ts:2446]`) → `AquarelleCanvasLayer`'s engine callback forwards it (`[VERIFIED: AquarelleCanvasLayer.tsx:625-627]`) → `PhysicsPaintCanvasMount`'s prop forwarder (`[VERIFIED: PhysicsPaintCanvasMount.tsx:230]`) → Studio `handleAquarelleLiftDab` pushes to `aquarelleLiftGestureDabsRef` and pushes the preview dab (`[VERIFIED: PhysicsPaintStudio.tsx:7972-7991]`) → stroke end dispatches `runAquarelleLiftErase` (`[VERIFIED: PhysicsPaintStudio.tsx:9066]`).

**Punch primitives (generic, reusable verbatim):**
- `buildLiftCoverage(dabs, width, height, shape?)` multiplies `coverage[index] *= 1 - f` (`[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:352-435, 429]`).
- `punchTransmittanceRgba` applies `t' = t^K` per colour channel in linear light, alpha untouched (`[VERIFIED: aquarelleLiftErase.ts:452-486]`).
- `punchTransmittanceCanvas` / `punchTransmittanceBytes` with `DEFAULT_LIFT_ERASE_CODEC` (decode WebP → punch → encode WebP) (`[VERIFIED: aquarelleLiftErase.ts:498-530, 566-569, 571-602]`).
- `MAX_LIFT_DABS = 50_000` is the dab guard (`[VERIFIED: aquarelleLiftErase.ts:60]`).

**Transaction (Lift-specific, ~700 lines):** `runAquarelleLiftErase` (`[VERIFIED: PhysicsPaintStudio.tsx:8164]`) owns in-flight/pending queueing, `stillOnEditTarget` drift checks, eager sheet snapshot, preview revert on failure, durable-base pin/recovery, merge-base pinning, commit retries and the `captureLivePixels` commits (`[VERIFIED: PhysicsPaintStudio.tsx:8575-8814]`). The preview only holds the visual until "the authoritative punch/bake still commits at stroke end" (`[VERIFIED: aquarelleLiftPreview.ts:10-16]`).

**Recommendation:** parameterize that transaction on `kind: 'lift' | 'cover'` rather than duplicating it. The alternative (a sibling transaction) doubles the drift/refusal logic that the codebase already treats as load-bearing (the contract tests count literals — see C11 note). This is a planning decision, not a researched constraint.

### B8. Does the frame bake replay go through `processInput`/`stampScripted`?

**Yes.** The bake constructs an adapter around `new WatercolorEngine(...)` and drives it deterministically (`[VERIFIED: packages/efx-watercolor/src/adapter/engineAdapter.ts:236-250]`). Each due sample: `engine.scriptBegin(asTool(...), p.x, p.y, p.p, 'Stroke', undefined, p.tx, p.ty, widthFactor, samplePigment)` for the first sample, `engine.scriptMove(...)` afterwards, then `engine.tick(HOST_DT)` (`[VERIFIED: engineAdapter.ts:379-403]`). `tick` runs `this.processInput(dt)` (`[VERIFIED: Engine.ts:1059-1061]`), which reaches `stampScripted` → `stamp` → `coverPass`.

**`body` reaches the bake engine:** `configure()` calls `engine.setParams(toEngineParams(payload.params))` (`[VERIFIED: engineAdapter.ts:310]`), and `toEngineParams` maps `body: clamp01(num(p.body, d.body) / 100)` (`[VERIFIED: packages/efx-watercolor/src/playground/params.ts:135]`). So adding the ink-cover step to the engine automatically makes every replay produce the covered sheet for **script** paint.

**What the bake cannot recreate — the durable base.** `recordAquarelleOrdinaryDurableBaseRef` pins the key's PRE-SCRIPT raster before the first recorded stroke (`[VERIFIED: PhysicsPaintStudio.tsx:9007-9009]`), and `runAquarelleLiftErase` punches it explicitly, re-punching the key payload and rewriting `baseCanvas` in the commit (`[VERIFIED: PhysicsPaintStudio.tsx:8736-8798]`). A covering stroke on a scripted key needs both: the bake covers the script paint, and the transaction punches the durable base. Without the punch, reopening resurrects the pre-cover base under the covered sheet.

**Merge law on commit:** the automatic settle capture pins the base per (track, frame) "as of SHEET START" and merges the live sheet with `mergeBlend: 'pigment-alpha'` (`[VERIFIED: PhysicsPaintStudio.tsx:10119-10123, 10145-10157]`). Base and live sheet hold disjoint paint (base = committed raster before this session's strokes), so erasing both is not a double erase of the same pigment — it is the only way the committed bytes and the reopened view agree.

### B9. `planAquarelleLiftErase` signature and active condition

```ts
type AquarelleLiftErasePlan =
  | { kind: 'normal' }
  | { kind: 'refuse'; message: string }
  | { kind: 'erase'; frame: number; trackId: string; keyId: string;
      scripted: boolean; willPinBase: boolean; recoverBase: boolean };
```
(`[VERIFIED: PhysicsPaintStudio.tsx:398-414]`)

`planAquarelleLiftErase(frame)` (`[VERIFIED: PhysicsPaintStudio.tsx:7905-7959]`) returns:
- `normal` — no launch / no track / no document / **empty frame** / no raster-backed display while the sheet has paint (the live sheet already shows the erase) (`[VERIFIED: PhysicsPaintStudio.tsx:7907-7915, 7932-7936]`);
- `refuse` — group frames, Script OFF with an existing script, no cache with an empty sheet (`[VERIFIED: PhysicsPaintStudio.tsx:7916, 7927, 7935]`);
- `erase` — ordinary key with a raster-backed display; `recoverBase: true` when a script exists but the durable base is unknown (`[VERIFIED: PhysicsPaintStudio.tsx:7947-7958]`).

The preview is active iff `planAquarelleLiftErase(frame).kind === 'erase'`, resolved once per stroke and memoized in `aquarelleLiftPreviewPlanRef` (`[VERIFIED: PhysicsPaintStudio.tsx:7964, 7976-7984]`). A cover plan should mirror these conditions; the gesture kind (brush with `coverAmount > 0`) selects the transaction, not different plan rules.

### B10. Brush stroke recording and the no-new-event-type constraint

- Brush strokes record once at stroke end: `recordAquarelleStrokeWhenEnabled(recordsScript, mutationId, { ...stroke, mutationId }, capturedKeyId)` (`[VERIFIED: PhysicsPaintStudio.tsx:9057]`), with `recordsScript = scriptRecordingOn && (stroke.tool !== 'lift' || liftIsScriptOwned)` (`[VERIFIED: PhysicsPaintStudio.tsx:9003]`).
- The recorded literal carries `params: { ...snap.params }` (`[VERIFIED: AquarelleCanvasLayer.tsx:645-681, 654]`), so `body` is already persisted; a bake re-derives the cover from it with no new event type and no payload change.
- `onCoverDab` is preview-only, mirroring `onLiftDab`: the engine emits per draw, the layer forwards, the mount forwards, the Studio gates. It must never enter the recorded events (the stroke schema stays untouched), and it must not fire when `coverAmount === 0` (Law 4).
- Comment at `[VERIFIED: AquarelleCanvasLayer.tsx:686-688]`: "CACHE WRITE (settle) owns the commit — a stroke-end capture would land the WET (washed) sheet." The cover must not add a stroke-end capture.

## Group C — Tests, probe and commands

### C11. `coverage.test.ts` conventions and the pin that constrains placement

Conventions (`[VERIFIED: packages/efx-watercolor/src/playground/coverage.test.ts:1-63]`):
- Source-scan only — "vitest has no WebGL2, so no draw can be read back here; the byte-level proof ... lives in probe/medium-engine" (header 1-25).
- `sliceBetween(source, startAnchor, endAnchor)` throws with the missing anchor (`[VERIFIED: coverage.test.ts:37-43]`); `expectContains`/`expectNotContains` report the missing literal (`[VERIFIED: coverage.test.ts:47-53]`).
- Slicers: `BRUSH_CASE()` = `"case 'brush': {"` → `"case 'water': {"`; `CALLBACK()` = `this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {` → `});`; `COVER_METHOD()` = `'private coverPass('` → `'private brushWet('` (`[VERIFIED: coverage.test.ts:55-63]`).

**Placement hazard (important):** the existing test asserts `expectNotContains(body, 'this.ink')` and `expectNotContains(body, 'g.target(')` inside the `coverPass` slice (`[VERIFIED: coverage.test.ts:143-158]`). Putting the ink subtraction *inside* `coverPass` fails that pin. Put it in a sibling method (e.g. `inkCover`) invoked from the `eachDab` callback after `coverPass`, and keep `coverPass`'s body byte-compatible with its current pins. The `onCoverDab` emission can live in `coverPass` — the pins forbid `this.ink`, `this.wet`, `this.touch`, `g.target(`, `g.program(` and `new `, not callbacks.

Also note the singleton counts: one `this.coverPass(` call site and one `private coverPass(` (`[VERIFIED: coverage.test.ts:121-129]`), and `lift()`'s four draw lines are pinned byte-for-byte (`[VERIFIED: coverage.test.ts:179-188]`).

**Lift contract tests also count literals.** `aquarelleLiftEraseContract.test.ts` uses helpers like `source.split(literal).length - 1` and pins e.g. "the RASTER-ONLY punch still rewrites the durable base exactly once", the single `punchTransmittanceBytes(durableSource, ...)` call, the preview-only-for-cached-display rule and the commit retry shape (`[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts:93-481]`). Adding a cover branch that duplicates a counted literal will break these; prefer additive `kind`-gated branches, and re-run the file.

New pins the spec requires: the snapshot seam, the subtract draw (`FUNC_REVERSE_SUBTRACT`, both ink attachments), `preInk` disposal, `onCoverDab`, and a `Body 0` allocates-nothing/emits-nothing pin.

### C12. Probe: fields, scenario mechanics, cached-base staging

- **Gate fields:** `DIGESTS = ['digestPaper','digestTransparent','digestWhite']`, `FIELDS = [...DIGESTS, 'byteLength', 'width', 'height']` — six fields (`[VERIFIED: packages/efx-watercolor/probe/medium-engine/compare.mjs:53-54]`). Baseline mode compares all six; `--other` is same-session; `--differs-from` requires all three digests to differ (`[VERIFIED: compare.mjs:3-43, 170-219]`).
- **Committed baseline:** `/tmp`-independent `baselines/neutral-identity.json` — 256×256, `digestPaper: d2bd637a`, `digestTransparent: 291d4a11`, `digestWhite: 6ba88334`, `byteLength: 262144`, `capturedFromCommit: d1fd7ea3...` (`[VERIFIED: packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json:1-18]`).
- **Probe run:** `scenario === 'cover' ? coverScript(emboss, body) : neutralScript(emboss, body)` (`[VERIFIED: probe.ts:283]`), and per stroke it runs `for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)` then `adapter.fix()` (`[VERIFIED: probe.ts:301-306]`), with `SETTLE_TICKS = 8` (`[VERIFIED: probe.ts:74]`).
- **`cover-over-wet` requires a new scenario:** the existing `cover` scenario calls `fix()` after EVERY stroke, which is precisely what moves the underlayer into `fixed` and hides the bug. A wet scenario must skip the intermediate `adapter.fix()`. That needs `readScenario` (`[VERIFIED: probe.ts:384-...]`, currently accepting only `'cover'` or absent) and `run.mjs`'s flag validation (`[VERIFIED: packages/efx-watercolor/probe/medium-engine/run.mjs:39-43, 68-80]`) to accept a new value.
- **`cover-over-cache` cannot be staged in the probe:** the harness drives the engine adapter only (`[VERIFIED: probe.ts:283-326]`); there is no Studio, persistence coordinator or `AquarelleCachedBaseLayer`. Pin the punch math in a unit test against `buildLiftCoverage` + `punchTransmittanceRgba` (the core profile), and leave the visual proof to UAT row 3.
- **Neutral identity:** `DEFAULT_PARAMS.body = 0` (`[VERIFIED: Engine.ts:80]`), the probe's `STROKE_PARAMS` has no body/emboss keys, and `paramsBag` adds a knob only when defined (`[VERIFIED: probe.ts:205-210]`) — so `Body 0` takes no snapshot, draws no cover and emits nothing, keeping the six-field gate byte-identical.
- **Run cost:** `run.mjs` rebuilds `probe.bundle.js` with esbuild and launches headless Chrome; Chrome is present at `/Applications/Google Chrome.app` and the candidate list is checked at startup (`[VERIFIED: run.mjs:165-171]`). Node `v24.15.0`, pnpm `10.27.0` (`[VERIFIED: environment probe this session]`).

### C13. Test commands and constraints

- `packages/efx-watercolor/package.json`: `"test": "vitest run"` (`[VERIFIED: packages/efx-watercolor/package.json:63]`). Run with `pnpm --filter @efxlab/efx-watercolor test`.
- `app/package.json`: `"test": "vitest"` — **watch mode, forbidden** (`[VERIFIED: app/package.json:11]`). Use `pnpm --dir app exec vitest run` (or the configured `workflow.test_command` `pnpm --filter efx-motion-editor exec vitest run`, `.planning/config.json`).
- Only `app/vitest.config.ts` exists; `packages/efx-watercolor` has no vitest config and relies on the app config / defaults (`[VERIFIED: filesystem check this session]`).
- Memory constraint that has bitten this repo: Vitest collects only `.test.ts` — a `.test.tsx` target exits 0 while running nothing.

## Group D — Risks and contradictions

### D14. Punch cost baseline

No measured `buildLiftCoverage` + dirty-rect cost exists in the tree. The probe records `bakeMs` (script + settle) and `renderMs` (exports), printed but never compared (`[VERIFIED: probe.ts:298-326]`; `[VERIFIED: compare.mjs:90-96]`). The documented live baseline is the Lift commit latency "~1.5 s later" (`[VERIFIED: aquarelleLiftPreview.ts:5-8]`), which is the punch/rebake round trip, not the per-frame preview cost.

Per-frame preview cost for a cover equals the Lift preview's shape: `buildLiftCoverage` over the coverage rect + `punchTransmittanceRgba` + `putImageData` of the dirty rect (`[VERIFIED: AquarelleCachedBaseLayer.tsx:60-84]`). Cover dabs are the same count as lift dabs (one per engine dab) with the same radius; `amount` up to 1 vs lift's max 0.9 — the coverage loop cost is amount-independent. Risk is LOW; measure only if UAT shows lag at large sheets.

Engine-side, the added cost is one extra full-screen-triangle draw per cover dab over a stamp rect (the current `coverPass` already issues two).

### D15. Spec laws vs the tree — contradictions and stale anchors

**Stale anchors (spec → actual):**
- `COVER_GAIN = 2` is at `Engine.ts:178`, not 173 (`[VERIFIED: Engine.ts:178]`).
- `coverAmount` derivation is at `Engine.ts:2079`, not 2088-2103; the guard block is 2084-2100 (`[VERIFIED: Engine.ts:2079-2100]`).
- Everything else checks out at HEAD: `coverPass` 2278-2298; stroke start 1931-1941; `onLiftDab` 120 and 2446; `liftFS` 307-334; `settleFS` 289-298; `AquarelleCachedBaseLayer` 60-129; `aquarelleLiftPreview` 56-80; `aquarelleLiftErase` 352 and 456; mount 230; layer 415/625; Studio 7972-7993; `MAX_DOC` 267-268.

**Contradiction 1 — "the sim shaders already clamp at 0" (spec Law 2).** Only the scattering channel is clamped; the spectral basis is explicitly unclamped and signed (`[VERIFIED: shaders.ts:282-284]`). Over-subtraction can leave negative coefficients; the display clamps them at the sRGB conversion. Accept and record (locked decision 2), do not "fix" the sim clamps.

**Contradiction 2 — the existing `coverPass` pin forbids `this.ink`.** Adding the ink subtraction inside `coverPass` breaks `coverage.test.ts`. Put it in a sibling method reached from the `eachDab` callback (`[VERIFIED: coverage.test.ts:143-158]`).

**Contradiction 3 — Law 3 says the emission is "called from coverPass exactly as lift() calls onLiftDab".** That is compatible with the pins (they forbid `this.ink`/`this.wet`/`this.touch`/allocations, not callbacks), but the emission must sit after the two draws so the preview observes the applied dab, mirroring `[VERIFIED: Engine.ts:2444-2446]`.

**Contradiction 4 (tension to resolve in the plan) — UAT row 6 vs the durable-base punch.** The engine side of undo is history tiles (verified). The cached side rides the same physical-edit/ledger entry the Lift punch uses; the spec asserts this and the commit is a mutation-addressed `upsertCachedFrame` (`[VERIFIED: useRotoFramePersistenceCoordinator.ts:746-768]` with `capture.mutationId`). Restoring the *durable base bytes* on undo is not verified in detail this session — it is the one acceptance row the plan must exercise concretely (UAT row 6), alongside the existing Lift behaviour it copies.

**Double erase (spec Risk 3) — resolved by the pin model.** The cached display is the committed base; the live sheet holds this session's strokes; the merge base stays "as of SHEET START" (`[VERIFIED: PhysicsPaintStudio.tsx:10119-10123]`). They hold disjoint pigment, so both must be erased; no same-pigment double erase exists. The remaining gate is the plan's own `normal` case (no raster-backed display, live sheet has paint) — the punch is skipped there, exactly as for Lift.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | all commands | ✓ | v24.15.0 | — |
| pnpm | workspace scripts | ✓ | 10.27.0 | — |
| vitest | source-scan tests | ✓ | `^2.1.9` (package devDep) | — |
| Google Chrome | probe run (`run.mjs`) | ✓ | `/Applications/Google Chrome.app` | any candidate in `run.mjs:165-171` |

Missing dependencies with no fallback: none.
Missing dependencies with fallback: none.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | vitest 2.1.x (`packages/efx-watercolor`), source-scan tests |
| Config file | `app/vitest.config.ts` (only config in the repo) |
| Quick run command | `pnpm --filter @efxlab/efx-watercolor test` |
| Full suite command | `pnpm --dir app exec vitest run` |

### Phase Requirements → Test Map

| Req (spec scope task) | Behavior | Test Type | Automated Command / File |
|---|---|---|---|
| Scope 1 — snapshot seam | snapshot in `!s.started` before first stamp | source-scan | `coverage.test.ts` (new pin) |
| Scope 1 — subtract draw | `FUNC_REVERSE_SUBTRACT`, both ink attachments | source-scan | `coverage.test.ts` (new pin) |
| Scope 1 — disposal | `preInk` dropped at all eight sites | source-scan | `coverage.test.ts` (new pin) |
| Scope 1 — callback | `onCoverDab` declared + emitted per draw | source-scan | `coverage.test.ts` (new pin) |
| Scope 1 — neutral | `Body 0` allocates nothing, emits nothing | source-scan + probe | `coverage.test.ts` (new pin); `compare.mjs neutral-identity` |
| Scope 2 — engine | cover over wet ink removes underlayer | probe | new `cover-over-wet` scenario, threshold vs pre-fix capture |
| Scope 3 — cache | core-profile punch math | unit | new test over `buildLiftCoverage`/`punchTransmittanceRgba` |
| UAT 3, 6, 7 | leave/reopen, undo, export | live only | human UAT (inherently visual) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @efxlab/efx-watercolor test`
- **Per wave merge:** `pnpm --dir app exec vitest run`
- **Phase gate:** full suite green plus the `neutral-identity` probe byte gate before UAT.

### Wave 0 Gaps
- [ ] `coverage.test.ts` — new pins for snapshot / subtract / disposal / callback / Body 0.
- [ ] `probe.ts` + `run.mjs` — accept and implement a `cover-over-wet` scenario (no intermediate `fix()`).
- [ ] New unit test for the `core` coverage profile in `buildLiftCoverage`.
- [ ] Framework install: none — existing setup.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled). This phase touches no network, auth, persistence format or external input; the only data crosses internal GPU/CPU seams.

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (internal) | Existing `clampDocSize`, `stampRect` clamping, and `punchTransmittanceRgba`'s K-guard (`!(k < 1)` skips) — keep new paths inside them |
| V6 Cryptography | no | — |

Known threat patterns: none new. The one memory-exhaustion vector (`preInk` at max sheet) is bounded by `MAX_DOC_PIXELS = 4_200_000` and the stroke-scoped lifetime.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `FUNC_REVERSE_SUBTRACT` + `ONE, ONE` into RGBA16F is accepted by the packaged WKWebView | A3 | The subtract draw silently no-ops or throws → ink cover does nothing. Mitigate with a `gl.getError()` check after the first draw and one probe run through the new path. |
| A2 | The lift transaction can be parameterized on `kind` without breaking the literal-counting contract tests | B7, C11 | Contract tests red; fall back to a sibling transaction with duplicated guards. |
| A3 | Undo of the durable-base punch restores the pre-punch bytes through the existing mutation ledger | D15 | UAT row 6 fails for the cached base; would need an explicit snapshot/revert in the transaction (the layer's `snapshotRef`/`revert()` only covers the preview). |
| A4 | The probe's new scenario can be added without perturbing the `neutral-identity` path | C12 | Neutral gate churn; keep the neutral branch byte-untouched (it already is: `paramsBag` adds keys only when defined). |

**If this table is not empty:** A1 and A3 need confirmation during execution (A1 by a cheap runtime probe; A3 by UAT row 6).

## Open Questions — ALL RESOLVED (2026-11-17, plan revision)

1. **Exact placement of the ink-cover draw relative to `brushInk` within a dab. — RESOLVED.**
   - What we know: the subtraction is linear and commutative with the deposit's additive blend; undo protection is already taken per stamp before the callback.
   - Resolution: draw ink-cover first (erase then deposit). The call is UNGUARDED and sits directly after the pinned `if (coverAmount > 0) this.coverPass(...)` line, because `coverage.test.ts` pins exactly two `coverAmount > 0` occurrences in the brush case; `inkCover` owns the `preInk === null` / non-positive-amount early return. The method itself is declared after `brushWet()` (outside the `private coverPass(` … `private brushWet(` source-scan window).

2. **Whether to extend `AquarelleLiftPreviewSink` or add a sibling bridge. — RESOLVED.**
   - What we know: one sink registration per mounted `AquarelleCachedBaseLayer`; the layer already owns the decoded ImageData and the gesture-scoped snapshot.
   - Resolution: extend the ONE sink with an optional `profile?: 'tip' | 'core'` on `begin`, keeping `dab/end/revert` unchanged and no second decoded copy. The default/tip form calls `begin(frame)` with the frame alone so `aquarelleLiftPreview.test.ts:19` (`toHaveBeenCalledWith(42)`) and the pinned Studio `beginAquarelleLiftPreview(frame)` literal stay green.

3. **How the `core` profile is expressed in `buildLiftCoverage`. — RESOLVED.**
   - Resolution: a `profile: 'tip' | 'core'` parameter (default `'tip'`) so the existing call sites and the tip math are untouched; the core branch reproduces `1 - smoothstep(0.35, 1.0, dot(q,q))` in the same squeezed tip space with the same square cull and `sqrt(1 + aspect²)` margin.

## Resolved contract constraints (added at plan revision)

- **Mode rides the plan object, never a 4th argument.** `aquarelleLiftEraseContract.test.ts:429-431` pins the pending-queue push, destructure and re-entry tail verbatim, and `:424` pins the 3-argument dispatch. `mode?: 'lift' | 'cover'` on the erase arm spreads through all three; `planAquarelleLiftErase`'s pinned preflight return stays unchanged and `runAquarelleLiftErase` reads `plan.mode ?? 'lift'`.
- **The cover's durable rewrite cannot add a counted literal.** Two suites pin the whole-Studio `aquarelleDurableBaseByKeyRef.current.set(` count at 10 and `.delete(` at 2 (`aquarelleLiftEraseContract.test.ts:612-613`, `PhysicsPaintStudio.test.ts:5093-5094`). The cover writes through a local map alias and the new cover seam contract test pins that site instead.
- **Cover branch placement is bounded.** It lives after the shared dab resolution and before `if (plan.scripted)`, so it escapes the scripted and `// RASTER-ONLY:` slices whose literal counts and negative pins (`loadCachedRotoReferenceFrame(`, `physicPaintVersion.value++`, `attempts,` ×2, `diagnostics: recoveryDiagnostics,` ×3) must stay intact.

## Sources

### Primary (HIGH confidence)
- `packages/efx-watercolor/src/playground/Engine.ts` — callbacks, constants, allocate/dispose, processInput, stamp, brushInk, coverPass, touch/snapshotLayers, lift, settle/advect, trim/sleep, destroy.
- `packages/efx-watercolor/src/playground/gl.ts` — Target/DoubleTarget, target/draw/blit, disposeTarget(s).
- `packages/efx-watercolor/src/playground/shaders.ts` — `settleFS`, `liftFS`, `advectInkFS`, `toSRGB`, emboss shading.
- `packages/efx-watercolor/src/playground/history.ts` — copy-on-write `protect`.
- `packages/efx-watercolor/src/playground/params.ts` — `toEngineParams` body mapping.
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — deterministic bake feed.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — plan, preview gating, lift transaction, stroke-end, capture.
- `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx`, `AquarelleCanvasLayer.tsx`, `PhysicsPaintCanvasMount.tsx`.
- `app/src/components/physic-paint/roto/aquarelleLiftPreview.ts`, `aquarelleLiftErase.ts`.
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — merge/commit.
- `packages/efx-watercolor/probe/medium-engine/{probe.ts, run.mjs, compare.mjs, baselines/neutral-identity.json}`.
- `packages/efx-watercolor/src/playground/coverage.test.ts`; `app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts`.

### Secondary (MEDIUM confidence)
- Khronos WebGL extension registry — `EXT_float_blend` (32-bit float blending only), `EXT_color_buffer_float` (RGBA16F color-renderable).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all seams read at HEAD.
- Architecture: HIGH — engine and cache seams verified line-by-line; the one MEDIUM is the new blend equation.
- Pitfalls: HIGH — the source-scan pins and contract-test literal counts are read directly.

**Research date:** 2026-11-17
**Valid until:** 2026-12-17 (stable, but any Engine.ts shift invalidates the anchor lines).
