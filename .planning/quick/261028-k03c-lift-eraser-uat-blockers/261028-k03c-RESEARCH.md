# Quick 261028-k03c: Lift eraser UAT blockers, real footprint cursor, sidebar Brush tab, tip shapes — Research

**Researched:** 2026-10-28
**Domain:** Watercolor (aquarelle) engine internals — WebGL shaders, script/bake replay, raster transmittance punch, Preact signal UI
**Confidence:** HIGH (all anchors read from source this session)

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1. Separate Lift tip selection (user, 2026-10-28)**
- New signal `aquarelleLiftTipId` (default `'filbert'`); the Lift section picker never flips the active tool to Brush and never mutates the Brush selection.
- `aquarelleSelectedTipId` default changes `'chalk'` → `'filbert'` (new Brush strokes only; existing strokes keep their recorded `brushId`).
- Both selections are recorded per stroke: Brush already records `brushId`; Lift records its chosen tip in the same `brushId` field so live, bake and punch share one number.

**D2. Brush response has two views, one state (user: "Both tabs")**
- Restore the sidebar **Brush** tab: brush catalog + `BrushResponsePanel` + tip/shape selector + a Lift section (Lift tip/shape, strength, Select lifts).
- The **Settings** tab keeps `BrushResponsePanel` (unchanged). Same signals and setters — no duplicated state.

**D3. Lift shape selector in both surfaces (user: "Both")**
- Top-bar Lift cluster: Shape + Strength + Select lifts.
- Sidebar Brush tab → Lift section: Shape + Strength + Select lifts.
- One signal (`aquarelleLiftTipId`), always in sync.

**D4. Scripted base recovery (fail-closed)**
- `planAquarelleLiftErase` returns `recoverBase: true` instead of refusing when `scripted && !has(keyId)`. Every other refusal stays (group, Script OFF with a script, no displayable pixels).
- Recovery: bake the script EXCLUDING the just-recorded lift event, decode P (displayed composite) and S (raw bake sheet), invert the pigment-alpha law per pixel, encode B as an opaque WebP transmittance sheet.
- Validate by recomposing S over B with `mergeRotoAlphaCanvases(..., 'pigment-alpha')`; require mean absolute error ≤ 3/255. On failure fall back to today's refusal and record a diagnostic. Never silently adopt a bad base.
- One-time cost per legacy key: seed the map, `markDirty()`, then all later lifts use the persisted base.
- Saturated pixels (`a ≥ 0.97`) write white — a lift erases there anyway.

**D5. Lift footprint is tip-shaped in the engine and in the punch**
- Extend `liftFS` in place with the tip footprint (`uTip`, `uTipAspect`, `uRound`, `uAxis`); keep the lift radius law `(0.012 + 0.03·pr)·sizeMult`. Reuse the `stampFS` uniform pattern.
- `Engine.lift()` binds the same `this.brush` tip, aspect and angle the brush uses; the `onLiftDab` callback gains the angle so the cached-base preview matches.
- `buildLiftCoverage` and `collectLiftDabs` (`roto/aquarelleLiftErase.ts`) mirror the same shape/aspect/rotation/tip falloff; the punch stays WYSIWYG. Copy/Apply reproduces the shape.
- **Escalation:** a genuinely NEW vendor engine API or a new undo kind ⇒ STOP and propose a phase. Editing `liftFS`/`Engine.lift` in place is NOT a new API.

**D6. Cursor = engine footprint law**
- `AquarelleBrushCursor` computes the radius from the same law the engine uses (`toEngineParams(size)` → `sizeMult` → per-tool radius) and the shape from the active tip (aspect, rotation, rect vs ellipse vs circle). Convert doc-height units to CSS px with the displayed canvas rect height.
- Hover pressure 0.4; during a stroke use the live pen pressure; speed term 0 for the preview (matches the engine's own `updateCursor`, which redraws on hover).
- Keep the DOM overlay (`pointer-events: none`), hide in select/move modes, keep the crosshair fallback below 8 CSS px. Lift uses the selected Lift tip shape.

**D7. Raster persistence**
- Fence automatic settle captures for the same (track, frame) while `aquarelleLiftEraseInFlightRef` is true (skip with a diagnostic; later captures and other frames unaffected).
- Keep the merge-base pin before the commit await; restore on failure.
- Retry `captureLivePixels` once on `false` (stale revision/lease) before publishing a failure; record attempt/outcome in the `lift-erase` diagnostic stage.
- After the ack and the durable map write (including the `willPinBase` path), call `studioScriptSnapshot.markDirty()`.
- Leave/return must resolve the punched key payload, not a stale auto capture.

**D8. Truth table (agreed 2026-10-28)**

| # | Frame state | Script | Durable base | Visible result | Authoritative store | Script entry | Apply outcome |
|---|---|---|---|---|---|---|---|
| 1 | cooked + script | ON | known bytes | punch base + record | key payload + base map | Lift event | re-bake over punched base |
| 2 | cooked + script | ON | known empty | record; base stays empty | key payload | Lift event | script erase only |
| 3 | cooked + script | ON | unknown (legacy) | recover base, validate ≤3/255, punch, record | recovered base + key payload | Lift event | re-bake over recovered base |
| 4 | cooked + script | ON | unknown, validation fails | refuse, nothing erased | — | none | unchanged |
| 5 | cooked + script | OFF | any | refuse at pointerdown | — | none | unchanged |
| 6 | raster-only | ON | unknown → pins | punch + record; fenced, retried, markDirty | key payload + base map | Lift event | punched base |
| 7 | raster-only | OFF | unknown → pins | punch; permanent; survives leave/return/reopen | key payload + base map | none | pixels authoritative |
| 8 | live sheet | ON/OFF | n/a | live engine erase, tip-shaped | live sheet → capture | ON only | replay tip-shaped |

**Footprint table (agreed)**

| Tool | Radius law | Shape | Rotation |
|---|---|---|---|
| brush | `(b.size[0] + (b.size[1]-b.size[0])·pr^pressureSize) · clamp(1-speed·speedThin, 0.4, 1) · sizeMult · 0.8` | tip ellipse / rounded rect / tip mask | fixed / follow / random |
| water | brush × 1.3 × (1 + min(speed,2.5)·0.12) | same tip | same |
| pen | `(0.0016 + 0.0042·pr) · clamp(1.12 - speed·0.3, 0.55, 1.12) · sizeMult` | circle | none |
| lift | `(0.012 + 0.03·pr) · sizeMult` | tip aspect + rotation + tip mask | fixed / follow / random per tip |

### Claude's Discretion
- Exact component split (shared footprint helper vs. app-local duplicate) as long as one law source governs engine and cursor.
- Sidebar Brush tab layout and control ordering.
- Diagnostic stage field names beyond `base-recovery-start` / `base-recovery-ok|failed`.

### Deferred Ideas (OUT OF SCOPE)
None stated. Scope is exactly the four native-UAT findings in `## Task Boundary` of CONTEXT.md.

## Summary

The four UAT failures have four distinct root causes, all confirmed in source. (1) The scripted Lift gate is a deliberate fail-closed refusal (`PhysicsPaintStudio.tsx:5914-5916`) backed by a recorder that refuses any frame that already has events (`:6764-6772`, reason `script-already-present`) — recovery must bypass the recorder and write `aquarelleDurableBaseByKeyRef` directly after a validated bake inversion. (2) The raster path never arms the snapshot save and races the auto settle capture; the critical subtlety is that `markDirty()` is a **no-op** when the content signature is unchanged (`studioScriptSnapshotController.ts:877`), and that signature is only the aquarelle stroke revision (`PhysicsPaintStudio.tsx:1135`) — so a late durable-base write must bump the revision, not just call `markDirty()`. (3) The cursor is a plain circle sized from the raw slider value (`AquarelleCanvasLayer.tsx:91-94`), off by ~2.7× from the true engine footprint at the default size. (4) The tip infrastructure already exists end-to-end (`stampFS` uniforms, `BRUSH_PRESETS`, `buildBrushForStroke`, per-stroke `brushId` + `toolOverrides`); the gap is purely that `liftFS`/`Engine.lift` never bind a tip, plus two UI surfaces that were retired or never existed.

**Primary recommendation:** keep every change in place — extend `liftFS` + `Engine.lift`, add an app-local footprint mirror for the cursor, add one `aquarelleLiftTipId` signal plus one recovered durable-base module — and treat the two contract-test pin families (the `pushAquarelleLiftPreviewDab` string and the `'color'|'settings'|'paper'|'memory'` tab union) as part of the same tasks that break them.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Lift footprint shape (live erase) | Vendor engine (`packages/efx-watercolor` — `liftFS`, `Engine.lift`) | — | The GL blend is the erase; only the shader can shape it |
| Lift footprint shape (cached punch + preview) | App raster (`roto/aquarelleLiftErase.ts`) | — | The punch must reproduce what a re-bake replays |
| Cursor preview | App DOM overlay (`AquarelleCanvasLayer.tsx`) | Vendor law (mirrored) | Engine cursor is disabled (`new WatercolorEngine(canvas, null, …)`) |
| Scripted base recovery | App transaction (`PhysicsPaintStudio.tsx` + new recovery module) | Controller bake legs (`physicsPaintRotoPlayScriptController.ts`) | Reuses the Apply bake; writes the snapshot-owned base map |
| Raster persistence | Persistence coordinator (`useRotoFramePersistenceCoordinator.ts` → `rotoLivePixelCacheTransactions.ts`) | Snapshot controller (base map durability) | Key payload and script snapshot are two different channels |
| Tip/shape selection | View state (`view/aquarelleRecordState.ts`) | Right panel + top bar (both read the same signals) | One signal, two surfaces (D2/D3) |

## Findings by area

### Area 1 — Scripted Lift on frames with an empty/unknown SNAP v5 durable-base section

**Current refusal, verbatim** — `[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:5910-5917]`:

```ts
    // A reopened scripted key whose pre-script base was never pinned: a MISSING
    // entry (`has === false`) is UNKNOWN, distinct from a known-empty `null`.
    // Only `scripted` refuses — a raster-only key under Script ON always has a
    // punchable base. The script publish would fail closed anyway.
    if (scripted && !aquarelleDurableBaseByKeyRef.current.has(target.keyId)) {
      return { kind: 'refuse', message: AQUARELLE_LIFT_UNKNOWN_BASE_REFUSAL };
    }
    return { kind: 'erase', frame, trackId, keyId: target.keyId, scripted, willPinBase };
```

**Plan shape to extend** — `[VERIFIED: PhysicsPaintStudio.tsx:276-279]`:

```ts
type AquarelleLiftErasePlan =
  | { kind: 'normal' }
  | { kind: 'refuse'; message: string }
  | { kind: 'erase'; frame: number; trackId: string; keyId: string; scripted: boolean; willPinBase: boolean };
```

Adding `recoverBase: boolean` to the `erase` variant (D4's own wording) keeps both consumers intact: the preview activation compares `planAquarelleLiftErase(frame).kind === 'erase'` `[VERIFIED: PhysicsPaintStudio.tsx:5931]` and stroke-end runs `if (liftPlan?.kind === 'erase')` `[VERIFIED: PhysicsPaintStudio.tsx:6283]`.

**The recorder that must be bypassed** — `[VERIFIED: PhysicsPaintStudio.tsx:6759-6772]`:

```ts
    // A frame that already carries a script began it in an EARLIER sheet
    // session (this launch's first stroke always arrives with zero events).
    // Its current pixels are a flattened composite, not the pre-script base —
    // recording them would double the earlier strokes on the next bake. Leave
    // the base UNKNOWN: the script publish fails closed instead.
    if (getAquarelleEventsForFrame(appFrame).length > 0) {
      recordAquarelleRenderSplitEvent('durable-base-record', {
        appFrame,
        keyId: target.keyId,
        recorded: false,
        reason: 'script-already-present',
      });
      return;
    }
```

Recovery therefore cannot go through `recordAquarelleOrdinaryDurableBaseRef`; it must write the map directly (the success write it must imitate is `[VERIFIED: PhysicsPaintStudio.tsx:6791-6792]`):

```ts
    const bytes = new Uint8Array(baseBytes);
    aquarelleDurableBaseByKeyRef.current.set(target.keyId, bytes);
```

**The map is snapshot-owned** — `[VERIFIED: PhysicsPaintStudio.tsx:1181-1187]`:

```ts
      getDurableBases: () => aquarelleDurableBaseByKeyRef.current,
      seedDurableBases: (bases) => {
        const durableBaseMap = aquarelleDurableBaseByKeyRef.current;
        for (const [keyId, bytes] of bases) {
          if (durableBaseMap.has(keyId)) continue;
          durableBaseMap.set(keyId, bytes === null ? null : new Uint8Array(bytes));
        }
      },
```

and `[VERIFIED: app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:151]`:

```ts
  getDurableBases?: () => ReadonlyMap<string, Uint8Array | null> | null;
```

**The bake legs to reuse** — `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1852-1894]`:

```ts
export async function applyAquarelleEventsToKey(input: {
  events: readonly AquarellePayloadEvent[];
  target: { keyId: string; appFrame: number };
  size: { width: number; height: number };
  paper: AquarelleBakePaper;
  /** 261022 Apply parity: per-fully-fed-stroke progress (Dry excluded). */
  onStrokeFed?: (completed: number, total: number) => void;
  publish: (frame: { keyId: string; appFrame: number; bytes: Uint8Array; width: number; height: number }) => Promise<boolean>;
}): Promise<boolean> {
```

Body order (verbatim anchors `:1861-1893`): `createDefaultAquarelleAdapter` → `defaultCreateAquarelleBake` → `await bake.bake(input.events)` → `const last = result.frames[result.frames.length - 1]` → `await bake.flush()` → `publish({ … bytes: last.bytes … })` → `finally { bake.dispose(); adapter.dispose(); }`. The `dispose()` order in the `finally` is the one a split helper must preserve.

**Event selection is by mutationId, and the lift event is already recorded before the transaction runs.** `[VERIFIED: PhysicsPaintStudio.tsx:6245-6246]`:

```ts
      const mutationId = paintMutationLedger.allocateStrokeMutation({ primary: paintStroke });
      aquarelleStrokeMutationIdsRef.current.set(stroke, mutationId);
```

`[VERIFIED: PhysicsPaintStudio.tsx:6274]` `recordAquarelleStrokeWhenEnabled(scriptRecordingOn, mutationId, { ...stroke, mutationId }, capturedKeyId);` then `[VERIFIED: PhysicsPaintStudio.tsx:6283]` `if (liftPlan?.kind === 'erase') void runAquarelleLiftErase(liftPlan, stroke);`. So the exclusion set is `getAquarelleEventsForFrame(frame)` minus the event whose `engine.mutationId === aquarelleStrokeMutationIdsRef.current.get(stroke)`. Dry events are global and stay `[VERIFIED: app/src/components/physic-paint/view/aquarelleRecordState.ts:1492-1501]`.

**Codec legs are async and already exist** — `[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:350-381]`: `decodeLiftEraseFrame` uses `createImageBitmap(new Blob([...], { type: 'image/webp' }), { premultiplyAlpha: 'premultiply' })`; `encodeLiftEraseFrame` awaits `encodeRotoFrameFromCanvas(canvas, appFrame, size)`. `[VERIFIED: app/src/components/physic-paint/roto/rotoCanvasFrames.ts:160-165]`:

```ts
export async function encodeRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }, mutationId?: number): Promise<RenderedFramePayload> {
```

**Validation merge law** — `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts:37-60]`:

```ts
export async function mergeRotoAlphaCanvases(
  baseFrame: Pick<PhysicPaintRenderedFrame, 'bytes'> | null,
  scriptAlphaCanvas: HTMLCanvasElement,
  size: RotoAlphaMergeSize,
  // 261003-erase-uat (B): the engine's ERASED copy of the cached paint. When a
  // pixel erase punched the preview base, merging the original cached bytes
  // resurrects the removed paint — draw the erased layer instead.
  baseCanvas?: HTMLCanvasElement | null,
  blend: RotoAlphaMergeBlend = 'source-over',
): Promise<HTMLCanvasElement> {
  …
  if (blend === 'pigment-alpha') {
    // Round 2 law: paper white → cached base → converted live sheet. Over an
    // opaque base this stores t' = a·C + (1-a)·t_base; a partial-alpha base
    // shows paper instead of a black hole (single fond multiply downstream).
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
  }
```

Passing `baseFrame: null` + `baseCanvas: B` reproduces `P = a·C + (1-a)·B` exactly (`:61-66`), which is the inversion target.

**Edge cases the inversion must handle** (derived, not yet in source):
- `a ≈ 0` (S is white, no pigment): formula divides by zero — must pass `B = P` through unchanged.
- `a ≥ 0.97`: write white (D4).
- Out-of-range results: clamp 0..255 before encoding.
- P and S must be the same pixel size; the punch already sizes by `aquarelleLiftSizeRef.current` `[VERIFIED: PhysicsPaintStudio.tsx:5881-5882]`.

### Area 2 — Raster-only Lift lost on frame leave/return

**The raster transaction, verbatim tail** — `[VERIFIED: PhysicsPaintStudio.tsx:6189-6196]`:

```ts
    } catch {
      if (mergeBasePinned) aquarelleMergeBaseRef.current = previousMergeBase;
      revertAquarelleLiftPreview();
      publish(AQUARELLE_LIFT_FAILURE_MESSAGE);
    } finally {
      finish();
    }
  }, []);
```

There is **no** `markDirty()` anywhere in `runAquarelleLiftErase` (`:5956-6196`, read in full this session).

**The `markDirty()` trap** — `[VERIFIED: studioScriptSnapshotController.ts:873-888]`:

```ts
  function markDirty(): void {
    if (!boundIdentity) return;
    // The restore's seed bumps are the new baseline, not a mutation.
    if (restoringCount > 0) return;
    if (deps.getContentSignature() === lastSavedSignature) return;
    if (writeBusy) {
```

and the signature is only the stroke revision — `[VERIFIED: PhysicsPaintStudio.tsx:1135]`:

```ts
      getContentSignature: () => `${aquarelleStrokesRevision.peek()}`,
```

`[VERIFIED: app/src/components/physic-paint/view/aquarelleRecordState.ts:395-400]`:

```ts
export const aquarelleStrokesRevision = signal(0);

/** Compare-free internal bump — every caller already changed the stroke set. */
export function bumpAquarelleStrokesRevision(): void {
  aquarelleStrokesRevision.value += 1;
}
```

The existing coalescing subscription is `[VERIFIED: PhysicsPaintStudio.tsx:1231-1239]` (`effect(() => { aquarelleStrokesRevision.value; … studioScriptSnapshot.markDirty(); })`). **Consequence:** a durable-base write that happens ~1.5 s after stroke end (the punch awaits decode/encode/commit) can land after the debounced save already recorded that revision — `markDirty()` then returns at line 877 and the base never reaches SNAP v5. The fix is a revision bump in the same tick as the map write (the subscription then calls `markDirty` for free); calling `markDirty()` explicitly as D7 says is harmless (`:883` only skips when a timer is already armed).

**The capture race, verbatim** — `[VERIFIED: app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts:82]`:

```ts
  | Readonly<{ ok: false; reason: 'stale-target' | 'unresolved-target' | 'ambiguous-target' | 'empty-target' | 'lease-or-settlement-rejected' }>;
```

and its cause — `[VERIFIED: useRotoFramePersistenceCoordinator.ts:182-183]`:

```ts
    if (!update.ok || !update.changed) {
      return Object.freeze({ ok: false, reason: 'lease-or-settlement-rejected' });
```

The stale-before-commit gate the Studio's flush exists to defeat — `[VERIFIED: app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts:184-186]`:

```ts
          commit: async (value) => {
            const current = input.resolveCurrent();
            if (revisions.get(key) !== pixelRevision || !matchesIdentity(input.identity, current)) return reject('stale-before-commit');
```

**Where the fence belongs** — `handleAquarelleCaptureFrame` `[VERIFIED: PhysicsPaintStudio.tsx:6804]`, `runCapture` `[VERIFIED: :6851]`, `targetTrackId` resolved at `[VERIFIED: :6860-6865]`, merge base read at `[VERIFIED: :6893-6906]`. The fence must sit **after** `targetTrackId` is known and **before** the merge-base block, so other (track, frame) captures are untouched. The in-flight flag is currently a bare boolean — `[VERIFIED: PhysicsPaintStudio.tsx:1450]`:

```ts
  const aquarelleLiftEraseInFlightRef = useRef(false);
```

A second ref carrying `{ frame, trackId }` is needed to scope the fence (D7: "for the same (track, frame)").

**The retry pattern to mirror** — `[VERIFIED: PhysicsPaintStudio.tsx:6988-6991]`:

```ts
        if (aquarelleLatestCaptureSeqByFrameRef.current.get(playFrame) !== seq) return;
        const retryLaunch = launchContextRef.current;
        if (!retryLaunch || retryLaunch.operationId !== operationId) return;
        const retriedWork = enqueue(2);
```

**Leave/return refresh already exists** — `[VERIFIED: PhysicsPaintStudio.tsx:6162-6174]` (content-token reconcile + `loadCachedRotoReferenceFrame(plan.frame, previewBasePort, undefined, true, generation)` + `physicPaintVersion.value++`). It runs after the durable map write (`:6157`), so the remaining loss must come from the capture race and/or the missing snapshot save, not from a missing refresh.

### Area 3 — Cursor preview is a CSS circle from the size slider

**The bug, verbatim** — `[VERIFIED: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:91-94]`:

```tsx
  const brushSize = aquarelleParams.value.size;
  const showCircle = brushSize >= 8;
  const size = showCircle ? brushSize : CURSOR_CROSSHAIR_SIZE;
  const r = size / 2 - 1.5;
```

with `[VERIFIED: AquarelleCanvasLayer.tsx:67]` `const CURSOR_CROSSHAIR_SIZE = 23;` and the hide rule `[VERIFIED: AquarelleCanvasLayer.tsx:83-85]` (`aquarelleSelectMode.value || temporaryMove.value`).

**The engine cursor that is disabled** — `[VERIFIED: AquarelleCanvasLayer.tsx:407-410]`:

```tsx
      engine = new WatercolorEngine(
        canvas,
        null,
```

(the second argument is the cursor element; `null` = no engine cursor). Its math, for reference — `[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1508-1519]`:

```ts
    const r = this.radius(tool, this.stroke ? this.pressureOf(this.stroke, -1) : 0.4, 0);
    const shaped = tool === 'brush' || tool === 'water';
    const b = this.brush;
    const d = Math.max(4, (2 * r * this.view.h) / this.dpr);
    const h = shaped ? Math.max(3, d * b.aspect) : d;
```

**The law to mirror** — `[VERIFIED: Engine.ts:1525-1544]`:

```ts
  private sizeMult() { return Math.pow(3, (this.params.size - 0.5) * 2) * (this.scripting ? this.scriptScale : 1); }

  /** Footprint radius in document heights. */
  private radius(tool: Tool, pr: number, speed: number) {
    const m = this.sizeMult();
    switch (tool) {
      case 'pen': return (0.0016 + 0.0042 * pr) * clamp(1.12 - speed * 0.3, 0.55, 1.12) * m;
      case 'brush': return this.brushRadius(pr, speed);
      case 'water': return this.brushRadius(pr, speed) * 1.3 * (1 + Math.min(speed, 2.5) * 0.12);
      case 'lift': return (0.012 + 0.03 * pr) * m;
    }
  }

  /** Half the long axis of the current brush's footprint, in document heights. */
  private brushRadius(pr: number, speed: number) {
    const b = this.brush;
    const t = Math.pow(clamp(pr, 0, 1), b.pressureSize);
    // preset sizes describe the full footprint; 0.8 keeps a hard-pressed stroke on a desktop screen sane
    return (b.size[0] + (b.size[1] - b.size[0]) * t) * clamp(1 - speed * b.speedThin, 0.4, 1) * this.sizeMult() * 0.8;
  }
```

**Slider → engine size** — `[VERIFIED: packages/efx-watercolor/src/playground/params.ts:60-65,79]`: `sizeToEngineScale` returns `Math.max(0, sizePx / 32)` for `sizePx <= 32`, and `toEngineParams` maps `size: sizeToEngineScale(num(p.size, d.size))`. At the default `size: 12` `[VERIFIED: app/src/components/physic-paint/view/aquarelleRecordState.ts:70-79]` the engine size is `0.375`, `sizeMult = 3^-0.25 ≈ 0.7598`, and the lift radius at hover pressure 0.4 is `(0.012 + 0.03·0.4)·0.7598 ≈ 0.0182` document heights — i.e. a ~33 px diameter on a 900 px-tall canvas versus the 12 px circle drawn today.

**Doc units → CSS px** — the pointer handler already has the rect `[VERIFIED: AquarelleCanvasLayer.tsx:799-803]`:

```tsx
      onPointerMove={(event) => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        cursorX.value = event.clientX - rect.left;
        cursorY.value = event.clientY - rect.top;
```

so `rect.height` is the doc-height scale (UV y spans 0..1 over the box). The engine's own `d` is already CSS px because it divides backing-store height by `dpr` `[VERIFIED: Engine.ts:1511]`.

**Shape fields are cheap; tip generation is not.** `[VERIFIED: packages/efx-watercolor/src/playground/brushes.ts:70]` `export const TIP_SIZE = 192;` and `[VERIFIED: brushes.ts:348-362]` `buildBrush` generates a 192×192 procedural tip (36 864 samples) on every call. The cursor must therefore read `aspect`/`rotation`/`angle` numerically (preset × multiplier) and must NOT call `buildBrushForStroke` per pointer move. The multiplier law to mirror — `[VERIFIED: packages/efx-watercolor/src/playground/brushBridge.ts:62-73]`:

```ts
  if (!overrides) return base
  return {
    ...base,
    aspect: base.aspect * mult(overrides.aspect),
    angle: base.angle * mult(overrides.rotation),
```

Filbert, the new default — `[VERIFIED: brushes.ts:253-255]`:

```ts
    id: 'filbert', name: 'Filbert', hint: 'Oval tip: soft rounded marks that change with direction',
    aspect: 0.55, rotation: 'fixed', angle: 25, angleJitter: 2,
    size: [0.012, 0.036], spacing: 0.18, wetRound: 0.5,
```

### Area 4 — Missing Lift tip options and the retired sidebar Brush tab

**Current default** — `[VERIFIED: aquarelleRecordState.ts:91-97]`:

```ts
// 261027-gh9f: Studio opens on the dry CHALK stick — it is the first card in
// the Brush tab and the preset the dry-media work targets. The preset's own
// shape lives in BRUSH_PRESETS; the multiplier bag starts neutral.
export const aquarelleSelectedTipId = signal<string | null>('chalk');
export const aquarelleToolOverrides = signal<AquarelleToolOverrides>({
  ...NEUTRAL_TOOL_OVERRIDES,
});
```

**The picker that must not be reused** — `[VERIFIED: aquarelleRecordState.ts:189-192]`:

```ts
  const nextId = tip ? tip.id : preset ? preset.id : null;
  // A successful pick is a brush-tool variant pick — flip the tool first
  // so a re-pick of the already-selected id still returns to Brush.
  if (nextId !== null) setAquarelleTool('brush');
```

Both existing pickers call it: `[VERIFIED: app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx:71]` `onClick={() => selectAquarelleTip(preset.id)}` and `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx:131-132]`. A Lift picker must use a new `setAquarelleLiftTipId` (compare-then-write) and a presentational row with an explicit `onPick`.

**The unmounted tab** — `[VERIFIED: app/src/components/physic-paint/view/RightPanelBrushTab.tsx:18-27]` renders only `<WatercolorBrushLibrary />`; the panel's list is `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx:205-207]`:

```ts
  const topPaneTabs = ['color', 'settings', 'paper', 'memory'] as ReadonlyArray<
    'color' | 'settings' | 'paper' | 'memory'
  >;
```

with `[VERIFIED: PhysicsPaintRightPanel.tsx:113-121]`:

```ts
const TOP_PANE_TAB_LABELS: Readonly<
  Record<'color' | 'settings' | 'paper' | 'memory', string>
> = Object.freeze({
  color: 'Color',
  settings: 'Settings',
  paper: 'Paper',
  // quick-261023-ors: the LAST tab — read-only script-memory gauge + purge.
  memory: 'Memory',
});
```

and the local state union `[VERIFIED: PhysicsPaintRightPanel.tsx:209-211]` (`useState<'color' | 'settings' | 'paper' | 'memory'>('color')`). Three places, all typed by the same literal union.

**Settings keeps its panel** — `[VERIFIED: app/src/components/physic-paint/view/RightPanelSettingsTab.tsx:14-19]` (`<BrushResponsePanel />` only).

**Top-bar Lift cluster** — `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:222-252]`: `data-testid="physics-lift-controls"` wrapping `Eraser` + `SliderStepper id="physics-lift-strength"` (min 5, max 90) + the `physics-lift-select` button. A Shape control joins this row before Strength per D3.

**Tip recording already works for Brush** — `[VERIFIED: aquarelleRecordState.ts:295-300]`:

```ts
  return {
    params,
    toolOverrides: { ...aquarelleToolOverrides.value },
    brushId: aquarelleSelectedTipId.value ?? '',
    tool: aquarelleActiveTool.value,
  };
```

and the stroke end stamps it `[VERIFIED: AquarelleCanvasLayer.tsx:444-446]`:

```tsx
              brushId: snap.brushId || brushIdForSelection(),
              points,
              toolOverrides: { ...snap.toolOverrides },
```

**Gap for Lift:** the stroke's `tool` can be forced by the engine (stylus eraser end) `[VERIFIED: AquarelleCanvasLayer.tsx:434-440]`, while `snap.brushId` always reads the Brush selection. A stylus-eraser lift would therefore record the Brush tip as its `brushId`. The recorded tip must be derived from the recorded tool, not from the live selection.

### Area 5 — Tip-shaped lift in the engine and in the punch

**`liftFS` today, verbatim** — `[VERIFIED: packages/efx-watercolor/src/playground/shaders.ts:265-276]`:

```glsl
// Multiplicative stamp (blend ZERO, ONE_MINUS_SRC_COLOR): blotting with a tissue.
export const liftFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform float uAspect, uRadius, uAmount;
uniform vec2 uPoint;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  float f = uAmount * exp(-pow(dot(p, p) / (uRadius * uRadius), 2.0));
  o0 = vec4(f);
  o1 = vec4(f);
}`;
```

**The `stampFS` pattern to copy** — `[VERIFIED: shaders.ts:35-66]`; the load-bearing lines are `[VERIFIED: :38-41,44-47,56-61]`:

```glsl
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter;
uniform vec2 uPoint, uAxis;
…
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
…
  float th = uRough * 0.45;
  float dry = smoothstep(th, th + 0.02, t);
  float sharp = mix(t, dry, step(0.0001, uRough));
  float d = dot(q, q);
  float round = 1.0 - smoothstep(0.15, 1.0, d);
  float f = mix(sharp, round, uRound);
```

**Replay parity requirement (derived):** with `uAxis = (1,0)`, `uTipAspect = 1` and `uRound = 1`, `dot(q,q) === dot(p,p)/r²`, so `f = uAmount · exp(-(q²)²)` is bit-identical to today's law. The plan must keep that branch exact — it is what makes legacy strokes replay unchanged.

**`Engine.lift` today** — `[VERIFIED: Engine.ts:1880-1907]`:

```ts
  private lift(x: number, y: number, r: number, amount: number) {
    const { gl, g } = this;
    const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
    this.touch(rect);
    …
    p.bind();
    gl.uniform1f(p.u.uAspect, this.dw / this.dh);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    …
    this.callbacks.onLiftDab?.(x, y, r, amount);
```

Callback contract `[VERIFIED: Engine.ts:46]`:

```ts
  onLiftDab?(x: number, y: number, r: number, amount: number): void;
```

Dispatch `[VERIFIED: Engine.ts:1723-1729]`:

```ts
      case 'lift': {
        // 261028-k03b: strength is a canonical param (lift/100) recorded per
        // stroke, so the live pass, the bake replay and the cached-raster
        // punch share one number. The 0.22 default keeps old strokes exact.
        const amount = Math.min(0.9, P.lift * dwell);
        this.lift(x, y, r, amount);
        break;
      }
```

Lift bypasses `eachDab`, so it never receives `this.brushAngle(s)` — `[VERIFIED: Engine.ts:1747]` `fn(dx, dy, dr, this.brushAngle(s));` is the only angle source today. The lift branch must compute the angle itself.

**Uniform binding to copy** — `[VERIFIED: Engine.ts:1756-1767]`:

```ts
    gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
    gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
    gl.uniform1f(p.u.uAspect, t.w / t.h);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    gl.uniform1f(p.u.uTipAspect, b.aspect);
    gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
    gl.uniform1f(p.u.uRound, round);
```

**Rect extent is already sufficient** — `[VERIFIED: Engine.ts:1796-1800]`:

```ts
  private stampRect(x: number, y: number, r: number, w: number, h: number, extent: number): Rect {
    const e = Math.ceil(r * extent * h) + 2;
```

`extent: 2` covers any ellipse whose long axis is `r` (aspect ≤ 1), so the lift rect needs no change — and must not shrink.

**Punch law today** — `[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:249-259]`:

```ts
    const r2 = dab.rPx * dab.rPx;
    for (let y = y0; y <= y1; y += 1) {
      const dy = y - dab.cy;
      for (let x = x0; x <= x1; x += 1) {
        const dx = x - dab.cx;
        const q = (dx * dx + dy * dy) / r2;
        const f = dab.amount * Math.exp(-(q * q));
```

Radius/spacing law it mirrors — `[VERIFIED: aquarelleLiftErase.ts:47-60,136-137]` (`LIFT_SIZE_BASE = 0.012`, `LIFT_SIZE_PRESSURE = 0.03`, `LIFT_SPACING_FRAC = 0.5`) and `[VERIFIED: Engine.ts:1656-1659]` (`return tool === 'brush' || tool === 'water' ? b.spacing * Math.sqrt(b.aspect) : 0.5;` — lift is the 0.5 branch).

**Dab type and the preview bridge** — `[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftErase.ts:62-68]`:

```ts
/** One lift dab in document UV (y up); `r` is in document heights. */
export interface LiftDab {
  x: number;
  y: number;
  r: number;
  amount: number;
}
```

and `[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftPreview.ts:23-31]` (`AquarelleLiftPreviewDab { x, y, r, amount }`). The preview sink feeds the same `buildLiftCoverage` `[VERIFIED: app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx:53-55]`, so extending `LiftDab` extends the preview automatically.

## Recommended seams

### S1 — Base recovery: new pure module + one plan flag

`app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts` (new, app-local, `.test.ts`-testable):

```ts
export interface BaseRecoveryResult { bytes: Uint8Array; canvas: HTMLCanvasElement; meanAbsError: number; }
export function invertPigmentToBase(
  composite: ImageData, sheet: ImageData, width: number, height: number,
): Uint8ClampedArray;              // D4 math; a≈0 → passthrough, a≥0.97 → white, clamp 0..255
export async function recoverAquarelleDurableBase(input: {
  events: readonly AquarellePayloadEvent[];   // lift event already excluded
  displayed: { bytes: Uint8Array; width: number; height: number };  // P
  size: { width: number; height: number };
  paper: AquarelleBakePaper;
  appFrame: number;
}): Promise<BaseRecoveryResult | null>;      // null on bake/decode/validation failure
```

- Reuse, do not duplicate, the bake: split `applyAquarelleEventsToKey` into `bakeAquarelleEventsToFrame(input): Promise<RenderedFramePayload | null>` (adapter + bake + `bake.flush()` + `finally { bake.dispose(); adapter.dispose(); }`) and keep `applyAquarelleEventsToKey` as `bake…` + `publish`. The `finally` dispose order `[VERIFIED: physicsPaintRotoPlayScriptController.ts:1888-1893]` must survive the split.
- Decode P and S with `DEFAULT_LIFT_ERASE_CODEC.decode` `[VERIFIED: aquarelleLiftErase.ts:384-387]`; encode B with `encodeRotoFrameFromCanvas`.
- Validate with `mergeRotoAlphaCanvases(null, sheetCanvas, size, baseCanvas, 'pigment-alpha')` and require `meanAbsError <= 3`.

Studio wiring (`PhysicsPaintStudio.tsx`):
1. `planAquarelleLiftErase`: replace the refusal at `:5914-5916` with `recoverBase: true` and force `willPinBase: false` on that branch (the map entry is about to exist).
2. `runAquarelleLiftErase`, scripted branch top (`:6018-6028`): if `plan.recoverBase`, run recovery before `const durable = …get(plan.keyId)`. Exclusion set = `getAquarelleEventsForFrame(plan.frame)` minus `mutationId === aquarelleStrokeMutationIdsRef.current.get(stroke)`; P = `findCachedRotoDisplayFrameRef.current(plan.frame)`. On success `set(keyId, bytes)` → `bumpAquarelleStrokesRevision()` → `studioScriptSnapshot.markDirty()`; on failure publish `AQUARELLE_LIFT_UNKNOWN_BASE_REFUSAL` and record `stage: 'base-recovery-failed'`.
3. Diagnostics: `recordAquarelleRenderSplitEvent('lift-erase', { … stage: 'base-recovery-start' | 'base-recovery-ok' | 'base-recovery-failed' })`.

### S2 — Capture fence + retry + durability

- Add `const aquarelleLiftEraseTargetRef = useRef<{ frame: number; trackId: string } | null>(null);` beside `aquarelleLiftEraseInFlightRef` `[VERIFIED: PhysicsPaintStudio.tsx:1450]`. Set it before the `flushLivePixels` await (`:6006`) and clear it in `finish()` (`:5970-5976`) **only when no pending plan remains**.
- Fence inside `runCapture` after `targetTrackId` (`:6865`) and before the merge-base block (`:6893`):

```ts
const liftTarget = aquarelleLiftEraseTargetRef.current;
if (liftTarget && liftTarget.frame === playFrame && liftTarget.trackId === targetTrackId) {
  recordAquarelleRenderSplitEvent('capture-fenced', { playFrame, targetTrackId, stage: 'lift-erase-in-flight' });
  return;
}
```

- Retry: wrap the `captureLivePixels` call at `:6130-6139` in a two-attempt loop (mirror `enqueue(2)` `[VERIFIED: :6991]`), re-reading `launchContextRef.current` between attempts; record `attempt` + `stage: 'commit-retry' | 'commit-failed'` on the existing `lift-erase` event.
- Durability: after `aquarelleDurableBaseByKeyRef.current.set(...)` `[VERIFIED: :6157-6159]` and after the scripted-path `set` `[VERIFIED: :6036]`, call `bumpAquarelleStrokesRevision()` then `studioScriptSnapshot.markDirty()`. The bump is the load-bearing call (see Area 2); `markDirty()` alone can no-op.

### S3 — Cursor footprint mirror

`app/src/components/physic-paint/engine/aquarelleFootprint.ts` (new, pure):

```ts
export interface AquarelleFootprintShape { radiusDocHeights: number; aspect: number; angleRad: number; }
export function aquarelleFootprintRadius(tool: AquarelleTool, params, pressure: number, speed: number): number;
export function aquarelleTipShape(brushId: string, overrides: AquarelleToolOverrides | null): { aspect: number; rotation: Rotation; angleDeg: number };
```

- Mirror `sizeMult`, `radius`, `brushRadius` numerically and pin the constants with a contract test that asserts `Engine.ts` still contains `(0.012 + 0.03 * pr) * m`, `(0.0016 + 0.0042 * pr)`, `* 0.8` and `Math.pow(3, (this.params.size - 0.5) * 2)` (the repo's established string-pin idiom, cf. `aquarelleLiftEraseContract.test.ts`).
- `aquarelleTipShape` must read `BRUSH_PRESETS` + the multiplier law only — never `buildBrush` (192×192 tip generation per call, `[VERIFIED: brushes.ts:70,348-362]`).
- `AquarelleBrushCursor` `[VERIFIED: AquarelleCanvasLayer.tsx:82-133]`: keep the two-ring SVG, switch the circle to an `<ellipse>` with `rx = radiusPx`, `ry = radiusPx * aspect` and `transform="rotate(angleDeg)"`; rounded-rect when `aspect < 0.6` (mirrors `Engine.ts:1519` `borderRadius = shaped && b.aspect < 0.6 ? h*0.4 / 50% : '50%'`); crosshair below 8 CSS px (keep `CURSOR_CROSSHAIR_SIZE = 23`).
- Scale from `rect.height` captured in the pointer handler `[VERIFIED: AquarelleCanvasLayer.tsx:799-803]`; store it in a signal (e.g. `cursorDocHeightPx`) so the leaf re-renders without a Studio render.
- Pressure: hover `0.4` (matches `Engine.ts:1508`), during a stroke the live `event.pressure` (pen) else `0.4`; speed `0` (matches the hover branch's `0` argument).

### S4 — Lift tip signal + two surfaces

- `aquarelleRecordState.ts`: `export const aquarelleLiftTipId = signal<string | null>('filbert');` + `setAquarelleLiftTipId(id)` (compare-then-write; no `setAquarelleTool`, no `aquarelleToolOverrides` swap, no `aquarelleSelectedTipId` write). Change `aquarelleSelectedTipId`'s initial value at `:94` from `'chalk'` to `'filbert'` (`resetAquarelleRecordState` `[VERIFIED: :1359-1376]` does not touch tips, so no reset change is needed).
- `brushIdForSelection()` `[VERIFIED: AquarelleCanvasLayer.tsx:171-173]` becomes tool-aware: lift → `aquarelleLiftTipId.value ?? 'filbert'`, else the Brush tip. `snapshotAquarelleRecord()` `[VERIFIED: aquarelleRecordState.ts:284-301]` must return the tip for the **recorded tool** (accept the engine-forced `tool` as an argument, or override `brushId` at the `AquarelleCanvasLayer.tsx:444` call site) so a stylus-eraser lift records the Lift tip.
- Extract a presentational `TipShapePicker({ presets, value, onPick, testId })` used by the top bar and the Brush tab; do not reuse `WatercolorBrushLibrary.BrushCard` or the menu rows (both hard-wire `selectAquarelleTip`, which flips the tool `[VERIFIED: aquarelleRecordState.ts:192]`).
- Top bar: insert `<TipShapePicker … testId="physics-lift-shape" />` inside `physics-paint-topbar-lift` before the Strength slider `[VERIFIED: PhysicsPaintTopBar.tsx:224-241]`.
- Right panel: add `'brush'` to the three literal unions `[VERIFIED: PhysicsPaintRightPanel.tsx:113-121,205-207,209-211]` plus one label, add the `effectiveTopPaneTab === 'brush'` branch next to the others (`:315-333`), and extend `RightPanelBrushTab` to catalog + `BrushResponsePanel` + tip picker + Lift section (Lift picker, Strength slider on the `lift` param, and the existing `onSelectLiftStrokes` callback threaded down).
- `BrushResponsePanel` stays the single multiplier surface; mount it twice (Settings + Brush tab) — same signals, no duplicated state.

### S5 — Tip-shaped lift engine + punch

- `liftFS`: append `uniform sampler2D uTip; uniform float uTipAspect, uRound; uniform vec2 uAxis;` and compute
  `q = vec2(dot(p,uAxis), dot(p,vec2(-uAxis.y,uAxis.x))) / uRadius; q.y /= uTipAspect;`
  `float soft = exp(-pow(dot(q,q), 2.0)); float t = texture(uTip, clamp(q*0.5+0.5, 0.0, 1.0)).r;`
  `float f = uAmount * mix(t, soft, uRound);` — `uRound = 1` reproduces today's law exactly (see Area 5).
- `Engine.lift(x, y, r, angle, amount)`: bind `uTip`/`uTipAspect`/`uAxis`/`uRound` exactly as `drawStamp` does `[VERIFIED: Engine.ts:1756-1763]`; pass the angle to `onLiftDab` as the 5th argument.
- `case 'lift'` `[VERIFIED: Engine.ts:1723-1729]`: compute `const angle = this.brushAngle(s)` once per dab and pass it. Note the RNG consequence (see Pitfalls).
- `LiftDab` gains `angle: number`; `AquarelleLiftPreviewDab` gains `angle`; `buildLiftCoverage(dabs, w, h, shape)` gains a `shape` argument (`{ tipData?: Uint8Array; tipSize: number; tipAspect: number; round: number }`), resolved once per punch from `buildBrushForStroke(stroke.brushId, stroke.toolOverrides)` (one call per stroke is acceptable); `AquarelleCachedBaseLayer` resolves the same shape from the live selection at `begin()`.
- Keep `LIFT_SPACING_FRAC = 0.5` and the radius law untouched `[VERIFIED: aquarelleLiftErase.ts:47-51,136-137]`; the tip changes the *profile* inside the footprint, not the dab walk.

## Pitfalls

1. **`markDirty()` silently no-ops.** It returns when `getContentSignature() === lastSavedSignature` `[VERIFIED: studioScriptSnapshotController.ts:877]`, and the signature is only `aquarelleStrokesRevision` `[VERIFIED: PhysicsPaintStudio.tsx:1135]`. A durable-base write after the debounced save is invisible without a revision bump. Always `bumpAquarelleStrokesRevision()` with the map write.
2. **The recorder refuses legacy frames by design.** `recordAquarelleOrdinaryDurableBaseRef` early-returns with `reason: 'script-already-present'` `[VERIFIED: PhysicsPaintStudio.tsx:6764-6772]`. Recovery must `set()` the map directly; reusing the recorder produces 31 more diagnostic events and zero bases.
3. **`selectAquarelleTip` flips the tool to Brush** `[VERIFIED: aquarelleRecordState.ts:192]`. Wiring the Lift picker to it violates D1 and silently changes the active tool mid-session.
4. **Two contract-test pin families break mechanically.** `[VERIFIED: app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts:234]` `expect(preview).toContain('pushAquarelleLiftPreviewDab({ x, y, r, amount })');` — adding the angle changes this literal. And the tab union is pinned in four places: `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts:53,91]` (`"'color' | 'settings' | 'paper' | 'memory'"`, `"'color', 'settings', 'paper', 'memory'"`) and `[VERIFIED: app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts:201,208]` (`"['color', 'settings', 'paper', 'memory']"`, `"useState<'color' | 'settings' | 'paper' | 'memory'>"`). Both tasks must update their pins in the same commit.
5. **App vitest resolves the vendor package from `dist`, not `src`.** `app/vite.config.ts:155-166` aliases `@efxlab/efx-watercolor` to `../packages/efx-watercolor/src/...` `[VERIFIED: app/vite.config.ts:162-166]`, but `app/vitest.config.ts` has no alias — only `include` `[VERIFIED: app/vitest.config.ts:5]`. Today's `dist/index.mjs` (198 502 bytes, rebuilt 2026-10-28 17:12) already exports `buildBrushForStroke` and `toEngineParams`, so the recommended seams work as-is; any **new** package export consumed by an app test requires `pnpm --filter @efxlab/efx-watercolor build` in the same task. This is the strongest argument for keeping the new pure helpers app-side.
6. **Vitest collects only `src/**/*.test.ts`** `[VERIFIED: app/vitest.config.ts:5]`. A `.test.tsx` target exits 0 while running nothing — use the `.test.ts` companion pattern already used by `aquarelleLiftEraseContract.test.ts`.
7. **Both punch codec legs are async**, and `encodeRotoFrameFromCanvas` returns a Promise `[VERIFIED: rotoCanvasFrames.ts:160-165]`; a missing `await` silently produces `undefined` bytes.
8. **`transmittanceSourceToPigmentAlpha` memoizes in a `WeakMap`** `[VERIFIED: app/src/lib/rasterAlpha.ts:145]`. Never pass a canvas that is later redrawn (the cached conversion wins); the preview layer already respects this by keeping its own `ImageData` copy `[VERIFIED: AquarelleCachedBaseLayer.tsx:41,78-80]`.
9. **`liftFS`'s legacy branch must stay exact.** If the tip mask replaces the radial law unconditionally, every previously recorded lift re-bakes with a different footprint. Use `uRound` to keep `uRound = 1` bit-identical.
10. **`brushAngle` advances the shared RNG** (`this.rng()` for `rotation === 'random'`) `[VERIFIED: Engine.ts:1550,1553]`. Calling it for lift shifts the RNG stream for later strokes in the same engine session. Deterministic per session and per bake, but it means the live pass and a re-bake of a mixed brush+lift session differ in jitter if the *order* of calls differs — keep the call site inside the dab, exactly once per dab.
11. **Do not shrink the lift draw rect.** `stampRect(…, extent = 2)` `[VERIFIED: Engine.ts:1882,1796-1800]` already covers any aspect ≤ 1; a "tighter" rect would clip rotated tips.
12. **Recovery must handle the `a ≈ 0` pixel.** The D4 formula divides by `a`; a white sheet pixel has `a = 0`. Passthrough `B = P` there or every un-erased region becomes NaN.
13. **`getContentSignature` ignores the key payload.** Raster key payload persistence rides `captureLivePixels` → parent delivery, a different channel from the snapshot. Row 7 of the truth table therefore depends on the capture committing, not on `markDirty`.
14. **`stroke.brushId` is recorded from the live Brush selection** `[VERIFIED: AquarelleCanvasLayer.tsx:444, aquarelleRecordState.ts:298]`, but the stroke's `tool` may be engine-forced `[VERIFIED: AquarelleCanvasLayer.tsx:434-440]`. Without a tool-aware tip, a stylus-eraser lift records the wrong tip and the punch/re-bake diverge from the live erase.

## Escalation checks

| Proposed change | Verdict | Why |
|---|---|---|
| Edit `liftFS` in place (add tip uniforms) | **Allowed** | D5 explicitly: editing `liftFS` in place is not a new API `[VERIFIED: shaders.ts:266-276]` |
| Change `Engine.lift` signature + bind tip uniforms | **Allowed** | D5: same reason; `lift` is `private` today `[VERIFIED: Engine.ts:1880]` |
| Add a 5th `angle` arg to `onLiftDab` | **Allowed** | D5: "the `onLiftDab` callback gains the angle" `[VERIFIED: Engine.ts:46]` |
| Extract a bake-only helper from `applyAquarelleEventsToKey` | **Allowed** | Refactor of existing internals; no new capability, no new undo kind (`[VERIFIED: physicsPaintRotoPlayScriptController.ts:1852-1894]`) |
| Write `aquarelleDurableBaseByKeyRef` directly on recovery | **Allowed** | Existing store, existing snapshot field `[VERIFIED: PhysicsPaintStudio.tsx:1181-1187]` |
| Make `Engine.radius`/`brushAngle`/`view` **public** so the app can call the law | **STOP — escalate** | New public vendor surface; propose a phase instead. Use the app-local footprint mirror (S3) |
| Add a **new exported** footprint helper to `packages/efx-watercolor` | **STOP — escalate** (borderline) | New package public surface; also forces `dist` rebuild for app tests (Pitfall 5). App-local mirror + contract pin is the in-scope option |
| New undo kind for the punch | **STOP — escalate** | D5 names this explicitly; the punch already rides the physical-edit transaction |
| New npm dependency | **Not needed** | No new package identified; no legitimacy audit required |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (`app/node_modules/.bin/vitest`, v2.x via app deps) |
| Config file | `app/vitest.config.ts` (`include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']`) |
| Quick run command | `cd app && npx vitest run src/components/physic-paint/roto/aquarelleLiftErase.test.ts src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` (`.planning/config.json` → `workflow.test_command`) |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Inversion round-trips S over B to P within 3/255 | unit | `npx vitest run src/components/physic-paint/roto/aquarelleBaseRecovery.test.ts` | ❌ Wave 0 |
| `a≈0` passthrough, `a≥0.97` → white, clamping | unit | same file | ❌ Wave 0 |
| Footprint radius matches the engine law at pen/brush/water/lift pressures | unit | `npx vitest run src/components/physic-paint/engine/aquarelleFootprint.test.ts` | ❌ Wave 0 |
| Engine law constants still present (drift pin) | contract | same file | ❌ Wave 0 |
| Tip-shaped coverage: `uRound=1` equals the legacy radial law; aspect squashes the ellipse | unit | `npx vitest run src/components/physic-paint/roto/aquarelleLiftErase.test.ts` | ✅ extend |
| Preview dab carries the angle; filter string updated | contract | `npx vitest run src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts` | ✅ update pin at `:234` |
| `aquarelleLiftTipId` setter never flips the tool, never writes Brush state | unit | `npx vitest run src/components/physic-paint/view/aquarelleRecordState.test.ts` | ✅ extend |
| Tab union contains `'brush'` in both panel and gate | contract | `npx vitest run src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts` | ✅ update pins |
| Capture fence skips only the matching (track, frame) | unit/contract | `npx vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ extend |
| Durable-map write bumps the revision before `markDirty` | contract | same file | ✅ extend |

### Sampling Rate
- **Per task commit:** the narrow file(s) touched, as above.
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run`.
- **Phase gate:** full suite green, then native UAT (the four findings are live-visual; automation cannot judge the cursor silhouette or the erase feel).

### Wave 0 Gaps
- [ ] `app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts` + `.test.ts`
- [ ] `app/src/components/physic-paint/engine/aquarelleFootprint.ts` + `.test.ts`
- [ ] `app/src/components/physic-paint/view/TipShapePicker.tsx`
- [ ] No framework install needed — vitest is present at `app/node_modules/.bin/vitest`

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treat as enabled. This phase is local-only (canvas, WebGL, WebP byte arrays; no network, no auth, no persistence beyond the existing snapshot channels).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Recovered/decoded WebP bytes are untrusted-ish: guard `createImageBitmap`/`getImageData` in `try/catch` (existing pattern `[VERIFIED: aquarelleLiftErase.ts:330-334,359-369]`), validate dimensions before allocating coverage buffers, and keep `MAX_LIFT_DABS = 50_000` `[VERIFIED: aquarelleLiftErase.ts:60]` |
| V6 Cryptography | no | — |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Malformed/oversized frame bytes from a reopened project | Tampering | Existing `try/catch` codec legs + size clamp from `aquarelleLiftSizeRef`; never allocate from decoded dimensions alone |
| Unbounded dab walk from a pathological stroke | Denial of Service | `MAX_LIFT_DABS` guard already present `[VERIFIED: aquarelleLiftErase.ts:159,167,180]` |
| Silent data loss (wrong base adopted) | Tampering | D4's ≤ 3/255 validation gate — fail closed, never silently adopt |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test | ✓ | v24.15.0 | — |
| pnpm | workspace commands | ✓ | 10.27.0 | — |
| vitest | tests | ✓ | `app/node_modules/.bin/vitest` | — |
| WebGL2 (runtime) | live engine + bake | not probed (no server run per CLAUDE.md) | — | existing `try { new WatercolorEngine(...) } catch { return; }` `[VERIFIED: AquarelleCanvasLayer.tsx:466-469]` |

No missing blocking dependencies.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The displayed composite for a legacy scripted key is `findCachedRotoDisplayFrame(frame).bytes` (same source the raster branch already trusts) | S1 | Recovery would invert against the wrong P and fail validation — a fail-closed refusal, not corruption. Confirm on the first native UAT row |
| A2 | `paper` for the recovery bake is resolvable from the same Studio paper id the Apply path uses | S1 | A paper mismatch perturbs S slightly; the 3/255 gate may reject. Verify against `applyAquarelleEventsToKey`'s caller |
| A3 | `uRound = 0` (pure tip) for lift, in both the shader and the punch | S5 | A different value in either place breaks WYSIWYG between live and punch. Must be one shared constant |
| A4 | The Lift tip picker must not share `aquarelleToolOverrides` with Brush (D1 only names the tip id) | S4 | If Lift needs its own multiplier bag, that is a new signal + a recording field — escalate |

## Open Questions

1. **Does the Lift section need its own multiplier bag?**
   - What we know: D1 separates only the tip id; D5 says the engine binds "the same `this.brush` tip, aspect and angle the brush uses".
   - Unclear: whether changing Brush aspect should reshape the Lift footprint.
   - Recommendation: share the bag (one `buildBrushForStroke(brushId, aquarelleToolOverrides)`), as D5's wording implies; note it in the plan so UAT can object.

2. **Follow-rotation in the cursor preview.**
   - What we know: the engine uses `Math.atan2(s.dy, s.dx) + b.angle * DEG` while a stroke is live `[VERIFIED: Engine.ts:1551]`.
   - Unclear: D6 names "aspect, rotation" but not a motion direction for hover.
   - Recommendation: fixed → preset angle (+ tilt azimuth when the pointer event carries tilt); follow → last movement direction, defaulting to the preset angle when stationary; random → hold the last value (no per-frame flicker).

3. **`markDirty` vs. explicit revision bump.** D7 says call `markDirty();` but the bump is what makes it fire. Recommendation: do both, and assert the ordering in a test.

## Sources

### Primary (HIGH confidence — read from source this session)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` :276-279, :1135, :1181-1187, :1231-1239, :1450, :5881-5918, :5924-5937, :5956-6196, :6197-6287, :6245-6246, :6274-6283, :6745-6803, :6804-7005
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` :67-94, :171-211, :400-469, :506, :537-550, :795-828
- `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` :41-66, :73-110
- `app/src/components/physic-paint/roto/aquarelleLiftErase.ts` :40-68, :105-193, :201-263, :284-307, :350-419
- `app/src/components/physic-paint/roto/aquarelleLiftPreview.ts` :23-70
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` :1846-1894
- `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts` :1-100
- `app/src/components/physic-paint/roto/rotoCanvasFrames.ts` :149-175
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts` :150-219
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` :82, :160-230, :560-670
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` :151, :840-899
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` :70-97, :184-215, :270-301, :388-400, :1106-1115, :1359-1376, :1492-1516
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` :113-121, :199-211
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` :18-27
- `app/src/components/physic-paint/view/RightPanelSettingsTab.tsx` :14-19
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` :42-105
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` :165-301
- `packages/efx-watercolor/src/playground/Engine.ts` :46, :1503-1559, :1650-1660, :1723-1731, :1737-1800, :1880-1907
- `packages/efx-watercolor/src/playground/shaders.ts` :31-66, :265-276
- `packages/efx-watercolor/src/playground/brushes.ts` :6-70, :182-184, :253-255, :348-363
- `packages/efx-watercolor/src/playground/brushBridge.ts` :30-74
- `packages/efx-watercolor/src/playground/params.ts` :60-89
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` :53-85
- `app/vite.config.ts` :151-168 / `app/vitest.config.ts` :5
- `.planning/config.json` (`nyquist_validation: true`, `test_command`)

### Secondary (MEDIUM confidence)
- None required — every claim above was read from source in this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all seams are existing modules read in full.
- Architecture: HIGH — data flow (engine → dab callback → preview/punch → commit → snapshot) traced end to end.
- Pitfalls: HIGH — each pitfall is a verbatim anchor in the codebase, including the two contract-test pin families that will break.

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (30 days; the codebase moves fast on this surface — re-verify line anchors if the branch has moved)
