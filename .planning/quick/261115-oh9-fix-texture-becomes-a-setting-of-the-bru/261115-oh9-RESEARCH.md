# Quick 261115-oh9: Texture becomes a setting of the brush response — Research

**Researched:** 2026-11-15
**Domain:** efx-watercolor brush binding, Preact Studio UI, payload/script carriers
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### The law
- The response ALWAYS owns the physics; the texture only replaces the footprint.
- `build(brushId, textureId, overrides)`:
  `base = presetFor(brushId)`; `tip = textureId ? resolveMask(textureId) ?? base.tip : base.tip`;
  `brush = buildBrush({ ...base, tip })`; then apply the 8 multipliers.
- `CUSTOM_BASE` is no longer reachable from any texture path. No UI brush is
  ever built from it (leaf it exported, unused by this path).
- An unknown or unavailable `textureId` falls back to the response's own
  procedural tip — never throws, never changes the response, never blanks.

#### Default = no texture
- The Default texture chip means "no texture" and must show the **selected
  response's own procedural tip** through the real-mask pipeline. It repaints
  when the response changes — it must show exactly what will stamp, never a
  static neutral glyph.

#### Legacy strokes — clean break, no recovery
- The user abandons phase-63 projects; no recovery, no migration, no legacy
  mapping table additions.
- A legacy stroke whose `brushId` is a texture id replays through today's
  `presetFor` fallback → `round`. Accepted loss, stated in the SUMMARY.
- Existing `TIP_TO_PRESET` entries (`wc/round-medium` → `round`, …) stay as
  they are; do not repurpose or extend them.

#### Builder API
- Options object: `buildBrushForStroke(brushId, { textureId?, overrides?, seed? })`.
  Self-documenting at ~50 call sites, impossible to confuse texture with
  overrides, phase 64's extra axes stay additive.

#### Selection model
- `aquarelleSelectedTipId` keeps its name; its values become response ids
  (`round`, `chalk`, `flat`, …). Picking a card never sets a texture.
- A new Studio-realm signal `aquarelleSelectedTextureId: string | null`
  (default `null`) sits beside it. Applied in the click handler, never in an
  effect.
- The one live/record binding seam is `aquarelleBrushForActiveTool()`; it
  returns `textureId` too, so live, record and bake can never disagree.
- The Lift (eraser) has NO texture: it keeps its own shape ids and a neutral
  texture (`null`).

#### UI
- `WatercolorBrushLibrary`: grid lists responses only (the Texture and Custom
  sections are removed); a texture row sits above the grid — Default chip
  first, then the three built-ins, then project imports; each texture chip
  renders the real 192×192 grayscale mask (dark ground, white footprint), not
  a painted watercolor stroke. Response cards keep their painted-stroke thumbs.
  The "Import tip" control belongs to the texture row; an import selects on
  arrival.
- `PhysicsPaintBrushMenu` (top-bar popover): responses in the list, a texture
  strip pinned below the scrollable list (the spec says "below it"). The
  eraser branch keeps its shape list and gains no texture strip.
- The unavailable-tip behaviour (greyed unselectable chip + exactly one
  aggregate warning line) moves onto the texture chip.

#### Payload
- `textureId` rides beside `brushId` on the stroke and in the payload
  (`AquarelleStrokePayload` / `AquarelleStroke`); optional, absent is valid.
- `codec.ts` validates it (string when present) and round-trips it without
  bumping `schemaVersion` (absence is the documented default, the
  anchors/curveMode precedent).
- Roto script events carry it unchanged; `referencedCustomBrushIds` must read
  the textures referenced by the capture so a save refuses only for a texture
  that cannot travel.

### Claude's Discretion
Not stated in CONTEXT.md (it has no `## Claude's Discretion` section). Chip component, helper names, CSS classes and the exact options-object field names are free within the locked decisions.

### Deferred Ideas (OUT OF SCOPE)
None stated in CONTEXT.md. The spec's hard exclusions are out of scope: no new responses / medium engine (phase 64), no texture blending modes, no `wc/texture-*` prefix, no migration for existing projects or strokes, no texture on the eraser, no renames of existing `brushId` readers.
</user_constraints>

## Summary

The law change is confined to one function (`buildBrushForStroke`) and one binding seam (`aquarelleBrushForActiveTool`), but `textureId` must be threaded through five production readers, two explicit stroke-rebuild sites plus one vector-stroke builder, and the payload/script carriers. The critical carrier decision: **`textureId` belongs in the opaque `engine` slot, never as a top-level `StudioStroke` field** — `codec.cloneStrokeForWire` rebuilds top-level fields explicitly and spreads `engine`, and the host type has no texture field. A top-level field would be silently dropped on every codec round-trip (live bake included).

The second trap is the old selection path: `selectAquarelleTip` still resolves catalog texture ids and applies their multipliers (`aquarelleRecordState.ts:258-290`). Texture chips must NOT call it; they write only the new `aquarelleSelectedTextureId`.

**Primary recommendation:** implement the law as a small exported mask-resolution helper (`strokeTipData(brushId, textureId)`) reused by both `buildBrushForStroke` and the Default/texture chips, so a chip can only ever show what the engine stamps; thread `textureId` through `engine` only; update all call sites to the options object in one compile-error-driven pass.

## 1. Call-site inventory — `buildBrushForStroke`

Current signature and mask branch:

```ts
// packages/efx-watercolor/src/playground/brushBridge.ts:63-71 [VERIFIED: read this session]
export function buildBrushForStroke(
  brushId: string,
  overrides?: BrushMultiplierOverrides | null,
  seed = 7,
): Brush {
  const mask = resolveMask(brushId)
  const base = mask
    ? buildBrush({ ...CUSTOM_BASE, id: brushId, name: brushId, hint: '', tip: mask }, seed)
    : buildBrush(presetFor(brushId), seed)
```

`CUSTOM_BASE` [VERIFIED: packages/efx-watercolor/src/playground/brushes.ts:342-344]:
`{ ...BASE, rotation: 'follow', angleJitter: 4, spacing: 0.2, wetRound: 0.4 }`.
`TIP_SIZE = 192` [VERIFIED: brushes.ts:70]; `TIP_MASK_BYTES = TIP_SIZE * TIP_SIZE` [VERIFIED: packages/efx-watercolor/src/brushes/deriveMask.ts:42].

Production call sites (all must change):

| File:line | Role | Texture source |
|---|---|---|
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:314` | live bind (`applyLiveConfig`) | `aquarelleBrushForActiveTool().textureId` |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts:295` | bake/replay `configure()` | `payload.textureId` (engine slot) |
| `app/src/components/physic-paint/engine/aquarelleFootprint.ts:86` | cursor ring | new footprint input `textureId` |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts:92` | selection band | `stroke.textureId` |
| `app/src/components/physic-paint/roto/aquarelleLiftErase.ts:93` | lift punch | always `null` (eraser) |
| `app/src/components/physic-paint/view/watercolorStrokeThumb.ts:195` | response-card thumb | no texture (response thumbs only) |
| `packages/efx-watercolor/probe/watercolor-opacity/probe.ts:87` | probe | none |
| `packages/efx-watercolor/probe/vector-spine/probe.ts:260,518` | probe | none |

Test call sites (17 files) are listed in §9. `dist/index.d.ts` is generated — rebuild `@efxlab/efx-watercolor` after the signature change.

## 2. Record/replay chain and the `textureId` carrier

**Carrier = `engine`.** Evidence:
- `StudioStroke<P>` (`packages/efx-paint-host/src/animation/types.ts:34-55`) has `brushId`, `toolOverrides`, `engine: P` — no texture field and no index signature, so a top-level `textureId` is a TS excess-property error at `toStudioStroke`.
- `codec.cloneStrokeForWire` (`packages/efx-watercolor/src/payload/codec.ts:139-171`) rebuilds `pts/ticks/cuisson/.../brushId/toolOverrides/...` explicitly and does `engine: { ...stroke.engine, params..., toolOverrides..., diffusionFrames, ...anchors }` — an engine-slot `textureId` survives; a top-level one is dropped.
- Rust `validate_engine_payload_aquarelle` (`app/src-tauri/src/services/script_library.rs:2807-2853`) reads only known keys and returns `Ok`, never strips; `serde_json::Value` keeps unknown keys.

Replay hubs and what each needs:
- **Live** — `AquarelleCanvasLayer.tsx:306-315`: `const selection = aquarelleBrushForActiveTool(); engine.setBrush(buildBrushForStroke(selection.brushId, selection.toolOverrides))` [VERIFIED: read]. Pass `selection.textureId`.
- **Bake/replay** — `engineAdapter.ts:291-300`: `engine.setBrush(buildBrushForStroke(payload.brushId ?? stroke.brushId, payload.toolOverrides ?? stroke.toolOverrides))` [VERIFIED: read]. Pass `{ textureId: payload.textureId, overrides: ... }`. `acceptEvent` is `payloadCodec.parse(payloadCodec.serialize(raw))` (98-104) — engine slot guarantees the texture rides the bake round-trip.
- **Lift punch** — `liftShapeForStroke` (`aquarelleLiftErase.ts:90-101`) mirrors bake; eraser has no texture, pass `null` explicitly.
- **Stroke band** — `paintTipForStroke` (`aquarelleStrokeBand.ts:89-101`) must widen its `Pick` to include `textureId`.
- **Cursor footprint** — `aquarelleFootprint.ts:83-90` single-entry cache `signature = \`${tipId ?? ''}|${overridesSignature(overrides)}|g${maskGeneration()}\`` [VERIFIED: read]. Add `textureId` to the input and the signature, or the ring lags the chip.

**Sites that reconstruct a stroke/payload and would silently drop `textureId` (must be edited):**
- Record literal: `AquarelleCanvasLayer.tsx:574-594` (`brushId: recordedBrushId`, no spread).
- Vector commit source: `AquarelleCanvasLayer.tsx:496-506` and `buildVectorStroke` (`view/vectorPathHandles.ts:1004-1035`, `VectorStrokeSource` at 120-129) — both need `textureId`.
- `restoreAquarelleRecordTimeline`: `aquarelleRecordState.ts:1776-1797` explicit `AquarelleStroke` rebuild.
- `getRecordedAquarellePayload`: `aquarelleRecordState.ts:2029-2045` explicit payload rebuild.
- Dup/copy: `physicsPaintRotoDuplicateScript.ts:181-211` `aquarelleStrokeFromScriptEvent` explicit rebuild.
- `toStudioStroke` itself (`packages/efx-watercolor/src/payload/toStudioStroke.ts:172-199`) — add `textureId` to `AquarelleStrokePayload`/`AquarelleStroke` and into the `engine: { ... }` literal.

Paths that spread already preserve it: translate/transform/step/place replacements, clipboard rebuilds (`physicsPaintRotoScriptClipboard.ts` uses `engine: { ...event.engine }`), `serializeAquarelleRotoScript` (`physicsPaintRotoScriptSchema.ts:193` `engine: { ...event.engine }`), script parse.

## 3. Payload / codec / host / Rust

- `AquarelleStrokePayload` (`toStudioStroke.ts:65-93`) currently `brushId: string; toolOverrides?: ...` [VERIFIED: read]. Add `textureId?: string` there (the engine slot) and to `AquarelleStroke` (132-152). Absence is the documented default — the `anchors`/`curveMode`/`vectorDrawn` precedent.
- `codec.ts`: `AQUARELLE_SCHEMA_VERSION = 1` [VERIFIED: codec.ts:35]. Add a fail-closed check in `isStrokeShape`/`cloneStrokeForWire`: present ⇒ non-empty string. Unknown engine keys are allowed today; do not tighten that.
- Host `efx-paint-host` needs no change (engine slot is opaque).
- Rust: no change required. Optional hardening: reject a present non-string `textureId` in `validate_engine_payload_aquarelle`; not needed for round-trip correctness.
- Saved strokes in phase-63 projects carrying a texture id in `brushId` replay as `presetFor(textureId) → 'round'` — accepted loss, mention in SUMMARY.

## 4. Rendering a real mask chip (Preact)

- Masks are already in-memory: built-ins registered from `BUILTIN_TIP_MASKS` (`builtinTips.ts:42-46` ids `wc/builtin-bristle` / `-chalk` / `-sponge`), imports registered in the main realm on project open, script masks on script load. No `new Image` / `createImageBitmap` — **no decode storm**. The generated base64 constants are already in the bundle, so chips add no asset weight.
- Recommendation: new pure module `app/src/components/physic-paint/view/watercolorMaskChip.ts` (do not overload `watercolorStrokeThumb.ts`, which paints watercolor strokes):
  - `getMaskChip(brushId, textureId)` returns a cached `HTMLCanvasElement` 192×192, each mask byte written as `(v,v,v,255)` via `putImageData` (dark ground, white footprint).
  - Cache key: `${brushId}|${textureId ?? ''}|g${maskGeneration()}` — `brushId` is required because the Default chip depends on the selected response; `maskGeneration()` invalidates on registry replace/reset (same pattern as `watercolorStrokeThumb.ts:203-213`).
  - The Default chip's bytes must be the law's own `base.tipData`. Add `strokeTipData(brushId, textureId): Uint8Array` in `brushBridge.ts` (or export `presetFor`) and have `buildBrushForStroke` and the chip both use it; pin with a test `strokeTipData(...) === buildBrushForStroke(...).tipData`.
  - Cache is unbounded only by catalog size (3 + imports) — fine; clear on `resetAquarelleBrushState` if a test seam is needed.
- Do not write signals in the render body; deriving the chip from signals is a pure read.

## 5. UI surfaces, measurement, CSS

- `WatercolorBrushLibrary.tsx:356-393` [VERIFIED: read] currently renders `BRUSH_PRESETS` section + `BUILTIN_TIPS` "Texture" section + "Custom" section. Rebuild: one response grid from `BRUSH_PRESETS`; a texture row above it (Default chip, three built-ins, imports); import control moves into the row. `onImportFile` (247-268) does not currently select on arrival — after a successful `answer.entry`, call the texture-selection click handler.
- Popover `PhysicsPaintBrushMenu.tsx`: measurement at 47-66 [VERIFIED: read]:
  `const chrome = menu.offsetHeight - scroller.clientHeight; const measured = Math.ceil(chrome + list.offsetHeight);`
  A texture strip placed as a sibling **after** `<SidebarScrollArea>` (inside `.physics-paint-brush-menu`) is outside the scroller, so it is included in `chrome` and the natural-height math stays correct. Two requirements: keep `listRef` on the inner list; add re-measure deps (`brushCatalogGeneration` / `unavailableTipCount`) because the strip's content can change while open (import selects on arrival) and the current deps are only `[open, anchor?.top]`.
- CSS ownership: `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-brush-menu*` (~950-1060), `.watercolor-brush-card*` (~2096-2135). Add chip styles beside the card styles; response thumb ratio (150×44) stays.
- Chunk budget: `chunkSizeWarningLimit: 2000` [VERIFIED: app/vite.config.ts:290] — no new base64 assets; chips reuse registered masks.

## 6. Gating and unavailable textures

`unavailableTipIds` / `unavailableTipCount` (`app/src/stores/aquarelleBrushCatalog.ts:87-94` [VERIFIED: read]) are replaced per open by `applyBrushCatalogPayload` / `applyProjectBrushSet`; `listAquarelleBrushTips()` = `[...BUILTIN_TIPS, ...customBrushTipsSignal.value]` (135-137). Built-ins are compile-time and can never be unavailable. Move `unavailable={unavailableIds.has(id)}` from `BrushCard` (WatercolorBrushLibrary 389) to the custom texture chips; keep the single aggregate warning at the root (`unavailableCount`). Response cards (presets) never receive the prop. Same gating applies to the popover strip.

## 7. Script carrier

`referencedCustomBrushIds` (`physicsPaintRotoScriptLibrary.ts:379-390` [VERIFIED: read]) reads `event.engine.brushId` and filters `wc/custom-`. Extend it to also read `event.engine.textureId` (primary under the new law; keep the `brushId` read so an old script still refuses on a texture it cannot travel). Save leg (~716) compares the result against `buildScriptBrushEntries()` carrier entries; built-in textures never travel (compile-time) and must not be reported missing. `serializeAquarelleRotoScript` (`physicsPaintRotoScriptSchema.ts:184-194`) and the clipboard already spread `engine`, so no wire change.

## 8. Pitfalls

1. **Top-level `textureId` is silently dropped** by `cloneStrokeForWire` and violates the host type. Engine slot only.
2. **Explicit rebuild sites** listed in §2 — each is a data-loss point a test must cover (record → payload → codec → script → copy).
3. **Selection-path conflation**: `selectAquarelleTip` still accepts texture ids (`aquarelleRecordState.ts:258-264` resolves `findTip` → `BRUSH_PRESETS` → `resolveCatalogTip` and applies catalog multipliers at 286-289). Texture chips must write only `aquarelleSelectedTextureId`; leave `selectAquarelleTip` additive (hard exclusion), but no UI path goes through it for textures.
4. **Live/bake disagreement** if any of the five readers forgets `textureId`; the parity test (acceptance 5) must compare the resolved brush from record, bake and replay.
5. **Default chip staleness** if its cache key omits the response id; **cursor ring staleness** if the footprint signature omits `textureId`.
6. **Effect/signal rules**: texture selection in the click handler; no `useEffect`/`useState` (efx-preact-reactivity).
7. **Built-in id reservation**: `registerMask` refuses built-in ids; chips must never attempt registration.
8. **Eraser**: `aquarelleBrushForActiveTool()` must return `textureId: null` for lift; popover lift branch gains no strip.
9. **Popover measurement deps** (see §5) — a stale natural height blanks or stretches the menu.
10. **Vitest collects only `.test.ts`** in this repo — any new UI test must be `.test.ts` (not `.test.tsx`) to actually run.
11. **No `wc/texture-*` prefix**: `TIP_TO_PRESET` already owns `wc/texture-grain/-sponge/-salt/-stipple` as response ids; textures stay `wc/builtin-*` / `wc/custom-*`.

## 9. Test dispositions (old-law pins)

Verified this session unless marked †: re-verify before editing.

| File / test | Old pin | Disposition |
|---|---|---|
| `packages/efx-watercolor/src/playground/brushBridge.test.ts` (header laws TIP-05/D-22; 95-170) | mask wins; CUSTOM_BASE physics; `brush.id === texture id`; registry beats preset | **Rewrite the file** to the new law: preset physics + texture tip; `buildBrushForStroke('round', { textureId })`; `brush.id === 'round'`; keep tipMean formula and multiplier tests over the preset base. Delete "registry wins over the preset path" (inverted). |
| `packages/efx-watercolor/src/brushes/builtinBake.test.ts:186-199` | `buildBrushForStroke('wc/builtin-bristle')` → shipped mask | Rewrite to `('round', { textureId: 'wc/builtin-bristle' })`; keep byte-equality proof. |
| `app/src/lib/efxPaintBrushImport.test.ts:83-97` | `buildBrushForStroke(entry.id)` → mask | Rewrite to a response + `textureId: entry.id`. |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | 385 sections Presets/Texture/Custom; 537/550 picking texture/custom cards; 595-617 painted built-in thumb (`brush.id === 'wc/builtin-chalk'`); 673 import row; 738/770 greyed + one warning | Retarget: single response grid + texture row; chips render masks (no paint spy for chips); import selects on arrival; gating on chips. Delete the painted-texture-thumb test. |
| `app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts:82-88` | SOURCE contains `buildBrushForStroke(tipId)` | Update to the new call shape; cache-key pins stay for response thumbs. |
| `app/src/components/physic-paint/view/aquarellePresetSelection.test.ts:94, 286-296` | `buildBrushForStroke(id, undefined, 7)` | Options form `{ seed: 7 }`; assertions unchanged. |
| `app/src/components/physic-paint/engine/aquarelleFootprint.test.ts:39-41, 53` | mock wrapper + `(id, overrides)` | Wrapper type follows automatically; add a cache-invalidation test on texture change. |
| `app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts:724-738` † | `buildBrushForStroke('flat', overrides)` | Options form; assert no texture reaches the lift. |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts:80` † | `(round, overrides)` | Options form; add band-uses-textureId test. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts:1301` † | `buildBrushForStroke('round')` | Options form. |
| `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts:332` † | source pins `tipId: aquarelleActiveTipId(),` / `toolOverrides: selection.toolOverrides,` | Add a `textureId:` pin. |
| `app/src/stores/aquarelleBrushCatalog.test.ts:227-229, 656, 698` † | `selectAquarelleTip(texture)` expectations | Retarget to the texture signal (or keep only catalog-listing assertions). |
| `app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts:122-130, 169, 181, 200, 221` | item count = `BRUSH_PRESETS.length`; region; pick closes; fixed height; thumb ratio | Keep list assertions; add strip order/pick assertions; height math may need a strip-height fixture. |
| `packages/efx-watercolor/src/brushes/maskRegistry.test.ts:232, 245, 297, 307, 321` † | registry mechanics + mask-backed build | Registry tests stay; retarget any build assertions. |
| `app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts` † | `aquarelleBrushForActiveTool()` fields | Add `textureId: null` for lift. |
| `packages/efx-watercolor/probe/*` | compile-time callers | Options form. |

**New tests required by acceptance:** live/bake/replay parity for the same ids (5); payload codec + Roto script round-trip with `textureId` (6); unknown texture → response tip + exactly one warning (7); eraser unaffected (8); popover strip present (9); grid lists responses only (4); Default chip repaints with the response (2); copy/duplicate preserves texture (§2 rebuild sites).

## 10. Open questions

1. **Per-response texture memory vs one global signal** — the user quote says "each brush response can have a texture"; CONTEXT locks a single `aquarelleSelectedTextureId` signal. Follow CONTEXT (global). If the intent was per-response recall, that is a phase-64 addition.
2. **Keep `selectAquarelleTip`'s catalog branch?** Recommend keep (additive, no UI caller after the grid change); removing it would touch 536-call-site surface for no gain.
3. **Rust-side `textureId` validation** — optional hardening only; the JS codec is the fail-closed gate.

## Sources

- `packages/efx-watercolor/src/playground/brushBridge.ts` (full read), `playground/brushes.ts` (66-81, 171-196, 340-369), `brushes/deriveMask.ts`, `brushes/builtinTips.ts`
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` (60-199), `payload/codec.ts` (30-41, 130-189)
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` (98-104, 288-301); `packages/efx-paint-host/src/animation/types.ts`
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` (100-144, 250-290, 300-370, 1770-1801, 2028-2056)
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` (142-171, 304-315, 489-508, 556-605); `engine/aquarelleFootprint.ts` (70-90); `view/aquarelleStrokeBand.ts` (86-101); `roto/aquarelleLiftErase.ts` (86-101); `view/watercolorStrokeThumb.ts` (185-213)
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` (240-289, 347-396); `view/PhysicsPaintBrushMenu.tsx` (44-113); `view/vectorPathHandles.ts` (120-129, 1004-1035)
- `app/src/stores/aquarelleBrushCatalog.ts` (85-98, 135-137); `roto/physicsPaintRotoScriptLibrary.ts` (325-390, 716); `roto/physicsPaintRotoScriptSchema.ts` (184-194); `roto/physicsPaintRotoDuplicateScript.ts` (178-217)
- `app/src-tauri/src/services/script_library.rs` (2807-2854); `app/vite.config.ts` (285-292)
- Tests: `brushBridge.test.ts`, `builtinBake.test.ts`, `efxPaintBrushImport.test.ts`, `WatercolorBrushLibrary.test.ts`, `watercolorStrokeThumb.test.ts`, `aquarellePresetSelection.test.ts`, `aquarelleFootprint.test.ts`, `PhysicsPaintBrushPicker.test.ts` (read this session)

## Metadata

**Confidence breakdown**
- Standard stack / carrier decision: HIGH — codec, host type and Rust validator read directly.
- Architecture / call-site inventory: HIGH — exhaustive grep of production callers.
- UI measurement and chip rendering: MEDIUM — mechanics verified; visual sizing is a plan-time choice.
- Test dispositions: HIGH for files read this session; line numbers marked † from the prior pass.

**Research date:** 2026-11-15
**Valid until:** 2026-12-15 (internal codebase; re-check if phase 63 UAT edits land first).
