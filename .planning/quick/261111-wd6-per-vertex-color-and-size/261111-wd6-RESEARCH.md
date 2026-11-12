# Quick Task 261111-wd6: Per-Vertex Colour and Vertex Size — Research

**Researched:** 2026-11-11
**Domain:** EFX watercolor pigment seam, AQTL v2 binary codec, path-edit commit UI (Preact/signals)
**Confidence:** HIGH on file-level integration points; MEDIUM on "engine colour is provably export-identical" (GPU pins skip under vitest — §6)

No external packages are added, so the package-legitimacy gate does not apply.

## Summary

The task threads one optional per-anchor `color` key through four layers: the persisted anchor law (`packages/efx-watercolor/src/payload/vectorPath.ts`), the AQTL v2 anchor record (`app/.../scriptTimelineCodec.ts`), the `.mce` declaration mirror in both languages, and the engine pigment channel (`Engine.ts` + `engineAdapter.ts`). Every UI seam already exists: `vectorAnchorSelection` is the one anchor selection, `commitAquarelleVectorPathEdit` is the one undo-entry/re-bake wrapper, and `applyAnchorWidths` is the exact template for a per-vertex commit.

The highest-severity risk is silent data loss in the package anchor law, not the engine: `canonicalAnchor`, `projectVectorPath` and `anchorsEqual` each independently drop or ignore an unknown key, and `updateAquarellePathInScript` returns 0 when `anchorsEqual` says "equal" — an anchor-colour commit would look like a no-op with no error.

**Primary recommendation:** ride the existing per-sample width channel end to end (queued `Sample` → `Stroke` pair → `widthFactorAt`-style coefficient lerp), derive the colour profile once at activation beside `resolveStrokeWidthFactors`, and route the commit through `commitAquarelleVectorPathEdit` exactly like `applyAnchorWidths`. Do not escalate the engine part: determinism is achievable in quick scope; only the pixel-level export proof needs probe/live UAT (§6).

## Corrections to the brief's established facts

| Brief said | Actual | Evidence |
|---|---|---|
| "9 coeff Float32Arrays" | `COEFFS = 7` plus a `white` scalar; `stamp()` splits `coeffs[0..3]` → `uColor0`, `coeffs[4..6]` + `white` → `uColor1` | `[VERIFIED: packages/efx-watercolor/src/playground/spectral.ts:3-13]` — `export const COEFFS = 7;` … `export interface Pigment { coeffs: Float32Array; white: number; }`. `[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1774-1776]` — `const c = this.pigment.coeffs;` `const c0 = [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount];` `const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, this.pigment.white * amount * 1.6];` |
| `MIN_ANCHOR_BYTE_LENGTH = 14` | `4 + 4 + 1 + 1 + 1` = **11** (x f32, y f32, kind, handleFlags, widthPresent) | `[VERIFIED: app/src/components/physic-paint/performance/scriptTimelineCodec.ts:183-184]` — `/** x + y (two f32) + kind + handleFlags + widthPresent. */` / `const MIN_ANCHOR_BYTE_LENGTH = 4 + 4 + 1 + 1 + 1;` |

## 1. Engine colour integration

### Where the pigment lives today

One engine field, `this.pigment`. Complete list of reads:

| Site | What reads it | Stroke-owned? |
|---|---|---|
| `Engine.ts:1774-1776` | brush dab: builds `c0`/`c1` before `eachDab` | yes |
| `Engine.ts:1809-1811` | pen dab: `splatInk(...)` | yes |
| `Engine.ts:801,807` | bucket fill `fillStep` | no (fill tool) |
| water dab `1789-1805`, lift `1815-1828`, `drawDisplay`, `exportCanvas`, `hasPaint`, `readFlat`, `step` | no pigment read | — |

`[VERIFIED: Engine.ts:1774-1776, 1809-1811, 1789-1805, 1815-1828]`

Because brush/pen read `this.pigment` once per `stamp()` call (before `eachDab`), assigning `this.pigment` immediately before each `stamp()` is sufficient and is "per dab" for this engine.

### The width channel is the exact template

- Authoritative per-sample record: `interface Sample { x: number; y: number; p: number; t: number; tx: number; ty: number; w: number }` `[VERIFIED: Engine.ts:98]`
- Only the deposited pair lives on the stroke: `widthFrom: number; widthTo: number;` `[VERIFIED: Engine.ts:121-122]`
- `scriptBegin` pushes `w: scriptWidthFactor(widthScale)` `[VERIFIED: Engine.ts:873]`; `scriptMove` pushes the same `[VERIFIED: Engine.ts:881]`
- First sample: `s.widthFrom = s.widthTo = q.w;` then `this.stamp(s, q.x, q.y, s.pr, 0, 0, 1, 0, q.w)` `[VERIFIED: Engine.ts:1652-1655]`; per consumed sample: `s.widthFrom = s.widthTo; s.widthTo = q.w;` `[VERIFIED: Engine.ts:1662-1663]`; dwell: `this.widthFactorAt(s, 1)` `[VERIFIED: Engine.ts:1690]`
- Interpolation: `const u = clamp(fraction, 0, 1); return s.widthFrom + (s.widthTo - s.widthFrom) * u;` `[VERIFIED: Engine.ts:1601-1604]`
- Mid-segment dab: `this.widthFactorAt(s, (i - 1 + t) / n)` with `n = clamp(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48)` `[VERIFIED: Engine.ts:1714, 1738]`

Colour rides this exact queue entry (CONTEXT specifics: "not a parallel path").

### Recommended seam shape

- `Sample` gains an optional colour payload (hex string recommended — the engine converts once per sample).
- `Stroke` gains `pigFrom`/`pigTo` (or `colorFrom`/`colorTo` + precomputed `Pigment` pair) mirroring `widthFrom`/`widthTo`.
- `scriptBegin`/`scriptMove` gain ONE trailing optional parameter. This breaks a deliberate source pin: `expect(moveLine!.trimEnd().endsWith('widthFactor)')).toBe(true)` `[VERIFIED: packages/efx-watercolor/src/adapter/engineAdapter.test.ts:634]`. Update the pin to assert the colour argument; never delete it.
- `processInput` sets the pair at the first sample and per consumed sample; `trace` assigns `this.pigment` from the lerped pair before each `stamp()`.
- Adapter: derive the profile once beside `widths` — `resolveStrokeWidthFactors(parsed.engine, parsed.pts)` at `engineAdapter.ts:399`, `:416`, `:443` `[VERIFIED]` — add `colors: resolveStrokeColors(...)` to those activation records and index it in `feedDueSample` exactly like `active.widths` `[VERIFIED: engineAdapter.ts:282]`.
- Inheritance subtlety: absent anchor colour means the STROKE colour. The adapter resolves the base as `stroke.color ?? payload.color` `[VERIFIED: engineAdapter.ts:247]`, so the sampler must receive that same resolved hex; otherwise neutral stations would differ from the engine's base pigment.

### Interpolation choice — measured

| Option | Verdict |
|---|---|
| (a) lerp converted coeff arrays per dab | Correct and cheap; it is the inner loop of (c) |
| (b) RGB lerp + `pigmentFromHex` per dab | Rejected: contradicts the lock ("conversion per sample, not per dab") and costs ~1.5 µs per dab (up to 48/segment) |
| (c) precompute one `Pigment` per sample at activation, then lerp coeffs per dab | **Recommended** — deterministic, allocation-free |

`pigmentFromHex` measured at **1.538 µs/call** (20,000 iterations against `packages/efx-watercolor/dist/index.mjs`), returning `coeffs.length === 7`, `white === 0` `[VERIFIED: benchmark this session]`. A 40–80-sample stroke → ~60–120 µs once at activation. Lerp 7 floats + `white` into ONE engine-owned scratch `Pigment` per dab (no allocation). `pigmentFromHex` already returns `{ coeffs, white: 0 }` `[VERIFIED: spectral.ts:43-52]`, so `white` stays 0 for any two `pigmentFromHex` endpoints. Coefficient-space mixing is already the project's law (`mixToHex`, `[VERIFIED: spectral.ts:76-81]`).

Determinism: the base pigment already flows through `pigmentFromHex` in `configure()` `[VERIFIED: engineAdapter.ts:247-248]`, so per-sample conversion adds no new float class; the derivation is pure (no clock, no RNG), the same law as `resolveStrokeWidthFactors` `[VERIFIED: engineAdapter.ts:125-138]`.

### Restore / leak containment

- Two independent self-heal layers: `configure()` re-sets the base before every baked stroke (`const hex = stroke.color ?? payload.color; if (typeof hex === 'string' && hex.length > 0) engine.setPigment(pigmentFromHex(hex))`) `[VERIFIED: engineAdapter.ts:247-248]`; the live canvas re-sets it every rAF frame `[VERIFIED: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:649, 883]`.
- Lock requires the stroke's base pigment restored at stroke begin/end: capture `this.pigment` at `scriptBegin` (into the Stroke or a private field) and restore at `scriptEnd`/the `this.stroke = null` at `processInput` `[VERIFIED: Engine.ts:1691-1692]`.
- The end site is NOT the only drop. `this.stroke = null` also occurs at `resizeDocument` 456, `restore` 598, `clear` 1295, `resetSheet` 1320, `abortStroke` 1332, `travel` 1357 `[VERIFIED: Engine.ts stroke-drop sites]`. A restore only at 1692 can leak `this.pigment` into the next `fillStep` (801/807) after an abort. Centralise the drop in one private helper, or restore at all seven sites.
- Belt-and-braces that keeps the lock's wording: restore the base immediately after each `stamp()` returns (two writes per dab), making containment structural rather than site-dependent.

## 2. Codec / byte risks

### Symmetry surface

| Concern | Location | Change |
|---|---|---|
| Flag constants | `174-178` | add `VECTOR_FLAG_ANCHOR_COLOR = 1 << 3`, OR into `VECTOR_FLAGS_MASK` |
| Hostile-count lower bound | `183-184` | **no change** — 11 stays a conservative lower bound (true minimum with bit 3 is 12, which still passes) |
| Encode pre-scan | `529-553` | like `curveMode`, inspect anchors BEFORE writing flags; set bit 3 only when ≥1 anchor has `color !== undefined` |
| Anchor record encode | `495-521` | after the width pair: `u8 colorPresent`; when present `writer.string(color, ...)` — `BinaryWriter.string` already writes `u16 length + UTF-8` `[VERIFIED: scriptTimelineCodec.ts:299-308]` |
| Anchor record decode | `768-797` | after width: `reader.presence(...)` `[VERIFIED: :405-411]`, then `reader.string(...)` which bounds-checks `need(byteLength)` `[VERIFIED: :413-424]` — satisfies the locked "u16 length against remaining bytes" |
| Reserved flags | `804-806` | unchanged; older readers fail closed on bit 3 as CONTEXT states |
| Header comment | `36-50` | document bit 3 and "written last per anchor" |
| Version | `93-94` | unchanged at 2 |

`[VERIFIED: scriptTimelineCodec.ts:174-184]` — `const VECTOR_FLAG_ANCHORS = 1 << 0;` / `const VECTOR_FLAG_LEGACY_BYTE = 1 << 1;` / `const VECTOR_FLAG_CURVE_MODE = 1 << 2;` / `const VECTOR_FLAGS_MASK = VECTOR_FLAG_ANCHORS | VECTOR_FLAG_LEGACY_BYTE | VECTOR_FLAG_CURVE_MODE;`

### Other AQTL consumers

None need editing: `studioScriptSnapshotCodec.ts` embeds and re-reads the AQTL body verbatim (`encodeScriptTimelineBinary(input.watercolorEvents)` at 536, `decodeScriptTimelineBinary(watercolorBody)` at 614) `[VERIFIED]`. There is no Rust AQTL parser — the Rust anchor models are a declaration surface only `[VERIFIED: app/src-tauri/src/models/project.rs:482-485]` ("declaration surface, not a second parser").

### Colour-string validation — one sub-decision to lock

1. **Codec preserves verbatim (recommended):** encode validates `typeof === 'string'` and UTF-8 length (`writer.string` enforces ≤65535), decode returns bytes unchanged; canonicalisation has ONE home (the package normaliser). Byte-stable fixed point is trivial.
2. **Codec canonicalises** on both sides via the package normaliser — self-consistent but adds a runtime package import the codec does not have today.

Pick one explicitly; they differ on reopen bytes for a non-canonical foreign file.

### Tests that break vs. pins that protect colourless identity

- **Break deliberately:** `engineAdapter.test.ts:614-637`, line 634 (`moveLine.trimEnd().endsWith('widthFactor)')`).
- **Must update:** `mceFieldContract.test.ts:277` — `expectMemberKeys('MceAquarelleAnchor', ['x', 'y', 'kind', 'in', 'out', 'width'])`; `diffMember` requires exact two-language parity, so the field must land on both sides AND in this list.
- **Relabel pins:** `PhysicsPaintStrokeSettingsDialog.test.ts:357-358` (`label="Anchor width"`, `ariaLabel="Anchor width"`); the first-`stroke-settings-anchor-width`-occurrence rule at `:367` survives while the testid stays.
- **Stay green unchanged:** `JSON_BYTE_LENGTH = 18068`, `BINARY_BYTE_LENGTH = 3742`, `MEASURED_RATIO = 4.83` `[VERIFIED: scriptTimelineCodec.test.ts:207-209]`; hand-painted `V1_MINIMAL_BYTE_LENGTH = 93` + 1 flags byte `[VERIFIED: :535-544]`; fixed-point/re-encode `[VERIFIED: :617-651]`; `VECTOR_ANCHOR_COUNT_OFFSET = 74`, `POINT_COUNT_OFFSET = VECTOR_ANCHOR_COUNT_OFFSET + 43` `[VERIFIED: :261, :522]`.
- **New pins:** (i) colourless fixture byte-identical to today; (ii) coloured anchor sets bit 3 and pays exactly `1 (present) + 2 (len) + utf8` bytes, after `width`; (iii) decode→encode fixed point with colour; (iv) unknown flag bits still rejected; (v) truncation inside a colour block → `truncated`; (vi) presence marker ≠ 0/1 → `invalid-value`.
- **Layout comment to update:** `scriptTimelineCodec.test.ts:248-258` documents the per-anchor byte layout.

## 3. Undo / edit wrapper

### Whole-stroke colour today (must remain the no-selection fallback)

`RightPanelColorTab` fires `props.onColorCommit?.(normalized, props.opacity)` once per gesture `[VERIFIED: RightPanelColorTab.tsx:160-165]` → `handleRightPanelColorCommit` requires `aquarelleSelectMode.peek()`, reads `scriptSelectedStrokeIds.peek()`, calls `aquarelleAppearanceCommitRef.current?.(ids, { color })` `[VERIFIED: PhysicsPaintStudio.tsx:7456-7461]` → `handleAquarelleAppearanceStrokes` → `beginAquarelleAppearanceEdit`, which also runs `bumpAquarellePaintSeedSalts(ids)` `[VERIFIED: aquarelleStrokeSelection.ts:972-990]`.

### The anchor-commit mirror (recommended)

`applyAnchorWidths` is the template `[VERIFIED: PhysicsPaintStudio.tsx:11655-11671]`: `resolveAnchorWidthTarget({ ids, pathEditMutationId })` → `getRecordedAquarelleStroke` → `normaliseAquarelleAnchors` → `buildAnchorWidthCommit(anchors, vectorAnchorSelection.peek(), value)` → `commitAquarelleVectorPathEdit(target, next)`.

`commitAquarelleVectorPathEdit` `[VERIFIED: PhysicsPaintStudio.tsx:10216-10277]`: guards → `await ensureAquarelleDurableBaseRef` → read `draftMode`/`wireframeMode` AFTER the await → `beginAquarellePathEdit(mutationId, anchors)` (which does `updateAquarellePathInScript` then `storeAquarelleEdit`) `[VERIFIED: aquarelleStrokeSelection.ts:1032-1043]` → Draft/wireframe records + marks dirty; otherwise `runAquarelleScriptRebake({ resetSheet, applyTimeline })`, record on success, restore snapshot on failure.

**Yes, an anchor colour change re-bakes** — same cost class as today's anchor width commit (full reset + timeline apply). `beginAquarellePathEdit` deliberately skips `bumpAquarellePaintSeedSalts` `[VERIFIED: aquarelleStrokeSelection.ts:1027-1030]` ("a geometry edit must not re-roll the paint"). Decide explicitly whether colour inherits that; the strongest reading of the lock is no bump.

**Selection interaction:** `vectorAnchorSelection` is the ONE anchor selection `[VERIFIED: vectorPathLatches.ts:31-35]`. Branch in `handleRightPanelColorCommit`: `vectorAnchorSelection.peek().length > 0` AND an open path edit → anchor commit; otherwise today's whole-stroke path byte-for-byte. `buildAnchorColorCommit` should be a sibling of `buildAnchorWidthCommit` `[VERIFIED: vectorPathHandles.ts:570-581]` and must spread the anchor (`{ ...anchor, color }`) so width survives. Existing `withoutWidth(anchor)` already preserves unrelated keys, so width commits preserve `color` `[VERIFIED: vectorPathHandles.ts:556-560]`. Unlike width there is no "default deletes the key" rule — an explicit colour is stored even when it equals the stroke colour.

### Silent-wipe / silent-no-op hazards (highest severity)

`updateAquarellePathInScript` `[VERIFIED: aquarelleRecordState.ts:1041-1083]`:

```
const nextAnchors = projectVectorPath(normalised);
if (anchorsEqual(stroke.anchors ?? [], nextAnchors)) return 0;
```

- `anchorsEqual` without a colour comparison → a colour-only commit returns 0 → `beginAquarellePathEdit` returns null → no undo entry, no error.
- `projectVectorPath` without colour → the key is wiped on the next drag.
- `canonicalAnchor` without colour → `normaliseAquarelleAnchors` returns `undefined` and the whole path is refused.

All three live in `packages/efx-watercolor/src/payload/vectorPath.ts` `[VERIFIED: canonicalAnchor 180-200, anchorsEqual 231-249, projectVectorPath 258-269]` and must change together with `MutableAnchor` at `:166-173`.

## 4. Persistence mirrors

The engine slot is opaque on the wire; these declarations exist so the dual-language contract cannot silently drop the key on regeneration `[VERIFIED: mceFieldContract.test.ts:262-272]`.

| Language | File | Change |
|---|---|---|
| TS | `app/src/types/project.ts:341-348` | add `color?: string;` after `width?: number;` |
| Rust | `app/src-tauri/src/models/project.rs:488-496` | add `pub color: Option<String>,` after `pub width: Option<f32>,` |
| Contract pin | `app/src/lib/mceFieldContract.test.ts:277` | add `'color'` to the expected key list |

No serde rename (`color` is identical in both languages). No Rust parser, no `.mce` version change; absent key = `None`/`undefined`, so old projects are unaffected.

The app-side `AquarelleAnchor` is a type ALIAS of the package `VectorAnchor`, re-exported as `AquarelleAnchor` `[VERIFIED: packages/efx-watercolor/src/payload/vectorPath.ts:36-40]` — so adding `color?: string` to `VectorAnchor` `[VERIFIED: packages/efx-watercolor/src/vector/spine.ts:42-52]` is the single type change that reaches the codec, the commit builders and the record store.

Package hex normaliser (CONTEXT law) mirrors the app's private one: regex `^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`, expand 3→6, lowercase, and the 8-digit form drops its alpha pair `[VERIFIED: RightPanelColorTab.tsx:20-27]` — `return \`#${hex.slice(0, 6).toLowerCase()}\`;`. The package already exports `hexToRgb`/`rgbToHex` for the sampler `[VERIFIED: spectral.ts:19-27]`.

## 5. Test infrastructure

| Suite | Command | Notes |
|---|---|---|
| Package tests | `cd packages/efx-watercolor && pnpm test` (= `vitest run`) | `[VERIFIED: packages/efx-watercolor/package.json:63]` |
| Package typecheck | `pnpm --filter @efxlab/efx-watercolor check` | `tsc --noEmit` `[VERIFIED: :62]` |
| Package build | `pnpm --filter @efxlab/efx-watercolor build` | `tsup`; REQUIRED after edits — the app resolves `dist` `[VERIFIED: :60]` |
| App tests | `cd app && pnpm exec vitest run <paths>` | app `"test": "vitest"` starts WATCH mode — never use it `[VERIFIED: app/package.json:11]` |
| App typecheck | `cd app && pnpm typecheck` | `tsc --noEmit` `[VERIFIED: app/package.json:10]` |

- App vitest collects ONLY `src/**/*.test.ts` and `../packages/efx-paint-host/src/**/*.test.ts` `[VERIFIED: app/vitest.config.ts:5]` — a new `.test.tsx` exits 0 running nothing. Still true.
- Package has no vitest config; default globs collect `src/**/*.test.ts`.
- Relevant existing files: package `src/vector/spine.test.ts` (`sampleVectorWidths` describe at 343), `src/payload/vectorPath.test.ts`, `src/payload/codec.test.ts`, `src/adapter/engineAdapter.test.ts`; app `performance/scriptTimelineCodec.test.ts`, `view/aquarelleRecordState.reopenCurveMode.test.ts` (reopen template), `view/aquarelleRecordState.path.test.ts`, `view/vectorPathHandles.test.ts`, `view/vectorPathLatches.test.ts`, `view/PhysicsPaintStrokeSettingsDialog.test.ts`, `PhysicsPaintStudio.test.ts`, `lib/mceFieldContract.test.ts`.
- GPU pins are blind under vitest: `hasWebGL2()` returns false when `document === undefined` `[VERIFIED: engineAdapter.test.ts:46-57]`, so the byte-identical pixel pin at `:307-327` sits inside `describe.skipIf(!gpu)`. Any "export parity green" claim must come from the headless probe `packages/efx-watercolor/probe/vector-spine/run.mjs` or native UAT, never vitest.

## 6. Risks / escalation

| Risk | Severity | Mitigation |
|---|---|---|
| Package anchor law drops/ignores `color` (`canonicalAnchor`, `projectVectorPath`, `anchorsEqual`) | HIGH — silent wipe or silent no-op | Change all three + `MutableAnchor` in one task; add a colour-only commit test through `updateAquarellePathInScript` |
| Pigment leak into a later fill after an aborted/dropped stroke | MEDIUM — wrong-colour fill | Restore at all seven `this.stroke = null` sites (or centralise); adapter/live containment self-heals every stroke/frame |
| Export/determinism proof unavailable in vitest | MEDIUM — cannot claim parity from CI | Probe or native UAT; do not weaken the pin |
| Banding at the 0.04 uv sample grid | LOW | `trace` subdivides each segment into 1–48 dabs and interpolates inside it `[VERIFIED: Engine.ts:1714, 1738]`; residual artefact is a sub-sample corner cut at an anchor boundary |
| `resolveCurveAnchors` drops `color` in the spline view | LOW–MEDIUM if a colour sampler consumes the resolved view | `sampleVectorColors` must take the AUTHORED anchors (like `sampleVectorWidths` `[VERIFIED: spine.ts:308-333]`); optionally preserve `color` in `resolveCurveAnchors` `[VERIFIED: vectorPath.ts:136-149]` |
| `scriptMove` signature pin | LOW — deliberate test update | Update `engineAdapter.test.ts:634` to pin the colour argument |

**Escalation verdict:** do NOT escalate the engine part on determinism grounds. The per-sample derivation is pure, the conversion is already in the deterministic path, and the interpolation is fixed-order arithmetic. Escalate ONLY if the plan requires a vitest-provable GPU pixel pin for export parity — that needs a GPU harness outside quick scope.

**Open question:** how does a user clear an explicit anchor colour back to "inherit"? The lock specifies setting only. Treat as out of scope unless the user decides otherwise; do not invent a control.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | "RGB lerp" means per-component lerp of the sRGB hex components, then canonicalise to hex | 1 | A linear-light lerp would shift midtones; confirm if visual fidelity matters |
| A2 | An anchor colour commit should NOT bump the paint-seed salt (mirroring geometry edits) | 3 | If it should bump, the texture re-rolls on every colour change |

Everything else here is verified against the cited files.

## Sources

- `packages/efx-watercolor/src/playground/Engine.ts`, `spectral.ts`, `adapter/engineAdapter.ts`, `adapter/engineAdapter.test.ts`, `vector/spine.ts`, `payload/vectorPath.ts`
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` (+ `.test.ts`), `performance/studioScriptSnapshotCodec.ts`
- `app/src/components/physic-paint/view/aquarelleRecordState.ts`, `aquarelleStrokeSelection.ts`, `vectorPathHandles.ts`, `vectorPathLatches.ts`, `RightPanelColorTab.tsx`, `PhysicsPaintStrokeSettingsDialog.tsx` (+ `.test.ts`), `strokeSettingsModel.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (+ `.test.ts`), `engine/AquarelleCanvasLayer.tsx`
- `app/src/types/project.ts`, `app/src-tauri/src/models/project.rs`, `app/src/lib/mceFieldContract.test.ts`
- `app/vitest.config.ts`, `app/package.json`, `packages/efx-watercolor/package.json`
- Benchmark: `pigmentFromHex` 1.538 µs/call against `packages/efx-watercolor/dist/index.mjs`

**Research date:** 2026-11-11
**Valid until:** the next edit to any cited file (same-repo integration map, not an ecosystem survey)
