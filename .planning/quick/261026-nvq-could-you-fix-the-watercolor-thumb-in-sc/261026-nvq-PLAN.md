---
phase: quick-261026-nvq
plan: 261026-nvq
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 42000
  raw_tokens: 42000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Saving a Script from a Water color key writes a library row whose thumbnail shows the final watercolor wash over the chosen paper, never the thin engine-1 guide outlines."
    - "A Brush-module key, a mixed engine-1 + watercolor key, and a sheet with no measurable ink keep today's thumbnail exactly: the engine alpha canvas, drawn source-over."
    - "A blank or cleared live sheet never produces a blank/white thumbnail — the ink gate falls back to the engine canvas instead."
    - "The thumbnail keeps its paper/background under the wash: the opaque transmittance sheet multiplies over it instead of covering it with white."
    - "The persisted schema, the WebP encoding and the thumbnail size contract are unchanged; only the pixels fed into the existing encoder change."
    - "The canvas-mount memo keeps its identity across frame navigation; the snapshot seam registers/unregisters through the existing mount lifecycle with no effects, no useState and no signal writes."
  artifacts:
    - path: "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx"
      provides: "onSnapshotReady prop — registers the existing MODE.transparent sheet snapshot after engine setup, unregisters null on cleanup."
    - path: "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx"
      provides: "onAquarelleSnapshotReady forwarding ref → AquarelleCanvasLayer."
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "aquarelleSnapshotRef, ink-gated captureAquarelleCanvas port, identity-stable handleAquarelleSnapshotReady wired into the canvas-mount memo."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts"
      provides: "RotoScriptPersistenceCapture.aquarelleAlphaCanvas + captureAquarelleCanvas port, attached only when aquarelleEvents is present."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts"
      provides: "saveActiveFrame chooses the aquarelle sheet as the thumbnail source and passes the composite mode."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts"
      provides: "RotoScriptThumbnailComposite ('source-over' | 'multiply'), default source-over — encoding/size/schema untouched."
  key_links:
    - from: "AquarelleCanvasLayer snapshot closure"
      to: "Studio aquarelleSnapshotRef"
      via: "onSnapshotReady → onAquarelleSnapshotReady (ref registration only, no state)"
    - from: "Studio captureAquarelleCanvas"
      to: "RotoScriptPersistenceCapture.aquarelleAlphaCanvas"
      via: "captured eagerly after the canCopy gate, attached only when buildAquarelleEventsFromCapture returned events"
    - from: "AQUARELLE_MIN_CAPTURE_INK / measureAquarelleCanvasInk"
      to: "fallback to scriptAlphaCanvas"
      via: "the port returns null for a blank sheet, so the library keeps today's engine canvas"
    - from: "saveActiveFrame thumbnail source"
      to: "createRotoScriptThumbnail scriptComposite 'multiply'"
      via: "the aquarelle sheet is OPAQUE transmittance (white = no pigment) and must follow the same tree as the live CSS mix-blend-mode: multiply"
---

<objective>
Fix the saved Script library thumbnail in Physics Paint Studio so a Water color key saves the final watercolor (aquarelle) render instead of the thin engine-1 guide outlines.

Purpose: watercolor strokes are recorded as thin engine-1 proxies (handleAquarelleStrokeEnd → aquarelleStrokeToPaintStroke → enqueueRecordedStroke) while the real paint lives on the separate live aquarelle sheet; saving captures engine.copyLiveAlphaCanvas(), which composites only those invisible proxies. The library row therefore stores a thumbnail of outlines the user never sees.

Output: the live sheet's MODE.transparent snapshot is registered through a new mount seam, captured ink-gated at save time, attached to the persistence capture only for aquarelle scripts, and composited with the correct multiply law by the existing thumbnail encoder.

Locked decisions (from the quick contract — never revisit):
- D-01: the aquarelle live sheet (`engine.exportCanvas('transparent')`) is the thumbnail source for aquarelle scripts; the engine alpha canvas stays the source for everything else.
- D-02: do not change createRotoScriptThumbnail's encoding (WebP quality 0.8), size contract (fitThumbnail / ROTO_SCRIPT_LIMITS) or the persisted schema.
- D-03: mixed engine-1 + watercolor scripts keep today's behavior — aquarelleEvents is absent by design, so the aquarelle canvas must not be attached.
- D-04: an empty/blank live sheet must fall back to the existing engine canvas, never yield a blank thumbnail.
- D-05: no useEffect, no useState, no signal writes on this path; identity-stable callbacks and a correct canvas-mount memo dep list.
- D-06: pnpm only; gate with `vitest run` (never watch mode); never start the dev server. Native visual UAT is the user's.

Verified at planning time (evidence, not assumptions):
- Recording: PhysicsPaintStudio.tsx:5688 handleAquarelleStrokeEnd converts each AquarelleStroke to a thin engine-1 proxy; PhysicsPaintStudioView.tsx:252 keeps the engine-1 surface at opacity 0 in aquarelle mode.
- Save path: physicsPaintRotoScriptLibrary.ts:494-497 → captureScriptForPersistence (physicsPaintRotoScriptClipboard.ts:490-525) returns { script, scriptAlphaCanvas: engine.copyLiveAlphaCanvas() }; EfxPaintEngine.ts:2029-2102 clears then draws only dry + display engine surfaces (transparent backdrop).
- Real paint: AquarelleCanvasLayer.tsx:411-417 defines `snapshot = () => engine.exportCanvas('transparent')`; WatercolorEngine.ts:883-908 documents MODE.transparent as OPAQUE transmittance (white = no pigment, alpha 255 everywhere), which is why the cache path multiplies it over the fond and why physicsPaintStudio.css:6845-6850 uses `mix-blend-mode: multiply`.
- Registration precedent: AquarelleCanvasLayer.tsx:428 `onFlushCaptureReadyRef.current?.(flushCapture)` and :542 `onFlushCaptureReadyRef.current?.(null)`; PhysicsPaintCanvasMount.tsx:50/71/237 carries the same prop through a ref.
- Ink gate precedent: PhysicsPaintStudio.tsx:571-591 `AQUARELLE_MIN_CAPTURE_INK` + `measureAquarelleCanvasInk` (painted 4.6-11.3, blank 0.05-0.12, floor 1).
- Montage: the Studio's captureThumbnail closure (PhysicsPaintStudio.tsx:1582-1591) is the only createRotoScriptThumbnail caller; the library port is physicsPaintRotoScriptLibrary.ts:60.
- Grounded gates (run green before planning): `pnpm --filter efx-motion-editor exec vitest run` on physicsPaintRotoScriptThumbnail.test.ts, aquarelleLayerContract.test.ts, physicsPaintRotoScriptClipboard.test.ts, physicsPaintRotoScriptLibrary.test.ts, PhysicsPaintStudio.test.ts, PhysicsPaintCanvasMount.test.ts — 413 tests pass in ~1.4 s.

CRITICAL CORRECTION to the investigation's step 6: passing the aquarelle canvas straight into createRotoScriptThumbnail is NOT sufficient. `context.drawImage` defaults to source-over and the sheet is opaque (white = no pigment), so a direct draw would paint a white rectangle over the paper/background the thumbnail composes (physicsPaintRotoScriptThumbnail.ts:19-43). The sheet must be drawn with `globalCompositeOperation = 'multiply'` — the same transmittance law as the live CSS seam and the frame-cache merge. That is Task 1, and it is an opt-in parameter so the engine-1 path is byte-identical.

Accepted scope (do not expand):
- The live sheet is session-scoped: paint committed to the frame cache by an earlier session (reopen, or after an Apply) is not part of it. When the sheet has no fresh ink the ink gate falls back to today's behavior; this quick does not merge the cached frame bytes into the thumbnail.
- The sheet exists only while the Water color module is mounted (aquarelleActive). Saving after switching to the Brush module falls back — today's behavior.
- Do not introduce the forbidden `cachedBase: null` literal into PhysicsPaintStudio.tsx; aquarelleLayerContract.test.ts negative-greps it.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
@app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
@app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
@app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Multiply composite mode for the aquarelle transmittance sheet in the thumbnail encoder</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts</files>
  <behavior>
    - RED first: a test that requests multiply compositing must fail before the parameter exists (record the failing output in the SUMMARY).
    - With `scriptComposite: 'multiply'`, the thumbnail context is in multiply mode at the moment the script canvas is drawn (capture the mode via a setter recorded in the mocked context, then assert it right before the script draw call).
    - Omitting `scriptComposite` leaves the default `'source-over'` at that same point — the engine-1 path is byte-identical.
    - The existing calls still compose flat fill → paper (when the background is paper/*) → script canvas, in that order.
    - Encoding stays WebP quality 0.8 through the same native/decoder branch; width/height still come from fitThumbnail(sourceWidth, sourceHeight); ROTO_SCRIPT_LIMITS.thumbnailBytes validation is unchanged.
  </behavior>
  <action>
    Work test-first in app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts, then change the encoder.

    Encoder (app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts):
    1. Export a type `RotoScriptThumbnailComposite = 'source-over' | 'multiply'`.
    2. Add an optional input field `scriptComposite?: RotoScriptThumbnailComposite` to the createRotoScriptThumbnail input object (after `nativeEncoder`).
    3. Immediately before the existing `context.drawImage(input.scriptAlphaCanvas, 0, 0, width, height)` call, set `context.globalCompositeOperation = input.scriptComposite ?? 'source-over'`. Do not change the fill, the paper resolution, the draw order, the encoder branches, the quality constant, fitThumbnail, or the returned thumbnail object shape.
    4. Document the law in a comment above that assignment: the aquarelle sheet is MODE.transparent OPAQUE transmittance (white = no pigment, alpha 255) so it must MULTIPLY over the composed paper/background exactly like the live seam (physicsPaintStudio.css `.aquarelle-live-canvas` and `.aquarelle-cached-base`) and the frame-cache merge (`mergeBlend: 'multiply'`); an engine-1 `copyLiveAlphaCanvas` stays source-over because it is a transparent-backed alpha canvas.

    Test (physicsPaintRotoScriptThumbnail.test.ts):
    5. Extend the existing mocked-context harness style (the `261017-lny: a paper/* id paints the sheet under the script` test is the template: a fake context object with `fillRect`/`drawImage`/`getImageData` spies and a `makeCanvas` factory installed on globalThis.document) with a plain-object context that also records `globalCompositeOperation` assignments (use a getter/setter that pushes to a `composites: string[]` array, or capture the value inside the `drawImage` spy).
    6. Add one test asserting multiply: call createRotoScriptThumbnail with `background: { background: 'paper/cold-press', grainStrength: 1 }` and `scriptComposite: 'multiply'`, and assert the mode captured at the script draw is `'multiply'` (the last `drawImage` call is the script canvas — the paper draw precedes it).
    7. Add one test asserting the default: the same call without `scriptComposite` captures `'source-over'`.
    8. Keep the existing four tests untouched and green (they do not pass the new field and must observe source-over).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts</automated>
  </verify>
  <done>The thumbnail encoder accepts an optional `scriptComposite`, defaults to 'source-over', and sets `globalCompositeOperation` to the requested mode only for the script-canvas draw; two new tests pin multiply and default; the four existing thumbnail tests pass unchanged; encoding, size contract and schema are untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Register the live aquarelle sheet snapshot through the canvas-mount seam</name>
  <files>app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx, app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx, app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts</files>
  <behavior>
    - The layer receives `onSnapshotReady` and calls it with the existing `snapshot` closure once the engine is constructed and configured (compositor layer, live config, paper applied).
    - The registration value is the SAME `snapshot` used by the capture path — `engine.exportCanvas('transparent')` — not a second readback.
    - Cleanup calls `onSnapshotReady` with null next to the existing flush-capture unregister, so a destroyed engine closure can never be invoked by a later Save.
    - A canvas remount (width/height key change) re-registers after the cleanup, exactly like `onFlushCaptureReady`.
    - The mount forwards its own prop through a ref and never causes a mount identity change.
  </behavior>
  <action>
    Work test-first: extend app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts with one `it` block for the new seam, run it RED, then wire the layer and the mount.

    Layer (app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx):
    1. Add an optional prop to the exported props type (after `onFlushCaptureReady`): `onSnapshotReady?: (snapshot: (() => HTMLCanvasElement | null) | null) => void;`. Its doc comment states: SAVE-PATH seam (261026-nvq) — registers the current edit frame's composited sheet factory, the SAME closure the cache capture resolves; the sheet is MODE.transparent OPAQUE transmittance (white = no pigment); null on cleanup; mirrors onFlushCaptureReady.
    2. Add `const onSnapshotReadyRef = useRef(props.onSnapshotReady);` beside the other callback refs and assign `onSnapshotReadyRef.current = props.onSnapshotReady;` in the render-body ref sync block.
    3. Register the seam immediately after the existing `onFlushCaptureReadyRef.current?.(flushCapture);` call (~line 428): `onSnapshotReadyRef.current?.(snapshot);`. `snapshot` is already defined above it and the engine is already configured at that point — do not move the snapshot definition, do not add a second exportCanvas call.
    4. In `cleanupRef.current = () => { ... }` add `onSnapshotReadyRef.current?.(null);` next to the existing `onFlushCaptureReadyRef.current?.(null);`, before `engine.destroy()`.
    5. Do not touch the rAF poll, the capture handlers, the settle logic, the stroke recording, or the snapshot body.

    Mount (app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx):
    6. Extend the props type with `onAquarelleSnapshotReady?: (snapshot: (() => HTMLCanvasElement | null) | null) => void;` next to `onAquarelleFlushCaptureReady`.
    7. Add `const onAquarelleSnapshotReadyRef = useRef(props.onAquarelleSnapshotReady);` and the render-body assignment `onAquarelleSnapshotReadyRef.current = props.onAquarelleSnapshotReady;` beside the existing aquarelle refs.
    8. On the `<AquarelleCanvasLayer>` element add `onSnapshotReady={(snapshot) => onAquarelleSnapshotReadyRef.current?.(snapshot)}` next to `onFlushCaptureReady`. Do not add an effect, state, or extra memo; the same inline-arrow pattern is already used by every aquarelle callback there.

    Contract test (aquarelleLayerContract.test.ts):
    9. New `it` such as "SAVE: the live sheet snapshot is registered after engine setup and unregistered on cleanup". Pin `layer.toContain('onSnapshotReady')`, `layer.toContain('onSnapshotReadyRef.current?.(snapshot)')`, `layer.toContain('onSnapshotReadyRef.current?.(null)')`, and the ordering `layer.indexOf('engine.setCompositorLayer(true)') < layer.indexOf('onSnapshotReadyRef.current?.(snapshot)')` so a registration placed before the engine configuration fails. Pin the mount forwarding with `expect(mount).toContain('onAquarelleSnapshotReady')` (read PhysicsPaintCanvasMount.tsx the same way the suite reads the layer).
    10. Leave every existing assertion in the file untouched, including the `not.toContain('cachedBase: null')` negative gate on the Studio source.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/aquarelleLayerContract.test.ts src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts</automated>
  </verify>
  <done>The layer exposes onSnapshotReady, registers the existing snapshot closure after the engine is configured and unregisters null in cleanup; the mount forwards onAquarelleSnapshotReady through a ref; the new contract pins plus all 13 existing aquarelle contract tests and all 11 mount tests pass; no effect or state was added.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Carry the ink-gated sheet through save into the library thumbnail source</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts</files>
  <behavior>
    - An aquarelle capture (all captured primaries have a recorded AquarelleStroke) carries `aquarelleAlphaCanvas` when the host supplies an ink-bearing sheet.
    - The sheet is read eagerly, before the first await of captureScriptForPersistence, so a frame change or sheet clear cannot empty it.
    - A blank sheet (port returns null) leaves `aquarelleAlphaCanvas` undefined and `scriptAlphaCanvas` is the engine canvas, unchanged.
    - A mixed key (any primary without a recorded AquarelleStroke) never carries `aquarelleAlphaCanvas`, even when the host supplied one.
    - saveActiveFrame passes the aquarelle sheet to captureThumbnail with composite 'multiply'; without it, it passes scriptAlphaCanvas with 'source-over'.
    - The persisted script object and schema are byte-identical in shape to today for every non-aquarelle save.
  </behavior>
  <action>
    Work test-first in the two existing suites, then wire.

    Clipboard controller (app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts):
    1. Extend `RotoScriptPersistenceCapture` with optional `aquarelleAlphaCanvas?: HTMLCanvasElement;`. Doc comment: the live aquarelle sheet (MODE.transparent OPAQUE transmittance, white = no pigment) for the capture's source frame; present only when `script.aquarelleEvents` is present and the host's ink gate accepted the sheet.
    2. Extend `RotoScriptClipboardControllerPorts` with optional `captureAquarelleCanvas?: () => HTMLCanvasElement | null;`. Doc comment: SAVE-PATH seam (261026-nvq), must be called eagerly (the live sheet is frame-scoped and can be cleared), returns null when the host has no sheet or no ink.
    3. In `captureScriptForPersistence`, after the `if (!availability.value.canCopy) return null;` gate and BEFORE `beginOperation`/`drainAcceptedMutations`/`flushSourcePublication`, capture eagerly: `const aquarelleAlphaCanvas = ports.captureAquarelleCanvas?.() ?? null;`. The eager copy is the same law as the existing `const liveAlphaCanvas = snapshot()` in the Studio handler.
    4. Change the return at the end of that function from `{ script, scriptAlphaCanvas: engine.copyLiveAlphaCanvas() }` to spread the optional field only when BOTH the events and the canvas exist: attach `aquarelleAlphaCanvas` only when `aquarelleEvents !== undefined && aquarelleAlphaCanvas !== null`. Keep `scriptAlphaCanvas` exactly as it is today in every case.

    Hook (app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts):
    5. Add one forwarding port inside the factory object: `captureAquarelleCanvas: () => portsRef.current.captureAquarelleCanvas?.() ?? null,` beside `flushSourcePublication`.

    Studio (app/src/components/physic-paint/PhysicsPaintStudio.tsx):
    6. Declare `const aquarelleSnapshotRef = useRef<(() => HTMLCanvasElement | null) | null>(null);` ABOVE the `useRotoScriptClipboardController({...})` call (a safe spot is beside `aquarelleCapturesInFlightRef`, ~line 1348) so the port closure can reference it without a TDZ hazard.
    7. Add the port to that ports object: `captureAquarelleCanvas: () => { const canvas = aquarelleSnapshotRef.current?.() ?? null; if (!canvas) return null; return measureAquarelleCanvasInk(canvas) >= AQUARELLE_MIN_CAPTURE_INK ? canvas : null; },`. Reuse the existing module-level helper and floor (~line 571); do not add a second ink heuristic and do not throw when the snapshot fails.
    8. Add an identity-stable handler next to the other aquarelle registration handlers, after `handleAquarelleFlushCaptureReady` (~line 6357): `const handleAquarelleSnapshotReady = useCallback((snapshot: (() => HTMLCanvasElement | null) | null) => { aquarelleSnapshotRef.current = snapshot; }, []);`. It must only assign the ref — no state, no signal, no render.
    9. Add `handleAquarelleSnapshotReady` to the `canvasMountPropsMemo.resolve([...])` dependency array (~line 6398) and `onAquarelleSnapshotReady: handleAquarelleSnapshotReady,` to the returned props object next to `onAquarelleFlushCaptureReady` (~line 6435). Keep the deps array free of frame-navigation values (`currentFrame`, `startFrame`, `rotoNavigationGeneration`) — the structural mount-identity test enforces that.
    10. Update the `captureThumbnail` closure (~line 1582) to accept the new optional second parameter and forward it: `captureThumbnail: async (scriptAlphaCanvas, composite) => { ... createRotoScriptThumbnail({ scriptAlphaCanvas, scriptComposite: composite, ... }) }`. Pass the extra field only through to the thumbnail; leave sourceWidth/sourceHeight/background/nativeEncoder logic untouched.

    Library (app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts):
    11. Change the `captureThumbnail` port to `(scriptAlphaCanvas: HTMLCanvasElement, composite?: 'source-over' | 'multiply') => Promise<PersistedRotoScriptThumbnailV1>` (a type-only import of RotoScriptThumbnailComposite from ./physicsPaintRotoScriptThumbnail is preferred over a duplicated literal union).
    12. In saveActiveFrame (~line 494-498) choose the source and mode once: `const thumbnailSource = captured.aquarelleAlphaCanvas ?? captured.scriptAlphaCanvas;` and `const thumbnailComposite = captured.aquarelleAlphaCanvas ? 'multiply' : 'source-over';` then `await ports.captureThumbnail(thumbnailSource, thumbnailComposite)`. Do not change the failure text, the naming loop, the source bag, or the serializer branch.

    Tests:
    13. physicsPaintRotoScriptClipboard.test.ts — add a describe-level group for the persistence seam. Start each new test with `purgeAllAquarelleKeyScripts()` (imported from ../view/aquarelleRecordState) to isolate the module-level registry; record one AquarelleStroke per captured mutation with a unique mutationId and `playFrame: 4` (the harness source appFrame), mirroring the `recordLiveAquarelle` fixture used by the applyCurrentScript suite. Complete the mutation through `copyCompletedSource(test)` (or observeCompletedMutation) so the canCopy gate is true, set `copyLiveAlphaCanvas` on the engine like the existing capture test, and pass `captureAquarelleCanvas` through the harness overrides. Assertions: (a) the sheet-bearing capture exposes `aquarelleAlphaCanvas === sheet` and `scriptAlphaCanvas === engineCanvas`; (b) a port returning null yields `aquarelleAlphaCanvas === undefined`; (c) a mixed key (one stroke without a record, e.g. a second `stroke(2)` with no recordAquarelleStroke) yields `script.aquarelleEvents === undefined` and `aquarelleAlphaCanvas === undefined`. Do not modify the harness defaults.
    14. physicsPaintRotoScriptLibrary.test.ts — extend its `harness()` to return the `captureThumbnail` mock, then add: (a) a capture WITH `aquarelleAlphaCanvas` makes saveActiveFrame call `captureThumbnail(aquarelleCanvas, 'multiply')`; (b) the existing default capture calls it with `(scriptAlphaCanvas, 'source-over')`. Find the existing save test to copy its `request`/row/thumbnail fixtures and invocation; do not weaken any existing assertion.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts src/components/physic-paint/engine/aquarelleLayerContract.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>captureScriptForPersistence captures the aquarelle sheet eagerly and attaches it only for aquarelleEvent scripts; the Studio port ink-gates it with AQUARELLE_MIN_CAPTURE_INK and registers through the mount memo; saveActiveFrame feeds the sheet to captureThumbnail with 'multiply' and keeps 'source-over' otherwise; the clipboard, library, Studio, mount and contract suites pass; the app typechecks; no useState/useEffect/signal write was added.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Live canvas → persisted thumbnail | Local render pixels are read (exportCanvas readback) and encoded into the project's script library. No network, no external input. |
| Renderer → native/persisted schema | The WebP encoder and the persisted script schema must not change; the new field is in-memory only. |
| npm/pip/cargo installs | No dependency is added by this quick. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-261026-nvq-01 | Information Disclosure | aquarelle sheet → script thumbnail | low | accept | The sheet holds the same pixels already committed to the frame cache and saved with the project; the thumbnail travels in the same local script file with no new channel. The ink gate also prevents an empty white sheet from being persisted. |
| T-quick-261026-nvq-02 | Tampering | stale snapshot closure after engine destroy | medium | mitigate | The layer unregisters `onSnapshotReady(null)` in cleanup beside the existing flush-capture unregister, the snapshot body is try/catch-guarded and returns null, and the Studio port falls back to the engine canvas on null. Pinned by the new aquarelle contract test. |
| T-quick-261026-nvq-03 | Denial of Service | eager full-resolution exportCanvas on Save | low | mitigate | Exactly one extra readback per explicit Save click (the capture path already performs one `copyLiveAlphaCanvas`); never on a rAF tick, frame change, or render. No new loop. |
| T-quick-261026-nvq-04 | Tampering | paper/background replaced by an opaque white sheet | medium | mitigate | The sheet is drawn with `globalCompositeOperation = 'multiply'` (opt-in), matching the live CSS `mix-blend-mode: multiply`; the default stays `source-over` so the engine-1 alpha path is unchanged. Pinned by the new thumbnail test. |
| T-quick-261026-nvq-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package is added by this quick. If one becomes necessary, run the Package Legitimacy Gate and insert a blocking human-verification checkpoint for any [ASSUMED]/[SUS] package; never install [SLOP]. |
</threat_model>

<verification>
## Automated

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/aquarelleLayerContract.test.ts src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts src/components/physic-paint/engine/aquarelleLayerContract.test.ts`
- `pnpm --filter efx-motion-editor run typecheck`

## Native UAT (live Studio, user-driven — never start the dev server for it)

| # | Action | Expected |
|---|--------|----------|
| 1 | Water color module, paint a wash on a real key, let it settle, then Save Script from the SCRIPTS panel | The new library row thumbnail shows the actual watercolor wash over the selected paper — no thin guide outlines |
| 2 | Same key, press Dry, then Save Script again | The saved thumbnail shows the settled (dry) wash, matching what is on canvas |
| 3 | Brush module (or a mixed key with engine-1 strokes), Save Script | The thumbnail is unchanged from today: the painted strokes over the paper |
| 4 | Water color, empty a freshly created key with no paint, Save Script | Still refused with "Paint at least one brush on a real Roto key." — no blank row appears |
| 5 | Reopen a saved script from the library (Load/Apply) | Applies exactly as before; the script schema is unchanged |
| 6 | Save, then navigate frames and Save on another key | Each row gets its own frame's wash; no stale sheet leaks between frames, and frame navigation stays responsive |
</verification>

<success_criteria>
- A saved Water color script's library thumbnail is the final watercolor render, not the thin engine-1 guide outlines.
- The wash multiplies over the thumbnail's paper/background (same law as the live CSS seam and the cache merge); paper is never covered by an opaque white sheet.
- Brush-module and mixed keys keep their current thumbnails; the engine-1 path still draws source-over and the encoding/size/schema contract is untouched.
- A blank or cleared live sheet falls back to the engine canvas — no blank or white thumbnail is ever persisted.
- The snapshot seam registers/unregisters through the existing mount lifecycle with identity-stable callbacks; the canvas-mount memo keeps its identity across frame navigation; no effect, state or signal write was added.
- All listed suites pass, the app typechecks, and the native UAT rows are ready for the user's live run.
</success_criteria>

<output>
Create `.planning/quick/261026-nvq-could-you-fix-the-watercolor-thumb-in-sc/261026-nvq-SUMMARY.md` when done
</output>
