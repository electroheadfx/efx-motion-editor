# Quick 261028-k03: Lift (eraser) three-state erase — Research

**Researched:** 2026-10-28
**Domain:** `@efxlab/efx-watercolor` live engine + Roto live-pixel cache/script pipeline
**Confidence:** HIGH on seams and math; MEDIUM on the visual tolerance of the punch approximation

## Summary

Lift already records and replays; the missing half is a **destructive pixel punch** for frames whose
displayed paint lives in the cached raster. The whole quick reduces to one new pure module (lift
footprint → transmittance punch) plus one new commit call through the existing
`captureLivePixels({ baseCanvas })` seam, and three ordering rules: punch the **durable pre-script
base**, punch the **displayed composite**, and make the **merge base** the punched composite so the
live sheet never re-applies over unpunched bytes.

The engine erases in **absorbance**, not in sRGB: `lift` multiplies the density targets by `(1−f)`,
and display transmittance is `exp(−a)`, so the faithful punch is `t' = t^K` per channel in **linear
light**, `K = Π(1−f_i)` over the stroke's dabs. A linear lighten (`t·(1−f)`) breaks both parity and
the double-erase algebra. There is **no vendor change required** — the footprint must be mirrored
app-side, which is an accepted approximation (the recorded tick-grid is what a re-bake replays, so
mirroring the tick-grid replay is the parity target, not the live dab stream).

**Primary recommendation:** add `roto/aquarelleLiftErase.ts` (pure: `collectLiftDabs`,
`punchTransmittanceCanvas`, `punchTransmittanceBytes`) + one Studio erase pipeline invoked from the
stroke-end branch when `stroke.tool === 'lift'`, gated at pointerdown by a Script-OFF guard.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Forbid / no-op policy (D1, D3) | Studio (`PhysicsPaintStudio`) | Layer (pointerdown gate) | Script state and messages are Studio-owned; only the layer sees pointerdown before the engine |
| Footprint → K-map | Pure module (`roto/`) | — | Must be unit-testable and engine-free |
| Transmittance punch | Pure module (`roto/`) | — | Canvas math, no React/signals |
| Durable/merge base sync | Studio refs | — | `aquarelleMergeBaseRef`, `aquarelleDurableBaseByKeyRef` are Studio-scoped |
| Acknowledged pixel commit | Coordinator (`captureLivePixels` → transactions) | Studio | The only physical-edit transaction authority |
| Display refresh | Studio (reference controller port) | — | `loadCachedRotoReferenceFrame` + `physicPaintVersion` precedent |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1. Explicit Dry + Lift ("Dry stays permanent")** — Lift keeps erasing mobile ink/wet only; pigment
baked into `fixed` by an explicit Dry stays. No vendor engine change, no fixed-layer undo snapshots,
replay parity unchanged. Intentional asymmetry: a live explicit-Dry no-op, but the same paint becomes
erasable once the frame is cooked (raster punch). Live Dry is physically permanent; baked raster
editing is a destructive edit. Define and implement a visible, non-modal feedback/no-op policy for a
lift stroke on explicitly dried paint.

**D2. Committed frame + Script ON ("Punch pixels + record")** — Punch the displayed cached pixels and
the durable pre-script base in transmittance space (lighten toward white, never alpha holes), refresh
the display immediately, and record the Lift event so a re-bake replays it. The punch must update all
three copies: the session merge base, the durable pre-script base bytes, and the key payload/cache
through the physical-edit transaction. No resurrection on a later Apply. Base punch is permanent;
script-layer erase follows the event (delete/move + Apply restores script-layer paint only). Applies
to cooked+script and to raster-only frames while Script is ON.

**D3. Script OFF while a script exists ("Forbid with a clear message")** — Lift is forbidden with a
clear, non-modal message telling the user to turn Script ON to lift recorded paint. Raster Key is the
only escape hatch for a pixel-only erase on a scripted frame — not Script OFF. No silent
resurrection; nothing destructive happens.

**D4. Undo policy ("No undo — declare it")** — A destructive raster erase is not undoable. It commits
through the existing physical-edit transaction; no new undo kind or undo machinery. Script-layer paint
remains restorable by deleting the Lift event and re-Applying. Raster-only erases are permanent and
must be declared in the UI (status capsule). Escalation stays: if D1 cannot hold replay parity without
engine changes, or D4 safety is judged insufficient, STOP and propose promoting this to a phase.

### Truth table (agreed)

| # | Frame state | Script | Visible result | Authoritative store | Script entry | Undo | Apply outcome |
|---|---|---|---|---|---|---|---|
| 1 | live-wet | ON | erases mobile ink/wet | live sheet → capture merge | Lift event | engine step + event delete | replay lifts mobile pigment |
| 2 | live-wet | OFF, no script | erases | live sheet → capture | none | engine step | nothing to resurrect |
| 3 | live-wet | OFF, script exists | forbidden + message (D3) | — | none | — | no silent resurrection |
| 4 | live-dry | ON/OFF | no-op + visible feedback | — | ON: Lift event (no-op on fixed) | engine step | no-op on fixed |
| 5 | cooked + script | ON | punch displayed cache immediately | key payload + script | Lift event | event delete restores script paint; base punch permanent | re-bake over punched base, no resurrection |
| 6 | cooked + script | OFF | forbidden + message (D3) | — | none | — | no resurrection |
| 7 | raster-only | ON | punch key pixels + record | key payload + new script | Lift event (first stroke pins base → punch it) | event delete restores script paint only | punched base, no resurrection |
| 8 | raster-only | OFF | punch key pixels + permanent declaration | key payload | none | none (declared, permanent) | pixels authoritative, no script |

### Claude's Discretion

Message wording, throttle cadence, module/file names, whether the punch runs on the composite or is
split into per-dab passes, and the exact escape-hatch phrasing for D3.

### Deferred Ideas (OUT OF SCOPE)

Group-frame erase propagation, undoing a raster erase, vendor `Engine` changes, and any new undo kind.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Preact + `@preact/signals` only — consult `efx-preact-reactivity`; never React patterns, never
  `useState`.
- `vitest run` only — never watch mode.
- Do not run the dev server; the user runs it.
- Use the project-local GSD install; artifacts in English.

## 1. Detection (where each state is decided)

Detection is **two-point**: a pointerdown gate for the forbidden state, and a stroke-end branch for
everything else. The stroke already carries its tool — the layer builds it with
`tool: toolForSelection()` [VERIFIED: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:406].

| Observed state | Test | Route |
|---|---|---|
| Forbidden (rows 3, 6) | `!aquarelleScriptRecordingEnabled.peek() && hasAquarelleScriptForFrame(frame)` | block at **pointerdown** |
| Raster-backed frame (rows 5, 7, 8) | `findCachedRotoDisplayFrame(frame) !== null` | erase pipeline |
| Live only (rows 1, 2) | the above false | existing stroke-end path |
| Dry no-op (row 4) | app-side `explicitDrySince` && `!mobilePaintSince` | hint only, no punch |
| Group frame | `classifyPhysicPaintRotoGroupFrameTarget(...).kind !== 'ordinary-key'` | fail closed + escalation flag |
| Unknown durable base, scripted | `aquarelleDurableBaseByKeyRef.current.get(keyId) === undefined` (MISSING ≠ `null`) | fail closed |
| Script contains a Dry event | `getAquarelleEventsForFrame(frame).some(isAquarelleDryEvent)` | refuse (see §5) |

**The D3 gate must be at pointerdown, in the layer's existing window capture listener**
[VERIFIED: AquarelleCanvasLayer.tsx:576-580]:

```ts
const reopenSettleOnPaint = (event: PointerEvent) => {
  if (event.target !== canvas || event.button === 1) return;
  engine.cancelAutoFix();
};
window.addEventListener('pointerdown', reopenSettleOnPaint, true);
```

Add a `getLiftForbidden()` getter prop (mirroring `getAquarellePlayFrame`/`getAquarellePaperId` in
PhysicsPaintCanvasMount) and, before `cancelAutoFix`, `preventDefault + stopPropagation` and call an
`onLiftBlocked` callback when `toolForSelection() === 'lift' && getLiftForbidden()`. Gating at stroke
end is too late: the engine has already erased the live sheet.

**Explicit-Dry tracking (D1)** is app-side because the engine exposes no fixed-vs-mobile read — only
`get hasPaint(): boolean` over the union rect `everPainted`
[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:659-661 (`return this.everPainted !== null;`), 1797-1807 (`this.everPainted = union(this.everPainted, rect);`)]. Hook `onAquarelleDry`
(AquarelleCanvasLayer.tsx:566-569 already subscribes for `engine.fix()`), set
`explicitDrySinceRef = frame`, clear it on any non-lift stroke and on sheet reset. Do **not** key off
the settle cap: `cancelAutoFix` reopens it on every pointerdown.

## 2. The punch law (PUNCH)

The engine's `lift` multiplies the density (absorbance) targets and never touches `fixed`
[VERIFIED: Engine.ts:1869-1886]:

```ts
gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
gl.uniform1f(p.u.uAmount, amount);
g.draw(this.ink.read, rect);
gl.uniform1f(p.u.uAmount, amount * 0.8);   // the tissue soaks up water too
g.draw(this.wet.read, rect);
```

Display transmittance is `exp(−a)` [VERIFIED: packages/efx-watercolor/src/playground/spectral.ts:65
(`const t = Math.exp(-Math.max(a, 0));`)], and storage is that transmittance sRGB-encoded with alpha 1
[VERIFIED: packages/efx-watercolor/src/playground/shaders.ts:669,673 (`vec3 t = toSRGB(rgb);` …
`o = vec4(t, 1.0);`)]. Therefore a lift of factor `f` maps `a' = a(1−f)` ⇒ **`t' = t^(1−f)`**.

**Punch = per-channel power in linear light:** uncompand sRGB → `t' = pow(t, K)` → compand → keep
alpha 255. `K = Π(1 − f_i)` per pixel, so overlapping dabs accumulate multiplicatively. Never write
alpha and never `source-over` white (that would punch a hole in the transmittance sheet).

Footprint — dabs, radius, amount (all verified this session):

- `amount = Math.min(0.9, 0.22 * dwell)` [Engine.ts:1716], `dwell = moving ? 1 : dt * 8`
  [Engine.ts:1658] ⇒ moving dab `0.22`, dwell dab `0.22·8/60 ≈ 0.0293` (`HOST_DT = 1/60`
  [VERIFIED: packages/efx-watercolor/src/adapter/engineAdapter.ts:46-47]). The engine clamps its dt
  to 1/240..1/30, so the 1/60 figure is a declared approximation (Assumption A5): on a 120 Hz host
  the live dwell amount is half the punched one.
- `f = amount * exp(-pow(dot(p,p)/(r*r), 2))` [VERIFIED: shaders.ts:273].
- Lift radius: `case 'lift': return (0.012 + 0.03 * pr) * m;` [VERIFIED: Engine.ts:1526] with
  `m = Math.pow(3, (this.params.size - 0.5) * 2)` [VERIFIED: Engine.ts:1517] — **pressure and size
  only, no speed thinning**. `params.size` is the ENGINE size, so map through
  `toEngineParams(stroke.params)` [VERIFIED: packages/efx-watercolor/src/playground/params.ts:66-81].
- Dab spacing is `r * 0.5` (lift is not brush/water) [VERIFIED: Engine.ts:1651
  (`return tool === 'brush' || tool === 'water' ? … : 0.5;`)] and path dabs come from the quadratic
  trace [Engine.ts:1614-1643].
- `scriptScale` is only produced by the text writer (`StrokeWriter`), not the Studio bake; the Studio
  `renderPartialStrokes` path leaves it 1 [VERIFIED: engineAdapter.ts:315-347; Engine.ts:819].

Coordinate mapping: document UV is y-up, canvas is top-down, so `px = x·W`, `py = (1−y)·H`, and the
radius converts as `r_px = r·H` (both UV axes divide by `H` after the shader's `p.x *= uAspect`).
Dotted derivation: shader `p = vUv − uPoint`, `p.x *= W/H` ⇒ `p.x = Δpx/H`, `p.y = Δpy/H`.

**Recommendation:** pure module `app/src/components/physic-paint/roto/aquarelleLiftErase.ts`:

```ts
collectLiftDabs(stroke: AquarelleStroke, size: {width:number;height:number}): { x:number; y:number; r:number; amount:number }[]
punchTransmittanceCanvas(src: HTMLCanvasElement, dabs): HTMLCanvasElement | null
punchTransmittanceBytes(bytes: Uint8Array, size, dabs): Promise<Uint8Array | null> // decode → punch → encode
```

Mirror the **recorded tick-grid** points (the stroke's `points`), not the live dab stream: that is
what a re-bake replays, so it is the parity target. Accept the residual difference (pressure
smoothing `k = 0.65` is applied in the engine's `processInput`, not in the recorded payload) and
declare it.

**Composition algebra (why the punch is applied twice and not doubled):** the stored composite is
`t' = a·C + (1−a)·t_base` [VERIFIED: roto/physicsPaintRotoAlphaMerge.ts:11-21]. For a neutral sheet
this equals `t_sheet · t_base`, so punching composite and base by the same `K` and replaying the
script lift (`t_sheet^K`) composes to exactly one erase. For chromatic sheets the two differ slightly
(the pigment-alpha composite is not an exact multiply); magnitude is a few percent on saturated
pixels. Declare it — it is not resurrection.

## 3. Commit (COMMIT)

Reuse the acknowledged transaction; do **not** write the LRU directly.

[VERIFIED: hooks/useRotoFramePersistenceCoordinator.ts:604-609]

```ts
liveAlphaCanvas: HTMLCanvasElement | (() => HTMLCanvasElement | null);
cachedBase: RenderedFramePayload | null;
/** 261003-erase-uat (B): engine's erased copy of the cached paint (null when
 * no pixel erase ran). When set, the merge draws it instead of cachedBase
 * bytes so the capture records the removal. */
baseCanvas?: HTMLCanvasElement | null;
```

and [VERIFIED: useRotoFramePersistenceCoordinator.ts:693-696]

```ts
const usedMerge = Boolean(capture.cachedBase || capture.baseCanvas);
const produced = await (usedMerge
  ? mergeCachedRotoAlphaFrame(capture.cachedBase, liveAlphaCanvas, capture.appFrame, capture.size, capture.mutationId, capture.baseCanvas, capture.mergeBlend)
  : encodeRotoFrameFromCanvas(liveAlphaCanvas, capture.appFrame, capture.size, capture.mutationId));
```

Merge order is `baseCanvas → (converted) live sheet` [VERIFIED: roto/physicsPaintRotoAlphaMerge.ts:61-73].

**Erase call shape (recommended):**

```ts
rotoPersistenceRef.current.captureLivePixels({
  layerId: launch.layerId, trackId: sessionTrackId, appFrame: playFrame,
  liveAlphaCanvas: eagerSheetCanvas,            // sync copy; retries reuse it
  cachedBase: null,
  baseCanvas: punchedCompositeCanvas,           // D^K — the displayed composite, punched
  mergeBlend: 'pigment-alpha',
  size: { width: canvasWidth, height: canvasHeight },
});
```

Why `baseCanvas = D^K` (the **composite**, not the pre-script base): on a cooked frame the live sheet
starts empty, so merging the sheet over `B^K` would drop the script layer from the display. The
durable base `B^K` is punched separately for the re-bake.

**Bypass the ink gate only for this path.** The gate rejects a white sheet
[VERIFIED: PhysicsPaintStudio.tsx:6400-6410 (`const ink = measureAquarelleCanvasInk(liveAlphaCanvas); … if (ink < AQUARELLE_MIN_CAPTURE_INK) return;`)] and it runs **before** the capture seq bump
[VERIFIED: PhysicsPaintStudio.tsx:6412 (`const seq = ++aquarelleCaptureSeqRef.current;`)], so the
dedicated erase path must call `captureLivePixels` itself rather than routing through
`handleAquarelleCaptureFrame`. Reuse the retry idiom (`enqueue(2)` at PhysicsPaintStudio.tsx:6508-6542)
and rely on the transaction's identity/revision staleness gates.

**Do not clear the live sheet after the punch.** A stale white capture is rejected by the ink gate and
cannot invalidate the erase capture (the gate precedes `++seq`).

## 4. Three copies, in order (THREE COPIES)

| Copy | Ref | Value | When |
|---|---|---|---|
| Session merge base | `aquarelleMergeBaseRef.current` | `{ appFrame, trackId, base: payload(D^K) }` | after punch, before enqueue |
| Durable pre-script base | `aquarelleDurableBaseByKeyRef.current` | `B^K` bytes (`null` stays `null` = known empty) | after punch, overwrite |
| Key payload | transaction → store + LRU + parent delivery | `D^K` (what the merge produces) | captured |

Ordering that avoids the async trap: **record synchronously first, punch asynchronously after.**
`handleAquarelleStrokeEnd` already pins before recording
[VERIFIED: PhysicsPaintStudio.tsx:5818-5821, 5853]:

```ts
const scriptRecordingOn = aquarelleScriptRecordingEnabled.peek();
if (scriptRecordingOn) {
  recordAquarelleOrdinaryDurableBaseRef.current(launchContextRef.current?.startFrame ?? 0);
}
…
recordAquarelleStrokeWhenEnabled(scriptRecordingOn, mutationId, { ...stroke, mutationId }, capturedKeyId);
```

The recorder early-returns when the key already has an entry [VERIFIED: PhysicsPaintStudio.tsx:6334
(`if (aquarelleDurableBaseByKeyRef.current.has(target.keyId)) return;`)] and refuses when a script
already exists [VERIFIED: PhysicsPaintStudio.tsx:6340-6348 (`if (getAquarelleEventsForFrame(appFrame).length > 0) { … reason: 'script-already-present' … }`)]. So the erase pipeline can **overwrite** the map entry with `B^K` once the decode/punch resolves; no later Apply can run in that window at human speed, and the synchronous record order is preserved (no interleaved stroke can be replayed before the lift).

Raster-only key + Script ON (row 7): the recorder pins the just-punched raster, then the erase
overwrites it with the same `D^K`; the re-bake replays a lift over an empty script sheet and
composites `P(white, D^K) = D^K` — no double erase.

## 5. Script interplay and the parity gap (SCRIPT INTERPLAY)

The lift event is already replayed: tool id 3 [VERIFIED: performance/scriptTimelineCodec.ts:122,128
(`const TOOL_NAMES = ['brush', 'water', 'pen', 'lift'] as const;` … `lift: 3,`)], the adapter accepts
lift [VERIFIED: adapter/engineAdapter.ts:109
(`const AQUARELLE_TOOL_SET = new Set<Tool>(['brush', 'water', 'pen', 'lift'])`)], and
`getAquarelleEventsForFrame` applies no tool filter.

**Newly discovered hazard — Dry resurrection.** Dry events are global to every frame
[VERIFIED: view/aquarelleRecordState.ts:1488 (`if (isAquarelleDryEvent(event)) return true;`)], and the
bake replays them in recorded order, force-fixing the script sheet. A recorded Dry **always precedes**
a Lift appended later, so on Apply the bake lifts an already-fixed script layer and the erased
script paint comes back. Options:

1. **Refuse** the erase when the frame's script contains a Dry event (`some(isAquarelleDryEvent)`) with
   a message consistent with D1 ("dried paint stays"). Consistent with the locked asymmetry, zero
   parity risk. **Recommended for this quick.**
2. Declare the gap and accept `Apply` resurrecting script-layer paint — contradicts D2's "no
   resurrection".

Escalate if the user wants option 2 or a bake-side fix (that would be a vendor/bake change, outside D1).

**Raster Key escape hatch (D3):** existing and unchanged — it flushes, reloads, then purges the script
and deletes the durable base entry [VERIFIED: PhysicsPaintStudio.tsx:6608-6657, esp. 6626
`await flushAquarellePixels(frame);` and 6655
`if (scriptCell?.keyId) aquarelleDurableBaseByKeyRef.current.delete(scriptCell.keyId);`].

## 6. Display refresh (DISPLAY)

Precedent, verbatim [VERIFIED: PhysicsPaintStudio.tsx:1915-1928]:

```ts
if (ok && launchContextRef.current?.startFrame === frame.appFrame) {
  const generation = Math.max(
    rotoPreviewBaseContentToken(),
    previewBasePort.getAppliedPreviewBaseContentToken() ?? 0,
  );
  loadCachedRotoReferenceFrame(frame.appFrame, previewBasePort, undefined, true, generation);
  physicPaintVersion.value++;
}
```

After the erase transaction acknowledges, run the same sequence. "Immediately" per D2 = **without a
manual Apply**; publication stays post-acknowledgement (the project's no-optimistic-publication law),
which is one transaction turn away, not a user action.

Display plumbing: `AquarelleCachedBaseLayer` renders `aquarelleCachedBaseUrl` under the live canvas
[VERIFIED: engine/PhysicsPaintCanvasMount.tsx:163-165], and `getFrameBlobUrl` memoizes by content token
[VERIFIED: hooks/useRotoReferenceController.ts:25-30 (`const token = buildFrameBytesToken(bytes); … _frameBlobUrlCache.set(token, url);`)]. URLs are never revoked — every punch adds one entry, the
same cost Apply already pays. On final failure: leave the old URL, `setLastError` + `setApplyStatus('error')`
with "The erase did not commit — nothing changed."

## 7. Messages (MESSAGES)

The capsule reads [VERIFIED: PhysicsPaintStudio.tsx:8069]:

```ts
statusMessage: isPlaying ? … : (applyStatus !== 'success' ? applyMessage : null), statusIsError: applyStatus === 'error'
```

So use `setApplyMessage(msg)` + `setApplyStatus('idle')` for hints and `'error'` for refusals; never
`'success'` (it hides the text). Copy through the same channels as the raster-key refusals
[VERIFIED: PhysicsPaintStudio.tsx:6620-6624 (`const reportNothingChanged = (message: string) => { setLastError(message); setApplyMessage(message); setApplyStatus('error'); };`)].

- D3 refusal: "Lift needs Script ON to erase recorded paint. Turn Script ON, or use Raster Key for a
  pixel-only erase."
- D1 dry no-op: "Dried paint stays — lift only removes wet paint." Throttle once per (track, frame,
  sheet session); a sheet session ends via `onAquarelleSheetSessionEnd` (PhysicsPaintStudio.tsx:6665-6668).
- D4 raster-only declaration: "Erased pixels are permanent — no undo." Show once per key per session
  (a `Set<keyId>` ref), alongside the post-commit success message.
- Unknown durable base: "This key's pre-script base is unavailable — nothing changed."

All non-modal, no dialogs, no new UI surface.

## 8. Tests (TESTS)

- **Vitest collects only `src/**/*.test.ts`** — a `.test.tsx` target runs nothing. New tests must be
  `.test.ts` and pure-module targets.
- New: `roto/aquarelleLiftErase.test.ts` — (a) radius/amount/step constants against the engine values
  (`0.012 + 0.03p`, `3^((s−0.5)·2)`, `0.22`, `0.22·8/60`); (b) `t' = t^K` in linear light (compand
  round-trip); (c) overlapping dabs multiply (K₁·K₂); (d) alpha stays 255; (e) UV→pixel y-flip.
- New Studio contract pins (source text, `.test.ts`): gate ordering (Script-OFF check before the
  stroke-end branch), the erase call passes `baseCanvas` and `mergeBlend: 'pigment-alpha'`, and the
  ink-gate bypass is scoped to the erase path.
- **Breaking pin to update deliberately:** [VERIFIED: PhysicsPaintStudio.test.ts:4406-4407]
  `expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(3);` and
  `expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.delete(')).toBe(2);` — an
  erase-path `set(` makes it 4; update the pin in the same commit, never loosen it.
- Also pinned: the ink gate text at PhysicsPaintStudio.test.ts:2280/2288 — keep the literal
  `if (ink < AQUARELLE_MIN_CAPTURE_INK) return` in the capture block; the erase path must not delete it.
- Existing `aquarelleLayerContract.test.ts` pins the `hasPaint`-gated flush capture
  (AquarelleCanvasLayer.tsx:543-552, `if (!hasPaint) return;`); the erase path uses the Studio
  transaction, so this pin must not change.

## 9. Risks and escalation flags (RISKS)

| Risk | Evidence | Mitigation |
|---|---|---|
| Group frames are not in the truth table | `classifyPhysicPaintRotoGroupFrameTarget` drives route + durable base at PhysicsPaintStudio.tsx:6492-6495, 1768-1779 | **Fail closed + message**, flag for escalation. Group base lives on the source key; a punch would propagate by phase, which the quick never agreed |
| Unknown durable base on a reopened scripted key | map MISSING ⇒ bake already fails closed (`reason: 'durable-base-unknown'`, PhysicsPaintStudio.tsx:1867-1873) | Refuse the erase with a message; no half-written state |
| Track scoping | the pin is per `(appFrame, trackId)` (PhysicsPaintStudio.tsx:6471-6480; capture `trackId` at useRotoFramePersistenceCoordinator.ts:588-594) | Pass the session track (`aquarelleSessionTrackIdRef`), never the live active track |
| Navigation mid-punch | nav flush drains before reload (PhysicsPaintStudio.tsx:6587-6596 → `flushLivePixels`) | Punch + enqueue synchronously at stroke end; the transaction identity gate rejects a stale frame |
| Frame-leave capture invalidates the erase | ink gate precedes `++seq` (6400-6412) and the layer's white capture is gated on `hasPaint` (AquarelleCanvasLayer.tsx:543-552) | No action; verified ordering |
| Chromatic punch approximation | pigment-alpha composite ≠ exact multiply (physicsPaintRotoAlphaMerge.ts:11-21) | Declared; visible only on saturated pixels, bounded few percent |
| Footprint mismatch vs live dabs | live dabs ≠ recorded tick grid; pressure smoothing | Mirror the recorded grid = the bake's own law; declare the residual |
| Dry-in-script resurrection | `if (isAquarelleDryEvent(event)) return true;` (aquarelleRecordState.ts:1488) | Refuse when the frame's script has a Dry (§5) |
| Rapid repeated lifts | a canvas handed to a transaction must not be mutated | Always punch a fresh copy; never mutate `baseCanvas` after enqueue |

**Escalate to a phase if:** group-frame erase is required · the Dry guard is rejected · UAT shows the
punch visibly diverging from the live erase · anyone proposes touching `Engine`/`AquarelleEnginePort`
(the port says "Do NOT widen this interface").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `scriptScale` is 1 for Studio-recorded strokes (only the text writer sets `maxRadius`) | §2 | Punch radius would be too large on replayed strokes |
| A2 | The user accepts a few-percent chromatic deviation from exact `D^K` | §2, §9 | Visible seam between live erase and re-baked pixels |
| A3 | "Immediate refresh" means no manual Apply, not pre-acknowledgement publication | §6 | Would need an optimistic-publish exception |
| A4 | Group frames are out of scope for this quick | §9 | Would need propagation design + UAT rows |
| A5 | The punch's stationery dwell assumes a 60 Hz host (`HOST_DT = 1/60`); the engine derives `dwell` from a dt clamped to 1/240..1/30 (Engine.ts:1658, 1716), so on a 120 Hz host the live dwell amount is half the punched one | §2 | Hold-and-lift erases up to 2× harder than the live pass on non-60 Hz hosts; declared, not corrected (deriving dwell from recorded event timestamps is out of scope) |

## Sources

- Code read this session: `packages/efx-watercolor/src/playground/{Engine,shaders,params,spectral}.ts`,
  `packages/efx-watercolor/src/adapter/engineAdapter.ts`,
  `app/src/components/physic-paint/{PhysicsPaintStudio.tsx, engine/AquarelleCanvasLayer.tsx,
  engine/PhysicsPaintCanvasMount.tsx, hooks/useRotoFramePersistenceCoordinator.ts,
  hooks/useRotoReferenceController.ts, roto/physicsPaintRotoAlphaMerge.ts,
  view/aquarelleRecordState.ts, performance/scriptTimelineCodec.ts, PhysicsPaintStudio.test.ts}`,
  `app/src/lib/rasterAlpha.ts`.
- Precedent: commit `6eee6fda` — "fix(261003-hpi): erase UAT — order-independent remove, cache pixel
  erase, leave/return keeps paint" (touches the same coordinator + merge files).

## Metadata

**Confidence:** Stack/seams HIGH (all quoted verbatim); punch math HIGH for the neutral case, MEDIUM
for chromatic parity; message/test guidance HIGH.
**Research date:** 2026-10-28
**Valid until:** ~30 days (stable internal seams).

## Addendum (2026-10-28, after discussion — READ THIS FIRST)

D1 was **reopened by the user**: Lift now ALSO erases `fixed` pigment.

- `Engine.lift()` must draw `this.fixed` with the same lift program/blend (absorbance multiply),
  after ink and wet, and must protect the fixed views for undo
  (`history.protect(1, rect + margin, this.fixed.views)`) before drawing — the `fix()` pattern at
  Engine.ts:1223.
- This is an engine BEHAVIOR change (lift pass + fixed undo protection), not a new vendor API and
  not a new undo kind. The user authorized it; if the planner judges it unsafe, STOP and escalate
  to a phase.
- **§5's Dry-in-script hazard is DISSOLVED.** A recorded Dry followed by a recorded Lift now
  replays the lift against fixed pigment, so no refusal is needed for Dry-containing scripts.
  Do NOT implement the "refuse when the script contains a Dry" guard recommended in §5/§9.
- **§7's "Dried paint stays" no-op hint is DROPPED.** The live-dry row now erases fixed pigment.
- The punch law (§2) is unchanged: the stored composite is still transmittance, punched by
  `t' = t^K` in linear light.
- Truth table row 4 changes to: live-dry × either → erases fixed pigment (new engine behavior);
  script entry when ON; engine step + fixed-layer snapshot; replay erases fixed after the Dry.
- Declared consequences: "Dry is permanent" no longer applies to Lift (it stays true for other
  tools); existing recorded Lift events that were no-ops after a Dry become effective on the next
  Apply. Existing engine tests that pin lift to ink/wet only must be updated deliberately.
- Everything else in this document (detection, three copies, commit, display, messages for D3/D4,
  tests, risks) stands.
