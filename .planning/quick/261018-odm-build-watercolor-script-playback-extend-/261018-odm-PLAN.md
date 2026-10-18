---
phase: quick-261018-odm
plan: 261018-odm
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  - app/src-tauri/src/services/script_library.rs
autonomous: true
requirements:
  - ODM-01

estimate:
  tokens: 48000
  raw_tokens: 48000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "A watercolor script saved from the Water color module persists as engineId efx-watercolor with AquarelleStrokePayload in each stroke's engine slot and the original aquarelle UV points on the envelope."
    - "Loading that script keeps engineId efx-watercolor on the runtime snapshot, so Play Script Apply takes the bakeAquarelleScript consume branch instead of renderRotoPlayScriptFrames."
    - "After an app restart, Play of a saved watercolor script rebuilds its AquarellePayloadEvent timeline from the persisted envelope + engine slots (tool, params, brushId, toolOverrides, UV points, Dry events) and produces wash/bleed/granulation output from the aquarelle engine."
    - "Engine-1 scripts (engineId efx-physic-paint + PhysicStrokePayload) keep their current byte-stable save/load/play behavior."
    - "Rust durable save/load accepts both engineIds and both engine-slot payload shapes, and still fails closed on foreign engines and malformed payloads."
  artifacts:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src-tauri/src/services/script_library.rs
  key_links:
    - "Document-level engineId is the discriminator (locked design): efx-physic-paint = engine-1, efx-watercolor = aquarelle. Per-stroke engine slot shape follows the document engineId."
    - "bakeAquarelleScript (physicsPaintRotoPlayScriptController.ts:1222) already branches on snapshot.engineId === 'efx-watercolor' at confirmGeneration:1465 — the missing half is that no saved document ever carries that engineId."
    - "Aquarelle UV space (y-up 0..1) vs engine-1 canvas pixels (y-down) is the aquarelleStrokeBridge law — aquarelle envelope pts stay in UV; only the engine-1 PaintStroke bridge converts."
    - "aquarelleEventsFromScript currently reads the in-memory record map (empty after restart) — it must prefer a persisted timeline carried on the runtime snapshot."
---

<objective>
Make watercolor (aquarelle) Roto scripts persist and replay through the aquarelle engine. Today a script saved from the Water color module is serialized as an engine-1 document (`engineId: 'efx-physic-paint'` + `PhysicStrokePayload` via `aquarelleStrokeToPaintStroke`), so Play Script Apply takes `renderRotoPlayScriptFrames` and draws thin solid engine-1 brush lines instead of washes, bleed, granulation, and tide lines.

Purpose: close the save/load/play loop for engine-2 scripts so a saved watercolor Action bakes through `bakeAquarelleScript` both same-session and after restart.
Output: dual-engine `.efx-roto-script.json` envelope (same kind/schemaVersion/source/thumbnail/strokes[] shape; `engineId` + engine-slot payload shape vary), TS schema/save/playback wiring, Rust validator parity, pin suites green. Four atomic commits.

Scope fence (locked):
- Envelope discriminator is the DOCUMENT-level `engineId` (`efx-physic-paint` | `efx-watercolor`) — not per-stroke, not brushId.
- Engine-1 format stays byte-stable. This is a branch plus an aquarelle variant, not a rewrite of `serializeRotoScriptStroke` / `isEnginePayload` for engine-1.
- Aquarelle envelope pts are the original UV samples (y-up 0..1). The `aquarelleStrokeToPaintStroke` pixel bridge stays for the engine-1 PaintStroke seam (`enqueueRecordedStroke`, `getStrokes`, canCopy) and is not the persisted aquarelle point source.
- `handleAquarelleStrokeEnd` already records the full `AquarelleStroke` by mutationId (`recordAquarelleStroke`) — the save path reads those records. Do not re-architect the live surface.
- Dry events ride the same persisted timeline (D-16 one payload union), encoded as distinguished stroke entries (see Task 1 contract).
- No new dependencies. No `SPECS/` edits. Local commits only, never push. Preact + `@preact/signals`. No new `useState`.
- `physicPaintStore.ts` stays free of `getImageData` / `putImageData`.

Design answers (locked, do not re-derive):
1. Discriminator: document `engineId`. Envelope stroke `brushId` stays the engine identity for BOTH variants (stamp `efx-watercolor` after the vendor `toStudioStroke` projection) so only engineId + engine-slot shape vary. The tip/preset id lives in `AquarelleStrokePayload.brushId`.
2. `AquarelleStrokePayload` (packages/efx-watercolor/src/payload/toStudioStroke.ts:53-63): `tool: 'brush'|'water'|'pen'|'lift'`, `color: string|null`, `params: Record<string, number>` (AQUA-04 globals size/water/load/flow/bleed/dry/edge/granulation), `brushId: string`, optional `toolOverrides`, `mutationId`, `diffusionFrames`, `timestamp: number`, optional `playFrame`.
3. `bakeAquarelleScript` consumes `AquarellePayloadEvent[]` = `StudioStroke<AquarelleStrokePayload> | AquarelleDryEvent` via `aquarelleEventsFromScript` → `bake.bake(events)`. The adapter reads params/tool/brush from `stroke.engine` (`payload.brushId ?? stroke.brushId`).
4. Play routing already exists at `confirmGeneration` (engineId branch → `bakeAquarelleScript`). What is missing: save emits `efx-watercolor`, parse accepts it, `persistedRotoScriptToRuntime` keeps `engineId` and carries a rebuildable payload timeline, and `aquarelleEventsFromScript` prefers that timeline over the in-memory map.
5. `handleAquarelleStrokeEnd` keeps its PaintStroke bridge + `recordAquarelleStroke(mutationId, stroke)`. The save path looks up `getRecordedAquarelleStroke(mutationId)` / `getRecordedAquarellePayloadTimeline()` and serializes those.

</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md

FIX CONTRACT (locked — already researched, do not re-derive):

1. Aquarelle envelope variant (new):
   - `engineId: 'efx-watercolor'` at the document level. Same `kind: 'efx-studio-paint-script'`, `schemaVersion: 1`, `source`, `thumbnail`, `brushPack` shape as engine-1.
   - Each stroke entry: vendor `toStudioStroke(AquarelleStroke)` projection for pts/ticks/toolOverrides/traceSeed/recordedOrder/playFrame/color/engine, then stamp envelope `brushId` to the aquarelle engine id (keep `engine.brushId` as the tip id).
   - Envelope `cuisson` is 0 for every aquarelle stroke entry. `diffusionFrames` lives only in `AquarelleStrokePayload.diffusionFrames` — never in the engine-1 continuation grouping (a continuation entry would demand zero pts and break the aquarelle timeline).
   - Dry events (D-16) persist as distinguished stroke entries: `pts: []`, `ticks: 0`, `cuisson: 0`, `motion: null`, envelope `brushId` = aquarelle engine id, `toolOverrides: {}`, `traceSeed: 0`, `recordedOrder` = the Dry's recordedOrder, `playFrame: null`, `color: null`, and `engine: { kind: 'dry', tick, recordedOrder }` (the `AquarelleDryEvent` shape).

2. Runtime type (`RotoPaintScript` in physicsPaintRotoScriptClipboard.ts:32):
   - Keep `engineId?: string` (already declared, 56-08).
   - Add optional `aquarelleEvents?: readonly AquarellePayloadEvent[]` — the persisted payload timeline (strokes + Dry, recorded order). `persistedRotoScriptToRuntime` fills it for aquarelle documents; same-session capture may fill it from the record map.
   - `persistedRotoScriptToRuntime` must set `engineId` from the parsed document (today it drops it) and populate `aquarelleEvents` from the envelope + engine slots.

3. Save seam:
   - `captureScriptForPersistence` (physicsPaintRotoScriptClipboard.ts:446) already freezes `RotoPaintScript` from `engine.getStrokes()` (PaintStrokes carry `mutationId`, stamped in `EfxPaintEngine.acceptStroke`).
   - After the drain, if EVERY captured primary stroke has `getRecordedAquarelleStroke(stroke.mutationId)`, attach `aquarelleEvents` built from those recorded `AquarelleStroke`s (via `toStudioStroke`) plus `getRecordedAquarellePayloadTimeline()` Dry events, merged in `recordedOrder`. When any primary lacks a record (mixed engine-1 + watercolor key), leave `aquarelleEvents` absent and keep today's engine-1 serialize.
   - Library `saveActiveFrame` (physicsPaintRotoScriptLibrary.ts:482) picks `serializeAquarelleRotoScript` when `scriptSnapshot.aquarelleEvents` is present; otherwise `createPersistedRotoScript` unchanged.

4. Playback seam:
   - `aquarelleEventsFromScript` (physicsPaintRotoPlayScriptController.ts:1774) returns `script.aquarelleEvents` when present (already a complete `AquarellePayloadEvent[]`), otherwise keeps the current in-memory `getRecordedAquarelleStroke` / `getRecordedAquarellePayload` fallback for same-session.
   - The `confirmGeneration` engineId branch at :1465 stays as-is.

5. Rust (`app/src-tauri/src/services/script_library.rs`):
   - `SCRIPT_ENGINE_ID` stays `efx-physic-paint`. Add `SCRIPT_ENGINE_ID_AQUARELLE = "efx-watercolor"`.
   - `validate_document` accepts either engineId; unknown ids keep failing.
   - Envelope `brushId` must equal the document's engineId (both variants).
   - `validate_engine_payload` branches on the document engineId:
     - engine-1: current `paint|erase` + brush-params bag (unchanged).
     - aquarelle stroke: `tool` in `brush|water|pen|lift`, `color` null-or-hex, `params` object of finite numbers, `brushId` non-empty string, `timestamp` non-negative integer; optional `toolOverrides` object, `mutationId` / `playFrame` non-negative integers, `diffusionFrames` 1..=600.
     - aquarelle Dry marker: `kind == "dry"`, `tick` non-negative integer, `recordedOrder` finite number. A Dry marker entry allows empty `pts` and does not count toward brush/continuation limits.

LANDMARKS (verified):
- packages/efx-watercolor/src/payload/toStudioStroke.ts:53-63 — `AquarelleStrokePayload`; :79-134 `AquarelleStroke` + `toStudioStroke` (UV pts, engine slot = payload).
- packages/efx-watercolor/src/payload/dryEvent.ts:20-35 — `AquarelleDryEvent` + `AquarellePayloadEvent` union + `isAquarelleDryEvent`.
- app/src/components/physic-paint/view/aquarelleRecordState.ts:193 `buildAquarelleStrokePayload`; :217 `recordAquarelleStroke`; :228 `getRecordedAquarelleStroke`; :235 `getRecordedAquarellePayload`; :291-307 payload timeline + `getRecordedAquarellePayloadTimeline`; :319 `emitAquarelleDry`.
- app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts:36 `aquarelleUvToEnginePixel`; :52 `aquarelleStrokeToPaintStroke` (engine-1 seam only).
- app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:12 `ROTO_SCRIPT_ENGINE_ID`; :54-63 persisted types; :135 `serializeRotoScriptStroke`; :186 `serializeRotoScript`; :228 `parseRotoScript`; :282 `persistedRotoScriptToRuntime`; :334 `isPersistedRotoScriptV1`; :361 `isEnvelopeStroke`; :392 `isEnginePayload`.
- app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:32 `RotoPaintScript` (has `engineId?`); :446 `captureScriptForPersistence`; :959 `deepFreezeScript`.
- app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:506 save calls `createPersistedRotoScript`; :565 `loadSnapshot` → `persistedRotoScriptToRuntime` → `deepFreezeSnapshot` (already forwards `engineId` at :708).
- app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1222 `bakeAquarelleScript`; :1465 engineId branch; :1754 `createDefaultAquarelleAdapter`; :1774 `aquarelleEventsFromScript`.
- app/src-tauri/src/services/script_library.rs:16 `SCRIPT_ENGINE_ID`; :2112 `validate_document`; :2266 `validate_envelope_stroke`; :2318 `validate_engine_payload`.
- packages/efx-watercolor/src/adapter/engineAdapter.ts:158-165 — configure reads `payload.params` / `payload.brushId ?? stroke.brushId` / `payload.tool`; :257-264 `applyStroke` handles Dry via `isAquarelleDryEvent`.

GUARDRAILS (locked):
- Do not change engine-1 `serializeRotoScriptStroke` field mapping, `clampParams`, or the engine-1 arm of `isEnginePayload` / Rust `validate_engine_payload`.
- Do not convert aquarelle envelope pts through `aquarelleUvToEnginePixel` before persisting — UV is the aquarelle record space.
- Do not invent a second events array or a per-stroke dry flag (D-16).
- Do not touch `physicPaintStore.ts`, `SPECS/`, or vendor packages under `packages/efx-watercolor/` / `packages/efx-physic-paint/`.
- Fail-closed stays fail-closed: unknown engineId still refuses; malformed aquarelle payloads refuse; mixed engine-1+watercolor captures keep the engine-1 serialize path.
- pnpm, never npm. `vitest run` only — never watch. Tests collect `.test.ts` only.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Dual-engine script schema — aquarelle envelope variant + runtime timeline</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts</files>
  <behavior>
    - serializeAquarelleRotoScript emits engineId efx-watercolor, UV pts, engine AquarelleStrokePayload, envelope brushId equal to the aquarelle engine id, cuisson 0 on every stroke entry.
    - A Dry event round-trips as a distinguished stroke entry with engine.kind 'dry' and reconstructs to AquarelleDryEvent.
    - parseRotoScript accepts both engineIds and rejects a third; isEnginePayload dispatches on the document engineId.
    - persistedRotoScriptToRuntime sets engineId and aquarelleEvents from the document; engine-1 runtime output stays equivalent to today.
    - Engine-1 serialize/parse round-trip remains byte-stable on the existing fixtures.
  </behavior>
  <action>
One atomic commit. Extend `physicsPaintRotoScriptSchema.ts` with the aquarelle variant and cover it in `physicsPaintRotoScriptSchema.test.ts` (red first).

**Constants / types.**
- Export `ROTO_SCRIPT_ENGINE_ID_AQUARELLE = 'efx-watercolor' as const` next to `ROTO_SCRIPT_ENGINE_ID`.
- Add `export type PersistedRotoScriptAquarelleV1` as the same `Omit<StudioScriptEnvelope<AquarelleStrokePayload>, 'source'> & { source: PersistedRotoScriptSourceV1 }` shape, and a union alias `PersistedRotoScriptAnyV1 = PersistedRotoScriptV1 | PersistedRotoScriptAquarelleV1` for parse results. Keep `PersistedRotoScriptV1` as the engine-1 name existing callers import.
- Import `type AquarelleStrokePayload`, `type AquarelleDryEvent`, `type AquarellePayloadEvent`, `isAquarelleDryEvent`, `createDryEvent` (or reconstruct drys structurally), and `toStudioStroke` / `type AquarelleStroke` from `@efxlab/efx-watercolor/payload`. Import `AQUARELLE_TOOLS` if useful for the tool allow-list.

**Serialize.**
- New `serializeAquarelleRotoScript(input)` mirroring `serializeRotoScript`'s envelope fields (kind, schemaVersion 1, id, name, createdAt, updatedAt, source, thumbnail, brushPack) but with `engineId: ROTO_SCRIPT_ENGINE_ID_AQUARELLE`.
- Input carries `events: readonly AquarellePayloadEvent[]` (recorded-order strokes + Drys) plus the same id/name/source/thumbnail bag. Flatten to `strokes[]` in recorded order:
  - For a stroke event (`StudioStroke<AquarelleStrokePayload>`): copy the vendor projection's pts/ticks/toolOverrides/traceSeed/recordedOrder/playFrame/color/engine, then set envelope `brushId` to `ROTO_SCRIPT_ENGINE_ID_AQUARELLE`, force `cuisson: 0`, keep `motion: null`. `engine` is the `AquarelleStrokePayload` as recorded (tip id stays in `engine.brushId`).
  - For a Dry event: emit the distinguished entry from the contract (`pts: []`, `ticks: 0`, `cuisson: 0`, `brushId: ROTO_SCRIPT_ENGINE_ID_AQUARELLE`, `toolOverrides: {}`, `traceSeed: 0`, `recordedOrder`, `playFrame: null`, `color: null`, `engine: { kind: 'dry', tick, recordedOrder }`).
- End with `isPersistedRotoScriptAquarelleV1` (or the union guard) and throw on failure, same law as `serializeRotoScript`.

**Validate / parse.**
- `isEnginePayloadAquarelleStroke`: `tool` one of `AQUARELLE_TOOLS`, `color` null or `#rrggbb`, `params` a record whose values are finite numbers, `brushId` non-empty string, `timestamp` a safe integer >= 0; optional `toolOverrides` object, `mutationId` / `playFrame` non-negative safe integers, `diffusionFrames` integer in 1..=600 (reuse the local `DIFFUSION_CAP`).
- `isEnginePayloadAquarelleDry`: `kind === 'dry'`, `tick` non-negative safe integer, `recordedOrder` finite number.
- `isEnvelopeStroke` gains a document-engineId parameter (or a sibling `isEnvelopeStrokeAquarelle`): empty `pts` is legal only when the engine slot is a Dry marker; non-Dry primaries still need >= 1 point; `cuisson` is 0 for every aquarelle entry; `brushId` equals `ROTO_SCRIPT_ENGINE_ID_AQUARELLE`; engine slot dispatches to the aquarelle stroke or Dry guard.
- `isPersistedRotoScriptV1` dispatches on `value.engineId`: `efx-physic-paint` keeps the current engine-1 guards; `efx-watercolor` uses the aquarelle guards (brush/continuation limits unchanged except Dry markers do not count as brushes or continuations). A third engineId stays false.
- `parseRotoScript`: today a non-engine-1 id returns `engine-mismatch`. Change the branch so a known aquarelle id falls through to the aquarelle shape guard (refusal `malformed-engine-payload` on shape failure); keep `engine-mismatch` for ids that are neither engine. The refusal detail pair stays `"<scriptEngineId>:<targetEngineId>"` with target `ROTO_SCRIPT_ENGINE_ID` when a foreign engine is offered to the engine-1 reader, and a parallel pair when a foreign engine is offered to the aquarelle reader.

**Runtime.**
- `persistedRotoScriptToRuntime`: after `parseRotoScript`, set `engineId: document.engineId`. For aquarelle documents build `aquarelleEvents` by walking `document.strokes` in order — Dry marker → `{ kind: 'dry', tick, recordedOrder }`; otherwise reconstruct `StudioStroke<AquarelleStrokePayload>` from pts + engine slot (envelope `cuisson` forced 0 already). Also fill `brushes` with one group per non-Dry stroke, projecting UV pts through `aquarelleUvToEnginePixel` against `document.source.width/height` so engine-1 consumers still see pixel-space PaintStrokes (import that helper from `../engine/aquarelleStrokeBridge`).
- `rotoScriptLibraryRow.brushCount` counts only non-Dry `cuisson === 0` entries.

Comment-text discipline: write assertions as positive expectations about the aquarelle variant and the dual-accept set. Keep engine-1 reject messages unchanged where they already exist.

</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts</automated>
  </verify>
  <done>
    serializeAquarelleRotoScript produces a document that isPersistedRotoScriptAquarelle accepts and parseRotoScript returns as ok with engineId efx-watercolor; Dry entries round-trip; persistedRotoScriptToRuntime sets engineId + aquarelleEvents; engine-1 fixtures in physicsPaintRotoScriptSchema.test.ts stay green. One commit.
  </done>
</task>

<task type="auto">
  <name>Task 2: Save path serializes watercolor captures as the aquarelle variant</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts</files>
  <action>
One atomic commit. Wire the record-time aquarelle bag into the durable save.

**1) Capture — `captureScriptForPersistence` (physicsPaintRotoScriptClipboard.ts:446).**
After `normalizeLogicalBrushes(engine.getStrokes())` and before `deepFreezeScript`, decide the engine variant from the captured primaries:
- Collect `mutationId`s from each `brush.primary`.
- Import `getRecordedAquarelleStroke` and `getRecordedAquarellePayloadTimeline` from `../view/aquarelleRecordState` (view layer has no import back into roto — no cycle).
- When every primary has a recorded `AquarelleStroke`, build `aquarelleEvents: AquarellePayloadEvent[]`:
  - Map each recorded stroke through `toStudioStroke` (the vendor projection — UV pts + engine payload), in the same brush order `normalizeLogicalBrushes` produced (primaries then their continuations).
  - Take Dry events from `getRecordedAquarellePayloadTimeline()` (filter `isAquarelleDryEvent`) and merge with the projected strokes on `recordedOrder` (stroke wins a tie — same law as `aquarelleEventsFromScript`).
  - Attach as `aquarelleEvents` on the `RotoPaintScript` passed to `deepFreezeScript`.
- When any primary lacks a record, leave `aquarelleEvents` undefined (engine-1 path unchanged — mixed key).

Extend `deepFreezeScript` to freeze `aquarelleEvents` when present (freeze the array and each event object). `RotoPaintScript.aquarelleEvents` is already declared in Task 1 / the existing `engineId?` field group — if Task 1 did not add the field, add it here as `aquarelleEvents?: readonly AquarellePayloadEvent[]` alongside `engineId?`.

**2) Save — `saveActiveFrame` (physicsPaintRotoScriptLibrary.ts:506).**
Branch on `scriptSnapshot.aquarelleEvents`:
- Present → call a new `serializeAquarelleRotoScript` (from `physicsPaintRotoScriptSchema`) with the same id/name/createdAt/updatedAt/source/thumbnail bag and `events: scriptSnapshot.aquarelleEvents`. Skip `createPersistedRotoScript` for that capture.
- Absent → existing `createPersistedRotoScript({ ..., brushes: scriptSnapshot.brushes })`.
Import the aquarelle serializer beside the existing `createPersistedRotoScript` import.

**3) Clipboard parity.**
`replaceClipboardFromPersisted` currently rebuilds the clipboard object without `engineId` / `aquarelleEvents`. Forward both optional fields through `deepFreezeScript` so a loaded watercolor script keeps its engine identity on the clipboard (Play Script Apply uses `loadSnapshot`, but the clipboard must not silently drop the discriminator).

Do not change `handleAquarelleStrokeEnd`, `aquarelleStrokeToPaintStroke`, or `enqueueRecordedStroke` — the PaintStroke bridge stays the engine-1 seam.

</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts</automated>
  </verify>
  <done>
    A capture whose primaries all have recorded AquarelleStrokes serializes with engineId efx-watercolor and AquarelleStrokePayload engine slots; Dry events land on the persisted timeline; a capture without aquarelle records keeps the engine-1 serializer; library + clipboard + schema suites green. One commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Playback rebuilds the aquarelle timeline from the persisted script</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts</files>
  <behavior>
    - a squarelle runtime snapshot carrying aquarelleEvents feeds bake.bake exactly that timeline (strokes + Drys) with no in-memory record-map dependency.
    - The in-memory map fallback still serves a snapshot without aquarelleEvents (same-session path).
    - The confirmGeneration engineId branch still routes efx-watercolor to bakeAquarelleScript and efx-physic-paint to renderRotoPlayScriptFrames.
  </behavior>
  <action>
One atomic commit. Make `aquarelleEventsFromScript` (physicsPaintRotoPlayScriptController.ts:1774) persisted-first.

- At the top of `aquarelleEventsFromScript`, when `script.aquarelleEvents` is present and non-empty, return that timeline (already `AquarellePayloadEvent[]` in recorded order). Do not re-merge Drys — the persisted timeline already interleaved them.
- Keep the existing `getRecordedAquarelleStroke` / `getRecordedAquarellePayload` / `getRecordedAquarelleDryEvents` reconstruction as the fallback when `aquarelleEvents` is absent (covers a live capture that has not been serialized yet, and keeps the 56-08 same-session behavior).
- No change to `bakeAquarelleScript`, `createDefaultAquarelleAdapter`, `createAquarelleAdapter`, or the `snapshot.engineId === 'efx-watercolor'` branch at :1465.

Extend `physicsPaintRotoPlayScriptController.bake.test.ts` (the 56-08 aquarelle bake describe):
- A snapshot with `engineId: 'efx-watercolor'` and a synthetic `aquarelleEvents` timeline asserts `bake.bake` receives that exact event list (stroke + Dry), even when the in-memory record map is empty.
- A snapshot with `engineId: 'efx-watercolor'` and no `aquarelleEvents` still reaches `bake.bake` (fallback seam alive).
- The existing engine-1 routing test stays green.

Comment-text discipline: name the new cases after the persisted-timeline contract; keep the existing routing case copy.

</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
  </verify>
  <done>
    bake.bake receives the persisted aquarelleEvents timeline for a reloaded watercolor snapshot; the in-memory fallback still works when aquarelleEvents is absent; engine-1 Play Script routing is unchanged; both bake/controller suites green. One commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Rust durable validator accepts the aquarelle script variant</name>
  <files>app/src-tauri/src/services/script_library.rs</files>
  <behavior>
    - validate_document accepts engineId efx-physic-paint and efx-watercolor, and rejects a third id.
    - An aquarelle document with UV pts, AquarelleStrokePayload engine slots, and Dry-marker entries validates.
    - An engine-1 document validates exactly as before.
    - Malformed aquarelle payloads and unknown engineIds still fail closed.
  </behavior>
  <action>
One atomic commit. Mirror the TS dual-engine law in `app/src-tauri/src/services/script_library.rs` (same class of gap as 261018-lqv's paper/* background — TS ahead of Rust).

- Add `pub const SCRIPT_ENGINE_ID_AQUARELLE: &str = "efx-watercolor";` beside `SCRIPT_ENGINE_ID`.
- `validate_document` (:2112): accept `engineId` in `{SCRIPT_ENGINE_ID, SCRIPT_ENGINE_ID_AQUARELLE}`. Reject any other id with the existing "Invalid script engineId" error. Resolve the document's engine id into a local and thread it into stroke/payload validation.
- `validate_envelope_stroke` (:2266): `brushId` must equal the DOCUMENT's engine id (both variants). For aquarelle documents, an empty `pts` array is legal only when the engine slot is a Dry marker; a non-Dry primary still requires >= 1 point; `cuisson` stays 0 for every aquarelle entry (continuation counting only applies to the engine-1 document engine).
- `validate_engine_payload` (:2318): branch on the document engine id.
  - engine-1 arm: leave the current `paint|erase` + brush-params checks exactly as they are (including continuation `diffusionFrames` requirements).
  - aquarelle stroke arm: `tool` in `brush|water|pen|lift`; `color` null-or-`#rrggbb`; `params` object whose values are finite numbers; `brushId` non-empty string; `timestamp` non-negative integer; optional `toolOverrides` object; optional `mutationId` / `playFrame` non-negative integers; optional `diffusionFrames` integer in 1..=600.
  - aquarelle Dry marker arm: `kind == "dry"`, `tick` non-negative integer, `recordedOrder` finite number. A Dry marker entry does not consume a brush slot or a continuation slot.
- Keep `SCRIPT_VERSION` / kind / thumbnail / source / brushPack validation shared across both variants.
- Add unit tests in the existing `mod tests` at the file tail (serde_json `json!` style, same as `validate_source_accepts_paper_background_and_grain_scale`):
  - an aquarelle document with one stroke + one Dry marker validates;
  - the same document with a third `engineId` is rejected;
  - an aquarelle stroke with an engine-1 tool id (`paint`) is rejected;
  - an engine-1 document still validates.

</action>
  <verify>
    <automated>cargo test --manifest-path app/src-tauri/Cargo.toml script_library</automated>
  </verify>
  <done>
    validate_document accepts both engineIds and both payload shapes including Dry markers; a third engineId and a mismatched payload shape fail closed; engine-1 documents still validate; the new script_library unit tests pass. One commit.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| On-disk `.efx-roto-script.json` -> TS parse / Rust `validate_document` | untrusted document bytes cross into the Script library and Play Script bake |
| Script engine slot (`engine: P`) -> aquarelle adapter / engine-1 renderer | opaque payload selects renderer params, tool, and brush |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261018-odm-01 | Tampering | parseRotoScript / validate_document engineId arm | high | mitigate | engineId allow-list is exactly two package ids; a third id keeps the named engine-mismatch / Invalid script engineId refusal; payload shape is dispatched from the document engineId so an engine-1 bag cannot ride an aquarelle document |
| T-261018-odm-02 | Information Disclosure | AquarelleStrokePayload.params / toolOverrides | low | accept | params are brush physics numbers and tip multipliers already visible in the Studio UI; no secrets ride the engine slot |
| T-261018-odm-03 | Denial of Service | strokes[] / pts / Dry-marker counts | medium | mitigate | existing ROTO_SCRIPT_LIMITS (brushes, continuations, pointsPerBrush, totalPoints, fileBytes) stay in force; Dry markers are counted separately and capped with the stroke budget, never an unbounded side channel |
| T-261018-odm-SC | Tampering | npm/pip/cargo installs | high | mitigate | package-legitimacy gate + blocking human checkpoint for [ASSUMED]/[SUS] (no install in this plan) |
</threat_model>

<verification>
1. `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — all green.
2. `cargo test --manifest-path app/src-tauri/Cargo.toml script_library` — green, including the new dual-engine + Dry-marker cases.
3. Round-trip pin (in schema tests): `serializeAquarelleRotoScript` → `parseRotoScript` → `persistedRotoScriptToRuntime` keeps `engineId === 'efx-watercolor'` and an `aquarelleEvents` timeline whose stroke count + Dry count match the input.
4. Engine-1 regression pin: the existing engine-1 serialize/parse fixtures in `physicsPaintRotoScriptSchema.test.ts` stay green with no fixture edits beyond imports.
</verification>

<success_criteria>
A watercolor Action saved from the Water color module loads back as `engineId: 'efx-watercolor'`, Play Script Apply calls `bakeAquarelleScript` with the persisted `AquarellePayloadEvent` timeline (UV points + `AquarelleStrokePayload` + Drys), and the baked frames come from the aquarelle engine. Engine-1 scripts save, load, and play exactly as before. Rust durable IO accepts both variants and still refuses foreign or malformed documents. Four commits, suites above green.

Live UAT (user, after automated-ready): paint with Water color, Save Script, restart the app, Play Script Apply the saved Action — output shows washes / bleed / granulation / tide lines at the painted coordinates. A pre-existing engine-1 script still replays as brush strokes.
</success_criteria>

<output>
Create `.planning/quick/261018-odm-build-watercolor-script-playback-extend-/261018-odm-SUMMARY.md` when done
</output>
